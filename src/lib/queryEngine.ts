import { Account, MonthlyPayment, RecurringItem, VariableExpense } from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import {
  accountToSavingsAccount,
  buildMonthlySurplusList,
  calculateConsolidatedForecast,
  diffPeriodsInMonths,
  formatPeriodFull,
  getCurrentPeriod,
  getExpiringExpensesInHorizon,
  isItemActiveInMonth,
  shiftPeriod,
  toYearMonth,
} from '@/lib/finance';
import {
  FinancialIntelligenceReport,
  generateFinancialIntelligence,
} from '@/lib/intelligence';

export type QueryIntent =
  | 'greeting_help'
  | 'future_savings_projection'
  | 'goal_target_reach'
  | 'income_cashflow'
  | 'invest_recommendation'
  | 'card_vs_savings'
  | 'safe_to_save'
  | 'what_if_spend'
  | 'survival_health'
  | 'pending_commitments'
  | 'category_audit'
  | 'credit_card_details'
  | 'total_debt_audit'
  | 'subscriptions_audit'
  | 'shared_savings_partner'
  | 'windfall_bonus'
  | 'amount_only'
  | 'fallback';

export interface QueryResultMetric {
  label: string;
  value: string;
  tone?: 'emerald' | 'amber' | 'coral' | 'blue' | 'neutral';
}

export interface QueryEngineResult {
  intent: QueryIntent;
  title: string;
  verdict: string;
  verdictTone: 'emerald' | 'amber' | 'coral' | 'blue' | 'neutral';
  recommendation: string;
  detailedBreakdown: string[];
  metrics?: QueryResultMetric[];
  suggestedFollowUps?: string[];
  actionLabel?: string;
  actionType?: 'simulate_transfer' | 'view_cards' | 'view_fixed' | 'quick_pill';
  actionPayload?: string;
}

export interface QueryContextData {
  accounts: Account[];
  recurringItems: RecurringItem[];
  variableExpenses: VariableExpense[];
  payments?: MonthlyPayment[];
  period?: string;
  report?: FinancialIntelligenceReport;
}

export interface TargetHorizon {
  targetPeriod: string; // Ej: '2027-04'
  targetLabel: string;  // Ej: 'Abril 2027'
  monthsAhead: number;  // Ej: 5
}

const MONTH_NAMES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Normaliza texto eliminando acentos, signos de puntuación y convirtiendo a minúsculas.
 */
