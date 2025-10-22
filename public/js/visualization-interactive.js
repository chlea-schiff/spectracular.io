// visualization-interactive.js - Interactive visualization with data loading

import { downloadFile } from './utils.js';

let appState = null;
let signalData = {};
let visibleChannels = [];
let timeRange = { start: 0, end: 10 };
let timeChart, fftChart;
let zoomState = { time: { start: 0, end: 1 }, fft: { start: 0, end: 1 } };
let convertTimestamps = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
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

function initWithLoadedData() {
    visibleChannels = [...appState.selectedChannels];

    // Update info display
    document.getElementById('fileNameDisplay').textContent = appState.fileName;
    document.getElementById('samplingRateDisplay').textContent = appState.samplingRate;
    
    const duration = (appState.parsedData.length / appState.samplingRate).toFixed(2);
    document.getElementById('durationDisplay').textContent = duration;
    document.getElementById('timeEnd').value = Math.min(10, parseFloat(duration));
    timeRange.end = Math.min(10, parseFloat(duration));

    initializeControls();
    prepareSignalData();
    initCharts();
    updateAllPlots();
}

function initDemoData() {
    // Generate synthetic EEG data
    const samplingRate = 250;
    const duration = 10; // seconds
    const numSamples = samplingRate * duration;
    
    const data = [];
    for (let i = 0; i < numSamples; i++) {
        const t = i / samplingRate;
        // Simulate EEG with multiple frequency components
        const ch1 = 
            10 * Math.sin(2 * Math.PI * 10 * t) + // Alpha (10 Hz)
            5 * Math.sin(2 * Math.PI * 20 * t) +  // Beta (20 Hz)
            3 * (Math.random() - 0.5);            // Noise
        
        const ch2 = 
            8 * Math.sin(2 * Math.PI * 8 * t + 0.5) +
            6 * Math.sin(2 * Math.PI * 15 * t) +
            3 * (Math.random() - 0.5);
        
        data.push({
            timestamp: t,
            ch1: ch1,
            ch2: ch2
        });
    }

    // Create mock appState for demo
    appState = {
        fileName: 'Demo EEG Data',
        samplingRate: samplingRate,
        selectedTimestamp: 'timestamp',
        selectedChannels: ['ch1', 'ch2'],
        parsedData: data
    };

    visibleChannels = ['ch1', 'ch2'];

    // Update info display
    document.getElementById('fileNameDisplay').textContent = 'Demo EEG Data';
    document.getElementById('samplingRateDisplay').textContent = samplingRate;
    document.getElementById('durationDisplay').textContent = duration;
    document.getElementById('timeEnd').value = duration;
    timeRange.end = duration;

    initializeControls();
    prepareSignalData();
    initCharts();
    updateAllPlots();
}

function initializeControls() {
    const channelToggles = document.getElementById('channelToggles');
    
    // Create channel toggles
    channelToggles.innerHTML = appState.selectedChannels.map(ch => `
        <label class="checkbox-label">
            <input type="checkbox" value="${ch}" checked data-channel="${ch}">
            <span>${ch}</span>
        </label>
    `).join('');

    // Event listeners
    channelToggles.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!visibleChannels.includes(e.target.value)) {
                    visibleChannels.push(e.target.value);
                }
            } else {
                visibleChannels = visibleChannels.filter(ch => ch !== e.target.value);
            }
            updateAllPlots();
        });
    });

    document.getElementById('stackedPlot').addEventListener('change', updateAllPlots);
    document.getElementById('showGrid').addEventListener('change', updateAllPlots);
    document.getElementById('logScale').addEventListener('change', updateAllPlots);
    document.getElementById('maxFreq').addEventListener('change', updateAllPlots);
    document.getElementById('convertTimestamps').addEventListener('change', (e) => {
        convertTimestamps = e.target.checked;
        updateAllPlots();
    });

    document.getElementById('applyTimeRange').addEventListener('click', () => {
        timeRange.start = parseFloat(document.getElementById('timeStart').value);
        timeRange.end = parseFloat(document.getElementById('timeEnd').value);
        updateAllPlots();
    });

    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('exportPlot').addEventListener('click', exportPlot);
}

