import { Platform, Share } from 'react-native';
import { Account, RecurringItem, VariableExpense } from './api';
import {
  accountToSavingsAccount,
  buildMonthlySurplusList,
  calculateConsolidatedForecast,
  calculateForecast,
  DEBT_TITLE_KEYWORDS,
  ForecastResponse,
  isItemActiveInMonth,
  isNonCardDebtItem,
} from './finance';

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvString(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  // UTF-8 BOM (\uFEFF) para que Microsoft Excel detecte acentos y columnas en español automáticamente
  const lines = rows.map((row) => row.map(escapeCsvCell).join(';'));
  return '\uFEFF' + lines.join('\r\n');
}

export async function triggerCsvDownload(filename: string, csvContent: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  // En iOS / Android nativo, usar hoja de compartir del sistema
  await Share.share({
    title: filename,
    message: csvContent,
  });
  return true;
}

export interface MonthlyExportParams {
  period: string;
  accounts: Account[];
  recurringItems: RecurringItem[];
  paidItemIdsInPeriod: Set<string>;
  variableExpenses?: VariableExpense[];
}

/**
 * Tarea 4.2: Exporta el resumen ejecutivo del mes, cuentas, distribución por categoría
 * y el checklist completo de ingresos/gastos fijos del período a CSV compatible con Excel.
 */
export async function exportMonthlyReportToCsv({
  period,
  accounts,
  recurringItems,
  paidItemIdsInPeriod,
  variableExpenses = [],
}: MonthlyExportParams): Promise<string> {
  const activeItems = recurringItems.filter((item) => isItemActiveInMonth(item, period));
  const incomes = activeItems.filter((item) => item.type === 'income');
  const expenses = activeItems.filter((item) => item.type === 'expense');

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, i) => sum + i.amount, 0);
  const freeCashFlow = totalIncome - totalExpense;

  const checkingTotal = accounts
    .filter((a) => a.type === 'checking')
    .reduce((sum, a) => sum + a.current_balance, 0);

  // Excluir cuentas de ahorro en pareja del Patrimonio Neto personal
  const savingsTotal = accounts
    .filter((a) => a.type === 'savings' && !a.is_shared)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const creditCardAccounts = accounts.filter((a) => a.type === 'credit_card');
  const loanAccounts = accounts.filter((a) => a.type === 'loan');
  const creditCardAccountIds = new Set(creditCardAccounts.map((c) => c.id));
  const loanAccountIds = new Set(loanAccounts.map((l) => l.id));

  // 1. Deuda de Tarjetas de Crédito
  const creditCardsDebt = creditCardAccounts.reduce((sum, card) => {
    const cardCharges = expenses
      .filter((e) => e.account_id === card.id)
      .reduce((s, e) => s + e.amount, 0);
    return sum + card.current_balance + cardCharges;
  }, 0);

  // 2. Deuda en cuentas tipo Préstamo
  const loansDebt = loanAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  // 3. Deuda en compromisos fijos de préstamo o crédito fuera de tarjeta
  const fixedLoansDebt = expenses
    .filter((item) => isNonCardDebtItem(item, creditCardAccountIds, loanAccountIds))
    .reduce((s, item) => s + item.amount, 0);

  // 4. Deuda en gastos variables del mes
  const variableDebts = variableExpenses
    .filter((exp) => {
      const expPeriod = exp.period || exp.date?.slice(0, 7);
      if (expPeriod !== period) return false;
      const cat = (exp.category || '').toLowerCase().trim();
      const title = (exp.title || '').toLowerCase();
      return (
        cat === 'prestamo' ||
        DEBT_TITLE_KEYWORDS.some((kw) => title.includes(kw))
      );
    })
    .reduce((s, exp) => s + exp.amount, 0);

  const totalDebt = creditCardsDebt + loansDebt + fixedLoansDebt + variableDebts;
  const netWorth = checkingTotal + savingsTotal - totalDebt;

  // Agrupación de gastos por categoría
  const categoryTotals = new Map<string, number>();
  for (const exp of expenses) {
    const cat = (exp.category || 'general').toLowerCase();
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + exp.amount);
  }

  const rows: Array<Array<string | number>> = [
    ['FINANZAPP - REPORTE EJECUTIVO MENSUAL', period],
    ['Generado el', new Date().toLocaleDateString('es-CL')],
    [],
    ['1. RESUMEN PATRIMONIAL Y FLUJO DE CAJA', 'MONTO (CLP)'],
    ['Liquidez en Cuentas Corrientes', checkingTotal],
    ['Capital en Cuentas de Ahorro', savingsTotal],
    ['Deuda en Tarjetas de Crédito', creditCardsDebt],
    ['Deuda en Préstamos & Créditos Fijos', fixedLoansDebt],
    ['Deuda en Cuentas Préstamo', loansDebt],
    ['Deuda en Gastos Variables', variableDebts],
    ['DEUDAS TOTALES CONSOLIDADAS', totalDebt],
    ['PATRIMONIO NETO CONSOLIDADO', netWorth],
    ['Ingresos Fijos del Mes', totalIncome],
    ['Gastos Fijos Activos del Mes', totalExpense],
    ['FLUJO DE CAJA LIBRE ESTIMADO', freeCashFlow],
    [],
    ['2. CUENTAS FINANCIERAS', 'TIPO', 'SALDO ACTUAL (CLP)', 'CUPO TOTAL (CLP)', 'TASA ANUAL (%)'],
    ...accounts.map((acc) => [
      acc.name,
      acc.type,
      acc.current_balance,
      acc.credit_limit || 0,
      acc.interest_rate_annual || 0,
    ]),
    [],
    ['3. DISTRIBUCIÓN DE GASTOS POR CATEGORÍA', 'MONTO (CLP)', 'PORCENTAJE (%)'],
    ...Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => [
        cat.toUpperCase(),
        amount,
        totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(1)) : 0,
      ]),
    [],
    [
      '4. DETALLE DE MOVIMIENTOS DEL MES',
      'TIPO',
      'CATEGORÍA',
      'CUENTA',
      'MONTO (CLP)',
      'INICIO',
      'FIN VIGENCIA',
      'ESTADO PAGO',
      'DESGLOSE SUB-ÍTEMS',
    ],
    ...activeItems.map((item) => [
      item.title,
      item.type === 'income' ? 'Ingreso' : 'Gasto',
      item.category,
      item.account_name || '',
      item.amount,
      item.start_date,
      item.end_date || 'Permanente',
      item.type === 'income'
        ? 'Recibido'
        : paidItemIdsInPeriod.has(item.id)
          ? 'Pagado'
          : 'Pendiente',
      item.sub_items.length > 0
        ? item.sub_items.map((s) => `${s.name}: $${s.amount}`).join(' | ')
        : '',
    ]),
  ];

  const csvContent = buildCsvString(rows);
  const filename = `finanzapp_resumen_${period}.csv`;
  await triggerCsvDownload(filename, csvContent);
  return filename;
}

