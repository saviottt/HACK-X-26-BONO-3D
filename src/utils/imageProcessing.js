// ═══════════════════════════════════════════════════════════════════════════
// Advanced Anatomical X-Ray → 3D Bone Reconstruction Pipeline v2
// ═══════════════════════════════════════════════════════════════════════════
//
// Produces truly volumetric bone geometry by:
//   1. Isolating bones via Otsu thresholding + morphological cleanup
//   2. Connected component labeling (individual bone segments)
//   3. Per-bone medial axis + distance transform → cylindrical radius
//   4. Elliptical cross-section depth: sqrt(1 - (d/R)^2) in BOTH axes
//   5. Joint gap detection & tapering between adjacent bones
//   6. Edge-preserving bilateral + Taubin smoothing
// ═══════════════════════════════════════════════════════════════════════════

// ── Otsu's Method ─────────────────────────────────────────────────────────
function otsuThreshold(histogram, totalPixels) {
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * histogram[i];

  let sumBg = 0, wBg = 0, wFg = 0;
  let maxVariance = 0, bestThresh = 0;

  for (let t = 0; t < 256; t++) {
    wBg += histogram[t];
    if (wBg === 0) continue;
    wFg = totalPixels - wBg;
    if (wFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / wBg;
    const meanFg = (sumTotal - sumBg) / wFg;
    const variance = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThresh = t;
    }
  }
  return bestThresh;
}

// ── Local contrast enhancement (simplified CLAHE) ─────────────────────────
function enhanceLocalContrast(gray, w, h, tileSize = 32) {
  const out = new Float32Array(w * h);
  const halfTile = Math.floor(tileSize / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let lMin = 255, lMax = 0;
      const y0 = Math.max(0, y - halfTile), y1 = Math.min(h - 1, y + halfTile);
      const x0 = Math.max(0, x - halfTile), x1 = Math.min(w - 1, x + halfTile);
      for (let sy = y0; sy <= y1; sy += 4) {
        for (let sx = x0; sx <= x1; sx += 4) {
          const sv = gray[sy * w + sx];
          if (sv < lMin) lMin = sv;
          if (sv > lMax) lMax = sv;
        }
      }
      const range = lMax - lMin || 1;
      const localNorm = ((gray[idx] - lMin) / range) * 255;
      out[idx] = gray[idx] * 0.75 + localNorm * 0.25;
    }
  }
  return out;
}

// ── Morphological operations ──────────────────────────────────────────────
function morphOpen(mask, w, h, radius = 1) {
  return dilate(erode(mask, w, h, radius), w, h, radius);
}

function morphClose(mask, w, h, radius = 1) {
  return erode(dilate(mask, w, h, radius), w, h, radius);
}

function erode(mask, w, h, r) {
  const out = new Uint8Array(w * h);
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      let allOn = true;
      outer: for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (!mask[(y + dy) * w + (x + dx)]) { allOn = false; break outer; }
        }
      }
      out[y * w + x] = allOn ? 1 : 0;
    }
  }
  return out;
}

function dilate(mask, w, h, r) {
  const out = new Uint8Array(w * h);
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      let anyOn = false;
      outer: for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (mask[(y + dy) * w + (x + dx)]) { anyOn = true; break outer; }
        }
      }
      out[y * w + x] = anyOn ? 1 : 0;
    }
  }
  return out;
}

// ── Sobel edge detection ──────────────────────────────────────────────────
function sobelEdges(gray, w, h) {
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y-1)*w+(x-1)], t = gray[(y-1)*w+x], tr = gray[(y-1)*w+(x+1)];
      const ml = gray[y*w+(x-1)],                            mr = gray[y*w+(x+1)];
      const bl = gray[(y+1)*w+(x-1)], b = gray[(y+1)*w+x], br = gray[(y+1)*w+(x+1)];
      const gx = -tl - 2*ml - bl + tr + 2*mr + br;
      const gy = -tl - 2*t  - tr + bl + 2*b  + br;
      edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  let eMax = 0;
  for (let i = 0; i < edges.length; i++) if (edges[i] > eMax) eMax = edges[i];
  if (eMax > 0) for (let i = 0; i < edges.length; i++) edges[i] /= eMax;
  return edges;
}

