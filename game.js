/* game.js — Evita las Bolas · Party Perilingüe */

document.addEventListener('DOMContentLoaded', function () {

  const CFG = {
    PTS_POR_SEGUNDO  : 20,
    BONUS_CADA_5S    : 30,
    MAX_VIDAS        : 3,
    NIVEL_CADA_S     : 7,
    STAR_INTERVAL    : 8,
    STAR_PTS         : 100,
    STREAK_STEP      : 20,  /* segundos sin golpe para subir un nivel de racha */
    STREAK_MAX_MULT  : 4,   /* multiplicador máximo x4 */
  };

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let CW = 360, CH = 414;
  let inputBound = false;
  let touchX = null, touchY = null;

  const IS_LOW_END = navigator.hardwareConcurrency <= 4 || (window.screen.width < 400 && DPR > 1);

  function resizeCanvas() {
    const box = document.getElementById('gameBox');
    CW = Math.min(box ? box.offsetWidth : 360, 400);
    CH = Math.round(CW * 1.15);
    const d = IS_LOW_END ? 1 : DPR;
    canvas.width  = CW * d;
    canvas.height = CH * d;
    canvas.style.width  = CW + 'px';
    canvas.style.height = CH + 'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(d, d);
  }

  const BCOLS = ['#ff4d6d','#ff66c4','#9d6bff','#3ddc97','#ff8c42','#ffd93d'];
  let hi = parseInt(localStorage.getItem('evb_hi') || '0');
  let player, balls, particles, heartItems, starItems, floatingTexts;
  let score, elapsed, gameOver, started, frameId, lastTs, ptAcc, lastBonusMark;
  let spawnTimer, heartSpawnTimer, starSpawnTimer, lives;
  let streakTimer, streakActive, streakFlash, streakMult;

  function getLevelConfig(l) {
    if (l<=2)  return {speed:130, sv:35,  int:0.95, max:5,  w:10};
    if (l<=4)  return {speed:165, sv:45,  int:0.78, max:8,  w:14};
    if (l<=6)  return {speed:205, sv:55,  int:0.62, max:11, w:19};
    if (l<=8)  return {speed:245, sv:65,  int:0.50, max:14, w:25};
    if (l<=10) return {speed:280, sv:72,  int:0.41, max:17, w:30};
    if (l<=12) return {speed:310, sv:78,  int:0.34, max:20, w:35};
    if (l<=14) return {speed:336, sv:82,  int:0.29, max:23, w:40};
    if (l<=16) return {speed:358, sv:86,  int:0.25, max:26, w:45};
    if (l<=20) return {speed:375, sv:90,  int:0.21, max:28, w:49};
     return {speed:420, sv:100, int:0.14, max:35, w:60};
  }

  function getSpikeDepth(l) { return l < 10 ? 0 : 6; }

  function initState() {
    player        = {x:CW/2, y:CH/2, r:14, tx:CW/2, ty:CH/2, hitFlash:0};
    balls         = []; particles = []; heartItems = [];
    starItems     = []; floatingTexts = [];
    score         = 0; elapsed = 0; ptAcc = 0; lastBonusMark = 0;
    spawnTimer    = 0; heartSpawnTimer = 0; starSpawnTimer = 0;
    streakTimer   = 0; streakActive = false; streakFlash = 0; streakMult = 1;
    gameOver      = false; started = false;
    lives         = CFG.MAX_VIDAS;
    refreshHUD();
  }

  function refreshHUD() {
    const el = document.getElementById('g-lives');
    if (!el) return;
    let s = '';
    for (let i = 0; i < CFG.MAX_VIDAS; i++) s += i < lives ? '❤️' : '🖤';
    el.textContent = s;
    const hEl = document.getElementById('g-hi');
    if (hEl) hEl.textContent = hi;
  }

  function bindInput() {
    if (inputBound) return;
    inputBound = true;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      touchX = (e.touches[0].clientX - r.left) * (CW / r.width);
      touchY = (e.touches[0].clientY - r.top)  * (CH / r.height);
      if (!started || gameOver) startGame();
    }, {passive:false});
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      touchX = (e.touches[0].clientX - r.left) * (CW / r.width);
      touchY = (e.touches[0].clientY - r.top)  * (CH / r.height);
    }, {passive:false});
    canvas.addEventListener('touchend', () => { touchX = null; touchY = null; });
    canvas.addEventListener('mousemove', e => {
      if (!started || gameOver) return;
      const r = canvas.getBoundingClientRect();
      touchX = (e.clientX - r.left) * (CW / r.width);
      touchY = (e.clientY - r.top)  * (CH / r.height);
    });
    canvas.addEventListener('click', () => { if (!started || gameOver) startGame(); });
  }

  function startGame() {
    initState(); started = true; lastTs = performance.now();
    cancelAnimationFrame(frameId);
    setMsg('⭐ Agarra estrellas · ❤️ Corazones · 🔥 20s sin golpe = x2→x3→x4');
    frameId = requestAnimationFrame(loop);
  }

  function spawnBall(cfg, sd) {
    const speed = cfg.speed + Math.random() * cfg.sv;
    const r = 8 + Math.random() * 10;
    const minX = sd+r+4, maxX = CW-sd-r-4;
    if (maxX <= minX) return;
    balls.push({
      x: minX+Math.random()*(maxX-minX), y:-r, r,
      vx: (Math.random()-0.5)*speed*0.4, vy: speed,
      color: BCOLS[Math.floor(Math.random()*BCOLS.length)],
      wobble: Math.random()*Math.PI*2,
      wobbleAmp: cfg.w, wobbleSpeed: 1.5+Math.random()*2.5
    });
  }

  function spawnHeart(sd) {
    if (lives >= CFG.MAX_VIDAS) return;
    const r = 18, minX = sd+r+10, maxX = CW-sd-r-10;
    if (maxX <= minX) return;
    heartItems.push({x: minX+Math.random()*(maxX-minX), y:-r, r, vy:55+Math.random()*30});
  }

  function spawnStar(sd) {
    const r = 16, minX = sd+r+10, maxX = CW-sd-r-10;
    if (maxX <= minX) return;
    starItems.push({
      x: minX+Math.random()*(maxX-minX), y:-r, r,
      vy: 70+Math.random()*40,
      rot: 0, rotSpeed: (Math.random()-0.5)*4
    });
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push({x, y, text, color, life:1.2, vy:-60});
  }

  function addParticles(x, y, color, n=12) {
    const count = IS_LOW_END ? Math.floor(n/2) : n;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI*2/count)*i+Math.random()*0.5, sp = 60+Math.random()*90;
      particles.push({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:3+Math.random()*4, life:1, color});
    }
  }

  function drawSpikes(sd) {
    if (sd <= 0) return;
    const sz = 20, p = 1+Math.sin(elapsed*4)*0.07;
    ctx.fillStyle = '#ff2244';
    for (let i = -1; i < Math.ceil(CH/sz)+2; i++) {
      const y = i*sz;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(sd*p,y+sz/2); ctx.lineTo(0,y+sz); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(CW,y); ctx.lineTo(CW-sd*p,y+sz/2); ctx.lineTo(CW,y+sz); ctx.closePath(); ctx.fill();
    }
    for (let i = -1; i < Math.ceil(CW/sz)+2; i++) {
      const x = i*sz;
      ctx.beginPath(); ctx.moveTo(x,CH); ctx.lineTo(x+sz/2,CH-sd*p); ctx.lineTo(x+sz,CH); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x,0);  ctx.lineTo(x+sz/2,sd*p);    ctx.lineTo(x+sz,0);  ctx.closePath(); ctx.fill();
    }
  }

  function checkSpike(sd) {
    if (sd <= 0) return false;
    return player.x-player.r<sd || player.x+player.r>CW-sd ||
           player.y-player.r<sd || player.y+player.r>CH-sd;
  }

  function loseLife() {
    lives--; refreshHUD(); player.hitFlash = 1.2;
    /* Resetear racha al recibir golpe */
    if (streakActive) {
      addFloatingText(player.x, player.y-30, '🔥 Racha perdida', '#ff4d6d');
      streakActive = false;
    }
    streakTimer = 0; streakMult = 1;
    addParticles(player.x, player.y, '#ff4d6d', 14);
    if (lives <= 0) endGame();
  }

  function loop(ts) {
    const dt = Math.min((ts-lastTs)/1000, 0.05);
    lastTs = ts; elapsed += dt;

    const level = 1 + Math.floor(elapsed / CFG.NIVEL_CADA_S);
    const cfg   = getLevelConfig(level);
    const sd    = getSpikeDepth(level);
const lvEl = document.getElementById('g-lv');
    if (lvEl) lvEl.textContent = Math.min(level, 25);
    if (player.hitFlash > 0) player.hitFlash -= dt;
    if (streakFlash > 0) streakFlash -= dt;

    /* ===== RACHA ACUMULABLE x2 → x3 → x4 ===== */
    streakTimer += dt;
    const newMult = Math.min(1 + Math.floor(streakTimer / CFG.STREAK_STEP), CFG.STREAK_MAX_MULT);
    if (newMult > streakMult) {
      streakMult  = newMult;
      streakActive = true;
      streakFlash  = 1.5;
      const multColors = {2:'#ff9900', 3:'#ff5500', 4:'#ff0000'};
      addFloatingText(CW/2, CH/2-50, `🔥 ¡RACHA x${streakMult}!`, multColors[streakMult]||'#ff9900');
      addParticles(player.x, player.y, multColors[streakMult]||'#ff9900', 20);
    }
    const mult = streakMult;

    /* Barra de racha en HUD */
    const scEl = document.getElementById('g-sc');
    if (scEl) scEl.textContent = (streakActive ? `🔥 x${mult}  ` : '') + Math.round(score);

    /* Mover jugador */
    const sL = player.r, sR = CW-player.r, sT = player.r, sB = CH-player.r;
    if (touchX !== null) {
      player.tx = Math.max(sL, Math.min(sR, touchX));
      player.ty = Math.max(sT, Math.min(sB, touchY || player.ty));
    }
    player.x += (player.tx-player.x)*0.35;
    player.y += (player.ty-player.y)*0.35;
    player.x = Math.max(sL, Math.min(sR, player.x));
    player.y = Math.max(sT, Math.min(sB, player.y));

    if (checkSpike(sd) && player.hitFlash <= 0) { loseLife(); if (gameOver) return; }

    /* Spawn */
    spawnTimer += dt;
    if (spawnTimer >= cfg.int && balls.length < Math.floor(cfg.max)) { spawnBall(cfg,sd); spawnTimer = 0; }
    heartSpawnTimer += dt;
    if (heartSpawnTimer >= 15) { spawnHeart(sd); heartSpawnTimer = 0; }
    starSpawnTimer += dt;
    if (starSpawnTimer >= CFG.STAR_INTERVAL) { spawnStar(sd); starSpawnTimer = 0; }

    /* Bolas */
    for (let i = balls.length-1; i >= 0; i--) {
      const b = balls[i];
      b.wobble += b.wobbleSpeed*dt;
      b.x += (b.vx+Math.sin(b.wobble)*b.wobbleAmp)*dt; b.y += b.vy*dt;
      if (b.y-b.r>CH+20||b.x<-50||b.x>CW+50) { balls.splice(i,1); continue; }
      const dx=player.x-b.x, dy=player.y-b.y;
      if (Math.sqrt(dx*dx+dy*dy)<player.r+b.r-2 && player.hitFlash<=0) {
        balls.splice(i,1); loseLife(); if (gameOver) return;
      }
    }

    /* Corazones */
    for (let i = heartItems.length-1; i >= 0; i--) {
      const h = heartItems[i]; h.y += h.vy*dt;
      if (h.y-h.r>CH+10) { heartItems.splice(i,1); continue; }
      const dx=player.x-h.x, dy=player.y-h.y;
      if (Math.sqrt(dx*dx+dy*dy)<player.r+h.r) {
        lives=Math.min(CFG.MAX_VIDAS,lives+1); refreshHUD();
        addParticles(h.x,h.y,'#ff4d6d',8);
        addFloatingText(h.x,h.y,'+❤️','#ff4d6d');
        heartItems.splice(i,1);
      }
    }

    /* Estrellas */
    for (let i = starItems.length-1; i >= 0; i--) {
      const s = starItems[i];
      s.y += s.vy*dt; s.rot += s.rotSpeed*dt;
      if (s.y-s.r>CH+10) { starItems.splice(i,1); continue; }
      const dx=player.x-s.x, dy=player.y-s.y;
      if (Math.sqrt(dx*dx+dy*dy)<player.r+s.r) {
        const gained = CFG.STAR_PTS * mult;
        score += gained;
        addParticles(s.x,s.y,'#ffd93d',16);
        addFloatingText(s.x,s.y-20, (mult>1?`🔥 x${mult} `:'')+'+'+ gained,'#ffd93d');
        starItems.splice(i,1);
      }
    }

    /* Puntos por tiempo (multiplicados por racha) */
    ptAcc += CFG.PTS_POR_SEGUNDO * mult * dt;
    if (ptAcc >= 1) { const p=Math.floor(ptAcc); score+=p; ptAcc-=p; }

    /* Bonus cada 5s (multiplicado por racha) */
    const bm = Math.floor(elapsed/5);
    if (bm > lastBonusMark) {
      score += CFG.BONUS_CADA_5S * mult; lastBonusMark = bm;
      addParticles(player.x,player.y-30,'#ffd93d',8);
    }

    /* Partículas */
    for (let i = particles.length-1; i >= 0; i--) {
      const p=particles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=120*dt; p.life-=dt*1.5;
      if (p.life<=0) particles.splice(i,1);
    }
    if (particles.length>60) particles.splice(0,particles.length-60);

    /* Textos flotantes */
    for (let i = floatingTexts.length-1; i >= 0; i--) {
      const t=floatingTexts[i]; t.y+=t.vy*dt; t.life-=dt*1.2;
      if (t.life<=0) floatingTexts.splice(i,1);
    }

    draw(level, sd, mult);
    frameId = requestAnimationFrame(loop);
  }

  function getBg(l) {
    if (l<=2)  return '#fff0f5';
    if (l<=5)  return '#ffe0f0';
    if (l<=8)  return '#1a0a2e';
    if (l<=14) return '#0d0019';
    return '#000';
  }

  function drawHeart(x, y, sz, color) {
    ctx.fillStyle=color;
    ctx.beginPath(); ctx.moveTo(x,y+sz*0.3);
    ctx.bezierCurveTo(x,y,x-sz,y,x-sz,y+sz*0.4);
    ctx.bezierCurveTo(x-sz,y+sz*0.9,x,y+sz*1.3,x,y+sz*1.5);
    ctx.bezierCurveTo(x,y+sz*1.3,x+sz,y+sz*0.9,x+sz,y+sz*0.4);
    ctx.bezierCurveTo(x+sz,y,x,y,x,y+sz*0.3);
    ctx.closePath(); ctx.fill();
  }

  function drawStar(x, y, r, rot, color) {
    const spikes=5, outerR=r, innerR=r*0.45;
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
    ctx.beginPath(); ctx.arc(0,0,outerR+4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,220,50,0.25)'; ctx.fill();
    ctx.beginPath();
    for (let i=0;i<spikes*2;i++) {
      const angle=(Math.PI/spikes)*i-Math.PI/2, rad=i%2===0?outerR:innerR;
      if (i===0) ctx.moveTo(Math.cos(angle)*rad,Math.sin(angle)*rad);
      else       ctx.lineTo(Math.cos(angle)*rad,Math.sin(angle)*rad);
    }
    ctx.closePath(); ctx.fillStyle=color||'#ffd93d'; ctx.fill();
    ctx.strokeStyle='#ffaa00'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(-outerR*0.2,-outerR*0.25,outerR*0.18,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
    ctx.restore();
  }

  function getStreakColor(m) {
    if (m >= 4) return '#ff0000';
    if (m >= 3) return '#ff5500';
    if (m >= 2) return '#ff9900';
    return '#ffd93d';
  }

  /* Barra de progreso de racha */
  function drawStreakBar(mult) {
    const barW = CW - 20, barH = 5, barX = 10, barY = CH - 12;

    /* Progreso dentro del step actual (o llena si es máximo) */
    const stepProgress = mult >= CFG.STREAK_MAX_MULT
      ? 1
      : (streakTimer % CFG.STREAK_STEP) / CFG.STREAK_STEP;

    /* Fondo */
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();

    /* Relleno */
    const barColor = getStreakColor(mult);
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * stepProgress, barH, 3); ctx.fill();

    /* Texto */
    if (streakActive) {
      const pulse = 0.85 + Math.sin(elapsed*6)*0.15;
      ctx.globalAlpha = pulse;
      ctx.fillStyle   = barColor;
      ctx.font        = 'bold 11px Poppins,sans-serif';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      const label = mult >= CFG.STREAK_MAX_MULT
        ? `🔥 RACHA x${mult} — ¡MÁXIMO!`
        : `🔥 RACHA x${mult} — próximo x${mult+1} en ${Math.ceil(CFG.STREAK_STEP - (streakTimer % CFG.STREAK_STEP))}s`;
      ctx.fillText(label, CW/2, barY - 8);
      ctx.globalAlpha = 1;
    } else {
      const segsLeft = Math.ceil(CFG.STREAK_STEP - streakTimer);
      ctx.fillStyle   = 'rgba(255,255,255,0.45)';
      ctx.font        = '10px Poppins,sans-serif';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText(`🔥 x2 en ${segsLeft}s`, CW/2, barY - 8);
    }
  }

  function draw(level, sd, mult) {
    ctx.fillStyle = getBg(level||1);
    ctx.fillRect(0,0,CW,CH);

    /* Flash de racha activada */
    if (streakFlash > 0) {
      ctx.fillStyle = `rgba(255,153,0,${streakFlash*0.12})`;
      ctx.fillRect(0,0,CW,CH);
    }

    if (!IS_LOW_END) {
      ctx.fillStyle = level>=6?'rgba(255,77,109,0.10)':'rgba(255,102,196,0.06)';
      const lvShow = Math.min(level, 25);
ctx.font=`bold ${Math.min(180,80+lvShow*7)}px Poppins,sans-serif`;
ctx.textAlign='center'; ctx.textBaseline='middle';
ctx.fillText(lvShow,CW/2,CH/2);
    }

    drawSpikes(sd);
    heartItems.forEach(h=>drawHeart(h.x,h.y-h.r,h.r*0.9,'#ff4d6d'));
    starItems.forEach(s=>drawStar(s.x,s.y,s.r,s.rot,'#ffd93d'));

    ctx.shadowBlur=0;
    balls.forEach(b=>{
      ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      if (!IS_LOW_END) {
        ctx.fillStyle='rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.arc(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.3,0,Math.PI*2); ctx.fill();
      }
    });

    particles.forEach(p=>{
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;

    floatingTexts.forEach(t=>{
      ctx.globalAlpha=Math.max(0,t.life);
      ctx.fillStyle=t.color;
      ctx.font='bold 18px Poppins,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t.text,t.x,t.y);
    });
    ctx.globalAlpha=1;

    /* Jugador — borde según nivel de racha */
    const isHit = player.hitFlash>0 && Math.floor(player.hitFlash*8)%2===0;
    if (!isHit) {
      if (streakActive) {
        ctx.strokeStyle=getStreakColor(mult); ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(player.x,player.y,player.r+3,0,Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle='#ff4d6d';
      ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill();
      if (!IS_LOW_END) {
        ctx.fillStyle='rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(player.x-4,player.y-4,4,0,Math.PI*2); ctx.fill();
      }
    }

    /* Línea guía */
    if (touchX!==null) {
      ctx.strokeStyle='rgba(255,77,109,0.2)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(player.x,player.y); ctx.lineTo(touchX,touchY||player.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    /* Barra de racha */
    if (started && !gameOver) drawStreakBar(mult);

    /* Pantalla inicio */
    if (!started) {
      ctx.fillStyle='rgba(255,77,109,0.93)';
      ctx.beginPath(); ctx.roundRect(CW/2-130,CH/2-65,260,130,14); ctx.fill();
      ctx.fillStyle='white'; ctx.font='bold 18px Poppins,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('Evita las Bolas',CW/2,CH/2-36);
      ctx.font='12px Poppins,sans-serif';
      ctx.fillText('Mueve el dedo para esquivar',CW/2,CH/2-16);
      ctx.font='11px Poppins,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.fillText('⭐ Estrellas = +100 pts',CW/2,CH/2+4);
      ctx.fillText('❤️ Corazones = +vida',CW/2,CH/2+20);
      ctx.fillText('🔥 20s sin golpe = x2 → x3 → x4',CW/2,CH/2+36);
      ctx.fillText('Nivel 10+ pinchos ',CW/2,CH/2+52);
    }
  }

  function endGame() {
    gameOver=true; cancelAnimationFrame(frameId);
    const gained=Math.round(score);
    const level=1+Math.floor(elapsed/CFG.NIVEL_CADA_S);
    if (gained>hi) {
      hi=gained; localStorage.setItem('evb_hi',hi);
      if (window._subirPuntosJuego) window._subirPuntosJuego(hi);
    }
    setMsg('+'+gained+' pts — Toca para jugar de nuevo');
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle='white'; ctx.font='bold 28px Poppins,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Perdiste',CW/2,CH/2-38);
    ctx.font='bold 22px Poppins,sans-serif'; ctx.fillStyle='#ffd93d';
    ctx.fillText('+'+gained+' puntos',CW/2,CH/2+2);
    ctx.font='13px Poppins,sans-serif'; ctx.fillStyle='rgba(255,255,255,0.75)';
    ctx.fillText('Nivel alcanzado: '+Math.min(level,25),CW/2,CH/2+28);
    ctx.fillText('Toca para volver a jugar',CW/2,CH/2+50);
    refreshHUD();
  }

  function setMsg(t) { const el=document.getElementById('game-msg'); if(el) el.textContent=t; }

  function openGame() {
    const modal=document.getElementById('gameModal');
    if (!modal) return;
    modal.style.display='flex';
    setTimeout(()=>{ resizeCanvas(); initState(); draw(1,0,1); bindInput(); },80);
  }

  function closeGame() {
    cancelAnimationFrame(frameId); touchX=null; touchY=null;
    const modal=document.getElementById('gameModal');
    if (modal) modal.style.display='none';
  }

  window._cerrarJuego=closeGame;

  document.getElementById('game-btn')?.addEventListener('click',openGame);
  document.getElementById('closeGame')?.addEventListener('click',closeGame);
  document.getElementById('gameModal')?.addEventListener('click',e=>{ if(e.target.id==='gameModal') closeGame(); });

  document.getElementById('ranking-juego-btn')?.addEventListener('click',()=>{
    const m=document.getElementById('rankingJuegoModal');
    if(m) m.style.display='flex';
    if(window.cargarRankingJuego) window.cargarRankingJuego();
  });
  document.getElementById('closeRankingJuego')?.addEventListener('click',()=>{
    const m=document.getElementById('rankingJuegoModal'); if(m) m.style.display='none';
  });
  document.getElementById('rankingJuegoModal')?.addEventListener('click',e=>{
    if(e.target.id==='rankingJuegoModal') e.target.style.display='none';
  });

});
