# 💳 FinanzApp — Consola Financiera Personal Multiplataforma

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2052-000000.svg?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1-F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-34D399.svg?style=for-the-badge)](LICENSE)

**FinanzApp** es una consola financiera personal integral construida con **React Native y Expo**, diseñada bajo una arquitectura **Universal App** (un único código base para **Web, Android y iOS**) y una estrategia de **Inversión $0 (Zero-Cost Stack)**. 

Combina una estética **Tesla Minimalist + iOS Liquid Glass** con un motor cuantitativo en tiempo real que distingue con precisión el **Patrimonio Neto Consolidado**, el **Margen Operativo Mensual**, el **Flujo de Caja Libre**, el **Presupuesto Diario Seguro (*Safe-to-Spend*)**, la **amortización progresiva de cupo en tarjetas de crédito**, el **simulador de viabilidad de futuras compras** y el **copiloto conversacional FinanzAI**.

---

## 📸 Vista General y Filosofía de Diseño

- **Estética Tesla Minimalist + iOS Liquid Glass:** Fondo profundo (`#050505` Pure Obsidian y `#0B101B` Obsidian-Blue), superficies de cristal translúcido con desenfoque nativo (`expo-blur`), cabeceras ambientales (`AmbientHeroCard`) con halos radiales SVG, anillos de progreso y acciones circulares con iconografía vectorial fintech duotono a medida.
- **Tipografía, Legibilidad y Modo Privacidad:** Formato en Pesos Chilenos (`CLP`), números tabulares (`tabular-nums`) alineados verticalmente, iconografía vectorial limpia con `lucide-react-native` y **Modo Privacidad / Camuflaje (`$ ••••••••`)** activable en un toque desde cualquier vista.
- **Responsive Universal Elastic Layout:** Interfaz adaptable que pasa de una barra lateral fija (*Desktop Sidebar*) a una barra flotante inferior tipo píldora (*Floating Glass Nav*) en smartphones, respetando Safe Areas dinámicas y sin solapamiento de textos.

---

## 🚀 Módulos y Funcionalidades Implementadas

### 1. 📊 Consola Financiera y Resumen Ejecutivo
- **Doble Métrica de Posición Financiera:**
  - **Patrimonio Neto Consolidado (Con Ahorros):** Total acumulado entre liquidez disponible, fondos de ahorro e inversión menos pasivos vigentes (incluyendo deuda comprometida en tarjetas y préstamos).
  - **Total sin Ahorros (Margen Operativo Mensual):** Mide la capacidad real de flujo del mes sin tocar el capital de ahorro.
- **Flujo de Caja Libre Estimado del Mes:** Cálculo automático en vivo ($\text{Ingresos Fijos} - \text{Gastos Fijos Comprometidos}$), considerando únicamente la cuota mensual efectiva de las compras en cuotas.
- **Simulador Interactivo "¿Y si ahorro más?":** Proyecta en vivo cómo impacta destinar un porcentaje adicional de tus ingresos en tu liquidez a 12 meses.
- **Selector de Período Mes a Mes:** Navegación temporal (`< Mes >`) integrada en la píldora superior del Hero con cálculo retroactivo o proyectado y retorno inmediato a **"Hoy"**.

### 2. 👛 Billetera Líquida y Presupuesto Diario (*Safe-to-Spend*)
- **Gestión de Cuentas Líquidas:** Registro y edición de cuentas corrientes, cuentas vista, efectivo y billeteras digitales.
- **Motor *Safe-to-Spend* Diario:** Calcula cuánto puedes gastar hoy de forma segura descontando de tu saldo bancario los compromisos fijos y estados de cuenta aún pendientes de pago en el mes, con semáforo de ritmo diario y gráfico de evolución.
- **Gastos Variables del Mes:** Registro ágil con búsqueda, filtros y desglose porcentual en 6 categorías universales (**Alimentación**, **Bebidas**, **Transporte**, **Entretenimiento**, **Préstamo / Deuda** y **General**).

