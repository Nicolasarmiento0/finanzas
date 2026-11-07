# 🚀 Plan de Mejoras v3 — FinanzApp: Consola Financiera Inteligente

> **Documento de Especificación y Planificación de Nuevas Capacidades**  
> **Fecha:** Noviembre 2026  
> **Estado:** Listo para Aprobación  
> **Filosofía de Arquitectura:** 100% Inversión $0 (Serverless + Universal App) · Tesla Minimalist + iOS Liquid Glass

---

## 🎯 Objetivos de la Versión v3

1. **Categoría "Alimentación" en Tarjetas de Crédito:** Permitir clasificar compras y cuotas de tarjetas en supermercado, delivery o comida, habilitando el posterior análisis de riesgo crediticio en gastos de consumo básico.
2. **Edición Completa de Gastos Variables Diarios:** Permitir al usuario modificar montos, descripciones, categorías, fechas y cuentas de cualquier gasto variable registrado, sin tener que borrarlo y volverlo a crear.
3. **Motor de Inteligencia Financiera Profesional (El Algoritmo Estrella):** Diseñar e implementar un algoritmo analítico integral que examine **TODOS** los gastos e ingresos del mes (fijos, variables, sub-ítems y tarjetas), clasificados por categoría y patrones de consumo, para generar diagnósticos cuantitativos hiperpersonalizados (ej. detección de fugas en Uber Eats / delivery vs. supermercado, alertas de endeudamiento en comida, ratios 50/30/20 y oportunidades de micro-ahorro en CLP).

---

## 📋 Índice de Etapas de Implementación

