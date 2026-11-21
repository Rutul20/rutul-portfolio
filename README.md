# Rutul Dave · portfolio

The page opens on a toy globe. Scrolling dives down to India, drops through the clouds and lands on a miniature Vadodara, which a toy train then tours. Each stop of the tour is a chapter of the résumé:

| Stop | Building | Section |
|---|---|---|
| 1 | Toy globe → clouds → the whole city | Hero: name, role, years, stack, résumé / contact; then the landing |
| 2 | A small house | About, photo, community |
| 3 | Office street (three buildings, growing taller) | Experience |
| 4 | Post office | ePost case study |
| 5 | Market, school, clinic, brew shop | Client work (incl. Pinter) |
| 6 | Workshop | Side projects shelf (six projects, Details dialog), skills |
| 7 | College | Education, workshops, early work |
| 8 | Station | Contact |

The page is plain HTML first. The 3D city is a layer behind it:

- **Desktop with a mouse and WebGL2:** the live 3D city (React Three Fiber) loads after the page is idle and fades in over a matching picture.
- **Phones, low-memory devices, Save-Data, no WebGL:** pre-rendered pictures of each stop that cross-fade as you scroll. Phones never download the 3D code unless the visitor taps **Enter the 3D city**.
- **Reduced motion:** the camera cuts between stops instead of flying.
- **Résumé view** (`/resume/`): the same content as one printable page ("Print or save as PDF").

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 · Three.js r187 via React Three Fiber 9. Build-time tools: Playwright (renders the pictures on the GPU) and sharp (image processing).

## Commands

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:3100
npm run build      # static site in ./out (fails if the city pictures are stale, see below)
npm run preview    # serves ./out at http://localhost:4100
```

| Command | What it does |
|---|---|
| `npm run renders` | Renders the live city at every stop into `public/renders/` (phone + desktop pictures) and `public/og.jpg` (share image). Starts its own dev server on :3101; set `RENDER_BASE=http://localhost:3100` to reuse a running one. Needs a machine with a GPU. |
| `node scripts/make-globe-texture.mjs` | Repaints `public/globe/land.webp` from Natural Earth land shapes (public domain, via the `world-atlas` package). Coastlines only: no political borders are drawn. |
| `npm run photo` | Re-crops `source-assets/photo-original.jpg` into `public/photo/`. |
| `npm run typecheck` | TypeScript only. |
| `npm run build:unchecked` | Build without the render freshness check (not for release). |

## Editing content

Every word lives in **`src/content/content.ts`**. Edit it, then `npm run build`.

- Copy changes never need new pictures.
- Changing the stop list, a client project's `building`, or anything in `src/components/city/` changes how the city looks: run `npm run renders` first. `npm run build` refuses to ship stale pictures.
- To publish the NEXORA demo link: set `demoUrl` on NEXORA in `content.ts`. The "Try the live demo" button appears automatically.
- Client projects map to buildings (`market`, `school`, `clinic`, `shop`) in the order listed; the city has four slots.
- Side projects appear on the shelf in the order listed. A project without screenshots gets a coloured monogram tile (`tint`). Leave `period` out when the year is unknown.

## Deploying

`npm run build` produces a fully static site in `./out`. Any static host works (Vercel, Netlify, Cloudflare Pages, Hostinger file upload).

- Set `SITE_URL` when building for a real domain so share previews use absolute image links:
  `SITE_URL=https://your-domain.example npm run build`
- Long cache headers are safe for `/_next/` and `/renders/` (file names change when content changes).

## Themes: Light, Dark, System

"Gallery Plinth": a flat gallery-wall background (paper `#efebe4` / charcoal `#161514`) so the miniature city is the only colour on the page, frosted display-case glass for the cards, and one cinnabar accent.

