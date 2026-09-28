import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Cpu,
  Wind,
  Compass,
  Play,
  Pause,
} from 'lucide-react';
import { StationData, TwinModule } from '../types';

interface ThreeDDigitalTwinProps {
  station: StationData;
  activeModuleId: string;
  onSelectModule: (moduleId: string) => void;
}

type RenderMode = 'realistic' | 'thermal' | 'wireframe';

export default function ThreeDDigitalTwin({
  station,
  activeModuleId,
  onSelectModule,
}: ThreeDDigitalTwinProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('realistic');
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  const [showBlizzard, setShowBlizzard] = useState(true);
  const [hoveredModuleName, setHoveredModuleName] = useState<string | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const moduleMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const snowParticlesRef = useRef<THREE.Points | null>(null);
  const animFrameIdRef = useRef<number>(0);

  const isBharati = station.id.toLowerCase() === 'bharati';

  // Build the 3D Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a101d);
    scene.fog = new THREE.FogExp2(0x0a101d, 0.015);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    if (isBharati) {
      camera.position.set(28, 22, 32);
    } else {
      camera.position.set(24, 18, 28);
    }

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.minDistance = 8;
    controls.maxDistance = 85;
    controls.target.set(0, 3.5, 0);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(30, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const blueHemisphere = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    scene.add(blueHemisphere);

    const baseLight = new THREE.PointLight(0x38bdf8, 2, 25);
    baseLight.position.set(0, 1, 0);
    scene.add(baseLight);

    // 6. Terrain Ground
    const groundGeo = new THREE.PlaneGeometry(120, 120, 64, 64);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const dist = Math.sqrt(vx * vx + vy * vy);
      const bump = Math.sin(vx * 0.15) * Math.cos(vy * 0.15) * 0.8 + (dist > 30 ? Math.sin(dist * 0.2) * 1.5 : 0);
      pos.setZ(i, bump);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: isBharati ? 0xe2e8f0 : 0xd1d5db,
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(80, 40, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);

    // 7. Build Station Architecture
    const moduleMap = new Map<string, THREE.Group>();
    moduleMeshesRef.current = moduleMap;

    if (isBharati) {
      buildBharatiStation(scene, moduleMap, station.digitalTwinModules);
    } else {
      buildMaitriStation(scene, moduleMap, station.digitalTwinModules);
    }

    // 8. Blizzard Snow Particles
    const snowCount = 1800;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    const snowVel = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount * 3; i += 3) {
      snowPos[i] = (Math.random() - 0.5) * 80;
      snowPos[i + 1] = Math.random() * 40;
      snowPos[i + 2] = (Math.random() - 0.5) * 80;

      snowVel[i] = -0.15 - Math.random() * 0.1;
      snowVel[i + 1] = -0.08 - Math.random() * 0.05;
      snowVel[i + 2] = -0.05 + Math.random() * 0.1;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const snowParticles = new THREE.Points(snowGeo, snowMat);
    scene.add(snowParticles);
    snowParticlesRef.current = snowParticles;

    // 9. Resize Handling
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Raycasting for Click & Hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== scene) {
          if (curr.userData && curr.userData.moduleId) {
            onSelectModule(curr.userData.moduleId);
            return;
          }
          curr = curr.parent;
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let foundName: string | null = null;
      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr !== scene) {
          if (curr.userData && curr.userData.moduleName) {
            foundName = curr.userData.moduleName;
            break;
          }
          curr = curr.parent;
        }
        if (foundName) break;
      }
      setHoveredModuleName(foundName);
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('click', handlePointerDown);
    domEl.addEventListener('mousemove', handlePointerMove);

    // 11. Render Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      controls.update();

      if (snowParticles && snowParticles.visible) {
        const positions = snowParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < snowCount * 3; i += 3) {
          positions[i] += snowVel[i];
          positions[i + 1] += snowVel[i + 1];
          positions[i + 2] += snowVel[i + 2];

          if (positions[i + 1] < 0 || positions[i] < -40) {
            positions[i] = 40;
            positions[i + 1] = 30 + Math.random() * 10;
            positions[i + 2] = (Math.random() - 0.5) * 80;
          }
        }
        snowParticles.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('click', handlePointerDown);
      domEl.removeEventListener('mousemove', handlePointerMove);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [station.id, isBharati]);

  // Handle Render Mode Changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData && obj.userData.isStationPart) {
        const type = obj.userData.moduleType as TwinModule['type'];
        if (renderMode === 'wireframe') {
          obj.material = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
          });
        } else if (renderMode === 'thermal') {
          const thermalColor =
            type === 'energy' ? 0xef4444 :
            type === 'living' ? 0xf59e0b :
            type === 'science' ? 0x10b981 :
            type === 'comms' ? 0x6366f1 :
            0x0284c7;
          obj.material = new THREE.MeshStandardMaterial({
            color: thermalColor,
            emissive: thermalColor,
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.2,
          });
        } else {
          obj.material = obj.userData.originalMaterial || obj.material;
        }
      }
    });
  }, [renderMode]);

  // Handle Active Module Highlight
  useEffect(() => {
    moduleMeshesRef.current.forEach((group, id) => {
      const isSelected = id === activeModuleId;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.highlightMesh) {
          child.visible = isSelected;
        }
      });
    });
  }, [activeModuleId]);

  // Auto-rotate toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotate;
      controlsRef.current.autoRotateSpeed = 1.2;
    }
  }, [isAutoRotate]);

  // Blizzard toggle
  useEffect(() => {
    if (snowParticlesRef.current) {
      snowParticlesRef.current.visible = showBlizzard;
    }
  }, [showBlizzard]);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-slate-950 rounded-xl overflow-hidden border border-sky-900/50 shadow-inner">
      <div ref={mountRef} className="w-full h-full min-h-[480px] cursor-grab active:cursor-grabbing" />

      {/* Top Left HUD */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-sky-500/30 text-xs text-sky-200 shadow-lg pointer-events-auto">
          <Cpu className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span className="font-semibold text-white">WebGL 3D CAD Twin</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
            {isBharati ? 'AERODYNAMIC STILTS ARCHITECTURE' : 'GEODESIC & OASIS HABITAT'}
          </span>
        </div>

        {hoveredModuleName && (
          <div className="bg-sky-950/90 backdrop-blur-md px-3 py-1 rounded-md border border-sky-400/40 text-[11px] font-bold text-sky-200 animate-fadeIn pointer-events-auto">
            Pointing: {hoveredModuleName}
          </div>
        )}
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-sky-500/30 text-xs">
          <button
            type="button"
            onClick={() => setRenderMode('realistic')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              renderMode === 'realistic' ? 'bg-sky-600 text-white shadow-xs font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Realistic CAD
          </button>
          <button
            type="button"
            onClick={() => setRenderMode('thermal')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              renderMode === 'thermal' ? 'bg-rose-600 text-white shadow-xs font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Thermal IR
          </button>
          <button
            type="button"
            onClick={() => setRenderMode('wireframe')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              renderMode === 'wireframe' ? 'bg-cyan-600 text-white shadow-xs font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Wireframe
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowBlizzard(!showBlizzard)}
          className={`p-2 rounded-xl border text-xs backdrop-blur-md transition cursor-pointer ${
            showBlizzard
              ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
              : 'bg-slate-900/90 border-slate-700 text-slate-400'
          }`}
          title="Toggle Polar Snow Particles"
        >
          <Wind className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsAutoRotate(!isAutoRotate)}
          className={`p-2 rounded-xl border text-xs backdrop-blur-md transition cursor-pointer ${
            isAutoRotate
              ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
              : 'bg-slate-900/90 border-slate-700 text-slate-400'
          }`}
          title="Toggle Auto-Orbit"
        >
          {isAutoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Bottom Right Interaction Hint */}
      <div className="hidden sm:flex absolute bottom-4 right-4 z-10 items-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur-xs px-3 py-1 rounded-lg border border-slate-800">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span>Orbit: Left Drag • Pan: Right Drag • Zoom: Scroll • Click Structure to Inspect</span>
      </div>
    </div>
  );
}

