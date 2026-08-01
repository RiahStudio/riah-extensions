# Spec: cookie-quiet

Dismisses common cookie banners using local rules and conservative reject-first behavior.

## What it does

Auto-dismisses the cookie/GDPR consent banners that every EU-facing website throws in your face. Prefers "Reject all" where a reject button exists. Falls back to dismissing the banner if only "Accept" is available (never auto-accepts unless the user opts into that mode in settings).

## Target folder

`shared/cookie-quiet/`

## Files to create

- `manifest.chrome.json`
- `manifest.firefox.json`
- `content.js` 窶・runs on every page; finds & clicks the right consent button
- `rules.js` 窶・static list of known selectors (CMP vendors: OneTrust, Cookiebot, TrustArc, Quantcast, Didomi, Sourcepoint, etc.) plus generic heuristics
- `popup.html` + `popup.js` + `popup.css` 窶・per-site toggle ("dismiss on this site: on/off/accept-all-here")
- `options.html` + `options.js` 窶・global settings (default mode: reject-all / dismiss-only / disabled; allow-list)
- `background.js` 窶・persists settings, handles messaging
- `icons/16.png`, `32.png`, `48.png`, `128.png`

## Permissions

- `host_permissions`: `<all_urls>` 窶・unavoidable, banners appear everywhere
- `storage` 窶・user settings
- **No** `tabs`, **no** `webRequest`, **no** `cookies`. The extension clicks DOM buttons. That's it.

## Detection strategy

1. On DOMContentLoaded and on MutationObserver changes, scan for known CMP containers:
   - `#onetrust-reject-all-handler`, `#onetrust-banner-sdk`
   - `[data-testid="uc-deny-all-button"]` (Usercentrics)
   - `#CybotCookiebotDialogBodyButtonDecline` (Cookiebot)
   - `.qc-cmp2-summary-buttons button[mode="primary"]` (Quantcast)
   - Didomi: `#didomi-notice-disagree-button`
   - Sourcepoint: `button[title="Reject All"]`
   - Plus 10-15 more big vendors 窶・spec this out to a `rules.js` table
2. Generic heuristic fallback: find buttons whose text matches `/^(reject|decline|deny|refuse|necessary only|use necessary)/i`, prefer the one inside an element with "cookie|consent|gdpr" in class/id/aria-label.
3. Click it. Observe removal. Done.

## Anti-patterns to avoid

- Do NOT click any "Accept all" button unless the site is explicitly in "auto-accept" mode in user settings.
- Do NOT inject external scripts. Rules live in `rules.js` shipped with the extension.
- Do NOT phone home. No analytics, no remote rule updates. If rules go stale, user updates the extension.

## Popup UI

- Current site: `example.com`
- Status: "Active" / "Disabled here" / "Auto-accept here"
- Three radio buttons for this site's mode.
- "Settings" link 竊・options page.

## Options page

- Default mode (radio): Reject all / Dismiss only / Disabled
- Textarea: per-site overrides, one host per line as `example.com=accept`
- Link to rules.js source ("audit the rules 竊・)

## Firefox vs Chrome notes

Same content-script model works in both. Use `chrome.*` APIs throughout. For `chrome.storage.sync` 窶・in Firefox it works but has a smaller quota; our settings are tiny so it's fine.

## Acceptance criteria

- Open 5 EU news sites (theguardian.com, lemonde.fr, spiegel.de, bbc.com, zeit.de) 竊・banner is auto-dismissed or "Reject all" is clicked within 2s of load.
- Add `mydomain.com` to disabled list 竊・banner appears normally on `mydomain.com`.
- No extension code references a remote URL.
- Extension stays under 50 KB total.
