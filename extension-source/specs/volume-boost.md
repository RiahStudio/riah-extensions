# Spec: volume-boost

Riah Volume Boost increases or mutes audio for the active tab in Brave and
other Chromium browsers. It replaces both legacy volume extensions with one
Riah-branded tool.

## What It Does

- Popup slider from 0% to 600%.
- Quick buttons for 100%, 200%, mute, and reset.
- Per-tab gain memory while the tab remains open.
- Releases the tab capture when reset to 100% or when the tab closes.
- Warns when the value rises above 200%.

## Target Folder

`shared/volume-boost/`

## Files

- `manifest.chrome.json`
- `manifest.firefox.json`
- `popup.html`, `popup.js`, `popup.css`
- `background.js`
- `offscreen.html`, `offscreen.js`
- `icons/`

## Permissions

- `activeTab`: target the current tab after the user invokes the extension.
- `tabCapture`: request a current-tab audio stream.
- `offscreen`: run DOM and media APIs outside the service worker.
- `storage`: remember active per-tab gain.
- `tabs`: identify the active tab and release state when tabs close.

No host permissions are required.

## Chromium Implementation

The popup sends gain requests to the background service worker. The service
worker creates an offscreen document, gets a tab stream ID through
`chrome.tabCapture.getMediaStreamId`, and asks the offscreen document to route
that audio through Web Audio:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    mandatory: {
      chromeMediaSource: "tab",
      chromeMediaSourceId: streamId
    }
  },
  video: false
});

const context = new AudioContext();
const source = context.createMediaStreamSource(stream);
const gainNode = context.createGain();
source.connect(gainNode);
gainNode.connect(context.destination);
```

Routing the captured stream back through `AudioContext.destination` is required;
otherwise Chromium stops playing the captured tab's audio to the user.

## Firefox Status

Firefox does not expose the same Chromium `tabCapture` and offscreen document
flow. The Firefox manifest is present for naming/build consistency, but the
popup disables itself with an unsupported-browser message. Do not package or
publish a Firefox release until a separate media-element implementation is
built and tested.

## Acceptance Criteria

- Moving the slider above 100% audibly increases a quiet tab.
- Mute sets gain to 0 without broad host permissions.
- Reset returns to normal audio and releases the tab capture.
- Closing a captured tab stops tracks and clears stored per-tab gain.
- The popup includes the small Riah Studio and Buy Me a Coffee footer.