export function normalizeQueryText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[¿?¡!,;:()[\]{}"'\\/]/g, ' ') // Quita puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsea horizontes temporales futuros y meses específicos ('en abril', 'diciembre', 'el próximo mes', 'en 6 meses', 'a fin de año').
 */
export function extractTargetHorizonFromQuery(rawText: string, basePeriod: string): TargetHorizon | null {
  const text = normalizeQueryText(rawText);
  const [currY, currM] = basePeriod.split('-').map(Number);
  const currMonthIdx = (currM || 1) - 1;

  // 1. Detección de meses del calendario (ej. "en abril", "para mayo", "abril")
  for (const [mName, mIdx] of Object.entries(MONTH_NAMES)) {
    const regex = new RegExp(`\\b${mName}\\b`, 'i');
    if (regex.test(text)) {
      let targetYear = currY;
      // Si el mes es anterior o igual al mes actual, corresponde al año siguiente
      if (mIdx <= currMonthIdx) {
        targetYear = currY + 1;
      }
      const targetPeriod = `${targetYear}-${String(mIdx + 1).padStart(2, '0')}`;
      const monthsAhead = diffPeriodsInMonths(basePeriod, targetPeriod);
      return {
        targetPeriod,
        targetLabel: `${MONTH_LABELS[mIdx]} ${targetYear}`,
        monthsAhead,
      };
    }
  }

  // 2. Próximo mes / mes que viene
  if (text.includes('proximo mes') || text.includes('mes que viene') || text.includes('siguiente mes')) {
    const targetPeriod = shiftPeriod(basePeriod, 1);
    const [, m] = targetPeriod.split('-').map(Number);
    return {
      targetPeriod,
      targetLabel: `${MONTH_LABELS[m - 1]} ${targetPeriod.slice(0, 4)}`,
      monthsAhead: 1,
    };
  }

  // 3. En X meses (ej. "en 3 meses", "en 6 meses")
  const xMesesMatch = text.match(/\ben\s*(\d+)\s*meses\b/);
  if (xMesesMatch && xMesesMatch[1]) {
    const delta = parseInt(xMesesMatch[1], 10);
    if (delta > 0 && delta <= 60) {
      const targetPeriod = shiftPeriod(basePeriod, delta);
      const [, m] = targetPeriod.split('-').map(Number);
      return {
        targetPeriod,
        targetLabel: `${MONTH_LABELS[m - 1]} ${targetPeriod.slice(0, 4)}`,
        monthsAhead: delta,
      };
    }
  }

  // 4. En un año / en 1 año
  if (text.includes('en un ano') || text.includes('en 1 ano') || text.includes('en un anio')) {
    const targetPeriod = shiftPeriod(basePeriod, 12);
    const [, m] = targetPeriod.split('-').map(Number);
    return {
      targetPeriod,
      targetLabel: `${MONTH_LABELS[m - 1]} ${targetPeriod.slice(0, 4)}`,
      monthsAhead: 12,
    };
  }

  // 5. A fin de año
  if (text.includes('fin de ano') || text.includes('fin de anio') || text.includes('fin de ano')) {
    const targetYear = currMonthIdx >= 11 ? currY + 1 : currY;
    const targetPeriod = `${targetYear}-12`;
    const monthsAhead = diffPeriodsInMonths(basePeriod, targetPeriod);
    return {
      targetPeriod,
      targetLabel: `Diciembre ${targetYear}`,
      monthsAhead,
    };
  }

  return null;
}

/**
 * Parsea montos escritos en jerga chilena ('lucas', 'palos', 'k', 'mil') o en formato numérico ($50.000, 50000).
 */
export function extractAmountFromQuery(rawText: string): number | null {
  const text = normalizeQueryText(rawText);

  // 1. Detectar expresiones coloquiales con "palos" o "millones" (ej. "1.5 palos", "2 palos", "1 millon")
  const palosMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:palo|palos|millon|millones|m\b)/i);
  if (palosMatch && palosMatch[1]) {
    const num = parseFloat(palosMatch[1].replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      return Math.round(num * 1000000);
    }
  }

  // 2. Detectar expresiones coloquiales con "lucas" o "k" o "mil" (ej. "40 lucas", "1.5 lucas", "100k", "50 mil")
  const lucasMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:luca|lucas|k\b|mil\b)/i);
  if (lucasMatch && lucasMatch[1]) {
    const num = parseFloat(lucasMatch[1].replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      return Math.round(num * 1000);
    }
  }

  // 3. Detectar números formateados chilenos (ej. "$45.000", "45.000", "45000")
  const numRegex = /(?:\$)?\b(\d{1,3}(?:\.\d{3})+|\d{4,9})\b/;
  const numMatch = rawText.match(numRegex);
  if (numMatch && numMatch[1]) {
    const cleanedStr = numMatch[1].replace(/\./g, '');
    const parsed = parseInt(cleanedStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // 4. Si es un número simple
  const smallNumMatch = text.match(/\b(\d{2,3})\b/);
  if (smallNumMatch && smallNumMatch[1]) {
    const smallParsed = parseInt(smallNumMatch[1], 10);
    if (!isNaN(smallParsed) && smallParsed >= 100) {
      return smallParsed;
    }
  }

  return null;
}

/**
 * Clasifica la intención de la consulta usando un diccionario ponderado de modismos y finanzas personales.
 */
export function classifyQueryIntent(
  normalized: string,
  amount: number | null,
  horizon: TargetHorizon | null
): QueryIntent {
  // Saludos, bienvenida y ayuda general
  const GREETING_KEYWORDS = [
    'hola',
    'buenas',
    'buen dia',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'hello',
    'hi',
    'hey',
    'que haces',
    'como funciona',
    'ayuda',
    'menu',
    'comandos',
    'quien eres',
    'empezar',
    'inicio',
  ];
  if (
    GREETING_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(kw + ' ') || normalized.endsWith(' ' + kw))
  ) {
    return 'greeting_help';
  }

  // 1. Proyecciones Futuras de Ahorro en Meses Específicos (ej. "¿cuánto podré ahorrar en abril?", "cuánto ahorraré en 6 meses")
  const FUTURE_SAVINGS_KEYWORDS = [
    'cuanto podre ahorrar',
    'cuanto podria ahorrar',
    'cuanto ahorrare',
    'cuanto voy a ahorrar',
    'cuanto podre juntar',
    'cuanto juntare',
    'cuanto podre guardar',
    'cuanto guardare',
    'cuanto tendre ahorrado',
    'proyeccion de ahorro',
    'proyeccion para',
    'ahorrar en',
    'ahorro en',
    'juntar en',
  ];
  if (
    horizon !== null ||
    FUTURE_SAVINGS_KEYWORDS.some((kw) => normalized.includes(kw))
  ) {
    // Si menciona un mes o un horizonte temporal y tiene intención de ahorro
    if (
      normalized.includes('ahorr') ||
      normalized.includes('junt') ||
      normalized.includes('guard') ||
      normalized.includes('proyecc') ||
      normalized.includes('tendre') ||
      normalized.includes('podre') ||
      normalized.includes('podria') ||
      normalized.includes('meta')
    ) {
      if (amount !== null && (normalized.includes('cuando llegare') || normalized.includes('para llegar'))) {
        return 'goal_target_reach';
      }
      return 'future_savings_projection';
    }
  }

  // 2. Metas de ahorro / Horizonte para llegar a un monto (ej. "¿cuándo llegaré a 5 millones?")
  const GOAL_KEYWORDS = [
    'cuando llegare',
    'cuando llego',
    'cuando tendre',
    'cuanto me falta para',
    'en cuanto tiempo llego',
    'para juntar',
    'para llegar a',
    'meta de ahorro',
    'meta para',
  ];
  if (GOAL_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'goal_target_reach';
  }

  // 3. Sueldo, Ingresos y Flujo de Caja Libre
  const INCOME_KEYWORDS = [
    'cuanto gano',
    'cual es mi sueldo',
    'cuanto es mi sueldo',
    'mis ingresos',
    'ingresos totales',
    'total de ingresos',
    'cuanto me queda libre',
    'flujo libre',
    'flujo de caja',
    'margen libre',
    'superavit mensual',
  ];
  if (INCOME_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'income_cashflow';
  }

  // 4. Bono, Aguinaldo o Ingreso Extra (Windfall Engine)
  const WINDFALL_KEYWORDS = [
    'bono',
    'aguinaldo',
    'ingreso extra',
    'plata extra',
    'dinero extra',
    'me llego un bono',
    'recibo un bono',
    'reparto de utilidades',
    'devolucion de impuestos',
  ];
  if (WINDFALL_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'windfall_bonus';
  }

  // 5. Cupo y Detalles de Tarjeta de Crédito
  const CARD_DETAILS_KEYWORDS = [
    'cupo de mi tarjeta',
    'cupo de la tarjeta',
    'cupo disponible',
    'cupo santander',
    'cupo falabella',
    'cupo cmr',
    'limite de credito',
    'cuando corta la tarjeta',
    'fecha de corte',
    'dia de corte',
    'dia de facturacion',
    'cuando factura la tarjeta',
  ];
  if (CARD_DETAILS_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'credit_card_details';
  }

  // 6. Deuda Total Consolidada
  const TOTAL_DEBT_KEYWORDS = [
    'cuanto debo en total',
    'todas mis deudas',
    'deuda total',
    'total deudas',
    'debo en total',
    'sumando todo cuanto debo',
    'mis creditos',
  ];
  if (TOTAL_DEBT_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'total_debt_audit';
  }

  // 7. Auditoría de Suscripciones
  const SUBSCRIPTIONS_KEYWORDS = [
    'cuanto gasto en suscripciones',
    'que suscripciones tengo',
    'mis suscripciones',
    'suscripciones activas',
    'netflix',
    'spotify',
    'apps mensuales',
    'gastos en streaming',
  ];
  if (SUBSCRIPTIONS_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'subscriptions_audit';
  }

  // 8. Ahorro en Pareja / Cuentas Compartidas
  const SHARED_SAVINGS_KEYWORDS = [
    'ahorro en pareja',
    'cuenta compartida',
    'cuanto tenemos ahorrado',
    'cuanto aporta mi pareja',
    'cuanto ha puesto mi pareja',
    'ahorro compartido',
    'ahorros en pareja',
  ];
  if (SHARED_SAVINGS_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'shared_savings_partner';
  }

  // 9. Tarjeta vs Ahorro (Pre-pago de cuotas)
  const CARD_VS_SAVINGS_KEYWORDS = [
    'pagar tarjeta o ahorrar',
    'pago la tarjeta o ahorro',
    'conviene pagar la tarjeta',
    'pagar cuotas o ahorrar',
    'liquidar tarjeta',
    'prepagar cuotas',
    'intereses tarjeta',
    'pagar el minimo',
    'amortizar tarjeta',
    'tarjeta o ahorro',
  ];
  if (CARD_VS_SAVINGS_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'card_vs_savings';
  }

  // 10. Dónde invertir o qué cuenta da más intereses
  const INVEST_KEYWORDS = [
    'donde invertir',
    'en que cuenta invertir',
    'en que cuenta me conviene',
    'cual cuenta da mas interes',
    'donde me conviene meter la plata',
    'que cuenta da mas',
    'mejor cuenta',
    'donde ahorrar',
    'invertir',
    'inversion',
    'rentabilidad',
    'tasa de interes',
    'tasa',
    'dap',
    'deposito a plazo',
    'cuenta de ahorro',
    'consorcio',
    'banco estado',
    'bancoestado',
    'fintual',
    'tenpo',
    'rendimiento',
  ];
  if (INVEST_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'invest_recommendation';
  }

  // 11. Cuánto puedo ahorrar hoy / Ahorro seguro inmediato
  const SAFE_TO_SAVE_KEYWORDS = [
    'cuanto puedo ahorrar hoy',
    'cuanto puedo ahorrar',
    'cuanto me recomiendas ahorrar',
    'cuanto guardo',
    'meter al ahorro',
    'pasar al ahorro',
    'guardar en el ahorro',
    'cuanto puedo transferir',
    'ahorrar de mi saldo',
    'ahorro seguro',
    'dejar para fin de mes',
    'cuanto apartar',
  ];
  if (SAFE_TO_SAVE_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'safe_to_save';
  }

  // 12. Simulación de Compra / Gasto Imprevisto ("What-If Spend")
  const SPEND_KEYWORDS = [
    'puedo gastar',
    'me alcanza para',
    'puedo comprar',
    'comprar',
    'gastar',
    'gasto de',
    'compra de',
    'salir a',
    'cena',
    'asado',
    'carrete',
    'viaje',
    'escapada',
    'zapatillas',
    'gustito',
    'almuerzo',
    'uber',
    'descalzar',
  ];
  if (amount !== null && SPEND_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'what_if_spend';
  }

  // 13. Compromisos, facturación y pagos pendientes
  const COMMITMENTS_KEYWORDS = [
    'que cuentas me faltan pagar',
    'que debo este mes',
    'cuentas pendientes',
    'gastos fijos pendientes',
    'cuanto debo en la tarjeta',
    'cuando vence la tarjeta',
    'cuotas pendientes',
    'deudas del mes',
    'pagos obligatorios',
    'cuentas por pagar',
    'que me falta pagar',
  ];
  if (COMMITMENTS_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'pending_commitments';
  }

  // 14. Salud Financiera y Supervivencia
  const SURVIVAL_KEYWORDS = [
    'como voy',
    'como van mis finanzas',
    'como estan mis finanzas',
    'llego a fin de mes',
    'cuantos meses sobrevivo',
    'fondo de emergencia',
    'score de salud',
    'tengo suficiente plata',
    'estado financiero',
    'resumen financiero',
    'diagnostico',
  ];
  if (SURVIVAL_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'survival_health';
  }

  // 15. Auditoría de Categorías
  const CATEGORY_KEYWORDS = [
    'en que gaste mas',
    'donde se fue la plata',
    'en que se va el dinero',
    'gasto en delivery',
    'delivery vs supermercado',
    'categoria principal',
    'fuga de dinero',
    'mis gastos variables',
  ];
  if (CATEGORY_KEYWORDS.some((kw) => normalized.includes(kw))) {
    return 'category_audit';
  }

  // Solo ingresó un monto sin verbo rector (ej. "$60.000" o "50 lucas")
  if (amount !== null && normalized.replace(/\d+/g, '').trim().length <= 5) {
    return 'amount_only';
  }

  // Fallback para consultas no reconocidas
  return 'fallback';
}

/**
 * Calcula los días restantes en el mes actual a partir del día de hoy.
 */
function getRemainingDaysInCurrentMonth(): { totalDays: number; currentDay: number; remainingDays: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const totalDays = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = Math.max(1, totalDays - currentDay + 1);
  return { totalDays, currentDay, remainingDays };
}

/**
 * Obtiene la liquidez bancaria total en cuentas vista / corrientes (excluye ahorros e inversiones ilíquidas).
 * Refleja los gastos variables del periodo si se proporcionan.
 */
function getCheckingLiquidBalance(
  accounts: Account[],
  variableExpenses?: VariableExpense[],
  period?: string
): number {
  const baseChecking = accounts
    .filter((a) => a.type === 'checking')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0);

  if (!variableExpenses || variableExpenses.length === 0) {
    return baseChecking;
  }
  const currentPeriod = period || new Date().toISOString().slice(0, 7);
  const spentInPeriod = variableExpenses
    .filter((e) => (e.period || e.date?.slice(0, 7)) === currentPeriod)
    .reduce((sum, e) => sum + e.amount, 0);

  return Math.max(0, baseChecking - spentInPeriod);
}

/**
 * Obtiene el total de gastos fijos pendientes de pago para el período.
 */
