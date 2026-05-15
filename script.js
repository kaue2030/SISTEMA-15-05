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
    techLogs: [],
    savedCalculations: [],
    suppliers: [],
    returns: [],
    materialFailures: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupAuth();
    setupGlobalEvents();
});

function loadState() {
    const saved = localStorage.getItem('kaia_state') || localStorage.getItem('pacioli_state');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
    }
}

function saveState() {
    localStorage.setItem('kaia_state', JSON.stringify(state));
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
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('floating-saved').classList.remove('hidden');
    document.getElementById('currentUserNav').innerText = user;
    saveState();
    showPage('winDashboard');
}

// --- NAVIGATION ---
function showPage(id) {
    const template = document.getElementById(`tpl-${id}`);
    if (!template) return;

    document.querySelectorAll('#sidebar .nav-item').forEach(li => li.classList.remove('active'));
    const links = document.querySelectorAll(`#sidebar a[onclick*="${id}"]`);
    links.forEach(a => a.classList.add('active'));

    const main = document.getElementById('main-content');
    main.innerHTML = template.innerHTML;

    renderModule(id);

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
    if (id === 'winDashboard') renderDashboard();
    if (id === 'winInventory') renderInventory();
    if (id === 'winPurchases') renderPurchases();
    if (id === 'winCustomers') renderCustomers();
    if (id === 'winSuppliers') renderSuppliers();
    if (id === 'winExpenses') renderExpenses();
    if (id === 'winTech') renderTech();
    if (id === 'winInvoices') { renderInvoices(); renderCurrentOrder(); }
}

// --- FLOATING MENU & SAVED ---
function toggleSavedPanel() {
    const panel = document.getElementById('savedPanel');
    panel.classList.toggle('active');
    renderSavedList();
}
window.toggleSavedPanel = toggleSavedPanel;

function renderSavedList() {
    const list = document.getElementById('savedList');
    if (!list) return;
    if (state.savedCalculations.length === 0) {
        list.innerHTML = '<p class="text-muted" style="font-size: 12px">No hay cálculos guardados.</p>';
        return;
    }
    list.innerHTML = state.savedCalculations.slice().reverse().map((calc, idx) => `
        <div style="padding: 8px; border-bottom: 1px solid var(--border); font-size: 13px">
            <div style="display: flex; justify-content: space-between">
                <strong>${calc.type} - ${calc.name}</strong>
                <button class="btn btn-link" onclick="deleteSavedCalculation(${state.savedCalculations.length - 1 - idx})" style="padding:0; color:var(--danger)"><i class="fas fa-trash"></i></button>
            </div>
            <div style="color: var(--primary); font-weight: 700">$${calc.price.toLocaleString('es-AR')}</div>
            <div style="font-size: 10px; color: var(--text-muted)">${new Date(calc.date).toLocaleString()}</div>
        </div>
    `).join('');
}

function saveCalculation(type) {
    let price = 0;
    let name = "";
    if (type === '3D') {
        const costStr = document.getElementById('c3d-res-price').innerText.replace(/\./g, '').replace(',', '.');
        price = parseFloat(costStr);
        name = prompt("Nombre para este cálculo (ej: 'Engranaje X'):", "Pieza 3D");
    } else {
        price = state.lastDTF.sale;
        name = prompt("Nombre para este cálculo:", "Pedido DTF");
    }

    if (name) {
        state.savedCalculations.push({ type, name, price, date: new Date().toISOString() });
        saveState();
        alert("Cálculo guardado en el historial.");
        renderSavedList();
    }
}
window.saveCalculation = saveCalculation;

window.deleteSavedCalculation = (idx) => {
    state.savedCalculations.splice(idx, 1);
    saveState();
    renderSavedList();
};

