TypoReel 
========

Overview
--------
TypoReel v4 is a powerful, browser‑based typography video generator that creates dynamic MP4 animations from text scripts with professional‑grade visual effects, background handling, and real‑time preview capabilities.

Background Images & Base64 Implementation
-----------------------------------------
All background images in TypoReel v4 are embedded directly within the HTML using Base64 encoding. This approach offers several advantages:

- What is Base64 encoding?
  Base64 is a method of encoding binary data (like images) into ASCII text strings. Instead of linking to external image files that could break or require separate hosting, all background images are stored as embedded Base64 strings right inside the code.

- Background images included:
  1. Alps – mountain landscape with alpine scenery
  2. Pixel Mountain – pixel art style mountain landscape
  3. Forest – dense woodland scene
  4. Valley – serene valley landscape
  5. Sunset – warm sunset horizon

- Why Base64 for backgrounds?
  • Portability: a single HTML file contains everything – no external dependencies.
  • Offline capability: works completely offline without internet connections.
  • Reliability: images never break due to broken links or removed assets.
  • Performance: images load instantly without network requests.
  • Customization: users can add their own images via the “Add Image” button.

- How Base64 images are structured:
  Each image is embedded as a Data URL:
  <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...">
  The string after “base64,” contains the complete image data encoded in Base64 format.

- Adding custom backgrounds:
  Users can add their own images using the “ADD” button in the BG Studio panel. The application supports JPG, PNG, and other common image formats; custom images override the Base64 presets.

Key Features
------------

Script Management
- Multi‑line script input with `:line` formatting
- Real‑time line count, word count, and duration statistics
- Randomise effects button for quick experimentation

Visual Effects (FX)
- 6 render styles: Color Grade, Flat Fill, Duotone, Stamp, Outline, Offset Print
- FX mix modes: Random, Single, or Rotate per word
- Per‑letter mode: split text into individual letters with staggered animations
- Color intensity: Flat, Soft, Medium, Rich, Deep
- Extra effects: sparkle particles, background flash, screen shake, idle breathe animation

Typography & Style
- 10+ premium fonts: Cinzel, Bebas Neue, Cormorant Garamond, Montserrat, Orbitron, Playfair Display, Oswald, Russo One, Bangers, and more
- Color palettes: 6 curated palettes (Retro Warm, Terracotta, Dusty Rose, Sage Green, Faded Blue, Warm Mono)
- Text positioning: 9‑position grid (center, corners, edges)
- Adjustable font sizes: min/max range from 18px to 130px
- Text tilt: up to 40 degrees rotation
- Stroke options: None, Thin, Thick, Color

Shadow Effects
- 6 shadow styles: Hard Drop, Diagonal, Long Shadow, Double, Inset, Stacked
- Intensity control: None, Light, Medium, Heavy, Ultra
- Shadow color options: Dark, Match, Warm, Cool, Random
- Offset controls: X/Y offset from 0–20px
- Randomisation: per‑word shadow randomisation

Animation System
- Entry animations: 16+ animations including SLAM, POP, TYPEWRITER, slide effects, spin, flip, glitch, zoom blur, shake, wave, stretch, drop in, rise
- Exit animations: Fade out, slide out, zoom out, scatter, shatter
- Timing controls: word delay, hold duration, exit speed
- Word effects: random sizing and tilt per word

BG Studio (Background System)
- 5 Base64‑encoded backgrounds: Alps, Pixel Mountain, Forest, Valley, Sunset
- Blend modes: Normal, Multiply, Screen, Overlay, Soft Light, Color Dodge, Color Burn, Difference
- Background controls: opacity (5‑100%), scale (50‑200%), fit modes (Cover, Contain, Stretch, Tile)
- Color overlays: None, Dark, Warm, Cool, Vignette, Grain, Duotone, Scanlines
- Intensity control: 0‑100% overlay intensity
- Per‑line sync: automatic background cycling per script line
- Randomisation: one‑click random background or full random configuration
- Custom image upload: add your own images via file input

Export Features
- MP4 generation: export animations as MP4 videos
- Frame rate control: adjustable from 12 to 60 FPS
- Transparent background option: export with alpha channel support
- Live preview: real‑time canvas rendering with all effects

Quick Start
-----------
1. Enter script: write your text lines in the script area using `:line` format
   :ajj kese hai app
   :mei bahut badhiya
   :kya scene hai yaar
   :sab sahi chal raha

2. Select mood: choose from Luxury, Hype, Cinematic, Neon Dream, Lo‑Fi, or Chaos presets

3. Customise effects: adjust FX, styles, shadows, and animations

4. Set background: choose from Base64 images or upload custom images

5. Generate: click “GENERATE” to preview animation

6. Export: download as MP4 file

Mood Presets
------------
- Luxury   → elegant, premium look with refined styling
- Hype     → energetic, bold, attention‑grabbing
- Cinematic → dramatic, film‑grade aesthetics
- Neon Dream → vibrant, futuristic neon style
- Lo‑Fi     → relaxed, subtle, atmospheric
- Chaos     → dynamic, unpredictable, high‑energy

Canvas Formats
--------------
- 9:16 – standard Instagram Reels / TikTok format (360×640)
- 1:1  – square format for Instagram posts (360×360)
- 16:9 – YouTube / standard widescreen (640×360)

Technical Details
-----------------
- Technology: HTML5, CSS3, JavaScript, Canvas API
- Video encoding: MP4 with customizable frame rates (12‑60 FPS)
- Animation: keyframe‑based per‑character / per‑word animations
- Image storage: Base64‑encoded presets + custom image upload
- Real‑time stats: automatic calculation of lines, words, duration, and frames
- Export options: transparent background support for overlay videos

Use Cases
---------
- Social media content creation (Reels, TikTok, Shorts)
- Lyric videos and music visualizations
- Kinetic typography projects
- Advertising and promotional content
- Title sequences and motion graphics
- Text‑based storytelling

Tips
----
- Use “Randomise Effects” for unexpected creative combinations
- Enable “Per‑Letter Mode” for granular text animation
- Try different blend modes with backgrounds for unique visual styles
- “SYNC” mode automatically cycles backgrounds per script line
- Lower opacity for subtle background effects
- Experiment with entry/exit animations for dynamic text flow
- Use “Transparent BG” for overlaying on other video content

Notes
-----
- All background images are embedded as Base64 strings for portability
- Custom images can be added via the BG Studio interface
- Real‑time preview updates as you adjust settings
- MP4 export uses the selected frame rate and dimensions
- The application runs entirely in the browser – no server required

---
TypoReel v4 – Premium combines professional motion graphics capabilities with an intuitive interface, making high‑quality typography videos accessible to creators of all skill levels.
