const DATA_PATHS = {
  predictions: "data/test_set_predictions.csv",
  metrics: "data/test_set_metrics.csv",
  golden: "data/golden_batch_trajectory.csv",
  noisy: "data/suboptimal_noisy_measurements.csv",
  scenarios: {
    "1.0x_F": "data/scenario_1.0x_F.csv",
    "0.8x_F": "data/scenario_0.8x_F.csv",
    "0.6x_F": "data/scenario_0.6x_F.csv",
    "0.5x_F": "data/scenario_0.5x_F.csv",
  },
};

const COLORS = {
  ink: "#24211d",
  muted: "#6f6a62",
  grid: "#e7e2da",
  axis: "#9b948a",
  primary: "#25675f",
  primaryDark: "#184d48",
  amber: "#b7791f",
  coral: "#c65b4d",
  blue: "#3568a8",
  green: "#2f7d59",
  graphite: "#383531",
  maltose: "#86633f",
};

const SPECIES = {
  P: {
    label: "Lactic acid",
    metric: "Lactic Acid P (g/L)",
    exp: "P_experiment (g/L)",
    pred: "P_predicted (g/L)",
    color: COLORS.primary,
  },
  X: {
    label: "Biomass",
    metric: "Biomass X (g/L)",
    exp: "X_experiment (g/L)",
    pred: "X_predicted (g/L)",
    color: COLORS.blue,
  },
  S: {
    label: "Glucose",
    metric: "Glucose S (g/L)",
    exp: "S_experiment (g/L)",
    pred: "S_predicted (g/L)",
    color: COLORS.amber,
  },
  M: {
    label: "Maltose",
    metric: "Maltose M (g/L)",
    exp: "M_experiment (g/L)",
    pred: "M_predicted (g/L)",
    color: COLORS.maltose,
  },
  V: {
    label: "Volume",
    metric: "Volume V (L)",
    exp: "V_experiment (L)",
    pred: "V_predicted (L)",
    color: COLORS.coral,
  },
};

const SCENARIOS = {
  "1.0x_F": {
    label: "Maintain current feed",
    shortLabel: "Current feed",
    color: COLORS.blue,
  },
  "0.8x_F": {
    label: "Moderate feed reduction",
    shortLabel: "Moderate reduction",
    color: COLORS.green,
  },
  "0.6x_F": {
    label: "Feed reduction reference",
    shortLabel: "Reference",
    color: COLORS.graphite,
  },
  "0.5x_F": {
    label: "Aggressive feed reduction",
    shortLabel: "Aggressive reduction",
    color: COLORS.amber,
  },
};

const state = {
  predictions: [],
  metrics: [],
  golden: [],
  noisy: [],
  scenarios: {},
  tableRows: [],
  tableQuery: "",
  selectedSpecies: "P",
  converted: false,
  fitDone: false,
  batchPhase: "golden",
  animationFrame: 0,
  scenarioKey: null,
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wireNavigation();
  wireFittingWorkflow();
  wireScenarioWorkflow();
  await loadData();
  state.tableRows = state.predictions;
  updateDataSummary();
  renderTable();
  renderMetrics();
  drawParityPlot();
  drawBatchChart();
}

async function loadData() {
  const [predictions, metrics, golden, noisy] = await Promise.all([
    loadCsv(DATA_PATHS.predictions),
    loadCsv(DATA_PATHS.metrics),
    loadCsv(DATA_PATHS.golden),
    loadCsv(DATA_PATHS.noisy),
  ]);

  state.predictions = predictions;
  state.metrics = metrics;
  state.golden = toSeries(golden);
  state.noisy = toSeries(noisy);

  const scenarioEntries = await Promise.all(
    Object.entries(DATA_PATHS.scenarios).map(async ([key, path]) => [key, toSeries(await loadCsv(path))]),
  );
  state.scenarios = Object.fromEntries(scenarioEntries);
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return parseCsv(await response.text());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((cells) =>
    headers.reduce((acc, header, index) => {
      const raw = cells[index] ?? "";
      const numeric = Number(raw);
      acc[header] = raw.trim() !== "" && Number.isFinite(numeric) ? numeric : raw;
      return acc;
    }, {}),
  );
}

