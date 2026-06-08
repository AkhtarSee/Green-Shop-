// ============================================
// GREEN SHOP — SUPABASE REAL DATABASE
// Real Users + Real Referral + Real Coins
// ============================================

const SUPABASE_URL = 'https://amsuacmczawkhrblxojn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6vmr4B_qD-5dKF1ydm_MPg_nmj2se74';

// ── Supabase API Helper ──
async function sbFetch(endpoint, method = 'GET', body = null, extra = {}) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : '',
    ...extra
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.status === 204 ? null : res.json();
}

// ══════════════════════════════════════════
// USER FUNCTIONS
// ══════════════════════════════════════════

// User dhundho phone se
async function dbGetUserByPhone(phone) {
  try {
    const data = await sbFetch(`users?phone=eq.${phone}&limit=1`);
    return data && data.length > 0 ? data[0] : null;
  } catch (e) { return null; }
}

// User dhundho referral code se
async function dbGetUserByRef(refCode) {
  try {
    const data = await sbFetch(`users?referral_code=eq.${refCode}&limit=1`);
    return data && data.length > 0 ? data[0] : null;
  } catch (e) { return null; }
}

// Naya user banao
async function dbCreateUser(userData) {
  try {
    const data = await sbFetch('users', 'POST', {
      name: userData.name,
      phone: userData.phone,
      referral_code: userData.referralCode,
      referred_by: userData.referredBy || null,
      coins: userData.coins || 0,
      ref_count: 0,
      ref_earned: 0,
      races: 0,
      wins: 0,
      daily_date: ''
    });
    return data && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.error('Create user error:', e);
    return null;
  }
}

// User update karo
async function dbUpdateUser(phone, updates) {
  try {
    await sbFetch(`users?phone=eq.${phone}`, 'PATCH', {
      ...updates,
      updated_at: new Date().toISOString()
    });
    return true;
  } catch (e) {
    console.error('Update user error:', e);
    return false;
  }
}

// Referrer ko coins do
async function dbGiveReferralBonus(refCode, bonusCoins) {
  try {
    const referrer = await dbGetUserByRef(refCode);
    if (!referrer) return false;

    await dbUpdateUser(referrer.phone, {
      coins: (referrer.coins || 0) + bonusCoins,
      ref_count: (referrer.ref_count || 0) + 1,
      ref_earned: (referrer.ref_earned || 0) + bonusCoins
    });

    console.log(`✅ Referral bonus given to ${referrer.name}: +${bonusCoins} coins`);
    return true;
  } catch (e) {
    console.error('Referral bonus error:', e);
    return false;
  }
}

// Leaderboard
async function dbGetLeaderboard(limit = 10) {
  try {
    const data = await sbFetch(`users?order=coins.desc&limit=${limit}`);
    return data || [];
  } catch (e) { return []; }
}

// ══════════════════════════════════════════
// MAIN INTEGRATION
// ══════════════════════════════════════════

