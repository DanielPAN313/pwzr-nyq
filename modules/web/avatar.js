const form = document.querySelector('#avatarForm');
const grid = document.querySelector('#avatarGrid');
const statusNode = document.querySelector('#status');
const submitButton = document.querySelector('#submitButton');

const setStatus = (message, type = '') => {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
};

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const renderProfile = (profile) => {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-top"><span>${escapeHtml(profile.color)}</span><b>${escapeHtml(profile.role)}</b></div>
    <h3>${escapeHtml(profile.agentName)}</h3>
    <p class="tagline">${escapeHtml(profile.personality)}</p>
    <p class="description">${escapeHtml(profile.prompt)}</p>
  `;
  return card;
};

const loadProfiles = async () => {
  const response = await fetch('/api/module-avatar/profiles');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const profiles = await response.json();
  grid.replaceChildren(...profiles.map(renderProfile));
  setStatus(`Loaded ${profiles.length} avatar profile${profiles.length === 1 ? '' : 's'}.`, 'ok');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus('Generating avatar card...');
  try {
    const response = await fetch('/api/module-avatar/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    form.reset();
    await loadProfiles();
    setStatus(`Generated avatar card for ${result.agentName}.`, 'ok');
  } catch (error) {
    setStatus(`Generation failed: ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

loadProfiles().catch((error) => setStatus(`Could not load profiles: ${error.message}`, 'error'));
