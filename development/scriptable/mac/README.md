# Mac verified recovery copies — development acceptance

The owner has completed private source reconciliation of both the working and
isolated restored journals. This helper adds independent local copies of the
working iPhone journal after Scriptable iCloud staging reaches the Mac.

Run the reviewed generated `LDCookLog-Mac-Recovery.py` with `python3`:

- No arguments: validate and copy the latest working recovery snapshot once.
- `--install`: prove a copy, install a per-user LaunchAgent, check at login and
  every five minutes while the Mac is awake and the owner is signed in.
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
a reinstalled/new device. Actual Mac scheduling remains owner acceptance work.

The installer checks a real copy before creating the agent, refuses unrelated
agent configurations and preserves/restores earlier managed configuration on
registration failure. Standalone artifact generation is reproducible:
`python3 development/scriptable/mac/build_mac.py`.

Apple's per-user job/interval reference:
https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
