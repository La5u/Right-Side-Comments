const qs = (s, root = document) => root?.querySelector(s) || null;
const DEFAULT_SETTINGS = self.RSC_DEFAULTS;
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const withDefaults = (values = {}) =>
  Object.fromEntries(SETTINGS_KEYS.map((key) => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
const COMMENTS_SHELL_ID = "rsc-comments-shell";
const COMMENTS_MAX_HEIGHT = "calc(100vh - 75px)";
const BUILTIN_COMMENT_BUTTON_SELECTOR = ".ytp-fullscreen-quick-actions button[aria-label='Comments']";
const BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR = "#panels #visibility-button button";

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

function waitFor(target, { signal, root = document.body } = {}) {
  if (!root) return Promise.resolve(null);

  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);

    const get = typeof target === "function" ? target : () => qs(target, root);
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
    observer.observe(root, { childList: true, subtree: true });
  });
}

function setRelatedDisplay(rel, showRelated) {
  if (rel) rel.style.display = showRelated ? "" : "none";
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

async function restoreDefaultSidebarLayout(signal) {
  const sec = qs("div#secondary.ytd-watch-flexy");
  const comments = qs("ytd-comments#comments");
  if (!sec || !comments) return false;

  // Restore the default YouTube layout.
  resetCommentStyles(comments);
  const below = await waitFor("#below", { signal });
  if (signal?.aborted || !below) return false;
  below.append(comments);
  qs(`#${COMMENTS_SHELL_ID}`, sec)?.remove();
  return true;
}

async function openBuiltinComments() {
  const watch = await waitFor("ytd-watch-flexy");
  const player = watch ? await waitFor("#movie_player", { root: watch }) : null;
  const button = player ? await waitFor(BUILTIN_COMMENT_BUTTON_SELECTOR, { root: player }) : null;
  if (!button) return false;
  button.click();
  return true;
}

function applySidebarOrder(sidebarEnabled, { showRelated, staticCommentBox: isStatic } = {}, sec, comments, related) {
  if (!sec || !comments) return false;

  const shell = qs(`#${COMMENTS_SHELL_ID}`, sec);
  setRelatedDisplay(related, showRelated);

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

  return restoreDefaultSidebarLayout(signal);
}

function applyUiSettings({ innerScrollbar, outerScrollbar, compactMargins, commentsWidth, hideSideMargins }, sidebarMode) {
  const root = document.documentElement;
  if (!root) return;
  const isDefaultSidebar = sidebarMode === "default";
  const nextWidth = sidebarMode !== "disabled" && commentsWidth != null && commentsWidth !== "" ? `${commentsWidth}%` : "";
  const nextHideSideMargins = isDefaultSidebar && Boolean(hideSideMargins);

  root.classList.toggle("rsc-compact-margins", isDefaultSidebar && compactMargins);
  root.classList.toggle("rsc-hide-inner-scrollbar", isDefaultSidebar && innerScrollbar);
  root.classList.toggle("rsc-hide-outer-scrollbar", outerScrollbar);
  root.classList.toggle("rsc-hide-side-margins", nextHideSideMargins);
  root.classList.toggle("rsc-custom-width", Boolean(nextWidth));

  if (nextWidth) {
    root.style.setProperty("--comments-width", nextWidth);
  } else {
    root.style.removeProperty("--comments-width");
  }

  window.dispatchEvent(new Event("resize"));
}

async function applyDescriptionBehavior(autoExpand) {
  if (autoExpand) {
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

async function applyFullscreenComments() {
  if (!cachedSettings.extensionEnabled || !document.fullscreenElement || !cachedSettings.fullscreenComments) return;
  await applyBuiltinSidebar();
}

async function applyBuiltinSidebar() {
  await restoreDefaultSidebarLayout();
  await waitFor(BUILTIN_COMMENT_BUTTON_SELECTOR);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await openBuiltinComments();
}

async function applySidebarLayoutState() {
  if (!cachedSettings.extensionEnabled) return;

  if (cachedSettings.sidebarMode === "builtin") {
    await applyBuiltinSidebar();
  } else {
    qs(BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR)?.click();
    await toggleSidebar(cachedSettings.sidebarMode === "default", cachedSettings);
  }
}

async function applyFromStorage() {
  if (!supportedVideoPage()) return;

  await syncSettings();
  const related = qs("#related");

  if (!cachedSettings.extensionEnabled) {
    const root = document.documentElement;
    root?.classList.remove("rsc-hide-inner-scrollbar", "rsc-hide-outer-scrollbar", "rsc-compact-margins", "rsc-hide-side-margins", "rsc-custom-width");
    root?.style.removeProperty("--comments-width");
    setRelatedDisplay(related, true);
    await toggleSidebar(false, cachedSettings);
    qs(BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR)?.click();
    await applyDescriptionBehavior(false);
    return;
  }
  setRelatedDisplay(related, cachedSettings.showRelated);
  applyUiSettings(cachedSettings, cachedSettings.sidebarMode);
  
  await applySidebarLayoutState();
  await applyDescriptionBehavior(cachedSettings.sidebarMode !== "disabled" && cachedSettings.autoExpand);

}

function scheduleSidebarReflow() {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0;
    if (!supportedVideoPage() || !cachedSettings.extensionEnabled || cachedSettings.sidebarMode !== "default" || document.fullscreenElement) return;
    const sec = qs("div#secondary.ytd-watch-flexy");
    const comments = qs("ytd-comments#comments");
    const related = qs("#related");
    applySidebarOrder(true, cachedSettings, sec, comments, related);
  });
}

applyFromStorage();
window.addEventListener("yt-navigate-finish", applyFromStorage);
window.addEventListener("yt-page-data-fetched", applySidebarLayoutState);
document.addEventListener("fullscreenchange", async () => {
  if (document.fullscreenElement) {
    await applyFullscreenComments();
  } else {
    await applySidebarLayoutState();
  }
});
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
  async setAutoExpand({ value } = {}) {
    await applyDescriptionBehavior(cachedSettings.sidebarMode !== "disabled" && (value ?? cachedSettings.autoExpand));
  },
  async setShowRelated() {
    if (!cachedSettings.extensionEnabled) {
      setRelatedDisplay(qs("#related"), true);
      return;
    }
    if (cachedSettings.sidebarMode === "default" && !document.fullscreenElement) {
      await toggleSidebar(true, cachedSettings);
      return;
    }
    setRelatedDisplay(qs("#related"), cachedSettings.showRelated);
  },
  async setUiSettings({ commentsWidth } = {}) {
    if (!cachedSettings.extensionEnabled) {
      const root = document.documentElement;
      root?.classList.remove("rsc-hide-inner-scrollbar", "rsc-hide-outer-scrollbar", "rsc-compact-margins", "rsc-hide-side-margins", "rsc-custom-width");
      root?.style.removeProperty("--comments-width");
      return;
    }
    applyUiSettings(
      { ...cachedSettings, commentsWidth: commentsWidth === undefined ? cachedSettings.commentsWidth : commentsWidth },
      cachedSettings.sidebarMode,
    );
  },
  setLayoutSettings: applyFromStorage,
};

chrome.runtime.onMessage.addListener(async (message = {}) => {
  const handler = messageHandlers[message.action];
  if (!handler) return;
  await handler(message);
});
