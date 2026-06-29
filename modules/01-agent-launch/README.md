# Module 01: Another Me

Owner: TBD

## Scope

- Upload an agent as a skill package.
- Build an Another Me persona skill from questionnaire data.
- Save the generated skill/persona metadata into the shared agent store.
- Run chat through the existing `/api/module-agent-launch/chat` endpoint.

## Direction

- Web UI controls upload, questionnaire, and user-facing flow.
- Another Me loads the uploaded skill/persona.
- The same LLM API configuration remains in `/gpfs/users/liujinxiu/.env`.
- Future chat requests can pass `agentId` so Another Me loads that agent's saved `skillPrompt`.

This is not full code execution. V0 treats uploaded packages as skill/persona
instructions and keeps real zip extraction/sandboxing as the next implementation step.

## Files

- Page: `modules/01-agent-launch/page.html`
- Script: `modules/01-agent-launch/page.js`
- Style: `modules/01-agent-launch/page.css`
- Route: `/modules/agent-launch`
- API/data: `/api/module-agent-launch/agents`, `/api/module-agent-launch/chat`, `data/module-agent-launch-agents.json`

## Next

- Add a visible agent collection/chat entry.
- Upload and extract skill zip on the server.
- Store `SKILL.md` under `data/agent-skills/{agentId}/`.
- Pass `agentId` from chat UI into `/api/module-agent-launch/chat`.
