# Module HTML Split Design

## Purpose

Three people will work on the same website without overwriting each other. The
site should keep its current visual style. We split the hackathon module area
into independent HTML blocks, but the final webpage still assembles those blocks
into one section.

## Architecture

The website now has a small shared loader in `site/index.html`:

```html
<script src="/module-parts/shared/module-entry.js"></script>
```

That loader builds the wrapper section and fetches each module card from its
owner folder:

- `modules/01-agent-launch/entry-card.html`
- `modules/02-avatar/entry-card.html`
- `modules/03-social/entry-card.html`

The shared stylesheet is:

- `modules/shared/module-entry.css`

The server exposes these files through:

- `/module-parts/...`

This keeps module HTML inside `modules/`, while the browser can still render it.

## Ownership

### Module 01: Agent Upload And One-Click Launch

Owner edits:

- `modules/01-agent-launch/entry-card.html`
- `modules/01-agent-launch/README.md`
- Future module-specific files in `modules/01-agent-launch/`

Owner should not edit module 02 or module 03 files.

### Module 02: Agent Virtual Avatar Generation

Owner edits:

- `modules/02-avatar/entry-card.html`
- `modules/02-avatar/README.md`
- Future module-specific files in `modules/02-avatar/`

If the module is not implemented, keep its existing card and do not redesign the
site around it.

### Module 03: Agent Social

Owner edits:

- `modules/03-social/entry-card.html`
- `modules/03-social/README.md`
- Future module-specific files in `modules/03-social/`

If social map is not implemented, keep it as text or a placeholder.

## Shared Files

Only change these after agreement:

- `modules/shared/module-entry.js`
- `modules/shared/module-entry.css`
- `scripts/serve-local-mirror.mjs`
- `site/index.html`

## Visual Rules

Do not change the style language:

- white cards
- lavender background
- black hard borders
- square black shadows
- Archivo Black headings
- JetBrains Mono body text

Each partial should use existing shared classes instead of inline styling.

## Assembly Flow

1. Browser loads `/`.
2. `site/index.html` loads `/module-parts/shared/module-entry.js`.
3. The loader inserts `#hackathon-modules-entry` before `#root`.
4. The loader fetches each module's `entry-card.html`.
5. The cards render inside `.module-entry-grid`.

This is the "split bricks, assemble page" workflow.

## Verification

Run:

```bash
npm run mirror
```

Check:

```bash
curl http://localhost:4174/ | rg "module-entry.js"
curl http://localhost:4174/module-parts/01-agent-launch/entry-card.html
curl http://localhost:4174/module-parts/02-avatar/entry-card.html
curl http://localhost:4174/module-parts/03-social/entry-card.html
curl http://localhost:4174/module-parts/shared/module-entry.css
curl http://localhost:4174/module-parts/shared/module-entry.js
```

In browser, open:

```text
http://localhost:4174/
```

Confirm the `HACKATHON MODULES` section appears and visually matches the prior
version.
