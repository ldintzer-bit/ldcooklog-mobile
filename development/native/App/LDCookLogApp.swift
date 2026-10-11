import SwiftUI
import WebKit
import RecoveryCore

@main
struct LDCookLogApp: App {
    var body: some Scene { WindowGroup { CookingView().ignoresSafeArea(.container, edges: .bottom) } }
}
struct CookingView: UIViewRepresentable {
    func makeCoordinator() -> Bridge { Bridge() }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "recovery")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        let folder = Bundle.main.url(forResource: "Web", withExtension: nil)!
        context.coordinator.allowedRoot = folder.standardizedFileURL.path + "/"
        view.loadFileURL(folder.appendingPathComponent("index.html"), allowingReadAccessTo: folder)
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
final class Bridge: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
    var allowedRoot = ""
    private let queue = DispatchQueue(label: "LDCookLog.Recovery")
    private var store: RecoveryStore?
    private var cloud: CloudBackups?
    private func initialize() throws -> RecoveryStore {
        if let store { return store }
        let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("LDCookLog", isDirectory: true)
        let created = try RecoveryStore(root: root)
        store = created
        cloud = CloudBackups(store: created)
        return created
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, url.isFileURL, url.standardizedFileURL.path.hasPrefix(allowedRoot), let body = message.body as? [String: Any], let operation = body["operation"] as? String else { replyHandler(nil, "Untrusted request"); return }
        queue.async {
            do {
                let store = try self.initialize()
                let result: Any
                switch operation {
                case "read": result = try store.read().flatMap { String(data: $0, encoding: .utf8) } as Any? ?? NSNull()
                case "commit":
                    guard let text = body["text"] as? String, let revision = body["expectedRevision"] as? Int else { throw RecoveryError.damaged }
                    try store.commit(Data(text.utf8), expectedRevision: revision)
                    result = true // cloud is retried separately; upload cannot fail a local save
                case "repair":
                    guard let text = body["text"] as? String else { throw RecoveryError.damaged }
                    try store.repair(Data(text.utf8)); result = true
                case "backupStatus": result = try self.cloud!.retry()
                case "listSnapshots": result = try self.cloud!.list()
                case "readSnapshot":
                    guard let token = body["token"] as? String else { throw RecoveryError.damaged }
                    result = try self.cloud!.read(token: token)
                default: throw RecoveryError.damaged
                }
                DispatchQueue.main.async { replyHandler(result, nil) }
            } catch {
                DispatchQueue.main.async { replyHandler(nil, error.localizedDescription) }
            }
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        decisionHandler(url?.isFileURL == true && url!.standardizedFileURL.path.hasPrefix(allowedRoot) ? .allow : .cancel)
    }
}
