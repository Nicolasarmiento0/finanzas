import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateSessionToken, hashPassword, hashToken, verifyPassword } from './auth';

export type Bindings = {
  DB: D1Database;
};

export type AccountType = 'checking' | 'credit_card' | 'savings' | 'loan';
export type CardBrand = 'santander' | 'falabella' | 'other';
export type RecurringItemType = 'income' | 'expense';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  currency: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  current_balance: number;
  credit_limit: number;
  interest_rate_annual: number;
  billing_day: number | null;
  card_brand: CardBrand | null;
  savings_mode: 'fixed' | 'surplus' | null;
  fixed_contribution: number;
  is_shared: number;
  partner_name: string | null;
  partner_initial_balance: number;
  partner_monthly_contribution: number;
  target_amount: number;
  partner_user_id: string | null;
  creator_name?: string | null;
  partner_user_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringItemRow {
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
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringSubItemRow {
  id: string;
  recurring_item_id: string;
  name: string;
  amount: number;
  created_at: string;
}

export interface MonthlyPaymentRow {
  id: string;
  user_id: string;
  target_type: 'recurring_item' | 'loan_installment' | 'credit_card';
  target_id: string;
  period: string;
  is_paid: number;
  paid_at: string;
}

export interface VariableExpenseRow {
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

const VALID_ACCOUNT_TYPES: AccountType[] = ['checking', 'credit_card', 'savings', 'loan'];
const VALID_RECURRING_TYPES: RecurringItemType[] = ['income', 'expense'];

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

async function getAuthenticatedUser(c: Context<{ Bindings: Bindings }>): Promise<AuthUser | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const tokenHash = await hashToken(token);

  const session = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.currency, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first<AuthUser & { expires_at: string }>();

  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    currency: session.currency,
  };
}

async function recalculateParentAmount(db: D1Database, recurringItemId: string): Promise<number | null> {
  const stats = await db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM recurring_sub_items
       WHERE recurring_item_id = ?`
    )
    .bind(recurringItemId)
    .first<{ count: number; total: number }>();

  if (stats && stats.count > 0) {
    await db
      .prepare(`UPDATE recurring_items SET amount = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(Math.round(stats.total), recurringItemId)
      .run();
    return Math.round(stats.total);
  }
  return null;
}

app.get('/', (c) => {
  return c.json({
    service: 'FinanzApp Cloudflare API',
    currency: 'CLP',
    status: 'ok',
  });
});

// ============================================================================
// AUTENTICACIÓN (/auth)
// ============================================================================

app.post('/auth/register', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; name?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const name = body.name?.trim();

  if (!email || !password || !name) {
    return c.json({ error: 'Nombre, correo y contraseña requeridos' }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (existing) {
    return c.json({ error: 'El correo ya está registrado' }, 409);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash, currency) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(userId, email, name, passwordHash, 'CLP')
    .run();

  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(sessionId, userId, tokenHash, expiresAt)
    .run();

  return c.json({
    token,
    user: { id: userId, email, name, currency: 'CLP' },
  });
});

app.post('/auth/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return c.json({ error: 'Correo y contraseña requeridos' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, password_hash, currency FROM users WHERE email = ?'
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
      currency: string;
    }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(sessionId, user.id, tokenHash, expiresAt)
    .run();

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      currency: user.currency,
    },
  });
});

app.get('/auth/me', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Sesión expirada o inválida' }, 401);
  }

  return c.json({ user });
});

