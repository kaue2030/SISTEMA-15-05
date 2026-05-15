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
    invoiceCounter: 1,
    customers: [],
    paymentMethods: ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta'],
    currentOrder: [],
    techLogs: [],
    techParams: [],
    windows: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupAuth();
    setupWindowEvents();
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
const USERS = { 'KAUE': 'kaue123', 'PEDRO': 'pedro123', 'TECNICO': 'tech123' };

function setupAuth() {
    document.getElementById('btnLogin').onclick = () => {
        const user = document.getElementById('username').value.toUpperCase();
        const pass = document.getElementById('password').value;
        if (USERS[user] && (pass === USERS[user] || pass === '1234')) login(user);
        else document.getElementById('loginError').classList.remove('hidden');
    };
    const btnLogout = document.getElementById('btnLogoutSidebar');
    if (btnLogout) {
        btnLogout.onclick = () => {
            state.currentUser = null; saveState(); location.reload();
        };
    }
    if (state.currentUser) login(state.currentUser);
}

function login(user) {
    state.currentUser = user;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('desktop').classList.remove('hidden');
    document.getElementById('currentUser').innerText = user;
    saveState();
    restoreWindows();
    refreshDashboard();
}

let dashChart = null;
function refreshDashboard() {
    const revEl = document.getElementById('dash-weekly-rev');
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const monthInvoices = state.invoices.filter(inv => inv.date.startsWith(currentMonth));
    const totalMonth = monthInvoices.reduce((s, i) => s + i.total, 0);
    if (revEl) revEl.innerText = totalMonth.toLocaleString('en-US', { minimumFractionDigits: 2 });

    const ctx = document.getElementById('dash-profit-mini-chart');
    if (!ctx) return;
    const last6 = state.invoices.slice(-6);
    const labels = last6.map((_, i) => i + 1);
    const data = last6.map(i => i.total);

    if (dashChart) dashChart.destroy();
    dashChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['0'],
            datasets: [{
                data: data.length ? data : [0],
                backgroundColor: '#111827',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
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
    if (id === 'win3D') setTimeout(init3DCalc, 100);
    if (id === 'winDTF') setTimeout(calculateDTF, 100);
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
        if (e.target.id && e.target.id.startsWith('c3d-')) calculate3D();
        if (e.target.id && e.target.id.startsWith('cdtf-')) calculateDTF();
    });
}

