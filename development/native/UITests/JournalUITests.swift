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
        let create = web.buttons["Create cook"]
        if !create.isHittable { app.swipeUp() }
        create.tap()
        let history = web.staticTexts["Synthetic simulator ribs"]
        if !history.isHittable { app.swipeUp() }
        XCTAssertTrue(history.waitForExistence(timeout: 20))
        app.terminate()
        app.launch()
        app.swipeUp()
        XCTAssertTrue(app.webViews.staticTexts["Synthetic simulator ribs"].firstMatch.waitForExistence(timeout: 20))
    }
}
