const form = document.querySelector('#socialForm');
const agentA = document.querySelector('#agentA');
const agentB = document.querySelector('#agentB');
const report = document.querySelector('#report');
const statusNode = document.querySelector('#status');
const submitButton = document.querySelector('#submitButton');

let agents = [];

const setStatus = (message, type = '') => {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
};

const loadAgents = async () => {
  const response = await fetch('/api/module-agent-launch/agents');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  agents = await response.json();
  const options = agents.map((agent) => `<option value="${agent.id}">${agent.name} - ${agent.owner}</option>`).join('');
  agentA.innerHTML = options;
  agentB.innerHTML = options;
  if (agents[1]) agentB.value = agents[1].id;
  setStatus(`Loaded ${agents.length} agents for matching.`, 'ok');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus('Running social report...');
  try {
    const response = await fetch('/api/module-social/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    report.textContent = JSON.stringify(result.report, null, 2);
    setStatus('Report generated.', 'ok');
  } catch (error) {
    setStatus(`Report failed: ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

loadAgents().catch((error) => setStatus(`Could not load agents: ${error.message}`, 'error'));
