import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Account,
  getAccounts,
  getMonthlyPayments,
  getRecurringItems,
  getVariableExpenses,
  MonthlyPayment,
  RecurringItem,
  VariableExpense,
} from '@/lib/api';
import { getCurrentPeriod } from '@/lib/finance';
import { QueryEngineResult, queryFinanzAI } from '@/lib/queryEngine';

interface FinanzAIContextType {
  isOpen: boolean;
  openFinanzAI: (initialQuery?: string) => void;
  closeFinanzAI: () => void;
  currentQuery: string;
  setCurrentQuery: (q: string) => void;
  executeFinanzAIQuery: (queryText: string) => void;
  activeResult: QueryEngineResult | null;
  loadingData: boolean;
  refreshFinancialData: () => Promise<void>;
  // Métodos para inyectar datos desde pantallas que ya los tienen en memoria (como Dashboard)
  syncFinancialData: (data: {
    accounts?: Account[];
    recurringItems?: RecurringItem[];
    payments?: MonthlyPayment[];
    variableExpenses?: VariableExpense[];
    period?: string;
  }) => void;
}

const FinanzAIContext = createContext<FinanzAIContextType | undefined>(undefined);

export function FinanzAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [activeResult, setActiveResult] = useState<QueryEngineResult | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([]);
  const [period, setPeriod] = useState<string>(getCurrentPeriod());

  const refreshFinancialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [accList, recList, payList, varList] = await Promise.all([
        getAccounts(),
        getRecurringItems(),
        getMonthlyPayments(),
        getVariableExpenses(),
      ]);
      setAccounts(accList);
      setRecurringItems(recList);
      setPayments(payList);
      setVariableExpenses(varList);
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
      period?: string;
    }) => {
      if (data.accounts) setAccounts(data.accounts);
      if (data.recurringItems) setRecurringItems(data.recurringItems);
      if (data.payments) setPayments(data.payments);
      if (data.variableExpenses) setVariableExpenses(data.variableExpenses);
      if (data.period) setPeriod(data.period);
    },
    []
  );

  const executeFinanzAIQuery = useCallback(
    (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) return;
      setCurrentQuery(trimmed);

      const result = queryFinanzAI(trimmed, {
        accounts,
        recurringItems,
        variableExpenses,
        payments,
        period,
      });

      setActiveResult(result);
    },
    [accounts, recurringItems, variableExpenses, payments, period]
  );

  const openFinanzAI = useCallback(
    (initialQuery?: string) => {
      setIsOpen(true);
      // Si aún no tenemos cuentas cargadas, cargar en segundo plano
      if (accounts.length === 0) {
        refreshFinancialData().then(() => {
          if (initialQuery) {
            executeFinanzAIQuery(initialQuery);
          } else {
            executeFinanzAIQuery('hola');
          }
        });
      } else {
        if (initialQuery) {
          executeFinanzAIQuery(initialQuery);
        } else if (!activeResult) {
          executeFinanzAIQuery('hola');
        }
      }
    },
    [accounts.length, refreshFinancialData, executeFinanzAIQuery, activeResult]
  );

  const closeFinanzAI = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <FinanzAIContext.Provider
      value={{
        isOpen,
        openFinanzAI,
        closeFinanzAI,
        currentQuery,
        setCurrentQuery,
        executeFinanzAIQuery,
        activeResult,
        loadingData,
        refreshFinancialData,
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
