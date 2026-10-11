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
credentials, or remotely loaded UI. A Mac Catalyst administration build is
configured; no iPad interface is targeted.

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

The production UI has much more functionality. Evaluation/preparation/equipment
editing, complete historical comparison charts and standalone completed FireBoard
session import are still required. Historical imported tables are preserved even
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
