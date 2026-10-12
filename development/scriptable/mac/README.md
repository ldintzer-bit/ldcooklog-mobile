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

There is no automatic deletion. At 1 GB of managed copies the worker refuses
a new copy and records failure, preserving existing backups. Retention and
proactive failure alerts remain development gates; this version is not a
complete maintenance policy. It does not claim iCloud API upload confirmation,
protect records newly entered in the old Supabase app or prove restoration on
a reinstalled/new device. The owner verified scheduled capture of a fresh
revision and a subsequent scheduled check on October 12, 2026.

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
