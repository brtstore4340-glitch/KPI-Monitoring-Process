// kpi-input-v08.js – Code V08
// Handle Daily / Weekly / Recap uploads (.zip / .xlsx)

import {
  CODE_VERSION,
  DAILY_KPI_RANGE,
  appState,
  pushLog,
  classifyFileByName,
  persistToFirestore,
  renderReport,
} from "./kpi-core-v08.js";

// -------------------------------
// XLSX handling
// -------------------------------
async function handleXlsx(u8Array, filename, group, fileType) {
  if (typeof XLSX === "undefined") {
    pushLog("[ERROR] XLSX library not loaded");
    return;
  }
  const workbook = XLSX.read(u8Array, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  let rows;
  if (fileType === "daily_kpi") {
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      range: DAILY_KPI_RANGE,
    });
  } else {
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }

  const rowCount = rows.length;
  const entry = {
    filename,
    sheetName,
    rowCount,
    processedAt: new Date().toISOString(),
    group,
    fileType,
  };

  await persistToFirestore(group, fileType, entry, rows);

  if (!appState.filesByGroup[group]) {
    appState.filesByGroup[group] = [];
  }
  appState.filesByGroup[group].push(entry);

  pushLog(
    `  • [${group.toUpperCase()} | ${fileType}] ${filename} | sheet: ${sheetName} | rows: ${rowCount}`
  );

  renderReport();
}

// -------------------------------
// Process zip / xlsx per group
// -------------------------------
async function processZipOrXlsx(baseGroup, fileInputId) {
  const input = document.getElementById(fileInputId);
  if (!input || !input.files || !input.files.length) {
    pushLog("[" + baseGroup.toUpperCase() + "] No file selected");
    return;
  }
  const file = input.files[0];
  const nameLower = file.name.toLowerCase();

  pushLog("[" + baseGroup.toUpperCase() + "] Reading file: " + file.name);

  try {
    if (nameLower.endsWith(".zip")) {
      if (typeof JSZip === "undefined") {
        pushLog("[ERROR] JSZip library not loaded");
        return;
      }
      const zip = await JSZip.loadAsync(file);
      let count = 0;
      const promises = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        if (!relativePath.toLowerCase().endsWith(".xlsx")) return;

        const { fileType, group } = classifyFileByName(relativePath, baseGroup);

        promises.push(
          zipEntry.async("uint8array").then((u8) => {
            count++;
            return handleXlsx(u8, relativePath, group, fileType);
          })
        );
      });

      await Promise.all(promises);
      pushLog(
        "[" +
          baseGroup.toUpperCase() +
          "] Processed " +
          count +
          " workbook(s) from zip"
      );
    } else if (nameLower.endsWith(".xlsx")) {
      const { fileType, group } = classifyFileByName(file.name, baseGroup);
      const buffer = await file.arrayBuffer();
      const u8 = new Uint8Array(buffer);
      await handleXlsx(u8, file.name, group, fileType);
      pushLog(
        "[" +
          baseGroup.toUpperCase() +
          "] Processed 1 workbook as " +
          fileType
      );
    } else {
      pushLog(
        "[" +
          baseGroup.toUpperCase() +
          "] Unsupported file type. Please upload .zip or .xlsx"
      );
    }
  } catch (err) {
    console.error(err);
    const msg =
      (err && (err.message || err.toString())) ||
      "Unknown error while reading file";
    if (msg.includes("Encrypted zip")) {
      pushLog("[ERROR] Encrypted zip are not supported");
    } else {
      pushLog("[ERROR] " + msg);
    }
  }
}

function processDailyPack() {
  processZipOrXlsx("daily", "dailyFile");
}
function processWeeklyFiles() {
  processZipOrXlsx("weekly", "weeklyFile");
}
function processRecapFiles() {
  processZipOrXlsx("recap", "recapFile");
}

// -------------------------------
// DOM ready – bind buttons
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("btnProcessDaily")
    ?.addEventListener("click", processDailyPack);

  document
    .getElementById("btnProcessWeekly")
    ?.addEventListener("click", processWeeklyFiles);

  document
    .getElementById("btnProcessRecap")
    ?.addEventListener("click", processRecapFiles);
});
