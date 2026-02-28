const toggle = document.getElementById("toggle");
const toggleLabel = document.getElementById("toggleLabel");
const autoExpand = document.getElementById("autoExpand");
const showRelated = document.getElementById("showRelated");
const showScrollbar = document.getElementById("showScrollbar");
const compactMargins = document.getElementById("compactMargins");
const STORAGE_KEYS = [
  "sidebarEnabled",
  "autoExpand",
  "showRelated",
  "hideRelated",
  "showScrollbar",
  "compactMargins",
];

function setSubEnabled(mainOn) {
  autoExpand.disabled = !mainOn;
  showRelated.disabled = !mainOn;
  showScrollbar.disabled = !mainOn;
  compactMargins.disabled = !mainOn;
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
  if (tab?.id) chrome.tabs.sendMessage(tab.id, message);
}
// legacy hiderelated
chrome.storage.local.get(STORAGE_KEYS, (d) => {
  const showRelatedValue =
    typeof d.showRelated === "boolean"
      ? d.showRelated
      : typeof d.hideRelated === "boolean"
        ? !d.hideRelated
        : false;

  toggle.checked = !!d.sidebarEnabled;
  autoExpand.checked = d.autoExpand !== false;
  showRelated.checked = showRelatedValue;
  showScrollbar.checked = d.showScrollbar === true;
  compactMargins.checked = d.compactMargins !== false;
  setSubEnabled(!!d.sidebarEnabled);

  if (typeof d.showRelated !== "boolean") {
    chrome.storage.local.set({
      showRelated: showRelatedValue,
    });
  }
});
updateShortcutLabel();

toggle.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ sidebarEnabled: enabled });
  chrome.action.setIcon({ path: enabled ? "icon.png" : "iconoff.png" });
  setSubEnabled(enabled);
  await sendToActiveTab({ action: "toggleCommentsSidebar", enabled });
});

autoExpand.addEventListener("change", async (e) => {
  chrome.storage.local.set({ autoExpand: e.target.checked });
  await sendToActiveTab({ action: "applyCurrentSettings" });
});

showRelated.addEventListener("change", async (e) => {
  chrome.storage.local.set({ showRelated: e.target.checked });
  await sendToActiveTab({ action: "applyCurrentSettings" });
});

showScrollbar.addEventListener("change", async (e) => {
  chrome.storage.local.set({ showScrollbar: e.target.checked });
  await sendToActiveTab({ action: "applyCurrentSettings" });
});

compactMargins.addEventListener("change", async (e) => {
  chrome.storage.local.set({ compactMargins: e.target.checked });
  await sendToActiveTab({ action: "applyCurrentSettings" });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue;
    setSubEnabled(!!changes.sidebarEnabled.newValue);
  }
  if (changes.showRelated) {
    showRelated.checked = !!changes.showRelated.newValue;
  }
  if (changes.showScrollbar) {
    showScrollbar.checked = !!changes.showScrollbar.newValue;
  }
  if (changes.compactMargins) {
    compactMargins.checked = !!changes.compactMargins.newValue;
  }
});
