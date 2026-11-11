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

Cadran stores its settings and bookmarks locally in browser storage. Search queries go to the search engine selected in the app. Brand icons load as SVGs from the theSVG catalogue through jsDelivr. Cadran resolves common domains directly and consults the theSVG brand registry only when a domain needs an exact match. If the catalogue has no matching brand, Cadran tries icon images published by that site and then generates a coloured-letter icon. The web edition does not use Google's favicon service and does not require site-access permissions for icons. GitHub Pages serves the static files over HTTPS.

## Personal edition

All features are available without a premium tier or licence check. This includes independent wallpapers for tabs, automatic wallpaper rotation, and the analog clock. Payment links, licence activation, and premium gating are removed from the web edition.