### 3. 📋 Gastos e Ingresos Fijos (Checklist Operativo Mensual)
- **Checklist Mensual Interactivo:** Control visual de cada compromiso con marcado de estado persistente (**Pagado / Pendiente**) en Cloudflare D1 (`monthly_payments`).
- **Sincronización Exacta con Tarjetas de Crédito:** El estado de cuenta facturado del mes de cada tarjeta se integra automáticamente al checklist de Gastos Fijos sumando **únicamente el valor dividido de la cuota del mes** (`cuota / mes`) más las suscripciones activas, evitando duplicar o inflar el flujo mensual con el total de la compra.
- **Temporalidad y Extinción Automática de Deudas:** Gestión de pagos permanentes o con fecha de término (`start_date` → `end_date`), liberando flujo de caja automáticamente en los meses posteriores al vencimiento de la última cuota.
- **Gestión de Sub-Ítems:** Desglose granular de sub-cargos anidados con recálculo automático del total del ítem padre.

### 4. 💳 Tarjetas de Crédito, Tarjetero 3D y Recuperación Progresiva de Cupo
- **Tarjetero 3D Interactivo (*Wallet Pocket*) y Plásticos Realistas:** Estuche esculpido en cuero oscuro con costuras SVG donde se apilan tus tarjetas (**Santander WorldMember Limited**, **CMR Falabella** y **Obsidian Titanium**). Al tocar cualquier tarjeta se despliega al frente con sus métricas Bento.
- **Separación Exacta entre Cuota Mensual y Cupo Comprometido:**
  - Al registrar una compra en cuotas (ingresando el **Total de la Compra** o el **Valor de la Cuota** en `1, 3, 6, 12, 18, 24` o $N$ cuotas), el monto se divide automáticamente entre las cuotas del período (`cuota / mes`).
  - El **Total de la Compra** y el saldo restante por amortizar quedan evidenciados exclusivamente en el cupo de la tarjeta (`Comprometido en cupo`), mientras que en Gastos Fijos y en la facturación mensual solo se cobra la cuota correspondiente al mes.
- **Recuperación Progresiva de Cupo al Marcar como Pagado:**
  - Al marcar como **Pagado** el monto facturado del mes (desde Tarjetas o desde el Checklist de Gastos Fijos), el cupo disponible se recupera de forma progresiva sumando exactamente las cuotas pagadas hasta ese período (`recoveredCredit`), manteniendo comprometidas en el cupo únicamente las cuotas de los meses futuros pendientes.
  - Fórmula aditiva transparente en todo momento: $\text{Cupo Utilizado} = \text{Cuotas Pendientes} + \text{Recurrentes Pendientes} + \text{Saldo Base Pendiente}$.
- **Categorías Unificadas:** Selector de categorías en cargos de tarjeta 100% homologado con los Gastos Variables del Mes (`SHARED_EXPENSE_CATEGORIES`), manteniendo compatibilidad visual con categorías históricas.

### 5. 🐷 Ahorro Dual y Pronóstico de Interés Compuesto
- **Ahorro Individual y En Pareja:** Cuentas personales y cuentas compartidas vinculables en tiempo real mediante un **ID de Usuario único**, con desglose de aportes iniciales y mensuales de cada integrante.
- **Monitoreo de Rendimiento:** Comparador de fondos al 0% de interés anual vs. instrumentos de interés compuesto rentable (ej. 4%+ anual).
- **Modos de Inyección de Capital:**
  - *Aporte Fijo Mensual:* Monto programado cada mes.
  - *Superávit Dinámico (%):* Absorbe automáticamente el flujo liberado cuando expira un crédito o compra en cuotas (**Efecto Bola de Nieve**).
- **Simulador de Interés Compuesto Proyectado:** Proyección matemática a **12, 24, 36 y 60 meses**, desglosando capital aportado versus ganancia neta por interés compuesto y mes estimado de cumplimiento de meta.

