# Security

## Reporting

If you find a vulnerability, please report it privately through GitHub Security
Advisories once the public repository is live. If advisories are not available,
use the contact path at <https://riahstudio.com/>.

Please do not open a public issue for an active vulnerability before there has
been time to investigate and prepare a fix.

## Security Posture

- No telemetry.
- No remote scripts.
- No remote configuration.
- Minimal permissions per extension.
- Browser-specific manifests are generated from readable source folders.
- Store packages are built from local files and can be inspected before upload.

## Maintenance Checks

Before a public release:

```powershell
npm test
npm run build
npm run package:public
Start All Riah Extensions in Brave.bat --check
```

Also review the generated ZIPs under `release/` and the public export under
`public-export/riah-extensions/`.
