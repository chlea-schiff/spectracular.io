// pipeline-interactive.js - Interactive pipeline builder with data loading

import { downloadFile } from './utils.js';

let appState = null;
let eegData = [];
let timestamps = [];
let samplingRate = 250;
let filters = [];
let rawChart, filteredChart;
let zoomState = { raw: { start: 0, end: 1 }, filtered: { start: 0, end: 1 } };
let draggedIndex = null;
let scaleState = { 
    raw: { yMin: -1000, yMax: 1000, xMin: 0, xMax: 100, autoY: true }, 
    filtered: { yMin: -1000, yMax: 1000, xMin: 0, xMax: 100, autoY: true } 
};
let convertTimestamps = false;

const filterConfigs = {
    butterworth_lowpass: { params: ['cutoff', 'order'], defaults: { cutoff: 50, order: 4 } },
    butterworth_highpass: { params: ['cutoff', 'order'], defaults: { cutoff: 1, order: 4 } },
    butterworth_bandpass: { params: ['low', 'high', 'order'], defaults: { low: 1, high: 50, order: 4 } },
    butterworth_bandstop: { params: ['low', 'high', 'order'], defaults: { low: 45, high: 55, order: 4 } },
    savgol: { params: ['window', 'polyorder'], defaults: { window: 11, polyorder: 3 } },
    median: { params: ['kernel'], defaults: { kernel: 5 } },
    notch: { params: ['frequency', 'quality'], defaults: { frequency: 50, quality: 30 } },
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
    loadPersistedState();
    if (appState) {
        initWithLoadedData();
    } else {
        initDemoData();
    }
});

function loadAppState() {
    const savedState = sessionStorage.getItem('appState');
    if (savedState) {
        appState = JSON.parse(savedState);
        return true;
    }
    return false;
}

function loadPersistedState() {
    // Load persisted filters and settings
    const persistedFilters = sessionStorage.getItem('pipelineFilters');
    if (persistedFilters) {
        filters = JSON.parse(persistedFilters);
    }
    
    const persistedScale = sessionStorage.getItem('pipelineScale');
    if (persistedScale) {
        scaleState = JSON.parse(persistedScale);
    }
    
    const persistedConvert = sessionStorage.getItem('convertTimestamps');
    if (persistedConvert) {
        convertTimestamps = JSON.parse(persistedConvert);
    }
}

function savePersistedState() {
    // Save current state for persistence across tabs
    sessionStorage.setItem('pipelineFilters', JSON.stringify(filters));
    sessionStorage.setItem('pipelineScale', JSON.stringify(scaleState));
    sessionStorage.setItem('convertTimestamps', JSON.stringify(convertTimestamps));
}

function initWithLoadedData() {
    // Extract signal data from loaded file
    const timestampCol = appState.selectedTimestamp;
    const firstChannel = appState.selectedChannels[0];
    
    eegData = [];
    timestamps = [];
    appState.parsedData.forEach(row => {
        const t = parseFloat(row[timestampCol]);
        const v = parseFloat(row[firstChannel]);
        if (!isNaN(t) && !isNaN(v)) {
            timestamps.push(t);
            eegData.push(v);
        }
    });
    
    samplingRate = appState.samplingRate;
    
    // Initialize scale state based on actual data
    const dataMin = Math.min(...eegData);
    const dataMax = Math.max(...eegData);
    const dataRange = dataMax - dataMin;
    const padding = dataRange * 0.1;
    
    scaleState.raw.yMin = dataMin - padding;
    scaleState.raw.yMax = dataMax + padding;
    scaleState.filtered.yMin = dataMin - padding;
    scaleState.filtered.yMax = dataMax + padding;
    scaleState.raw.xMin = 0;
    scaleState.raw.xMax = eegData.length;
    scaleState.filtered.xMin = 0;
    scaleState.filtered.xMax = eegData.length;
    
    // Update input fields with new defaults
    document.getElementById('rawYMin').value = scaleState.raw.yMin.toFixed(2);
    document.getElementById('rawYMax').value = scaleState.raw.yMax.toFixed(2);
    document.getElementById('filtYMin').value = scaleState.filtered.yMin.toFixed(2);
    document.getElementById('filtYMax').value = scaleState.filtered.yMax.toFixed(2);
    document.getElementById('rawAutoY').checked = scaleState.raw.autoY;
    document.getElementById('filtAutoY').checked = scaleState.filtered.autoY;
    document.getElementById('rawXMin').value = scaleState.raw.xMin;
    document.getElementById('rawXMax').value = scaleState.raw.xMax;
    document.getElementById('filtXMin').value = scaleState.filtered.xMin;
    document.getElementById('filtXMax').value = scaleState.filtered.xMax;
    
    initCharts();
    updatePlots();
}

