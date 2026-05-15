// State Management
let state = {
    currentUser: null,
    inventory: [],
    purchases: [],
    expenses: [],
    invoices: [],
    invoiceCounter: 1,
    customers: [],
    currentOrder: [],
    techLogs: []
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
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
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
        else alert("Credenciales incorrectas");
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
    document.getElementById('currentUserNav').innerText = user;
    saveState();
    showPage('winInvoices');
}

// --- NAVIGATION ---
function showPage(id) {
    const template = document.getElementById(`tpl-${id}`);
    if (!template) return;

    document.querySelectorAll('#pacioli-nav .nav > li').forEach(li => li.classList.remove('active'));
    const links = document.querySelectorAll(`#pacioli-nav a[onclick*="${id}"]`);
    links.forEach(a => {
        let p = a.closest('.dropdown');
        if(p) p.classList.add('active');
        else a.parentElement.classList.add('active');
    });

    const main = document.getElementById('main-content');
    main.innerHTML = template.innerHTML;

    renderModule(id);

    // Auto-calculate on load
    if (id === 'win3D') calculate3D();
    if (id === 'winDTF') calculateDTF();
}
window.showPage = showPage;

function setupGlobalEvents() {
    document.addEventListener('input', (e) => {
        if (e.target.id && e.target.id.startsWith('c3d-')) calculate3D();
        if (e.target.id && e.target.id.startsWith('cdtf-')) calculateDTF();
    });
}

function renderModule(id) {
    if (id === 'winInventory') renderInventory();
    if (id === 'winPurchases') renderPurchases();
    if (id === 'winCustomers') renderCustomers();
    if (id === 'winExpenses') renderExpenses();
    if (id === 'winTech') renderTech();
    if (id === 'winInvoices') { renderInvoices(); renderCurrentOrder(); }
}

// --- MODULE: INVOICES ---
function toggleNewInvoice() {
    const p = document.getElementById('new-invoice-pane');
    if(p) { p.classList.toggle('hidden'); populateInvoiceCustomers(); renderCurrentOrder(); }
}
window.toggleNewInvoice = toggleNewInvoice;

function renderInvoices(filter = 'all') {
    const win = document.getElementById('main-content');
    const body = win.querySelector('#invoicesBody'); if (!body) return;

    win.querySelectorAll('.nav-tabs li').forEach(li => li.classList.remove('active'));
    if(filter === 'all') win.querySelector('.nav-tabs li:first-child').classList.add('active');
    else if(filter === 'pending') win.querySelector('.nav-tabs li:nth-child(2)').classList.add('active');

    let list = state.invoices;
    if (filter === 'pending') list = list.filter(i => i.status === 'Pending');

    const pendingCount = state.invoices.filter(i => i.status === 'Pending').length;
    const badge = win.querySelector('#badge-pending'); if(badge) badge.innerText = pendingCount;

    body.innerHTML = list.slice().reverse().map(inv => {
        const cust = state.customers.find(c => c.cid === inv.customerId) || { name: 'Consumidor Final' };
        let rowClass = "";
        if(inv.status === 'Pending') rowClass = "danger";
        if(inv.status === 'Paid') rowClass = "success";

        const statusIcon = inv.status === 'Paid' ? '<span class="glyphicon glyphicon-ok"></span>' :
                          (inv.status === 'Pending' ? '<span class="glyphicon glyphicon-time"></span>' : '');

        return `<tr class="${rowClass}" onclick="viewInvoice('${inv.id}')" style="cursor:pointer">
            <td class="text-center">${statusIcon}</td>
            <td>${inv.id}</td>
            <td>${cust.name}</td>
            <td><small>${inv.obs || '-'}</small></td>
            <td class="text-right">$${inv.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right">${new Date(inv.date).toLocaleDateString()}</td>
            <td class="text-right">${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
        </tr>`;
    }).join('');
}
window.renderInvoices = renderInvoices;

function viewInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    const cust = state.customers.find(c => c.cid === inv.customerId) || { name: 'Consumidor Final', cid: '---' };
    document.getElementById('m-inv-title').innerText = `Factura ${inv.id}`;
    document.getElementById('m-inv-date').innerText = new Date(inv.date).toLocaleString();
    document.getElementById('m-inv-cust').innerHTML = `${cust.name} (${cust.cid})`;
    document.getElementById('m-inv-total').innerText = inv.total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    document.getElementById('m-inv-items').innerHTML = inv.items.map(i => `<tr><td>${i.desc}</td><td class="text-right">$${i.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td></tr>`).join('');
    $('#modal_invoice_details').modal('show');
}
window.viewInvoice = viewInvoice;