app.put('/auth/profile', async (c) => {
  const authUser = await getAuthenticatedUser(c);
  if (!authUser) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const body = await c.req.json<{
    name?: string;
    email?: string;
    current_password?: string;
    new_password?: string;
  }>();

  const existingUser = await c.env.DB.prepare(
    'SELECT id, email, name, password_hash, currency FROM users WHERE id = ?'
  )
    .bind(authUser.id)
    .first<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
      currency: string;
    }>();

  if (!existingUser) {
    return c.json({ error: 'Usuario no encontrado' }, 404);
  }

  const updatedName = body.name !== undefined ? body.name.trim() : existingUser.name;
  const updatedEmail =
    body.email !== undefined ? body.email.trim().toLowerCase() : existingUser.email;

  if (!updatedName) {
    return c.json({ error: 'El nombre no puede estar vacío' }, 400);
  }
  if (!updatedEmail || !updatedEmail.includes('@')) {
    return c.json({ error: 'Ingresa un correo electrónico válido' }, 400);
  }

  if (updatedEmail !== existingUser.email) {
    const emailConflict = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    )
      .bind(updatedEmail, existingUser.id)
      .first();

    if (emailConflict) {
      return c.json({ error: 'Ese correo electrónico ya está registrado por otra cuenta' }, 409);
    }
  }

  let updatedPasswordHash = existingUser.password_hash;
  if (body.new_password !== undefined && body.new_password.length > 0) {
    if (body.new_password.length < 6) {
      return c.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres' },
        400
      );
    }
    if (!body.current_password) {
      return c.json(
        { error: 'Debes ingresar tu contraseña actual para cambiar la contraseña' },
        400
      );
    }
    const validCurrent = await verifyPassword(
      body.current_password,
      existingUser.password_hash
    );
    if (!validCurrent) {
      return c.json({ error: 'La contraseña actual es incorrecta' }, 401);
    }
    updatedPasswordHash = await hashPassword(body.new_password);
  }

  await c.env.DB.prepare(
    `UPDATE users
     SET name = ?, email = ?, password_hash = ?
     WHERE id = ?`
  )
    .bind(updatedName, updatedEmail, updatedPasswordHash, existingUser.id)
    .run();

  return c.json({
    user: {
      id: existingUser.id,
      email: updatedEmail,
      name: updatedName,
      currency: existingUser.currency,
    },
  });
});

app.get('/users/lookup', async (c) => {
  const authUser = await getAuthenticatedUser(c);
  if (!authUser) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const query = c.req.query('q')?.trim();
  if (!query) {
    return c.json({ error: 'Parámetro de búsqueda requerido' }, 400);
  }

  const found = await c.env.DB.prepare(
    `SELECT id, name, email
     FROM users
     WHERE (id = ? OR LOWER(email) = LOWER(?)) AND id != ?`
  )
    .bind(query, query, authUser.id)
    .first<{ id: string; name: string; email: string }>();

  if (!found) {
    return c.json({ error: 'Usuario no encontrado' }, 404);
  }

  return c.json({ user: found });
});

app.post('/auth/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenHash = await hashToken(token);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }
  return c.json({ ok: true });
});

// ============================================================================
// TAREA 1.2: ENDPOINTS CRUD DE CUENTAS FINANCIERAS (/accounts)
// ============================================================================

