// ============================================
// GREEN SHOP — SUPABASE REAL DATABASE
// FIXED VERSION:
// ✅ 1 coin = ₹1
// ✅ Free game: 1st🪙30, 2nd🪙20, 3rd🪙10
// ✅ Paid game: 🪙10 entry, 1st🪙200
// ✅ Win Race: 🪙30
// ✅ Admin panel hidden + secret tap unlock
// ✅ Hardcoded data fix (Rahul Kumar, 1200 coins)
// ============================================

const SUPABASE_URL = 'https://amsuacmczawkhrblxojn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6vmr4B_qD-5dKF1ydm_MPg_nmj2se74';

async function sbFetch(endpoint, method = 'GET', body = null, extra = {}) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : '',
    ...extra
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method, headers,
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  return res.status === 204 ? null : res.json();
}

// ══════════════════════════════════════════
// USER FUNCTIONS
// ══════════════════════════════════════════

async function dbGetUserByPhone(phone) {
  try {
    const data = await sbFetch(`users?phone=eq.${phone}&limit=1`);
    return data && data.length > 0 ? data[0] : null;
  } catch (e) { return null; }
}

async function dbGetUserByRef(refCode) {
  try {
    const data = await sbFetch(`users?referral_code=eq.${refCode}&limit=1`);
    return data && data.length > 0 ? data[0] : null;
  } catch (e) { return null; }
}

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
  } catch (e) { console.error('Create user error:', e); return null; }
}

async function dbUpdateUser(phone, updates) {
  try {
    await sbFetch(`users?phone=eq.${phone}`, 'PATCH', {
      ...updates,
      updated_at: new Date().toISOString()
    });
    return true;
  } catch (e) { console.error('Update user error:', e); return false; }
}

