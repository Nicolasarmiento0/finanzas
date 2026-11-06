# 💳 FinanzApp — Consola Financiera Personal Multiplataforma

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2052-000000.svg?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1-F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-34D399.svg?style=for-the-badge)](LICENSE)

**FinanzApp** es una consola financiera personal integral construida con **React Native y Expo**, diseñada bajo una arquitectura **Universal App** (un único código base para **Web, Android y iOS**) y una estrategia de **Inversión $0 (Zero-Cost Stack)**. 

Combina una estética **Tesla Minimalist + iOS Liquid Glass** con un motor de cálculo en tiempo real que distingue con precisión el **Patrimonio Neto Total**, el **Margen Operativo Mensual** y el **Flujo de Caja Libre**, integrando ahorro en pareja en tiempo real y proyecciones de interés compuesto a largo plazo.

---

## 📸 Vista General y Filosofía de Diseño

- **Estética Tesla Minimalist + iOS Liquid Glass:** Fondo profundo (`#050505`), superficies de cristal translúcido con desenfoque nativo (`expo-blur`), bordes sutiles y acentos monocromáticos elegantes acompañados de verde esmeralda (`#34D399`) para flujos positivos y naranja/rojo (`#FB923C` / `#F87171`) para pasivos.
- **Tipografía y Legibilidad Fintech:** Formato en Pesos Chilenos (`CLP`), números tabulares (`tabular-nums`) perfectamente alineados verticalmente y 100% iconografía vectorial limpia con `lucide-react-native` (cero emojis informales).
- **Responsive Universal Elastic Layout:** Interfaz adaptable que pasa de una barra lateral fija (*Desktop Sidebar*) a una barra flotante de cristal (*Floating Glass Nav*) en smartphones, respetando Safe Areas dinámicas y sin solapamiento de textos.

---

## 🚀 Módulos y Funcionalidades Implementadas

### 1. 📊 Consola Financiera y Resumen Ejecutivo
- **Doble Métrica de Posición Financiera:**
  - **Patrimonio Neto Consolidado (Con Ahorros):** Total acumulado entre ingresos activos, fondos de ahorro e inversión menos pasivos vigentes.
  - **Total sin Ahorros (Margen Operativo Mensual):** Mide la capacidad real de flujo del mes sin contar con el capital que no debe tocarse.
- **Flujo de Caja Libre Estimado del Mes:** Cálculo automático en vivo: $\text{Ingresos Fijos} - \text{Gastos Fijos Comprometidos}$.
- **Selector de Período Mes a Mes:** Navega en el tiempo hacia adelante o atrás con cálculo retroactivo o proyectado, con botón de retorno inmediato a **"Hoy"**.
- **Accesos Rápidos de Cabecera:** Exportación instantánea a CSV/Excel, centro de Consejos y configuración de Perfil.

### 2. 👛 Billetera y Cuentas Cotidianas
- **Gestión de Cuentas Líquidas:** Registro de cuentas corrientes, cuentas vista, efectivo y billeteras digitales.
- **Gastos Variables Diarios:** Registro rápido en menos de 5 segundos con cálculo de saldo líquido restante.
- **Categorías Flexibles:** Supermercado, Salidas, Transporte, Salud, Compras, y categoría dedicada de **Préstamo / Deuda** para préstamos entre personas o adelantos.

### 3. 📋 Gastos e Ingresos Fijos (Checklist Operativo)
- **Checklist Mensual Interactivo:** Control visual de cada compromiso con marcado de estado persistente (**Pagado / Pendiente**).
- **Sincronización Total con Tarjetas de Crédito:** La deuda facturada del mes de tus tarjetas de crédito se integra automáticamente al total de gastos fijos del checklist, mostrando el desglose sin duplicar montos.
- **Temporalidad y Cuotas:** Gestión de pagos permanentes o con fecha de término (`end_date`), permitiendo proyectar cuándo se extinguen los créditos.
- **Gestión de Sub-Ítems:** Desglose granular de sub-gastos con montos independientes dentro de cada ítem fijo.

### 4. 💳 Tarjetas de Crédito y Cupos
- **Visualizador Realista de Tarjetas:** Renderizado interactivo con textura dark, chip emulado y logotipos de las principales entidades bancarias (Santander, Banco de Chile, BCI, Falabella, Scotiabank, etc.).
- **Monitoreo de Utilización Crediticia:** Alertas visuales basadas en la regla financiera del **30% de uso de cupo**.
- **Control de Facturación:** Fechas de corte, fechas límite de pago y alertas de cobro inminente.
- **Compras en Cuotas y Temporalidad:** Formulario inteligente para registrar cargos con selección de vigencia (1 mes, 3, 6, 12, 24 cuotas o permanente) y categorización inmediata.

### 5. 🐷 Ahorro y Pronóstico de Interés Compuesto
- **Ahorro Individual y En Pareja:** Cuentas personales y cuentas compartidas vinculables en tiempo real mediante un **ID de Usuario único**.
- **Monitoreo de Rendimiento:** Comparador de fondos al 0% de interés anual vs. instrumentos de interés compuesto al 4%+ anual.
- **Modos de Inyección de Capital:**
  - *Aporte Fijo Mensual:* Monto predeterminado el día de pago.
  - *Superávit Dinámico:* Absorbe automáticamente el 100% del flujo liberado cuando expira un crédito o cuota (**Efecto Bola de Nieve**).
