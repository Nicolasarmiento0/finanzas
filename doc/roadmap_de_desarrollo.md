# Roadmap de Implementación: App de Finanzas Personales

Este documento desglosa el desarrollo de la aplicación en fases modulares y tareas atómicas, diseñado para ser ejecutado progresivamente por un agente de desarrollo sin sobrecargar la ventana de contexto. Manteniendo ui definida en readme.md

---

## Fase 1: Arquitectura Base y Modelo de Datos (Core Backend)

**Objetivo:** Establecer la persistencia de datos y las entidades fundamentales necesarias para replicar y expandir el Excel.

### Tarea 1.1: Esquema de Base de Datos
- [x] Definir tabla de usuarios (`users`).
- [x] Definir tabla de cuentas (`accounts`) con campos:
  - `id`, `user_id`, `name`, `type` (`checking`, `credit_card`, `savings`, `loan`).
  - `current_balance`, `credit_limit`, `interest_rate_annual`.
- [x] Definir tabla de movimientos recurrentes (`recurring_items`):
  - `id`, `account_id`, `title`, `amount`, `type` (`income` | `expense`).
  - `category`, `start_date`, `end_date`, `is_active`.
- [x] Definir tabla de desglose para suscripciones anidadas (`recurring_sub_items`):
  - `id`, `recurring_item_id`, `name`, `amount`.

### Tarea 1.2: Endpoints CRUD de Cuentas y Recurrentes
- [x] Endpoint para crear/listar/editar cuentas financieras.
- [x] Endpoint para crear/listar ítems recurrentes (ingresos fijos y gastos fijos).
- [x] Endpoint para agregar y remover sub-ítems anidados a un gasto matriz (ej: paquete Apple + YouTube + SmartFit).

---

## Fase 2: Módulo de Gastos Fijos, Ingresos y Tarjetas (Sustitución del Excel)

**Objetivo:** Replicar exactamente la operativa diaria que hoy realizas en las hojas de cálculo.

### Tarea 2.1: Gestión de Gastos e Ingresos Fijos (UI & Lógica)
- [x] Vista de resumen mensual: total de ingresos vs. total de gastos fijos.
- [x] Checklist interactivo de pago: marcar si un gasto mensual ya fue cancelado en el mes en curso.
- [x] Regla de vigencia temporal: omitir automáticamente en el mes correspondiente los gastos con fecha límite (ej: *"hasta abril 2027"* o el crédito vehicular a *"diciembre 2026"*).

### Tarea 2.2: Tarjetas de Crédito y Manejo de Cupos
- [x] Cálculo dinámico de cupo disponible: $\text{Cupo Disponible} = \text{Cupo Total} - \text{Monto Facturado/Utilizado}$.
- [x] Desglose por tarjeta: visualización de servicios anidados asociados a cada plástico (Santander vs. CMR Falabella).
- [x] Alerta de vencimiento / fecha de corte de facturación mensual.

---

## Fase 3: Módulo de Cuentas de Ahorro y Motor de Pronóstico Dual

Contexto y Objetivo

Implementar la sección de cuentas de ahorro en la aplicación de finanzas personales. Debe soportar la coexistencia y proyección independiente (o combinada) de dos modalidades de ahorro:

Cuenta Rentable: Cuenta con interés compuesto (ej. $4.00\%$ anual nominal).

Cuenta Tradicional: Cuenta de ahorro a la vista / fondo de liquidez sin rentabilidad ($0\%$).

El usuario debe poder proyectar con precisión cuánto dinero tendrá en cualquiera de las cuentas a un mes determinado del futuro, considerando aportes fijos o el superávit dinámico resultante del término de compromisos financieros (gastos o créditos que expiran con el tiempo).

### Tarea 3.1: Modelo de Datos y Tipado de Cuentas de Ahorro

Requerimientos

- [x] Definir el modelo/interfaz de cuenta de ahorro (`SavingsAccount`) soportando tasas diferenciadas.
- [x] Permitir definir la estrategia de aporte:
  - `FIXED`: Monto fijo recurrente mensual.
  - `SURPLUS`: Porcentaje del superávit mensual calculado automáticamente ($\text{Ingresos} - \text{Gastos Fijos Activos}$).

Contrato de Datos (TypeScript Interface)

export type DepositStrategy = 'FIXED' | 'SURPLUS';

export interface SavingsAccount {
  id: string;
  name: string; // ej: "Ahorro Inversión 4%", "Fondo Emergencia 0%"
  balance: number; // Saldo inicial actual (S_0)
  annualRate: number; // 0.04 para 4% anual, 0.00 para cuenta sin rentabilidad
  strategy: DepositStrategy;
  fixedMonthlyDeposit?: number; // Requerido si strategy === 'FIXED'
  surplusAllocationPercent?: number; // 1 - 100% si strategy === 'SURPLUS'
  colorTheme?: string; // Para gráficos y visualización
  createdAt: string;
}


Tarea 3.2: Motor de Cálculo y Pronóstico Temporal

Requerimientos Matemáticos

Dado un horizonte temporal de $n$ meses hacia adelante:

Tasa mensual equivalente:


$$r = \frac{\text{annualRate}}{12}$$


(Si annualRate es $0$, entonces $r = 0$).

Cálculo de saldo futuro iterativo mes a mes:
Para cada mes $k \in [1, n]$:

Se determina el aporte del mes $A_k$ (monto fijo o porcentaje del superávit del mes $k$, considerando gastos expirados).

El rendimiento mensual generado es:


$$I_k = S_{k-1} \cdot r$$

El saldo al cierre del mes es:


$$S_k = S_{k-1} + A_k + I_k$$