// Initialize with demo data (fallback)
function initDemoData() {
    const duration = 10; // seconds
    const sampleCount = duration * samplingRate;
    eegData = [];
    
    for (let i = 0; i < sampleCount; i++) {
        const t = i / samplingRate;
        // Generate synthetic EEG-like signal with noise
        const signal = Math.sin(2 * Math.PI * 10 * t) + 
                      0.5 * Math.sin(2 * Math.PI * 25 * t) + 
                      0.3 * Math.sin(2 * Math.PI * 50 * t) + 
                      (Math.random() - 0.5) * 0.5;
        eegData.push(signal);
    }
    
    // Initialize scale state based on actual data
    const dataMin = Math.min(...eegData);
    const dataMax = Math.max(...eegData);
    const dataRange = dataMax - dataMin;
    const padding = dataRange * 0.1;
    
    scaleState.raw.yMin = dataMin - padding;
    scaleState.raw.yMax = dataMax + padding;
    scaleState.filtered.yMin = dataMin - padding;
    scaleState.filtered.yMax = dataMax + padding;
    scaleState.raw.xMin = 0;
    scaleState.raw.xMax = eegData.length;
    scaleState.filtered.xMin = 0;
    scaleState.filtered.xMax = eegData.length;
    
    // Update input fields with new defaults
    document.getElementById('rawYMin').value = scaleState.raw.yMin.toFixed(2);
    document.getElementById('rawYMax').value = scaleState.raw.yMax.toFixed(2);
    document.getElementById('filtYMin').value = scaleState.filtered.yMin.toFixed(2);
    document.getElementById('filtYMax').value = scaleState.filtered.yMax.toFixed(2);
    document.getElementById('rawAutoY').checked = scaleState.raw.autoY;
    document.getElementById('filtAutoY').checked = scaleState.filtered.autoY;
    document.getElementById('rawXMin').value = scaleState.raw.xMin;
    document.getElementById('rawXMax').value = scaleState.raw.xMax;
    document.getElementById('filtXMin').value = scaleState.filtered.xMin;
    document.getElementById('filtXMax').value = scaleState.filtered.xMax;
    
    initCharts();
    updatePlots();
}

function initCharts() {
    const ctx1 = document.getElementById('rawChart').getContext('2d');
    const ctx2 = document.getElementById('filteredChart').getContext('2d');

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: { 
            legend: { display: false },
            filler: { propagate: false }
        },
        scales: {
            x: { display: true, type: 'linear' },
            y: { 
                display: true,
                beginAtZero: false
            }
        }
    };

    rawChart = new Chart(ctx1, {
        type: 'line',
        data: { 
            labels: [],
            datasets: [{ 
                label: 'Raw',  
                data: [],
                borderColor: '#14786e', 
                tension: 0, 
                borderWidth: 1, 
                pointRadius: 0,
                fill: false,
                parsing: false
            }] 
        },
        options: chartOptions
    });

    filteredChart = new Chart(ctx2, {
        type: 'line',
        data: { 
            labels: [],
            datasets: [{ 
                label: 'Filtered', 
                data: [],
                borderColor: '#00ff00', 
                tension: 0, 
                borderWidth: 1, 
                pointRadius: 0,
                fill: false,
                parsing: false
            }] 
        },
        options: chartOptions
    });
}

function getVisibleRange(type) {
    const zoom = zoomState[type];
    const total = eegData.length;
    return [Math.floor(zoom.start * total), Math.floor(zoom.end * total)];
}

