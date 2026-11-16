"use strict";

const byId = (id) => document.getElementById(id);
const counts = new Intl.NumberFormat("en-CA");
const shortDate = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" });
const outcomes = [
  { key: "ok", label: "No anomaly" }, { key: "anomaly", label: "Anomaly" },
  { key: "confirmed", label: "Confirmed by OONI" }, { key: "failure", label: "Failed test" },
];
const count = (row) => outcomes.reduce((total, outcome) => total + row[outcome.key], 0);
let activeCase;
let rows = [];
let selected = 0;

function element(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label) node.textContent = label;
  return node;
}

function nextDay(day, amount = 1) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateLabel(day, full = true) {
  return (full ? fullDate : shortDate).format(new Date(`${day}T00:00:00Z`));
}

function explorerURL(domain, code, since, until) {
  const url = new URL("https://explorer.ooni.org/search");
  for (const [key, value] of Object.entries({ domain, probe_cc: code, since, until, test_name: "web_connectivity" })) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function measurementURL(uid) {
  return `https://explorer.ooni.org/m/${encodeURIComponent(uid)}`;
}

function caseURL(since = activeCase.since, until = activeCase.until) {
  return explorerURL(activeCase.domain, activeCase.code, since, until);
}

function showLegend() {
  const items = [...outcomes, { key: "gap", label: "No measurements" }];
  byId("legend").replaceChildren(...items.map(({ key, label }) => {
    const item = element("span", "legend-item");
    item.append(element("span", `swatch ${key}`), document.createTextNode(label));
    return item;
  }));
}

function showTotals() {
  const totals = [
    ["Measurements", rows.reduce((sum, row) => sum + count(row), 0)],
    ["Days tested", `${rows.filter((row) => count(row)).length} / ${rows.length}`],
    ["Anomalies", rows.reduce((sum, row) => sum + row.anomaly, 0)],
    ["Confirmed by OONI", rows.reduce((sum, row) => sum + row.confirmed, 0)],
  ];
  byId("metrics").replaceChildren(...totals.map(([label, value]) => {
    const metric = element("div", "metric");
    metric.append(element("strong", "", typeof value === "number" ? counts.format(value) : value), element("span", "", label));
    return metric;
  }));
}

function showSelection(focus = false) {
  const row = rows[selected];
  byId("selection-date").textContent = dateLabel(row.date);
  byId("selection-outcomes").textContent = count(row)
    ? outcomes.filter(({ key }) => row[key]).map(({ key, label }) => `${counts.format(row[key])} ${label.toLowerCase()}`).join(" · ")
    : activeCase.unavailable ? "No snapshot available for this date." : "No measurements in this snapshot.";
  byId("day-link").href = caseURL(row.date, nextDay(row.date));
  const buttons = byId("chart").querySelectorAll("button");
  buttons.forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index === selected));
    button.tabIndex = index === selected ? 0 : -1;
  });
  if (focus) buttons[selected].focus();
}

function showChart() {
  const chart = byId("chart");
  chart.style.setProperty("--days", rows.length);
  const share = byId("view").value === "share";
  const max = Math.max(1, ...rows.map(count));
  const step = max > 5 ? Math.ceil(max / 10) * 5 : Math.ceil(max / 2);
  const ceiling = share ? 100 : step * 2;
  const axis = element("div", "axis");
  for (const value of [ceiling, ceiling / 2, 0]) axis.append(element("span", "", `${counts.format(value)}${share ? "%" : ""}`));
  axis.setAttribute("aria-hidden", "true");
  const bars = element("div", "bars");
  rows.forEach((row, index) => {
    const total = count(row);
    const button = element("button", `day${row.date === activeCase.eventDate ? " event" : ""}${total ? "" : " no-data"}`);
    button.type = "button";
    button.title = `${dateLabel(row.date)} · ${counts.format(total)} ${total === 1 ? "test" : "tests"}`;
    button.setAttribute("aria-label", button.title);
    const stack = element("span", "stack");
    stack.setAttribute("aria-hidden", "true");
    if (total) {
      for (const { key } of outcomes) {
        if (!row[key]) continue;
        const segment = element("span", key);
        const height = share ? (row[key] / total) * 100 : (row[key] / ceiling) * 100;
        segment.style.height = `${height}%`;
        stack.append(segment);
      }
    } else {
      stack.append(element("span", "gap"));
    }
    button.append(stack);
    button.addEventListener("click", () => { selected = index; showSelection(); });
    button.addEventListener("keydown", (event) => {
      const targets = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: rows.length - 1 };
      if (!(event.key in targets)) return;
      event.preventDefault();
      selected = Math.min(rows.length - 1, Math.max(0, targets[event.key]));
      showSelection(true);
    });
    bars.append(button);
  });
  const labels = element("div", "axis-dates");
  const ticks = [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
  for (const index of ticks) labels.append(element("span", "", dateLabel(rows[index].date, false)));
  chart.replaceChildren(axis, bars, labels);
  showSelection();
}

