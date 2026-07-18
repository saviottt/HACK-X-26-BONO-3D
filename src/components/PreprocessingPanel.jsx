import React from 'react';
import { Sliders, Upload, Sun, Contrast, Eye, Activity, Sparkles, Check, RefreshCw } from 'lucide-react';

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
      contrast: 0,
      threshold: 20,
      invert: false,
      edgeMode: false
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm tracking-wide">2D X-Ray Preprocessor</h3>
            <p className="text-xs text-slate-400">Density Segmentation & Filtering</p>
          </div>
        </div>

        <button
          onClick={handleResetFilters}
          className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset 2D Image Filters"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content Scroll Container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        {/* Sample X-Ray Picker */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-3 flex items-center justify-between">
            <span>Select X-Ray Scan</span>
            <span className="text-[10px] text-cyan-400 font-mono">6 Built-in Datasets</span>
          </label>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {samples.map((sample) => {
              const isSelected = activeSampleId === sample.id;
              return (
                <button
                  key={sample.id}
                  onClick={() => onSelectSample(sample)}
                  className={`group relative rounded-xl p-1.5 border text-left transition-all duration-200 overflow-hidden ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.25)]'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="aspect-square w-full rounded-lg bg-slate-950 overflow-hidden mb-1.5">
                    <img
                      src={sample.dataUrl}
                      alt={sample.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="text-[11px] font-medium text-slate-200 truncate px-0.5">
                    {sample.name.split(' ')[0]}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Upload Custom File Button */}
          <label className="relative flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 hover:bg-slate-800/40 hover:border-cyan-500/50 text-slate-300 text-xs font-medium cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Upload Custom X-Ray Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={onCustomUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Live Filtered 2D Preview Canvas */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5 flex items-center justify-between">
            <span>Filtered Density Map</span>
            <span className="text-[10px] text-emerald-400 font-mono">Isolated Bone Mask</span>
          </label>

          <div className="relative aspect-square w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
            {processedPreview ? (
              <img
                src={processedPreview}
                alt="Processed X-Ray"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-slate-500">Processing scan...</div>
            )}

            {/* Invert & Edge Mode Quick Badges */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              {options.invert && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                  Inverted
                </span>
              )}
              {options.edgeMode && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
                  Sobel Edge
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Density Adjuster Sliders */}
        <div className="space-y-4 pt-2 border-t border-slate-800/80">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Segmentation Parameters
          </label>

          {/* Bone Threshold Cutoff */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Bone Density Cutoff:
              </span>
              <span className="font-mono text-cyan-300">{options.threshold} HU</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={options.threshold}
              onChange={(e) => handleSliderChange('threshold', parseInt(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Brightness */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                X-Ray Intensity (Brightness):
              </span>
              <span className="font-mono text-slate-400">{options.brightness}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={options.brightness}
              onChange={(e) => handleSliderChange('brightness', parseInt(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Contrast */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Contrast className="w-3.5 h-3.5 text-emerald-400" />
                Cortical Contrast:
              </span>
              <span className="font-mono text-slate-400">{options.contrast}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={options.contrast}
              onChange={(e) => handleSliderChange('contrast', parseInt(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {/* Invert */}
          <button
            onClick={() => handleSliderChange('invert', !options.invert)}
            className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              options.invert
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            Invert Scan
          </button>

          {/* Sobel Edge Mode */}
          <button
            onClick={() => handleSliderChange('edgeMode', !options.edgeMode)}
            className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              options.edgeMode
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Sobel Edge
          </button>
        </div>

        {/* Bone Statistics Card */}
        {stats && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Bone Diagnostic Metrics
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Bone Mass Coverage:</span>
              <span className="font-mono text-emerald-400 font-semibold">{stats.boneRatio}%</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Mean Attenuation:</span>
              <span className="font-mono text-cyan-400 font-semibold">{stats.avgDensity} HU</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Peak Cortical Index:</span>
              <span className="font-mono text-amber-400 font-semibold">{stats.maxDensity} HU</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