async function dbGiveReferralBonus(refCode, bonusCoins) {
  try {
    const referrer = await dbGetUserByRef(refCode);
    if (!referrer) return false;
    await dbUpdateUser(referrer.phone, {
      coins: (referrer.coins || 0) + bonusCoins,
      ref_count: (referrer.ref_count || 0) + 1,
      ref_earned: (referrer.ref_earned || 0) + bonusCoins
    });
    return true;
  } catch (e) { return false; }
}

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

  // ── COIN RATES (BASE — adjusted by supply tier) ──
  const REFERRAL_NEW_USER_BASE = 25;
  const REFERRAL_BONUS_BASE    = 25;
  const DAILY_COINS_BASE       = 1;

  // ── FREE GAME PRIZES (BASE) ──
  const FREE_RACE_PRIZES_BASE = { 1: 30, 2: 20, 3: 10 };
  const FREE_TB_PRIZES_BASE   = { 1: 30, 2: 20, 3: 10 };

  // ── PAID GAME (BASE) ──
  const PAID_ENTRY_BASE = 10;
  const PAID_RACE_PRIZES_BASE = { 1: 200, 2: 100, 3: 50 };

  // ── WIN RACE coins (BASE) ──
  const WIN_RACE_COINS_BASE = 30;

  // ════════════════════════════════════════
  // ✅ TOTAL SUPPLY CAP — 21 MILLION (Bitcoin-style)
  // Jaise supply badhti hai, rewards kam hote hain aur coin value badhti hai
  // ════════════════════════════════════════
  const TOTAL_SUPPLY_CAP = 21000000; // 2.1 crore coins max

  // Tier breakpoints (% of total supply issued)
  // Tier 0: 0% - 33%   (0 - 7M)    → Normal rewards, 1 coin = ₹1
  // Tier 1: 33% - 66%  (7M - 14M)  → Half rewards, 1 coin = ₹2
  // Tier 2: 66% - 100% (14M - 21M) → Quarter rewards, 1 coin = ₹4
  // Tier 3: 100%+ (21M+)           → No new coins, 1 coin = ₹8 (trading value only)

  let _currentSupply = 0; // total coins issued so far — fetched from DB
  let _currentTier = 0;

  function getTierMultiplier(supply) {
    if (supply >= TOTAL_SUPPLY_CAP) return { reward: 0, value: 8, tier: 3, name: 'SOLD OUT' };
    if (supply >= TOTAL_SUPPLY_CAP * 0.66) return { reward: 0.25, value: 4, tier: 2, name: 'TIER 3' };
    if (supply >= TOTAL_SUPPLY_CAP * 0.33) return { reward: 0.5, value: 2, tier: 1, name: 'TIER 2' };
    return { reward: 1, value: 1, tier: 0, name: 'TIER 1' };
  }

  // Dynamically computed values (call refreshTierValues() to update after fetching supply)
  let REFERRAL_NEW_USER = REFERRAL_NEW_USER_BASE;
  let REFERRAL_BONUS    = REFERRAL_BONUS_BASE;
  let DAILY_COINS       = DAILY_COINS_BASE;
  let FREE_RACE_PRIZES  = { ...FREE_RACE_PRIZES_BASE };
  let FREE_TB_PRIZES    = { ...FREE_TB_PRIZES_BASE };
  let PAID_ENTRY         = PAID_ENTRY_BASE;
  let PAID_RACE_PRIZES   = { ...PAID_RACE_PRIZES_BASE };
  let WIN_RACE_COINS     = WIN_RACE_COINS_BASE;
  let COIN_VALUE_RS      = 1; // 1 coin = ₹X

  function refreshTierValues() {
    const t = getTierMultiplier(_currentSupply);
    _currentTier = t.tier;
    COIN_VALUE_RS = t.value;

    const r = t.reward;
    REFERRAL_NEW_USER = Math.max(1, Math.round(REFERRAL_NEW_USER_BASE * r));
    REFERRAL_BONUS    = Math.max(1, Math.round(REFERRAL_BONUS_BASE * r));
    DAILY_COINS       = Math.max(0, Math.round(DAILY_COINS_BASE * r));
    WIN_RACE_COINS    = Math.max(1, Math.round(WIN_RACE_COINS_BASE * r));
    PAID_ENTRY        = Math.max(1, Math.round(PAID_ENTRY_BASE)); // entry fee stays same

    FREE_RACE_PRIZES = {
      1: Math.max(0, Math.round(FREE_RACE_PRIZES_BASE[1] * r)),
      2: Math.max(0, Math.round(FREE_RACE_PRIZES_BASE[2] * r)),
      3: Math.max(0, Math.round(FREE_RACE_PRIZES_BASE[3] * r))
    };
    FREE_TB_PRIZES = {
      1: Math.max(0, Math.round(FREE_TB_PRIZES_BASE[1] * r)),
      2: Math.max(0, Math.round(FREE_TB_PRIZES_BASE[2] * r)),
      3: Math.max(0, Math.round(FREE_TB_PRIZES_BASE[3] * r))
    };
    PAID_RACE_PRIZES = {
      1: Math.max(0, Math.round(PAID_RACE_PRIZES_BASE[1] * r)),
      2: Math.max(0, Math.round(PAID_RACE_PRIZES_BASE[2] * r)),
      3: Math.max(0, Math.round(PAID_RACE_PRIZES_BASE[3] * r))
    };

    // Update tier badge in UI if present
    updateTierBadgeUI(t);
  }

  function updateTierBadgeUI(t) {
    let badge = document.getElementById('gs-tier-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'gs-tier-badge';
      badge.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9990;background:rgba(240,192,64,.12);border:1px solid rgba(240,192,64,.35);border-radius:20px;padding:4px 10px;font-size:.6rem;font-weight:800;color:#f0c040;font-family:-apple-system,sans-serif;pointer-events:none;';
      document.body.appendChild(badge);
    }
    const pct = Math.min(100, ((_currentSupply / TOTAL_SUPPLY_CAP) * 100)).toFixed(1);
    badge.textContent = `🪙 ${t.name} • 1coin=₹${t.value} • ${pct}% supply used`;
  }

  // Total supply track karne ke liye — ek special row 'supply_tracker' use karte hain users table mein
  async function dbGetTotalSupply() {
    try {
      // Sum all users' coins as proxy for "issued" supply
      const data = await sbFetch(`users?select=coins`);
      if (!data) return 0;
      const total = data.reduce((sum, u) => sum + (u.coins || 0), 0);
      return total;
    } catch (e) { return 0; }
  }

  async function dbRefreshSupply() {
    _currentSupply = await dbGetTotalSupply();
    refreshTierValues();
    return _currentSupply;
  }

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

  // ── COIN VALUE — dynamic based on supply tier ──
  function coinsToRs(coins) {
    return coins * COIN_VALUE_RS;
  }

  function applyUserToApp(user) {
    if (!user) return;

    window.coins = user.coins || 0;

    // Coin displays
    const coinIds = ['gCoinDisp','gStoreCoinDisp','pCoinDisp','pWalletBig',
                     'gsCoinsDisp','ppCoinsDisp','gProfileCoins','dkCoinDisp',
                     'gWalletCoins','ppCoinBig'];
    coinIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = (user.coins || 0).toLocaleString('en-IN');
    });

    // ✅ 1 coin = ₹1 (FIXED)
    const inr = document.getElementById('pWalletInr');
    if (inr) inr.textContent = coinsToRs(user.coins || 0).toFixed(2);

    const gWalletRs = document.getElementById('gWalletRs');
    if (gWalletRs) gWalletRs.textContent = coinsToRs(user.coins || 0).toLocaleString('en-IN');

    // Wallet bar text fix
    const gWalletBar = document.getElementById('gWalletBar');
    if (gWalletBar) {
      const span1 = gWalletBar.querySelector('span:first-child');
      if (span1) span1.innerHTML = `🪙 <span id="gWalletCoins">${(user.coins||0).toLocaleString('en-IN')}</span> coins = ₹<span id="gWalletRs">${coinsToRs(user.coins||0).toLocaleString('en-IN')}</span>`;
    }

    // P2E wallet rate text
    const pwRate = document.querySelector('.pw-rate');
    if (pwRate) pwRate.textContent = `🔄 1 Coin = ₹${COIN_VALUE_RS} Grocery Discount`;

    const pwInr = document.getElementById('pWalletInr');
    if (pwInr) pwInr.textContent = coinsToRs(user.coins||0).toLocaleString("en-IN");

    // Referral code
    const refCode = user.referral_code || user.referralCode || '';
    const refCodeEl = document.getElementById('refCode');
    if (refCodeEl) refCodeEl.textContent = refCode;

    // Referral link
    const refLink = `${window.location.origin}${window.location.pathname}?ref=${refCode}`;
    const refLinkBox = document.getElementById('refLinkBox');
    if (refLinkBox) refLinkBox.textContent = refLink;

    // DK code
    const dkCodeEl = document.getElementById('dkCode');
    if (dkCodeEl) dkCodeEl.textContent = 'DK-' + refCode;

    // Ref stats
    ['refCount','refCount2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = user.ref_count || 0;
    });
    ['refEarned','refEarned2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = user.ref_earned || 0;
    });

    // ✅ Hardcoded name/code fix
    const nameEls = document.querySelectorAll('*');
    nameEls.forEach(el => {
      if (el.children.length === 0) {
        if (el.textContent.trim() === 'Rahul Kumar') el.textContent = user.name;
        if (el.textContent.trim() === 'CYCLE7749') el.textContent = refCode;
        if (el.textContent.includes('CYCLE7749')) el.textContent = el.textContent.replace(/CYCLE7749/g, refCode);
        if (el.textContent.trim() === 'DKAAN-7749') el.textContent = 'DK-' + refCode;
        if (el.textContent.trim() === 'RIDER_7749') el.textContent = 'RIDER_' + refCode.slice(-4);
        // 1200 coins hardcoded fix
        if (el.textContent.trim() === '1,200' || el.textContent.trim() === '1200') {
          if (el.closest('#screen-ggprofile') || el.closest('.coin-strip') || el.closest('.p-wallet')) {
            el.textContent = (user.coins||0).toLocaleString('en-IN');
          }
        }
      }
    });

    // Shopping status (1 coin = ₹1)
    const gss = document.getElementById('gShopStatus');
    if (gss) {
      if ((user.coins || 0) >= 100) {
        gss.textContent = '✅ Shopping allowed';
        gss.style.color = '#16a34a';
      } else {
        gss.textContent = `❌ ${100 - (user.coins || 0)} coins aur chahiye`;
        gss.style.color = '#ff4560';
      }
    }

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

      const existing = await dbGetUserByPhone(phone);
      if (existing) {
        saveLocalUser(existing);
        window._gsCurrentUser = existing;
        applyUserToApp(existing);
        overlay.remove();
        gsToast(`👋 Wapas aaye ${existing.name}! 🪙 ${existing.coins} coins`, 'coin');
        return;
      }

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

      if (referredBy) {
        await dbGiveReferralBonus(referredBy, REFERRAL_BONUS);
        _currentSupply += REFERRAL_BONUS;
      }
      if (newCoins > 0) _currentSupply += newCoins;
      refreshTierValues();

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

    window.copyRef = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const code = user.referral_code || user.referralCode || '';
      navigator.clipboard?.writeText(code).catch(() => {});
      gsToast(`📋 Code copied: ${code}`, 'i');
    };

    window.copyRefLink = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const code = user.referral_code || user.referralCode || '';
      const link = `${window.location.origin}${window.location.pathname}?ref=${code}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      gsToast('🔗 Referral link copied!', 'i');
    };

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

    window.simulateRef = function () { gsToast('❌ Demo mode disabled!', 'e'); };
    window.simulateDkRef = function () { gsToast('❌ Demo mode disabled!', 'e'); };

    window.claimDaily = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) return;
      const today = new Date().toDateString();
      if (user.daily_date === today) {
        gsToast('✅ Aaj ka bonus already liya!', 'i');
        return;
      }
      showDailyAdModal(async () => {
        if (_currentSupply >= TOTAL_SUPPLY_CAP) {
          gsToast('⚠️ Coin supply khatam! Naye coins nahi mil sakte.', 'e');
          return;
        }
        user.coins = (user.coins || 0) + DAILY_COINS;
        user.daily_date = today;
        await dbUpdateUser(user.phone, { coins: user.coins, daily_date: today });
        saveLocalUser(user);
        window.coins = user.coins;
        applyUserToApp(user);
        _currentSupply += DAILY_COINS;
        refreshTierValues();
        gsToast(`✅ 🪙${DAILY_COINS} Daily bonus mila!`, 'coin');
        if (typeof launchConfetti === 'function') launchConfetti();
      });
    };

    // ══════════════════════════════════
    // ✅ FREE RACE RESULT (1st=🪙30, 2nd=🪙20, 3rd=🪙10)
    // ══════════════════════════════════
    window.showRaceResult2 = function () {
      const rank = window.RE ? window.RE.rank : 999;
      const earned = FREE_RACE_PRIZES[rank] || 0;

      let emoji, title, sub;
      if (rank === 1)      { emoji='🏆'; title='CHAMPION!';     sub='Sab se aage!'; }
      else if (rank === 2) { emoji='🥈'; title='2ND PLACE!';    sub='Silver finish!'; }
      else if (rank === 3) { emoji='🥉'; title='3RD PLACE!';    sub='Podium finish!'; }
      else                 { emoji='💀'; title=`RANK #${rank}`; sub='Race again!'; }

      window.coins = (window.coins || 0) + earned;
      const user = window._gsCurrentUser || loadLocalUser();
      if (user) {
        user.coins = window.coins;
        user.races = (user.races || 0) + 1;
        if (rank <= 3) user.wins = (user.wins || 0) + 1;
        saveLocalUser(user);
        dbUpdateUser(user.phone, { coins: user.coins, races: user.races, wins: user.wins });
        window._gsCurrentUser = user;
        applyUserToApp(user);
        if (earned > 0) { _currentSupply += earned; refreshTierValues(); }
      }

      const rfE = document.getElementById('rfE');
      const rfT = document.getElementById('rfT');
      const rfS = document.getElementById('rfS');
      const rfC = document.getElementById('rfC');
      const rFinish = document.getElementById('rFinish');
      if (rfE) rfE.textContent = emoji;
      if (rfT) rfT.textContent = title;
      if (rfS) rfS.textContent = sub;
      if (rfC) rfC.textContent = earned > 0 ? `🪙 ${earned}` : `🪙 0 — Top 3 mein aao!`;
      if (rFinish) rFinish.style.display = 'flex';

      if (earned > 0) {
        gsToast(`+🪙${earned} earned!`, 'coin');
        if (typeof launchConfetti === 'function') launchConfetti();
      } else {
        gsToast('Top 3 mein aao coins kamao! 🏁', 'i');
      }
    };

    // ✅ Win Race = 🪙30 (earn box update)
    setTimeout(() => {
      document.querySelectorAll('.earn-box').forEach(box => {
        const titleEl = box.querySelector('.earn-title');
        const coinEl  = box.querySelector('.earn-coins-val');
        const subEl   = box.querySelector('.earn-sub');
        if (titleEl && titleEl.textContent.trim() === 'Win Race' && coinEl) {
          coinEl.textContent = `🪙 ${WIN_RACE_COINS}`;
          if (subEl) subEl.textContent = '1st place finish';
        }
      });

      // Fix race finish card prize display
      const rfC = document.getElementById('rfC');
      if (rfC && rfC.textContent.includes('500')) {
        rfC.textContent = `🪙 ${WIN_RACE_COINS}`;
      }

      // Fix free game prize display in tap battle lobby
      document.querySelectorAll('[id*="tb-"]').forEach(el => {});
    }, 1500);

    // ══════════════════════════════════
    // ✅ TAP BATTLE FREE PRIZES (1st=30, 2nd=20, 3rd=10)
    // ══════════════════════════════════
    const _origTbEnd = window.showTapBattleResult;
    window.showTapBattleResult = function(forcedRank) {
      if (typeof _origTbEnd === 'function') _origTbEnd(forcedRank);
      setTimeout(() => {
        const rankEl = document.getElementById('tb-rank');
        const rank = forcedRank || (rankEl ? parseInt(rankEl.textContent) || 99 : 99);
        const isPaid = window._paidGameActive;
        const prizes = isPaid ? PAID_RACE_PRIZES : FREE_TB_PRIZES;
        const earned = prizes[rank] || 0;

        const coinsEl = document.getElementById('tb-res-coins');
        if (coinsEl) coinsEl.textContent = earned > 0 ? `🪙 ${earned}` : `🪙 0 — Top 3 mein aao!`;

        const resTitle = document.getElementById('tb-res-title');
        const resEmoji = document.getElementById('tb-res-emoji');
        const resSub   = document.getElementById('tb-res-sub');
        if (rank === 1)      { if(resEmoji) resEmoji.textContent='🏆'; if(resTitle) resTitle.textContent='CHAMPION!'; if(resSub) resSub.textContent='Sabse fast fingers!'; }
        else if (rank === 2) { if(resEmoji) resEmoji.textContent='🥈'; if(resTitle) resTitle.textContent='2ND PLACE!'; if(resSub) resSub.textContent='Silver fingers!'; }
        else if (rank === 3) { if(resEmoji) resEmoji.textContent='🥉'; if(resTitle) resTitle.textContent='3RD PLACE!'; if(resSub) resSub.textContent='Podium finish!'; }
        else                 { if(resEmoji) resEmoji.textContent='💀'; if(resTitle) resTitle.textContent=`RANK #${rank}`; if(resSub) resSub.textContent='Top 3 mein aao!'; }

        window.coins = (window.coins || 0) + earned;
        const user = window._gsCurrentUser || loadLocalUser();
        if (user) {
          user.coins = window.coins;
          saveLocalUser(user);
          dbUpdateUser(user.phone, { coins: user.coins });
          window._gsCurrentUser = user;
          applyUserToApp(user);
          if (earned > 0) { _currentSupply += earned; refreshTierValues(); }
        }
        window._paidGameActive = false;
        if (earned > 0) {
          gsToast(`+🪙${earned} earned!`, 'coin');
          if (typeof launchConfetti === 'function') launchConfetti();
        }
      }, 200);
    };

    // Fix lobby prize display
    setTimeout(() => {
      const prizeBoxes = document.querySelectorAll('#screen-tapbattle .r-finish-card, #screen-tapbattle [style*="tb-lobby"]');
      // Update prize displays in tap battle lobby
      const allDivs = document.querySelectorAll('#screen-tapbattle div');
      allDivs.forEach(div => {
        if (div.children.length === 0) {
          if (div.textContent.trim() === '🪙30') return; // already fixed
          if (div.textContent === '🪙15') div.textContent = '🪙20';
          if (div.textContent === '🪙5')  div.textContent = '🪙10';
        }
      });
    }, 1000);

    // ══════════════════════════════════
    // ✅ PAID GAME (🪙10 entry, 1st🪙200)
    // ══════════════════════════════════
    window.joinPaidBattle = function () {
      const user = window._gsCurrentUser || loadLocalUser();
      if (!user) { gsToast('❌ Pehle register karo!', 'e'); return; }
      if ((user.coins || 0) < PAID_ENTRY) {
        gsToast(`❌ ${PAID_ENTRY} coins chahiye! Aapke paas ${user.coins} hain.`, 'e');
        return;
      }
      showPaidGameConfirm(user);
    };

    function showPaidGameConfirm(user) {
      const old = document.getElementById('gs-paid-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'gs-paid-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,sans-serif;';
      modal.innerHTML = `
        <div style="background:#111827;border:1.5px solid rgba(240,192,64,.3);border-radius:24px;padding:28px 22px;max-width:340px;width:100%;text-align:center;">
          <div style="font-size:3rem;margin-bottom:8px">🎯</div>
          <div style="font-size:1.3rem;font-weight:800;color:#f0c040;margin-bottom:4px">Paid Battle</div>
          <div style="font-size:.82rem;color:rgba(238,242,255,.5);margin-bottom:20px">Entry fee kategi jab game shuru hoga</div>
          <div style="background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.2);border-radius:14px;padding:16px;margin-bottom:16px">
            <div style="font-size:.65rem;letter-spacing:3px;color:rgba(255,255,255,.4)">ENTRY FEE</div>
            <div style="font-size:2rem;font-weight:800;color:#f0c040;margin:6px 0">🪙${PAID_ENTRY}</div>
            <div style="font-size:.72rem;color:rgba(255,255,255,.4)">Aapke paas: 🪙${user.coins}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            <div style="background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.2);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:1.1rem">🥇</div>
              <div style="font-size:.9rem;font-weight:800;color:#f0c040">🪙200</div>
              <div style="font-size:.58rem;color:rgba(255,255,255,.35)">1ST</div>
            </div>
            <div style="background:rgba(192,192,192,.08);border:1px solid rgba(192,192,192,.2);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:1.1rem">🥈</div>
              <div style="font-size:.9rem;font-weight:800;color:#c0c0c0">🪙100</div>
              <div style="font-size:.58rem;color:rgba(255,255,255,.35)">2ND</div>
            </div>
            <div style="background:rgba(205,127,50,.08);border:1px solid rgba(205,127,50,.2);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:1.1rem">🥉</div>
              <div style="font-size:.9rem;font-weight:800;color:#cd7f32">🪙50</div>
              <div style="font-size:.58rem;color:rgba(255,255,255,.35)">3RD</div>
            </div>
          </div>
          <button onclick="window._confirmPaidBattle()" style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-size:1rem;font-weight:800;cursor:pointer;margin-bottom:10px">
            🎯 Join Paid Battle!
          </button>
          <button onclick="document.getElementById('gs-paid-modal').remove()" style="width:100%;padding:12px;border:none;border-radius:12px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);font-size:.9rem;cursor:pointer">
            Cancel
          </button>
        </div>`;
      document.body.appendChild(modal);

      window._confirmPaidBattle = function () {
        modal.remove();
        // Paid game — no ads, seedha coins kato aur game shuru karo
        const user = window._gsCurrentUser || loadLocalUser();
        if (!user || (user.coins || 0) < PAID_ENTRY) {
          gsToast(`❌ ${PAID_ENTRY} coins chahiye!`, 'e');
          return;
        }
        // Coins kato
        user.coins -= PAID_ENTRY;
        saveLocalUser(user);
        dbUpdateUser(user.phone, { coins: user.coins });
        window._gsCurrentUser = user;
        window.coins = user.coins;
        applyUserToApp(user);
        gsToast(`🎯 🪙${PAID_ENTRY} entry fee kata! Game shuru...`, 'coin');
        window._paidGameActive = true;
        window._paidGamePending = false;
        // Direct game shuru karo — lobby skip
        setTimeout(() => {
          if (typeof showTapBattleLobby === 'function') {
            showTapBattleLobby();
            setTimeout(() => {
              if (typeof startTapBattle === 'function') startTapBattle();
            }, 2000);
          }
        }, 500);
      };
    }

    // Game start override — paid game ke liye coins already kat chuke hain
    const _origStartGame = window.startTapBattle;
    window.startTapBattle = function () {
      // Coins already kat chuke hain _confirmPaidBattle mein
      if (typeof _origStartGame === 'function') _origStartGame();
    };

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

  // ════════════════════════════════════════
  // ✅ ADMIN PANEL — HIDDEN + SECRET UNLOCK
  // ════════════════════════════════════════

  function hideAdmin() {
    // Nav se admin tab chhupaao
    const adminNav = document.getElementById('gn-admin');
    if (adminNav) adminNav.style.display = 'none';

    // Simulate buttons hide
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent?.includes('Simulate')) btn.style.display = 'none';
    });
  }

  // Admin panel unlock button (screen-admin ke upar)
  function addAdminUnlockBtn() {
    // Agar admin already unlocked hai toh skip
    if (sessionStorage.getItem('gs_admin_ok') === '1') {
      const adminNav = document.getElementById('gn-admin');
      if (adminNav) adminNav.style.display = '';
      return;
    }

    // Bottom nav mein Admin ka visible unlock option
    const gNav = document.getElementById('gNav');
    if (gNav && !document.getElementById('gs-admin-unlock-btn')) {
      const unlockBtn = document.createElement('div');
      unlockBtn.id = 'gs-admin-unlock-btn';
      unlockBtn.style.cssText = `
        position:fixed;bottom:70px;right:12px;z-index:500;
        width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#1f2937,#374151);
        border:1.5px solid rgba(225,29,72,.4);
        display:flex;align-items:center;justify-content:center;
        font-size:1.3rem;cursor:pointer;
        box-shadow:0 4px 16px rgba(0,0,0,.4);
        transition:all .2s;
      `;
      unlockBtn.title = 'Admin Unlock';
      unlockBtn.textContent = '🔐';
      unlockBtn.onclick = () => showAdminPrompt();
      document.body.appendChild(unlockBtn);
    }
  }

  // Secret corner tap (7 baar)
  let _tapCount = 0, _tapTimer = null;
  const ADMIN_PASS  = 'GreenShop@1234';
  const ADMIN_TAPS  = 7;

  function setupAdminTap() {
    const btn = document.createElement('div');
    btn.id = 'gs-admin-secret';
    btn.style.cssText = 'position:fixed;top:0;right:0;width:70px;height:70px;z-index:99997;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent;';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      _tapCount++;
      if (_tapTimer) clearTimeout(_tapTimer);
      if (_tapCount > 2) {
        const hint = document.createElement('div');
        hint.style.cssText = 'position:fixed;top:12px;right:80px;z-index:99999;background:#1f2937;color:white;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;pointer-events:none;';
        hint.textContent = `🔐 ${ADMIN_TAPS - _tapCount} aur tap...`;
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 1200);
      }
      if (_tapCount >= ADMIN_TAPS) {
        _tapCount = 0;
        clearTimeout(_tapTimer);
        showAdminPrompt();
        return;
      }
      _tapTimer = setTimeout(() => { _tapCount = 0; }, 3000);
    });
  }

  function showAdminPrompt() {
    const old = document.getElementById('gs-admin-prompt');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gs-admin-prompt';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);font-family:-apple-system,sans-serif;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:24px;padding:30px 24px;max-width:310px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <div style="font-size:44px;margin-bottom:8px">🔐</div>
        <h3 style="color:#1f2937;font-size:18px;margin:0 0 4px">Admin Access</h3>
        <p style="color:#6b7280;font-size:13px;margin:0 0 18px">Green Shop Admin Panel</p>
        <input id="gs-adm-inp" type="password" placeholder="Password daalo"
          style="width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;box-sizing:border-box;outline:none;text-align:center;letter-spacing:4px;margin-bottom:8px"
          onfocus="this.style.border='2px solid #e11d48'" onblur="this.style.border='2px solid #e5e7eb'"/>
        <div id="gs-adm-err" style="color:#ef4444;font-size:12px;margin-bottom:10px;min-height:16px"></div>
        <button onclick="window._gsAdmLogin()" style="background:linear-gradient(135deg,#1f2937,#374151);color:white;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;width:100%;cursor:pointer;margin-bottom:10px">🔓 Login</button>
        <button onclick="document.getElementById('gs-admin-prompt').remove()" style="background:#f3f4f6;color:#6b7280;border:none;padding:10px;border-radius:12px;font-size:14px;width:100%;cursor:pointer">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('gs-adm-inp')?.focus(), 100);
    document.getElementById('gs-adm-inp').addEventListener('keydown', e => { if (e.key === 'Enter') window._gsAdmLogin(); });

    window._gsAdmLogin = function () {
      const inp = document.getElementById('gs-adm-inp');
      const err = document.getElementById('gs-adm-err');
      if (inp.value === ADMIN_PASS) {
        overlay.remove();
        sessionStorage.setItem('gs_admin_ok', '1');

        // Admin nav show karo
        const adminNav = document.getElementById('gn-admin');
        if (adminNav) adminNav.style.display = '';

        // Unlock button hide
        const unlockBtn = document.getElementById('gs-admin-unlock-btn');
        if (unlockBtn) unlockBtn.remove();

        if (typeof openAdmin === 'function') openAdmin();
        gsToast('✅ Admin access mila!', 'g');
      } else {
        err.textContent = '❌ Galat password!';
        inp.value = ''; inp.focus();
      }
    };
  }

  // ── Race Ads ──
  function setupRaceAds() {
    setTimeout(() => {
      document.querySelectorAll('[onclick*="pNav(\'race\')"], [onclick*="showTapBattleLobby"], [onclick*="startAdFlowForBattle"]').forEach(btn => {
        if (btn._gsAdWrapped) return;
        btn._gsAdWrapped = true;
        const orig = btn.getAttribute('onclick');
        btn.removeAttribute('onclick');
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          showRaceAd(1, () => showRaceAd(2, () => { try { eval(orig); } catch(err) {} }));
        });
      });

      const pnRace = document.getElementById('pn-race');
      if (pnRace && !pnRace._gsAdWrapped) {
        pnRace._gsAdWrapped = true;
        const orig = pnRace.getAttribute('onclick');
        pnRace.removeAttribute('onclick');
        pnRace.addEventListener('click', e => {
          e.preventDefault();
          showRaceAd(1, () => showRaceAd(2, () => { try { eval(orig); } catch(err) {} }));
        });
      }
    }, 1500);
  }

  function showRaceAd(num, onDone) {
    if (!document.getElementById('gs-adsterra')) {
      const s = document.createElement('script');
      s.id = 'gs-adsterra';
      s.src = 'https://pl29056314.effectivecpmnetwork.com/43/ec/db/43ecdbe77db52d5da8a3bf92eba55149.js';
      s.async = true;
      document.head.appendChild(s);
    }

    const brands = [
      { emoji: '📱', name: 'CashKaro', desc: 'Har purchase pe cashback pao!' },
      { emoji: '🛒', name: 'Meesho', desc: 'Saste products, tezi se delivery!' }
    ];
    const b = brands[num - 1];

    const old = document.getElementById('gs-race-ad');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gs-race-ad';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99990;background:linear-gradient(160deg,#07090e,#0d1220);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:16px;font-family:-apple-system,sans-serif;';
    overlay.innerHTML = `
      <div style="font-size:.6rem;letter-spacing:4px;color:rgba(238,242,255,.35);text-align:center;margin-top:4px">AD ${num} OF 2 — WATCH TO ENTER GAME</div>
      <div style="width:100%;max-width:380px;background:rgba(255,255,255,.04);border:1.5px solid rgba(240,192,64,.2);border-radius:20px;padding:24px 16px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;margin:10px 0;">
        <span style="font-size:3.5rem">${b.emoji}</span>
        <div style="font-size:.55rem;letter-spacing:4px;color:rgba(238,242,255,.35)">ADVERTISEMENT</div>
        <div style="font-size:1.6rem;font-weight:800;color:#f0c040">${b.name}</div>
        <div style="font-size:.8rem;color:rgba(238,242,255,.5)">${b.desc}</div>
        <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;border:3px solid rgba(240,192,64,.3);background:rgba(240,192,64,.08);">
          <div style="font-size:1.9rem;font-weight:800;color:#f0c040;line-height:1" id="gs-ad-num">5</div>
        </div>
        <div style="width:100%;height:4px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">
          <div id="gs-ad-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#f0c040,#ff4560);border-radius:3px;transition:width 1s linear"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:4px">
        <div style="width:10px;height:10px;border-radius:50%;background:${num===1?'#f0c040':'rgba(255,255,255,.15)'};"></div>
        <div style="width:10px;height:10px;border-radius:50%;background:${num===2?'#f0c040':'rgba(255,255,255,.15)'};"></div>
      </div>
      <div style="width:100%;max-width:380px;padding-bottom:4px">
        <button id="gs-ad-btn" disabled style="width:100%;padding:16px;border:none;border-radius:14px;background:linear-gradient(135deg,#22d67a,#16a35a);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;opacity:.3;pointer-events:none;transition:.3s;letter-spacing:1px">✅ Continue</button>
        <div style="text-align:center;font-size:.7rem;color:rgba(238,242,255,.3);margin-top:6px">Ad dekho — phir continue hoga...</div>
      </div>`;
    document.body.appendChild(overlay);

    setTimeout(() => { const bar = document.getElementById('gs-ad-bar'); if (bar) bar.style.width = '100%'; }, 100);

    let s = 5;
    const t = setInterval(() => {
      s--;
      const el = document.getElementById('gs-ad-num');
      if (el) el.textContent = Math.max(0, s);
      if (s <= 0) {
        clearInterval(t);
        const btn = document.getElementById('gs-ad-btn');
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.onclick = () => { overlay.remove(); if (typeof onDone === 'function') onDone(); };
        }
      }
    }, 1000);
  }

  // ── Main Init ──
  async function init() {
    const referredBy = getReferrerFromURL();
    hideAdmin();

    const observer = new MutationObserver(() => {
      hideAdmin();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (sessionStorage.getItem('gs_admin_ok') === '1') {
      const adminNav = document.getElementById('gn-admin');
      if (adminNav) adminNav.style.display = '';
    }

    setupAdminTap();
    addAdminUnlockBtn(); // ✅ 🔐 unlock button dikhao
    setupRaceAds();

    // ✅ Supply check — fetch total coins issued aur tier set karo
    await dbRefreshSupply();
    // Har 60 second mein supply refresh karo (auto-update without reload)
    setInterval(dbRefreshSupply, 60000);

    const localUser = loadLocalUser();

    if (localUser && localUser.phone) {
      const dbUser = await dbGetUserByPhone(localUser.phone);
      if (dbUser) {
        saveLocalUser(dbUser);
        window._gsCurrentUser = dbUser;
        window.coins = dbUser.coins || 0;
        applyUserToApp(dbUser);
        overrideAppFunctions();
        setTimeout(setupRaceAds, 2000);
        return;
      }
    }

    overrideAppFunctions();
    showRegistration(referredBy);
    setTimeout(setupRaceAds, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