// Listar cuentas del usuario (incluyendo cuentas compartidas donde sea titular o pareja)
app.get('/accounts', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.user_id, a.name, a.type, a.current_balance, a.credit_limit, a.interest_rate_annual,
            a.billing_day, a.card_brand, a.savings_mode, a.fixed_contribution,
            a.is_shared, a.partner_name, a.partner_initial_balance, a.partner_monthly_contribution, a.target_amount,
            a.partner_user_id,
            u_creator.name as creator_name,
            u_partner.name as partner_user_name,
            a.created_at, a.updated_at
     FROM accounts a
     LEFT JOIN users u_creator ON a.user_id = u_creator.id
     LEFT JOIN users u_partner ON a.partner_user_id = u_partner.id
     WHERE a.user_id = ? OR a.partner_user_id = ?
     ORDER BY a.created_at ASC`
  )
    .bind(user.id, user.id)
    .all<AccountRow>();

  return c.json({ accounts: results ?? [] });
});

// Crear cuenta financiera
app.post('/accounts', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const body = await c.req.json<{
    name?: string;
    type?: AccountType;
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
  }>();

  const name = body.name?.trim();
  const type = body.type;

  if (!name) {
    return c.json({ error: 'El nombre de la cuenta es obligatorio' }, 400);
  }
  if (!type || !VALID_ACCOUNT_TYPES.includes(type)) {
    return c.json(
      { error: 'Tipo de cuenta inválido. Debe ser checking, credit_card, savings o loan' },
      400
    );
  }

  const id = crypto.randomUUID();
  const currentBalance = Math.round(Number(body.current_balance ?? 0));
  const creditLimit = Math.round(Number(body.credit_limit ?? 0));
  const interestRateAnnual = Number(body.interest_rate_annual ?? 0);
  const billingDay = body.billing_day != null ? Number(body.billing_day) : null;
  const cardBrand =
    body.card_brand === 'santander' ||
    body.card_brand === 'falabella' ||
    body.card_brand === 'other'
      ? body.card_brand
      : null;
  const savingsMode =
    body.savings_mode === 'fixed' || body.savings_mode === 'surplus' ? body.savings_mode : null;
  const fixedContribution = Math.round(Number(body.fixed_contribution ?? 0));
  const isShared = body.is_shared ? 1 : 0;
  let partnerName = body.partner_name ? body.partner_name.trim() : null;
  const partnerInitialBalance = Math.max(0, Math.round(Number(body.partner_initial_balance ?? 0)));
  const partnerMonthlyContribution = Math.max(
    0,
    Math.round(Number(body.partner_monthly_contribution ?? 0))
  );
  const targetAmount = Math.max(0, Math.round(Number(body.target_amount ?? 0)));

  let resolvedPartnerUserId: string | null = null;
  const rawPartnerInput = body.partner_user_id ? body.partner_user_id.trim() : null;

  if (isShared && rawPartnerInput) {
    const partnerUser = await c.env.DB.prepare(
      'SELECT id, name, email FROM users WHERE id = ? OR LOWER(email) = LOWER(?)'
    )
      .bind(rawPartnerInput, rawPartnerInput)
      .first<{ id: string; name: string; email: string }>();

    if (!partnerUser) {
      return c.json(
        { error: 'No se encontró ningún usuario con ese ID o correo' },
        400
      );
    }
    if (partnerUser.id === user.id) {
      return c.json(
        { error: 'No puedes compartir una cuenta contigo mismo' },
        400
      );
    }
    resolvedPartnerUserId = partnerUser.id;
    if (!partnerName || partnerName === 'Pareja') {
      partnerName = partnerUser.name;
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO accounts (
      id, user_id, name, type, current_balance, credit_limit, interest_rate_annual,
      billing_day, card_brand, savings_mode, fixed_contribution,
      is_shared, partner_name, partner_initial_balance, partner_monthly_contribution, target_amount, partner_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      user.id,
      name,
      type,
      currentBalance,
      creditLimit,
      interestRateAnnual,
      billingDay,
      cardBrand,
      savingsMode,
      fixedContribution,
      isShared,
      partnerName,
      partnerInitialBalance,
      partnerMonthlyContribution,
      targetAmount,
      resolvedPartnerUserId
    )
    .run();

  const created = await c.env.DB.prepare(
    `SELECT a.*, u_creator.name as creator_name, u_partner.name as partner_user_name
     FROM accounts a
     LEFT JOIN users u_creator ON a.user_id = u_creator.id
     LEFT JOIN users u_partner ON a.partner_user_id = u_partner.id
     WHERE a.id = ?`
  )
    .bind(id)
    .first<AccountRow>();

  return c.json({ account: created }, 201);
});

// Editar cuenta financiera
app.put('/accounts/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const accountId = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND (user_id = ? OR partner_user_id = ?)'
  )
    .bind(accountId, user.id, user.id)
    .first<AccountRow>();

  if (!existing) {
    return c.json({ error: 'Cuenta no encontrada' }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    type?: AccountType;
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
  }>();

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const type = body.type !== undefined ? body.type : existing.type;

  if (!name) {
    return c.json({ error: 'El nombre de la cuenta no puede estar vacío' }, 400);
  }
  if (!VALID_ACCOUNT_TYPES.includes(type)) {
    return c.json(
      { error: 'Tipo de cuenta inválido. Debe ser checking, credit_card, savings o loan' },
      400
    );
  }

  const currentBalance =
    body.current_balance !== undefined
      ? Math.round(Number(body.current_balance))
      : existing.current_balance;
  const creditLimit =
    body.credit_limit !== undefined ? Math.round(Number(body.credit_limit)) : existing.credit_limit;
  const interestRateAnnual =
    body.interest_rate_annual !== undefined
      ? Number(body.interest_rate_annual)
      : existing.interest_rate_annual;
  const billingDay =
    body.billing_day !== undefined
      ? body.billing_day != null
        ? Number(body.billing_day)
        : null
      : existing.billing_day;
  const cardBrand =
    body.card_brand !== undefined
      ? body.card_brand === 'santander' ||
        body.card_brand === 'falabella' ||
        body.card_brand === 'other'
        ? body.card_brand
        : null
      : existing.card_brand;
  const savingsMode =
    body.savings_mode !== undefined ? body.savings_mode : existing.savings_mode;
  const fixedContribution =
    body.fixed_contribution !== undefined
      ? Math.round(Number(body.fixed_contribution))
      : existing.fixed_contribution;
  const isShared =
    body.is_shared !== undefined ? (body.is_shared ? 1 : 0) : existing.is_shared;
  let partnerName =
    body.partner_name !== undefined
      ? body.partner_name
        ? body.partner_name.trim()
        : null
      : existing.partner_name;
  const partnerInitialBalance =
    body.partner_initial_balance !== undefined
      ? Math.max(0, Math.round(Number(body.partner_initial_balance)))
      : existing.partner_initial_balance;
  const partnerMonthlyContribution =
    body.partner_monthly_contribution !== undefined
      ? Math.max(0, Math.round(Number(body.partner_monthly_contribution)))
      : existing.partner_monthly_contribution;
  const targetAmount =
    body.target_amount !== undefined
      ? Math.max(0, Math.round(Number(body.target_amount)))
      : existing.target_amount;

  let resolvedPartnerUserId = existing.partner_user_id;
  if (body.partner_user_id !== undefined) {
    const raw = body.partner_user_id ? body.partner_user_id.trim() : null;
    if (!raw) {
      resolvedPartnerUserId = null;
    } else {
      const partnerUser = await c.env.DB.prepare(
        'SELECT id, name, email FROM users WHERE id = ? OR LOWER(email) = LOWER(?)'
      )
        .bind(raw, raw)
        .first<{ id: string; name: string; email: string }>();

      if (!partnerUser) {
        return c.json(
          { error: 'No se encontró ningún usuario con ese ID o correo' },
          400
        );
      }
      if (partnerUser.id === existing.user_id) {
        return c.json(
          { error: 'No puedes compartir una cuenta contigo mismo' },
          400
        );
      }
      resolvedPartnerUserId = partnerUser.id;
      if (!partnerName || partnerName === 'Pareja') {
        partnerName = partnerUser.name;
      }
    }
  }

  await c.env.DB.prepare(
    `UPDATE accounts
     SET name = ?,
         type = ?,
         current_balance = ?,
         credit_limit = ?,
         interest_rate_annual = ?,
         billing_day = ?,
         card_brand = ?,
         savings_mode = ?,
         fixed_contribution = ?,
         is_shared = ?,
         partner_name = ?,
         partner_initial_balance = ?,
         partner_monthly_contribution = ?,
         target_amount = ?,
         partner_user_id = ?,
         updated_at = datetime('now')
     WHERE id = ? AND (user_id = ? OR partner_user_id = ?)`
  )
    .bind(
      name,
      type,
      currentBalance,
      creditLimit,
      interestRateAnnual,
      billingDay,
      cardBrand,
      savingsMode,
      fixedContribution,
      isShared,
      partnerName,
      partnerInitialBalance,
      partnerMonthlyContribution,
      targetAmount,
      resolvedPartnerUserId,
      accountId,
      user.id,
      user.id
    )
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT a.*, u_creator.name as creator_name, u_partner.name as partner_user_name
     FROM accounts a
     LEFT JOIN users u_creator ON a.user_id = u_creator.id
     LEFT JOIN users u_partner ON a.partner_user_id = u_partner.id
     WHERE a.id = ?`
  )
    .bind(accountId)
    .first<AccountRow>();

  return c.json({ account: updated });
});

