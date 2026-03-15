// game.js — Soul Safety Party Board Game
// Mario Party-style daily board game for Raphael & Taylor

const GAME_API = window.GAME_API || '';

// Auth header helper — reads token from app.js
function gameAuthHeaders(extra = {}) {
  const h = { ...extra };
  if (window.authToken) h['Authorization'] = `Bearer ${window.authToken}`;
  return h;
}

// ─── Characters ───────────────────────────────────────────────────────────────
const STARTER_CHARS = [
  { id: 'starmilk', emoji: '✨', name: 'Starmilk Guy', desc: 'dreamy cosmic character' },
  { id: 'skatergirl', emoji: '🛼', name: 'Skater Girl', desc: 'roller skating vibes' },
  { id: 'skaterboy', emoji: '🛹', name: 'Skater Boy', desc: 'skateboard cruiser' },
  { id: 'frogprince', emoji: '🐸', name: 'Frog Prince', desc: 'chill amphibian royalty' },
  { id: 'discoball', emoji: '🪩', name: 'Disco Ball', desc: 'sparkly party energy' },
  { id: 'cozycat', emoji: '🐱', name: 'Cozy Cat', desc: 'warm and fuzzy' },
  { id: 'naturespirit', emoji: '🌿', name: 'Nature Spirit', desc: 'forest wanderer' },
  { id: 'rockclimber', emoji: '🧗', name: 'Rock Climber', desc: 'adventurous and brave' },
  { id: 'yarnwitch', emoji: '🧶', name: 'Yarn Witch', desc: 'crafty magic maker' },
  { id: 'bunnyscout', emoji: '🐰', name: 'Bunny Scout', desc: 'curious explorer' },
  { id: 'snakecharmer', emoji: '🐍', name: 'Snake Charmer', desc: 'mysterious and cool' },
  { id: 'sunflowerkid', emoji: '🌻', name: 'Sunflower Kid', desc: 'bright and warm' }
];

const UNLOCKABLE_CHARS = [
  { id: 'mushroom', emoji: '🍄', name: 'Mushroom Sage', desc: 'wise fungal friend', cost: 20 },
  { id: 'butterfly', emoji: '🦋', name: 'Butterfly Queen', desc: 'graceful transformation', cost: 30 },
  { id: 'neonpenguin', emoji: '🐧', name: 'Neon Penguin', desc: 'cool under pressure', cost: 35 },
  { id: 'jellyfish', emoji: '🪼', name: 'Rainbow Jellyfish', desc: 'flowing with color', cost: 40 },
  { id: 'cloudsurfer', emoji: '☁️', name: 'Cloud Surfer', desc: 'riding the sky', cost: 45 },
  { id: 'moonwalker', emoji: '🌙', name: 'Moonwalker', desc: 'night time wanderer', cost: 50 },
  { id: 'thunderbear', emoji: '⚡', name: 'Thunder Bear', desc: 'electric energy', cost: 60 },
  { id: 'crystalfox', emoji: '💎', name: 'Crystal Fox', desc: 'sparkling and sly', cost: 75 },
  { id: 'cosmicowl', emoji: '🦉', name: 'Cosmic Owl', desc: 'all-seeing wisdom', cost: 90 },
  { id: 'goldenphoenix', emoji: '🔥', name: 'Golden Phoenix', desc: 'rise from the ashes', cost: 100 },
  { id: 'galaxycat', emoji: '🌌', name: 'Galaxy Cat', desc: 'cosmic feline', cost: 110 },
  { id: 'discodragon', emoji: '🐉', name: 'Disco Dragon', desc: 'legendary party beast', cost: 120 }
];

const ALL_CHARS = [...STARTER_CHARS, ...UNLOCKABLE_CHARS];

// ─── Space Types ──────────────────────────────────────────────────────────────
const SPACE_TYPES = [
  { type: 'mystery', emoji: '🎁', label: 'Mystery Box', color: '#c9922a' },
  { type: 'photo', emoji: '📸', label: 'Share Photo', color: '#c2623a' },
  { type: 'feelings', emoji: '💭', label: 'Feelings', color: '#9b6db5' },
  { type: 'animal', emoji: '🐾', label: 'Animal Pick', color: '#6b7f5e' },
  { type: 'quote', emoji: '💬', label: 'Quote', color: '#4a9cc2' },
  { type: 'bonus', emoji: '🎲', label: 'Bonus Roll', color: '#e06090' },
  { type: 'warp', emoji: '⚡', label: 'Warp', color: '#e0c040' }
];

