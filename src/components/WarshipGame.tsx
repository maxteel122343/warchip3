/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import * as TWEEN from '@tweenjs/tween.js';
import { Player, ShipClass, GameItem, ItemType, FishingItem, ItemEffect, CannonballType, CameraMode, WeatherType } from '../data/gameData';

interface WarshipGameProps {
  player: Player | null;
  getStats: (p: Player) => any;
  items: GameItem[];
  onKill: () => void;
  onCollectItem: (id: string) => void;
  onDeath: () => void;
  isMatchOver: boolean;
  isFishing: boolean;
  onStartFishing: () => void;
  onUseItem: () => FishingItem | null;
  power: number;
  angle: number;
  onUpdatePower: (val: number | ((prev: number) => number)) => void;
  onUpdateAngle: (val: number) => void;
  isDead: boolean;
  timeLeft: number;
  botsEnabled: boolean;
  isMuted: boolean;
  previewMode?: boolean;
  onSetCameraMode: (mode: CameraMode) => void;
  weather: WeatherType;
  leaderboard: Player[];
}

const WarshipGame: React.FC<WarshipGameProps> = ({
  player,
  getStats,
  items,
  onKill,
  onCollectItem,
  onDeath,
  isMatchOver,
  isFishing,
  onStartFishing,
  onUseItem,
  power,
  angle,
  onUpdatePower,
  onUpdateAngle,
  isDead,
  timeLeft,
  botsEnabled,
  isMuted,
  previewMode = false,
  onSetCameraMode,
  weather,
  leaderboard
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const shipRef = useRef<THREE.Group | null>(null);
  const enemiesRef = useRef<THREE.Group[]>([]);
  const itemsRef = useRef<{ [key: string]: THREE.Group }>({});
  const bulletsRef = useRef<THREE.Mesh[]>([]);
  const thrownItemsRef = useRef<THREE.Group[]>([]);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const stormRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Group[]>([]);
  const rainParticlesRef = useRef<THREE.Points | null>(null);
  const lightningRef = useRef<THREE.PointLight | null>(null);
  const icebergsRef = useRef<THREE.Group[]>([]);
  const waterRef = useRef<Water | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const keys = useRef<{ [key: string]: boolean }>({});
  
  // Physics state
  const velocity = useRef(new THREE.Vector3());
  const rotationVelocity = useRef(0);
  const screenShake = useRef(0);

  // Procedural Ship Generator
  const createProceduralShip = (seed: number, size: number = 1) => {
    const group = new THREE.Group();
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Random Palette
    const palettes = [
      { wood: 0x5d4037, accent: 0x212121, sail: 0xffffff }, // Classic
      { wood: 0x3e2723, accent: 0xbf360c, sail: 0x212121 }, // Pirate
      { wood: 0x4e342e, accent: 0x1565c0, sail: 0xe0e0e0 }, // Royal
      { wood: 0x212121, accent: 0x455a64, sail: 0x37474f }, // Ghost
    ];
    const palette = palettes[Math.floor(rng() * palettes.length)];

    // 1. Hull
    const hullType = Math.floor(rng() * 3); // 0: Wide, 1: Long, 2: Compact
    let hullWidth, hullHeight, hullDepth;
    if (hullType === 0) { hullWidth = 4 * size; hullHeight = 1.5 * size; hullDepth = 6 * size; }
    else if (hullType === 1) { hullWidth = 2 * size; hullHeight = 1.2 * size; hullDepth = 9 * size; }
    else { hullWidth = 3 * size; hullHeight = 1.8 * size; hullDepth = 5 * size; }

    const hullGeo = new THREE.BoxGeometry(hullWidth, hullHeight, hullDepth);
    const hullMat = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.8 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = hullHeight / 2;
    group.add(hull);

    // Add "Burning" state to userData
    group.userData.isBurning = false;
    group.userData.burnParticles = [];

    // 2. Deck details (Barrels, Crates)
    const detailCount = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < detailCount; i++) {
      const isBarrel = rng() > 0.5;
      const detailGeo = isBarrel ? new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8) : new THREE.BoxGeometry(0.6, 0.6, 0.6);
      const detailMat = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.9 });
      const detail = new THREE.Mesh(detailGeo, detailMat);
      detail.position.set(
        (rng() - 0.5) * hullWidth * 0.7,
        hullHeight / 2 + (isBarrel ? 0.4 : 0.3),
        (rng() - 0.5) * hullDepth * 0.7
      );
      group.add(detail);
    }

    // 3. Masts & Sails
    const mastCount = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < mastCount; i++) {
      const mastHeight = 4 + rng() * 4;
      const mastGeo = new THREE.CylinderGeometry(0.15, 0.2, mastHeight, 8);
      const mast = new THREE.Mesh(mastGeo, hullMat);
      const zPos = (i - (mastCount - 1) / 2) * (hullDepth * 0.3);
      mast.position.set(0, hullHeight / 2 + mastHeight / 2, zPos);
      group.add(mast);

      // Sails
      const sailType = Math.floor(rng() * 3);
      const sailWidth = 3 + rng() * 2;
      const sailHeight = 2 + rng() * 2;
      const sailGeo = new THREE.PlaneGeometry(sailWidth, sailHeight, 4, 4);
      
      // Curvature
      const pos = sailGeo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j);
        pos.setZ(j, Math.sin((x / sailWidth) * Math.PI) * 0.5);
      }
      
      const sailMat = new THREE.MeshStandardMaterial({ 
        color: palette.sail, 
        side: THREE.DoubleSide,
      });
      
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.position.set(0, mast.position.y + 1, zPos + 0.2);
      group.add(sail);

      // Crow's nest
      const nestGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.4, 8, 1, true);
      const nest = new THREE.Mesh(nestGeo, hullMat);
      nest.position.set(0, mast.position.y + mastHeight / 2 - 0.5, zPos);
      group.add(nest);
    }

    // 4. Cannons
    const cannonType = Math.floor(rng() * 2); // 0: Single, 1: Double
    const cannonCount = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < cannonCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const zPos = (Math.floor(i / 2) - 1) * 1.5;
      
      const createCannon = (offset: number) => {
        const cannonGeo = new THREE.CylinderGeometry(0.2, 0.25, 1, 8);
        const cannonMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 });
        const cannon = new THREE.Mesh(cannonGeo, cannonMat);
        cannon.rotation.z = Math.PI / 2 * side;
        cannon.position.set(
          (hullWidth / 2) * side,
          hullHeight / 4 + offset,
          zPos
        );
        group.add(cannon);
      };

      createCannon(0);
      if (cannonType === 1) createCannon(0.4);
    }

    // 5. Flags, Lanterns & Ropes
    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5);
    const flagMat = new THREE.MeshStandardMaterial({ color: palette.accent, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, 8, -hullDepth / 2);
    group.add(flag);

    // Lanterns
    const lanternCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < lanternCount; i++) {
      const lanternGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
      const lanternMat = new THREE.MeshStandardMaterial({ 
        color: 0xffaa00, 
        emissive: 0xffaa00, 
        emissiveIntensity: 2 
      });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(
        (rng() - 0.5) * hullWidth * 0.8,
        hullHeight / 2 + 1,
        (rng() - 0.5) * hullDepth * 0.8
      );
      group.add(lantern);
      
      // Add a small light point for lanterns
      const pLight = new THREE.PointLight(0xffaa00, 0, 10);
      pLight.position.copy(lantern.position);
      group.add(pLight);
      if (!group.userData.lanternLights) group.userData.lanternLights = [];
      group.userData.lanternLights.push(pLight);
    }

    // Ropes (Simple Lines)
    const ropeMat = new THREE.LineBasicMaterial({ color: 0x3e2723 });
    for (let i = 0; i < mastCount; i++) {
      const zPos = (i - (mastCount - 1) / 2) * (hullDepth * 0.3);
      const ropePoints = [
        new THREE.Vector3(-hullWidth/2, 0, zPos),
        new THREE.Vector3(0, 6, zPos),
        new THREE.Vector3(hullWidth/2, 0, zPos)
      ];
      const ropeGeo = new THREE.BufferGeometry().setFromPoints(ropePoints);
      const rope = new THREE.Line(ropeGeo, ropeMat);
      group.add(rope);
    }

    return group;
  };

  // Visual Effects Helpers
  const createParticle = (scene: THREE.Scene, type: 'explosion' | 'smoke' | 'fire' | 'splash' | 'debris', pos: THREE.Vector3, color: number, size: number = 1) => {
    const group = new THREE.Group();
    group.position.copy(pos);
    
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    if (type === 'explosion' || type === 'fire') {
      geometry = new THREE.IcosahedronGeometry(size, 0);
      material = new THREE.MeshStandardMaterial({ 
        color, 
        emissive: color, 
        emissiveIntensity: 2,
        transparent: true,
        opacity: 1
      });
    } else if (type === 'smoke') {
      geometry = new THREE.SphereGeometry(size, 8, 8);
      material = new THREE.MeshStandardMaterial({ 
        color: 0x888888, 
        transparent: true, 
        opacity: 0.6 
      });
    } else if (type === 'splash') {
      geometry = new THREE.TorusGeometry(size, 0.2, 8, 16);
      material = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
      group.rotation.x = Math.PI / 2;
    } else {
      // Debris
      geometry = new THREE.BoxGeometry(size, size, size);
      material = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
    }

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
    group.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 0.5
    );
    if (type === 'splash') group.userData.velocity.set(0, 0.1, 0);
    
    group.userData.life = 1.0;
    group.userData.decay = 0.02 + Math.random() * 0.03;
    group.userData.type = type;
    
    scene.add(group);
    particlesRef.current.push(group);
  };

  const triggerExplosion = (scene: THREE.Scene, pos: THREE.Vector3, scale: number = 1) => {
    // Fire burst
    for (let i = 0; i < 8; i++) {
      createParticle(scene, 'explosion', pos, 0xffaa00, 2 * scale);
    }
    // Smoke
    for (let i = 0; i < 5; i++) {
      createParticle(scene, 'smoke', pos, 0x888888, 3 * scale);
    }
    // Debris
    for (let i = 0; i < 10; i++) {
      createParticle(scene, 'debris', pos, 0x5d4037, 0.5 * scale);
    }
  };

  const triggerMuzzleFlash = (scene: THREE.Scene, pos: THREE.Vector3, dir: THREE.Vector3) => {
    const flashPos = pos.clone().add(dir.clone().multiplyScalar(2));
    createParticle(scene, 'fire', flashPos, 0xffff00, 1);
    for (let i = 0; i < 3; i++) {
      createParticle(scene, 'smoke', flashPos, 0x444444, 1.5);
    }
  };

  const triggerSplash = (scene: THREE.Scene, pos: THREE.Vector3) => {
    createParticle(scene, 'splash', new THREE.Vector3(pos.x, 0.1, pos.z), 0xffffff, 2);
    for (let i = 0; i < 5; i++) {
      createParticle(scene, 'smoke', pos, 0xffffff, 0.5);
    }
  };

  useEffect(() => {
    if (!botsEnabled && sceneRef.current && !previewMode) {
      enemiesRef.current.forEach(enemy => sceneRef.current?.remove(enemy));
      enemiesRef.current = [];
    }
  }, [botsEnabled, previewMode]);

  const playerRef = useRef(player);
  const isFishingRef = useRef(isFishing);
  const isDeadRef = useRef(isDead);
  const isMatchOverRef = useRef(isMatchOver);
  const botsEnabledRef = useRef(botsEnabled);
  const powerRef = useRef(power);
  const angleRef = useRef(angle);
  const weatherRef = useRef(weather);

  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { isFishingRef.current = isFishing; }, [isFishing]);
  useEffect(() => { isDeadRef.current = isDead; }, [isDead]);
  useEffect(() => { isMatchOverRef.current = isMatchOver; }, [isMatchOver]);
  useEffect(() => { botsEnabledRef.current = botsEnabled; }, [botsEnabled]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { angleRef.current = angle; }, [angle]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  // Weather Transition Effect
  useEffect(() => {
    if (!sceneRef.current || !skyRef.current || !waterRef.current || !ambientLightRef.current || !dirLightRef.current) return;

    const scene = sceneRef.current;
    const sky = skyRef.current;
    const water = waterRef.current;
    const ambientLight = ambientLightRef.current;
    const dirLight = dirLightRef.current;

    // Reset Fog
    scene.fog = null;

    // Remove old rain
    if (rainParticlesRef.current) {
      scene.remove(rainParticlesRef.current);
      rainParticlesRef.current = null;
    }

    // Remove old icebergs
    icebergsRef.current.forEach(ice => scene.remove(ice));
    icebergsRef.current = [];

    const sun = new THREE.Vector3();
    let phi = 85;
    let theta = 180;
    let ambientIntensity = 0.6;
    let dirIntensity = 1.5;
    let waterColor = 0x00aaff;
    let sunColor = 0xffffff;

    switch (weather) {
      case WeatherType.SUNNY:
        phi = 85;
        ambientIntensity = 0.6;
        dirIntensity = 1.5;
        waterColor = 0x00aaff;
        break;
      case WeatherType.NIGHT:
        phi = 185; // Sun below horizon
        ambientIntensity = 0.1;
        dirIntensity = 0.2;
        waterColor = 0x001133;
        sunColor = 0x4444ff;
        break;
      case WeatherType.RAIN:
      case WeatherType.STORM:
        phi = 95; // Overcast
        ambientIntensity = 0.3;
        dirIntensity = 0.5;
        waterColor = 0x223344;
        sunColor = 0x888888;
        scene.fog = new THREE.FogExp2(0x223344, 0.005);
        
        // Create Rain
        const rainGeo = new THREE.BufferGeometry();
        const rainCount = 5000;
        const rainPos = new Float32Array(rainCount * 3);
        for (let i = 0; i < rainCount; i++) {
          rainPos[i * 3] = (Math.random() - 0.5) * 2400;
          rainPos[i * 3 + 1] = Math.random() * 500;
          rainPos[i * 3 + 2] = (Math.random() - 0.5) * 2400;
        }
        rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
        const rainMat = new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.5, transparent: true, opacity: 0.6 });
        const rain = new THREE.Points(rainGeo, rainMat);
        scene.add(rain);
        rainParticlesRef.current = rain;
        break;
      case WeatherType.FOG:
        phi = 85;
        ambientIntensity = 0.4;
        dirIntensity = 0.6;
        waterColor = 0x445566;
        scene.fog = new THREE.FogExp2(0x445566, 0.02);
        break;
      case WeatherType.ICE:
        phi = 80;
        ambientIntensity = 0.7;
        dirIntensity = 1.2;
        waterColor = 0x88ccff;
        sunColor = 0xffffff;
        scene.fog = new THREE.FogExp2(0x88ccff, 0.002);

        // Create Icebergs
        for (let i = 0; i < 15; i++) {
          const iceGroup = new THREE.Group();
          const iceGeo = new THREE.IcosahedronGeometry(10 + Math.random() * 20, 1);
          const iceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.9 });
          const ice = new THREE.Mesh(iceGeo, iceMat);
          iceGroup.add(ice);
          
          const angle = Math.random() * Math.PI * 2;
          const dist = 200 + Math.random() * 800;
          iceGroup.position.set(Math.cos(angle) * dist, -5, Math.sin(angle) * dist);
          iceGroup.rotation.set(Math.random(), Math.random(), Math.random());
          scene.add(iceGroup);
          icebergsRef.current.push(iceGroup);
        }
        break;
    }

    // Apply changes
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(phi), THREE.MathUtils.degToRad(theta));
    sky.material.uniforms['sunPosition'].value.copy(sun);
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();
    water.material.uniforms['waterColor'].value.setHex(waterColor);
    water.material.uniforms['sunColor'].value.setHex(sunColor);
    
    ambientLight.intensity = ambientIntensity;
    dirLight.intensity = dirIntensity;
    dirLight.color.setHex(sunColor);

    // Update ship lanterns
    const updateShipLanterns = (ship: THREE.Group) => {
      if (ship.userData.lanternLights) {
        const intensity = (weather === WeatherType.NIGHT || weather === WeatherType.STORM) ? 1.0 : 0;
        ship.userData.lanternLights.forEach((l: THREE.PointLight) => l.intensity = intensity);
      }
    };

    if (shipRef.current) updateShipLanterns(shipRef.current);
    enemiesRef.current.forEach(updateShipLanterns);
    // Also update preview ships
    scene.children.forEach(child => {
      if (child instanceof THREE.Group && child.userData.lanternLights) {
        updateShipLanterns(child);
      }
    });

  }, [weather]);

  useEffect(() => {
    if (!isDead && shipRef.current && playerRef.current) {
      shipRef.current.position.set(playerRef.current.spawnPosition.x, 0, playerRef.current.spawnPosition.z);
      velocity.current.set(0, 0, 0);
      rotationVelocity.current = 0;
    }
  }, [isDead]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 5000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // Clear old refs
    enemiesRef.current = [];
    bulletsRef.current = [];
    thrownItemsRef.current = [];
    particlesRef.current = [];

      // Trajectory Preview Line
      const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
      const lineGeo = new THREE.BufferGeometry();
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      trajectoryLineRef.current = line;

    // Water
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x00aaff,
      distortionScale: 3.7,
    });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    waterRef.current = water;

    // Sky
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    skyRef.current = sky;

    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(85);
    const theta = THREE.MathUtils.degToRad(180);
    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms['sunPosition'].value.copy(sun);
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(-10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Lightning light (initially off)
    const lightning = new THREE.PointLight(0xffffff, 0, 5000);
    lightning.position.set(0, 500, 0);
    scene.add(lightning);
    lightningRef.current = lightning;

    if (previewMode) {
      for (let i = 0; i < 4; i++) {
        const ship = createProceduralShip(i * 12345, 1.5);
        ship.position.set((i - 1.5) * 25, 0, 0);
        scene.add(ship);
      }
      camera.position.set(0, 20, 60);
      camera.lookAt(0, 0, 0);
    } else if (player) {
      const stormGeo = new THREE.RingGeometry(1200, 1210, 64);
      const stormMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      const storm = new THREE.Mesh(stormGeo, stormMat);
      storm.rotation.x = -Math.PI / 2;
      storm.position.y = 1;
      scene.add(storm);
      stormRef.current = storm;

      const stats = getStats(player);
      const ship = createProceduralShip(player.id === 'player' ? 999 : 0, stats.size);
      ship.position.set(player.spawnPosition.x, 0, player.spawnPosition.z);
      scene.add(ship);
      shipRef.current = ship;

      items.forEach(item => {
        if (!item.collected) {
          const createItem = (type: ItemType) => {
            const group = new THREE.Group();
            const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
            
            switch (type) {
              case ItemType.FISH: {
                const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 4, 8), mat(0x00ffff));
                body.rotation.z = Math.PI / 2;
                group.add(body);
                const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), mat(0x00ffff));
                tail.position.x = 1;
                tail.rotation.z = -Math.PI / 2;
                group.add(tail);
                break;
              }
              case ItemType.HEALTH: {
                const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat(0xffffff));
                group.add(box);
                const cross1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.5), mat(0xff0000));
                const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.1, 0.5), mat(0xff0000));
                group.add(cross1, cross2);
                break;
              }
              case ItemType.BOOST: {
                const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), mat(0xffff00));
                group.add(core);
                const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 8, 24), mat(0xffaa00));
                ring.rotation.x = Math.PI / 2;
                group.add(ring);
                break;
              }
              case ItemType.BOOT: {
                const foot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.5), mat(0x5d4037));
                const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.2), mat(0x5d4037));
                leg.position.set(0, 1, -0.6);
                group.add(foot, leg);
                break;
              }
              case ItemType.LIFE_JACKET: {
                const jacket = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.5, 8, 16), mat(0xff4400));
                jacket.rotation.x = Math.PI / 2;
                group.add(jacket);
                const strap = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 0.2), mat(0xffffff));
                group.add(strap);
                break;
              }
              case ItemType.PLANK: {
                const plank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.5), mat(0x8d6e63));
                group.add(plank);
                break;
              }
              case ItemType.SHELL: {
                const shell = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 8), mat(0xffccaa));
                shell.rotation.x = Math.PI / 4;
                group.add(shell);
                break;
              }
              case ItemType.ROCK: {
                const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat(0x888888));
                rock.scale.set(1.2, 0.8, 1);
                group.add(rock);
                break;
              }
              case ItemType.DEBRIS: {
                const part1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x444444));
                const part2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2), mat(0x666666));
                part2.rotation.z = Math.PI / 3;
                group.add(part1, part2);
                break;
              }
              case ItemType.ISLAND: {
                const isLarge = item.id.includes('large');
                const isMed = item.id.includes('med');
                const scale = isLarge ? 120 : (isMed ? 60 : 30);
                const islandGeo = new THREE.CylinderGeometry(scale, scale * 1.2, 5, 8);
                const islandMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.8 });
                const island = new THREE.Mesh(islandGeo, islandMat);
                island.position.y = -2;
                group.add(island);
                
                // Add some trees or rocks on the island
                const detailCount = isLarge ? 20 : (isMed ? 10 : 5);
                for (let j = 0; j < detailCount; j++) {
                  const angle = Math.random() * Math.PI * 2;
                  const dist = Math.random() * scale * 0.8;
                  const detailType = Math.random() > 0.5 ? 'tree' : 'rock';
                  if (detailType === 'tree') {
                    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2), mat(0x5d4037));
                    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 8), mat(0x006400));
                    leaves.position.y = 1.5;
                    const tree = new THREE.Group();
                    tree.add(trunk, leaves);
                    tree.position.set(Math.cos(angle) * dist, 1, Math.sin(angle) * dist);
                    group.add(tree);
                  } else {
                    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + Math.random() * 2, 0), mat(0x888888));
                    rock.position.set(Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist);
                    group.add(rock);
                  }
                }
                group.userData.isSolid = true;
                group.userData.radius = scale;
                break;
              }
              case ItemType.MINE: {
                const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), mat(0x222222));
                group.add(body);
                for (let j = 0; j < 6; j++) {
                  const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5), mat(0x222222));
                  spike.rotation.x = (j % 3) * Math.PI / 2;
                  spike.rotation.z = (j / 3) * Math.PI / 2;
                  group.add(spike);
                }
                const light = new THREE.PointLight(0xff0000, 1, 5);
                light.position.y = 1;
                group.add(light);
                group.userData.isMine = true;
                group.userData.radius = 2;
                break;
              }
              case ItemType.EXPLOSIVE_BARREL: {
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 8), mat(0xcc0000));
                group.add(barrel);
                const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.5, 8), mat(0x222222));
                group.add(stripe);
                group.userData.isExplosive = true;
                group.userData.radius = 2;
                break;
              }
              case ItemType.SANDBANK: {
                const bank = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 1, 8), mat(0xedc9af));
                bank.position.y = -0.4;
                group.add(bank);
                group.userData.isSlow = true;
                group.userData.radius = 15;
                break;
              }
              case ItemType.REEF: {
                for (let j = 0; j < 5; j++) {
                  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 3, 0), mat(0x444444));
                  rock.position.set((Math.random() - 0.5) * 10, -1, (Math.random() - 0.5) * 10);
                  group.add(rock);
                }
                group.userData.isSolid = true;
                group.userData.radius = 8;
                break;
              }
              case ItemType.STRONG_WAVE_ZONE: {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(20, 0.5, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }));
                ring.rotation.x = Math.PI / 2;
                group.add(ring);
                group.userData.isWaveZone = true;
                group.userData.radius = 20;
                break;
              }
            }
            
            group.userData.floatOffset = Math.random() * Math.PI * 2;
            group.userData.rotSpeed = (Math.random() - 0.5) * 0.02;

            // Foam ring
            const foamGeo = new THREE.TorusGeometry(1.5, 0.05, 8, 24);
            const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
            const foam = new THREE.Mesh(foamGeo, foamMat);
            foam.rotation.x = Math.PI / 2;
            foam.position.y = -0.1;
            group.add(foam);
            group.userData.foam = foam;

            return group;
          };
          const itemObj = createItem(item.type);
          itemObj.position.set(item.position.x, 0, item.position.z);
          scene.add(itemObj);
          itemsRef.current[item.id] = itemObj;
        }
      });

      if (botsEnabled) {
        leaderboard.forEach(p => {
          if (p.isBot) {
            const enemy = createProceduralShip(parseInt(p.id.split('_')[1]) * 100, 1 + Math.random() * 2);
            enemy.position.set(p.spawnPosition.x, 0, p.spawnPosition.z);
            enemy.userData.shipClass = p.shipClass;
            enemy.userData.id = p.id;
            scene.add(enemy);
            enemiesRef.current.push(enemy);
          }
        });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'KeyE' && !isFishingRef.current && !previewMode) onStartFishing();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const handleWheel = (e: WheelEvent) => {
      if (previewMode) return;
      // Cycle between Tactical -> Combat -> Onboard on scroll
      if (playerRef.current) {
        const currentMode = playerRef.current.selectedCameraMode;
        const modes = [CameraMode.TACTICAL, CameraMode.COMBAT, CameraMode.ONBOARD];
        const currentIndex = modes.indexOf(currentMode);
        
        if (currentIndex !== -1) {
          if (e.deltaY > 0 && currentIndex < modes.length - 1) {
            onSetCameraMode(modes[currentIndex + 1]);
          } else if (e.deltaY < 0 && currentIndex > 0) {
            onSetCameraMode(modes[currentIndex - 1]);
          }
        }
      }
      onUpdatePower(prev => Math.max(5, Math.min(100, prev + e.deltaY * -0.05)));
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (previewMode || !containerRef.current) return;
      onUpdateAngle(((containerRef.current.clientHeight - e.clientY) / containerRef.current.clientHeight) * 60);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (previewMode || e.touches.length === 0 || !containerRef.current) return;
      onUpdateAngle(((containerRef.current.clientHeight - e.touches[0].clientY) / containerRef.current.clientHeight) * 60);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    const handleAction = (e?: MouseEvent | TouchEvent) => {
      if (e && e.cancelable) e.preventDefault();
      if (!shipRef.current || isMatchOverRef.current || isFishingRef.current || isDeadRef.current || previewMode) return;
      const stats = getStats(playerRef.current!);
      const item = onUseItem();
      const rad = THREE.MathUtils.degToRad(angleRef.current);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current.quaternion);
      const dispersion = (1 - stats.precision) * 0.2;
      const spread = new THREE.Vector3((Math.random() - 0.5) * dispersion, (Math.random() - 0.5) * dispersion, (Math.random() - 0.5) * dispersion);
      const launchDir = new THREE.Vector3().copy(forward).multiplyScalar(Math.cos(rad)).add(new THREE.Vector3(0, Math.sin(rad), 0)).add(spread).normalize();
      const initialVelocity = launchDir.multiplyScalar(powerRef.current * 0.15);
      velocity.current.add(forward.clone().multiplyScalar(-stats.knockback * 0.1));
      screenShake.current = stats.knockback * 0.2;
      triggerMuzzleFlash(scene, shipRef.current.position.clone().add(new THREE.Vector3(0, 3, 0)), forward);

      // Night reveal effect
      if (weatherRef.current === WeatherType.NIGHT) {
        const flashLight = new THREE.PointLight(0xffaa00, 10, 50);
        flashLight.position.copy(shipRef.current.position).add(new THREE.Vector3(0, 5, 0));
        scene.add(flashLight);
        setTimeout(() => scene.remove(flashLight), 100);
      }

      if (item) {
        // ... (existing fishing item logic)
        const createFishingItemModel = (item: FishingItem) => {
          const group = new THREE.Group();
          const color = new THREE.Color(item.color);
          let geometry: THREE.BufferGeometry;
          if (item.icon === '🐟' || item.icon === '🐠' || item.icon === '✨') geometry = new THREE.SphereGeometry(1.5, 8, 8);
          else if (item.icon === '👢') geometry = new THREE.BoxGeometry(1, 2, 1.5);
          else if (item.icon === '📦') geometry = new THREE.BoxGeometry(2, 2, 2);
          else if (item.icon === '💎') geometry = new THREE.OctahedronGeometry(2);
          else geometry = new THREE.TorusGeometry(1, 0.4, 8, 16);
          const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
          group.add(new THREE.Mesh(geometry, mat));
          return group;
        };
        const itemModel = createFishingItemModel(item);
        itemModel.position.copy(shipRef.current.position).add(new THREE.Vector3(0, 5, 0));
        itemModel.userData.velocity = initialVelocity;
        itemModel.userData.gravity = -0.006;
        itemModel.userData.itemData = item;
        scene.add(itemModel);
        thrownItemsRef.current.push(itemModel);
        setTimeout(() => { scene.remove(itemModel); thrownItemsRef.current = thrownItemsRef.current.filter(i => i !== itemModel); }, 5000);
      } else {
        const type = playerRef.current?.selectedCannonball || CannonballType.FAST;
        let bulletGeo: THREE.BufferGeometry;
        let bulletMat: THREE.MeshStandardMaterial;
        let bulletVelocity = initialVelocity.clone();
        let bulletDamage = stats.damage;

        if (type === CannonballType.FAST) {
          console.log('TAC');
          bulletGeo = new THREE.SphereGeometry(0.3 * stats.size);
          bulletMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
          bulletVelocity.multiplyScalar(2.5);
        } else if (type === CannonballType.HEAVY) {
          console.log('WHOOM');
          bulletGeo = new THREE.SphereGeometry(1.2 * stats.size);
          bulletMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
          bulletVelocity.multiplyScalar(1.2);
          bulletDamage *= 2;
        } else {
          // EXPLOSIVE
          bulletGeo = new THREE.SphereGeometry(0.6 * stats.size);
          bulletMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 2 });
          bulletVelocity.multiplyScalar(1.8);
        }

        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.copy(shipRef.current.position).add(new THREE.Vector3(0, 3, 0));
        bullet.userData.velocity = bulletVelocity;
        bullet.userData.gravity = -0.006;
        bullet.userData.damage = bulletDamage;
        bullet.userData.type = type;
        scene.add(bullet);
        bulletsRef.current.push(bullet);
        setTimeout(() => { scene.remove(bullet); bulletsRef.current = bulletsRef.current.filter(b => b !== bullet); }, 5000);
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right click for Aim Mode
        onSetCameraMode(CameraMode.AIM);
        return;
      }
      handleAction();
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        onSetCameraMode(CameraMode.COMBAT);
      }
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('.pointer-events-auto')) return;
      handleAction(e);
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    let lastTime = performance.now();
    let animationFrameId: number;
    const animate = () => {
      if (isMatchOverRef.current) return;
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      TWEEN.update();

      if (previewMode) {
        scene.children.forEach(child => {
          if (child instanceof THREE.Group) {
            child.position.y = Math.sin(now * 0.001 + child.position.x * 0.1) * 0.5;
            child.rotation.x = Math.sin(now * 0.0005) * 0.02;
            child.rotation.z = Math.cos(now * 0.0005) * 0.02;
          }
        });
      } else if (playerRef.current && shipRef.current && !isDeadRef.current) {
        const stats = getStats(playerRef.current);
        
        // Weather Physics & Effects
        let waveHeight = 0.5;
        let waveSpeed = 0.001;
        let rockingIntensity = 0.02;
        let speedMultiplier = 1.0;

        if (weatherRef.current === WeatherType.STORM) {
          waveHeight = 2.5;
          waveSpeed = 0.002;
          rockingIntensity = 0.15;
          speedMultiplier = 0.7;
          
          // Lightning
          if (lightningRef.current && Math.random() < 0.005) {
            lightningRef.current.intensity = 50 + Math.random() * 100;
            setTimeout(() => { if (lightningRef.current) lightningRef.current.intensity = 0; }, 100 + Math.random() * 200);
          }
        } else if (weatherRef.current === WeatherType.RAIN) {
          waveHeight = 1.2;
          rockingIntensity = 0.05;
          speedMultiplier = 0.9;
        } else if (weatherRef.current === WeatherType.ICE) {
          speedMultiplier = 0.8;
        }

        // Check for Strong Wave Zones before applying physics
        (Object.values(itemsRef.current) as THREE.Group[]).forEach(group => {
          if (group.userData.isWaveZone && shipRef.current!.position.distanceTo(group.position) < group.userData.radius) {
            waveHeight = 5.0;
            rockingIntensity = 0.2;
          }
        });

        // Rain Movement
        if (rainParticlesRef.current) {
          const positions = rainParticlesRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= 2; // Fall speed
            if (positions[i + 1] < 0) positions[i + 1] = 500;
          }
          rainParticlesRef.current.geometry.attributes.position.needsUpdate = true;
        }

        if (!isFishingRef.current) {
          const accel = stats.speed * 0.05 * speedMultiplier;
          const isMoving = keys.current['KeyW'] || keys.current['KeyS'];
          if (keys.current['KeyW']) {
            velocity.current.add(new THREE.Vector3(0, 0, -accel).applyQuaternion(shipRef.current.quaternion));
          }
          if (keys.current['KeyS']) velocity.current.add(new THREE.Vector3(0, 0, accel).applyQuaternion(shipRef.current.quaternion));
          if (keys.current['KeyA']) rotationVelocity.current += stats.maneuverability;
          if (keys.current['KeyD']) rotationVelocity.current -= stats.maneuverability;
          shipRef.current.position.add(velocity.current);
          shipRef.current.rotation.y += rotationVelocity.current;
          velocity.current.multiplyScalar(0.98);
          rotationVelocity.current *= 0.9;

          // Iceberg Collisions
          if (weatherRef.current === WeatherType.ICE) {
            icebergsRef.current.forEach(ice => {
              if (shipRef.current!.position.distanceTo(ice.position) < 25) {
                velocity.current.multiplyScalar(-0.5);
                screenShake.current = 2;
                if (Math.random() < 0.1) onDeath(); // Dangerous collisions
              }
            });
          }

          // Wake effect
          if (isMoving && Math.random() < 0.3) {
            const wakePos = shipRef.current.position.clone().add(new THREE.Vector3(0, 0, 5 * stats.size).applyQuaternion(shipRef.current.quaternion));
            createParticle(scene, 'splash', wakePos, 0xffffff, 0.5);
          }
        }
        shipRef.current.position.y = Math.sin(now * waveSpeed + shipRef.current.position.x * 0.05) * waveHeight;
        shipRef.current.rotation.x = Math.sin(now * 0.0005) * rockingIntensity;
        shipRef.current.rotation.z = Math.cos(now * 0.0005) * rockingIntensity;

        // Camera Logic
        const mode = playerRef.current.selectedCameraMode;
        let targetOffset = new THREE.Vector3();
        let targetLookAt = shipRef.current.position.clone();
        let targetFOV = 75;

        if (mode === CameraMode.TACTICAL) {
          targetOffset.set(0, 120 * stats.size, 100 * stats.size).applyQuaternion(shipRef.current.quaternion);
          targetFOV = 50;
        } else if (mode === CameraMode.AIM) {
          targetOffset.set(0, 10 * stats.size, 30 * stats.size).applyQuaternion(shipRef.current.quaternion);
          targetFOV = 40;
          // Look slightly ahead
          const forward = new THREE.Vector3(0, 0, -50).applyQuaternion(shipRef.current.quaternion);
          targetLookAt.add(forward);
        } else if (mode === CameraMode.ONBOARD) {
          targetOffset.set(0, 4 * stats.size, 2 * stats.size).applyQuaternion(shipRef.current.quaternion);
          targetFOV = 85;
          const forward = new THREE.Vector3(0, 0, -20).applyQuaternion(shipRef.current.quaternion);
          targetLookAt.add(forward);
        } else {
          // COMBAT
          targetOffset.set(0, 25 * stats.size, 50 * stats.size).applyQuaternion(shipRef.current.quaternion);
        }

        const shake = new THREE.Vector3((Math.random() - 0.5) * screenShake.current, (Math.random() - 0.5) * screenShake.current, (Math.random() - 0.5) * screenShake.current);
        const desiredPos = shipRef.current.position.clone().add(targetOffset).add(shake);
        
        camera.position.lerp(desiredPos, 0.1);
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 0.1);
        camera.updateProjectionMatrix();
        
        const currentLookAt = new THREE.Vector3();
        camera.getWorldDirection(currentLookAt);
        const targetDir = targetLookAt.clone().sub(camera.position).normalize();
        const lerpedDir = currentLookAt.lerp(targetDir, 0.1);
        camera.lookAt(camera.position.clone().add(lerpedDir));

        screenShake.current *= 0.9;
        shipRef.current.scale.setScalar(stats.size);

        if (playerRef.current.health < stats.maxHealth * 0.4 && Math.random() < 0.1) {
          createParticle(scene, 'smoke', shipRef.current.position.clone().add(new THREE.Vector3(0, 5, 0)), 0x333333, 1.2);
        }

        const stormRadius = 1200 - (180 - timeLeft) * 6;
        if (stormRef.current) {
          stormRef.current.scale.setScalar(stormRadius / 1200);
          if (shipRef.current.position.length() > stormRadius && !isDeadRef.current && Math.random() < 0.1) onDeath();
        }

        if (trajectoryLineRef.current && !isFishingRef.current) {
          if (!playerRef.current?.showAimLine) {
            trajectoryLineRef.current.visible = false;
          } else {
            const points: THREE.Vector3[] = [];
            let currentAngle = angleRef.current;
            
            // Storm instability
            if (weatherRef.current === WeatherType.STORM) {
              currentAngle += Math.sin(now * 0.005) * 5;
            }

            const rad = THREE.MathUtils.degToRad(currentAngle);
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRef.current.quaternion);
            const launchDir = new THREE.Vector3().copy(forward).multiplyScalar(Math.cos(rad)).add(new THREE.Vector3(0, Math.sin(rad), 0)).normalize();
            
            const type = playerRef.current?.selectedCannonball || CannonballType.FAST;
            let vMult = 1.8;
            if (type === CannonballType.FAST) vMult = 2.5;
            else if (type === CannonballType.HEAVY) vMult = 1.2;

            const v0 = launchDir.multiplyScalar(powerRef.current * 0.15 * vMult);
            const g = -0.006, startPos = shipRef.current.position.clone().add(new THREE.Vector3(0, 3, 0));
            for (let t = 0; t < 100; t++) {
              const p = new THREE.Vector3(v0.x * t, v0.y * t + 0.5 * g * t * t, v0.z * t).add(startPos);
              points.push(p);
              if (p.y < 0) break;
            }
            if (trajectoryLineRef.current.geometry) trajectoryLineRef.current.geometry.dispose();
            trajectoryLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(points);
            trajectoryLineRef.current.visible = true;
          }
        }

        // Item Animation & Collection
        Object.entries(itemsRef.current).forEach(([id, itemObj]) => {
          const group = itemObj as THREE.Group;
          if (group.parent) {
            // Bobbing
            const bob = Math.sin(now * 0.002 + group.userData.floatOffset);
            group.position.y = bob * 0.5;
            // Rotation
            group.rotation.y += group.userData.rotSpeed;
            group.rotation.x = Math.sin(now * 0.001 + group.userData.floatOffset) * 0.1;

            // Foam ring stays at water level
            if (group.userData.foam) {
              group.userData.foam.position.y = -group.position.y - 0.1;
              group.userData.foam.scale.setScalar(1 + bob * 0.2);
              group.userData.foam.material.opacity = 0.3 + bob * 0.1;
            }

            // Splash effect occasionally
            if (Math.random() < 0.01) {
              createParticle(scene, 'splash', group.position.clone(), 0xffffff, 0.3);
            }

            // Collection & Interaction
            const dist = shipRef.current ? group.position.distanceTo(shipRef.current.position) : Infinity;
            
            if (shipRef.current && dist < (group.userData.radius || 10) * stats.size) {
              if (group.userData.isMine || group.userData.isExplosive) {
                triggerExplosion(scene, group.position, 2);
                onDeath();
                scene.remove(group);
                onCollectItem(id); // Use this to mark as "collected/destroyed"
                delete itemsRef.current[id];
              } else if (group.userData.isSolid) {
                velocity.current.multiplyScalar(-0.5);
                shipRef.current.position.add(velocity.current.clone().multiplyScalar(2));
                screenShake.current = 2;
              } else if (group.userData.isSlow) {
                velocity.current.multiplyScalar(0.9);
              } else if (group.userData.isWaveZone) {
                // Handled in physics check above
              } else {
                onCollectItem(id);
                scene.remove(group);
                delete itemsRef.current[id];
              }
            }
          }
        });

        bulletsRef.current.forEach(bullet => {
          bullet.position.add(bullet.userData.velocity);
          bullet.userData.velocity.y += bullet.userData.gravity;

          // Trails
          if (bullet.userData.type === CannonballType.HEAVY && Math.random() < 0.5) {
            createParticle(scene, 'smoke', bullet.position.clone(), 0x333333, 0.8);
          } else if (bullet.userData.type === CannonballType.EXPLOSIVE) {
            createParticle(scene, 'fire', bullet.position.clone(), 0xffaa00, 0.4);
            if (Math.random() < 0.3) createParticle(scene, 'fire', bullet.position.clone(), 0xffffff, 0.2); // Sparks
          }

          if (bullet.position.y < 0) {
            triggerSplash(scene, bullet.position);
            scene.remove(bullet);
            bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);
          } else {
            // Check enemy collisions
            enemiesRef.current.forEach(enemy => {
              if (bullet.position.distanceTo(enemy.position) < 10 * enemy.scale.x) {
                triggerExplosion(scene, bullet.position, enemy.scale.x);
                scene.remove(bullet);
                bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);
                enemy.position.set((Math.random() - 0.5) * 2400, 0, (Math.random() - 0.5) * 2400);
                onKill();
                screenShake.current = 2;
              }
            });

            // Check map element collisions
            Object.entries(itemsRef.current).forEach(([id, itemObj]) => {
              const group = itemObj as THREE.Group;
              if (group.parent && bullet.position.distanceTo(group.position) < (group.userData.radius || 5)) {
                if (group.userData.isMine || group.userData.isExplosive) {
                  triggerExplosion(scene, group.position, 2);
                  scene.remove(group);
                  onCollectItem(id);
                  delete itemsRef.current[id];
                } else if (group.userData.isSolid) {
                  triggerSplash(scene, bullet.position);
                }
                scene.remove(bullet);
                bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);
              }
            });
          }
        });

        particlesRef.current.forEach((p, index) => {
          p.position.add(p.userData.velocity);
          p.userData.life -= p.userData.decay;
          if (p.userData.type === 'smoke' || p.userData.type === 'explosion' || p.userData.type === 'fire') {
            p.scale.setScalar(p.userData.life * 2);
            p.userData.velocity.y += 0.01;
          } else if (p.userData.type === 'splash') {
            p.scale.setScalar(1 + (1 - p.userData.life) * 4);
          } else if (p.userData.type === 'debris') {
            p.userData.velocity.y -= 0.02;
            p.rotation.x += 0.1; p.rotation.z += 0.1;
          }
          const mesh = p.children[0] as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat.opacity !== undefined) mat.opacity = p.userData.life;
          if (p.userData.life <= 0) { scene.remove(p); particlesRef.current.splice(index, 1); }
        });

        enemiesRef.current.forEach(enemy => {
          if (!(enemy.userData.stunned && enemy.userData.stunned > Date.now())) {
            enemy.translateZ(-1);
            if (Math.random() < 0.01) enemy.rotation.y += (Math.random() - 0.5) * 0.5;
            if (Math.random() < 0.05) createParticle(scene, 'smoke', enemy.position.clone().add(new THREE.Vector3(0, 5, 0)), 0x444444, 1);
            if (shipRef.current && enemy.position.distanceTo(shipRef.current.position) < 8 * stats.size && !isDeadRef.current) onDeath();
          }
        });
      }
      water.material.uniforms['time'].value += dt;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('touchstart', handleTouchStart);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, [previewMode, player?.id, botsEnabled, isMatchOver]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default WarshipGame;
