// --- UI MODULE (Themable) ---
// Contains all functions that render or update the DOM.

import { appState, dailyKpiListenerUnsubscribe, setDailyKpiListenerUnsubscribe } from './kpi-core-v08.js';
import { setupCalendarListener } from './firestore.js';
import { getLocalDateAsString, getDaysInMonth, getDaysInWeek, getWeekRange } from './utils.js';

// Theme Management
export function initTheme() {
    // Check local storage or system preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeToggleIcon();
}

export function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
    updateThemeToggleIcon();
}

function updateThemeToggleIcon() {
    const isDark = document.documentElement.classList.contains('dark');
    const icon = isDark ? '☀️' : '🌙'; // Sun for dark mode (to switch to light), Moon for light
    
    const mobileBtn = document.getElementById('btnThemeToggle');
    const desktopBtn = document.getElementById('btnThemeToggleDesktop');
    
    if (mobileBtn) mobileBtn.innerHTML = `<span class="text-xl">${icon}</span>`;
    if (desktopBtn) desktopBtn.innerHTML = `<span class="text-lg">${icon}</span>`;
}

/**
 * Pushes a message to the console log UI.
 */
export function pushLog(message) {
    const logEl = document.getElementById("consoleLog");
    if (!logEl) return;
    const ts = new Date().toLocaleTimeString();
    const line = "[" + ts + "] " + message;
    if (logEl.textContent) {
        logEl.textContent += "\n" + line;
    } else {
        logEl.textContent = line;
    }
    const lines = logEl.textContent.split("\n");
    const maxLines = 400;
    if (lines.length > maxLines) {
        logEl.textContent = lines.slice(lines.length - maxLines).join("\n");
    }
    logEl.scrollTop = logEl.scrollHeight;
}

/**
 * Sets the active tab and panel, and manages listeners.
 */
export function setActiveTab(tabId) {
    const panels = document.querySelectorAll(".tab-panel");
    const buttons = document.querySelectorAll(".tab-btn");
    panels.forEach((panel) => {
        panel.classList.toggle("hidden", panel.id !== tabId);
    });
    buttons.forEach((btn) => {
        const target = btn.getAttribute("data-tab");
        if (target === tabId) {
            btn.classList.remove("tab-btn-inactive");
            btn.classList.add("tab-btn-active");
        } else {
            btn.classList.add("tab-btn-inactive");
            btn.classList.remove("tab-btn-active");
        }
    });
    
    if (tabId === 'tab-calendar') {
        setupCalendarListener();
        renderCalendar(); // Initial render
    } else {
        if (dailyKpiListenerUnsubscribe) {
            dailyKpiListenerUnsubscribe();
            setDailyKpiListenerUnsubscribe(null); // Update global var
            pushLog("[CALENDAR] Unsubscribed from Daily KPI listener");
        }
    }
}

/**
 * Updates the user display name and role.
 */
export function updateUserDisplay() {
    const nameEl = document.getElementById("currentUserDisplay");
    const roleEl = document.getElementById("currentRoleDisplay");
    if (nameEl) {
        nameEl.textContent = appState.displayName || "-";
    }
    if (roleEl) {
        roleEl.textContent = appState.role || "-";
    }
}

/**
 * Updates the Firebase status text.
 */
export function updateFirebaseStatus(text, colorClass) {
    const el = document.getElementById("firebaseStatus");
    if (!el) return;
    // Convert text-emerald-400 (dark mode) to text-emerald-600 (light mode) if needed
    const lightColor = colorClass.replace('400', '600').replace('300', '500');
    el.innerHTML =
        'Firebase: <span class="' + (lightColor || "") + '">' + text + "</span>";
}

/**
 * Updates the Auth status text.
 */
export function updateAuthStatus(text, colorClass) {
    const el = document.getElementById("authStatus");
    if (!el) return;
    const lightColor = colorClass.replace('400', '600').replace('300', '500');
    el.innerHTML =
        'Auth: <span class="' + (lightColor || "") + '">' + text + "</span>";
}

/**
 * Updates the UID status text.
 */
