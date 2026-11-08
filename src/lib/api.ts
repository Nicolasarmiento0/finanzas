import { clearToken, getToken, saveToken } from './storage';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://finanzapp-api.finanzapp.workers.dev';

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

export type AccountType = 'checking' | 'credit_card' | 'savings' | 'loan';
export type CardBrand = 'santander' | 'falabella' | 'other';
export type RecurringItemType = 'income' | 'expense';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  current_balance: number;
  credit_limit: number;
  interest_rate_annual: number;
  billing_day: number | null;
  card_brand?: CardBrand | null;
  savings_mode: 'fixed' | 'surplus' | null;
  fixed_contribution: number;
  is_shared?: number | boolean;
  partner_name?: string | null;
  partner_initial_balance?: number;
  partner_monthly_contribution?: number;
  target_amount?: number;
  partner_user_id?: string | null;
  creator_name?: string | null;
  partner_user_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringSubItem {
  id: string;
  recurring_item_id: string;
  name: string;
  amount: number;
  created_at: string;
}

export interface RecurringItem {
  id: string;
  user_id: string;
  account_id: string;
  account_name?: string;
  title: string;
  amount: number;
  type: RecurringItemType;
  category: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  sub_items: RecurringSubItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  current_balance?: number;
  credit_limit?: number;
  interest_rate_annual?: number;
  billing_day?: number | null;
  card_brand?: CardBrand | null;
  savings_mode?: 'fixed' | 'surplus' | null;
  fixed_contribution?: number;
  is_shared?: boolean | number;
  partner_name?: string | null;
  partner_initial_balance?: number;
  partner_monthly_contribution?: number;
  target_amount?: number;
  partner_user_id?: string | null;
}

export type UpdateAccountInput = Partial<CreateAccountInput>;

export interface CreateRecurringItemInput {
  account_id: string;
  title: string;
  amount?: number;
  type: RecurringItemType;
  category?: string;
  start_date?: string;
  end_date?: string | null;
  is_active?: boolean;
  sub_items?: Array<{ name: string; amount: number }>;
}

export type UpdateRecurringItemInput = Partial<Omit<CreateRecurringItemInput, 'sub_items'>>;

export interface MonthlyPayment {
  id: string;
  user_id: string;
  target_type: 'recurring_item' | 'loan_installment' | 'credit_card';
  target_id: string;
  period: string;
  is_paid: boolean;
  paid_at: string;
}

export interface VariableExpense {
  id: string;
  user_id: string;
  account_id: string | null;
  title: string;
  amount: number;
  category: string;
  period: string;
  date: string;
  notes: string | null;
  created_at: string;
  account_name?: string | null;
}

export interface CreateVariableExpenseInput {
  title: string;
  amount: number;
  category?: string;
  period?: string;
  date?: string;
  account_id?: string | null;
  notes?: string;
  deduct_from_balance?: boolean;
}

export interface UpdateVariableExpenseInput {
  title?: string;
  amount?: number;
  category?: string;
  period?: string;
  date?: string;
  account_id?: string | null;
  notes?: string;
}

