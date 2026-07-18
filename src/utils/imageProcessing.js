// ═══════════════════════════════════════════════════════════════════════════
// Advanced Anatomical X-Ray → 3D Bone Reconstruction Pipeline
// ═══════════════════════════════════════════════════════════════════════════
//
// Pipeline stages:
//   1. Grayscale + auto-invert (light/dark BG detection)
//   2. CLAHE-style local contrast enhancement
//   3. Otsu adaptive thresholding → binary bone mask
//   4. Morphological open + close (noise removal, hole filling)
//   5. Sobel edge detection → boundary distance field
//   6. Anatomical cylindrical depth estimation (elliptical cross-section)
//   7. Joint gap detection & depth tapering
//   8. Edge-preserving bilateral filter
//   9. Taubin mesh smoothing (shrinkage-free)
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Otsu's Method — automatic optimal bone/background threshold ────────
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

// ── 2. Local contrast enhancement (simplified CLAHE) ──────────────────────
function enhanceLocalContrast(gray, w, h, tileSize = 32) {
  const out = new Float32Array(w * h);
  const halfTile = Math.floor(tileSize / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      // Compute local min/max in tile window
      let lMin = 255, lMax = 0;
      const y0 = Math.max(0, y - halfTile), y1 = Math.min(h - 1, y + halfTile);
      const x0 = Math.max(0, x - halfTile), x1 = Math.min(w - 1, x + halfTile);
      // Sample every 4th pixel for speed
      for (let sy = y0; sy <= y1; sy += 4) {
        for (let sx = x0; sx <= x1; sx += 4) {
          const sv = gray[sy * w + sx];
          if (sv < lMin) lMin = sv;
          if (sv > lMax) lMax = sv;
        }
      }
      const range = lMax - lMin || 1;
      // Blend: mostly preserve raw intensity, only mild local stretch
      // (aggressive local stretch makes soft tissue look as bright as bone)
      const localNorm = ((gray[idx] - lMin) / range) * 255;
      out[idx] = gray[idx] * 0.75 + localNorm * 0.25;
    }
  }
  return out;
}

// ── 3. Morphological operations (binary) ──────────────────────────────────
function morphOpen(mask, w, h, radius = 1) {
  // Erode then dilate — removes small noise specks
  return dilate(erode(mask, w, h, radius), w, h, radius);
}

function morphClose(mask, w, h, radius = 1) {
  // Dilate then erode — fills small holes
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

// ── 4. Sobel edge detection ───────────────────────────────────────────────
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
  // Normalize to 0-1
  let eMax = 0;
  for (let i = 0; i < edges.length; i++) if (edges[i] > eMax) eMax = edges[i];
  if (eMax > 0) for (let i = 0; i < edges.length; i++) edges[i] /= eMax;
  return edges;
}

// ── 5. Boundary Distance Field (distance transform on bone mask) ──────────
function distanceTransformApprox(mask, w, h) {
  // Chamfer 3-4 distance transform (approximation of Euclidean DT)
  const dist = new Float32Array(w * h);
  const INF = 1e6;

  // Initialize: 0 for background, INF for foreground
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

// ── 6. Compute per-row bone spans (for cylindrical depth) ─────────────────
function computeBoneSpans(mask, w, h) {
  // For each bone pixel, find the local bone "width" at that row.
  // This gives us the radius R in the cylindrical depth formula.
  const leftEdge  = new Int32Array(w * h).fill(-1);
  const rightEdge = new Int32Array(w * h).fill(-1);
  const boneWidth = new Float32Array(w * h);
  const boneCenter = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    // Scan left-to-right: find runs of bone pixels
    let runStart = -1;
    for (let x = 0; x <= w; x++) {
      const isOn = x < w && mask[y * w + x];
      if (isOn && runStart < 0) {
        runStart = x;
      } else if (!isOn && runStart >= 0) {
        // End of a bone run
        const runEnd = x - 1;
        const width = runEnd - runStart + 1;
        const center = (runStart + runEnd) / 2;
        for (let rx = runStart; rx <= runEnd; rx++) {
          const idx = y * w + rx;
          boneWidth[idx] = width;
          boneCenter[idx] = center;
          leftEdge[idx] = runStart;
          rightEdge[idx] = runEnd;
        }
        runStart = -1;
      }
    }
  }

  return { boneWidth, boneCenter, leftEdge, rightEdge };
}

