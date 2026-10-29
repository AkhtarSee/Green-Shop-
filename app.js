// ============================================
// GreenEarn - Main App Logic
// ============================================

// --- App State ---
const App = {
  user: null,
  cart: [],
  products: [],
  currentPage: 'home',
  currentCategory: 'All',
  isAdmin: false,
  adminTapCount: 0,
  adminTapTimer: null,
  syncInterval: null,
  useCoinCheckout: false,
  gameMode: 'free', // 'free' | 'paid'
  gameType: 'tap',  // 'tap' | 'race'

  // Tap Battle state
  tap: {
    count: 0,
    timeLeft: 15,
    timer: null,
    running: false,
    phase: 'start' // start | playing | result
  },

  // Race state
  race: {
    score: 0,
    timer: null,
    running: false,
    carX: 50, // % from left
    enemies: [],
    animFrame: null,
    phase: 'start',
    speed: 3,
    spawnInterval: null
  }
};

// --- Init ---
window.addEventListener('DOMContentLoaded', async () => {
  showLoading();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  await trackVisit();

  // Check saved user
  const savedPhone = localStorage.getItem('ge_user_phone');
  if (savedPhone) {
    const user = await getUserByPhone(savedPhone);
    if (user) {
      App.user = user;
      hideLoading();
      showMainApp();
      return;
    }
  }

  hideLoading();
  showRegisterScreen();
});

// --- Screen Management ---
function showLoading() {
  document.getElementById('loading-screen').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
}
function showRegisterScreen() {
  document.getElementById('register-screen').classList.add('active');
}
function hideRegisterScreen() {
  document.getElementById('register-screen').classList.remove('active');
}
function showMainApp() {
  document.getElementById('main-app').classList.add('active');
  updateCoinDisplay();
  loadPage('home');
  startProductSync();
}

// --- Registration ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('reg-phone').value.trim();
  const name = document.getElementById('reg-name').value.trim();
  const ref = document.getElementById('reg-ref').value.trim();

  if (!phone || phone.length < 10) { showToast('Valid mobile number daalo', 'error'); return; }
  if (!name || name.length < 2) { showToast('Apna naam daalo', 'error'); return; }

  const btn = e.target.querySelector('button');
  btn.textContent = 'Registering...';
  btn.disabled = true;

  try {
    const result = await registerUser(phone, name, ref);
    if (result.success) {
      App.user = result.user;
      localStorage.setItem('ge_user_phone', phone);
      hideRegisterScreen();
      showMainApp();
      if (result.isNew) {
        showToast(`Welcome ${name}! +${result.user.coins} 🪙 coins mili!`, 'success');
      } else {
        showToast(`Welcome back, ${name}!`, 'success');
      }
    } else {
      showToast(result.error || 'Error! Try again', 'error');
      btn.textContent = 'Get Started';
      btn.disabled = false;
    }
  } catch {
    showToast('Connection error!', 'error');
    btn.textContent = 'Get Started';
    btn.disabled = false;
  }
});

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    loadPage(page);
  });
});

function loadPage(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  // Update pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });
  App.currentPage = page;

  // Load page data
  if (page === 'home') loadHomePage();
  else if (page === 'shop') loadShopPage();
  else if (page === 'cart') loadCartPage();
  else if (page === 'games') loadGamesPage();
  else if (page === 'profile') loadProfilePage();
}

// ============================================
// HOME PAGE
// ============================================
async function loadHomePage() {
  updateCoinDisplay();

  // User greeting
  const el = document.getElementById('hero-user-name');
  if (el && App.user) el.textContent = App.user.name.split(' ')[0];

  // Hero coins
  const coinEl = document.getElementById('hero-coins');
  if (coinEl) coinEl.textContent = (App.user?.coins || 0).toLocaleString('en-IN');

  // Load offers
  loadOffers();

  // Load supply info
  loadSupplyInfo();

  // Stats
  loadHomeStats();
}

