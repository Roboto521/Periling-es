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

const db = getDatabase(initializeApp(firebaseConfig));
window._db = db;

/* ===== NIVELES ===== */
function calcularNivel(puntos) {
 if (puntos >= 500) return { nombre:"⚡ Elite", clase:"nivel-elite" };
  if (puntos >= 61)  return { nombre:"💎 Platino", clase:"nivel-platino" };
  if (puntos >= 41)  return { nombre:"🥇 Oro",     clase:"nivel-oro"     };
  if (puntos >= 21)  return { nombre:"🥈 Plata",   clase:"nivel-plata"   };
  return                    { nombre:"🥉 Bronce",  clase:"nivel-bronce"  };
}

function calcularNivelJuego(pts) {
  if (pts >= 5000) return { nombre:"🚀 Galáctico", clase:"nivel-galactico" };
  if (pts >= 2500) return { nombre:"👑 Leyenda", clase:"nivel-oro"     };
  if (pts >= 800)  return { nombre:"🔥 Pro",     clase:"nivel-plata"   };
  if (pts >= 200)  return { nombre:"⚡ Bueno",   clase:"nivel-bronce"  };
  return                  { nombre:"🌱 Nuevo",   clase:"nivel-bronce"  };
}

/* ===== AVATAR ===== */
function avatarHTML(nombre, foto) {
  if (foto) return `<img class="rank-avatar" src="${foto}" alt="${nombre}">`;
  const colores = ["#ff6b6b","#ffa07a","#ffd93d","#3ddc97","#9d6bff","#ff66c4","#4ecdc4"];
  const color   = colores[nombre.charCodeAt(0) % colores.length];
  return `<div class="rank-avatar" style="background:${color}">${nombre.charAt(0).toUpperCase()}</div>`;
}

/* ===== FILAS RANKING ===== */
const MEDALLAS = ["🥇","🥈","🥉"];

function buildRow(u, i, uidActual, icono, nivel, campo) {
  const esYo = u.uid === uidActual;
  const med  = i < 3 ? MEDALLAS[i] : `#${i + 1}`;
  const pts  = u[campo];
  return `<div class="ranking-row ${esYo ? "ranking-yo" : ""} ${i < 3 ? "ranking-top" : ""}">
    <span class="rank-pos">${med}</span>
    ${avatarHTML(u.nombre, u.foto)}
    <div class="rank-info">
      <span class="rank-nombre">${u.nombre}${esYo ? " <em>(tú)</em>" : ""}</span>
      <span class="rank-carrera">${u.carrera}</span>
      <span class="rank-nivel ${nivel.clase}">${nivel.nombre}</span>
    </div>
    <span class="rank-puntos">${icono} ${pts}</span>
  </div>`;
}

/* ===== HELPERS RANKING ===== */
function renderRanking({ lista, tablaEl, restoEl, verMasBtn, uidActual, icono, calcNivel, campo }) {
  const top10 = lista.slice(0, 10);
  const resto = lista.slice(10);

  tablaEl.innerHTML = top10.map((u, i) => buildRow(u, i, uidActual, icono, calcNivel(u[campo]), campo)).join("");

  if (restoEl) restoEl.innerHTML = "";

  if (resto.length > 0) {
    const restoDiv = document.createElement("div");
    restoDiv.className = "ranking-resto-inner";
    restoDiv.style.display = "none";
    restoDiv.innerHTML = resto.map((u, i) => buildRow(u, i + 10, uidActual, icono, calcNivel(u[campo]), campo)).join("");
    tablaEl.appendChild(restoDiv);

    verMasBtn.style.display = "block";
    verMasBtn.textContent   = "Ver ranking completo ▼";

    const nuevoBtn = verMasBtn.cloneNode(true);
    verMasBtn.parentNode.replaceChild(nuevoBtn, verMasBtn);
    nuevoBtn.addEventListener("click", function () {
      const abierto = restoDiv.style.display !== "none";
      restoDiv.style.display = abierto ? "none" : "block";
      this.textContent = abierto ? "Ver ranking completo ▼" : "Ver menos ▲";
      if (!abierto) tablaEl.scrollTop = tablaEl.scrollHeight;
    });
  } else {
    verMasBtn.style.display = "none";
  }
}

/* ===== PUNTOS USUARIO ===== */
window.cargarPuntosUsuario = function () {
  const uid = localStorage.getItem("userUID");
  if (!uid) return;
  get(ref(db, "usuarios/" + uid)).then(snap => {
    if (snap.exists()) window.mostrarPuntosUsuario(snap.val());
  });
};

window.mostrarPuntosUsuario = function (datos) {
  const badge = document.getElementById("puntos-badge");
  if (badge) { badge.innerHTML = `⭐ ${datos.puntos || 0} pts`; badge.style.display = "flex"; }
};