Totalizadores requeridos al mes objetivo:

Saldo Total Final: $S_n$.

Capital Aportado de tu Bolsillo: $S_0 + \sum_{k=1}^n A_k$.

Interés / Rendimiento Acumulado: $\sum_{k=1}^n I_k$.

Implementación del Helper

export interface MonthProjectionPoint {
  monthIndex: number; // 1, 2, ..., n
  monthLabel: string; // ej. "Dic 2026", "Ene 2027"
  deposit: number;
  interestEarned: number;
  totalBalance: number;
  cumulativeDeposited: number;
  cumulativeInterest: number;
}

export interface ForecastResponse {
  monthsAhead: number;
  targetMonthLabel: string;
  finalBalance: number;
  totalDeposited: number;
  totalInterest: number;
  points: MonthProjectionPoint[];
}

export function calculateForecast(
  account: SavingsAccount,
  monthsAhead: number,
  monthlySurplusList: number[], // Array con el flujo libre proyectado mes a mes
  startMonthDate: Date = new Date()
): ForecastResponse {
  const r = account.annualRate / 12;
  let currentBalance = account.balance;
  let totalDeposited = account.balance;
  let totalInterest = 0;
  const points: MonthProjectionPoint[] = [];

  for (let k = 1; k <= monthsAhead; k++) {
    // 1. Determinar aporte de este mes
    let deposit = 0;
    if (account.strategy === 'FIXED') {
      deposit = account.fixedMonthlyDeposit || 0;
    } else {
      const surplus = monthlySurplusList[k - 1] ?? 0;
      const share = (account.surplusAllocationPercent ?? 100) / 100;
      deposit = Math.max(0, surplus * share);
    }

    // 2. Interés devengado
    const interest = currentBalance * r;

    // 3. Cierre de mes
    currentBalance += deposit + interest;
    totalDeposited += deposit;
    totalInterest += interest;

    // Formatear etiqueta de mes
    const pointDate = new Date(startMonthDate);
    pointDate.setMonth(pointDate.getMonth() + k);
    const monthLabel = pointDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

    points.push({
      monthIndex: k,
      monthLabel,
      deposit: Math.round(deposit),
      interestEarned: Math.round(interest),
      totalBalance: Math.round(currentBalance),
      cumulativeDeposited: Math.round(totalDeposited),
      cumulativeInterest: Math.round(totalInterest),
    });
  }

  return {
    monthsAhead,
    targetMonthLabel: points[points.length - 1]?.monthLabel ?? '',
    finalBalance: Math.round(currentBalance),
    totalDeposited: Math.round(totalDeposited),
    totalInterest: Math.round(totalInterest),
    points,
  };
}


### Tarea 3.3: Interfaz de Usuario y Controles del Pronóstico

Componentes de UI a Crear:

- [x] Barra de Selección de Cuenta:
  - Selector de pestañas: `[ Cuenta Rentable (4% Anual) ]` | `[ Cuenta Ahorro (0% Sin Interés) ]` | `[ Consolidado Total ]`.
- [x] Controles de Proyección Temporal:
  - Selector de fecha / Slider interactivo de meses hacia adelante (ej. de 1 a 60 meses).
  - Botones rápidos: `[ 6 Meses ]`, `[ 1 Año ]`, `[ Fin de 2027 ]`, `[ 3 Años ]`.
- [x] Cards de Resumen de Proyección:
  - Tarjeta 1: Saldo Estimado Total en la fecha seleccionada.
  - Tarjeta 2: Total de dinero puesto por ti (Aportes propios).
  - Tarjeta 3 (Solo visible si $i > 0$): Ganancia generada por intereses (destacada en color verde con badge "+4% anual").
- [x] Gráfico de Evolución Temporal:
  - Si la cuenta tiene rentabilidad ($i > 0$): Gráfico de área apilada (Stacked Area) que separe la capa de Aporte Propio de la capa de Interés Compuesto.
  - Si la cuenta no tiene rentabilidad ($i = 0$): Línea simple de acumulación lineal.

Criterios de Aceptación (Definición de Terminado)

El usuario puede crear o editar una cuenta de ahorro especificando si rinde $4\%$ o $0\%$ anual.

Al seleccionar un mes futuro (ej. Noviembre 2027), el sistema calcula el valor correcto en ambas cuentas.

En la cuenta de 0% de interés, la métrica de interés ganado no debe mostrarse o debe ser explícitamente $\$0$.

Si un gasto temporal o préstamo finaliza (ej. Préstamo Santander en Octubre 2028), el motor de pronóstico debe aumentar automáticamente el superávit disponible para los meses posteriores.

---

## Fase 4: Dashboard General, Pulido y Exportación

**Objetivo:** Unificar la experiencia, dashboards consolidados y reportería.

### Tarea 4.1: Dashboard Principal (Resumen Ejecutivo)
- [x] Saldo consolidado (Patrimonio neto = Cuentas + Ahorro - Deudas).
- [x] Gráfico de distribución de gastos por categoría (educación, suscripciones, transporte, etc.).
- [x] Flujo de caja libre mensual estimado.

### Tarea 4.2: Exportación y Respaldos
- [x] Función para exportar el mes o el pronóstico a formato Excel / CSV.

### Tarea 4.3: Sección de consejos de finanzas
- [x] Crear una sección de consejos de finanzas
- [x] Agregar consejos de finanzas

### Tarea 4.4: Sección de perfil para modificar contraseña, nombre y correo electrónico
- [x] Crear una sección de perfil para modificar contraseña, nombre y correo electrónico
- [x] Agregar la opción de cerrar sesión

