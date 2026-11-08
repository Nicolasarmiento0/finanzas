import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Coins,
  DollarSign,
  HandCoins,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  Utensils,
  Wallet,
  X,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import { usePrivacy } from '@/context/PrivacyContext';
import { QuickExpenseShortcuts } from './QuickExpenseShortcuts';
import {
  Account,
  CreateAccountInput,
  CreateVariableExpenseInput,
  RecurringItem,
  UpdateAccountInput,
  UpdateVariableExpenseInput,
  VariableExpense,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import {
  formatPeriodFull,
  getCategoryColor,
  isItemActiveInMonth,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

const VARIABLE_QUICK_CATEGORIES = [
  { id: 'alimentacion', label: 'Almuerzo / Comida', icon: Utensils, color: '#10B981' },
  { id: 'bebidas', label: 'Bebida / Café', icon: Coffee, color: '#F59E0B' },
  { id: 'transporte', label: 'Transporte / Uber', icon: Tag, color: '#38BDF8' },
  { id: 'entretenimiento', label: 'Ocio / Salidas', icon: Sparkles, color: '#EC4899' },
  { id: 'prestamo', label: 'Préstamo / Deuda', icon: HandCoins, color: '#FB923C' },
  { id: 'general', label: 'Compras / Varios', icon: Receipt, color: '#94A3B8' },
];

interface WalletSectionProps {
  period: string;
  onChangePeriod: (nextPeriod: string) => void;
  accounts: Account[];
  recurringItems: RecurringItem[];
  variableExpenses: VariableExpense[];
  onCreateAccount: (input: CreateAccountInput) => Promise<void>;
  onUpdateAccount: (id: string, input: UpdateAccountInput) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateVariableExpense: (input: CreateVariableExpenseInput) => Promise<void>;
  onUpdateVariableExpense?: (id: string, input: UpdateVariableExpenseInput) => Promise<void>;
  onDeleteVariableExpense: (id: string) => Promise<void>;
}

export function WalletSection({
  period,
  onChangePeriod,
  accounts,
  recurringItems,
  variableExpenses,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateVariableExpense,
  onUpdateVariableExpense,
  onDeleteVariableExpense,
}: WalletSectionProps) {
  const { isDesktop, isMobile } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();

  // Gestión de Cuentas Corrientes / Vista
  const [showCheckingForm, setShowCheckingForm] = useState(false);
  const [editingCheckingId, setEditingCheckingId] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState('');
  const [checkingBalance, setCheckingBalance] = useState('');
  const [submittingChecking, setSubmittingChecking] = useState(false);

  // Formulario de Gasto Variable
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [varTitle, setVarTitle] = useState('');
  const [varAmount, setVarAmount] = useState('');
  const [varCategory, setVarCategory] = useState('alimentacion');
  const [varAccountId, setVarAccountId] = useState<string>('');
  const [deductFromBalance, setDeductFromBalance] = useState(true);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Estado Edición de Gasto Variable
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [editExpenseCategory, setEditExpenseCategory] = useState('alimentacion');
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const [editExpenseAccountId, setEditExpenseAccountId] = useState<string | null>(null);
  const [savingEditExpense, setSavingEditExpense] = useState(false);
  const [editExpenseError, setEditExpenseError] = useState<string | null>(null);

  // Cuentas Corrientes y Débito
  const checkingAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'checking'),
    [accounts]
  );
  const totalCheckingBalance = useMemo(
    () => checkingAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0),
    [checkingAccounts]
  );

  // Cálculos de presupuesto de sueldo libre:
  // 1. Ingresos del mes
  const activeItems = useMemo(
    () => recurringItems.filter((i) => isItemActiveInMonth(i, period)),
    [recurringItems, period]
  );
  const monthlyIncome = useMemo(
    () =>
      activeItems
        .filter((i) => i.type === 'income')
        .reduce((sum, i) => sum + i.amount, 0),
    [activeItems]
  );

  // 2. Gastos fijos del mes
  const monthlyFixedExpenses = useMemo(
    () =>
      activeItems
        .filter((i) => i.type === 'expense')
        .reduce((sum, i) => sum + i.amount, 0),
    [activeItems]
  );

  // 3. Tarjetas facturadas
  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === 'credit_card'),
    [accounts]
  );
  const totalCardDebt = useMemo(
    () => creditCards.reduce((sum, c) => sum + (c.current_balance || 0), 0),
    [creditCards]
  );

  // 4. Ahorro establecido (personal + pareja)
  const savingsAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'savings'),
    [accounts]
  );
  const monthlySavings = useMemo(
    () =>
      savingsAccounts.reduce((sum, a) => sum + (a.fixed_contribution || 0), 0),
    [savingsAccounts]
  );

  // Sueldo libre base disponible para gastos variables en el mes:
  // Sueldo Libre = Ingresos - Gastos Fijos - Tarjetas Facturadas - Ahorro
  const initialFreeBudget = useMemo(
    () =>
      Math.max(
        0,
        monthlyIncome - monthlyFixedExpenses - totalCardDebt - monthlySavings
      ),
    [monthlyIncome, monthlyFixedExpenses, totalCardDebt, monthlySavings]
  );

  // Gastos variables registrados en el periodo
  const periodExpenses = useMemo(
    () => variableExpenses.filter((e) => e.period === period),
    [variableExpenses, period]
  );

  const totalSpentInVariables = useMemo(
    () => periodExpenses.reduce((sum, e) => sum + e.amount, 0),
    [periodExpenses]
  );

  const remainingFreeBudget = initialFreeBudget - totalSpentInVariables;
  const spentRatio =
    initialFreeBudget > 0
      ? Math.min(100, Math.round((totalSpentInVariables / initialFreeBudget) * 100))
      : 0;

  // Días restantes en el mes para cálculo de ritmo diario
  const remainingDaysInMonth = useMemo(() => {
    const now = new Date();
    const [y, m] = period.split('-').map(Number);
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (period === currentMonthStr) {
      const today = now.getDate();
      return Math.max(1, lastDayOfMonth - today + 1);
    }
    return lastDayOfMonth;
  }, [period]);

  const dailyBudgetSuggested =
    remainingFreeBudget > 0
      ? Math.round(remainingFreeBudget / remainingDaysInMonth)
      : 0;

  // Handlers de Cuentas Corrientes
  const openCreateChecking = () => {
    setEditingCheckingId(null);
    setCheckingName('');
    setCheckingBalance('');
    setShowCheckingForm(true);
  };

  const openEditChecking = (acc: Account) => {
    setEditingCheckingId(acc.id);
    setCheckingName(acc.name);
    setCheckingBalance(String(acc.current_balance));
    setShowCheckingForm(true);
  };

  const handleSaveChecking = async () => {
    if (!checkingName.trim()) return;
    setSubmittingChecking(true);
    try {
      const balance = Math.round(
        Number(checkingBalance.replace(/[^0-9-]/g, '') || 0)
      );
      if (editingCheckingId) {
        await onUpdateAccount(editingCheckingId, {
          name: checkingName.trim(),
          current_balance: balance,
        });
      } else {
        await onCreateAccount({
          name: checkingName.trim(),
          type: 'checking',
          current_balance: balance,
        });
      }
      setShowCheckingForm(false);
      setEditingCheckingId(null);
      setCheckingName('');
      setCheckingBalance('');
    } finally {
      setSubmittingChecking(false);
    }
  };

  // Handlers de Gastos Variables
  const handleSaveVariableExpense = async () => {
    setExpenseError(null);
    const amountNum = Math.round(Number(varAmount.replace(/\D/g, '') || 0));
    if (!varTitle.trim()) {
      setExpenseError('Ingresa una descripción para el gasto (ej. Almuerzo)');
      return;
    }
    if (amountNum <= 0) {
      setExpenseError('Ingresa un monto válido mayor a 0');
      return;
    }

    setSubmittingExpense(true);
    try {
      const targetAccId = varAccountId || checkingAccounts[0]?.id || null;
      await onCreateVariableExpense({
        title: varTitle.trim(),
        amount: amountNum,
        category: varCategory,
        period,
        account_id: targetAccId,
        deduct_from_balance: deductFromBalance,
      });

      setVarTitle('');
      setVarAmount('');
      setShowExpenseForm(false);
    } catch (err) {
      setExpenseError(
        err instanceof Error ? err.message : 'Error al registrar el gasto'
      );
    } finally {
      setSubmittingExpense(false);
    }
  };

  const openEditExpense = (exp: VariableExpense) => {
    setEditingExpenseId(exp.id);
    setEditExpenseTitle(exp.title);
    setEditExpenseAmount(String(exp.amount));
    setEditExpenseCategory(exp.category || 'alimentacion');
    setEditExpenseDate(exp.date || '');
    setEditExpenseAccountId(exp.account_id || null);
    setEditExpenseError(null);
  };

  const closeEditExpense = () => {
    setEditingExpenseId(null);
    setEditExpenseTitle('');
    setEditExpenseAmount('');
    setEditExpenseError(null);
  };

  const handleSaveEditExpense = async () => {
    if (!editingExpenseId) return;
    setEditExpenseError(null);
    const amountNum = Math.round(Number(editExpenseAmount.replace(/\D/g, '') || 0));
    if (!editExpenseTitle.trim()) {
      setEditExpenseError('Ingresa una descripción para el gasto');
      return;
    }
    if (amountNum <= 0) {
      setEditExpenseError('Ingresa un monto válido mayor a 0');
      return;
    }

    setSavingEditExpense(true);
    try {
      if (onUpdateVariableExpense) {
        await onUpdateVariableExpense(editingExpenseId, {
          title: editExpenseTitle.trim(),
          amount: amountNum,
          category: editExpenseCategory,
          date: editExpenseDate.trim() || undefined,
          account_id: editExpenseAccountId || null,
        });
      }
      closeEditExpense();
    } catch (err) {
      setEditExpenseError(
        err instanceof Error ? err.message : 'Error al actualizar el gasto'
      );
    } finally {
      setSavingEditExpense(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* =====================================================================
          1. HEADER Y SELECTOR DE PERIODO
         ===================================================================== */}
      <GlassCard>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.sectionEyebrow}>
              BILLETERA Y PRESUPUESTO COTIDIANO
            </Text>
            <Text style={styles.headerTitle}>
              Cuentas & Gastos Variables
            </Text>
            <Text style={styles.headerSubtitle}>
              Administra tu saldo disponible en cuenta y registra tus gastos del día a día (almuerzos, bebidas, salidas) sin alterar tus compromisos fijos.
            </Text>
          </View>

          <View style={styles.periodNavigator}>
            <Pressable
              onPress={() => onChangePeriod(shiftPeriod(period, -1))}
              style={({ pressed }) => [
                styles.periodNavBtn,
                pressed && styles.pressed,
              ]}
            >
              <ChevronLeft size={18} color={colors.textPrimary} />
            </Pressable>

            <View style={styles.periodBadge}>
              <Text style={styles.periodText}>{formatPeriodFull(period)}</Text>
            </View>

            <Pressable
              onPress={() => onChangePeriod(shiftPeriod(period, 1))}
              style={({ pressed }) => [
                styles.periodNavBtn,
                pressed && styles.pressed,
              ]}
            >
              <ChevronRight size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 3 Métricas Clave de Sueldo Libre & Gastos Variables */}
        <View style={[styles.metricsGrid, isMobile && styles.metricsGridMobile]}>
          <View style={[styles.metricBox, isMobile && styles.metricBoxMobile]}>
            <View style={styles.metricIconRow}>
              <Coins size={14} color={colors.textSecondary} />
              <Text style={styles.metricLabel}>SUELDO LIBRE INICIAL</Text>
            </View>
            <Text style={styles.metricValue}>{formatCLP(initialFreeBudget)}</Text>
            <Text style={styles.metricSub}>
              Post pagos fijos, tarjetas y ahorro
            </Text>
          </View>

          <View style={[styles.metricBox, isMobile && styles.metricBoxMobile]}>
            <View style={styles.metricIconRow}>
              <TrendingDown size={14} color="#F59E0B" />
              <Text style={styles.metricLabel}>GASTADO EN VARIABLES</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#F59E0B' }]}>
              {formatCLP(totalSpentInVariables)}
            </Text>
            <Text style={styles.metricSub}>
              {periodExpenses.length}{' '}
              {periodExpenses.length === 1 ? 'gasto registrado' : 'gastos registrados'}
            </Text>
          </View>

          <View
            style={[
              styles.metricBox,
              styles.metricBoxHighlight,
              isMobile && styles.metricBoxMobile,
            ]}
          >
            <View style={styles.metricIconRow}>
              <Sparkles size={14} color="#34D399" />
              <Text style={styles.metricLabelEmerald}>DISPONIBLE RESTANTE HOY</Text>
            </View>
            <Text
              style={[
                styles.metricValueEmerald,
                remainingFreeBudget < 0 && styles.metricValueNegative,
              ]}
            >
              {formatCLP(remainingFreeBudget)}
            </Text>
            <Text style={styles.metricSub}>
              {remainingFreeBudget >= 0
                ? `Ritmo sugerido: ${formatCLP(dailyBudgetSuggested)}/día (${remainingDaysInMonth} días rest.)`
                : 'Presupuesto mensual superado'}
            </Text>
          </View>
        </View>

        {/* Barra de Progreso de Consumo del Presupuesto Diario */}
        <View style={styles.budgetProgressSection}>
          <View style={styles.budgetProgressHeader}>
            <Text style={styles.budgetProgressLabel}>
              Consumo de Presupuesto Libre: {spentRatio}%
            </Text>
            <Text style={styles.budgetProgressPercent}>
              {formatCLP(remainingFreeBudget)} libres
            </Text>
          </View>
          <View style={styles.budgetProgressTrack}>
            <View
              style={[
                styles.budgetProgressFill,
                {
                  width: `${Math.min(100, spentRatio)}%`,
                  backgroundColor:
                    spentRatio > 85 ? '#EF4444' : spentRatio > 60 ? '#F59E0B' : '#34D399',
                },
              ]}
            />
          </View>
        </View>

        {/* Banner Hero: Presupuesto Diario Seguro (Safe-to-Spend) */}
        <View style={styles.safeToSpendHeroBox}>
          <View style={styles.safeToSpendTopRow}>
            <View style={styles.safeToSpendIconWrap}>
              <Sparkles size={16} color="#34D399" />
            </View>
            <View style={styles.safeToSpendTitleCol}>
              <View style={styles.safeToSpendBadgeRow}>
                <Text style={styles.safeToSpendEyebrow}>MOTOR DE CONTROL DIARIO</Text>
                <View
                  style={[
                    styles.safeToSpendStatusBadge,
                    remainingFreeBudget <= 0
                      ? styles.statusBadgeDanger
                      : spentRatio > 80
                      ? styles.statusBadgeWarning
                      : styles.statusBadgeOptimal,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      remainingFreeBudget <= 0
                        ? styles.statusBadgeTextDanger
                        : spentRatio > 80
                        ? styles.statusBadgeTextWarning
                        : styles.statusBadgeTextOptimal,
                    ]}
                  >
                    {remainingFreeBudget <= 0
                      ? 'Presupuesto Agotado'
                      : spentRatio > 80
                      ? 'Ritmo Acelerado'
                      : 'Ritmo Saludable'}
                  </Text>
                </View>
              </View>
              <Text style={styles.safeToSpendTitle}>Presupuesto Diario Seguro (Safe-to-Spend)</Text>
            </View>
          </View>

          <View style={[styles.safeToSpendMetricsRow, isMobile && styles.safeToSpendMetricsRowMobile]}>
            <View style={styles.safeToSpendNumberCol}>
              <Text
                style={[
                  styles.safeToSpendAmount,
                  remainingFreeBudget <= 0 && styles.safeToSpendAmountDanger,
                ]}
              >
                {formatCLP(dailyBudgetSuggested)}
                <Text style={styles.safeToSpendAmountPerDay}> / día</Text>
              </Text>
              <Text style={styles.safeToSpendSubtext}>
                Monto seguro para gastar hoy sin comprometer arriendo ni tarjetas de fin de mes
              </Text>
            </View>

            <View style={[styles.safeToSpendPillsCol, isMobile && styles.safeToSpendPillsColMobile]}>
              <View style={styles.safeToSpendMetaPill}>
                <Calendar size={12} color={colors.textSecondary} />
                <Text style={styles.safeToSpendMetaPillText}>
                  {remainingDaysInMonth} {remainingDaysInMonth === 1 ? 'día restante' : 'días restantes'}
                </Text>
              </View>
              <View style={styles.safeToSpendMetaPill}>
                <Coins size={12} color="#34D399" />
                <Text style={styles.safeToSpendMetaPillText}>
                  {formatCLP(remainingFreeBudget)} libres totales
                </Text>
              </View>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* =====================================================================
          2. SALDOS BASE EN CUENTAS CORRIENTES / VISTA (HOY)
         ===================================================================== */}
      <GlassCard>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTextCol}>
            <Text style={styles.sectionEyebrow}>CUENTAS BANCARIAS VISTA / CORRIENTE</Text>
            <Text style={styles.sectionTitle}>
              Saldos Base Registrados en Cuentas (Hoy)
            </Text>
            <Text style={styles.sectionSubtitle}>
              Total disponible en bancos: {formatCLP(totalCheckingBalance)}
            </Text>
          </View>

          <Pressable
            onPress={openCreateChecking}
            style={styles.addPillButton}
          >
            <Plus size={13} color={colors.buttonPrimaryText} />
            <Text style={styles.addPillButtonText}>Agregar Cuenta</Text>
          </Pressable>
        </View>

        {/* Lista de Cuentas */}
        {checkingAccounts.length === 0 ? (
          <View style={styles.emptyAccountsBox}>
            <Text style={styles.emptyAccountsText}>
              No tienes cuentas corrientes o vista ingresadas. Agrega una cuenta para administrar tu dinero diario.
            </Text>
          </View>
        ) : (
          <View style={styles.accountsGrid}>
            {checkingAccounts.map((acc) => (
              <View
                key={acc.id}
                style={[styles.accountCard, isMobile && styles.accountCardMobile]}
              >
                <View style={styles.accountCardHeader}>
                  <View style={styles.accountCardIconWrap}>
                    <Landmark size={15} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.accountCardName} numberOfLines={1}>
                    {acc.name}
                  </Text>
                </View>

                <Text style={styles.accountCardBalance}>
                  {formatCLP(acc.current_balance)}
                </Text>

                <View style={styles.accountCardActions}>
                  <Pressable
                    onPress={() => openEditChecking(acc)}
                    style={styles.accountActionBtn}
                  >
                    <Pencil size={12} color={colors.textSecondary} />
                    <Text style={styles.accountActionBtnText}>Editar Saldo</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteAccount(acc.id)}
                    style={styles.accountDeleteBtn}
                  >
                    <Trash2 size={12} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Formulario Inline para Crear / Editar Cuenta */}
        {showCheckingForm ? (
          <View style={styles.inlineFormBox}>
            <Text style={styles.inlineFormTitle}>
              {editingCheckingId
                ? 'Editar Saldo de Cuenta Corriente / Vista'
                : 'Nueva Cuenta Corriente / Vista'}
            </Text>
            <View style={[styles.formGrid, isMobile && styles.formGridMobile]}>
              <View style={styles.formCol}>
                <GlassInput
                  label="Nombre de la Cuenta"
                  placeholder="Ej: Cuenta Santander / CMR Débito"
                  value={checkingName}
                  onChangeText={setCheckingName}
                />
              </View>
              <View style={styles.formCol}>
                <GlassInput
                  label="Saldo Actual Disponible (CLP)"
                  placeholder="Ej: 150000"
                  keyboardType="numeric"
                  value={checkingBalance}
                  onChangeText={setCheckingBalance}
                />
              </View>
            </View>
            <View style={styles.inlineFormActions}>
              <TeslaButton
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  setShowCheckingForm(false);
                  setEditingCheckingId(null);
                }}
              />
              <TeslaButton
                title={editingCheckingId ? 'Guardar Saldo' : 'Crear Cuenta'}
                onPress={handleSaveChecking}
                loading={submittingChecking}
              />
            </View>
          </View>
        ) : null}
      </GlassCard>

      {/* =====================================================================
          3. REGISTRO ÁGIL DE GASTOS VARIABLES DIARIOS
         ===================================================================== */}
      <GlassCard>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTextCol}>
            <Text style={styles.sectionEyebrow}>REGISTRO DEL DÍA A DÍA</Text>
            <Text style={styles.sectionTitle}>
              Gastos Variables del Mes ({formatPeriodFull(period)})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Ingresa tus compras cotidianas (un almuerzo, una bebida, un café, etc.) y descuéntalas de tu sueldo libre.
            </Text>
          </View>

          <Pressable
            onPress={() => setShowExpenseForm(!showExpenseForm)}
            style={[styles.addPillButton, styles.addPillButtonEmerald]}
          >
            <Plus size={13} color="#050505" />
            <Text style={styles.addPillButtonTextEmerald}>
              {showExpenseForm ? 'Ocultar' : 'Registrar Gasto'}
            </Text>
          </Pressable>
        </View>

        {/* Catálogo de Acciones Rápidas (Micro-Gastos Chilenos con Edición al Vuelo) */}
        <QuickExpenseShortcuts
          accounts={accounts}
          checkingAccounts={checkingAccounts}
          period={period}
          onQuickLog={onCreateVariableExpense}
          isMobile={isMobile}
        />

        <View style={styles.divider} />

        {/* Formulario de Nuevo Gasto Variable */}
        {showExpenseForm ? (
          <View style={styles.expenseFormBox}>
            <Text style={styles.formSectionTitle}>
              Registrar Gasto Variable Cotidiano
            </Text>

            {/* Categorías Rápidas */}
            <View style={styles.formSectionGroup}>
              <Text style={styles.fieldSectionLabel}>CATEGORÍA</Text>
              <View style={styles.chipsWrap}>
                {VARIABLE_QUICK_CATEGORIES.map((cat) => {
                  const selected = varCategory === cat.id;
                  const Icon = cat.icon;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setVarCategory(cat.id)}
                      style={[
                        styles.chip,
                        selected && {
                          borderColor: cat.color,
                          backgroundColor: `${cat.color}24`,
                        },
                      ]}
                    >
                      <Icon size={12} color={selected ? cat.color : colors.textSecondary} />
                      <Text
                        style={[
                          styles.chipText,
                          selected && { color: cat.color, fontWeight: '700' },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Cuenta de Pago */}
            {checkingAccounts.length > 0 ? (
              <View style={styles.formSectionGroup}>
                <Text style={styles.fieldSectionLabel}>CUENTA O DÉBITO ASOCIADA</Text>
                <View style={styles.chipsWrap}>
                  {checkingAccounts.map((acc) => {
                    const selected = (varAccountId || checkingAccounts[0]?.id) === acc.id;
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={() => setVarAccountId(acc.id)}
                        style={[styles.chip, selected && styles.chipActive]}
                      >
                        <Landmark size={12} color={selected ? '#050505' : colors.textSecondary} />
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                          {acc.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Inputs de Título y Monto */}
            <View style={styles.formInputsGroup}>
              <GlassInput
                label="Descripción del Gasto"
                placeholder="Ej. Almuerzo de trabajo, Café, Bebida"
                value={varTitle}
                onChangeText={setVarTitle}
              />
              <GlassInput
                label="Monto Pagado (CLP)"
                placeholder="Ej. 7500"
                keyboardType="numeric"
                value={varAmount}
                onChangeText={setVarAmount}
              />
            </View>

            {/* Checkbox: Descontar de cuenta */}
            {checkingAccounts.length > 0 ? (
              <Pressable
                onPress={() => setDeductFromBalance(!deductFromBalance)}
                style={styles.checkboxOptionRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    deductFromBalance && styles.checkboxBoxChecked,
                  ]}
                >
                  {deductFromBalance ? <Check size={12} color="#050505" strokeWidth={3} /> : null}
                </View>
                <Text style={styles.checkboxOptionText}>
                  Descontar automáticamente este monto del saldo de la cuenta corriente
                </Text>
              </Pressable>
            ) : null}

            {expenseError ? (
              <Text style={styles.errorText}>{expenseError}</Text>
            ) : null}

            <View style={styles.formSubmitRow}>
              <TeslaButton
                title="Guardar Gasto Variable"
                onPress={handleSaveVariableExpense}
                loading={submittingExpense}
              />
            </View>
          </View>
        ) : null}

        {/* Lista Cronológica de Gastos Variables */}
        {periodExpenses.length === 0 ? (
          <View style={styles.emptyExpensesBox}>
            <Text style={styles.emptyExpensesText}>
              Aún no has registrado gastos variables en {formatPeriodFull(period)}.
            </Text>
            <Text style={styles.emptyExpensesSub}>
              Toca "Registrar Gasto" para ir sumando tus almuerzos, cafés o bebidas del mes.
            </Text>
          </View>
        ) : (
          <View style={styles.expenseList}>
            {periodExpenses.map((exp, idx) => {
              const catColor = getCategoryColor(exp.category);
              return (
                <View key={exp.id}>
                  {idx > 0 ? <View style={styles.itemDivider} /> : null}
                  {editingExpenseId === exp.id ? (
                    <View style={styles.inlineEditExpenseBox}>
                      <View style={styles.inlineEditHeader}>
                        <View style={styles.inlineEditHeaderLeft}>
                          <Pencil size={14} color="#34D399" />
                          <Text style={styles.inlineEditTitle}>Editar Gasto Variable</Text>
                        </View>
                        <Pressable onPress={closeEditExpense} style={styles.inlineEditCloseBtn}>
                          <X size={14} color={colors.textSecondary} />
                        </Pressable>
                      </View>

                      {editExpenseError ? (
                        <Text style={styles.errorText}>{editExpenseError}</Text>
                      ) : null}

                      <GlassInput
                        label="Descripción / Título"
                        placeholder="Ej. Almuerzo o Supermercado"
                        value={editExpenseTitle}
                        onChangeText={setEditExpenseTitle}
                      />

                      <GlassInput
                        label="Monto CLP"
                        placeholder="Ej. 12000"
                        keyboardType="numeric"
                        value={editExpenseAmount}
                        onChangeText={setEditExpenseAmount}
                      />

                      <GlassInput
                        label="Fecha (YYYY-MM-DD)"
                        placeholder="2026-11-06"
                        value={editExpenseDate}
                        onChangeText={setEditExpenseDate}
                      />

                      <View style={styles.formSectionGroup}>
                        <Text style={styles.fieldSectionLabel}>CATEGORÍA</Text>
                        <View style={styles.chipsWrap}>
                          {VARIABLE_QUICK_CATEGORIES.map((cat) => {
                            const isSelected = editExpenseCategory === cat.id;
                            const IconComponent = cat.icon;
                            return (
                              <Pressable
                                key={cat.id}
                                onPress={() => setEditExpenseCategory(cat.id)}
                                style={[
                                  styles.chip,
                                  isSelected && {
                                    borderColor: cat.color,
                                    backgroundColor: `${cat.color}22`,
                                  },
                                ]}
                              >
                                <IconComponent
                                  size={13}
                                  color={isSelected ? cat.color : colors.textSecondary}
                                />
                                <Text
                                  style={[
                                    styles.chipText,
                                    isSelected && { color: cat.color, fontWeight: '700' },
                                  ]}
                                >
                                  {cat.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {checkingAccounts.length > 0 ? (
                        <View style={styles.formSectionGroup}>
                          <Text style={styles.fieldSectionLabel}>CUENTA ASOCIADA</Text>
                          <View style={styles.chipsWrap}>
                            {checkingAccounts.map((acc) => {
                              const isSelected = editExpenseAccountId === acc.id;
                              return (
                                <Pressable
                                  key={acc.id}
                                  onPress={() => setEditExpenseAccountId(acc.id)}
                                  style={[
                                    styles.chip,
                                    isSelected && styles.chipActive,
                                  ]}
                                >
                                  <Wallet
                                    size={13}
                                    color={
                                      isSelected
                                        ? colors.buttonPrimaryText
                                        : colors.textSecondary
                                    }
                                  />
                                  <Text
                                    style={[
                                      styles.chipText,
                                      isSelected && styles.chipTextActive,
                                    ]}
                                  >
                                    {acc.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.inlineEditActions}>
                        <TeslaButton
                          title="Cancelar"
                          variant="secondary"
                          onPress={closeEditExpense}
                          style={styles.inlineEditBtn}
                        />
                        <TeslaButton
                          title={savingEditExpense ? 'Guardando...' : 'Guardar Cambios'}
                          variant="primary"
                          loading={savingEditExpense}
                          onPress={handleSaveEditExpense}
                          style={styles.inlineEditBtn}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.expenseRow}>
                      <View style={styles.expenseRowLeft}>
                        <View
                          style={[
                            styles.expenseCategoryDot,
                            { backgroundColor: catColor },
                          ]}
                        />
                        <View style={styles.expenseInfoCol}>
                          <Text style={styles.expenseTitle}>{exp.title}</Text>
                          <View style={styles.expenseMetaRow}>
                            <View
                              style={[
                                styles.categoryMiniBadge,
                                {
                                  backgroundColor: `${catColor}18`,
                                  borderColor: `${catColor}45`,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryMiniBadgeText,
                                  { color: catColor },
                                ]}
                              >
                                {exp.category === 'prestamo'
                                  ? 'PRÉSTAMO'
                                  : exp.category.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.expenseDateText}>
                              {exp.date} · {exp.account_name || 'Cuenta'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.expenseRowRight}>
                        <Text style={styles.expenseAmountText}>
                          -{formatCLP(exp.amount)}
                        </Text>
                        <Pressable
                          onPress={() => openEditExpense(exp)}
                          style={styles.iconSmallBtn}
                        >
                          <Pencil size={13} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => onDeleteVariableExpense(exp.id)}
                          style={styles.iconSmallBtn}
                        >
                          <Trash2 size={13} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 260,
    gap: 4,
  },
  sectionEyebrow: {
    color: '#34D399',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  periodNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodNavBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  periodText: {
    color: colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricsGridMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    minHeight: 100,
    gap: 6,
  },
  metricBoxMobile: {
    flex: 0,
    width: '100%',
    minHeight: 'auto',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  metricBoxHighlight: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    lineHeight: 15,
  },
  metricLabelEmerald: {
    color: '#34D399',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    lineHeight: 15,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  metricValueEmerald: {
    color: '#34D399',
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  metricValueNegative: {
    color: '#F87171',
  },
  metricSub: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
  },
  budgetProgressSection: {
    marginTop: 14,
    gap: 6,
  },
  budgetProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetProgressLabel: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  budgetProgressPercent: {
    color: '#34D399',
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  budgetProgressTrack: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  safeToSpendHeroBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    gap: 12,
  },
  safeToSpendTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  safeToSpendIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeToSpendTitleCol: {
    flex: 1,
    gap: 2,
  },
  safeToSpendBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  safeToSpendEyebrow: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  safeToSpendStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusBadgeOptimal: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  statusBadgeWarning: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusBadgeDanger: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextOptimal: {
    color: '#34D399',
  },
  statusBadgeTextWarning: {
    color: '#F59E0B',
  },
  statusBadgeTextDanger: {
    color: '#EF4444',
  },
  safeToSpendTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  safeToSpendMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  safeToSpendMetricsRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  safeToSpendNumberCol: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  safeToSpendAmount: {
    color: '#34D399',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  safeToSpendAmountDanger: {
    color: '#EF4444',
  },
  safeToSpendAmountPerDay: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  safeToSpendSubtext: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  safeToSpendPillsCol: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  safeToSpendPillsColMobile: {
    width: '100%',
    flexDirection: 'row',
  },
  safeToSpendMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  safeToSpendMetaPillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  sectionHeaderTextCol: {
    flex: 1,
    minWidth: 240,
    gap: 3,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  addPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  addPillButtonEmerald: {
    backgroundColor: '#34D399',
  },
  addPillButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 11.5,
    fontWeight: '700',
  },
  addPillButtonTextEmerald: {
    color: '#050505',
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptyAccountsBox: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  emptyAccountsText: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textAlign: 'center',
  },
  accountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  accountCard: {
    flex: 1,
    minWidth: 200,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    minHeight: 100,
    gap: 6,
  },
  accountCardMobile: {
    flex: 0,
    width: '100%',
    minWidth: '100%',
    minHeight: 'auto',
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountCardIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCardName: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
    flex: 1,
  },
  accountCardBalance: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  accountCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  accountActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accountActionBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  accountDeleteBtn: {
    padding: 4,
  },
  inlineFormBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  inlineFormTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  formGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  formGridMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  formCol: {
    flex: 1,
  },
  inlineFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  expenseFormBox: {
    marginTop: 12,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    backgroundColor: 'rgba(52, 211, 153, 0.03)',
    gap: 16,
  },
  formSectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  formSectionGroup: {
    gap: 8,
  },
  fieldSectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  chipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  formInputsGroup: {
    gap: 0,
  },
  checkboxOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  checkboxOptionText: {
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
  },
  formSubmitRow: {
    marginTop: 4,
  },
  emptyExpensesBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyExpensesText: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyExpensesSub: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  expenseList: {
    gap: 2,
    marginTop: 8,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 10,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  expenseRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  expenseCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  expenseInfoCol: {
    gap: 3,
    flex: 1,
  },
  expenseTitle: {
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryMiniBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  expenseDateText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  expenseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseAmountText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  iconSmallBtn: {
    padding: 6,
  },
  inlineEditExpenseBox: {
    width: '100%',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    gap: 12,
    marginVertical: 4,
  },
  inlineEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inlineEditHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineEditTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineEditCloseBtn: {
    padding: 4,
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  inlineEditBtn: {
    minWidth: 120,
    height: 44,
  },
  pressed: {
    opacity: 0.7,
  },
});
