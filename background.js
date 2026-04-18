if (typeof importScripts === "function") {
  importScripts("defaults.js");
}
const DEFAULTS = self.RSC_DEFAULTS;

function getActionIconPath(enabled) {
  const sizes = [16, 32, 48, 96, 128];
  const suffix = enabled ? "" : "off";
  return Object.fromEntries(sizes.map((size) => [
    size,
    `assets/icon${suffix}${size}.png`,
  ]));
}

async function syncActionIconFromStorage() {
  const { extensionEnabled } = await chrome.storage.local.get(["extensionEnabled"]);
  chrome.action.setIcon({ path: getActionIconPath(extensionEnabled ?? true) });
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
  if (areaName !== "local" || !changes.extensionEnabled) return;
  chrome.action.setIcon({ path: getActionIconPath(changes.extensionEnabled.newValue) });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-comments-sidebar") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const { extensionEnabled } = await chrome.storage.local.get(["extensionEnabled"]);
  const newState = !(extensionEnabled ?? true);
  await chrome.storage.local.set({ extensionEnabled: newState });

  await chrome.tabs.sendMessage(tab.id, { action: "setLayoutSettings" }).catch(() => {});
});
