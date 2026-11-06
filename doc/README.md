npm run deploy:web 
# 💰 FinanzApp — Gestión de Finanzas Personales Multiplataforma

Aplicación de finanzas personales construida con **React Native y Expo**, diseñada desde cero bajo una filosofía **Universal App** (un único código base para **Web, Android y iOS**) y una estrategia de **Inversión Inicial \$0 (Zero-Cost Stack)**.

---

## 🎯 1. Visión y Propuesta de Valor

El objetivo de **FinanzApp** es ofrecer un control financiero personal rápido, privado, intuitivo y accesible desde cualquier dispositivo:
- **En el móvil (Android / iOS):** Registro ultrarrápido de gastos e ingresos del día a día en menos de 5 segundos, incluso sin conexión a internet (*Offline-First*).
- **En la Web (Desktop / Tablet):** Vista panorámica con paneles analíticos, gráficos comparativos, gestión detallada de presupuestos mensuales y exportación/importación de datos.

---

## 🏗️ 2. Arquitectura del Sistema

Para garantizar **costo cero**, velocidad instantánea y sincronización entre Web y Móvil, se propone una arquitectura **Local-First con Sincronización en la Nube (BaaS Free Tier)** o **Cloud Direct con Caché Persistente**:

```
┌─────────────────────────────────────────────────────────────────┐
│                   Código Base Único (Expo SDK)                  │
│          TypeScript + Expo Router (File-based Routing)          │
├───────────────────┬─────────────────────┬───────────────────────┤
│    📱 Android     │       🍎 iOS        │   🌐 Web (PWA/SPA)    │
│   (React Native)  │   (React Native)    │  (React Native Web)   │
└─────────┬─────────┴──────────┬──────────┴───────────┬───────────┘
          │                    │                      │
          ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│             Capa de Estado y Caché Local (Offline)              │
│      Zustand (Estado UI) + TanStack Query / SQLite Local        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Sincronización Segura (HTTPS/WSS)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               Backend Serverless — Costo $0                     │
│        Supabase (PostgreSQL + Auth + Row Level Security)        │
└─────────────────────────────────────────────────────────────────┘
```

### Estructura de Carpetas Propuesta (Feature-Based)

```text
finanzapp/
├── src/
│   ├── app/                  # Rutas de Expo Router (Web + Mobile navigation)
│   │   ├── (auth)/           # Login, Registro, Recuperación
│   │   ├── (tabs)/           # Dashboard, Transacciones, Presupuestos, Ajustes
│   │   └── _layout.tsx       # Layout raíz adaptativo (Sidebar en Web / Tabs en Móvil)
│   ├── components/
│   │   ├── ui/               # Componentes atómicos (Button, Card, Input, Modal)
│   │   └── layout/           # Contenedores responsivos (ResponsiveContainer, Sidebar)
│   ├── features/             # Módulos de negocio aislados
│   │   ├── accounts/         # Cuentas bancarias, efectivo, tarjetas, billeteras
│   │   ├── transactions/     # Ingresos, gastos y transferencias entre cuentas
│   │   ├── categories/       # Categorías e íconos personalizados
│   │   ├── budgets/          # Límites de gasto mensual por categoría
│   │   └── analytics/        # Reportes, balance mensual y flujo de caja
│   ├── lib/                  # Configuración de Supabase, clientes y utilidades
│   ├── hooks/                # Hooks personalizados (ej. useResponsive, useCurrency)
│   ├── store/                # Estado global ligero (Zustand: tema, moneda, sesión)
│   └── theme/                # Tokens de diseño (colores, tipografía, espaciados)
├── assets/                   # Íconos, fuentes y recursos estáticos
├── app.json                  # Configuración de Expo (PWA, Android package, iOS bundle)
└── package.json
```

---

## 🛠️ 3. Stack Tecnológico (100% Costo Cero)

Cada pieza ha sido seleccionada por su madurez multiplataforma y su capa gratuita perpetua (*Free Tier*):

| Capa | Tecnología | Por qué se eligió | Costo |
| :--- | :--- | :--- | :--- |
| **Framework Core** | **Expo (React Native + RN Web)** | Permite compilar a Android, iOS y Web (estático/PWA) con un solo proyecto. | **\$0** (Open Source) |
| **Lenguaje** | **TypeScript** | Tipado estricto para evitar errores de cálculo financiero y redondeo. | **\$0** |
| **Enrutamiento** | **Expo Router** | Basado en archivos; soporta URLs reales en Web, enlaces profundos (*Deep Links*) y layouts anidados. | **\$0** |
| **Estilos Multiplataforma** | **NativeWind v4 (Tailwind CSS)** | Permite usar clases utilitarias e incluye soporte para *media queries* y diseño responsivo Web/Móvil. | **\$0** |
| **Iconografía** | **Lucide React Native** | Íconos vectoriales ligeros compatibles con Android, iOS y Web via `react-native-svg`. | **\$0** |
| **Validación y Forms** | **React Hook Form + Zod** | Validación robusta de montos, fechas y campos obligatorios sin penalizar el rendimiento. | **\$0** |

---

## 🎨 4. Temática, Identidad Visual y UI/UX

### Concepto de Diseño: *"Claridad Financiera (Clean Fintech Minimalist)"*
Las aplicaciones financieras suelen fallar cuando saturan al usuario. La temática visual se centrará en **calma, precisión y legibilidad numérica**, con soporte nativo para **Modo Oscuro (Dark Mode)** y **Modo Claro (Light Mode)**.

### Paleta de Colores 

Estilo ios, liquid glass combinado con tesla. Sin colores fuertes, que predominen blanco y negro y grises.



