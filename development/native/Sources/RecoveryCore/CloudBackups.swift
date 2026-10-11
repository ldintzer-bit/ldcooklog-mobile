import Foundation

/// Immutable files, namespaced per installation. This is backup, not a shared
/// mutable cloud database; a second device must explicitly restore a snapshot.
public final class CloudBackups {
    private let manager = FileManager.default
    private let store: RecoveryStore
    private let rootProvider: () -> URL?
    private let uploadCheck: (URL) throws -> Bool
    public init(store: RecoveryStore, rootProvider: @escaping () -> URL? = {
        FileManager.default.url(forUbiquityContainerIdentifier: nil)?.appendingPathComponent("Documents/Recovery", isDirectory: true)
    }, uploadCheck: @escaping (URL) throws -> Bool = { url in
        let values = try url.resourceValues(forKeys: [.ubiquitousItemIsUploadedKey, .ubiquitousItemUploadingErrorKey])
        if let error = values.ubiquitousItemUploadingError { throw error }
        return values.ubiquitousItemIsUploaded == true
    }) { self.store = store; self.rootProvider = rootProvider; self.uploadCheck = uploadCheck }
    private func cloudRoot() -> URL? { rootProvider() }
    public func retry() throws -> [String: Any] {
        let local = try store.files()
        guard let root = cloudRoot() else { return ["available": false, "local": local.count, "uploaded": 0, "pending": local.count, "message": "iCloud unavailable. Saves remain on this device; open Settings and check iCloud Drive."] }
        let folder = root.appendingPathComponent(store.deviceID, isDirectory: true)
        try manager.createDirectory(at: folder, withIntermediateDirectories: true)
        var uploaded = 0, failed = 0
        for url in local {
            do {
                let destination = folder.appendingPathComponent(url.lastPathComponent)
                if !manager.fileExists(atPath: destination.path) {
                    let data = try Snapshot(Data(contentsOf: url)).bytes
                    var coordinatorError: NSError?
                    var writeError: Error?
                    NSFileCoordinator().coordinate(writingItemAt: destination, options: [], error: &coordinatorError) { coordinated in
                        do { try data.write(to: coordinated, options: .atomic) } catch { writeError = error }
                    }
                    if let error = coordinatorError { throw error }
                    if let error = writeError { throw error }
                }
                if try uploadCheck(destination) {
                    // A previously existing cloud file must still match its local
                    // immutable source before it can count as recoverable.
                    let original = try Snapshot(Data(contentsOf: url)).bytes
                    var cloudData: Data?, readError: Error?, coordinatorError: NSError?
                    NSFileCoordinator().coordinate(readingItemAt: destination, options: [], error: &coordinatorError) { coordinated in
                        do { cloudData = try Snapshot(Data(contentsOf: coordinated)).bytes } catch { readError = error }
                    }
                    if let error = coordinatorError { throw error }
                    if let error = readError { throw error }
                    guard cloudData == original else { throw RecoveryError.damaged }
                    uploaded += 1
                }
            } catch { failed += 1 } // One bad old file cannot block newer backups.
        }
        let message = failed > 0 ? "Some snapshots could not be verified or uploaded. Keep the local copies and investigate; other backups continue." : uploaded == local.count && !local.isEmpty ? "iCloud reports all recovery snapshots uploaded. Recovery on a second device still needs testing." : "Saved locally. iCloud upload is pending; the app retries while open and when reopened."
        return ["available": true, "local": local.count, "uploaded": uploaded, "pending": local.count - uploaded, "failed": failed, "message": message]
    }
    // Tokens are produced from enumerated URLs, never arbitrary paths from JS.
    private var choices: [String: URL] = [:]
    public func list() throws -> [[String: String]] {
        choices = [:]
        var result: [[String: String]] = []
        func add(_ url: URL, _ source: String) {
            let token = UUID().uuidString
            choices[token] = url
            let date = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
            let label = date.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .short) } ?? "Snapshot date unavailable"
            result.append(["token": token, "label": "\(source): \(label)"])
        }
        for url in try store.files() { add(url, "This device") }
        if let root = cloudRoot(), let enumerator = manager.enumerator(at: root, includingPropertiesForKeys: nil) {
            for case let url as URL in enumerator where url.lastPathComponent.hasSuffix(".recovery.json") { add(url, "iCloud") }
        }
        return result
    }
    public func read(token: String) throws -> String {
        guard let url = choices[token] else { throw RecoveryError.damaged }
        if (try? url.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem) == true {
            try manager.startDownloadingUbiquitousItem(at: url)
        }
        var data: Data?, readError: Error?, coordinatorError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinatorError) { coordinated in
            do { data = try Snapshot(Data(contentsOf: coordinated)).bytes } catch { readError = error }
        }
        if let error = coordinatorError { throw error }
        if let error = readError { throw error }
        guard let data, let text = String(data: data, encoding: .utf8) else { throw RecoveryError.damaged }
        return text
    }
}
