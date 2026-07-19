import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Download, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

export const ThreeDViewport = ({ depthMatrix, resolution = 256, options = {}, aspectRatio = 1, maxDist = 0 }) => {
  const mountRef    = useRef(null);
  const cameraRef   = useRef(null);
  const controlsRef = useRef(null);
  const meshGroupRef = useRef(null);
  const rendererRef  = useRef(null);
  const autoRotateRef = useRef(true);

  const depthScale = options.depthScale !== undefined ? options.depthScale : 18;
  const materialTheme = options.theme || 'ivory';
  const translucency = options.translucency !== undefined ? options.translucency : 0.15;
  const roughness = options.roughness !== undefined ? options.roughness : 0.35;
  const marrowEnabled = options.marrowEnabled !== undefined ? options.marrowEnabled : true;
  const renderMode = options.edgeMode ? 'wireframe' : 'surface';

  // ── 1024px High-Fidelity Cortical Bone Micro-Texture ──────────────────────
  const createBoneTextures = () => {
    const SZ = 1024;
    const bumpC  = document.createElement('canvas');
    const roughC = document.createElement('canvas');
    bumpC.width  = bumpC.height  = SZ;
    roughC.width = roughC.height = SZ;
    const bCtx = bumpC.getContext('2d');
    const rCtx = roughC.getContext('2d');

    const bID = bCtx.createImageData(SZ, SZ);
    const rID = rCtx.createImageData(SZ, SZ);
    const bd = bID.data, rd = rID.data;

    for (let y = 0; y < SZ; y++) {
      for (let x = 0; x < SZ; x++) {
        const i = (y * SZ + x) * 4;

        // Haversian canal system — longitudinal osteon grooves
        const havers   = Math.sin(x * 0.08 + Math.sin(y * 0.025) * 3.5) * 22;
        // Volkmann canals — perpendicular transverse channels
        const volkmann  = Math.sin(y * 0.14 + Math.cos(x * 0.08) * 2.0) * 10;
        // Trabecular micro-grain (high frequency)
        const micro     = Math.sin(x * 0.55 + y * 0.4) * 6 + Math.cos(x * 0.38 + y * 0.62) * 4;
        // Fine noise
        const noise     = (Math.sin(x * 7.3 + y * 5.1) * 0.5 + 0.5) * 10 - 5;

        const bv = Math.max(0, Math.min(255, 128 + havers + volkmann + micro + noise));
        bd[i] = bd[i+1] = bd[i+2] = bv; bd[i+3] = 255;

        // Roughness: high where grooves are
        const rv = Math.max(60, Math.min(230, 160 - havers * 0.8 + noise * 0.5));
        rd[i] = rd[i+1] = rd[i+2] = rv; rd[i+3] = 255;
      }
    }

    bCtx.putImageData(bID, 0, 0);
    rCtx.putImageData(rID, 0, 0);

    const makeT = (c) => {
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(6, 6);
      return t;
    };
    return { bumpTex: makeT(bumpC), roughTex: makeT(roughC) };
  };

  // ── Procedural Bone Color Map ────────────────────────────────────────────
  const createBoneColorTexture = () => {
    const SZ = 512;
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(SZ, SZ);
    const d = id.data;
    for (let y = 0; y < SZ; y++) {
      for (let x = 0; x < SZ; x++) {
        const i = (y * SZ + x) * 4;
        const h = Math.sin(x * 0.08 + y * 0.05) * 0.5 + 0.5;
        const n = (Math.sin(x * 6.1 + y * 4.7) * 0.5 + 0.5) * 0.18;
        d[i]   = Math.floor(Math.min(255, 235 + h * 15 + n * 20));
        d[i+1] = Math.floor(Math.min(255, 218 + h * 12 + n * 10));
        d[i+2] = Math.floor(Math.min(255, 185 + h *  8 + n * 5));
        d[i+3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    return t;
  };

  // ── Procedural Trabecular Marrow Texture ────────────────────────────────
  const createMarrowTexture = () => {
    const SZ = 512;
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d');
    
    // Deep reddish-brown marrow background
    ctx.fillStyle = '#220806';
    ctx.fillRect(0, 0, SZ, SZ);
    
    // Draw fine trabecular bone lattice/pores
    ctx.fillStyle = '#4c130f';
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * SZ;
      const y = Math.random() * SZ;
      const r = Math.random() * 1.5 + 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw some yellow marrow fatty globules
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * SZ;
      const y = Math.random() * SZ;
      const r = Math.random() * 4 + 2;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(190, 150, 70, 0.45)');
      g.addColorStop(1, 'rgba(34, 8, 6, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    return t;
  };

  // ── Volumetric Bone Mesh Builder ──────────────────────────────────────────
  // Creates actual round, tubular bone geometry instead of a flat heightmap
  const buildMesh = (matrix, scale, theme, mode, translucencyVal = 0.15, outerRoughness = 0.35, marrowVal = true) => {
    if (!meshGroupRef.current || !matrix) return;
    const mg = meshGroupRef.current;
    while (mg.children.length > 0) {
      const ch = mg.children[0];
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) (Array.isArray(ch.material) ? ch.material : [ch.material]).forEach(m => m.dispose());
      mg.remove(ch);
    }

    const res = resolution;
    const size = 65;
    
    // Scale width and height dynamically according to original aspect ratio
    const sizeX = aspectRatio >= 1 ? size : size * aspectRatio;
    const sizeY = aspectRatio >= 1 ? size / aspectRatio : size;
    const hsX = sizeX / 2;
    const hsY = sizeY / 2;

    const positions = [], normals = [], colors = [], uvs = [], indices = [];
    const col = new THREE.Color();
    
    // For each pixel in the depth matrix, we create vertices at:
    //   FRONT:  (px, py,  +depth * scale)
    //   BACK:   (px, py,  -depth * scale * backRatio)
    // This creates a SOLID volumetric bone with rounded front and back surfaces.
    
    const fMap = new Int32Array(res * res).fill(-1);
    const bMap = new Int32Array(res * res).fill(-1);
    let vc = 0;

    // Pre-compute which pixels are bone (above threshold)
    const isBone = new Uint8Array(res * res);
    for (let i = 0; i < res * res; i++) {
      isBone[i] = (matrix[i] || 0) > 0.06 ? 1 : 0;
    }

    // Pre-compute distance from bone boundary (for edge rounding)
    const edgeDist = new Float32Array(res * res);
    const searchR = 10;
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const idx = y * res + x;
        if (!isBone[idx]) { edgeDist[idx] = 0; continue; }
        let minDist = searchR;
        for (let dy = -searchR; dy <= searchR; dy++) {
          for (let dx = -searchR; dx <= searchR; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= res || ny < 0 || ny >= res || !isBone[ny * res + nx]) {
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < minDist) minDist = d;
            }
          }
        }
        edgeDist[idx] = minDist;
      }
    }

    let maxEdgeDist = 0;
    for (let i = 0; i < res * res; i++) {
      if (edgeDist[i] > maxEdgeDist) maxEdgeDist = edgeDist[i];
    }

    // Scale depth proportionally to the bone's width in the 3D scene.
    // maxRadiusPixels uses maxDist (the high-quality distance from image processing) or falls back to local maxEdgeDist.
    const maxRadiusPixels = maxDist > 0 ? maxDist : maxEdgeDist;
    const meshScale = Math.min(sizeX, sizeY);
    // idealScale makes the bone's thickness (depth) match its width/radius.
    // frontZ (0.55 * scale) and backZ (0.40 * scale) sum to 0.95 * scale.
    // So the total thickness of the bone at its thickest point is 0.95 * scale.
    // We want this to match maxRadiusPixels converted to viewport units: maxRadiusPixels * (meshScale / res).
    const idealScale = maxRadiusPixels > 0 ? (maxRadiusPixels * (meshScale / res)) / 0.95 : scale;
    // Treat the user's scale slider (default 25) as a multiplier relative to the anatomically correct idealScale.
    const calibratedScale = maxRadiusPixels > 0 ? idealScale * (scale / 25) : scale;

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const idx = y * res + x;
        if (!isBone[idx]) continue;
        const depth = matrix[idx] || 0;

        const px = (x / res) * sizeX - hsX;
        const py = -((y / res) * sizeY - hsY);
        const u = x / res, v = 1 - y / res;

        // Per-vertex AO: compare center depth to neighbourhood
        let nSum = 0, nCnt = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < res && ny >= 0 && ny < res) { nSum += matrix[ny*res+nx]||0; nCnt++; }
        }
        const avgN = nCnt > 0 ? nSum / nCnt : depth;
        const ao = Math.max(0.5, Math.min(1.0, 0.8 + (depth - avgN) * 1.5));

        // ── Edge rounding profile ──
        const ed = edgeDist[idx];
        const edgeRound = ed >= 8 ? 1.0 : Math.sin((ed / 8) * Math.PI * 0.5);

        // ── Global ellipsoidal bulge ──
        const globalBulge = 0;

        // Apply edge rounding to Z displacement
        const effDepth = depth * edgeRound;
        const frontZ =  (effDepth * 0.55 + globalBulge * edgeRound) * calibratedScale;
        const backZ  = -(effDepth * 0.40 + globalBulge * edgeRound * 0.5) * calibratedScale;

        // Warm ivory cortical bone color with AO
        if (theme === 'ct_thermal') {
          col.setHSL((1 - depth) * 0.65, 1.0, Math.min(0.6, 0.45 + depth * 0.25) * ao);
        } else if (theme === 'xray') {
          const xv = Math.min(1.0, depth * ao);
          col.setRGB(xv * 0.05, xv * 0.88, xv);
        } else {
          const r = (0.88 + depth * 0.12) * ao;
          const g = (0.81 + depth * 0.10) * ao;
          const b = (0.65 + depth * 0.08) * ao;
          col.setRGB(r, g, b);
        }

        // Front vertex
        fMap[idx] = vc;
        positions.push(px, py, frontZ);
        normals.push(0, 0, 1);
        colors.push(col.r, col.g, col.b);
        uvs.push(u, v);
        vc++;

        // Back vertex (slightly darker for visual depth cue)
        bMap[idx] = vc;
        positions.push(px, py, backZ);
        normals.push(0, 0, -1);
        colors.push(col.r * 0.72, col.g * 0.72, col.b * 0.70);
        uvs.push(u, v);
        vc++;
      }
    }

    // Build triangles
    for (let y = 0; y < res - 1; y++) {
      for (let x = 0; x < res - 1; x++) {
        const i0=y*res+x, i1=y*res+(x+1), i2=(y+1)*res+x, i3=(y+1)*res+(x+1);
        const [f0,f1,f2,f3] = [fMap[i0],fMap[i1],fMap[i2],fMap[i3]];
        const [b0,b1,b2,b3] = [bMap[i0],bMap[i1],bMap[i2],bMap[i3]];
        
        // Front face triangles
        if (f0!==-1&&f1!==-1&&f2!==-1) indices.push(f0,f2,f1);
        if (f1!==-1&&f2!==-1&&f3!==-1) indices.push(f1,f2,f3);
        // Back face triangles (reversed winding)
        if (b0!==-1&&b1!==-1&&b2!==-1) indices.push(b0,b1,b2);
        if (b1!==-1&&b2!==-1&&b3!==-1) indices.push(b1,b3,b2);

        // Side walls — stitch front-to-back at bone boundaries
        // Top edge
        if (f0!==-1 && f1!==-1 && (y===0 || fMap[(y-1)*res+x]===-1 || fMap[(y-1)*res+(x+1)]===-1)) {
          indices.push(f0, f1, b0); indices.push(f1, b1, b0);
        }
        // Bottom edge
        if (f2!==-1 && f3!==-1 && (y+2>=res || fMap[(y+2)*res+x]===-1 || fMap[(y+2)*res+(x+1)]===-1)) {
          indices.push(f2, b2, f3); indices.push(f3, b2, b3);
        }
        // Left edge
        if (f0!==-1 && f2!==-1 && (x===0 || fMap[y*res+(x-1)]===-1 || fMap[(y+1)*res+(x-1)]===-1)) {
          indices.push(f0, b0, f2); indices.push(f2, b0, b2);
        }
        // Right edge
        if (f1!==-1 && f3!==-1 && (x+2>=res || fMap[y*res+(x+2)]===-1 || fMap[(y+1)*res+(x+2)]===-1)) {
          indices.push(f1, f3, b1); indices.push(f3, b3, b1);
        }
      }
    }

    if (positions.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.center();
    geo.computeVertexNormals();

    // Smooth normals
    smoothNormals(geo);

    let mat;
    if (theme === 'xray') {
      mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.12, metalness: 0.25,
        emissive: new THREE.Color(0x001a2e), emissiveIntensity: 0.6,
        wireframe: mode === 'wireframe', side: THREE.DoubleSide,
      });
    } else if (theme === 'ct_thermal') {
      mat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.3,
        wireframe: mode === 'wireframe', side: THREE.DoubleSide,
      });
    } else {
      // ── Hyper-Realistic Bone Material (Hydroxyapatite) ──────────────────
      const { bumpTex, roughTex } = createBoneTextures();
      const colorTex = createBoneColorTexture();

      mat = new THREE.MeshPhysicalMaterial({
        map: colorTex,
        vertexColors: true,

        bumpMap: bumpTex,
        bumpScale: 0.1,
        roughnessMap: roughTex,
        roughness: outerRoughness,
        metalness: 0.0,

        // Subsurface scattering — light bleeds through thin bone edges
        transmission: translucencyVal,
        thickness: 3.5,
        attenuationColor: new THREE.Color(0xffcca3),
        attenuationDistance: 5.0,

        // Periosteum membrane sheen
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,

        ior: 1.56,

        anisotropy: 0.3,
        anisotropyRotation: 0,

        wireframe: mode === 'wireframe',
        side: THREE.DoubleSide,
        envMapIntensity: 0.8,
      });
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mg.add(mesh);

    // Inner marrow mesh representing trabecular bone interior
    if (marrowVal && theme === 'ivory') {
      const posAttr = geo.getAttribute('position');
      const normAttr = geo.getAttribute('normal');
      const uvAttr = geo.getAttribute('uv');
      const idxAttr = geo.getIndex();
      
      const innerPositions = [];
      const innerColors = [];
      
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        const pz = posAttr.getZ(i);
        
        const nx = normAttr.getX(i);
        const ny = normAttr.getY(i);
        const nz = normAttr.getZ(i);
        
        // Push inward along normal to fit inside outer shell
        const shrink = 1.6;
        innerPositions.push(px - nx * shrink, py - ny * shrink, pz - nz * shrink);
        innerColors.push(0.35, 0.08, 0.06);
      }
      
      const innerGeo = new THREE.BufferGeometry();
      innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerPositions, 3));
      innerGeo.setAttribute('color',    new THREE.Float32BufferAttribute(innerColors, 3));
      if (uvAttr) innerGeo.setAttribute('uv', uvAttr.clone());
      if (idxAttr) innerGeo.setIndex(idxAttr.clone());
      innerGeo.computeVertexNormals();
      
      const marrowTex = createMarrowTexture();
      const marrowMat = new THREE.MeshStandardMaterial({
        map: marrowTex,
        roughness: 0.85,
        metalness: 0.0,
        bumpMap: marrowTex,
        bumpScale: 0.12,
        side: THREE.DoubleSide
      });
      
      const innerMesh = new THREE.Mesh(innerGeo, marrowMat);
      innerMesh.castShadow = true;
      innerMesh.receiveShadow = true;
      mg.add(innerMesh);
    }
  };

  // ── Normal smoothing for rounder appearance ────────────────────────────
  const smoothNormals = (geometry) => {
    const posAttr = geometry.getAttribute('position');
    const normAttr = geometry.getAttribute('normal');
    const idx = geometry.getIndex();
    if (!posAttr || !normAttr || !idx) return;

    const pos = posAttr.array;
    const norms = normAttr.array;
    const vertCount = posAttr.count;

    // Build a map of position → accumulated normal
    const normalMap = new Map();
    const precision = 1000; // hash precision

    for (let i = 0; i < vertCount; i++) {
      const x = Math.round(pos[i*3] * precision);
      const y = Math.round(pos[i*3+1] * precision);
      const z = Math.round(pos[i*3+2] * precision);
      const key = `${x},${y},${z}`;
      
      if (!normalMap.has(key)) {
        normalMap.set(key, { nx: 0, ny: 0, nz: 0, indices: [] });
      }
      const entry = normalMap.get(key);
      entry.nx += norms[i*3];
      entry.ny += norms[i*3+1];
      entry.nz += norms[i*3+2];
      entry.indices.push(i);
    }

    // Apply averaged normals
    for (const [, entry] of normalMap) {
      const len = Math.sqrt(entry.nx*entry.nx + entry.ny*entry.ny + entry.nz*entry.nz);
      if (len > 0) {
        const nx = entry.nx / len;
        const ny = entry.ny / len;
        const nz = entry.nz / len;
        for (const i of entry.indices) {
          norms[i*3]   = nx;
          norms[i*3+1] = ny;
          norms[i*3+2] = nz;
        }
      }
    }

    normAttr.needsUpdate = true;
  };

  // ── Scene Setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040609);
    scene.fog = new THREE.FogExp2(0x040609, 0.003);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 1000);
    camera.position.set(30, 25, 115);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const canvas = renderer.domElement;
    Object.assign(canvas.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%', touchAction: 'none',
    });
    container.appendChild(canvas);

    // ── 6-point Studio Lighting Rig ──────────────────────────────────────
    const key = new THREE.DirectionalLight(0xfff5e4, 3.5);
    key.position.set(50, 100, 90);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.camera.near = 1;
    key.shadow.camera.far  = 400;
    key.shadow.camera.left = key.shadow.camera.bottom = -80;
    key.shadow.camera.right = key.shadow.camera.top   =  80;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc8dcff, 1.4);
    fill.position.set(-70, 20, 60); scene.add(fill);

    const back = new THREE.DirectionalLight(0xffcfa0, 2.0);
    back.position.set(0, -60, -100); scene.add(back);

    const top = new THREE.DirectionalLight(0xffffff, 1.2);
    top.position.set(0, 150, 0); scene.add(top);

    const rim = new THREE.DirectionalLight(0x00d4ff, 1.0);
    rim.position.set(-80, -30, -50); scene.add(rim);

    const under = new THREE.DirectionalLight(0xaabbff, 0.8);
    under.position.set(30, -80, 40); scene.add(under);

    const amb = new THREE.AmbientLight(0xfff0e0, 0.8);
    scene.add(amb);

    const grid = new THREE.GridHelper(200, 40, 0x00aacc, 0x0d1117);
    grid.position.y = -38;
    grid.material.opacity = 0.45;
    grid.material.transparent = true;
    scene.add(grid);

    const sc = document.createElement('canvas'); sc.width = sc.height = 256;
    const sx = sc.getContext('2d');
    const sg = sx.createRadialGradient(128,128,0,128,128,128);
    sg.addColorStop(0,   'rgba(0,180,220,0.30)');
    sg.addColorStop(0.35,'rgba(0,0,0,0.55)');
    sg.addColorStop(1,   'rgba(0,0,0,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 256, 256);
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -37.5;
    scene.add(shadowMesh);

    const mg = new THREE.Group();
    scene.add(mg);
    meshGroupRef.current = mg;

    if (depthMatrix) buildMesh(depthMatrix, depthScale, materialTheme, renderMode, translucency, roughness, marrowEnabled);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor  = 0.06;
    controls.rotateSpeed    = 0.85;
    controls.zoomSpeed      = 1.1;
    controls.enablePan      = false;
    controls.minDistance    = 18;
    controls.maxDistance    = 280;
    controlsRef.current = controls;

    let resumeTimer;
    const onStart = () => { autoRotateRef.current = false; clearTimeout(resumeTimer); };
    const onEnd   = () => { resumeTimer = setTimeout(() => { autoRotateRef.current = true; }, 2500); };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end',   onEnd);

    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (autoRotateRef.current && mg) mg.rotation.y += 0.006;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth, nh = container.clientHeight;
      if (nw > 0 && nh > 0) {
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(container);

    return () => {
      clearTimeout(resumeTimer);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.dispose();
      ro.disconnect();
      cancelAnimationFrame(rafId);
      if (canvas.parentNode === container) container.removeChild(canvas);
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    buildMesh(depthMatrix, depthScale, materialTheme, renderMode, translucency, roughness, marrowEnabled);
  }, [depthMatrix, depthScale, materialTheme, renderMode, translucency, roughness, marrowEnabled, aspectRatio, maxDist]);

  const handleExportSTL = () => {
    if (!meshGroupRef.current) return;
    const blob = new Blob(
      [new STLExporter().parse(meshGroupRef.current, { binary: true })],
      { type: 'application/octet-stream' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bone_model.stl';
    a.click();
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
  };

  const handleReset = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(30, 25, 115);
      cameraRef.current.lookAt(0, 0, 0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    if (meshGroupRef.current) meshGroupRef.current.rotation.set(0, 0, 0);
    autoRotateRef.current = true;
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#040609' }}>

      {/* Canvas mount */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 12, left: 12, right: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none', zIndex: 10,
      }}>
        <div style={{ pointerEvents: 'auto' }}
          className="px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 flex items-center gap-2 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-semibold text-white">360° 3D Bone</span>
          <span className="text-[10px] text-slate-400">Drag to rotate · Scroll to zoom</span>
        </div>
        <div style={{ pointerEvents: 'auto' }} className="flex items-center gap-2">
          <button onClick={handleExportSTL}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all">
            <Download className="w-3.5 h-3.5" />STL
          </button>
          <button onClick={handleReset}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer transition-colors"
            title="Reset view">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
