// LDCookLog Mobile V1.17.1 location recovery hotfix
(() => {
  const BUILD = "2026-09-12C";
  const priorRestoreViewedCloudCook = restoreViewedCloudCook;

  restoreViewedCloudCook = function(){
    const recovery = viewedCloudRecovery;
    const beforeCookId = state && state.cookId;
    priorRestoreViewedCloudCook();

    if (
      recovery && recovery.cook &&
      state && state.cookId === recovery.cook.cook_id &&
      state.cloudCookUuid === recovery.cook.id &&
      state.cookId !== beforeCookId
    ) {
      state.locationId = recovery.cook.location_id || null;
      state.locationName = recovery.cook.location_name || "";

      // Render the recovered location into the selector before save() reads it.
      render();
      save();
      render();
    }
  };

  document.title = "LDCookLog Mobile V1.17.1";
  const headerSub = document.querySelector("header .sub");
  if (headerSub) headerSub.textContent = "V1.17.1 Stateful BBQ Control Panel";
  const footer = document.querySelector(".footer-note");
  if (footer) footer.innerHTML = `V1.17.1 fixes saved-location recovery after Resume/Restore.<br><strong>Build ${BUILD}</strong>`;
})();
