const qs = (s, root = document) => root?.querySelector(s) || null;
const DEFAULT_SETTINGS = self.RSC_DEFAULTS;
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const withDefaults = (values = {}) =>
  Object.fromEntries(SETTINGS_KEYS.map((key) => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
const COMMENTS_SHELL_ID = "rsc-comments-shell";
const COMMENTS_MAX_HEIGHT = "calc(100vh - 75px)";
// Comments is the only toggle directly under the player's quick actions (like/dislike are nested); aria-label is localized.
const BUILTIN_COMMENT_BUTTON_SELECTOR = "yt-player-quick-action-buttons > toggle-button-view-model button";
// Only the expanded comments panel, so other panels the user opened (transcript, chapters) stay open.
const BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR = "[target-id=engagement-panel-comments-section][visibility$=EXPANDED] #visibility-button button";
const BUILTIN_COMMENTS_PANEL_SELECTOR = "ytd-engagement-panel-section-list-renderer[target-id=engagement-panel-comments-section]";
const BLUR_BUTTON_ID = "rsc-blur-toggle";
const SVG_NS = "http://www.w3.org/2000/svg";
// Material "visibility" / "visibility_off" icons.
const EYE_PATH = "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z";
const EYE_OFF_PATH = "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z";

const supportedVideoPage = () => {
  const pathname = location.pathname || "";
  return pathname === "/watch" || pathname.startsWith("/live/");
};

// One controller per kind of work: starting a new run aborts the previous run's pending waits.
const runControllers = {};
function startRun(name) {
  runControllers[name]?.abort();
  runControllers[name] = new AbortController();
  return runControllers[name].signal;
}
function abortRuns() {
  for (const controller of Object.values(runControllers)) controller.abort();
}

let cachedSettings = { ...DEFAULT_SETTINGS };
let resizeRafId = 0;

async function syncSettings() {
  cachedSettings = withDefaults(await chrome.storage.local.get(SETTINGS_KEYS));
}

function waitFor(target, { signal, root = document.documentElement } = {}) {
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

function placeSidebarNode(sec, node, { related, pinComments } = {}) {
  if (!sec || !node) return false;

  if (pinComments) {
    const anchor = qs("#secondary-inner", sec) || sec.firstElementChild;
    if (anchor && anchor !== node && anchor.parentNode === sec) sec.insertBefore(node, anchor);
    else if (node.parentNode !== sec) sec.append(node);
    return true;
  }

  if (related?.parentNode && related.parentNode !== node) {
    related.parentNode.insertBefore(node, related);
    return true;
  }

  if (node.parentNode !== sec) sec.append(node);
  return true;
}

let blurButton = null;

function createBlurButton() {
  const button = Object.assign(document.createElement("button"), { id: BLUR_BUTTON_ID, type: "button", title: "Blur comments until hovered" });
  button.setAttribute("aria-label", "Blur comments until hovered");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const [className, d] of [["rsc-eye", EYE_PATH], ["rsc-eye-off", EYE_OFF_PATH]]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", className);
    path.setAttribute("d", d);
    svg.append(path);
  }
  button.append(svg);
  // Only flips the blur; spoiler mode itself stays on. The storage listener updates every tab.
  button.addEventListener("click", () => chrome.storage.local.set({ spoilerBlur: !cachedSettings.spoilerBlur }));
  return button;
}

function updateBlurButton() {
  blurButton?.setAttribute("aria-pressed", String(Boolean(cachedSettings.spoilerBlur)));
}

function removeBlurButton() {
  runControllers.blurButton?.abort();
  blurButton?.remove();
}

// Keeps the button next to the comments sort menu, re-placing it whenever YouTube re-renders the header.
async function placeBlurButton() {
  if (!supportedVideoPage()) return removeBlurButton();
  const signal = startRun("blurButton");
  blurButton ||= createBlurButton();
  updateBlurButton();
  const builtin = cachedSettings.sidebarMode === "builtin";

  while (!signal.aborted) {
    const root = await waitFor(builtin ? BUILTIN_COMMENTS_PANEL_SELECTOR : "ytd-comments#comments", { signal });
    if (!root?.contains(blurButton)) blurButton.remove();
    const anchor = await waitFor(builtin ? "ytd-engagement-panel-title-header-renderer #menu" : "ytd-comments-header-renderer #sort-menu", { root, signal });
    if (!anchor) return;
    if (builtin) anchor.before(blurButton);
    else anchor.after(blurButton);
    await waitFor(() => !blurButton.isConnected || !anchor.isConnected, { root, signal });
  }
}

// The button shows while spoiler mode is on; the blur also needs the button's state on. Neither applies without a sidebar.
function applySpoilerSettings({ spoilerMode, spoilerBlur, sidebarMode } = cachedSettings) {
  const spoilerOn = Boolean(spoilerMode) && sidebarMode !== "disabled";
  document.documentElement?.classList.toggle("rsc-spoiler", spoilerOn && Boolean(spoilerBlur));
  if (spoilerOn) placeBlurButton();
  else removeBlurButton();
}

function clearUiSettings() {
  removeBlurButton();
  const root = document.documentElement;
  const widthChanged = root?.classList.contains("rsc-custom-width") || root?.style.getPropertyValue("--comments-width");
  root?.classList.remove("rsc-enabled", "rsc-hide-inner-scrollbar", "rsc-hide-outer-scrollbar", "rsc-compact-margins", "rsc-hide-side-margins", "rsc-custom-width", "rsc-spoiler");
  root?.style.removeProperty("--comments-width");
  if (widthChanged) window.dispatchEvent(new Event("resize"));
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

async function waitForCurrentWatchVideo(watch, signal) {
  const videoId = new URL(location.href).searchParams.get("v");
  if (!videoId) return true;

  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = () => {
      if (signal?.aborted) return resolve(false);
      if (watch.getAttribute("video-id") === videoId) return resolve(true);
      if (performance.now() - startedAt > 5000) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function applySidebarOrder({ showRelated, staticCommentBox: isStatic, pinComments } = {}, sec, comments, related) {
  if (!sec || !comments) return false;

  const shell = qs(`#${COMMENTS_SHELL_ID}`, sec);
  const relatedEl = related || qs("#related", sec);
  setRelatedDisplay(relatedEl, showRelated);

  // Fixes YouTube reordering comments/related videos when the watch page crosses a resize breakpoint.
  const useStaticBox = isStatic !== false;
  if (!useStaticBox) {
    Object.assign(comments.style, { maxHeight: COMMENTS_MAX_HEIGHT, overflowY: "auto" });
    placeSidebarNode(sec, comments, { related: relatedEl, pinComments });

    shell?.remove();
    return true;
  }

  // Fixes the same responsive reorder while preserving the persistent shell container.
  const ensuredShell = ensureCommentsShell(sec);
  resetCommentStyles(comments);
  if (comments.parentNode !== ensuredShell) ensuredShell?.append(comments);

  placeSidebarNode(sec, ensuredShell, { related: relatedEl, pinComments });
  return true;
}

async function toggleSidebar(sidebarEnabled, { showRelated, staticCommentBox: isStatic, pinComments } = {}, signal = startRun("layout")) {
  if (!supportedVideoPage()) return;

  if (!sidebarEnabled) {
    return restoreDefaultSidebarLayout(signal);
  }

  const [sec, comments, related] = await Promise.all([
    waitFor("div#secondary.ytd-watch-flexy", { signal }), // full name required so it only works on watch pages
    waitFor("ytd-comments#comments", { signal }),
    showRelated ? waitFor("#related", { signal }) : qs("#related"),
  ]);
  if (signal.aborted || !sec) return false;

  if (!comments) {
    qs(`#${COMMENTS_SHELL_ID}`, sec)?.remove();
    return false;
  }

  return applySidebarOrder({ showRelated, staticCommentBox: isStatic, pinComments }, sec, comments, related);
}

function applyUiSettings({ innerScrollbar, outerScrollbar, compactMargins, commentsWidth, hideSideMargins, spoilerMode, spoilerBlur }, sidebarMode) {
  const root = document.documentElement;
  if (!root) return;
  const isDefaultSidebar = sidebarMode === "default";
  const nextWidth = sidebarMode !== "disabled" && commentsWidth != null && commentsWidth !== "" ? `${commentsWidth}%` : "";
  const nextHideSideMargins = isDefaultSidebar && Boolean(hideSideMargins);
  const widthChanged = root.style.getPropertyValue("--comments-width") !== nextWidth;

  root.classList.add("rsc-enabled");
  root.classList.toggle("rsc-compact-margins", isDefaultSidebar && compactMargins);
  root.classList.toggle("rsc-hide-inner-scrollbar", isDefaultSidebar && innerScrollbar);
  root.classList.toggle("rsc-hide-outer-scrollbar", outerScrollbar);
  root.classList.toggle("rsc-hide-side-margins", nextHideSideMargins);
  root.classList.toggle("rsc-custom-width", Boolean(nextWidth));
  applySpoilerSettings({ spoilerMode, spoilerBlur, sidebarMode });

  if (nextWidth) {
    root.style.setProperty("--comments-width", nextWidth);
  } else {
    root.style.removeProperty("--comments-width");
  }

  if (widthChanged) window.dispatchEvent(new Event("resize"));
}

async function applyDescriptionBehavior(autoExpand) {
  const signal = startRun("description");
  if (autoExpand) {
    // Don't stop early on `is-expanded`: after SPA navigation it's stale from the previous video until YouTube collapses it.
    const readyBtn = await waitFor(() => {
      const btn = qs("#description-inline-expander #expand");
      if (!btn) return null;
      return getComputedStyle(btn).display === "none" ? null : btn;
    }, { signal });
    readyBtn?.click();
    return;
  }

  qs("#description-inline-expander tp-yt-paper-button#collapse")?.click();
}

async function openBuiltinSidebar({ waitForCurrentVideo = false } = {}) {
  if (!supportedVideoPage()) return false;
  const signal = startRun("layout");
  await restoreDefaultSidebarLayout(signal);
  const watch = await waitFor("ytd-watch-flexy", { signal });
  if (!watch || (waitForCurrentVideo && !(await waitForCurrentWatchVideo(watch, signal)))) return false;
  const button = await waitFor(BUILTIN_COMMENT_BUTTON_SELECTOR, { root: watch, signal });
  if (!button || qs(BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR)) return false;
  button.click();
  return true;
}

async function applyFullscreenComments() {
  if (!cachedSettings.extensionEnabled || !document.fullscreenElement || !cachedSettings.fullscreenComments) return;
  await openBuiltinSidebar();
}

async function applyBuiltinSidebar() {
  await openBuiltinSidebar({ waitForCurrentVideo: true });
}

async function applySidebarLayoutState() {
  if (!supportedVideoPage()) return;
  if (!cachedSettings.extensionEnabled) return;

  if (cachedSettings.sidebarMode === "builtin") {
    await applyBuiltinSidebar();
  } else {
    qs(BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR)?.click();
    await toggleSidebar(cachedSettings.sidebarMode === "default", cachedSettings);
  }
}

async function applyFromStorage() {
  if (!supportedVideoPage()) {
    abortRuns();
    return clearUiSettings();
  }

  await syncSettings();
  const related = qs("#related");

  if (!cachedSettings.extensionEnabled) {
    clearUiSettings();
    setRelatedDisplay(related, true);
    await toggleSidebar(false, cachedSettings);
    qs(BUILTIN_COMMENT_CLOSE_BUTTON_SELECTOR)?.click();
    await applyDescriptionBehavior(false);
    return;
  }
  if (cachedSettings.sidebarMode !== "default") setRelatedDisplay(related, cachedSettings.showRelated);
  applyUiSettings(cachedSettings, cachedSettings.sidebarMode);
  
  await applySidebarLayoutState();
  await applyDescriptionBehavior(cachedSettings.autoExpand);

}

function scheduleSidebarReflow() {
  if (resizeRafId) cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = 0;
    if (!supportedVideoPage() || !cachedSettings.extensionEnabled || cachedSettings.sidebarMode !== "default" || document.fullscreenElement) return;
    const sec = qs("div#secondary.ytd-watch-flexy");
    const comments = qs("ytd-comments#comments");
    const related = qs("#related");
    applySidebarOrder(cachedSettings, sec, comments, related);
  });
}

applyFromStorage();
window.addEventListener("yt-navigate-finish", applyFromStorage);
window.addEventListener("yt-page-data-fetched", () => {
  if (cachedSettings.sidebarMode !== "builtin") applySidebarLayoutState();
});
document.addEventListener("fullscreenchange", async () => {
  await syncSettings();

  if (document.fullscreenElement) {
    await applyFullscreenComments();
  } else {
    await applySidebarLayoutState();
  }
});
window.addEventListener("resize", scheduleSidebarReflow);

// Keep cachedSettings in sync with storage; the on/off toggle (popup or shortcut) re-applies every YouTube tab.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  for (const key of SETTINGS_KEYS) {
    if (key in changes) {
      cachedSettings[key] = changes[key].newValue ?? DEFAULT_SETTINGS[key];
    }
  }
  if (changes.extensionEnabled) applyFromStorage();
  else if ((changes.spoilerMode || changes.spoilerBlur || changes.sidebarMode) && cachedSettings.extensionEnabled && supportedVideoPage()) {
    applySpoilerSettings();
  }
});

