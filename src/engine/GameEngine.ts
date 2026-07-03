import { GAME_CONFIG } from '../gameConfig';
import { Enemy, Laser, Explosion, PlayerDeathExplosion } from './Entities';

export type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

export class GameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private animationFrameId: number = 0;
    private lastTime: number = 0;
    
    // Game State
    public state: GameState = 'MENU';
    public currentStoryText: string = "AstroType Core Online. Press SPACE to begin.";
    public typedText: string = "";
    public combo: number = 0;
    public health: number = GAME_CONFIG.player.maxHealth;

    // Combat Entities
    private enemies: Enemy[] = [];
    private lasers: Laser[] = [];
    private explosions: (Explosion | PlayerDeathExplosion)[] = [];
    private activeEnemyIndex: number = 0;
    private playerAngle: number = 0;
    private timeSinceLastDamage: number = 0;
    private starfieldOffset: number = 0;
    
    // Original story text to show in HUD
    public globalTypedText: string = "";

    private playerSprite: HTMLImageElement;
    private stars: {x: number, y: number, speed: number, size: number}[] = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get 2D context");
        this.ctx = ctx;
        
        this.playerSprite = new Image();
        this.playerSprite.src = '/player_ship.png';

        // Initialize starfield (Slower, less busy for combat readability)
        for(let i=0; i<75; i++) {
            this.stars.push({
                x: Math.random() * 3000,
                y: Math.random() * 2000,
                speed: Math.random() * 3 + 0.5, // Slow, peaceful cruising speed
                size: Math.random() * 2 + 0.5
            });
        }

        // Handle window resizing
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
    }

    private handleResize = () => {
        // High DPI canvas scaling
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 800, height: 600 };
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
    }

    public start() {
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    public stop() {
        cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this.handleResize);
    }

    public handleInput(key: string) {
        if (this.state === 'MENU' && key === ' ') {
            this.state = 'PLAYING';
            this.spawnWave("Sensors detect incoming hostile anomalies.");
            return;
        }

        if (this.state !== 'PLAYING') return;
        if (key.length > 1) return; // Skip non-character keys
        
        // Check global string progression
        if (this.globalTypedText.length >= this.currentStoryText.length) return;
        
        const targetChar = this.currentStoryText[this.globalTypedText.length];
        
        if (key === targetChar) {
            this.globalTypedText += key;
            this.combo++;
            
            // If the key is not a space, it must belong to the active enemy
            if (key !== ' ') {
                if (this.activeEnemyIndex < this.enemies.length) {
                    const activeEnemy = this.enemies[this.activeEnemyIndex];
                    activeEnemy.typedChars++;
                    
                    // Spawn a laser from player ship to the enemy
                    const canvasW = this.canvas.width / (window.devicePixelRatio || 1);
                    const canvasH = this.canvas.height / (window.devicePixelRatio || 1);
                    this.lasers.push(new Laser(canvasW / 2, canvasH - 150, activeEnemy.x, activeEnemy.y));
                    
                    // If finished typing the word
                    if (activeEnemy.typedChars === activeEnemy.word.length) {
                        activeEnemy.isDead = true; 
                        this.explosions.push(new Explosion(activeEnemy.x, activeEnemy.y, '#00ffcc', 30)); // Cyan explosion!
                        this.activeEnemyIndex++;
                        
                        if (this.activeEnemyIndex >= this.enemies.length) {
                            // Wave cleared (will be handled by async fetch later)
                        }
                    }
                }
            }
        } else {
            // Typo
            this.combo = 0;
        }
    }

    private spawnWave(text: string) {
        this.currentStoryText = text;
        this.globalTypedText = "";
        this.enemies = [];
        this.lasers = [];
        this.explosions = [];
        this.activeEnemyIndex = 0;
        
        const rawWords = text.split(' ');
        const canvasW = this.canvas.width / (window.devicePixelRatio || 1);

        let currentIndex = 0;
        rawWords.forEach((w, i) => {
            // Just the word itself, no appended spaces!
            const wordToType = w;
            const startIndex = currentIndex;
            
            // Stagger spawn positions
            const x = 100 + Math.random() * (canvasW - 200);
            const y = -50 - (i * 120); // Spawn them above screen, spaced out
            
            // Speed based on word length and randomness
            const speed = 30 + Math.random() * 20;
            
            this.enemies.push(new Enemy(x, y, wordToType, speed, startIndex));
            
            currentIndex += w.length + 1; // +1 for the space that follows
        });
    }

    private loop = (time: number) => {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.update(dt);
        this.draw();

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    private update(dt: number) {
        const canvasH = this.canvas.height / (window.devicePixelRatio || 1);
        const playerX = this.canvas.width / (window.devicePixelRatio || 1) / 2;
        const playerY = canvasH - 150;

        this.starfieldOffset = (this.starfieldOffset + 50 * dt) % canvasH;

        if (this.state === 'GAMEOVER') {
            // Update explosions
            this.explosions = this.explosions.filter(exp => {
                exp.update(dt);
                return !exp.isDead;
            });
            
            // Let enemies and leeches detach and fly downwards or outwards
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.update(dt, playerX, playerY, true);
                
                // Remove if they fly off any edge of the screen
                if (e.y > canvasH + 100 || e.x < -100 || e.x > this.canvas.width + 100) {
                    this.enemies.splice(i, 1);
                }
            }
            
            // Let lasers continue flying
            for (let i = this.lasers.length - 1; i >= 0; i--) {
                const l = this.lasers[i];
                l.update(dt);
                if (l.hasHit || l.y < -100) this.lasers.splice(i, 1);
            }
            return; // Skip combat logic
        }
        
        // Regenerate shields if no damage taken recently (5 seconds)
        if (this.health > 0 && this.health < GAME_CONFIG.player.maxHealth) {
            this.timeSinceLastDamage += dt;
            if (this.timeSinceLastDamage >= 5.0) {
                // Heal at a slower rate of 2 points per second
                this.health = Math.min(GAME_CONFIG.player.maxHealth, this.health + (2 * dt));
            }
        }
        
        // Check for player death
        if (this.health <= 0 && this.state === 'PLAYING') {
            this.state = 'GAMEOVER';
            // Trigger massive cinematic screen-shaking player explosion
            this.explosions.push(new PlayerDeathExplosion(playerX, playerY)); 
        }

        // Smoothly rotate player to aim at active enemy, BUT only if they've started typing it
        if (this.activeEnemyIndex < this.enemies.length) {
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
            
            // Skip dead enemies (invisible ghosts) so they don't keep flying and hitting the shield!
            if (e.isDead) continue;

            const wasHitShield = e.hitShield;
            e.update(dt, playerX, playerY);

            // If it just crashed into the shield this frame
            if (e.hitShield && !wasHitShield) {
                this.explosions.push(new Explosion(e.x, e.y, '#ff0055', 40)); // Big red explosion
                this.timeSinceLastDamage = 0; // Reset regen timer!
                this.combo = 0;
            } else if (e.hitShield && !e.isDead) {
                // Continously drain 10 health per second while attached
                this.health = Math.max(0, this.health - (10 * dt));
                this.timeSinceLastDamage = 0; // Continuously block regen!
                
                // Add tiny spark explosions occasionally to signify draining
                if (Math.random() < 0.1) {
                    this.explosions.push(new Explosion(e.x, e.y, '#ff0055', 10));
                }
            }
        }



        // Update lasers
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];
            l.update(dt);
            if (l.hasHit || l.y < -100) {
                this.lasers.splice(i, 1);
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
        
        this.ctx.fillStyle = '#050510'; // Deep space dark blue
        this.ctx.fillRect(0, 0, width, height);

        // 2. Draw 2D Scrolling Starfield (Background)
        this.drawStarfield(width, height);

        // 3. Draw Lasers
        for (const l of this.lasers) l.draw(this.ctx);

        // 4. Draw Enemies
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isDead) {
                e.draw(this.ctx, i === this.activeEnemyIndex, this.state === 'GAMEOVER');
            }
        }

        // 4.5. Draw Explosions
        for (const exp of this.explosions) exp.draw(this.ctx);

        // 5. Draw Player Ship (Center Bottom)
        this.drawPlayer(width, height);

        // 6. Draw HUD (Text box, Health, Combo)
        this.drawHUD(width, height);
    }

    private drawStarfield(w: number, h: number) {
        this.ctx.fillStyle = '#ffffff';
        for (const star of this.stars) {
            star.y += star.speed;
            
            // Wrap around
            if (star.y > h) {
                star.y = 0;
                star.x = Math.random() * w;
            }
            if (star.x > w) star.x = 0;

            // Draw star with glow based on size
            this.ctx.globalAlpha = star.size / 4;
            this.ctx.fillRect(star.x, star.y, star.size, star.size * 2); // Stretch slightly for motion blur
        }
        this.ctx.globalAlpha = 1;
    }

    private drawPlayer(w: number, h: number) {
        if (this.state === 'GAMEOVER') return; // Don't draw the ship if it exploded
        
        this.ctx.save();
        this.ctx.translate(w / 2, h - 150);
        
        // Draw energy shield (cyan circle)
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 80, 0, Math.PI * 2);
        
        const healthPercent = Math.max(0, this.health / GAME_CONFIG.player.maxHealth);

        // Overall shield strength multiplier (from 0.8 down to 0.05)
        const shieldStrength = 0.05 + (healthPercent * 0.75);

        // Critical Health VFX
        if (this.health <= 25) {
            // Glitchy, trembling shield sphere
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 75 + Math.random() * 5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 0, 85, ${shieldStrength * 0.5})`;
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(255, 0, 85, ${shieldStrength})`;
            this.ctx.lineWidth = 1 + Math.random() * 2;
            this.ctx.stroke();

            // Add screen vignette
            this.ctx.restore(); // Pop back to global coords
            this.ctx.save();
            const gradient = this.ctx.createRadialGradient(w/2, h/2, h/4, w/2, h/2, Math.max(w, h));
            gradient.addColorStop(0, 'rgba(255,0,0,0)');
            // Vignette also fades as you get closer to 0 health to signify system failure
            gradient.addColorStop(1, `rgba(255, 0, 85, ${(0.1 + Math.random() * 0.15) * (this.health / 25)})`);
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, w, h);
            this.ctx.restore();
            
            // Go back into player matrix
            this.ctx.save();
            this.ctx.translate(w / 2, h - 150);
        } else {
            // Normal Shield: Color shifts from Cyan -> Yellow -> Orange as it weakens
            let r, g, b;
            if (healthPercent > 0.5) {
                // Interpolate from Yellow (255, 255, 0) to Cyan (0, 255, 204)
                const t = (healthPercent - 0.5) * 2; // 0 to 1
                r = Math.floor(255 - (255 * t));
                g = 255;
                b = Math.floor(0 + (204 * t));
            } else {
                // Interpolate from Orange (255, 100, 0) to Yellow (255, 255, 0)
                // Note: t is between 0.5 (25% health) and 1 (50% health) here because we are above 25 health
                const t = (healthPercent - 0.25) * 4; // 0 to 1
                r = 255;
                g = Math.floor(100 + (155 * t));
                b = 0;
            }

            this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${shieldStrength})`;
            // Thickness is heavily emphasized when healthy (up to 5px), thin when weak (1px)
            this.ctx.lineWidth = 1 + (healthPercent * 4); 
            
            // Add a dynamic glowing aura that fades away as the shield weakens
            this.ctx.shadowBlur = 15 * healthPercent;
            this.ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 1)`;
            
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; // Reset
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
        
        this.ctx.restore();
    }

    private drawHUD(w: number, h: number) {
        // Draw Story Text Box
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(w / 2 - 400, h - 100, 800, 80);
        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.strokeRect(w / 2 - 400, h - 100, 800, 80);

        // Draw Typed/Untyped Text correctly seamlessly
        this.ctx.font = '24px monospace';
        const textWidth = this.ctx.measureText(this.currentStoryText).width;
        const startX = (w - textWidth) / 2;
        
        // Draw green typed part
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.fillText(this.globalTypedText, startX, h - 50);
        
        // Draw grey untyped part
        const typedWidth = this.ctx.measureText(this.globalTypedText).width;
        const untypedText = this.currentStoryText.substring(this.globalTypedText.length);
        this.ctx.fillStyle = '#555555';
        this.ctx.fillText(untypedText, startX + typedWidth, h - 50);

        // Draw an active cursor highlight so spaces are completely obvious
        if (this.globalTypedText.length < this.currentStoryText.length) {
            const activeChar = this.currentStoryText[this.globalTypedText.length];
            const charWidth = this.ctx.measureText(activeChar).width || this.ctx.measureText(' ').width;
            
            // Glowing background for the active letter
            this.ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
            this.ctx.fillRect(startX + typedWidth, h - 70, charWidth, 25);
            
            // If the active character is a space, draw a bright underscore so they know to hit the spacebar
            if (activeChar === ' ') {
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.fillRect(startX + typedWidth, h - 48, charWidth, 3);
            }
        }

        // Draw Combo
        this.ctx.fillStyle = '#ff0055';
        this.ctx.font = 'bold 20px sans-serif';
        this.ctx.fillText(`COMBO x${this.combo}`, 30, 40);
        
        // Draw Health
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.font = 'bold 20px sans-serif';
        this.ctx.fillText(`SHIELDS: ${Math.round(this.health)}%`, w - 230, 40);

        // Draw Health Bar
        const barWidth = 200;
        const barHeight = 15;
        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.strokeRect(w - 230, 50, barWidth, barHeight);
        
        const healthPercent = Math.max(0, this.health / GAME_CONFIG.player.maxHealth);
        this.ctx.fillStyle = this.health > 25 ? '#00ffcc' : '#ff0055'; // Turns red if critical
        this.ctx.fillRect(w - 230 + 2, 52, (barWidth - 4) * healthPercent, barHeight - 4);
    }
}