// Eliminar cuenta financiera
app.delete('/accounts/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const accountId = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ? AND (user_id = ? OR partner_user_id = ?)'
  )
    .bind(accountId, user.id, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Cuenta no encontrada' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM accounts WHERE id = ? AND (user_id = ? OR partner_user_id = ?)')
    .bind(accountId, user.id, user.id)
    .run();

  return c.json({ ok: true });
});

// ============================================================================
// TAREA 1.2: ENDPOINTS CRUD DE MOVIMIENTOS RECURRENTES (/recurring-items)
// ============================================================================

// Listar ítems recurrentes (incluyendo sub-ítems anidados)
app.get('/recurring-items', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const accountIdFilter = c.req.query('account_id');
  const typeFilter = c.req.query('type');

  let query = `
    SELECT r.*, a.name as account_name
    FROM recurring_items r
    JOIN accounts a ON a.id = r.account_id
    WHERE r.user_id = ?
  `;
  const params: (string | number)[] = [user.id];

  if (accountIdFilter) {
    query += ` AND r.account_id = ?`;
    params.push(accountIdFilter);
  }
  if (typeFilter && VALID_RECURRING_TYPES.includes(typeFilter as RecurringItemType)) {
    query += ` AND r.type = ?`;
    params.push(typeFilter);
  }

  query += ` ORDER BY r.created_at ASC`;

  const { results: items } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<RecurringItemRow>();

  const itemList = items ?? [];
  if (itemList.length === 0) {
    return c.json({ recurring_items: [] });
  }

  // Obtener todos los sub-ítems asociados a los ítems recurrentes del usuario
  const { results: subItems } = await c.env.DB.prepare(
    `SELECT s.*
     FROM recurring_sub_items s
     JOIN recurring_items r ON r.id = s.recurring_item_id
     WHERE r.user_id = ?
     ORDER BY s.created_at ASC`
  )
    .bind(user.id)
    .all<RecurringSubItemRow>();

  const subItemsByParent = new Map<string, RecurringSubItemRow[]>();
  for (const sub of subItems ?? []) {
    const group = subItemsByParent.get(sub.recurring_item_id) ?? [];
    group.push(sub);
    subItemsByParent.set(sub.recurring_item_id, group);
  }

  const enriched = itemList.map((item) => ({
    ...item,
    is_active: Boolean(item.is_active),
    sub_items: subItemsByParent.get(item.id) ?? [],
  }));

  return c.json({ recurring_items: enriched });
});

