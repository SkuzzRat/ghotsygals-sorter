'use client';

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react';
import { readPsd, Layer as PsdLayer } from 'ag-psd';
import JSZip from 'jszip';
import Image from 'next/image';
import { useTheme } from '@/app/hooks/useTheme';

interface Layer {
  name: string;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const SUFFIXES = [
  { label: '_L',  hint: 'Linework + highlights/shadows', color: '#3a3a3a', text: '#fff' },
  { label: '_C5', hint: 'Skin layer',                   color: '#f4a57a', text: '#fff' },
  { label: '_C4', hint: 'Dye Color 4 – accent/detail',  color: '#9d4edd', text: '#fff' },
  { label: '_C3', hint: 'Dye Color 3 – accent',         color: '#4ecb71', text: '#fff' },
  { label: '_C2', hint: 'Dye Color 2 – secondary',      color: '#4e9edd', text: '#fff' },
  { label: '_C1', hint: 'Dye Color 1 – main/base',      color: '#ff6ec7', text: '#fff' },
];

function getBaseName(name: string): string {
  for (const { label } of SUFFIXES) {
    if (name.endsWith(label)) return name.slice(0, -label.length);
  }
  return name;
}

function getActiveSuffix(name: string): string | null {
  for (const { label } of SUFFIXES) {
    if (name.endsWith(label)) return label;
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_');
}

function extractLayers(children: PsdLayer[]): Layer[] {
  let layers: Layer[] = [];
  for (const child of children) {
    if (child.children) {
      layers = layers.concat(extractLayers(child.children));
    } else if (child.canvas) {
      layers.push({
        name: child.name || 'Unnamed Layer',
        canvas: child.canvas as HTMLCanvasElement,
        width: (child.canvas as HTMLCanvasElement).width,
        height: (child.canvas as HTMLCanvasElement).height,
      });
    }
  }
  return layers;
}

export default function LayerExtractor() {
  const [theme, toggleTheme] = useTheme();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkName, setBulkName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const processPSD = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    setLayers([]);
    setLayerNames([]);
    setSelected(new Set());

    try {
      const arrayBuffer = await file.arrayBuffer();
      const psd = readPsd(arrayBuffer);

      if (!psd.children || psd.children.length === 0) {
        throw new Error('No layers found in PSD file');
      }

      const extracted = extractLayers(psd.children);

      if (extracted.length === 0) {
        throw new Error('No visible layers found in PSD file');
      }

      setLayers(extracted);
      setLayerNames(extracted.map((l) => l.name));
    } catch (err) {
      showError(`Failed to process PSD: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.psd')) {
      processPSD(file);
    } else {
      showError('Please upload a valid .psd file');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPSD(file);
  };

  const updateName = (index: number, name: string) => {
    setLayerNames((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  };

  const applySuffixToLayer = (index: number, suffix: string) => {
    const base = getBaseName(layerNames[index] ?? layers[index].name);
    updateName(index, base + suffix);
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(layers.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  const applyBulkName = () => {
    if (!bulkName.trim()) return;
    setLayerNames((prev) => {
      const next = [...prev];
      selected.forEach((i) => {
        const existingSuffix = getActiveSuffix(next[i] ?? '');
        next[i] = bulkName.trim() + (existingSuffix ?? '');
      });
      return next;
    });
  };

  const downloadLayer = (index: number) => {
    const canvas = canvasRefs.current[index];
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(layerNames[index] || `layer_${index + 1}`)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const exportAll = async () => {
    setExporting(true);
    for (let i = 0; i < layers.length; i++) {
      downloadLayer(i);
      await new Promise((res) => setTimeout(res, 100));
    }
    setExporting(false);
  };

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });

  const exportZip = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < layers.length; i++) {
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;
        const blob = await canvasToBlob(canvas);
        const filename = `${sanitizeFilename(layerNames[i] || `layer_${i + 1}`)}.png`;
        zip.file(filename, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ghosty-gals-layers.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  const setCanvasRef = (index: number) => (el: HTMLCanvasElement | null) => {
    canvasRefs.current[index] = el;
    if (el && layers[index]) {
      const ctx = el.getContext('2d');
      if (ctx) {
        el.width = layers[index].canvas.width;
        el.height = layers[index].canvas.height;
        ctx.drawImage(layers[index].canvas, 0, 0);
      }
    }
  };

  const anySelected = selected.size > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700&display=swap');

        .gg-root {
          --bg: linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%);
          --text: #ffffff;
          --subtitle: #c77dff;
          --upload-bg: rgba(255,255,255,0.05);
          --upload-bg-hover: rgba(255,255,255,0.1);
          --upload-bg-drag: rgba(255,110,199,0.2);
          --upload-border: #c77dff;
          --card-bg: rgba(255,255,255,0.08);
          --card-border: rgba(199,125,255,0.2);
          --card-selected-border: #ff6ec7;
          --card-selected-bg: rgba(255,110,199,0.08);
          --layers-header-bg: rgba(255,255,255,0.05);
          --layers-header-border: rgba(199,125,255,0.3);
          --bulk-bar-bg: rgba(255,110,199,0.1);
          --bulk-bar-border: rgba(255,110,199,0.35);
          --input-bg: rgba(255,255,255,0.1);
          --input-bg-focus: rgba(255,255,255,0.15);
          --input-border: rgba(199,125,255,0.3);
          --input-color: #ffffff;
          --meta-color: #c77dff;
          --preview-c1: #2d1b4e;
          --preview-c2: #3d2b5e;
          --toggle-bg: rgba(255,255,255,0.1);
          --toggle-hover: rgba(255,255,255,0.2);
          --toggle-color: #c77dff;
          --checkbox-border: rgba(199,125,255,0.5);
          --select-btn: rgba(255,255,255,0.08);
          --select-btn-hover: rgba(255,255,255,0.15);
          --select-btn-color: #c77dff;
        }

        .gg-root.light {
          --bg: linear-gradient(135deg, #fdf4ff 0%, #f0e6ff 50%, #fdf4ff 100%);
          --text: #2d1b4e;
          --subtitle: #7b2cbf;
          --upload-bg: rgba(157,78,221,0.04);
          --upload-bg-hover: rgba(157,78,221,0.09);
          --upload-bg-drag: rgba(255,110,199,0.12);
          --upload-border: #c77dff;
          --card-bg: rgba(255,255,255,0.85);
          --card-border: rgba(157,78,221,0.2);
          --card-selected-border: #ff6ec7;
          --card-selected-bg: rgba(255,110,199,0.06);
          --layers-header-bg: rgba(255,255,255,0.7);
          --layers-header-border: rgba(157,78,221,0.25);
          --bulk-bar-bg: rgba(255,110,199,0.07);
          --bulk-bar-border: rgba(255,110,199,0.3);
          --input-bg: rgba(157,78,221,0.06);
          --input-bg-focus: rgba(157,78,221,0.12);
          --input-border: rgba(157,78,221,0.3);
          --input-color: #2d1b4e;
          --meta-color: #7b2cbf;
          --preview-c1: #e8d5ff;
          --preview-c2: #f5eeff;
          --toggle-bg: rgba(157,78,221,0.1);
          --toggle-hover: rgba(157,78,221,0.18);
          --toggle-color: #7b2cbf;
          --checkbox-border: rgba(157,78,221,0.4);
          --select-btn: rgba(157,78,221,0.07);
          --select-btn-hover: rgba(157,78,221,0.14);
          --select-btn-color: #7b2cbf;
        }

        .gg-root {
          font-family: 'Nunito', sans-serif;
          background: var(--bg);
          min-height: 100vh;
          padding: 40px 20px;
          color: var(--text);
          transition: background 0.3s ease, color 0.3s ease;
        }

        .gg-container { max-width: 1200px; margin: 0 auto; }

        .gg-topbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 8px;
        }

        .gg-theme-toggle {
          background: var(--toggle-bg);
          border: 1px solid var(--input-border);
          border-radius: 20px;
          padding: 8px 16px;
          color: var(--toggle-color);
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.9em;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .gg-theme-toggle:hover { background: var(--toggle-hover); }

        .gg-header { text-align: center; margin-bottom: 50px; }

        .gg-logo {
          animation: gg-logo-float 3s ease-in-out infinite;
          margin-bottom: 16px;
        }

        @keyframes gg-logo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .gg-h1 {
          font-family: 'Fredoka One', cursive;
          font-size: 3em;
          background: linear-gradient(135deg, #ff6ec7 0%, #c77dff 50%, #9d4edd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }

        .gg-subtitle { font-size: 1.2em; color: var(--subtitle); opacity: 0.9; }

        .gg-upload-zone {
          background: var(--upload-bg);
          border: 3px dashed var(--upload-border);
          border-radius: 20px;
          padding: 60px 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 40px;
        }

        .gg-upload-zone:hover {
          background: var(--upload-bg-hover);
          border-color: #ff6ec7;
          transform: translateY(-5px);
        }

        .gg-upload-zone.dragging {
          background: var(--upload-bg-drag);
          border-color: #ff6ec7;
          transform: scale(1.02);
        }

        .gg-upload-icon {
          font-size: 4em;
          margin-bottom: 20px;
          display: block;
          animation: gg-float 3s ease-in-out infinite;
        }

        @keyframes gg-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .gg-upload-text { font-size: 1.3em; font-weight: 600; color: #ff6ec7; margin-bottom: 10px; }
        .gg-upload-hint { color: var(--subtitle); opacity: 0.8; }

        .gg-error {
          background: rgba(255,0,80,0.15);
          border: 2px solid #ff0050;
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 20px;
          color: #d00045;
        }

        .gg-loading { text-align: center; padding: 40px; font-size: 1.3em; color: #ff6ec7; }

        .gg-spinner {
          display: inline-block;
          width: 50px;
          height: 50px;
          border: 5px solid rgba(255,110,199,0.3);
          border-top-color: #ff6ec7;
          border-radius: 50%;
          animation: gg-spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes gg-spin { to { transform: rotate(360deg); } }

        .gg-layers-section { animation: gg-fade-in 0.5s ease; }

        @keyframes gg-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Layers toolbar ── */
        .gg-layers-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 16px 20px;
          background: var(--layers-header-bg);
          border-radius: 15px;
          border: 2px solid var(--layers-header-border);
          flex-wrap: wrap;
          gap: 12px;
        }

        .gg-layers-title {
          font-family: 'Fredoka One', cursive;
          font-size: 1.8em;
          color: #ff6ec7;
        }

        .gg-header-buttons { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }

        .gg-select-row {
          display: flex;
          gap: 8px;
          align-items: center;
          width: 100%;
          padding-top: 4px;
          border-top: 1px solid var(--layers-header-border);
          flex-wrap: wrap;
        }

        .gg-select-btn {
          background: var(--select-btn);
          border: 1px solid var(--input-border);
          border-radius: 12px;
          padding: 6px 14px;
          color: var(--select-btn-color);
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.85em;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .gg-select-btn:hover { background: var(--select-btn-hover); }

        .gg-selected-count {
          font-size: 0.85em;
          color: var(--meta-color);
          margin-left: auto;
        }

        /* ── Bulk rename bar ── */
        .gg-bulk-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          background: var(--bulk-bar-bg);
          border: 2px solid var(--bulk-bar-border);
          border-radius: 14px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          animation: gg-fade-in 0.25s ease;
        }

        .gg-bulk-label {
          font-weight: 700;
          color: #ff6ec7;
          font-size: 0.95em;
          white-space: nowrap;
        }

        .gg-bulk-input {
          flex: 1;
          min-width: 160px;
          background: var(--input-bg);
          border: 2px solid var(--input-border);
          border-radius: 10px;
          padding: 10px 14px;
          color: var(--input-color);
          font-family: 'Nunito', sans-serif;
          font-size: 0.95em;
          font-weight: 600;
          outline: none;
          transition: all 0.2s ease;
        }

        .gg-bulk-input:focus {
          border-color: #ff6ec7;
          background: var(--input-bg-focus);
        }

        .gg-bulk-apply {
          background: linear-gradient(135deg, #ff6ec7, #c77dff);
          color: white;
          border: none;
          padding: 10px 22px;
          border-radius: 12px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.9em;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .gg-bulk-apply:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255,110,199,0.4); }

        .gg-bulk-hint {
          font-size: 0.8em;
          color: var(--meta-color);
          opacity: 0.8;
          width: 100%;
        }

        /* ── Export buttons ── */
        .gg-export-all-btn {
          background: linear-gradient(135deg, #ff6ec7, #c77dff);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.95em;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 5px 20px rgba(255,110,199,0.3);
        }

        .gg-export-all-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(255,110,199,0.5);
        }

        .gg-export-all-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .gg-export-zip-btn {
          background: linear-gradient(135deg, #c77dff, #9d4edd);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.95em;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 5px 20px rgba(157,78,221,0.3);
        }

        .gg-export-zip-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(157,78,221,0.5);
        }

        .gg-export-zip-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* ── Layer grid ── */
        .gg-layers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 25px;
        }

        .gg-layer-card {
          background: var(--card-bg);
          border-radius: 15px;
          overflow: hidden;
          border: 2px solid var(--card-border);
          transition: all 0.3s ease;
          animation: gg-slide-in 0.5s ease backwards;
        }

        .gg-layer-card.selected {
          border-color: var(--card-selected-border);
          background: var(--card-selected-bg);
          box-shadow: 0 0 0 3px rgba(255,110,199,0.15);
        }

        @keyframes gg-slide-in {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gg-layer-card:hover {
          transform: translateY(-6px);
          border-color: #ff6ec7;
          box-shadow: 0 10px 30px rgba(255,110,199,0.25);
        }

        .gg-layer-card.selected:hover {
          box-shadow: 0 10px 30px rgba(255,110,199,0.25), 0 0 0 3px rgba(255,110,199,0.2);
        }

        /* checkbox row at top of card */
        .gg-card-topbar {
          display: flex;
          align-items: center;
          padding: 10px 14px 0;
          gap: 8px;
        }

        .gg-checkbox {
          width: 18px;
          height: 18px;
          accent-color: #ff6ec7;
          cursor: pointer;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .gg-card-num {
          font-size: 0.8em;
          color: var(--meta-color);
          font-weight: 700;
          margin-left: auto;
        }

        .gg-layer-preview {
          background: repeating-conic-gradient(var(--preview-c1) 0% 25%, var(--preview-c2) 0% 50%) 50% / 20px 20px;
          padding: 16px 20px;
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gg-layer-preview canvas {
          max-width: 100%;
          max-height: 160px;
          image-rendering: crisp-edges;
        }

        .gg-layer-info { padding: 14px 16px 16px; }

        .gg-layer-name-input {
          width: 100%;
          background: var(--input-bg);
          border: 2px solid var(--input-border);
          border-radius: 10px;
          padding: 10px 13px;
          color: var(--input-color);
          font-family: 'Nunito', sans-serif;
          font-size: 0.95em;
          font-weight: 600;
          margin-bottom: 10px;
          transition: all 0.3s ease;
          outline: none;
          box-sizing: border-box;
        }

        .gg-layer-name-input:focus {
          border-color: #ff6ec7;
          background: var(--input-bg-focus);
        }

        /* ── Suffix chips ── */
        .gg-suffix-row {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .gg-suffix-chip {
          padding: 4px 10px;
          border-radius: 20px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 0.78em;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.15s ease;
          opacity: 0.55;
        }

        .gg-suffix-chip:hover { opacity: 0.85; transform: translateY(-1px); }

        .gg-suffix-chip.active {
          opacity: 1;
          border-color: rgba(255,255,255,0.5);
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0,0,0,0.25);
        }

        .gg-layer-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.85em;
          color: var(--meta-color);
        }

        .gg-download-btn {
          width: 100%;
          background: linear-gradient(135deg, #9d4edd, #7b2cbf);
          color: white;
          border: none;
          padding: 10px;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9em;
        }

        .gg-download-btn:hover {
          background: linear-gradient(135deg, #c77dff, #9d4edd);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(157,78,221,0.35);
        }
      `}</style>

      <div className={`gg-root${theme === 'light' ? ' light' : ''}`}>
        <div className="gg-container">

          <div className="gg-topbar">
            <button className="gg-theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
          </div>

          <header className="gg-header">
            <Image
              src="/ghostygals-logo.png"
              alt="Ghosty Gals"
              width={120}
              height={120}
              className="gg-logo"
              priority
            />
            <h1 className="gg-h1">Ghosty Gals Layer Extractor</h1>
            <p className="gg-subtitle">Upload your PSD, name your layers, export as PNGs~</p>
          </header>

          <div
            className={`gg-upload-zone${dragging ? ' dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <span className="gg-upload-icon">📁👻</span>
            <div className="gg-upload-text">Drop your PSD file here</div>
            <p className="gg-upload-hint">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".psd"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {error && <div className="gg-error">⚠️ {error}</div>}

          {loading && (
            <div className="gg-loading">
              <div className="gg-spinner" />
              <div>Extracting ghosty gals layers...</div>
            </div>
          )}

          {layers.length > 0 && !loading && (
            <div className="gg-layers-section">

              {/* ── Toolbar ── */}
              <div className="gg-layers-header">
                <div className="gg-layers-title">
                  {layers.length} Layer{layers.length !== 1 ? 's' : ''} Found
                </div>
                <div className="gg-header-buttons">
                  <button className="gg-export-zip-btn" onClick={exportZip} disabled={zipping || exporting}>
                    {zipping ? '⏳ Zipping...' : '🗜️ Download ZIP'}
                  </button>
                  <button className="gg-export-all-btn" onClick={exportAll} disabled={exporting || zipping}>
                    {exporting ? '⏳ Exporting...' : '💾 Export All Layers'}
                  </button>
                </div>

                <div className="gg-select-row">
                  <button className="gg-select-btn" onClick={selectAll}>Select all</button>
                  <button className="gg-select-btn" onClick={deselectAll}>Deselect all</button>
                  {anySelected && (
                    <span className="gg-selected-count">{selected.size} selected</span>
                  )}
                </div>
              </div>

              {/* ── Bulk rename bar (shown when anything is selected) ── */}
              {anySelected && (
                <div className="gg-bulk-bar">
                  <span className="gg-bulk-label">Rename {selected.size} layer{selected.size !== 1 ? 's' : ''}:</span>
                  <input
                    className="gg-bulk-input"
                    type="text"
                    placeholder="e.g. cutie crumb"
                    value={bulkName}
                    onChange={(e) => setBulkName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyBulkName()}
                  />
                  <button className="gg-bulk-apply" onClick={applyBulkName}>Apply</button>
                  <span className="gg-bulk-hint">
                    Sets the base name on selected layers — existing suffixes (_C1, _L, etc.) are kept.
                  </span>
                </div>
              )}

              {/* ── Layer cards ── */}
              <div className="gg-layers-grid">
                {layers.map((layer, i) => {
                  const currentName = layerNames[i] ?? layer.name;
                  const activeSuffix = getActiveSuffix(currentName);
                  const isSelected = selected.has(i);

                  return (
                    <div
                      key={i}
                      className={`gg-layer-card${isSelected ? ' selected' : ''}`}
                      style={{ animationDelay: `${i * 0.07}s` }}
                    >
                      <div className="gg-card-topbar">
                        <input
                          type="checkbox"
                          className="gg-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(i)}
                        />
                        <span className="gg-card-num">#{i + 1}</span>
                      </div>

                      <div className="gg-layer-preview">
                        <canvas ref={setCanvasRef(i)} />
                      </div>

                      <div className="gg-layer-info">
                        <input
                          type="text"
                          className="gg-layer-name-input"
                          value={currentName}
                          placeholder="Layer name..."
                          onChange={(e) => updateName(i, e.target.value)}
                        />

                        {/* Suffix chips */}
                        <div className="gg-suffix-row">
                          {SUFFIXES.map(({ label, hint, color, text }) => (
                            <button
                              key={label}
                              className={`gg-suffix-chip${activeSuffix === label ? ' active' : ''}`}
                              style={{ background: color, color: text }}
                              title={hint}
                              onClick={() => applySuffixToLayer(i, label)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="gg-layer-meta">
                          <span>{layer.width} × {layer.height}px</span>
                        </div>

                        <button className="gg-download-btn" onClick={() => downloadLayer(i)}>
                          ⬇️ Download PNG
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
