import { Account, FuturePurchase, RecurringItem, VariableExpense } from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { evaluateFuturePurchase, isItemActiveInMonth, shiftPeriod } from '@/lib/finance';

export type InsightTone = 'critical' | 'warning' | 'emerald' | 'info';

export type InsightCategory =
  | 'alimentacion'
  | 'tarjetas'
  | 'presupuesto'
  | 'ahorro'
  | 'emergencia'
  | 'habitos'
  | 'movilidad'
  | 'deudas';

export interface FinancialInsightMetric {
  label: string;
  value: string;
}

export interface FinancialInsight {
  id: string;
  category: InsightCategory;
  priority: number; // 1 (crítico / urgente) a 10 (informativo / optimización)
  title: string;
  badge: string;
  tone: InsightTone;
  summary: string;
  detail: string;
  actionStep: string;
  potentialSavingsCLP?: number;
  metrics?: FinancialInsightMetric[];
}

export interface FinancialIntelligenceReport {
  insights: FinancialInsight[];
  overallScore: number; // 0 - 100
  healthStatus: 'Óptima' | 'Estable' | 'Requiere Atención' | 'Crítica';
  totalAnalyzedExpensesCLP: number;
  totalMonthlyIncomeCLP: number;
  totalPotentialSavingsMonthlyCLP: number;
  totalPotentialSavingsAnnualCLP: number;
  keyRatios: {
    fixedCostRatio: number; // %
    freeCashFlowCLP: number;
    freeCashFlowRatio: number; // %
    emergencyMonths: number;
    deliveryRatio: number; // %
    cardUtilizationAverage: number; // %
  };
}

// Palabras clave analíticas para clasificación semántica de transacciones
const DELIVERY_KEYWORDS = [
  'uber eats',
  'ubereats',
  'pedidosya',
  'pedidos ya',
  'rappi',
  'delivery',
  'mcdonald',
  'burger king',
  'wendys',
  'kfc',
  'pizza',
  'sushi',
  'restaurant',
  'restaurante',
  'bar',
  'pub',
  'cafe',
  'starbucks',
  'dunkin',
  'comida rapida',
  'fast food',
];

const SUPERMARKET_KEYWORDS = [
  'supermercado',
  'super',
  'lider',
  'líder',
  'jumbo',
  'santa isabel',
  'tottus',
  'unimarc',
  'alvi',
  'mayorista 10',
  'mercado libre',
  'minimarket',
  'verduleria',
  'carniceria',
  'panaderia',
  'feria',
];

const RIDE_APP_KEYWORDS = [
  'uber',
  'didi',
  'cabify',
  'beat',
  'indrive',
  'taxi',
];

const PUBLIC_TRANSPORT_KEYWORDS = [
  'bip',
  'metro',
  'transantiago',
  'red movilidad',
  'micro',
  'pasaje',
  'bencina',
  'copec',
  'shell',
  'petrobras',
  'combustible',
  'tag',
  'autopista',
  'peaje',
];

const SUBSCRIPTION_KEYWORDS = [
  'netflix',
  'spotify',
  'youtube',
  'disney',
  'max',
  'hbo',
  'amazon prime',
  'prime video',
  'apple',
  'icloud',
  'google one',
  'chatgpt',
  'openai',
  'smartfit',
  'gimnasio',
  'gym',
  'playstation',
  'xbox',
  'nintendo',
  'crunchyroll',
  'paramount',
  'star+',
];

