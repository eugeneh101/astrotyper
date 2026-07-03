import { Enemy } from './Entities';

export class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    isDead: boolean = false;

    constructor(x: number, y: number, vx: number, vy: number, radius: number = 4, color: string = '#ff0055') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = color;
    }

    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export abstract class Boss {
    x: number;
    y: number;
    maxHealth: number;
    health: number;
    isDead: boolean = false;
    time: number = 0;
    scaleX: number = 1.0;
    scaleY: number = 1.0;

    constructor(x: number, y: number, maxHealth: number) {
        this.x = x;
        this.y = y;
        this.maxHealth = maxHealth;
        this.health = maxHealth;
    }

    takeDamage(amount: number) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
        }
    }

    abstract update(dt: number, bullets: Bullet[], enemies: Enemy[]): void;
    abstract draw(ctx: CanvasRenderingContext2D): void;
}

export class DreadnoughtBoss extends Boss {
    laserCharge: number = 0;
    laserMaxCharge: number = 10; // 10 seconds to charge
    isFiringLaser: boolean = false;
    laserDuration: number = 2; // fires for 2 seconds
    laserTimer: number = 0;
    
    turretPhase: number = 0;

    constructor(x: number, y: number) {
        super(x, y, 100); // 100 words to kill? Wait, we can adjust health mapping in GameEngine
    }