// ── 7. Joint gap detection (dark bands between bone regions) ──────────────
function detectJointGaps(gray, mask, w, h) {
  // A joint gap is a horizontal or vertical band where intensity drops
  // significantly between two bone regions. We detect vertical gaps
  // (between vertically adjacent bones like phalanges).
  const gapFactor = new Float32Array(w * h).fill(1.0);

  for (let x = 0; x < w; x++) {
    // Scan column top-to-bottom
    let inBone = false;
    let lastBoneEnd = -1;

    for (let y = 0; y < h; y++) {
      const idx = y * w + x;
      const isBone = mask[idx] > 0;

      if (isBone && !inBone) {
        // Entering bone — if there was a recent gap, taper both sides
        if (lastBoneEnd >= 0) {
          const gapLen = y - lastBoneEnd;
          if (gapLen > 1 && gapLen < 20) {
            // Taper the bone ends near the gap
            const taperLen = Math.min(8, Math.max(3, Math.floor(gapLen * 1.5)));
            // Taper above the gap (end of previous bone)
            for (let t = 0; t < taperLen && lastBoneEnd - t >= 0; t++) {
              const tidx = (lastBoneEnd - t) * w + x;
              const factor = Math.min(gapFactor[tidx], t / taperLen);
              gapFactor[tidx] = Math.max(0.05, factor);
            }
            // Taper below the gap (start of current bone)
            for (let t = 0; t < taperLen && y + t < h; t++) {
              const tidx = (y + t) * w + x;
              const factor = Math.min(gapFactor[tidx], t / taperLen);
              gapFactor[tidx] = Math.max(0.05, factor);
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

  // Also detect horizontal gaps (between side-by-side bones)
  for (let y = 0; y < h; y++) {
    let inBone = false;
    let lastBoneEnd = -1;

    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const isBone = mask[idx] > 0;

      if (isBone && !inBone) {
        if (lastBoneEnd >= 0) {
          const gapLen = x - lastBoneEnd;
          if (gapLen > 1 && gapLen < 20) {
            const taperLen = Math.min(6, Math.max(2, Math.floor(gapLen * 1.2)));
            for (let t = 0; t < taperLen && lastBoneEnd - t >= 0; t++) {
              const tidx = y * w + (lastBoneEnd - t);
              gapFactor[tidx] = Math.max(0.05, Math.min(gapFactor[tidx], t / taperLen));
            }
            for (let t = 0; t < taperLen && x + t < w; t++) {
              const tidx = y * w + (x + t);
              gapFactor[tidx] = Math.max(0.05, Math.min(gapFactor[tidx], t / taperLen));
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

// ── 8. Edge-preserving bilateral filter ───────────────────────────────────
function bilateralFilter(matrix, w, h, spatialSigma = 1.8, rangeSigma = 0.15) {
  const input = new Float32Array(matrix);
  const output = new Float32Array(matrix.length);
  const r = 2;

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

// ── 9. Taubin smoothing (shrinkage-free mesh smoothing) ───────────────────
function taubinSmooth(matrix, w, h, passes = 6, lambda = 0.5, mu = -0.53) {
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

        // Weighted Laplacian (cardinal=1.0, diagonal=0.707)
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
    threshold: manualThreshold = 0, // 0 = use Otsu auto-threshold
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

  // Auto-detect dark vs light background (sample border pixels)
  let borderSum = 0, borderCnt = 0;
  for (let x = 0; x < W; x++) { borderSum += rawGray[x] + rawGray[(H-1)*W + x]; borderCnt += 2; }
  for (let y = 0; y < H; y++) { borderSum += rawGray[y*W] + rawGray[y*W + (W-1)]; borderCnt += 2; }
  const isLightBg = (borderSum / borderCnt) > 128;

  // Invert if light background (standard X-rays have dark BG = bone is bright)
  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    gray[i] = isLightBg ? (255 - rawGray[i]) : rawGray[i];
  }

  // ── Stage 2: Local contrast enhancement ─────────────────────────────────
  const enhanced = enhanceLocalContrast(gray, W, H, 48);

  // ── Stage 3: Otsu thresholding → bone mask ──────────────────────────────
  // We need to be STRICT here: only capture actual dense bone, not soft tissue
  const histogram = new Int32Array(256);
  for (let i = 0; i < N; i++) histogram[Math.min(255, Math.max(0, Math.round(enhanced[i])))]++;
  const otsuT = manualThreshold > 0 ? manualThreshold : otsuThreshold(histogram, N);
  // RAISE the threshold above Otsu to reject soft tissue (skin, muscle)
  // Bone is significantly brighter than soft tissue in X-rays
  const effectiveThresh = Math.max(30, otsuT * 1.15);

  let boneMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    boneMask[i] = enhanced[i] > effectiveThresh ? 1 : 0;
  }

  // ── Stage 4: Morphological cleanup ──────────────────────────────────────
  boneMask = morphOpen(boneMask, W, H, 1);   // Remove isolated noise pixels
  boneMask = morphClose(boneMask, W, H, 1);  // Fill tiny holes (radius=1 only, avoids bridging bones)

  // ── Stage 5: Sobel edges + boundary distance ───────────────────────────
  const edges = sobelEdges(enhanced, W, H);
  const distField = distanceTransformApprox(boneMask, W, H);

  // ── Stage 6: Bone spans for cylindrical depth ──────────────────────────
  const { boneWidth, boneCenter } = computeBoneSpans(boneMask, W, H);

  // ── Stage 7: Joint gap detection ───────────────────────────────────────
  const gapFactor = detectJointGaps(enhanced, boneMask, W, H);

  // ── Stage 8: Anatomical cylindrical depth estimation ───────────────────
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

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!boneMask[i]) { rawDepth[i] = 0; continue; }

      // Normalized bone density (0-1) from local contrast-enhanced image
      const density = Math.max(0, Math.min(1, (enhanced[i] - eMin) / eRange));

      // Cylindrical cross-section:
      // R = half of the local bone width at this row, CLAMPED to max ~40px
      // so wide areas (like joined carpals) still get individual roundness
      const rawR = Math.max(1, boneWidth[i] / 2);
      const R = Math.min(rawR, 40);  // Clamp: no bone is wider than ~40px at 384 res
      const d = Math.abs(x - boneCenter[i]);
      const normalizedD = Math.min(1.0, d / R);

      // Elliptical depth: sqrt(1 - (d/R)^2) gives a semicircular cross-section
      const cylindricalShape = Math.sqrt(Math.max(0, 1 - normalizedD * normalizedD));

      // Edge softening: taper near bone boundaries using distance field
      const edgeDist = distField[i];
      const edgeTaper = Math.min(1.0, edgeDist / 5.0); // larger taper for smoother edges

      // Density gate: reject faint tissue that barely passed threshold
      const densityGate = density > 0.15 ? 1.0 : density / 0.15;

      // Combine: density modulates peak height, cylinder gives shape,
      // edge taper smooths borders, gap factor separates joints
      const depth = cylindricalShape
        * (density * 0.75 + 0.25)    // density modulation
        * edgeTaper                   // smooth edges
        * gapFactor[i]                // joint separation
        * densityGate                 // reject very faint tissue
        * (1.0 - edges[i] * 0.3);    // depression at sharp edges (joint lines)

      rawDepth[i] = Math.max(0, depth);
      if (depth > 0.01) {
        bonePixelCount++;
        totalDensity += depth;
      }
    }
  }

  // ── Stage 9: Bilateral filter (edge-preserving) ────────────────────────
  const filtered = bilateralFilter(rawDepth, W, H, 1.8, 0.15);

  // ── Stage 10: Taubin smoothing (shrinkage-free) ────────────────────────
  const smoothed = taubinSmooth(filtered, W, H, 6, 0.5, -0.53);

  return {
    processedDataUrl: canvas.toDataURL(),
    depthMatrix: smoothed,
    rawDepthMatrix: rawDepth,
    boneMask,
    resolution,
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
export const postProcessAIDepthMap = (imageElement, aiDepthData, aiWidth, aiHeight, resolution = 384) => {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, resolution, resolution);

  const N = resolution * resolution;
  const depthMatrix = new Float32Array(N);

  // The AI depth data is typically unnormalized and may have negative values.
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (let i = 0; i < aiDepthData.length; i++) {
    const val = aiDepthData[i];
    if (val < minDepth) minDepth = val;
    if (val > maxDepth) maxDepth = val;
  }
  const range = (maxDepth - minDepth) || 1;

  // We need to sample from (aiWidth x aiHeight) to (resolution x resolution)
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      // Nearest neighbor or bilinear sampling
      const aiX = Math.floor((x / resolution) * aiWidth);
      const aiY = Math.floor((y / resolution) * aiHeight);
      
      const rawVal = aiDepthData[aiY * aiWidth + aiX];
      
      // Normalize to 0 - 1
      let normalized = (rawVal - minDepth) / range;
      
      // Depth-anything tends to make background dark (0) and foreground bright (1)
      // Since X-Rays have dark background, bones are the foreground.
      // We square or cube the normalized value to suppress background noise
      // and give bone structures a rounder, more dramatic profile.
      normalized = Math.pow(normalized, 1.5);
      
      depthMatrix[y * resolution + x] = normalized;
    }
  }

  // Smooth the sampled depth matrix with Taubin filter to remove sampling artifacts
  const smoothed = taubinSmooth(depthMatrix, resolution, resolution, 4, 0.5, -0.53);

  return {
    processedDataUrl: canvas.toDataURL(),
    depthMatrix: smoothed,
    resolution,
    stats: {
      aiPowered: true
    }
  };
};