// --- MODULES ---
let c3dChart = null;
function init3DCalc() {
    calculate3D();
}
window.calculate3D = calculate3D;
function calculate3D() {
    const win = document.getElementById('win3D');
    if (!win) return;
    const consumption = parseFloat(win.querySelector('#c3d-consumption').value) || 0;
    const machinePrice = parseFloat(win.querySelector('#c3d-machinePrice').value) || 0;
    const lifespan = parseFloat(win.querySelector('#c3d-lifespan').value) || 1;
    const filamentPrice = parseFloat(win.querySelector('#c3d-filamentPrice').value) || 0;
    const kwhPrice = parseFloat(win.querySelector('#c3d-kwhPrice') ? win.querySelector('#c3d-kwhPrice').value : 15);
    const hours = parseFloat(win.querySelector('#c3d-hours').value) || 0;
    const minutes = parseFloat(win.querySelector('#c3d-minutes').value) || 0;
    const grams = parseFloat(win.querySelector('#c3d-grams').value) || 0;
    const extra = parseFloat(win.querySelector('#c3d-extra') ? win.querySelector('#c3d-extra').value : 0);
    const fail = parseFloat(win.querySelector('#c3d-fail').value) || 0;
    const mult = parseFloat(win.querySelector('#c3d-mult').value) || 1;
    const totalTime = hours + (minutes / 60);
    const cost = ((filamentPrice / 1000) * grams + (consumption / 1000) * totalTime * kwhPrice + (machinePrice / lifespan) * totalTime + extra) * (1 + fail / 100);
    const sale = cost * mult;
    const resCostEl = win.querySelector('#c3d-res-cost');
    const resPriceEl = win.querySelector('#c3d-res-price');
    if (resCostEl) resCostEl.innerText = cost.toFixed(2);
    if (resPriceEl) resPriceEl.innerText = sale.toFixed(2);
    update3DChart(grams, totalTime, mult, filamentPrice, consumption, kwhPrice, machinePrice, lifespan, extra, fail);
}
function update3DChart(baseGrams, baseHours, mult, filP, cons, kwhP, mP, life, extra, fail) {
    const win = document.getElementById('win3D');
    if (!win) return;
    const ctxEl = win.querySelector('#c3d-chart'); if (!ctxEl) return;
    const labels = []; const prices = [];
    for (let i = 5; i <= 15; i++) {
        const factor = i / 10; const g = baseGrams * factor; labels.push(g.toFixed(0) + 'g');
        const cost = ((filP/1000)*g + (cons/1000)*baseHours*kwhP + (mP/life)*baseHours + extra) * (1 + fail/100);
        prices.push((cost * mult).toFixed(2));
    }
    if (c3dChart) c3dChart.destroy();
    c3dChart = new Chart(ctxEl.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Venta $',
                data: prices,
                borderColor: '#111827',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { grid: { borderDash: [5, 5] }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function calculateDTF() {
    const win = document.getElementById('winDTF');
    if (!win) {
        // Fallback for initialization before window is in DOM
        return;
    }
    const orderInput = win.querySelector('#cdtf-order');
    if (!orderInput) return;
    const pedido = parseInt(orderInput.value) || 0;
    const stock = parseInt(win.querySelector('#cdtf-stock').value) || 0;
    const pPack5 = parseFloat(win.querySelector('#cdtf-pack5').value) || 0;
    const pSingle = parseFloat(win.querySelector('#cdtf-single').value) || 0;
    const pDtf = parseFloat(win.querySelector('#cdtf-dtfPrice').value) || 0;
    const dPerDtf = parseInt(win.querySelector('#cdtf-drawPerDtf').value) || 1;
    const pVenta = parseFloat(win.querySelector('#cdtf-sellPrice').value) || 0;
    let faltantes = Math.max(0, pedido - stock);
    let costA = Math.ceil(faltantes / 5) * pPack5;
    let costB = (Math.floor(faltantes / 5) * pPack5) + ((faltantes % 5) * pSingle);
    let costC = faltantes * pSingle;
    let bestCost = Math.min(costA, costB, costC);
    let dtfNec = Math.ceil(pedido / dPerDtf);
    let costTotal = bestCost + (dtfNec * pDtf);
    let ingresos = pedido * pVenta;
    win.querySelector('#cdtf-results').innerText = `RESULTADO\nCosto: $${costTotal.toFixed(2)}\nIngresos: $${ingresos.toFixed(2)}\nBeneficio: $${(ingresos - costTotal).toFixed(2)}`;
    state.lastDTF = { total: costTotal, sale: ingresos, desc: `DTF x${pedido}` };
}

function renderModule(id) {
    if (id === 'winInventory') { renderInventory(); renderMovements(); }
    if (id === 'winPurchases') { populatePurchaseProductSelector(); renderPurchases(); }
    if (id === 'winExpenses') { renderExpenses(); }
    if (id === 'winSuppliers') renderSuppliers();
    if (id === 'winCustomers') renderCustomers();
    if (id === 'winPayments') renderPaymentMethods();
    if (id === 'winInvoices') { renderInvoices(); renderCurrentOrder(); }
    if (id === 'winWarehouse') renderWarehouse();
    if (id === 'winTech') renderTech();
}

function renderInventory() {
    const win = document.getElementById('winInventory');
    if (!win) return;
    const body = win.querySelector('#inventoryBody'); if (!body) return;
    body.innerHTML = state.inventory.map((item, idx) => `<tr><td>${item.name}</td><td>${item.stock}</td><td>$${item.avgCost.toFixed(2)}</td><td>$${(item.stock * item.avgCost).toFixed(2)}</td><td><button onclick="deleteInventory(${idx})">Eliminar</button></td></tr>`).join('');
}
function deleteInventory(idx) {
    state.inventory.splice(idx, 1);
    saveState();
    renderInventory();
    populatePurchaseProductSelector();
}
function renderMovements() {
    const win = document.getElementById('winInventory');
    if (!win) return;
    const body = win.querySelector('#movementsBody'); if (!body) return;
    body.innerHTML = state.movements.slice().reverse().map(m => `<tr><td>${new Date(m.date).toLocaleDateString()}</td><td>${m.name}</td><td>${m.qty}</td><td>${m.user}</td></tr>`).join('');
}
function adjustStock() {
    const win = document.getElementById('winInventory');
    const name = win.querySelector('#adj-name').value;
    const qty = parseInt(win.querySelector('#adj-qty').value);
    const reason = win.querySelector('#adj-reason').value;
    let item = state.inventory.find(i => i.name === name);
    if (!item) { item = { name, stock: 0, avgCost: 0 }; state.inventory.push(item); }
    if (reason === 'Venta' || reason === 'Merma') item.stock -= qty; else item.stock += qty;
    state.movements.push({ date: new Date().toISOString(), name, qty, reason, user: state.currentUser });
    saveState(); renderInventory(); renderMovements(); populatePurchaseProductSelector();
}

// --- MODULE: PURCHASES ---
function populatePurchaseProductSelector() {
    const win = document.getElementById('winPurchases');
    if (!win) return;
    const sel = win.querySelector('#p-link-inventory');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Sin vincular --</option>';
    state.inventory.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.name;
        opt.innerText = item.name;
        sel.appendChild(opt);
    });
}

function registerPurchase() {
    const win = document.getElementById('winPurchases');
    const dateInput = win.querySelector('#p-date').value;
    const supplier = win.querySelector('#p-supplier').value;
    const desc = win.querySelector('#p-desc').value;
    const linkedProduct = win.querySelector('#p-link-inventory').value;
    const qty = parseInt(win.querySelector('#p-qty').value) || 0;
    const unit = parseFloat(win.querySelector('#p-unit').value) || 0;
    const notes = win.querySelector('#p-notes').value;
    const total = qty * unit;

    const purchase = {
        date: dateInput || new Date().toISOString().slice(0, 10),
        supplier, desc, product: linkedProduct, qty, unit, total, notes, user: state.currentUser
    };

    state.purchases.push(purchase);

    if (linkedProduct) {
        let item = state.inventory.find(i => i.name === linkedProduct);
        if (item) {
            const oldVal = item.stock * item.avgCost;
            item.stock += qty;
            item.avgCost = (oldVal + total) / item.stock;
            state.movements.push({ date: purchase.date, name: linkedProduct, qty, reason: 'Compra (Vinculada)', user: state.currentUser });
        }
    }

    saveState();
    renderPurchases();
    renderInventory();
    alert('Compra registrada con éxito');
}

function renderPurchases() {
    const win = document.getElementById('winPurchases');
    if (!win) return;
    const container = win.querySelector('#purchasesTableContainer');
    const filtered = state.purchases;

    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-purchases" style="font-size:0.8rem; color:#999; margin-top:10px;">Sin compras registradas.</p>';
    } else {
        container.innerHTML = `<table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Producto</th><th>Total</th></tr></thead><tbody>${filtered.map(p => `<tr><td>${new Date(p.date).toLocaleDateString()}</td><td>${p.supplier}</td><td>${p.product || p.desc}</td><td>$${p.total.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    }
}

function filterPurchases() { renderPurchases(); }

// --- UTILS ---
function populateMonthSelector(elementId) {
    const sel = document.getElementById(elementId) || document.querySelector(`#${elementId}`) || (activeWin && activeWin.querySelector(`#${elementId}`));
    if (!sel) return;
    sel.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const opt = document.createElement('option');
        opt.value = d.toISOString().slice(0, 7);
        opt.innerText = `${d.toLocaleString('es-ES', { month: 'long' }).toUpperCase()} DE ${d.getFullYear()}`;
        sel.appendChild(opt);
    }
}

