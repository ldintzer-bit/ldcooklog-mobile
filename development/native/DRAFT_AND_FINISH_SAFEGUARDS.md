# Draft and finish safeguards

Cook Finished requires an explicit Finish cook confirmation. Cancel is initially
focused in Scriptable and the native host. Entering a new finish time in setup
also requires confirmation. Cancel leaves the journal, events, revision, recovery
snapshot count and drafts unchanged. Accepting uses the existing single cooking
save; unfinished transitions remain protected by the store's queue.

Draft edits to New cook, setup (including probes/meat pieces/rub details), action
notes, targets, wrap details and evaluation are saved to a separate private local
cache. Wait for “Drafts saved on this phone” before closing. These edits do not
change cooking history, journal revisions, iCloud snapshots or Mac verification.
Tap the appropriate Save button to commit the edits and include them in backups.
Only a successful save clears that form's draft; other forms remain recoverable.
A journal restore explicitly discards drafts after its existing confirmation.
Discard unsaved drafts also requires explicit confirmation and keeps cooking data.

Startup includes drafts in the existing first local read, avoiding an additional
pre-presentation bridge request. No browser localStorage or cloud connection is
required. Device-local drafts do not recover on a replacement phone: commit edits
with Save for normal iCloud/independent-Mac recovery protection.

The checksummed cache is bounded to 2 MiB, 200 form drafts, 2,000 fields per form,
and the existing input limits. Up to three recent private copies are retained.
An empty successfully verified cache removes prior draft copies. Cleanup failure
cannot grow beyond ten copies without a visible protection error. The working and
restore-test namespaces are isolated. Partial/failed writes preserve prior copies;
an unreadable/corrupt latest copy can use a validated older copy with a warning.
All-damaged copies stop automatic overwrite and show a warning; saving edits to
the journal remains possible. Explicit discard can clear a damaged cache.

Drafts are bound to the saved form's metadata. Stale saved-state drafts are skipped
on reopening, preventing old drafts from undoing committed edits. In-session
untouched start/finish fields follow actual cooking transitions; typed corrections
remain edits. Acknowledged successful saves rebase remaining unrelated drafts.
New-cook drafts also bind to the set of existing cook IDs, avoiding duplication
of a cook already created. The UI never reports a cooking snapshot for a draft.

Automated checks cover cache integrity, Unicode/blank/checkbox values, malformed
and oversized drafts, prior-copy recovery, failed-write preservation, local-only
storage, namespace isolation and bounded retention. Browser checks cover cancel
and accepted finish, unchanged recovery bytes on Cancel, private setup/action/
review drafts after offline reopening, and per-form clearing after successful saves.
Physical acceptance of these new safeguards on the owner's phone is still needed.
