import { GAME_CONFIG } from '../gameConfig';
import narrativeConfig from '../../config/narrative.json';
import { Enemy, Laser, Explosion, PlayerDeathExplosion } from './Entities';
import { Boss, DreadnoughtBoss, BioBoss, Bullet } from './BossEntities';

export type GameState =
    'MENU' | 'PLAYING' | 'GAMEOVER' | 'BRANCHING' | 'WARPING' | 'VICTORY';

export class GameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animationFrameId: number = 0;
    private lastTime: number = 0;

    // Game State
    public state: GameState = 'MENU';
    public currentStoryText: string =
        'AstroType: Infinite Odyssey. Press SPACE to begin.';
    public typedText: string = '';
    public combo: number = 0;
    public maxCombo: number = 0;
    public health: number = GAME_CONFIG.PLAYER_MAX_HEALTH;

    // Narrative & API Integration
    public currentLevel: number = 1;
    public fullStoryHistory: string = '';
    public victoryFired: boolean = false;
    public defeatFired: boolean = false;
    public onVictory?: (stats: {
        wpm: number;
        wordsTyped: number;
        maxCombo: number;
        story: string;
        selectedGenre?: string | null;
    }) => void;
    public onDefeat?: (stats: {
        wpm: number;
        wordsTyped: number;
        maxCombo: number;
        story: string;
        levelNum: number;
        lockedWpm: number;
        storySoFar: string;
        waveText: string;
        selectedGenre?: string | null;
    }) => void;
    public deathAnimationTimer: number = 0;
    public onPrefetchRequested?: (
        wpm: number,
        health: number,
        level: number,
        selectedGenres?: string[],
        selectedArchetypes?: string[],
        selectedGenre?: string,
    ) => void;
    public selectedGenre: string | null = null;
    private prefetchTriggered: boolean = false;
    private levelStartTime: number = 0;
    private levelEndTime: number = 0;
    private pendingBranches:
        { action_summary: string; full_narrative: string }[] | null = null;
    private currentBranchTitles: string[] | null = null;
    public lockedWpm: number = 0;
    public warpTimer: number = 0;
    public shipVisualY: number = 0;
    private nextWaveText: string | null = null;

    // Combat Entities
    private enemies: Enemy[] = [];
    private lasers: Laser[] = [];
    private explosions: (Explosion | PlayerDeathExplosion)[] = [];
    private activeEnemyIndex: number = 0;
    private playerAngle: number = 0;
    private timeSinceLastDamage: number = 0;
    private starfieldOffset: number = 0;

    // Original story text to show in HUD
    public globalTypedText: string = '';
    public cumulativeTypedChars: number = 0;
    public displayWpm: number = 0;
    public previousLineIdx: number = 0;
    public scramblerTimer: number = 0;

    // Dynamic Spawning State
    public pendingSpawnQueue: { word: string; startIndex: number; type: 'kamikaze' | 'shooter' | 'scrambler'; speed: number }[] = [];
    public spawnTimer: number = 0;
    private textScrollOffset: number = 0;

    private playerSprite: HTMLImageElement;
    private stars: { x: number; y: number; speed: number; size: number }[] = [];
    private bossVortexInitialized: boolean = false;

    // Boss State
    public boss: Boss | null = null;
    public bossBullets: Bullet[] = [];
    public deflectorCharge: number = 0; // 0 to 1
    public deflectorActiveTime: number = 0;
    private miniBioSpawnTimer: number = 0;
    public deathBlossomActive: boolean = false;
    public isBossLevel: boolean = false;
    private currentWarpMultiplier: number = 1.0;

    // Background State
    private currentBgTop: { r: number; g: number; b: number } = {
        r: 5,
        g: 5,
        b: 16,
    };
    private currentBgBottom: { r: number; g: number; b: number } = {
        r: 0,
        g: 0,
        b: 0,
    };
    private bossBgOpacity: number = 0;

    private hexToRgb(hex: string) {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255,
        };
    }

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        this.ctx = ctx;

        this.playerSprite = new Image();
        this.playerSprite.src = '/player_ship.png';

        // Initialize starfield with a large number of stars distributed across the virtual 3000x2000 space
        for (let i = 0; i < 800; i++) {
            this.stars.push({
                x: Math.random() * 3000,
                y: Math.random() * 2000,
                speed: Math.random() * 3 + 0.5, // Slow, peaceful cruising speed
                size: Math.random() * 2 + 0.5,
            });
        }

        // Handle window resizing
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    }

    private handleResize = () => {
        // High DPI canvas scaling
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement?.getBoundingClientRect() || {
            width: 800,
            height: 600,
        };

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
    };

    public start() {
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    public startGameForTest() {
        this.state = 'PLAYING';
        this.currentLevel = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.spawnWave('Sensors detect incoming hostile anomalies.');
    }

    public stop() {
        cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this.handleResize);
    }

    public handleInput(key: string) {
        if (this.state === 'MENU' && key === ' ') {
            this.state = 'BRANCHING';
            this.currentLevel = 0;
            this.combo = 0;
            this.maxCombo = 0;
            this.fullStoryHistory = '';
            this.globalTypedText = '';
            this.currentStoryText = '';
            this.pendingBranches = null; // Forces "INCOMING TRANSMISSIONS..." view

            // Randomly pick 3 genres for Level 1
            const shuffled = [...narrativeConfig.genres].sort(() => 0.5 - Math.random());
            const selectedGenres = shuffled.slice(0, 3);

            // Set temporary branches to display the genres in the UI while loading
            this.currentBranchTitles = selectedGenres;
            this.pendingBranches = selectedGenres.map(g => ({
                action_summary: "Establishing Comms...",
                full_narrative: ""
            }));

            // Fetch actual branches from LLM
            if (this.onPrefetchRequested) {
                this.onPrefetchRequested(0, this.health, 1, selectedGenres, undefined);
            }
            return;
        }

        if (this.state === 'BRANCHING') {
            if (key.length > 1) return;
            // Simplified branching: Type 1, 2, or 3 to select branch
            // Realistically we should render the branch text and have them type it, but for Phase 4 MVP,
            // we will let them type the action summary, or just a number key if it's easier.
            // Let's have them type the number 1, 2, or 3 for instant zero-latency selection.
            if (['1', '2', '3'].includes(key)) {
                const idx = parseInt(key) - 1;
                if (this.pendingBranches && this.pendingBranches[idx]) {
                    const selected = this.pendingBranches[idx];
                    
                    // Prevent selection if the LLM has not returned yet
                    if (selected.action_summary === 'Establishing Comms...') return;

                    this.combo = 0;
                    this.maxCombo = 0;

                    this.fullStoryHistory +=
                        '\n\n> ' +
                        selected.action_summary.replace(/\.$/, '') +
                        ':\n' +
                        selected.full_narrative;

                    // Clear the screen for warp/start
                    this.enemies = [];
                    this.lasers = [];
                    this.explosions = [];
                    if (this.currentLevel > 0) {
                        this.cumulativeTypedChars += this.globalTypedText.length;
                    }
                    this.globalTypedText = '';
                    this.activeEnemyIndex = 0;

                    if (this.currentLevel === 0) {
                        if (this.currentBranchTitles) {
                            this.selectedGenre = this.currentBranchTitles[idx];
                        }
                        // Skip the hyperdrive animation on game start, drop right into Level 1
                        this.currentLevel = 1;
                        this.state = 'PLAYING';
                        this.currentStoryText = '';
                        this.spawnWave(selected.full_narrative);
                    } else {
                        // Enter hyperdrive!
                        this.state = 'WARPING';
                        this.warpTimer = 2.0;
                        this.currentStoryText = 'ENTERING HYPERSPACE...';
                        this.nextWaveText = selected.full_narrative;
                    }
                }
            }
            return;
        }

        if (this.state !== 'PLAYING') return;
        if (key.length > 1) return; // Skip non-character keys

        // Prevent typing if already finished
        if (this.globalTypedText.length >= this.currentStoryText.length) return;

        const targetChar = this.currentStoryText[this.globalTypedText.length];

        if (key === targetChar) {
            this.globalTypedText += key;
            this.combo++;
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }

            // If the key is not a space, it must belong to the active enemy
            if (key !== ' ') {
                // If the user types faster than the spawn timer, force-spawn the next enemy instantly!
                if (
                    this.activeEnemyIndex >= this.enemies.length &&
                    this.pendingSpawnQueue &&
                    this.pendingSpawnQueue.length > 0
                ) {
                    const nextEnemy = this.pendingSpawnQueue.shift();
                    if (nextEnemy) {
                        const canvasW = this.canvas.width / (window.devicePixelRatio || 1);
                        const x = 100 + Math.random() * (canvasW - 200);
                        this.enemies.push(
                            new Enemy(x, -50, nextEnemy.word, nextEnemy.speed, 0, nextEnemy.type),
                        );
                    }
                }

                if (this.activeEnemyIndex < this.enemies.length) {
                    const activeEnemy = this.enemies[this.activeEnemyIndex];
                    activeEnemy.typedChars++;

                    // NEW QTE MECHANIC: If Boss is charging its laser, every keystroke fills the interrupt bar!
                    if (this.boss) {
                        if (
                            this.boss instanceof BioBoss &&
                            this.boss.mode === 'LASER_CHARGE'
                        ) {
                            this.boss.interruptCharge += 0.05; // 20 keystrokes to interrupt
                            if (this.boss.interruptCharge >= 1.0) {
                                // Interrupted!
                                this.boss.mode = 'COOLDOWN';
                                this.boss.modeTimer = 0;
                                // Create a massive cyan explosion to show success
                                this.explosions.push(
                                    new Explosion(this.boss.x, this.boss.y, '#00ffcc', 80),
                                );
                            }
                        } else if (
                            this.boss instanceof DreadnoughtBoss &&
                            this.boss.isChargingLaser
                        ) {
                            this.boss.interruptCharge += 0.5; // 20 keystrokes to reach 10
                            if (this.boss.interruptCharge >= 10) {
                                this.explosions.push(
                                    new Explosion(this.boss.x, this.boss.y, '#00ffcc', 80),
                                );
                            }
                        }
                    }

                    // Spawn a laser from player ship to the enemy
                    const canvasW = this.canvas.width / (window.devicePixelRatio || 1);
                    const canvasH = this.canvas.height / (window.devicePixelRatio || 1);
                    this.lasers.push(
                        new Laser(canvasW / 2, canvasH - 150, activeEnemy.x, activeEnemy.y),
                    );

                    // If finished typing the word
                    if (activeEnemy.typedChars === activeEnemy.word.length) {
                        activeEnemy.isDead = true;

                        if (activeEnemy.type === 'boss_target' && this.boss) {
                            // Damage the boss proportionally so it dies EXACTLY on the last word
                            const damagePerWord = this.boss.maxHealth / this.enemies.length;
                            // Ensure the very last word finishes it off perfectly to avoid floating point issues
                            if (this.activeEnemyIndex === this.enemies.length - 1) {
                                this.boss.health = 0;
                                this.boss.isDead = true;
                            } else {
                                this.boss.takeDamage(damagePerWord);
                            }

                            // If boss died, trigger Black Hole Spaghettification
                            if (this.boss.isDead && !this.deathBlossomActive) {
                                this.deathBlossomActive = true;

                                const canvasW =
                                    this.canvas.width / (window.devicePixelRatio || 1);
                                const canvasH =
                                    this.canvas.height / (window.devicePixelRatio || 1);

                                // Spaghettification: the boss stretches TOWARD the singularity
                                // Track animation progress for accelerating pull
                                let progress = 0;
                                const singularityX = canvasW / 2;
                                const singularityY = canvasH / 2;

                                const shrinkInterval = setInterval(() => {
                                    if (this.boss) {
                                        progress += 0.025;
                                        const accel = 1 + progress * progress * 4; // Accelerating pull

                                        // Pull toward singularity with increasing speed
                                        this.boss.x += (singularityX - this.boss.x) * 0.08 * accel;
                                        this.boss.y += (singularityY - this.boss.y) * 0.08 * accel;

                                        // Calculate angle from boss to singularity
                                        const dx = singularityX - this.boss.x;
                                        const dy = singularityY - this.boss.y;
                                        const angle = Math.atan2(dy, dx);

                                        // Stretch ALONG the axis toward the singularity, compress perpendicular
                                        // As progress increases: stretch grows dramatically, compression intensifies
                                        const stretch = 1 + progress * 4; // Elongate toward hole
                                        const compress = Math.max(0.05, 1 - progress * 1.5); // Crush sideways

                                        // Apply as directional scale via rotation trick:
                                        // scaleX = stretch along the toward-hole axis
                                        // scaleY = compress perpendicular
                                        // The boss draw() already applies scaleX/scaleY, so we encode the
                                        // directional distortion. We rotate the boss to face the hole,
                                        // then the scale axes align correctly.
                                        this.boss.spinAngle = angle + Math.PI / 2; // Face the hole
                                        this.boss.scaleX = compress;
                                        this.boss.scaleY = stretch;

                                        // Emit debris particles being ripped off
                                        if (Math.random() < 0.4 + progress) {
                                            const debrisAngle =
                                                angle + Math.PI + (Math.random() - 0.5) * 1.5;
                                            this.explosions.push(
                                                new Explosion(
                                                    this.boss.x + Math.cos(debrisAngle) * 30 * compress,
                                                    this.boss.y + Math.sin(debrisAngle) * 30 * compress,
                                                    progress > 0.5 ? '#ff4400' : '#ffaa00',
                                                    5 + Math.random() * 10,
                                                ),
                                            );
                                        }
                                    }
                                }, 50);

                                setTimeout(() => {
                                    clearInterval(shrinkInterval);
                                    if (this.boss) {
                                        // Final implosion at the singularity
                                        this.explosions.push(
                                            new Explosion(singularityX, singularityY, '#8800ff', 120),
                                        );
                                        this.explosions.push(
                                            new Explosion(singularityX, singularityY, '#000000', 80),
                                        );
                                        this.boss = null;
                                        this.deathBlossomActive = false;

                                        setTimeout(() => {
                                            this.state = 'VICTORY';
                                            if (this.onVictory && !this.victoryFired) {
                                                this.victoryFired = true;
                                                const wordsTyped = Math.floor(
                                                    (this.cumulativeTypedChars + this.globalTypedText.length) / 5,
                                                );
                                                this.onVictory({
                                                    wpm: Math.round(this.displayWpm),
                                                    wordsTyped,
                                                    maxCombo: this.maxCombo,
                                                    story: this.fullStoryHistory.trim(),
                                                    selectedGenre: this.selectedGenre,
                                                });
                                            }
                                        }, 3000);
                                    }
                                }, 2000);
                            }
                        } else {
                            this.explosions.push(
                                new Explosion(activeEnemy.x, activeEnemy.y, '#00ffcc', 30),
                            ); // Cyan explosion!
                        }

                        // Build Deflector Charge only during Boss levels
                        if (
                            this.isBossLevel &&
                            this.deflectorActiveTime <= 0
                        ) {
                            this.deflectorCharge += 0.05; // 20 words to charge
                            if (this.deflectorCharge >= 0.99) {
                                // Fix floating point precision issues
                                this.deflectorCharge = 1.0;
                                this.deflectorActiveTime = 5; // Active for 5 seconds
                            }
                        }

                        this.activeEnemyIndex++;

                        // Check if we hit the 70% threshold to prefetch
                        const progress =
                            this.globalTypedText.length / this.currentStoryText.length;
                        if (
                            progress >= 0.7 &&
                            !this.prefetchTriggered &&
                            this.onPrefetchRequested
                        ) {
                            this.prefetchTriggered = true;
                            // Calculate WPM up to this point
                            const timeElapsedMins =
                                (performance.now() - this.levelStartTime) / 60000;
                            const wordsTyped = this.globalTypedText.length / 5;
                            const wpm =
                                timeElapsedMins > 0
                                    ? Math.round(wordsTyped / timeElapsedMins)
                                    : 0;
                            if (this.currentLevel === 2) {
                                this.lockedWpm = wpm;
                            }

                            // Randomly select archetypes for Mid-Game Branching
                            const shuffledArchetypes = [...narrativeConfig.archetypes].sort(() => 0.5 - Math.random());
                            const selectedArchetypes = shuffledArchetypes.slice(0, 3);
                            this.currentBranchTitles = selectedArchetypes;

                            if (this.onPrefetchRequested) {
                                // No need to set prefetchTriggered = true again, already done
                                this.onPrefetchRequested(wpm, this.health, this.currentLevel, undefined, selectedArchetypes, this.selectedGenre || undefined);
                            }
                        }
                    }
                }
            }

            // Check if wave is cleared AFTER adding the key
            if (this.globalTypedText.length >= this.currentStoryText.length) {
                if (this.pendingBranches) {
                    if (!this.isBossLevel) {
                        this.state = 'BRANCHING';
                    }
                    // For boss levels, the transition is handled by the death animation timeout above
                }
            }
        } else {
            // Typo
            this.combo = 0;
        }
    }

    public setNextBranches(
        branches: { action_summary: string; full_narrative: string }[],
    ) {
        this.pendingBranches = branches;
        // If we were waiting in the cleared state, instantly transition
        if (
            this.state === 'PLAYING' &&
            this.globalTypedText.length >= this.currentStoryText.length
        ) {
            this.state = 'BRANCHING';
        }
    }

    public getStorySoFar() {
        return this.fullStoryHistory;
    }

    public replayLevel(
        levelNum: number,
        lockedWpm: number,
        storySoFar: string,
        waveText: string,
    ) {
        this.currentLevel = levelNum;
        this.lockedWpm = lockedWpm;
        this.fullStoryHistory = storySoFar;
        this.health = GAME_CONFIG.PLAYER_MAX_HEALTH;
        this.state = 'PLAYING';
        this.defeatFired = false;
        this.victoryFired = false;
        this.spawnWave(waveText);
    }

    private spawnWave(text: string) {
        // Sanitize text to prevent double spaces from breaking the parsing and typing logic
        text = text.trim().replace(/\s+/g, ' ');

        this.currentStoryText = text;
        this.globalTypedText = '';
        this.enemies = [];
        this.lasers = [];
        this.explosions = [];
        this.bossBullets = [];
        this.activeEnemyIndex = 0;
        this.prefetchTriggered = false;
        this.pendingBranches = null;
        this.levelStartTime = performance.now();
        this.levelEndTime = 0;
        this.previousLineIdx = 0;
        this.textScrollOffset = 0;
        this.scramblerTimer = 0;
        this.pendingSpawnQueue = [];
        this.spawnTimer = 0;

        const isActuallyBossLevel =
            this.currentLevel >= 4 ||
            (this.currentLevel === 3 && this.lockedWpm < GAME_CONFIG.BOSS_WPM_THRESHOLD);

        if (isActuallyBossLevel) {
            this.isBossLevel = true;

            const canvasW = this.canvas.width / (window.devicePixelRatio || 1);

            // Dynamic Encounter Routing - spawn off-screen for suspenseful entrance
            if (this.lockedWpm >= GAME_CONFIG.BOSS_WPM_THRESHOLD) {
                this.boss = new BioBoss(canvasW / 2, -200, text.length * 10);
            } else {
                this.boss = new DreadnoughtBoss(canvasW / 2, -200, text.length * 10);
            }

            // Split the boss text into individual words
            const words = text.split(' ');
            for (let i = 0; i < words.length; i++) {
                this.enemies.push(
                    new Enemy(canvasW / 2, 100, words[i], 0, 0, 'boss_target'),
                );
            }
            this.activeEnemyIndex = 0;
            return;
        }

        const rawWords = text.split(' ');
        const canvasW = this.canvas.width / (window.devicePixelRatio || 1);

        let currentIndex = 0;
        rawWords.forEach((w, i) => {
            // Just the word itself, no appended spaces!
            const wordToType = w;
            const startIndex = currentIndex;

            // Stagger spawn positions
            const x = 100 + Math.random() * (canvasW - 200);
            const y = -50 - i * 120; // Spawn them above screen, spaced out

            // Speed based on word length and randomness
            const speed = 30 + Math.random() * 20;

            let type: 'kamikaze' | 'shooter' | 'scrambler' = 'kamikaze';
            if (this.currentLevel >= 2 && Math.random() < 0.3) {
                if (this.currentLevel === 3 && this.lockedWpm >= GAME_CONFIG.BOSS_WPM_THRESHOLD && Math.random() < 0.5) {
                    type = 'scrambler';
                } else {
                    type = 'shooter';
                }
            }

            this.pendingSpawnQueue.push({
                word: wordToType,
                startIndex: startIndex,
                type: type,
                speed: speed,
            });

            currentIndex += w.length + 1; // +1 for the space that follows
        });

        // Initial spawn happens immediately
        this.spawnTimer = 0;
    }

    private loop = (time: number) => {
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Cap dt to prevent huge jumps when switching tabs
        if (dt > 0.1) dt = 0.1;

        this.update(dt);
        this.draw();

        this.animationFrameId = requestAnimationFrame(this.loop);
    };

    private takeDamage(amount: number) {
        if (this.state !== 'PLAYING') return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.state = 'GAMEOVER';
            this.deathAnimationTimer = 3.0;

            const playerX = this.canvas.width / (window.devicePixelRatio || 1) / 2;
            const playerY = this.canvas.height / (window.devicePixelRatio || 1) - 100;
            this.explosions.push(new PlayerDeathExplosion(playerX, playerY));
        }
    }

    private update(dt: number) {
        const canvasH = this.canvas.height / (window.devicePixelRatio || 1);
        const playerX = this.canvas.width / (window.devicePixelRatio || 1) / 2;
        const playerY = canvasH - 150;

        this.starfieldOffset = (this.starfieldOffset + 50 * dt) % canvasH;

        // Determine target background colors based on currentLevel
        let isBossLevel = false;
        let isBonusLevel = false;
        if (this.lockedWpm < 70) {
            if (this.currentLevel >= 3) isBossLevel = true;
        } else {
            if (this.currentLevel === 3) isBonusLevel = true;
            if (this.currentLevel >= 4) isBossLevel = true;
        }

        let targetTopHex = '#000000';
        let targetBottomHex = '#000000';
        if (this.currentLevel === 1) {
            targetTopHex = '#050510';
            targetBottomHex = '#000000';
        } else if (this.currentLevel === 2) {
            targetTopHex = '#002244';
            targetBottomHex = '#000022';
        } else if (isBossLevel) {
            targetTopHex = '#000000';
            targetBottomHex = '#000000';
        } else if (isBonusLevel) {
            targetTopHex = '#003322';
            targetBottomHex = '#001111';
        }

        // Smoothly interpolate background colors
        const targetTopRgb = this.hexToRgb(targetTopHex);
        const targetBottomRgb = this.hexToRgb(targetBottomHex);
        const lerpSpeed = 0.5; // Slower color transition (was 2.0)

        this.currentBgTop.r +=
            (targetTopRgb.r - this.currentBgTop.r) * lerpSpeed * dt;
        this.currentBgTop.g +=
            (targetTopRgb.g - this.currentBgTop.g) * lerpSpeed * dt;
        this.currentBgTop.b +=
            (targetTopRgb.b - this.currentBgTop.b) * lerpSpeed * dt;

        this.currentBgBottom.r +=
            (targetBottomRgb.r - this.currentBgBottom.r) * lerpSpeed * dt;
        this.currentBgBottom.g +=
            (targetBottomRgb.g - this.currentBgBottom.g) * lerpSpeed * dt;
        this.currentBgBottom.b +=
            (targetBottomRgb.b - this.currentBgBottom.b) * lerpSpeed * dt;

        this.bossBgOpacity +=
            ((isBossLevel ? 1.0 : 0.0) - this.bossBgOpacity) * lerpSpeed * dt;

        if (this.scramblerTimer > 0) {
            this.scramblerTimer -= dt;
            if (this.scramblerTimer < 0) this.scramblerTimer = 0;
        }

        // Dynamic Rubber-Band Spawning Algorithm
        if (!this.isBossLevel && this.pendingSpawnQueue.length > 0) {
            const activeEnemiesCount = this.enemies.filter((e) => !e.isDead).length;
            const healthPercent = Math.max(0, this.health / GAME_CONFIG.PLAYER_MAX_HEALTH);
            const TARGET_DENSITY = 4 + (GAME_CONFIG.SPAWN_TARGET_DENSITY - 4) * healthPercent;

            // Hard Cap: If there are already too many enemies on screen based on the dynamic density limit, pause spawning!
            if (activeEnemiesCount < TARGET_DENSITY) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    const nextEnemy = this.pendingSpawnQueue.shift();
                    if (nextEnemy) {
                        const canvasW = this.canvas.width / (window.devicePixelRatio || 1);
                        const x = 100 + Math.random() * (canvasW - 200);
                        const y = -50; // Always spawn just above the screen

                        this.enemies.push(
                            new Enemy(
                                x,
                                y,
                                nextEnemy.word,
                                nextEnemy.speed,
                                nextEnemy.startIndex,
                                nextEnemy.type
                            )
                        );

                        // Calculate delay for the NEXT enemy
                        const BASE_DELAY = GAME_CONFIG.SPAWN_BASE_DELAY;
                        const MIN_DELAY = GAME_CONFIG.SPAWN_MIN_DELAY;

                        // Exponential curve: 1.5 ^ (count - target)
                        const calculatedDelay = BASE_DELAY * Math.pow(1.5, (activeEnemiesCount + 1) - TARGET_DENSITY);
                        this.spawnTimer = Math.max(MIN_DELAY, calculatedDelay);
                    }
                }
            }
        }

        if (this.state === 'WARPING') {
            // Exponential acceleration (ease-in) for warp entry
            this.currentWarpMultiplier += this.currentWarpMultiplier * 4 * dt;
            if (this.currentWarpMultiplier > 20.0) this.currentWarpMultiplier = 20.0;

            this.warpTimer -= dt;

            // Ship physically accelerates upward matching the warp speed
            this.shipVisualY -= 100 * this.currentWarpMultiplier * dt;

            if (this.warpTimer <= 0) {
                this.currentLevel++;
                this.state = 'PLAYING';
                this.shipVisualY = 300; // Snap to below screen to slide back up gracefully
                if (this.nextWaveText) {
                    this.spawnWave(this.nextWaveText);
                    this.nextWaveText = null;
                }
            }
        } else if (this.state === 'PLAYING') {
            this.currentWarpMultiplier += (1.0 - this.currentWarpMultiplier) * 2 * dt;
            // Lerp back to normal position (0)
            if (this.shipVisualY > 0) {
                this.shipVisualY += (0 - this.shipVisualY) * 5 * dt;
                if (this.shipVisualY < 1) this.shipVisualY = 0;
            }

            // Smoothly lerp text scroll offset
            if (this.textScrollOffset > 0) {
                this.textScrollOffset += (0 - this.textScrollOffset) * 15 * dt;
                if (this.textScrollOffset < 0.5) this.textScrollOffset = 0;
            }

            // Calculate real-time WPM (smooth speedometer)
            if (this.levelStartTime > 0) {
                // If we finished typing, stop the clock so WPM doesn't plummet during death animations
                if (this.globalTypedText.length >= this.currentStoryText.length) {
                    if (this.levelEndTime === 0) {
                        this.levelEndTime = performance.now();
                        const timeElapsedMins =
                            (this.levelEndTime - this.levelStartTime) / 60000;
                        const wordsTyped = this.globalTypedText.length / 5;
                        this.displayWpm =
                            timeElapsedMins > 0 ? wordsTyped / timeElapsedMins : 0;
                    }
                } else {
                    const timeElapsedMins =
                        (performance.now() - this.levelStartTime) / 60000;
                    // Wait 3 seconds to avoid massive start-up spikes on the first few keystrokes
                    if (timeElapsedMins > 0.05) {
                        const wordsTyped = this.globalTypedText.length / 5;
                        const rawWpm = wordsTyped / timeElapsedMins;
                        this.displayWpm += (rawWpm - this.displayWpm) * 5 * dt;
                    }
                }
            }
        }

        if (this.state === 'GAMEOVER') {
            if (this.deathAnimationTimer > 0) {
                this.deathAnimationTimer -= dt;
            }
            if (this.deathAnimationTimer <= 0) {
                if (this.onDefeat && !this.defeatFired) {
                    this.defeatFired = true;
                    const onDefeatCallback = this.onDefeat;

                    const terminalErrors = `
---
> CRITICAL: SHIELD INTEGRITY AT 0%
> BLACK BOX RECORDING ENDED
---`;

                    let pastStory = this.fullStoryHistory;
                    if (pastStory.endsWith(this.currentStoryText)) {
                        pastStory = pastStory.substring(
                            0,
                            pastStory.length - this.currentStoryText.length,
                        );
                    }
                    
                    const wordsTyped = Math.floor((this.cumulativeTypedChars + this.globalTypedText.length) / 5);

                    onDefeatCallback({
                        wpm: Math.round(this.displayWpm),
                        wordsTyped: wordsTyped,
                        maxCombo: this.maxCombo,
                        story: (
                            pastStory.trim() +
                            (this.globalTypedText.trim() ? '\n' + this.globalTypedText.trim() : '') +
                            '\n\n' +
                            terminalErrors.trim()
                        ).trim(),
                        levelNum: this.currentLevel,
                        lockedWpm: this.lockedWpm,
                        storySoFar: this.fullStoryHistory,
                        waveText: this.currentStoryText,
                        selectedGenre: this.selectedGenre,
                    });
                }
            }

            // Update explosions
            this.explosions = this.explosions.filter((exp) => {
                exp.update(dt);
                return !exp.isDead;
            });

            // Let enemies and leeches detach and fly downwards or outwards
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.update(dt, playerX, playerY, true);

                // Remove if they fly off any edge of the screen
                if (
                    e.y > canvasH + 100 ||
                    e.x < -100 ||
                    e.x > this.canvas.width + 100
                ) {
                    this.enemies.splice(i, 1);
                }
            }

            // Let lasers continue flying
            for (let i = this.lasers.length - 1; i >= 0; i--) {
                const l = this.lasers[i];
                l.update(dt);
                if (l.hasHit || l.y < -100) this.lasers.splice(i, 1);
            }

            // Let Boss keep animating
            if (this.boss && !this.boss.isDead) {
                this.boss.update(dt, this.bossBullets, this.enemies);
            }

            for (let i = this.bossBullets.length - 1; i >= 0; i--) {
                const b = this.bossBullets[i];
                b.update(dt);
                if (
                    b.y > canvasH + 100 ||
                    b.x < -100 ||
                    b.x > this.canvas.width + 100
                ) {
                    this.bossBullets.splice(i, 1);
                }
            }

            return; // Skip combat logic
        }

        // Regenerate shields if no damage taken recently (5 seconds)
        if (this.health < GAME_CONFIG.PLAYER_MAX_HEALTH) {
            this.timeSinceLastDamage += dt;
            if (this.timeSinceLastDamage >= GAME_CONFIG.SHIELD_REGEN_DELAY) {
                this.health = Math.min(
                    GAME_CONFIG.PLAYER_MAX_HEALTH,
                    this.health + GAME_CONFIG.SHIELD_REGEN_RATE * dt,
                );
            }
        }

        if (this.activeEnemyIndex < this.enemies.length && this.state === 'PLAYING') {
            const activeEnemy = this.enemies[this.activeEnemyIndex];

            if (activeEnemy.typedChars > 0) {
                const targetAngle = Math.atan2(activeEnemy.y - playerY, activeEnemy.x - playerX) + Math.PI / 2; // +90 deg offset
                // Simple Lerp (Linear Interpolation)
                this.playerAngle += (targetAngle - this.playerAngle) * 10 * dt;
            } else {
                // Return to neutral forward if they haven't started typing yet
                this.playerAngle += (0 - this.playerAngle) * 5 * dt;
            }
        } else {
            // Reset to forward
            this.playerAngle += (0 - this.playerAngle) * 5 * dt;
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];

            // Do not update or process enemies that are already dead
            if (e.isDead) continue;

            // Leech Mechanic: If already attached to shield from a PREVIOUS frame, drain health continuously
            // This is checked BEFORE e.update() so the collision frame itself deals no burst damage.
            if (e.hitShield && !e.isDead) {
                this.health = Math.max(0, this.health - GAME_CONFIG.ENEMY_KAMIKAZE_DAMAGE_RATE * dt);
                this.timeSinceLastDamage = 0; // Prevent shield regeneration while being leeched

                // Spawn tiny damage sparks randomly
                if (Math.random() < 0.1) {
                    this.explosions.push(
                        new Explosion(
                            e.x + (Math.random() - 0.5) * 10,
                            e.y + (Math.random() - 0.5) * 10,
                            '#ff0055',
                            10,
                        ),
                    );
                }
            }

            e.update(dt, playerX, playerY);

            // Handle ShooterEnemy hits
            if (e.type === 'shooter' && (e as any).hasFiredCharge) {
                (e as any).hasFiredCharge = false;

                if (this.deflectorActiveTime > 0) {
                    this.explosions.push(
                        new Explosion(playerX, playerY - 30, '#00ffcc', 15),
                    );
                } else {
                    this.takeDamage(GAME_CONFIG.ENEMY_SHOOTER_DAMAGE);
                    this.explosions.push(
                        new Explosion(playerX, playerY - 30, '#ff0055', 20),
                    );
                    this.timeSinceLastDamage = 0;
                }
            } else if (e.type === 'scrambler' && (e as any).hasFiredCharge) {
                (e as any).hasFiredCharge = false;

                // No health damage, just a visual scramble
                this.scramblerTimer = GAME_CONFIG.ENEMY_SCRAMBLER_DURATION;
                this.explosions.push(
                    new Explosion(playerX, playerY - 30, '#ffff00', 20),
                );
            }
        }

        // Check for GAMEOVER after all enemy processing
        if (this.health <= 0 && this.state !== 'GAMEOVER') {
            this.takeDamage(0); // Trigger the centralized death sequence
        }

        // Update lasers
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];
            l.update(dt);

            // Dynamic collision with boss so lasers don't fly through it while it strafes
            let hitBoss = false;
            if (this.isBossLevel && this.boss && !this.boss.isDead) {
                const distToBoss = Math.hypot(l.x - this.boss.x, l.y - this.boss.y);
                if (distToBoss < this.boss.hitRadius) {
                    // Dynamic hit radius per boss
                    hitBoss = true;
                }
            }

            if (l.hasHit || l.y < -100 || hitBoss) {
                this.lasers.splice(i, 1);
            }
        }

        // Deflector timers
        if (this.deflectorActiveTime > 0) {
            this.deflectorActiveTime -= dt;
            if (this.deflectorActiveTime <= 0) {
                this.deflectorActiveTime = 0;
                this.deflectorCharge = 0; // Reset charge when active time finishes
            }
        }

        // Update Boss
        if (this.boss && !this.boss.isDead) {
            this.boss.update(dt, this.bossBullets, this.enemies);
        }

        // Check boss bullet collisions and BioBoss Beam
        if (this.boss) {
            // Boss Beam Check (Damage over time while firing)
            if (this.boss.isFiringLaser) {
                // If deflector is active, it blocks the beam completely!
                if (this.deflectorActiveTime > 0) {
                    // Spawn cyan sparks as it vaporizes the beam
                    if (Math.random() < 0.3) {
                        this.explosions.push(
                            new Explosion(playerX, playerY - 40, '#00ffcc', 10),
                        );
                    }
                } else {
                    const damagePerSecond = this.boss instanceof BioBoss ? GAME_CONFIG.BOSS_BIO_BEAM_DAMAGE_RATE : GAME_CONFIG.BOSS_DREADNOUGHT_BEAM_DAMAGE_RATE;
                    this.takeDamage(damagePerSecond * dt);
                    this.timeSinceLastDamage = 0;
                    if (Math.random() < 0.2) {
                        this.explosions.push(
                            new Explosion(playerX, playerY - 20, '#ff0055', 15), // Less dense explosion spam
                        );
                    }
                }
            }
        }

        for (let i = this.bossBullets.length - 1; i >= 0; i--) {
            const b = this.bossBullets[i];
            b.update(dt);

            if (this.state === 'PLAYING') {
                const dx = playerX - b.x;
                const dy = playerY - b.y;
                const dist = Math.hypot(dx, dy);

                // Deflector shield is larger than the normal health shield
                const activeRadius = this.deflectorActiveTime > 0 ? GAME_CONFIG.PLAYER_DEFLECTOR_RADIUS : GAME_CONFIG.PLAYER_SHIELD_RADIUS;

                if (dist < activeRadius) {
                    b.hasHit = true;
                    // Deflector active: vaporize with no damage
                    if (this.deflectorActiveTime > 0) {
                        this.explosions.push(new Explosion(b.x, b.y, '#00ffcc', 12));
                    } else {
                        // Normal shield: absorb hit but take damage
                        const damage = this.boss instanceof DreadnoughtBoss ? GAME_CONFIG.BOSS_DREADNOUGHT_BULLET_DAMAGE : GAME_CONFIG.BOSS_BIO_BULLET_DAMAGE;
                        this.takeDamage(damage);
                        this.explosions.push(new Explosion(b.x, b.y, '#ff0055', 15));
                        this.timeSinceLastDamage = 0;
                    }
                    this.bossBullets.splice(i, 1); // Remove the bullet upon impact
                }
            }

            if (b.y > canvasH + 100 || b.x < -100 || b.x > this.canvas.width + 100) {
                this.bossBullets.splice(i, 1);
            }
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.update(dt);
            if (exp.isDead) this.explosions.splice(i, 1);
        }
    }

    private draw() {
        // 1. Clear background
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // 2. Draw 2D Scrolling Starfield (Background gradient + stars)
        this.drawStarfield(width, height);

        // 3. Draw Lasers
        for (const l of this.lasers) l.draw(this.ctx);

        // 4. Draw Boss & Bullets (Behind text)
        // Keep drawing the boss even if it's dead, AS LONG AS the death animation (deathBlossomActive) is still playing
        if (this.boss && (!this.boss.isDead || this.deathBlossomActive)) {
            this.boss.draw(this.ctx);
        }
        for (const b of this.bossBullets) {
            b.draw(this.ctx);
        }

        // 4.5. Draw Enemies (Words & Ships)
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isDead) {
                // If it's a boss level, only draw the current active word to prevent them overlapping in the center
                if (this.isBossLevel && i !== this.activeEnemyIndex) continue;

                // For Boss level, tie the word's position to the boss!
                if (this.isBossLevel && this.boss) {
                    e.x = this.boss.x;
                    e.y = this.boss.y - 140; // Push text much higher so tentacles don't obscure it
                }

                e.draw(
                    this.ctx,
                    i === this.activeEnemyIndex,
                    this.state === 'GAMEOVER',
                );
            }
        }

        // 4.6. Draw Explosions
        for (const exp of this.explosions) exp.draw(this.ctx);

        // If victory, skip drawing ship and HUD
        if (this.state === 'VICTORY') return;

        // 5. Draw Player Ship (Center Bottom)
        this.drawPlayer(width, height);

        // 6. Draw HUD (Text box, Health, Combo)
        this.drawHUD(width, height);
    }

    private drawStarfield(w: number, h: number) {
        // Calculate boolean conditions for drawing stars/abyss
        let isBossLevel = false;
        let isBonusLevel = false;
        if (this.lockedWpm < 70) {
            if (this.currentLevel >= 3) isBossLevel = true;
        } else {
            if (this.currentLevel === 3) isBonusLevel = true;
            if (this.currentLevel >= 4) isBossLevel = true;
        }

        // Convert smoothed RGB back to string for drawing
        const bgTop = `rgb(${Math.floor(this.currentBgTop.r)}, ${Math.floor(this.currentBgTop.g)}, ${Math.floor(this.currentBgTop.b)})`;
        const bgBottom = `rgb(${Math.floor(this.currentBgBottom.r)}, ${Math.floor(this.currentBgBottom.g)}, ${Math.floor(this.currentBgBottom.b)})`;

        // Draw gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, bgTop);
        gradient.addColorStop(1, bgBottom);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, w, h);

        if (this.bossBgOpacity > 0.01) {
            // Serious, professional Abyssal Void aesthetic
            this.ctx.save();
            this.ctx.translate(w / 2, h / 2 - 100);

            // 1. Draw a massive, subtle deep space anomaly (Event Horizon)
            this.ctx.globalAlpha = this.bossBgOpacity;
            const pulse = Math.sin(performance.now() / 1200) * 40;

            const voidGrad = this.ctx.createRadialGradient(
                0,
                0,
                100 + pulse / 2,
                0,
                0,
                700 + pulse,
            );
            voidGrad.addColorStop(0, '#000000'); // Pure black singularity
            voidGrad.addColorStop(0.2, '#3d007a'); // Distinct, eerie deep purple edge
            voidGrad.addColorStop(0.6, 'rgba(30, 0, 60, 0.2)'); // Smooth decay
            voidGrad.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fades smoothly into the black void

            this.ctx.fillStyle = voidGrad;
            // Draw a large rectangle to fill the gradient area
            this.ctx.fillRect(-1000, -1000, 2000, 2000);
            this.ctx.globalAlpha = 1.0; // Reset for ripples

            // 1.5. Draw Gravitational Ripples (expanding concentric circles)
            const time = performance.now();
            this.ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                // Expanding rings: slow expansion, loops every ~1000 radius
                const radius = (time / 20 + i * 250) % 1000;
                // Ripples start at the event horizon (~100px) and fade out as they expand
                if (radius > 100) {
                    const alpha =
                        Math.max(0, 0.2 * (1 - radius / 1000)) * this.bossBgOpacity;
                    this.ctx.beginPath();
                    // Subtle deep purple ripples
                    this.ctx.strokeStyle = `rgba(130, 0, 255, ${alpha})`;
                    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }

            // 2. Draw the stars, but instead of scrolling down, they slowly orbit the singularity
            this.ctx.rotate(performance.now() / 8000); // Faster, visibly eerie rotation
            this.ctx.fillStyle = '#dfbfff'; // Brighter, desaturated purple tint for the stars

            for (const star of this.stars) {
                // Calculate distance to the singularity center (which is 1500, 1000 in our relative starfield box)
                const dx = 1500 - star.x;
                const dy = 1000 - star.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // ACCRETION VORTEX: Actively pull stars inward toward the center
                if (dist > 20) {
                    // Pull strength increases slightly as it gets closer, but uses base speed
                    const pullFactor = Math.max(0.2, 500 / dist);
                    star.x += (dx / dist) * star.speed * pullFactor;
                    star.y += (dy / dist) * star.speed * pullFactor;
                } else {
                    // If consumed by the singularity, respawn at the far edges to feed the vortex
                    const angle = Math.random() * Math.PI * 2;
                    star.x = 1500 + Math.cos(angle) * 1500;
                    star.y = 1000 + Math.sin(angle) * 1500;
                }

                // The stars are distributed over 3000x2000, so we shift them to center around the anomaly
                // Brighter stars for the void, and they get even brighter as they get crushed into the center
                this.ctx.globalAlpha =
                    Math.min(1, (star.size / 4) * 0.8 + 100 / Math.max(1, dist)) *
                    this.bossBgOpacity;
                // Draw stars as stretched lines to simulate high-velocity spiraling
                const stretch = Math.max(2, 50 / Math.max(1, dist));
                this.ctx.fillRect(star.x - 1500, star.y - 1000, stretch, stretch);
            }
            this.ctx.restore();
        }

        if (this.bossBgOpacity < 0.99) {
            this.ctx.fillStyle = isBossLevel
                ? '#ffaa00'
                : isBonusLevel
                    ? '#00ffff'
                    : '#ffffff';

            for (const star of this.stars) {
                const currentSpeed = star.speed * this.currentWarpMultiplier;
                // Only move downwards if we aren't fully in boss level (boss level orbits instead)
                if (!isBossLevel) {
                    star.y += currentSpeed;
                }

                // Wrap stars around the massive 3000x2000 virtual space so they are always uniform for the boss fight
                if (star.y > 2000) {
                    star.y = 0;
                    star.x = Math.random() * 3000;
                }

                this.ctx.globalAlpha = (star.size / 4) * (1.0 - this.bossBgOpacity);
                const stretch = Math.max(2, this.currentWarpMultiplier);
                this.ctx.fillRect(star.x, star.y, star.size, star.size * stretch);
            }
        }
        this.ctx.globalAlpha = 1;
    }

    private drawPlayer(w: number, h: number) {
        this.ctx.save();
        this.ctx.translate(w / 2, h - 150);

        // Critical Health VFX
        if (this.health <= 25 && this.state !== 'GAMEOVER') {
            // Glitchy, trembling shield sphere
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 75 + Math.random() * 5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 0, 85, ${0.1 + Math.random() * 0.2})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(255, 0, 85, ${0.4 + Math.random() * 0.4})`;
            this.ctx.lineWidth = 2 + Math.random() * 3;
            this.ctx.stroke();

            // Add screen vignette
            this.ctx.restore(); // Pop back to global coords
            this.ctx.save();
            const gradient = this.ctx.createRadialGradient(
                w / 2,
                h / 2,
                h / 4,
                w / 2,
                h / 2,
                Math.max(w, h),
            );
            gradient.addColorStop(0, 'rgba(255,0,0,0)');
            gradient.addColorStop(
                1,
                `rgba(255, 0, 85, ${0.1 + Math.random() * 0.15})`,
            );
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, w, h);
            this.ctx.restore();

            // Go back into player matrix
            this.ctx.save();
            this.ctx.translate(w / 2, h - 150);
        }

        // Rotate player ship
        this.ctx.rotate(this.playerAngle);

        // Draw animated thruster flames for the player ship
        if (this.state === 'PLAYING' || this.state === 'MENU') {
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'screen';

            // Shared gradient for both thrusters
            const thrusterGrad = this.ctx.createLinearGradient(0, 50, 0, 100);
            thrusterGrad.addColorStop(0, '#ffffff'); // White hot core
            thrusterGrad.addColorStop(0.4, '#00ffff'); // Cyan plasma
            thrusterGrad.addColorStop(1, 'rgba(0, 255, 255, 0)'); // Fade to transparent

            this.ctx.fillStyle = thrusterGrad;

            // Left Thruster
            this.ctx.beginPath();
            this.ctx.moveTo(-18, 50);
            this.ctx.lineTo(-25, 75 + Math.random() * 25);
            this.ctx.lineTo(-12, 50);
            this.ctx.closePath();
            this.ctx.fill();

            // Right Thruster
            this.ctx.beginPath();
            this.ctx.moveTo(18, 50);
            this.ctx.lineTo(25, 75 + Math.random() * 25);
            this.ctx.lineTo(12, 50);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.restore();
        }

        if (this.state !== 'GAMEOVER') {
            if (this.playerSprite.complete && this.playerSprite.naturalWidth > 0) {
                // Use screen blend mode to make the pure black background invisible
                // while making the neon cyan/blue glowing accents pop!
                this.ctx.globalCompositeOperation = 'screen';
                const size = 150;
                this.ctx.drawImage(this.playerSprite, -size / 2, -size / 2, size, size);
            } else {
                // Fallback while loading
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#00ffcc';
                this.ctx.beginPath();
                this.ctx.moveTo(0, -20);
                this.ctx.lineTo(15, 20);
                this.ctx.lineTo(-15, 20);
                this.ctx.closePath();
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fill();
            }
        }

        // Health-Based Shield Ring (always visible, scales with health)
        if (this.health > 0 && this.state !== 'GAMEOVER') {
            this.ctx.globalCompositeOperation = 'source-over';
            const healthPercent = this.health / GAME_CONFIG.PLAYER_MAX_HEALTH;

            // Color shifts: Cyan (100%) -> Yellow (50%) -> Orange (25%)
            let r: number, g: number, b: number;
            if (healthPercent > 0.5) {
                // Cyan to Yellow
                const t = (healthPercent - 0.5) / 0.5;
                r = Math.round(255 * (1 - t));
                g = 255;
                b = Math.round(204 * t);
            } else {
                // Yellow to Orange
                const t = healthPercent / 0.5;
                r = 255;
                g = Math.round(255 * t);
                b = 0;
            }

            // Line width scales from 5px (full) to 1px (critical)
            const lineW = 1 + 4 * healthPercent;
            const alpha = 0.3 + 0.5 * healthPercent;

            this.ctx.beginPath();
            this.ctx.arc(0, 0, 80, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            this.ctx.lineWidth = lineW;
            this.ctx.shadowBlur = 10 * healthPercent;
            this.ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
            this.ctx.stroke();
        }

        // Deflector Shield Aura (Overcharge ability - temporary, much larger than health shield)
        if (this.deflectorActiveTime > 0) {
            this.ctx.globalCompositeOperation = 'screen';

            // Pulsing outer ring at 110px
            const pulse = 20 + Math.sin(Date.now() / 80) * 15;
            this.ctx.shadowBlur = pulse;
            this.ctx.shadowColor = '#00ffcc';

            // Outer ring - thick and bright
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 110, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(0, 255, 204, ${0.6 + Math.sin(Date.now() / 120) * 0.3})`;
            this.ctx.lineWidth = 4;
            this.ctx.stroke();

            // Inner filled glow
            const deflectorGrad = this.ctx.createRadialGradient(0, 0, 60, 0, 0, 110);
            deflectorGrad.addColorStop(0, 'rgba(0, 255, 204, 0.0)');
            deflectorGrad.addColorStop(0.5, 'rgba(0, 255, 204, 0.08)');
            deflectorGrad.addColorStop(1, 'rgba(0, 255, 204, 0.2)');
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 110, 0, Math.PI * 2);
            this.ctx.fillStyle = deflectorGrad;
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    private drawHUD(w: number, h: number) {
        if (this.state === 'BRANCHING') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, w, h);

            this.ctx.textAlign = 'center';

            // Draw End-of-Level Metrics (Skip on the initial Level 1 start screen)
            if (this.currentLevel > 0) {
                const wordsTyped = Math.round(this.globalTypedText.length / 5);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '24px monospace';
                this.ctx.fillText(`WPM: ${Math.round(this.displayWpm)}      WORDS TYPED: ${wordsTyped}      MAX COMBO: ${this.maxCombo}`, w / 2, h / 3 - 90);
            }

            this.ctx.fillStyle = '#00ffcc';
            this.ctx.font = '30px monospace';
            this.ctx.fillText('INCOMING TRANSMISSIONS...', w / 2, h / 3);

            if (this.pendingBranches) {
                this.ctx.font = '20px monospace';
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText('TYPE 1, 2, OR 3 TO SELECT PATH', w / 2, h / 3 + 50);

                this.pendingBranches.forEach((branch, i) => {
                    const y = h / 2 - 40 + i * 110; // Increased spacing for the title

                    // Render the Genre/Archetype Title
                    if (this.currentBranchTitles && this.currentBranchTitles[i]) {
                        this.ctx.fillStyle = '#ffaa00'; // Orange for title
                        this.ctx.font = 'bold 22px monospace';
                        this.ctx.fillText(`${i + 1}) ${this.currentBranchTitles[i]}`, w / 2, y - 25);
                    }

                    // Render the Action Summary
                    this.ctx.fillStyle = '#00ffcc';
                    this.ctx.font = '22px monospace';

                    // Simple word wrapping for branch text
                    const words = branch.action_summary.split(' ');
                    let line = '';
                    let currentY = y;
                    for (const word of words) {
                        const testLine = line + word + ' ';
                        if (this.ctx.measureText(testLine).width > w - 100) {
                            this.ctx.fillText(line, w / 2, currentY);
                            line = word + ' ';
                            currentY += 30;
                        } else {
                            line = testLine;
                        }
                    }
                    this.ctx.fillText(line, w / 2, currentY);
                });
            } else {
                this.ctx.font = '20px monospace';
                this.ctx.fillStyle = '#888888';
                this.ctx.fillText('DECRYPTING DATA...', w / 2, h / 2);
            }
            return;
        }

        // Calculate progress percentage
        const progress =
            this.currentStoryText.length > 0
                ? this.globalTypedText.length / this.currentStoryText.length
                : 0;

        // Draw Story Text Box Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(w / 2 - 400, h - 100, 800, 80);

        // Draw Progress Fill inside the Text Box
        if (progress > 0) {
            this.ctx.fillStyle = 'rgba(0, 255, 204, 0.35)'; // Brighter semi-transparent cyan
            this.ctx.fillRect(w / 2 - 400, h - 100, 800 * progress, 80);
        }

        // Draw Border
        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.strokeRect(w / 2 - 400, h - 100, 800, 80);

        this.ctx.font = '24px monospace';
        this.ctx.textAlign = 'left';

        // Word wrap into lines with start/end indices
        const words = this.currentStoryText.split(' ');
        const lines: { text: string; startIdx: number; endIdx: number }[] = [];
        let currentLine = '';
        let startIdx = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const separator = currentLine ? ' ' : '';
            const testLine = currentLine + separator + word;

            if (this.ctx.measureText(testLine).width > 760 && currentLine !== '') {
                lines.push({
                    text: currentLine,
                    startIdx: startIdx,
                    endIdx: startIdx + currentLine.length,
                });
                startIdx += currentLine.length + 1; // +1 for the space
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push({
                text: currentLine,
                startIdx: startIdx,
                endIdx: startIdx + currentLine.length,
            });
        }

        const typedLen = this.globalTypedText.length;
        let activeLineIdx = 0;
        for (let i = 0; i < lines.length; i++) {
            if (typedLen >= lines[i].startIdx && typedLen <= lines[i].endIdx) {
                activeLineIdx = i;
                break;
            }
        }

        // Animate scrolling if we moved to a new line
        if (activeLineIdx > this.previousLineIdx) {
            this.textScrollOffset += (activeLineIdx - this.previousLineIdx) * 30;
            this.previousLineIdx = activeLineIdx;
        } else if (activeLineIdx < this.previousLineIdx) {
            this.previousLineIdx = activeLineIdx;
        }

        // Render up to 2 lines
        const linesToRender = [];
        if (lines[activeLineIdx]) linesToRender.push(lines[activeLineIdx]);
        if (activeLineIdx + 1 < lines.length)
            linesToRender.push(lines[activeLineIdx + 1]);

        linesToRender.forEach((line, idx) => {
            const lineY = h - 65 + idx * 30 + this.textScrollOffset;

            let typedInLine = '';
            let untypedInLine = line.text;

            if (typedLen >= line.endIdx) {
                typedInLine = line.text;
                untypedInLine = '';
            } else if (typedLen > line.startIdx) {
                const localTypedLen = typedLen - line.startIdx;
                typedInLine = line.text.substring(0, localTypedLen);
                untypedInLine = line.text.substring(localTypedLen);
            }

            // Apply scrambler glitch effect visually
            if (this.scramblerTimer > 0) {
                const symbols = '$#@%&*!~?><';
                let scrambled = '';
                for (let i = 0; i < untypedInLine.length; i++) {
                    if (untypedInLine[i] === ' ') {
                        scrambled += ' ';
                    } else {
                        scrambled += symbols[Math.floor(Math.random() * symbols.length)];
                    }
                }
                untypedInLine = scrambled;
            }

            const startX = w / 2 - 380; // Left-aligned in the box with 20px padding

            // Draw typed
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.fillText(typedInLine, startX, lineY);

            // Draw untyped
            const typedWidth = this.ctx.measureText(typedInLine).width;
            this.ctx.fillStyle = this.scramblerTimer > 0 ? '#ffff00' : '#aaaaaa';
            this.ctx.fillText(untypedInLine, startX + typedWidth, lineY);

            // Draw cursor if this is the active line
            if (
                idx === 0 &&
                typedLen <= line.endIdx &&
                typedLen < this.currentStoryText.length
            ) {
                let activeChar = ' ';
                if (typedLen < line.endIdx) {
                    activeChar = line.text[typedLen - line.startIdx];
                }

                const charWidth =
                    this.ctx.measureText(activeChar).width ||
                    this.ctx.measureText(' ').width;

                this.ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
                this.ctx.fillRect(startX + typedWidth, lineY - 20, charWidth, 25);

                if (activeChar === ' ') {
                    this.ctx.fillStyle = '#00ffcc';
                    this.ctx.fillRect(startX + typedWidth, lineY + 2, charWidth, 3);
                }
            }
        });

        // Draw Level Indicator
        if (this.state !== 'MENU') {
            let levelText = `LEVEL ${Math.max(1, this.currentLevel)}`;
            if (this.currentLevel > 1 && this.lockedWpm < 70) {
                if (this.currentLevel >= 3) levelText = 'BOSS';
            } else {
                if (this.currentLevel >= 4) levelText = 'BOSS';
            }

            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 32px monospace';

            // Give the text a thick black outline so it violently pops out over the boss tentacles
            this.ctx.lineWidth = 6;
            this.ctx.strokeStyle = '#000000';
            this.ctx.strokeText(levelText, w / 2, 40);

            this.ctx.fillStyle = levelText === 'BOSS' ? '#ffaa00' : '#ffffff';
            this.ctx.fillText(levelText, w / 2, 40);
        }

        // Draw WPM
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#00ffcc'; // Cyan
        this.ctx.font = 'bold 24px monospace';
        this.ctx.fillText(`WPM: ${Math.round(this.displayWpm)}`, 30, 40);

        // Draw Combo
        this.ctx.fillStyle = '#ff0055'; // Neon Pink/Red
        this.ctx.font = 'bold 20px monospace';
        this.ctx.fillText(`COMBO x${this.combo}`, 30, 70);

        // Draw Health
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`SHIELD: ${Math.round(this.health)}%`, w - 230, 40);

        // Draw Health Bar
        const barWidth = 200;
        const barHeight = 15;
        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.strokeRect(w - 230, 50, barWidth, barHeight);

        const healthPercent = Math.max(
            0,
            this.health / GAME_CONFIG.PLAYER_MAX_HEALTH,
        );
        this.ctx.fillStyle = this.health > 25 ? '#00ffcc' : '#ff0055'; // Turns red if critical
        this.ctx.fillRect(
            w - 230 + 2,
            52,
            (barWidth - 4) * healthPercent,
            barHeight - 4,
        );

        // Draw Deflector Bar if in boss level
        if (this.isBossLevel) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 20px monospace';
            let deflectorText = `DEFLECTOR: ${Math.round(this.deflectorCharge * 100)}%`;
            if (this.deflectorActiveTime > 0)
                deflectorText = `ACTIVE: ${this.deflectorActiveTime.toFixed(1)}s`;

            this.ctx.fillText(deflectorText, w - 230, 95);

            this.ctx.strokeStyle = '#ffffff';
            this.ctx.strokeRect(w - 230, 105, barWidth, 10);

            if (this.deflectorActiveTime > 0) {
                this.ctx.fillStyle = '#00ffff'; // Shrinking cyan bar for active
                this.ctx.fillRect(
                    w - 230 + 1,
                    106,
                    (barWidth - 2) * (this.deflectorActiveTime / 5),
                    8,
                );
            } else {
                this.ctx.fillStyle = '#00ffff'; // Growing cyan bar for charge
                this.ctx.fillRect(
                    w - 230 + 1,
                    106,
                    (barWidth - 2) * this.deflectorCharge,
                    8,
                );
            }
        }
    }
}