async function loadOffers() {
  const wrap = document.getElementById('offers-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div style="padding:10px;color:var(--text-muted);font-size:12px">Loading...</div>';

  const offers = await getOffers();
  if (!offers.length) {
    wrap.innerHTML = `<div class="offer-card" style="background:rgba(0,200,150,0.06);border-color:rgba(0,200,150,0.2)">
      <div class="offer-badge" style="background:rgba(0,200,150,0.15);color:var(--accent-green)">🎉 Special</div>
      <h4>Fresh Vegetables</h4>
      <p>Aaj ke liye discount deals</p>
    </div>`;
    return;
  }
  wrap.innerHTML = offers.map(o => `
    <div class="offer-card" style="background:${o.color || 'var(--bg-card)'}20;border-color:${o.color || 'var(--glass-border)'}40">
      <div class="offer-badge" style="background:${o.color || '#00c896'}20;color:${o.color || '#00c896'}">${o.badge || '🎁'}</div>
      <h4>${escHtml(o.title)}</h4>
      <p>${escHtml(o.subtitle || '')}</p>
    </div>`).join('');
}

async function loadSupplyInfo() {
  const wrap = document.getElementById('supply-wrap');
  if (!wrap) return;
  try {
    const issued = await getTotalCoinsIssued();
    const pct = Math.min((issued / 21000000) * 100, 100).toFixed(1);
    const tier = getCoinTier(issued);
    const remaining = 21000000 - issued;
    wrap.innerHTML = `
      <div class="supply-banner">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:700;color:var(--accent-gold)">⚡ GreenEarn Coin Supply</span>
          <span class="rate-badge">1🪙 = ₹${tier.rate.toFixed(2)}</span>
        </div>
        <div class="supply-bar-bg">
          <div class="supply-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="supply-info">
          <span>${Number(issued).toLocaleString('en-IN')} coins issued</span>
          <span>${Number(remaining).toLocaleString('en-IN')} remaining</span>
        </div>
      </div>`;
  } catch {}
}

async function loadHomeStats() {
  try {
    const stats = await getAnalytics();
    const userEl = document.getElementById('stat-users');
    const orderEl = document.getElementById('stat-orders');
    const coinEl = document.getElementById('stat-coins');
    if (userEl) userEl.textContent = stats.totalUsers;
    if (orderEl) orderEl.textContent = stats.totalOrders;
    if (coinEl) coinEl.textContent = (stats.coinsIssued || 0).toLocaleString('en-IN');
  } catch {}
}

// Daily Bonus
document.getElementById('btn-daily-bonus')?.addEventListener('click', async () => {
  if (!App.user) return;
  const btn = document.getElementById('btn-daily-bonus');
  btn.disabled = true;
  const result = await claimDailyBonus(App.user.phone);
  if (result.success) {
    App.user.coins = result.total;
    updateCoinDisplay();
    showToast(`+${result.coins} 🪙 daily bonus mili!`, 'success');
    loadHomePage();
  } else {
    showToast(result.error || 'Already claimed!', 'info');
  }
  btn.disabled = false;
});

// ============================================
// SHOP PAGE
// ============================================
async function loadShopPage() {
  loadProducts(App.currentCategory);
}

async function loadProducts(category = 'All') {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div>`;
  grid.style.gridColumn = 'span 2';

  const products = await getProducts(category === 'All' ? '' : category);
  App.products = products;

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:span 2">
      <div class="empty-icon">🛒</div>
      <p>Koi product nahi mila</p>
    </div>`;
    grid.style.gridColumn = '';
    return;
  }

  grid.style.gridColumn = '';
  grid.innerHTML = products.map(p => renderProductCard(p)).join('');
}

function renderProductCard(p) {
  const cartItem = App.cart.find(c => c.id === p.id);
  const qty = cartItem ? cartItem.qty : 0;
  const imgContent = p.image_url
    ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}" onerror="this.parentElement.textContent='${p.emoji || '🛍️'}'"/>`
    : `${p.emoji || '🛍️'}`;

  return `<div class="product-card" onclick="openProductDetail('${p.id}')">
    <div class="product-img">
      ${imgContent}
      ${p.is_fresh ? '<span class="fresh-tag">Fresh</span>' : ''}
    </div>
    <div class="product-info">
      <div class="product-name">${escHtml(p.name)}</div>
      <div class="product-unit">${escHtml(p.unit || 'per piece')}</div>
      <div class="product-footer">
        <div class="product-price">₹${p.price}</div>
        ${qty > 0
          ? `<div class="qty-controls" onclick="event.stopPropagation()">
               <button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button>
               <span class="qty-num">${qty}</span>
               <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button>
             </div>`
          : `<button class="add-btn" onclick="event.stopPropagation();addToCart('${p.id}')">+</button>`
        }
      </div>
    </div>
  </div>`;
}

// Category filter
document.querySelectorAll('.cat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    App.currentCategory = chip.dataset.cat;
    loadProducts(App.currentCategory);
  });
});

// Product search
document.getElementById('search-input')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { loadProducts(App.currentCategory); return; }
  const filtered = App.products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q)
  );
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:span 2">
      <div class="empty-icon">🔍</div><p>"${q}" nahi mila</p>
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(renderProductCard).join('');
});

// Add to cart
function addToCart(productId) {
  const product = App.products.find(p => p.id === productId);
  if (!product) return;
  const existing = App.cart.find(c => c.id === productId);
  if (existing) {
    existing.qty++;
  } else {
    App.cart.push({ ...product, qty: 1 });
  }
  updateCartBadge();
  loadProducts(App.currentCategory); // refresh to show qty controls
  showToast(`${product.name} cart mein add hua 🛒`, 'success');
}

function changeQty(productId, delta) {
  const idx = App.cart.findIndex(c => c.id === productId);
  if (idx === -1) return;
  App.cart[idx].qty += delta;
  if (App.cart[idx].qty <= 0) App.cart.splice(idx, 1);
  updateCartBadge();
  loadProducts(App.currentCategory);
  if (App.currentPage === 'cart') loadCartPage();
}

