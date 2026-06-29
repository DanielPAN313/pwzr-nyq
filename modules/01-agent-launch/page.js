const form = document.querySelector('#agentForm');
const avatarForm = document.querySelector('#avatarAgentForm');
const chatForm = document.querySelector('#chatForm');
const messages = document.querySelector('#messages');
const emptyState = document.querySelector('#emptyState');
const historyList = document.querySelector('#historyList');
const draftAgentList = document.querySelector('#draftAgentList');
const publishedAgentList = document.querySelector('#publishedAgentList');
const historySearch = document.querySelector('#historySearch');
const statusNode = document.querySelector('#status');
const avatarStatusNode = document.querySelector('#avatarStatus');
const chatStatusNode = document.querySelector('#chatStatus');
const mcpStatusNode = document.querySelector('#mcpStatus');
const sendButton = document.querySelector('#sendButton');
const actionButtons = Array.from(form.querySelectorAll('button[name="action"]'));
const avatarSubmitButton = document.querySelector('#avatarSubmitButton');
const newChatButton = document.querySelector('#newChatButton');
const myAgentsButton = document.querySelector('#myAgentsButton');
const agentModal = document.querySelector('#agentModal');
const closeAgentModal = document.querySelector('#closeAgentModal');
const categorySelect = form.querySelector('select[name="category"]');
const customCategoryField = document.querySelector('#customCategoryField');
const customCategoryInput = form.querySelector('input[name="customCategory"]');
const questionnaireToggle = document.querySelector('#questionnaireToggle');
const questionnairePanel = document.querySelector('#questionnairePanel');
const moduleTitle = document.querySelector('#moduleTitle');
const runtimeBadge = document.querySelector('#runtimeBadge');

const historyKey = 'another-me-agent-launch-history';
let conversations = JSON.parse(localStorage.getItem(historyKey) || '[]');
let activeConversationId = crypto.randomUUID();
let activeAgentId = '';
let activeAgentName = '觅见AI';
let currentMcp = JSON.parse(localStorage.getItem('another-me-current-mcp') || 'null');
let agents = [];
let lastProfileMarkdown = '';

const saveHistory = () => localStorage.setItem(historyKey, JSON.stringify(conversations.slice(0, 40)));

const setStatus = (node, message, type = '') => {
  node.textContent = message;
  node.className = `status ${type}`.trim();
};

const ensureConversation = () => {
  let conversation = conversations.find((item) => item.id === activeConversationId);
  if (!conversation) {
    conversation = {
      id: activeConversationId,
      title: '新的 Another Me 对话',
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    conversations.unshift(conversation);
  }
  return conversation;
};

const renderHistory = () => {
  const keyword = historySearch.value.trim().toLowerCase();
  const items = conversations.filter((item) => {
    if (!keyword) return true;
    return `${item.title} ${item.messages.map((message) => message.text).join(' ')}`.toLowerCase().includes(keyword);
  });
  historyList.replaceChildren(...items.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector('strong').textContent = item.title;
    button.querySelector('span').textContent = item.messages.at(-1)?.text || '还没有消息';
    button.addEventListener('click', () => {
      activeConversationId = item.id;
      renderMessages();
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const shouldDelete = window.confirm('删除这条对话记录？已保存为草稿或已发布的 Agent 不会被删除。');
      if (!shouldDelete) return;
      conversations = conversations.filter((entry) => entry.id !== item.id);
      saveHistory();
      if (activeConversationId === item.id) {
        activeConversationId = crypto.randomUUID();
        messages.replaceChildren();
        emptyState.hidden = false;
        resetActiveAgent('已删除当前对话，当前测试对象：觅见AI');
      }
      renderHistory();
    });
    return button;
  }));
};

const agentStatusLabel = (status) => {
  if (status === 'published') return '已发布';
  if (status === 'draft') return '草稿';
  return '测试中';
};

const loadAgents = async () => {
  const response = await fetch('/api/module-agent-launch/agents');
  agents = await response.json().catch(() => []);
  if (!Array.isArray(agents)) agents = [];
  renderAgents();
};

