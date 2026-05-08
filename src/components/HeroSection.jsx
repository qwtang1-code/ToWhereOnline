import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Text, Stars, Billboard, Float } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

const KEYWORDS = ["蛤？这样不好吧", "狗又干啥了？", "咪在干嘛？", "我们的日常"];

// 全部蓝绿色调
const PLANET_ASSETS = [
  { texture: `${import.meta.env.BASE_URL}images/planet_rocky.png`, color: '#4ECDC4', size: 0.8, radius: 5, inclination: 0.2, speed: 0.4 },
  { texture: `${import.meta.env.BASE_URL}images/planet_ice.png`, color: '#22A6B3', size: 1.0, radius: 7, inclination: -0.3, speed: 0.35 },
  { texture: `${import.meta.env.BASE_URL}images/planet_lava.png`, color: '#00CEC9', size: 1.2, radius: 9, inclination: 0.5, speed: 0.3 },
  { texture: `${import.meta.env.BASE_URL}images/planet_void.png`, color: '#7ED6DF', size: 0.7, radius: 11, inclination: -0.6, speed: 0.25 }
];

function Planet({ text, config, index }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const texture = useLoader(THREE.TextureLoader, config.texture);
  const { radius, speed, size } = config;
  const initialAngle = useMemo(() => (index / KEYWORDS.length) * Math.PI * 2 + Math.random(), []);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + initialAngle;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    if (meshRef.current) {
      meshRef.current.position.set(x, 0, z);
      meshRef.current.rotation.y += 0.002;
    }
    if (glowRef.current) {
      const pulse = Math.sin(clock.getElapsedTime() * 2 + index) * 0.15 + 0.85;
      glowRef.current.material.opacity = pulse * 0.2;
    }
  });

  return (
    <group>
      <group ref={meshRef}>
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
          {/* 主球体：蓝绿色调 + 自发光提亮 */}
          <mesh>
            <sphereGeometry args={[size, 64, 64]} />
            <meshStandardMaterial
              map={texture}
              color="white"
              emissive={config.color}
              emissiveIntensity={0.3}
              roughness={0.4}
              metalness={0.3}
            />
          </mesh>

          {/* 外层柔和光晕 */}
          <mesh scale={[1.15, 1.15, 1.15]} ref={glowRef}>
            <sphereGeometry args={[size, 32, 32]} />
            <meshBasicMaterial
              color={config.color}
              transparent
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* 外层辉光 */}
          <mesh scale={[1.35, 1.35, 1.35]}>
            <sphereGeometry args={[size, 32, 32]} />
            <meshBasicMaterial
              color={config.color}
              transparent
              opacity={0.06}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Hover 高亮 */}
          {hovered && (
            <mesh scale={[1.02, 1.02, 1.02]}>
              <sphereGeometry args={[size, 64, 64]} />
              <meshBasicMaterial color="white" transparent opacity={0.15} side={THREE.FrontSide} depthWrite={false} />
            </mesh>
          )}

          {/* 文字标签 */}
          <Billboard position={[0, size * 1.8, 0]}>
            <Text fontSize={0.5} color="white" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="black" fontWeight="bold">
              {text}
            </Text>
          </Billboard>
        </Float>
      </group>
    </group>
  );
}

function OrbitGroup({ text, config, index }) {
  const rotationEuler = new THREE.Euler(config.inclination, 0, 0);
  return (
    <group rotation={rotationEuler}>
      <Planet text={text} config={config} index={index} />
    </group>
  );
}

function Sun() {
  const texture = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}images/sun_texture.png`);
  return (
    <group>
      <Float speed={0.5} rotationIntensity={0.05} floatIntensity={0.05}>
        <mesh>
          <sphereGeometry args={[3, 64, 64]} />
          <meshBasicMaterial map={texture} color="#a8e6cf" />
        </mesh>
        <mesh scale={[1.2, 1.2, 1.2]}>
          <sphereGeometry args={[3, 64, 64]} />
          <meshBasicMaterial color="#4ECDC4" transparent opacity={0.2} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
        </mesh>
      </Float>
    </group>
  );
}

function Scene() {
  return (
    <>
      {/* 调亮环境光 */}
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 0, 0]} intensity={3.0} distance={100} decay={1} color="#a8e6cf" />
      <ambientLight intensity={0.4} color="#4ECDC4" />
      {KEYWORDS.map((word, i) => (
        <OrbitGroup key={i} text={word} config={PLANET_ASSETS[i]} index={i} />
      ))}
      <Stars radius={90} depth={20} count={3000} factor={4} saturation={0} fade speed={0.2} />
    </>
  );
}

export default function HeroSection({ goTo }) {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 4, 32], fov: 45 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }} style={{ position: 'relative', zIndex: 2 }}>
        <React.Suspense fallback={null}>
          <Scene />
        </React.Suspense>
      </Canvas>
      <div style={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <motion.button
          whileHover={{ scale: 1.05, borderColor: '#4ECDC4', boxShadow: '0 0 20px rgba(78, 205, 196, 0.3)' }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'relative', padding: '16px 48px', background: 'rgba(10, 20, 30, 0.6)',
            border: '1px solid rgba(255,255,255,0.2)', color: '#4ECDC4', fontSize: '16px',
            letterSpacing: '4px', cursor: 'pointer', backdropFilter: 'blur(4px)',
            fontFamily: '"Rajdhani", sans-serif', fontWeight: '600', textTransform: 'uppercase',
            clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)',
            textShadow: '0 0 10px rgba(78, 205, 196, 0.3)'
          }}
          onClick={() => { if (goTo) goTo('annual'); }}
        >
          <span style={{ marginRight: '10px' }}>▶</span>
          ENTER SYSTEM
        </motion.button>
      </div>
    </div>
  );
}