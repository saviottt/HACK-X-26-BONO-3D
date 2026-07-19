import React from 'react';
import { Sliders, Upload, Sun, Contrast, Eye, Activity, Sparkles, Check, RefreshCw, Layers, Brain, EyeOff } from 'lucide-react';

export const PreprocessingPanel = ({
  samples = [],
  activeSampleId,
  onSelectSample,
  onCustomUpload,
  options,
  onOptionsChange,
  processedPreview,
  stats
}) => {
  const handleSliderChange = (key, val) => {
    onOptionsChange({
      ...options,
      [key]: val
    });
  };

  const handleResetFilters = () => {
    onOptionsChange({
      brightness: 0,
      contrast: 20,
      threshold: 0,
      engine: options.engine, // preserve current engine choice
      depthScale: 25,
      translucency: 0.15,
      roughness: 0.35,
      marrowEnabled: true,
      theme: 'ivory',
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 border-r border-slate-800 overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs tracking-wide">3D Workstation Controls</h3>
            <p className="text-[9px] text-slate-400">Segmentation & Rendering Rig</p>
          </div>
        </div>

        <button
          onClick={handleResetFilters}
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset Parameters"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        {/* Depth Engine Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Reconstruction Engine
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleSliderChange('engine', 'procedural')}
              className={`py-2 px-3 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                options.engine === 'procedural'
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Procedural
            </button>
            <button
              onClick={() => handleSliderChange('engine', 'ai')}
              className={`py-2 px-3 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                options.engine === 'ai'
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              AI depth-anything
            </button>
          </div>
        </div>

        {/* Dataset Pickers */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Active Radiograph Scan
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {samples.map((sample) => {
              const isSelected = activeSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  onClick={() => onSelectSample(sample)}
                  className={`group relative rounded-lg p-1 border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="aspect-square w-full rounded bg-slate-950 overflow-hidden mb-1">
                    <img
                      src={sample.dataUrl}
                      alt={sample.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="text-[10px] font-medium text-slate-300 truncate px-0.5">
                    {sample.name.replace(' X-Ray', '')}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <label className="relative flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-cyan-500/30 text-slate-400 hover:text-slate-300 text-[10px] cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Custom Scan</span>
            <input type="file" accept="image/*" onChange={onCustomUpload} className="hidden" />
          </label>
        </div>

        {/* 2D Preview / Segmented Map */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Segmented Density Map
          </label>
          <div className="relative aspect-square w-full rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
            {processedPreview ? (
              <img
                src={processedPreview}
                alt="Processed Map"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-[10px] text-slate-600">Generating map...</div>
            )}
          </div>
        </div>

        {/* 2D Segmenter Controls */}
        <div className="space-y-3 pt-3 border-t border-slate-900">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            2D Image Filter Parameters
          </label>

          {/* Threshold Cutoff */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Bone Segment Threshold:</span>
              <span className="font-mono text-cyan-300">
                {options.threshold === 0 ? 'Auto (Otsu)' : `${options.threshold} HU`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={options.threshold}
              onChange={(e) => handleSliderChange('threshold', parseInt(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1 rounded cursor-pointer"
            />
          </div>

          {/* Intensity (Brightness) */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>X-Ray Exposure (Brightness):</span>
              <span className="font-mono text-slate-400">{options.brightness > 0 ? `+${options.brightness}` : options.brightness}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={options.brightness}
              onChange={(e) => handleSliderChange('brightness', parseInt(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-1 rounded cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Image Contrast:</span>
              <span className="font-mono text-slate-400">{options.contrast > 0 ? `+${options.contrast}` : options.contrast}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={options.contrast}
              onChange={(e) => handleSliderChange('contrast', parseInt(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-1 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* 3D Reconstruction and Render Controls */}
        <div className="space-y-3 pt-3 border-t border-slate-900">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            3D Reconstruction & Materials
          </label>

          {/* Theme Selector */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1.5">
              <span>Visualization Theme:</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'ivory', name: 'Ivory (Anat)' },
                { id: 'xray', name: 'X-Ray Blue' },
                { id: 'ct_thermal', name: 'CT Thermal' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSliderChange('theme', t.id)}
                  className={`py-1.5 text-[10px] font-semibold rounded border text-center transition-all ${
                    options.theme === t.id
                      ? 'bg-indigo-500/10 border-indigo-400 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Depth Scale */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>3D Model Thickness (Depth Scale):</span>
              <span className="font-mono text-cyan-300">{options.depthScale}</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              value={options.depthScale}
              onChange={(e) => handleSliderChange('depthScale', parseInt(e.target.value))}
              className="w-full accent-indigo-400 bg-slate-800 h-1 rounded cursor-pointer"
            />
          </div>

          {options.theme === 'ivory' && (
            <>
              {/* Bone Translucency */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Bone Translucency (SSS):</span>
                  <span className="font-mono text-cyan-300">{options.translucency.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.8"
                  step="0.02"
                  value={options.translucency}
                  onChange={(e) => handleSliderChange('translucency', parseFloat(e.target.value))}
                  className="w-full accent-pink-400 bg-slate-800 h-1 rounded cursor-pointer"
                />
              </div>

              {/* Surface Roughness */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Surface Roughness (Osteon Gloss):</span>
                  <span className="font-mono text-cyan-300">{options.roughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.02"
                  value={options.roughness}
                  onChange={(e) => handleSliderChange('roughness', parseFloat(e.target.value))}
                  className="w-full accent-teal-400 bg-slate-800 h-1 rounded cursor-pointer"
                />
              </div>

              {/* Trabecular Marrow Toggle */}
              <div className="flex items-center justify-between py-1 bg-slate-900/40 px-2 rounded-lg border border-slate-900">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-red-400" />
                  Dual-Layer Cancellous Marrow
                </span>
                <button
                  onClick={() => handleSliderChange('marrowEnabled', !options.marrowEnabled)}
                  className={`px-3 py-1 rounded text-[10px] font-bold transition-all uppercase ${
                    options.marrowEnabled
                      ? 'bg-red-500/20 border border-red-500/40 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.1)]'
                      : 'bg-slate-900 border border-slate-800 text-slate-500'
                  }`}
                >
                  {options.marrowEnabled ? 'Active' : 'Disabled'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Bone Statistics Card */}
        {stats && (
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-900 space-y-1.5">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Diagnostic Bone Metrics
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Segmentation Engine:</span>
              <span className="font-mono text-cyan-400 uppercase font-semibold">
                {options.engine === 'ai' ? 'Neural AI' : 'Anatomical'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Bone Mass Ratio:</span>
              <span className="font-mono text-emerald-400 font-semibold">{stats.boneRatio}%</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mean Attenuation:</span>
              <span className="font-mono text-cyan-400 font-semibold">{stats.avgDensity} HU</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Otsu Cutoff Point:</span>
              <span className="font-mono text-amber-400 font-semibold">{stats.otsuThreshold} HU</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