function updateCartBadge() {
  const total = App.cart.reduce((s, c) => s + c.qty, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
}

// ============================================
// CART PAGE
// ============================================
function loadCartPage() {
  const container = document.getElementById('cart-container');
  if (!container) return;

  if (!App.cart.length) {
    container.innerHTML = `<div class="empty-state" style="padding:80px 20px">
      <div class="empty-icon">🛒</div>
      <p>Cart khali hai</p>
      <button class="btn-primary" style="margin-top:16px;max-width:200px" onclick="loadPage('shop')">Shopping Karein</button>
    </div>`;
    return;
  }

  const subtotal = App.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const userCoins = App.user?.coins || 0;
  const canUseCoin = userCoins >= 500;
  const coinDiscount = App.useCoinCheckout && canUseCoin ? Math.min(userCoins, subtotal) : 0;
  const total = Math.max(0, subtotal - coinDiscount);

  container.innerHTML = `
    <div class="cart-items">
      ${App.cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-emoji">${item.emoji || '🛍️'}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${escHtml(item.name)}</div>
            <div class="cart-item-price">₹${item.price} × ${item.qty} = ₹${(item.price * item.qty).toFixed(0)}</div>
          </div>
          <div class="qty-controls">
            <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
          </div>
        </div>`).join('')}
    </div>

    <div class="cart-summary">
      <div class="summary-row"><span>Subtotal</span><span>₹${subtotal}</span></div>
      ${coinDiscount > 0 ? `<div class="summary-row" style="color:var(--accent-gold)"><span>Coin Discount (${coinDiscount} 🪙)</span><span>−₹${coinDiscount}</span></div>` : ''}
      <div class="summary-row"><span>Delivery</span><span style="color:var(--accent-green)">Free</span></div>
      <div class="summary-row total"><span>Total</span><span style="color:var(--accent-green)">₹${total}</span></div>
    </div>

    ${canUseCoin ? `
    <div class="coin-toggle">
      <div class="coin-toggle-info">
        <h4>💰 Coins se payment (${userCoins} 🪙)</h4>
        <p>Aapke paas ${userCoins} coins hain. Toggle on karo.</p>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="coin-toggle-input" ${App.useCoinCheckout ? 'checked' : ''} onchange="toggleCoinCheckout(this.checked)">
        <span class="toggle-slider"></span>
      </label>
    </div>` : userCoins < 500 ? `
    <div style="margin:8px 16px;padding:12px;background:rgba(255,77,109,0.06);border:1px solid rgba(255,77,109,0.2);border-radius:12px;font-size:12px;color:var(--text-muted)">
      ❌ Coins se payment ke liye minimum 500 coins chahiye. Abhi ${userCoins} coins hain. (${500 - userCoins} aur chahiye)
    </div>` : ''}

    <button class="checkout-btn" onclick="openCheckout()">
      Checkout — ₹${total} →
    </button>`;
}

function toggleCoinCheckout(val) {
  App.useCoinCheckout = val;
  loadCartPage();
}

// ============================================
// CHECKOUT / PAYMENT
// ============================================
function openCheckout() {
  if (!App.cart.length) return;
  const subtotal = App.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const userCoins = App.user?.coins || 0;
  const coinDiscount = App.useCoinCheckout && userCoins >= 500 ? Math.min(userCoins, subtotal) : 0;
  const total = Math.max(0, subtotal - coinDiscount);

  document.getElementById('modal-order-items').textContent = App.cart.map(c => `${c.name} ×${c.qty}`).join(', ');
  document.getElementById('modal-order-subtotal').textContent = `₹${subtotal}`;
  document.getElementById('modal-order-coins').textContent = coinDiscount > 0 ? `−₹${coinDiscount} (${coinDiscount}🪙)` : '₹0';
  document.getElementById('modal-order-total').textContent = `₹${total}`;

  // Set UPI amounts
  const upiAmt = total;
  document.querySelectorAll('.upi-btn').forEach(btn => {
    const app = btn.dataset.upi;
    let upiUrl = '';
    if (app === 'gpay') upiUrl = `gpay://upi/pay?pa=paytm.slyxeps@pty&pn=GreenEarn&am=${upiAmt}&cu=INR`;
    else if (app === 'phonepe') upiUrl = `phonepe://pay?pa=paytm.slyxeps@pty&pn=GreenEarn&am=${upiAmt}&cu=INR`;
    else if (app === 'paytm') upiUrl = `paytmmp://pay?pa=paytm.slyxeps@pty&pn=GreenEarn&am=${upiAmt}&cu=INR`;
    else if (app === 'bhim') upiUrl = `upi://pay?pa=paytm.slyxeps@pty&pn=GreenEarn&am=${upiAmt}&cu=INR`;
    btn.dataset.url = upiUrl;
  });

  openModal('checkout-modal');
}

document.querySelectorAll('.upi-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const url = btn.dataset.url;
    if (url) {
      window.location.href = url;
      // After 2s, confirm order
      setTimeout(() => { confirmOrder(btn.dataset.upi); }, 2000);
    }
  });
});

async function confirmOrder(paymentMode) {
  const subtotal = App.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const userCoins = App.user?.coins || 0;
  const coinDiscount = App.useCoinCheckout && userCoins >= 500 ? Math.min(userCoins, subtotal) : 0;
  const total = Math.max(0, subtotal - coinDiscount);

  const items = App.cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty }));

  // Deduct coins if used
  if (coinDiscount > 0) {
    const newCoins = userCoins - coinDiscount;
    await updateUserCoins(App.user.phone, newCoins);
    App.user.coins = newCoins;
    updateCoinDisplay();
  }

  const result = await createOrder(App.user.phone, items, total, coinDiscount, paymentMode);
  if (result.success) {
    closeModal('checkout-modal');
    App.cart = [];
    App.useCoinCheckout = false;
    updateCartBadge();
    showToast('Order place ho gaya! ✅', 'success');
    loadPage('home');
  } else {
    showToast('Order error: ' + result.error, 'error');
  }
}

