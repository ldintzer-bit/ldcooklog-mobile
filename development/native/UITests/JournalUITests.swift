import XCTest

final class JournalUITests: XCTestCase {
    func testBundledUIWritesThroughNativeBridgeAndSurvivesRelaunch() {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        let ready = web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Journal ready")).firstMatch
        XCTAssertTrue(ready.waitForExistence(timeout: 20))
        let food = web.textFields["Food / cut"]
        XCTAssertTrue(food.waitForExistence(timeout: 20))
        for _ in 0..<3 where !food.isHittable { app.swipeUp() }
        food.tap()
        // WebKit may scroll an off-screen field on the first tap without
        // focusing it. Require keyboard focus before sending any text.
        if !app.keyboards.firstMatch.waitForExistence(timeout: 5) {
            food.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        food.typeText("Synthetic simulator ribs")
        let entered = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "Synthetic simulator ribs"), object: food)
        guard XCTWaiter.wait(for: [entered], timeout: 20) == .completed else {
            XCTFail("Typed cook name did not remain in the field: \(web.debugDescription)")
            return
        }
        let protectedDraft = web.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "Drafts saved on this phone")).firstMatch
        guard protectedDraft.waitForExistence(timeout: 30) else {
            XCTFail("Native private draft was not acknowledged: \(web.debugDescription)")
            return
        }
        let create = web.buttons["Create cook"]
        if !create.isHittable { app.swipeUp() }
        create.tap()
        let history = web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Synthetic simulator ribs")).firstMatch
        guard history.waitForExistence(timeout: 30) else {
            XCTFail("Cook creation did not appear after a protected draft: \(web.debugDescription)")
            return
        }
        app.terminate()
        app.launch()
        let reopened = app.webViews.firstMatch
        XCTAssertTrue(reopened.waitForExistence(timeout: 20))
        XCTAssertTrue(reopened.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Journal ready")).firstMatch.waitForExistence(timeout: 20))
        // aria-pressed navigation can be exposed as a toggle rather than a
        // Button by iOS WebKit. Select the named accessible control by label.
        let historyTab = reopened.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "History")).firstMatch
        guard historyTab.waitForExistence(timeout: 20) else {
            XCTFail("History navigation missing: \(reopened.debugDescription)")
            return
        }
        historyTab.tap()
        XCTAssertTrue(app.webViews.staticTexts["Synthetic simulator ribs"].firstMatch.waitForExistence(timeout: 20))
    }
}
