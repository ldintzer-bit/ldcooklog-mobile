LDCookLog Mobile V1.5.0

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
- Existing cook data continues to use the same local-storage key and is not intentionally migrated or erased.
- Visible build marker: 2026-09-10B.

V1.5.0
- Adds guarded local-storage loading and saving.
- If stored cook data cannot be parsed or fails validation, LDCookLog shows a STORAGE WARNING instead of silently replacing the stored data.
- Automatic saving and Reset Cook are blocked after an unsafe load so the original stored value is not overwritten from that page session.
- If a save operation fails, the header changes to SAVE FAILED and the app warns that the latest change may not survive reopening.
- Adds short action locks to state-changing controls to prevent rapid double taps from creating contradictory or duplicate actions.
- Protects Meat, Lid, Wrap, Target Change, Keep Warm, Rest, Serve, Spritz, Note, Finish, and Reset actions.
- Keeps the same local-storage key so existing v1.4.0 cook data remains compatible.
- Offline cache version advanced to ldcooklog-v1-5-0.
- Visible build marker: 2026-09-10C.

V1.5.0 RELIABILITY ACCEPTANCE TEST
1. Load V1.5.0 online and confirm Build 2026-09-10C.
2. Reset the test cook and press Meat On rapidly several times. Confirm only one Meat On event is created and the cook remains Cooking.
3. Press Start Rest rapidly several times. Confirm only one Rest Start event is created and the Rest timer continues normally.
4. End Rest normally, then press Start Keep Warm rapidly several times. Confirm only one Keep Warm Start event is created, Phase remains Keep Warm, and target remains 165°F.
5. Finish the cook and confirm Cook Finished appears once and the elapsed timer freezes.
6. Close and reopen LDCookLog. Confirm the finished cook remains intact.
7. Repeat a short cook while offline and verify the v1.4.0 offline behavior still works.
8. Normal users should continue to see Saved locally in the header. STORAGE WARNING and SAVE FAILED are failure-only messages and are not expected during ordinary testing.

DEPLOYMENT
- index.html, README.txt, and service-worker.js were updated directly in the GitHub repository for V1.5.0.
- manifest.webmanifest and both icon files remain unchanged.
