# Three-Person Collaboration Plan

## Goal

Keep the current Another Me mirror style unchanged while three people build separate modules:

- Module 01: agent upload and one-click launch.
- Module 02: agent virtual avatar generation.
- Module 03: agent social.

## Backup

A copy was created before the modular split:

`/gpfs/users/liujinxiu/research/hackason/another-me-mirror-backup-20260606-065900`

## Project Layout

Work inside these areas only:

```text
modules/
  01-agent-launch/
  02-avatar/
  03-social/
modules/web/
  index.html
  module.css
  agent-launch.html
  agent-launch.js
  avatar.html
  avatar.js
  social.html
  social.js
data/
scripts/serve-local-mirror.mjs
```

Do not edit `site/assets/index-Dg-aU52M.js` unless all three people agree. It is a built/minified bundle and is easy to break.

## Module Ownership

### Person 1: Agent Upload And Launch

Files:

- `modules/01-agent-launch/README.md`
- `modules/web/agent-launch.html`
- `modules/web/agent-launch.js`

API:

- `GET /api/module-agent-launch/agents`
- `POST /api/module-agent-launch/agents`

Data:

- `data/module-agent-launch-agents.json`

V0 requirement:

- A user uploads an agent manifest.
- Another user sees it in the gallery.
- The `Open Agent` button opens the uploaded chat URL.

### Person 2: Agent Avatar

Files:

- `modules/02-avatar/README.md`
- `modules/web/avatar.html`
- `modules/web/avatar.js`

API:

- `GET /api/module-avatar/profiles`
- `POST /api/module-avatar/profiles`

Data:

- `data/module-avatar-profiles.json`

V0 requirement:

- Questionnaire exists.
- Submit creates an avatar prompt/profile card.
- Later, this can call a real image/VLM model.

### Person 3: Agent Social

Files:

- `modules/03-social/README.md`
- `modules/web/social.html`
- `modules/web/social.js`

API:

- `POST /api/module-social/conversations`

Data:

- `data/module-social-conversations.json`

V0 requirement:

- Read uploaded agents from module 01.
- Select two agents.
- Generate a structured report.
- Later, replace mock report with real API relay.

## How To Work Without Stepping On Each Other

1. Each person edits only their module files.
2. Shared style changes go into `modules/web/module.css`; discuss before changing it.
3. Shared server changes go into `scripts/serve-local-mirror.mjs`; add only namespaced endpoints.
4. Never rename another person's fields without telling them.
5. Test from the browser before saying a module is done.

## Merge Routine

Use this checklist whenever combining changes:

1. Start the mirror:

```bash
npm run mirror
```

2. Open:

```text
http://localhost:4174/modules/
```

3. Smoke-test all modules:

- `/modules/agent-launch`
- `/modules/avatar`
- `/modules/social`

4. Check API health:

```bash
curl http://localhost:4174/api/module-agent-launch/agents
curl http://localhost:4174/api/module-avatar/profiles
```

5. If a module breaks, revert only that module's files. Do not touch other modules.

## Style Rules

Keep the same family as the current local module pages:

- light lavender background
- black hard borders
- square shadow offset
- Archivo Black headings
- JetBrains Mono body
- no marketing-style redesign
- no unrelated color palette changes

## Current Module URLs

```text
http://localhost:4174/modules/
http://localhost:4174/modules/agent-launch
http://localhost:4174/modules/avatar
http://localhost:4174/modules/social
```
