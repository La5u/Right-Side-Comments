let sidebarEnabled = true;
const qs = (s) => document.querySelector(s);

/** Waits until the #comments element is available */
const ensureCommentsLoaded = async () => {
  let c = document.getElementById("comments");
  if (c) return c;

  return new Promise((resolve) => {
    const obs = new MutationObserver(() => {
      c = document.getElementById("comments");
      if (c) {
        obs.disconnect();
        resolve(c);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
};

/** Expands the video description if collapsed */
function expandDescription() {
  const tryExpand = () => {
    const btn = qs("tp-yt-paper-button#expand.button.ytd-text-inline-expander");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  };

  if (tryExpand()) return; // already available

  // Observe the section where it usually appears
  const container = qs("#below") || qs("ytd-text-inline-expander") || document.body;
  const obs = new MutationObserver(() => {
    if (tryExpand()) obs.disconnect();
  });
  obs.observe(container, { childList: true, subtree: true });
}

/** Moves comments into the sidebar (on=true) or restores them (on=false) */
async function toggleSidebar(on) {
  sidebarEnabled = on;
  const sec = qs("#secondary");
  const rel = qs("#related");
  if (!sec || !rel) return;

  const c = document.getElementById("comments") || (await ensureCommentsLoaded());

  if (on) {
    expandDescription();
    rel.style.display = "none";
    sec.appendChild(c);
    c.style.display = "block";
  } else {
    rel.style.display = "";
    (qs("#below") || qs("#below-the-fold"))?.appendChild(c);
    c.style.maxHeight = "";

    const collapseBtn = qs("tp-yt-paper-button#collapse.button.ytd-text-inline-expander");
    if (collapseBtn) collapseBtn.click();
  }
}

/** Handles messages from popup or background script */
chrome.runtime.onMessage.addListener(({ action, enabled }) => {
  if (action === "toggleCommentsSidebar") toggleSidebar(enabled);
});

/** Applies the sidebar automatically if enabled */
const applyIfEnabled = async () => {
  const { sidebarEnabled } = await chrome.storage.local.get("sidebarEnabled");
  if (sidebarEnabled) {
    // slight delay to let YouTube finish rendering
    setTimeout(() => toggleSidebar(true), 600);
  }
};

applyIfEnabled();
window.addEventListener("yt-navigate-finish", applyIfEnabled);
