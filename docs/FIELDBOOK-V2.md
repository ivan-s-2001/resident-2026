# Resident 2026 — BSAA Fieldbook v2

A new interface, served independently at \`/next\`, while the original character sheet stays on \`/\` for comparison.

## Architecture

- **UI source:** \`cloudflare/v2-app.js\` (screens, actions, sync), \`cloudflare/v2-kit.js\` (shared components), \`cloudflare/v2-style.js\` (theme).
- **Existing backend:** \`cloudflare/team-api.js\` provides the same-origin auth/API endpoints and Cloudflare D1 persistence.
- **Open-source foundation:** vendored MIT stylesheet from SheetBound, modified by BSAA theme; selected Lucide icons (ISC).
- **Not based on D&D rules:** content and game math remain the GM's \`Резидент 2026\` system (5/4/3 groups, 1–5 traits, health=5+relevant attribute).
- **No dice engine or virtual tabletop.** All rolls use physical dice during in-person play.
- **Privacy:** GM-only plan and private effects never appear in player API responses. Demo mode mutates only in-memory mock objects.

## Quick QA

- Player demo: \`/next?demo=player\`
- GM demo: \`/next?demo=gm\`
- Live accounts: \`/next\`

Do not copy full campaign/source PDFs or GM-only materials to the public repository. Import verified catalog data into D1 only after explicit review of licensing/sharing permissions.

## Deployment

Worker module assets are served under \`/next/*.js\` and \`/next/*.css\`. The entire v2 is self-hosted and runs without npm/CDN dependencies at runtime. Build checks require only Node.js 22+.

Main/production D1 is not modified by QA deployment. Use the dedicated QA database binding.

The first GM account must be provisioned administratively in D1, not via public one-time registration.
