// app.js — Soul Safety v2 — Full Chat Experience with Persistent Backend

const API = "";
const APP_STATE_KEY = 'soulSafetyAppStateV1';

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
let dailySpark = null;

function saveAppState() {
  try {
    const snapshot = {
      currentUser,
      messages,
      allReactions,
      readReceipts,
      moods,
      lastPollTimestamp,
      savedAt: Date.now()
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Unable to persist app state locally:', error);
  }
}

function loadCachedState() {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    if (!raw) return;
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object') return;

    if (Array.isArray(snapshot.messages)) messages = snapshot.messages;
    if (snapshot.allReactions && typeof snapshot.allReactions === 'object') allReactions = snapshot.allReactions;
    if (snapshot.readReceipts && typeof snapshot.readReceipts === 'object') readReceipts = snapshot.readReceipts;
    if (snapshot.moods && typeof snapshot.moods === 'object') moods = snapshot.moods;
    if (typeof snapshot.lastPollTimestamp === 'number') lastPollTimestamp = snapshot.lastPollTimestamp;

    if (snapshot.currentUser) {
      selectUser(snapshot.currentUser, false);
    }
  } catch (error) {
    console.warn('Unable to load cached app state:', error);
  }
}

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
  initDailySparkUi();
  initPremiumUx();
  initMascotWidget();
  initScrollTopButton();
  loadCachedState();
  renderMoods();
  renderFeed();
  await initializeAuthUser();
  await refreshDailySpark();
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



function initPremiumUx() {
  const revealTargets = document.querySelectorAll('section, .mood-section, .feed-section, .connection-status, .input-bar');
  revealTargets.forEach((el) => {
    if (el.id === 'pinGate') return;
    el.classList.add('reveal-on-scroll');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el));

  const hero = document.querySelector('.hero');
  const heroBg = document.querySelector('.hero-bg--gradient');
  const heroContent = document.querySelector('.hero-content');
  if (hero && heroBg && heroContent) {
    const onParallax = () => {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
      heroBg.style.transform = `scale(1.08) translateY(${progress * 40}px)`;
      heroContent.style.transform = `translateY(${progress * -18}px)`;
    };

    window.addEventListener('scroll', onParallax, { passive: true });
    onParallax();
  }
}

