# 💳 FinanzApp — Consola Financiera Personal Multiplataforma

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2052-000000.svg?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1%20%2B%20AI-F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-34D399.svg?style=for-the-badge)](LICENSE)

**FinanzApp** es una consola financiera personal integral construida con **React Native y Expo**, diseñada bajo una arquitectura **Universal App** (un único código base para **Web, Android y iOS**) y una estrategia de **Inversión $0 (Zero-Cost Stack)**.

Combina una estética **Tesla Minimalist + iOS Liquid Glass** con un motor de cálculo determinista en tiempo real y un **asistente conversacional híbrido (`FinanzAI`)** impulsado por **Cloudflare Workers AI + Tool-Calling exacto**, distinguiendo con precisión el **Patrimonio Neto Total**, el **Margen Operativo Mensual**, el **Safe-to-Spend diario**, el ahorro en pareja y las proyecciones de interés compuesto a largo plazo.

---

## 📸 Vista General y Filosofía de Diseño

- **Estética Tesla Minimalist + iOS Liquid Glass:** Fondo profundo (`#050505`), cabeceras ambientales SVG unificadas (`AmbientHeroCard`), superficies de cristal translúcido con desenfoque nativo (`expo-blur`), bordes sutiles y acentos verde esmeralda (`#34D399`) para flujos positivos y coral/ámbar (`#F87171` / `#FB923C`) para pasivos.
- **Tipografía y Legibilidad Fintech:** Formato en Pesos Chilenos (`CLP`), números tabulares (`tabular-nums`) perfectamente alineados verticalmente e iconografía vectorial limpia con `lucide-react-native` y `react-native-svg`.
- **Modo Privado / Camuflaje Global:** Botón transversal (`PrivacyToggleButton`) que enmascara en tiempo real todos los montos monetarios como `$ ••••••`, incluyendo burbujas, métricas y desgloses de **FinanzAI**.
- **Responsive Universal Elastic Layout:** Interfaz adaptable que pasa de una barra lateral fija (*Desktop Sidebar*) a una barra flotante de cristal (*Floating Glass Nav*) en smartphones, respetando Safe Areas dinámicas.

---

## 🚀 Módulos y Funcionalidades Implementadas

### 1. 📊 Consola Financiera y Resumen Ejecutivo
- **Doble Métrica de Posición Financiera:**
  - **Patrimonio Neto Consolidado (Con Ahorros):** Total acumulado entre ingresos activos, fondos de ahorro e inversión menos pasivos vigentes.
  - **Total sin Ahorros (Margen Operativo Mensual):** Mide la capacidad real de flujo del mes sin tocar capital ahorrado.
- **Flujo de Caja Libre Estimado y Regla +10%:** Cálculo en vivo ($\text{Ingresos Fijos} - \text{Gastos Comprometidos}$) con simulación de ahorro acelerado.
- **Selector de Período Mes a Mes:** Navegación histórica y proyectada con retorno inmediato al período actual.
- **Plantilla Base 1-Clic (Excel Seed) y Exportación CSV:** Carga inicial rápida y exportación de reportes.

### 2. 👛 Billetera, Safe-to-Spend y Gastos Variables
- **Gestión de Cuentas Líquidas:** Cuentas corrientes, cuentas vista, efectivo y billeteras digitales.
- **Límite Diario *Safe-to-Spend*:** Presupuesto libre disponible hasta fin de mes descontando los compromisos fijos aún pendientes de pago.
- **Atajos de Gasto Rápido (1-Toque):** Registro instantáneo de gastos frecuentes mediante `QuickExpenseShortcuts` con descuento directo opcional en cuenta.

### 3. 📋 Gastos e Ingresos Fijos (Checklist Operativo)
- **Checklist Mensual Interactivo:** Control visual de cada compromiso con estado persistente (**Pagado / Pendiente**).
- **Sincronización con Tarjetas y Préstamos:** Integra facturación mensual de tarjetas y cuotas amortizables sin duplicar montos.
- **Vigencia Temporal y Sub-Ítems Anidados:** Fechas `start_date` / `end_date` para detectar cuándo vencen créditos y desglose automático de sub-gastos.

