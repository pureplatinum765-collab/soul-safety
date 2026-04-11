/**
 * solid-overhaul.js — Kill jello, add chat panel, real pinboard
 * Runs after all other scripts to override their behavior.
 */
(function () {
  'use strict';

  // ── 1. KILL JELLO ANIMATIONS ─────────────────────────────────────────

  // Disable Lenis smooth scroll (makes everything feel mushy)
  if (window.Lenis) {
    // Find and destroy any Lenis instances
    try {
      var lenisFrames = document.querySelectorAll('.lenis');
      if (lenisFrames.length) {
        lenisFrames.forEach(function(el) {
          el.classList.remove('lenis', 'lenis-smooth');
        });
      }
      // Override the scroll behavior
      document.documentElement.style.scrollBehavior = 'smooth';
      document.body.style.scrollBehavior = 'smooth';
    } catch(e) {}
  }

  // Kill magnetic button effects from both immersive.js and scroll-fx.js
  // by removing their mousemove listeners on magnetic targets
  var magneticBtns = document.querySelectorAll('.btn-enter, .btn-primary, .btn-game--primary');
  magneticBtns.forEach(function(btn) {
    var clone = btn.cloneNode(true);
    if (btn.parentNode) {
      btn.parentNode.replaceChild(clone, btn);
    }
  });

  // Remove GSAP inline styles that create jello
  setTimeout(function() {
    var allAnimated = document.querySelectorAll('[style*="translate"]');
    allAnimated.forEach(function(el) {
      if (el.classList.contains('hero-content') || 
          el.classList.contains('hero-bg--gradient') ||
          el.classList.contains('hero-logo')) {
        return; // keep parallax
      }
    });
  }, 100);

  // ── 2. CHAT PANEL — Transform feed into collapsible panel ──────────

  function setupChatPanel() {
    var feedSection = document.querySelector('.feed-section');
    if (!feedSection) return;

    var feedLabel = feedSection.querySelector('.feed-label');

    // Feed starts hidden via CSS (:not(.feed-open))
    // Do NOT add feed-open class — it stays hidden until user clicks toggle
    feedSection.classList.remove('feed-open');

    // Create toggle button (chat bubble icon)
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'feed-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle chat');
    toggleBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
    document.body.appendChild(toggleBtn);

    var chatIsOpen = false;

    function openChat() {
      chatIsOpen = true;
      feedSection.classList.add('feed-open');
      feedSection.classList.remove('collapsed');
      toggleBtn.classList.add('hidden');
      // Scroll feed to bottom
      var container = document.getElementById('feedContainer');
      if (container) {
        setTimeout(function() {
          container.scrollTop = container.scrollHeight;
        }, 300);
      }
    }

    function closeChat() {
      chatIsOpen = false;
      feedSection.classList.add('collapsed');
      toggleBtn.classList.remove('hidden');
      // After transition, remove feed-open
      setTimeout(function() {
        if (!chatIsOpen) feedSection.classList.remove('feed-open');
      }, 300);
    }

    toggleBtn.addEventListener('click', openChat);

    if (feedLabel) {
      feedLabel.addEventListener('click', closeChat);
    }

    // Update placeholder to show user name
    updateInputPlaceholder();
  }

  function updateInputPlaceholder() {
    var input = document.getElementById('messageInput');
    if (!input) return;
    var user = window.currentUser || 'raphael';
    var name = user === 'raphael' ? 'Raphael' : 'Taylor';
    input.placeholder = 'Message as ' + name + '...';
  }

  // Watch for user changes
  var origSelectUser = window.selectUser;
  if (origSelectUser) {
    window.selectUser = function(userId, save) {
      origSelectUser.call(this, userId, save);
      updateInputPlaceholder();
    };
  }

  // ── 3. REAL PINBOARD — Inline sticky notes ─────────────────────────

  function setupPinboard() {
    var pinboardSection = document.querySelector('.milanote-section');
    if (!pinboardSection) return;

    var inner = pinboardSection.querySelector('.milanote-section__inner');
    if (!inner) return;

    // Keep the milanote link but add a real notes grid below
    var notesGrid = document.createElement('div');
    notesGrid.className = 'pinboard-notes';
    notesGrid.id = 'pinboardNotes';

    inner.appendChild(notesGrid);

    // Load saved notes
    loadNotes();
  }

  var NOTES_KEY = 'soulSafetyPinboardNotes';

  function loadNotes() {
    var grid = document.getElementById('pinboardNotes');
    if (!grid) return;

    var notes = [];
    try {
      var raw = localStorage.getItem(NOTES_KEY);
      if (raw) notes = JSON.parse(raw);
    } catch(e) {}

    // Also try loading from API
    loadNotesFromApi().then(function(apiNotes) {
      if (apiNotes && apiNotes.length) {
        // Merge with local (API takes priority)
        var merged = apiNotes.slice();
        notes.forEach(function(n) {
          if (!merged.find(function(m) { return m.id === n.id; })) {
            merged.push(n);
          }
        });
        notes = merged;
      }
      renderNotes(notes);
    }).catch(function() {
      renderNotes(notes);
    });
  }

  async function loadNotesFromApi() {
    try {
      var token = window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken');
      if (!token) return [];
      var resp = await fetch('/api/messages/factoids', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!resp.ok) return [];
      var data = await resp.json();
      return (data || []).map(function(f) {
        return {
          id: f.id || ('api-' + Date.now() + Math.random()),
          text: f.content || f.text || '',
          author: f.user_id || f.author || 'raphael',
          ts: f.timestamp || Date.now()
        };
      });
    } catch(e) {
      return [];
    }
  }

  function renderNotes(notes) {
    var grid = document.getElementById('pinboardNotes');
    if (!grid) return;

    grid.innerHTML = '';

    notes.forEach(function(note) {
      var el = createNoteEl(note);
      grid.appendChild(el);
    });

    // Add the "add note" button
    var addBtn = document.createElement('button');
    addBtn.className = 'add-note-btn';
    addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add a note';
    addBtn.addEventListener('click', function() {
      addNewNote();
    });
    grid.appendChild(addBtn);
  }

  function createNoteEl(note) {
    var div = document.createElement('div');
    div.className = 'sticky-note sticky-note--' + (note.author || 'raphael');
    div.setAttribute('data-note-id', note.id);

    var textEl = document.createElement('div');
    textEl.className = 'note-text';
    textEl.textContent = note.text;
    textEl.contentEditable = 'true';
    textEl.spellcheck = false;
    textEl.addEventListener('blur', function() {
      note.text = textEl.textContent;
      saveNotesLocal();
    });
    div.appendChild(textEl);

    var authorEl = document.createElement('div');
    authorEl.className = 'note-author';
    var authorName = note.author === 'taylor' ? '🌿 Taylor' : '🌻 Raphael';
    authorEl.textContent = authorName;
    div.appendChild(authorEl);

    return div;
  }

  function addNewNote() {
    var user = window.currentUser || 'raphael';
    var newNote = {
      id: 'note-' + Date.now(),
      text: '',
      author: user,
      ts: Date.now()
    };

    var notes = getLocalNotes();
    notes.push(newNote);
    saveNotesLocal(notes);

    var grid = document.getElementById('pinboardNotes');
    if (!grid) return;

    // Insert before the add button
    var addBtn = grid.querySelector('.add-note-btn');
    var noteEl = createNoteEl(newNote);
    if (addBtn) {
      grid.insertBefore(noteEl, addBtn);
    } else {
      grid.appendChild(noteEl);
    }

    // Focus the new note
    var textEl = noteEl.querySelector('.note-text');
    if (textEl) {
      setTimeout(function() { textEl.focus(); }, 50);
    }

    // Also save to API
    saveNoteToApi(newNote);
  }

  function getLocalNotes() {
    try {
      var raw = localStorage.getItem(NOTES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }

  function saveNotesLocal(notes) {
    if (!notes) {
      // Rebuild from DOM
      notes = [];
      var noteEls = document.querySelectorAll('.sticky-note');
      noteEls.forEach(function(el) {
        var text = el.querySelector('.note-text');
        var id = el.getAttribute('data-note-id');
        var author = el.classList.contains('sticky-note--taylor') ? 'taylor' : 'raphael';
        if (text) {
          notes.push({ id: id, text: text.textContent, author: author, ts: Date.now() });
        }
      });
    }
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch(e) {}
  }

  async function saveNoteToApi(note) {
    try {
      var token = window.SOUL_SAFETY_BEARER_TOKEN || localStorage.getItem('soulSafetyBearerToken');
      if (!token) return;
      await fetch('/api/messages/factoids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          user_id: note.author,
          content: note.text,
          about: note.author === 'raphael' ? 'taylor' : 'raphael'
        })
      });
    } catch(e) {}
  }

  // ── 4. KILL SECTION OPACITY ANIMATIONS ────────────────────────────

  function forceShowAllSections() {
    var sections = document.querySelectorAll(
      '.curiosity-shop, .milanote-section, .daily-spark-inline, .mood-section, .feed-section, .game-section, .main-content, .top-bar'
    );
    sections.forEach(function(el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });

    // Also kill the reveal-on-scroll that hides things
    var reveals = document.querySelectorAll('.reveal-on-scroll');
    reveals.forEach(function(el) {
      el.classList.add('is-visible');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });

    var revealEls = document.querySelectorAll('.reveal');
    revealEls.forEach(function(el) {
      el.classList.add('in-view');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  // ── 5. BOARD GAME — Add clear instructions ─────────────────────────

  function improveGameSection() {
    var narrative = document.getElementById('wanderNarrative');
    if (narrative && narrative.textContent.trim() === 'The wandering path awaits...') {
      narrative.textContent = 'Roll the dice to move along the path. Land on special tiles for bonuses or setbacks. First to the end wins.';
    }
  }

  // ── INIT ────────────────────────────────────────────────────────────

  function init() {
    forceShowAllSections();
    setupChatPanel();
    setupPinboard();
    improveGameSection();

    // Re-force visibility after GSAP might hide things
    setTimeout(forceShowAllSections, 500);
    setTimeout(forceShowAllSections, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also init after auth
  window.addEventListener('soulSafetyUnlocked', function() {
    setTimeout(init, 500);
  });

})();
