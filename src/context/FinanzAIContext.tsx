import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  Account,
  clearFinanzAIHistoryRemote,
  createFuturePurchase,
  createVariableExpense,
  fetchFinanzAIHistory,
  FuturePurchase,
  getAccounts,
  getFuturePurchases,
  getMonthlyPayments,
  getRecurringItems,
  getVariableExpenses,
  MonthlyPayment,
  RecurringItem,
  sendFinanzAIChatMessage,
  toggleMonthlyPayment,
  VariableExpense,
} from '@/lib/api';
import { getCurrentPeriod } from '@/lib/finance';
import {
  ConversationSlots,
  ProposedChatAction,
  QueryEngineResult,
  queryFinanzAI,
  solveGreetingHelp,
} from '@/lib/queryEngine';
import { getStoredItem, saveStoredItem } from '@/lib/storage';

const CHAT_HISTORY_KEY = 'finanzapp_finanzai_history_v1';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  createdAt: string;
  text: string;
  source?: 'workers_ai' | 'local';
  structuredResult?: QueryEngineResult;
}

export type FinanzAIDashboardTab =
  | 'summary'
  | 'wallet'
  | 'fixed'
  | 'cards'
  | 'savings'
  | 'future_purchases';

interface FinanzAIContextType {
  isOpen: boolean;
  openFinanzAI: (initialQuery?: string) => void;
  closeFinanzAI: () => void;
  currentQuery: string;
  setCurrentQuery: (q: string) => void;
  executeFinanzAIQuery: (queryText: string) => void;
  messages: ChatMessage[];
  slots: ConversationSlots;
  clearConversation: () => void;
  activeResult: QueryEngineResult | null;
  loadingData: boolean;
  isSending: boolean;
  refreshFinancialData: () => Promise<void>;
  executeProposedAction: (action: ProposedChatAction) => Promise<{ ok: boolean; message: string }>;
  mutationVersion: number;
  requestedTab: FinanzAIDashboardTab | null;
  requestDashboardTab: (tab: FinanzAIDashboardTab) => void;
  clearRequestedTab: () => void;
  // Métodos para inyectar datos desde pantallas que ya los tienen en memoria (como Dashboard)
  syncFinancialData: (data: {
    accounts?: Account[];
    recurringItems?: RecurringItem[];
    payments?: MonthlyPayment[];
    variableExpenses?: VariableExpense[];
    futurePurchases?: FuturePurchase[];
    period?: string;
  }) => void;
}