function getPendingFixedExpenses(
  recurringItems: RecurringItem[],
  period: string,
  payments?: MonthlyPayment[]
): number {
  const paidItemIds = new Set(
    (payments || [])
      .filter((p) => p.target_type === 'recurring_item' && p.period === period && p.is_paid)
      .map((p) => p.target_id)
  );

  return recurringItems
    .filter(
      (item) =>
        item.type === 'expense' &&
        isItemActiveInMonth(item, period) &&
        !paidItemIds.has(item.id)
    )
    .reduce((sum, item) => sum + item.amount, 0);
}

// ==========================================
// SOLVERS DETERMINISTAS POR INTENCIÓN
// ==========================================

/**
 * Responde proyecciones futuras de ahorro (ej. "¿Cuánto podré ahorrar en abril?").
 */
export function solveFutureSavings(
  horizon: TargetHorizon | null,
  context: QueryContextData
): QueryEngineResult {
  const { accounts, recurringItems } = context;
  const basePeriod = context.period || getCurrentPeriod();

  const target =
    horizon || {
      targetPeriod: shiftPeriod(basePeriod, 3),
      targetLabel: formatPeriodFull(shiftPeriod(basePeriod, 3)),
      monthsAhead: 3,
    };

  const { targetPeriod, targetLabel, monthsAhead } = target;

  // 1. Desglose del mes objetivo
  const activeItemsInTarget = recurringItems.filter((i) =>
    isItemActiveInMonth(i, targetPeriod)
  );
  const targetIncome = activeItemsInTarget
    .filter((i) => i.type === 'income')
    .reduce((sum, i) => sum + i.amount, 0);
  const targetExpenses = activeItemsInTarget
    .filter((i) => i.type === 'expense')
    .reduce((sum, i) => sum + i.amount, 0);
  const targetSurplus = Math.max(0, targetIncome - targetExpenses);

  // 2. Capacidad de ahorro de ese mes específico
  const savingsAccounts = accounts.filter((a) => a.type === 'savings');
  const fixedSavingsConfigured = savingsAccounts.reduce(
    (sum, a) => sum + (a.fixed_contribution || 0) + (a.partner_monthly_contribution || 0),
    0
  );
  const tenPercentSurplus = Math.round(targetSurplus * 0.1);
  const monthlySavingsCapacity = fixedSavingsConfigured + tenPercentSurplus;

  // 3. Pronóstico acumulado a esa fecha usando el motor dual
  const typedSavings = savingsAccounts.map((a) => accountToSavingsAccount(a));
  const surplusList = buildMonthlySurplusList(recurringItems, basePeriod, monthsAhead);
  const forecast = calculateConsolidatedForecast(typedSavings, monthsAhead, surplusList);

  // 4. Ver si expira algún crédito o compromiso antes de ese mes
  const expiring = getExpiringExpensesInHorizon(recurringItems, basePeriod, monthsAhead);

  const breakdownLines: string[] = [
    `• Ingresos proyectados para ${targetLabel}: ${formatCLP(targetIncome)}.`,
    `• Gastos fijos vigentes en ese mes: -${formatCLP(targetExpenses)}.`,
    `• Superávit libre mensual proyectado: ${formatCLP(targetSurplus)}.`,
    `• Aporte de ahorro mensual estimado: ${formatCLP(monthlySavingsCapacity)} (Aporte fijo: ${formatCLP(fixedSavingsConfigured)} + Regla 10% superávit: ${formatCLP(tenPercentSurplus)}).`,
    `• Saldo total acumulado proyectado a esa fecha: ${formatCLP(forecast.finalBalance)} (incluye ${formatCLP(forecast.totalInterest)} de intereses compuestos).`,
  ];

  if (expiring.length > 0) {
    const expText = expiring
      .map((e) => `${e.title} (${formatCLP(e.amount)}/mes en ${e.endLabel})`)
      .join(', ');
    breakdownLines.push(`• 🎉 ¡Liberación de liquidez!: Antes de esa fecha terminas de pagar: ${expText}.`);
  }

  return {
    intent: 'future_savings_projection',
    title: `Proyección de Ahorro: ${targetLabel}`,
    verdict: `En ${targetLabel} podrás ahorrar aprox. ${formatCLP(monthlySavingsCapacity)}/mes`,
    verdictTone: 'emerald',
    recommendation: `Para **${targetLabel}** (en ${monthsAhead} meses), tu capacidad de ahorro proyectada será de **${formatCLP(monthlySavingsCapacity)} ese mes**, alcanzando un saldo acumulado estimado de **${formatCLP(forecast.finalBalance)}** en tus cuentas de ahorro.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: `Ahorro ${targetLabel}`, value: formatCLP(monthlySavingsCapacity), tone: 'emerald' },
      { label: 'Saldo Acumulado', value: formatCLP(forecast.finalBalance), tone: 'emerald' },
      { label: 'Horizonte', value: `${monthsAhead} meses`, tone: 'neutral' },
    ],
    suggestedFollowUps: [
      '¿En qué cuenta me recomiendas invertir?',
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿Cuál es mi sueldo y flujo de caja libre?',
    ],
  };
}

/**
 * Responde en cuántos meses llegará a una meta de ahorro (ej. "¿Cuándo llegaré a 5 millones?").
 */
export function solveGoalTargetReach(
  targetAmount: number | null,
  context: QueryContextData
): QueryEngineResult {
  const { accounts, recurringItems } = context;
  const basePeriod = context.period || getCurrentPeriod();

  const savingsAccounts = accounts.filter((a) => a.type === 'savings');
  const currentTotalSavings = savingsAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

  // Si no especificó monto, usar meta configurada en cuentas o 5 millones por defecto
  const goal =
    targetAmount ||
    savingsAccounts.find((a) => (a.target_amount || 0) > 0)?.target_amount ||
    5000000;

  if (currentTotalSavings >= goal) {
    return {
      intent: 'goal_target_reach',
      title: 'Meta de Ahorro Alcanzada',
      verdict: `¡Ya tienes ${formatCLP(currentTotalSavings)} acumulados!`,
      verdictTone: 'emerald',
      recommendation: `¡Felicidades! Tu saldo actual en cuentas de ahorro (${formatCLP(currentTotalSavings)}) ya supera tu meta de **${formatCLP(goal)}**. Puedes definir una meta superior o invertir el excedente en instrumentos de mayor plazo.`,
      detailedBreakdown: [
        `• Saldo actual en cuentas de ahorro: ${formatCLP(currentTotalSavings)}.`,
        `• Meta evaluada: ${formatCLP(goal)}.`,
      ],
      metrics: [
        { label: 'Saldo Actual', value: formatCLP(currentTotalSavings), tone: 'emerald' },
        { label: 'Meta', value: formatCLP(goal), tone: 'neutral' },
      ],
    };
  }

  // Simular proyección mes a mes hasta 60 meses
  const typedSavings = savingsAccounts.map((a) => accountToSavingsAccount(a));
  const surplusList = buildMonthlySurplusList(recurringItems, basePeriod, 60);
  const forecast = calculateConsolidatedForecast(typedSavings, 60, surplusList);

  let reachedMonthIndex = -1;
  for (let i = 0; i < forecast.points.length; i++) {
    if (forecast.points[i].totalBalance >= goal) {
      reachedMonthIndex = i;
      break;
    }
  }

  const gap = goal - currentTotalSavings;

  if (reachedMonthIndex >= 0) {
    const reachedPoint = forecast.points[reachedMonthIndex];
    return {
      intent: 'goal_target_reach',
      title: `Meta de Ahorro: ${formatCLP(goal)}`,
      verdict: `Llegarás en ${reachedPoint.monthLabel} (${reachedMonthIndex + 1} meses)`,
      verdictTone: 'emerald',
      recommendation: `Manteniendo tu ritmo de ahorro actual y la rentabilidad de tus cuentas, alcanzarás los **${formatCLP(goal)}** en **${reachedPoint.monthLabel}** (faltan aprox. ${reachedMonthIndex + 1} meses).`,
      detailedBreakdown: [
        `• Saldo actual en ahorro: ${formatCLP(currentTotalSavings)}.`,
        `• Brecha restante por juntar: ${formatCLP(gap)}.`,
        `• Fecha estimada de llegada: ${reachedPoint.monthLabel}.`,
        `• Intereses ganados en el trayecto: ${formatCLP(reachedPoint.cumulativeInterest)}.`,
      ],
      metrics: [
        { label: 'Meta de Ahorro', value: formatCLP(goal), tone: 'emerald' },
        { label: 'Fecha Estimada', value: reachedPoint.monthLabel, tone: 'emerald' },
        { label: 'Tiempo Restante', value: `${reachedMonthIndex + 1} meses`, tone: 'neutral' },
      ],
    };
  }

  return {
    intent: 'goal_target_reach',
    title: `Meta de Ahorro: ${formatCLP(goal)}`,
    verdict: 'Horizonte superior a 5 años con el ritmo actual',
    verdictTone: 'amber',
    recommendation: `Para juntar **${formatCLP(goal)}**, con tu tasa de ahorro actual necesitarás más de 5 años. Te sugerimos aumentar tu aporte fijo mensual o destinar ingresos extra para acelerar la meta.`,
    detailedBreakdown: [
      `• Saldo actual en ahorro: ${formatCLP(currentTotalSavings)}.`,
      `• Brecha restante: ${formatCLP(gap)}.`,
      '• Consejo: Reducir gastos fijos innecesarios liberará más superávit cada mes.',
    ],
  };
}

/**
 * Responde sobre ingresos mensuales, sueldo y flujo de caja libre.
 */
export function solveIncomeCashflow(context: QueryContextData): QueryEngineResult {
  const { recurringItems } = context;
  const period = context.period || getCurrentPeriod();

  const activeIncomes = recurringItems.filter(
    (i) => i.type === 'income' && isItemActiveInMonth(i, period)
  );
  const totalIncome = activeIncomes.reduce((sum, i) => sum + i.amount, 0);

  const activeExpenses = recurringItems.filter(
    (i) => i.type === 'expense' && isItemActiveInMonth(i, period)
  );
  const totalFixedExpenses = activeExpenses.reduce((sum, i) => sum + i.amount, 0);

  const freeCashFlow = totalIncome - totalFixedExpenses;
  const fixedRatio = totalIncome > 0 ? Math.round((totalFixedExpenses / totalIncome) * 100) : 0;
  const freeRatio = totalIncome > 0 ? Math.round((freeCashFlow / totalIncome) * 100) : 0;

  const incomeListLines = activeIncomes.map((inc) => `• ${inc.title}: ${formatCLP(inc.amount)}`);

  return {
    intent: 'income_cashflow',
    title: 'Análisis de Ingresos y Flujo Libre de Caja',
    verdict: `Ingreso mensual: ${formatCLP(totalIncome)} · Flujo libre: ${formatCLP(freeCashFlow)} (${freeRatio}%)`,
    verdictTone: freeCashFlow > 0 ? 'emerald' : 'coral',
    recommendation: `Tus ingresos recurrentes suman **${formatCLP(totalIncome)} al mes**. Después de cubrir tus gastos fijos obligatorios (${formatCLP(totalFixedExpenses)}, que representan el ${fixedRatio}% de tu sueldo), te queda un **flujo libre de caja de ${formatCLP(freeCashFlow)}** para ahorro y consumo diario.`,
    detailedBreakdown: [
      ...incomeListLines,
      `• Gastos fijos obligatorios: -${formatCLP(totalFixedExpenses)} (${fixedRatio}% de rigidez).`,
      `• Flujo de Caja Libre resultante: ${formatCLP(freeCashFlow)} (${freeRatio}% de tu ingreso).`,
    ],
    metrics: [
      { label: 'Sueldo Total', value: formatCLP(totalIncome), tone: 'neutral' },
      { label: 'Gastos Fijos', value: formatCLP(totalFixedExpenses), tone: 'neutral' },
      { label: 'Flujo Libre', value: formatCLP(freeCashFlow), tone: 'emerald' },
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
      '¿Qué cuentas me faltan pagar este mes?',
    ],
  };
}

/**
 * Responde el cupo disponible y fecha de corte de las tarjetas de crédito.
 */
export function solveCreditCardDetails(context: QueryContextData): QueryEngineResult {
  const { accounts } = context;
  const creditCards = accounts.filter((a) => a.type === 'credit_card');

  if (creditCards.length === 0) {
    return {
      intent: 'credit_card_details',
      title: 'Tarjetas de Crédito',
      verdict: 'No tienes tarjetas de crédito registradas',
      verdictTone: 'blue',
      recommendation:
        'No registras tarjetas de crédito en FinanzApp. Puedes agregar tu tarjeta Santander o CMR Falabella desde la sección de tarjetas.',
      detailedBreakdown: [],
    };
  }

  const breakdownLines = creditCards.map((c) => {
    const limit = c.credit_limit || 0;
    const used = c.current_balance || 0;
    const available = Math.max(0, limit - used);
    const cutStr = c.billing_day ? `Día ${c.billing_day} de cada mes` : 'No configurado';
    return `• **${c.name}**: Cupo Total: ${formatCLP(limit)} | Usado: ${formatCLP(used)} | Disponible: ${formatCLP(available)} | Corte: ${cutStr}`;
  });

  const totalLimit = creditCards.reduce((sum, c) => sum + (c.credit_limit || 0), 0);
  const totalUsed = creditCards.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  const totalAvailable = Math.max(0, totalLimit - totalUsed);

  return {
    intent: 'credit_card_details',
    title: 'Cupos y Facturación de Tarjetas de Crédito',
    verdict: `Cupo disponible total: ${formatCLP(totalAvailable)} de ${formatCLP(totalLimit)}`,
    verdictTone: totalUsed / (totalLimit || 1) > 0.5 ? 'amber' : 'emerald',
    recommendation: `Tienes **${creditCards.length} tarjetas registradas** con un cupo total de **${formatCLP(totalLimit)}**. Actualmente tienes **${formatCLP(totalAvailable)} disponibles** y una deuda utilizada de ${formatCLP(totalUsed)}.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: 'Cupo Total', value: formatCLP(totalLimit), tone: 'neutral' },
      { label: 'Cupo Usado', value: formatCLP(totalUsed), tone: 'coral' },
      { label: 'Disponible', value: formatCLP(totalAvailable), tone: 'emerald' },
    ],
    suggestedFollowUps: [
      '¿Me conviene pagar la tarjeta o ahorrar?',
      '¿Cuánto debo en total sumando todo?',
    ],
  };
}