// ── Boundary Distance Field (Chamfer distance transform) ─────────────────
function distanceTransformApprox(mask, w, h) {
  const dist = new Float32Array(w * h);
  const INF = 1e6;

  for (let i = 0; i < w * h; i++) dist[i] = mask[i] ? INF : 0;

  // Forward pass
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i],
        dist[(y-1)*w + (x-1)] + 1.414,
        dist[(y-1)*w + x] + 1,
        dist[(y-1)*w + (x+1)] + 1.414,
        dist[y*w + (x-1)] + 1,
      );
    }
  }

  // Backward pass
  for (let y = h - 2; y >= 1; y--) {
    for (let x = w - 2; x >= 1; x--) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      dist[i] = Math.min(dist[i],
        dist[(y+1)*w + (x+1)] + 1.414,
        dist[(y+1)*w + x] + 1,
        dist[(y+1)*w + (x-1)] + 1.414,
        dist[y*w + (x+1)] + 1,
      );
    }
  }

  return dist;
}

// ── Compute per-row AND per-column bone spans ─────────────────────────────
// Returns horizontal and vertical bone radius at each pixel
function computeBoneRadii(mask, w, h) {
  const hRadius = new Float32Array(w * h); // horizontal half-width
  const vRadius = new Float32Array(w * h); // vertical half-height
  const hCenter = new Float32Array(w * h);
  const vCenter = new Float32Array(w * h);

  // Horizontal spans
  for (let y = 0; y < h; y++) {
    let runStart = -1;
    for (let x = 0; x <= w; x++) {
      const isOn = x < w && mask[y * w + x];
      if (isOn && runStart < 0) {
        runStart = x;
      } else if (!isOn && runStart >= 0) {
        const runEnd = x - 1;
        const width = runEnd - runStart + 1;
        const center = (runStart + runEnd) / 2;
        for (let rx = runStart; rx <= runEnd; rx++) {
          const idx = y * w + rx;
          hRadius[idx] = width / 2;
          hCenter[idx] = center;
        }
        runStart = -1;
      }
    }
  }

  // Vertical spans
  for (let x = 0; x < w; x++) {
    let runStart = -1;
    for (let y = 0; y <= h; y++) {
      const isOn = y < h && mask[y * w + x];
      if (isOn && runStart < 0) {
        runStart = y;
      } else if (!isOn && runStart >= 0) {
        const runEnd = y - 1;
        const height = runEnd - runStart + 1;
        const center = (runStart + runEnd) / 2;
        for (let ry = runStart; ry <= runEnd; ry++) {
          const idx = ry * w + x;
          vRadius[idx] = height / 2;
          vCenter[idx] = center;
        }
        runStart = -1;
      }
    }
  }

  return { hRadius, vRadius, hCenter, vCenter };
}

