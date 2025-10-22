// pipeline.js - Pipeline builder logic

let appState = null;
let pipeline = [];
let selectedStepId = null;
let currentChannel = null;
let signalData = {};
let sortable = null;

// Filter configurations
const filterConfigs = {
    detrend: { 
        name: 'Detrend',
        params: {},
        defaults: {}
    },
    normalize: { 
        name: 'Normalize (0-1)',
        params: {},
        defaults: {}
    },
    standardize: { 
        name: 'Standardize (Z-score)',
        params: {},
        defaults: {}
    },
    butterworth_lowpass: { 
        name: 'Butterworth Lowpass',
        params: ['cutoff', 'order'],
        defaults: { cutoff: 50, order: 4 }
    },
    butterworth_highpass: { 
        name: 'Butterworth Highpass',
        params: ['cutoff', 'order'],
        defaults: { cutoff: 1, order: 4 }
    },
    butterworth_bandpass: { 
        name: 'Butterworth Bandpass',
        params: ['low', 'high', 'order'],
        defaults: { low: 1, high: 50, order: 4 }
    },
    butterworth_bandstop: { 
        name: 'Butterworth Bandstop',
        params: ['low', 'high', 'order'],
        defaults: { low: 48, high: 52, order: 4 }
    },
    savgol: { 
        name: 'Savitzky-Golay',
        params: ['window', 'polyorder'],
        defaults: { window: 11, polyorder: 3 }
    },
    median: { 
        name: 'Median Filter',
        params: ['kernel'],
        defaults: { kernel: 5 }
    },
    notch: { 
        name: 'Notch Filter',
        params: ['frequency', 'quality'],
        defaults: { frequency: 50, quality: 30 }
    },
    moving_average: { 
        name: 'Moving Average',
        params: ['window'],
        defaults: { window: 5 }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
    initializeControls();
    prepareSignalData();
    updatePlots();
});

function loadAppState() {
    const savedState = sessionStorage.getItem('appState');
    if (!savedState) {
        alert('No data loaded. Redirecting to home...');
        window.location.href = 'index.html';
        return;
    }
    appState = JSON.parse(savedState);
    currentChannel = appState.selectedChannels[0];

    // Populate channel selector
    const channelSelect = document.getElementById('processingChannel');
    channelSelect.innerHTML = appState.selectedChannels.map(ch => 
        `<option value="${ch}">${ch}</option>`
    ).join('');
    channelSelect.value = currentChannel;
}

function initializeControls() {
    // Add filter button
    document.getElementById('addFilterBtn').addEventListener('click', addFilter);

    // Channel change
    document.getElementById('processingChannel').addEventListener('change', (e) => {
        currentChannel = e.target.value;
        updatePlots();
    });

    // Pipeline actions
    document.getElementById('savePipeline').addEventListener('click', savePipeline);
    document.getElementById('loadPipeline').addEventListener('click', loadPipeline);
    document.getElementById('clearPipeline').addEventListener('click', clearPipeline);
    document.getElementById('applyPipeline').addEventListener('click', applyPipeline);
    document.getElementById('exportProcessed').addEventListener('click', exportProcessed);
    document.getElementById('exportCode').addEventListener('click', exportCode);

    // Initialize Sortable for drag-and-drop
    const pipelineList = document.getElementById('pipelineList');
    sortable = Sortable.create(pipelineList, {
        animation: 150,
        handle: '.pipeline-step',
        onEnd: () => {
            updatePipelineOrder();
            updatePlots();
        }
    });
}

function prepareSignalData() {
    const timestampCol = appState.selectedTimestamp;
    
    appState.selectedChannels.forEach(channel => {
        const times = [];
        const values = [];
        
        appState.parsedData.forEach(row => {
            const t = parseFloat(row[timestampCol]);
            const v = parseFloat(row[channel]);
            if (!isNaN(t) && !isNaN(v)) {
                times.push(t);
                values.push(v);
            }
        });
        
        signalData[channel] = { times, values };
    });
}

function addFilter() {
    const select = document.getElementById('filterTypeSelect');
    const type = select.value;
    
    if (!type) {
        alert('Please select a filter type');
        return;
    }

    const config = filterConfigs[type];
    const step = {
        id: Date.now().toString(),
        type: type,
        name: config.name,
        enabled: true,
        params: { ...config.defaults }
    };

    pipeline.push(step);
    select.value = '';
    renderPipeline();
    updatePlots();
}

