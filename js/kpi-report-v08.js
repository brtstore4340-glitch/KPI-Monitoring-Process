// kpi-report-v08.js
// KPI Data Processor – Code V09 (LoginFirst + Calendar)

import { appState, pushLog } from "./kpi-core-v08.js";

const calendarState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() // 0=Jan
};

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function formatIso(year, month, day) {
  // month: 0-11
  return (
    year +
    "-" +
    pad2(month + 1) +
    "-" +
    pad2(day)
  );
}

function getUploadedDateSet() {
  const set = new Set();
  const daily = appState.files.daily || [];
  daily.forEach((entry) => {
    if (!entry.dateKey) return;
    const key = entry.dateKey;
    if (key.length === 8) {
      const iso =
        key.slice(0, 4) +
        "-" +
        key.slice(4, 6) +
        "-" +
        key.slice(6, 8);
      set.add(iso);
    }
  });
  return set;
}

function renderCalendar() {
  const container = document.getElementById("tab-report");
  if (!container) return;

  const today = new Date();
  const todayIso = formatIso(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const year = calendarState.year;
  const month = calendarState.month;

  const firstDay = new Date(year, month, 1);
  // ทำให้จันทร์เป็นวันแรก (0=Mon ... 6=Sun)
  const firstDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const totalCells = Math.ceil(cells.length / 7) * 7;
  while (cells.length < totalCells) cells.push(null);

  const uploadedDates = getUploadedDateSet();

  const monthLabel = firstDay.toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric"
  });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let html = "";

  html += `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <button id="calPrevMonth" class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
        </button>
        <span class="text-lg font-bold text-slate-800 dark:text-slate-100">${monthLabel}</span>
        <button id="calNextMonth" class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>
      <div class="text-xs text-slate-500 dark:text-slate-400">
        Store session: Daily KPI uploads in this session
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
      ${dayNames
        .map(
          (n) =>
            `<div class="py-1 uppercase tracking-wide">${n}</div>`
        )
        .join("")}
    </div>

    <div class="grid grid-cols-7 gap-2">
  `;

  cells.forEach((d) => {
    if (!d) {
      html += `<div class="min-h-[5rem] bg-transparent"></div>`;
      return;
    }

    const iso = formatIso(year, month, d);
    const cellDate = new Date(year, month, d);
    const isUploaded = uploadedDates.has(iso);
    const isToday = iso === todayIso;
    const isFuture = cellDate > today;

    let bg = "bg-slate-100 dark:bg-slate-900/40";
    let text = "text-slate-700 dark:text-slate-200";
    let statusText = "";
    let statusColor = "text-xs text-slate-400";

    if (isUploaded) {
      bg = "bg-green-600";
      text = "text-white";
      statusText = "Uploaded";
      statusColor = "text-xs text-green-100";
    } else if (isFuture) {
      bg = "bg-slate-100 dark:bg-slate-900/60";
      text = "text-slate-400 dark:text-slate-500";
      statusText = "Future";
      statusColor = "text-xs text-slate-500";
    } else if (isToday) {
      bg = "bg-amber-800/60 border border-amber-500";
      text = "text-amber-100 font-semibold";
      statusText = "Today";
      statusColor = "text-xs text-amber-100";
    } else {
      bg = "bg-red-900/40";
      text = "text-red-100 font-semibold";
      statusText = "Missing";
      statusColor = "text-xs text-red-100";
    }

    html += `
      <div class="min-h-[5rem] rounded-lg px-2 py-1 flex flex-col justify-between ${bg}" title="${iso} ${statusText}">
        <div class="flex justify-end">
          <span class="text-sm ${text}">${d}</span>
        </div>
        <div class="flex justify-start">
          <span class="${statusColor}">${statusText}</span>
        </div>
      </div>
    `;
  });

  html += `
    </div>

    <div class="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 border-t border-gray-200 dark:border-slate-800 pt-3">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-green-600"></span>
        <span>Uploaded Daily KPI แล้ว</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-red-900/40"></span>
        <span>Missing (ย้อนหลัง / ยังไม่อัปโหลด)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-amber-800/60 border border-amber-500"></span>
        <span>Today (วันนี้)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-slate-100 dark:bg-slate-900/60"></span>
        <span>Future (อนาคต)</span>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const prevBtn = document.getElementById("calPrevMonth");
  const nextBtn = document.getElementById("calNextMonth");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      calendarState.month -= 1;
      if (calendarState.month < 0) {
        calendarState.month = 11;
        calendarState.year -= 1;
      }
      renderCalendar();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      calendarState.month += 1;
      if (calendarState.month > 11) {
        calendarState.month = 0;
        calendarState.year += 1;
      }
      renderCalendar();
    });
  }
}

// --- INIT: ผูกกับแท็บ Reports + ปุ่ม Refresh ---
document.addEventListener("DOMContentLoaded", () => {
  const reportTabBtn = document.querySelector(
    '.tab-btn[data-tab="tab-report"]'
  );
  if (reportTabBtn) {
    reportTabBtn.addEventListener("click", () => {
      pushLog("[REPORT] Render calendar in Reports tab");
      renderCalendar();
    });
  }

  const btnRefresh = document.getElementById("btnRefreshReport");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      pushLog("[REPORT] Refresh calendar");
      renderCalendar();
    });
  }
});
