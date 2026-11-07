import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FinancialTipsSection } from '@/components/finance/FinancialTipsSection';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  Account,
  getAccounts,
  getCurrentUser,
  getRecurringItems,
  getVariableExpenses,
  RecurringItem,
  VariableExpense,
} from '@/lib/api';
import { getCurrentPeriod } from '@/lib/finance';
import { colors } from '@/theme/tokens';

export default function TipsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ period?: string }>();
  const initialPeriod =
    typeof params.period === 'string' && /^\d{4}-\d{2}$/.test(params.period.trim())
      ? params.period.trim()
      : getCurrentPeriod();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(initialPeriod);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([]);

  // Sincronizar si cambian los parámetros de navegación externa
  useEffect(() => {
    if (
      typeof params.period === 'string' &&
      /^\d{4}-\d{2}$/.test(params.period.trim()) &&
      params.period.trim() !== period
    ) {
      const nextPeriod = params.period.trim();
      setPeriod(nextPeriod);
      getVariableExpenses(nextPeriod)
        .then((varList) => setVariableExpenses(varList))
        .catch(() => {});
    }
  }, [params.period, period]);

  // Carga inicial completa de usuario, cuentas, recurrentes y gastos variables
  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          router.replace('/(auth)/login');
          return;
        }
        const [accList, recList, varList] = await Promise.all([
          getAccounts(),
          getRecurringItems(),
          getVariableExpenses(period),
        ]);
        if (!active) return;
        setAccounts(accList);
        setRecurringItems(recList);
        setVariableExpenses(varList);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  // Cambio de período interactivo mes a mes
  const handleChangePeriod = useCallback(async (newPeriod: string) => {
    setPeriod(newPeriod);
    try {
      const varList = await getVariableExpenses(newPeriod);
      setVariableExpenses(varList);
    } catch (e) {
      console.warn('Error al actualizar gastos variables para el período:', e);
    }
  }, []);

  if (loading) {
    return (
      <ScreenContainer centered={false} maxWidth={920}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.textPrimary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer centered={false} maxWidth={920}>
      <View style={styles.pageStack}>
        <FinancialTipsSection
          period={period}
          onChangePeriod={handleChangePeriod}
          accounts={accounts}
          recurringItems={recurringItems}
          variableExpenses={variableExpenses}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pageStack: {
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
    gap: 20,
    paddingBottom: 32,
  },
});
