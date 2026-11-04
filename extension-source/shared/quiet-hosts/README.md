# shared/quiet-hosts

List of app hosts where Paste Guard, Right Click Restorer, and Autoplay Guard
must not inject MAIN-world hooks.

Load `index.js` before the extension's own content scripts. It sets
`isRiahQuietHost(hostname)` on the window. Manifests also use the same list
as `exclude_matches`, so the scripts never even load there.
