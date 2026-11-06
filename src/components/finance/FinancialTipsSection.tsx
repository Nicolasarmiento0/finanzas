import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BookmarkCheck,
  CheckCircle2,
  CreditCard,
  Lightbulb,
  PiggyBank,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import { Account, RecurringItem } from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { isItemActiveInMonth } from '@/lib/finance';
import { getStoredItem, saveStoredItem } from '@/lib/storage';
import { colors, radius } from '@/theme/tokens';

export type TipCategory =
  | 'all'
  | 'ahorro'
  | 'tarjetas'
  | 'presupuesto'
  | 'emergencia'
  | 'habitos';

export interface FinancialTip {
  id: string;
  category: Exclude<TipCategory, 'all'>;
  title: string;
  impact: string;
  description: string;
  actionStep: string;
  isCustom?: boolean;
}

const CUSTOM_TIPS_STORAGE_KEY = 'finanzapp_custom_tips_v1';
const APPLIED_TIPS_STORAGE_KEY = 'finanzapp_applied_tips_v1';

const BUILTIN_TIPS: FinancialTip[] = [
  {
    id: 'tip-1',
    category: 'ahorro',
    title: 'Págate a ti mismo primero el día de pago',
    impact: 'Alto Impacto',
    description:
      'No ahorres lo que sobra a fin de mes. Transfiere tu aporte fijo o porcentaje de superávit apenas recibas tu sueldo hacia una cuenta separada de tu cuenta corriente diaria.',
    actionStep:
      'Configura una transferencia automática el día 1 de cada mes hacia tu cuenta de ahorro rentable.',
  },
  {
    id: 'tip-2',
    category: 'ahorro',
    title: 'Separa el Fondo de Liquidez (0%) del Ahorro Rentable (4%+)',
    impact: 'Estrategia Dual',
    description:
      'El dinero para metas de muy corto plazo o gastos inmediatos puede estar a la vista, pero todo capital que no usarás en más de 30 días debería estar generando interés compuesto mensual.',
    actionStep:
      'Compara en la pestaña Ahorro cuánto interés dejas de ganar por mantener saldos altos al 0% anual.',
  },
  {
    id: 'tip-3',
    category: 'tarjetas',
    title: 'Regla del 30% de Utilización de Cupo en Tarjetas',
    impact: 'Salud Crediticia',
    description:
      'Utilizar más del 30% del cupo total de tus tarjetas de crédito eleva tu riesgo financiero y reduce tu margen de maniobra ante imprevistos.',
    actionStep:
      'Mantén la suma de tu deuda facturada y suscripciones cargadas por debajo del 30% del límite de cada plástico.',
  },
  {
    id: 'tip-4',
    category: 'tarjetas',
    title: 'Paga el Total Facturado antes del Corte (Cero Interés Rotativo)',
    impact: 'Esencial',
    description:
      'Las tarjetas de crédito en Chile tienen tasas rotativas que superan el 25%-35% anual. Pagar siempre el monto facturado completo antes de la fecha de vencimiento evita intereses.',
    actionStep:
      'Revisa la alerta de Día de Facturación en el módulo Tarjetas y agenda el pago total 2 días antes.',
  },
  {
    id: 'tip-5',
    category: 'presupuesto',
    title: 'Efecto Bola de Nieve al Terminar un Compromiso con Fecha Límite',
    impact: 'Acelerador de Riqueza',
    description:
      'Cuando un crédito vehicular, arancel o préstamo llega a su mes de término (end_date), tu estilo de vida ya estaba acostumbrado a vivir sin ese dinero.',
    actionStep:
      'Usa el modo Superávit Mensual en tu cuenta de ahorro para absorber automáticamente el 100% de las cuotas que expiran.',
  },
  {
    id: 'tip-6',
    category: 'presupuesto',
    title: 'Regla 50 / 30 / 20 adaptada a Gastos Fijos',
    impact: 'Control Mensual',
    description:
      'Idealmente, tus gastos fijos obligatorios no deben superar el 50%-60% de tu ingreso líquido mensual, dejando al menos un 20% libre para ahorro e inversión.',
    actionStep:
      'Verifica en el Resumen Ejecutivo que tu barra de Comprometido en Gastos Fijos se mantenga bajo el 60%.',
  },
  {
    id: 'tip-7',
    category: 'emergencia',
    title: 'Construye un Escudo de 3 a 6 Meses de Gastos Fijos',
    impact: 'Seguridad Total',
    description:
      'Un fondo de emergencia equivale a multiplicar tus gastos fijos mensuales por 3 (mínimo) o 6 (óptimo). Esto te protege ante cambios laborales o emergencias médicas sin endeudarte.',
    actionStep:
      'Mira tu total de Gastos Fijos del mes y multiplica por 3: esa es la meta número uno de tu fondo de liquidez.',
  },
  {
    id: 'tip-8',
    category: 'habitos',
    title: 'Auditoría Trimestral de Suscripciones Anidadas',
    impact: 'Ahorro Inmediato',
    description:
      'Pequeños cargos recurrentes (streaming, apps, gimnasios) pasan desapercibidos en la tarjeta de crédito pero sumados a 12 meses representan cientos de miles de pesos.',
    actionStep:
      'Revisa tus sub-ítems anidados cada 3 meses y pausa cualquier servicio que no hayas usado en los últimos 30 días.',
  },
];

