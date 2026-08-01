window.RIAH_COOKIE_RULES = [
  {
    id: "onetrust",
    bannerSelectors: ["#onetrust-banner-sdk", ".ot-sdk-container"],
    rejectSelectors: ["#onetrust-reject-all-handler", ".ot-pc-refuse-all-handler"],
    dismissSelectors: [".onetrust-close-btn-handler", ".ot-close-icon"],
    acceptSelectors: ["#onetrust-accept-btn-handler", ".ot-sdk-save"],
    vendor: "OneTrust"
  },
  {
    id: "usercentrics",
    bannerSelectors: ["#usercentrics-root", "[data-testid='uc-banner-content']"],
    rejectSelectors: ["[data-testid='uc-deny-all-button']", "[data-testid='uc-more-button']"],
    dismissSelectors: ["button[data-testid='uc-close-button']"],
    acceptSelectors: ["[data-testid='uc-accept-all-button']"],
    vendor: "Usercentrics"
  },
  {
    id: "cookiebot",
    bannerSelectors: ["#CybotCookiebotDialog", "#CybotCookiebotDialogBody"],
    rejectSelectors: ["#CybotCookiebotDialogBodyButtonDecline", "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll"],
    dismissSelectors: [".CybotCookiebotDialogBodyButton"],
    acceptSelectors: ["#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"],
    vendor: "Cookiebot"
  },
  {
    id: "quantcast",
    bannerSelectors: [".qc-cmp2-container", ".qc-cmp2-summary-container"],
    rejectSelectors: [".qc-cmp2-summary-buttons button[mode='secondary']", ".qc-cmp2-footer button[mode='secondary']"],
    dismissSelectors: [".qc-cmp2-close-icon"],
    acceptSelectors: [".qc-cmp2-summary-buttons button[mode='primary']"],
    vendor: "Quantcast"
  },
  {
    id: "didomi",
    bannerSelectors: ["#didomi-host", ".didomi-popup-container"],
    rejectSelectors: ["#didomi-notice-disagree-button", ".didomi-continue-without-agreeing"],
    dismissSelectors: [".didomi-popup-closeBtn-icon"],
    acceptSelectors: ["#didomi-notice-agree-button"],
    vendor: "Didomi"
  },
  {
    id: "sourcepoint",
    bannerSelectors: ["#sp_message_container", ".sp_veil"],
    rejectSelectors: ["button[title='Reject All']", "button[data-testid='reject-all']"],
    dismissSelectors: [".message-component .close-btn"],
    acceptSelectors: ["button[title='Accept All']"],
    vendor: "Sourcepoint"
  },
  {
    id: "trustarc",
    bannerSelectors: ["#truste-consent-track", ".truste_box_overlay"],
    rejectSelectors: [".rejectAll", ".truste-button2"],
    dismissSelectors: [".closeButton", ".call"],
    acceptSelectors: [".acceptAll", ".truste-button1"],
    vendor: "TrustArc"
  },
  {
    id: "osano",
    bannerSelectors: [".osano-cm-window", ".osano-cm-dialog"],
    rejectSelectors: [".osano-cm-denyAll", ".osano-cm-deny"],
    dismissSelectors: [".osano-cm-close"],
    acceptSelectors: [".osano-cm-acceptAll", ".osano-cm-accept"],
    vendor: "Osano"
  },
  {
    id: "cookieyes",
    bannerSelectors: ["#cookie-law-info-bar", ".cky-consent-container"],
    rejectSelectors: [".cky-btn-reject", "#cookie_action_close_header_reject"],
    dismissSelectors: [".cky-banner-btn-close"],
    acceptSelectors: [".cky-btn-accept", "#cookie_action_close_header"],
    vendor: "CookieYes"
  },
  {
    id: "termly",
    bannerSelectors: [".termly-cookie-preference-overlay", ".termly-styles-root"],
    rejectSelectors: [".termly-decline-button", ".t-declineButton"],
    dismissSelectors: [".termly-close-button"],
    acceptSelectors: [".termly-accept-button", ".t-acceptButton"],
    vendor: "Termly"
  },
  {
    id: "iubenda",
    bannerSelectors: [".iubenda-cs-container", "#iubenda-cs-banner"],
    rejectSelectors: [".iubenda-cs-reject-btn", ".iubenda-cs-customize-btn"],
    dismissSelectors: [".iubenda-cs-close-btn"],
    acceptSelectors: [".iubenda-cs-accept-btn"],
    vendor: "Iubenda"
  },
  {
    id: "klaro",
    bannerSelectors: [".klaro", "#klaro"],
    rejectSelectors: [".cn-decline", ".cm-btn-success-var"],
    dismissSelectors: [".klaro .close"],
    acceptSelectors: [".cm-btn-accept", ".klaro .accept"],
    vendor: "Klaro"
  }
];
