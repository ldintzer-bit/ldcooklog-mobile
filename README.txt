LDCookLog Mobile V1.2.2

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
- V1.2 stores data locally in the browser on that device.
- Event exports now include smoker, target, phase, meat/cut, weight, and setup context.
- FireBoard live probe data is not connected yet.

DEPLOYMENT
Replace the files in the existing GitHub Pages repository with the V1.2 files, then refresh the site on iPhone/iPad.


V1.2.1 FIX
- Rest shows a live HH:MM:SS count-up timer immediately.
- Keep Warm timer updates every second.


V1.2.2 FIX
- Start Keep Warm is now one tap.
- Keep Warm automatically changes the pit target to 165°F.
- Keep Warm immediately starts the live HH:MM:SS count-up timer.
- The event log records the prior target and the automatic change to 165°F.
- Change Target remains available during Keep Warm for later adjustments.


V1.2.2
- Start Keep Warm is one tap.
- Keep Warm changes target to 165°F automatically.
- Keep Warm starts a live HH:MM:SS timer immediately.
- Rest also has a live HH:MM:SS timer.
- Visible build marker: 2026-09-09B.
