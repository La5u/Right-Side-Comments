function getActionIconPath(enabled) {
  const sizes = [16, 32, 48, 96, 128];
  const suffix = enabled ? "" : "off";
  return Object.fromEntries(sizes.map((size) => [
    size,
    `assets/icon${suffix}${size}.png`,
  ]));
}

async function syncActionIconFromStorage() {
  const { sidebarEnabled } = await chrome.storage.local.get(["sidebarEnabled"]);
  const enabled = sidebarEnabled !== false;
  chrome.action.setIcon({ path: getActionIconPath(enabled) });
}

chrome.runtime.onInstalled.addListener((details) => {
  // Keep user settings on updates; only seed defaults on first install.
  if (details.reason === "install") {
    // Default settings - must match DEFAULT_SETTINGS in content.js
    chrome.storage.local.set({
    sidebarEnabled: true,
    autoExpand: true,
    showRelated: true,
    innerScrollbar: true,
    outerScrollbar: false,
    compactMargins: true,
    staticCommentBox: true,
    commentsWidth: null,
    hideSideMargins: false,
  });
    chrome.tabs.create({
      url: "https://lasu.dev/right-side-comments",
    });
  }
  syncActionIconFromStorage();
});

chrome.runtime.onStartup.addListener(syncActionIconFromStorage);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.sidebarEnabled) return;
  const enabled = changes.sidebarEnabled.newValue !== false;
  chrome.action.setIcon({ path: getActionIconPath(enabled) });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-comments-sidebar") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const { sidebarEnabled } = await chrome.storage.local.get(["sidebarEnabled"]);
  const currentState = sidebarEnabled !== false;
  const newState = !currentState;
  await chrome.storage.local.set({ sidebarEnabled: newState });

  // Send toggle message to content script
  await chrome.tabs.sendMessage(tab.id, {
    action: "toggleCommentsSidebar",
  }).catch(() => {});
});
