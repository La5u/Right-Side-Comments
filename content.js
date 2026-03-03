const qs = (s, root = document) => root?.querySelector(s) || null;
const SETTINGS_KEYS = ["sidebarEnabled", "autoExpand", "showRelated", "showScrollbar", "compactMargins"];

// Single active toggle flow; new actions cancel stale waits.
let activeToggleController = null;

// Wait until target selector/function resolves to an element.
function waitFor(target, { signal } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);
    const get = typeof target === "function" ? target : () => qs(target);
    let settled = false;
    let obs = null;
    const done = (value) => {
      if (settled) return;
      settled = true;
      obs?.disconnect();
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => done(null);
    const existing = get();
    if (existing) return done(existing);
    obs = new MutationObserver(() => {
      const el = get();
      if (el) done(el);
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function setRelatedDisplay(rel, sidebarEnabled, showRelated) {
  if (!rel) return;
  rel.style.display = sidebarEnabled && !showRelated ? "none" : "";
}

async function getSettings() {
  const { sidebarEnabled, autoExpand, showRelated, showScrollbar, compactMargins } =
    await chrome.storage.local.get(SETTINGS_KEYS);
  return {
    sidebarEnabled: sidebarEnabled !== false,
    autoExpand: autoExpand !== false,
    showRelated: showRelated !== false,
    showScrollbar: showScrollbar === true,
    compactMargins: compactMargins !== false,
  };
}

/** Moves comments into the sidebar (on=true) or restores them (on=false) */
async function toggleSidebar(sidebarEnabled, { showRelated } = {}) {
  if (location.pathname !== "/watch") return;
  // Latest intent wins: cancel any older in-flight operation.
  activeToggleController?.abort();
  activeToggleController = new AbortController();
  const signal = activeToggleController.signal;

  const sec = await waitFor("div#secondary.ytd-watch-flexy", { signal });
  const c = await waitFor("ytd-comments#comments", { signal });
  const rel = qs("#related");
  if (signal.aborted || !sec || !c) return false;
  setRelatedDisplay(rel, sidebarEnabled, showRelated);

  if (sidebarEnabled) {
    // Put comments in a scrollable box.
    c.style.maxHeight = "calc(100vh - 80px)";
    c.style.overflowY = "auto";

    if (showRelated && rel?.parentNode === sec) {
      // Keep related stable for thumbnails; only move comments.
      sec.insertBefore(c, rel);
    } else {
      if (!sec.contains(c)) sec.appendChild(c);
      if (showRelated && rel?.parentNode !== sec) sec.appendChild(rel);
    }
  } else {
    c.style.maxHeight = "";
    c.style.overflowY = "";
    qs("#below")?.appendChild(c);
  }
  return true;
}

function applyUiSettings({ showScrollbar, compactMargins }) {
  const root = document.documentElement;
  if (!root) return;

  const hideScrollbar = !showScrollbar;
  const useCompactMargins = compactMargins !== false;

  root.classList.toggle("rsc-hide-scrollbar", hideScrollbar);
  root.classList.toggle("rsc-compact-margins", useCompactMargins);
}

async function applyDescriptionBehavior(sidebarEnabled, autoExpand) {
  if (sidebarEnabled && autoExpand) {
    const readyBtn = await waitFor(() => {
      const btn = qs("#description-inline-expander #expand");
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      return cs.display === "none" ? null : btn;
    }, { signal: activeToggleController?.signal });
    readyBtn?.click();
  } else {
    qs("#description-inline-expander tp-yt-paper-button#collapse")?.click();
  }
}

async function applyFromStorage() {
  if (location.pathname !== "/watch") return;

  const { sidebarEnabled, autoExpand, showRelated, showScrollbar, compactMargins } =
    await getSettings();

  applyUiSettings({ showScrollbar, compactMargins });

  const applied = await toggleSidebar(sidebarEnabled, {
    showRelated,
  });
  if (!applied) return;
  await applyDescriptionBehavior(sidebarEnabled, autoExpand);
}

applyFromStorage();
window.addEventListener("yt-navigate-start", applyFromStorage); // SPA nav

// Handles messages from popup or shortcut
chrome.runtime.onMessage.addListener(async ({ action, sidebarEnabled, autoExpand, showRelated, showScrollbar, compactMargins }) => {
  if (action === "toggleCommentsSidebar") {
    await applyFromStorage();
    return;
  }
  if (action === "setAutoExpand") {
    await applyDescriptionBehavior(sidebarEnabled !== false, autoExpand !== false);
    return;
  }
  if (action === "setShowRelated") {
    await toggleSidebar(sidebarEnabled !== false, {
      showRelated: showRelated !== false,
    });
    return;
  }
  if (action === "setUiSettings") {
    applyUiSettings({ showScrollbar, compactMargins });
  }
});
