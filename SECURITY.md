# Security

## Reporting

If you find a vulnerability, please report it privately through GitHub Security
Advisories. If advisories are not available, use the contact path at
<https://riahstudio.com/>.

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

Before cutting a release:

```powershell
npm test
npm run build
npm run package:public
```

Review the generated ZIPs under `release/` before uploading anything to a
browser store.