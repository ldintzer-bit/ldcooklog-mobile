# LDCookLog 2.0 — isolated storage prototype

This is **not** the production LDCookLog app and does **not** contain or migrate existing cooks. It demonstrates local IndexedDB, multiple persistent cooks, offline web-app shell caching, checksum-protected JSON export, and atomic merge-only import. No connection to Supabase or FireBoard is made.

Run `python3 -m http.server 8000`, open `http://localhost:8000/`, and create a test cook. Export its backup and restore it; unchanged records are skipped. For an independent restore test, run with a new browser profile or install on a second device and import the saved backup. Serve over HTTPS when testing on iPhone.

**Known limitations:** No production schema mapping or FireBoard CSV import yet. iCloud Drive storage requires the user to save the exported file via Files or Share. Service worker/IndexedDB data can be cleared by the operating system; never treat local data as the only copy. A basic SVG icon is used for desktop testing; iOS may require appropriate PNG icons for a polished Home Screen installation. No automatic synchronization across devices. Do not put this prototype in the production app path or promote it until data migration, restores, offline iPhone behavior, and security are tested.

The backup SHA-256 checksum detects accidental alteration; it is not an authenticity signature or encryption. Backups are plaintext JSON; keep them in your private iCloud Drive.

Run `npm test` to execute the Node regression tests. A separate Playwright test runner exists for environments permitting localhost access; it could not run in the current execution environment because browser navigation to localhost was administratively blocked.

See `REVIEW_AND_ROADMAP.md` for the complete independent review, migration sequence, and data-safety caveats.

## One-time historical migration (development only)

The `migration/convert_dump.py` tool reads the existing PostgreSQL custom-format `.dump` with the locally installed `pg_restore`, retains **all 18 public tables, rows and column values**, and writes a checksum-bearing private `.relational.json` file beside it. It never connects to Supabase. The original `.dump` remains untouched. On a Mac, `migration/Create LDCookLog Local Migration.command` selects the most recent `LDCookLog_*.dump` in the known iCloud backup folder. This helper is for a controlled future migration, **not something the user needs to run today**. To require the historically verified 30 rows when testing that exact snapshot:

`python3 migration/convert_dump.py "/path/to/LDCookLog_...dump" --expected-cooks 30`

The prototype restore control recognizes both its own local-backup format and this relational JSON. The converter and importer are tested on **synthetic records only**; **the real dump was not supplied to the development environment and has not been imported or verified end-to-end.** The importer retains test cooks, original identifiers, metadata, associated events, sessions, and their readings. Standalone historical FireBoard cloud sessions **not linked to a cook** are not included in the Supabase export. Other global lookup rows and FireBoard authorization metadata remain in the relational JSON, not necessarily in converted cook documents.

**Security:** Neither `.dump` nor `.relational.json` belongs in the public GitHub repo or an issue/PR. The relational JSON is plain text, not encrypted. Keep the original PostgreSQL dump and verify restored data counts before any cutover. Do not rely on this prototype for regular cooking until the production UI, real-data migration, actual iPhone offline behavior, and recoverable iCloud backups are proven.

Run `python3 -m unittest discover -s migration -p 'test*.py'` for converter regression tests; `npm test` covers IndexedDB adapter, migration checksums, and sample history conversion.

**Automatic iCloud backup limitation:** This browser-based proof of concept cannot silently write to iCloud Drive on iPhone. IndexedDB plus an occasional downloaded JSON file does **not** meet a requirement to never manually back up. A reliable automatic iCloud strategy (for example a properly installed native iOS app with entitlement-enabled iCloud storage) must be chosen and verified before the system can be declared safe without manual backups.

Read **STATUS_AND_HANDOFF.md** for the current go/no-go and the remaining user decisions.

If the interim Supabase app records more cooks before cutover, `migration/Create Fresh Supabase Backup.command` reduces repeating the manual database-backup commands to one double-click and a 1Password password paste. It must be run on the already configured Mac while the project is reachable. It is not automatic, and has not been tested live.

## October 11 migration safety improvements

- Import now audits cook-owned child tables for orphaned rows, and FireBoard samples for missing linked sessions, **before any writes**. If relationships are inconsistent, the migration stops without changing the existing archive or the local cook database.
- After conversion, import reconciles converted event and temperature counts against the original relational table counts. Unaccounted-for readings prevent import.
- Synthetic load test migrates 30 cooks with 18,000 temperature samples and 18 tables, with exact count verification.
- Weather records may exist without a cook link. They remain in the relational JSON source; global reference/configuration tables are not yet in the permanent local schema. This prototype must not be treated as a complete migration of *all* 18 tables until that additional storage is implemented and restore-tested.
- **Do not attempt production use**; no unattended iCloud backup or real-device recovery has been demonstrated. The current verified PostgreSQL archive remains the protected reference.
