// app.js — Soul Safety v2 — Full Chat Experience with Persistent Backend

const API = "";

function authHeaders(extra = {}) {
  const AUTH_TOKEN = window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken') || '';
  return AUTH_TOKEN ? { ...extra, Authorization: `Bearer ${AUTH_TOKEN}` } : extra;
}

// ===== STATE =====
let currentUser = null;
let messages = [];
let allReactions = {};
let readReceipts = {};
let moods = {};
let typingUsers = [];
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let lastPollTimestamp = 0;
let pollInterval = null;
let typingTimeout = null;
let reactionPickerMsgId = null;

const users = {
  raphael: { name: 'Raphael', avatar: '🌻', colorClass: 'raphael' },
  taylor: { name: 'Taylor', avatar: '🌿', colorClass: 'taylor' }
};

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '💜', '🙌', '✨', '🥺', '🪩'];

// ===== INITIALIZATION =====
function hasAuthToken() {
  return Boolean(window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken'));
}

async function bootApp() {
  initThemeToggle();
  initSparkles();
  initDragDrop();
  initInputListener();
  await initializeAuthUser();
  loadInitialData();
  startPolling();

  // Close reaction picker on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.reaction-picker') && !e.target.closest('.react-btn')) {
      closeReactionPicker();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (hasAuthToken()) {
    await bootApp();
    return;
  }

  window.addEventListener('soulSafetyUnlocked', async () => {
    await bootApp();
  }, { once: true });
});

// ===== API HELPERS =====
async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPostForm(path, formData) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: authHeaders(), credentials: 'include', body: formData });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function initializeAuthUser() {
  try {
    const auth = await apiGet('/api/auth/me');
    if (auth?.user_id) {
      selectUser(auth.user_id, true);
      return;
    }
  } catch (e) {
    // Fallback for bearer-token-only environments
  }
  if (!currentUser) selectUser('raphael', true);
}

// ===== LOAD INITIAL DATA =====
async function loadInitialData() {
  try {
    const data = await apiGet('/api/poll?since=0');
    messages = data.messages || [];
    allReactions = {};
    (data.reactions || []).forEach(r => {
      if (!allReactions[r.message_id]) allReactions[r.message_id] = [];
      allReactions[r.message_id].push({ user_id: r.user_id, emoji: r.emoji });
    });
    readReceipts = data.read_receipts || {};
    moods = data.moods || {};
    typingUsers = data.typing || [];
    lastPollTimestamp = data.server_time || 0;
    
    renderFeed();
    renderMoods();
    scrollToBottom();
    markAsRead();
  } catch (e) {
    console.error('Failed to load initial data:', e);
    // Show fallback
    renderFeed();
  }
}

// ===== POLLING =====
function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const data = await apiGet(`/api/poll?since=${lastPollTimestamp}`);
      let changed = false;
      
      // New messages
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
          if (!messages.find(m => m.id === msg.id)) {
            messages.push(msg);
            changed = true;
            
            // Browser notification for other user's messages
            if (msg.user_id !== currentUser && document.hidden) {
              showNotification(msg);
            }
          }
        });
      }
      
      // New reactions
      if (data.reactions && data.reactions.length > 0) {
        data.reactions.forEach(r => {
          if (!allReactions[r.message_id]) allReactions[r.message_id] = [];
          const existing = allReactions[r.message_id].find(
            x => x.user_id === r.user_id && x.emoji === r.emoji
          );
          if (!existing) {
            allReactions[r.message_id].push({ user_id: r.user_id, emoji: r.emoji });
            changed = true;
          }
        });
      }
      
      // Typing
      const newTyping = data.typing || [];
      if (JSON.stringify(newTyping) !== JSON.stringify(typingUsers)) {
        typingUsers = newTyping;
        renderTypingIndicator();
      }
      
      // Read receipts
      if (data.read_receipts) {
        readReceipts = data.read_receipts;
      }
      
      // Moods
      if (data.moods && JSON.stringify(data.moods) !== JSON.stringify(moods)) {
        moods = data.moods;
        renderMoods();
      }
      
      if (changed) {
        const wasAtBottom = isScrolledToBottom();
        renderFeed();
        if (wasAtBottom) scrollToBottom();
        markAsRead();
      }
      
      lastPollTimestamp = data.server_time || lastPollTimestamp;
    } catch (e) {
      // Silent polling failure
    }
  }, 1500);
}

function isScrolledToBottom() {
  const container = document.getElementById('feedContainer');
  if (!container) return true;
  return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
}

// ===== NOTIFICATIONS =====
function showNotification(msg) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const user = users[msg.user_id];
    const body = msg.type === 'text' ? msg.content : `Sent a ${msg.type}`;
    new Notification(`${user?.name || msg.user_id} on Soul Safety`, {
      body: body.substring(0, 100),
      icon: '🌻'
    });
  }
}

function requestNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ===== THEME TOGGLE =====
function initThemeToggle() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      toggle.innerHTML = theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    });
  }
}

// ===== SPARKLE PARTICLES =====
function initSparkles() {
  const container = document.getElementById('sparkles');
  if (!container) return;
  const colors = ['var(--color-amber)', 'var(--color-disco)', 'var(--color-primary)', 'var(--color-sage)'];
  for (let i = 0; i < 20; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = Math.random() * 100 + '%';
    sparkle.style.top = Math.random() * 100 + '%';
    sparkle.style.width = (2 + Math.random() * 4) + 'px';
    sparkle.style.height = sparkle.style.width;
    sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
    sparkle.style.animationDelay = (Math.random() * 5) + 's';
    sparkle.style.animationDuration = (2 + Math.random() * 4) + 's';
    container.appendChild(sparkle);
  }
}

// ===== USER SELECTOR =====
function selectUser(userId, allowUnknown = false) {
  if (!allowUnknown && currentUser && currentUser !== userId) return;
  currentUser = userId;
  document.querySelectorAll('.user-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.user === userId);
    if (allowUnknown && userId && btn.dataset.user !== userId) {
      btn.disabled = true;
    }
  });
  const input = document.getElementById('messageInput');
  const name = users[userId]?.name || userId;
  if (input) input.placeholder = `Message as ${name}...`;
  
  renderFeed();
  requestNotifications();
}

// ===== MOOD / VIBE CHECK =====
async function setMood(userId, emoji, text) {
  // Update local immediately
  moods[userId] = { emoji, text };
  renderMoods();
  
  // Persist to backend
  try {
    await apiPost('/api/mood', { user_id: userId, emoji, text });
  } catch (e) {
    console.error('Failed to save mood:', e);
  }
}

function renderMoods() {
  ['raphael', 'taylor'].forEach(uid => {
    const mood = moods[uid];
    if (!mood) return;
    const statusEl = document.getElementById(uid === 'raphael' ? 'moodStatusRaphael' : 'moodStatusTaylor');
    if (statusEl) {
      statusEl.textContent = `${mood.text} ${mood.emoji}`;
      statusEl.style.transition = 'transform 200ms cubic-bezier(0.16,1,0.3,1)';
      statusEl.style.transform = 'scale(1.05)';
      setTimeout(() => { statusEl.style.transform = 'scale(1)'; }, 200);
    }
    const picker = document.querySelector(`[data-mood-for="${uid}"]`);
    if (picker) {
      picker.querySelectorAll('.mood-emoji-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.textContent.trim() === mood.emoji);
      });
    }
  });
}

