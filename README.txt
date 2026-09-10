LDCookLog Mobile V1.6.0

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
- Event exports include smoker, target, phase, meat/cut, weight, setup context, and Cook ID.
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
- Cached files allow the installed/site app to launch when the network is unavailable after the cache has been populated.
- Visible build marker: 2026-09-10B.

V1.5.0
- Adds guarded local-storage loading and saving.
- Adds short action locks to state-changing controls to prevent rapid double taps from creating contradictory or duplicate actions.
- Keeps the same local-storage key so existing cook data remains compatible.
- Visible build marker: 2026-09-10C.

V1.6.0 — STAGE 2 COOK ID
- Adds an automatic Cook ID when Meat On starts a new cook.
- Cook ID format is YYYYMMDD-001, YYYYMMDD-002, etc.
- The date portion uses the local date the cook started.
- A separate local counter record tracks the highest sequence used for each date.
- Reset Cook does not erase or reset the daily sequence counter, so an old Cook ID is not intentionally reused.
- Cook ID remains attached to the cook after close/reopen, Rest, Keep Warm, Finish, and offline use.
- Every new event stores the Cook ID.
- If a legacy active cook from an earlier version has no Cook ID, the next relevant action can assign one and backfill existing events in that current cook.
- Current State displays the Cook ID.
- Copy Log includes the Cook ID.
- CSV export adds a cook_id column and uses the Cook ID in the filename when available.
- Cook ID allocation works entirely from local storage and does not require internet access.
- If the Cook ID counter cannot be safely read or saved, the app refuses to start a new cook rather than risk assigning a duplicate ID.
- Existing Stage 1 save/load protection and double-tap protection remain in place.
- Offline cache version advanced to ldcooklog-v1-6-0.
- Visible build marker: 2026-09-10D.

V1.6.0 STAGE 2 ACCEPTANCE TEST
1. Load V1.6.0 online and confirm Build 2026-09-10D.
2. Reset the current test cook. Confirm Cook ID shows Not assigned.
3. Press Meat On. Confirm a Cook ID appears in YYYYMMDD-NNN format.
4. Record Spritz, Wrap, and Rest. Close and reopen LDCookLog. Confirm the same Cook ID remains.
5. Finish the cook. Close and reopen. Confirm the same Cook ID remains with the finished cook.
6. Use Copy Log and confirm the Cook ID appears at the top.
7. Export CSV and confirm a cook_id column is present and rows carry the current Cook ID.
8. Reset the finished cook. Confirm Cook ID returns to Not assigned.
9. Press Meat On again on the same date. Confirm the new Cook ID sequence is higher and the previous ID is not reused.
10. Repeat a new-cook start while offline. Confirm Cook ID is created and survives close/reopen without internet.

DEPLOYMENT
- index.html, README.txt, and service-worker.js were updated directly in the GitHub repository for V1.6.0.
- manifest.webmanifest and both icon files remain unchanged.