export function updateUidStatus(uid) {
    const el = document.getElementById("uidStatus");
    if (!el) return;
    if (uid) {
        el.textContent = "UID: " + uid;
    } else {
        el.textContent = "";
    }
}

/**
 * Applies config from UI inputs to appState.
 */
export function applyConfigFromUI() {
    const dailyCol =
        document.getElementById("cfgDailyCollection")?.value || "";
    const weeklyCol =
        document.getElementById("cfgWeeklyCollection")?.value || "";
    const recapCol =
        document.getElementById("cfgRecapCollection")?.value || "";

    if (dailyCol) appState.collections.dailySub = dailyCol;
    if (weeklyCol) appState.collections.weeklySub = weeklyCol;
    if (recapCol) appState.collections.recapSub = recapCol;

    pushLog(
        "[CONFIG] Collections updated: " +
            appState.collections.dailySub +
            " | " +
            appState.collections.weeklySub +
            " | " +
            appState.collections.recapSub
    );
    
    if (dailyKpiListenerUnsubscribe) {
         dailyKpiListenerUnsubscribe();
         setDailyKpiListenerUnsubscribe(null);
         setupCalendarListener();
         renderCalendar();
    }
}

// --- CALENDAR RENDERING (THEMED) ---

/**
 * Main render function for the calendar view.
 */
export function renderCalendar() {
     const el = document.getElementById('tab-calendar');
     if (!el) return;
     
     const currentActiveTab = document.querySelector(".tab-btn-active")?.dataset.tab;
     if (currentActiveTab !== 'tab-calendar') {
        return; // Don't render if not visible
     }

     let errorBanner = '';
     if (appState.calendarHasPermissionError) {
         errorBanner = `
         <div class="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 shadow-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300" role="alert">
             <div class="flex items-center gap-2 mb-1">
                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <b class="font-semibold">ข้อผิดพลาด: สิทธิ์การเข้าถึงข้อมูล</b>
             </div>
             <p>ไม่สามารถอ่านข้อมูล Daily KPI จาก Firestore ได้ (Missing or insufficient permissions)</p>
             <p class="text-xs mt-2 text-red-500 bg-white/50 p-2 rounded border border-red-100 font-mono dark:bg-black/30 dark:border-red-900">กรุณาตรวจสอบ Firestore Security Rules สำหรับ collectionGroup("${appState.collections.dailySub}")</p>
         </div>
         `;
     }
     
     const stores = ["4340"];
     const selectedStore = appState.calendarSelectedStore;
     
     const uploadedDatesSet = new Set(
         appState.dailyKpiData
             .filter(r => String(r.storeId || 'UNKNOWN') === selectedStore)
             .map(r => {
                 if (!r.dateKey) return null;
                 // Convert YYYYMMDD (from V07 data) to YYYY-MM-DD
                 return `${r.dateKey.substring(0,4)}-${r.dateKey.substring(4,6)}-${r.dateKey.substring(6,8)}`;
             })
             .filter(Boolean)
     );
     
     const todayStr = getLocalDateAsString(new Date());
     const selectedDate = new Date(appState.calendarSelectedDate + 'T00:00:00');

     el.innerHTML = `
         <div class="animate-in fade-in duration-300">
             ${errorBanner}
             ${renderCalendarControls(stores, selectedStore, selectedDate)}
             ${renderCalendarGrid(selectedDate, uploadedDatesSet, todayStr)}
             ${renderCalendarLegend()}
         </div>
     `;
     
     attachCalendarEventListeners();
 }

/**
 * Renders the calendar control header.
 */
