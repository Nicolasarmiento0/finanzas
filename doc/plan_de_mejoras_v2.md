# Plan de Mejoras v2 — FinanzApp

**Fecha de creación:** 2026-11-06  
**Estado:** Propuesta Técnica Aprobada para Ejecución  
**Enfoque de Diseño:** Arquitectura Universal React Native (iOS, Android, Web), Diseño Tesla Minimalist / iOS Liquid Glass (`#050505`, `#0C0C0E`, `#FFFFFF`, `#34D399`, `#FB923C`), Cero Costo de Infraestructura.

---

## Índice de Etapas de Implementación

1. [x] **Etapa 1:** [Categoría "Préstamo / Deuda" en Gastos Variables Diarios](#etapa-1-categoría-préstamo--deuda-en-gastos-variables-diarios) — **COMPLETADA**
2. [ ] **Etapa 2:** [Sincronización Total de Gastos de Tarjeta de Crédito con el Checklist de Gastos Fijos](#etapa-2-sincronización-total-de-gastos-de-tarjeta-de-crédito-con-el-checklist-de-gastos-fijos)
3. [ ] **Etapa 3:** [Temporalidad y Cuotas en Tarjetas (Reutilización del Formulario de Gastos Fijos)](#etapa-3-temporalidad-y-cuotas-en-tarjetas-reutilización-del-formulario-de-gastos-fijos)
4. [ ] **Etapa 4:** [Eliminación de Emojis y Armonización Iconográfica en Cuentas de Ahorro](#etapa-4-eliminación-de-emojis-y-armonización-iconográfica-en-cuentas-de-ahorro)
5. [ ] **Etapa 5:** [5 Ideas de Alto Impacto para FinanzApp (Cero Inversión)](#etapa-5-5-ideas-de-alto-impacto-para-finanzapp-cero-inversión)

---

## Etapa 1: Categoría "Préstamo / Deuda" en Gastos Variables Diarios

### Contexto & Necesidad
En el módulo de **Cuentas & Gastos Variables** (`WalletSection.tsx`), el usuario registra gastos del día a día (almuerzo, café, supermercado, etc.). Sin embargo, en la vida real ocurren desembolsos cotidianos asociados a préstamos: pagar una cuota puntual a un familiar/amigo, prestarle dinero a alguien, o amortizar un crédito informal. Actualmente no existe esa categoría en los accesos rápidos.

### Diagnóstico Técnico
- En `src/components/finance/WalletSection.tsx`, el array `VARIABLE_QUICK_CATEGORIES` cuenta con: `almuerzo`, `cafe`, `supermercado`, `transporte`, `delivery`, `farmacia`, `ocio` y `otro`.
- La función de color semántico `getCategoryColor()` en `WalletSection.tsx` y en `lib/finance.ts` ya contempla el color naranja `#FB923C` para créditos y préstamos, pero no está mapeado a un selector rápido.

### Tareas Técnicas a Ejecutar
1. **Incorporar la categoría `prestamo` en `VARIABLE_QUICK_CATEGORIES`:**
   - **Identificador:** `'prestamo'`
   - **Etiqueta:** `'Préstamo'`
   - **Ícono:** `HandCoins` o `Banknote` de `lucide-react-native` (sin emojis).
   - **Color Semántico:** Naranja Financiero `#FB923C`.
2. **Actualizar el mapeo de categorías y colores:**
   - Asegurar que `getCategoryColor('prestamo')` retorne `#FB923C` en todos los listados de desglose de la billetera.
   - Sincronizar el badge de categoría en la fila de gastos (`categoryMiniBadge`) para que muestre `PRÉSTAMO` con fondo `rgba(251, 146, 60, 0.12)` y borde `rgba(251, 146, 60, 0.35)`.

---

## Etapa 2: Sincronización Total de Gastos de Tarjeta de Crédito con el Checklist de Gastos Fijos

### Contexto & Problema Detectado
Al agregar un cargo o gasto a una tarjeta de crédito (ej. suscripciones, cuotas o cargos directos en CMR Falabella o Santander), dicho monto **no se refleja en el Monto Total Facturado de la tarjeta visible en el Checklist de Gastos Fijos** (`FixedItemsSection.tsx`).

### Causa Raíz
- En `FixedItemsSection.tsx` (líneas 133-146), el cálculo de deuda de las tarjetas de crédito se realiza exclusivamente leyendo el saldo base estático de la cuenta:
  ```ts
  const creditCards = accounts.filter((a) => a.type === 'credit_card');
  const activeCards = creditCards.filter((c) => (c.current_balance || 0) > 0);
  const totalCardDebt = activeCards.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  ```
- Mientras tanto, en `CreditCardsSection.tsx` (línea 444), el monto facturado real (`usedAmount`) se calcula sumando el saldo base más los cargos recurrentes activos del mes:
  ```ts
  const cardItems = recurringItems.filter(
    (item) => item.account_id === card.id && item.type === 'expense' && isItemActiveInMonth(item, period)
  );
  const metrics = calculateCreditCardMetrics(card, cardItems, period);
  // metrics.usedAmount = baseBalance + recurringCharges
  ```
- Como `FixedItemsSection.tsx` ignora `cardItems` y `metrics.usedAmount`, cualquier cargo o compra agregada a la tarjeta queda huérfana en el checklist de gastos fijos del mes.

### Tareas Técnicas a Ejecutar
1. **Unificar el cálculo de Facturación en `FixedItemsSection.tsx`:**
   - Para cada tarjeta de crédito, calcular su `usedAmount` dinámico para el mes `period`:
     $$\text{Monto Facturado Mes} = \text{Saldo Base} + \sum \text{Cargos Recurrentes y Cuotas Activas en } \text{period}$$
   - Si $\text{usedAmount} > 0$, la tarjeta se incluye en el Checklist Mensual de compromisos a pagar.
2. **Actualizar el Item de la Tarjeta en el Checklist:**
   - Mostrar el desglose exacto: `formatCLP(metrics.usedAmount)` (en lugar de `card.current_balance`).
   - Mostrar un subtítulo informativo: `"Recurrentes mes: $X · Saldo base: $Y"`.
3. **Prevenir Duplicidad Visual:**
   - Si los ítems recurrentes vinculados a una tarjeta ya están sumados dentro del monto consolidado de la tarjeta en el checklist, excluir esos ítems del listado general de gastos fijos sueltos, evitando que se cuenten dos veces en el total a pagar del mes.

---

## Etapa 3: Temporalidad y Cuotas en Tarjetas (Reutilización del Formulario de Gastos Fijos)

### Contexto & Problema Detectado
Actualmente, el botón *"Agregar Cargo / Paquete"* dentro de `CreditCardsSection.tsx` solo solicita **Nombre** y **Monto Inicial**, asignando automáticamente el mes actual sin consultar vigencia temporal ni cantidad de cuotas. El usuario requiere saber **por cuánto tiempo** aplicará ese cargo (ej. 3 cuotas, 12 meses, o indefinido), reutilizando la estructura del formulario de gastos fijos.

### Tareas Técnicas a Ejecutar
1. **Extensión del Formulario de Cargo en Tarjeta (`CreditCardsSection.tsx`):**
   - Reutilizar el bloque de **Vigencia Temporal** de `FixedItemsSection.tsx`:
     - **Mes de Inicio (`start_date`):** Por defecto el mes seleccionado (`YYYY-MM`).
     - **Mes Límite (`end_date`) / Selector Rápido de Cuotas:**
       - Chips de acceso rápido para cuotas frecuentes: `3 Cuotas`, `6 Cuotas`, `12 Cuotas`, `24 Cuotas`, `Indefinido`.
       - Al presionar un chip (ej. `6 Cuotas`), calcular automáticamente el `end_date` sumando los meses correspondientes.
   - **Categoría del Cargo:** Permitir seleccionar la categoría (Suscripciones, Educación, Vehículo, Salud, etc.) para que se clasifique correctamente en los reportes y en el gráfico de torta/barras.
2. **Creación de Movimiento Recurrente Vinculado:**
   - Al guardar, enviar a la API (`onCreateRecurringItem`):
     ```ts
     {
       account_id: cardId,
       title: chargeTitle.trim(),
       amount: chargeAmount,
       type: 'expense',
       category: chargeCategory,
       start_date: startDate,
       end_date: endDate || null,
       is_active: true,
     }
     ```
3. **Visibilidad en el Efecto Bola de Nieve:**
   - Como estos cargos de tarjeta tendrán `end_date` definido, el motor de diagnóstico en **Consejos Financieros** detectará automáticamente la fecha en que se liberará ese flujo mensual (`insight-expiring`), nutriendo el Efecto Bola de Nieve.

---

## Etapa 4: Eliminación de Emojis y Armonización Iconográfica en Cuentas de Ahorro

### Contexto & Problema Detectado
En el modal/formulario de creación de cuentas de ahorro (`SavingsForecastSection.tsx`), las opciones de tipo de cuenta muestran emojis de texto:
- `👤 Individual (Solo yo)`
- `👥 En Pareja (Compartido)`

Esto rompe la estética minimalista monocromática tipo Tesla / iOS Liquid Glass del resto de la aplicación.

### Tareas Técnicas a Ejecutar
1. **Reemplazo por Componentes Iconográficos Limpios:**
   - En lugar de emojis en el string de texto, utilizar íconos vectoriales SVG de `lucide-react-native`:
     - **Individual:** `<PiggyBank size={15} color={...} />` acompañado del texto `"Ahorro Personal (Solo yo)"`.
     - **En Pareja:** `<Users size={15} color={...} />` o doble chanchito/corazón sutil acompañado del texto `"Ahorro en Pareja (Compartido)"`.
2. **Píldoras Segmentadas de Alto Contraste:**
   - Los segmentos mantendrán el estilo de vidrio translúcido con borde `colors.glassBorderFocused` y fondo iluminado sutil `rgba(255, 255, 255, 0.08)` al estar seleccionados.
3. **Limpieza en Textos Secundarios:**
   - Revisar cualquier otro emoji residual en los modales de ahorro para mantener 100% la estética técnica y limpia de FinanzApp.

---

## Etapa 5: 5 Ideas de Alto Impacto para FinanzApp (Cero Inversión)

Propuestas de funcionalidades con alto valor percibido que no requieren contratación de APIs externas, bases de datos adicionales ni costos operativos:

### 1. Simulador Interactivo de Pago Acelerado de Deudas (Método Bola de Nieve vs. Avalancha)
- **Concepto:** Una herramienta visual en la pestaña de Tarjetas que permite al usuario ingresar un "Aporte Extra Mensual" (ej. \$50.000 CLP).
- **Funcionamiento:** Algoritmo determinista en cliente que simula mes a mes qué pasaría si ese monto extra se aplica a la deuda con menor saldo (**Bola de Nieve**) vs. la deuda con mayor costo (**Avalancha**).
- **Impacto para el Usuario:** Muestra una comparativa clara: *"Quedarás 100% libre de deudas 7 meses antes y ahorrarás \$142.000 en cuotas e intereses"*.
- **Costo:** \$0 (puro cálculo matemático en el navegador/dispositivo).

### 2. Regla 50 / 30 / 20 Automática con Indicador de Salud Financiera en Vivo
- **Concepto:** En el Resumen Ejecutivo o en la Billetera, clasificar automáticamente el flujo del mes según la regla clásica de finanzas personales:
  - **50% Necesidades / Fijos:** Arriendo, dividendos, servicios, créditos obligatorios.
  - **30% Deseos / Variables:** Almuerzos fuera, cafés, delivery, ocio.
  - **20% Ahorro & Inversión:** Cuentas remuneradas, ahorro en pareja.
- **Funcionamiento:** Una barra de 3 colores que avisa visualmente si tus gastos variables o fijos están sobrepasando el límite recomendado antes de que termine el mes.
- **Costo:** \$0 (agrega capas analíticas sobre los datos que el usuario ya registra).

### 3. Recordatorios de Pago y Fechas de Facturación en Calendario (.ICS 1-Click)
- **Concepto:** Botón *"Sincronizar Fechas con mi Calendario"* en el checklist de gastos fijos y tarjetas.
- **Funcionamiento:** Genera un archivo estándar `.ics` en memoria (RFC 5545) que el usuario puede abrir directamente en Apple Calendar, Google Calendar u Outlook en su celular o computador, creando eventos automáticos 2 días antes de cada fecha de facturación y vencimiento de cuentas.
- **Impacto para el Usuario:** Evita pagos atrasados e intereses de mora sin requerir servidores de envío de correos o SMS pagos.
- **Costo:** \$0 (generación de strings ICS en el cliente).

### 4. Sistema de Respaldo y Restauración Completa en JSON (Backup & Restore Seguro)
- **Concepto:** En la sección de Perfil, añadir dos botones: *"Descargar Copia de Seguridad Completa (JSON)"* y *"Restaurar Copia de Seguridad"*.
- **Funcionamiento:** Exporta todas las tablas locales/Cloudflare (cuentas, ítems recurrentes, gastos variables, pagos mensuales) en un único archivo estructurado `finanzapp-backup-YYYY-MM-DD.json`. Permite volver a cargar los datos en cualquier dispositivo nuevo con un solo clic.
- **Impacto para el Usuario:** Soberanía absoluta de sus datos y tranquilidad mental contra pérdidas accidentales.
- **Costo:** \$0 (utiliza las APIs nativas del navegador y Expo FileSystem).

### 5. Detector Inteligente de Micro-Fugas Financieras (Gastos Hormiga / Vampiro)
- **Concepto:** Un widget analítico en la Billetera que identifica gastos pequeños pero repetitivos (menores a \$10.000 CLP, ej. cafés, golosinas, micro-deliverys, apps que casi no se usan).
- **Funcionamiento:** Agrupa y proyecta: *"Este mes has gastado \$64.500 en compras menores a \$5.000 (representa el 8% de tu sueldo libre). Si redujeras la mitad y la invirtieras al 4% anual, tendrías \$402.000 adicionales en 12 meses"*.
- **Impacto para el Usuario:** Conciencia financiera inmediata sin esfuerzo adicional.
- **Costo:** \$0 (análisis estadístico frontend con los datos de gastos variables).

---

## Matriz de Priorización de Ejecución

| # | Módulo / Mejora | Complejidad | Impacto | Estado |
|---|---|:---:|:---:|:---:|
| 1 | Categoría "Préstamo" en Gastos Variables | Baja | Alto | Pendiente de Inicio |
| 2 | Sincronización Facturación Tarjetas en Checklist Fijos | Media | Crítico | Pendiente de Inicio |
| 3 | Formulario de Cargos en Tarjeta con Cuotas / Vigencia | Media | Alto | Pendiente de Inicio |
| 4 | Reemplazo de Emojis por Íconos en Ahorro | Baja | Medio (Estético) | Pendiente de Inicio |
| 5 | Ideas de Valor Agregado sin Inversión | Baja-Media | Muy Alto | Planificadas |