// --- MODULE: EXPENSES ---
function filterExpenses() { renderExpenses(); }
function registerExpense() {
    const win = document.getElementById('winExpenses');
    const dateInput = win.querySelector('#e-date').value;
    const cat = win.querySelector('#e-cat').value;
    const concept = win.querySelector('#e-concept').value;
    const amount = parseFloat(win.querySelector('#e-amount').value) || 0;
    const notes = win.querySelector('#e-notes').value;
    state.expenses.push({ id: Date.now().toString().slice(-6), date: dateInput || new Date().toISOString().slice(0, 10), cat, concept, amount, notes, user: state.currentUser });
    saveState(); renderExpenses(); alert('Gasto registrado con éxito');
}
function renderExpenses() {
    const win = document.getElementById('winExpenses'); if (!win) return;
    const container = win.querySelector('#expensesTableContainer');
    const filtered = state.expenses;
    if (filtered.length === 0) container.innerHTML = '<p class="no-expenses" style="font-size:0.8rem; color:#999; margin-top:10px;">Sin gastos registrados.</p>';
    else container.innerHTML = `<table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead><tbody>${filtered.map(e => `<tr><td>${new Date(e.date).toLocaleDateString()}</td><td>${e.cat}</td><td>${e.concept}</td><td>$${e.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}

function addToInvoice(type) {
    const win = type === '3D' ? document.getElementById('win3D') : document.getElementById('winDTF');
    const price = type === '3D' ? parseFloat(win.querySelector('#c3d-res-price').innerText) : state.lastDTF.sale;
    const desc = type === '3D' ? 'Impresión 3D' : state.lastDTF.desc;
    state.currentOrder.push({ desc, price }); renderCurrentOrder();
}
function renderCurrentOrder() {
    const win = document.getElementById('winInvoices');
    if (!win) return;
    const list = win.querySelector('#currentOrderItems'); if (!list) return;
    list.innerHTML = state.currentOrder.map((item, idx) => `<li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #fecaca; padding:4px 0;"><span>${item.desc}</span> <span>$${item.price.toFixed(2)} <button onclick="removeFromOrder(${idx})">x</button></span></li>`).join('');
    const totalEl = win.querySelector('#currentOrderTotal');
    if (totalEl) totalEl.innerText = state.currentOrder.reduce((sum, i) => sum + i.price, 0).toFixed(2);
}
function removeFromOrder(idx) { state.currentOrder.splice(idx, 1); renderCurrentOrder(); }
function finalizeInvoice() {
    const win = document.getElementById('winInvoices');
    if (state.currentOrder.length === 0) return;
    const custId = win.querySelector('#inv-cust-select').value;
    const payMethod = win.querySelector('#inv-pay-select').value;
    const dueDate = win.querySelector('#inv-due-date').value;
    const obs = win.querySelector('#inv-obs').value;
    const total = state.currentOrder.reduce((sum, i) => sum + i.price, 0);

    const year = new Date().getFullYear();
    const code = `FAC-${year}-${String(state.invoiceCounter++).padStart(3, '0')}`;

    state.invoices.push({
        id: code,
        num: state.invoiceCounter - 1,
        date: new Date().toISOString(),
        dueDate: dueDate || new Date().toISOString().slice(0, 10),
        items: [...state.currentOrder],
        total,
        user: state.currentUser,
        customerId: custId,
        paymentMethod: payMethod,
        obs,
        status: 'Pending'
    });
    state.currentOrder = [];
    saveState();
    renderInvoices();
    renderCurrentOrder();
    refreshDashboard();

    // Clear inputs
    win.querySelector('#inv-obs').value = '';
}
function renderInvoices(filter = 'all') {
    const win = document.getElementById('winInvoices');
    if (!win) return;
    populateInvoiceCustomers();
    const body = win.querySelector('#invoicesBody'); if (!body) return;

    let list = state.invoices;
    if (filter === 'pending') list = list.filter(i => i.status === 'Pending');

    body.innerHTML = list.slice().reverse().map(inv => {
        const cust = state.customers.find(c => c.cid === inv.customerId) || { name: 'Consumidor Final' };
        const statusIcon = inv.status === 'Paid' ? '✅' : (inv.status === 'Canceled' ? '❌' : '⏳');
        const statusClass = inv.status.toLowerCase();
        return `<tr class="status-${statusClass}">
            <td>${statusIcon}</td>
            <td><strong>${inv.id}</strong></td>
            <td>${cust.name}</td>
            <td style="font-size:0.7rem; max-width:100px; overflow:hidden; text-overflow:ellipsis;">${inv.obs || '-'}</td>
            <td class="text-right">$${inv.total.toFixed(2)}</td>
            <td class="text-right">${new Date(inv.date).toLocaleDateString()}</td>
            <td>
                <button onclick="viewInvoice('${inv.id}')">👁</button>
                ${inv.status === 'Pending' ? `<button onclick="updateInvoiceStatus('${inv.id}', 'Paid')">💵</button>` : ''}
                ${inv.status !== 'Canceled' ? `<button onclick="updateInvoiceStatus('${inv.id}', 'Canceled')">🚫</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}
function updateInvoiceStatus(id, status) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv) { inv.status = status; saveState(); renderInvoices(); refreshDashboard(); }
}
function populateInvoiceCustomers() {
    const win = document.getElementById('winInvoices'); if (!win) return;
    const sel = win.querySelector('#inv-cust-select'); if (!sel) return;
    const selPay = win.querySelector('#inv-pay-select'); if (!selPay) return;

    const currentCust = sel.value;
    sel.innerHTML = '<option value="">-- Consumidor Final --</option>';
    state.customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.cid;
        opt.innerText = c.name;
        sel.appendChild(opt);
    });
    sel.value = currentCust;

    const currentPay = selPay.value;
    selPay.innerHTML = '';
    state.paymentMethods.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = m;
        selPay.appendChild(opt);
    });
    selPay.value = currentPay;
}
function checkInvoiceGaps() {
    const nums = state.invoices.map(i => i.num).sort((a,b) => a-b);
    let gaps = [];
    for(let i=1; i < state.invoiceCounter; i++) {
        if(!nums.includes(i)) gaps.push(i);
    }
    if(gaps.length === 0) alert("No hay huecos en la numeración.");
    else alert("Faltan los siguientes números de factura: " + gaps.join(", "));
}
function viewInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv) alert(`Factura ${inv.id}\nFecha: ${new Date(inv.date).toLocaleDateString()}\nTotal: $${inv.total.toFixed(2)}\nItems:\n${inv.items.map(i => `- ${i.desc}: $${i.price.toFixed(2)}`).join('\n')}`);
}
function searchInvoice(val) {
    document.querySelectorAll('#invoicesTable tbody tr').forEach(r => r.style.display = r.cells[0].innerText.includes(val) ? '' : 'none');
}

