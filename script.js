// State Management
let state = {
    currentUser: null,
    inventory: [],
    movements: [],
    purchases: [],
    expenses: [],
    suppliers: [],
    warehouse3d: [],
    invoices: [],
    currentOrder: [],
    windows: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupAuth();
    setupWindowEvents();
    restoreWindows();
});

function loadState() {
    const saved = localStorage.getItem('pacioli_state');
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
    }
}

function saveState() {
    localStorage.setItem('pacioli_state', JSON.stringify(state));
}

// --- AUTHENTICATION ---
const USERS = { 'KAUE': 'kaue123', 'PEDRO': 'pedro123' };

function setupAuth() {
    document.getElementById('btnLogin').onclick = () => {
        const user = document.getElementById('username').value.toUpperCase();
        const pass = document.getElementById('password').value;
        if (USERS[user] && USERS[user] === pass) login(user);
        else document.getElementById('loginError').classList.remove('hidden');
    };
    document.getElementById('btnLogoutMenu').onclick = () => {
        state.currentUser = null; saveState(); location.reload();
    };
    if (state.currentUser) login(state.currentUser);
}

function login(user) {
    state.currentUser = user;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('desktop').classList.remove('hidden');
    document.getElementById('currentUser').innerText = user;
    saveState();
    restoreWindows();
}

function toggleStartMenu() {
    document.getElementById('startMenu').classList.toggle('hidden');
}

// --- WINDOW MANAGER ---
let zIndexCounter = 100;
function openWindow(id) {
    if (document.getElementById(id)) { focusWindow(id); return; }
    const template = document.getElementById(`tpl-${id}`);
    const win = document.createElement('div');
    win.id = id; win.className = 'window'; win.style.zIndex = ++zIndexCounter;
    const winState = state.windows[id] || { x: 50, y: 50 };
    win.style.left = winState.x + 'px'; win.style.top = winState.y + 'px';
    win.innerHTML = `
        <div class="win-header" onmousedown="startDrag(event, '${id}')">
            <span>${template.getAttribute('title')}</span>
            <div class="win-controls"><button onclick="closeWindow('${id}')">X</button></div>
        </div>
        <div class="win-content">${template.innerHTML}</div>
    `;
    document.getElementById('windowContainer').appendChild(win);
    state.windows[id] = { ...winState, open: true, z: zIndexCounter };
    saveState();
    if (id === 'win3D') init3DCalc();
    if (id === 'winDTF') calculateDTF();
    renderModule(id);
}

function closeWindow(id) {
    const win = document.getElementById(id);
    if (win) { win.remove(); state.windows[id].open = false; saveState(); }
}

function focusWindow(id) {
    const win = document.getElementById(id);
    if (win) { win.style.zIndex = ++zIndexCounter; state.windows[id].z = zIndexCounter; saveState(); }
}

function restoreWindows() {
    for (const id in state.windows) if (state.windows[id].open) openWindow(id);
}