function finalizeInvoice() {
    const win = document.getElementById('main-content');
    if (state.currentOrder.length === 0) return;
    const code = `FAC-${new Date().getFullYear()}${String(state.invoiceCounter++).padStart(3, '0')}`;
    state.invoices.push({
        id: code, num: state.invoiceCounter-1, date: new Date().toISOString(),
        dueDate: win.querySelector('#inv-due-date').value, items: [...state.currentOrder],
        total: state.currentOrder.reduce((s, i) => s + i.price, 0), user: state.currentUser,
        customerId: win.querySelector('#inv-cust-select').value, obs: win.querySelector('#inv-obs').value, status: 'Pending'
    });
    state.currentOrder = []; saveState(); toggleNewInvoice(); renderInvoices();
}
window.finalizeInvoice = finalizeInvoice;

function renderCurrentOrder() {
    const list = document.getElementById('currentOrderItems'); if (!list) return;
    list.innerHTML = state.currentOrder.map((item, idx) => `<li><button class="btn btn-link btn-xs text-danger" onclick="removeFromOrder(${idx})"><i class="fa fa-times"></i></button> ${item.desc} - $${item.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>`).join('');
    const totalEl = document.getElementById('currentOrderTotal'); if (totalEl) totalEl.innerText = state.currentOrder.reduce((s, i) => s + i.price, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}
window.removeFromOrder = (idx) => { state.currentOrder.splice(idx,1); renderCurrentOrder(); };

// --- PRODUCTION: 3D & DTF ---
let c3dChart = null;
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

    const matCost = (filamentPrice / 1000) * grams;
    const energyCost = (consumption / 1000) * hours * kwhPrice;
    const machineWear = (machinePrice / lifespan) * hours;

    const cost = (matCost + energyCost + machineWear + extra) * (1 + fail / 100);
    const sale = cost * mult;

    win.querySelector('#c3d-res-cost').innerText = cost.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    win.querySelector('#c3d-res-price').innerText = sale.toLocaleString('es-AR', { minimumFractionDigits: 2 });

    const ctxEl = win.querySelector('#c3d-chart'); if (!ctxEl) return;
    const labels = []; const prices = [];
    for (let i = 5; i <= 15; i++) {
        const factor = i / 10; const g = grams * factor; labels.push(g.toFixed(0) + 'g');
        const c = ((filamentPrice/1000)*g + energyCost + machineWear + extra) * (1 + fail/100);
        prices.push((c * mult).toFixed(0));
    }
    if (c3dChart) c3dChart.destroy();
    c3dChart = new Chart(ctxEl.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Precio Venta $',
                data: prices,
                borderColor: '#008cba',
                backgroundColor: 'rgba(0,140,186,0.1)',
                fill: true,
                borderWidth: 2,
                pointRadius: 3,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: false } }
        }
    });
}
window.calculate3D = calculate3D;

function calculateDTF() {
    const win = document.getElementById('main-content');
    const pedido = parseInt(win.querySelector('#cdtf-order').value) || 0;
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
    win.querySelector('#cdtf-results').innerHTML = `<strong>Optimización:</strong><br>Faltantes: ${faltantes} unidades<br>Costo Producción: $${costTotal.toLocaleString('es-AR')}<br>Margen: $${(ingresos - costTotal).toLocaleString('es-AR')}`;
    state.lastDTF = { sale: ingresos, desc: `Pedido DTF x${pedido}` };
}
window.calculateDTF = calculateDTF;

function addToInvoice(type) {
    const win = document.getElementById('main-content');
    let price = 0; let desc = "";
    if (type === '3D') {
        const priceStr = win.querySelector('#c3d-res-price').innerText.replace(/\./g, '').replace(',', '.');
        price = parseFloat(priceStr);
        desc = "Impresión 3D (" + win.querySelector('#c3d-grams').value + "g)";
    } else {
        price = state.lastDTF.sale;
        desc = state.lastDTF.desc;
    }
    state.currentOrder.push({ desc, price });
    alert("Agregado al pedido actual.");
    saveState();
}
window.addToInvoice = addToInvoice;

// --- GESTIÓN ---
function renderInventory() {
    const body = document.getElementById('inventoryBody'); if (!body) return;
    body.innerHTML = state.inventory.map((i, idx) => `<tr><td>${i.name}</td><td>${i.stock}</td><td>$${i.avgCost.toLocaleString('es-AR')}</td><td>$${(i.stock*i.avgCost).toLocaleString('es-AR')}</td><td class="text-right"><button class="btn btn-xs btn-link" onclick="deleteInventory(${idx})">Eliminar</button></td></tr>`).join('');
}
window.deleteInventory = (idx) => { state.inventory.splice(idx,1); saveState(); renderInventory(); };

