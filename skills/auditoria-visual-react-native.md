---
name: auditoria-visual-react-native
description: Audita y mejora exclusivamente la interfaz visual (UI/UX), proporciones de tarjetas (cards), bordes, espaciados y responsividad en aplicaciones React Native y Expo sin alterar ninguna funcionalidad ni logica de negocio. Usar cuando el usuario pida auditar visualmente una app, mejorar el diseno o tamano de cards, evitar que bordes o botones flotantes se tapen, o refactorizar estilos en toda la aplicacion.
---

# Auditoria Visual React Native y Expo

Realiza una auditoria completa y refactorizacion estrictamente visual (UI/UX) en toda la aplicacion React Native / Expo, manteniendo intacta toda la logica de negocio, estados, hooks, llamadas a API y funcionalidades.

## Cuando Usar

- El usuario pide auditar visualmente toda la app o un modulo complejo.
- Las tarjetas (cards) se ven desproporcionadas, aplastadas, demasiado largas o con bordes cortados.
- Elementos flotantes (como botones FAB o chats) tapan el contenido o los bordes inferiores de las tarjetas.
- Se requiere estandarizar espaciados, bordes y responsividad (Web y Movil) sin tocar la funcionalidad.

## Reglas Estrictas

1. **Cero cambios funcionales:** No modifiques funciones de calculo, props de datos, rutas de navegacion, nombres de variables de estado ni eventos `onPress`.
2. **Alcance global:** Recorre carpeta por carpeta (`app/`, `screens/`, `components/`, `modals/`) y aplica los ajustes de forma consistente en toda la aplicacion.

## Flujo de Auditoria y Correccion

### 1. Inventario de Archivos
Lista primero todos los archivos de vistas, modales y componentes visuales del proyecto antes de editarlos.

### 2. Prevencion de Solapamientos (Safe Areas y Flotantes)
- Verifica que ningun boton flotante (FAB) tape bordes, textos o botones de las tarjetas inferiores.
- Agrega `paddingBottom` suficiente en todos los contenedores `ScrollView` y `FlatList` (minimo `80px` a `100px` extra) y usa `SafeAreaView` o `useSafeAreaInsets` para que el ultimo elemento siempre respire al hacer scroll hasta el final.

### 3. Arquitectura y Proporcion de Cards
- Estandariza los `borderRadius` (`16px` para cards principales, `12px` para sub-cards internas, `999px` para badges o pildoras).
- Asegura `padding` interno uniforme (`16px` horizontal, `14px` a `16px` vertical) y `gap` consistente (`12px`) entre tarjetas apiladas.
- En vistas con multiples escenarios o comparativas apiladas, diferencia visualmente la opcion recomendada o viable con un borde de acento sutil (`1.5px`) y compacta el padding vertical de las opciones secundarias para mejorar la jerarquia y reducir el scroll innecesario.

### 4. Tipografia y Alineacion
- Usa `fontVariant: ['tabular-nums']` en cifras monetarias y porcentajes para garantizar alineacion limpia.
- Evita que los textos choquen contra los bordes de las cards o contra badges usando `flexShrink: 1` y `gap` explicito en filas (`flexDirection: 'row'`).

### 5. Responsividad (Expo Web y Movil)
- Envuelve las pantallas principales en contenedores con `maxWidth` controlado (entre `680px` y `760px` centrado en pantallas anchas) para evitar que las tarjetas se estiren de forma desproporcionada en navegadores de escritorio.

## Gotchas

- No alteres la estructura de datos que reciben los componentes ni elimines elementos interactivos existentes.
- Verifica que los bordes (`borderWidth` y `borderColor`) no queden recortados por contenedores padres con `overflow: 'hidden'` sin margen interno.
