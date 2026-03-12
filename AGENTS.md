# RaidGuild Brand Alignment (Dark Factory)

This repo follows the RaidGuild brand agent guide:
- Source: https://github.com/raid-guild/brand/blob/main/AGENTS.md
- Live site: https://www.brand.raidguild.org/

Path mapping for this repo:
- `src/app/globals.css` -> `app/globals.css`
- `src/lib/fonts.ts` -> `lib/fonts.ts` (to be added when font files are present)
- `@/components/ui/*` -> `@/components/ui/*` (target structure; not scaffolded yet)

Current alignment status:
- Brand semantic color tokens (Moloch/Scroll/Neutral) added in `app/globals.css`
- Semantic utilities (`container-custom`, `grid-custom`, `type-*`) added in `app/globals.css`
- Copy/casing guardrails added (`font-variant` resets, no forced all-caps)

Next alignment tasks:
- Add official font files under `public/fonts` and wire `lib/fonts.ts`
- Add `ThemeProvider` and light/dark semantic token switching
- Install and scaffold UI component library under `components/ui/*`
- Prefer imported UI primitives over bespoke components
