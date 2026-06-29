# Module 02: Agent Virtual Avatar Generation

Owner: TBD

## Scope

- Design the questionnaire.
- Generate a virtual identity/avatar from answers.
- Keep generated avatars available for the rest of the platform.

## Current V0 Decision

The page is a structured questionnaire plus a local preview. It does not call an
image model yet. The generated result is a profile card with:

- visual style
- personality
- role
- color direction
- prompt text that can later be sent to a VLM/image generator

## Files

- Page: `modules/web/avatar.html`
- Script: `modules/web/avatar.js`
- API/data: `/api/module-avatar/profiles`, `data/module-avatar-profiles.json`

## Later

- Load `/gpfs/users/liujinxiu/.env` for image/VLM generation when real model calls are added.
- Persist generated image URLs or local image paths.
- Link an avatar profile back to an uploaded agent ID.
