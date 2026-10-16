# Pokémon Bank — Simulador de Cajero Automático (ATM)

**Universidad Don Bosco · Lenguajes Interpretados en el Cliente (LIC941)**
**Proyecto de Cátedra (HTML5 + CSS3 + Bootstrap 4 + JavaScript)**

Interfaz web responsive, estilo kiosco, que simula un cajero automático a partir de los datos de un usuario de prueba.

## Usuario de prueba

| Dato | Valor |
|------|-------|
| Titular | Ash Ketchum |
| N.º de cuenta | PKB-2026-000151 |
| PIN | 1234 |
| Saldo inicial | $1,250.75 |

## Pantallas (una sola página: `index.html`)

| Vista | Enlace interno | Descripción |
|-------|----------------|-------------|
| Login | `#login` (por defecto) | PIN de 4 dígitos con teclado en pantalla; 3 intentos y bloqueo de 30 s |
| Acciones | `#acciones` | Nombre y cuenta del titular; depósito, retiro, consulta de saldo y pago de servicios; retiro rápido; salir |
| Depósito / Retiro / Saldo / Servicios | `#deposito` `#retiro` `#saldo` `#servicios` | Pantallas de transacción: montos grandes, teclado numérico, confirmación y comprobante |
| Historial | `#historial` | Transacciones (la más reciente primero) con filtro por tipo |
| Gráfico | `#grafico` | Análisis por tipo de transacción (cantidad y monto) |

En escritorio la navegación es un panel lateral; en móvil y tableta es una **barra inferior tipo kiosco**.

## Reglas de negocio implementadas

- PIN de 4 dígitos; tras **3 intentos fallidos** se bloquea 30 segundos.
- Sin PIN no se puede entrar a ninguna vista (aunque se escriba `#acciones` en la dirección). La sesión se cierra con «Salir» o a los 90 s de inactividad.
- Depósito: mayor que $0 y máximo $5,000 por operación.
- Retiro: múltiplo de $5, **límite diario de $500** (acumulado), sin exceder el saldo.
- Pago de servicios: contrato de 6 a 12 dígitos y monto menor o igual al saldo.
- Cada operación pide confirmación, muestra un comprobante y se registra en el historial; la consulta de saldo se registra al tocar «Mi saldo».

## Estructura del proyecto

```
pokemon-bank/
├── index.html           (aplicación completa de una sola página)
├── css/
│   ├── bootstrap.min.css  (Bootstrap 4.6.2, copia local)
│   └── styles.css         (identidad visual y componentes propios)
├── js/
│   └── main.js            (sesión, navegación, transacciones, historial y gráficos)
├── images/
├── ejemplos/            (sweetalert, jsPDF, Chart.js, validatejs)
├── .gitignore
└── README.md
```

## Cómo ejecutarlo

1. Descarga o clona el repositorio.
2. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox o Safari reciente). No necesita internet: Bootstrap va incluido en `css/`. (Solo las páginas de `ejemplos/` cargan su librería desde un CDN.)
3. Ingresa el PIN `1234`.

Los datos (saldo e historial) se guardan en `localStorage`; el botón «Restablecer datos de prueba» del historial vuelve al estado inicial.

## Tecnologías

- HTML5 y CSS3 (variables CSS, grid, `conic-gradient` para los gráficos)
- Bootstrap 4.6 (rejilla, botones, tarjetas, formularios y utilidades responsive)
- JavaScript sin dependencias
- Git y GitHub para el versionamiento
- Librerías investigadas con ejemplo en `ejemplos/`: SweetAlert, jsPDF, Chart.js y ValidateJS

## Repositorio y pruebas rápidas

- Repositorio: https://github.com/christopherred22/pokemon_ATM
- PIN de prueba: `1234` (3 intentos; luego se bloquea 30 s).
- Límite de retiro: $500 por día. Depósito máximo: $5,000 por operación.
- Para reiniciar los datos: botón «Restablecer datos de prueba» en el historial.