const CATEGORY_OPTIONS: Array<{ key: TipCategory; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'ahorro', label: 'Ahorro e Inversión' },
  { key: 'tarjetas', label: 'Tarjetas y Deudas' },
  { key: 'presupuesto', label: 'Presupuesto' },
  { key: 'emergencia', label: 'Fondo Emergencia' },
  { key: 'habitos', label: 'Suscripciones y Hábitos' },
];

interface FinancialTipsSectionProps {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
}

export function FinancialTipsSection({
  period,
  accounts,
  recurringItems,
}: FinancialTipsSectionProps) {
  const { isMobile } = useResponsive();
  const [selectedCategory, setSelectedCategory] = useState<TipCategory>('all');
  const [customTips, setCustomTips] = useState<FinancialTip[]>([]);
  const [appliedTipIds, setAppliedTipIds] = useState<string[]>([]);

  // Formulario para agregar un nuevo consejo personalizado
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] =
    useState<Exclude<TipCategory, 'all'>>('ahorro');
  const [newImpact, setNewImpact] = useState('Regla Personal');
  const [newDescription, setNewDescription] = useState('');
  const [newActionStep, setNewActionStep] = useState('');

  useEffect(() => {
    getStoredItem(CUSTOM_TIPS_STORAGE_KEY)
      .then((raw: string | null) => {
        if (raw) {
          setCustomTips(JSON.parse(raw) as FinancialTip[]);
        }
      })
      .catch(() => {});

    getStoredItem(APPLIED_TIPS_STORAGE_KEY)
      .then((raw: string | null) => {
        if (raw) {
          setAppliedTipIds(JSON.parse(raw) as string[]);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleApplied = async (tipId: string) => {
    const next = appliedTipIds.includes(tipId)
      ? appliedTipIds.filter((id) => id !== tipId)
      : [...appliedTipIds, tipId];
    setAppliedTipIds(next);
    try {
      await saveStoredItem(APPLIED_TIPS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  };

  const handleCreateCustomTip = async () => {
    if (!newTitle.trim() || !newDescription.trim()) return;

    const created: FinancialTip = {
      id: `custom-${Date.now()}`,
      category: newCategory,
      title: newTitle.trim(),
      impact: newImpact.trim() || 'Regla Personal',
      description: newDescription.trim(),
      actionStep:
        newActionStep.trim() || 'Aplicar de forma constante en mi revisión mensual.',
      isCustom: true,
    };

    const updated = [created, ...customTips];
    setCustomTips(updated);
    setNewTitle('');
    setNewDescription('');
    setNewActionStep('');
    setShowAddForm(false);

    try {
      await saveStoredItem(CUSTOM_TIPS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  };

  const handleDeleteCustomTip = async (tipId: string) => {
    const updated = customTips.filter((t) => t.id !== tipId);
    setCustomTips(updated);
    try {
      await saveStoredItem(CUSTOM_TIPS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  };

  // Diagnóstico inteligente basado en los datos reales del usuario
  const smartInsights = useMemo(() => {
    const insights: Array<{
      id: string;
      title: string;
      detail: string;
      badge: string;
      tone: 'emerald' | 'neutral';
    }> = [];

    const activeItems = recurringItems.filter((item) =>
      isItemActiveInMonth(item, period)
    );
    const monthlyIncome = activeItems
      .filter((i) => i.type === 'income')
      .reduce((s, i) => s + i.amount, 0);
    const monthlyExpense = activeItems
      .filter((i) => i.type === 'expense')
      .reduce((s, i) => s + i.amount, 0);

    // 1. Meta de Fondo de Emergencia (3 a 6 meses de gastos fijos)
    if (monthlyExpense > 0) {
      const emergency3m = monthlyExpense * 3;
      const emergency6m = monthlyExpense * 6;
      const totalSavings = accounts
        .filter((a) => a.type === 'savings')
        .reduce((s, a) => s + a.current_balance, 0);

      const monthsCovered = (totalSavings / monthlyExpense).toFixed(1);
      insights.push({
        id: 'insight-emergency',
        title: `Cobertura de Fondo de Emergencia: ${monthsCovered} meses`,
        detail: `Tus gastos fijos son ${formatCLP(monthlyExpense)}/mes. Tu fondo ideal de 3 meses equivale a ${formatCLP(emergency3m)} (y 6 meses a ${formatCLP(emergency6m)}). Actualmente tienes ${formatCLP(totalSavings)} en cuentas de ahorro.`,
        badge: Number(monthsCovered) >= 3 ? 'Meta 3M Cumplida' : 'En Construcción',
        tone: Number(monthsCovered) >= 3 ? 'emerald' : 'neutral',
      });
    }

    // 2. Costo de oportunidad en cuentas al 0% vs cuenta rentable
    const zeroRateSavings = accounts
      .filter((a) => a.type === 'savings' && (a.interest_rate_annual || 0) === 0)
      .reduce((s, a) => s + a.current_balance, 0);
    const bestRate = Math.max(
      4,
      ...accounts
        .filter((a) => a.type === 'savings')
        .map((a) => Number(a.interest_rate_annual || 0))
    );

    if (zeroRateSavings > 0) {
      const potentialYearlyGain = Math.round(zeroRateSavings * (bestRate / 100));
      insights.push({
        id: 'insight-yield',
        title: 'Optimización de Interés Compuesto Detectada',
        detail: `Tienes ${formatCLP(zeroRateSavings)} en ahorro sin interés (0%). Si mantienes ese capital en una cuenta al ${bestRate}% anual, generarías aprox. ${formatCLP(potentialYearlyGain)} adicionales al año sin esfuerzo extra.`,
        badge: `+${formatCLP(potentialYearlyGain)}/año`,
        tone: 'emerald',
      });
    }

    // 3. Compromisos con fecha de término (end_date) que liberarán flujo
    const expiringExpenses = activeItems.filter(
      (i) => i.type === 'expense' && Boolean(i.end_date)
    );
    if (expiringExpenses.length > 0) {
      const totalFreed = expiringExpenses.reduce((s, e) => s + e.amount, 0);
      insights.push({
        id: 'insight-expiring',
        title: `Liberación futura de ${formatCLP(totalFreed)}/mes en cuotas`,
        detail: `Tienes ${expiringExpenses.length} compromiso(s) con fecha límite (${expiringExpenses.map((e) => `${e.title} hasta ${e.end_date}`).join(', ')}). Cuando finalicen, redirige ese flujo directamente a tu ahorro.`,
        badge: 'Efecto Bola de Nieve',
        tone: 'emerald',
      });
    }

    // 4. Relación Gastos / Ingresos
    if (monthlyIncome > 0) {
      const ratio = Math.round((monthlyExpense / monthlyIncome) * 100);
      insights.push({
        id: 'insight-ratio',
        title: `Índice de Carga Fija Mensual: ${ratio}% de tus ingresos`,
        detail:
          ratio <= 60
            ? `Excelente control: tus gastos fijos consumen el ${ratio}% de tus ingresos, dejándote un ${100 - ratio}% de flujo libre para ahorro e inversión.`
            : `Tus gastos fijos representan el ${ratio}% de tus ingresos. Te recomendamos revisar suscripciones o deudas para bajar del 60%.`,
        badge: ratio <= 60 ? 'Saludable (<60%)' : 'Atención (>60%)',
        tone: ratio <= 60 ? 'emerald' : 'neutral',
      });
    }

    return insights;
  }, [accounts, recurringItems, period]);

  const allTips = useMemo(
    () => [...customTips, ...BUILTIN_TIPS],
    [customTips]
  );

  const filteredTips = useMemo(() => {
    if (selectedCategory === 'all') return allTips;
    return allTips.filter((t) => t.category === selectedCategory);
  }, [allTips, selectedCategory]);

  return (
    <View style={styles.container}>
      {/* Cabecera y Botón para Agregar Consejo */}
      <GlassCard>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>EDUCACIÓN Y ESTRATEGIA FINANCIERA</Text>
            <Text style={styles.title}>Consejos de Finanzas & Diagnóstico</Text>
            <Text style={styles.subtitle}>
              Recomendaciones accionables calculadas sobre tus cuentas reales y biblioteca de reglas financieras personales.
            </Text>
          </View>

          <Pressable
            onPress={() => setShowAddForm((prev) => !prev)}
            style={styles.addTipButton}
          >
            <Plus size={15} color={colors.buttonPrimaryText} />
            <Text style={styles.addTipButtonText}>
              {showAddForm ? 'Cerrar Formulario' : 'Agregar Consejo'}
            </Text>
          </Pressable>
        </View>

        {/* Formulario para agregar nuevo consejo de finanzas */}
        {showAddForm ? (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              Agregar Nuevo Consejo o Regla Financiera
            </Text>

            <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
              <View style={styles.formCol}>
                <GlassInput
                  label="Título del Consejo"
                  placeholder="Ej: Transferir 15% del sueldo el día 1"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>
              <View style={styles.formCol}>
                <GlassInput
                  label="Etiqueta de Impacto"
                  placeholder="Ej: Alto Impacto / Regla Personal"
                  value={newImpact}
                  onChangeText={setNewImpact}
                />
              </View>
            </View>

            <View style={styles.categoryPickerWrap}>
              <Text style={styles.fieldLabel}>Categoría del Consejo</Text>
              <View style={styles.categoryChipsRow}>
                {CATEGORY_OPTIONS.filter((c) => c.key !== 'all').map((cat) => {
                  const active = newCategory === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() =>
                        setNewCategory(cat.key as Exclude<TipCategory, 'all'>)
                      }
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <GlassInput
              label="Explicación del Consejo"
              placeholder="Describe por qué esta regla te ayuda a mejorar tus finanzas..."
              value={newDescription}
              onChangeText={setNewDescription}
            />

            <GlassInput
              label="Acción Concreta (Paso a paso)"
              placeholder="Ej: Revisar todos los viernes el cupo disponible en la tarjeta."
              value={newActionStep}
              onChangeText={setNewActionStep}
            />

            <View style={styles.formActions}>
              <TeslaButton
                title="Cancelar"
                variant="secondary"
                onPress={() => setShowAddForm(false)}
              />
              <TeslaButton
                title="Guardar Consejo"
                onPress={handleCreateCustomTip}
              />
            </View>
          </View>
        ) : null}
      </GlassCard>

      {/* Diagnóstico Inteligente en Vivo */}
      {smartInsights.length > 0 ? (
        <GlassCard>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Sparkles size={16} color="#34D399" />
              <Text style={styles.sectionTitle}>
                Diagnóstico Personalizado para tus Cuentas ({period})
              </Text>
            </View>
          </View>

          <View style={[styles.insightsGrid, isMobile && styles.insightsGridMobile]}>
            {smartInsights.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.insightCard,
                  isMobile && styles.insightCardMobile,
                  item.tone === 'emerald' && styles.insightCardEmerald,
                ]}
              >
                <View style={styles.insightTopRow}>
                  <Text style={styles.insightTitle}>{item.title}</Text>
                  <View
                    style={[
                      styles.insightBadge,
                      item.tone === 'emerald' && styles.insightBadgeEmerald,
                    ]}
                  >
                    <Text
                      style={[
                        styles.insightBadgeText,
                        item.tone === 'emerald' && styles.insightBadgeTextEmerald,
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.insightDetail}>{item.detail}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {/* Biblioteca de Consejos Filtrable */}
      <GlassCard>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>
            Guía Práctica de Finanzas ({filteredTips.length})
          </Text>
          <Text style={styles.appliedCounterText}>
            {appliedTipIds.length} marcado(s) como aplicados
          </Text>
        </View>

        <View style={styles.categoryChipsRow}>
          {CATEGORY_OPTIONS.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tipsList}>
          {filteredTips.map((tip) => {
            const isApplied = appliedTipIds.includes(tip.id);

            return (
              <View
                key={tip.id}
                style={[styles.tipCard, isApplied && styles.tipCardApplied]}
              >
                <View style={styles.tipHeaderRow}>
                  <View style={styles.tipTitleRow}>
                    <View style={styles.tipIconBadge}>
                      {tip.category === 'ahorro' ? (
                        <PiggyBank size={15} color="#34D399" />
                      ) : tip.category === 'tarjetas' ? (
                        <CreditCard size={15} color={colors.textPrimary} />
                      ) : tip.category === 'emergencia' ? (
                        <ShieldAlert size={15} color="#34D399" />
                      ) : tip.category === 'presupuesto' ? (
                        <TrendingUp size={15} color={colors.textPrimary} />
                      ) : (
                        <Lightbulb size={15} color={colors.textPrimary} />
                      )}
                    </View>
                    <View style={styles.tipTitleCol}>
                      <Text style={styles.tipTitle}>{tip.title}</Text>
                      <View style={styles.tipMetaRow}>
                        <View style={styles.impactPill}>
                          <Text style={styles.impactPillText}>{tip.impact}</Text>
                        </View>
                        {tip.isCustom ? (
                          <View style={styles.customPill}>
                            <Text style={styles.customPillText}>Personalizado</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.tipActionsCol}>
                    <Pressable
                      onPress={() => handleToggleApplied(tip.id)}
                      style={[
                        styles.applyButton,
                        isApplied && styles.applyButtonActive,
                      ]}
                    >
                      {isApplied ? (
                        <BookmarkCheck size={14} color="#34D399" />
                      ) : (
                        <CheckCircle2 size={14} color={colors.textSecondary} />
                      )}
                      <Text
                        style={[
                          styles.applyButtonText,
                          isApplied && styles.applyButtonTextActive,
                        ]}
                      >
                        {isApplied ? 'Aplicado' : 'Marcar'}
                      </Text>
                    </Pressable>

                    {tip.isCustom ? (
                      <Pressable
                        onPress={() => handleDeleteCustomTip(tip.id)}
                        style={styles.deleteCustomBtn}
                      >
                        <Trash2 size={14} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.tipDescription}>{tip.description}</Text>

                <View style={styles.actionStepBox}>
                  <Target size={14} color="#34D399" />
                  <Text style={styles.actionStepText}>
                    <Text style={styles.actionStepBold}>Acción recomendada: </Text>
                    {tip.actionStep}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 20,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 14,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  addTipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  addTipButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  formContainer: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 14,
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formRowMobile: {
    flexDirection: 'column',
  },
  formCol: {
    flex: 1,
  },
  categoryPickerWrap: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  categoryChipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  sectionHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  insightsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  insightsGridMobile: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
  },
  insightCard: {
    flex: 1,
    minWidth: 260,
    width: '100%',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 10,
  },
  insightCardMobile: {
    flex: 0,
    width: '100%',
    minWidth: '100%',
    minHeight: 'auto',
  },
  insightCardEmerald: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  insightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
  },
  insightTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    minWidth: 160,
    lineHeight: 20,
  },
  insightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignSelf: 'flex-start',
  },
  insightBadgeEmerald: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
  },
  insightBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  insightBadgeTextEmerald: {
    color: '#34D399',
  },
  insightDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    flexShrink: 1,
  },
  filterHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  appliedCounterText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  tipsList: {
    width: '100%',
    marginTop: 16,
    gap: 14,
  },
  tipCard: {
    width: '100%',
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    gap: 12,
  },
  tipCardApplied: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
  },
  tipHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  tipIconBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tipTitleCol: {
    flex: 1,
    gap: 6,
  },
  tipTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  tipMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  impactPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  impactPillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  customPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  customPillText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  tipActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  applyButtonActive: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  applyButtonText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  applyButtonTextActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  deleteCustomBtn: {
    padding: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tipDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  actionStepBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  actionStepText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  actionStepBold: {
    fontWeight: '700',
    color: '#34D399',
  },
});
