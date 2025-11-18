// --- UI MODULE ---
// Contains all functions that render or update the DOM.

import { appState, dailyKpiListenerUnsubscribe, setDailyKpiListenerUnsubscribe } from './main.js';
import { setupCalendarListener } from './firestore.js';
import { getLocalDateAsString, getDaysInMonth, getDaysInWeek, getWeekRange } from './utils.js';

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
    el.innerHTML =
        'Firebase: <span class="' + (colorClass || "") + '">' + text + "</span>";
}

/**
 * Updates the Auth status text.
 */
export function updateAuthStatus(text, colorClass) {
    const el = document.getElementById("authStatus");
    if (!el) return;
    el.innerHTML =
        'Auth: <span class="' + (colorClass || "") + '">' + text + "</span>";
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

// --- CALENDAR RENDERING ---

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
         <div class="mb-4 p-3 rounded-lg bg-yellow-100 border border-yellow-300 text-sm text-yellow-800" role="alert">
             <b class="font-semibold">ข้อผิดพลาด:</b> ไม่สามารถอ่านข้อมูล Daily KPI จาก Firestore ได้ (Missing or insufficient permissions)
             <p class="text-xs mt-1">กรุณาตรวจสอบ Firestore Security Rules สำหรับ collectionGroup("${appState.collections.dailySub}")</p>
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
         <div class="bg-slate-900 p-0">
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
            <div>
                <label for="calendar-store-select" class="block text-xs font-medium text-slate-300 mb-1">เลือก Store</label>
                <select id="calendar-store-select"
                    class="w-full md:w-48 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                    ${storeOptionsHtml}
                </select>
            </div>
            <div class="flex items-center gap-2">
                <button id="calendar-prev" class="p-2 rounded-full hover:bg-slate-800 transition">
                    <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <h3 class="text-xl font-bold text-slate-100 text-center w-48">${headerText}</h3>
                <button id="calendar-next" class="p-2 rounded-full hover:bg-slate-800 transition">
                    <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>
            <div class="flex gap-1 bg-slate-800 p-1 rounded-lg">
                <button data-view-mode="month" class="calendar-view-toggle px-4 py-1.5 rounded-md text-sm font-semibold
                    ${appState.calendarViewMode === 'month' ? 'bg-slate-700 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-100'}">
                    รายเดือน
                </button>
                <button data-view-mode="week" class="calendar-view-toggle px-4 py-1.5 rounded-md text-sm font-semibold
                    ${appState.calendarViewMode === 'week' ? 'bg-slate-700 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-100'}">
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
    
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return `
        <div class="grid grid-cols-7 gap-1 text-center">
            ${dayNames.map(name => `<div class="text-xs font-bold text-slate-500 uppercase p-2">${name}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-2">
            ${days.map(day => {
                if (!day) {
                    return `<div class="bg-slate-950 rounded-lg" style="min-height: 7rem;"></div>`;
                }
                
                const dayStr = day.isoDate; // YYYY-MM-DD
                const isUploaded = uploadedDatesSet.has(dayStr);
                const isFuture = day.date > today;
                const isToday = dayStr === todayStr;

                let bgColor = 'bg-slate-800/50';
                let textColor = 'text-slate-200';
                let statusText = '';
                let statusColor = '';
                let cursor = 'cursor-default';

                if (isUploaded) {
                    bgColor = 'bg-green-600';
                    textColor = 'text-white';
                    statusText = 'Uploaded';
                    statusColor = 'text-green-100';
                } else if (isFuture) {
                    bgColor = 'bg-slate-800/30';
                    textColor = 'text-slate-600';
                    statusText = 'Future';
                } else if (!isToday) {
                    bgColor = 'bg-red-900/40';
                    textColor = 'text-red-400 font-semibold';
                    statusText = 'Missing';
                    statusColor = 'text-red-500';
                } else {
                    bgColor = 'bg-amber-800/40 border border-amber-500';
                    textColor = 'text-amber-300 font-bold';
                    statusText = 'Pending';
                    statusColor = 'text-amber-400';
                }

                if (day.isPadding) {
                     bgColor = 'bg-slate-900/30';
                     textColor = 'text-slate-700';
                     statusText = '';
                }

                return `
                    <div 
                        class="${bgColor} rounded-lg p-2 flex flex-col justify-between ${cursor}" 
                        style="min-height: 7rem;" 
                        title="${dayStr} - ${statusText || '...'}">
                        <span class="text-sm font-bold self-end ${textColor}">${day.day}</span>
                        <span class="text-xs font-semibold ${statusColor}">${statusText}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Renders the legend for calendar colors.
 */
function renderCalendarLegend() {
    return `
        <div class="flex flex-wrap gap-x-6 gap-y-2 justify-center mt-6 pt-4 border-t border-slate-800">
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-green-600"></div>
                <span class="text-sm text-slate-400">อัปโหลด Daily KPI แล้ว</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-red-900/40"></div>
                <span class="text-sm text-slate-400">ยังไม่ได้อัปโหลด (ย้อนหลัง)</span>
            </div>
             <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-amber-800/40"></div>
                <span class="text-sm text-slate-400">วันนี้ (รอดำเนินการ)</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-slate-800/30"></div>
                <span class="text-sm text-slate-400">อนาคต</span>
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