function renderCalendarControls(stores, selectedStore, selectedDate) {
    
    if (!stores.length && !appState.calendarHasPermissionError) {
        stores.push("4340");
    }
    
    if (appState.calendarHasPermissionError && !stores.includes("4340")) {
         stores.push("4340");
    }

    const storeOptionsHtml = stores.map(sc => `
        <option value="${sc}" ${sc === selectedStore ? 'selected' : ''}>Store ${sc}</option>
    `).join('');

    let headerText = '';
    if (appState.calendarViewMode === 'month') {
        headerText = selectedDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    } else {
        const [start, end] = getWeekRange(selectedDate);
        const startText = start.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
        const endText = end.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' });
        headerText = `${startText} – ${endText}`;
    }

    return `
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <!-- Store Selector -->
            <div>
                <label for="calendar-store-select" class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">เลือกสาขา</label>
                <div class="relative">
                    <select id="calendar-store-select"
                        class="w-full md:w-48 appearance-none rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-sky-900 cursor-pointer">
                        ${storeOptionsHtml}
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                       <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            <!-- Date Navigation -->
            <div class="flex items-center gap-4 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <button id="calendar-prev" class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 text-center w-40">${headerText}</h3>
                <button id="calendar-next" class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>

            <!-- View Mode Toggle -->
            <div class="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700">
                <button data-view-mode="month" class="calendar-view-toggle px-4 py-2 rounded-lg text-xs font-bold transition-all
                    ${appState.calendarViewMode === 'month' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-200/50 dark:hover:bg-slate-700/50'}">
                    รายเดือน
                </button>
                <button data-view-mode="week" class="calendar-view-toggle px-4 py-2 rounded-lg text-xs font-bold transition-all
                    ${appState.calendarViewMode === 'week' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-sky-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-200/50 dark:hover:bg-slate-700/50'}">
                    รายสัปดาห์
                </button>
            </div>
        </div>
    `;
}

/**
 * Renders the actual calendar grid.
 */