### 4. 💳 Tarjetas de Crédito, Cupos y Tarjetero 3D
- **Tarjetero 3D Interactivo (Wallet Pocket) y Plásticos Bancarios:** Visualización realista para Santander, CMR Falabella y entidades adicionales.
- **Monitoreo de Utilización Crediticia:** Cupo total, disponible, barra de uso (regla del 30%) y alertas de día de corte.
- **Cargos Recurrentes y Compras en Cuotas:** Registro y seguimiento mensual de vigencia.

### 5. 🐷 Ahorro, Ahorro en Pareja e Interés Compuesto
- **Ahorro Individual y Compartido en Pareja:** Cuentas compartidas vinculables en tiempo real en D1 con inversión automática de roles (*Tú vs. Pareja*).
- **Estrategias Fijo y Superávit (Efecto Bola de Nieve):** Absorbe automáticamente el flujo liberado cuando expiran deudas con `end_date`.
- **Pronóstico de Interés Compuesto (1–60 Meses):** Proyección interactiva de capital aportado versus ganancia por interés.

### 6. 🛍️ Futuras Compras Posibles y Simulador de Viabilidad
- **Evaluación Cuantitativa de Deseos y Proyectos:** Clasifica compras potenciales al contado, en cuotas o nuevas suscripciones como `viable_today`, `viable_planned` o `postpone` según liquidez, remanente mensual y liberación futura de deudas.

### 7. 💡 Diagnóstico Financiero Proactivo y Consejos
- **Score de Salud Financiera (0–100):** Detecta saldos ociosos sin interés, carga fija >60%, sobreutilización de tarjetas y próximas cuotas por extinguirse.
- **Biblioteca de Buenas Prácticas y Reglas Personalizadas:** Filtros temáticos y creación de reglas financieras propias.

### 8. 🤖 FinanzAI — Asistente Financiero Conversacional Híbrido
- **Principio de Cero Alucinaciones Numéricas:** La IA nunca estima ni calcula cifras; invoca herramientas TypeScript deterministas y redacta explicaciones citando exclusivamente datos reales.
- **Hilo de Chat Multi-Turno y Memoria de Slots:** Interfaz tipo chat con burbujas, auto-scroll, acordeón colapsable de *Desglose Matemático Transparente*, persistencia local + D1 (`finanzai_messages`) y resolución anafórica de seguimiento (*"¿Y en 6 cuotas?"*, *"¿Y con la Santander?"*, *"¿Y la mitad?"*, *"¿Y al contado?"*).
- **Base de Conocimiento Declarativa (`finanzaiKnowledge.json`):** Comprensión de modismos chilenos (`lucas`, `palos`, `gambas`, `quedar pato`, `descalzar`), tolerancia a typos (distancia de Levenshtein), extracción multi-entidad y glosario oficial de FinanzApp.
- **Action Cards Confirmables en Línea:** Propone botones de 1 toque (con doble confirmación) para registrar un gasto variable, guardar en *Futuras Compras*, marcar un ítem fijo como pagado o ir directamente a una pestaña del Dashboard.
- **Cerebro Híbrido con Cloudflare Workers AI + Zero-Downtime Fallback:**
  - En producción consulta `POST /finanzai/chat` usando **Cloudflare Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) con 6 herramientas deterministas.
  - Si no hay red, sesión remota o cuota disponible, cae automáticamente y al instante al motor NLP local de `queryEngine.ts`.

### 9. 📤 Reportería CSV / Excel y Perfil
- **Exportación `.CSV`:** Codificación UTF-8 con BOM y separador `;` para Excel, Google Sheets y Numbers.
- **Perfil, Contraseña y Vinculación de Pareja:** Gestión de datos, cambio seguro de contraseña y código de vinculación.

---

## 🏗️ Arquitectura Técnica del Sistema

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                     Código Base Universal (Expo SDK 52)                    │
│              TypeScript + Expo Router v4 + Contextos Reactivos             │
├────────────────────┬───────────────────────┬───────────────────────────────┤
│    📱 Android      │       🍎 iOS          │         🌐 Web (PWA/SPA)      │
│   (React Native)   │   (React Native)      │       (React Native Web)      │
└──────────┬─────────┴───────────┬───────────┴───────────────┬───────────────┘
           │                     │                           │
           ▼                     ▼                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               Capa UI / Finanzas / Motor Offline Determinista              │