function buildBharatiStation(
  scene: THREE.Scene,
  moduleMap: Map<string, THREE.Group>,
  twinModules: TwinModule[]
) {
  // Tier 1: Ground Level & Aerodynamic Stilts (tier1-stilts)
  const stiltsGroup = new THREE.Group();
  stiltsGroup.userData = {
    moduleId: 'tier1-stilts',
    moduleName: 'Ground Level & Aerodynamic Stilts',
    moduleType: 'logistics',
  };

  const stiltMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.25,
  });

  const stiltGeo = new THREE.CylinderGeometry(0.35, 0.4, 4.5, 16);
  for (let x = -9; x <= 9; x += 6) {
    for (let z = -5; z <= 5; z += 3.3) {
      const stilt = new THREE.Mesh(stiltGeo, stiltMat);
      stilt.position.set(x, 2.25, z);
      stilt.castShadow = true;
      stilt.receiveShadow = true;
      stilt.userData = { isStationPart: true, moduleType: 'logistics', originalMaterial: stiltMat };
      stiltsGroup.add(stilt);

      const padGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.4, 16);
      const pad = new THREE.Mesh(padGeo, stiltMat);
      pad.position.set(x, 0.2, z);
      pad.userData = { isStationPart: true, moduleType: 'logistics', originalMaterial: stiltMat };
      stiltsGroup.add(pad);
    }
  }

  const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
  const trussGeo = new THREE.BoxGeometry(19, 0.4, 11);
  const baseDeck = new THREE.Mesh(trussGeo, trussMat);
  baseDeck.position.set(0, 4.5, 0);
  baseDeck.castShadow = true;
  baseDeck.userData = { isStationPart: true, moduleType: 'logistics', originalMaterial: trussMat };
  stiltsGroup.add(baseDeck);

  scene.add(stiltsGroup);
  moduleMap.set('tier1-stilts', stiltsGroup);

  // Tier 2: Combined Heat & Power Plant (tier2-tech)
  const techGroup = new THREE.Group();
  techGroup.userData = {
    moduleId: 'tier2-tech',
    moduleName: 'Second Tier: Combined Heat & Power Plant',
    moduleType: 'energy',
  };

  const techMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
    roughness: 0.35,
  });

  const techBodyGeo = new THREE.BoxGeometry(18, 3.8, 10);
  const techBody = new THREE.Mesh(techBodyGeo, techMat);
  techBody.position.set(0, 6.6, 0);
  techBody.castShadow = true;
  techBody.receiveShadow = true;
  techBody.userData = { isStationPart: true, moduleType: 'energy', originalMaterial: techMat };
  techGroup.add(techBody);

  const stackGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 16);
  const stackMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
  for (let s = -1.5; s <= 1.5; s += 1.5) {
    const stack = new THREE.Mesh(stackGeo, stackMat);
    stack.position.set(6 + s, 9, -4);
    stack.castShadow = true;
    stack.userData = { isStationPart: true, moduleType: 'energy', originalMaterial: stackMat };
    techGroup.add(stack);
  }

  const highlightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
  const techHighlightGeo = new THREE.BoxGeometry(18.4, 4.2, 10.4);
  const techHighlight = new THREE.Mesh(techHighlightGeo, highlightMat);
  techHighlight.position.set(0, 6.6, 0);
  techHighlight.userData = { highlightMesh: true };
  techHighlight.visible = false;
  techGroup.add(techHighlight);

  scene.add(techGroup);
  moduleMap.set('tier2-tech', techGroup);

  // Tier 3: Living Quarters & Science Labs (tier3-living)
  const livingGroup = new THREE.Group();
  livingGroup.userData = {
    moduleId: 'tier3-living',
    moduleName: 'Third Tier: Living Quarters & Science Labs',
    moduleType: 'living',
  };

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.4,
    roughness: 0.2,
  });

  const livingBodyGeo = new THREE.BoxGeometry(19.2, 4.2, 10.6);
  const livingBody = new THREE.Mesh(livingBodyGeo, shellMat);
  livingBody.position.set(0, 10.6, 0);
  livingBody.castShadow = true;
  livingBody.receiveShadow = true;
  livingBody.userData = { isStationPart: true, moduleType: 'living', originalMaterial: shellMat };
  livingGroup.add(livingBody);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.05,
    metalness: 0.9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.2,
  });
  const glassGeo = new THREE.BoxGeometry(19.3, 1.4, 10.7);
  const glassRibbon = new THREE.Mesh(glassGeo, glassMat);
  glassRibbon.position.set(0, 10.6, 0);
  glassRibbon.userData = { isStationPart: true, moduleType: 'living', originalMaterial: glassMat };
  livingGroup.add(glassRibbon);

  const helipadGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.3, 32);
  const helipadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const helipad = new THREE.Mesh(helipadGeo, helipadMat);
  helipad.position.set(4, 12.8, 0);
  helipad.userData = { isStationPart: true, moduleType: 'living', originalMaterial: helipadMat };
  livingGroup.add(helipad);

  const hBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 3.2), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  hBar1.position.set(3.2, 13.0, 0);
  const hBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 3.2), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  hBar2.position.set(4.8, 13.0, 0);
  const hCross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  hCross.position.set(4, 13.0, 0);
  livingGroup.add(hBar1, hBar2, hCross);

  const radomeGeo = new THREE.SphereGeometry(2.2, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.7);
  const radomeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
  const radome = new THREE.Mesh(radomeGeo, radomeMat);
  radome.position.set(-5.5, 12.8, 0);
  radome.castShadow = true;
  radome.userData = { isStationPart: true, moduleType: 'living', originalMaterial: radomeMat };
  livingGroup.add(radome);

  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x1e40af,
    emissiveIntensity: 0.25,
  });
  const solarWingGeo = new THREE.BoxGeometry(6, 0.2, 3);
  const solarLeft = new THREE.Mesh(solarWingGeo, solarMat);
  solarLeft.position.set(-13, 8.5, 0);
  solarLeft.rotation.z = Math.PI * 0.12;
  solarLeft.userData = { isStationPart: true, moduleType: 'energy', originalMaterial: solarMat };
  livingGroup.add(solarLeft);

  const solarRight = new THREE.Mesh(solarWingGeo, solarMat);
  solarRight.position.set(13, 8.5, 0);
  solarRight.rotation.z = -Math.PI * 0.12;
  solarRight.userData = { isStationPart: true, moduleType: 'energy', originalMaterial: solarMat };
  livingGroup.add(solarRight);

  const livingHighlightGeo = new THREE.BoxGeometry(19.6, 4.6, 11.0);
  const livingHighlight = new THREE.Mesh(livingHighlightGeo, highlightMat);
  livingHighlight.position.set(0, 10.6, 0);
  livingHighlight.userData = { highlightMesh: true };
  livingHighlight.visible = false;
  livingGroup.add(livingHighlight);

  scene.add(livingGroup);
  moduleMap.set('tier3-living', livingGroup);
}

