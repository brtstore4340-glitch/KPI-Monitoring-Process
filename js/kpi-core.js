// kpi-input-v10.js
// KPI Data Processor – Code V10 (File Input & Firestore Persist)

import {
  appState,
  db,
  CODE_VERSION,
  DAILY_COLLECTION_ROOT,
  KPI_DEFAULT_PASSWORD,
  DAILY_KPI_RANGE,
  PUBLIC_COLLECTION_PATH,
  pushLog
} from "./kpi-core.js"; // 🔁 ถ้าไฟล์ core ชื่ออื่น ให้แก้ path ตรงนี้ให้ตรงชื่อไฟล์ของพี่

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ---------- Helper: Firebase ready check ----------
function ensureFirebaseReady() {
  if (!appState.firebaseReady || !db) {
    alert("ระบบยังเชื่อมต่อฐานข้อมูลไม่สมบูรณ์ กรุณารอสักครู่แล้วลองใหม่");
    pushLog("[ERROR] Firebase not ready yet, abort upload.");
    return false;
  }
  return true;
}

// ---------- Helper: Read file ----------
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// ---------- Helper: XLSX workbook -> sheets data ----------
function workbookToSheetsData(workbook) {
  const result = {};
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    // แปลงทั้งชีตเป็น array 2 มิติ
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false
    });
    result[sheetName] = rows;
  });
  return result;
}

// ---------- Helper: Detect type from filename ----------
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

// ---------- Helper: Parse store & date from filename ----------
// รองรับรูปแบบตัวอย่าง:
//  - Daily Sales KPI by Store-en-us-4340_20251102_170024.xlsx
//  - Weekly Sales KPI by Store-en-us-4340_20250106_144500.xlsx
//  - salebydeptUK4340.xls
//  - soldmovement43401511.xls (เอา 4 ตัวแรกเป็น store)
function parseStoreAndDateFromFilename(name) {
  const base = name.replace(/^.*[\\/]/, ""); // ตัด path ออก
  let storeId = null;
  let dateKey = null;

  // case: ...-4340_20251102_...
  const storeHyphenMatch = base.match(/-([0-9]{4})_/);
  if (storeHyphenMatch) {
    storeId = storeHyphenMatch[1];
  } else {
    // case: salebydeptUK4340, soldmovement43401511, storerecap4340
    const storePrefixMatch = base.match(
      /(salebydeptuk|soldmovement|storerecap)(\d{4})/i
    );
    if (storePrefixMatch) {
      storeId = storePrefixMatch[2];
    }
  }

  const dateMatch = base.match(/_(\d{8})_/); // _YYYYMMDD_
  if (dateMatch) {
    dateKey = dateMatch[1];
  }

  return { storeId, dateKey };
}

// ---------- Helper: Save to Firestore (merge per date) ----------
async function saveKpiDocument({
  group,
  type,
  storeId,
  dateKey,
  sourceFileName,
  sheets
}) {
  const store = storeId || "UNKNOWN";
  const sub =
    group === "daily"
      ? appState.collections.dailySub
      : group === "weekly"
      ? appState.collections.weeklySub
      : appState.collections.recapSub;

  // ถ้ามี dateKey ให้ใช้เป็น docId (สำหรับ Calendar ในอนาคต)
  // ถ้าไม่มีใช้ชื่อไฟล์แทน (ตัด .xlsx/.xls ออก)
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

  // เก็บข้อมูลของแต่ละ type แยก key เพื่อให้ setDoc แบบ merge ได้
  payload[`files_${type}`] = {
    type,
    sourceFileName,
    sheetNames: Object.keys(sheets),
    sheets
  };

  await setDoc(ref, payload, { merge: true });

  pushLog(
    `[FIRESTORE] Saved ${group}/${type} for store ${store} docId=${docId} (dateKey=${dateKey || "-"
    })`
  );
}

