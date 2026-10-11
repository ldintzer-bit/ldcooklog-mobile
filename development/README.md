# LDCookLog 2.0 development — 2026-10-11

Production baseline: `main` commit `e0ba05f6043b15d79a9ac053002137366a1105c3`.
Work branch: `development/2.0-offline-recovery`. No merge, production deployment,
Supabase changes or private-data upload is authorized by this work.

## Existing architecture and recovered work

Production is a GitHub Pages HTML/JavaScript application. Its cloud cooking
records use Supabase REST; FireBoard access runs through a protected Supabase
Edge Function. Browser storage and a service worker provide some offline
behavior, but neither is an independent recoverable cloud backup.

`local-poc/` preserves the October 11 migration safety prototype supplied in
the previous project archive: PostgreSQL converter, original limited UI,
18 Node tests and 4 Python tests. Its status reports are historical. Native
development below supersedes its automatic-backup roadmap, not its warnings
about real-data acceptance. The private owner archive has NOT been opened.

## Implemented in this branch

`native/` is an isolated iPhone app shell using a bundled local UI and native
file storage. It has no Supabase dependency, network JavaScript, FireBoard
credentials, or remotely loaded UI. A separate native macOS administration companion is
configured with the same recovery format and iCloud container; no iPad target is included.

- Preparation, cooking, resting, keep-warm, finished states and timestamped
  events; food/cooker history filtering; retained historical temperature data.
- Every successful change first writes and verifies an independent immutable
  snapshot, then atomically replaces the current native document. Serialized
  writes and revision checks protect against stale saves.
- Backups retain the complete relational source export, including global
  lookup/configuration rows, plus converted cooks. This fixes the gap where
  the earlier per-cook backup omitted unreferenced global table rows.
- SHA-256 over the exact payload string is portable across Swift/JavaScript
  without relying on JSON key-order or Unicode serialization conventions.
- Corrupt or missing primary storage stops normal work instead of resetting
  history. Snapshot selection, verification and explicit restoration remain
  available; earlier snapshots are retained.
- iCloud writes separate snapshot files per installation, retries after saves,
  while the app is active and on foreground return. It reports unavailable,
  pending, and confirmed-uploaded copies distinctly. Upload failures do not
  roll back a successful offline cook save.
- Development CI runs recovered regression tests, native storage XCTest,
  reproducible UI bundling, production security regression and unsigned
  iPhone simulator compilation. It contains no deployment or secret access.

## Important decisions and limitations

The native approach enables iCloud file I/O that Safari cannot reliably perform
unattended. iCloud container entitlement, Apple signing/team selection, and
device installation have NOT been configured for the owner. Do not assume a
free Personal Team can sign the iCloud-capable build. Confirm current Apple
Developer membership/capabilities before choosing the installation route.
No subscription purchase or registration is authorized or required now.

Cloud snapshots are recovery copies, not automatic multi-device merging.
The Mac can explicitly restore a copy to inspect/administer history. Concurrent
editing on separate devices requires later conflict/merge work. All snapshots
are retained in this milestone; pruning, storage quota handling and large-history
performance must be assessed before release. Each save copies the full journal.
Snapshots have integrity checks, not app-level encryption; protect the Apple
account/device and avoid sharing the backup folder. SHA-256 detects accidental
damage, not deliberate modification by someone able to replace file and digest.

The production UI has much more functionality. Structured preparation/equipment/evaluation
editing and full production comparison parity are still required. Free-text reviews,
two-cook temperature charts and completed-session file import are implemented. Historical imported tables are preserved even
where the new UI cannot edit/display every field yet. Native WKWebView uses an
ephemeral web store: primary cook data is outside browser storage.

The app only retries while running/foregrounded. iOS may suspend an offline app;
pending backups cannot be guaranteed to upload before the device is lost. The
UI must never call local-only or merely queued data safely backed up.

## Release gate — manual Supabase backups cannot yet stop

Use the operational Supabase app until ALL checks below pass:

1. Native build compiles and runs on the owner's iPhone with valid long-lived
   installation/signing and functioning iCloud configuration.
2. The private archive's 30 known cooks and ALL 18 table counts reconcile;
   all IDs, events, equipment, evaluations, FireBoard links/readings, units,
   test cooks and comparison results are reviewed. No source row silently lost.
3. Airplane-mode launch, events, finish, restart/reboot and offline edits work.
4. A save while offline produces pending status; reconnect/reopen produces
   confirmed upload; iCloud unavailable/quota/error cases remain clearly visible.
