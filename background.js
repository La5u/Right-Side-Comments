function getActionIconPath(enabled) {
  return enabled
    ? {
        16: "assets/icon16.png",
        32: "assets/icon32.png",
        48: "assets/icon48.png",
        96: "assets/icon96.png",
        128: "assets/icon128.png",
      }
    : {
        16: "assets/iconoff16.png",
        32: "assets/iconoff32.png",
        48: "assets/iconoff48.png",
        96: "assets/iconoff96.png",
        128: "assets/iconoff128.png",
      };
}

async function syncActionIconFromStorage() {
  const { sidebarEnabled } = await chrome.storage.local.get(["sidebarEnabled"]);
  const enabled = sidebarEnabled !== false;
  chrome.action.setIcon({ path: getActionIconPath(enabled) });
}

chrome.runtime.onInstalled.addListener((details) => {
  // Keep user settings on updates; only seed defaults on first install.
  if (details.reason === "install") {
    chrome.storage.local.set({
      sidebarEnabled: true,
      autoExpand: true,
      showRelated: true,
      showScrollbar: false,
      compactMargins: true,
      persistentCommentBox: true,
    });
    chrome.tabs.create({
      url: "https://la5u.github.io/Right-Side-Comments/",
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