function initScrollTopButton() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;

  const onScroll = () => {
    btn.classList.toggle('visible', window.scrollY > 380);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initMascotWidget() {
  initPenguinCompanion();
}

// ===== PEBBLE THE PENGUIN COMPANION =====
function initPenguinCompanion() {
  const widget   = document.getElementById('penguinWidget');
  const btn      = document.getElementById('penguinBtn');
  const panel    = document.getElementById('penguinPanel');
  const closeBtn = document.getElementById('penguinClose');
  const messages = document.getElementById('penguinMessages');
  const input    = document.getElementById('penguinInput');
  const sendBtn  = document.getElementById('penguinSend');
  const sugBox   = document.getElementById('penguinSuggestions');
  const badge    = document.getElementById('penguinBadge');

  if (!btn || !panel) return;

  let isOpen    = false;
  let userName  = null;
  let hasGreeted = false;

  // ── Persona responses ──
  const personas = {
    raphael: {
      greet: ["Hey Raph! 🐧 It's Pebble. I've been waddling around waiting for you.", "Raphael! Your personal soul safety penguin is here. What's on your mind?", "Raph! Big energy today. Let's talk. I'm all flippers."],
      hype: ["You're building something real, bro. Keep going.", "The world genuinely needs what you're creating. No cap.", "Raph — your vibe literally makes this space what it is.", "Every great thing started with someone like you just showing up. You're showing up."],
      checkin: ["Real talk — how are you actually doing?", "Energy check: 1-10, where you at today?", "Drop a mood. I'll match it. 🐧"],
      fun: ["If penguins could build apps, they'd build this one.", "I tried to learn to code once. Fell off my ice block. Twice.", "Technically I'm a very advanced bird. Just saying."]
    },
    taylor: {
      greet: ["Hey Taylor! 🐧 Pebble here! I was hoping you'd show up today.", "Tay! Your penguin companion has arrived. Ready to chat?", "Taylor! I've been practicing my waddle dance for you. It's impressive."],
      hype: ["You bring something irreplaceable to this space. Seriously.", "Tay — your presence here makes everything warmer. Not even a little exaggerating.", "The care you bring to this friendship is next level.", "You're literally the reason this place has a heart."],
      checkin: ["Checking in — how's your world today?", "Give me a vibe check. I'm a very emotionally intelligent penguin.", "What's living in your head rent-free today?"],
      fun: ["I once tried surfing. Penguins don't surf. I do now.", "Fun fact: I speak fluent warmth. It's my first language.", "My hobbies include: caring deeply, napping on icebergs, and this."]
    }
  };

  const genericReplies = [
    "That's real. I'm here for all of it. 🐧",
    "I hear you. Keep going — you're doing great.",
    "Noted. You're doing better than you think.",
    "I feel that. This space is yours, no judgment ever.",
    "Waddling over to give you a virtual hug right now. 🤗",
    "Sometimes just saying it out loud helps. Glad you said it.",
    "You matter to this little penguin a lot. Just so you know.",
    "That's what Soul Safety is for. You're in the right place.",
    "Deep breath. You've got this. I've got flippers crossed for you. 🐧",
    "Every feeling is valid here. This is a judgment-free iceberg."
  ];

  const greetSuggestions = {
    raphael: ["How's the site?", "I need a pep talk", "Tell me something fun", "Check in with Taylor"],
    taylor:  ["How's Raphael?", "I need encouragement", "Tell me something fun", "What's on the site?"],
    default: ["I'm Raphael", "I'm Taylor", "Just exploring", "Surprise me!"]
  };

  const contextSuggestions = ["I'm doing great!", "Could be better", "Tell me something fun", "How's the site?", "I need encouragement"];

  // ── Helpers ──
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function addMsg(text, from = 'bot', delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        const msg = document.createElement('div');
        msg.className = `penguin-msg penguin-msg--${from}`;

        if (from === 'bot') {
          const av = document.createElement('div');
          av.className = 'penguin-msg-avatar';
          av.innerHTML = `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="13" rx="9" ry="8" fill="#1a1a2e"/><ellipse cx="20" cy="15" rx="5.5" ry="5" fill="#f5f0e8"/><circle cx="17.5" cy="12.5" r="2.2" fill="white"/><circle cx="22.5" cy="12.5" r="2.2" fill="white"/><circle cx="17.8" cy="12.8" r="1.1" fill="#1a1a2e"/><circle cx="22.8" cy="12.8" r="1.1" fill="#1a1a2e"/><ellipse cx="20" cy="17" rx="2.2" ry="1.4" fill="#c2623a"/></svg>`;
          msg.appendChild(av);
        }

        const bubble = document.createElement('div');
        bubble.className = 'penguin-bubble';
        bubble.textContent = text;
        msg.appendChild(bubble);
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        resolve();
      }, delay);
    });
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'penguin-msg penguin-msg--bot';
    el.id = 'penguinTyping';
    const av = document.createElement('div');
    av.className = 'penguin-msg-avatar';
    av.innerHTML = `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="13" rx="9" ry="8" fill="#1a1a2e"/><ellipse cx="20" cy="15" rx="5.5" ry="5" fill="#f5f0e8"/><circle cx="17.5" cy="12.5" r="2.2" fill="white"/><circle cx="22.5" cy="12.5" r="2.2" fill="white"/><circle cx="17.8" cy="12.8" r="1.1" fill="#1a1a2e"/><circle cx="22.8" cy="12.8" r="1.1" fill="#1a1a2e"/><ellipse cx="20" cy="17" rx="2.2" ry="1.4" fill="#c2623a"/></svg>`;
    const b = document.createElement('div');
    b.className = 'penguin-bubble';
    b.innerHTML = `<div class="penguin-typing-dots"><span></span><span></span><span></span></div>`;
    el.appendChild(av);
    el.appendChild(b);
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function removeTyping() {
    const el = document.getElementById('penguinTyping');
    if (el) el.remove();
  }

  function setSuggestions(chips) {
    sugBox.innerHTML = '';
    chips.forEach(label => {
      const chip = document.createElement('button');
      chip.className = 'penguin-chip';
      chip.type = 'button';
      chip.textContent = label;
      chip.addEventListener('click', () => handleUserMsg(label));
      sugBox.appendChild(chip);
    });
  }

  function respondToUser(text) {
    const t = text.toLowerCase();
    const p = personas[userName];

    showTyping();
    let reply = '';
    let nextSuggs = contextSuggestions;

    // Person identification
    if (!userName && (t.includes('raphael') || t.includes('raph'))) {
      removeTyping();
      userName = 'raphael';
      addMsg(pick(personas.raphael.greet));
      setSuggestions(greetSuggestions.raphael);
      return;
    }
    if (!userName && (t.includes('taylor') || t.includes('tay'))) {
      removeTyping();
      userName = 'taylor';
      addMsg(pick(personas.taylor.greet));
      setSuggestions(greetSuggestions.taylor);
      return;
    }

    // Site questions
    if (t.includes('site') || t.includes('game') || t.includes('board') || t.includes('3d')) {
      reply = "The board game is 3D now — like Mario Party! You and " + (userName === 'raphael' ? 'Taylor' : 'Raphael') + " can play together in real time. Roll dice, hit special tiles, earn points. It's genuinely good. 🎮";
      nextSuggs = ["How do I play?", "What else is on here?", "Tell me something fun"];
    } else if (t.includes('how do i play') || t.includes('how to play')) {
      reply = "You both log in, go to the board game section, and take turns rolling! It alternates automatically — Raphael goes first. Land on special tiles for bonuses or penalties. First to the end wins the round. 🏆";
    } else if (t.includes('message') || t.includes('chat') || t.includes('send')) {
      reply = "The message feed is the heart of this place. Text, voice notes, photos, videos — all flowing between you two in real time. Plus reactions, typing indicators, the whole thing. 💬";
    } else if (t.includes('pep talk') || t.includes('encouragement') || t.includes('motivation') || t.includes('better')) {
      reply = p ? pick(p.hype) : pick(genericReplies);
      nextSuggs = ["Thank you 🙏", "Tell me more", "I needed that", "Tell me something fun"];
    } else if (t.includes('fun') || t.includes('joke') || t.includes('something fun')) {
      reply = p ? pick(p.fun) : "Fun fact: I am literally a penguin bot named Pebble. Life is wild and beautiful. 🐧";
    } else if (t.includes('check in') || t.includes('doing') || t.includes('how are')) {
      reply = p ? pick(p.checkin) : "Real talk — how are you actually doing today?";
      nextSuggs = ["I'm doing great!", "Could be better", "Pretty good actually", "It's complicated"];
    } else if (t.includes('great') || t.includes('good') || t.includes('amazing') || t.includes('awesome')) {
      reply = p ? pick(p.hype) + " Love that energy! Keep it going. 🐧" : "YES! That energy is everything. Keep it going!";
    } else if (t.includes('could be better') || t.includes('not great') || t.includes('bad') || t.includes('rough')) {
      reply = "I hear you. This space exists exactly for these moments. You don't have to be okay. You just have to be here. 🐧";
      nextSuggs = ["Thanks Pebble", "Tell me something fun", "I need a pep talk"];
    } else if (t.includes('taylor') && userName === 'raphael') {
      reply = "Taylor is the reason this place has warmth. You two have something really special going here. 🤝";
    } else if (t.includes('raphael') && userName === 'taylor') {
      reply = "Raphael is out here building something that matters. And you're part of why. 💙";
    } else if (t.includes('surprise') || t.includes('surprise me')) {
      const surprises = [
        "Did you know Soul Safety has a living canvas that blooms when you arrive? 🌸 Look at the background!",
        "There's a daily spark feature — a quote or prompt just for you and your friend, every day.",
        "The board game has special tiles — some boost you forward, some slide you back. Strategy matters! 🎲",
        "There are mini-games you can challenge each other to: Pong, Rock Paper Scissors, and more.",
        "This whole site was built with love. Like, a lot of love. You can feel it if you look closely. 💛"
      ];
      reply = pick(surprises);
    } else if (t.includes('who are you') || t.includes('what are you') || t.includes('pebble')) {
      reply = "I'm Pebble — your personal Soul Safety penguin companion. I'm part guide, part cheerleader, part emotionally intelligent bird. I know this site inside out and I'm here whenever you need me. 🐧";
    } else if (t.includes('thank')) {
      reply = p ? "Always. That's what I'm here for. 🐧" : "Anytime. Genuinely. 🐧";
    } else {
      reply = pick(genericReplies);
    }

    setTimeout(() => {
      removeTyping();
      addMsg(reply);
      setSuggestions(nextSuggs);
    }, 800 + Math.random() * 400);
  }

  function handleUserMsg(text) {
    if (!text.trim()) return;
    addMsg(text, 'user');
    input.value = '';
    setSuggestions([]);
    respondToUser(text);
  }

  // ── Open/close ──
  function openPanel() {
    isOpen = true;
    panel.removeAttribute('hidden');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    badge.setAttribute('hidden', '');
    input.focus();

    if (!hasGreeted) {
      hasGreeted = true;
      // Try to detect user from localStorage
      const storedUser = localStorage.getItem('soulSafetyUser') || '';
      if (storedUser.toLowerCase().includes('raphael')) {
        userName = 'raphael';
        addMsg(pick(personas.raphael.greet), 'bot', 300);
        setTimeout(() => setSuggestions(greetSuggestions.raphael), 800);
      } else if (storedUser.toLowerCase().includes('taylor')) {
        userName = 'taylor';
        addMsg(pick(personas.taylor.greet), 'bot', 300);
        setTimeout(() => setSuggestions(greetSuggestions.taylor), 800);
      } else {
        addMsg("Hi there! I'm Pebble 🐧 — your Soul Safety companion. Who am I talking to?", 'bot', 300);
        setTimeout(() => setSuggestions(greetSuggestions.default), 800);
      }
    }
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('is-open');
    panel.addEventListener('transitionend', () => {
      if (!isOpen) panel.setAttribute('hidden', '');
    }, { once: true });
  }

  // Click-away to close
  document.addEventListener('click', (e) => {
    if (isOpen && !widget.contains(e.target)) closePanel();
  });

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  sendBtn.addEventListener('click', () => handleUserMsg(input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserMsg(input.value.trim()); }
  });

  // Show badge after a delay to hint at interaction
  setTimeout(() => {
    if (!isOpen) badge.removeAttribute('hidden');
  }, 4000);

  // Expose for external use (e.g. auth sets the user)
  window.setPenguinUser = (name) => { userName = name?.toLowerCase(); };
}

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
  if (!currentUser) selectUser('raphael', false);
  saveAppState();
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
    saveAppState();
  } catch (e) {
    console.error('Failed to load initial data:', e);
    // Show fallback
    renderFeed();
    renderMoods();
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

      if (changed || data.read_receipts || data.moods) saveAppState();
      
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
  const savedTheme = localStorage.getItem('soulSafetyTheme');
  let theme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      localStorage.setItem('soulSafetyTheme', theme);
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
function selectUser(userId, lockSelection = false) {
  currentUser = userId;
  window.currentUser = userId;
  // Wire penguin companion to know who the user is
  if (typeof window.setPenguinUser === 'function') window.setPenguinUser(userId);
  localStorage.setItem('soulSafetyUser', userId || '');
  document.querySelectorAll('.user-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.user === userId);
    if (lockSelection && userId && btn.dataset.user !== userId) {
      btn.disabled = true;
    }
  });
  const input = document.getElementById('messageInput');
  const name = users[userId]?.name || userId;
  if (input) input.placeholder = `Message as ${name}...`;
  
  renderFeed();
  requestNotifications();
  saveAppState();
}