// ============================================
// GAMES PAGE
// ============================================
function loadGamesPage() {
  // Games page is static HTML, no dynamic load needed
}

// Open Tap Battle (Free)
function openTapFree() {
  App.gameType = 'tap';
  App.gameMode = 'free';
  openGameOverlay('Tap Battle — Free');
  renderTapGame();
}

// Open Tap Battle (Paid - 10 coins entry)
async function openTapPaid() {
  if (!App.user) return;
  if ((App.user.coins || 0) < 10) {
    showToast('10 coins chahiye! Pehle earn karo 🎮', 'error');
    return;
  }
  App.gameType = 'tap';
  App.gameMode = 'paid';
  // Deduct 10 coins
  const newCoins = App.user.coins - 10;
  await updateUserCoins(App.user.phone, newCoins);
  await logCoins('used', 10, `Paid game entry: ${App.user.phone}`);
  App.user.coins = newCoins;
  updateCoinDisplay();
  openGameOverlay('Tap Battle — Paid 🪙');
  renderTapGame();
}

// Open Race (Free)
function openRaceFree() {
  App.gameType = 'race';
  App.gameMode = 'free';
  openGameOverlay('Car Race — Free');
  renderRaceGame();
}

// Open Race (Paid)
async function openRacePaid() {
  if (!App.user) return;
  if ((App.user.coins || 0) < 10) {
    showToast('10 coins chahiye! 🏎️', 'error');
    return;
  }
  App.gameType = 'race';
  App.gameMode = 'paid';
  const newCoins = App.user.coins - 10;
  await updateUserCoins(App.user.phone, newCoins);
  await logCoins('used', 10, `Paid race entry: ${App.user.phone}`);
  App.user.coins = newCoins;
  updateCoinDisplay();
  openGameOverlay('Car Race — Paid 🏆');
  renderRaceGame();
}