const selectAgent = (agent) => {
  const displayName = agent.name || '觅见AI';
  activeAgentId = agent.id;
  activeAgentName = displayName;
  lastProfileMarkdown = String(agent.skillPrompt || '').startsWith('# PROFILE.md') ? agent.skillPrompt : '';
  localStorage.setItem('another-me-active-agent-id', activeAgentId);
  localStorage.setItem('another-me-active-agent-name', activeAgentName);
  runtimeBadge.textContent = `当前 Agent：${displayName}`;
  setStatus(chatStatusNode, `当前测试对象：${displayName}`, 'ok');
  setStatus(statusNode, `已选中 ${displayName}。中间对话会使用这个 Agent。`, 'ok');
};

const resetActiveAgent = (message = '当前测试对象：觅见AI') => {
  activeAgentId = '';
  activeAgentName = '觅见AI';
  lastProfileMarkdown = '';
  localStorage.removeItem('another-me-active-agent-id');
  localStorage.removeItem('another-me-active-agent-name');
  runtimeBadge.textContent = '当前 Agent：觅见AI';
  setStatus(chatStatusNode, message, 'ok');
};

const renderAgents = () => {
  const createAgentButton = (agent) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.innerHTML = `<strong></strong><span></span>`;
    const displayName = agent.name || '觅见AI';
    button.querySelector('strong').textContent = displayName;
    button.querySelector('span').textContent = `${agentStatusLabel(agent.status)} · ${agent.tagline || agent.category || '未填写简介'}`;
    button.addEventListener('click', () => {
      selectAgent(agent);
      agentModal.hidden = true;
    });
    return button;
  };
  const drafts = agents.filter((agent) => agent.status !== 'published');
  const published = agents.filter((agent) => agent.status === 'published');
  const emptyDraft = document.createElement('div');
  emptyDraft.className = 'empty-list';
  emptyDraft.textContent = '暂无草稿';
  const emptyPublished = document.createElement('div');
  emptyPublished.className = 'empty-list';
  emptyPublished.textContent = '暂无已发布';
  draftAgentList.replaceChildren(...(drafts.length ? drafts.map(createAgentButton) : [emptyDraft]));
  publishedAgentList.replaceChildren(...(published.length ? published.map(createAgentButton) : [emptyPublished]));
};

const renderMessages = () => {
  const conversation = conversations.find((item) => item.id === activeConversationId);
  messages.replaceChildren();
  for (const message of conversation?.messages || []) addMessage(message.role, message.text, false);
  emptyState.hidden = Boolean(conversation?.messages?.length);
};

const addMessage = (role, text, persist = true) => {
  const item = document.createElement('article');
  item.className = `message ${role}`;
  const label = role === 'user' ? '你' : role === 'assistant' ? 'Another Me' : '系统';
  item.innerHTML = `<strong></strong><pre></pre>`;
  item.querySelector('strong').textContent = label;
  item.querySelector('pre').textContent = text;
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  emptyState.hidden = true;

  if (persist) {
    const conversation = ensureConversation();
    conversation.messages.push({ role, text });
    if (role === 'user' && conversation.messages.length <= 1) conversation.title = text.slice(0, 28) || conversation.title;
    conversation.updatedAt = new Date().toISOString();
    conversations = [conversation, ...conversations.filter((entry) => entry.id !== conversation.id)];
    saveHistory();
    renderHistory();
  }
  return item;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const value = String(reader.result || '');
    resolve(value.includes(',') ? value.split(',').pop() : value);
  });
  reader.addEventListener('error', () => reject(reader.error || new Error('文件读取失败')));
  reader.readAsDataURL(file);
});

