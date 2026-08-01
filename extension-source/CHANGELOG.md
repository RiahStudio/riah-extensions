# Changelog

## 2026-07-22

- Added Riah Volume Boost as a Chromium/Brave-first tab-audio booster with no
  host permissions.
- Prepared the extension source tree for public release with public-safe slugs,
  Riah product names, official icon assets, and shared support links.
- Added static checks for public names, homepage links, support-link wiring,
  minimum permissions, and unsafe code patterns.
- Reduced YouTube startup churn in Riah YouTube Controls and Riah YouTube
  Quality.

## 2026-05-19

- Added the shared settings module at `shared/settings/`.
- Extended `build.js` so shared library folders are vendored into extensions
  that reference them.
- Added unit coverage for the shared settings adapters and migration helpers.
