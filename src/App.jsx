import React, { useState, useEffect } from 'react';
import { ThreeDViewport } from './components/ThreeDViewport';
import { PreprocessingPanel } from './components/PreprocessingPanel';
import { processXrayImage, postProcessAIDepthMap } from './utils/imageProcessing';
import { generateSampleXrays } from './utils/sampleXrays';
import { Upload, Box, RefreshCw, ArrowRight, Sparkles, Brain } from 'lucide-react';

const HEADER_H = 52; // px — fixed header height

export function App() {
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  const [isConverted, setIsConverted] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [defaultSample, setDefaultSample] = useState(null);

  // Preprocessor & Render Options State
  const [samples, setSamples] = useState([]);
  const [activeSampleId, setActiveSampleId] = useState('femur');
  const [options, setOptions] = useState({
    brightness: 0,
    contrast: 20,
    threshold: 0, // 0 = Auto (Otsu)
    engine: 'procedural', // 'procedural' or 'ai'
    depthScale: 25,
    translucency: 0.15,
    roughness: 0.35,
    marrowEnabled: true,
    theme: 'ivory',
  });

  // AI Worker State
  const [worker, setWorker] = useState(null);
  const [aiStatus, setAiStatus] = useState('Initializing AI...');
  const [aiProgress, setAiProgress] = useState(0);
  const [isAiReady, setIsAiReady] = useState(false);

  useEffect(() => {
    // Initialize Web Worker for AI Depth Estimation
    const aiWorker = new Worker(new URL('./workers/depthWorker.js', import.meta.url), {
      type: 'module'
    });

    aiWorker.addEventListener('message', (e) => {
      const { type, data, status, depthMap, width, height, error } = e.data;
      
      switch (type) {
        case 'progress':
          if (data && data.status === 'progress') {
            setAiProgress(Math.round(data.progress));
            setAiStatus(`Downloading AI Model (${Math.round(data.progress)}%)`);
          } else if (data && data.status === 'ready') {
            setAiStatus('AI Model Ready');
            setAiProgress(100);
          } else if (data && data.status === 'initiate') {
             setAiStatus(`Loading ${data.file || 'model'}...`);
             setAiProgress(0);
          }
          break;
        case 'ready':
          setIsAiReady(true);
          setAiStatus('');
          break;
        case 'status':
          setAiStatus(status);
          break;
        case 'complete':
          break;
        case 'error':
          console.error("AI Worker Error:", error);
          setAiStatus(`Error: ${error}`);
          setIsConverting(false);
          break;
      }
    });

    aiWorker.postMessage({ type: 'init' });
    setWorker(aiWorker);

    return () => aiWorker.terminate();
  }, []);

  useEffect(() => {
    const list = generateSampleXrays();
    setSamples(list);
    if (list.length > 0) {
      setDefaultSample(list[0].dataUrl);
      setSelectedImageSrc(list[0].dataUrl);
      setActiveSampleId(list[0].id);
    }
  }, []);

  // Auto-switch to AI engine when model is loaded and ready
  useEffect(() => {
    if (isAiReady) {
      setOptions(prev => ({ ...prev, engine: 'ai' }));
    }
  }, [isAiReady]);

  // Real-time updates when filters or options change
  useEffect(() => {
    if (!isConverted || !selectedImageSrc) return;

    const runReprocessing = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (options.engine === 'ai' && worker && isAiReady) {
          setAiStatus('Running AI Depth Estimation...');
          worker.postMessage({
            type: 'process',
            image: selectedImageSrc,
            resolution: 384
          });

          const onComplete = (e) => {
            if (e.data.type === 'complete') {
              const { depthMap, width, height } = e.data;
              const result = postProcessAIDepthMap(img, depthMap, width, height, 384, options);
              setProcessedData(result);
              setAiStatus('');
              worker.removeEventListener('message', onComplete);
            } else if (e.data.type === 'error') {
              setAiStatus(`Error: ${e.data.error}`);
              worker.removeEventListener('message', onComplete);
            }
          };
          worker.addEventListener('message', onComplete);
        } else {
          const result = processXrayImage(img, {
            brightness: options.brightness,
            contrast: options.contrast,
            threshold: options.threshold,
            resolution: 384
          });
          setProcessedData(result);
        }
      };
      img.src = selectedImageSrc;
    };

    // Debounce the AI generation to prevent backlogging the worker during rapid slider drags
    if (options.engine === 'ai') {
      const timer = setTimeout(runReprocessing, 250);
      return () => clearTimeout(timer);
    } else {
      runReprocessing();
    }
  }, [options.brightness, options.contrast, options.threshold, options.engine, isConverted, selectedImageSrc, isAiReady, worker]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSelectedImageSrc(ev.target.result);
      setActiveSampleId('custom');
      setIsConverted(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample) => {
    setSelectedImageSrc(sample.dataUrl);
    setActiveSampleId(sample.id);

    // If already in 3D mode, automatically generate the model for the new sample
    if (isConverted) {
      setIsConverting(true);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (options.engine === 'ai' && worker && isAiReady) {
          setAiStatus('Running AI Depth Estimation...');
          worker.postMessage({
            type: 'process',
            image: sample.dataUrl,
            resolution: 384
          });
          const onComplete = (e) => {
            if (e.data.type === 'complete') {
              const { depthMap, width, height } = e.data;
              const result = postProcessAIDepthMap(img, depthMap, width, height, 384, options);
              setProcessedData(result);
              setIsConverting(false);
              setIsConverted(true);
              worker.removeEventListener('message', onComplete);
            } else if (e.data.type === 'error') {
              setIsConverting(false);
              worker.removeEventListener('message', onComplete);
            }
          };
          worker.addEventListener('message', onComplete);
        } else {
          const result = processXrayImage(img, {
            brightness: options.brightness,
            contrast: options.contrast,
            threshold: options.threshold,
            resolution: 384
          });
          setProcessedData(result);
          setIsConverting(false);
          setIsConverted(true);
        }
      };
      img.src = sample.dataUrl;
    }
  };

  const handleUseSample = () => {
    if (defaultSample) {
      setSelectedImageSrc(defaultSample);
      setActiveSampleId('femur');
      setIsConverted(false);
    }
  };

  const handleConvert = () => {
    if (!selectedImageSrc) return;
    setIsConverting(true);
    
    if (options.engine === 'ai' && worker && isAiReady) {
      setAiStatus('Preparing image...');
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setAiStatus('Running AI Depth Estimation...');
        worker.postMessage({
          type: 'process',
          image: selectedImageSrc,
          resolution: 384
        });

        const onComplete = (e) => {
          if (e.data.type === 'complete') {
            const { depthMap, width, height } = e.data;
            const result = postProcessAIDepthMap(img, depthMap, width, height, 384, options);
            setProcessedData(result);
            setIsConverting(false);
            setIsConverted(true);
            worker.removeEventListener('message', onComplete);
          } else if (e.data.type === 'error') {
             setIsConverting(false);
             worker.removeEventListener('message', onComplete);
          }
        };
        worker.addEventListener('message', onComplete);
      };
      img.src = selectedImageSrc;

    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const run = () => {
        requestAnimationFrame(() => {
          const result = processXrayImage(img, {
            brightness: options.brightness,
            contrast: options.contrast,
            threshold: options.threshold,
            resolution: 384
          });
          setProcessedData(result);
          setIsConverting(false);
          setIsConverted(true);
        });
      };
      img.onload = run;
      img.src = selectedImageSrc;
      if (img.complete) run();
    }
  };

  const handleReset = () => {
    setSelectedImageSrc(defaultSample || null);
    setActiveSampleId(defaultSample ? 'femur' : '');
    setIsConverted(false);
    setProcessedData(null);
    setAiStatus('');
  };

  const handleOptionsChange = (newOptions) => {
    setOptions(newOptions);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#06080e',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#f1f5f9',
        userSelect: 'none',
      }}
    >
      {/* ═══ HEADER — fixed 52px ═══ */}
      <header
        style={{ height: HEADER_H, minHeight: HEADER_H, flexShrink: 0 }}
        className="px-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between z-20"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-tight">X-Ray 3D Scanner</h1>
            <p style={{ fontSize: 10 }} className="text-slate-400">360° Anatomical Bone Viewer</p>
          </div>
        </div>

        {isConverted && (
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Scan
          </button>
        )}
      </header>

      {/* ═══ MAIN — fills every pixel below the header ═══ */}
      <main
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
        className="bg-radial-grid"
      >
        {!isConverted ? (
          /* ── Upload Screen ── */
          <div
            style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}
            className="flex flex-col items-center justify-center gap-5 p-5 custom-scrollbar"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              2D → 3D Bone Scanner
            </div>

            <div className="text-center space-y-1.5">
              <h2 className="text-xl font-bold text-white">Upload Radiograph X-Ray</h2>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Upload any X-ray scan to instantly generate an interactive 360° rotatable 3D bone model.
              </p>
            </div>

            {/* Upload area */}
            <div className="w-full max-w-xs">
              {selectedImageSrc ? (
                <div className="relative w-full aspect-square rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden group shadow-2xl">
                  <img src={selectedImageSrc} alt="X-Ray" className="w-full h-full object-contain" />
                  <label className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-xs text-cyan-300 font-semibold gap-2">
                    <Upload className="w-6 h-6" />
                    Change Image
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed border-slate-700 hover:border-cyan-400 bg-slate-950/60 rounded-2xl cursor-pointer transition-all p-6 group">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-cyan-400 group-hover:scale-110 transition-transform mb-3 shadow-lg">
                    <Upload className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">Tap to upload X-Ray</span>
                  <span className="text-xs text-slate-500 mt-1">PNG or JPG</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>

            {!selectedImageSrc && (
              <button
                onClick={handleUseSample}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 py-2 px-4 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer active:scale-95 transition-transform"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Try Sample Femur X-Ray
              </button>
            )}

            {selectedImageSrc && (
              <div className="w-full max-w-xs flex flex-col gap-2">
                <button
                  onClick={handleConvert}
                  disabled={isConverting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-slate-950 font-bold text-sm transition-all shadow-[0_0_30px_rgba(0,242,254,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:scale-100"
                >
                  {isConverting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Generating Mesh...</>
                  ) : (
                    <>Generate 3D Bone Model<ArrowRight className="w-4 h-4 stroke-[2.5]" /></>
                  )}
                </button>
                {/* AI Status Indicator */}
                {(aiStatus || isConverting) && (
                  <div className="flex flex-col items-center justify-center gap-1 mt-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                      <Brain className="w-3.5 h-3.5" />
                      {aiStatus || (isAiReady ? "AI Core Active" : "AI Loading...")}
                    </div>
                    {aiProgress > 0 && aiProgress < 100 && (
                      <div className="w-3/4 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div 
                          className="h-full bg-cyan-400 transition-all duration-300" 
                          style={{ width: `${aiProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── 3D Workstation Dashboard ── */
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            {/* Sidebar preprocessor & render controls panel */}
            <div style={{ width: 380, minWidth: 380, borderRight: '1px solid #1e293b', background: '#090d16', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
              <PreprocessingPanel
                samples={samples}
                activeSampleId={activeSampleId}
                onSelectSample={handleSelectSample}
                onCustomUpload={handleFileUpload}
                options={options}
                onOptionsChange={handleOptionsChange}
                processedPreview={processedData?.processedDataUrl}
                stats={processedData?.stats}
              />
            </div>
            {/* 3D Viewport on the right */}
            <div style={{ flex: 1, position: 'relative' }}>
              <ThreeDViewport
                depthMatrix={processedData?.depthMatrix}
                resolution={384}
                activeSampleName="3D Bone Scan"
                options={options}
                aspectRatio={processedData?.aspectRatio}
                maxDist={processedData?.maxDist}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
