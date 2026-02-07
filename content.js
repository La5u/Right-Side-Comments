const qs = (s, root = document) => root?.querySelector(s) || null;

// Single active toggle flow; new actions cancel stale waits.
let activeToggleController = null;

// Wait until target selector/function resolves to an element.
function waitFor(target, { signal } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);
    const get = typeof target === "function" ? target : () => qs(target);
    let settled = false;
    let obs = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      obs?.disconnect();
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };

    const onAbort = () => finish(null);

    const existing = get();
    if (existing) return finish(existing);

    obs = new MutationObserver(() => {
      const el = get();
      if (el) finish(el);
    });

    const root = document.body || document.documentElement;
    if (!root) return finish(null);
    signal?.addEventListener("abort", onAbort, { once: true });
    obs.observe(root, { childList: true, subtree: true });
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
    // Re-apply related visibility even if comments were already moved.
    if (hideRelated && rel) rel.style.display = "none";
    if (!hideRelated && rel) {
      rel.style.display = "";
      rel.style.marginTop = "32px";
    }

    c.style.maxHeight = "100vh";
    c.style.overflowY = "auto";

    if (!hideRelated && rel?.parentNode === sec) {
      // Keep related stable for thumbnail extensions; only move comments.
      sec.insertBefore(c, rel);
    } else {
      if (!sec.contains(c)) sec.appendChild(c);
      if (!hideRelated && rel?.parentNode !== sec) sec.appendChild(rel);
    }
  } else {
    if (rel) rel.style.display = "";
    c.style.maxHeight = "";
    c.style.overflowY = "";
    if (rel) rel.style.marginTop = "";
    qs("#below")?.appendChild(c);
  }
  return true;
}

async function applyFromStorage(sidebarEnabledOverride) {
  const { sidebarEnabled, autoExpand, hideRelated } =
    await chrome.storage.local.get([
      "sidebarEnabled",
      "autoExpand",
      "hideRelated",
    ]);

  const enabled =
    typeof sidebarEnabledOverride === "boolean"
      ? sidebarEnabledOverride
      : !!sidebarEnabled;

  const applied = await toggleSidebar(enabled, { hideRelated });
  if (!applied) return;

  if (enabled && autoExpand) {
    qs("tp-yt-paper-button#expand")?.click();
  } else {
    qs("tp-yt-paper-button#collapse")?.click();
  }
}

/** Handles messages from popup or shortcut */
chrome.runtime.onMessage.addListener(async ({ action, enabled }) => {
  if (action === "toggleCommentsSidebar") {
    await applyFromStorage(!!enabled);
  } else if (action === "applyCurrentSettings") {
    await applyFromStorage();
  }
});

window.addEventListener("yt-navigate-finish", async () => {
  if (location.pathname !== "/watch") return;
  await applyFromStorage();
});
