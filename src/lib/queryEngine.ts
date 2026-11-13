import {
  Account,
  FuturePurchase,
  MonthlyPayment,
  RecurringItem,
  VariableExpense,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import {
  accountToSavingsAccount,
  buildMonthlySurplusList,
  calculateConsolidatedForecast,
  calculateCreditCardMetrics,
  diffPeriodsInMonths,
  evaluateFuturePurchase,
  formatPeriodFull,
  getCurrentPeriod,
  getDebtReleaseMilestones,
  getExpiringExpensesInHorizon,
  isItemActiveInMonth,
  shiftPeriod,
  toYearMonth,
} from '@/lib/finance';
import {
  FinancialIntelligenceReport,
  generateFinancialIntelligence,
} from '@/lib/intelligence';
import rawFinanzAIKnowledge from '@/data/finanzaiKnowledge.json';
import type { FinanzAIKnowledge, IntentKnowledgeRule } from '@/types/finanzaiKnowledge';

const FINANZAI_KNOWLEDGE = rawFinanzAIKnowledge as unknown as FinanzAIKnowledge;

/**
 * Devuelve la base de conocimiento declarativa (vocabulario, entidades y contexto) usada por FinanzAI.
 */
export function getFinanzAIKnowledge(): FinanzAIKnowledge {
  return FINANZAI_KNOWLEDGE;
}

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
  | 'wishlist_evaluation'
  | 'amount_only'
  | 'fallback';

export interface QueryResultMetric {
  label: string;
  value: string;
  tone?: 'emerald' | 'amber' | 'coral' | 'blue' | 'neutral';
}

export type ProposedChatActionType =
  | 'register_variable_expense'
  | 'save_future_purchase'
  | 'mark_recurring_paid'
  | 'navigate_tab';

export interface ProposedChatAction {
  id: string;
  type: ProposedChatActionType;
  label: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'emerald' | 'amber' | 'blue';
  payload: {
    title?: string;
    amount?: number;
    category?: string;
    account_id?: string | null;
    period?: string;
    payment_mode?: 'one_time_cash' | 'installments' | 'recurring_subscription';
    installments_count?: number;
    target_account_id?: string | null;
    target_type?: 'recurring_item' | 'loan_installment' | 'credit_card';
    target_id?: string;
    tab?: 'summary' | 'wallet' | 'fixed' | 'cards' | 'savings' | 'future_purchases';
  };
}

export interface ExtractedQueryEntities {
  amount: number | null;
  horizon: TargetHorizon | null;
  category: string | null;
  paymentMode: 'cash' | 'installments' | null;
  installmentsCount: number | null;
  cardBrand: 'santander' | 'falabella' | 'other' | null;
  matchedCardId: string | null;
  matchedCardName: string | null;
  matchedFuturePurchase: FuturePurchase | null;
  suggestedTitle: string | null;
}

export interface ConversationSlots {
  lastIntent?: QueryIntent;
  lastAmount?: number | null;
  lastHorizon?: TargetHorizon | null;
  lastItemName?: string | null;
  lastCardId?: string | null;
  lastCardBrand?: 'santander' | 'falabella' | 'other' | null;
  lastPaymentMode?: 'cash' | 'installments' | null;
  lastInstallments?: number | null;
  lastCategory?: string | null;
  lastFuturePurchaseId?: string | null;
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
  proposedActions?: ProposedChatAction[];
  extractedEntities?: ExtractedQueryEntities;
  updatedSlots?: ConversationSlots;
}

export interface QueryContextData {
  accounts: Account[];
  recurringItems: RecurringItem[];
  variableExpenses: VariableExpense[];
  payments?: MonthlyPayment[];
  futurePurchases?: FuturePurchase[];
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
 * Parsea montos escritos en jerga chilena ('palos', 'lucas', 'gambas', 'k', 'mil') o en formato numérico ($50.000, 50000).
 */
export function extractAmountFromQuery(rawText: string): number | null {
  const text = normalizeQueryText(rawText);

  // 1. Detectar multiplicadores coloquiales configurados en finanzaiKnowledge.json (de mayor a menor factor)
  const sortedMultipliers = [...FINANZAI_KNOWLEDGE.slangAndUnits.multipliers].sort(
    (a, b) => b.factor - a.factor
  );
  for (const rule of sortedMultipliers) {
    if (!rule.tokens.length) continue;
    const escapedTokens = rule.tokens
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const regex = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:${escapedTokens})\\b`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        return Math.round(num * rule.factor);
      }
    }
  }

  // 2. Detectar números formateados chilenos (ej. "$45.000", "45.000", "45000")
  const numRegex = /(?:\$)?\b(\d{1,3}(?:\.\d{3})+|\d{4,9})\b/;
  const numMatch = rawText.match(numRegex);
  if (numMatch && numMatch[1]) {
    const cleanedStr = numMatch[1].replace(/\./g, '');
    const parsed = parseInt(cleanedStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // 3. Si es un número simple (>= 100)
  const smallNumMatch = text.match(/\b(\d{2,3})\b/);
  if (smallNumMatch && smallNumMatch[1]) {
    const smallParsed = parseInt(smallNumMatch[1], 10);
    if (!isNaN(smallParsed) && smallParsed >= 100) {
      return smallParsed;
    }
  }

  return null;
}

function levenshteinDistance(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function matchesTerm(normalized: string, term: string, matchMode: 'includes' | 'boundary' = 'includes'): boolean {
  if (matchMode === 'boundary') {
    return (
      normalized === term ||
      normalized.startsWith(`${term} `) ||
      normalized.endsWith(` ${term}`)
    );
  }
  if (term.length <= 3) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
  }
  return normalized.includes(term);
}

/**
 * Evalúa coincidencia exacta o tolerante a errores tipográficos leves (Levenshtein <= 1 ó 2).
 * Retorna 1 para coincidencia exacta, 0.7 para fuzzy match y 0 si no coincide.
 */
function scoreTermMatch(
  normalized: string,
  tokens: string[],
  term: string,
  matchMode: 'includes' | 'boundary' = 'includes'
): number {
  if (matchesTerm(normalized, term, matchMode)) {
    return 1;
  }
  if (matchMode === 'boundary' || term.length < 6) {
    return 0;
  }

  const termWords = term.split(' ').filter((w) => w.length >= 6);
  if (termWords.length === 0) return 0;

  // Para palabras completas >= 6 chars, verificar coincidencia exacta o typo leve (Levenshtein <= 1 ó 2)
  let matchedWords = 0;
  for (const tw of termWords) {
    const maxDist = tw.length >= 9 ? 2 : 1;
    const hit = tokens.some((tok) => {
      if (tok.length < 6) return false;
      if (tok.includes(tw) || tw.includes(tok)) return true;
      return levenshteinDistance(tok, tw, maxDist) <= maxDist;
    });
    if (hit) matchedWords++;
  }

  if (matchedWords === termWords.length) {
    return 0.7;
  }
  return 0;
}

const STOPWORDS_TITLE = new Set([
  'puedo', 'podria', 'debo', 'conviene', 'me', 'alcanza', 'para', 'comprar', 'gastar',
  'pagar', 'hacer', 'ir', 'salir', 'en', 'un', 'una', 'unos', 'unas', 'el', 'la', 'los',
  'las', 'de', 'del', 'con', 'sin', 'hoy', 'ahora', 'este', 'mes', 'por', 'favor',
  'cuotas', 'cuota', 'contado', 'si', 'que', 'cuanto', 'y', 'o', 'a', 'mi', 'mis',
]);

function capitalizeWords(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function matchFuturePurchaseFromQuery(
  normalized: string,
  tokens: string[],
  futurePurchases?: FuturePurchase[]
): FuturePurchase | null {
  if (!futurePurchases || futurePurchases.length === 0) return null;
  const activeItems = futurePurchases.filter((fp) => fp.status !== 'purchased');
  if (activeItems.length === 0) return null;

  let bestItem: FuturePurchase | null = null;
  let bestScore = 0;

  for (const item of activeItems) {
    const normTitle = normalizeQueryText(item.title);
    if (!normTitle) continue;

    if (normalized.includes(normTitle)) {
      const score = 100 + normTitle.length;
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
      continue;
    }

    const titleTokens = normTitle
      .split(' ')
      .filter((t) => t.length >= 3 && !STOPWORDS_TITLE.has(t));
    if (titleTokens.length === 0) continue;

    let hits = 0;
    for (const tt of titleTokens) {
      const exactHit = tokens.some((qt) => qt === tt || (tt.length >= 5 && qt.includes(tt)));
      if (exactHit) {
        hits += 1;
      } else if (tt.length >= 5) {
        const fuzzyHit = tokens.some((qt) => qt.length >= 5 && levenshteinDistance(qt, tt, 1) <= 1);
        if (fuzzyHit) hits += 0.8;
      }
    }

    const coverage = hits / titleTokens.length;
    if ((coverage >= 0.6 && hits >= 1) || hits >= 2) {
      const score = coverage * 60 + hits * 10;
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }
  }

  return bestItem;
}

/**
 * Extrae múltiples entidades simultáneas de la frase: monto, horizonte, categoría,
 * modalidad (contado / cuotas), tarjeta e ítem específico de Futuras Compras.
 */
export function extractQueryEntities(
  rawText: string,
  context: Pick<QueryContextData, 'accounts' | 'futurePurchases' | 'period'>
): ExtractedQueryEntities {
  const period = context.period || getCurrentPeriod();
  const normalized = normalizeQueryText(rawText);
  const tokens = normalized.split(' ').filter(Boolean);

  const amount = extractAmountFromQuery(rawText);
  const horizon = extractTargetHorizonFromQuery(rawText, period);

  // 1. Modalidad de pago y número de cuotas
  let paymentMode: 'cash' | 'installments' | null = null;
  let installmentsCount: number | null = null;

  const installmentsMatch = normalized.match(/\b(?:en\s+)?(\d{1,2})\s+cuotas?\b/);
  if (installmentsMatch && installmentsMatch[1]) {
    const parsed = parseInt(installmentsMatch[1], 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) {
      paymentMode = parsed === 1 ? 'cash' : 'installments';
      installmentsCount = parsed;
    }
  } else if (
    FINANZAI_KNOWLEDGE.entities.paymentModes.cash.some((term) => matchesTerm(normalized, term))
  ) {
    paymentMode = 'cash';
    installmentsCount = 1;
  } else if (
    FINANZAI_KNOWLEDGE.entities.paymentModes.installments.some((term) => matchesTerm(normalized, term))
  ) {
    paymentMode = 'installments';
  }

  // 2. Marca y cuenta de tarjeta de crédito
  let cardBrand: 'santander' | 'falabella' | 'other' | null = null;
  let matchedCardId: string | null = null;
  let matchedCardName: string | null = null;

  const creditCards = (context.accounts || []).filter((a) => a.type === 'credit_card');
  for (const card of creditCards) {
    const cardNorm = normalizeQueryText(card.name);
    const cardWords = cardNorm.split(' ').filter((w) => w.length >= 3);
    if (
      normalized.includes(cardNorm) ||
      cardWords.some((cw) => tokens.some((qt) => qt === cw || (cw.length >= 5 && levenshteinDistance(qt, cw, 1) <= 1)))
    ) {
      matchedCardId = card.id;
      matchedCardName = card.name;
      break;
    }
  }

  for (const [brand, aliases] of Object.entries(FINANZAI_KNOWLEDGE.entities.cardBrands) as [
    'santander' | 'falabella' | 'other',
    string[]
  ][]) {
    if (aliases.some((alias) => scoreTermMatch(normalized, tokens, alias) > 0)) {
      cardBrand = brand;
      if (!matchedCardId) {
        const cardByBrand = creditCards.find((c) => {
          const cn = normalizeQueryText(c.name);
          if (c.card_brand === brand) return true;
          return aliases.some((a) => cn.includes(a));
        });
        if (cardByBrand) {
          matchedCardId = cardByBrand.id;
          matchedCardName = cardByBrand.name;
        }
      }
      break;
    }
  }

  // 3. Categoría semántica (aliases, comercios e idiomas)
  let category: string | null = null;
  let matchedMerchantOrAlias: string | null = null;

  for (const [catKey, catRule] of Object.entries(FINANZAI_KNOWLEDGE.entities.categories)) {
    const merchantHit = catRule.merchants.find((m) => scoreTermMatch(normalized, tokens, m) > 0);
    if (merchantHit) {
      category = catKey;
      matchedMerchantOrAlias = merchantHit;
      break;
    }
    const aliasHit = catRule.aliases.find((a) => scoreTermMatch(normalized, tokens, a) > 0);
    if (aliasHit) {
      category = catKey;
      matchedMerchantOrAlias = aliasHit;
      break;
    }
  }

  if (!category) {
    for (const [idiom, rule] of Object.entries(FINANZAI_KNOWLEDGE.slangAndUnits.idioms)) {
      if (rule.category && matchesTerm(normalized, idiom)) {
        category = rule.category;
        matchedMerchantOrAlias = idiom;
        break;
      }
    }
  }

  // 4. Ítem específico de Futuras Compras
  const matchedFuturePurchase = matchFuturePurchaseFromQuery(
    normalized,
    tokens,
    context.futurePurchases
  );

  // 5. Título sugerido para Action Cards
  let suggestedTitle: string | null = matchedFuturePurchase?.title || null;
  if (!suggestedTitle && matchedMerchantOrAlias) {
    suggestedTitle = capitalizeWords(matchedMerchantOrAlias);
  }
  if (!suggestedTitle) {
    const objectMatch = normalized.match(
      /(?:comprar|gastar(?:\s+en)?|pagar)\s+(?:un|una|unos|unas|el|la|los|las)?\s*([a-z0-9\s]{3,32})/
    );
    if (objectMatch && objectMatch[1]) {
      const cleanedObj = objectMatch[1]
        .replace(/\b(?:de|por|en|con|hoy|ahora)\b.*$/i, '')
        .replace(/\d+(?:[.,]\d+)?\s*(?:lucas|palos|gambas|mil|k)?/gi, '')
        .trim();
      if (cleanedObj.length >= 3) {
        suggestedTitle = capitalizeWords(cleanedObj);
      }
    }
  }

  return {
    amount,
    horizon,
    category,
    paymentMode,
    installmentsCount,
    cardBrand,
    matchedCardId,
    matchedCardName,
    matchedFuturePurchase,
    suggestedTitle,
  };
}

interface ClassificationOutcome {
  intent: QueryIntent;
  isAmbiguous: boolean;
  candidateIntents: QueryIntent[];
}

function classifyQueryIntentInternal(
  normalized: string,
  amount: number | null,
  horizon: TargetHorizon | null
): ClassificationOutcome {
  const { intents, slangAndUnits } = FINANZAI_KNOWLEDGE;
  const tokens = normalized.split(' ').filter(Boolean);

  const scored: { intent: QueryIntent; score: number; priority: number; hadStrong: boolean }[] = [];

  // Precalcular hints provenientes de modismos chilenos detectados
  const idiomBoosts: Partial<Record<QueryIntent, number>> = {};
  for (const [idiom, rule] of Object.entries(slangAndUnits.idioms)) {
    if (matchesTerm(normalized, idiom) && rule.hintIntents) {
      for (const hintIntent of rule.hintIntents) {
        idiomBoosts[hintIntent] = (idiomBoosts[hintIntent] || 0) + 14;
      }
    }
  }

  for (const [rawIntent, rule] of Object.entries(intents) as [QueryIntent, IntentKnowledgeRule][]) {
    if (!rule || rawIntent === 'greeting_help') continue;

    // Si la intención exige monto presente y no hay monto, la omitimos
    if (rule.requiresAmount && amount === null) continue;

    const matchMode = rule.matchMode || 'includes';
    let signalScore = 0;
    let hadStrong = false;

    for (const phrase of rule.strongPhrases) {
      const factor = scoreTermMatch(normalized, tokens, phrase, matchMode);
      if (factor > 0) {
        signalScore += Math.round(42 * factor);
        if (factor === 1) hadStrong = true;
      }
    }

    for (const kw of rule.keywords) {
      const factor = scoreTermMatch(normalized, tokens, kw, matchMode);
      if (factor > 0) {
        signalScore += Math.round(18 * factor);
      }
    }

    signalScore += idiomBoosts[rawIntent] || 0;

    // Si no hubo ninguna señal léxica ni idiomática, no aplicamos boosts de contexto solos
    if (signalScore <= 0) continue;

    if (rule.negativeKeywords) {
      for (const neg of rule.negativeKeywords) {
        if (matchesTerm(normalized, neg)) {
          signalScore -= 45;
        }
      }
    }

    if (signalScore <= 0) continue;

    if (horizon !== null && rule.requiresHorizonBoost) {
      signalScore += rule.requiresHorizonBoost;
    }

    if (amount !== null && rule.requiresAmountBoost) {
      signalScore += rule.requiresAmountBoost;
    }

    scored.push({
      intent: rawIntent,
      score: signalScore,
      priority: rule.priority,
      hadStrong,
    });
  }

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.priority - a.priority));

  if (scored.length > 0) {
    const top = scored[0];
    const second = scored[1];
    const isAmbiguous =
      Boolean(second) &&
      !top.hadStrong &&
      top.score < 32 &&
      top.score - second.score <= 6;

    return {
      intent: top.intent,
      isAmbiguous,
      candidateIntents: scored.slice(0, 2).map((s) => s.intent),
    };
  }

  // Saludos, bienvenida y ayuda general (si no hubo otra intención financiera)
  const greetingRule = intents.greeting_help;
  if (greetingRule) {
    const greetingMatched =
      greetingRule.strongPhrases.some((kw) => matchesTerm(normalized, kw, 'includes')) ||
      greetingRule.keywords.some((kw) => matchesTerm(normalized, kw, greetingRule.matchMode || 'boundary'));
    if (greetingMatched) {
      return { intent: 'greeting_help', isAmbiguous: false, candidateIntents: ['greeting_help'] };
    }
  }

  // Solo ingresó un monto sin verbo rector (ej. "$60.000", "50 lucas", "2 palos")
  const nonAmountText = normalized.replace(/\d+(?:[.,]\d+)?/g, '').trim();
  const isMultiplierOnly = FINANZAI_KNOWLEDGE.slangAndUnits.multipliers.some((m) =>
    m.tokens.includes(nonAmountText)
  );
  if (amount !== null && (nonAmountText.length <= 5 || isMultiplierOnly)) {
    return { intent: 'amount_only', isAmbiguous: false, candidateIntents: ['amount_only'] };
  }

  // Fallback para consultas no reconocidas
  return { intent: 'fallback', isAmbiguous: false, candidateIntents: [] };
}

/**
 * Clasifica la intención de la consulta usando la base de conocimiento declarativa (finanzaiKnowledge.json)
 * con scoring ponderado por frases fuertes, keywords, tolerancia a typos (Levenshtein), modismos y contexto.
 */
export function classifyQueryIntent(
  normalized: string,
  amount: number | null,
  horizon: TargetHorizon | null
): QueryIntent {
  return classifyQueryIntentInternal(normalized, amount, horizon).intent;
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
export function solveCreditCardDetails(
  context: QueryContextData,
  entities?: ExtractedQueryEntities
): QueryEngineResult {
  const { accounts, recurringItems } = context;
  const period = context.period || getCurrentPeriod();
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
      proposedActions: [
        {
          id: 'nav-cards-empty',
          type: 'navigate_tab',
          label: 'Ir a Tarjetas',
          tone: 'blue',
          payload: { tab: 'cards' },
        },
      ],
    };
  }

  const targetCards = entities?.matchedCardId
    ? creditCards.filter((c) => c.id === entities.matchedCardId)
    : creditCards;
  const cardsToShow = targetCards.length > 0 ? targetCards : creditCards;

  const metricsList = cardsToShow.map((c) => ({
    card: c,
    metrics: calculateCreditCardMetrics(c, recurringItems, period),
  }));

  const breakdownLines = metricsList.map(({ card, metrics }) => {
    const cutStr = card.billing_day ? `Día ${card.billing_day} de cada mes` : 'No configurado';
    return `• **${card.name}**: Cupo Total: ${formatCLP(metrics.creditLimit)} | Usado: ${formatCLP(metrics.usedAmount)} (${metrics.usagePercent}%) | Disponible: ${formatCLP(metrics.availableCredit)} | Corte: ${cutStr}`;
  });

  const totalLimit = metricsList.reduce((sum, m) => sum + m.metrics.creditLimit, 0);
  const totalUsed = metricsList.reduce((sum, m) => sum + m.metrics.usedAmount, 0);
  const totalAvailable = Math.max(0, totalLimit - totalUsed);
  const singleCard = cardsToShow.length === 1 ? cardsToShow[0] : null;

  return {
    intent: 'credit_card_details',
    title: singleCard
      ? `Cupo y Facturación · ${singleCard.name}`
      : 'Cupos y Facturación de Tarjetas de Crédito',
    verdict: `Cupo disponible${singleCard ? ` (${singleCard.name})` : ' total'}: ${formatCLP(totalAvailable)} de ${formatCLP(totalLimit)}`,
    verdictTone: totalUsed / (totalLimit || 1) > 0.5 ? 'amber' : 'emerald',
    recommendation: singleCard
      ? `Tu tarjeta **${singleCard.name}** tiene **${formatCLP(totalAvailable)} disponibles** de un cupo de **${formatCLP(totalLimit)}** (uso actual: ${formatCLP(totalUsed)}).`
      : `Tienes **${creditCards.length} tarjetas registradas** con un cupo total de **${formatCLP(totalLimit)}**. Actualmente tienes **${formatCLP(totalAvailable)} disponibles** y un uso acumulado de ${formatCLP(totalUsed)}.`,
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
    actionLabel: 'Ver Tarjetas',
    actionType: 'view_cards',
    proposedActions: [
      {
        id: 'nav-cards',
        type: 'navigate_tab',
        label: singleCard ? `Abrir ${singleCard.name}` : 'Ir a Tarjetas',
        tone: 'blue',
        payload: { tab: 'cards' },
      },
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

function mapToFuturePurchaseCategory(
  cat?: string | null
): 'ropa' | 'accesorios' | 'tecnologia' | 'suscripcion' | 'hogar' | 'experiencias' | 'otros' {
  if (!cat) return 'otros';
  if (cat === 'entretenimiento' || cat === 'alimentacion') return 'experiencias';
  if (cat === 'vivienda' || cat === 'servicios') return 'hogar';
  if (cat === 'suscripciones') return 'suscripcion';
  return 'otros';
}

export function solveWhatIfSpend(
  amount: number,
  accounts: Account[],
  recurringItems: RecurringItem[],
  period: string,
  dailyBudgetSuggested: number,
  payments?: MonthlyPayment[],
  variableExpenses?: VariableExpense[],
  entities?: ExtractedQueryEntities
): QueryEngineResult {
  const checkingBalance = getCheckingLiquidBalance(accounts, variableExpenses, period);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();

  const currentAvailableMargin = checkingBalance - pendingFixed;
  const currentDailyBudget = Math.max(0, Math.round(currentAvailableMargin / remainingDays));

  const isInstallments = entities?.paymentMode === 'installments';
  const installmentsCount = isInstallments ? Math.max(2, entities?.installmentsCount || 3) : 1;
  const effectiveMonthlyImpact = isInstallments ? Math.round(amount / installmentsCount) : amount;

  const newAvailableMargin = currentAvailableMargin - effectiveMonthlyImpact;
  const newDailyBudget = Math.max(0, Math.round(newAvailableMargin / remainingDays));

  const formattedSpend = formatCLP(amount);
  const formattedMonthly = formatCLP(effectiveMonthlyImpact);
  const itemTitle = entities?.suggestedTitle || 'Gasto desde FinanzAI';
  const itemCategory = entities?.category || 'general';
  const primaryChecking = accounts.find((a) => a.type === 'checking');

  // Si se mencionó tarjeta o cuotas, verificar cupo disponible en la tarjeta correspondiente
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const selectedCard =
    (entities?.matchedCardId
      ? creditCards.find((c) => c.id === entities.matchedCardId)
      : undefined) || creditCards[0];

  const cardMetrics = selectedCard
    ? calculateCreditCardMetrics(selectedCard, recurringItems, period)
    : null;
  const lacksCardQuota =
    isInstallments && cardMetrics !== null && cardMetrics.availableCredit < amount;

  const saveFutureAction: ProposedChatAction = {
    id: `save-fp-${amount}-${installmentsCount}`,
    type: 'save_future_purchase',
    label: `Guardar en Futuras Compras (${formattedSpend})`,
    description: isInstallments
      ? `Planificar "${itemTitle}" en ${installmentsCount} cuotas de ${formattedMonthly}/mes.`
      : `Añadir "${itemTitle}" a Compras Futuras para evaluar su momento óptimo.`,
    confirmLabel: 'Confirmar y guardar',
    tone: 'blue',
    payload: {
      title: itemTitle,
      amount,
      category: mapToFuturePurchaseCategory(itemCategory),
      payment_mode: isInstallments ? 'installments' : 'one_time_cash',
      installments_count: installmentsCount,
      target_account_id: isInstallments ? selectedCard?.id || null : primaryChecking?.id || null,
    },
  };

  const registerExpenseAction: ProposedChatAction = {
    id: `reg-var-${amount}`,
    type: 'register_variable_expense',
    label: `Registrar gasto de ${formattedSpend}`,
    description: `Descuenta ${formattedSpend} como "${itemTitle}" (${itemCategory})${
      primaryChecking ? ` en ${primaryChecking.name}` : ''
    }.`,
    confirmLabel: 'Confirmar registro',
    tone: 'emerald',
    payload: {
      title: itemTitle,
      amount,
      category: itemCategory,
      account_id: primaryChecking?.id || null,
      period,
    },
  };

  if (newAvailableMargin < 0 || lacksCardQuota) {
    const deficit = lacksCardQuota && cardMetrics
      ? Math.max(0, amount - cardMetrics.availableCredit)
      : Math.abs(newAvailableMargin);

    return {
      intent: 'what_if_spend',
      title: isInstallments
        ? `Simulación en ${installmentsCount} Cuotas${selectedCard ? ` · ${selectedCard.name}` : ''}`
        : 'Simulación What-If: Gasto Imprevisto',
      verdict: lacksCardQuota
        ? `⚠️ Cupo insuficiente en ${selectedCard?.name} para ${formattedSpend}`
        : `⚠️ Alerta: Este ${isInstallments ? `compromiso de ${formattedMonthly}/mes` : `gasto de ${formattedSpend}`} provocaría déficit`,
      verdictTone: 'coral',
      recommendation: lacksCardQuota && cardMetrics
        ? `**No te recomendamos esta compra de ${formattedSpend} con ${selectedCard?.name}**. Tu cupo disponible actual es de **${formatCLP(cardMetrics.availableCredit)}**, faltándote **${formatCLP(deficit)}** de cupo.`
        : `**No te recomendamos realizar este gasto${isInstallments ? ` en ${installmentsCount} cuotas (${formattedMonthly}/mes)` : ` de ${formattedSpend}`}**. Supera tu liquidez disponible después de descontar tus gastos fijos obligatorios, dejándote con un déficit estimado de ${formatCLP(deficit)}.`,
      detailedBreakdown: [
        `• Saldo en cuenta corriente: ${formatCLP(checkingBalance)}.`,
        `• Gastos fijos pendientes por pagar: -${formatCLP(pendingFixed)}.`,
        `• Margen libre actual antes del gasto: ${formatCLP(currentAvailableMargin)}.`,
        isInstallments
          ? `• Impacto mensual (${installmentsCount} cuotas): -${formattedMonthly}/mes (Total: ${formattedSpend}).`
          : `• Monto del gasto simulado: -${formattedSpend}.`,
        ...(cardMetrics
          ? [`• Cupo disponible en ${selectedCard?.name}: ${formatCLP(cardMetrics.availableCredit)}.`]
          : []),
      ],
      metrics: [
        { label: isInstallments ? `Cuota (${installmentsCount}x)` : 'Gasto Simulado', value: isInstallments ? formattedMonthly : formattedSpend, tone: 'coral' },
        { label: 'Nuevo Presupuesto', value: `${formatCLP(newDailyBudget)} / día`, tone: 'coral' },
        { label: lacksCardQuota ? 'Cupo Faltante' : 'Déficit Proyectado', value: formatCLP(deficit), tone: 'coral' },
      ],
      suggestedFollowUps: [
        '¿Qué cuentas me faltan pagar este mes?',
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
      ],
      proposedActions: [saveFutureAction],
    };
  }

  if (newDailyBudget < 8000) {
    return {
      intent: 'what_if_spend',
      title: isInstallments
        ? `Simulación en ${installmentsCount} Cuotas${selectedCard ? ` · ${selectedCard.name}` : ''}`
        : 'Simulación What-If: Gasto Imprevisto',
      verdict: `Precaución: Tu ritmo diario bajará a ${formatCLP(newDailyBudget)}/día`,
      verdictTone: 'amber',
      recommendation: `La compra "${itemTitle}" por **${formattedSpend}**${
        isInstallments ? ` en **${installmentsCount} cuotas de ${formattedMonthly}/mes**` : ''
      } es viable, pero dejará tu presupuesto diario muy ajustado para los ${remainingDays} días restantes del mes.`,
      detailedBreakdown: [
        `• Presupuesto diario actual: ${formatCLP(currentDailyBudget)}/día.`,
        `• Impacto mensual evaluado: ${formattedMonthly}.`,
        `• Presupuesto diario posterior: ${formatCLP(newDailyBudget)}/día (${remainingDays} días restantes).`,
        ...(cardMetrics && isInstallments
          ? [`• Cupo restante en ${selectedCard?.name} tras la compra: ${formatCLP(cardMetrics.availableCredit - amount)}.`]
          : []),
      ],
      metrics: [
        { label: isInstallments ? `Cuota (${installmentsCount}x)` : 'Gasto Simulado', value: isInstallments ? formattedMonthly : formattedSpend, tone: 'amber' },
        { label: 'Ritmo Anterior', value: `${formatCLP(currentDailyBudget)}/d`, tone: 'neutral' },
        { label: 'Nuevo Ritmo', value: `${formatCLP(newDailyBudget)}/d`, tone: 'amber' },
      ],
      suggestedFollowUps: [
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
        '¿En qué categoría se fue más dinero este mes?',
      ],
      proposedActions: isInstallments
        ? [saveFutureAction]
        : [registerExpenseAction, saveFutureAction],
    };
  }

  return {
    intent: 'what_if_spend',
    title: isInstallments
      ? `Simulación en ${installmentsCount} Cuotas${selectedCard ? ` · ${selectedCard.name}` : ''}`
      : 'Simulación What-If: Gasto Imprevisto',
    verdict: `✅ ${isInstallments ? 'Cuotas Viables' : 'Gasto Aprobado'}: Mantienes ${formatCLP(newDailyBudget)}/día`,
    verdictTone: 'emerald',
    recommendation: isInstallments
      ? `**Puedes financiar "${itemTitle}" (${formattedSpend}) en ${installmentsCount} cuotas de ${formattedMonthly}/mes**${
          selectedCard ? ` con **${selectedCard.name}**` : ''
        }. Tu presupuesto diario queda en **${formatCLP(newDailyBudget)}/día** sin descalzar tus gastos fijos.`
      : `**Puedes realizar este gasto de ${formattedSpend} (${itemTitle}) con total tranquilidad**. Tu presupuesto diario remanente de **${formatCLP(newDailyBudget)}/día** se mantiene en zona verde y todas tus cuentas de fin de mes quedan 100% cubiertas.`,
    detailedBreakdown: [
      `• Saldo actual en cuenta corriente: ${formatCLP(checkingBalance)}.`,
      `• Gastos fijos protegidos: ${formatCLP(pendingFixed)}.`,
      isInstallments
        ? `• Cuota mensual simulada (${installmentsCount}x): -${formattedMonthly}/mes (Total: ${formattedSpend}).`
        : `• Monto al contado: -${formattedSpend}.`,
      ...(cardMetrics && isInstallments
        ? [`• Cupo en ${selectedCard?.name}: ${formatCLP(cardMetrics.availableCredit)} disponible → ${formatCLP(cardMetrics.availableCredit - amount)} post-compra.`]
        : []),
      `• Presupuesto diario holgado resultante: ${formatCLP(newDailyBudget)}/día por los próximos ${remainingDays} días.`,
    ],
    metrics: [
      { label: isInstallments ? `Cuota (${installmentsCount}x)` : 'Gasto Simulado', value: isInstallments ? formattedMonthly : formattedSpend, tone: 'emerald' },
      { label: 'Nuevo Diario', value: `${formatCLP(newDailyBudget)}/d`, tone: 'emerald' },
      { label: 'Días Restantes', value: `${remainingDays} días`, tone: 'neutral' },
    ],
    proposedActions: isInstallments
      ? [saveFutureAction]
      : amount >= 15000
      ? [registerExpenseAction, saveFutureAction]
      : [registerExpenseAction],
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

  const pendingActions: ProposedChatAction[] = pendingItems.slice(0, 3).map((item) => ({
    id: `pay-rec-${item.id}`,
    type: 'mark_recurring_paid',
    label: `Marcar pagado: ${item.title} (${formatCLP(item.amount)})`,
    description: `Registra "${item.title}" como PAGADO en el período ${period}.`,
    confirmLabel: 'Confirmar pago',
    tone: 'emerald',
    payload: {
      target_type: 'recurring_item',
      target_id: item.id,
      period,
      title: item.title,
      amount: item.amount,
    },
  }));

  pendingActions.push({
    id: 'nav-fixed',
    type: 'navigate_tab',
    label: 'Ver Gastos Fijos',
    tone: 'blue',
    payload: { tab: 'fixed' },
  });

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
    proposedActions: pendingActions,
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

export function solveWishlistEvaluation(
  context: QueryContextData,
  entities?: ExtractedQueryEntities
): QueryEngineResult {
  const {
    accounts,
    recurringItems,
    variableExpenses = [],
    payments = [],
    futurePurchases = [],
  } = context;
  const period = context.period || getCurrentPeriod();
  const activeWishlist = futurePurchases.filter((fp) => fp.status !== 'purchased');

  if (activeWishlist.length === 0) {
    return {
      intent: 'wishlist_evaluation',
      title: 'Planificador de Futuras Compras y Deseos',
      verdict: 'Tu lista de futuras compras está vacía',
      verdictTone: 'blue',
      recommendation:
        'Aún no tienes productos, ropa, gadgets o nuevas suscripciones registradas en la pestaña **🛍️ Compras Futuras**. Agrégalos allí para que calcule qué puedes comprar hoy al contado, qué te conviene en cuotas sin interés y cuál es el mes exacto donde se liberan tus deudas.',
      detailedBreakdown: [
        '• Dirígete a la pestaña "Compras Futuras" en tu consola.',
        '• Usa las plantillas de 1 toque (Ropa, Tecnología, Hogar, Suscripción) o carga los 3 ejemplos de simulación.',
      ],
      suggestedFollowUps: [
        '¿Cuánto puedo ahorrar hoy de mi saldo?',
        '¿Cuál es mi sueldo y cuánto me queda libre?',
      ],
      proposedActions: [
        {
          id: 'nav-fp-empty',
          type: 'navigate_tab',
          label: 'Ir a Compras Futuras',
          tone: 'blue',
          payload: { tab: 'future_purchases' },
        },
      ],
    };
  }

  // Si se detectó un ítem específico de Futuras Compras en la pregunta del usuario
  if (entities?.matchedFuturePurchase) {
    const targetItem = entities.matchedFuturePurchase;
    const overridePaymentMode =
      entities.paymentMode === 'installments'
        ? 'installments'
        : entities.paymentMode === 'cash'
        ? 'one_time_cash'
        : undefined;
    const overrideInstallments = entities.installmentsCount || undefined;

    const itemEval = evaluateFuturePurchase(
      targetItem,
      { period, accounts, recurringItems, variableExpenses, payments },
      overrideInstallments,
      overridePaymentMode
    );

    const tone: 'emerald' | 'amber' | 'coral' =
      itemEval.verdict === 'viable_today'
        ? 'emerald'
        : itemEval.verdict === 'viable_planned'
        ? 'amber'
        : 'coral';

    return {
      intent: 'wishlist_evaluation',
      title: `Evaluación · ${targetItem.title}`,
      verdict: `${itemEval.verdictBadge}: ${itemEval.verdictHeadline}`,
      verdictTone: tone,
      recommendation: itemEval.verdictExplanation,
      detailedBreakdown: [
        `• Camino Contado Hoy: ${
          itemEval.cashPath.isViableToday ? 'Viable' : 'Ajustado / No viable'
        } (Safe-to-Spend resultante: ${formatCLP(itemEval.cashPath.resultingSafePerDay)}/día).`,
        `• Camino ${itemEval.installmentsPath.installmentsCount} Cuotas (${itemEval.installmentsPath.cardName}): ${formatCLP(
          itemEval.installmentsPath.monthlyInstallment
        )}/mes · ${itemEval.installmentsPath.billingAdvice}`,
      ],
      metrics: [
        { label: 'Precio Ítem', value: formatCLP(targetItem.amount), tone: 'neutral' },
        {
          label: 'Contado Diario',
          value: `${formatCLP(itemEval.cashPath.resultingSafePerDay)}/d`,
          tone: itemEval.cashPath.isViableToday ? 'emerald' : 'amber',
        },
        {
          label: `Cuota (${itemEval.installmentsPath.installmentsCount}x)`,
          value: formatCLP(itemEval.installmentsPath.monthlyInstallment),
          tone: itemEval.installmentsPath.isViableInInstallments ? 'emerald' : 'coral',
        },
      ],
      suggestedFollowUps: [
        `¿Puedo comprar ${targetItem.title} en 6 cuotas?`,
        '¿Cuál es mi plan óptimo para comprar mi lista de deseos?',
      ],
      proposedActions: [
        {
          id: `nav-fp-${targetItem.id}`,
          type: 'navigate_tab',
          label: 'Abrir en Compras Futuras',
          tone: 'blue',
          payload: { tab: 'future_purchases' },
        },
      ],
    };
  }

  const evaluations = activeWishlist.map((item) => ({
    item,
    eval: evaluateFuturePurchase(item, {
      period,
      accounts,
      recurringItems,
      variableExpenses,
      payments,
    }),
  }));

  const viableToday = evaluations.filter((e) => e.eval.verdict === 'viable_today');
  const viablePlanned = evaluations.filter((e) => e.eval.verdict === 'viable_planned');
  const postponeList = evaluations.filter((e) => e.eval.verdict === 'postpone');

  const totalWishlistAmount = activeWishlist.reduce(
    (sum, i) => sum + (i.amount || 0),
    0
  );
  const milestones = getDebtReleaseMilestones(recurringItems, period, 18);
  const firstMilestone = milestones[0] || null;

  const breakdown: string[] = [];

  for (const entry of viableToday) {
    breakdown.push(
      `🟢 COMPRAR HOY · ${entry.item.title} (${formatCLP(entry.item.amount)}): ${entry.eval.verdictHeadline}.`
    );
  }
  for (const entry of viablePlanned) {
    breakdown.push(
      `🟡 PLANIFICAR / CUOTAS · ${entry.item.title} (${formatCLP(entry.item.amount)}): ${entry.eval.verdictHeadline}.`
    );
  }
  for (const entry of postponeList) {
    breakdown.push(
      `🔴 POSPONER · ${entry.item.title} (${formatCLP(entry.item.amount)}): ${entry.eval.verdictHeadline}.`
    );
  }

  if (firstMilestone) {
    breakdown.push(
      `💡 Ventana de Liquidez: En ${firstMilestone.releaseLabel} liberas +${formatCLP(
        firstMilestone.releasedMonthlyAmount
      )}/mes tras finalizar ${firstMilestone.itemTitles.slice(0, 2).join(', ')}.`
    );
  }

  const tone: 'emerald' | 'amber' | 'coral' =
    viableToday.length > 0
      ? 'emerald'
      : viablePlanned.length > 0
      ? 'amber'
      : 'coral';

  return {
    intent: 'wishlist_evaluation',
    title: 'Plan Óptimo de Futuras Compras',
    verdict:
      viableToday.length > 0
        ? `✅ ${viableToday.length} de ${activeWishlist.length} deseos son viables hoy`
        : viablePlanned.length > 0
        ? `🟡 ${viablePlanned.length} deseos viables en cuotas o mes de liberación`
        : '🔴 Conviene posponer compras hasta liberar flujo',
    verdictTone: tone,
    recommendation:
      viableToday.length > 0
        ? `Tienes **${viableToday.length} ${
            viableToday.length === 1 ? 'ítem con Luz Verde' : 'ítems con Luz Verde'
          }** (${viableToday.map((v) => v.item.title).join(', ')}) que puedes adquirir este mes sin descalzar tus gastos fijos ni tu presupuesto diario.${
            firstMilestone
              ? ` Los ítems de mayor valor prográmalos para **${firstMilestone.releaseLabel}**, cuando liberas **+${formatCLP(
                  firstMilestone.releasedMonthlyAmount
                )}/mes**.`
              : ''
          }`
        : `Al contado hoy reducirías demasiado tu liquidez diaria. Tu estrategia óptima es usar **cuotas sin interés** en los ítems planificados${
            firstMilestone
              ? ` o esperar a **${firstMilestone.releaseLabel}** cuando dejas de pagar **+${formatCLP(
                  firstMilestone.releasedMonthlyAmount
                )}/mes**`
              : ''
          }.`,
    detailedBreakdown: breakdown,
    metrics: [
      {
        label: 'Deseos en Lista',
        value: `${activeWishlist.length} (${formatCLP(totalWishlistAmount)})`,
        tone: 'neutral',
      },
      {
        label: 'Viables Hoy (Verde)',
        value: `${viableToday.length}`,
        tone: viableToday.length > 0 ? 'emerald' : 'neutral',
      },
      {
        label: 'Próxima Liberación',
        value: firstMilestone
          ? `+${formatCLP(firstMilestone.releasedMonthlyAmount)} (${firstMilestone.releaseLabel})`
          : 'Sin vencimientos',
        tone: firstMilestone ? 'blue' : 'neutral',
      },
    ],
    suggestedFollowUps: [
      '¿Cuánto puedo ahorrar hoy de mi saldo?',
      '¿Cuál es el cupo de mis tarjetas de crédito?',
      '¿Cuánto gasto en suscripciones mensuales?',
    ],
    proposedActions: [
      {
        id: 'nav-fp-list',
        type: 'navigate_tab',
        label: 'Abrir Compras Futuras',
        tone: 'blue',
        payload: { tab: 'future_purchases' },
      },
    ],
  };
}

const INTENT_CLARIFICATION_PROMPT: Partial<Record<QueryIntent, string>> = {
  credit_card_details: '¿Cuál es el cupo disponible de mis tarjetas?',
  card_vs_savings: '¿Me conviene pagar la tarjeta o ahorrar?',
  pending_commitments: '¿Qué cuentas me faltan pagar este mes?',
  future_savings_projection: '¿Cuánto podré ahorrar en abril?',
  safe_to_save: '¿Cuánto puedo ahorrar hoy de mi saldo?',
  what_if_spend: '¿Puedo gastar $50.000 hoy?',
  category_audit: '¿En qué categoría se fue más dinero este mes?',
  subscriptions_audit: '¿Cuánto gasto en suscripciones mensuales?',
  wishlist_evaluation: '¿Qué de mis futuras compras puedo comprar hoy?',
  survival_health: '¿Cómo va mi salud financiera?',
};

export function solveClarification(
  entities: ExtractedQueryEntities,
  candidateIntents: QueryIntent[]
): QueryEngineResult {
  const suggestions = candidateIntents
    .map((i) => INTENT_CLARIFICATION_PROMPT[i])
    .filter((q): q is string => Boolean(q));

  if (entities.amount !== null && suggestions.length < 3) {
    const formatted = formatCLP(entities.amount);
    suggestions.unshift(`¿Puedo gastar ${formatted} hoy?`);
    if (entities.installmentsCount) {
      suggestions.unshift(`¿Puedo gastar ${formatted} en ${entities.installmentsCount} cuotas?`);
    }
  }

  const detectedParts: string[] = [];
  if (entities.amount !== null) detectedParts.push(`monto ${formatCLP(entities.amount)}`);
  if (entities.category) detectedParts.push(`categoría ${entities.category}`);
  if (entities.matchedCardName || entities.cardBrand) {
    detectedParts.push(`tarjeta ${entities.matchedCardName || entities.cardBrand}`);
  }
  if (entities.horizon) detectedParts.push(`horizonte ${entities.horizon.targetLabel}`);

  return {
    intent: 'fallback',
    title: 'Necesito una pequeña aclaración',
    verdict:
      detectedParts.length > 0
        ? `Detecté ${detectedParts.join(', ')}: ¿qué deseas calcular?`
        : 'Tu consulta es un poco ambigua',
    verdictTone: 'blue',
    recommendation:
      'Para darte cifras 100% exactas sin adivinar tu intención, elige una de las interpretaciones sugeridas abajo o agrega un verbo claro (ej. *gastar*, *ahorrar*, *pagar*, *cupo*).',
    detailedBreakdown: suggestions.map((s) => `• ${s}`),
    suggestedFollowUps:
      suggestions.length > 0
        ? suggestions.slice(0, 3)
        : [
            '¿Cuánto puedo ahorrar hoy de mi saldo?',
            '¿Qué cuentas me faltan pagar este mes?',
            '¿Cuál es el cupo de mis tarjetas de crédito?',
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

function resolveCardFromBrand(
  brand: 'santander' | 'falabella' | 'other',
  accounts: Account[]
): { id: string | null; name: string | null } {
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const aliases = FINANZAI_KNOWLEDGE.entities.cardBrands[brand] || [];
  const matched = creditCards.find((c) => {
    if (c.card_brand === brand) return true;
    const cn = normalizeQueryText(c.name);
    return aliases.some((a) => cn.includes(a));
  });
  return matched ? { id: matched.id, name: matched.name } : { id: null, name: null };
}

function applyFollowUpWithSlots(
  normalized: string,
  entities: ExtractedQueryEntities,
  outcome: ClassificationOutcome,
  context: QueryContextData,
  slots?: ConversationSlots
): {
  intent: QueryIntent;
  entities: ExtractedQueryEntities;
  inheritedFromSlots: boolean;
} {
  if (!slots?.lastIntent) {
    return { intent: outcome.intent, entities, inheritedFromSlots: false };
  }

  let nextEntities = { ...entities };
  let inheritedIntent: QueryIntent | null = null;
  const isShortAnaphora =
    normalized.startsWith('y ') ||
    outcome.intent === 'fallback' ||
    outcome.isAmbiguous ||
    (outcome.intent === 'credit_card_details' &&
      (slots.lastIntent === 'what_if_spend' || slots.lastIntent === 'wishlist_evaluation') &&
      normalized.startsWith('y '));

  // 1. Evaluar patrones anafóricos de finanzaiKnowledge.json
  for (const rule of FINANZAI_KNOWLEDGE.followUpPatterns) {
    const regex = new RegExp(rule.pattern, 'i');
    const match = normalized.match(regex);
    if (!match) continue;
    if (!rule.inheritIntentIfMissing.includes(slots.lastIntent)) continue;

    // Si es una frase corta anafórica o el clasificador no detectó una intención más fuerte ajena
    const canInherit =
      isShortAnaphora ||
      outcome.intent === slots.lastIntent ||
      (outcome.intent === 'credit_card_details' && slots.lastIntent === 'what_if_spend');

    if (!canInherit) continue;

    inheritedIntent = slots.lastIntent;

    const { updates } = rule;
    if (updates.paymentMode === 'cash' || updates.paymentMode === 'installments') {
      nextEntities.paymentMode = updates.paymentMode;
    }
    if (updates.installments !== undefined) {
      const rawInst =
        typeof updates.installments === 'string' && updates.installments.startsWith('$')
          ? match[parseInt(updates.installments.slice(1), 10)]
          : String(updates.installments);
      const parsedInst = parseInt(rawInst, 10);
      if (!isNaN(parsedInst) && parsedInst >= 1 && parsedInst <= 60) {
        nextEntities.installmentsCount = parsedInst;
      }
    }
    if (updates.cardBrand !== undefined) {
      const rawBrand =
        typeof updates.cardBrand === 'string' && updates.cardBrand.startsWith('$')
          ? (match[parseInt(updates.cardBrand.slice(1), 10)] || '').toLowerCase()
          : String(updates.cardBrand).toLowerCase();
      const mappedBrand: 'santander' | 'falabella' | 'other' =
        rawBrand === 'cmr' || rawBrand === 'falabella'
          ? 'falabella'
          : rawBrand === 'santander'
          ? 'santander'
          : 'other';
      nextEntities.cardBrand = mappedBrand;
      const resolvedCard = resolveCardFromBrand(mappedBrand, context.accounts || []);
      nextEntities.matchedCardId = resolvedCard.id;
      nextEntities.matchedCardName = resolvedCard.name;
    }
    if (typeof updates.amountMultiplier === 'number' && slots.lastAmount) {
      nextEntities.amount = Math.round(slots.lastAmount * updates.amountMultiplier);
    }
  }

  // 2. Follow-ups temporales sobre proyección de ahorro ("¿y en diciembre?", "¿y el próximo mes?")
  if (
    !inheritedIntent &&
    slots.lastIntent === 'future_savings_projection' &&
    nextEntities.horizon !== null &&
    isShortAnaphora
  ) {
    inheritedIntent = 'future_savings_projection';
  }

  // 3. Follow-up de monto sobre simulación previa ("¿y si cuesta 200 lucas?")
  if (
    !inheritedIntent &&
    normalized.startsWith('y ') &&
    nextEntities.amount !== null &&
    (slots.lastIntent === 'what_if_spend' ||
      slots.lastIntent === 'goal_target_reach' ||
      slots.lastIntent === 'windfall_bonus') &&
    (outcome.intent === 'fallback' || outcome.intent === 'amount_only' || outcome.isAmbiguous)
  ) {
    inheritedIntent = slots.lastIntent;
  }

  if (!inheritedIntent) {
    return { intent: outcome.intent, entities: nextEntities, inheritedFromSlots: false };
  }

  // Heredar slots previos que no fueron sobreescritos en este turno
  if (nextEntities.amount === null && slots.lastAmount != null) {
    nextEntities.amount = slots.lastAmount;
  }
  if (!nextEntities.suggestedTitle && slots.lastItemName) {
    nextEntities.suggestedTitle = slots.lastItemName;
  }
  if (!nextEntities.category && slots.lastCategory) {
    nextEntities.category = slots.lastCategory;
  }
  if (!nextEntities.cardBrand && slots.lastCardBrand) {
    nextEntities.cardBrand = slots.lastCardBrand;
  }
  if (!nextEntities.matchedCardId && slots.lastCardId) {
    nextEntities.matchedCardId = slots.lastCardId;
    const prevCard = (context.accounts || []).find((a) => a.id === slots.lastCardId);
    if (prevCard) nextEntities.matchedCardName = prevCard.name;
  }
  if (!nextEntities.paymentMode && slots.lastPaymentMode) {
    nextEntities.paymentMode = slots.lastPaymentMode;
  }
  if (nextEntities.installmentsCount === null && slots.lastInstallments != null && nextEntities.paymentMode === 'installments') {
    nextEntities.installmentsCount = slots.lastInstallments;
  }
  if (!nextEntities.matchedFuturePurchase && slots.lastFuturePurchaseId) {
    const prevFp = (context.futurePurchases || []).find(
      (fp) => fp.id === slots.lastFuturePurchaseId && fp.status !== 'purchased'
    );
    if (prevFp) {
      nextEntities.matchedFuturePurchase = prevFp;
    }
  }

  return {
    intent: inheritedIntent,
    entities: nextEntities,
    inheritedFromSlots: true,
  };
}

function buildUpdatedSlots(
  resultIntent: QueryIntent,
  entities: ExtractedQueryEntities,
  prevSlots?: ConversationSlots
): ConversationSlots {
  if (resultIntent === 'fallback' || resultIntent === 'greeting_help') {
    return prevSlots ? { ...prevSlots } : {};
  }

  return {
    lastIntent: resultIntent,
    lastAmount: entities.matchedFuturePurchase?.amount ?? entities.amount ?? prevSlots?.lastAmount ?? null,
    lastHorizon: entities.horizon ?? prevSlots?.lastHorizon ?? null,
    lastItemName: entities.suggestedTitle ?? prevSlots?.lastItemName ?? null,
    lastCardId: entities.matchedCardId ?? prevSlots?.lastCardId ?? null,
    lastCardBrand: entities.cardBrand ?? prevSlots?.lastCardBrand ?? null,
    lastPaymentMode: entities.paymentMode ?? prevSlots?.lastPaymentMode ?? null,
    lastInstallments:
      entities.paymentMode === 'cash'
        ? 1
        : entities.installmentsCount ?? prevSlots?.lastInstallments ?? null,
    lastCategory: entities.category ?? prevSlots?.lastCategory ?? null,
    lastFuturePurchaseId:
      resultIntent === 'wishlist_evaluation'
        ? entities.matchedFuturePurchase?.id ?? prevSlots?.lastFuturePurchaseId ?? null
        : null,
  };
}

/**
 * Función principal que procesa cualquier texto de entrada libre o píldora de 1 toque.
 * Soporta memoria conversacional opcional (`slots`) para resolver preguntas de seguimiento.
 */
export function queryFinanzAI(
  query: string,
  context: QueryContextData,
  slots?: ConversationSlots
): QueryEngineResult {
  const { accounts, recurringItems, variableExpenses, payments } = context;
  const period = context.period || getCurrentPeriod();

  const normalized = normalizeQueryText(query);
  const rawEntities = extractQueryEntities(query, {
    accounts,
    futurePurchases: context.futurePurchases,
    period,
  });

  const outcome = classifyQueryIntentInternal(normalized, rawEntities.amount, rawEntities.horizon);
  const followUpResolution = applyFollowUpWithSlots(
    normalized,
    rawEntities,
    outcome,
    context,
    slots
  );

  const entities = followUpResolution.entities;
  let resolvedIntent = followUpResolution.intent;

  // Enrutamiento inteligente por entidades cuando la frase apunta a un ítem o entidad específica
  if (
    !followUpResolution.inheritedFromSlots &&
    entities.matchedFuturePurchase &&
    (resolvedIntent === 'what_if_spend' ||
      resolvedIntent === 'fallback' ||
      outcome.isAmbiguous ||
      /\b(?:comprar|conviene|adquirir|cuotas?|contado)\b/.test(normalized))
  ) {
    resolvedIntent = 'wishlist_evaluation';
  } else if (resolvedIntent === 'fallback') {
    if (entities.matchedCardId || entities.cardBrand) {
      resolvedIntent = entities.amount !== null ? 'what_if_spend' : 'credit_card_details';
    } else if (entities.category && entities.amount === null) {
      resolvedIntent = 'category_audit';
    }
  }

  // Calcular presupuesto diario actual
  const checkingBalance = getCheckingLiquidBalance(accounts, context.variableExpenses, period);
  const pendingFixed = getPendingFixedExpenses(recurringItems, period, payments);
  const { remainingDays } = getRemainingDaysInCurrentMonth();
  const dailyBudget = Math.max(0, Math.round((checkingBalance - pendingFixed) / remainingDays));

  let result: QueryEngineResult;

  if (
    !followUpResolution.inheritedFromSlots &&
    outcome.isAmbiguous &&
    resolvedIntent !== 'wishlist_evaluation'
  ) {
    result = solveClarification(entities, outcome.candidateIntents);
    return {
      ...result,
      extractedEntities: entities,
      updatedSlots: buildUpdatedSlots(result.intent, entities, slots),
    };
  }

  switch (resolvedIntent) {
    case 'greeting_help':
      result = solveGreetingHelp();
      break;

    case 'future_savings_projection':
      result = solveFutureSavings(entities.horizon, context);
      break;

    case 'goal_target_reach':
      result = solveGoalTargetReach(entities.amount, context);
      break;

    case 'income_cashflow':
      result = solveIncomeCashflow(context);
      break;

    case 'credit_card_details':
      result = solveCreditCardDetails(context, entities);
      break;

    case 'total_debt_audit':
      result = solveTotalDebtAudit(context);
      break;

    case 'subscriptions_audit':
      result = solveSubscriptionsAudit(context);
      break;

    case 'shared_savings_partner':
      result = solveSharedSavings(context);
      break;

    case 'windfall_bonus':
      result = solveWindfallBonus(entities.amount, context);
      break;

    case 'wishlist_evaluation':
      result = solveWishlistEvaluation(context, entities);
      break;

    case 'invest_recommendation':
      result = solveInvestRecommendation(accounts);
      break;

    case 'card_vs_savings':
      result = solveCardVsSavings(accounts, recurringItems, period);
      break;

    case 'safe_to_save':
      result = solveSafeToSave(
        accounts,
        recurringItems,
        period,
        dailyBudget,
        payments,
        context.variableExpenses
      );
      break;

    case 'what_if_spend':
      result = solveWhatIfSpend(
        entities.amount || 50000,
        accounts,
        recurringItems,
        period,
        dailyBudget,
        payments,
        context.variableExpenses,
        entities
      );
      break;

    case 'survival_health':
      result = solveSurvivalHealth(
        accounts,
        recurringItems,
        variableExpenses,
        period,
        context.report
      );
      break;

    case 'pending_commitments':
      result = solvePendingCommitments(accounts, recurringItems, period, payments);
      break;

    case 'category_audit':
      result = solveCategoryAudit(variableExpenses, period);
      break;

    case 'amount_only':
      result = solveAmountOnly(entities.amount || 0);
      break;

    case 'fallback':
    default:
      result =
        entities.amount !== null || entities.horizon !== null || entities.category !== null
          ? solveClarification(entities, outcome.candidateIntents)
          : solveFallback();
      break;
  }

  return {
    ...result,
    extractedEntities: entities,
    updatedSlots: buildUpdatedSlots(result.intent, entities, slots),
  };
}
