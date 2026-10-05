import StoreKit
import WebKit

/// The once-off supporter purchase. The web pages show it as the smiley beside the gallery title.
@MainActor
final class Supporter {
    static let shared = Supporter()
    private static let productID = "com.increpare.Flickgame.supporter"
    private static let cacheKey = "supporter"

    weak var webView: WKWebView?
    private var updates: Task<Void, Never>?

    /// Cached so the smiley is right on the first frame, before StoreKit answers.
    private var isSupporter: Bool { UserDefaults.standard.bool(forKey: Self.cacheKey) }

    func start() {
        updates = Task {
            for await _ in Transaction.updates { await refresh() }
        }
        Task { await refresh() }
    }

    func buy() async {
        guard !isSupporter else { return }
        do {
            guard let product = try await Product.products(for: [Self.productID]).first else {
                return sayUnreachable()
            }
            // Cancelling or a pending Ask to Buy comes back as a result, not an error: stay quiet.
            if case .success(.verified(let transaction)) = try await product.purchase() {
                await transaction.finish()
                await refresh()
            }
        } catch {
            sayUnreachable()
        }
    }

    func restore() async {
        do {
            try await AppStore.sync()
        } catch StoreKitError.userCancelled {
        } catch {
            sayUnreachable()
        }
        await refresh()
    }

    private func sayUnreachable() {
        webView?.evaluateJavaScript("alert((window.FlickT || String)(\"Couldn't reach the App Store.\"));", completionHandler: nil)
    }

    private func refresh() async {
        var owned = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == Self.productID,
               transaction.revocationDate == nil {
                owned = true
            }
        }
        UserDefaults.standard.set(owned, forKey: Self.cacheKey)
        show()
    }

    /// Tells the current page whether to draw the smiley lit.
    func show() {
        webView?.evaluateJavaScript(
            "document.documentElement.setAttribute('data-supporter', '\(isSupporter)');",
            completionHandler: nil
        )
    }
}
