const qs = (s, root = document) => root?.querySelector(s) || null;
const DEFAULT_SETTINGS = {
  sidebarEnabled: true,
  autoExpand: true,
  showRelated: true,
  showScrollbar: false,
  compactMargins: true,
  persistentCommentBox: true,
};
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const withDefaults = (values = {}) =>
  Object.fromEntries(SETTINGS_KEYS.map((key) => [key, values[key] ?? DEFAULT_SETTINGS[key]]));
const COMMENTS_SHELL_ID = "rsc-comments-shell";
const COMMENTS_MAX_HEIGHT = "calc(100vh - 75px)";

let activeToggleController = null;

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

async function toggleSidebar(sidebarEnabled, { showRelated, persistentCommentBox } = {}) {
  if (location.pathname !== "/watch") return;

  activeToggleController?.abort();
  activeToggleController = new AbortController();
  const signal = activeToggleController.signal;

  const [sec, comments] = await Promise.all([
    waitFor("div#secondary.ytd-watch-flexy", { signal }),
    waitFor("ytd-comments#comments", { signal }),
  ]);
  if (signal.aborted || !sec) return false;

  const related = qs("#related");
  const shell = qs(`#${COMMENTS_SHELL_ID}`, sec);
  if (!comments) {
    shell?.remove();
    return false;
  }

  setRelatedDisplay(related, sidebarEnabled, showRelated);

  if (sidebarEnabled) {
    // Sidebar mode without a shell: comments become the scroll container.
    const usePersistentBox = persistentCommentBox !== false;
    if (!usePersistentBox) {
      Object.assign(comments.style, { maxHeight: COMMENTS_MAX_HEIGHT, overflowY: "auto" });
      if (showRelated && related?.parentNode === sec) sec.insertBefore(comments, related);
      else if (!sec.contains(comments)) sec.append(comments);
      if (showRelated && related?.parentNode !== sec) sec.append(related);
      shell?.remove();
      return true;
    }

    // Sidebar mode with a persistent shell: the shell scrolls, comments stay unbounded.
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
  const below = await waitFor("#below", { signal });
  if (signal.aborted || !below) return false;
  below.append(comments);
  shell?.remove();
  return true;
}

function applyUiSettings({ showScrollbar, compactMargins }) {
  const root = document.documentElement;
  if (!root) return;
  root.classList.toggle("rsc-hide-scrollbar", !showScrollbar);
  root.classList.toggle("rsc-compact-margins", compactMargins);
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
  if (location.pathname !== "/watch") return;

  const settings = await getSettings();
  applyUiSettings(settings);

  const applied = await toggleSidebar(settings.sidebarEnabled, settings);
  if (applied) await applyDescriptionBehavior(settings.sidebarEnabled, settings.autoExpand);
}

applyFromStorage();
window.addEventListener("yt-navigate-start", applyFromStorage);

const messageHandlers = {
  async toggleCommentsSidebar() { await applyFromStorage(); },
  async setAutoExpand(settings) { await applyDescriptionBehavior(settings.sidebarEnabled, settings.autoExpand); },
  async setShowRelated(settings) { await toggleSidebar(settings.sidebarEnabled, settings); },
  async setUiSettings(settings) {
    applyUiSettings(settings);
  },
  async setLayoutSettings(settings) { await toggleSidebar(settings.sidebarEnabled, settings); },
};

chrome.runtime.onMessage.addListener(async ({ action, ...values }) => {
  const handler = messageHandlers[action];
  if (!handler) return;
  await handler(withDefaults(values));
});
