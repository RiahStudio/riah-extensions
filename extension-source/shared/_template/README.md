# Extension template

Copy this folder, rename it, and replace the stubs.

1. Copy `_template` to a new folder name (no leading underscore).
2. Edit `manifest.chrome.json` / `manifest.firefox.json` — id, name, description.
3. Put your one job in `content.js` (and `popup/` if you need a UI).
4. From `extension-source/`, run `npm run build`.
5. Load the unpacked folder from `dist/chrome/<your-name>/` in Brave.

Full walkthrough: [docs/BUILD-YOUR-OWN.md](../../../docs/BUILD-YOUR-OWN.md)
