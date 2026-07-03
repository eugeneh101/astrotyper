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

        // Bind keyboard events
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent default scrolling for spacebar if playing
            if (e.key === ' ') e.preventDefault();
            engineRef.current?.handleInput(e.key);
        };

        window.addEventListener('keydown', handleKeyDown);

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
