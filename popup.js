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
  const info = await new Promise((resolve) => {
    chrome.runtime.getPlatformInfo((platformInfo) => resolve(platformInfo));
  });
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

autoExpand.addEventListener("change", async (e) => {
  const autoExpandValue = e.target.checked;
  await chrome.storage.local.set({ autoExpand: autoExpandValue });
  await sendToActiveTab({
    action: "setAutoExpand",
    autoExpand: autoExpandValue,
    sidebarEnabled: toggle.checked,
  });
});

showRelated.addEventListener("change", async (e) => {
  const showRelatedValue = e.target.checked;
  await chrome.storage.local.set({ showRelated: showRelatedValue });
  await sendToActiveTab({
    action: "setShowRelated",
    showRelated: showRelatedValue,
    sidebarEnabled: toggle.checked,
  });
});

showScrollbar.addEventListener("change", async (e) => {
  const showScrollbarValue = e.target.checked;
  await chrome.storage.local.set({ showScrollbar: showScrollbarValue });
  await sendToActiveTab({
    action: "setUiSettings",
    showScrollbar: showScrollbarValue,
    compactMargins: compactMargins.checked,
  });
});

compactMargins.addEventListener("change", async (e) => {
  const compactMarginsValue = e.target.checked;
  await chrome.storage.local.set({ compactMargins: compactMarginsValue });
  await sendToActiveTab({
    action: "setUiSettings",
    showScrollbar: showScrollbar.checked,
    compactMargins: compactMarginsValue,
  });
});

persistentCommentBox.addEventListener("change", async (e) => {
  const persistentCommentBoxValue = e.target.checked;
  await chrome.storage.local.set({ persistentCommentBox: persistentCommentBoxValue });
  await sendToActiveTab({
    action: "setLayoutSettings",
    sidebarEnabled: toggle.checked,
    showRelated: showRelated.checked,
    persistentCommentBox: persistentCommentBoxValue,
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebarEnabled) {
    const sidebarEnabledValue = changes.sidebarEnabled.newValue !== false;
    toggle.checked = sidebarEnabledValue;
    setSubEnabled(sidebarEnabledValue);
  }
  if (changes.autoExpand) {
    autoExpand.checked = changes.autoExpand.newValue !== false;
  }
  if (changes.showRelated) {
    showRelated.checked = changes.showRelated.newValue !== false;
  }
  if (changes.showScrollbar) {
    showScrollbar.checked = changes.showScrollbar.newValue === true;
  }
  if (changes.compactMargins) {
    compactMargins.checked = changes.compactMargins.newValue !== false;
  }
  if (changes.persistentCommentBox) {
    persistentCommentBox.checked = changes.persistentCommentBox.newValue !== false;
  }
  if (changes.themeOverride) {
    applyTheme(resolveTheme(changes.themeOverride.newValue));
  }
});