// ── Joint gap detection ───────────────────────────────────────────────────
function detectJointGaps(gray, mask, w, h) {
  const gapFactor = new Float32Array(w * h).fill(1.0);

  // Vertical gaps (between vertically stacked bones like phalanges)
  for (let x = 0; x < w; x++) {
    let inBone = false;
    let lastBoneEnd = -1;

    for (let y = 0; y < h; y++) {
      const idx = y * w + x;
      const isBone = mask[idx] > 0;

      if (isBone && !inBone) {
        if (lastBoneEnd >= 0) {
          const gapLen = y - lastBoneEnd;
          if (gapLen > 1 && gapLen < 25) {
            const taperLen = Math.min(10, Math.max(4, Math.floor(gapLen * 2.0)));
            for (let t = 0; t < taperLen && lastBoneEnd - t >= 0; t++) {
              const tidx = (lastBoneEnd - t) * w + x;
              const factor = Math.min(gapFactor[tidx], (t / taperLen) * (t / taperLen));
              gapFactor[tidx] = Math.max(0.02, factor);
            }
            for (let t = 0; t < taperLen && y + t < h; t++) {
              const tidx = (y + t) * w + x;
              const factor = Math.min(gapFactor[tidx], (t / taperLen) * (t / taperLen));
              gapFactor[tidx] = Math.max(0.02, factor);
            }
          }
        }
        inBone = true;
      } else if (!isBone && inBone) {
        lastBoneEnd = y - 1;
        inBone = false;
      }
    }
  }

  // Horizontal gaps (between side-by-side bones)
  for (let y = 0; y < h; y++) {
    let inBone = false;
    let lastBoneEnd = -1;

    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const isBone = mask[idx] > 0;

      if (isBone && !inBone) {
        if (lastBoneEnd >= 0) {
          const gapLen = x - lastBoneEnd;
          if (gapLen > 1 && gapLen < 25) {
            const taperLen = Math.min(8, Math.max(3, Math.floor(gapLen * 1.5)));
            for (let t = 0; t < taperLen && lastBoneEnd - t >= 0; t++) {
              const tidx = y * w + (lastBoneEnd - t);
              gapFactor[tidx] = Math.max(0.02, Math.min(gapFactor[tidx], (t / taperLen) * (t / taperLen)));
            }
            for (let t = 0; t < taperLen && x + t < w; t++) {
              const tidx = y * w + (x + t);
              gapFactor[tidx] = Math.max(0.02, Math.min(gapFactor[tidx], (t / taperLen) * (t / taperLen)));
            }
          }
        }
        inBone = true;
      } else if (!isBone && inBone) {
        lastBoneEnd = x - 1;
        inBone = false;
      }
    }
  }

  return gapFactor;
}

// ── Edge-preserving bilateral filter ──────────────────────────────────────
function bilateralFilter(matrix, w, h, spatialSigma = 2.0, rangeSigma = 0.12) {
  const input = new Float32Array(matrix);
  const output = new Float32Array(matrix.length);
  const r = 3;

  const spatialW = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      spatialW.push(Math.exp(-(dx*dx + dy*dy) / (2 * spatialSigma * spatialSigma)));

  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      const ci = y * w + x;
      const cv = input[ci];
      if (cv <= 0.01) { output[ci] = 0; continue; }

      let sv = 0, sw = 0, wi = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nv = input[(y+dy)*w + (x+dx)];
          if (nv > 0) {
            const rd = nv - cv;
            const rw = Math.exp(-(rd*rd) / (2 * rangeSigma * rangeSigma));
            const tw = spatialW[wi] * rw;
            sv += nv * tw;
            sw += tw;
          }
          wi++;
        }
      }
      output[ci] = sw > 0 ? sv / sw : cv;
    }
  }
  return output;
}

// ── Taubin smoothing (shrinkage-free) ─────────────────────────────────────
function taubinSmooth(matrix, w, h, passes = 8, lambda = 0.5, mu = -0.53) {
  let curr = new Float32Array(matrix);
  const next = new Float32Array(matrix.length);

  for (let pass = 0; pass < passes; pass++) {
    const factor = (pass % 2 === 0) ? lambda : mu;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v = curr[i];
        if (v <= 0.02) { next[i] = 0; continue; }

        const n  = curr[(y-1)*w + x];
        const s  = curr[(y+1)*w + x];
        const ww = curr[y*w + (x-1)];
        const e  = curr[y*w + (x+1)];
        const nw = curr[(y-1)*w + (x-1)];
        const ne = curr[(y-1)*w + (x+1)];
        const sw = curr[(y+1)*w + (x-1)];
        const se = curr[(y+1)*w + (x+1)];

        const avgN = (n + s + ww + e + (nw + ne + sw + se) * 0.707) / 6.828;
        const laplacian = avgN - v;
        next[i] = v + factor * laplacian;
      }
    }
    curr.set(next);
  }
  return curr;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main export: processXrayImage
