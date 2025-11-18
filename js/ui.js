// ui.js
// KPI Data Processor – Code V09 (LoginFirst + Calendar)

const THEME_KEY = "kpi-theme";

// ---- THEME ----
function updateThemeIcons(theme) {
  const mobileBtn = document.getElementById("btnThemeToggle");
  const desktopBtn = document.getElementById("btnThemeToggleDesktop");
  const icon = theme === "dark" ? "🌙" : "☀️";

  if (mobileBtn) {
    const span = mobileBtn.querySelector("span");
    if (span) span.textContent = icon;
  }
  if (desktopBtn) {
    const span = desktopBtn.querySelector("span");
    if (span) span.textContent = icon;
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // ignore
  }
  updateThemeIcons(theme);
}

export function initTheme() {
  let saved = "light";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") saved = stored;
  } catch (e) {
    // ignore
  }
  applyTheme(saved);
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

// ---- TABS ----
export function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  if (!buttons.length || !panels.length) return;

  function setActive(tabId) {
    panels.forEach((panel) => {
      if (panel.id === tabId) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    });
    buttons.forEach((btn) => {
      const target = btn.getAttribute("data-tab");
      if (target === tabId) {
        btn.classList.add("tab-btn-active");
        btn.classList.remove("tab-btn-inactive");
      } else {
        btn.classList.add("tab-btn-inactive");
        btn.classList.remove("tab-btn-active");
      }
    });
  }

  // ซ่อน Calendar tab (เราใช้ Reports = Calendar แทน)
  const calendarTabBtn = document.querySelector(
    '.tab-btn[data-tab="tab-calendar"]'
  );
  if (calendarTabBtn) calendarTabBtn.classList.add("hidden");
  const calendarPanel = document.getElementById("tab-calendar");
  if (calendarPanel) calendarPanel.classList.add("hidden");

  // ผูกคลิกปุ่ม tab
  buttons.forEach((btn) => {
    btn.addEventL
