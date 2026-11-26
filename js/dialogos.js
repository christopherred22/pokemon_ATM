/* ==========================================================================
   Pokémon Bank - js/dialogos.js
   Todos los mensajes al usuario usan SweetAlert (https://sweetalert.js.org/).
   La aplicación no usa alert(), confirm() ni prompt().
   ========================================================================== */
window.PB = window.PB || {};

(function (PB) {
  "use strict";

  /* Crea un elemento con clase y texto (textContent evita inyectar HTML). */
  function crear(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  /* Lista «etiqueta: valor» para confirmaciones y comprobantes. */
  function tabla(filas) {
    const lista = crear("dl", "pk-sheet-rows");
    filas.forEach(([etiqueta, valor]) => {
      const fila = crear("div");
      fila.append(crear("dt", "", etiqueta), crear("dd", "", valor));
      lista.append(fila);
    });
    return lista;
  }

  function error(titulo, texto) {
    return window.swal({ title: titulo, text: texto, icon: "error", button: "Entendido" });
  }

  function aviso(titulo, texto) {
    return window.swal({ title: titulo, text: texto, icon: "info", button: "Aceptar" });
  }

  function exito(titulo, texto, duracion) {
    return window.swal({ title: titulo, text: texto, icon: "success", button: "Continuar", timer: duracion });
  }

  /* Devuelve una promesa que resuelve true solo si el usuario acepta. */
  function confirmar({ titulo, texto, filas, boton, peligro }) {
    return window.swal({
      title: titulo,
      text: texto,
      content: filas ? tabla(filas) : undefined,
      icon: "warning",
      buttons: {
        cancel: { text: "Cancelar", value: false, visible: true },
        confirm: { text: boton, value: true }
      },
      dangerMode: Boolean(peligro),
      closeOnClickOutside: false
    }).then((respuesta) => respuesta === true);
  }

  /* Comprobante en pantalla con las opciones de descargarlo o imprimirlo. */
  function comprobante(transaccion, usuario, titulo) {
    const contenido = crear("div");
    const botones = crear("div", "pk-pdf-botones");
    const estado = crear("p", "pk-pdf-estado");
    estado.setAttribute("role", "status");

    function boton(texto, clase, accion) {
      const b = crear("button", "btn pk-btn " + clase, texto);
      b.type = "button";
      b.addEventListener("click", () => {
        try {
          estado.textContent = accion();
        } catch (fallo) {
          estado.textContent = fallo.message;
        }
      });
      botones.append(b);
    }

    boton("Descargar PDF", "pk-btn-primary", () => {
      PB.comprobante.descargar(transaccion, usuario);
      return "Comprobante descargado.";
    });
    boton("Imprimir", "pk-btn-light", () => (PB.comprobante.imprimir(transaccion, usuario)
      ? "Comprobante abierto para imprimir."
      : "El navegador bloqueó la ventana; se descargó el PDF."));

    contenido.append(tabla(PB.comprobante.filas(transaccion, usuario)), botones, estado);

    return window.swal({
      title: titulo || "¡Operación exitosa!",
      content: contenido,
      icon: "success",
      button: "Finalizar",
      closeOnClickOutside: false
    });
  }

  const hayDialogo = () => Boolean(window.swal.getState().isOpen);
  const cerrar = () => window.swal.close();

  PB.dialogos = { error, aviso, exito, confirmar, comprobante, hayDialogo, cerrar };
})(window.PB);