/**
 * Responde el consolidado total de deudas (tarjetas + préstamos).
 */
export function solveTotalDebtAudit(context: QueryContextData): QueryEngineResult {
  const { accounts, recurringItems } = context;
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const cardDebt = creditCards.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  const loanItems = recurringItems.filter(
    (i) => i.type === 'expense' && (i.category === 'prestamo' || i.title.toLowerCase().includes('credito') || i.title.toLowerCase().includes('prestamo'))
  );
  const loansTotal = loanItems.reduce((sum, i) => sum + i.amount, 0);

  const totalDebt = cardDebt + loansTotal;

  if (totalDebt === 0) {
    return {
      intent: 'total_debt_audit',
      title: 'Auditoría Total de Deudas',
      verdict: '¡Cero deudas! Portafolio 100% limpio',
      verdictTone: 'emerald',
      recommendation:
        'No tienes deuda rotativa en tarjetas de crédito ni préstamos activos registrados. Eres libre de destinar todo tu excedente a inversión.',
      detailedBreakdown: ['• Deuda en tarjetas: $0', '• Préstamos o créditos de consumo: $0'],
    };
  }

  const breakdownLines = [
    `• Deuda acumulada en tarjetas de crédito: ${formatCLP(cardDebt)}.`,
  ];
  loanItems.forEach((l) => {
    breakdownLines.push(`• Préstamo: ${l.title} (${formatCLP(l.amount)}/mes).`);
  });

  return {
    intent: 'total_debt_audit',
    title: 'Auditoría Total de Deudas',
    verdict: `Deuda total consolidada: ${formatCLP(totalDebt)}`,
    verdictTone: 'coral',
    recommendation: `Tu deuda total identificada suma **${formatCLP(totalDebt)}** (${formatCLP(cardDebt)} en tarjetas y ${formatCLP(loansTotal)} en cuotas/préstamos). Te recomendamos priorizar la liquidación de las tarjetas de crédito debido a su alto costo financiero.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: 'Deuda Tarjetas', value: formatCLP(cardDebt), tone: 'coral' },
      { label: 'Cuotas Préstamos', value: formatCLP(loansTotal), tone: 'amber' },
      { label: 'Total Deuda', value: formatCLP(totalDebt), tone: 'coral' },
    ],
    suggestedFollowUps: [
      '¿Me conviene pagar la tarjeta o ahorrar?',
      '¿Qué cuentas me faltan pagar este mes?',
    ],
  };
}

/**
 * Responde el desglose de suscripciones y apps de streaming.
 */
export function solveSubscriptionsAudit(context: QueryContextData): QueryEngineResult {
  const { recurringItems } = context;
  const subs = recurringItems.filter(
    (i) =>
      i.type === 'expense' &&
      (i.category === 'suscripciones' ||
        ['netflix', 'spotify', 'prime', 'youtube', 'disney', 'max', 'icloud', 'chatgpt'].some((k) =>
          i.title.toLowerCase().includes(k)
        ))
  );

  const monthlyTotal = subs.reduce((sum, s) => sum + s.amount, 0);
  const annualTotal = monthlyTotal * 12;

  if (subs.length === 0) {
    return {
      intent: 'subscriptions_audit',
      title: 'Auditoría de Suscripciones',
      verdict: 'No tienes suscripciones registradas',
      verdictTone: 'blue',
      recommendation:
        'No tienes suscripciones registradas en la categoría "Suscripciones & Apps". Puedes agregarlas en la pestaña Gastos Fijos para auditar su impacto anual.',
      detailedBreakdown: [],
    };
  }

  const breakdownLines = subs.map(
    (s) => `• ${s.title}: ${formatCLP(s.amount)}/mes (${formatCLP(s.amount * 12)}/año)`
  );

  return {
    intent: 'subscriptions_audit',
    title: 'Auditoría de Suscripciones y Apps',
    verdict: `Gastas ${formatCLP(monthlyTotal)}/mes (${formatCLP(annualTotal)}/año)`,
    verdictTone: monthlyTotal > 50000 ? 'amber' : 'emerald',
    recommendation: `Tienes **${subs.length} suscripciones activas** que representan **${formatCLP(monthlyTotal)} al mes** (${formatCLP(annualTotal)} al año). Auditar las plataformas que menos usas puede liberar liquidez directa para tu ahorro.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: 'Total Mensual', value: formatCLP(monthlyTotal), tone: 'neutral' },
      { label: 'Costo Anual', value: formatCLP(annualTotal), tone: 'amber' },
      { label: 'Cantidad', value: `${subs.length} apps`, tone: 'neutral' },
    ],
    suggestedFollowUps: [
      '¿En qué categoría se fue más dinero este mes?',
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
    ],
  };
}

