// ============================================
// GREEN SHOP — COMPLETE FIXES v2.0
// All bugs fixed — Mohammad Akhtar Ansari
// ============================================

(function () {
  'use strict';

  // ══════════════════════════════════════════
  // ⚙️ CONFIG — Yahan settings change karo
  // ══════════════════════════════════════════
  const CONFIG = {
    // Admin
    ADMIN_PASSWORD: 'GreenShop@1234',
    ADMIN_SECRET_TAPS: 7,
    ADMIN_TAP_TIMEOUT: 3000,

    // Coins
    COINS_PER_100_RS: 100,        // 100 coins = ₹1
    SHOPPING_MIN_COINS: 500,      // 500 coins se shopping allow
    DAILY_LOGIN_COINS: 1,         // Daily login = 1 coin
    REFERRAL_NEW_USER: 25,        // Naye user ko 25 coins
    REFERRAL_BONUS: 50,           // Referrer ko 50 coins

    // Race Prizes (Free Game)
    RACE_PRIZES: {
      1:  3000,
      2:  2000,
      3:  1000,
      4:  500,
      5:  300,
      6:  200,
      7:  150,
      8:  100,
      9:  100,
      10: 100
    },

    // Tap Battle Prizes
    TB_PRIZES: {
      1: 3000,
      2: 2000,
      3: 1000,
      4: 500,
      5: 300,
      6: 200,
      7: 150,
      8: 100,
      9: 100,
      10: 100
    }
  };

  // ══════════════════════════════════════════
  // 1. USER SYSTEM — LocalStorage based
  // ══════════════════════════════════════════

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

  function loadUser() {
    try {
      const d = localStorage.getItem('gs_user_v2');
      return d ? JSON.parse(d) : null;
    } catch (e) { return null; }
  }

  function saveUser(u) {
    try { localStorage.setItem('gs_user_v2', JSON.stringify(u)); } catch (e) {}
  }

  function createUser(name, phone, referredBy) {
    const uid = generateUID();
    return {
      uid, name, phone,
      referralCode: uid,
      referralLink: window.location.origin + window.location.pathname + '?ref=' + uid,
      coins: 0,
      refCount: 0,
      refEarned: 0,
      orders: 0,
      races: 0,
      wins: 0,
      referredBy: referredBy || null,
      dailyClaimed: false,
      dailyDate: '',
      joinedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
  }

  // ══════════════════════════════════════════
  // 2. REGISTRATION SCREEN
  // ══════════════════════════════════════════

  function showRegistration(referredBy) {
    const existing = loadUser();
    if (existing && existing.name) return;

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
        <h2 style="color:#16a34a;font-size:22px;margin:0 0 4px">Green Shop</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 20px">Giridih, Jharkhand • Shop & Earn Coins</p>
        ${referredBy ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;color:#16a34a;font-weight:600;">🎁 Invite bonus! 🪙${CONFIG.REFERRAL_NEW_USER} coins milenge!</div>` : ''}
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
        <div id="gs-reg-err" style="color:#ef4444;font-size:13px;margin-bottom:10px;display:none"></div>
        <button onclick="window._gsRegister()" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;border:none;padding:16px;border-radius:14px;font-size:16px;font-weight:700;width:100%;cursor:pointer;box-shadow:0 4px 15px rgba(22,163,74,.4);">
          🚀 Green Shop Shuru Karo!
        </button>
        <p style="font-size:11px;color:#9ca3af;margin-top:14px">Aapka data sirf aapke phone mein safe rahega 🔒</p>
      </div>
    `;
    document.body.appendChild(overlay);

    window._gsRegister = function () {
      const name = document.getElementById('gs-reg-name').value.trim();
      const phone = document.getElementById('gs-reg-phone').value.trim();
      const errEl = document.getElementById('gs-reg-err');
      if (!name || name.length < 2) {
        errEl.textContent = '⚠️ Naam kam se kam 2 characters ka hona chahiye!';
        errEl.style.display = 'block'; return;
      }
      if (!phone || phone.length !== 10 || isNaN(phone)) {
        errEl.textContent = '⚠️ Sahi 10 digit phone number daalo!';
        errEl.style.display = 'block'; return;
      }
      errEl.style.display = 'none';
      const user = createUser(name, phone, referredBy);
      if (referredBy) {
        user.coins += CONFIG.REFERRAL_NEW_USER;
        // Referrer ko coins dena — localStorage mein mark karo
        const pending = JSON.parse(localStorage.getItem('gs_pending_ref') || '{}');
        pending[referredBy] = (pending[referredBy] || 0) + CONFIG.REFERRAL_BONUS;
        localStorage.setItem('gs_pending_ref', JSON.stringify(pending));
      }
      saveUser(user);
      window._currentUser = user;
      applyUserToApp(user);
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s';
      setTimeout(() => {
        overlay.remove();
        gsToast(`🎉 Welcome ${user.name}! 🪙${user.coins} coins mile!`, 'coin');
      }, 400);
    };

    document.getElementById('gs-reg-phone').addEventListener('keydown', e => {
      if (e.key === 'Enter') window._gsRegister();
    });
  }

  // ══════════════════════════════════════════
  // 3. APPLY USER DATA TO APP
  // ══════════════════════════════════════════

  function applyUserToApp(user) {
    if (!user) return;

    // Referral code update — CYCLE7749 replace karo
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0) {
        if (el.textContent.trim() === 'CYCLE7749') el.textContent = user.referralCode;
        if (el.textContent.trim() === 'DKAAN-7749') el.textContent = 'DK-' + user.referralCode;
        if (el.textContent.includes('akhtarsee.github.io/Green-Shop-/#ref=CYCLE7749')) {
          el.textContent = user.referralLink;
        }
        if (el.textContent.includes('akhtarsee.github.io/Green-Shop-/#ref=')) {
          el.textContent = user.referralLink;
        }
        // Name update
        if (el.textContent.trim() === 'Rahul Kumar') el.textContent = user.name;
        if (el.textContent.trim() === 'RIDER_7749') el.textContent = 'RIDER_' + user.referralCode.slice(-4);
      }
    });

    // Referral link box update
    const refLinkBox = document.getElementById('refLinkBox');
    if (refLinkBox) refLinkBox.textContent = user.referralLink;

    // Ref code elements
    ['refCode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = user.referralCode;
    });

    // DK code
    const dkCode = document.getElementById('dkCode');
    if (dkCode) dkCode.textContent = 'DK-' + user.referralCode;

    // Ref stats
    const refCount = document.getElementById('refCount');
    const refCount2 = document.getElementById('refCount2');
    const refEarned = document.getElementById('refEarned');
    const refEarned2 = document.getElementById('refEarned2');
    if (refCount) refCount.textContent = user.refCount || 0;
    if (refCount2) refCount2.textContent = user.refCount || 0;
    if (refEarned) refEarned.textContent = user.refEarned || 0;
    if (refEarned2) refEarned2.textContent = user.refEarned || 0;

    // Profile stats
    const ppCoinBig = document.getElementById('ppCoinBig');
    if (ppCoinBig) ppCoinBig.textContent = (user.coins || 0).toLocaleString('en-IN');

    // LocalStorage sync for existing app functions
    window.coins = user.coins || 0;
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userPhone', user.phone);
    localStorage.setItem('userCoins', user.coins);
    localStorage.setItem('userReferralCode', user.referralCode);
    localStorage.setItem('userReferralLink', user.referralLink);
    localStorage.setItem('userUID', user.uid);

    // Sync coins display
    syncCoinsDisplay(user.coins);

    // Shopping status update
    updateShoppingStatus(user.coins);

    // Pending referral bonus check
    checkPendingRefBonus(user);
  }

  // ══════════════════════════════════════════
  // 4. COIN SYSTEM FIX
  // ══════════════════════════════════════════

  function syncCoinsDisplay(coins) {
    const f = n => n ? n.toLocaleString('en-IN') : '0';
    const ids = ['gCoinDisp','gStoreCoinDisp','pCoinDisp','pWalletBig','gsCoinsDisp','ppCoinsDisp','gProfileCoins','dkCoinDisp','gWalletCoins'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = f(coins);
    });

    // Wallet INR value
    const inr = document.getElementById('pWalletInr');
    if (inr) inr.textContent = (coins / 100).toFixed(2);

    // Wallet Rs display
    const gWalletRs = document.getElementById('gWalletRs');
    if (gWalletRs) gWalletRs.textContent = f(Math.floor(coins / 100));

    // Wallet bar
    const gwc = document.getElementById('gWalletCoins');
    if (gwc) gwc.textContent = f(coins);
  }

  function updateShoppingStatus(coins) {
    const gss = document.getElementById('gShopStatus');
    if (!gss) return;
    if (coins >= CONFIG.SHOPPING_MIN_COINS) {
      gss.textContent = '✅ Shopping allowed';
      gss.style.color = '#16a34a';
    } else {
      gss.textContent = `❌ ${CONFIG.SHOPPING_MIN_COINS - coins} coins aur chahiye`;
      gss.style.color = '#ff4560';
    }
  }

  function checkPendingRefBonus(user) {
    const pending = JSON.parse(localStorage.getItem('gs_pending_ref') || '{}');
    if (pending[user.referralCode]) {
      const bonus = pending[user.referralCode];
      user.coins += bonus;
      user.refCount += Math.floor(bonus / CONFIG.REFERRAL_BONUS);
      user.refEarned += bonus;
      delete pending[user.referralCode];
      localStorage.setItem('gs_pending_ref', JSON.stringify(pending));
      saveUser(user);
      syncCoinsDisplay(user.coins);
      setTimeout(() => gsToast(`👥 Referral bonus! +🪙${bonus}`, 'coin'), 1000);
    }
  }

  // ══════════════════════════════════════════
  // 5. OVERRIDE APP FUNCTIONS
  // ══════════════════════════════════════════

  function overrideAppFunctions() {

    // ── Daily Login Fix ──
    window._origClaimDaily = window.claimDaily;
    window.claimDaily = function () {
      const user = loadUser();
      if (!user) return;
      const today = new Date().toDateString();
      if (user.dailyDate === today) {
        gsToast('✅ Aaj ka bonus already liya!', 'i');
        return;
      }
      // Show ad first then give coin
      showDailyAdModal(() => {
        user.coins += CONFIG.DAILY_LOGIN_COINS;
        user.dailyDate = today;
        user.dailyClaimed = true;
        saveUser(user);
        window.coins = user.coins;
        syncCoinsDisplay(user.coins);
        updateShoppingStatus(user.coins);
        gsToast(`✅ 🪙${CONFIG.DAILY_LOGIN_COINS} Daily bonus mila!`, 'coin');
        if (typeof launchConfetti === 'function') launchConfetti();
      });
    };

    // ── Copy Ref Fix ──
    window.copyRef = function () {
      const user = loadUser();
      if (!user) return;
      navigator.clipboard?.writeText(user.referralCode).catch(() => {});
      gsToast(`📋 Code copied: ${user.referralCode} — Share karo!`, 'i');
    };

    // ── Copy Ref Link Fix ──
    window.copyRefLink = function () {
      const user = loadUser();
      if (!user) return;
      navigator.clipboard?.writeText(user.referralLink).catch(() => {});
      gsToast('🔗 Referral link copied!', 'i');
    };

    // ── Share Ref Link Fix ──
    window.shareRefLink = function () {
      const user = loadUser();
      if (!user) return;
      const text = `🌿 GreenShop pe aao — fresh grocery + game khelo + coins kamao!\n\nMera referral link: ${user.referralLink}\n\n🪙 Tumhe ${CONFIG.REFERRAL_NEW_USER} coins milenge signup par!`;
      if (navigator.share) {
        navigator.share({ title: 'GreenShop', text, url: user.referralLink })
          .then(() => gsToast('✅ Shared!', 'g'))
          .catch(() => {});
      } else {
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, '_blank');
      }
    };

    // ── Copy DK Fix ──
    window.copyDk = function () {
      const user = loadUser();
      if (!user) return;
      const dkCode = 'DK-' + user.referralCode;
      navigator.clipboard?.writeText(dkCode).catch(() => {});
      gsToast(`📋 Dukandaar code copied: ${dkCode}`, 'i');
    };

    // ── Simulate Ref — DISABLE ──
    window.simulateRef = function () {
      gsToast('❌ Simulate mode disabled!', 'e');
    };
    window.simulateDkRef = function () {
      gsToast('❌ Simulate mode disabled!', 'e');
    };

    // ── syncCoins override ──
    window._origSyncCoins = window.syncCoins;
    window.syncCoins = function () {
      const user = loadUser();
      if (user) {
        user.coins = window.coins || 0;
        saveUser(user);
        syncCoinsDisplay(user.coins);
        updateShoppingStatus(user.coins);
      }
      if (typeof window._origSyncCoins === 'function') window._origSyncCoins();
    };
  }

  // ══════════════════════════════════════════
  // 6. RACE PRIZE FIX
  // ══════════════════════════════════════════

  function fixRacePrizes() {
    // Override showRaceResult2
    window._origShowRaceResult2 = window.showRaceResult2;
    window.showRaceResult2 = function () {
      const rank = window.RE ? window.RE.rank : 999;
      const earned = CONFIG.RACE_PRIZES[rank] || 0;
      let emoji, title, sub;

      if (rank === 1)      { emoji='🏆'; title='CHAMPION!';   sub='Mountain ka Raja!'; }
      else if (rank === 2) { emoji='🥈'; title='2ND PLACE!';  sub='Silver finish!'; }
      else if (rank === 3) { emoji='🥉'; title='3RD PLACE!';  sub='Podium finish!'; }
      else if (rank <= 10) { emoji='🌟'; title=`RANK #${rank}`; sub=`Top 10! 🎉`; }
      else                 { emoji='💀'; title=`RANK #${rank}`; sub='Race again!'; }

      window.coins = (window.coins || 0) + earned;
      const user = loadUser();
      if (user) {
        user.coins = window.coins;
        user.races = (user.races || 0) + 1;
        if (rank <= 3) user.wins = (user.wins || 0) + 1;
        saveUser(user);
      }
      syncCoinsDisplay(window.coins);
      updateShoppingStatus(window.coins);

      // Update result screen
      const rfE = document.getElementById('rfE');
      const rfT = document.getElementById('rfT');
      const rfS = document.getElementById('rfS');
      const rfC = document.getElementById('rfC');
      const rFinish = document.getElementById('rFinish');
      if (rfE) rfE.textContent = emoji;
      if (rfT) rfT.textContent = title;
      if (rfS) rfS.textContent = sub;
      if (rfC) rfC.textContent = `🪙 ${earned.toLocaleString('en-IN')}`;
      if (rFinish) rFinish.style.display = 'flex';

      if (rank <= 3 && typeof launchConfetti === 'function') launchConfetti();
      if (earned > 0) gsToast(`+🪙${earned.toLocaleString('en-IN')} earned!`, 'coin');
    };

    // Tap Battle prizes fix
    window._origShowTBResult = window.showTBResult || null;
    // Override tb result coins display
    const origTbEnd = window.endTapBattle;
    if (origTbEnd) {
      window.endTapBattle = function() {
        if (typeof origTbEnd === 'function') origTbEnd();
        // Fix coins display after battle
        setTimeout(() => {
          const tbResCoins = document.getElementById('tb-res-coins');
          if (tbResCoins) {
            const rankEl = document.getElementById('tb-rank');
            const rank = rankEl ? parseInt(rankEl.textContent) : 999;
            const earned = CONFIG.TB_PRIZES[rank] || 0;
            tbResCoins.textContent = `🪙 ${earned.toLocaleString('en-IN')}`;
          }
        }, 100);
      };
    }
  }

  // ══════════════════════════════════════════
  // 7. RACE NOW — 2 ADS BEFORE GAME
  // ══════════════════════════════════════════

  function setupRaceAds() {
    // Intercept "Race Now" button
    setTimeout(() => {
      const raceNowBtns = document.querySelectorAll('[onclick*="pNav(\'race\')"], [onclick*="showTapBattleLobby"], [onclick*="pNav(\"race\")"]');
      raceNowBtns.forEach(btn => {
        if (btn._gsAdWrapped) return;
        btn._gsAdWrapped = true;
        const original = btn.getAttribute('onclick');
        btn.removeAttribute('onclick');
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          showRaceAdFlow(() => {
            if (original) { try { eval(original); } catch(err) {} }
          });
        });
      });

      // P2E nav race tab
      const pnRace = document.getElementById('pn-race');
      if (pnRace && !pnRace._gsAdWrapped) {
        pnRace._gsAdWrapped = true;
        const orig = pnRace.getAttribute('onclick');
        pnRace.removeAttribute('onclick');
        pnRace.addEventListener('click', e => {
          e.preventDefault();
          showRaceAdFlow(() => {
            if (orig) { try { eval(orig); } catch(err) {} }
          });
        });
      }

      // Tap Battle entry button
      const tbBtn = document.querySelector('[onclick*="startAdFlowForBattle"]');
      if (tbBtn && !tbBtn._gsAdWrapped) {
        tbBtn._gsAdWrapped = true;
        const orig = tbBtn.getAttribute('onclick');
        tbBtn.removeAttribute('onclick');
        tbBtn.addEventListener('click', e => {
          e.preventDefault();
          showRaceAdFlow(() => {
            if (orig) { try { eval(orig); } catch(err) {} }
          });
        });
      }
    }, 1500);
  }

  function showRaceAdFlow(callback) {
    showAdScreen(1, 2, () => {
      showAdScreen(2, 2, () => {
        if (typeof callback === 'function') callback();
      });
    });
  }

  function showAdScreen(adNum, totalAds, onComplete) {
    const existing = document.getElementById('gs-race-ad-overlay');
    if (existing) existing.remove();

    // Load Adsterra popunder
    loadAdsterraPopunder();

    const overlay = document.createElement('div');
    overlay.id = 'gs-race-ad-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99990;
      background:linear-gradient(160deg,#07090e,#0d1220);
      display:flex;flex-direction:column;align-items:center;justify-content:space-between;
      padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    `;

    const brands = [
      { emoji:'📱', name:'CashKaro', desc:'Har purchase pe cashback pao!' },
      { emoji:'🛒', name:'Meesho', desc:'Saste products, tezi se delivery!' }
    ];
    const brand = brands[adNum - 1] || brands[0];

    overlay.innerHTML = `
      <div style="font-size:.6rem;letter-spacing:4px;color:rgba(238,242,255,.35);text-align:center;margin-top:4px">
        AD ${adNum} OF ${totalAds} — WATCH TO ENTER GAME
      </div>
      <div style="width:100%;max-width:380px;background:rgba(255,255,255,.04);border:1.5px solid rgba(240,192,64,.2);border-radius:20px;padding:24px 16px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;margin:10px 0;">
        <span style="font-size:3.5rem">${brand.emoji}</span>
        <div style="font-size:.55rem;letter-spacing:4px;color:rgba(238,242,255,.35)">ADVERTISEMENT</div>
        <div style="font-family:Syne,sans-serif;font-size:1.6rem;color:#f0c040">${brand.name}</div>
        <div style="font-size:.8rem;color:rgba(238,242,255,.5);line-height:1.4">${brand.desc}</div>
        <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;border:3px solid rgba(240,192,64,.3);background:rgba(240,192,64,.08);">
          <div>
            <div id="gs-ad-num-${adNum}" style="font-family:Syne,sans-serif;font-size:1.9rem;color:#f0c040;line-height:1">5</div>
            <div style="font-size:.5rem;color:rgba(238,242,255,.4);letter-spacing:2px">SEC</div>
          </div>
        </div>
        <div style="width:100%;height:4px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">
          <div id="gs-ad-bar-${adNum}" style="height:100%;width:0%;background:linear-gradient(90deg,#f0c040,#ff4560);border-radius:3px;transition:width 1s linear"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:4px">
        <div id="gs-ad-dot1" style="width:10px;height:10px;border-radius:50%;background:${adNum===1?'#f0c040':'rgba(255,255,255,.15)'};transition:.3s"></div>
        <div id="gs-ad-dot2" style="width:10px;height:10px;border-radius:50%;background:${adNum===2?'#f0c040':'rgba(255,255,255,.15)'};transition:.3s"></div>
      </div>
      <div style="width:100%;max-width:380px;padding-bottom:4px">
        <button id="gs-ad-cont-btn" onclick="" disabled style="width:100%;padding:16px;border:none;border-radius:14px;background:linear-gradient(135deg,#22d67a,#16a35a);color:#fff;font-family:Syne,sans-serif;font-size:1rem;cursor:pointer;letter-spacing:1px;opacity:.3;pointer-events:none;transition:.3s">
          ✅ Continue
        </button>
        <div style="text-align:center;font-size:.7rem;color:rgba(238,242,255,.3);margin-top:6px">Ad dekho — phir continue hoga...</div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Countdown
    let s = 5;
    const numEl = document.getElementById(`gs-ad-num-${adNum}`);
    const barEl = document.getElementById(`gs-ad-bar-${adNum}`);
    const btnEl = document.getElementById('gs-ad-cont-btn');

    setTimeout(() => { if (barEl) barEl.style.width = '100%'; }, 100);

    const timer = setInterval(() => {
      s--;
      if (numEl) numEl.textContent = Math.max(0, s);
      if (s <= 0) {
        clearInterval(timer);
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.style.opacity = '1';
          btnEl.style.pointerEvents = 'auto';
          btnEl.onclick = () => {
            overlay.remove();
            if (typeof onComplete === 'function') onComplete();
          };
        }
      }
    }, 1000);
  }

  function loadAdsterraPopunder() {
    if (document.getElementById('gs-adsterra-loaded')) return;
    const s = document.createElement('script');
    s.id = 'gs-adsterra-loaded';
    s.src = 'https://pl29056314.effectivecpmnetwork.com/43/ec/db/43ecdbe77db52d5da8a3bf92eba55149.js';
    s.async = true;
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════
  // 8. DAILY AD MODAL FIX (1 coin)
  // ══════════════════════════════════════════

  function showDailyAdModal(onComplete) {
    const existing = document.getElementById('dailyAdModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'dailyAdModal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.85);
      display:flex;align-items:center;justify-content:center;padding:20px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    `;
    modal.innerHTML = `
      <div style="background:#111827;border:1.5px solid rgba(240,192,64,.2);border-radius:20px;padding:24px 20px;max-width:340px;width:100%;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:8px">📺</div>
        <div style="font-family:Syne,sans-serif;font-size:1.3rem;color:#f0c040;margin-bottom:4px">Daily Bonus Ad</div>
        <div style="font-size:.78rem;color:rgba(238,242,255,.5);margin-bottom:16px">Ad dekho aur 🪙${CONFIG.DAILY_LOGIN_COINS} coin pao!</div>
        <div style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:50%;border:3px solid rgba(240,192,64,.3);background:rgba(240,192,64,.08);margin-bottom:10px">
          <div style="font-family:Syne,sans-serif;font-size:1.6rem;color:#f0c040" id="dailyAdTimer">5</div>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-bottom:14px">
          <div id="dailyAdBar" style="height:100%;width:0%;background:linear-gradient(90deg,#f0c040,#22d67a);border-radius:3px;transition:width 1s linear"></div>
        </div>
        <button id="dailyAdBtn" disabled style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#f0c040,#e8a800);color:#000;font-family:Syne,sans-serif;font-size:.95rem;cursor:pointer;opacity:.3;pointer-events:none;transition:.3s;font-weight:700">
          🪙 +${CONFIG.DAILY_LOGIN_COINS} Coin Lo!
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    setTimeout(() => {
      const bar = document.getElementById('dailyAdBar');
      if (bar) bar.style.width = '100%';
    }, 100);

    let s = 5;
    const t = setInterval(() => {
      s--;
      const timerEl = document.getElementById('dailyAdTimer');
      if (timerEl) timerEl.textContent = Math.max(0, s);
      if (s <= 0) {
        clearInterval(t);
        const btn = document.getElementById('dailyAdBtn');
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.onclick = () => {
            modal.remove();
            if (typeof onComplete === 'function') onComplete();
          };
        }
      }
    }, 1000);
  }

  // ══════════════════════════════════════════
  // 9. ADMIN PROTECTION
  // ══════════════════════════════════════════

  let tapCount = 0, tapTimer = null;

  function hideAdminNav() {
    // Admin nav item hide karo
    const adminNavItem = document.getElementById('gn-admin');
    if (adminNavItem) adminNavItem.style.display = 'none';

    // Admin screen hide karo if not logged in
    const adminDash = document.getElementById('adminDash');
    const adminLogin = document.getElementById('adminLogin');
    if (adminDash) adminDash.style.display = 'none';
    if (adminLogin) adminLogin.style.display = 'flex';

    // Simulate buttons hide
    document.querySelectorAll('button').forEach(btn => {
      const txt = btn.textContent || '';
      if (txt.includes('Simulate')) btn.style.display = 'none';
    });
  }

  function setupAdminSecretTap() {
    // Invisible button — top right corner
    const existing = document.getElementById('gs-admin-secret');
    if (existing) existing.remove();

    const secretBtn = document.createElement('div');
    secretBtn.id = 'gs-admin-secret';
    secretBtn.style.cssText = `
      position:fixed;top:0;right:0;
      width:70px;height:70px;
      z-index:99998;background:transparent;
      cursor:pointer;-webkit-tap-highlight-color:transparent;
    `;
    document.body.appendChild(secretBtn);

    secretBtn.addEventListener('click', () => {
      tapCount++;
      if (tapTimer) clearTimeout(tapTimer);
      if (tapCount > 2) showAdminTapHint(CONFIG.ADMIN_SECRET_TAPS - tapCount);
      if (tapCount >= CONFIG.ADMIN_SECRET_TAPS) {
        tapCount = 0;
        clearTimeout(tapTimer);
        showAdminPasswordPrompt();
        return;
      }
      tapTimer = setTimeout(() => { tapCount = 0; }, CONFIG.ADMIN_TAP_TIMEOUT);
    });
  }

  function showAdminTapHint(remaining) {
    const old = document.getElementById('gs-tap-hint');
    if (old) old.remove();
    const hint = document.createElement('div');
    hint.id = 'gs-tap-hint';
    hint.style.cssText = `
      position:fixed;top:12px;right:80px;z-index:99999;
      background:#1f2937;color:white;padding:8px 14px;
      border-radius:20px;font-size:12px;font-weight:600;
      pointer-events:none;opacity:0.9;
    `;
    hint.textContent = `🔐 ${remaining} aur tap...`;
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 1500);
  }

  function showAdminPasswordPrompt() {
    const existing = document.getElementById('gs-admin-prompt');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gs-admin-prompt';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,.85);
      display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      padding:20px;backdrop-filter:blur(4px);
    `;
    overlay.innerHTML = `
      <div style="background:white;border-radius:24px;padding:30px 24px;max-width:310px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center">
        <div style="font-size:44px;margin-bottom:8px">🔐</div>
        <h3 style="color:#1f2937;font-size:18px;margin:0 0 4px">Admin Access</h3>
        <p style="color:#6b7280;font-size:13px;margin:0 0 18px">Green Shop Admin Panel</p>
        <input id="gs-admin-pass-input" type="password" placeholder="Password daalo"
          style="width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;box-sizing:border-box;outline:none;text-align:center;letter-spacing:4px;margin-bottom:8px"
          onfocus="this.style.border='2px solid #e11d48'"
          onblur="this.style.border='2px solid #e5e7eb'"/>
        <div id="gs-admin-pass-err" style="color:#ef4444;font-size:12px;margin-bottom:10px;min-height:16px"></div>
        <button onclick="window._gsAdminLogin()" style="background:linear-gradient(135deg,#1f2937,#374151);color:white;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;width:100%;cursor:pointer;margin-bottom:10px">🔓 Login</button>
        <button onclick="document.getElementById('gs-admin-prompt').remove()" style="background:#f3f4f6;color:#6b7280;border:none;padding:10px;border-radius:12px;font-size:14px;width:100%;cursor:pointer">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('gs-admin-pass-input')?.focus(), 100);

    document.getElementById('gs-admin-pass-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') window._gsAdminLogin();
    });

    window._gsAdminLogin = function () {
      const inp = document.getElementById('gs-admin-pass-input');
      const err = document.getElementById('gs-admin-pass-err');
      if (!inp) return;
      if (inp.value === CONFIG.ADMIN_PASSWORD) {
        overlay.remove();
        sessionStorage.setItem('gs_admin_ok', '1');
        openAdminPanelDirect();
        showAdminToast('✅ Admin access mila!');
      } else {
        err.textContent = '❌ Galat password!';
        inp.value = '';
        inp.focus();
      }
    };
  }

  function openAdminPanelDirect() {
    if (typeof openAdmin === 'function') {
      openAdmin();
    } else {
      document.querySelectorAll('.screen').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
      });
      const adminScreen = document.getElementById('screen-admin');
      if (adminScreen) {
        adminScreen.style.display = 'flex';
        adminScreen.classList.add('active');
      }
    }
  }

  function showAdminToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#16a34a;color:white;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:99998;pointer-events:none;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .4s'; }, 1500);
    setTimeout(() => t.remove(), 2000);
  }

  // ══════════════════════════════════════════
  // 10. POPUP ADS REMOVE
  // ══════════════════════════════════════════

  function removePopupAds() {
    // Adsterra Social Bar script remove
    document.querySelectorAll('script').forEach(s => {
      const src = s.src || '';
      if (src.includes('profitablecpmratenetwork') ||
          src.includes('effectivecpmratenetwork') ||
          src.includes('highperformanceformat')) {
        // Only remove social bar — not popunder (we use that in game)
        if (src.includes('profitablecpmratenetwork')) {
          s.remove();
        }
      }
    });

    // Remove inline ad scripts that show popups
    document.querySelectorAll('script').forEach(s => {
      if (s.textContent.includes('atOptions') && s.textContent.includes('Social')) {
        s.remove();
      }
    });
  }

  // ══════════════════════════════════════════
  // 11. HARDCODED DATA FIX
  // ══════════════════════════════════════════

  function fixHardcodedData() {
    const user = loadUser();
    if (!user) return;

    // Coin displays fix — 1200 → actual coins
    const coinDisplayIds = ['gCoinDisp','gStoreCoinDisp','pCoinDisp','pWalletBig','gsCoinsDisp','ppCoinsDisp','gProfileCoins','dkCoinDisp','gWalletCoins','ppCoinBig'];
    coinDisplayIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && (el.textContent === '1,200' || el.textContent === '1200')) {
        el.textContent = (user.coins || 0).toLocaleString('en-IN');
      }
    });

    // Daily login label fix — "+50" → "+1"
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0) {
        if (el.textContent.trim() === '🪙 +50') el.textContent = `🪙 +${CONFIG.DAILY_LOGIN_COINS}`;
        if (el.textContent.includes('🪙 1') && el.textContent.includes('Ad dekho')) {
          // Already correct
        }
      }
    });

    // Race earn display fix in earn-grid
    document.querySelectorAll('.earn-coins-val').forEach(el => {
      if (el.textContent.trim() === '🪙 4') el.textContent = `🪙 ${CONFIG.RACE_PRIZES[1].toLocaleString('en-IN')}`;
    });

    // Shopping status
    updateShoppingStatus(user.coins);
  }

  // ══════════════════════════════════════════
  // 12. TOAST HELPER
  // ══════════════════════════════════════════

  function gsToast(msg, type) {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.className = `show ${type || 'g'}`;
      clearTimeout(window._gsToastT);
      window._gsToastT = setTimeout(() => { t.className = ''; }, 3000);
    }
  }

  // ══════════════════════════════════════════
  // 13. MAIN INIT
  // ══════════════════════════════════════════

  function init() {
    const referredBy = getReferrerFromURL();
    const existingUser = loadUser();

    // Remove popup ads
    removePopupAds();

    // Admin hide
    hideAdminNav();

    if (!existingUser || !existingUser.name) {
      // New user — show registration
      showRegistration(referredBy);
    } else {
      // Existing user
      window._currentUser = existingUser;
      existingUser.lastLogin = new Date().toISOString();

      // Check referral pending
      checkPendingRefBonus(existingUser);

      // Sync app
      applyUserToApp(existingUser);
      window.coins = existingUser.coins || 0;

      saveUser(existingUser);
    }

    // Override functions
    overrideAppFunctions();

    // Fix race prizes
    fixRacePrizes();

    // Fix hardcoded data
    setTimeout(fixHardcodedData, 500);
    setTimeout(fixHardcodedData, 2000);

    // Setup race ads
    setupRaceAds();

    // Admin secret tap
    setupAdminSecretTap();

    // Admin session check
    if (sessionStorage.getItem('gs_admin_ok') === '1') {
      const adminNavItem = document.getElementById('gn-admin');
      if (adminNavItem) adminNavItem.style.display = '';
    }

    // MutationObserver — dynamic elements ke liye
    const observer = new MutationObserver(() => {
      hideAdminNav();
      if (window._currentUser) {
        // Simulate buttons hide
        document.querySelectorAll('button').forEach(btn => {
          if (btn.textContent?.includes('Simulate')) btn.style.display = 'none';
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
