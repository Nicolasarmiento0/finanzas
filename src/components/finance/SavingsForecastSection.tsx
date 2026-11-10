import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Calendar,
  CheckCircle2,
  Download,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Account,
  CreateAccountInput,
  lookupUser,
  RecurringItem,
  UpdateAccountInput,
} from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { usePrivacy } from '@/context/PrivacyContext';
import { exportForecastReportToCsv } from '@/lib/exportCsv';
import {
  accountToSavingsAccount,
  buildMonthlySurplusList,
  calculateConsolidatedForecast,
  calculateForecast,
  DepositStrategy,
  diffPeriodsInMonths,
  formatPeriodFull,
  getExpiringExpensesInHorizon,
  SavingsAccount,
  savingsAccountToAccountInput,
  shiftPeriod,
} from '@/lib/finance';
import { colors, radius } from '@/theme/tokens';

const ACCENT_GREEN = '#34D399';
const ACCENT_GREEN_BG = 'rgba(52, 211, 153, 0.12)';
const ACCENT_GREEN_BORDER = 'rgba(52, 211, 153, 0.38)';

interface SavingsForecastSectionProps {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
  currentUserId?: string;
  onCreateAccount: (input: CreateAccountInput) => Promise<void>;
  onUpdateAccount: (id: string, input: UpdateAccountInput) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export function SavingsForecastSection({
  period,
  accounts,
  recurringItems,
  currentUserId,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
}: SavingsForecastSectionProps) {
  const { isDesktop } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();

  // Convertir todas las cuentas de tipo 'savings' a SavingsAccount
  const savingsAccounts: SavingsAccount[] = useMemo(() => {
    return accounts
      .filter((a) => a.type === 'savings')
      .map((acc) => accountToSavingsAccount(acc, currentUserId));
  }, [accounts, currentUserId]);

  // ID de cuenta seleccionada o 'CONSOLIDATED' para ver el Consolidado Total
  const [selectedTabId, setSelectedTabId] = useState<string>('CONSOLIDATED');

  // Si hay cuentas y el tab actual no existe, seleccionar la primera cuenta por defecto
  useEffect(() => {
    if (savingsAccounts.length > 0) {
      const exists =
        selectedTabId === 'CONSOLIDATED' ||
        savingsAccounts.some((a) => a.id === selectedTabId);
      if (!exists) {
        setSelectedTabId(savingsAccounts[0].id);
      }
    }
  }, [savingsAccounts, selectedTabId]);

  // Seleccionar la primera cuenta automáticamente la primera vez que cargan
  const [didAutoSelect, setDidAutoSelect] = useState(false);
  useEffect(() => {
    if (!didAutoSelect && savingsAccounts.length > 0) {
      setSelectedTabId(savingsAccounts[0].id);
      setDidAutoSelect(true);
    }
  }, [didAutoSelect, savingsAccounts]);

  // Horizonte de proyección en meses (1 a 60)
  const [monthsAhead, setMonthsAhead] = useState<number>(12);

  // Índice de punto seleccionado en el gráfico para inspección interactiva
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null
  );