/**
 * Responde sobre el ahorro en pareja y metas conjuntas.
 */
export function solveSharedSavings(context: QueryContextData): QueryEngineResult {
  const { accounts } = context;
  const sharedAccounts = accounts.filter((a) => a.type === 'savings' && Boolean(a.is_shared));

  if (sharedAccounts.length === 0) {
    return {
      intent: 'shared_savings_partner',
      title: 'Ahorro en Pareja',
      verdict: 'No tienes cuentas compartidas activas',
      verdictTone: 'blue',
      recommendation:
        'Actualmente no tienes cuentas de ahorro configuradas en modo compartido con tu pareja. Puedes marcar cualquier cuenta de ahorro como "Ahorro en Pareja" para definir metas y aportes conjuntos.',
      detailedBreakdown: [],
    };
  }

  const totalSharedBalance = sharedAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const partnerName = sharedAccounts[0].partner_name || 'Tu pareja';

  const breakdownLines = sharedAccounts.map((a) => {
    const bal = formatCLP(a.current_balance || 0);
    const myMonthly = formatCLP(a.fixed_contribution || 0);
    const partnerMonthly = formatCLP(a.partner_monthly_contribution || 0);
    return `• **${a.name}**: Saldo: ${bal} | Tu aporte: ${myMonthly}/mes | Aporte de ${partnerName}: ${partnerMonthly}/mes`;
  });

  return {
    intent: 'shared_savings_partner',
    title: 'Ahorro Conjunto en Pareja',
    verdict: `Total ahorrado entre ambos: ${formatCLP(totalSharedBalance)}`,
    verdictTone: 'emerald',
    recommendation: `Tienen **${formatCLP(totalSharedBalance)} acumulados** en sus metas de ahorro en pareja junto a **${partnerName}**.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: 'Total Pareja', value: formatCLP(totalSharedBalance), tone: 'emerald' },
      { label: 'Cuentas Compartidas', value: `${sharedAccounts.length}`, tone: 'neutral' },
    ],
    suggestedFollowUps: [
      '¿En qué cuenta me recomiendas invertir?',
      '¿Cuánto podré ahorrar en abril?',
    ],
  };
}

/**
 * Responde qué hacer ante un bono o ingreso extraordinario (Waterfall financiero).
 */
export function solveWindfallBonus(
  amount: number | null,
  context: QueryContextData
): QueryEngineResult {
  const { accounts } = context;
  const bonus = amount || 500000;
  const formattedBonus = formatCLP(bonus);

  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const cardDebt = creditCards.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  const savingsAccounts = accounts.filter((a) => a.type === 'savings');
  const bestAccount = [...savingsAccounts].sort(
    (a, b) => (b.interest_rate_annual || 0) - (a.interest_rate_annual || 0)
  )[0];

  const breakdownLines: string[] = [];

  if (cardDebt > 0) {
    const payAmount = Math.min(bonus, cardDebt);
    const remaining = bonus - payAmount;
    breakdownLines.push(
      `1. **Prioridad 1 (Deuda Cara):** Pagar ${formatCLP(payAmount)} a tu tarjeta de crédito para evitar intereses rotativos (~30% anual garantizado).`
    );
    if (remaining > 0) {
      breakdownLines.push(
        `2. **Prioridad 2 (Inversión):** Depositar el remanente de ${formatCLP(remaining)} en ${bestAccount ? bestAccount.name : 'tu cuenta de ahorro'} (${bestAccount?.interest_rate_annual || 5}% anual).`
      );
    }
    return {
      intent: 'windfall_bonus',
      title: `Estrategia para tu Bono de ${formattedBonus}`,
      verdict: `Recomendación: Pagar ${formatCLP(payAmount)} de tarjeta de crédito`,
      verdictTone: 'coral',
      recommendation: `Con este bono de **${formattedBonus}**, tu movimiento más rentable es **liquidar la deuda de tarjetas de crédito**. Te ahorrarás intereses que superan con creces lo que ganarías ahorrando.`,
      detailedBreakdown: breakdownLines,
      metrics: [
        { label: 'Bono Recibido', value: formattedBonus, tone: 'neutral' },
        { label: 'Pago a Tarjeta', value: formatCLP(payAmount), tone: 'coral' },
        { label: 'Ahorro de Intereses', value: '~30% anual', tone: 'emerald' },
      ],
    };
  }

  // Si no tiene deuda
  breakdownLines.push(
    `1. **Fondo de Emergencia / Ahorro Líquido:** Abonar el 100% (${formattedBonus}) en **${bestAccount ? bestAccount.name : 'tu mejor cuenta de ahorro'}**.`,
    '2. Mantendrás la liquidez libre de riesgo ganando intereses compuestos desde el primer día.'
  );

  return {
    intent: 'windfall_bonus',
    title: `Estrategia para tu Bono de ${formattedBonus}`,
    verdict: `Abonar 100% en ${bestAccount ? bestAccount.name : 'tu cuenta de ahorro'}`,
    verdictTone: 'emerald',
    recommendation: `Al no tener deudas en tarjetas, te recomendamos transferir los **${formattedBonus}** a **${bestAccount ? bestAccount.name : 'tu cuenta de ahorro'}**, donde generará intereses diarios sin riesgo.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: 'Bono Recibido', value: formattedBonus, tone: 'emerald' },
      { label: 'Cuenta Destino', value: bestAccount ? bestAccount.name : 'Ahorro', tone: 'neutral' },
      { label: 'Tasa Anual', value: `${bestAccount?.interest_rate_annual || 5}%`, tone: 'emerald' },
    ],
  };
}

export function solveGreetingHelp(): QueryEngineResult {
  return {
    intent: 'greeting_help',
    title: 'FinanzAI · Asistente Cuantitativo',
    verdict: 'Listo para optimizar tus decisiones de dinero',
    verdictTone: 'blue',
    recommendation:
      'Hola. Soy tu consultor financiero cuantitativo en FinanzApp. Mis respuestas se basan 100% en tus saldos bancarios y compromisos reales, sin suposiciones.',
    detailedBreakdown: [
      '• Proyecciones futuras mes a mes (ej. "¿Cuánto podré ahorrar en abril o a fin de año?").',
      '• Cálculo en tiempo real de cuánto puedes ahorrar hoy sin descalzar fin de mes.',
      '• Simulación What-If para saber si puedes hacer una compra o gasto imprevisto.',
      '• Auditoría de tus cuentas de ahorro para depositar donde obtengas mayor rentabilidad.',
      '• Diagnóstico de pre-pago de tarjetas versus instrumentos de inversión libre de riesgo.',
      '• Auditoría de tus sueldos, flujo de caja libre, deudas totales y suscripciones activas.',
    ],
    suggestedFollowUps: [
      '¿Cuánto podré ahorrar en abril?',
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
      '¿Cuál es mi sueldo y flujo de caja libre?',
    ],
  };
}

