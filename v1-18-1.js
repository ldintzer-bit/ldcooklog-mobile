// LDCookLog Mobile V1.18.1 reset-equipment preservation hotfix
(() => {
  const BUILD = "2026-09-12F";
  const resetButton = document.getElementById("resetCook");

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      const preservedIds = Array.isArray(state.equipmentIds) ? [...state.equipmentIds] : [];
      const preservedNames = Object.assign({}, state.equipmentNames || {});
      const beforeCookId = state.cookId;
      const beforeEventCount = Array.isArray(state.events) ? state.events.length : 0;

      setTimeout(() => {
        const resetCompleted = !state.cookId && Array.isArray(state.events) && state.events.length === 0 && (beforeCookId || beforeEventCount || preservedIds.length);
        if (!resetCompleted) return;
        state.equipmentIds = preservedIds;
        state.equipmentNames = preservedNames;
        save();
        render();
      }, 50);
    }, true);
  }

  document.title = "LDCookLog Mobile V1.18.1";
  const headerSub = document.querySelector("header .sub");
  if (headerSub) headerSub.textContent = "V1.18.1 Stateful BBQ Control Panel";
  const footer = document.querySelector(".footer-note");
  if (footer) footer.innerHTML = `V1.18.1 Saved Equipment: Reset Cook now preserves the selected equipment for the next cook.<br><strong>Build ${BUILD}</strong>`;
})();
