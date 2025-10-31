let sidebarEnabled = false;
let secondary, comments, related;

function toggleSidebar(enable) {
  sidebarEnabled = enable;
  secondary = document.getElementById("secondary");
  comments = document.getElementById("comments");
  related = document.querySelector("#related");

  if (!secondary || !comments || !related) return;

  if (enable) {
    related.style.display = "none";
    secondary.appendChild(comments);
    comments.style.display = "block";
    comments.style.maxHeight = "calc(100vh - 80px)";
  } else {
    related.style.display = "";
    document.querySelector("#below").appendChild(comments);
    comments.style.maxHeight = "";
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "toggleShortcut") {
    toggleSidebar(!sidebarEnabled);
  }
  if (message.action === "toggleCommentsSidebar") {
    toggleSidebar(message.enabled);
  }
});
