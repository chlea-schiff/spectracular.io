# Signal Processing Web App (MVP)

A browser-based signal visualization and preprocessing tool for physiological and neural signals.

## Features (MVP)

- 📁 **File Upload**: CSV files with drag-and-drop support
- 📊 **Visualization**: Time-domain and frequency-domain plots
- 🔧 **Preprocessing Pipeline**: Build, reorder, and configure filter chains
- 💾 **Export**: Download processed signals as CSV
- 🎨 **Interactive**: Real-time preview and parameter adjustment

## Supported Formats

- CSV with headers (timestamp + signal columns)
- Flexible column selection
- Auto-detection of sampling rate

## Getting Started

### Live Demo
Visit: `https://[your-username].github.io/signal-processing-app/`

### Local Development
```bash
# Clone the repository
git clone https://github.com/[your-username]/signal-processing-app.git
cd signal-processing-app

# Open with a local server (required for module imports)
python -m http.server 8000
# or
npx serve public

# Navigate to http://localhost:8000
```

## Usage

1. **Upload a signal file** (CSV format)
2. **Preview and select columns** (timestamp and signal channels)
3. **Choose your workflow:**
   - **Visualization**: Explore time/frequency domain
   - **Pipeline Builder**: Create preprocessing chains
4. **Export** your processed data

## Available Filters

- Butterworth (Lowpass, Highpass, Bandpass, Bandstop)
- Savitzky-Golay smoothing
- Median filter
- Notch filter (50/60 Hz)
- Detrending
- Normalization

## Technology Stack

- Pure JavaScript (ES6+)
- [Plotly.js](https://plotly.com/javascript/) for visualization
- [PapaParse](https://www.papaparse.com/) for CSV parsing
- [Sortable.js](https://sortablejs.github.io/Sortable/) for drag-and-drop

## Project Structure

```
public/          # Static files (HTML pages)
src/
  css/          # Stylesheets
  js/           # JavaScript modules
  components/   # Reusable UI components
docs/           # Documentation
```

## Roadmap

- [x] MVP: Frontend-only processing
- [ ] Phase 2: Python backend (FastAPI) for heavy processing
- [ ] Phase 3: Desktop app (Electron/Tauri)
- [ ] AI-powered pipeline suggestions
- [ ] ML/DL data preparation tools

## License

Proprietary - All Rights Reserved. See [LICENSE.txt](LICENSE.txt) for details.

## Contributing

This is a proprietary project. For collaboration inquiries, please contact the repository owner.
```