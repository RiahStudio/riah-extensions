# Build your own

These extensions are meant to be **readable and rebuildable**. Download and use them if you want — better still, point an agent at this repo and make a version that fits you.

Daily-tested in **Brave**. Source here also builds for Chrome/Firefox; those browsers are not claimed as personally verified day-to-day.

## Fast path

1. Copy `extension-source/shared/_template/` to a new folder name **without** a leading underscore (example: `shared/my-quiet-tab/`).
2. Edit both manifests: name, description, version, match patterns, permissions. Firefox needs a unique `gecko.id`.
3. Put the whole behavior in `content.js` when you can. Add or delete `popup/` as needed.
4. From `extension-source/`, run:

```bash
npm install
npm run build
```

5. In Brave: **Extensions → Developer mode → Load unpacked** → pick `dist/chrome/<your-folder>/`.

Folders starting with `_` are skipped by the build (so `_template` never ships as a real extension).

## What good looks like

- **One job** per extension.
- Prefer a short `content.js` over a framework.
- Ask only for the host permissions you need.
- Keep icons as simple pink-on-dark glyphs (see other folders under `shared/`).

## Icons

Either:

- Copy `icons/` from another small extension and tweak later, or
- Reuse the studio render script if you have the private workshop tree (`scripts/render-icons.js`).

The template ships with placeholder icons (copied from a simple sibling). Replace them before you publish something under your name.

## Tip jar

If this saved you time: [Buy Me a Coffee](https://buymeacoffee.com/riahstudio).
