/* ==========================================================================
   Pokémon Bank - js/main.js
   Lógica del cajero: sesión con PIN (3 intentos), navegación entre vistas,
   depósito, retiro (límite diario), consulta de saldo y pago de servicios.
   Cada operación pide confirmación, emite un comprobante y actualiza saldo,
   historial y gráficos. Los datos se guardan en localStorage.
   ========================================================================== */
(function () {
  "use strict";

  var PIN_CORRECTO = "1234";
  var CLAVE = "pokemonbank_v1";          // saldo e historial
  var CLAVE_BLOQUEO = "pokemonbank_lock"; // intentos fallidos de PIN
  var SESION = "pokemonbank_sesion";     // sessionStorage: sesión activa
  var MAX_INTENTOS = 3, BLOQUEO_MS = 30000, INACTIVIDAD_MS = 90000;
  var LIMITE_DIARIO = 50000, MAX_DEPOSITO = 500000; // en centavos
  var SERVICIOS = { energia: "Energía eléctrica", internet: "Internet", telefonia: "Telefonía", agua: "Agua potable" };
  var ETIQ = { dep: "Depósito", ret: "Retiro", pag: "Servicio", sal: "Consulta" };
  var ICONO = { dep: "i-dep", ret: "i-ret", pag: "i-pag", sal: "i-sal" };
  var VISTAS = ["acciones", "deposito", "retiro", "saldo", "servicios", "historial", "grafico"];
  var FLUJOS = ["deposito", "retiro", "saldo", "servicios"];

  /* ---------- Datos iniciales (usuario de prueba). Montos en centavos ---------- */
  function datosIniciales() {
    var t = function (f, tipo, det, monto, saldo) { return { f: f, tipo: tipo, det: det, monto: monto, saldo: saldo }; };
    return {
      saldo: 125075,
      tx: [
        t("05/10/2026 08:15", "dep", "Depósito en efectivo", 30000, 90880),
        t("05/10/2026 08:20", "sal", "Consulta de saldo", 0, 90880),
        t("06/10/2026 10:02", "ret", "Retiro en cajero", 6000, 84880),
        t("07/10/2026 14:30", "pag", "Energía eléctrica", 4530, 80350),
        t("07/10/2026 14:33", "pag", "Internet", 3000, 77350),
        t("08/10/2026 09:12", "ret", "Retiro en cajero", 10000, 67350),
        t("09/10/2026 16:45", "dep", "Depósito en efectivo", 50000, 117350),
        t("09/10/2026 16:47", "sal", "Consulta de saldo", 0, 117350),
        t("10/10/2026 11:20", "pag", "Agua potable", 1275, 116075),
        t("11/10/2026 18:05", "pag", "Telefonía", 2000, 114075),
        t("11/10/2026 18:10", "ret", "Retiro en cajero", 4000, 110075),
        t("12/10/2026 07:55", "dep", "Depósito en efectivo", 15000, 125075),
        t("12/10/2026 07:56", "sal", "Consulta de saldo", 0, 125075)
      ]
    };
  }

  var estado;
  try { estado = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { estado = null; }
  if (!estado || typeof estado.saldo !== "number" || !Array.isArray(estado.tx)) estado = datosIniciales();

  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } }

  /* ---------- Utilidades ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function dinero(c) { return "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function aCentavos(v) { return /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(parseFloat(v) * 100) : NaN; }
  function dos(n) { return (n < 10 ? "0" : "") + n; }
  function fechaHora() { var d = new Date(); return dos(d.getDate()) + "/" + dos(d.getMonth() + 1) + "/" + d.getFullYear() + " " + dos(d.getHours()) + ":" + dos(d.getMinutes()); }
  function soloFecha() { return fechaHora().split(" ")[0]; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icono(id) { return '<svg class="pk-i" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function sesionActiva() { try { return sessionStorage.getItem(SESION) === "1"; } catch (e) { return false; } }

  var toastTimer;
  function aviso(texto, error) {
    var t = $("#pk-toast"); if (!t) return;
    t.textContent = texto; t.className = "pk-toast show" + (error ? " error" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = "pk-toast" + (error ? " error" : ""); }, 3500);
  }

  function retiradoHoy() {
    var hoy = soloFecha();
    return estado.tx.reduce(function (s, x) { return s + (x.tipo === "ret" && x.f.slice(0, 10) === hoy ? x.monto : 0); }, 0);
  }

  function registrar(tipo, detalle, monto) {
    if (tipo === "dep") estado.saldo += monto;
    if (tipo === "ret" || tipo === "pag") estado.saldo -= monto;
    var tx = { f: fechaHora(), tipo: tipo, det: detalle, monto: monto, saldo: estado.saldo };
    estado.tx.push(tx);
    guardar(); pintar();
    return tx;
  }

  /* ---------- Pintar historial, resumen, saldo y gráficos ---------- */
  var filtro = "all", mostrar = 10;

  function pintar() {
    var tot = { dep: 0, ret: 0, pag: 0, sal: 0 }, cant = { dep: 0, ret: 0, pag: 0, sal: 0 };
    estado.tx.forEach(function (x) { tot[x.tipo] += x.monto; cant[x.tipo]++; });

    // Lista (la más reciente primero)
    var filas = [];
    for (var i = estado.tx.length - 1; i >= 0; i--) {
      var x = estado.tx[i];
      if (filtro !== "all" && x.tipo !== filtro) continue;
      var signo = x.tipo === "dep" ? "+" : "−";
      var monto = x.tipo === "sal" ? '<b class="pk-zero">—</b>' : '<b class="' + (x.tipo === "dep" ? "pk-in" : "pk-out") + '">' + signo + dinero(x.monto) + "</b>";
      filas.push('<li class="pk-tx t-' + x.tipo + '"><span class="pk-tx-ico">' + icono(ICONO[x.tipo]) + '</span>' +
        '<div class="pk-tx-main"><strong>' + esc(x.det) + '</strong><small><span class="pk-tag ' + x.tipo + '">' + ETIQ[x.tipo] + "</span> " + esc(x.f) + " · N.º " + ("00" + (i + 1)).slice(-3) + "</small></div>" +
        '<div class="pk-tx-amt">' + monto + "<small>Saldo " + dinero(x.saldo) + "</small></div></li>");
    }
    var lista = $("#lista-tx");
    if (lista) lista.innerHTML = filas.slice(0, mostrar).join("") || '<li class="pk-empty">Aún no hay transacciones de este tipo.</li>';
    var mas = $("#btn-mas"); if (mas) mas.hidden = filas.length <= mostrar;

    // Tarjetas de resumen
    ["dep", "ret", "pag"].forEach(function (k) {
      var c = $(".pk-stat." + k); if (!c) return;
      $("strong", c).textContent = dinero(tot[k]); $("span", c).textContent = cant[k] + " transacciones";
    });
    var cs = $(".pk-stat.sal"); if (cs) $("strong", cs).textContent = cant.sal;

    // Último movimiento (pantalla de acciones)
    var u = estado.tx[estado.tx.length - 1], ul = $("#ultimo");
    if (ul && u) ul.innerHTML = '<span class="pk-tx-ico t-' + u.tipo + '">' + icono(ICONO[u.tipo]) + "</span>" +
      '<div class="pk-tx-main"><small>Último movimiento</small><strong>' + esc(u.det) + "</strong><small>" + esc(u.f) + "</small></div>" +
      '<div class="pk-tx-amt"><b>' + (u.tipo === "sal" ? dinero(u.saldo) : (u.tipo === "dep" ? "+" : "−") + dinero(u.monto)) + "</b><small>Ver historial ›</small></div>";

    // Saldo y datos de consulta
    $$("[data-saldo]").forEach(function (el) { el.innerHTML = "<sup>$</sup>" + dinero(estado.saldo).slice(1); });
    var fs = $("#fecha-saldo"); if (fs) fs.textContent = soloFecha();
    var dh = $("#disp-hoy"); if (dh) dh.textContent = dinero(Math.max(0, LIMITE_DIARIO - retiradoHoy()));

    // Gráfico de dona
    var n = estado.tx.length, dona = $(".pk-donut");
    if (dona && n) {
      var p1 = cant.dep / n * 100, p2 = p1 + cant.ret / n * 100, p3 = p2 + cant.pag / n * 100;
      dona.style.background = "conic-gradient(var(--c-dep) 0 " + p1 + "%, var(--c-ret) " + p1 + "% " + p2 + "%, var(--c-pag) " + p2 + "% " + p3 + "%, var(--c-sal) " + p3 + "% 100%)";
      dona.setAttribute("data-total", n);
      dona.setAttribute("aria-label", "Gráfico de dona: depósitos " + cant.dep + ", retiros " + cant.ret + ", pago de servicios " + cant.pag + " y consultas de saldo " + cant.sal);
    }
    ["dep", "ret", "pag", "sal"].forEach(function (k, i) {
      var em = $(".pk-legend li:nth-child(" + (i + 1) + ") em");
      if (em) em.textContent = cant[k] + " · " + (n ? Math.round(cant[k] / n * 100) : 0) + "%";
    });

    // Barras de monto
    var max = Math.max(tot.dep, tot.ret, tot.pag, 1);
    ["dep", "ret", "pag"].forEach(function (k, i) {
      var fila = $$(".pk-bar-row")[i]; if (!fila) return;
      $(".pk-bar-label span:last-child", fila).textContent = dinero(tot[k]);
      $(".pk-bar-fill", fila).style.width = (tot[k] / max * 100) + "%";
    });
    var res = $$("#resumen-graf li span:last-child");
    if (res[0]) res[0].textContent = "+" + dinero(tot.dep);
    if (res[1]) res[1].textContent = "−" + dinero(tot.ret + tot.pag);
    if (res[2]) res[2].textContent = dinero(estado.saldo);
  }

  /* ---------- Confirmación y comprobante (hoja a pantalla completa) ---------- */
  var hoja = $("#pk-sheet"), hojaCuerpo = $("#pk-sheet-body"), alConfirmar = null;

  function abrirHoja(html) {
    hojaCuerpo.innerHTML = html; hoja.hidden = false;
    var b = $("[data-ok], [data-done]", hojaCuerpo); if (b) b.focus();
  }
  function cerrarHoja() { hoja.hidden = true; alConfirmar = null; }

  function filasHtml(filas) {
    return '<dl class="pk-sheet-rows">' + filas.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>";
  }

  function confirmar(titulo, filas, textoOk, fn, peligro) {
    alConfirmar = fn;
    abrirHoja('<h2>' + esc(titulo) + "</h2>" + filasHtml(filas) +
      '<div class="pk-flow-foot"><button type="button" class="btn pk-btn pk-btn-light" data-cancel>Cancelar</button>' +
      '<button type="button" class="btn pk-btn ' + (peligro ? "pk-btn-danger" : "pk-btn-primary") + '" data-ok>' + esc(textoOk) + "</button></div>");
  }

  function comprobante(tx) {
    var num = ("00" + estado.tx.length).slice(-3);
    var filas = [["Operación", ETIQ[tx.tipo]], ["Detalle", tx.det]];
    if (tx.tipo !== "sal") filas.push(["Monto", dinero(tx.monto)]);
    filas.push(["Saldo actual", dinero(tx.saldo)], ["Fecha", tx.f], ["Titular", "Ash Ketchum"], ["Cuenta", "PKB-2026-000151"], ["N.º de operación", num]);
    abrirHoja('<div class="pk-check">' + icono("i-ok") + "</div><h2>¡Operación exitosa!</h2>" +
      '<div class="pk-ticket">' + filasHtml(filas) + "</div>" +
      '<button type="button" class="btn pk-btn pk-btn-primary btn-block" data-done>Listo</button>');
  }

  if (hoja) hoja.addEventListener("click", function (e) {
    if (e.target.closest("[data-cancel]")) return cerrarHoja();
    if (e.target.closest("[data-ok]")) { var fn = alConfirmar; alConfirmar = null; if (fn) fn(); return; }
    if (e.target.closest("[data-done]")) { cerrarHoja(); irA("acciones"); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && hoja && !hoja.hidden) cerrarHoja(); });

  /* ---------- Operaciones: validar -> confirmar -> registrar -> comprobante ---------- */
  function irA(vista) { if (window.location.hash === "#" + vista) ruta(); else window.location.hash = "#" + vista; }

  function pedirDeposito(m) {
    if (!(m > 0)) return aviso("Ingresa un monto válido.", true);
    if (m > MAX_DEPOSITO) return aviso("El máximo por depósito es $5,000.00.", true);
    confirmar("¿Confirmar depósito?", [["Monto", dinero(m)], ["Saldo después", dinero(estado.saldo + m)]], "Depositar", function () {
      comprobante(registrar("dep", "Depósito en efectivo", m));
    });
  }

  function pedirRetiro(m) {
    if (!(m > 0)) return aviso("Elige o escribe un monto.", true);
    if (m % 500 !== 0) return aviso("El monto debe ser múltiplo de $5.", true);
    if (m > LIMITE_DIARIO) return aviso("El límite por retiro es de $500.00.", true);
    var libre = LIMITE_DIARIO - retiradoHoy();
    if (m > libre) return aviso("Superas tu límite diario. Hoy puedes retirar " + dinero(Math.max(0, libre)) + " más.", true);
    if (m > estado.saldo) return aviso("Fondos insuficientes. Saldo: " + dinero(estado.saldo), true);
    confirmar("¿Confirmar retiro?", [["Monto", dinero(m)], ["Saldo después", dinero(estado.saldo - m)]], "Retirar", function () {
      comprobante(registrar("ret", "Retiro en cajero", m));
    });
  }

  function pedirServicio(clave, contrato, m) {
    if (!clave) return aviso("Selecciona el servicio a pagar.", true);
    if (!/^\d{6,12}$/.test(contrato)) return aviso("El contrato debe tener entre 6 y 12 dígitos.", true);
    if (!(m > 0)) return aviso("Ingresa un monto válido.", true);
    if (m > estado.saldo) return aviso("Fondos insuficientes. Saldo: " + dinero(estado.saldo), true);
    confirmar("¿Confirmar pago?", [["Servicio", SERVICIOS[clave]], ["Contrato", contrato], ["Monto", dinero(m)], ["Saldo después", dinero(estado.saldo - m)]], "Pagar", function () {
      comprobante(registrar("pag", SERVICIOS[clave] + " · contrato …" + contrato.slice(-4), m));
    });
  }

  var fDep = $("#form-deposito");
  if (fDep) fDep.addEventListener("submit", function (e) { e.preventDefault(); pedirDeposito(aCentavos($("#monto-deposito").value)); });

  var fRet = $("#form-retiro");
  if (fRet) fRet.addEventListener("submit", function (e) { e.preventDefault(); pedirRetiro(aCentavos($("#monto-retiro").value)); });

  var fSer = $("#form-servicios");
  if (fSer) fSer.addEventListener("submit", function (e) {
    e.preventDefault();
    var s = $('input[name="servicio"]:checked');
    pedirServicio(s && s.value, $("#contrato").value, aCentavos($("#monto-servicio").value));
  });

  /* ---------- Botones de monto rápido y accesos ---------- */
  document.addEventListener("click", function (e) {
    var r = e.target.closest("[data-rapido]");
    if (r) return pedirRetiro(aCentavos(r.getAttribute("data-rapido")));

    var s = e.target.closest("[data-suma]");
    if (s) {
      var inp = $("#monto-deposito"), actual = parseFloat(inp.value) || 0;
      inp.value = String(Math.round((actual + parseFloat(s.getAttribute("data-suma"))) * 100) / 100);
      return;
    }
    // La consulta de saldo se registra al tocar «Mi saldo» (no al volver atrás en el navegador)
    if (e.target.closest("[data-consulta]") && sesionActiva()) registrar("sal", "Consulta de saldo", 0);
  });

  var bOtro = $("#btn-otro");
  if (bOtro) bOtro.addEventListener("click", function () {
    var panel = $("#otro-monto"); panel.hidden = false; bOtro.hidden = true; $("#foot-ret").hidden = true;
    bOtro.setAttribute("aria-expanded", "true"); $("#monto-retiro").focus();
  });

  /* ---------- Teclado numérico en pantalla ---------- */
  function armarTeclado(kp) {
    var punto = kp.getAttribute("data-dot") !== "0", h = "";
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"].forEach(function (k) { h += '<button type="button" class="pk-key" data-k="' + k + '">' + k + "</button>"; });
    h += punto ? '<button type="button" class="pk-key pk-key-aux" data-k=".">.</button>' : '<button type="button" class="pk-key pk-key-aux" data-k="clr" aria-label="Borrar todo">C</button>';
    h += '<button type="button" class="pk-key" data-k="0">0</button>';
    h += '<button type="button" class="pk-key pk-key-aux" data-k="del" aria-label="Borrar un dígito">' + icono("i-del") + "</button>";
    kp.innerHTML = h;
  }
  $$(".pk-keypad").forEach(armarTeclado);

  // Evita que el toque en una tecla quite el foco del campo
  document.addEventListener("mousedown", function (e) { if (e.target.closest(".pk-key")) e.preventDefault(); });

  document.addEventListener("click", function (e) {
    var b = e.target.closest(".pk-key"); if (!b) return;
    var kp = b.closest(".pk-keypad"), inp = $("#" + kp.getAttribute("data-for")), k = b.getAttribute("data-k");
    if (!inp || inp.disabled) return;
    var punto = kp.getAttribute("data-dot") !== "0", v = inp.value;
    if (k === "del") v = v.slice(0, -1);
    else if (k === "clr") v = "";
    else if (k === ".") { if (v.indexOf(".") < 0) v = (v || "0") + "."; }
    else v += k;
    if (punto) v = v.replace(/^0+(?=\d)/, "");   // «05» -> «5» solo en montos (el PIN y el contrato conservan ceros)
    if (inp.maxLength > 0 && v.length > inp.maxLength) return;
    if (punto && !/^\d{0,5}(\.\d{0,2})?$/.test(v)) return;
    inp.value = v;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // En el pago de servicios el teclado escribe en el último campo tocado
  $$("[data-pad]").forEach(function (inp) {
    inp.addEventListener("focus", function () {
      var kp = $("#pad-servicios"); kp.setAttribute("data-for", inp.id);
      kp.setAttribute("data-dot", inp.id === "contrato" ? "0" : "1"); armarTeclado(kp);
    });
  });

  // Con el teclado físico solo se aceptan dígitos (y un punto en los montos)
  $$("#pin, #monto-deposito, #monto-retiro, #monto-servicio, #contrato").forEach(function (inp) {
    inp.addEventListener("input", function () {
      var permite = inp.id === "monto-deposito" || inp.id === "monto-servicio";
      inp.value = inp.value.replace(permite ? /[^\d.]/g : /\D/g, "");
    });
  });

  /* ---------- Login: PIN con 3 intentos y bloqueo temporal ---------- */
  var pin = $("#pin"), errPin = $("#pin-error"), btnLogin = $("#btn-login"), cuenta;

  function leerBloqueo() { try { return JSON.parse(localStorage.getItem(CLAVE_BLOQUEO)) || { fallos: 0, hasta: 0 }; } catch (e) { return { fallos: 0, hasta: 0 }; } }
  function guardarBloqueo(b) { try { localStorage.setItem(CLAVE_BLOQUEO, JSON.stringify(b)); } catch (e) { /* sin almacenamiento */ } }
  function mostrarError(t) { errPin.textContent = t; errPin.hidden = !t; }

  function revisarBloqueo() {
    clearInterval(cuenta);
    var b = leerBloqueo(), resta = Math.ceil((b.hasta - Date.now()) / 1000);
    var bloqueado = resta > 0;
    pin.disabled = btnLogin.disabled = bloqueado;
    $$("#login .pk-key").forEach(function (k) { k.disabled = bloqueado; });
    if (bloqueado) {
      mostrarError("Demasiados intentos. Espera " + resta + " s para volver a intentarlo.");
      cuenta = setInterval(revisarBloqueo, 1000);
    } else if (b.hasta) { guardarBloqueo({ fallos: 0, hasta: 0 }); mostrarError(""); }
    return bloqueado;
  }

  var fLogin = $("#form-login");
  if (fLogin) fLogin.addEventListener("submit", function (e) {
    e.preventDefault();
    if (revisarBloqueo()) return;
    if (!/^\d{4}$/.test(pin.value)) { mostrarError("El PIN debe tener exactamente 4 dígitos."); return; }
    if (pin.value === PIN_CORRECTO) {
      guardarBloqueo({ fallos: 0, hasta: 0 }); mostrarError(""); pin.value = "";
      try { sessionStorage.setItem(SESION, "1"); } catch (err) { /* sin almacenamiento */ }
      irA("acciones");
      return;
    }
    var b = leerBloqueo(); b.fallos++;
    pin.value = "";
    if (b.fallos >= MAX_INTENTOS) { guardarBloqueo({ fallos: 0, hasta: Date.now() + BLOQUEO_MS }); revisarBloqueo(); }
    else { guardarBloqueo(b); mostrarError("PIN incorrecto. Te quedan " + (MAX_INTENTOS - b.fallos) + (MAX_INTENTOS - b.fallos === 1 ? " intento." : " intentos.")); }
  });
  // Al escribir el 4.º dígito se envía solo (como en un cajero real)
  if (pin) pin.addEventListener("input", function () { if (pin.value.length === 4) setTimeout(function () { fLogin.requestSubmit(); }, 180); });

  /* ---------- Sesión: cierre manual y por inactividad ---------- */
  var inactivo;
  function reiniciarInactividad() {
    clearTimeout(inactivo);
    if (!sesionActiva()) return;
    inactivo = setTimeout(function () { cerrarSesion(); aviso("Sesión cerrada por inactividad.", true); }, INACTIVIDAD_MS);
  }
  function cerrarSesion() { try { sessionStorage.removeItem(SESION); } catch (e) { /* nada */ } cerrarHoja(); irA("login"); }
  ["pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, reiniciarInactividad); });

  /* ---------- Historial: filtro, «ver más» y restablecer ---------- */
  $$("[data-filtro]").forEach(function (b) {
    b.addEventListener("click", function () {
      filtro = b.getAttribute("data-filtro"); mostrar = 10;
      $$("[data-filtro]").forEach(function (o) { var on = o === b; o.classList.toggle("active", on); o.setAttribute("aria-pressed", on); });
      pintar();
    });
  });
  var bMas = $("#btn-mas"); if (bMas) bMas.addEventListener("click", function () { mostrar += 10; pintar(); });

  var bReset = $("#btn-reset");
  if (bReset) bReset.addEventListener("click", function () {
    confirmar("¿Restablecer datos?", [["Se restaurarán", "Saldo e historial de prueba"]], "Restablecer", function () {
      estado = datosIniciales(); guardar(); pintar(); cerrarHoja(); aviso("Datos de prueba restablecidos.");
    }, true);
  });

  /* ---------- Navegación entre vistas (según el # de la dirección) ---------- */
  function limpiarFlujo(v) {
    $$("form", $("#" + v)).forEach(function (f) { f.reset(); });
    if (v === "retiro") { $("#otro-monto").hidden = true; $("#btn-otro").hidden = false; $("#foot-ret").hidden = false; $("#btn-otro").setAttribute("aria-expanded", "false"); }
    if (v === "servicios") { var kp = $("#pad-servicios"); kp.setAttribute("data-for", "contrato"); kp.setAttribute("data-dot", "0"); armarTeclado(kp); }
  }

  function ruta() {
    var h = window.location.hash.slice(1) || "login";
    if (h === "login" && sesionActiva()) { try { sessionStorage.removeItem(SESION); } catch (e) { /* nada */ } }
    if (h !== "login" && !sesionActiva()) h = "login";
    if (h !== "login" && VISTAS.indexOf(h) < 0) h = "acciones";
    if (window.location.hash !== "#" + h) history.replaceState(null, "", "#" + h);

    $("#login").hidden = h !== "login";
    $("#app").hidden = h === "login";
    VISTAS.forEach(function (v) { $("#" + v).hidden = v !== h; });
    document.body.setAttribute("data-view", h);
    document.body.setAttribute("data-flow", FLUJOS.indexOf(h) >= 0 ? "1" : "0");
    $$("[data-nav]").forEach(function (a) {
      var on = a.getAttribute("data-nav") === (FLUJOS.indexOf(h) >= 0 ? "acciones" : h);
      a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (FLUJOS.indexOf(h) >= 0) limpiarFlujo(h);
    if (h === "login") { pin.value = ""; if (!revisarBloqueo()) mostrarError(""); }
    pintar(); reiniciarInactividad(); window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.addEventListener("hashchange", ruta);

  ruta();
})();
