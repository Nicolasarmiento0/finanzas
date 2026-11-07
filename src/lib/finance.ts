import { Account, CreateAccountInput, RecurringItem, VariableExpense } from './api';

const MONTH_NAMES_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTH_NAMES_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

/**
 * Obtiene el periodo actual en formato YYYY-MM
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Normaliza una fecha ISO (YYYY-MM-DD o YYYY-MM) a formato YYYY-MM
 */
export function toYearMonth(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  return null;
}

/**
 * Desplaza un periodo YYYY-MM en N meses hacia adelante o atrás
 */
export function shiftPeriod(period: string, deltaMonths: number): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return getCurrentPeriod();
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Calcula la cantidad de meses entre dos periodos YYYY-MM
 */
export function diffPeriodsInMonths(fromPeriod: string, toPeriod: string): number {
  const [y1, m1] = fromPeriod.split('-').map(Number);
  const [y2, m2] = toPeriod.split('-').map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 12;
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

/**
 * Etiquetas legibles para categorías de gastos
 */
export const CATEGORY_LABELS: Record<string, string> = {
  educacion: 'Educación & Cursos',
  vivienda: 'Vivienda & Arriendo',
  transporte: 'Transporte & Vehículo',
  alimentacion: 'Alimentación & Supermercado',
  salud: 'Salud & Seguros',
  suscripciones: 'Suscripciones & Apps',
  prestamo: 'Préstamos & Créditos',
  servicios: 'Servicios Básicos',
  entretenimiento: 'Entretenimiento',
  fijo: 'Gastos Fijos Generales',
  general: 'Otros / General',
};

/**
 * Paleta semántica fija de alto contraste y diseño Apple/Tesla para categorías
 */
export const CATEGORY_COLORS: Record<string, string> = {
  educacion: '#38BDF8',       // Azul Eléctrico
  vivienda: '#A855F7',        // Púrpura Violeta
  transporte: '#F59E0B',      // Ámbar Dorado
  alimentacion: '#10B981',    // Verde Esmeralda
  salud: '#F43F5E',           // Rojo Coral
  suscripciones: '#818CF8',   // Índigo Neón
  prestamo: '#FB923C',        // Naranja Intenso
  servicios: '#06B6D4',       // Cian Aqua
  entretenimiento: '#EC4899', // Rosa Fucsia
  fijo: '#2DD4BF',            // Menta Turquesa
  general: '#94A3B8',         // Gris Plata Platino
};

export const FALLBACK_CATEGORY_PALETTE = [
  '#38BDF8',
  '#A855F7',
  '#F59E0B',
  '#10B981',
  '#F43F5E',
  '#818CF8',
  '#FB923C',
  '#06B6D4',
  '#EC4899',
  '#2DD4BF',
  '#94A3B8',
];

export function getCategoryLabel(categoryKey: string): string {
  const clean = (categoryKey || 'general').trim().toLowerCase();
  if (CATEGORY_LABELS[clean]) return CATEGORY_LABELS[clean];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function getCategoryColor(categoryKey: string, fallbackIdx = 0): string {
  const clean = (categoryKey || '').trim().toLowerCase();
  if (CATEGORY_COLORS[clean]) {
    return CATEGORY_COLORS[clean];
  }
  if (clean.includes('educ') || clean.includes('colegio') || clean.includes('univers')) return '#38BDF8';
  if (clean.includes('viv') || clean.includes('arriend') || clean.includes('depa')) return '#A855F7';
  if (clean.includes('transp') || clean.includes('auto') || clean.includes('vehic') || clean.includes('bencina') || clean.includes('tag')) return '#F59E0B';
  if (clean.includes('alim') || clean.includes('super') || clean.includes('comida')) return '#10B981';
  if (clean.includes('salud') || clean.includes('medic') || clean.includes('segur') || clean.includes('isapre') || clean.includes('fonasa')) return '#F43F5E';
  if (clean.includes('suscrip') || clean.includes('app') || clean.includes('stream') || clean.includes('spotify') || clean.includes('netflix') || clean.includes('apple')) return '#818CF8';
  if (clean.includes('prest') || clean.includes('cred') || clean.includes('cuota') || clean.includes('deuda')) return '#FB923C';
  if (clean.includes('serv') || clean.includes('luz') || clean.includes('agua') || clean.includes('gas') || clean.includes('inter')) return '#06B6D4';
  if (clean.includes('entret') || clean.includes('ocio') || clean.includes('cine') || clean.includes('juego')) return '#EC4899';
  if (clean.includes('fijo')) return '#2DD4BF';

  return FALLBACK_CATEGORY_PALETTE[fallbackIdx % FALLBACK_CATEGORY_PALETTE.length];
}

/**
 * Formatea un periodo YYYY-MM como "Noviembre 2026"
 */
export function formatPeriodFull(period: string): string {
  const ym = toYearMonth(period);
  if (!ym) return period;
  const [y, m] = ym.split('-').map(Number);
  const monthName = MONTH_NAMES_FULL[(m || 1) - 1] || '';
  return `${monthName} ${y}`;
}

/**
 * Formatea un periodo YYYY-MM como "Abr 2027"
 */
export function formatPeriodShort(period: string | null | undefined): string {
  const ym = toYearMonth(period);
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  const monthName = MONTH_NAMES_SHORT[(m || 1) - 1] || '';
  return `${monthName} ${y}`;
}

/**
 * Tarea 2.1: Regla de vigencia temporal.
 * Determina si un gasto o ingreso recurrente está vigente en el mes `period` (YYYY-MM).
 * Si tiene `end_date` (ej. "2027-04" o "2026-12-31"), se omite automáticamente en meses posteriores.
 */
export function isItemActiveInMonth(item: RecurringItem, period: string): boolean {
  if (!item.is_active) return false;

  const targetYM = toYearMonth(period);
  if (!targetYM) return true;

  const startYM = toYearMonth(item.start_date);
  if (startYM && targetYM < startYM) {
    return false;
  }

  const endYM = toYearMonth(item.end_date);
  if (endYM && targetYM > endYM) {
    return false;
  }

  return true;
}

/**
 * Tarea 2.2: Cálculo dinámico de cupo disponible y alerta de corte de facturación mensual.
 * Cupo Disponible = Cupo Total - Monto Facturado/Utilizado
 */
export interface CreditCardMetrics {
  creditLimit: number;
  baseBalance: number;
  recurringCharges: number;
  usedAmount: number;
  availableCredit: number;
  usagePercent: number;
  billingAlert: {
    billingDay: number | null;
    daysRemaining: number | null;
    label: string;
    isUrgent: boolean;
  };
}

export function calculateCreditCardMetrics(
  card: Account,
  cardRecurringExpenses: RecurringItem[],
  period: string
): CreditCardMetrics {
  const activeExpenses = cardRecurringExpenses.filter(
    (item) => item.type === 'expense' && isItemActiveInMonth(item, period)
  );
  const recurringCharges = activeExpenses.reduce((sum, item) => sum + item.amount, 0);
  const baseBalance = Math.max(0, card.current_balance || 0);
  const usedAmount = baseBalance + recurringCharges;
  const creditLimit = Math.max(0, card.credit_limit || 0);
  const availableCredit = Math.max(0, creditLimit - usedAmount);
  const usagePercent =
    creditLimit > 0 ? Math.min(100, Math.round((usedAmount / creditLimit) * 100)) : 0;

  const billingDay = card.billing_day;
  let daysRemaining: number | null = null;
  let label = 'Sin fecha de corte definida';
  let isUrgent = false;

  if (billingDay && billingDay >= 1 && billingDay <= 31) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let nextCutDate = new Date(now.getFullYear(), now.getMonth(), billingDay);

    if (nextCutDate < today) {
      nextCutDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
    }

    const diffMs = nextCutDate.getTime() - today.getTime();
    daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
    isUrgent = daysRemaining <= 5;

    if (daysRemaining === 0) {
      label = `Corte de facturación HOY (día ${billingDay})`;
    } else if (daysRemaining === 1) {
      label = `Corte mañana (día ${billingDay} de cada mes)`;
    } else {
      label = `Corte día ${billingDay} · Faltan ${daysRemaining} días`;
    }
  }

  return {
    creditLimit,
    baseBalance,
    recurringCharges,
    usedAmount,
    availableCredit,
    usagePercent,
    billingAlert: {
      billingDay,
      daysRemaining,
      label,
      isUrgent,
    },
  };
}

// ============================================================================
// FASE 3: MÓDULO DE CUENTAS DE AHORRO Y MOTOR DE PRONÓSTICO DUAL
// ============================================================================

/**
 * Tarea 3.1: Modelo de Datos y Tipado de Cuentas de Ahorro
 */
export type DepositStrategy = 'FIXED' | 'SURPLUS';

export interface SavingsAccount {
  id: string;
  name: string; // ej: "Ahorro Inversión 4%", "Fondo Emergencia 0%", "Ahorro Brasil"
  balance: number; // Saldo inicial total actual en la cuenta (S_0 = myInitialBalance + partnerInitialBalance)
  annualRate: number; // 0.04 para 4% anual, 0.00 para cuenta sin rentabilidad
  strategy: DepositStrategy;
  fixedMonthlyDeposit?: number; // Tu aporte fijo mensual si strategy === 'FIXED'
  surplusAllocationPercent?: number; // 1 - 100% si strategy === 'SURPLUS'
  isShared?: boolean; // true si es Ahorro en Pareja
  partnerName?: string; // Nombre de la pareja
  myInitialBalance?: number; // Saldo inicial puesto por ti
  partnerInitialBalance?: number; // Saldo inicial puesto por tu pareja
  partnerMonthlyDeposit?: number; // Aporte mensual fijo de tu pareja
  targetAmount?: number; // Meta opcional en CLP
  partnerUserId?: string | null; // ID del usuario pareja vinculado
  creatorName?: string | null; // Nombre del usuario creador si eres el invitado
  isOwner?: boolean; // true si eres el creador titular, false si eres la pareja vinculada
  colorTheme?: string; // Para gráficos y visualización
  createdAt: string;
}

/**
 * Convierte un registro Account (de Cloudflare D1) a la interfaz tipada SavingsAccount
 */
export function accountToSavingsAccount(
  acc: Account,
  currentUserId?: string
): SavingsAccount {
  // Normalizar tasa anual: en D1 se almacena siempre en porcentaje (ej. 4 para 4%, 1 para 1%, 0 para 0%)
  const rawRate = Number(acc.interest_rate_annual || 0);
  const annualRate = Math.max(0, rawRate / 100);
  const strategy: DepositStrategy =
    acc.savings_mode === 'surplus' ? 'SURPLUS' : 'FIXED';
  const surplusPercent =
    acc.credit_limit > 0 && acc.credit_limit <= 100 ? acc.credit_limit : 100;

  const isShared = Boolean(acc.is_shared);
  const totalBalance = acc.current_balance || 0;
  const isInvitedPartner =
    Boolean(
      isShared &&
      acc.partner_user_id &&
      currentUserId &&
      acc.user_id !== currentUserId &&
      acc.partner_user_id === currentUserId
    );

  let myInitial: number;
  let partnerInitial: number;
  let myMonthly: number;
  let partnerMonthly: number;
  let partnerName: string;
  let partnerUserId: string | null;

  if (isInvitedPartner) {
    // Para el usuario invitado, su saldo inicial es partner_initial_balance
    // y el saldo de su pareja (el creador) es la diferencia
    partnerInitial = Math.max(
      0,
      totalBalance - (acc.partner_initial_balance || 0)
    );
    myInitial = Math.max(0, acc.partner_initial_balance || 0);
    myMonthly = Math.max(0, acc.partner_monthly_contribution || 0);
    partnerMonthly = Math.max(0, acc.fixed_contribution || 0);
    partnerName = acc.creator_name || 'Pareja';
    partnerUserId = acc.user_id;
  } else {
    partnerInitial = isShared
      ? Math.max(0, acc.partner_initial_balance || 0)
      : 0;
    myInitial = isShared
      ? Math.max(0, totalBalance - partnerInitial)
      : totalBalance;
    myMonthly = acc.fixed_contribution || 0;
    partnerMonthly = isShared
      ? Math.max(0, acc.partner_monthly_contribution || 0)
      : 0;
    partnerName = acc.partner_name || acc.partner_user_name || 'Pareja';
    partnerUserId = acc.partner_user_id || null;
  }

  const targetAmount = Math.max(0, acc.target_amount || 0);

  return {
    id: acc.id,
    name: acc.name,
    balance: totalBalance,
    annualRate,
    strategy,
    fixedMonthlyDeposit: myMonthly,
    surplusAllocationPercent: surplusPercent,
    isShared,
    partnerName,
    myInitialBalance: myInitial,
    partnerInitialBalance: partnerInitial,
    partnerMonthlyDeposit: partnerMonthly,
    targetAmount,
    partnerUserId,
    creatorName: acc.creator_name || null,
    isOwner: !isInvitedPartner,
    colorTheme: annualRate > 0 ? '#34D399' : '#FFFFFF',
    createdAt: acc.created_at,
  };
}

/**
 * Convierte los datos de creación/edición de una SavingsAccount al payload de D1 Account
 */
export function savingsAccountToAccountInput(input: {
  name: string;
  balance: number;
  annualRatePercent: number; // ej. 4 para 4% o 0 para 0%
  strategy: DepositStrategy;
  fixedMonthlyDeposit?: number;
  surplusAllocationPercent?: number;
  isShared?: boolean;
  partnerName?: string;
  myInitialBalance?: number;
  partnerInitialBalance?: number;
  partnerMonthlyDeposit?: number;
  targetAmount?: number;
  partnerUserId?: string | null;
  isOwner?: boolean;
}): CreateAccountInput {
  const isShared = Boolean(input.isShared);
  const isOwner = input.isOwner !== false;

  let totalBalance: number;
  let partnerInitial: number;
  let fixedContribution: number;
  let partnerMonthly: number;

  if (isShared && !isOwner) {
    // Si quien edita es el invitado, invertimos al guardar para que la base de datos
    // mantenga la consistencia canónica (user_id = titular creador, partner_user_id = invitado)
    const myInitial = Math.max(0, Math.round(input.myInitialBalance || 0));
    const creatorInitial = Math.max(
      0,
      Math.round(input.partnerInitialBalance || 0)
    );
    totalBalance = myInitial + creatorInitial;
    partnerInitial = myInitial;
    fixedContribution = Math.round(input.partnerMonthlyDeposit || 0);
    partnerMonthly = Math.round(input.fixedMonthlyDeposit || 0);
  } else {
    partnerInitial = isShared
      ? Math.max(0, Math.round(input.partnerInitialBalance || 0))
      : 0;
    const myInitial =
      isShared && input.myInitialBalance !== undefined
        ? Math.max(0, Math.round(input.myInitialBalance || 0))
        : Math.max(0, Math.round(input.balance || 0));
    totalBalance = isShared
      ? myInitial + partnerInitial
      : Math.round(input.balance || 0);
    fixedContribution = Math.round(input.fixedMonthlyDeposit || 0);
    partnerMonthly = isShared
      ? Math.max(0, Math.round(input.partnerMonthlyDeposit || 0))
      : 0;
  }

  return {
    name: input.name.trim(),
    type: 'savings',
    current_balance: totalBalance,
    interest_rate_annual: Number(input.annualRatePercent || 0),
    savings_mode: input.strategy === 'SURPLUS' ? 'surplus' : 'fixed',
    fixed_contribution: fixedContribution,
    credit_limit: Math.min(
      100,
      Math.max(1, Math.round(input.surplusAllocationPercent ?? 100))
    ),
    is_shared: isShared,
    partner_name: isShared ? (input.partnerName || 'Pareja').trim() : null,
    partner_initial_balance: partnerInitial,
    partner_monthly_contribution: partnerMonthly,
    target_amount: Math.max(0, Math.round(input.targetAmount || 0)),
    partner_user_id: isShared ? input.partnerUserId?.trim() || null : null,
  };
}

/**
 * Tarea 3.2: Motor de Cálculo y Pronóstico Temporal (Individual y en Pareja)
 */
export interface MonthProjectionPoint {
  monthIndex: number; // 1, 2, ..., n
  monthLabel: string; // ej. "Dic 2026", "Ene 2027"
  period: string; // YYYY-MM
  myDeposit: number;
  partnerDeposit: number;
  deposit: number;
  interestEarned: number;
  totalBalance: number;
  myCumulativeDeposited: number;
  partnerCumulativeDeposited: number;
  cumulativeDeposited: number;
  cumulativeInterest: number;
}

export interface ForecastResponse {
  monthsAhead: number;
  targetMonthLabel: string;
  finalBalance: number;
  myTotalDeposited: number;
  partnerTotalDeposited: number;
  totalDeposited: number;
  totalInterest: number;
  targetAmount: number;
  targetReachedMonthLabel: string | null;
  monthsToReachTarget: number | null;
  points: MonthProjectionPoint[];
}

/**
 * Construye el arreglo de superávit mensual proyectado para los próximos `monthsAhead` meses,
 * aplicando automáticamente la regla de vigencia temporal (los gastos o préstamos que expiran
 * en el camino liberan flujo de caja automáticamente para los meses siguientes).
 */
export function buildMonthlySurplusList(
  recurringItems: RecurringItem[],
  basePeriod: string,
  monthsAhead: number
): number[] {
  const surplusList: number[] = [];

  for (let k = 1; k <= monthsAhead; k++) {
    const targetPeriod = shiftPeriod(basePeriod, k);
    const activeItems = recurringItems.filter((item) =>
      isItemActiveInMonth(item, targetPeriod)
    );
    const monthIncome = activeItems
      .filter((i) => i.type === 'income')
      .reduce((sum, i) => sum + i.amount, 0);
    const monthExpense = activeItems
      .filter((i) => i.type === 'expense')
      .reduce((sum, i) => sum + i.amount, 0);

    surplusList.push(monthIncome - monthExpense);
  }

  return surplusList;
}

/**
 * Identifica qué gastos fijos o préstamos terminan dentro del horizonte de proyección,
 * liberando liquidez adicional para el ahorro por superávit.
 */
export function getExpiringExpensesInHorizon(
  recurringItems: RecurringItem[],
  basePeriod: string,
  monthsAhead: number
): Array<{ title: string; amount: number; endPeriod: string; endLabel: string }> {
  const horizonEndPeriod = shiftPeriod(basePeriod, monthsAhead);
  const results: Array<{
    title: string;
    amount: number;
    endPeriod: string;
    endLabel: string;
  }> = [];

  for (const item of recurringItems) {
    if (!item.is_active || item.type !== 'expense' || !item.end_date) continue;
    const endYM = toYearMonth(item.end_date);
    if (!endYM) continue;

    if (endYM >= basePeriod && endYM < horizonEndPeriod) {
      results.push({
        title: item.title,
        amount: item.amount,
        endPeriod: endYM,
        endLabel: formatPeriodShort(endYM),
      });
    }
  }

  return results.sort((a, b) => a.endPeriod.localeCompare(b.endPeriod));
}

/**
 * Calcula la proyección mes a mes para una cuenta de ahorro (Individual o en Pareja, Rentable o 0%)
 */
export function calculateForecast(
  account: SavingsAccount,
  monthsAhead: number,
  monthlySurplusList: number[], // Array con el flujo libre proyectado mes a mes
  startMonthDate: Date = new Date(),
  options?: { applyTenPercentSurplusRule?: boolean }
): ForecastResponse {
  const r = account.annualRate / 12;
  const isShared = Boolean(account.isShared);
  const partnerInitial = isShared ? Math.max(0, account.partnerInitialBalance || 0) : 0;
  const myInitial = isShared
    ? Math.max(0, account.myInitialBalance ?? account.balance - partnerInitial)
    : account.balance;

  let currentBalance = myInitial + partnerInitial;
  let myTotalDeposited = myInitial;
  let partnerTotalDeposited = partnerInitial;
  let totalDeposited = currentBalance;
  let totalInterest = 0;
  const points: MonthProjectionPoint[] = [];

  const baseYear = startMonthDate.getFullYear();
  const baseMonth = startMonthDate.getMonth() + 1;
  const basePeriod = `${baseYear}-${String(baseMonth).padStart(2, '0')}`;

  const targetAmount = Math.max(0, account.targetAmount || 0);
  let targetReachedMonthLabel: string | null =
    targetAmount > 0 && currentBalance >= targetAmount ? 'Meta ya alcanzada' : null;
  let monthsToReachTarget: number | null =
    targetAmount > 0 && currentBalance >= targetAmount ? 0 : null;

  for (let k = 1; k <= monthsAhead; k++) {
    const surplus = monthlySurplusList[k - 1] ?? 0;

    // 1. Determinar tu aporte de este mes
    let myDeposit = 0;
    if (account.strategy === 'FIXED') {
      myDeposit = account.fixedMonthlyDeposit || 0;
    } else {
      const share = (account.surplusAllocationPercent ?? 100) / 100;
      myDeposit = Math.max(0, surplus * share);
    }

    // Regla inteligente: Aporte adicional del 10% del remanente libre del checklist
    if (options?.applyTenPercentSurplusRule && surplus > 0) {
      myDeposit += Math.round(surplus * 0.10);
    }

    // 2. Determinar aporte de tu pareja en este mes (si es en pareja)
    const partnerDeposit = isShared ? Math.max(0, account.partnerMonthlyDeposit || 0) : 0;
    const deposit = myDeposit + partnerDeposit;

    // 3. Interés devengado: I_k = S_{k-1} * r
    const interest = currentBalance * r;

    // 4. Cierre de mes: S_k = S_{k-1} + A_k + I_k
    currentBalance += deposit + interest;
    myTotalDeposited += myDeposit;
    partnerTotalDeposited += partnerDeposit;
    totalDeposited += deposit;
    totalInterest += interest;

    // Formatear etiqueta de mes
    const pointPeriod = shiftPeriod(basePeriod, k);
    const monthLabel = formatPeriodShort(pointPeriod);

    if (
      targetAmount > 0 &&
      targetReachedMonthLabel === null &&
      currentBalance >= targetAmount
    ) {
      targetReachedMonthLabel = monthLabel;
      monthsToReachTarget = k;
    }

    points.push({
      monthIndex: k,
      monthLabel,
      period: pointPeriod,
      myDeposit: Math.round(myDeposit),
      partnerDeposit: Math.round(partnerDeposit),
      deposit: Math.round(deposit),
      interestEarned: Math.round(interest),
      totalBalance: Math.round(currentBalance),
      myCumulativeDeposited: Math.round(myTotalDeposited),
      partnerCumulativeDeposited: Math.round(partnerTotalDeposited),
      cumulativeDeposited: Math.round(totalDeposited),
      cumulativeInterest: Math.round(totalInterest),
    });
  }

  // Si tiene meta pero aún no se alcanza en `monthsAhead`, estimar hasta 240 meses adelante
  if (targetAmount > 0 && targetReachedMonthLabel === null) {
    let simBalance = currentBalance;
    const lastKnownSurplus =
      monthlySurplusList[monthlySurplusList.length - 1] ?? 0;
    for (let k = monthsAhead + 1; k <= 240; k++) {
      let myDep =
        account.strategy === 'FIXED'
          ? account.fixedMonthlyDeposit || 0
          : Math.max(
              0,
              lastKnownSurplus * ((account.surplusAllocationPercent ?? 100) / 100)
            );
      if (options?.applyTenPercentSurplusRule && lastKnownSurplus > 0) {
        myDep += Math.round(lastKnownSurplus * 0.10);
      }
      const partnerDep = isShared ? Math.max(0, account.partnerMonthlyDeposit || 0) : 0;
      const interest = simBalance * r;
      if (myDep + partnerDep + interest <= 0) break;
      simBalance += myDep + partnerDep + interest;
      if (simBalance >= targetAmount) {
        const reachPeriod = shiftPeriod(basePeriod, k);
        targetReachedMonthLabel = formatPeriodShort(reachPeriod);
        monthsToReachTarget = k;
        break;
      }
    }
  }

  return {
    monthsAhead,
    targetMonthLabel: points[points.length - 1]?.monthLabel ?? '',
    finalBalance: Math.round(currentBalance),
    myTotalDeposited: Math.round(myTotalDeposited),
    partnerTotalDeposited: Math.round(partnerTotalDeposited),
    totalDeposited: Math.round(totalDeposited),
    totalInterest: Math.round(totalInterest),
    targetAmount,
    targetReachedMonthLabel,
    monthsToReachTarget,
    points,
  };
}

/**
 * Calcula el pronóstico consolidado sumando múltiples cuentas de ahorro
 */
export function calculateConsolidatedForecast(
  accounts: SavingsAccount[],
  monthsAhead: number,
  monthlySurplusList: number[],
  startMonthDate: Date = new Date(),
  options?: { applyTenPercentSurplusRule?: boolean }
): ForecastResponse {
  if (accounts.length === 0) {
    return {
      monthsAhead,
      targetMonthLabel: '',
      finalBalance: 0,
      myTotalDeposited: 0,
      partnerTotalDeposited: 0,
      totalDeposited: 0,
      totalInterest: 0,
      targetAmount: 0,
      targetReachedMonthLabel: null,
      monthsToReachTarget: null,
      points: [],
    };
  }

  const individualForecasts = accounts.map((acc) =>
    calculateForecast(acc, monthsAhead, monthlySurplusList, startMonthDate, options)
  );

  const combinedPoints: MonthProjectionPoint[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const basePoint = individualForecasts[0].points[i];
    if (!basePoint) continue;

    let myDeposit = 0;
    let partnerDeposit = 0;
    let deposit = 0;
    let interestEarned = 0;
    let totalBalance = 0;
    let myCumulativeDeposited = 0;
    let partnerCumulativeDeposited = 0;
    let cumulativeDeposited = 0;
    let cumulativeInterest = 0;

    for (const f of individualForecasts) {
      const p = f.points[i];
      if (!p) continue;
      myDeposit += p.myDeposit;
      partnerDeposit += p.partnerDeposit;
      deposit += p.deposit;
      interestEarned += p.interestEarned;
      totalBalance += p.totalBalance;
      myCumulativeDeposited += p.myCumulativeDeposited;
      partnerCumulativeDeposited += p.partnerCumulativeDeposited;
      cumulativeDeposited += p.cumulativeDeposited;
      cumulativeInterest += p.cumulativeInterest;
    }

    combinedPoints.push({
      monthIndex: basePoint.monthIndex,
      monthLabel: basePoint.monthLabel,
      period: basePoint.period,
      myDeposit,
      partnerDeposit,
      deposit,
      interestEarned,
      totalBalance,
      myCumulativeDeposited,
      partnerCumulativeDeposited,
      cumulativeDeposited,
      cumulativeInterest,
    });
  }

  const last = combinedPoints[combinedPoints.length - 1];
  return {
    monthsAhead,
    targetMonthLabel: last?.monthLabel ?? '',
    finalBalance: last?.totalBalance ?? 0,
    myTotalDeposited: last?.myCumulativeDeposited ?? 0,
    partnerTotalDeposited: last?.partnerCumulativeDeposited ?? 0,
    totalDeposited: last?.cumulativeDeposited ?? 0,
    totalInterest: last?.cumulativeInterest ?? 0,
    targetAmount: 0,
    targetReachedMonthLabel: null,
    monthsToReachTarget: null,
    points: combinedPoints,
  };
}

/**
 * Tarea 4.1+: Proyección Temporal del Patrimonio Neto y Liquidez Consolidada.
 * Simula la acumulación mensual de superávit libre (Ingresos - Gastos), aportes e intereses de ahorro,
 * y deudas activas mes a mes a partir del periodo actual base (basePeriod) hasta el mes seleccionado (targetPeriod).
 */
export interface ProjectedPosition {
  checkingBalance: number;
  savingsBalance: number;
  creditCardsDebt: number;
  loansDebt: number;
  fixedLoansDebt: number;
  variableLoansDebt: number;
  totalDebt: number;
  netWorth: number;
  baseNetWorth: number;
  baseChecking: number;
  baseSavings: number;
  baseTotalDebt: number;
  diffFromCurrentNetWorth: number;
  diffFromCurrentChecking: number;
  diffFromCurrentSavings: number;
  deltaMonths: number;
}

export const DEBT_TITLE_KEYWORDS = [
  'prestamo',
  'préstamo',
  'crédito',
  'credito',
  'cuota',
  'hipotecario',
  'automotriz',
  'vehicular',
  'cae',
  'financiamiento',
  'deuda',
];

export function isNonCardDebtItem(
  item: {
    category?: string;
    title?: string;
    account_id?: string | null;
  },
  creditCardAccountIds: Set<string>,
  loanAccountIds: Set<string>
): boolean {
  // Si está vinculado a una tarjeta de crédito, ya se computa en targetCreditCardsDebt
  if (item.account_id && creditCardAccountIds.has(item.account_id)) {
    return false;
  }

  // Si está vinculado a una cuenta de tipo préstamo
  if (item.account_id && loanAccountIds.has(item.account_id)) {
    return true;
  }

  // Si su categoría es préstamo
  const cat = (item.category || '').toLowerCase().trim();
  if (cat === 'prestamo') {
    return true;
  }

  // Si el título contiene palabras clave de deuda, cuota o crédito
  const title = (item.title || '').toLowerCase();
  if (DEBT_TITLE_KEYWORDS.some((kw) => title.includes(kw))) {
    return true;
  }

  return false;
}

export function calculateProjectedPosition(
  basePeriod: string,
  targetPeriod: string,
  accounts: Account[],
  recurringItems: RecurringItem[],
  options?: {
    applyTenPercentSurplusRule?: boolean;
    variableExpenses?: VariableExpense[];
  }
): ProjectedPosition {
  const checkingAccounts = accounts.filter((a) => a.type === 'checking');
  const personalSavingsAccounts = accounts.filter(
    (a) => a.type === 'savings' && !a.is_shared
  );
  const sharedSavingsAccounts = accounts.filter(
    (a) => a.type === 'savings' && Boolean(a.is_shared)
  );
  const creditCardAccounts = accounts.filter((a) => a.type === 'credit_card');
  const loanAccounts = accounts.filter((a) => a.type === 'loan');

  // Saldos base actuales hoy (basePeriod)
  const baseChecking = checkingAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  );
  let currentChecking = baseChecking;

  // Estado mutable de cuentas de ahorro personales
  const savingsState = personalSavingsAccounts.map((acc) => {
    const rawRate = Number(acc.interest_rate_annual || 0);
    const annualRate = Math.max(0, rawRate / 100);
    const strategy = acc.savings_mode === 'surplus' ? 'SURPLUS' : 'FIXED';
    const surplusPercent =
      acc.credit_limit > 0 && acc.credit_limit <= 100 ? acc.credit_limit : 100;
    return {
      id: acc.id,
      balance: acc.current_balance || 0,
      annualRate,
      strategy,
      fixedDeposit: acc.fixed_contribution || 0,
      surplusPercent,
    };
  });

  const baseSavings = savingsState.reduce((sum, s) => sum + s.balance, 0);

  // Aportes de ahorro en pareja que salen del flujo de caja cada mes
  const sharedSavingsMonthly = sharedSavingsAccounts.reduce(
    (sum, a) => sum + (a.fixed_contribution || 0),
    0
  );

  // Calcular diferencia en meses entre basePeriod y targetPeriod
  const [by, bm] = basePeriod.split('-').map(Number);
  const [ty, tm] = targetPeriod.split('-').map(Number);
  const deltaMonths = (ty * 12 + tm) - (by * 12 + bm);

  if (deltaMonths > 0) {
    // Proyección hacia el futuro de las cuentas de ahorro con sus aportes e intereses
    for (let step = 1; step <= deltaMonths; step++) {
      const monthPeriod = shiftPeriod(basePeriod, step);
      const monthItems = recurringItems.filter((item) =>
        isItemActiveInMonth(item, monthPeriod)
      );
      const mIncome = monthItems
        .filter((i) => i.type === 'income')
        .reduce((sum, i) => sum + i.amount, 0);
      const mExpense = monthItems
        .filter((i) => i.type === 'expense')
        .reduce((sum, i) => sum + i.amount, 0);
      const mSurplus = mIncome - mExpense;

      for (const s of savingsState) {
        let deposit = 0;
        if (s.strategy === 'FIXED') {
          deposit = s.fixedDeposit;
        } else if (s.strategy === 'SURPLUS') {
          deposit =
            mSurplus > 0
              ? Math.round(mSurplus * (s.surplusPercent / 100))
              : 0;
        }
        if (options?.applyTenPercentSurplusRule && mSurplus > 0) {
          deposit += Math.round(mSurplus * 0.10);
        }
        const monthlyRate = s.annualRate / 12;
        const interest = Math.round(s.balance * monthlyRate);
        s.balance += deposit + interest;
      }
    }
  } else if (deltaMonths < 0) {
    // Retrospectiva hacia el pasado de las cuentas de ahorro
    for (let step = 0; step > deltaMonths; step--) {
      const monthPeriod = shiftPeriod(basePeriod, step);
      const monthItems = recurringItems.filter((item) =>
        isItemActiveInMonth(item, monthPeriod)
      );
      const mIncome = monthItems
        .filter((i) => i.type === 'income')
        .reduce((sum, i) => sum + i.amount, 0);
      const mExpense = monthItems
        .filter((i) => i.type === 'expense')
        .reduce((sum, i) => sum + i.amount, 0);
      const mSurplus = mIncome - mExpense;

      for (const s of savingsState) {
        let deposit = 0;
        if (s.strategy === 'FIXED') {
          deposit = s.fixedDeposit;
        } else if (s.strategy === 'SURPLUS') {
          deposit =
            mSurplus > 0
              ? Math.round(mSurplus * (s.surplusPercent / 100))
              : 0;
        }
        if (options?.applyTenPercentSurplusRule && mSurplus > 0) {
          deposit += Math.round(mSurplus * 0.10);
        }
        const monthlyRate = s.annualRate / 12;
        const interest = Math.round(
          (s.balance / (1 + monthlyRate)) * monthlyRate
        );
        s.balance = Math.max(0, s.balance - deposit - interest);
      }
    }
  }

  const creditCardAccountIds = new Set(creditCardAccounts.map((c) => c.id));
  const loanAccountIds = new Set(loanAccounts.map((l) => l.id));

  // 1. Deuda de Tarjetas de Crédito: saldo base + cargos activos en targetPeriod
  const targetCreditCardsDebt = creditCardAccounts.reduce((sum, card) => {
    const cardCharges = recurringItems
      .filter(
        (item) =>
          item.account_id === card.id &&
          item.type === 'expense' &&
          isItemActiveInMonth(item, targetPeriod)
      )
      .reduce((s, item) => s + item.amount, 0);
    return sum + (card.current_balance || 0) + cardCharges;
  }, 0);

  // 2. Deuda de Cuentas tipo Préstamo
  const targetLoansDebt = loanAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  );

  // 3. Deuda de Gastos Fijos de Préstamo / Crédito fuera de tarjetas
  const targetFixedLoansDebt = recurringItems
    .filter(
      (item) =>
        item.type === 'expense' &&
        isItemActiveInMonth(item, targetPeriod) &&
        isNonCardDebtItem(item, creditCardAccountIds, loanAccountIds)
    )
    .reduce((s, item) => s + item.amount, 0);

  // 4. Deuda en Gastos Variables del periodo (ej. categoría 'prestamo' o título de crédito)
  const targetVariableDebts = (options?.variableExpenses || [])
    .filter((exp) => {
      const expPeriod = exp.period || exp.date?.slice(0, 7);
      if (expPeriod !== targetPeriod) return false;
      const cat = (exp.category || '').toLowerCase().trim();
      const title = (exp.title || '').toLowerCase();
      return (
        cat === 'prestamo' ||
        DEBT_TITLE_KEYWORDS.some((kw) => title.includes(kw))
      );
    })
    .reduce((s, exp) => s + exp.amount, 0);

  const targetTotalDebt =
    targetCreditCardsDebt + targetLoansDebt + targetFixedLoansDebt + targetVariableDebts;

  const totalSavings = savingsState.reduce((sum, s) => sum + s.balance, 0);
  const netWorth = currentChecking + totalSavings - targetTotalDebt;

  // Cálculo en basePeriod para diffFromCurrentNetWorth
  const baseCreditCardsDebt = creditCardAccounts.reduce((sum, card) => {
    const cardCharges = recurringItems
      .filter(
        (item) =>
          item.account_id === card.id &&
          item.type === 'expense' &&
          isItemActiveInMonth(item, basePeriod)
      )
      .reduce((s, item) => s + item.amount, 0);
    return sum + (card.current_balance || 0) + cardCharges;
  }, 0);

  const baseFixedLoansDebt = recurringItems
    .filter(
      (item) =>
        item.type === 'expense' &&
        isItemActiveInMonth(item, basePeriod) &&
        isNonCardDebtItem(item, creditCardAccountIds, loanAccountIds)
    )
    .reduce((s, item) => s + item.amount, 0);

  const baseVariableDebts = (options?.variableExpenses || [])
    .filter((exp) => {
      const expPeriod = exp.period || exp.date?.slice(0, 7);
      if (expPeriod !== basePeriod) return false;
      const cat = (exp.category || '').toLowerCase().trim();
      const title = (exp.title || '').toLowerCase();
      return (
        cat === 'prestamo' ||
        DEBT_TITLE_KEYWORDS.some((kw) => title.includes(kw))
      );
    })
    .reduce((s, exp) => s + exp.amount, 0);

  const baseTotalDebt =
    baseCreditCardsDebt + targetLoansDebt + baseFixedLoansDebt + baseVariableDebts;
  const baseNetWorth = baseChecking + baseSavings - baseTotalDebt;

  return {
    checkingBalance: currentChecking,
    savingsBalance: totalSavings,
    creditCardsDebt: targetCreditCardsDebt,
    loansDebt: targetLoansDebt,
    fixedLoansDebt: targetFixedLoansDebt,
    variableLoansDebt: targetVariableDebts,
    totalDebt: targetTotalDebt,
    netWorth,
    baseNetWorth,
    baseChecking,
    baseSavings,
    baseTotalDebt,
    diffFromCurrentNetWorth: netWorth - baseNetWorth,
    diffFromCurrentChecking: currentChecking - baseChecking,
    diffFromCurrentSavings: totalSavings - baseSavings,
    deltaMonths,
  };
}
