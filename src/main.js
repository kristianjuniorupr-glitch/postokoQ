// 1. Supabase & Local Fallback Initialization
let supabase = null;
let useLocalFallback = false;

// Seed Data for Offline/Mock Mode
const defaultProducts = [
  { id: 'p1', sku: 'SMN-TRD-50KG', name: 'Semen Portland Tiga Roda 50kg', category: 'Semen', base_unit: 'kg', purchase_price_base: 1100, selling_price_base: 1300, stock_base: 7100, min_stock_base: 1500 },
  { id: 'p2', sku: 'CAT-DLX-25L', name: 'Cat Tembok Dulux Pentalite Putih 2.5L', category: 'Cat', base_unit: 'pcs', purchase_price_base: 150000, selling_price_base: 185000, stock_base: 24, min_stock_base: 5 },
  { id: 'p3', sku: 'AL-PAL-16OZ', name: 'Palu Kambing Tekiro 16oz Gagang Karet', category: 'Alat Pertukangan', base_unit: 'pcs', purchase_price_base: 65000, selling_price_base: 85000, stock_base: 3, min_stock_base: 5 },
  { id: 'p4', sku: 'PP-PVC-AW-1/2', name: 'Pipa Rucika AW 1/2 Inch (Per Batang 4m)', category: 'Pipa', base_unit: 'pcs', purchase_price_base: 25000, selling_price_base: 32500, stock_base: 56, min_stock_base: 10 },
  { id: 'p5', sku: 'BJ-C75-0.75', name: 'Baja Ringan Kanal C75 Tebal 0.75mm Taso', category: 'Baja Ringan', base_unit: 'pcs', purchase_price_base: 80000, selling_price_base: 98000, stock_base: 210, min_stock_base: 20 }
];

const defaultConversions = [
  { id: 'c1', product_id: 'p1', unit_name: 'KG', multiplier: 1, selling_price: 1300 },
  { id: 'c2', product_id: 'p1', unit_name: 'SAK', multiplier: 50, selling_price: 65000 }
];

// Initialize LocalStorage if empty
if (!localStorage.getItem('materiq_creds_admin')) {
  localStorage.setItem('materiq_creds_admin', JSON.stringify({ username: 'admin', password: 'admin123' }));
}
if (!localStorage.getItem('materiq_creds_owner')) {
  localStorage.setItem('materiq_creds_owner', JSON.stringify({ username: 'owner', password: 'owner123' }));
}
if (!localStorage.getItem('materiq_products')) {
  localStorage.setItem('materiq_products', JSON.stringify(defaultProducts));
} else {
  try {
    let storedProds = JSON.parse(localStorage.getItem('materiq_products')) || [];
    let updated = false;
    storedProds.forEach(p => {
      if (p.category === 'Semen & Pasir') { p.category = 'Semen'; updated = true; }
      if (p.category === 'Cat & Pelapis') { p.category = 'Cat'; updated = true; }
      if (p.category === 'Pipa & Ledeng') { p.category = 'Pipa'; updated = true; }
    });
    if (updated) {
      localStorage.setItem('materiq_products', JSON.stringify(storedProds));
      console.log('Upgraded old product categories in LocalStorage');
    }
  } catch (e) {
    console.error('Failed to upgrade local storage categories:', e);
  }
}
if (!localStorage.getItem('materiq_conversions')) {
  localStorage.setItem('materiq_conversions', JSON.stringify(defaultConversions));
}
if (!localStorage.getItem('materiq_audit_logs')) {
  localStorage.setItem('materiq_audit_logs', JSON.stringify([]));
}
if (!localStorage.getItem('materiq_transactions')) {
  localStorage.setItem('materiq_transactions', JSON.stringify([]));
}
if (!localStorage.getItem('materiq_void_requests')) {
  localStorage.setItem('materiq_void_requests', JSON.stringify([]));
}if (!localStorage.getItem('materiq_banks')) {
  const defaultBanks = [
    { id: 'b1', name: 'BCA', details: 'Rek. 1234567890 a/n TokoQ' },
    { id: 'b2', name: 'BRI', details: 'Rek. 9876543210 a/n TokoQ' },
    { id: 'b3', name: 'DANA', details: 'No. 081234567890 a/n TokoQ' }
  ];
  localStorage.setItem('materiq_banks', JSON.stringify(defaultBanks));
}

// Fallback init using the active Supabase project credentials
const defaultUrl = 'https://vyqprvbimfcpkvhselkg.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5cXBydmJpbWZjcGt2aHNlbGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTU1MzAsImV4cCI6MjA5NTk3MTUzMH0.HLRHqLfQM4qML2uNXquVmmKX6S9uDz4s6O95iEh0VnE';

try {
  if (window.supabase) {
    supabase = window.supabase.createClient(defaultUrl, defaultAnonKey);
  } else {
    useLocalFallback = true;
  }
} catch (e) {
  console.error("Supabase client failed to initialize:", e);
  useLocalFallback = true;
}

// 2. Global State Management
let currentUserRole = null; // 'Admin' or 'Owner'
let products = [];
let conversions = [];
let cart = [];
let pendingCart = null;
let activeVoidRequest = null;
let voidSubscription = null;
let selectedCategoryId = 'all';
let paymentMethod = 'Cash'; // 'Cash', 'QRIS', 'Debit/Transfer'

// Cache elements
const loginBackdrop = document.getElementById('loginBackdrop');
const appRoot = document.getElementById('appRoot');
const viewTitle = document.getElementById('viewTitle');
const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchContainer = document.getElementById('globalSearchContainer');
const productGrid = document.getElementById('productGrid');
const cartRowsContainer = document.getElementById('cartRowsContainer');
const cartSubtotal = document.getElementById('cartSubtotal');
const cartTax = document.getElementById('cartTax');
const cartDiscountInput = document.getElementById('cartDiscountInput');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const pendingCountSpan = document.getElementById('pendingCount');

// Navigation links
const navSales = document.getElementById('navSales');
const navInventory = document.getElementById('navInventory');
const navReports = document.getElementById('navReports');
const navSettings = document.getElementById('navSettings');

// Sections
const sectionSales = document.getElementById('sectionSales');
const sectionInventory = document.getElementById('sectionInventory');
const sectionReports = document.getElementById('sectionReports');
const sectionSettings = document.getElementById('sectionSettings');

// Profile items
const userNameLabel = document.getElementById('userNameLabel');
const userRoleLabel = document.getElementById('userRoleLabel');
const userAvatarChar = document.getElementById('userAvatarChar');

// Modals & Forms
const paymentModalBackdrop = document.getElementById('paymentModalBackdrop');
const modalTotalBill = document.getElementById('modalTotalBill');
const cashReceivedInput = document.getElementById('cashReceivedInput');
const cashReceivedInputGroup = document.getElementById('cashReceivedInputGroup');
const cashChangeLabel = document.getElementById('cashChangeLabel');
const debtWarningText = document.getElementById('debtWarningText');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

const addProductModalBackdrop = document.getElementById('addProductModalBackdrop');
const addProductForm = document.getElementById('addProductForm');

const voidRequestModalBackdrop = document.getElementById('voidRequestModalBackdrop');
const voidRequestItemDetails = document.getElementById('voidRequestItemDetails');
const voidReasonInput = document.getElementById('voidReasonInput');
const sendVoidRequestBtn = document.getElementById('sendVoidRequestBtn');

