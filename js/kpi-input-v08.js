// kpi-input-v08.js
// KPI Data Processor – Code V09 (LoginFirst + Calendar)

import {
  processDailyPack,
  processWeeklyFiles,
  processRecapFiles,
  pushLog
} from "./kpi-core-v08.js";

document.addEventListener("DOMContentLoaded", () => {
  const btnDaily = document.getElementById("btnProcessDaily");
  if (btnDaily) {
    btnDaily.addEventListener("click", () => {
      pushLog("[INPUT] Daily pack requested");
      processDailyPack();
    });
  }

  const btnWeekly = document.getElementById("btnProcessWeekly");
  if (btnWeekly) {
    btnWeekly.addEventListener("click", () => {
      pushLog("[INPUT] Weekly pack requested");
      processWeeklyFiles();
    });
  }

  const btnRecap = document.getElementById("btnProcessRecap");
  if (btnRecap) {
    btnRecap.addEventListener("click", () => {
      pushLog("[INPUT] Recap pack requested");
      processRecapFiles();
    });
  }
});
