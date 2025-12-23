import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { createNoise3D } from 'simplex-noise';
import TWEEN from '@tweenjs/tween.js';

// --- Constants & Config ---
const CONFIG = {
  sunSize: 15,
  bgTopColor: 0x00000a,
  bgBottomColor: 0x050010,
  orbitColor: 0x00aaff,
  ambientLight: 0x151020,
  bloomStrength: 1.8, // Increased bloom for better glow effect
  bloomRadius: 1.0,
  bloomThreshold: 0.1, // Low threshold ensures planets glow
  speedFactor: 0.3,
};

const PLANETS = [
  { name: "Mercury", size: 1.5, dist: 35, speed: -0.04, color: "#b0a090", type: "Terrestrial" },
  { name: "Venus", size: 3.5, dist: 50, speed: -0.015, color: "#e3bb76", type: "Terrestrial" },
  { name: "Earth", size: 3.8, dist: 70, speed: -0.01, color: "#2277ff", type: "Terrestrial" },
  { name: "Mars", size: 2.0, dist: 90, speed: -0.008, color: "#c1440e", type: "Terrestrial" },
  { name: "Jupiter", size: 9.0, dist: 130, speed: -0.004, color: "#dcb288", type: "Gas Giant" },
  { name: "Saturn", size: 7.5, dist: 170, speed: -0.003, color: "#eebb88", type: "Gas Giant", ring: true },
  { name: "Uranus", size: 5.0, dist: 210, speed: -0.002, color: "#aaddff", type: "Ice Giant" },
  { name: "Neptune", size: 4.8, dist: 245, speed: -0.001, color: "#3355ff", type: "Ice Giant" }
];

// --- Shaders ---
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;

  float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
  float noise(vec2 st) {
      vec2 i = floor(st); vec2 f = fract(st);
      float a = random(i); float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
      vec2 uv = vUv * 3.0; 
      float n = noise(uv + time * 0.3); 
      n += noise(uv * 2.0 - time * 0.4) * 0.5;
      
      vec3 colorCore = vec3(1.0, 1.0, 0.9);
      vec3 colorMid = vec3(1.0, 0.5, 0.0);
      vec3 colorEdge = vec3(0.9, 0.05, 0.0);
      
      float intensity = n * 0.5 + 0.5;
      vec3 finalColor = mix(colorEdge, colorMid, intensity);
      finalColor = mix(finalColor, colorCore, pow(intensity, 2.5));
      
      float fresnel = pow(1.0 - dot(vNormal, vec3(0,0,1)), 2.5);
      finalColor += vec3(1.0, 0.3, 0.0) * fresnel * 2.0;
      
      gl_FragColor = vec4(finalColor, 1.0);
  }