interface AuthResponse {
  token: string;
  user: User;
  error?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) {
    throw new Error('No hay sesión activa');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonSafe<T>(
  response: Response,
  defaultErrorMessage = 'Error de comunicación con el servidor'
): Promise<T> {
  const text = await response.text().catch(() => '');
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${defaultErrorMessage}`);
      }
      throw new Error(`Respuesta inválida del servidor: ${defaultErrorMessage}`);
    }
  }

  if (!response.ok) {
    const errorMsg =
      parsed && typeof parsed === 'object' && typeof parsed.error === 'string'
        ? parsed.error
        : `Error ${response.status}: ${defaultErrorMessage}`;
    throw new Error(errorMsg);
  }

  return (parsed ?? {}) as T;
}

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

export async function loginUser(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as AuthResponse;

  if (!response.ok || !data.token) {
    throw new Error(data.error || 'Error al iniciar sesión');
  }

  await saveToken(data.token);
  return data.user;
}

export async function registerUser(name: string, email: string, password: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const data = (await response.json()) as AuthResponse;

  if (!response.ok || !data.token) {
    throw new Error(data.error || 'Error al crear la cuenta');
  }

  await saveToken(data.token);
  return data.user;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      await clearToken();
      return null;
    }

    const data = (await response.json()) as { user: User };
    return data.user;
  } catch {
    return null;
  }
}

export async function updateUserProfile(input: UpdateProfileInput): Promise<User> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { user?: User; error?: string };
  if (!response.ok || !data.user) {
    throw new Error(data.error || 'Error al actualizar el perfil');
  }
  return data.user;
}

export async function lookupUser(
  query: string
): Promise<{ id: string; name: string; email: string } | null> {
  const q = query.trim();
  if (!q) return null;
  const headers = await getAuthHeaders();
  try {
    const response = await fetch(
      `${API_BASE_URL}/users/lookup?q=${encodeURIComponent(q)}`,
      {
        method: 'GET',
        headers,
      }
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      user?: { id: string; name: string; email: string };
    };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  const token = await getToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignorar fallos de red al cerrar sesión
    }
  }
  await clearToken();
}

// ============================================================================
// CUENTAS FINANCIERAS (/accounts)
// ============================================================================

export async function getAccounts(): Promise<Account[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: 'GET',
    headers,
  });

  const data = (await response.json()) as { accounts?: Account[]; error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener las cuentas');
  }
  return data.accounts ?? [];
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { account?: Account; error?: string };
  if (!response.ok || !data.account) {
    throw new Error(data.error || 'Error al crear la cuenta financiera');
  }
  return data.account;
}

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/accounts/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { account?: Account; error?: string };
  if (!response.ok || !data.account) {
    throw new Error(data.error || 'Error al actualizar la cuenta financiera');
  }
  return data.account;
}

export async function deleteAccount(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/accounts/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || 'Error al eliminar la cuenta financiera');
  }
}

// ============================================================================
// MOVIMIENTOS RECURRENTES (/recurring-items) Y SUB-ÍTEMS
// ============================================================================

export async function getRecurringItems(filters?: {
  account_id?: string;
  type?: RecurringItemType;
}): Promise<RecurringItem[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters?.account_id) params.set('account_id', filters.account_id);
  if (filters?.type) params.set('type', filters.type);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/recurring-items${queryString}`, {
    method: 'GET',
    headers,
  });

  const data = (await response.json()) as { recurring_items?: RecurringItem[]; error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener los ítems recurrentes');
  }
  return data.recurring_items ?? [];
}

export async function createRecurringItem(
  input: CreateRecurringItemInput
): Promise<RecurringItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recurring-items`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { recurring_item?: RecurringItem; error?: string };
  if (!response.ok || !data.recurring_item) {
    throw new Error(data.error || 'Error al crear el ítem recurrente');
  }
  return data.recurring_item;
}

export async function updateRecurringItem(
  id: string,
  input: UpdateRecurringItemInput
): Promise<RecurringItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recurring-items/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { recurring_item?: RecurringItem; error?: string };
  if (!response.ok || !data.recurring_item) {
    throw new Error(data.error || 'Error al actualizar el ítem recurrente');
  }
  return data.recurring_item;
}

export async function deleteRecurringItem(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recurring-items/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Error al eliminar el ítem recurrente');
  }
}

export async function addRecurringSubItem(
  recurringItemId: string,
  input: { name: string; amount: number }
): Promise<{ sub_item: RecurringSubItem; parent_amount: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recurring-items/${recurringItemId}/sub-items`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as {
    sub_item?: RecurringSubItem;
    parent_amount?: number;
    error?: string;
  };
  if (!response.ok || !data.sub_item) {
    throw new Error(data.error || 'Error al agregar el sub-ítem');
  }
  return {
    sub_item: data.sub_item,
    parent_amount: data.parent_amount ?? 0,
  };
}

export async function removeRecurringSubItem(
  recurringItemId: string,
  subItemId: string
): Promise<{ ok: boolean; parent_amount: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/recurring-items/${recurringItemId}/sub-items/${subItemId}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  const data = (await response.json()) as {
    ok?: boolean;
    parent_amount?: number;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || 'Error al eliminar el sub-ítem');
  }
  return {
    ok: true,
    parent_amount: data.parent_amount ?? 0,
  };
}