// Crear ítem recurrente (ingreso fijo o gasto fijo, con soporte opcional para sub-ítems iniciales)
app.post('/recurring-items', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const body = await c.req.json<{
    account_id?: string;
    title?: string;
    amount?: number;
    type?: RecurringItemType;
    category?: string;
    start_date?: string;
    end_date?: string | null;
    is_active?: boolean;
    sub_items?: Array<{ name: string; amount: number }>;
  }>();

  const accountId = body.account_id?.trim();
  const title = body.title?.trim();
  const type = body.type;

  if (!accountId || !title || !type) {
    return c.json({ error: 'Cuenta (account_id), título (title) y tipo (type) son obligatorios' }, 400);
  }
  if (!VALID_RECURRING_TYPES.includes(type)) {
    return c.json({ error: 'El tipo debe ser income o expense' }, 400);
  }

  const account = await c.env.DB.prepare(
    'SELECT id, name FROM accounts WHERE id = ? AND user_id = ?'
  )
    .bind(accountId, user.id)
    .first<{ id: string; name: string }>();

  if (!account) {
    return c.json({ error: 'La cuenta especificada no existe o no pertenece al usuario' }, 404);
  }

  const itemId = crypto.randomUUID();
  const category = body.category?.trim() || 'general';
  const startDate = body.start_date?.trim() || new Date().toISOString().slice(0, 10);
  const endDate = body.end_date ? body.end_date.trim() : null;
  const isActive = body.is_active === false ? 0 : 1;

  const initialSubItems = Array.isArray(body.sub_items) ? body.sub_items : [];
  const calculatedAmount =
    initialSubItems.length > 0
      ? initialSubItems.reduce((sum, s) => sum + Math.round(Number(s.amount || 0)), 0)
      : Math.round(Number(body.amount ?? 0));

  await c.env.DB.prepare(
    `INSERT INTO recurring_items (
      id, user_id, account_id, title, amount, type, category, start_date, end_date, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      itemId,
      user.id,
      accountId,
      title,
      calculatedAmount,
      type,
      category,
      startDate,
      endDate,
      isActive
    )
    .run();

  const createdSubItems: RecurringSubItemRow[] = [];
  for (const sub of initialSubItems) {
    const subName = sub.name?.trim();
    if (!subName) continue;
    const subId = crypto.randomUUID();
    const subAmount = Math.round(Number(sub.amount ?? 0));
    await c.env.DB.prepare(
      `INSERT INTO recurring_sub_items (id, recurring_item_id, name, amount)
       VALUES (?, ?, ?, ?)`
    )
      .bind(subId, itemId, subName, subAmount)
      .run();

    const row = await c.env.DB.prepare('SELECT * FROM recurring_sub_items WHERE id = ?')
      .bind(subId)
      .first<RecurringSubItemRow>();
    if (row) createdSubItems.push(row);
  }

  const created = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE id = ?')
    .bind(itemId)
    .first<RecurringItemRow>();

  return c.json(
    {
      recurring_item: created
        ? {
            ...created,
            account_name: account.name,
            is_active: Boolean(created.is_active),
            sub_items: createdSubItems,
          }
        : null,
    },
    201
  );
});

// Editar ítem recurrente
app.put('/recurring-items/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const itemId = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT * FROM recurring_items WHERE id = ? AND user_id = ?'
  )
    .bind(itemId, user.id)
    .first<RecurringItemRow>();

  if (!existing) {
    return c.json({ error: 'Ítem recurrente no encontrado' }, 404);
  }

  const body = await c.req.json<{
    account_id?: string;
    title?: string;
    amount?: number;
    type?: RecurringItemType;
    category?: string;
    start_date?: string;
    end_date?: string | null;
    is_active?: boolean;
  }>();

  const accountId = body.account_id !== undefined ? body.account_id.trim() : existing.account_id;
  if (accountId !== existing.account_id) {
    const accountCheck = await c.env.DB.prepare(
      'SELECT id FROM accounts WHERE id = ? AND user_id = ?'
    )
      .bind(accountId, user.id)
      .first();
    if (!accountCheck) {
      return c.json({ error: 'La cuenta de destino no existe o no pertenece al usuario' }, 404);
    }
  }

  const title = body.title !== undefined ? body.title.trim() : existing.title;
  const type = body.type !== undefined ? body.type : existing.type;
  if (!title) {
    return c.json({ error: 'El título no puede estar vacío' }, 400);
  }
  if (!VALID_RECURRING_TYPES.includes(type)) {
    return c.json({ error: 'El tipo debe ser income o expense' }, 400);
  }

  const amount =
    body.amount !== undefined ? Math.round(Number(body.amount)) : existing.amount;
  const category =
    body.category !== undefined ? body.category.trim() : existing.category;
  const startDate =
    body.start_date !== undefined ? body.start_date.trim() : existing.start_date;
  const endDate =
    body.end_date !== undefined
      ? body.end_date
        ? body.end_date.trim()
        : null
      : existing.end_date;
  const isActive =
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active;

  await c.env.DB.prepare(
    `UPDATE recurring_items
     SET account_id = ?,
         title = ?,
         amount = ?,
         type = ?,
         category = ?,
         start_date = ?,
         end_date = ?,
         is_active = ?,
         updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      accountId,
      title,
      amount,
      type,
      category,
      startDate,
      endDate,
      isActive,
      itemId,
      user.id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM recurring_items WHERE id = ?')
    .bind(itemId)
    .first<RecurringItemRow>();

  const { results: subItems } = await c.env.DB.prepare(
    'SELECT * FROM recurring_sub_items WHERE recurring_item_id = ? ORDER BY created_at ASC'
  )
    .bind(itemId)
    .all<RecurringSubItemRow>();

  return c.json({
    recurring_item: updated
      ? {
          ...updated,
          is_active: Boolean(updated.is_active),
          sub_items: subItems ?? [],
        }
      : null,
  });
});