- **Simulador de Interés Compuesto Proyectado:** Proyección matemática a **12, 24, 36 y 60 meses**, desglosando el capital aportado versus la ganancia neta generada por interés.

### 6. 💡 Diagnóstico Financiero Proactivo y Consejos
- **Detección Automática de Ineficiencias:**
  - *Optimización de Interés Compuesto:* Calcula cuánto dinero adicional anual generarías si mueves saldos ociosos de cuentas corrientes al ahorro rentable.
  - *Liberación Futura de Cuotas:* Lista detallada de compromisos que están por terminar y cuándo aumentará tu flujo disponible.
  - *Índice de Carga Fija:* Alerta si los gastos fijos mensuales superan el 60% de tus ingresos líquidos.
- **Biblioteca de Buenas Prácticas:** Filtros por categoría (Ahorro, Tarjetas, Presupuesto, Emergencia, Hábitos) con marcado de consejos implementados.
- **Consejos Personalizados:** Posibilidad de crear y archivar tus propias notas y reglas financieras personales.

### 7. 📤 Reportería y Respaldo de Datos (Excel / CSV)
- **Compatibilidad Total:** Exportación en formato `.CSV` con codificación UTF-8 con BOM y separador regional (`;`), listo para abrir directamente con doble clic en **Microsoft Excel, Google Sheets o Numbers**.
- **Reporte Mensual Completo:** Exporta el estado del mes (Patrimonio, cuentas, desglose por categorías y estado Pagado/Pendiente de cada ítem y sub-ítem).
- **Exportación de Pronósticos:** Descarga la proyección de ahorro a 12, 24, 36 o 60 meses mes a mes.

### 8. 👤 Perfil, Seguridad y Sincronización
- **Configuración de Cuenta:** Modificación de nombre y correo electrónico.
- **Cambio Seguro de Contraseña:** Validación de clave actual y confirmación de nueva contraseña.
- **Código de Vinculación de Pareja:** Generación y botón de copia rápida de tu ID para compartir cuentas de ahorro con otra persona.

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
│   │   │   ├── dashboard.tsx     # Consola financiera con tabs segmentados
│   │   │   ├── tips.tsx          # Pantalla dedicada de consejos y diagnósticos
│   │   │   └── profile.tsx       # Configuración de usuario y vinculación
│   │   └── index.tsx             # Redirección inicial según estado de sesión
│   ├── components/
│   │   ├── finance/              # Módulos de lógica y presentación financiera
│   │   │   ├── CreditCardsSection.tsx      # Tarjetas, cupos y compras en cuotas
│   │   │   ├── CreditCardVisual.tsx        # Renderizado visual bancario de tarjetas
│   │   │   ├── ExecutiveSummarySection.tsx # Resumen ejecutivo y exportación
│   │   │   ├── FinancialTipsSection.tsx    # Inteligencia de consejos y diagnósticos
│   │   │   ├── FixedItemsSection.tsx       # Checklist mensual e ítems fijos
│   │   │   ├── SavingsForecastSection.tsx  # Ahorro individual/pareja y proyección
│   │   │   └── WalletSection.tsx           # Billetera líquida y gastos variables
│   │   ├── layout/               # Contenedores responsivos universales
│   │   │   ├── AdaptiveNavigation.tsx      # Sidebar (Desktop) / Floating Bar (Móvil)
│   │   │   └── ScreenContainer.tsx         # Safe Areas, scroll elástico y centrado
│   │   └── ui/                   # Componentes atómicos de diseño
│   │       ├── GlassCard.tsx               # Tarjeta de cristal con blur
│   │       ├── GlassInput.tsx              # Input de formulario estilo glass
│   │       └── TeslaButton.tsx             # Botón de alta respuesta táctil
│   ├── hooks/
│   │   └── useResponsive.ts      # Detección de breakpoints (Mobile < 768px <= Desktop)
│   ├── lib/
│   │   ├── api.ts                # Cliente HTTP para el backend en Cloudflare Workers
│   │   ├── currency.ts           # Utilidades y formateador en CLP ($1.234.567)
│   │   ├── exportCsv.ts          # Motor de generación de reportes CSV / Excel
│   │   ├── finance.ts            # Motor matemático (proyecciones, intereses, fechas)
│   │   └── storage.ts            # Abstracción segura de persistencia local
│   └── theme/
│       └── tokens.ts             # Paleta de colores, radios y tipografía Tesla/Glass
├── backend/                      # Backend Serverless en Cloudflare
│   ├── src/
│   │   ├── auth.ts               # Lógica de autenticación, hash y tokens JWT
│   │   ├── index.ts              # API REST (Endpoints de cuentas, pagos, gastos)
│   │   └── db/                   # Esquemas y migraciones de Cloudflare D1
│   ├── wrangler.toml             # Configuración del Cloudflare Worker
│   └── package.json
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

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.
