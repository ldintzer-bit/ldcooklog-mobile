# LDCookLog 2.0 — Progress and safe-use status

**Date:** 2026-10-11

## What can be used today?

- **Current Supabase-backed LDCookLog:** remains the only operational full cooking app. No deployment, database, or GitHub `main` changes were made by this work. It may continue to be used, but any new cooks entered after the verified 30-cook database snapshot will **not** be in that snapshot. A fresh final export will be required before the old database is retired, and new data remains subject to the present Supabase service and account setup.
- **iCloud Drive PostgreSQL archive:** owner reports one readably extracted archive with 18 public table data entries and 30 cook rows, found in iCloud Drive. No actual restore to another database, other-table record counts, remote iCloud availability or standalone FireBoard cloud inventory has been independently verified.
- **Prototype:** isolated **development** app only; do not use it for a real BBQ cook until the iPhone and end-to-end storage tests are complete.

## What has now been developed?

1. Local-only `.dump` to relational JSON converter, retaining public tables and original PostgreSQL field values, with SHA-256 archive checksum and restrictive file permissions. The original .dump is never overwritten.
2. Two independent double-clickable Mac `.command` helpers: one reads the newest existing backup and makes migration JSON; a second makes a **new** Supabase `.dump` and verifies it if an interim cook requires another snapshot. The latter still needs the database password from 1Password and an active Supabase connection. It is **not a recurring backup** and is not yet needed.
3. Browser-side relational JSON verification, all-cooks conversion, stable original UUID preservation, event conversion, known FireBoard temperature unit preservation, raw joined relation retention, and no silent deletion of test cooks.
4. Import refuses hash mismatches and duplicate conflicting IDs, and relies on a single IndexedDB transaction for all additions.
5. Cached offline application shell, local cook storage and independent JSON backups in the isolated proof of concept.
6. 18 Node automated tests and 4 Python tests passing. Additional Python → JS SHA-256 cross-format fixture verified. **No real data or live iPhone tests have been run.**

## What is not done — do not call the system independent yet

- Complete production UI and cook lifecycle (current POC has limited event entry only).
- Production history/comparison graph implementation and all 18-table lookup relationships mapped into the replacement app.
- Standalone FireBoard cloud session access: historical FireBoard sessions absent from linked `cook_fireboard_sessions` will not magically appear after Supabase cutover. A completed-session import route remains necessary.
- Automatic iCloud backup and proven recovery. Safari/iOS PWA code cannot reliably write its IndexedDB to an iCloud Drive file unattended. Manual backup export does **not** meet the requirement to avoid repeating backups. An iCloud-capable native app or separately validated automatic backup architecture is needed.
- Tested restore of the owner's private backup to a clean second device; verification of associated events and temperature counts.
- Confirm remote iCloud upload completed (seeing a file in Finder is not absolute proof of cloud synchronization).
- Update any saved GitHub Actions `SUPABASE_DB_PASSWORD` secret whose value became stale when the owner reset the Supabase DB password. Do not ask the owner to disclose the secret in chat.

## Next actions once the owner is needed

1. Agree on the long-term automatic iCloud storage approach. If an actual native iOS app is chosen, installation/signing requirements must be decided first; a browser-only prototype is not a subscription-free automatic iCloud backup solution.
2. Only when prepared for a controlled real migration, run the bundled converter locally against the private `.dump` using the double-click helper. Compare every table count and the 30 known cook IDs against the archived source without exposing private records online. Do not upload `.dump` or `.relational.json` to a public repository.
3. Test on the owner's actual iPhone, including airplane mode reopening, editing, closing, device reboot/reinstall, and restoring from an independently retrievable copy in iCloud.
4. Verify all real/test cooks, events, sessions, charts, channels, units and historical comparisons.
5. Perform one final fresh Supabase export at cutover if any new cooks were entered after the snapshot. Retire Supabase only after repeatable real-data restore and backups have been demonstrated.

## Easier interim backup if another cook happens

If needed before migration, `migration/Create Fresh Supabase Backup.command` is a single Mac double-click backup helper. It asks for the existing database password (from 1Password), saves a new uniquely named `.dump` to the same iCloud Drive folder, verifies the archive and table count and checks the cook count has not fallen below the known 30. It never overwrites the existing backup. It still involves a manual step; it is **not** automated iCloud backup. The script has been syntax-checked, **not** exercised against the live database.

## October 11 — follow-up safety patch

- Audited migration of rows before importing: missing cook parents or FireBoard session parents now cause a clear stop instead of dropping data.
- Added post-conversion reconciliation: every event and temperature sample from the relational archive must be represented in the migrated cooks.
- Added an artificial volume test: 30 cooks, 18,000 FireBoard temperature readings, all 18 declared tables, and one explicitly marked test cook. All record counts remain consistent.
- Current verification: **18 JavaScript + 4 Python automated tests passed**. This is test data only; the user's real .dump remains unopened.
- Current cloud-backed production app, database, GitHub main branch and GitHub Pages were not altered.
- Future safety condition: iPhone backup must be independent of browser-local storage, with demonstrably recoverable iCloud copy. Prototype's download-and-save backup is manual only and does not satisfy the owner's requirement.