// Eliminar ítem recurrente
app.delete('/recurring-items/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const itemId = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT id FROM recurring_items WHERE id = ? AND user_id = ?'
  )
    .bind(itemId, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Ítem recurrente no encontrado' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM recurring_items WHERE id = ? AND user_id = ?')
    .bind(itemId, user.id)
    .run();

  return c.json({ ok: true });
});

// ============================================================================
// TAREA 1.2: SUB-ÍTEMS ANIDADOS (/recurring-items/:id/sub-items)
// ============================================================================

// Agregar sub-ítem anidado a un gasto/ítem recurrente matriz (ej: Apple + YouTube + SmartFit)
app.post('/recurring-items/:id/sub-items', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const recurringItemId = c.req.param('id');
  const parentItem = await c.env.DB.prepare(
    'SELECT * FROM recurring_items WHERE id = ? AND user_id = ?'
  )
    .bind(recurringItemId, user.id)
    .first<RecurringItemRow>();

  if (!parentItem) {
    return c.json({ error: 'Ítem recurrente matriz no encontrado' }, 404);
  }

  const body = await c.req.json<{ name?: string; amount?: number }>();
  const name = body.name?.trim();
  if (!name || body.amount === undefined) {
    return c.json({ error: 'Nombre (name) y monto (amount) del sub-ítem son obligatorios' }, 400);
  }

  const subId = crypto.randomUUID();
  const amount = Math.round(Number(body.amount));

  await c.env.DB.prepare(
    `INSERT INTO recurring_sub_items (id, recurring_item_id, name, amount)
     VALUES (?, ?, ?, ?)`
  )
    .bind(subId, recurringItemId, name, amount)
    .run();

  const newParentAmount = await recalculateParentAmount(c.env.DB, recurringItemId);

  const subItem = await c.env.DB.prepare('SELECT * FROM recurring_sub_items WHERE id = ?')
    .bind(subId)
    .first<RecurringSubItemRow>();

  return c.json(
    {
      sub_item: subItem,
      parent_amount: newParentAmount ?? parentItem.amount,
    },
    201
  );
});