- All colours are tokens in `src/app/globals.css`: light values in `@theme`, dark overrides under `:root[data-theme='dark']`. Use `ink`, `ink-soft`, `surface`, `subtle`, `line`, `accent`, `teal` in classes (e.g. `text-accent`, `bg-subtle`).
- The header button opens Light / Dark / System. The choice is stored in `localStorage` (`theme`). A tiny script in `<head>` (`THEME_BOOT_SCRIPT` in `src/components/ThemeSwitch.tsx`) sets `html[data-theme]` before the first paint, so there's no flash. `ThemeSync` (mounted in the root layout) keeps the browser-bar colour in step and follows the device live while "System" is chosen.
- Glass (`.glass`, `.card`, `.landing-note`, the ticket) blurs only on desktops running the live 3D. Phones, tablets, low-memory devices (`html[data-stage='still']`, set by `CityStage`), "reduce transparency" and browsers without `backdrop-filter` get the same cards opaque without blur. Header pills, the map rail and menus use the solid `.glass-solid`.
- The 3D city's own lighting doesn't change with the theme. The phone pictures are transparent, so either wall colour shows behind them.

## Project layout

```
src/content/content.ts        all text, links, project data, the tour's stops
src/app/                      page, résumé page, layout (fonts, SEO, JSON-LD, theme boot script), styles + tokens
src/components/Sections.tsx   the eight stop cards
src/components/ThemeSwitch.tsx, ThemeSync.tsx   the Light / Dark / System control and its page-wide sync
src/components/stage/         CityStage (live vs pictures, scroll → tour progress, clouds), StillLayer
src/components/city/          the 3D city: layout + cameras, buildings, scenery, palace, train, globe, lighting
src/lib/progress.ts           scroll → tour progress and landing stores shared by the city, pictures, clouds and map
scripts/                      render-city, check-renders, process-photo, make-globe-texture, serve
qa/                           QA scripts used during development (screenshots, phone checks, profiling)
```

## Measured during QA (19 Nov 2026, after the themes)

- Contrast measured from rendered pixels at every stop, the landing, the dialog, menus and the résumé page, in both themes, desktop and phone: all text passes WCAG AA (lowest 5.5:1); focus rings keep ≥ 3:1 even over the 3D city (a surface-coloured halo sits between ring and scene).
- Theme switch: no wrong-theme frame on load (checked frame by frame), choice persists, System follows the device live on every page, fully keyboard-operable, menu stays on screen down to 320 px.
- Desktop live 3D with glass, light and dark: 60 fps, 95th-percentile frame 16.7 ms through the whole page; all 12 shader programs compile at load. Known: on a cold first visit, one ~67 ms frame when the first blurred card scrolls in (warm visits are clean).
- Phones download no 3D code and get opaque cards without blur.
- Lighthouse mobile (quiet machine, before the last round of fixes): median 98, Accessibility/Best Practices/SEO 100. Later runs on this machine were unreliable (a blank HTML page also stalled), so confirm with PageSpeed Insights once deployed.

## Measured during QA (18 Nov 2026, after the landing fixes)

On the author's laptop (Intel UHD Graphics), production build served locally:

- The pre-rendered pictures and the live 3D use identical framing on every window shape (the live camera depends only on landscape vs portrait), so the hand-over from picture to 3D doesn't jump.
- Live 3D, scrolling slowly through the whole globe dive: 16.7 ms average frame; one 33 ms frame at the scene swap, fully hidden under the cloud cover. The city's shaders are compiled at load (warm-up frame), not at the swap.
- Phones: five globe pictures (g0–g4), each zoomed towards the Vadodara pin until it matches the next (pin positions and camera heights are measured by `npm run renders` into `src/components/stage/globe-frames.json`). No 3D code is downloaded.
- Keyboard order, map jumps, the Details dialog, reduced motion and no-WebGL all checked.
- Lighthouse mobile: Performance 96–100 over seven runs (median 99); Accessibility, Best Practices and SEO 100; LCP 1.2 s; CLS 0. Earlier builds measured 72–98 on the same machine, so confirm with PageSpeed Insights once deployed.
- Lighthouse desktop: Performance 75. It runs without a GPU, so booting the 3D scene counts as blocking time.
