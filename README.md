# Right Side Comments

Move YouTube comments to the right sidebar on watch pages.

- Chrome: https://chromewebstore.google.com/detail/right-side-commments/dbbdaiekbopmfbjdchgggfeabapnacnh
- Edge: https://microsoftedge.microsoft.com/addons/detail/ijamadlnojogehkdlgpgmhohcffpofld
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/right-side-comments/
- GitHub: https://github.com/La5u/Right-Side-Comments

## Behavior

- `Sidebar`: turn right-side comments on/off (Ctrl+Shift+Y).
- `Expand description`: expand when sidebar mode is enabled; collapse when disabled (intentional).
- `Related videos`: show or hide related videos.

## UI

- `Compact comments`: tighter comment spacing.
- `Static comment box`: keeps a fixed container in place while comments load, preventing UI layout shifts.
- `Hide scrollbar`: hide scrollbars on the comments area. Supports inner (comments section) and outer (entire sidebar) scrollbars separately.

## Experimental

- `Comments width`: adjust the width of the comments sidebar (15-40%).
- `Hide side margins`: remove spacing on the left and right sides of the video.

## Defaults

- `sidebarEnabled: true`
- `autoExpand: true`
- `showRelated: true`
- `innerScrollbar: true`
- `outerScrollbar: false`
- `compactMargins: true`
- `staticCommentBox: true`
- `commentsWidth: null`
- `hideSideMargins: false`

## Shortcut

- Windows: `Ctrl+Shift+Y`
- macOS: `Command+Shift+Y`
- Linux: `Ctrl+Shift+U`

## Local Development

1. Copy `manifest.firefox.json` or `manifest.chromium.json` to `manifest.json`.
2. Load the project folder as an unpacked extension.

Landing page files live in `docs/`.
