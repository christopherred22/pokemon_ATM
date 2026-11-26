/* ==========================================================================
   Pokémon Bank - js/validaciones.js
   Reglas de validación de TODOS los campos de entrada, declaradas con
   Validate.js (https://validatejs.org/).

   Cada función devuelve null si los datos son correctos, o un objeto
   { campo: "mensaje" } con el primer error de cada campo.
   El prefijo «^» en un mensaje evita que Validate.js anteponga el nombre
   del campo.
   ========================================================================== */
window.PB = window.PB || {};

(function (PB) {
  "use strict";

  const SOLO_MONTO = "\\d+(\\.\\d{1,2})?";   // 20  |  20.5  |  20.50

  /* Ejecuta Validate.js y deja solo el primer mensaje de cada campo. */
  function revisar(valores, reglas) {
    const errores = window.validate(valores, reglas);
    if (!errores) return null;
    const primeros = {};
    Object.keys(errores).forEach((campo) => { primeros[campo] = errores[campo][0]; });
    return primeros;
  }

  /* Validador propio: el valor (en dólares) no puede superar un tope variable,
     por ejemplo el saldo disponible. */
  function tope(valor, opciones) {
    if (!opciones || valor === undefined || valor === "") return undefined;
    return Number(valor) > opciones.maximo ? opciones.message : undefined;
  }

  /* Registra los validadores propios. Se llama una vez al iniciar la app. */
  function iniciar() {
    window.validate.validators.fondos = tope;
    window.validate.validators.limiteDiario = tope;
  }

  function reglaFondos(saldo) {
    return {
      maximo: saldo / 100,
      message: "^Fondos insuficientes. Tu saldo es " + PB.formato.dinero(saldo) + "."
    };
  }

  function pin(valor) {
    return revisar({ pin: valor }, {
      pin: {
        presence: { allowEmpty: false, message: "^Ingresa tu PIN." },
        format: { pattern: "\\d{4}", message: "^El PIN debe tener exactamente 4 dígitos." }
      }
    });
  }

  function deposito(valor) {
    return revisar({ monto: valor }, {
      monto: {
        presence: { allowEmpty: false, message: "^Ingresa el monto a depositar." },
        format: { pattern: SOLO_MONTO, message: "^Escribe un monto válido, con máximo 2 decimales." },
        numericality: {
          greaterThan: 0,
          lessThanOrEqualTo: PB.datos.MAX_DEPOSITO / 100,
          notGreaterThan: "^El monto debe ser mayor que $0.",
          notLessThanOrEqualTo: "^El máximo por depósito es $5,000.00."
        }
      }
    });
  }

  function retiro(valor, saldo, disponibleHoy) {
    return revisar({ monto: valor }, {
      monto: {
        presence: { allowEmpty: false, message: "^Elige o escribe el monto a retirar." },
        format: { pattern: "\\d+", message: "^El retiro debe ser una cantidad entera, sin centavos." },
        numericality: {
          greaterThan: 0,
          divisibleBy: 5,
          lessThanOrEqualTo: PB.datos.LIMITE_DIARIO / 100,
          notGreaterThan: "^El monto debe ser mayor que $0.",
          notDivisibleBy: "^El monto debe ser múltiplo de $5.",
          notLessThanOrEqualTo: "^El límite por retiro es de $500.00."
        },
        limiteDiario: {
          maximo: disponibleHoy / 100,
          message: "^Superas tu límite diario. Hoy puedes retirar " + PB.formato.dinero(disponibleHoy) + " más."
        },
        fondos: reglaFondos(saldo)
      }
    });
  }

  function servicio(valores, saldo) {
    return revisar(valores, {
      servicio: {
        presence: { allowEmpty: false, message: "^Selecciona el servicio a pagar." },
        inclusion: { within: Object.keys(PB.datos.SERVICIOS), message: "^El servicio no es válido." }
      },
      contrato: {
        presence: { allowEmpty: false, message: "^Ingresa el número de contrato." },
        format: { pattern: "\\d{6,12}", message: "^El contrato debe tener entre 6 y 12 dígitos." }
      },
      monto: {
        presence: { allowEmpty: false, message: "^Ingresa el monto a pagar." },
        format: { pattern: SOLO_MONTO, message: "^Escribe un monto válido, con máximo 2 decimales." },
        numericality: { greaterThan: 0, notGreaterThan: "^El monto debe ser mayor que $0." },
        fondos: reglaFondos(saldo)
      }
    });
  }

  PB.validar = { iniciar, pin, deposito, retiro, servicio };
})(window.PB);