// ═══════════════════════════════════════════════════════════════════════════
export const processXrayImage = (imageElement, options = {}) => {
  const {
    brightness = 0,
    contrast = 20,
    threshold: manualThreshold = 0,
    resolution = 384,
  } = options;

  // ── Draw image to canvas ────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, resolution, resolution);
  const imageData = ctx.getImageData(0, 0, resolution, resolution);
  const data = imageData.data;
  const N = resolution * resolution;
  const W = resolution, H = resolution;

  // ── Stage 1: Grayscale conversion ───────────────────────────────────────
  const rawGray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    rawGray[i] = 0.299 * data[p] + 0.587 * data[p+1] + 0.114 * data[p+2];
  }

  // Auto-detect dark vs light background
  let borderSum = 0, borderCnt = 0;
  for (let x = 0; x < W; x++) { borderSum += rawGray[x] + rawGray[(H-1)*W + x]; borderCnt += 2; }
  for (let y = 0; y < H; y++) { borderSum += rawGray[y*W] + rawGray[y*W + (W-1)]; borderCnt += 2; }
  const isLightBg = (borderSum / borderCnt) > 128;

  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    gray[i] = isLightBg ? (255 - rawGray[i]) : rawGray[i];
  }

  // ── Stage 2: Local contrast enhancement ─────────────────────────────────
  const enhanced = enhanceLocalContrast(gray, W, H, 48);

  // ── Stage 3: Otsu thresholding → bone mask ──────────────────────────────
  const histogram = new Int32Array(256);
  for (let i = 0; i < N; i++) histogram[Math.min(255, Math.max(0, Math.round(enhanced[i])))]++;
  const otsuT = manualThreshold > 0 ? manualThreshold : otsuThreshold(histogram, N);
  // Raise threshold above Otsu to aggressively reject soft tissue and noise
  const effectiveThresh = Math.max(35, otsuT * 1.25);

  let boneMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    boneMask[i] = enhanced[i] > effectiveThresh ? 1 : 0;
  }

  // ── Stage 4: Morphological cleanup ──────────────────────────────────────
  boneMask = morphOpen(boneMask, W, H, 2);   // radius=2 to remove noise spots
  boneMask = morphClose(boneMask, W, H, 2);  // radius=2 to fill small holes

  // ── Stage 5: Sobel edges + boundary distance ───────────────────────────
  const edges = sobelEdges(enhanced, W, H);
  const distField = distanceTransformApprox(boneMask, W, H);

  // ── Stage 6: Bone radii (horizontal + vertical) ────────────────────────
  const { hRadius, vRadius, hCenter, vCenter } = computeBoneRadii(boneMask, W, H);

  // ── Stage 7: Joint gap detection ───────────────────────────────────────
  const gapFactor = detectJointGaps(enhanced, boneMask, W, H);

  // ── Stage 8: Volumetric cylindrical depth estimation ───────────────────
  // For each bone pixel, compute elliptical cross-section depth using
  // BOTH horizontal and vertical bone radii. The depth at a point is
  // determined by how far it is from the bone surface in 2D, giving
  // a truly round, tubular appearance.
  const rawDepth = new Float32Array(N);
  let totalDensity = 0, bonePixelCount = 0;

  // Normalize enhanced to 0-1 for density
  let eMin = 999, eMax = 0;
  for (let i = 0; i < N; i++) {
    if (boneMask[i]) {
      if (enhanced[i] < eMin) eMin = enhanced[i];
      if (enhanced[i] > eMax) eMax = enhanced[i];
    }
  }
  const eRange = (eMax - eMin) || 1;

  // Find max distance for normalization
  let maxDist = 0;
  for (let i = 0; i < N; i++) if (distField[i] > maxDist && distField[i] < 1e5) maxDist = distField[i];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!boneMask[i]) { rawDepth[i] = 0; continue; }

      const density = Math.max(0, Math.min(1, (enhanced[i] - eMin) / eRange));

      // Use distance from bone boundary as the primary depth driver
      // This gives truly round, cylindrical bones
      const boneDistFromEdge = distField[i];
      
      // Horizontal cylindrical component
      const hr = Math.max(1, Math.min(hRadius[i], 50));
      const hd = Math.abs(x - hCenter[i]);
      const hNorm = Math.min(1.0, hd / hr);
      const hCyl = Math.sqrt(Math.max(0, 1 - hNorm * hNorm));

      // Vertical cylindrical component  
      const vr = Math.max(1, Math.min(vRadius[i], 50));
      const vd = Math.abs(y - vCenter[i]);
      const vNorm = Math.min(1.0, vd / vr);
      const vCyl = Math.sqrt(Math.max(0, 1 - vNorm * vNorm));

      // Use the SMALLER radius dimension for cross-section roundness
      // Long bones: thin horizontally → use hCyl for roundness
      // Wide bones: thin vertically → use vCyl for roundness
      // This makes bones round across their narrow axis (like real bones)
      const minR = Math.min(hr, vr);
      const maxR = Math.max(hr, vr);
      const aspectRatio = minR / maxR; // 0 = very elongated, 1 = square

      // Blend: for elongated bones, use narrow-axis cylinder
      // For square-ish areas, use both equally
      let cylindricalShape;
      if (aspectRatio < 0.4) {
        // Elongated: use narrow axis for roundness
        cylindricalShape = hr < vr ? hCyl : vCyl;
      } else {
        // Square-ish: blend both (like a rounded knob/joint)
        cylindricalShape = Math.min(hCyl, vCyl);
      }

      // Also blend in distance-from-edge for smooth boundaries
      const edgeFalloff = Math.min(1.0, boneDistFromEdge / 3.0);
      cylindricalShape = cylindricalShape * 0.85 + edgeFalloff * 0.15;

      // Amplify the cylindrical shape with a power curve to make
      // bones significantly rounder and more pronounced
      cylindricalShape = Math.pow(cylindricalShape, 0.6);

      // Density gate
      const densityGate = density > 0.08 ? 1.0 : density / 0.08;

      // Edge depression at sharp boundaries — reduced so edges aren't too thin
      const edgeDepression = 1.0 - edges[i] * 0.18;

      // Combine — density has less influence on height, keeping bones thick
      const depth = cylindricalShape
        * (density * 0.35 + 0.65)       // density contributes less — bones stay thick even in dimmer areas
        * gapFactor[i]                    // joint separation
        * densityGate
        * edgeDepression;

      rawDepth[i] = Math.max(0, depth);
      if (depth > 0.01) {
        bonePixelCount++;
        totalDensity += depth;
      }
    }
  }

  // ── Stage 9: Bilateral filter (edge-preserving) ────────────────────────
  const filtered = bilateralFilter(rawDepth, W, H, 2.0, 0.12);

  // ── Stage 10: Taubin smoothing ─────────────────────────────────────────
  const smoothed = taubinSmooth(filtered, W, H, 8, 0.5, -0.53);

  // ── Stage 11: Re-apply bone mask ───────────────────────────────────────
  // Smoothing can bleed depth into non-bone pixels — clamp them back to zero
  for (let i = 0; i < N; i++) {
    if (!boneMask[i]) smoothed[i] = 0;
  }

  return {
    processedDataUrl: canvas.toDataURL(),
    depthMatrix: smoothed,
    rawDepthMatrix: rawDepth,
    boneMask,
    resolution,
    maxDist,
    aspectRatio: (imageElement.naturalWidth / imageElement.naturalHeight) || (imageElement.width / imageElement.height) || 1,
    stats: {
      bonePixelCount,
      boneRatio: (bonePixelCount / N * 100).toFixed(1),
      avgDensity: bonePixelCount > 0 ? (totalDensity / bonePixelCount * 255).toFixed(0) : 0,
      otsuThreshold: otsuT,
    }
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Post-process AI generated depth map
// ═══════════════════════════════════════════════════════════════════════════
export const postProcessAIDepthMap = (imageElement, aiDepthData, aiWidth, aiHeight, resolution = 384, options = {}) => {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, resolution, resolution);

  const N = resolution * resolution;
  const depthMatrix = new Float32Array(N);

  // ── Extract high-fidelity 2D bone mask ──
  const imgData = ctx.getImageData(0, 0, resolution, resolution);
  const data = imgData.data;

  const rawGray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = i * 4;
    rawGray[i] = 0.299 * data[p] + 0.587 * data[p+1] + 0.114 * data[p+2];
  }

  let borderSum = 0, borderCnt = 0;
  for (let x = 0; x < resolution; x++) { borderSum += rawGray[x] + rawGray[(resolution-1)*resolution + x]; borderCnt += 2; }
  for (let y = 0; y < resolution; y++) { borderSum += rawGray[y*resolution] + rawGray[y*resolution + (resolution-1)]; borderCnt += 2; }
  const isLightBg = (borderSum / borderCnt) > 128;

  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    gray[i] = isLightBg ? (255 - rawGray[i]) : rawGray[i];
  }

  const enhanced = enhanceLocalContrast(gray, resolution, resolution, 48);

  const histogram = new Int32Array(256);
  for (let i = 0; i < N; i++) histogram[Math.min(255, Math.max(0, Math.round(enhanced[i])))]++;
  
  const manualThreshold = options.threshold || 0;
  const otsuT = manualThreshold > 0 ? manualThreshold : otsuThreshold(histogram, N);
  const effectiveThresh = Math.max(35, otsuT * 1.25);

  let boneMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    boneMask[i] = enhanced[i] > effectiveThresh ? 1 : 0;
  }
  boneMask = morphOpen(boneMask, resolution, resolution, 2);
  boneMask = morphClose(boneMask, resolution, resolution, 2);

  // Compute distance transform and maxDist to calculate bone width
  const distField = distanceTransformApprox(boneMask, resolution, resolution);
  let maxDist = 0;
  for (let i = 0; i < N; i++) if (distField[i] > maxDist && distField[i] < 1e5) maxDist = distField[i];

  // ── Normalize AI depth ──
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (let i = 0; i < aiDepthData.length; i++) {
    const val = aiDepthData[i];
    if (val < minDepth) minDepth = val;
    if (val > maxDepth) maxDepth = val;
  }
  const range = (maxDepth - minDepth) || 1;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const aiX = Math.floor((x / resolution) * aiWidth);
      const aiY = Math.floor((y / resolution) * aiHeight);
      
      const rawVal = aiDepthData[aiY * aiWidth + aiX];
      let normalized = (rawVal - minDepth) / range;
      
      // Gentler power curve — preserve more depth variation for volumetric appearance
      normalized = Math.pow(normalized, 1.1);
      
      // Amplify so bones are prominently thick
      normalized = Math.min(1.0, normalized * 1.3);
      
      depthMatrix[y * resolution + x] = normalized;
    }
  }

  // Background suppression — zero out the lowest depth values
  const depthHist = new Int32Array(256);
  for (let i = 0; i < N; i++) {
    depthHist[Math.min(255, Math.max(0, Math.round(depthMatrix[i] * 255)))]++;
  }
  const bgThresh = otsuThreshold(depthHist, N) / 255;
  const effectiveBgThresh = Math.max(0.08, bgThresh * 0.85);
  
  for (let i = 0; i < N; i++) {
    if (!boneMask[i] || depthMatrix[i] < effectiveBgThresh) {
      depthMatrix[i] = 0;
    } else {
      // Re-normalize remaining values to use full 0-1 range
      depthMatrix[i] = (depthMatrix[i] - effectiveBgThresh) / (1 - effectiveBgThresh);
    }
  }

  const smoothed = taubinSmooth(depthMatrix, resolution, resolution, 6, 0.5, -0.53);
  
  // Re-apply mask after smoothing to prevent bleed
  for (let i = 0; i < N; i++) {
    if (!boneMask[i] || depthMatrix[i] <= 0) smoothed[i] = 0;
  }

  return {
    processedDataUrl: canvas.toDataURL(),
    depthMatrix: smoothed,
    resolution,
    maxDist,
    aspectRatio: (imageElement.naturalWidth / imageElement.naturalHeight) || (imageElement.width / imageElement.height) || 1,
    stats: {
      aiPowered: true,
      bonePixelCount: boneMask.reduce((a, b) => a + b, 0),
      boneRatio: (boneMask.reduce((a, b) => a + b, 0) / N * 100).toFixed(1),
      avgDensity: (depthMatrix.reduce((a, b) => a + b, 0) / Math.max(1, boneMask.reduce((a, b) => a + b, 0)) * 255).toFixed(0),
      otsuThreshold: otsuT
    }
  };
};
