const toggle = document.getElementById("toggle");
const autoExpand = document.getElementById("autoExpand");
const hideRelated = document.getElementById("hideRelated");

function setSubEnabled(mainOn) {
  autoExpand.disabled = !mainOn;
  hideRelated.disabled = !mainOn;
}

chrome.storage.local.get(["sidebarEnabled", "autoExpand", "hideRelated"], (d) => {
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

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "toggleCommentsSidebar", enabled });
  }
});

autoExpand.addEventListener("change", (e) => {
  chrome.storage.local.set({ autoExpand: e.target.checked });
});

hideRelated.addEventListener("change", (e) => {
  chrome.storage.local.set({ hideRelated: e.target.checked });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue;
    setSubEnabled(!!changes.sidebarEnabled.newValue);
  }
});
