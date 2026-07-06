import { GameEngine } from '../GameEngine';
import { PlayerDeathExplosion } from '../Entities';
import { GAME_CONFIG } from '../../gameConfig';
// 1. Mock the HTML5 Canvas and Context
const mockContext = {
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  scale: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(() => ({ width: 10 })),
  strokeRect: jest.fn(),
  arc: jest.fn(),
};

const mockCanvas = {
  getContext: jest.fn(() => mockContext),
  width: 800,
  height: 600,
  style: {},
} as unknown as HTMLCanvasElement;

// Mock window functions for Node environment
global.window.addEventListener = jest.fn();
global.window.devicePixelRatio = 1;
global.performance = { now: jest.fn(() => 1000) } as unknown as Performance;
global.requestAnimationFrame = jest.fn();

describe('GameEngine - Core Typing Logic', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine(mockCanvas);
  });

  it('Transitions from MENU to BRANCHING when SPACE is pressed', () => {
    expect(engine.state).toBe('MENU');
    engine.handleInput(' '); // Press Space
    expect(engine.state).toBe('BRANCHING');
  });

  it('Increases combo for a correct keystroke', () => {
    engine.startGameForTest(); // Spawns "Sensors detect incoming hostile anomalies."

    const initialCombo = engine.combo;

    // The first character of the first word is 'S'
    engine.handleInput('S');

    expect(engine.combo).toBe(initialCombo + 1);
  });

  it('Resets combo back to 0 for an incorrect keystroke', () => {
    engine.startGameForTest();

    engine.handleInput('S'); // Correct key
    expect(engine.combo).toBe(1);

    engine.handleInput('Z'); // Incorrect key
    expect(engine.combo).toBe(0); // Combo breaks!
  });

  it('Decouples spacebar from enemies but requires it to be typed in the global string', () => {
    engine.startGameForTest();
    (engine as any).update(0.016); // Spawn first enemy from queue

    // Type "Sensors"
    'Sensors'.split('').forEach((char) => engine.handleInput(char));

    expect(engine.combo).toBe(7);
    expect(engine.globalTypedText).toBe('Sensors');

    // First enemy should be dead
    expect((engine as any).enemies[0].isDead).toBe(true);

    // Call update so the Rubber-Band spawner drops the NEXT enemy since the first one died
    (engine as any).update(0.3); // Must wait > 0.2s minimum spawn delay

    // Type the space
    engine.handleInput(' ');
    expect(engine.combo).toBe(8);
    expect(engine.globalTypedText).toBe('Sensors ');

    // Second enemy should NOT be damaged yet
    expect((engine as any).enemies[1].typedChars).toBe(0);
  });

  it('Executes the Point-Blank Leech mechanic when an enemy hits the shield', () => {
    engine.startGameForTest();
    (engine as any).update(0.016); // Spawn first enemy from queue
    const enemy = (engine as any).enemies[0];

    // Force the enemy to be right next to the player shield
    // Mock Canvas is 800x600, player is at (400, 450).
    enemy.x = 400;
    enemy.y = 400; // Distance is 50px (which is < 80px radius)

    // Manually call update to trigger collision
    const dt = 0.016;
    (engine as any).update(dt);

    // The enemy should NOT be dead, but hitShield should be true
    expect(enemy.hitShield).toBe(true);
    expect(enemy.isDead).toBe(false);

    // The player takes NO initial burst damage
    expect(engine.health).toBe(100);

    // Advance time by 1 second to test continuous drain
    (engine as any).update(1.0);
    const expectedHealth = 100 - (GAME_CONFIG as any).ENEMY_KAMIKAZE_DAMAGE_RATE;
    expect(engine.health).toBe(expectedHealth);

    // The active enemy index does NOT advance!
    expect((engine as any).activeEnemyIndex).toBe(0);
  });

  it('Dead enemies (ghosts) do not interact with the player shield', () => {
    engine.startGameForTest();
    (engine as any).update(0.016); // Spawn first enemy from queue

    // Type "Sensors" to kill the first enemy
    'Sensors'.split('').forEach((char) => engine.handleInput(char));

    const enemy = (engine as any).enemies[0];
    expect(enemy.isDead).toBe(true);
    expect(engine.combo).toBe(7);

    // Move the DEAD enemy directly onto the player's shield
    enemy.x = 400;
    enemy.y = 450 - 90; // Within the 95px collision radius

    // Manually update the engine
    (engine as any).update(0.016);

    // The enemy should NOT have registered a shield hit, because its physics update was skipped!
    expect(enemy.hitShield).toBe(false);
    // The combo should NOT have been reset by a ghost collision!
    expect(engine.combo).toBe(7);
  });

  it('Triggers GAMEOVER and a PlayerDeathExplosion when health reaches 0', () => {
    engine.startGameForTest();
    expect(engine.state).toBe('PLAYING');

    // Artificially reduce health to 0
    engine.health = 0;

    // Manually update the engine
    (engine as any).update(0.016);

    // State should immediately become GAMEOVER
    expect(engine.state).toBe('GAMEOVER');

    // It should have spawned exactly one massive cinematic player death explosion
    const explosions = (engine as any).explosions;
    const playerExplosion = explosions.find(
      (e: any) => e instanceof PlayerDeathExplosion,
    );
    expect(playerExplosion).toBeDefined();
  });

  it('Player takes continuous damage from Dreadnought beam attack', () => {
    engine.startGameForTest();
    
    // Artificially inject a Dreadnought boss and force it to fire its laser
    const BossEntities = require('../BossEntities');
    const dreadnought = new BossEntities.DreadnoughtBoss(400, 100, 1000);
    dreadnought._isFiringLaser = true;
    engine.boss = dreadnought;
    
    // Confirm health is at max before the beam hits
    expect(engine.health).toBe(100);
    
    // Update the engine by exactly 1.0 second
    (engine as any).update(1.0);
    
    // The Dreadnought beam should have drained the player's health
    const expectedBossHealth = 100 - (GAME_CONFIG as any).BOSS_DREADNOUGHT_BEAM_DAMAGE_RATE;
    expect(engine.health).toBe(expectedBossHealth);
  });

  it('Player ship rotates to point towards the active enemy when typing', () => {
    engine.startGameForTest();
    expect((engine as any).playerAngle).toBe(0); // Neutral start

    // Inject an enemy at the top left of the screen
    const EnemyModule = require('../Entities');
    const enemy = new EnemyModule.Enemy(
      0,
      0, // x, y (top left)
      'test', // word
      10, // speed
      'kamikaze'
    );
    (engine as any).enemies = [enemy];
    (engine as any).activeEnemyIndex = 0;
    engine.currentStoryText = 'test';
    engine.globalTypedText = '';

    // Simulate typing the first character
    engine.handleInput('t');
    expect(enemy.typedChars).toBe(1);

    // Run the update loop so the engine can calculate the lerp rotation
    (engine as any).update(0.1);

    // The ship should no longer be pointing straight ahead (0)
    // It should have started rotating towards the enemy (top left)
    expect((engine as any).playerAngle).not.toBe(0);
  });

  it('Maintains perfect sync between globalTypedText and activeEnemy.typedChars', () => {
    engine.startGameForTest();

    // Inject a boss and boss targets just like in the real game
    const BossEntities = require('../BossEntities');
    engine.boss = new BossEntities.DreadnoughtBoss(400, 100, 1000);
    
    // Simulate spawnWave logic
    const text = "Sensors detect incoming hostile anomalies.";
    engine.currentStoryText = text;
    engine.globalTypedText = '';
    
    const EnemyModule = require('../Entities');
    const words = text.split(' ');
    const enemies = words.map((w: string) => new EnemyModule.Enemy(0, 0, w, 0, 0, 'boss_target'));
    (engine as any).enemies = enemies;
    (engine as any).activeEnemyIndex = 0;

    // Type the first 4 words completely: "Sensors detect incoming hostile "
    const firstPart = "Sensors detect incoming hostile ";
    for (const char of firstPart) {
      engine.handleInput(char);
    }

    expect(engine.globalTypedText).toBe(firstPart);
    expect((engine as any).activeEnemyIndex).toBe(4); // Should be on the 5th enemy ("anomalies.")

    // Now type "anomalie"
    const secondPart = "anomalie";
    for (const char of secondPart) {
      engine.handleInput(char);
    }

    expect(engine.globalTypedText).toBe("Sensors detect incoming hostile anomalie");
    
    const lastEnemy = (engine as any).enemies[4];
    expect(lastEnemy.word).toBe("anomalies.");
    // It should have exactly 8 typed characters
    expect(lastEnemy.typedChars).toBe(8);
  });

  it('Strictly caps enemy spawns at low health (Dynamic Difficulty)', () => {
    // Setup a game with >10 enemies in queue
    (engine as any).currentStoryText = "Word one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen.";
    engine.startGameForTest();
    (engine as any).health = 0; // Absolute 0 health -> TARGET_DENSITY should drop exactly to 4
    (engine as any).spawnTimer = 0; // Force immediate spawn

    // Simulate 20 seconds of gameplay without typing 
    // We constantly reset health to 0 so they don't trigger GAMEOVER and stop the spawn loop
    for (let i = 0; i < 200; i++) {
        (engine as any).health = 0; 
        (engine as any).update(0.1); 
    }

    // Since health is critically low, the density should be capped at 4
    // It should not have spawned all 8 config max enemies
    const activeEnemies = (engine as any).enemies.filter((e: any) => !e.isDead).length;
    console.log(`Active enemies after 20s: ${activeEnemies}`);
    expect(activeEnemies).toBeLessThanOrEqual(4);
  });

  it('Does not allow globalTypedText to outpace enemy spawning when typing fast', () => {
    engine.startGameForTest();
    
    // Simulate spawnWave logic for a regular level (not boss level)
    const text = "Sensors detect";
    engine.currentStoryText = text;
    engine.globalTypedText = '';
    
    // Put "Sensors" in enemies (already spawned), and "detect" in pendingSpawnQueue (not spawned)
    const EnemyModule = require('../Entities');
    const enemy1 = new EnemyModule.Enemy(0, 0, "Sensors", 0, 0, 'kamikaze');
    (engine as any).enemies = [enemy1];
    (engine as any).activeEnemyIndex = 0;
    
    (engine as any).pendingSpawnQueue = [{
        word: "detect",
        startIndex: 8,
        type: 'kamikaze',
        speed: 10
    }];

    // Type the first word completely: "Sensors"
    const firstPart = "Sensors";
    for (const char of firstPart) {
      engine.handleInput(char);
    }

    expect(engine.globalTypedText).toBe("Sensors");
    expect((engine as any).activeEnemyIndex).toBe(1); // Now waiting for the 2nd enemy

    // Type the space between words
    engine.handleInput(' ');
    expect(engine.globalTypedText).toBe("Sensors ");

    // The 2nd enemy ("detect") has NOT spawned yet because we haven't called update() to run the spawnTimer.
    // The player types 'd' very fast!
    engine.handleInput('d');

    // Currently, this causes globalTypedText to become "Sensors d", but typedChars for "detect" is lost forever!
    // We expect the engine to either block the input, OR force-spawn the enemy.
    // If it force-spawns, there should be 2 enemies in the array now.
    expect((engine as any).enemies.length).toBe(2);
    
    const enemy2 = (engine as any).enemies[1];
    expect(enemy2.word).toBe("detect");
    // And it should have recorded the 'd'
    expect(enemy2.typedChars).toBe(1);
    expect(engine.globalTypedText).toBe("Sensors d");
  });

  it('Does not crash with ReferenceError when processing Boss bullets', () => {
    engine.startGameForTest();
    engine.currentLevel = 4; // Boss level
    (engine as any).isBossLevel = true;
    (engine as any).state = 'PLAYING';

    const BossEntities = require('../BossEntities');
    engine.boss = new BossEntities.DreadnoughtBoss(400, 100, 1000);
    
    // Inject a boss bullet directly onto the player
    const playerX = 800 / 2; // Assuming default 800x600 canvas
    const playerY = 600 - 150;
    
    // Create a generic object that acts like a BossBullet
    const bullet = {
      x: playerX,
      y: playerY,
      update: () => {},
      hasHit: false
    };
    
    (engine as any).bossBullets = [bullet];

    // This update should NOT crash with ReferenceError
    expect(() => {
      (engine as any).update(0.1);
    }).not.toThrow();
  });

  it('Deflector shield active time decreases and enters cooldown', () => {
    engine.startGameForTest();
    engine.currentLevel = 4; // Boss level
    (engine as any).isBossLevel = true;
    (engine as any).state = 'PLAYING';

    // Activate deflector shield
    engine.deflectorCharge = 1.0;
    engine.deflectorActiveTime = 5.0; // Active for 5 seconds

    // Run the engine for 2 seconds
    (engine as any).update(2.0);

    // Active time should decrease to 3.0
    expect(engine.deflectorActiveTime).toBe(3.0);
    // Charge should still be 1.0 while active
    expect(engine.deflectorCharge).toBe(1.0);

    // Run for 4 more seconds (total 6 seconds)
    (engine as any).update(4.0);

    // Active time should be 0
    expect(engine.deflectorActiveTime).toBe(0);
    // Charge should be reset to 0
    expect(engine.deflectorCharge).toBe(0);
  });
});
