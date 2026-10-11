# Owner next steps — development build only

No new manual Supabase backup is requested for the development work so far.
Keep the verified archive already in iCloud Drive. If you add real cooks to the
old application, those new records are not included in that old snapshot.
The replacement is not yet approved for real cooks or Supabase retirement.

## Current route: no annual developer fee

The owner declined Apple Developer membership on October 11. Do not enroll or
purchase it. We are testing Scriptable as the offline iPhone host. First install
the free Scriptable app and open it once; no private migration is requested.
See [the prototype and its limits](scriptable/README.md). A guided synthetic
device/backup test is required before this route can be accepted.

## Earlier native route — retained for reference, not the current instructions

1. On your Mac, open Safari and visit https://developer.apple.com/account/.
2. Sign in directly with your Apple Account if asked. Do not send the password,
   authentication code, certificates or keys to ChatGPT or GitHub.
3. Look for membership information or a prompt to join the Apple Developer
   Program. Report only whether you already have a membership, do not have one,
   or cannot tell. Do not purchase or enroll just to follow these steps.

This matters because the development build uses native iCloud Documents
capabilities. A free Xcode Personal Team is intended for temporary device
testing and its provisioning profile expires after seven days. We need a
practical installation route before asking you to install anything.

## Earlier native acceptance sequence — adapt after Scriptable feasibility

We will guide these steps individually; do not attempt private migration yet:

1. Obtain the development branch on the Mac and prepare its Xcode project.
2. Configure the development app's signing and iCloud container locally.
3. Install alongside the existing app; enter synthetic test cooks only.
4. Test airplane mode, reopening, events, rest/keep-warm, finishing and restart.
5. Check that offline saves show pending backups, then reconnect and verify
   confirmed uploads. Retrieve and restore a copy on the Mac/clean installation.
6. Convert the existing PostgreSQL archive locally using the recovered helper.
   Never upload the .dump, migration JSON or recovery JSON to the public repo.
7. Reconcile the 30 known cooks and every table's counts and IDs. Review events,
   equipment, evaluations, FireBoard histories, probes/units and comparisons.
8. Complete feature/device acceptance, then decide on a controlled cutover.
   If the old database has changed, one final fresh export will be necessary.

Automatic snapshots and iCloud retries are implemented, but real owner-device
upload/recovery and full cooking feature acceptance remain release blockers.
We will explicitly say when those gates have passed and further manual
Supabase backups are no longer needed.

Apple references:
https://developer.apple.com/help/account/basics/about-your-developer-account
https://developer.apple.com/help/account/reference/supported-capabilities-ios