    update(dt: number, bullets: Bullet[], enemies: Enemy[]) {
        this.time += dt;
        
        // Hovering motion
        this.x += Math.sin(this.time) * 20 * dt;
        this.y = 150 + Math.sin(this.time * 0.5) * 20;

        if (!this.isFiringLaser) {
            this.laserCharge += dt;
            if (this.laserCharge >= this.laserMaxCharge) {
                this.isFiringLaser = true;
                this.laserCharge = 0;
                this.laserTimer = this.laserDuration;
            }

            // Turret Bullet Hell (sweeping arcs)
            this.turretPhase += dt;
            if (Math.random() < 0.2) { // 20% chance per frame at 60fps is high, we'll throttle it
                // Fire from left and right turrets
                const spread = Math.sin(this.turretPhase * 2) * Math.PI / 4;
                const speed = 250;
                
                // Left turret
                bullets.push(new Bullet(
                    this.x - 80, this.y + 40,
                    Math.cos(Math.PI/2 + spread) * speed,
                    Math.sin(Math.PI/2 + spread) * speed,
                    5, '#ff0055'
                ));
                // Right turret
                bullets.push(new Bullet(
                    this.x + 80, this.y + 40,
                    Math.cos(Math.PI/2 - spread) * speed,
                    Math.sin(Math.PI/2 - spread) * speed,
                    5, '#ff0055'
                ));
            }
        } else {
            this.laserTimer -= dt;
            if (this.laserTimer <= 0) {
                this.isFiringLaser = false;
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, this.scaleY);

        // Core charging glow
        const chargeRatio = this.laserCharge / this.laserMaxCharge;
        ctx.shadowBlur = 30 + chargeRatio * 50;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = `rgba(0, 255, 255, ${0.2 + chargeRatio * 0.8})`;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();

        // Dreadnought Chassis (Geometric, metallic)
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#aa00ff';
        ctx.fillStyle = '#110a1f';
        ctx.strokeStyle = '#aa00ff';
        ctx.lineWidth = 3;

        ctx.beginPath();
        // Central hull
        ctx.moveTo(0, 80);
        ctx.lineTo(30, 40);
        ctx.lineTo(90, 20); // right wing
        ctx.lineTo(90, -40);
        ctx.lineTo(40, -20);
        ctx.lineTo(30, -60);
        ctx.lineTo(-30, -60);
        ctx.lineTo(-40, -20);
        ctx.lineTo(-90, -40);
        ctx.lineTo(-90, 20); // left wing
        ctx.lineTo(-30, 40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Neon vents
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.fillRect(-60, -10, 10, 20);
        ctx.fillRect(50, -10, 10, 20);

        // If firing laser
        if (this.isFiringLaser) {
            ctx.shadowBlur = 50;
            ctx.shadowColor = '#00ffff';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(-20, 40);
            ctx.lineTo(20, 40);
            ctx.lineTo(25, 2000);
            ctx.lineTo(-25, 2000);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(-40, 40);
            ctx.lineTo(40, 40);
            ctx.lineTo(50, 2000);
            ctx.lineTo(-50, 2000);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

export class BioBoss extends Boss {
    spinAngle: number = 0;
    danmakuTimer: number = 0;
    mode: 'SHOOTING' | 'COOLDOWN' = 'SHOOTING';
    modeTimer: number = 0;
    strafeTime: number = 0;
    strafePattern: number = 0;
    startX: number;
    interruptCharge: number = 0;

    constructor(x: number, y: number) {
        super(x, y, 100);
        this.startX = x;
    }

    update(dt: number, bullets: Bullet[], enemies: Enemy[]) {
        this.time += dt;
        this.modeTimer += dt;
        
        // State Machine
        if (this.mode === 'SHOOTING' && this.modeTimer > 3) { // 3 seconds of shooting (nerfed from 5)
            this.mode = 'COOLDOWN';
            this.modeTimer = 0;
        } else if (this.mode === 'LASER_CHARGE' && this.modeTimer > 4) { // 4 seconds to charge beam
            this.mode = 'LASER_FIRING';
            this.modeTimer = 0;
        } else if (this.mode === 'LASER_FIRING' && this.modeTimer > 2) { // 2 seconds firing beam
            this.mode = 'COOLDOWN';
            this.modeTimer = 0;
        } else if (this.mode === 'COOLDOWN' && this.modeTimer > 6) { // 6 seconds of resting
            // Randomly choose next attack
            this.mode = Math.random() < 0.5 ? 'SHOOTING' : 'LASER_CHARGE';
            this.modeTimer = 0;
            this.interruptCharge = 0; // Reset QTE charge
            // Reset strafe time so it smoothly continues from the center
            this.strafeTime = 0;
            this.strafePattern = Math.floor(Math.random() * 3);
        }

        if (this.mode === 'SHOOTING') {
            this.strafeTime += dt;
            
            if (this.strafePattern === 0) {
                // Pattern 0: Standard wide arcs
                this.x = this.startX + Math.sin(this.strafeTime * 1.5) * 250; 
            } else if (this.strafePattern === 1) {
                // Pattern 1: Fast erratic zig-zags
                this.x = this.startX + Math.sin(this.strafeTime * 4) * 200 + Math.sin(this.strafeTime * 9) * 50;
            } else {
                // Pattern 2: Figure-8 loop (vertical motion handled below)
                this.x = this.startX + Math.sin(this.strafeTime * 2.5) * 300;
            }
            
            // Fast spinning
            this.spinAngle += dt * 1.5;
            
            // Toxic Danmaku (spiral outward)
            this.danmakuTimer += dt;
            if (this.danmakuTimer >= 0.15) {
                this.danmakuTimer = 0;
                const speed = 250;
                for (let i = 0; i < 4; i++) {
                    const angle = this.spinAngle + (i * Math.PI / 2);
                    bullets.push(new Bullet(
                        this.x, this.y,
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        6, '#00ff44'
                    ));
                }
            }
        } else if (this.mode === 'LASER_CHARGE' || this.mode === 'LASER_FIRING') {
            // Stay near the center when charging/firing
            this.x += (this.startX - this.x) * 3 * dt;
            this.spinAngle += dt * 0.1;
        } else {
            // Cooldown logic: Return to center slowly and spin slower
            this.x += (this.startX - this.x) * 3 * dt;
            this.spinAngle += dt * 0.2;
        }

        // Hovering vertical motion
        if (this.mode === 'SHOOTING' && this.strafePattern === 2) {
            // Pattern 2 gets vertical figure-8 motion
            this.y = 150 + Math.sin(this.strafeTime * 5) * 80;
        } else {
            this.y = 150 + Math.sin(this.time * 1.2) * 15;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.rotate(this.spinAngle);

        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00ff44';

        const pulse = Math.sin(this.time * 3) * 5;

        // Draw multiple writhing tentacles first (underneath the body)
        ctx.strokeStyle = '#00ff44';
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.time * 0.5;
            ctx.beginPath();
            ctx.lineWidth = 6 + Math.sin(this.time + i) * 2;
            ctx.moveTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
            
            // Complex bezier curves for tentacles
            const cp1x = Math.cos(angle + 0.3) * (80 + pulse * 2);
            const cp1y = Math.sin(angle + 0.3) * (80 + pulse * 2);
            const cp2x = Math.cos(angle - 0.5 + Math.sin(this.time * 2)) * 130;
            const cp2y = Math.sin(angle - 0.5 + Math.sin(this.time * 2)) * 130;
            const endX = Math.cos(angle + Math.sin(this.time * 3)) * 160;
            const endY = Math.sin(angle + Math.sin(this.time * 3)) * 160;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
            ctx.stroke();
        }

        // Fleshy carapace (star-like / biological shape)
        ctx.fillStyle = '#0a1a0d';
        ctx.strokeStyle = '#00ff44';
        ctx.lineWidth = 3;

        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const baseR = 50 + pulse;
            // Spikes every other point
            const r = i % 2 === 0 ? baseR + 25 + Math.sin(this.time * 5 + i) * 10 : baseR;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner glowing core/mouth
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#ffaa00';
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, 0, 25 + pulse * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Terrifying jagged teeth inside the maw
        ctx.fillStyle = '#111';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, 20 + pulse * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for(let i=0; i<12; i++) {
            const a = (i/12) * Math.PI * 2 + this.time * 2; // Spinning teeth
            const innerR = 10;
            const outerR = 18 + pulse * 0.5;
            ctx.moveTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
            ctx.lineTo(Math.cos(a + 0.2) * innerR, Math.sin(a + 0.2) * innerR);
            ctx.lineTo(Math.cos(a - 0.2) * innerR, Math.sin(a - 0.2) * innerR);
        }
        ctx.fill();

        // Menacing glowing eyes embedded in the carapace
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 20;
        for (let i = 0; i < 4; i++) {
            const eyeAngle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const eyeDist = 40 + pulse * 0.5;
            ctx.beginPath();
            ctx.ellipse(
                Math.cos(eyeAngle) * eyeDist, 
                Math.sin(eyeAngle) * eyeDist, 
                6, 12, eyeAngle, 0, Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();

        // Draw QTE Charge Bar & Laser Beam (independent of rotation)
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.mode === 'LASER_CHARGE') {
            const chargeRatio = this.modeTimer / 4; // 4 second charge time
            
            // Draw Massive Warning Circle expanding
            ctx.beginPath();
            ctx.arc(0, 0, 50 + (chargeRatio * 150), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 85, ${0.1 + (chargeRatio * 0.4)})`;
            ctx.lineWidth = 10;
            ctx.stroke();

            // Draw Interrupt Bar Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(-60, -90, 120, 15);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-60, -90, 120, 15);

            // Draw Interrupt Bar Fill (Cyan/Green if filling, Red if failing)
            ctx.fillStyle = this.interruptCharge > 0.5 ? '#00ffcc' : '#ffaa00';
            ctx.fillRect(-58, -88, 116 * Math.min(this.interruptCharge, 1.0), 11);

            // QTE Text
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00ffcc';
            ctx.fillText('TYPE TO INTERRUPT!', 0, -100);
        }

        if (this.mode === 'LASER_FIRING') {
            // Massive vertical bio-beam
            ctx.shadowBlur = 40;
            ctx.shadowColor = '#ff0055';
            
            const grad = ctx.createLinearGradient(0, 0, 0, 1000);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.1, '#00ff44');
            grad.addColorStop(1, 'rgba(0, 255, 68, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(-25, 0);
            ctx.lineTo(-40, 1000);
            ctx.lineTo(40, 1000);
            ctx.lineTo(25, 0);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}