export function solveInvestRecommendation(accounts: Account[]): QueryEngineResult {
  const savingsAccounts = accounts.filter((a) => a.type === 'savings');

  if (savingsAccounts.length === 0) {
    return {
      intent: 'invest_recommendation',
      title: 'Recomendación de Cuentas de Ahorro',
      verdict: 'No tienes cuentas de ahorro registradas',
      verdictTone: 'amber',
      recommendation:
        'Actualmente no tienes cuentas de ahorro o depósitos configurados en FinanzApp. Te recomendamos abrir una cuenta de alta rentabilidad libre de riesgo en Chile (como Consorcio Más Lana, BancoEstado DAP o Fintual Very Conservative).',
      detailedBreakdown: [
        '• En Chile, las mejores cuentas de ahorro a la vista ofrecen entre 4.8% y 5.5% anual (tasa nominal).',
        '• Puedes agregar tu cuenta en la sección "Tarjetas & Cuentas" para que el motor compare las tasas automáticamente.',
      ],
      actionLabel: 'Ir a Billetera & Cuentas',
      actionType: 'view_cards',
    };
  }

  // Ordenar cuentas de ahorro de mayor a menor tasa anual
  const sortedAccounts = [...savingsAccounts].sort(
    (a, b) => (b.interest_rate_annual || 0) - (a.interest_rate_annual || 0)
  );
  const bestAccount = sortedAccounts[0];
  const bestRate = bestAccount.interest_rate_annual || 0;
  const bestBalance = bestAccount.current_balance || 0;

  // Ganancia proyectada por cada $100.000 al año
  const gainPer100kAnnual = Math.round(100000 * (bestRate / 100));
  const gainPer100kMonthly = Math.round(gainPer100kAnnual / 12);

  const breakdownLines = sortedAccounts.map((acc) => {
    const rateStr = acc.interest_rate_annual ? `${acc.interest_rate_annual}% anual` : 'Tasa no fijada';
    const balanceStr = formatCLP(acc.current_balance || 0);
    const sharedTag = acc.is_shared ? ' (En Pareja)' : '';
    return `• ${acc.name}${sharedTag}: ${rateStr} · Saldo: ${balanceStr}`;
  });

  return {
    intent: 'invest_recommendation',
    title: 'Recomendación de Rendimiento de Ahorro',
    verdict: `La mejor opción hoy es: ${bestAccount.name} (${bestRate}% anual)`,
    verdictTone: 'emerald',
    recommendation: `Te conviene abonar tus excedentes en **${bestAccount.name}**, ya que ofrece la mayor tasa de interés anual (${bestRate}% anual libre de riesgo) de tu portafolio.`,
    detailedBreakdown: [
      `• Por cada $100.000 depositados, generas aprox. ${formatCLP(gainPer100kAnnual)} al año (${formatCLP(gainPer100kMonthly)} al mes).`,
      ...breakdownLines,
      '• Recuerda mantener el fondo de emergencia siempre en instrumentos con liquidez inmediata (retiro en 24h a 48h hábiles).',
    ],
    metrics: [
      { label: 'Mejor Tasa Anual', value: `${bestRate}%`, tone: 'emerald' },
      { label: 'Saldo en Cuenta', value: formatCLP(bestBalance), tone: 'neutral' },
      { label: 'Retorno x $100k/año', value: formatCLP(gainPer100kAnnual), tone: 'emerald' },
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿Me conviene pagar la tarjeta o ahorrar?',
    ],
  };
}

export function solveCardVsSavings(
  accounts: Account[],
  recurringItems: RecurringItem[],
  period: string
): QueryEngineResult {
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const totalCardDebt = creditCards.reduce((acc, c) => acc + (c.current_balance || 0), 0);

  // Cuentas de ahorro para ver su tasa máxima
  const savingsAccounts = accounts.filter((a) => a.type === 'savings');
  const topSavingsRate =
    savingsAccounts.reduce((max, a) => Math.max(max, a.interest_rate_annual || 0), 0) || 5.0;

  // Gastos fijos asignados a tarjetas de crédito en el período
  const cardFixedExpenses = recurringItems.filter(
    (item) =>
      item.type === 'expense' &&
      isItemActiveInMonth(item, period) &&
      creditCards.some((card) => card.id === item.account_id)
  );
  const cardFixedTotal = cardFixedExpenses.reduce((sum, item) => sum + item.amount, 0);

  if (totalCardDebt > 0 || cardFixedTotal > 0) {
    const totalToPay = totalCardDebt + cardFixedTotal;

    return {
      intent: 'card_vs_savings',
      title: 'Dictamen Financiero: Tarjetas vs. Ahorro',
      verdict: 'Prioridad Absoluta: Prepagar Tarjeta de Crédito',
      verdictTone: 'coral',
      recommendation:
        'Matemáticamente te conviene **liquidar la tarjeta de crédito antes de depositar en una cuenta de ahorro**. La tasa de interés de la deuda en tarjeta (25% - 35% anual) es entre 5 y 7 veces más cara que el interés que ganas ahorrando (~5% anual).',
      detailedBreakdown: [
        `• Deuda actual acumulada en tarjetas: ${formatCLP(totalCardDebt)}.`,
        `• Cuotas facturadas del período: ${formatCLP(cardFixedTotal)}.`,
        `• Compromiso total en tarjetas: ${formatCLP(totalToPay)}.`,
        `• Tasa máxima de ahorro en tu portafolio: ${topSavingsRate}% anual.`,
        '• Regla Financiera Profesional: Pagar una tarjeta al 30% anual genera un rendimiento garantizado del 30% libre de riesgo, superando cualquier cuenta de ahorro o depósito a plazo.',
      ],
      metrics: [
        { label: 'Deuda en Tarjetas', value: formatCLP(totalToPay), tone: 'coral' },
        { label: 'Tasa Ahorro Portafolio', value: `${topSavingsRate}%`, tone: 'neutral' },
        { label: 'Tasa Rotativa Tarjetas', value: '~30% anual', tone: 'coral' },
      ],
      actionLabel: 'Ver Tarjetas de Crédito',
      actionType: 'view_cards',
    };
  }

  return {
    intent: 'card_vs_savings',
    title: 'Dictamen Financiero: Tarjetas vs. Ahorro',
    verdict: 'Vía Libre para Ahorro e Inversión',
    verdictTone: 'emerald',
    recommendation:
      '¡Excelente! No tienes deuda rotativa ni cuotas con interés pendientes en tus tarjetas de crédito. Toda tu capacidad de ahorro puede dirigirse directamente a tus metas de inversión y fondo de emergencia.',
    detailedBreakdown: [
      '• Tus tarjetas de crédito se encuentran al día o con saldo en $0.',
      `• Puedes transferir tus excedentes a tu mejor cuenta de ahorro (${topSavingsRate}% anual).`,
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
    ],
  };
}

export function solveSafeToSave(
  accounts: Account[],
  recurringItems: RecurringItem[],
  period: string,
  dailyBudgetSuggested: number,
  payments?: MonthlyPayment[],
  variableExpenses?: VariableExpense[]
): QueryEngineResult {
  const checkingBalance = getCheckingLiquidBalance(accounts, variableExpenses, period);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();

  const dailyBurnTarget = Math.max(8000, dailyBudgetSuggested > 0 ? dailyBudgetSuggested : 10000);
  const requiredForDailyLiving = remainingDays * dailyBurnTarget;
  const safetyBuffer = Math.round(requiredForDailyLiving * 0.15);
  const fundsToKeep = pendingFixed + requiredForDailyLiving + safetyBuffer;
  const safeToSaveAmount = Math.max(0, checkingBalance - fundsToKeep);

  if (safeToSaveAmount > 0) {
    return {
      intent: 'safe_to_save',
      title: 'Ahorro Seguro Inmediato (De tu Billetera)',
      verdict: `Monto recomendado a transferir hoy: ${formatCLP(safeToSaveAmount)}`,
      verdictTone: 'emerald',
      recommendation: `Puedes transferir con total tranquilidad **${formatCLP(safeToSaveAmount)}** a tu cuenta de ahorro. Dejarás en tu cuenta corriente suficiente saldo para cubrir todos tus gastos fijos pendientes y vivir holgadamente lo que queda del mes.`,
      detailedBreakdown: [
        `• Saldo actual en cuentas vista/corrientes: ${formatCLP(checkingBalance)}.`,
        `• Gastos fijos pendientes por pagar: -${formatCLP(pendingFixed)}.`,
        `• Presupuesto diario proyectado (${remainingDays} días a ${formatCLP(dailyBurnTarget)}/día): -${formatCLP(requiredForDailyLiving)}.`,
        `• Colchón de seguridad ante imprevistos (15%): -${formatCLP(safetyBuffer)}.`,
        `• Saldo protegido que debe permanecer en tu cuenta: ${formatCLP(fundsToKeep)}.`,
      ],
      metrics: [
        { label: 'Ahorro Recomendado', value: formatCLP(safeToSaveAmount), tone: 'emerald' },
        { label: 'Saldo Disponible Cta', value: formatCLP(checkingBalance), tone: 'neutral' },
        { label: 'Días Restantes', value: `${remainingDays} días`, tone: 'neutral' },
      ],
      suggestedFollowUps: [
        '¿En qué cuenta me recomiendas invertir?',
        '¿Cuánto podré ahorrar en abril?',
      ],
    };
  }

  const deficit = fundsToKeep - checkingBalance;
  return {
    intent: 'safe_to_save',
    title: 'Ahorro Seguro Inmediato (De tu Billetera)',
    verdict: 'Te sugerimos no transferir a ahorro hoy',
    verdictTone: 'amber',
    recommendation:
      'Tu saldo líquido actual en cuentas corrientes está ajustado para cubrir los gastos fijos que aún no pagas y el consumo diario necesario para los días que le quedan al mes. Te recomendamos priorizar la liquidez operativa.',
    detailedBreakdown: [
      `• Saldo actual en cuentas vista: ${formatCLP(checkingBalance)}.`,
      `• Gastos fijos pendientes por pagar: ${formatCLP(pendingFixed)}.`,
      `• Consumo estimado para los ${remainingDays} días restantes: ${formatCLP(requiredForDailyLiving)}.`,
      `• Brecha para alcanzar holgura segura: ${formatCLP(deficit)}.`,
      '• Una vez recibas tu próximo sueldo o ingreso, transfiere primero el 10% antes de iniciar los gastos del nuevo mes.',
    ],
    metrics: [
      { label: 'Ahorro Sugerido Hoy', value: '$0', tone: 'amber' },
      { label: 'Fijos Pendientes', value: formatCLP(pendingFixed), tone: 'coral' },
      { label: 'Días Restantes', value: `${remainingDays} días`, tone: 'neutral' },
    ],
    suggestedFollowUps: [
      '¿Qué cuentas me faltan pagar este mes?',
      '¿Cuánto puedo gastar por día hasta fin de mes?',
    ],
  };
}

