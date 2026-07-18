// Procedural generator for realistic X-ray bone scan samples
// Generates high-resolution data URLs for Femur, Skull, Spine, Hand, Knee, and Ribs

export const generateSampleXrays = () => {
  const samples = [
    {
      id: 'femur',
      name: 'Human Femur (Thigh)',
      description: 'Right femur showing cortical bone shaft, femoral neck, and head.',
      type: 'Long Bone',
      draw: (ctx, width, height) => {
        // Dark background with X-ray vignetting
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.7);
        bgGrad.addColorStop(0, '#101520');
        bgGrad.addColorStop(1, '#04060a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Soft X-ray glow noise
        drawXrayNoise(ctx, width, height, 0.08);

        ctx.save();
        ctx.translate(width / 2, height / 2);

        // Femur shaft
        ctx.beginPath();
        ctx.moveTo(-25, -160);
        ctx.bezierCurveTo(-20, -80, -22, 80, -32, 160);
        ctx.lineTo(32, 160);
        ctx.bezierCurveTo(22, 80, 20, -80, 25, -160);
        ctx.closePath();

        const shaftGrad = ctx.createLinearGradient(-35, 0, 35, 0);
        shaftGrad.addColorStop(0, 'rgba(235, 245, 255, 0.95)');
        shaftGrad.addColorStop(0.25, 'rgba(170, 200, 220, 0.55)');
        shaftGrad.addColorStop(0.75, 'rgba(170, 200, 220, 0.55)');
        shaftGrad.addColorStop(1, 'rgba(235, 245, 255, 0.95)');
        ctx.fillStyle = shaftGrad;
        ctx.shadowColor = 'rgba(140, 210, 255, 0.6)';
        ctx.shadowBlur = 15;
        ctx.fill();

        // Femoral head & neck (Top)
        ctx.beginPath();
        ctx.ellipse(-45, -175, 30, 28, Math.PI / 5, 0, Math.PI * 2);
        const headGrad = ctx.createRadialGradient(-45, -175, 5, -45, -175, 30);
        headGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        headGrad.addColorStop(0.6, 'rgba(200, 230, 255, 0.7)');
        headGrad.addColorStop(1, 'rgba(120, 160, 190, 0.2)');
        ctx.fillStyle = headGrad;
        ctx.fill();

        // Greater trochanter (Top right bump)
        ctx.beginPath();
        ctx.ellipse(35, -170, 22, 35, -Math.PI / 6, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();

        // Condyles (Bottom distal end)
        ctx.beginPath();
        ctx.ellipse(-30, 175, 28, 20, 0, 0, Math.PI * 2);
        ctx.ellipse(30, 175, 28, 20, 0, 0, Math.PI * 2);
        ctx.fillStyle = headGrad;
        ctx.fill();

        // Inner marrow cavity texture (spongey trabecular bone)
        ctx.fillStyle = 'rgba(200, 235, 255, 0.25)';
        for (let i = 0; i < 400; i++) {
          const rx = (Math.random() - 0.5) * 40;
          const ry = (Math.random() - 0.5) * 300;
          const r = Math.random() * 2.5 + 0.5;
          ctx.beginPath();
          ctx.arc(rx, ry, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    },
    {
      id: 'skull',
      name: 'Cranium & Skull (Lateral)',
      description: 'Lateral cranial vault, mandible bone structure, and facial sinuses.',
      type: 'Irregular / Flat',
      draw: (ctx, width, height) => {
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.7);
        bgGrad.addColorStop(0, '#0f141f');
        bgGrad.addColorStop(1, '#030508');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        drawXrayNoise(ctx, width, height, 0.07);

        ctx.save();
        ctx.translate(width / 2 - 10, height / 2 - 10);

        // Cranial outline
        ctx.beginPath();
        ctx.arc(-10, -30, 135, Math.PI * 0.75, Math.PI * 2.15);
        ctx.bezierCurveTo(130, 30, 110, 90, 80, 110);
        ctx.bezierCurveTo(40, 130, -20, 120, -50, 110);
        ctx.bezierCurveTo(-110, 80, -140, 30, -120, -50);
        ctx.closePath();

        const skullGrad = ctx.createRadialGradient(0, -20, 20, 0, 0, 140);
        skullGrad.addColorStop(0, 'rgba(120, 160, 190, 0.2)');
        skullGrad.addColorStop(0.7, 'rgba(180, 215, 240, 0.5)');
        skullGrad.addColorStop(0.92, 'rgba(240, 250, 255, 0.95)');
        skullGrad.addColorStop(1, 'rgba(100, 140, 170, 0.1)');
        ctx.fillStyle = skullGrad;
        ctx.shadowColor = 'rgba(0, 220, 255, 0.5)';
        ctx.shadowBlur = 12;
        ctx.fill();

        // Eye socket (Orbit)
        ctx.beginPath();
        ctx.ellipse(55, -20, 28, 24, Math.PI / 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 22, 32, 0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(230, 245, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Nasal cavity
        ctx.beginPath();
        ctx.ellipse(85, 20, 18, 30, -Math.PI / 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(12, 18, 28, 0.9)';
        ctx.fill();

        // Mandible (Jawbone)
        ctx.beginPath();
        ctx.moveTo(30, 60);
        ctx.bezierCurveTo(75, 65, 80, 100, 70, 135);
        ctx.lineTo(20, 145);
        ctx.lineTo(-40, 110);
        ctx.lineTo(-30, 60);
        ctx.closePath();
        ctx.fillStyle = 'rgba(220, 240, 255, 0.75)';
        ctx.fill();

        // Cranial sutures (micro fracture lines)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-30, -160);
        ctx.lineTo(-15, -120); ctx.lineTo(-25, -90); ctx.lineTo(-10, -50);
        ctx.stroke();

        ctx.restore();
      }
    },
    {
      id: 'hand',
      name: 'Human Hand & Wrist',
      description: 'Carpals, metacarpals, and phalanges showing joint articulation.',
      type: 'Appendicular',
      draw: (ctx, width, height) => {
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.7);
        bgGrad.addColorStop(0, '#0c101a');
        bgGrad.addColorStop(1, '#020407');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        drawXrayNoise(ctx, width, height, 0.08);

        ctx.save();
        ctx.translate(width / 2, height / 2 + 20);

        // Radius & Ulna (Wrist base)
        drawBoneSegment(ctx, -25, 120, -20, 190, 22, 18);
        drawBoneSegment(ctx, 25, 120, 20, 190, 18, 16);

        // Carpals (Wrist bones cluster)
        ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
        const carpals = [
          [-20, 95, 10], [0, 95, 11], [20, 95, 10],
          [-25, 80, 9], [-5, 80, 12], [15, 80, 10], [30, 82, 8]
        ];
        carpals.forEach(([cx, cy, r]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        });

        // 5 Fingers (Metacarpals & Phalanges)
        const fingers = [
          { angle: -0.45, x: -50, len: [55, 30, 25] }, // Thumb
          { angle: -0.15, x: -25, len: [70, 40, 30] }, // Index
          { angle: 0.0,   x: 0,   len: [75, 45, 32] }, // Middle
          { angle: 0.15,  x: 25,  len: [70, 42, 28] }, // Ring
          { angle: 0.35,  x: 48,  len: [60, 32, 24] }  // Pinky
        ];

        fingers.forEach(f => {
          let currX = f.x;
          let currY = 65;
          f.len.forEach((l, idx) => {
            const nextX = currX + Math.sin(f.angle) * l;
            const nextY = currY - Math.cos(f.angle) * l;
            const w = 14 - idx * 2.5;
            drawBoneSegment(ctx, currX, currY, nextX, nextY, w, w * 0.8);
            currX = nextX + Math.sin(f.angle) * 4;
            currY = nextY - Math.cos(f.angle) * 4;
          });
        });

        ctx.restore();
      }
    },
    {
      id: 'spine',
      name: 'Lumbar Spine Vertebrae',
      description: 'Vertebral bodies L1-L5 with intervertebral disc spaces.',
      type: 'Axial Skeleton',
      draw: (ctx, width, height) => {
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.7);
        bgGrad.addColorStop(0, '#111724');
        bgGrad.addColorStop(1, '#04070d');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        drawXrayNoise(ctx, width, height, 0.09);

        ctx.save();
        ctx.translate(width / 2, height / 2);

        // 5 Vertebrae bodies
        for (let i = -2; i <= 2; i++) {
          const y = i * 70;
          // Vertebral block
          ctx.beginPath();
          ctx.roundRect(-45, y - 24, 90, 48, 10);

          const vertGrad = ctx.createLinearGradient(0, y - 24, 0, y + 24);
          vertGrad.addColorStop(0, 'rgba(245, 250, 255, 0.95)');
          vertGrad.addColorStop(0.3, 'rgba(160, 195, 220, 0.45)');
          vertGrad.addColorStop(0.7, 'rgba(160, 195, 220, 0.45)');
          vertGrad.addColorStop(1, 'rgba(245, 250, 255, 0.95)');
          ctx.fillStyle = vertGrad;
          ctx.shadowColor = 'rgba(0, 230, 255, 0.4)';
          ctx.shadowBlur = 10;
          ctx.fill();

          // Spinous process (posterior extension)
          ctx.beginPath();
          ctx.ellipse(55, y, 25, 12, Math.PI / 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(210, 235, 255, 0.7)';
          ctx.fill();

          // Intervertebral Disc Space indicator
          if (i < 2) {
            ctx.fillStyle = 'rgba(10, 20, 35, 0.7)';
            ctx.fillRect(-40, y + 24, 80, 20);
          }
        }

        ctx.restore();
      }
    },
    {
      id: 'knee',
      name: 'Knee Joint (Patella & Tibia)',
      description: 'Distal femur, proximal tibia, fibula, and patellar anterior overlay.',
      type: 'Joint Articulation',
      draw: (ctx, width, height) => {
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.7);
        bgGrad.addColorStop(0, '#0e1422');
        bgGrad.addColorStop(1, '#03050a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        drawXrayNoise(ctx, width, height, 0.08);

        ctx.save();
        ctx.translate(width / 2, height / 2);

        // Distal Femur (Top)
        drawBoneSegment(ctx, 0, -190, 0, -30, 35, 60);

        // Proximal Tibia (Bottom main)
        drawBoneSegment(ctx, 0, 30, 0, 190, 58, 32);

        // Fibula (Bottom lateral thin bone)
        drawBoneSegment(ctx, 45, 60, 48, 190, 16, 12);

        // Patella (Knee Cap overlay)
        ctx.beginPath();
        ctx.ellipse(-8, -15, 26, 32, -Math.PI / 12, 0, Math.PI * 2);
        const patellaGrad = ctx.createRadialGradient(-8, -15, 5, -8, -15, 30);
        patellaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        patellaGrad.addColorStop(1, 'rgba(150, 190, 225, 0.3)');
        ctx.fillStyle = patellaGrad;
        ctx.shadowColor = 'rgba(100, 220, 255, 0.6)';
        ctx.shadowBlur = 15;
        ctx.fill();

        ctx.restore();
      }
    }
  ];

  // Render each sample to Data URL
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  return samples.map(sample => {
    ctx.clearRect(0, 0, 512, 512);
    sample.draw(ctx, 512, 512);
    return {
      ...sample,
      dataUrl: canvas.toDataURL('image/png')
    };
  });
};

function drawXrayNoise(ctx, width, height, alpha) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.5;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawBoneSegment(ctx, x1, y1, x2, y2, r1, r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, -r1);
  ctx.lineTo(len, -r2);
  ctx.arc(len, 0, r2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r1);
  ctx.arc(0, 0, r1, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();

  const boneGrad = ctx.createLinearGradient(0, -Math.max(r1, r2), 0, Math.max(r1, r2));
  boneGrad.addColorStop(0, 'rgba(240, 250, 255, 0.92)');
  boneGrad.addColorStop(0.2, 'rgba(150, 190, 220, 0.5)');
  boneGrad.addColorStop(0.8, 'rgba(150, 190, 220, 0.5)');
  boneGrad.addColorStop(1, 'rgba(240, 250, 255, 0.92)');

  ctx.fillStyle = boneGrad;
  ctx.shadowColor = 'rgba(0, 210, 255, 0.4)';
  ctx.shadowBlur = 10;
  ctx.fill();

  ctx.restore();
}
