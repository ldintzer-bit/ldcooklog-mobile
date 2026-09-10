LDCookLog Mobile V1.4.0

BASE FEATURES FROM V1.2
- Stateful Meat On / Meat Off
- Stateful Lid Open / Lid Closed
- Stateful Wrap / Unwrap
- Change Target
- Keep Warm / Hold phase with start/end and duration
- Rest phase with start/end and duration
- Serve / Slice / Pull event
- Spritz event
- Smoker-specific setup

TRAEGER IRONWOOD 885
- Pellet flavor
- Smoke tube: None / Small 6" / Large 12"
- Super Smoke: Off / On

TRAEGER PRO
- Pellet flavor
- Smoke tube
- No Super Smoke control

WEBER 22" KETTLE
- Fuel: Briquettes / Lump Charcoal
- Wood form: None / Chips / Chunks
- Wood flavor
- No smoke tube
- No Super Smoke

DATA
- Cook state and event data are stored locally in the browser on that device.
- Event exports include smoker, target, phase, meat/cut, weight, and setup context.
- FireBoard live probe data is not connected yet.

V1.2.1 FIX
- Rest shows a live HH:MM:SS count-up timer immediately.
- Keep Warm timer updates every second.

V1.2.2 FIX
- Start Keep Warm is one tap.
- Keep Warm automatically changes the pit target to 165°F.
- Keep Warm immediately starts the live HH:MM:SS count-up timer.
- The event log records the prior target and the automatic change to 165°F.
- Change Target remains available during Keep Warm for later adjustments.

V1.3.0
- Adds a dedicated Finish Cook control.
- Finishing stores a permanent finish timestamp in local state.
- Main elapsed cook timer freezes at the finish timestamp.
- Phase changes to Finished.
- A Cook Finished event is recorded with total cook duration.
- Finish Cook asks for confirmation and cannot be performed twice.
- Starting a new state-changing action after Finish is blocked.
- Existing V1.2.2 browser data remains compatible by keeping the same local-storage key.
- Visible build marker: 2026-09-10A.

V1.4.0
- Adds service-worker.js for offline app caching.
- The app registers the service worker automatically after an online page load.
- The service worker caches index.html, manifest.webmanifest, icon-180.png, icon-512.png, and the site root.
- Cached files allow the installed/site app to launch when the network is unavailable after the cache has been populated.
- New versions use a versioned cache name so old app-shell caches can be removed during activation.
- Existing cook data continues to use the same local-storage key and is not intentionally migrated or erased.
- Visible build marker: 2026-09-10B.

V1.4.0 OFFLINE ACCEPTANCE TEST
1. Load V1.4.0 online at least once and confirm Build 2026-09-10B.
2. Leave the page open briefly so the service worker can install and cache the app shell.
3. Close the LDCookLog page/app.
4. Disconnect the test device from the internet or use Airplane Mode.
5. Reopen LDCookLog.
6. Confirm the app loads while offline.
7. Start a cook with Meat On and confirm the timer starts.
8. Record at least one event.
9. Close and reopen LDCookLog while still offline.
10. Confirm the active cook, timer, phase, and event remain intact.
11. Test Rest and Keep Warm while offline.
12. Finish Cook while offline and verify the elapsed timer freezes.
13. Reconnect to the internet and confirm the locally stored cook is unchanged.

DEPLOYMENT
- index.html, README.txt, and service-worker.js were updated directly in the GitHub repository for V1.4.0.
- manifest.webmanifest and both icon files remain unchanged.
