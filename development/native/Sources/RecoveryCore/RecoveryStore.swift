import Foundation
import CryptoKit

public enum RecoveryError: Error, LocalizedError {
    case damaged, stale, invalidRevision
    public var errorDescription: String? {
        switch self {
        case .damaged: return "Damaged recovery file. Keep it and choose another snapshot."
        case .stale: return "A newer save exists. Reload before trying again."
        case .invalidRevision: return "Invalid recovery revision."
        }
    }
}
public struct Snapshot {
    public let revision: Int
    public let bytes: Data
    public init(_ bytes: Data) throws {
        guard bytes.count <= 100 * 1024 * 1024,
              let outer = try JSONSerialization.jsonObject(with: bytes) as? [String: Any],
              outer["format"] as? String == "ldcooklog-recovery",
              outer["version"] as? Int == 1,
              let payload = outer["payload"] as? String,
              let checksum = outer["sha256"] as? String,
              checksum == SHA256.hash(data: Data(payload.utf8)).map({ String(format: "%02x", $0) }).joined(),
              let body = try JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any],
              body["version"] as? Int == 1,
              let revision = body["revision"] as? Int, revision > 0, revision < 9_007_199_254_740_991,
              let state = body["state"] as? [String: Any],
              let records = state["records"] as? [[String: Any]],
              state["relationalArchives"] is [Any] else { throw RecoveryError.damaged }
        let ids = records.compactMap { $0["id"] as? String }
        guard ids.count == records.count, Set(ids).count == ids.count, ids.allSatisfy({ !$0.isEmpty }) else { throw RecoveryError.damaged }
        self.revision = revision
        self.bytes = bytes
    }
}

/// All I/O is called on one serial bridge queue. No cloud operation is required
/// to complete a cook save. A failed primary write leaves a recovery snapshot.
public final class RecoveryStore {
    public let root: URL
    public let snapshots: URL
    public let deviceID: String
    private let manager = FileManager.default
    public init(root: URL) throws {
        self.root = root
        snapshots = root.appendingPathComponent("Snapshots", isDirectory: true)
        try manager.createDirectory(at: snapshots, withIntermediateDirectories: true)
        let identity = root.appendingPathComponent("device-id")
        if manager.fileExists(atPath: identity.path) {
            deviceID = try String(contentsOf: identity, encoding: .utf8)
            guard UUID(uuidString: deviceID) != nil else { throw RecoveryError.damaged }
        } else {
            deviceID = UUID().uuidString
            try Data(deviceID.utf8).write(to: identity, options: .atomic)
        }
    }
    public func read() throws -> Data? {
        let current = root.appendingPathComponent("current.recovery.json")
        guard manager.fileExists(atPath: current.path) else {
            // Never quietly initialize over history if the primary is missing.
            if !(try files()).isEmpty { throw RecoveryError.damaged }
            return nil
        }
        return try Snapshot(Data(contentsOf: current)).bytes
    }
    public func commit(_ data: Data, expectedRevision: Int) throws {
        let snapshot = try Snapshot(data)
        let existing = try read().map { try Snapshot($0).revision } ?? 0
        guard existing == expectedRevision else { throw RecoveryError.stale }
        guard snapshot.revision == existing + 1 else { throw RecoveryError.invalidRevision }
        let url = snapshots.appendingPathComponent("r\(snapshot.revision)-\(UUID().uuidString).recovery.json")
        try protectedWrite(data, to: url)
        // Verify the independent copy before changing the current document.
        guard try Snapshot(Data(contentsOf: url)).bytes == data else { throw RecoveryError.damaged }
        try protectedWrite(data, to: root.appendingPathComponent("current.recovery.json"))
    }
    /// Explicit restore may repair a damaged primary. Previous snapshots remain.
    public func repair(_ data: Data) throws {
        _ = try Snapshot(data)
        let url = snapshots.appendingPathComponent("restored-\(UUID().uuidString).recovery.json")
        try protectedWrite(data, to: url)
        try protectedWrite(data, to: root.appendingPathComponent("current.recovery.json"))
    }
    public func files() throws -> [URL] {
        try manager.contentsOfDirectory(at: snapshots, includingPropertiesForKeys: [.contentModificationDateKey]).filter { $0.lastPathComponent.hasSuffix(".recovery.json") }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }
    private func protectedWrite(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: .atomic)
        #if os(iOS)
        try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
        #endif
    }
}
