const qs = (s) => document.querySelector(s);

// MULTIPLE ASYNC FUNCTIONS USED TO WAIT UNTIL ELEMENTS ARE LOADED
// Waits until the #comments element is available
const ensureCommentsLoaded = async () => {
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
  const container = qs("#below") || qs("ytd-text-inline-expander");
  const obs = new MutationObserver(() => {
    const btn = qs("tp-yt-paper-button#expand.button.ytd-text-inline-expander");
    if (btn) {
      btn.click();
      obs.disconnect();
    }
  });

  obs.observe(container, { childList: true, subtree: true });
}

/** Moves comments into the sidebar (on=true) or restores them (on=false) */
async function toggleSidebar(sidebarEnabled) {
  const sec = qs("div#secondary.ytd-watch-flexy");
  const rel = qs("#related");
  const c = await ensureCommentsLoaded();

  if (sidebarEnabled) {
    expandDescription();
    rel.style.display = "none";

    // these two to make it scrollable while viewing video
    c.style.maxHeight="100vh";
    c.style.overflowY="auto";

    sec.style.paddingRight="0px"; //extra space on the right side for comments
    sec.appendChild(c); //move comments to sidebar

  } else {
    const collapseBtn = qs("tp-yt-paper-button#collapse.button.ytd-text-inline-expander");
    if (collapseBtn) collapseBtn.click();
    //reset styling
    rel.style.display = "";
    c.style.maxHeight = "";
    c.style.overflowY = "";
    sec.style.paddingRight = "";
    qs("#below")?.appendChild(c); //move comments back
  }
}

/** Handles messages from popup or background script */
chrome.runtime.onMessage.addListener(({ action, enabled }) => {
  if (action === "toggleCommentsSidebar") {
    toggleSidebar(enabled);
  }
});

window.addEventListener("yt-navigate-finish", async () => {
  if (location.pathname === "/watch") {
    const { sidebarEnabled } = await chrome.storage.local.get("sidebarEnabled");
    if (sidebarEnabled) {
      toggleSidebar(sidebarEnabled)
    }
  }
});