### 6. 🛍️ Futuras Compras Posibles y Simulador de Carrito
- **Motor Cuantitativo de Viabilidad:** Evalúa cada deseo o proyecto de compra en tiempo real (`Viable Hoy`, `Viable Planificado`, `Postergar`) cruzando tu *Safe-to-Spend*, el cupo disponible real de tus tarjetas de crédito y los hitos futuros en que terminan tus deudas actuales (*Smart Debt-Release Matching*).
- **Comparador de 3 Caminos y Métricas Anti-Impulso:** Compara comprar al **Contado**, en **$N$ Cuotas** o mediante **Ahorro Previo**, calculando horas de trabajo equivalentes y el costo de oportunidad a 12 meses en tu cuenta de ahorro más rentable.
- **Modo Carrito Multi-Ítem y Conversión en 1 Toque ("Lo Compré"):** Simula el impacto combinado de varios deseos simultáneos y permite convertir cualquier ítem comprado directamente en un gasto variable o en una compra en cuotas en tarjeta con un solo toque.

### 7. 🤖 FinanzAI — Copiloto Financiero Conversacional e Inteligencia Proactiva
- **Asistente Conversacional Híbrido (`FinanzAI`):** Modal interactivo accesible desde toda la app que combina un motor determinista local con el endpoint `/ai/chat` en Cloudflare Workers, memoria conversacional persistente en D1 y **Action Cards** ejecutables en un toque (registrar gastos, crear deseos, marcar pagos o navegar a módulos).
- **Diagnóstico Financiero Proactivo y Biblioteca de Consejos:**
  - Detección automática de saldos ociosos (oportunidad de interés compuesto), alertas de utilización de cupo sobre el 30%, calendario de liberación de cuotas e índice de carga fija.
  - Biblioteca filtrable de buenas prácticas financieras y creación de reglas/notas personalizadas.

### 8. 📤 Reportería Excel / CSV y Perfil de Usuario
- **Exportación CSV / Excel con BOM UTF-8 (`;`):** Descarga inmediata del **Reporte Ejecutivo Mensual** (patrimonio, cuentas, gastos por categoría y estado Pagado/Pendiente) y de la **Proyección de Ahorro Compuesto** para abrir directamente en Microsoft Excel, Google Sheets o Numbers.
- **Perfil, Seguridad y Vinculación:** Edición de datos personales, cambio seguro de contraseña y copia rápida del código único para vincular cuentas de ahorro en pareja.

---

## 🏗️ Arquitectura Técnica del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Código Base Universal (Expo SDK 52)               │
│               TypeScript + Expo Router v4 (File-based Routing)         │
├────────────────────┬─────────────────────┬─────────────────────────────┤
│    📱 Android      │       🍎 iOS        │       🌐 Web (PWA/SPA)      │
│   (React Native)   │   (React Native)    │     (React Native Web)      │
└──────────┬─────────┴──────────┬──────────┴──────────────┬──────────────┘
           │                    │                         │
           ▼                    ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Capa UI / Layout Universal y Adaptativo                  │
