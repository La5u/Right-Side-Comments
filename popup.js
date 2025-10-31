const toggle = document.getElementById("toggle");

// Load saved state when popup opens
chrome.storage.local.get(["sidebarEnabled"], (data) => {
  toggle.checked = !!data.sidebarEnabled;
});

// When user toggles in popup
toggle.addEventListener("change", async (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ sidebarEnabled: enabled });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "toggleCommentsSidebar",
      enabled,
    });
  }
});

// Listen for updates from shortcut
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebarEnabled) {
    toggle.checked = changes.sidebarEnabled.newValue;
  }
});
