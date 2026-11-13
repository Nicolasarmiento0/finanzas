import rawFinanzAIKnowledge from '../../src/data/finanzaiKnowledge.json';

export interface BackendConversationSlots {
  lastIntent?: string;
  lastAmount?: number | null;
  lastHorizon?: {
    targetPeriod: string;
    targetLabel: string;
    monthsAhead: number;
  } | null;
  lastItemName?: string | null;
  lastCardId?: string | null;
  lastCardBrand?: 'santander' | 'falabella' | 'other' | null;
  lastPaymentMode?: 'cash' | 'installments' | null;
  lastInstallments?: number | null;
  lastCategory?: string | null;
  lastFuturePurchaseId?: string | null;
}

export interface BackendProposedAction {
  id: string;
  type:
    | 'register_variable_expense'
    | 'save_future_purchase'
    | 'mark_recurring_paid'
    | 'navigate_tab';
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

export interface BackendStructuredResult {
  intent: string;
  title: string;
  verdict: string;
  verdictTone: 'emerald' | 'amber' | 'coral' | 'blue' | 'neutral';
  recommendation: string;
  detailedBreakdown: string[];
  metrics?: Array<{
    label: string;
    value: string;
    tone?: 'emerald' | 'amber' | 'coral' | 'blue' | 'neutral';
  }>;
  suggestedFollowUps?: string[];
  proposedActions?: BackendProposedAction[];
  updatedSlots?: BackendConversationSlots;
}

export interface PersistedFinanzAIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source: 'workers_ai' | 'local';
  structuredResult?: BackendStructuredResult;
  createdAt: string;
}

interface AccountRecord {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'credit_card' | 'savings' | 'loan';
  current_balance: number;
  credit_limit: number;
  interest_rate_annual: number;
  billing_day: number | null;
  card_brand: 'santander' | 'falabella' | 'other' | null;
  savings_mode: 'fixed' | 'surplus' | null;
  fixed_contribution: number;
  is_shared: number;
  partner_name: string | null;
  partner_initial_balance: number;
  partner_monthly_contribution: number;
  target_amount: number;
  partner_user_id: string | null;
}

interface RecurringRecord {
  id: string;
  account_id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  start_date: string;
  end_date: string | null;
  is_active: number;
}

interface PaymentRecord {
  target_type: 'recurring_item' | 'loan_installment' | 'credit_card';
  target_id: string;
  period: string;
  is_paid: number;
}

interface VariableExpenseRecord {
  id: string;
  title: string;
  amount: number;
  category: string;
  period: string;
  date: string;
}

interface FuturePurchaseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: 'one_time_cash' | 'installments' | 'recurring_subscription';
  installments_count: number;
  target_account_id: string | null;
  priority: 'high' | 'medium' | 'low';
  target_period: string | null;
  status: 'evaluating' | 'planned' | 'purchased';
}

interface UserFinancialDataset {
  userId: string;
  period: string;
  accounts: AccountRecord[];
  recurringItems: RecurringRecord[];
  payments: PaymentRecord[];
  variableExpenses: VariableExpenseRecord[];
  futurePurchases: FuturePurchaseRecord[];
}

