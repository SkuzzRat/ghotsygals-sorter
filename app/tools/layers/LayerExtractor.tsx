'use client';

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react';
import { readPsd, Layer as PsdLayer } from 'ag-psd';

interface Layer {
  name: string;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
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
  const [layers, setLayers] = useState<Layer[]>([]);
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700&display=swap');

        .gg-body {
          font-family: 'Nunito', sans-serif;
          background: linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 50%, #1a0b2e 100%);
          min-height: 100vh;
          padding: 40px 20px;
          color: #fff;
        }

        .gg-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .gg-header {
          text-align: center;
          margin-bottom: 50px;
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

        .gg-subtitle {
          font-size: 1.2em;
          color: #c77dff;
          opacity: 0.9;
        }

        .gg-upload-zone {
          background: rgba(255,255,255,0.05);
          border: 3px dashed #c77dff;
          border-radius: 20px;
          padding: 60px 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 40px;
        }

        .gg-upload-zone:hover {
          background: rgba(255,255,255,0.1);
          border-color: #ff6ec7;
          transform: translateY(-5px);
        }

        .gg-upload-zone.dragging {
          background: rgba(255,110,199,0.2);
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

        .gg-upload-text {
          font-size: 1.3em;
          font-weight: 600;
          color: #ff6ec7;
          margin-bottom: 10px;
        }

        .gg-upload-hint {
          color: #c77dff;
          opacity: 0.8;
        }

        .gg-error {
          background: rgba(255,0,80,0.2);
          border: 2px solid #ff0050;
          border-radius: 15px;
          padding: 20px;
          margin-bottom: 20px;
          color: #ffb3d9;
        }

        .gg-loading {
          text-align: center;
          padding: 40px;
          font-size: 1.3em;
          color: #ff6ec7;
        }

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

        @keyframes gg-spin {
          to { transform: rotate(360deg); }
        }

        .gg-layers-section {
          animation: gg-fade-in 0.5s ease;
        }

        @keyframes gg-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gg-layers-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px;
          background: rgba(255,255,255,0.05);
          border-radius: 15px;
          border: 2px solid rgba(199,125,255,0.3);
        }

        .gg-layers-title {
          font-family: 'Fredoka One', cursive;
          font-size: 1.8em;
          color: #ff6ec7;
        }

        .gg-export-all-btn {
          background: linear-gradient(135deg, #ff6ec7, #c77dff);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 25px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 1em;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 5px 20px rgba(255,110,199,0.4);
        }

        .gg-export-all-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(255,110,199,0.6);
        }

        .gg-export-all-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .gg-layers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 25px;
        }

        .gg-layer-card {
          background: rgba(255,255,255,0.08);
          border-radius: 15px;
          overflow: hidden;
          border: 2px solid rgba(199,125,255,0.2);
          transition: all 0.3s ease;
          animation: gg-slide-in 0.5s ease backwards;
        }

        @keyframes gg-slide-in {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .gg-layer-card:hover {
          transform: translateY(-8px);
          border-color: #ff6ec7;
          box-shadow: 0 10px 30px rgba(255,110,199,0.3);
        }

        .gg-layer-preview {
          background: repeating-conic-gradient(#2d1b4e 0% 25%, #3d2b5e 0% 50%) 50% / 20px 20px;
          padding: 20px;
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gg-layer-preview canvas {
          max-width: 100%;
          max-height: 180px;
          image-rendering: crisp-edges;
        }

        .gg-layer-info {
          padding: 20px;
        }

        .gg-layer-name-input {
          width: 100%;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(199,125,255,0.3);
          border-radius: 10px;
          padding: 12px 15px;
          color: white;
          font-family: 'Nunito', sans-serif;
          font-size: 1em;
          font-weight: 600;
          margin-bottom: 15px;
          transition: all 0.3s ease;
          outline: none;
          box-sizing: border-box;
        }

        .gg-layer-name-input:focus {
          border-color: #ff6ec7;
          background: rgba(255,255,255,0.15);
        }

        .gg-layer-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          font-size: 0.9em;
          color: #c77dff;
        }

        .gg-download-btn {
          width: 100%;
          background: linear-gradient(135deg, #9d4edd, #7b2cbf);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.95em;
        }

        .gg-download-btn:hover {
          background: linear-gradient(135deg, #c77dff, #9d4edd);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(157,78,221,0.4);
        }
      `}</style>

      <div className="gg-body">
        <div className="gg-container">
          <header className="gg-header">
            <h1 className="gg-h1">👻 Ghosty Gals Layer Extractor</h1>
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

          {error && (
            <div className="gg-error">⚠️ {error}</div>
          )}

          {loading && (
            <div className="gg-loading">
              <div className="gg-spinner" />
              <div>Extracting ghosty gals layers...</div>
            </div>
          )}

          {layers.length > 0 && !loading && (
            <div className="gg-layers-section">
              <div className="gg-layers-header">
                <div className="gg-layers-title">
                  {layers.length} Layer{layers.length !== 1 ? 's' : ''} Found
                </div>
                <button
                  className="gg-export-all-btn"
                  onClick={exportAll}
                  disabled={exporting}
                >
                  {exporting ? '⏳ Exporting...' : '💾 Export All Layers'}
                </button>
              </div>

              <div className="gg-layers-grid">
                {layers.map((layer, i) => (
                  <div
                    key={i}
                    className="gg-layer-card"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="gg-layer-preview">
                      <canvas ref={setCanvasRef(i)} />
                    </div>
                    <div className="gg-layer-info">
                      <input
                        type="text"
                        className="gg-layer-name-input"
                        value={layerNames[i] ?? layer.name}
                        placeholder="Layer name..."
                        onChange={(e) => {
                          const next = [...layerNames];
                          next[i] = e.target.value;
                          setLayerNames(next);
                        }}
                      />
                      <div className="gg-layer-meta">
                        <span>{layer.width} × {layer.height}px</span>
                        <span>#{i + 1}</span>
                      </div>
                      <button
                        className="gg-download-btn"
                        onClick={() => downloadLayer(i)}
                      >
                        ⬇️ Download PNG
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
