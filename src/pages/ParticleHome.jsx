import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

// --- 配置参数 ---
const PARTICLE_COUNT = 32000; // 调整为80%密度 (40000 * 0.8)

// --- 粒子系统组件 ---
function ParticleSystem({ mousePos, voiceActive, gestureState }) {
  const meshRef = useRef();
  const [particleData, setParticleData] = useState(null);

  // 采样点位逻辑
  useEffect(() => {
    const loadFont = async () => {
      try {
        const fontUrl = `/fonts/custom-font.ttf?v=${Date.now()}`;
        const myFont = new FontFace('CustomCuteFont', `url(${fontUrl})`);
        const loadedFont = await myFont.load();
        document.fonts.add(loadedFont);
        console.log('✅ 自定义字体加载成功');
      } catch (e) {
        console.log('使用系统字体方案');
      }
      await document.fonts.ready;
      generateParticles();
    };

    const generateParticles = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 2400; // 极高分辨率以获得丝滑纹理
      canvas.height = 1200;

      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. 恢复原来的英文字体风格：更具动感的 Pacifico/Brush Script
      // 1. 调整文案大小与位置：To Where ? 放大作为主标题
      ctx.fillStyle = 'white';
      ctx.font = 'italic bold 240px "Pacifico", "Brush Script MT", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('To Where ?', canvas.width / 2, canvas.height / 2 - 100);

      // 2. 一路向哪 往下挪一些，字号适度调整
      ctx.font = 'bold 150px "CustomCuteFont", "YouYuan", "STHupo", sans-serif';
      ctx.fillText('一路向哪', canvas.width / 2, canvas.height / 2 + 140);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const textPoints = [];
      const step = 3; // 进一步提高采样密度以配合极小粒子

      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const idx = (y * canvas.width + x) * 4;
          const alpha = imageData[idx];
          if (alpha > 50) {
            textPoints.push({
              x: (x / canvas.width - 0.5) * 20,
              y: (0.5 - y / canvas.height) * 10,
              alpha: alpha / 255
            });
          }
        }
      }

      const targetPositions = new Float32Array(PARTICLE_COUNT * 3);
      const sizes = new Float32Array(PARTICLE_COUNT);
      const opacities = new Float32Array(PARTICLE_COUNT);
      const phase = new Float32Array(PARTICLE_COUNT); // 闪烁相位

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // 3. 调整比例：更多粒子用于构成文字，提高清晰度
        const isText = Math.random() < 0.75;

        if (isText && textPoints.length > 0) {
          const p = textPoints[Math.floor(Math.random() * textPoints.length)];
          // 减少扩散范围，让文字更锐利
          const spread = (1.1 - p.alpha) * 0.3;
          targetPositions[i3] = p.x + (Math.random() - 0.5) * spread;
          targetPositions[i3 + 1] = p.y + (Math.random() - 0.5) * spread;
          targetPositions[i3 + 2] = (Math.random() - 0.5) * 0.2;

          // 3. 字粒子稍微放大，增加密度感
          sizes[i] = Math.random() * 0.03 + 0.12;
          opacities[i] = p.alpha * (Math.random() * 0.1 + 0.9); // 显著增加透明度 (0.9 - 1.0)
        } else {
          // 背景深空粒子 - 维持微小感
          targetPositions[i3] = (Math.random() - 0.5) * 45;
          targetPositions[i3 + 1] = (Math.random() - 0.5) * 28;
          targetPositions[i3 + 2] = (Math.random() - 0.5) * 10;

          sizes[i] = Math.random() * 0.02 + 0.08;
          opacities[i] = Math.random() * 0.2 + 0.8; // 显著增加透明度 (0.8 - 1.0)
        }
        phase[i] = Math.random() * Math.PI * 2;
      }
      setParticleData({ targetPositions, sizes, opacities, phase });
    };

    loadFont();
  }, []);

  const curPos = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) pos[i] = (Math.random() - 0.5) * 50;
    return pos;
  }, []);

  const vels = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !particleData) return;

    const attrPos = meshRef.current.geometry.attributes.position;
    const attrSize = meshRef.current.geometry.attributes.size;
    const time = state.clock.getElapsedTime();
    const mouse = mousePos.current;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const tx = particleData.targetPositions[i3];
      const ty = particleData.targetPositions[i3 + 1];
      const tz = particleData.targetPositions[i3 + 2];

      let force = 0.035;
      if (gestureState === 'scatter') force = -0.08;
      if (gestureState === 'gather') force = 0.12;

      vels[i3] += (tx - curPos[i3]) * force;
      vels[i3 + 1] += (ty - curPos[i3 + 1]) * force;
      vels[i3 + 2] += (tz - curPos[i3 + 2]) * force;

      // 优雅的鼠标交互
      const dx = curPos[i3] - mouse.x;
      const dy = curPos[i3 + 1] - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5) {
        const ease = Math.pow(1 - dist / 1.5, 2);
        vels[i3] += dx * ease * 0.15;
        vels[i3 + 1] += dy * ease * 0.15;
      }

      // 语音交互抖动
      if (voiceActive) {
        vels[i3] += (Math.random() - 0.5) * 0.1;
        vels[i3 + 1] += (Math.random() - 0.5) * 0.1;
      }

      curPos[i3] += vels[i3];
      curPos[i3 + 1] += vels[i3 + 1];
      curPos[i3 + 2] += vels[i3 + 2];

      vels[i3] *= 0.86;
      vels[i3 + 1] *= 0.86;
      vels[i3 + 2] *= 0.86;

      // 3. 动态微调大小 - 严格限制极值 (0.005 -> 0.002)
      attrSize.array[i] = particleData.sizes[i];
    }

    attrPos.needsUpdate = true;
    attrSize.needsUpdate = true;
  });

  if (!particleData) return null;

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={curPos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={PARTICLE_COUNT}
          array={particleData.sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={PARTICLE_COUNT}
          array={particleData.opacities}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexShader={`
          attribute float size;
          attribute float opacity;
          varying float vOpacity;
          void main() {
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (90.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            float r = 0.0;
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            r = dot(cxy, cxy);
            if (r > 1.0) discard;
            
            // 边缘羽化，显著增加发光感，最高强度提升至 4.0
            float alpha = 1.0 - smoothstep(0.0, 1.0, r);
            alpha = pow(alpha, 0.5); // 让光晕衰减更慢，核心更亮
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * vOpacity * 4.0);
          }
        `}
      />
    </points>
  );
}