const messageHandlers = {
  async setAutoExpand({ value } = {}) {
    await applyDescriptionBehavior(value ?? cachedSettings.autoExpand);
  },
  async setShowRelated({ value } = {}) {
    const showRelated = value ?? cachedSettings.showRelated;
    if (!cachedSettings.extensionEnabled) {
      setRelatedDisplay(qs("#related"), true);
      return;
    }
    if (cachedSettings.sidebarMode === "default" && !document.fullscreenElement) {
      await toggleSidebar(true, { ...cachedSettings, showRelated });
      return;
    }
    setRelatedDisplay(qs("#related"), showRelated);
  },
  async setUiSettings({ commentsWidth } = {}) {
    if (!cachedSettings.extensionEnabled) {
      clearUiSettings();
      return;
    }
    applyUiSettings(
      { ...cachedSettings, commentsWidth: commentsWidth === undefined ? cachedSettings.commentsWidth : commentsWidth },
      cachedSettings.sidebarMode,
    );
  },
  async setLayoutSettings({ key, value } = {}) {
    if (!key) {
      await applyFromStorage();
      return;
    }
    await syncSettings();
    if (SETTINGS_KEYS.includes(key)) cachedSettings[key] = value ?? DEFAULT_SETTINGS[key];
    if (cachedSettings.extensionEnabled && supportedVideoPage()) applyUiSettings(cachedSettings, cachedSettings.sidebarMode);
    await applySidebarLayoutState();
  },
};

// Don't return the promise: nothing is sent back, and returning it keeps the sender waiting for the whole apply.
chrome.runtime.onMessage.addListener((message = {}) => {
  messageHandlers[message.action]?.(message);
});