function prepareSignalData() {
    const timestampCol = appState.selectedTimestamp;
    
    // Extract data for each channel
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

function initCharts() {
    const ctx1 = document.getElementById('timeChart').getContext('2d');
    const ctx2 = document.getElementById('fftChart').getContext('2d');

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: { 
            legend: { display: true },
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

    timeChart = new Chart(ctx1, {
        type: 'line',
        data: { 
            labels: [],
            datasets: []
        },
        options: chartOptions
    });

    fftChart = new Chart(ctx2, {
        type: 'line',
        data: { 
            labels: [],
            datasets: []
        },
        options: chartOptions
    });
}

function updateAllPlots() {
    updateTimePlot();
    updateFFTPlot();
}

function updateTimePlot() {
    const stacked = document.getElementById('stackedPlot').checked;
    const showGrid = document.getElementById('showGrid').checked;
    
    const traces = [];
    
    visibleChannels.forEach((channel, idx) => {
        const data = signalData[channel];
        const startIdx = data.times.findIndex(t => t >= timeRange.start);
        const endIdx = data.times.findIndex(t => t >= timeRange.end);
        
        const timeSlice = data.times.slice(startIdx, endIdx);
        const valueSlice = data.values.slice(startIdx, endIdx);
        
        // Convert timestamps if requested
        let xData = timeSlice;
        if (convertTimestamps) {
            xData = timeSlice.map(t => new Date(t * 1000).toLocaleString());
        }
        
        traces.push({
            label: channel,
            data: xData.map((x, i) => ({ x: x, y: valueSlice[i] })),
            borderColor: getChannelColor(idx),
            backgroundColor: getChannelColor(idx) + '20',
            tension: 0,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
        });
    });

    timeChart.data.datasets = traces;
    timeChart.update('none');
}

function updateFFTPlot() {
    const logScale = document.getElementById('logScale').checked;
    const showGrid = document.getElementById('showGrid').checked;
    const maxFreq = parseFloat(document.getElementById('maxFreq').value);
    
    const traces = [];
    
    visibleChannels.forEach((channel, idx) => {
        const data = signalData[channel];
        const startIdx = data.times.findIndex(t => t >= timeRange.start);
        const endIdx = data.times.findIndex(t => t >= timeRange.end);
        
        const valueSlice = data.values.slice(startIdx, endIdx);
        const fftResult = computeFFT(valueSlice, appState.samplingRate);
        
        // Filter by max frequency
        const freqLimit = fftResult.frequencies.findIndex(f => f > maxFreq);
        const frequencies = fftResult.frequencies.slice(0, freqLimit);
        const magnitudes = fftResult.magnitudes.slice(0, freqLimit);
        
        traces.push({
            label: channel,
            data: frequencies.map((f, i) => ({ x: f, y: magnitudes[i] })),
            borderColor: getChannelColor(idx),
            backgroundColor: getChannelColor(idx) + '20',
            tension: 0,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
        });
    });

    fftChart.data.datasets = traces;
    fftChart.update('none');
}

function getChannelColor(index) {
    const colors = ['#14786e', '#00d4ff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
    return colors[index % colors.length];
}

// FFT Implementation
function computeFFT(signal, samplingRate) {
    const N = signal.length;
    const frequencies = [];
    const magnitudes = [];
    
    // Compute FFT using DFT (simple implementation)
    for (let k = 0; k < N / 2; k++) {
        let real = 0;
        let imag = 0;
        
        for (let n = 0; n < N; n++) {
            const angle = -2 * Math.PI * k * n / N;
            real += signal[n] * Math.cos(angle);
            imag += signal[n] * Math.sin(angle);
        }
        
        const magnitude = Math.sqrt(real * real + imag * imag) / N;
        const frequency = k * samplingRate / N;
        
        frequencies.push(frequency);
        magnitudes.push(magnitude * 2); // Scale for single-sided spectrum
    }
    
    return { frequencies, magnitudes };
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
    updateAllPlots();
}

function exportCSV() {
    let csv = appState.selectedTimestamp + ',' + visibleChannels.join(',') + '\n';
    
    const minLength = Math.min(...visibleChannels.map(ch => signalData[ch].times.length));
    
    for (let i = 0; i < minLength; i++) {
        const time = signalData[visibleChannels[0]].times[i];
        if (time < timeRange.start || time > timeRange.end) continue;
        
        const values = visibleChannels.map(ch => signalData[ch].values[i].toFixed(6));
        csv += time.toFixed(6) + ',' + values.join(',') + '\n';
    }
    
    downloadFile(csv, 'exported_data.csv', 'text/csv');
}

function exportPlot() {
    // Create a temporary canvas to export the chart
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    // Draw the time chart
    timeChart.draw(ctx);
    
    // Convert to blob and download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'signal_plot.png';
        link.click();
        URL.revokeObjectURL(url);
    });
}

// Make functions globally available for onclick handlers
window.zoomChart = zoomChart;