function openGameOverlay(title) {
  document.getElementById('game-overlay-title').textContent = title;
  document.getElementById('game-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeGameOverlay() {
  // Stop any running game
  stopTapGame();
  stopRaceGame();
  document.getElementById('game-overlay').classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('game-canvas-area').innerHTML = '';
}
document.getElementById('btn-close-game').addEventListener('click', closeGameOverlay);

// ============================================
// TAP BATTLE GAME
// ============================================
function renderTapGame() {
  const area = document.getElementById('game-canvas-area');
  area.innerHTML = `
    <div id="tap-game">
      <div id="tap-start-view">
        <div style="font-size:48px">👆</div>
        <div style="font-size:22px;font-weight:800">Tap Battle</div>
        <div style="font-size:13px;color:var(--text-secondary);text-align:center;max-width:260px">
          15 seconds mein jitna ho sake tap karo!<br>
          ${App.gameMode === 'paid' ? '<span style="color:var(--accent-gold)">Paid mode — zyada coins mile!</span>' : 'Free mode'}
        </div>
        <button class="tap-start-btn" onclick="startTapGame()">Start Game!</button>
      </div>
    </div>`;
  App.tap.phase = 'start';
}

function startTapGame() {
  App.tap.count = 0;
  App.tap.timeLeft = 15;
  App.tap.running = true;
  App.tap.phase = 'playing';

  const area = document.getElementById('game-canvas-area');
  area.innerHTML = `
    <div id="tap-game">
      <div class="tap-score-row">
        <div class="tap-score-box">
          <div class="score-val" id="tap-count">0</div>
          <div class="score-lbl">Taps</div>
        </div>
        <div class="tap-score-box">
          <div class="score-val" style="color:var(--accent-cyan)" id="tap-time">15</div>
          <div class="score-lbl">Seconds</div>
        </div>
      </div>
      <button class="tap-btn" id="tap-button" ontouchstart="tapIt(event)" onclick="tapIt(event)">👆</button>
      <div style="font-size:12px;color:var(--text-muted)">Jaldi tap karo!</div>
    </div>`;

  App.tap.timer = setInterval(() => {
    App.tap.timeLeft--;
    const el = document.getElementById('tap-time');
    if (el) el.textContent = App.tap.timeLeft;
    if (App.tap.timeLeft <= 3 && el) el.style.color = 'var(--accent-red)';
    if (App.tap.timeLeft <= 0) endTapGame();
  }, 1000);
}

function tapIt(e) {
  e.preventDefault();
  if (!App.tap.running) return;
  App.tap.count++;
  const el = document.getElementById('tap-count');
  if (el) el.textContent = App.tap.count;
  // Micro animation
  const btn = document.getElementById('tap-button');
  if (btn) {
    btn.style.transform = 'scale(0.90)';
    setTimeout(() => { if (btn) btn.style.transform = ''; }, 60);
  }
}

function stopTapGame() {
  clearInterval(App.tap.timer);
  App.tap.running = false;
}

async function endTapGame() {
  stopTapGame();
  App.tap.phase = 'result';
  const taps = App.tap.count;
  const prize = getTapPrize(taps);
  // Double coins in paid mode
  const coins = App.gameMode === 'paid' ? prize.coins * 2 : prize.coins;

  let newTotal = App.user?.coins || 0;
  if (coins > 0 && App.user) {
    newTotal = await awardGameCoins(App.user.phone, coins, 'tap-battle');
    if (newTotal) {
      App.user.coins = newTotal;
      updateCoinDisplay();
    }
  }

  const area = document.getElementById('game-canvas-area');
  area.innerHTML = `
    <div id="tap-game" style="gap:16px">
      <div style="font-size:52px">🎯</div>
      <div class="tap-score-row">
        <div class="tap-score-box">
          <div class="score-val">${taps}</div>
          <div class="score-lbl">Total Taps</div>
        </div>
      </div>
      <div class="tap-prize">${coins > 0 ? `+${coins} 🪙 Coins` : 'Better luck next time!'}</div>
      <div class="tap-info">${prize.msg}</div>
      ${coins > 0 ? `<div style="font-size:13px;color:var(--text-secondary)">Total Coins: ${newTotal || App.user?.coins || 0} 🪙</div>` : ''}
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <button class="tap-start-btn" onclick="renderTapGame()">Play Again</button>
        <button class="tap-result-btn" style="background:rgba(255,255,255,0.08);border:1px solid var(--glass-border)" onclick="closeGameOverlay()">Exit</button>
      </div>
    </div>`;
}

// ============================================
// CAR RACE GAME
// ============================================
function renderRaceGame() {
  const area = document.getElementById('game-canvas-area');
  area.innerHTML = `
    <div id="race-game">
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:10">
        <div style="font-size:52px">🏎️</div>
        <div style="font-size:22px;font-weight:800">Car Race</div>
        <div style="font-size:13px;color:var(--text-secondary);text-align:center;max-width:260px">
          Dusri gadiyon se bachke race jeeto!<br>
          ${App.gameMode === 'paid' ? '<span style="color:var(--accent-gold)">Paid — double coins!</span>' : 'Free mode'}
        </div>
        <button class="tap-start-btn" onclick="startRaceGame()">Race Start!</button>
      </div>
    </div>`;
  App.race.phase = 'start';
}

function startRaceGame() {
  App.race.score = 0;
  App.race.carX = 50;
  App.race.enemies = [];
  App.race.speed = 3;
  App.race.running = true;
  App.race.phase = 'playing';

  const area = document.getElementById('game-canvas-area');
  const roadW = Math.min(area.clientWidth, 360);
  const roadLeft = (area.clientWidth - roadW) / 2;

  area.innerHTML = `
    <div id="race-game">
      <div class="race-road" id="race-road" style="width:${roadW}px;left:${roadLeft + roadW/2}px"></div>
      <div class="race-score-overlay">
        <div class="race-score-box">🏁 Score: <span id="race-score">0</span></div>
        <div class="race-score-box" style="color:var(--accent-cyan)">❤️ <span id="race-lives">3</span></div>
      </div>
      <div class="player-car" id="player-car" style="left:calc(${roadLeft + roadW/2}px + ${App.race.carX - 50}% )">🚗</div>
      <div class="race-controls">
        <button class="race-ctrl-btn" id="btn-left" ontouchstart="raceMoveLeft()" onmousedown="raceMoveLeft()">◀</button>
        <button class="race-ctrl-btn" id="btn-right" ontouchstart="raceMoveRight()" onmousedown="raceMoveRight()">▶</button>
      </div>
    </div>`;

  App.race.lives = 3;
  // Spawn enemies
  App.race.spawnInterval = setInterval(spawnEnemy, 1500);
  // Score ticker
  App.race.timer = setInterval(() => {
    App.race.score += 10;
    App.race.speed = 3 + Math.floor(App.race.score / 200) * 0.5;
    const el = document.getElementById('race-score');
    if (el) el.textContent = App.race.score;
  }, 500);
  // Animate enemies
  animateRace();
}

function raceMoveLeft() {
  if (!App.race.running) return;
  App.race.carX = Math.max(15, App.race.carX - 12);
  updateCarPos();
}
function raceMoveRight() {
  if (!App.race.running) return;
  App.race.carX = Math.min(85, App.race.carX + 12);
  updateCarPos();
}

function updateCarPos() {
  const area = document.getElementById('game-canvas-area');
  const roadW = Math.min(area.clientWidth, 360);
  const roadLeft = (area.clientWidth - roadW) / 2;
  const car = document.getElementById('player-car');
  if (car) {
    const px = roadLeft + (App.race.carX / 100) * roadW - 24;
    car.style.left = px + 'px';
  }
}

function spawnEnemy() {
  if (!App.race.running) return;
  const area = document.getElementById('game-canvas-area');
  const roadW = Math.min(area.clientWidth, 360);
  const roadLeft = (area.clientWidth - roadW) / 2;
  const laneX = roadLeft + [20, 40, 60, 80][Math.floor(Math.random() * 4)] / 100 * roadW - 24;

  const el = document.createElement('div');
  el.className = 'enemy-car';
  el.textContent = ['🚙', '🚕', '🚌', '🚎'][Math.floor(Math.random() * 4)];
  el.style.left = laneX + 'px';
  el.style.top = '-60px';
  const gameDiv = document.getElementById('race-game');
  if (gameDiv) {
    gameDiv.appendChild(el);
    App.race.enemies.push({ el, x: laneX, y: -60 });
  }
}

function animateRace() {
  if (!App.race.running) return;
  const area = document.getElementById('game-canvas-area');
  const h = area.clientHeight;

  App.race.enemies = App.race.enemies.filter(enemy => {
    enemy.y += App.race.speed * 2;
    if (enemy.el.parentElement) {
      enemy.el.style.top = enemy.y + 'px';
    }
    // Collision check
    const car = document.getElementById('player-car');
    if (car) {
      const carRect = car.getBoundingClientRect();
      const enemyRect = enemy.el.getBoundingClientRect();
      const overlap = !(carRect.right < enemyRect.left || carRect.left > enemyRect.right ||
                        carRect.bottom < enemyRect.top || carRect.top > enemyRect.bottom);
      if (overlap) {
        enemy.el.remove();
        App.race.lives--;
        const livesEl = document.getElementById('race-lives');
        if (livesEl) livesEl.textContent = App.race.lives;
        if (App.race.lives <= 0) { endRaceGame(); return false; }
        return false;
      }
    }
    if (enemy.y > h + 60) {
      enemy.el.remove();
      return false;
    }
    return true;
  });

  App.race.animFrame = requestAnimationFrame(animateRace);
}

function stopRaceGame() {
  App.race.running = false;
  clearInterval(App.race.timer);
  clearInterval(App.race.spawnInterval);
  cancelAnimationFrame(App.race.animFrame);
}

async function endRaceGame() {
  stopRaceGame();
  App.race.phase = 'result';
  const score = App.race.score;
  const prize = getRacePrize(score);
  const coins = App.gameMode === 'paid' ? prize.coins * 2 : prize.coins;

  let newTotal = App.user?.coins || 0;
  if (coins > 0 && App.user) {
    newTotal = await awardGameCoins(App.user.phone, coins, 'car-race') || newTotal;
    App.user.coins = newTotal;
    updateCoinDisplay();
  }

  const area = document.getElementById('game-canvas-area');
  area.innerHTML = `
    <div id="tap-game" style="gap:16px">
      <div style="font-size:52px">🏁</div>
      <div class="tap-score-row">
        <div class="tap-score-box">
          <div class="score-val">${score}</div>
          <div class="score-lbl">Score</div>
        </div>
      </div>
      <div class="tap-prize">${coins > 0 ? `+${coins} 🪙 Coins` : 'Try harder!'}</div>
      <div class="tap-info">${prize.msg}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <button class="tap-start-btn" onclick="renderRaceGame()">Race Again</button>
        <button class="tap-result-btn" style="background:rgba(255,255,255,0.08);border:1px solid var(--glass-border)" onclick="closeGameOverlay()">Exit</button>
      </div>
    </div>`;
}

// ============================================
// PROFILE PAGE
// ============================================
async function loadProfilePage() {
  if (!App.user) return;
  const u = App.user;

  // Refresh user data
  const freshUser = await getUserByPhone(u.phone);
  if (freshUser) {
    App.user = freshUser;
    updateCoinDisplay();
  }

  document.getElementById('profile-name').textContent = App.user.name;
  document.getElementById('profile-phone').textContent = App.user.phone;
  document.getElementById('profile-coins-val').textContent = (App.user.coins || 0).toLocaleString('en-IN');
  document.getElementById('profile-ref-code').textContent = App.user.referral_code || '---';
  document.getElementById('profile-ref-count').textContent = App.user.ref_count || 0;
  document.getElementById('profile-ref-earned').textContent = App.user.ref_earned || 0;
  document.getElementById('profile-wins').textContent = App.user.wins || 0;
}

// Copy referral code
document.getElementById('btn-copy-ref')?.addEventListener('click', () => {
  const code = App.user?.referral_code;
  if (!code) return;
  const shareText = `GreenEarn pe join karo aur paao 50 coins! Mera referral code: ${code}\nApp download karo: https://akhtarsee.github.io/Green-Shop-/`;
  if (navigator.share) {
    navigator.share({ title: 'GreenEarn', text: shareText });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => showToast('Referral link copy ho gaya!', 'success'));
  }
});

