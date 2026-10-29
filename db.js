// ============================================
// GreenEarn - Supabase Database Layer
// ============================================

const SUPABASE_URL = 'https://amsuacmczawkhrblxojn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6vmr4B_qD-5dKF1ydm_MPg_nmj2se74';

// === Supabase API Helper ===
async function sbFetch(path, method = 'GET', body = null, extraHeaders = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : '',
    ...extraHeaders
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ============================================
// COIN SYSTEM - 21M Bitcoin-style
// ============================================
const TOTAL_SUPPLY = 21000000;

const COIN_TIERS = [
  { threshold: 0,        rate: 1.00, reward_signup: 50,  reward_ref: 50,  reward_referrer: 25, daily: 5 },
  { threshold: 5250000,  rate: 1.25, reward_signup: 75,  reward_ref: 75,  reward_referrer: 35, daily: 6 },
  { threshold: 10500000, rate: 1.50, reward_signup: 100, reward_ref: 100, reward_referrer: 50, daily: 8 },
  { threshold: 15750000, rate: 2.00, reward_signup: 150, reward_ref: 150, reward_referrer: 75, daily: 10 }
];

function getCoinTier(coinsIssued) {
  let tier = COIN_TIERS[0];
  for (const t of COIN_TIERS) {
    if (coinsIssued >= t.threshold) tier = t;
  }
  return tier;
}

async function getTotalCoinsIssued() {
  try {
    const data = await sbFetch('coins_log?select=amount&action=eq.issued');
    if (!data || data.length === 0) return 0;
    return data.reduce((s, r) => s + (r.amount || 0), 0);
  } catch {
    return 0;
  }
}

async function getCurrentTier() {
  const issued = await getTotalCoinsIssued();
  return getCoinTier(issued);
}

// ============================================
// USER FUNCTIONS
// ============================================

// Generate unique referral code
function generateUID(phone) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const phonePart = phone ? String(phone).replace(/\D/g, '').slice(-4) : '0000';
  const timePart = Date.now().toString(36).toUpperCase().slice(-3);
  let randPart = '';
  for (let i = 0; i < 3; i++) randPart += chars[Math.floor(Math.random() * chars.length)];
  return 'GE' + phonePart + timePart + randPart;
}

