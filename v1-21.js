(() => {
  const OVERALL_OPTIONS = ["", "Excellent", "Good", "Fair", "Poor"];
  const BARK_OPTIONS = ["", "Excellent", "Good", "Fair", "Poor"];
  const TENDERNESS_OPTIONS = ["", "Tough", "Slightly Tough", "Just Right", "Too Tender"];

  function normalizeEvaluation(value) {
    const src = value && typeof value === "object" ? value : {};
    return {
      overallResult: OVERALL_OPTIONS.includes(src.overallResult) ? src.overallResult : "",
      bark: BARK_OPTIONS.includes(src.bark) ? src.bark : "",
      tenderness: TENDERNESS_OPTIONS.includes(src.tenderness) ? src.tenderness : "",
      observations: typeof src.observations === "string" ? src.observations : "",
      changesNextTime: typeof src.changesNextTime === "string" ? src.changesNextTime : ""
    };
  }

  function selectOptions(values, selected) {
    return values.map((value) => {
      const label = value || "N/A";
      return `<option value="${value.replaceAll('"', '&quot;')}"${value === selected ? " selected" : ""}>${label}</option>`;
    }).join("");
  }

  function getEvaluation() {
    state.evaluation = normalizeEvaluation(state.evaluation);
    return state.evaluation;
  }

  const originalDefaultState = defaultState;
  defaultState = function() {
    const next = originalDefaultState();
    next.evaluation = normalizeEvaluation(next.evaluation);
    return next;
  };

  const originalSave = save;
  save = function() {
    state.evaluation = normalizeEvaluation(state.evaluation);
    return originalSave.apply(this, arguments);
  };

  const host = document.createElement("section");
  host.id = "cookEvaluationSection";
  host.className = "card";
  host.style.display = "none";
  host.innerHTML = `
    <h2>Cook Evaluation</h2>
    <p class="small">Optional. Complete this after you have tasted the finished cook. You can change it later.</p>
    <div id="cookEvaluationSummary"></div>
    <button type="button" id="toggleCookEvaluation">Evaluate Cook</button>
    <div id="cookEvaluationForm" style="display:none; margin-top:12px;">
      <label>Overall Result
        <select id="evaluationOverall"></select>
      </label>
      <label>Bark
        <select id="evaluationBark"></select>
      </label>
      <label>Tenderness
        <select id="evaluationTenderness"></select>
      </label>
      <label>Observations
        <textarea id="evaluationObservations" rows="4" placeholder="Great bark, but a little dry at the edges..."></textarea>
      </label>
      <label>Changes Next Time
        <textarea id="evaluationChanges" rows="4" placeholder="Pull earlier, extend the hold, use less binder..."></textarea>
      </label>
      <p id="evaluationSavedMessage" class="small"></p>
    </div>
  `;

  const existingFooter = document.querySelector("footer");
  if (existingFooter && existingFooter.parentNode) {
    existingFooter.parentNode.insertBefore(host, existingFooter);
  } else {
    document.body.appendChild(host);
  }

  const summary = document.getElementById("cookEvaluationSummary");
  const toggle = document.getElementById("toggleCookEvaluation");
  const form = document.getElementById("cookEvaluationForm");
  const overall = document.getElementById("evaluationOverall");
  const bark = document.getElementById("evaluationBark");
  const tenderness = document.getElementById("evaluationTenderness");
  const observations = document.getElementById("evaluationObservations");
  const changes = document.getElementById("evaluationChanges");
  const savedMessage = document.getElementById("evaluationSavedMessage");

  function saveField(field, value) {
    const evaluation = getEvaluation();
    evaluation[field] = value;
    state.evaluation = normalizeEvaluation(evaluation);
    save();
    savedMessage.textContent = "Evaluation saved on this device.";
    renderEvaluation();
  }

  function renderEvaluation() {
    const finished = state.phase === "Finished" || Boolean(state.finishTime);
    host.style.display = finished ? "block" : "none";
    if (!finished) return;

    const evaluation = getEvaluation();
    overall.innerHTML = selectOptions(OVERALL_OPTIONS, evaluation.overallResult);
    bark.innerHTML = selectOptions(BARK_OPTIONS, evaluation.bark);
    tenderness.innerHTML = selectOptions(TENDERNESS_OPTIONS, evaluation.tenderness);
    observations.value = evaluation.observations;
    changes.value = evaluation.changesNextTime;

    const hasEvaluation = Boolean(
      evaluation.overallResult || evaluation.bark || evaluation.tenderness ||
      evaluation.observations.trim() || evaluation.changesNextTime.trim()
    );

    if (hasEvaluation) {
      const lines = [];
      if (evaluation.overallResult) lines.push(`<strong>Overall:</strong> ${evaluation.overallResult}`);
      if (evaluation.bark) lines.push(`<strong>Bark:</strong> ${evaluation.bark}`);
      if (evaluation.tenderness) lines.push(`<strong>Tenderness:</strong> ${evaluation.tenderness}`);
      if (evaluation.observations.trim()) lines.push(`<strong>Observations:</strong> ${evaluation.observations.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}`);
      if (evaluation.changesNextTime.trim()) lines.push(`<strong>Changes Next Time:</strong> ${evaluation.changesNextTime.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}`);
      summary.innerHTML = `<div class="small">${lines.join("<br>")}</div>`;
      toggle.textContent = form.style.display === "none" ? "Edit Evaluation" : "Hide Evaluation";
    } else {
      summary.innerHTML = `<p class="small">No evaluation recorded yet.</p>`;
      toggle.textContent = form.style.display === "none" ? "Evaluate Cook" : "Hide Evaluation";
    }
  }

  toggle.addEventListener("click", () => {
    form.style.display = form.style.display === "none" ? "block" : "none";
    renderEvaluation();
  });
  overall.addEventListener("change", () => saveField("overallResult", overall.value));
  bark.addEventListener("change", () => saveField("bark", bark.value));
  tenderness.addEventListener("change", () => saveField("tenderness", tenderness.value));
  observations.addEventListener("input", () => saveField("observations", observations.value));
  changes.addEventListener("input", () => saveField("changesNextTime", changes.value));

  const originalRender = render;
  render = function() {
    const result = originalRender.apply(this, arguments);
    renderEvaluation();
    return result;
  };

  // Keep a user's just-entered evaluation when Reset Cook is used, matching the
  // existing preservation behavior for setup choices. The next cook starts with
  // a blank evaluation when Meat On creates a new cook state.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || !(target instanceof HTMLElement)) return;
    if (target.id !== "resetBtn" && !/reset cook/i.test(target.textContent || "")) return;
    const preservedEvaluation = normalizeEvaluation(state.evaluation);
    setTimeout(() => {
      if (state.phase !== "Finished" && !state.finishTime) {
        state.evaluation = normalizeEvaluation(state.evaluation);
        save();
      } else {
        state.evaluation = preservedEvaluation;
        save();
      }
      renderEvaluation();
    }, 0);
  }, true);

  document.title = "LDCookLog Mobile V1.21.0";
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = "V1.21.0 Stateful BBQ Control Panel";
  const footerText = document.querySelector("footer");
  if (footerText) footerText.insertAdjacentHTML("beforeend", '<div class="small">V1.21.0 local Cook Evaluation prototype · build 2026-09-13D</div>');

  renderEvaluation();
})();
