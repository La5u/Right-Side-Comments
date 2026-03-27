# Right Side Comments

Move YouTube comments to the right sidebar on watch pages.

- Chrome: https://chromewebstore.google.com/detail/right-side-commments/dbbdaiekbopmfbjdchgggfeabapnacnh
- Edge: https://microsoftedge.microsoft.com/addons/detail/ijamadlnojogehkdlgpgmhohcffpofld
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/right-side-comments/
- GitHub: https://github.com/La5u/Right-Side-Comments

## Behavior

- `Extension`: turn the whole extension on/off (Ctrl+Shift+Y).
- `Sidebar`: choose between the custom right-side comments layout, the built-in panel, or disabled.
- `Expand description`: expand when the extension is enabled; collapse when disabled.
- `Related videos`: show or hide related videos.
- `Fullscreen comments`: use YouTube's fullscreen comments button while fullscreen is active.
- `Hide scrollbar`: hide scrollbars on the comments area. Supports inner (comments section) and outer (entire sidebar) scrollbars separately.

## Advanced

- `Comments width`: adjust the width of the comments area (15-40%) for both `Default` and `Built-in` sidebar modes, with a local reset control.
- `Compact comments`: tighter comment spacing.
- `Static comment box`: keeps a fixed container in place while comments load, preventing UI layout shifts.
- `Hide side margins`: remove spacing on the left and right sides of the video.

## Known Issues

- builin doesnt always open

## Defaults

- `extensionEnabled: true`
- `sidebarMode: "default"`
- `autoExpand: true`
- `showRelated: true`
- `innerScrollbar: true`
- `outerScrollbar: false`
- `fullscreenComments: false`
- `compactMargins: true`
- `staticCommentBox: true`
- `commentsWidth: null`
- `hideSideMargins: false`

## Shortcut

- Windows: `Ctrl+Shift+Y`
- macOS: `Command+Shift+Y`
- Linux: `Ctrl+Shift+U`
## Local Development
1. run ./build.sh (version)
2. load the zipped folder

