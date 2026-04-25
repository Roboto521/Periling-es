import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey            : "AIzaSyD7HAFjgYC_9Ly4BcosgUpPP2wYk7ZJubY",
  authDomain        : "gomas-2530d.firebaseapp.com",
  databaseURL       : "https://gomas-2530d-default-rtdb.firebaseio.com",
  projectId         : "gomas-2530d",
  storageBucket     : "gomas-2530d.appspot.com",
  messagingSenderId : "856600921569",
  appId             : "1:856600921569:web:3e57244a3f29db5a35fea0"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
window._db = db;
console.log("🔥 Firebase listo");

function calcularNivel(puntos) {
  if (puntos >= 36) return { nombre:"💎 Platino", clase:"nivel-platino" };
  if (puntos >= 26) return { nombre:"🥇 Oro",     clase:"nivel-oro"     };
  if (puntos >= 16) return { nombre:"🥈 Plata",   clase:"nivel-plata"   };
  return                   { nombre:"🥉 Bronce",  clase:"nivel-bronce"  };
}

function calcularNivelJuego(pts) {
  if (pts >= 500) return { nombre:"👑 Leyenda", clase:"nivel-platino" };
  if (pts >= 200) return { nombre:"🔥 Pro",     clase:"nivel-oro"     };
  if (pts >= 80)  return { nombre:"⚡ Bueno",   clase:"nivel-plata"   };
  return                 { nombre:"🌱 Nuevo",   clase:"nivel-bronce"  };
}

function avatarHTML(nombre, foto) {
  if (foto) return `<img class="rank-avatar" src="${foto}" alt="${nombre}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`;
  const colores = ["#ff6b6b","#ffa07a","#ffd93d","#3ddc97","#9d6bff","#ff66c4","#4ecdc4"];
  const color   = colores[nombre.charCodeAt(0) % colores.length];
  return `<div class="rank-avatar" style="background:${color}">${nombre.charAt(0).toUpperCase()}</div>`;
}

function buildRow(u, i, medallas, uidActual) {
  const nivel = calcularNivel(u.puntos);
  const esYo  = u.uid === uidActual;
  const med   = i < 3 ? medallas[i] : `#${i+1}`;
  return `<div class="ranking-row ${esYo?"ranking-yo":""} ${i<3?"ranking-top":""}">
    <span class="rank-pos">${med}</span>
    ${avatarHTML(u.nombre, u.foto)}
    <div class="rank-info">
      <span class="rank-nombre">${u.nombre}${esYo?" <em>(tú)</em>":""}</span>
      <span class="rank-carrera">${u.carrera}</span>
      <span class="rank-nivel ${nivel.clase}">${nivel.nombre}</span>
    </div>
    <span class="rank-puntos">⭐ ${u.puntos}</span>
  </div>`;
}

function buildRowJuego(u, i, medallas, uidActual) {
  const nivel = calcularNivelJuego(u.puntosJuego);
  const esYo  = u.uid === uidActual;
  const med   = i < 3 ? medallas[i] : `#${i+1}`;
  return `<div class="ranking-row ${esYo?"ranking-yo":""} ${i<3?"ranking-top":""}">
    <span class="rank-pos">${med}</span>
    ${avatarHTML(u.nombre, u.foto)}
    <div class="rank-info">
      <span class="rank-nombre">${u.nombre}${esYo?" <em>(tú)</em>":""}</span>
      <span class="rank-carrera">${u.carrera}</span>
      <span class="rank-nivel ${nivel.clase}">${nivel.nombre}</span>
    </div>
    <span class="rank-puntos">🎮 ${u.puntosJuego}</span>
  </div>`;
}

window.cargarPuntosUsuario = function() {
  const uid = localStorage.getItem("userUID");
  if (!uid) return;
  get(ref(db, 'usuarios/' + uid)).then(snapshot => {
    if (!snapshot.exists()) return;
    window.mostrarPuntosUsuario(snapshot.val());
  });
};

window.mostrarPuntosUsuario = function(datos) {
  const badge = document.getElementById("puntos-badge");
  if (badge) { badge.innerHTML = `⭐ ${datos.puntos || 0} pts`; badge.style.display = "flex"; }
};

