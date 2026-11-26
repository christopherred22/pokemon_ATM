/* ==========================================================================
   Pokémon Bank - js/main.js
   Controlador de la interfaz: sesión con PIN, navegación entre vistas,
   teclado en pantalla y flujo de cada transacción:
       validar -> confirmar -> registrar -> comprobante

   Depende de (en este orden):
     datos.js         LocalStorage y reglas del negocio
     validaciones.js  reglas de Validate.js
     comprobante.js   PDF con jsPDF
     dialogos.js      diálogos con SweetAlert
     graficos.js      gráficos con Chart.js
   ========================================================================== */
(function (PB) {
  "use strict";

  /* ---------- Configuración ---------- */
  const CLAVE_BLOQUEO = "pokemonbank_bloqueo";  // intentos fallidos de PIN
  const SESION = "pokemonbank_sesion";          // sessionStorage: sesión activa
  const MAX_INTENTOS = 3, BLOQUEO_MS = 30000, INACTIVIDAD_MS = 90000, POR_PAGINA = 10;
  const FLUJOS = ["deposito", "retiro", "saldo", "servicios"];
  const VISTAS = ["acciones", ...FLUJOS, "historial", "grafico"];
  const TITULOS = {
    login: "Inicio de sesión", acciones: "Inicio", deposito: "Depósito", retiro: "Retiro",
    saldo: "Mi saldo", servicios: "Pago de servicios", historial: "Historial", grafico: "Gráfico"
  };
  const { datos, formato, validar, dialogos } = PB;

  /* ---------- Estado de la interfaz (los datos viven en datos.js) ---------- */
  let vista = "login";
  let filtro = "all";
  let mostrar = POR_PAGINA;
  let consultaActual = null;      // consulta de saldo que se está mostrando
  let confirmando = false;        // hay una confirmación esperando respuesta
  let temporizadorBloqueo, temporizadorInactividad;

  /* ---------- Utilidades del DOM ---------- */
  const $ = (selector, raiz) => (raiz || document).querySelector(selector);
  const $$ = (selector, raiz) => Array.from((raiz || document).querySelectorAll(selector));
  const escapar = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icono = (id) => '<svg class="pk-i" aria-hidden="true"><use href="#' + id + '"/></svg>';
  const poner = (selector, texto) => $$(selector).forEach((el) => { el.textContent = texto; });

  /* sessionStorage / localStorage pueden estar bloqueados: nunca deben romper la app */
  let sesionEnMemoria = false;
  function sesionActiva() {
    try { return sessionStorage.getItem(SESION) === "1"; } catch (e) { return sesionEnMemoria; }
  }
  function fijarSesion(activa) {
    sesionEnMemoria = activa;
    try {
      if (activa) sessionStorage.setItem(SESION, "1"); else sessionStorage.removeItem(SESION);
    } catch (e) { /* se usa la copia en memoria */ }
  }

  /* =====================================================================
     1. Presentación de los datos del usuario
     ===================================================================== */
  function importe(t) {
    const signo = datos.TIPOS[t.tipo].signo;
    if (signo === 0) return '<b class="pk-zero">—</b>';
    return '<b class="' + (signo > 0 ? "pk-in" : "pk-out") + '">' + (signo > 0 ? "+" : "−") + formato.dinero(t.monto) + "</b>";
  }

  function pintarTitular(usuario) {
    poner('[data-user="nombre"]', usuario ? usuario.nombre : "");
    poner('[data-user="cuenta"]', usuario ? usuario.cuenta : "");
    poner('[data-user="iniciales"]', usuario ? usuario.nombre.split(" ").map((p) => p[0]).join("") : "");
  }

  function pintarHistorial(usuario) {
    const filas = usuario.transacciones
      .filter((t) => filtro === "all" || t.tipo === filtro)
      .reverse()                                   // la más reciente primero
      .map((t) => {
        const numero = formato.numeroOperacion(t.id);
        return '<li class="pk-tx t-' + t.tipo + '"><span class="pk-tx-ico">' + icono("i-" + t.tipo) + "</span>" +
          '<div class="pk-tx-main"><strong>' + escapar(t.detalle) + '</strong><small><span class="pk-tag ' + t.tipo + '">' +
          datos.TIPOS[t.tipo].nombre + "</span> " + formato.fechaHora(t.fecha) + " · N.º " + numero + "</small></div>" +
          '<div class="pk-tx-amt">' + importe(t) + "<small>Saldo " + formato.dinero(t.saldo) + "</small></div>" +
          '<button type="button" class="btn pk-tx-pdf" data-pdf="' + t.id + '" aria-label="Ver comprobante de la operación ' + numero + '">PDF</button></li>';
      });
    const vacio = usuario.transacciones.length ? "No hay transacciones de este tipo." : "Aún no has realizado transacciones.";
    $("#lista-tx").innerHTML = filas.slice(0, mostrar).join("") || '<li class="pk-empty">' + vacio + "</li>";
    $("#btn-mas").hidden = filas.length <= mostrar;
  }

  function pintarUltimo(usuario) {
    const t = usuario.transacciones[usuario.transacciones.length - 1];
    $("#ultimo").innerHTML = t
      ? '<span class="pk-tx-ico t-' + t.tipo + '">' + icono("i-" + t.tipo) + '</span><div class="pk-tx-main"><small>Último movimiento</small><strong>' +
        escapar(t.detalle) + "</strong><small>" + formato.fechaHora(t.fecha) + '</small></div><div class="pk-tx-amt">' + importe(t) + "<small>Ver historial ›</small></div>"
      : '<span class="pk-tx-ico t-sal">' + icono("i-his") + '</span><div class="pk-tx-main"><strong>Aún no tienes movimientos</strong><small>Tus transacciones aparecerán aquí</small></div>';
  }

  function pintarResumen(usuario) {
    const r = datos.resumen(usuario.transacciones);
    ["dep", "ret", "pag"].forEach((tipo) => {
      const tarjeta = $(".pk-stat." + tipo);
      $("strong", tarjeta).textContent = formato.dinero(r[tipo].total);
      $("span", tarjeta).textContent = r[tipo].cantidad + (r[tipo].cantidad === 1 ? " transacción" : " transacciones");
    });
    $(".pk-stat.sal strong").textContent = r.sal.cantidad;

    poner("#total-ingresado", "+" + formato.dinero(r.dep.total));
    poner("#total-egresado", "−" + formato.dinero(r.ret.total + r.pag.total));
    poner("#total-operaciones", usuario.transacciones.length);

    const hayDatos = usuario.transacciones.length > 0;
    $("#grafico-vacio").hidden = hayDatos;
    $("#grafico-datos").hidden = !hayDatos;
    // Chart.js necesita que el lienzo sea visible para calcular su tamaño
    if (vista === "grafico" && hayDatos && !PB.graficos.actualizar(r)) {
      dialogos.error("No se pudo mostrar el gráfico", "No se cargó Chart.js. Revisa que exista la carpeta js/vendor.");
    }
  }

  /* Vuelve a dibujar todo con lo que hay en LocalStorage. Sin sesión no se
     muestra ningún dato del titular. */
  function pintar() {
    if (!sesionActiva()) { pintarTitular(null); return; }
    const usuario = datos.obtener();
    pintarTitular(usuario);
    pintarHistorial(usuario);
    pintarUltimo(usuario);
    pintarResumen(usuario);
    $("#monto-saldo").innerHTML = "<sup>$</sup>" + formato.dinero(usuario.saldo).slice(1);
    poner("#disp-hoy", formato.dinero(datos.disponibleHoy(usuario)));
    poner("#fecha-saldo", consultaActual ? formato.fechaHora(consultaActual.fecha) : "");
  }

  /* =====================================================================
     2. Transacciones: validar -> confirmar -> registrar -> comprobante
     ===================================================================== */
  function marcarErrores(formulario, errores) {
    $$("[name]", formulario).forEach((campo) => {
      campo.classList.toggle("is-invalid", Boolean(errores && errores[campo.name]));
    });
  }

  /* Muestra los errores de Validate.js; devuelve true si hubo alguno. */
  function rechazar(errores, formulario) {
    if (formulario) marcarErrores(formulario, errores);
    if (!errores) return false;
    dialogos.error("Revisa los datos", Object.values(errores).join("\n"));
    return true;
  }

  /* operacion = { titulo, boton, filas, tipo, detalle, monto, revalidar } */
  function procesar(operacion) {
    const saldo = datos.obtener().saldo;
    const saldoDespues = saldo + datos.TIPOS[operacion.tipo].signo * operacion.monto;
    confirmando = true;
    dialogos.confirmar({
      titulo: operacion.titulo,
      boton: operacion.boton,
      filas: [...operacion.filas, ["Monto", formato.dinero(operacion.monto)], ["Saldo después", formato.dinero(saldoDespues)]]
    }).then((acepta) => {
      confirmando = false;
      if (!acepta || !sesionActiva()) return;
      // Se valida de nuevo: el saldo pudo cambiar (por ejemplo, en otra pestaña)
      if (rechazar(operacion.revalidar())) return;
      const transaccion = datos.registrar(operacion.tipo, operacion.detalle, operacion.monto);
      pintar();
      dialogos.comprobante(transaccion, datos.obtener()).then(() => irA("acciones"));
    });
  }

  function pedirDeposito(texto, formulario) {
    const revisar = () => validar.deposito(texto);
    if (rechazar(revisar(), formulario)) return;
    procesar({
      titulo: "¿Confirmar depósito?", boton: "Depositar", filas: [],
      tipo: "dep", detalle: "Depósito en efectivo", monto: formato.aCentavos(texto), revalidar: revisar
    });
  }

  function pedirRetiro(texto, formulario) {
    const revisar = () => {
      const usuario = datos.obtener();
      return validar.retiro(texto, usuario.saldo, datos.disponibleHoy(usuario));
    };
    if (rechazar(revisar(), formulario)) return;
    procesar({
      titulo: "¿Confirmar retiro?", boton: "Retirar", filas: [],
      tipo: "ret", detalle: "Retiro en cajero", monto: formato.aCentavos(texto), revalidar: revisar
    });
  }

  function pedirServicio(valores, formulario) {
    const revisar = () => validar.servicio(valores, datos.obtener().saldo);
    if (rechazar(revisar(), formulario)) return;
    const nombre = datos.SERVICIOS[valores.servicio];
    procesar({
      titulo: "¿Confirmar pago?", boton: "Pagar",
      filas: [["Servicio", nombre], ["Contrato", valores.contrato]],
      tipo: "pag", detalle: nombre + " (contrato " + valores.contrato + ")",
      monto: formato.aCentavos(valores.monto), revalidar: revisar
    });
  }

  /* La consulta se registra al tocar «Mi saldo» */
  function consultarSaldo() {
    consultaActual = datos.registrar("sal", "Consulta de saldo", 0);
    irA("saldo");
  }

  /* =====================================================================
     3. Teclado numérico en pantalla
     ===================================================================== */
  function armarTeclado(teclado) {
    const conPunto = teclado.dataset.dot !== "0";
    const tecla = (k, contenido, clase, etiqueta) => '<button type="button" class="pk-key ' + (clase || "") + '" data-k="' + k + '"' +
      (etiqueta ? ' aria-label="' + etiqueta + '"' : "") + ">" + contenido + "</button>";
    teclado.innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => tecla(k, k)).join("") +
      (conPunto ? tecla(".", ".", "pk-key-aux") : tecla("clr", "C", "pk-key-aux", "Borrar todo")) +
      tecla("0", "0") + tecla("del", icono("i-del"), "pk-key-aux", "Borrar un dígito");
  }

  function pulsarTecla(boton) {
    const teclado = boton.closest(".pk-keypad");
    const campo = document.getElementById(teclado.dataset.for);
    if (!campo || campo.disabled) return;
    const esMonto = teclado.dataset.dot !== "0";
    const k = boton.dataset.k;
    let valor = campo.value;
    if (k === "del") valor = valor.slice(0, -1);
    else if (k === "clr") valor = "";
    else if (k === ".") { if (!valor.includes(".")) valor = (valor || "0") + "."; }
    else valor += k;
    if (esMonto) valor = valor.replace(/^0+(?=\d)/, "");  // el PIN y el contrato conservan ceros
    if (campo.maxLength > 0 && valor.length > campo.maxLength) return;
    if (esMonto && !/^\d{0,5}(\.\d{0,2})?$/.test(valor)) return;
    campo.value = valor;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* =====================================================================
     4. Inicio de sesión: PIN con 3 intentos y bloqueo temporal
     ===================================================================== */
  const campoPin = () => $("#pin");

  function leerBloqueo() {
    try { return JSON.parse(localStorage.getItem(CLAVE_BLOQUEO)) || { fallos: 0, hasta: 0 }; }
    catch (e) { return { fallos: 0, hasta: 0 }; }
  }
  function guardarBloqueo(bloqueo) {
    try { localStorage.setItem(CLAVE_BLOQUEO, JSON.stringify(bloqueo)); } catch (e) { /* sin almacenamiento */ }
  }
  function mensajePin(texto) {
    const caja = $("#pin-error");
    caja.textContent = texto;
    caja.hidden = !texto;
  }

  /* Actualiza la cuenta regresiva; devuelve true mientras siga bloqueado. */
  function revisarBloqueo() {
    clearTimeout(temporizadorBloqueo);
    const bloqueo = leerBloqueo();
    const segundos = Math.ceil((bloqueo.hasta - Date.now()) / 1000);
    const bloqueado = segundos > 0;
    campoPin().disabled = bloqueado;
    $("#btn-login").disabled = bloqueado;
    $$("#login .pk-key").forEach((k) => { k.disabled = bloqueado; });
    if (bloqueado) {
      mensajePin("Demasiados intentos. Espera " + segundos + " s para volver a intentarlo.");
      temporizadorBloqueo = setTimeout(revisarBloqueo, 1000);
    } else {
      if (bloqueo.hasta) guardarBloqueo({ fallos: 0, hasta: 0 });
      mensajePin("");
    }
    return bloqueado;
  }

  function iniciarSesion() {
    if (dialogos.hayDialogo() || revisarBloqueo()) return;
    const valor = campoPin().value;
    const errores = validar.pin(valor);
    if (errores) { dialogos.error("PIN no válido", errores.pin); return; }

    const usuario = datos.obtener();
    campoPin().value = "";
    if (valor === usuario.pin) {
      guardarBloqueo({ fallos: 0, hasta: 0 });
      fijarSesion(true);
      irA("acciones");
      dialogos.exito("¡Bienvenido, " + usuario.nombre + "!", "Cuenta N.º " + usuario.cuenta, 2500);
      return;
    }

    const fallos = leerBloqueo().fallos + 1;
    if (fallos >= MAX_INTENTOS) {
      guardarBloqueo({ fallos: 0, hasta: Date.now() + BLOQUEO_MS });
      revisarBloqueo();
      dialogos.error("Cajero bloqueado", "Fallaste " + MAX_INTENTOS + " veces. Espera 30 segundos para volver a intentarlo.");
    } else {
      guardarBloqueo({ fallos: fallos, hasta: 0 });
      const quedan = MAX_INTENTOS - fallos;
      dialogos.error("PIN incorrecto", "Te " + (quedan === 1 ? "queda 1 intento." : "quedan " + quedan + " intentos."));
    }
  }

  /* =====================================================================
     5. Sesión: salida e inactividad
     ===================================================================== */
  function cerrarSesion() {
    fijarSesion(false);
    consultaActual = null;
    irA("login");
  }

  function pedirSalida() {
    dialogos.confirmar({ titulo: "¿Salir del cajero?", texto: "Tendrás que ingresar tu PIN nuevamente.", boton: "Salir", peligro: true })
      .then((acepta) => { if (acepta) cerrarSesion(); });
  }

  function reiniciarInactividad() {
    clearTimeout(temporizadorInactividad);
    if (!sesionActiva()) return;
    temporizadorInactividad = setTimeout(() => {
      dialogos.cerrar();
      confirmando = false;
      cerrarSesion();
      dialogos.aviso("Sesión cerrada", "Por tu seguridad cerramos la sesión tras un momento sin actividad.");
    }, INACTIVIDAD_MS);
  }

  /* =====================================================================
     6. Navegación entre vistas (según el # de la dirección)
     ===================================================================== */
  function limpiarFlujo(nombre) {
    $$("form", $("#" + nombre)).forEach((formulario) => { formulario.reset(); marcarErrores(formulario, null); });
    if (nombre === "retiro") {
      $("#otro-monto").hidden = true;
      $("#foot-ret").hidden = false;
      $("#btn-otro").hidden = false;
      $("#btn-otro").setAttribute("aria-expanded", "false");
    }
    if (nombre === "servicios") apuntarTeclado("contrato");
  }

  /* En el pago de servicios el teclado escribe en el último campo tocado */
  function apuntarTeclado(idCampo) {
    const teclado = $("#pad-servicios");
    teclado.dataset.for = idCampo;
    teclado.dataset.dot = idCampo === "contrato" ? "0" : "1";
    armarTeclado(teclado);
  }

  function ruta() {
    let destino = window.location.hash.slice(1) || "login";
    if (destino === "login" && sesionActiva()) fijarSesion(false);
    if (destino !== "login" && !sesionActiva()) destino = "login";
    if (destino !== "login" && !VISTAS.includes(destino)) destino = "acciones";
    // El saldo solo se muestra como resultado de una consulta registrada
    if (destino === "saldo" && !consultaActual) destino = "acciones";
    if (destino !== "saldo") consultaActual = null;
    if (window.location.hash !== "#" + destino) history.replaceState(null, "", "#" + destino);

    const cambio = destino !== vista;
    vista = destino;
    $("#login").hidden = vista !== "login";
    $("#app").hidden = vista === "login";
    VISTAS.forEach((v) => { $("#" + v).hidden = v !== vista; });
    document.body.dataset.view = vista;
    document.body.dataset.flow = FLUJOS.includes(vista) ? "1" : "0";
    document.title = TITULOS[vista] + " | Pokémon Bank";
    $$("[data-nav]").forEach((enlace) => {
      const activo = enlace.dataset.nav === (FLUJOS.includes(vista) ? "acciones" : vista);
      enlace.classList.toggle("active", activo);
      if (activo) enlace.setAttribute("aria-current", "page"); else enlace.removeAttribute("aria-current");
    });

    if (cambio && FLUJOS.includes(vista)) limpiarFlujo(vista);
    if (vista === "login") { campoPin().value = ""; revisarBloqueo(); }
    pintar();
    reiniciarInactividad();
    if (cambio) window.scrollTo({ top: 0, behavior: "instant" });
  }

  function irA(destino) {
    if (window.location.hash !== "#" + destino) history.pushState(null, "", "#" + destino);
    ruta();
  }

  /* =====================================================================
     7. Eventos
     ===================================================================== */
  function alHacerClic(evento) {
    const buscar = (selector) => evento.target.closest(selector);
    let el;

    if ((el = buscar(".pk-key"))) return pulsarTecla(el);
    if ((el = buscar("[data-rapido]"))) return pedirRetiro(el.dataset.rapido);
    if ((el = buscar("[data-suma]"))) {
      const campo = $("#monto-deposito");
      campo.value = String(Math.round(((Number(campo.value) || 0) + Number(el.dataset.suma)) * 100) / 100);
      return undefined;
    }
    if (buscar("[data-consulta]")) { evento.preventDefault(); return consultarSaldo(); }
    if (buscar('a[href="#login"]')) { evento.preventDefault(); return pedirSalida(); }
    if (buscar("#btn-pdf-saldo")) return dialogos.comprobante(consultaActual, datos.obtener(), "Comprobante de consulta");
    if ((el = buscar("[data-pdf]"))) {
      const usuario = datos.obtener();
      const transaccion = usuario.transacciones.find((t) => t.id === Number(el.dataset.pdf));
      return dialogos.comprobante(transaccion, usuario, "Comprobante");
    }
    return undefined;
  }

  function conectarFormularios() {
    $("#form-login").addEventListener("submit", (e) => { e.preventDefault(); iniciarSesion(); });
    // Al escribir el 4.º dígito el PIN se envía solo, como en un cajero real
    campoPin().addEventListener("input", () => {
      if (campoPin().value.length === 4) setTimeout(() => { if (campoPin().value.length === 4) iniciarSesion(); }, 180);
    });

    $("#form-deposito").addEventListener("submit", (e) => {
      e.preventDefault();
      pedirDeposito($("#monto-deposito").value, e.currentTarget);
    });
    $("#form-retiro").addEventListener("submit", (e) => {
      e.preventDefault();
      pedirRetiro($("#monto-retiro").value, e.currentTarget);
    });
    $("#form-servicios").addEventListener("submit", (e) => {
      e.preventDefault();
      const elegido = $('input[name="servicio"]:checked');
      pedirServicio({
        servicio: elegido ? elegido.value : "",
        contrato: $("#contrato").value,
        monto: $("#monto-servicio").value
      }, e.currentTarget);
    });

    // Con el teclado físico solo se aceptan dígitos (y un punto en los montos)
    $$("#pin, #monto-deposito, #monto-retiro, #monto-servicio, #contrato").forEach((campo) => {
      const aceptaPunto = campo.id === "monto-deposito" || campo.id === "monto-servicio";
      campo.addEventListener("input", () => {
        campo.value = campo.value.replace(aceptaPunto ? /[^\d.]/g : /\D/g, "");
        campo.classList.remove("is-invalid");
      });
    });
    $$("[data-pad]").forEach((campo) => campo.addEventListener("focus", () => apuntarTeclado(campo.id)));
  }

  function conectarBotones() {
    document.addEventListener("click", alHacerClic);
    // Evita que el toque en una tecla le quite el foco al campo
    document.addEventListener("mousedown", (e) => { if (e.target.closest(".pk-key")) e.preventDefault(); });
    ["pointerdown", "keydown"].forEach((nombre) => document.addEventListener(nombre, reiniciarInactividad));

    $("#btn-otro").addEventListener("click", () => {
      $("#otro-monto").hidden = false;
      $("#foot-ret").hidden = true;
      $("#btn-otro").hidden = true;
      $("#btn-otro").setAttribute("aria-expanded", "true");
      $("#monto-retiro").focus();
    });

    $$("[data-filtro]").forEach((boton) => boton.addEventListener("click", () => {
      filtro = boton.dataset.filtro;
      mostrar = POR_PAGINA;
      $$("[data-filtro]").forEach((otro) => {
        otro.classList.toggle("active", otro === boton);
        otro.setAttribute("aria-pressed", String(otro === boton));
      });
      pintar();
    }));
    $("#btn-mas").addEventListener("click", () => { mostrar += POR_PAGINA; pintar(); });

    $("#btn-reset").addEventListener("click", () => {
      dialogos.confirmar({
        titulo: "¿Restablecer datos?", boton: "Restablecer", peligro: true,
        texto: "El saldo volverá a $500.00 y se borrará el historial."
      }).then((acepta) => {
        if (!acepta) return;
        datos.reiniciar();
        pintar();
        dialogos.exito("Datos restablecidos", "Tu saldo es " + formato.dinero(datos.obtener().saldo) + ".");
      });
    });
  }

  /* =====================================================================
     8. Arranque
     ===================================================================== */
  function iniciar() {
    // SweetAlert y Validate.js son indispensables para operar con seguridad
    if (!window.swal || !window.validate) {
      mensajePin("No se pudieron cargar las librerías. Revisa que exista la carpeta js/vendor y recarga la página.");
      $("#btn-login").disabled = true;
      return;
    }
    validar.iniciar();
    $$(".pk-keypad").forEach(armarTeclado);
    conectarFormularios();
    conectarBotones();

    // Atrás/adelante del navegador: se cancela cualquier confirmación abierta
    window.addEventListener("popstate", () => {
      if (confirmando) { confirmando = false; dialogos.cerrar(); }
      ruta();
    });
    window.addEventListener("hashchange", () => { if (window.location.hash.slice(1) !== vista) ruta(); });
    // Si los datos cambian en otra pestaña, se actualiza la pantalla
    window.addEventListener("storage", pintar);
    ruta();
  }

  iniciar();
})(window.PB);
