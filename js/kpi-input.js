// kpi-input.js
// KPI Data Processor – Code V10 (File Input & Firestore Persist)
// - รองรับ Daily / Weekly / Recap
// - อ่าน .xlsx เดี่ยว หรือ .zip ที่มีหลาย .xlsx
// - แยก type จากชื่อไฟล์ แล้ว merge ลง Firestore ตาม storeId + dateKey

import {
  appState,
  db,
  CODE_VERSION,
  DAILY_COLLECTION_ROOT,
  pushLog
} from "./kpi-core.js"; // 🔁 ถ้าไฟล์ core ของพี่ชื่อ kpi-core-v08.js ให้แก้เป็น "./kpi-core-v08.js"

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------------------------------------------------------------------
// 1) Helper พื้นฐาน
// ---------------------------------------------------------------------

function ensureFirebaseReady() {
  if (!appState.firebaseReady || !db) {
    alert("ระบบยังเชื่อมต่อฐานข้อมูลไม่สมบูรณ์ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง");
    pushLog("[ERROR] Firebase not ready yet, abort upload.");
    return false;
  }
  return true;
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function workbookToSheetsData(workbook) {
  const result = {};
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false
    });
    result[sheetName] = rows;
  });
  return result;
}

// ---------------------------------------------------------------------
// 2) ตรวจ type / store / date จากชื่อไฟล์
// ---------------------------------------------------------------------

function detectDailyType(filenameLower) {
  if (filenameLower.startsWith("daily sales kpi")) return "daily_kpi";
  if (filenameLower.startsWith("salebydeptuk")) return "salebydeptUK";
  if (filenameLower.startsWith("soldmovement")) return "soldmovement";
  return "unknown";
}

function detectWeeklyType(filenameLower) {
  if (filenameLower.startsWith("weekly sales kpi")) return "weekly_kpi";
  return "weekly_unknown";
}

function detectRecapType(filenameLower) {
  if (filenameLower.startsWith("storerecap")) return "storerecap";
  return "recap_unknown";
}

// ตัวอย่างชื่อไฟล์:
//  - Daily Sales KPI by Store-en-us-4340_20251102_170024.xlsx
//  - Weekly Sales KPI by Store-en-us-4340_20250106_144500.xlsx
//  - salebydeptUK4340.xls
//  - soldmovement43401511.xls (เอา 4 ตัวแรกเป็น store)
//  - storerecap4340.xls
function parseStoreAndDateFromFilename(name) {
  const base = name.replace(/^.*[\\/]/, "");
  let storeId = null;
  let dateKey = null;

  const m1 = base.match(/-([0-9]{4})_/); // ...-4340_YYYYMMDD_
  if (m1) {
    storeId = m1[1];
  } else {
    const m2 = base.match(/(salebydeptuk|soldmovement|storerecap)(\d{4})/i);
    if (m2) {
      storeId = m2[2];
    }
  }

  const dm = base.match(/_(\d{8})_/); // _YYYYMMDD_
  if (dm) {
    dateKey = dm[1];
  }

  return { storeId, dateKey };
}

// ---------------------------------------------------------------------
// 3) บันทึกลง Firestore (merge ต่อ doc เดิมได้)
// ---------------------------------------------------------------------

async function saveKpiDocument({ group, type, storeId, dateKey, sourceFileName, sheets }) {
  const store = storeId || "UNKNOWN";

  const sub =
    group === "daily"
      ? appState.collections.dailySub
      : group === "weekly"
      ? appState.collections.weeklySub
      : appState.collections.recapSub;

  let docId = dateKey;
  if (!docId) {
    docId = sourceFileName.replace(/\.[^/.]+$/, "");
  }

  const ref = doc(db, DAILY_COLLECTION_ROOT, store, sub, docId);

  const payload = {
    group,
    storeId: store,
    dateKey: dateKey || null,
    codeVersion: CODE_VERSION,
    updatedAt: serverTimestamp()
  };

  // เก็บข้อมูลของ type นี้ไว้ใต้ key แยกต่างหาก
  payload[`files_${type}`] = {
    type,
    sourceFileName,
    sheetNames: Object.keys(sheets),
    sheets
  };

  await setDoc(ref, payload, { merge: true });

  pushLog(
    `[FIRESTORE] Saved group=${group}, type=${type}, store=${store}, docId=${docId}, dateKey=${dateKey || "-"
    }`
  );
}

// ---------------------------------------------------------------------
// 4) DAILY
// ---------------------------------------------------------------------

async function processSingleDailyFile(file) {
  const baseName = file.name.replace(/^.*[\\/]/, "");
  const lower = baseName.toLowerCase();
  const type = detectDailyType(lower);
  const { storeId, dateKey } = parseStoreAndDateFromFilename(baseName);

  pushLog(
    `[DAILY] Processing "${baseName}" (type=${type}, store=${storeId || "-"}, dateKey=${dateKey || "-"
    })`
  );

  const buf = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheets = workbookToSheetsData(workbook);

  await saveKpiDocument({
    group: "daily",
    type,
    storeId,
    dateKey,
    sourceFileName: baseName,
    sheets
  });
}

