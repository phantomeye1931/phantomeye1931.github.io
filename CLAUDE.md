# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Armand de Vries' personal site/blog (Astro, static output, deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `master`). This checkout, `PortfolioRefresh`, is a working copy split off from the original `~/IdeaProjects/Portfolio` repo specifically to build a CMYK-halftone redesign of the homepage without touching the live site. `origin` still points at the real repo (`phantomeye1931/Portfolio-Website`) — nothing here has been pushed.

## Commands

```sh
npm install       # deps (node_modules is gitignored, not currently installed on a fresh clone)
npm run dev        # astro dev, default port 4321 (auto-bumps if taken)
npm run build      # astro build -> dist/
npm run preview    # serve the dist/ build locally
npm run astro ...  # astro CLI passthrough (e.g. `npm run astro check`)
```

There is no lint or test setup (no test runner, no eslint config) — don't invent one unasked.

### Rebuilding the WASM ASCII generator

The animated ASCII background (`Background.astro`, used on blog posts and everywhere except the homepage hero) is powered by a Rust crate at `rust/` (`ascii-bg`, `wasm-bindgen`-based), compiled to `src/wasm/` — **that output directory is committed** and imported directly (`import init, {get_ascii_grid} from "../wasm"`). There is no local build script; only edit `rust/src/lib.rs` if asked, then rebuild with the exact command CI uses:

```sh
wasm-pack build rust --target web --out-dir ../src/wasm
```

(`rust/target/` is a local build cache, not committed.)

## Architecture

**Layout/page pattern**: every route wraps content in `src/layouts/Page.astro`, which takes an `opts` prop controlling what chrome renders:

```ts
opts: {
  background: boolean,                          // render a background component at all
  backgroundVariant?: 'ascii' | 'halftone',      // which one (default 'ascii')
  bgWearOff?: boolean,                           // ascii-only: fade toward the right edge
  buttons: boolean,                              // render HeaderButtons nav
  blogButtons?: boolean,                         // swaps nav to blog-post variant ([BACK TO TOP] etc.)
  sticky?: boolean,                               // background: fixed+full-page (blog posts) vs absolute+first-viewport-only (homepage hero)
}
```

`index.astro` is the only page using `backgroundVariant: 'halftone'`; everything else (blog posts via `BlogPost.astro`, `cv.astro`, etc.) either uses the ascii variant or no background. **Keep it that way unless explicitly asked to extend the halftone treatment elsewhere** — the redesign brief was homepage-only, and the coffee/typewriter/paper aesthetic (see `public/svg/coffee-stain`, `public/tape`) is still the intended look for blog/CV pages.

**Two background components, same shape**: `Background.astro` (ascii, wasm-driven, animated every 125ms) and `HalftoneBackground.astro` (CMYK halftone, canvas-driven) both follow the same contract — a `.bg-grid` wrapper measured via `getBoundingClientRect()`, a `sticky` prop toggling fixed-fullpage vs absolute-first-viewport CSS, and a resize listener that remeasures and redraws. If you add a third variant, follow this shape so `Page.astro`'s conditional stays a simple switch.

**`HalftoneBackground.astro` internals** (the CMYK hero art): a `CONFIG` object up top holds every tunable (dot spacing/radius, warp/grain/tone noise, right-edge fade zone that keeps the art clear of the hero text, drift speed/amount, resolution caps). Four ink "channels" (cyan/magenta/yellow/key), each with 1–3 soft metaball "blobs" that drift independently via two summed sine terms per axis — the dot *lattice* (grid positions, per-channel rotation angle, warp) is built once and cached; only the blob field sampled at those fixed points is re-evaluated per frame, which is what keeps a full animated redraw affordable. **Theme-awareness is load-bearing, not decorative**: it reads `document.documentElement.getAttribute('color-scheme')` every frame and switches `globalCompositeOperation` between `multiply` (light paper — ink darkens the page) and `screen` (dark paper — inks glow, and the near-black key plate becomes a no-op under screen blending, so it silently drops out exactly as real black ink would against dark stock). A `MutationObserver` on that attribute re-resolves the CSS-custom-property ink colors and repaints immediately when the `[sync]` header button flips the theme, rather than waiting for the next animation tick.

**Theming**: `[color-scheme='dark']` attribute on `<html>`, set by `src/components/util/ThemeManager.astro` (inline script, exposes `window.cycleColorScheme()`/`window.getColorScheme()`, persisted to `localStorage`, defaults to `prefers-color-scheme`). All theme-dependent color values are CSS custom properties in `src/styles/global.css` under `:root` / `[color-scheme='dark']` (`--col-background`, `--col-text`, `--col-element`, etc.) — the three `--col-cmyk-*` ink vars added for the halftone work are theme-*invariant* (same hex in both modes; the visual light/dark adaptation happens via canvas blend-mode, not by swapping the ink hex values).

**Fonts**: self-hosted via `@font-face` in `global.css` — Trypewriter (`.font-trypewriter`, ascii bg), Doto (`.font-dotmatrix`, nav buttons + the halftone hero's colophon label), "Type right!" (`.font-stamp`), Caveat, Roboto Slab. **Playfair Display and JetBrains Mono are referenced in component styles (`HeroSection.astro`, `BusinessCard.astro`) but never actually loaded anywhere** (no `@font-face`, no Google Fonts link) — this is a pre-existing gap, not something introduced by the halftone work; they're silently falling back to whatever's next in the stack (or a system-installed copy). Worth fixing if asked, but don't assume it's broken-by-recent-change.

**jQuery**: loaded globally in `BaseHead.astro` via a plain `<script src="https://code.jquery.com/...">` tag (not npm) and used for a handful of small interactions — the hero's staggered per-character reveal animation (`HeroSection.astro`, random 50–200ms delay per char, so don't assume the hero is "broken" if a screenshot catches it mid-reveal), the nav's scroll/dark-mode-toggle handlers (`HeaderButtons.astro`), the GitHub contribution calendar (`GitSection.astro`). Everything else is plain TS.

**Known pre-existing quirk**: `HeroSection.astro`'s `.name` style block has a `//font-size: clamp(...)` line using `//` instead of `/* */` — invalid CSS, and esbuild's minifier flags it during `astro build`, but it's a single dropped declaration, not a broken stylesheet (verified: the sibling `font-size: 19cqw` rule on `.char` spans still applies correctly). Harmless; not something to "fix" as a side effect of unrelated changes.

**Content**: blog posts are an Astro content collection (`src/content.config.ts`, glob-loaded MDX from `src/content/blog/`, schema requires `title`/`description`/`pubDate`, optional `updatedDate`/`heroImage`).
