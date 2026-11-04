# shared/page-unblock

MAIN-world capture listeners and one MutationObserver that restore paste,
copy, cut, context menu, drag, and selection on pages that block them.

Paste Guard and Right Click Restorer both inject `main-world.js`. The first
copy owns the observer; the second is a no-op. Either extension still works
when the other is not installed.

Call `window.__riahPageUnblock.install("paste-guard")` (or
`"right-click-restorer"`) from the extension's own MAIN-world script. Do not
assign to built-in prototypes.

Only stop those events when the page is actually blocking them (inline
handlers, `user-select: none`, or a document-level `onpaste` / `oncontextmenu`).
Latch per event type only. A footer oncontextmenu must not treat the whole page as blocking drag or select. Skip interactive controls and cross-origin iframe widgets. Ordinary pages keep their own shortcuts. Quiet hosts never get this file.