const buildLiveProfile = () => {
  const values = Object.fromEntries(new FormData(form).entries());
  const name = String(values.name || '').trim();
  const owner = String(values.owner || '').trim();
  const tagline = String(values.tagline || '').trim();
  const description = String(values.description || '').trim();
  const category = String(values.category === '其他' ? values.customCategory || '' : values.category || '').trim();
  const hasMcp = Boolean(currentMcp?.name || currentMcp?.endpoint || currentMcp?.purpose);
  if (!name && !owner && !tagline && !description && !category && !hasMcp) return '';
  const identity = [
    name ? `- Agent Name: ${name}` : '',
    owner ? `- Owner: ${owner}` : '',
    category ? `- Category: ${category}` : '',
  ].filter(Boolean);
  return [
    '# PROFILE.md',
    '',
    identity.length ? '## Identity' : '',
    ...identity,
    identity.length ? '' : '',
    tagline ? '## One-Line Introduction' : '',
    tagline,
    tagline ? '' : '',
    description ? '## Detailed Persona And Behavior' : '',
    description,
    description ? '' : '',
    '## Runtime Rule',
    '- Treat this Markdown as the latest source of truth for the active Agent.',
    '- If no skill zip exists, this Markdown is the full agent behavior definition.',
    '- If a skill zip exists, this Markdown refines and overrides conflicting skill instructions.',
    hasMcp ? '' : '',
    hasMcp ? '## MCP' : '',
    currentMcp?.name ? `- Name: ${currentMcp.name}` : '',
    currentMcp?.endpoint ? `- Endpoint: ${currentMcp.endpoint}` : '',
    currentMcp?.purpose ? `- Purpose: ${currentMcp.purpose}` : '',
  ].filter(Boolean).join('\n');
};

const buildSavedProfilePrompt = (profileMarkdown, hasSkillZip, skillZipName) => [
  profileMarkdown,
  hasSkillZip ? `Skill package: ${skillZipName}` : profileMarkdown ? 'Skill package: none. Use PROFILE.md as the agent behavior.' : '',
  hasSkillZip
    ? 'Instruction: use both the uploaded skill package and PROFILE.md. If they conflict, PROFILE.md is the latest refinement.'
    : profileMarkdown
      ? 'Instruction: no skill package is attached. PROFILE.md is the full agent profile.'
      : '',
].filter(Boolean).join('\n\n');

const getActiveConversationMessages = () => {
  const conversation = conversations.find((item) => item.id === activeConversationId);
  return (conversation?.messages || [])
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .slice(-16)
    .map((item) => ({
      role: item.role,
      text: String(item.text || '').slice(0, 4000),
    }));
};

const askRuntime = async (message) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 75000);
  const response = await fetch('/api/module-agent-launch/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      message,
      agentId: activeAgentId,
      conversationId: activeConversationId,
      history: getActiveConversationMessages(),
    }),
  }).catch((error) => {
    if (error.name === 'AbortError') throw new Error('模型响应超时，请稍后重试或检查当前 Agent 配置。');
    throw error;
  }).finally(() => {
    window.clearTimeout(timeout);
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
};

const publishAgent = async (agent) => {
  const response = await fetch('/api/module-agent-launch/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
};

const updateAgent = async (agentId, agent) => {
  const response = await fetch(`/api/module-agent-launch/agents/${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
};

const buildQuestionnaireProfile = (values) => {
  const excluded = new Set(['personName', 'role', 'skills', 'personality', 'homepageUrl']);
  const entries = Object.entries(values)
    .filter(([key, value]) => !excluded.has(key) && String(value || '').trim())
    .map(([key, value]) => `${key}：${String(value).trim()}`);

  return entries.length ? `人格问卷补充：\n${entries.join('\n')}` : '';
};

const distillPersonaSkill = (values, description) => [
  '# Persona Skill',
  '',
  '## Identity',
  `You are the avatar agent for ${values.personName}.`,
  `Role: ${values.role}.`,
  '',
  '## Core Capabilities',
  values.skills,
  '',
  '## Personality And Voice',
  values.personality,
  '',
  '## Homepage',
  values.homepageUrl || 'Not provided.',
  '',
  '## Full Persona Notes',
  description,
  '',
  '## LLM API Status',
  'Placeholder only. Waiting for the user-provided LLM API endpoint and authentication before injection.',
].join('\n');

const createAvatarRuntime = async (skill) => ({
  status: 'placeholder',
  skill,
  chatUrl: '',
  apiUrl: '',
  note: 'LLM API not connected yet.',
});

const syncCustomCategory = () => {
  const needsCustomCategory = categorySelect.value === '其他';
  customCategoryField.hidden = !needsCustomCategory;
  customCategoryInput.required = needsCustomCategory;
  if (!needsCustomCategory) customCategoryInput.value = '';
};

const openModule = (name) => {
  const titleMap = { skill: 'Skill', mcp: 'MCP', another: 'Another Me' };
  moduleTitle.textContent = titleMap[name] || 'Skill';
  document.querySelectorAll('.module-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${name}Module`));
  document.querySelectorAll('.module-tab, .tool-chip').forEach((button) => button.classList.toggle('active', button.dataset.module === name));
};

categorySelect.addEventListener('change', syncCustomCategory);
syncCustomCategory();

historySearch.addEventListener('input', () => {
  renderHistory();
});

myAgentsButton.addEventListener('click', async () => {
  await loadAgents();
  agentModal.hidden = false;
});

const initialAgentId = new URLSearchParams(window.location.search).get('agentId');
const initializeAgents = async () => {
  await loadAgents();
  if (initialAgentId) {
    const agent = agents.find((item) => item.id === initialAgentId);
    if (agent) {
      selectAgent(agent);
      return;
    }
    setStatus(chatStatusNode, '没有找到这个 Agent，已保持当前对话。', 'error');
  } else {
    resetActiveAgent();
  }
};

closeAgentModal.addEventListener('click', () => {
  agentModal.hidden = true;
});

agentModal.addEventListener('click', (event) => {
  if (event.target.matches('[data-close-agent-modal]')) agentModal.hidden = true;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') agentModal.hidden = true;
});

newChatButton.addEventListener('click', () => {
  activeConversationId = crypto.randomUUID();
  messages.replaceChildren();
  emptyState.hidden = false;
  renderHistory();
  resetActiveAgent('已新建对话，当前测试对象：觅见AI');
});

document.querySelectorAll('[data-module]').forEach((button) => {
  button.addEventListener('click', () => openModule(button.dataset.module));
});

document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    chatForm.message.value = button.dataset.prompt;
    chatForm.message.focus();
  });
});

