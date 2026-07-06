'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../engine/GameEngine';

const glitchKeyframes = `
@keyframes glitch {
  0% { transform: translate(0) }
  20% { transform: translate(-2px, 1px) }
  40% { transform: translate(-1px, -1px) }
  60% { transform: translate(2px, 1px) }
  80% { transform: translate(1px, -1px) }
  100% { transform: translate(0) }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;

export default function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const storyRef = useRef<HTMLDivElement>(null);
    const [victoryStats, setVictoryStats] = useState<{
        wpm: number;
        wordsTyped: number;
        maxCombo: number;
        story: string;
        selectedGenre?: string | null;
    } | null>(null);
    const [defeatStats, setDefeatStats] = useState<{
        wpm: number;
        wordsTyped: number;
        maxCombo: number;
        story: string;
        levelNum: number;
        lockedWpm: number;
        storySoFar: string;
        waveText: string;
        selectedGenre?: string | null;
    } | null>(null);

    useEffect(() => {
        if (victoryStats && storyRef.current) {
            storyRef.current.scrollTop = 0;
        }
        if (defeatStats && storyRef.current) {
            storyRef.current.scrollTop = 0;
        }
    }, [victoryStats, defeatStats]);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize the decoupled game engine
        engineRef.current = new GameEngine(canvasRef.current);
        engineRef.current.start();

        // Expose to window for automated testing/bots
        (window as any).gameEngine = engineRef.current;

        // Bind victory screen
        engineRef.current.onVictory = setVictoryStats;
        engineRef.current.onDefeat = setDefeatStats;

        // Bind backend prefetching
        engineRef.current.onPrefetchRequested = (
            wpm: number,
            health: number,
            level: number,
            selectedGenres?: string[],
            selectedArchetypes?: string[],
            selectedGenre?: string,
        ) => {
            fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    story_so_far: engineRef.current!.getStorySoFar(),
                    player_wpm: wpm,
                    current_level: level,
                    selected_genres: selectedGenres,
                    selected_archetypes: selectedArchetypes,
                    selected_genre: selectedGenre,
                }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.branches) {
                        engineRef.current?.setNextBranches(data.branches);
                    } else if (data.error) {
                        console.error('Game Master API Error:', data.error);
                        // Fallback branch if API fails
                        engineRef.current?.setNextBranches([
                            {
                                action_summary: 'System Error. Manual Override.',
                                full_narrative:
                                    "The ship's comms array sparked and died. I'll have to fly blind through this sector.",
                            },
                        ]);
                    }
                })
                .catch((err) => {
                    console.error('Network Error:', err);
                    engineRef.current?.setNextBranches([
                        {
                            action_summary: 'System Error. Manual Override.',
                            full_narrative:
                                "The ship's comms array sparked and died. I'll have to fly blind through this sector.",
                        },
                    ]);
                });
        };

        // Native Auto-Play Bot (triggered via ?bot=WPM)
        const params = new URLSearchParams(window.location.search);
        const botParam = params.get('bot');

        let currentBotWpm = botParam ? (parseInt(botParam, 10) || 100) : 100;
        let delayMs = 1000 / ((currentBotWpm * 5) / 60);

        if (botParam) {
            const typeNext = () => {
                const engine = engineRef.current;
                if (!engine) return;

                if (engine.state === 'MENU') {
                    engine.handleInput(' ');
                } else if (engine.state === 'BRANCHING') {
                    engine.handleInput('1'); // Automatically select branch 1
                } else if (engine.state === 'PLAYING') {
                    if (engine.globalTypedText.length < engine.currentStoryText.length) {
                        const targetChar =
                            engine.currentStoryText[engine.globalTypedText.length];
                        engine.handleInput(targetChar);
                    }
                }
                setTimeout(typeNext, delayMs);
            };
            setTimeout(typeNext, 1000);
        }

        // Bind keyboard events
        const handleKeyDown = (e: KeyboardEvent) => {
            if (botParam) {
                if (e.key === '+') {
                    currentBotWpm += 5;
                    delayMs = 1000 / ((currentBotWpm * 5) / 60);
                    console.log(`Bot WPM increased to ${currentBotWpm}`);
                    return;
                }
                if (e.key === '-') {
                    currentBotWpm = Math.max(5, currentBotWpm - 5);
                    delayMs = 1000 / ((currentBotWpm * 5) / 60);
                    console.log(`Bot WPM decreased to ${currentBotWpm}`);
                    return;
                }
            }

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
        <div
            style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                background: '#000',
            }}
        >
            <style>{glitchKeyframes}</style>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {victoryStats && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'monospace',
                        color: '#fff',
                        padding: '40px',
                        boxSizing: 'border-box',
                    }}
                >
                    <h1
                        style={{
                            color: '#00ffcc',
                            fontSize: '3.5rem',
                            marginBottom: '10px',
                            textShadow: '0 0 20px #00ffcc',
                        }}
                    >
                        MISSION ACCOMPLISHED
                    </h1>
                    <h2
                        style={{
                            color: '#ffaa00',
                            fontSize: '1.5rem',
                            marginBottom: '30px',
                        }}
                    >
                        WPM: {victoryStats.wpm} &nbsp;|&nbsp; Words Typed:{' '}
                        {victoryStats.wordsTyped} &nbsp;|&nbsp; Max Combo: {victoryStats.maxCombo}
                    </h2>
                    {victoryStats.selectedGenre && (
                        <h3
                            style={{
                                color: '#00ffcc',
                                fontSize: '1.2rem',
                                marginBottom: '20px',
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                            }}
                        >
                            GENRE: {victoryStats.selectedGenre}
                        </h3>
                    )}
                    <div
                        ref={storyRef}
                        style={{
                            flex: 1,
                            width: '100%',
                            maxWidth: '900px',
                            overflowY: 'auto',
                            backgroundColor: 'rgba(5, 15, 20, 0.8)',
                            border: '2px solid #00ffcc',
                            borderRadius: '8px',
                            padding: '25px',
                            fontSize: '1.1rem',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            marginBottom: '30px',
                            boxShadow: '0 0 30px rgba(0, 255, 204, 0.2)',
                        }}
                    >
                        {victoryStats.story}
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '15px 40px',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            backgroundColor: '#00ffcc',
                            color: '#000',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            boxShadow: '0 0 20px rgba(0, 255, 204, 0.5)',
                        }}
                    >
                        PLAY AGAIN
                    </button>
                </div>
            )}
            {defeatStats && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(20, 0, 5, 0.9)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'monospace',
                        color: '#fff',
                        padding: '40px',
                        boxSizing: 'border-box',
                    }}
                >
                    <h1
                        style={{
                            color: '#ff0055',
                            fontSize: '3.5rem',
                            marginBottom: '10px',
                            textShadow: '0 0 20px #ff0055',
                        }}
                    >
                        MISSION FAILED
                    </h1>
                    <h2
                        style={{
                            color: '#ffaa00',
                            fontSize: '1.5rem',
                            marginBottom: '30px',
                        }}
                    >
                        WPM: {defeatStats.wpm} &nbsp;|&nbsp; Words Typed:{' '}
                        {defeatStats.wordsTyped} &nbsp;|&nbsp; Max Combo: {defeatStats.maxCombo}
                    </h2>
                    {defeatStats.selectedGenre && (
                        <h3
                            style={{
                                color: '#ffaa00',
                                fontSize: '1.2rem',
                                marginBottom: '20px',
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                            }}
                        >
                            GENRE: {defeatStats.selectedGenre}
                        </h3>
                    )}
                    <div
                        ref={storyRef}
                        style={{
                            flex: 1,
                            width: '100%',
                            maxWidth: '900px',
                            overflowY: 'auto',
                            backgroundColor: 'rgba(10, 5, 5, 0.8)',
                            border: '2px solid #ff0055',
                            borderRadius: '8px',
                            padding: '25px',
                            fontSize: '1.1rem',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            marginBottom: '30px',
                            boxShadow: '0 0 30px rgba(255, 0, 85, 0.2)',
                        }}
                    >
                        {defeatStats.story}
                        <div
                            style={{
                                marginTop: '40px',
                                textAlign: 'center',
                                color: '#ff0055',
                                fontWeight: 'bold',
                                fontSize: '1.5rem',
                                animation: 'glitch 0.2s infinite',
                                textShadow: '0 0 10px #ff0055',
                            }}
                        >
                            [ TRANSMISSION LOST ]
                            <span style={{ animation: 'blink 1s infinite' }}>_</span>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setDefeatStats(null);
                            engineRef.current?.replayLevel(
                                defeatStats.levelNum,
                                defeatStats.lockedWpm,
                                defeatStats.storySoFar,
                                defeatStats.waveText,
                            );
                        }}
                        style={{
                            padding: '15px 40px',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            backgroundColor: '#ff0055',
                            color: '#000',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            boxShadow: '0 0 20px rgba(255, 0, 85, 0.5)',
                        }}
                    >
                        REPLAY LEVEL
                    </button>
                </div>
            )}
        </div>
    );
}
