import { GameEngine } from './GameEngine';

describe('GameEngine Input Handling', () => {
    let engine: GameEngine;
    
    beforeEach(() => {
        // Mock Canvas API for Node/JSDOM environment
        const canvas = document.createElement('canvas');
        canvas.getContext = () => ({
            createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
            fillRect: jest.fn(),
            strokeRect: jest.fn(),
            fillText: jest.fn(),
            measureText: jest.fn(() => ({ width: 10 })),
            drawImage: jest.fn(),
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
            arc: jest.fn(),
            scale: jest.fn(),
        } as any);

        engine = new GameEngine(canvas as HTMLCanvasElement);
    });

    test('Initial state should be MENU', () => {
        expect(engine.state).toBe('MENU');
    });

    test('Pressing space in MENU should start game and set to PLAYING', () => {
        engine.handleInput(' ');
        expect(engine.state).toBe('PLAYING');
        expect(engine.currentStoryText).toBe("Sensors detect incoming hostile anomalies.");
    });

    test('Pressing 1 in BRANCHING should select branch and set to WARPING', () => {
        engine.state = 'BRANCHING'; // Manually enter Branching state for test
        
        // Mock the next branches coming from the ADK API
        engine.setNextBranches([
            { action_summary: "Evasive", full_narrative: "Evasive maneuvers engaged." },
            { action_summary: "Attack", full_narrative: "We go in guns blazing." }
        ]);
        
        // Select Branch 1
        engine.handleInput('1');
        
        expect(engine.state).toBe('WARPING');
        expect(engine.nextWaveText).toBe("Evasive maneuvers engaged.");
    });

    test('Correct keystrokes in PLAYING should advance globalTypedText', () => {
        engine.handleInput(' '); // Sets state to PLAYING with default text
        
        expect(engine.globalTypedText).toBe("");
        
        // The default text is "Sensors detect incoming hostile anomalies."
        // Type 'S'
        engine.handleInput('S');
        expect(engine.globalTypedText).toBe("S");
        
        // Type 'e'
        engine.handleInput('e');
        expect(engine.globalTypedText).toBe("Se");
        
        // Type wrong letter 'x' - should not advance
        engine.handleInput('x');
        expect(engine.globalTypedText).toBe("Se");
    });
});
