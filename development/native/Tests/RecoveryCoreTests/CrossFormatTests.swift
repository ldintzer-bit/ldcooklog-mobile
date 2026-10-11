import XCTest
@testable import RecoveryCore

final class CrossFormatTests: XCTestCase {
    func node(_ mode: String? = nil, input: Data? = nil) throws -> Data {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let process = Process(), output = Pipe(), errors = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", "tests/cross-format.mjs"] + (mode.map { [$0] } ?? [])
        process.currentDirectoryURL = root
        process.standardOutput = output; process.standardError = errors
        let pipe = Pipe(); process.standardInput = pipe
        try process.run()
        if let input { pipe.fileHandleForWriting.write(input) }
        try pipe.fileHandleForWriting.close()
        let bytes = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        XCTAssertEqual(process.terminationStatus, 0, String(data: errors.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "Node failed")
        return bytes
    }
    func testJavaScriptEnvelopeSurvivesNativeSaveAndJavaScriptRestore() throws {
        let data = try node()
        XCTAssertEqual(try Snapshot(data).revision, 1)
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try RecoveryStore(root: root)
        try store.commit(data, expectedRevision: 0)
        XCTAssertEqual(try store.read(), data)
        XCTAssertEqual(String(data: try node("verify", input: store.read()), encoding: .utf8), "verified")
    }
}
