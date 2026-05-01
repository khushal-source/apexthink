import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import '../landing.css';

import { lerp, clamp, smoothstep, easeOut } from '../utils/animations';

// quick fix for scroll length, can improve later
const MAX_SCROLL = 2400;

export default function LandingPage() {
  const canvasRef = useRef(null);
  const scrollRaw = useRef(0);
  const scrollSmooth = useRef(0);
  const [progress, setProgress] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W() / H(), 0.1, 1000);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W(), H());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const textureLoader = new THREE.TextureLoader();
    const logoTexture = textureLoader.load('/github-logo.png');
    logoTexture.colorSpace = THREE.SRGBColorSpace;

    const planeSize = 3.6;
    const logoMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      alphaMap: logoTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const logoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeSize, planeSize),
      logoMat
    );
    mainGroup.add(logoPlane);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringGeo = new THREE.TorusGeometry(2.1, 0.04, 32, 128);
    const glowRing = new THREE.Mesh(ringGeo, ringMat);
    glowRing.position.z = 0.02;
    mainGroup.add(glowRing);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 512;
    glowCanvas.height = 512;
    const ctx = glowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    const glowSpriteMat = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowSpriteMat);
    glowSprite.scale.set(8, 8, 1);
    glowSprite.position.z = -0.5;
    mainGroup.add(glowSprite);

    const backLight = new THREE.PointLight(0xffffff, 30, 25);
    backLight.position.set(0, 0, -2);
    mainGroup.add(backLight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const keyLight = new THREE.PointLight(0xffffff, 15, 20);
    keyLight.position.set(3, 3, 4);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0xf0f0f0, 10, 18);
    fillLight.position.set(-3, -2, -4);
    scene.add(fillLight);

    const clock = new THREE.Clock();
    let raf;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      scrollSmooth.current = lerp(scrollSmooth.current, scrollRaw.current, 0.06);
      const p = clamp(scrollSmooth.current / MAX_SCROLL, 0, 1);
      setProgress(p);

      const zoomT  = smoothstep(0.12, 0.55, p);
      const glowT  = smoothstep(0.10, 0.50, p);
      const moveT  = smoothstep(0.40, 0.75, p);

      camera.position.z = lerp(6, 3.0, easeOut(zoomT));
      camera.fov = lerp(60, 48, zoomT);
      camera.updateProjectionMatrix();

      const floatY = Math.sin(t * 0.6) * 0.08 * (1 - moveT);
      const floatX = Math.cos(t * 0.4) * 0.05 * (1 - moveT);
      const s = lerp(1.0, 1.2, easeOut(zoomT));
      mainGroup.scale.set(s, s, s);
      mainGroup.position.y = floatY + lerp(0, 2.0, easeOut(moveT));
      const leftOffset = window.innerWidth > 768 ? -2.8 : 0;
      mainGroup.position.x = floatX + lerp(leftOffset, 0, moveT);
      mainGroup.rotation.y = Math.sin(t * 0.3) * 0.08 * (1 - moveT);
      mainGroup.rotation.x = Math.cos(t * 0.25) * 0.05 * (1 - moveT * 0.8);

      ringMat.opacity = lerp(0.6, 1.0, glowT) + Math.sin(t * 3) * 0.15 * (1 - moveT);
      
      glowSpriteMat.opacity = lerp(0.7, 1.0, glowT);
      glowSprite.scale.setScalar(lerp(7, 10, glowT));
      backLight.intensity = lerp(25, 50, glowT);

      logoMat.opacity = lerp(1.0, 0.2, moveT);
      ringMat.opacity = lerp(ringMat.opacity, 0.0, moveT);
      glowSpriteMat.opacity = lerp(glowSpriteMat.opacity, 0.05, moveT);

      keyLight.position.x  = Math.sin(t * 0.4) * 4;
      keyLight.position.z  = Math.cos(t * 0.4) * 4;
      keyLight.intensity   = lerp(12, 20, glowT);
      fillLight.position.x = Math.cos(t * 0.3) * 3;
      fillLight.intensity  = lerp(10, 18, glowT);

      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); renderer.dispose(); };
  }, []);

  useEffect(() => {
    const onWheel = e => {
      // Allow scrolling normally if the user hasn't fully triggered the app intro yet
      scrollRaw.current = clamp(scrollRaw.current + e.deltaY * 1.2, 0, MAX_SCROLL);
    };
    let ty = 0;
    const onTS = e => { ty = e.touches[0].clientY; };
    const onTM = e => {
      const dy = ty - e.touches[0].clientY; ty = e.touches[0].clientY;
      scrollRaw.current = clamp(scrollRaw.current + dy * 2.5, 0, MAX_SCROLL);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTS, { passive: true });
    window.addEventListener('touchmove', onTM, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTS);
      window.removeEventListener('touchmove', onTM);
    };
  }, []);

  const cardT = easeOut(clamp((progress - 0.48) / 0.37, 0, 1));
  const dimmer = smoothstep(0.35, 0.65, progress) * 0.55;
  const indicatorOp = 1 - smoothstep(0.03, 0.15, progress);
  const rightPanelOp = 1 - smoothstep(0.1, 0.35, progress);

  const handleSubmit = e => {
    e.preventDefault();
    if (inputValue.trim()) {
      setIsSubmitted(true);
      setTimeout(() => {
        navigate('/dashboard?url=' + encodeURIComponent(inputValue));
      }, 500);
    }
  };

  return (
    <div className="scene-root">
      <canvas ref={canvasRef} className="scene-canvas" />
      <div className="ambient-glow" style={{ opacity: lerp(0.3, 0.7, smoothstep(0.15, 0.45, progress)) }} />
      <div className="scene-dimmer" style={{ opacity: dimmer }} />
      
      <div className="right-panel" style={{ opacity: rightPanelOp, transform: "translateY(calc(-50% - " + (progress * 150) + "px))" }}>
        <h1 className="model-title">APEX THINK</h1>
        <p className="model-tagline">Understand large codebases quickly with AI-powered graphs and chat.</p>
      </div>

      <div className="card-container" style={{ opacity: cardT, transform: "translateY(" + lerp(80, 0, cardT) + "px)", filter: "blur(" + lerp(14, 0, cardT) + "px)", pointerEvents: cardT > 0.4 ? 'auto' : 'none' }}>
        <div className="core-card">
          <div className="card-header">
            <h2 className="card-title">Analyze your repo</h2>
            <p className="card-subtitle">Paste a GitHub repository to start analysis</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input type="url" className={"repo-input " + (isSubmitted ? 'success' : '')} placeholder="https://github.com/user/repo" value={inputValue} onChange={e => setInputValue(e.target.value)} />
              <button type="submit" className="submit-btn" disabled={isSubmitted}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </form>
          {isSubmitted && <p className="success-msg">✅ Analysis started...</p>}
        </div>
      </div>

      <div className="scroll-indicator" style={{ opacity: indicatorOp }}>
        <div className="scroll-mouse" />
        <span>Scroll to explore</span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ height: (progress * 100) + '%' }} />
      </div>
    </div>
  );
}