export function solveWhatIfSpend(
  amount: number,
  accounts: Account[],
  recurringItems: RecurringItem[],
  period: string,
  dailyBudgetSuggested: number,
  payments?: MonthlyPayment[],
  variableExpenses?: VariableExpense[]
): QueryEngineResult {
  const checkingBalance = getCheckingLiquidBalance(accounts, variableExpenses, period);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();

  const currentAvailableMargin = checkingBalance - pendingFixed;
  const currentDailyBudget = Math.max(0, Math.round(currentAvailableMargin / remainingDays));

  const newAvailableMargin = currentAvailableMargin - amount;
  const newDailyBudget = Math.max(0, Math.round(newAvailableMargin / remainingDays));

  const formattedSpend = formatCLP(amount);

  if (newAvailableMargin < 0) {
    const deficit = Math.abs(newAvailableMargin);
    return {
      intent: 'what_if_spend',
      title: 'Simulación What-If: Gasto Imprevisto',
      verdict: `⚠️ Alerta: Este gasto de ${formattedSpend} provocaría déficit`,
      verdictTone: 'coral',
      recommendation: `**No te recomendamos realizar este gasto de ${formattedSpend}**. Supera tu liquidez disponible después de descontar tus gastos fijos obligatorios, dejándote con un descubierto estimado de ${formatCLP(deficit)}.`,
      detailedBreakdown: [
        `• Saldo en cuenta corriente: ${formatCLP(checkingBalance)}.`,
        `• Gastos fijos pendientes por pagar: -${formatCLP(pendingFixed)}.`,
        `• Margen libre actual antes del gasto: ${formatCLP(currentAvailableMargin)}.`,
        `• Monto del gasto simulado: -${formattedSpend}.`,
        `• Nuevo presupuesto diario: $0/día (descalce total para los ${remainingDays} días restantes).`,
      ],
      metrics: [
        { label: 'Gasto Simulado', value: formattedSpend, tone: 'coral' },
        { label: 'Nuevo Presupuesto', value: '$0 / día', tone: 'coral' },
        { label: 'Déficit Proyectado', value: formatCLP(deficit), tone: 'coral' },
      ],
      suggestedFollowUps: [
        '¿Qué cuentas me faltan pagar este mes?',
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
      ],
    };
  }

  if (newDailyBudget < 8000) {
    return {
      intent: 'what_if_spend',
      title: 'Simulación What-If: Gasto Imprevisto',
      verdict: `Precaución: Tu ritmo diario bajará a ${formatCLP(newDailyBudget)}/día`,
      verdictTone: 'amber',
      recommendation: `El gasto de **${formattedSpend}** es viable, pero dejará tu presupuesto diario muy ajustado para los ${remainingDays} días restantes del mes. Deberás controlar estrictamente los micro-gastos cotidianos.`,
      detailedBreakdown: [
        `• Presupuesto diario actual: ${formatCLP(currentDailyBudget)}/día.`,
        `• Presupuesto diario posterior al gasto: ${formatCLP(newDailyBudget)}/día (${remainingDays} días restantes).`,
        `• Saldo remanente protegido para gastos fijos: ${formatCLP(pendingFixed)}.`,
      ],
      metrics: [
        { label: 'Gasto Simulado', value: formattedSpend, tone: 'amber' },
        { label: 'Ritmo Anterior', value: `${formatCLP(currentDailyBudget)}/d`, tone: 'neutral' },
        { label: 'Nuevo Ritmo', value: `${formatCLP(newDailyBudget)}/d`, tone: 'amber' },
      ],
      suggestedFollowUps: [
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
        '¿En qué categoría se fue más dinero este mes?',
      ],
    };
  }

  return {
    intent: 'what_if_spend',
    title: 'Simulación What-If: Gasto Imprevisto',
    verdict: `✅ Gasto Aprobado: Mantienes ${formatCLP(newDailyBudget)}/día`,
    verdictTone: 'emerald',
    recommendation: `**Puedes realizar este gasto de ${formattedSpend} con total tranquilidad**. Tu presupuesto diario remanente de **${formatCLP(newDailyBudget)}/día** se mantiene en zona verde y todas tus cuentas de fin de mes quedan 100% cubiertas.`,
    detailedBreakdown: [
      `• Saldo actual en cuenta corriente: ${formatCLP(checkingBalance)}.`,
      `• Gastos fijos protegidos: ${formatCLP(pendingFixed)}.`,
      `• Margen libre remanente tras la compra: ${formatCLP(newAvailableMargin)}.`,
      `• Presupuesto diario holgado resultante: ${formatCLP(newDailyBudget)}/día por los próximos ${remainingDays} días.`,
    ],
    metrics: [
      { label: 'Gasto Simulado', value: formattedSpend, tone: 'emerald' },
      { label: 'Nuevo Diario', value: `${formatCLP(newDailyBudget)}/d`, tone: 'emerald' },
      { label: 'Días Restantes', value: `${remainingDays} días`, tone: 'neutral' },
    ],
  };
}

export function solveSurvivalHealth(
  accounts: Account[],
  recurringItems: RecurringItem[],
  variableExpenses: VariableExpense[],
  period: string,
  existingReport?: FinancialIntelligenceReport
): QueryEngineResult {
  const report =
    existingReport ||
    generateFinancialIntelligence({
      period,
      accounts,
      recurringItems,
      variableExpenses,
    });

  const { overallScore, healthStatus, keyRatios } = report;
  const toneMap: Record<string, 'emerald' | 'amber' | 'coral' | 'blue'> = {
    Óptima: 'emerald',
    Estable: 'blue',
    'Requiere Atención': 'amber',
    Crítica: 'coral',
  };

  const emergencyMonthsStr = `${keyRatios.emergencyMonths.toFixed(1)} meses`;
  const fixedRatioStr = `${Math.round(keyRatios.fixedCostRatio)}%`;

  return {
    intent: 'survival_health',
    title: 'Diagnóstico de Salud Financiera',
    verdict: `Score Global: ${overallScore}/100 (${healthStatus})`,
    verdictTone: toneMap[healthStatus] || 'blue',
    recommendation: `Tu salud financiera se encuentra en nivel **${healthStatus}**. Tu fondo de emergencia cubre actualmente **${emergencyMonthsStr}** de tu costo de vida fijo, con una rigidez de gastos fijos del **${fixedRatioStr}** sobre tus ingresos.`,
    detailedBreakdown: [
      `• Cobertura de Emergencia: ${emergencyMonthsStr} (Meta ideal: 3 a 6 meses).`,
      `• Rigidez Fija: ${fixedRatioStr} de tus ingresos (Ideal: menor al 50%).`,
      `• Tarjetas de Crédito: Uso promedio del ${Math.round(keyRatios.cardUtilizationAverage)}%.`,
      `• Ahorro Mensual Potencial Identificado: ${formatCLP(report.totalPotentialSavingsMonthlyCLP)}/mes.`,
    ],
    metrics: [
      { label: 'Score Global', value: `${overallScore} / 100`, tone: toneMap[healthStatus] },
      { label: 'Fondo Emergencia', value: emergencyMonthsStr, tone: keyRatios.emergencyMonths >= 3 ? 'emerald' : 'amber' },
      { label: 'Rigidez Fija', value: fixedRatioStr, tone: keyRatios.fixedCostRatio <= 50 ? 'emerald' : 'coral' },
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
      '¿Cuánto podré ahorrar en abril?',
    ],
  };
}