// Remover sub-ítem anidado de un gasto/ítem recurrente matriz
app.delete('/recurring-items/:id/sub-items/:subId', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const recurringItemId = c.req.param('id');
  const subId = c.req.param('subId');

  const parentItem = await c.env.DB.prepare(
    'SELECT * FROM recurring_items WHERE id = ? AND user_id = ?'
  )
    .bind(recurringItemId, user.id)
    .first<RecurringItemRow>();

  if (!parentItem) {
    return c.json({ error: 'Ítem recurrente matriz no encontrado' }, 404);
  }

  const existingSub = await c.env.DB.prepare(
    'SELECT id FROM recurring_sub_items WHERE id = ? AND recurring_item_id = ?'
  )
    .bind(subId, recurringItemId)
    .first();

  if (!existingSub) {
    return c.json({ error: 'Sub-ítem no encontrado' }, 404);
  }

  await c.env.DB.prepare(
    'DELETE FROM recurring_sub_items WHERE id = ? AND recurring_item_id = ?'
  )
    .bind(subId, recurringItemId)
    .run();

  const newParentAmount = await recalculateParentAmount(c.env.DB, recurringItemId);

  return c.json({
    ok: true,
    parent_amount: newParentAmount ?? 0,
  });
});

// ============================================================================
// FASE 2: CHECKLIST DE PAGOS MENSUALES Y CUOTAS DE PRÉSTAMOS (/monthly-payments)
// ============================================================================

app.get('/monthly-payments', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const period = c.req.query('period');
  const targetType = c.req.query('target_type');
  const targetId = c.req.query('target_id');

  let query = `SELECT * FROM monthly_payments WHERE user_id = ?`;
  const params: string[] = [user.id];

  if (period) {
    query += ` AND period = ?`;
    params.push(period);
  }
  if (targetType) {
    query += ` AND target_type = ?`;
    params.push(targetType);
  }
  if (targetId) {
    query += ` AND target_id = ?`;
    params.push(targetId);
  }

  const { results } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<MonthlyPaymentRow>();

  return c.json({
    payments: (results ?? []).map((row) => ({
      ...row,
      is_paid: Boolean(row.is_paid),
    })),
  });
});