// Settings Elements
const settingsAdminForm = document.getElementById('settingsAdminForm');
const settingsOwnerForm = document.getElementById('settingsOwnerForm');
const settingsAdminUsername = document.getElementById('settingsAdminUsername');
const settingsAdminPassword = document.getElementById('settingsAdminPassword');
const settingsOwnerUsername = document.getElementById('settingsOwnerUsername');
const settingsOwnerPassword = document.getElementById('settingsOwnerPassword');

// Settings Bank Elements
const addBankForm = document.getElementById('addBankForm');
const bankNameInput = document.getElementById('bankNameInput');
const bankDetailsInput = document.getElementById('bankDetailsInput');
const settingsBankTableBody = document.getElementById('settingsBankTableBody');

// Payment Bank Selection
const transferBankGroup = document.getElementById('transferBankGroup');
const paymentBankSelect = document.getElementById('paymentBankSelect');

// Dashboard elements
const dashboardOmzet = document.getElementById('dashboardOmzet');
const dashboardLaba = document.getElementById('dashboardLaba');
const dashboardTrxCount = document.getElementById('dashboardTrxCount');
const dashboardTrxAvg = document.getElementById('dashboardTrxAvg');
const restockPlannerContainer = document.getElementById('restockPlannerContainer');
const auditLogContainer = document.getElementById('auditLogContainer');
const voidApprovalArea = document.getElementById('voidApprovalArea');

// Toast notifier
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast show';
  
  let icon = 'info';
  if (type === 'success') {
    icon = 'check_circle';
    toast.style.borderColor = 'var(--success)';
    toast.style.color = 'var(--success-text)';
  } else if (type === 'error') {
    icon = 'error';
    toast.style.borderColor = 'var(--error)';
    toast.style.color = 'var(--error-text)';
  } else if (type === 'warning') {
    icon = 'warning';
    toast.style.borderColor = 'var(--warning)';
    toast.style.color = 'var(--warning-text)';
  }
  
  toast.innerHTML = `
    <span class="material-symbols-outlined">${icon}</span>
    <span>${message}</span>
  `;
  
  const container = document.getElementById('toastContainer');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 3. Setup Login Event Listeners
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  
  const adminCreds = JSON.parse(localStorage.getItem('materiq_creds_admin')) || { username: 'admin', password: 'admin123' };
  const ownerCreds = JSON.parse(localStorage.getItem('materiq_creds_owner')) || { username: 'owner', password: 'owner123' };

  if (username === adminCreds.username && password === adminCreds.password) {
    loginAs('Admin');
  } else if (username === ownerCreds.username && password === ownerCreds.password) {
    loginAs('Owner');
  } else {
    showToast('Username atau password salah!', 'error');
  }
});
document.getElementById('logoutBtn').addEventListener('click', logout);

async function loginAs(role) {
  currentUserRole = role;
  
  // Try to load Vite config variables at runtime
  if (window.location.protocol !== 'file:') {
    try {
      const module = await import('./config.js');
      const env = module.env || {};
      const url = env.VITE_SUPABASE_URL;
      const key = env.VITE_SUPABASE_ANON_KEY;
      if (url && key && window.supabase) {
        supabase = window.supabase.createClient(url, key);
        useLocalFallback = false;
        console.log("Supabase client initialized with Vite config variables.");
      }
    } catch (e) {
      console.log("Not running in Vite environment, using fallback Supabase client.");
    }
  }

  loginBackdrop.style.opacity = '0';
  loginBackdrop.style.pointerEvents = 'none';
  loginBackdrop.classList.remove('show');
  
  appRoot.classList.remove('hidden');
  
  userNameLabel.textContent = role === 'Admin' ? 'Kasir 1 (Admin)' : 'Owner Pemilik';
  userRoleLabel.textContent = `Role: ${role}`;
  userAvatarChar.textContent = role.charAt(0);
  
  // Set default active tab
  if (role === 'Admin') {
    switchTab('Sales');
    navSales.closest('li').classList.remove('hidden');
    navReports.closest('li').classList.add('hidden');
    navSettings.closest('li').classList.add('hidden');
  } else {
    switchTab('Reports');
    navSales.closest('li').classList.add('hidden');
    navReports.closest('li').classList.remove('hidden');
    navSettings.closest('li').classList.remove('hidden');
  }

  showToast(`Berhasil login sebagai ${role}`, 'success');
  if (useLocalFallback) {
    showToast('Offline Mode: Data disimpan di Browser (LocalStorage)', 'warning');
  }
  writeAuditLog(`Login Session`, `${role} logged into POS Terminal`);

  // Load database tables
  await Promise.all([loadProducts(), loadConversions(), loadAuditLogs()]);
  
  // Initialize Realtime Sync for void authorization
  initRealtimeVoid();
  
  if (role === 'Owner') {
    loadDashboardStats();
    loadVoidRequestsForOwner();
  }
}

function logout() {
  writeAuditLog(`Logout Session`, `${currentUserRole} logged out`);
  currentUserRole = null;
  appRoot.classList.add('hidden');
  loginBackdrop.style.opacity = '1';
  loginBackdrop.style.pointerEvents = 'auto';
  loginBackdrop.classList.add('show');
  cart = [];
  pendingCart = null;
  updateCartUI();
  
  if (voidSubscription) {
    voidSubscription.unsubscribe();
    voidSubscription = null;
  }
}

