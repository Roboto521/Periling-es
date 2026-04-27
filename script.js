if (localStorage.getItem("loggedIn") !== "true") {
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", function () {

  /* ===== DATOS DE USUARIO ===== */
  const nombreInput = document.getElementById("cliente-nombre");
  const gradoInput  = document.getElementById("cliente-grado");
  if (nombreInput) nombreInput.value = localStorage.getItem("userName") || "";
  if (gradoInput)  gradoInput.value  = localStorage.getItem("userGrado") || "";

  setTimeout(() => {
    window.cargarPuntosUsuario?.();
    window.cargarTicker?.();
  }, 500);

  /* ===== SWIPER ===== */
  if (document.querySelector(".mySwiper-1")) {
    new Swiper(".mySwiper-1", {
      slidesPerView : 1, spaceBetween: 30, loop: true,
      pagination    : { el:".swiper-pagination", clickable:true },
      navigation    : { nextEl:".swiper-button-next", prevEl:".swiper-button-prev" }
    });
  }

  /* ===== TABS ===== */
  const tabBtns     = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  function activateTab(tabId) {
    tabBtns.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add("active");
    document.getElementById(tabId)?.classList.add("active");
  }
  tabBtns.forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));

  /* ===== BÚSQUEDA ===== */
  document.getElementById("searchInput")?.addEventListener("input", function () {
    const term = this.value.toLowerCase().trim();
    let firstMatchTab = null;
    tabContents.forEach(tab => {
      let found = false;
      tab.querySelectorAll(".product").forEach(product => {
        const match = term === "" || product.innerText.toLowerCase().includes(term);
        product.style.display = match ? "flex" : "none";
        if (match) found = true;
      });
      if (found && !firstMatchTab) firstMatchTab = tab.id;
    });
    if (firstMatchTab) activateTab(firstMatchTab);
  });

  /* ===== CERRAR TODOS LOS MODALES ===== */
  function cerrarTodosLosModales() {
    ['rankingModal','rankingJuegoModal','gameModal','resultModal','modelosModal','secretariasModal'].forEach(id => {
      const m = document.getElementById(id);
      if (m) m.style.display = 'none';
    });
    window._cerrarJuego?.();
  }

  /* ===== CERRAR MODAL AL CLICK EN FONDO ===== */
  function cerrarAlFondo(id) {
    document.getElementById(id)?.addEventListener("click", e => {
      if (e.target.id === id) e.target.style.display = "none";
    });
  }

  /* ===== SLIDER — agregar desde header ===== */
  window.agregarDesdeSlider = function(name) {
    document.querySelector(`.add-to-cart[data-name="${name}"]`)?.click();
    const dropdown = document.getElementById('cart-dropdown');
    if (dropdown) dropdown.style.display = 'block';
  };

  /* ===== CARRITO ===== */
  let cart = [];
  const cartItemsList = document.getElementById("cart-items");
  const cartTotal     = document.getElementById("cart-total");
  const cartCount     = document.getElementById("cart-count");
  const cartDropdown  = document.getElementById("cart-dropdown");

  document.getElementById("cart-toggle")?.addEventListener("click", () => {
    cartDropdown.style.display = cartDropdown.style.display === "block" ? "none" : "block";
  });

  function agregarAlCarrito(name, price, img) {
    const existing = cart.find(item => item.name === name);
    if (existing) existing.quantity++;
    else cart.push({ name, price: parseFloat(price), img, quantity: 1 });
    updateCart();
  }

  document.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", () => agregarAlCarrito(btn.dataset.name, btn.dataset.price, btn.dataset.img));
  });

  document.addEventListener('agregarProducto', e => {
    agregarAlCarrito(e.detail.name, e.detail.price, e.detail.img);
  });

  function updateCart() {
    cartItemsList.innerHTML = "";
    let total = 0, count = 0;
    cart.forEach((item, index) => {
      total += item.price * item.quantity;
      count += item.quantity;
      const li = document.createElement("li");
      li.innerHTML = `
        <img src="${item.img}" width="40">
        ${item.name} x${item.quantity}
        <button class="minus" data-index="${index}">➖</button>
        <button class="remove" data-index="${index}">❌</button>`;
      cartItemsList.appendChild(li);
    });
    cartTotal.textContent = total.toFixed(2);
    cartCount.textContent = count;
    cartItemsList.querySelectorAll(".minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.dataset.index);
        if (--cart[i].quantity <= 0) cart.splice(i, 1);
        updateCart();
      });
    });
    cartItemsList.querySelectorAll(".remove").forEach(btn => {
      btn.addEventListener("click", () => { cart.splice(parseInt(btn.dataset.index), 1); updateCart(); });
    });
  }

  document.getElementById("clear-cart")?.addEventListener("click", () => { cart = []; updateCart(); });

  /* ===== COMPRAR ===== */
  document.getElementById("buy-cart")?.addEventListener("click", () => {
    if (cart.length === 0) { alert("Tu carrito está vacío 🍬"); return; }
    const nombre = localStorage.getItem("userName")  || "No indicado";
    const grado  = localStorage.getItem("userGrado") || "No indicado";
    const uid    = localStorage.getItem("userUID")   || "";
    const total  = parseFloat(cartTotal.textContent);
    window.guardarPedido?.({ uid, nombre, grado, items:[...cart], total, puntos:Math.floor(total), fecha:new Date().toLocaleString("es-GT") });
    let mensaje = `🍬 Pedido Party Perilingües 🍬\n\n👤 Nombre: ${nombre}\n🎓 Grado/Carrera: ${grado}\n\n`;
    cart.forEach(item => { mensaje += `• ${item.name} x${item.quantity} — Q${item.price * item.quantity}\n`; });
    mensaje += `\n💰 Total: Q${total.toFixed(2)}`;
    cart = []; updateCart();
    window.location.href = `https://wa.me/50239411839?text=${encodeURIComponent(mensaje)}`;
  });

  /* ===== MODAL RESULTADO ===== */
  document.getElementById("closeResult")?.addEventListener("click", () => {
    document.getElementById("resultModal").style.display = "none";
  });

  /* ===== RANKING COMPRAS ===== */
  document.getElementById("ranking-btn")?.addEventListener("click", () => {
    cerrarTodosLosModales();
    document.getElementById("rankingModal").style.display = "flex";
    window.cargarRanking?.();
  });
  document.getElementById("closeRanking")?.addEventListener("click", () => {
    document.getElementById("rankingModal").style.display = "none";
  });
  cerrarAlFondo("rankingModal");



  /* ===== RANKING JUEGO ===== */
  document.getElementById("ranking-juego-btn")?.addEventListener("click", () => {
    cerrarTodosLosModales();
    document.getElementById("rankingJuegoModal").style.display = "flex";
    window.cargarRankingJuego?.();
  });
  document.getElementById("closeRankingJuego")?.addEventListener("click", () => {
    document.getElementById("rankingJuegoModal").style.display = "none";
  });
  cerrarAlFondo("rankingJuegoModal");



  /* ===== PUBLICISTAS ===== */
  document.getElementById("publicistas-btn")?.addEventListener("click", () => {
    cerrarTodosLosModales();
    document.getElementById("modelosModal").style.display = "flex";
  });
  cerrarAlFondo("modelosModal");

  /* ===== SECRETARIAS ===== */
  document.getElementById("secretarias-btn")?.addEventListener("click", () => {
    cerrarTodosLosModales();
    document.getElementById("secretariasModal").style.display = "flex";
  });
  cerrarAlFondo("secretariasModal");

  /* ===== MÚSICA ===== */
  const music    = document.getElementById("bg-music");
  const musicBtn = document.getElementById("music-btn");
  if (music && musicBtn) {
    musicBtn.classList.add("muted");
    document.addEventListener("click", () => {
      music.muted = false; music.play().catch(()=>{});
      musicBtn.textContent = "🔊";
      musicBtn.classList.replace("muted", "playing");
    }, { once: true });
    musicBtn.addEventListener("click", e => {
      e.stopPropagation();
      const silenciado = music.muted || music.paused;
      if (silenciado) {
        music.muted = false; music.play().catch(()=>{});
        musicBtn.textContent = "🔊";
        musicBtn.classList.replace("muted", "playing");
      } else {
        music.muted = true;
        musicBtn.textContent = "🔇";
        musicBtn.classList.replace("playing", "muted");
      }
    });
  }

  /* ===== PUBLICIDAD AUTO ===== */
  const ad      = document.getElementById("adModal");
  const closeAd = document.getElementById("closeAd");
  if (ad && closeAd) {
    setTimeout(() => { ad.style.display = "flex"; ad.classList.add("show-ad"); }, 500);
    closeAd.onclick = () => {
      ad.classList.remove("show-ad");
      setTimeout(() => { ad.style.display = "none"; }, 300);
    };
  }
document.getElementById("logout-btn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});


});