function toSeries(rows) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const xKey = headers[0];
  const yKey = headers[1];
  return rows
    .map((row) => ({ x: Number(row[xKey]), y: Number(row[yKey]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function wireNavigation() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      document.getElementById(`${button.dataset.view}-view`).classList.add("active");
      setWorkflowState(button.dataset.view === "scenario" ? scenarioStateLabel() : fittingStateLabel());
      if (button.dataset.view === "scenario") drawBatchChart();
      if (button.dataset.view === "fitting") drawParityPlot();
    });
  });
}

function wireFittingWorkflow() {
  const fileInput = document.getElementById("raw-pdf");
  const fileName = document.getElementById("file-name");
  const convertButton = document.getElementById("convert-button");
  const fitButton = document.getElementById("fit-button");
  const split = document.getElementById("split-fraction");
  const splitMethod = document.getElementById("split-method");
  const modelType = document.getElementById("model-type");
  const search = document.getElementById("table-search");

  fileInput.addEventListener("change", () => {
    const name = fileInput.files[0]?.name || "Use sample raw_data.pdf or choose a PDF";
    fileName.textContent = name;
    document.getElementById("upload-step-state").textContent = fileInput.files[0] ? "PDF selected" : "Sample PDF available";
    setWorkflowState("Raw data selected");
  });

  split.addEventListener("input", () => {
    document.getElementById("split-value").textContent = `${split.value}%`;
    document.getElementById("summary-split").textContent = `${split.value}%`;
  });

  splitMethod.addEventListener("change", () => {
    document.getElementById("chip-split").textContent = `${splitMethod.value} split`;
  });

  modelType.addEventListener("change", () => {
    document.querySelector(".status-chip.accent").textContent = `${modelType.value} fit`;
    document.getElementById("config-step-state").textContent = `${modelType.value} constraints`;
  });

  search.addEventListener("input", () => {
    state.tableQuery = search.value.trim().toLowerCase();
    renderTable();
  });

  convertButton.addEventListener("click", () => {
    activateWorkflowStep("validation");
    setWorkflowState("Converting data");
    runProgress({
      duration: prefersReducedMotion ? 100 : 2400,
      onTick: (value) => {
        setProgress("convert", value);
        const step = Math.min(3, Math.floor(value / 25));
        updateAgentRows(step, value);
        document.getElementById("convert-status").textContent = conversionStatus(value);
      },
      onDone: () => {
        state.converted = true;
        setProgress("convert", 100);
        updateAgentRows(3, 100);
        document.getElementById("convert-status").textContent = "Schema validated";
        document.getElementById("fit-status").textContent = "Ready to fit";
        activateWorkflowStep("configuration");
        setWorkflowState("CSV validated");
      },
    });
  });

  fitButton.addEventListener("click", () => {
    if (!state.converted) {
      document.getElementById("fit-status").textContent = "Converting sample data first";
      setWorkflowState("Converting data");
      convertButton.click();
      window.setTimeout(() => fitButton.click(), prefersReducedMotion ? 180 : 2600);
      return;
    }

    activateWorkflowStep("fit");
    setWorkflowState("Fitting model");
    document.getElementById("result-state").textContent = "Fitting hybrid model";
    runProgress({
      duration: prefersReducedMotion ? 100 : 3600,
      onTick: (value) => {
        setProgress("fit", value);
        document.getElementById("fit-status").textContent = fittingStatus(value);
      },
      onDone: () => {
        state.fitDone = true;
        setProgress("fit", 100);
        document.getElementById("fit-status").textContent = "Hybrid model fit complete";
        document.getElementById("result-state").textContent = "Fit complete";
        document.getElementById("results-section").classList.add("ready");
        activateWorkflowStep("fit", true);
        setWorkflowState("Fit complete");
        drawParityPlot();
        renderMetrics();
      },
    });
  });

  document.querySelectorAll("#species-control button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#species-control button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.selectedSpecies = button.dataset.species;
      document.getElementById("parity-species-label").textContent = SPECIES[state.selectedSpecies].label;
      drawParityPlot();
    });
  });
}

function conversionStatus(value) {
  if (value < 25) return "Reading PDF tables";
  if (value < 50) return "Mapping schema";
  if (value < 75) return "Normalizing units";
  if (value < 100) return "Validating rows";
  return "Schema validated";
}

