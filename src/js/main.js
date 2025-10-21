// main.js - Main application logic for index.html

// Global state
window.appState = {
    rawData: null,
    parsedData: null,
    fileName: '',
    columns: [],
    selectedTimestamp: null,
    selectedChannels: [],
    samplingRate: 250
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const loadDemo = document.getElementById('loadDemo');
    const modal = document.getElementById('previewModal');
    const closeBtn = modal.querySelector('.modal-close');
    const btnVisualize = document.getElementById('btnVisualize');
    const btnPipeline = document.getElementById('btnPipeline');

    // Dropzone click
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Load demo data
    loadDemo.addEventListener('click', () => {
        loadDemoData();
    });

    // Modal close
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Navigation buttons
    btnVisualize.addEventListener('click', () => {
        saveConfigAndNavigate('visualization.html');
    });

    btnPipeline.addEventListener('click', () => {
        saveConfigAndNavigate('pipeline.html');
    });
}

function handleFile(file) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
        alert('Please upload a CSV or TXT file');
        return;
    }

    window.appState.fileName = file.name;
    
    // Show file info
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatBytes(file.size);
    document.getElementById('fileInfo').style.display = 'block';

    // Parse CSV
    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            handleParsedData(results);
        },
        error: (error) => {
            alert('Error parsing file: ' + error.message);
        }
    });
}

function handleParsedData(results) {
    const data = results.data;
    
    if (data.length === 0) {
        alert('No data found in file');
        return;
    }

    window.appState.parsedData = data;
    window.appState.columns = Object.keys(data[0]);
    
    document.getElementById('fileRows').textContent = data.length.toLocaleString();

    // Show preview modal
    showPreviewModal();
}

function showPreviewModal() {
    const modal = document.getElementById('previewModal');
    const timestampCol = document.getElementById('timestampCol');
    const channelCheckboxes = document.getElementById('channelCheckboxes');
    const previewTable = document.getElementById('previewTable');
    const samplingRateInput = document.getElementById('samplingRate');

    // Populate timestamp selector
    timestampCol.innerHTML = window.appState.columns.map(col => 
        `<option value="${col}">${col}</option>`
    ).join('');

    // Auto-select timestamp column
    const timeCol = window.appState.columns.find(col => 
        col.toLowerCase().includes('time') || col.toLowerCase().includes('timestamp')
    );
    if (timeCol) {
        timestampCol.value = timeCol;
    }

    // Populate channel checkboxes
    channelCheckboxes.innerHTML = window.appState.columns
        .filter(col => col !== timestampCol.value)
        .map(col => `
            <label class="checkbox-label">
                <input type="checkbox" value="${col}" ${col.toLowerCase().includes('ch') ? 'checked' : ''}>
                <span>${col}</span>
            </label>
        `).join('');

    // Auto-detect sampling rate
    if (window.appState.parsedData.length > 1) {
        const firstCol = window.appState.columns[0];
        const dt = window.appState.parsedData[1][firstCol] - window.appState.parsedData[0][firstCol];
        if (dt > 0 && dt < 1) {
            const estimatedSR = Math.round(1 / dt);
            samplingRateInput.value = estimatedSR;
        }
    }

    // Render preview table
    renderPreviewTable(previewTable);

    modal.style.display = 'flex';
}

function renderPreviewTable(container) {
    const data = window.appState.parsedData.slice(0, 10);
    const columns = window.appState.columns;

    let html = '<table><thead><tr>';
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            const value = row[col];
            html += `<td>${typeof value === 'number' ? value.toFixed(3) : value}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function saveConfigAndNavigate(page) {
    // Get selected configuration
    const timestampCol = document.getElementById('timestampCol').value;
    const channelCheckboxes = document.querySelectorAll('#channelCheckboxes input[type="checkbox"]:checked');
    const selectedChannels = Array.from(channelCheckboxes).map(cb => cb.value);
    const samplingRate = parseInt(document.getElementById('samplingRate').value);

    if (selectedChannels.length === 0) {
        alert('Please select at least one signal channel');
        return;
    }

    // Update app state
    window.appState.selectedTimestamp = timestampCol;
    window.appState.selectedChannels = selectedChannels;
    window.appState.samplingRate = samplingRate;

    // Save to sessionStorage for access in other pages
    sessionStorage.setItem('appState', JSON.stringify(window.appState));

    // Navigate
    window.location.href = page;
}

function loadDemoData() {
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
            timestamp: t.toFixed(4),
            ch1: ch1.toFixed(3),
            ch2: ch2.toFixed(3)
        });
    }

    // Create results object compatible with Papa.parse
    const results = {
        data: data,
        errors: [],
        meta: {
            delimiter: ',',
            linebreak: '\n',
            aborted: false,
            truncated: false,
            cursor: numSamples
        }
    };

    window.appState.fileName = 'demo_eeg.csv';
    
    // Show file info
    document.getElementById('fileName').textContent = 'Demo EEG Data';
    document.getElementById('fileSize').textContent = '~' + formatBytes(numSamples * 50);
    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('fileRows').textContent = numSamples.toLocaleString();

    handleParsedData(results);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}