/**
 * Hosts where Riah must not inject MAIN-world hooks.
 *
 * These apps either fingerprint patched natives (WhatsApp, Discord) or need
 * their own copy / paste / context-menu handlers (Docs, Figma, Slack).
 * Paste Guard, Right Click Restorer, and Autoplay Guard all load this first.
 */
(function (global) {
  "use strict";

  var DOMAINS = [
    "whatsapp.com",
    "whatsapp.net",
    "telegram.org",
    "telegram.me",
    "t.me",
    "discord.com",
    "discordapp.com",
    "slack.com",
    "messenger.com",
    "facebook.com",
    "instagram.com",
    "signal.org",
    "skype.com",
    "zoom.us",
    "figma.com",
    "notion.so",
    "notion.site",
    "miro.com",
    "canva.com",
    "coda.io",
    "airtable.com",
    "github.com",
    "gitlab.com",
    "linear.app",
    "fastmail.com",
    "proton.me",
    "protonmail.com",
    "icloud.com",
    "office.com",
    "office365.com",
    "microsoft365.com",
    "sharepoint.com",
    "claude.ai",
    "chatgpt.com",
    "openai.com",
    "cursor.com"
  ];

  var GOOGLE_APPS = [
    "mail",
    "docs",
    "drive",
    "calendar",
    "accounts",
    "classroom",
    "contacts",
    "keep",
    "photos",
    "voice",
    "chat",
    "meet",
    "myaccount",
    "gemini",
    "aistudio",
    "notebooklm"
  ];

  var MICROSOFT_HOSTS = [
    "teams.microsoft.com",
    "teams.live.com",
    "outlook.live.com",
    "outlook.office.com",
    "outlook.office365.com",
    "onedrive.live.com",
    "login.microsoftonline.com",
    "web.skype.com"
  ];

  function matchesDomain(host, domain) {
    return host === domain || host.endsWith("." + domain);
  }

  function isRiahQuietHost(host) {
    host = String(host || "").toLowerCase();
    if (!host) {
      return false;
    }
    var i;
    for (i = 0; i < DOMAINS.length; i++) {
      if (matchesDomain(host, DOMAINS[i])) {
        return true;
      }
    }
    for (i = 0; i < GOOGLE_APPS.length; i++) {
      if (matchesDomain(host, GOOGLE_APPS[i] + ".google.com")) {
        return true;
      }
    }
    for (i = 0; i < MICROSOFT_HOSTS.length; i++) {
      if (matchesDomain(host, MICROSOFT_HOSTS[i])) {
        return true;
      }
    }
    return false;
  }

  function riahQuietExcludeMatches() {
    var out = [];
    var seen = Object.create(null);
    function add(host) {
      var a = "*://" + host + "/*";
      var b = "*://*." + host + "/*";
      if (!seen[a]) {
        seen[a] = true;
        out.push(a);
      }
      if (!seen[b]) {
        seen[b] = true;
        out.push(b);
      }
    }
    var i;
    for (i = 0; i < DOMAINS.length; i++) {
      add(DOMAINS[i]);
    }
    for (i = 0; i < GOOGLE_APPS.length; i++) {
      add(GOOGLE_APPS[i] + ".google.com");
    }
    for (i = 0; i < MICROSOFT_HOSTS.length; i++) {
      add(MICROSOFT_HOSTS[i]);
    }
    return out;
  }


  function isRiahEmbeddedThirdParty() {
    try {
      if (!global.top || global.top === global) {
        return false;
      }
      var topHost = String((global.top.location && global.top.location.hostname) || "").toLowerCase();
      var host = String((global.location && global.location.hostname) || "").toLowerCase();
      return Boolean(host) && topHost !== host;
    } catch (error) {
      return true;
    }
  }
  global.isRiahQuietHost = isRiahQuietHost;
  global.isRiahEmbeddedThirdParty = isRiahEmbeddedThirdParty;
  global.riahQuietExcludeMatches = riahQuietExcludeMatches;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      isRiahQuietHost: isRiahQuietHost,
      isRiahEmbeddedThirdParty: isRiahEmbeddedThirdParty,
      excludeMatches: riahQuietExcludeMatches()
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

