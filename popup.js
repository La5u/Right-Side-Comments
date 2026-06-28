const extensionToggle = document.getElementById("extensionToggle");
const extensionToggleLabel = document.getElementById("extensionToggleLabel");
const sidebarModeSelect = document.getElementById("sidebarMode");
const commentsWidth = document.getElementById("commentsWidth");
const commentsWidthValue = document.getElementById("commentsWidthValue");
const commentsWidthReset = document.getElementById("commentsWidthReset");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");
const versionLabel = document.getElementById("versionLabel");
let currentThemeOverride = null;
const COMMENTS_WIDTH_AUTO_LABEL = "Auto";

// Collapsible sections
const defaults = { advanced: false };
let state = JSON.parse(localStorage.getItem("rsc-sections"));
if (!state) state = { ...defaults };

function setSectionExpanded(title, content, isOpen) {
  content.style.display = isOpen ? "flex" : "none";
  title.textContent = title.textContent.replace(isOpen ? "▸" : "▾", isOpen ? "▾" : "▸");
}

document.querySelectorAll(".section-title").forEach(title => {
  const targetId = title.dataset.toggle;
  const content = document.getElementById(targetId);
  const isOpen = state[targetId] ?? defaults[targetId];

  setSectionExpanded(title, content, isOpen);

  title.addEventListener("click", () => {
    const currentlyHidden = content.style.display === "none";
    setSectionExpanded(title, content, currentlyHidden);
    state[targetId] = currentlyHidden;
    localStorage.setItem("rsc-sections", JSON.stringify(state));
  });
});
// Default values matching content.js DEFAULT_SETTINGS
const DEFAULTS = self.RSC_DEFAULTS;

const STORAGE_KEYS = Object.keys(DEFAULTS);

// Controls that become unavailable when the sidebar is off.
const SIDEBAR_ONLY_CONTROLS = new Set([
  "compactMargins",
  "innerScrollbar",
  "staticCommentBox",
  "pinComments",
  "hideSideMargins",
]);

// Sub-controls to dim when the master extension is off.
const SUB_CONTROLS = Object.keys(DEFAULTS).filter(
  (key) => key !== "extensionEnabled" && key !== "sidebarMode" && key !== "themeOverride",
);

function setSidebarMode(mode) {
  if (sidebarModeSelect) sidebarModeSelect.value = mode;
}

function setCommentsWidthDisplay(value) {
  const hasValue = value != null && value !== "";
  commentsWidth.value = hasValue ? value : "";
  commentsWidthValue.textContent = hasValue ? `${value}%` : COMMENTS_WIDTH_AUTO_LABEL;
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function applyThemeWithOverride() {
  if (currentThemeOverride === "dark" || currentThemeOverride === "light") {
    applyTheme(currentThemeOverride);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function syncAvailabilityFromCurrentState() {
  syncControlAvailability(
    extensionToggle?.checked ?? DEFAULTS.extensionEnabled,
    sidebarModeSelect?.value ?? DEFAULTS.sidebarMode,
  );
}

function syncControlAvailability(extensionOn, sidebarMode) {
  const sidebarRow = sidebarModeSelect?.closest(".row");
  if (sidebarModeSelect) sidebarModeSelect.disabled = !extensionOn;
  sidebarRow?.classList.toggle("dimmer", !extensionOn);
  commentsWidthReset?.classList.toggle("dimmer", !extensionOn || sidebarMode === "disabled");
  if (commentsWidthReset) commentsWidthReset.style.pointerEvents = !extensionOn || sidebarMode === "disabled" ? "none" : "";

  for (const id of SUB_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const sidebarOnly = SIDEBAR_ONLY_CONTROLS.has(id);
    const disabled = !extensionOn || (id === "commentsWidth" ? sidebarMode === "disabled" : sidebarMode !== "default" && sidebarOnly);
    el.disabled = disabled;
    el.closest(".row")?.classList.toggle("dimmer", disabled);
    if (id === "commentsWidth") {
      el.previousElementSibling?.classList.toggle("dimmer", disabled);
      el.classList.toggle("dimmer", disabled);
    }
  }
}

async function updateShortcutLabel() {
  const info = await chrome.runtime.getPlatformInfo();
  const shortcut =
    info.os === "mac" ? "⌘+Shift+Y" : info.os === "linux" ? "Ctrl+Shift+U" : "Ctrl+Shift+Y";
  if (extensionToggleLabel) extensionToggleLabel.textContent = `Extension (${shortcut})`;
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    // Ignore tabs where the content script is not injected.
  }
}
chrome.storage.local.get(STORAGE_KEYS, (d) => {
  currentThemeOverride = d.themeOverride;
  const sidebarMode = d.sidebarMode ?? DEFAULTS.sidebarMode;

  if (extensionToggle) extensionToggle.checked = d.extensionEnabled ?? DEFAULTS.extensionEnabled;
  setSidebarMode(sidebarMode);
  
  for (const id of SUB_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === "commentsWidth") {
      setCommentsWidthDisplay(d.commentsWidth ?? DEFAULTS.commentsWidth);
      continue;
    }
    if (el.tagName === "INPUT" && el.type !== "checkbox") continue;
    el.checked = d[id] ?? DEFAULTS[id];
  }

  applyThemeWithOverride();
  syncAvailabilityFromCurrentState();
});
updateShortcutLabel();

const version = chrome.runtime.getManifest().version;
versionLabel.textContent = `v${version}`;

themeToggle.addEventListener("click", async () => {
  const currentTheme = currentThemeOverride === "dark" || currentThemeOverride === "light" 
    ? currentThemeOverride 
    : getSystemTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  currentThemeOverride = nextTheme;
  await chrome.storage.local.set({ themeOverride: nextTheme });
  applyTheme(nextTheme);
});

extensionToggle?.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ extensionEnabled: enabled });
  syncAvailabilityFromCurrentState();
  await sendToActiveTab({ action: "setLayoutSettings" });
});

