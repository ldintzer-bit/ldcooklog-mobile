// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "LDCookLogRecovery", platforms: [.macOS(.v13), .iOS(.v16)], products: [.library(name: "RecoveryCore", targets: ["RecoveryCore"])], targets: [.target(name: "RecoveryCore"), .testTarget(name: "RecoveryCoreTests", dependencies: ["RecoveryCore"])])
