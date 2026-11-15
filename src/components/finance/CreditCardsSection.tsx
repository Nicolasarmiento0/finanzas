import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  AlertCircle,
  ArrowUp,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  CreditCard,
  Flame,
  HandCoins,
  Layers,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  Tag,
  Trash2,
  Utensils,
  Wallet,
  X,
} from 'lucide-react-native';
import {
  CARD_DESIGN_OPTIONS,
  CreditCardVisual,
  resolveCardBrand,
} from '@/components/finance/CreditCardVisual';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  AccordionToggle,
  triggerAccordionAnimation,
} from '@/components/ui/AccordionToggle';
import {
  FintechAddIcon,
  FintechAnalyticsIcon,
} from '@/components/ui/AmbientHeroCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Account,
  AccountType,
  CardBrand,
  CreateAccountInput,
  CreateRecurringItemInput,
  MonthlyPayment,
  RecurringItem,
  UpdateAccountInput,
  UpdateRecurringItemInput,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { usePrivacy } from '@/context/PrivacyContext';
import {
  calculateCreditCardMetrics,
  formatPeriodFull,
  formatPeriodShort,
  getCategoryColor,
  getCategoryLabel,
  getInstallmentProgress,
  getInstallmentSchedule,
  isItemActiveInMonth,
  SHARED_EXPENSE_CATEGORIES,
  SHARED_EXPENSE_CATEGORY_IDS,
  SharedExpenseCategoryIcon,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

const SUGGESTED_NAMES = new Set([
  '',
  'Tarjeta Santander',
  'CMR Falabella',
  'Tarjeta de Crédito',
]);

const INSTALLMENT_COUNT_PRESETS = [1, 3, 6, 12, 18, 24];

const RECURRING_DURATION_PRESETS = [
  { label: 'Permanente', months: 0 },
  { label: '3 Meses', months: 3 },
  { label: '6 Meses', months: 6 },
  { label: '12 Meses', months: 12 },
];

function renderSharedCategoryIcon(
  iconName: SharedExpenseCategoryIcon,
  size: number,
  color: string
) {
  switch (iconName) {
    case 'Utensils':
      return <Utensils size={size} color={color} />;
    case 'Coffee':
      return <Coffee size={size} color={color} />;
    case 'Tag':
      return <Tag size={size} color={color} />;
    case 'Sparkles':
      return <Sparkles size={size} color={color} />;
    case 'HandCoins':
      return <HandCoins size={size} color={color} />;
    case 'Receipt':
    default:
      return <Receipt size={size} color={color} />;
  }
}

function getWalletStripPalette(brand: CardBrand, index: number): {
  gradStart: string;
  gradMid: string;
  gradEnd: string;
  borderGlow: string;
  tagLabel: string;
} {
  if (brand === 'falabella') {
    return {
      gradStart: '#16A34A',
      gradMid: '#059669',
      gradEnd: '#065F46',
      borderGlow: 'rgba(74, 222, 128, 0.45)',
      tagLabel: 'CMR Falabella',
    };
  }
  if (brand === 'santander') {
    return {
      gradStart: '#2563EB',
      gradMid: '#1D4ED8',
      gradEnd: '#1E3A8A',
      borderGlow: 'rgba(96, 165, 250, 0.5)',
      tagLabel: 'Santander',
    };
  }
  const fallbackPalettes = [
    {
      gradStart: '#4F46E5',
      gradMid: '#3730A3',
      gradEnd: '#1E1B4B',
      borderGlow: 'rgba(129, 140, 248, 0.45)',
      tagLabel: 'Titanium',
    },
    {
      gradStart: '#0D9488',
      gradMid: '#0F766E',
      gradEnd: '#134E4A',
      borderGlow: 'rgba(45, 212, 191, 0.45)',
      tagLabel: 'Crédito',
    },
  ];
  return fallbackPalettes[index % fallbackPalettes.length];
}

interface CreditCardsSectionProps {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
  payments?: MonthlyPayment[];
  onToggleCardPaid?: (cardId: string) => Promise<void>;
  onScrollToEdit?: () => void;
  onCreateAccount: (input: CreateAccountInput) => Promise<void>;
  onUpdateAccount?: (id: string, input: UpdateAccountInput) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateRecurringItem: (input: CreateRecurringItemInput) => Promise<void>;
  onUpdateRecurringItem?: (id: string, input: UpdateRecurringItemInput) => Promise<void>;
  onDeleteRecurringItem?: (id: string) => Promise<void>;
  onAddSubItem: (
    recurringItemId: string,
    input: { name: string; amount: number }
  ) => Promise<void>;
  onRemoveSubItem: (recurringItemId: string, subItemId: string) => Promise<void>;
}

export function CreditCardsSection({
  period,
  accounts,
  recurringItems,
  payments,
  onToggleCardPaid,
  onScrollToEdit,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateRecurringItem,
  onUpdateRecurringItem,
  onDeleteRecurringItem,
  onAddSubItem,
  onRemoveSubItem,
}: CreditCardsSectionProps) {
  const { isDesktop } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();

  // Referencias y animación para desplazamiento al módulo de edición
  const editFormRef = useRef<View>(null);
  const detailSectionRef = useRef<View>(null);
  const editHighlightAnim = useRef(new Animated.Value(0)).current;
  const walletPullAnim = useRef(new Animated.Value(1)).current;

  const scrollToEditForm = useCallback(() => {
    onScrollToEdit?.();
    setTimeout(() => {
      if (Platform.OS === 'web') {
        const el = editFormRef.current as unknown as HTMLElement | null;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 80);
  }, [onScrollToEdit]);

  // Estado para Crear o Editar Tarjeta / Cuenta
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('credit_card');
  const [selectedBrand, setSelectedBrand] = useState<CardBrand>('santander');
  const [cardName, setCardName] = useState('Tarjeta Santander');
  const [creditLimit, setCreditLimit] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [billingDay, setBillingDay] = useState('25');
  const [submittingCard, setSubmittingCard] = useState(false);

  // Estado para agregar un sub-ítem anidado a un gasto matriz
  const [activeParentForSub, setActiveParentForSub] = useState<string | null>(
    null
  );
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [submittingSub, setSubmittingSub] = useState(false);

  // Estado para agregar un paquete/gasto matriz directamente a una tarjeta (compra en cuotas o cargo recurrente)
  const [activeCardForNewGroup, setActiveCardForNewGroup] = useState<
    string | null
  >(null);
  const [groupChargeMode, setGroupChargeMode] = useState<'installments' | 'recurring'>(
    'installments'
  );
  const [groupAmountInputMode, setGroupAmountInputMode] = useState<'total' | 'quota'>(
    'total'
  );
  const [groupTitle, setGroupTitle] = useState('');
  const [groupAmount, setGroupAmount] = useState('');
  const [groupCategory, setGroupCategory] = useState('general');
  const [groupStartDate, setGroupStartDate] = useState(period);
  const [groupEndDate, setGroupEndDate] = useState(() => shiftPeriod(period, 2));
  const [groupInstallments, setGroupInstallments] = useState<number>(3);
  const [groupCustomInstallments, setGroupCustomInstallments] = useState('3');
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupErrorMsg, setGroupErrorMsg] = useState<string | null>(null);

  // Estado de tarjeta activa en el Tarjetero 3D (Wallet Pocket)
  const [selectedWalletCardId, setSelectedWalletCardId] = useState<string | null>(
    null
  );
  const [showAllCardsExpanded, setShowAllCardsExpanded] = useState(false);
  const [expandedCardCharges, setExpandedCardCharges] = useState<
    Record<string, boolean>
  >({});

  const toggleCardChargesAccordion = (cardId: string) => {
    triggerAccordionAnimation();
    setExpandedCardCharges((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === 'credit_card'),
    [accounts]
  );
  const otherAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit_card' && a.type !== 'loan'),
    [accounts]
  );

  useEffect(() => {
    if (creditCards.length === 0) {
      setSelectedWalletCardId(null);
      return;
    }
    if (
      !selectedWalletCardId ||
      !creditCards.some((c) => c.id === selectedWalletCardId)
    ) {
      setSelectedWalletCardId(creditCards[0].id);
    }
  }, [creditCards, selectedWalletCardId]);

  const handleSelectWalletCard = (cardId: string) => {
    setSelectedWalletCardId(cardId);
    setShowAllCardsExpanded(false);
    walletPullAnim.setValue(0.94);
    Animated.spring(walletPullAnim, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  // Métricas consolidadas y por plástico para el Hero y el Tarjetero 3D
  const cardsWithMetrics = useMemo(() => {
    return creditCards.map((card, idx) => {
      const brand = resolveCardBrand(card);
      const brandMeta =
        CARD_DESIGN_OPTIONS.find((o) => o.id === brand) ||
        CARD_DESIGN_OPTIONS[2];
      const allCardExpenses = recurringItems.filter(
        (item) => item.account_id === card.id && item.type === 'expense'
      );
      const cardItems = allCardExpenses.filter((item) =>
        isItemActiveInMonth(item, period)
      );
      const metrics = calculateCreditCardMetrics(
        card,
        allCardExpenses,
        period,
        payments
      );
      const palette = getWalletStripPalette(brand, idx);
      return {
        card,
        brand,
        brandMeta,
        cardItems,
        metrics,
        palette,
      };
    });
  }, [creditCards, recurringItems, period, payments]);

  const activeCardEntry = useMemo(() => {
    if (cardsWithMetrics.length === 0) return null;
    return (
      cardsWithMetrics.find((c) => c.card.id === selectedWalletCardId) ||
      cardsWithMetrics[0]
    );
  }, [cardsWithMetrics, selectedWalletCardId]);

  const portfolioStats = useMemo(() => {
    const totalLimit = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.creditLimit,
      0
    );
    const totalUsed = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.usedAmount,
      0
    );
    const totalAvailable = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.availableCredit,
      0
    );
    const totalRecurring = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.recurringCharges,
      0
    );
    const totalMonthlyBilled = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.monthlyBilledTotal,
      0
    );
    const totalPendingBilled = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.pendingBilledTotal,
      0
    );
    const totalInstallmentCommitted = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.installmentCommittedTotal,
      0
    );
    const totalRecoveredCredit = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.recoveredCredit,
      0
    );
    const totalBase = cardsWithMetrics.reduce(
      (acc, c) => acc + c.metrics.effectiveBaseBalance,
      0
    );
    const usagePercent =
      totalLimit > 0
        ? Math.min(100, Math.round((totalUsed / totalLimit) * 100))
        : 0;
    const freePercent = Math.max(0, 100 - usagePercent);
    const urgentAlertsCount = cardsWithMetrics.filter(
      (c) => c.metrics.billingAlert.isUrgent && c.metrics.usedAmount > 0
    ).length;

    // Próximo corte más cercano entre las tarjetas
    const sortedByCut = [...cardsWithMetrics].sort(
      (a, b) =>
        (a.metrics.billingAlert.daysRemaining ?? 999) -
        (b.metrics.billingAlert.daysRemaining ?? 999)
    );
    const nextCutEntry = sortedByCut[0] || null;

    return {
      totalLimit,
      totalUsed,
      totalAvailable,
      totalRecurring,
      totalMonthlyBilled,
      totalPendingBilled,
      totalInstallmentCommitted,
      totalRecoveredCredit,
      totalBase,
      usagePercent,
      freePercent,
      urgentAlertsCount,
      nextCutEntry,
    };
  }, [cardsWithMetrics]);

  // Ordenar las tarjetas en el bolsillo 3D para que la tarjeta seleccionada quede justo al frente (abajo en el stack)
  const orderedWalletStack = useMemo(() => {
    if (cardsWithMetrics.length <= 1) return cardsWithMetrics;
    const unselected = cardsWithMetrics.filter(
      (entry) => entry.card.id !== activeCardEntry?.card.id
    );
    return activeCardEntry ? [...unselected, activeCardEntry] : cardsWithMetrics;
  }, [cardsWithMetrics, activeCardEntry]);

  const displayedDetailCards = useMemo(() => {
    if (showAllCardsExpanded || !activeCardEntry) {
      return cardsWithMetrics;
    }
    return [activeCardEntry];
  }, [showAllCardsExpanded, activeCardEntry, cardsWithMetrics]);

  const computeInstallmentPreview = (
    rawAmountStr: string,
    installmentsCount: number,
    inputMode: 'total' | 'quota',
    startDate: string
  ) => {
    const count = Math.max(1, Math.round(installmentsCount || 1));
    const parsed = Math.max(
      0,
      Math.round(Number(rawAmountStr.replace(/\D/g, '') || 0))
    );
    const startPeriod = startDate.trim() || period;
    const endPeriod =
      count === 1 ? startPeriod : shiftPeriod(startPeriod, count - 1);
    if (inputMode === 'quota') {
      return {
        count,
        monthlyQuota: parsed,
        totalPurchase: parsed * count,
        startPeriod,
        endPeriod,
      };
    }
    const monthlyQuota = parsed > 0 ? Math.round(parsed / count) : 0;
    return {
      count,
      monthlyQuota,
      totalPurchase: parsed,
      startPeriod,
      endPeriod,
    };
  };

  const groupInstallmentPreview = computeInstallmentPreview(
    groupAmount,
    groupInstallments,
    groupAmountInputMode,
    groupStartDate
  );

  const handleSelectInstallmentCount = (count: number) => {
    const safeCount = Math.max(1, Math.min(60, Math.round(count || 1)));
    setGroupInstallments(safeCount);
    setGroupCustomInstallments(String(safeCount));
    const base = groupStartDate.trim() || period;
    setGroupEndDate(safeCount === 1 ? base : shiftPeriod(base, safeCount - 1));
  };

  const handleSelectRecurringPreset = (months: number) => {
    setGroupInstallments(months);
    const base = groupStartDate.trim() || period;
    if (months === 0) {
      setGroupEndDate('');
    } else if (months === 1) {
      setGroupEndDate(base);
    } else {
      setGroupEndDate(shiftPeriod(base, months - 1));
    }
  };

  const toggleNewGroupForCard = (cardId: string) => {
    if (activeCardForNewGroup === cardId) {
      setActiveCardForNewGroup(null);
    } else {
      triggerAccordionAnimation();
      setExpandedCardCharges((prev) => ({ ...prev, [cardId]: true }));
      setSelectedWalletCardId(cardId);
      setActiveCardForNewGroup(cardId);
      setGroupChargeMode('installments');
      setGroupAmountInputMode('total');
      setGroupTitle('');
      setGroupAmount('');
      setGroupCategory('general');
      setGroupStartDate(period);
      setGroupInstallments(3);
      setGroupCustomInstallments('3');
      setGroupEndDate(shiftPeriod(period, 2));
      setGroupErrorMsg(null);
    }
  };

  // Estado para editar un cargo en tarjeta
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [editChargeMode, setEditChargeMode] = useState<'installments' | 'recurring'>(
    'recurring'
  );
  const [editAmountInputMode, setEditAmountInputMode] = useState<'total' | 'quota'>(
    'total'
  );
  const [editChargeTitle, setEditChargeTitle] = useState('');
  const [editChargeAmount, setEditChargeAmount] = useState('');
  const [editChargeCategory, setEditChargeCategory] = useState('general');
  const [editChargeStartDate, setEditChargeStartDate] = useState(period);
  const [editChargeEndDate, setEditChargeEndDate] = useState('');
  const [editChargeInstallments, setEditChargeInstallments] = useState<number>(3);
  const [editChargeCustomInstallments, setEditChargeCustomInstallments] =
    useState('3');
  const [savingEditCharge, setSavingEditCharge] = useState(false);
  const [editChargeError, setEditChargeError] = useState<string | null>(null);

  const editInstallmentPreview = computeInstallmentPreview(
    editChargeAmount,
    editChargeInstallments,
    editAmountInputMode,
    editChargeStartDate
  );

  const openEditCharge = (item: RecurringItem) => {
    triggerAccordionAnimation();
    setExpandedCardCharges((prev) => ({ ...prev, [item.account_id]: true }));
    setEditingChargeId(item.id);
    setEditChargeTitle(item.title);
    setEditChargeCategory(item.category || 'general');
    setEditChargeStartDate(item.start_date || period);
    setEditChargeEndDate(item.end_date || '');

    const schedule = getInstallmentSchedule(item, { isCreditCard: true });

    if (schedule) {
      const count = schedule.totalInstallments;
      const total = schedule.totalPurchaseAmount;
      setEditChargeMode('installments');
      setEditAmountInputMode('total');
      setEditChargeAmount(String(total));
      setEditChargeInstallments(count);
      setEditChargeCustomInstallments(String(count));
      setEditChargeEndDate(schedule.endPeriod);
    } else {
      setEditChargeMode('recurring');
      setEditAmountInputMode('quota');
      setEditChargeAmount(String(item.amount));
      setEditChargeInstallments(0);
      setEditChargeCustomInstallments('3');
    }
    setEditChargeError(null);
  };

  const closeEditCharge = () => {
    setEditingChargeId(null);
    setEditChargeTitle('');
    setEditChargeAmount('');
    setEditChargeError(null);
  };

  const handleSelectEditInstallmentCount = (count: number) => {
    const safeCount = Math.max(1, Math.min(60, Math.round(count || 1)));
    setEditChargeInstallments(safeCount);
    setEditChargeCustomInstallments(String(safeCount));
    const base = editChargeStartDate.trim() || period;
    setEditChargeEndDate(
      safeCount === 1 ? base : shiftPeriod(base, safeCount - 1)
    );
  };

  const handleSelectEditRecurringPreset = (months: number) => {
    setEditChargeInstallments(months);
    const base = editChargeStartDate.trim() || period;
    if (months === 0) {
      setEditChargeEndDate('');
    } else if (months === 1) {
      setEditChargeEndDate(base);
    } else {
      setEditChargeEndDate(shiftPeriod(base, months - 1));
    }
  };

  const handleSaveEditCharge = async () => {
    if (!editingChargeId) return;
    setEditChargeError(null);
    const titleClean = editChargeTitle.trim();
    if (!titleClean) {
      setEditChargeError('El nombre del cargo es obligatorio');
      return;
    }

    const startClean = editChargeStartDate.trim() || period;
    let payloadAmount = Math.round(Number(editChargeAmount.replace(/\D/g, '') || 0));
    let payloadEndDate: string | null = editChargeEndDate.trim()
      ? editChargeEndDate.trim()
      : null;
    let payloadInstallments: number | null = null;
    let payloadTotalPurchase: number | null = null;

    if (editChargeMode === 'installments') {
      const preview = computeInstallmentPreview(
        editChargeAmount,
        editChargeInstallments,
        editAmountInputMode,
        startClean
      );
      if (preview.totalPurchase <= 0 || preview.monthlyQuota <= 0) {
        setEditChargeError('Ingresa el monto de la compra en cuotas');
        return;
      }
      payloadAmount = preview.monthlyQuota;
      payloadEndDate = preview.endPeriod;
      payloadInstallments = preview.count;
      payloadTotalPurchase = preview.totalPurchase;
    }

    setSavingEditCharge(true);
    try {
      if (onUpdateRecurringItem) {
        await onUpdateRecurringItem(editingChargeId, {
          title: titleClean,
          amount: payloadAmount,
          category: editChargeCategory,
          start_date: startClean,
          end_date: payloadEndDate,
          installments_count: payloadInstallments,
          total_purchase_amount: payloadTotalPurchase,
        });
      }
      closeEditCharge();
    } catch (err) {
      setEditChargeError(
        err instanceof Error ? err.message : 'Error al actualizar el cargo'
      );
    } finally {
      setSavingEditCharge(false);
    }
  };

  const handleSelectBrand = (brand: CardBrand) => {
    setSelectedBrand(brand);
    const option = CARD_DESIGN_OPTIONS.find((o) => o.id === brand);
    if (option && SUGGESTED_NAMES.has(cardName.trim())) {
      setCardName(option.suggestedName);
    }
  };

  const openCreateModal = () => {
    setEditingCardId(null);
    setAccountType('credit_card');
    setSelectedBrand('santander');
    setCardName('Tarjeta Santander');
    setCreditLimit('');
    setCurrentBalance('');
    setBillingDay('25');
    setShowNewCardModal(true);
  };

  const openEditCardModal = (card: Account) => {
    setEditingCardId(card.id);
    setAccountType(card.type);
    setSelectedBrand(resolveCardBrand(card));
    setCardName(card.name);
    setCreditLimit(String(card.credit_limit || 0));
    setCurrentBalance(String(card.current_balance || 0));
    setBillingDay(card.billing_day ? String(card.billing_day) : '25');
    setShowNewCardModal(true);

    // Animación de pulso visual sobre el formulario
    editHighlightAnim.setValue(0);
    Animated.sequence([
      Animated.timing(editHighlightAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: false,
      }),
      Animated.timing(editHighlightAnim, {
        toValue: 0.35,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(editHighlightAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(editHighlightAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start();

    // Desplazamiento animado suave hacia el módulo
    scrollToEditForm();
  };

  const handleSaveCard = async () => {
    if (!cardName.trim()) return;
    setSubmittingCard(true);
    try {
      const limitNum = parseInt(creditLimit.replace(/\D/g, ''), 10) || 0;
      const balanceNum = parseInt(currentBalance.replace(/\D/g, ''), 10) || 0;
      const dayNum = parseInt(billingDay.replace(/\D/g, ''), 10) || null;

      const payload: CreateAccountInput = {
        name: cardName.trim(),
        type: accountType,
        credit_limit: limitNum,
        current_balance: balanceNum,
        billing_day: accountType === 'credit_card' ? dayNum : null,
        card_brand: accountType === 'credit_card' ? selectedBrand : null,
      };

      if (editingCardId && onUpdateAccount) {
        await onUpdateAccount(editingCardId, payload);
      } else {
        await onCreateAccount(payload);
      }

      setCardName('');
      setCreditLimit('');
      setCurrentBalance('');
      setEditingCardId(null);
      setShowNewCardModal(false);
    } finally {
      setSubmittingCard(false);
    }
  };

  const handleAddSub = async (recurringItemId: string) => {
    if (!subName.trim()) return;
    const amountNum = parseInt(subAmount.replace(/\D/g, ''), 10) || 0;
    if (amountNum <= 0) return;

    setSubmittingSub(true);
    try {
      await onAddSubItem(recurringItemId, {
        name: subName.trim(),
        amount: amountNum,
      });
      setSubName('');
      setSubAmount('');
      setActiveParentForSub(null);
    } finally {
      setSubmittingSub(false);
    }
  };

  const handleCreateGroupOnCard = async (cardId: string) => {
    if (!groupTitle.trim()) {
      setGroupErrorMsg('Ingresa una glosa o título para el cargo.');
      return;
    }

    const startClean = groupStartDate.trim() || period;
    let payloadAmount = parseInt(groupAmount.replace(/\D/g, ''), 10) || 0;
    let payloadEndDate: string | null = groupEndDate.trim()
      ? groupEndDate.trim()
      : null;
    let payloadInstallments: number | null = null;
    let payloadTotalPurchase: number | null = null;

    if (groupChargeMode === 'installments') {
      const preview = computeInstallmentPreview(
        groupAmount,
        groupInstallments,
        groupAmountInputMode,
        startClean
      );
      if (preview.totalPurchase <= 0 || preview.monthlyQuota <= 0) {
        setGroupErrorMsg('Ingresa el monto de la compra en cuotas.');
        return;
      }
      payloadAmount = preview.monthlyQuota;
      payloadEndDate = preview.endPeriod;
      payloadInstallments = preview.count;
      payloadTotalPurchase = preview.totalPurchase;
    }

    setSubmittingGroup(true);
    setGroupErrorMsg(null);
    try {
      await onCreateRecurringItem({
        account_id: cardId,
        title: groupTitle.trim(),
        amount: payloadAmount,
        type: 'expense',
        category: groupCategory.trim() || 'general',
        start_date: startClean,
        end_date: payloadEndDate,
        installments_count: payloadInstallments,
        total_purchase_amount: payloadTotalPurchase,
        is_active: true,
      });
      setGroupTitle('');
      setGroupAmount('');
      setGroupCategory('general');
      setGroupStartDate(period);
      setGroupInstallments(3);
      setGroupCustomInstallments('3');
      setGroupEndDate(shiftPeriod(period, 2));
      setActiveCardForNewGroup(null);
    } catch (err: any) {
      setGroupErrorMsg(err?.message || 'Error al guardar el cargo en la tarjeta');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const renderCategorySelector = (
    selectedCat: string,
    onSelect: (catId: string) => void
  ) => {
    const cleanSelected = (selectedCat || 'general').toLowerCase().trim();
    const isLegacyCategory =
      Boolean(cleanSelected) && !SHARED_EXPENSE_CATEGORY_IDS.has(cleanSelected);

    return (
      <View style={styles.chipsWrap}>
        {SHARED_EXPENSE_CATEGORIES.map((cat) => {
          const selected = cleanSelected === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onSelect(cat.id)}
              style={[
                styles.chip,
                selected && {
                  borderColor: cat.color,
                  backgroundColor: `${cat.color}24`,
                },
              ]}
            >
              {renderSharedCategoryIcon(
                cat.iconName,
                12,
                selected ? cat.color : colors.textSecondary
              )}
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

        {isLegacyCategory ? (
          <View
            style={[
              styles.chip,
              {
                borderColor: getCategoryColor(cleanSelected),
                backgroundColor: `${getCategoryColor(cleanSelected)}20`,
              },
            ]}
          >
            <View
              style={[
                styles.categoryChipDot,
                { backgroundColor: getCategoryColor(cleanSelected) },
              ]}
            />
            <Text
              style={[
                styles.chipText,
                { color: getCategoryColor(cleanSelected), fontWeight: '700' },
              ]}
            >
              Actual: {getCategoryLabel(cleanSelected)}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderChargeScheduleForm = (cfg: {
    chargeMode: 'installments' | 'recurring';
    onChangeChargeMode: (mode: 'installments' | 'recurring') => void;
    amountInputMode: 'total' | 'quota';
    onChangeAmountInputMode: (mode: 'total' | 'quota') => void;
    title: string;
    onChangeTitle: (val: string) => void;
    titleLabel: string;
    titlePlaceholder: string;
    amount: string;
    onChangeAmount: (val: string) => void;
    recurringAmountLabel: string;
    category: string;
    onChangeCategory: (catId: string) => void;
    installmentsCount: number;
    onChangeInstallmentsCount: (count: number) => void;
    customInstallments: string;
    onChangeCustomInstallments: (val: string) => void;
    startDate: string;
    onChangeStartDate: (val: string) => void;
    endDate: string;
    onChangeEndDate: (val: string) => void;
    installmentPreview: {
      count: number;
      monthlyQuota: number;
      totalPurchase: number;
      startPeriod: string;
      endPeriod: string;
    };
    onSelectInstallmentCount: (count: number) => void;
    onSelectRecurringPreset: (months: number) => void;
  }) => {
    const isInstallments = cfg.chargeMode === 'installments';

    return (
      <>
        {/* Selector de Modalidad: Compra en Cuotas vs Suscripción / Recurrente */}
        <View style={styles.formSectionGroup}>
          <Text style={styles.fieldSectionLabel}>MODALIDAD DEL CARGO</Text>
          <View style={styles.chargeModeRow}>
            <Pressable
              onPress={() => {
                cfg.onChangeChargeMode('installments');
                if (cfg.installmentsCount < 1) {
                  cfg.onSelectInstallmentCount(3);
                } else {
                  cfg.onSelectInstallmentCount(cfg.installmentsCount);
                }
              }}
              style={[
                styles.chargeModeBtn,
                isInstallments && styles.chargeModeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.chargeModeBtnText,
                  isInstallments && styles.chargeModeBtnTextActive,
                ]}
              >
                💳 Compra en Cuotas
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                cfg.onChangeChargeMode('recurring');
                cfg.onChangeAmountInputMode('quota');
              }}
              style={[
                styles.chargeModeBtn,
                !isInstallments && styles.chargeModeBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.chargeModeBtnText,
                  !isInstallments && styles.chargeModeBtnTextActive,
                ]}
              >
                🔄 Suscripción / Recurrente
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Toggle Total Compra vs Valor Cuota cuando es Compra en Cuotas */}
        {isInstallments ? (
          <View style={styles.amountInputToggleRow}>
            <Text style={styles.amountInputToggleHint}>Ingresar monto por:</Text>
            <View style={styles.amountInputToggleGroup}>
              <Pressable
                onPress={() => cfg.onChangeAmountInputMode('total')}
                style={[
                  styles.amountInputToggleBtn,
                  cfg.amountInputMode === 'total' &&
                    styles.amountInputToggleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.amountInputToggleText,
                    cfg.amountInputMode === 'total' &&
                      styles.amountInputToggleTextActive,
                  ]}
                >
                  Total Compra
                </Text>
              </Pressable>
              <Pressable
                onPress={() => cfg.onChangeAmountInputMode('quota')}
                style={[
                  styles.amountInputToggleBtn,
                  cfg.amountInputMode === 'quota' &&
                    styles.amountInputToggleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.amountInputToggleText,
                    cfg.amountInputMode === 'quota' &&
                      styles.amountInputToggleTextActive,
                  ]}
                >
                  Valor Cuota
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Campos Principales: Glosa y Monto */}
        <View style={[styles.twoCol, !isDesktop && styles.twoColMobile]}>
          <View style={styles.col}>
            <GlassInput
              label={cfg.titleLabel}
              placeholder={cfg.titlePlaceholder}
              value={cfg.title}
              onChangeText={cfg.onChangeTitle}
            />
          </View>
          <View style={styles.col}>
            <GlassInput
              label={
                isInstallments
                  ? cfg.amountInputMode === 'total'
                    ? 'Total de la Compra (CLP)'
                    : 'Valor de cada Cuota (CLP)'
                  : cfg.recurringAmountLabel
              }
              placeholder={
                isInstallments && cfg.amountInputMode === 'total'
                  ? 'Ej. 300000'
                  : 'Ej. 25000'
              }
              keyboardType="numeric"
              value={cfg.amount}
              onChangeText={cfg.onChangeAmount}
            />
          </View>
        </View>

        {/* Categoría Unificada con Gastos Variables del Mes */}
        <View style={styles.formSectionGroup}>
          <Text style={styles.fieldSectionLabel}>CATEGORÍA</Text>
          {renderCategorySelector(cfg.category, cfg.onChangeCategory)}
        </View>

        {/* Plazo y Cuotas */}
        <View style={styles.formSectionGroup}>
          <View style={styles.sectionTitleRowWithIcon}>
            <Clock size={13} color={colors.textSecondary} />
            <Text style={styles.fieldSectionLabel}>
              {isInstallments
                ? 'CANTIDAD DE CUOTAS Y MES DE INICIO'
                : 'PLAZO Y VIGENCIA (¿POR CUÁNTO TIEMPO?)'}
            </Text>
          </View>

          {isInstallments ? (
            <>
              <View style={styles.chipsWrap}>
                {INSTALLMENT_COUNT_PRESETS.map((count) => {
                  const isSelected = cfg.installmentsCount === count;
                  return (
                    <Pressable
                      key={`inst-${count}`}
                      onPress={() => cfg.onSelectInstallmentCount(count)}
                      style={[
                        styles.chip,
                        styles.installmentChip,
                        isSelected && styles.installmentChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                      >
                        {count} {count === 1 ? 'cuota' : 'cuotas'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.twoCol,
                  !isDesktop && styles.twoColMobile,
                  { marginTop: 8 },
                ]}
              >
                <View style={styles.col}>
                  <GlassInput
                    label="N° Cuotas Personalizado"
                    placeholder="Ej. 10"
                    keyboardType="numeric"
                    value={cfg.customInstallments}
                    onChangeText={(text) => {
                      cfg.onChangeCustomInstallments(text);
                      const parsed = Number.parseInt(
                        text.replace(/\D/g, ''),
                        10
                      );
                      if (Number.isFinite(parsed) && parsed >= 1) {
                        cfg.onSelectInstallmentCount(parsed);
                      }
                    }}
                  />
                </View>
                <View style={styles.col}>
                  <GlassInput
                    label="Mes Primera Cuota (YYYY-MM)"
                    placeholder={period}
                    value={cfg.startDate}
                    onChangeText={(text) => {
                      cfg.onChangeStartDate(text);
                      if (/^\d{4}-\d{2}$/.test(text.trim())) {
                        cfg.onChangeEndDate(
                          cfg.installmentsCount <= 1
                            ? text.trim()
                            : shiftPeriod(text.trim(), cfg.installmentsCount - 1)
                        );
                      }
                    }}
                  />
                </View>
              </View>

              {/* Resumen en vivo de Compra en Cuotas */}
              <View style={styles.installmentPreviewBox}>
                <Text style={styles.installmentPreviewText}>
                  {cfg.installmentPreview.count}{' '}
                  {cfg.installmentPreview.count === 1 ? 'cuota' : 'cuotas'} de{' '}
                  {formatCLP(cfg.installmentPreview.monthlyQuota)}/mes · Total
                  compra: {formatCLP(cfg.installmentPreview.totalPurchase)}
                </Text>
                <Text style={styles.installmentPreviewSubtext}>
                  Vigencia:{' '}
                  {formatPeriodFull(cfg.installmentPreview.startPeriod)} →{' '}
                  {formatPeriodFull(cfg.installmentPreview.endPeriod)} · En Gastos
                  Fijos se mostrará solo la cuota mensual y en esta tarjeta el
                  compromiso total se irá liberando al marcar cada mes pagado.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.chipsWrap}>
                {RECURRING_DURATION_PRESETS.map((preset) => {
                  const isSelected = cfg.installmentsCount === preset.months;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => cfg.onSelectRecurringPreset(preset.months)}
                      style={[
                        styles.chip,
                        styles.installmentChip,
                        isSelected && styles.installmentChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.twoCol,
                  !isDesktop && styles.twoColMobile,
                  { marginTop: 8 },
                ]}
              >
                <View style={styles.col}>
                  <GlassInput
                    label="Mes Inicio (YYYY-MM)"
                    placeholder={period}
                    value={cfg.startDate}
                    onChangeText={(text) => {
                      cfg.onChangeStartDate(text);
                      cfg.onChangeInstallmentsCount(-1);
                    }}
                  />
                </View>
                <View style={styles.col}>
                  <GlassInput
                    label="Mes Término Opcional (YYYY-MM)"
                    placeholder="Vacío = Permanente"
                    value={cfg.endDate}
                    onChangeText={(text) => {
                      cfg.onChangeEndDate(text);
                      cfg.onChangeInstallmentsCount(-1);
                    }}
                  />
                </View>
              </View>

              <View style={styles.validityHelperBox}>
                <Text style={styles.validityHelperText}>
                  {cfg.endDate.trim()
                    ? `Cargo activo desde ${formatPeriodFull(cfg.startDate || period)} hasta ${formatPeriodFull(cfg.endDate)}`
                    : `Cargo recurrente continuo todos los meses a partir de ${formatPeriodFull(cfg.startDate || period)}`}
                </Text>
              </View>
            </>
          )}
        </View>
      </>
    );
  };

  // Valores mostrados en el Hero y Bento según la tarjeta activa o consolidado
  const heroAvailableAmount = activeCardEntry
    ? activeCardEntry.metrics.availableCredit
    : portfolioStats.totalAvailable;
  const heroFreePercent = activeCardEntry
    ? Math.max(0, 100 - activeCardEntry.metrics.usagePercent)
    : portfolioStats.freePercent;
  const heroUsedAmount = activeCardEntry
    ? activeCardEntry.metrics.usedAmount
    : portfolioStats.totalUsed;
  const heroMonthlyBilledAmount = activeCardEntry
    ? activeCardEntry.metrics.monthlyBilledTotal
    : portfolioStats.totalMonthlyBilled;
  const heroPendingBilledAmount = activeCardEntry
    ? activeCardEntry.metrics.pendingBilledTotal
    : portfolioStats.totalPendingBilled;
  const heroIsPaidInPeriod = activeCardEntry
    ? activeCardEntry.metrics.isPaidInPeriod
    : cardsWithMetrics.length > 0 && cardsWithMetrics.every((c) => c.metrics.isPaidInPeriod);
  const heroUsagePercent = activeCardEntry
    ? activeCardEntry.metrics.usagePercent
    : portfolioStats.usagePercent;
  const heroBillingEntry = activeCardEntry || portfolioStats.nextCutEntry;

  return (
    <View style={styles.container}>
      {/* =====================================================================
          EXPERIENCIA VISUAL BENTO + WALLET 3D (INSPIRADO EN DISEÑO DE REFERENCIA)
         ===================================================================== */}
      <View
        style={[
          styles.showcaseGrid,
          isDesktop && styles.showcaseGridDesktop,
        ]}
      >
        {/* COLUMNA 1: HERO DE CUPO DISPONIBLE + ORBES CIRCULARES DE ACCIÓN */}
        <View style={[styles.heroAmbientShell, isDesktop && styles.heroColDesktop]}>
          {/* Halo Ambiental Azul/Esmeralda estilo Liquid Glass */}
          <View style={styles.heroBackdropSvgWrap} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="none">
              <Defs>
                <RadialGradient
                  id="heroBlueOrbGlow"
                  cx="55%"
                  cy="38%"
                  rx="62%"
                  ry="58%"
                >
                  <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.34" />
                  <Stop offset="50%" stopColor="#2563EB" stopOpacity="0.14" />
                  <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
                </RadialGradient>
                <RadialGradient
                  id="heroEmeraldSideGlow"
                  cx="20%"
                  cy="20%"
                  rx="48%"
                  ry="45%"
                >
                  <Stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                  <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="400" height="320" fill="url(#heroBlueOrbGlow)" />
              <Rect x="0" y="0" width="400" height="320" fill="url(#heroEmeraldSideGlow)" />
            </Svg>
          </View>

          {/* Barra Superior del Hero: Selector Personal / Tarjeta + Badges Circulares */}
          <View style={styles.heroTopPillRow}>
            <Pressable
              onPress={() => {
                if (cardsWithMetrics.length > 1 && activeCardEntry) {
                  const idx = cardsWithMetrics.findIndex(
                    (c) => c.card.id === activeCardEntry.card.id
                  );
                  const next =
                    cardsWithMetrics[(idx + 1) % cardsWithMetrics.length];
                  handleSelectWalletCard(next.card.id);
                }
              }}
              style={({ pressed }) => [
                styles.personalCapsulePill,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.personalAvatarCircle}>
                <CreditCard size={13} color="#FFFFFF" />
              </View>
              <Text numberOfLines={1} style={styles.personalCapsuleText}>
                {activeCardEntry ? activeCardEntry.card.name : 'Mis Tarjetas'}
              </Text>
            </Pressable>

            <View style={styles.heroRightBadgesRow}>
              {/* Píldora de Alertas de Corte (estilo 🔥 0 de la foto) */}
              <View
                style={[
                  styles.heroStatBubble,
                  portfolioStats.urgentAlertsCount > 0 &&
                    styles.heroStatBubbleAlert,
                ]}
              >
                <Flame
                  size={14}
                  color={
                    portfolioStats.urgentAlertsCount > 0 ? '#FB923C' : '#F59E0B'
                  }
                />
                <Text style={styles.heroStatBubbleText}>
                  {portfolioStats.urgentAlertsCount}
                </Text>
              </View>

              {/* Círculo de % de Uso con Mini Anillo SVG (estilo 2% de la foto) */}
              <View style={styles.heroRingBadge}>
                <Svg width={36} height={36} viewBox="0 0 36 36">
                  <Circle
                    cx="18"
                    cy="18"
                    r="14"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <Circle
                    cx="18"
                    cy="18"
                    r="14"
                    stroke={heroUsagePercent > 70 ? '#F43F5E' : '#60A5FA'}
                    strokeWidth="2.5"
                    strokeDasharray={`${Math.round((heroUsagePercent / 100) * 88)} 88`}
                    strokeLinecap="round"
                    fill="none"
                    rotation="-90"
                    origin="18, 18"
                  />
                </Svg>
                <Text style={styles.heroRingBadgeText}>{heroUsagePercent}%</Text>
              </View>
            </View>
          </View>

          {/* Bloque Central: "Total balance ↑ +XX%" + Monto Gigante */}
          <View style={styles.heroBalanceCenterBox}>
            <View style={styles.heroEyebrowRow}>
              <Text style={styles.heroEyebrowLabel}>Cupo disponible</Text>
              <View style={styles.heroPositiveBadge}>
                <Text style={styles.heroPositiveArrow}>↑</Text>
                <Text style={styles.heroPositiveText}>
                  +{heroFreePercent}% libre
                </Text>
              </View>
            </View>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.heroGiantBalance,
                !isDesktop && styles.heroGiantBalanceMobile,
              ]}
            >
              {formatCLP(heroAvailableAmount)}
            </Text>

            <Text style={styles.heroSubHint}>
              Cupo total {formatCLP(portfolioStats.totalLimit)} · Disponible consolidado{' '}
              {formatCLP(portfolioStats.totalAvailable)}
            </Text>
          </View>

          {/* Fila de Botones Circulares (+ Nueva, Editar) */}
          <View style={styles.heroActionRow}>
            <View style={styles.heroCircleActionsGroup}>
              <Pressable
                onPress={() => {
                  if (showNewCardModal) {
                    setShowNewCardModal(false);
                    setEditingCardId(null);
                  } else {
                    openCreateModal();
                  }
                }}
                style={({ pressed }) => [
                  styles.heroCircleActionBtn,
                  showNewCardModal &&
                    !editingCardId &&
                    styles.heroCircleActionBtnActive,
                  pressed && styles.pressed,
                ]}
              >
                <FintechAddIcon active={showNewCardModal && !editingCardId} />
                <Text
                  style={[
                    styles.heroCircleActionLabel,
                    showNewCardModal &&
                      !editingCardId &&
                      styles.heroCircleActionLabelActive,
                  ]}
                >
                  {showNewCardModal && !editingCardId ? 'Cerrar' : 'Nueva'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (activeCardEntry && onUpdateAccount) {
                    openEditCardModal(activeCardEntry.card);
                  } else {
                    setShowAllCardsExpanded((prev) => !prev);
                  }
                }}
                style={({ pressed }) => [
                  styles.heroCircleActionBtn,
                  editingCardId !== null &&
                    showNewCardModal &&
                    styles.heroCircleActionBtnActive,
                  pressed && styles.pressed,
                ]}
              >
                <FintechAnalyticsIcon
                  active={editingCardId !== null && showNewCardModal}
                />
                <Text
                  style={[
                    styles.heroCircleActionLabel,
                    editingCardId !== null &&
                      showNewCardModal &&
                      styles.heroCircleActionLabelActive,
                  ]}
                >
                  Editar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* COLUMNA 2: TARJETERO 3D APILADO (WALLET POCKET) + WIDGETS BENTO INFERIORES */}
        <View style={[styles.walletAndBentoCol, isDesktop && styles.walletColDesktop]}>
          {/* TARJETERO 3D INTERACTIVO CON PLÁSTICOS ASOMÁNDOSE */}
          <View style={styles.walletShowcaseContainer}>
            <View style={styles.walletHeaderMiniRow}>
              <Text style={styles.walletSectionEyebrow}>
                TARJETERO INTERACTIVO · TOCA UN PLÁSTICO
              </Text>
              {cardsWithMetrics.length > 1 ? (
                <Pressable
                  onPress={() => setShowAllCardsExpanded((prev) => !prev)}
                  style={styles.walletToggleAllPill}
                >
                  <Text style={styles.walletToggleAllText}>
                    {showAllCardsExpanded
                      ? 'Ver solo activa'
                      : `Ver todas (${cardsWithMetrics.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {orderedWalletStack.length === 0 ? (
              <Pressable
                onPress={openCreateModal}
                style={styles.emptyWalletPrompt}
              >
                <Wallet size={24} color="#60A5FA" />
                <Text style={styles.emptyWalletTitle}>
                  Tu tarjetero 3D está vacío
                </Text>
                <Text style={styles.emptyWalletSub}>
                  Toca aquí o en "+ Nueva" para agregar tu tarjeta Santander, CMR Falabella u otra.
                </Text>
              </Pressable>
            ) : (
              <Animated.View
                style={[
                  styles.walletPocketStage,
                  { transform: [{ scale: walletPullAnim }] },
                ]}
              >
                {/* Stack de Tarjetas Asomándose por Arriba del Bolsillo de Cuero */}
                <View
                  style={[
                    styles.peekingCardsStack,
                    {
                      height: Math.max(
                        118,
                        64 + orderedWalletStack.length * 48
                      ),
                    },
                  ]}
                >
                  {orderedWalletStack.map((entry, idx) => {
                    const isFrontSelected =
                      entry.card.id === activeCardEntry?.card.id;
                    const topOffset = idx * 46;
                    const horizontalInset =
                      (orderedWalletStack.length - 1 - idx) * 7;

                    return (
                      <Pressable
                        key={entry.card.id}
                        onPress={() => handleSelectWalletCard(entry.card.id)}
                        style={[
                          styles.peekingCardSlice,
                          {
                            top: topOffset,
                            left: horizontalInset,
                            right: horizontalInset,
                            zIndex: idx + 1,
                            borderColor: isFrontSelected
                              ? '#FFFFFF'
                              : entry.palette.borderGlow,
                          },
                        ]}
                      >
                        <View style={styles.peekingCardSvgBg} pointerEvents="none">
                          <Svg
                            width="100%"
                            height="100%"
                            viewBox="0 0 360 110"
                            preserveAspectRatio="none"
                          >
                            <Defs>
                              <LinearGradient
                                id={`cardSliceGrad-${entry.card.id}`}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <Stop
                                  offset="0%"
                                  stopColor={entry.palette.gradStart}
                                />
                                <Stop
                                  offset="55%"
                                  stopColor={entry.palette.gradMid}
                                />
                                <Stop
                                  offset="100%"
                                  stopColor={entry.palette.gradEnd}
                                />
                              </LinearGradient>
                              <LinearGradient
                                id={`cardSliceShine-${entry.card.id}`}
                                x1="0%"
                                y1="0%"
                                x2="65%"
                                y2="100%"
                              >
                                <Stop
                                  offset="0%"
                                  stopColor="#FFFFFF"
                                  stopOpacity="0.28"
                                />
                                <Stop
                                  offset="45%"
                                  stopColor="#FFFFFF"
                                  stopOpacity="0.06"
                                />
                                <Stop
                                  offset="100%"
                                  stopColor="#FFFFFF"
                                  stopOpacity="0"
                                />
                              </LinearGradient>
                            </Defs>
                            <Rect
                              x="0"
                              y="0"
                              width="360"
                              height="110"
                              rx="22"
                              fill={`url(#cardSliceGrad-${entry.card.id})`}
                            />
                            <Path
                              d="M0 0 L220 0 L150 110 L0 110 Z"
                              fill={`url(#cardSliceShine-${entry.card.id})`}
                            />
                          </Svg>
                        </View>

                        {/* Fila Superior Visible de la Tarjeta (Nombre a la izquierda, Monto a la derecha como en la foto) */}
                        <View style={styles.peekingCardHeaderRow}>
                          <View style={styles.peekingCardTitleGroup}>
                            <Text
                              numberOfLines={1}
                              style={styles.peekingCardName}
                            >
                              {entry.card.name}
                            </Text>
                            {isFrontSelected ? (
                              <View style={styles.peekingActiveDot} />
                            ) : null}
                          </View>

                          <Text
                            numberOfLines={1}
                            style={styles.peekingCardAmount}
                          >
                            {formatCLP(entry.metrics.availableCredit)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Bolsillo Frontal de Cuero 3D Esculpido (Wallet Pocket Front Cover) */}
                <View style={styles.leatherPocketFront} pointerEvents="box-none">
                  <Svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 380 138"
                    preserveAspectRatio="none"
                  >
                    <Defs>
                      <LinearGradient
                        id="leatherPocketBodyGrad"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <Stop offset="0%" stopColor="#4A3228" />
                        <Stop offset="22%" stopColor="#38251E" />
                        <Stop offset="68%" stopColor="#271914" />
                        <Stop offset="100%" stopColor="#180F0C" />
                      </LinearGradient>
                      <LinearGradient
                        id="leatherPocketRimLight"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
                        <Stop offset="50%" stopColor="#FDE68A" stopOpacity="0.28" />
                        <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.16" />
                      </LinearGradient>
                    </Defs>

                    {/* Sombra trasera de entrada del bolsillo */}
                    <Rect
                      x="6"
                      y="0"
                      width="368"
                      height="32"
                      rx="16"
                      fill="#120B09"
                    />

                    {/* Silueta esculpida del tarjetero con curva cóncava suave superior */}
                    <Path
                      d="M 0,24 C 0,9 12,4 28,8 C 110,22 270,22 352,8 C 368,4 380,9 380,24 L 374,106 C 372,125 356,136 334,136 L 46,136 C 24,136 8,125 6,106 Z"
                      fill="url(#leatherPocketBodyGrad)"
                      stroke="url(#leatherPocketRimLight)"
                      strokeWidth="1.5"
                    />

                    {/* Costura sutil de marroquinería de lujo */}
                    <Path
                      d="M 14,30 C 112,42 268,42 366,30 L 361,102 C 359,116 348,124 330,124 L 50,124 C 32,124 21,116 19,102 Z"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.09)"
                      strokeWidth="1"
                      strokeDasharray="5 4"
                    />
                  </Svg>

                  {/* Contenido sutil sobre el cuero del tarjetero */}
                  {activeCardEntry ? (
                    <View style={styles.pocketOverlayContent} pointerEvents="none">
                      <Text style={styles.pocketSelectedLabel}>
                        SELECCIONADA EN BILLETERA
                      </Text>
                      <Text numberOfLines={1} style={styles.pocketSelectedTitle}>
                        {activeCardEntry.card.name} · {activeCardEntry.metrics.usagePercent}% usado
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            )}
          </View>

          {/* WIDGETS BENTO INFERIORES (Monthly Expenses / Facturado + Tomorrow / Corte) */}
          <View style={styles.bentoPairRow}>
            {/* Bento Izquierdo: Facturado del Mes (solo cuota del mes + recurrentes + base) */}
            <View style={styles.bentoLeftWidget}>
              <Text style={styles.bentoWidgetTitle}>
                {heroIsPaidInPeriod ? 'Pagado este Mes' : 'Facturado del Mes'}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.bentoWidgetBigValue}
              >
                {formatCLP(heroMonthlyBilledAmount)}
              </Text>
              <View style={styles.bentoTrendBlock}>
                <Text
                  style={[
                    styles.bentoTrendBadgeText,
                    heroUsagePercent > 50
                      ? styles.bentoTrendWarn
                      : styles.bentoTrendGood,
                  ]}
                >
                  ↗ {heroUsagePercent}% de línea
                </Text>
                <Text numberOfLines={2} style={styles.bentoTrendSubtext}>
                  {heroIsPaidInPeriod
                    ? `Por pagar mes: ${formatCLP(heroPendingBilledAmount)} · Cupo usado: ${formatCLP(heroUsedAmount)}`
                    : (activeCardEntry
                        ? activeCardEntry.metrics.installmentCommittedTotal
                        : portfolioStats.totalInstallmentCommitted) > 0
                    ? `Cupo comprometido: ${formatCLP(heroUsedAmount)}`
                    : `Recurrentes: ${formatCLP(activeCardEntry ? activeCardEntry.metrics.recurringCharges : portfolioStats.totalRecurring)}`}
                </Text>
              </View>
            </View>

            {/* Bento Derecho: Próximo Corte / Facturación */}
            <Pressable
              onPress={() => {
                if (activeCardEntry && onUpdateAccount) {
                  openEditCardModal(activeCardEntry.card);
                }
              }}
              style={({ pressed }) => [
                styles.bentoRightWidget,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.bentoRightTopRow}>
                <Text style={styles.bentoWidgetTitle}>Próximo Corte</Text>

                <View style={styles.bentoCutLabelCol}>
                  <Text style={styles.bentoCutPrimaryLabel}>
                    {heroBillingEntry &&
                    heroBillingEntry.metrics.billingAlert.daysRemaining !== null
                      ? heroBillingEntry.metrics.billingAlert.daysRemaining === 0
                        ? 'Corte Hoy'
                        : heroBillingEntry.metrics.billingAlert.daysRemaining === 1
                          ? 'Mañana'
                          : `En ${heroBillingEntry.metrics.billingAlert.daysRemaining} días`
                      : 'Sin corte'}
                  </Text>
                  <Text style={styles.bentoCutSubLabel}>
                    {heroBillingEntry &&
                    heroBillingEntry.metrics.billingAlert.billingDay
                      ? `Día ${heroBillingEntry.metrics.billingAlert.billingDay}`
                      : 'Configurar'}
                  </Text>
                </View>
              </View>

              <View style={styles.bentoRightBottomRow}>
                <Text style={styles.bentoRightHintLabel}>
                  {heroBillingEntry?.metrics.isPaidInPeriod
                    ? 'Pagado este mes ✓'
                    : 'Por pagar al corte'}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.bentoRightBigValue}
                >
                  {formatCLP(
                    heroBillingEntry
                      ? heroBillingEntry.metrics.pendingBilledTotal
                      : 0
                  )}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Cabecera de control rápido y selector de plásticos */}
      <View style={styles.headerRow} ref={detailSectionRef}>
        <View style={styles.headerTextCol}>
          <Text style={styles.sectionTitle}>
            Tarjetas de Crédito y Manejo de Cupos
          </Text>
          <Text style={styles.sectionSubtitle}>
            {activeCardEntry && !showAllCardsExpanded
              ? `Inspeccionando ${activeCardEntry.card.name} (${formatPeriodFull(period)})`
              : `Tus plásticos personalizados con cupo disponible en tiempo real (${formatPeriodFull(period)})`}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {cardsWithMetrics.length > 1 ? (
            <Pressable
              onPress={() => setShowAllCardsExpanded((prev) => !prev)}
              style={({ pressed }) => [
                styles.secondaryPillBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryPillBtnText}>
                {showAllCardsExpanded
                  ? 'Mostrar solo seleccionada'
                  : `Ver las ${cardsWithMetrics.length} tarjetas`}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              if (showNewCardModal) {
                setShowNewCardModal(false);
                setEditingCardId(null);
              } else {
                openCreateModal();
              }
            }}
            style={({ pressed }) => [styles.addPillBtn, pressed && styles.pressed]}
          >
            <Plus size={15} color={colors.buttonPrimaryText} />
            <Text style={styles.addPillBtnText}>
              {showNewCardModal ? 'Cerrar' : 'Nueva Tarjeta / Cuenta'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Formulario para Crear o Editar Tarjeta con Selector Visual de Diseño */}
      {showNewCardModal ? (
        <Animated.View
          ref={editFormRef}
          style={[
            styles.animatedFormCardWrapper,
            {
              borderColor: editHighlightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(255, 255, 255, 0.12)', '#34D399'],
              }),
            },
          ]}
        >
          <GlassCard style={styles.formCard}>
            {editingCardId ? (
              <View style={styles.editingActiveBanner}>
                <View style={styles.editingActiveBannerLeft}>
                  <View style={styles.editingPulseDot} />
                  <Pencil size={13} color="#34D399" />
                  <Text style={styles.editingActiveBannerText}>
                    MODO EDICIÓN ACTIVO:{' '}
                    <Text style={styles.editingActiveCardName}>{cardName}</Text>
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setShowNewCardModal(false);
                    setEditingCardId(null);
                  }}
                  style={styles.editingCancelBtn}
                >
                  <Text style={styles.editingCancelBtnText}>Cancelar</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>
                {editingCardId
                  ? 'Editar Tarjeta / Cuenta Bancaria'
                  : 'Registrar Nueva Tarjeta o Cuenta'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowNewCardModal(false);
                  setEditingCardId(null);
                }}
                style={styles.iconBtn}
              >
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Selector Tipo: Tarjeta de Crédito vs Cuenta Corriente */}
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => setAccountType('credit_card')}
                style={[
                  styles.segmentOption,
                  accountType === 'credit_card' && styles.segmentOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    accountType === 'credit_card' && styles.segmentTextActive,
                  ]}
                >
                  Tarjeta de Crédito
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAccountType('checking')}
                style={[
                  styles.segmentOption,
                  accountType === 'checking' && styles.segmentOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    accountType === 'checking' && styles.segmentTextActive,
                  ]}
                >
                  Cuenta Corriente / Vista
                </Text>
              </Pressable>
            </View>

            {/* Selector Visual de Diseño de Plástico (Santander | CMR Falabella | Otra) */}
            {accountType === 'credit_card' ? (
              <View style={styles.brandSelectorSection}>
                <Text style={styles.brandSelectorTitle}>
                  ¿Qué tarjeta será? Elige el diseño de tu plástico:
                </Text>

                <View
                  style={[
                    styles.brandCardsGrid,
                    !isDesktop && styles.brandCardsGridMobile,
                  ]}
                >
                  {CARD_DESIGN_OPTIONS.map((option) => {
                    const isSelected = selectedBrand === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => handleSelectBrand(option.id)}
                        style={[
                          styles.brandOptionCard,
                          !isDesktop && styles.brandOptionCardMobile,
                          isSelected && styles.brandOptionCardSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.brandMiniPreviewWrap,
                            !isDesktop && styles.brandMiniPreviewWrapMobile,
                          ]}
                        >
                          <CreditCardVisual brand={option.id} compact />
                        </View>

                        <View
                          style={[
                            styles.brandOptionFooter,
                            !isDesktop && styles.brandOptionFooterMobile,
                          ]}
                        >
                          <View style={styles.brandOptionTextCol}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.brandOptionLabel,
                                isSelected && styles.brandOptionLabelSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                            <Text numberOfLines={1} style={styles.brandOptionSub}>
                              {option.subtitle}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.brandRadioCircle,
                              isSelected && styles.brandRadioCircleSelected,
                            ]}
                          >
                            {isSelected ? (
                              <Check size={11} color={colors.buttonPrimaryText} />
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Vista previa en vivo de la tarjeta seleccionada */}
                <View style={styles.livePreviewBox}>
                  <Text style={styles.livePreviewEyebrow}>
                    VISTA PREVIA DE TU TARJETA
                  </Text>
                  <View style={styles.livePreviewCardHolder}>
                    <CreditCardVisual
                      brand={selectedBrand}
                      cardName={cardName || 'Mi Tarjeta'}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            <GlassInput
              label="Nombre del Plástico o Cuenta"
              placeholder="Ej. Tarjeta Santander, CMR Falabella..."
              value={cardName}
              onChangeText={setCardName}
            />

            {accountType === 'credit_card' ? (
              <>
                <View style={[styles.twoCol, !isDesktop && styles.twoColMobile]}>
                  <View style={styles.col}>
                    <GlassInput
                      label="Cupo Total Autorizado (CLP)"
                      placeholder="Ej. 4000000"
                      keyboardType="numeric"
                      value={creditLimit}
                      onChangeText={setCreditLimit}
                    />
                  </View>
                  <View style={styles.col}>
                    <GlassInput
                      label="Deuda Base / Cuotas Facturadas (CLP)"
                      placeholder="Ej. 320000"
                      keyboardType="numeric"
                      value={currentBalance}
                      onChangeText={setCurrentBalance}
                    />
                  </View>
                </View>
                <GlassInput
                  label="Día de Corte / Facturación Mensual (1 al 31)"
                  placeholder="Ej. 23"
                  keyboardType="numeric"
                  value={billingDay}
                  onChangeText={setBillingDay}
                />
              </>
            ) : (
              <GlassInput
                label="Saldo Actual Disponible (CLP)"
                placeholder="Ej. 1250000"
                keyboardType="numeric"
                value={currentBalance}
                onChangeText={setCurrentBalance}
              />
            )}

            <TeslaButton
              title={
                editingCardId
                  ? 'Guardar Cambios de Tarjeta'
                  : 'Guardar Tarjeta / Cuenta'
              }
              onPress={handleSaveCard}
              loading={submittingCard}
            />
          </GlassCard>
        </Animated.View>
      ) : null}

      {/* Píldoras selectoras rápidas cuando hay múltiples tarjetas */}
      {cardsWithMetrics.length > 1 ? (
        <View style={styles.cardSwitchPillsRow}>
          {cardsWithMetrics.map((entry) => {
            const isSelected =
              !showAllCardsExpanded &&
              entry.card.id === activeCardEntry?.card.id;
            return (
              <Pressable
                key={entry.card.id}
                onPress={() => handleSelectWalletCard(entry.card.id)}
                style={[
                  styles.cardSwitchPill,
                  isSelected && {
                    borderColor: entry.brandMeta.accentColor,
                    backgroundColor: 'rgba(255, 255, 255, 0.09)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.cardSwitchDot,
                    { backgroundColor: entry.brandMeta.accentColor },
                  ]}
                />
                <Text
                  style={[
                    styles.cardSwitchPillText,
                    isSelected && styles.cardSwitchPillTextActive,
                  ]}
                >
                  {entry.card.name}
                </Text>
                <Text style={styles.cardSwitchPillAmount}>
                  {formatCLP(entry.metrics.availableCredit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Detalle completo de la Tarjeta Seleccionada (o todas si se expandió) */}
      {creditCards.length === 0 ? (
        <GlassCard>
          <Text style={styles.emptyText}>
            No tienes tarjetas de crédito registradas aún. Toca "Nueva Tarjeta / Cuenta" arriba para elegir entre Santander, CMR Falabella u Otra.
          </Text>
        </GlassCard>
      ) : (
        <View style={styles.cardsListContainer}>
          {displayedDetailCards.map(({ card, brand, brandMeta, cardItems, metrics }) => {
            return (
              <GlassCard key={card.id} style={styles.cardBlock}>
                {/* Layout Responsivo: Plástico Visual + Métricas de Cupo */}
                <View
                  style={[
                    styles.cardShowcaseRow,
                    !isDesktop && styles.cardShowcaseRowMobile,
                  ]}
                >
                  {/* Columna Izquierda (Desktop) / Superior (Móvil): Diseño Físico de la Tarjeta */}
                  <View
                    style={[
                      styles.plasticVisualCol,
                      !isDesktop && styles.plasticVisualColMobile,
                    ]}
                  >
                    <CreditCardVisual brand={brand} cardName={card.name} />
                  </View>

                  {/* Columna Derecha (Desktop) / Inferior (Móvil): Identidad, Alerta y Cupos */}
                  <View
                    style={[
                      styles.cardMetricsCol,
                      !isDesktop && styles.cardMetricsColMobile,
                    ]}
                  >
                    {/* Cabecera de la Tarjeta y Botones de Acción */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardIdentityTextCol}>
                        <View style={styles.cardTitleAndBadgeRow}>
                          <Text style={styles.cardName}>{card.name}</Text>
                          <View
                            style={[
                              styles.brandTagPill,
                              { borderColor: brandMeta.accentColor },
                            ]}
                          >
                            <Text
                              style={[
                                styles.brandTagText,
                                { color: brandMeta.accentColor },
                              ]}
                            >
                              {brandMeta.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.cardTypeLabel}>
                          {brandMeta.subtitle.toUpperCase()} · CLP
                        </Text>
                      </View>

                      <View style={styles.cardActionsRight}>
                        <View
                          style={[
                            styles.billingAlertPill,
                            metrics.billingAlert.isUrgent &&
                              styles.billingAlertPillUrgent,
                          ]}
                        >
                          <AlertCircle
                            size={13}
                            color={
                              metrics.billingAlert.isUrgent
                                ? colors.buttonPrimaryText
                                : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.billingAlertText,
                              metrics.billingAlert.isUrgent &&
                                styles.billingAlertTextUrgent,
                            ]}
                          >
                            {metrics.billingAlert.label}
                          </Text>
                        </View>

                        {onUpdateAccount ? (
                          <Pressable
                            onPress={() => {
                              if (editingCardId === card.id && showNewCardModal) {
                                scrollToEditForm();
                              } else {
                                openEditCardModal(card);
                              }
                            }}
                            style={[
                              styles.actionIconChip,
                              editingCardId === card.id &&
                                showNewCardModal &&
                                styles.actionIconChipEditing,
                            ]}
                          >
                            <Pencil
                              size={14}
                              color={
                                editingCardId === card.id && showNewCardModal
                                  ? '#34D399'
                                  : colors.textSecondary
                              }
                            />
                          </Pressable>
                        ) : null}

                        {editingCardId === card.id && showNewCardModal ? (
                          <Pressable
                            onPress={scrollToEditForm}
                            style={styles.cardEditingIndicatorPill}
                          >
                            <ArrowUp size={11} color="#34D399" />
                            <Text style={styles.cardEditingIndicatorText}>
                              Editando arriba
                            </Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          onPress={() => onDeleteAccount(card.id)}
                          style={styles.actionIconChip}
                        >
                          <Trash2 size={14} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Métricas de Cupo: Cupo Disponible = Cupo Total - Comprometido (Cuotas + Mes + Base) */}
                    <View
                      style={[
                        styles.quotaGrid,
                        !isDesktop && styles.quotaGridMobile,
                      ]}
                    >
                      <View
                        style={[
                          styles.quotaPrimaryBox,
                          !isDesktop && styles.quotaBoxMobile,
                        ]}
                      >
                        <Text style={styles.quotaLabel}>CUPO DISPONIBLE</Text>
                        <Text
                          style={[
                            styles.quotaAvailableValue,
                            !isDesktop && styles.quotaValueMobile,
                          ]}
                        >
                          {formatCLP(metrics.availableCredit)}
                        </Text>
                        <Text style={styles.quotaFormulaHint}>
                          Cupo Total ({formatCLP(metrics.creditLimit)}) − Comprometido (
                          {formatCLP(metrics.usedAmount)})
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.quotaSecondaryBox,
                          !isDesktop && styles.quotaBoxMobile,
                        ]}
                      >
                        <Text style={styles.quotaLabel}>
                          CUPO UTILIZADO / COMPROMETIDO
                        </Text>
                        <Text
                          style={[
                            styles.quotaUsedValue,
                            !isDesktop && styles.quotaValueMobile,
                          ]}
                        >
                          {formatCLP(metrics.usedAmount)}
                        </Text>
                        <Text style={styles.quotaFormulaHint}>
                          {metrics.installmentCommittedTotal > 0
                            ? `Cuotas pend: ${formatCLP(metrics.installmentCommittedTotal)} · Recurrentes pend: ${formatCLP(metrics.unpaidNonInstallmentCharges)} · Base pend: ${formatCLP(metrics.pendingBaseBalance)}`
                            : `Recurrentes pend: ${formatCLP(metrics.unpaidNonInstallmentCharges)} · Base pend: ${formatCLP(metrics.pendingBaseBalance)}`}
                        </Text>
                      </View>
                    </View>

                    {/* Banner de Recuperación de Cupo y Estado de Pago del Mes */}
                    {metrics.totalInstallmentsCount > 0 ||
                    metrics.monthlyBilledTotal > 0 ||
                    metrics.recoveredCredit > 0 ||
                    metrics.isPaidInPeriod ? (
                      <View
                        style={[
                          styles.quotaRecoveryBanner,
                          metrics.isPaidInPeriod && styles.quotaRecoveryBannerPaid,
                        ]}
                      >
                        <View style={styles.quotaRecoveryLeft}>
                          <View style={styles.quotaRecoveryTitleRow}>
                            <CheckCircle2
                              size={14}
                              color={
                                metrics.isPaidInPeriod ? '#34D399' : '#A7F3D0'
                              }
                            />
                            <Text style={styles.quotaRecoveryTitle}>
                              {metrics.isPaidInPeriod
                                ? metrics.totalInstallmentsCount > 0
                                  ? `Mes ${formatPeriodShort(period)} Pagado · ${metrics.paidInstallmentsCount}/${metrics.totalInstallmentsCount} cuotas`
                                  : `Mes ${formatPeriodShort(period)} Pagado`
                                : metrics.totalInstallmentsCount > 0
                                  ? `${metrics.paidInstallmentsCount}/${metrics.totalInstallmentsCount} cuotas pagadas`
                                  : `Facturación ${formatPeriodShort(period)}: ${formatCLP(metrics.monthlyBilledTotal)}`}
                            </Text>
                          </View>
                          <Text style={styles.quotaRecoverySub}>
                            {metrics.recoveredCredit > 0
                              ? `Cupo recuperado: +${formatCLP(metrics.recoveredCredit)}${
                                  metrics.isPaidInPeriod
                                    ? metrics.installmentCommittedTotal > 0
                                      ? ` · Pendiente en cuotas: ${formatCLP(metrics.installmentCommittedTotal)}`
                                      : ''
                                    : metrics.monthlyBilledTotal > 0
                                      ? ` · Al pagar este mes liberas +${formatCLP(metrics.monthlyBilledTotal)}`
                                      : ''
                                }`
                              : metrics.isPaidInPeriod
                                ? 'Cupo del mes liberado en esta tarjeta'
                                : `Al marcar como pagado recuperarás +${formatCLP(metrics.monthlyBilledTotal)} de cupo`}
                          </Text>
                        </View>

                        {onToggleCardPaid ? (
                          <Pressable
                            onPress={() => onToggleCardPaid(card.id)}
                            style={({ pressed }) => [
                              styles.quotaRecoveryBtn,
                              metrics.isPaidInPeriod &&
                                styles.quotaRecoveryBtnPaid,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.quotaRecoveryBtnText,
                                metrics.isPaidInPeriod &&
                                  styles.quotaRecoveryBtnTextPaid,
                              ]}
                            >
                              {metrics.isPaidInPeriod
                                ? 'Pagado ✓'
                                : 'Marcar Pagado'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Barra de Progreso de Utilización de Cupo */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>
                          USO DE LÍNEA DE CRÉDITO
                        </Text>
                        <Text style={styles.progressPercent}>
                          {metrics.usagePercent}% utilizado
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${metrics.usagePercent}%`,
                              backgroundColor:
                                brand === 'falabella'
                                  ? '#64BE51'
                                  : brand === 'santander'
                                    ? '#3B82F6'
                                    : colors.buttonPrimaryBg,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Desglose por Tarjeta y Servicios Anidados (Acordeón) */}
                {(() => {
                  const isChargesExpanded = Boolean(
                    expandedCardCharges[card.id] || activeCardForNewGroup === card.id
                  );
                  return (
                    <>
                      <View style={styles.breakdownHeader}>
                        <Pressable
                          onPress={() => toggleCardChargesAccordion(card.id)}
                          style={styles.breakdownTitleGroup}
                        >
                          <Layers size={15} color={colors.textSecondary} />
                          <Text style={styles.breakdownTitle}>
                            SERVICIOS Y CARGOS ASOCIADOS A {card.name.toUpperCase()}
                          </Text>
                        </Pressable>

                        <View style={styles.breakdownActionsGroup}>
                          <Pressable
                            onPress={() => toggleNewGroupForCard(card.id)}
                            style={styles.smallGhostBtn}
                          >
                            <Plus size={13} color={colors.textPrimary} />
                            <Text style={styles.smallGhostBtnText}>
                              {activeCardForNewGroup === card.id
                                ? 'Cerrar Formulario'
                                : 'Agregar Cargo / Cuotas'}
                            </Text>
                          </Pressable>

                          <AccordionToggle
                            expanded={isChargesExpanded}
                            count={cardItems.length}
                            onPress={() => toggleCardChargesAccordion(card.id)}
                            accessibilityLabel={`Alternar servicios y cargos de ${card.name}`}
                          />
                        </View>
                      </View>

                      {!isChargesExpanded ? (
                        <Pressable
                          onPress={() => toggleCardChargesAccordion(card.id)}
                          style={({ pressed }) => [
                            styles.collapsedAccordionSummary,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.collapsedAccordionText}>
                            {cardItems.length === 0
                              ? `Sin cargos activos en ${formatPeriodFull(period)} · Toca para abrir`
                              : `${cardItems.length} ${
                                  cardItems.length === 1
                                    ? 'servicio o cargo activo'
                                    : 'servicios y cargos activos'
                                } · Total ${formatCLP(metrics.recurringCharges)}/mes`}
                          </Text>
                          <Text style={styles.collapsedAccordionHint}>Ver desglose</Text>
                        </Pressable>
                      ) : null}

                      {isChargesExpanded ? (
                        <>

                {activeCardForNewGroup === card.id ? (
                  <View style={styles.cardExpenseFormBox}>
                    <View style={styles.cardExpenseFormHeader}>
                      <Text style={styles.inlineBoxTitle}>
                        Nuevo Cargo o Compra en Cuotas en {card.name}
                      </Text>
                      <Text style={styles.cardExpenseFormSubtitle}>
                        Registra compras en cuotas o suscripciones recurrentes con las mismas categorías de Gastos Variables
                      </Text>
                    </View>

                    {renderChargeScheduleForm({
                      chargeMode: groupChargeMode,
                      onChangeChargeMode: setGroupChargeMode,
                      amountInputMode: groupAmountInputMode,
                      onChangeAmountInputMode: setGroupAmountInputMode,
                      title: groupTitle,
                      onChangeTitle: setGroupTitle,
                      titleLabel:
                        groupChargeMode === 'installments'
                          ? 'Glosa / Compra (ej. Notebook, Pasaje, Celular)'
                          : 'Glosa / Suscripción (ej. Netflix, Spotify, Seguro)',
                      titlePlaceholder:
                        groupChargeMode === 'installments'
                          ? 'Ej. Notebook'
                          : 'Ej. Netflix',
                      amount: groupAmount,
                      onChangeAmount: setGroupAmount,
                      recurringAmountLabel:
                        'Monto Mensual CLP (0 si sumarás sub-ítems)',
                      category: groupCategory,
                      onChangeCategory: setGroupCategory,
                      installmentsCount: groupInstallments,
                      onChangeInstallmentsCount: setGroupInstallments,
                      customInstallments: groupCustomInstallments,
                      onChangeCustomInstallments: setGroupCustomInstallments,
                      startDate: groupStartDate,
                      onChangeStartDate: setGroupStartDate,
                      endDate: groupEndDate,
                      onChangeEndDate: setGroupEndDate,
                      installmentPreview: groupInstallmentPreview,
                      onSelectInstallmentCount: handleSelectInstallmentCount,
                      onSelectRecurringPreset: handleSelectRecurringPreset,
                    })}

                    {groupErrorMsg ? (
                      <Text style={styles.errorText}>{groupErrorMsg}</Text>
                    ) : null}

                    {/* Acciones del Formulario */}
                    <View
                      style={[
                        styles.twoCol,
                        !isDesktop && styles.twoColMobile,
                        { marginTop: 8 },
                      ]}
                    >
                      <View style={styles.col}>
                        <TeslaButton
                          title="Guardar Cargo en Tarjeta"
                          onPress={() => handleCreateGroupOnCard(card.id)}
                          loading={submittingGroup}
                        />
                      </View>
                      <View style={styles.col}>
                        <TeslaButton
                          title="Cancelar"
                          variant="secondary"
                          onPress={() => setActiveCardForNewGroup(null)}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}

                {cardItems.length === 0 ? (
                  <Text style={styles.emptyCardItems}>
                    Sin servicios recurrentes activos en {formatPeriodFull(period)} para este plástico.
                  </Text>
                ) : (
                  <View style={styles.cardItemsStack}>
                    {cardItems.map((item) => {
                      const endShort = formatPeriodShort(item.end_date);
                      const progress = getInstallmentProgress(
                        item,
                        period,
                        payments,
                        card.id
                      );
                      return (
                        <View key={item.id} style={styles.parentItemBox}>
                          <View style={styles.parentItemHeader}>
                            <View style={styles.parentItemInfoCol}>
                              <View style={styles.parentItemTitleRow}>
                                <Text style={styles.parentItemTitle}>{item.title}</Text>
                                <View
                                  style={[
                                    styles.categoryMiniBadge,
                                    {
                                      backgroundColor: `${getCategoryColor(item.category || 'general')}20`,
                                      borderColor: `${getCategoryColor(item.category || 'general')}50`,
                                    },
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.categoryMiniDot,
                                      { backgroundColor: getCategoryColor(item.category || 'general') },
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.categoryMiniText,
                                      { color: getCategoryColor(item.category || 'general') },
                                    ]}
                                  >
                                    {getCategoryLabel(item.category || 'general')}
                                  </Text>
                                </View>
                                {progress ? (
                                  <View style={styles.installmentProgressPill}>
                                    <Text style={styles.installmentProgressPillText}>
                                      Cuota {progress.currentInstallmentNumber}/
                                      {progress.totalInstallments}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              <View style={styles.parentItemMetaRow}>
                                <Clock size={11} color={colors.textSecondary} />
                                <Text style={styles.parentItemValidityText}>
                                  {progress
                                    ? `${formatPeriodShort(progress.startPeriod)} → ${formatPeriodShort(progress.endPeriod)}`
                                    : endShort
                                      ? `Hasta ${endShort} (${item.start_date ? `${formatPeriodShort(item.start_date)} → ` : ''}${endShort})`
                                      : `Desde ${formatPeriodShort(item.start_date)} · Permanente`}
                                </Text>
                                {item.sub_items.length > 0 ? (
                                  <Text style={styles.parentItemSubtitle}>
                                    · {item.sub_items.length} sub-servicios anidados
                                  </Text>
                                ) : null}
                              </View>

                              {progress ? (
                                <Text style={styles.itemCardQuotaMeta}>
                                  Total compra: {formatCLP(progress.totalPurchaseAmount)} · Comprometido en cupo:{' '}
                                  {formatCLP(progress.committedAmount)}
                                  {progress.recoveredAmount > 0
                                    ? ` · Recuperado: +${formatCLP(progress.recoveredAmount)}`
                                    : ''}
                                </Text>
                              ) : null}
                            </View>

                            <View style={styles.parentItemRight}>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.parentItemAmount}>
                                  {formatCLP(progress ? progress.installmentAmount : item.amount)}
                                </Text>
                                {progress ? (
                                  <Text style={styles.parentItemQuotaSuffix}>
                                    cuota / mes
                                  </Text>
                                ) : null}
                              </View>
                              <View style={styles.parentItemActionBtns}>
                                <Pressable
                                  onPress={() =>
                                    setActiveParentForSub(
                                      activeParentForSub === item.id ? null : item.id
                                    )
                                  }
                                  style={styles.subAddTrigger}
                                >
                                  <Plus size={12} color={colors.textPrimary} />
                                  <Text style={styles.subAddTriggerText}>Sub-ítem</Text>
                                </Pressable>
                                {onUpdateRecurringItem ? (
                                  <Pressable
                                    onPress={() =>
                                      editingChargeId === item.id
                                        ? closeEditCharge()
                                        : openEditCharge(item)
                                    }
                                    style={styles.editChargeTrigger}
                                  >
                                    <Pencil
                                      size={13}
                                      color={
                                        editingChargeId === item.id
                                          ? colors.textPrimary
                                          : colors.textSecondary
                                      }
                                    />
                                  </Pressable>
                                ) : null}
                                {onDeleteRecurringItem ? (
                                  <Pressable
                                    onPress={() => onDeleteRecurringItem(item.id)}
                                    style={styles.deleteChargeTrigger}
                                  >
                                    <Trash2 size={13} color={colors.textMuted} />
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                          </View>

                          {/* Formulario inline para editar el cargo */}
                          {editingChargeId === item.id ? (
                            <View style={styles.inlineEditChargeBox}>
                              <View style={styles.inlineEditHeader}>
                                <Pencil size={13} color={colors.textPrimary} />
                                <Text style={styles.inlineEditHeaderTitle}>
                                  EDITAR GASTO EN TARJETA
                                </Text>
                              </View>

                              {editChargeError ? (
                                <Text style={styles.errorText}>{editChargeError}</Text>
                              ) : null}

                              {renderChargeScheduleForm({
                                chargeMode: editChargeMode,
                                onChangeChargeMode: setEditChargeMode,
                                amountInputMode: editAmountInputMode,
                                onChangeAmountInputMode: setEditAmountInputMode,
                                title: editChargeTitle,
                                onChangeTitle: setEditChargeTitle,
                                titleLabel: 'Nombre del Cargo',
                                titlePlaceholder: 'Ej. Notebook, Netflix, Cena',
                                amount: editChargeAmount,
                                onChangeAmount: setEditChargeAmount,
                                recurringAmountLabel: 'Monto Mensual (CLP)',
                                category: editChargeCategory,
                                onChangeCategory: setEditChargeCategory,
                                installmentsCount: editChargeInstallments,
                                onChangeInstallmentsCount: setEditChargeInstallments,
                                customInstallments: editChargeCustomInstallments,
                                onChangeCustomInstallments:
                                  setEditChargeCustomInstallments,
                                startDate: editChargeStartDate,
                                onChangeStartDate: setEditChargeStartDate,
                                endDate: editChargeEndDate,
                                onChangeEndDate: setEditChargeEndDate,
                                installmentPreview: editInstallmentPreview,
                                onSelectInstallmentCount:
                                  handleSelectEditInstallmentCount,
                                onSelectRecurringPreset:
                                  handleSelectEditRecurringPreset,
                              })}

                              <View
                                style={[
                                  styles.twoCol,
                                  !isDesktop && styles.twoColMobile,
                                  { marginTop: 4 },
                                ]}
                              >
                                <View style={styles.col}>
                                  <TeslaButton
                                    title={
                                      savingEditCharge
                                        ? 'Guardando...'
                                        : 'Guardar Cambios'
                                    }
                                    onPress={handleSaveEditCharge}
                                    loading={savingEditCharge}
                                  />
                                </View>
                                <View style={styles.col}>
                                  <TeslaButton
                                    title="Cancelar"
                                    variant="secondary"
                                    onPress={closeEditCharge}
                                  />
                                </View>
                              </View>
                            </View>
                          ) : null}

                          {/* Lista de Sub-ítems Anidados (ej. Apple + YouTube + SmartFit) */}
                          {item.sub_items.length > 0 ? (
                            <View style={styles.subItemsList}>
                              {item.sub_items.map((sub) => (
                                <View key={sub.id} style={styles.subItemRow}>
                                  <View style={styles.subItemDot} />
                                  <Text style={styles.subItemName}>{sub.name}</Text>
                                  <Text style={styles.subItemAmount}>
                                    {formatCLP(sub.amount)}
                                  </Text>
                                  <Pressable
                                    onPress={() => onRemoveSubItem(item.id, sub.id)}
                                    style={styles.subDeleteBtn}
                                  >
                                    <X size={13} color={colors.textMuted} />
                                  </Pressable>
                                </View>
                              ))}
                            </View>
                          ) : null}

                          {/* Formulario inline para agregar sub-ítem anidado */}
                          {activeParentForSub === item.id ? (
                            <View style={styles.subFormBox}>
                              <View
                                style={[
                                  styles.twoCol,
                                  !isDesktop && styles.twoColMobile,
                                ]}
                              >
                                <View style={styles.col}>
                                  <GlassInput
                                    label="Sub-ítem (ej. Apple, YouTube, SmartFit)"
                                    placeholder="Ej. Apple One"
                                    value={subName}
                                    onChangeText={setSubName}
                                  />
                                </View>
                                <View style={styles.col}>
                                  <GlassInput
                                    label="Monto (CLP)"
                                    placeholder="Ej. 14990"
                                    keyboardType="numeric"
                                    value={subAmount}
                                    onChangeText={setSubAmount}
                                  />
                                </View>
                              </View>
                              <TeslaButton
                                title="Agregar al Desglose"
                                onPress={() => handleAddSub(item.id)}
                                loading={submittingSub}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </GlassCard>
            );
          })}
        </View>
      )}

      {/* Otras Cuentas Bancarias (Corriente / Vista) */}
      {otherAccounts.length > 0 ? (
        <GlassCard>
          <Text style={styles.breakdownTitle}>
            CUENTAS BANCARIAS DE DÉBITO / CORRIENTES
          </Text>
          <View style={styles.otherAccountsList}>
            {otherAccounts.map((acc) => (
              <View key={acc.id} style={styles.otherAccountRow}>
                <View style={styles.parentItemInfoCol}>
                  <Text style={styles.parentItemTitle}>{acc.name}</Text>
                  <Text style={styles.parentItemSubtitle}>
                    {acc.type === 'checking'
                      ? 'Cuenta Corriente / Vista'
                      : 'Cuenta'}
                  </Text>
                </View>
                <View style={styles.parentItemRight}>
                  <Text style={styles.parentItemAmount}>
                    {formatCLP(acc.current_balance)}
                  </Text>
                  <Pressable
                    onPress={() => onDeleteAccount(acc.id)}
                    style={styles.iconBtn}
                  >
                    <Trash2 size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))}
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
  // =========================================================================
  // NUEVO LAYOUT ESTILO REFERENCIA (HERO AMBIENTAL + WALLET 3D + BENTO PAIR)
  // =========================================================================
  showcaseGrid: {
    width: '100%',
    flexDirection: 'column',
    gap: 16,
  },
  showcaseGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
  },
  heroColDesktop: {
    flex: 1.05,
  },
  walletColDesktop: {
    flex: 1,
  },
  heroAmbientShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#0B101B',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    justifyContent: 'space-between',
    gap: 24,
  },
  heroBackdropSvgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroTopPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  personalCapsulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    maxWidth: '62%',
  },
  personalAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalCapsuleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  heroRightBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroStatBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroStatBubbleAlert: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    borderColor: 'rgba(249, 115, 22, 0.45)',
  },
  heroStatBubbleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroRingBadge: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroRingBadgeText: {
    position: 'absolute',
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroBalanceCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroEyebrowLabel: {
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  heroPositiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  heroPositiveArrow: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  heroPositiveText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroGiantBalance: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    lineHeight: 56,
  },
  heroGiantBalanceMobile: {
    fontSize: 40,
    lineHeight: 46,
  },
  heroSubHint: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  heroCircleActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCircleActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  heroCircleActionBtnOverlap: {
    marginLeft: 0,
  },
  heroCircleActionBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  heroCircleActionLabel: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  heroCircleActionLabelActive: {
    color: '#050505',
    fontWeight: '700',
  },
  walletAndBentoCol: {
    flexDirection: 'column',
    gap: 14,
    justifyContent: 'space-between',
  },
  walletShowcaseContainer: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(15, 18, 26, 0.85)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
  },
  walletHeaderMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  walletSectionEyebrow: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  walletToggleAllPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  walletToggleAllText: {
    color: '#E2E8F0',
    fontSize: 10.5,
    fontWeight: '600',
  },
  emptyWalletPrompt: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
  },
  emptyWalletTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyWalletSub: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  walletPocketStage: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    position: 'relative',
    paddingTop: 4,
  },
  peekingCardsStack: {
    width: '92%',
    alignSelf: 'center',
    position: 'relative',
  },
  peekingCardSlice: {
    position: 'absolute',
    height: 106,
    borderRadius: 22,
    borderWidth: 1.2,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 13,
  },
  peekingCardSvgBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  peekingCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  peekingCardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  peekingCardName: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  peekingActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  peekingCardAmount: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  leatherPocketFront: {
    width: '100%',
    height: 126,
    marginTop: -54,
    zIndex: 30,
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 18,
  },
  pocketOverlayContent: {
    alignItems: 'center',
    gap: 2,
  },
  pocketSelectedLabel: {
    color: 'rgba(253, 230, 138, 0.65)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  pocketSelectedTitle: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12.5,
    fontWeight: '600',
  },
  bentoPairRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoLeftWidget: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(20, 24, 34, 0.9)',
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 136,
    gap: 8,
  },
  bentoWidgetTitle: {
    color: 'rgba(226, 232, 240, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bentoWidgetBigValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  bentoTrendBlock: {
    gap: 2,
  },
  bentoTrendBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bentoTrendWarn: {
    color: '#FB7185',
  },
  bentoTrendGood: {
    color: '#34D399',
  },
  bentoTrendSubtext: {
    color: 'rgba(148, 163, 184, 0.8)',
    fontSize: 10.5,
    lineHeight: 14,
  },
  bentoRightWidget: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(28, 32, 44, 0.92)',
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 136,
    gap: 10,
  },
  bentoRightTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  bentoCutLabelCol: {
    alignItems: 'flex-end',
    flex: 1,
  },
  bentoCutPrimaryLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bentoCutSubLabel: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  bentoRightBottomRow: {
    alignItems: 'flex-end',
    gap: 2,
  },
  bentoRightHintLabel: {
    color: 'rgba(148, 163, 184, 0.78)',
    fontSize: 10,
    fontWeight: '600',
  },
  bentoRightBigValue: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryPillBtn: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryPillBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  cardSwitchPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  cardSwitchDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  cardSwitchPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  cardSwitchPillTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardSwitchPillAmount: {
    color: colors.textPrimary,
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // =========================================================================
  // ESTILOS ORIGINALES DE DETALLE, CRUD Y DESGLOSE DE CARGOS
  // =========================================================================
  cardsListContainer: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerTextCol: {
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
  addPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  addPillBtnText: {
    color: colors.buttonPrimaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    gap: 14,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
  segmentText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  brandSelectorSection: {
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  brandSelectorTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  brandCardsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  brandCardsGridMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  brandOptionCard: {
    flex: 1,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 8,
  },
  brandOptionCardMobile: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
  },
  brandMiniPreviewWrapMobile: {
    width: 86,
    flexShrink: 0,
  },
  brandOptionFooterMobile: {
    flex: 1,
    alignItems: 'center',
  },
  brandOptionCardSelected: {
    borderColor: colors.buttonPrimaryBg,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  brandMiniPreviewWrap: {
    width: '100%',
  },
  brandOptionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  brandOptionTextCol: {
    flex: 1,
  },
  brandOptionLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  brandOptionLabelSelected: {
    color: '#FFFFFF',
  },
  brandOptionSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  brandRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRadioCircleSelected: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  livePreviewBox: {
    alignItems: 'center',
    paddingTop: 6,
    gap: 8,
  },
  livePreviewEyebrow: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  livePreviewCardHolder: {
    width: '100%',
    maxWidth: 310,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  twoColMobile: {
    flexDirection: 'column',
  },
  col: {
    flex: 1,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
  cardBlock: {
    gap: 4,
  },
  cardShowcaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  cardShowcaseRowMobile: {
    flexDirection: 'column',
    gap: 14,
  },
  plasticVisualCol: {
    width: 290,
  },
  plasticVisualColMobile: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  cardMetricsCol: {
    flex: 1,
    width: '100%',
    gap: 12,
  },
  cardMetricsColMobile: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardIdentityTextCol: {
    flex: 1,
    minWidth: 160,
    gap: 3,
  },
  cardTitleAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  brandTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardTypeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
    lineHeight: 14,
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  billingAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  billingAlertPillUrgent: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  billingAlertText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  billingAlertTextUrgent: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  actionIconChip: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 16,
  },
  quotaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quotaGridMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  quotaBoxMobile: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
    minHeight: 'auto',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  quotaPrimaryBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    minHeight: 104,
    gap: 4,
  },
  quotaSecondaryBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    minHeight: 104,
    gap: 4,
  },
  quotaLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    lineHeight: 14,
    marginBottom: 4,
  },
  quotaAvailableValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  quotaUsedValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  quotaValueMobile: {
    fontSize: 21,
    lineHeight: 27,
  },
  quotaFormulaHint: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    flexShrink: 1,
  },
  progressSection: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  progressPercent: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  breakdownTitleGroup: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedAccordionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    backgroundColor: colors.bentoCard,
  },
  collapsedAccordionText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  collapsedAccordionHint: {
    color: '#38BDF8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  breakdownTitle: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  smallGhostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  smallGhostBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  inlineBox: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 14,
    gap: 12,
  },
  inlineBoxTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCardItems: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  cardItemsStack: {
    gap: 10,
  },
  parentItemBox: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 10,
  },
  parentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  parentItemInfoCol: {
    flex: 1,
    minWidth: 140,
  },
  parentItemTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  parentItemSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  parentItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  parentItemAmount: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subAddTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  subAddTriggerText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  subItemsList: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 6,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  subItemDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.textSecondary,
  },
  subItemName: {
    flex: 1,
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: 13,
  },
  subItemAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  subDeleteBtn: {
    padding: 4,
  },
  subFormBox: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
  },
  otherAccountsList: {
    marginTop: 12,
    gap: 10,
  },
  otherAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cardExpenseFormBox: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 14,
    gap: 14,
  },
  cardExpenseFormHeader: {
    gap: 3,
  },
  cardExpenseFormSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  formSectionGroup: {
    gap: 8,
  },
  sectionTitleRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  installmentChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  installmentChipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  categoryChipDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
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
  validityHelperBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 2,
  },
  validityHelperText: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  parentItemTitleRow: {
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
  categoryMiniText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  parentItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  parentItemValidityText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  parentItemActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteChargeTrigger: {
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  editChargeTrigger: {
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  inlineEditChargeBox: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 12,
  },
  inlineEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineEditHeaderTitle: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  errorText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.82,
  },
  animatedFormCardWrapper: {
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  editingActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  editingActiveBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 180,
  },
  editingPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#34D399',
  },
  editingActiveBannerText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  editingActiveCardName: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  editingCancelBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  editingCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '600',
  },
  actionIconChipEditing: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  cardEditingIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  cardEditingIndicatorText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  quotaRecoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  quotaRecoveryBannerPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  quotaRecoveryLeft: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  quotaRecoveryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotaRecoveryTitle: {
    color: colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  quotaRecoverySub: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  quotaRecoveryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  quotaRecoveryBtnPaid: {
    backgroundColor: 'rgba(52, 211, 153, 0.24)',
    borderColor: '#34D399',
  },
  quotaRecoveryBtnText: {
    color: '#A7F3D0',
    fontSize: 11.5,
    fontWeight: '700',
  },
  quotaRecoveryBtnTextPaid: {
    color: '#ECFDF5',
  },
  chargeModeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chargeModeBtn: {
    flex: 1,
    minWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  chargeModeBtnActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.16)',
    borderColor: 'rgba(96, 165, 250, 0.55)',
  },
  chargeModeBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chargeModeBtnTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  amountInputToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountInputToggleHint: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  amountInputToggleGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  amountInputToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  amountInputToggleBtnActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderColor: 'rgba(52, 211, 153, 0.5)',
  },
  amountInputToggleText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  amountInputToggleTextActive: {
    color: '#6EE7B7',
    fontWeight: '700',
  },
  installmentPreviewBox: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'rgba(96, 165, 250, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.28)',
    gap: 3,
  },
  installmentPreviewText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  installmentPreviewSubtext: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  installmentProgressPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(96, 165, 250, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  installmentProgressPillText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
  },
  itemCardQuotaMeta: {
    color: '#93C5FD',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
  parentItemQuotaSuffix: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
  },
});
