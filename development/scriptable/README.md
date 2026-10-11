# No annual developer fee: Scriptable recovery prototype

Decision, October 11, 2026: the owner declined US$99/year Apple Developer
membership. Paid membership is no longer the proposed installation route.
This directory experiments with an existing App Store host, Scriptable, while
retaining the tested migration/recovery format and cooking interface.

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