interface PersistedChatState {
  messages: ChatMessage[];
  slots: ConversationSlots;
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function serializeHistoryForStorage(messages: ChatMessage[], slots: ConversationSlots): string {
  const maxMessages = Platform.OS === 'web' ? 30 : 8;
  const sliced = messages.slice(-maxMessages);
  const fullJson = JSON.stringify({ messages: sliced, slots });
  if (Platform.OS === 'web' || fullJson.length <= 1800) {
    return fullJson;
  }
  // En iOS/Android SecureStore (límite ~2KB), compactamos turnos antiguos conservando texto y último resultado
  const compactMsgs = sliced.slice(-4).map((m, idx, arr) => {
    if (idx < arr.length - 1 && m.structuredResult) {
      return {
        ...m,
        structuredResult: {
          ...m.structuredResult,
          detailedBreakdown: [],
          proposedActions: undefined,
        },
      };
    }
    return m;
  });
  return JSON.stringify({ messages: compactMsgs, slots });
}

const FinanzAIContext = createContext<FinanzAIContextType | undefined>(undefined);

export function FinanzAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [slots, setSlots] = useState<ConversationSlots>({});
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const remoteSyncedRef = useRef(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([]);
  const [futurePurchases, setFuturePurchases] = useState<FuturePurchase[]>([]);
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [mutationVersion, setMutationVersion] = useState(0);
  const [requestedTab, setRequestedTab] = useState<FinanzAIDashboardTab | null>(null);

  const financialDataRef = useRef({
    accounts,
    recurringItems,
    payments,
    variableExpenses,
    futurePurchases,
    period,
  });
  financialDataRef.current = {
    accounts,
    recurringItems,
    payments,
    variableExpenses,
    futurePurchases,
    period,
  };

  const slotsRef = useRef<ConversationSlots>(slots);
  slotsRef.current = slots;

  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Hidratar historial conversacional local al montar
  useEffect(() => {
    let active = true;
    getStoredItem(CHAT_HISTORY_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed = JSON.parse(raw) as PersistedChatState;
        if (Array.isArray(parsed.messages)) {
          setMessages(parsed.messages);
          messagesRef.current = parsed.messages;
        }
        if (parsed.slots && typeof parsed.slots === 'object') {
          setSlots(parsed.slots);
          slotsRef.current = parsed.slots;
        }
      })
      .catch(() => {
        // Ignorar historial corrupto
      })
      .finally(() => {
        if (active) setHistoryHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const persistHistory = useCallback((nextMessages: ChatMessage[], nextSlots: ConversationSlots) => {
    try {
      const payload = serializeHistoryForStorage(nextMessages, nextSlots);
      saveStoredItem(CHAT_HISTORY_KEY, payload).catch(() => {});
    } catch {
      // Ignorar errores de cuota de almacenamiento local
    }
  }, []);

  const activeResult: QueryEngineResult | null = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].structuredResult) {
        return messages[i].structuredResult || null;
      }
    }
    return null;
  })();

  const requestDashboardTab = useCallback((tab: FinanzAIDashboardTab) => {
    setRequestedTab(tab);
  }, []);

  const clearRequestedTab = useCallback(() => {
    setRequestedTab(null);
  }, []);

  const refreshFinancialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [accList, recList, payList, varList, fpList] = await Promise.all([
        getAccounts(),
        getRecurringItems(),
        getMonthlyPayments(),
        getVariableExpenses(),
        getFuturePurchases(),
      ]);
      setAccounts(accList);
      setRecurringItems(recList);
      setPayments(payList);
      setVariableExpenses(varList);
      setFuturePurchases(fpList);
      financialDataRef.current = {
        ...financialDataRef.current,
        accounts: accList,
        recurringItems: recList,
        payments: payList,
        variableExpenses: varList,
        futurePurchases: fpList,
      };
    } catch (e) {
      console.warn('FinanzAI: Error al cargar datos financieros:', e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const syncFinancialData = useCallback(
    (data: {
      accounts?: Account[];
      recurringItems?: RecurringItem[];
      payments?: MonthlyPayment[];
      variableExpenses?: VariableExpense[];
      futurePurchases?: FuturePurchase[];
      period?: string;
    }) => {
      if (data.accounts) setAccounts(data.accounts);
      if (data.recurringItems) setRecurringItems(data.recurringItems);
      if (data.payments) setPayments(data.payments);
      if (data.variableExpenses) setVariableExpenses(data.variableExpenses);
      if (data.futurePurchases) setFuturePurchases(data.futurePurchases);
      if (data.period) setPeriod(data.period);
      financialDataRef.current = {
        accounts: data.accounts ?? financialDataRef.current.accounts,
        recurringItems: data.recurringItems ?? financialDataRef.current.recurringItems,
        payments: data.payments ?? financialDataRef.current.payments,
        variableExpenses: data.variableExpenses ?? financialDataRef.current.variableExpenses,
        futurePurchases: data.futurePurchases ?? financialDataRef.current.futurePurchases,
        period: data.period ?? financialDataRef.current.period,
      };
    },
    []
  );

  const appendWelcomeBubble = useCallback(() => {
    const greetingResult = solveGreetingHelp();
    const welcomeMsg: ChatMessage = {
      id: createMessageId('ai'),
      role: 'assistant',
      createdAt: new Date().toISOString(),
      text: greetingResult.recommendation,
      source: 'local',
      structuredResult: greetingResult,
    };
    const nextMessages = [welcomeMsg];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    persistHistory(nextMessages, {});
  }, [persistHistory]);

  const executeFinanzAIQuery = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) return;
      setCurrentQuery(trimmed);

      const userMsg: ChatMessage = {
        id: createMessageId('usr'),
        role: 'user',
        createdAt: new Date().toISOString(),
        text: trimmed,
      };

      const historySnapshot = messagesRef.current
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const withUserMessages = [...messagesRef.current, userMsg];
      messagesRef.current = withUserMessages;
      setMessages(withUserMessages);
      setIsSending(true);

      let aiMsg: ChatMessage | null = null;
      let nextSlots: ConversationSlots = slotsRef.current;

      try {
        const remote = await sendFinanzAIChatMessage({
          message: trimmed,
          period: financialDataRef.current.period,
          slots: slotsRef.current as Record<string, unknown>,
          history: historySnapshot,
        });

        if (remote.ok) {
          const remoteResult = {
            ...remote.result,
            intent: (remote.result.intent || 'fallback') as QueryEngineResult['intent'],
          } as QueryEngineResult;

          nextSlots = (remote.slots || remoteResult.updatedSlots || slotsRef.current) as ConversationSlots;
          aiMsg = {
            id: remote.assistantMessageId || createMessageId('ai'),
            role: 'assistant',
            createdAt: new Date().toISOString(),
            text: remoteResult.recommendation,
            source: 'workers_ai',
            structuredResult: remoteResult,
          };
        }
      } catch {
        // Degradar silenciosamente al motor determinista local
      }

      if (!aiMsg) {
        const localResult = queryFinanzAI(trimmed, financialDataRef.current, slotsRef.current);
        nextSlots = localResult.updatedSlots ?? slotsRef.current;
        aiMsg = {
          id: createMessageId('ai'),
          role: 'assistant',
          createdAt: new Date().toISOString(),
          text: localResult.recommendation,
          source: 'local',
          structuredResult: localResult,
        };
      }

      const nextMessages = [...messagesRef.current, aiMsg];
      messagesRef.current = nextMessages;
      slotsRef.current = nextSlots;

      setMessages(nextMessages);
      setSlots(nextSlots);
      setIsSending(false);
      persistHistory(nextMessages, nextSlots);
    },
    [persistHistory]
  );

  const clearConversation = useCallback(() => {
    setCurrentQuery('');
    slotsRef.current = {};
    setSlots({});
    appendWelcomeBubble();
    clearFinanzAIHistoryRemote().catch(() => {});
  }, [appendWelcomeBubble]);

  const openFinanzAI = useCallback(
    (initialQuery?: string) => {
      setIsOpen(true);

      const syncRemoteIfNeeded = async () => {
        if (remoteSyncedRef.current) return;
        remoteSyncedRef.current = true;
        const remote = await fetchFinanzAIHistory();
        if (remote && remote.messages.length > 0 && messagesRef.current.length <= 1) {
          const restored: ChatMessage[] = remote.messages.map((m) => ({
            id: m.id,
            role: m.role,
            createdAt: m.createdAt,
            text: m.text,
            source: m.source,
            structuredResult: m.structuredResult as QueryEngineResult | undefined,
          }));
          const restoredSlots = (remote.slots || {}) as ConversationSlots;
          messagesRef.current = restored;
          slotsRef.current = restoredSlots;
          setMessages(restored);
          setSlots(restoredSlots);
          persistHistory(restored, restoredSlots);
        }
      };

      const ensureReady = () => {
        if (initialQuery) {
          void executeFinanzAIQuery(initialQuery);
        } else if (messagesRef.current.length === 0) {
          appendWelcomeBubble();
        }
        void syncRemoteIfNeeded();
      };

      // Si aún no tenemos cuentas cargadas, cargar en segundo plano
      if (financialDataRef.current.accounts.length === 0) {
        refreshFinancialData().then(ensureReady);
      } else {
        ensureReady();
      }
    },
    [refreshFinancialData, executeFinanzAIQuery, appendWelcomeBubble, persistHistory]
  );

  // Si el historial terminó de hidratarse con el modal ya abierto y vacío, mostrar bienvenida
  useEffect(() => {
    if (isOpen && historyHydrated && messages.length === 0 && !loadingData) {
      appendWelcomeBubble();
    }
  }, [isOpen, historyHydrated, messages.length, loadingData, appendWelcomeBubble]);

  const closeFinanzAI = useCallback(() => {
    setIsOpen(false);
  }, []);

  const executeProposedAction = useCallback(
    async (action: ProposedChatAction): Promise<{ ok: boolean; message: string }> => {
      try {
        if (action.type === 'navigate_tab') {
          if (action.payload.tab) {
            setRequestedTab(action.payload.tab);
          }
          return { ok: true, message: 'Navegando al módulo correspondiente' };
        }

        if (action.type === 'register_variable_expense') {
          const amount = action.payload.amount || 0;
          if (amount <= 0) {
            return { ok: false, message: 'Monto inválido para registrar gasto.' };
          }
          await createVariableExpense({
            title: action.payload.title || 'Gasto desde FinanzAI',
            amount,
            category: action.payload.category || 'general',
            period: action.payload.period || period,
            date: new Date().toISOString().slice(0, 10),
            account_id: action.payload.account_id ?? null,
            deduct_from_balance: Boolean(action.payload.account_id),
          });
          await refreshFinancialData();
          setMutationVersion((v) => v + 1);
          return { ok: true, message: 'Gasto variable registrado en tus cuentas.' };
        }

        if (action.type === 'save_future_purchase') {
          const amount = action.payload.amount || 0;
          if (amount <= 0) {
            return { ok: false, message: 'Monto inválido para Futuras Compras.' };
          }
          await createFuturePurchase({
            title: action.payload.title || 'Compra evaluada en FinanzAI',
            amount,
            category: action.payload.category || 'otros',
            payment_mode: action.payload.payment_mode || 'one_time_cash',
            installments_count: action.payload.installments_count || 1,
            target_account_id: action.payload.target_account_id ?? null,
            priority: 'medium',
            status: 'evaluating',
          });
          await refreshFinancialData();
          setMutationVersion((v) => v + 1);
          return { ok: true, message: 'Guardado en Compras Futuras.' };
        }

        if (action.type === 'mark_recurring_paid') {
          if (!action.payload.target_id || !action.payload.target_type) {
            return { ok: false, message: 'Falta identificador del compromiso a pagar.' };
          }
          await toggleMonthlyPayment({
            target_type: action.payload.target_type,
            target_id: action.payload.target_id,
            period: action.payload.period || period,
            is_paid: true,
          });
          await refreshFinancialData();
          setMutationVersion((v) => v + 1);
          return { ok: true, message: `"${action.payload.title || 'Ítem'}" marcado como PAGADO.` };
        }

        return { ok: false, message: 'Tipo de acción no soportado.' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo completar la acción.';
        return { ok: false, message: msg };
      }
    },
    [period, refreshFinancialData]
  );

  return (
    <FinanzAIContext.Provider
      value={{
        isOpen,
        openFinanzAI,
        closeFinanzAI,
        currentQuery,
        setCurrentQuery,
        executeFinanzAIQuery,
        messages,
        slots,
        clearConversation,
        activeResult,
        loadingData,
        isSending,
        refreshFinancialData,
        executeProposedAction,
        mutationVersion,
        requestedTab,
        requestDashboardTab,
        clearRequestedTab,
        syncFinancialData,
      }}
    >
      {children}
    </FinanzAIContext.Provider>
  );
}

export function useFinanzAI(): FinanzAIContextType {
  const context = useContext(FinanzAIContext);
  if (!context) {
    throw new Error('useFinanzAI must be used within a FinanzAIProvider');
  }
  return context;
}
