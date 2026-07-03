export const GAME_CONFIG = {
  player: {
    maxHealth: 100,
    baseShieldRecharge: 5, // Shield recharged per 10 combo
  },
  mechanics: {
    baseWpmTarget: 40,
    burstMultiplier: 1.15, // 15% faster spawning during burst
    chargeLaserDurationMs: 4000, // 4 seconds to kill a shooter
  },
  engine: {
    fps: 60,
    wpmSampleRateMs: 1000,
  }
};
