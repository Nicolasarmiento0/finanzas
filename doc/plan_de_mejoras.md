# Plan Integral de Mejoras y Nuevas Funciones — FinanzApp

**Fecha de creación:** 2026-11-05  
**Estado:** En Ejecución Rigurosa por Etapas (Etapas 1, 2, 3, 4, 5, 6 y Módulo Cuentas & Variables Completadas — Etapa 7 en Verificación)  
**Objetivo:** Elevar la precisión financiera, coherencia en tiempo real, usabilidad visual y capacidad proyectiva de la plataforma, abordando rigurosamente los 7 requerimientos solicitados por el usuario.

---

## Índice de Etapas de Implementación

1. [x] [Etapa 1: Consola Financiera y Desglose de Patrimonio (Con/Sin Ahorros)](#etapa-1-consola-financiera-y-desglose-de-patrimonio-consin-ahorros) — **COMPLETADA**
2. [x] [Etapa 2: Paleta Semántica en Distribución de Gastos por Categoría](#etapa-2-paleta-semántica-en-distribución-de-gastos-por-categoría) — **COMPLETADA**
3. [x] [Etapa 3: Espaciado y UX del Formulario de Movimientos Recurrentes](#etapa-3-espaciado-y-ux-del-formulario-de-movimientos-recurrentes) — **COMPLETADA**
4. [x] [Etapa 4: Tarjetas de Crédito en el Checklist Mensual de Gastos Fijos](#etapa-4-tarjetas-de-crédito-en-el-checklist-mensual-de-gastos-fijos) — **COMPLETADA**
5. [x] **Módulo Exclusivo: Cuentas & Gastos Variables Diarios (Billetera / Sueldo Libre)** — **COMPLETADA**
6. [x] [Etapa 5: Saldo Final Dinámico Post-Pagos en el Checklist Mensual](#etapa-5-saldo-final-dinámico-post-pagos-en-el-checklist-mensual) — **COMPLETADA**
7. [x] [Etapa 6: Proyección del 10% Adicional del Remanente Libre en Ahorro](#etapa-6-proyección-del-10-adicional-del-remanente-libre-en-ahorro) — **COMPLETADA**
8. [ ] [Etapa 7: Pruebas Integrales, Compilación y Verificación de Datos Reales](#etapa-7-pruebas-integrales-compilación-y-verificación-de-datos-reales) — **SIGUIENTE**

---

## Etapa 1: Consola Financiera y Desglose de Patrimonio (Con/Sin Ahorros)

### Contexto & Problema Detectado
- En `src/app/(main)/dashboard.tsx`, la tarjeta superior con la marca **"FinanzApp · Consola Financiera"** calculaba el `PATRIMONIO NETO CONSOLIDADO` usando los saldos estáticos `current_balance` de la base de datos sin considerar el cambio de mes (`period`), manteniéndose estática a pesar de que el usuario cambiara de mes.
- El usuario solicitó explícitamente dividir el patrimonio y la liquidez en dos perspectivas:
  1. **Total con Ahorros (Patrimonio Neto Consolidado):** Representa el valor neto total de su patrimonio (Cuentas Corrientes + Ahorro Personal − Deudas Totales).
  2. **Total sin Ahorros (Liquidez Operativa Neta):** Representa el margen de maniobra de efectivo real inmediato (Cuentas Corrientes − Deudas Totales), permitiendo saber si la liquidez del día a día cubre las deudas sin tocar las reservas de emergencia o inversión.

### Tareas Técnicas
1. **Unificar la lógica de proyección en `dashboard.tsx`:**
   - Integrar `calculateProjectedPosition(getCurrentPeriod(), period, accounts, recurringItems)` en el encabezado principal del dashboard.
   - De este modo, al cambiar de mes en cualquier selector, la tarjeta superior de la Consola Financiera responderá de inmediato al flujo de ingresos y gastos de cada periodo.
2. **Implementar el Desglose Dual (Con Ahorro vs. Sin Ahorro):**
   - En `dashboard.tsx` y en `ExecutiveSummarySection.tsx`:
     - **Indicador Principal 1: Total con Ahorros (Patrimonio Neto):** $Cuentas + Ahorros - Deudas$.
     - **Indicador Principal 2: Total sin Ahorros (Liquidez Neta Operativa):** $Cuentas - Deudas$.
     - Pastillas descriptivas para saber si la liquidez operativa está en superávit o si se depende del ahorro para solventar deudas.
3. **Unificación y Eliminación de Duplicidad Visual:**
   - Se eliminó el bloque redundante `RESUMEN EJECUTIVO CONSOLIDADO Patrimonio Neto & Liquidez` de `ExecutiveSummarySection.tsx`.
   - Se subió el selector de mes global (`< Periodo > [Hoy]`) directamente a la cabecera permanente de **FinanzApp · Consola Financiera** en `dashboard.tsx`.
   - En la pestaña Resumen Ejecutivo ahora inicia directamente la sección limpia de **OPERATIVA DEL MES ({period}) Flujo de Caja Libre Mensual Estimado**, distribución de gastos y exportaciones.

---

## Etapa 2: Paleta Semántica en Distribución de Gastos por Categoría

### Contexto & Problema Detectado
- Actualmente en `ExecutiveSummarySection.tsx`, la paleta de colores para la distribución de gastos por categoría (`CATEGORY_PALETTE`) usa tonos monocromáticos y grises (`#FFFFFF`, `#A1A1AA`, `#71717A`, `#D4D4D8`, etc.) asignados por índice (`idx % length`).
- Esto hace que categorías críticas como *Vivienda*, *Alimentación*, *Educación* o *Transporte* sean difíciles de distinguir a simple vista en el gráfico de barras y en la lista de desglose.

### Tareas Técnicas
1. **Definir Mapa de Colores Semánticos ACS/Tesla:**
   - Asignar a cada categoría un color fijo, armónico y de alto contraste:
     - **Educación:** Azul Eléctrico (`#38BDF8`)
     - **Vivienda / Arriendo:** Púrpura Violeta (`#A855F7`)
     - **Transporte / Vehículo:** Ámbar Dorado (`#F59E0B`)
     - **Alimentación / Supermercado:** Verde Esmeralda (`#10B981`)
     - **Salud & Seguros:** Rojo Coral (`#F43F5E`)
     - **Suscripciones & Apps:** Índigo Neón (`#818CF8`)
     - **Préstamos & Créditos:** Naranja Intenso (`#FB923C`)
     - **Servicios Básicos:** Cian Aqua (`#06B6D4`)
     - **Entretenimiento:** Rosa Fucsia (`#EC4899`)
     - **Otros / General:** Gris Plata Platino (`#94A3B8`)
2. **Aplicar en Visualización:**
   - Actualizar las barras horizontales de participación porcentual.
   - Actualizar los puntos de viñeta (dots) y los chips de categoría para que el usuario identifique instantáneamente el destino de sus gastos.

---

## Etapa 3: Espaciado y UX del Formulario de Movimientos Recurrentes

### Contexto & Problema Detectado
- En `src/components/finance/FixedItemsSection.tsx`, el formulario para crear un gasto o ingreso fijo (`showAddForm`) y para editarlo tiene elementos muy cercanos entre sí en pantallas móviles (etiquetas pegadas a los inputs, chips de categorías sin suficiente margen vertical, y botones de confirmación apretados).

### Tareas Técnicas
1. **Optimización de Espaciado (Tokens de Espaciado):**
   - Aumentar el `gap` vertical entre campos a `16px` (estándar iOS Form / Tesla UI).
   - Separar las etiquetas de sección (`CATEGORÍA`, `CUENTA ASOCIADA`, `VIGENCIA TEMPORAL`) con `marginTop: 14px` y `marginBottom: 8px`.
   - Dar un espaciado adecuado a los chips de categoría con `gap: 8px` y `paddingVertical: 8px`.
2. **Diseño Responsive para Móviles:**
   - Asegurar que la grilla de fechas (Mes Inicio y Mes Límite) y los selectores se apilen holgadamente en celulares (`twoColMobile` con `gap: 12px`).
   - Botón de "Guardar Movimiento" con altura táctil mínima de `48px` y margen superior despejado.

---

## Etapa 4: Tarjetas de Crédito en el Checklist Mensual de Gastos Fijos

### Contexto & Problema Detectado
- Hoy, las tarjetas de crédito están confinadas en su propia pestaña ("Tarjetas"). Sin embargo, el pago mensual de la tarjeta de crédito (monto facturado) es uno de los compromisos fijos más importantes del mes.
- El usuario debe poder ver en el **Checklist Mensual de Gastos Fijos** el monto facturado de cada una de sus tarjetas de crédito ingresadas (ej. Santander $23.000, CMR Falabella $54.560) junto al arriendo, la educación o las cuentas básicas, y poder marcarlas como "Pagadas" con un clic.

### Tareas Técnicas
1. **Sincronización de Tarjetas en el Checklist (`FixedItemsSection.tsx`):**
   - Leer las cuentas de tipo `credit_card` y su monto utilizado/facturado en el mes `period`.
   - Presentar cada tarjeta en el Checklist Mensual identificada con su distintivo visual (Santander, Falabella u Otra).
2. **Soporte de Estado de Pago para Tarjetas:**
   - El sistema de `monthly_payments` ya admite `target_type: 'credit_card'` o asociar el pago de la tarjeta en el periodo `period`.
   - Permitir marcar el checkbox `[ ✓ ]` de la tarjeta para indicar que el estado de cuenta mensual ya fue cancelado.
3. **Cálculo Consolidado:**
   - Sumar el pago de las tarjetas al total de gastos mensuales a pagar del checklist, asegurando que no queden deudas ocultas fuera del control mensual.

---

## Etapa 5: Saldo Final Dinámico Post-Pagos en el Checklist Mensual — **COMPLETADA**

### Contexto & Problema Detectado
- Actualmente, el checklist mensual muestra la suma de lo pagado y lo pendiente, pero **no le decía al usuario cuánto dinero le queda en su cuenta bancaria** a medida que va pagando sus cuentas, ni cuál será su saldo final real cuando termine de pagarlo todo.

### Implementación Realizada
1. **Cálculo de Saldos Dinámicos en Tiempo Real (`FixedItemsSection.tsx`):**
   - **Total Pagado:** Suma inmediata de gastos fijos y facturación de tarjetas marcadas como pagadas en el periodo.
   - **Resta por Pagar:** $\max(0, \text{Total Compromisos} - \text{Total Pagado})$.
   - **Saldo Final Libre tras Pagar Todo (Superávit/Remanente Mensual):**
     $$\text{Saldo Final} = \text{Ingresos Fijos} - \text{Total Compromisos (Gastos + Tarjetas)}$$
   - **Saldo Estimado en Cuenta Corriente:**
     $$\text{Saldo Bancario Proyectado} = \max(0, \text{Saldo Cuentas Corrientes} - \text{Compromisos Pendientes})$$
2. **Componente Visual de Control de Saldo Post-Pagos:**
   - Panel dinámico con `CheckCircle2` y barra de progreso animada ($X\%$ Pagado).
   - Indicador de estado de 100% de cumplimiento cuando todos los compromisos se cancelan.
   - Reemplazo del icono `+ Cerrar` por `✕ Cerrar` cuando el formulario está desplegado.

---

## Etapa 6: Proyección del 10% Adicional del Remanente Libre en Ahorro — **COMPLETADA**

### Contexto & Problema Detectado
- El usuario plantea una regla inteligente de ahorro automático: además del ahorro fijo o porcentual ya establecido en las cuentas de ahorro, proyectar destinar un **10% del remanente final libre** que queda tras pagar todos los gastos fijos del mes.

### Implementación Realizada
1. **Fórmula del 10% del Remanente Libre (`finance.ts`):**
   - En cada mes proyectado $m$:
     $$\text{Remanente Libre} = \max(0, \text{Ingresos}_m - \text{Gastos Fijos}_m - \text{Tarjetas}_m)$$
     $$\text{Aporte Extra 10\%} = \text{Remanente Libre} \times 0.10$$
   - Integrado de forma retrocompatible con el parámetro `options.applyTenPercentSurplusRule` en:
     - `calculateForecast`
     - `calculateConsolidatedForecast`
     - `calculateProjectedPosition`
2. **Visualización y Selector Interactivo en `SavingsForecastSection.tsx`:**
   - Toggle interactivo: `[ ✓ ] Proyectar Ahorro Acelerado (+10% del Remanente Libre)`.
   - Card comparativo de beneficios en tiempo real con 3 métricas:
     - *Capital Extra Generado:* $+\$X$ CLP adicionales acumulados en el horizonte seleccionado.
     - *Saldo sin Regla del 10%* vs *Saldo Total Acelerado*.
     - Indicador de aceleración de meta (cuántos meses antes se alcanza la meta gracias al 10% adicional).

---

## Etapa 7: Pruebas Integrales, Compilación y Verificación de Datos Reales

### Tareas Técnicas
1. **Verificación de Tipos & Compilación:**
   - Ejecutar `tsc --noEmit` en frontend y backend para certificar 0 errores tipográficos o de contrato.
   - Ejecutar `expo export -p web` para verificar el empaquetado del bundle web.
2. **Pruebas de Flujo con los Datos Reales del Usuario:**
   - Verificar la transición de meses entre `2026-11` (Noviembre), `2026-12` (Diciembre con Polla 500k y Matrícula 250k) y `2027-01` (Enero con fin de Chevrolet Sail y Polla) en la Consola Financiera y en el Resumen Ejecutivo.
   - Verificar el funcionamiento del checklist con las tarjetas Santander ($23.000) y CMR Falabella ($54.560).
   - Verificar los cálculos de saldo final tras pagar y la proyección del 10% de ahorro.

---

## Aprobación para Ejecución

¿Deseas que iniciemos con la ejecución paso a paso siguiendo este plan riguroso? Quedo a la espera de tu confirmación.
