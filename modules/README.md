# Module Workspace

This folder separates work for three collaborators while keeping the current
Another Me mirror visual style intact.

## Ownership

- `01-agent-launch/`: agent upload, repository metadata, one-click launch, hackathon agent management.
- `02-avatar/`: questionnaire, generated virtual identity/avatar, avatar gallery.
- `03-social/`: agent matching, API-backed conversation, reports, optional social map.

## Rules

- Do not edit `site/assets/index-Dg-aU52M.js` unless everyone agrees. It is a built/minified bundle.
- Build new feature pages under `modules/web/`.
- Keep module data endpoints namespaced:
  - `/api/module-agent-launch/*`
  - `/api/module-avatar/*`
  - `/api/module-social/*`
- Keep persistent local data under `data/`.
- Keep the same visual style: light lavender background, black hard borders, square shadows, Archivo Black headings, JetBrains Mono body text.
- Before merging another person's work, run `npm run mirror` and smoke-test that person's page plus your own page.