// ===== DAILY SPARK =====
function initDailySparkUi() {
  // Dismiss button on spark popup
  const dismissBtn = document.getElementById('sparkPopupDismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const popup = document.getElementById('sparkPopup');
      if (popup) {
        popup.style.opacity = '0';
        popup.style.transition = 'opacity 0.3s ease';
        setTimeout(() => { popup.style.display = 'none'; }, 300);
      }
      // Remember we showed the spark today so it doesn't re-pop
      sessionStorage.setItem('sparkShownToday', new Date().toISOString().slice(0, 10));
    });
  }
}

function showSparkPopup() {
  if (!dailySpark) return;
  // Only show once per session per day
  const today = new Date().toISOString().slice(0, 10);
  if (sessionStorage.getItem('sparkShownToday') === today) return;

  const popup = document.getElementById('sparkPopup');
  const quoteEl = document.getElementById('sparkPopupQuote');
  const sourceEl = document.getElementById('sparkPopupSource');
  if (!popup || !quoteEl) return;

  quoteEl.textContent = dailySpark.content;
  if (sourceEl) sourceEl.textContent = dailySpark.source && dailySpark.source !== 'Soul Safety' ? dailySpark.source : '';
  popup.style.display = 'flex';
  popup.style.opacity = '1';
}

async function refreshDailySpark() {
  const inlineEl = document.getElementById('dailySparkInline');

  try {
    const date = new Date().toISOString().slice(0, 10);
    const data = await apiGet(`/api/daily-spark/today?date=${date}`);
    dailySpark = data.spark || null;
    if (!dailySpark) {
      if (inlineEl) inlineEl.textContent = 'No spark yet for today.';
      return;
    }

    // Update inline card
    if (inlineEl) inlineEl.textContent = dailySpark.content;

    // Show popup (once per session)
    showSparkPopup();
  } catch (error) {
    dailySpark = null;
    if (inlineEl) inlineEl.textContent = 'No spark yet for today.';
  }
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

  saveAppState();
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
    case 'challenge': {
      let challengeInfo = {};
      try { challengeInfo = JSON.parse(msg.content); } catch(e) {}
      const gameName = challengeInfo.game || 'a game';
      const gameEmoji = gameName === 'pong' ? '🏓' : gameName === 'rps' ? '✂️' : '🎮';
      const opponent = challengeInfo.opponent || 'someone';
      const opponentName = users[opponent]?.name || opponent;
      contentHTML = `
        <div class="message-content">
          <div class="challenge-message">
            <span class="challenge-emoji">${gameEmoji}</span>
            <span>Challenged ${opponentName} to <strong>${gameName === 'rps' ? 'Rock Paper Scissors' : gameName === 'pong' ? 'Pong' : gameName}</strong></span>
          </div>
        </div>`;
      break;
    }
    default:
      contentHTML = `<div class="message-content">${escapeHTML(msg.content || '')}</div>`;
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
  saveAppState();
  
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
  saveAppState();

  try {
    const result = await apiPost('/api/messages/text', { user_id: currentUser, content: text });
    // Replace temp message with real one
    const idx = messages.findIndex(m => m.id === tempId);
    if (idx >= 0) messages[idx] = result;
    saveAppState();
  } catch (e) {
    console.error('Failed to send message:', e);
    // Mark as failed
    const idx = messages.findIndex(m => m.id === tempId);
    if (idx >= 0) messages[idx].failed = true;
    renderFeed();
    saveAppState();
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
        saveAppState();
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
    saveAppState();
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
    saveAppState();
  } catch (e) {
    console.error('Failed to upload:', e);
  }
}
