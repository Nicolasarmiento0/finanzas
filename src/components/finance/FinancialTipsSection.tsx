import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  CreditCard,
  Flame,
  Info,
  Layers,
  Lightbulb,
  PiggyBank,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  Zap,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  AmbientHeroCard,
  FintechAddIcon,
  FintechAnalyticsIcon,
} from '@/components/ui/AmbientHeroCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrivacyToggleButton } from '@/components/ui/PrivacyToggleButton';
import { usePrivacy } from '@/context/PrivacyContext';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import { Account, RecurringItem, VariableExpense } from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { formatPeriodFull, getCurrentPeriod, shiftPeriod } from '@/lib/finance';
import {
  FinancialInsight,
  FinancialIntelligenceReport,
  generateFinancialIntelligence,
  InsightCategory,
} from '@/lib/intelligence';
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

const INSIGHT_CATEGORY_FILTERS: Array<{ key: 'all' | InsightCategory; label: string }> = [
  { key: 'all', label: 'Todos los Diagnósticos' },
  { key: 'alimentacion', label: 'Alimentación & Delivery' },
  { key: 'tarjetas', label: 'Tarjetas & Cuotas' },
  { key: 'emergencia', label: 'Fondo de Emergencia' },
  { key: 'ahorro', label: 'Ahorro & Rentabilidad' },
  { key: 'presupuesto', label: 'Presupuesto & Ratios' },
  { key: 'habitos', label: 'Suscripciones & Ocio' },
  { key: 'movilidad', label: 'Movilidad & Traslados' },
  { key: 'deudas', label: 'Bola de Nieve' },
];

const TIP_LIBRARY_FILTERS: Array<{ key: TipCategory; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'ahorro', label: 'Ahorro e Inversión' },
  { key: 'tarjetas', label: 'Tarjetas y Deudas' },
  { key: 'presupuesto', label: 'Presupuesto' },
  { key: 'emergencia', label: 'Fondo Emergencia' },
  { key: 'habitos', label: 'Suscripciones y Hábitos' },
];

interface FinancialTipsSectionProps {
  period: string;
  onChangePeriod?: (newPeriod: string) => void;
  accounts: Account[];
  recurringItems: RecurringItem[];
  variableExpenses?: VariableExpense[];
}

