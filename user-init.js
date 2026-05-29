// ============================================
// GREEN SHOP — USER INIT SYSTEM
// Har naye user ka fresh start + unique referral
// ============================================

(function () {

  // ── 1. Unique ID generator ──────────────────
  function generateUID() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let uid = '';
    for (let i = 0; i < 8; i++) {
      uid += chars[Math.floor(Math.random() * chars.length)];
    }
    return uid;
  }

  // ── 2. URL se referral code check karo ──────
  function getReferrerFromURL() {
    const hash = window.location.hash; // #ref=ABCD1234
    const search = window.location.search; // ?ref=ABCD1234
    let ref = null;
    const hashMatch = hash.match(/[#&]ref=([A-Z0-9]+)/i);
    const searchMatch = search.match(/[?&]ref=([A-Z0-9]+)/i);
    if (hashMatch) ref = hashMatch[1].toUpperCase();
    else if (searchMatch) ref = searchMatch[1].toUpperCase();
    return ref;
  }

  // ── 3. User data load/save ──────────────────
  function loadUser() {
    try {
      const data = localStorage.getItem('gs_user');
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  }

  function saveUser(user) {
    try {
      localStorage.setItem('gs_user', JSON.stringify(user));
    } catch (e) { }
  }

  // ── 4. Fresh user object ────────────────────
  function createFreshUser(name, phone, referredBy) {
    const uid = generateUID();
    return {
      uid: uid,
      name: name,
      phone: phone,
      referralCode: uid,
      referralLink: window.location.origin + window.location.pathname + '?ref=' + uid,
      coins: 0,
      orders: [],
      totalSaved: 0,
      totalOrders: 0,
      referredBy: referredBy || null,
      referredCount: 0,
      referredCoinsEarned: 0,
      joinedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      loginStreak: 1,
    };
  }

  // ── 5. Registration Screen HTML ─────────────
  function showRegistration(referredBy) {
    // Agar already registered ho toh mat dikhao
    const existing = loadUser();
    if (existing && existing.name) return;

    const overlay = document.createElement('div');
    overlay.id = 'gs-register-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:linear-gradient(135deg,#f0fdf4,#dcfce7);
      display:flex; align-items:center; justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      padding:20px;
    `;

    overlay.innerHTML = `
      <div style="
        background:white; border-radius:24px; padding:36px 28px;
        max-width:360px; width:100%;
        box-shadow:0 20px 60px rgba(0,0,0,0.15);
        text-align:center;
      ">
        <div style="font-size:56px;margin-bottom:8px">🛒</div>
        <h2 style="color:#16a34a;font-size:22px;margin:0 0 4px">Green Shop</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 24px">Giridih, Jharkhand • Shop & Earn Coins</p>

        ${referredBy ? `
        <div style="
          background:#f0fdf4; border:1px solid #86efac;
          border-radius:12px; padding:12px; margin-bottom:20px;
          font-size:13px; color:#16a34a; font-weight:600;
        ">
          🎁 Aapko invite kiya gaya! <br>
          <span style="color:#15803d">Signup bonus 🪙25 milega!</span>
        </div>` : ''}

        <div style="margin-bottom:16px; text-align:left">
          <label style="font-size:13px;color:#374151;font-weight:600;display:block;margin-bottom:6px">
            👤 Apna Naam *
          </label>
          <input id="gs-reg-name" type="text" placeholder="Jaise: Rahul Kumar"
            style="
              width:100%; padding:12px 14px; border:2px solid #e5e7eb;
              border-radius:12px; font-size:15px; box-sizing:border-box;
              outline:none; transition:border 0.2s;
            "
            onfocus="this.style.border='2px solid #16a34a'"
            onblur="this.style.border='2px solid #e5e7eb'"
          />
        </div>

        <div style="margin-bottom:24px; text-align:left">
          <label style="font-size:13px;color:#374151;font-weight:600;display:block;margin-bottom:6px">
            📱 Phone Number *
          </label>
          <input id="gs-reg-phone" type="tel" placeholder="10 digit number"
            maxlength="10"
            style="
              width:100%; padding:12px 14px; border:2px solid #e5e7eb;
              border-radius:12px; font-size:15px; box-sizing:border-box;
              outline:none; transition:border 0.2s;
            "
            onfocus="this.style.border='2px solid #16a34a'"
            onblur="this.style.border='2px solid #e5e7eb'"
          />
        </div>

        <div id="gs-reg-error" style="
          color:#ef4444; font-size:13px; margin-bottom:12px; display:none;
        "></div>

        <button id="gs-reg-btn" onclick="window.gsRegister()" style="
          background:linear-gradient(135deg,#16a34a,#15803d);
          color:white; border:none; padding:16px;
          border-radius:14px; font-size:16px; font-weight:700;
          width:100%; cursor:pointer; letter-spacing:0.5px;
          box-shadow:0 4px 15px rgba(22,163,74,0.4);
        ">
          🚀 Green Shop Shuru Karo!
        </button>

        <p style="font-size:11px;color:#9ca3af;margin-top:16px;line-height:1.5">
          Aapka data sirf aapke phone mein safe rahega.<br>
          Kisi ke saath share nahi hoga. 🔒
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    // Register function
    window.gsRegister = function () {
      const name = document.getElementById('gs-reg-name').value.trim();
      const phone = document.getElementById('gs-reg-phone').value.trim();
      const errEl = document.getElementById('gs-reg-error');
      const btn = document.getElementById('gs-reg-btn');

      if (!name || name.length < 2) {
        errEl.textContent = '⚠️ Naam kam se kam 2 characters ka hona chahiye!';
        errEl.style.display = 'block';
        return;
      }
      if (!phone || phone.length !== 10 || isNaN(phone)) {
        errEl.textContent = '⚠️ Sahi 10 digit phone number daalo!';
        errEl.style.display = 'block';
        return;
      }

      errEl.style.display = 'none';
      btn.textContent = '⏳ Register ho raha hai...';
      btn.disabled = true;

      const user = createFreshUser(name, phone, referredBy);

      // Referral bonus
      if (referredBy) {
        user.coins += 25; // New user ko 25 coins
        // Referrer ka reward — localStorage mein
        const allUsers = JSON.parse(localStorage.getItem('gs_all_referrals') || '{}');
        if (!allUsers[referredBy]) allUsers[referredBy] = { count: 0, earned: 0 };
        allUsers[referredBy].count += 1;
        allUsers[referredBy].earned += 50;
        localStorage.setItem('gs_all_referrals', JSON.stringify(allUsers));
      }

      saveUser(user);

      // App mein user data inject karo
      gsApplyUserToApp(user);

      // Remove overlay
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          // Welcome toast
          gsShowToast(`🎉 Welcome ${user.name}! 🪙 ${user.coins} coins mile!`);
        }, 500);
      }, 500);
    };

    // Enter key support
    document.getElementById('gs-reg-phone').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') window.gsRegister();
    });
  }

  // ── 6. App mein user data lagao ─────────────
  function gsApplyUserToApp(user) {
    // Coin balance update
    const coinEls = document.querySelectorAll('[id*="coin"], [class*="coin-bal"], [class*="coinBal"]');
    coinEls.forEach(el => {
      if (el.textContent.match(/^\d+$/)) el.textContent = user.coins;
    });

    // Name update
    const nameEls = document.querySelectorAll('[id*="userName"], [id*="user-name"], [class*="user-name"]');
    nameEls.forEach(el => { el.textContent = user.name; });

    // Referral code update — har jagah CYCLE7749 wala replace karo
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent.trim() === 'CYCLE7749') {
        el.textContent = user.referralCode;
      }
    });

    // Referral link update
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('akhtarsee.github.io/Green-Shop-/#ref=')) {
        el.textContent = user.referralLink;
      }
    });

    // LocalStorage mein save karo taaki app ke baaki functions bhi use kar sakein
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userPhone', user.phone);
    localStorage.setItem('userCoins', user.coins);
    localStorage.setItem('userReferralCode', user.referralCode);
    localStorage.setItem('userReferralLink', user.referralLink);
    localStorage.setItem('userUID', user.uid);
  }

  // ── 7. Toast message ───────────────────────
  window.gsShowToast = function(msg) {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
      background:#16a34a; color:white; padding:14px 24px;
      border-radius:30px; font-size:14px; font-weight:600;
      z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.2);
      max-width:300px; text-align:center;
      animation: gsSlideUp 0.4s ease;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.5s'; }, 3000);
    setTimeout(() => t.remove(), 3500);
  };

  // ── 8. Main entry point ─────────────────────
  function init() {
    const referredBy = getReferrerFromURL();
    const existingUser = loadUser();

    if (!existingUser || !existingUser.name) {
      // Naya user — registration dikhao
      showRegistration(referredBy);
    } else {
      // Purana user — data apply karo
      existingUser.lastLogin = new Date().toISOString();
      saveUser(existingUser);
      gsApplyUserToApp(existingUser);

      // Referral se aaya lekin already registered hai
      if (referredBy && referredBy !== existingUser.referralCode) {
        gsShowToast(`👋 Wapas aaye ${existingUser.name}! 🪙 ${existingUser.coins} coins`);
      }
    }
  }

  // DOM ready hone par chalao
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