// ---------- Daily Pack Processing ----------
async function processSingleDailyFile(file) {
  const baseName = file.name.replace(/^.*[\\/]/, "");
  const lower = baseName.toLowerCase();

  const type = detectDailyType(lower);
  const { storeId, dateKey } = parseStoreAndDateFromFilename(baseName);

  pushLog(
    `[DAILY] Processing file: ${baseName} (type=${type}, store=${storeId || "-"
    }, dateKey=${dateKey || "-"})`
  );

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

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
      pushLog(`[DAILY] ZIP file detected: ${file.name}`);
      const zip = await JSZip.loadAsync(file);
      const tasks = [];

      zip.forEach((path, entry) => {
        if (!entry.dir && path.toLowerCase().endsWith(".xlsx")) {
          tasks.push(
            zip
              .file(path)
              .async("arraybuffer")
              .then((buf) => {
                const f = new File(
                  [buf],
                  path.replace(/^.*[\\/]/, ""),
                  {
                    type:
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  }
                );
                return processSingleDailyFile(f);
              })
          );
        }
      });

      await Promise.all(tasks);
    } else {
      await processSingleDailyFile(file);
    }

    alert("ประมวลผล Daily Pack สำเร็จ และบันทึกลง Firestore แล้ว");
  } catch (err) {
    console.error(err);
    pushLog(
      "[DAILY ERROR] " + (err && (err.message || err.toString()))
    );
    alert("เกิดข้อผิดพลาดระหว่างประมวลผล Daily Pack ดูรายละเอียดใน Console");
  }
}

// ---------- Weekly Processing ----------
async function processSingleWeeklyFile(file) {
  const baseName = file.name.replace(/^.*[\\/]/, "");
  const lower = baseName.toLowerCase();
  const type = detectWeeklyType(lower);
  const { storeId, dateKey } = parseStoreAndDateFromFilename(baseName);

  pushLog(
    `[WEEKLY] Processing file: ${baseName} (type=${type}, store=${storeId || "-"
    }, dateKey=${dateKey || "-"})`
  );

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
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
      pushLog(`[WEEKLY] ZIP file detected: ${file.name}`);
      const zip = await JSZip.loadAsync(file);
      const tasks = [];

      zip.forEach((path, entry) => {
        if (!entry.dir && path.toLowerCase().endsWith(".xlsx")) {
          tasks.push(
            zip
              .file(path)
              .async("arraybuffer")
              .then((buf) => {
                const f = new File(
                  [buf],
                  path.replace(/^.*[\\/]/, ""),
                  {
                    type:
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  }
                );
                return processSingleWeeklyFile(f);
              })
          );
        }
      });

      await Promise.all(tasks);
    } else {
      await processSingleWeeklyFile(file);
    }

    alert("ประมวลผล Weekly สำเร็จ และบันทึกลง Firestore แล้ว");
  } catch (err) {
    console.error(err);
    pushLog(
      "[WEEKLY ERROR] " + (err && (err.message || err.toString()))
    );
    alert("เกิดข้อผิดพลาดระหว่างประมวลผล Weekly ดูรายละเอียดใน Console");
  }
}

// ---------- Recap Processing ----------
async function processSingleRecapFile(file) {
  const baseName = file.name.replace(/^.*[\\/]/, "");
  const lower = baseName.toLowerCase();
  const type = detectRecapType(lower);
  const { storeId, dateKey } = parseStoreAndDateFromFilename(baseName);

  pushLog(
    `[RECAP] Processing file: ${baseName} (type=${type}, store=${storeId || "-"
    }, dateKey=${dateKey || "-"})`
  );

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
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
      pushLog(`[RECAP] ZIP file detected: ${file.name}`);
      const zip = await JSZip.loadAsync(file);
      const tasks = [];

      zip.forEach((path, entry) => {
        if (!entry.dir && path.toLowerCase().endsWith(".xlsx")) {
          tasks.push(
            zip
              .file(path)
              .async("arraybuffer")
              .then((buf) => {
                const f = new File(
                  [buf],
                  path.replace(/^.*[\\/]/, ""),
                  {
                    type:
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  }
                );
                return processSingleRecapFile(f);
              })
          );
        }
      });

      await Promise.all(tasks);
    } else {
      await processSingleRecapFile(file);
    }

    alert("ประมวลผล Recap สำเร็จ และบันทึกลง Firestore แล้ว");
  } catch (err) {
    console.error(err);
    pushLog(
      "[RECAP ERROR] " + (err && (err.message || err.toString()))
    );
    alert("เกิดข้อผิดพลาดระหว่างประมวลผล Recap ดูรายละเอียดใน Console");
  }
}

// ---------- Bootstrap: attach handlers ----------
document.addEventListener("DOMContentLoaded", () => {
  const btnDaily = document.getElementById("btnProcessDaily");
  const btnWeekly = document.getElementById("btnProcessWeekly");
  const btnRecap = document.getElementById("btnProcessRecap");

  if (btnDaily) {
    btnDaily.addEventListener("click", () => {
      handleDailyClick();
    });
  }
  if (btnWeekly) {
    btnWeekly.addEventListener("click", () => {
      handleWeeklyClick();
    });
  }
  if (btnRecap) {
    btnRecap.addEventListener("click", () => {
      handleRecapClick();
    });
  }

  pushLog("[INPUT] kpi-input-v10.js initialized");
});
