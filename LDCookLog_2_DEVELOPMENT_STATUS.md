## 2026-10-14 — Remembered navigation, adjacent cooks and recent history implemented

Owner accepted the smoother scrolling and requested all four proposed navigation
improvements. Scriptable now remembers per-cook scroll position and open named
panels, plus History/Backups position. Returning from a tab or another cook restores
that place. Relaunch resumes an unfinished real cook first; if none exists, it can
reopen the last viewed cook. Position and panels are private device preferences,
not cooking events, snapshots or migration content.

Previous / Next in the sticky cook context follow History's current search and
Show test cooks filter, ordered newest first. Previous moves toward newer cooks;
Next toward older. Boundaries and cooks outside the filter disable navigation.
The context shows cook name, phase and position in the filtered list. History adds
up to five active/recently viewed matches, preserving its ordinary complete list.
Recent test cooks are hidden when Show test cooks is off.

Preference documents store identifiers, pixel positions and panel identifiers only.
They are schema-validated, bounded to 32 KiB / 80 places / eight recent identifiers,
and written to three readback-verified local generations. Damaged latest metadata
can fall back; failed writes keep previous copies and never affect journal/drafts.
Working and restore-test preferences stay in separate namespaces. Scroll writes
are debounced and do not stage iCloud cooking backups or trigger history scans.
These convenience preferences are not promised as part of new-device recovery.

98 local JavaScript tests passed, including preference validation, local reopening,
corrupt metadata fallback, failed writes and namespace isolation. Added generated
Scriptable tests for offline position/panel reopening, draft preservation, sticky
identity, Previous/Next boundaries, filters, recent choices and byte-identical full
source history. Browser CI acceptance remains pending at this checkpoint.
Production remains unchanged; the guide must document newest-first order, filter
behavior and the distinction between remembered navigation and saved cook edits.

## 2026-10-14 — Further scrolling improvements after owner feedback

Owner reports scrolling improved, with more improvement desired. No claim that
native dismissal or all remaining pauses are resolved. Added Go to section near
the top of Scriptable's page and a floating Top button: jump directly to actions,
setup, FireBoard probes, targets, wrap, evaluation, comparison or New cook. Nested
panels open automatically; navigation preserves drafts and never saves a cook.
The Top control is hidden during confirmation and has footer clearance. These
controls are generated Scriptable-only changes, not native app changes.

Removed duplicate backup work without weakening validation: every staged snapshot
is still validated on each check, including filename/revision agreement. When all
21 copies are already covered by recent/first-copy protection, cleanup performs
no second full history validation. Storage byte counts are collected on the first
read and reused within that check, avoiding another full disk read and large
URI-encoded temporary strings. No cross-check validation cache is introduced.
Actual deletion candidates retain the existing full validation/readback gates.
The local storage advisory now explains that protected copies may remain over
128 MiB and should not be deleted manually.

95 local JavaScript tests passed. A new test proves 21 validated snapshots require
21 journal reads and 21 validations per backup check, preserve exact bytes, and
still flag later corruption while keeping all recovery points. Generated-launcher
browser tests now exercise section jumps, automatic nested panel opening, Top,
draft preservation and refusal to invent a cook when none is open.

Installable source `33bbc1c89d7bf68fae6279a1fe496a0ee97c2bfd`: GitHub run
`38565256396`, regression job `115856179942`, completed successfully. All three
browser suites, 95 JavaScript tests, Python checks, reproducible generation and
security checks passed. The generated-launcher suite exercised the new controls
and exact preservation of synthetic history. Native sources were not changed;
the preceding source's native job (`38562924047` / `115848266318`) also completed
successfully. This run's native job remains in progress at this checkpoint.

Guide steps: near the top choose Go to section, then a destination. The app opens
the required panels and moves there. Use Top ↑ at bottom right to return to the
section choices; it does not save or clear edits. Open a cook from History first
for cook-specific destinations. Physical iPhone smoothness remains to be assessed
after installation. Production has not been merged or deployed.

## 2026-10-14 — Scriptable scrolling and repeated backup scans improved

Owner reported scrolling sticking or dismissing the cooking interface. The exact
iPhone gesture has not been reproduced. Scriptable already requests fullscreen
presentation; this change adds one bounded page scroll surface with momentum
scrolling and overscroll containment, leaving confirmation overlays outside it.
Tab navigation resets that surface without smooth-scroll animation. The working
journal namespace, recovery files and backup retention rules are unchanged.

Scriptable no longer rescans all snapshots every 30 seconds while the owner is
using the screen. Full staging/validation remains at launch, foreground return,
after cooking saves and explicit Check / retry iCloud. The independent five-minute
Mac worker is unchanged. Displayed Mac evidence may age while the screen remains
open; use retry for a fresh report. Large snapshot sets make repeated page-based
validation a plausible contributor to pauses, not a proven cause of dismissal.

Added generated-launcher browser checks for long-form scrolling in both directions,
fixed document position, tab reset and exact preservation of journal bytes.
Installable source: `95a82d5cff6143b5b223569eb8c106af8b958880`. GitHub run
`38562924047` regression job `115848265749` passed: 94 JavaScript tests, 58 Python
passes with two Mac-only Linux skips, reproducible bundles, security checks and
all three browser suites. The generated Scriptable suite passed the new scroll
checks plus offline drafts, finish confirmation, recovery and full synthetic
30-cook / 18,000-reading history. The first test attempted to inspect a collapsed
create form; it was corrected to assert the actual bottom scroll boundary.

Native job `115848266318` passed Mac checks, native storage and both app builds;
the simulator integration test is still running at this documentation checkpoint.
Local browser downloads were unavailable, so browser acceptance came from CI.
Physical iPhone scrolling/keyboard/edge-drag confirmation remains required; the
browser harness simulates Scriptable host APIs and cannot prove native gesture
dismissal is resolved. Save current edits, close Scriptable, replace the usual
LDCookLog-2-Backup-Status.js script, reopen the usual shortcut, and scroll a long
setup panel down and up to its boundaries. Report any remaining sticking or
dismissal before resuming the finish/draft acceptance checks.

## 2026-10-14 — Owner backup warning identified as local storage advisory

Owner read the expanded Backup details: current revision 23 independently verified
on the Mac; 21 snapshots staged, zero staging failures; local snapshots about
164 MiB; Mac recovery storage 115 / 1024 MiB. The warning is the fixed 128 MiB
local advisory, not a reported backup failure. iCloud upload completion remains
unconfirmed; the exact-revision Mac receipt provides separate recovery evidence.

Current phone retention preserves the newest 20 snapshots plus the first and
source-archive recovery points. With 21 copies, zero eligible removals is consistent
with that policy. Keeping the Mac awake alone cannot reduce copies that the policy
requires retaining. The warning's cleanup wording should be improved to explain
this situation; a storage advisory should be distinguishable from backup failure.
No manual deletion or restoration is needed to address this report.

Owner also reported copying from the screen produced code. The cause is not
established; do not attribute it to user error or a particular iOS feature without
reproduction. Guide alternatives: read/type the paragraph or provide a screenshot
of expanded Backup details. A dedicated plain-text backup report copying control
is a remaining UI improvement. This report does not establish physical acceptance
of the new finish-cancel or draft-reopen safeguards.

## 2026-10-14 — User-guide instructions clarified after owner navigation feedback

The user guide must give the exact control names, the next tap, and the expected
result. Owner feedback showed that action selection and collapsed backup details
were easy to mistake for completed actions or missing information. These are the
instructions to include in the updated guide:

1. Open an unfinished cook. For a test cook, open History, enable Show test cooks,
   and open that cook.
2. To finish using the Action / note dropdown, choose Cook Finished, then tap
   Save action beneath the Note field. Choosing the dropdown item only selects
   the action; it does not finish the cook or open confirmation.
3. Alternatively, tap the gold Cook Finished action button to open confirmation
   directly. The confirmation is titled Confirm journal change and has Finish
   cook and Cancel buttons. Cancel keeps the cook open. Finish cook records the
   finish and stops its timer.
4. Setup edits require Save cook setup; evaluation edits require Save review.
   Wrap and target forms require Save wrap and Save targets respectively. State
   each form's Save button explicitly instead of saying only “select” or “enter.”
5. For unsaved edits, wait for “Drafts saved on this phone. Tap Save to include
   them in cooking backups.” before closing. Reopen the same cook to continue.
   Drafts are local to this phone; the appropriate Save button is still needed
   to include edits in cooking recovery backups.
6. To inspect backup protection, tap Backups, then tap Backup details under
   Recovery protection to expand it. Read or copy the paragraph that appears
   beneath Backup details. Check / retry iCloud requests another check. Restore
   or import data opens recovery tools and is not needed to read backup status.
7. Journal ready / Offline cooking pilot and Saved locally / backup needs
   attention are status banners. A finish confirmation has its own message and
   Finish cook / Cancel buttons. A backup warning needs the expanded Backup
   details paragraph to identify its cause.

The owner has acknowledged the action instructions and reported the collapsed
backup controls. The expanded protection message is still pending, so the latest
backup warning remains unresolved. The pasted installation command is not proof
of its execution or of a successful backup check. Physical iPhone acceptance of
the new finish-cancel and draft-reopen safeguards has not yet been explicitly
reported. Automated acceptance evidence remains recorded below.

Documentation was checked against the current UI markup, action handlers and
Scriptable confirmation labels. No application code or private data changed.

## 2026-10-13 — Finish confirmation and durable private drafts accepted by automated checks

Installable source `a6f5d49eb09bb230d8d804c8b45b1c4530226095` on the separate
`development/2.0-offline-recovery` branch. Production was not merged or deployed.

Both requested safeguards are implemented:

- Cook Finished requires explicit confirmation with Cancel initially focused.
  Entering a new finish time in setup also requires confirmation. Cancel preserves
  journal bytes, events, revision, snapshot count and unsaved notes. Accept saves
  one ordinary cooking snapshot. Native hosts now implement confirmation dialogs;
  Scriptable continues to use the tested visible in-page confirmation.
- Private draft fields survive closing/reopening offline: New cook, setup/probes/
  meat pieces/rub details, action notes, targets, wrap and evaluation. The UI
  acknowledges only completed, read-back-checked local writes. Drafts stay separate
  from the cooking journal, iCloud snapshots and independent Mac verification.
  Tap the appropriate Save button to commit edits and include them in backups.

Draft copies use checksums, bounded generations, namespace isolation and stale
saved-state checks. Successful form saves clear that draft while preserving other
forms. Untouched draft start/finish fields follow actual cooking transitions.
Failed writes preserve prior copies and report a warning; a damaged latest copy
can recover an older validated copy. Discard requires confirmation and keeps saved
cooking data. Empty acknowledged caches remove obsolete private draft copies.
Limits: 2 MiB per document, up to 200 forms/2,000 fields per form, three recent
copies (one when empty); failed cleanup stops further growth at ten copies.
Drafts are local to this device and are not replacement-phone recovery data.