// Write Audit Log directly to DB or LocalStorage
async function writeAuditLog(action, details) {
  try {
    if (useLocalFallback) {
      const logs = JSON.parse(localStorage.getItem('materiq_audit_logs')) || [];
      logs.unshift({
        id: 'log-' + Math.random().toString(36).substr(2, 9),
        action,
        details,
        performed_by: currentUserRole || 'System',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('materiq_audit_logs', JSON.stringify(logs));
      if (currentUserRole === 'Owner') {
        loadAuditLogs();
      }
    } else {
      await supabase.from('audit_logs').insert([
        {
          action,
          details,
          performed_by: currentUserRole || 'System'
        }
      ]);
      if (currentUserRole === 'Owner') {
        loadAuditLogs();
      }
    }
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// 4. Tab Routing Management
navSales.addEventListener('click', (e) => { e.preventDefault(); switchTab('Sales'); });
navInventory.addEventListener('click', (e) => { e.preventDefault(); switchTab('Inventory'); });
navReports.addEventListener('click', (e) => { e.preventDefault(); switchTab('Reports'); });
navSettings.addEventListener('click', (e) => { e.preventDefault(); switchTab('Settings'); });

function switchTab(tab) {
  // Reset tabs style
  navSales.classList.remove('active');
  navInventory.classList.remove('active');
  navReports.classList.remove('active');
  navSettings.classList.remove('active');
  
  sectionSales.classList.add('hidden');
  sectionInventory.classList.add('hidden');
  sectionReports.classList.add('hidden');
  sectionSettings.classList.add('hidden');
  globalSearchContainer.classList.add('hidden');
  
  if (tab === 'Sales') {
    navSales.classList.add('active');
    sectionSales.classList.remove('hidden');
    globalSearchContainer.classList.remove('hidden');
    viewTitle.textContent = 'Layar Kasir (POS)';
    globalSearchInput.focus();
  } else if (tab === 'Inventory') {
    navInventory.classList.add('active');
    sectionInventory.classList.remove('hidden');
    viewTitle.textContent = 'Manajemen Inventaris Gudang';
    renderInventoryTable();
  } else if (tab === 'Reports') {
    navReports.classList.add('active');
    sectionReports.classList.remove('hidden');
    viewTitle.textContent = 'Owner Intelligence Dashboard';
    loadDashboardStats();
    loadVoidRequestsForOwner();
  } else if (tab === 'Settings') {
    navSettings.classList.add('active');
    sectionSettings.classList.remove('hidden');
    viewTitle.textContent = 'Pengaturan Kredensial';
    
    // Prefill forms
    const adminCreds = JSON.parse(localStorage.getItem('materiq_creds_admin')) || { username: 'admin', password: 'admin123' };
    const ownerCreds = JSON.parse(localStorage.getItem('materiq_creds_owner')) || { username: 'owner', password: 'owner123' };
    settingsAdminUsername.value = adminCreds.username;
    settingsAdminPassword.value = adminCreds.password;
    settingsOwnerUsername.value = ownerCreds.username;
    settingsOwnerPassword.value = ownerCreds.password;
    
    // Render banks list
    renderSettingsBanks();
  }
}

// 5. DB Fetch Operations
async function loadProducts() {
  if (useLocalFallback) {
    products = JSON.parse(localStorage.getItem('materiq_products')) || [];
    renderCatalog();
    renderInventoryTable();
    checkRestockPlan();
  } else {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
      if (error) throw error;
      products = data;
      renderCatalog();
      renderInventoryTable();
      checkRestockPlan();
    } catch (e) {
      console.warn("Supabase fetch failed. Switching to Local Fallback.");
      useLocalFallback = true;
      loadProducts();
    }
  }
}

async function loadConversions() {
  if (useLocalFallback) {
    conversions = JSON.parse(localStorage.getItem('materiq_conversions')) || [];
  } else {
    try {
      const { data, error } = await supabase.from('units_conversion').select('*');
      if (error) throw error;
      conversions = data;
    } catch (e) {
      console.warn("Supabase conversions fetch failed. Switching to Local Fallback.");
      useLocalFallback = true;
      loadConversions();
    }
  }
}

async function loadAuditLogs() {
  if (useLocalFallback) {
    const logs = JSON.parse(localStorage.getItem('materiq_audit_logs')) || [];
    renderAuditLogs(logs.slice(0, 10));
  } else {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      renderAuditLogs(data);
    } catch (e) {
      console.warn("Supabase logs fetch failed.");
    }
  }
}

// 6. UI Renderers
function renderCatalog() {
  productGrid.innerHTML = '';
  
  const query = globalSearchInput.value.toLowerCase().trim();
  
  const filtered = products.filter(p => {
    if (selectedCategoryId !== 'all' && p.category !== selectedCategoryId) return false;
    if (query && !p.name.toLowerCase().includes(query) && !p.sku.toLowerCase().includes(query)) return false;
    return true;
  });

  if (filtered.length === 0) {
    productGrid.innerHTML = `
      <div style="grid-column: span 12; text-align: center; padding: 48px; color: var(--text-muted);">
        Barang tidak ditemukan. Coba kata kunci lain.
      </div>
    `;
    return;
  }

  filtered.forEach(prod => {
    const isCritical = prod.stock_base <= prod.min_stock_base;
    const card = document.createElement('article');
    card.className = `product-card bento-card ${isCritical ? 'border-error' : ''}`;
    card.setAttribute('data-id', prod.id);
    
    let icon = 'architecture';
    if (prod.category.includes('Cat') || prod.category.includes('Pelapis')) icon = 'format_paint';
    if (prod.category.includes('Alat')) icon = 'carpenter';
    if (prod.category.includes('Pipa') || prod.category.includes('Ledeng')) icon = 'handyman';
    if (prod.category.includes('Baja')) icon = 'roofing';

    card.innerHTML = `
      <div class="product-card-image">
        <span class="material-symbols-outlined text-4xl" style="opacity: 0.5;">${icon}</span>
        <div class="brutal-badge ${isCritical ? 'error-badge' : 'success-badge'}" style="position: absolute; top: 8px; right: 8px; font-size: 9px;">
          ${prod.stock_base.toLocaleString('id-ID')} ${prod.base_unit}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; flex: 1;">
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">SKU: ${prod.sku}</span>
        <h3 style="font-weight: 700; font-size: 13px; line-height: 1.2; margin: 4px 0 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 32px;">
          ${prod.name}
        </h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
          <span class="font-mono" style="font-weight: 800; font-size: 14px;">Rp ${prod.selling_price_base.toLocaleString('id-ID')}</span>
          <button class="brutal-btn" style="padding: 4px 8px; font-size: 11px;" onclick="event.stopPropagation(); window.addToCart('${prod.id}')">
            Tambah
          </button>
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => addToCart(prod.id));
    productGrid.appendChild(card);
  });
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = '';
  
  const onlyCritical = document.getElementById('toggleCriticalStockBtn').classList.contains('primary-btn');
  const searchInput = document.getElementById('inventorySearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  let filtered = products;
  if (onlyCritical) {
    filtered = products.filter(p => p.stock_base <= p.min_stock_base);
  }
  
  if (query) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query));
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">Tidak ada inventaris yang cocok filter.</td>
      </tr>
    `;
    return;
  }

  filtered.forEach(p => {
    const isCritical = p.stock_base <= p.min_stock_base;
    
    const tr = document.createElement('tr');
    if (isCritical) {
      tr.style.backgroundColor = 'rgba(186, 26, 26, 0.15)';
    }

    tr.innerHTML = `
      <td class="font-mono">${p.sku}</td>
      <td>
        <span style="font-weight: 700;">${p.name}</span>
      </td>
      <td>${p.category}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 8px; height: 8px; border-radius: var(--radius-full); background-color: ${p.stock_base <= 0 ? 'var(--error)' : (isCritical ? 'var(--warning)' : 'var(--success)')};"></span>
          <span style="font-family: var(--font-mono); font-weight: 700;">${p.stock_base.toLocaleString('id-ID')}</span>
        </div>
      </td>
      <td class="font-mono">${p.min_stock_base} ${p.base_unit}</td>
      <td>
        <div style="font-size: 11px; color: var(--text-muted);">Beli: Rp ${p.purchase_price_base.toLocaleString('id-ID')}</div>
        <div class="font-mono" style="font-weight: 700;">Jual: Rp ${p.selling_price_base.toLocaleString('id-ID')}</div>
      </td>
      <td style="text-align: center;">
        <button class="brutal-btn error-btn" style="padding: 4px 8px; font-size: 10px;" onclick="window.deleteProduct('${p.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAuditLogs(logs) {
  auditLogContainer.innerHTML = '';
  if (logs.length === 0) {
    auditLogContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);">Belum ada log aktivitas.</div>`;
    return;
  }
  logs.forEach(log => {
    const time = new Date(log.created_at).toLocaleTimeString('id-ID');
    const div = document.createElement('div');
    div.style.padding = '8px';
    div.style.backgroundColor = 'var(--surface-low)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = 'var(--radius-sm)';
    div.style.fontSize = '12px';
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">
        <span>[${time}] &bull; ${log.performed_by}</span>
        <span style="font-weight: 800; text-transform: uppercase;">${log.action}</span>
      </div>
      <div>${log.details}</div>
    `;
    auditLogContainer.appendChild(div);
  });
}

// 7. Cart & Transactions Logic
window.addToCart = function(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;
  
  if (prod.stock_base <= 0) {
    showToast('Stok barang habis di gudang!', 'error');
    return;
  }

  const existing = cart.find(item => item.product_id === productId && item.unit_name === prod.base_unit);
  if (existing) {
    const nextQty = existing.quantity + 1;
    if (nextQty * existing.multiplier > prod.stock_base) {
      showToast('Stok tidak mencukupi!', 'warning');
      return;
    }
    existing.quantity = nextQty;
    existing.subtotal = existing.quantity * existing.unit_price;
  } else {
    cart.push({
      product_id: prod.id,
      sku: prod.sku,
      name: prod.name,
      unit_name: prod.base_unit,
      quantity: 1,
      multiplier: 1,
      unit_price: prod.selling_price_base,
      subtotal: prod.selling_price_base
    });
  }
  
  updateCartUI();
  showToast(`${prod.name} ditambahkan`, 'success');
};

function updateCartUI() {
  cartRowsContainer.innerHTML = '';
  
  if (cart.length === 0) {
    cartRowsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
        <span class="material-symbols-outlined" style="font-size: 40px; margin-bottom: 8px; display: block;">add_shopping_cart</span>
        Keranjang masih kosong.<br>Pilih produk atau ketik pencarian.
      </div>
    `;
    
    cartSubtotal.textContent = 'Rp 0';
    cartTax.textContent = 'Rp 0';
    cartTotal.textContent = 'Rp 0';
    checkoutBtn.disabled = true;
    return;
  }

  const table = document.createElement('table');
  table.className = 'brutal-table cart-table';
  table.style.fontSize = '12px';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Barang</th>
        <th style="text-align: center; width: 45px;">Satuan</th>
        <th style="text-align: center; width: 75px;">Qty</th>
        <th style="text-align: right; width: 85px;">Subtotal</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  let subtotalVal = 0;

  cart.forEach((item, idx) => {
    subtotalVal += item.subtotal;
    const prod = products.find(p => p.id === item.product_id);
    const cycleBtnHtml = `<span style="font-size: 11px; font-weight: 700;">${item.unit_name}</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight: 700;">${item.name}</div>
        <div style="font-size: 10px; color: var(--text-muted);">Rp ${item.unit_price.toLocaleString('id-ID')} / ${item.unit_name}</div>
      </td>
      <td style="text-align: center;">
        ${cycleBtnHtml}
      </td>
      <td style="text-align: center;">
        <div style="display: inline-flex; align-items: center; gap: 4px;">
          <button class="brutal-btn" style="padding: 2px 6px; font-size: 10px; font-weight: 800;" onclick="window.updateCartQty(${idx}, -1)">-</button>
          <span class="font-mono font-bold" style="width: 20px; display: inline-block;">${item.quantity}</span>
          <button class="brutal-btn" style="padding: 2px 6px; font-size: 10px; font-weight: 800;" onclick="window.updateCartQty(${idx}, 1)">+</button>
        </div>
      </td>
      <td style="text-align: right;" class="font-mono">
        <div style="font-weight: 700;">Rp ${item.subtotal.toLocaleString('id-ID')}</div>
        <button class="brutal-btn error-btn" style="padding: 2px 4px; font-size: 9px; margin-top: 4px;" onclick="window.requestItemVoid(${idx})">
          Void
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  cartRowsContainer.appendChild(table);

  const taxVal = Math.round(subtotalVal * 0.11);
  const discVal = Number(cartDiscountInput.value) || 0;
  const finalTotal = Math.max(0, subtotalVal + taxVal - discVal);

  cartSubtotal.textContent = `Rp ${subtotalVal.toLocaleString('id-ID')}`;
  cartTax.textContent = `Rp ${taxVal.toLocaleString('id-ID')}`;
  cartTotal.textContent = `Rp ${finalTotal.toLocaleString('id-ID')}`;
  checkoutBtn.disabled = false;
}

window.cycleUnit = function(itemIdx) {
  const item = cart[itemIdx];
  const prod = products.find(p => p.id === item.product_id);
  const prodConvs = conversions.filter(c => c.product_id === item.product_id);
  
  const unitsPool = [
    { name: prod.base_unit, multiplier: 1, price: prod.selling_price_base }
  ];
  prodConvs.forEach(c => {
    const price = c.selling_price || (prod.selling_price_base * c.multiplier);
    unitsPool.push({ name: c.unit_name, multiplier: c.multiplier, price });
  });

  const currentIdx = unitsPool.findIndex(u => u.name === item.unit_name);
  const nextIdx = (currentIdx + 1) % unitsPool.length;
  const nextUnit = unitsPool[nextIdx];

  if (item.quantity * nextUnit.multiplier > prod.stock_base) {
    showToast(`Stok tidak mencukupi untuk satuan ${nextUnit.name}!`, 'warning');
    return;
  }

  item.unit_name = nextUnit.name;
  item.multiplier = nextUnit.multiplier;
  item.unit_price = nextUnit.price;
  item.subtotal = item.quantity * item.unit_price;

  updateCartUI();
  showToast(`Satuan diubah ke ${item.unit_name}`, 'info');
};

window.updateCartQty = function(itemIdx, delta) {
  const item = cart[itemIdx];
  const prod = products.find(p => p.id === item.product_id);
  const newQty = item.quantity + delta;
  
  if (newQty <= 0) {
    window.requestItemVoid(itemIdx);
    return;
  }
  
  if (newQty * item.multiplier > prod.stock_base) {
    showToast('Stok tidak mencukupi!', 'warning');
    return;
  }

  item.quantity = newQty;
  item.subtotal = item.quantity * item.unit_price;
  updateCartUI();
};

// Void request popup
window.requestItemVoid = function(itemIdx) {
  const item = cart[itemIdx];
  
  if (currentUserRole === 'Owner') {
    cart.splice(itemIdx, 1);
    updateCartUI();
    showToast(`Item ${item.name} dihapus oleh Owner`, 'success');
    writeAuditLog(`Owner Bypass Void`, `Owner removed ${item.name} from cart`);
    return;
  }

  activeVoidRequest = {
    cartIndex: itemIdx,
    item: { ...item },
    token: 'VOID-' + Math.random().toString(36).substr(2, 9).toUpperCase()
  };

  voidRequestItemDetails.innerHTML = `
    <h4 style="font-weight: 700; font-size: 13px;">${item.name}</h4>
    <p style="font-size: 12px; margin-top: 4px;">Kuantitas: ${item.quantity} ${item.unit_name}</p>
    <p style="font-size: 12px;">Subtotal Tagihan: Rp ${item.subtotal.toLocaleString('id-ID')}</p>
    <p style="font-family: var(--font-mono); font-size: 11px; margin-top: 8px; font-weight: 800; text-align: center;">TOKEN: ${activeVoidRequest.token}</p>
  `;
  
  voidReasonInput.value = '';
  voidRequestModalBackdrop.classList.add('show');
};

document.getElementById('closeVoidRequestModalBtn').addEventListener('click', () => {
  voidRequestModalBackdrop.classList.remove('show');
  activeVoidRequest = null;
});

// Admin sends void request to Supabase DB or LocalStorage
document.getElementById('sendVoidRequestBtn').addEventListener('click', async () => {
  if (!activeVoidRequest) return;
  const reason = voidReasonInput.value.trim();
  if (!reason) {
    showToast('Alasan void wajib diisi!', 'warning');
    return;
  }

  try {
    if (useLocalFallback) {
      // Mock mode: Write to local requests and simulate owner approval in 3 seconds
      const reqs = JSON.parse(localStorage.getItem('materiq_void_requests')) || [];
      const newReq = {
        id: 'void-' + Math.random().toString(36).substr(2, 9),
        item_details: activeVoidRequest.item,
        requested_by: 'Kasir 1',
        reason,
        status: 'pending',
        token: activeVoidRequest.token,
        created_at: new Date().toISOString()
      };
      reqs.push(newReq);
      localStorage.setItem('materiq_void_requests', JSON.stringify(reqs));

      showToast(`[Local Mode] Menunggu persetujuan Owner otomatis dalam 3 detik...`, 'warning');
      writeAuditLog(`Void Requested`, `Admin requested void for ${activeVoidRequest.item.name}. Token: ${activeVoidRequest.token}`);
      voidRequestModalBackdrop.classList.remove('show');

      // Auto approve timer for offline testing
      setTimeout(() => {
        const currentReqs = JSON.parse(localStorage.getItem('materiq_void_requests')) || [];
        const match = currentReqs.find(r => r.token === activeVoidRequest.token);
        if (match && match.status === 'pending') {
          match.status = 'approved';
          match.resolved_at = new Date().toISOString();
          localStorage.setItem('materiq_void_requests', JSON.stringify(currentReqs));
          
          // Trigger approval workflow in UI
          if (cart.length > 0 && activeVoidRequest) {
            cart.splice(activeVoidRequest.cartIndex, 1);
            updateCartUI();
            showToast(`[Mock Sync] Void disetujui Owner secara otomatis!`, 'success');
            activeVoidRequest = null;
          }
        }
      }, 3000);

    } else {
      const { error } = await supabase.from('void_requests').insert([
        {
          item_details: activeVoidRequest.item,
          requested_by: 'Kasir 1',
          reason,
          status: 'pending',
          token: activeVoidRequest.token
        }
      ]);
      if (error) throw error;
      
      showToast(`Permintaan void terkirim. Menunggu persetujuan Owner...`, 'warning');
      writeAuditLog(`Void Requested`, `Admin requested void for ${activeVoidRequest.item.name}. Token: ${activeVoidRequest.token}`);
      voidRequestModalBackdrop.classList.remove('show');
    }
  } catch (err) {
    showToast('Gagal mengirimkan permintaan void', 'error');
    console.error(err);
  }
});

// Realtime Channel listener for Void Requests
function initRealtimeVoid() {
  if (useLocalFallback) return; // Local mode doesn't need pg subscriptions
  
  if (voidSubscription) voidSubscription.unsubscribe();

  voidSubscription = supabase
    .channel('void_channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'void_requests' }, payload => {
      const updatedReq = payload.new;
      
      if (activeVoidRequest && updatedReq.token === activeVoidRequest.token) {
        if (updatedReq.status === 'approved') {
          cart.splice(activeVoidRequest.cartIndex, 1);
          updateCartUI();
          showToast(`Void disetujui Owner secara Remote!`, 'success');
          voidRequestModalBackdrop.classList.remove('show');
          activeVoidRequest = null;
        } else if (updatedReq.status === 'rejected') {
          showToast(`Void ditolak oleh Owner!`, 'error');
          voidRequestModalBackdrop.classList.remove('show');
          activeVoidRequest = null;
        }
      }
      
      if (currentUserRole === 'Owner') {
        loadVoidRequestsForOwner();
        loadAuditLogs();
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'void_requests' }, payload => {
      if (currentUserRole === 'Owner') {
        loadVoidRequestsForOwner();
        showToast(`Kasir mengajukan Void Baru!`, 'warning');
      }
    })
    .subscribe();
}

// Owner void list loader
async function loadVoidRequestsForOwner() {
  let data = [];
  if (useLocalFallback) {
    const allReqs = JSON.parse(localStorage.getItem('materiq_void_requests')) || [];
    data = allReqs.filter(r => r.status === 'pending');
  } else {
    try {
      const { data: res, error } = await supabase
        .from('void_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      data = res;
    } catch (e) {
      console.error(e);
    }
  }

  voidApprovalArea.innerHTML = '';
  
  if (data.length === 0) {
    voidApprovalArea.innerHTML = `
      <div style="padding: 12px; background-color: var(--surface-low); border: var(--border-width) dashed var(--border-color); border-radius: var(--radius-md); text-align: center; color: var(--text-muted); font-size: 12px;">
        Tidak ada pengajuan void aktif dari kasir.
      </div>
    `;
    return;
  }

  data.forEach(req => {
    const item = req.item_details;
    const card = document.createElement('div');
    card.className = 'bento-card border-error';
    card.style.padding = '12px';
    card.style.marginBottom = '8px';
    card.style.backgroundColor = 'var(--error-bg)';
    card.style.color = 'var(--error-text)';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin-bottom: 6px;">
        <span>VOID REQ &bull; ${req.requested_by}</span>
        <span class="font-mono">${req.token}</span>
      </div>
      <div style="font-weight: 700; font-size: 13px;">${item.name}</div>
      <p style="font-size: 11px; margin-top: 2px;">Jumlah: ${item.quantity} ${item.unit_name} &bull; Nilai: Rp ${item.subtotal.toLocaleString('id-ID')}</p>
      <p style="font-size: 11px; margin-top: 4px; font-style: italic;">Alasan: "${req.reason}"</p>
      
      <div style="display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;">
        <button class="brutal-btn" style="padding: 4px 8px; font-size: 11px; font-weight: 800;" onclick="window.resolveVoid('${req.id || req.token}', 'rejected')">Tolak</button>
        <button class="brutal-btn success-btn" style="padding: 4px 8px; font-size: 11px; font-weight: 800;" onclick="window.resolveVoid('${req.id || req.token}', 'approved')">Approve (Setujui)</button>
      </div>
    `;
    voidApprovalArea.appendChild(card);
  });
}

window.resolveVoid = async function(reqIdOrToken, status) {
  try {
    if (useLocalFallback) {
      const allReqs = JSON.parse(localStorage.getItem('materiq_void_requests')) || [];
      const match = allReqs.find(r => r.id === reqIdOrToken || r.token === reqIdOrToken);
      if (match) {
        match.status = status;
        match.resolved_at = new Date().toISOString();
        localStorage.setItem('materiq_void_requests', JSON.stringify(allReqs));
      }
      showToast(`Void request ${status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}`, status === 'approved' ? 'success' : 'error');
      writeAuditLog(`Void Resolved`, `Owner resolved void token ${reqIdOrToken} to ${status}`);
      loadVoidRequestsForOwner();
    } else {
      const { error } = await supabase
        .from('void_requests')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', reqIdOrToken);
      if (error) throw error;
      showToast(`Void request ${status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}`, status === 'approved' ? 'success' : 'error');
      writeAuditLog(`Void Resolved`, `Owner marked request ${reqIdOrToken} as ${status}`);
      loadVoidRequestsForOwner();
    }
  } catch (err) {
    showToast('Gagal meresolusi void request', 'error');
    console.error(err);
  }
};

// 8. Pending Queue Caching
document.getElementById('savePendingBtn').addEventListener('click', () => {
  if (cart.length === 0) {
    showToast('Keranjang kosong, tidak bisa pending!', 'warning');
    return;
  }
  pendingCart = [...cart];
  cart = [];
  updateCartUI();
  pendingCountSpan.textContent = '1';
  showToast('Transaksi disimpan di antrean Pending', 'info');
  writeAuditLog('Pending Transaction Saved', 'Active cart cached to pending list');
});

document.getElementById('loadPendingBtn').addEventListener('click', () => {
  if (!pendingCart) {
    showToast('Tidak ada transaksi pending!', 'warning');
    return;
  }
  if (cart.length > 0) {
    showToast('Kosongkan keranjang saat ini terlebih dahulu!', 'warning');
    return;
  }
  cart = [...pendingCart];
  pendingCart = null;
  updateCartUI();
  pendingCountSpan.textContent = '0';
  showToast('Transaksi pending dikembalikan ke keranjang', 'success');
  writeAuditLog('Pending Transaction Restored', 'Pending cart loaded back to active session');
});

document.getElementById('emptyCartBtn').addEventListener('click', () => {
  if (cart.length === 0) return;
  
  if (currentUserRole === 'Owner') {
    cart = [];
    updateCartUI();
    showToast('Keranjang dikosongkan', 'info');
    return;
  }
  
  activeVoidRequest = {
    cartIndex: -1,
    item: { name: 'KOSONGKAN KERANJANG UTAMA', quantity: cart.length, unit_name: 'item', subtotal: cart.reduce((a,b)=>a+b.subtotal,0) },
    token: 'VOID-' + Math.random().toString(36).substr(2, 9).toUpperCase()
  };

  voidRequestItemDetails.innerHTML = `
    <h4 style="font-weight: 700; font-size: 13px;">Batalkan Seluruh Transaksi</h4>
    <p style="font-size: 12px; margin-top: 4px;">Jumlah Item: ${cart.length}</p>
    <p style="font-size: 12px;">Total Nilai: Rp ${activeVoidRequest.item.subtotal.toLocaleString('id-ID')}</p>
    <p style="font-family: var(--font-mono); font-size: 11px; margin-top: 8px; font-weight: 800; text-align: center;">TOKEN: ${activeVoidRequest.token}</p>
  `;
  
  voidReasonInput.value = '';
  voidRequestModalBackdrop.classList.add('show');
});

// 9. Payment Modal & Strict Cash Check
checkoutBtn.addEventListener('click', openCheckoutModal);
document.getElementById('cancelPaymentBtn').addEventListener('click', closeCheckoutModal);

function openCheckoutModal() {
  const subtotalVal = cart.reduce((a,b) => a + b.subtotal, 0);
  const taxVal = Math.round(subtotalVal * 0.11);
  const discVal = Number(cartDiscountInput.value) || 0;
  const finalTotal = Math.max(0, subtotalVal + taxVal - discVal);
  
  modalTotalBill.textContent = `Rp ${finalTotal.toLocaleString('id-ID')}`;
  modalTotalBill.dataset.bill = finalTotal;
  
  cashReceivedInput.value = '';
  cashChangeLabel.textContent = 'Rp 0';
  debtWarningText.style.display = 'none';
  confirmPaymentBtn.disabled = true;
  
  selectPaymentMethod('Cash');
  paymentModalBackdrop.classList.add('show');
  
  setTimeout(() => cashReceivedInput.focus(), 150);
}

function closeCheckoutModal() {
  paymentModalBackdrop.classList.remove('show');
}

document.getElementById('payMethodCash').addEventListener('click', () => selectPaymentMethod('Cash'));
document.getElementById('payMethodQris').addEventListener('click', () => selectPaymentMethod('QRIS'));
document.getElementById('payMethodDebit').addEventListener('click', () => selectPaymentMethod('Debit/Transfer'));

function populateBankSelect() {
  const banks = JSON.parse(localStorage.getItem('materiq_banks')) || [];
  if (!paymentBankSelect) return;
  paymentBankSelect.innerHTML = '';
  
  if (banks.length === 0) {
    paymentBankSelect.innerHTML = '<option value="">-- Tidak Ada Bank Terdaftar --</option>';
    return;
  }
  
  banks.forEach(bank => {
    const opt = document.createElement('option');
    opt.value = bank.name;
    opt.textContent = `${bank.name} - ${bank.details}`;
    paymentBankSelect.appendChild(opt);
  });
}

function selectPaymentMethod(method) {
  paymentMethod = method;
  document.getElementById('payMethodCash').className = 'brutal-btn';
  document.getElementById('payMethodQris').className = 'brutal-btn';
  document.getElementById('payMethodDebit').className = 'brutal-btn';
  
  const finalBill = Number(modalTotalBill.dataset.bill);
  
  if (method === 'Cash') {
    document.getElementById('payMethodCash').classList.add('primary-btn');
    cashReceivedInputGroup.style.display = 'block';
    if (transferBankGroup) {
      transferBankGroup.style.display = 'none';
      transferBankGroup.classList.add('hidden');
    }
    validatePayment();
  } else if (method === 'Debit/Transfer') {
    document.getElementById('payMethodDebit').classList.add('primary-btn');
    cashReceivedInputGroup.style.display = 'none';
    if (transferBankGroup) {
      transferBankGroup.style.display = 'block';
      transferBankGroup.classList.remove('hidden');
      populateBankSelect();
    }
    cashReceivedInput.value = finalBill;
    cashChangeLabel.textContent = 'Rp 0';
    debtWarningText.style.display = 'none';
    confirmPaymentBtn.disabled = false;
  } else {
    // QRIS
    document.getElementById('payMethodQris').classList.add('primary-btn');
    cashReceivedInputGroup.style.display = 'none';
    if (transferBankGroup) {
      transferBankGroup.style.display = 'none';
      transferBankGroup.classList.add('hidden');
    }
    cashReceivedInput.value = finalBill;
    cashChangeLabel.textContent = 'Rp 0';
    debtWarningText.style.display = 'none';
    confirmPaymentBtn.disabled = false;
  }
}

cashReceivedInput.addEventListener('input', validatePayment);

function validatePayment() {
  if (paymentMethod !== 'Cash') return;
  
  const finalBill = Number(modalTotalBill.dataset.bill);
  const paid = Number(cashReceivedInput.value) || 0;
  
  if (paid < finalBill) {
    debtWarningText.style.display = 'block';
    confirmPaymentBtn.disabled = true;
    cashChangeLabel.textContent = 'Rp 0';
  } else {
    debtWarningText.style.display = 'none';
    confirmPaymentBtn.disabled = false;
    const change = paid - finalBill;
    cashChangeLabel.textContent = `Rp ${change.toLocaleString('id-ID')}`;
  }
}

// Complete checkout transaction
document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
  const finalBill = Number(modalTotalBill.dataset.bill);
  const paid = Number(cashReceivedInput.value);
  const change = Math.max(0, paid - finalBill);
  const invoiceNo = 'INV-' + new Date().toISOString().slice(2,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);
  
  try {
    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.textContent = 'Menyimpan...';

    if (useLocalFallback) {
      // 1. Save locally
      const txs = JSON.parse(localStorage.getItem('materiq_transactions')) || [];
      const newTrx = {
        id: 'trx-' + Math.random().toString(36).substr(2, 9),
        invoice_no: invoiceNo,
        admin_id: currentUserRole === 'Admin' ? 'Kasir 1' : 'Owner',
        customer_name: 'Pelanggan Umum (Walk-in)',
        total_price: cart.reduce((a,b)=>a+b.subtotal,0),
        tax: Math.round(cart.reduce((a,b)=>a+b.subtotal,0) * 0.11),
        discount: Number(cartDiscountInput.value) || 0,
        final_price: finalBill,
        payment_method: paymentMethod === 'Debit/Transfer' ? `Transfer (${document.getElementById('paymentBankSelect').value})` : paymentMethod,
        amount_paid: paid,
        change_given: change,
        status: 'completed',
        created_at: new Date().toISOString()
      };
      txs.push(newTrx);
      localStorage.setItem('materiq_transactions', JSON.stringify(txs));

      // 2. Update local products stock
      const localProds = JSON.parse(localStorage.getItem('materiq_products')) || [];
      cart.forEach(item => {
        const prod = localProds.find(p => p.id === item.product_id);
        if (prod) {
          prod.stock_base = prod.stock_base - (item.quantity * item.multiplier);
        }
      });
      localStorage.setItem('materiq_products', JSON.stringify(localProds));

      showToast(`Transaksi ${invoiceNo} berhasil (Offline Mode)`, 'success');
      writeAuditLog(`Transaction Completed`, `Completed sale ${invoiceNo} for Rp ${finalBill.toLocaleString('id-ID')}`);
      
      cart = [];
      cartDiscountInput.value = '';
      updateCartUI();
      closeCheckoutModal();
      await loadProducts();

    } else {
      const { data: newTrx, error: trxError } = await supabase.from('transactions').insert([
        {
          invoice_no: invoiceNo,
          admin_id: currentUserRole === 'Admin' ? 'Kasir 1' : 'Owner',
          customer_name: 'Pelanggan Umum (Walk-in)',
          total_price: cart.reduce((a,b)=>a+b.subtotal,0),
          tax: Math.round(cart.reduce((a,b)=>a+b.subtotal,0) * 0.11),
          discount: Number(cartDiscountInput.value) || 0,
          final_price: finalBill,
          payment_method: paymentMethod === 'Debit/Transfer' ? `Transfer (${document.getElementById('paymentBankSelect').value})` : paymentMethod,
          amount_paid: paid,
          change_given: change,
          status: 'completed'
        }
      ]).select().single();

      if (trxError) throw trxError;

      for (const item of cart) {
        const { error: itemError } = await supabase.from('transaction_items').insert([
          {
            transaction_id: newTrx.id,
            product_id: item.product_id,
            unit_name: item.unit_name,
            quantity: item.quantity,
            multiplier: item.multiplier,
            unit_price: item.unit_price,
            subtotal: item.subtotal
          }
        ]);
        if (itemError) throw itemError;

        const prod = products.find(p => p.id === item.product_id);
        const newStockBase = prod.stock_base - (item.quantity * item.multiplier);
        
        const { error: stockError } = await supabase.from('products')
          .update({ stock_base: newStockBase })
          .eq('id', item.product_id);
        if (stockError) throw stockError;
      }

      showToast(`Transaksi ${invoiceNo} diselesaikan!`, 'success');
      writeAuditLog(`Transaction Completed`, `Completed sale ${invoiceNo} for Rp ${finalBill.toLocaleString('id-ID')}`);
      
      cart = [];
      cartDiscountInput.value = '';
      updateCartUI();
      closeCheckoutModal();
      await loadProducts();
    }

  } catch (err) {
    showToast('Transaksi gagal disimpan', 'error');
    console.error(err);
  } finally {
    confirmPaymentBtn.disabled = false;
    confirmPaymentBtn.textContent = 'Cetak Struk & Selesaikan';
  }
});

// Keyboard shortcuts disabled for mouse-only operation

globalSearchInput.addEventListener('input', () => {
  renderCatalog();
});

const invSearch = document.getElementById('inventorySearchInput');
if (invSearch) {
  invSearch.addEventListener('input', () => {
    renderInventoryTable();
  });
}

// Category filter chip clicks
document.querySelectorAll('#categoryFilterRow button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#categoryFilterRow button').forEach(b => b.className = 'brutal-btn');
    e.target.className = 'brutal-btn primary-btn';
    selectedCategoryId = e.target.dataset.category;
    renderCatalog();
  });
});

