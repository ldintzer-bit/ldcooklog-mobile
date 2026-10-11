import XCTest

final class JournalUITests: XCTestCase {
    func testBundledUIWritesThroughNativeBridgeAndSurvivesRelaunch() {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        let food = web.textFields.firstMatch
        XCTAssertTrue(food.waitForExistence(timeout: 20))
        food.tap()
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