sidebarModeSelect?.addEventListener("change", async (e) => {
  const mode = e.target.value;
  await chrome.storage.local.set({ sidebarMode: mode });
  syncAvailabilityFromCurrentState();
  await sendToActiveTab({ action: "setLayoutSettings" });
});

for (const id of SUB_CONTROLS) {
  const el = document.getElementById(id);
  if (!el) continue;
  const action = el.dataset.action;
  if (el.type === "range") {
    el.addEventListener("input", async (e) => {
      const value = parseInt(e.target.value);
      setCommentsWidthDisplay(value);
      await chrome.storage.local.set({ [id]: value });
    });

    el.addEventListener("change", async (e) => {
      const value = parseInt(e.target.value);
      setCommentsWidthDisplay(value);
      await chrome.storage.local.set({ [id]: value });
      if (action) await sendToActiveTab({ action, commentsWidth: value });
    });
    continue;
  }

  el.addEventListener("change", async (e) => {
    const value = e.target.checked;
    await chrome.storage.local.set({ [id]: value });
    if (action) await sendToActiveTab({ action, key: id, value });
  });
}

commentsWidthReset?.addEventListener("click", async () => {
  if (commentsWidthReset.style.pointerEvents === "none") return;
  await chrome.storage.local.set({ commentsWidth: null });
  setCommentsWidthDisplay(null);
  await sendToActiveTab({ action: "setUiSettings", commentsWidth: null });
});

resetBtn.addEventListener("click", async () => {
  await chrome.storage.local.set(DEFAULTS);
  
  if (extensionToggle) extensionToggle.checked = DEFAULTS.extensionEnabled;
  setSidebarMode(DEFAULTS.sidebarMode);
  for (const id of SUB_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === "commentsWidth") {
      setCommentsWidthDisplay(DEFAULTS.commentsWidth);
    } else {
      el.checked = DEFAULTS[id];
    }
  }
  
  syncAvailabilityFromCurrentState();
  await sendToActiveTab({ action: "setLayoutSettings" });
});

chrome.storage.onChanged.addListener((changes) => {
  for (const key in changes) {
    const el = document.getElementById(key);
    if (!el || el.type === "checkbox") {
      if (el) el.checked = changes[key].newValue;
    }
  }

  if (changes.sidebarMode) {
    setSidebarMode(changes.sidebarMode.newValue ?? DEFAULTS.sidebarMode);
  }

  if (changes.extensionEnabled) {
    if (extensionToggle) extensionToggle.checked = changes.extensionEnabled.newValue;
  }

  if (changes.commentsWidth) {
    setCommentsWidthDisplay(changes.commentsWidth.newValue);
  }

  if (changes.themeOverride) {
    currentThemeOverride = changes.themeOverride.newValue;
    applyThemeWithOverride();
  }

  syncAvailabilityFromCurrentState();
});