│       ScreenContainer (Safe Areas + Elastic Scroll + 100% Width)       │
│       AdaptiveNavigation (Sidebar en Desktop / Floating Nav en Móvil)  │
│       GlassCard + BlurView (Estética Tesla Minimalist + Liquid Glass)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Sincronización HTTPS REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Backend Serverless — Costo $0                        │
│          Cloudflare Workers API + Cloudflare D1 (Serverless SQLite)    │
│            Autenticación con JWT + Almacenamiento Seguro Local         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```text
finanzapp/
├── src/
│   ├── app/                      # Rutas de Expo Router (File-based routing)
│   │   ├── (auth)/               # Login y Registro
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (main)/               # Vistas principales de la aplicación
│   │   │   ├── _layout.tsx       # Layout que inyecta la navegación adaptativa
│   │   │   ├── dashboard.tsx     # Consola financiera con 6 módulos segmentados
│   │   │   ├── tips.tsx          # Pantalla dedicada de consejos y diagnósticos
│   │   │   └── profile.tsx       # Configuración de usuario y vinculación
│   │   ├── _layout.tsx           # Providers globales (Privacy, FinanzAI)
│   │   └── index.tsx             # Redirección inicial según estado de sesión
│   ├── components/
│   │   ├── finance/              # Módulos de lógica y presentación financiera
│   │   │   ├── CreditCardsSection.tsx      # Tarjetero 3D, cupos, cuotas y recuperación
│   │   │   ├── CreditCardVisual.tsx        # Plásticos bancarios realistas (Santander, CMR, Titanium)
│   │   │   ├── ExecutiveSummarySection.tsx # Resumen ejecutivo, simulador y exportación
│   │   │   ├── FinancialTipsSection.tsx    # Inteligencia de consejos y reglas personales
│   │   │   ├── FinanzAIAssistantModal.tsx  # Copiloto conversacional con Action Cards
│   │   │   ├── FixedItemsSection.tsx       # Checklist mensual e ítems recurrentes
│   │   │   ├── FuturePurchasesSection.tsx  # Viabilidad de compras futuras y modo carrito
│   │   │   ├── SavingsForecastSection.tsx  # Ahorro individual/pareja y proyección compuesta
│   │   │   └── WalletSection.tsx           # Billetera líquida, Safe-to-Spend y gastos variables
│   │   ├── layout/               # Contenedores responsivos universales
│   │   │   ├── AdaptiveNavigation.tsx      # Sidebar (Desktop) / Floating Bar (Móvil)
│   │   │   └── ScreenContainer.tsx         # Safe Areas, scroll elástico y centrado
│   │   └── ui/                   # Componentes atómicos del sistema Liquid Glass
│   │       ├── AccordionToggle.tsx         # Control acordeón animado
│   │       ├── AmbientHeroCard.tsx         # Cabecera ambiental Liquid Glass con acciones circulares
│   │       ├── FinanzAITriggerButton.tsx   # Disparador del asistente FinanzAI
│   │       ├── GlassCard.tsx               # Superficie de cristal con blur nativo
│   │       ├── GlassInput.tsx              # Input de formulario estilo glass
│   │       ├── PrivacyToggleButton.tsx     # Conmutador de modo privacidad ($ ••••••••)
│   │       └── TeslaButton.tsx             # Botón de alta respuesta táctil
│   ├── context/
│   │   ├── FinanzAIContext.tsx   # Estado global y sincronización en vivo con FinanzAI
│   │   └── PrivacyContext.tsx    # Estado global y persistencia del modo camuflaje
│   ├── data/
│   │   └── finanzaiKnowledge.json # Base de conocimiento financiero estructurada
│   ├── hooks/
│   │   └── useResponsive.ts      # Detección de breakpoints (Mobile < 768px <= Desktop)
│   ├── lib/
│   │   ├── api.ts                # Cliente HTTP hacia Cloudflare Workers y caché local
│   │   ├── currency.ts           # Utilidades y formateador en CLP ($1.234.567)
│   │   ├── exportCsv.ts          # Motor de generación de reportes CSV / Excel
│   │   ├── finance.ts            # Motor cuantitativo (cupos, cuotas, proyecciones, viabilidad)
│   │   ├── intelligence.ts       # Motor de diagnóstico financiero proactivo
│   │   ├── queryEngine.ts        # Motor conversacional local de FinanzAI
│   │   └── storage.ts            # Abstracción segura de persistencia local
│   └── theme/
│       └── tokens.ts             # Paleta de colores, radios y tipografía Liquid Glass
├── backend/                      # Backend Serverless en Cloudflare Workers
│   ├── src/
│   │   ├── auth.ts               # Lógica de autenticación, hash PBKDF2 y tokens JWT
│   │   ├── finanzai.ts           # Motor conversacional backend, digest financiero y sesiones D1
│   │   ├── index.ts              # API REST (Cuentas, recurrentes, pagos, variables, compras futuras, IA)
│   │   └── db/                   # Esquemas y migraciones SQL de Cloudflare D1
│   ├── wrangler.toml             # Configuración del Cloudflare Worker y binding D1
│   └── package.json
├── FEATURES.md                   # Registro formal de arquitectura, alcance y dependencias
├── package.json
└── tsconfig.json
```