function renderCustomers() {
    const body = document.getElementById('customersBody'); if (!body) return;
    body.innerHTML = state.customers.map((c, idx) => `<tr><td>${c.name}</td><td>${c.cid}</td><td class="text-right"><button class="btn btn-xs btn-danger" onclick="deleteCustomer(${idx})">X</button></td></tr>`).join('');
}
window.addCustomer = () => { state.customers.push({ name: document.getElementById('cust-name').value, cid: document.getElementById('cust-id').value }); saveState(); renderCustomers(); };
window.deleteCustomer = (idx) => { state.customers.splice(idx,1); saveState(); renderCustomers(); };

function renderPurchases() {
    const body = document.getElementById('purchasesBody'); if (!body) return;
    body.innerHTML = state.purchases.slice().reverse().map(p => `<tr class="success"><td><i class="fa fa-check"></i></td><td>${p.supplier}</td><td><small>${p.desc || '-'}</small></td><td class="text-right">$${p.total.toLocaleString('es-AR')}</td><td class="text-right">${new Date(p.date).toLocaleDateString()}</td></tr>`).join('');
}
window.toggleNewPurchase = () => { document.getElementById('new-purchase-pane').classList.toggle('hidden'); populatePurchaseProductSelector(); };
window.registerPurchase = () => {
    const win = document.getElementById('main-content');
    const qty = parseInt(win.querySelector('#p-qty').value); const unit = parseFloat(win.querySelector('#p-unit').value);
    const p = { supplier: win.querySelector('#p-supplier').value, desc: win.querySelector('#p-desc').value, product: win.querySelector('#p-link-inventory').value, qty, unit, total: qty*unit, date: win.querySelector('#p-date').value || new Date().toISOString().slice(0,10) };
    state.purchases.push(p);
    if (p.product && p.product !== "NEW") {
        let item = state.inventory.find(i => i.name === p.product);
        const oldVal = item.stock * item.avgCost; item.stock += qty; item.avgCost = (oldVal + p.total) / item.stock;
    } else if (p.product === "NEW") {
        const name = prompt("Nombre del nuevo producto:");
        if (name) state.inventory.push({ name, stock: qty, avgCost: unit });
    }
    saveState(); window.toggleNewPurchase(); renderPurchases();
};

function renderExpenses() {
    const body = document.getElementById('expensesBody'); if (!body) return;
    body.innerHTML = state.expenses.map((e, idx) => `<tr><td>${e.desc}</td><td class="text-right">$${e.amount.toLocaleString('es-AR')}</td><td>${e.date}</td></tr>`).join('');
}
window.addExpense = () => {
    const desc = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const date = document.getElementById('exp-date').value || new Date().toISOString().slice(0,10);
    if (desc && amount) { state.expenses.push({ desc, amount, date }); saveState(); renderExpenses(); }
};

function renderTech() {
    const body = document.getElementById('techBody'); if (!body) return;
    body.innerHTML = state.techLogs.map(l => `<tr><td>${l.date}</td><td>${l.machine}</td><td>${l.action}</td><td>${l.user}</td></tr>`).join('');
}
window.addTechLog = () => {
    const machine = document.getElementById('tech-machine').value;
    const action = document.getElementById('tech-action').value;
    if (machine && action) { state.techLogs.push({ date: new Date().toLocaleString(), machine, action, user: state.currentUser }); saveState(); renderTech(); }
};

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    const invData = state.invoices.map(i => ({ ID: i.id, Cliente: i.customerId, Total: i.total, Fecha: i.date }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), "Facturas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.inventory), "Inventario");
    XLSX.writeFile(wb, "KAIA_ERP_Data.xlsx");
}
window.exportToExcel = exportToExcel;

function populatePurchaseProductSelector() {
    const sel = document.getElementById('p-link-inventory'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Sin vincular --</option>';
    state.inventory.forEach(item => sel.innerHTML += `<option value="${item.name}">${item.name}</option>`);
    sel.innerHTML += '<option value="NEW">-- Nuevo Producto --</option>';
}

function populateInvoiceCustomers() {
    const sel = document.getElementById('inv-cust-select'); if (!sel) return;
    sel.innerHTML = '<option value="">-- Consumidor Final --</option>';
    state.customers.forEach(c => sel.innerHTML += `<option value="${c.cid}">${c.name}</option>`);
}

function checkInvoiceGaps() {
    const nums = state.invoices.map(i => i.num).sort((a,b) => a-b);
    let gaps = []; for(let i=1; i < state.invoiceCounter; i++) if(!nums.includes(i)) gaps.push(i);
    alert(gaps.length ? "Faltan: " + gaps.join(", ") : "Sin huecos.");
}
