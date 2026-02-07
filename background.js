chrome.runtime.onInstalled.addListener((details) => {
  // Keep user settings on updates; only seed defaults on first install.
  if (details.reason !== "install") return;
  chrome.storage.local.set({
    sidebarEnabled: true,
    autoExpand: true,
    hideRelated: true,
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-comments-sidebar") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Get current state
  chrome.storage.local.get(["sidebarEnabled"], (data) => {
    const newState = !data.sidebarEnabled;
    chrome.storage.local.set({ sidebarEnabled: newState });
    chrome.action.setIcon({
      path: newState ? "icon.png" : "iconoff.png",
    });

    // Send toggle message to content script
    chrome.tabs.sendMessage(tab.id, {
      action: "toggleCommentsSidebar",
      enabled: newState,
    });
  });
});
