import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebKit

/// A game file opened from outside the app (AirDrop, Messages, Files). It waits here until the
/// gallery page says it is ready, then is imported and played.
final class IncomingGame {
    static let shared = IncomingGame()
    weak var webView: WKWebView?
    private var pending: (name: String, data: Data)?

    func open(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        // The file is opened where it lives (Files, iCloud Drive), so read it through a coordinator.
        var data: Data?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: nil) { data = try? Data(contentsOf: $0) }
        guard let data else { return }
        pending = (url.lastPathComponent, data)
        // Go (back) to the gallery, keeping any unsaved work in the editor first.
        let script = """
        (function () {
          function go() { window.location.href = 'gallery.html'; }
          var ui = window.FlickGalleryUI;
          if (typeof saveCurrentToGallery === 'function' && ui && ui.isDirty && ui.isDirty()) {
            saveCurrentToGallery({ silent: true }).then(go, go);
          } else {
            go();
          }
        })();
        """
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }

    func deliver() {
        guard let game = pending else { return }
        pending = nil
        importIntoGallery(name: game.name, data: game.data, thenOpen: "play.html")
    }

    /// Must be called while the gallery page is showing.
    func importIntoGallery(name: String, data: Data, thenOpen page: String) {
        guard let nameJSON = try? JSONSerialization.data(withJSONObject: [name]),
              let nameArray = String(data: nameJSON, encoding: .utf8)
        else { return }
        let script = "window.FlickGalleryPage.importIncoming('\(data.base64EncodedString())', \(nameArray)[0], '\(page)');"
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }
}

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
        let hostScript = WKUserScript(source: hostFlag, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        contentController.addUserScript(hostScript)
        Self.addStandaloneTemplateUserScript(to: contentController)
        Self.addSystemIconsUserScript(to: contentController)
        contentController.add(context.coordinator, name: "flickExport")
        contentController.add(context.coordinator, name: "flickIncoming")
        contentController.add(context.coordinator, name: "flickImport")
        contentController.add(context.coordinator, name: "flickSupporter")
        config.userContentController = contentController
        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.shareAnchorWebView = webView
        IncomingGame.shared.webView = webView
        Supporter.shared.webView = webView
        Supporter.shared.start()
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        context.coordinator.normalizeScrollGeometry(for: webView)
        webView.allowsBackForwardNavigationGestures = true

        // The app is local-only: block every network request before the first page loads.
        let coordinator = context.coordinator
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "flickgame-offline",
            encodedContentRuleList: Self.offlineRules
        ) { ruleList, _ in
            assert(ruleList != nil, "offline rule list failed to compile")
            if let ruleList {
                contentController.add(ruleList)
            }
            if let url = Bundle.main.url(forResource: "gallery", withExtension: "html", subdirectory: "www") {
                let dir = url.deletingLastPathComponent()
                webView.loadFileURL(url, allowingReadAccessTo: dir)
            } else {
                coordinator.loadMissingBundleError(on: webView)
            }
        }
        return webView
    }

    private static let offlineRules = """
    [{"trigger": {"url-filter": "^https?:"}, "action": {"type": "block"}},
     {"trigger": {"url-filter": "^wss?:"}, "action": {"type": "block"}},
     {"trigger": {"url-filter": "^ftp:"}, "action": {"type": "block"}}]
    """

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

    /// Hands the pages Apple's own icons (SF Symbols) as CSS variables, e.g. `--ios-icon-folder`,
    /// so buttons in the app look native while the website keeps its own drawings.
    private static func addSystemIconsUserScript(to contentController: WKUserContentController) {
        let symbols = ["folder": "folder", "edit": "paintbrush.pointed", "share": "square.and.arrow.up", "play": "play"]
        let config = UIImage.SymbolConfiguration(pointSize: 22, weight: .regular)
        var source = ""
        for (name, symbol) in symbols {
            guard let image = UIImage(systemName: symbol, withConfiguration: config) else { continue }
            let format = UIGraphicsImageRendererFormat()
            format.scale = 3
            let png = UIGraphicsImageRenderer(size: image.size, format: format).pngData { _ in
                image.withTintColor(.black, renderingMode: .alwaysOriginal).draw(at: .zero)
            }
            source += "document.documentElement.style.setProperty('--ios-icon-\(name)', "
                + "'url(data:image/png;base64,\(png.base64EncodedString()))');"
        }
        contentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
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

        /// Only bundled pages may be navigated to; links to the outside world do nothing.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            let scheme = navigationAction.request.url?.scheme?.lowercased()
            decisionHandler(scheme == "file" || scheme == "about" ? .allow : .cancel)
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
            if message.name == "flickIncoming" {
                IncomingGame.shared.deliver()
                return
            }
            if message.name == "flickImport" {
                let types: [UTType] = [UTType(exportedAs: "org.flickgame.game"), .html, .json, .plainText]
                let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
                picker.delegate = self
                topViewController()?.present(picker, animated: true)
                return
            }
            if message.name == "flickSupporter" {
                let restoring = message.body as? String == "restore"
                Task { restoring ? await Supporter.shared.restore() : await Supporter.shared.buy() }
                return
            }
            guard message.name == "flickExport" else { return }
            guard let body = message.body as? [String: Any],
                  let b64 = body["dataBase64"] as? String,
                  let filename = body["filename"] as? String,
                  let data = Data(base64Encoded: b64)
            else {
                return
            }
            let safeName = (filename as NSString).lastPathComponent
            // A unique folder rather than a unique filename, so the shared file keeps its real name.
            let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            let tempURL = tempDir.appendingPathComponent(safeName)
            do {
                try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
                try data.write(to: tempURL)
            } catch {
                return
            }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard let vc = self.topViewController() else { return }
                let av = UIActivityViewController(activityItems: [tempURL], applicationActivities: nil)
                av.completionWithItemsHandler = { _, _, _, _ in
                    try? FileManager.default.removeItem(at: tempDir)
                }
                if let pop = av.popoverPresentationController, let anchor = self.shareAnchorWebView {
                    pop.sourceView = anchor
                    pop.sourceRect = CGRect(x: anchor.bounds.midX, y: anchor.bounds.midY, width: 1, height: 1)
                    pop.permittedArrowDirections = []
                }
                vc.present(av, animated: true)
            }
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            Supporter.shared.show()
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first, let data = try? Data(contentsOf: url) else { return }
            IncomingGame.shared.importIntoGallery(name: url.lastPathComponent, data: data, thenOpen: "play.html")
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