export interface FinancialSnapshot {
  period: string;
  checkingBalance: number;
  monthlyIncome: number;
  monthlyRecurringExpenses: number;
  monthlySurplus: number;
  pendingFixedExpenses: number;
  pendingFixedCount: number;
  pendingItems: Array<{ id: string; title: string; amount: number; category: string }>;
  remainingDaysInMonth: number;
  safeToSpendTotal: number;
  dailyBudget: number;
  totalSavings: number;
  mySavingsBalance: number;
  partnerSavingsBalance: number;
  totalLoanDebt: number;
  totalCreditCardDebt: number;
  totalDebt: number;
  netWorthWithSavings: number;
  netWorthWithoutSavings: number;
  creditCards: Array<{
    id: string;
    name: string;
    brand: string;
    usedAmount: number;
    creditLimit: number;
    availableCredit: number;
    usagePercent: number;
    billingDay: number | null;
  }>;
  savingsAccounts: Array<{
    id: string;
    name: string;
    totalBalance: number;
    myBalance: number;
    partnerBalance: number;
    annualRate: number;
    monthlyContribution: number;
    isShared: boolean;
    targetAmount: number;
  }>;
  variableSpentInPeriod: number;
  topCategories: Array<{ category: string; amount: number }>;
  activeFuturePurchases: Array<{
    id: string;
    title: string;
    category: string;
    amount: number;
    payment_mode: 'one_time_cash' | 'installments' | 'recurring_subscription';
    installments_count: number;
    target_account_id: string | null;
    status: string;
  }>;
}

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MONTH_NAMES = [
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

let finanzaiTableEnsured = false;

export function formatCLPBackend(amount: number): string {
  const rounded = Math.round(amount || 0);
  const absFormatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$${absFormatted}` : `$${absFormatted}`;
}

function getCurrentPeriodUTC(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftPeriod(basePeriod: string, monthsAhead: number): string {
  const [y, m] = basePeriod.split('-').map(Number);
  const d = new Date(Date.UTC(y || 2026, (m || 1) - 1 + monthsAhead, 1));
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1] || period} ${y || ''}`.trim();
}

function isRecurringActiveInPeriod(item: RecurringRecord, period: string): boolean {
  if (!item.is_active) return false;
  const targetYM = period.slice(0, 7);
  const startYM = item.start_date ? item.start_date.slice(0, 7) : null;
  const endYM = item.end_date ? item.end_date.slice(0, 7) : null;
  if (startYM && targetYM < startYM) return false;
  if (endYM && targetYM > endYM) return false;
  return true;
}

export async function ensureFinanzAITable(db: D1Database): Promise<void> {
  if (finanzaiTableEnsured) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS finanzai_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'local',
        structured_json TEXT,
        slots_json TEXT,
        period TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_finanzai_messages_user_created
       ON finanzai_messages(user_id, created_at)`
    )
    .run();
  finanzaiTableEnsured = true;
}

export async function loadFinanzAIHistory(
  db: D1Database,
  userId: string
): Promise<{ messages: PersistedFinanzAIMessage[]; slots: BackendConversationSlots }> {
  await ensureFinanzAITable(db);
  const rows = await db
    .prepare(
      `SELECT id, role, content, source, structured_json, slots_json, created_at
       FROM finanzai_messages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`
    )
    .bind(userId)
    .all<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      source: string;
      structured_json: string | null;
      slots_json: string | null;
      created_at: string;
    }>();

  const ordered = [...rows.results].reverse();
  let latestSlots: BackendConversationSlots = {};

  const messages: PersistedFinanzAIMessage[] = ordered.map((row) => {
    let structuredResult: BackendStructuredResult | undefined;
    if (row.structured_json) {
      try {
        structuredResult = JSON.parse(row.structured_json) as BackendStructuredResult;
      } catch {
        structuredResult = undefined;
      }
    }
    if (row.slots_json) {
      try {
        latestSlots = JSON.parse(row.slots_json) as BackendConversationSlots;
      } catch {
        // Ignorar slots inválidos
      }
    }
    return {
      id: row.id,
      role: row.role,
      text: row.content,
      source: row.source === 'workers_ai' ? 'workers_ai' : 'local',
      structuredResult,
      createdAt: row.created_at,
    };
  });

  return { messages, slots: latestSlots };
}

export async function saveFinanzAITurn(
  db: D1Database,
  input: {
    userId: string;
    userMessage: string;
    assistantMessage: string;
    source: 'workers_ai' | 'local';
    structuredResult: BackendStructuredResult;
    slots: BackendConversationSlots;
    period: string;
  }
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  await ensureFinanzAITable(db);
  const now = Date.now();
  const userMessageId = `usr-${now}-${crypto.randomUUID().slice(0, 6)}`;
  const assistantMessageId = `ai-${now + 1}-${crypto.randomUUID().slice(0, 6)}`;
  const userTs = new Date(now).toISOString();
  const aiTs = new Date(now + 1).toISOString();

  await db
    .prepare(
      `INSERT INTO finanzai_messages (id, user_id, role, content, source, structured_json, slots_json, period, created_at)
       VALUES (?, ?, 'user', ?, 'local', NULL, NULL, ?, ?)`
    )
    .bind(userMessageId, input.userId, input.userMessage, input.period, userTs)
    .run();

  await db
    .prepare(
      `INSERT INTO finanzai_messages (id, user_id, role, content, source, structured_json, slots_json, period, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      assistantMessageId,
      input.userId,
      input.assistantMessage,
      input.source,
      JSON.stringify(input.structuredResult),
      JSON.stringify(input.slots),
      input.period,
      aiTs
    )
    .run();

  return { userMessageId, assistantMessageId };
}

export async function clearFinanzAIHistory(db: D1Database, userId: string): Promise<void> {
  await ensureFinanzAITable(db);
  await db.prepare(`DELETE FROM finanzai_messages WHERE user_id = ?`).bind(userId).run();
}

async function loadUserFinancialDataset(
  db: D1Database,
  userId: string,
  period: string
): Promise<UserFinancialDataset> {
  const [accountsRes, recurringRes, paymentsRes, varRes, fpRes] = await Promise.all([
    db
      .prepare(
        `SELECT id, user_id, name, type, current_balance, credit_limit, interest_rate_annual,
                billing_day, card_brand, savings_mode, fixed_contribution, is_shared,
                partner_name, partner_initial_balance, partner_monthly_contribution,
                target_amount, partner_user_id
         FROM accounts
         WHERE user_id = ? OR (is_shared = 1 AND partner_user_id = ?)`
      )
      .bind(userId, userId)
      .all<AccountRecord>(),
    db
      .prepare(
        `SELECT id, account_id, title, amount, type, category, start_date, end_date, is_active
         FROM recurring_items
         WHERE user_id = ?`
      )
      .bind(userId)
      .all<RecurringRecord>(),
    db
      .prepare(
        `SELECT target_type, target_id, period, is_paid
         FROM monthly_payments
         WHERE user_id = ? AND period = ?`
      )
      .bind(userId, period)
      .all<PaymentRecord>(),
    db
      .prepare(
        `SELECT id, title, amount, category, period, date
         FROM variable_expenses
         WHERE user_id = ? AND period = ?`
      )
      .bind(userId, period)
      .all<VariableExpenseRecord>(),
    db
      .prepare(
        `SELECT id, title, category, amount, payment_mode, installments_count, target_account_id,
                priority, target_period, status
         FROM future_purchases
         WHERE user_id = ? AND status != 'purchased'`
      )
      .bind(userId)
      .all<FuturePurchaseRecord>(),
  ]);

  return {
    userId,
    period,
    accounts: accountsRes.results,
    recurringItems: recurringRes.results,
    payments: paymentsRes.results,
    variableExpenses: varRes.results,
    futurePurchases: fpRes.results,
  };
}

function buildFinancialSnapshot(dataset: UserFinancialDataset): FinancialSnapshot {
  const { userId, period, accounts, recurringItems, payments, variableExpenses, futurePurchases } =
    dataset;

  const baseChecking = accounts
    .filter((a) => a.type === 'checking')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const variableSpentInPeriod = variableExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const checkingBalance = Math.max(0, baseChecking - variableSpentInPeriod);

  const activeItems = recurringItems.filter((item) => isRecurringActiveInPeriod(item, period));
  const monthlyIncome = activeItems
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const monthlyRecurringExpenses = activeItems
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + (item.amount || 0), 0);

  const paidRecurringIds = new Set(
    payments
      .filter((p) => p.target_type === 'recurring_item' && p.is_paid)
      .map((p) => p.target_id)
  );

  const pendingItems = activeItems
    .filter((item) => item.type === 'expense' && !paidRecurringIds.has(item.id))
    .map((item) => ({
      id: item.id,
      title: item.title,
      amount: item.amount,
      category: item.category,
    }));

  const pendingFixedExpenses = pendingItems.reduce((sum, i) => sum + i.amount, 0);

  const now = new Date();
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const remainingDaysInMonth = Math.max(1, daysInMonth - now.getUTCDate() + 1);
  const safeToSpendTotal = Math.max(0, checkingBalance - pendingFixedExpenses);
  const dailyBudget = Math.round(safeToSpendTotal / remainingDaysInMonth);

  const creditCards = accounts
    .filter((a) => a.type === 'credit_card')
    .map((card) => {
      const recurringCharges = activeItems
        .filter((item) => item.type === 'expense' && item.account_id === card.id)
        .reduce((sum, item) => sum + (item.amount || 0), 0);
      const usedAmount = Math.max(0, card.current_balance || 0) + recurringCharges;
      const creditLimit = Math.max(0, card.credit_limit || 0);
      const availableCredit = Math.max(0, creditLimit - usedAmount);
      const usagePercent =
        creditLimit > 0 ? Math.min(100, Math.round((usedAmount / creditLimit) * 100)) : 0;
      return {
        id: card.id,
        name: card.name,
        brand: card.card_brand || 'other',
        usedAmount,
        creditLimit,
        availableCredit,
        usagePercent,
        billingDay: card.billing_day,
      };
    });

  let mySavingsBalance = 0;
  let partnerSavingsBalance = 0;
  const savingsAccounts = accounts
    .filter((a) => a.type === 'savings')
    .map((acc) => {
      const totalBalance = Math.max(0, acc.current_balance || 0);
      const isShared = Boolean(acc.is_shared);
      const isInvitedPartner = isShared && acc.partner_user_id === userId && acc.user_id !== userId;
      let myBal = totalBalance;
      let partnerBal = 0;
      let myMonthly = acc.fixed_contribution || 0;
      let partnerMonthly = isShared ? Math.max(0, acc.partner_monthly_contribution || 0) : 0;

      if (isInvitedPartner) {
        myBal = Math.max(0, acc.partner_initial_balance || 0);
        partnerBal = Math.max(0, totalBalance - myBal);
        myMonthly = Math.max(0, acc.partner_monthly_contribution || 0);
        partnerMonthly = Math.max(0, acc.fixed_contribution || 0);
      } else if (isShared) {
        partnerBal = Math.max(0, acc.partner_initial_balance || 0);
        myBal = Math.max(0, totalBalance - partnerBal);
      }

      mySavingsBalance += myBal;
      partnerSavingsBalance += partnerBal;

      return {
        id: acc.id,
        name: acc.name,
        totalBalance,
        myBalance: myBal,
        partnerBalance: partnerBal,
        annualRate: acc.interest_rate_annual || 0,
        monthlyContribution: myMonthly + partnerMonthly,
        isShared,
        targetAmount: acc.target_amount || 0,
      };
    });

  const totalSavings = savingsAccounts.reduce((sum, s) => sum + s.totalBalance, 0);
  const totalLoanDebt = accounts
    .filter((a) => a.type === 'loan')
    .reduce((sum, a) => sum + Math.max(0, a.current_balance || 0), 0);
  const totalCreditCardDebt = creditCards.reduce((sum, c) => sum + c.usedAmount, 0);
  const totalDebt = totalLoanDebt + totalCreditCardDebt;

  const categoryTotals: Record<string, number> = {};
  for (const item of activeItems) {
    if (item.type === 'expense') {
      const cat = item.category || 'general';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + item.amount;
    }
  }
  for (const v of variableExpenses) {
    const cat = v.category || 'alimentacion';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + v.amount;
  }

  const topCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  return {
    period,
    checkingBalance,
    monthlyIncome,
    monthlyRecurringExpenses,
    monthlySurplus: monthlyIncome - monthlyRecurringExpenses - variableSpentInPeriod,
    pendingFixedExpenses,
    pendingFixedCount: pendingItems.length,
    pendingItems: pendingItems.slice(0, 8),
    remainingDaysInMonth,
    safeToSpendTotal,
    dailyBudget,
    totalSavings,
    mySavingsBalance,
    partnerSavingsBalance,
    totalLoanDebt,
    totalCreditCardDebt,
    totalDebt,
    netWorthWithSavings: monthlyIncome + totalSavings - totalDebt,
    netWorthWithoutSavings: monthlyIncome - totalDebt,
    creditCards,
    savingsAccounts,
    variableSpentInPeriod,
    topCategories,
    activeFuturePurchases: futurePurchases.slice(0, 10),
  };
}

