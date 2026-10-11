import XCTest
@testable import RecoveryCore

final class CloudBackupTests: XCTestCase {
    func testOfflineSavesQueueThenUploadsAreConfirmedAndRemainImmutable() throws {
        let helper = RecoveryStoreTests()
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try RecoveryStore(root: root.appendingPathComponent("local"))
        try store.commit(helper.snapshot(1), expectedRevision: 0)
        let offline = CloudBackups(store: store, rootProvider: { nil })
        XCTAssertEqual(try offline.retry()["pending"] as? Int, 1)
        XCTAssertEqual(try offline.retry()["uploaded"] as? Int, 0)
        let cloud = root.appendingPathComponent("remote")
        var uploaded = false
        let backups = CloudBackups(store: store, rootProvider: { cloud }, uploadCheck: { _ in uploaded })
        XCTAssertEqual(try backups.retry()["pending"] as? Int, 1)
        uploaded = true
        XCTAssertEqual(try backups.retry()["uploaded"] as? Int, 1)
        try store.commit(helper.snapshot(2), expectedRevision: 1)
        XCTAssertEqual(try backups.retry()["uploaded"] as? Int, 2)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(at: cloud.appendingPathComponent(store.deviceID), includingPropertiesForKeys: nil).count, 2)
        let choices = try backups.list()
        XCTAssertEqual(choices.count, 4)
        let token = choices.first { $0["label"]?.hasPrefix("iCloud") == true }!["token"]!
        let retrieved = try backups.read(token: token)
        let clean = try RecoveryStore(root: root.appendingPathComponent("clean-device"))
        try clean.repair(Data(retrieved.utf8))
        XCTAssertEqual(try clean.read(), Data(retrieved.utf8))
        XCTAssertThrowsError(try backups.read(token: "../../current.recovery.json"))
    }
    func testCorruptOldSnapshotDoesNotPreventNewBackupAndTamperedRemoteDoesNotCount() throws {
        let helper = RecoveryStoreTests()
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try RecoveryStore(root: root.appendingPathComponent("local"))
        try store.commit(helper.snapshot(1), expectedRevision: 0)
        let old = try store.files().first!
        try Data("broken".utf8).write(to: old)
        try store.commit(helper.snapshot(2), expectedRevision: 1)
        let cloud = root.appendingPathComponent("remote")
        let backups = CloudBackups(store: store, rootProvider: { cloud }, uploadCheck: { _ in true })
        let result = try backups.retry()
        XCTAssertEqual(result["uploaded"] as? Int, 1)
        XCTAssertEqual(result["failed"] as? Int, 1)
        let target = try FileManager.default.contentsOfDirectory(at: cloud.appendingPathComponent(store.deviceID), includingPropertiesForKeys: nil).first!
        try helper.snapshot(1, label: "Different synthetic copy").write(to: target)
        let damaged = try backups.retry()
        XCTAssertEqual(damaged["uploaded"] as? Int, 0)
        XCTAssertEqual(damaged["failed"] as? Int, 2)
    }
}
