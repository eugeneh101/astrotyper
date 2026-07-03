export class Enemy {
    x: number;
    y: number;
    word: string;
    speed: number;
    isDead: boolean = false;
    hitShield: boolean = false;
    typedChars: number = 0; // How many characters of this word have been typed
    angle: number = 0;
    type: 'kamikaze' | 'shooter' | 'boss_target' | 'mini_bio' = 'kamikaze';
    targetStopY: number = 0;
    strafePhase: number = 0;
    strafeSpeed: number = 100;
    chargeTime: number = 0;
    maxChargeTime: number = 8;
    hasFiredCharge: boolean = false;
    laserAlpha: number = 0;
    scatterParticles: {x: number, y: number, vx: number, vy: number, life: number, color: string}[] = [];

    constructor(x: number, y: number, word: string, speed: number, startIndex: number, type: 'kamikaze' | 'shooter' | 'boss_target' | 'mini_bio' = 'kamikaze') {
        this.x = x;
        this.y = y;
        this.word = word;
        this.speed = speed;
        this.startIndex = startIndex;
        this.type = type;
        if (this.type === 'shooter') {
            this.targetStopY = 100 + Math.random() * 150;
            this.strafePhase = Math.random() * Math.PI * 2;
        }
    }

    update(dt: number, targetX: number, targetY: number, playerIsDead: boolean = false) {
        // Update particles
        for (let i = this.scatterParticles.length - 1; i >= 0; i--) {
            const p = this.scatterParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.scatterParticles.splice(i, 1);
            }
        }

        if (playerIsDead) {
            this.hitShield = false;
            // Continue flying along the last known trajectory!
            const moveAngle = this.angle + Math.PI / 2;
            this.x += Math.cos(moveAngle) * this.speed * dt;
            this.y += Math.sin(moveAngle) * this.speed * dt;
            return;
        }

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);

        // Record angle so the ship can be drawn facing the player
        this.angle = Math.atan2(dy, dx) - Math.PI / 2; // -90 deg offset because sprite natively points "down"

        if (this.type === 'boss_target') {
            // Boss targets don't move towards the player, they are purely visual text markers.
            return;
        }

        if (this.type === 'kamikaze' || this.type === 'mini_bio') {
            // Shield radius is 80. The enemy's nose extends 15px forward from its center.
            // So they should collide when their center is 95px away.
            if (dist < 95 && !this.hitShield) { 
                this.hitShield = true;
                // DO NOT DIE YET! The player must still type the word to destroy this leech.
            }

            if (!this.hitShield) {
                const moveX = (dx / dist) * this.speed * dt;
                const moveY = (dy / dist) * this.speed * dt;
                
                this.x += moveX;
                this.y += moveY;
            } else {
                // Stick to the shield outer edge
                this.x = targetX - (dx / dist) * 95;
                this.y = targetY - (dy / dist) * 95;
            }
        } else if (this.type === 'shooter') {
            if (this.y < this.targetStopY) {
                // Move straight down until stop point
                this.y += this.speed * dt;
            } else {
                // Strafe
                this.strafePhase += dt;
                this.x += Math.sin(this.strafePhase) * this.strafeSpeed * dt;
                
                // Charge Attack
                this.chargeTime += dt;
                if (this.chargeTime >= this.maxChargeTime) {
                    this.hasFiredCharge = true;
                    this.chargeTime = 0; // Reset as requested to keep punishing player
                    this.laserAlpha = 1.0;
                }
                
                if (this.laserAlpha > 0) {
                    this.laserAlpha -= dt * 2.0;
                    if (this.laserAlpha < 0) this.laserAlpha = 0;
                }
                
                // Spawn scatter shots occasionally
                if (Math.random() < 0.1) { // approx 6 per second
                    const speed = 150 + Math.random() * 200;
                    const angleOffset = (Math.random() - 0.5) * Math.PI; // Random forward cone
                    const spawnAngle = this.angle + Math.PI/2 + angleOffset;
                    this.scatterParticles.push({
                        x: 0,
                        y: 0,
                        vx: Math.cos(spawnAngle) * speed,
                        vy: Math.sin(spawnAngle) * speed,
                        life: 1.0,
                        color: Math.random() > 0.5 ? '#ff0055' : '#ffaa00'
                    });
                }
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D, isActive: boolean, isGameOver: boolean = false) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw scatter particles before rotation (since their vx/vy are already world-angled)
        ctx.save();
        for (const p of this.scatterParticles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        
        // Stylized multi-layered geometric polygon, rotated to face player
        ctx.save();
        ctx.rotate(this.angle);
        
        if (this.type === 'shooter' && this.laserAlpha > 0) {
            // Draw massive laser beam
            ctx.save();
            ctx.globalAlpha = this.laserAlpha;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(-15, 1000);
            ctx.lineTo(15, 1000);
            ctx.lineTo(10, 0);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, 0, 0, 800);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.2, '#ffaa00');
            grad.addColorStop(1, 'rgba(255, 0, 85, 0)');
            
            ctx.fillStyle = grad;
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ff0055';
            ctx.fill();
            ctx.restore();
        }

        ctx.shadowBlur = 15;
        
        if (this.type === 'kamikaze') {
            ctx.shadowColor = '#ff0055';
            
            // Outer chassis (Dreadnought shape)
            ctx.beginPath();
            ctx.moveTo(0, 20); // nose
            ctx.lineTo(10, 5);
            ctx.lineTo(25, 10);
            ctx.lineTo(25, -15);
            ctx.lineTo(8, -10);
            ctx.lineTo(5, -20);
            ctx.lineTo(-5, -20);
            ctx.lineTo(-8, -10);
            ctx.lineTo(-25, -15);
            ctx.lineTo(-25, 10);
            ctx.lineTo(-10, 5);
            ctx.closePath();
            ctx.fillStyle = '#0d0514'; // Dark sleek metal
            ctx.fill();
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Cockpit window / glowing core
            ctx.beginPath();
            ctx.moveTo(0, 5);
            ctx.lineTo(-5, -5);
            ctx.lineTo(5, -5);
            ctx.closePath();
            ctx.fillStyle = '#ff0055';
            ctx.fill();
            
            // Wing glowing vents
            ctx.beginPath();
            ctx.arc(15, -5, 2.5, 0, Math.PI * 2);
            ctx.arc(-15, -5, 2.5, 0, Math.PI * 2);
            ctx.fill(); 
        } else if (this.type === 'mini_bio') {
            // Organic, writhing mini kamikaze
            ctx.shadowColor = '#00ff44';
            
            // Fleshy body
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fillStyle = '#0a1a0d';
            ctx.fill();
            
            ctx.strokeStyle = '#00ff44';
            ctx.lineWidth = 2;
            
            // Wavy tentacles
            const time = performance.now() / 150;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.quadraticCurveTo(
                    15 * Math.sin(time + i), -25, 
                    20 * Math.sin(time + i*2), -35
                );
                ctx.stroke();
            }
            
            // Glowing core
            ctx.beginPath();
            ctx.arc(0, 5, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffaa00';
            ctx.fill();
            ctx.stroke();
            
        } else if (this.type === 'shooter') {
            // SHOOTER CHASSIS - Heavy Stealth Bomber / Gunship Design
            ctx.shadowColor = '#b700ff';
            
            // Angular stealth shape
            ctx.beginPath();
            ctx.moveTo(8, 10); // Left of the center inset
            ctx.lineTo(15, -5); // Right inner cheek
            ctx.lineTo(40, 15); // Right wing forward point
            ctx.lineTo(25, -20); // Right wing back point
            ctx.lineTo(10, -10); // Right shoulder
            ctx.lineTo(5, -25); // Right engine block
            ctx.lineTo(-5, -25); // Left engine block
            ctx.lineTo(-10, -10); // Left shoulder
            ctx.lineTo(-25, -20); // Left wing back point
            ctx.lineTo(-40, 15); // Left wing forward point
            ctx.lineTo(-15, -5); // Left inner cheek
            ctx.lineTo(-8, 10); // Right of the center inset
            ctx.lineTo(0, 2); // Center inset point
            ctx.closePath();
            
            ctx.fillStyle = '#0a0512'; // Pitch black / deep void
            ctx.fill();
            ctx.strokeStyle = '#b700ff'; // Aggressive neon purple
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Inner armor plating
            ctx.beginPath();
            ctx.moveTo(0, -2);
            ctx.lineTo(10, -12);
            ctx.lineTo(0, -20);
            ctx.lineTo(-10, -12);
            ctx.closePath();
            ctx.fillStyle = '#220044';
            ctx.fill();
            ctx.strokeStyle = '#7700ff';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Cockpit (sinister glowing orange slit)
            ctx.beginPath();
            ctx.moveTo(-12, -7);
            ctx.lineTo(12, -7);
            ctx.lineTo(8, -4);
            ctx.lineTo(-8, -4);
            ctx.closePath();
            ctx.fillStyle = '#ffaa00';
            ctx.fill();
            
            // Charge Indicator Orb (nestled in the mandibles)
            if (!isGameOver) {
                const chargeRatio = this.chargeTime / this.maxChargeTime;
                
                // Pulsing math
                const pulse = Math.sin(Date.now() / 80) * 0.15;
                
                ctx.beginPath();
                ctx.arc(0, 15, 4 + (chargeRatio * 14), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 60, 0, ${0.4 + (chargeRatio * 0.6) + pulse})`;
                ctx.shadowBlur = 15 + (chargeRatio * 40);
                ctx.shadowColor = '#ff2200';
                ctx.fill();
                
                // Super hot core
                ctx.beginPath();
                ctx.arc(0, 15, 1 + (chargeRatio * 6), 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 0;
                ctx.fill();
                
                // Draw a targeting laser sight
                ctx.beginPath();
                ctx.moveTo(0, 25);
                ctx.lineTo(0, 800);
                ctx.strokeStyle = `rgba(255, 0, 50, ${0.15 + chargeRatio * 0.6})`;
                ctx.lineWidth = 1 + (chargeRatio * 4);
                ctx.setLineDash([5, Math.max(2, 25 - (chargeRatio * 23))]); // Dashes speed up as it charges
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        // Exhaust trail (flickers) - ONLY if game is active and not a boss target
        if (!isGameOver && this.type !== 'boss_target') {
            if (this.type === 'mini_bio') {
                ctx.shadowColor = '#00ff44';
            } else {
                ctx.shadowColor = this.type === 'kamikaze' ? '#ff0055' : '#aa00ff';
            }
            ctx.beginPath();
            ctx.moveTo(-5, -20);
            ctx.lineTo(0, -40 - Math.random() * 20);
            ctx.lineTo(5, -20);
            ctx.closePath();
            
            const gradient = ctx.createLinearGradient(0, -20, 0, -60);
            gradient.addColorStop(0, '#ffffff'); // White-hot core
            gradient.addColorStop(0.3, '#ffaa00'); // Orange
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); // Fade to transparent
            
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.restore(); // Restore rotation so text stays upright!

        // Draw the word below the ship - ONLY if game is active
        if (!isGameOver) {
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'left';
            
            const typedPart = this.word.substring(0, this.typedChars);
            const untypedPart = this.word.substring(this.typedChars);
            
            const fullWidth = ctx.measureText(this.word).width;
            const typedWidth = ctx.measureText(typedPart).width;
            
            const startX = -fullWidth / 2;

            // Highlight box if active
            if (isActive) {
                // Solid dark background to ensure readability over boss tentacles
                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.fillRect(startX - 4, 15, fullWidth + 8, 25);
                
                // Cyan border
                ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)';
                ctx.lineWidth = 2;
                ctx.strokeRect(startX - 4, 15, fullWidth + 8, 25);
            }
            
            ctx.fillStyle = '#00ffcc'; // typed is green
            ctx.fillText(typedPart, startX, 35);
            
            // Active word is bright white, inactive is dark grey
            ctx.fillStyle = isActive ? '#ffffff' : '#666666';
            ctx.fillText(untypedPart, startX + typedWidth, 35);
        }

        ctx.restore();
    }
}

export class Laser {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number = 1800; // Very fast lasers
    hasHit: boolean = false;

    constructor(startX: number, startY: number, targetX: number, targetY: number) {
        this.x = startX;
        this.y = startY;
        this.targetX = targetX;
        this.targetY = targetY;
    }

    update(dt: number) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 20) {
            this.hasHit = true;
            return;
        }

        const moveX = (dx / dist) * this.speed * dt;
        const moveY = (dy / dist) * this.speed * dt;
        
        this.x += moveX;
        this.y += moveY;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotate laser to face velocity vector
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        ctx.rotate(angle);

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ccff';
        
        // Inner Core (Bright White)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-8, -2, 16, 4, 2);
        ctx.fill();

        // Outer Plasma Bloom
        ctx.fillStyle = 'rgba(0, 204, 255, 0.5)';
        ctx.beginPath();
        ctx.roundRect(-12, -4, 24, 8, 4);
        ctx.fill();
        
        ctx.restore();
    }
}

export class Explosion {
    x: number;
    y: number;
    particles: { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string, size: number }[] = [];
    isDead: boolean = false;

    constructor(x: number, y: number, color: string = '#ff0055', count: number = 20) {
        this.x = x;
        this.y = y;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            this.particles.push({
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: 0.5 + Math.random() * 0.5,
                color: color,
                size: Math.random() * 3 + 1
            });
        }
    }

    update(dt: number) {
        let allDead = true;
        for (const p of this.particles) {
            if (p.life > 0) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                allDead = false;
            }
        }
        if (allDead) this.isDead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'screen';
        
        for (const p of this.particles) {
            if (p.life > 0) {
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

export class PlayerDeathExplosion {
    x: number;
    y: number;
    debris: { x: number, y: number, vx: number, vy: number, rotation: number, rotSpeed: number, size: number, color: string }[] = [];
    smoke: { x: number, y: number, vx: number, vy: number, size: number, life: number, maxLife: number, color: string }[] = [];
    sparks: { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string }[] = [];
    shockwaveRadius: number = 0;
    shockwaveMaxRadius: number = 800;
    life: number = 0;
    isDead: boolean = false;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;

        // 1. Generate Debris (shattered ship hull pieces)
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 400 + 100;
            this.debris.push({
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 15,
                size: Math.random() * 20 + 5,
                color: Math.random() > 0.5 ? '#111122' : '#00ffff'
            });
        }

        // 2. Generate Smoke
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 150 + 20;
            this.smoke.push({
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 25 + 15,
                life: 1.0,
                maxLife: 3.0 + Math.random() * 2.0,
                color: `rgba(${20 + Math.random()*30}, ${20 + Math.random()*30}, ${20 + Math.random()*30}, 0.8)`
            });
        }

        // 3. Generate Sparks
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1500 + 1000; // Massively faster!
            const lifetime = 2.0 + Math.random() * 1.5; // Last 2-3.5 seconds
            this.sparks.push({
                x: 0,
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: lifetime,
                maxLife: lifetime,
                color: Math.random() > 0.5 ? '#ffaa00' : '#ffffff'
            });
        }
    }

    update(dt: number) {
        this.life += dt;
        
        if (this.shockwaveRadius < this.shockwaveMaxRadius) {
            this.shockwaveRadius += 1200 * dt;
        }

        let allDead = true;

        for (const d of this.debris) {
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.rotation += d.rotSpeed * dt;
            if (Math.abs(d.x) < 2000 && Math.abs(d.y) < 2000) allDead = false;
        }

        for (const s of this.smoke) {
            if (s.life > 0) {
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.size += 20 * dt;
                s.life -= dt;
                allDead = false;
            }
        }

        for (const sp of this.sparks) {
            if (sp.life > 0) {
                sp.x += sp.vx * dt;
                sp.y += sp.vy * dt;
                sp.life -= dt;
                allDead = false;
            }
        }

        if (allDead) this.isDead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw Smoke (Behind debris)
        for (const s of this.smoke) {
            if (s.life > 0) {
                ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
                ctx.fillStyle = s.color;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;

        // Draw Shockwave
        if (this.shockwaveRadius < this.shockwaveMaxRadius) {
            const opacity = Math.max(0, 1 - (this.shockwaveRadius / this.shockwaveMaxRadius));
            ctx.beginPath();
            ctx.arc(0, 0, this.shockwaveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 204, ${opacity})`;
            ctx.lineWidth = 15 * opacity;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, 0, this.shockwaveRadius * 0.8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
            ctx.lineWidth = 8 * opacity;
            ctx.stroke();
        }

        // Draw Sparks
        ctx.globalCompositeOperation = 'screen';
        for (const sp of this.sparks) {
            if (sp.life > 0) {
                ctx.strokeStyle = sp.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(sp.x, sp.y);
                ctx.lineTo(sp.x - sp.vx * 0.04, sp.y - sp.vy * 0.04); // streak based on velocity
                ctx.stroke();
            }
        }

        // Draw Debris
        ctx.globalCompositeOperation = 'source-over';
        for (const d of this.debris) {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.moveTo(-d.size/2, -d.size/2);
            ctx.lineTo(d.size/2, -d.size/2);
            ctx.lineTo(0, d.size/2);
            ctx.closePath();
            ctx.fill();
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }
}