  // Estado para formulario de Crear Nueva Cuenta o Editar Cuenta Existente
  const [showEditor, setShowEditor] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formIsShared, setFormIsShared] = useState<boolean>(false);
  const [formPartnerName, setFormPartnerName] = useState('Pareja');
  const [formMyInitialBalance, setFormMyInitialBalance] = useState('');
  const [formPartnerInitialBalance, setFormPartnerInitialBalance] = useState('');
  const [formPartnerMonthlyDeposit, setFormPartnerMonthlyDeposit] = useState('');
  const [formTargetAmount, setFormTargetAmount] = useState('');
  const [formPartnerUserId, setFormPartnerUserId] = useState('');
  const [partnerLookupResult, setPartnerLookupResult] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [partnerLookupLoading, setPartnerLookupLoading] = useState(false);
  const [partnerLookupError, setPartnerLookupError] = useState<string | null>(null);
  const [formHasInterest, setFormHasInterest] = useState<boolean>(false);
  const [formRatePercent, setFormRatePercent] = useState('0');
  const [formStrategy, setFormStrategy] = useState<DepositStrategy>('FIXED');
  const [formFixedDeposit, setFormFixedDeposit] = useState('');
  const [formSurplusPercent, setFormSurplusPercent] = useState('50');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [prevCount, setPrevCount] = useState<number>(savingsAccounts.length);

  const handleLookupPartner = async (text: string) => {
    setFormPartnerUserId(text);
    const trimmed = text.trim();
    if (!trimmed) {
      setPartnerLookupResult(null);
      setPartnerLookupError(null);
      return;
    }
    if (currentUserId && trimmed === currentUserId) {
      setPartnerLookupResult(null);
      setPartnerLookupError('No puedes compartir la cuenta con tu propio ID.');
      return;
    }
    setPartnerLookupLoading(true);
    setPartnerLookupError(null);
    try {
      const found = await lookupUser(trimmed);
      if (found) {
        setPartnerLookupResult(found);
        setPartnerLookupError(null);
        if (!formPartnerName || formPartnerName === 'Pareja') {
          setFormPartnerName(found.name);
        }
      } else {
        setPartnerLookupResult(null);
        setPartnerLookupError('No se encontró ningún usuario con ese ID o correo.');
      }
    } catch {
      setPartnerLookupResult(null);
      setPartnerLookupError('Error al verificar el usuario.');
    } finally {
      setPartnerLookupLoading(false);
    }
  };

  // Cuando se agrega una nueva cuenta de ahorro, seleccionarla automáticamente
  useEffect(() => {
    if (savingsAccounts.length > prevCount && savingsAccounts.length > 0) {
      const newest = savingsAccounts[savingsAccounts.length - 1];
      setSelectedTabId(newest.id);
    }
    setPrevCount(savingsAccounts.length);
  }, [savingsAccounts, prevCount]);

  // Cuenta actualmente seleccionada (si no está en modo Consolidado Total)
  const selectedAccount = useMemo(
    () => savingsAccounts.find((a) => a.id === selectedTabId) || null,
    [savingsAccounts, selectedTabId]
  );

  // Construir la lista de superávit mensual futuro considerando vigencia temporal de gastos y préstamos
  const monthlySurplusList = useMemo(
    () => buildMonthlySurplusList(recurringItems, period, monthsAhead),
    [recurringItems, period, monthsAhead]
  );

  // Compromisos que expiran dentro del horizonte seleccionado y liberan superávit
  const expiringCommitments = useMemo(
    () => getExpiringExpensesInHorizon(recurringItems, period, monthsAhead),
    [recurringItems, period, monthsAhead]
  );

  const totalExpiringAmount = useMemo(
    () => expiringCommitments.reduce((sum, item) => sum + (item.amount || 0), 0),
    [expiringCommitments]
  );

  // Fecha base a partir de `period` (YYYY-MM)
  const baseDate = useMemo(() => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y || 2026, (m || 1) - 1, 15);
  }, [period]);

  // Regla inteligente de Ahorro Acelerado: Destinar el 10% del remanente libre del checklist
  const [applyTenPercentSurplus, setApplyTenPercentSurplus] =
    useState<boolean>(false);

  // Calcular pronóstico para la cuenta seleccionada o para el Consolidado Total
  const activeForecast = useMemo(() => {
    const opts = { applyTenPercentSurplusRule: applyTenPercentSurplus };
    if (selectedAccount) {
      return calculateForecast(
        selectedAccount,
        monthsAhead,
        monthlySurplusList,
        baseDate,
        opts
      );
    }
    return calculateConsolidatedForecast(
      savingsAccounts,
      monthsAhead,
      monthlySurplusList,
      baseDate,
      opts
    );
  }, [
    selectedAccount,
    savingsAccounts,
    monthsAhead,
    monthlySurplusList,
    baseDate,
    applyTenPercentSurplus,
  ]);

  // Pronóstico base sin regla del 10% para fines comparativos
  const baselineForecast = useMemo(() => {
    if (!applyTenPercentSurplus) return activeForecast;
    const opts = { applyTenPercentSurplusRule: false };
    if (selectedAccount) {
      return calculateForecast(
        selectedAccount,
        monthsAhead,
        monthlySurplusList,
        baseDate,
        opts
      );
    }
    return calculateConsolidatedForecast(
      savingsAccounts,
      monthsAhead,
      monthlySurplusList,
      baseDate,
      opts
    );
  }, [
    selectedAccount,
    savingsAccounts,
    monthsAhead,
    monthlySurplusList,
    baseDate,
    applyTenPercentSurplus,
    activeForecast,
  ]);

  const extraFinalCapital = Math.max(
    0,
    activeForecast.finalBalance - baselineForecast.finalBalance
  );
  const currentMonthExtra = Math.max(
    0,
    Math.round((monthlySurplusList[0] || 0) * 0.1)
  );
  const monthsFaster =
    baselineForecast.monthsToReachTarget && activeForecast.monthsToReachTarget
      ? Math.max(
          0,
          baselineForecast.monthsToReachTarget - activeForecast.monthsToReachTarget
        )
      : null;

  const hasPositiveInterest = selectedAccount
    ? selectedAccount.annualRate > 0
    : activeForecast.totalInterest > 0;

  const activeRateLabel = selectedAccount
    ? `+${(selectedAccount.annualRate * 100).toFixed(2).replace(/\.00$/, '')}% anual`
    : 'Interés Compuesto';

  // Abrir formulario para CREAR una nueva cuenta de ahorro
  const openCreateForm = () => {
    setEditingAccountId(null);
    setFormName('');
    setFormBalance('');
    setFormIsShared(false);
    setFormPartnerName('Pareja');
    setFormMyInitialBalance('');
    setFormPartnerInitialBalance('');
    setFormPartnerMonthlyDeposit('');
    setFormTargetAmount('');
    setFormPartnerUserId('');
    setPartnerLookupResult(null);
    setPartnerLookupError(null);
    setFormHasInterest(false);
    setFormRatePercent('0');
    setFormStrategy('FIXED');
    setFormFixedDeposit('');
    setFormSurplusPercent('50');
    setFormError(null);
    setShowEditor(true);
  };

  // Abrir formulario para EDITAR una cuenta existente
  const openEditForm = (acc: SavingsAccount) => {
    const ratePct = Math.round(acc.annualRate * 10000) / 100;
    const isShared = Boolean(acc.isShared);
    setEditingAccountId(acc.id);
    setFormName(acc.name);
    setFormBalance(String(acc.balance));
    setFormIsShared(isShared);
    setFormPartnerName(acc.partnerName || 'Pareja');
    setFormMyInitialBalance(
      String(acc.myInitialBalance !== undefined ? acc.myInitialBalance : acc.balance)
    );
    setFormPartnerInitialBalance(String(acc.partnerInitialBalance || 0));
    setFormPartnerMonthlyDeposit(String(acc.partnerMonthlyDeposit || 0));
    setFormTargetAmount(acc.targetAmount ? String(acc.targetAmount) : '');
    setFormPartnerUserId(acc.partnerUserId || '');
    setPartnerLookupError(null);
    if (acc.partnerUserId) {
      lookupUser(acc.partnerUserId)
        .then((res) => setPartnerLookupResult(res))
        .catch(() => setPartnerLookupResult(null));
    } else {
      setPartnerLookupResult(null);
    }
    setFormHasInterest(ratePct > 0);
    setFormRatePercent(String(ratePct));
    setFormStrategy(acc.strategy);
    setFormFixedDeposit(String(acc.fixedMonthlyDeposit || 0));
    setFormSurplusPercent(String(acc.surplusAllocationPercent || 100));
    setFormError(null);
    setShowEditor(true);
  };

  // Crear cuentas iniciales de ejemplo si aún no tiene ninguna
  const handleInitDefaultAccounts = async () => {
    setSaving(true);
    try {
      await onCreateAccount(
        savingsAccountToAccountInput({
          name: 'Ahorro Inversión 4%',
          balance: 1500000,
          annualRatePercent: 4,
          strategy: 'SURPLUS',
          surplusAllocationPercent: 60,
          fixedMonthlyDeposit: 300000,
        })
      );
      await onCreateAccount(
        savingsAccountToAccountInput({
          name: 'Fondo Emergencia 0%',
          balance: 800000,
          annualRatePercent: 0,
          strategy: 'FIXED',
          fixedMonthlyDeposit: 150000,
          surplusAllocationPercent: 40,
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async () => {
    setFormError(null);
    if (!formName.trim()) {
      setFormError('Ingresa un nombre para la cuenta de ahorro.');
      return;
    }
    const rateNum = formHasInterest
      ? parseFloat(formRatePercent.replace(',', '.')) || 0
      : 0;
    const fixedNum = parseInt(formFixedDeposit.replace(/\D/g, ''), 10) || 0;
    const surplusPct = Math.min(
      100,
      Math.max(1, parseInt(formSurplusPercent.replace(/\D/g, ''), 10) || 100)
    );

    let balanceNum = 0;
    let myInitialNum = 0;
    let partnerInitialNum = 0;
    let partnerMonthlyNum = 0;
    let targetNum = 0;

    if (formIsShared) {
      myInitialNum = parseInt(formMyInitialBalance.replace(/\D/g, ''), 10) || 0;
      partnerInitialNum =
        parseInt(formPartnerInitialBalance.replace(/\D/g, ''), 10) || 0;
      balanceNum = myInitialNum + partnerInitialNum;
      partnerMonthlyNum =
        parseInt(formPartnerMonthlyDeposit.replace(/\D/g, ''), 10) || 0;
      targetNum = parseInt(formTargetAmount.replace(/\D/g, ''), 10) || 0;
    } else {
      balanceNum = parseInt(formBalance.replace(/\D/g, ''), 10) || 0;
      myInitialNum = balanceNum;
    }

    const editingAccount = editingAccountId
      ? savingsAccounts.find((a) => a.id === editingAccountId)
      : null;

    const payload = savingsAccountToAccountInput({
      name: formName,
      balance: balanceNum,
      annualRatePercent: rateNum,
      strategy: formStrategy,
      fixedMonthlyDeposit: fixedNum,
      surplusAllocationPercent: surplusPct,
      isShared: formIsShared,
      partnerName: formIsShared ? formPartnerName.trim() || 'Pareja' : undefined,
      myInitialBalance: myInitialNum,
      partnerInitialBalance: partnerInitialNum,
      partnerMonthlyDeposit: partnerMonthlyNum,
      targetAmount: targetNum,
      partnerUserId: formIsShared ? formPartnerUserId.trim() || null : null,
      isOwner: editingAccount ? editingAccount.isOwner : true,
    });

    setSaving(true);
    try {
      if (editingAccountId) {
        await onUpdateAccount(editingAccountId, payload);
      } else {
        await onCreateAccount(payload);
      }
      setShowEditor(false);
      setEditingAccountId(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar la cuenta'
      );
    } finally {
      setSaving(false);
    }
  };

  // Muestreo de puntos para el gráfico (máximo 16 columnas para visualización limpia en móvil y web)
  const chartPoints = useMemo(() => {
    const pts = activeForecast.points;
    if (pts.length <= 16) return pts;
    const step = Math.ceil(pts.length / 16);
    return pts.filter(
      (_, idx) => idx % step === 0 || idx === pts.length - 1
    );
  }, [activeForecast.points]);

  const maxChartValue = useMemo(() => {
    return Math.max(...chartPoints.map((p) => p.totalBalance), 1);
  }, [chartPoints]);

  const targetFullPeriod = shiftPeriod(period, monthsAhead);
  const monthsToEndOf2027 = diffPeriodsInMonths(period, '2027-12');

  const inspectedPoint =
    selectedPointIndex !== null && chartPoints[selectedPointIndex]
      ? chartPoints[selectedPointIndex]
      : chartPoints[chartPoints.length - 1] || null;

  return (
    <View style={styles.container}>
      {/* Cabecera del Módulo con Botón para Agregar Nueva Cuenta de Ahorro */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.sectionTitle}>
            Cuentas de Ahorro y Motor de Pronóstico
          </Text>
          <Text style={styles.sectionSubtitle}>
            Crea múltiples cuentas (con o sin interés) y proyecta su evolución mes a mes
          </Text>
        </View>

        <View style={styles.headerActions}>
          {savingsAccounts.length === 0 ? (
            <Pressable
              onPress={handleInitDefaultAccounts}
              style={({ pressed }) => [
                styles.initDualBtn,
                pressed && styles.pressed,
              ]}
            >
              <Sparkles size={14} color={colors.textPrimary} />
              <Text style={styles.initDualBtnText}>
                {saving ? 'Creando...' : 'Cargar Cuentas 4% y 0%'}
              </Text>
            </Pressable>
          ) : null}

          {savingsAccounts.length > 0 ? (
            <Pressable
              onPress={() =>
                exportForecastReportToCsv({
                  period,
                  monthsAhead,
                  accounts,
                  recurringItems,
                  selectedAccountId: selectedTabId,
                })
              }
              style={({ pressed }) => [
                styles.initDualBtn,
                pressed && styles.pressed,
              ]}
            >
              <Download size={14} color={ACCENT_GREEN} />
              <Text style={[styles.initDualBtnText, { color: ACCENT_GREEN }]}>
                Exportar Pronóstico CSV
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={openCreateForm}
            style={({ pressed }) => [styles.addPillBtn, pressed && styles.pressed]}
          >
            <Plus size={15} color={colors.buttonPrimaryText} />
            <Text style={styles.addPillBtnText}>Nueva Cuenta de Ahorro</Text>
          </Pressable>
        </View>
      </View>

      {/* Formulario colapsable para CREAR o EDITAR cualquier Cuenta de Ahorro */}
      {showEditor ? (
        <GlassCard style={styles.editorCard}>
          <View style={styles.editorTopRow}>
            <Text style={styles.editorTitle}>
              {editingAccountId
                ? `Editar Cuenta: ${formName || 'Ahorro'}`
                : 'Agregar Nueva Cuenta de Ahorro'}
            </Text>
            <Pressable
              onPress={() => {
                setShowEditor(false);
                setEditingAccountId(null);
              }}
              style={styles.closeBtn}
            >
              <X size={15} color={colors.textSecondary} />
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </Pressable>
          </View>

          <GlassInput
            label="Nombre de la Cuenta de Ahorro (ej. Ahorro Brasil, Mercado Pago)"
            placeholder="Ej. Ahorro Brasil"
            value={formName}
            onChangeText={setFormName}
          />

          <Text style={styles.fieldLabel}>MODALIDAD DE AHORRO</Text>
          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => setFormIsShared(false)}
              style={[
                styles.segmentOption,
                !formIsShared && styles.segmentOptionActive,
              ]}
            >
              <View style={styles.segmentOptionContent}>
                <PiggyBank
                  size={15}
                  color={
                    !formIsShared
                      ? colors.buttonPrimaryText
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.segmentOptionText,
                    !formIsShared && styles.segmentOptionTextActive,
                  ]}
                >
                  Individual (Solo yo)
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setFormIsShared(true)}
              style={[
                styles.segmentOption,
                formIsShared && styles.segmentOptionActive,
              ]}
            >
              <View style={styles.segmentOptionContent}>
                <PiggyBank
                  size={15}
                  color={
                    formIsShared
                      ? colors.buttonPrimaryText
                      : colors.textSecondary
                  }
                />
                <Users
                  size={14}
                  color={
                    formIsShared
                      ? colors.buttonPrimaryText
                      : '#818CF8'
                  }
                />
                <Text
                  style={[
                    styles.segmentOptionText,
                    formIsShared && styles.segmentOptionTextActive,
                  ]}
                >
                  En Pareja (Compartido)
                </Text>
              </View>
            </Pressable>
          </View>

          {formIsShared ? (
            <View style={styles.partnerFormSection}>
              <GlassInput
                label="ID o Correo de tu Pareja (para sincronizar en su sesión)"
                placeholder="Pega aquí el ID o correo que aparece en su perfil"
                value={formPartnerUserId}
                onChangeText={handleLookupPartner}
                autoCapitalize="none"
              />
              {partnerLookupLoading ? (
                <Text style={styles.partnerLookupHint}>Buscando usuario...</Text>
              ) : null}
              {partnerLookupResult ? (
                <View style={styles.partnerFoundBadge}>
                  <CheckCircle2 size={13} color="#34D399" />
                  <Text style={styles.partnerFoundText}>
                    Sincronizada con: {partnerLookupResult.name} ({partnerLookupResult.email})
                  </Text>
                </View>
              ) : null}
              {partnerLookupError ? (
                <Text style={styles.partnerLookupErrorText}>
                  {partnerLookupError}
                </Text>
              ) : null}

              <GlassInput
                label="Nombre visible de tu Pareja"
                placeholder="Ej. Pareja, Camila..."
                value={formPartnerName}
                onChangeText={setFormPartnerName}
              />

              <View style={[styles.twoCol, !isDesktop && styles.twoColMobile]}>
                <View style={styles.col}>
                  <GlassInput
                    label="Tu Saldo Inicial Hoy (CLP)"
                    placeholder="Ej. 20000"
                    keyboardType="numeric"
                    value={formMyInitialBalance}
                    onChangeText={setFormMyInitialBalance}
                  />
                </View>
                <View style={styles.col}>
                  <GlassInput
                    label={`Saldo Inicial de ${formPartnerName || 'tu pareja'} (CLP)`}
                    placeholder="Ej. 20000"
                    keyboardType="numeric"
                    value={formPartnerInitialBalance}
                    onChangeText={setFormPartnerInitialBalance}
                  />
                </View>
              </View>

              <Text style={styles.partnerSumHint}>
                Saldo inicial conjunto total: {formatCLP(
                  (parseInt(formMyInitialBalance.replace(/\D/g, ''), 10) || 0) +
                  (parseInt(formPartnerInitialBalance.replace(/\D/g, ''), 10) || 0)
                )}
              </Text>

              <GlassInput
                label="Meta Conjunta Opcional en CLP (ej. 1500000 para Viaje a Brasil)"
                placeholder="0 (deja vacío si no tienen una meta fija)"
                keyboardType="numeric"
                value={formTargetAmount}
                onChangeText={setFormTargetAmount}
              />
            </View>
          ) : (
            <GlassInput
              label="Saldo Inicial Hoy S₀ (CLP) — cuánto tienes hoy en esta cuenta"
              placeholder="Ej. 40000 (o 0 si empiezas desde cero)"
              keyboardType="numeric"
              value={formBalance}
              onChangeText={setFormBalance}
            />
          )}

          <Text style={styles.fieldLabel}>TIPO DE CUENTA (CON O SIN INTERÉS)</Text>
          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => {
                setFormHasInterest(false);
                setFormRatePercent('0');
              }}
              style={[
                styles.segmentOption,
                !formHasInterest && styles.segmentOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentOptionText,
                  !formHasInterest && styles.segmentOptionTextActive,
                ]}
              >
                Sin % Interés (0%)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setFormHasInterest(true);
                if (formRatePercent === '0' || !formRatePercent) {
                  setFormRatePercent('4');
                }
              }}
              style={[
                styles.segmentOption,
                formHasInterest && styles.segmentOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentOptionText,
                  formHasInterest && styles.segmentOptionTextActive,
                ]}
              >
                Con % Interés Anual
              </Text>
            </Pressable>
          </View>

          {formHasInterest ? (
            <GlassInput
              label="Tasa de Interés Anual Nominal (%)"
              placeholder="Ej. 4 para 4% anual"
              keyboardType="numeric"
              value={formRatePercent}
              onChangeText={setFormRatePercent}
            />
          ) : null}

          <Text style={styles.fieldLabel}>
            {formIsShared ? 'APORTES MENSUALES INDEPENDIENTES' : 'ESTRATEGIA DE APORTE MENSUAL'}
          </Text>

          {formIsShared ? (
            <View style={styles.partnerFormSection}>
              <View style={[styles.twoCol, !isDesktop && styles.twoColMobile]}>
                <View style={styles.col}>
                  <GlassInput
                    label="Tu Aporte Fijo Mensual (CLP)"
                    placeholder="0 (o ej. 40000)"
                    keyboardType="numeric"
                    value={formFixedDeposit}
                    onChangeText={setFormFixedDeposit}
                  />
                </View>
                <View style={styles.col}>
                  <GlassInput
                    label={`Aporte de ${formPartnerName || 'tu pareja'} (CLP)`}
                    placeholder="0 (o ej. 40000)"
                    keyboardType="numeric"
                    value={formPartnerMonthlyDeposit}
                    onChangeText={setFormPartnerMonthlyDeposit}
                  />
                </View>
              </View>
              <Text style={styles.partnerSumHint}>
                Aporte mensual conjunto total: {formatCLP(
                  (parseInt(formFixedDeposit.replace(/\D/g, ''), 10) || 0) +
                  (parseInt(formPartnerMonthlyDeposit.replace(/\D/g, ''), 10) || 0)
                )} / mes
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.segmentRow}>
                <Pressable
                  onPress={() => setFormStrategy('FIXED')}
                  style={[
                    styles.segmentOption,
                    formStrategy === 'FIXED' && styles.segmentOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentOptionText,
                      formStrategy === 'FIXED' && styles.segmentOptionTextActive,
                    ]}
                  >
                    Aporte Fijo Mensual
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFormStrategy('SURPLUS')}
                  style={[
                    styles.segmentOption,
                    formStrategy === 'SURPLUS' && styles.segmentOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentOptionText,
                      formStrategy === 'SURPLUS' && styles.segmentOptionTextActive,
                    ]}
                  >
                    % del Superávit Mensual
                  </Text>
                </Pressable>
              </View>

              {formStrategy === 'FIXED' ? (
                <GlassInput
                  label="Aporte Fijo que sumarás cada mes (CLP) — deja en 0 si no abonarás mensualmente"
                  placeholder="0 (o ej. 40000 si abonarás $40.000 cada mes)"
                  keyboardType="numeric"
                  value={formFixedDeposit}
                  onChangeText={setFormFixedDeposit}
                />
              ) : (
                <GlassInput
                  label="Porcentaje del Superávit Mensual Automático (1 a 100%)"
                  placeholder="Ej. 50"
                  keyboardType="numeric"
                  value={formSurplusPercent}
                  onChangeText={setFormSurplusPercent}
                />
              )}
            </>
          )}

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <View style={[styles.twoCol, !isDesktop && styles.twoColMobile]}>
            <View style={styles.col}>
              <TeslaButton
                title={
                  editingAccountId
                    ? 'Guardar Cambios de la Cuenta'
                    : 'Crear Cuenta de Ahorro'
                }
                onPress={handleSaveAccount}
                loading={saving}
              />
            </View>
            {editingAccountId ? (
              <View style={styles.col}>
                <TeslaButton
                  title="Eliminar Cuenta"
                  variant="secondary"
                  onPress={async () => {
                    await onDeleteAccount(editingAccountId);
                    setShowEditor(false);
                    setEditingAccountId(null);
                  }}
                />
              </View>
            ) : null}
          </View>
        </GlassCard>
      ) : null}

      {/* Barra Dinámica de Selección de Cuentas de Ahorro (muestra el nombre de cada cuenta + Consolidado Total) */}
      {savingsAccounts.length === 0 ? (
        <GlassCard>
          <Text style={styles.emptyText}>
            Aún no tienes cuentas de ahorro registradas. Usa el botón &quot;Nueva Cuenta de Ahorro&quot; o &quot;Cargar Cuentas 4% y 0%&quot; arriba para comenzar.
          </Text>
        </GlassCard>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountsSelectorScroll}
          >
            {savingsAccounts.map((acc) => {
              const isSelected = selectedTabId === acc.id;
              const ratePct = (acc.annualRate * 100)
                .toFixed(1)
                .replace(/\.0$/, '');
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => {
                    setSelectedTabId(acc.id);
                    setSelectedPointIndex(null);
                  }}
                  style={[
                    styles.accountSelectorChip,
                    isSelected && styles.accountSelectorChipActive,
                  ]}
                >
                  {acc.annualRate > 0 ? (
                    <TrendingUp
                      size={14}
                      color={
                        isSelected ? colors.buttonPrimaryText : ACCENT_GREEN
                      }
                    />
                  ) : (
                    <PiggyBank
                      size={14}
                      color={
                        isSelected
                          ? colors.buttonPrimaryText
                          : colors.textSecondary
                      }
                    />
                  )}
                  {acc.isShared ? (
                    <Users
                      size={13}
                      color={
                        isSelected ? colors.buttonPrimaryText : '#818CF8'
                      }
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.accountSelectorChipName,
                      isSelected && styles.accountSelectorChipNameActive,
                    ]}
                  >
                    {acc.name}
                  </Text>
                  <View
                    style={[
                      styles.accountSelectorRateBadge,
                      isSelected && styles.accountSelectorRateBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.accountSelectorRateText,
                        isSelected && styles.accountSelectorRateTextActive,
                      ]}
                    >
                      {ratePct}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => {
                setSelectedTabId('CONSOLIDATED');
                setSelectedPointIndex(null);
              }}
              style={[
                styles.accountSelectorChip,
                selectedTabId === 'CONSOLIDATED' &&
                  styles.accountSelectorChipActive,
              ]}
            >
              <Sparkles
                size={14}
                color={
                  selectedTabId === 'CONSOLIDATED'
                    ? colors.buttonPrimaryText
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.accountSelectorChipName,
                  selectedTabId === 'CONSOLIDATED' &&
                    styles.accountSelectorChipNameActive,
                ]}
              >
                Consolidado Total ({savingsAccounts.length})
              </Text>
            </Pressable>
          </ScrollView>

          {/* Tarjeta de Identidad de la Cuenta de Ahorro Seleccionada */}
          {selectedAccount ? (
            <GlassCard style={styles.activeAccountBanner}>
              <View style={styles.activeAccountTopRow}>
                <View style={styles.activeAccountInfo}>
                  <View style={styles.activeAccountHeaderBadges}>
                    <Text style={styles.activeAccountEyebrow}>
                      CUENTA DE AHORRO SELECCIONADA
                    </Text>
                    {selectedAccount.isShared ? (
                      <>
                        <View style={styles.partnerBadge}>
                          <Users size={12} color="#34D399" />
                          <Text style={styles.partnerBadgeText}>
                            EN PAREJA · TÚ + {(selectedAccount.partnerName || 'PAREJA').toUpperCase()}
                          </Text>
                        </View>
                        {selectedAccount.partnerUserId ? (
                          <View style={styles.partnerSyncedBadge}>
                            <CheckCircle2 size={11} color="#34D399" />
                            <Text style={styles.partnerSyncedBadgeText}>
                              {selectedAccount.isOwner === false
                                ? `COMPARTIDA POR ${(selectedAccount.partnerName || 'PAREJA').toUpperCase()}`
                                : 'SINCRONIZADA EN VIVO'}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>

                  <Text style={styles.activeAccountName}>
                    {selectedAccount.name}
                  </Text>

                  {selectedAccount.isShared ? (
                    <Text style={styles.activeAccountMeta}>
                      Saldo inicial conjunto: {formatCLP(selectedAccount.balance)} ({formatCLP(selectedAccount.myInitialBalance || 0)} tú + {formatCLP(selectedAccount.partnerInitialBalance || 0)} {selectedAccount.partnerName}) · Aporte mensual conjunto: {formatCLP((selectedAccount.fixedMonthlyDeposit || 0) + (selectedAccount.partnerMonthlyDeposit || 0))}/mes ({formatCLP(selectedAccount.fixedMonthlyDeposit || 0)} tú + {formatCLP(selectedAccount.partnerMonthlyDeposit || 0)} {selectedAccount.partnerName}) · Tasa: {(selectedAccount.annualRate * 100).toFixed(2).replace(/\.00$/, '')}% anual
                    </Text>
                  ) : (
                    <Text style={styles.activeAccountMeta}>
                      Saldo inicial hoy (S₀): {formatCLP(selectedAccount.balance)} ·{' '}
                      {selectedAccount.strategy === 'FIXED'
                        ? `Aporte mensual: ${formatCLP(selectedAccount.fixedMonthlyDeposit || 0)}/mes`
                        : `Aporte mensual: ${selectedAccount.surplusAllocationPercent || 100}% del superávit`}
                      {' · '}
                      Tasa:{' '}
                      {(selectedAccount.annualRate * 100)
                        .toFixed(2)
                        .replace(/\.00$/, '')}
                      % anual
                    </Text>
                  )}

                  {selectedAccount.isShared ? (
                    <Text style={styles.formulaBreakdownText}>
                      Cálculo a {monthsAhead} {monthsAhead === 1 ? 'mes' : 'meses'}:{' '}
                      {formatCLP(selectedAccount.balance)} (S₀ conjunto: {formatCLP(selectedAccount.myInitialBalance || 0)} tú + {formatCLP(selectedAccount.partnerInitialBalance || 0)} {selectedAccount.partnerName}) +{' '}
                      {formatCLP(activeForecast.totalDeposited - selectedAccount.balance)}{' '}
                      ({monthsAhead}m aportes: {formatCLP(activeForecast.myTotalDeposited - (selectedAccount.myInitialBalance || 0))} tú + {formatCLP(activeForecast.partnerTotalDeposited - (selectedAccount.partnerInitialBalance || 0))} {selectedAccount.partnerName})
                      {selectedAccount.annualRate > 0
                        ? ` + ${formatCLP(activeForecast.totalInterest)} (intereses)`
                        : ''}{' '}
                      = {formatCLP(activeForecast.finalBalance)}
                    </Text>
                  ) : (
                    <Text style={styles.formulaBreakdownText}>
                      Cálculo a {monthsAhead} {monthsAhead === 1 ? 'mes' : 'meses'}:{' '}
                      {formatCLP(selectedAccount.balance)} (inicial) +{' '}
                      {formatCLP(
                        activeForecast.totalDeposited - selectedAccount.balance
                      )}{' '}
                      ({monthsAhead} meses de aportes)
                      {selectedAccount.annualRate > 0
                        ? ` + ${formatCLP(activeForecast.totalInterest)} (intereses)`
                        : ''}{' '}
                      = {formatCLP(activeForecast.finalBalance)}
                    </Text>
                  )}

                  {/* Barra de Participación en Pareja */}
                  {selectedAccount.isShared && activeForecast.totalDeposited > 0 ? (
                    <View style={styles.participationBox}>
                      <View style={styles.participationLabels}>
                        <Text style={styles.participationTextMy}>
                          Tú: {formatCLP(activeForecast.myTotalDeposited)} (
                          {Math.round(
                            (activeForecast.myTotalDeposited /
                              activeForecast.totalDeposited) *
                              100
                          )}
                          %)
                        </Text>
                        <Text style={styles.participationTextPartner}>
                          {selectedAccount.partnerName}:{' '}
                          {formatCLP(activeForecast.partnerTotalDeposited)} (
                          {100 -
                            Math.round(
                              (activeForecast.myTotalDeposited /
                                activeForecast.totalDeposited) *
                                100
                            )}
                          %)
                        </Text>
                      </View>
                      <View style={styles.participationBar}>
                        <View
                          style={[
                            styles.participationFillMy,
                            {
                              width: `${Math.round(
                                (activeForecast.myTotalDeposited /
                                  activeForecast.totalDeposited) *
                                  100
                              )}%`,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.participationFillPartner,
                            {
                              width: `${
                                100 -
                                Math.round(
                                  (activeForecast.myTotalDeposited /
                                    activeForecast.totalDeposited) *
                                    100
                                )
                              }%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ) : null}

                  {/* Meta Conjunta Tracker si está configurada */}
                  {selectedAccount.isShared &&
                  selectedAccount.targetAmount &&
                  selectedAccount.targetAmount > 0 ? (
                    <View style={styles.goalBox}>
                      <View style={styles.goalHeader}>
                        <View style={styles.goalTitleRow}>
                          <Target size={14} color="#34D399" />
                          <Text style={styles.goalTitle}>
                            META CONJUNTA: {formatCLP(selectedAccount.targetAmount)}
                          </Text>
                        </View>
                        <Text style={styles.goalStatusText}>
                          {activeForecast.targetReachedMonthLabel
                            ? `Se cumple en ${activeForecast.targetReachedMonthLabel}`
                            : `${Math.round(
                                (activeForecast.finalBalance /
                                  selectedAccount.targetAmount) *
                                  100
                              )}% alcanzado`}
                        </Text>
                      </View>
                      <View style={styles.goalBarTrack}>
                        <View
                          style={[
                            styles.goalBarFill,
                            {
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (activeForecast.finalBalance /
                                    selectedAccount.targetAmount) *
                                    100
                                )
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.goalRemainingText}>
                        {activeForecast.finalBalance >= selectedAccount.targetAmount
                          ? '¡Meta cumplida en este horizonte!'
                          : `Faltan ${formatCLP(
                              selectedAccount.targetAmount -
                                activeForecast.finalBalance
                            )} para completar la meta.`}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.activeAccountActions}>
                  <Pressable
                    onPress={() => openEditForm(selectedAccount)}
                    style={styles.editAccountBtn}
                  >
                    <Pencil size={13} color={colors.textPrimary} />
                    <Text style={styles.editAccountBtnText}>Editar Valores</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteAccount(selectedAccount.id)}
                    style={styles.iconDeleteBtn}
                  >
                    <Trash2 size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          ) : (
            /* Resumen de todas las cuentas cuando está en Consolidado Total */
            <GlassCard style={styles.activeAccountBanner}>
              <Text style={styles.activeAccountEyebrow}>
                VISTA CONSOLIDADA · {savingsAccounts.length}{' '}
                {savingsAccounts.length === 1
                  ? 'CUENTA DE AHORRO ACTIVA'
                  : 'CUENTAS DE AHORRO ACTIVAS'}
              </Text>
              <View style={styles.consolidatedAccountsList}>
                {savingsAccounts.map((acc) => (
                  <View key={acc.id} style={styles.consolidatedAccountRow}>
                    <Pressable
                      onPress={() => setSelectedTabId(acc.id)}
                      style={styles.consolidatedAccountLeft}
                    >
                      <Text style={styles.consolidatedAccountName}>
                        {acc.name}
                      </Text>
                      <Text style={styles.consolidatedAccountSub}>
                        Tasa {(acc.annualRate * 100).toFixed(1).replace(/\.0$/, '')}% ·{' '}
                        {acc.strategy === 'FIXED'
                          ? `Fijo ${formatCLP(acc.fixedMonthlyDeposit || 0)}/mes`
                          : `${acc.surplusAllocationPercent || 100}% Superávit`}
                      </Text>
                    </Pressable>

                    <View style={styles.consolidatedAccountRight}>
                      <Text style={styles.consolidatedAccountBalance}>
                        {formatCLP(acc.balance)}
                      </Text>
                      <Pressable
                        onPress={() => openEditForm(acc)}
                        style={styles.smallEditIconBtn}
                      >
                        <Pencil size={13} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {/* Controles de Proyección Temporal (Slider interactivo y Botones Rápidos) */}
          <GlassCard>
            <View style={styles.horizonHeader}>
              <View style={styles.horizonTitleGroup}>
                <Calendar size={16} color={colors.textSecondary} />
                <Text style={styles.horizonLabel}>
                  HORIZONTE DE PRONÓSTICO TEMPORAL
                </Text>
              </View>

              <View style={styles.targetDateBadge}>
                <Text style={styles.targetDateBadgeText}>
                  Objetivo: {formatPeriodFull(targetFullPeriod)} ({monthsAhead}{' '}
                  {monthsAhead === 1 ? 'mes' : 'meses'})
                </Text>
              </View>
            </View>

            {/* Control Deslizante Interactivo (1 a 60 meses) */}
            <View style={styles.sliderControlRow}>
              <Pressable
                onPress={() => setMonthsAhead((m) => Math.max(1, m - 1))}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Minus size={16} color={colors.textPrimary} />
              </Pressable>

              <View style={styles.sliderTrackContainer}>
                <View style={styles.sliderTrackBg}>
                  <View
                    style={[
                      styles.sliderTrackFill,
                      { width: `${Math.min(100, (monthsAhead / 60) * 100)}%` },
                    ]}
                  />
                </View>
                <View style={styles.sliderTicksRow}>
                  {[1, 6, 12, 18, 24, 36, 48, 60].map((tick) => {
                    const isSelected = monthsAhead === tick;
                    return (
                      <Pressable
                        key={tick}
                        onPress={() => setMonthsAhead(tick)}
                        style={[
                          styles.sliderTickPill,
                          isSelected && styles.sliderTickPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sliderTickText,
                            isSelected && styles.sliderTickTextActive,
                          ]}
                        >
                          {tick}m
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() => setMonthsAhead((m) => Math.min(60, m + 1))}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Plus size={16} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Botones Rápidos: [ 6 Meses ], [ 1 Año ], [ Fin de 2027 ], [ 3 Años ] */}
            <View style={styles.quickHorizonRow}>
              <Pressable
                onPress={() => setMonthsAhead(6)}
                style={[
                  styles.quickHorizonBtn,
                  monthsAhead === 6 && styles.quickHorizonBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickHorizonBtnText,
                    monthsAhead === 6 && styles.quickHorizonBtnTextActive,
                  ]}
                >
                  6 Meses
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMonthsAhead(12)}
                style={[
                  styles.quickHorizonBtn,
                  monthsAhead === 12 && styles.quickHorizonBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickHorizonBtnText,
                    monthsAhead === 12 && styles.quickHorizonBtnTextActive,
                  ]}
                >
                  1 Año
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMonthsAhead(monthsToEndOf2027)}
                style={[
                  styles.quickHorizonBtn,
                  monthsAhead === monthsToEndOf2027 &&
                    styles.quickHorizonBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickHorizonBtnText,
                    monthsAhead === monthsToEndOf2027 &&
                      styles.quickHorizonBtnTextActive,
                  ]}
                >
                  Fin de 2027
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMonthsAhead(36)}
                style={[
                  styles.quickHorizonBtn,
                  monthsAhead === 36 && styles.quickHorizonBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickHorizonBtnText,
                    monthsAhead === 36 && styles.quickHorizonBtnTextActive,
                  ]}
                >
                  3 Años
                </Text>
              </Pressable>
            </View>

            {/* Tarea 6: Toggle para la regla del 10% adicional del remanente libre del checklist */}
            <View style={styles.tenPercentDivider} />

            <Pressable
              onPress={() => setApplyTenPercentSurplus((prev) => !prev)}
              style={({ pressed }) => [
                styles.tenPercentToggleRow,
                applyTenPercentSurplus && styles.tenPercentToggleRowActive,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.toggleCheckbox,
                  applyTenPercentSurplus && styles.toggleCheckboxChecked,
                ]}
              >
                {applyTenPercentSurplus ? (
                  <CheckCircle2 size={16} color="#050505" />
                ) : null}
              </View>

              <View style={styles.toggleTextCol}>
                <View style={styles.toggleHeaderLine}>
                  <Text style={styles.toggleTitle}>
                    Proyectar Ahorro Acelerado (+10% del Remanente Libre)
                  </Text>
                  <View
                    style={[
                      styles.toggleBadge,
                      applyTenPercentSurplus && styles.toggleBadgeActive,
                    ]}
                  >
                    <Sparkles
                      size={11}
                      color={
                        applyTenPercentSurplus
                          ? '#34D399'
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.toggleBadgeText,
                        applyTenPercentSurplus && styles.toggleBadgeTextActive,
                      ]}
                    >
                      {applyTenPercentSurplus ? 'ACTIVADO' : 'OPCIONAL'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.toggleSubtitle}>
                  Además de tus aportes habituales, proyecta destinar el 10% del monto total libre tras pagar todo en el checklist.
                  {currentMonthExtra > 0
                    ? ` (Est. +${formatCLP(currentMonthExtra)}/mes)`
                    : ''}
                </Text>
              </View>
            </Pressable>

            {applyTenPercentSurplus && extraFinalCapital > 0 ? (
              <View style={styles.acceleratedBenefitCard}>
                <View style={styles.acceleratedBenefitHeader}>
                  <TrendingUp size={15} color="#34D399" />
                  <Text style={styles.acceleratedBenefitTitle}>
                    IMPACTO DE LA REGLA DEL 10% EN {monthsAhead} MESES
                  </Text>
                </View>
                <View style={styles.acceleratedBenefitGrid}>
                  <View style={styles.acceleratedBenefitItem}>
                    <Text style={styles.acceleratedBenefitLabel}>
                      CAPITAL EXTRA GENERADO
                    </Text>
                    <Text style={styles.acceleratedBenefitVal}>
                      +{formatCLP(extraFinalCapital)}
                    </Text>
                    <Text style={styles.acceleratedBenefitSub}>
                      Por ahorro del 10% remanente
                    </Text>
                  </View>
                  <View style={styles.acceleratedBenefitItem}>
                    <Text style={styles.acceleratedBenefitLabel}>
                      SALDO SIN REGLA 10%
                    </Text>
                    <Text style={styles.acceleratedBenefitValOld}>
                      {formatCLP(baselineForecast.finalBalance)}
                    </Text>
                    <Text style={styles.acceleratedBenefitSub}>
                      Aporte ordinario
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.acceleratedBenefitItem,
                      styles.acceleratedBenefitItemHighlight,
                    ]}
                  >
                    <Text style={styles.acceleratedBenefitLabel}>
                      SALDO TOTAL ACELERADO
                    </Text>
                    <Text style={styles.acceleratedBenefitValNew}>
                      {formatCLP(activeForecast.finalBalance)}
                    </Text>
                    <Text style={styles.acceleratedBenefitSub}>
                      {monthsFaster && monthsFaster > 0
                        ? `¡Meta ${monthsFaster} meses antes!`
                        : 'Patrimonio maximizado'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </GlassCard>

          {/* Cards de Resumen de Proyección */}
          <View style={styles.summaryCardsGrid}>
            {/* Tarjeta 1: Saldo Estimado Total en la fecha seleccionada */}
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>
                {selectedAccount?.isShared
                  ? `SALDO CONJUNTO EN ${formatPeriodFull(targetFullPeriod).toUpperCase()}`
                  : `SALDO ESTIMADO EN ${formatPeriodFull(targetFullPeriod).toUpperCase()}`}
              </Text>
              <Text style={styles.summaryCardPrimaryValue}>
                {formatCLP(activeForecast.finalBalance)}
              </Text>
              <Text style={styles.summaryCardHint}>
                {selectedAccount
                  ? `Cuenta: ${selectedAccount.name}${selectedAccount.isShared ? ' (En Pareja)' : ''}`
                  : `Consolidado de ${savingsAccounts.length} cuentas de ahorro`}
              </Text>
            </GlassCard>

            {/* Tarjetas 2 y 3: Si es en pareja, separar tu aporte del de tu pareja */}
            {selectedAccount?.isShared ? (
              <>
                <GlassCard style={styles.summaryCard}>
                  <Text style={styles.summaryCardLabel}>
                    TU CAPITAL APORTADO
                  </Text>
                  <Text style={styles.summaryCardSecondaryValue}>
                    {formatCLP(activeForecast.myTotalDeposited)}
                  </Text>
                  <Text style={styles.summaryCardHint}>
                    {activeForecast.totalDeposited > 0
                      ? `${Math.round((activeForecast.myTotalDeposited / activeForecast.totalDeposited) * 100)}% de participación propia`
                      : 'Aportes propios'}
                  </Text>
                </GlassCard>

                <GlassCard style={[styles.summaryCard, styles.summaryCardPartner]}>
                  <Text style={[styles.summaryCardLabel, styles.summaryCardPartnerLabel]}>
                    CAPITAL DE {(selectedAccount.partnerName || 'PAREJA').toUpperCase()}
                  </Text>
                  <Text style={[styles.summaryCardSecondaryValue, styles.summaryCardPartnerValue]}>
                    {formatCLP(activeForecast.partnerTotalDeposited)}
                  </Text>
                  <Text style={styles.summaryCardHint}>
                    {activeForecast.totalDeposited > 0
                      ? `${100 - Math.round((activeForecast.myTotalDeposited / activeForecast.totalDeposited) * 100)}% de participación pareja`
                      : `Aporte de ${selectedAccount.partnerName}`}
                  </Text>
                </GlassCard>
              </>
            ) : (
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel}>
                  CAPITAL APORTADO DE TU BOLSILLO
                </Text>
                <Text style={styles.summaryCardSecondaryValue}>
                  {formatCLP(activeForecast.totalDeposited)}
                </Text>
                <Text style={styles.summaryCardHint}>
                  Saldo inicial S₀ + {monthsAhead} meses de aportes propios
                </Text>
              </GlassCard>
            )}

            {/* Tarjeta (Solo visible si i > 0): Ganancia generada por intereses destacada en verde */}
            {hasPositiveInterest ? (
              <GlassCard style={[styles.summaryCard, styles.summaryCardInterest]}>
                <View style={styles.interestHeaderRow}>
                  <Text style={styles.interestCardLabel}>
                    GANANCIA POR INTERESES
                  </Text>
                  <View style={styles.greenRateBadge}>
                    <Text style={styles.greenRateBadgeText}>
                      {activeRateLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.interestCardValue}>
                  +{formatCLP(activeForecast.totalInterest)}
                </Text>
                <Text style={styles.interestCardHint}>
                  Rendimiento por capitalización mensual compuesta (r = i / 12)
                </Text>
              </GlassCard>
            ) : null}
          </View>

          {/* Gráfico de Evolución Temporal */}
          <GlassCard>
            <View style={styles.chartHeader}>
              <View style={styles.chartTitleCol}>
                <Text style={styles.chartTitle}>
                  {selectedAccount
                    ? `EVOLUCIÓN DE ${selectedAccount.name.toUpperCase()}`
                    : 'EVOLUCIÓN DEL CONSOLIDADO TOTAL DE AHORRO'}
                </Text>
                <Text style={styles.chartSubtitle}>
                  {hasPositiveInterest
                    ? 'Gráfico de Área Apilada (Aporte Propio + Interés Compuesto)'
                    : 'Curva de Acumulación Lineal (0% Interés)'}
                </Text>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={styles.legendDotPrincipal} />
                  <Text style={styles.legendText}>Aporte Propio</Text>
                </View>
                {hasPositiveInterest ? (
                  <View style={styles.legendItem}>
                    <View style={styles.legendDotInterest} />
                    <Text style={styles.legendText}>Interés Compuesto</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.chartCanvas}>
              {chartPoints.map((pt, idx) => {
                const totalHeightPct = Math.max(
                  6,
                  Math.round((pt.totalBalance / maxChartValue) * 100)
                );
                const interestSharePct =
                  pt.totalBalance > 0
                    ? Math.min(
                        100,
                        Math.max(
                          hasPositiveInterest && pt.cumulativeInterest > 0
                            ? 10
                            : 0,
                          Math.round(
                            (pt.cumulativeInterest / pt.totalBalance) * 100
                          )
                        )
                      )
                    : 0;
                const principalSharePct = Math.max(0, 100 - interestSharePct);
                const isSelected =
                  (selectedPointIndex === null &&
                    idx === chartPoints.length - 1) ||
                  selectedPointIndex === idx;

                return (
                  <Pressable
                    key={pt.period}
                    onPress={() => setSelectedPointIndex(idx)}
                    style={styles.chartColumnWrapper}
                  >
                    <View style={styles.chartTrackArea}>
                      <View
                        style={[
                          styles.stackedColumn,
                          { height: `${totalHeightPct}%` },
                          isSelected && styles.stackedColumnSelected,
                        ]}
                      >
                        {hasPositiveInterest && interestSharePct > 0 ? (
                          <View
                            style={[
                              styles.layerInterest,
                              { flex: interestSharePct },
                            ]}
                          />
                        ) : null}

                        <View
                          style={[
                            styles.layerPrincipal,
                            !hasPositiveInterest && styles.layerLinearOnly,
                            { flex: Math.max(1, principalSharePct) },
                          ]}
                        />
                      </View>
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.chartAxisLabel,
                        isSelected && styles.chartAxisLabelActive,
                      ]}
                    >
                      {pt.monthLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {inspectedPoint ? (
              <View style={styles.pointInspectorBox}>
                <View style={styles.inspectorHeader}>
                  <Text style={styles.inspectorMonth}>
                    {selectedAccount
                      ? `${selectedAccount.name.toUpperCase()} · `
                      : 'CONSOLIDADO · '}
                    MES #{inspectedPoint.monthIndex} (
                    {formatPeriodFull(inspectedPoint.period).toUpperCase()})
                  </Text>
                  <Text style={styles.inspectorTotal}>
                    Saldo Cierre: {formatCLP(inspectedPoint.totalBalance)}
                  </Text>
                </View>

                <View style={styles.inspectorMetricsRow}>
                  <Text style={styles.inspectorMetricItem}>
                    Aporte del mes: {formatCLP(inspectedPoint.deposit)}
                  </Text>
                  <Text style={styles.inspectorMetricItem}>
                    Acumulado propio:{' '}
                    {formatCLP(inspectedPoint.cumulativeDeposited)}
                  </Text>
                  {hasPositiveInterest ? (
                    <Text style={styles.inspectorMetricInterest}>
                      Interés acumulado: +
                      {formatCLP(inspectedPoint.cumulativeInterest)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </GlassCard>

          {/* Impacto de Gastos / Préstamos que Expiran en el Horizonte */}
          {expiringCommitments.length > 0 ? (
            <GlassCard>
              <View style={styles.expiringHeaderRow}>
                <View style={styles.expiringHeaderLeft}>
                  <Text style={styles.expiringTitle}>
                    IMPULSO AUTOMÁTICO DE SUPERÁVIT · COMPROMISOS QUE FINALIZAN EN ESTE HORIZONTE
                  </Text>
                  <Text style={styles.expiringSubtitle}>
                    Al vencer estos gastos temporales o préstamos, el motor incrementa automáticamente el flujo libre mensual para los meses siguientes:
                  </Text>
                </View>
                <View style={styles.expiringTotalBadge}>
                  <Text style={styles.expiringTotalBadgeLabel}>TOTAL LIBERADO</Text>
                  <Text style={styles.expiringTotalBadgeValue}>
                    +{formatCLP(totalExpiringAmount)} / mes
                  </Text>
                </View>
              </View>

              <View style={styles.expiringList}>
                {expiringCommitments.map((exp, idx) => (
                  <View key={`${exp.title}-${idx}`} style={styles.expiringRow}>
                    <View style={styles.expiringLeft}>
                      <Text style={styles.expiringItemName}>{exp.title}</Text>
                      <Text style={styles.expiringItemDate}>
                        Último pago en {exp.endLabel}
                      </Text>
                    </View>
                    <View style={styles.expiringBadge}>
                      <Text style={styles.expiringBadgeText}>
                        +{formatCLP(exp.amount)} / mes libres
                      </Text>
                    </View>
                  </View>
                ))}

                <View style={styles.expiringTotalFooter}>
                  <Text style={styles.expiringTotalFooterLabel}>
                    Total liberado al término del horizonte ({expiringCommitments.length}{' '}
                    {expiringCommitments.length === 1 ? 'compromiso' : 'compromisos'}):
                  </Text>
                  <Text style={styles.expiringTotalFooterValue}>
                    +{formatCLP(totalExpiringAmount)} / mes
                  </Text>
                </View>
              </View>
            </GlassCard>
          ) : null}
        </>
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  initDualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  initDualBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
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
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
  accountsSelectorScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  accountSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  accountSelectorChipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  accountSelectorChipName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  accountSelectorChipNameActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  accountSelectorRateBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  accountSelectorRateBadgeActive: {
    backgroundColor: 'rgba(5, 5, 5, 0.14)',
  },
  accountSelectorRateText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  accountSelectorRateTextActive: {
    color: colors.buttonPrimaryText,
  },
  activeAccountBanner: {
    paddingVertical: 14,
  },
  activeAccountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  activeAccountInfo: {
    flex: 1,
    minWidth: 180,
    gap: 3,
  },
  activeAccountEyebrow: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  activeAccountName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  activeAccountMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activeAccountHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  partnerBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  partnerSyncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
  },
  partnerSyncedBadgeText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  participationBox: {
    marginTop: 12,
    gap: 6,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  participationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  participationTextMy: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  participationTextPartner: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  participationBar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  participationFillMy: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
  },
  participationFillPartner: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: radius.pill,
  },
  goalBox: {
    marginTop: 10,
    gap: 6,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalTitle: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  goalStatusText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  goalBarTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  goalBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: '#34D399',
  },
  goalRemainingText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  formulaBreakdownText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  activeAccountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  editAccountBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  iconDeleteBtn: {
    padding: 8,
  },
  consolidatedAccountsList: {
    marginTop: 10,
    gap: 8,
  },
  consolidatedAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
  },
  consolidatedAccountLeft: {
    flex: 1,
  },
  consolidatedAccountName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  consolidatedAccountSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  consolidatedAccountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consolidatedAccountBalance: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  smallEditIconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  editorCard: {
    gap: 14,
  },
  editorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
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
    width: '100%',
  },
  ratePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  presetChipActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  presetChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.buttonPrimaryText,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginTop: 4,
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
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentOptionActive: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  segmentOptionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentOptionTextActive: {
    color: colors.buttonPrimaryText,
  },
  partnerFormSection: {
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    backgroundColor: 'rgba(52, 211, 153, 0.03)',
  },
  partnerSumHint: {
    color: ACCENT_GREEN,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  partnerLookupHint: {
    color: colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  partnerFoundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  partnerFoundText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  partnerLookupErrorText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  horizonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  horizonTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  horizonLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
  },
  targetDateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  targetDateBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  sliderControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrackContainer: {
    flex: 1,
    gap: 8,
  },
  sliderTrackBg: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  sliderTrackFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.buttonPrimaryBg,
  },
  sliderTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  sliderTickPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  sliderTickPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  sliderTickText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  sliderTickTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quickHorizonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickHorizonBtn: {
    flex: 1,
    minWidth: 74,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  quickHorizonBtnActive: {
    backgroundColor: colors.buttonPrimaryBg,
    borderColor: colors.buttonPrimaryBg,
  },
  quickHorizonBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickHorizonBtnTextActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  tenPercentDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginTop: 16,
    marginBottom: 14,
  },
  tenPercentToggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tenPercentToggleRowActive: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  toggleCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  toggleCheckboxChecked: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  toggleTextCol: {
    flex: 1,
    gap: 4,
  },
  toggleHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  toggleBadgeActive: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  toggleBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  toggleBadgeTextActive: {
    color: '#34D399',
  },
  toggleSubtitle: {
    color: colors.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  acceleratedBenefitCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    gap: 10,
  },
  acceleratedBenefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceleratedBenefitTitle: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  acceleratedBenefitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  acceleratedBenefitItem: {
    flex: 1,
    minWidth: 120,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  acceleratedBenefitItemHighlight: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  acceleratedBenefitLabel: {
    color: colors.textSecondary,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  acceleratedBenefitVal: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  acceleratedBenefitValOld: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  acceleratedBenefitValNew: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  acceleratedBenefitSub: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },
  summaryCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: 220,
  },
  summaryCardInterest: {
    borderColor: ACCENT_GREEN_BORDER,
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
  },
  summaryCardPartner: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.03)',
  },
  summaryCardLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  summaryCardPartnerLabel: {
    color: '#34D399',
  },
  summaryCardPrimaryValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  summaryCardSecondaryValue: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  summaryCardPartnerValue: {
    color: '#34D399',
  },
  summaryCardHint: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
  },
  interestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  interestCardLabel: {
    color: ACCENT_GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  greenRateBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ACCENT_GREEN_BORDER,
    backgroundColor: ACCENT_GREEN_BG,
  },
  greenRateBadgeText: {
    color: ACCENT_GREEN,
    fontSize: 10,
    fontWeight: '700',
  },
  interestCardValue: {
    color: ACCENT_GREEN,
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  interestCardHint: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  chartTitleCol: {
    flex: 1,
    minWidth: 180,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  chartSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotPrincipal: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  legendDotInterest: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: ACCENT_GREEN,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  chartCanvas: {
    height: 190,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  chartColumnWrapper: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartTrackArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  stackedColumn: {
    width: '78%',
    maxWidth: 28,
    minHeight: 6,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  stackedColumnSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  layerInterest: {
    width: '100%',
    backgroundColor: ACCENT_GREEN,
  },
  layerPrincipal: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  layerLinearOnly: {
    backgroundColor: '#FFFFFF',
  },
  chartAxisLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  chartAxisLabelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  pointInspectorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 6,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  inspectorMonth: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  inspectorTotal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inspectorMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  inspectorMetricItem: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  inspectorMetricInterest: {
    color: ACCENT_GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  expiringHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  expiringHeaderLeft: {
    flex: 1,
    minWidth: 200,
  },
  expiringTotalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ACCENT_GREEN_BORDER,
    backgroundColor: ACCENT_GREEN_BG,
    alignItems: 'flex-end',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  expiringTotalBadgeLabel: {
    color: ACCENT_GREEN,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  expiringTotalBadgeValue: {
    color: ACCENT_GREEN,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  expiringTitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  expiringSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  expiringList: {
    gap: 8,
  },
  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  expiringLeft: {
    flex: 1,
    minWidth: 150,
  },
  expiringItemName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  expiringItemDate: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  expiringBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  expiringBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  expiringTotalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: ACCENT_GREEN_BORDER,
  },
  expiringTotalFooterLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  expiringTotalFooterValue: {
    color: ACCENT_GREEN,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
