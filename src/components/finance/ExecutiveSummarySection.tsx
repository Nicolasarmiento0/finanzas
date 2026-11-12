import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileSpreadsheet,
  Landmark,
  Pencil,
  PieChart,
  PiggyBank,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  AmbientHeroCard,
  FintechCheckIcon,
  FintechExportIcon,
  FintechGoalsIcon,
  FintechWalletIcon,
} from '@/components/ui/AmbientHeroCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Account,
  CreateAccountInput,
  RecurringItem,
  UpdateAccountInput,
  VariableExpense,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { usePrivacy } from '@/context/PrivacyContext';
import {
  exportForecastReportToCsv,
  exportMonthlyReportToCsv,
} from '@/lib/exportCsv';
import {
  calculateProjectedPosition,
  formatPeriodFull,
  getCategoryColor,
  getCategoryLabel,
  getCurrentPeriod,
  isItemActiveInMonth,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

interface ExecutiveSummarySectionProps {
  period: string;
  onChangePeriod: (newPeriod: string) => void;
  accounts: Account[];
  recurringItems: RecurringItem[];
  paidItemIdsInPeriod: Set<string>;
  variableExpenses?: VariableExpense[];
  onNavigateTab: (tab: 'wallet' | 'fixed' | 'cards' | 'savings') => void;
}

export function ExecutiveSummarySection({
  period,
  onChangePeriod,
  accounts,
  recurringItems,
  paidItemIdsInPeriod,
  variableExpenses,
  onNavigateTab,
}: ExecutiveSummarySectionProps) {
  const { isMobile } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();

  // Estado de exportación CSV/Excel
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportingMonth, setExportingMonth] = useState(false);
  const [exportingForecast, setExportingForecast] = useState(false);
  const [forecastExportMonths, setForecastExportMonths] = useState<number>(12);

  // Ítems recurrentes activos en el mes seleccionado
  const activeItems = useMemo(
    () => recurringItems.filter((item) => isItemActiveInMonth(item, period)),
    [recurringItems, period]
  );

  const activeIncomes = useMemo(
    () => activeItems.filter((item) => item.type === 'income'),
    [activeItems]
  );
  const activeExpenses = useMemo(
    () => activeItems.filter((item) => item.type === 'expense'),
    [activeItems]
  );

  // Flujo de Caja Libre Mensual Estimado
  const monthlyIncome = useMemo(
    () => activeIncomes.reduce((sum, i) => sum + i.amount, 0),
    [activeIncomes]
  );
  const monthlyExpense = useMemo(
    () => activeExpenses.reduce((sum, e) => sum + e.amount, 0),
    [activeExpenses]
  );
  const monthlyFreeCash = monthlyIncome - monthlyExpense;
  const expenseRatioPercent =
    monthlyIncome > 0
      ? Math.min(100, Math.round((monthlyExpense / monthlyIncome) * 100))
      : 0;
  const savingsCapacityPercent =
    monthlyIncome > 0 && monthlyFreeCash > 0
      ? Math.round((monthlyFreeCash / monthlyIncome) * 100)
      : 0;

  const paidExpensesCount = useMemo(
    () => activeExpenses.filter((e) => paidItemIdsInPeriod.has(e.id)).length,
    [activeExpenses, paidItemIdsInPeriod]
  );

  // 3. Distribución de Gastos por Categoría
  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; amount: number; count: number; items: string[] }
    >();

    for (const exp of activeExpenses) {
      const rawKey = (exp.category || 'general').trim().toLowerCase();
      const current = map.get(rawKey) ?? {
        key: rawKey,
        label: getCategoryLabel(rawKey),
        amount: 0,
        count: 0,
        items: [],
      };
      current.amount += exp.amount;
      current.count += 1;
      current.items.push(exp.title);
      map.set(rawKey, current);
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    return sorted.map((cat, idx) => ({
      ...cat,
      percent:
        monthlyExpense > 0
          ? Number(((cat.amount / monthlyExpense) * 100).toFixed(1))
          : 0,
      color: getCategoryColor(cat.key, idx),
    }));
  }, [activeExpenses, monthlyExpense]);

  // Handlers de Exportación CSV / Excel
  const handleExportMonth = async () => {
    setExportingMonth(true);
    setExportStatus(null);
    try {
      const filename = await exportMonthlyReportToCsv({
        period,
        accounts,
        recurringItems,
        paidItemIdsInPeriod,
        variableExpenses,
      });
      setExportStatus(`Reporte mensual exportado: ${filename}`);
    } finally {
      setExportingMonth(false);
    }
  };

  const handleExportForecast = async () => {
    setExportingForecast(true);
    setExportStatus(null);
    try {
      const filename = await exportForecastReportToCsv({
        period,
        monthsAhead: forecastExportMonths,
        accounts,
        recurringItems,
      });
      setExportStatus(`Pronóstico a ${forecastExportMonths} meses exportado: ${filename}`);
    } finally {
      setExportingForecast(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* =====================================================================
          HERO AMBIENTAL: OPERATIVA DEL MES Y FLUJO DE CAJA LIBRE
         ===================================================================== */}
      <AmbientHeroCard
        capsuleLabel={`Operativa · ${formatPeriodFull(period)}`}
        capsuleIcon={<PieChart size={12} color="#FFFFFF" />}
        onPressCapsule={() => onChangePeriod(getCurrentPeriod())}
        onPrevPeriod={() => onChangePeriod(shiftPeriod(period, -1))}
        onNextPeriod={() => onChangePeriod(shiftPeriod(period, 1))}
        flameCount={`${paidExpensesCount}/${activeExpenses.length}`}
        flameAlert={paidExpensesCount < activeExpenses.length}
        onPressFlame={() => onNavigateTab('fixed')}
        ringPercent={savingsCapacityPercent}
        ringAlert={monthlyFreeCash < 0}
        eyebrowLabel="Flujo de caja libre estimado"
        badgeText={`${savingsCapacityPercent}% disponible`}
        badgeArrow={monthlyFreeCash >= 0 ? '↑' : '↓'}
        badgeNegative={monthlyFreeCash < 0}
        heroValue={formatCLP(monthlyFreeCash)}
        subtitle={`Ingresos fijos ${formatCLP(monthlyIncome)} · Gastos fijos ${formatCLP(monthlyExpense)}`}
        actions={[
          {
            id: 'fixed',
            label: 'Checklist',
            icon: <FintechCheckIcon />,
            onPress: () => onNavigateTab('fixed'),
          },
          {
            id: 'wallet',
            label: 'Billetera',
            icon: <FintechWalletIcon />,
            onPress: () => onNavigateTab('wallet'),
          },
          {
            id: 'savings',
            label: 'Metas',
            icon: <FintechGoalsIcon />,
            onPress: () => onNavigateTab('savings'),
          },
          {
            id: 'export',
            label: exportingMonth ? 'CSV...' : 'Reporte',
            icon: <FintechExportIcon />,
            onPress: handleExportMonth,
            disabled: exportingMonth,
          },
        ]}
        onPressOrb={() => onNavigateTab('cards')}
      />

      {/* =====================================================================
          OPERATIVA DEL MES: FLUJO DE CAJA LIBRE MENSUAL ESTIMADO
         ===================================================================== */}
      <GlassCard>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionEyebrow}>OPERATIVA DEL MES ({period})</Text>
            <Text style={styles.sectionTitle}>Flujo de Caja Libre Mensual Estimado</Text>
          </View>
          <Pressable
            onPress={() => onNavigateTab('fixed')}
            style={styles.linkPillBtn}
          >
            <Text style={styles.linkPillBtnText}>Ir a Checklist Fijos</Text>
          </Pressable>
        </View>

        <View style={[styles.cashFlowGrid, isMobile && styles.cashFlowGridMobile]}>
          <View style={[styles.cashFlowBox, isMobile && styles.cashFlowBoxMobile]}>
            <View style={styles.cashFlowIconRow}>
              <ArrowUpRight size={15} color="#34D399" />
              <Text style={styles.cashFlowLabel}>INGRESOS FIJOS ACTIVOS</Text>
            </View>
            <Text style={styles.cashFlowValue}>{formatCLP(monthlyIncome)}</Text>
            <Text style={styles.cashFlowSub}>
              {activeIncomes.length} fuente(s) de ingreso en {period}
            </Text>
          </View>

          <View style={[styles.cashFlowBox, isMobile && styles.cashFlowBoxMobile]}>
            <View style={styles.cashFlowIconRow}>
              <ArrowDownRight size={15} color={colors.textSecondary} />
              <Text style={styles.cashFlowLabel}>GASTOS FIJOS ACTIVOS</Text>
            </View>
            <Text style={styles.cashFlowValue}>-{formatCLP(monthlyExpense)}</Text>
            <Text style={styles.cashFlowSub}>
              {paidExpensesCount} de {activeExpenses.length} pagados este mes
            </Text>
          </View>

          <View
            style={[
              styles.cashFlowBox,
              styles.cashFlowBoxHighlight,
              isMobile && styles.cashFlowBoxMobile,
            ]}
          >
            <View style={styles.cashFlowIconRow}>
              <Sparkles size={15} color={colors.textPrimary} />
              <Text style={styles.cashFlowLabel}>FLUJO DE CAJA LIBRE</Text>
            </View>
            <Text
              style={[
                styles.cashFlowValueLarge,
                monthlyFreeCash < 0 && { color: '#F87171' },
              ]}
            >
              {formatCLP(monthlyFreeCash)}
            </Text>
            <Text style={styles.cashFlowSub}>
              {savingsCapacityPercent > 0
                ? `${savingsCapacityPercent}% del ingreso queda libre para ahorro/inversión`
                : 'Sin margen libre en este período'}
            </Text>
          </View>
        </View>

        {/* Barra de Proporción Ingresos vs. Gastos */}
        <View style={styles.ratioBarSection}>
          <View style={styles.ratioBarLabels}>
            <Text style={styles.ratioBarLabelText}>
              Comprometido en Gastos Fijos: {expenseRatioPercent}%
            </Text>
            <Text style={styles.ratioBarLabelText}>
              Disponible Libre: {Math.max(0, 100 - expenseRatioPercent)}%
            </Text>
          </View>
          <View style={styles.ratioTrack}>
            <View
              style={[
                styles.ratioFillExpense,
                { width: `${Math.min(100, expenseRatioPercent)}%` },
              ]}
            />
          </View>
        </View>
      </GlassCard>

      {/* =====================================================================
          TAREA 4.1: GRÁFICO DE DISTRIBUCIÓN DE GASTOS POR CATEGORÍA
         ===================================================================== */}
      <GlassCard>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionEyebrow}>ANÁLISIS DE COMPOSICIÓN</Text>
            <Text style={styles.sectionTitle}>
              Distribución de Gastos por Categoría
            </Text>
          </View>
          <View style={styles.totalExpenseBadge}>
            <PieChart size={14} color={colors.textSecondary} />
            <Text style={styles.totalExpenseBadgeText}>
              Total: {formatCLP(monthlyExpense)}
            </Text>
          </View>
        </View>

        {categoryBreakdown.length === 0 ? (
          <View style={styles.emptyCategoryBox}>
            <Text style={styles.emptyCategoryText}>
              No hay gastos fijos activos registrados para {formatPeriodFull(period)}.
            </Text>
          </View>
        ) : (
          <View style={styles.categorySectionBody}>
            {/* Barra Apilada Multicapa de Categorías */}
            <View style={styles.stackedCategoryBar}>
              {categoryBreakdown.map((cat) => (
                <View
                  key={cat.key}
                  style={[
                    styles.stackedCategorySegment,
                    {
                      flex: Math.max(cat.percent, 2),
                      backgroundColor: cat.color,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Desglose detallado con barras de progreso por categoría */}
            <View style={styles.categoryList}>
              {categoryBreakdown.map((cat) => (
                <View
                  key={cat.key}
                  style={[
                    styles.categoryItemCard,
                    { borderColor: `${cat.color}33` },
                  ]}
                >
                  <View style={styles.categoryItemHeader}>
                    <View style={styles.categoryNameRow}>
                      <View
                        style={[
                          styles.categoryDot,
                          {
                            backgroundColor: cat.color,
                            shadowColor: cat.color,
                            shadowOpacity: 0.8,
                            shadowRadius: 5,
                          },
                        ]}
                      />
                      <View style={styles.categoryTitleCol}>
                        <Text style={styles.categoryNameText}>{cat.label}</Text>
                        <Text style={styles.categoryItemsPreview} numberOfLines={1}>
                          {cat.count} ítem(s): {cat.items.join(', ')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.categoryNumbersCol}>
                      <Text style={styles.categoryAmountText}>
                        {formatCLP(cat.amount)}
                      </Text>
                      <View
                        style={[
                          styles.categoryPercentPill,
                          {
                            backgroundColor: `${cat.color}1E`,
                            borderColor: `${cat.color}50`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryPercentText,
                            { color: cat.color },
                          ]}
                        >
                          {cat.percent}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.categoryProgressTrack}>
                    <View
                      style={[
                        styles.categoryProgressFill,
                        {
                          width: `${Math.max(cat.percent, 2)}%`,
                          backgroundColor: cat.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </GlassCard>

      {/* =====================================================================
          TAREA 4.2: EXPORTACIÓN Y RESPALDOS A EXCEL / CSV
         ===================================================================== */}
      <GlassCard>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionEyebrow}>REPORTERÍA Y RESPALDO DE DATOS</Text>
            <Text style={styles.sectionTitle}>Exportar a Excel / CSV</Text>
          </View>
          <View style={styles.csvFormatBadge}>
            <FileSpreadsheet size={14} color="#34D399" />
            <Text style={styles.csvFormatBadgeText}>UTF-8 Excel (.CSV)</Text>
          </View>
        </View>

        <Text style={styles.exportDescription}>
          Descarga tus hojas de control listas para abrir en Microsoft Excel, Google Sheets o Numbers con columnas separadas y formato en Pesos Chilenos (CLP).
        </Text>

        <View style={[styles.exportCardsGrid, isMobile && styles.exportCardsGridMobile]}>
          {/* Opción 1: Exportar Mes Actual */}
          <View style={[styles.exportOptionCard, isMobile && styles.exportOptionCardMobile]}>
            <View style={styles.exportOptionHeader}>
              <Download size={16} color={colors.textPrimary} />
              <Text style={styles.exportOptionTitle}>
                Reporte Mensual ({formatPeriodFull(period)})
              </Text>
            </View>
            <Text style={styles.exportOptionDesc}>
              Incluye Patrimonio Neto, listado de cuentas, distribución por categoría y estado de pago (Pagado / Pendiente) de cada ítem y sub-ítem del mes.
            </Text>
            <TeslaButton
              title="Exportar Mes a Excel / CSV"
              onPress={handleExportMonth}
              loading={exportingMonth}
            />
          </View>

          {/* Opción 2: Exportar Pronóstico de Ahorro */}
          <View style={[styles.exportOptionCard, isMobile && styles.exportOptionCardMobile]}>
            <View style={styles.exportOptionHeader}>
              <TrendingUp size={16} color="#34D399" />
              <Text style={styles.exportOptionTitle}>
                Pronóstico de Ahorro e Interés Compuesto
              </Text>
            </View>
            <Text style={styles.exportOptionDesc}>
              Exporta la proyección mes a mes de tus cuentas de ahorro considerando aportes fijos, superávit por término de créditos e interés compuesto.
            </Text>

            <View style={styles.horizonChipsRow}>
              {[12, 24, 36, 60].map((m) => {
                const active = forecastExportMonths === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setForecastExportMonths(m)}
                    style={[
                      styles.horizonChip,
                      active && styles.horizonChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.horizonChipText,
                        active && styles.horizonChipTextActive,
                      ]}
                    >
                      {m} Meses
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TeslaButton
              title={`Exportar Pronóstico (${forecastExportMonths}m) a CSV`}
              variant="secondary"
              onPress={handleExportForecast}
              loading={exportingForecast}
            />
          </View>
        </View>

        {exportStatus ? (
          <View style={styles.exportSuccessBanner}>
            <Text style={styles.exportSuccessText}>{exportStatus}</Text>
          </View>
        ) : null}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  sectionTitleWrap: {
    gap: 4,
    flexShrink: 1,
  },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  periodPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  periodIconBtn: {
    padding: 4,
  },
  periodText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 110,
    textAlign: 'center',
  },
  todayChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  todayChipText: {
    color: colors.buttonPrimaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  netWorthHeroBox: {
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
    gap: 8,
  },
  netWorthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  netWorthLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  netWorthStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillPositive: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  pillNegative: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  netWorthStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillPositiveText: {
    color: '#34D399',
  },
  pillNegativeText: {
    color: '#F87171',
  },
  netWorthValue: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  netWorthValueMobile: {
    fontSize: 28,
  },
  netWorthFormulaText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  dualNetWorthGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  dualNetWorthGridMobile: {
    flexDirection: 'column',
  },
  dualCard: {
    flex: 1,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 6,
  },
  dualCardEmerald: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  dualCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dualCardLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  dualCardLabelEmerald: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  dualBadgeEmerald: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  dualBadgeTextEmerald: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '700',
  },
  dualBadgeNeutral: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dualBadgeTextNeutral: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
  },
  dualBadgeNegative: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  dualBadgeTextNegative: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '700',
  },
  dualCardValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  dualCardValueMobile: {
    fontSize: 22,
  },
  dualValueNegative: {
    color: '#F87171',
  },
  dualCardFormula: {
    color: colors.textSecondary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  pillarsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  pillarsGridMobile: {
    flexDirection: 'column',
  },
  pillarCard: {
    flex: 1,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 8,
    justifyContent: 'space-between',
  },
  pillarCardEmerald: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  pillarCardBlue: {
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillarIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pillarIconEmerald: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  pillarIconBlue: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  pillarLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    flexShrink: 1,
  },
  pillarLabelEmerald: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    flexShrink: 1,
  },
  pillarLabelBlue: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    flexShrink: 1,
  },
  pillarAmount: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pillarAmountEmerald: {
    color: '#34D399',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pillarAmountBlue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pillarHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  pillarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  pillarActionText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  checkingListWrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 8,
  },
  checkingListTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  checkingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  checkingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  checkingRowName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  checkingRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkingRowBalance: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  iconSmallBtn: {
    padding: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  inlineFormBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 14,
  },
  inlineFormTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  formGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  formGridMobile: {
    flexDirection: 'column',
  },
  formCol: {
    flex: 1,
  },
  inlineFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  linkPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  linkPillBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  cashFlowGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cashFlowGridMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  cashFlowBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 6,
    minHeight: 104,
  },
  cashFlowBoxMobile: {
    flex: 0,
    width: '100%',
    minHeight: 'auto',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  cashFlowBoxHighlight: {
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cashFlowIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cashFlowLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 16,
  },
  cashFlowValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  cashFlowValueLarge: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  cashFlowSub: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  ratioBarSection: {
    gap: 8,
  },
  ratioBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratioBarLabelText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  ratioTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.22)',
    overflow: 'hidden',
  },
  ratioFillExpense: {
    height: '100%',
    backgroundColor: colors.textPrimary,
    borderRadius: radius.pill,
  },
  totalExpenseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  totalExpenseBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyCategoryBox: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyCategoryText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  categorySectionBody: {
    gap: 18,
  },
  stackedCategoryBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  stackedCategorySegment: {
    height: '100%',
  },
  categoryList: {
    gap: 12,
  },
  categoryItemCard: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    gap: 10,
  },
  categoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  categoryTitleCol: {
    flex: 1,
    gap: 2,
  },
  categoryNameText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryItemsPreview: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  categoryNumbersCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  categoryAmountText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  categoryPercentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPercentText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  categoryProgressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  csvFormatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  csvFormatBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  exportDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  exportCardsGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  exportCardsGridMobile: {
    flexDirection: 'column',
  },
  exportOptionCard: {
    flex: 1,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 12,
    justifyContent: 'space-between',
  },
  exportOptionCardMobile: {
    flex: 0,
    width: '100%',
    minHeight: 'auto',
    justifyContent: 'flex-start',
    gap: 14,
  },
  exportOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportOptionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  exportOptionDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  horizonChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  horizonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  horizonChipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  horizonChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  horizonChipTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  exportSuccessBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  exportSuccessText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