document.getElementById('toggleCriticalStockBtn').addEventListener('click', (e) => {
  e.target.classList.toggle('primary-btn');
  renderInventoryTable();
});

// 10. CRUD Product Management
const openAddProductModalBtn = document.getElementById('openAddProductModalBtn');
if (openAddProductModalBtn) {
  openAddProductModalBtn.addEventListener('click', () => {
    addProductModalBackdrop.classList.add('show');
  });
}
const closeAddProductModalBtn = document.getElementById('closeAddProductModalBtn');
if (closeAddProductModalBtn) {
  closeAddProductModalBtn.addEventListener('click', () => {
    addProductModalBackdrop.classList.remove('show');
  });
}

addProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const sku = document.getElementById('prodSku').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const category = document.getElementById('prodCategory').value;
  const baseUnit = document.getElementById('prodBaseUnit').value.toLowerCase();
  const stock = Number(document.getElementById('prodStock').value);
  const minStock = Number(document.getElementById('prodMinStock').value);
  const purchase = Number(document.getElementById('prodPurchasePrice').value);
  const selling = Number(document.getElementById('prodSellingPrice').value);

  try {
    if (useLocalFallback) {
      const localProds = JSON.parse(localStorage.getItem('materiq_products')) || [];
      
      if (localProds.find(p => p.sku === sku)) {
        showToast('SKU sudah terdaftar!', 'error');
        return;
      }

      const newId = 'p-' + Math.random().toString(36).substr(2, 9);
      const newProdObj = {
        id: newId, sku, name, category, base_unit: baseUnit,
        purchase_price_base: purchase, selling_price_base: selling,
        stock_base: stock, min_stock_base: minStock
      };
      localProds.push(newProdObj);
      localStorage.setItem('materiq_products', JSON.stringify(localProds));

      const localConvs = JSON.parse(localStorage.getItem('materiq_conversions')) || [];
      localConvs.push({ id: 'c-' + Math.random().toString(36).substr(2, 9), product_id: newId, unit_name: baseUnit.toUpperCase(), multiplier: 1, selling_price: selling });
      
      localStorage.setItem('materiq_conversions', JSON.stringify(localConvs));

      showToast('Produk baru berhasil disimpan ke database lokal!', 'success');
      writeAuditLog('Product Added', `Added new product ${name} (SKU: ${sku})`);
      
      addProductForm.reset();
      addProductModalBackdrop.classList.remove('show');
      await loadProducts();
      await loadConversions();

    } else {
      const { data: newProd, error: prodErr } = await supabase.from('products').insert([
        {
          sku, name, category, base_unit: baseUnit,
          purchase_price_base: purchase, selling_price_base: selling,
          stock_base: stock, min_stock_base: minStock
        }
      ]).select().single();

      if (prodErr) throw prodErr;

      await supabase.from('units_conversion').insert([
        { product_id: newProd.id, unit_name: baseUnit.toUpperCase(), multiplier: 1, selling_price: selling }
      ]);

      showToast('Produk baru berhasil disimpan ke Supabase!', 'success');
      writeAuditLog('Product Added', `Added new master product ${name} (SKU: ${sku})`);
      
      addProductForm.reset();
      addProductModalBackdrop.classList.remove('show');
      await loadProducts();
      await loadConversions();
    }
  } catch (err) {
    showToast('Gagal menambahkan produk', 'error');
    console.error(err);
  }
});

