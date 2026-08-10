import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useMusic } from '../../context/MusicContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import musicVisualizerService from '../../services/musicVisualizerService.js';

/**
 * Creates a delicate, soft glowing radial particle texture.
 */
function createParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Helper to convert CSS color (rgba / hex) to THREE.Color
 */
function parseCssColor(cssStr, fallbackHex = 0x8b5cf6) {
  if (!cssStr) return new THREE.Color(fallbackHex);
  if (cssStr.startsWith('rgba') || cssStr.startsWith('rgb')) {
    const match = cssStr.match(/\d+(\.\d+)?/g);
    if (match && match.length >= 3) {
      return new THREE.Color(
        parseFloat(match[0]) / 255,
        parseFloat(match[1]) / 255,
        parseFloat(match[2]) / 255
      );
    }
  }
  return new THREE.Color(cssStr);
}

export default function MusicReactiveBackground() {
  const mountRef = useRef(null);

  // Audio Context State
  const { currentSong, isPlaying, currentTime, actualDuration, volume } = useMusic();

  // Theme & Category Context State
  const { activeCategorySlug, theme } = useTheme();

  // Mutable refs for Three.js objects
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    particles: null,
    geometry: null,
    material: null,
    texture: null,
    animFrameId: null,
    particleCount: 350,
    basePositions: null,
    phases: null,
    noiseOffsets: null,
    targetColor1: new THREE.Color(0x8b5cf6),
    targetColor2: new THREE.Color(0xec4899),
    currentColor1: new THREE.Color(0x8b5cf6),
    currentColor2: new THREE.Color(0xec4899),
  });

  // Keep latest music/theme props in ref for render loop access
  const stateRef = useRef({
    currentSong,
    isPlaying,
    currentTime,
    actualDuration,
    volume,
    activeCategorySlug,
    theme,
  });

  useEffect(() => {
    stateRef.current = {
      currentSong,
      isPlaying,
      currentTime,
      actualDuration,
      volume,
      activeCategorySlug,
      theme,
    };
  }, [currentSong, isPlaying, currentTime, actualDuration, volume, activeCategorySlug, theme]);

  // Handle color target updates smoothly when theme changes
  useEffect(() => {
    const t = threeRef.current;
    if (!t) return;
    t.targetColor1 = parseCssColor(theme?.primary, 0x8b5cf6);
    t.targetColor2 = parseCssColor(theme?.accent || theme?.secondary, 0xec4899);
  }, [theme]);

  // Main Three.js Scene Setup (Runs ONCE on mount)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const t = threeRef.current;

    // Check device capability & reduced motion preference
    const isMobile = window.innerWidth < 768;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Minimal particle density: 350 desktop, 150 mobile
    const particleCount = isMobile ? 150 : 350;
    t.particleCount = particleCount;

    // 1. Scene
    const scene = new THREE.Scene();
    t.scene = scene;

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.z = 12;
    t.camera = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    t.renderer = renderer;

    // 4. Geometry & Attributes
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const basePositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const noiseOffsets = new Float32Array(particleCount);

    const c1 = parseCssColor(theme?.primary, 0x8b5cf6);
    const c2 = parseCssColor(theme?.accent || theme?.secondary, 0xec4899);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Position in 3D cloud
      const x = (Math.random() - 0.5) * 32;
      const y = (Math.random() - 0.5) * 24;
      const z = (Math.random() - 0.5) * 16 - 2;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      // Color lerp between primary and secondary
      const mixRatio = Math.random();
      const pColor = new THREE.Color().copy(c1).lerp(c2, mixRatio);
      colors[i3] = pColor.r;
      colors[i3 + 1] = pColor.g;
      colors[i3 + 2] = pColor.b;

      // Delicate minimal sizes
      sizes[i] = Math.random() * 0.08 + 0.04;
      phases[i] = Math.random() * Math.PI * 2;
      noiseOffsets[i] = Math.random() * 100;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    t.geometry = geometry;
    t.basePositions = basePositions;
    t.phases = phases;
    t.noiseOffsets = noiseOffsets;

    // 5. Material (Subtle & Soft)
    const texture = createParticleTexture();
    t.texture = texture;

    const material = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    t.material = material;

    // 6. Points Mesh
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    t.particles = particles;

    // Clock for delta timing
    const clock = new THREE.Clock();

    // 7. Render Loop
    const animate = () => {
      t.animFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const s = stateRef.current;

      // Get real-time audio analysis metrics
      const metrics = musicVisualizerService.update({
        isPlaying: s.isPlaying,
        currentTime: s.currentTime,
        duration: s.actualDuration,
        currentSong: s.currentSong,
        category: s.activeCategorySlug,
        volume: s.volume,
        delta,
      });

      const { bass, mid, treble, beatPulse } = metrics;
      const speedMultiplier = s.isPlaying ? (reducedMotion ? 0.2 : 0.6) : (reducedMotion ? 0.05 : 0.15);

      // Interpolate global colors towards target theme colors
      t.currentColor1.lerp(t.targetColor1, 0.04);
      t.currentColor2.lerp(t.targetColor2, 0.04);

      const posArray = geometry.attributes.position.array;
      const colArray = geometry.attributes.color.array;

      const category = s.activeCategorySlug || 'default';

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const phase = phases[i];
        const noise = noiseOffsets[i];
        const baseX = basePositions[i3];
        const baseY = basePositions[i3 + 1];
        const baseZ = basePositions[i3 + 2];

        // Minimal dynamic motion calculation based on category
        switch (category) {
          case 'rain-hindi':
            posArray[i3 + 1] -= (0.06 + bass * 0.08) * speedMultiplier;
            posArray[i3] = baseX + Math.sin(time * 0.8 + phase) * 0.3;
            if (posArray[i3 + 1] < -12) posArray[i3 + 1] = 12;
            break;

          case 'sad-hindi':
            posArray[i3 + 1] -= (0.02 + bass * 0.03) * speedMultiplier;
            posArray[i3] = baseX + Math.sin(time * 0.4 + phase) * 0.4;
            if (posArray[i3 + 1] < -12) posArray[i3 + 1] = 12;
            break;

          case 'party-hindi':
          case 'workout-hindi':
          case 'bollywood-hits': {
            const angle = time * 0.25 * speedMultiplier + phase;
            const dist = Math.sqrt(baseX * baseX + baseY * baseY) * (1.0 + bass * 0.15 + beatPulse * 0.08);
            posArray[i3] = Math.cos(angle) * dist;
            posArray[i3 + 1] = Math.sin(angle) * dist;
            posArray[i3 + 2] = baseZ + Math.sin(time * 1.2 + noise) * (0.3 + mid * 0.4);
            break;
          }

          case 'romantic-hindi':
          case 'lo-fi-hindi':
          case 'acoustic-hindi': {
            posArray[i3] = baseX + Math.sin(time * 0.3 * speedMultiplier + phase) * (0.5 + mid * 0.3);
            posArray[i3 + 1] = baseY + Math.cos(time * 0.2 * speedMultiplier + noise) * (0.5 + bass * 0.2);
            posArray[i3 + 2] = baseZ + Math.sin(time * 0.15 + phase) * 0.3;
            break;
          }

          case 'old-hindi':
            posArray[i3] = baseX + Math.sin(time * 0.1 * speedMultiplier + phase) * 0.3;
            posArray[i3 + 1] = baseY + Math.cos(time * 0.1 * speedMultiplier + noise) * 0.3;
            posArray[i3 + 2] = baseZ + Math.sin(time * 0.08 + phase) * 0.2;
            break;

          case 'indie-hindi':
            posArray[i3] = baseX + Math.sin(time * 0.4 * speedMultiplier + noise) * (0.5 + mid * 0.3);
            posArray[i3 + 1] = baseY + Math.cos(time * 0.35 * speedMultiplier + phase) * (0.5 + bass * 0.3);
            posArray[i3 + 2] = baseZ + Math.sin(time * 0.25 + noise) * 0.3;
            break;

          default:
            posArray[i3] = baseX + Math.sin(time * 0.2 * speedMultiplier + phase) * (0.4 + mid * 0.25);
            posArray[i3 + 1] = baseY + Math.cos(time * 0.18 * speedMultiplier + noise) * (0.4 + bass * 0.25);
            posArray[i3 + 2] = baseZ + Math.sin(time * 0.15 + phase) * 0.25;
            break;
        }

        // Color updating per particle
        const mix = (Math.sin(phase + time * 0.15) + 1.0) * 0.5;
        colArray[i3] = t.currentColor1.r * (1 - mix) + t.currentColor2.r * mix;
        colArray[i3 + 1] = t.currentColor1.g * (1 - mix) + t.currentColor2.g * mix;
        colArray[i3 + 2] = t.currentColor1.b * (1 - mix) + t.currentColor2.b * mix;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;

      // Subtle Scene Rotation
      if (particles) {
        particles.rotation.y = time * 0.01 * speedMultiplier + (mid * 0.02);
      }

      // Delicate beat pulse on size & opacity
      material.size = 0.09 + (bass * 0.02) + (beatPulse * 0.02);
      material.opacity = 0.38 + (beatPulse * 0.1) + (bass * 0.05);

      // Gentle camera float
      camera.position.x = Math.sin(time * 0.05) * 0.2;
      camera.position.y = Math.cos(time * 0.05) * 0.2;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resize Listener
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // 9. Cleanup on Unmount
    return () => {
      if (t.animFrameId) cancelAnimationFrame(t.animFrameId);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []); // Run setup once on mount

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 -z-15 pointer-events-none transition-opacity duration-1000"
      style={{ opacity: 0.65 }}
    />
  );
}
