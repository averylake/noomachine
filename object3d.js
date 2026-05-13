import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const stage = document.querySelector("#object-stage");

if (stage) {
  try {
    buildBreathClock(stage);
  } catch (error) {
    stage.classList.add("no-webgl");
    console.warn("Breath clock 3D fallback active", error);
  }
}

function buildBreathClock(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 12.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.prepend(renderer.domElement);

  /* Mark stage as WebGL-ready so the CSS fallback hides */
  container.classList.add("webgl-ready");

  /* --- Post-processing (bloom glow) --- */
  /* Use an alpha-enabled render target so the canvas stays transparent
     and blends with the page background rather than showing as a solid dark box */
  const renderTarget = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    stencilBuffer: false
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(512, 512),
    0.7, 0.35, 0.85
  );
  composer.addPass(bloomPass);

  /* --- Orbit controls (mouse drag + touch rotate) --- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 18;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;

  /* --- Main group --- */
  const group = new THREE.Group();
  scene.add(group);

  /* --- Materials --- */
  const outerMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9c67c,
    metalness: 0.7,
    roughness: 0.25,
    emissive: 0x2c2410,
    emissiveIntensity: 0.5
  });
  const innerMaterial = new THREE.MeshStandardMaterial({
    color: 0xedf7ef,
    metalness: 0.32,
    roughness: 0.2,
    emissive: 0x111a16,
    emissiveIntensity: 0.34,
    transparent: true,
    opacity: 0.4
  });
  const signalMaterial = new THREE.MeshStandardMaterial({
    color: 0x79f2d0,
    metalness: 0.6,
    roughness: 0.15,
    emissive: 0x0f4b3f,
    emissiveIntensity: 1.2
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0f0d,
    metalness: 0.5,
    roughness: 0.4,
    emissive: 0x020504,
    emissiveIntensity: 0.3
  });
  const rodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8ea39b,
    metalness: 0.42,
    roughness: 0.38,
    transparent: true,
    opacity: 0.5
  });
  const haloBaseMaterial = new THREE.MeshBasicMaterial({
    color: 0x79f2d0,
    transparent: true,
    opacity: 0.1
  });

  /* --- Outer ring --- */
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.04, 24, 200),
    outerMaterial
  );
  group.add(outerRing);

  /* --- Inner ring (translucent) --- */
  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.025, 18, 140),
    innerMaterial
  );
  group.add(innerRing);

  /* --- Halo rings (gyroscope cage) --- */
  const halo1 = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.006, 12, 200),
    haloBaseMaterial
  );
  group.add(halo1);

  const halo2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.006, 12, 200),
    haloBaseMaterial.clone()
  );
  halo2.rotation.x = Math.PI / 2;
  group.add(halo2);

  const halo3 = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.006, 12, 200),
    haloBaseMaterial.clone()
  );
  halo3.rotation.x = Math.PI / 4;
  halo3.rotation.y = Math.PI / 4;
  group.add(halo3);

  /* --- 8 Phase nodes on outer ring --- */
  const nodeGroup = new THREE.Group();
  group.add(nodeGroup);

  const nodes = [];
  const nodeRadius = 2.8;
  const nodeGeometry = new THREE.SphereGeometry(0.12, 32, 16);
  const rimGeometry = new THREE.TorusGeometry(0.13, 0.01, 10, 32);

  for (let i = 0; i < 8; i += 1) {
    const angle = Math.PI / 2 - (i * Math.PI * 2) / 8;
    const x = Math.cos(angle) * nodeRadius;
    const y = Math.sin(angle) * nodeRadius;

    const node = new THREE.Mesh(nodeGeometry, darkMaterial.clone());
    node.position.set(x, y, 0.02);
    nodeGroup.add(node);
    nodes.push(node);

    const rim = new THREE.Mesh(
      rimGeometry,
      i % 2 === 0 ? signalMaterial.clone() : innerMaterial.clone()
    );
    rim.position.copy(node.position);
    nodeGroup.add(rim);

    const rod = cylinderBetween(
      new THREE.Vector3(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, -0.03),
      new THREE.Vector3(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, -0.03),
      0.008,
      rodMaterial
    );
    nodeGroup.add(rod);
  }

  /* --- Orbiting pilgrim (signal sphere + Luftpause tail) --- */
  const activePivot = new THREE.Group();
  const activeBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 40, 20),
    signalMaterial.clone()
  );
  activeBall.position.set(0, nodeRadius, 0.2);
  activePivot.add(activeBall);

  /* Luftpause tail (golden comma stroke) */
  const luftpauseCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.03, nodeRadius - 0.08, 0.19),
    new THREE.Vector3(0.12, nodeRadius - 0.24, 0.16),
    new THREE.Vector3(0.16, nodeRadius - 0.44, 0.13),
    new THREE.Vector3(0.06, nodeRadius - 0.62, 0.1)
  );
  const luftpauseTube = new THREE.TubeGeometry(luftpauseCurve, 28, 0.026, 8, false);
  const luftpauseTail = new THREE.Mesh(luftpauseTube, outerMaterial.clone());
  activePivot.add(luftpauseTail);

  const tailTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 16, 8),
    outerMaterial.clone()
  );
  tailTip.position.set(0.06, nodeRadius - 0.62, 0.1);
  activePivot.add(tailTip);

  group.add(activePivot);

  /* --- Center source sphere --- */
  const sourceMat = new THREE.MeshStandardMaterial({
    color: 0xedf7ef,
    metalness: 0.2,
    roughness: 0.15,
    emissive: 0x79f2d0,
    emissiveIntensity: 0.5
  });
  const source = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 48, 24),
    sourceMat
  );
  source.position.set(0, 0, 0.22);
  group.add(source);

  /* --- Particle field --- */
  const particleCount = 400;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const particleVelocities = [];

  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2.5 + Math.random() * 5;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    particleVelocities.push({
      x: (Math.random() - 0.5) * 0.0015,
      y: (Math.random() - 0.5) * 0.0015,
      z: (Math.random() - 0.5) * 0.0015
    });
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0x79f2d0,
    size: 0.025,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  /* --- Lights --- */
  scene.add(new THREE.AmbientLight(0xedf7ef, 0.4));
  const keyLight = new THREE.DirectionalLight(0xd9c67c, 2.2);
  keyLight.position.set(2, 4, 5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0x79f2d0, 8, 18);
  rimLight.position.set(-3, -2.5, 4);
  scene.add(rimLight);
  const backLight = new THREE.PointLight(0xd9c67c, 3, 14);
  backLight.position.set(2, -3, -5);
  scene.add(backLight);

  /* --- Phase state --- */
  const state = {
    phase: "arrival",
    orbit: 0,
    speed: 0.34,
    targetSpeed: 0.34,
    targetScale: 1,
    breathPulse: 0.16,
    targetBreathPulse: 0.16,
    targetBloom: 0.7,
    targetParticleOpacity: 0.35,
    nodeGlowIntensity: 0.3,
    targetNodeGlow: 0.3,
    clock: new THREE.Clock()
  };

  const phaseConfig = {
    arrival:   { speed: 0.30, scale: 1.0,  pulse: 0.16, bloom: 0.7,  particles: 0.35, glow: 0.3 },
    catechism: { speed: 0.22, scale: 1.02, pulse: 0.12, bloom: 0.8,  particles: 0.4,  glow: 0.4 },
    receive:   { speed: 0.42, scale: 1.1,  pulse: 0.28, bloom: 1.1,  particles: 0.6,  glow: 0.8 },
    hold:      { speed: 0.0,  scale: 1.12, pulse: 0.05, bloom: 1.4,  particles: 0.18, glow: 1.2 },
    discern:   { speed: 0.16, scale: 1.08, pulse: 0.12, bloom: 0.9,  particles: 0.45, glow: 0.6 },
    return:    { speed: 0.52, scale: 0.96, pulse: 0.22, bloom: 0.5,  particles: 0.7,  glow: 0.4 },
    release:   { speed: 0.0,  scale: 0.9,  pulse: 0.02, bloom: 0.3,  particles: 0.12, glow: 0.1 },
    ready:     { speed: 0.26, scale: 1.0,  pulse: 0.14, bloom: 0.7,  particles: 0.35, glow: 0.3 },
    proof:     { speed: 0.7,  scale: 1.04, pulse: 0.2,  bloom: 1.0,  particles: 0.55, glow: 0.7 }
  };

  window.addEventListener("breath-phase", (event) => {
    const phase = event.detail?.phase || "arrival";
    state.phase = phase;
    const cfg = phaseConfig[phase] || phaseConfig.arrival;
    state.targetSpeed = cfg.speed;
    state.targetScale = cfg.scale;
    state.targetBreathPulse = cfg.pulse;
    state.targetBloom = cfg.bloom;
    state.targetParticleOpacity = cfg.particles;
    state.targetNodeGlow = cfg.glow;
  });

  function resize() {
    const rect = container.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    renderer.setSize(size, size, false);
    composer.setSize(size, size);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function animate() {
    const delta = Math.min(state.clock.getDelta(), 0.05);
    const t = performance.now() * 0.001;
    const lerp = 0.035;

    /* Smooth transitions */
    state.speed += (state.targetSpeed - state.speed) * lerp;
    state.breathPulse += (state.targetBreathPulse - state.breathPulse) * lerp;
    state.nodeGlowIntensity += (state.targetNodeGlow - state.nodeGlowIntensity) * lerp;
    bloomPass.strength += (state.targetBloom - bloomPass.strength) * lerp;
    particleMat.opacity += (state.targetParticleOpacity - particleMat.opacity) * lerp;

    /* Scale */
    group.scale.lerp(
      new THREE.Vector3(state.targetScale, state.targetScale, state.targetScale),
      0.045
    );

    /* 3D rotation (deeper than original flat version) */
    group.rotation.y = Math.sin(t * 0.15) * 0.22;
    group.rotation.x = Math.sin(t * 0.12) * 0.14;

    /* Node ring subtle counter-rotation */
    nodeGroup.rotation.z = t * 0.018;

    /* Halo gyroscope rotations */
    halo1.rotation.z = -t * 0.05;
    halo2.rotation.y = t * 0.035;
    halo3.rotation.z = t * 0.042;

    /* Orbit the pilgrim */
    state.orbit -= delta * state.speed;
    activePivot.rotation.z = state.orbit;

    /* Pilgrim breathing pulse */
    const pulseScale = 1 + Math.sin(t * 3) * state.breathPulse;
    activeBall.scale.setScalar(pulseScale);

    /* Source sphere pulse (inverse rhythm) */
    source.scale.setScalar(1 + Math.sin(t * 2 + 1) * state.breathPulse * 0.6);
    sourceMat.emissiveIntensity = 0.4 + Math.sin(t * 2) * 0.3 * state.breathPulse;

    /* Node glow animation */
    nodes.forEach((node, i) => {
      const phase = t * 1.5 + i * 0.8;
      node.material.emissiveIntensity = 0.2 + Math.sin(phase) * 0.3 * state.nodeGlowIntensity;
    });

    /* Particle drift */
    const posArr = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      posArr[i * 3] += particleVelocities[i].x + Math.sin(t + i) * 0.0002;
      posArr[i * 3 + 1] += particleVelocities[i].y + Math.cos(t + i * 0.7) * 0.0002;
      posArr[i * 3 + 2] += particleVelocities[i].z;

      /* Contain within sphere */
      const dx = posArr[i * 3], dy = posArr[i * 3 + 1], dz = posArr[i * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 8) {
        const scale = 2.5 / dist;
        posArr[i * 3] *= scale;
        posArr[i * 3 + 1] *= scale;
        posArr[i * 3 + 2] *= scale;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;

    /* Rim light breathing */
    rimLight.intensity = 6 + Math.sin(t * 2) * 3 * state.breathPulse;

    /* Update orbit controls (damping + autoRotate) */
    controls.update();

    /* Render with bloom */
    composer.render();
    requestAnimationFrame(animate);
  }

  animate();
}

function cylinderBetween(start, end, radius, material) {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}