window.guardarPedido = function(pedido) {
  const id = Date.now().toString();
  set(ref(db, 'pedidos/' + id), { ...pedido, estado:"pendiente" })
    .then(() => console.log("📦 Pedido guardado:", id))
    .catch(e => console.error("Error:", e));
};

window.sumarPuntos = function(uid, puntosExtra) {
  get(ref(db, 'usuarios/' + uid)).then(snapshot => {
    if (snapshot.exists()) {
      const nuevos = (snapshot.val().puntos || 0) + puntosExtra;
      update(ref(db, 'usuarios/' + uid), { puntos: nuevos });
    }
  });
};

window._subirPuntosJuego = async function(pts) {
  const uid = localStorage.getItem("userUID");
  if (!uid) return;
  try {
    const snap = await get(ref(db, 'usuarios/' + uid));
    if (!snap.exists()) return;
    const actual = snap.val().puntosJuego || 0;
    if (pts > actual) {
      await update(ref(db, 'usuarios/' + uid), { puntosJuego: pts });
      console.log("🎮 Nuevo récord guardado:", pts);
    }
  } catch(e) { console.error("Error:", e); }
};

/* ===== RANKING COMPRAS — Top 10 visible, resto oculto, mi posición ===== */
window.cargarRanking = function() {
  const tablaEl  = document.getElementById("ranking-lista");
  const restoEl  = document.getElementById("ranking-resto");
  const verMasBtn= document.getElementById("ranking-ver-mas");
  const miPosEl  = document.getElementById("mi-posicion");

  tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Cargando...</p>";

  get(ref(db, 'usuarios')).then(snapshot => {
    if (!snapshot.exists()) {
      tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>No hay usuarios aún.</p>";
      return;
    }
    const uidActual = localStorage.getItem("userUID") || "";
    const medallas  = ["🥇","🥈","🥉"];
    const lista = Object.entries(snapshot.val())
      .map(([uid, info]) => ({ uid, nombre:info.nombre||"Anónimo", carrera:info.carrera||"", puntos:info.puntos||0, foto:info.foto||"" }))
      .sort((a,b) => b.puntos - a.puntos);

    const top10 = lista.slice(0, 10);
    const resto = lista.slice(10);

    // Renderizar top 10
    tablaEl.innerHTML = top10.map((u,i) => buildRow(u, i, medallas, uidActual)).join("");

    // Renderizar resto
    if (resto.length > 0) {
      restoEl.innerHTML = resto.map((u,i) => buildRow(u, i+10, medallas, uidActual)).join("");
      verMasBtn.style.display = "block";
      // Resetear estado del botón
      restoEl.style.display = "none";
      verMasBtn.textContent = "Ver ranking completo ▼";
    } else {
      verMasBtn.style.display = "none";
    }

    // Mi posición
    const miPos = lista.findIndex(u => u.uid === uidActual);
    if (miPos !== -1) {
      const yo = lista[miPos];
      const nivel = calcularNivel(yo.puntos);
      let faltaTexto = "";
      if (miPos > 0) {
        const arriba = lista[miPos - 1];
        const falta = arriba.puntos - yo.puntos;
        faltaTexto = falta > 0 ? `\nTe faltan <strong>${falta} pts</strong> para superar a <strong>${arriba.nombre}</strong>` : "";
      } else {
        faltaTexto = "\n🏆 ¡Eres el #1!";
      }
      miPosEl.innerHTML = `📍 Estás en el puesto <strong>#${miPos+1}</strong> con <strong>${yo.puntos} pts</strong> — ${nivel.nombre}${faltaTexto}`;
      miPosEl.style.display = "block";
    } else {
      miPosEl.style.display = "none";
    }
  });
};

