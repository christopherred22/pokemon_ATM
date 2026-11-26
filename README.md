# Pokémon Bank — Simulador de Cajero Automático (ATM)

**Universidad Don Bosco · Lenguajes Interpretados en el Cliente (LIC941)**
**Proyecto de Cátedra — Fase 2 (JavaScript del lado del cliente)**

Cajero automático web, responsive y estilo kiosco. Inicializa los datos del usuario en LocalStorage y registra todas sus transacciones.

## Usuario de prueba

| Dato | Valor |
|------|-------|
| Nombre | Ash Ketchum |
| PIN | 1234 |
| Cuenta | 0987654321 |
| Saldo inicial | $500.00 |

## Cómo ejecutarlo

1. Descarga o clona el repositorio.
2. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox o Safari).
3. Ingresa el PIN `1234`.

**No necesita internet:** Bootstrap está en `css/` y las librerías de JavaScript en `js/vendor/`.

## Funciones

| Requisito | Cómo se resuelve | Librería |
|-----------|------------------|----------|
| Inicio de sesión | PIN de 4 dígitos; muestra nombre y cuenta solo si es correcto; 3 intentos y bloqueo de 30 s | — |
| Datos del usuario | Objeto JSON en LocalStorage, se crea en la primera visita y se repara si está dañado | LocalStorage |
| Transacciones | Depósito, retiro, consulta de saldo y pago de servicios (energía, internet, telefonía y agua) | — |
| Validaciones | Todos los campos de entrada | Validate.js 0.13.1 |
| Diálogos | Bienvenida, errores, confirmaciones, comprobantes y salida | SweetAlert 2.1.2 |
| Comprobante | PDF para descargar o imprimir; también disponible desde el historial | jsPDF 2.5.1 |
| Gráficos | Número de transacciones por tipo y monto acumulado | Chart.js 4.4.1 |

## Reglas del negocio

- Depósito: mayor que $0, máximo $5,000 por operación y hasta 2 decimales.
- Retiro: cantidad entera múltiplo de $5, límite diario de $500 (acumulado) y sin exceder el saldo.
- Pago de servicios: contrato de 6 a 12 dígitos y monto menor o igual al saldo.
- Cada operación se valida, se confirma, se registra y genera su comprobante.
- La sesión se cierra con «Salir» o tras 90 segundos sin actividad.
- «Restablecer datos» (en el historial) vuelve al saldo de $500.00 con el historial vacío.

## Datos guardados

Clave `pokemonbank_usuario` (los montos van en centavos para evitar errores de redondeo):

```json
{
  "nombre": "Ash Ketchum",
  "pin": "1234",
  "cuenta": "0987654321",
  "saldo": 65000,
  "transacciones": [
    { "id": 1, "fecha": "2026-11-25T21:05:00.000Z", "tipo": "dep", "detalle": "Depósito en efectivo", "monto": 15000, "saldo": 65000 }
  ]
}
```

> El PIN se guarda en el navegador porque es una simulación del lado del cliente. En un banco real la autenticación se hace en el servidor.

## Estructura del proyecto

```
pokemon-bank/
├── index.html
├── css/
│   ├── bootstrap.min.css   Bootstrap 4.6.2 (copia local)
│   └── styles.css          Identidad visual y componentes propios
├── js/
│   ├── vendor/             SweetAlert, Validate.js, jsPDF y Chart.js
│   ├── datos.js            LocalStorage, reglas del negocio y formatos
│   ├── validaciones.js     Reglas de Validate.js
│   ├── comprobante.js      PDF con jsPDF
│   ├── dialogos.js         Diálogos con SweetAlert
│   ├── graficos.js         Gráficos con Chart.js
│   └── main.js             Interfaz, sesión, navegación y transacciones
├── images/
├── ejemplos/               Investigación de las librerías (Fase 1)
├── .gitattributes
├── .gitignore
└── README.md
```

Repositorio: https://github.com/christopherred22/pokemon_ATM
