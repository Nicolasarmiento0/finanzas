import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  CreditCard,
  Edit3,
  Home,
  Laptop,
  PiggyBank,
  Plus,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Wallet,
  Watch,
  X,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { usePrivacy } from '@/context/PrivacyContext';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Account,
  CreateFuturePurchaseInput,
  CreateRecurringItemInput,
  CreateVariableExpenseInput,
  FuturePurchase,
  FuturePurchaseCategory,
  FuturePurchasePaymentMode,
  FuturePurchasePriority,
  MonthlyPayment,
  RecurringItem,
  UpdateFuturePurchaseInput,
  VariableExpense,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import {
  evaluateFuturePurchase,
  evaluateFuturePurchasesCart,
  formatPeriodFull,
  getDebtReleaseMilestones,
  PurchaseViabilityVerdict,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

interface FuturePurchasesSectionProps {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
  variableExpenses: VariableExpense[];
  payments: MonthlyPayment[];
  futurePurchases: FuturePurchase[];
  overallHealthScore: number;
  onCreateFuturePurchase: (input: CreateFuturePurchaseInput) => Promise<void>;
  onUpdateFuturePurchase: (id: string, input: UpdateFuturePurchaseInput) => Promise<void>;
  onDeleteFuturePurchase: (id: string) => Promise<void>;
  onCreateVariableExpense: (input: CreateVariableExpenseInput) => Promise<void>;
  onCreateRecurringItem: (input: CreateRecurringItemInput) => Promise<void>;
}

interface CategoryCatalogItem {
  key: FuturePurchaseCategory;
  label: string;
  shortLabel: string;
  emoji: string;
  defaultTitle: string;
  defaultAmount: string;
  defaultMode: FuturePurchasePaymentMode;
  defaultInstallments: number;
  expenseCategory: string;
  color: string;
}

const CATEGORIES_CATALOG: CategoryCatalogItem[] = [
  {
    key: 'ropa',
    label: 'Ropa & Calzado',
    shortLabel: 'Ropa / Calzado',
    emoji: '👕',
    defaultTitle: 'Zapatillas / Chaqueta',
    defaultAmount: '79990',
    defaultMode: 'one_time_cash',
    defaultInstallments: 3,
    expenseCategory: 'general',
    color: '#38BDF8',
  },
  {
    key: 'accesorios',
    label: 'Accesorios & Estilo',
    shortLabel: 'Accesorio',
    emoji: '⌚',
    defaultTitle: 'Reloj / Lentes / Mochila',
    defaultAmount: '64990',
    defaultMode: 'one_time_cash',
    defaultInstallments: 3,
    expenseCategory: 'general',
    color: '#A855F7',
  },
  {
    key: 'tecnologia',
    label: 'Tecnología & Gadgets',
    shortLabel: 'Tecnología',
    emoji: '💻',
    defaultTitle: 'Audífonos / Monitor / Gadget',
    defaultAmount: '189990',
    defaultMode: 'installments',
    defaultInstallments: 6,
    expenseCategory: 'entretenimiento',
    color: '#10B981',
  },
  {
    key: 'suscripcion',
    label: 'Suscripción / Membresía',
    shortLabel: 'Nueva Suscripción',
    emoji: '🔄',
    defaultTitle: 'ChatGPT Plus / Streaming / App',
    defaultAmount: '19990',
    defaultMode: 'recurring_subscription',
    defaultInstallments: 1,
    expenseCategory: 'suscripciones',
    color: '#818CF8',
  },
  {
    key: 'hogar',
    label: 'Hogar & Equipamiento',
    shortLabel: 'Hogar',
    emoji: '🏠',
    defaultTitle: 'Silla Ergonómica / Cafetera',
    defaultAmount: '149990',
    defaultMode: 'installments',
    defaultInstallments: 6,
    expenseCategory: 'vivienda',
    color: '#F59E0B',
  },
  {
    key: 'experiencias',
    label: 'Viajes & Experiencias',
    shortLabel: 'Viaje / Experiencia',
    emoji: '✈️',
    defaultTitle: 'Escapada Fin de Semana / Concierto',
    defaultAmount: '120000',
    defaultMode: 'one_time_cash',
    defaultInstallments: 3,
    expenseCategory: 'entretenimiento',
    color: '#EC4899',
  },
  {
    key: 'otros',
    label: 'Otros Proyectos',
    shortLabel: 'Otro Proyecto',
    emoji: '📦',
    defaultTitle: 'Equipamiento Deportivo / Regalo',
    defaultAmount: '55000',
    defaultMode: 'one_time_cash',
    defaultInstallments: 3,
    expenseCategory: 'general',
    color: '#94A3B8',
  },
];

const PRIORITY_META: Record<
  FuturePurchasePriority,
  { label: string; shortLabel: string; color: string; bg: string; border: string }
> = {
  high: {
    label: '🔴 Alta / Necesidad',
    shortLabel: 'Prioridad Alta',
    color: '#F87171',
    bg: 'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.35)',
  },
  medium: {
    label: '🟡 Media / Planificada',
    shortLabel: 'Planificada',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  low: {
    label: '🔵 Baja / Capricho',
    shortLabel: 'Capricho / Baja',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.35)',
  },
};

const INSTALLMENT_QUICK_OPTIONS = [3, 6, 12];

function getCategoryMeta(catKey: string): CategoryCatalogItem {
  return (
    CATEGORIES_CATALOG.find((c) => c.key === catKey) ||
    CATEGORIES_CATALOG[CATEGORIES_CATALOG.length - 1]
  );
}

function renderCategoryIcon(catKey: string, size = 15, color = '#FFFFFF') {
  switch (catKey) {
    case 'ropa':
      return <Shirt size={size} color={color} />;
    case 'accesorios':
      return <Watch size={size} color={color} />;
    case 'tecnologia':
      return <Laptop size={size} color={color} />;
    case 'suscripcion':
      return <Repeat size={size} color={color} />;
    case 'hogar':
      return <Home size={size} color={color} />;
    case 'experiencias':
      return <Compass size={size} color={color} />;
    default:
      return <ShoppingBag size={size} color={color} />;
  }
}

function getVerdictTheme(verdict: PurchaseViabilityVerdict) {
  switch (verdict) {
    case 'viable_today':
      return {
        color: '#34D399',
        bg: 'rgba(52, 211, 153, 0.12)',
        border: 'rgba(52, 211, 153, 0.38)',
        dot: '🟢',
      };
    case 'viable_planned':
      return {
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.38)',
        dot: '🟡',
      };
    case 'postpone':
    default:
      return {
        color: '#F87171',
        bg: 'rgba(248, 113, 113, 0.12)',
        border: 'rgba(248, 113, 113, 0.38)',
        dot: '🔴',
      };
  }
}

