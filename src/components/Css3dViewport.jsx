import React, { useState, useRef, useEffect } from 'react';
import { Layers, RotateCw, Move3D, Eye, Zap, Sliders, RefreshCw } from 'lucide-react';

export const Css3dViewport = ({
  processedImage,
  rawImage,
  activeSampleName,
  stats
}) => {
  const [rotX, setRotX] = useState(-25);
  const [rotY, setRotY] = useState(35);
  const [layerCount, setLayerCount] = useState(14);
  const [layerSpacing, setLayerSpacing] = useState(12);
  const [isExploded, setIsExploded] = useState(false);
  const [activeTheme, setActiveTheme] = useState('cyan'); // cyan, emerald, gold, purple
  const [activeSlice, setActiveSlice] = useState(null);

  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });

  // Mouse Orbit controls for CSS 3D box
  const handleMouseDown = (e) => {
    isDragging.current = true;
    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMouse.current.x;
    const deltaY = e.clientY - previousMouse.current.y;

    setRotY((prev) => prev + deltaX * 0.5);
    setRotX((prev) => Math.max(-85, Math.min(85, prev - deltaY * 0.5)));

    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const resetRotation = () => {
    setRotX(-25);
    setRotY(35);
    setIsExploded(false);
  };

  // Theme styling definitions
  const themeStyles = {
    cyan: {
      border: 'rgba(0, 242, 254, 0.4)',
      shadow: 'rgba(0, 242, 254, 0.25)',
      glow: '#00f2fe',
      filter: 'hue-rotate(0deg) contrast(1.2)'
    },
    emerald: {
      border: 'rgba(0, 230, 153, 0.4)',
      shadow: 'rgba(0, 230, 153, 0.25)',
      glow: '#00e699',
      filter: 'hue-rotate(100deg) contrast(1.3)'
    },
    gold: {
      border: 'rgba(255, 184, 0, 0.4)',
      shadow: 'rgba(255, 184, 0, 0.25)',
      glow: '#ffb800',
      filter: 'sepia(1) hue-rotate(5deg) saturate(3)'
    },
    purple: {
      border: 'rgba(189, 0, 255, 0.4)',
      shadow: 'rgba(189, 0, 255, 0.25)',
      glow: '#bd00ff',
      filter: 'hue-rotate(240deg) contrast(1.4)'
    }
  };

  const currentTheme = themeStyles[activeTheme];

  // Calculate slice transform
  const currentSpacing = isExploded ? layerSpacing * 2.8 : layerSpacing;

  return (
    <div className="css3d-container relative w-full h-full flex flex-col bg-[#070b12] rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl">
      {/* Top Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm tracking-wide flex items-center gap-2">
              CSS 3D Volumetric Slice Stack
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                GPU Preserve-3D
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive Z-Plane Parallax Projection ({layerCount} Slices)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Explode Slice Toggle */}
          <button
            onClick={() => setIsExploded(!isExploded)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
              isExploded
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Move3D className="w-3.5 h-3.5" />
            {isExploded ? 'Exploded View (ON)' : 'Explode Slices'}
          </button>

          {/* Color Scheme Picker */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
            {Object.keys(themeStyles).map((themeKey) => (
              <button
                key={themeKey}
                onClick={() => setActiveTheme(themeKey)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  activeTheme === themeKey ? 'scale-125 ring-2 ring-white/60' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: themeStyles[themeKey].glow }}
                title={`${themeKey.toUpperCase()} Holographic Filter`}
              />
            ))}
          </div>

          {/* Reset Orbit */}
          <button
            onClick={resetRotation}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
            title="Reset CSS 3D View"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive CSS 3D Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center select-none overflow-hidden bg-radial-grid"
      >
        {/* Background Ambient Glow */}
        <div
          className="absolute w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-25 transition-colors duration-500"
          style={{ backgroundColor: currentTheme.glow }}
        />

        {/* CSS 3D Stage / Scene */}
        <div
          className="css3d-stage transition-transform duration-75 ease-out"
          style={{
            perspective: '1200px',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Rotating Outer Box */}
          <div
            className="css3d-object relative transition-transform duration-100 ease-out"
            style={{
              width: '320px',
              height: '320px',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`
            }}
          >
            {/* Holographic Bounding Grid Lines */}
            <div
              className="absolute inset-0 rounded-xl pointer-events-none border border-dashed border-cyan-500/20"
              style={{
                transform: `translateZ(${-(layerCount * currentSpacing) / 2}px)`,
                boxShadow: `0 0 40px ${currentTheme.shadow}`
              }}
            />
            <div
              className="absolute inset-0 rounded-xl pointer-events-none border border-dashed border-cyan-500/20"
              style={{
                transform: `translateZ(${(layerCount * currentSpacing) / 2}px)`
              }}
            />

            {/* Generated Slice Stack */}
            {Array.from({ length: layerCount }).map((_, index) => {
              // Calculate z offset centered at 0
              const centerIndex = (layerCount - 1) / 2;
              const zOffset = (index - centerIndex) * currentSpacing;
              const isHovered = activeSlice === index;
              const opacity = 0.5 + (1 - Math.abs(index - centerIndex) / centerIndex) * 0.45;

              return (
                <div
                  key={index}
                  onMouseEnter={() => setActiveSlice(index)}
                  onMouseLeave={() => setActiveSlice(null)}
                  className="absolute inset-0 rounded-xl overflow-hidden transition-all duration-300"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: `translateZ(${zOffset}px) scale(${isHovered ? 1.05 : 1})`,
                    border: isHovered
                      ? `2px solid ${currentTheme.glow}`
                      : `1px solid ${currentTheme.border}`,
                    boxShadow: isHovered
                      ? `0 0 25px ${currentTheme.glow}`
                      : `0 0 10px ${currentTheme.shadow}`,
                    opacity: isHovered ? 1 : opacity,
                    backdropFilter: 'blur(2px)'
                  }}
                >
                  {/* Slice Layer Image with CSS Filter Depth */}
                  <img
                    src={processedImage || rawImage}
                    alt={`Slice ${index + 1}`}
                    className="w-full h-full object-cover pointer-events-none transition-all duration-300"
                    style={{
                      filter: `${currentTheme.filter} opacity(${0.75 + (index % 3) * 0.08})`,
                      mixBlendMode: 'screen'
                    }}
                  />

                  {/* Slice Index Tag */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                    Z: {Math.round(zOffset)}mm
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Viewport Floating Info Badge */}
        <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-slate-400">Orbit Pitch: {Math.round(rotX)}°</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <span className="font-mono text-slate-400">Yaw: {Math.round(rotY)}°</span>
          {activeSlice !== null && (
            <>
              <div className="h-3 w-px bg-slate-700" />
              <span className="text-cyan-300 font-semibold">Active Slice #{activeSlice + 1}</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Parameter Adjuster Slider Panel */}
      <div className="px-5 py-3 bg-slate-900/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-6 text-xs text-slate-300">
        <div className="flex items-center gap-6 flex-1 max-w-xl">
          {/* Layer Count Slider */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-slate-400 font-medium whitespace-nowrap flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Slice Count ({layerCount}):
            </span>
            <input
              type="range"
              min="6"
              max="24"
              value={layerCount}
              onChange={(e) => setLayerCount(parseInt(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Z-Spacing Slider */}
          <div className="flex items-center gap-3 flex-1">
            <span className="text-slate-400 font-medium whitespace-nowrap flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Z-Depth Gap ({layerSpacing}px):
            </span>
            <input
              type="range"
              min="4"
              max="30"
              value={layerSpacing}
              onChange={(e) => setLayerSpacing(parseInt(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Slice Stack Info */}
        <div className="text-right text-[11px] font-mono text-slate-400">
          Total CSS 3D Volumetric Depth: <span className="text-cyan-300 font-semibold">{layerCount * layerSpacing}mm</span>
        </div>
      </div>
    </div>
  );
};
