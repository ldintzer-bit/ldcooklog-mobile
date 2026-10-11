# LDCookLog 2.0 — Independent Code Review & Migration Plan

**Review date:** 2026-10-11  
**Live repo:** `ldintzer-bit/ldcooklog-mobile`, `main`, GitHub Pages.  
**Status:** Source inspection and isolated proof-of-concept only. **No changes to the live application or Supabase database; no real user data exported or imported.**

## Objective

An iPhone-first cook logger that opens after months of inactivity, records cooks offline, works independently of either Mac, preserves historical FireBoard data and comparisons, and requires no Supabase or monthly backend subscription. iCloud Drive stores independently restorable backup files. The Mac is optional for administration and history imports. iPad support is not required.

## Source files reviewed

- `index.html` (blob SHA `4b9fe1dda9385986e2b16b97a8f83331e56b67f2`; about 269 KB): UI, current cook, localStorage, cloud auth/sync, rubs, equipment, preparation, evaluations, FireBoard samples, conflict handling.
- `cook-history.js` (blob SHA `536ce6738acef7f4bd7fe9b834748dd7820610be`; about 63 KB): all historical cooks, FireBoard archive, probe roles, graphs, comparisons, test-cook filtering.
- `service-worker.js` (blob SHA `9ff3526a1690d41c88cceec0368a8ceac2ea3105`): network-only shell, deliberately clears prior caches.
- `manifest.webmanifest`: standalone web-app manifest.
- `supabase/functions/fireboard-sessions/index.ts`: authenticated, authorization-checked FireBoard API intermediary; FireBoard token stays on server.
- `SECURITY.md`, `tools/security-check.cjs`, `tools/update-csp.py`, and 2026-10-04 privilege migration: prior security work to preserve.

These are source-code observations, **not** proof that the deployed app, live database, iOS Safari, or FireBoard API were tested end-to-end.

## Risk findings

1. **Historical data export is the immediate dependency.** The existing CSV control exports current-cook event rows, not a full backup of all database tables or temperature samples. The Supabase dashboard has reported no downloadable automatic backup. A full database dump (schema + rows) and restore test are required before decommissioning.
2. **Current localStorage is not a complete history library.** Main state lives under `ldcooklog-mobile-v1-2`, with separate local cook-ID counters and cloud login session. Cook History queries Supabase for past cooks and associated tables.
3. **Offline re-opening is not currently guaranteed.** The service worker deliberately deletes caches and fetches static assets with `cache: 'no-store'`; local recording and offline shell availability are different concerns.
4. **The FireBoard connector cannot be removed without a replacement.** It proxies FireBoard sessions and temperature charts with a server-side token and a separate account authorization table. Do not embed the token in public HTML or JavaScript.
5. **History has special-case migration/test logic.** The code filters test cooks, runs automatic historical test-label cleanup on history reload, stores a set of known historical FireBoard session IDs, and sometimes infers food names from probe labels. Preserve real/test distinction and historical IDs.
6. **Recent incremental changes override older global functions repeatedly.** Modularizing storage and data access behind a tested interface will reduce regression risk.
7. **Existing security controls should be carried forward.** Keep strict rendering via `textContent` or escaping, CSV formula neutralization, no tokens in published files, and migration integrity checks.

## Supabase inventory (from app code and 18-table dashboard)

`cooks`, `events`, `cook_fireboard_sessions`, `fireboard_temperature_samples`, `fireboard_probe_roles`, `cook_meat_pieces`, `cook_preparation`, `cook_evaluations`, `locations`, `equipment`, `cook_equipment`, `rubs`, `cook_rubs`, `cook_methods`, `sauces`, `cook_sauces`, `weather`, `fireboard_account_access`.

**Required before cutover:** compare table counts and foreign-key relationships, preserve UUIDs, events and sample timestamps, remove/label test cooks only with explicit permission, export archived FireBoard session identifiers, preserve unassociated historical data, and verify a full restore. Do not assume all 30 `cooks` rows are real cooks. The `fireboard_account_access` records are authorization metadata, not the upstream FireBoard API token (which resides in server secrets); decide whether to archive/omit that table separately.

## Proposed architecture

