import SwiftUI

@main
struct FlickgameShellApp: App {
    var body: some Scene {
        WindowGroup {
            FlickWebViewRepresentable()
                .ignoresSafeArea()
        }
    }
}