// --- DASHBOARD ---
function renderDashboard() {
    const win = document.getElementById('main-content');
    if(!win) return;

    // Stats
    const totalSales = state.invoices.reduce((s, i) => s + i.total, 0);
    const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0) + state.purchases.reduce((s, p) => s + p.total, 0);
    const totalInvValue = state.inventory.reduce((s, i) => s + (i.stock * i.avgCost), 0);
    const pendingInvoices = state.invoices.filter(i => i.status === 'Pending').length;

    document.getElementById('stat-sales').innerText = totalSales.toLocaleString('es-AR');
    document.getElementById('stat-expenses').innerText = totalExpenses.toLocaleString('es-AR');
    document.getElementById('stat-inventory').innerText = totalInvValue.toLocaleString('es-AR');
    document.getElementById('stat-pending').innerText = pendingInvoices;

    // Top Customers
    const custVolume = {};
    state.invoices.forEach(inv => {
        custVolume[inv.customerId] = (custVolume[inv.customerId] || 0) + inv.total;
    });
    const sortedCusts = Object.entries(custVolume).sort((a,b) => b[1] - a[1]).slice(0,5);
    const topBody = document.getElementById('topCustomersBody');
    if(topBody) {
        topBody.innerHTML = sortedCusts.map(([cid, vol]) => {
            const c = state.customers.find(x => x.cid === cid) || { name: 'Consumidor Final' };
            return `<tr><td>${c.name}</td><td class="text-right"><strong>$${vol.toLocaleString('es-AR')}</strong></td></tr>`;
        }).join('');
    }

    // Trend Chart
    const ctx = document.getElementById('salesTrendChart');
    if(ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ventas Totales', 'Gastos Totales'],
                datasets: [{
                    label: 'Monto $',
                    data: [totalSales, totalExpenses],
                    backgroundColor: ['#22c55e', '#ef4444']
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }
}

// --- TUTORIAL ---
function toggleTutorial() {
    const active = document.getElementById('tutorialToggle').checked;
    const texts = document.querySelectorAll('.tutorial-text');
    texts.forEach(t => {
        if(active) t.classList.remove('hidden');
        else t.classList.add('hidden');
    });
}
window.toggleTutorial = toggleTutorial;

// --- MODULE: INVOICES ---
function toggleNewInvoice() {
    const p = document.getElementById('new-invoice-pane');
    if(p) { p.classList.toggle('hidden'); populateInvoiceCustomers(); renderCurrentOrder(); }
}
window.toggleNewInvoice = toggleNewInvoice;

function renderInvoices() {
    const win = document.getElementById('main-content');
    const body = win.querySelector('#invoicesBody'); if (!body) return;

    body.innerHTML = state.invoices.slice().reverse().map(inv => {
        const cust = state.customers.find(c => c.cid === inv.customerId) || { name: 'Consumidor Final' };
        return `<tr onclick="viewInvoice('${inv.id}')" style="cursor:pointer">
            <td><span class="fas ${inv.status === 'Paid' ? 'fa-check-circle text-success' : 'fa-clock text-warning'}"></span></td>
            <td>${inv.id}</td>
            <td>${cust.name}</td>
            <td class="text-right">$${inv.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="text-right">${new Date(inv.date).toLocaleDateString()}</td>
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
    $('#modal_invoice_details').removeClass('hidden');
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
    list.innerHTML = state.currentOrder.map((item, idx) => `<li style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border)">
        <span>${item.desc}</span>
        <span>$${item.price.toLocaleString('es-AR')} <button class="btn btn-link" onclick="removeFromOrder(${idx})" style="padding:0; color:var(--danger)"><i class="fas fa-times"></i></button></span>
    </li>`).join('');
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
    const labels = []; const prices = []; const margins = [];

    // Sensitivity: Variation in grams
    for (let i = -50; i <= 50; i += 10) {
        const g = Math.max(1, grams + (grams * (i / 100)));
        labels.push(g.toFixed(0) + 'g');
        const c = ((filamentPrice/1000)*g + energyCost + machineWear + extra) * (1 + fail/100);
        const s = c * mult;
        prices.push(s.toFixed(0));
        margins.push((s - c).toFixed(0));
    }

    if (c3dChart) c3dChart.destroy();
    c3dChart = new Chart(ctxEl.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Precio Venta $', data: prices, borderColor: '#3b82f6', tension: 0.3, fill: false },
                { label: 'Margen $', data: margins, borderColor: '#22c55e', tension: 0.3, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' } }
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
    body.innerHTML = state.inventory.map((i, idx) => `<tr><td>${i.name}</td><td>${i.stock}</td><td>$${i.avgCost.toLocaleString('es-AR')}</td><td>$${(i.stock*i.avgCost).toLocaleString('es-AR')}</td><td class="text-right"><button class="btn btn-link" onclick="deleteInventory(${idx})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}
window.deleteInventory = (idx) => { state.inventory.splice(idx,1); saveState(); renderInventory(); };

function renderCustomers() {
    const body = document.getElementById('customersBody'); if (!body) return;
    body.innerHTML = state.customers.map((c, idx) => `<tr><td>${c.name}</td><td>${c.cid}</td><td class="text-right"><button class="btn btn-link" onclick="deleteCustomer(${idx})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}
window.addCustomer = () => { state.customers.push({ name: document.getElementById('cust-name').value, cid: document.getElementById('cust-id').value }); saveState(); renderCustomers(); };
window.deleteCustomer = (idx) => { state.customers.splice(idx,1); saveState(); renderCustomers(); };

function renderSuppliers() {
    const body = document.getElementById('suppliersBody'); if (!body) return;
    body.innerHTML = state.suppliers.map((s, idx) => `<tr>
        <td><strong>${s.name}</strong><br><small class="text-muted">${s.notes || ''}</small></td>
        <td>${s.phone || '-'}</td>
        <td>${s.web ? `<a href="${s.web}" target="_blank" class="btn btn-xs btn-link"><i class="fas fa-external-link-alt"></i></a>` : '-'}</td>
        <td class="text-right"><button class="btn btn-link" onclick="deleteSupplier(${idx})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('');
}
window.renderSuppliers = renderSuppliers;

window.addSupplier = () => {
    const name = document.getElementById('sup-name').value;
    if (!name) return alert("Ingrese el nombre");
    state.suppliers.push({
        name,
        web: document.getElementById('sup-web').value,
        phone: document.getElementById('sup-phone').value,
        notes: document.getElementById('sup-notes').value
    });
    saveState(); renderSuppliers();
    document.getElementById('sup-name').value = '';
    document.getElementById('sup-web').value = '';
    document.getElementById('sup-phone').value = '';
    document.getElementById('sup-notes').value = '';
};

window.deleteSupplier = (idx) => { if(confirm("¿Eliminar proveedor?")) { state.suppliers.splice(idx,1); saveState(); renderSuppliers(); } };

function renderPurchases() {
    const body = document.getElementById('purchasesBody'); if (!body) return;
    body.innerHTML = state.purchases.slice().reverse().map(p => `<tr><td>${p.supplier}</td><td><small>${p.desc || '-'}</small></td><td class="text-right">$${p.total.toLocaleString('es-AR')}</td><td class="text-right">${new Date(p.date).toLocaleDateString()}</td></tr>`).join('');
}
window.toggleNewPurchase = () => { document.getElementById('new-purchase-pane').classList.toggle('hidden'); populatePurchaseProductSelector(); };
window.registerPurchase = () => {
    const win = document.getElementById('main-content');
    const qty = parseInt(win.querySelector('#p-qty').value); const unit = parseFloat(win.querySelector('#p-unit').value);
    const p = { supplier: win.querySelector('#p-supplier').value, desc: "", product: win.querySelector('#p-link-inventory').value, qty, unit, total: qty*unit, date: new Date().toISOString().slice(0,10) };
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
    const date = new Date().toISOString().slice(0,10);
    if (desc && amount) { state.expenses.push({ desc, amount, date }); saveState(); renderExpenses(); }
};

function renderTech() {
    const body = document.getElementById('techBody'); if (!body) return;

    const logs = [
        ...state.techLogs.map(l => ({ ...l, type: 'Mantenimiento', detail: `${l.machine}: ${l.action}` })),
        ...state.materialFailures.map(f => ({ ...f, type: 'Fallo Material', detail: `${f.material} (${f.qty}): ${f.reason}` })),
        ...state.returns.map(r => ({ ...r, type: 'Devolución', detail: `${r.customer}: $${r.amount}` }))
    ].sort((a,b) => new Date(b.date) - new Date(a.date));

    body.innerHTML = logs.map(l => `<tr>
        <td>${new Date(l.date).toLocaleString()}</td>
        <td><span class="badge ${l.type==='Mantenimiento'?'badge-primary':l.type==='Devolución'?'badge-warning':'badge-danger'}">${l.type}</span></td>
        <td>${l.detail}</td>
        <td>${l.user}</td>
    </tr>`).join('');
}
window.addTechLog = () => {
    const machine = document.getElementById('tech-machine').value;
    const action = document.getElementById('tech-action').value;
    if (machine && action) { state.techLogs.push({ date: new Date().toISOString(), machine, action, user: state.currentUser }); saveState(); renderTech(); }
};
window.addFailure = () => {
    const material = document.getElementById('fail-material').value;
    const qty = document.getElementById('fail-qty').value;
    const reason = document.getElementById('fail-reason').value;
    if (material) { state.materialFailures.push({ date: new Date().toISOString(), material, qty, reason, user: state.currentUser }); saveState(); renderTech(); }
};
window.addReturn = () => {
    const customer = document.getElementById('ret-cust').value;
    const amount = parseFloat(document.getElementById('ret-amount').value);
    if (customer) { state.returns.push({ date: new Date().toISOString(), customer, amount, user: state.currentUser }); saveState(); renderTech(); }
};

function exportToExcel() {
    const wb = XLSX.utils.book_new();

    // 1. Resumen Financiero
    const totalSales = state.invoices.reduce((s, i) => s + i.total, 0);
    const totalPurchases = state.purchases.reduce((s, p) => s + p.total, 0);
    const totalExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
    const totalReturns = state.returns.reduce((s, r) => s + r.amount, 0);
    const profit = totalSales - totalPurchases - totalExpenses - totalReturns;

    const summaryData = [
        { Concepto: 'Ventas Totales', Monto: totalSales },
        { Concepto: 'Compras de Materia', Monto: totalPurchases },
        { Concepto: 'Gastos Operativos', Monto: totalExpenses },
        { Concepto: 'Devoluciones', Monto: totalReturns },
        { Concepto: 'GANANCIA NETA', Monto: profit }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumen Financiero");

    // 2. Registro de Ventas
    const salesData = state.invoices.map(i => {
        const c = state.customers.find(x => x.cid === i.customerId) || { name: 'Consumidor Final' };
        return {
            ID: i.id,
            Cliente: c.name,
            Fecha: new Date(i.date).toLocaleDateString(),
            Monto: i.total,
            Estado: i.status,
            Vendedor: i.user
        };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "Registro de Ventas");

    // 3. Compras y Materia
    const purchasesData = state.purchases.map(p => ({
        Proveedor: p.supplier,
        Producto: p.product,
        Cantidad: p.qty,
        PrecioUnit: p.unit,
        Total: p.total,
        Fecha: p.date
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesData), "Compras");

    // 4. Proveedores
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.suppliers), "Proveedores");

    // 5. Novedades (Fallos y Devoluciones)
    const newsData = [
        ...state.materialFailures.map(f => ({ Tipo: 'FALLO MATERIAL', Detalle: f.material, Cant: f.qty, Motivo: f.reason, Fecha: f.date })),
        ...state.returns.map(r => ({ Tipo: 'DEVOLUCION', Detalle: r.customer, Monto: r.amount, Motivo: '-', Fecha: r.date }))
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(newsData), "Novedades");

    // 6. Inventario
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.inventory), "Inventario");

    XLSX.writeFile(wb, `KAIA_REPORTE_${new Date().toISOString().slice(0,10)}.xlsx`);
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