// ===== MESSAGE FEED =====
function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function renderFeed() {
  const container = document.getElementById('feedContainer');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-feed">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <p>No messages yet. Start the conversation!</p>
      </div>`;
    return;
  }

  container.innerHTML = messages.map((msg, i) => renderMessage(msg, i)).join('');
}

function renderMessage(msg, index) {
  const user = users[msg.user_id] || { name: msg.user_id, avatar: '👤', colorClass: '' };
  const isOwn = msg.user_id === currentUser;
  const ownClass = isOwn ? 'own' : '';

  let contentHTML = '';
  switch (msg.type) {
    case 'text':
      contentHTML = `<div class="message-content">${escapeHTML(msg.content)}</div>`;
      break;
    case 'voice':
      const mediaUrl = `${API}/api/messages/${msg.id}/media`;
      contentHTML = `
        <div class="message-content">
          <div class="voice-note">
            <button class="voice-play-btn" onclick="playAudio(this, '${msg.id}')" aria-label="Play voice note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <div class="voice-waveform" id="waveform-${msg.id}">${generateWaveformBars()}</div>
            <span class="voice-duration">${msg.duration || '0:05'}</span>
          </div>
          <audio id="audio-${msg.id}" src="${mediaUrl}" preload="metadata"></audio>
        </div>`;
      break;
    case 'photo':
      contentHTML = `
        <div class="message-content">
          <div class="media-card">
            <img src="${API}/api/messages/${msg.id}/media" alt="Shared photo" loading="lazy">
          </div>
        </div>`;
      break;
    case 'video':
      contentHTML = `
        <div class="message-content">
          <div class="media-card">
            <video controls preload="metadata" playsinline>
              <source src="${API}/api/messages/${msg.id}/media">
            </video>
          </div>
        </div>`;
      break;
  }

  // Reactions for this message
  const msgReactions = allReactions[msg.id] || [];
  const reactionHTML = renderReactions(msg.id, msgReactions);
  
  // Read receipt (show on last own message only)
  let readHTML = '';
  const otherUser = currentUser === 'raphael' ? 'taylor' : 'raphael';
  if (isOwn && readReceipts[otherUser] === msg.id) {
    readHTML = `<div class="read-receipt">✓ Seen by ${users[otherUser].name}</div>`;
  }

  return `
    <div class="message-card ${ownClass}" data-user="${msg.user_id}" data-id="${msg.id}" style="animation-delay: ${Math.min(index * 30, 300)}ms">
      <div class="message-avatar ${user.colorClass}">${user.avatar}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-name ${user.colorClass}">${user.name}</span>
          <span class="message-time">${formatTime(msg.timestamp)}</span>
        </div>
        ${contentHTML}
        <div class="message-footer">
          ${reactionHTML}
          <button class="react-btn" onclick="toggleReactionPicker('${msg.id}')" title="Add reaction">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>
        </div>
        ${readHTML}
      </div>
    </div>`;
}

function renderReactions(messageId, reactions) {
  if (!reactions || reactions.length === 0) return '';
  
  // Group by emoji
  const groups = {};
  reactions.forEach(r => {
    if (!groups[r.emoji]) groups[r.emoji] = [];
    groups[r.emoji].push(r.user_id);
  });
  
  let html = '<div class="reactions-bar">';
  Object.entries(groups).forEach(([emoji, userIds]) => {
    const isMine = userIds.includes(currentUser);
    html += `<button class="reaction-chip ${isMine ? 'mine' : ''}" onclick="toggleReaction('${messageId}', '${emoji}')">
      ${emoji} <span class="reaction-count">${userIds.length}</span>
    </button>`;
  });
  html += '</div>';
  return html;
}

function toggleReactionPicker(msgId) {
  // Close any existing
  closeReactionPicker();
  
  const msgEl = document.querySelector(`[data-id="${msgId}"]`);
  if (!msgEl) return;
  
  reactionPickerMsgId = msgId;
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.id = 'reactionPicker';
  picker.innerHTML = REACTION_EMOJIS.map(e => 
    `<button class="reaction-picker-btn" onclick="toggleReaction('${msgId}', '${e}')">${e}</button>`
  ).join('');
  
  const footer = msgEl.querySelector('.message-footer');
  if (footer) footer.appendChild(picker);
  
  requestAnimationFrame(() => picker.classList.add('visible'));
}

function closeReactionPicker() {
  const existing = document.getElementById('reactionPicker');
  if (existing) existing.remove();
  reactionPickerMsgId = null;
}

async function toggleReaction(messageId, emoji) {
  closeReactionPicker();
  
  // Optimistic local update
  if (!allReactions[messageId]) allReactions[messageId] = [];
  const existing = allReactions[messageId].findIndex(
    r => r.user_id === currentUser && r.emoji === emoji
  );
  if (existing >= 0) {
    allReactions[messageId].splice(existing, 1);
  } else {
    allReactions[messageId].push({ user_id: currentUser, emoji });
  }
  renderFeed();
  
  // Send to backend
  try {
    await apiPost(`/api/reactions/${messageId}`, { user_id: currentUser, emoji });
  } catch (e) {
    console.error('Failed to toggle reaction:', e);
  }
}

function generateWaveformBars() {
  let bars = '';
  for (let i = 0; i < 30; i++) {
    const height = 4 + Math.random() * 24;
    bars += `<div class="voice-bar" style="height:${height}px"></div>`;
  }
  return bars;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== TYPING INDICATOR =====
function renderTypingIndicator() {
  let indicator = document.getElementById('typingIndicator');
  const otherTyping = typingUsers.filter(u => u !== currentUser);
  
  if (otherTyping.length === 0) {
    if (indicator) indicator.classList.remove('visible');
    return;
  }
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'typing-indicator';
    const feed = document.getElementById('feedContainer');
    if (feed) feed.parentNode.insertBefore(indicator, feed.nextSibling);
  }
  
  const names = otherTyping.map(u => users[u]?.name || u).join(' and ');
  indicator.innerHTML = `
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
    <span>${names} is typing...</span>
  `;
  indicator.classList.add('visible');
}

async function sendTypingStatus(isTyping) {
  try {
    await apiPost('/api/typing', { user_id: currentUser, is_typing: isTyping });
  } catch (e) {}
}

// ===== READ RECEIPTS =====
async function markAsRead() {
  if (messages.length === 0) return;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.user_id !== currentUser) {
    try {
      await apiPost('/api/read', { user_id: currentUser, last_read_message_id: lastMsg.id });
    } catch (e) {}
  }
}

// ===== SEND MESSAGE =====
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;

  // Clear typing
  sendTypingStatus(false);
  
  // Optimistic update
  const tempId = 'temp-' + Date.now();
  const tempMsg = { id: tempId, user_id: currentUser, type: 'text', content: text, timestamp: Date.now() / 1000 };
  messages.push(tempMsg);
  
  input.value = '';
  autoResize(input);
  updateSendButton();
  renderFeed();
  scrollToBottom();

  try {
    const result = await apiPost('/api/messages/text', { user_id: currentUser, content: text });
    // Replace temp message with real one
    const idx = messages.findIndex(m => m.id === tempId);
    if (idx >= 0) messages[idx] = result;
  } catch (e) {
    console.error('Failed to send message:', e);
    // Mark as failed
    const idx = messages.findIndex(m => m.id === tempId);
    if (idx >= 0) messages[idx].failed = true;
    renderFeed();
  }
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  updateSendButton();
}

function initInputListener() {
  const input = document.getElementById('messageInput');
  if (input) {
    input.addEventListener('input', () => {
      updateSendButton();
      
      // Typing indicator
      sendTypingStatus(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => sendTypingStatus(false), 3000);
    });
  }
}

function updateSendButton() {
  const input = document.getElementById('messageInput');
  const btn = document.getElementById('sendBtn');
  if (input && btn) btn.disabled = !input.value.trim();
}

function scrollToBottom() {
  const container = document.getElementById('feedContainer');
  if (container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

// ===== VOICE RECORDING =====
async function toggleRecording() {
  if (isRecording) stopRecording();
  else startRecording();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const duration = Math.round((Date.now() - recordingStartTime) / 1000);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      
      // Upload to backend
      const formData = new FormData();
      formData.append('user_id', currentUser);
      formData.append('media_type_name', 'voice');
      formData.append('duration', durationStr);
      formData.append('file', audioBlob, 'voice.webm');
      
      try {
        const result = await apiPostForm('/api/messages/media', formData);
        messages.push(result);
        renderFeed();
        scrollToBottom();
      } catch (e) {
        console.error('Failed to upload voice note:', e);
      }
      
      stream.getTracks().forEach(t => t.stop());
    };
    
    recordingStartTime = Date.now();
    mediaRecorder.start();
    isRecording = true;
    
    const btn = document.getElementById('voiceBtn');
    btn.classList.add('recording');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    document.getElementById('recordingIndicator').classList.add('active');
    
  } catch (err) {
    console.error('Microphone access denied:', err);
    alert('Please allow microphone access to record voice notes.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  isRecording = false;
  
  const btn = document.getElementById('voiceBtn');
  btn.classList.remove('recording');
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  document.getElementById('recordingIndicator').classList.remove('active');
}

// ===== AUDIO PLAYBACK =====
function playAudio(btn, msgId) {
  const audio = document.getElementById('audio-' + msgId);
  if (!audio) return;

  if (audio.paused) {
    audio.play();
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    const waveform = document.getElementById('waveform-' + msgId);
    if (waveform) {
      const bars = waveform.querySelectorAll('.voice-bar');
      let currentBar = 0;
      const interval = setInterval(() => {
        if (currentBar < bars.length) {
          bars[currentBar].classList.add('active');
          currentBar++;
        }
      }, (audio.duration * 1000) / bars.length || 100);

      audio.onended = () => {
        clearInterval(interval);
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        bars.forEach(b => b.classList.remove('active'));
      };
    }
  } else {
    audio.pause();
    audio.currentTime = 0;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }
}

// ===== FILE UPLOAD =====
async function handleFileUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('user_id', currentUser);
  formData.append('media_type_name', type);
  formData.append('file', file, file.name);
  
  try {
    const result = await apiPostForm('/api/messages/media', formData);
    messages.push(result);
    renderFeed();
    scrollToBottom();
  } catch (e) {
    console.error('Failed to upload file:', e);
    alert('Upload failed. The file might be too large.');
  }
  
  event.target.value = '';
}

// ===== DRAG & DROP =====
function initDragDrop() {
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    document.getElementById('dropZone').classList.add('active');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) document.getElementById('dropZone').classList.remove('active');
  });

  document.addEventListener('dragover', (e) => e.preventDefault());

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.getElementById('dropZone').classList.remove('active');
    
    Array.from(e.dataTransfer.files).forEach(file => {
      if (file.type.startsWith('image/')) uploadDroppedFile(file, 'photo');
      else if (file.type.startsWith('video/')) uploadDroppedFile(file, 'video');
    });
  });
}

async function uploadDroppedFile(file, type) {
  const formData = new FormData();
  formData.append('user_id', currentUser);
  formData.append('media_type_name', type);
  formData.append('file', file, file.name);
  
  try {
    const result = await apiPostForm('/api/messages/media', formData);
    messages.push(result);
    renderFeed();
    scrollToBottom();
  } catch (e) {
    console.error('Failed to upload:', e);
  }
}
