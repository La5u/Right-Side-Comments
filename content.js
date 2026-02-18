const qs = (s, root = document) => root?.querySelector(s) || null;

// Single active toggle flow; new actions cancel stale waits.
let activeToggleController = null;

// Wait until target selector/function resolves to an element.
function waitFor(target, { signal } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);
    const get = typeof target === "function" ? target : () => qs(target);
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      obs.disconnect();
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => done(null);
    const existing = get();
    if (existing) return done(existing);
    const obs = new MutationObserver(() => {
      const el = get();
      if (el) done(el);
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
}

/** Moves comments into the sidebar (on=true) or restores them (on=false) */
async function toggleSidebar(sidebarEnabled, { hideRelated } = {}) {
  // Latest intent wins: cancel any older in-flight operation.
  activeToggleController?.abort();
  activeToggleController = new AbortController();
  const signal = activeToggleController.signal;

  const sec = await waitFor("div#secondary.ytd-watch-flexy", { signal });
  const c = await waitFor("ytd-comments#comments", { signal });
  const rel = qs("#related");
  if (signal.aborted || !sec || !c) return false;

  if (sidebarEnabled) {
    //hide recommendations
    if (rel) rel.style.display = hideRelated ? "none" : ""; 

    //put the comments in a scrollbale box
    c.style.maxHeight = "100vh"; 
    c.style.overflowY = "auto";

    if (!hideRelated && rel?.parentNode === sec) {
      // Keep related stable for thumbnails; only move comments.
      sec.insertBefore(c, rel);
    } else {
      if (!sec.contains(c)) sec.appendChild(c);
      if (!hideRelated && rel?.parentNode !== sec) sec.appendChild(rel);
    }
  } else {
    if (rel) rel.style.display = "";
    c.style.maxHeight = "";
    c.style.overflowY = "";
    qs("#below")?.appendChild(c);
  }
  return true;
}

async function applyFromStorage() {
  const { sidebarEnabled, autoExpand, hideRelated } =
    await chrome.storage.local.get([
      "sidebarEnabled",
      "autoExpand",
      "hideRelated",
    ]);

  const applied = await toggleSidebar(sidebarEnabled, { hideRelated });
  if (!applied) return;

  if (sidebarEnabled && autoExpand) {
  const readyBtn = await waitFor(() => {
    const btn = qs("#description-inline-expander #expand")
    if (!btn) return null;
    const cs = getComputedStyle(btn);

    return cs.display === "none" ? null : btn;
  }, { signal: activeToggleController?.signal });

  readyBtn?.click();
  } else {
    qs("#description-inline-expander tp-yt-paper-button#collapse")?.click();
  }
}
async function run() {
  if (location.pathname !== "/watch") return;
  await applyFromStorage();
}
run(); // direct page load
window.addEventListener("yt-navigate-finish", run); // SPA nav

// Handles messages from popup or shortcut
chrome.runtime.onMessage.addListener(async ({ action }) => {
  if (action === "toggleCommentsSidebar" || action === "applyCurrentSettings") {
    await run();
  }
});
