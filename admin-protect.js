// ============================================
// GREEN SHOP — ADMIN PROTECTION SYSTEM
// Admin button hide + Secret tap + Password
// ============================================

(function () {

  // ══════════════════════════════════════════
  // ⚙️ SETTINGS — Yahan apna password set karo
  // ══════════════════════════════════════════
  const ADMIN_PASSWORD = 'GreenShop@1234'; // 👈 Apna password yahan likhein
  const SECRET_TAPS    = 7;                // Kitni baar tap karne par admin khule
  const SECRET_ELEMENT = 'gNav';          // Kahan tap karna hai (footer nav id)
  const TAP_TIMEOUT_MS = 3000;            // 3 second mein X taps karne honge
  // ══════════════════════════════════════════

  let tapCount  = 0;
  let tapTimer  = null;

  // ── 1. Admin button/tab hide karo ──────────
  function hideAdminElements() {
    // Bottom nav mein "Admin" tab hide karo
    const allNavItems = document.querySelectorAll('#gNav a, #gNav button, #gNav .nav-item, #gNav [onclick]');
    allNavItems.forEach(el => {
      if (el.textContent.includes('Admin') || el.getAttribute('onclick')?.includes('admin') ||
          el.getAttribute('onclick')?.includes('Admin')) {
        el.style.display = 'none';
        el.setAttribute('data-gs-admin-hidden', 'true');
      }
    });

    // P2E nav mein bhi hide karo
    const p2eNavItems = document.querySelectorAll('#pNav a, #pNav button, #pNav .nav-item, #pNav [onclick]');
    p2eNavItems.forEach(el => {
      if (el.textContent.includes('Admin') || el.getAttribute('onclick')?.includes('admin') ||
          el.getAttribute('onclick')?.includes('Admin')) {
        el.style.display = 'none';
        el.setAttribute('data-gs-admin-hidden', 'true');
      }
    });

    // Koi bhi element jo "Admin Panel" text dikhata ho
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0) {
        const txt = el.textContent.trim();
        if (txt === '⚙️ Admin' || txt === 'Admin' || txt === '⚙️') {
          const parent = el.closest('a, button, [onclick]');
          if (parent) {
            parent.style.display = 'none';
            parent.setAttribute('data-gs-admin-hidden', 'true');
          }
        }
      }
    });
  }

  // ── 2. Admin screen bhi hide karo ──────────
  function hideAdminScreen() {
    const adminScreen = document.getElementById('screen-admin') ||
                        document.querySelector('[id*="admin"]');
    if (adminScreen) {
      adminScreen.style.display = 'none';
    }
  }

  // ── 3. Secret Tap System ───────────────────
  function setupSecretTap() {
    // Logo ya header par tap karo 7 baar
    const logo = document.querySelector('#gNav, .app-header, header, #screen-ghome h1, h1');

    if (!logo) return;

    logo.addEventListener('click', function (e) {
      tapCount++;

      if (tapTimer) clearTimeout(tapTimer);

      // Feedback dikhao
      if (tapCount > 2) {
        gsAdminToast(`🔐 ${SECRET_TAPS - tapCount} aur tap karo...`, '#374151');
      }

      if (tapCount >= SECRET_TAPS) {
        tapCount = 0;
        clearTimeout(tapTimer);
        showAdminPasswordPrompt();
        return;
      }

      tapTimer = setTimeout(() => {
        tapCount = 0;
      }, TAP_TIMEOUT_MS);
    });
  }

  // ── 4. Password Prompt ─────────────────────
  function showAdminPasswordPrompt() {
    // Agar pehle se overlay hai toh remove karo
    const existing = document.getElementById('gs-admin-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gs-admin-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      padding:20px;
      backdrop-filter:blur(4px);
    `;

    overlay.innerHTML = `
      <div style="
        background:white; border-radius:24px; padding:32px 28px;
        max-width:320px; width:100%;
        box-shadow:0 20px 60px rgba(0,0,0,0.4);
        text-align:center;
      ">
        <div style="font-size:48px;margin-bottom:8px">🔐</div>
        <h3 style="color:#1f2937;font-size:18px;margin:0 0 4px">Admin Access</h3>
        <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Green Shop Admin Panel</p>

        <input id="gs-admin-pass" type="password" placeholder="Password daalo"
          style="
            width:100%; padding:12px 14px; border:2px solid #e5e7eb;
            border-radius:12px; font-size:15px; box-sizing:border-box;
            outline:none; margin-bottom:8px; text-align:center;
            letter-spacing:4px;
          "
          onfocus="this.style.border='2px solid #16a34a'"
          onblur="this.style.border='2px solid #e5e7eb'"
        />

        <div id="gs-admin-err" style="
          color:#ef4444; font-size:12px; margin-bottom:12px; display:none; min-height:16px;
        "></div>

        <button onclick="window.gsAdminLogin()" style="
          background:linear-gradient(135deg,#1f2937,#374151);
          color:white; border:none; padding:14px;
          border-radius:12px; font-size:15px; font-weight:700;
          width:100%; cursor:pointer; margin-bottom:10px;
        ">
          🔓 Login
        </button>

        <button onclick="document.getElementById('gs-admin-overlay').remove()" style="
          background:#f3f4f6; color:#6b7280; border:none; padding:10px;
          border-radius:12px; font-size:14px; width:100%; cursor:pointer;
        ">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Auto focus
    setTimeout(() => {
      const inp = document.getElementById('gs-admin-pass');
      if (inp) inp.focus();
    }, 100);

    // Enter key
    document.getElementById('gs-admin-pass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.gsAdminLogin();
    });
  }

  // ── 5. Password check ─────────────────────
  window.gsAdminLogin = function () {
    const input = document.getElementById('gs-admin-pass');
    const errEl = document.getElementById('gs-admin-err');

    if (!input) return;

    const entered = input.value;

    if (entered === ADMIN_PASSWORD) {
      // Sahi password!
      document.getElementById('gs-admin-overlay').remove();
      openAdminPanel();
      gsAdminToast('✅ Admin access mila!', '#16a34a');

      // Session mein save karo (sirf is session ke liye)
      sessionStorage.setItem('gs_admin_auth', '1');
    } else {
      errEl.textContent = '❌ Galat password! Dobara try karo.';
      errEl.style.display = 'block';
      input.value = '';
      input.focus();

      // 3 baar galat = lock
      let attempts = parseInt(sessionStorage.getItem('gs_admin_attempts') || '0') + 1;
      sessionStorage.setItem('gs_admin_attempts', attempts);
      if (attempts >= 3) {
        errEl.textContent = '🔒 Bahut zyada attempts! 30 sec wait karo.';
        document.querySelector('#gs-admin-overlay button').disabled = true;
        setTimeout(() => {
          sessionStorage.setItem('gs_admin_attempts', '0');
          const btn = document.querySelector('#gs-admin-overlay button');
          if (btn) btn.disabled = false;
          errEl.textContent = '';
        }, 30000);
      }
    }
  };

  // ── 6. Admin panel open karo ───────────────
  function openAdminPanel() {
    // Existing switchToAdmin function call karo agar hai
    if (typeof switchToAdmin === 'function') {
      switchToAdmin();
      return;
    }

    // Ya screen show karo
    const adminScreen = document.getElementById('screen-admin');
    if (adminScreen) {
      document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
      adminScreen.style.display = 'flex';
      return;
    }

    // Ya onclick trigger karo
    const adminBtn = document.querySelector('[onclick*="admin"], [onclick*="Admin"]');
    if (adminBtn) {
      const fn = adminBtn.getAttribute('onclick');
      if (fn) eval(fn);
    }
  }

  // ── 7. Toast helper ────────────────────────
  function gsAdminToast(msg, bg) {
    const old = document.getElementById('gs-admin-toast');
    if (old) old.remove();

    const t = document.createElement('div');
    t.id = 'gs-admin-toast';
    t.style.cssText = `
      position:fixed; top:60px; left:50%; transform:translateX(-50%);
      background:${bg || '#1f2937'}; color:white; padding:10px 20px;
      border-radius:20px; font-size:13px; font-weight:600;
      z-index:99998; box-shadow:0 4px 15px rgba(0,0,0,0.3);
      pointer-events:none;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.4s'; }, 1500);
    setTimeout(() => t.remove(), 2000);
  }

  // ── 8. Main ────────────────────────────────
  function init() {
    hideAdminElements();
    hideAdminScreen();
    setupSecretTap();

    // Already authenticated is session mein?
    if (sessionStorage.getItem('gs_admin_auth') === '1') {
      // Admin tab wapas dikhao session ke liye
      document.querySelectorAll('[data-gs-admin-hidden]').forEach(el => {
        el.style.display = '';
      });
    }

    // MutationObserver — dynamically bane elements bhi hide karo
    const observer = new MutationObserver(() => {
      hideAdminElements();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
