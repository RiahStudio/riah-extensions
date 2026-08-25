"use strict";

/*
 * Riah YouTube Resume — puts you back where you were in a video.
 *
 * Brave's Memory Saver (and Firefox's tab unloading) discards an idle tab to
 * free memory. Waking it reloads `watch?v=...`, and that URL carries no
 * timestamp, so YouTube starts the video over and the place is gone. This keeps
 * a small local note of where each video was up to and seeks back to it on the
 * next load — so a YouTube tab can still be discarded without costing anything.
 *
 * Everything stays in local extension storage. Nothing leaves the browser, and
 * no account or watch history is involved.
 */

const PLACE_PREFIX = "place:";
const SETTINGS_KEY = "settings";
const SETTINGS_DEFAULTS = { enabled: true, holdPaused: true };

const MAX_PLACES = 400;            // ~32 KB all told; each place is about 81 bytes
/*
 * Every save overwrites that video's single entry, so the store is bounded by
 * how many videos you have watched, never by how often we write.
 *
 * The moments that actually matter are saved immediately — pause, seek, tab
 * hidden, page going away. This timer is only a backstop for a browser that
 * dies without firing any of them, so it can be slow.
 */
const SAVE_INTERVAL_MS = 15000;
const MIN_REMEMBER_SECONDS = 10;   // the first few seconds are not worth a note
const END_MARGIN_SECONDS = 15;     // this close to the end, it is finished
const ALREADY_MOVED_SECONDS = 3;   // past this, someone else set the position
const SEEK_TOLERANCE_SECONDS = 2;
const POLL_INTERVAL_MS = 250;
const POLL_ATTEMPTS = 60;          // give YouTube ~15s to mount its player
const SEEK_ATTEMPTS = 3;

/* Each navigation gets a generation, so a slow async step belonging to the
   previous video can never attach itself to the new one. */
let generation = 0;
let detach = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (value) => {
        void chrome.runtime.lastError;
        resolve(value || {});
      });
    } catch (_) {
      resolve({});
    }
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch (_) {
      resolve();
    }
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(keys, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch (_) {
      resolve();
    }
  });
}

async function readSettings() {
  const stored = await storageGet(SETTINGS_KEY);
  return { ...SETTINGS_DEFAULTS, ...(stored[SETTINGS_KEY] || {}) };
}

/** The id of whatever is on screen: /watch, /shorts, /live and /embed all count. */
function currentVideoId() {
  let url;
  try {
    url = new URL(location.href);
  } catch (_) {
    return null;
  }
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/);
  return match ? match[1] : null;
}

/** Playlists, mixes, and albums watch in order — an old saved place would skip. */
function isPlaylistUrl() {
  try {
    return new URL(location.href).searchParams.has("list");
  } catch (_) {
    return false;
  }
}

/** A link that already names a time wins — Riah never overrides a chosen start. */
function urlAsksForATime() {
  let url;
  try {
    url = new URL(location.href);
  } catch (_) {
    return false;
  }
  // url.hash keeps its leading "#", so that character has to be allowed for.
  return url.searchParams.has("t") || url.searchParams.has("start") || /(^|[#?&])t=/.test(url.hash);
}

function findVideo() {
  return document.querySelector("video.html5-main-video") || document.querySelector("video");
}

async function waitFor(gen, test) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (gen !== generation) return null;
    const value = test();
    if (value) return value;
    await delay(POLL_INTERVAL_MS);
  }
  return null;
}

/* What was last written, so an unchanged video stops touching the disk. */
let lastWritten = null;

function forget(videoId) {
  if (lastWritten && lastWritten.videoId === videoId) lastWritten = null;
  return storageRemove(PLACE_PREFIX + videoId);
}

function remember(videoId, video) {
  const at = Number(video.currentTime);
  const length = Number(video.duration);
  if (!Number.isFinite(at)) return;
  if (at < MIN_REMEMBER_SECONDS) return;
  if (Number.isFinite(length) && length > 0 && length - at < END_MARGIN_SECONDS) {
    forget(videoId);
    return;
  }
  if (
    lastWritten &&
    lastWritten.videoId === videoId &&
    lastWritten.paused === (video.paused === true) &&
    Math.abs(lastWritten.t - at) < 1
  ) {
    return; // nothing has moved since the last write
  }
  lastWritten = { videoId, t: at, paused: video.paused === true };
  storageSet({
    [PLACE_PREFIX + videoId]: {
      t: at,
      d: Number.isFinite(length) && length > 0 ? length : null,
      paused: video.paused === true,
      at: Date.now()
    }
  });
}

