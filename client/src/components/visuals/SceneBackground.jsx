import { Canvas, useFrame } from '@react-three/fiber';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const ParticleSystem = ({ animation, color }) => {
  const pointsRef = useRef();

  const particleCount = useMemo(() => {
    switch (animation) {
      case 'dust': return 800;
      case 'rain': return 1500;
      case 'energy': return 600;
      case 'cinematic': return 300;
      default: return 500;
    }
  }, [animation]);

  const particles = useMemo(() => {
    const temp = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      temp[i * 3] = (Math.random() - 0.5) * 15;
      temp[i * 3 + 1] = (Math.random() - 0.5) * 15;
      temp[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5;
    }
    return temp;
  }, [particleCount]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    
    // Animate based on theme
    const positions = pointsRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      switch (animation) {
        case 'rain':
          positions[i3 + 1] -= delta * 5;
          if (positions[i3 + 1] < -7.5) positions[i3 + 1] = 7.5;
          break;
        case 'energy':
          positions[i3 + 1] += delta * 2;
          positions[i3] += Math.sin(state.clock.elapsedTime + i) * 0.01;
          if (positions[i3 + 1] > 7.5) positions[i3 + 1] = -7.5;
          break;
        case 'dust':
        case 'floating-particles':
        case 'slow-particles':
          const speedMultiplier = animation === 'slow-particles' ? 0.05 : 0.15;
          positions[i3 + 1] += Math.sin(state.clock.elapsedTime * speedMultiplier + i) * 0.002;
          positions[i3] += Math.cos(state.clock.elapsedTime * speedMultiplier + i) * 0.002;
          break;
        case 'road-lights':
          positions[i3] -= delta * 8;
          if (positions[i3] < -7.5) positions[i3] = 7.5;
          break;
        default:
          positions[i3 + 1] += Math.sin(state.clock.elapsedTime * 0.1 + i) * 0.005;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    if (animation !== 'rain' && animation !== 'road-lights') {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
      pointsRef.current.rotation.z = state.clock.elapsedTime * 0.01;
    } else {
      pointsRef.current.rotation.y = 0;
      pointsRef.current.rotation.z = 0;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={particles} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial 
        size={animation === 'dust' ? 0.015 : animation === 'energy' ? 0.03 : 0.02} 
        color={color} 
        transparent 
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default function SceneBackground() {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }} gl={{ alpha: true, antialias: false }}>
        <ambientLight intensity={0.5} />
        <ParticleSystem animation={theme.animation} color={theme.primary} />
      </Canvas>
    </div>
  );
}
