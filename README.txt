LDCookLog Mobile V1.3.0

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
- V1.3.0 stores data locally in the browser on that device.
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

DEPLOYMENT
- index.html and README.txt were updated directly in the GitHub repository for V1.3.0.
- manifest.webmanifest and both icon files remain unchanged.
- Refresh the GitHub Pages site on Mac and iPhone/iPad before testing.