export function FinancialTipsSection({
  period,
  onChangePeriod,
  accounts,
  recurringItems,
  variableExpenses = [],
}: FinancialTipsSectionProps) {
  const { isMobile, isDesktop } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<'all' | InsightCategory>('all');
  const [selectedTipCategory, setSelectedTipCategory] = useState<TipCategory>('all');
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

  // Motor de Inteligencia Cuantitativo FinanzAI
  const report: FinancialIntelligenceReport = useMemo(() => {
    return generateFinancialIntelligence({
      period,
      accounts,
      recurringItems,
      variableExpenses,
    });
  }, [period, accounts, recurringItems, variableExpenses, isPrivacyEnabled]);

  // Filtrado de Insights Cuantitativos
  const filteredInsights = useMemo(() => {
    if (selectedInsightCategory === 'all') return report.insights;
    return report.insights.filter((i) => i.category === selectedInsightCategory);
  }, [report.insights, selectedInsightCategory]);

  const allTips = useMemo(
    () => [...customTips, ...BUILTIN_TIPS],
    [customTips]
  );

  const filteredTips = useMemo(() => {
    if (selectedTipCategory === 'all') return allTips;
    return allTips.filter((t) => t.category === selectedTipCategory);
  }, [allTips, selectedTipCategory]);

  // Color e icono del Score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34D399';
    if (score >= 65) return '#38BDF8';
    if (score >= 45) return '#F59E0B';
    return '#F87171';
  };

  const scoreColor = getScoreColor(report.overallScore);

  return (
    <View style={styles.container}>
      {/* Hero Ambiental: FinanzAI Diagnóstico Cuantitativo */}
      <AmbientHeroCard
        capsuleLabel={`FinanzAI Diagnóstico · ${formatPeriodFull(period)}`}
        capsuleIcon={<Sparkles size={12} color="#FFFFFF" />}
        onPressCapsule={
          onChangePeriod ? () => onChangePeriod(getCurrentPeriod()) : undefined
        }
        onPrevPeriod={
          onChangePeriod
            ? () => onChangePeriod(shiftPeriod(period, -1))
            : undefined
        }
        onNextPeriod={
          onChangePeriod
            ? () => onChangePeriod(shiftPeriod(period, 1))
            : undefined
        }
        flameCount={report.insights.length}
        flameAlert={report.overallScore < 65}
        ringPercent={report.overallScore}
        ringAlert={report.overallScore < 50}
        eyebrowLabel="Ahorro potencial identificado"
        badgeText={`Score ${report.overallScore}/100 · ${report.healthStatus}`}
        badgeArrow={report.overallScore >= 65 ? '↑' : '↓'}
        badgeNegative={report.overallScore < 50}
        heroValue={`${formatCLP(report.totalPotentialSavingsMonthlyCLP)}/mes`}
        subtitle={`Equivale a ${formatCLP(report.totalPotentialSavingsAnnualCLP)} al año canalizables a ahorro o inversión`}
        actions={[
          {
            id: 'new-rule',
            label: 'Regla',
            icon: <FintechAddIcon active={showAddForm} />,
            onPress: () => setShowAddForm((prev) => !prev),
            active: showAddForm,
          },
          {
            id: 'all-insights',
            label: 'Análisis',
            icon: <FintechAnalyticsIcon active={selectedTipCategory === 'all'} />,
            onPress: () => setSelectedTipCategory('all'),
            active: selectedTipCategory === 'all',
          },
        ]}
        footerContent={
          <View style={styles.heroFooterRow}>
            <PrivacyToggleButton />
          </View>
        }
      />

      {/* 1. Consola de Correlaciones y Reglas FinanzAI (Bento) */}
      <GlassCard>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <View style={styles.badgeRow}>
              <View style={styles.sparkleBadge}>
                <Sparkles size={12} color="#34D399" />
                <Text style={styles.sparkleBadgeText}>FINANZAI INTELLIGENCE ENGINE</Text>
              </View>
            </View>
            <Text style={styles.title}>Diagnóstico Cuantitativo Personalizado</Text>
            <Text style={styles.subtitle}>
              Algoritmo profesional que analiza el 100% de tus transacciones (ingresos, gastos fijos, tarjetas en cuotas y consumo diario) para detectar fugas de dinero y acelerar tu patrimonio en CLP.
            </Text>
          </View>

          <View style={styles.headerActionsCol}>
            <Pressable
              onPress={() => setShowAddForm((prev) => !prev)}
              style={styles.addTipButton}
            >
              <Plus size={14} color={colors.buttonPrimaryText} />
              <Text style={styles.addTipButtonText}>
                {showAddForm ? 'Cerrar Formulario' : 'Agregar Regla Personal'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.divider} />

        {/* 4 Métricas Clave de Correlación */}
        <View style={[styles.ratiosGrid, isMobile && styles.ratiosGridMobile]}>
          <View style={styles.ratioItem}>
            <Text style={styles.ratioLabel}>RIGIDEZ FIJA</Text>
            <Text
              style={[
                styles.ratioValue,
                report.keyRatios.fixedCostRatio > 65
                  ? styles.ratioValueAlert
                  : styles.ratioValueGood,
              ]}
            >
              {report.keyRatios.fixedCostRatio}%
            </Text>
            <Text style={styles.ratioSub}>
              {report.keyRatios.fixedCostRatio > 65
                ? 'Alta (>65% de ingresos)'
                : 'Saludable (<60%)'}
            </Text>
          </View>

          <View style={styles.ratioItem}>
            <Text style={styles.ratioLabel}>FONDO EMERGENCIA</Text>
            <Text
              style={[
                styles.ratioValue,
                report.keyRatios.emergencyMonths < 3
                  ? styles.ratioValueAlert
                  : styles.ratioValueGood,
              ]}
            >
              {report.keyRatios.emergencyMonths} m
            </Text>
            <Text style={styles.ratioSub}>
              {report.keyRatios.emergencyMonths >= 3
                ? 'Meta base cumplida'
                : 'Objetivo: 3 a 6 meses'}
            </Text>
          </View>

          <View style={styles.ratioItem}>
            <Text style={styles.ratioLabel}>RATIO DELIVERY / COMIDA</Text>
            <Text
              style={[
                styles.ratioValue,
                report.keyRatios.deliveryRatio >= 35
                  ? styles.ratioValueAlert
                  : styles.ratioValueGood,
              ]}
            >
              {report.keyRatios.deliveryRatio}%
            </Text>
            <Text style={styles.ratioSub}>
              {report.keyRatios.deliveryRatio >= 35
                ? 'Fuga en comida rápida'
                : 'Gasto eficiente en super'}
            </Text>
          </View>

          <View style={styles.ratioItem}>
            <Text style={styles.ratioLabel}>USO CUPO TARJETAS</Text>
            <Text
              style={[
                styles.ratioValue,
                report.keyRatios.cardUtilizationAverage > 35
                  ? styles.ratioValueAlert
                  : styles.ratioValueGood,
              ]}
            >
              {report.keyRatios.cardUtilizationAverage}%
            </Text>
            <Text style={styles.ratioSub}>
              {report.keyRatios.cardUtilizationAverage > 35
                ? 'Tensión en cupo (>30%)'
                : 'Score crediticio óptimo'}
            </Text>
          </View>
        </View>

        {/* Formulario para agregar nuevo consejo de finanzas */}
        {showAddForm ? (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              Agregar Nueva Regla o Hábito Financiero Personal
            </Text>

            <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
              <View style={styles.formCol}>
                <GlassInput
                  label="Título de la Regla"
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
              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.categoryChipsRow}>
                {TIP_LIBRARY_FILTERS.filter((c) => c.key !== 'all').map((cat) => {
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
              label="Explicación / Motivo"
              placeholder="Describe por qué esta regla te ayuda a mejorar tus finanzas..."
              value={newDescription}
              onChangeText={setNewDescription}
            />

            <GlassInput
              label="Paso a Paso Concreto"
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
                title="Guardar Regla"
                onPress={handleCreateCustomTip}
              />
            </View>
          </View>
        ) : null}
      </GlassCard>

      {/* 2. Diagnósticos Cuantitativos Detectados por el Motor */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Zap size={16} color="#34D399" />
            <Text style={styles.sectionTitle}>
              Hallazgos del Algoritmo en tus Gastos ({filteredInsights.length})
            </Text>
          </View>
        </View>

        {/* Chips de Categorías del Motor */}
        <View style={styles.categoryChipsRow}>
          {INSIGHT_CATEGORY_FILTERS.map((cat) => {
            const active = selectedInsightCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedInsightCategory(cat.key)}
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

        {/* Lista de Insights Cuantitativos */}
        {filteredInsights.length === 0 ? (
          <View style={styles.emptyInsightsBox}>
            <CheckCircle2 size={32} color="#34D399" />
            <Text style={styles.emptyInsightsTitle}>
              Sin anomalías financieras detectadas
            </Text>
            <Text style={styles.emptyInsightsSub}>
              Tus finanzas en esta categoría se encuentran bajo los parámetros recomendados para {formatPeriodFull(period)}.
            </Text>
          </View>
        ) : (
          <View style={styles.insightsStack}>
            {filteredInsights.map((insight) => {
              const isCritical = insight.tone === 'critical';
              const isWarning = insight.tone === 'warning';
              const isEmerald = insight.tone === 'emerald';

              const toneColor = isCritical
                ? '#F87171'
                : isWarning
                ? '#F59E0B'
                : isEmerald
                ? '#34D399'
                : '#38BDF8';

              return (
                <View
                  key={insight.id}
                  style={[
                    styles.insightCard,
                    isCritical && styles.insightCardCritical,
                    isWarning && styles.insightCardWarning,
                    isEmerald && styles.insightCardEmerald,
                  ]}
                >
                  <View style={styles.insightHeaderRow}>
                    <View style={styles.insightTitleBlock}>
                      <View style={styles.insightSeverityRow}>
                        <View
                          style={[
                            styles.severityPill,
                            {
                              borderColor: `${toneColor}45`,
                              backgroundColor: `${toneColor}15`,
                            },
                          ]}
                        >
                          {isCritical ? (
                            <ShieldAlert size={12} color={toneColor} />
                          ) : isWarning ? (
                            <AlertTriangle size={12} color={toneColor} />
                          ) : isEmerald ? (
                            <ShieldCheck size={12} color={toneColor} />
                          ) : (
                            <Info size={12} color={toneColor} />
                          )}
                          <Text
                            style={[
                              styles.severityPillText,
                              { color: toneColor },
                            ]}
                          >
                            {isCritical
                              ? 'ALERTA CRÍTICA'
                              : isWarning
                              ? 'OPORTUNIDAD DE MEJORA'
                              : isEmerald
                              ? 'FORTALEZA DETECTADA'
                              : 'INFORMATIVO'}
                          </Text>
                        </View>

                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText}>
                            {insight.badge}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      <Text style={styles.insightSummary}>
                        {insight.summary}
                      </Text>
                    </View>

                    {insight.potentialSavingsCLP ? (
                      <View style={styles.savingsBadgeCol}>
                        <Text style={styles.savingsBadgeLabel}>
                          AHORRO MENSUAL
                        </Text>
                        <Text style={styles.savingsBadgeValue}>
                          +{formatCLP(insight.potentialSavingsCLP)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.insightDetailText}>
                    {insight.detail}
                  </Text>

                  {/* Fila de Métricas Cuantitativas Relevantes */}
                  {insight.metrics && insight.metrics.length > 0 ? (
                    <View style={styles.metricsRow}>
                      {insight.metrics.map((m, idx) => (
                        <View key={idx} style={styles.metricItemBox}>
                          <Text style={styles.metricItemLabel}>{m.label}</Text>
                          <Text style={styles.metricItemValue}>{m.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Caja de Acción Concreta */}
                  <View style={styles.actionBox}>
                    <Target size={14} color="#34D399" />
                    <View style={styles.actionContentCol}>
                      <Text style={styles.actionHeader}>
                        PASO DE ACCIÓN RECOMENDADO
                      </Text>
                      <Text style={styles.actionText}>
                        {insight.actionStep}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>

      {/* 3. Biblioteca de Principios Financieros y Reglas Personales */}
      <GlassCard>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>
            Biblioteca de Reglas & Hábitos ({filteredTips.length})
          </Text>
          <Text style={styles.appliedCounterText}>
            {appliedTipIds.length} marcado(s) como aplicados
          </Text>
        </View>

        <View style={styles.categoryChipsRow}>
          {TIP_LIBRARY_FILTERS.map((cat) => {
            const active = selectedTipCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedTipCategory(cat.key)}
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
    minWidth: 260,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sparkleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  sparkleBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  periodPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  todayChipText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  periodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  periodBadgeText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 14,
  },
  executiveRow: {
    flexDirection: 'row',
    gap: 14,
  },
  executiveRowMobile: {
    flexDirection: 'column',
  },
  scoreBox: {
    flex: 1,
    minWidth: 200,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 8,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreLabel: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  scoreValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  scoreScale: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  potentialSavingsBox: {
    flex: 1.4,
    minWidth: 240,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    gap: 8,
  },
  savingsLabel: {
    color: '#34D399',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  savingsAmount: {
    color: '#34D399',
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  savingsUnit: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  savingsAnnualHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  savingsAnnualHighlight: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ratiosGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  ratiosGridMobile: {
    flexDirection: 'column',
  },
  ratioItem: {
    flex: 1,
    minWidth: 145,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.bentoCard,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    gap: 4,
  },
  ratioLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  ratioValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  ratioValueGood: {
    color: '#34D399',
  },
  ratioValueAlert: {
    color: '#F59E0B',
  },
  ratioSub: {
    color: colors.textMuted,
    fontSize: 10.5,
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
    marginVertical: 10,
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
    fontSize: 11.5,
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
    marginBottom: 6,
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
  emptyInsightsBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyInsightsTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyInsightsSub: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textAlign: 'center',
  },
  insightsStack: {
    gap: 12,
    marginTop: 6,
  },
  insightCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    backgroundColor: colors.bentoCard,
    gap: 12,
  },
  insightCardCritical: {
    borderColor: 'rgba(248, 113, 113, 0.38)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },
  insightCardWarning: {
    borderColor: 'rgba(245, 158, 11, 0.38)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  insightCardEmerald: {
    borderColor: 'rgba(52, 211, 153, 0.38)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  insightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  insightTitleBlock: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  insightSeverityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  severityPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  badgePillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  insightTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    flexShrink: 1,
  },
  insightSummary: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    opacity: 0.9,
  },
  savingsBadgeCol: {
    alignItems: 'flex-end',
    gap: 2,
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  savingsBadgeLabel: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  savingsBadgeValue: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  insightDetailText: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 19,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricItemBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    backgroundColor: colors.bentoCardElevated,
    gap: 2,
  },
  metricItemLabel: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metricItemValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  actionContentCol: {
    flex: 1,
    gap: 2,
  },
  actionHeader: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  filterHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  appliedCounterText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  tipsList: {
    width: '100%',
    marginTop: 8,
    gap: 12,
  },
  tipCard: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    backgroundColor: colors.bentoCard,
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
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
    flexShrink: 1,
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
