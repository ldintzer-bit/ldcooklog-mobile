# Mac verified recovery copies — development acceptance

The owner has completed private source reconciliation of both the working and
isolated restored journals. This helper adds independent local copies of the
working iPhone journal after Scriptable iCloud staging reaches the Mac.

Run the reviewed generated `LDCookLog-Mac-Recovery.py` with `python3`:

- No arguments: validate and copy the latest working recovery snapshot once.
- `--install`: prove a copy, install a per-user LaunchAgent, check at login and
  every five minutes while the Mac is awake and the owner is signed in.
- `--diagnose`: read/validate current iCloud snapshots from Terminal, without
  copying, installing or changing source/status files. Filesystem failures
  report only a controlled operation, exception class and errno.
- `--status`: require a scheduled execution within 15 minutes, confirm agent
  registration on macOS and revalidate its independently stored bytes. A manual
  copy or stale/failed attempt cannot pass this scheduled-execution check.
- `--remove`: stop/remove that managed agent; retain all verified copies.

No administrator password, Supabase password or FireBoard credentials are
requested. No database/network API is called. Installation writes only its
own helper versions, agent, logs and backup metadata/copies. Originals are
never reset, overwritten or deleted. Repeated runs avoid duplicate copies.

Copies: `~/Library/Application Support/LDCookLog/Verified Recovery/`.
Files are exact recovery envelopes in device subfolders. They can be selected
as a recovery file after privately transferring a chosen copy to the iPhone.
Never send these files or database exports to GitHub or chat attachments.

`status.json` records the last successful independently verified copy.
`last-attempt.json` records whether the most recent attempt succeeded.
Read their timestamps; an old success is not proof of current protection.
Logs are under `~/Library/Application Support/LDCookLog/` and contain only
counts and controlled diagnostics. Mac folders use mode 0700; files 0600.

Managed Mac snapshots now use automatic retention, after a new copy is written,
fsynced and read back successfully. Each device keeps its first and newest three
snapshots, plus a representative for each original database archive. The worker
prefers the newest 30 and a latest point from each of up to 12 calendar months;
older optional points are removed to fit the 1 GiB managed-copy budget. A missing
device's copies are not deleted. The worker validates every managed snapshot
before planning, locks against overlapping workers, refuses conflicts/symlinks,
and checks free disk space before writing. Required points over budget stop the
operation without deleting existing copies. Unknown files and original exports
are never pruned. Managed byte totals exclude metadata, logs and helper versions.

Phone snapshots are trimmed only after fresh Mac evidence matches the exact
current revision/checksum and all staged copies validate. Keep the first and
newest 20 plus representatives for distinct source archives, in this device's
local and Scriptable iCloud snapshot folders. Other devices and trial/working
namespaces remain separate. Missing/stale proof, corruption or unavailable cloud
bytes prevent cleanup. A local warning appears above 128 MiB; this is a warning,
not a hard save limit. The independent Mac copy remains outside iCloud.

Mac capacity appears on the phone and in `--status`, with a warning at 80%.
Publication failure does not invalidate a successful independent copy. Actual
on-device retention acceptance remains pending; reinstall/new-device recovery,
proactive alerts and full feature parity remain open gates. Further changes in
the old Supabase app still require a final source export at cutover.

The installer checks a real copy before creating the agent, refuses unrelated
agent configurations and preserves/restores earlier managed configuration on
registration failure. Standalone artifact generation is reproducible:
`python3 development/scriptable/mac/build_mac.py`.

Apple's per-user job/interval reference:
https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html

## Transient iCloud read handling

The worker recognizes platform errno constants EDEADLK/EAGAIN/EWOULDBLOCK.
On macOS errno 11 is EDEADLK; it must not be interpreted using Linux numbers.
For these source read/stat failures it requests local bytes through Foundation's
startDownloadingUbiquitousItemAtURL:error: using the built-in Objective-C bridge,
then retries within a shared 45-second budget. The native request has an
eight-second cap. No Finder/app UI is opened. Materialization only retrieves
local bytes; original contents are unchanged. A request is not proof of a
backup. Checksums/schema and independent copy readback must still pass.
Permanent permissions, damaged contents and other errors do not get retries
that could hide them. On failure older verified copies are retained and the
next periodic attempt can try again. Diagnostics include symbolic errno and
safe numeric Foundation codes, without paths, record contents or credentials.

## Verification on the iPhone

Update both the generated Mac helper (run `--install` again) and the generated
working Scriptable app. The app uses the existing development journal; no
reimport or reset is needed. After iCloud sync, Recovery protection can display
“Mac independent copy verified for this revision”. This requires a report
matching the current device, namespace, revision and payload checksum, with a
check timestamp no older than 15 minutes. It records evidence of a Mac copy;
Scriptable's separate uploaded count remains zero/unconfirmed.

The helper writes metadata under Scriptable iCloud Documents at
`LDCookLog-2-Mac-Verification/development/<device>.json`. It contains only
identity, revision, checksum, timestamps, trigger and health; no cooking data,
credentials, local paths or exception text. A failed attempt publishes failure
when possible. An unavailable publication cannot remove or invalidate an
already verified local copy. The phone shows missing, stale or mismatched
reports without claiming current protection. Report download waits at most
1.5 seconds. The Mac must be awake and signed in for scheduled refreshes.

The isolated restore app uses a separate report namespace. Physical iPhone
receipt-display acceptance is still pending. Reports are private operational
metadata, not cryptographically signed attestations.

## Isolated retention rehearsal

Run `python3 LDCookLog-Retention-Rehearsal.py` after downloading the reviewed
`rehearse_retention.py` from the development branch. It imports the existing
standalone helper from `~/Downloads/LDCookLog-Mac-Recovery.py` (override with
`--worker` for a reviewed helper path). It uses only automatically removed
synthetic temporary folders, without working data, credentials or agent changes.
It checks 50 saves, normal and capacity-limited pruning, failure preservation
and exact latest synthetic state recovery into a fresh folder. Successful output
is safe to report; do not attach private recovery snapshots. Physical phone
retention and new-device recovery remain separate acceptance gates.
