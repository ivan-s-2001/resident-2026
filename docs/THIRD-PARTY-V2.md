# Resident 2026 / Fieldbook v2 — third-party sources

## SheetBound (MIT)
https://github.com/chr-z/sheetbound

The original `css/style.css` is vendored unchanged in `cloudflare/v2-sheetbound-css.js`, then overridden by our Resident-specific theme. Its general styles for buttons, chips, fields, and print-friendly pages are reused. The original copyright and MIT license follow:

```text
MIT License

Copyright (c) 2026 chr-z

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

## Lucide (ISC)
https://github.com/lucide-icons/lucide
Interface line icons are selected/adapted from the Lucide icon set. See https://github.com/lucide-icons/lucide/blob/main/LICENSE


## Game-icons.net — selected item silhouettes (CC BY 3.0)

Source: https://game-icons.net/ and https://github.com/game-icons/icons. Authors: **Delapouite** (first-aid-kit, flashlight) and **Lorc** (biohazard, bullets, gas-mask, bowie-knife, crossed-pistols). License: https://creativecommons.org/licenses/by/3.0/ .

The seven named SVG shapes were taken from the official game-icons/icons repository, stripped of their black 512 × 512 backgrounds, embedded as inline SVG paths in `cloudflare/v2-kit.js` and tinted with `currentColor`. They are used solely as recognizable item-category illustrations; system controls continue to use Lucide line icons. This attribution applies to the modified item shapes as well as the originals.

## Architectural references, not copied
- OpenPentacle (GPL-3.0): content-pack-driven character data and modular interface architecture. No GPL source copied. https://github.com/arrowedisgaming/OpenPentacle
- RPGFieldbook (MIT): fast fieldbook UX and character counters. https://github.com/wardmanm/RPGFieldbook
- Delta Green Dossiers: field-agent framing only; no code, assets, or copyrighted game text copied. https://github.com/brian-caylor/delta-green-dossiers

The game rules are exclusively from Александр Каленов's «Резидент 2026» materials, not the projects above.
Digital dice, combat automation, maps, and unrelated VTT features are intentionally excluded.
No unverified Resident Evil art or logos have been copied.
