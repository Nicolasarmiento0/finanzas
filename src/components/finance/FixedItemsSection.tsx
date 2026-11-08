import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import { resolveCardBrand } from './CreditCardVisual';
import {
  Account,
  CreateRecurringItemInput,
  RecurringItem,
  RecurringItemType,
  UpdateRecurringItemInput,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { usePrivacy } from '@/context/PrivacyContext';
import {
  calculateCreditCardMetrics,
  CreditCardMetrics,
  formatPeriodFull,
  formatPeriodShort,
  getCategoryColor,
  isItemActiveInMonth,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

const QUICK_CATEGORIES = [
  'fijo',
  'vivienda',
  'suscripciones',
  'transporte',
  'educacion',
  'prestamo',
  'servicios',
];

interface FixedItemsSectionProps {
  period: string;
  onChangePeriod: (nextPeriod: string) => void;
  accounts: Account[];
  recurringItems: RecurringItem[];
  paidItemIdsInPeriod: Set<string>;
  paidCardIdsInPeriod?: Set<string>;
  onTogglePaid: (itemId: string) => Promise<void>;
  onToggleCardPaid?: (cardId: string) => Promise<void>;
  onCreateRecurringItem: (input: CreateRecurringItemInput) => Promise<void>;
  onUpdateRecurringItem: (
    id: string,
    input: UpdateRecurringItemInput
  ) => Promise<void>;
  onDeleteRecurringItem: (id: string) => Promise<void>;
  onAddSubItem?: (
    recurringItemId: string,
    input: { name: string; amount: number }
  ) => Promise<void>;
  onRemoveSubItem?: (
    recurringItemId: string,
    subItemId: string
  ) => Promise<void>;
}

export function FixedItemsSection({
  period,
  onChangePeriod,
  accounts,
  recurringItems,
  paidItemIdsInPeriod,
  paidCardIdsInPeriod,
  onTogglePaid,
  onToggleCardPaid,
  onCreateRecurringItem,
  onUpdateRecurringItem,
  onDeleteRecurringItem,
  onAddSubItem,
  onRemoveSubItem,
}: FixedItemsSectionProps) {
  const { isDesktop } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();

  // Estado para formulario de creación
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemType, setItemType] = useState<RecurringItemType>('expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('fijo');
  const [startDate, setStartDate] = useState(period);
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado para edición inline de un Gasto Fijo / Ingreso Fijo existente
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState<string>('');
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('fijo');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);

  // Estado para agregar sub-ítem desde la edición de un gasto fijo
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');
  const [addingSub, setAddingSub] = useState(false);

  // Filtrar ítems vigentes vs omitidos por regla de vigencia temporal en el mes `period`
  const activeInMonth = recurringItems.filter((item) =>
    isItemActiveInMonth(item, period)
  );
  const expiredOrFutureInMonth = recurringItems.filter(
    (item) => !isItemActiveInMonth(item, period)
  );

  const activeIncomes = activeInMonth.filter((item) => item.type === 'income');
  const activeExpenses = activeInMonth.filter((item) => item.type === 'expense');

  // Tarjetas de crédito y cálculo dinámico de facturación mensual (base + cargos recurrentes)
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const creditCardIdSet = useMemo(
    () => new Set(creditCards.map((c) => c.id)),
    [creditCards]
  );

  const cardMetricsMap = useMemo(() => {
    const map = new Map<
      string,
      { metrics: CreditCardMetrics; cardItems: RecurringItem[] }
    >();
    for (const card of creditCards) {
      const cardItems = recurringItems.filter(
        (item) =>
          item.account_id === card.id &&
          item.type === 'expense' &&
          isItemActiveInMonth(item, period)
      );
      const metrics = calculateCreditCardMetrics(card, cardItems, period);
      map.set(card.id, { metrics, cardItems });
    }
    return map;
  }, [creditCards, recurringItems, period]);

  // Tarjetas activas en el mes si tienen saldo base o cargos vigentes
  const activeCards = creditCards.filter((c) => {
    const data = cardMetricsMap.get(c.id);
    return data ? data.metrics.usedAmount > 0 : (c.current_balance || 0) > 0;
  });

  const totalCardDebt = activeCards.reduce((sum, c) => {
    const data = cardMetricsMap.get(c.id);
    return sum + (data ? data.metrics.usedAmount : (c.current_balance || 0));
  }, 0);

  const paidCards = activeCards.filter((c) => paidCardIdsInPeriod?.has(c.id));
  const paidCardsAmount = paidCards.reduce((sum, c) => {
    const data = cardMetricsMap.get(c.id);
    return sum + (data ? data.metrics.usedAmount : (c.current_balance || 0));
  }, 0);

  // Gastos fijos directos (no cargados a tarjeta de crédito para evitar duplicación de cobro)
  const standaloneExpenses = activeExpenses.filter(
    (item) => !creditCardIdSet.has(item.account_id || '')
  );
  // Gastos fijos cargados a tarjetas de crédito (facturados en el estado de cuenta de la tarjeta)
  const cardAssignedExpenses = activeExpenses.filter(
    (item) => creditCardIdSet.has(item.account_id || '')
  );

  const totalIncome = activeIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalStandaloneExpenses = standaloneExpenses.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  // Total consolidado de compromisos a pagar en el checklist (Gastos Directos + Estados de Cuenta de Tarjetas)
  const totalMonthlyCommitments = totalStandaloneExpenses + totalCardDebt;

  const paidExpensesCount = standaloneExpenses.filter((item) =>
    paidItemIdsInPeriod.has(item.id)
  ).length;
  const paidExpensesAmount = standaloneExpenses
    .filter((item) => paidItemIdsInPeriod.has(item.id))
    .reduce((sum, item) => sum + item.amount, 0);

  const totalPaidAmount = paidExpensesAmount + paidCardsAmount;
  const pendingCommitmentsAmount = Math.max(0, totalMonthlyCommitments - totalPaidAmount);
  const totalCommitmentsCount = standaloneExpenses.length + activeCards.length;
  const totalPaidCount = paidExpensesCount + paidCards.length;

  // Cuentas corrientes para seguimiento del saldo bancario tras pagos
  const checkingAccounts = accounts.filter((a) => a.type === 'checking');
  const totalCheckingBalance = checkingAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  );

  const paidPercent =
    totalMonthlyCommitments > 0
      ? Math.min(100, Math.round((totalPaidAmount / totalMonthlyCommitments) * 100))
      : 100;
  const isAllPaid = totalMonthlyCommitments > 0 && pendingCommitmentsAmount === 0;

  // Balance final libre tras pagar todos los compromisos del mes (Superávit/Remanente)
  const monthlySurplus = totalIncome - totalMonthlyCommitments;

  // Saldo bancario estimado en cuentas corrientes tras liquidar los compromisos pendientes
  const projectedCheckingAfterPending = Math.max(
    0,
    totalCheckingBalance - pendingCommitmentsAmount
  );

  const startEditingItem = (item: RecurringItem) => {
    if (editingItemId === item.id) {
      setEditingItemId(null);
      setEditErrorMsg(null);
      return;
    }
    setEditingItemId(item.id);
    setEditAccountId(item.account_id);
    setEditTitle(item.title);
    setEditAmount(String(item.amount));
    setEditCategory(item.category || 'fijo');
    setEditStartDate(item.start_date || period);
    setEditEndDate(item.end_date || '');
    setEditIsActive(item.is_active);
    setEditErrorMsg(null);
    setNewSubName('');
    setNewSubAmount('');
  };

  const handleSaveEdit = async (item: RecurringItem) => {
    setEditErrorMsg(null);
    if (!editTitle.trim()) {
      setEditErrorMsg('El título no puede estar vacío.');
      return;
    }
    const hasSubItems = item.sub_items && item.sub_items.length > 0;
    const numericAmount = hasSubItems
      ? item.amount
      : parseInt(editAmount.replace(/\D/g, ''), 10);

    if (!hasSubItems && (!numericAmount || numericAmount <= 0)) {
      setEditErrorMsg('Ingresa un monto válido en CLP.');
      return;
    }

    setSavingEdit(true);
    try {
      await onUpdateRecurringItem(item.id, {
        account_id: editAccountId || item.account_id,
        title: editTitle.trim(),
        amount: numericAmount,
        category: editCategory.trim() || 'general',
        start_date: editStartDate.trim() || item.start_date,
        end_date: editEndDate.trim() ? editEndDate.trim() : null,
        is_active: editIsActive,
      });
      setEditingItemId(null);
    } catch (err) {
      setEditErrorMsg(
        err instanceof Error ? err.message : 'Error al actualizar el movimiento'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddSubFromEditor = async (recurringItemId: string) => {
    if (!onAddSubItem || !newSubName.trim()) return;
    const subAmt = parseInt(newSubAmount.replace(/\D/g, ''), 10) || 0;
    if (subAmt <= 0) return;

    setAddingSub(true);
    try {
      await onAddSubItem(recurringItemId, {
        name: newSubName.trim(),
        amount: subAmt,
      });
      setNewSubName('');
      setNewSubAmount('');
    } finally {
      setAddingSub(false);
    }
  };

  const handleCreate = async () => {
    setErrorMsg(null);
    const targetAccount = selectedAccountId || accounts[0]?.id;
    if (!targetAccount) {
      setErrorMsg('Primero crea al menos una cuenta en la pestaña Tarjetas o Cuentas.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Ingresa un título para el movimiento fijo.');
      return;
    }
    const numericAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Ingresa un monto válido en CLP.');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateRecurringItem({
        account_id: targetAccount,
        title: title.trim(),
        amount: numericAmount,
        type: itemType,
        category: category.trim() || 'general',
        start_date: startDate.trim() || period,
        end_date: endDate.trim() ? endDate.trim() : null,
        is_active: true,
      });
      setTitle('');
      setAmount('');
      setEndDate('');
      setShowAddForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const renderEditPanel = (item: RecurringItem) => {
    if (editingItemId !== item.id) return null;
    const hasSubItems = item.sub_items && item.sub_items.length > 0;

    return (
      <View style={styles.editPanel}>
        <View style={styles.editHeaderRow}>
          <Text style={styles.editPanelTitle}>
            Editar {item.type === 'expense' ? 'Gasto Fijo' : 'Ingreso Fijo'}
          </Text>
          <Pressable
            onPress={() => setEditingItemId(null)}
            style={styles.closeEditBtn}
          >
            <X size={15} color={colors.textSecondary} />
            <Text style={styles.closeEditText}>Cerrar</Text>
          </Pressable>
        </View>

        <GlassInput
          label="Título del compromiso"
          placeholder="Ej. Crédito Vehicular"
          value={editTitle}
          onChangeText={setEditTitle}
        />

        {hasSubItems ? (
          <View style={styles.subItemsNoticeBox}>
            <Text style={styles.subItemsNoticeLabel}>
              MONTO CALCULADO POR SUB-ÍTEMS: {formatCLP(item.amount)}
            </Text>
            <Text style={styles.subItemsNoticeSub}>
              Este gasto tiene servicios anidados. Edita o agrega sub-ítems abajo para ajustar su total automáticamente.
            </Text>
          </View>
        ) : (
          <GlassInput
            label="Monto Mensual (CLP)"
            placeholder="Ej. 310000"
            keyboardType="numeric"
            value={editAmount}
            onChangeText={setEditAmount}
          />
        )}

        <View style={styles.formSectionGroup}>
          <Text style={styles.fieldSectionLabel}>CUENTA O TARJETA DE CARGO</Text>
          <View style={styles.chipsWrap}>
            {accounts.map((acc) => {
              const selected = editAccountId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => setEditAccountId(acc.id)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {acc.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {item.type === 'expense' ? (
          <View style={styles.formSectionGroup}>
            <Text style={styles.fieldSectionLabel}>CATEGORÍA</Text>
            <View style={styles.chipsWrap}>
              {QUICK_CATEGORIES.map((cat) => {
                const selected = editCategory.toLowerCase() === cat;
                const catColor = getCategoryColor(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setEditCategory(cat)}
                    style={[
                      styles.chip,
                      selected && {
                        borderColor: catColor,
                        backgroundColor: `${catColor}24`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.categoryChipDot,
                        { backgroundColor: catColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        selected && { color: catColor, fontWeight: '700' },
                      ]}
                    >
                      {cat.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.formSectionGroup}>
          <Text style={styles.fieldSectionLabel}>VIGENCIA TEMPORAL</Text>
          <View style={[styles.dateRow, !isDesktop && styles.dateRowMobile]}>
            <View style={styles.dateCol}>
              <GlassInput
                label="Mes Inicio (YYYY-MM)"
                placeholder="2026-01"
                value={editStartDate}
                onChangeText={setEditStartDate}
              />
            </View>
            <View style={styles.dateCol}>
              <GlassInput
                label="Mes Límite (YYYY-MM o vacío)"
                placeholder="Ej. 2026-12 o 2027-04"
                value={editEndDate}
                onChangeText={setEditEndDate}
              />
            </View>
          </View>
        </View>

        <View style={styles.quickValidityRow}>
          {editEndDate ? (
            <Pressable
              onPress={() => setEditEndDate('')}
              style={styles.ghostPill}
            >
              <Text style={styles.ghostPillText}>
                Dejar sin fecha límite (Indefinido)
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setEditIsActive((prev) => !prev)}
            style={[
              styles.ghostPill,
              !editIsActive && styles.ghostPillInactive,
            ]}
          >
            <Text style={styles.ghostPillText}>
              Estado: {editIsActive ? 'ACTIVO' : 'PAUSADO'} (Toca para cambiar)
            </Text>
          </Pressable>
        </View>

        {/* Gestión de Sub-ítems anidados dentro del editor */}
        {item.type === 'expense' && onAddSubItem && onRemoveSubItem ? (
          <View style={styles.editSubSection}>
            <Text style={styles.fieldLabel}>
              DESGLOSE DE SUB-ÍTEMS ANIDADOS ({item.sub_items.length})
            </Text>

            {item.sub_items.length > 0 ? (
              <View style={styles.editSubList}>
                {item.sub_items.map((sub) => (
                  <View key={sub.id} style={styles.editSubRow}>
                    <Text style={styles.editSubName}>{sub.name}</Text>
                    <View style={styles.editSubRight}>
                      <Text style={styles.editSubAmount}>
                        {formatCLP(sub.amount)}
                      </Text>
                      <Pressable
                        onPress={() => onRemoveSubItem(item.id, sub.id)}
                        style={styles.iconActionBtn}
                      >
                        <X size={14} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={[styles.dateRow, !isDesktop && styles.dateRowMobile]}>
              <View style={styles.dateCol}>
                <GlassInput
                  label="Nuevo Sub-ítem (ej. Apple, SmartFit)"
                  placeholder="Nombre sub-ítem"
                  value={newSubName}
                  onChangeText={setNewSubName}
                />
              </View>
              <View style={styles.dateCol}>
                <GlassInput
                  label="Monto Sub-ítem (CLP)"
                  placeholder="Ej. 14990"
                  keyboardType="numeric"
                  value={newSubAmount}
                  onChangeText={setNewSubAmount}
                />
              </View>
            </View>

            {newSubName.trim() ? (
              <TeslaButton
                title="Agregar Sub-ítem al Gasto"
                variant="secondary"
                onPress={() => handleAddSubFromEditor(item.id)}
                loading={addingSub}
              />
            ) : null}
          </View>
        ) : null}

        {editErrorMsg ? (
          <Text style={styles.errorText}>{editErrorMsg}</Text>
        ) : null}

        <View style={[styles.editActionsRow, !isDesktop && styles.dateRowMobile]}>
          <View style={styles.dateCol}>
            <TeslaButton
              title="Guardar Cambios"
              onPress={() => handleSaveEdit(item)}
              loading={savingEdit}
            />
          </View>
          <View style={styles.dateCol}>
            <TeslaButton
              title="Cancelar"
              variant="secondary"
              onPress={() => setEditingItemId(null)}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Selector de Periodo Mensual (Permite verificar vigencia temporal mes a mes) */}
      <GlassCard style={styles.periodCard}>
        <View style={styles.periodHeader}>
          <View style={styles.periodLabelGroup}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.periodSectionTitle}>PERIODO EN CURSO</Text>
          </View>

          <View style={styles.periodControls}>
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

        {/* Resumen Mensual: Ingresos vs Compromisos (Gastos + Tarjetas) y Superávit */}
        <View style={[styles.metricsGrid, !isDesktop && styles.metricsGridMobile]}>
          <View style={[styles.metricBox, !isDesktop && styles.metricBoxMobile]}>
            <Text style={styles.metricLabel}>INGRESOS FIJOS</Text>
            <Text style={styles.metricValue}>{formatCLP(totalIncome)}</Text>
            <Text style={styles.metricSub}>
              {activeIncomes.length}{' '}
              {activeIncomes.length === 1 ? 'ingreso activo' : 'ingresos activos'}
            </Text>
          </View>

          <View style={[styles.metricBox, !isDesktop && styles.metricBoxMobile]}>
            <Text style={styles.metricLabel}>GASTOS Y TARJETAS VIGENTES</Text>
            <Text style={styles.metricValue}>{formatCLP(totalMonthlyCommitments)}</Text>
            <Text style={styles.metricSub}>
              {totalPaidCount}/{totalCommitmentsCount} pagados · Restan{' '}
              {formatCLP(pendingCommitmentsAmount)}
            </Text>
          </View>

          <View
            style={[
              styles.metricBox,
              styles.metricBoxHighlight,
              !isDesktop && styles.metricBoxMobile,
            ]}
          >
            <Text style={styles.metricLabel}>FLUJO LIBRE MES</Text>
            <Text style={styles.metricValue}>{formatCLP(monthlySurplus)}</Text>
            <Text style={styles.metricSub}>
              {monthlySurplus >= 0 ? 'Superávit proyectado' : 'Déficit proyectado'}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Cabecera de Acciones */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderTextCol}>
          <Text style={styles.sectionTitle}>Checklist Mensual de Gastos Fijos</Text>
          <Text style={styles.sectionSubtitle}>
            Marca los compromisos pagados o toca el ícono de lápiz para editarlos
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (!selectedAccountId && accounts[0]?.id) {
              setSelectedAccountId(accounts[0].id);
            }
            setShowAddForm((prev) => !prev);
          }}
          style={({ pressed }) => [
            styles.addPillButton,
            pressed && styles.pressed,
          ]}
        >
          {showAddForm ? (
            <X size={15} color={colors.buttonPrimaryText} />
          ) : (
            <Plus size={15} color={colors.buttonPrimaryText} />
          )}
          <Text style={styles.addPillButtonText}>
            {showAddForm ? 'Cerrar' : 'Nuevo Fijo'}
          </Text>
        </Pressable>
      </View>

      {/* Formulario colapsable para crear Ingreso o Gasto Fijo */}
      {showAddForm ? (
        <GlassCard style={styles.formCard}>
          <Text style={styles.formTitle}>Agregar Movimiento Recurrente</Text>

          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => setItemType('expense')}
              style={[
                styles.segmentOption,
                itemType === 'expense' && styles.segmentOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentOptionText,
                  itemType === 'expense' && styles.segmentOptionTextActive,
                ]}
              >
                Gasto Fijo
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setItemType('income')}
              style={[
                styles.segmentOption,
                itemType === 'income' && styles.segmentOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentOptionText,
                  itemType === 'income' && styles.segmentOptionTextActive,
                ]}
              >
                Ingreso Fijo
              </Text>
            </Pressable>
          </View>

          {/* Cuenta o Tarjeta Asociada */}
          <View style={styles.formSectionGroup}>
            <Text style={styles.fieldSectionLabel}>CUENTA O TARJETA ASOCIADA</Text>
            <View style={styles.chipsWrap}>
              {accounts.map((acc) => {
                const selected = (selectedAccountId || accounts[0]?.id) === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedAccountId(acc.id)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {acc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Categoría (solo para gastos fijos) */}
          {itemType === 'expense' ? (
            <View style={styles.formSectionGroup}>
              <Text style={styles.fieldSectionLabel}>CATEGORÍA</Text>
              <View style={styles.chipsWrap}>
                {QUICK_CATEGORIES.map((cat) => {
                  const selected = category.toLowerCase() === cat;
                  const catColor = getCategoryColor(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.chip,
                        selected && {
                          borderColor: catColor,
                          backgroundColor: `${catColor}24`,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.categoryChipDot,
                          { backgroundColor: catColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          selected && { color: catColor, fontWeight: '700' },
                        ]}
                      >
                        {cat.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Campos del Formulario */}
          <View style={styles.formInputsGroup}>
            <GlassInput
              label="Título (ej. Arriendo, Crédito Vehicular, Sueldo)"
              placeholder="Ej. Crédito Vehicular"
              value={title}
              onChangeText={setTitle}
            />
            <GlassInput
              label="Monto Mensual (CLP)"
              placeholder="Ej. 285000"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <View style={styles.formSectionGroup}>
              <Text style={styles.fieldSectionLabel}>VIGENCIA TEMPORAL</Text>
              <View style={[styles.dateRow, !isDesktop && styles.dateRowMobile]}>
                <View style={styles.dateCol}>
                  <GlassInput
                    label="Mes Inicio (YYYY-MM)"
                    placeholder="2026-01"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={styles.dateCol}>
                  <GlassInput
                    label="Mes Límite Opcional (YYYY-MM)"
                    placeholder="Ej. 2026-12 o 2027-04"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>
            </View>
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.submitButtonWrap}>
            <TeslaButton
              title="Guardar Movimiento Recurrente"
              onPress={handleCreate}
              loading={submitting}
            />
          </View>
        </GlassCard>
      ) : null}

      {/* Panel Dinámico de Balance Post-Pagos (Etapa 5) */}
      <GlassCard
        style={[
          styles.postPaymentCard,
          isAllPaid && styles.postPaymentCardComplete,
        ]}
      >
        <View style={styles.postPaymentHeader}>
          <View style={styles.postPaymentTitleRow}>
            <CheckCircle2
              size={18}
              color={isAllPaid ? '#10B981' : colors.textPrimary}
            />
            <Text
              style={[
                styles.postPaymentTitle,
                isAllPaid && styles.postPaymentTitleComplete,
              ]}
            >
              {isAllPaid
                ? 'COMPROMISOS DEL MES 100% LIQUIDADOS'
                : 'CONTROL DE SALDO Y PAGOS DEL CHECKLIST'}
            </Text>
          </View>
          <View
            style={[
              styles.progressBadge,
              isAllPaid && styles.progressBadgeComplete,
            ]}
          >
            <Text
              style={[
                styles.progressBadgeText,
                isAllPaid && styles.progressBadgeTextComplete,
              ]}
            >
              {paidPercent}% PAGADO
            </Text>
          </View>
        </View>

        {/* Barra de Progreso Visual */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${paidPercent}%` },
              isAllPaid && styles.progressBarFillComplete,
            ]}
          />
        </View>

        {/* Métricas Post-Pago en Tiempo Real */}
        <View style={styles.postPaymentGrid}>
          <View style={styles.postPaymentMetric}>
            <Text style={styles.postPaymentMetricLabel}>PAGADO HASTA HOY</Text>
            <Text style={styles.postPaymentMetricVal}>
              {formatCLP(totalPaidAmount)}
            </Text>
            <Text style={styles.postPaymentMetricSub}>
              {totalPaidCount} de {totalCommitmentsCount} compromisos
            </Text>
          </View>

          <View style={styles.postPaymentMetric}>
            <Text style={styles.postPaymentMetricLabel}>RESTA POR PAGAR</Text>
            <Text
              style={[
                styles.postPaymentMetricVal,
                {
                  color:
                    pendingCommitmentsAmount > 0 ? '#FB923C' : '#10B981',
                },
              ]}
            >
              {formatCLP(pendingCommitmentsAmount)}
            </Text>
            <Text style={styles.postPaymentMetricSub}>
              {isAllPaid
                ? 'Todos los ítems al día'
                : `${totalCommitmentsCount - totalPaidCount} pendientes`}
            </Text>
          </View>

          <View
            style={[
              styles.postPaymentMetric,
              styles.postPaymentMetricHighlight,
              isAllPaid && styles.postPaymentMetricHighlightComplete,
            ]}
          >
            <Text style={styles.postPaymentMetricLabel}>
              SALDO FINAL TRAS PAGAR TODO
            </Text>
            <Text
              style={[
                styles.postPaymentMetricVal,
                { color: monthlySurplus >= 0 ? '#34D399' : '#F43F5E' },
              ]}
            >
              {formatCLP(monthlySurplus)}
            </Text>
            <Text style={styles.postPaymentMetricSub}>
              {monthlySurplus >= 0
                ? 'Remanente libre del mes'
                : 'Déficit mensual'}
            </Text>
          </View>
        </View>

        {/* Monitoreo de Saldo Bancario en Cuentas Corrientes */}
        {totalCheckingBalance > 0 ? (
          <View style={styles.postPaymentFooterRow}>
            <Wallet size={14} color={colors.textSecondary} />
            <Text style={styles.postPaymentFooterText}>
              Saldo estimado en cuenta corriente al liquidar pendientes:{' '}
              <Text style={styles.postPaymentFooterBold}>
                {formatCLP(projectedCheckingAfterPending)}
              </Text>
            </Text>
          </View>
        ) : null}
      </GlassCard>

      {/* Lista Interactiva de Gastos Fijos y Tarjetas Vigentes en el Mes */}
      <GlassCard>
        {standaloneExpenses.length === 0 && cardAssignedExpenses.length === 0 && activeCards.length === 0 ? (
          <Text style={styles.emptyText}>
            No hay gastos fijos ni compromisos de tarjetas para {formatPeriodFull(period)}.
          </Text>
        ) : (
          <View style={styles.listStack}>
            {/* 1. Tarjetas de Crédito Facturadas en el Mes */}
            {activeCards.map((card, idx) => {
              const isPaid = Boolean(paidCardIdsInPeriod?.has(card.id));
              const brand = resolveCardBrand(card);
              const isSantander = brand === 'santander';
              const isFalabella = brand === 'falabella';
              const brandColor = isSantander
                ? '#A855F7'
                : isFalabella
                ? '#58B845'
                : '#A1A1AA';
              const brandLabel = isSantander
                ? 'Santander LATAM Pass'
                : isFalabella
                ? 'CMR Banco Falabella'
                : 'Tarjeta de Crédito';

              const cardData = cardMetricsMap.get(card.id);
              const cardMetrics = cardData?.metrics;
              const cardItems = cardData?.cardItems || [];
              const billedAmount = cardMetrics ? cardMetrics.usedAmount : (card.current_balance || 0);
              const baseBal = cardMetrics ? cardMetrics.baseBalance : (card.current_balance || 0);
              const recurringTotal = cardMetrics ? cardMetrics.recurringCharges : 0;

              return (
                <View key={`card-${card.id}`}>
                  {idx > 0 ? <View style={styles.itemDivider} /> : null}
                  <View style={styles.itemRow}>
                    <Pressable
                      onPress={() => onToggleCardPaid?.(card.id)}
                      style={({ pressed }) => [
                        styles.checkbox,
                        isPaid && styles.checkboxChecked,
                        pressed && styles.pressed,
                      ]}
                    >
                      {isPaid ? (
                        <Check
                          size={14}
                          color={colors.buttonPrimaryText}
                          strokeWidth={3}
                        />
                      ) : null}
                    </Pressable>

                    <View style={styles.itemInfo}>
                      <View style={styles.itemTitleRow}>
                        <Text
                          style={[
                            styles.itemTitle,
                            isPaid && styles.itemTitlePaid,
                          ]}
                        >
                          {card.name}
                        </Text>
                        <View
                          style={[
                            styles.cardBrandPill,
                            {
                              backgroundColor: `${brandColor}18`,
                              borderColor: `${brandColor}45`,
                            },
                          ]}
                        >
                          <CreditCard size={11} color={brandColor} />
                          <Text
                            style={[
                              styles.cardBrandPillText,
                              { color: brandColor },
                            ]}
                          >
                            {brandLabel}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.itemMeta}>
                        ESTADO DE CUENTA MENSUAL · VENCE DÍA {card.billing_day || 25}
                        {isPaid ? ' · PAGADO' : ' · PENDIENTE DE PAGO'}
                      </Text>

                      {recurringTotal > 0 ? (
                        <View style={styles.cardBreakdownBox}>
                          <Text style={styles.cardBreakdownDetailText}>
                            {baseBal > 0
                              ? `Saldo base: ${formatCLP(baseBal)} + ${cardItems.length} cargo(s): ${formatCLP(recurringTotal)}`
                              : `${cardItems.length} cargo(s) recurrente(s) facturado(s): ${formatCLP(recurringTotal)}`}
                          </Text>
                          <View style={styles.cardChargesChipRow}>
                            {cardItems.map((cItem) => (
                              <View key={cItem.id} style={styles.cardChargeMiniChip}>
                                <Text style={styles.cardChargeMiniChipText} numberOfLines={1}>
                                  {cItem.title}: {formatCLP(cItem.amount)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.itemRight}>
                      <Text
                        style={[
                          styles.itemAmount,
                          isPaid && styles.itemAmountPaid,
                        ]}
                      >
                        {formatCLP(billedAmount)}
                      </Text>
                      <View style={styles.cardPaymentStatusBadge}>
                        <Text
                          style={[
                            styles.cardPaymentStatusText,
                            isPaid
                              ? styles.cardStatusPaid
                              : styles.cardStatusPending,
                          ]}
                        >
                          {isPaid ? 'PAGADO' : 'POR PAGAR'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Separador entre Tarjetas y Gastos Fijos si ambos existen */}
            {activeCards.length > 0 && standaloneExpenses.length > 0 ? (
              <View style={styles.itemDivider} />
            ) : null}

            {/* 2. Gastos Fijos Recurrentes Directos */}
            {standaloneExpenses.map((item, idx) => {
              const isPaid = paidItemIdsInPeriod.has(item.id);
              const endShort = formatPeriodShort(item.end_date);
              const isEditing = editingItemId === item.id;

              return (
                <View key={item.id}>
                  {idx > 0 ? <View style={styles.itemDivider} /> : null}
                  <View style={styles.itemRow}>
                    <Pressable
                      onPress={() => onTogglePaid(item.id)}
                      style={({ pressed }) => [
                        styles.checkbox,
                        isPaid && styles.checkboxChecked,
                        pressed && styles.pressed,
                      ]}
                    >
                      {isPaid ? (
                        <Check
                          size={14}
                          color={colors.buttonPrimaryText}
                          strokeWidth={3}
                        />
                      ) : null}
                    </Pressable>

                    <Pressable
                      onPress={() => startEditingItem(item)}
                      style={styles.itemInfo}
                    >
                      <View style={styles.itemTitleRow}>
                        <Text
                          style={[
                            styles.itemTitle,
                            isPaid && styles.itemTitlePaid,
                          ]}
                        >
                          {item.title}
                        </Text>
                        {endShort ? (
                          <View style={styles.validityBadge}>
                            <Clock size={11} color={colors.textSecondary} />
                            <Text style={styles.validityBadgeText}>
                              Hasta {endShort}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.itemMetaRow}>
                        <View
                          style={[
                            styles.categoryMiniBadge,
                            {
                              backgroundColor: `${getCategoryColor(item.category)}18`,
                              borderColor: `${getCategoryColor(item.category)}45`,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.categoryMiniDot,
                              { backgroundColor: getCategoryColor(item.category) },
                            ]}
                          />
                          <Text
                            style={[
                              styles.categoryMiniBadgeText,
                              { color: getCategoryColor(item.category) },
                            ]}
                          >
                            {item.category.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.itemMeta}>
                          {item.account_name || 'Cuenta'}
                          {isPaid ? ' · PAGADO' : ' · PENDIENTE'}
                        </Text>
                      </View>

                      {/* Desglose rápido si tiene sub-ítems anidados */}
                      {item.sub_items && item.sub_items.length > 0 ? (
                        <View style={styles.subItemsInline}>
                          {item.sub_items.map((sub) => (
                            <Text key={sub.id} style={styles.subItemChip}>
                              {sub.name}: {formatCLP(sub.amount)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </Pressable>

                    <View style={styles.itemRight}>
                      <Text
                        style={[
                          styles.itemAmount,
                          isPaid && styles.itemAmountPaid,
                        ]}
                      >
                        {formatCLP(item.amount)}
                      </Text>
                      <View style={styles.rowActions}>
                        <Pressable
                          onPress={() => startEditingItem(item)}
                          style={[
                            styles.actionIconBtn,
                            isEditing && styles.actionIconBtnActive,
                          ]}
                        >
                          <Pencil
                            size={14}
                            color={
                              isEditing
                                ? colors.buttonPrimaryText
                                : colors.textSecondary
                            }
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => onDeleteRecurringItem(item.id)}
                          style={styles.actionIconBtn}
                        >
                          <Trash2 size={14} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {renderEditPanel(item)}
                </View>
              );
            })}

            {/* 3. Cargos Recurrentes en Tarjetas de Crédito (Detalle gestionable) */}
            {cardAssignedExpenses.length > 0 ? (
              <View style={styles.cardAssignedSection}>
                <View style={styles.cardAssignedHeader}>
                  <Text style={styles.cardAssignedHeaderTitle}>
                    CARGOS VIGENTES EN TARJETAS ({cardAssignedExpenses.length})
                  </Text>
                  <Text style={styles.cardAssignedHeaderSub}>
                    Consolidados y liquidados dentro del total facturado de tus tarjetas arriba
                  </Text>
                </View>

                {cardAssignedExpenses.map((item, idx) => {
                  const parentCard = creditCards.find((c) => c.id === item.account_id);
                  const isEditing = editingItemId === item.id;
                  const endShort = formatPeriodShort(item.end_date);
                  const isCardPaid = Boolean(parentCard && paidCardIdsInPeriod?.has(parentCard.id));

                  return (
                    <View key={`card-exp-${item.id}`}>
                      {idx > 0 ? <View style={styles.itemDivider} /> : null}
                      <View style={styles.itemRow}>
                        <View
                          style={[
                            styles.cardChargeIndicator,
                            isCardPaid && styles.cardChargeIndicatorPaid,
                          ]}
                        >
                          <CreditCard
                            size={13}
                            color={isCardPaid ? '#34D399' : '#818CF8'}
                          />
                        </View>

                        <Pressable
                          onPress={() => startEditingItem(item)}
                          style={styles.itemInfo}
                        >
                          <View style={styles.itemTitleRow}>
                            <Text
                              style={[
                                styles.itemTitle,
                                isCardPaid && styles.itemTitlePaid,
                              ]}
                            >
                              {item.title}
                            </Text>
                            {endShort ? (
                              <View style={styles.validityBadge}>
                                <Clock size={11} color={colors.textSecondary} />
                                <Text style={styles.validityBadgeText}>
                                  Hasta {endShort}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.itemMetaRow}>
                            <View
                              style={[
                                styles.categoryMiniBadge,
                                {
                                  backgroundColor: `${getCategoryColor(item.category)}18`,
                                  borderColor: `${getCategoryColor(item.category)}45`,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.categoryMiniDot,
                                  { backgroundColor: getCategoryColor(item.category) },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.categoryMiniBadgeText,
                                  { color: getCategoryColor(item.category) },
                                ]}
                              >
                                {item.category.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.itemMeta}>
                              En {parentCard?.name || 'Tarjeta de Crédito'}
                              {isCardPaid ? ' · PAGADO CON TARJETA' : ' · INCLUIDO EN FACTURACIÓN'}
                            </Text>
                          </View>

                          {item.sub_items && item.sub_items.length > 0 ? (
                            <View style={styles.subItemsInline}>
                              {item.sub_items.map((sub) => (
                                <Text key={sub.id} style={styles.subItemChip}>
                                  {sub.name}: {formatCLP(sub.amount)}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </Pressable>

                        <View style={styles.itemRight}>
                          <Text
                            style={[
                              styles.itemAmount,
                              isCardPaid && styles.itemAmountPaid,
                            ]}
                          >
                            {formatCLP(item.amount)}
                          </Text>
                          <View style={styles.rowActions}>
                            <Pressable
                              onPress={() => startEditingItem(item)}
                              style={[
                                styles.actionIconBtn,
                                isEditing && styles.actionIconBtnActive,
                              ]}
                            >
                              <Pencil
                                size={14}
                                color={
                                  isEditing
                                    ? colors.buttonPrimaryText
                                    : colors.textSecondary
                                }
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => onDeleteRecurringItem(item.id)}
                              style={styles.actionIconBtn}
                            >
                              <Trash2 size={14} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      {renderEditPanel(item)}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      </GlassCard>

      {/* Lista de Ingresos Fijos Vigentes */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderTextCol}>
          <Text style={styles.sectionTitle}>Ingresos Fijos Mensuales</Text>
          <Text style={styles.sectionSubtitle}>
            Entradas fijas activas en {formatPeriodFull(period)}
          </Text>
        </View>
      </View>

      <GlassCard>
        {activeIncomes.length === 0 ? (
          <Text style={styles.emptyText}>
            No hay ingresos fijos registrados en este mes.
          </Text>
        ) : (
          <View style={styles.listStack}>
            {activeIncomes.map((item, idx) => {
              const isEditing = editingItemId === item.id;
              return (
                <View key={item.id}>
                  {idx > 0 ? <View style={styles.itemDivider} /> : null}
                  <View style={styles.itemRow}>
                    <Pressable
                      onPress={() => startEditingItem(item)}
                      style={styles.itemInfo}
                    >
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemMeta}>
                        {item.account_name || 'Cuenta Principal'} · INGRESO MENSUAL
                      </Text>
                    </Pressable>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemAmount}>{formatCLP(item.amount)}</Text>
                      <View style={styles.rowActions}>
                        <Pressable
                          onPress={() => startEditingItem(item)}
                          style={[
                            styles.actionIconBtn,
                            isEditing && styles.actionIconBtnActive,
                          ]}
                        >
                          <Pencil
                            size={14}
                            color={
                              isEditing
                                ? colors.buttonPrimaryText
                                : colors.textSecondary
                            }
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => onDeleteRecurringItem(item.id)}
                          style={styles.actionIconBtn}
                        >
                          <Trash2 size={14} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {renderEditPanel(item)}
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>

      {/* Vigencia Temporal: Compromisos omitidos automáticamente en este mes por fecha límite */}
      {expiredOrFutureInMonth.length > 0 ? (
        <GlassCard style={styles.omittedCard}>
          <Text style={styles.omittedTitle}>
            REGLA DE VIGENCIA TEMPORAL · OMITIDOS EN{' '}
            {formatPeriodFull(period).toUpperCase()}
          </Text>
          <Text style={styles.omittedSubtitle}>
            Estos compromisos se excluyen automáticamente del cálculo de este mes porque su fecha límite ya venció, están pausados o aún no inician (puedes editarlos para cambiar su vigencia):
          </Text>
          <View style={styles.omittedList}>
            {expiredOrFutureInMonth.map((item) => {
              const isEditing = editingItemId === item.id;
              return (
                <View key={item.id}>
                  <View style={styles.omittedRow}>
                    <View style={styles.omittedTextCol}>
                      <Text style={styles.omittedItemName}>
                        {item.title} ({formatCLP(item.amount)})
                      </Text>
                      <Text style={styles.omittedItemDates}>
                        Vigencia: {formatPeriodShort(item.start_date)} →{' '}
                        {item.end_date
                          ? formatPeriodShort(item.end_date)
                          : 'Indefinido'}
                        {!item.is_active ? ' · PAUSADO' : ''}
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => startEditingItem(item)}
                        style={[
                          styles.actionIconBtn,
                          isEditing && styles.actionIconBtnActive,
                        ]}
                      >
                        <Pencil
                          size={13}
                          color={
                            isEditing
                              ? colors.buttonPrimaryText
                              : colors.textSecondary
                          }
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => onDeleteRecurringItem(item.id)}
                        style={styles.actionIconBtn}
                      >
                        <Trash2 size={13} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                  {renderEditPanel(item)}
                </View>
              );
            })}
          </View>
        </GlassCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 18,
  },
  periodCard: {
    paddingVertical: 20,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  periodLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodSectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  periodControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 148,
    alignItems: 'center',
  },
  periodText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricsGridMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 4,
  },
  metricBoxMobile: {
    flex: 0,
    width: '100%',
    minHeight: 'auto',
  },
  metricBoxHighlight: {
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    lineHeight: 14,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  metricSub: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  sectionHeaderTextCol: {
    flex: 1,
    minWidth: 180,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  addPillButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  postPaymentCard: {
    padding: 18,
    gap: 14,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
  },
  postPaymentCardComplete: {
    borderColor: 'rgba(52, 211, 153, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  postPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  postPaymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postPaymentTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  postPaymentTitleComplete: {
    color: '#34D399',
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  progressBadgeComplete: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderColor: '#34D399',
  },
  progressBadgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBadgeTextComplete: {
    color: '#34D399',
  },
  progressBarTrack: {
    height: 6,
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: '#34D399',
  },
  progressBarFillComplete: {
    backgroundColor: '#10B981',
  },
  postPaymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  postPaymentMetric: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  postPaymentMetricHighlight: {
    borderColor: 'rgba(52, 211, 153, 0.3)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  postPaymentMetricHighlightComplete: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  postPaymentMetricLabel: {
    color: colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  postPaymentMetricVal: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  postPaymentMetricSub: {
    color: colors.textSecondary,
    fontSize: 10.5,
    marginTop: 4,
  },
  postPaymentFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  postPaymentFooterText: {
    color: colors.textSecondary,
    fontSize: 11.5,
  },
  postPaymentFooterBold: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  formCard: {
    gap: 20,
    padding: 22,
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 4,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentOptionActive: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  segmentOptionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentOptionTextActive: {
    color: colors.buttonPrimaryText,
  },
  formSectionGroup: {
    gap: 10,
  },
  fieldSectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  categoryChipDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
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
    marginTop: 4,
  },
  formFields: {
    gap: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 14,
  },
  dateRowMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  submitButtonWrap: {
    marginTop: 8,
  },
  dateCol: {
    flex: 1,
    width: '100%',
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  listStack: {
    gap: 2,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  itemTitlePaid: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  validityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  validityBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  cardBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  cardBrandPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardPaymentStatusBadge: {
    marginTop: 2,
  },
  cardPaymentStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardStatusPaid: {
    color: '#34D399',
  },
  cardStatusPending: {
    color: colors.textSecondary,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryMiniDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  categoryMiniBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  subItemsInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  subItemChip: {
    color: colors.textSecondary,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemAmount: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  itemAmountPaid: {
    color: colors.textSecondary,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  editPanel: {
    marginTop: 12,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  editHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editPanelTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  closeEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  closeEditText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  subItemsNoticeBox: {
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 4,
  },
  subItemsNoticeLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  subItemsNoticeSub: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  quickValidityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ghostPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  ghostPillInactive: {
    opacity: 0.6,
  },
  ghostPillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  editSubSection: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
  },
  editSubList: {
    gap: 6,
  },
  editSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  editSubName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  editSubRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editSubAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  iconActionBtn: {
    padding: 4,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  omittedCard: {
    opacity: 0.9,
  },
  omittedTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  omittedSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  omittedList: {
    gap: 8,
  },
  omittedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  omittedTextCol: {
    flex: 1,
    gap: 2,
  },
  omittedItemName: {
    color: colors.textSecondary,
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  omittedItemDates: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  cardBreakdownBox: {
    marginTop: 6,
    gap: 4,
  },
  cardBreakdownDetailText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardChargesChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  cardChargeMiniChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cardChargeMiniChipText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardAssignedSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardAssignedHeader: {
    marginBottom: 12,
  },
  cardAssignedHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  cardAssignedHeaderSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardChargeIndicator: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChargeIndicatorPaid: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  pressed: {
    opacity: 0.75,
  },
});