let activeWin = null; let offset = { x: 0, y: 0 };
function startDrag(e, id) {
    activeWin = document.getElementById(id); focusWindow(id);
    const rect = activeWin.getBoundingClientRect();
    offset.x = e.clientX - rect.left; offset.y = e.clientY - rect.top;
    document.addEventListener('mousemove', drag); document.addEventListener('mouseup', stopDrag);
}
function drag(e) {
    if (!activeWin) return;
    const x = e.clientX - offset.x; const y = e.clientY - offset.y;
    activeWin.style.left = x + 'px'; activeWin.style.top = y + 'px';
    state.windows[activeWin.id].x = x; state.windows[activeWin.id].y = y;
}
function stopDrag() { activeWin = null; document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', stopDrag); saveState(); }

function setupWindowEvents() {
    document.addEventListener('input', (e) => {
        if (e.target.id.startsWith('c3d-')) calculate3D();
        if (e.target.id.startsWith('cdtf-')) calculateDTF();
    });
}

// --- MODULES ---
let c3dChart = null;
function init3DCalc() { calculate3D(); }
function calculate3D() {
    const consumption = parseFloat(document.getElementById('c3d-consumption').value) || 0;
    const machinePrice = parseFloat(document.getElementById('c3d-machinePrice').value) || 0;
    const lifespan = parseFloat(document.getElementById('c3d-lifespan').value) || 1;
    const filamentPrice = parseFloat(document.getElementById('c3d-filamentPrice').value) || 0;
    const kwhPrice = parseFloat(document.getElementById('c3d-kwhPrice').value) || 0;
    const hours = parseFloat(document.getElementById('c3d-hours').value) || 0;
    const minutes = parseFloat(document.getElementById('c3d-minutes').value) || 0;
    const grams = parseFloat(document.getElementById('c3d-grams').value) || 0;
    const extra = parseFloat(document.getElementById('c3d-extra').value) || 0;
    const fail = parseFloat(document.getElementById('c3d-fail').value) || 0;
    const mult = parseFloat(document.getElementById('c3d-mult').value) || 1;
    const totalTime = hours + (minutes / 60);
    const cost = ((filamentPrice / 1000) * grams + (consumption / 1000) * totalTime * kwhPrice + (machinePrice / lifespan) * totalTime + extra) * (1 + fail / 100);
    const sale = cost * mult;
    const resCostEl = document.getElementById('c3d-res-cost');
    const resPriceEl = document.getElementById('c3d-res-price');
    if (resCostEl) resCostEl.innerText = cost.toFixed(2);
    if (resPriceEl) resPriceEl.innerText = sale.toFixed(2);
    update3DChart(grams, totalTime, mult, filamentPrice, consumption, kwhPrice, machinePrice, lifespan, extra, fail);
}
function update3DChart(baseGrams, baseHours, mult, filP, cons, kwhP, mP, life, extra, fail) {
    const ctxEl = document.getElementById('c3d-chart'); if (!ctxEl) return;
    const labels = []; const prices = [];
    for (let i = 5; i <= 15; i++) {
        const factor = i / 10; const g = baseGrams * factor; labels.push(g.toFixed(0) + 'g');
        const cost = ((filP/1000)*g + (cons/1000)*baseHours*kwhP + (mP/life)*baseHours + extra) * (1 + fail/100);
        prices.push((cost * mult).toFixed(2));
    }
    if (c3dChart) c3dChart.destroy();
    c3dChart = new Chart(ctxEl.getContext('2d'), { type: 'line', data: { labels, datasets: [{ label: 'Venta $', data: prices, borderColor: '#3498db' }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
}

function calculateDTF() {
    const orderInput = document.getElementById('cdtf-order');
    if (!orderInput) return;
    const pedido = parseInt(orderInput.value) || 0;
    const stock = parseInt(document.getElementById('cdtf-stock').value) || 0;
    const pPack5 = parseFloat(document.getElementById('cdtf-pack5').value) || 0;
    const pSingle = parseFloat(document.getElementById('cdtf-single').value) || 0;
    const pDtf = parseFloat(document.getElementById('cdtf-dtfPrice').value) || 0;
    const dPerDtf = parseInt(document.getElementById('cdtf-drawPerDtf').value) || 1;
    const pVenta = parseFloat(document.getElementById('cdtf-sellPrice').value) || 0;
    let faltantes = Math.max(0, pedido - stock);
    let costA = Math.ceil(faltantes / 5) * pPack5;
    let costB = (Math.floor(faltantes / 5) * pPack5) + ((faltantes % 5) * pSingle);
    let costC = faltantes * pSingle;
    let bestCost = Math.min(costA, costB, costC);
    let dtfNec = Math.ceil(pedido / dPerDtf);
    let costTotal = bestCost + (dtfNec * pDtf);
    let ingresos = pedido * pVenta;
    document.getElementById('cdtf-results').innerText = `RESULTADO\nCosto: $${costTotal.toFixed(2)}\nIngresos: $${ingresos.toFixed(2)}\nBeneficio: $${(ingresos - costTotal).toFixed(2)}`;
    state.lastDTF = { total: costTotal, sale: ingresos, desc: `DTF x${pedido}` };
}

function renderModule(id) {
    if (id === 'winInventory') { renderInventory(); renderMovements(); }
    if (id === 'winPurchases') renderPurchases();
    if (id === 'winExpenses') { populateExpenseMonthSelector(); renderExpenses(); }
    if (id === 'winSuppliers') renderSuppliers();
    if (id === 'winInvoices') renderInvoices();
    if (id === 'winWarehouse') renderWarehouse();
}

function renderInventory() {
    const body = document.getElementById('inventoryBody'); if (!body) return;
    body.innerHTML = state.inventory.map((item, idx) => `<tr><td>${item.name}</td><td>${item.stock}</td><td>$${item.avgCost.toFixed(2)}</td><td>$${(item.stock * item.avgCost).toFixed(2)}</td><td><button onclick="deleteInventory(${idx})">Eliminar</button></td></tr>`).join('');
}
function deleteInventory(idx) {
    state.inventory.splice(idx, 1);
    saveState();
    renderInventory();
}
function renderMovements() {
    const body = document.getElementById('movementsBody'); if (!body) return;
    body.innerHTML = state.movements.map(m => `<tr><td>${new Date(m.date).toLocaleDateString()}</td><td>${m.name}</td><td>${m.qty}</td><td>${m.reason}</td><td>${m.user}</td></tr>`).join('');
}
function adjustStock() {
    const name = document.getElementById('adj-name').value; const qty = parseInt(document.getElementById('adj-qty').value); const reason = document.getElementById('adj-reason').value;
    let item = state.inventory.find(i => i.name === name);
    if (!item) { item = { name, stock: 0, avgCost: 0 }; state.inventory.push(item); }
    if (reason === 'Venta' || reason === 'Merma') item.stock -= qty; else item.stock += qty;
    state.movements.push({ date: new Date().toISOString(), name, qty, reason, user: state.currentUser });
    saveState(); renderInventory(); renderMovements();
}

function registerPurchase() {
    const supplier = document.getElementById('p-supplier').value; const product = document.getElementById('p-product').value;
    const qty = parseInt(document.getElementById('p-qty').value); const unit = parseFloat(document.getElementById('p-unit').value);
    const total = qty * unit;
    state.purchases.push({ date: new Date().toISOString(), supplier, product, qty, unit, total, user: state.currentUser });
    let item = state.inventory.find(i => i.name === product);
    if (!item) state.inventory.push({ name: product, stock: qty, avgCost: unit });
    else { const oldVal = item.stock * item.avgCost; item.stock += qty; item.avgCost = (oldVal + total) / item.stock; }
    saveState(); renderPurchases(); renderInventory();
}
function renderPurchases() {
    const body = document.getElementById('purchasesBody'); if (!body) return;
    body.innerHTML = state.purchases.map(p => `<tr><td>${new Date(p.date).toLocaleDateString()}</td><td>${p.supplier}</td><td>${p.product}</td><td>${p.qty}</td><td>$${p.total.toFixed(2)}</td></tr>`).join('');
}

function populateExpenseMonthSelector() {
    const sel = document.getElementById('e-filter-month-selector');
    if (!sel) return;
    sel.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const opt = document.createElement('option');
        const monthName = d.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
        opt.value = d.toISOString().slice(0, 7);
        opt.innerText = `${monthName} DE ${d.getFullYear()}`;
        sel.appendChild(opt);
    }
}
function filterExpenses() {
    renderExpenses();
}
function registerExpense() {
    const dateInput = document.getElementById('e-date').value;
    const cat = document.getElementById('e-cat').value;
    const concept = document.getElementById('e-concept').value;
    const amount = parseFloat(document.getElementById('e-amount').value) || 0;
    const notes = document.getElementById('e-notes').value;
    state.expenses.push({ id: Date.now().toString().slice(-6), date: dateInput || new Date().toISOString().slice(0, 10), cat, concept, amount, notes, user: state.currentUser });
    saveState(); renderExpenses(); alert('Gasto registrado con éxito');
}
function renderExpenses() {
    const container = document.getElementById('expensesTableContainer'); if (!container) return;
    const filter = document.getElementById('e-filter-month-selector').value;
    const filtered = state.expenses.filter(e => e.date.startsWith(filter));
    if (filtered.length === 0) container.innerHTML = '<p class="no-expenses">Sin gastos este mes.</p>';
    else container.innerHTML = `<table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead><tbody>${filtered.map(e => `<tr><td>${new Date(e.date).toLocaleDateString()}</td><td>${e.cat}</td><td>${e.concept}</td><td>$${e.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}
function exportExpensesToExcel() {
    const filter = document.getElementById('e-filter-month-selector').value;
    const filtered = state.expenses.filter(e => e.date.startsWith(filter));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered), "Gastos");
    XLSX.writeFile(wb, `Gastos_${filter}.xlsx`);
}

function addToInvoice(type) {
    const priceEl = document.getElementById('c3d-res-price');
    const price = type === '3D' ? (priceEl ? parseFloat(priceEl.innerText) : 0) : state.lastDTF.sale;
    const desc = type === '3D' ? 'Impresión 3D' : state.lastDTF.desc;
    state.currentOrder.push({ desc, price }); renderCurrentOrder();
}
function renderCurrentOrder() {
    const list = document.getElementById('currentOrderItems'); if (!list) return;
    list.innerHTML = state.currentOrder.map((item, idx) => `<li>${item.desc} - $${item.price.toFixed(2)} <button onclick="removeFromOrder(${idx})">x</button></li>`).join('');
    document.getElementById('currentOrderTotal').innerText = state.currentOrder.reduce((sum, i) => sum + i.price, 0).toFixed(2);
}
function removeFromOrder(idx) {
    state.currentOrder.splice(idx, 1);
    renderCurrentOrder();
}
function finalizeInvoice() {
    if (state.currentOrder.length === 0) return;
    state.invoices.push({ id: 'INV-' + Math.floor(Math.random()*10000), date: new Date().toISOString(), items: [...state.currentOrder], total: state.currentOrder.reduce((sum, i) => sum + i.price, 0), user: state.currentUser });
    state.currentOrder = []; saveState(); renderInvoices(); renderCurrentOrder();
}
function renderInvoices() {
    const body = document.getElementById('invoicesBody'); if (!body) return;
    body.innerHTML = state.invoices.map(inv => `<tr><td>${inv.id}</td><td>${new Date(inv.date).toLocaleDateString()}</td><td>${inv.items.length} items</td><td>$${inv.total.toFixed(2)}</td><td><button onclick="viewInvoice('${inv.id}')">Ver</button></td></tr>`).join('');
}
function viewInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv) alert(`Factura ${inv.id}\nFecha: ${new Date(inv.date).toLocaleDateString()}\nTotal: $${inv.total.toFixed(2)}\nItems:\n${inv.items.map(i => `- ${i.desc}: $${i.price.toFixed(2)}`).join('\n')}`);
}
function searchInvoice(val) {
    document.querySelectorAll('#invoicesTable tbody tr').forEach(r => r.style.display = r.cells[0].innerText.includes(val) ? '' : 'none');
}

function renderSuppliers() {
    const list = document.getElementById('supplierList'); if (!list) return;
    list.innerHTML = state.suppliers.map((s, idx) => `<div class="card"><h4>${s.name}</h4><p>Cat: ${s.cat}</p><p>Editado por: ${s.lastUser}</p></div>`).join('');
}
function showSupplierForm() {
    const name = prompt("Nombre:"); const cat = prompt("Categoría:");
    if (name) { state.suppliers.push({ name, cat, lastUser: state.currentUser }); saveState(); renderSuppliers(); }
}

function renderWarehouse() {
    const list = document.getElementById('warehouseList'); if (!list) return;
    list.innerHTML = state.warehouse3d.map(p => `<div class="card"><h4>${p.name}</h4><p>${p.desc}</p><a href="${p.link}" target="_blank">Link</a></div>`).join('');
}
function showWarehouseForm() {
    const name = prompt("Nombre:"); const desc = prompt("Descripción:"); const link = prompt("Link:");
    if (name) { state.warehouse3d.push({ name, desc, link }); saveState(); renderWarehouse(); }
}

function exportToExcel() {
    const start = document.getElementById('export-start').value;
    const end = document.getElementById('export-end').value;
    const wb = XLSX.utils.book_new();
    const filterByDate = (arr) => arr.filter(i => { if (!start || !end) return true; return i.date >= start && i.date <= end; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.inventory), "Inventario");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterByDate(state.purchases)), "Compras");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterByDate(state.expenses)), "Gastos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterByDate(state.invoices)), "Facturas");
    XLSX.writeFile(wb, `Reporte_Pacioli.xlsx`);
}
function filterTable(tableId, val) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(r => {
        let match = false; Array.from(r.cells).forEach(c => { if(c.innerText.toLowerCase().includes(val.toLowerCase())) match = true; });
        r.style.display = match ? '' : 'none';
    });
}
