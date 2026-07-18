import React from 'react';
import { X, Layers, Box, Activity, Zap, CheckCircle2, FileCode } from 'lucide-react';

export const HelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">How 2D X-Ray to 3D Conversion Works</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs leading-relaxed">
          {/* Section 1 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-cyan-300 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              1. X-Ray Radiodensity & Bone Segmentation
            </h4>
            <p className="text-slate-300">
              In X-ray radiographs, bone tissue absorbs X-ray photons (high attenuation coefficient) appearing as bright white pixels (high radiodensity Hounsfield Units). Soft tissue and air appear dark. Our preprocessor filters background clutter, applies contrast scaling, and computes a 2D depth density matrix.
            </p>
          </div>

          {/* Section 2 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-cyan-300 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              2. CSS 3D GPU Volumetric Slice Projection
            </h4>
            <p className="text-slate-300">
              Using CSS <code className="text-cyan-300 font-mono px-1 py-0.5 rounded bg-slate-800">transform-style: preserve-3d</code> and hardware-accelerated GPU matrix transforms, the 2D image is partitioned into multiple parallel Z-plane slices. This displays volumetric depth parallax with real-time interactive mouse orbit.
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-emerald-300 text-sm flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-400" />
              3. Three.js WebGL 3D Surface Reconstruction
            </h4>
            <p className="text-slate-300">
              The density matrix is converted into a 3D vertex mesh in WebGL. Vertex displacement maps create double-sided cortical bone thickness, custom PBR Ivory / Phosphor shaders simulate bone light reflection, and clipping planes allow cross-section inspection.
            </p>
          </div>

          {/* Section 4 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-amber-300 text-sm flex items-center gap-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              4. 3D Model Export (STL & OBJ)
            </h4>
            <p className="text-slate-300">
              Reconstructed 3D bone models can be exported directly as binary <code className="text-amber-300 font-mono px-1 py-0.5 rounded bg-slate-800">.STL</code> or <code className="text-amber-300 font-mono px-1 py-0.5 rounded bg-slate-800">.OBJ</code> files, ready for 3D printing or importing into Blender, CAD, or medical visualization suites!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            Got It, Let's Explore
          </button>
        </div>
      </div>
    </div>
  );
};
