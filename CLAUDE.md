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

The animated ASCII background (`Background.astro` — not currently used by any core page; `index.astro` and `BlogPost.astro` both use the halftone variant, `cv.astro` has no background at all — but still wired up in `Page.astro` and worth keeping working) is powered by a Rust crate at `rust/` (`ascii-bg`, `wasm-bindgen`-based), compiled to `src/wasm/` — **that output directory is committed** and imported directly (`import init, {get_ascii_grid} from "../wasm"`). There is no local build script; only edit `rust/src/lib.rs` if asked, then rebuild with the exact command CI uses:

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
  bgWearOff?: boolean,                           // ascii-only: fade toward the right edge (currently unused — no page opts in)
  bgFill?: boolean,                              // halftone-only: skip the right-edge fade, cover the full width edge-to-edge
  bgFlip?: boolean,                              // halftone-only: mirror the canvas horizontally (transform: scaleX(-1)) — for right-aligned instead of left
  buttons: boolean,                              // render HeaderButtons nav
  blogButtons?: boolean,                         // swaps nav to blog-post variant ([BACK TO TOP] etc.)
  sticky?: boolean,                               // background: fixed+full-page (blog posts) vs absolute+first-viewport-only (homepage hero)
}
```

The redesign brief started homepage-only, was briefly extended to a full site-wide palette/font/background sweep including blog posts, then **blog posts were explicitly rolled back** to their original coffee-stain/tape/perforated-paper look and independent `blog.css` palette (Doto, the brown "notebook" colors, the `gray` paperclip fill — all restored) — the one piece of that sweep kept on blog posts is the **halftone background** (`BlogPost.astro` passes `backgroundVariant: 'halftone', bgFill: true`), because blog posts don't have hero-style right-aligned text to keep the art clear of. `index.astro` uses `backgroundVariant: 'halftone'` with `bgFill` left at its default `false` (the hero still needs the right-edge fade to keep the name legible). `cv.astro` **also** now uses `backgroundVariant: 'halftone'`, but with `bgFlip: true` instead of `bgFill` — the resume card (`.resume-layout`) got a `max-width: 1400px` with no auto-centering, so on wide viewports it sits left and exposes bare page background on the right; `bgFlip` mirrors the canvas (`transform: scaleX(-1)`, see the `flip` prop below) so the hero's default "concentrated + fading" look shows up on that right-hand side instead of the left. The animated canvas is explicitly hidden under `@media print` (both in `HalftoneBackground.astro` generally, and via the existing print block's `.resume-layout { max-width: none; filter: none; }`) since `cv.astro` is also a literal printable document (`window.print()`) — the canvas has no business trying to print, on-screen decoration only. Don't reintroduce blog.css palette/font unification unless asked again — it was tried and explicitly reverted.

**Two background components, same shape**: `Background.astro` (ascii, wasm-driven, animated every 125ms) and `HalftoneBackground.astro` (CMYK halftone, canvas-driven) both follow the same contract — a `.bg-grid` wrapper measured via `getBoundingClientRect()`, a `sticky` prop toggling fixed-fullpage vs absolute-first-viewport CSS, and a resize listener that remeasures and redraws. If you add a third variant, follow this shape so `Page.astro`'s conditional stays a simple switch.

**`HalftoneBackground.astro` internals** (the CMYK hero art): a `CONFIG` object up top holds every tunable (dot spacing/radius, warp/grain/tone noise, right-edge fade zone that keeps the art clear of the hero text, drift speed/amount, resolution caps). The `fill` prop (read client-side off a `fill="true"/"false"` DOM attribute into a `FILL` const) short-circuits the right-edge fade to `1` (no fade) when true — mirrors `Background.astro`'s `wearOff`/`gradient_enabled` param (see `rust/src/lib.rs`: multiplies density by `(1 - c/x)` when enabled), just inverted in spirit (ascii's flag *adds* a fade, halftone's *removes* one, because halftone fades by default and ascii doesn't). **The fade factor is not the only place the hero's "left-side-only" assumption is baked in — there were two more, both required for `fill` to actually work**: (1) `buildGrids()`'s dot-lattice generation loop only swept `rx` up to `W * 0.9` (plus rotation slack) as an optimization, since nothing past 80% width would've survived the fade anyway — `FILL` widens that sweep to the full `W` (`rxLimit`). (2) Even with lattice points and zero fade everywhere, every blob's authored `cx` sits in `[0.04, 0.49]` — the metaball *centers themselves* are all clustered in the left half, again because they were placed assuming anything further right was going to get faded out regardless. `X_SPREAD` (in `currentCenters()`) stretches blob centers by ~1.9x horizontally when `FILL` is set, so the ink actually reaches the right edge instead of the lattice being correct but empty of anything to draw. All three (fade, lattice sweep, blob spread) have to move together — if you touch one without the others, you'll get a fill that's *technically* not fading but still visually empty past some point, which is exactly the bug that shipped first. If you add another halftone tunable that assumes hero-only right-side clearing, check all three places. Four ink "channels" (cyan/magenta/yellow/key), each with 1–3 soft metaball "blobs" that drift independently via two summed sine terms per axis — the dot *lattice* (grid positions, per-channel rotation angle, warp) is built once and cached; only the blob field sampled at those fixed points is re-evaluated per frame, which is what keeps a full animated redraw affordable. **Theme-awareness is load-bearing, not decorative**: it reads `document.documentElement.getAttribute('color-scheme')` every frame and switches `globalCompositeOperation` between `multiply` (light paper — ink darkens the page) and `screen` (dark paper — inks glow, and the near-black key plate becomes a no-op under screen blending, so it silently drops out exactly as real black ink would against dark stock). A `MutationObserver` on that attribute re-resolves the CSS-custom-property ink colors and repaints immediately when the `[sync]` header button flips the theme, rather than waiting for the next animation tick.

**Theming**: `[color-scheme='dark']` attribute on `<html>`, set by `src/components/util/ThemeManager.astro` (inline script, exposes `window.cycleColorScheme()`/`window.getColorScheme()`, persisted to `localStorage`, defaults to `prefers-color-scheme`). All theme-dependent color values are CSS custom properties in `src/styles/global.css` under `:root` / `[color-scheme='dark']` (`--col-background`, `--col-text`, `--col-element`, etc.) — the three `--col-cmyk-*` ink vars added for the halftone work are theme-*invariant* (same hex in both modes; the visual light/dark adaptation happens via canvas blend-mode, not by swapping the ink hex values). **The palette was deliberately recalibrated away from brown**: paper (`--col-background`) and ink (`--col-text`) stay warm (that's the CMYK-proof material, not a complaint target), but the mid-tone tokens (`--col-background-2`, `--col-text-2`, `--col-text-3`) were flattened toward neutral gray, and `--col-element` (the site's one general-purpose accent — icons, borders, ascii-art color) was changed from a brown "wood" tone to a process-ink cyan (`#0d7fa3` light / `#4fc3e8` dark) so accents read as "printing ink," not "coffee shop." If asked to push further in this direction, that's the token to lean on, not `--col-cmyk-*` directly (those three are reserved for the halftone canvas + the misregistration effect below, not general UI color).

