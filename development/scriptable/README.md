# No annual developer fee: Scriptable recovery prototype

Decision, October 11, 2026: the owner declined US$99/year Apple Developer
membership. Paid membership is no longer the proposed installation route.
This directory experiments with an existing App Store host, Scriptable, while
retaining the tested migration/recovery format and cooking interface.

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

## Alternatives considered

| Route | Costs and maintenance | Backup suitability |
| --- | --- | --- |
| Native iPhone app with owner developer membership | Annual developer fee; declined | Strongest access to iCloud upload status; retained as development work only |
| Free Xcode Personal Team | Reinstall after seven days | Current native iCloud integration is unavailable; unsuitable for routine cooking |
| Safari/Home Screen web app alone | No developer fee | Offline storage works, but browser storage is not an independent iCloud recovery copy |
| Web app with a Mac backup service | No developer fee, but Mac service/security/availability required | Possible; weak when the Mac is asleep or unreachable |
| Scriptable host | Currently free download with optional purchases; no owner developer membership | Documented local and iCloud files plus offline WebView; selected for a feasibility test |

This is a recommendation for testing, not a proven production replacement.
Scriptable remains a third-party dependency. Its future pricing, availability,
OS compatibility and runtime behavior are outside this project's control.

## Implementation

- `LDCookLog-2-Development.js` is a self-contained generated script. No network
  fetch, login, database connection, dynamic code update or credential is used.
- The bundled interface uses the shared migration, SHA-256 verification,
  cooking events, evaluations, completed FireBoard imports and comparisons.
- Local app Documents hold immutable full snapshots. There is no overwriteable
  primary journal; the newest revision is verified on read. Bad newest data,
  missing previously initialized data or same-revision conflicts stop opening
  rather than quietly choosing an older or empty journal.
- Explicit repair writes a new revision and preserves damaged files as evidence.
- iCloud copies are immutable, in device-specific directories under
  `iCloud Drive/Scriptable/LDCookLog-2-Development-Recovery/`. Retries occur
  after actions, on reopening and periodically while the interface is active.
- Scriptable does not document an upload-completed API. Locally readable cloud
  files are **staged, not confirmed uploaded**. UI always reports zero confirmed
  uploads on this route. Independent retrieval/restoration is required.
- Private data must never enter GitHub. Shared scripts contain only code, and
  app data lives separately from the script. No application-level encryption
  or automatic multi-device editing/merge is implemented.

## Verification and limits

Physical-device attempt on October 11: the initial script remained spinning
before showing an interface. The original launcher rejected every navigation
before `loadHTML`, a likely cause of an unresolved load promise. Startup fix 1
allows only its initial offline base/about:blank navigation, then blocks all
navigation after load. It adds 15-second load/bridge startup deadlines and
checks for required bundled scripts and secure checksum/UUID APIs. Failure
shows the build ID and stage in an alert before journal storage initializes.
The cause and remedy still require confirmation on the actual device.
Three startup regression tests cover blocked/hung load, hung capability check,
and absent scripts/crypto. The browser mock now checks navigation decisions.

The physical-device retry displayed a blank page with Close and no diagnostic.
`LDCookLog-Display-Check.js` is a separate, read-only rendering probe. It opens
three green pages: A is the documented plain HTML baseline; B reproduces the
base URL/pre-presentation JavaScript and subsequent all-navigation block; C
retains the restricted initial URL allowance through presentation. The user
reports visible/blank for each, with pre-presentation DOM size for B/C. It never
opens cooking files or sends requests. Two simulated tests validate the probe's
decisions, summary and bounded failure behavior. Actual results are pending;
no cause or physical-device remedy is yet confirmed.

Owner confirmed all three green diagnostic pages were visible. Basic HTML
rendering, base-URL loading, pre-presentation inspection and the two navigation
policies therefore work for those small pages on the actual device. That does
not validate the full interface or bridge. Startup fix 2 checks the full
interface's known DOM elements, completes its initial journal read before
presentation, and uses synchronous JSON request polling with a 250 ms idle
timer instead of leaving a native callback pending indefinitely. The initial
URL allowance remains restricted throughout presentation. A temporary native
`startup-2` confirmation identifies the running build and initial journal
state before display. Two bridge tests cover idle returns, FIFO replies,
error propagation, duplicate rejection and queue capacity. Real full-interface
display/save on the owner device still requires confirmation.

Ten filesystem tests cover reopening, immutable history, stale writers,
checksum failure, partial writes, corruption/repair, missing files, competing
revisions, cloud outage/retry, damaged older snapshots and cloud corruption.
They use real temporary files and simulated Scriptable FileManager APIs.

The browser integration test executes the generated launcher and shared
interface, exercising the queued bridge and filesystem adapter. Scriptable's
WebView/FileManager APIs are simulated: it cannot establish actual iPhone
compatibility, file picker behavior, Web Crypto support or iCloud transfer.

Unresolved: physical iPhone compatibility/restart/force-quit recovery, secure
Web Crypto in Scriptable's loadHTML context, independent cloud retrieval and
fresh-device restore, large-history memory/performance, snapshot quota and
retention, full feature parity, and private 30-cook/18-table reconciliation.
No atomic exclusive-create API is documented by Scriptable. This prototype
detects competing revisions but cannot guarantee cross-process locking. Run
one instance only. App removal can destroy local files. iCloud copies may not
have uploaded while offline; this is not a guarantee against offline device loss.

## Owner's first step

Install the free Scriptable app on your iPhone and open it once. No purchase or
Apple Developer enrollment is needed. Do not import private cooking files yet.

After confirming installation, we will guide downloading the reviewed
`LDCookLog-2-Development.js` file into iCloud Drive's Scriptable folder, opening
it in Scriptable and creating a synthetic cook. Run it inside the app, not as
a widget or a Shortcuts extension. A Home Screen launcher can follow acceptance.

The existing Supabase app and verified PostgreSQL backup remain in service.
Only after independent restoration and all data/feature gates pass will we
state that further manual Supabase backups can stop.

## Rebuild / tests

```sh
python3 development/native/bundle_web.py
python3 development/scriptable/build.py
node --test development/scriptable/tests/*.test.mjs
NODE_PATH=/path/to/playwright/node_modules node development/scriptable/tests/ui-smoke.cjs
```

Official references checked October 11, 2026:

- https://apps.apple.com/us/app/scriptable/id1405459188
- https://scriptable.app/
- https://docs.scriptable.app/filemanager/
- https://docs.scriptable.app/webview/
- https://docs.scriptable.app/uuid/
- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://developer.apple.com/help/account/membership/program-enrollment/
- https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/
- https://webkit.org/blog/14403/updates-to-storage-policy/
