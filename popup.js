const toggle = document.getElementById("toggle");
const autoExpand = document.getElementById("autoExpand");
const hideRelated = document.getElementById("hideRelated");
const STORAGE_KEYS = ["sidebarEnabled", "autoExpand", "hideRelated"];

function setSubEnabled(mainOn) {
  autoExpand.disabled = !mainOn;
  hideRelated.disabled = !mainOn;
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, message);
}

chrome.storage.local.get(STORAGE_KEYS, (d) => {
  toggle.checked = !!d.sidebarEnabled;
  autoExpand.checked = d.autoExpand !== false;
  hideRelated.checked = d.hideRelated !== false;
  setSubEnabled(!!d.sidebarEnabled);
});

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

hideRelated.addEventListener("change", async (e) => {
  chrome.storage.local.set({ hideRelated: e.target.checked });
  await sendToActiveTab({ action: "applyCurrentSettings" });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue;
    setSubEnabled(!!changes.sidebarEnabled.newValue);
  }
});
