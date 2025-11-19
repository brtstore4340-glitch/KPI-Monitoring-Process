// kpi-input.js
// KPI Data Processor – Code V10 (Daily/Weekly Upload & Firestore Summary Only)
// - Daily: เลือกประเภท Daily KPI / Sold Movement / Sale By Dept / Store Recap
// - Weekly: Weekly KPI
// - รองรับ .xls / .xlsx / .zip
// - บันทึกเฉพาะ summary ลง Firestore (ไม่ส่ง 2D array)
// - มีช่อง password ให้ user ใส่เองได้ (เตรียมไว้ เผื่อใช้กับ backend / library อื่น)
//   *ปัจจุบัน JSZip/XLSX ยังไม่รองรับถอดรหัสไฟล์ zip/xlsx ที่ถูก encrypt ทั้งไฟล์โดยใช้ password*

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

// ค่า default ภายใน (ไม่แสดงบน UI)
const DEFAULT_ENCRYPTION_PASSWORD = "NewBI#2020";

// ---------------- Common Helpers ----------------

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

// เดา storeId จากชื่อไฟล์ (ถ้าไม่เจอใช้ 4340 เป็นค่า default)
function guessStoreIdFromFilename(fileName) {
  const m = fileName.match(/(\d{4})/);
  if (m && m[1]) return m[1];
  return "4340";
}

// ---------------- Firestore Writer (Summary Only) ----------------

async function saveFileSummaryToFirestore(group, logicalType, fileName, sheetName, rowCount, colCount) {
  const storeId = guessStoreIdFromFilename(fileName);

  // ถ้าเป็น Store Recap ให้ map group -> recap (เก็บใน recapSub)
  let effectiveGroup = group;
  if (logicalType === "storerecap") {
    effectiveGroup = "recap";
  }

  const subCol = getSubcollectionName(effectiveGroup);

  const colRef = collection(
    db,
    DAILY_COLLECTION_ROOT,
    storeId,
    subCol
  );

  const payload = {
    group: effectiveGroup,   // daily / weekly / recap
    logicalType,             // daily_kpi / soldmovement / salebydept / storerecap / weekly_kpi
    fileName,
    sheetName,
    rows: rowCount,
    cols: colCount,
    uploadedAt: new Date().toISOString()
  };

  await addDoc(colRef, payload);

  pushLog(
    `[FIRESTORE] Saved summary – store=${storeId}, sub=${subCol}, type=${logicalType}, file=${fileName}, rows=${rowCount}, cols=${colCount}`
  );
}

// ---------------- XLSX Processor ----------------

async function processSingleWorkbook(group, logicalType, fileName, arrayBuffer) {
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

  await saveFileSummaryToFirestore(group, logicalType, fileName, sheetName, rowCount, colCount);
}

// ---------------- ZIP / Single file Handler ----------------

async function processFileOrZip(group, logicalType, file, encryptionPassword) {
  const fileName = file.name || "unknown";
  const lowerName = fileName.toLowerCase();

  // ตอนนี้ JSZip ยังไม่รองรับ "encrypted zip" แม้จะมี password
  // ถ้าเจอ zip เข้ารหัส จะเด้ง error: "Encrypted zip are not supported"
  // เราเลยใช้ password แค่ log ไว้ / เผื่ออนาคตต่อ backend เท่านั้น
  if (lowerName.endsWith(".zip")) {
    if (typeof JSZip === "undefined") {
      pushLog("[ERROR] JSZip not found");
      throw new Error("JSZip library not loaded");
    }

    pushLog(`[UPLOAD] Processing ZIP for group=${group}, type=${logicalType}, file=${fileName}`);
    pushLog(`[INFO] Encryption password (if any) was provided but JSZip cannot decrypt encrypted ZIP at client-side.`);

    let zip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (err) {
      const msg = err && (err.message || err.toString());
      pushLog("[ZIP ERROR] " + msg);

      if (msg && msg.includes("Encrypted zip are not supported")) {
        throw new Error(
          "ไฟล์ ZIP นี้ถูกเข้ารหัสด้วย password ซึ่ง JSZip ที่ใช้ใน browser ไม่รองรับ\n" +
          "ให้พี่ใช้โปรแกรมแตกไฟล์ด้วย password (เช่น NewBI#2020) ก่อน แล้วอัปโหลดไฟล์ .xls/.xlsx ตรง ๆ แทน"
        );
      }

      throw err;
    }

    const entries = Object.keys(zip.files);
    let processedCount = 0;

    for (const entryName of entries) {
      const entry = zip.files[entryName];
      if (entry.dir) continue;

      const lowerEntry = entryName.toLowerCase();
      if (!lowerEntry.endsWith(".xlsx") && !lowerEntry.endsWith(".xls")) continue;

      pushLog(`[ZIP] Reading entry: ${entryName}`);
      const arrayBuffer = await entry.async("arraybuffer");
      await processSingleWorkbook(group, logicalType, entryName, arrayBuffer);
      processedCount++;
    }

    pushLog(
      `[UPLOAD] ZIP completed for group=${group}, type=${logicalType}, file=${fileName}, processed ${processedCount} Excel file(s)`
    );
  } else {
    // กรณีไฟล์เดี่ยว
    pushLog(
      `[UPLOAD] Processing single file for group=${group}, type=${logicalType}, file=${fileName}`
    );
    const arrayBuffer = await file.arrayBuffer();
    await processSingleWorkbook(group, logicalType, fileName, arrayBuffer);
  }
}

