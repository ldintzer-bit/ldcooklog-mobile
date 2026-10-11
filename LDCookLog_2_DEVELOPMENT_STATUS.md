# LDCookLog 2.0 — development checkpoint, October 11, 2026

Branch: `development/2.0-offline-recovery`.
Implementation checkpoint: `a5cbb179acf68a3f4ca3d0023df07b8b0c44a2e6`.
Production `main` remains `e0ba05f6043b15d79a9ac053002137366a1105c3`.
No production merge/deployment, database changes, private-history upload,
backup upload or credential publication was performed.

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
expression. All 51 JavaScript tests pass locally. GitHub browser regression and
physical iPhone save/reopen tests remain pending for this correction.

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
