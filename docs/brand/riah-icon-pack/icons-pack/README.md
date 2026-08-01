# Riah Icon Pack — 50 glyphs

A range of app icons in the Riah **Ink/Mono** style. Hand this whole folder to Codex or
Claude Code as a style reference to generate more, or pick any icon for a product.

## The frame (identical on every icon — never change it)
Every SVG is a 128×128 grid with this exact wrapper:
1. **Tile** — rounded square, gradient `#18181C → #0C0C0E` (base `#0F0F11`), radius 28.
2. **Spotlight** — faint top radial white glow at 8% opacity.
3. **Hairline** — inset keyline `rgba(255,255,255,0.14)`, 1.4px, radius 21.5.
4. **Glyph** — hot pink, centered on the grid, roughly within x/y 32–96.

## Color + type tokens
- bg `#0F0F11` · ink `#EDEDEF` · body `#9A9AA2` · dim `#77777F` · hairline `rgba(255,255,255,.14)`
- Hot pink gradient `#FF6FBE → #FF2E97 → #D81C7E` (id `pink`); core flat `#FF2E97`. Cutouts use `#0C0C0E`.
- Wordmark / serif: **Newsreader** italic. Labels / mono: **Space Mono**. UI: **Space Grotesk**.

## What's here
- `svg/riah-<name>.svg` — 50 scalable icons (favicon, taskbar, desktop, bookmark, tab).
- `svg/riah-tile-blank.svg` — the empty frame; drop a new glyph in to build another.
- `contact-sheet.html` — open in a browser to see the whole set on the Riah surface.

## Glyphs (50)
bolt, star, heart, spark, play, camera, chat, bars, search, eye, diamond, cards, compass,
globe, rocket, flag, bell, bookmark, folder, doc, grid, layers, sliders, shield, lock, key,
cloud, terminal, code, cursor, wand, palette, brush, crop, image, film, mic, headphones,
note, wave, calendar, clock, check, target, trend, pie, database, cube, link, infinity.

## Prompt to generate more (paste into Codex / Claude Code)
> Make a new Riah icon as a 128×128 SVG. Reuse the exact `<defs>` and the three frame
> rects from any file in `svg/` (tile gradient, spotlight, white hairline). Draw ONE
> centered glyph for "<IDEA>" filling roughly the 32–96 box, colored with `fill="url(#pink)"`
> or `stroke="url(#pink)"`; use `#0C0C0E` for knockouts. Keep strokes 6–10px, rounded caps.
> Match the weight and simplicity of the existing glyphs.

## Extensions (15, prefix `riah-ext-`)
puzzle, clip, highlighter, eyedropper, adblock, translate, snip, pin, share, download,
reader, sync, block, toolbox, plug — browser‑extension glyphs in the same frame.

## Sheets
- `contact-sheet.html` — the 50 app glyphs, labeled.
- `contact-sheet-nameless.html` — the whole set (65), apps + extensions, no labels.

*Icon names are generic metaphors, not committed product names — mix and match per app.*