export function FuturePurchasesSection({
  period,
  accounts,
  recurringItems,
  variableExpenses,
  payments,
  futurePurchases,
  overallHealthScore,
  onCreateFuturePurchase,
  onUpdateFuturePurchase,
  onDeleteFuturePurchase,
  onCreateVariableExpense,
  onCreateRecurringItem,
}: FuturePurchasesSectionProps) {
  const { isDesktop } = useResponsive();
  usePrivacy(); // Suscripción reactiva al modo privado global

  // Estado del formulario de creación / edición
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<FuturePurchaseCategory>('tecnologia');
  const [paymentMode, setPaymentMode] =
    useState<FuturePurchasePaymentMode>('one_time_cash');
  const [installmentsCount, setInstallmentsCount] = useState<number>(6);
  const [priority, setPriority] = useState<FuturePurchasePriority>('medium');
  const [targetAccountId, setTargetAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Filtros y Modo Carrito
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusView, setStatusView] = useState<'active' | 'purchased'>('active');
  const [selectedCartIds, setSelectedCartIds] = useState<Set<string>>(new Set());

  // Simuladores en línea por tarjeta (override temporal sin guardar o con guardado rápido)
  const [cardSimOverrides, setCardSimOverrides] = useState<
    Record<string, { mode: FuturePurchasePaymentMode; installments: number }>
  >({});

  const checkingAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'checking'),
    [accounts]
  );
  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === 'credit_card'),
    [accounts]
  );

  // Evaluación base para métricas de cabecera
  const baselineEval = useMemo(
    () =>
      evaluateFuturePurchase(
        {
          id: 'baseline-probe',
          title: 'Referencia',
          category: 'otros',
          amount: 10000,
          payment_mode: 'one_time_cash',
          installments_count: 1,
          target_account_id: null,
          priority: 'medium',
        },
        { period, accounts, recurringItems, variableExpenses, payments }
      ),
    [period, accounts, recurringItems, variableExpenses, payments]
  );

  const milestones = useMemo(
    () => getDebtReleaseMilestones(recurringItems, period, 24),
    [recurringItems, period]
  );
  const nextMilestone = milestones[0] || null;

  const activeItems = useMemo(
    () => futurePurchases.filter((fp) => fp.status !== 'purchased'),
    [futurePurchases]
  );
  const purchasedItems = useMemo(
    () => futurePurchases.filter((fp) => fp.status === 'purchased'),
    [futurePurchases]
  );

  const filteredItems = useMemo(() => {
    const source = statusView === 'active' ? activeItems : purchasedItems;
    if (categoryFilter === 'all') return source;
    return source.filter((item) => item.category === categoryFilter);
  }, [statusView, activeItems, purchasedItems, categoryFilter]);

  // Ítems seleccionados en el Modo Carrito (si no hay ninguno marcado manualmente, permite simular los seleccionados)
  const selectedCartItems = useMemo(
    () => activeItems.filter((item) => selectedCartIds.has(item.id)),
    [activeItems, selectedCartIds]
  );

  const cartSimulation = useMemo(
    () =>
      evaluateFuturePurchasesCart(selectedCartItems, {
        period,
        accounts,
        recurringItems,
        variableExpenses,
        payments,
        currentHealthScore: overallHealthScore,
      }),
    [
      selectedCartItems,
      period,
      accounts,
      recurringItems,
      variableExpenses,
      payments,
      overallHealthScore,
    ]
  );

  const handleToggleCartItem = (id: string) => {
    setSelectedCartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCart = () => {
    if (selectedCartIds.size === activeItems.length) {
      setSelectedCartIds(new Set());
    } else {
      setSelectedCartIds(new Set(activeItems.map((i) => i.id)));
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setAmountStr('');
    setCategory('tecnologia');
    setPaymentMode('one_time_cash');
    setInstallmentsCount(6);
    setPriority('medium');
    setTargetAccountId(null);
    setNotes('');
  };

  const handleApplyQuickTemplate = (tpl: CategoryCatalogItem) => {
    setShowForm(true);
    setEditingId(null);
    setCategory(tpl.key);
    setTitle(tpl.defaultTitle);
    setAmountStr(tpl.defaultAmount);
    setPaymentMode(tpl.defaultMode);
    setInstallmentsCount(tpl.defaultInstallments);
    setPriority(tpl.key === 'suscripcion' ? 'low' : 'medium');
    if (tpl.defaultMode === 'installments' && creditCards[0]) {
      setTargetAccountId(creditCards[0].id);
    } else if (checkingAccounts[0]) {
      setTargetAccountId(checkingAccounts[0].id);
    }
  };

  const handleStartEdit = (item: FuturePurchase) => {
    setEditingId(item.id);
    setTitle(item.title);
    setAmountStr(String(item.amount));
    setCategory((item.category as FuturePurchaseCategory) || 'tecnologia');
    setPaymentMode(item.payment_mode);
    setInstallmentsCount(item.installments_count || 3);
    setPriority(item.priority || 'medium');
    setTargetAccountId(item.target_account_id);
    setNotes(item.notes || '');
    setShowForm(true);
  };

  const handleSaveForm = async () => {
    const cleanTitle = title.trim();
    const numericAmount = Math.round(
      Number(amountStr.replace(/[^0-9]/g, '')) || 0
    );
    if (!cleanTitle || numericAmount <= 0) return;

    setSubmitting(true);
    try {
      const effectiveMode: FuturePurchasePaymentMode =
        category === 'suscripcion' ? 'recurring_subscription' : paymentMode;
      const payload: CreateFuturePurchaseInput = {
        title: cleanTitle,
        category,
        amount: numericAmount,
        payment_mode: effectiveMode,
        installments_count:
          effectiveMode === 'installments' ? installmentsCount : 1,
        target_account_id: targetAccountId,
        priority,
        notes: notes.trim() || null,
      };

      if (editingId) {
        await onUpdateFuturePurchase(editingId, payload);
      } else {
        await onCreateFuturePurchase(payload);
      }
      resetForm();
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedSampleWishlist = async () => {
    setSubmitting(true);
    try {
      const defaultCardId = creditCards[0]?.id || checkingAccounts[0]?.id || null;
      const defaultCheckingId = checkingAccounts[0]?.id || null;

      await onCreateFuturePurchase({
        title: 'Zapatillas Running / Urbano',
        category: 'ropa',
        amount: 84990,
        payment_mode: 'one_time_cash',
        installments_count: 1,
        target_account_id: defaultCheckingId,
        priority: 'high',
        notes: 'Reemplazo calzado diario',
      });

      await onCreateFuturePurchase({
        title: 'Monitor UltraWide 34" / Audífonos Pro',
        category: 'tecnologia',
        amount: 249990,
        payment_mode: 'installments',
        installments_count: 6,
        target_account_id: defaultCardId,
        priority: 'medium',
        notes: 'Ideal comprar en cuotas sin interés o cuando termine crédito',
      });

      await onCreateFuturePurchase({
        title: 'Suscripción IA Pro / Streaming Extra',
        category: 'suscripcion',
        amount: 19990,
        payment_mode: 'recurring_subscription',
        installments_count: 1,
        target_account_id: defaultCardId,
        priority: 'low',
        notes: 'Evaluar costo anualizado antes de activar',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Flujo de Conversión en 1 Toque ("Marcar como Comprado", Sección 4 del Plan)
  const handleMarkAsPurchased = async (
    item: FuturePurchase,
    effectiveMode: FuturePurchasePaymentMode,
    effectiveInstallments: number
  ) => {
    setConvertingId(item.id);
    try {
      const catMeta = getCategoryMeta(item.category);
      const defaultChecking = checkingAccounts[0];
      const defaultCard = creditCards[0] || defaultChecking;

      if (
        effectiveMode === 'recurring_subscription' ||
        item.category === 'suscripcion'
      ) {
        const targetAccId =
          item.target_account_id || defaultCard?.id || defaultChecking?.id;
        if (targetAccId) {
          await onCreateRecurringItem({
            account_id: targetAccId,
            title: item.title,
            amount: item.amount,
            type: 'expense',
            category: 'suscripciones',
            start_date: period,
            is_active: true,
          });
        }
      } else if (effectiveMode === 'installments') {
        const n = Math.max(1, effectiveInstallments || item.installments_count || 3);
        const monthlyQuota = Math.max(1, Math.round(item.amount / n));
        const endDate = shiftPeriod(period, n - 1);
        const targetCardId =
          creditCards.find((c) => c.id === item.target_account_id)?.id ||
          defaultCard?.id ||
          defaultChecking?.id;

        if (targetCardId) {
          await onCreateRecurringItem({
            account_id: targetCardId,
            title: `${item.title} (${n} cuotas)`,
            amount: monthlyQuota,
            type: 'expense',
            category: catMeta.expenseCategory,
            start_date: period,
            end_date: endDate,
            is_active: true,
          });
        }
      } else {
        // Pago único al contado -> Gasto Variable del mes
        const targetCheckingId =
          checkingAccounts.find((c) => c.id === item.target_account_id)?.id ||
          defaultChecking?.id ||
          null;
        await onCreateVariableExpense({
          title: item.title,
          amount: item.amount,
          category: catMeta.expenseCategory,
          period,
          date: `${period}-${String(new Date().getDate()).padStart(2, '0')}`,
          account_id: targetCheckingId,
          notes: `Convertido desde Compras Futuras (${catMeta.label})`,
        });
      }

      await onUpdateFuturePurchase(item.id, {
        status: 'purchased',
        payment_mode: effectiveMode,
        installments_count: effectiveInstallments,
      });

      setSelectedCartIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <View style={styles.sectionStack}>
      {/* CABECERA EJECUTIVA DE CAPACIDAD DE COMPRA (3 Tarjetas) */}
      <View style={[styles.kpiGrid, isDesktop && styles.kpiGridDesktop]}>
        {/* Tarjeta 1: Presupuesto Seguro para Compras Hoy */}
        <GlassCard style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <View style={[styles.kpiIconBadge, styles.kpiIconEmerald]}>
              <Wallet size={15} color="#34D399" />
            </View>
            <Text style={styles.kpiEyebrow}>CAPACIDAD AL CONTADO HOY</Text>
          </View>
          <Text style={[styles.kpiMainValue, { color: '#34D399' }]}>
            {formatCLP(baselineEval.cashPath.safeAvailableToday)}
          </Text>
          <Text style={styles.kpiSubText}>
            Protegiendo tus gastos fijos y un colchón saludable de $8.000/día (
            actual: {formatCLP(baselineEval.cashPath.currentSafePerDay)}/día).
          </Text>
        </GlassCard>

        {/* Tarjeta 2: Próximo Impulso de Liquidez (Smart Debt-Release) */}
        <GlassCard style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <View style={[styles.kpiIconBadge, styles.kpiIconBlue]}>
              <Calendar size={15} color="#38BDF8" />
            </View>
            <Text style={styles.kpiEyebrow}>PRÓXIMO IMPULSO DE LIQUIDEZ</Text>
          </View>
          {nextMilestone ? (
            <>
              <Text style={[styles.kpiMainValue, { color: '#38BDF8' }]}>
                +{formatCLP(nextMilestone.releasedMonthlyAmount)}/mes
              </Text>
              <Text style={styles.kpiSubText} numberOfLines={2}>
                Desde {nextMilestone.releaseLabel} (termina{' '}
                {nextMilestone.itemTitles.slice(0, 2).join(', ')} en{' '}
                {nextMilestone.endLabel}).
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.kpiMainValue}>Estable</Text>
              <Text style={styles.kpiSubText}>
                Sin créditos o cuotas con fecha de término próxima registrada en{' '}
                {formatPeriodFull(period)}.
              </Text>
            </>
          )}
        </GlassCard>

        {/* Tarjeta 3: Simulador de Carrito Activo */}
        <GlassCard style={styles.kpiCard}>
          <View style={styles.kpiHeaderRow}>
            <View style={[styles.kpiIconBadge, styles.kpiIconAmber]}>
              <ShoppingCart size={15} color="#F59E0B" />
            </View>
            <Text style={styles.kpiEyebrow}>
              SIMULADOR CARRITO ({cartSimulation.selectedCount} SELECC.)
            </Text>
          </View>
          {cartSimulation.selectedCount > 0 ? (
            <>
              <Text style={[styles.kpiMainValue, { color: '#F59E0B' }]}>
                {formatCLP(cartSimulation.immediateCashOutflow)}{' '}
                {cartSimulation.additionalMonthlyOutflow > 0
                  ? `+ ${formatCLP(cartSimulation.additionalMonthlyOutflow)}/m`
                  : ''}
              </Text>
              <Text style={styles.kpiSubText}>
                Safe-to-Spend quedaría en{' '}
                {formatCLP(cartSimulation.projectedSafePerDay)}/día · Score:{' '}
                {cartSimulation.projectedHealthScore}/100.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.kpiMainValue}>
                {formatCLP(
                  activeItems.reduce((sum, i) => sum + (i.amount || 0), 0)
                )}
              </Text>
              <Text style={styles.kpiSubText}>
                Total en {activeItems.length}{' '}
                {activeItems.length === 1 ? 'deseo activo' : 'deseos activos'}.
                Marca ítems abajo para simular tu carrito.
              </Text>
            </>
          )}
        </GlassCard>
      </View>

      {/* BARRA DE PLANTILLAS RÁPIDAS 1-TOQUE + BOTÓN NUEVA COMPRA */}
      <GlassCard>
        <View style={styles.catalogHeaderRow}>
          <View style={styles.catalogTitleCol}>
            <Text style={styles.sectionEyebrow}>
              PLANIFICADOR INTELIGENTE DE DESEOS Y SUSCRIPCIONES
            </Text>
            <Text style={styles.sectionTitle}>
              Catálogo Rápido de Simulación (1 Toque)
            </Text>
          </View>

          <View style={styles.catalogHeaderActions}>
            {activeItems.length > 0 ? (
              <Pressable
                onPress={handleSelectAllCart}
                style={({ pressed }) => [
                  styles.secondaryActionPill,
                  pressed && styles.pressed,
                ]}
              >
                <ShoppingCart size={13} color={colors.textPrimary} />
                <Text style={styles.secondaryActionPillText}>
                  {selectedCartIds.size === activeItems.length
                    ? 'Limpiar Carrito'
                    : 'Simular Todo'}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                if (showForm) {
                  resetForm();
                  setShowForm(false);
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
              style={({ pressed }) => [
                styles.primaryActionPill,
                pressed && styles.pressed,
              ]}
            >
              {showForm ? (
                <>
                  <X size={14} color={colors.buttonPrimaryText} />
                  <Text style={styles.primaryActionPillText}>Cerrar</Text>
                </>
              ) : (
                <>
                  <Plus size={14} color={colors.buttonPrimaryText} />
                  <Text style={styles.primaryActionPillText}>
                    Nueva Futura Compra
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickTemplatesRow}
        >
          {CATEGORIES_CATALOG.map((tpl) => (
            <Pressable
              key={tpl.key}
              onPress={() => handleApplyQuickTemplate(tpl)}
              style={({ pressed }) => [
                styles.quickTemplateChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.quickTemplateEmoji}>{tpl.emoji}</Text>
              <Text style={styles.quickTemplateText}>{tpl.shortLabel}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* FORMULARIO DESPLEGABLE DE REGISTRO / EDICIÓN */}
        {showForm ? (
          <View style={styles.formContainer}>
            <Text style={styles.formHeading}>
              {editingId
                ? 'Editar Proyecto de Compra / Suscripción'
                : 'Registrar Nueva Compra o Suscripción en Evaluación'}
            </Text>

            <View style={[styles.formGrid, isDesktop && styles.formGridDesktop]}>
              <View style={styles.formFieldFlex2}>
                <GlassInput
                  label="Nombre del Producto, Prenda o Suscripción"
                  placeholder="Ej: Zapatillas Nike, Monitor LG, ChatGPT Plus..."
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
              <View style={styles.formFieldFlex1}>
                <GlassInput
                  label={
                    paymentMode === 'recurring_subscription' ||
                    category === 'suscripcion'
                      ? 'Costo Mensual (CLP)'
                      : 'Precio Total (CLP)'
                  }
                  placeholder="Ej: 89990"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>
            </View>

            {/* Selector de Categoría */}
            <View style={styles.selectorGroup}>
              <Text style={styles.selectorLabel}>CATEGORÍA</Text>
              <View style={styles.chipsWrap}>
                {CATEGORIES_CATALOG.map((cat) => {
                  const active = category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => {
                        setCategory(cat.key);
                        if (cat.key === 'suscripcion') {
                          setPaymentMode('recurring_subscription');
                        } else if (paymentMode === 'recurring_subscription') {
                          setPaymentMode('one_time_cash');
                        }
                      }}
                      style={[
                        styles.optionChip,
                        active && {
                          borderColor: cat.color,
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        },
                      ]}
                    >
                      <Text style={styles.optionChipText}>
                        {cat.emoji} {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Selector de Modalidad de Pago y Prioridad */}
            <View style={[styles.formGrid, isDesktop && styles.formGridDesktop]}>
              <View style={styles.formFieldFlex1}>
                <Text style={styles.selectorLabel}>MODALIDAD DE PAGO A SIMULAR</Text>
                <View style={styles.chipsWrap}>
                  <Pressable
                    onPress={() => setPaymentMode('one_time_cash')}
                    style={[
                      styles.optionChip,
                      paymentMode === 'one_time_cash' && styles.optionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        paymentMode === 'one_time_cash' &&
                          styles.optionChipTextActive,
                      ]}
                    >
                      💵 Contado / Débito
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPaymentMode('installments')}
                    style={[
                      styles.optionChip,
                      paymentMode === 'installments' && styles.optionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        paymentMode === 'installments' &&
                          styles.optionChipTextActive,
                      ]}
                    >
                      💳 Tarjeta en Cuotas
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPaymentMode('recurring_subscription')}
                    style={[
                      styles.optionChip,
                      paymentMode === 'recurring_subscription' &&
                        styles.optionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        paymentMode === 'recurring_subscription' &&
                          styles.optionChipTextActive,
                      ]}
                    >
                      🔄 Suscripción Mensual
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.formFieldFlex1}>
                <Text style={styles.selectorLabel}>NIVEL DE PRIORIDAD</Text>
                <View style={styles.chipsWrap}>
                  {(['high', 'medium', 'low'] as FuturePurchasePriority[]).map(
                    (prioKey) => {
                      const pMeta = PRIORITY_META[prioKey];
                      const active = priority === prioKey;
                      return (
                        <Pressable
                          key={prioKey}
                          onPress={() => setPriority(prioKey)}
                          style={[
                            styles.optionChip,
                            active && {
                              backgroundColor: pMeta.bg,
                              borderColor: pMeta.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              active && { color: pMeta.color, fontWeight: '700' },
                            ]}
                          >
                            {pMeta.label}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </View>
            </View>

            {/* Si es en cuotas: selector de número de cuotas y tarjeta */}
            {paymentMode === 'installments' ? (
              <View style={[styles.formGrid, isDesktop && styles.formGridDesktop]}>
                <View style={styles.formFieldFlex1}>
                  <Text style={styles.selectorLabel}>NÚMERO DE CUOTAS SIN INTERÉS</Text>
                  <View style={styles.chipsWrap}>
                    {[1, 3, 6, 12, 18, 24].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setInstallmentsCount(n)}
                        style={[
                          styles.optionChip,
                          installmentsCount === n && styles.optionChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            installmentsCount === n &&
                              styles.optionChipTextActive,
                          ]}
                        >
                          {n} {n === 1 ? 'cuota' : 'cuotas'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {creditCards.length > 0 ? (
                  <View style={styles.formFieldFlex1}>
                    <Text style={styles.selectorLabel}>TARJETA PREFERIDA</Text>
                    <View style={styles.chipsWrap}>
                      {creditCards.map((card) => (
                        <Pressable
                          key={card.id}
                          onPress={() => setTargetAccountId(card.id)}
                          style={[
                            styles.optionChip,
                            targetAccountId === card.id && styles.optionChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              targetAccountId === card.id &&
                                styles.optionChipTextActive,
                            ]}
                          >
                            💳 {card.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            <GlassInput
              label="Notas / Link o Motivo (Opcional)"
              placeholder="Ej: Esperar CyberDay o fin del crédito vehicular en diciembre"
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.formFooterRow}>
              <TeslaButton
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
              />
              <TeslaButton
                title={editingId ? 'Guardar Cambios' : 'Agregar y Evaluar Viabilidad'}
                onPress={handleSaveForm}
                loading={submitting}
              />
            </View>
          </View>
        ) : null}
      </GlassCard>

      {/* BARRA ACTIVA DEL MODO CARRITO (Cuando hay >= 1 ítems seleccionados) */}
      {selectedCartItems.length > 0 ? (
        <GlassCard style={styles.cartBannerCard}>
          <View style={styles.cartBannerTopRow}>
            <View style={styles.cartBannerTitleCol}>
              <View style={styles.cartBadgeRow}>
                <ShoppingCart size={15} color="#F59E0B" />
                <Text style={styles.cartEyebrow}>
                  SIMULACIÓN COMBINADA MULTI-ÍTEM ({cartSimulation.selectedCount}{' '}
                  SELECCIONADOS)
                </Text>
              </View>
              <Text style={styles.cartHeadline}>
                {cartSimulation.cartVerdictLabel}
              </Text>
            </View>

            <Pressable
              onPress={() => setSelectedCartIds(new Set())}
              style={styles.clearCartBtn}
            >
              <Text style={styles.clearCartBtnText}>Limpiar Selección</Text>
            </Pressable>
          </View>

          <View style={styles.cartMetricsRow}>
            <View style={styles.cartMetricBox}>
              <Text style={styles.cartMetricLabel}>IMPACTO AL CONTADO HOY</Text>
              <Text style={styles.cartMetricValue}>
                {formatCLP(cartSimulation.immediateCashOutflow)}
              </Text>
            </View>
            <View style={styles.cartMetricBox}>
              <Text style={styles.cartMetricLabel}>NUEVO CARGO MENSUAL</Text>
              <Text style={styles.cartMetricValue}>
                +{formatCLP(cartSimulation.additionalMonthlyOutflow)}/mes
              </Text>
            </View>
            <View style={styles.cartMetricBox}>
              <Text style={styles.cartMetricLabel}>FLUJO LIBRE RESULTANTE</Text>
              <Text
                style={[
                  styles.cartMetricValue,
                  {
                    color:
                      cartSimulation.projectedFreeCashFlow >= 0
                        ? '#34D399'
                        : '#F87171',
                  },
                ]}
              >
                {formatCLP(cartSimulation.projectedFreeCashFlow)}
              </Text>
            </View>
            <View style={styles.cartMetricBox}>
              <Text style={styles.cartMetricLabel}>SAFE-TO-SPEND DIARIO</Text>
              <Text
                style={[
                  styles.cartMetricValue,
                  {
                    color:
                      cartSimulation.projectedSafePerDay >= 8000
                        ? '#34D399'
                        : '#F59E0B',
                  },
                ]}
              >
                {formatCLP(cartSimulation.projectedSafePerDay)}/día
              </Text>
            </View>
            <View style={styles.cartMetricBox}>
              <Text style={styles.cartMetricLabel}>SCORE SALUD ESTIMADO</Text>
              <Text style={styles.cartMetricValue}>
                {cartSimulation.currentHealthScore} →{' '}
                {cartSimulation.projectedHealthScore}/100
              </Text>
            </View>
          </View>
        </GlassCard>
      ) : null}

      {/* FILTROS POR CATEGORÍA Y ESTADO */}
      <View style={styles.filtersBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          <Pressable
            onPress={() => setCategoryFilter('all')}
            style={[
              styles.filterPill,
              categoryFilter === 'all' && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                categoryFilter === 'all' && styles.filterPillTextActive,
              ]}
            >
              Todos ({statusView === 'active' ? activeItems.length : purchasedItems.length})
            </Text>
          </Pressable>

          {CATEGORIES_CATALOG.map((cat) => {
            const count = (
              statusView === 'active' ? activeItems : purchasedItems
            ).filter((i) => i.category === cat.key).length;
            if (count === 0 && categoryFilter !== cat.key) return null;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setCategoryFilter(cat.key)}
                style={[
                  styles.filterPill,
                  categoryFilter === cat.key && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    categoryFilter === cat.key && styles.filterPillTextActive,
                  ]}
                >
                  {cat.emoji} {cat.shortLabel} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.statusToggleGroup}>
          <Pressable
            onPress={() => setStatusView('active')}
            style={[
              styles.statusTabBtn,
              statusView === 'active' && styles.statusTabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.statusTabText,
                statusView === 'active' && styles.statusTabTextActive,
              ]}
            >
              En Evaluación ({activeItems.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStatusView('purchased')}
            style={[
              styles.statusTabBtn,
              statusView === 'purchased' && styles.statusTabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.statusTabText,
                statusView === 'purchased' && styles.statusTabTextActive,
              ]}
            >
              Comprados ({purchasedItems.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ESTADO VACÍO CON CARGADOR 1-CLIC DE EJEMPLOS */}
      {filteredItems.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Sparkles size={26} color="#34D399" />
          <Text style={styles.emptyTitle}>
            {statusView === 'active'
              ? 'Tu Simulador de Futuras Compras está listo'
              : 'Aún no has marcado deseos como comprados'}
          </Text>
          <Text style={styles.emptyDesc}>
            {statusView === 'active'
              ? 'Agrega ropa, tecnología, accesorios o nuevas suscripciones para evaluar al instante si puedes comprarlos hoy al contado, en cuotas sin interés o aprovechar el mes en que vencen tus créditos actuales.'
              : 'Cuando adquieras un ítem en evaluación y pulses "Lo Compré", se convertirá automáticamente en gasto real de tu mes o cuota de tarjeta.'}
          </Text>
          {statusView === 'active' ? (
            <View style={styles.emptyActionsRow}>
              <TeslaButton
                title="Cargar 3 Ejemplos de Simulación"
                variant="secondary"
                onPress={handleSeedSampleWishlist}
                loading={submitting}
              />
              <TeslaButton
                title="+ Registrar Mi Primera Compra"
                onPress={() => setShowForm(true)}
              />
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      {/* LISTA DE TARJETAS INTELIGENTES POR ÍTEM (FuturePurchaseCard) */}
      <View style={styles.cardsStack}>
        {filteredItems.map((item) => {
          const catMeta = getCategoryMeta(item.category);
          const prioMeta =
            PRIORITY_META[item.priority as FuturePurchasePriority] ||
            PRIORITY_META.medium;
          const override = cardSimOverrides[item.id];
          const effectiveMode = override?.mode ?? item.payment_mode;
          const effectiveInstallments =
            override?.installments ??
            (item.installments_count > 1 ? item.installments_count : 6);

          const evaluation = evaluateFuturePurchase(
            item,
            { period, accounts, recurringItems, variableExpenses, payments },
            effectiveInstallments,
            effectiveMode
          );

          const vTheme = getVerdictTheme(evaluation.verdict);
          const isSelectedInCart = selectedCartIds.has(item.id);
          const isPurchased = item.status === 'purchased';

          return (
            <GlassCard
              key={item.id}
              style={[
                styles.purchaseCard,
                isSelectedInCart && styles.purchaseCardSelected,
              ]}
            >
              {/* Fila Superior: Checkbox Carrito + Categoría + Prioridad + Semáforo */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopLeft}>
                  {!isPurchased ? (
                    <Pressable
                      onPress={() => handleToggleCartItem(item.id)}
                      style={styles.cartCheckBtn}
                      hitSlop={8}
                    >
                      {isSelectedInCart ? (
                        <CheckSquare size={18} color="#F59E0B" />
                      ) : (
                        <Square size={18} color={colors.textSecondary} />
                      )}
                    </Pressable>
                  ) : (
                    <CheckCircle2 size={18} color="#34D399" />
                  )}

                  <View
                    style={[
                      styles.categoryBadge,
                      { borderColor: `${catMeta.color}55` },
                    ]}
                  >
                    {renderCategoryIcon(item.category, 13, catMeta.color)}
                    <Text
                      style={[styles.categoryBadgeText, { color: catMeta.color }]}
                    >
                      {catMeta.label}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: prioMeta.bg,
                        borderColor: prioMeta.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.priorityBadgeText, { color: prioMeta.color }]}
                    >
                      {prioMeta.shortLabel}
                    </Text>
                  </View>
                </View>

                {/* Semáforo de Viabilidad */}
                <View
                  style={[
                    styles.verdictPill,
                    {
                      backgroundColor: vTheme.bg,
                      borderColor: vTheme.border,
                    },
                  ]}
                >
                  <Text style={[styles.verdictPillText, { color: vTheme.color }]}>
                    {vTheme.dot} {evaluation.verdictBadge}
                  </Text>
                </View>
              </View>

              {/* Título y Precio Principal */}
              <View style={styles.cardMainRow}>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.notes ? (
                    <Text style={styles.itemNotes}>{item.notes}</Text>
                  ) : null}
                </View>

                <View style={styles.cardPriceCol}>
                  <Text style={styles.itemPrice}>
                    {formatCLP(item.amount)}
                    {evaluation.antiImpulse.isSubscription ? '/mes' : ''}
                  </Text>
                  {effectiveMode === 'installments' &&
                  !evaluation.antiImpulse.isSubscription ? (
                    <Text style={styles.itemPriceSub}>
                      {effectiveInstallments} cuotas de{' '}
                      {formatCLP(evaluation.installmentsPath.monthlyInstallment)}/mes
                    </Text>
                  ) : evaluation.antiImpulse.isSubscription ? (
                    <Text style={styles.itemPriceSub}>
                      {formatCLP(evaluation.antiImpulse.annualizedSubscriptionCost)}
                      /año ·{' '}
                      {formatCLP(evaluation.antiImpulse.threeYearSubscriptionCost)} en
                      3 años
                    </Text>
                  ) : (
                    <Text style={styles.itemPriceSub}>Pago único al contado</Text>
                  )}
                </View>
              </View>

              {/* Dictamen Explicativo del Motor */}
              <View
                style={[
                  styles.verdictExplanationBox,
                  {
                    borderColor: vTheme.border,
                    backgroundColor: vTheme.bg,
                  },
                ]}
              >
                <Text
                  style={[styles.verdictHeadlineText, { color: vTheme.color }]}
                >
                  {evaluation.verdictHeadline}
                </Text>
                <Text style={styles.verdictExplanationText}>
                  {evaluation.verdictExplanation}
                </Text>
              </View>

              {/* Selector Interactivo Rápido en la Tarjeta: Contado vs 3 / 6 / 12 Cuotas */}
              {!isPurchased && !evaluation.antiImpulse.isSubscription ? (
                <View style={styles.inlineSimulatorBar}>
                  <Text style={styles.inlineSimLabel}>SIMULAR MODALIDAD:</Text>
                  <View style={styles.inlineSimPills}>
                    <Pressable
                      onPress={() =>
                        setCardSimOverrides((prev) => ({
                          ...prev,
                          [item.id]: {
                            mode: 'one_time_cash',
                            installments: effectiveInstallments,
                          },
                        }))
                      }
                      style={[
                        styles.simModePill,
                        effectiveMode === 'one_time_cash' &&
                          styles.simModePillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.simModePillText,
                          effectiveMode === 'one_time_cash' &&
                            styles.simModePillTextActive,
                        ]}
                      >
                        Contado
                      </Text>
                    </Pressable>

                    {INSTALLMENT_QUICK_OPTIONS.map((n) => {
                      const isThisQuota =
                        effectiveMode === 'installments' &&
                        effectiveInstallments === n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() =>
                            setCardSimOverrides((prev) => ({
                              ...prev,
                              [item.id]: {
                                mode: 'installments',
                                installments: n,
                              },
                            }))
                          }
                          style={[
                            styles.simModePill,
                            isThisQuota && styles.simModePillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.simModePillText,
                              isThisQuota && styles.simModePillTextActive,
                            ]}
                          >
                            {n} Cuotas
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Cruce con Liberación de Deudas Mes a Mes (Smart Debt-Release Matching) */}
              {evaluation.debtReleaseMatch.hasUpcomingRelease &&
              evaluation.debtReleaseMatch.recommendationText ? (
                <View style={styles.debtReleaseBanner}>
                  <View style={styles.debtReleaseHeader}>
                    <Sparkles size={14} color="#38BDF8" />
                    <Text style={styles.debtReleaseTitle}>
                      VENTANA ÓPTIMA DETECTADA ·{' '}
                      {evaluation.debtReleaseMatch.optimalPurchaseLabel?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.debtReleaseText}>
                    {evaluation.debtReleaseMatch.recommendationText}
                  </Text>
                </View>
              ) : null}

              {/* Comparador Inteligente de 3 Caminos: Contado vs Cuotas vs Ahorro Previo */}
              {!evaluation.antiImpulse.isSubscription ? (
                <View
                  style={[
                    styles.pathsComparatorGrid,
                    isDesktop && styles.pathsComparatorGridDesktop,
                  ]}
                >
                  {/* Camino A: Al Contado Hoy */}
                  <View style={styles.pathBox}>
                    <View style={styles.pathHeader}>
                      <Wallet size={13} color="#34D399" />
                      <Text style={styles.pathTitle}>CAMINO A · CONTADO HOY</Text>
                    </View>
                    <Text style={styles.pathMainMetric}>
                      {formatCLP(evaluation.cashPath.resultingSafePerDay)}/día
                    </Text>
                    <Text style={styles.pathSubDesc}>
                      Nuevo Safe-to-Spend diario por los{' '}
                      {evaluation.cashPath.remainingDaysInMonth} días restantes del
                      mes.
                    </Text>
                  </View>

                  {/* Camino B: Tarjeta en N Cuotas */}
                  <View style={styles.pathBox}>
                    <View style={styles.pathHeader}>
                      <CreditCard size={13} color="#38BDF8" />
                      <Text style={styles.pathTitle}>
                        CAMINO B · {evaluation.installmentsPath.installmentsCount}{' '}
                        CUOTAS (0%)
                      </Text>
                    </View>
                    <Text style={styles.pathMainMetric}>
                      {formatCLP(evaluation.installmentsPath.monthlyInstallment)}/mes
                    </Text>
                    <Text style={styles.pathSubDesc}>
                      {evaluation.installmentsPath.cardName} queda en{' '}
                      {evaluation.installmentsPath.resultingUsagePercent}% de cupo.{' '}
                      {evaluation.installmentsPath.billingAdvice}
                    </Text>
                  </View>

                  {/* Camino C: Meta de Ahorro Previo */}
                  <View style={styles.pathBox}>
                    <View style={styles.pathHeader}>
                      <PiggyBank size={13} color="#A855F7" />
                      <Text style={styles.pathTitle}>
                        CAMINO C · AHORRO PREVIO
                      </Text>
                    </View>
                    <Text style={styles.pathMainMetric}>
                      {evaluation.savingsGoalPath.monthsRequired}{' '}
                      {evaluation.savingsGoalPath.monthsRequired === 1
                        ? 'mes'
                        : 'meses'}{' '}
                      ({evaluation.savingsGoalPath.estimatedReadyLabel})
                    </Text>
                    <Text style={styles.pathSubDesc}>
                      Apartando {formatCLP(evaluation.savingsGoalPath.monthlySavingQuota)}
                      /mes (10% de tu superávit) sin tocar tu liquidez operativa.
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Indicadores Anti-Impulso: Horas de Trabajo y Costo de Oportunidad */}
              <View style={styles.antiImpulseBar}>
                <View style={styles.antiImpulseChip}>
                  <Briefcase size={12} color={colors.textSecondary} />
                  <Text style={styles.antiImpulseText}>
                    Esfuerzo laboral:{' '}
                    <Text style={styles.antiImpulseStrong}>
                      {evaluation.antiImpulse.workHoursRequired} hrs de tu trabajo
                    </Text>{' '}
                    (~{evaluation.antiImpulse.workDaysRequired} días laborales)
                  </Text>
                </View>

                <View style={styles.antiImpulseChip}>
                  <TrendingUp size={12} color="#34D399" />
                  <Text style={styles.antiImpulseText}>
                    Costo oportunidad (1 año en{' '}
                    {evaluation.antiImpulse.bestSavingsAccountName} al{' '}
                    {evaluation.antiImpulse.bestAnnualRatePercent}%):{' '}
                    <Text style={styles.antiImpulseStrongEmerald}>
                      {formatCLP(evaluation.antiImpulse.opportunityCost1YearTotal)}
                    </Text>{' '}
                    (+{formatCLP(evaluation.antiImpulse.opportunityCost1YearInterest)}{' '}
                    interés)
                  </Text>
                </View>
              </View>

              {/* Acciones Inferiores: Conversión en 1 Toque ("Lo Compré"), Editar, Eliminar */}
              <View style={styles.cardFooterRow}>
                {!isPurchased ? (
                  <Pressable
                    onPress={() =>
                      handleMarkAsPurchased(
                        item,
                        effectiveMode,
                        effectiveInstallments
                      )
                    }
                    disabled={convertingId === item.id}
                    style={({ pressed }) => [
                      styles.markPurchasedBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <CheckCircle2 size={15} color="#050505" />
                    <Text style={styles.markPurchasedBtnText}>
                      {convertingId === item.id
                        ? 'Registrando...'
                        : effectiveMode === 'installments'
                        ? `Lo Compré (${effectiveInstallments} Cuotas)`
                        : effectiveMode === 'recurring_subscription'
                        ? 'Ya me Suscribí · Agregar a Fijos'
                        : 'Lo Compré al Contado · Registrar Gasto'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.purchasedDoneBadge}>
                    <CheckCircle2 size={14} color="#34D399" />
                    <Text style={styles.purchasedDoneText}>
                      Adquirido e integrado en tus finanzas
                    </Text>
                  </View>
                )}

                <View style={styles.cardIconActions}>
                  <Pressable
                    onPress={() => handleStartEdit(item)}
                    style={styles.iconBtn}
                    hitSlop={8}
                  >
                    <Edit3 size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteFuturePurchase(item.id)}
                    style={styles.iconBtn}
                    hitSlop={8}
                  >
                    <Trash2 size={15} color="#F87171" />
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionStack: {
    gap: 16,
  },
  kpiGrid: {
    gap: 12,
  },
  kpiGridDesktop: {
    flexDirection: 'row',
  },
  kpiCard: {
    flex: 1,
    gap: 6,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiIconBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  kpiIconEmerald: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  kpiIconBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  kpiIconAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  kpiEyebrow: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  kpiMainValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiSubText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  catalogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  catalogTitleCol: {
    gap: 2,
    flexShrink: 1,
  },
  sectionEyebrow: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  catalogHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  primaryActionPillText: {
    color: colors.buttonPrimaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryActionPillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickTemplatesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  quickTemplateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  quickTemplateEmoji: {
    fontSize: 13,
  },
  quickTemplateText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 14,
  },
  formHeading: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  formGrid: {
    gap: 12,
  },
  formGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formFieldFlex2: {
    flex: 2,
  },
  formFieldFlex1: {
    flex: 1,
  },
  selectorGroup: {
    gap: 6,
  },
  selectorLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  optionChipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  optionChipText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  formFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  cartBannerCard: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    gap: 12,
  },
  cartBannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cartBannerTitleCol: {
    gap: 2,
  },
  cartBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartEyebrow: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  cartHeadline: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  clearCartBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  clearCartBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  cartMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cartMetricBox: {
    flex: 1,
    minWidth: 135,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    gap: 3,
  },
  cartMetricLabel: {
    color: colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cartMetricValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  filtersBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  filterPillActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  statusToggleGroup: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  statusTabBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusTabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statusTabText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  statusTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 540,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  cardsStack: {
    gap: 14,
  },
  purchaseCard: {
    gap: 12,
  },
  purchaseCardSelected: {
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cartCheckBtn: {
    padding: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  verdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  verdictPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 200,
    gap: 3,
  },
  itemTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  itemNotes: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  cardPriceCol: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  itemPriceSub: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  verdictExplanationBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
  },
  verdictHeadlineText: {
    fontSize: 13,
    fontWeight: '700',
  },
  verdictExplanationText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineSimulatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  inlineSimLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  inlineSimPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  simModePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  simModePillActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  simModePillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  simModePillTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  debtReleaseBanner: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: 'rgba(56, 189, 248, 0.07)',
    gap: 4,
  },
  debtReleaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  debtReleaseTitle: {
    color: '#38BDF8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  debtReleaseText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  pathsComparatorGrid: {
    gap: 8,
  },
  pathsComparatorGridDesktop: {
    flexDirection: 'row',
  },
  pathBox: {
    flex: 1,
    padding: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    gap: 4,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pathTitle: {
    color: colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pathMainMetric: {
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pathSubDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  antiImpulseBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  antiImpulseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  antiImpulseText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  antiImpulseStrong: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  antiImpulseStrongEmerald: {
    color: '#34D399',
    fontWeight: '700',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  markPurchasedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: '#34D399',
  },
  markPurchasedBtnText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '700',
  },
  purchasedDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  purchasedDoneText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  cardIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  pressed: {
    opacity: 0.82,
  },
});