**Chromatic aberration on headers**: `--text-shadow-cmyk` (defined once in `global.css`, next to the `--col-cmyk-*` vars) is a fixed-pixel-offset three-color text-shadow (cyan/magenta/yellow, each `color-mix`'d toward transparent) simulating print misregistration — deliberately *not* scaled by font size, since a real press's misalignment is a constant physical offset regardless of type size. Applied via `text-shadow: var(--text-shadow-cmyk);` on: the hero name (`HeroSection.astro`), the generic `:global(.section .title)` rule in `index.astro` (which, being global, also reaches `WeblogSection`'s per-post titles and `ContactSection`'s heading — no per-component edit needed there), `ModalCard`'s card-title `<strong>`, `BusinessCard`'s `._name`, and `cv.astro`'s `h1`. **Explicitly excluded: blog post headings** (`.heading .title` and markdown `h1`–`h5` in `blog.css`) — this was tried and then explicitly reverted; those stay plain ink-colored, no shadow, matching the rest of the blog-post revert. Don't reapply it there without being asked again.

**Fonts**: self-hosted via `@font-face` in `global.css` — Trypewriter (`.font-trypewriter`, ascii bg), Doto (`.font-dotmatrix`, nav buttons + the halftone hero's colophon label — **and, after the blog revert, blog posts' back-link/date/code-line-number text again too**), "Type right!" (`.font-stamp`, blog post titles), Caveat (blog image alt-text marginalia), Roboto Slab (site-wide body font). Two families were self-hosted for the CMYK refresh and are used for display/label text *outside* blog posts (hero name + role list, homepage section titles, weblog entry titles, nav buttons, `ModalCard`/business-card labels, CV name): Fraunces (`.font-fraunces`; normal + italic variable, weights 300–900) and Space Mono (`.font-mono`). **Playfair Display and JetBrains Mono/Inter are no longer referenced anywhere in the codebase** (all three were swapped to Fraunces/Space Mono on the components that used them, none of which were part of the blog revert) — the pre-existing "referenced but never loaded" gap is fully closed.

**jQuery**: loaded globally in `BaseHead.astro` via a plain `<script src="https://code.jquery.com/...">` tag (not npm) and used for a handful of small interactions — the hero's staggered per-character reveal animation (`HeroSection.astro`, random 50–200ms delay per char, so don't assume the hero is "broken" if a screenshot catches it mid-reveal), the nav's scroll/dark-mode-toggle handlers (`HeaderButtons.astro`), the GitHub contribution calendar (`GitSection.astro`). Everything else is plain TS.

**Known pre-existing quirk**: `HeroSection.astro`'s `.name` style block has a `//font-size: clamp(...)` line using `//` instead of `/* */` — invalid CSS, and esbuild's minifier flags it during `astro build`, but it's a single dropped declaration, not a broken stylesheet (verified: the sibling `font-size: 19cqw` rule on `.char` spans still applies correctly). Harmless; not something to "fix" as a side effect of unrelated changes.

**Content**: blog posts are an Astro content collection (`src/content.config.ts`, glob-loaded MDX from `src/content/blog/`, schema requires `title`/`description`/`pubDate`, optional `updatedDate`/`heroImage`).
