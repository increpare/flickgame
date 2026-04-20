import SwiftUI
import UIKit
import WebKit

/// Hosts flickgame (`index.html` + bundled assets) in a `WKWebView`.
struct FlickWebViewRepresentable: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        let contentController = WKUserContentController()
        let hostFlag = """
        window.FLICKGAME_HOST = 'ios-app';
        window.FLICKGAME_IOS_APP = true;
        """
        let hostScript = WKUserScript(source: hostFlag, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        contentController.addUserScript(hostScript)
        Self.addStandaloneTemplateUserScript(to: contentController)
        contentController.add(context.coordinator, name: "flickExport")
        config.userContentController = contentController
        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.shareAnchorWebView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        context.coordinator.normalizeScrollGeometry(for: webView)
        webView.allowsBackForwardNavigationGestures = true

        if let url = Bundle.main.url(forResource: "gallery", withExtension: "html", subdirectory: "www") {
            let dir = url.deletingLastPathComponent()
            webView.loadFileURL(url, allowingReadAccessTo: dir)
        } else {
            context.coordinator.loadMissingBundleError(on: webView)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    /// WKWebView does not allow `XMLHttpRequest` from `file://` pages to sibling files.
    /// Export reads `play.html` as a string; inject it at document start so the web bundle matches the site.
    private static func addStandaloneTemplateUserScript(to contentController: WKUserContentController) {
        guard let url = Bundle.main.url(forResource: "play", withExtension: "html", subdirectory: "www"),
              let data = try? Data(contentsOf: url),
              !data.isEmpty
        else {
            return
        }
        let b64 = data.base64EncodedString()
        let source = "window.FLICKGAME_STANDALONE_PLAY_HTML_B64='\(b64)';"
        let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        contentController.addUserScript(script)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        /// Used as `popoverPresentationController` anchor for export share sheet on iPad.
        weak var shareAnchorWebView: WKWebView?

        func normalizeScrollGeometry(for webView: WKWebView) {
            let scrollView = webView.scrollView
            scrollView.contentInsetAdjustmentBehavior = .never
            scrollView.contentInset = .zero
            scrollView.scrollIndicatorInsets = .zero
            scrollView.insetsLayoutMarginsFromSafeArea = false
            if #available(iOS 13.0, *) {
                scrollView.automaticallyAdjustsScrollIndicatorInsets = false
                scrollView.verticalScrollIndicatorInsets = .zero
                scrollView.horizontalScrollIndicatorInsets = .zero
            }
        }

        func dispatchViewportSettleEvents(on webView: WKWebView) {
            let script = """
            (function () {
              function fire() {
                try { window.dispatchEvent(new Event('resize')); } catch (e) {}
                try { window.dispatchEvent(new Event('orientationchange')); } catch (e) {}
              }
              fire();
              requestAnimationFrame(fire);
              setTimeout(fire, 180);
            })();
            """
            webView.evaluateJavaScript(script, completionHandler: nil)
        }

        /// `target=_blank` / `window.open` — load in the same web view.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "flickExport" else { return }
            guard let body = message.body as? [String: Any],
                  let b64 = body["dataBase64"] as? String,
                  let filename = body["filename"] as? String,
                  let data = Data(base64Encoded: b64)
            else {
                return
            }
            let safeName = (filename as NSString).lastPathComponent
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + safeName)
            do {
                try data.write(to: tempURL)
            } catch {
                return
            }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard let vc = self.topViewController() else { return }
                let av = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
                av.completionWithItemsHandler = { _, _, _, _ in
                    try? FileManager.default.removeItem(at: tempURL)
                }
                if let pop = av.popoverPresentationController, let anchor = self.shareAnchorWebView {
                    pop.sourceView = anchor
                    pop.sourceRect = CGRect(x: anchor.bounds.midX, y: anchor.bounds.midY, width: 1, height: 1)
                    pop.permittedArrowDirections = []
                }
                vc.present(av, animated: true)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            normalizeScrollGeometry(for: webView)
            DispatchQueue.main.async { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.dispatchViewportSettleEvents(on: webView)
            }
        }

        private func topViewController() -> UIViewController? {
            let scenes = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
            let window = scenes
                .flatMap { $0.windows }
                .first { $0.isKeyWindow } ?? scenes.flatMap { $0.windows }.first
            var vc = window?.rootViewController
            while let presented = vc?.presentedViewController {
                vc = presented
            }
            return vc
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            DispatchQueue.main.async {
                guard let vc = self.topViewController() else { completionHandler(); return }
                let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
                vc.present(alert, animated: true, completion: nil)
            }
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (Bool) -> Void) {
            DispatchQueue.main.async {
                guard let vc = self.topViewController() else { completionHandler(false); return }
                let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
                alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
                vc.present(alert, animated: true, completion: nil)
            }
        }

        func webView(_ webView: WKWebView,
                     runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            DispatchQueue.main.async {
                guard let vc = self.topViewController() else { completionHandler(nil); return }
                let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
                alert.addTextField { tf in
                    tf.text = defaultText
                }
                alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
                alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                    completionHandler(alert.textFields?.first?.text)
                })
                vc.present(alert, animated: true, completion: nil)
            }
        }

        func loadMissingBundleError(on webView: WKWebView) {
            let html = """
            <html><head><meta name="viewport" content="width=device-width"/></head>
            <body style="font-family:-apple-system;padding:16px;background:#111;color:#eee">
            <p>Missing bundled <code>www</code> folder. From the repo root, run:</p>
            <pre style="background:#222;padding:8px;overflow:auto">\
            ios/scripts/sync-web-assets.sh "$(pwd)" ios/FlickgameShell/FlickgameShell/www</pre>
            <p>Then build again in Xcode.</p>
            </body></html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }
    }
}