// ============================================
// ADMIN PANEL
// ============================================

// 7-tap unlock
document.getElementById('admin-tap-zone').addEventListener('click', () => {
  App.adminTapCount++;
  clearTimeout(App.adminTapTimer);
  App.adminTapTimer = setTimeout(() => { App.adminTapCount = 0; }, 2000);
  if (App.adminTapCount >= 7) {
    App.adminTapCount = 0;
    openAdminLogin();
  }
});

function openAdminLogin() {
  document.getElementById('admin-login-screen').classList.add('active');
  document.getElementById('admin-user-input').value = '';
  document.getElementById('admin-pass-input').value = '';
}
function closeAdminLogin() {
  document.getElementById('admin-login-screen').classList.remove('active');
}
document.getElementById('btn-cancel-admin')?.addEventListener('click', closeAdminLogin);

document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('admin-user-input').value.trim();
  const password = document.getElementById('admin-pass-input').value.trim();
  if (verifyAdmin(username, password)) {
    closeAdminLogin();
    openAdminPanel();
  } else {
    showToast('Wrong credentials!', 'error');
  }
});

function openAdminPanel() {
  App.isAdmin = true;
  document.getElementById('admin-panel').classList.add('active');
  loadAdminPanel();
}
function closeAdminPanel() {
  App.isAdmin = false;
  document.getElementById('admin-panel').classList.remove('active');
}
document.getElementById('btn-close-admin')?.addEventListener('click', closeAdminPanel);