1. Preserve the existing UI while gradually substituting a storage adapter.
2. Store historical cooks and time-series data in IndexedDB, with records keyed by durable cook IDs; represent revisions explicitly and refuse silent overwrites.
3. Cache the web-app shell using a versioned service worker for offline reopening. Check offline launch on actual iPhone hardware and after restarting Safari.
4. Export full, versioned, checksum-protected JSON backups; user selects **Save to Files > iCloud Drive** after each cook. Import merges matching data and refuses conflicting IDs. A checksum detects accidental changes; it is **not encryption or an authenticity signature**.
5. Support a temporary one-time Supabase import path to convert the full database. Disable the old cloud connection only after verification.
6. For completed FireBoard sessions, prioritize import from an exported file (which avoids any FireBoard token on iPhone); separately investigate a direct post-session iPhone import without insecure token storage. An optional Mac importer using Mac Keychain is an alternate fallback.
7. Keep GitHub Pages for distributing static app files, subject to confirming offline install behavior; GitHub Pages is not used as the cook database.

## What the isolated prototype contains

- `index.html`, `app.js`, `db.js`, `backup.js`, `service-worker.js`, `manifest.webmanifest`, `icon.svg`.
- Multiple independent locally stored cooks, event capture, immutable ID creation, JSON export and merge-only import.
- Integrity checksum and atomic transaction planning: a conflicting cook ID cancels the whole restore without writing any records.
- Offline asset caching mechanism to test on a supported browser, but iPhone offline behavior **has not yet been verified**.

It does **not** yet import real Supabase records, reproduce all cooking screens, import FireBoard CSV or use iCloud automatically. It is an architecture test, not a production replacement.

## Test results / limitations

- Seven automated functional tests passed for backup validation, tamper detection, conflict refusal, fake IndexedDB adapter CRUD, and re-import behavior. See `npm test`.
- Static checks verify referenced assets and absence of accidental cloud secrets in the prototype.
- Browser integration tests attempted via Chromium/Playwright but the execution environment blocked all local HTTP navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Actual browser IndexedDB and offline/reload tests remain **unverified**.

## Staged transition

**Stage A — preservation (requires authenticated access to Supabase).** Create a complete database dump without putting private cook records or FireBoard credentials in public GitHub. Verify row counts, sample counts, and a restorable copy. Keep Supabase active while migration runs.

**Stage B — full model.** Map existing tables to versioned local cook documents, preserve links, and develop import tests using sanitized samples.

**Stage C — storage and history.** Wire the existing UI and comparison graphs into the tested local adapter. Confirm filters, test flags, events, and attached temperature channels on real data.

**Stage D — FireBoard.** Integrate completed-session CSV/JSON import, session matching, channel identities, and duplicate-safe re-import. Verify on a real exported session.

**Stage E — acceptance.** On the actual iPhone, test after offline restart and after weeks without use; test save-after-cook, real backup-to-iCloud, full restore to a clean second installation, and migration to a new Mac. Recheck security.

**Stage F — cutover.** Retire Supabase and cloud sign-in only after real data, history, and import functionality have been verified. Do not delete the project until a final independent backup is recovered and checked.

## Explicit dependencies on user participation later

1. Access to the authenticated Supabase database (or a safe database dump) for **real** data export; the GitHub code connector does not itself grant database access.
2. A completed FireBoard export file to validate actual CSV format, unless one already exists among provided files.
3. One-time physical iPhone acceptance tests and choice of whether to install the local-first prototype.

There is **no reason** to ask the user to make code edits, run Git commands, or supply passwords to ChatGPT. Never request that API tokens be pasted into chat.


## 2026-10-11 update — first local migration path added

The owner successfully created an iCloud Drive PostgreSQL custom backup: the archive passed `pg_restore` readability checks, all 18 `public` tables appeared in its manifest, and 30 `cooks` COPY rows were counted. This establishes a concrete initial preservation point, **not** proof of full data restoration, iCloud remote sync completion, or retention of unrelated FireBoard-only cloud sessions.

The updated local-only prototype adds an unmerged `migration/convert_dump.py` tool to extract each of the 18 tables with original columns and string/null values into a checksummed relational JSON file. A Mac `.command` helper finds the newest existing `.dump` under `iCloud Drive/LDCookLog Backups`. A separate browser importer maps all Supabase cooks (including test cooks), associated events, FireBoard session links and temperature samples to prototype records, while preserving original rows/IDs in legacy metadata. Conflict-sensitive transactions remain in place.

The converter/importer has **only synthetic-data tests**, not a run against the owner's actual private dump. Do not ask the owner to send, upload, or commit their real dump. The future on-device migration must compare all table counts and sample counts, validate timestamp/unit semantics, independently test the restore and verify associated vs FireBoard-only sessions. Cloud-history-only FireBoard sessions are a separate import stream.

A hard requirement remains outstanding: **a browser PWA cannot reliably and silently synchronize its IndexedDB to iCloud Drive**. The local export button is manual. An iCloud-backed native iPhone app, or a different automatic storage scheme whose restore is proven, is needed before declaring that backups are automatic. This is a design decision; don't imply the proof-of-concept already meets it.