/* ===== PEDIDOS ===== */
window.guardarPedido = function (pedido) {
  set(ref(db, "pedidos/" + Date.now()), { ...pedido, estado: "pendiente" })
    .catch(e => console.error("Error guardando pedido:", e));
};

/* ===== PUNTOS COMPRAS ===== */
window.sumarPuntos = function (uid, puntosExtra) {
  get(ref(db, "usuarios/" + uid)).then(snap => {
    if (snap.exists()) {
      update(ref(db, "usuarios/" + uid), { puntos: (snap.val().puntos || 0) + puntosExtra });
    }
  });
};

/* ===== PUNTOS JUEGO ===== */
window._subirPuntosJuego = async function (pts) {
  const uid = localStorage.getItem("userUID");
  if (!uid) return;
  try {
    const snap = await get(ref(db, "usuarios/" + uid));
    if (snap.exists() && pts > (snap.val().puntosJuego || 0)) {
      await update(ref(db, "usuarios/" + uid), { puntosJuego: pts });
    }
  } catch (e) { console.error("Error guardando puntos juego:", e); }
};

/* ===== RANKING COMPRAS ===== */
window.cargarRanking = function () {
  const tablaEl   = document.getElementById("ranking-lista");
  const restoEl   = document.getElementById("ranking-resto");
  const verMasBtn = document.getElementById("ranking-ver-mas");

  tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Cargando...</p>";

  get(ref(db, "usuarios")).then(snap => {
    if (!snap.exists()) { tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>No hay usuarios aún.</p>"; return; }

    const uidActual = localStorage.getItem("userUID") || "";
    const lista = Object.entries(snap.val())
      .map(([uid, d]) => ({ uid, nombre: d.nombre || "Anónimo", carrera: d.carrera || "", puntos: d.puntos || 0, foto: d.foto || "" }))
      .sort((a, b) => b.puntos - a.puntos);

    renderRanking({ lista, tablaEl, restoEl, verMasBtn, uidActual, icono: "⭐", calcNivel: calcularNivel, campo: "puntos" });
  });
};

/* ===== RANKING JUEGO ===== */
window.cargarRankingJuego = function () {
  const tablaEl   = document.getElementById("ranking-juego-lista");
  const restoEl   = document.getElementById("ranking-juego-resto");
  const verMasBtn = document.getElementById("ranking-juego-ver-mas");

  tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Cargando...</p>";

  get(ref(db, "usuarios")).then(snap => {
    if (!snap.exists()) { tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Nadie ha jugado aún.</p>"; return; }

    const uidActual = localStorage.getItem("userUID") || "";
    const lista = Object.entries(snap.val())
      .map(([uid, d]) => ({ uid, nombre: d.nombre || "Anónimo", carrera: d.carrera || "", puntosJuego: d.puntosJuego || 0, foto: d.foto || "" }))
      .filter(u => u.puntosJuego > 0)
      .sort((a, b) => b.puntosJuego - a.puntosJuego);

    if (lista.length === 0) {
      tablaEl.innerHTML = "<p style='text-align:center;color:#aaa'>Nadie ha jugado aún — ¡sé el primero!</p>";
      verMasBtn.style.display = "none";
      return;
    }

    renderRanking({ lista, tablaEl, restoEl, verMasBtn, uidActual, icono: "🎮", calcNivel: calcularNivelJuego, campo: "puntosJuego" });
  });
};

/* ===== TICKER ===== */
window.cargarTicker = function () {
  get(ref(db, "usuarios")).then(snap => {
    if (!snap.exists()) return;
    const usuarios = Object.values(snap.val());

    function iniciarTicker(elementId, prefijo, lista, campo) {
      const el = document.getElementById(elementId);
      if (!el || lista.length === 0) {
        if (el) el.textContent = prefijo === "🎮" ? "🎮 ¡Juega para aparecer aquí!" : "";
        return;
      }
      const items = lista.map((u, i) => `${MEDALLAS[i]} ${u.nombre || "Anónimo"} (${u[campo]}pts)`);
      let idx = 0;
      function rotar() {
        el.style.opacity = "0";
        setTimeout(() => { el.textContent = prefijo + " " + items[idx]; el.style.opacity = "1"; idx = (idx + 1) % items.length; }, 400);
      }
      rotar();
      setInterval(rotar, 3000);
    }

    iniciarTicker("ticker-contenido", "🏆",
      usuarios.filter(u => (u.puntos || 0) > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 3),
      "puntos"
    );
    iniciarTicker("ticker-juego-contenido", "🎮",
      usuarios.filter(u => (u.puntosJuego || 0) > 0).sort((a, b) => b.puntosJuego - a.puntosJuego).slice(0, 3),
      "puntosJuego"
    );
  });
};
