# Soul Safety — Architecture Guide

## Overview
Private two-person messaging/activity site for Raphael & Taylor. Hosted on Vercel (Hobby plan, 12 serverless function limit). Supabase for database/realtime. PIN-gated auth.

## Stack
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Libraries:** Three.js 0.160.0, GSAP 3, Lenis 1.0.42, Supabase JS v2 (all CDN)
- **Backend:** 12 Vercel serverless functions (Node.js)
- **Database:** Supabase (PostgreSQL)
- **Design:** Cormorant Garamond (display), General Sans (body)
- **Palette:** Dark bg `#0f0b08`, terracotta `#c55c34`/`#d98a64`, cream `#f5ede0`

## File Structure

### Frontend (`public/`)
| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~700 | Single page: hero, curiosity shop, pinboard, feed, game, input bar, penguin chatbot |
| `style.css` | ~2400 | Design tokens, all section styles, dark/light themes, responsive |
| `base.css` | ~126 | CSS reset + base element styles |
| `immersive.css` | ~365 | Depth layers: orbs, cursor, shimmer, scroll progress, glassmorphism |
| `overhaul.css` | ~826 | Factoids, constellation, botanical, scene illustrations |
| `texture.css` | ~47 | Grain/noise texture overlays |
| `polaroids.css` | ~100 | Polaroid photo styles |
| `game.css` | ~666 | Wandering Path board game styles |
| `minigames.css` | ~910 | Pong, RPS, Lucky Word modal styles |
| `app.js` | ~1264 | Core app: messages, mood, spark, themes, file upload, polling |
| `bloom.js` | ~247 | Entry animation: blooming flower canvas |
| `immersive.js` | ~191 | Lenis smooth scroll, ember particles (2D canvas), scroll progress |
| `overhaul.js` | ~454 | Factoids layer, constellation background, scene illustrations |
| `polaroids.js` | ~314 | Polaroid photo interactions |
| `game.js` | ~1227 | Wandering Path board game (2D canvas) |
| `minigames.js` | ~1797 | Pong, RPS, Lucky Word games |
| `living-canvas.js` | ~738 | (Unused) Rain/pollen/animal canvas — replaced by overhaul.js |
| `sw.js` | ~49 | Service worker for PWA |

### API (`api/`)
| File | Purpose |
|------|---------|
| `auth.js` | PIN verification, token issuance |
| `messages.js` | CRUD for text/photo/video/voice messages + reactions |
| `game.js` | Wandering Path game state |
| `challenge.js` | Challenge system |
| `daily-spark.js` | Daily inspirational quote |
| `mood.js` | Mood/vibe status |
| `poll.js` | Polling for updates |
| `reactions.js` | Message reactions |
| `status.js` | Read receipts + typing indicators |
| `word-reflection.js` | Word reflection feature |
| `setup.js` | Database table creation |
| `client-config.js` | Returns Supabase URL/key to frontend |

### Shared (`lib/`)
| File | Purpose |
|------|---------|
| `db.js` | Supabase client init |
| `auth.js` | Token verification middleware |
| `cors.js` | CORS headers |
| `helpers.js` | Shared utilities |

## Key Patterns
- All auth via Bearer token header: `ss-raphael-taylor-2026`
- PIN gate shows before main content, bloom animation plays first visit
- Two users only: `raphael` and `taylor` — friends, NOT romantic
- Factoids are user-generated (seed data as placeholders)
- No fake/seeded messages in feed — ever
- Three.js loaded but not yet rendering a scene (opportunity for shader hero)
- GSAP loaded for animation orchestration
- Dark mode default, light mode toggle available

## Vercel Config
- 12 serverless functions (Hobby plan max — do NOT add more)
- Static files served from `public/`
- Rewrites in `vercel.json` for API routing
