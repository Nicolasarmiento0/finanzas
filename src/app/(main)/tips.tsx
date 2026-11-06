import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FinancialTipsSection } from '@/components/finance/FinancialTipsSection';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import {
  Account,
  getAccounts,
  getCurrentUser,
  getRecurringItems,
  RecurringItem,
} from '@/lib/api';
import { getCurrentPeriod } from '@/lib/finance';
import { colors } from '@/theme/tokens';

export default function TipsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const period = getCurrentPeriod();

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          router.replace('/(auth)/login');
          return;
        }
        const [accList, recList] = await Promise.all([
          getAccounts(),
          getRecurringItems(),
        ]);
        if (!active) return;
        setAccounts(accList);
        setRecurringItems(recList);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

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
          accounts={accounts}
          recurringItems={recurringItems}
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
  },
  pageStack: {
    width: '100%',
    gap: 20,
    paddingBottom: 32,
  },
});
