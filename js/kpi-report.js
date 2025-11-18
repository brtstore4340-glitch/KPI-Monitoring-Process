// kpi-report.js
// KPI Data Processor – Code V10 (Report Tab uses Session Console)

import { pushLog } from "./kpi-core.js";

function refreshReportFromConsole() {
  const consoleEl = document.getElementById("consoleLog");
  const reportEl = document.getElementById("reportOutput");
  if (!consoleEl || !reportEl) return;

  reportEl.textContent = consoleEl.textContent || "";
  pushLog("[REPORT] Refreshed report from console log");
}

document.addEventListener("DOMContentLoaded", () => {
  const btnRefresh = document.getElementById("btnRefreshReport");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", refreshReportFromConsole);
  }
});