function renderPipeline() {
    const list = document.getElementById('pipelineList');
    
    if (pipeline.length === 0) {
        list.innerHTML = '<p class="param-placeholder">No steps added yet</p>';
        return;
    }

    list.innerHTML = pipeline.map(step => {
        const config = filterConfigs[step.type];
        const paramStr = Object.entries(step.params)
            .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`)
            .join(', ');

        return `
            <div class="pipeline-step ${step.enabled ? '' : 'disabled'} ${selectedStepId === step.id ? 'selected' : ''}" 
                 data-step-id="${step.id}">
                <div class="step-header">
                    <span class="step-title">${step.name}</span>
                    <div class="step-controls">
                        <input type="checkbox" class="step-toggle" ${step.enabled ? 'checked' : ''} 
                               onchange="toggleStep('${step.id}')">
                        <button class="step-delete" onclick="deleteStep('${step.id}')">×</button>
                    </div>
                </div>
                ${paramStr ? `<div class="step-params">${paramStr}</div>` : ''}
            </div>
        `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.pipeline-step').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.classList.contains('step-toggle') && 
                !e.target.classList.contains('step-delete')) {
                selectStep(el.dataset.stepId);
            }
        });
    });
}

window.toggleStep = function(id) {
    const step = pipeline.find(s => s.id === id);
    if (step) {
        step.enabled = !step.enabled;
        renderPipeline();
        updatePlots();
    }
};

window.deleteStep = function(id) {
    pipeline = pipeline.filter(s => s.id !== id);
    if (selectedStepId === id) {
        selectedStepId = null;
        renderParamPanel();
    }
    renderPipeline();
    updatePlots();
};

function selectStep(id) {
    selectedStepId = id;
    renderPipeline();
    renderParamPanel();
}

function renderParamPanel() {
    const panel = document.getElementById('paramPanel');
    
    if (!selectedStepId) {
        panel.innerHTML = '<p class="param-placeholder">Select a pipeline step to edit its parameters</p>';
        return;
    }

    const step = pipeline.find(s => s.id === selectedStepId);
    if (!step) return;

    const config = filterConfigs[step.type];
    
    if (!config.params || config.params.length === 0) {
        panel.innerHTML = `
            <h3>${step.name}</h3>
            <p class="param-placeholder">This filter has no configurable parameters</p>
        `;
        return;
    }

    let html = `<h3>${step.name}</h3>`;
    
    config.params.forEach(param => {
        const value = step.params[param];
        const paramLabel = param.charAt(0).toUpperCase() + param.slice(1);
        
        html += `
            <div class="param-group">
                <label>
                    ${paramLabel}
                    <span class="param-value" id="val-${param}">${value.toFixed(2)}</span>
                </label>
                <input type="range" 
                       class="input-field" 
                       min="0.1" 
                       max="${param === 'order' ? 10 : (param === 'quality' ? 50 : 200)}" 
                       step="0.1" 
                       value="${value}"
                       oninput="updateParam('${selectedStepId}', '${param}', this.value)">
            </div>
        `;
    });

    panel.innerHTML = html;
}

window.updateParam = function(stepId, param, value) {
    const step = pipeline.find(s => s.id === stepId);
    if (step) {
        step.params[param] = parseFloat(value);
        document.getElementById(`val-${param}`).textContent = parseFloat(value).toFixed(2);
        renderPipeline();
        updatePlots();
    }
};

function updatePipelineOrder() {
    const list = document.getElementById('pipelineList');
    const steps = Array.from(list.querySelectorAll('.pipeline-step'));
    const newPipeline = [];
    
    steps.forEach(el => {
        const id = el.dataset.stepId;
        const step = pipeline.find(s => s.id === id);
        if (step) newPipeline.push(step);
    });
    
    pipeline = newPipeline;
}

function updatePlots() {
    if (!currentChannel || !signalData[currentChannel]) return;

    const original = signalData[currentChannel].values;
    const processed = applyPipelineToSignal(original);
    const times = signalData[currentChannel].times;

    plotSignal('originalPlot', times, original, 'Original');
    plotSignal('processedPlot', times, processed, 'Processed');
}

function plotSignal(plotId, times, values, title) {
    const trace = {
        x: times,
        y: values,
        type: 'scatter',
        mode: 'lines',
        line: { width: 1.5, color: '#00d4ff' }
    };

    const layout = {
        paper_bgcolor: '#0f3460',
        plot_bgcolor: '#0a2540',
        font: { color: '#eee' },
        showlegend: false,
        margin: { l: 50, r: 20, t: 10, b: 40 },
        xaxis: {
            title: 'Time (s)',
            gridcolor: '#1a3a52',
            color: '#aaa'
        },
        yaxis: {
            title: 'Amplitude',
            gridcolor: '#1a3a52',
            color: '#aaa'
        }
    };

    const config = {
        responsive: true,
        displayModeBar: false
    };

    Plotly.newPlot(plotId, [trace], layout, config);
}

function applyPipelineToSignal(signal) {
    let result = [...signal];
    
    for (const step of pipeline) {
        if (!step.enabled) continue;
        result = applyFilter(result, step);
    }
    
    return result;
}

function applyFilter(signal, step) {
    const params = step.params;
    const sr = appState.samplingRate;
    const nyquist = sr / 2;

    switch (step.type) {
        case 'detrend':
            return detrend(signal);
        case 'normalize':
            return normalize(signal);
        case 'standardize':
            return standardize(signal);
        case 'butterworth_lowpass':
            return butterworthFilter(signal, params.cutoff / nyquist, params.order, 'low');
        case 'butterworth_highpass':
            return butterworthFilter(signal, params.cutoff / nyquist, params.order, 'high');
        case 'butterworth_bandpass':
            return bandpassFilter(signal, params.low / nyquist, params.high / nyquist, params.order);
        case 'butterworth_bandstop':
            return bandstopFilter(signal, params.low / nyquist, params.high / nyquist, params.order);
        case 'savgol':
            return savgolFilter(signal, Math.floor(params.window), Math.floor(params.polyorder));
        case 'median':
            return medianFilter(signal, Math.floor(params.kernel));
        case 'notch':
            return notchFilter(signal, params.frequency, params.quality, sr);
        case 'moving_average':
            return movingAverage(signal, Math.floor(params.window));
        default:
            return signal;
    }
}

// Filter implementations
function detrend(signal) {
    const n = signal.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    // Linear regression
    const xMean = x.reduce((a, b) => a + b) / n;
    const yMean = signal.reduce((a, b) => a + b) / n;
    
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (x[i] - xMean) * (signal[i] - yMean);
        den += (x[i] - xMean) ** 2;
    }
    
    const slope = num / den;
    const intercept = yMean - slope * xMean;
    
    return signal.map((y, i) => y - (slope * x[i] + intercept));
}

function normalize(signal) {
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;
    if (range === 0) return signal;
    return signal.map(v => (v - min) / range);
}

function standardize(signal) {
    const mean = signal.reduce((a, b) => a + b) / signal.length;
    const std = Math.sqrt(signal.reduce((a, b) => a + (b - mean) ** 2, 0) / signal.length);
    if (std === 0) return signal;
    return signal.map(v => (v - mean) / std);
}

function butterworthFilter(signal, normalizedFreq, order, type) {
    const result = [...signal];
    const alpha = Math.min(0.95, normalizedFreq);
    
    if (type === 'low') {
        for (let i = 1; i < result.length; i++) {
            result[i] = alpha * result[i] + (1 - alpha) * result[i - 1];
        }
    } else if (type === 'high') {
        for (let i = 1; i < result.length; i++) {
            result[i] = result[i] - (alpha * result[i - 1] + (1 - alpha) * result[i]);
        }
    }
    
    return result;
}

function bandpassFilter(signal, lowFreq, highFreq, order) {
    let result = butterworthFilter(signal, highFreq, order, 'low');
    result = butterworthFilter(result, lowFreq, order, 'high');
    return result;
}

function bandstopFilter(signal, lowFreq, highFreq, order) {
    const low = butterworthFilter(signal, lowFreq, order, 'low');
    const high = butterworthFilter(signal, highFreq, order, 'high');
    return signal.map((v, i) => low[i] + high[i] - v);
}

function savgolFilter(signal, window, polyorder) {
    const result = [...signal];
    const half = Math.floor(window / 2);
    
    for (let i = half; i < result.length - half; i++) {
        let sum = 0;
        for (let j = i - half; j <= i + half; j++) {
            sum += result[j];
        }
        result[i] = sum / window;
    }
    
    return result;
}

function medianFilter(signal, kernel) {
    const result = [...signal];
    const half = Math.floor(kernel / 2);
    
    for (let i = half; i < result.length - half; i++) {
        const window = signal.slice(i - half, i + half + 1).sort((a, b) => a - b);
        result[i] = window[Math.floor(window.length / 2)];
    }
    
    return result;
}

function notchFilter(signal, freq, quality, sr) {
    const result = [...signal];
    const w0 = 2 * Math.PI * freq / sr;
    const alpha = Math.sin(w0) / (2 * quality);
    const b0 = 1, b1 = -2 * Math.cos(w0), b2 = 1;
    const a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;

    for (let i = 2; i < result.length; i++) {
        result[i] = (b0 * signal[i] + b1 * signal[i-1] + b2 * signal[i-2] - 
                     a1 * result[i-1] - a2 * result[i-2]) / a0;
    }
    
    return result;
}

function movingAverage(signal, window) {
    const result = [];
    for (let i = 0; i < signal.length; i++) {
        const start = Math.max(0, i - Math.floor(window / 2));
        const end = Math.min(signal.length, i + Math.ceil(window / 2));
        const sum = signal.slice(start, end).reduce((a, b) => a + b, 0);
        result.push(sum / (end - start));
    }
    return result;
}

// Pipeline management
function savePipeline() {
    const json = JSON.stringify({ pipeline, samplingRate: appState.samplingRate }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pipeline_config.json';
    link.click();
    URL.revokeObjectURL(url);
}

function loadPipeline() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                pipeline = data.pipeline || [];
                renderPipeline();
                updatePlots();
            } catch (err) {
                alert('Error loading pipeline: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clearPipeline() {
    if (confirm('Clear all pipeline steps?')) {
        pipeline = [];
        selectedStepId = null;
        renderPipeline();
        renderParamPanel();
        updatePlots();
    }
}

function applyPipeline() {
    alert('Pipeline applied! Use "Export Processed CSV" to download the result.');
}

function exportProcessed() {
    let csv = appState.selectedTimestamp + ',' + currentChannel + '\n';
    
    const times = signalData[currentChannel].times;
    const processed = applyPipelineToSignal(signalData[currentChannel].values);
    
    for (let i = 0; i < times.length; i++) {
        csv += times[i].toFixed(6) + ',' + processed[i].toFixed(6) + '\n';
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed_${currentChannel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportCode() {
    let code = `# Generated Python preprocessing pipeline\n`;
    code += `import numpy as np\n`;
    code += `from scipy import signal\n`;
    code += `import pandas as pd\n\n`;
    code += `# Load data\n`;
    code += `df = pd.read_csv('your_data.csv')\n`;
    code += `data = df['${currentChannel}'].values\n`;
    code += `sampling_rate = ${appState.samplingRate}\n\n`;
    code += `# Apply preprocessing steps\n`;
    
    pipeline.filter(s => s.enabled).forEach((step, idx) => {
        code += `\n# Step ${idx + 1}: ${step.name}\n`;
        const params = step.params;
        
        switch (step.type) {
            case 'detrend':
                code += `data = signal.detrend(data)\n`;
                break;
            case 'normalize':
                code += `data = (data - data.min()) / (data.max() - data.min())\n`;
                break;
            case 'standardize':
                code += `data = (data - data.mean()) / data.std()\n`;
                break;
            case 'butterworth_lowpass':
                code += `b, a = signal.butter(${params.order}, ${params.cutoff}, 'low', fs=sampling_rate)\n`;
                code += `data = signal.filtfilt(b, a, data)\n`;
                break;
            case 'butterworth_highpass':
                code += `b, a = signal.butter(${params.order}, ${params.cutoff}, 'high', fs=sampling_rate)\n`;
                code += `data = signal.filtfilt(b, a, data)\n`;
                break;
            case 'butterworth_bandpass':
                code += `b, a = signal.butter(${params.order}, [${params.low}, ${params.high}], 'bandpass', fs=sampling_rate)\n`;
                code += `data = signal.filtfilt(b, a, data)\n`;
                break;
            case 'savgol':
                code += `data = signal.savgol_filter(data, ${params.window}, ${params.polyorder})\n`;
                break;
            case 'median':
                code += `data = signal.medfilt(data, kernel_size=${params.kernel})\n`;
                break;
            case 'notch':
                code += `b, a = signal.iirnotch(${params.frequency}, ${params.quality}, sampling_rate)\n`;
                code += `data = signal.filtfilt(b, a, data)\n`;
                break;
        }
    });
    
    code += `\n# Save processed data\n`;
    code += `df['${currentChannel}_processed'] = data\n`;
    code += `df.to_csv('processed_data.csv', index=False)\n`;
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pipeline_code.py';
    link.click();
    URL.revokeObjectURL(url);
}