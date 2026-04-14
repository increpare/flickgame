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
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black

        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            let dir = url.deletingLastPathComponent()
            webView.loadFileURL(url, allowingReadAccessTo: dir)
        } else {
            context.coordinator.loadMissingBundleError(on: webView)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
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
