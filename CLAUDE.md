# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Server

```bash
npm run dev
# → http://localhost:3000
```

No build step. Static site served as-is.

## Architecture

Single-page app — vanilla JS + Canvas API, no framework, no bundler.

| File | Role |
|---|---|
| `index.html` | 4-step SPA shell. Steps: `#step-upload` → `#step-crop` → `#step-edit` → `#step-result` |
| `app.js` | All logic — single module, no imports except lazy CDN load for BG removal |
| `style.css` | All styles — CSS custom properties, no preprocessor |
| `template.jpg` | 1280×960 source template image (by @metewo_shooting) |
| `tools/calibrate.html` | Click-to-measure tool for updating PHOTO/PANELS pixel coordinates |

## Canvas Rendering

`drawTemplate(ctx, scale)` is the single render function used for both preview (scaled) and export (scale=1):

1. Draws `template.jpg` as full-canvas background
2. Clips and draws the user photo into `PHOTO` bounds
3. Draws text vertically centered inside each `PANELS[i]` rect

All coordinates in `app.js` are in **template-native pixels (1280×960)**. The `scale` parameter maps them to canvas display size.

## Key Constants

```js
PHOTO = { x, y, w, h }        // photo panel clip area in template px
PANELS = [{ key, x, y, w, h }] // text areas for encounter / feature / appeal
```

To re-calibrate after template changes: open `tools/calibrate.html` in the dev server, click TL→BR for each area, paste output into `app.js`.

## Photo Transform

`state.photo.transform = { scale: 100, x: 0, y: 0 }` uses a **virtual 300×400 coordinate system** for x/y offsets, mapped to the actual PHOTO slot dimensions at draw time. Range: scale 50–300%, x/y ±300.

## State Shape

```js
state = {
  photo: { original, processed, objectUrl, transform },
  texts: { encounter, feature, appeal },
  font: 'zen',           // FONT_OPTIONS id
  bgRemoveEnabled,
  bgRemover,             // cached @imgly/background-removal module
}
```

`state.photo.original` = raw File; `processed` = BG-removed Blob (or same as original); `objectUrl` = current object URL for canvas drawing.

## Step Navigation

`showStep(n)` toggles `.hidden` on step divs and updates `.step-dot` classes. Step 2 (crop) calls `initEditorUI()` + `renderEditorCanvas()`. Step 3 (text) calls `renderPreview()`. Generate (step 3→4) renders at full 1280×960 to `#result-canvas`.

## BG Removal

Lazy-loaded from CDN (`@imgly/background-removal@1.5.5`). Requires COOP/COEP headers (see `_headers`) for SharedArrayBuffer. Falls back to original image on error.

## Deployment

Cloudflare Pages: push repo root. `_headers` file sets COOP/COEP automatically.
