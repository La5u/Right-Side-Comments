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
chrome.storage.local.get(STORAGE_KEYS, (d) => {
  const sidebarEnabledValue = d.sidebarEnabled !== false;

  toggle.checked = sidebarEnabledValue;
  autoExpand.checked = d.autoExpand !== false;
  showRelated.checked = d.showRelated !== false;
  showScrollbar.checked = d.showScrollbar === true;
  compactMargins.checked = d.compactMargins !== false;
  setSubEnabled(sidebarEnabledValue);
});
updateShortcutLabel();

toggle.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ sidebarEnabled: enabled });
  setSubEnabled(enabled);
  await sendToActiveTab({ action: "toggleCommentsSidebar" });
});

autoExpand.addEventListener("change", async (e) => {
  const autoExpandValue = e.target.checked;
  chrome.storage.local.set({ autoExpand: autoExpandValue });
  await sendToActiveTab({
    action: "setAutoExpand",
    autoExpand: autoExpandValue,
    sidebarEnabled: toggle.checked,
  });
});

showRelated.addEventListener("change", async (e) => {
  const showRelatedValue = e.target.checked;
  chrome.storage.local.set({ showRelated: showRelatedValue });
  await sendToActiveTab({
    action: "setShowRelated",
    showRelated: showRelatedValue,
    sidebarEnabled: toggle.checked,
  });
});

showScrollbar.addEventListener("change", async (e) => {
  const showScrollbarValue = e.target.checked;
  chrome.storage.local.set({ showScrollbar: showScrollbarValue });
  await sendToActiveTab({
    action: "setUiSettings",
    showScrollbar: showScrollbarValue,
    compactMargins: compactMargins.checked,
  });
});

compactMargins.addEventListener("change", async (e) => {
  const compactMarginsValue = e.target.checked;
  chrome.storage.local.set({ compactMargins: compactMarginsValue });
  await sendToActiveTab({
    action: "setUiSettings",
    showScrollbar: showScrollbar.checked,
    compactMargins: compactMarginsValue,
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebarEnabled) {
    const sidebarEnabledValue = changes.sidebarEnabled.newValue !== false;
    toggle.checked = sidebarEnabledValue;
    setSubEnabled(sidebarEnabledValue);
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
