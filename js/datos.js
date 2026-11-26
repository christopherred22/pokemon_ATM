/* ==========================================================================
   Pokémon Bank - js/datos.js
   Capa de datos: inicializa el usuario como objeto JSON en LocalStorage y
   registra todas sus transacciones. Ningún otro archivo toca LocalStorage
   para leer o escribir la información del usuario.

   Los montos se guardan en CENTAVOS (enteros) para evitar errores de
   redondeo al sumar decimales.
   ========================================================================== */
window.PB = window.PB || {};

(function (PB) {
  "use strict";

  const CLAVE_USUARIO = "pokemonbank_usuario";
  const LIMITE_DIARIO = 50000;    // $500.00 en retiros por día
  const MAX_DEPOSITO = 500000;    // $5,000.00 por depósito

  /* Datos solicitados en el planteamiento del problema.
     Nota: un banco real nunca guardaría el PIN en el navegador; aquí se hace
     porque es una simulación del lado del cliente. */
  const USUARIO_INICIAL = Object.freeze({
    nombre: "Ash Ketchum",
    pin: "1234",
    cuenta: "0987654321",
    saldo: 50000                  // saldo inicial: $500.00
  });

  /* Catálogo de tipos de transacción. «signo» indica cómo afecta al saldo. */
  const TIPOS = Object.freeze({
    dep: { nombre: "Depósito", plural: "Depósitos", signo: 1, color: "#12a874" },
    ret: { nombre: "Retiro", plural: "Retiros", signo: -1, color: "#e0442f" },
    pag: { nombre: "Pago de servicio", plural: "Pago de servicios", signo: -1, color: "#3d5bd9" },
    sal: { nombre: "Consulta de saldo", plural: "Consultas de saldo", signo: 0, color: "#f59e0b" }
  });

  const SERVICIOS = Object.freeze({
    energia: "Energía eléctrica",
    internet: "Internet",
    telefonia: "Telefonía",
    agua: "Agua potable"
  });

  /* Copia en memoria: solo se usa si el navegador bloquea LocalStorage. */
  let memoria = null;
  let almacenamientoDisponible = true;

  function nuevoUsuario() {
    return Object.assign({}, USUARIO_INICIAL, { transacciones: [] });
  }

  /* Comprueba que lo leído tenga la forma esperada (pudo ser alterado). */
  function esTransaccionValida(t) {
    return Boolean(t) && Object.prototype.hasOwnProperty.call(TIPOS, t.tipo) &&
      Number.isInteger(t.id) && Number.isInteger(t.monto) && Number.isInteger(t.saldo) &&
      typeof t.detalle === "string" && !Number.isNaN(Date.parse(t.fecha));
  }

  function esUsuarioValido(u) {
    return Boolean(u) && typeof u.nombre === "string" && typeof u.pin === "string" &&
      typeof u.cuenta === "string" && Number.isInteger(u.saldo) && u.saldo >= 0 &&
      Array.isArray(u.transacciones) && u.transacciones.every(esTransaccionValida);
  }

  function leer() {
    if (!almacenamientoDisponible) return null;
    try {
      const usuario = JSON.parse(localStorage.getItem(CLAVE_USUARIO));
      return esUsuarioValido(usuario) ? usuario : null;
    } catch (error) {
      return null;                // JSON dañado o almacenamiento bloqueado
    }
  }

  function guardar(usuario) {
    memoria = usuario;
    try {
      localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    } catch (error) {
      almacenamientoDisponible = false;
    }
  }

  /* Devuelve el usuario guardado; si no existe (o está dañado) lo inicializa. */
  function obtener() {
    const guardado = leer();
    if (guardado) return guardado;
    const usuario = (!almacenamientoDisponible && memoria) || nuevoUsuario();
    guardar(usuario);
    return usuario;
  }

  /* Registra una transacción, actualiza el saldo y la devuelve. */
  function registrar(tipo, detalle, monto) {
    const usuario = obtener();
    const saldo = usuario.saldo + TIPOS[tipo].signo * monto;
    if (saldo < 0) throw new Error("Fondos insuficientes.");

    const transaccion = {
      id: usuario.transacciones.length + 1,
      fecha: new Date().toISOString(),
      tipo: tipo,
      detalle: detalle,
      monto: monto,
      saldo: saldo
    };
    usuario.saldo = saldo;
    usuario.transacciones.push(transaccion);
    guardar(usuario);
    return transaccion;
  }

  /* Cuánto queda hoy del límite diario de retiro (en centavos). */
  function disponibleHoy(usuario) {
    const hoy = new Date().toDateString();
    const retirado = usuario.transacciones
      .filter((t) => t.tipo === "ret" && new Date(t.fecha).toDateString() === hoy)
      .reduce((total, t) => total + t.monto, 0);
    return Math.max(0, LIMITE_DIARIO - retirado);
  }

  /* Cantidad de transacciones y monto acumulado por cada tipo. */
  function resumen(transacciones) {
    const datos = {};
    Object.keys(TIPOS).forEach((tipo) => { datos[tipo] = { cantidad: 0, total: 0 }; });
    transacciones.forEach((t) => {
      datos[t.tipo].cantidad += 1;
      datos[t.tipo].total += t.monto;
    });
    return datos;
  }

  /* ---------- Formatos de presentación ---------- */
  function dinero(centavos) {
    return "$" + (centavos / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function aCentavos(texto) {
    return Math.round(Number(texto) * 100);
  }

  function fecha(iso) {
    return new Date(iso).toLocaleDateString("es-SV", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function fechaHora(iso) {
    return fecha(iso) + " " + new Date(iso).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function numeroOperacion(id) {
    return String(id).padStart(4, "0");
  }

  // Crea los datos del usuario desde la primera visita
  obtener();

  PB.datos = {
    TIPOS, SERVICIOS, LIMITE_DIARIO, MAX_DEPOSITO,
    obtener, registrar, disponibleHoy, resumen,
    reiniciar: () => guardar(nuevoUsuario())
  };
  PB.formato = { dinero, aCentavos, fecha, fechaHora, numeroOperacion };
})(window.PB);
