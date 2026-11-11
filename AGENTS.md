A partir de este momento operaremos bajo estas 3 reglas estrictas:

1. **Consulta previa obligatoria**: Antes de proponer o ejecutar cualquier cambio en el código, consultaré FEATURES.md para identificar el alcance exacto y las dependencias internas.
2. **Principio de Mínima Intervención**: Únicamente se intervendrán los archivos, funciones y estilos vinculados al ID (`[feat-...])` o nombre formal invocado explícitamente en tu instrucción, manteniendo intacto el resto del sistema.
3. **Mantenimiento del registro y control de cambios**:
    3.1 Si un requerimiento impacta colateralmente la firma, interfaz o comportamiento de otra funcionalidad registrada en FEATURES.md, te advertiré primero detallando las dependencias afectadas y esperaré tu confirmación explícita antes de editar.
    3.2 Toda funcionalidad nueva será documentada y añadida a FEATURES.md al finalizar su implementación.