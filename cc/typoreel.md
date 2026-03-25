# TypoReel v4 — Algorithm & Workflow Documentation

> A single-file, dependency-free animated typography engine that converts plain text scripts into canvas-rendered video exports (MP4 / GIF / PNG frames) entirely in the browser.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Seeded Randomness System](#2-seeded-randomness-system)
3. [Script Parsing](#3-script-parsing)
4. [Build Phase — Line Data Construction](#4-build-phase--line-data-construction)
5. [Layout Engine](#5-layout-engine)
6. [Animation System](#6-animation-system)
7. [FX Rendering Pipeline](#7-fx-rendering-pipeline)
8. [Shadow System](#8-shadow-system)
9. [Background Engine (BG Studio)](#9-background-engine-bg-studio)
10. [Main Animation Loop](#10-main-animation-loop)
11. [Export Pipeline](#11-export-pipeline)
12. [Randomise Effects System](#12-randomise-effects-system)
13. [State Object (S)](#13-state-object-s)
14. [Data Flow Diagram](#14-data-flow-diagram)

---

## 1. Architecture Overview

TypoReel is entirely self-contained in one `.html` file. There is no build step, no server, no npm. The full stack is:

```
HTML  →  CSS (retro OS theme)  →  JavaScript
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                 ▼
               Script Parser    Canvas Renderer    Export Engine
                     │                │                 │
                     ▼                ▼                 ▼
               LineData[]       requestAnimationFrame   MP4 / GIF / ZIP
```

**Key design principles:**

- **Zero runtime dependencies** during animation. JSZip is loaded dynamically only when "Export Frames" is clicked.
- **Deterministic output** — the same seed + settings always produce identical visuals. Randomness is fully seeded, never truly random during draw calls.
- **Single global state object `S`** — all settings live in one flat object, making serialisation and randomisation trivial.
- **Pre-bake, don't compute per-frame** — expensive values (shadow offsets, colours, fonts, sizes) are computed once at build time and frozen on word objects. The draw loop reads constants, never computes.

---

## 2. Seeded Randomness System

### The RNG

```js
function mkRng(seed) {
  let x = seed ^ 0xdeadbeef;
  return () => {
    x = Math.imul(x ^ x>>>16, 0x45d9f3b);
    x = Math.imul(x ^ x>>>16, 0x45d9f3b);
    x ^= x>>>16;
    return (x >>> 0) / 4294967296;
  };
}
```

This is a **xorshift-multiply PRNG** — fast, produces values in `[0, 1)`, and is fully deterministic from the seed. It is used to drive all "random" choices: font selection, colour picking, animation assignment, size, tilt, shadow offset, and FX type.

### Seed Isolation

Each word in each line gets its **own isolated RNG instance**, seeded with a formula that depends on both the line seed and the word index:

```js
const wr = mkRng(lineSeed * 31 + i * 179);
```

This means:
- Changing word `i` does not affect word `i+1`'s choices
- Changing the line seed changes every word in that line but not other lines
- The global `globalSeed` is mixed in at line-build time: `globalSeed * 997 + lineIndex * 3571`

### Shadow Seed Isolation

Shadow values use a **separate dedicated RNG** per word so that changes to shadow settings don't affect the word's other random properties:

```js
const _sr = mkRng(lineSeed * 137 + i * 251 + 9999);
```

The constant `9999` offset ensures shadow seeds never collide with main word seeds.

---

## 3. Script Parsing

```js
function parseScript(raw) {
  return raw.split('\n')
    .map(l => l.trim())
    .filter(l => l)
    .map(l => {
      if (l.startsWith(':')) return { speaker: null, text: l.slice(1).trim() };
      const i = l.indexOf(':');
      if (i > 0) return { speaker: l.slice(0, i).trim(), text: l.slice(i+1).trim() };
      return { speaker: null, text: l };
    });
}
```

**Three input formats are accepted:**

| Input | Result |
|---|---|
| `:hello world` | `{ speaker: null, text: "hello world" }` |
| `Alice: hello world` | `{ speaker: "Alice", text: "hello world" }` |
| `hello world` | `{ speaker: null, text: "hello world" }` |

Each line becomes one animation segment — it enters, holds, then exits independently. Multi-line scripts play sequentially and loop.

---

## 4. Build Phase — Line Data Construction

`buildLineData(lineObj, lineSeed)` is the core pre-computation step. It runs **once** per line whenever the animation starts or settings change. It never runs during the draw loop.

### What gets computed per word:

| Property | How chosen | Frozen? |
|---|---|---|
| `font` | RNG → index into `ALL_FONTS[]` (16 fonts) | ✅ Yes |
| `color` | RNG → index into current `PALETTE` | ✅ Yes |
| `glowColor` | Separate RNG pick from palette | ✅ Yes |
| `anim` | RNG → index into enabled animations | ✅ Yes |
| `size` | RNG within `[szMin, szMax]` range | ✅ Yes |
| `rotation` | RNG → tilt in radians, ±tiltMax degrees | ✅ Yes |
| `fx` | Depends on `fxMix` mode (see below) | ✅ Yes |
| `_shadowOx` | Separate RNG, scaled by `S.shadowX` | ✅ Yes |
| `_shadowOy` | Separate RNG, scaled by `S.shadowY` | ✅ Yes |
| `_shadowCol` | Resolved from `S.shadowColor` mode | ✅ Yes |
| `particle` | RNG > 0.3 threshold | ✅ Yes |

### FX Mix Modes

```js
if (S.fxMix === 'random') fx = fxList[Math.floor(wr() * fxList.length)];
else if (S.fxMix === 'single') fx = fxList[0];
else fx = fxList[i % fxList.length]; // 'alt' — cycles through active FX
```

### Line-level decisions also made at build time:

- **Exit animation** — randomly selected from enabled exits
- **Background flash** — 40% chance of triggering a colour flash on line start

---

## 5. Layout Engine

`layoutWords(ld)` runs immediately after `buildLineData` and assigns each word its canvas `(x, y)` position.

### Algorithm:

```
1. Measure each word's pixel width using ctx.measureText()
2. Word-wrap: greedily pack words into rows, max row width = 88% of canvas width
3. Compute total block height = numRows × (maxFontSize × 1.32)
4. Position the block according to S.pos:
     top    → y starts at 10% of canvas height
     center → y starts at (canvasH - blockH) / 2
     bottom → y starts at 90% of canvas height minus block height
5. Within each row, centre horizontally (or left/right align per S.pos)
6. Each word gets: x = row start + accumulated widths + word half-width
                   y = row baseline
```

The word's `x` is the **centre point** of the word, because `ctx.textAlign = 'center'` is used universally. This ensures all clip rects, shadows, and transforms operate from the same origin.

---

## 6. Animation System

### Phases

Each line cycles through three phases:

```
IN phase  →  HOLD phase  →  OUT phase  →  next line
```

**IN phase:** Words animate in one by one, staggered by `S.wDelay` milliseconds. Each word has an independent timer. Progress `t` for each word goes from `0 → 1` over ~380ms.

**HOLD phase:** All words are rendered at `t = 1` (fully arrived). Lasts `S.holdDur` milliseconds (default 1800ms).

**OUT phase:** All words exit together using the line's `exitAnim`. Duration is `S.exitDur` milliseconds (default 500ms).

### Transform System

`getTransform(anim, t)` maps progress `t ∈ [0,1]` to a transform object:

```js
{ sx, sy, ox, oy, rot, skewX, alpha, clip }
```

These are applied in `drawWord` via canvas transforms:

```js
ctx.translate(w.x + tr.ox, w.y + tr.oy);  // position + offset
ctx.rotate(tr.rot);                          // spin animations
ctx.transform(1, 0, tr.skewX, 1, 0, 0);    // skew (flip_x)
ctx.scale(sx, sy);                           // slam, zoom, stretch
ctx.globalAlpha = alpha;                     // fade
```

### Easing Functions

```js
// Cubic ease-out: fast start, slows to rest
eOut(t) = 1 - (1 - t)³

// Bounce: overshoots, bounces back
eBounce(t) — 4-segment piecewise quadratic (standard bounce easing)
```

### All 17 Entry Animations

| Animation | Mechanism |
|---|---|
| `slam` | Scale from 4× → 1×, rapid alpha |
| `pop` | Scale to 1.35× overshoot, then settle |
| `typewriter` | Clip rect expanding left-to-right |
| `slide_up/down/left/right` | Offset translation + fade |
| `spin` | Full 360° rotation during entry |
| `flip_x` | Horizontal skew transform |
| `glitch` | Random jitter offset, flickers |
| `fade_in` | Alpha ease-out only |
| `zoom_blur` | Scale from 3.2× + alpha |
| `shake` | Sine-wave horizontal oscillation |
| `wave` | Sine-wave vertical oscillation |
| `stretch_h` | Wide-to-normal horizontal stretch |
| `drop_in` | Falls from above with bounce |
| `rise` | Rises from below with bounce |

### All 6 Exit Animations

| Animation | Mechanism |
|---|---|
| `fade_out` | Alpha → 0 |
| `slide_out_up/down` | Translate + fade |
| `zoom_out` | Scale to 3.5× + fade |
| `scatter` | Random x/y offset per word |
| `shatter` | Random rotation + downward fall |

---

## 7. FX Rendering Pipeline

`renderFx(fx, x, y, w, text, font, sz, color, glowColor, time, wordObj)` is the central dispatch function. It sets font/align/baseline then routes to one of six FX functions.

**Critical implementation detail:** `x` and `y` are always `0, 0` when called from `drawWord`, because the canvas has already been translated to the word's position via `ctx.translate(w.x, w.y)`. All FX coordinates are **relative to word origin**.

### The Six FX Functions

**`fxFlat`** — Single solid fill. Simplest possible: draw shadow, draw text.

**`fxRetroGrade`** — Two-tone effect mimicking colour grading:
1. Draw shadow
2. Draw full text in slightly darkened colour (base layer)
3. Save canvas state, clip to top 42% of glyph height, re-set font (because `ctx.restore()` wipes font), draw in lightened colour (highlight layer), restore

**`fxDuotone`** — Left/right colour split:
1. Draw shadow
2. Clip left half → fill with `color`
3. Clip right half → fill with `color2`
Both clips require re-setting font after `ctx.restore()`.

**`fxStamp`** — Letterpress effect: dark outline stroke drawn before fill, making fill colour appear embossed.

**`fxOutline`** — Hollow text: stroke only, no fill.

**`fxOffset`** — Risograph double-print: ghost layer drawn offset by `sz * 0.05` at 52% opacity, sharp layer drawn at full opacity on top.

### Font Restore Pattern

`fxRetroGrade` and `fxDuotone` use `ctx.save()/restore()` for clip regions. Since `restore()` resets **all** canvas state including font, the pattern is:

```js
const _f = ctx.font, _a = ctx.textAlign, _b = ctx.textBaseline;
ctx.save();
  ctx.clip();
  ctx.font = _f; ctx.textAlign = _a; ctx.textBaseline = _b; // re-apply
  ctx.fillText(...);
ctx.restore();
ctx.font = _f; ctx.textAlign = _a; ctx.textBaseline = _b; // re-apply again
```

---

## 8. Shadow System

### Design Goal: Zero Flicker

Early versions called the RNG during every draw frame to compute shadow offset. Since the RNG is stateful, it returned a different value each frame, causing the shadow to jump position at 60fps — visible flickering.

### Solution: Pre-Bake at Build Time

Shadow values are computed **once** in `buildLineData` using a dedicated isolated RNG and stored as frozen properties on each word object:

```js
const _sr = mkRng(lineSeed * 137 + i * 251 + 9999);

word._shadowOx  = S.shadowX * (S.shadowRand ? (_sr() * 0.6 + 0.7) : 1);
word._shadowOy  = S.shadowY * (S.shadowRand ? (_sr() * 0.6 + 0.7) : 1);
word._shadowCol = resolveShadowColor(color, _sr);
```

`drawSharpShadow` reads these constants — no computation, no RNG calls:

```js
const ox   = wordObj._shadowOx;
const oy   = wordObj._shadowOy;
const scol = wordObj._shadowCol;
```

When the user changes any shadow setting, `startAnim()` is called which re-runs `buildLineData`, re-baking fresh frozen values.

### Six Shadow Styles

| Style | Algorithm |
|---|---|
| `hard` / `diagonal` | Single `fillText` at `(x+ox, y+oy)` |
| `long` | `base×2` passes, each 85% opacity, stepping toward offset |
| `double` | Two passes: `ox×1.8` at full opacity, `ox×0.8` at 50% |
| `inset` | Light highlight at `(-1,-1)`, shadow at `(ox,oy)` |
| `stacked` | `base` passes stepping incrementally from `(0,0)` to `(ox,oy)` |

### Shadow Colour Modes

| Mode | Resolution |
|---|---|
| `dark` | Fixed `#1a1008` (near-black brown) |
| `match` | `darken(wordColor, 0.45)` |
| `warm` | Fixed `#6a3010` |
| `cool` | Fixed `#203860` |
| `random` | `shift(wordColor, randomDegrees)` — hue-rotated, baked once |

---

## 9. Background Engine (BG Studio)

The BG engine is a self-contained object (`BG`) that patches the global `drawBg()` function to composite a background image underneath every frame.

### Image Drawing Pipeline

```
1. Check BG.current !== 'none'
2. Look up pre-loaded Image object in BG._imgCache
3. Save canvas state
4. Set globalAlpha = BG.opacity, globalCompositeOperation = BG.blend
5. Draw image with fit mode:
     cover   → scale to fill, crop edges
     contain → scale to fit, letterbox
     stretch → fill exactly
     tile    → createPattern + fillRect
6. Restore canvas state
7. Apply overlay effect on top
```

### Eight Overlay Effects

| Overlay | Implementation |
|---|---|
| `dark` | Black fill at `opacity × 0.8` |
| `warm` | Red-orange fill with `overlay` composite at `opacity × 0.5` |
| `cool` | Blue fill with `overlay` composite at `opacity × 0.5` |
| `vignette` | Radial gradient: transparent centre → dark edges |
| `grain` | Random 1.5×1.5px rectangles at random opacity (6% pixel density) |
| `duotone` | Linear gradient of two palette colours with `multiply` composite |
| `scanlines` | Horizontal 1px lines every 3px at 35% opacity |

### Sync Mode

When `BG.syncOn = true`, a `setInterval` running every 200ms watches the active `.lq-dot` element. When the active dot index changes (new line started), `BG.onLineChange(idx)` is called which cycles `BG._imgOrder[idx % images.length]` to select the next image automatically.

### Custom Image Upload

User-uploaded images are:
1. Read via `FileReader.readAsDataURL()`
2. Stored in `BG._imgCache` with a timestamp key
3. Appended to `BG._imgOrder` for sync cycling
4. A thumbnail DOM element is created and injected into the grid

---

## 10. Main Animation Loop

```js
function frame(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBg();          // background (solid / image)
  drawFlash();       // colour flash overlay (fades out)
  updateParticles(); // physics step: move, apply gravity, age
  drawParticles();   // render living particles

  // Current line state machine
  if (phase === 'in') {
    // Stagger words: each word starts when elapsed >= wordIndex × wDelay
    // Word is 'done' when drawWord returns true (t >= 1)
    // Phase transitions to 'hold' when all words are done + 440ms buffer
  }
  else if (phase === 'hold') {
    // All words drawn at t=9999 (clamps to 1 in drawWord)
    // Transitions to 'out' after holdDur ms
  }
  else if (phase === 'out') {
    // drawExit applies exit transform at t = elapsed/exitDur
    // Transitions to next line when elapsed >= exitDur
  }

  raf = requestAnimationFrame(frame);
}
```

### Particle System

Particles are spawned when a word first enters (at `t ≈ 0.06–0.18`). Each particle has:
- Position `(x, y)` — starts at word position
- Velocity `(vx, vy)` — random direction, `vy` biased upward
- `life` counter from 1 → 0 (controls alpha)
- `decay` rate (random variation in lifetime)
- `shape`: circle, star, diamond, or spark

Each frame: `vy += 0.11` (gravity), position updated, `life -= decay`. Particles with `life <= 0` are removed via `.filter()`.

---

## 11. Export Pipeline

All three export modes share a **single render engine** (`renderAllFrames`) to avoid code duplication.

### Shared Render Engine

```js
async function renderAllFrames(onFrame, onDone) {
  // 1. Parse script → line data array
  // 2. Create offscreen canvas (same size as preview canvas)
  // 3. Swap global canvas/ctx to offscreen (so all draw functions redirect)
  // 4. Render every frame:
  //    - For each line: IN frames → HOLD frames → EXIT frames
  //    - Call onFrame(offCanvas, pct, frameN) after each frame
  //    - await setTimeout(frameDurMs) to pace rendering and keep UI alive
  // 5. Restore real canvas/ctx
  // 6. Call onDone(totalFrames)
}
```

The `await new Promise(r => setTimeout(r, frameDurMs))` is essential — it yields back to the browser event loop each frame, preventing UI freeze and allowing the progress bar to update.

---

### MP4 Export

```
captureStream(FPS) → MediaRecorder → Blob chunks → .webm / .mp4 download
```

1. Create offscreen canvas → attach `captureStream(FPS)` → get `MediaStream`
2. Create `MediaRecorder` with best available codec (VP9 > VP8 > WebM > MP4)
3. Start recorder with `timeslice = 100ms` (chunks collected every 100ms)
4. Run shared render engine — each frame is drawn to the offscreen canvas, which the stream captures automatically
5. Stop recorder → collect all `Blob` chunks → assemble final `Blob`
6. `URL.createObjectURL(blob)` → `<a download>` click → revoke URL

**Codec priority:** `video/webm;codecs=vp9` → `video/webm;codecs=vp8` → `video/webm` → `video/mp4`

**Bitrate:** 8 Mbps for high-quality output.

---

### GIF Export

GIF encoding is entirely custom — no library. Pure JavaScript implementation of the GIF89a specification.

#### Stage 1 — Frame Collection

- Renders at `min(fps, 15)` to cap GIF file size (higher fps makes huge files)
- Every Nth frame is kept (`skipEvery = round(fps / gifFps)`)
- Each frame is down-sampled to max 480px wide for file size control
- Pixel data captured via `ctx.getImageData()`

#### Stage 2 — Colour Quantisation

```js
function quantize(pixels) {
  // Build histogram: 6-bit RGB buckets (64×64×64 = 262,144 buckets)
  // Sort by frequency, take top 256 colours as palette
  // For each pixel, find nearest palette colour (exhaustive search, O(n × 256))
  // Return: { palette: Uint8Array(768), indexed: Uint8Array(w×h) }
}
```

GIF supports maximum 256 colours. The quantiser groups pixels by their 6-bit RGB values (top 6 bits of each channel), sorts by frequency, and picks the 256 most common colour buckets as the palette. Each pixel is then mapped to its nearest palette entry.

#### Stage 3 — LZW Compression

```js
function lzwEncode(pixels, minCodeSize) {
  // Standard LZW dictionary compression:
  // - Starts with dictionary of size 2^minCodeSize + 2 (clear/EOI codes)
  // - Grows dictionary as new sequences are encountered
  // - When dictionary hits 4096 entries, resets with a Clear Code
  // - Code size grows from minCodeSize+1 up to 12 bits as dictionary grows
  // - Output: variable-width bit stream packed into bytes
}
```

#### Stage 4 — GIF89a Binary Assembly

```
GIF89a header (6 bytes)
Logical Screen Descriptor (7 bytes) — width, height, global colour table flag
Global Colour Table (768 bytes) — 256 RGB triplets
Netscape Application Extension — enables infinite looping
For each frame:
  Graphic Control Extension (8 bytes) — frame delay in centiseconds
  Image Descriptor (10 bytes) — frame position and size
  Minimum LZW code size (1 byte)
  Sub-blocks of LZW data (max 255 bytes each, prefixed by length byte)
  Block terminator (0x00)
GIF trailer (0x3B)
```

The delay per frame is `ceil(100 / gifFps)` centiseconds (GIF time unit).

---

### PNG Frames Export

```
Render all frames → canvas.toDataURL('image/png') per frame
→ Load JSZip dynamically from CDN
→ Pack all PNGs into ZIP folder
→ Download as typoreel_frames.zip
```

Each frame is stored as `frame_00001.png`, `frame_00002.png` etc. (zero-padded 5 digits). JSZip is only loaded if not already present (`if (!window.JSZip)`).

---

## 12. Randomise Effects System

The **RANDOMISE EFFECTS** button triggers a full randomisation of all visual parameters simultaneously, then calls `startAnim()` to rebuild everything from scratch.

**Parameters randomised:**

| Parameter | Range / Method |
|---|---|
| `globalSeed` | `Math.random() * 999999` |
| `S.pal` | Random key from `PALETTES` object |
| `S.activeFx` | 1–3 randomly chosen from all 6 FX types |
| `S.fxMix` | Random from `['random', 'single', 'alt']` |
| `S.fontLock` | 35% chance of locking a specific font, 65% stays random |
| `S.szMin` | 18–58px |
| `S.szMax` | `szMin + 20–70px` |
| `S.tiltMax` | 0–18 degrees |
| `S.shadowStyle` | Random from 6 styles |
| `S.shadowInt` | Random from 5 intensity levels |
| `S.shadowColor` | Random from 5 colour modes |
| `S.shadowX/Y` | 1–13px each |
| `S.shadowRand` | 60% chance of per-word randomisation |
| `S.wDelay` | 100–600ms (steps of 100) |
| `S.holdDur` | 800–2000ms (steps of 200) |

After randomising, all UI controls (sliders, active buttons, chip selections) are synced to reflect the new values so the interface stays consistent with the actual state.

---

## 13. State Object (S)

All user-adjustable parameters live in a single flat object:

```js
const S = {
  seed: 0,                          // not directly used; globalSeed used instead
  pal: 'retro_warm',                // active palette key
  fontLock: 'random',               // 'random' or a specific font string
  glowInt: 'off',                   // glow intensity (off/low/med/high/ultra)
  strokeMode: 'none',               // text stroke: none / thin / thick / color
  pos: 'center',                    // layout position: center/top/bot/left/right
  bgMode: 'transparent',            // canvas bg: transparent / hex colour / grad1 / grad2
  szMin: 42,                        // minimum font size (px)
  szMax: 74,                        // maximum font size (px)
  tiltMax: 6,                       // max word tilt (degrees)
  enabledAnims: new Set(ANIM_ALL),  // which entry animations are active
  enabledExits:  new Set(EXIT_ALL), // which exit animations are active
  wDelay: 300,                      // word stagger delay (ms)
  holdDur: 1800,                    // hold phase duration (ms)
  exitDur: 500,                     // exit phase duration (ms)
  fps: 24,                          // frame rate
  activeFx: new Set(['retro_grade']),// active FX effects
  fxMix: 'random',                  // how FX are assigned: random/single/alt
  perLetter: false,                 // per-letter animation mode
  letterStagger: 55,                // letter stagger delay (ms)
  partCount: 14,                    // particles per word entry
  shakeX: 0, shakeY: 0,            // global shake offset (applied then reset)
  shadowStyle: 'hard',              // shadow style key
  shadowInt: 'med',                 // shadow intensity key
  shadowColor: 'dark',              // shadow colour mode
  shadowX: 4, shadowY: 4,          // shadow base offset (px)
  shadowRand: true,                 // per-word random shadow offset variation
  shadowColRand: false,             // per-word random shadow colour
};
```

---

## 14. Data Flow Diagram

```
User types script
       │
       ▼
  parseScript()
  ─────────────────────────────────────────────────
  Input:  raw text string
  Output: LineObj[] = [{ speaker, text }, ...]
       │
       ▼
  buildLineData(lineObj, lineSeed)    ← runs for every line
  ─────────────────────────────────────────────────
  Input:  LineObj, deterministic seed
  Output: LineData = {
    words: WordObj[],    ← all properties frozen here
    exitAnim,
    bgFlash
  }
       │
       ▼
  layoutWords(lineData)
  ─────────────────────────────────────────────────
  Input:  LineData (words have size/font but no position)
  Output: LineData (words now have x, y, measuredW)
       │
       ▼
  ┌────────────────────────────────────────────────┐
  │           requestAnimationFrame loop            │
  │                                                 │
  │  clearRect → drawBg → drawFlash                 │
  │  updateParticles → drawParticles                │
  │                                                 │
  │  phase = 'in':                                  │
  │    for each word:                               │
  │      t = elapsed / 380ms                        │
  │      tr = getTransform(word.anim, t)            │
  │      ctx.save()                                 │
  │        apply: translate, rotate, skew, scale    │
  │        renderFx(fx, 0, 0, ...)                  │
  │          → drawSharpShadow (reads frozen values)│
  │          → fxFlat / fxRetroGrade / etc.         │
  │      ctx.restore()                              │
  │                                                 │
  │  phase = 'hold':                                │
  │    all words at t=1, static draw each frame     │
  │                                                 │
  │  phase = 'out':                                 │
  │    drawExit(lineData, t)                        │
  │    → per-exit-anim transform + fade             │
  └────────────────────────────────────────────────┘
       │
       ▼
  Export (on demand)
  ─────────────────────────────────────────────────
  renderAllFrames()  ← shared engine
    - Offscreen canvas (same size as preview)
    - Swap global canvas/ctx to offscreen
    - Reproduce all phases frame-by-frame
    - Yield to event loop each frame (await setTimeout)
    - Restore real canvas/ctx when done
       │
       ├──→ MP4:    captureStream → MediaRecorder → Blob → download
       ├──→ GIF:    collect frames → quantize → LZW → GIF89a → download
       └──→ Frames: collect PNGs → JSZip → .zip → download
```

---

## Technical Notes

**Why `requestAnimationFrame` and not `setInterval`?**
rAF is browser-managed and syncs to the display refresh rate. It also pauses when the tab is hidden, saving CPU.

**Why swap the global `canvas` and `ctx` during export?**
Every draw function (`drawBg`, `drawWord`, `renderFx`, etc.) references the global `canvas` and `ctx` variables directly. Swapping them to point at the offscreen canvas means zero changes to the rendering code — all existing functions work on the export canvas transparently.

**Why does GIF export cap at 15fps?**
GIF delay units are centiseconds (1/100 of a second). The minimum delay per frame is 1 centisecond = 10ms = 100fps. In practice most browsers enforce a minimum of ~2 centiseconds (50fps). More importantly, GIF files grow linearly with frame count — a 5-second 24fps GIF at 360×640 would be ~50–80MB. 15fps keeps exports under 10–15MB.

**Why does the LZW encoder reset at 4096 entries?**
The GIF spec limits LZW codes to 12 bits (4096 values). When the dictionary fills, a Clear Code is emitted and the dictionary resets. This is standard GIF LZW behaviour.

**Why `shadowBlur = 0` everywhere?**
Canvas `shadowBlur` is GPU-expensive and causes visual blur on text. TypoReel achieves all shadow effects by drawing a second copy of the text at an offset — this is sharp, fast, and retro-authentic.