(function () {
  'use strict';

  const REFERRAL_NEW_USER = 25;
  const REFERRAL_BONUS = 50;
  const DAILY_COINS = 1;

  function generateUID() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let uid = 'GS';
    for (let i = 0; i < 6; i++) uid += chars[Math.floor(Math.random() * chars.length)];
    return uid;
  }

  function getReferrerFromURL() {
    const hash = window.location.hash;
    const search = window.location.search;
    const hashMatch = hash.match(/[#&]ref=([A-Z0-9\-]+)/i);
    const searchMatch = search.match(/[?&]ref=([A-Z0-9\-]+)/i);
    if (hashMatch) return hashMatch[1].toUpperCase();
    if (searchMatch) return searchMatch[1].toUpperCase();
    return null;
  }

  function loadLocalUser() {
    try {
      const d = localStorage.getItem('gs_user_v3');
      return d ? JSON.parse(d) : null;
    } catch (e) { return null; }
  }

  function saveLocalUser(u) {
    try { localStorage.setItem('gs_user_v3', JSON.stringify(u)); } catch (e) {}
  }

  function applyUserToApp(user) {
    if (!user) return;

    // Coins
    window.coins = user.coins || 0;
    const coinIds = ['gCoinDisp','gStoreCoinDisp','pCoinDisp','pWalletBig',
                     'gsCoinsDisp','ppCoinsDisp','gProfileCoins','dkCoinDisp',
                     'gWalletCoins','ppCoinBig'];
    coinIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = (user.coins || 0).toLocaleString('en-IN');
    });

    // INR value
    const inr = document.getElementById('pWalletInr');
    if (inr) inr.textContent = ((user.coins || 0) / 100).toFixed(2);

    const gWalletRs = document.getElementById('gWalletRs');
    if (gWalletRs) gWalletRs.textContent = Math.floor((user.coins || 0) / 100).toLocaleString('en-IN');

    // Referral code
    const refCode = user.referral_code || user.referralCode || '';
    ['refCode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = refCode;
    });

    // Referral link
    const refLink = `${window.location.origin}${window.location.pathname}?ref=${refCode}`;
    const refLinkBox = document.getElementById('refLinkBox');
    if (refLinkBox) refLinkBox.textContent = refLink;

    // DK code
    const dkCodeEl = document.getElementById('dkCode');
    if (dkCodeEl) dkCodeEl.textContent = 'DK-' + refCode;

    // Ref stats
    const rc = document.getElementById('refCount');
    const rc2 = document.getElementById('refCount2');
    const re = document.getElementById('refEarned');
    const re2 = document.getElementById('refEarned2');
    if (rc) rc.textContent = user.ref_count || 0;
    if (rc2) rc2.textContent = user.ref_count || 0;
    if (re) re.textContent = user.ref_earned || 0;
    if (re2) re2.textContent = user.ref_earned || 0;

    // Name update
    const nameEls = document.querySelectorAll('*');
    nameEls.forEach(el => {
      if (el.children.length === 0) {
        if (el.textContent.trim() === 'Rahul Kumar') el.textContent = user.name;
        if (el.textContent.trim() === 'CYCLE7749') el.textContent = refCode;
        if (el.textContent.includes('CYCLE7749')) el.textContent = el.textContent.replace('CYCLE7749', refCode);
        if (el.textContent.trim() === 'DKAAN-7749') el.textContent = 'DK-' + refCode;
        if (el.textContent.trim() === 'RIDER_7749') el.textContent = 'RIDER_' + refCode.slice(-4);
      }
    });

    // Shopping status
    const gss = document.getElementById('gShopStatus');
    if (gss) {
      if ((user.coins || 0) >= 500) {
        gss.textContent = '✅ Shopping allowed';
        gss.style.color = '#16a34a';
      } else {
        gss.textContent = `❌ ${500 - (user.coins || 0)} coins aur chahiye`;
        gss.style.color = '#ff4560';
      }
    }

    // LocalStorage sync
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userCoins', user.coins || 0);
    localStorage.setItem('userReferralCode', refCode);
    localStorage.setItem('userReferralLink', refLink);
  }

  // ── Registration Screen ──
  function showRegistration(referredBy) {
    const overlay = document.createElement('div');
    overlay.id = 'gs-reg-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:linear-gradient(135deg,#f0fdf4,#dcfce7);
      display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      padding:20px;
    `;
    overlay.innerHTML = `
      <div style="background:white;border-radius:24px;padding:32px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.15);text-align:center;">
        <div style="font-size:52px;margin-bottom:8px">🛒</div>
        <h2 style="color:#16a34a;font-size:22px;margin:0 0 4px;font-weight:800">Green Shop</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Giridih, Jharkhand • Shop & Earn Coins</p>
        ${referredBy ? `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;color:#16a34a;font-weight:600;">
          🎁 Aapko invite kiya gaya!<br>
          <span style="color:#15803d">Signup bonus 🪙${REFERRAL_NEW_USER} coins milenge!</span>
        </div>` : ''}
        <div style="margin-bottom:14px;text-align:left">
          <label style="font-size:12px;color:#374151;font-weight:700;display:block;margin-bottom:5px">👤 Apna Naam *</label>
          <input id="gs-reg-name" type="text" placeholder="Jaise: Rahul Kumar"
            style="width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;box-sizing:border-box;outline:none;"
            onfocus="this.style.border='2px solid #16a34a'" onblur="this.style.border='2px solid #e5e7eb'"/>
        </div>
        <div style="margin-bottom:20px;text-align:left">
          <label style="font-size:12px;color:#374151;font-weight:700;display:block;margin-bottom:5px">📱 Phone Number *</label>
          <input id="gs-reg-phone" type="tel" placeholder="10 digit number" maxlength="10"
            style="width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;box-sizing:border-box;outline:none;"
            onfocus="this.style.border='2px solid #16a34a'" onblur="this.style.border='2px solid #e5e7eb'"/>
        </div>
        <div id="gs-reg-err" style="color:#ef4444;font-size:13px;margin-bottom:10px;display:none;min-height:16px"></div>
        <button id="gs-reg-btn" onclick="window._gsRegister()" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;border:none;padding:16px;border-radius:14px;font-size:16px;font-weight:700;width:100%;cursor:pointer;box-shadow:0 4px 15px rgba(22,163,74,.4);">
          🚀 Green Shop Shuru Karo!
        </button>
        <p style="font-size:11px;color:#9ca3af;margin-top:14px">Aapka data safe rahega 🔒</p>
      </div>
    `;
    document.body.appendChild(overlay);

    window._gsRegister = async function () {
      const name = document.getElementById('gs-reg-name').value.trim();
      const phone = document.getElementById('gs-reg-phone').value.trim();
      const errEl = document.getElementById('gs-reg-err');
      const btn = document.getElementById('gs-reg-btn');

      if (!name || name.length < 2) {
        errEl.textContent = '⚠️ Naam kam se kam 2 characters ka hona chahiye!';
        errEl.style.display = 'block'; return;
      }
      if (!phone || phone.length !== 10 || isNaN(phone)) {
        errEl.textContent = '⚠️ Sahi 10 digit phone number daalo!';
        errEl.style.display = 'block'; return;
      }

      errEl.style.display = 'none';
      btn.textContent = '⏳ Register ho raha hai...';
      btn.disabled = true;

      // Phone already registered check
      const existing = await dbGetUserByPhone(phone);
      if (existing) {
        // Already registered — login karo
        saveLocalUser(existing);
        window._gsCurrentUser = existing;
        applyUserToApp(existing);
        overlay.remove();
        gsToast(`👋 Wapas aaye ${existing.name}! 🪙 ${existing.coins} coins`, 'coin');
        return;
      }

      // Naya user banao
      const refCode = generateUID();
      const newCoins = referredBy ? REFERRAL_NEW_USER : 0;

      const dbUser = await dbCreateUser({
        name, phone,
        referralCode: refCode,
        referredBy: referredBy || null,
        coins: newCoins
      });

      if (!dbUser) {
        errEl.textContent = '❌ Registration failed! Dobara try karo.';
        errEl.style.display = 'block';
        btn.textContent = '🚀 Green Shop Shuru Karo!';
        btn.disabled = false;
        return;
      }

      // Referrer ko bonus do
      if (referredBy) {
        await dbGiveReferralBonus(referredBy, REFERRAL_BONUS);
      }

      saveLocalUser(dbUser);
      window._gsCurrentUser = dbUser;
      window.coins = dbUser.coins || 0;
      applyUserToApp(dbUser);

      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s';
      setTimeout(() => {
        overlay.remove();
        gsToast(`🎉 Welcome ${dbUser.name}! 🪙 ${dbUser.coins} coins mile!`, 'coin');
        if (typeof launchConfetti === 'function') launchConfetti();
      }, 400);
    };

    document.getElementById('gs-reg-phone').addEventListener('keydown', e => {
      if (e.key === 'Enter') window._gsRegister();
    });
  }

  // ── Override App Functions ──
  function overrideAppFunctions() {

    // Copy Ref
    window.copyRef = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const code = user.referral_code || user.referralCode || '';
      navigator.clipboard?.writeText(code).catch(() => {});
      gsToast(`📋 Code copied: ${code}`, 'i');
    };

    // Copy Ref Link
    window.copyRefLink = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const code = user.referral_code || user.referralCode || '';
      const link = `${window.location.origin}${window.location.pathname}?ref=${code}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      gsToast('🔗 Referral link copied!', 'i');
    };

    // Share Ref Link
    window.shareRefLink = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const code = user.referral_code || user.referralCode || '';
      const link = `${window.location.origin}${window.location.pathname}?ref=${code}`;
      const text = `🌿 GreenShop pe aao — fresh grocery + game khelo + coins kamao!\n\nMera referral link: ${link}\n\n🪙 Tumhe ${REFERRAL_NEW_USER} coins milenge signup par!`;
      if (navigator.share) {
        navigator.share({ title: 'GreenShop', text, url: link }).catch(() => {});
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
    };

    // Simulate Ref — Disable
    window.simulateRef = function () { gsToast('❌ Demo mode disabled!', 'e'); };
    window.simulateDkRef = function () { gsToast('❌ Demo mode disabled!', 'e'); };

    // Daily Login
    window.claimDaily = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const today = new Date().toDateString();
      if (user.daily_date === today) {
        gsToast('✅ Aaj ka bonus already liya!', 'i');
        return;
      }
      showDailyAdModal(async () => {
        user.coins = (user.coins || 0) + DAILY_COINS;
        user.daily_date = today;
        await dbUpdateUser(user.phone, {
          coins: user.coins,
          daily_date: today
        });
        saveLocalUser(user);
        window.coins = user.coins;
        applyUserToApp(user);
        gsToast(`✅ 🪙${DAILY_COINS} Daily bonus mila!`, 'coin');
        if (typeof launchConfetti === 'function') launchConfetti();
      });
    };

    // syncCoins override
    window.syncCoins = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (user) {
        const newCoins = window.coins || 0;
        if (newCoins !== user.coins) {
          user.coins = newCoins;
          saveLocalUser(user);
          dbUpdateUser(user.phone, { coins: newCoins });
          applyUserToApp(user);
        }
      }
    };
  }

  // ── Daily Ad Modal ──
  function showDailyAdModal(onComplete) {
    const modal = document.createElement('div');
    modal.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,sans-serif;`;
    modal.innerHTML = `
      <div style="background:#111827;border:1.5px solid rgba(240,192,64,.2);border-radius:20px;padding:24px 20px;max-width:340px;width:100%;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:8px">📺</div>
        <div style="font-size:1.2rem;color:#f0c040;font-weight:800;margin-bottom:4px">Daily Bonus Ad</div>
        <div style="font-size:.78rem;color:rgba(238,242,255,.5);margin-bottom:16px">Ad dekho aur 🪙${DAILY_COINS} coin pao!</div>
        <div style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;border:3px solid rgba(240,192,64,.3);background:rgba(240,192,64,.08);margin-bottom:10px">
          <div style="font-size:1.6rem;color:#f0c040;font-weight:800" id="dlyTimer">5</div>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-bottom:14px">
          <div id="dlyBar" style="height:100%;width:0%;background:linear-gradient(90deg,#f0c040,#22d67a);border-radius:3px;transition:width 1s linear"></div>
        </div>
        <button id="dlyBtn" disabled style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#f0c040,#e8a800);color:#000;font-size:.95rem;font-weight:800;cursor:pointer;opacity:.3;pointer-events:none;transition:.3s">
          🪙 +${DAILY_COINS} Coin Lo!
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => { const b = document.getElementById('dlyBar'); if (b) b.style.width = '100%'; }, 100);
    let s = 5;
    const t = setInterval(() => {
      s--;
      const el = document.getElementById('dlyTimer');
      if (el) el.textContent = Math.max(0, s);
      if (s <= 0) {
        clearInterval(t);
        const btn = document.getElementById('dlyBtn');
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.onclick = () => { modal.remove(); if (typeof onComplete === 'function') onComplete(); };
        }
      }
    }, 1000);
  }

  // ── Toast ──
  function gsToast(msg, type) {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.className = `show ${type || 'g'}`;
      clearTimeout(window._gsToastT);
      window._gsToastT = setTimeout(() => { t.className = ''; }, 3000);
    }
  }

  // ── Admin Hide ──
  function hideAdmin() {
    const adminNav = document.getElementById('gn-admin');
    if (adminNav) adminNav.style.display = 'none';
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent?.includes('Simulate')) btn.style.display = 'none';
    });
  }

  // ── Main Init ──
  async function init() {
    const referredBy = getReferrerFromURL();
    hideAdmin();

    // MutationObserver
    const observer = new MutationObserver(() => {
      hideAdmin();
      document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent?.includes('Simulate')) btn.style.display = 'none';
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Local user check
    const localUser = loadLocalUser();

    if (localUser && localUser.phone) {
      // Supabase se fresh data lo
      const dbUser = await dbGetUserByPhone(localUser.phone);
      if (dbUser) {
        saveLocalUser(dbUser);
        window._gsCurrentUser = dbUser;
        window.coins = dbUser.coins || 0;
        applyUserToApp(dbUser);
        overrideAppFunctions();
        return;
      }
    }

    // Naya user — registration
    overrideAppFunctions();
    showRegistration(referredBy);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