// --- 主组件 ---
export default function ParticleHome({ goTo }) {
  const mousePos = useRef({ x: 0, y: 0 });
  const [voiceActive, setVoiceActive] = useState(false);
  const [gestureState, setGestureState] = useState('none'); // none, gather, scatter
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef();
  const lastFrameRef = useRef();
  const canvasRef = useRef();

  // 语音识别初始化
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'zh-CN';
      recognition.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript;
        if (text.includes("一路向哪") || text.includes("跳")) {
          setVoiceActive(true);
          setTimeout(() => setVoiceActive(false), 800);
        }
      };
      recognition.start();
      return () => recognition.stop();
    }
  }, []);

  // 摄像头手势检测 (简单的运动向量分析)
  useEffect(() => {
    if (!isCameraActive) return;

    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;

        const detect = () => {
          if (!videoRef.current || !canvasRef.current) return;
          const ctx = canvasRef.current.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, 80, 60);
          const frame = ctx.getImageData(0, 0, 80, 60);

          if (lastFrameRef.current) {
            let diff = 0;
            let count = 0;

            for (let i = 0; i < frame.data.length; i += 4) {
              const d = Math.abs(frame.data[i] - lastFrameRef.current.data[i]);
              if (d > 40) {
                diff++;
                count++;
              }
            }

            // 手势逻辑：剧烈运动散开，微小聚集聚拢
            if (count > 800) setGestureState('scatter');
            else if (count > 50 && count < 300) setGestureState('gather');
            else setGestureState('none');
          }

          lastFrameRef.current = frame;
          requestAnimationFrame(detect);
        };
        detect();
      });
  }, [isCameraActive]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#050505',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: '"PingFang SC", sans-serif'
      }}
      onMouseMove={(e) => {
        mousePos.current = {
          x: (e.clientX / window.innerWidth - 0.5) * 10,
          y: (0.5 - e.clientY / window.innerHeight) * 5
        };
      }}
    >
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <color attach="background" args={['#000']} />
        <ParticleSystem
          mousePos={mousePos}
          voiceActive={voiceActive}
          gestureState={gestureState}
        />
      </Canvas>



      {/* 控制中心 */}
      <div style={{
        position: 'absolute',
        bottom: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <ControlButton
            onClick={() => goTo('globe')}
            label="进入一路向哪 →"
            primary
          />
        </div>
      </div>

      {/* 隐藏的计算 Canvas */}
      <video ref={videoRef} autoPlay playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} width="80" height="60" style={{ display: 'none' }} />

      {/* 背景发光 */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(66,133,244,0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
    </div>
  );
}

const ControlButton = ({ active, onClick, label, primary }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)', boxShadow: '0 0 20px rgba(255,255,255,0.2)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        padding: '12px 32px',
        borderRadius: '100px',
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '300',
        letterSpacing: '2px',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s',
        textShadow: '0 0 10px rgba(255,255,255,0.3)'
      }}
    >
      {label}
    </motion.button>
  );
};
