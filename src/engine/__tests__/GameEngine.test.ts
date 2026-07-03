import { GameEngine } from '../GameEngine';
import { PlayerDeathExplosion } from '../Entities';
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

    it('Transitions from MENU to PLAYING when SPACE is pressed', () => {
        expect(engine.state).toBe('MENU');
        engine.handleInput(' '); // Press Space
        expect(engine.state).toBe('PLAYING');
    });

    it('Increases combo for a correct keystroke', () => {
        engine.handleInput(' '); // Start game. Spawns "Sensors detect incoming hostile anomalies."
        
        const initialCombo = engine.combo;
        
        // The first character of the first word is 'S'
        engine.handleInput('S'); 
        
        expect(engine.combo).toBe(initialCombo + 1);
    });

    it('Resets combo back to 0 for an incorrect keystroke', () => {
        engine.handleInput(' '); // Start game
        
        engine.handleInput('S'); // Correct key
        expect(engine.combo).toBe(1);
        
        engine.handleInput('Z'); // Incorrect key
        expect(engine.combo).toBe(0); // Combo breaks!
    });

    it('Decouples spacebar from enemies but requires it to be typed in the global string', () => {
        engine.handleInput(' '); // Start game
        
        // Type "Sensors"
        'Sensors'.split('').forEach(char => engine.handleInput(char));
        
        expect(engine.combo).toBe(7);
        expect(engine.globalTypedText).toBe('Sensors');
        
        // First enemy should be dead
        expect((engine as any).enemies[0].isDead).toBe(true);
        
        // Type the space
        engine.handleInput(' ');
        expect(engine.combo).toBe(8);
        expect(engine.globalTypedText).toBe('Sensors ');
        
        // Second enemy should NOT be damaged yet
        expect((engine as any).enemies[1].typedChars).toBe(0);
    });

    it('Executes the Point-Blank Leech mechanic when an enemy hits the shield', () => {
        engine.handleInput(' '); // Start game
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
        
        // Advance time by 1 second to test continuous drain (10 health per second)
        (engine as any).update(1.0);
        expect(engine.health).toBe(90);
        
        // The active enemy index does NOT advance!
        expect((engine as any).activeEnemyIndex).toBe(0);
    });

    it('Dead enemies (ghosts) do not interact with the player shield', () => {
        engine.handleInput(' '); // Start game
        
        // Type "Sensors" to kill the first enemy
        'Sensors'.split('').forEach(char => engine.handleInput(char));
        
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
        engine.handleInput(' '); // Start game
        expect(engine.state).toBe('PLAYING');
        
        // Artificially reduce health to 0
        engine.health = 0;
        
        // Manually update the engine
        (engine as any).update(0.016);
        
        // State should immediately become GAMEOVER
        expect(engine.state).toBe('GAMEOVER');
        
        // It should have spawned exactly one massive cinematic player death explosion
        const explosions = (engine as any).explosions;
        const playerExplosion = explosions.find((e: any) => e instanceof PlayerDeathExplosion);
        expect(playerExplosion).toBeDefined();
    });
});