function fittingStatus(value) {
  if (value < 28) return "Splitting batches";
  if (value < 56) return "Fitting hybrid model";
  if (value < 84) return "Scoring test set";
  if (value < 100) return "Preparing plots";
  return "Hybrid model fit complete";
}

function runProgress({ duration, onTick, onDone }) {
  const start = performance.now();
  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(100, (elapsed / duration) * 100);
    onTick(Math.round(progress));
    if (progress < 100) {
      requestAnimationFrame(tick);
    } else {
      onDone();
    }
  };
  requestAnimationFrame(tick);
}

function setProgress(prefix, value) {
  document.getElementById(`${prefix}-progress`).style.width = `${value}%`;
  document.getElementById(`${prefix}-percent`).textContent = `${Math.round(value)}%`;
}

function activateWorkflowStep(stepName, complete = false) {
  const order = ["upload", "validation", "configuration", "fit"];
  const activeIndex = order.indexOf(stepName);
  document.querySelectorAll(".workflow-step").forEach((step) => {
    const index = order.indexOf(step.dataset.workflowStep);
    step.classList.toggle("active", index === activeIndex && !complete);
    step.classList.toggle("done", index < activeIndex || (complete && index <= activeIndex));
  });
}

function updateAgentRows(step, value) {
  document.querySelectorAll(".agent-row").forEach((row, index) => {
    row.classList.toggle("active", index === step && value < 100);
    row.classList.toggle("done", index < step || value === 100);
  });
}

function updateDataSummary() {
  const headers = Object.keys(state.predictions[0] || {});
  const metricRows = state.metrics.filter((row) => row.Species !== "Overall");
  const best = metricRows.reduce((winner, row) => (Number(row.R2) > Number(winner?.R2 ?? -Infinity) ? row : winner), null);
  const overall = state.metrics.find((row) => row.Species === "Overall");

  setText("summary-rows", formatInteger(state.predictions.length));
  setText("summary-columns", formatInteger(headers.length));
  setText("summary-r2", best ? formatNumber(best.R2, 3) : "-");
  setText("summary-rmse", overall ? formatNumber(overall.RMSE, 2) : "-");
  setText("chip-rows", `${formatInteger(state.predictions.length)} rows`);
}