function updatePlots() {
    const [rawStart, rawEnd] = getVisibleRange('raw');
    const [filtStart, filtEnd] = getVisibleRange('filtered');

    const rawSlice = eegData.slice(rawStart, rawEnd);
    const filteredSlice = applyFilters(eegData).slice(filtStart, filtEnd);
    const rawTimeSlice = timestamps.slice(rawStart, rawEnd);
    const filtTimeSlice = timestamps.slice(filtStart, filtEnd);

    // Convert timestamps if requested
    let rawXData = rawTimeSlice;
    let filtXData = filtTimeSlice;
    if (convertTimestamps) {
        rawXData = rawTimeSlice.map(t => new Date(t * 1000).toLocaleString());
        filtXData = filtTimeSlice.map(t => new Date(t * 1000).toLocaleString());
    }

    const rawPoints = Array.from({ length: rawSlice.length }, (_, i) => ({ x: rawXData[i], y: rawSlice[i] }));
    const filtPoints = Array.from({ length: filteredSlice.length }, (_, i) => ({ x: filtXData[i], y: filteredSlice[i] }));

    // Auto Y for raw
    if (scaleState.raw.autoY && rawSlice.length > 0) {
        const minY = Math.min(...rawSlice);
        const maxY = Math.max(...rawSlice);
        const pad = (maxY - minY || 1) * 0.1;
        scaleState.raw.yMin = minY - pad;
        scaleState.raw.yMax = maxY + pad;
        document.getElementById('rawYMin').value = scaleState.raw.yMin.toFixed(2);
        document.getElementById('rawYMax').value = scaleState.raw.yMax.toFixed(2);
    }

    // Update raw chart
    rawChart.data.labels = [];
    rawChart.data.datasets[0].data = rawPoints;
    rawChart.options.scales.y.min = scaleState.raw.yMin;
    rawChart.options.scales.y.max = scaleState.raw.yMax;
    rawChart.options.scales.x.min = scaleState.raw.xMin;
    rawChart.options.scales.x.max = scaleState.raw.xMax;
    rawChart.update('none');

    // Auto Y for filtered
    if (scaleState.filtered.autoY && filteredSlice.length > 0) {
        const minY = Math.min(...filteredSlice);
        const maxY = Math.max(...filteredSlice);
        const pad = (maxY - minY || 1) * 0.1;
        scaleState.filtered.yMin = minY - pad;
        scaleState.filtered.yMax = maxY + pad;
        document.getElementById('filtYMin').value = scaleState.filtered.yMin.toFixed(2);
        document.getElementById('filtYMax').value = scaleState.filtered.yMax.toFixed(2);
    }

    // Update filtered chart
    filteredChart.data.labels = [];
    filteredChart.data.datasets[0].data = filtPoints;
    filteredChart.options.scales.y.min = scaleState.filtered.yMin;
    filteredChart.options.scales.y.max = scaleState.filtered.yMax;
    filteredChart.options.scales.x.min = scaleState.filtered.xMin;
    filteredChart.options.scales.x.max = scaleState.filtered.xMax;
    filteredChart.update('none');
}

function applyFilters(signal) {
    let result = signal.slice();
    for (const filter of filters) {
        result = applyFilter(result, filter);
    }
    return result;
}

function applyFilter(signal, filterObj) {
    try {
        const params = filterObj.params;

        switch (filterObj.type) {
            case 'butterworth_lowpass':
                return applySimpleFilter(signal, params.cutoff / (samplingRate / 2), params.order, 'low');
            case 'butterworth_highpass':
                return applySimpleFilter(signal, params.cutoff / (samplingRate / 2), params.order, 'high');
            case 'butterworth_bandpass':
                return applyBandpass(signal, params.low / (samplingRate / 2), params.high / (samplingRate / 2));
            case 'butterworth_bandstop':
                return applyBandstop(signal, params.low / (samplingRate / 2), params.high / (samplingRate / 2));
            case 'savgol':
                return applySavgol(signal, params.window, params.polyorder);
            case 'median':
                return applyMedian(signal, params.kernel);
            case 'notch':
                return applyNotch(signal, params.frequency, params.quality);
            default:
                return signal;
        }
    } catch (e) {
        console.error('Filter error:', e);
        return signal;
    }
}

function applySimpleFilter(signal, normalized_freq, order, type) {
    const result = signal.slice();
    const alpha = Math.min(0.9, normalized_freq);
    for (let i = 1; i < result.length; i++) {
        result[i] = alpha * result[i] + (1 - alpha) * result[i - 1];
    }
    return result;
}

