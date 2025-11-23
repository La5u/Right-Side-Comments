chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-comments-sidebar") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Get current state
    chrome.storage.local.get(["sidebarEnabled"], (data) => {
      const newState = !data.sidebarEnabled;
      chrome.storage.local.set({ sidebarEnabled: newState });
      chrome.action.setIcon({
        path: newState ? "icon.png" : "iconoff.png"
      });

      // Send toggle message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: "toggleCommentsSidebar",
        enabled: newState,
      });
    });
  }
});