export function generateFinancialIntelligence({
  period,
  accounts,
  recurringItems,
  variableExpenses,
  futurePurchases = [],
}: {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
  variableExpenses: VariableExpense[];
  futurePurchases?: FuturePurchase[];
}): FinancialIntelligenceReport {
  const insights: FinancialInsight[] = [];

  // 1. Desglose de Gastos Fijos Activos del Periodo
  const activeRecurring = recurringItems.filter((item) =>
    isItemActiveInMonth(item, period)
  );
  const monthlyIncome = activeRecurring
    .filter((i) => i.type === 'income')
    .reduce((acc, i) => acc + i.amount, 0);

  const monthlyFixedExpenses = activeRecurring
    .filter((i) => i.type === 'expense')
    .reduce((acc, i) => acc + i.amount, 0);

  // 2. Gastos Variables del Periodo
  const periodVariables = variableExpenses.filter(
    (exp) => (exp.period || exp.date?.slice(0, 7)) === period
  );
  const monthlyVariableExpenses = periodVariables.reduce(
    (acc, exp) => acc + exp.amount,
    0
  );

  const totalAnalyzedExpenses =
    monthlyFixedExpenses + monthlyVariableExpenses;
  const freeCashFlow = monthlyIncome - totalAnalyzedExpenses;
  const freeCashFlowRatio =
    monthlyIncome > 0 ? Math.round((freeCashFlow / monthlyIncome) * 100) : 0;
  const fixedRatio =
    monthlyIncome > 0
      ? Math.round((monthlyFixedExpenses / monthlyIncome) * 100)
      : 0;

  // Cuentas por tipo
  const savingsAccounts = accounts.filter((a) => a.type === 'savings');
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const checkingAccounts = accounts.filter((a) => a.type === 'checking');

  const totalLiquidSavings = savingsAccounts.reduce(
    (acc, a) => acc + a.current_balance,
    0
  );
  const totalCheckingLiquidity = checkingAccounts.reduce(
    (acc, a) => acc + a.current_balance,
    0
  );

  // =========================================================================
  // CORRELACIÓN 1: Delivery vs Supermercado (Ratio de Fuga Gastronómica)
  // =========================================================================
  let deliveryTotal = 0;
  let supermarketTotal = 0;
  let generalFoodTotal = 0;

  const matchesAny = (text: string, keywords: string[]) => {
    const lower = text.toLowerCase();
    return keywords.some((k) => lower.includes(k));
  };

  // Analizar variables
  for (const exp of periodVariables) {
    const isFoodCat = exp.category === 'alimentacion';
    const isDelivery = matchesAny(exp.title, DELIVERY_KEYWORDS);
    const isSuper = matchesAny(exp.title, SUPERMARKET_KEYWORDS);

    if (isDelivery) {
      deliveryTotal += exp.amount;
    } else if (isSuper) {
      supermarketTotal += exp.amount;
    } else if (isFoodCat) {
      generalFoodTotal += exp.amount;
    }
  }

  // Analizar ítems fijos y cargos de tarjetas en alimentación
  for (const item of activeRecurring) {
    if (item.type !== 'expense') continue;
    const isFoodCat = item.category === 'alimentacion';
    const isDelivery = matchesAny(item.title, DELIVERY_KEYWORDS);
    const isSuper = matchesAny(item.title, SUPERMARKET_KEYWORDS);

    if (isDelivery) {
      deliveryTotal += item.amount;
    } else if (isSuper) {
      supermarketTotal += item.amount;
    } else if (isFoodCat) {
      generalFoodTotal += item.amount;
    }

    // Sub-ítems anidados
    if (item.sub_items && item.sub_items.length > 0) {
      for (const sub of item.sub_items) {
        if (matchesAny(sub.name, DELIVERY_KEYWORDS)) {
          deliveryTotal += sub.amount;
        } else if (matchesAny(sub.name, SUPERMARKET_KEYWORDS)) {
          supermarketTotal += sub.amount;
        }
      }
    }
  }

  const combinedFood = deliveryTotal + supermarketTotal + generalFoodTotal;
  const deliveryRatio =
    combinedFood > 0 ? Math.round((deliveryTotal / combinedFood) * 100) : 0;

  if (deliveryTotal >= 35000 && deliveryRatio >= 35) {
    const potentialMonthlySavings = Math.round(deliveryTotal * 0.45);
    const potentialAnnualSavings = potentialMonthlySavings * 12;

    insights.push({
      id: 'insight-delivery-supermarket',
      category: 'alimentacion',
      priority: 2,
      tone: 'warning',
      title: 'Fuga en Delivery y Comida Rápida Detectada',
      badge: `${deliveryRatio}% en Delivery`,
      summary: `El ${deliveryRatio}% de tu presupuesto en comida se fue a delivery/apps (${formatCLP(deliveryTotal)}).`,
      detail: `Registraste ${formatCLP(deliveryTotal)} en delivery y restaurantes vs ${formatCLP(supermarketTotal)} en compras de supermercado. Cocinar en casa y planificar la minuta semanal libera un margen significativo sin sacrificar calidad de vida.`,
      actionStep: `Sustituir 2 pedidos semanales por compras programadas de supermercado liberaría aprox. ${formatCLP(potentialMonthlySavings)}/mes (${formatCLP(potentialAnnualSavings)} al año).`,
      potentialSavingsCLP: potentialMonthlySavings,
      metrics: [
        { label: 'Gasto Delivery', value: formatCLP(deliveryTotal) },
        { label: 'Gasto Supermercado', value: formatCLP(supermarketTotal) },
        { label: 'Ahorro Potencial Anual', value: formatCLP(potentialAnnualSavings) },
      ],
    });
  } else if (combinedFood > 0 && deliveryRatio < 25 && supermarketTotal > 0) {
    insights.push({
      id: 'insight-delivery-healthy',
      category: 'alimentacion',
      priority: 8,
      tone: 'emerald',
      title: 'Excelente Gestión en Alimentación',
      badge: `${100 - deliveryRatio}% en Supermercado`,
      summary: `Priorizas la compra eficiente en supermercado sobre el delivery.`,
      detail: `Destinas el ${100 - deliveryRatio}% de tu gasto de alimentación a compras en supermercado (${formatCLP(supermarketTotal)}), manteniendo el delivery acotado a solo ${formatCLP(deliveryTotal)}.`,
      actionStep: 'Mantén este patrón: es uno de los mayores protectores de flujo de caja libre en el largo plazo.',
    });
  }

  // =========================================================================
  // CORRELACIÓN 2: Tarjeta de Crédito en Alimentación Diferida en Cuotas
  // =========================================================================
  const cardFoodChargesWithInstallments: RecurringItem[] = [];
  for (const card of creditCards) {
    const cardItems = activeRecurring.filter((i) => i.account_id === card.id);
    for (const item of cardItems) {
      if (item.category === 'alimentacion' && item.end_date) {
        cardFoodChargesWithInstallments.push(item);
      }
    }
  }

  if (cardFoodChargesWithInstallments.length > 0) {
    const deferredFoodTotal = cardFoodChargesWithInstallments.reduce(
      (acc, i) => acc + i.amount,
      0
    );
    insights.push({
      id: 'insight-card-food-installments',
      category: 'tarjetas',
      priority: 1, // Prioridad Máxima Crítica
      tone: 'critical',
      title: 'Alerta Crítica: Alimentación Financiada en Cuotas',
      badge: 'Riesgo Crediticio',
      summary: `Tienes ${cardFoodChargesWithInstallments.length} cargo(s) de alimentación diferidos en tu tarjeta por ${formatCLP(deferredFoodTotal)}/mes.`,
      detail: `Comprar comida en cuotas (${cardFoodChargesWithInstallments.map((i) => `${i.title} hasta ${i.end_date}`).join(', ')}) genera un ciclo de deuda sobre bienes perecederos que se consumen en días pero se pagan durante meses.`,
      actionStep:
        'Cubre la comida exclusivamente con tu saldo a la vista (débito/efectivo) o paga siempre en 1 cuota sin interés antes del corte de facturación.',
      metrics: [
        { label: 'Cuotas de Comida Activas', value: formatCLP(deferredFoodTotal) },
        { label: 'Ítems Detectados', value: `${cardFoodChargesWithInstallments.length}` },
      ],
    });
  }

  // =========================================================================
  // CORRELACIÓN 3: Costo de Oportunidad de Liquidez Ociosa (0% vs 4%+ Compuesto)
  // =========================================================================
  const zeroRateSavings = savingsAccounts
    .filter((a) => (a.interest_rate_annual || 0) === 0)
    .reduce((acc, a) => acc + a.current_balance, 0);

  const bestSavingsRate = Math.max(
    4.5,
    ...savingsAccounts.map((a) => Number(a.interest_rate_annual || 0))
  );

  const idleCapital = zeroRateSavings + (totalCheckingLiquidity > 400000 ? totalCheckingLiquidity - 300000 : 0);

  if (idleCapital >= 150000) {
    const yearlyLostGain = Math.round(idleCapital * (bestSavingsRate / 100));
    const monthlyLostGain = Math.round(yearlyLostGain / 12);

    insights.push({
      id: 'insight-yield-optimization',
      category: 'ahorro',
      priority: 3,
      tone: 'emerald',
      title: 'Optimización de Interés Compuesto Disponible',
      badge: `+${formatCLP(yearlyLostGain)}/año`,
      summary: `Tienes ${formatCLP(idleCapital)} al 0% que podría estar generando rendimientos pasivos.`,
      detail: `Mantienes saldos considerables sin remuneración. Al mover este excedente a una cuenta de ahorro remunerada al ${bestSavingsRate}% anual (o depósitos a plazo renovables), generarías ${formatCLP(yearlyLostGain)} anuales con cero riesgo adicional.`,
      actionStep: `Traspasa los saldos que no usarás en los próximos 30 días a tu cuenta de ahorro con mejor tasa (${bestSavingsRate}% anual).`,
      potentialSavingsCLP: monthlyLostGain,
      metrics: [
        { label: 'Capital Ocioso al 0%', value: formatCLP(idleCapital) },
        { label: 'Rendimiento Potencial Anual', value: formatCLP(yearlyLostGain) },
        { label: 'Ganancia Mensual Pasiva', value: formatCLP(monthlyLostGain) },
      ],
    });
  }

  // =========================================================================
  // CORRELACIÓN 4: Efecto Bola de Nieve en Deudas y Cuotas
  // =========================================================================
  const allExpiringExpenses = recurringItems.filter(
    (i) => i.type === 'expense' && Boolean(i.end_date)
  );

  // 1. Deudas y compromisos ya extinguidos respecto a este período (Flujo Ya Liberado)
  const alreadyEndedDebts = allExpiringExpenses.filter(
    (i) => i.end_date && i.end_date < period
  );

  if (alreadyEndedDebts.length > 0) {
    const totalAlreadyFreed = alreadyEndedDebts.reduce((acc, i) => acc + i.amount, 0);
    const previousMonth = shiftPeriod(period, -1);
    const justEndedDebts = alreadyEndedDebts.filter((i) => i.end_date === previousMonth);
    const justEndedFreed = justEndedDebts.reduce((acc, i) => acc + i.amount, 0);

    const summaryText =
      justEndedDebts.length > 0
        ? `A partir de este mes ya no pagas ${justEndedDebts.map((i) => `${i.title} (${formatCLP(i.amount)})`).join(', ')}. Recuperaste ${formatCLP(justEndedFreed)} mensuales de flujo limpio.`
        : `Has liberado un total acumulado de ${formatCLP(totalAlreadyFreed)} mensuales de cuotas extinguidas (${alreadyEndedDebts.map((i) => i.title).join(', ')}).`;

    insights.push({
      id: 'insight-snowball-freed',
      category: 'deudas',
      priority: 3,
      tone: 'emerald',
      title: 'Efecto Bola de Nieve: Flujo Liberado de Deudas Extinguidas',
      badge: `+${formatCLP(totalAlreadyFreed)}/mes libre`,
      summary: summaryText,
      detail: `Tu economía operaba pagando estos compromisos (${alreadyEndedDebts.map((i) => `${i.title}: ${formatCLP(i.amount)}`).join(', ')}). Al haber terminado, este flujo disponible representa tu mayor capacidad de ahorro real acumulada para acelerar tu patrimonio sin alterar tu estilo de vida.`,
      actionStep:
        'Transfiere el 100% de este flujo mensual liberado automáticamente a tu meta de ahorro o inversión para consolidar el efecto bola de nieve.',
      potentialSavingsCLP: totalAlreadyFreed,
      metrics: [
        { label: 'Flujo Liberado Acumulado', value: `${formatCLP(totalAlreadyFreed)}/mes` },
        ...(justEndedDebts.length > 0
          ? [{ label: 'Recién Liberado Este Mes', value: `${formatCLP(justEndedFreed)}/mes` }]
          : []),
        { label: 'Compromisos Extinguidos', value: `${alreadyEndedDebts.length}` },
      ],
    });
  }

  // 2. Cuotas activas actualmente que vencerán en el futuro
  const activeExpiringDebts = activeRecurring.filter(
    (i) => i.type === 'expense' && Boolean(i.end_date)
  );

  if (activeExpiringDebts.length > 0) {
    const totalFutureFreed = activeExpiringDebts.reduce((acc, i) => acc + i.amount, 0);

    insights.push({
      id: 'insight-snowball-future',
      category: 'deudas',
      priority: 5,
      tone: 'emerald',
      title: 'Próximos Vencimientos: Liberación Futura de Cuotas',
      badge: `+${formatCLP(totalFutureFreed)}/mes proyectado`,
      summary: `Al completar tus cuotas vigentes, liberarás otros ${formatCLP(totalFutureFreed)} mensuales de flujo limpio.`,
      detail: `Tienes compromisos con mes de término programado (${activeExpiringDebts.map((i) => `${i.title} hasta ${i.end_date}`).join(', ')}). Mantén la constancia hasta el último pago.`,
      actionStep:
        'Apenas expire cada cuota, redirige ese monto exacto al ahorro para no absorberlo en gastos cotidianos.',
      // No se computa en el mes actual porque aún es una obligación financiera vigente obligatoria.
      // Se activará como ahorro real una vez que el compromiso expire en su mes de término.
      metrics: [
        { label: 'Flujo Futuro por Liberarse', value: `${formatCLP(totalFutureFreed)}/mes` },
        { label: 'Cuotas en Curso', value: `${activeExpiringDebts.length}` },
      ],
    });
  }

  // =========================================================================
  // CORRELACIÓN 5: Auditoría de Suscripciones y Micro-Cargos Recurrentes
  // =========================================================================
  let subscriptionsTotal = 0;
  const subscriptionList: string[] = [];

  for (const item of activeRecurring) {
    if (item.type !== 'expense') continue;
    const isSub =
      item.category === 'suscripciones' ||
      matchesAny(item.title, SUBSCRIPTION_KEYWORDS);

    if (isSub) {
      subscriptionsTotal += item.amount;
      subscriptionList.push(item.title);
    }

    if (item.sub_items && item.sub_items.length > 0) {
      for (const sub of item.sub_items) {
        if (matchesAny(sub.name, SUBSCRIPTION_KEYWORDS)) {
          subscriptionsTotal += sub.amount;
          subscriptionList.push(sub.name);
        }
      }
    }
  }

  const subIncomeRatio =
    monthlyIncome > 0 ? (subscriptionsTotal / monthlyIncome) * 100 : 0;

  if (subscriptionsTotal >= 25000) {
    const annualSubscriptions = subscriptionsTotal * 12;
    const isHighSub = subIncomeRatio > 7;

    insights.push({
      id: 'insight-subscription-audit',
      category: 'habitos',
      priority: isHighSub ? 3 : 6,
      tone: isHighSub ? 'warning' : 'info',
      title: 'Auditoría de Suscripciones y Micro-Cargos',
      badge: `${formatCLP(subscriptionsTotal)}/mes`,
      summary: `Tus servicios digitales y membresías suman ${formatCLP(annualSubscriptions)} facturados al año.`,
      detail: `Mantienes ${subscriptionList.length > 0 ? subscriptionList.length : 'múltiples'} cargos recurrentes (${subscriptionList.slice(0, 4).join(', ')}${subscriptionList.length > 4 ? '...' : ''}). Los micro-cargos recurrentes erosionan silenciosamente tu flujo de caja libre.`,
      actionStep:
        'Revisa qué plataformas no utilizaste en los últimos 30 días y cancela o comparte planes familiares para optimizar costos.',
      potentialSavingsCLP: Math.round(subscriptionsTotal * 0.35),
      metrics: [
        { label: 'Costo Mensual Suscripciones', value: formatCLP(subscriptionsTotal) },
        { label: 'Impacto a 12 Meses', value: formatCLP(annualSubscriptions) },
        { label: '% de tu Sueldo Líquido', value: `${subIncomeRatio.toFixed(1)}%` },
      ],
    });
  }

  // =========================================================================
  // CORRELACIÓN 6: Índice de Rigidez Fija (Regla 50/30/20 Adaptada)
  // =========================================================================
  if (monthlyIncome > 0) {
    if (fixedRatio > 65) {
      insights.push({
        id: 'insight-rigidity-high',
        category: 'presupuesto',
        priority: 2,
        tone: 'warning',
        title: 'Alta Rigidez Operativa Mensual',
        badge: `${fixedRatio}% Comprometido`,
        summary: `Tus compromisos fijos absorben el ${fixedRatio}% de tus ingresos líquidos.`,
        detail: `La regla financiera óptima recomienda que los gastos fijos no superen el 50%-60% del ingreso. Con un ${fixedRatio}%, cualquier imprevisto de salud o laboral genera tensión inmediata en el presupuesto.`,
        actionStep:
          'Considera renegociar tarifas fijas (planes de internet, seguros, aranceles) o consolidar deudas para bajar la carga por debajo del 60%.',
        metrics: [
          { label: 'Gastos Fijos', value: formatCLP(monthlyFixedExpenses) },
          { label: 'Ingreso Líquido', value: formatCLP(monthlyIncome) },
          { label: 'Margen Libre Restante', value: `${100 - fixedRatio}%` },
        ],
      });
    } else if (fixedRatio <= 50 && fixedRatio > 0) {
      insights.push({
        id: 'insight-rigidity-optimal',
        category: 'presupuesto',
        priority: 7,
        tone: 'emerald',
        title: 'Estructura de Gastos Altamente Flexible',
        badge: `${fixedRatio}% Fijos (<50%)`,
        summary: `Tienes un perfil de gasto muy defensivo y de alta capacidad de acumulación.`,
        detail: `Solo el ${fixedRatio}% de tus ingresos está atado a compromisos fijos obligatorios (${formatCLP(monthlyFixedExpenses)}), dejándote un ${100 - fixedRatio}% de margen de maniobra para inversión y calidad de vida.`,
        actionStep:
          'Aprovecha este superávit para canalizar al menos un 25% directamente a instrumentos de ahorro e inversión a largo plazo.',
      });
    }
  }

  // =========================================================================
  // CORRELACIÓN 7: Ratio de Utilización de Cupo en Tarjetas de Crédito
  // =========================================================================
  let totalCreditLimit = 0;
  let totalCreditUsed = 0;

  for (const card of creditCards) {
    const cardLimit = card.credit_limit || 0;
    const cardItems = activeRecurring.filter((i) => i.account_id === card.id);
    const cardBilled = cardItems.reduce((acc, i) => acc + i.amount, 0);

    totalCreditLimit += cardLimit;
    totalCreditUsed += cardBilled;

    if (cardLimit > 0) {
      const cardUtilization = Math.round((cardBilled / cardLimit) * 100);
      if (cardUtilization > 35) {
        insights.push({
          id: `insight-card-utilization-${card.id}`,
          category: 'tarjetas',
          priority: 3,
          tone: 'warning',
          title: `Tensión en Cupo: ${card.name} al ${cardUtilization}%`,
          badge: `${cardUtilization}% Utilizado`,
          summary: `Has facturado ${formatCLP(cardBilled)} de un cupo total de ${formatCLP(cardLimit)}.`,
          detail: `Utilizar más del 30% del cupo de una tarjeta degrada tu puntaje de riesgo crediticio ante el sistema bancario chileno y disminuye tu capacidad de respuesta ante urgencias.`,
          actionStep: `Abona cuotas anticipadas o mantén el saldo facturado por debajo de ${formatCLP(Math.round(cardLimit * 0.3))} antes de tu fecha de cierre.`,
          metrics: [
            { label: 'Facturado Actual', value: formatCLP(cardBilled) },
            { label: 'Cupo Total', value: formatCLP(cardLimit) },
            { label: 'Límite Saludable (30%)', value: formatCLP(Math.round(cardLimit * 0.3)) },
          ],
        });
      }
    }
  }

  const averageCardUtilization =
    totalCreditLimit > 0
      ? Math.round((totalCreditUsed / totalCreditLimit) * 100)
      : 0;

  // =========================================================================
  // CORRELACIÓN 8: Optimización de Movilidad (Apps de Transporte vs Transporte Habitual)
  // =========================================================================
  let rideAppsTotal = 0;
  let publicTransportTotal = 0;

  for (const exp of periodVariables) {
    if (matchesAny(exp.title, RIDE_APP_KEYWORDS)) {
      rideAppsTotal += exp.amount;
    } else if (
      exp.category === 'transporte' ||
      matchesAny(exp.title, PUBLIC_TRANSPORT_KEYWORDS)
    ) {
      publicTransportTotal += exp.amount;
    }
  }

  for (const item of activeRecurring) {
    if (item.type !== 'expense') continue;
    if (matchesAny(item.title, RIDE_APP_KEYWORDS)) {
      rideAppsTotal += item.amount;
    } else if (
      item.category === 'transporte' ||
      matchesAny(item.title, PUBLIC_TRANSPORT_KEYWORDS)
    ) {
      publicTransportTotal += item.amount;
    }
  }

  const combinedTransport = rideAppsTotal + publicTransportTotal;
  if (rideAppsTotal >= 40000 && combinedTransport > 0) {
    const rideAppRatio = Math.round((rideAppsTotal / combinedTransport) * 100);
    const potentialTransportSavings = Math.round(rideAppsTotal * 0.35);

    insights.push({
      id: 'insight-transport-optimization',
      category: 'movilidad',
      priority: 5,
      tone: 'warning',
      title: 'Optimización de Movilidad Urbana',
      badge: `${rideAppRatio}% en Apps de Viaje`,
      summary: `Has gastado ${formatCLP(rideAppsTotal)} en Uber/DiDi/Cabify este periodo.`,
      detail: `Los viajes espontáneos en apps representan el ${rideAppRatio}% de tu presupuesto total de traslado. Planificar trayectos en horas valle o combinar con transporte público genera un ahorro significativo.`,
      actionStep: `Reducir 1 a 2 viajes de conveniencia por semana te ahorraría aprox. ${formatCLP(potentialTransportSavings)}/mes (${formatCLP(potentialTransportSavings * 12)} al año).`,
      potentialSavingsCLP: potentialTransportSavings,
      metrics: [
        { label: 'Gasto Apps de Viaje', value: formatCLP(rideAppsTotal) },
        { label: 'Gasto Transporte Habitual', value: formatCLP(publicTransportTotal) },
      ],
    });
  }

  // =========================================================================
  // CORRELACIÓN 9: Patrón de Fuga de Fin de Semana (Vie-Dom vs Lun-Jue)
  // =========================================================================
  let weekendExpensesTotal = 0;
  let weekdayExpensesTotal = 0;
  let validDateCount = 0;

  for (const exp of periodVariables) {
    if (!exp.date) continue;
    try {
      const parts = exp.date.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const day = d.getDay(); // 0 = Domingo, 5 = Viernes, 6 = Sábado
        validDateCount++;
        if (day === 0 || day === 5 || day === 6) {
          weekendExpensesTotal += exp.amount;
        } else {
          weekdayExpensesTotal += exp.amount;
        }
      }
    } catch {
      // Ignorar fechas mal formateadas
    }
  }

  const totalWeekendWeekday = weekendExpensesTotal + weekdayExpensesTotal;
  if (validDateCount >= 4 && totalWeekendWeekday >= 50000) {
    const weekendRatio = Math.round((weekendExpensesTotal / totalWeekendWeekday) * 100);
    if (weekendRatio >= 60) {
      const suggestedWeekendCap = Math.round(weekendExpensesTotal * 0.7);
      insights.push({
        id: 'insight-weekend-leak',
        category: 'habitos',
        priority: 5,
        tone: 'info',
        title: 'Concentración de Gasto en Fin de Semana',
        badge: `${weekendRatio}% Viernes a Domingo`,
        summary: `El ${weekendRatio}% de tus gastos variables (${formatCLP(weekendExpensesTotal)}) se concentra entre viernes y domingo.`,
        detail: `La distensión de fin de semana tiende a relajar el control presupuestario en salidas, delivery y ocio, reduciendo la liquidez disponible para la semana laboral.`,
        actionStep: `Define un tope recreativo semanal de ${formatCLP(suggestedWeekendCap)} para proteger tu presupuesto de lunes a jueves.`,
        potentialSavingsCLP: Math.round(weekendExpensesTotal * 0.25),
        metrics: [
          { label: 'Gasto Vie-Dom', value: formatCLP(weekendExpensesTotal) },
          { label: 'Gasto Lun-Jue', value: formatCLP(weekdayExpensesTotal) },
        ],
      });
    }
  }

  // =========================================================================
  // CORRELACIÓN 10: Escudo de Fondo de Emergencia Integral (Fijos + Variables)
  // =========================================================================
  const monthlyBurnRate = monthlyFixedExpenses + monthlyVariableExpenses;
  const emergencyMonths =
    monthlyBurnRate > 0 ? Number((totalLiquidSavings / monthlyBurnRate).toFixed(1)) : 0;

  if (monthlyBurnRate > 0) {
    const target3Months = monthlyBurnRate * 3;
    const target6Months = monthlyBurnRate * 6;

    if (emergencyMonths < 1) {
      insights.push({
        id: 'insight-emergency-critical',
        category: 'emergencia',
        priority: 1,
        tone: 'critical',
        title: 'Escudo de Emergencia Insuficiente (< 1 Mes)',
        badge: `${emergencyMonths} Meses de Cobertura`,
        summary: `Tus ahorros líquidos (${formatCLP(totalLiquidSavings)}) cubren menos de 30 días de tu costo de vida real (${formatCLP(monthlyBurnRate)}/mes).`,
        detail: `Cualquier imprevisto de salud, reparación del hogar o transición laboral te obligaría a recurrir a endeudamiento en tarjetas con tasas de interés elevadas.`,
        actionStep: `Prioriza construir tu primer escalón de seguridad de ${formatCLP(target3Months)} (3 meses) antes de realizar gastos discrecionales mayores.`,
        metrics: [
          { label: 'Ahorro Líquido Actual', value: formatCLP(totalLiquidSavings) },
          { label: 'Costo de Vida Mensual', value: formatCLP(monthlyBurnRate) },
          { label: 'Meta 3 Meses', value: formatCLP(target3Months) },
        ],
      });
    } else if (emergencyMonths < 3) {
      const gapTo3m = target3Months - totalLiquidSavings;
      insights.push({
        id: 'insight-emergency-building',
        category: 'emergencia',
        priority: 4,
        tone: 'warning',
        title: 'Fondo de Emergencia en Construcción',
        badge: `${emergencyMonths} de 3 Meses`,
        summary: `Tienes ${emergencyMonths} meses de respaldo. Te faltan ${formatCLP(gapTo3m)} para completar la meta base de 3 meses.`,
        detail: `Tu costo de vida real es de ${formatCLP(monthlyBurnRate)}/mes. Estás en buen camino, pero completar los 3 meses consolidará tu tranquilidad psicológica y financiera.`,
        actionStep: `Destina el 50% de tu flujo de caja libre mensual (${formatCLP(Math.max(0, freeCashFlow))}) exclusivamente a este fondo hasta alcanzar los ${formatCLP(target3Months)}.`,
        metrics: [
          { label: 'Cobertura Actual', value: `${emergencyMonths} meses` },
          { label: 'Meta 3 Meses', value: formatCLP(target3Months) },
          { label: 'Faltante para Meta', value: formatCLP(gapTo3m) },
        ],
      });
    } else if (emergencyMonths >= 3 && emergencyMonths < 6) {
      insights.push({
        id: 'insight-emergency-achieved-3m',
        category: 'emergencia',
        priority: 6,
        tone: 'emerald',
        title: 'Escudo Base de Emergencia Cumplido',
        badge: `${emergencyMonths} Meses Protegidos`,
        summary: `Tienes ${formatCLP(totalLiquidSavings)} en ahorro, garantizando más de un trimestre de supervivencia financiera completa.`,
        detail: `Cumples con el estándar recomendado por analistas de finanzas personales. Tu próximo horizonte es alcanzar los 6 meses (${formatCLP(target6Months)}) o diversificar en inversión de mayor retorno.`,
        actionStep: 'Mantén este capital protegido en instrumentos de retiro inmediato pero con devengo de intereses (4%+ anual).',
      });
    } else {
      insights.push({
        id: 'insight-emergency-top',
        category: 'emergencia',
        priority: 8,
        tone: 'emerald',
        title: 'Escudo de Independencia Financiera Sólido (6+ Meses)',
        badge: `${emergencyMonths} Meses Cubiertos`,
        summary: `Tu liquidez cubre ${emergencyMonths} meses de costo de vida sin necesidad de percibir ingresos.`,
        detail: `Excelente solidez. Puedes tolerar escenarios macroeconómicos adversos sin alterar tu bienestar. Cualquier nuevo excedente debería dirigirse a inversión patrimonial de mediano y largo plazo.`,
        actionStep:
          'Evalúa instrumentos de mayor horizonte (fondos indexados, cuentas de inversión) para el capital que supere los 6 meses de gastos.',
      });
    }
  }

  // =========================================================================
  // CORRELACIÓN 11: Metas en Pareja y Sinergia de Ahorro Compartido
  // =========================================================================
  const sharedSavings = savingsAccounts.filter(
    (a) =>
      Boolean(a.is_shared) ||
      Boolean(a.partner_name) ||
      Boolean(a.partner_user_id) ||
      matchesAny(a.name, ['pareja', 'juntos', 'nosotros', 'matrimonio', 'casa', 'viaje'])
  );

  if (sharedSavings.length > 0) {
    const totalSharedBalance = sharedSavings.reduce(
      (acc, a) => acc + a.current_balance,
      0
    );
    insights.push({
      id: 'insight-couple-synergy',
      category: 'ahorro',
      priority: 6,
      tone: 'emerald',
      title: 'Sinergia en Metas de Ahorro en Pareja',
      badge: `${sharedSavings.length} Metas Compartidas`,
      summary: `Tienen ${formatCLP(totalSharedBalance)} acumulados en proyectos conjuntos (${sharedSavings.map((a) => a.name).join(', ')}).`,
      detail: `El ahorro compartido duplica la velocidad de acumulación y genera alineación de expectativas financieras en el hogar. La transparencia en gastos fijos y variables es el pilar de este éxito.`,
      actionStep:
        'Revisen juntos la pestaña de Ahorro al inicio de cada mes para celebrar los hitos alcanzados y proyectar la fecha de cumplimiento.',
      metrics: [
        { label: 'Capital Acumulado en Pareja', value: formatCLP(totalSharedBalance) },
        { label: 'Cuentas Compartidas', value: `${sharedSavings.length}` },
      ],
    });
  }

  // =========================================================================
  // CORRELACIÓN 12: Préstamos a Terceros vs Margen Operativo
  // =========================================================================
  let totalLoansGiven = 0;
  for (const exp of periodVariables) {
    if (exp.category === 'prestamo' || matchesAny(exp.title, ['prestamo', 'préstamo', 'preste'])) {
      totalLoansGiven += exp.amount;
    }
  }
  for (const item of activeRecurring) {
    if (
      item.type === 'expense' &&
      (item.category === 'prestamo' || matchesAny(item.title, ['prestamo', 'préstamo']))
    ) {
      totalLoansGiven += item.amount;
    }
  }

  if (totalLoansGiven > 0 && freeCashFlow > 0) {
    const loanRatio = Math.round((totalLoansGiven / freeCashFlow) * 100);
    if (loanRatio >= 30) {
      insights.push({
        id: 'insight-loans-third-parties',
        category: 'presupuesto',
        priority: 4,
        tone: 'warning',
        title: 'Préstamos a Terceros Comprometen tu Margen',
        badge: `${loanRatio}% del Flujo Libre`,
        summary: `Has destinado ${formatCLP(totalLoansGiven)} a préstamos personales este periodo.`,
        detail: `Prestar dinero a amigos o familiares sin un cronograma estricto de devolución puede generar descalces de liquidez en tu propio presupuesto mensual.`,
        actionStep:
          'Fija una fecha límite clara de reintegro y evita prestar montos que comprometan tus propios compromisos fijos o fondo de emergencia.',
        metrics: [
          { label: 'Monto Prestado', value: formatCLP(totalLoansGiven) },
          { label: 'Flujo Libre Mensual', value: formatCLP(freeCashFlow) },
        ],
      });
    }
  }

  // =========================================================================
  // CORRELACIÓN 13: Auditoría de Futuras Compras y Suscripciones en Evaluación
  // =========================================================================
  const activeWishlist = futurePurchases.filter((fp) => fp.status !== 'purchased');

  if (activeWishlist.length > 0 && monthlyIncome > 0) {
    // 13.1 Alerta preventiva de Sobrecarga de Suscripciones (> 8% del ingreso sumando actuales + en evaluación)
    const wishlistSubscriptions = activeWishlist.filter(
      (fp) => fp.payment_mode === 'recurring_subscription' || fp.category === 'suscripcion'
    );
    const wishlistSubMonthlyTotal = wishlistSubscriptions.reduce(
      (sum, fp) => sum + (fp.amount || 0),
      0
    );
    const combinedSubMonthly = subscriptionsTotal + wishlistSubMonthlyTotal;
    const combinedSubRatio = (combinedSubMonthly / monthlyIncome) * 100;

    if (wishlistSubMonthlyTotal > 0 && combinedSubRatio > 8) {
      insights.push({
        id: 'insight-wishlist-subscription-overload',
        category: 'habitos',
        priority: 3,
        tone: 'warning',
        title: 'Alerta Preventiva: Sobrecarga de Suscripciones',
        badge: `${combinedSubRatio.toFixed(1)}% del Ingreso`,
        summary: `Sumar tus nuevas suscripciones en evaluación (+${formatCLP(wishlistSubMonthlyTotal)}/mes) elevaría tu carga mensual en membresías a ${formatCLP(combinedSubMonthly)}/mes (${formatCLP(combinedSubMonthly * 12)}/año).`,
        detail: `El umbral saludable para suscripciones y servicios digitales es mantenerlos bajo el 8% de tu sueldo líquido. Actualmente destinas ${formatCLP(subscriptionsTotal)}/mes y tienes ${wishlistSubscriptions.length} ${wishlistSubscriptions.length === 1 ? 'suscripción proyectada' : 'suscripciones proyectadas'} (${wishlistSubscriptions.map((s) => s.title).join(', ')}).`,
        actionStep:
          'Aplica la regla "1 entra, 1 sale": antes de contratar una nueva suscripción en Compras Futuras, da de baja otra plataforma que uses poco.',
        potentialSavingsCLP: wishlistSubMonthlyTotal,
        metrics: [
          { label: 'Suscripciones Actuales', value: formatCLP(subscriptionsTotal) },
          { label: 'En Evaluación', value: `+${formatCLP(wishlistSubMonthlyTotal)}/mes` },
          { label: 'Costo Combinado Anual', value: formatCLP(combinedSubMonthly * 12) },
        ],
      });
    }

    // 13.2 Insight positivo (Luz Verde) cuando existe superávit holgado y un ítem de Prioridad Alta viable
    const highPriorityItems = activeWishlist.filter((fp) => fp.priority === 'high');
    if (freeCashFlow > 0 && highPriorityItems.length > 0) {
      for (const highItem of highPriorityItems) {
        const evalResult = evaluateFuturePurchase(highItem, {
          period,
          accounts,
          recurringItems,
          variableExpenses,
        });
        if (evalResult.verdict === 'viable_today') {
          insights.push({
            id: `insight-wishlist-greenlight-${highItem.id}`,
            category: 'presupuesto',
            priority: 5,
            tone: 'emerald',
            title: `Luz Verde: Este mes puedes adquirir ${highItem.title} sin afectar tu meta de ahorro`,
            badge: 'Prioridad Alta · Viable',
            summary: `Tu holgura mensual de ${formatCLP(freeCashFlow)} permite ejecutar "${highItem.title}" (${formatCLP(highItem.amount)}) manteniendo un presupuesto diario saludable de ${formatCLP(evalResult.cashPath.resultingSafePerDay)}/día.`,
            detail: evalResult.verdictExplanation,
            actionStep:
              'Puedes marcarlo como comprado en 1 toque desde la pestaña Compras Futuras para registrarlo automáticamente en tus finanzas.',
            metrics: [
              { label: 'Costo Ítem', value: formatCLP(highItem.amount) },
              { label: 'Margen Seguro Hoy', value: formatCLP(evalResult.cashPath.safeAvailableToday) },
              { label: 'Safe-to-Spend Post-Compra', value: `${formatCLP(evalResult.cashPath.resultingSafePerDay)}/día` },
            ],
          });
          break;
        }
      }
    }
  }

  // =========================================================================
  // CÁLCULO DEL SCORE DE SALUD FINANCIERA (0 - 100)
  // =========================================================================
  let score = 85; // Base neutra

  // Penalizaciones cuantitativas
  if (fixedRatio > 65) score -= 20;
  else if (fixedRatio > 55) score -= 10;
  else if (fixedRatio <= 45 && fixedRatio > 0) score += 5;

  if (cardFoodChargesWithInstallments.length > 0) score -= 20;
  if (averageCardUtilization > 40) score -= 15;
  if (deliveryRatio > 40 && deliveryTotal > 50000) score -= 10;

  if (emergencyMonths < 1) score -= 25;
  else if (emergencyMonths < 3) score -= 10;
  else if (emergencyMonths >= 6) score += 10;
  else if (emergencyMonths >= 3) score += 5;

  if (freeCashFlow < 0) score -= 25;
  else if (freeCashFlowRatio >= 20) score += 5;

  // Clampear entre 10 y 100
  const overallScore = Math.max(10, Math.min(100, Math.round(score)));

  let healthStatus: FinancialIntelligenceReport['healthStatus'] = 'Estable';
  if (overallScore >= 80) healthStatus = 'Óptima';
  else if (overallScore >= 65) healthStatus = 'Estable';
  else if (overallScore >= 45) healthStatus = 'Requiere Atención';
  else healthStatus = 'Crítica';

  // Ordenar insights por prioridad (1 = crítico primero)
  insights.sort((a, b) => a.priority - b.priority);

  // Calcular ahorros potenciales totales identificados
  const totalPotentialSavingsMonthly = insights.reduce(
    (acc, i) => acc + (i.potentialSavingsCLP || 0),
    0
  );

  return {
    insights,
    overallScore,
    healthStatus,
    totalAnalyzedExpensesCLP: totalAnalyzedExpenses,
    totalMonthlyIncomeCLP: monthlyIncome,
    totalPotentialSavingsMonthlyCLP: totalPotentialSavingsMonthly,
    totalPotentialSavingsAnnualCLP: totalPotentialSavingsMonthly * 12,
    keyRatios: {
      fixedCostRatio: fixedRatio,
      freeCashFlowCLP: freeCashFlow,
      freeCashFlowRatio,
      emergencyMonths,
      deliveryRatio,
      cardUtilizationAverage: averageCardUtilization,
    },
  };
}
