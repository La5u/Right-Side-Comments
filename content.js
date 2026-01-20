const qs = (s) => document.body.querySelector(s);

// Function used to wait until elements are loaded
function waitFor(target) {
  return new Promise((resolve) => {
    const get = typeof target === "function"
      ? target
      : () => qs(target);

    const existing = get();
    if (existing) return resolve(existing);

    const obs = new MutationObserver(() => {
      const el = get();
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  });
}

/** Moves comments into the sidebar (on=true) or restores them (on=false) */
async function toggleSidebar(sidebarEnabled, { hideRelated } = {}) {
  const sec = qs("div#secondary.ytd-watch-flexy");
  const rel = qs("#related");
  const c = await waitFor("ytd-comments#comments");

  if (sidebarEnabled) {
    if (sec.contains(c)) return;

    // Delete recommendations if enabled
    if (hideRelated) {
      rel.style.display = "none";
    }
    if (!hideRelated) {
      rel.style.display = "";
      rel.style.marginTop = "32px";
    }
    // these two to make it scrollable while viewing video
    c.style.maxHeight="100vh";
    c.style.overflowY="auto";
    // sec.style.paddingRight="0px" //for chromium works well, as there is more space

    sec.appendChild(c);//move comments to sidebar
    if (!hideRelated) sec.appendChild(rel);

  } else {

    //reset styling
    rel.style.display = "";
    c.style.maxHeight = "";
    c.style.overflowY = "";
    rel.style.marginTop = "";
    // sec.style.paddingRight = ""; //for chromium
    qs("#below")?.appendChild(c); //move comments back
  }
}

/** Handles messages from popup or shortcut */
chrome.runtime.onMessage.addListener(async ({ action, enabled }) => {
  if (action === "toggleCommentsSidebar") {
    const { autoExpand, hideRelated } = await chrome.storage.local.get(["autoExpand", "hideRelated"]);
    toggleSidebar(enabled, { hideRelated });

    if (enabled && autoExpand) {
      document.getElementById("expand")?.click();
    } else {
      document.getElementById("collapse")?.click();
    }
  }
});

window.addEventListener("yt-navigate-finish", async () => {
  if (location.pathname === "/watch") {
    const { sidebarEnabled, autoExpand, hideRelated } = await chrome.storage.local.get(["sidebarEnabled", "autoExpand", "hideRelated"]);
    if (sidebarEnabled) {
      toggleSidebar(true, { hideRelated });
      if (autoExpand) document.getElementById("expand")?.click();
    }
  }
});
