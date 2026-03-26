/* streak.js — Daily login streak with rewards + funny penalties */
(function () {
  'use strict';

  const SK = 'ss-streak-v1';
  const SS_KEY = 'ss-streak-shown-today';
  const today = () => new Date().toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  function load() {
    try { return JSON.parse(localStorage.getItem(SK)) || {}; } catch { return {}; }
  }
  function save(d) { localStorage.setItem(SK, JSON.stringify(d)); }

  function computeStreak() {
    if (sessionStorage.getItem(SS_KEY)) return null; // already shown today
    const d = load();
    const t = today();
    if (d.lastDate === t) { sessionStorage.setItem(SS_KEY,'1'); return null; }

    let result;
    if (!d.lastDate) {
      d.streak = 1; d.lastDate = t; d.max = 1; d.total = 1;
      result = { type:'new', streak:1, gone:0 };
    } else {
      const diff = daysBetween(d.lastDate, t);
      if (diff === 1) {
        d.streak = (d.streak || 0) + 1;
        d.max = Math.max(d.streak, d.max || 0);
        d.total = (d.total || 0) + 1;
        d.lastDate = t;
        result = { type:'streak', streak:d.streak, gone:0 };
      } else {
        const gone = diff - 1;
        d.streak = 1; d.lastDate = t; d.total = (d.total||0)+1;
        result = { type:'broke', streak:1, gone };
      }
    }
    save(d);
    sessionStorage.setItem(SS_KEY, '1');
    return result;
  }

  const STREAK_DATA = {
    1:  { titles:['Day 1 🌱','A fresh start ✨','The journey begins 🌅'],
          bodies:['The cat waited by the door. It always does. Welcome back.','Showing up is the whole thing. You showed up.','Day one. Again or for the first time — it counts.'] },
    2:  { titles:['Day 2! ✌️','Back to back 🔥','Two in a row 🌿'],
          bodies:['The cat is cautiously optimistic. Don\'t let it down.','Consecutive! The vibe is building. Keep going.','Two days straight. You\'re becoming a regular around here.'] },
    3:  { titles:['Day 3 Streak 🔥','THREE DAYS 🎯','Building something real 💪'],
          bodies:['The cat is printing a certificate. It looks very official.','Day 3! Okay okay, we see you. The vibes are immaculate.','Three in a row. The universe noticed. So did the cat.'] },
    7:  { titles:['ONE WEEK!! 🎉','7 DAY STREAK 🏆','SEVEN WHOLE DAYS 🌟'],
          bodies:['THE CAT IS DOING A LITTLE DANCE. An actual tiny celebration dance. For you.','A full week. You unlocked legendary soul safety member status.','7 days straight. The cat has commissioned a small portrait in your honor.'] },
    14: { titles:['TWO WEEKS 🌟','14 DAYS!! 🔥','FORTNIGHT STREAK 👑'],
          bodies:['The cat has memorized your schedule and built its whole routine around it.','14 days in a row. Two whole weeks. We\'re not crying. The cat is crying though.','You\'ve been here 14 days straight. This place is basically yours now.'] },
    30: { titles:['30 DAYS!!! 👑🏆','A LITERAL MONTH 🚀','THE LEGEND RETURNS 🌠'],
          bodies:['THE CAT LEGALLY CHANGED ITS NAME IN YOUR HONOR. 30 days. Absolute royalty.','One full month. You ARE soul safety at this point. The cat wrote a song.','30 day streak. Scientists can\'t explain it. The cat can\'t explain it. We love you.'] },
  };

  const BROKE_MSGS = [
    g=>`YOU WERE GONE FOR ${g} DAY${g>1?'S':''}. The cat held a candlelight vigil on night ${Math.min(g,3)}. All is forgiven. New streak starts NOW. 💕`,
    g=>`${g} day${g>1?'s':''} of radio silence! The cat filed a missing persons report. It was rejected (you\'re a person). Welcome back. 🐾`,
    g=>`The streak is gone (RIP). ${g} day${g>1?'s':''} in the wilderness. But every story has a reset. This is yours. Let\'s go. ✨`,
    g=>`${g*7} units of cat disappointment calculated and then immediately forgiven. Streak broken. New streak begun. That\'s the whole deal. 💛`,
  ];

  function getMessage(result) {
    if (result.type === 'broke') {
      const fn = BROKE_MSGS[Math.floor(Math.random()*BROKE_MSGS.length)];
      return { title:`Streak Broken 💔 (${result.gone} day${result.gone>1?'s':''} gone)`, body:fn(result.gone), big:false, celebrate:false };
    }
    const s = result.streak;
    const tiers = [30,14,7,3,2,1];
    for (const t of tiers) {
      if (s >= t && STREAK_DATA[t]) {
        const td = STREAK_DATA[t];
        const i = Math.floor(Math.random()*td.titles.length);
        return { title:td.titles[i], body:td.bodies[i], big: s>=7, celebrate: s>=7 };
      }
    }
    return { title:`Day ${s} 💛`, body:`You showed up. That\'s the whole thing.`, big:false, celebrate:false };
  }

  function showBanner(result) {
    const msg = getMessage(result);
    const s = result.streak;
    const catMood = result.type==='broke' ? 'sad' : s>=7 ? 'party' : 'happy';

    const CAT_SVGS = {
      happy:`<svg viewBox="0 0 64 72" fill="none"><path d="M47 54 Q61 46 58 34 Q56 24 51 27" stroke="#c4845a" stroke-width="5.5" fill="none" stroke-linecap="round"/><g><ellipse cx="32" cy="48" rx="17.5" ry="14.5" fill="#d49870"/><ellipse cx="32" cy="50" rx="9.5" ry="8" fill="#eac4a4" opacity=".52"/><ellipse cx="32" cy="25" rx="13.5" ry="13" fill="#d49870"/><polygon points="20,17 13,4 25,14" fill="#c4845a"/><polygon points="20.5,16 16,7 24,14" fill="#f0b4a4" opacity=".6"/><polygon points="44,17 51,4 39,14" fill="#c4845a"/><polygon points="43.5,16 48,7 40,14" fill="#f0b4a4" opacity=".6"/><ellipse cx="26.5" cy="24" rx="3" ry="3.6" fill="#1c1008"/><ellipse cx="37.5" cy="24" rx="3" ry="3.6" fill="#1c1008"/><circle cx="28" cy="22.4" r="1.1" fill="white"/><circle cx="39" cy="22.4" r="1.1" fill="white"/><path d="M30.5 29 Q32 31 33.5 29" fill="#ce6050"/><path d="M29 30.5 Q32 34 35 30.5" stroke="#a04840" stroke-width="1.1" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="28" rx="3" ry="2" fill="#e8a090" opacity=".32"/><ellipse cx="42" cy="28" rx="3" ry="2" fill="#e8a090" opacity=".32"/><ellipse cx="21" cy="60" rx="5.5" ry="3.5" fill="#c48060"/><ellipse cx="43" cy="60" rx="5.5" ry="3.5" fill="#c48060"/></g></svg>`,
      sad:`<svg viewBox="0 0 64 72" fill="none"><path d="M47 54 Q55 52 54 44 Q53 36 50 38" stroke="#c4845a" stroke-width="5.5" fill="none" stroke-linecap="round"/><g><ellipse cx="32" cy="48" rx="17.5" ry="14.5" fill="#d49870"/><ellipse cx="32" cy="25" rx="13.5" ry="13" fill="#d49870"/><polygon points="20,17 13,4 25,14" fill="#c4845a"/><polygon points="44,17 51,4 39,14" fill="#c4845a"/><ellipse cx="26.5" cy="25" rx="3" ry="3" fill="#1c1008"/><ellipse cx="37.5" cy="25" rx="3" ry="3" fill="#1c1008"/><circle cx="28" cy="23.5" r="1" fill="white"/><circle cx="39" cy="23.5" r="1" fill="white"/><path d="M30.5 29 Q32 27.5 33.5 29" fill="#ce6050"/><path d="M29 31 Q32 28 35 31" stroke="#a04840" stroke-width="1.1" fill="none" stroke-linecap="round"/><text x="24" y="20" font-size="5" fill="#5fa">😢</text></g></svg>`,
      party:`<svg viewBox="0 0 64 72" fill="none"><path d="M47 54 Q61 42 55 28 Q52 20 48 23" stroke="#c4845a" stroke-width="5.5" fill="none" stroke-linecap="round"/><g><ellipse cx="32" cy="48" rx="17.5" ry="14.5" fill="#d49870"/><ellipse cx="32" cy="50" rx="9.5" ry="8" fill="#eac4a4" opacity=".52"/><ellipse cx="32" cy="25" rx="13.5" ry="13" fill="#d49870"/><polygon points="20,17 13,4 25,14" fill="#c4845a"/><polygon points="44,17 51,4 39,14" fill="#c4845a"/><ellipse cx="26.5" cy="23" rx="3.2" ry="3.8" fill="#1c1008"/><ellipse cx="37.5" cy="23" rx="3.2" ry="3.8" fill="#1c1008"/><circle cx="28" cy="21" r="1.2" fill="white"/><circle cx="39" cy="21" r="1.2" fill="white"/><path d="M30.5 28 Q32 30.5 33.5 28" fill="#ce6050"/><path d="M28 31 Q32 35.5 36 31" stroke="#a04840" stroke-width="1.3" fill="none" stroke-linecap="round"/><text x="18" y="12" font-size="10">🎉</text><text x="38" y="10" font-size="8">✨</text></g></svg>`,
    };

    const style = document.createElement('style');
    style.textContent = `
      #ss-sk-wrap {
        position:fixed; top:0; left:0; right:0; z-index:8500;
        display:flex; justify-content:center; padding:0.75rem;
        transform:translateY(-110%);
        transition:transform 0.6s cubic-bezier(0.16,1,0.3,1);
        pointer-events:none;
      }
      #ss-sk-wrap.show { transform:translateY(0); pointer-events:all; }
      .ss-sk-card {
        width:min(520px,100%); border-radius:20px;
        background:var(--color-surface,#faf6ef);
        box-shadow:0 12px 48px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.08);
        border:2px solid rgba(194,98,58,0.18);
        padding:1rem 1.25rem 0.9rem;
        display:grid; grid-template-columns:auto 1fr; gap:0.9rem;
        align-items:center; position:relative; overflow:hidden;
      }
      ${msg.big ? '.ss-sk-card { border-color:rgba(201,146,42,0.35); background:linear-gradient(135deg,#fdfbf5,#faf0e0); }' : ''}
      .ss-sk-cat { width:${msg.big?'68':'52'}px; height:${msg.big?'76':'58'}px; flex-shrink:0;
        animation:skCatBob ${catMood==='party'?'0.5s':'2.4s'} ease-in-out infinite alternate; }
      @keyframes skCatBob { from { transform:translateY(0) rotate(-2deg); } to { transform:translateY(-${catMood==='party'?'8':'4'}px) rotate(2deg); } }
      .ss-sk-body { min-width:0; }
      .ss-sk-streak-num {
        font-family:'Sentient',Georgia,serif;
        font-size:${msg.big?'1.5rem':'1.15rem'}; font-weight:700;
        color:var(--color-primary,#c2623a); margin:0 0 0.15rem; line-height:1.1;
      }
      .ss-sk-msg { font-size:0.84rem; line-height:1.5; opacity:0.75; margin:0; }
      .ss-sk-close {
        position:absolute; top:0.6rem; right:0.7rem;
        background:none; border:none; cursor:pointer;
        font-size:1rem; opacity:0.3; padding:0.2rem; line-height:1;
        transition:opacity 0.15s;
      }
      .ss-sk-close:hover { opacity:0.65; }
      .ss-sk-progress {
        position:absolute; bottom:0; left:0;
        height:3px; border-radius:0 0 20px 20px;
        background:linear-gradient(90deg,var(--color-primary,#c2623a),var(--color-amber,#c9922a));
        transition:width 7s linear; width:100%;
      }
      .ss-sk-flame {
        display:inline-flex; align-items:center; gap:0.25rem;
        font-size:0.78rem; font-weight:700; letter-spacing:0.04em;
        padding:0.18rem 0.55rem; border-radius:999px;
        background:${result.type==='broke'?'rgba(161,53,68,0.12)':'rgba(201,146,42,0.15)'};
        color:${result.type==='broke'?'var(--color-error,#a13544)':'var(--color-amber,#c9922a)'};
        margin-bottom:0.3rem;
      }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'ss-sk-wrap';
    wrap.innerHTML = `
      <div class="ss-sk-card">
        <div class="ss-sk-cat">${CAT_SVGS[catMood]}</div>
        <div class="ss-sk-body">
          <div class="ss-sk-flame">${result.type==='broke'?'💔 streak broken':'🔥 day '+s+' streak'}</div>
          <div class="ss-sk-streak-num">${msg.title}</div>
          <p class="ss-sk-msg">${msg.body}</p>
        </div>
        <button class="ss-sk-close" aria-label="Dismiss">✕</button>
        <div class="ss-sk-progress" id="ss-sk-prog"></div>
      </div>`;
    document.body.appendChild(wrap);

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      wrap.classList.add('show');
      const prog = document.getElementById('ss-sk-prog');
      if (prog) requestAnimationFrame(()=>{ prog.style.width='0%'; });
      if (msg.celebrate) _streakConfetti();
      setTimeout(dismiss, 7200);
    }));

    function dismiss() {
      wrap.classList.remove('show');
      setTimeout(()=>wrap.remove(), 700);
    }
    wrap.querySelector('.ss-sk-close').addEventListener('click', dismiss);
  }

  function _streakConfetti() {
    const cols = ['#c2623a','#c9922a','#6b7f5e','#9b6db5','#d4a060'];
    for (let i=0; i<35; i++) {
      setTimeout(()=>{
        const p = document.createElement('div');
        const sz = 5+Math.random()*6;
        p.style.cssText = `position:fixed;left:${10+Math.random()*80}%;top:-10px;
          width:${sz}px;height:${sz}px;border-radius:${Math.random()>.5?'50%':'3px'};
          background:${cols[Math.floor(Math.random()*cols.length)]};
          animation:skConfetti ${1.4+Math.random()*1.2}s ease forwards;
          transform:rotate(${Math.random()*360}deg);z-index:8600;pointer-events:none;`;
        document.body.appendChild(p);
        setTimeout(()=>p.remove(), 3000);
      }, i*55);
    }
    if (!document.getElementById('sk-confetti-anim')) {
      const s = document.createElement('style');
      s.id = 'sk-confetti-anim';
      s.textContent = '@keyframes skConfetti{0%{opacity:.95;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(85vh) rotate(520deg)}}';
      document.head.appendChild(s);
    }
  }

  function init() {
    const result = computeStreak();
    if (result) setTimeout(()=>showBanner(result), 1600);
  }

  if (localStorage.getItem('soulSafetyBearerToken')) {
    document.addEventListener('DOMContentLoaded', init);
  }
  window.addEventListener('soulSafetyUnlocked', init);
})();