### Reglas Tipográficas y Numéricas
1. **Números Tabulares (`tabular-nums`):** Todos los montos utilizarán alineación tabular para que las cifras en listas y tablas queden perfectamente alineadas verticalmente.
2. **Manejo de Dinero en Centavos (Enteros):** Para evitar errores de punto flotante (`0.1 + 0.2 = 0.30000000000000004`), todos los valores se procesan o almacenan como enteros en la unidad mínima (o `NUMERIC(12,2)` en PostgreSQL) y se formatean con la API estándar `Intl.NumberFormat`.

---

## 📱💻 5. Compatibilidad Total entre Dispositivos (Web, Android, iOS)

Para que la aplicación no se sienta como "un teléfono estirado" en la página web ni se rompa en pantallas pequeñas, aplicaremos las siguientes reglas de adaptabilidad:

### 1. Navegación Adaptativa Automática
- **Móvil (`< 768px` - iOS y Android):** Barra de navegación inferior (*Bottom Tab Bar*) con un botón central flotante (`+`) para registrar un gasto/ingreso con el pulgar.
- **Tablet y Web (`>= 768px`):** Menú lateral izquierdo fijo (*Sidebar Navigation*), diseño en cuadrícula (*Bento Grid*) de 2 a 3 columnas para ver simultáneamente el balance, los gráficos y las últimas transacciones.

### 2. Interacción y Componentes Nativos vs. Web
- **Selectores de Fecha y Moneda:** Uso de modales limpios compatibles con clic/teclado en Web y gestos táctiles en iOS/Android.
- **Áreas Seguras (*Safe Areas*):** Uso de `react-native-safe-area-context` para respetar el *Notch* / *Dynamic Island* de iPhone y las barras de gestos de Android.
- **Accesibilidad en Web:** Soporte para navegación con tecla `Tab`, `Enter` para guardar formularios y `Esc` para cerrar modales.
- **PWA (Progressive Web App):** La versión Web podrá instalarse como aplicación de escritorio o en iOS/Android directamente desde el navegador sin pasar por tiendas.

---

## 💸 7. Estrategia de Despliegue y Distribución con Inversión \$0

Uno de los puntos más importantes es **cómo usar y publicar la app en Web, Android y iOS sin pagar licencias ni servidores**:

| Plataforma | Estrategia de Costo \$0 | Detalles y Alternativas |
| :--- | :--- | :--- |
| **🌐 Web (Desktop & Móvil)** | **Vercel / Cloudflare Pages** | Despliegue automático desde GitHub con `npx expo export -p web`. Dominio `.vercel.app` o `.pages.dev` gratuito con HTTPS y CDN global. |
| **🤖 Android** | **APK Directo + EAS Build Free / Local Build** | Puedes compilar el archivo `.apk` gratis (en tu Mac o con los 30 builds gratuitos al mes de Expo EAS) e instalarlo directamente en cualquier Android sin pagar los \$25 de Google Play Store. |
| **🍎 iOS (iPhone / iPad)** | **3 Opciones sin pagar \$99/año a Apple:** | 1. **PWA Instalable (Recomendado 24/7):** Desde Safari -> *"Agregar a pantalla de inicio"*. Funciona a pantalla completa como app nativa sin caducar nunca.<br>2. **Expo Go / Desarrollo Local con Xcode:** Instalación directa por cable/Wi-Fi desde tu Mac a tu iPhone con cuenta Apple ID gratuita.<br>3. *(Si en el futuro deseas App Store pública, Apple exige su membresía de \$99 USD/año).* |
| **🗄️ Base de Datos / Backend** | **Supabase Free Tier** | Incluye Base de Datos Postgres, Autenticación y API REST en tiempo real sin tarjeta de crédito. |

---

## 🗺️ 8. Hoja de Ruta (Roadmap de Desarrollo)

- **Fase 1 — Cimientos y Diseño Base:**
  - Inicialización del proyecto con Expo SDK + TypeScript + NativeWind.
  - Configuración del tema (Modo Claro/Oscuro) y Layout Responsivo (Sidebar en Web / Bottom Tabs en Móvil).
- **Fase 2 — Motor Financiero Local (MVP Funcional):**
  - Gestión de Cuentas y Categorías.
  - Registro de Ingresos, Gastos y Transferencias con cálculo automático de saldos.
  - Dashboard principal con resumen mensual y filtro por fechas.
- **Fase 3 — Presupuestos y Analítica Visual:**
  - Creación de presupuestos mensuales con alertas visuales de progreso.
  - Gráficos de gastos por categoría y evolución mensual (Ingresos vs. Gastos).
- **Fase 4 — Nube, Sincronización y Despliegue:**
  - Conexión con Supabase (Auth + Base de Datos sincronizada entre Web y Móvil).
  - Exportación a CSV/Excel y publicación gratuita en Vercel/Cloudflare.

---

## ✅ 9. Decisiones Clave antes de Empezar a Programar

Antes de generar la estructura del proyecto e instalar las dependencias, definamos estos 4 puntos rápidos:

1. **Moneda Principal:** ¿Usarás una sola moneda por defecto (ej. `CLP`, `USD`, `MXN`, `ARS`, `EUR`) o necesitas manejar **múltiples monedas** al mismo tiempo?
2. **Almacenamiento inicial:** ¿Prefieres empezar **100% local en el dispositivo/navegador** para avanzar rápido y luego conectar **Supabase**, o configuramos **Supabase (Login + Nube)** desde el día 1?
3. **Idioma de la interfaz:** ¿100% en Español?
4. **Nombre de la App:** ¿Mantenemos **FinanzApp** o tienes un nombre personalizado en mente?
