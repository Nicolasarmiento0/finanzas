-- Esquema para Cloudflare D1 (FinanzApp - Fase 1: Usuarios, Sesiones, Cuentas y Recurrentes)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CLP',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Tabla de cuentas financieras (checking, credit_card, savings, loan)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'credit_card', 'savings', 'loan')),
  current_balance INTEGER NOT NULL DEFAULT 0,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  interest_rate_annual REAL NOT NULL DEFAULT 0,
  billing_day INTEGER,
  card_brand TEXT CHECK (card_brand IN ('santander', 'falabella', 'other') OR card_brand IS NULL),
  savings_mode TEXT CHECK (savings_mode IN ('fixed', 'surplus') OR savings_mode IS NULL),
  fixed_contribution INTEGER NOT NULL DEFAULT 0,
  is_shared INTEGER NOT NULL DEFAULT 0,
  partner_name TEXT,
  partner_initial_balance INTEGER NOT NULL DEFAULT 0,
  partner_monthly_contribution INTEGER NOT NULL DEFAULT 0,
  target_amount INTEGER NOT NULL DEFAULT 0,
  partner_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_partner_user_id ON accounts(partner_user_id);

-- Tabla de movimientos recurrentes (ingresos fijos y gastos fijos)
CREATE TABLE IF NOT EXISTS recurring_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL DEFAULT 'general',
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recurring_items_user_id ON recurring_items(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_account_id ON recurring_items(account_id);

-- Tabla de desglose para suscripciones/gastos anidados (ej: Apple + YouTube + SmartFit)
CREATE TABLE IF NOT EXISTS recurring_sub_items (
  id TEXT PRIMARY KEY,
  recurring_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recurring_item_id) REFERENCES recurring_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recurring_sub_items_parent ON recurring_sub_items(recurring_item_id);

-- Tabla de registro de pagos mensuales y cuotas de préstamos (Fase 2: Checklist mensual y Amortización)
CREATE TABLE IF NOT EXISTS monthly_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('recurring_item', 'loan_installment', 'credit_card')),
  target_id TEXT NOT NULL,
  period TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 1,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, target_type, target_id, period)
);

CREATE INDEX IF NOT EXISTS idx_monthly_payments_user_period ON monthly_payments(user_id, period);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_target ON monthly_payments(user_id, target_type, target_id);

-- Tabla de gastos variables diarios (almuerzos, bebidas, café, compras cotidianas)
CREATE TABLE IF NOT EXISTS variable_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'alimentacion',
  period TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_variable_expenses_user_period ON variable_expenses(user_id, period);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_date ON variable_expenses(user_id, date);

-- Tabla de futuras compras posibles, proyectos de compra y nuevas suscripciones en evaluación
CREATE TABLE IF NOT EXISTS future_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tecnologia', -- 'ropa', 'accesorios', 'tecnologia', 'suscripcion', 'hogar', 'experiencias', 'otros'
  amount INTEGER NOT NULL DEFAULT 0,           -- Precio total (o costo mensual si es suscripción)
  payment_mode TEXT NOT NULL DEFAULT 'one_time_cash' CHECK (payment_mode IN ('one_time_cash', 'installments', 'recurring_subscription')),
  installments_count INTEGER NOT NULL DEFAULT 1,
  target_account_id TEXT,                      -- Cuenta vista o tarjeta de crédito preferida
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  target_period TEXT,                          -- Mes objetivo opcional (YYYY-MM)
  status TEXT NOT NULL DEFAULT 'evaluating' CHECK (status IN ('evaluating', 'planned', 'purchased')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_future_purchases_user_id ON future_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_future_purchases_status ON future_purchases(user_id, status);

-- Tabla de historial conversacional de FinanzAI (Fase 3: Persistencia multi-dispositivo en D1)
CREATE TABLE IF NOT EXISTS finanzai_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local',
  structured_json TEXT,
  slots_json TEXT,
  period TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finanzai_messages_user_created ON finanzai_messages(user_id, created_at);



