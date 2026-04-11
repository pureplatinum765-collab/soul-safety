/**
 * scroll-fx.js — Soul Safety Scroll Effects
 * GSAP-powered section reveals, parallax, and micro-interactions.
 * Requires GSAP (already loaded via CDN).
 */
(function () {
  'use strict';

  var gsap = window.gsap;
  if (!gsap) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Register ScrollTrigger if loaded, else use IntersectionObserver fallback ──
  // We don't load ScrollTrigger plugin to keep things light — use IO instead

  // ── Section Reveal Animation ──────────────────────────────────────────
  function revealSections() {
    var sections = document.querySelectorAll(
      '.curiosity-shop, .milanote-section, .daily-spark-inline, .mood-section, .feed-section, .game-section'
    );

    if (reducedMotion) {
      sections.forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }

    // Set initial state
    sections.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(40px)';
      el.style.transition = 'none';
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            delay: 0.1,
          });
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    sections.forEach(function (el) { observer.observe(el); });
  }

  // ── Parallax Depth for Hero ───────────────────────────────────────────
  function heroParallax() {
    if (reducedMotion) return;

    var heroContent = document.querySelector('.hero-content');
    var heroLogo = document.querySelector('.hero-logo');
    if (!heroContent) return;

    var lastScroll = 0;
    var ticking = false;

    function updateParallax() {
      var scrollY = window.scrollY;
      var heroH = document.getElementById('hero').offsetHeight;
      if (scrollY > heroH) { ticking = false; return; }

      var progress = scrollY / heroH;

      // Content moves up + fades out
      heroContent.style.transform = 'translateY(' + (scrollY * 0.3) + 'px)';
      heroContent.style.opacity = Math.max(0, 1 - progress * 1.5);

      // Logo subtle scale
      if (heroLogo) {
        heroLogo.style.transform = 'scale(' + (1 + progress * 0.2) + ')';
      }

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  // ── Hover Glow Effects ────────────────────────────────────────────────
  function hoverGlows() {
    if (reducedMotion) return;

    // Curiosity Shop cards
    var cards = document.querySelectorAll('.curiosity-card');
    cards.forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        gsap.to(this, { scale: 1.05, duration: 0.3, ease: 'power2.out' });
      });
      card.addEventListener('mouseleave', function () {
        gsap.to(this, { scale: 1, duration: 0.3, ease: 'power2.out' });
      });
    });

    // Mood emoji buttons
    var moods = document.querySelectorAll('.mood-emoji-btn');
    moods.forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        gsap.to(this, { scale: 1.2, duration: 0.2, ease: 'back.out(2)' });
      });
      btn.addEventListener('mouseleave', function () {
        gsap.to(this, { scale: 1, duration: 0.2, ease: 'power2.out' });
      });
    });

    // Send button pulse
    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('mouseenter', function () {
        gsap.to(this, { scale: 1.08, duration: 0.2, ease: 'power2.out' });
      });
      sendBtn.addEventListener('mouseleave', function () {
        gsap.to(this, { scale: 1, duration: 0.2 });
      });
    }
  }

  // ── Stagger Feed Messages on Load ─────────────────────────────────────
  function staggerFeed() {
    if (reducedMotion) return;

    // Watch for messages being added to the feed
    var feedContainer = document.getElementById('feedContainer');
    if (!feedContainer) return;

    var feedObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && node.classList && node.classList.contains('message-bubble')) {
            node.style.opacity = '0';
            node.style.transform = 'translateY(12px)';
            gsap.to(node, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.05 });
          }
        });
      });
    });

    feedObserver.observe(feedContainer, { childList: true, subtree: true });
  }

  // ── Floating Action Buttons Entrance ──────────────────────────────────
  function floatingEntrance() {
    if (reducedMotion) return;

    var penguin = document.getElementById('penguinWidget');
    var scrollTop = document.getElementById('scrollTopBtn');

    if (penguin) {
      gsap.from(penguin, { scale: 0, opacity: 0, duration: 0.6, ease: 'back.out(2)', delay: 2 });
    }
  }

  // ── Magnetic Button Effect ────────────────────────────────────────────
  function magneticButtons() {
    if (reducedMotion || window.innerWidth < 768) return;

    var btns = document.querySelectorAll('.btn-enter, .btn-game--primary');
    btns.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: x * 0.2, y: y * 0.2, duration: 0.3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    revealSections();
    heroParallax();
    hoverGlows();
    staggerFeed();
    floatingEntrance();
    magneticButtons();
  }

})();