questionnaireToggle.addEventListener('click', () => {
  const shouldOpen = questionnairePanel.hidden;
  questionnairePanel.hidden = !shouldOpen;
  questionnaireToggle.setAttribute('aria-expanded', String(shouldOpen));
  questionnaireToggle.textContent = shouldOpen ? '收起精准化问卷' : '填写精准化问卷';
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = String(new FormData(chatForm).get('message') || '').trim();
  if (!message) return;
  addMessage('user', message);
  chatForm.reset();
  sendButton.disabled = true;
  setStatus(chatStatusNode, '思考中...');
  try {
    const result = await askRuntime(message);
    addMessage('assistant', result.output || '没有返回文本。');
    setStatus(chatStatusNode, '完成。', 'ok');
  } catch (error) {
    setStatus(chatStatusNode, `调用失败：${error.message}`, 'error');
  } finally {
    sendButton.disabled = false;
    chatForm.message.focus();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const action = event.submitter?.value || 'update';
  actionButtons.forEach((button) => { button.disabled = true; });
  setStatus(statusNode, action === 'publish' ? '正在发布并同步画像...' : action === 'draft' ? '正在保存草稿并同步画像...' : '正在更新并同步画像...');
  setStatus(chatStatusNode, '正在把右侧画像写入当前 Agent...');
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const skillZip = values.skillZip;
    const hasSkillZip = Boolean(skillZip && skillZip.name);
    const isDraft = action === 'draft';
    if (hasSkillZip && !skillZip.name.toLowerCase().endsWith('.zip')) {
      throw new Error('请上传正确格式的 Agent 文件');
    }
    const demoVideo = values.demoVideo;
    const demoVideoNote = demoVideo && demoVideo.name
      ? [`视频 Demo 文件：${demoVideo.name}`, `视频 Demo 大小：${Math.ceil(demoVideo.size / 1024)} KB`]
      : [];
    const category = values.category === '其他' ? String(values.customCategory || '').trim() : values.category;
    if (!isDraft && !category) throw new Error('请填写具体赛道');
    const description = [
      values.description,
      hasSkillZip ? `技能包文件：${skillZip.name}` : `技能包文件：沿用当前已接入的 ${activeAgentName || 'Agent'}`,
      hasSkillZip ? `技能包大小：${Math.ceil(skillZip.size / 1024)} KB` : '',
      ...demoVideoNote,
      '运行方式：Another Me 会解压 skill zip，并把解压出的 skill 内容与这里填写的文字描述一起接入对话。',
    ].filter(Boolean).join('\n\n');
    const skillZipBase64 = hasSkillZip ? await fileToBase64(skillZip) : '';
    const status = action === 'publish' ? 'published' : action === 'draft' ? 'draft' : 'testing';
    if (action === 'publish' && (!values.owner || !values.description)) {
      throw new Error('发布前请填写上传者和详细简介');
    }
    const agentName = String(values.name || '').trim() || '觅见AI';
    const profileMarkdown = buildLiveProfile();
    const payload = {
      name: agentName,
      owner: values.owner || (isDraft ? '未填写' : ''),
      tagline: values.tagline,
      description,
      skillPrompt: buildSavedProfilePrompt(profileMarkdown, hasSkillZip, skillZip.name),
      skillZipName: hasSkillZip ? skillZip.name : '',
      skillZipBase64,
      runtimeType: 'another-me-skill-runtime',
      chatUrl: `https://example.com/skill-agent/${encodeURIComponent(agentName || 'unnamed')}`,
      apiUrl: '',
      repoUrl: '',
      demoVideoUrl: '',
      eventName: '',
      category,
      status,
      mcpConfig: currentMcp,
    };
    const result = activeAgentId ? await updateAgent(activeAgentId, payload) : await publishAgent(payload);
    lastProfileMarkdown = profileMarkdown;
    selectAgent(result);
    syncCustomCategory();
    await loadAgents();
    const verb = action === 'publish' ? '已发布' : action === 'draft' ? '已存为草稿' : '已更新';
    setStatus(statusNode, `${verb} ${result.name}，画像已同步。可以在中间对话框继续测试，发现问题后再更新。`, 'ok');
    setStatus(chatStatusNode, `画像已同步，当前测试对象：${result.name}`, 'ok');
  } catch (error) {
    setStatus(statusNode, `操作失败：${error.message}`, 'error');
  } finally {
    actionButtons.forEach((button) => { button.disabled = false; });
  }
});