/*
 * YouTube resets currentTime a few times while its player settles, so a single
 * assignment is not enough. Seek, check whether it stuck, and try again a
 * bounded number of times.
 */
async function seekTo(gen, video, seconds) {
  for (let attempt = 0; attempt < SEEK_ATTEMPTS; attempt += 1) {
    if (gen !== generation) return;
    try {
      video.currentTime = seconds;
    } catch (_) {
      return;
    }
    await delay(400);
    if (gen !== generation) return;
    if (Math.abs(Number(video.currentTime) - seconds) < SEEK_TOLERANCE_SECONDS) return;
  }
}

async function restore(gen, videoId, video, settings) {
  if (urlAsksForATime()) return;
  if (isPlaylistUrl()) return;
  if (gen > 1 && !document.wasDiscarded) return;

  const key = PLACE_PREFIX + videoId;
  const stored = (await storageGet(key))[key];
  if (gen !== generation) return;
  if (!stored || !(Number(stored.t) > MIN_REMEMBER_SECONDS)) return;

  // Somebody already put the video somewhere — a chosen position wins.
  if (Number(video.currentTime) > ALREADY_MOVED_SECONDS) return;

  const ready = await waitFor(gen, () => (video.readyState >= 1 ? video : null));
  if (!ready || gen !== generation) return;

  const length = Number(video.duration);
  if (Number.isFinite(length) && length > 0 && length - stored.t < END_MARGIN_SECONDS) {
    await forget(videoId);
    return;
  }

  await seekTo(gen, video, stored.t);
  if (gen !== generation) return;

  if (settings.holdPaused && stored.paused) {
    try {
      video.pause();
    } catch (_) {}
  }
}

function watch(videoId, video) {
  let lastSavedAt = 0;

  const save = (force) => {
    const now = Date.now();
    if (!force && now - lastSavedAt < SAVE_INTERVAL_MS) return;
    lastSavedAt = now;
    remember(videoId, video);
  };

  const onTimeUpdate = () => save(false);
  const onPause = () => save(true);
  const onSeeked = () => save(true);
  const onEnded = () => forget(videoId);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") save(true);
  };
  /* `freeze` is Chromium's warning shot immediately before a discard. The write
     may not survive the freeze, which is exactly why `save` also runs on a
     timer — the most a discard can cost is SAVE_INTERVAL_MS of playback. */
  const onLeaving = () => save(true);

  video.addEventListener("timeupdate", onTimeUpdate);
  video.addEventListener("pause", onPause);
  video.addEventListener("seeked", onSeeked);
  video.addEventListener("ended", onEnded);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("freeze", onLeaving);
  window.addEventListener("pagehide", onLeaving);

  return () => {
    video.removeEventListener("timeupdate", onTimeUpdate);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("seeked", onSeeked);
    video.removeEventListener("ended", onEnded);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("freeze", onLeaving);
    window.removeEventListener("pagehide", onLeaving);
  };
}

async function prune() {
  const everything = await storageGet(null);
  const keys = Object.keys(everything).filter((key) => key.startsWith(PLACE_PREFIX));
  if (keys.length <= MAX_PLACES) return;
  keys.sort((a, b) => (everything[a].at || 0) - (everything[b].at || 0));
  await storageRemove(keys.slice(0, keys.length - MAX_PLACES));
}

async function start() {
  generation += 1;
  const gen = generation;

  if (detach) {
    detach();
    detach = null;
  }

  const videoId = currentVideoId();
  if (!videoId) return;

  const settings = await readSettings();
  if (gen !== generation || !settings.enabled) return;

  const video = await waitFor(gen, findVideo);
  if (!video || gen !== generation) return;
  if (currentVideoId() !== videoId) return;

  detach = watch(videoId, video);
  await restore(gen, videoId, video, settings);
  await prune();
}

document.addEventListener("yt-navigate-finish", start);
window.addEventListener("popstate", start);
start();
