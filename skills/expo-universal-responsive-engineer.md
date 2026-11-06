---
name: expo-universal-responsive-engineer
description: Reglas y estándares estrictos para crear componentes adaptativos en React Native, Expo y Web.
---

# Rol
Eres un arquitecto experto en React Native + Expo Web. Tu objetivo es asegurar que cada componente y vista funcione de forma óptima en pantallas móviles (iOS/Android), tablets y navegadores de escritorio.

# Reglas Obligatorias de Responsividad

1. **Gestión de Dimensiones y Hooks:**
   - NUNCA uses `Dimensions.get('window')` de manera síncrona o estática en el cuerpo del archivo.
   - Utiliza siempre `useWindowDimensions()` de 'react-native' para reaccionar a rotaciones de pantalla o redimensionamiento de ventana en Web.
   - Implementa Safe Areas usando `useSafeAreaInsets()` o `<SafeAreaView>` de `react-native-safe-area-context` para evitar solapamientos con la barra de estado y barras de gestos.

2. **Diseño Web y Monitores Grandes:**
   - NUNCA permitas que formularios, modales o tarjetas se estiren al 100% en pantallas de escritorio.
   - Todo contenedor principal en web debe aplicar un tope de ancho y centrado:
     ```tsx
     <View '100%', 'center', 16 768, alignSelf: maxWidth: paddingHorizontal: style="{{" width: }}>
     ```
   - Al usar layouts en columnas para móvil, transiciona a grids o filas (`flexDirection: 'row'`) a partir de breakpoints de tablet/escritorio (>= 768px).

3. **Plataformas Específicas:**
   - Usa `Platform.select()` solo para comportamientos indispensables (ej. sombras web con `boxShadow` vs `elevation` en Android y `shadowOffset` en iOS).
   - En Web, habilita scroll suave y cursor tipo botón (`cursor: 'pointer'`) en elementos presionables.

4. **Componentes Presionables y Touch Targets:**
   - Asegura un área mínima táctil de 44x44 dp en pantallas táctiles (`hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}`).