│   AdaptiveNavigation · AmbientHeroCard · PrivacyContext · finanzaiKnowledge │
│       Motor Local 24/7 (finance.ts, intelligence.ts, queryEngine.ts)       │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ HTTPS REST + Zero-Downtime Fallback
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            Backend Serverless — Cloudflare Workers + D1 + AI               │
│   Hono API + Cloudflare D1 (SQLite) + Workers AI (Llama 3.3 Tool-Calling)  │
│        Snapshot Cuantitativo en Servidor + Historial finanzai_messages     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```text
finanzapp/
├── src/
│   ├── app/                          # Rutas de Expo Router (File-based routing)
│   │   ├── _layout.tsx               # Providers raíz (Privacy + FinanzAI)
│   │   ├── (auth)/                   # Login y Registro
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (main)/                   # Vistas principales autenticadas
│   │   │   ├── _layout.tsx           # Layout con navegación adaptativa
│   │   │   ├── dashboard.tsx         # Consola financiera por pestañas
│   │   │   ├── tips.tsx              # Centro de consejos y diagnósticos
│   │   │   └── profile.tsx           # Perfil de usuario y vinculación
│   │   └── index.tsx
│   ├── components/
│   │   ├── finance/                  # Módulos financieros y chat FinanzAI
│   │   │   ├── CreditCardsSection.tsx
│   │   │   ├── CreditCardVisual.tsx
│   │   │   ├── ExecutiveSummarySection.tsx
│   │   │   ├── FinancialTipsSection.tsx
│   │   │   ├── FinanzAIAssistantModal.tsx
│   │   │   ├── FixedItemsSection.tsx
│   │   │   ├── FuturePurchasesSection.tsx
│   │   │   ├── QuickExpenseShortcuts.tsx
│   │   │   ├── SavingsForecastSection.tsx
│   │   │   └── WalletSection.tsx
│   │   ├── layout/
│   │   │   ├── AdaptiveNavigation.tsx
│   │   │   └── ScreenContainer.tsx
│   │   └── ui/
│   │       ├── AccordionToggle.tsx
│   │       ├── AmbientHeroCard.tsx
│   │       ├── FinanzAITriggerButton.tsx
│   │       ├── GlassCard.tsx
│   │       ├── GlassInput.tsx
│   │       ├── PrivacyToggleButton.tsx
│   │       └── TeslaButton.tsx
│   ├── context/
│   │   ├── FinanzAIContext.tsx       # Hilo de chat híbrido + D1/local + Action Cards
│   │   └── PrivacyContext.tsx        # Modo Privado / Camuflaje reactivo global
│   ├── data/
│   │   └── finanzaiKnowledge.json    # Base declarativa de vocabulario y contexto NLP/LLM
│   ├── hooks/
│   │   └── useResponsive.ts
│   ├── lib/
│   │   ├── api.ts                    # Cliente REST + endpoints /finanzai/*
│   │   ├── currency.ts               # Formateador CLP y máscara global
│   │   ├── exportCsv.ts              # Generación de reportes CSV
│   │   ├── finance.ts                # Motor matemático financiero principal
│   │   ├── intelligence.ts           # Diagnóstico proactivo de salud financiera
│   │   ├── queryEngine.ts            # Motor NLP local multi-entidad + ConversationSlots
│   │   └── storage.ts                # Persistencia multiplataforma (SecureStore / localStorage)
│   ├── theme/
│   │   └── tokens.ts
│   └── types/
│       └── finanzaiKnowledge.ts
├── backend/                          # Backend Serverless en Cloudflare
│   ├── src/
│   │   ├── auth.ts                   # PBKDF2-SHA256, tokens y sesiones
│   │   ├── finanzai.ts               # Snapshot D1 + Workers AI + tool-calling determinista
│   │   ├── index.ts                  # API Hono (/auth, /accounts, /recurring-items, /finanzai/*)
│   │   └── db/
│   │       └── schema.sql            # Esquema D1 completo (incluye future_purchases y finanzai_messages)
│   ├── wrangler.toml                 # Configuración Worker API, binding D1 y binding [ai]
│   ├── tsconfig.json
│   └── package.json
├── doc/
│   └── plan_finanzai_chatbot.md      # Plan arquitectónico de las 3 fases de FinanzAI
├── FEATURES.md                       # Registro maestro de funcionalidades y dependencias
├── wrangler.jsonc                    # Configuración Worker estático frontend (dist/)
├── package.json
└── tsconfig.json
```

