// kpi-input.js
// KPI Data Processor – Code V10 (Input Upload & Firestore Summary)

import {
  appState,
  db,
  pushLog,
  DAILY_COLLECTION_ROOT
} from "./kpi-core.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --------- Helpers ---------

function ensureFirebaseReady() {
  if (!appState.firebaseReady || !db) {
    Swal.fire(
      "System not ready",
      "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณารอสักครู่แล้วลองใหม่",
      "error"
    );
    pushLog("[ERROR] Firebase not ready when trying to upload");
    return false;
  }
  return true;
}

function getSubcollectionName(group) {
  const col = appState.collections || {};
  if (group === "daily") return col.dailySub || "daily_kpi";
  if (group === "weekly") return col.weeklySub || "weekly_kpi";
  if (group === "recap") return col.recapSub || "recap_kpi";
  return "other";
}

function guessStoreIdFromFilename(fileName) {
  // เดา store id จากเลข 4 หลักในชื่อไฟล์ ถ้าไม่เจอใช้ 4340
  const m = fileName.match(/(\d{4})/);
  if (m && m[1]) return m[1];
  return "4340";
}

async function saveFileSummaryToFirestore(group, fileName, sheetName, rowCount, colCount) {
  const storeId = guessStoreIdFromFilename(fileName);
  const subCol = getSubcollectionName(group);

  const colRef = collection(
    db,
    DAILY_COLLECTION_ROOT,
    storeId,
    subCol
  );

  const payload = {
    group,
    fileName,
    sheetName,
    rows: rowCount,
    cols: colCount,
    uploadedAt: new Date().toISOString()
  };

  await addDoc(colRef, payload);

  pushLog(
    `[FIRESTORE] Saved summary – store=${storeId}, sub=${subCol}, file=${fileName}, rows=${rowCount}, cols=${colCount}`
  );
}

async function processSingleWorkbook(group, fileName, arrayBuffer) {
  if (typeof XLSX === "undefined") {
    pushLog("[ERROR] XLSX library not found");
    throw new Error("XLSX library not loaded");
  }

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const json = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null
  });

  const rowCount = Array.isArray(json) ? json.length : 0;
  let colCount = 0;
  if (rowCount > 0) {
    colCount = json.reduce((max, row) => {
      const len = Array.isArray(row) ? row.length : 0;
      return len > max ? len : max;
    }, 0);
  }

  pushLog(
    `[XLSX] Parsed file="${fileName}" sheet="${sheetName}" rows=${rowCount} cols=${colCount}`
  );

  await saveFileSummaryToFirestore(group, fileName, sheetName, rowCount, colCount);
}

async function processFileOrZip(group, file) {
  const fileName = file.name || "unknown";
  const lowerName = fileName.toLowerCase();

  // กรณี zip
  if (lowerName.endsWith(".zip")) {
    if (typeof JSZip === "undefined") {
      pushLog("[ERROR] JSZip not found");
      throw new Error("JSZip library not loaded");
    }

    pushLog(`[UPLOAD] Processing ZIP for group=${group}: ${fileName}`);

    const zip = await JSZip.loadAsync(file);
    const entries = Object.keys(zip.files);

    let processedCount = 0;

    for (const entryName of entries) {
      const entry = zip.files[entryName];
      if (entry.dir) continue;
      const lowerEntry = entryName.toLowerCase();
      if (!lowerEntry.endsWith(".xlsx") && !lowerEntry.endsWith(".xls")) continue;

      pushLog(`[ZIP] Reading entry: ${entryName}`);
      const arrayBuffer = await entry.async("arraybuffer");
      await processSingleWorkbook(group, entryName, arrayBuffer);
      processedCount++;
    }

    pushLog(
      `[UPLOAD] ZIP completed for group=${group}: ${fileName}, processed ${processedCount} Excel file(s)`
    );
  } else {
    // กรณีไฟล์เดี่ยว
    pushLog(`[UPLOAD] Processing single file for group=${group}: ${fileName}`);
    const arrayBuffer = await file.arrayBuffer();
    await processSingleWorkbook(group, fileName, arrayBuffer);
  }
}

// --------- Event Handlers ---------

async function handleUploadClick(group) {
  if (!ensureFirebaseReady()) return;

  let inputId = "";
  if (group === "daily") inputId = "dailyFile";
  if (group === "weekly") inputId = "weeklyFile";
  if (group === "recap") inputId = "recapFile";

  const input = document.getElementById(inputId);
  if (!input || !input.files || !input.files.length) {
    Swal.fire(
      "No file selected",
      "กรุณาเลือกไฟล์ก่อนกดประมวลผล",
      "warning"
    );
    return;
  }

  const file = input.files[0];

  try {
    Swal.fire({
      title: "Processing...",
      text: `กำลังประมวลผลไฟล์ (${group})`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    await processFileOrZip(group, file);

    Swal.fire(
      "สำเร็จ",
      "ประมวลผลและบันทึก summary เข้า Firestore แล้ว",
      "success"
    );
  } catch (err) {
    console.error(err);
    const msg = err && (err.message || err.toString());
    pushLog("[ERROR] Upload failed: " + msg);
    Swal.fire("Error", "เกิดข้อผิดพลาดระหว่างประมวลผลไฟล์:\n" + msg, "error");
  }
}

// --------- Bootstrap for Input Tab ---------

document.addEventListener("DOMContentLoaded", () => {
  const btnDaily = document.getElementById("btnProcessDaily");
  if (btnDaily) {
    btnDaily.addEventListener("click", () => handleUploadClick("daily"));
  }

  const btnWeekly = document.getElementById("btnProcessWeekly");
  if (btnWeekly) {
    btnWeekly.addEventListener("click", () => handleUploadClick("weekly"));
  }

  const btnRecap = document.getElementById("btnProcessRecap");
  if (btnRecap) {
    btnRecap.addEventListener("click", () => handleUploadClick("recap"));
  }

  pushLog("[INPUT] Input handlers bound (daily/weekly/recap)");
});
