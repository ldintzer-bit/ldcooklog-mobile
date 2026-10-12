# LDCookLog 2.0 — development checkpoint, October 11, 2026

Branch: `development/2.0-offline-recovery`.
Implementation checkpoint: `a5cbb179acf68a3f4ca3d0023df07b8b0c44a2e6`.
Production `main` remains `e0ba05f6043b15d79a9ac053002137366a1105c3`.
No production merge/deployment, database changes, private-history upload,
backup upload or credential publication was performed.

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