function findMatchingCard(
  snapshot: FinancialSnapshot,
  cardHint?: string | null
): FinancialSnapshot['creditCards'][number] | undefined {
  if (!cardHint) return snapshot.creditCards[0];
  const lower = cardHint.toLowerCase();
  return (
    snapshot.creditCards.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.brand.toLowerCase().includes(lower) ||
        (lower.includes('cmr') && c.brand === 'falabella')
    ) || snapshot.creditCards[0]
  );
}

interface ToolExecutionBundle {
  toolOutput: unknown;
  proposedActions: BackendProposedAction[];
  metrics: Array<{
    label: string;
    value: string;
    tone?: 'emerald' | 'amber' | 'coral' | 'blue' | 'neutral';
  }>;
  slotPatch: Partial<BackendConversationSlots>;
}

function executeDeterministicTool(
  toolName: string,
  rawArgs: Record<string, unknown>,
  dataset: UserFinancialDataset,
  snapshot: FinancialSnapshot
): ToolExecutionBundle {
  const checkingAcc = dataset.accounts.find((a) => a.type === 'checking');

  if (toolName === 'get_financial_snapshot') {
    return {
      toolOutput: snapshot,
      proposedActions: [],
      metrics: [
        { label: 'Safe-to-Spend', value: formatCLPBackend(snapshot.safeToSpendTotal), tone: 'emerald' },
        { label: 'Límite Diario', value: formatCLPBackend(snapshot.dailyBudget), tone: 'blue' },
        { label: 'Ahorro Total', value: formatCLPBackend(snapshot.totalSavings), tone: 'emerald' },
      ],
      slotPatch: { lastIntent: 'survival_health' },
    };
  }

  if (toolName === 'simulate_spend') {
    const amount = Math.max(1, Math.round(Number(rawArgs.amount) || 0));
    const category = typeof rawArgs.category === 'string' ? rawArgs.category : 'general';
    const title =
      typeof rawArgs.title === 'string' && rawArgs.title.trim()
        ? rawArgs.title.trim()
        : 'Gasto evaluado';
    const paymentMode =
      rawArgs.payment_mode === 'installments' ? 'installments' : 'cash';
    const installmentsCount =
      paymentMode === 'installments'
        ? Math.max(2, Math.min(48, Math.round(Number(rawArgs.installments_count) || 3)))
        : 1;
    const card = findMatchingCard(
      snapshot,
      typeof rawArgs.card_brand_or_name === 'string' ? rawArgs.card_brand_or_name : null
    );

    const remainingAfterCash = snapshot.safeToSpendTotal - amount;
    const viableCash = remainingAfterCash >= 0;
    const monthlyInstallment = Math.round(amount / installmentsCount);
    const fitsCard = Boolean(card && card.availableCredit >= amount);
    const fitsMonthlySurplus = snapshot.monthlySurplus >= monthlyInstallment;

    const actions: BackendProposedAction[] = [];
    if (paymentMode === 'cash' && viableCash) {
      actions.push({
        id: `act-var-${amount}`,
        type: 'register_variable_expense',
        label: `Registrar gasto de ${formatCLPBackend(amount)}`,
        description: `Descuenta de liquidez en categoría ${category}.`,
        confirmLabel: 'Confirmar gasto',
        tone: 'emerald',
        payload: {
          title,
          amount,
          category,
          account_id: checkingAcc?.id ?? null,
          period: snapshot.period,
        },
      });
    }
    actions.push({
      id: `act-fp-${amount}`,
      type: 'save_future_purchase',
      label: 'Guardar en Futuras Compras',
      description:
        paymentMode === 'installments'
          ? `Planificar en ${installmentsCount} cuotas de ${formatCLPBackend(monthlyInstallment)}.`
          : 'Evaluar compra sin comprometer el mes actual.',
      confirmLabel: 'Guardar en lista',
      tone: 'blue',
      payload: {
        title,
        amount,
        category,
        payment_mode: paymentMode === 'installments' ? 'installments' : 'one_time_cash',
        installments_count: installmentsCount,
        target_account_id:
          paymentMode === 'installments' ? (card?.id ?? null) : (checkingAcc?.id ?? null),
      },
    });

    return {
      toolOutput: {
        amount,
        title,
        category,
        paymentMode,
        installmentsCount,
        monthlyInstallment,
        safeToSpendBefore: snapshot.safeToSpendTotal,
        safeToSpendAfterCash: remainingAfterCash,
        viableCash,
        newDailyBudgetIfCash: Math.max(
          0,
          Math.round(remainingAfterCash / snapshot.remainingDaysInMonth)
        ),
        matchedCard: card
          ? {
              name: card.name,
              availableCredit: card.availableCredit,
              fitsCard,
              remainingCreditAfterPurchase: card.availableCredit - amount,
            }
          : null,
        monthlySurplusAfterInstallment: snapshot.monthlySurplus - monthlyInstallment,
        fitsMonthlySurplus,
      },
      proposedActions: actions,
      metrics: [
        {
          label: paymentMode === 'installments' ? `Cuota (${installmentsCount}x)` : 'Monto',
          value: formatCLPBackend(
            paymentMode === 'installments' ? monthlyInstallment : amount
          ),
          tone: viableCash || (fitsCard && fitsMonthlySurplus) ? 'emerald' : 'amber',
        },
        {
          label: 'Safe-to-Spend Post',
          value: formatCLPBackend(Math.max(0, remainingAfterCash)),
          tone: viableCash ? 'emerald' : 'coral',
        },
        {
          label: 'Remanente Mes',
          value: formatCLPBackend(snapshot.monthlySurplus),
          tone: snapshot.monthlySurplus >= 0 ? 'blue' : 'coral',
        },
      ],
      slotPatch: {
        lastIntent: 'what_if_spend',
        lastAmount: amount,
        lastItemName: title,
        lastCategory: category,
        lastPaymentMode: paymentMode,
        lastInstallments: installmentsCount,
        lastCardId: card?.id ?? null,
      },
    };
  }

  if (toolName === 'simulate_purchase_installments') {
    const amount = Math.max(1, Math.round(Number(rawArgs.total_amount) || 0));
    const installmentsCount = Math.max(
      2,
      Math.min(48, Math.round(Number(rawArgs.installments_count) || 3))
    );
    const title =
      typeof rawArgs.title === 'string' && rawArgs.title.trim()
        ? rawArgs.title.trim()
        : 'Compra en cuotas';
    const card = findMatchingCard(
      snapshot,
      typeof rawArgs.card_name === 'string' ? rawArgs.card_name : null
    );
    const monthlyInstallment = Math.round(amount / installmentsCount);
    const fitsCard = Boolean(card && card.availableCredit >= amount);
    const surplusAfter = snapshot.monthlySurplus - monthlyInstallment;

    const action: BackendProposedAction = {
      id: `act-inst-${amount}-${installmentsCount}`,
      type: 'save_future_purchase',
      label: `Planificar ${installmentsCount} cuotas de ${formatCLPBackend(monthlyInstallment)}`,
      description: card ? `Cargo proyectado en ${card.name}.` : 'Guardar simulación en wishlist.',
      confirmLabel: 'Guardar simulación',
      tone: fitsCard && surplusAfter >= 0 ? 'emerald' : 'amber',
      payload: {
        title,
        amount,
        category: 'tecnologia',
        payment_mode: 'installments',
        installments_count: installmentsCount,
        target_account_id: card?.id ?? null,
      },
    };

    return {
      toolOutput: {
        title,
        totalAmount: amount,
        installmentsCount,
        monthlyInstallment,
        cardName: card?.name ?? 'Sin tarjeta registrada',
        cardAvailableBefore: card?.availableCredit ?? 0,
        cardAvailableAfter: card ? card.availableCredit - amount : 0,
        fitsCardCreditLimit: fitsCard,
        monthlySurplusBefore: snapshot.monthlySurplus,
        monthlySurplusAfter: surplusAfter,
        recommended: fitsCard && surplusAfter >= 0,
      },
      proposedActions: [action],
      metrics: [
        { label: `Cuota (${installmentsCount}m)`, value: formatCLPBackend(monthlyInstallment), tone: 'blue' },
        {
          label: 'Cupo Libre Post',
          value: formatCLPBackend(Math.max(0, (card?.availableCredit ?? 0) - amount)),
          tone: fitsCard ? 'emerald' : 'coral',
        },
        {
          label: 'Superávit Post',
          value: formatCLPBackend(surplusAfter),
          tone: surplusAfter >= 0 ? 'emerald' : 'coral',
        },
      ],
      slotPatch: {
        lastIntent: 'what_if_spend',
        lastAmount: amount,
        lastItemName: title,
        lastPaymentMode: 'installments',
        lastInstallments: installmentsCount,
        lastCardId: card?.id ?? null,
      },
    };
  }

  if (toolName === 'project_savings_horizon') {
    const monthsAhead = Math.max(1, Math.min(60, Math.round(Number(rawArgs.months_ahead) || 3)));
    let runningSavings = snapshot.totalSavings;
    let totalContributed = 0;
    let totalInterestEarned = 0;

    const avgAnnualRate =
      snapshot.totalSavings > 0
        ? snapshot.savingsAccounts.reduce(
            (sum, s) => sum + s.annualRate * (s.totalBalance / snapshot.totalSavings),
            0
          )
        : 0;
    const monthlyRate = avgAnnualRate / 100 / 12;

    const monthlyTimeline: Array<{ period: string; label: string; surplus: number; projectedSavings: number }> =
      [];

    for (let i = 1; i <= monthsAhead; i++) {
      const p = shiftPeriod(snapshot.period, i);
      const monthItems = dataset.recurringItems.filter((it) => isRecurringActiveInPeriod(it, p));
      const inc = monthItems
        .filter((it) => it.type === 'income')
        .reduce((s, it) => s + it.amount, 0);
      const exp = monthItems
        .filter((it) => it.type === 'expense')
        .reduce((s, it) => s + it.amount, 0);
      const freeSurplus = Math.max(0, inc - exp);
      const interest = Math.round(runningSavings * monthlyRate);
      runningSavings += freeSurplus + interest;
      totalContributed += freeSurplus;
      totalInterestEarned += interest;
      if (i <= 6 || i === monthsAhead) {
        monthlyTimeline.push({
          period: p,
          label: formatPeriodLabel(p),
          surplus: freeSurplus,
          projectedSavings: Math.round(runningSavings),
        });
      }
    }

    const targetPeriod = shiftPeriod(snapshot.period, monthsAhead);
    const targetLabel = formatPeriodLabel(targetPeriod);

    return {
      toolOutput: {
        monthsAhead,
        targetPeriod,
        targetLabel,
        startingSavings: snapshot.totalSavings,
        projectedSavings: Math.round(runningSavings),
        totalNewContributions: Math.round(totalContributed),
        totalInterestEarned: Math.round(totalInterestEarned),
        weightedAnnualRatePercent: Number(avgAnnualRate.toFixed(2)),
        timelineSample: monthlyTimeline,
      },
      proposedActions: [
        {
          id: 'act-nav-savings',
          type: 'navigate_tab',
          label: 'Ver proyección en Ahorro',
          confirmLabel: 'Ir a Ahorro',
          tone: 'emerald',
          payload: { tab: 'savings' },
        },
      ],
      metrics: [
        { label: `Proyección ${targetLabel}`, value: formatCLPBackend(runningSavings), tone: 'emerald' },
        { label: 'Aporte Acumulado', value: formatCLPBackend(totalContributed), tone: 'blue' },
        { label: 'Intereses', value: formatCLPBackend(totalInterestEarned), tone: 'emerald' },
      ],
      slotPatch: {
        lastIntent: 'future_savings_projection',
        lastHorizon: { targetPeriod, targetLabel, monthsAhead },
      },
    };
  }

  if (toolName === 'evaluate_future_purchases') {
    const query = typeof rawArgs.item_query === 'string' ? rawArgs.item_query.toLowerCase() : '';
    const candidates = query
      ? dataset.futurePurchases.filter((fp) => fp.title.toLowerCase().includes(query))
      : dataset.futurePurchases;

    const evaluated = (candidates.length > 0 ? candidates : dataset.futurePurchases).map((fp) => {
      const inst = fp.payment_mode === 'installments' ? Math.max(1, fp.installments_count || 1) : 1;
      const monthlyImpact = Math.round(fp.amount / inst);
      const card = snapshot.creditCards.find((c) => c.id === fp.target_account_id) || snapshot.creditCards[0];
      const viableToday =
        fp.payment_mode === 'installments'
          ? Boolean(card && card.availableCredit >= fp.amount && snapshot.monthlySurplus >= monthlyImpact)
          : snapshot.safeToSpendTotal >= fp.amount;
      return {
        id: fp.id,
        title: fp.title,
        amount: fp.amount,
        paymentMode: fp.payment_mode,
        installmentsCount: inst,
        monthlyImpact,
        statusLabel: viableToday
          ? 'viable_today'
          : snapshot.monthlySurplus >= monthlyImpact
          ? 'viable_planned'
          : 'postpone',
      };
    });

    return {
      toolOutput: {
        evaluatedCount: evaluated.length,
        items: evaluated,
        safeToSpendTotal: snapshot.safeToSpendTotal,
        monthlySurplus: snapshot.monthlySurplus,
      },
      proposedActions: [
        {
          id: 'act-nav-fp',
          type: 'navigate_tab',
          label: 'Abrir Futuras Compras',
          confirmLabel: 'Ir al módulo',
          tone: 'blue',
          payload: { tab: 'future_purchases' },
        },
      ],
      metrics: [
        {
          label: 'Ítems Evaluados',
          value: String(evaluated.length),
          tone: 'blue',
        },
        {
          label: 'Viables Hoy',
          value: String(evaluated.filter((e) => e.statusLabel === 'viable_today').length),
          tone: 'emerald',
        },
        {
          label: 'Safe-to-Spend',
          value: formatCLPBackend(snapshot.safeToSpendTotal),
          tone: 'emerald',
        },
      ],
      slotPatch: {
        lastIntent: 'wishlist_evaluation',
        lastFuturePurchaseId: evaluated[0]?.id ?? null,
      },
    };
  }

  // propose_action
  const actionType = rawArgs.action_type;
  const actions: BackendProposedAction[] = [];
  if (actionType === 'mark_recurring_paid') {
    const targetId = typeof rawArgs.target_id === 'string' ? rawArgs.target_id : '';
    const item = dataset.recurringItems.find((r) => r.id === targetId);
    if (item) {
      actions.push({
        id: `act-pay-${item.id}`,
        type: 'mark_recurring_paid',
        label: `Marcar pagado: ${item.title} (${formatCLPBackend(item.amount)})`,
        confirmLabel: 'Marcar pagado',
        tone: 'emerald',
        payload: {
          title: item.title,
          target_type: 'recurring_item',
          target_id: item.id,
          period: snapshot.period,
        },
      });
    }
  } else if (actionType === 'navigate_tab' && typeof rawArgs.tab === 'string') {
    const validTabs = ['summary', 'wallet', 'fixed', 'cards', 'savings', 'future_purchases'];
    if (validTabs.includes(rawArgs.tab)) {
      actions.push({
        id: `act-nav-${rawArgs.tab}`,
        type: 'navigate_tab',
        label: `Ir a pestaña ${rawArgs.tab}`,
        confirmLabel: 'Abrir módulo',
        tone: 'blue',
        payload: {
          tab: rawArgs.tab as BackendProposedAction['payload']['tab'],
        },
      });
    }
  }

  return {
    toolOutput: { ok: actions.length > 0, actionsCount: actions.length },
    proposedActions: actions,
    metrics: [],
    slotPatch: {},
  };
}

const FINANZAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_financial_snapshot',
      description:
        'Obtiene el snapshot exacto actual del usuario: saldo en cuentas vista, Safe-to-Spend, presupuesto diario, ingresos, gastos fijos pendientes, tarjetas de crédito, ahorros, deudas y futuras compras.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'simulate_spend',
      description:
        'Simula un gasto o compra al contado o en cuotas y evalúa si es viable según Safe-to-Spend, remanente mensual y cupo de tarjeta.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Monto total en pesos chilenos CLP' },
          title: { type: 'string', description: 'Nombre del gasto o producto' },
          category: { type: 'string', description: 'Categoría (ej: alimentacion, tecnologia, transporte, entretenimiento, general)' },
          payment_mode: { type: 'string', enum: ['cash', 'installments'] },
          installments_count: { type: 'number', description: 'Número de cuotas si payment_mode es installments' },
          card_brand_or_name: { type: 'string', description: 'Nombre o marca de tarjeta (ej: santander, cmr, falabella)' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'simulate_purchase_installments',
      description:
        'Simula detalladamente una compra en cuotas con impacto en cupo disponible de tarjeta y flujo mensual.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Producto o compra' },
          total_amount: { type: 'number', description: 'Precio total en CLP' },
          installments_count: { type: 'number', description: 'Cantidad de cuotas mensuales' },
          card_name: { type: 'string', description: 'Nombre o banco de la tarjeta' },
        },
        required: ['title', 'total_amount', 'installments_count'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'project_savings_horizon',
      description:
        'Proyecta el ahorro acumulado a N meses considerando ingresos, vencimiento temporal de deudas (end_date) e interés compuesto.',
      parameters: {
        type: 'object',
        properties: {
          months_ahead: { type: 'number', description: 'Cantidad de meses hacia el futuro (1 a 60)' },
        },
        required: ['months_ahead'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'evaluate_future_purchases',
      description:
        'Evalúa la viabilidad de los ítems guardados en la lista de Futuras Compras del usuario.',
      parameters: {
        type: 'object',
        properties: {
          item_query: { type: 'string', description: 'Nombre parcial opcional de un producto específico de la wishlist' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_action',
      description:
        'Propone una tarjeta de acción directa confirmable para marcar un ítem pendiente pagado o navegar a una pestaña del Dashboard.',
      parameters: {
        type: 'object',
        properties: {
          action_type: { type: 'string', enum: ['mark_recurring_paid', 'navigate_tab'] },
          target_id: { type: 'string', description: 'ID real del recurring_item pendiente' },
          tab: {
            type: 'string',
            enum: ['summary', 'wallet', 'fixed', 'cards', 'savings', 'future_purchases'],
          },
        },
        required: ['action_type'],
      },
    },
  },
];

function buildCompactSystemPrompt(snapshot: FinancialSnapshot, slots?: BackendConversationSlots): string {
  const domain = rawFinanzAIKnowledge.domainContext;
  const glossaryLines = Object.entries(domain.glossary)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const ruleLines = domain.responseRules.map((r) => `- ${r}`).join('\n');

  const compactSnapshot = {
    period: snapshot.period,
    safeToSpendTotal: snapshot.safeToSpendTotal,
    dailyBudget: snapshot.dailyBudget,
    checkingBalance: snapshot.checkingBalance,
    monthlyIncome: snapshot.monthlyIncome,
    monthlyRecurringExpenses: snapshot.monthlyRecurringExpenses,
    monthlySurplus: snapshot.monthlySurplus,
    totalSavings: snapshot.totalSavings,
    totalDebt: snapshot.totalDebt,
    cards: snapshot.creditCards.map((c) => ({
      name: c.name,
      availableCredit: c.availableCredit,
      creditLimit: c.creditLimit,
    })),
    futurePurchasesCount: snapshot.activeFuturePurchases.length,
    slots: slots || {},
  };

  return `Eres FinanzAI, asesor financiero personal de FinanzApp (Chile, moneda CLP).
GLOSARIO FINANZAPP:
${glossaryLines}

REGLAS ESTRICTAS:
${ruleLines}
- SIEMPRE llama al menos una herramienta analítica cuando el usuario pregunte por montos, simulaciones, cuotas, proyecciones, tarjetas, compromisos o compras futuras.
- JAMÁS calcules montos mentalmente: usa exclusivamente cifras devueltas por herramientas.
- Responde al usuario SIEMPRE con un objeto JSON válido (sin markdown extra) con exactamente estas llaves:
  {"title":"string","verdict":"string corta","verdictTone":"emerald|amber|coral|blue|neutral","recommendation":"explicación natural cercana de 2-4 frases con cifras exactas en CLP","detailedBreakdown":["dato 1","dato 2"],"suggestedFollowUps":["pregunta seguimiento 1","pregunta seguimiento 2"]}

SNAPSHOT ACTUAL DEL USUARIO:
${JSON.stringify(compactSnapshot)}`;
}

function parseJsonResponseSafely(rawText: string): Partial<BackendStructuredResult> | null {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Partial<BackendStructuredResult>;
  } catch {
    return null;
  }
}

function normalizeToolCalls(
  rawToolCalls: unknown
): Array<{ id?: string; name: string; arguments: Record<string, unknown> }> {
  if (!Array.isArray(rawToolCalls)) return [];
  const parsed: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> = [];
  for (const call of rawToolCalls) {
    if (!call || typeof call !== 'object') continue;
    const obj = call as Record<string, unknown>;
    const fnObj = obj.function && typeof obj.function === 'object'
      ? (obj.function as Record<string, unknown>)
      : null;
    const id = typeof obj.id === 'string' ? obj.id : undefined;
    const name =
      typeof obj.name === 'string'
        ? obj.name
        : fnObj && typeof fnObj.name === 'string'
        ? fnObj.name
        : '';
    if (!name) continue;
    const rawArgs = obj.arguments ?? (fnObj ? fnObj.arguments : {});
    let args: Record<string, unknown> = {};
    if (typeof rawArgs === 'string') {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = {};
      }
    } else if (rawArgs && typeof rawArgs === 'object') {
      args = rawArgs as Record<string, unknown>;
    }
    parsed.push({ id, name, arguments: args });
  }
  return parsed;
}

export async function runWorkersAIChatTurn(params: {
  ai?: Ai;
  db: D1Database;
  model?: string;
  userId: string;
  message: string;
  period?: string;
  slots?: BackendConversationSlots;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<
  | {
      ok: true;
      source: 'workers_ai';
      result: BackendStructuredResult;
      slots: BackendConversationSlots;
      userMessageId: string;
      assistantMessageId: string;
    }
  | { ok: false; fallback: true; reason: string }
> {
  if (!params.ai) {
    return { ok: false, fallback: true, reason: 'Binding AI no disponible en este entorno.' };
  }

  const period = params.period || getCurrentPeriodUTC();
  const dataset = await loadUserFinancialDataset(params.db, params.userId, period);
  const snapshot = buildFinancialSnapshot(dataset);
  const systemPrompt = buildCompactSystemPrompt(snapshot, params.slots);

  const recentHistory = (params.history || [])
    .slice(-6)
    .filter((h) => h.text && h.text.trim().length > 0)
    .map((h) => ({ role: h.role, content: h.text.slice(0, 500) }));

  const conversation: Array<{
    role: string;
    content: string;
    name?: string;
    tool_calls?: unknown;
    tool_call_id?: string;
  }> = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
    { role: 'user', content: params.message },
  ];

  const collectedActions: BackendProposedAction[] = [];
  let collectedMetrics: ToolExecutionBundle['metrics'] = [];
  let mergedSlots: BackendConversationSlots = { ...(params.slots || {}) };
  let finalText = '';

  const modelId = (params.model || DEFAULT_MODEL) as keyof AiModels;

  try {
    for (let round = 0; round < 3; round++) {
      const aiRaw = (await params.ai.run(modelId, {
        messages: conversation,
        tools: FINANZAI_TOOLS,
        temperature: 0.2,
        max_tokens: 900,
      } as Parameters<Ai['run']>[1])) as {
        response?: string;
        tool_calls?: unknown;
      };

      const toolCalls = normalizeToolCalls(aiRaw?.tool_calls);
      if (toolCalls.length === 0) {
        finalText = typeof aiRaw?.response === 'string' ? aiRaw.response.trim() : '';
        break;
      }

      conversation.push({
        role: 'assistant',
        content: aiRaw?.response || '',
        tool_calls: aiRaw?.tool_calls,
      });

      for (const tc of toolCalls) {
        const bundle = executeDeterministicTool(tc.name, tc.arguments, dataset, snapshot);
        if (bundle.proposedActions.length > 0) {
          collectedActions.push(...bundle.proposedActions);
        }
        if (bundle.metrics.length > 0) {
          collectedMetrics = bundle.metrics;
        }
        mergedSlots = { ...mergedSlots, ...bundle.slotPatch };

        conversation.push({
          role: 'tool',
          name: tc.name,
          content: JSON.stringify(bundle.toolOutput),
          ...(tc.id ? { tool_call_id: tc.id } : {}),
        });
      }
    }

    if (!finalText && conversation.some((m) => m.role === 'tool')) {
      const synthesisRaw = (await params.ai.run(modelId, {
        messages: conversation,
        temperature: 0.2,
        max_tokens: 900,
      } as Parameters<Ai['run']>[1])) as {
        response?: string;
      };
      finalText = typeof synthesisRaw?.response === 'string' ? synthesisRaw.response.trim() : '';
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Error ejecutando Workers AI';
    return { ok: false, fallback: true, reason };
  }

  if (!finalText) {
    return { ok: false, fallback: true, reason: 'Workers AI no devolvió contenido textual.' };
  }

  const parsed = parseJsonResponseSafely(finalText);
  const validTones = ['emerald', 'amber', 'coral', 'blue', 'neutral'] as const;
  const parsedTone =
    parsed?.verdictTone && validTones.includes(parsed.verdictTone)
      ? parsed.verdictTone
      : 'blue';

  const recommendation =
    typeof parsed?.recommendation === 'string' && parsed.recommendation.trim()
      ? parsed.recommendation.trim()
      : finalText;

  const result: BackendStructuredResult = {
    intent: mergedSlots.lastIntent || 'workers_ai_chat',
    title:
      typeof parsed?.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : 'Análisis FinanzAI',
    verdict:
      typeof parsed?.verdict === 'string' && parsed.verdict.trim()
        ? parsed.verdict.trim()
        : 'Respuesta basada en tus cuentas reales',
    verdictTone: parsedTone,
    recommendation,
    detailedBreakdown: Array.isArray(parsed?.detailedBreakdown)
      ? parsed.detailedBreakdown.filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
      : [],
    metrics: collectedMetrics.length > 0 ? collectedMetrics : undefined,
    suggestedFollowUps: Array.isArray(parsed?.suggestedFollowUps)
      ? parsed.suggestedFollowUps.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : undefined,
    proposedActions: collectedActions.length > 0 ? collectedActions.slice(0, 4) : undefined,
    updatedSlots: mergedSlots,
  };

  const savedIds = await saveFinanzAITurn(params.db, {
    userId: params.userId,
    userMessage: params.message,
    assistantMessage: result.recommendation,
    source: 'workers_ai',
    structuredResult: result,
    slots: mergedSlots,
    period,
  });

  return {
    ok: true,
    source: 'workers_ai',
    result,
    slots: mergedSlots,
    userMessageId: savedIds.userMessageId,
    assistantMessageId: savedIds.assistantMessageId,
  };
}
