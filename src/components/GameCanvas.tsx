"use client";

import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/GameEngine';

export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize the decoupled game engine
        engineRef.current = new GameEngine(canvasRef.current);
        engineRef.current.start();

        // Expose to window for automated testing/bots
        (window as any).gameEngine = engineRef.current;

        // Bind backend prefetching
        engineRef.current.onPrefetchRequested = (wpm: number, health: number, level: number) => {
            fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    story_so_far: engineRef.current!.getStorySoFar(),
                    player_health: health,
                    player_wpm: wpm,
                    current_level: level
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.branches) {
                        engineRef.current?.setNextBranches(data.branches);
                    } else if (data.error) {
                        console.error("Game Master API Error:", data.error);
                        // Fallback branch if API fails
                        engineRef.current?.setNextBranches([{
                            action_summary: "System Error. Manual Override.",
                            full_narrative: "The ship's comms array sparked and died. I'll have to fly blind through this sector."
                        }]);
                    }
                })
                .catch(err => {
                    console.error("Network Error:", err);
                    engineRef.current?.setNextBranches([{
                        action_summary: "System Error. Manual Override.",
                        full_narrative: "The ship's comms array sparked and died. I'll have to fly blind through this sector."
                    }]);
                });
        };

        // Bind keyboard events
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent default scrolling for spacebar if playing
            if (e.key === ' ') e.preventDefault();
            engineRef.current?.handleInput(e.key);
        };

        window.addEventListener('keydown', handleKeyDown);

        // Native Auto-Play Bot (triggered via ?bot=WPM)
        const params = new URLSearchParams(window.location.search);
        const botParam = params.get('bot');
        if (botParam) {
            const botWpm = parseInt(botParam, 10) || 100;
            const delayMs = 1000 / (botWpm * 5 / 60);

            const typeNext = () => {
                const engine = engineRef.current;
                if (!engine || engine.state === 'GAMEOVER') return;

                if (engine.state === 'MENU') {
                    engine.handleInput(' ');
                } else if (engine.state === 'BRANCHING') {
                    engine.handleInput('1'); // Automatically select branch 1
                } else if (engine.state === 'PLAYING') {
                    if (engine.globalTypedText.length < engine.currentStoryText.length) {
                        const targetChar = engine.currentStoryText[engine.globalTypedText.length];
                        engine.handleInput(targetChar);
                    }
                }
                setTimeout(typeNext, delayMs);
            };
            setTimeout(typeNext, 1000);
        }

        return () => {
            engineRef.current?.stop();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
            <canvas
                ref={canvasRef}
                style={{ display: 'block' }}
            />
        </div>
    );
}