// ─── Task Prompts ─────────────────────────────────────────────────────────────
const TASK_PROMPTS = {
  photo: [
    'Share a photo of nature 🌿',
    'Share a selfie making a silly face 🤪',
    'Share a photo of something that made you smile today 😊',
    'Share your current view right now 👀',
    'Share a photo of your pet or favorite animal 🐾'
  ],
  feelings: [
    'Write an original note about how you\'re feeling right now 💭',
    'Share one thing you\'re grateful for today 🙏',
    'What\'s been on your mind lately? 🧠',
    'Describe your current mood in 3 words ✍️',
    'Share a happy memory from this week 🌟'
  ],
  animal: [
    'What animal would the other player be in real life and why? 🐾',
    'If you could be any animal today what would it be? 🦊',
    'Describe the other player as a mythical creature 🐲',
    'What animal matches your current energy? 🦥'
  ],
  quote: [
    'Share a quote you really love 📖',
    'Share lyrics from a song stuck in your head 🎵',
    'Share something wise someone once told you 🦉',
    'Make up an inspirational quote right now ✨'
  ]
};

const MYSTERY_OUTCOMES = [
  { text: '🌟 Bonus points! +3 points!', action: 'bonus_points', value: 3 },
  { text: '🔄 Swap! You switched positions with the other player!', action: 'swap' },
  { text: '😈 Steal! You took 2 points from the other player!', action: 'steal', value: 2 },
  { text: '🎭 Free character! You unlocked a random character!', action: 'free_char' },
  { text: '✨ Double up! Your next roll is doubled!', action: 'double_next' }
];

// ─── Board Generation ─────────────────────────────────────────────────────────
const BOARD_SIZE = 30;

function generateBoard() {
  const spaces = [];
  // First space is always start, last is finish
  spaces.push({ type: 'start', emoji: '🏁', label: 'Start', color: '#6b7f5e' });
  for (let i = 1; i < BOARD_SIZE - 1; i++) {
    const st = SPACE_TYPES[Math.floor(Math.random() * SPACE_TYPES.length)];
    spaces.push({ ...st, index: i });
  }
  spaces.push({ type: 'finish', emoji: '🏆', label: 'Finish', color: '#c9922a' });
  return spaces;
}

// ─── Board Path Coordinates ───────────────────────────────────────────────────
// Generate a winding snake-like path that fits in the board container
function getBoardCoords(count) {
  const coords = [];
  const rows = 6;
  const perRow = Math.ceil(count / rows);
  const xPad = 40;
  const yPad = 30;
  const boardW = 700;
  const boardH = 400;
  const rowH = (boardH - yPad * 2) / (rows - 1);

  let idx = 0;
  for (let r = 0; r < rows && idx < count; r++) {
    const inThisRow = Math.min(perRow, count - idx);
    const colW = (boardW - xPad * 2) / (inThisRow - 1 || 1);
    for (let c = 0; c < inThisRow && idx < count; c++) {
      // Alternate direction per row (snake pattern)
      const col = r % 2 === 0 ? c : (inThisRow - 1 - c);
      const x = xPad + col * colW;
      const y = yPad + r * rowH;
      coords.push({ x, y });
      idx++;
    }
  }
  return coords;
}

// ─── Game State ───────────────────────────────────────────────────────────────
let gameState = null;
let gameLoaded = false;
let diceRolling = false;
let taskTimerInterval = null;

