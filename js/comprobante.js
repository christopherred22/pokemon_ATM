/* ==========================================================================
   Pokémon Bank - js/comprobante.js
   Comprobante de transacción en PDF con jsPDF (https://parall.ax/products/jspdf).
   Usa un formato angosto (80 mm), como el recibo de un cajero.
   ========================================================================== */
window.PB = window.PB || {};

(function (PB) {
  "use strict";

  const ANCHO = 80, ALTO = 150, MARGEN = 7;   // milímetros

  /* Filas [etiqueta, valor] que comparten el diálogo y el PDF. */
  function filas(t, usuario) {
    const tipo = PB.datos.TIPOS[t.tipo];
    const dinero = PB.formato.dinero;
    const lista = [
      ["N.º de operación", PB.formato.numeroOperacion(t.id)],
      ["Fecha y hora", PB.formato.fechaHora(t.fecha)],
      ["Titular", usuario.nombre],
      ["N.º de cuenta", usuario.cuenta],
      ["Operación", tipo.nombre],
      ["Detalle", t.detalle]
    ];
    if (tipo.signo !== 0) {
      lista.push(["Monto", dinero(t.monto)]);
      lista.push(["Saldo anterior", dinero(t.saldo - tipo.signo * t.monto)]);
    }
    lista.push(["Saldo disponible", dinero(t.saldo)]);
    return lista;
  }

  function crearPDF(t, usuario) {
    if (!window.jspdf) throw new Error("No se pudo cargar jsPDF. Revisa que exista la carpeta js/vendor.");
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: [ANCHO, ALTO] });
    const centro = ANCHO / 2;

    // Encabezado
    doc.setFillColor(20, 26, 90);
    doc.rect(0, 0, ANCHO, 24, "F");
    doc.setFillColor(255, 203, 5);
    doc.rect(0, 24, ANCHO, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(15);
    doc.text("Pokémon Bank", centro, 11, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text("Comprobante de transacción", centro, 18, { align: "center" });

    // Detalle: etiqueta a la izquierda y, debajo, su valor
    let y = 34;
    filas(t, usuario).forEach(([etiqueta, valor]) => {
      doc.setTextColor(94, 101, 145);
      doc.setFont("helvetica", "normal").setFontSize(7.5);
      doc.text(etiqueta.toUpperCase(), MARGEN, y);
      doc.setTextColor(27, 32, 80);
      doc.setFont("helvetica", "bold").setFontSize(10);
      const lineas = doc.splitTextToSize(valor, ANCHO - MARGEN * 2);
      doc.text(lineas, MARGEN, y + 4.2);
      y += 6.2 + lineas.length * 4.2;
    });

    // Pie
    doc.setDrawColor(180, 186, 220);
    doc.setLineDashPattern([1.2, 1], 0);
    doc.line(MARGEN, ALTO - 13, ANCHO - MARGEN, ALTO - 13);
    doc.setTextColor(94, 101, 145);
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.text("Simulación con fines académicos · UDB LIC941", centro, ALTO - 7, { align: "center" });
    return doc;
  }

  function nombreArchivo(t) {
    return "comprobante-" + PB.formato.numeroOperacion(t.id) + ".pdf";
  }

  function descargar(t, usuario) {
    crearPDF(t, usuario).save(nombreArchivo(t));
  }

  /* Abre el PDF en otra pestaña con la orden de impresión. Si el navegador
     bloquea la ventana, devuelve false y descarga el archivo. */
  function imprimir(t, usuario) {
    const doc = crearPDF(t, usuario);
    doc.autoPrint();
    const ventana = window.open(doc.output("bloburl"), "_blank");
    if (!ventana) doc.save(nombreArchivo(t));
    return Boolean(ventana);
  }

  PB.comprobante = { filas, crearPDF, descargar, imprimir };
})(window.PB);
