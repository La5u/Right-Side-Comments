# Right Side Comments

Firefox: https://addons.mozilla.org/en-US/firefox/addon/right-side-comments/  
Chromium: https://chromewebstore.google.com/detail/right-side-commments/dbbdaiekbopmfbjdchgggfeabapnacnh

Move YouTube comments from below the video into the right sidebar (where recommendations usually appear), with quick toggles from the popup or keyboard shortcut.

## Features

- Move comments to the right sidebar on `/watch` pages.
- Toggle sidebar mode from popup or keyboard shortcut.
- Optional auto expand/collapse of the description.
- Optional hide/show related videos.
- Settings apply immediately when changed in the popup.
- Handles YouTube SPA navigation (`yt-navigate-finish`) so behavior persists when opening videos in-place.

## Options

- `Sidebar`: Enable/disable right-side comments mode.
- `Auto expand`: Expand description when sidebar mode is enabled; collapse when disabled.
- `Hide related`: Hide right-side recommendations while sidebar mode is enabled.

Default values on install:

- `sidebarEnabled: true`
- `autoExpand: true`
- `hideRelated: true`

## Shortcut

- Default: `Ctrl+Shift+Y` (`Cmd+Shift+Y` on macOS)
- Command id: `toggle-comments-sidebar`
- You can remap it from browser extension shortcut settings.

## Local Usage

This repo keeps separate manifests for browser targets.

1. For Firefox, copy `manifest.firefox.json` to `manifest.json`.
2. For Chromium, copy `manifest.chromium.json` to `manifest.json`.
3. Load as unpacked extension from the project folder.

## Project Structure

- `content.js`: DOM logic (move comments, apply options, handle navigation).
- `background.js`: install defaults, command shortcut handling, icon switching.
- `popup.html` / `popup.js` / `popup.css`: popup UI and setting updates.
- `style.css`: small style adjustments for moved comments.