[Actions run 38479270151](https://github.com/ldintzer-bit/ldcooklog-mobile/actions/runs/38479270151)
completed successfully in both jobs. Regression 115577568046 passed 94 JavaScript
tests, 58 Python passes with two Mac-only Linux skips, generated-source/security/
CSP checks and all three browser suites. Actual generated Scriptable tests passed
Finish Cancel/acceptance and setup/action/review draft reopening; full archived
history and all original synthetic readings stayed unchanged. Native-bridge browser
also verified New cook drafts, per-form clearing and unchanged snapshot counts.
Reviewed the updated synthetic phone layout.

Native job 115577568185 passed actual Mac recovery tests, nine Swift storage tests
including private-draft reopening without journal changes, both platform builds,
and actual iPhone WKWebView/native bridge creation and relaunch integration.

The first simulator run did not find a cook after typing and tapping Create.
Draft-status text changes could shift controls; the status area now reserves a
stable height. The simulator test verifies the entered text and waits for the
native draft acknowledgement before tapping Create, with detailed failure output.
The rerun passed; the cooking assertion was retained rather than waived.

Update the same working LDCookLog-2-Backup-Status.js filename and existing shortcut;
no source re-import or backup-worker change is needed. On an unfinished test cook,
cancel Cook Finished and verify it stays open. Type an unsaved note, wait for
Drafts saved on this phone, close and reopen that same cook from History; the note
should return. These physical checks of the two new safeguards remain owner work.
See [behavior and limits](development/native/DRAFT_AND_FINISH_SAFEGUARDS.md).

The next real cook and replacement-phone/reinstall recovery remain the pilot
acceptance checks. Keep the original verified archive and the old Supabase app
frozen. No new manual export of unchanged Supabase history is requested. Complete
updated user instructions can now describe the finished cooking-feature batch
and both safeguards.

## 2026-10-13 — Complete cooking setup parity and Traeger Pro 780

Installable source `020e6172bae2520c2dc568fe45778f33084e434b` on the separate
`development/2.0-offline-recovery` branch. No production merge/deployment.

Implemented the owner's approved remaining cooking-feature batch:

- Traeger Pro 780 in New cook's Cooker list and Equipment / fuel presets,
  alongside Ironwood 885 and Weber kettle options.
- Optional individual meat pieces: cut, package/cook weights and lb/kg/g/oz or
  unrecorded unit, bone status, brand/producer, store/source, grade, notes,
  dollar price and price per lb. Up to 32 entries; add/remove and edit independently.
- Saved locations and methods/recipes from preserved catalogs and non-test saved
  cooks. Editable location and recipe/reference fields; custom values remain valid.
- Named rub application details with Not recorded/Light/Normal/Heavy and notes,
  up to 64 entries. Add saved rub creates a matching detail entry when absent.
- Spritz records note/time without changing phase. Serve / Slice / Pull moves
  Cooking/Resting/Keeping Warm to Serving and ends that rest/hold interval;
  Cook Finished remains available. Duplicate serving transitions are rejected.

Original relational rows and archives remain immutable. Imported piece/rub values
populate the editors; successful Save cook setup stores a separate editable copy.
Empty edited arrays intentionally suppress fallback after removing all entries.
Zero remains zero, blank numeric values remain unknown, and missing historical
units stay Not recorded. New pieces default to lb without converting weights.
The existing general weight/pieces and rub text remain independent of their
structured detail lists. No automatic price calculation or total-weight rewrite.
Source recipe references are displayed/edited as text; no network fetch occurs.

[Actions run 38462597986](https://github.com/ldintzer-bit/ldcooklog-mobile/actions/runs/38462597986)
regression job 115521327986 passed: 87 JavaScript tests, 58 Python passes with two
Mac-only Linux skips, generated-source reproducibility, security/CSP and all three
browser suites. New pure tests cover legacy ordering/zero/unit conversion into
editable metadata without source mutation, bounded metadata validation before
writes, explicit clearing, exact fresh-journal recovery, recipe privacy boundaries,
Spritz/Serve/Finish and timer semantics. Browser tests cover Pro 780, two pieces,
remove/add, rub notes, in-session draft filtering, save and offline reopening.
The actual generated Scriptable fixture selects archived locations/recipes,
retains imported zero-weight kg pieces and rub notes, and preserves every archived
table and all 18,000 original synthetic readings. Synthetic mobile layout reviewed.
Host APIs in the Scriptable browser tests remain simulated.

The initial run failed because newly added synthetic relational cells used numeric
JSON values rather than the export's required string-or-null representation. The
fixture was corrected and validated/imported locally before the passing rerun;
archive validation was not relaxed. A separate review also preserved unrecorded
historical weight units instead of assigning lb to them.

Current native job 115521327918 passed actual Mac recovery/storage and both
platform compiles and was running iPhone WKWebView simulator integration at this
checkpoint. Previous run 38458820891 completed successfully in both jobs.

Install the reviewed source once as LDCookLog-2-Backup-Status.js; keep the existing
shortcut and working journal namespace. No re-import, backup-worker update or
repeat retention rehearsal is requested. New optional metadata uses the existing
immutable snapshots and independent Mac-copy process. See
[the feature behavior notes](development/native/COOKING_EVENTS_AND_LIBRARIES.md).

The approved cooking-feature batch is complete and ready to document in the full
user instructions. Remaining physical acceptance is the next real cook with a
current verified independent Mac copy, plus replacement-phone/reinstall recovery.
Direct completed-session retrieval on iPhone and catalog administration remain
later convenience enhancements; the existing private Mac export/import works.
Keep the original verified database archive and leave the old Supabase app frozen.
No new manual export of unchanged Supabase history is required for this update.

## 2026-10-13 — Reusable setup catalogs, lid events and wrap methods

Installable source: `1e55b652c9c34ec37efa1863d4c62ff7d42e5e1c` on
`development/2.0-offline-recovery`. Production main remains
`e0ba05f6043b15d79a9ac053002137366a1105c3`; nothing was merged or deployed.

Implemented Add saved equipment/rub/sauce choices using preserved source catalogs
and saved non-test cooks. Custom values remain editable; semicolon-separated
selections deduplicate without modifying any archived rows. Lid Open/Closed
alternate, reject duplicate writes and preserve phase. With no recorded lid event,
the interface says not recorded. Wrapped opens a method editor for Foil, Butcher
Paper, Foil Boat or Other with required description; Save wrap records the actual
method/note without changing the planned method. Existing historical Wrapped
notes are preserved without invented method metadata. Finished cooks are protected.

Actions run [38458820891](https://github.com/ldintzer-bit/ldcooklog-mobile/actions/runs/38458820891)
regression job 115508346511 passed: 82 JavaScript tests, 58 Python passes with two
Mac-only Linux skips, reproducible generated artifacts, security/CSP and all three
browser suites. New unit tests verify catalog privacy/non-mutation boundaries,
queued duplicate lid saves, invalid wrap rejection without writing and exact
fresh-journal recovery. Browser tests verify actual generated Scriptable catalog
selection, offline wrap/lid reopening, duplicate selection handling and unchanged
archived tables and all 18,000 original synthetic readings. Synthetic 390-pixel
layout reviewed. Host APIs are simulated in the Scriptable browser tests.

The prior timers/targets/links run 38441742800 completed successfully, including
actual native Mac recovery/storage tests, both platform compiles and iPhone
WKWebView simulator integration. Current native job 115508345946 was still running
at this checkpoint; its eventual outcome is not claimed here.

Use the same working filename LDCookLog-2-Backup-Status.js and existing Home Screen
shortcut; update the script once, then close/reopen after iCloud sync. No migration,
backup-worker change or repeat retention rehearsal is requested for this batch.
See [event and catalog behavior](development/native/COOKING_EVENTS_AND_LIBRARIES.md).

The agreed next step remains a controlled real cook and verification that its
current revision reaches an independent Mac copy. Replacement-phone/reinstall
recovery remains a separate physical check. Keep the original verified archive
and leave the old Supabase application frozen; unchanged Supabase history requires
no further routine manual exports. Do not delete Supabase or the original archive.
Earlier acceptance entries below are a chronology, not requests to repeat passed
checks. Further development can address structured meat-piece editing and catalog
administration without waiting for the real cook.

### Timers, targets and reading links verification checkpoint

Installable source cdc474c961c2e59ff4b1678b65e13c2d77c2573d (Scriptable runtime
identical to dc6a271a2d4f94996306410e50ac1a0eb393e8e6). Actions run 38441742800
regression passed: 79 JavaScript tests, 58 Python passes with two Mac-only Linux
skips, generated artifact/security/CSP checks and all three browser suites.
Actual generated Scriptable host accepted automatic active-real-cook reopening,
clock displays, numeric target history, mapped names in chart choices/legends,
and exact linked/target state after offline full-history reopening. All original
18,000 synthetic readings and pre-change recovery bytes remained identical.
Native-bridge browser accepted finished-clock stopping and Target Change note
transfer; only matching event drafts clear on successful numeric save. Other
unsaved drafts and failed-write rollback still pass. Reviewed the updated mobile
layout in a synthetic 390-pixel screenshot.

Full-history testing initially read before asynchronous cook rendering, then
queried a visible-label property while its comparison disclosure was collapsed.
The tests now wait for the validated target summary and open comparisons before
checking the visible label. Reading choices are built once per render and reused;
identity sets are constructed only for cooks with actual saved bindings. These
optimizations skip no required identity validation. Timer updates do not write
backups or redraw forms; cumulative phase totals reflect recorded transitions.
Historical unrecorded phase starts remain unknown.

Actual macOS recovery tests/native storage and both platform compiles passed;
iPhone simulator integration was still running at this checkpoint, so all native
checks are not claimed complete. Physical Scriptable acceptance requires this
single working-script update; no migration, backup-worker change or repeated
retention rehearsal is requested. Existing original archives and production are
unchanged. The next real cook remains the practical controlled-pilot gate.

## 2026-10-13 — Approved timers, targets and imported probe links

Added clock-derived total/current-phase/cumulative-rest/cumulative-hold displays.
They rebuild from saved times/events on reopening, stop at finishedAt or a known
Cook Finished event and report unknown durations instead of inventing missing
historical phase times. No timer ticks write snapshots or reload edit forms;
minute display changes avoid unnecessary DOM updates. Newly created unfinished
real cooks resume automatically; test cooks and migrated historical cooks are
not chosen automatically. Multiple active real cooks select the most recent.

Separate optional pit/meat targets use explicit Fahrenheit values. Save targets
records Target Change with before/after numeric snapshots and optional reason.
Preparation/cooking changes are allowed; finished cooks cannot change targets.
Blank clears a target; validation rejects non-finite/out-of-range values before
writes. Existing legacy target_temp displays as pit target where valid, without
writing or modifying preserved source rows. Generic Target Change action opens
the numeric editor instead of recording a numeric-free action in the UI.

Each setup entry now has Link to imported reading, with original session,
device and sensor labels/identifiers. Saving validates membership in the same
cook and rejects duplicate active assignments. Links use exact existing series
keys (session/device/channel/source-label); neither chart order, wired port nor
wireless color is used to guess identity. Configured names and wireless identifiers
appear in comparison selectors/legends. Source readings/raw charts/units/IDs and
original archives remain unchanged. Unlinked readings retain their original
labels. Mapping and target fields participate in drafts, immutable snapshots and
fresh restore. Use current working/restore scripts for the new optional fields.

Added pure tests for repeated phase timing, finished stopping/missing-time handling,
exact numeric before/after recovery, invalid/finished rollback and unambiguous
same-label devices, link restoration, duplicate/unavailable-link rollback and raw
reading preservation. Browser tests cover target UI/history, stopped timers,
automatic active-cook reopening, exact names in charts and target/link persistence
across offline reopening of full synthetic history. CI results follow. Production
is unchanged; no private cooking data or credentials were accessed or published.

### Expandable setup and wireless identifiers verification

Installable Scriptable source 54ae460bf2acf972e4ceffe976516eba8916276d;
Actions run 38436585389 regression passed: 76 JavaScript tests, 58 Python passes
with two Mac-only Linux skips, artifact/security/CSP checks and all three browser
suites. Explicit wired port and Orange Internal persisted offline and appeared
in Saved probe guide. Added seventh probe/custom identifier survived draft
filtering, save and reopen; removal changed only setup. Pure tests restored >6
entries with sparse IDs exactly, recovered pre-removal configuration, accepted
empty entries and rejected exceeding 32 without writes. Legacy wired type and
version-1 snapshots remain valid. Original imported readings remain unchanged.

Previous native run 38434367427 passed Mac maintenance/native storage/platform
compiles but failed its simulator relaunch assertion: aria-pressed History was
not exposed in the Button collection (the hierarchy listed backup/create buttons
but omitted toggle controls). Native harness now waits for reopened Journal ready
and selects the accessible History control by exact label across element kinds,
with a diagnostic hierarchy on failure. This fix needs native CI confirmation;
it changes no Scriptable sources or data handling. Final-source native simulator
was still running at this checkpoint. Do not claim all native checks passed.
Production is unchanged; all fixtures are synthetic, with no private history or
credentials published. Only the current working script needs updating for use;
use the current generated restore script when rehearsing version-2 setup recovery.

## 2026-10-13 — Owner requests expandable probe setup

Removed the fixed six-entry setup limit. Add probe and Remove entry support up
to 32 named reading entries per cook, with stable entry IDs, separate physical
wired ports, wireless preset/custom identifiers and Internal/External choices.
Version 2 accepts 0–32 unique entries; version 1 six-entry snapshots remain valid
and readable without writes. Editing/saving uses version 2. Add/remove and custom
color fields join the existing per-cook drafts and recovery commit. Removal
changes only saved setup upon Save cook setup, never imported readings or source
archives; earlier snapshots preserve prior configuration. Orange/Silver remain
preset identifiers and Other exposes a bounded custom color/name field.
Future compatible probes/identifiers require configuration rather than code;
new vendor export formats or live integrations remain separate development.
The 32-entry bound is an app safeguard, not a hardware capability statement.
Earlier six-entry notes below describe previous checkpoints.

Tests cover >6 entries, sparse IDs, exact fresh restoration, removal/recovery of
older configuration, empty setup, bound rejection, custom names and browser
add/remove seventh entry, draft filtering and offline reopening. CI follows.
Existing Mac backup policy and original archives are unchanged. Older scripts
cannot validate new version-2 setup: use the current generated working/restore
scripts for restoration; an outdated reader fails safely without resetting data.

## 2026-10-13 — Distinct probe role, connection and wireless identifiers

Owner accepted setup layout but identified redundant ambient/food probe types
and missing wireless/color support. Connection now offers Not recorded, Wired,
Wireless and Other; Role remains Not used, Pit / ambient, Meat and Other. Earlier
project context distinguishes physical Pulse Orange/Silver identifiers and
Internal/External measurements. Added Orange/Silver/Other wireless identifiers
and optional Internal / meat versus External / ambient reading; Wired exposes
an independent optional port 1–6. Numbered rows are probe-reading entries, not
assumed physical FireBoard ports. Two entries may record the same Pulse color
with different measurements; color is not treated as a permanent device UUID.
A saved probe guide in Cook lists configured roles, connections, ports,
colors/readings and placements, with text plus Orange/Silver color accents.

Existing saved Wired ambient/food values remain valid in recovery validation,
are displayed as Wired with their prior numbered port on load, and are changed
only upon explicit setup save. Original imports, permanent device/channel IDs,
reading labels/units, archives and chart-trace colors are unchanged. No automatic
binding or live telemetry/control was introduced. The known preference for a
wired pit probe is supported by explicit Pit / ambient versus Other reference
roles; no new pit calculations or inferred wireless pit selection were added.

Tests cover exact recovery of wired port, Orange Internal/External and Silver
Internal entries, rejected invalid port/color/measurement without writes,
backward-compatible old types, offline browser persistence, conditional fields
and a readable saved guide. Additional browser checks retain existing complete
history/restoration and unsaved drafts. Results follow. No private history or
credentials were accessed, and production remains unchanged.

### FireBoard setup verification checkpoint

Installable source 51bd6f04f3493fa78b49c45770ede11c979aa309; Actions run
38432013702 regression passed: 74 JavaScript tests, 58 Python passes with two
Mac-only Linux skips, artifact/security/CSP checks and all three browser suites.
FireBoard device/accessories and six channels persisted through unsaved history
filtering, save and offline reopening. Generated Scriptable host accepted event
saves preserving unsaved probe configuration. Pure tests accepted exact fresh
recovery, unchanged completed-session charts/readings/source rows, omitted-setup
preservation and rollback of checksum-valid invalid-channel restoration.
Actual macOS tests/native storage and iPhone compilation also passed; Mac compile
and simulator integration were still running at this checkpoint. Scriptable
physical setup acceptance awaits installation of this one working-script update.
Owner has accepted the preceding interface layout while trying a test cook.
No private history re-import or backup-agent update is required for this feature.

## 2026-10-13 — FireBoard 2 cook setup

Owner found dedicated device/probe setup missing while using a test cook.
Added a FireBoard 2 and probes disclosure inside Cook setup and preparation:
optional device name, accessories notes and six numbered wired channel entries
with role, probe type, label and placement. Official FBX2 specifications confirm
six 2.5 mm probe inputs (https://docs.fireboard.io/fb2series/fb2series-specs/).
No channels are assumed to be pit/meat until selected. Not used / not recorded
stores null; old cooks without setup remain valid and are not rewritten on view.
Saved cook setup uses optional cookingDetails.fireboardSetup version 1, checked
for six unique channels 1–6, allowed choices and bounded text in save/restore.
Omitting setup through an older profile caller preserves an existing setup.
No account/password, pairing, live temperature or automatic channel-to-import
mapping was added. Imported session/raw chart/labels/units and legacy probe-role
rows remain unchanged; setup is the owner's cook metadata. Completed-session
imports still use the existing private exporter/file picker.

All fields participate in existing per-cook drafts, offline commit, recovery
snapshots and exact restore. Tests cover caller mutation, legacy preservation,
completed-session non-mutation, old-caller preservation, explicit null removal,
exact fresh-store restoration, rejected duplicate/range/choice/length data and
checksum-valid invalid restore rollback. Browser tests cover six-channel setup,
unsaved filtering, offline reopen and event-save draft preservation. Results
follow; working namespace/filename/shortcut, Mac backup policy and production
remain unchanged. No private history or credentials were accessed/published.

### Approved interface verification checkpoint

Installable source: 21d49045d5c56b001c5619e982c69e5abc8c1456.
Actions run 38417174941 regression job passed: 72 JavaScript tests; 58 Python
passes plus two Mac-only Linux skips; generated-artifact reproducibility,
security/CSP checks and all three browser integrations. Navigation/disclosures,
auto-opening, quick actions, compact matching-Mac proof, per-cook drafts through
filters/view changes/cook changes/other-form saves, and simulated disk-full save
failure were accepted. Offline lifecycle, exact isolated restoration, corrupt
journal recovery, large relational history and retention rehearsal still passed.
Reviewed a synthetic full-page screenshot at 390-pixel iPhone width. Wrap is
ordered before Rest/Finish and Finish uses a secondary button style. Fresh saves
replace older compact-proof text with checking status until the new check returns.

Earlier interface source a06c2faf6af42857127abdc527818d8495657c00 also passed
regression plus actual macOS recovery tests, native storage and both platform
compiles. Its iPhone simulator integration was still running; the final source
native job was queued at this checkpoint. These additional native-host checks
are not evidence of physical Scriptable acceptance. The owner still needs to
install the working script update to see the layout on their iPhone. No repeat
migration/retention rehearsal is requested. Keep saving drafts before closing.

Owner accepted the preceding launch change as a little faster. All approved
interface work is implemented and documented; actual replacement-phone recovery
and the next real cook remain the existing pilot gates. Production remains
unchanged and no private cooking data or credentials were published.

## 2026-10-13 — Approved cooking interface update

Owner physically accepted the journal-first update as a little faster and
approved all five UI proposals. Implemented separate Cook, History and Backups
views; sticky accessible navigation; compact current-proof backup summary with
expandable diagnostics and restore/import tools; automatic opening of newly
created cooks; large phase-valid action buttons with shared store transition
rules; collapsible setup, review, session import and comparison panels; save/error
feedback beside each form; and per-cook in-memory drafts. Navigation, history
filters, opening another cook, and saving another form preserve those drafts.
Failed saves retain edits and do not clear the unsaved indicator. Inputs lock
while a save is committing to prevent typing into fields about to re-render.
Drafts are not recovery snapshots: save before closing Scriptable; closing or
reloading discards unsaved in-memory edits. Existing cooking data and original
archives need no migration or schema change. Backup work still runs automatically
regardless of selected view; pending iCloud upload is never equated to verified
Mac protection. Failures/storage warnings remain visible in the compact summary.
Damaged journals open directly in Backups with recovery tools expanded.

Replaced stale synthetic-only/use-old-app interface advice with controlled-pilot
wording; restore confirmation still explicitly warns it replaces the journal
and discards unsaved edits. Numeric rating is labeled 1–5 and qualitative result
is labeled separately. Working filename, shortcut URL, journal namespace and
backup policy are unchanged. Production was not changed.

Added browser coverage for all navigation/disclosures, automatic opening, quick
actions, compact current-Mac proof, and drafts through filtering, cook switching,
other-form saves and simulated disk-full failures. A pure lifecycle test commits
every offered phase action through the actual store. Updated native simulator
navigation/relaunch checks. Local tests/security pass; CI results follow.
All fixtures and UI screenshots are synthetic. No private history was accessed.

### Journal-first launch verification

Source 9abcd3ceac57beb0c47e4f754d1d688576d2cb8c, Actions run 38402927111:
regression passed: 71 JavaScript tests; 58 Python passes with two Mac-only
Linux skips; artifact reproducibility/security/CSP checks; all three browser
integrations. Actual generated Scriptable launcher accepted deferred protection,
offline lifecycle, isolated restoration with original bytes preserved, damaged
journal recovery and 30-cook/18,000-reading opening. Browser host APIs are
simulated; iPhone launch timing and native Scriptable presentation acceptance
remain unmeasured. Actual Mac tests, native storage, iPhone and Mac compilation
also passed; simulator integration was still running at this checkpoint.
Install into the existing LDCookLog-2-Backup-Status.js without renaming or changing
journal/shortcut. Other UI proposals remain discussion items only.

## 2026-10-13 — Journal-first launch and UI review

Owner reports the Home Screen Shortcut works but opens the Scriptable Scripts
screen before a slow journal launch. Kept the existing URL/underlying filename
and journal namespace. The launcher now validates and renders the current
journal, starts native presentation with no evaluation pending, then uses one
250 ms startup timer to drain queued backup work. Retained-snapshot validation,
iCloud staging, Mac receipt checks and retention still run automatically in the
same serialized storage queue. No validation is skipped or cached. Close cancels
the startup drain timer; later wake requests are ignored after dismissal.
Backup status remains checking until the actual operation completes, rather
than claiming protection while checks are pending. This reduces work before
presentation; actual Scriptable host-transition time/iPhone timing is unmeasured.

Local JavaScript checks: 71 passed. Host regression asserts only the initial
journal read is delivered before presentation, backup staging occurs after
presentation, serialized saves still work, idle polling is absent and dismissal
stops requests. Generated-launcher browser regression additionally asserts backup
results are delivered after native presentation. CI results follow.

Reviewed current interface source at iPhone width. Proposed for owner discussion,
not implemented: Cook/History/Backups navigation; compact current backup summary
with expandable diagnostics; auto-open newly created cook with prominent valid
next actions; collapsible setup/preparation/review/comparison sections; save
feedback near the edited section and unsaved-draft protection. Also flag stale
“use the current app for real cooks”/synthetic-only wording for a consistent
controlled-pilot label, and clarify numeric rating versus qualitative result.
The existing shortcut uses the documented Scriptable run URL; this release does
not claim to eliminate Scriptable's host handoff. Production is unchanged.

### Structured-history verification checkpoint

Source 856853dfd1b39e9a564daa363516059498ac159e, run 38397701385:
regression job passed (71 JavaScript tests, 58 Python passes with two Mac-only
Linux skips, security/CSP checks, artifact reproducibility and all three browser
integrations). New browser checks accepted trim/brine/injection/binder and
structured overall/bark/tenderness/changes-next-time surviving offline reopen.
Pure tests accepted original-record non-mutation, identifier/account-access
exclusion, zero-weight handling, exact structured restoration and invalid-choice
rollback. Actual macOS maintenance/native storage tests and iPhone compilation
also passed; Mac compile/simulator steps continued at this update. Source data
and backup schema did not need migration. Ready as one reviewed working-script
update; no additional owner rehearsal requested for the incremental fields.
The next real cook remains the practical pilot checkpoint.

## 2026-10-13 — Structured preparation/review and readable imported history

Continued independent development while the owner waits for the next real cook.
Reviewed original production preparation schema, evaluation choices and history
presentation. Added original choices for trim, brine/marinade, injection, binder,
overall result, bark and tenderness, plus observations and changes-next-time.
Existing general notes, general evaluation text and numeric rating are retained.
New structured fields are saved through the normal immutable recovery path;
invalid choices reject before commit, and original relational records/archives
remain unchanged. Existing saved cookingDetails extension fields are retained
when updating setup. Imported original preparation/evaluation values are shown
as defaults when no newer structured values have been saved.

Original imported details now use explicit readable groups: setup/name lookups,
preparation, ordered meat pieces with units and zero values preserved, rubs,
sauces, evaluations and supported weather fields. Identifiers/account-access
rows are excluded from presentation; all source rows remain in their original
preserved data. DOM textContent renders values safely; no raw HTML is inserted.
Viewing these details never writes data. Recipe references remain readable text
for offline use. Some source extensions not in the display allowlist remain
preserved without presentation; full individual meat-piece editing is still open.

Local validation: all 71 JavaScript tests and security/CSP checks passed. Added
read-only field/identity exclusion tests, exact structured-field recovery tests,
invalid-choice rollback tests and browser offline persistence coverage for new
preparation and review controls. CI results follow. No user testing loop is
requested for every new field; changes will be batched into a reviewed update.
Production remains unchanged and private cooking data/credentials are not committed.

### Operational-maintenance verification checkpoint

Source 35f29c23d21246357a4fcbc92ab490c4564d8223, run 38396288785:
regression job passed (68 JavaScript tests, 58 Python passes with two Mac-only
Linux skips, security checks, generated-artifact reproducibility and three
browser integrations). Actual macOS recovery/maintenance suite passed all 43
tests, including compilation of fixed notification scripts without delivering
notices, and native storage tests passed. Remaining unchanged native build/
simulator steps were still running when recorded. Notification display itself
is not proven: OS settings control visibility, and command acceptance is only
request evidence. Existing scheduled helper remains at its installed checkpoint
until --install is run with the updated generated worker. The updated exporter
also requires replacing its downloaded script to get automatic certificate roots.
No new phone install or repetitive rehearsal is needed for this batch. Owner
can perform the two-tool Mac update once; no response/approval loop is required.
No production merge/deployment or external messaging occurred.

## 2026-10-13 — Autonomous development; operational backup maintenance

Owner authorizes continued independent development and requests batched device
participation instead of prompts for each incremental change. Four-cook controls
and labels appeared on the owner's phone; full four-comparable-cook traces are
not physically accepted because suitable comparable history is unavailable.
Automated four-trace integration remains the evidence for that case.

Added best-effort Mac-local notices on failures of the standard scheduled worker,
a recovery notice after a failure streak and storage-budget warnings. Messages
contain only fixed application text, never cook data, paths or exception details.
Failure repeats are at most every four hours; sustained capacity warnings at
most daily, with rearming after conditions clear. No external recipient/server
or credentials are involved. Requests use a bounded built-in osascript command;
a successful request is not proof of visible delivery. Notification settings
and Focus may suppress display. No alerts are sent by custom checks, manual
runs, installation, diagnosis or synthetic rehearsals.

Managed stdout/stderr logs exceeding 1 MiB retain their last 256 KiB in a private
.previous file and truncate the existing inode. Only the two known worker-log
paths are eligible; symlinks and non-regular files stop optional maintenance.
Notification state is private bounded metadata, distinct from backup receipts.
Optional maintenance failures never turn a failed backup into success or
invalidate a verified independent copy. Retention/state schemas are unchanged.

The FireBoard exporter now supplements its default TLS context with the Mac's
existing /etc/ssl/cert.pem roots when no explicit SSL_CERT_FILE is supplied.
Certificate and hostname verification remain enabled; redirects remain refused.
This uses the same roots the owner already verified, with no certificate download,
trust-settings modification or password retry. New TLS-context tests confirm
verification and explicit operator certificate settings are preserved. Existing
export/login/diagnostic tests pass (13 tests). The installed exporter needs its
reviewed update to get automatic CA selection; older invocations still work.

Local Mac discovery: 41 passes, two macOS-only skips (43 total). New tests cover
failure cooldown/recovery/rearming, daily capacity warnings, fixed-text bounded
notification requests, rejection, log bounds/inode preservation, symlinks and
actual macOS compilation without delivering notifications. CI follows. The
installed owner helper needs one update at the batch milestone to enable these
features; actual visible notice delivery remains unverified. No production
merge/deployment or private cooking data commit.

### Four-cook comparison verification checkpoint

Source d1bf3919acf587abf6ea6cb9b3aa2239bee74d82, run 38394638727:
regression job passed: 68 JavaScript tests, 50 Python passes with one Mac-only
Linux skip, security/CSP checks, artifact reproducibility and three browser
integrations. Four-trace rendering and labels, native option-disabled duplicate
prevention, selected cooks/probes surviving history filtering and unchanged
recovery bytes all passed against the generated Scriptable app with a large
synthetic history. The first run's generic disabled-control helper differed
from HTMLOptionElement.disabled; direct browser option-state assertion confirmed
the actual disabled property. Production code did not require a change for that
assertion. Actual macOS recovery/native storage tests also passed; remaining
native compilation/simulator checks were still running. Owner iPhone acceptance
is next. No cooking-data migration, production merge or deployment occurred.

## 2026-10-13 — Four-cook temperature comparison candidate

Expanded comparisons from the current cook plus one comparison to the current
cook plus up to three others. All selectors label food, cooker and date; probes
retain session/probe identities. Chart legend names each cook/probe with reading
count, distinct colors and line patterns. Duplicate selections are disabled.
Test cooks remain excluded from comparison choices; existing historical choices
with readings remain eligible. Celsius conversion is display-only; all raw
samples are retained. Viewing/changing comparisons writes no journal snapshots.

Selections are held per current cook for the open app session and survive
history search/filter rerenders. Invalid/removed/test-marked comparison cooks
are dropped, and unavailable probes reset safely. Closing/reopening the app
resets comparison preferences; cooking data remains persistent as before.

Shared JavaScript regression and security/CSP checks pass locally. Generated
Scriptable browser integration now exercises four cooks from the 30-cook,
18,000-reading synthetic history, exact trace/legend counts, duplicate prevention,
selection preservation through history filtering and unchanged recovery bytes.
CI results follow. Owner iPhone comparison acceptance is next; production and
private data remain untouched. This addresses the prior two-cook feature limit.

## 2026-10-13 — Real scheduled backup resumed; backup-readiness decision

Owner's current --status returned AUTOMATIC MAC CHECK PASS for revision 8,
with recent scheduled execution verified and independent bytes revalidated.
Managed Mac storage was 48 MiB of 1024 MiB with six retained copies. This closes
the overnight scheduled-worker check; it is distinct from synthetic rehearsals.

Backup readiness supports a controlled real-cook pilot in the existing offline
journal: source history reconciled exactly, private full-history Mac-file restore
accepted, offline persistence and feature checks accepted, real completed-session
import/deduplication accepted, and Mac/phone retention rehearsals plus resumed
scheduled execution accepted. Routine manual exports of unchanged Supabase data
are unnecessary; preserve the original October 11 dump and relational export.
If Supabase is edited again, those changes need a new export/reconciliation.
New offline saves need current Mac verification before being regarded as
independently protected. Copying waits for connectivity and Mac awake/sign-in.

This is not a full production release/cutover: the installed interface remains
labelled development; physical replacement-phone/reinstall recovery, proactive
failure alerts and remaining feature parity are unverified/incomplete. No
production branch merge/deployment or Supabase deletion occurred. Next milestone
is a controlled first real cook and resulting current independent backup, with
clear acknowledgement that the application remains a development candidate.

## 2026-10-13 — Owner iPhone retention and recovery rehearsal accepted

Owner confirmed both PHYSICAL IPHONE checks: 26 synthetic saves reduced to
21 retained snapshots, and exact synthetic cook/readings/notes/setup recovered
and reopened in a fresh isolated journal. The Mac receipt used in that rehearsal
was simulated and is not evidence of actual iCloud upload or real Mac protection.
The real working journal separately has owner-reported revision 8 independent
Mac verification, dated October 12, plus prior fresh unattended capture of a
new revision and full private-history restoration/reconciliation acceptance.

Mac filesystem retention/failure/recovery and phone FileManager cleanup/reopen
are now physically accepted. Source recency: owner reports no added or edited
real Supabase cooks after the October 11 archive. Preserve that original archive
permanently; no new export is needed for unchanged source data. No real-cook
cutover, production deployment or merge is recorded. Fresh scheduled-worker
status after the overnight interval remains unconfirmed; actual loss/reinstall
or new physical iPhone restore and operating/cutover acceptance remain open.
Operating and recovery steps are in development/scriptable/OPERATING_AND_RECOVERY.md.

### iPhone rehearsal CI checkpoint

Source fa8caf75fffb521bc8ed55e65ea6e463071da559, run 38391106170:
regression job completed successfully, including all 68 JavaScript tests,
Python regressions, security checks, generated-artifact reproducibility and
three browser integrations. The new integration executes the generated
Scriptable rehearsal against the actual shared browser validator with mocked
FileManager APIs, asserting unique synthetic scope, simulated-proof cleanup,
exact fresh-journal recovery/reopen and removal of test folders. Actual macOS
recovery and native storage tests also passed; unchanged native build/simulator
steps continued at this update. Owner physical iPhone execution is next.

## 2026-10-13 — Owner Mac rehearsal passed; isolated iPhone candidate

Owner ran the synthetic Mac rehearsal: 50 saves, 31 normal-policy copies,
five budget-limited copies, first/newest three retained; capacity/corruption
failure preservation and exact revision 50 fresh-folder recovery all passed.
This is filesystem evidence on the owner Mac, not an iPhone/new-device test.

Added a generated Scriptable retention rehearsal using the shared storage and
checksum/schema validator. Each run creates unique local/iCloud folders under
LDCookLog-2-Synthetic-Rehearsals, containing only a tiny synthetic journal.
It creates 26 saves, proves no cleanup without receipt, injects an explicitly
simulated matching Mac receipt inside the isolated roots, checks 21 retained
snapshots (first/newest 20), reopens the latest, selects a retained synthetic
cloud copy, restores into a fresh synthetic local journal and reopens exact
state. Success removes only the uniquely owned synthetic folders. Failure keeps
those folders for diagnosis. Working journals, private backups, original source
archives, credentials and the scheduled Mac agent are not accessed.

This is an explicit isolated file-API test, not evidence of a real Mac copy or
actual iCloud server upload. A generated-script browser integration asserts
scope isolation, proof-gated cleanup, exact restore/reopen and cleanup; CI runs
that integration and checks artifact reproducibility. Owner iPhone execution
follows browser verification. Remaining new-device/cloud-loss and operational
acceptance gates are still open; no manual Supabase backup retirement clearance.

### Rehearsal CI checkpoint

Checkpoint 92a84908dd61ec7ab1c82d11ead15002221242c7, run 38390268508:
all 36 recovery/rehearsal tests passed on actual macOS, including the isolated
standalone-worker rehearsal. Linux unit, security and reproducibility steps
also passed; unchanged browser/native build steps were still running at this
update. Owner Mac execution is now ready using the existing downloaded helper.

## 2026-10-13 — Pick up from revision 8; isolated retention rehearsal

Owner reported independent Mac verification of working revision 8, capacity
49 MiB of 1024 MiB and eight local snapshots. The displayed verification time
was October 12; this is evidence of that copy, not proof of current scheduled
execution on October 13. Owner also confirmed no real cooks were added/edited
in Supabase after the October 11 source backup, and accepted the dropdown UI.

Added `development/scriptable/mac/rehearse_retention.py`, using the existing
downloaded standalone Mac helper. It creates only disposable synthetic folders:
50 saves, normal retention, forced capacity trimming, impossible-budget refusal,
corrupt-newest refusal, source-byte preservation and exact latest-state recovery
into a fresh folder. It reads no working cook/history/archive/credential files,
uses no cloud API or scheduled agent, and removes its temporary synthetic data.
Default helper code path is Downloads/LDCookLog-Mac-Recovery.py; no reinstall
or update of the working helper is required when it already supports retention.

Local rehearsal: 31 normal-policy copies from 50 saves, five budget-limited
copies; first/newest three kept; failure cases preserved retained copies;
revision 50 synthetic state recovered exactly. Mac test discovery: 35 passes,
one macOS-only skip on Linux (36 total). A regression test asserts temporary
source/destination isolation, no subprocess calls and cleanup of the temporary
folders. Actual owner Mac execution is the next participation point. This does
not substitute for actual iPhone cleanup beyond 20 snapshots or new-device
restoration. Existing production and private backups remain in place.

### Dropdown verification checkpoint

Source `106393df58e9e60df78a2988366a76de9ac39efe`, GitHub run
38293394780: regression job passed, including 68 JavaScript tests, 49 Python
passes (one Mac-only Linux skip), security/CSP checks, reproducible generated
artifacts and both browser integrations. Actual macOS recovery and native
storage test steps also passed; remaining native build/simulator steps were
still running. Browser tests confirmed preset/custom selections in both
directions and offline persistence. The first browser run caught label CSS
overriding the hidden attribute; the fix enforces hidden controls consistently.
Owner iPhone dropdown acceptance is the next step. No production changes.

## 2026-10-12 — Method and equipment choices

Owner accepted the new cook setup fields and offline save/reopen persistence.
The updated Mac worker installed successfully and the phone showed independent
verification and storage accounting. Actual pruning beyond the retention
threshold has not yet been observed on the owner device.

Added Method and Equipment/fuel dropdowns, with explicit Other/custom options.
Methods include smoke, no wrap, foil boat, paper/foil wrapping, direct/indirect
grilling and sous-vide/smoke sequences. Equipment presets cover Weber kettle,
Slow 'N Sear, lump/briquettes and Traeger Ironwood pellets. Existing exact preset
values select automatically; arbitrary saved text appears unchanged under Other.
Preparation remains free text. There is no stored-data migration: existing
method/equipment strings and normal recovery snapshots are retained. Changing
a choice only changes the draft until Save cook setup is pressed.

Browser regression covers preset and custom selection in both directions,
offline reopening and exact saved-string preservation. Shared store/Scriptable
regressions and security/CSP checks pass locally; CI browser verification follows.
No private history, exports or credentials committed; production unchanged.

## Retention/setup CI checkpoint — 2026-10-12 afternoon

Implementation checkpoint: `3c17fd4f32501c015ac7381a18a4ad5ea4ba28a1`.
Run 38291127633 passed the complete regression job: 68 JavaScript tests,
49 Python passes and one macOS-only skip on Linux, security checks, artifact
reproducibility and both browser integrations, including new setup persistence
and test filtering. Native source was unchanged; its build job continued.

The gate was expanded to execute all Mac recovery tests on actual macOS.
Initial run 38291309935 exposed a test-fixture assumption about a registered
LaunchAgent, not a retention failure. The test now mocks registration only,
including an explicit assertion that missing registration is rejected.
Checkpoint `360912802db9abfdaf70e448b5a8c94fb41403f0`, run 38291460396,
passed all 35 Mac recovery tests on the actual macOS runner, including real
Foundation bridge and filesystem retention tests. Linux test/artifact/security
steps also passed; repeat browser/native build steps were still running when
this checkpoint was recorded. Implementation bytes match the prior browser pass.

Candidate update requires the generated Mac helper --install and replacement
of the working Scriptable script. User data is not migrated again. Verify current
Mac protection and new setup fields on the owner devices. Installing this helper
enables the documented pruning policy for eligible redundant managed snapshots;
original PostgreSQL archives and private export files are never pruned.
No production merge/deploy and no backup-retirement clearance yet.

## 2026-10-12 — Retention, capacity and cooking setup candidate

Owner accepted completed FireBoard export using the Mac system CA file,
import into the separate restore trial, offline reopening with readings/chart,
and idempotent repeat import. The same session did not duplicate retained
readings. This confirms the real-account path; private session files and
credentials are not committed. Earlier owner tests accepted independent Mac
file restoration, notes/evaluation persistence and comparison.

Implemented automatic Mac retention: first/newest three per device and a
representative for every distinct original archive are mandatory; prefer 30
recent and 12 monthly points within the 1 GiB snapshot budget. Validate all
managed copies, acquire a worker lock, preflight capacity, write/fsync/read-back
new copies, then prune eligible older copies. Unavailable-device, conflicting,
corrupt or required-over-budget copies stop cleanup. 32 MiB disk reserve and
80% budget warnings are included. Original source files are never pruned by Mac.

Scriptable cleanup needs matching fresh Mac evidence for the exact current
snapshot and validation of all local/cloud bytes. Keep first/newest 20 plus
source-archive representatives, only in the current device/namespace. Display
approximate local storage with a 128 MiB soft warning, and Mac capacity metadata.
Phone/iCloud deletion failures leave required recovery points; no background
phone cleanup occurs while Scriptable is closed. Snapshot budgets exclude logs,
helper versions and unrelated files. These policies need physical acceptance.

Added cooking setup: editable food/cooker, start/finish dates, test-cook flag,
method, weight/pieces, equipment/fuel, preparation, rubs, sauces and 1–5 rating.
All edits use normal immutable recovery snapshots and leave legacy rows and
original exports intact. Unchanged displayed dates retain their original seconds.
Read-only original cooking details are visible, excluding account-access data.
History defaults to real cooks with a Show test cooks toggle. Fixed open-cook
scroll timing and disabled actions for finished cooks after saves.

Local validation: 68 JavaScript tests; 34 Mac Python passes with one macOS-only
skip; security/CSP checks. Added tests exercise budget pruning, disk full,
corruption, locking, archive retention, exact-Mac-proof phone cleanup, failed
deletion, setup validation and full-state restoration. Browser coverage adds
setup fields and test filtering. CI results follow after the source checkpoint.

Remaining: actual new-device/reinstall recovery; physical retention/setup
acceptance; four-cook comparisons (currently two); richer structured meat-piece
and per-dimension evaluation editing; direct iPhone completed-session retrieval
(current private Mac export works); proactive failure notifications; cutover
source-recency reconciliation. No production merge or deployment, and no claim
that manual Supabase backup retirement is yet approved.

## 2026-10-12 — Credential-free FireBoard connectivity diagnostics

Owner encountered the combined connection/response error during initial login.
That output does not identify a password rejection. The helper now distinguishes
TLS certificate verification, other TLS, DNS, timeout, refused/reset connection,
and invalid JSON errors without exposing exception text or response contents.
`--diagnose` sends a credential-free GET to the fixed FireBoard login endpoint;
HTTP responses establish reachability only (405 is expected for a POST-only
endpoint). It writes no files, supplies no credentials and never disables TLS
verification. Eleven exporter/diagnostic tests pass locally. Real Mac diagnosis
is pending; FireBoard import acceptance remains incomplete.

## 2026-10-12 — Owner recovery/feature acceptance and private FireBoard sign-in

Owner confirmed the matching Mac verification display on iPhone, restoration
from an independent Mac copy through the recovery-file picker into the isolated
trial journal, offline reopening with preserved archive/history/latest synthetic
event, offline notes/evaluation persistence in the working journal, and two-cook
temperature comparison with clear labels. These are owner-observed checks, not
an actual Scriptable reinstall or new-device test. Private files remain outside
the repository; no cooking records or credentials are included in this update.

The completed-session exporter now supports `--interactive`: hidden-password
FireBoard login, local title/date selection of completed sessions, and exclusive
private export into iCloud Drive / LDCookLog Backups. Credentials are used only
in memory and sent to the fixed HTTPS FireBoard endpoint; redirects are refused.
No password/token is printed or included in the export. Unsafe echoed password
fallback is refused. Existing token/ID invocation remains supported. Session ID
and completion dates are checked before writing. HTTP/transport failures avoid
response-body/credential output. Source: https://docs.fireboard.io/app/app-api/.

Seven Python tests passed for login, password preservation, selection, redirect
refusal, safe authentication errors, hidden-input enforcement, private output,
no-overwrite and identity mismatch handling. Tests are included in regression CI.
Real-account completed-session export/import acceptance remains pending. Also
pending: retention/capacity operations, remaining feature parity, new-device
recovery and source recency at cutover. No production deployment or merge.

## 2026-10-12 — Fresh unattended copy accepted; iPhone verification report

Owner confirmed revision 6 was copied by the scheduled Mac worker after a new
synthetic event, without an intervening manual install/read. A later scheduled
status check also passed. This resolves the fresh-snapshot acceptance gate for
the iCloud materialization/retry fix; it does not complete production cutover.

The Mac worker now publishes small verification metadata into Scriptable iCloud
only after validating an independent local copy. The phone matches device,
namespace, revision and exact payload checksum before displaying that evidence.
Missing, failed, stale, malformed or mismatched reports cannot claim current
protection. Report download is bounded at 1.5 seconds; publication failure does
not invalidate or remove a verified Mac copy. Upload completion remains
unconfirmed by Scriptable's own API. Metadata contains no cooking records,
credentials, local paths or error details. Physical phone display acceptance
is still required after installing both updated scripts.

Validation for source checkpoint `6f540407563b7e85bb97732fe784c5a2006eb40a`:
GitHub run 38254771398 passed the regression job: 65 JavaScript tests,
34 Python passes (one macOS-only skip on Linux), security checks, generated
artifact reproducibility and both browser integrations. The Scriptable browser
test runs the actual Python copy worker and reads its matching report through
the generated app. The native job passed the actual macOS Foundation bridge
and native storage tests; unchanged native compilation/simulator checks were
still running at this update. The previous source run 38251072543 completed
successfully in full.

Remaining gates include reinstall/new-device recovery, operational retention
and capacity handling, feature acceptance and a final source-recency check.
Keep the original PostgreSQL archive. No production merge/deployment occurred.

# LDCookLog 2.0 — development checkpoint, October 11, 2026

Branch: `development/2.0-offline-recovery`.
Implementation checkpoint: `a5cbb179acf68a3f4ca3d0023df07b8b0c44a2e6`.
Production `main` remains `e0ba05f6043b15d79a9ac053002137366a1105c3`.
No production merge/deployment, database changes, private-history upload,
backup upload or credential publication was performed.

## October 12: fresh-snapshot macOS EDEADLK; bounded materialization candidate

The fresh-action unattended test reported a failed scheduled iCloud read:
OSError errno 11. On Darwin this is EDEADLK (Resource deadlock avoided), not
Linux's errno-11 EAGAIN meaning. The initial explanation used the wrong
platform meaning; this was corrected after checking Apple's errno definitions.
The new code uses symbolic errno constants, including EDEADLK, rather than
hard-coded numbers; diagnostics now retain the platform's symbolic name.
An iCloud/FileProvider materialization issue is consistent with Terminal reads
succeeding and fresh-file background reads failing, but actual recovery is
still unaccepted and no specific privacy setting is assumed.

The worker now requests local materialization of the specific unavailable
file through Foundation startDownloadingUbiquitousItemAtURL:error:, using
macOS's built-in osascript Objective-C bridge. Paths are separate arguments;
there is no shell interpolation, Finder launch, inter-app messaging or
credential/API call. Only safe numeric Foundation codes are retained.
The native request has an eight-second timeout; transient source read/stat
retries share a 45-second job budget with bounded backoff. A request does not
count as a backup: successful byte retrieval, checksum/schema validation and
independent-copy readback are still mandatory. Permission, corruption and
other persistent failures stop; no old-source fallback or source deletion.
Timed-out work can be retried by the next scheduled run.

Injected readers preserve the auditor's file-size limits. Tests cover delayed
availability, exact byte copying, exhausted budgets/old-copy preservation,
permission non-retry, corruption after materialization, argument/privacy/
timeout handling and EDEADLK recovery across platform numbering. An actual
macOS Foundation bridge test is added to native CI, using only a synthetic
local non-iCloud file. Local Python regression: 31 passed, one macOS-only test
skipped; existing 60 JavaScript tests and security checks are unchanged.
Generated standalone helper is rebuilt. GitHub run 38251072543 passed the regression job for checkpoint
f3ce194fa8f1b7a75dc0b8602a06c108c9d3684d: 60 JavaScript tests, 31 Python
passes and one macOS-only skip on Linux, security checks, generated artifact
reproducibility and both browser integrations. Its native job passed the
actual macOS Foundation/osascript bridge test with the synthetic local file;
remaining unchanged native build/simulator steps were still running.
Actual private iCloud materialization and fresh-snapshot unattended capture
remain owner acceptance gates. Update the managed helper through --install;
retain all original cooking files and previously verified Mac copies.

Apple references:
https://github.com/apple/darwin-xnu/blob/main/bsd/sys/errno.h
https://developer.apple.com/documentation/foundation/filemanager/startdownloadingubiquitousitem(at:)?language=objc
https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/Articles/OSX10-10.html

## October 12: revision-4 independent and scheduled copying passed after update

The owner updated the managed helper to the safe-diagnostic checkpoint.
Preflight reported an independently verified revision-4 copy containing the
new synthetic action, and --status then confirmed recent scheduled execution
and independently readable revision-4 bytes. Initial source counts and preserved
archive were retained. No source cooking files were changed or private files
published. The updated helper is running on the actual Mac.

The earlier failure cause is still unknown: Terminal diagnosis/preflight had
read the current source before scheduled success, potentially materializing
its bytes. This acceptance proves current revision-4 scheduled verification,
but does not by itself exclude a fresh-file/background-access issue. Next save
one additional action in the synthetic working cook while online and leave
the periodic helper to discover/copy it. Only inspect --status afterward;
avoid a Terminal source read, manual --install or explicit copy before this
fresh-revision test. No broad macOS privacy changes are warranted without
an actual stage/errno failure.

## October 12: current Terminal iCloud read passed; scheduled error still unknown

The owner ran the new read-only diagnostic and reported TERMINAL ICLOUD READ
PASS: the current journal is readable and validated from Terminal. This rules
out a reproducible current-source read/schema failure in that execution
context. It does not establish whether earlier failure was transient sync/
materialization, background permissions or another scheduled operation.
Do not infer a specific macOS privacy setting or require broad permissions.

GitHub regression run 38248527005 passed for diagnostic checkpoint
23ce298c3993f538514efb47581664ea36b5f858: 60 JavaScript tests, 25 Python tests,
security checks, reproducible generated artifacts and both browser integrations.
The unchanged native job was still running. Next update only the managed Mac
helper through --install, which first verifies a current independent copy,
then use --status to observe the next scheduled attempt with stage/errno
diagnostics. Source cooking files and older verified copies are retained.
New-revision automatic protection remains unaccepted until actual scheduled
capture is confirmed; a preflight copy alone is insufficient.

## October 12: new-revision automatic copy failed; safe diagnosis candidate

After actual scheduled revision-3 acceptance, the owner saved Rest Start on the
synthetic cook in the working journal. The action and timestamp appeared. A
later scheduled status check reported failure; its recorded reason was only
"Files unavailable or data needs review." That does not identify iCloud read/
materialization, filesystem permissions, data validation or destination I/O.
The cause remains unknown. Automatic protection of this new revision is NOT
accepted; do not claim current backup health or a real-cooking cutover.
Existing verified copies and source cooking files are not overwritten/deleted
by this failure path. No private record contents were supplied to development.

The helper now records a controlled operation stage, exception class and errno
in failed-attempt metadata. It never stores exception arguments, raw exception
text, paths or cooking/credential values. --status reports these safe details
when the most recent scheduled attempt fails. A new --diagnose mode reads and
validates current iCloud recovery data from Terminal without creating copies,
changing receipts or modifying source files. This will distinguish whether the
source is readable from Terminal before updating/rechecking the scheduled job.

Two additional tests simulate permission failure containing fake private text
and paths, assert neither reaches output/receipts, and verify the standalone
Terminal diagnostic makes no writes. All 21 Mac Python tests plus four converter
tests pass locally (25 Python total); existing 60 JavaScript tests are unchanged.
The generated worker is rebuilt; GitHub regression and actual diagnosis are
next. The iPhone application and production branch are unchanged.

## October 12: actual independent Mac copying and scheduled execution passed

The owner installed the generated standalone Mac recovery helper at tested
checkpoint 1979f80c32615e734e9285f4efb08a66723ca078. Installation reported an
independent-copy pass for the expected working revision and successful
registration of the periodic user agent. The owner subsequently ran --status,
which reported AUTOMATIC MAC CHECK PASS and RECENT SCHEDULED EXECUTION VERIFIED.
This verifies recent scheduled execution on the actual Mac, actual agent
registration and independently readable/checksummed copies, rather than only
a manual installation preflight. Private files and credentials stayed local.

The next physical acceptance test saves a new action on the synthetic cook in
the working Migration Fix journal, preserves it across offline reopening,
then checks whether iCloud staging plus the periodic Mac helper protects that
new revision without a manual database export or manual Mac copying command.
Do not modify historical source cooks, reimport or reset journals for this test.

Source migration/full-history isolated restoration and the initial automatic
Mac copy are accepted. Ongoing new-revision protection, retention/quota and
failure visibility, remaining cooking/completed-session features and
reinstall/new-device recovery remain open. Production main remains untouched;
Supabase retirement and a real-cooking cutover are not yet approved. The
existing verified PostgreSQL archive should be kept; no fresh database export
is needed for this synthetic device test.

## October 12: owner-private source reconciliation passed; Mac automation candidate

The owner ran the independent source comparison locally and reported SOURCE
MATCH PASS for both working revision 3 and restored-trial revision 4, followed
by FULL SOURCE RECONCILIATION PASS. All 18 source tables were exact and source
cook/event/session/reading identities, values and relationships reconciled.
The extra synthetic cook was permitted separately. Private files remained on
the owner's devices; no cooking records or credentials were published.
This completes the controlled initial-history reconciliation gate, not future
editing/feature acceptance or reinstall/new-device recovery.

A new generated standalone Mac helper, `mac/LDCookLog-Mac-Recovery.py`, is ready
for controlled installation. It independently validates the latest working
recovery snapshot, including all cook/event/reading structures and preserved
source-archive checksums/IDs, then copies its exact bytes into private local
Application Support storage outside iCloud. Copies are immutable, verified
by readback/checksum, restricted to the owner and idempotent. Source cooking
files are never changed. A corrupt/missing/conflicting source or damaged
existing copy stops without replacing evidence or silently choosing an older
source. The last successful receipt and current attempt status are separate.
No credential or record contents are printed in diagnostics.

`--install` first proves a real independent copy, then installs a versioned
helper and a per-user LaunchAgent with RunAtLoad and a five-minute interval.
It refuses unrelated agent configurations; failed registration keeps verified
copies and removes only a newly created agent or restores its earlier managed
configuration. `--remove` stops the agent while retaining all backup copies.
The scheduled worker only runs while the Mac is awake and the owner signed in;
it needs newly staged iCloud bytes to reach that Mac. No Supabase connection
or recurring database export is performed. A 1 GB cap stops new copies rather
than deleting backups; automatic retention and proactive failure alerts are
still needed before an unconditional backup-operational acceptance claim.

Eight worker tests pass for exact independent copies/private permissions,
idempotency, corrupt-newest/missing-source refusal, collisions/quota, symlinks/
path overlap, structured scheduling/unrelated-agent refusal, standalone safe
success/failure receipts, failed-install rollback and status requiring recent
scheduled execution with copy revalidation. The --status command requires a
scheduled receipt less than 15 minutes old, checks actual agent registration
on macOS and revalidates the independent copy; manual success alone is refused.
Existing 60 JavaScript and now 23 Python tests remain the regression set. Security checks pass.
Generated Mac artifact reproducibility is now a required CI step. GitHub regression run `38225951822` passed for checkpoint
`1979f80c32615e734e9285f4efb08a66723ca078`: 60 JavaScript tests,
23 Python tests, security checks, all generated artifact reproducibility and
both browser integrations. The unchanged native job was still running.
Actual Mac installation and scheduled execution remain untested and require
the owner; run --install then --status after the scheduled attempt.
The production branch and iPhone application code are unchanged.

## October 12: full-history isolated restore and offline reopening passed

The owner explicitly restored the original development iCloud revision 3 into
the separate Restore Fix journal. It showed the expected combined cook count
and preserved source export. After force-closing Scriptable and reopening
Restore Fix with Airplane Mode/Wi-Fi off, both remained; the selected historical
cook's timeline and retained-reading count looked correct. This establishes
physical full-history restoration and offline persistence into a separate
journal in the same Scriptable installation. It is not a reinstall/new-device
recovery test or exhaustive source reconciliation.

A new standalone read-only Mac helper, `reconcile_private_history.py`, compares
the original private relational export against the latest independently
retrieved working and restored-trial recovery journals. It verifies exact UTF-8
snapshot checksums/revisions, source checksum, exact equality of every source
table/field (including unknown/global configuration tables), source cook IDs,
original per-cook records and related/lookup rows, converted cook labels/notes,
phase/times and event/readings with IDs, timestamps, values, units, device/probe
identity and multiplicity. Missing/conflicting/damaged newest copies stop the
comparison; there is no fallback, write, upload or printing of private record
contents. It permits extra synthetic cooks alongside all source cooks.

Seven new Python tests consume snapshots produced by the actual JavaScript
importer and sealing code, accept complete history, and reject same-count
changed values/IDs, altered archives/lookups, missing/duplicated records,
corrupt newest snapshots and ambiguous timestamps. The standalone CLI test
requires both journals, rejects a damaged trial, checks no source file changes
and verifies output excludes private record text and paths. GitHub regression run `38223623077` passed for checkpoint
`8df3db4afb8bbe58eb325b89a5a51438ce03e06f`: all 60 JavaScript tests,
15 Python tests, security checks, reproducible bundles and both browser
integrations. The unchanged native job was still running. Owner-private
execution is pending. Reinstall/new-device recovery, remaining features and backup retention/
quota/cutover operations remain release gates. Keep the original PostgreSQL
archive and Supabase available.

## October 12: private history reopened offline and Mac recovery bytes verified

The owner confirmed that Migration Fix opened the imported journal with the
expected combined cook count and preserved source export. After fully closing
Scriptable and reopening with Airplane Mode/Wi-Fi off, the same count remained;
a historical cook's timeline and retained reading count looked correct.
This is a physical reopening/smoke check, not a record-by-record reconciliation.

The owner retried iCloud staging successfully for all three local snapshots.
The independent read-only Mac checker reported checksum/readability PASS on
the latest revision 3 with the expected combined cook, event and reading
counts and one preserved source archive. Private files were not supplied to
ChatGPT or GitHub. Upload status in the app remains unconfirmed by design;
the Mac result is independent evidence of readable recovery bytes.

Next update the isolated Restore Check launcher to the tested startup-readiness
checkpoint b8d1efb2a2d1dc162ad3cfa9a319b4703bda9d80, then explicitly restore the
original development iCloud revision 3 into that separate trial journal.
Verify full-history reopening offline and original working journal preservation.
Full source-table/ID/value reconciliation, reinstall/new-device recovery,
remaining feature acceptance and backup retention/quota remain release gates.
The original PostgreSQL backup and Supabase remain available.

Earlier pending physical-reopening statements below are historical checkpoints
superseded by these observations; private full-history restoration is still pending.

## Imported history exposed an asynchronous startup race

The owner confirmed the expected combined cook count and one preserved database
export after private on-device migration, then reported refusal to reopen:
"The cooking interface did not finish its initial read." No data was reset.
The host delivered the journal, then synchronously checked a page status that
is updated only after asynchronous checksum and schema validation. Small
synthetic journals hid that race. This diagnostic does not prove deletion or
corruption; reopening the larger journal remains physically unverified.

The Scriptable page now resolves an explicit startup readiness promise after
render or the existing recovery error status, before requesting startup backup
status. The host awaits that signal with a bounded two-minute wait instead of
sampling status immediately after delivery. No files, namespaces or validation
rules are changed. Late callback ownership and primitive evaluation return
values remain enforced. The regression simulates delayed page readiness and
the browser integration deliberately delays checksum work on every reopening.
GitHub regression run `38176459388` passed at checkpoint
`b8d1efb2a2d1dc162ad3cfa9a319b4703bda9d80`: 60 JavaScript tests, 8 Python
tests, security checks, reproducible bundles and both browser integrations.
The generated Scriptable launcher opened and reopened a complete synthetic
30-cook/18,000-reading relational journal under deliberately delayed checksum
validation without changing its stored bytes. Native sources are unchanged;
the redundant native job was still running. Physical private-history reopening
is next; install the candidate under LDCookLog-2-Migration-Fix.js without
reimporting, replacing or deleting cooking files.

## Owner-local private export prepared

After physical isolated recovery acceptance, the owner ran the pinned local
PostgreSQL converter successfully on the existing verified archive. All 18
expected public tables were present and the known 30-cook count was retained.
The output remains private in the owner's iCloud backup folder; neither the
archive nor relational JSON was supplied to development or GitHub. This is
source conversion acceptance, not yet on-device checksum/link validation,
full reconciliation or successful recovery of the private cooking history.

The next guided step is to open the latest tested working Scriptable launcher
in the existing development namespace and select the private relational JSON
through the device's Files picker. The import verifies its checksum, required
tables and cook/session relationships before a transactional commit. The full
relational source archive remains in recovery snapshots, including preserved
lookup and configuration rows. Any checksum, orphan or conflicting-ID failure
stops the import. The original PostgreSQL archive and Supabase stay available.

## Physical isolated recovery and offline reopening passed

On October 11 the owner confirmed that the separate Restore Fix journal showed
the expected Cooking phase and saved Meat On timeline event after selecting
the original iCloud recovery copy. The owner then enabled Airplane Mode with
Wi-Fi off, fully closed Scriptable, reopened Restore Fix and confirmed both
were still present. This establishes physical restoration into the isolated
journal and persistence across offline reopening for the synthetic cook/event.
Together with the earlier independent Mac read/checksum pass, it is evidence
that the staged synthetic recovery bytes are readable on the Mac and usable
by the iPhone recovery flow. It does not establish reinstall/new-device recovery,
complete private-history migration or large-history reliability. The owner also reopened the original working journal and confirmed its
cook/event remains. Physical acceptance now covers both journals. The next
controlled step is local-only conversion of the existing PostgreSQL archive
and review of table counts before any private iPhone import.

No private history has been imported. Keep the verified PostgreSQL archive and
Supabase available; the replacement is not yet cleared for retiring manual
Supabase backups. All earlier pending physical-restoration statements below
are historical checkpoints superseded by this result for the isolated test only.

## Restore selection showed no visible response; visible confirmation candidate

The owner tapped original iCloud revision 2 in Restore Check and reported no
response. Physical isolated restoration is not accepted. The exact cause is
not yet established: reading/downloading the copy or the browser-native
confirmation may have stalled/failed. Earlier Chromium tests automatically
accepted native dialogs and did not establish Scriptable dialog compatibility.

The Scriptable-only bundle now uses an accessible in-page confirmation with
Restore recovery copy and Cancel controls. It marks reading of the selected
copy visibly before requesting it. The native shared application is unchanged.
Modal text is inserted as text, siblings are inert while confirming, Cancel or
Escape leaves journal data unchanged, and focus/inert states are restored.
Generated substitutions assert the expected upstream confirmation count.

Recovery reading skips redundant downloading for files already downloaded;
otherwise it uses a 30-second bounded download. Validation/reseal evaluations
are also bounded and capture their own completion callback so late results
cannot answer a newer verification. A timed-out download can complete its
cache hydration later, but cannot proceed to journal restoration after the
rejected operation. No data is reset on error.

A browser repeat stalled because the mock dismissed a new view before its
presentation promise had started, using the preceding view's stale close
callback. The harness now waits for presentation on every open. A two-minute
integration watchdog and five-minute dependency/browser step cap prevent future
unbounded hangs and report the current test phase. The corrected full regression
passed; application code is unchanged by the harness fix.

Four new tests pass for visible explicit confirmation and focus/inert behavior,
Cancel/Escape/concurrent dialogs, downloaded-file skip and failed-download queue
release without writes, and independent late verifier callbacks. All 59
JavaScript and 8 Python tests plus security checks pass locally. The browser
regression now rejects native dialogs and checks Cancel leaves the isolated
journal empty before explicitly accepting restoration. GitHub regression run `38174134157` passed for tested checkpoint
`c9f574b09198e2e3325f7b928428ea11270ca2ec`: 59 JavaScript tests, 8 Python tests,
security checks, reproducible bundles and both browser regressions. The browser
check explicitly canceled without writing, accepted the in-page restore,
verified the cook/event, reopened the isolated and working journals and repaired
a corrupt synthetic journal. Native builds were still running; native sources
were unchanged. Physical restore remains pending. Install the new candidate under LDCookLog-2-Restore-Fix.js; its
restore-test journal namespace is unchanged and any prior trial data is kept.

## Independent Mac recovery bytes verified; isolated restore candidate

The owner's Mac checker reported MAC READ/CHECKSUM PASS with 2 snapshots,
latest revision 2, 1 cook, 1 event, 0 readings and 0 source archives. This is
observed independent Mac readability/checksum verification of the synthetic
iPhone recovery copies. The application still reports uploads unconfirmed;
no unsupported completed-upload API claim is introduced.

`LDCookLog-2-Restore-Check.js` now opens a separate local journal folder and
separate iCloud backup destination. It starts empty on first launch and reads
original development iCloud snapshots only for explicit restore selection.
It never reads the working development local journal or writes to the source
cloud folder. Namespaces are a fixed allowlist, not user-provided paths. The
existing shared schema/checksum validator and confirmation apply to restoration.
No source or working journal is deleted/reset. A repeated launch preserves the
trial, rather than silently recreating an empty journal.

Three additional storage tests pass: isolated cloud restoration/reopen with
exact state and original bytes retained, corrupt cloud refusal with the working
journal intact, and rejection of unrecognized namespaces. An additional test refuses checksum-valid cloud payloads whose embedded revision
disagrees with the selected filename. All 55 JavaScript
and 8 Python tests pass locally with the security check. The generated-launcher
browser test now covers the empty trial, source revision 2 selection, Cooking
phase and Meat On timeline, relaunch, unchanged original bytes and the existing
corrupt-journal repair. GitHub regression run `38172740063` passed for candidate
`fc4450e007ffd92bdb096eb7f8e9aa55168ea097`: all 55 JavaScript and 8 Python tests,
security checks, reproducible development/trial bundles and both browser tests.
The generated launcher check passed isolated cloud restore/reopen and original
byte preservation. Native builds were still running at this report; native
application sources were unchanged. Physical trial restore is still pending.

Physical isolated restoration is next. This is a fresh local journal in the
same Scriptable installation, not proof of reinstall/new-device recovery. Real
30-cook/18-table reconciliation, completed FireBoard import, remaining feature
parity, large-history/quota/retention and operational backup acceptance remain
release gates. Keep the Supabase application and existing verified archive.

## iPhone action and staging observed; independent retrieval next

The owner reopened SaveFix after reconnecting Wi-Fi and observed the synthetic
cook in Cooking phase with its action controls available. This confirms the
Meat On transition persisted. The exact timing of the action save while offline
has not been independently confirmed, so that specific gate remains open.

The owner then reported: 2 copies staged in iCloud Drive; 0 could not be staged;
2 local snapshots; 0 confirmed uploaded; 2 pending. This is the expected honest
staging status. It is not evidence of remote delivery. Next run the pinned
read-only Mac checker and then restore from independently retrieved bytes into
an isolated fresh development journal without deleting the working journal.

Mac-checker checkpoint `a5cc44d72fc3658990934a591a0e3729386dac72` passed full
GitHub CI run `38171566077`: 51 JavaScript tests, 8 Python tests (four converter
and four checker), security/reproducible-bundle checks, both browser regressions,
8 Swift storage tests, unsigned iPhone/Mac builds and native simulator tests.
Physical Mac retrieval/restoration and private-history reconciliation remain
unverified. Production main and private cooking history remain untouched.

## Physical offline reopening and Mac transport check

The owner confirmed Test ribs remained after force-closing Scriptable and
reopening SaveFix offline on the iPhone. This verifies persisted local cook
recovery for the synthetic test. Offline event saves/reopening, independent
cloud delivery and fresh-journal restoration are still pending.

Added `development/scriptable/mac/check_icloud_recovery.py`, a standalone
standard-library Python checker for the Mac Scriptable iCloud recovery folder.
It reads all matching device snapshots, hashes the exact UTF-8 payload, checks
revision/filename/version/timestamp and basic collection structure, rejects
conflicting revisions or corruption instead of silently selecting older data,
and reports only counts. It does not write files, contact Supabase/FireBoard,
print private food names or claim full shared-validator schema acceptance.
Mac readability/checksum success is a transport gate, not a successful restore.

Four new Python tests pass: Unicode/noncanonical payload hashing and newest
counts, tamper/revision mismatch, corruption without fallback or file changes,
and conflicting/empty recovery folders. CI now runs these checks alongside the
existing four converter tests. Physical Mac retrieval remains untested.

## Physical iPhone save observed

October 11, 2026: the owner confirmed event bridge 2 / SaveFix displayed the
journal and successfully created the synthetic Test ribs cook. The Food box
cleared, Cooking history showed the cook with Open cook, and the status said
Saved on this device. This resolves the observed first-save return-type error
for this test. No private migration or completed-session data was imported.

Next acceptance gate: force-close Scriptable and reopen offline to verify the
saved cook persists; then verify offline action saves and another relaunch.
Independent Mac retrieval of an iCloud recovery file and restoration into an
isolated fresh journal are still required. A visible successful save does not
establish off-device recoverability or readiness to stop Supabase backups.

## Physical save error and return-type correction

Event bridge 1 displayed the journal on the owner's iPhone. Creating Test ribs
left history empty and showed: Failed evaluating JavaScript with error:
JavaScript execution returned a result of an unsupported type. Display is now
observed, but a successful physical-device save has not been observed.

The asynchronous checksum/reseal evaluation previously ended with a Promise
expression. Event bridge 2 ends these evaluations with a primitive string,
while asynchronous completion still carries the validation result. Delivery,
capability and enable evaluations also end with explicit string acknowledgments.
This addresses the reported bridge boundary error without altering journal
files or weakening validation. A failed test save must not be assumed absent
on disk; reopen the journal and inspect recovered history before retrying.

The host regression now executes the actual checksum evaluation in a JavaScript
VM that rejects unsupported immediate return types. It verifies serialized
commits invoke this stricter validator. The browser harness evaluates complete
statement scripts rather than assuming every native evaluation is a single
expression. All 51 JavaScript tests and 4 Python migration tests pass locally. GitHub
regression run `38170984537` passed for code checkpoint
`265f85a8a7f0dfd23c7ae244af24cf1a119ab966`: the same suites, security,
reproducible bundles and both browser regressions including generated
Scriptable save/reopen/cloud retry/corrupt-journal restoration. Native builds
were still running; native application sources were unchanged. Physical iPhone
save/reopen tests remain pending for this correction.

## Event bridge test checkpoint

Code checkpoint: `8dfb1d91df230fc365e038f283504e7764c0b483`.
GitHub regression run `38170521120` passed: 51 JavaScript tests, 4 Python tests,
security checks, reproducible generated files, native mocked browser regression
and the generated Scriptable launcher browser lifecycle/reopen/cloud retry/
corrupt-journal recovery test. Native builds were still running at this report;
native application sources were unchanged by the Scriptable bridge work.

The first event-bridge browser run exposed an initial navigation during HTML
loading. Wake signals are now disabled until startup finishes. Native wake
evaluation is deferred until after the request-policy callback returns; queued
signals are coalesced and scheduled work is canceled on Close. Physical iPhone
presentation and action/save/relaunch behavior are still unverified for this
candidate. Install under the new `LDCookLog-2-EventBridge.js` name to distinguish
it from earlier retries. Do not import private files until device tests pass.

## Event bridge candidate after physical display results

The owner reports A/B/C full-interface checks visible. D displayed the native
LDCookLog heading but no list rows; native UITable fallback is not accepted.
These results establish that the styled full HTML, bundled scripts and content
policy can display when no live bridge runs. They do not establish the exact
cause of the running journal's blank presentation.

The event-bridge candidate removes idle quarter-second evaluation and directly
awaits WebView presentation, without the intermediate startup alert. Browser
operations emit a fixed `ldcooklog-bridge://wake` navigation; the native request
policy blocks it and drains the existing bounded request queue serially. No
cooking payload or credential is placed in a URL. External navigation remains
blocked and the original content policy remains enforced. Startup read and
backup-status requests complete before display. Dismissal stops accepting
signals and waits for any in-flight work; file integrity rules are unchanged.

New tests prove no idle evaluation/timer, serialized wake-driven writes,
blocked external/signal navigation, ignored signals after dismissal, payload
exclusion and queue capacity. All 51 JavaScript tests, 4 Python migration tests
and the security check pass locally. The Chromium integration explicitly mocks
Scriptable's custom-scheme interception; real callback delivery, display and
saving still require the physical iPhone test. Independent iCloud retrieval,
restoration and private-history reconciliation remain release gates.

## Current physical-device blocker and next check

The owner saw all three simple HTML display tests A/B/C. Startup 2 then
showed its native Open journal alert: the full DOM, scripts, checksum APIs
and first journal read passed before presentation. Tapping Open journal
still presented a blank screen with Close. The actual app remains blocked;
no private-history import or backup acceptance is authorized by these results.

`LDCookLog-Interface-Check.js` now isolates four displays without native
storage access: A full styled page without scripts, B the same page with
scripts and policy but no live native bridge, C scripts without the content
policy, and D a native Scriptable UITable. Inputs are disabled. Each screen
asks Visible/Blank, and a final summary records the owner's observations.
No concurrent evaluation/polling runs while presenting these screens. The
policy removal is diagnostic only, not a proposed app security change.

Two probe tests cover the distinct page variants, disabled controls, no file
access, native list fallback and bounded loading. All 49 JavaScript tests,
4 Python tests and the security check pass locally. The full physical-device
probe results and independent iCloud recovery remain outstanding. Basic HTML
visibility and successful mocked browser tests do not prove live app display.

## Work completed

- Retrieved prior development context and the October 11 safety prototype;
  inspected the current Supabase/GitHub Pages/FireBoard architecture.
- Created and committed to an isolated development branch.
- Added native iPhone and separate native Mac application targets, using a
  bundled offline interface and native atomic file storage.
- Added automatic verified recovery snapshots on each save, iCloud retry,
  explicit uploaded/pending/unavailable/failed status, snapshot browsing and
  clean-device restoration. Corrupt primary data is never silently reset.
- Preserved complete relational exports, including all global/unreferenced
  tables, alongside converted cooks and their events/readings. The private
  source archive has not been accessed by this development environment.
- Added cooking/rest/hold/finish workflows, timestamped events, notes and
  evaluations, history search, completed FireBoard session file import and
  two-cook probe temperature comparison graphs. Source units, device identity,
  session IDs, original chart data and legacy relations remain recoverable.
- Added development-only CI, storage/privacy ignore rules, migration/architecture
  documentation and clear owner acceptance steps.

## Verification observed

| Check | Result |
| --- | --- |
| JavaScript regression suite | 30 tests passed locally and in latest GitHub regression job |
| PostgreSQL converter unit tests | 4 passed |
| Native Swift storage, backup failure and cross-format checks | 8 passed in latest GitHub native job |
| Browser UI, lifecycle, offline reopening, corrupt-primary recovery | Passed with a synthetic native bridge |
| Actual iPhone simulator UI/native bridge, save and app relaunch | Passed on implementation checkpoint in run 38161306728, including the strengthened keyboard-focus check |
| Unsigned iPhone application compilation | Passed, including latest revision |
| Unsigned native Mac application compilation | Passed, including latest revision |
| Existing production security regression | Passed |
| Production source/deployment/database code changed | No |
| Real owner-device iCloud upload and restore | Not tested |
| Real private 30-cook / 18-table migration reconciliation | Not tested |

Full passed native/simulator run:
https://github.com/ldintzer-bit/ldcooklog-mobile/actions/runs/38160485720

Latest full verification run — SUCCESS:
https://github.com/ldintzer-bit/ldcooklog-mobile/actions/runs/38161306728

Tests use synthetic data. Simulated iCloud availability/upload state validates
the transport's control flow and verification logic, not Apple's real service.
The iPhone simulator integration is a real WKWebView/native file operation but
does not substitute for an owner's physical-device test or cloud recovery.

One simulator repeat (run 38160626984) failed before typing because the test
did not acquire keyboard focus after WebKit scrolled the food field into view.
The test now waits for journal initialization, explicitly checks keyboard focus
and uses a second center tap if necessary. Execution allowances bound future
test hangs. The corrected check passed in the final full run 38161306728.
The final status commit changes documentation only; application code remains
at the tested implementation checkpoint above.

## Current safe-use conclusion

The replacement is **not yet sufficiently tested to stop manual Supabase
backups or retire the existing app**. No additional manual database backup is
needed merely for the code development completed here. Keep the existing
verified archive. New records entered in the old app after that archive will
require a final fresh export at controlled cutover.

Remaining release blockers are practical signing/installation and iCloud
configuration; physical iPhone offline/restart/restore tests; a recoverable
independent iCloud copy; private-data reconciliation; structured equipment,
preparation and evaluation editing/full production workflow parity; large-history
performance, snapshot retention/quota handling; and real completed-session import.

The Mac and iPhone share recoverable backups, not automatic concurrent edits.
No implicit cloud merge is implemented. Synthetic development cooks must not
be mixed into the reviewed release journal; use a clean reviewed restoration
as part of the guided cutover.

## No-fee route update — October 11

The owner declined US$99/year Apple Developer membership. Paid enrollment is
no longer proposed. A Scriptable-hosted offline prototype now reuses the
cooking/migration interface and portable verified snapshots. Ten additional
storage tests pass locally (40 JavaScript tests total), alongside the four
Python converter tests and existing security checks. The generated-launcher
browser integration test now passes in GitHub CI, including offline save,
reopening, cloud retry and explicit damaged-journal repair. Its Scriptable
host APIs are simulated. The corrected test invokes each evaluated function;
the first attempts failed in the browser harness before operating the journal.

No-fee prototype implementation: `00ce68567ddc4f179e190e4b85007f909e4fa795`.
Corrected browser harness: `c11b5f315d36adeaaeba1a5954b12ae1e5a3a4a6`.
Regression job SUCCESS (40 JavaScript tests, 4 Python tests, security checks,
reproducible bundles and both browser tests):
https://github.com/ldintzer-bit/ldcooklog-mobile/actions/runs/38164795325
The native build/simulator job also completed successfully: eight Swift tests,
both unsigned application builds and actual iPhone simulator save/relaunch.
These results do not validate the actual Scriptable app or real iCloud transfer.

This route stages snapshots in Scriptable's iCloud folder without an owner
developer membership. It cannot confirm completed uploads through the
documented APIs; independent Mac retrieval and recovery remain mandatory.
Actual Scriptable/iPhone runtime compatibility is not tested. The previous
native test results above apply to their stated checkpoint, not this new host.
Read [the alternatives, code and remaining gates](development/scriptable/README.md).

## Owner's next step

Physical-device display probe: the owner confirmed all A/B/C green test pages
were visible. The full app remains unresolved. Startup fix 2 now checks the
full interface, completes the initial journal read before presentation, and
replaces indefinite bridge callbacks with immediate JSON polling/idle timers.
A temporary native startup-2 confirmation identifies the installed version.
Seventeen Scriptable tests pass locally and in GitHub regression CI
(47 JavaScript tests total). The generated-launcher lifecycle/offline/recovery
browser check also passes with startup fix 2 in run 38168958484. The native
job was still running; native sources were unchanged. Confirm
the native startup message and full journal display on the actual iPhone before
any real-data import or backup acceptance.

The startup-fix retry presented a blank page and returned to the editor on
Close without an error. A separate read-only three-page display diagnostic
now distinguishes baseline HTML, blocked-after-load navigation and retained
restricted navigation. It reports owner-observed visibility plus DOM metrics
without reading cooking files. Two new diagnostic tests pass; 45 JavaScript
tests pass locally. Await the actual A/B/C results before another full-app
installation. Scriptable physical-device compatibility remains unresolved.

The first actual Scriptable startup remained spinning without presenting the
interface. Startup fix 1 addresses a likely blocked-initial-navigation cause
and adds bounded startup/capability diagnostics. Thirteen Scriptable tests
now pass locally and in GitHub regression CI (43 JavaScript tests total).
The updated generated-launcher browser integration also passed in run
38167455908. The native job was still running; native sources were unchanged.
The actual-device startup issue
is **not yet confirmed resolved**. Code and regression details are recorded in
`development/scriptable/README.md`; install the reviewed startup fix and
report the interface or exact diagnostic before any private-data import.

Install the free Scriptable app on the iPhone and open it once. Do not buy a
developer membership or import private migration files. Then we will guide
a synthetic offline/reopening/iCloud recovery test. Follow
[`development/OWNER_NEXT_STEPS.md`](development/OWNER_NEXT_STEPS.md).

Implementation, tests, decisions and limitations are detailed in
[`development/README.md`](development/README.md).