function defaultGameState() {
  return {
    board: generateBoard(),
    players: {
      raphael: {
        position: 0, points: 0, character: '🌻',
        rolls_today: 1, bonus_rolls: 0,
        last_roll_date: null, active_task: null,
        task_deadline: null, unlocked_chars: [],
        double_next: false
      },
      taylor: {
        position: 0, points: 0, character: '🌿',
        rolls_today: 1, bonus_rolls: 0,
        last_roll_date: null, active_task: null,
        task_deadline: null, unlocked_chars: [],
        double_next: false
      }
    },
    board_number: 1,
    feed: []
  };
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────
// Midnight MDT = 06:00 UTC (MDT is UTC-6)
function getMDTDateString() {
  const now = new Date();
  // MDT offset is -6 hours
  const mdt = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return mdt.toISOString().split('T')[0]; // YYYY-MM-DD
}

function checkDailyReset(player) {
  const today = getMDTDateString();
  if (player.last_roll_date !== today) {
    player.rolls_today = 1;
    player.bonus_rolls = 0;
    player.last_roll_date = today;
    // Check for expired task
    if (player.active_task && player.task_deadline) {
      if (Date.now() > player.task_deadline) {
        player.active_task = null;
        player.task_deadline = null;
      }
    }
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function loadGameState() {
  try {
    const res = await fetch(`${GAME_API}/api/game/state`, { headers: gameAuthHeaders() });
    const data = await res.json();
    if (!data.board) {
      gameState = defaultGameState();
      await saveGameState();
    } else {
      gameState = data;
    }
  } catch (e) {
    console.error('Failed to load game state:', e);
    gameState = defaultGameState();
  }
  // Daily reset for both players
  checkDailyReset(gameState.players.raphael);
  checkDailyReset(gameState.players.taylor);
  gameLoaded = true;
  renderGame();
}

async function saveGameState() {
  try {
    await fetch(`${GAME_API}/api/game/state`, {
      method: 'POST',
      headers: gameAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(gameState)
    });
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

// Send a game response to the shared message feed
async function sendGameMessage(userId, content) {
  try {
    await fetch(`${GAME_API}/api/messages/text`, {
      method: 'POST',
      headers: gameAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        user_id: userId,
        content: `🎲 [Game] ${content}`
      })
    });
  } catch (e) {
    console.error('Failed to send game message:', e);
  }
}

// ─── Dice Roll ────────────────────────────────────────────────────────────────
function rollDice() {
  if (!gameState || diceRolling) return;

  const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
  const player = gameState.players[user];

  // Check for active unfinished task
  if (player.active_task) {
    if (player.task_deadline && Date.now() < player.task_deadline) {
      showTaskCard(player.active_task, player.task_deadline);
      return;
    } else {
      // Task expired
      player.active_task = null;
      player.task_deadline = null;
    }
  }

  // Check available rolls
  const totalRolls = player.rolls_today + player.bonus_rolls;
  if (totalRolls <= 0) {
    showGameToast('No rolls left today! Come back tomorrow 🌙');
    return;
  }

  diceRolling = true;
  const rollBtn = document.getElementById('rollBtn');
  const diceFace = document.getElementById('diceFace');
  if (rollBtn) rollBtn.disabled = true;

  // Deduct a roll
  if (player.bonus_rolls > 0) {
    player.bonus_rolls--;
  } else {
    player.rolls_today--;
  }

  // Animated dice roll
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  let rollCount = 0;
  const maxRolls = 15;
  const finalRoll = Math.floor(Math.random() * 6) + 1;

  // Apply double if active
  let moveAmount = finalRoll;
  if (player.double_next) {
    moveAmount = finalRoll * 2;
    player.double_next = false;
  }

  const animInterval = setInterval(() => {
    rollCount++;
    const randomDie = Math.floor(Math.random() * 6);
    if (diceFace) {
      diceFace.textContent = diceEmojis[randomDie];
      diceFace.classList.add('dice-spinning');
    }
    if (rollCount >= maxRolls) {
      clearInterval(animInterval);
      if (diceFace) {
        diceFace.textContent = diceEmojis[finalRoll - 1];
        diceFace.classList.remove('dice-spinning');
        diceFace.classList.add('dice-landed');
        setTimeout(() => diceFace.classList.remove('dice-landed'), 500);
      }
      // Move player
      movePlayer(user, moveAmount, moveAmount !== finalRoll);
    }
  }, 80);
}

async function movePlayer(userId, spaces, wasDoubled) {
  const player = gameState.players[userId];
  const oldPos = player.position;
  let newPos = oldPos + spaces;

  // Check if reached or passed end of board
  if (newPos >= BOARD_SIZE - 1) {
    newPos = BOARD_SIZE - 1;
    player.position = newPos;
    player.points += 10;

    addFeedItem(userId, `🏆 Reached the finish line! +10 points!`);
    await sendGameMessage(userId, `reached the finish line on board #${gameState.board_number}! +10 points! 🏆`);

    // Generate new board
    gameState.board = generateBoard();
    gameState.board_number++;
    player.position = 0;

    showGameToast(`🎉 Board complete! Starting Board #${gameState.board_number}!`);
    await saveGameState();
    renderGame();
    diceRolling = false;
    updateRollButton();
    return;
  }

  player.position = newPos;

  const doubleText = wasDoubled ? ' (DOUBLED!)' : '';
  addFeedItem(userId, `🎲 Rolled ${wasDoubled ? spaces / 2 : spaces}${doubleText} → moved to space ${newPos}`);

  // Animate movement along path
  await animateTokenMove(userId, oldPos, newPos);

  // Process the space landed on
  const space = gameState.board[newPos];
  await processSpace(userId, space);

  await saveGameState();
  renderGame();
  diceRolling = false;
  updateRollButton();
}

async function animateTokenMove(userId, fromPos, toPos) {
  const token = document.getElementById(`token-${userId}`);
  if (!token) return;

  const coords = getBoardCoords(gameState.board.length);
  const step = fromPos < toPos ? 1 : -1;

  for (let i = fromPos + step; step > 0 ? i <= toPos : i >= toPos; i += step) {
    const c = coords[i];
    if (c) {
      token.style.transition = 'all 0.2s ease';
      token.style.left = `${(c.x / 700) * 100}%`;
      token.style.top = `${(c.y / 400) * 100}%`;
    }
    await sleep(200);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Process Space ────────────────────────────────────────────────────────────
async function processSpace(userId, space) {
  const player = gameState.players[userId];

  switch (space.type) {
    case 'mystery':
      await processMysteryBox(userId);
      break;
    case 'photo':
    case 'feelings':
    case 'animal':
    case 'quote': {
      const prompts = TASK_PROMPTS[space.type];
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      const task = {
        type: space.type,
        emoji: space.emoji,
        label: space.label,
        prompt: prompt
      };
      player.active_task = task;
      player.task_deadline = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      showTaskCard(task, player.task_deadline);
      addFeedItem(userId, `${space.emoji} Landed on ${space.label}!`);
      break;
    }
    case 'bonus':
      player.bonus_rolls++;
      addFeedItem(userId, `🎲 Bonus Roll! Got an extra roll!`);
      showGameToast('🎲 Bonus Roll! You get another roll!');
      break;
    case 'warp': {
      const warpAmount = Math.floor(Math.random() * 5) + 1;
      addFeedItem(userId, `⚡ Warp! Jumped forward ${warpAmount} spaces!`);
      showGameToast(`⚡ Warp! Jumping ${warpAmount} spaces forward!`);
      await sleep(800);
      await movePlayer(userId, warpAmount, false);
      return; // movePlayer handles the rest
    }
    default:
      break;
  }
}

// ─── Mystery Box ──────────────────────────────────────────────────────────────
async function processMysteryBox(userId) {
  const overlay = document.getElementById('mysteryOverlay');
  const box = document.getElementById('mysteryBox');
  const result = document.getElementById('mysteryResult');

  if (overlay) overlay.style.display = 'flex';
  if (box) {
    box.className = 'mystery-box mystery-shaking';
    if (result) result.style.display = 'none';
  }

  await sleep(1500);
  if (box) box.className = 'mystery-box mystery-opening';
  await sleep(800);

  const outcome = MYSTERY_OUTCOMES[Math.floor(Math.random() * MYSTERY_OUTCOMES.length)];
  const player = gameState.players[userId];
  const otherUserId = userId === 'raphael' ? 'taylor' : 'raphael';
  const otherPlayer = gameState.players[otherUserId];

  switch (outcome.action) {
    case 'bonus_points':
      player.points += outcome.value;
      checkUnlocks(userId);
      break;
    case 'swap': {
      const tmp = player.position;
      player.position = otherPlayer.position;
      otherPlayer.position = tmp;
      break;
    }
    case 'steal':
      otherPlayer.points = Math.max(0, otherPlayer.points - outcome.value);
      player.points += outcome.value;
      checkUnlocks(userId);
      break;
    case 'free_char': {
      const locked = UNLOCKABLE_CHARS.filter(c =>
        !player.unlocked_chars.includes(c.id)
      );
      if (locked.length > 0) {
        const char = locked[Math.floor(Math.random() * locked.length)];
        player.unlocked_chars.push(char.id);
        outcome.text = `🎭 Free unlock! You got ${char.emoji} ${char.name}!`;
      } else {
        player.points += 5;
        outcome.text = '🎭 All characters unlocked! +5 bonus points instead!';
      }
      break;
    }
    case 'double_next':
      player.double_next = true;
      break;
  }

  if (result) {
    result.textContent = outcome.text;
    result.style.display = 'block';
  }
  if (box) box.className = 'mystery-box mystery-opened';

  addFeedItem(userId, `🎁 Mystery Box: ${outcome.text}`);
  await sendGameMessage(userId, `opened a Mystery Box: ${outcome.text}`);

  // Auto-close after 3 seconds
  await sleep(3000);
  if (overlay) overlay.style.display = 'none';
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function showTaskCard(task, deadline) {
  const overlay = document.getElementById('taskOverlay');
  const typeEl = document.getElementById('taskType');
  const promptEl = document.getElementById('taskPrompt');
  const textInput = document.getElementById('taskTextInput');
  const photoArea = document.getElementById('taskPhotoArea');
  const timerBar = document.getElementById('taskTimerBar');
  const photoPreview = document.getElementById('taskPhotoPreview');

  if (!overlay) return;

  overlay.style.display = 'flex';
  if (typeEl) typeEl.textContent = `${task.emoji} ${task.label}`;
  if (promptEl) promptEl.textContent = task.prompt;
  if (textInput) textInput.value = '';
  if (photoPreview) {
    photoPreview.style.display = 'none';
    photoPreview.src = '';
  }

  // Show photo input for photo tasks
  if (photoArea) {
    photoArea.style.display = task.type === 'photo' ? 'block' : 'none';
  }

  // Timer bar
  updateTaskTimer(deadline, timerBar);
  if (taskTimerInterval) clearInterval(taskTimerInterval);
  taskTimerInterval = setInterval(() => {
    updateTaskTimer(deadline, timerBar);
  }, 60000);
}

function updateTaskTimer(deadline, timerBar) {
  if (!timerBar || !deadline) return;
  const now = Date.now();
  const total = 24 * 60 * 60 * 1000;
  const remaining = Math.max(0, deadline - now);
  const pct = (remaining / total) * 100;
  timerBar.style.width = `${pct}%`;

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  timerBar.setAttribute('data-time', `${hours}h ${mins}m left`);

  if (remaining <= 0) {
    timerBar.style.width = '0%';
    timerBar.setAttribute('data-time', 'Time expired!');
    if (taskTimerInterval) clearInterval(taskTimerInterval);
  }
}

async function submitTaskResponse() {
  const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
  const player = gameState.players[user];
  if (!player.active_task) return;

  const textInput = document.getElementById('taskTextInput');
  const photoInput = document.getElementById('taskPhotoInput');
  const text = textInput ? textInput.value.trim() : '';

  if (!text && !(photoInput && photoInput.files && photoInput.files.length > 0)) {
    showGameToast('Write a response or add a photo first!');
    return;
  }

  const task = player.active_task;

  // If photo attached, upload it
  if (photoInput && photoInput.files && photoInput.files.length > 0) {
    try {
      const formData = new FormData();
      formData.append('user_id', user);
      formData.append('media_type_name', 'photo');
      formData.append('file', photoInput.files[0]);
      await fetch(`${GAME_API}/api/messages/media`, { method: 'POST', headers: gameAuthHeaders(), body: formData });
    } catch (e) {
      console.error('Photo upload failed:', e);
    }
  }

  // Send text response as game message
  if (text) {
    await sendGameMessage(user, `[${task.emoji} ${task.label}] ${text}`);
  }

  // Award points
  player.points += 5;
  player.bonus_rolls++; // Completing task earns a bonus roll
  player.active_task = null;
  player.task_deadline = null;

  addFeedItem(user, `✅ Completed ${task.emoji} ${task.label}: "${text || '📷 Photo shared'}" (+5 pts, +1 bonus roll)`);
  checkUnlocks(user);

  // Close task card
  const overlay = document.getElementById('taskOverlay');
  if (overlay) overlay.style.display = 'none';
  if (taskTimerInterval) clearInterval(taskTimerInterval);

  // Reset file input
  if (photoInput) photoInput.value = '';

  showGameToast('✅ Task complete! +5 points & bonus roll earned!');
  await saveGameState();
  renderGame();
}

function skipTask() {
  const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
  const player = gameState.players[user];

  player.active_task = null;
  player.task_deadline = null;

  addFeedItem(user, '⏭️ Skipped task (no points)');

  const overlay = document.getElementById('taskOverlay');
  if (overlay) overlay.style.display = 'none';
  if (taskTimerInterval) clearInterval(taskTimerInterval);

  saveGameState();
  renderGame();
}

// ─── Photo Preview ────────────────────────────────────────────────────────────
function handleTaskPhotoChange() {
  const input = document.getElementById('taskPhotoInput');
  const preview = document.getElementById('taskPhotoPreview');
  if (input && input.files && input.files[0] && preview) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ─── Character Selection ──────────────────────────────────────────────────────
function openCharacterSelect() {
  const overlay = document.getElementById('charSelectOverlay');
  if (overlay) overlay.style.display = 'flex';
  renderCharacterGrid();
}

function closeCharacterSelect() {
  const overlay = document.getElementById('charSelectOverlay');
  if (overlay) overlay.style.display = 'none';
}

function renderCharacterGrid() {
  const grid = document.getElementById('charGrid');
  if (!grid || !gameState) return;

  const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
  const player = gameState.players[user];

  let html = '<div class="char-section-label">Starter Characters</div><div class="char-grid-inner">';
  STARTER_CHARS.forEach(c => {
    const selected = player.character === c.emoji ? 'char-selected' : '';
    html += `<button class="char-card ${selected}" onclick="selectCharacter('${c.emoji}')">
      <span class="char-emoji">${c.emoji}</span>
      <span class="char-name">${c.name}</span>
      <span class="char-desc">${c.desc}</span>
    </button>`;
  });
  html += '</div>';

  html += '<div class="char-section-label">Unlockable Characters</div><div class="char-grid-inner">';
  UNLOCKABLE_CHARS.forEach(c => {
    const unlocked = player.unlocked_chars.includes(c.id) || player.points >= c.cost;
    const selected = player.character === c.emoji ? 'char-selected' : '';
    if (unlocked) {
      // Auto-unlock if points sufficient
      if (!player.unlocked_chars.includes(c.id) && player.points >= c.cost) {
        player.unlocked_chars.push(c.id);
      }
      html += `<button class="char-card ${selected}" onclick="selectCharacter('${c.emoji}')">
        <span class="char-emoji">${c.emoji}</span>
        <span class="char-name">${c.name}</span>
        <span class="char-desc">${c.desc}</span>
      </button>`;
    } else {
      html += `<button class="char-card char-locked" disabled>
        <span class="char-emoji char-locked-emoji">${c.emoji}</span>
        <span class="char-lock-icon">🔒</span>
        <span class="char-name">${c.name}</span>
        <span class="char-cost">${c.cost} pts</span>
      </button>`;
    }
  });
  html += '</div>';

  grid.innerHTML = html;
}

async function selectCharacter(emoji) {
  const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
  gameState.players[user].character = emoji;
  renderCharacterGrid();
  renderGame();
  await saveGameState();
}

// ─── Unlocks ──────────────────────────────────────────────────────────────────
function checkUnlocks(userId) {
  const player = gameState.players[userId];
  UNLOCKABLE_CHARS.forEach(c => {
    if (player.points >= c.cost && !player.unlocked_chars.includes(c.id)) {
      player.unlocked_chars.push(c.id);
      showGameToast(`🎉 New character unlocked: ${c.emoji} ${c.name}!`);
      addFeedItem(userId, `🎉 Unlocked ${c.emoji} ${c.name}!`);
    }
  });
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
function addFeedItem(userId, text) {
  if (!gameState) return;
  const name = userId === 'raphael' ? 'Raphael' : 'Taylor';
  const emoji = gameState.players[userId].character;
  gameState.feed.unshift({
    user: userId,
    name,
    emoji,
    text,
    time: Date.now()
  });
  // Keep last 50 feed items
  if (gameState.feed.length > 50) gameState.feed.length = 50;
}

function renderGameFeed() {
  const container = document.getElementById('gameFeedItems');
  if (!container || !gameState) return;

  if (gameState.feed.length === 0) {
    container.innerHTML = '<div class="game-feed-empty">No moves yet — roll the dice! 🎲</div>';
    return;
  }

  container.innerHTML = gameState.feed.slice(0, 20).map(item => {
    const timeAgo = getTimeAgo(item.time);
    const cls = item.user === 'raphael' ? 'feed-raphael' : 'feed-taylor';
    return `<div class="game-feed-item ${cls}">
      <span class="feed-avatar">${item.emoji}</span>
      <div class="feed-content">
        <span class="feed-name">${item.name}</span>
        <span class="feed-text">${item.text}</span>
      </div>
      <span class="feed-time">${timeAgo}</span>
    </div>`;
  }).join('');
}

function getTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ─── Render Board ─────────────────────────────────────────────────────────────
function renderBoard() {
  const board = document.getElementById('gameBoard');
  if (!board || !gameState) return;

  const spaces = gameState.board;
  const coords = getBoardCoords(spaces.length);

  // Build SVG
  let svg = `<svg viewBox="0 0 700 400" class="board-svg" xmlns="http://www.w3.org/2000/svg">`;

  // Draw path connecting spaces
  svg += `<path d="M`;
  coords.forEach((c, i) => {
    svg += `${i === 0 ? '' : ' L'}${c.x},${c.y}`;
  });
  svg += `" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Draw dotted trail on top
  svg += `<path d="M`;
  coords.forEach((c, i) => {
    svg += `${i === 0 ? '' : ' L'}${c.x},${c.y}`;
  });
  svg += `" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Draw space circles
  spaces.forEach((space, i) => {
    const c = coords[i];
    if (!c) return;
    const color = space.color || '#666';
    // Glow
    svg += `<circle cx="${c.x}" cy="${c.y}" r="18" fill="${color}" opacity="0.2"/>`;
    // Circle
    svg += `<circle cx="${c.x}" cy="${c.y}" r="14" fill="${color}" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`;
    // Space number (small)
    svg += `<text x="${c.x}" y="${c.y - 20}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="8" font-family="General Sans, sans-serif">${i}</text>`;
    // Emoji
    svg += `<text x="${c.x}" y="${c.y + 5}" text-anchor="middle" font-size="14" dominant-baseline="middle">${space.emoji}</text>`;
  });

  svg += `</svg>`;

  // Player tokens (positioned via CSS over the SVG)
  let tokensHtml = '';
  ['raphael', 'taylor'].forEach(uid => {
    const player = gameState.players[uid];
    const pos = player.position;
    const c = coords[pos];
    if (!c) return;
    const leftPct = (c.x / 700) * 100;
    const topPct = (c.y / 400) * 100;
    const offsetY = uid === 'raphael' ? -22 : 12;
    tokensHtml += `<div class="player-token token-${uid}" id="token-${uid}"
      style="left:${leftPct}%;top:calc(${topPct}% + ${offsetY}px)">
      <span class="token-emoji">${player.character}</span>
    </div>`;
  });

  board.innerHTML = svg + tokensHtml;
}

// ─── Render Scores ────────────────────────────────────────────────────────────
function renderScores() {
  if (!gameState) return;

  const rPts = document.getElementById('gamePtsRaphael');
  const tPts = document.getElementById('gamePtsTaylor');
  const rAvatar = document.getElementById('gameAvatarRaphael');
  const tAvatar = document.getElementById('gameAvatarTaylor');

  if (rPts) {
    const oldVal = parseInt(rPts.textContent) || 0;
    rPts.textContent = gameState.players.raphael.points;
    if (gameState.players.raphael.points > oldVal) rPts.classList.add('pts-sparkle');
    setTimeout(() => rPts.classList.remove('pts-sparkle'), 600);
  }
  if (tPts) {
    const oldVal = parseInt(tPts.textContent) || 0;
    tPts.textContent = gameState.players.taylor.points;
    if (gameState.players.taylor.points > oldVal) tPts.classList.add('pts-sparkle');
    setTimeout(() => tPts.classList.remove('pts-sparkle'), 600);
  }
  if (rAvatar) rAvatar.textContent = gameState.players.raphael.character;
  if (tAvatar) tAvatar.textContent = gameState.players.taylor.character;
}

// ─── Roll Button State ────────────────────────────────────────────────────────
function updateRollButton() {
  const rollBtn = document.getElementById('rollBtn');
  const rollsLeft = document.getElementById('rollsLeft');

  if (!gameState) return;

  const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
  const player = gameState.players[user];
  const total = player.rolls_today + player.bonus_rolls;

  if (rollBtn) {
    rollBtn.disabled = total <= 0 || diceRolling;
  }

  if (rollsLeft) {
    if (player.active_task) {
      rollsLeft.textContent = '📋 Task in progress — tap Roll to continue';
    } else if (total <= 0) {
      rollsLeft.textContent = '🌙 No rolls left today';
    } else {
      const parts = [];
      if (player.rolls_today > 0) parts.push(`${player.rolls_today} free`);
      if (player.bonus_rolls > 0) parts.push(`${player.bonus_rolls} bonus`);
      rollsLeft.textContent = `${parts.join(' + ')} roll${total !== 1 ? 's' : ''} today`;
    }
  }
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function showGameToast(message) {
  // Remove existing toast
  const old = document.querySelector('.game-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = 'game-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('game-toast-show'));

  setTimeout(() => {
    toast.classList.remove('game-toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─── Main Render ──────────────────────────────────────────────────────────────
function renderGame() {
  if (!gameState) return;
  renderBoard();
  renderScores();
  renderGameFeed();
  updateRollButton();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Game waits for auth before loading — triggered by app.js bootApp() or first soul-poll
let gameInitialized = false;
function initGameIfReady() {
  if (gameInitialized || !window.authToken) return;
  gameInitialized = true;
  loadGameState();

  const photoInput = document.getElementById('taskPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', handleTaskPhotoChange);
  }

  // Listen for unified poll events from app.js instead of separate polling
  // Refresh game state every 3rd poll tick (~12s) to stay in sync
  let gamePollCounter = 0;
  window.addEventListener('soul-poll', async () => {
    gamePollCounter++;
    if (gamePollCounter % 3 !== 0 || !gameLoaded) return;
    try {
      const res = await fetch(`${GAME_API}/api/game/state`, { headers: gameAuthHeaders() });
      const data = await res.json();
      if (data.board) {
        const user = typeof currentUser !== 'undefined' ? currentUser : 'raphael';
        const other = user === 'raphael' ? 'taylor' : 'raphael';
        gameState.players[other] = data.players[other];
        if (data.board_number > gameState.board_number) {
          gameState.board = data.board;
          gameState.board_number = data.board_number;
        }
        const existingTimes = new Set(gameState.feed.map(f => f.time));
        data.feed.forEach(f => {
          if (!existingTimes.has(f.time)) gameState.feed.push(f);
        });
        gameState.feed.sort((a, b) => b.time - a.time);
        if (gameState.feed.length > 50) gameState.feed.length = 50;
        renderGame();
      }
    } catch (e) {
      // Silently ignore poll errors
    }
  });
}

// Boot game on first soul-poll if auth is ready (fallback if bootApp didn't call us)
window.addEventListener('soul-poll', () => initGameIfReady(), { once: true });
