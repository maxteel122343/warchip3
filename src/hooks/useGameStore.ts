/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { Player, BASE_STATS, ShipClass, GameItem, ItemType, FishingItem, FISHING_REWARDS, Rarity, CannonballType, CameraMode, WeatherType } from '../data/gameData';

export const useGameStore = () => {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('warship_name') || '';
  });

  const [player, setPlayer] = useState<Player | null>(null);
  const [items, setItems] = useState<GameItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [isMatchOver, setIsMatchOver] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [weather, setWeather] = useState<WeatherType>(WeatherType.SUNNY);

  // Settings State
  const [botsEnabled, setBotsEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Fishing State
  const [isFishing, setIsFishing] = useState(false);
  const [fishingReward, setFishingReward] = useState<FishingItem | null>(null);

  // Shooting Parameters
  const [power, setPower] = useState(25);
  const [angle, setAngle] = useState(30);

  // Helper to get random position in a zone
  const getRandomPos = useCallback((radiusMin: number, radiusMax: number) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = radiusMin + Math.random() * (radiusMax - radiusMin);
    return {
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist
    };
  }, []);

  // Weather Cycle
  useEffect(() => {
    if (player && !isMatchOver) {
      const weatherInterval = setInterval(() => {
        const weathers = [
          WeatherType.SUNNY, 
          WeatherType.RAIN, 
          WeatherType.STORM, 
          WeatherType.NIGHT, 
          WeatherType.FOG,
          WeatherType.ICE
        ];
        setWeather(prev => {
          const currentIndex = weathers.indexOf(prev);
          const nextIndex = (currentIndex + 1) % weathers.length;
          return weathers[nextIndex];
        });
      }, 30000); // Change weather every 30 seconds
      return () => clearInterval(weatherInterval);
    }
  }, [player !== null, isMatchOver]);

  // Helper to get current stats
  const getStats = useCallback((p: Player) => {
    const base = BASE_STATS[p.shipClass];
    const levelMult = 1 + (p.level - 1) * 0.1;
    return {
      maxHealth: (base.maxHealth + p.upgrades.hp * 100) * levelMult,
      damage: (base.damage + p.upgrades.damage * 10) * levelMult,
      speed: (base.speed + p.upgrades.speed * 0.5) * levelMult,
      maneuverability: base.maneuverability * levelMult,
      weight: base.weight,
      precision: base.precision,
      firepower: base.firepower * levelMult,
      maxEnergy: base.energy * levelMult,
      inventoryCapacity: base.inventoryCapacity,
      armor: base.armor + p.level * 2,
      fireRate: base.fireRate,
      range: base.range * levelMult,
      knockback: base.knockback,
      size: base.size * levelMult,
    };
  }, []);

  useEffect(() => {
    if (playerName) {
      localStorage.setItem('warship_name', playerName);
    }
  }, [playerName]);

  // Match Timer & Energy Regen
  useEffect(() => {
    if (player && timeLeft > 0 && !isMatchOver) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
        
        // Energy Regen
        setPlayer(curr => {
          if (!curr) return null;
          const stats = getStats(curr);
          return {
            ...curr,
            energy: Math.min(stats.maxEnergy, curr.energy + 2)
          };
        });
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      setIsMatchOver(true);
    }
  }, [player !== null, timeLeft, isMatchOver, getStats]);

  const startMatch = (name: string, shipClass: ShipClass = ShipClass.BALANCED) => {
    setPlayerName(name);
    const base = BASE_STATS[shipClass];
    setTimeLeft(180);
    setIsMatchOver(false);
    setIsDead(false);
    setIsFishing(false);
    setFishingReward(null);
    
    // Initialize items and map elements
    const mapElements: GameItem[] = [];

    // 1. Islands (1 large, 3 medium, 6 small)
    // Large in center
    mapElements.push({ id: 'island_large_0', type: ItemType.ISLAND, position: { x: 0, z: 0 }, collected: false });
    // Medium
    for (let i = 0; i < 3; i++) {
      mapElements.push({ id: `island_med_${i}`, type: ItemType.ISLAND, position: getRandomPos(300, 600), collected: false });
    }
    // Small
    for (let i = 0; i < 6; i++) {
      mapElements.push({ id: `island_small_${i}`, type: ItemType.ISLAND, position: getRandomPos(600, 1000), collected: false });
    }

    // 2. Rocks (15-30)
    const rockCount = 15 + Math.floor(Math.random() * 15);
    for (let i = 0; i < rockCount; i++) {
      mapElements.push({ id: `rock_${i}`, type: ItemType.ROCK, position: getRandomPos(100, 1100), collected: false });
    }

    // 3. Natural Barriers (10-20)
    const barrierCount = 10 + Math.floor(Math.random() * 10);
    for (let i = 0; i < barrierCount; i++) {
      const type = Math.random() > 0.5 ? ItemType.REEF : ItemType.SANDBANK;
      mapElements.push({ id: `barrier_${i}`, type, position: getRandomPos(200, 1000), collected: false });
    }

    // 4. Debris (20-40)
    const debrisCount = 20 + Math.floor(Math.random() * 20);
    for (let i = 0; i < debrisCount; i++) {
      mapElements.push({ id: `debris_${i}`, type: ItemType.DEBRIS, position: getRandomPos(100, 1100), collected: false });
    }

    // 5. Interactive Objects
    // Explosive Barrels (5-10)
    const barrelCount = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < barrelCount; i++) {
      mapElements.push({ id: `barrel_${i}`, type: ItemType.EXPLOSIVE_BARREL, position: getRandomPos(200, 900), collected: false });
    }
    // Mines (5-15) - mostly in risk zones (outer edges)
    const mineCount = 5 + Math.floor(Math.random() * 10);
    for (let i = 0; i < mineCount; i++) {
      mapElements.push({ id: `mine_${i}`, type: ItemType.MINE, position: getRandomPos(800, 1150), collected: false });
    }
    // Floating Loot (10-20)
    const lootCount = 10 + Math.floor(Math.random() * 10);
    for (let i = 0; i < lootCount; i++) {
      const types = [ItemType.FISH, ItemType.HEALTH, ItemType.BOOST];
      const type = types[Math.floor(Math.random() * types.length)];
      mapElements.push({ id: `loot_${i}`, type, position: getRandomPos(100, 1000), collected: false });
    }

    // 6. Strong Wave Zones (2-4)
    const waveZoneCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < waveZoneCount; i++) {
      mapElements.push({ id: `wave_zone_${i}`, type: ItemType.STRONG_WAVE_ZONE, position: getRandomPos(400, 900), collected: false });
    }

    setItems(mapElements);

    // Initialize bots
    const bots: Player[] = botsEnabled ? Array.from({ length: 9 }, (_, i) => {
      const botClass = [ShipClass.LIGHT, ShipClass.HEAVY, ShipClass.BALANCED][Math.floor(Math.random() * 3)];
      const spawnPos = getRandomPos(800, 1100); // Spawn bots in the outer zones
      return {
        id: `bot_${i}`,
        name: `Bot ${i + 1}`,
        shipClass: botClass,
        kills: Math.floor(Math.random() * 5),
        deaths: 0,
        level: Math.floor(Math.random() * 5) + 1,
        health: BASE_STATS[botClass].maxHealth,
        energy: BASE_STATS[botClass].energy,
        isBot: true,
        fishCollected: 0,
        inventory: [],
        selectedItemIndex: -1,
        selectedCannonball: CannonballType.FAST,
        selectedCameraMode: CameraMode.COMBAT,
        showAimLine: true,
        upgrades: { hp: 0, speed: 0, damage: 0 },
        spawnPosition: spawnPos
      };
    }) : [];

    const playerSpawn = getRandomPos(800, 1100);
    const newPlayer: Player = {
      id: 'player',
      name,
      shipClass,
      kills: 0,
      deaths: 0,
      level: 1,
      health: base.maxHealth,
      energy: base.energy,
      isBot: false,
      fishCollected: 0,
      inventory: [],
      selectedItemIndex: -1,
      selectedCannonball: CannonballType.FAST,
      selectedCameraMode: CameraMode.COMBAT,
      showAimLine: true,
      upgrades: { hp: 0, speed: 0, damage: 0 },
      spawnPosition: playerSpawn
    };
    setPlayer(newPlayer);
    setLeaderboard([newPlayer, ...bots].sort((a, b) => b.kills - a.kills));
  };

  const upgradeAttribute = (attr: 'hp' | 'speed' | 'damage') => {
    if (player && player.fishCollected >= 10) {
      setPlayer(curr => {
        if (!curr) return null;
        return {
          ...curr,
          fishCollected: curr.fishCollected - 10,
          upgrades: {
            ...curr.upgrades,
            [attr]: curr.upgrades[attr] + 1
          }
        };
      });
    }
  };

  const startFishing = () => {
    if (!isFishing && !isDead && !isMatchOver) {
      setIsFishing(true);
    }
  };

  const finishFishing = (success: boolean) => {
    setIsFishing(false);
    if (success && player) {
      const roll = Math.random();
      let pool: FishingItem[] = [];
      
      if (roll > 0.95) pool = FISHING_REWARDS.filter(r => r.rarity === Rarity.LEGENDARY);
      else if (roll > 0.8) pool = FISHING_REWARDS.filter(r => r.rarity === Rarity.EPIC);
      else if (roll > 0.5) pool = FISHING_REWARDS.filter(r => r.rarity === Rarity.RARE);
      else pool = FISHING_REWARDS.filter(r => r.rarity === Rarity.COMMON);

      const reward = pool[Math.floor(Math.random() * pool.length)];
      setFishingReward(reward);

      const stats = getStats(player);
      const newInventory = [...player.inventory, reward].slice(-stats.inventoryCapacity);
      
      const updatedPlayer = { 
        ...player, 
        fishCollected: player.fishCollected + 2,
        inventory: newInventory,
        selectedItemIndex: player.selectedItemIndex === -1 ? 0 : player.selectedItemIndex
      };
      const newLevel = Math.min(100, Math.floor((updatedPlayer.kills + updatedPlayer.fishCollected / 5) / 2) + 1);
      updatedPlayer.level = newLevel;
      
      setPlayer(updatedPlayer);
      updateLeaderboard(updatedPlayer);
    }
  };

  const selectItem = (index: number) => {
    if (player && index >= 0 && index < player.inventory.length) {
      setPlayer({ ...player, selectedItemIndex: index });
    }
  };

  const useSelectedItem = () => {
    if (player && player.selectedItemIndex !== -1 && player.inventory.length > 0) {
      const item = player.inventory[player.selectedItemIndex];
      const newInventory = player.inventory.filter((_, i) => i !== player.selectedItemIndex);
      const newIndex = newInventory.length > 0 ? Math.min(player.selectedItemIndex, newInventory.length - 1) : -1;
      
      const updatedPlayer = { 
        ...player, 
        inventory: newInventory,
        selectedItemIndex: newIndex
      };
      setPlayer(updatedPlayer);
      updateLeaderboard(updatedPlayer);
      return item;
    }
    return null;
  };

  const closeReward = () => {
    setFishingReward(null);
  };

  const addKill = () => {
    if (player) {
      const newKills = player.kills + 1;
      const newLevel = Math.min(100, Math.floor((newKills + player.fishCollected / 5) / 2) + 1);
      const stats = getStats({ ...player, level: newLevel });
      const updatedPlayer = { 
        ...player, 
        kills: newKills,
        level: newLevel,
        health: Math.min(stats.maxHealth, player.health + 100)
      };
      setPlayer(updatedPlayer);
      updateLeaderboard(updatedPlayer);
    }
  };

  const collectItem = (itemId: string) => {
    if (!player) return;

    setItems(prev => prev.map(item => {
      if (item.id === itemId && !item.collected) {
        let updatedPlayer = { ...player };
        if (item.type === ItemType.FISH) {
          updatedPlayer.fishCollected += 1;
        } else if (item.type === ItemType.HEALTH || item.type === ItemType.LIFE_JACKET) {
          const stats = getStats(player);
          updatedPlayer.health = Math.min(stats.maxHealth, player.health + 150);
        } else if (item.type === ItemType.BOOST) {
          updatedPlayer.energy = Math.min(getStats(player).maxEnergy, updatedPlayer.energy + 50);
        } else if (item.type === ItemType.BOOT || item.type === ItemType.PLANK || item.type === ItemType.SHELL || item.type === ItemType.DEBRIS) {
          updatedPlayer.fishCollected += 2;
        } else if (item.type === ItemType.ROCK) {
          updatedPlayer.fishCollected += 1;
        }
        
        const newLevel = Math.min(100, Math.floor((updatedPlayer.kills + updatedPlayer.fishCollected / 5) / 2) + 1);
        updatedPlayer.level = newLevel;

        setPlayer(updatedPlayer);
        updateLeaderboard(updatedPlayer);
        return { ...item, collected: true };
      }
      return item;
    }));
  };

  const handleDeath = () => {
    if (player) {
      const updatedPlayer = { ...player, deaths: player.deaths + 1 };
      setPlayer(updatedPlayer);
      updateLeaderboard(updatedPlayer);
      setIsDead(true);
    }
  };

  const respawn = () => {
    if (player) {
      const stats = getStats(player);
      const newSpawn = getRandomPos(800, 1100);
      setPlayer({ 
        ...player, 
        health: stats.maxHealth,
        energy: stats.maxEnergy,
        spawnPosition: newSpawn
      });
      setIsDead(false);
    }
  };

  const updateLeaderboard = (updatedPlayer: Player) => {
    setLeaderboard(prev => {
      const newLB = prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
      return newLB.sort((a, b) => b.kills - a.kills);
    });
  };

  const restartGame = () => {
    if (player) startMatch(player.name, player.shipClass);
  };

  const selectCannonball = (type: CannonballType) => {
    if (player) {
      setPlayer({ ...player, selectedCannonball: type });
    }
  };

  const toggleAimLine = () => {
    if (player) {
      setPlayer({ ...player, showAimLine: !player.showAimLine });
    }
  };

  const setCameraMode = (mode: CameraMode) => {
    if (player) {
      setPlayer({ ...player, selectedCameraMode: mode });
    }
  };

  return {
    playerName,
    setPlayerName,
    player,
    getStats,
    items,
    leaderboard,
    timeLeft,
    isMatchOver,
    isDead,
    botsEnabled,
    setBotsEnabled,
    isMuted,
    setIsMuted,
    isFishing,
    fishingReward,
    power,
    angle,
    setPower,
    setAngle,
    startMatch,
    addKill,
    collectItem,
    startFishing,
    finishFishing,
    selectItem,
    useSelectedItem,
    upgradeAttribute,
    closeReward,
    handleDeath,
    respawn,
    restartGame,
    selectCannonball,
    toggleAimLine,
    setCameraMode,
    weather,
  };
};