---

## 🛠️ Stack Tecnológico

| Capa | Herramienta | Propósito | Costo |
| :--- | :--- | :--- | :---: |
| **Frontend Framework** | **React Native + Expo SDK 52** | Código único para Web, iOS y Android | **$0** |
| **Web Runtime** | **React Native Web** | Renderizado nativo en navegador y PWA | **$0** |
| **Enrutador** | **Expo Router v4** | Enrutamiento basado en archivos | **$0** |
| **Lenguaje** | **TypeScript 5.3 / 5.8** | Tipado estricto en cliente y Worker | **$0** |
| **Efectos Visuales** | **Expo Blur + React Native SVG** | Liquid Glass y tarjetero 3D interactivo | **$0** |
| **Iconografía** | **Lucide React Native** | Iconos vectoriales limpios | **$0** |
| **Backend API** | **Cloudflare Workers + Hono** | API REST Serverless en el edge | **$0** |
| **Base de Datos** | **Cloudflare D1** | SQLite serverless relacional | **$0** |
| **IA Conversacional** | **Cloudflare Workers AI** | Llama 3.3 70B + Tool-Calling (10.000 Neurons/día gratis) + fallback local | **$0** |
| **Almacenamiento Local** | **SecureStore / localStorage** | Sesión segura, historial y soporte offline | **$0** |

---

## 💻 Instalación y Desarrollo Local

### Prerrequisitos
- **Node.js:** Versión 18.x o superior.
- **npm** y cuenta de Cloudflare *(opcional para entorno local; requerida para desplegar Worker, D1 y Workers AI)*.

### 1. Instalar dependencias
```bash
npm install
npm --prefix backend install
```

### 2. Iniciar entorno de desarrollo
```bash
# Aplicación Web:
npm run web

# Backend Cloudflare Worker + D1 local:
npm run backend:dev

# Simulador iOS / Android:
npm run ios
npm run android

# Validación de tipos TypeScript (Frontend y Backend):
npm run typecheck
./backend/node_modules/.bin/tsc --noEmit -p backend/tsconfig.json
```

---

## 🚢 Despliegue a Producción ($0 de Inversión)

> [!IMPORTANT]
> Cuando actualices funcionalidades de D1 (como `finanzai_messages` o `future_purchases`), ejecuta primero la migración remota antes o junto al despliegue del Worker API.

```bash
# 1. Aplicar esquema actualizado en Cloudflare D1 remoto:
npm --prefix backend run db:migrate:remote

# 2. Desplegar API REST + Workers AI (backend/wrangler.toml):
npm run backend:deploy

# 3. Compilar bundle web estático (/dist) y publicar Worker Frontend (wrangler.jsonc):
npm run deploy:web
```

| Plataforma | Método de Despliegue | Comando |
| :--- | :--- | :--- |
| **🌐 Web Producción** | Exportación estática + hosting en Cloudflare Workers | `npm run deploy:web` |
| **⚙️ Backend + Workers AI** | API Hono + D1 + binding `[ai]` en Cloudflare Workers | `npm run backend:deploy` |
| **📱 iOS** | PWA instalable desde Safari (*"Agregar a pantalla de inicio"*) | `npm run export:web` |
| **🤖 Android** | APK vía EAS Build o instalación como PWA | `npx eas-cli build -p android --profile preview` |

---

## 📜 Scripts Disponibles

```bash
npm run start                                # Inicia el bundler Metro de Expo
npm run web                                  # Levanta la app en navegador web
npm run ios                                  # Lanza la app en simulador iOS
npm run android                              # Lanza la app en emulador Android
npm run export:web                           # Genera el bundle estático de producción en /dist
npm run deploy:web                           # Exporta la app web y despliega wrangler.jsonc
npm run typecheck                            # Verifica tipos TypeScript en frontend (tsc --noEmit)
npm run backend:dev                          # Levanta Cloudflare Worker API local con Wrangler
npm run backend:deploy                       # Despliega el Worker API + Workers AI a Cloudflare
npm --prefix backend run db:migrate:local    # Ejecuta schema.sql en D1 local
npm --prefix backend run db:migrate:remote   # Ejecuta schema.sql en D1 remoto de producción
```