// ---------------- Event Handlers ----------------

async function handleUploadDaily() {
  if (!ensureFirebaseReady()) return;

  const typeSelect = document.getElementById("dailyReportType");
  const logicalType = typeSelect?.value || "daily_kpi";

  const fileInput = document.getElementById("dailyFile");
  if (!fileInput || !fileInput.files || !fileInput.files.length) {
    Swal.fire(
      "No file selected",
      "กรุณาเลือกไฟล์ Daily ก่อนกดประมวลผล",
      "warning"
    );
    return;
  }

  const file = fileInput.files[0];

  const pwdInput = document.getElementById("dailyPassword");
  const userPwd = (pwdInput?.value || "").trim();
  const effectivePassword = userPwd || DEFAULT_ENCRYPTION_PASSWORD;

  try {
    Swal.fire({
      title: "Processing Daily...",
      text: `กำลังประมวลผล (${logicalType})`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    // group = "daily" (ยกเว้น storerecap map เป็น recap ตอน save)
    await processFileOrZip("daily", logicalType, file, effectivePassword);

    Swal.fire(
      "สำเร็จ",
      "ประมวลผลและบันทึกข้อมูลสรุปเข้า Firestore แล้ว",
      "success"
    );
  } catch (err) {
    console.error(err);
    const msg = err && (err.message || err.toString());
    pushLog("[UPLOAD DAILY ERROR] " + msg);
    Swal.fire("Error", msg, "error");
  }
}

async function handleUploadWeekly() {
  if (!ensureFirebaseReady()) return;

  const fileInput = document.getElementById("weeklyFile");
  if (!fileInput || !fileInput.files || !fileInput.files.length) {
    Swal.fire(
      "No file selected",
      "กรุณาเลือกไฟล์ Weekly KPI ก่อนกดประมวลผล",
      "warning"
    );
    return;
  }

  const file = fileInput.files[0];
  const logicalType = "weekly_kpi";

  try {
    Swal.fire({
      title: "Processing Weekly KPI...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    await processFileOrZip("weekly", logicalType, file, null);

    Swal.fire(
      "สำเร็จ",
      "ประมวลผล Weekly KPI และบันทึก summary เข้า Firestore แล้ว",
      "success"
    );
  } catch (err) {
    console.error(err);
    const msg = err && (err.message || err.toString());
    pushLog("[UPLOAD WEEKLY ERROR] " + msg);
    Swal.fire("Error", msg, "error");
  }
}

// ---------------- Bootstrap ----------------

document.addEventListener("DOMContentLoaded", () => {
  const btnDaily = document.getElementById("btnProcessDaily");
  if (btnDaily) {
    btnDaily.addEventListener("click", handleUploadDaily);
  }

  const btnWeekly = document.getElementById("btnProcessWeekly");
  if (btnWeekly) {
    btnWeekly.addEventListener("click", handleUploadWeekly);
  }

  pushLog("[INPUT] V10 input handlers bound (daily & weekly)");
});
