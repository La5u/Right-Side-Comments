// Default settings - must match DEFAULTS in popup.js and DEFAULT_SETTINGS in content.js
const DEFAULTS = {
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
  chrome.action.setIcon({ path: getActionIconPath(sidebarEnabled ?? true) });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set(DEFAULTS);
    chrome.tabs.create({ url: "https://lasu.dev/right-side-comments" });
  }
  syncActionIconFromStorage();
});

chrome.runtime.onStartup.addListener(syncActionIconFromStorage);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.sidebarEnabled) return;
  chrome.action.setIcon({ path: getActionIconPath(changes.sidebarEnabled.newValue) });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-comments-sidebar") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const { sidebarEnabled } = await chrome.storage.local.get(["sidebarEnabled"]);
  const newState = !(sidebarEnabled ?? true);
  await chrome.storage.local.set({ sidebarEnabled: newState });

  await chrome.tabs.sendMessage(tab.id, { action: "toggleCommentsSidebar" }).catch(() => {});
});
