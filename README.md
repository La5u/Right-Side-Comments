# Right Side Comments

Move YouTube comments to the right sidebar on watch pages.

- Chrome: https://chromewebstore.google.com/detail/right-side-commments/dbbdaiekbopmfbjdchgggfeabapnacnh
- Edge: https://microsoftedge.microsoft.com/addons/detail/ijamadlnojogehkdlgpgmhohcffpofld
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/right-side-comments/
- GitHub: https://github.com/La5u/Right-Side-Comments

## Toggles

- `Sidebar`: turn right-side comments on/off.
- `Expand description`: expand when sidebar mode is enabled; collapse when disabled (intentional).
- `Show recommended`: show or hide related videos.
- `Show scrollbar`: show/hide the comments scrollbar.
- `Compact comments`: tighter comment spacing.
- `Persistent comment box`: keep a fixed comments container in sidebar mode to reduce layout shifts.

## Defaults

- `sidebarEnabled: true`
- `autoExpand: true`
- `showRelated: true`
- `showScrollbar: false`
- `compactMargins: true`
- `persistentCommentBox: true`

## Shortcut

- Windows: `Ctrl+Shift+Y`
- macOS: `Command+Shift+Y`
- Linux: `Ctrl+Shift+U`

## Local Development

1. Copy `manifest.firefox.json` or `manifest.chromium.json` to `manifest.json`.
2. Load the project folder as an unpacked extension.

Landing page files live in `docs/`.
