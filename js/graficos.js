/* ==========================================================================
   Pokémon Bank - js/graficos.js
   Gráficos con Chart.js (https://www.chartjs.org/):
     1. Número de transacciones realizadas por cada tipo (dona).
     2. Monto acumulado por tipo de movimiento (barras).
   Los gráficos se crean una sola vez y después solo se actualizan.
   ========================================================================== */
window.PB = window.PB || {};

(function (PB) {
  "use strict";

  let graficoCantidad = null, graficoMonto = null;

  function crearCantidad(canvas, claves) {
    return new window.Chart(canvas, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: claves.map((k) => PB.datos.TIPOS[k].color), borderWidth: 3 }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, padding: 14 } },
          tooltip: { callbacks: { label: (c) => " " + c.parsed + " transacción(es)" } }
        }
      }
    });
  }

  function crearMonto(canvas, claves) {
    return new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: claves.map((k) => PB.datos.TIPOS[k].plural),
        datasets: [{ label: "Monto", data: [], backgroundColor: claves.map((k) => PB.datos.TIPOS[k].color), borderRadius: 10 }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => " " + PB.formato.dinero(Math.round(c.parsed.y * 100)) } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => "$" + v } } }
      }
    });
  }

  /* resumen = { dep: { cantidad, total }, ret: {...}, ... } */
  function actualizar(resumen) {
    if (!window.Chart) return false;
    const claves = Object.keys(PB.datos.TIPOS);
    const conMonto = claves.filter((k) => PB.datos.TIPOS[k].signo !== 0);
    const canvasCantidad = document.getElementById("grafico-cantidad");
    const canvasMonto = document.getElementById("grafico-monto");

    graficoCantidad = graficoCantidad || crearCantidad(canvasCantidad, claves);
    graficoMonto = graficoMonto || crearMonto(canvasMonto, conMonto);

    // La cantidad va en la leyenda para que se lea sin pasar el cursor
    graficoCantidad.data.labels = claves.map((k) => PB.datos.TIPOS[k].plural + ": " + resumen[k].cantidad);
    graficoCantidad.data.datasets[0].data = claves.map((k) => resumen[k].cantidad);
    graficoMonto.data.datasets[0].data = conMonto.map((k) => resumen[k].total / 100);
    graficoCantidad.update();
    graficoMonto.update();

    // Texto alternativo para lectores de pantalla
    canvasCantidad.setAttribute("aria-label", "Número de transacciones por tipo. " + graficoCantidad.data.labels.join(", ") + ".");
    canvasMonto.setAttribute("aria-label", "Monto acumulado. " + conMonto.map((k) => PB.datos.TIPOS[k].plural + ": " + PB.formato.dinero(resumen[k].total)).join(", ") + ".");
    return true;
  }

  PB.graficos = { actualizar };
})(window.PB);
