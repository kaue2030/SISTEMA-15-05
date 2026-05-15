document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', calculate);
    });

    // Toggle Menu
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('menuContent').classList.toggle('hidden');
    });

    // Modals
    const modalManual = document.getElementById('modalManual');
    const modalList = document.getElementById('modalList');

    document.getElementById('btnManual').addEventListener('click', () => {
        showManual();
        modalManual.classList.remove('hidden');
    });

    document.getElementById('btnSave').addEventListener('click', saveCalculation);
    document.getElementById('btnList').addEventListener('click', () => {
        renderSavedList();
        modalList.classList.remove('hidden');
    });

    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    // Initial Calculation
    calculate();
});

function calculate() {
    // Inputs
    const consumption = parseFloat(document.getElementById('consumption').value) || 0;
    const machinePrice = parseFloat(document.getElementById('machinePrice').value) || 0;
    const lifespan = parseFloat(document.getElementById('lifespan').value) || 1;
    const filamentPrice = parseFloat(document.getElementById('filamentPrice').value) || 0;
    const kwhPrice = parseFloat(document.getElementById('kwhPrice').value) || 0;
    const errorMargin = parseFloat(document.getElementById('errorMargin').value) || 0;
    const failureRate = parseFloat(document.getElementById('failureRate').value) || 0;
    const hours = parseFloat(document.getElementById('hours').value) || 0;
    const minutes = parseFloat(document.getElementById('minutes').value) || 0;
    const grams = parseFloat(document.getElementById('grams').value) || 0;
    const extraInsumos = parseFloat(document.getElementById('extraInsumos').value) || 0;
    const multiplier = parseFloat(document.getElementById('multiplier').value) || 1;

    const totalTimeHours = hours + (minutes / 60);

    // Formulas
    const costMaterial = (filamentPrice / 1000) * grams;
    const costLight = (consumption / 1000) * totalTimeHours * kwhPrice;
    const costWear = (machinePrice / lifespan) * totalTimeHours;

    let subTotal = costMaterial + costLight + costWear + extraInsumos;

    // Applying Error Margin and Failure Rate
    const totalMargin = (errorMargin + failureRate) / 100;
    const totalCost = subTotal * (1 + totalMargin);

    const toCharge = totalCost * multiplier;

    // MercadoLibre Price (Assuming 14% commission, formula: price = net / (1 - comm))
    const mlPrice = toCharge / (1 - 0.14);

    // Display Results
    document.getElementById('resMaterial').innerText = `$ ${costMaterial.toFixed(2)}`;
    document.getElementById('resLight').innerText = `$ ${costLight.toFixed(2)}`;
    document.getElementById('resWear').innerText = `$ ${costWear.toFixed(2)}`;
    document.getElementById('resTotalCost').innerText = `$ ${totalCost.toFixed(2)}`;
    document.getElementById('resToCharge').innerText = `$ ${toCharge.toFixed(2)}`;
    document.getElementById('resMLPrice').innerText = `$ ${mlPrice.toFixed(2)}`;

    updateCharts(grams, totalTimeHours, multiplier, filamentPrice, consumption, kwhPrice, machinePrice, lifespan, extraInsumos, errorMargin, failureRate);
}

let weightChart = null;
let timeChart = null;

function updateCharts(baseGrams, baseHours, multiplier, filP, cons, kwhP, mP, life, extra, err, fail) {
    const weightCtx = document.getElementById('weightChart').getContext('2d');
    const timeCtx = document.getElementById('timeChart').getContext('2d');

    // Weight Sensitivity
    const wLabels = [];
    const wPrices = [];
    const wProfits = [];
    for (let i = 5; i <= 15; i++) {
        const factor = i / 10;
        const testGrams = baseGrams * factor;
        wLabels.push(`${testGrams.toFixed(0)}g`);
        const { tCharge, profit } = getResults(testGrams, baseHours, multiplier, filP, cons, kwhP, mP, life, extra, err, fail);
        wPrices.push(tCharge);
        wProfits.push(profit);
    }

    // Time Sensitivity
    const tLabels = [];
    const tPrices = [];
    const tProfits = [];
    for (let i = 5; i <= 15; i++) {
        const factor = i / 10;
        const testHours = baseHours * factor;
        tLabels.push(`${testHours.toFixed(1)}h`);
        const { tCharge, profit } = getResults(baseGrams, testHours, multiplier, filP, cons, kwhP, mP, life, extra, err, fail);
        tPrices.push(tCharge);
        tProfits.push(profit);
    }

    if (weightChart) weightChart.destroy();
    if (timeChart) timeChart.destroy();

    weightChart = createChart(weightCtx, 'Sensibilidad por Peso (Gramos)', wLabels, wPrices, wProfits);
    timeChart = createChart(timeCtx, 'Sensibilidad por Tiempo (Horas)', tLabels, tPrices, tProfits);
}