app.post('/monthly-payments/toggle', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const body = await c.req.json<{
    target_type?: 'recurring_item' | 'loan_installment' | 'credit_card';
    target_id?: string;
    period?: string;
    is_paid?: boolean;
  }>();

  const targetType = body.target_type;
  const targetId = body.target_id?.trim();
  const period = body.period?.trim();

  if (
    !targetType ||
    (targetType !== 'recurring_item' &&
      targetType !== 'loan_installment' &&
      targetType !== 'credit_card') ||
    !targetId ||
    !period
  ) {
    return c.json(
      { error: 'target_type, target_id y period (YYYY-MM) son obligatorios' },
      400
    );
  }

  const existing = await c.env.DB.prepare(
    `SELECT * FROM monthly_payments
     WHERE user_id = ? AND target_type = ? AND target_id = ? AND period = ?`
  )
    .bind(user.id, targetType, targetId, period)
    .first<MonthlyPaymentRow>();

  if (existing) {
    const nextPaid =
      body.is_paid !== undefined ? (body.is_paid ? 1 : 0) : existing.is_paid ? 0 : 1;

    await c.env.DB.prepare(
      `UPDATE monthly_payments
       SET is_paid = ?, paid_at = datetime('now')
       WHERE id = ?`
    )
      .bind(nextPaid, existing.id)
      .run();

    return c.json({
      payment: {
        ...existing,
        is_paid: Boolean(nextPaid),
      },
    });
  }

  const id = crypto.randomUUID();
  const nextPaid = body.is_paid !== undefined ? (body.is_paid ? 1 : 0) : 1;

  await c.env.DB.prepare(
    `INSERT INTO monthly_payments (id, user_id, target_type, target_id, period, is_paid)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, targetType, targetId, period, nextPaid)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM monthly_payments WHERE id = ?')
    .bind(id)
    .first<MonthlyPaymentRow>();

  return c.json({
    payment: created
      ? {
          ...created,
          is_paid: Boolean(created.is_paid),
        }
      : null,
  });
});

// ============================================================================
// GASTOS VARIABLES DIARIOS (Billetera / Almuerzos, Bebidas, Gastos Menores)
// ============================================================================
app.get('/variable-expenses', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const period = c.req.query('period');
  let query = `
    SELECT v.*, a.name AS account_name
    FROM variable_expenses v
    LEFT JOIN accounts a ON a.id = v.account_id
    WHERE v.user_id = ?
  `;
  const params: unknown[] = [user.id];

  if (period) {
    query += ` AND v.period = ?`;
    params.push(period.trim());
  }

  query += ` ORDER BY v.date DESC, v.created_at DESC`;

  const { results } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<VariableExpenseRow>();

  return c.json({ expenses: results });
});

app.post('/variable-expenses', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const body = await c.req.json<{
    title?: string;
    amount?: number;
    category?: string;
    period?: string;
    date?: string;
    account_id?: string;
    notes?: string;
    deduct_from_balance?: boolean;
  }>();

  const title = body.title?.trim();
  const amount = Number(body.amount);

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    return c.json({ error: 'Título y monto mayor a 0 son obligatorios' }, 400);
  }

  const now = new Date();
  const dateStr = body.date?.trim() || now.toISOString().slice(0, 10);
  const periodStr = body.period?.trim() || dateStr.slice(0, 7);
  const categoryStr = body.category?.trim().toLowerCase() || 'alimentacion';
  const accountId = body.account_id?.trim() || null;
  const notesStr = body.notes?.trim() || null;
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO variable_expenses (id, user_id, account_id, title, amount, category, period, date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, accountId, title, Math.round(amount), categoryStr, periodStr, dateStr, notesStr)
    .run();

  // Si se solicita descontar del saldo disponible de la cuenta:
  if (body.deduct_from_balance && accountId) {
    await c.env.DB.prepare(
      `UPDATE accounts
       SET current_balance = current_balance - ?
       WHERE id = ? AND user_id = ?`
    )
      .bind(Math.round(amount), accountId, user.id)
      .run();
  }

  const created = await c.env.DB.prepare(
    `SELECT v.*, a.name AS account_name
     FROM variable_expenses v
     LEFT JOIN accounts a ON a.id = v.account_id
     WHERE v.id = ?`
  )
    .bind(id)
    .first<VariableExpenseRow>();

  return c.json({ expense: created }, 201);
});

app.put('/variable-expenses/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT * FROM variable_expenses WHERE id = ? AND user_id = ?`
  )
    .bind(id, user.id)
    .first<VariableExpenseRow>();

  if (!existing) {
    return c.json({ error: 'Gasto variable no encontrado' }, 404);
  }

  const body = await c.req.json<{
    title?: string;
    amount?: number;
    category?: string;
    period?: string;
    date?: string;
    account_id?: string | null;
    notes?: string | null;
  }>();

  const title = body.title !== undefined ? body.title.trim() : existing.title;
  const amount = body.amount !== undefined ? Number(body.amount) : existing.amount;

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    return c.json({ error: 'Título y monto mayor a 0 son obligatorios' }, 400);
  }

  const dateStr = body.date !== undefined ? (body.date.trim() || existing.date) : existing.date;
  const periodStr = body.period !== undefined ? (body.period.trim() || dateStr.slice(0, 7)) : (dateStr ? dateStr.slice(0, 7) : existing.period);
  const categoryStr = body.category !== undefined ? body.category.trim().toLowerCase() : existing.category;
  const accountId = body.account_id !== undefined ? (body.account_id ? body.account_id.trim() : null) : existing.account_id;
  const notesStr = body.notes !== undefined ? (body.notes ? body.notes.trim() : null) : existing.notes;

  await c.env.DB.prepare(
    `UPDATE variable_expenses
     SET title = ?, amount = ?, category = ?, period = ?, date = ?, account_id = ?, notes = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(title, Math.round(amount), categoryStr, periodStr, dateStr, accountId, notesStr, id, user.id)
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT v.*, a.name AS account_name
     FROM variable_expenses v
     LEFT JOIN accounts a ON a.id = v.account_id
     WHERE v.id = ?`
  )
    .bind(id)
    .first<VariableExpenseRow>();

  return c.json({ expense: updated });
});

app.delete('/variable-expenses/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT * FROM variable_expenses WHERE id = ? AND user_id = ?`
  )
    .bind(id, user.id)
    .first<VariableExpenseRow>();

  if (!existing) {
    return c.json({ error: 'Gasto variable no encontrado' }, 404);
  }

  await c.env.DB.prepare(`DELETE FROM variable_expenses WHERE id = ?`)
    .bind(id)
    .run();

  return c.json({ success: true });
});

export default app;
