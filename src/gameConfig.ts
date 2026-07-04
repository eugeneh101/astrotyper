export const GAME_CONFIG = {
    // Player & Defense
    PLAYER_MAX_HEALTH: 100,
    PLAYER_SHIELD_RADIUS: 80, // Normal shield collision radius
    PLAYER_DEFLECTOR_RADIUS: 110, // Expanded deflector shield collision radius
    SHIELD_REGEN_RATE: 2.0, // Health healed per second
    SHIELD_REGEN_DELAY: 5.0, // Seconds without taking damage before regen starts
    DEFLECTOR_MAX_CHARGE: 15, // Number of correct words to fully charge
    DEFLECTOR_ACTIVE_DURATION: 5.0, // Seconds the shield is active

    // Spawning System
    SPAWN_TARGET_DENSITY: 8,
    SPAWN_BASE_DELAY: 1.0,
    SPAWN_MIN_DELAY: 0.2,

    // Enemies
    ENEMY_KAMIKAZE_DAMAGE_RATE: 5, // Damage per second when leeching
    ENEMY_SHOOTER_DAMAGE: 5, // Damage per bullet hit
    ENEMY_SHOOTER_CHARGE_TIME: 6.0, // Seconds before shooter/scrambler fires
    ENEMY_SCRAMBLER_DURATION: 1.5, // Seconds text is glitched

    // Boss Mechanics
    BOSS_WPM_THRESHOLD: 70, // WPM >= this value spawns BioBoss instead of Dreadnought
    BOSS_DREADNOUGHT_QTE_DURATION: 6.0, // Seconds to interrupt
    BOSS_DREADNOUGHT_BEAM_DAMAGE_RATE: 5, // Damage per second
    BOSS_DREADNOUGHT_BULLET_DAMAGE: 1, // Damage per bullet
    BOSS_BIO_QTE_DURATION: 3.0, // Seconds to interrupt
    BOSS_BIO_BEAM_DAMAGE_RATE: 10, // Damage per second
    BOSS_BIO_BULLET_DAMAGE: 5, // Damage per bullet
};
