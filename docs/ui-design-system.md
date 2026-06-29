# Snap Sport UI Design System

## Scope

This design system applies to the static H5 app in `site/` and companion pages under `modules/`.

Primary files:

- `site/index.html`
- `site/sports-app.js`
- `site/sports-app.css`
- `site/local-auth.js`
- `site/local-auth.css`
- `modules/web/*`

## Design Intent

Design Snap Sport as a compact campus sports product, not a marketing site. Users should quickly compare venues, join games, pay, check in, review players, and read credit status. Venue and admin users should scan operational data without visual clutter.

Current visual direction: youthful green sports app with liquid-glass surfaces. Use translucent panels, backdrop blur, thin white/green borders, soft highlights, and layered depth while keeping text readable.

## Tokens

Use these core tokens in CSS:

```css
:root {
  --bg: #f4f7f2;
  --panel: #ffffff;
  --panel-soft: #f8faf6;
  --ink: #102016;
  --muted: #647067;
  --subtle: #8b968e;
  --line: #dbe4d8;
  --line-strong: #b8c7b3;
  --green: #12824f;
  --green-dark: #083923;
  --lime: #d7f36a;
  --blue: #2563eb;
  --orange: #f07a32;
  --red: #cf2e2e;
  --radius: 8px;
  --shadow: 0 12px 28px rgba(28, 49, 35, 0.10);
}
```

## Layout

- Keep content inside `width: min(1180px, calc(100% - 32px))`.
- Use 16px gutters on mobile and wider gutters on desktop.
- Use sticky top navigation for mode switching and session actions.
- Use cards for repeated entities only: venues, games, orders, users, metrics, notifications.
- Do not nest cards inside cards.
- Prefer dense list rows and tables for admin/venue workflows.
- The homepage opening section may use a larger immersive green glass hero, as long as the next booking/list content is still visible without excessive scrolling.

## Components

### Buttons

- Primary actions use green.
- Payment or warning actions may use orange.
- Destructive actions use red.
- Secondary actions use white surfaces with a subtle border.
- Minimum height is 40px, preferably 44px on mobile.

### Tabs and Filters

- Use segmented tabs or pill filters.
- Active state must be unmistakable.
- Filter rows must wrap without horizontal overflow.

### Forms

- Labels appear above inputs.
- Inputs use subtle borders and clear focus states.
- Validation and helper text stay near the field.

### Cards and Lists

- Cards use consistent padding, radius, border, and shadow.
- Status badges use semantic color.
- Dense operational data should be a table or compact list, not a large promo card.
- Liquid-glass cards should use `background: rgba(255,255,255,.18-.72)`, `backdrop-filter: blur(...)`, thin borders, and clear text contrast.

### Modals and Sheets

- Use for booking, payment, join confirmation, support, and review flows.
- Keep primary actions easy to reach on mobile.
- Backdrop should dim and focus attention without hiding important context.

## Responsive Rules

- Check 375px and 1280px widths.
- No horizontal overflow.
- Long Chinese labels must wrap.
- Floating controls must not cover primary actions.
- Mobile tabbar and return-home button need enough bottom padding in the page.

## Implementation Rules

- Preserve API endpoints, status keys, auth/session behavior, localStorage keys, and database field names.
- Prefer adding or adjusting CSS classes over rewriting JavaScript render logic.
- Escape user-provided values through the existing `h()` helper in JavaScript templates.
- Keep JavaScript template strings syntactically simple.