window.deleteProduct = async function(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
  
  try {
    const prod = products.find(p => p.id === id);
    if (useLocalFallback) {
      const localProds = JSON.parse(localStorage.getItem('materiq_products')) || [];
      const updated = localProds.filter(p => p.id !== id);
      localStorage.setItem('materiq_products', JSON.stringify(updated));
      
      showToast('Produk berhasil dihapus.', 'info');
      writeAuditLog('Product Deleted', `Deleted product ${prod?.name} (ID: ${id})`);
      await loadProducts();
    } else {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      
      showToast('Produk berhasil dihapus.', 'info');
      writeAuditLog('Product Deleted', `Deleted master product ${prod?.name} (ID: ${id})`);
      await loadProducts();
    }
  } catch (err) {
    showToast('Gagal menghapus produk.', 'error');
    console.error(err);
  }
};

// 11. Owner Dashboard Calculations & Restock Planner
async function loadDashboardStats() {
  try {
    let txs = [];
    
    if (useLocalFallback) {
      txs = JSON.parse(localStorage.getItem('materiq_transactions')) || [];
    } else {
      const { data, error } = await supabase.from('transactions').select('*');
      if (error) throw error;
      txs = data;
    }
    
    // Omzet sum
    const totalOmzet = txs.reduce((sum, tx) => sum + Number(tx.final_price), 0);
    
    // For Offline/Local Mode, HPP is estimated as 80% of final_price for simplicity if transaction_items is not fully sync'd locally, 
    // or we can calculate it precisely if we want. Let's do a mock HPP calculation (80% cost) as a highly reliable fallback, 
    // or precise calculation if we use Supabase.
    let totalHpp = 0;
    if (useLocalFallback) {
      totalHpp = txs.reduce((sum, tx) => sum + Math.round(Number(tx.final_price) * 0.8), 0);
    } else {
      const { data: items, error: itemsError } = await supabase
        .from('transaction_items')
        .select('*, products(purchase_price_base)');
      if (!itemsError && items) {
        items.forEach(item => {
          const purchasePrice = item.products?.purchase_price_base || 0;
          totalHpp += purchasePrice * item.quantity * item.multiplier;
        });
      } else {
        totalHpp = totalOmzet * 0.8;
      }
    }

    const netProfit = totalOmzet - totalHpp;
    const trxCount = txs.length;
    const trxAvg = trxCount > 0 ? Math.round(totalOmzet / trxCount) : 0;

    dashboardOmzet.textContent = `Rp ${totalOmzet.toLocaleString('id-ID')}`;
    dashboardLaba.textContent = `Rp ${netProfit.toLocaleString('id-ID')}`;
    dashboardTrxCount.textContent = trxCount.toLocaleString('id-ID');
    dashboardTrxAvg.textContent = `Rata-rata: Rp ${trxAvg.toLocaleString('id-ID')} / Trx`;

  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

function checkRestockPlan() {
  restockPlannerContainer.innerHTML = '';
  
  const lowStockProducts = products.filter(p => p.stock_base <= p.min_stock_base);
  
  if (lowStockProducts.length === 0) {
    restockPlannerContainer.innerHTML = `
      <div style="text-align: center; padding: 32px; color: var(--text-muted);">
        Seluruh stok barang aman. Tidak ada saran restock saat ini.
      </div>
    `;
    return;
  }

  lowStockProducts.forEach(p => {
    const recQty = Math.max(50, p.min_stock_base * 5);
    
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '10px';
    row.style.backgroundColor = 'var(--surface-low)';
    row.style.border = '1px solid var(--border-color)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.fontSize = '12px';

    const textPo = `Halo Supplier, kami ingin memesan restock untuk barang berikut:\n- Nama: ${p.name}\n- SKU: ${p.sku}\n- Jumlah: ${recQty} ${p.base_unit}\nTerima kasih.`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textPo)}`;

    row.innerHTML = `
      <div>
        <div style="font-weight: 700; color: var(--error-text);">${p.name}</div>
        <div style="font-size: 11px; color: var(--text-muted);">Sisa: ${p.stock_base} ${p.base_unit} &bull; Batas: ${p.min_stock_base} ${p.base_unit}</div>
        <div style="font-size: 10px; color: var(--secondary-bg); font-weight: bold; margin-top: 4px;">Saran Pesan: ${recQty} ${p.base_unit}</div>
      </div>
      <a class="brutal-btn success-btn" href="${waUrl}" target="_blank" style="padding: 6px 12px; font-size: 11px; text-decoration: none;">
        Buat PO (WA)
      </a>
    `;
    restockPlannerContainer.appendChild(row);
  });
}

// Theme toggle
document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nextTheme);
  
  const icon = document.querySelector('#themeToggleBtn span');
  icon.textContent = nextTheme === 'dark' ? 'light_mode' : 'dark_mode';
  
  showToast(`Beralih ke Mode ${nextTheme === 'dark' ? 'Gelap' : 'Terang'}`, 'info');
});

// 10. Settings Form Event Listeners (Owner Only)
settingsAdminForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = settingsAdminUsername.value.trim();
  const password = settingsAdminPassword.value.trim();
  if (!username || !password) {
    showToast('Username dan Password Admin tidak boleh kosong!', 'warning');
    return;
  }
  localStorage.setItem('materiq_creds_admin', JSON.stringify({ username, password }));
  showToast('Kredensial Admin berhasil diperbarui!', 'success');
  writeAuditLog('Credentials Updated', 'Owner updated credentials for Admin role');
});

settingsOwnerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = settingsOwnerUsername.value.trim();
  const password = settingsOwnerPassword.value.trim();
  if (!username || !password) {
    showToast('Username dan Password Owner tidak boleh kosong!', 'warning');
    return;
  }
  localStorage.setItem('materiq_creds_owner', JSON.stringify({ username, password }));
  showToast('Kredensial Owner berhasil diperbarui!', 'success');
  writeAuditLog('Credentials Updated', 'Owner updated credentials for Owner role');
});

// 11. Settings Bank CRUD Functions & Event Listeners (Owner Only)
function renderSettingsBanks() {
  const banks = JSON.parse(localStorage.getItem('materiq_banks')) || [];
  if (!settingsBankTableBody) return;
  settingsBankTableBody.innerHTML = '';
  
  if (banks.length === 0) {
    settingsBankTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada rekening bank terdaftar.</td>
      </tr>
    `;
    return;
  }
  
  banks.forEach(bank => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700;">${bank.name}</td>
      <td>${bank.details}</td>
      <td style="text-align: center;">
        <button class="brutal-btn error-btn" style="padding: 4px 8px; font-size: 10px;" onclick="window.deleteBank('${bank.id}')">Hapus</button>
      </td>
    `;
    settingsBankTableBody.appendChild(tr);
  });
}

if (addBankForm) {
  addBankForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = bankNameInput.value.trim().toUpperCase();
    const details = bankDetailsInput.value.trim();
    
    if (!name || !details) return;
    
    const banks = JSON.parse(localStorage.getItem('materiq_banks')) || [];
    
    if (banks.find(b => b.name === name)) {
      showToast(`Bank ${name} sudah terdaftar!`, 'error');
      return;
    }
    
    const newBank = {
      id: 'b-' + Math.random().toString(36).substr(2, 9),
      name,
      details
    };
    
    banks.push(newBank);
    localStorage.setItem('materiq_banks', JSON.stringify(banks));
    
    showToast(`Bank ${name} berhasil ditambahkan!`, 'success');
    writeAuditLog('Bank Added', `Owner added transfer bank account ${name}`);
    
    addBankForm.reset();
    renderSettingsBanks();
    populateBankSelect();
  });
}

window.deleteBank = function(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus bank/rekening ini?')) return;
  
  const banks = JSON.parse(localStorage.getItem('materiq_banks')) || [];
  const bank = banks.find(b => b.id === id);
  const updated = banks.filter(b => b.id !== id);
  localStorage.setItem('materiq_banks', JSON.stringify(updated));
  
  showToast(`Bank ${bank?.name || ''} berhasil dihapus.`, 'info');
  writeAuditLog('Bank Deleted', `Owner deleted transfer bank account ${bank?.name || ''}`);
  
  renderSettingsBanks();
  populateBankSelect();
};