/* ===== RANKING JUEGO — Top 10 visible, resto oculto, mi posición ===== */
window.cargarRankingJuego = function() {
  const tablaEl  = document.getElementById("ranking-juego-lista");
  const restoEl  = document.getElementById("ranking-juego-resto");
  const verMasBtn= document.getElementById("ranking-juego-ver-mas");
  const miPosEl  = document.getElementById("mi-posicion-juego");

  tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Cargando...</p>";

  get(ref(db, 'usuarios')).then(snapshot => {
    if (!snapshot.exists()) {
      tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Nadie ha jugado aún.</p>";
      return;
    }
    const uidActual = localStorage.getItem("userUID") || "";
    const medallas  = ["🥇","🥈","🥉"];
    const lista = Object.entries(snapshot.val())
      .map(([uid, info]) => ({ uid, nombre:info.nombre||"Anónimo", carrera:info.carrera||"", puntosJuego:info.puntosJuego||0, foto:info.foto||"" }))
      .filter(u => u.puntosJuego > 0)
      .sort((a,b) => b.puntosJuego - a.puntosJuego);

    if (lista.length === 0) {
      tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Nadie ha jugado aún — ¡sé el primero!</p>";
      verMasBtn.style.display = "none";
      miPosEl.style.display = "none";
      return;
    }

    const top10 = lista.slice(0, 10);
    const resto = lista.slice(10);

    tablaEl.innerHTML = top10.map((u,i) => buildRowJuego(u, i, medallas, uidActual)).join("");

    if (resto.length > 0) {
      restoEl.innerHTML = resto.map((u,i) => buildRowJuego(u, i+10, medallas, uidActual)).join("");
      verMasBtn.style.display = "block";
      restoEl.style.display = "none";
      verMasBtn.textContent = "Ver ranking completo ▼";
    } else {
      verMasBtn.style.display = "none";
    }

    // Mi posición juego
    const miPos = lista.findIndex(u => u.uid === uidActual);
    if (miPos !== -1) {
      const yo = lista[miPos];
      const nivel = calcularNivelJuego(yo.puntosJuego);
      let faltaTexto = "";
      if (miPos > 0) {
        const arriba = lista[miPos - 1];
        const falta = arriba.puntosJuego - yo.puntosJuego;
        faltaTexto = falta > 0 ? `\nTe faltan <strong>${falta} pts</strong> para superar a <strong>${arriba.nombre}</strong>` : "";
      } else {
        faltaTexto = "\n👑 ¡Eres el #1!";
      }
      miPosEl.innerHTML = `🎮 Estás en el puesto <strong>#${miPos+1}</strong> con <strong>${yo.puntosJuego} pts</strong> — ${nivel.nombre}${faltaTexto}`;
      miPosEl.style.display = "block";
    } else {
      miPosEl.style.display = "none";
    }
  });
};

/* ===== TICKER — compras y juego ===== */
window.cargarTicker = function() {
  get(ref(db, 'usuarios')).then(snapshot => {
    if (!snapshot.exists()) return;
    const usuarios = Object.values(snapshot.val());
    const medallas = ["🥇","🥈","🥉"];

    const topCompras = usuarios
      .filter(u => (u.puntos||0) > 0)
      .sort((a,b) => (b.puntos||0) - (a.puntos||0))
      .slice(0,3);

    const topJuego = usuarios
      .filter(u => (u.puntosJuego||0) > 0)
      .sort((a,b) => (b.puntosJuego||0) - (a.puntosJuego||0))
      .slice(0,3);

    const tickerCompras = document.getElementById("ticker-contenido");
    if (tickerCompras && topCompras.length > 0) {
      const itemsC = topCompras.map((u,i) => `${medallas[i]} ${u.nombre||"Anónimo"} (${u.puntos||0}pts)`);
      let idxC = 0;
      function rotarCompras() {
        tickerCompras.style.opacity = "0";
        setTimeout(() => {
          tickerCompras.textContent  = "🏆 " + itemsC[idxC];
          tickerCompras.style.opacity = "1";
          idxC = (idxC + 1) % itemsC.length;
        }, 400);
      }
      rotarCompras();
      setInterval(rotarCompras, 3000);
    }

    const tickerJuego = document.getElementById("ticker-juego-contenido");
    if (tickerJuego && topJuego.length > 0) {
      const itemsJ = topJuego.map((u,i) => `${medallas[i]} ${u.nombre||"Anónimo"} (${u.puntosJuego||0}pts)`);
      let idxJ = 0;
      function rotarJuego() {
        tickerJuego.style.opacity = "0";
        setTimeout(() => {
          tickerJuego.textContent  = "🎮 " + itemsJ[idxJ];
          tickerJuego.style.opacity = "1";
          idxJ = (idxJ + 1) % itemsJ.length;
        }, 400);
      }
      rotarJuego();
      setInterval(rotarJuego, 3000);
    } else if (tickerJuego) {
      tickerJuego.textContent = "🎮 ¡Juega para aparecer aquí!";
    }
  });
};