function medianOf(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function applyBandpass(signal, low, high) {
    let result = signal.slice();
    const alphaLP = Math.min(0.99, high);
    const alphaHP = Math.min(0.99, low);

    for (let i = 1; i < result.length; i++) {
        result[i] = alphaLP * result[i] + (1 - alphaLP) * result[i - 1];
    }
    let hp = new Array(result.length).fill(0);
    hp[0] = 0;
    for (let i = 1; i < result.length; i++) {
        const sm = alphaHP * result[i] + (1 - alphaHP) * result[i - 1];
        hp[i] = result[i] - sm;
    }
    const med = medianOf(hp);
    for (let i = 0; i < hp.length; i++) hp[i] -= med;
    return hp;
}

function applyBandstop(signal, low, high) {
    return signal.slice();
}

function applySavgol(signal, window, polyorder) {
    const result = signal.slice();
    const half = Math.floor(window / 2);
    for (let i = half; i < result.length - half; i++) {
        let sum = 0;
        for (let j = i - half; j <= i + half; j++) sum += result[j];
        result[i] = sum / window;
    }
    return result;
}

function applyMedian(signal, kernel) {
    const result = signal.slice();
    const half = Math.floor(kernel / 2);
    for (let i = half; i < result.length - half; i++) {
        const window = result.slice(i - half, i + half + 1).sort((a, b) => a - b);
        result[i] = window[Math.floor(window.length / 2)];
    }
    return result;
}

function applyNotch(signal, freq, quality) {
    const result = signal.slice();
    const w0 = 2 * Math.PI * freq / samplingRate;
    const alpha = Math.sin(w0) / (2 * quality);
    const b0 = 1, b1 = -2 * Math.cos(w0), b2 = 1;
    const a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;

    for (let i = 2; i < result.length; i++) {
        result[i] = (b0 * signal[i] + b1 * signal[i-1] + b2 * signal[i-2] - a1 * result[i-1] - a2 * result[i-2]) / a0;
    }
    return result;
}

function addFilter() {
    const select = document.getElementById('filterSelect');
    if (!select.value) return;

    const config = filterConfigs[select.value];
    const filter = {
        type: select.value,
        name: select.options[select.selectedIndex].text,
        params: { ...config.defaults }
    };

    filters.push(filter);
    select.value = '';
    renderFilters();
    updatePlots();
    savePersistedState();
}

function removeFilter(idx) {
    filters.splice(idx, 1);
    renderFilters();
    updatePlots();
    savePersistedState();
}

function toggleTimestampConversion() {
    convertTimestamps = document.getElementById('convertTimestamps').checked;
    updatePlots();
    savePersistedState();
}

function renderFilters() {
    const list = document.getElementById('filterList');
    list.innerHTML = '';

    filters.forEach((f, idx) => {
        const div = document.createElement('div');
        div.className = 'filter-item';
        div.draggable = true;
        div.innerHTML = `
            <div class="filter-item-header">
                <span>${f.name}</span>
                <button class="filter-remove" onclick="removeFilter(${idx})">Remove</button>
            </div>
            <div class="filter-params" id="params-${idx}"></div>
        `;
        list.appendChild(div);

        const paramsDiv = document.getElementById(`params-${idx}`);
        const config = filterConfigs[f.type];
        config.params.forEach(p => {
            const val = f.params[p];
            const control = document.createElement('div');
            control.className = 'param-control';
            control.innerHTML = `
                <label>${p}: <span id="val-${idx}-${p}">${val.toFixed(2)}</span></label>
                <input type="range" min="0.1" max="200" step="0.1" value="${val}" 
                    oninput="updateParam(${idx}, '${p}', this.value)">
            `;
            paramsDiv.appendChild(control);
        });

        div.addEventListener('dragstart', (e) => {
            draggedIndex = idx;
            e.dataTransfer.effectAllowed = 'move';
        });
        div.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedIndex !== null && draggedIndex !== idx) {
                [filters[draggedIndex], filters[idx]] = [filters[idx], filters[draggedIndex]];
                renderFilters();
                updatePlots();
            }
            draggedIndex = null;
        });
        div.addEventListener('dragend', () => {
            draggedIndex = null;
        });
    });
}

function updateParam(idx, param, value) {
    filters[idx].params[param] = parseFloat(value);
    document.getElementById(`val-${idx}-${param}`).textContent = parseFloat(value).toFixed(2);
    updatePlots();
    savePersistedState();
}

function zoomChart(type, action) {
    const zoom = zoomState[type];
    const range = zoom.end - zoom.start;

    switch (action) {
        case 'in':
            zoom.start += range * 0.2;
            zoom.end -= range * 0.2;
            break;
        case 'out':
            zoom.start = Math.max(0, zoom.start - range * 0.2);
            zoom.end = Math.min(1, zoom.end + range * 0.2);
            break;
        case 'reset':
            zoom.start = 0;
            zoom.end = 1;
    }
    updatePlots();
}

