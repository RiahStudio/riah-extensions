# Publishing

This repo has two release outputs:

- Store ZIPs under `release/`, created by `npm run package:public`.
- A clean GitHub seed under `public-export/riah-extensions/`, created by
  `npm run export:public`.

contains private workflow and migration notes that should stay local.

## Release Checklist

```powershell
npm test
npm run build
npm run package:public
npm run export:public
```

Then review:

- `release/SHA256SUMS.txt`
- `public-export/riah-extensions/`
- Store listing copy in `docs/STORE-LISTINGS.md`
- Privacy copy in `PRIVACY.md`
- Support links in popup/options pages
- The Buy Me a Coffee slug in `SUPPORT.md`

## Browser Store Notes

- Chrome, Brave, and Edge use the Chromium package under `release/chrome/`.
- Firefox uses the Firefox package under `release/firefox/`.
- Release packaging follows `extensions-registry.json` browser support. Riah
  Volume Boost is Chromium-only until a Firefox audio implementation exists.
- All buildable extensions are Manifest V3.
- Chrome Web Store review expects no remotely hosted extension code.
- Firefox add-on review expects clear disclosure of any data collection. The
  manifests currently declare no required data collection.

Official references:

- Chrome extension manifest reference:
  <https://developer.chrome.com/docs/extensions/reference/manifest>
- Chrome Manifest V3 overview:
  <https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3>
- Chrome Web Store program policies:
  <https://developer.chrome.com/docs/webstore/program-policies>
- Chrome remote-code troubleshooting:
  <https://developer.chrome.com/docs/webstore/troubleshooting>
- Firefox add-on policies:
  <https://extensionworkshop.com/documentation/publish/add-on-policies/>
- Firefox add-on submission:
  <https://extensionworkshop.com/documentation/publish/submitting-an-add-on/>
- Firefox built-in data consent:
  <https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/>

## Store Upload Order

Start with the YouTube set (only if/when store distribution is wanted later):

1. Riah YouTube Controls
2. Riah YouTube Quality

They are easy to explain and have focused regression coverage.

After the first review path is proven, upload the remaining utilities in small
batches. GitHub is the first public surface; stores are optional.