5. The independently uploaded backup is retrieved on the Mac or a second clean
   installation and restores exact history. Device loss/reinstall recovery passes.
6. Completed FireBoard import and complete cooking/comparison workflows pass.
7. If Supabase changed after the verified archive, create one final fresh export
   at controlled cutover. Approve production adoption explicitly. Retire Supabase
   only after reproducible recovery, without relying on the old database.

Only then can the replacement be described as safe to use without additional
manual **Supabase** backups. Until then, new production records remain subject
to the existing backup process. The old 30-cook archive remains valuable.

## Local checks

From the repository root:

```
node --test development/local-poc/tests/*.test.mjs development/native/tests/*.test.mjs
python3 -m unittest discover -s development/local-poc/migration -p 'test_*.py'
python3 development/native/bundle_web.py
node tools/security-check.cjs
```

On a Mac: `cd development/native && swift test`. Xcode project generation and
unsigned simulator build commands are in the development workflow. Do not run
production Supabase deployment workflows as part of this development.

## Next owner participation (only when the build is ready)

First determine whether an Apple Developer Program membership is already
available. Do not send passwords, keys, .dump files or private JSON to GitHub.
If a suitable team exists, select it in Xcode Signing & Capabilities and register
the development-only iCloud container. Follow a guided synthetic-data iPhone
test before converting/importing the owner's private archive. If no suitable
team exists, choose an acceptable installation/backup route before spending.

Technical references: Apple's FileManager ubiquity container and coordinated
file APIs, WKScriptMessageHandlerWithReply, and Apple Developer membership docs:
https://developer.apple.com/documentation/foundation/filemanager/url(forubiquitycontaineridentifier:)
https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply
https://developer.apple.com/help/account/membership/programs-overview

## Completed-session import and comparison milestone

The native UI now accepts a completed-session JSON exported by
`native/export_completed_fireboard.py`. The local helper fetches one session and
its chart directly from FireBoard, using a token entered invisibly in memory.
It does not read Supabase, write credentials, allow redirects with credentials,
overwrite exports, or permit output inside a Git checkout. This helper has NOT
been exercised against the owner's live FireBoard account. The API's documented
17-requests-per-five-minutes limit applies across other simultaneous clients.

The importer preserves the original session/chart, converts seconds or
milliseconds to timestamps, retains Celsius/Fahrenheit units and device/probe
identity, refuses incomplete/mismatched/unknown-unit series, and prevents
duplicate/conflicting attachment. Imported legacy session collisions stop for
inspection. Null/malformed values stop the whole import instead of silently
losing readings; the original file remains available for investigation.

Historical two-cook graphs align on cook start and convert Celsius to Fahrenheit
for display. Choose each probe explicitly; duplicate labels on distinct devices
remain separate. All readings stay in storage; the plotted curve is sampled
for rendering (up to 601 points/series) and is not a statistical summary.
Test cooks remain in history and backups but are excluded from comparison choices.
Cook notes and free-text evaluation can be saved after finishing; structured
legacy evaluations stay intact in the relational archive.

Current local results: 28 JavaScript tests and 4 Python tests pass, including
synthetic full-table recovery and completed-session safety checks. GitHub run
38159884503 passed the original 23 JavaScript tests, 4 Python tests, 5 native
storage XCTests and unsigned iPhone simulator compilation. The expanded UI
integration checks are being run separately and must not be inferred from that
first compile-only result.

## Backup failure hardening

The native iCloud transport is independently testable with injected cloud
availability/upload status. Tests simulate offline queueing, pending versus
confirmed uploads, immutable versions, invalid snapshot tokens, damaged old
local copies, and changed remote copies. An old corrupt snapshot is reported
without blocking new backups. An uploaded file counts only after its bytes and
checksum match the original local snapshot. These are simulated file/status
conditions; actual iCloud transfer still requires the owner's devices.

## Native Mac companion and cross-runtime integrity

A separate macOS SwiftUI/WKWebView target replaces the initial Catalyst
configuration, keeping the iPhone target independent of iPad support. Both apps
use the same native recovery package, bundled UI and iCloud container; sharing
history is through explicit snapshot restoration until safe merging is added.

The cross-format test generates a synthetic Unicode-rich snapshot in JavaScript,
saves/reopens it through the actual Swift store, and verifies it again in
JavaScript. CI now compiles both native targets and launches the iPhone app in
a simulator to exercise the real WKWebView/native bridge. Neither unsigned
build validates owner signing or live iCloud access.