async function getUserByPhone(phone) {
  try {
    const data = await sbFetch(`users?phone=eq.${phone}&limit=1`);
    return data && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

async function registerUser(phone, name, referredBy = '') {
  // Check if already exists
  const existing = await getUserByPhone(phone);
  if (existing) return { success: true, user: existing, isNew: false };

  // Get coin tier for signup reward
  const tier = await getCurrentTier();
  let signupCoins = tier.reward_signup;
  let referrerBonus = 0;

  // Validate referral
  let validRef = '';
  if (referredBy) {
    const refUser = await sbFetch(`users?referral_code=eq.${referredBy.trim().toUpperCase()}&limit=1`);
    if (refUser && refUser.length > 0) {
      validRef = referredBy.trim().toUpperCase();
      signupCoins += tier.reward_ref;
      referrerBonus = tier.reward_referrer;
    }
  }

  const refCode = generateUID(phone);
  const userData = {
    phone,
    name,
    referral_code: refCode,
    referred_by: validRef || null,
    coins: signupCoins,
    ref_count: 0,
    ref_earned: 0,
    races: 0,
    wins: 0,
    daily_date: null
  };

  try {
    const result = await sbFetch('users', 'POST', userData, { 'Prefer': 'return=representation' });
    const newUser = Array.isArray(result) ? result[0] : result;

    // Log coin issuance
    await logCoins('issued', signupCoins, `Signup: ${phone}`);

    // Give referrer bonus
    if (validRef && referrerBonus > 0) {
      const refUser = await sbFetch(`users?referral_code=eq.${validRef}&limit=1`);
      if (refUser && refUser.length > 0) {
        const ru = refUser[0];
        await sbFetch(`users?phone=eq.${ru.phone}`, 'PATCH', {
          coins: (ru.coins || 0) + referrerBonus,
          ref_count: (ru.ref_count || 0) + 1,
          ref_earned: (ru.ref_earned || 0) + referrerBonus
        });
        await logCoins('issued', referrerBonus, `Referral bonus: ${ru.phone}`);
      }
    }

    return { success: true, user: newUser, isNew: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function updateUserCoins(phone, newCoins) {
  try {
    await sbFetch(`users?phone=eq.${phone}`, 'PATCH', { coins: newCoins });
    return true;
  } catch {
    return false;
  }
}

async function claimDailyBonus(phone) {
  const user = await getUserByPhone(phone);
  if (!user) return { success: false, error: 'User not found' };

  const today = new Date().toISOString().split('T')[0];
  if (user.daily_date === today) {
    return { success: false, error: 'Already claimed today' };
  }

  const tier = await getCurrentTier();
  const bonus = tier.daily;
  const newCoins = (user.coins || 0) + bonus;

  await sbFetch(`users?phone=eq.${phone}`, 'PATCH', {
    coins: newCoins,
    daily_date: today
  });
  await logCoins('issued', bonus, `Daily bonus: ${phone}`);
  return { success: true, coins: bonus, total: newCoins };
}

// ============================================
// PRODUCTS
// ============================================

async function getProducts(category = '') {
  try {
    let q = 'products?order=created_at.desc';
    if (category && category !== 'All') {
      q += `&category=eq.${encodeURIComponent(category)}`;
    }
    const data = await sbFetch(q);
    return data || [];
  } catch {
    return [];
  }
}

async function addProduct(product) {
  try {
    const result = await sbFetch('products', 'POST', product, { 'Prefer': 'return=representation' });
    return { success: true, product: Array.isArray(result) ? result[0] : result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function updateProduct(id, updates) {
  try {
    await sbFetch(`products?id=eq.${id}`, 'PATCH', updates);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deleteProduct(id) {
  try {
    await sbFetch(`products?id=eq.${id}`, 'DELETE');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// ORDERS
// ============================================

async function createOrder(userPhone, items, total, coinsUsed, paymentMode) {
  try {
    const orderData = {
      user_phone: userPhone,
      items: items,
      total: total,
      coins_used: coinsUsed,
      payment_mode: paymentMode,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const result = await sbFetch('orders', 'POST', orderData, { 'Prefer': 'return=representation' });
    const order = Array.isArray(result) ? result[0] : result;

    // Log coin usage
    if (coinsUsed > 0) {
      await logCoins('used', coinsUsed, `Order: ${order.id}`);
      // Track in coin_transactions
      await sbFetch('coin_transactions', 'POST', {
        order_id: order.id,
        user_phone: userPhone,
        coins_used: coinsUsed
      }).catch(() => {});
    }

    return { success: true, order };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getOrders(limit = 50) {
  try {
    const data = await sbFetch(`orders?order=created_at.desc&limit=${limit}`);
    return data || [];
  } catch {
    return [];
  }
}

async function updateOrderStatus(id, status) {
  try {
    await sbFetch(`orders?id=eq.${id}`, 'PATCH', { status });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getUserOrders(phone) {
  try {
    const data = await sbFetch(`orders?user_phone=eq.${phone}&order=created_at.desc&limit=20`);
    return data || [];
  } catch {
    return [];
  }
}

// ============================================
// COINS LOG
// ============================================

async function logCoins(action, amount, note = '') {
  try {
    await sbFetch('coins_log', 'POST', {
      action,
      amount,
      note,
      created_at: new Date().toISOString()
    });
  } catch {}
}

// ============================================
// OFFERS
// ============================================

async function getOffers() {
  try {
    const data = await sbFetch('offers?order=created_at.desc&limit=10');
    return data || [];
  } catch {
    return [];
  }
}

async function addOffer(offer) {
  try {
    const result = await sbFetch('offers', 'POST', offer, { 'Prefer': 'return=representation' });
    return { success: true, offer: Array.isArray(result) ? result[0] : result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deleteOffer(id) {
  try {
    await sbFetch(`offers?id=eq.${id}`, 'DELETE');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// ANALYTICS
// ============================================

async function getAllUsers(limit = 100) {
  try {
    const data = await sbFetch(`users?order=coins.desc&limit=${limit}`);
    return data || [];
  } catch {
    return [];
  }
}

async function getAnalytics() {
  try {
    const [users, orders, coinsLog] = await Promise.all([
      sbFetch('users?select=coins,ref_count'),
      sbFetch('orders?select=total,coins_used,status'),
      sbFetch('coins_log?select=action,amount')
    ]);

    const totalUsers = users ? users.length : 0;
    const totalOrders = orders ? orders.length : 0;
    const totalRevenue = orders ? orders.reduce((s, o) => s + (o.total || 0), 0) : 0;
    const issued = coinsLog ? coinsLog.filter(c => c.action === 'issued').reduce((s, c) => s + (c.amount || 0), 0) : 0;
    const used = coinsLog ? coinsLog.filter(c => c.action === 'used').reduce((s, c) => s + (c.amount || 0), 0) : 0;

    return { totalUsers, totalOrders, totalRevenue, coinsIssued: issued, coinsUsed: used };
  } catch {
    return { totalUsers: 0, totalOrders: 0, totalRevenue: 0, coinsIssued: 0, coinsUsed: 0 };
  }
}

// ============================================
// GAME PRIZES
// ============================================

const GAME_PRIZES_TAP = [
  { min: 0,   max: 19,  coins: 0,  msg: 'Thoda aur tap karo! 🎯' },
  { min: 20,  max: 29,  coins: 2,  msg: 'Achha! +2 🪙' },
  { min: 30,  max: 39,  coins: 5,  msg: 'Badiya! +5 🪙' },
  { min: 40,  max: 49,  coins: 8,  msg: 'Shaandaar! +8 🪙' },
  { min: 50,  max: 59,  coins: 12, msg: 'Excellent! +12 🪙' },
  { min: 60,  max: 69,  coins: 15, msg: 'Pro Player! +15 🪙' },
  { min: 70,  max: 999, coins: 20, msg: 'Legend! +20 🪙 🏆' }
];

const GAME_PRIZES_RACE = [
  { minScore: 0,   coins: 0,  msg: 'Zyada doors jayein! 🚗' },
  { minScore: 100, coins: 3,  msg: 'Good drive! +3 🪙' },
  { minScore: 300, coins: 7,  msg: 'Speed racer! +7 🪙' },
  { minScore: 500, coins: 12, msg: 'Champion! +12 🪙' },
  { minScore: 800, coins: 18, msg: 'Unstoppable! +18 🪙 🏆' }
];

function getTapPrize(taps) {
  for (const p of GAME_PRIZES_TAP) {
    if (taps >= p.min && taps <= p.max) return p;
  }
  return GAME_PRIZES_TAP[GAME_PRIZES_TAP.length - 1];
}

function getRacePrize(score) {
  let prize = GAME_PRIZES_RACE[0];
  for (const p of GAME_PRIZES_RACE) {
    if (score >= p.minScore) prize = p;
  }
  return prize;
}

async function awardGameCoins(phone, coins, action) {
  if (coins <= 0) return;
  const user = await getUserByPhone(phone);
  if (!user) return;
  const newCoins = (user.coins || 0) + coins;
  await updateUserCoins(phone, newCoins);
  await logCoins('issued', coins, `Game reward: ${action} - ${phone}`);
  // Update game stats
  await sbFetch(`users?phone=eq.${phone}`, 'PATCH', {
    races: (user.races || 0) + 1,
    wins: coins > 0 ? (user.wins || 0) + 1 : (user.wins || 0)
  }).catch(() => {});
  return newCoins;
}

// ============================================
// ADMIN AUTH
// ============================================

const ADMIN_CREDENTIALS = {
  username: 'GreenEarn@Admin',
  password: 'GE@2025#Secure!'
};

function verifyAdmin(username, password) {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}

// ============================================
// VISITOR TRACKING
// ============================================

async function trackVisit() {
  try {
    await sbFetch('visitors', 'POST', { page: 'home', ts: new Date().toISOString() });
  } catch {}
}