document.querySelector('#mcpForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  currentMcp = {
    name: String(values.mcpName || '').trim(),
    endpoint: String(values.mcpEndpoint || '').trim(),
    purpose: String(values.mcpPurpose || '').trim(),
  };
  const hasMcp = currentMcp.name || currentMcp.endpoint || currentMcp.purpose;
  if (!hasMcp) currentMcp = null;
  localStorage.setItem('another-me-current-mcp', JSON.stringify(currentMcp));
  setStatus(mcpStatusNode, currentMcp ? 'MCP 配置已暂存，会随当前 Agent 一起保存。' : '未配置 MCP，不影响 Agent 使用。', 'ok');
  event.currentTarget.reset();
});

avatarForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  avatarSubmitButton.disabled = true;
  setStatus(avatarStatusNode, '正在生成并发布你的化身 Agent...');
  try {
    const values = Object.fromEntries(new FormData(avatarForm).entries());
    const name = `${values.personName} 的化身 Agent`;
    const description = [
      `身份：${values.role}`,
      `擅长能力：${values.skills}`,
      `性格与表达风格：${values.personality}`,
      values.homepageUrl ? `个人主页：${values.homepageUrl}` : '',
      buildQuestionnaireProfile(values),
    ].filter(Boolean).join('\n\n');
    const personaSkill = distillPersonaSkill(values, description);
    const runtime = await createAvatarRuntime(personaSkill);
    const result = await publishAgent({
      name,
      owner: values.personName,
      tagline: `${values.role} 的个人化身`,
      description,
      skillPrompt: personaSkill,
      runtimeType: 'another-me-persona-runtime',
      chatUrl: runtime.chatUrl || `https://example.com/avatar-agent/${encodeURIComponent(values.personName)}`,
      apiUrl: runtime.apiUrl,
      repoUrl: '',
      demoVideoUrl: '',
      eventName: 'Avatar Agent Builder',
      category: '个人化身',
    });
    avatarForm.reset();
    questionnairePanel.hidden = true;
    questionnaireToggle.setAttribute('aria-expanded', 'false');
    questionnaireToggle.textContent = '填写精准化问卷';
    setStatus(avatarStatusNode, `已生成 ${result.name} 的 persona skill。LLM API 接入位置已预留。`, 'ok');
  } catch (error) {
    setStatus(avatarStatusNode, `生成失败：${error.message}`, 'error');
  } finally {
    avatarSubmitButton.disabled = false;
  }
});

renderHistory();
renderMessages();
openModule('skill');
initializeAgents();
