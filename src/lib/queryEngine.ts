import { Account, MonthlyPayment, RecurringItem, VariableExpense } from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import {
  diffPeriodsInMonths,
  getCurrentPeriod,
  isItemActiveInMonth,
} from '@/lib/finance';
import {
  FinancialIntelligenceReport,
  generateFinancialIntelligence,
} from '@/lib/intelligence';

export type QueryIntent =
  | 'greeting_help'
  | 'invest_recommendation'
  | 'card_vs_savings'
  | 'safe_to_save'
  | 'what_if_spend'
  | 'survival_health'
  | 'pending_commitments'
  | 'category_audit'
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

  // 4. Si es un número simple menor a 1000 pero mayor a 0 (ej: "500", "800")
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
export function classifyQueryIntent(normalized: string, amount: number | null): QueryIntent {
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

  // Tarjeta vs Ahorro (Pre-pago de cuotas)
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

  // Dónde invertir o qué cuenta da más intereses
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

  // Cuánto puedo ahorrar hoy / Ahorro seguro
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

  // Simulación de Compra / Gasto Imprevisto ("What-If Spend")
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

  // Compromisos, facturación y pagos pendientes
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

  // Salud Financiera y Supervivencia
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

  // Auditoría de Categorías
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
 */
function getCheckingLiquidBalance(accounts: Account[]): number {
  return accounts
    .filter((a) => a.type === 'checking')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0);
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

export function solveGreetingHelp(): QueryEngineResult {
  return {
    intent: 'greeting_help',
    title: 'FinanzAI · Asistente Cuantitativo',
    verdict: 'Listo para optimizar tus decisiones de dinero',
    verdictTone: 'blue',
    recommendation:
      'Hola. Soy tu consultor financiero cuantitativo en FinanzApp. Mis respuestas se basan 100% en tus saldos bancarios y compromisos reales, sin suposiciones.',
    detailedBreakdown: [
      '• Cálculo en tiempo real de cuánto puedes ahorrar hoy sin descalzar fin de mes.',
      '• Simulación What-If para saber si puedes hacer una compra o gasto imprevisto.',
      '• Auditoría de tus cuentas de ahorro para depositar donde obtengas mayor rentabilidad.',
      '• Diagnóstico de pre-pago de tarjetas versus instrumentos de inversión libre de riesgo.',
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
      '¿Puedo gastar $40.000 hoy?',
      '¿Qué cuentas me faltan pagar este mes?',
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
  payments?: MonthlyPayment[]
): QueryEngineResult {
  const checkingBalance = getCheckingLiquidBalance(accounts);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();

  // Presupuesto diario base razonable (si dailyBudgetSuggested es positivo, o piso de $10.000/día)
  const dailyBurnTarget = Math.max(8000, dailyBudgetSuggested > 0 ? dailyBudgetSuggested : 10000);
  const requiredForDailyLiving = remainingDays * dailyBurnTarget;

  // Colchón de seguridad ante emergencias del mes (15% del costo de vida diario)
  const safetyBuffer = Math.round(requiredForDailyLiving * 0.15);

  // Fondos comprometidos que deben quedarse en la cuenta corriente
  const fundsToKeep = pendingFixed + requiredForDailyLiving + safetyBuffer;

  // Monto exacto sugerido para transferir a ahorro hoy
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
        '¿Qué cuentas me faltan pagar este mes?',
      ],
    };
  }

  // Si no alcanza para apartar ahorro sin descalzar
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
  payments?: MonthlyPayment[]
): QueryEngineResult {
  const checkingBalance = getCheckingLiquidBalance(accounts);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();

  // Margen libre actual antes del gasto
  const currentAvailableMargin = checkingBalance - pendingFixed;
  const currentDailyBudget = Math.max(0, Math.round(currentAvailableMargin / remainingDays));

  // Simulación: Margen después del gasto propuesto
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

  // Si queda en rango ajustado (< $8.000 / día)
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

  // Viable y holgado (>= $8.000 / día)
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
      '¿En qué categoría se fue más dinero este mes?',
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
      '¿Cuánto puedo gastar por día hasta fin de mes?',
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
      'Soy tu consultor financiero cuantitativo en FinanzApp. Mis respuestas están calibradas para optimizar tus cuentas bancarias, simular gastos, auditar tarjetas o proyectar tu ahorro. ¿Te gustaría consultar alguna de las siguientes opciones?',
    detailedBreakdown: [
      '• ¿Cuánto puedo ahorrar hoy de mi saldo bancario?',
      '• ¿Puedo hacer un gasto de $50.000 sin descalzarme?',
      '• ¿En qué cuenta me recomiendas invertir según mis tasas?',
      '• ¿Qué cuentas obligatorias me faltan pagar este mes?',
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿En qué cuenta me recomiendas invertir?',
      '¿Puedo gastar $40.000 hoy?',
      '¿Qué cuentas me faltan pagar este mes?',
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
  const intent = classifyQueryIntent(normalized, extractedAmount);

  // Calcular presupuesto diario actual
  const checkingBalance = getCheckingLiquidBalance(accounts);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();
  const dailyBudget = Math.max(0, Math.round((checkingBalance - pendingFixed) / remainingDays));

  switch (intent) {
    case 'greeting_help':
      return solveGreetingHelp();

    case 'invest_recommendation':
      return solveInvestRecommendation(accounts);

    case 'card_vs_savings':
      return solveCardVsSavings(accounts, recurringItems, period);

    case 'safe_to_save':
      return solveSafeToSave(accounts, recurringItems, period, dailyBudget, payments);

    case 'what_if_spend':
      return solveWhatIfSpend(
        extractedAmount || 50000,
        accounts,
        recurringItems,
        period,
        dailyBudget,
        payments
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