export interface ForecastExportParams {
  period: string;
  monthsAhead: number;
  accounts: Account[];
  recurringItems: RecurringItem[];
  selectedAccountId?: string;
}

/**
 * Tarea 4.2: Exporta la proyección mes a mes del motor de ahorro dual a CSV/Excel.
 */
export async function exportForecastReportToCsv({
  period,
  monthsAhead,
  accounts,
  recurringItems,
  selectedAccountId,
}: ForecastExportParams): Promise<string> {
  const savingsAccounts = accounts
    .filter((a) => a.type === 'savings')
    .map((a) => accountToSavingsAccount(a));

  const monthlySurplusList = buildMonthlySurplusList(recurringItems, period, monthsAhead);
  const [yearStr, monthStr] = period.split('-');
  const startDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);

  let forecast: ForecastResponse;
  let reportTitle = 'CONSOLIDADO TOTAL DE AHORRO';

  if (selectedAccountId && selectedAccountId !== 'CONSOLIDATED') {
    const found = savingsAccounts.find((a) => a.id === selectedAccountId);
    if (found) {
      forecast = calculateForecast(found, monthsAhead, monthlySurplusList, startDate);
      reportTitle = `${found.name} (${(found.annualRate * 100).toFixed(2)}% Anual)`;
    } else {
      forecast = calculateConsolidatedForecast(
        savingsAccounts,
        monthsAhead,
        monthlySurplusList,
        startDate
      );
    }
  } else {
    forecast = calculateConsolidatedForecast(
      savingsAccounts,
      monthsAhead,
      monthlySurplusList,
      startDate
    );
  }

  const rows: Array<Array<string | number>> = [
    ['FINANZAPP - PRONÓSTICO DE AHORRO E INTERÉS COMPUESTO', reportTitle],
    ['Período Base', period],
    ['Horizonte Proyectado (Meses)', monthsAhead],
    ['Fecha Objetivo', forecast.targetMonthLabel],
    ['Saldo Final Estimado (CLP)', forecast.finalBalance],
    ['Total Aportado de tu Bolsillo (CLP)', forecast.totalDeposited],
    ['Ganancia por Intereses Acumulada (CLP)', forecast.totalInterest],
    [],
    [
      'MES #',
      'FECHA',
      'SUPERÁVIT MENSUAL ESTIMADO (CLP)',
      'TU APORTE MENSUAL (CLP)',
      'APORTE PAREJA MENSUAL (CLP)',
      'APORTE TOTAL DEL MES (CLP)',
      'INTERÉS GANADO EN EL MES (CLP)',
      'TU CAPITAL ACUMULADO (CLP)',
      'CAPITAL PAREJA ACUMULADO (CLP)',
      'CAPITAL TOTAL ACUMULADO (CLP)',
      'INTERÉS ACUMULADO (CLP)',
      'SALDO TOTAL CIERRE DE MES (CLP)',
    ],
    ...forecast.points.map((pt, idx) => [
      pt.monthIndex,
      pt.monthLabel,
      monthlySurplusList[idx] ?? 0,
      pt.myDeposit,
      pt.partnerDeposit,
      pt.deposit,
      pt.interestEarned,
      pt.myCumulativeDeposited,
      pt.partnerCumulativeDeposited,
      pt.cumulativeDeposited,
      pt.cumulativeInterest,
      pt.totalBalance,
    ]),
  ];

  const csvContent = buildCsvString(rows);
  const filename = `finanzapp_pronostico_${monthsAhead}m_${period}.csv`;
  await triggerCsvDownload(filename, csvContent);
  return filename;
}