async function handleDailyClick() {
  if (!ensureFirebaseReady()) return;

  const input = document.getElementById("dailyFile");
  const file = input && input.files && input.files[0];
  if (!file) {
    alert("กรุณาเลือกไฟล์ Daily (.xlsx หรือ .zip) ก่อน");
    return;
  }

  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      pushLog(`[DAILY] ZIP detected: ${file.name}`);
      const zip = await JSZip.loadAsync(file);
      const tasks = [];

      zip.forEach((path, entry) => {
        if (!entry.dir && path.toLowerCase().endsWith(".xlsx")) {
          tasks.push(
            zip
              .file(path)
              .async("arraybuffer")
              .then((buf) => {
                const f = new File([buf], path.replace(/^.*[\\/]/, ""), {
                  type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                });
                return processSingleDailyFile(f);
              })
          );
        }
      });

      await Promise.all(tasks);
    } else {
      await processSingleDailyFile(file);
    }

    alert("ประมวลผล Daily Pack เสร็จและบันทึกลง Firestore แล้ว");
  } catch (err) {
    console.error(err);
    pushLog("[DAILY ERROR] " + (err && (err.message || err.toString())));
    alert("เกิดข้อผิดพลาดระหว่างประมวลผล Daily กรุณาเช็ค Console/Console Log");
  }
}

// ---------------------------------------------------------------------
// 5) WEEKLY
// ---------------------------------------------------------------------

async function processSingleWeeklyFile(file) {
  const baseName = file.name.replace(/^.*[\\/]/, "");
  const lower = baseName.toLowerCase();
  const type = detectWeeklyType(lower);
  const { storeId, dateKey } = parseStoreAndDateFromFilename(baseName);

  pushLog(
    `[WEEKLY] Processing "${baseName}" (type=${type}, store=${storeId || "-"}, dateKey=${dateKey || "-"
    })`
  );

  const buf = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheets = workbookToSheetsData(workbook);

  await saveKpiDocument({
    group: "weekly",
    type,
    storeId,
    dateKey,
    sourceFileName: baseName,
    sheets
  });
}

async function handleWeeklyClick() {
  if (!ensureFirebaseReady()) return;

  const input = document.getElementById("weeklyFile");
  const file = input && input.files && input.files[0];
  if (!file) {
    alert("กรุณาเลือกไฟล์ Weekly (.xlsx หรือ .zip) ก่อน");
    return;
  }

  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      pushLog(`[WEEKLY] ZIP detected: ${file.name}`);
      const zip = await JSZip.loadAsync(file);
      const tasks = [];

      zip.forEach((path, entry) => {
        if (!entry.dir && path.toLowerCase().endsWith(".xlsx")) {
          tasks.push(
            zip
              .file(path)
              .async("arraybuffer")
              .then((buf) => {
                const f = new File([buf], path.replace(/^.*[\\/]/, ""), {
                  type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                });
                return processSingleWeeklyFile(f);
              })
          );
        }
      });

      await Promise.all(tasks);
    } else {
      await processSingleWeeklyFile(file);
    }

    alert("ประมวลผล Weekly เสร็จและบันทึกลง Firestore แล้ว");
  } catch (err) {
    console.error(err);
    pushLog("[WEEKLY ERROR] " + (err && (err.message || err.toString())));
    alert("เกิดข้อผิดพลาดระหว่างประมวลผล Weekly กรุณาเช็ค Console/Console Log");
  }
}

// ---------------------------------------------------------------------
// 6) RECAP
// ---------------------------------------------------------------------

async function processSingleRecapFile(file) {
  const baseName = file.name.replace(/^.*[\\/]/, "");
  const lower = baseName.toLowerCase();
  const type = detectRecapType(lower);
  const { storeId, dateKey } = parseStoreAndDateFromFilename(baseName);

  pushLog(
    `[RECAP] Processing "${baseName}" (type=${type}, store=${storeId || "-"}, dateKey=${dateKey || "-"
    })`
  );

  const buf = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheets = workbookToSheetsData(workbook);

  await saveKpiDocument({
    group: "recap",
    type,
    storeId,
    dateKey,
    sourceFileName: baseName,
    sheets
  });
}

async function handleRecapClick() {
  if (!ensureFirebaseReady()) return;

  const input = document.getElementById("recapFile");
  const file = input && input.files && input.files[0];
  if (!file) {
    alert("กรุณาเลือกไฟล์ Recap (.xlsx หรือ .zip) ก่อน");
    return;
  }

  try {
    if (file.name.toLowerCase().endsWith(".zip")) {
      pushLog(`[RECAP] ZIP detected: ${file.name}`);
      const zip = await JSZip.loadAsync(file);
      const tasks = [];

      zip.forEach((path, entry) => {
        if (!entry.dir && path.toLowerCase().endsWith(".xlsx")) {
          tasks.push(
            zip
              .file(path)
              .async("arraybuffer")
              .then((buf) => {
                const f = new File([buf], path.replace(/^.*[\\/]/, ""), {
                  type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                });
                return processSingleRecapFile(f);
              })
          );
        }
      });

      await Promise.all(tasks);
    } else {
      await processSingleRecapFile(file);
    }

    alert("ประมวลผล Recap เสร็จและบันทึกลง Firestore แล้ว");
  } catch (err) {
    console.error(err);
    pushLog("[RECAP ERROR] " + (err && (err.message || err.toString())));
    alert("เกิดข้อผิดพลาดระหว่างประมวลผล Recap กรุณาเช็ค Console/Console Log");
  }
}

// ---------------------------------------------------------------------
// 7) INITIALIZE MODULE (ผูกปุ่มทันทีที่โหลดไฟล์นี้)
// ---------------------------------------------------------------------

function initInputModule() {
  const btnDaily = document.getElementById("btnProcessDaily");
  const btnWeekly = document.getElementById("btnProcessWeekly");
  const btnRecap = document.getElementById("btnProcessRecap");

  if (btnDaily) btnDaily.addEventListener("click", handleDailyClick);
  if (btnWeekly) btnWeekly.addEventListener("click", handleWeeklyClick);
  if (btnRecap) btnRecap.addEventListener("click", handleRecapClick);

  pushLog("[INPUT] kpi-input.js initialized");
}

// เรียกเลย (เพราะสคริปต์นี้อยู่ท้าย <body> แล้ว DOM ถูกสร้างครบ)
initInputModule();
