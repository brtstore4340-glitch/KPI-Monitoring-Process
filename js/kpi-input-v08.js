// kpi-input.js
// KPI Data Processor – Code V10 (Daily / Weekly / Recap Upload to Firestore)

import {
  appState,
  db,
  DAILY_COLLECTION_ROOT,
  saveKpiDocument,
  pushLog
} from "./kpi-core.js";

import {
  collection,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ใช้ XLSX และ JSZip จาก global (โหลดใน index.html แล้ว)

// --- Helpers ---

/**
 * แปลง workbook -> rows แบบ array-of-arrays
 */
function workbookToRows(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  return rows;
}

/**
 * อ่านไฟล์ .xlsx/.xls เป็น rows
 */
async function readExcelFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  return workbookToRows(workbook);
}

/**
 * parse meta จากชื่อไฟล์ ตาม pattern ที่พี่ให้
 */
function parseMetaFromFilename(fileName, groupHint) {
  const lower = fileName.toLowerCase();
  let group = groupHint || "daily";
  let type = "unknown";
  let storeId = "4340";
  let dateKey = null;

  // Daily Sales KPI by Store-en-us-4340_20251102_170024.xlsx
  if (lower.startsWith("daily sales kpi by")) {
    type = "daily_kpi";
    group = "daily";
    const m = lower.match(/store-en-us-(\d{3,4})_(\d{8})/i);
    if (m) {
      storeId = m[1];
      dateKey = m[2];
    } else {
      const d = lower.match(/(\d{8})/);
      if (d) dateKey = d[1];
    }
  }
  // salebydeptUK4340.xls
  else if (lower.startsWith("salebydeptuk")) {
    type = "salebydeptUK";
    group = "daily";
    const m = lower.match(/salebydeptuk(\d+)/);
    if (m) storeId = m[1];
  }
  // soldmovement43401511.xls
  else if (lower.startsWith("soldmovement")) {
    type = "soldmovement";
    group = "daily";
    const m = lower.match(/soldmovement(\d{3,4})(\d+)?/);
    if (m) {
      storeId = m[1];
      // ถ้ามีส่วนที่เหลือให้เก็บเป็น dateKey แบบเติมปี 20xx ตามสมมติ
      if (m[2]) {
        // สมมติรูปแบบ ddmm -> ใส่ปีปัจจุบัน
        const tail = m[2];
        if (tail.length === 4) {
          const now = new Date();
          const year = String(now.getFullYear());
          dateKey = year + tail.substring(2, 4) + tail.substring(0, 2); // yyyy mm dd (เดา)
        }
      }
    }
  }
  // storerecap4340.xls
  else if (lower.startsWith("storerecap")) {
    type = "storerecap";
    group = "recap";
    const m = lower.match(/storerecap(\d+)/);
    if (m) storeId = m[1];
  }
  // Weekly Sales KPI by Store-en-us-4340_20250106_144500.xlsx
  else if (lower.startsWith("weekly sales kpi by")) {
    type = "weekly_kpi";
    group = "weekly";
    const m = lower.match(/store-en-us-(\d{3,4})_(\d{8})/i);
    if (m) {
      storeId = m[1];
      dateKey = m[2];
    }
  }

  return {
    group,
    type,
    storeId,
    dateKey,
    fileName
  };
}

/**
 * process excel file (1 ไฟล์)
 */
async function processSingleExcelFile(file, groupHint) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  const meta = parseMetaFromFilename(file.name, groupHint);
  pushLog(`[UPLOAD] Processing ${file.name} → type=${meta.type}, store=${meta.storeId}, group=${meta.group}`);

  const rows = await readExcelFile(file);
  const docId = await saveKpiDocument(meta, rows);

  pushLog(`[UPLOAD] Saved to Firestore docId=${docId}`);
}

/**
 * process zip: เปิดทุก entry ที่เป็น .xlsx/.xls
 */
async function processZipFile(file, groupHint) {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files);

  for (const entry of entries) {
    if (entry.dir) continue;
    const name = entry.name;
    const lower = name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) continue;

    pushLog(`[ZIP] Found entry: ${name}`);
    const content = await entry.async("arraybuffer");
    const workbook = XLSX.read(content, { type: "array" });
    const rows = workbookToRows(workbook);

    const meta = parseMetaFromFilename(name, groupHint);
    const docId = await saveKpiDocument(meta, rows);

    pushLog(`[ZIP] Saved entry ${name} → docId=${docId}`);
  }
}

/**
 * ตัวกลาง process file หรือ zip ตาม group
 */
async function processFileInput(inputId, groupHint) {
  const input = document.getElementById(inputId);
  if (!input || !input.files || !input.files.length) {
    Swal.fire("Upload Error", "กรุณาเลือกไฟล์ก่อน", "warning");
    return;
  }

  if (!appState.firebaseReady || !db) {
    Swal.fire("System Error", "ยังไม่ได้เชื่อมต่อ Database กรุณารอสักครู่", "error");
    return;
  }

  const file = input.files[0];
  const name = file.name.toLowerCase();

  try {
    pushLog(`[UPLOAD] Start processing file: ${file.name} (${groupHint})`);

    if (name.endsWith(".zip")) {
      await processZipFile(file, groupHint);
    } else {
      await processSingleExcelFile(file, groupHint);
    }

    Swal.fire("สำเร็จ", "บันทึกข้อมูลลง Firestore แล้ว", "success");
  } catch (err) {
    console.error(err);
    pushLog("[UPLOAD ERROR] " + (err.message || err.toString()));
    Swal.fire("Error", err.message || "ไม่สามารถประมวลผลไฟล์ได้", "error");
  }
}

// --- INIT BUTTON LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
  const btnDaily = document.getElementById("btnProcessDaily");
  if (btnDaily) {
    btnDaily.addEventListener("click", () => processFileInput("dailyFile", "daily"));
  }

  const btnWeekly = document.getElementById("btnProcessWeekly");
  if (btnWeekly) {
    btnWeekly.addEventListener("click", () => processFileInput("weeklyFile", "weekly"));
  }

  const btnRecap = document.getElementById("btnProcessRecap");
  if (btnRecap) {
    btnRecap.addEventListener("click", () => processFileInput("recapFile", "recap"));
  }
});