// Admin tabs
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    const sec = document.getElementById(`admin-sec-${tab.dataset.tab}`);
    if (sec) sec.classList.add('active');
    // Load section data
    if (tab.dataset.tab === 'products') loadAdminProducts();
    else if (tab.dataset.tab === 'orders') loadAdminOrders();
    else if (tab.dataset.tab === 'users') loadAdminUsers();
    else if (tab.dataset.tab === 'offers') loadAdminOffers();
    else if (tab.dataset.tab === 'stats') loadAdminStats();
  });
});

async function loadAdminPanel() {
  loadAdminStats();
}

// Add Product
document.getElementById('admin-add-product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const product = {
    name: document.getElementById('p-name').value.trim(),
    price: parseFloat(document.getElementById('p-price').value),
    unit: document.getElementById('p-unit').value.trim(),
    category: document.getElementById('p-category').value.trim(),
    emoji: document.getElementById('p-emoji').value.trim(),
    image_url: document.getElementById('p-img').value.trim() || null,
    is_fresh: document.getElementById('p-fresh').checked
  };
  if (!product.name || !product.price) { showToast('Name aur price daalo!', 'error'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Saving...';
  const result = await addProduct(product);
  if (result.success) {
    showToast('Product add ho gaya! ✅', 'success');
    e.target.reset();
    loadAdminProducts();
  } else {
    showToast('Error: ' + result.error, 'error');
  }
  btn.disabled = false; btn.textContent = 'Product Add Karo';
});

async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</td></tr>';
  const products = await getProducts();
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Koi product nahi</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.emoji || '🛍️'} ${escHtml(p.name)}</td>
      <td>₹${p.price}</td>
      <td>${escHtml(p.unit || '')}</td>
      <td>${escHtml(p.category || '')}</td>
      <td>
        <button class="btn-edit" onclick="editProduct('${p.id}','${escHtml(p.name)}',${p.price},'${escHtml(p.unit||'')}')">Edit</button>
        <button class="btn-del" onclick="deleteProductAdmin('${p.id}')">Del</button>
      </td>
    </tr>`).join('');
}

function editProduct(id, name, price, unit) {
  const newPrice = prompt(`${name} ka nayi price daalo (current: ₹${price}):`, price);
  if (newPrice === null) return;
  const parsed = parseFloat(newPrice);
  if (isNaN(parsed) || parsed <= 0) { showToast('Valid price daalo!', 'error'); return; }
  updateProduct(id, { price: parsed }).then(r => {
    if (r.success) {
      showToast('Price update ho gaya! ✅', 'success');
      loadAdminProducts();
      loadProducts(App.currentCategory);
    } else {
      showToast('Error: ' + r.error, 'error');
    }
  });
}

function deleteProductAdmin(id) {
  if (!confirm('Delete karna chahte ho?')) return;
  deleteProduct(id).then(r => {
    if (r.success) {
      showToast('Product delete ho gaya!', 'success');
      loadAdminProducts();
    } else {
      showToast('Error: ' + r.error, 'error');
    }
  });
}

async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</td></tr>';
  const orders = await getOrders(50);
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Koi order nahi</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const date = new Date(o.created_at).toLocaleDateString('en-IN');
    const statusColor = o.status === 'delivered' ? 'var(--accent-green)' : o.status === 'cancelled' ? 'var(--accent-red)' : 'var(--accent-gold)';
    return `<tr>
      <td style="font-family:monospace;font-size:10px">${o.id?.slice(0,8)}...</td>
      <td>${o.user_phone || '-'}</td>
      <td>₹${o.total}</td>
      <td style="color:${statusColor}">${o.status}</td>
      <td>${date}</td>
    </tr>`;
  }).join('');
}

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</td></tr>';
  const users = await getAllUsers(50);
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Koi user nahi</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${escHtml(u.name)}</td>
      <td>${u.phone}</td>
      <td style="color:var(--accent-gold)">${u.coins || 0} 🪙</td>
      <td>${u.ref_count || 0} refs</td>
    </tr>`).join('');
}

// Admin Offers
document.getElementById('admin-add-offer-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const offer = {
    title: document.getElementById('o-title').value.trim(),
    subtitle: document.getElementById('o-subtitle').value.trim(),
    badge: document.getElementById('o-badge').value.trim(),
    color: document.getElementById('o-color').value || '#00c896'
  };
  if (!offer.title) { showToast('Title daalo!', 'error'); return; }
  const result = await addOffer(offer);
  if (result.success) {
    showToast('Offer add ho gaya! ✅', 'success');
    e.target.reset();
    loadAdminOffers();
  } else {
    showToast('Error: ' + result.error, 'error');
  }
});

