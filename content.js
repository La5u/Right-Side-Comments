const qs = (s, root = document) => root?.querySelector(s) || null;
const DEFAULT_SETTINGS = self.RSC_DEFAULTS;
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const withDefaults = (values = {}) =>
  Object.fromEntries(SETTINGS_KEYS.map((key) => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
const COMMENTS_SHELL_ID = "rsc-comments-shell";
const COMMENTS_MAX_HEIGHT = "calc(100vh - 75px)";

const supportedVideoPage = () => {
  const pathname = location.pathname || "";
  return pathname === "/watch" || pathname.startsWith("/live/");
};

let activeToggleController = null;
let cachedSettings = { ...DEFAULT_SETTINGS };
let resizeRafId = 0;

async function syncSettings() {
  cachedSettings = withDefaults(await chrome.storage.local.get(SETTINGS_KEYS));
}

function waitFor(target, { signal } = {}) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);

    const get = typeof target === "function" ? target : () => qs(target);
    let observer = null;
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => done(null);

    const existing = get();
    if (existing) return done(existing);

    observer = new MutationObserver(() => {
      const el = get();
      if (el) done(el);
    });

    signal?.addEventListener("abort", onAbort, { once: true });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function getSettings() {
  return withDefaults(await chrome.storage.local.get(SETTINGS_KEYS));
}

function setRelatedDisplay(rel, sidebarEnabled, showRelated) {
  if (rel) rel.style.display = sidebarEnabled && !showRelated ? "none" : "";
}

function ensureCommentsShell(sec) {
  if (!sec) return null;
  const shell = qs(`#${COMMENTS_SHELL_ID}`, sec) || Object.assign(document.createElement("div"), { id: COMMENTS_SHELL_ID });
  Object.assign(shell.style, {
    height: COMMENTS_MAX_HEIGHT,
    overflowY: "auto",
    marginBottom: "20px",
    width: "100%",
  });
  if (!shell.parentNode) sec.append(shell);
  return shell;
}

function resetCommentStyles(comments) {
  Object.assign(comments.style, { maxHeight: "", overflowY: "" });
}

function applySidebarOrder(sidebarEnabled, { showRelated, staticCommentBox: isStatic } = {}, sec, comments, related) {
  if (!sec || !comments) return false;

  const shell = qs(`#${COMMENTS_SHELL_ID}`, sec);
  setRelatedDisplay(related, sidebarEnabled, showRelated);
  document.documentElement.classList.toggle("rsc-comments-sidebar-active", sidebarEnabled);

  if (sidebarEnabled) {
    // Fixes YouTube reordering comments/related videos when the watch page crosses a resize breakpoint.
    const useStaticBox = isStatic !== false;
    if (!useStaticBox) {
      Object.assign(comments.style, { maxHeight: COMMENTS_MAX_HEIGHT, overflowY: "auto" });
      if (showRelated && related?.parentNode === sec) {
        sec.insertBefore(comments, related);
      } else {
        sec.append(comments);
      }

      if (showRelated && related?.parentNode !== sec) sec.append(related);
      shell?.remove();
      return true;
    }

    // Fixes the same responsive reorder while preserving the persistent shell container.
    const ensuredShell = ensureCommentsShell(sec);
    resetCommentStyles(comments);
    if (comments.parentNode !== ensuredShell) ensuredShell?.append(comments);

    if (showRelated && related?.parentNode === sec) sec.insertBefore(ensuredShell, related);
    else if (!sec.contains(ensuredShell)) sec.append(ensuredShell);
    if (showRelated && related?.parentNode !== sec) sec.append(related);
    return true;
  }

  // Restore the default YouTube layout.
  resetCommentStyles(comments);
  return false;
}

async function toggleSidebar(sidebarEnabled, { showRelated, staticCommentBox: isStatic } = {}) {
  if (!supportedVideoPage()) return;

  activeToggleController?.abort();
  activeToggleController = new AbortController();
  const signal = activeToggleController.signal;

  const [sec, comments] = await Promise.all([
    waitFor("div#secondary.ytd-watch-flexy", { signal }), // full name required so it only works on watch pages
    waitFor("ytd-comments#comments", { signal }),
  ]);
  if (signal.aborted || !sec) return false;

  const related = qs("#related");
  if (!comments) {
    qs(`#${COMMENTS_SHELL_ID}`, sec)?.remove();
    return false;
  }

  if (sidebarEnabled) {
    return applySidebarOrder(sidebarEnabled, { showRelated, staticCommentBox: isStatic }, sec, comments, related);
  }

  // Restore the default YouTube layout.
  resetCommentStyles(comments);
  const below = await waitFor("#below", { signal });
  if (signal.aborted || !below) return false;
  below.append(comments);
  qs(`#${COMMENTS_SHELL_ID}`, sec)?.remove();
  return true;
}

function applyUiSettings({ innerScrollbar, outerScrollbar, compactMargins, commentsWidth, hideSideMargins }) {
  const root = document.documentElement;
  if (!root) return;
  root.classList.toggle("rsc-hide-inner-scrollbar", innerScrollbar);
  root.classList.toggle("rsc-hide-outer-scrollbar", outerScrollbar);
  root.classList.toggle("rsc-compact-margins", compactMargins);
  root.classList.toggle("rsc-hide-side-margins", hideSideMargins);
  
  // Only apply width if user has explicitly set it (experiments feature)
  if (commentsWidth != null && commentsWidth !== "") {
    root.style.setProperty("--comments-width", `${commentsWidth}%`);
    root.classList.add("rsc-custom-width");
  } else {
    root.style.removeProperty("--comments-width");
    root.classList.remove("rsc-custom-width");
  }
}

async function applyDescriptionBehavior(sidebarEnabled, autoExpand) {
  if (sidebarEnabled && autoExpand) {
    const readyBtn = await waitFor(() => {
      const btn = qs("#description-inline-expander #expand");
      if (!btn) return null;
      return getComputedStyle(btn).display === "none" ? null : btn;
    }, { signal: activeToggleController?.signal });
    readyBtn?.click();
    return;
  }

  qs("#description-inline-expander tp-yt-paper-button#collapse")?.click();
}

async function applyFromStorage() {
  if (!supportedVideoPage()) return;

  await syncSettings();
  applyUiSettings(cachedSettings);

  const applied = await toggleSidebar(cachedSettings.sidebarEnabled, cachedSettings);
  if (applied) await applyDescriptionBehavior(cachedSettings.sidebarEnabled, cachedSettings.autoExpand);
}

function scheduleSidebarReflow() {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0;
    if (!supportedVideoPage() || !cachedSettings.sidebarEnabled) return;
    const sec = qs("div#secondary.ytd-watch-flexy");
    const comments = qs("ytd-comments#comments");
    const related = qs("#related");
    applySidebarOrder(cachedSettings.sidebarEnabled, cachedSettings, sec, comments, related);
  });
}

applyFromStorage();
window.addEventListener("yt-navigate-start", applyFromStorage);
window.addEventListener("resize", scheduleSidebarReflow);

// Keep cachedSettings in sync with storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  for (const key of SETTINGS_KEYS) {
    if (key in changes) {
      cachedSettings[key] = changes[key].newValue ?? DEFAULT_SETTINGS[key];
    }
  }
});

const messageHandlers = {
  async toggleCommentsSidebar() { await applyFromStorage(); },
  async setAutoExpand() { await applyDescriptionBehavior(cachedSettings.sidebarEnabled, cachedSettings.autoExpand); },
  async setShowRelated() { await toggleSidebar(cachedSettings.sidebarEnabled, cachedSettings); },
  async setUiSettings() { applyUiSettings(cachedSettings); },
  async setLayoutSettings() { await toggleSidebar(cachedSettings.sidebarEnabled, cachedSettings); },
  async refreshLayout() {
    // Nudge YouTube to recalculate the player layout after a committed sidebar width change.
    window.dispatchEvent(new Event("resize"));
  },
};

chrome.runtime.onMessage.addListener(async ({ action }) => {
  const handler = messageHandlers[action];
  if (!handler) return;
  await handler();
});
