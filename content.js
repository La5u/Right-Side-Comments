let sidebarEnabled = true;

const qs = (s) => document.querySelector(s);

const ensureCommentsLoaded = async () => {
  let c = document.getElementById("comments");
  if (c) return c;
  qs("ytd-comments")?.scrollIntoView(), window.scrollTo(0, 0);
  return new Promise((r) => {
    new MutationObserver((_, o) => (c = document.getElementById("comments")) && (o.disconnect(), r(c)))
      .observe(document.body, { childList: true, subtree: true });
  });
};

function expandDescription() {
  const expandNow = () => qs(".button.ytd-text-inline-expander#expand")?.click();
  if (expandNow()) return; // works instantly on reloads

  const obs = new MutationObserver(() => {
    if (expandNow()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

async function toggleSidebar(on) {
  sidebarEnabled = on;
  const sec = qs("#secondary"), rel = qs("#related");
  if (!sec || !rel) return;
  const c = document.getElementById("comments") || await ensureCommentsLoaded();
  on
    ? (expandDescription(), rel.style.display = "none", sec.appendChild(c), c.style.display = "block")
    : (rel.style.display = "", (qs("#below") || qs("#below-the-fold"))?.appendChild(c), c.style.maxHeight = "");
}

chrome.runtime.onMessage.addListener(({ action, enabled }) => {
  if (action === "toggleCommentsSidebar") toggleSidebar(enabled);
});

const applyIfEnabled = async () => (await chrome.storage.local.get("sidebarEnabled")).sidebarEnabled && toggleSidebar(true);
applyIfEnabled();
window.addEventListener("yt-navigate-finish", applyIfEnabled);