---

## 🛠️ Stack Tecnológico

| Capa | Herramienta | Propósito | Costo |
| :--- | :--- | :--- | :---: |
| **Frontend Framework** | **React Native + Expo SDK 52** | Código único para Web, iOS y Android | **$0** |
| **Web Runtime** | **React Native Web** | Renderizado nativo en el DOM del navegador | **$0** |
| **Enrutador** | **Expo Router v4** | Enrutamiento basado en archivos y deep linking | **$0** |
| **Lenguaje** | **TypeScript 5.3** | Tipado estricto para operaciones financieras | **$0** |
| **Efectos Visuales** | **Expo Blur (`expo-blur`)** | Desenfoque nativo tipo iOS Liquid Glass | **$0** |
| **Iconografía** | **Lucide React Native** | Más de 400 íconos vectoriales SVG limpios | **$0** |
| **Backend API** | **Cloudflare Workers** | API REST Serverless con CDN global ultrarrápido | **$0** |
| **Base de Datos** | **Cloudflare D1** | Base de datos SQL relacional serverless | **$0** |
| **Almacenamiento Local** | **SecureStore / LocalStorage** | Sesión persistente y tolerancia offline | **$0** |

---

## 💻 Instalación y Desarrollo Local

### Prerrequisitos
- **Node.js:** Versión 18.x o superior recomendada.
- **npm** o **yarn**.
- *(Opcional)* **Expo Go** en tu dispositivo físico iOS/Android, o simuladores Xcode / Android Studio.

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/finanzapp.git
cd finanzapp
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el entorno de desarrollo

```bash
# Iniciar en navegador Web (Safari, Chrome, Edge):
npm run web

# Iniciar con soporte interactivo para iOS:
npm run ios

# Iniciar con soporte interactivo para Android:
npm run android

# Verificación de tipos TypeScript:
npm run typecheck
```

---

## 🚢 Despliegue y Distribución ($0 de Inversión)

| Plataforma | Método de Despliegue | Comando |
| :--- | :--- | :--- |
| **🌐 Web Producción** | Exportación estática y hosting en **Cloudflare Workers / Pages** | `npm run deploy:web` |
| **📱 iOS** | **PWA Instalable** desde Safari (*"Agregar a pantalla de inicio"*) con soporte pantalla completa | `npm run export:web` |
| **🤖 Android** | Generación de APK gratuito vía EAS Build o instalación como PWA | `npx eas-cli build -p android --profile preview` |
| **⚙️ Backend** | Despliegue de la API REST a Cloudflare Workers | `npm run backend:deploy` |

---

## 📜 Scripts Disponibles

```bash
npm run start          # Inicia el bundler Metro de Expo
npm run web            # Levanta la aplicación en el puerto web local
npm run ios            # Lanza la app en simulador de iOS
npm run android        # Lanza la app en emulador de Android
npm run export:web     # Genera el bundle estático para producción en la carpeta /dist
npm run deploy:web     # Exporta la app web y la despliega a Cloudflare Workers con Wrangler
npm run typecheck      # Ejecuta el compilador de TypeScript para validar tipos sin emitir código
npm run backend:dev    # Ejecuta el servidor local de desarrollo de Cloudflare Workers (Miniflare)
npm run backend:deploy # Despliega los cambios de la API a Cloudflare Workers en producción
```

