---
name: snap-sport-ui
description: Improve the Snap Sport static H5 sports booking app UI. Use when editing this repository's HTML, CSS, and JavaScript screens to create a consistent, production-grade interface while preserving business logic, API routes, auth/session behavior, database fields, and localStorage keys.
---

# Snap Sport UI

Use this project skill when improving UI in this repository.

## Workflow

1. Read the target HTML/CSS/JS files before editing.
2. Preserve existing product logic and data contracts.
3. Prefer CSS tokens, shared classes, and scoped markup refinements over page rewrites.
4. Keep the app static H5 friendly; do not add a framework unless explicitly requested.
5. Verify desktop and mobile layouts after meaningful UI changes.

## Product Direction

Snap Sport is a campus sports booking and matchmaking MVP for users, venues, and operations staff.

The UI should feel:

- Young, athletic, green, and energetic.
- Liquid-glass inspired: translucent cards, soft blur, light refraction, green glow, and layered depth.
- Dense enough for booking, order, venue, and admin workflows.
- Consistent across user, venue, and admin modes.

Read `docs/ui-design-system.md` before substantial UI work.

## Constraints

- Keep border radii modest, usually 8px or less.
- Avoid unrelated decorative blobs, heavy off-brand gradients, and one-off novelty styles.
- Use the current theme direction: green liquid glass, mobile-first app polish, readable translucent surfaces, and energetic sports imagery.
- Do not hide core operational data inside oversized marketing cards.
- Ensure Chinese labels wrap cleanly on mobile.
- Do not scale text with viewport width.
- Keep letter spacing at 0.
- Style hover, focus, disabled, empty, loading, error, and success states.
