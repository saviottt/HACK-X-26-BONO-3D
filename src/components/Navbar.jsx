import React, { useState } from 'react';
import { Box, Layers, Columns, Sparkles, HelpCircle, FileText, Activity } from 'lucide-react';

export const Navbar = ({ viewMode, onViewModeChange, onOpenHelp }) => {
  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 z-30">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_20px_rgba(0,242,254,0.4)]">
          <Activity className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
            OsteoVision 3D
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              X-Ray to 3D AI
            </span>
          </h1>
          <p className="text-xs text-slate-400">2D Radiograph Volumetric Bone Reconstruction Engine</p>
        </div>
      </div>

      {/* View Mode Segmented Controls */}
      <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
        {/* Three.js 3D View */}
        <button
          onClick={() => onViewModeChange('three')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            viewMode === 'three'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-[0_0_15px_rgba(0,230,153,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>Three.js 3D Mesh</span>
        </button>

        {/* CSS 3D Slice Stack */}
        <button
          onClick={() => onViewModeChange('css3d')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            viewMode === 'css3d'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>CSS 3D Slice Stack</span>
        </button>

        {/* Dual Split View */}
        <button
          onClick={() => onViewModeChange('split')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            viewMode === 'split'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Columns className="w-4 h-4" />
          <span>Dual Split View</span>
        </button>
      </div>

      {/* Right Utility Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenHelp}
          className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>How It Works</span>
        </button>
      </div>
    </header>
  );
};
