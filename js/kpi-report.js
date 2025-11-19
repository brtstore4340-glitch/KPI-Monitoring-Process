// kpi-report.js
// KPI Data Processor – Code V10 (Report View)

import { pushLog } from "./kpi-core.js";

function refreshReportFromConsole() {
  const consoleEl = document.getElementById("consoleLog");
  const outputEl = document.getElementById("reportOutput");

  if (!consoleEl || !outputEl) {
    pushLog("[REPORT] Could not find consoleLog or reportOutput element");
    return;
  }

  const text = consoleEl.textContent || "";
  outputEl.textContent = text;

  pushLog("[REPORT] Refreshed report from console log");
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnRefreshReport");
  if (btn) {
    btn.addEventListener("click", refreshReportFromConsole);
    pushLog("[REPORT] Report refresh handler bound");
  } else {
    pushLog("[REPORT] btnRefreshReport not found in DOM");
  }
});
