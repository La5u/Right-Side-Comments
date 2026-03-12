const toggle = document.getElementById("toggle");
const toggleLabel = document.getElementById("toggleLabel");
const autoExpand = document.getElementById("autoExpand");
const showRelated = document.getElementById("showRelated");
const showScrollbar = document.getElementById("showScrollbar");
const compactMargins = document.getElementById("compactMargins");
const persistentCommentBox = document.getElementById("persistentCommentBox");
const themeToggle = document.getElementById("themeToggle");
const versionLabel = document.getElementById("versionLabel");
const root = document.documentElement;
// Settings keys - syncs with DEFAULT_SETTINGS in content.js
// Note: themeOverride is popup-specific and not in content.js
const STORAGE_KEYS = [
  "sidebarEnabled",
  "autoExpand",
  "showRelated",
  "showScrollbar",
  "compactMargins",
  "persistentCommentBox",
  "themeOverride",
];
const THEME_OVERRIDE_KEY = "themeOverride";

applyTheme(getSystemTheme());

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  root.dataset.theme = theme;
}

function resolveTheme(override) {
  return override === "dark" || override === "light" ? override : getSystemTheme();
}

function setSubEnabled(mainOn) {
  autoExpand.disabled = !mainOn;
  showRelated.disabled = !mainOn;
  showScrollbar.disabled = !mainOn;
  compactMargins.disabled = !mainOn;
  persistentCommentBox.disabled = !mainOn;
}

async function updateShortcutLabel() {
  const info = await chrome.runtime.getPlatformInfo();
  const shortcut =
    info.os === "mac" ? "⌘+Shift+Y" : info.os === "linux" ? "Ctrl+Shift+U" : "Ctrl+Shift+Y";
  toggleLabel.textContent = `Sidebar (${shortcut})`;
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
  const sidebarEnabledValue = d.sidebarEnabled !== false;

  toggle.checked = sidebarEnabledValue;
  autoExpand.checked = d.autoExpand !== false;
  showRelated.checked = d.showRelated !== false;
  showScrollbar.checked = d.showScrollbar === true;
  compactMargins.checked = d.compactMargins !== false;
  persistentCommentBox.checked = d.persistentCommentBox !== false;
  applyTheme(resolveTheme(d.themeOverride));
  setSubEnabled(sidebarEnabledValue);
});
updateShortcutLabel();

const version = chrome.runtime.getManifest().version;
versionLabel.textContent = `v${version}`;

const mediaTheme = window.matchMedia("(prefers-color-scheme: dark)");
mediaTheme.addEventListener("change", async () => {
  const data = await chrome.storage.local.get(THEME_OVERRIDE_KEY);
  if (data.themeOverride !== "dark" && data.themeOverride !== "light") {
    applyTheme(getSystemTheme());
  }
});

themeToggle.addEventListener("click", async () => {
  const data = await chrome.storage.local.get(THEME_OVERRIDE_KEY);
  const currentTheme = resolveTheme(data.themeOverride);
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  await chrome.storage.local.set({ themeOverride: nextTheme });
  applyTheme(nextTheme);
});

toggle.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ sidebarEnabled: enabled });
  setSubEnabled(enabled);
  await sendToActiveTab({ action: "toggleCommentsSidebar" });
});

const SETTINGS = [
  { id: "autoExpand", action: "setAutoExpand", extra: () => ({ sidebarEnabled: toggle.checked }) },
  { id: "showRelated", action: "setShowRelated", extra: () => ({ sidebarEnabled: toggle.checked }) },
  { id: "showScrollbar", action: "setUiSettings", extra: () => ({ compactMargins: compactMargins.checked }) },
  { id: "compactMargins", action: "setUiSettings", extra: () => ({ showScrollbar: showScrollbar.checked }) },
  { id: "persistentCommentBox", action: "setLayoutSettings", extra: () => ({ sidebarEnabled: toggle.checked, showRelated: showRelated.checked }) },
];

for (const { id, action, extra } of SETTINGS) {
  document.getElementById(id).addEventListener("change", async (e) => {
    const value = e.target.checked;
    await chrome.storage.local.set({ [id]: value });
    await sendToActiveTab({ action, [id]: value, ...extra() });
  });
}

chrome.storage.onChanged.addListener((changes) => {
  const checkboxes = { autoExpand, showRelated, showScrollbar, compactMargins, persistentCommentBox };

  for (const key in changes) {
    if (key in checkboxes) {
      checkboxes[key].checked = changes[key].newValue;
    }
  }

  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue !== false;
    setSubEnabled(toggle.checked);
  }

  if (changes.themeOverride) {
    applyTheme(resolveTheme(changes.themeOverride.newValue));
  }
});
