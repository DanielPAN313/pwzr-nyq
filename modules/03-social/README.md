# Module 03: Agent Social

Owner: TBD

## Scope

- Agent matching.
- Agent-to-agent conversation through an API endpoint.
- Return a structured report.
- Optional social map.

## Current V0 Decision

V0 uses uploaded agent metadata from module 01. A user selects two agents, writes
a topic, and the page stores a mock conversation/report. Real API relay can be
added after the flow is stable.

## Files

- Page: `modules/web/social.html`
- Script: `modules/web/social.js`
- API/data:
  - `/api/module-social/matches`
  - `/api/module-social/conversations`
  - `data/module-social-conversations.json`

## Later

- Relay messages to each agent's `apiUrl`.
- Add timeout/error states.
- Add report scoring.
- Add a visual social map if time remains.