function renderTable() {
  const table = document.getElementById("data-table");
  if (!state.tableRows.length) return;

  const headers = Object.keys(state.tableRows[0]);
  const filtered = state.tableRows.filter((row) => {
    if (!state.tableQuery) return true;
    return headers.some((header) => String(row[header]).toLowerCase().includes(state.tableQuery));
  });
  const visibleRows = filtered.slice(0, 42);

  table.innerHTML = "";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = compactHeader(header);
    if (isNumericColumn(state.tableRows, header)) th.classList.add("numeric");
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  visibleRows.forEach((row) => {
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const td = document.createElement("td");
      const value = row[header];
      const numeric = typeof value === "number";
      td.textContent = numeric ? formatNumber(value, header === "Time (h)" ? 1 : 3) : value;
      if (numeric) td.classList.add("numeric");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  const prefix = state.tableQuery ? `${formatInteger(filtered.length)} matched` : `${formatInteger(filtered.length)} rows`;
  document.getElementById("table-count").textContent =
    `Showing ${formatInteger(visibleRows.length)} of ${prefix} · ${formatInteger(headers.length)} columns`;
}

function compactHeader(header) {
  return header
    .replace("experiment", "exp.")
    .replace("predicted", "pred.")
    .replace("Lactic Acid", "Lactic acid");
}

function isNumericColumn(rows, header) {
  return rows.some((row) => typeof row[header] === "number");
}

function renderMetrics() {
  const root = document.getElementById("metrics-list");
  root.innerHTML = "";
  const rows = state.metrics.length ? state.metrics : [];

  rows.forEach((row) => {
    const key = speciesKeyFromMetric(row.Species);
    const color = key ? SPECIES[key].color : COLORS.primaryDark;
    const article = document.createElement("article");
    article.className = "metric-row";
    article.style.setProperty("--metric-color", color);

    const header = document.createElement("div");
    header.className = "metric-heading";
    const title = document.createElement("strong");
    title.textContent = metricShortName(row.Species);
    const score = document.createElement("span");
    score.textContent = `R2 ${formatNumber(row.R2, 3)}`;
    header.append(title, score);

    const values = document.createElement("div");
    values.className = "metric-values";
    values.innerHTML = `
      <span><small>MAE</small>${formatNumber(row.MAE, 2)}</span>
      <span><small>RMSE</small>${formatNumber(row.RMSE, 2)}</span>
    `;

    article.append(header, values);
    root.appendChild(article);
  });
}

function metricShortName(name) {
  if (name === "Overall") return "Overall";
  const match = Object.values(SPECIES).find((species) => species.metric === name);
  return match?.label || name;
}

function speciesKeyFromMetric(name) {
  return Object.entries(SPECIES).find(([, species]) => species.metric === name)?.[0] || null;
}

function drawParityPlot() {
  const svg = document.getElementById("parity-chart");
  if (!svg || !state.predictions.length) return;

  const spec = SPECIES[state.selectedSpecies];
  const points = state.predictions
    .map((row) => ({
      x: Number(row[spec.exp]),
      y: Number(row[spec.pred]),
      batch: Number(row.Batch),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  const values = points.flatMap((point) => [point.x, point.y]);
  const domain = extent(values, 0.08);
  const box = chartBox(900, 460, { top: 34, right: 34, bottom: 62, left: 72 });
  const scaleX = makeScale(domain[0], domain[1], box.left, box.right);
  const scaleY = makeScale(domain[0], domain[1], box.bottom, box.top);

  clearSvg(svg);
  drawPlotArea(svg, box);
  drawGrid(svg, box, scaleX, scaleY, domain, domain);
  drawSvgLine(svg, [
    { x: domain[0], y: domain[0] },
    { x: domain[1], y: domain[1] },
  ], scaleX, scaleY, { color: COLORS.axis, width: 1.6, dash: "6 6" });

  points.forEach((point) => {
    const circle = svgEl("circle", {
      class: "dot parity-dot",
      cx: scaleX(point.x),
      cy: scaleY(point.y),
      r: state.fitDone ? 4.1 : 3.7,
      fill: spec.color,
      opacity: state.fitDone ? 0.86 : 0.44,
    });
    circle.appendChild(svgEl("title", {}, `Batch ${point.batch}: exp ${formatNumber(point.x, 2)}, pred ${formatNumber(point.y, 2)}`));
    svg.appendChild(circle);
  });

  drawLegend(svg, box, [
    { label: `${spec.label} predictions`, color: spec.color },
    { label: "Ideal parity", color: COLORS.axis, dash: true },
  ]);
  svg.appendChild(svgEl("text", {
    class: "direct-label",
    x: scaleX(domain[1]) - 108,
    y: scaleY(domain[1]) + 18,
  }, "y = x"));
  drawAxisLabels(svg, box, `Experimental ${spec.label}`, `Predicted ${spec.label}`);
}

function wireScenarioWorkflow() {
  const play = document.getElementById("play-button");
  const reset = document.getElementById("reset-button");

  play.addEventListener("click", playNoisyTrajectory);
  reset.addEventListener("click", resetScenario);

  document.querySelectorAll(".condition-grid input, #scenario-system").forEach((input) => {
    input.addEventListener("input", () => {
      if (state.batchPhase === "golden") drawBatchChart();
    });
  });

  document.querySelectorAll(".intervention-list button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".intervention-list button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      playScenario(button.dataset.scenario);
    });
  });
}

function playNoisyTrajectory() {
  cancelAnimationFrame(state.animationFrame);
  state.batchPhase = "noisy";
  state.scenarioKey = null;
  document.getElementById("intervention-box").hidden = true;
  document.getElementById("outcome-summary").hidden = true;
  setPlayState(true);
  setScenarioPhase("Tracking live batch", "Deviation capture", "Wait for 15 h");
  animateBatch({
    duration: prefersReducedMotion ? 100 : 3200,
    onFrame: (progress) => {
      drawBatchChart({ noisyProgress: progress });
      updateReadout(partialSeries(state.noisy, progress).at(-1) || state.noisy[0]);
    },
    onDone: () => {
      state.batchPhase = "decision";
      setPlayState(false);
      setScenarioPhase("Select intervention", "15 h review reached", "Choose feed action");
      document.getElementById("intervention-box").hidden = false;
      drawBatchChart({ noisyProgress: 1 });
      updateReadout(state.noisy.at(-1));
    },
  });
}

function playScenario(key) {
  cancelAnimationFrame(state.animationFrame);
  state.batchPhase = "scenario";
  state.scenarioKey = key;
  document.getElementById("outcome-summary").hidden = true;
  setScenarioPhase("Prediction running", SCENARIOS[key].label, "Project endpoint");
  animateBatch({
    duration: prefersReducedMotion ? 100 : 4200,
    onFrame: (progress) => {
      drawBatchChart({ noisyProgress: 1, scenarioProgress: progress, scenarioKey: key });
      updateReadout(partialSeries(state.scenarios[key], progress).at(-1) || state.noisy.at(-1));
    },
    onDone: () => {
      drawBatchChart({ noisyProgress: 1, scenarioProgress: 1, scenarioKey: key });
      updateReadout(state.scenarios[key].at(-1));
      setScenarioPhase("Prediction complete", SCENARIOS[key].label, "Review outcome");
      showOutcomeSummary(key);
    },
  });
}

function resetScenario() {
  cancelAnimationFrame(state.animationFrame);
  setPlayState(false);

  if (state.scenarioKey || state.batchPhase === "scenario") {
    state.batchPhase = "decision";
    state.scenarioKey = null;
    document.getElementById("intervention-box").hidden = false;
    document.getElementById("outcome-summary").hidden = true;
    document.querySelectorAll(".intervention-list button").forEach((item) => item.classList.remove("active"));
    setScenarioPhase("Select intervention", "15 h review reached", "Choose feed action");
    drawBatchChart({ noisyProgress: 1 });
    updateReadout(state.noisy.at(-1));
    return;
  }

  state.batchPhase = "golden";
  state.scenarioKey = null;
  document.getElementById("intervention-box").hidden = true;
  document.getElementById("outcome-summary").hidden = true;
  document.querySelectorAll(".intervention-list button").forEach((item) => item.classList.remove("active"));
  setScenarioPhase("Golden trajectory", "Baseline tracking", "Play batch");
  drawBatchChart();
  updateReadout(state.golden[0]);
}

function setPlayState(isPlaying) {
  const play = document.getElementById("play-button");
  play.disabled = isPlaying;
  document.getElementById("play-button-label").textContent = isPlaying ? "Playing" : "Play";
}

function setScenarioPhase(phase, status, action) {
  document.getElementById("scenario-state").textContent = phase;
  document.getElementById("phase-label").textContent = phase;
  document.getElementById("decision-status").textContent = status;
  document.getElementById("decision-action").textContent = action;
  setWorkflowState(phase);
}

function scenarioStateLabel() {
  return document.getElementById("scenario-state")?.textContent || "Golden trajectory";
}

function fittingStateLabel() {
  if (state.fitDone) return "Fit complete";
  if (state.converted) return "CSV validated";
  return "Raw data ready";
}

function setWorkflowState(label) {
  document.getElementById("workflow-state").textContent = label;
}

function animateBatch({ duration, onFrame, onDone }) {
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    onFrame(easeInOut(progress));
    if (progress < 1) {
      state.animationFrame = requestAnimationFrame(tick);
    } else {
      onDone();
    }
  };
  state.animationFrame = requestAnimationFrame(tick);
}

function drawBatchChart(options = {}) {
  const svg = document.getElementById("batch-chart");
  if (!svg || !state.golden.length) return;

  const noisyProgress = options.noisyProgress ?? (["decision", "scenario"].includes(state.batchPhase) ? 1 : 0);
  const scenarioKey = options.scenarioKey || state.scenarioKey;
  const scenarioProgress = options.scenarioProgress ?? (state.batchPhase === "scenario" ? 1 : 0);
  const scenarioData = scenarioKey ? state.scenarios[scenarioKey] : [];
  const visibleNoisy = noisyProgress > 0 ? partialSeries(state.noisy, noisyProgress) : [];
  const visibleScenario = scenarioData.length && scenarioProgress > 0 ? partialSeries(scenarioData, scenarioProgress) : [];

  const allY = [
    ...state.golden.map((point) => point.y),
    ...state.noisy.map((point) => point.y),
    ...Object.values(state.scenarios).flatMap((series) => series.map((point) => point.y)),
  ];
  const box = chartBox(980, 520, { top: 38, right: 36, bottom: 66, left: 74 });
  const xDomain = [0, 50];
  const yDomain = extent(allY, 0.08);
  const scaleX = makeScale(xDomain[0], xDomain[1], box.left, box.right);
  const scaleY = makeScale(yDomain[0], yDomain[1], box.bottom, box.top);

  clearSvg(svg);
  drawPlotArea(svg, box);
  drawGrid(svg, box, scaleX, scaleY, xDomain, yDomain);
  drawSvgLine(svg, state.golden, scaleX, scaleY, { color: COLORS.axis, width: 2.2, opacity: 0.58, dash: "6 8" });

  if (visibleNoisy.length) {
    drawSvgLine(svg, visibleNoisy, scaleX, scaleY, { color: COLORS.coral, width: 3.2 });
    visibleNoisy.forEach((point) => {
      svg.appendChild(svgEl("circle", {
        class: "dot",
        cx: scaleX(point.x),
        cy: scaleY(point.y),
        r: 4,
        fill: COLORS.coral,
      }));
    });
  }

  if (visibleScenario.length) {
    drawSvgLine(svg, visibleScenario, scaleX, scaleY, { color: scenarioColor(scenarioKey), width: 4 });
    const endpoint = visibleScenario.at(-1);
    svg.appendChild(svgEl("circle", {
      class: "endpoint-dot",
      cx: scaleX(endpoint.x),
      cy: scaleY(endpoint.y),
      r: 5.5,
      fill: scenarioColor(scenarioKey),
    }));
  }

  drawInterventionMarker(svg, box, scaleX, 15);
  drawLegend(svg, box, [
    { label: "Golden trajectory", color: COLORS.axis, dash: true },
    ...(visibleNoisy.length ? [{ label: "Live batch", color: COLORS.coral }] : []),
    ...(scenarioKey ? [{ label: SCENARIOS[scenarioKey].shortLabel, color: scenarioColor(scenarioKey) }] : []),
  ]);
  drawAxisLabels(svg, box, "Time (h)", "Biomass concentration (g/L)");

  const readout = visibleScenario.at(-1) || visibleNoisy.at(-1) || state.golden[0];
  const endpoint = visibleScenario.at(-1) || visibleNoisy.at(-1);
  updateReadout(readout);
  updateScenarioStrip(endpoint, scenarioKey);
}

function drawInterventionMarker(svg, box, scaleX, x) {
  const markerX = scaleX(x);
  svg.appendChild(svgEl("line", {
    x1: markerX,
    x2: markerX,
    y1: box.top,
    y2: box.bottom,
    stroke: COLORS.amber,
    "stroke-width": 1.6,
    "stroke-dasharray": "4 6",
  }));
  svg.appendChild(svgEl("text", {
    class: "direct-label marker-label",
    x: markerX + 8,
    y: box.top + 17,
    fill: COLORS.amber,
  }, "15 h decision"));
}

function updateReadout(point) {
  if (!point) return;
  document.getElementById("time-readout").textContent = formatNumber(point.x, 1);
  document.getElementById("value-readout").textContent = formatNumber(point.y, 1);
}

function updateScenarioStrip(endpoint, scenarioKey) {
  document.getElementById("intervention-label").textContent = scenarioKey ? SCENARIOS[scenarioKey].label : "Not selected";
  document.getElementById("endpoint-label").textContent = endpoint ? `${formatNumber(endpoint.y, 1)} g/L` : "-";
}

function showOutcomeSummary(key) {
  const finalPoint = state.scenarios[key]?.at(-1);
  const baseline = state.scenarios["1.0x_F"]?.at(-1);
  if (!finalPoint || !baseline) return;
  const delta = finalPoint.y - baseline.y;
  document.getElementById("outcome-biomass").textContent = `${formatNumber(finalPoint.y, 1)} g/L`;
  document.getElementById("outcome-delta").textContent = `${delta >= 0 ? "+" : ""}${formatNumber(delta, 1)} g/L`;
  document.getElementById("outcome-summary").hidden = false;
}

function scenarioStatus(key) {
  return SCENARIOS[key]?.label || "Scenario";
}

function scenarioColor(key) {
  return SCENARIOS[key]?.color || COLORS.primary;
}

function partialSeries(series, progress) {
  if (!series.length) return [];
  const clamped = Math.max(0, Math.min(1, progress));
  const exactIndex = clamped * (series.length - 1);
  const whole = Math.floor(exactIndex);
  const fraction = exactIndex - whole;
  const result = series.slice(0, whole + 1);

  if (fraction > 0 && series[whole + 1]) {
    const from = series[whole];
    const to = series[whole + 1];
    result.push({
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
    });
  }

  return result;
}

function drawPlotArea(svg, box) {
  svg.appendChild(svgEl("rect", {
    class: "plot-area",
    x: box.left,
    y: box.top,
    width: box.right - box.left,
    height: box.bottom - box.top,
    rx: 4,
  }));
}

function drawSvgLine(svg, points, scaleX, scaleY, options = {}) {
  if (!points.length) return;
  const d = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
    .join(" ");

  svg.appendChild(svgEl("path", {
    class: "line",
    d,
    stroke: options.color || COLORS.primary,
    "stroke-width": options.width || 2,
    "stroke-dasharray": options.dash || "",
    opacity: options.opacity ?? 1,
  }));
}

function drawGrid(svg, box, scaleX, scaleY, xDomain, yDomain) {
  const xTicks = ticks(xDomain[0], xDomain[1], 6);
  const yTicks = ticks(yDomain[0], yDomain[1], 5);
  const yDigits = Math.abs(yDomain[1] - yDomain[0]) > 20 ? 0 : 1;

  xTicks.forEach((tick) => {
    const x = scaleX(tick);
    svg.appendChild(svgEl("line", { class: "grid", x1: x, x2: x, y1: box.top, y2: box.bottom }));
    svg.appendChild(svgEl("text", { x, y: box.bottom + 26, "text-anchor": "middle" }, formatNumber(tick, 0)));
  });

  yTicks.forEach((tick) => {
    const y = scaleY(tick);
    svg.appendChild(svgEl("line", { class: "grid", x1: box.left, x2: box.right, y1: y, y2: y }));
    svg.appendChild(svgEl("text", { x: box.left - 13, y: y + 4, "text-anchor": "end" }, formatNumber(tick, yDigits)));
  });

  svg.appendChild(svgEl("line", { class: "axis", x1: box.left, x2: box.right, y1: box.bottom, y2: box.bottom }));
  svg.appendChild(svgEl("line", { class: "axis", x1: box.left, x2: box.left, y1: box.top, y2: box.bottom }));
}

function drawAxisLabels(svg, box, xLabel, yLabel) {
  svg.appendChild(svgEl("text", {
    class: "axis-label",
    x: (box.left + box.right) / 2,
    y: box.bottom + 54,
    "text-anchor": "middle",
  }, xLabel));

  svg.appendChild(svgEl("text", {
    class: "axis-label",
    x: 18,
    y: (box.top + box.bottom) / 2,
    transform: `rotate(-90 18 ${(box.top + box.bottom) / 2})`,
    "text-anchor": "middle",
  }, yLabel));
}

function drawLegend(svg, box, items) {
  let x = box.left;
  const y = box.top - 14;
  items.forEach((item) => {
    svg.appendChild(svgEl("line", {
      x1: x,
      x2: x + 22,
      y1: y,
      y2: y,
      stroke: item.color,
      "stroke-width": 3,
      "stroke-linecap": "round",
      "stroke-dasharray": item.dash ? "5 5" : "",
    }));
    svg.appendChild(svgEl("text", { class: "legend-label", x: x + 28, y: y + 4 }, item.label));
    x += Math.max(126, item.label.length * 7.4 + 42);
  });
}

function chartBox(width, height, margin) {
  return {
    width,
    height,
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
  };
}

function makeScale(domainMin, domainMax, rangeMin, rangeMax) {
  const domainSpan = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / domainSpan) * (rangeMax - rangeMin);
}

function extent(values, paddingRatio = 0.05) {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  return [min - span * paddingRatio, max + span * paddingRatio];
}

function ticks(min, max, count) {
  const step = (max - min) / (count - 1 || 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function svgEl(name, attrs = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") element.setAttribute(key, value);
  });
  if (text) element.textContent = text;
  return element;
}

function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function formatInteger(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return String(value);
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 0 ? 0 : Math.min(1, digits),
  });
}
