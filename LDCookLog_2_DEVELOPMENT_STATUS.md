# LDCookLog 2.0 — development checkpoint, October 11, 2026

Branch: `development/2.0-offline-recovery`.
Implementation checkpoint: `a5cbb179acf68a3f4ca3d0023df07b8b0c44a2e6`.
Production `main` remains `e0ba05f6043b15d79a9ac053002137366a1105c3`.
No production merge/deployment, database changes, private-history upload,
backup upload or credential publication was performed.

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

## Owner information now needed

Determine whether an Apple Developer Program membership/team is already
available. This determines a viable native iCloud installation route. Do not
purchase a membership or disclose credentials. Follow
[`development/OWNER_NEXT_STEPS.md`](development/OWNER_NEXT_STEPS.md).

Implementation, tests, decisions and limitations are detailed in
[`development/README.md`](development/README.md).
