/* game.js — Evita las Bolas · Party Perilingüe (versión optimizada) */

document.addEventListener('DOMContentLoaded', function () {

  const CFG = { PTS_POR_SEGUNDO:10, BONUS_CADA_10S:25, MAX_VIDAS:3 };

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2); /* máximo 2x para no sobrecargar */
  let CW = 360, CH = 414;
  let inputBound = false;
  let touchX = null, touchY = null;

  /* Detectar si es teléfono lento — usa 1x si la pantalla es pequeña y DPR alto */
  const IS_LOW_END = navigator.hardwareConcurrency <= 4 || (window.screen.width < 400 && DPR > 1);

  function resizeCanvas() {
    const box = document.getElementById('gameBox');
    CW = Math.min(box ? box.offsetWidth : 360, 400);
    CH = Math.round(CW * 1.15);
    /* En teléfonos lentos usar DPR=1 para reducir píxeles a dibujar */
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
  let player, balls, particles, heartItems;
  let score, elapsed, gameOver, started, frameId, lastTs, ptAcc, lastBonusMark, spawnTimer, heartSpawnTimer, lives;

  function getLevelConfig(l) {
    if (l<=2)  return {speed:85,  sv:25, int:1.10, max:5,  w:10};
    if (l<=4)  return {speed:110, sv:32, int:0.92, max:8,  w:14};
    if (l<=6)  return {speed:145, sv:42, int:0.75, max:11, w:19};
    if (l<=8)  return {speed:178, sv:52, int:0.61, max:14, w:25};
    if (l<=10) return {speed:210, sv:60, int:0.50, max:17, w:30};
    if (l<=12) return {speed:238, sv:66, int:0.42, max:20, w:35};
    if (l<=14) return {speed:262, sv:70, int:0.36, max:23, w:40};
    if (l<=16) return {speed:282, sv:74, int:0.31, max:26, w:45};
    if (l<=20) return {speed:300, sv:78, int:0.27, max:28, w:49};
    if (l<=25) return {speed:315, sv:82, int:0.23, max:30, w:53};
    return {speed:330+(l-25)*3, sv:88, int:Math.max(0.15,0.20-(l-25)*0.004), max:32+Math.floor((l-25)/2), w:58};
  }
function getSpikeDepth(l) {
  if (l < 10) return 0;
  return 6; // tamaño fijo como nivel 10
}

  function initState() {
    player={x:CW/2,y:CH/2,r:14,tx:CW/2,ty:CH/2,hitFlash:0};
    balls=[];particles=[];heartItems=[];
    score=0;elapsed=0;ptAcc=0;lastBonusMark=0;
    spawnTimer=0;heartSpawnTimer=0;
    gameOver=false;started=false;
    lives=CFG.MAX_VIDAS;
    refreshLivesHUD();
  }

  function refreshLivesHUD() {
    const el=document.getElementById('g-lives');
    if (!el) return;
    let s='';
    for (let i=0;i<CFG.MAX_VIDAS;i++) s+=i<lives?'❤️':'🖤';
    el.textContent=s;
    const hEl=document.getElementById('g-hi');
    if (hEl) hEl.textContent=hi;
  }

  function bindInput() {
    if (inputBound) return;
    inputBound=true;
    canvas.addEventListener('touchstart',e=>{
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      touchX=(e.touches[0].clientX-r.left)*(CW/r.width);
      touchY=(e.touches[0].clientY-r.top)*(CH/r.height);
      if (!started||gameOver) startGame();
    },{passive:false});
    canvas.addEventListener('touchmove',e=>{
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      touchX=(e.touches[0].clientX-r.left)*(CW/r.width);
      touchY=(e.touches[0].clientY-r.top)*(CH/r.height);
    },{passive:false});
    canvas.addEventListener('touchend',()=>{touchX=null;touchY=null;});
    canvas.addEventListener('mousemove',e=>{
      if (!started||gameOver) return;
      const r=canvas.getBoundingClientRect();
      touchX=(e.clientX-r.left)*(CW/r.width);
      touchY=(e.clientY-r.top)*(CH/r.height);
    });
    canvas.addEventListener('click',()=>{if(!started||gameOver)startGame();});
  }

  function startGame() {
    initState();started=true;lastTs=performance.now();
    cancelAnimationFrame(frameId);
    setMsg('Mueve el dedo y esquiva las bolas!');
    frameId=requestAnimationFrame(loop);
  }

  function spawnBall(cfg,sd) {
    const speed=cfg.speed+Math.random()*cfg.sv;
    const r=8+Math.random()*10;
    const minX=sd+r+4, maxX=CW-sd-r-4;
    if (maxX<=minX) return;
    const x=minX+Math.random()*(maxX-minX);
    balls.push({x,y:-r,r,vx:(Math.random()-0.5)*speed*0.4,vy:speed,
      color:BCOLS[Math.floor(Math.random()*BCOLS.length)],
      wobble:Math.random()*Math.PI*2,wobbleAmp:cfg.w,wobbleSpeed:1.5+Math.random()*2.5});
  }

  function spawnHeart(sd) {
    if (lives>=CFG.MAX_VIDAS) return;
    const r=18, minX=sd+r+10, maxX=CW-sd-r-10;
    if (maxX<=minX) return;
    heartItems.push({x:minX+Math.random()*(maxX-minX),y:-r,r,vy:55+Math.random()*30});
  }

  /* Partículas reducidas en teléfonos lentos */
  function addParticles(x,y,color,n=12) {
    const count = IS_LOW_END ? Math.floor(n/2) : n;
    for (let i=0;i<count;i++){
      const a=(Math.PI*2/count)*i+Math.random()*0.5, sp=60+Math.random()*90;
      particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:3+Math.random()*4,life:1,color});
    }
  }

  function drawSpikes(sd) {
    if (sd<=0) return;
    const sz=20, p=1+Math.sin(elapsed*4)*0.07;
    ctx.fillStyle='#ff2244';
    /* Sin shadowBlur — muy costoso en móvil */
    for (let i=-1;i<Math.ceil(CH/sz)+2;i++){
      const y=i*sz;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(sd*p,y+sz/2);ctx.lineTo(0,y+sz);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(CW,y);ctx.lineTo(CW-sd*p,y+sz/2);ctx.lineTo(CW,y+sz);ctx.closePath();ctx.fill();
    }
    for (let i=-1;i<Math.ceil(CW/sz)+2;i++){
      const x=i*sz;
      ctx.beginPath();ctx.moveTo(x,CH);ctx.lineTo(x+sz/2,CH-sd*p);ctx.lineTo(x+sz,CH);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+sz/2,sd*p);ctx.lineTo(x+sz,0);ctx.closePath();ctx.fill();
    }
  }

  function checkSpike(sd){
    if(sd<=0)return false;
    return player.x-player.r<sd||player.x+player.r>CW-sd||player.y-player.r<sd||player.y+player.r>CH-sd;
  }

  function loseLife(){
    lives--;refreshLivesHUD();player.hitFlash=1.2;
    addParticles(player.x,player.y,'#ff4d6d',14);
    if(lives<=0)endGame();
  }

  function loop(ts){
    const dt=Math.min((ts-lastTs)/1000,0.05);
    lastTs=ts;elapsed+=dt;
    const level=1+Math.floor(elapsed/10);
    const cfg=getLevelConfig(level);
    const sd=getSpikeDepth(level);

    const lvEl=document.getElementById('g-lv');
    if(lvEl)lvEl.textContent=level;
    if(player.hitFlash>0)player.hitFlash-=dt;

    const sL=player.r, sR=CW-player.r, sT=player.r, sB=CH-player.r;
    if(touchX!==null){
      player.tx=Math.max(sL,Math.min(sR,touchX));
      player.ty=Math.max(sT,Math.min(sB,touchY||player.ty));
    }
    player.x+=(player.tx-player.x)*0.25; player.y+=(player.ty-player.y)*0.25;
    player.x=Math.max(sL,Math.min(sR,player.x)); player.y=Math.max(sT,Math.min(sB,player.y));

    if(checkSpike(sd)&&player.hitFlash<=0){loseLife();if(gameOver)return;}

    spawnTimer+=dt;
    if(spawnTimer>=cfg.int&&balls.length<Math.floor(cfg.max)){spawnBall(cfg,sd);spawnTimer=0;}
    heartSpawnTimer+=dt;
    if(heartSpawnTimer>=20){spawnHeart(sd);heartSpawnTimer=0;}

    for(let i=balls.length-1;i>=0;i--){
      const b=balls[i];
      b.wobble+=b.wobbleSpeed*dt;
      b.x+=(b.vx+Math.sin(b.wobble)*b.wobbleAmp)*dt; b.y+=b.vy*dt;
      if(b.y-b.r>CH+20||b.x<-50||b.x>CW+50){balls.splice(i,1);continue;}
      const dx=player.x-b.x, dy=player.y-b.y;
      if(Math.sqrt(dx*dx+dy*dy)<player.r+b.r-2&&player.hitFlash<=0){balls.splice(i,1);loseLife();if(gameOver)return;}
    }

    for(let i=heartItems.length-1;i>=0;i--){
      const h=heartItems[i]; h.y+=h.vy*dt;
      if(h.y-h.r>CH+10){heartItems.splice(i,1);continue;}
      const dx=player.x-h.x, dy=player.y-h.y;
      if(Math.sqrt(dx*dx+dy*dy)<player.r+h.r){
        lives=Math.min(CFG.MAX_VIDAS,lives+1);refreshLivesHUD();
        addParticles(h.x,h.y,'#ff4d6d',8);heartItems.splice(i,1);
      }
    }

    ptAcc+=CFG.PTS_POR_SEGUNDO*dt;
    if(ptAcc>=1){const p=Math.floor(ptAcc);score+=p;ptAcc-=p;}
    const bm=Math.floor(elapsed/10);
    if(bm>lastBonusMark){score+=CFG.BONUS_CADA_10S;lastBonusMark=bm;addParticles(player.x,player.y-30,'#ffd93d',8);}

    /* Actualizar partículas */
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=120*dt; p.life-=dt*1.5;
      if(p.life<=0)particles.splice(i,1);
    }

    /* Limitar partículas máximas para no saturar */
    if(particles.length>60) particles.splice(0, particles.length-60);

    const scEl=document.getElementById('g-sc');
    if(scEl)scEl.textContent=Math.round(score);
    draw(level,sd);
    frameId=requestAnimationFrame(loop);
  }

  function getBg(l){
    if(l<=2)return'#fff0f5';
    if(l<=5)return'#ffe0f0';
    if(l<=8)return'#1a0a2e';
    if(l<=14)return'#0d0019';
    return'#000';
  }

  function drawHeart(x,y,sz,color){
    ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(x,y+sz*0.3);
    ctx.bezierCurveTo(x,y,x-sz,y,x-sz,y+sz*0.4);
    ctx.bezierCurveTo(x-sz,y+sz*0.9,x,y+sz*1.3,x,y+sz*1.5);
    ctx.bezierCurveTo(x,y+sz*1.3,x+sz,y+sz*0.9,x+sz,y+sz*0.4);
    ctx.bezierCurveTo(x+sz,y,x,y,x,y+sz*0.3);
    ctx.closePath();ctx.fill();
  }

  function draw(level,sd){
    /* Fondo simple — sin gradientes en móvil lento */
    ctx.fillStyle=getBg(level||1);
    ctx.fillRect(0,0,CW,CH);

    /* Número de nivel de fondo — solo si no es teléfono lento */
    if(!IS_LOW_END){
      ctx.fillStyle=level>=6?'rgba(255,77,109,0.10)':'rgba(255,102,196,0.06)';
      ctx.font=`bold ${Math.min(180,80+level*7)}px Poppins,sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(level,CW/2,CH/2);
    }

    drawSpikes(sd);

    /* Corazones */
    heartItems.forEach(h=>drawHeart(h.x,h.y-h.r,h.r*0.9,'#ff4d6d'));

    /* Bolas — sin shadowBlur (costoso) */
    ctx.shadowBlur=0;
    balls.forEach(b=>{
      ctx.fillStyle=b.color;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      /* Brillo sólo en teléfonos rápidos */
      if(!IS_LOW_END){
        ctx.fillStyle='rgba(255,255,255,0.28)';
        ctx.beginPath();ctx.arc(b.x-b.r*0.3,b.y-b.r*0.3,b.r*0.3,0,Math.PI*2);ctx.fill();
      }
    });

    /* Partículas */
    particles.forEach(p=>{
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;

    /* Jugador */
    const isHit=player.hitFlash>0&&Math.floor(player.hitFlash*8)%2===0;
    if(!isHit){
      ctx.fillStyle='#ff4d6d';
      ctx.beginPath();ctx.arc(player.x,player.y,player.r,0,Math.PI*2);ctx.fill();
      if(!IS_LOW_END){
        ctx.fillStyle='rgba(255,255,255,0.45)';
        ctx.beginPath();ctx.arc(player.x-4,player.y-4,4,0,Math.PI*2);ctx.fill();
      }
    }

    /* Línea guía dedo */
    if(touchX!==null){
      ctx.strokeStyle='rgba(255,77,109,0.2)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(touchX,touchY||player.y);ctx.stroke();
      ctx.setLineDash([]);
    }

    /* Pantalla inicio */
    if(!started){
      ctx.fillStyle='rgba(255,77,109,0.93)';
      ctx.beginPath();ctx.roundRect(CW/2-120,CH/2-56,240,112,14);ctx.fill();
      ctx.fillStyle='white';ctx.font='bold 18px Poppins,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('Evita las Bolas',CW/2,CH/2-24);
      ctx.font='12px Poppins,sans-serif';
      ctx.fillText('Mueve el dedo para esquivar',CW/2,CH/2-2);
      ctx.font='11px Poppins,sans-serif';ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillText('Agarra corazones para mas vidas',CW/2,CH/2+18);
      ctx.fillText('Nivel 10+ pinchos · Nivel 30+ imposible',CW/2,CH/2+36);
    }
  }

  function endGame(){
    gameOver=true;cancelAnimationFrame(frameId);
    const gained=Math.round(score);
    const level=1+Math.floor(elapsed/10);
    if(gained>hi){
      hi=gained;
      localStorage.setItem('evb_hi',hi);
      if(window._subirPuntosJuego) window._subirPuntosJuego(hi);
    }
    setMsg('+'+gained+' pts — Toca para jugar de nuevo');
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle='white';ctx.font='bold 28px Poppins,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('Perdiste',CW/2,CH/2-38);
    ctx.font='bold 22px Poppins,sans-serif';ctx.fillStyle='#ffd93d';
    ctx.fillText('+'+gained+' puntos',CW/2,CH/2+2);
    ctx.font='13px Poppins,sans-serif';ctx.fillStyle='rgba(255,255,255,0.75)';
    ctx.fillText('Nivel alcanzado: '+level,CW/2,CH/2+28);
    ctx.fillText('Toca para volver a jugar',CW/2,CH/2+50);
    refreshLivesHUD();
  }

  function setMsg(t){const el=document.getElementById('game-msg');if(el)el.textContent=t;}

  function openGame(){
    const modal=document.getElementById('gameModal');
    if(!modal)return;
    modal.style.display='flex';
    setTimeout(()=>{resizeCanvas();initState();draw(1,0);bindInput();},80);
  }

  function closeGame(){
    cancelAnimationFrame(frameId);touchX=null;touchY=null;
    const modal=document.getElementById('gameModal');
    if(modal)modal.style.display='none';
  }

  /* Exponer para script.js (cerrar desde otros modales) */
  window._cerrarJuego = closeGame;

  document.getElementById('game-btn')?.addEventListener('click',openGame);
  document.getElementById('closeGame')?.addEventListener('click',closeGame);
  document.getElementById('gameModal')?.addEventListener('click',e=>{if(e.target.id==='gameModal')closeGame();});

  document.getElementById('ranking-juego-btn')?.addEventListener('click',()=>{
    const m=document.getElementById('rankingJuegoModal');
    if(m)m.style.display='flex';
    if(window.cargarRankingJuego)window.cargarRankingJuego();
  });
  document.getElementById('closeRankingJuego')?.addEventListener('click',()=>{
    const m=document.getElementById('rankingJuegoModal');if(m)m.style.display='none';
  });
  document.getElementById('rankingJuegoModal')?.addEventListener('click',e=>{
    if(e.target.id==='rankingJuegoModal')e.target.style.display='none';
  });

});