- [x] [**Etapa 1:** Categoría de "Alimentación" en Gastos de Tarjeta de Crédito](#etapa-1-categoría-de-alimentación-en-gastos-de-tarjeta-de-crédito) — **COMPLETADA**
- [x] [**Etapa 2:** Edición Completa de Gastos Variables Diarios y de Tarjetas de Crédito (Backend + Frontend)](#etapa-2-edición-completa-de-gastos-variables-diarios-y-de-tarjetas-de-crédito-backend--frontend) — **COMPLETADA**
- [x] [**Etapa 3:** Motor de Inteligencia Financiera Profesional (El Algoritmo Estrella de FinanzApp)](#etapa-3-motor-de-inteligencia-financiera-profesional-el-algoritmo-estrella-de-finanzapp) — **COMPLETADA**
- [x] [**Etapa 4:** Integración en la Interfaz (Consejos y Mini-Diagnóstico en Dashboard)](#etapa-4-integración-en-la-interfaz-consejos-y-mini-diagnóstico-en-dashboard) — **COMPLETADA**
- [x] [**Etapa 5:** Verificación, Auditoría Universal y Despliegue](#etapa-5-verificación-auditoría-universal-y-despliegue) — **COMPLETADA**

---

## 🛠️ Detalle de las Etapas

### Etapa 1: Categoría de "Alimentación" en Gastos de Tarjeta de Crédito

#### Diagnóstico Actual
Actualmente, el array `CARD_CHARGE_CATEGORIES` en `CreditCardsSection.tsx` solo incluye:
`['suscripciones', 'tecnologia', 'transporte', 'salud', 'prestamo', 'servicios', 'fijo', 'general']`.
Si un usuario paga el supermercado o delivery con su tarjeta, debe marcarlo como `general` o `fijo`, perdiéndose la trazabilidad del gasto de alimentación.

#### Implementación Propuesta
1. **Actualización de Categorías:**
   - Agregar `'alimentacion'` a `CARD_CHARGE_CATEGORIES` en `src/components/finance/CreditCardsSection.tsx`.
   - Etiqueta en chip: `ALIMENTACIÓN` con icono alusivo de comida/canasta de compras.
   - Vinculación automática con el color institucional verde esmeralda (`#10B981`) mediante `getCategoryColor('alimentacion')` en `src/lib/finance.ts`.
2. **Compatibilidad:**
   - Soporte tanto para cargos permanentes como para compras diferidas en cuotas (1 mes, 3 cuotas, etc.).

---

### Etapa 2: Edición Completa de Gastos Variables Diarios (Backend + Frontend)

#### Diagnóstico Actual
- En `backend/src/index.ts` existen endpoints para `GET`, `POST` y `DELETE /variable-expenses/:id`, pero **no existe un endpoint `PUT` o `PATCH`**.
- En `src/lib/api.ts` no existe `updateVariableExpense`.
- En `WalletSection.tsx` solo existe el botón de eliminar gasto (`Trash2`), obligando al usuario a borrar y reingresar si se equivoca de monto o categoría.

#### Implementación Propuesta
1. **Backend Serverless (Cloudflare Workers API):**
   - Implementar endpoint `PUT /variable-expenses/:id`:
     - Validación de token JWT y sesión del usuario.
     - Verificación de que el gasto pertenezca al `user_id` autenticado.
     - Actualización en la base de datos Cloudflare D1 / SQLite de: `title`, `amount`, `category`, `date`, `account_id` y `notes`.
     - Retorno del objeto `VariableExpense` actualizado.
2. **Capa API Client (`src/lib/api.ts`):**
   - Definir `UpdateVariableExpenseInput`:
     ```ts
     export interface UpdateVariableExpenseInput {
       title?: string;
       amount?: number;
       category?: string;
       date?: string;
       account_id?: string;
     }
     ```
   - Implementar `updateVariableExpense(id: string, input: UpdateVariableExpenseInput): Promise<VariableExpense>`.
3. **Interfaz en `WalletSection.tsx`:**
   - Agregar botón de edición (icono `Pencil` de `lucide-react-native`) en cada fila de gasto variable.
   - Formulario o modal de edición con carga previa de los datos actuales (título, monto CLP, selector de categoría con chips, selector de fecha y selector de cuenta).
   - Actualización reactiva instantánea del saldo líquido de la cuenta asociada y recálculo del balance sin recargar la página.

---

### Etapa 3: Motor de Inteligencia Financiera Profesional (El Algoritmo Estrella de FinanzApp)

#### Visión del Algoritmo
Transformar la sección de **Consejos & Diagnóstico** en el diferenciador de mayor valor de FinanzApp: un analista financiero cuantitativo privado que no se limita a métricas globales, sino que **examina el detalle y desglose de cada gasto real del usuario** (fijos, variables, tarjetas y cuentas) para ofrecer sugerencias profesionales, empáticas y con montos exactos en Pesos Chilenos (`CLP`).

```
┌────────────────────────────────────────────────────────────────────────┐
│             FUENTES DE DATOS MENSUALES INGRESADAS AL MOTOR             │
├──────────────────┬──────────────────┬─────────────────┬────────────────┤
│  Gastos Fijos    │ Gastos Variables │    Tarjetas     │    Cuentas     │
│   y Sub-Ítems    │   y Categorías   │    y Cuotas     │   y Liquidez   │
└─────────┬────────┴────────┬─────────┴────────┬────────┴────────┬───────┘
          │                 │                  │                 │
          └─────────────────┴────────┬─────────┴─────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             MOTOR ANALÍTICO FINANCIERO (FinanzAI Intelligence)         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Detección de Fugas Discrecionales (Uber Eats/Delivery vs Super)     │
│ 2. Ratio Salud 50/30/20 Real (Necesidades vs Deseos vs Ahorro)         │
│ 3. Concentración y Categoría Dominante de Gasto Variable               │
│ 4. Alerta de Riesgo Crediticio (Financiar Alimentación en Cuotas)       │
│ 5. Proyección y Liberación Futura de Cuotas (Efecto Bola de Nieve)     │
│ 6. Costo de Oportunidad de Interés Compuesto (0% vs Instrumentos 4%+)  │
│ 7. Micro-Ahorro Cuantificado (Reducciones del 15%-30% con impacto)     │
│ 8. Cobertura Real del Fondo de Emergencia (Fijos + Promedio Variables) │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│            OUTPUT: CONSEJOS HIPERPERSONALIZADOS CON CIFRAS CLP         │
│     Diagnóstico Ejecutivo + Consejos Accionables + Badges de Salud     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Reglas Heurísticas y Casos de Diagnóstico Cuantitativo

1. **Regla de Fugas en Comida Rápida / Delivery vs. Supermercado:**
   - **Lógica:** Analiza los gastos variables y compras de tarjeta en categorías `salidas`, `compras`, `alimentacion` y títulos con palabras clave (`uber eats`, `pedidosya`, `rappi`, `mcdonalds`, `burger`, `pizza`, `delivery`, `sushi`, `starbucks`, `bar`, `restaurante`).
   - **Cálculo:** Suma total de delivery/salidas ($D) versus supermercado ($S).
   - **Consejo Profesional:** Si $D > 0.4 \times (D + S)$ o $D > \$80.000$:
     > *"Detectamos que has gastado **\$145.000 CLP en delivery y salidas**, lo que representa el 65% de tu gasto total en alimentación del mes. Si cocinas 3 días adicionales a la semana y transfieres **\$60.000 a supermercado**, ahorrarías **\$85.000 CLP al mes** (+\$1.020.000 al año para tu fondo de inversión)."*

2. **Regla de Financiamiento de Gastos Básicos en Tarjeta de Crédito:**
   - **Lógica:** Cruza cargos de tarjeta clasificados como `alimentacion`, `servicios` o `salud` pagados en más de 1 cuota (o con saldo rotativo).
   - **Consejo Profesional (Alerta Crítica):**
     > *"Tienes compras de alimentación y supermercado diferidas en cuotas en tu tarjeta de crédito. Financiar necesidades recurrentes a crédito genera un sobrecosto en intereses y compromete tus ingresos futuros. Recomendamos pagar este saldo al contado en la próxima facturación."*

3. **Regla de Concentración de Gasto Variable (La Categoría Dominante):**
   - **Lógica:** Calcula la distribución porcentual de todos los gastos variables del mes.
   - **Consejo Profesional:** Si una categoría variable (ej. `transporte por app`, `salidas`, `compras`) supera el 35% del gasto variable total o el 15% del ingreso líquido:
     > *"Tu mayor categoría de gasto variable este mes es **Salidas y Ocio (\$190.000 CLP)**, abarcando el 48% de tus egresos cotidianos. Establecer un tope semanal de \$35.000 te permitiría blindar tu flujo de caja sin privarte de entretenimiento."*

4. **Regla 50 / 30 / 20 Personalizada con Datos Reales:**
   - **Lógica:** Suma $\text{Gastos Fijos}$ (Necesidades), $\text{Gastos Variables}$ (Deseos/Estilo de vida) y $\text{Aportes a Cuentas de Ahorro}$ (Futuro) respecto al $\text{Ingreso Total}$.
   - **Consejo Profesional:**
     - Si Fijos > 60%: *"Carga Fija Elevada (X%): Tu estructura fija es rígida. Recomendamos renegociar contratos de servicios o pausar suscripciones prescindibles."*
     - Si Deseos > 30%: *"Exceso Discrecional (X%): Tus gastos del día a día están erosionando tu capacidad de ahorro."*
     - Si Ahorro >= 20%: *"¡Felicidades! Estás cumpliendo el estándar dorado de ahorro mensual (X% de tus ingresos ahorrado)."*

5. **Regla de Efecto Micro-Ahorro Cuantificado:**
   - **Lógica:** Identifica pequeños gastos variables frecuentes (< \$10.000 CLP repetidos más de 4 veces en el mes).
   - **Consejo Profesional:**
     > *"Detectamos 8 micro-gastos cotidianos que suman **\$38.500 CLP**. Si recortas la mitad mediante compras inteligentes, generarías **\$231.000 CLP adicionales al año** en tu cuenta de ahorro con interés compuesto."*

6. **Regla de Liberación de Flujo (Efecto Bola de Nieve Mejorado):**
   - Monitorea créditos, aranceles o cuotas que vencen en los próximos 1 a 6 meses, informando la fecha exacta y el monto mensual que quedará libre para ahorro automático.

7. **Regla de Optimización de Rentabilidad (Cuentas al 0% vs 4%+):**
   - Mantiene la comparación del costo de oportunidad de saldos ociosos en cuenta corriente/vista versus cuentas de interés compuesto.

---

### Etapa 4: Integración en la Interfaz (Consejos y Mini-Diagnóstico en Dashboard)

1. **Alimentación de Datos en `src/app/(main)/tips.tsx`:**
   - Cargar `getVariableExpenses(period)` junto con `getAccounts()` y `getRecurringItems()`.
   - Pasar los tres arreglos completos al componente [`FinancialTipsSection.tsx`](file:///Users/nico/Desktop/Workspace/dev/finanzapp/src/components/finance/FinancialTipsSection.tsx).
2. **Evolución Visual de `FinancialTipsSection.tsx`:**
   - **Banner de Diagnóstico Principal:** Tarjeta de cabecera con el puntaje de salud financiera del mes (0 a 100) y el principal consejo priorizado.
   - **Tarjetas de Diagnóstico Cuantitativo:**
     - Badge de tipo: `Alerta Prioritaria` (rojo/ámbar), `Oportunidad de Ahorro` (esmeralda), `Optimización de Hábito` (azul/violeta), `Salud Financiera` (verde).
     - Cifras resaltadas con tipografía tabular.
     - Botón de acción rápida (ej. "Ver Checklist Fijos", "Revisar Billetera", "Ajustar Ahorro").
3. **Mini-Diagnóstico en Dashboard:**
   - Incorporar en el Dashboard (`src/app/(main)/dashboard.tsx`) una píldora o mini-tarjeta de insight destacado para que el usuario reciba la recomendación más relevante apenas abre la app.

---

### Etapa 5: Verificación, Auditoría Universal y Despliegue

1. **Verificación de Tipos:** `npm run typecheck` (`tsc --noEmit`) sin errores.
2. **Build Web y Responsive:** `npm run export:web` garantizando 100% de ancho en iOS Safari móvil, Android y Desktop.
3. **Despliegue de Backend:** Actualizar worker en Cloudflare (`npm run backend:deploy`) con el nuevo endpoint `PUT /variable-expenses/:id`.
4. **Despliegue de Frontend:** Exportar y desplegar en Cloudflare Pages / Workers (`npm run deploy:web`).

---

## 📊 Matriz de Prioridad y Esfuerzo

| # | Capacidad / Tarea | Complejidad | Impacto | Estado |
|---|---|:---:|:---:|:---:|
| 1 | Categoría "Alimentación" en Tarjetas de Crédito | Baja | Alto | Completada |
| 2 | Edición de Gastos Variables y Tarjetas (Backend PUT + UI Animada) | Media | Muy Alto | Completada |
| 3 | Motor Analítico Integral (FinanzAI Intelligence - 12 Correlaciones) | Media-Alta | Excepcional | Completada |
| 4 | UI de Diagnóstico Cuantitativo y Mini-Insight en Dashboard | Media | Muy Alto | Completada |
| 5 | Consolidación Total de Deudas y Validación Universal | Baja | Crítico | Completada |
