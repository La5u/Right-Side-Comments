const toggle = document.getElementById("toggle");
const toggleLabel = document.getElementById("toggleLabel");
const commentsWidth = document.getElementById("commentsWidth");
const commentsWidthValue = document.getElementById("commentsWidthValue");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");
const versionLabel = document.getElementById("versionLabel");
let currentThemeOverride = null;

// Collapsible sections
const defaults = { behavior: true, ui: true, experiments: false };
let state = JSON.parse(localStorage.getItem("rsc-sections"));
if (!state) state = { ...defaults };

document.querySelectorAll(".section-title").forEach(title => {
  const targetId = title.dataset.toggle;
  const content = document.getElementById(targetId);
  const isOpen = state[targetId] ?? defaults[targetId];
  
  if (!isOpen) {
    content.style.display = "none";
    title.textContent = title.textContent.replace("▾", "▸");
  } else {
    content.style.display = "flex";
    title.textContent = title.textContent.replace("▸", "▾");
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
// Default values matching content.js DEFAULT_SETTINGS
const DEFAULTS = self.RSC_DEFAULTS;

const STORAGE_KEYS = Object.keys(DEFAULTS);

// Sub-controls to dim when sidebar is off
const SUB_CONTROLS = Object.keys(DEFAULTS).filter(
  (key) => key !== "sidebarEnabled" && key !== "themeOverride",
);

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

function setSubEnabled(mainOn) {
  for (const id of SUB_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.disabled = !mainOn;
    el.closest(".row")?.classList.toggle("dimmer", !mainOn);
    if (id === "commentsWidth") {
      el.previousElementSibling?.classList.toggle("dimmer", !mainOn);
      el.classList.toggle("dimmer", !mainOn);
    }
  }
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
  currentThemeOverride = d.themeOverride;

  toggle.checked = d.sidebarEnabled ?? DEFAULTS.sidebarEnabled;
  
  for (const id of SUB_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === "commentsWidth") {
      const val = d.commentsWidth ?? DEFAULTS.commentsWidth;
      if (val != null) {
        el.value = val;
        commentsWidthValue.textContent = `${val}%`;
      } else {
        el.value = "";
        commentsWidthValue.textContent = "Auto";
      }
      continue;
    }
    if (el.tagName === "INPUT" && el.type !== "checkbox") continue;
    el.checked = d[id] ?? DEFAULTS[id];
  }

  applyThemeWithOverride();
  setSubEnabled(toggle.checked);
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

toggle.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  await chrome.storage.local.set({ sidebarEnabled: enabled });
  setSubEnabled(enabled);
  await sendToActiveTab({ action: "toggleCommentsSidebar" });
});

for (const id of SUB_CONTROLS) {
  const el = document.getElementById(id);
  if (!el) continue;
  const action = el.dataset.action;
  if (el.type === "range") {
    el.addEventListener("input", async (e) => {
      const value = parseInt(e.target.value);
      commentsWidthValue.textContent = `${value}%`;
      await chrome.storage.local.set({ [id]: value });
      if (action) await sendToActiveTab({ action });
    });

    el.addEventListener("change", async (e) => {
      const value = parseInt(e.target.value);
      commentsWidthValue.textContent = `${value}%`;
      await chrome.storage.local.set({ [id]: value });
      await sendToActiveTab({ action: "refreshLayout" });
    });
    continue;
  }

  el.addEventListener("change", async (e) => {
    const value = e.target.checked;
    await chrome.storage.local.set({ [id]: value });
    if (action) await sendToActiveTab({ action });
  });
}

resetBtn.addEventListener("click", async () => {
  await chrome.storage.local.set(DEFAULTS);
  
  toggle.checked = DEFAULTS.sidebarEnabled;
  for (const id of SUB_CONTROLS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (id === "commentsWidth") {
      el.value = "";
      commentsWidthValue.textContent = "Auto";
    } else {
      el.checked = DEFAULTS[id];
    }
  }
  
  setSubEnabled(true);
  await sendToActiveTab({ action: "toggleCommentsSidebar" });
});

chrome.storage.onChanged.addListener((changes) => {
  for (const key in changes) {
    const el = document.getElementById(key);
    if (!el || el.type === "checkbox") {
      if (el) el.checked = changes[key].newValue;
    }
  }

  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue;
    setSubEnabled(toggle.checked);
  }

  if (changes.commentsWidth) {
    const val = changes.commentsWidth.newValue;
    if (val != null) {
      commentsWidth.value = val;
      commentsWidthValue.textContent = `${val}%`;
    } else {
      commentsWidth.value = "";
      commentsWidthValue.textContent = "Auto";
    }
  }

  if (changes.themeOverride) {
    currentThemeOverride = changes.themeOverride.newValue;
    applyThemeWithOverride();
  }
});
