# Cadran Web

A GitHub Pages compatible web edition of Cadran 1.2.3. It preserves the existing interface and stores settings, customizations, and bookmarks in this browser's local storage.

## Deploy to GitHub Pages

1. Create a GitHub repository for this web edition.
2. Upload the **contents of this folder** to the repository root. `index.html` is the GitHub Pages entry point.
3. In **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. Open the Pages URL shown by GitHub. The page is static and needs no build step or server.

## Use on Android

Chrome for Android does not support extension-based new tab overrides or setting an arbitrary URL as the actual new tab page. You can set the Pages URL as Chrome's homepage (Settings → Homepage) and add the site to your Android home screen from Chrome's menu. This does not replace Chrome's new tab screen.

## Web edition limitations

A normal website cannot access Chrome's privileged extension APIs. This edition therefore uses a local bookmark tree instead of Chrome's real bookmarks. Its bookmarks do not automatically sync with Chrome bookmarks. Use the **⇧ button** at the bottom-right to import a standard bookmarks HTML export. On Android, Chrome does not provide a public API to export its own bookmarks, so create/export the HTML file from a desktop browser or another bookmark manager first. The browser's recently closed tabs, native top sites, private windows, tab grouping, and extension permission prompts are unavailable. Opening a link in a new tab depends on the browser's popup rules.

Settings and bookmarks stay in the current browser profile and origin. They do not sync between devices. Use the app's own export/import options if available to move data.

## Privacy

Cadran stores its settings and bookmarks locally in browser storage. Search queries go to the search engine selected in the app. Favicon requests use Google's public favicon service, with a 256 px size request where the service has a larger source icon. The web version requests these icons automatically and does not show an extension-permission toggle. GitHub Pages serves the static files over HTTPS.
