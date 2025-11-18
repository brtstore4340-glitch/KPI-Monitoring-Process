// kpi-report-v08.js – Code V08
// Report tab – refresh view from current appState

import {
  CODE_VERSION,
  renderReport,
  pushLog,
} from "./kpi-core-v08.js";

document.addEventListener("DOMContentLoaded", () => {
  const btnRefreshReport = document.getElementById("btnRefreshReport");
  if (btnRefreshReport) {
    btnRefreshReport.addEventListener("click", () => {
      renderReport();
      pushLog("[REPORT] Refresh requested (Code " + CODE_VERSION + ")");
    });
  }
});