export function solvePendingCommitments(
  accounts: Account[],
  recurringItems: RecurringItem[],
  period: string,
  payments?: MonthlyPayment[]
): QueryEngineResult {
  const paidItemIds = new Set(
    (payments || [])
      .filter((p) => p.target_type === 'recurring_item' && p.period === period && p.is_paid)
      .map((p) => p.target_id)
  );

  const pendingItems = recurringItems.filter(
    (item) => item.type === 'expense' && isItemActiveInMonth(item, period) && !paidItemIds.has(item.id)
  );

  const totalPending = pendingItems.reduce((sum, item) => sum + item.amount, 0);

  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const cardsTotal = creditCards.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  if (pendingItems.length === 0 && cardsTotal === 0) {
    return {
      intent: 'pending_commitments',
      title: 'Radar de Cuentas y Cuotas por Pagar',
      verdict: '¡Todo al día! No tienes pagos pendientes este mes',
      verdictTone: 'emerald',
      recommendation:
        'Todos tus gastos fijos activos ya han sido marcados como pagados y tus tarjetas de crédito no presentan saldos adeudados para este período.',
      detailedBreakdown: [
        '• Cero cuentas atrasadas o pendientes de corte.',
        '• Tus excedentes en cuenta corriente están 100% libres de ataduras.',
      ],
      suggestedFollowUps: [
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
        '¿En qué cuenta me recomiendas invertir?',
      ],
    };
  }

  const breakdownLines = pendingItems.slice(0, 5).map((item) => {
    return `• ${item.title}: ${formatCLP(item.amount)}`;
  });

  if (pendingItems.length > 5) {
    breakdownLines.push(`• ... y ${pendingItems.length - 5} cuentas más.`);
  }

  if (cardsTotal > 0) {
    breakdownLines.push(`• Facturación / Saldo en Tarjetas de Crédito: ${formatCLP(cardsTotal)}.`);
  }

  return {
    intent: 'pending_commitments',
    title: 'Radar de Cuentas y Cuotas por Pagar',
    verdict: `Total por pagar: ${formatCLP(totalPending + cardsTotal)}`,
    verdictTone: 'amber',
    recommendation: `Tienes **${pendingItems.length} gastos fijos pendientes** que suman **${formatCLP(totalPending)}**${cardsTotal > 0 ? ` más ${formatCLP(cardsTotal)} en tarjetas de crédito` : ''}. Asegúrate de reservar este monto en tu cuenta corriente para evitar cortes o intereses.`,
    detailedBreakdown: breakdownLines,
    metrics: [
      { label: 'Fijos Pendientes', value: formatCLP(totalPending), tone: 'coral' },
      { label: 'Deuda Tarjetas', value: formatCLP(cardsTotal), tone: cardsTotal > 0 ? 'coral' : 'emerald' },
      { label: 'Cuentas Restantes', value: `${pendingItems.length}`, tone: 'neutral' },
    ],
    actionLabel: 'Ver Gastos Fijos',
    actionType: 'view_fixed',
  };
}

export function solveCategoryAudit(
  variableExpenses: VariableExpense[],
  period: string
): QueryEngineResult {
  const currentPeriodExpenses = variableExpenses.filter(
    (exp) => (exp.period || exp.date?.slice(0, 7)) === period
  );

  const totalVar = currentPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);

  if (currentPeriodExpenses.length === 0 || totalVar === 0) {
    return {
      intent: 'category_audit',
      title: 'Auditoría de Gastos Variables',
      verdict: 'Sin gastos variables registrados en el período',
      verdictTone: 'blue',
      recommendation:
        'Aún no has registrado compras cotidianas en este mes. A medida que agregues gastos con el botón rápido de micro-gastos, aquí podrás ver dónde se fuga tu dinero.',
      detailedBreakdown: [
        '• Categorías principales: Alimentación, Transporte, Servicios, Entretenimiento, Educación.',
      ],
      suggestedFollowUps: [
        '¿Cuánto puedo gastar por día hasta fin de mes?',
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
      ],
    };
  }

  const categoryTotals: Record<string, number> = {};
  currentPeriodExpenses.forEach((exp) => {
    const cat = exp.category || 'general';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  const [topCategory, topAmount] = sortedCategories[0];
  const topPercentage = Math.round((topAmount / totalVar) * 100);

  const breakdown = sortedCategories.slice(0, 4).map(([cat, amt]) => {
    const pct = Math.round((amt / totalVar) * 100);
    const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `• ${catName}: ${formatCLP(amt)} (${pct}% del total variable)`;
  });

  return {
    intent: 'category_audit',
    title: 'Auditoría de Gastos Variables',
    verdict: `Mayor concentración: ${topCategory.toUpperCase()} (${topPercentage}%)`,
    verdictTone: topPercentage > 40 ? 'amber' : 'emerald',
    recommendation: `En lo que va del mes has gastado un total de **${formatCLP(totalVar)}** en micro-gastos. Tu categoría de mayor consumo es **${topCategory}**, representando el **${topPercentage}%** de tus gastos variables.`,
    detailedBreakdown: breakdown,
    metrics: [
      { label: 'Total Variable', value: formatCLP(totalVar), tone: 'neutral' },
      { label: 'Categoría Líder', value: topCategory, tone: 'amber' },
      { label: '% del Total', value: `${topPercentage}%`, tone: 'amber' },
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo gastar por día hasta fin de mes?',
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
    ],
  };
}

export function solveAmountOnly(amount: number): QueryEngineResult {
  const formatted = formatCLP(amount);
  return {
    intent: 'amount_only',
    title: 'Consulta de Monto Detectada',
    verdict: `Detecté ${formatted}: ¿Deseas simular gasto o ahorro?`,
    verdictTone: 'blue',
    recommendation: `Ingresaste una cifra de **${formatted}**. ¿Quieres comprobar si puedes gastarlo hoy sin poner en riesgo tu fin de mes, o prefieres evaluar si puedes transferirlo a tu ahorro?`,
    detailedBreakdown: [
      `1. Toca "¿Puedo gastar ${formatted}?" para evaluar el impacto en tu presupuesto diario.`,
      `2. Toca "¿Puedo ahorrar ${formatted}?" para verificar si tu saldo bancario lo permite.`,
    ],
    suggestedFollowUps: [
      `¿Puedo gastar ${formatted} hoy?`,
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿Cuánto podré ahorrar en abril?',
    ],
  };
}

export function solveFallback(): QueryEngineResult {
  return {
    intent: 'fallback',
    title: 'Asistente Cuantitativo FinanzAI',
    verdict: 'Consulta no vinculada a tus finanzas',
    verdictTone: 'neutral',
    recommendation:
      'Soy tu consultor financiero cuantitativo en FinanzApp. Mis respuestas están calibradas para optimizar tus cuentas bancarias, simular gastos, proyectar ahorros en meses futuros o auditar tarjetas. ¿Te gustaría consultar alguna de las siguientes opciones?',
    detailedBreakdown: [
      '• ¿Cuánto podré ahorrar en abril o a fin de año?',
      '• ¿Cuánto puedo ahorrar hoy de mi saldo bancario?',
      '• ¿Puedo hacer un gasto de $50.000 sin descalzarme?',
      '• ¿En qué cuenta me recomiendas invertir según mis tasas?',
      '• ¿Cuál es mi sueldo y flujo libre de caja?',
    ],
    suggestedFollowUps: [
      '¿Cuánto podré ahorrar en abril?',
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
      '¿Cuál es mi sueldo y flujo de caja libre?',
    ],
  };
}

/**
 * Función principal que procesa cualquier texto de entrada libre o píldora de 1 toque.
 */
export function queryFinanzAI(
  query: string,
  context: QueryContextData
): QueryEngineResult {
  const { accounts, recurringItems, variableExpenses, payments } = context;
  const period = context.period || getCurrentPeriod();

  const normalized = normalizeQueryText(query);
  const extractedAmount = extractAmountFromQuery(query);
  const targetHorizon = extractTargetHorizonFromQuery(query, period);
  const intent = classifyQueryIntent(normalized, extractedAmount, targetHorizon);

  // Calcular presupuesto diario actual
  const checkingBalance = getCheckingLiquidBalance(accounts, context.variableExpenses, period);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();
  const dailyBudget = Math.max(0, Math.round((checkingBalance - pendingFixed) / remainingDays));

  switch (intent) {
    case 'greeting_help':
      return solveGreetingHelp();

    case 'future_savings_projection':
      return solveFutureSavings(targetHorizon, context);

    case 'goal_target_reach':
      return solveGoalTargetReach(extractedAmount, context);

    case 'income_cashflow':
      return solveIncomeCashflow(context);

    case 'credit_card_details':
      return solveCreditCardDetails(context);

    case 'total_debt_audit':
      return solveTotalDebtAudit(context);

    case 'subscriptions_audit':
      return solveSubscriptionsAudit(context);

    case 'shared_savings_partner':
      return solveSharedSavings(context);

    case 'windfall_bonus':
      return solveWindfallBonus(extractedAmount, context);

    case 'invest_recommendation':
      return solveInvestRecommendation(accounts);

    case 'card_vs_savings':
      return solveCardVsSavings(accounts, recurringItems, period);

    case 'safe_to_save':
      return solveSafeToSave(
        accounts,
        recurringItems,
        period,
        dailyBudget,
        payments,
        context.variableExpenses
      );

    case 'what_if_spend':
      return solveWhatIfSpend(
        extractedAmount || 50000,
        accounts,
        recurringItems,
        period,
        dailyBudget,
        payments,
        context.variableExpenses
      );

    case 'survival_health':
      return solveSurvivalHealth(
        accounts,
        recurringItems,
        variableExpenses,
        period,
        context.report
      );

    case 'pending_commitments':
      return solvePendingCommitments(accounts, recurringItems, period, payments);

    case 'category_audit':
      return solveCategoryAudit(variableExpenses, period);

    case 'amount_only':
      return solveAmountOnly(extractedAmount || 0);

    case 'fallback':
    default:
      return solveFallback();
  }
}
