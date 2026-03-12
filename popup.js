const toggle = document.getElementById("toggle");
const toggleLabel = document.getElementById("toggleLabel");
const autoExpand = document.getElementById("autoExpand");
const showRelated = document.getElementById("showRelated");
const innerScrollbar = document.getElementById("innerScrollbar");
const outerScrollbar = document.getElementById("outerScrollbar");
const compactMargins = document.getElementById("compactMargins");
const staticCommentBox = document.getElementById("staticCommentBox");
const commentsWidth = document.getElementById("commentsWidth");
const commentsWidthValue = document.getElementById("commentsWidthValue");
const hideSideMargins = document.getElementById("hideSideMargins");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");
const versionLabel = document.getElementById("versionLabel");
const root = document.documentElement;
let currentThemeOverride = null;

// Collapsible sections
const defaults = { behavior: true, ui: true, experimental: false };
let state = JSON.parse(localStorage.getItem("rsc-sections"));
if (!state) state = { ...defaults };

document.querySelectorAll(".section-title").forEach(title => {
  const targetId = title.dataset.toggle;
  const content = document.getElementById(targetId);
  const isOpen = state[targetId] ?? defaults[targetId];
  
  if (!isOpen) {
    content.style.display = "none";
    title.textContent = title.textContent.replace("▾", "▸");
  }
  
  title.addEventListener("click", () => {
    const currentlyHidden = content.style.display === "none";
    if (currentlyHidden) {
      content.style.display = "flex";
      title.textContent = title.textContent.replace("▸", "▾");
      state[targetId] = true;
    } else {
      content.style.display = "none";
      title.textContent = title.textContent.replace("▾", "▸");
      state[targetId] = false;
    }
    localStorage.setItem("rsc-sections", JSON.stringify(state));
  });
});
// Settings keys - syncs with DEFAULT_SETTINGS in content.js
// Note: themeOverride is popup-specific and not in content.js
const STORAGE_KEYS = [
  "sidebarEnabled",
  "autoExpand",
  "showRelated",
  "innerScrollbar",
  "outerScrollbar",
  "compactMargins",
  "staticCommentBox",
  "commentsWidth",
  "hideSideMargins",
  "themeOverride",
];

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  root.dataset.theme = theme;
}

function applyThemeWithOverride() {
  const theme = currentThemeOverride === "dark" || currentThemeOverride === "light" 
    ? currentThemeOverride 
    : getSystemTheme();
  applyTheme(theme);
}

function setSubEnabled(mainOn) {
  autoExpand.disabled = !mainOn;
  showRelated.disabled = !mainOn;
  innerScrollbar.disabled = !mainOn;
  outerScrollbar.disabled = !mainOn;
  compactMargins.disabled = !mainOn;
  staticCommentBox.disabled = !mainOn;
  hideSideMargins.disabled = !mainOn;
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
  currentThemeOverride = d.themeOverride;

  toggle.checked = sidebarEnabledValue;
  autoExpand.checked = d.autoExpand !== false;
  showRelated.checked = d.showRelated !== false;
  innerScrollbar.checked = d.innerScrollbar !== false;
  outerScrollbar.checked = d.outerScrollbar === true;
  compactMargins.checked = d.compactMargins !== false;
  staticCommentBox.checked = d.staticCommentBox !== false;
  
  // Show empty if no width set, otherwise show the value
  if (d.commentsWidth !== undefined && d.commentsWidth !== null) {
    commentsWidth.value = d.commentsWidth;
    commentsWidthValue.textContent = `${d.commentsWidth}%`;
  } else {
    commentsWidth.value = 27;
    commentsWidthValue.textContent = "";
  }
  
  hideSideMargins.checked = d.hideSideMargins === true;
  
  applyThemeWithOverride();
  setSubEnabled(sidebarEnabledValue);
});
updateShortcutLabel();

const version = chrome.runtime.getManifest().version;
versionLabel.textContent = `v${version}`;

const mediaTheme = window.matchMedia("(prefers-color-scheme: dark)");
mediaTheme.addEventListener("change", applyThemeWithOverride);

themeToggle.addEventListener("click", async () => {
  const currentTheme = currentThemeOverride === "dark" || currentThemeOverride === "light" 
    ? currentThemeOverride 
    : getSystemTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  currentThemeOverride = nextTheme;
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
  { id: "autoExpand", action: "setAutoExpand" },
  { id: "showRelated", action: "setShowRelated" },
  { id: "innerScrollbar", action: "setUiSettings" },
  { id: "outerScrollbar", action: "setUiSettings" },
  { id: "compactMargins", action: "setUiSettings" },
  { id: "staticCommentBox", action: "setLayoutSettings" },
  { id: "hideSideMargins", action: "setUiSettings" },
];

for (const { id, action } of SETTINGS) {
  document.getElementById(id).addEventListener("change", async (e) => {
    const value = e.target.checked;
    await chrome.storage.local.set({ [id]: value });
    await sendToActiveTab({ action, [id]: value });
  });
}

commentsWidth.addEventListener("input", async (e) => {
  const value = parseInt(e.target.value);
  commentsWidthValue.textContent = `${value}%`;
  commentsWidth.disabled = false;
  await chrome.storage.local.set({ commentsWidth: value });
  await sendToActiveTab({ action: "setUiSettings" });
});

resetBtn.addEventListener("click", async () => {
  const defaults = {
    sidebarEnabled: true,
    autoExpand: true,
    showRelated: true,
    innerScrollbar: true,
    outerScrollbar: false,
    compactMargins: true,
    staticCommentBox: true,
    commentsWidth: null,
    hideSideMargins: false,
  };
  await chrome.storage.local.set(defaults);
  
  toggle.checked = true;
  autoExpand.checked = true;
  showRelated.checked = true;
  innerScrollbar.checked = true;
  outerScrollbar.checked = false;
  compactMargins.checked = true;
  staticCommentBox.checked = true;
  commentsWidth.value = 27;
  commentsWidthValue.textContent = "";
  hideSideMargins.checked = false;
  
  setSubEnabled(true);
  await sendToActiveTab({ action: "toggleCommentsSidebar" });
});

chrome.storage.onChanged.addListener((changes) => {
  const checkboxes = { autoExpand, showRelated, innerScrollbar, outerScrollbar, compactMargins, staticCommentBox, hideSideMargins };

  for (const key in changes) {
    if (key in checkboxes) {
      checkboxes[key].checked = changes[key].newValue;
    }
  }

  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue !== false;
    setSubEnabled(toggle.checked);
  }

  if (changes.commentsWidth) {
    const val = changes.commentsWidth.newValue;
    if (val != null) {
      commentsWidth.value = val;
      commentsWidthValue.textContent = `${val}%`;
    } else {
      commentsWidth.value = 27;
      commentsWidthValue.textContent = "";
    }
  }

  if (changes.themeOverride) {
    currentThemeOverride = changes.themeOverride.newValue;
    applyThemeWithOverride();
  }
});