`;

interface SolarSystemProps {
  systemState: 'normal' | 'merged';
}

export const SolarSystem: React.FC<SolarSystemProps> = ({ systemState }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const systemStateRef = useRef(systemState); // Ref for loop access

  // Update ref when prop changes
  useEffect(() => {
    systemStateRef.current = systemState;
  }, [systemState]);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Init Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.bgTopColor);
    scene.fog = new THREE.FogExp2(CONFIG.bgBottomColor, 0.001);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 400, 800);

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Slightly reduced to prevent washout with bloom
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 2000;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(CONFIG.ambientLight, 0.5);
    scene.add(ambientLight);
    const sunLight = new THREE.PointLight(0xffaa55, 4.0, 1200);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const solarSystemGroup = new THREE.Group();
    scene.add(solarSystemGroup);

    // --- Helpers for Procedural Textures ---
    const noise3D = createNoise3D();

    const createPlanetTexture = (name: string, colorHex: string) => {
      const size = 512; 
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if(!ctx) return new THREE.Texture();

      ctx.fillStyle = colorHex; ctx.fillRect(0, 0, size, size);
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      
      // Simple procedural generation mapping
      for (let y = 0; y < size; y++) {
          const ny = y / size;
          for (let x = 0; x < size; x++) {
              const nx = x / size;
              const i = (y * size + x) * 4;
              let noiseVal = 0;

              // Simplified noise logic from original for performance in React env
              noiseVal = noise3D(nx * 3, ny * 3, 0);

              if (name === 'Jupiter') {
                  const turbulence = noise3D(nx * 10, ny * 10, 0) * 0.05;
                  noiseVal = noise3D(nx * 3, ny * 20 + turbulence, 0); 
                  if (noiseVal > 0.3) { data[i]=210; data[i+1]=180; data[i+2]=140; } 
                  else if (noiseVal < -0.2) { data[i]=160; data[i+1]=100; data[i+2]=60; } 
                  else { data[i]=190; data[i+1]=150; data[i+2]=110; } 
              } else if (name === 'Earth') {
                  // Land vs Water
                   if (noiseVal > 0.15) { 
                      data[i]=40; data[i+1]=140; data[i+2]=60; // Green
                   } else { 
                      data[i]=10; data[i+1]=40; data[i+2]=120; // Blue
                   }
                   // Clouds
                   const cloudNoise = noise3D(nx * 6, ny * 6, 10);
                   if (cloudNoise > 0.5) { data[i]=255; data[i+1]=255; data[i+2]=255; }
              } else {
                   // Generic texture variation
                   const varC = noiseVal * 20;
                   data[i] = Math.max(0, Math.min(255, data[i] + varC));
                   data[i+1] = Math.max(0, Math.min(255, data[i+1] + varC));
                   data[i+2] = Math.max(0, Math.min(255, data[i+2] + varC));
              }
          }
      }
      ctx.putImageData(imgData, 0, 0);
      return new THREE.CanvasTexture(canvas);
    };

    const createGlowTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if(!ctx) return new THREE.Texture();
        const grad = ctx.createRadialGradient(32,32,0, 32,32,32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.2, 'rgba(255, 220, 100, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,64,64);
        return new THREE.CanvasTexture(canvas);
    };

    const createRingTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 2; 
        const ctx = canvas.getContext('2d');
        if(!ctx) return new THREE.Texture();
        const grad = ctx.createLinearGradient(0,0,256,0);
        grad.addColorStop(0.0, 'rgba(0,0,0,0)'); 
        grad.addColorStop(0.2, 'rgba(200,180,150,0.8)'); 
        grad.addColorStop(0.8, 'rgba(180,170,140,0.5)'); 
        grad.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0,0,256,2);
        return new THREE.CanvasTexture(canvas);
    };

    // --- Create Sun ---
    const sunGeometry = new THREE.SphereGeometry(CONFIG.sunSize, 64, 64);
    const sunUniforms = { time: { value: 0 } };
    const sunMaterial = new THREE.ShaderMaterial({
        uniforms: sunUniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.FrontSide
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    solarSystemGroup.add(sun);

    const sunSpriteMat = new THREE.SpriteMaterial({
        map: createGlowTexture(), color: 0xffaa00, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
    });
    const sunSprite = new THREE.Sprite(sunSpriteMat);
    sunSprite.scale.set(CONFIG.sunSize * 5.0, CONFIG.sunSize * 5.0, 1);
    sun.add(sunSprite);

    // --- Create Planets ---
    const planetGroups: THREE.Group[] = [];
    const orbitMeshes: THREE.Mesh[] = [];

    PLANETS.forEach(p => {
        const group = new THREE.Group();
        const orbitRadius = p.dist;

        // Orbit path visual
        const orbitGeo = new THREE.RingGeometry(orbitRadius - 0.2, orbitRadius + 0.2, 128);
        const orbitMat = new THREE.MeshBasicMaterial({
            color: CONFIG.orbitColor, transparent: true, opacity: 0.2, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
        });
        const orbit = new THREE.Mesh(orbitGeo, orbitMat);
        orbit.rotation.x = Math.PI / 2;
        scene.add(orbit);
        orbitMeshes.push(orbit);

        // Planet Mesh
        const geometry = new THREE.SphereGeometry(p.size, 64, 64);
        const texture = createPlanetTexture(p.name, p.color);
        
        // Emissive Material for Glow
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.6,
            metalness: 0.2,
            color: new THREE.Color(p.color),
            emissive: new THREE.Color(p.color), // Base Glow color
            emissiveMap: texture, // Texture adds detail to the glow
            emissiveIntensity: 0.6 // Brightness of the glow
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true; 
        mesh.receiveShadow = true;
        group.add(mesh);

        // Ring
        if (p.ring) {
            const ringGeo = new THREE.RingGeometry(p.size * 1.4, p.size * 2.5, 64);
            const ringMat = new THREE.MeshStandardMaterial({
                map: createRingTexture(), 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.8, 
                side: THREE.DoubleSide,
                emissive: 0xaa8855,
                emissiveIntensity: 0.3
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        const angle = Math.random() * Math.PI * 2;
        // Initial Position
        group.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
        
        // Store data for animation
        group.userData = { 
          angle: angle, 
          dist: orbitRadius, 
          speed: p.speed * CONFIG.speedFactor,
          name: p.name,
          originalScale: 1,
          mesh: mesh
        };
        
        solarSystemGroup.add(group);
        planetGroups.push(group);
    });

    // --- Stars Background ---
    const starsGeo = new THREE.BufferGeometry();
    const starsPos = [];
    for(let i=0; i<4000; i++) {
        starsPos.push((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, (Math.random()-0.5)*4000);
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
    const starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8});
    scene.add(new THREE.Points(starsGeo, starsMat));


    // --- Post Processing ---
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), CONFIG.bloomStrength, CONFIG.bloomRadius, CONFIG.bloomThreshold);
    composer.addPass(bloomPass);

    // --- Resize Handle ---
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation Loop ---
    const animate = () => {
      requestAnimationFrame(animate);

      const time = performance.now() * 0.001;
      sunUniforms.time.value = time;
      sun.rotation.y += 0.002;
      TWEEN.update();
      controls.update();

      const isMerged = systemStateRef.current === 'merged';

      // Sun Logic
      const targetSunScale = isMerged ? 0.001 : 1; 
      sun.scale.lerp(new THREE.Vector3(targetSunScale, targetSunScale, targetSunScale), 0.05);
      sunSprite.visible = !isMerged;

      // Planets Logic
      planetGroups.forEach((group) => {
          const { speed, dist, name, mesh } = group.userData;

          if (isMerged) {
              // Merged State
              if (name === "Earth") {
                  // Earth becomes the center
                  const targetPos = new THREE.Vector3(0, 0, 0);
                  group.position.lerp(targetPos, 0.05);
                  
                  // Scale up Earth
                  const targetScale = 6.0; // Big Earth
                  group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);

                  // Rotate Earth faster when merged
                  mesh.rotation.y += 0.02;
              } else {
                  // Others suck into the center
                  const targetPos = new THREE.Vector3(0, 0, 0);
                  group.position.lerp(targetPos, 0.1); // Move fast to center
                  
                  // Shrink to nothing
                  group.scale.lerp(new THREE.Vector3(0.001, 0.001, 0.001), 0.1);
              }
          } else {
              // Normal Orbit State
              
              // Restore scale
              group.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);

              // Calculate Orbit Position
              group.userData.angle += speed;
              const targetX = Math.cos(group.userData.angle) * dist;
              const targetZ = Math.sin(group.userData.angle) * dist;
              
              const targetPos = new THREE.Vector3(targetX, 0, targetZ);
              group.position.lerp(targetPos, 0.05);

              // Normal rotation
              mesh.rotation.y += 0.005;
          }
      });

      // Hide Orbits when merged
      orbitMeshes.forEach(o => {
          const targetOpacity = isMerged ? 0 : 0.2;
          // @ts-ignore - Material opacity exists
          o.material.opacity = THREE.MathUtils.lerp(o.material.opacity, targetOpacity, 0.05);
      });

      composer.render();
    };

    animate();

    return () => {
        window.removeEventListener('resize', handleResize);
        mountRef.current?.removeChild(renderer.domElement);
        renderer.dispose();
    };
  }, []); // Run once on mount

  return <div ref={mountRef} className="w-full h-full" />;
};