function renderCalendarGrid(selectedDate, uploadedDatesSet, todayStr) {
    const today = new Date(todayStr + 'T00:00:00');
    let days = [];

    if (appState.calendarViewMode === 'month') {
        days = getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth());
    } else {
        days = getDaysInWeek(selectedDate);
    }
    
    const dayNames = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

    return `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <!-- Header Row -->
            <div class="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                ${dayNames.map(name => `
                    <div class="py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        ${name}
                    </div>
                `).join('')}
            </div>
            
            <!-- Calendar Grid -->
            <div class="grid grid-cols-7 bg-gray-200 dark:bg-slate-700 gap-px"> 
                ${days.map(day => {
                    if (!day) {
                        return `<div class="bg-gray-50 dark:bg-slate-800/50 min-h-[120px]"></div>`;
                    }
                    
                    const dayStr = day.isoDate; // YYYY-MM-DD
                    const isUploaded = uploadedDatesSet.has(dayStr);
                    const isFuture = day.date > today;
                    const isToday = dayStr === todayStr;

                    // Base classes
                    let containerClass = "bg-white dark:bg-slate-800 min-h-[120px] p-3 flex flex-col justify-between transition-all relative group";
                    let dateTextClass = "text-sm font-medium text-slate-700 dark:text-slate-300 w-7 h-7 flex items-center justify-center rounded-full";
                    let statusHtml = "";
                    let cursor = "cursor-default";

                    // Logic for coloring
                    if (isUploaded) {
                        // Success State
                        containerClass += " hover:bg-green-50/50 dark:hover:bg-green-900/20 cursor-pointer border-l-4 border-l-green-500";
                        dateTextClass = "text-sm font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 w-7 h-7 flex items-center justify-center rounded-full";
                        statusHtml = `
                            <div class="mt-2">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                    เรียบร้อย
                                </span>
                            </div>
                        `;
                        cursor = "cursor-pointer";
                    } else if (isFuture) {
                        // Future State
                        containerClass += " bg-gray-50/50 dark:bg-slate-800/50";
                        dateTextClass = "text-sm font-normal text-gray-400 dark:text-slate-600";
                        statusHtml = `<span class="text-[10px] text-gray-300 dark:text-slate-600 font-medium">Future</span>`;
                    } else if (!isToday) {
                        // Missing (Past) State
                        containerClass += " bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/80 dark:hover:bg-red-900/20";
                        dateTextClass = "text-sm font-semibold text-red-600 dark:text-red-400";
                        statusHtml = `
                            <div class="mt-2">
                                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-xs font-medium">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    ขาดส่ง
                                </span>
                            </div>
                        `;
                    } else {
                        // Today (Pending) State
                        containerClass += " bg-white dark:bg-slate-800 ring-2 ring-inset ring-blue-400 dark:ring-sky-500";
                        dateTextClass = "text-sm font-bold text-white bg-blue-600 dark:bg-sky-600 w-7 h-7 flex items-center justify-center rounded-full shadow-md shadow-blue-200 dark:shadow-none";
                        statusHtml = `
                             <div class="mt-2 animate-pulse">
                                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-sky-900/40 text-blue-600 dark:text-sky-300 text-xs font-bold border border-blue-100 dark:border-sky-800">
                                    รอข้อมูล
                                </span>
                            </div>
                        `;
                    }

                    // Padding days (not in current month)
                    if (day.isPadding) {
                         containerClass = "bg-gray-50/80 dark:bg-slate-900/80 min-h-[120px] p-3 flex flex-col justify-between opacity-60";
                         dateTextClass = "text-sm font-normal text-gray-300 dark:text-slate-600";
                         statusHtml = "";
                    }

                    return `
                        <div 
                            class="${containerClass} ${cursor}" 
                            title="${dayStr}"
                        >
                            <div class="flex justify-end">
                                <span class="${dateTextClass}">${day.day}</span>
                            </div>
                            ${statusHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Renders the legend for calendar colors.
 */
function renderCalendarLegend() {
    return `
        <div class="flex flex-wrap gap-6 justify-center mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-100 dark:ring-green-900/30"></div>
                <span class="text-sm text-slate-600 dark:text-slate-400 font-medium">ส่งข้อมูลแล้ว</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-100 dark:ring-red-900/30"></div>
                <span class="text-sm text-slate-600 dark:text-slate-400 font-medium">ขาดส่ง (ย้อนหลัง)</span>
            </div>
             <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-blue-600 dark:bg-sky-600 ring-4 ring-blue-100 dark:ring-sky-900/30"></div>
                <span class="text-sm text-slate-600 dark:text-slate-400 font-medium">วันนี้ (รอข้อมูล)</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-gray-300 dark:bg-slate-600"></div>
                <span class="text-sm text-slate-400 dark:text-slate-500">อนาคต</span>
            </div>
        </div>
    `;
}

// --- CALENDAR EVENT HANDLERS ---

function handleCalendarStoreChange(e) {
    const store = e.target.value || null;
    appState.calendarSelectedStore = store;
    renderCalendar();
}

function handleCalendarViewToggle(e) {
    const mode = e.target.closest('.calendar-view-toggle')?.dataset.viewMode;
    if (mode && mode !== appState.calendarViewMode) {
        appState.calendarViewMode = mode;
        renderCalendar();
    }
}

function handleCalendarNavPrev() {
     const currentDate = new Date(appState.calendarSelectedDate + 'T00:00:00');
    if (appState.calendarViewMode === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
        currentDate.setDate(currentDate.getDate() - 7);
    }
    appState.calendarSelectedDate = getLocalDateAsString(currentDate);
    renderCalendar();
}

function handleCalendarNavNext() {
     const currentDate = new Date(appState.calendarSelectedDate + 'T00:00:00');
    if (appState.calendarViewMode === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    } else {
        currentDate.setDate(currentDate.getDate() + 7);
    }
    appState.calendarSelectedDate = getLocalDateAsString(currentDate);
    renderCalendar();
}

/**
 * Attaches listeners for the dynamically rendered calendar controls.
 */
export function attachCalendarEventListeners() {
     const calStoreSelect = document.getElementById('calendar-store-select');
    if (calStoreSelect) {
        calStoreSelect.addEventListener('change', handleCalendarStoreChange);
    }
    document.querySelectorAll('.calendar-view-toggle').forEach(btn => {
        btn.addEventListener('click', handleCalendarViewToggle);
    });
    const calPrev = document.getElementById('calendar-prev');
    if (calPrev) calPrev.addEventListener('click', handleCalendarNavPrev);
    
    const calNext = document.getElementById('calendar-next');
    if (calNext) calNext.addEventListener('click', handleCalendarNavNext);
}