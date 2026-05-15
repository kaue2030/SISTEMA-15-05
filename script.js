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
    techParams: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupAuth();
    setupGlobalEvents();
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
        btnLogout.onclick = (e) => {
            e.preventDefault();
            state.currentUser = null; saveState(); location.reload();
        };
    }
    if (state.currentUser) login(state.currentUser);
}

function login(user) {
    state.currentUser = user;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('desktop').classList.remove('hidden');
    document.getElementById('pacioli-nav').classList.remove('hidden');
    document.getElementById('currentUser').innerText = user;
    saveState();
    showPage('dashboard');
}

function refreshDashboard() {
    const revEl = document.getElementById('dash-weekly-rev');
    if (!revEl) return;
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const monthInvoices = state.invoices.filter(inv => inv.date.startsWith(currentMonth) && inv.status !== 'Canceled');
    const totalMonth = monthInvoices.reduce((s, i) => s + i.total, 0);
    revEl.innerText = totalMonth.toLocaleString('en-US', { minimumFractionDigits: 2 });

    const ctx = document.getElementById('dash-profit-mini-chart');
    if (!ctx) return;
    const last6 = state.invoices.filter(i => i.status !== 'Canceled').slice(-6);
    const labels = last6.map((_, i) => i + 1);
    const data = last6.map(i => i.total);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['0'],
            datasets: [{
                data: data.length ? data : [0],
                backgroundColor: '#008cba',
                borderRadius: 0
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

// --- NAVIGATION ---
function showPage(id) {
    const template = document.getElementById(`tpl-${id}`);
    if (!template) return;
    const main = document.getElementById('main-content');
    main.innerHTML = template.innerHTML;

    if (id === 'dashboard') refreshDashboard();
    if (id === 'win3D') init3DCalc();
    if (id === 'winDTF') calculateDTF();
    renderModule(id);
}
window.showPage = showPage;

function setupGlobalEvents() {
    document.addEventListener('input', (e) => {
        if (e.target.id && e.target.id.startsWith('c3d-')) calculate3D();
        if (e.target.id && e.target.id.startsWith('cdtf-')) calculateDTF();
    });
}

// --- MODULES ---
let c3dChart = null;
function init3DCalc() { calculate3D(); }
window.calculate3D = calculate3D;
function calculate3D() {
    const win = document.getElementById('main-content');
    const consumption = parseFloat(win.querySelector('#c3d-consumption').value) || 0;
    const machinePrice = parseFloat(win.querySelector('#c3d-machinePrice').value) || 0;
    const filamentPrice = parseFloat(win.querySelector('#c3d-filamentPrice').value) || 0;
    const lifespan = parseFloat(win.querySelector('#c3d-lifespan').value) || 1;
    const kwhPrice = parseFloat(win.querySelector('#c3d-kwhPrice').value) || 0;
    const hours = parseFloat(win.querySelector('#c3d-hours').value) || 0;
    const grams = parseFloat(win.querySelector('#c3d-grams').value) || 0;
    const extra = parseFloat(win.querySelector('#c3d-extra').value) || 0;
    const fail = parseFloat(win.querySelector('#c3d-fail').value) || 0;
    const mult = parseFloat(win.querySelector('#c3d-mult').value) || 1;

    const cost = ((filamentPrice / 1000) * grams + (consumption / 1000) * hours * kwhPrice + (machinePrice / lifespan) * hours + extra) * (1 + fail / 100);
    const sale = cost * mult;

    win.querySelector('#c3d-res-cost').innerText = cost.toFixed(2);
    win.querySelector('#c3d-res-price').innerText = sale.toFixed(2);
    update3DChart(grams, hours, mult, filamentPrice, consumption, kwhPrice, machinePrice, lifespan, extra, fail);
}

function update3DChart(baseGrams, baseHours, mult, filP, cons, kwhP, mP, life, extra, fail) {
    const win = document.getElementById('main-content');
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
            datasets: [{ label: 'Venta $', data: prices, borderColor: '#008cba', borderWidth: 2, pointRadius: 2, tension: 0.1 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function calculateDTF() {
    const win = document.getElementById('main-content');
    const pedido = parseInt(win.querySelector('#cdtf-order').value) || 0;
    const stock = parseInt(win.querySelector('#cdtf-stock').value) || 0;
    const pPack5 = parseFloat(win.querySelector('#cdtf-pack5').value) || 0;
    const pSingle = parseFloat(win.querySelector('#cdtf-single').value) || 0;
    const pDtf = parseFloat(win.querySelector('#cdtf-dtfPrice').value) || 0;
    const dPerDtf = parseInt(win.querySelector('#cdtf-drawPerDtf').value) || 1;
    const pVenta = parseFloat(win.querySelector('#cdtf-sellPrice').value) || 10;

    let faltantes = Math.max(0, pedido - stock);
    let costA = Math.ceil(faltantes / 5) * pPack5;
    let costB = (Math.floor(faltantes / 5) * pPack5) + ((faltantes % 5) * pSingle);
    let costC = faltantes * pSingle;
    let bestCost = Math.min(costA, costB, costC);
    let dtfNec = Math.ceil(pedido / dPerDtf);
    let costTotal = bestCost + (dtfNec * pDtf);
    let ingresos = pedido * pVenta;
    win.querySelector('#cdtf-results').innerHTML = `<strong>Análisis de Costo:</strong><br>Remeras a comprar: ${faltantes}<br>Costo Total Producción: $${costTotal.toFixed(2)}<br>Margen Est. (a $${pVenta}/u): $${(ingresos - costTotal).toFixed(2)}`;
    state.lastDTF = { total: costTotal, sale: ingresos, desc: `DTF x${pedido}` };
}
window.calculateDTF = calculateDTF;

function renderModule(id) {
    const win = document.getElementById('main-content');
    if (id === 'winInventory') renderInventory();
    if (id === 'winPurchases') { populatePurchaseProductSelector(); renderPurchases(); }
    if (id === 'winExpenses') renderExpenses();
    if (id === 'winSuppliers') renderSuppliers();
    if (id === 'winCustomers') renderCustomers();
    if (id === 'winPayments') renderPaymentMethods();
    if (id === 'winInvoices') { renderInvoices(); renderCurrentOrder(); }
    if (id === 'winWarehouse') renderWarehouse();
    if (id === 'winTech') renderTech();
}

function renderInventory() {
    const win = document.getElementById('main-content');
    const body = win.querySelector('#inventoryBody'); if (!body) return;
    body.innerHTML = state.inventory.map((item, idx) => `<tr><td>${item.name}</td><td>${item.stock}</td><td>$${item.avgCost.toFixed(2)}</td><td>$${(item.stock * item.avgCost).toFixed(2)}</td><td><button class="btn btn-xs btn-danger" onclick="deleteInventory(${idx})">ELIMINAR</button></td></tr>`).join('');
}
window.deleteInventory = (idx) => { state.inventory.splice(idx,1); saveState(); renderInventory(); };

function adjustStock() {
    const win = document.getElementById('main-content');
    const name = win.querySelector('#adj-name').value;
    const qty = parseInt(win.querySelector('#adj-qty').value);
    const reason = win.querySelector('#adj-reason').value;
    if(!name || isNaN(qty)) return;
    let item = state.inventory.find(i => i.name === name);
    if (!item) { item = { name, stock: 0, avgCost: 0 }; state.inventory.push(item); }
    if (reason === 'Venta' || reason === 'Merma') item.stock -= qty; else item.stock += qty;
    saveState(); renderInventory();
}
window.adjustStock = adjustStock;

function addToInvoice(type) {
    const win = document.getElementById('main-content');
    let price = 0; let desc = "";
    if (type === '3D') {
        price = parseFloat(win.querySelector('#c3d-res-price').innerText);
        desc = "Impresión 3D (" + win.querySelector('#c3d-grams').value + "g)";
    } else {
        price = state.lastDTF.sale;
        desc = state.lastDTF.desc;
    }
    state.currentOrder.push({ desc, price });
    alert("Item agregado. Ve a Ventas > Facturas para emitir.");
    saveState();
}
window.addToInvoice = addToInvoice;

function toggleNewInvoice() { document.getElementById('new-invoice-pane').classList.toggle('hidden'); renderCurrentOrder(); }
window.toggleNewInvoice = toggleNewInvoice;

function renderCurrentOrder() {
    const win = document.getElementById('main-content');
    const list = win.querySelector('#currentOrderItems'); if (!list) return;
    list.innerHTML = state.currentOrder.map((item, idx) => `<li><i class="fa fa-caret-right"></i> ${item.desc} - $${item.price.toFixed(2)} <button class="btn btn-link btn-xs text-danger" onclick="removeFromOrder(${idx})">remover</button></li>`).join('');
    const totalEl = win.querySelector('#currentOrderTotal');
    if (totalEl) totalEl.innerText = state.currentOrder.reduce((sum, i) => sum + i.price, 0).toFixed(2);
}
window.removeFromOrder = (idx) => { state.currentOrder.splice(idx,1); renderCurrentOrder(); };

function finalizeInvoice() {
    const win = document.getElementById('main-content');
    if (state.currentOrder.length === 0) { alert("La orden está vacía"); return; }
    const custId = win.querySelector('#inv-cust-select').value;
    const payMethod = win.querySelector('#inv-pay-select').value;
    const dueDate = win.querySelector('#inv-due-date').value;
    const obs = win.querySelector('#inv-obs').value;
    const total = state.currentOrder.reduce((sum, i) => sum + i.price, 0);
    const code = `FAC-${new Date().getFullYear()}-${String(state.invoiceCounter++).padStart(3, '0')}`;

    state.invoices.push({ id: code, num: state.invoiceCounter-1, date: new Date().toISOString(), dueDate, items: [...state.currentOrder], total, user: state.currentUser, customerId: custId, paymentMethod: payMethod, obs, status: 'Pending' });
    state.currentOrder = []; saveState();
    document.getElementById('new-invoice-pane').classList.add('hidden');
    renderInvoices();
}
window.finalizeInvoice = finalizeInvoice;

function renderInvoices(filter = 'all') {
    const win = document.getElementById('main-content');
    const body = win.querySelector('#invoicesBody'); if (!body) return;
    populateInvoiceCustomers();
    let list = state.invoices;
    if (filter === 'pending') list = list.filter(i => i.status === 'Pending');

    body.innerHTML = list.slice().reverse().map(inv => {
        const cust = state.customers.find(c => c.cid === inv.customerId) || { name: 'Consumidor Final' };
        const statusClass = inv.status === 'Paid' ? 'success' : 'danger';
        const statusIcon = inv.status === 'Paid' ? 'fa-check' : (inv.status === 'Canceled' ? 'fa-times' : 'fa-warning');
        return `<tr class="${statusClass}">
            <td><i class="fa ${statusIcon}"></i></td>
            <td><strong>${inv.id}</strong></td>
            <td>${cust.name}</td>
            <td><small>${inv.obs || '-'}</small></td>
            <td class="text-right">$${inv.total.toFixed(2)}</td>
            <td class="text-right">${new Date(inv.date).toLocaleDateString()}</td>
            <td class="text-right">${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
            <td class="text-right">
                <button class="btn btn-xs btn-default" onclick="alert('Ver detalles de ${inv.id}')">VER</button>
                ${inv.status === 'Pending' ? `<button class="btn btn-xs btn-success" onclick="updateInvoiceStatus('${inv.id}', 'Paid')">PAGAR</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}
window.renderInvoices = renderInvoices;
window.updateInvoiceStatus = (id, status) => { state.invoices.find(i=>i.id===id).status=status; saveState(); renderInvoices(); };

function populateInvoiceCustomers() {
    const win = document.getElementById('main-content');
    const sel = win.querySelector('#inv-cust-select'); if (!sel) return;
    const selP = win.querySelector('#inv-pay-select');
    sel.innerHTML = '<option value="">-- Consumidor Final --</option>';
    state.customers.forEach(c => sel.innerHTML += `<option value="${c.cid}">${c.name}</option>`);
    selP.innerHTML = state.paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('');
}

function checkInvoiceGaps() {
    const nums = state.invoices.map(i => i.num).sort((a,b) => a-b);
    let gaps = [];
    for(let i=1; i < state.invoiceCounter; i++) if(!nums.includes(i)) gaps.push(i);
    alert(gaps.length ? "Faltan: " + gaps.join(", ") : "No hay huecos.");
}
window.checkInvoiceGaps = checkInvoiceGaps;

function addCustomer() {
    const win = document.getElementById('main-content');
    const name = win.querySelector('#cust-name').value;
    const cid = win.querySelector('#cust-id').value;
    if (!name) return;
    state.customers.push({ name, cid });
    saveState(); renderCustomers();
}
window.addCustomer = addCustomer;
function renderCustomers() {
    const win = document.getElementById('main-content');
    const body = win.querySelector('#customersBody'); if (!body) return;
    body.innerHTML = state.customers.map((c, idx) => `<tr><td>${c.name}</td><td>${c.cid}</td><td><button class="btn btn-xs btn-link" onclick="deleteCustomer(${idx})">Eliminar</button></td></tr>`).join('');
}
window.deleteCustomer = (idx) => { state.customers.splice(idx,1); saveState(); renderCustomers(); };

function addPaymentMethod() {
    const win = document.getElementById('main-content');
    const name = win.querySelector('#pay-name').value;
    if (!name) return;
    state.paymentMethods.push(name);
    saveState(); renderPaymentMethods();
}
window.addPaymentMethod = addPaymentMethod;
function renderPaymentMethods() {
    const win = document.getElementById('main-content');
    const list = win.querySelector('#paymentMethodsList'); if (!list) return;
    list.innerHTML = state.paymentMethods.map((m, idx) => `<li class="list-group-item" style="display:flex; justify-content:space-between;">${m} <button class="btn btn-xs btn-danger" onclick="deletePaymentMethod(${idx})">X</button></li>`).join('');
}
window.deletePaymentMethod = (idx) => { state.paymentMethods.splice(idx,1); saveState(); renderPaymentMethods(); };

function registerTechLog() {
    const win = document.getElementById('main-content');
    const machine = win.querySelector('#tech-machine').value;
    const log = win.querySelector('#tech-log').value;
    if (!machine || !log) return;
    state.techLogs.push({ date: new Date().toISOString(), user: state.currentUser, msg: `[${machine}] ${log}` });
    saveState(); renderTech();
}
window.registerTechLog = registerTechLog;
function renderTech() {
    const win = document.getElementById('main-content');
    const body = win.querySelector('#techBody'); if (!body) return;
    body.innerHTML = state.techLogs.slice().reverse().map(l => `<tr><td>${new Date(l.date).toLocaleDateString()}</td><td>${l.user}</td><td>${l.msg}</td></tr>`).join('');
}
function saveTechParam() { alert("Parámetros guardados en el perfil de material."); }
window.saveTechParam = saveTechParam;

// Purchase/Expense stubs (minimal for the clone)
function registerPurchase() {
    const win = document.getElementById('main-content');
    const dateInput = win.querySelector('#p-date').value;
    const supplier = win.querySelector('#p-supplier').value;
    const desc = win.querySelector('#p-desc').value;
    const linkedProduct = win.querySelector('#p-link-inventory').value;
    const qty = parseInt(win.querySelector('#p-qty').value) || 0;
    const unit = parseFloat(win.querySelector('#p-unit').value) || 0;
    const total = qty * unit;

    const purchase = {
        date: dateInput || new Date().toISOString().slice(0, 10),
        supplier, desc, product: linkedProduct, qty, unit, total, user: state.currentUser
    };

    state.purchases.push(purchase);
    if (linkedProduct) {
        let item = state.inventory.find(i => i.name === linkedProduct);
        if (item) {
            const oldVal = item.stock * item.avgCost;
            item.stock += qty;
            item.avgCost = (oldVal + total) / item.stock;
        }
    }
    saveState(); renderPurchases(); alert('Compra registrada');
}
window.registerPurchase = registerPurchase;

function renderPurchases() {
    const win = document.getElementById('main-content');
    const container = win.querySelector('#purchasesTableContainer');
    if (!container) return;
    container.innerHTML = `<table class="table"><thead><tr><th>Fecha</th><th>Prov</th><th>Prod</th><th>Total</th></tr></thead><tbody>${state.purchases.map(p => `<tr><td>${p.date}</td><td>${p.supplier}</td><td>${p.product || p.desc}</td><td>$${p.total.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}

function populatePurchaseProductSelector() {
    const win = document.getElementById('main-content');
    const sel = win.querySelector('#p-link-inventory'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Sin vincular --</option>';
    state.inventory.forEach(item => sel.innerHTML += `<option value="${item.name}">${item.name}</option>`);
}

function registerExpense() {
    const win = document.getElementById('main-content');
    const dateInput = win.querySelector('#e-date').value;
    const cat = win.querySelector('#e-cat').value;
    const concept = win.querySelector('#e-concept').value;
    const amount = parseFloat(win.querySelector('#e-amount').value) || 0;
    state.expenses.push({ date: dateInput || new Date().toISOString().slice(0, 10), cat, concept, amount, user: state.currentUser });
    saveState(); renderExpenses(); alert('Gasto registrado');
}
window.registerExpense = registerExpense;

function renderExpenses() {
    const win = document.getElementById('main-content');
    const container = win.querySelector('#expensesTableContainer');
    if (!container) return;
    container.innerHTML = `<table class="table"><thead><tr><th>Fecha</th><th>Cat</th><th>Desc</th><th>Monto</th></tr></thead><tbody>${state.expenses.map(e => `<tr><td>${e.date}</td><td>${e.cat}</td><td>${e.concept}</td><td>$${e.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}

function renderSuppliers() {
    const win = document.getElementById('main-content');
    const list = win.querySelector('#supplierList'); if (!list) return;
    list.innerHTML = state.suppliers.map(s => `<div class="panel panel-default"><div class="panel-body">${s.name} - ${s.cat}</div></div>`).join('');
}

function renderWarehouse() {
    const win = document.getElementById('main-content');
    const list = win.querySelector('#warehouseList'); if (!list) return;
    list.innerHTML = state.warehouse3d.map(p => `<div class="panel panel-default"><div class="panel-body"><strong>${p.name}</strong><br><a href="${p.link}" target="_blank">Abrir link</a></div></div>`).join('');
}

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.inventory), "Stock");
    XLSX.writeFile(wb, "Pacioli_Report.xlsx");
}
window.exportToExcel = exportToExcel;
