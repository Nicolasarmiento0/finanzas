# Catálogo de Funcionalidades y Reglas de Desarrollo (FEATURES.md)

> **REGLA FUNDAMENTAL DEL PROYECTO:**
> Ninguna funcionalidad listada en este documento puede ser modificada, refactorizada o eliminada a menos que el usuario la invoque explícitamente en el prompt por su `ID` o nombre formal. Si un nuevo requerimiento entra en conflicto con una funcionalidad existente, debes solicitar confirmación explícita antes de editar archivos vinculados.

---

## [feat-auth-register] - Registro de Usuarios y Creación de Sesión Inicial
- **Estado:** Estable
- **Descripción:** Permite crear una nueva cuenta de usuario con nombre, correo electrónico, contraseña (mínimo 6 caracteres) y moneda predeterminada (`CLP`), almacenando la contraseña derivada mediante PBKDF2-SHA256 (100.000 iteraciones y salt aleatorio de 16 bytes) y generando automáticamente una sesión activa por 30 días.
- **Archivos / Rutas Clave:**
  - `src/app/index.tsx`
  - `src/app/(auth)/_layout.tsx`
  - `src/app/(auth)/register.tsx`
  - `src/lib/api.ts` (`registerUser`)
  - `backend/src/auth.ts` (`hashPassword`, `generateSessionToken`, `hashToken`)
  - `backend/src/index.ts` (`POST /auth/register`)
  - `backend/src/db/schema.sql` (tablas `users`, `sessions`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** `POST /auth/register` con body `{ email, password, name, currency? }`.
  - **Salida HTTP:** `{ token: string, user: User }` (status `201`).
  - **Base de Datos:** `INSERT INTO users` y `INSERT INTO sessions` en Cloudflare D1 (`DB`).
- **Dependencias Internas:**
  - `feat-auth-session-persistence`
  - `feat-ui-liquid-glass-design-system`

---

## [feat-auth-login] - Autenticación de Usuarios con Credenciales (PBKDF2-SHA256)
- **Estado:** Estable
- **Descripción:** Valida las credenciales de acceso (correo electrónico normalizado y contraseña) contra el hash PBKDF2 almacenado en Cloudflare D1 y emite un token de sesión aleatorio de 32 bytes cuyo hash SHA-256 se registra por 30 días.
- **Archivos / Rutas Clave:**
  - `src/app/index.tsx`
  - `src/app/(auth)/login.tsx`
  - `src/lib/api.ts` (`loginUser`)
  - `backend/src/auth.ts` (`verifyPassword`, `generateSessionToken`, `hashToken`)
  - `backend/src/index.ts` (`POST /auth/login`)
  - `backend/src/db/schema.sql` (tablas `users`, `sessions`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** `POST /auth/login` con body `{ email, password }`.
  - **Salida HTTP:** `{ token: string, user: User }` (status `200` o `401` si las credenciales son inválidas).
  - **Base de Datos:** `SELECT ... FROM users WHERE email = ?` e `INSERT INTO sessions`.
- **Dependencias Internas:**
  - `feat-auth-session-persistence`
  - `feat-ui-liquid-glass-design-system`

---

## [feat-auth-session-persistence] - Persistencia Multiplataforma de Sesión y Validación de Token Bearer
- **Estado:** Estable
- **Descripción:** Gestiona el almacenamiento seguro del token de sesión (`finanzapp_auth_token`) usando `expo-secure-store` en iOS/Android y `localStorage` en Web, inyectando el encabezado `Authorization: Bearer <token>` en cada petición API y verificando la validez y vigencia de la sesión mediante el endpoint `/auth/me`.
- **Archivos / Rutas Clave:**
  - `src/lib/storage.ts` (`saveToken`, `getToken`, `removeToken`, `saveStoredItem`, `getStoredItem`, `removeStoredItem`)
  - `src/lib/api.ts` (`request`, `getCurrentUser`, `User`)
  - `src/app/index.tsx`
  - `src/app/(main)/_layout.tsx`
  - `backend/src/index.ts` (`authenticateRequest`, `GET /auth/me`)
  - `backend/src/db/schema.sql` (tablas `sessions`, `users`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** Header `Authorization: Bearer <token>` hacia `GET /auth/me` y todas las rutas protegidas.
  - **Salida HTTP:** `{ user: User }` o error `401 No autorizado`.
  - **Base de Datos:** `SELECT s.id, s.expires_at, u.id, u.email, u.name, u.currency FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`. Elimina sesiones expiradas automáticamente (`DELETE FROM sessions WHERE id = ?`).
- **Dependencias Internas:**
  - `feat-auth-login`
  - `feat-auth-register`
  - `feat-layout-adaptive-navigation`

---

## [feat-auth-logout] - Cierre de Sesión e Invalidación de Token en Servidor y Cliente
- **Estado:** Estable
- **Descripción:** Revoca la sesión activa eliminando el registro en la tabla `sessions` de Cloudflare D1 y borrando el token local en el dispositivo antes de redirigir al usuario a la pantalla de inicio de sesión.
- **Archivos / Rutas Clave:**
  - `src/lib/api.ts` (`logoutUser`)
  - `src/lib/storage.ts` (`removeToken`)
  - `src/components/layout/AdaptiveNavigation.tsx` (`handleLogout`)
  - `src/app/(main)/profile.tsx` (`handleLogout`)
  - `backend/src/index.ts` (`POST /auth/logout`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** `POST /auth/logout` con header `Authorization: Bearer <token>`.
  - **Salida HTTP:** `{ ok: true }`.
  - **Base de Datos:** `DELETE FROM sessions WHERE token_hash = ?`.
- **Dependencias Internas:**
  - `feat-auth-session-persistence`
  - `feat-layout-adaptive-navigation`
  - `feat-profile-management`

---

## [feat-profile-management] - Gestión de Perfil de Usuario e Identificador de Sincronización
- **Estado:** Estable
- **Descripción:** Pantalla y endpoint para consultar y editar los datos personales del usuario (nombre y correo con validación de unicidad), visualizar avatar con iniciales y moneda activa (`CLP`), y copiar al portapapeles el `User ID` único para vincular cuentas de ahorro compartidas en pareja.
- **Archivos / Rutas Clave:**
  - `src/app/(main)/profile.tsx`
  - `src/lib/api.ts` (`getCurrentUser`, `updateProfile`, `UpdateProfileInput`)
  - `backend/src/index.ts` (`PUT /auth/profile`)
  - `backend/src/db/schema.sql` (tabla `users`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** `PUT /auth/profile` con `{ name?, email? }`.
  - **Salida HTTP:** `{ user: User, message: 'Perfil actualizado correctamente' }`.
  - **Interfaz Nativa/Web:** Uso de `navigator.clipboard.writeText` en Web y `Share.share` en iOS/Android para compartir el `user.id`.
- **Dependencias Internas:**
  - `feat-auth-session-persistence`
  - `feat-savings-shared-partner-sync`
  - `feat-ui-liquid-glass-design-system`

---

## [feat-profile-password-security] - Actualización Segura de Contraseña con Validación Actual
- **Estado:** Estable
- **Descripción:** Permite al usuario cambiar su contraseña desde su perfil exigiendo y verificando criptográficamente su contraseña vigente (`current_password`) antes de almacenar el nuevo hash PBKDF2-SHA256 (`new_password` >= 6 caracteres).
- **Archivos / Rutas Clave:**
  - `src/app/(main)/profile.tsx` (`handleSavePassword`)
  - `src/lib/api.ts` (`updateProfile`)
  - `backend/src/auth.ts` (`verifyPassword`, `hashPassword`)
  - `backend/src/index.ts` (`PUT /auth/profile`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** `PUT /auth/profile` con `{ current_password, new_password }`.
  - **Salida HTTP:** `{ user: User, message }` o errores `400`/`401` si la contraseña actual no coincide.
  - **Base de Datos:** `UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?`.
- **Dependencias Internas:**
  - `feat-profile-management`
  - `feat-auth-login`

---

## [feat-profile-partner-lookup] - Búsqueda y Verificación de Usuarios Pareja por ID o Correo
- **Estado:** Estable
- **Descripción:** Permite buscar otro usuario registrado en FinanzApp por su `ID` exacto o correo electrónico (excluyendo al propio usuario autenticado) para vincular cuentas de ahorro compartidas en pareja con sincronización en vivo.
- **Archivos / Rutas Clave:**
  - `src/lib/api.ts` (`lookupUser`)
  - `src/components/finance/SavingsForecastSection.tsx` (`handleLookupPartner`)
  - `backend/src/index.ts` (`GET /users/lookup`)
  - `backend/src/db/schema.sql` (tabla `users`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada HTTP:** `GET /users/lookup?q=<id_o_email>`.
  - **Salida HTTP:** `{ user: { id, name, email } | null }`.
  - **Base de Datos:** `SELECT id, name, email FROM users WHERE (id = ? OR LOWER(email) = ?) AND id != ? LIMIT 1`.
- **Dependencias Internas:**
  - `feat-savings-shared-partner-sync`
  - `feat-profile-management`

---

## [feat-privacy-camouflage-mode] - Modo Privado / Camouflage Mode Global para Montos CLP
- **Estado:** Estable
- **Descripción:** Sistema reactivo global que oculta todos los montos monetarios de la aplicación reemplazándolos por `$ ••••••` al activar el interruptor de privacidad, persistiendo la preferencia en almacenamiento local (`@finanzapp_privacy_mode_v1`) y permitiendo excepciones explícitas mediante `formatCLP(amount, { raw: true })`.
- **Archivos / Rutas Clave:**
  - `src/lib/currency.ts` (`formatCLP`, `setGlobalPrivacyMode`, `getGlobalPrivacyMode`, `subscribePrivacyMode`)
  - `src/context/PrivacyContext.tsx` (`PrivacyProvider`, `usePrivacy`)
  - `src/components/ui/PrivacyToggleButton.tsx` (`PrivacyToggleButton` en variantes `pill` e `icon`)
  - `src/app/_layout.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Funciones / Hooks:** `formatCLP(amount, options?)`, `usePrivacy() -> { isPrivacyEnabled, togglePrivacy, setPrivacyEnabled }`.
  - **Props de `PrivacyToggleButton`:** `{ compact?: boolean }`.
  - **Almacenamiento Local:** Clave `@finanzapp_privacy_mode_v1` vía `src/lib/storage.ts`.
- **Dependencias Internas:**
  - `feat-auth-session-persistence`
  - `feat-dashboard-console`
  - `feat-tips-console-and-custom-rules`
  - `feat-finanzai-assistant-modal`

---

## [feat-layout-adaptive-navigation] - Navegación Adaptativa Multiplataforma (Sidebar Desktop y Floating Bottom Pill Mobile)
- **Estado:** Estable
- **Descripción:** Estructura de navegación responsiva que detecta el ancho de ventana (`DESKTOP_BREAKPOINT = 768px`) para renderizar una barra lateral izquierda fija de vidrio esmerilado (`260px`) en Web/Desktop o una barra flotante inferior estilo píldora con botón de acción rápida (FAB) en iOS/Android, incluyendo el disparador global de FinanzAI y el botón de modo privado.
- **Archivos / Rutas Clave:**
  - `src/hooks/useResponsive.ts` (`useResponsive`, `DESKTOP_BREAKPOINT`)
  - `src/components/layout/AdaptiveNavigation.tsx` (`AdaptiveNavigation`)
  - `src/components/layout/ScreenContainer.tsx` (`ScreenContainer`)
  - `src/app/(main)/_layout.tsx`
  - `src/app/_layout.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Hook `useResponsive`:** Retorna `{ width, height, isDesktop, isMobile, isWeb }`.
  - **Props de `ScreenContainer`:** `{ children, scrollable?: boolean, contentContainerStyle?: ViewStyle }`.
  - **Rutas Gestionadas:** `/(main)/dashboard`, `/(main)/tips`, `/(main)/profile` y modal global `<FinanzAIAssistantModal />`.
- **Dependencias Internas:**
  - `feat-ui-liquid-glass-design-system`
  - `feat-privacy-camouflage-mode`
  - `feat-finanzai-assistant-modal`
  - `feat-auth-logout`

---

## [feat-ui-liquid-glass-design-system] - Sistema de Diseño Dark-First Liquid Glass y Componentes Atómicos
- **Estado:** Estable
- **Descripción:** Biblioteca de tokens visuales (`#050505` Pure Obsidian canvas, `#121212` charcoal surface, bordes translúcidos y tipografía con `tabular-nums`) y componentes atómicos reutilizables con desenfoque nativo `expo-blur` (`GlassCard`), campos de texto estilizados (`GlassInput`) y botones de alto contraste estilo Tesla (`TeslaButton`).
- **Archivos / Rutas Clave:**
  - `src/theme/tokens.ts` (`colors`, `spacing`, `radius`, `typography`)
  - `src/components/ui/GlassCard.tsx` (`GlassCard`)
  - `src/components/ui/GlassInput.tsx` (`GlassInput`)
  - `src/components/ui/TeslaButton.tsx` (`TeslaButton`)
- **Puntos de Contacto / Interfaces:**
  - **Props de `GlassCard`:** `{ children, style?, intensity?: number }`.
  - **Props de `GlassInput`:** `TextInputProps & { label?: string, error?: string, containerStyle? }`.
  - **Props de `TeslaButton`:** `{ title, onPress, variant?: 'primary' | 'secondary' | 'ghost', loading?: boolean, disabled?: boolean, style? }`.
- **Dependencias Internas:**
  - Transversal a todas las pantallas y módulos de `src/app/` y `src/components/`.

---

## [feat-dashboard-console] - Consola Financiera Principal y Cabecera Dual de Patrimonio Neto
- **Estado:** Estable
- **Descripción:** Pantalla central de la aplicación que orquesta la carga concurrente de cuentas, ítems recurrentes, estados de pago mensuales, gastos variables y futuras compras posibles, presentando la cabecera ejecutiva con **Patrimonio Neto Con Ahorro** (`monthlyIncome + savingsTotal - totalDebt`), **Patrimonio Sin Ahorro / Margen Operativo** (`monthlyIncome - totalDebt`), chips de composición de deuda, Flujo Libre Mensual, banner superior de inteligencia proactiva y navegación interna por 6 pestañas (`Resumen`, `Billetera`, `Gastos Fijos`, `Tarjetas`, `Ahorro`, `Compras Futuras`).
- **Archivos / Rutas Clave:**
  - `src/app/(main)/dashboard.tsx` (`DashboardScreen`)
  - `src/lib/finance.ts` (`calculateProjectedPosition`)
  - `src/lib/intelligence.ts` (`generateFinancialIntelligence`)
  - `src/context/FinanzAIContext.tsx` (`syncFinancialData`)
- **Puntos de Contacto / Interfaces:**
  - **Llamadas API concurrentes (`loadAllData`):** `getAccounts()`, `getRecurringItems()`, `getMonthlyPayments()`, `getVariableExpenses()`, `getFuturePurchases()`.
  - **Tabs de Módulo (`DashboardTab`):** `'summary' | 'wallet' | 'fixed' | 'cards' | 'savings' | 'future_purchases'`.
- **Dependencias Internas:**
  - `feat-dashboard-period-navigation`
  - `feat-summary-cashflow-overview`
  - `feat-wallet-checking-accounts`
  - `feat-fixed-monthly-checklist`
  - `feat-cards-quota-and-billing-alerts`
  - `feat-savings-compound-forecast-engine`
  - `feat-future-purchases-viability`
  - `feat-intelligence-diagnostic-engine`
  - `feat-finanzai-assistant-modal`

---

## [feat-dashboard-period-navigation] - Máquina del Tiempo Mensual y Proyección Patrimonial Multi-Período
- **Estado:** Estable
- **Descripción:** Permite desplazarse hacia cualquier mes pasado o futuro (`YYYY-MM`) recalculando dinámicamente saldos proyectados de cuentas corrientes, capitalización compuesta de cuentas de ahorro, vigencia de préstamos/gastos con fechas límite y amortización progresiva de deudas sin perder los saldos reales del período actual.
- **Archivos / Rutas Clave:**
  - `src/lib/finance.ts` (`getCurrentPeriod`, `shiftPeriod`, `diffPeriodsInMonths`, `formatPeriodLabel`, `formatPeriodFull`, `calculateProjectedPosition`, `ProjectedFinancialPosition`)
  - `src/app/(main)/dashboard.tsx`
  - `src/app/(main)/tips.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Entrada:** `targetPeriod` (`YYYY-MM`), `currentPeriod` (`YYYY-MM`), `accounts: Account[]`, `recurringItems: RecurringItem[]`, `payments?: MonthlyPayment[]`, `variableExpenses?: VariableExpense[]`.
  - **Salida (`ProjectedFinancialPosition`):** `{ monthsDiff, checkingTotal, savingsTotal, totalAssets, creditCardDebt, activeFixedLoansDebt, loanAccountsDebt, variableDebtTotal, totalDebt, netWorth, netWorthWithoutSavings, monthlyIncome, monthlyFixedExpenses, monthlyFreeCashFlow, projectedAccounts }`.
- **Dependencias Internas:**
  - `feat-fixed-temporal-validity`
  - `feat-savings-compound-forecast-engine`
  - `feat-dashboard-console`

---

## [feat-dashboard-excel-seed-template] - Cargador 1-Clic de Plantilla Financiera Base (Excel Seed)
- **Estado:** Estable
- **Descripción:** Permite poblar en un clic una estructura financiera completa de demostración o línea base inspirada en la planilla Excel del usuario (Cuenta Corriente Santander, Tarjetas Santander y CMR, Ahorro 4% y 0%, Sueldo Líquido, Crédito Vehicular con término en `2026-12`, Mensualidad Educación hasta `2027-04`, Pack de Suscripciones con sub-ítems anidados y Préstamo Santander hasta `2028-10`).
- **Archivos / Rutas Clave:**
  - `src/app/(main)/dashboard.tsx` (`handleSeedExcelTemplate`)
  - `src/lib/api.ts` (`createAccount`, `createRecurringItem`, `createSubItem`)
  - `src/lib/finance.ts` (`savingsAccountToAccountInput`)
- **Puntos de Contacto / Interfaces:**
  - **Acción UI:** Botón `"Cargar Plantilla Excel"` en `src/app/(main)/dashboard.tsx` (visible cuando no existen cuentas ni ítems).
  - **Llamadas API:** Secuencia de `POST /accounts`, `POST /recurring-items` y `POST /recurring-items/:id/sub-items`.
- **Dependencias Internas:**
  - `feat-wallet-checking-accounts`
  - `feat-cards-charges-and-installments`
  - `feat-fixed-nested-subitems`
  - `feat-savings-accounts-and-strategies`

---

## [feat-summary-cashflow-overview] - Resumen Ejecutivo de Flujo de Caja Mensual y Ratio de Compromiso
- **Estado:** Estable
- **Descripción:** Presenta las 3 tarjetas macro de flujo de caja del período seleccionado (Ingresos del Mes, Gastos Fijos Activos con conteo de compromisos que expiran, y Flujo de Caja Libre / Superávit), junto con una barra de progreso porcentual que mide la proporción del ingreso comprometida en gastos fijos y un acceso rápido para registrar nuevos ingresos o gastos.
- **Archivos / Rutas Clave:**
  - `src/components/finance/ExecutiveSummarySection.tsx` (`ExecutiveSummarySection`)
  - `src/lib/finance.ts` (`isItemActiveInMonth`, `formatShortDate`)
- **Puntos de Contacto / Interfaces:**
  - **Props de `ExecutiveSummarySection`:** `{ period, accounts, recurringItems, payments, variableExpenses?, onCreateRecurringItem, onDeleteRecurringItem }`.
- **Dependencias Internas:**
  - `feat-summary-category-distribution`
  - `feat-export-csv-reports`
  - `feat-fixed-temporal-validity`

---

## [feat-summary-category-distribution] - Distribución Semántica de Gastos por Categoría y Barra Apilada
- **Estado:** Estable
- **Descripción:** Agrupa todos los gastos fijos vigentes y gastos variables del período según su categoría semántica (`vivienda`, `alimentacion`, `transporte`, `servicios`, `suscripciones`, `educacion`, `salud`, `deudas`, `otros`), renderizando una barra multicolor apilada y tarjetas individuales con su peso porcentual sobre el gasto total y sobre el ingreso mensual.
- **Archivos / Rutas Clave:**
  - `src/components/finance/ExecutiveSummarySection.tsx` (`categoryBreakdown`)
  - `src/lib/finance.ts` (`CATEGORY_COLORS`, `getCategoryColor`, `getCategoryLabel`)
- **Puntos de Contacto / Interfaces:**
  - **Funciones utilitarias:** `getCategoryColor(category)` y `getCategoryLabel(category)`.
  - **Salida UI:** Barra apilada horizontal proporcional y grilla de tarjetas por categoría con indicador cromático.
- **Dependencias Internas:**
  - `feat-summary-cashflow-overview`
  - `feat-wallet-variable-expenses`
  - `feat-fixed-monthly-checklist`

---

## [feat-export-csv-reports] - Motor de Exportación de Reportes Mensuales y Pronósticos a CSV/Excel
- **Estado:** Estable
- **Descripción:** Genera archivos CSV compatibles nativamente con Microsoft Excel y Google Sheets en español/Chile (codificación UTF-8 con BOM `\uFEFF` y delimitador `;`), permitiendo exportar tanto el **Reporte Mensual Completo** (resumen patrimonial, cuentas, distribución por categoría y detalle de movimientos + sub-ítems) como el **Reporte de Pronóstico de Ahorro e Interés Compuesto**.
- **Archivos / Rutas Clave:**
  - `src/lib/exportCsv.ts` (`exportMonthlyReportToCsv`, `exportForecastReportToCsv`, `downloadOrShareCsv`)
  - `src/components/finance/ExecutiveSummarySection.tsx`
  - `src/components/finance/SavingsForecastSection.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Entradas:** `ExportMonthlyReportParams` (`period`, `accounts`, `recurringItems`, `payments`, `variableExpenses`) y `ExportForecastReportParams` (`period`, `monthsAhead`, `accounts`, `recurringItems`, `selectedAccountId`).
  - **Salida Multiplataforma:** Descarga directa vía `Blob` y `<a download>` en Web, o hoja de compartir nativa (`Share.share`) en iOS/Android.
- **Dependencias Internas:**
  - `feat-summary-cashflow-overview`
  - `feat-savings-compound-forecast-engine`

---

## [feat-wallet-checking-accounts] - Gestión de Billetera y Cuentas Corrientes / Vista (CRUD y Conciliación de Saldo Base)
- **Estado:** Estable
- **Descripción:** Permite crear, editar y eliminar cuentas de liquidez (`type = 'checking'`), manteniendo sincronizado el saldo base de la cuenta cuando el usuario edita el saldo disponible en pantalla para que no se desfase respecto a los gastos variables ya descontados en el período activo.
- **Archivos / Rutas Clave:**
  - `src/components/finance/WalletSection.tsx` (`WalletSection`)
  - `src/app/(main)/dashboard.tsx` (`handleCreateAccount`, `handleUpdateAccount`, `handleDeleteAccount`, `accountsForDisplay`)
  - `src/lib/api.ts` (`fetchAccounts`, `createAccount`, `updateAccount`, `deleteAccount`)
  - `backend/src/index.ts` (`GET /accounts`, `POST /accounts`, `PUT /accounts/:id`, `DELETE /accounts/:id`)
  - `backend/src/db/schema.sql` (tabla `accounts`)
- **Puntos de Contacto / Interfaces:**
  - **Endpoints HTTP:** `GET /accounts`, `POST /accounts`, `PUT /accounts/:id`, `DELETE /accounts/:id`.
  - **Base de Datos:** Tabla `accounts` (`type = 'checking'`).
- **Dependencias Internas:**
  - `feat-wallet-variable-expenses`
  - `feat-wallet-safe-to-spend`

---

## [feat-wallet-safe-to-spend] - Cálculo de Presupuesto Libre Disponible y Límite Diario "Safe-to-Spend"
- **Estado:** Estable
- **Descripción:** Calcula en tiempo real el **Presupuesto Libre Inicial** (`Ingresos - Gastos Fijos Vigentes`), le descuenta el total de **Gastos Variables del Mes** para obtener el **Disponible Libre Hoy**, y divide dicho remanente entre los días restantes del mes calendario para mostrar un banner ejecutivo con el monto exacto que el usuario puede gastar por día sin comprometer sus obligaciones ni generar déficit.
- **Archivos / Rutas Clave:**
  - `src/components/finance/WalletSection.tsx` (`initialFreeBudget`, `variableSpentTotal`, `remainingFreeBudget`, `safePerDay`, `remainingDaysInMonth`)
- **Puntos de Contacto / Interfaces:**
  - **Entradas:** `period`, `recurringItems` (filtrados por `isItemActiveInMonth`), `variableExpenses`.
  - **Salidas Visuales:** 3 tarjetas de resumen (`Presupuesto Libre Inicial`, `Gastos Variables del Mes`, `Disponible Libre Hoy`) y Banner Hero `PUEDES GASTAR HASTA $X / DÍA`.
- **Dependencias Internas:**
  - `feat-wallet-variable-expenses`
  - `feat-fixed-temporal-validity`

---

## [feat-wallet-variable-expenses] - Registro y Edición Resiliente de Gastos Variables del Mes con Descuento en Cuenta
- **Estado:** Estable
- **Descripción:** Permite registrar, editar y eliminar gastos variables del día a día asociados a un período (`YYYY-MM`), categoría, fecha y cuenta opcional, descontando o restituyendo automáticamente el monto en el saldo de la cuenta vinculada y contando con un mecanismo de fallback resiliente (`create + delete` con preservación de saldo base) si el worker remoto aún no expone `PUT /variable-expenses/:id`.
- **Archivos / Rutas Clave:**
  - `src/components/finance/WalletSection.tsx`
  - `src/app/(main)/dashboard.tsx` (`handleCreateVariableExpense`, `handleUpdateVariableExpense`, `handleDeleteVariableExpense`)
  - `src/lib/api.ts` (`fetchVariableExpenses`, `createVariableExpense`, `updateVariableExpense`, `deleteVariableExpense`, `VariableExpense`)
  - `backend/src/index.ts` (`GET /variable-expenses`, `POST /variable-expenses`, `PUT /variable-expenses/:id`, `DELETE /variable-expenses/:id`, `ensureVariableExpensesTable`)
  - `backend/src/db/schema.sql` (tabla `variable_expenses`)
- **Puntos de Contacto / Interfaces:**
  - **Endpoints HTTP:** `GET /variable-expenses?period=YYYY-MM`, `POST /variable-expenses`, `PUT /variable-expenses/:id`, `DELETE /variable-expenses/:id`.
  - **Base de Datos:** Tabla `variable_expenses` (creada automáticamente vía `ensureVariableExpensesTable` si no existe) y actualización atómica de `accounts.balance`.
- **Dependencias Internas:**
  - `feat-wallet-checking-accounts`
  - `feat-wallet-safe-to-spend`
  - `feat-wallet-quick-shortcuts`

---

## [feat-wallet-quick-shortcuts] - Atajos de Gasto Rápido en 1-Toque con Ajustes Instantáneos y Catálogo Configurable
- **Estado:** Estable
- **Descripción:** Barra de píldoras de micro-gastos frecuentes chilenos (Pasaje Bip!/Metro, Café/Snack, Almuerzo/Colación, Uber/Cabify, Supermercado Express, Panadería/Feria, Delivery/Apps, Farmacia, Estacionamiento/Tag) que abre un modal de confirmación con botones de ajuste rápido (`-$500`, `-$100`, `+$100`, `+$500`, `+$1.000`), selector de cuenta de cargo, opción para recordar el nuevo precio predeterminado y un configurador completo para agregar, editar, eliminar o restaurar atajos de fábrica en almacenamiento local (`@finanzapp_quick_shortcuts_v1`).
- **Archivos / Rutas Clave:**
  - `src/components/finance/QuickExpenseShortcuts.tsx` (`QuickExpenseShortcuts`, `QuickShortcutItem`, `DEFAULT_SHORTCUTS`)
  - `src/components/finance/WalletSection.tsx`
  - `src/lib/storage.ts` (`getStoredItem`, `saveStoredItem`)
- **Puntos de Contacto / Interfaces:**
  - **Props de `QuickExpenseShortcuts`:** `{ period, checkingAccounts, onRegisterExpense }`.
  - **Almacenamiento Local:** Clave `@finanzapp_quick_shortcuts_v1`.
- **Dependencias Internas:**
  - `feat-wallet-variable-expenses`
  - `feat-wallet-checking-accounts`

---

## [feat-fixed-monthly-checklist] - Checklist Mensual Unificado de Gastos Fijos, Préstamos y Estados de Cuenta de Tarjetas
- **Estado:** Estable
- **Descripción:** Lista de verificación interactiva mes a mes que unifica todos los gastos fijos independientes, cuotas de préstamos y el pago total facturado de cada tarjeta de crédito (evitando duplicar cargos recurrentes ya asignados a una tarjeta), permitiendo marcarlos como `PAGADO` o `PENDIENTE` (`POST /monthly-payments/toggle`), calcular el **Remanente Libre Post-Pago** y editar cualquier ítem en línea.
- **Archivos / Rutas Clave:**
  - `src/components/finance/FixedItemsSection.tsx` (`FixedItemsSection`, `UnifiedChecklistRow`)
  - `src/app/(main)/dashboard.tsx` (`handleToggleChecklistItem`, `handleCreateRecurringItem`, `handleUpdateRecurringItem`, `handleDeleteRecurringItem`)
  - `src/lib/api.ts` (`fetchRecurringItems`, `createRecurringItem`, `updateRecurringItem`, `deleteRecurringItem`, `fetchMonthlyPayments`, `toggleMonthlyPayment`)
  - `backend/src/index.ts` (`GET/POST/PUT/DELETE /recurring-items`, `GET /monthly-payments`, `POST /monthly-payments/toggle`)
  - `backend/src/db/schema.sql` (tablas `recurring_items`, `monthly_payments`)
- **Puntos de Contacto / Interfaces:**
  - **Endpoints HTTP:** `GET /monthly-payments?period=YYYY-MM` y `POST /monthly-payments/toggle` con `{ period, target_type: 'recurring_item' | 'loan_installment' | 'credit_card', target_id, amount_paid }`.
  - **Base de Datos:** Restricción `UNIQUE(user_id, period, target_type, target_id)` en `monthly_payments` para hacer upsert idempotente del estado `'paid' | 'pending'`.
- **Dependencias Internas:**
  - `feat-fixed-temporal-validity`
  - `feat-fixed-nested-subitems`
  - `feat-cards-charges-and-installments`

---

## [feat-fixed-temporal-validity] - Motor de Vigencia Temporal de Compromisos Recurrentes (`start_date` / `end_date`)
- **Estado:** Estable
- **Descripción:** Evalúa automáticamente si un ingreso, gasto fijo, suscripción o cuota en tarjeta está activo en un mes determinado (`YYYY-MM`) comparando sus fechas de inicio (`start_date`) y término (`end_date`), omitiendo del flujo de caja y del checklist los compromisos ya vencidos o aún no iniciados (mostrándolos en una tarjeta informativa de ítems omitidos) y liberando ese flujo automáticamente en las proyecciones futuras de ahorro.
- **Archivos / Rutas Clave:**
  - `src/lib/finance.ts` (`isItemActiveInMonth`, `buildMonthlySurplusList`, `getExpiringExpensesInHorizon`, `formatShortDate`)
  - `src/components/finance/FixedItemsSection.tsx` (`activeInMonth`, `expiredOrFutureInMonth`)
  - `src/components/finance/CreditCardsSection.tsx`
  - `src/components/finance/SavingsForecastSection.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Función Principal:** `isItemActiveInMonth(item: RecurringItem, period: string): boolean`.
  - **Funciones de Proyección:** `buildMonthlySurplusList(recurringItems, startPeriod, months)` y `getExpiringExpensesInHorizon(recurringItems, startPeriod, months)`.
- **Dependencias Internas:**
  - `feat-fixed-monthly-checklist`
  - `feat-dashboard-period-navigation`
  - `feat-savings-compound-forecast-engine`

---

## [feat-fixed-nested-subitems] - Desglose de Sub-Ítems Anidados y Recálculo Automático del Ítem Padre
- **Estado:** Estable
- **Descripción:** Permite descomponer cualquier gasto fijo o cargo de tarjeta (por ejemplo, un pack de suscripciones o cuenta compartida) en múltiples sub-ítems individuales con nombre y monto (`recurring_sub_items`), recalculando de forma automática y transaccional en el backend el monto total del ítem padre (`recalculateParentAmount`) cada vez que se agrega o elimina un sub-ítem.
- **Archivos / Rutas Clave:**
  - `src/components/finance/FixedItemsSection.tsx`
  - `src/components/finance/CreditCardsSection.tsx`
  - `src/app/(main)/dashboard.tsx` (`handleCreateSubItem`, `handleDeleteSubItem`)
  - `src/lib/api.ts` (`createSubItem`, `deleteSubItem`, `RecurringSubItem`)
  - `backend/src/index.ts` (`POST /recurring-items/:id/sub-items`, `DELETE /recurring-items/:id/sub-items/:subId`, `recalculateParentAmount`)
  - `backend/src/db/schema.sql` (tabla `recurring_sub_items`)
- **Puntos de Contacto / Interfaces:**
  - **Endpoints HTTP:** `POST /recurring-items/:id/sub-items` con `{ name, amount }` y `DELETE /recurring-items/:id/sub-items/:subId`.
  - **Base de Datos:** Tabla `recurring_sub_items` con `ON DELETE CASCADE` y actualización automática de `recurring_items.amount`.
- **Dependencias Internas:**
  - `feat-fixed-monthly-checklist`
  - `feat-cards-charges-and-installments`

---

## [feat-cards-visual-plastics] - Renderizado Visual Realista de Plásticos Bancarios (Santander, CMR y Obsidian Titanium)
- **Estado:** Estable
- **Descripción:** Componente visual de proporción ISO/IEC 7810 ID-1 (`1.586`) que detecta automáticamente la marca de la tarjeta por su nombre (`resolveCardBrand`) para renderizar la imagen oficial de **Santander WorldMember Limited** (`assets/images/cards/santander-worldmember.png`), **CMR Falabella** (`assets/images/cards/cmr-falabella.png`) o una tarjeta vectorial SVG **Obsidian Titanium** con chip EMV dorado, antena NFC y superposición de estado (`AL DÍA`, `POR VENCER`, `SOBREGIRO`) y barra inferior de utilización.
- **Archivos / Rutas Clave:**
  - `src/components/finance/CreditCardVisual.tsx` (`CreditCardVisual`, `resolveCardBrand`)
  - `assets/images/cards/santander-worldmember.png`
  - `assets/images/cards/cmr-falabella.png`
  - `src/components/finance/CreditCardsSection.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Props de `CreditCardVisual`:** `{ name, totalUsed, creditLimit, availableCredit, usagePercent, billingDay, isAlertActive, daysRemaining }`.
- **Dependencias Internas:**
  - `feat-cards-quota-and-billing-alerts`
  - `feat-privacy-camouflage-mode`

---

## [feat-cards-quota-and-billing-alerts] - Gestión de Cupo Total, Cupo Disponible, Barra de Uso y Alerta de Día de Facturación
- **Estado:** Estable
- **Descripción:** Calcula para cada tarjeta de crédito (`type = 'credit_card'`) su deuda total utilizada (`baseBalance + recurringCharges` vigentes en el mes), el cupo disponible (`creditLimit - totalUsed`), el porcentaje de utilización y los días restantes hasta el próximo día de facturación (`billingDay` 1–31), activando una alerta visual preventiva cuando faltan `<= 5` días para el corte y el saldo utilizado es mayor a cero.
- **Archivos / Rutas Clave:**
  - `src/lib/finance.ts` (`calculateCreditCardMetrics`, `getDaysUntilBillingDay`, `CreditCardMetrics`)
  - `src/components/finance/CreditCardsSection.tsx` (`CreditCardsSection`)
  - `backend/src/index.ts` (`GET/POST/PUT/DELETE /accounts`)
  - `backend/src/db/schema.sql` (tabla `accounts`, columnas `credit_limit`, `billing_day`)
- **Puntos de Contacto / Interfaces:**
  - **Función Principal:** `calculateCreditCardMetrics(card, recurringItems, period, referenceDate?) -> CreditCardMetrics`.
  - **CRUD de Plásticos:** Creación, edición en línea (`credit_limit`, `balance`, `billing_day`) y eliminación de cuentas `credit_card`.
- **Dependencias Internas:**
  - `feat-cards-visual-plastics`
  - `feat-cards-charges-and-installments`
  - `feat-fixed-monthly-checklist`

---

## [feat-cards-charges-and-installments] - Gestión de Cargos Recurrentes y Compras en Cuotas Asignadas a Tarjetas de Crédito
- **Estado:** Estable
- **Descripción:** Permite vincular suscripciones permanentes o compras en cuotas con duración definida (`1, 3, 6, 12, 24 meses` o fecha personalizada `start_date` / `end_date`) directamente a una tarjeta de crédito específica (`account_id`), calculando automáticamente el mes de término a partir del número de cuotas, soportando sub-ítems anidados y sumando el total de la tarjeta como una única obligación en el checklist mensual.
- **Archivos / Rutas Clave:**
  - `src/components/finance/CreditCardsSection.tsx` (`INSTALLMENT_PRESETS`, `computeEndDateFromMonths`, `handleCreateCharge`, `handleSaveEditedCharge`)
  - `src/lib/api.ts` (`createRecurringItem`, `updateRecurringItem`, `deleteRecurringItem`, `createSubItem`, `deleteSubItem`)
- **Puntos de Contacto / Interfaces:**
  - **Presets de Duración:** `0` (Permanente), `1`, `3`, `6`, `12`, `24` meses.
  - **Vínculo de Datos:** `recurring_items.account_id = card.id`.
- **Dependencias Internas:**
  - `feat-cards-quota-and-billing-alerts`
  - `feat-fixed-temporal-validity`
  - `feat-fixed-nested-subitems`
  - `feat-fixed-monthly-checklist`

---

## [feat-cards-3d-wallet-bento-showcase] - Consola Visual Bento y Tarjetero 3D Interactivo (Wallet Pocket) en Tarjetas de Crédito
- **Estado:** Estable
- **Descripción:** Experiencia visual Dark-First Liquid Glass en la sección de Tarjetas de Crédito y Manejo de Cupos que incorpora: (1) **Hero Ambiental de Cupo Disponible** con halo radial azul/esmeralda, píldora de selección rápida de plástico, indicadores circulares de alertas de corte (`🔥`) y anillo SVG de porcentaje de utilización, botones circulares de acción rápida (`+ Nueva`, `Editar`) y orbe esférico luminoso interactivo; (2) **Tarjetero 3D Esculpido (Wallet Pocket)** en cuero oscuro con costuras vectoriales SVG de donde se asoman las tarjetas apiladas con sus colores reales y monto disponible, permitiendo tocar cualquier plástico para traerlo al frente y desplegar su detalle e ítems; y (3) **Widgets Bento Inferiores** de **Facturado del Mes** y **Próximo Corte / Facturación**.
- **Archivos / Rutas Clave:**
  - `src/components/finance/CreditCardsSection.tsx` (`CreditCardsSection`, `getWalletStripPalette`, `handleSelectWalletCard`, `portfolioStats`, `orderedWalletStack`)
- **Puntos de Contacto / Interfaces:**
  - **Estados Visuales Locales:** `selectedWalletCardId`, `showAllCardsExpanded`, `walletPullAnim`.
  - **Preservación de Interfaz:** Mantiene 100% intactos los props `CreditCardsSectionProps`, cálculos de `calculateCreditCardMetrics` y operaciones CRUD de tarjetas, cargos en cuotas y sub-ítems.
- **Dependencias Internas:**
  - `feat-cards-visual-plastics`
  - `feat-cards-quota-and-billing-alerts`
  - `feat-cards-charges-and-installments`
  - `feat-privacy-camouflage-mode`
  - `feat-ui-liquid-glass-design-system`

---

## [feat-savings-accounts-and-strategies] - Gestión de Múltiples Cuentas de Ahorro (Con/Sin Interés, Aporte Fijo o % de Superávit)
- **Estado:** Estable
- **Descripción:** Permite crear, editar y eliminar múltiples cuentas de ahorro (`type = 'savings'`) tanto con rentabilidad anual compuesta (`annualRate > 0`, ej. 4% anual) como de liquidez pura (`0%`), configurando su estrategia de depósito mensual en modalidad **Aporte Fijo Mensual (`FIXED`)** o **Porcentaje del Superávit Mensual (`SURPLUS`)**, e incluye un inicializador rápido 1-clic de cuentas duales (`4%` y `0%`).
- **Archivos / Rutas Clave:**
  - `src/components/finance/SavingsForecastSection.tsx` (`SavingsForecastSection`, `handleInitDefaultAccounts`, `handleSaveAccount`)
  - `src/lib/finance.ts` (`SavingsAccount`, `DepositStrategy`, `parseSavingsMetadata`, `encodeSavingsMetadata`, `accountToSavingsAccount`, `savingsAccountToAccountInput`)
  - `backend/src/index.ts` (`GET/POST/PUT/DELETE /accounts`)
  - `backend/src/db/schema.sql` (tabla `accounts`, columnas `annual_interest_rate`, `strategy`, `allocation_value`)
- **Puntos de Contacto / Interfaces:**
  - **Transformadores de Modelo:** `accountToSavingsAccount(account, currentUserId?)` y `savingsAccountToAccountInput(...)`.
  - **Codificación de Metadatos:** Serialización retrocompatible en `accounts.strategy` (`FIXED:...` / `SURPLUS:...` / `SHARED:...`) y `accounts.partner_user_id`.
- **Dependencias Internas:**
  - `feat-savings-compound-forecast-engine`
  - `feat-savings-shared-partner-sync`

---

## [feat-savings-shared-partner-sync] - Ahorro Compartido en Pareja con Sincronización Bidireccional e Inversión Automática de Roles
- **Estado:** Estable
- **Descripción:** Permite configurar cualquier cuenta de ahorro en modalidad **En Pareja (Compartido)** registrando saldos iniciales independientes, aportes mensuales individuales, meta conjunta opcional (`targetAmount`) y el `partner_user_id` del otro usuario; sincroniza la cuenta en tiempo real entre ambas sesiones en Cloudflare D1 e invierte automáticamente los roles (`Tú` vs `Pareja`) cuando la cuenta es visualizada o editada desde la sesión del usuario invitado (`isOwner === false`).
- **Archivos / Rutas Clave:**
  - `src/components/finance/SavingsForecastSection.tsx`
  - `src/lib/finance.ts` (`parseSavingsMetadata`, `encodeSavingsMetadata`, `accountToSavingsAccount`, `savingsAccountToAccountInput`)
  - `backend/src/index.ts` (`GET /accounts`, `POST /accounts`, `PUT /accounts/:id`, `DELETE /accounts/:id`, `ensurePartnerColumn`)
- **Puntos de Contacto / Interfaces:**
  - **Consulta SQL Compartida (`GET /accounts`):** `WHERE a.user_id = ? OR a.partner_user_id = ?` con `LEFT JOIN users u_owner` para obtener `owner_name`.
  - **Permisos de Edición (`PUT /accounts/:id`):** Autoriza tanto al propietario (`user_id`) como al usuario vinculado (`partner_user_id`).
  - **Visualización:** Barra dual de participación porcentual (`Tú` vs `Pareja`) y barra de progreso de **Meta Conjunta** con estimación del mes exacto de cumplimiento (`targetReachedMonthLabel`).
- **Dependencias Internas:**
  - `feat-profile-partner-lookup`
  - `feat-savings-accounts-and-strategies`
  - `feat-savings-compound-forecast-engine`

---

## [feat-savings-compound-forecast-engine] - Motor de Pronóstico de Interés Compuesto (1–60 Meses), Gráfico Apilado e Impulso por Deudas que Expiran
- **Estado:** Estable
- **Descripción:** Calcula mes a mes (de 1 a 60 meses, con botones rápidos para `6 Meses`, `1 Año`, `Fin de 2027` y `3 Años`) la evolución de cada cuenta de ahorro o del **Consolidado Total** aplicando capitalización mensual compuesta (`r = annualRate / 12`), renderizando un gráfico interactivo de columnas apiladas (capital propio vs interés compuesto) con inspector de puntos y desglosando mes a mes el impulso automático de superávit cuando finalizan préstamos o gastos con `end_date`.
- **Archivos / Rutas Clave:**
  - `src/lib/finance.ts` (`calculateForecast`, `calculateConsolidatedForecast`, `buildMonthlySurplusList`, `getExpiringExpensesInHorizon`, `ForecastSummary`, `ForecastPoint`)
  - `src/components/finance/SavingsForecastSection.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Fórmula Matemática Mensual:** `interestEarned = Math.round(runningBalance * (annualRate / 12))` y `runningBalance = runningBalance + interestEarned + deposit`.
  - **Salidas (`ForecastSummary`):** `{ accountId, accountName, annualRate, initialBalance, finalBalance, totalDeposited, myTotalDeposited, partnerTotalDeposited, totalInterest, targetAmount?, monthsToReachTarget?, targetReachedMonthLabel?, points: ForecastPoint[] }`.
- **Dependencias Internas:**
  - `feat-savings-accounts-and-strategies`
  - `feat-savings-shared-partner-sync`
  - `feat-fixed-temporal-validity`
  - `feat-export-csv-reports`

---

## [feat-savings-accelerated-ten-percent-rule] - Simulador de Regla de Ahorro Acelerado (+10% del Remanente Libre)
- **Estado:** Estable
- **Descripción:** Permite activar un interruptor de simulación en el motor de pronóstico (`applyTenPercentSurplusRule`) que suma a los aportes ordinarios el 10% del superávit mensual libre del checklist, comparando el saldo final acelerado contra el pronóstico base para mostrar el capital extra generado y cuántos meses antes se alcanza la meta financiera.
- **Archivos / Rutas Clave:**
  - `src/lib/finance.ts` (`ForecastOptions`, `calculateForecast`, `calculateConsolidatedForecast`)
  - `src/components/finance/SavingsForecastSection.tsx` (`applyTenPercentSurplus`, `baselineForecast`, `extraFinalCapital`, `monthsFaster`)
- **Puntos de Contacto / Interfaces:**
  - **Opción de Cálculo:** `ForecastOptions = { applyTenPercentSurplusRule?: boolean }`.
- **Dependencias Internas:**
  - `feat-savings-compound-forecast-engine`

---

## [feat-intelligence-diagnostic-engine] - Motor Cuantitativo Proactivo de Diagnóstico y Score de Salud Financiera (0–100)
- **Estado:** Estable
- **Descripción:** Algoritmo determinista que audita el 100% de las cuentas, ingresos, gastos fijos, tarjetas de crédito, gastos variables y futuras compras en evaluación del período para calcular un **Score de Salud Financiera (0–100)** (`Óptima`, `Estable`, `Requiere Atención`, `Crítica`), Ratios Clave y **13 correlaciones automáticas** con cálculo exacto de ahorro potencial mensual y anual en CLP:
  1. Fuga en Delivery y Restaurantes vs Supermercado.
  2. Alerta crítica por compras de comida/supermercado en cuotas de tarjeta de crédito.
  3. Costo de oportunidad por liquidez ociosa al 0% vs cuenta rentable (4.5%+ anual).
  4. Efecto Bola de Nieve por deudas recién terminadas y próximos vencimientos (`end_date`).
  5. Auditoría de suscripciones y micro-gastos recurrentes acumulados.
  6. Ratio de Rigidez Presupuestaria (gastos fijos sobre ingreso mensual).
  7. Tensión de cupo en tarjetas de crédito (`>35%` de utilización).
  8. Movilidad en apps de transporte (Uber/Cabify/Didi) vs transporte público.
  9. Desbalance de gasto variable en fines de semana (viernes a domingo).
  10. Cobertura del Fondo de Emergencia (escudo de 1, 3 y 6 meses de gastos fijos).
  11. Sinergia de cuentas de ahorro compartidas en pareja.
  12. Impacto de préstamos a terceros sobre el flujo libre mensual.
  13. Auditoría de Futuras Compras y Suscripciones en Evaluación (Alerta preventiva por sobrecarga de suscripciones `> 8%` del ingreso e insight positivo de Luz Verde para ítems de Prioridad Alta viables en el mes).
- **Archivos / Rutas Clave:**
  - `src/lib/intelligence.ts` (`generateFinancialIntelligence`, `FinancialIntelligenceReport`, `FinancialInsight`, `InsightCategory`, `InsightTone`)
  - `src/app/(main)/dashboard.tsx` (`intelligenceReport`, banner de diagnóstico superior)
  - `src/components/finance/FinancialTipsSection.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Entrada:** `{ period, accounts, recurringItems, variableExpenses, futurePurchases? }`.
  - **Salida (`FinancialIntelligenceReport`):** `{ overallScore, healthStatus, totalPotentialSavingsMonthlyCLP, totalPotentialSavingsAnnualCLP, insights: FinancialInsight[], keyRatios }`.
- **Dependencias Internas:**
  - `feat-dashboard-console`
  - `feat-future-purchases-viability`
  - `feat-tips-console-and-custom-rules`
  - `feat-privacy-camouflage-mode`

---

## [feat-tips-console-and-custom-rules] - Consola de Consejos Financieros, Filtros de Hallazgos y Biblioteca de Reglas Personales
- **Estado:** Estable
- **Descripción:** Pantalla dedicada (`/(main)/tips`) que presenta la consola ejecutiva de salud financiera, filtros interactivos por categoría de diagnóstico cuantitativo (`alimentacion`, `tarjetas`, `emergencia`, `ahorro`, `presupuesto`, `habitos`, `movilidad`, `deudas`), y una biblioteca de principios financieros donde el usuario puede crear/eliminar sus propias reglas personalizadas (`finanzapp_custom_tips_v1`) y marcar hábitos como aplicados (`finanzapp_applied_tips_v1`).
- **Archivos / Rutas Clave:**
  - `src/app/(main)/tips.tsx` (`TipsScreen`)
  - `src/components/finance/FinancialTipsSection.tsx` (`FinancialTipsSection`, `BUILTIN_TIPS`, `FinancialTip`)
  - `src/lib/storage.ts` (`getStoredItem`, `saveStoredItem`)
- **Puntos de Contacto / Interfaces:**
  - **Props de `FinancialTipsSection`:** `{ period, onChangePeriod?, accounts, recurringItems, variableExpenses? }`.
  - **Almacenamiento Local:** Claves `finanzapp_custom_tips_v1` y `finanzapp_applied_tips_v1`.
- **Dependencias Internas:**
  - `feat-intelligence-diagnostic-engine`
  - `feat-dashboard-period-navigation`
  - `feat-privacy-camouflage-mode`

---

## [feat-finanzai-query-engine] - Motor Determinista NLP y Asistente Cuantitativo Conversacional (FinanzAI)
- **Estado:** Estable
- **Descripción:** Motor de procesamiento de lenguaje natural en español y solucionador matemático determinista (`queryFinanzAI`) que interpreta montos con modismos chilenos (`lucas`, `palos`, `k`, `mil`), horizontes temporales (`en abril`, `próximo mes`, `en 6 meses`, `fin de año`) y resuelve **19 intenciones financieras** (`future_savings_projection`, `goal_target_reach`, `income_cashflow`, `invest_recommendation`, `card_vs_savings`, `safe_to_save`, `what_if_spend`, `survival_health`, `pending_commitments`, `category_audit`, `credit_card_details`, `total_debt_audit`, `subscriptions_audit`, `shared_savings_partner`, `windfall_bonus`, `wishlist_evaluation`, `amount_only`, `greeting_help`, `fallback`) entregando veredictos, métricas exactas, pasos de cálculo transparentes y preguntas de seguimiento.
- **Archivos / Rutas Clave:**
  - `src/lib/queryEngine.ts` (`queryFinanzAI`, `classifyQueryIntent`, `solveWishlistEvaluation`, `QueryContextData`, `QueryEngineResult`, `QueryIntent`)
- **Puntos de Contacto / Interfaces:**
  - **Entrada (`QueryContextData`):** `{ accounts, recurringItems, variableExpenses, payments?, futurePurchases?, period?, report? }`.
  - **Salida (`QueryEngineResult`):** `{ intent, title, verdict, verdictTone, recommendation, detailedBreakdown, metrics?, suggestedFollowUps?, actionLabel?, actionType? }`.
- **Dependencias Internas:**
  - `feat-finanzai-assistant-modal`
  - `feat-future-purchases-viability`
  - `feat-savings-compound-forecast-engine`
  - `feat-cards-quota-and-billing-alerts`
  - `feat-privacy-camouflage-mode`

---

## [feat-finanzai-assistant-modal] - Modal Interactivo y Botón Flotante Global del Asistente FinanzAI
- **Estado:** Estable
- **Descripción:** Contexto global (`FinanzAIContext`), botón disparador con gradiente esmeralda (`FinanzAITriggerButton`) integrado en el sidebar desktop y en la barra flotante móvil, y modal interactivo (`FinanzAIAssistantModal`) con 13 píldoras de consulta rápida en 1-toque (incluyendo auditoría y plan óptimo de futuras compras), desglose transparente de fórmulas matemáticas y sugerencias dinámicas encadenadas.
- **Archivos / Rutas Clave:**
  - `src/context/FinanzAIContext.tsx` (`FinanzAIProvider`, `useFinanzAI`)
  - `src/components/ui/FinanzAITriggerButton.tsx` (`FinanzAITriggerButton`)
  - `src/components/finance/FinanzAIAssistantModal.tsx` (`FinanzAIAssistantModal`, `QUICK_PILLS`)
  - `src/components/layout/AdaptiveNavigation.tsx`
- **Puntos de Contacto / Interfaces:**
  - **Hook `useFinanzAI`:** `{ isOpen, openFinanzAI, closeFinanzAI, currentQuery, setCurrentQuery, executeFinanzAIQuery, activeResult, loadingData, refreshFinancialData, syncFinancialData }`.
  - **Props de `FinanzAITriggerButton`:** `{ variant?: 'sidebar' | 'mobile-fab' | 'header-pill', onPress? }`.
- **Dependencias Internas:**
  - `feat-finanzai-query-engine`
  - `feat-future-purchases-viability`
  - `feat-layout-adaptive-navigation`
  - `feat-dashboard-console`

---

## [feat-loans-legacy-installments] - Gestión de Préstamos y Cuotas Amortizables (Tabla `loans`)
- **Estado:** Estable
- **Descripción:** Endpoints REST y esquema relacional en Cloudflare D1 para registrar, listar y eliminar préstamos con seguimiento de cuotas totales (`total_installments`), cuotas pagadas (`paid_installments`) y cuota mensual (`monthly_installment`), integrados además en el endpoint de pago mensual (`POST /monthly-payments/toggle` con `target_type = 'loan_installment'`).
- **Archivos / Rutas Clave:**
  - `backend/src/index.ts` (`GET /loans`, `POST /loans`, `DELETE /loans/:id`, `POST /monthly-payments/toggle`)
  - `backend/src/db/schema.sql` (tabla `loans`)
- **Puntos de Contacto / Interfaces:**
  - **Endpoints HTTP:** `GET /loans`, `POST /loans`, `DELETE /loans/:id`.
  - **Base de Datos:** Tabla `loans` y actualización automática de `paid_installments` al alternar pagos en `monthly_payments`.
- **Dependencias Internas:**
  - `feat-fixed-monthly-checklist`

---

## [feat-infra-xcode27-patch] - Parche Automatizado de Compatibilidad Expo CLI para Xcode 27 y Simulador iOS
- **Estado:** Estable
- **Descripción:** Script de `postinstall` (`scripts/patch-expo-xcode27.cjs`) que aplica parches idempotentes sobre `@expo/cli` para garantizar compatibilidad con Xcode 27+ (donde `Simulator.app` fue renombrado a `DeviceHub.app`), pre-arrancar el dispositivo iOS vía `xcrun simctl boot`, evitar bloqueos de `/usr/bin/open` en macOS 26.4+ y liberar automáticamente el puerto `8081` cuando una instancia previa de Metro queda huérfana.
- **Archivos / Rutas Clave:**
  - `scripts/patch-expo-xcode27.cjs`
  - `package.json` (script `"postinstall": "node scripts/patch-expo-xcode27.cjs"`)
- **Puntos de Contacto / Interfaces:**
  - **Ejecución:** Automática tras `npm install` o manual mediante `node scripts/patch-expo-xcode27.cjs`.
  - **Archivos intervenidos en `node_modules`:** `@expo/cli/build/src/start/platforms/ios/AppleDeviceManager.js`, `simctl.js`, `open.js` y `BundlerDevServer.js`.
- **Dependencias Internas:**
  - Infraestructura transversal de desarrollo local para iOS y Web.

---

## [feat-future-purchases-viability] - Módulo de Futuras Compras Posibles, Simulador de Carrito y Motor de Viabilidad Cuantitativa
- **Estado:** Estable
- **Descripción:** Planificador inteligente de deseos, proyectos de compra y nuevas suscripciones que evalúa en tiempo real la viabilidad matemática de cada ítem (`viable_today`, `viable_planned`, `postpone`) cruzando el *Safe-to-Spend* diario, el cupo disponible y día de corte de tarjetas de crédito, y los meses en que expiran préstamos o gastos actuales (*Smart Debt-Release Matching*). Incluye comparador de 3 caminos (Contado vs. $N$ Cuotas vs. Ahorro Previo), indicadores anti-impulso (horas laborales equivalentes y costo de oportunidad en cuenta rentable a 12 meses), **Modo Carrito** multi-ítem y **Conversión en 1 Toque ("Lo Compré")** que transforma el deseo en un gasto variable o compromiso recurrente en cuotas.
- **Archivos / Rutas Clave:**
  - `src/components/finance/FuturePurchasesSection.tsx` (`FuturePurchasesSection`, `CATEGORIES_CATALOG`)
  - `src/lib/finance.ts` (`evaluateFuturePurchase`, `evaluateFuturePurchasesCart`, `getDebtReleaseMilestones`, `FuturePurchaseEvaluation`, `FuturePurchaseCartSimulation`, `DebtReleaseMilestone`)
  - `src/lib/api.ts` (`getFuturePurchases`, `createFuturePurchase`, `updateFuturePurchase`, `deleteFuturePurchase`, `FuturePurchase`, `CreateFuturePurchaseInput`, `UpdateFuturePurchaseInput`)
  - `backend/src/index.ts` (`GET /future-purchases`, `POST /future-purchases`, `PUT /future-purchases/:id`, `DELETE /future-purchases/:id`, `ensureFuturePurchasesTable`)
  - `backend/src/db/schema.sql` (tabla `future_purchases`)
  - `src/app/(main)/dashboard.tsx` (pestaña `future_purchases`)
- **Puntos de Contacto / Interfaces:**
  - **Endpoints HTTP:** `GET /future-purchases`, `POST /future-purchases`, `PUT /future-purchases/:id`, `DELETE /future-purchases/:id` con respaldo local automático en `@finanzapp_future_purchases_v1`.
  - **Funciones del Motor Cuantitativo:** `evaluateFuturePurchase(item, context, overrideInstallments?, overridePaymentMode?) -> FuturePurchaseEvaluation` y `evaluateFuturePurchasesCart(selectedItems, context) -> FuturePurchaseCartSimulation`.
  - **Conversión Automática en 1 Toque:** Crea `variable_expenses` (si es al contado) o `recurring_items` con `end_date` calculado (si es en cuotas o suscripción) y marca `status = 'purchased'`.
- **Dependencias Internas:**
  - `feat-dashboard-console`
  - `feat-fixed-temporal-validity`
  - `feat-cards-quota-and-billing-alerts`
  - `feat-wallet-safe-to-spend`
  - `feat-wallet-variable-expenses`
  - `feat-cards-charges-and-installments`
  - `feat-savings-compound-forecast-engine`
  - `feat-intelligence-diagnostic-engine`
  - `feat-finanzai-query-engine`
  - `feat-privacy-camouflage-mode`
  - `feat-ui-liquid-glass-design-system`

---

## [feat-ui-ambient-hero-card] - Sistema Transversal de Cabecera Ambiental Liquid Glass y Acciones Circulares
- **Estado:** Estable
- **Descripción:** Componente visual reutilizable (`AmbientHeroCard`) que unifica la estética de cabecera en todas las pantallas y pestañas de FinanzApp: fondo `#0B101B` con doble halo radial SVG (`heroBlueOrbGlow` + `heroEmeraldSideGlow`), píldora superior interactiva con selector `< Mes >` integrado (`onPrevPeriod`, `onNextPeriod`), contador de alertas con ícono de llama (`Flame`), anillo circular SVG de porcentaje (`36×36px`), monto principal gigante con `tabular-nums` y badge de variación, fila inferior de botones circulares de acción rápida (`52×52px` con `gap: 10`) con iconografía vectorial fintech duotono/squircle a medida (`FintechAddIcon`, `FintechGoalsIcon`, `FintechAnalyticsIcon`, `FintechSparklesIcon`, `FintechExportIcon`, `FintechProfileIcon`, `FintechWalletIcon`, `FintechCheckIcon`, `FintechCopyIcon`, `FintechLogoutIcon`, `FintechCartIcon`) y orbe azul luminoso interactivo (`52×52px`).
- **Archivos / Rutas Clave:**
  - `src/components/ui/AmbientHeroCard.tsx` (`AmbientHeroCard`, `AmbientHeroAction`, `AmbientHeroCardProps`, `FintechAddIcon`, `FintechGoalsIcon`, `FintechAnalyticsIcon`, `FintechSparklesIcon`, `FintechExportIcon`, `FintechProfileIcon`, `FintechWalletIcon`, `FintechCheckIcon`, `FintechCopyIcon`, `FintechLogoutIcon`, `FintechCartIcon`)
  - `src/app/(main)/dashboard.tsx` (`DashboardScreen`)
  - `src/components/finance/ExecutiveSummarySection.tsx` (`ExecutiveSummarySection`)
  - `src/components/finance/WalletSection.tsx` (`WalletSection`)
  - `src/components/finance/FixedItemsSection.tsx` (`FixedItemsSection`)
  - `src/components/finance/CreditCardsSection.tsx` (`CreditCardsSection`)
  - `src/components/finance/SavingsForecastSection.tsx` (`SavingsForecastSection`)
  - `src/components/finance/FuturePurchasesSection.tsx` (`FuturePurchasesSection`)
  - `src/components/finance/FinancialTipsSection.tsx` (`FinancialTipsSection`)
  - `src/app/(main)/profile.tsx` (`ProfileScreen`)
- **Puntos de Contacto / Interfaces:**
  - **Componente UI:** `<AmbientHeroCard capsuleLabel capsuleIcon ringPercent eyebrowLabel heroValue subtitle actions onPressOrb footerContent />`.
- **Dependencias Internas:**
  - `feat-ui-liquid-glass-design-system`
  - `feat-dashboard-console`
  - `feat-summary-cashflow-and-simulator`
  - `feat-wallet-safe-to-spend`
  - `feat-fixed-monthly-checklist`
  - `feat-savings-compound-forecast-engine`
  - `feat-future-purchases-viability`
  - `feat-intelligence-diagnostic-engine`
  - `feat-profile-personal-data`

---