async function loadAdminOffers() {
  const list = document.getElementById('admin-offers-list');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">Loading...</div>';
  const offers = await getOffers();
  if (!offers.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">Koi offer nahi</div>';
    return;
  }
  list.innerHTML = offers.map(o => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:10px;margin-bottom:8px">
      <span style="font-size:20px">${o.badge || '🎁'}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${escHtml(o.title)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${escHtml(o.subtitle || '')}</div>
      </div>
      <button class="btn-del" onclick="deleteOfferAdmin('${o.id}')">Del</button>
    </div>`).join('');
}

function deleteOfferAdmin(id) {
  deleteOffer(id).then(r => {
    if (r.success) { showToast('Offer delete ho gaya!', 'success'); loadAdminOffers(); loadOffers(); }
  });
}

async function loadAdminStats() {
  const stats = await getAnalytics();
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('astat-users', stats.totalUsers);
  el('astat-orders', stats.totalOrders);
  el('astat-revenue', '₹' + (stats.totalRevenue || 0).toFixed(0));
  el('astat-coins-issued', (stats.coinsIssued || 0).toLocaleString('en-IN'));
  el('astat-coins-used', (stats.coinsUsed || 0).toLocaleString('en-IN'));
}

// ============================================
// UTILS
// ============================================
function updateCoinDisplay() {
  const coins = App.user?.coins || 0;
  document.querySelectorAll('.coin-display').forEach(el => {
    el.textContent = coins.toLocaleString('en-IN');
  });
}

// Toast
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.className = 'show ' + type;
  toastTimer = setTimeout(() => { t.className = ''; }, 3000);
}

// Modal
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.remove('active');
  });
});

// Product sync every 10 seconds
function startProductSync() {
  App.syncInterval = setInterval(async () => {
    if (App.currentPage === 'shop') {
      const fresh = await getProducts(App.currentCategory === 'All' ? '' : App.currentCategory);
      if (JSON.stringify(fresh) !== JSON.stringify(App.products)) {
        App.products = fresh;
        const grid = document.getElementById('products-grid');
        if (grid) grid.innerHTML = fresh.map(renderProductCard).join('');
      }
    }
    // Refresh offers on home
    if (App.currentPage === 'home') loadOffers();
  }, 10000);
}

// Product detail modal
function openProductDetail(productId) {
  const p = App.products.find(x => x.id === productId);
  if (!p) return;
  const cartItem = App.cart.find(c => c.id === productId);
  const qty = cartItem ? cartItem.qty : 0;

  document.getElementById('modal-product-content').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:72px;margin-bottom:8px">${p.emoji || '🛍️'}</div>
      ${p.is_fresh ? '<span class="fresh-tag" style="position:static;display:inline-block;margin-bottom:8px">Fresh</span>' : ''}
      <h2 style="font-size:20px;font-weight:700">${escHtml(p.name)}</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-top:4px">${escHtml(p.unit || '')}</p>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;margin-bottom:16px">
      <span style="font-size:13px;color:var(--text-secondary)">Price</span>
      <span style="font-size:22px;font-weight:800;color:var(--accent-green)">₹${p.price}</span>
    </div>
    ${qty > 0 ? `
      <div style="display:flex;justify-content:center;gap:16px;align-items:center;margin-bottom:12px">
        <button class="qty-btn" style="width:40px;height:40px;font-size:20px" onclick="changeQty('${p.id}',-1);updateProductModal('${p.id}')">−</button>
        <span style="font-size:20px;font-weight:800">${qty}</span>
        <button class="qty-btn" style="width:40px;height:40px;font-size:20px" onclick="changeQty('${p.id}',1);updateProductModal('${p.id}')">+</button>
      </div>
      <button class="btn-primary" onclick="closeModal('product-modal');loadPage('cart')">Cart Dekho →</button>
    ` : `
      <button class="btn-primary" onclick="addToCart('${p.id}');updateProductModal('${p.id}')">Cart Mein Dalo 🛒</button>
    `}`;
  openModal('product-modal');
}

function updateProductModal(productId) {
  openProductDetail(productId);
}

// Escape HTML
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Menu items
document.getElementById('menu-orders')?.addEventListener('click', async () => {
  if (!App.user) return;
  const orders = await getUserOrders(App.user.phone);
  let html = orders.length === 0
    ? '<div class="empty-state"><div class="empty-icon">📦</div><p>Koi order nahi abhi tak</p></div>'
    : orders.map(o => `
      <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:12px;color:var(--text-muted)">${new Date(o.created_at).toLocaleDateString('en-IN')}</span>
          <span style="font-size:12px;font-weight:700;color:${o.status === 'delivered' ? 'var(--accent-green)' : 'var(--accent-gold)'}">${o.status}</span>
        </div>
        <div style="font-size:15px;font-weight:700;margin-top:4px;color:var(--accent-green)">₹${o.total}</div>
        ${o.coins_used > 0 ? `<div style="font-size:11px;color:var(--accent-gold);margin-top:3px">🪙 ${o.coins_used} coins use kiye</div>` : ''}
      </div>`).join('');
  document.getElementById('orders-modal-content').innerHTML = html;
  openModal('orders-modal');
});

document.getElementById('menu-share')?.addEventListener('click', () => {
  const code = App.user?.referral_code;
  const text = `GreenEarn pe aao, grocery karo aur coins kamao! Mera code: ${code}\nhttps://akhtarsee.github.io/Green-Shop-/`;
  if (navigator.share) {
    navigator.share({ title: 'GreenEarn', text });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Share link copy ho gaya!', 'success'));
  }
});

document.getElementById('menu-logout')?.addEventListener('click', () => {
  if (confirm('Logout karna chahte ho?')) {
    localStorage.removeItem('ge_user_phone');
    location.reload();
  }
});