import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Landmark,
  LayoutGrid,
  Lightbulb,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  Wallet,
} from 'lucide-react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { CreditCardsSection } from '@/components/finance/CreditCardsSection';
import { ExecutiveSummarySection } from '@/components/finance/ExecutiveSummarySection';
import { FixedItemsSection } from '@/components/finance/FixedItemsSection';
import { FuturePurchasesSection } from '@/components/finance/FuturePurchasesSection';
import { SavingsForecastSection } from '@/components/finance/SavingsForecastSection';
import { WalletSection } from '@/components/finance/WalletSection';
import { GlassCard } from '@/components/ui/GlassCard';
import { FinanzAITriggerButton } from '@/components/ui/FinanzAITriggerButton';
import { PrivacyToggleButton } from '@/components/ui/PrivacyToggleButton';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useFinanzAI } from '@/context/FinanzAIContext';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Account,
  addRecurringSubItem,
  createAccount,
  CreateAccountInput,
  createFuturePurchase,
  CreateFuturePurchaseInput,
  createRecurringItem,
  CreateRecurringItemInput,
  createVariableExpense,
  CreateVariableExpenseInput,
  deleteAccount,
  deleteFuturePurchase,
  deleteRecurringItem,
  deleteVariableExpense,
  FuturePurchase,
  getAccounts,
  getCurrentUser,
  getFuturePurchases,
  getMonthlyPayments,
  getRecurringItems,
  getVariableExpenses,
  MonthlyPayment,
  RecurringItem,
  removeRecurringSubItem,
  toggleMonthlyPayment,
  updateAccount,
  UpdateAccountInput,
  updateFuturePurchase,
  UpdateFuturePurchaseInput,
  updateRecurringItem,
  UpdateRecurringItemInput,
  updateVariableExpense,
  UpdateVariableExpenseInput,
  User,
  VariableExpense,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { exportMonthlyReportToCsv } from '@/lib/exportCsv';
import {
  calculateProjectedPosition,
  formatPeriodFull,
  getCurrentPeriod,
  isItemActiveInMonth,
  savingsAccountToAccountInput,
  shiftPeriod,
} from '@/lib/finance';
import { generateFinancialIntelligence } from '@/lib/intelligence';
import { usePrivacy } from '@/context/PrivacyContext';
import { colors, radius } from '@/theme/tokens';

type DashboardTab = 'summary' | 'wallet' | 'fixed' | 'cards' | 'savings' | 'future_purchases';

