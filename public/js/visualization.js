// visualization.js - Visualization page logic

import { downloadFile } from './utils.js';

let appState = null;
let signalData = {};
let visibleChannels = [];
let timeRange = { start: 0, end: 10 };

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadAppState();
    initializeControls();
    prepareSignalData();
    updateAllPlots();
});

function loadAppState() {
    const savedState = sessionStorage.getItem('appState');
    if (!savedState) {
        alert('No data loaded. Redirecting to home...');
        window.location.href = 'index.html';
        return;
    }
    appState = JSON.parse(savedState);
    visibleChannels = [...appState.selectedChannels];

    // Update info display
    document.getElementById('fileNameDisplay').textContent = appState.fileName;
    document.getElementById('samplingRateDisplay').textContent = appState.samplingRate;
    
    const duration = (appState.parsedData.length / appState.samplingRate).toFixed(2);
    document.getElementById('durationDisplay').textContent = duration;
    document.getElementById('timeEnd').value = Math.min(10, parseFloat(duration));
    timeRange.end = Math.min(10, parseFloat(duration));
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

function updateAllPlots() {
    updateTimePlot();
    updateFFTPlot();
    updatePSDPlot();
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
        
        traces.push({
            x: timeSlice,
            y: valueSlice,
            name: channel,
            type: 'scatter',
            mode: 'lines',
            line: { width: 1.5 },
            xaxis: stacked ? `x${idx + 1}` : 'x',
            yaxis: stacked ? `y${idx + 1}` : 'y'
        });
    });

    const layout = {
        paper_bgcolor: '#0f3460',
        plot_bgcolor: '#0a2540',
        font: { color: '#eee' },
        showlegend: true,
        legend: { x: 1.05, y: 1 },
        margin: { l: 60, r: 20, t: 20, b: 40 },
        hovermode: 'x unified',
        grid: stacked ? { rows: visibleChannels.length, columns: 1, pattern: 'independent' } : undefined
    };

    if (stacked) {
        visibleChannels.forEach((channel, idx) => {
            const axisNum = idx + 1;
            layout[`xaxis${axisNum}`] = {
                title: idx === visibleChannels.length - 1 ? 'Time (s)' : '',
                gridcolor: showGrid ? '#1a3a52' : 'transparent',
                color: '#aaa'
            };
            layout[`yaxis${axisNum}`] = {
                title: channel,
                gridcolor: showGrid ? '#1a3a52' : 'transparent',
                color: '#aaa'
            };
        });
    } else {
        layout.xaxis = {
            title: 'Time (s)',
            gridcolor: showGrid ? '#1a3a52' : 'transparent',
            color: '#aaa'
        };
        layout.yaxis = {
            title: 'Amplitude',
            gridcolor: showGrid ? '#1a3a52' : 'transparent',
            color: '#aaa'
        };
    }

    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };

    Plotly.newPlot('timePlot', traces, layout, config);
}

function updateFFTPlot() {
    const logScale = document.getElementById('logScale').checked;
    const showGrid = document.getElementById('showGrid').checked;
    const maxFreq = parseFloat(document.getElementById('maxFreq').value);
    
    const traces = [];
    
    visibleChannels.forEach(channel => {
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
            x: frequencies,
            y: magnitudes,
            name: channel,
            type: 'scatter',
            mode: 'lines',
            line: { width: 1.5 }
        });
    });

    const layout = {
        paper_bgcolor: '#0f3460',
        plot_bgcolor: '#0a2540',
        font: { color: '#eee' },
        showlegend: true,
        legend: { x: 1.05, y: 1 },
        margin: { l: 60, r: 20, t: 20, b: 40 },
        xaxis: {
            title: 'Frequency (Hz)',
            gridcolor: showGrid ? '#1a3a52' : 'transparent',
            color: '#aaa'
        },
        yaxis: {
            title: 'Magnitude',
            type: logScale ? 'log' : 'linear',
            gridcolor: showGrid ? '#1a3a52' : 'transparent',
            color: '#aaa'
        }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    Plotly.newPlot('fftPlot', traces, layout, config);
}

function updatePSDPlot() {
    const showGrid = document.getElementById('showGrid').checked;
    const maxFreq = parseFloat(document.getElementById('maxFreq').value);
    
    const traces = [];
    
    visibleChannels.forEach(channel => {
        const data = signalData[channel];
        const startIdx = data.times.findIndex(t => t >= timeRange.start);
        const endIdx = data.times.findIndex(t => t >= timeRange.end);
        
        const valueSlice = data.values.slice(startIdx, endIdx);
        const psdResult = computePSD(valueSlice, appState.samplingRate);
        
        // Filter by max frequency
        const freqLimit = psdResult.frequencies.findIndex(f => f > maxFreq);
        const frequencies = psdResult.frequencies.slice(0, freqLimit);
        const psd = psdResult.psd.slice(0, freqLimit);
        
        traces.push({
            x: frequencies,
            y: psd,
            name: channel,
            type: 'scatter',
            mode: 'lines',
            line: { width: 1.5 }
        });
    });

    const layout = {
        paper_bgcolor: '#0f3460',
        plot_bgcolor: '#0a2540',
        font: { color: '#eee' },
        showlegend: true,
        legend: { x: 1.05, y: 1 },
        margin: { l: 60, r: 20, t: 20, b: 40 },
        xaxis: {
            title: 'Frequency (Hz)',
            gridcolor: showGrid ? '#1a3a52' : 'transparent',
            color: '#aaa'
        },
        yaxis: {
            title: 'Power Spectral Density (dB/Hz)',
            gridcolor: showGrid ? '#1a3a52' : 'transparent',
            color: '#aaa'
        }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    Plotly.newPlot('psdPlot', traces, layout, config);
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

// PSD Implementation (Welch's method simplified)
function computePSD(signal, samplingRate) {
    const fftResult = computeFFT(signal, samplingRate);
    
    // Convert magnitude to power (square and normalize)
    const psd = fftResult.magnitudes.map(mag => {
        const power = mag * mag;
        return 10 * Math.log10(power + 1e-10); // Convert to dB
    });
    
    return { frequencies: fftResult.frequencies, psd };
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
    Plotly.downloadImage('timePlot', {
        format: 'png',
        width: 1200,
        height: 600,
        filename: 'signal_plot'
    });
}
