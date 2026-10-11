import XCTest
import CryptoKit
@testable import RecoveryCore

final class RecoveryStoreTests: XCTestCase {
    func snapshot(_ revision: Int, label: String = "Synthetic 🍖") throws -> Data {
        let body: [String: Any] = ["version": 1, "revision": revision, "createdAt": "2026-10-11T00:00:00Z", "state": ["records": [["id": "synthetic", "food": label]], "relationalArchives": []]]
        let payload = String(data: try JSONSerialization.data(withJSONObject: body), encoding: .utf8)!
        let hash = SHA256.hash(data: Data(payload.utf8)).map { String(format: "%02x", $0) }.joined()
        return try JSONSerialization.data(withJSONObject: ["format": "ldcooklog-recovery", "version": 1, "payload": payload, "sha256": hash])
    }
    func directory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }
    func testEverySaveHasIndependentSnapshotAndSurvivesReopen() throws {
        let root = try directory(), store = try RecoveryStore(root: root)
        XCTAssertNil(try store.read())
        try store.commit(snapshot(1), expectedRevision: 0)
        let second = try snapshot(2)
        try store.commit(second, expectedRevision: 1)
        XCTAssertEqual(try store.files().count, 2)
        let reopened = try RecoveryStore(root: root)
        XCTAssertEqual(try reopened.read(), second)
        XCTAssertEqual(reopened.deviceID, store.deviceID)
    }
    func testStaleAndInvalidSavesLeaveHistoryUntouched() throws {
        let store = try RecoveryStore(root: directory())
        let first = try snapshot(1)
        try store.commit(first, expectedRevision: 0)
        XCTAssertThrowsError(try store.commit(snapshot(2), expectedRevision: 0))
        XCTAssertThrowsError(try store.commit(snapshot(4), expectedRevision: 1))
        XCTAssertEqual(try store.read(), first)
        XCTAssertEqual(try store.files().count, 1)
    }
    func testCorruptPrimaryStopsInsteadOfResettingAndCanBeRepaired() throws {
        let root = try directory(), store = try RecoveryStore(root: root)
        let first = try snapshot(1)
        try store.commit(first, expectedRevision: 0)
        try Data("broken".utf8).write(to: root.appendingPathComponent("current.recovery.json"))
        XCTAssertThrowsError(try store.read())
        try store.repair(first)
        XCTAssertEqual(try store.read(), first)
        XCTAssertEqual(try store.files().count, 2)
    }
    func testMissingPrimaryCannotEraseExistingSnapshots() throws {
        let root = try directory(), store = try RecoveryStore(root: root)
        try store.commit(snapshot(1), expectedRevision: 0)
        try FileManager.default.removeItem(at: root.appendingPathComponent("current.recovery.json"))
        XCTAssertThrowsError(try store.commit(snapshot(1), expectedRevision: 0))
    }
    func testFreshDeviceRestoresExactBytesAndDamagedFileIsRefused() throws {
        let first = try snapshot(1)
        let store = try RecoveryStore(root: directory())
        try store.repair(first)
        XCTAssertEqual(try store.read(), first)
        XCTAssertThrowsError(try store.repair(Data("{}".utf8)))
        XCTAssertEqual(try store.read(), first)
    }
}