function addCustomer() {
    const win = document.getElementById('winCustomers');
    const name = win.querySelector('#cust-name').value;
    const cid = win.querySelector('#cust-id').value;
    if (!name) return;
    state.customers.push({ name, cid });
    saveState(); renderCustomers();
    win.querySelector('#cust-name').value = '';
    win.querySelector('#cust-id').value = '';
}
function renderCustomers() {
    const win = document.getElementById('winCustomers'); if (!win) return;
    const body = win.querySelector('#customersBody');
    body.innerHTML = state.customers.map((c, idx) => `<tr><td>${c.name}</td><td>${c.cid}</td><td><button onclick="deleteCustomer(${idx})">x</button></td></tr>`).join('');
}
function deleteCustomer(idx) { state.customers.splice(idx, 1); saveState(); renderCustomers(); }

function addPaymentMethod() {
    const win = document.getElementById('winPayments');
    const name = win.querySelector('#pay-name').value;
    if (!name) return;
    state.paymentMethods.push(name);
    saveState(); renderPaymentMethods();
    win.querySelector('#pay-name').value = '';
}
function renderPaymentMethods() {
    const win = document.getElementById('winPayments'); if (!win) return;
    const list = win.querySelector('#paymentMethodsList');
    list.innerHTML = state.paymentMethods.map((m, idx) => `<li style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;">${m} <button onclick="deletePaymentMethod(${idx})">x</button></li>`).join('');
}
function deletePaymentMethod(idx) { state.paymentMethods.splice(idx, 1); saveState(); renderPaymentMethods(); }

