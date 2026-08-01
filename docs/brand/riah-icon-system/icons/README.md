# Riah Icon System

One repeatable app-icon mark for every Riah product. The system uses a
near-black tile, white hairline, hot-pink mark, and one product-specific glyph
or monogram.

## Constants

1. Tile: near-black rounded square, `#0F0F11`, softly lit from the top.
2. Hairline: thin white inset keyline, `rgba(255,255,255,0.14)`.
3. Hot pink: `#FF2E97`, with gradient stops `#FF6FBE`, `#FF2E97`, `#D81C7E`.
4. Glyph: one hot-pink silhouette per product, or a serif-italic two-letter
   monogram.

## Tokens

- Background: `#0F0F11`
- Ink: `#EDEDEF`
- Body: `#9A9AA2`
- Dim: `#77777F`
- Hairline: `rgba(255,255,255,.14)`
- Hot pink: `#FF2E97`
- Hot pink light: `#FF6FBE`
- Hot pink deep: `#D81C7E`
- Wordmark and monogram font: Newsreader, serif italic
- UI font: Space Grotesk
- Label font: Space Mono
- Tile corner radius: 22%

## Files

- `svg/riah-<product>.svg`: scalable glyph icon.
- `svg/riah-<product>-mono.svg`: two-letter monogram variant.
- `svg/riah-tile.svg`: empty tile for new glyphs.
- `png/riah-<product>-{512,128,32}.png`: raster exports.

SVG files are the masters. PNG files are exports for browser and store surfaces
that require raster assets.

## Adding a Product

Start from `svg/riah-tile.svg`, keep the tile, hairline, and pink treatment,
then draw one centered glyph on the 128 grid or set a two-letter monogram.
