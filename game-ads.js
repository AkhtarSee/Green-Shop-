// ============================================
// GREEN SHOP — GAME ADS SYSTEM
// Popunder ad game start par chalega
// ============================================

(function () {

  // ── 1. Adsterra Popunder Script Load ───────
  function loadAdsterraScript() {
    const existing = document.getElementById('gs-adsterra-pop');
    if (existing) return; // Already loaded

    const script = document.createElement('script');
    script.id = 'gs-adsterra-pop';
    script.src = 'https://pl29056314.effectivecpmnetwork.com/43/ec/db/43ecdbe77db52d5da8a3bf92eba55149.js';
    script.async = true;
    document.head.appendChild(script);
  }

  // ── 2. Ad dikhao ───────────────────────────
  function showGameAd(callback) {
    // Popunder script load karo
    loadAdsterraScript();

    // Ad counter screen dikhao
    showAdCounter(callback);
  }

  // ── 3. Ad Counter Screen ───────────────────
  function showAdCounter(callback) {
    const existing = document.getElementById('gs-game-ad-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gs-game-ad-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99990;
      background:rgba(0,0,0,0.92);
      display:flex; align-items:center; justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      flex-direction:column; gap:16px;
    `;

    overlay.innerHTML = `
      <div style="text-align:center; padding:20px;">
        <div style="font-size:48px; margin-bottom:8px">🎮</div>
        <h3 style="color:white; font-size:20px; margin:0 0 4px">Game Loading...</h3>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 24px">Ad dekho — phir game shuru hoga!</p>

        <div style="
          width:80px; height:80px; border-radius:50%;
          background:linear-gradient(135deg,#16a34a,#15803d);
          display:flex; align-items:center; justify-content:center;
          margin:0 auto 16px;
          box-shadow:0 0 30px rgba(22,163,74,0.5);
        ">
          <span id="gs-ad-counter" style="color:white; font-size:28px; font-weight:800">5</span>
        </div>

        <p style="color:#6b7280; font-size:12px">Game <span id="gs-ad-sec">5</span> seconds mein shuru hoga...</p>

        <div style="
          width:200px; height:4px; background:#374151;
          border-radius:4px; margin:16px auto 0; overflow:hidden;
        ">
          <div id="gs-ad-progress" style="
            height:100%; background:linear-gradient(90deg,#16a34a,#22c55e);
            border-radius:4px; width:0%; transition:width 1s linear;
          "></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Countdown
    let seconds = 5;
    const counterEl = document.getElementById('gs-ad-counter');
    const secEl = document.getElementById('gs-ad-sec');
    const progressEl = document.getElementById('gs-ad-progress');

    // Progress bar start
    setTimeout(() => {
      if (progressEl) progressEl.style.width = '100%';
    }, 100);

    const timer = setInterval(() => {
      seconds--;
      if (counterEl) counterEl.textContent = seconds;
      if (secEl) secEl.textContent = seconds;

      if (seconds <= 0) {
        clearInterval(timer);
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s';
        setTimeout(() => {
          overlay.remove();
          if (typeof callback === 'function') callback();
        }, 400);
      }
    }, 1000);
  }

  // ── 4. Game Start Buttons intercept karo ───
  function interceptGameButtons() {

    // Tap Battle start button
    const tapBattleSelectors = [
      '[onclick*="startTapBattle"]',
      '[onclick*="tbStart"]',
      '[onclick*="joinBattle"]',
      '[onclick*="joinTB"]',
      '[onclick*="enterGame"]',
      '[onclick*="startGame"]',
      '#tbJoinBtn',
      '#tapBattleStart',
    ];

    tapBattleSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        if (btn._gsAdWrapped) return;
        btn._gsAdWrapped = true;

        const originalOnclick = btn.getAttribute('onclick');
        btn.removeAttribute('onclick');

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();

          showGameAd(() => {
            // Ad khatam — original function chalo
            if (originalOnclick) {
              try { eval(originalOnclick); } catch (err) { }
            }
          });
        });
      });
    });

    // Race/P2E start button
    const raceSelectors = [
      '[onclick*="startRace"]',
      '[onclick*="joinRace"]',
      '[onclick*="raceStart"]',
      '[onclick*="enterRace"]',
      '#raceStartBtn',
      '#joinRaceBtn',
    ];

    raceSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        if (btn._gsAdWrapped) return;
        btn._gsAdWrapped = true;

        const originalOnclick = btn.getAttribute('onclick');
        btn.removeAttribute('onclick');

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();

          showGameAd(() => {
            if (originalOnclick) {
              try { eval(originalOnclick); } catch (err) { }
            }
          });
        });
      });
    });

    // Text se dhundho — "Start", "Join", "Race Now", "Play"
    document.querySelectorAll('button, [role="button"], .btn, [onclick]').forEach(btn => {
      if (btn._gsAdWrapped) return;
      const txt = btn.textContent.trim().toLowerCase();
      const onclick = btn.getAttribute('onclick') || '';

      const isGameBtn = (
        (txt.includes('start') || txt.includes('join') || txt.includes('race now') || txt.includes('play now')) &&
        (onclick.includes('race') || onclick.includes('battle') || onclick.includes('game') ||
         onclick.includes('Race') || onclick.includes('Battle') || onclick.includes('Game'))
      );

      if (isGameBtn) {
        btn._gsAdWrapped = true;
        const originalOnclick = btn.getAttribute('onclick');
        btn.removeAttribute('onclick');

        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          showGameAd(() => {
            if (originalOnclick) {
              try { eval(originalOnclick); } catch (err) { }
            }
          });
        });
      }
    });
  }

  // ── 5. Main ────────────────────────────────
  function init() {
    // DOM ready hone ke baad buttons dhundho
    setTimeout(interceptGameButtons, 1000);
    setTimeout(interceptGameButtons, 3000); // Double check

    // MutationObserver — naye buttons bhi catch karo
    const observer = new MutationObserver(() => {
      interceptGameButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Global function — manually bhi call kar sako
  window.gsShowGameAd = showGameAd;

})();
