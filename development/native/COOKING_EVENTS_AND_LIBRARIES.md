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

## Complete cooking setup additions

New cook's Cooker selector and Equipment / fuel presets include Traeger Pro 780
alongside Ironwood 885 and Weber kettle choices. Existing cooker text is preserved.

Individual meat pieces is an optional disclosure in Cook setup. Add up to 32
pieces; open each Piece entry to enter cut, package/cook weights with lb/kg/g/oz,
bone status, brand, source, grade, notes and dollar prices. Zero remains zero;
blank numeric values remain unknown. Removing a piece affects editable metadata
only when Save cook setup succeeds; original imported rows remain intact. The
existing general weight/pieces field remains independent, with no automatic total
or silent replacement of historical values.

Saved location and Saved method / recipe choices use the archived catalogs and
saved non-test cooks. Selecting a method copies its name and reference into
editable fields; Save cook setup commits the change. These fields also accept
custom text. No web request is made to a recipe reference.

Rub application details supports up to 64 named entries, Light/Normal/Heavy or
Not recorded, and notes. Choosing Add saved rub creates a matching detail entry
when absent. Add rub detail supports custom rub names. Removing a detail does not
remove the general rub text; edit that field too if the rub is no longer used.
Existing imported applications populate the editor without changing original rows.

Spritz records a timestamp and the Action / note text while retaining the phase.
Serve / Slice / Pull is offered during Cooking, Resting or Keeping Warm and moves
the cook to Serving, ending the previous rest/hold timer. Cook Finished remains
available during Serving. Finish after serving when the record is complete.
All successful saves use the existing journal and automatic recovery snapshots.
Drafts survive in-session filtering and switching; save before closing the app.