function updateScale(type) {
    const yMin = parseFloat(document.getElementById(type === 'raw' ? 'rawYMin' : 'filtYMin').value);
    const yMax = parseFloat(document.getElementById(type === 'raw' ? 'rawYMax' : 'filtYMax').value);
    const xMin = parseFloat(document.getElementById(type === 'raw' ? 'rawXMin' : 'filtXMin').value);
    const xMax = parseFloat(document.getElementById(type === 'raw' ? 'rawXMax' : 'filtXMax').value);

    scaleState[type].yMin = yMin;
    scaleState[type].yMax = yMax;
    scaleState[type].xMin = xMin;
    scaleState[type].xMax = xMax;

    scaleState.raw.xMin = xMin;
    scaleState.raw.xMax = xMax;
    scaleState.filtered.xMin = xMin;
    scaleState.filtered.xMax = xMax;

    document.getElementById('rawXMin').value = xMin;
    document.getElementById('rawXMax').value = xMax;
    document.getElementById('filtXMin').value = xMin;
    document.getElementById('filtXMax').value = xMax;

    updatePlots();
    savePersistedState();
}

function toggleAutoY(type) {
    const checked = document.getElementById(type === 'raw' ? 'rawAutoY' : 'filtAutoY').checked;
    scaleState[type].autoY = checked;
    updatePlots();
    savePersistedState();
}

function applyLimits(type) {
    const yMinEl = document.getElementById(type === 'raw' ? 'rawYMin' : 'filtYMin');
    const yMaxEl = document.getElementById(type === 'raw' ? 'rawYMax' : 'filtYMax');
    const xMinEl = document.getElementById(type === 'raw' ? 'rawXMin' : 'filtXMin');
    const xMaxEl = document.getElementById(type === 'raw' ? 'rawXMax' : 'filtXMax');

    let yMin = parseFloat(yMinEl.value);
    let yMax = parseFloat(yMaxEl.value);
    let xMin = parseFloat(xMinEl.value);
    let xMax = parseFloat(xMaxEl.value);

    const hasYInputs = isFinite(yMin) && isFinite(yMax);
    if (!isFinite(xMin) || !isFinite(xMax)) return;
    if (hasYInputs) {
        scaleState[type].autoY = false;
        const autoChkId = type === 'raw' ? 'rawAutoY' : 'filtAutoY';
        const autoEl = document.getElementById(autoChkId);
        if (autoEl) autoEl.checked = false;
    } else {
        yMin = scaleState[type].yMin;
        yMax = scaleState[type].yMax;
    }
    if (yMax < yMin) [yMin, yMax] = [yMax, yMin];
    if (xMax < xMin) [xMin, xMax] = [xMax, xMin];

    xMin = Math.max(0, Math.min(xMin, eegData.length));
    xMax = Math.max(0, Math.min(xMax, eegData.length));

    scaleState.raw.yMin = type === 'raw' ? yMin : scaleState.raw.yMin;
    scaleState.raw.yMax = type === 'raw' ? yMax : scaleState.raw.yMax;
    scaleState.filtered.yMin = type === 'filtered' ? yMin : scaleState.filtered.yMin;
    scaleState.filtered.yMax = type === 'filtered' ? yMax : scaleState.filtered.yMax;
    scaleState.raw.xMin = xMin;
    scaleState.raw.xMax = xMax;
    scaleState.filtered.xMin = xMin;
    scaleState.filtered.xMax = xMax;

    document.getElementById('rawXMin').value = xMin;
    document.getElementById('rawXMax').value = xMax;
    document.getElementById('filtXMin').value = xMin;
    document.getElementById('filtXMax').value = xMax;

    if (type === 'raw') {
        document.getElementById('rawYMin').value = yMin;
        document.getElementById('rawYMax').value = yMax;
    } else {
        document.getElementById('filtYMin').value = yMin;
        document.getElementById('filtYMax').value = yMax;
    }

    const total = Math.max(1, eegData.length);
    const startNorm = Math.max(0, Math.min(1, xMin / total));
    const endNorm = Math.max(0, Math.min(1, xMax / total));
    zoomState.raw.start = startNorm;
    zoomState.raw.end = endNorm <= startNorm ? Math.min(1, startNorm + 0.001) : endNorm;
    zoomState.filtered.start = zoomState.raw.start;
    zoomState.filtered.end = zoomState.raw.end;

    updatePlots();
}

// Make functions globally available for onclick handlers
window.addFilter = addFilter;
window.removeFilter = removeFilter;
window.updateParam = updateParam;
window.zoomChart = zoomChart;
window.updateScale = updateScale;
window.toggleAutoY = toggleAutoY;
window.applyLimits = applyLimits;
window.toggleTimestampConversion = toggleTimestampConversion;
