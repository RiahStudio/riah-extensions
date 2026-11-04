# Extension Icon Mapping

Every extension now carries its **own** glyph from the Riah Icon Pack. The
previous mapping reused a handful of generic Riah *product* marks across the
whole set, which is why every card in the browser's extensions page looked
identical.

Source pack: `docs/brand/riah-icon-pack/icons-pack/svg/` (Ink/Mono style,
128×128, hot-pink glyph on the standard dark tile).

| Extension slug | Public name | Glyph |
| --- | --- | --- |
| `autoplay-guard` | Riah Autoplay Guard | `riah-ext-block` |
| `cookie-quiet` | Riah Cookie Quiet | `riah-ext-adblock` |
| `library-search` | Riah Library Search | `riah-ext-reader` |
| `paste-guard` | Riah Paste Guard | `riah-ext-clip` |
| `right-click-restorer` | Riah Right Click Restorer | `riah-cursor` |
| `tab-anchor` | Riah Tab Anchor | `riah-ext-pin` |
| `tab-sleeper` | Riah Tab Sleeper | `riah-clock` |
| `tenhou-english` | Riah Tenhou English | `riah-ext-translate` |
| `thai-year-helper` | Riah Thai Year Helper | `riah-calendar` |
| `timeline-exporter` | Riah Timeline Exporter | `riah-ext-download` |
| `volume-boost` | Riah Volume Boost | `riah-wave` |
| `youtube-controls` | Riah YouTube Controls | `riah-play` |
| `youtube-quality` | Riah YouTube Quality | `riah-sliders` |
| `english-search` | Riah English Search | `riah-search` |

## Regenerating

The pack ships SVG only, but manifests reference 32/128 PNG exports and the
static audit also requires 512.png and source.svg. `scripts/render-icons.js`
rasterises them by driving headless Edge over CDP — the same browser the test
suite already uses — so the project stays dependency-free.

```bash
node scripts/render-icons.js --check
```

```bash
node scripts/render-icons.js
```

`--check` prints the mapping and writes nothing. The real run fails loudly if a
built extension has no glyph assigned, so a new extension cannot quietly ship
without an icon.

Each extension folder ends up with `icons/32.png`, `icons/128.png`,
`icons/512.png`, and `icons/source.svg`. The manifests reference only 32 and 128.

**Browsers cache extension icons hard.** After regenerating, a card reload is not
enough — restart the browser to see the new icon.
