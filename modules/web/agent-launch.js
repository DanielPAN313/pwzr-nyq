const form = document.querySelector('#agentForm');
const grid = document.querySelector('#agentGrid');
const statusNode = document.querySelector('#status');
const submitButton = document.querySelector('#submitButton');

const setStatus = (message, type = '') => {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
};

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[char]);

const isVideoFile = (url) => /\.(mp4|webm|ogg)(\?|#|$)/i.test(url || '');

const renderAgent = (agent) => {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-top"><span>${escapeHtml(agent.category || 'General')}</span><b>${escapeHtml(agent.owner)}</b></div>
    <h3>${escapeHtml(agent.name)}</h3>
    <p class="tagline">${escapeHtml(agent.tagline || 'Ready to launch')}</p>
    <p class="description">${escapeHtml(agent.description)}</p>
    <div class="actions">
      <a class="button primary" href="${escapeHtml(agent.chatUrl)}" target="_blank" rel="noopener">Open Agent</a>
      ${agent.repoUrl ? `<a class="button" href="${escapeHtml(agent.repoUrl)}" target="_blank" rel="noopener">Repository</a>` : ''}
      ${agent.demoVideoUrl ? `<a class="button" href="${escapeHtml(agent.demoVideoUrl)}" target="_blank" rel="noopener">Demo</a>` : ''}
    </div>
    ${isVideoFile(agent.demoVideoUrl) ? `<video src="${escapeHtml(agent.demoVideoUrl)}" controls preload="metadata"></video>` : ''}
  `;
  return card;
};

const loadAgents = async () => {
  setStatus('Loading shared agent list...');
  const response = await fetch('/api/module-agent-launch/agents');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const agents = await response.json();
  grid.replaceChildren(...agents.map(renderAgent));
  setStatus(`Loaded ${agents.length} agent${agents.length === 1 ? '' : 's'}.`, 'ok');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus('Publishing agent...');
  try {
    const response = await fetch('/api/module-agent-launch/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    form.reset();
    await loadAgents();
    setStatus(`Published ${result.name}. Other users can open it now.`, 'ok');
  } catch (error) {
    setStatus(`Upload failed: ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

loadAgents().catch((error) => setStatus(`Could not load agents: ${error.message}`, 'error'));