function showTable() {
  const table = element("table");
  table.append(element("caption", "", `${activeCase.domain} in ${activeCase.country}, daily Web Connectivity tests (UTC)`));
  const header = table.createTHead().insertRow();
  for (const field of ["Date", ...outcomes.map(({ label }) => label), "Total"]) {
    const cell = element("th", "", field);
    cell.scope = "col";
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const line = body.insertRow();
    const headerCell = element("th", "", row.date);
    headerCell.scope = "row";
    line.append(headerCell);
    for (const { key } of outcomes) line.insertCell().textContent = count(row) ? counts.format(row[key]) : "—";
    line.insertCell().textContent = count(row) ? counts.format(count(row)) : "—";
  }
  byId("table").replaceChildren(table);
}

function showExamples() {
  const list = byId("example-list");
  const examples = activeCase.examples || [];
  byId("examples").hidden = !examples.length;
  list.replaceChildren();
  for (const result of examples) {
    const item = element("li");
    const kind = outcomes.find(({ key }) => key === result.outcome)?.label || "Measurement";
    const anchor = element("a", "", `${dateLabel(result.time.slice(0, 10))} · ${result.asn} · ${kind} ↗`);
    anchor.href = measurementURL(result.uid);
    item.append(anchor);
    list.append(item);
  }
}

function showCase(caseData) {
  activeCase = caseData;
  const reported = new Map(caseData.rows.map((row) => [row.date, row]));
  rows = [];
  for (let day = caseData.since; day < caseData.until; day = nextDay(day)) {
    rows.push(reported.get(day) || { date: day, ok: 0, anomaly: 0, confirmed: 0, failure: 0 });
  }
  selected = Math.max(0, rows.findIndex((row) => row.date === caseData.eventDate));
  if (!caseData.eventDate) {
    rows.forEach((row, index) => { if (count(row)) selected = index; });
  }
  byId("case-list").querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.id === caseData.id)));
  byId("case-meta").textContent = `${caseData.country} (${caseData.code}) · ${dateLabel(caseData.since)} – ${dateLabel(nextDay(caseData.until, -1))} UTC`;
  byId("case-title").textContent = caseData.domain;
  byId("case-description").textContent = caseData.description;
  byId("report-link").hidden = !caseData.report;
  if (caseData.report) byId("report-link").href = caseData.report;
  byId("event-note").hidden = !caseData.eventDate;
  if (caseData.eventDate) byId("event-note").textContent = `${dateLabel(caseData.eventDate)} · OONI’s reported start of restrictions`;
  const captured = caseData.capturedAt && fullDate.format(new Date(caseData.capturedAt));
  const behind = caseData.days && caseData.until < nextDay(new Date().toISOString().slice(0, 10), -2);
  byId("snapshot").textContent = captured
    ? `${behind ? "Earlier snapshot" : "Data retrieved"} ${captured}${behind ? ". OONI Explorer may have newer results." : " · OONI Web Connectivity"}`
    : "Snapshot unavailable. Check the period in OONI Explorer.";
  byId("case-link").href = caseURL();
  showTotals();
  showChart();
  showTable();
  showExamples();
}

async function loadCases() {
  try {
    const response = await fetch("./snapshots.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cases = await response.json();
    for (const caseData of cases) {
      const button = element("button", "case-button");
      button.type = "button";
      button.dataset.id = caseData.id;
      button.append(element("span", "case-country", caseData.country), element("strong", "", caseData.domain), element("span", "case-window", caseData.days ? `Recent ${caseData.days} days` : dateLabel(caseData.since)));
      button.addEventListener("click", () => showCase(caseData));
      byId("case-list").append(button);
    }
    showLegend();
    showCase(cases[0]);
    byId("load-status").hidden = true;
    byId("workspace").hidden = false;
  } catch (error) {
    byId("load-status").textContent = "The snapshots could not be loaded. The OONI lookup below is still available.";
  }
}

byId("view").addEventListener("change", showChart);
const today = new Date().toISOString().slice(0, 10);
byId("from").value = nextDay(today, -31);
byId("through").value = nextDay(today, -1);
byId("lookup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = byId("domain").value.trim();
  const code = byId("country").value.trim().toUpperCase();
  const since = byId("from").value;
  const through = byId("through").value;
  const error = byId("lookup-error");
  error.hidden = true;
  let domain = "";
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!url.username && !url.password) domain = url.hostname.replace(/\.$/, "");
  } catch (invalid) {
    domain = "";
  }
  const validDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  let problem = "";
  if (!validDomain.test(domain)) problem = "Enter a public domain name, such as example.org.";
  else if (code && !/^[A-Z]{2}$/.test(code)) problem = "Enter a two-letter country code or leave the field blank.";
  else if (since && through && since > through) problem = "Choose an end date on or after the start date.";
  if (problem) {
    error.textContent = problem;
    error.hidden = false;
    return;
  }
  window.location.assign(explorerURL(domain, code, since, through ? nextDay(through) : ""));
});
loadCases();