// ============================================================================
// CHECKLIST DE PAGOS MENSUALES Y CUOTAS DE PRÉSTAMOS (/monthly-payments)
// ============================================================================

export async function getMonthlyPayments(filters?: {
  period?: string;
  target_type?: 'recurring_item' | 'loan_installment';
  target_id?: string;
}): Promise<MonthlyPayment[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters?.period) params.set('period', filters.period);
  if (filters?.target_type) params.set('target_type', filters.target_type);
  if (filters?.target_id) params.set('target_id', filters.target_id);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/monthly-payments${queryString}`, {
    method: 'GET',
    headers,
  });

  const data = (await response.json()) as { payments?: MonthlyPayment[]; error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Error al obtener pagos mensuales');
  }
  return data.payments ?? [];
}

export async function toggleMonthlyPayment(input: {
  target_type: 'recurring_item' | 'loan_installment' | 'credit_card';
  target_id: string;
  period: string;
  is_paid?: boolean;
}): Promise<MonthlyPayment> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/monthly-payments/toggle`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as { payment?: MonthlyPayment; error?: string };
  if (!response.ok || !data.payment) {
    throw new Error(data.error || 'Error al actualizar el estado de pago');
  }
  return data.payment;
}

export async function getVariableExpenses(period?: string): Promise<VariableExpense[]> {
  const headers = await getAuthHeaders();
  const url = period
    ? `${API_BASE_URL}/variable-expenses?period=${encodeURIComponent(period)}`
    : `${API_BASE_URL}/variable-expenses`;
  const response = await fetch(url, { headers });
  const data = await parseJsonSafe<{ expenses?: VariableExpense[]; error?: string }>(
    response,
    'Error al obtener gastos variables'
  );
  return data.expenses ?? [];
}

export async function createVariableExpense(
  input: CreateVariableExpenseInput
): Promise<VariableExpense> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/variable-expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const data = await parseJsonSafe<{ expense?: VariableExpense; error?: string }>(
    response,
    'Error al registrar gasto variable'
  );
  if (!data.expense) {
    throw new Error(data.error || 'Error al registrar gasto variable');
  }
  return data.expense;
}

export async function updateVariableExpense(
  id: string,
  input: UpdateVariableExpenseInput
): Promise<VariableExpense> {
  const headers = await getAuthHeaders();

  // 1. Endpoint nativo PUT /variable-expenses/:id
  try {
    const response = await fetch(`${API_BASE_URL}/variable-expenses/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    });

    const data = await parseJsonSafe<{ expense?: VariableExpense; error?: string }>(
      response,
      'Error al actualizar el gasto variable'
    );
    if (data?.expense) {
      return data.expense;
    }
  } catch (err) {
    const isNotFound = err instanceof Error && err.message.includes('404');
    if (!isNotFound) {
      throw err;
    }
  }

  // 2. Fallback de alta resiliencia si la ruta PUT retornase 404:
  const newExpense = await createVariableExpense({
    title: input.title || 'Gasto',
    amount: input.amount || 0,
    category: input.category || 'general',
    date: input.date,
    period: input.date ? input.date.slice(0, 7) : undefined,
    account_id: input.account_id || undefined,
    deduct_from_balance: false,
  });

  try {
    await deleteVariableExpense(id);
  } catch {
    // Si falla el borrado del anterior, retornamos el nuevo de todas formas
  }

  return newExpense;
}

export interface DeleteVariableExpenseResult {
  success?: boolean;
  balance_restored?: boolean;
  account_id?: string | null;
  restored_amount?: number;
  error?: string;
}

export async function deleteVariableExpense(
  id: string
): Promise<DeleteVariableExpenseResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/variable-expenses/${id}`, {
    method: 'DELETE',
    headers,
  });
  const data = await parseJsonSafe<DeleteVariableExpenseResult>(
    response,
    'Error al eliminar gasto variable'
  );
  return data || { success: true };
}