function buildMaitriStation(
  scene: THREE.Scene,
  moduleMap: Map<string, THREE.Group>,
  twinModules: TwinModule[]
) {
  const containerMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.4,
    metalness: 0.4,
  });

  const highlightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });

  // 1. Main Habitat & Living Quarters ('living-block')
  const livingGroup = new THREE.Group();
  livingGroup.userData = {
    moduleId: 'living-block',
    moduleName: 'Main Habitat & Living Quarters',
    moduleType: 'living',
  };

  const mainHabGeo = new THREE.BoxGeometry(14, 3.8, 8);
  const mainHab = new THREE.Mesh(mainHabGeo, containerMat);
  mainHab.position.set(-2, 2.2, 0);
  mainHab.castShadow = true;
  mainHab.receiveShadow = true;
  mainHab.userData = { isStationPart: true, moduleType: 'living', originalMaterial: containerMat };
  livingGroup.add(mainHab);

  const roofGeo = new THREE.ConeGeometry(8, 2, 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.5 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.3, 1, 0.8);
  roof.position.set(-2, 4.8, 0);
  roof.userData = { isStationPart: true, moduleType: 'living', originalMaterial: roofMat };
  livingGroup.add(roof);

  const livingHighlight = new THREE.Mesh(new THREE.BoxGeometry(14.5, 4.2, 8.5), highlightMat);
  livingHighlight.position.set(-2, 2.2, 0);
  livingHighlight.userData = { highlightMesh: true };
  livingHighlight.visible = false;
  livingGroup.add(livingHighlight);

  scene.add(livingGroup);
  moduleMap.set('living-block', livingGroup);

  // 2. Thermal & Power Generation Plant ('generator-hub')
  const genGroup = new THREE.Group();
  genGroup.userData = {
    moduleId: 'generator-hub',
    moduleName: 'Thermal & Power Generation Plant',
    moduleType: 'energy',
  };

  const genMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
  const genBody = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 6), genMat);
  genBody.position.set(10, 2.0, -1);
  genBody.castShadow = true;
  genBody.userData = { isStationPart: true, moduleType: 'energy', originalMaterial: genMat };
  genGroup.add(genBody);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3.5, 12), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9 }));
  stack.position.set(12, 4.5, -1);
  genGroup.add(stack);

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
  for (let t = 0; t < 2; t++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.5, 16), tankMat);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(10, 1.3, 4 + t * 2.8);
    tank.castShadow = true;
    genGroup.add(tank);
  }

  const genHighlight = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.8, 6.4), highlightMat);
  genHighlight.position.set(10, 2.0, -1);
  genHighlight.userData = { highlightMesh: true };
  genHighlight.visible = false;
  genGroup.add(genHighlight);

  scene.add(genGroup);
  moduleMap.set('generator-hub', genGroup);

  // 3. Atmospheric & Geomagnetic Laboratory ('science-lab')
  const sciGroup = new THREE.Group();
  sciGroup.userData = {
    moduleId: 'science-lab',
    moduleName: 'Atmospheric & Geomagnetic Laboratory',
    moduleType: 'science',
  };

  const sciMat = new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.3, roughness: 0.4 });
  const sciBody = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 5), sciMat);
  sciBody.position.set(-13, 1.8, -4);
  sciBody.castShadow = true;
  sciBody.userData = { isStationPart: true, moduleType: 'science', originalMaterial: sciMat };
  sciGroup.add(sciBody);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 6, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  mast.position.set(-14, 5.5, -4);
  sciGroup.add(mast);

  const sciHighlight = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.6, 5.4), highlightMat);
  sciHighlight.position.set(-13, 1.8, -4);
  sciHighlight.userData = { highlightMesh: true };
  sciHighlight.visible = false;
  sciGroup.add(sciHighlight);

  scene.add(sciGroup);
  moduleMap.set('science-lab', sciGroup);

  // 4. Lake Priyadarshini Water Intake & Uplink ('fuel-lake-comms')
  const commsGroup = new THREE.Group();
  commsGroup.userData = {
    moduleId: 'fuel-lake-comms',
    moduleName: 'Lake Priyadarshini Water Intake & Uplink',
    moduleType: 'logistics',
  };

  // Radome pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 2.5, 16), new THREE.MeshStandardMaterial({ color: 0x475569 }));
  ped.position.set(-12, 1.5, 6);
  commsGroup.add(ped);

  const radome = new THREE.Mesh(new THREE.SphereGeometry(2.0, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
  radome.position.set(-12, 4.2, 6);
  radome.castShadow = true;
  radome.userData = { isStationPart: true, moduleType: 'logistics', originalMaterial: radome.material };
  commsGroup.add(radome);

  // Heated pipeline leading toward Lake Priyadarshini
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 }));
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(2, 0.4, -14);
  commsGroup.add(pipe);

  const commsHighlight = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 12), highlightMat);
  commsHighlight.position.set(-12, 4.2, 6);
  commsHighlight.userData = { highlightMesh: true };
  commsHighlight.visible = false;
  commsGroup.add(commsHighlight);

  scene.add(commsGroup);
  moduleMap.set('fuel-lake-comms', commsGroup);
}