export default function DashboardScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();
  const { syncFinancialData } = useFinanzAI();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [exportingQuick, setExportingQuick] = useState(false);

  const [activeTab, setActiveTab] = useState<DashboardTab>('summary');
  const [period, setPeriod] = useState<string>(getCurrentPeriod());

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([]);
  const [futurePurchases, setFuturePurchases] = useState<FuturePurchase[]>([]);

  const mainScrollRef = useRef<ScrollView>(null);

  const handleScrollToCardsEdit = useCallback(() => {
    mainScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const loadAllData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then(async (currentUser) => {
        if (!active) return;
        if (!currentUser) {
          router.replace('/(auth)/login');
          return;
        }
        setUser(currentUser);
        await loadAllData();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, loadAllData]);

  // Sincronizar datos financieros en tiempo real con el Asistente FinanzAI
  useEffect(() => {
    syncFinancialData({
      accounts,
      recurringItems,
      payments,
      variableExpenses,
      futurePurchases,
      period,
    });
  }, [accounts, recurringItems, payments, variableExpenses, futurePurchases, period, syncFinancialData]);

  // Cargar plantilla inicial basada en el Excel y el Motor de Ahorro Dual
  const handleSeedExcelTemplate = async () => {
    setSeeding(true);
    try {
      // 1. Cuenta Corriente Principal
      const checking = await createAccount({
        name: 'Cuenta Corriente Santander',
        type: 'checking',
        current_balance: 1850000,
      });

      // 2. Tarjeta de Crédito Santander
      const santanderCard = await createAccount({
        name: 'Tarjeta Santander',
        type: 'credit_card',
        card_brand: 'santander',
        credit_limit: 4000000,
        current_balance: 320000,
        billing_day: 23,
      });

      // 3. Tarjeta CMR Falabella
      const cmrCard = await createAccount({
        name: 'CMR Falabella',
        type: 'credit_card',
        card_brand: 'falabella',
        credit_limit: 2500000,
        current_balance: 180000,
        billing_day: 5,
      });

      // 4. Cuenta de Ahorro Rentable (4% Anual)
      await createAccount(
        savingsAccountToAccountInput({
          name: 'Ahorro Inversión 4%',
          balance: 1500000,
          annualRatePercent: 4,
          strategy: 'SURPLUS',
          surplusAllocationPercent: 60,
          fixedMonthlyDeposit: 300000,
        })
      );

      // 5. Cuenta de Ahorro Tradicional (0% Sin Interés)
      await createAccount(
        savingsAccountToAccountInput({
          name: 'Fondo Emergencia 0%',
          balance: 800000,
          annualRatePercent: 0,
          strategy: 'FIXED',
          fixedMonthlyDeposit: 150000,
          surplusAllocationPercent: 40,
        })
      );

      // Ingreso fijo mensual
      await createRecurringItem({
        account_id: checking.id,
        title: 'Sueldo Líquido Mensual',
        amount: 2650000,
        type: 'income',
        category: 'sueldo',
        start_date: '2026-01',
        is_active: true,
      });

      // Gasto con fecha límite: Crédito Vehicular hasta Diciembre 2026
      await createRecurringItem({
        account_id: checking.id,
        title: 'Crédito Vehicular (Hasta Dic 2026)',
        amount: 310000,
        type: 'expense',
        category: 'transporte',
        start_date: '2025-01',
        end_date: '2026-12',
        is_active: true,
      });

      // Gasto con fecha límite: Arancel / Compromiso hasta Abril 2027
      await createRecurringItem({
        account_id: cmrCard.id,
        title: 'Arancel Educación (Hasta Abr 2027)',
        amount: 215000,
        type: 'expense',
        category: 'educacion',
        start_date: '2026-03',
        end_date: '2027-04',
        is_active: true,
      });

      // Gasto Matriz con Sub-ítems anidados: Paquete Suscripciones (Apple + YouTube + SmartFit)
      await createRecurringItem({
        account_id: santanderCard.id,
        title: 'Paquete Suscripciones & Gym',
        type: 'expense',
        category: 'suscripciones',
        start_date: '2026-01',
        is_active: true,
        sub_items: [
          { name: 'Apple One', amount: 14990 },
          { name: 'YouTube Premium', amount: 9500 },
          { name: 'SmartFit Black', amount: 29900 },
        ],
      });

      // Cuota fija mensual del Préstamo Santander 2026-2028
      await createRecurringItem({
        account_id: checking.id,
        title: 'Cuota Préstamo Santander (Hasta Oct 2028)',
        amount: 245000,
        type: 'expense',
        category: 'prestamo',
        start_date: '2026-01',
        end_date: '2028-10',
        is_active: true,
      });

      await loadAllData();
    } finally {
      setSeeding(false);
    }
  };

  // Handlers de mutación conectados a Cloudflare D1
  const handleToggleRecurringPaid = async (itemId: string) => {
    const updated = await toggleMonthlyPayment({
      target_type: 'recurring_item',
      target_id: itemId,
      period,
    });
    setPayments((prev) => {
      const filtered = prev.filter(
        (p) =>
          !(
            p.target_type === 'recurring_item' &&
            p.target_id === itemId &&
            p.period === period
          )
      );
      return [...filtered, updated];
    });
  };

  const handleToggleCardPaid = async (cardId: string) => {
    const updated = await toggleMonthlyPayment({
      target_type: 'credit_card',
      target_id: cardId,
      period,
    });
    setPayments((prev) => {
      const filtered = prev.filter(
        (p) =>
          !(
            p.target_type === 'credit_card' &&
            p.target_id === cardId &&
            p.period === period
          )
      );
      return [...filtered, updated];
    });
  };

  const handleCreateAccount = async (input: CreateAccountInput) => {
    await createAccount(input);
    await loadAllData();
  };

  const handleUpdateAccount = async (id: string, input: UpdateAccountInput) => {
    await updateAccount(id, input);
    await loadAllData();
  };

  const handleDeleteAccount = async (id: string) => {
    await deleteAccount(id);
    await loadAllData();
  };

  const handleCreateRecurringItem = async (input: CreateRecurringItemInput) => {
    await createRecurringItem(input);
    await loadAllData();
  };

  const handleUpdateRecurringItem = async (
    id: string,
    input: UpdateRecurringItemInput
  ) => {
    await updateRecurringItem(id, input);
    await loadAllData();
  };

  const handleDeleteRecurringItem = async (id: string) => {
    await deleteRecurringItem(id);
    await loadAllData();
  };

  const handleAddSubItem = async (
    recurringItemId: string,
    input: { name: string; amount: number }
  ) => {
    await addRecurringSubItem(recurringItemId, input);
    await loadAllData();
  };

  const handleRemoveSubItem = async (recurringItemId: string, subItemId: string) => {
    await removeRecurringSubItem(recurringItemId, subItemId);
    await loadAllData();
  };

  const handleCreateVariableExpense = async (
    input: CreateVariableExpenseInput
  ) => {
    const defaultChecking = accounts.find((a) => a.type === 'checking');
    const payload: CreateVariableExpenseInput = {
      ...input,
      account_id: input.account_id || defaultChecking?.id || undefined,
      deduct_from_balance: false,
    };
    await createVariableExpense(payload);
    await loadAllData();
  };

  const handleDeleteVariableExpense = async (id: string) => {
    const expenseToDelete = variableExpenses.find((exp) => exp.id === id);
    const targetAcc = expenseToDelete?.account_id
      ? accounts.find((a) => a.id === expenseToDelete.account_id)
      : undefined;
    const preservedBaseBalance = targetAcc?.current_balance;

    const res = await deleteVariableExpense(id);

    // Si el Worker remoto alteró el saldo base de la cuenta al eliminar el gasto,
    // restaurar el Saldo Base original para que el Sueldo Libre Inicial permanezca intacto.
    if (res?.balance_restored && targetAcc && preservedBaseBalance !== undefined) {
      try {
        await updateAccount(targetAcc.id, {
          current_balance: preservedBaseBalance,
        });
      } catch (err) {
        console.error('Error al preservar saldo base de cuenta:', err);
      }
    }

    await loadAllData();
  };

  const handleUpdateVariableExpense = async (
    id: string,
    input: UpdateVariableExpenseInput
  ) => {
    const existing = variableExpenses.find((exp) => exp.id === id);
    const affectedIds = new Set<string>();
    if (existing?.account_id) affectedIds.add(existing.account_id);
    if (input.account_id) affectedIds.add(input.account_id);
    const preservedBalances = new Map<string, number>();
    for (const accId of affectedIds) {
      const acc = accounts.find((a) => a.id === accId);
      if (acc) preservedBalances.set(accId, acc.current_balance);
    }

    await updateVariableExpense(id, input);

    // Preservar intacto el Saldo Base de las cuentas afectadas
    for (const [accId, baseBal] of preservedBalances.entries()) {
      try {
        await updateAccount(accId, { current_balance: baseBal });
      } catch (err) {
        console.error('Error al preservar saldo base tras editar gasto:', err);
      }
    }

    await loadAllData();
  };

  const handleCreateFuturePurchase = async (input: CreateFuturePurchaseInput) => {
    await createFuturePurchase(input);
    await loadAllData();
  };

  const handleUpdateFuturePurchase = async (
    id: string,
    input: UpdateFuturePurchaseInput
  ) => {
    await updateFuturePurchase(id, input);
    await loadAllData();
  };

  const handleDeleteFuturePurchase = async (id: string) => {
    await deleteFuturePurchase(id);
    await loadAllData();
  };

  // Proyección dinámica del Patrimonio Neto y Liquidez según el mes seleccionado (period)
  const currentBasePeriod = getCurrentPeriod();
  const isCurrentPeriod = period === currentBasePeriod;

  const projected = useMemo(
    () =>
      calculateProjectedPosition(
        currentBasePeriod,
        period,
        accounts,
        recurringItems,
        { variableExpenses }
      ),
    [currentBasePeriod, period, accounts, recurringItems, variableExpenses]
  );

  // Resumen mensual activo en el periodo
  const activeInMonth = useMemo(
    () => recurringItems.filter((item) => isItemActiveInMonth(item, period)),
    [recurringItems, period]
  );
  const monthlyIncome = useMemo(
    () =>
      activeInMonth
        .filter((i) => i.type === 'income')
        .reduce((sum, i) => sum + i.amount, 0),
    [activeInMonth]
  );
  const monthlyExpense = useMemo(
    () =>
      activeInMonth
        .filter((i) => i.type === 'expense')
        .reduce((sum, i) => sum + i.amount, 0),
    [activeInMonth]
  );
  const monthlyFreeCash = monthlyIncome - monthlyExpense;

  const intelligenceReport = useMemo(
    () =>
      generateFinancialIntelligence({
        period,
        accounts,
        recurringItems,
        variableExpenses,
        futurePurchases,
      }),
    [period, accounts, recurringItems, variableExpenses, futurePurchases, isPrivacyEnabled]
  );
  const topInsight = intelligenceReport.insights[0];

  const savingsTotal = projected.savingsBalance;
  const totalDebt = projected.totalDebt;
  const netWorthWithSavings = monthlyIncome + savingsTotal - totalDebt;
  const netWorthWithoutSavings = monthlyIncome - totalDebt;
  const checkingTotal = projected.checkingBalance;
  const netWorth = netWorthWithSavings;

  const paidItemIdsInPeriod = useMemo(
    () =>
      new Set(
        payments
          .filter(
            (p) =>
              p.target_type === 'recurring_item' &&
              p.period === period &&
              p.is_paid
          )
          .map((p) => p.target_id)
      ),
    [payments, period]
  );

  const paidCardIdsInPeriod = useMemo(
    () =>
      new Set(
        payments
          .filter(
            (p) =>
              p.target_type === 'credit_card' &&
              p.period === period &&
              p.is_paid
          )
          .map((p) => p.target_id)
      ),
    [payments, period]
  );

  const handleQuickExportCsv = async () => {
    setExportingQuick(true);
    try {
      await exportMonthlyReportToCsv({
        period,
        accounts,
        recurringItems,
        paidItemIdsInPeriod,
        variableExpenses,
      });
    } finally {
      setExportingQuick(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer centered={false} maxWidth={920}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.textPrimary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollRef={mainScrollRef} centered={false} maxWidth={920}>
      <View style={styles.pageStack}>
        {/* Tarjeta Superior de Cabecera y Resumen Ejecutivo */}
        <GlassCard>
          <View style={styles.headerRow}>
            <View style={styles.headerIdentityCol}>
              <Text style={styles.brand}>FinanzApp · Consola Financiera</Text>
              <Text style={styles.welcome}>
                Hola{user?.name ? `, ${user.name}` : ''}
              </Text>
              {user?.email ? (
                <Text style={styles.email}>{user.email}</Text>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.headerControlsScrollView,
                !isDesktop && styles.headerControlsScrollViewMobile,
              ]}
              contentContainerStyle={styles.headerControlsScroll}
            >
              {/* Selector de Periodo Mes a Mes */}
              <View style={styles.periodPicker}>
                <Pressable
                  onPress={() => setPeriod(shiftPeriod(period, -1))}
                  style={styles.periodIconBtn}
                >
                  <ChevronLeft size={16} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.periodText}>{formatPeriodFull(period)}</Text>
                <Pressable
                  onPress={() => setPeriod(shiftPeriod(period, 1))}
                  style={styles.periodIconBtn}
                >
                  <ChevronRight size={16} color={colors.textPrimary} />
                </Pressable>
                {period !== getCurrentPeriod() ? (
                  <Pressable
                    onPress={() => setPeriod(getCurrentPeriod())}
                    style={styles.todayChip}
                  >
                    <Text style={styles.todayChipText}>Hoy</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Modo Privado / Ocultar Montos en Transporte Público */}
              <PrivacyToggleButton />

              {/* Asistente FinanzAI */}
              <FinanzAITriggerButton variant="inline" label="FinanzAI" />

              {/* Exportar CSV / Excel */}
              <Pressable
                onPress={handleQuickExportCsv}
                disabled={exportingQuick}
                style={styles.quickHeaderBtn}
              >
                <Download size={13} color="#34D399" />
                <Text style={styles.quickHeaderBtnTextEmerald}>
                  {exportingQuick ? 'Exportando...' : 'CSV / Excel'}
                </Text>
              </Pressable>

              {/* Consejos Inteligentes */}
              <Pressable
                onPress={() => router.push({ pathname: '/(main)/tips', params: { period } })}
                style={styles.quickHeaderBtn}
              >
                <Lightbulb size={13} color={colors.textPrimary} />
                <Text style={styles.quickHeaderBtnText}>Consejos</Text>
              </Pressable>

              {/* Perfil */}
              <Pressable
                onPress={() => router.push('/(main)/profile')}
                style={styles.quickHeaderBtn}
              >
                <UserIcon size={13} color={colors.textPrimary} />
                <Text style={styles.quickHeaderBtnText}>Perfil</Text>
              </Pressable>
            </ScrollView>
          </View>

          <View style={styles.divider} />

          <View style={styles.topSummaryRow}>
            <View style={styles.balanceSection}>
              <View style={styles.balanceHeaderRow}>
                <Text style={styles.balanceLabel}>
                  {isCurrentPeriod
                    ? 'PATRIMONIO NETO CONSOLIDADO (CON AHORROS)'
                    : `PATRIMONIO NETO PROYECTADO (${formatPeriodFull(period).toUpperCase()})`}
                </Text>
                {!isCurrentPeriod ? (
                  <View
                    style={[
                      styles.diffPill,
                      projected.diffFromCurrentNetWorth >= 0
                        ? styles.diffPillPositive
                        : styles.diffPillNegative,
                    ]}
                  >
                    <Text
                      style={[
                        styles.diffPillText,
                        projected.diffFromCurrentNetWorth >= 0
                          ? styles.diffPillTextPositive
                          : styles.diffPillTextNegative,
                      ]}
                    >
                      {projected.diffFromCurrentNetWorth >= 0 ? '+' : ''}
                      {formatCLP(projected.diffFromCurrentNetWorth)} vs hoy
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.balanceAmount,
                  !isDesktop && styles.balanceAmountMobile,
                ]}
              >
                {formatCLP(netWorthWithSavings)}
              </Text>
              <Text style={styles.balanceSubHint}>
                Ingresos ({formatCLP(monthlyIncome)}) + Ahorro ({formatCLP(savingsTotal)}) − Deudas Totales ({formatCLP(totalDebt)})
              </Text>

              {/* Desglose: Total Sin Ahorros (Margen Operativo Mensual) */}
              <View style={styles.withoutSavingsRow}>
                <Text style={styles.withoutSavingsLabel}>
                  TOTAL SIN AHORROS (MARGEN OPERATIVO):
                </Text>
                <Text
                  style={[
                    styles.withoutSavingsValue,
                    netWorthWithoutSavings >= 0
                      ? styles.withoutSavingsPos
                      : styles.withoutSavingsNeg,
                  ]}
                >
                  {formatCLP(netWorthWithoutSavings)}
                </Text>
              </View>

              {/* Composición Consolidada de Deudas del Periodo */}
              {totalDebt > 0 ? (
                <View style={styles.debtCompositionRow}>
                  <Text style={styles.debtCompositionLabel}>
                    COMPOSICIÓN DE DEUDAS ({formatPeriodFull(period).toUpperCase()}):
                  </Text>
                  <View style={styles.debtCompositionChips}>
                    {projected.creditCardsDebt > 0 ? (
                      <View style={styles.debtCompChip}>
                        <CreditCard size={11} color={colors.textSecondary} />
                        <Text style={styles.debtCompChipText}>
                          Tarjetas: {formatCLP(projected.creditCardsDebt)}
                        </Text>
                      </View>
                    ) : null}

                    {projected.fixedLoansDebt > 0 ? (
                      <View style={styles.debtCompChip}>
                        <Clock size={11} color="#FB923C" />
                        <Text style={[styles.debtCompChipText, { color: '#FB923C' }]}>
                          Préstamos & Créditos Fijos: {formatCLP(projected.fixedLoansDebt)}
                        </Text>
                      </View>
                    ) : null}

                    {projected.loansDebt > 0 ? (
                      <View style={styles.debtCompChip}>
                        <Landmark size={11} color="#FB923C" />
                        <Text style={[styles.debtCompChipText, { color: '#FB923C' }]}>
                          Cuentas Préstamo: {formatCLP(projected.loansDebt)}
                        </Text>
                      </View>
                    ) : null}

                    {projected.variableLoansDebt > 0 ? (
                      <View style={styles.debtCompChip}>
                        <Wallet size={11} color="#F87171" />
                        <Text style={[styles.debtCompChipText, { color: '#F87171' }]}>
                          Deudas Variables: {formatCLP(projected.variableLoansDebt)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.freeCashMiniCard}>
              <Text style={styles.freeCashMiniLabel}>
                FLUJO DE CAJA LIBRE ({period})
              </Text>
              <Text style={styles.freeCashMiniValue}>
                {formatCLP(monthlyFreeCash)}
              </Text>
              <Text style={styles.freeCashMiniSub}>
                Ingresos {formatCLP(monthlyIncome)} − Gastos {formatCLP(monthlyExpense)}
              </Text>
            </View>

            {accounts.length === 0 ? (
              <View style={styles.seedBanner}>
                <View style={styles.seedBannerTextCol}>
                  <View style={styles.seedTitleRow}>
                    <Sparkles size={15} color={colors.textPrimary} />
                    <Text style={styles.seedTitle}>
                      ¿Reemplazar tu Excel con 1 clic?
                    </Text>
                  </View>
                  <Text style={styles.seedDesc}>
                    Carga tu estructura base (Santander, CMR Falabella, Apple + YouTube + SmartFit, Crédito Vehicular Dic 2026 y Cuentas de Ahorro 4% y 0%).
                  </Text>
                </View>
                <TeslaButton
                  title="Cargar Plantilla Excel"
                  onPress={handleSeedExcelTemplate}
                  loading={seeding}
                />
              </View>
            ) : null}
          </View>

          {/* FinanzAI Intelligence Engine Executive Banner */}
          {topInsight ? (
            <Pressable
              onPress={() => router.push({ pathname: '/(main)/tips', params: { period } })}
              style={({ pressed }) => [
                styles.intelligenceHighlightCard,
                topInsight.tone === 'critical' && styles.intelligenceCardCritical,
                topInsight.tone === 'warning' && styles.intelligenceCardWarning,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.intelligenceHighlightLeft}>
                <View
                  style={[
                    styles.intelligenceIconBadge,
                    topInsight.tone === 'critical'
                      ? styles.intelligenceBadgeCritical
                      : styles.intelligenceBadgeDefault,
                  ]}
                >
                  <Sparkles
                    size={14}
                    color={
                      topInsight.tone === 'critical'
                        ? '#F87171'
                        : topInsight.tone === 'warning'
                        ? '#F59E0B'
                        : '#34D399'
                    }
                  />
                </View>
                <View style={styles.intelligenceTextCol}>
                  <View style={styles.intelligenceMetaRow}>
                    <Text style={styles.intelligenceEyebrow}>
                      FINANZAI DIAGNÓSTICO
                    </Text>
                    <View style={styles.intelligenceScorePill}>
                      <Text style={styles.intelligenceScorePillText}>
                        Score: {intelligenceReport.overallScore}/100 · {intelligenceReport.healthStatus}
                      </Text>
                    </View>
                    {topInsight.potentialSavingsCLP ? (
                      <View style={styles.intelligenceSavingsPill}>
                        <Text style={styles.intelligenceSavingsPillText}>
                          +{formatCLP(topInsight.potentialSavingsCLP)}/mes
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.intelligenceTitle} numberOfLines={1}>
                    {topInsight.title}
                  </Text>
                  <Text style={styles.intelligenceDesc} numberOfLines={2}>
                    {topInsight.summary} {topInsight.actionStep}
                  </Text>
                </View>
              </View>

              <View style={styles.intelligenceActionBtn}>
                <Text style={styles.intelligenceActionBtnText}>Ver Análisis</Text>
                <ChevronRight size={14} color="#34D399" />
              </View>
            </Pressable>
          ) : null}
        </GlassCard>

        {/* Navegación Interna de Módulos (Resumen | Fijos | Tarjetas | Ahorro) */}
        <View style={styles.moduleTabsBar}>
          <Pressable
            onPress={() => setActiveTab('summary')}
            style={[
              styles.moduleTab,
              activeTab === 'summary' && styles.moduleTabActive,
            ]}
          >
            <LayoutGrid
              size={14}
              color={
                activeTab === 'summary'
                  ? colors.buttonPrimaryText
                  : colors.textSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleTabText,
                activeTab === 'summary' && styles.moduleTabTextActive,
              ]}
            >
              {isDesktop ? 'Resumen Ejecutivo' : 'Resumen'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('wallet')}
            style={[
              styles.moduleTab,
              activeTab === 'wallet' && styles.moduleTabActive,
            ]}
          >
            <Wallet
              size={14}
              color={
                activeTab === 'wallet'
                  ? colors.buttonPrimaryText
                  : colors.textSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleTabText,
                activeTab === 'wallet' && styles.moduleTabTextActive,
              ]}
            >
              {isDesktop ? 'Cuentas & Variables' : 'Billetera'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('fixed')}
            style={[
              styles.moduleTab,
              activeTab === 'fixed' && styles.moduleTabActive,
            ]}
          >
            <CheckSquare
              size={14}
              color={
                activeTab === 'fixed'
                  ? colors.buttonPrimaryText
                  : colors.textSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleTabText,
                activeTab === 'fixed' && styles.moduleTabTextActive,
              ]}
            >
              {isDesktop ? 'Gastos e Ingresos Fijos' : 'Fijos'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('cards')}
            style={[
              styles.moduleTab,
              activeTab === 'cards' && styles.moduleTabActive,
            ]}
          >
            <CreditCard
              size={14}
              color={
                activeTab === 'cards'
                  ? colors.buttonPrimaryText
                  : colors.textSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleTabText,
                activeTab === 'cards' && styles.moduleTabTextActive,
              ]}
            >
              {isDesktop ? 'Tarjetas y Cupos' : 'Tarjetas'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('savings')}
            style={[
              styles.moduleTab,
              activeTab === 'savings' && styles.moduleTabActive,
            ]}
          >
            <PiggyBank
              size={14}
              color={
                activeTab === 'savings'
                  ? colors.buttonPrimaryText
                  : colors.textSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleTabText,
                activeTab === 'savings' && styles.moduleTabTextActive,
              ]}
            >
              {isDesktop ? 'Ahorro y Pronóstico' : 'Ahorro'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('future_purchases')}
            style={[
              styles.moduleTab,
              activeTab === 'future_purchases' && styles.moduleTabActive,
            ]}
          >
            <ShoppingBag
              size={14}
              color={
                activeTab === 'future_purchases'
                  ? colors.buttonPrimaryText
                  : colors.textSecondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.moduleTabText,
                activeTab === 'future_purchases' && styles.moduleTabTextActive,
              ]}
            >
              {isDesktop ? 'Compras Futuras' : 'Deseos'}
            </Text>
          </Pressable>
        </View>

        {/* Contenido del Módulo Seleccionado */}
        {activeTab === 'summary' ? (
          <ExecutiveSummarySection
            period={period}
            onChangePeriod={setPeriod}
            accounts={accounts}
            recurringItems={recurringItems}
            paidItemIdsInPeriod={paidItemIdsInPeriod}
            variableExpenses={variableExpenses}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        ) : null}

        {activeTab === 'wallet' ? (
          <WalletSection
            period={period}
            onChangePeriod={setPeriod}
            accounts={accounts}
            recurringItems={recurringItems}
            variableExpenses={variableExpenses}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
            onCreateVariableExpense={handleCreateVariableExpense}
            onUpdateVariableExpense={handleUpdateVariableExpense}
            onDeleteVariableExpense={handleDeleteVariableExpense}
          />
        ) : null}

        {activeTab === 'fixed' ? (
          <FixedItemsSection
            period={period}
            onChangePeriod={setPeriod}
            accounts={accounts}
            recurringItems={recurringItems}
            paidItemIdsInPeriod={paidItemIdsInPeriod}
            paidCardIdsInPeriod={paidCardIdsInPeriod}
            onTogglePaid={handleToggleRecurringPaid}
            onToggleCardPaid={handleToggleCardPaid}
            onCreateRecurringItem={handleCreateRecurringItem}
            onUpdateRecurringItem={handleUpdateRecurringItem}
            onDeleteRecurringItem={handleDeleteRecurringItem}
            onAddSubItem={handleAddSubItem}
            onRemoveSubItem={handleRemoveSubItem}
          />
        ) : null}

        {activeTab === 'cards' ? (
          <CreditCardsSection
            period={period}
            accounts={accounts}
            recurringItems={recurringItems}
            onScrollToEdit={handleScrollToCardsEdit}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
            onCreateRecurringItem={handleCreateRecurringItem}
            onUpdateRecurringItem={handleUpdateRecurringItem}
            onDeleteRecurringItem={handleDeleteRecurringItem}
            onAddSubItem={handleAddSubItem}
            onRemoveSubItem={handleRemoveSubItem}
          />
        ) : null}

        {activeTab === 'savings' ? (
          <SavingsForecastSection
            period={period}
            accounts={accounts}
            recurringItems={recurringItems}
            currentUserId={user?.id}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        ) : null}

        {activeTab === 'future_purchases' ? (
          <FuturePurchasesSection
            period={period}
            accounts={accounts}
            recurringItems={recurringItems}
            variableExpenses={variableExpenses}
            payments={payments}
            futurePurchases={futurePurchases}
            overallHealthScore={intelligenceReport.overallScore}
            onCreateFuturePurchase={handleCreateFuturePurchase}
            onUpdateFuturePurchase={handleUpdateFuturePurchase}
            onDeleteFuturePurchase={handleDeleteFuturePurchase}
            onCreateVariableExpense={handleCreateVariableExpense}
            onCreateRecurringItem={handleCreateRecurringItem}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageStack: {
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
    gap: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerIdentityCol: {
    flexShrink: 1,
  },
  brand: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  welcome: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  email: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  headerControlsScrollView: {
    maxWidth: '100%',
    flexGrow: 0,
  },
  headerControlsScrollViewMobile: {
    width: '100%',
    marginTop: 8,
  },
  headerControlsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 16,
  },
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  periodPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexShrink: 0,
  },
  periodIconBtn: {
    padding: 5,
    borderRadius: radius.pill,
  },
  periodText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 110,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  todayChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
  },
  todayChipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  headerQuickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  quickHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexShrink: 0,
  },
  quickHeaderBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickHeaderBtnTextEmerald: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 20,
  },
  topSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  balanceSection: {
    paddingVertical: 4,
    flex: 1,
    minWidth: 230,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  diffPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  diffPillPositive: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  diffPillNegative: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  diffPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  diffPillTextPositive: {
    color: '#34D399',
  },
  diffPillTextNegative: {
    color: '#F87171',
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  balanceAmount: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    lineHeight: 42,
  },
  balanceAmountMobile: {
    fontSize: 28,
    lineHeight: 34,
  },
  balanceSubHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  withoutSavingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  withoutSavingsLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 14,
  },
  withoutSavingsValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 17,
  },
  withoutSavingsPos: {
    color: colors.textPrimary,
  },
  withoutSavingsNeg: {
    color: '#F87171',
  },
  debtCompositionRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 6,
  },
  debtCompositionLabel: {
    color: colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  debtCompositionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  debtCompChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  debtCompChipText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  freeCashMiniCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 4,
  },
  freeCashMiniLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 14,
  },
  freeCashMiniValue: {
    color: '#34D399',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  freeCashMiniSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    lineHeight: 16,
  },
  seedBanner: {
    width: '100%',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  seedBannerTextCol: {
    gap: 4,
  },
  seedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seedTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  seedDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  moduleTabsBar: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  moduleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  moduleTabActive: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  moduleTabText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  moduleTabTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  intelligenceHighlightCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  intelligenceCardCritical: {
    borderColor: 'rgba(248, 113, 113, 0.38)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },
  intelligenceCardWarning: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  intelligenceHighlightLeft: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  intelligenceIconBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  intelligenceBadgeDefault: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  intelligenceBadgeCritical: {
    borderColor: 'rgba(248, 113, 113, 0.35)',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  intelligenceTextCol: {
    flex: 1,
    gap: 3,
  },
  intelligenceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  intelligenceEyebrow: {
    color: '#34D399',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  intelligenceScorePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  intelligenceScorePillText: {
    color: colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  intelligenceSavingsPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  intelligenceSavingsPillText: {
    color: '#34D399',
    fontSize: 9.5,
    fontWeight: '700',
  },
  intelligenceTitle: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  intelligenceDesc: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  intelligenceActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  intelligenceActionBtnText: {
    color: colors.textPrimary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
