# Cooking events and reusable setup choices

The development journal offers Add saved equipment, Add saved rub and Add saved
sauce in Cook setup. Choices come from the preserved source catalogs and saved
non-test cooks. Selecting adds a name to editable text, with semicolons separating
multiple names; duplicates are ignored. Save cook setup commits the selection.
Custom text remains available. Original catalog rows and archives are never edited.
These are selection controls, not a catalog administration screen.

Lid Open and Lid Closed quick actions alternate after a successful save. Events
retain timestamps and notes without changing the cooking phase. Double taps cannot
record duplicate open/close transitions. Historical cooks with no lid events show
not recorded. Finished cooks cannot receive new events.

Wrapped opens Record wrap method. Choose Foil, Butcher Paper, Foil Boat or Other;
Other requires a description. Save wrap records the actual method and optional
note in the timeline while preserving the planned setup method. Wrapping is
available during Cooking. Old Wrapped events retain their original notes and do
not acquire an invented method. Save before closing the app; unsaved drafts are
not recovery snapshots.

Validation includes catalog non-mutation/privacy boundaries, queued duplicate lid
saves, invalid wrap rejection without writes, and exact fresh-journal restoration.
Browser suites cover offline reopening, catalog additions and duplicate handling,
wrap method display, lid state and unchanged archived history/readings.

Remaining physical acceptance: use these controls during the next real cook and
restore on a replacement phone. Neither requirement blocks this development batch;
neither is claimed completed by automated or synthetic testing.
