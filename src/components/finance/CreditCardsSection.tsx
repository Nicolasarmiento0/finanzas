import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import {
  CARD_DESIGN_OPTIONS,
  CreditCardVisual,
  resolveCardBrand,
} from '@/components/finance/CreditCardVisual';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Account,
  AccountType,
  CardBrand,
  CreateAccountInput,
  CreateRecurringItemInput,
  RecurringItem,
  UpdateAccountInput,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import {
  calculateCreditCardMetrics,
  formatPeriodFull,
  formatPeriodShort,
  getCategoryColor,
  isItemActiveInMonth,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

const SUGGESTED_NAMES = new Set([
  '',
  'Tarjeta Santander',
  'CMR Falabella',
  'Tarjeta de Crédito',
]);

const INSTALLMENT_PRESETS = [
  { label: '1 Mes (Contado)', months: 1 },
  { label: '3 Cuotas', months: 3 },
  { label: '6 Cuotas', months: 6 },
  { label: '12 Cuotas', months: 12 },
  { label: '24 Cuotas', months: 24 },
  { label: 'Permanente', months: 0 },
];

const CARD_CHARGE_CATEGORIES = [
  'suscripciones',
  'tecnologia',
  'transporte',
  'salud',
  'prestamo',
  'servicios',
  'fijo',
  'general',
];

interface CreditCardsSectionProps {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
  onCreateAccount: (input: CreateAccountInput) => Promise<void>;
  onUpdateAccount?: (id: string, input: UpdateAccountInput) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateRecurringItem: (input: CreateRecurringItemInput) => Promise<void>;
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
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateRecurringItem,
  onDeleteRecurringItem,
  onAddSubItem,
  onRemoveSubItem,
}: CreditCardsSectionProps) {
  const { isDesktop } = useResponsive();

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

  // Estado para agregar un paquete/gasto matriz directamente a una tarjeta (con temporalidad y cuotas)
  const [activeCardForNewGroup, setActiveCardForNewGroup] = useState<
    string | null
  >(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupAmount, setGroupAmount] = useState('');
  const [groupCategory, setGroupCategory] = useState('suscripciones');
  const [groupStartDate, setGroupStartDate] = useState(period);
  const [groupEndDate, setGroupEndDate] = useState('');
  const [groupInstallments, setGroupInstallments] = useState<number | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupErrorMsg, setGroupErrorMsg] = useState<string | null>(null);

  const handleSelectPreset = (months: number) => {
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
      setActiveCardForNewGroup(cardId);
      setGroupTitle('');
      setGroupAmount('');
      setGroupCategory('suscripciones');
      setGroupStartDate(period);
      setGroupEndDate('');
      setGroupInstallments(null);
      setGroupErrorMsg(null);
    }
  };

  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const otherAccounts = accounts.filter(
    (a) => a.type !== 'credit_card' && a.type !== 'loan'
  );

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
    const amountNum = parseInt(groupAmount.replace(/\D/g, ''), 10) || 0;
    setSubmittingGroup(true);
    setGroupErrorMsg(null);
    try {
      await onCreateRecurringItem({
        account_id: cardId,
        title: groupTitle.trim(),
        amount: amountNum,
        type: 'expense',
        category: groupCategory.trim() || 'suscripciones',
        start_date: groupStartDate.trim() || period,
        end_date: groupEndDate.trim() ? groupEndDate.trim() : null,
        is_active: true,
      });
      setGroupTitle('');
      setGroupAmount('');
      setGroupCategory('suscripciones');
      setGroupStartDate(period);
      setGroupEndDate('');
      setGroupInstallments(null);
      setActiveCardForNewGroup(null);
    } catch (err: any) {
      setGroupErrorMsg(err?.message || 'Error al guardar el cargo en la tarjeta');
    } finally {
      setSubmittingGroup(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabecera de la sección */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.sectionTitle}>
            Tarjetas de Crédito y Manejo de Cupos
          </Text>
          <Text style={styles.sectionSubtitle}>
            Tus plásticos personalizados con cupo disponible en tiempo real ({formatPeriodFull(period)})
          </Text>
        </View>
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

      {/* Formulario para Crear o Editar Tarjeta con Selector Visual de Diseño */}
      {showNewCardModal ? (
        <GlassCard style={styles.formCard}>
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
                      <View style={styles.brandMiniPreviewWrap}>
                        <CreditCardVisual brand={option.id} compact />
                      </View>

                      <View style={styles.brandOptionFooter}>
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
      ) : null}

      {/* Listado de Tarjetas de Crédito con su Diseño Visual Fiel */}
      {creditCards.length === 0 ? (
        <GlassCard>
          <Text style={styles.emptyText}>
            No tienes tarjetas de crédito registradas aún. Toca "Nueva Tarjeta / Cuenta" arriba para elegir entre Santander, CMR Falabella u Otra.
          </Text>
        </GlassCard>
      ) : (
        creditCards.map((card) => {
          const brand = resolveCardBrand(card);
          const brandMeta =
            CARD_DESIGN_OPTIONS.find((o) => o.id === brand) ||
            CARD_DESIGN_OPTIONS[2];

          const cardItems = recurringItems.filter(
            (item) =>
              item.account_id === card.id &&
              item.type === 'expense' &&
              isItemActiveInMonth(item, period)
          );
          const metrics = calculateCreditCardMetrics(card, cardItems, period);

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
                <View style={styles.cardMetricsCol}>
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
                          onPress={() => openEditCardModal(card)}
                          style={styles.actionIconChip}
                        >
                          <Pencil size={14} color={colors.textSecondary} />
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

                  {/* Métricas de Cupo: Cupo Disponible = Cupo Total - Monto Facturado/Utilizado */}
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
                        Cupo Total ({formatCLP(metrics.creditLimit)}) − Utilizado (
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
                        MONTO FACTURADO / UTILIZADO
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
                        Recurrentes mes: {formatCLP(metrics.recurringCharges)} ·
                        Base: {formatCLP(metrics.baseBalance)}
                      </Text>
                    </View>
                  </View>

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
                                  ? '#8B5CF6'
                                  : colors.buttonPrimaryBg,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Desglose por Tarjeta y Servicios Anidados */}
              <View style={styles.breakdownHeader}>
                <View style={styles.breakdownTitleGroup}>
                  <Layers size={15} color={colors.textSecondary} />
                  <Text style={styles.breakdownTitle}>
                    SERVICIOS Y CARGOS ASOCIADOS A {card.name.toUpperCase()}
                  </Text>
                </View>

                <Pressable
                  onPress={() => toggleNewGroupForCard(card.id)}
                  style={styles.smallGhostBtn}
                >
                  <Plus size={13} color={colors.textPrimary} />
                  <Text style={styles.smallGhostBtnText}>
                    {activeCardForNewGroup === card.id ? 'Cerrar Formulario' : 'Agregar Cargo / Cuotas'}
                  </Text>
                </Pressable>
              </View>

              {activeCardForNewGroup === card.id ? (
                <View style={styles.cardExpenseFormBox}>
                  <View style={styles.cardExpenseFormHeader}>
                    <Text style={styles.inlineBoxTitle}>
                      Nuevo Cargo o Cuota en {card.name}
                    </Text>
                    <Text style={styles.cardExpenseFormSubtitle}>
                      Ingresa el monto, categoría y la vigencia temporal o número de cuotas
                    </Text>
                  </View>

                  {/* Campos Principales: Glosa y Monto */}
                  <View style={[styles.twoCol, !isDesktop && styles.twoColMobile]}>
                    <View style={styles.col}>
                      <GlassInput
                        label="Glosa / Compra (ej. Cuotas Celular, Netflix, Seguro)"
                        placeholder="Ej. Cuotas Celular"
                        value={groupTitle}
                        onChangeText={setGroupTitle}
                      />
                    </View>
                    <View style={styles.col}>
                      <GlassInput
                        label="Monto Mensual CLP (0 si sumarás sub-ítems)"
                        placeholder="Ej. 25000"
                        keyboardType="numeric"
                        value={groupAmount}
                        onChangeText={setGroupAmount}
                      />
                    </View>
                  </View>

                  {/* Categoría */}
                  <View style={styles.formSectionGroup}>
                    <Text style={styles.fieldSectionLabel}>CATEGORÍA</Text>
                    <View style={styles.chipsWrap}>
                      {CARD_CHARGE_CATEGORIES.map((cat) => {
                        const selected = groupCategory.toLowerCase() === cat;
                        const catColor = getCategoryColor(cat);
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => setGroupCategory(cat)}
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

                  {/* Plazo y Cuotas (¿Por cuánto tiempo?) */}
                  <View style={styles.formSectionGroup}>
                    <View style={styles.sectionTitleRowWithIcon}>
                      <Clock size={13} color={colors.textSecondary} />
                      <Text style={styles.fieldSectionLabel}>
                        PLAZO Y CUOTAS (¿POR CUÁNTO TIEMPO?)
                      </Text>
                    </View>

                    {/* Presets de Cuotas */}
                    <View style={styles.chipsWrap}>
                      {INSTALLMENT_PRESETS.map((preset) => {
                        const isSelected = groupInstallments === preset.months;
                        return (
                          <Pressable
                            key={preset.label}
                            onPress={() => handleSelectPreset(preset.months)}
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

                    {/* Inputs de Mes Inicio y Mes Término */}
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
                          value={groupStartDate}
                          onChangeText={(text) => {
                            setGroupStartDate(text);
                            setGroupInstallments(null);
                          }}
                        />
                      </View>
                      <View style={styles.col}>
                        <GlassInput
                          label="Mes Término Opcional (YYYY-MM)"
                          placeholder="Vacío = Permanente"
                          value={groupEndDate}
                          onChangeText={(text) => {
                            setGroupEndDate(text);
                            setGroupInstallments(null);
                          }}
                        />
                      </View>
                    </View>

                    {/* Helper text de Vigencia */}
                    <View style={styles.validityHelperBox}>
                      <Text style={styles.validityHelperText}>
                        {groupEndDate.trim()
                          ? `Cargo activo desde ${formatPeriodFull(groupStartDate || period)} hasta ${formatPeriodFull(groupEndDate)}`
                          : `Cargo recurrente continuo todos los meses a partir de ${formatPeriodFull(groupStartDate || period)}`}
                      </Text>
                    </View>
                  </View>

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
                                  {(item.category || 'GENERAL').toUpperCase()}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.parentItemMetaRow}>
                              <Clock size={11} color={colors.textSecondary} />
                              <Text style={styles.parentItemValidityText}>
                                {endShort
                                  ? `Hasta ${endShort} (${item.start_date ? `${formatPeriodShort(item.start_date)} → ` : ''}${endShort})`
                                  : `Desde ${formatPeriodShort(item.start_date)} · Permanente`}
                              </Text>
                              {item.sub_items.length > 0 ? (
                                <Text style={styles.parentItemSubtitle}>
                                  · {item.sub_items.length} sub-servicios anidados
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.parentItemRight}>
                            <Text style={styles.parentItemAmount}>
                              {formatCLP(item.amount)}
                            </Text>
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
            </GlassCard>
          );
        })
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
    flex: 0,
    width: '100%',
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
    flex: 0,
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
  errorText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.82,
  },
});
