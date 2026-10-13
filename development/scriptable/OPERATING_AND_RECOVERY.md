# LDCookLog 2.0 Scriptable: operation and recovery

Development candidate. Owner phone tests cover historical migration/restoration,
offline reopening, lifecycle events, notes/evaluation/setup, method/equipment
choices, temperature comparisons, completed-session import and duplicate
protection. Physical Mac and isolated phone retention rehearsals passed.
Actual phone loss/reinstall/new-device recovery and full production cutover
remain unverified. On October 13 the owner also verified resumed real scheduled
backup of revision 8 after the overnight interval. Backup evidence supports a
controlled real-cook pilot; the application remains a development candidate.
Routine manual exports of unchanged Supabase data are unnecessary. Keep the
original PostgreSQL archive permanently.

## Use the correct script

The working journal is `LDCookLog-2-Backup-Status` in Scriptable. The restore trial
and retention rehearsal scripts are separate tests. Script names do not define
storage namespaces: the working script uses the development journal. Never
rename or delete cooking-data folders to troubleshoot an issue.

## Every save and independent protection

Every successful save creates an immutable local full-journal snapshot. Open
Recovery protection to stage it to Scriptable iCloud. Once it reaches the Mac,
the installed agent validates and copies it outside iCloud every five minutes
while the Mac is awake and the owner is signed in.

Look for `Mac independent copy verified for this revision`. That requires the
exact current revision/checksum and a report no older than 15 minutes. Scriptable
still displays uploaded zero/unconfirmed because its API does not prove upload.
A pending/stale report means current independent protection is unconfirmed;
local saves remain available. Wake/connect the Mac and reopen or Check / retry
iCloud on the phone. Rehearsal PASS messages are not real-backup status.

Mac status check:

```bash
python3 "$HOME/Downloads/LDCookLog-Mac-Recovery.py" --status
```

If it fails, keep all files and report the controlled error. Do not reinstall
Scriptable, delete journals, bypass checksums or disable TLS verification.

## Storage and retention

Phone cleanup needs a fresh matching Mac report and valid staged bytes. It keeps
first/newest 20 and original-archive representatives. A 128 MiB local warning is
a soft warning, not a save prohibition. Cleanup runs while Scriptable is open.

Mac snapshot budget is 1 GiB. First/newest three and a representative of every
original database archive are mandatory. Prefer 30 recent and 12 monthly points;
optional older copies can be removed after replacement has been verified.
Required copies exceeding the budget or inadequate disk space stop copying.
Warnings begin at 80%. Original database exports are outside this pruning policy.

## Recover from an independent Mac copy

Copies are in `~/Library/Application Support/LDCookLog/Verified Recovery` in a
device-ID folder. Keep the original there. Copy the chosen latest recovery JSON
privately into iCloud Drive / LDCookLog Backups (or transfer privately to Files).
In the intended journal, use Migration or recovery file and confirm the cook
count before Restore recovery copy. This replaces that journal's current state;
older retained snapshots stay available. First rehearse in the separate restore
trial when investigating a problem. Do not attach private backup files to chat
or GitHub. Checksums validate the bytes; inspect restored cooks/readings too.

On a replacement phone, install Scriptable with the same iCloud account and the
reviewed working script. Recovery snapshot browsing supports other device IDs.
A physical replacement/reinstall with complete private history has not yet been
accepted; do not erase the working installation to test it.

## Completed FireBoard sessions

Use the updated private Mac exporter. On macOS it automatically loads the
existing system certificate file when no explicit certificate setting is supplied.
Older downloaded versions can still use the verified SSL_CERT_FILE workaround:

```bash
SSL_CERT_FILE=/etc/ssl/cert.pem python3 "$HOME/Downloads/LDCookLog-FireBoard-Export.py" --interactive
```

Enter credentials only in Terminal, choose the list number before the first
period, then select the resulting private JSON under Attach completed FireBoard
session in the intended cook. Credentials are not saved in exports. Reimporting
the identical session into that cook does not duplicate readings. Live
monitoring stays in the FireBoard app. To align an imported older session's
chart, set the cook start date/time to the appropriate original cook start.

## Supabase and the original archive

The owner confirms no real source cooks changed after the October 11 backup;
no additional export is needed for unchanged data. If the original Supabase app
is used again, its changes are not backed up by this offline journal and must be
reconciled before any cutover. Keep the verified original dump and relational
export. No Supabase deletion, production merge/deployment or everyday-use
cutover is authorized by a rehearsal alone.

## Compare up to four cooks

Open a historical cook with temperature readings. Select its probe, then choose
up to three other cooks and a probe for each. Food, cooker and date identify each
choice; the legend identifies the trace and reading count. Duplicate cooks and
test cooks are excluded from additional comparison choices. History filtering
keeps selections while the app remains open. Closing/reopening resets these
viewing preferences. Plots align to cook start and display Fahrenheit; original
units and all readings remain retained in the journal and its backups.

## Mac failure notifications

After updating the managed helper, standard scheduled failures request a local
Mac notification. A later successful scheduled copy requests a recovery notice;
storage above 80% requests a warning. macOS settings/Focus control whether these
are shown. Existing installations must receive the helper update; a source
commit alone does not update the running agent. Continue using Recovery
protection as evidence for the current revision. Notices contain no private
cooking information and do not go to anyone else. No routine Terminal checks
are required when current Mac verification appears in the phone journal.