function getResults(g, h, m, filP, cons, kwhP, mP, life, extra, err, fail) {
    const cMat = (filP / 1000) * g;
    const cLight = (cons / 1000) * h * kwhP;
    const cWear = (mP / life) * h;
    const tCost = (cMat + cLight + cWear + extra) * (1 + (err + fail)/100);
    const tCharge = tCost * m;
    return {
        tCharge: parseFloat(tCharge.toFixed(2)),
        profit: parseFloat((tCharge - tCost).toFixed(2))
    };
}

function createChart(ctx, title, labels, prices, profits) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Precio ($)',
                data: prices,
                borderColor: '#3498db',
                tension: 0.1
            }, {
                label: 'Ganancia ($)',
                data: profits,
                borderColor: '#27ae60',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: title } }
        }
    });
}

function saveCalculation() {
    const name = document.getElementById('printerName').value + ' - ' + new Date().toLocaleTimeString();
    const data = {};
    document.querySelectorAll('input').forEach(input => data[input.id] = input.value);

    let saved = JSON.parse(localStorage.getItem('calculations') || '[]');
    saved.push({ name, data });
    localStorage.setItem('calculations', JSON.stringify(saved));
    alert('Cálculo guardado con éxito');
}

function renderSavedList() {
    const list = document.getElementById('savedList');
    list.innerHTML = '';
    const saved = JSON.parse(localStorage.getItem('calculations') || '[]');

    saved.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.cssText = "margin: 10px 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 5px;";

        const span = document.createElement('span');
        span.innerText = item.name;

        const btnGroup = document.createElement('div');
        const loadBtn = document.createElement('button');
        loadBtn.innerText = 'Cargar';
        loadBtn.onclick = () => { loadCalculation(item.data); document.getElementById('modalList').classList.add('hidden'); };

        const delBtn = document.createElement('button');
        delBtn.innerText = 'Eliminar';
        delBtn.onclick = () => { saved.splice(index, 1); localStorage.setItem('calculations', JSON.stringify(saved)); renderSavedList(); };

        btnGroup.appendChild(loadBtn);
        btnGroup.appendChild(delBtn);
        li.appendChild(span);
        li.appendChild(btnGroup);
        list.appendChild(li);
    });
}

function loadCalculation(data) {
    Object.keys(data).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.value = data[key];
    });
    calculate();
}

function showManual() {
    document.getElementById('manualContent').innerHTML = `
        <h2>Manual de la Calculadora 3D</h2>
        <p>Esta herramienta te ayuda a profesionalizar tu negocio de impresión 3D calculando costos reales y márgenes de ganancia.</p>

        <h3>1. Perfil de Impresora</h3>
        <p>Define los costos operativos de tu máquina:</p>
        <ul>
            <li><strong>Consumo (Watts):</strong> Potencia promedio de la impresora (ej. 120W para Ender 3).</li>
            <li><strong>Precio Máquina:</strong> Cuánto te costó la impresora.</li>
            <li><strong>Vida Útil:</strong> Horas estimadas antes de necesitar un reemplazo o mantenimiento mayor (estándar: 10,000h).</li>
        </ul>

        <h3>2. Gastos Fijos e Insumos</h3>
        <ul>
            <li><strong>Precio Filamento:</strong> Costo por 1kg de material.</li>
            <li><strong>Tasa de Fallos:</strong> % extra para cubrir piezas que salen mal o fallos de luz.</li>
            <li><strong>Margen de Error:</strong> % para insumos invisibles (laca, limpieza, desgaste menor).</li>
        </ul>

        <h3>3. Fórmulas de Cálculo</h3>
        <p>La calculadora utiliza las siguientes lógicas:</p>
        <ul>
            <li><strong>Costo Luz:</strong> (Watts / 1000) × Horas × Precio kWh</li>
            <li><strong>Desgaste:</strong> (Precio Máquina / Vida Útil) × Horas</li>
            <li><strong>Costo Material:</strong> (Precio Filamento / 1000) × Gramos</li>
        </ul>

        <h3>4. Transformación a Precio de Venta</h3>
        <p>El <strong>Costo Total</strong> se multiplica por tu <strong>Multiplicador</strong> de ganancia.
        Si el costo es $100 y usas un multiplicador de 3, el precio base es $300.</p>
        <p><strong>Precio MercadoLibre:</strong> Se calcula automáticamente sumando una comisión estimada del 14% para que recibas tu ganancia neta deseada.</p>
    `;
}
