(function () {
  const state = {
    running: false,
    stopping: false,
    includeReplies: false,
    records: new Map(),
    scrollsWithoutNew: 0,
    totalScrolls: 0
  };

  function parseCount(source) {
    if (!source) {
      return "";
    }

    const match = String(source)
      .replace(/\s+/g, " ")
      .match(/([\d,.]+(?:\.\d+)?[KMB]?)/i);
    return match ? match[1] : "";
  }

  function articleStatusUrl(article) {
    const links = Array.from(article.querySelectorAll("a[href*='/status/']"));
    for (const link of links) {
      try {
        const url = new URL(link.href, location.origin);
        if (/\/status\/\d+/.test(url.pathname)) {
          return url;
        }
      } catch (error) {
        void error;
      }
    }
    return null;
  }

  function isReply(article) {
    return Array.from(article.querySelectorAll("div[dir='ltr'], span")).some((node) =>
      /^Replying to\b/i.test((node.textContent || "").trim())
    );
  }

  function parseTweet(article) {
    const url = articleStatusUrl(article);
    if (!url) {
      return null;
    }

    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!match) {
      return null;
    }

    const id = match[2];
    const authorHandle = `@${match[1]}`;
    const text = article.querySelector("[data-testid='tweetText']")?.innerText?.trim() || "";
    const timestamp = article.querySelector("time")?.getAttribute("datetime") || "";
    const replies = parseCount(article.querySelector("[data-testid='reply']")?.getAttribute("aria-label"));
    const retweets = parseCount(article.querySelector("[data-testid='retweet']")?.getAttribute("aria-label"));
    const likes = parseCount(article.querySelector("[data-testid='like']")?.getAttribute("aria-label"));
    const views =
      parseCount(article.querySelector("a[href*='/analytics']")?.innerText) ||
      parseCount(article.querySelector("[aria-label*='Views']")?.getAttribute("aria-label"));

    return {
      id,
      author_handle: authorHandle,
      timestamp,
      text,
      url: url.href,
      replies,
      retweets,
      likes,
      views
    };
  }

  function collectVisibleTweets() {
    let added = 0;
    const articles = document.querySelectorAll("article[data-testid='tweet']");
    for (const article of articles) {
      if (!state.includeReplies && isReply(article)) {
        continue;
      }
      const tweet = parseTweet(article);
      if (!tweet || state.records.has(tweet.id)) {
        continue;
      }
      state.records.set(tweet.id, tweet);
      added += 1;
    }
    return added;
  }

  function csvEscape(value) {
    const raw = value == null ? "" : String(value);
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }

  function buildCsv() {
    const header = [
      "id",
      "author_handle",
      "timestamp",
      "text",
      "url",
      "replies",
      "retweets",
      "likes",
      "views"
    ];
    const rows = [header.join(",")];
    for (const tweet of state.records.values()) {
      rows.push(
        [
          tweet.id,
          tweet.author_handle,
          tweet.timestamp,
          tweet.text,
          tweet.url,
          tweet.replies,
          tweet.retweets,
          tweet.likes,
          tweet.views
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    return rows.join("\r\n");
  }

  function currentFilename() {
    const slug = location.pathname
      .replace(/^\/+/, "")
      .replace(/[^\w/-]+/g, "-")
      .replace(/[/-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "timeline-exporter";
    return `${slug}-${Date.now()}.csv`;
  }

  function snapshot() {
    return {
      running: state.running,
      stopping: state.stopping,
      count: state.records.size,
      totalScrolls: state.totalScrolls,
      includeReplies: state.includeReplies,
      canDownload: state.records.size > 0
    };
  }

  function scrollLoop() {
    if (!state.running) {
      return;
    }

    const added = collectVisibleTweets();
    state.totalScrolls += 1;
    state.scrollsWithoutNew = added === 0 ? state.scrollsWithoutNew + 1 : 0;

    if (state.stopping || state.scrollsWithoutNew >= 6) {
      state.running = false;
      state.stopping = false;
      return;
    }

    window.scrollBy(0, Math.max(window.innerHeight * 0.85, 600));
    setTimeout(scrollLoop, 900);
  }

  function startExport(includeReplies) {
    state.includeReplies = !!includeReplies;
    state.stopping = false;
    if (state.running) {
      return snapshot();
    }

    state.running = true;
    state.scrollsWithoutNew = 0;
    collectVisibleTweets();
    setTimeout(scrollLoop, 400);
    return snapshot();
  }

  function stopExport() {
    state.stopping = true;
    return snapshot();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "riah-timeline-exporter-status") {
      sendResponse(snapshot());
      return;
    }

    if (message?.type === "riah-timeline-exporter-start") {
      sendResponse(startExport(message.includeReplies));
      return;
    }

    if (message?.type === "riah-timeline-exporter-stop") {
      sendResponse(stopExport());
      return;
    }

    if (message?.type === "riah-timeline-exporter-download") {
      const csv = buildCsv();
      chrome.runtime.sendMessage(
        {
          type: "riah-timeline-exporter-download",
          csv,
          filename: currentFilename()
        },
        (response) => {
          sendResponse(response);
        }
      );
      return true;
    }
  });
})();
