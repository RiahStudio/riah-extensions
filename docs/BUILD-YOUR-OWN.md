# Build your own

These extensions are meant to be **readable and rebuildable**. Loading the zips is fine. The better use is: inventory what you already run, decide what is worth replacing, then point an agent at this repo and rebuild the small jobs in source you control.

Daily-tested in **Brave**. Chrome/Firefox packages exist in tree; those browsers are not a personal day-to-day claim yet.

## The loop

1. **Inventory** what is installed.
2. **Triage** replace / keep / skip.
3. **Rebuild** one job from `_template` or an existing slug.
4. **Load unpacked**, disable the old store copy, live with it.
5. Repeat. Do not boil the ocean in one night.

---

## 1. Inventory your browser

### Automatic (recommended for agents)

Chromium stores the install list on disk. This repo ships a zero-dependency scanner:

```powershell
node scripts/inventory-extensions.mjs
node scripts/inventory-extensions.mjs --browser brave
node scripts/inventory-extensions.mjs --browser chrome --profile "Default"
node scripts/inventory-extensions.mjs --json > inventory.json
```

It reads `Secure Preferences` / `Preferences` plus each extension's `manifest.json` under the profile. It does **not** need the `management` permission and does **not** install anything.

Default paths (Windows):

| Browser | User Data |
| --- | --- |
| Brave | `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\` |
| Chrome | `%LOCALAPPDATA%\Google\Chrome\User Data\` |
| Edge | `%LOCALAPPDATA%\Microsoft\Edge\User Data\` |

Profile folder is usually `Default`, sometimes `Profile 1`, etc.

The script prints buckets:

- **replace-candidate** — same job as something small/DIY-able (often a match to a slug here)
- **review** — powerful permissions or unclear; human/agent judgment
- **keep** — password managers, wallets, serious blockers, 2FA, etc.
- **skip** — browser components / defaults

Treat the buckets as a starting triage, not law.

### Manual

1. Open `brave://extensions` (or `chrome://extensions`).
2. Paste a screenshot or a copied list into your agent.
3. Or export names yourself and ask the agent to map them to jobs.

### What agents should ask for

Give the agent either:

- the markdown/JSON from `inventory-extensions.mjs`, or
- access to read the profile path above,

plus this repo. Then ask for a **one-page rebuild plan**: what to replace first, what to leave alone, and which slug or `_template` to start from.

---

## 2. What is good to replace vs not

### Good replace candidates

Small, local, one-job tools where a store listing is mostly convenience:

- Restore paste / right-click / select
- Cookie-banner dismissal
- Autoplay blocking outside the site’s own player chrome
- Tab audio boost / mute
- “Open YouTube paused” / quality ceiling
- Tiny site-specific helpers (year formats, game UI labels, export visible posts)

**Smell test:** if the feature is a few hundred lines of content-script logic and the store extension wants `<all_urls>` plus a pile of APIs, it is a rebuild candidate.

Also prefer replacing extensions when:

- the publisher is unknown, silent, or recently changed hands
- updates are opaque and you cannot read the source you run
- you only use one feature of a kitchen-sink tool

### Usually keep

Do **not** DIY these for fun:

| Keep | Why |
| --- | --- |
| Password managers | Account destruction if you get it wrong |
| Wallets / crypto | Same, worse |
| uBlock-class blockers | Filter-list ecosystem + years of edge cases |
| Authenticator / 2FA | Trust and backup story |
| Official first-party helpers you already audited | Low gain |

Power-user platforms (Tampermonkey, Stylus, Vimium, Dark Reader) stay unless you already live in that stack and want a thinner custom tool.

### Prefer native first

Before rebuilding, check whether the browser already does it:

- Brave Shields / Firefox cookie banner handling vs a consent-clicker
- Memory Saver / Sleeping Tabs vs a tab sleeper
- Built-in translate / zoom (this repo already retired those when native won)

If native covers 80% of the job, delete the extension instead of cloning it.

### Map to this repo

| Job | Start from |
| --- | --- |
| Block autoplay | `autoplay-guard` |
| Cookie banners | `cookie-quiet` |
| Paste | `paste-guard` |
| Right-click / copy | `right-click-restorer` |
| Volume | `volume-boost` |
| YouTube pause / autoplay / captions | `youtube-controls` |
| YouTube quality cap | `youtube-quality` |
| Re-dock tabs | `tab-anchor` |
| Idle tab sleep (Firefox) | `tab-sleeper` |
| Something else | `shared/_template/` |

Names in the wild will not match these slugs. Match on **job**, not brand.

---

## 3. Rebuild

### Fast path

1. Copy `extension-source/shared/_template/` to a new folder name **without** a leading underscore.
2. Edit both manifests: name, description, version, matches, permissions. Firefox needs a unique `gecko.id`.
3. Put the behavior in `content.js` when you can. Add or delete `popup/` as needed.
4. From `extension-source/`:

```bash
npm install
npm run build
```

5. Brave → Extensions → Developer mode → Load unpacked → `extension-source/dist/chrome/<your-folder>/`.
6. Disable the store extension you are replacing. Do not run both forever “just in case.”

Folders starting with `_` are skipped by the build.

### Agent prompt you can paste

```text
Read docs/BUILD-YOUR-OWN.md in this repo.
I will paste an extension inventory (or point you at my Brave profile).
Triage replace / keep / skip.
Propose the single best first rebuild: the job, which slug or _template to copy,
permissions to ask for, and what to disable afterward.
Then implement that one extension only.
```

### What good looks like

- One job per extension
- Short readable `content.js`, no framework cosplay
- Minimum host permissions
- Pink-on-dark glyph so you can see it on the toolbar
- You can explain every permission in one sentence

### Icons

Copy `icons/` from a sibling, or use the workshop render script if you have it. Replace placeholders before you publish under your name.

---

## Tip jar

If this saved you time: [Buy Me a Coffee](https://buymeacoffee.com/riahstudio).