function renderSuppliers() {
    const list = document.getElementById('supplierList') || document.querySelector('#supplierList'); if (!list) return;
    list.innerHTML = state.suppliers.map((s, idx) => `<div class="card"><h4>${s.name}</h4><p>Cat: ${s.cat}</p><p>Editado por: ${s.lastUser}</p></div>`).join('');
}
function showSupplierForm() {
    const name = prompt("Nombre:"); const cat = prompt("Categoría:");
    if (name) { state.suppliers.push({ name, cat, lastUser: state.currentUser }); saveState(); renderSuppliers(); }
}

function renderWarehouse() {
    const list = document.getElementById('warehouseList') || document.querySelector('#warehouseList'); if (!list) return;
    list.innerHTML = state.warehouse3d.map(p => `<div class="card"><h4>${p.name}</h4><p>${p.desc}</p><a href="${p.link}" target="_blank">Link</a></div>`).join('');
}
function showWarehouseForm() {
    const name = prompt("Nombre:"); const desc = prompt("Descripción:"); const link = prompt("Link:");
    if (name) { state.warehouse3d.push({ name, desc, link }); saveState(); renderWarehouse(); }
}

function exportToExcel() {
    const win = document.getElementById('winInventory');
    const start = win.querySelector('#export-start').value;
    const end = win.querySelector('#export-end').value;
    const wb = XLSX.utils.book_new();
    const filterByDate = (arr) => arr.filter(i => { if (!start || !end) return true; return i.date >= start && i.date <= end; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.inventory), "Inventario");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterByDate(state.purchases)), "Compras");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterByDate(state.expenses)), "Gastos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterByDate(state.invoices)), "Facturas");
    XLSX.writeFile(wb, `Reporte_Pacioli.xlsx`);
}
function registerTechLog() {
    const win = document.getElementById('winTech');
    const machine = win.querySelector('#tech-machine').value;
    const log = win.querySelector('#tech-log').value;
    if (!machine || !log) return;
    state.techLogs.push({ date: new Date().toISOString(), user: state.currentUser, msg: `[${machine}] ${log}` });
    saveState(); renderTech();
}
function saveTechParam() {
    const win = document.getElementById('winTech');
    const mat = win.querySelector('#tech-mat').value;
    const tn = win.querySelector('#tech-temp-n').value;
    const tb = win.querySelector('#tech-temp-b').value;
    state.techParams.push({ mat, tn, tb });
    saveState(); alert('Parámetros guardados');
}
function renderTech() {
    const win = document.getElementById('winTech'); if (!win) return;
    const body = win.querySelector('#techBody');
    body.innerHTML = state.techLogs.slice().reverse().map(l => `<tr><td>${new Date(l.date).toLocaleDateString()}</td><td>${l.user}</td><td>${l.msg}</td></tr>`).join('');
}

function filterTable(tableId, val) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(r => {
        let match = false; Array.from(r.cells).forEach(c => { if(c.innerText.toLowerCase().includes(val.toLowerCase())) match = true; });
        r.style.display = match ? '' : 'none';
    });
}
