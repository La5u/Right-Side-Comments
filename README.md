# Right Side Comments
Firefox (priority): https://addons.mozilla.org/en-US/firefox/addon/right-side-comments/  
Chromium: https://chromewebstore.google.com/detail/right-side-commments/dbbdaiekbopmfbjdchgggfeabapnacnh

- Remove right-side video recommendations
- Move comments from below the video to the right, in place of recommendations
- Exand description automatically (when enabled)
- Shortcut on/off - ctrl(cmd) shift y (can be changed in about:addons in Firefox)

### Chromium
To use in chromium, replace the line `"scripts": ["background.js"]` with `"service_worker": "background.js"` in manifest.json.

### Roadmap
- new options such as not expanding description automatically
