// Formateador de Peso Chileno (CLP - Enteros sin decimales) y Motor de Privacidad (Camouflage Mode)

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

let isPrivacyModeGlobal = false;
const privacyListeners = new Set<(enabled: boolean) => void>();

/**
 * Activa o desactiva el Modo Privado a nivel global.
 * Notifica a todos los componentes y observadores registrados.
 */
export function setGlobalPrivacyMode(enabled: boolean): void {
  isPrivacyModeGlobal = enabled;
  privacyListeners.forEach((listener) => {
    try {
      listener(enabled);
    } catch {
      // Prevenir que un error en un listener afecte a los demás
    }
  });
}

/**
 * Consulta sincrónica del estado actual del Modo Privado.
 */
export function getGlobalPrivacyMode(): boolean {
  return isPrivacyModeGlobal;
}

/**
 * Suscripción reactiva a cambios de estado del Modo Privado.
 */
export function subscribePrivacyMode(listener: (enabled: boolean) => void): () => void {
  privacyListeners.add(listener);
  return () => {
    privacyListeners.delete(listener);
  };
}

export interface FormatCLPOptions {
  /**
   * Si es true, ignora el Modo Privado y devuelve siempre el número real formateado.
   * Útil para campos de edición, inputs o reportes de exportación donde el usuario necesita ver la cifra exacta.
   */
  raw?: boolean;
}

/**
 * Formatea un número en Pesos Chilenos (CLP).
 * En Modo Privado / Camouflage Mode (cuando está activo y no se especifica raw: true),
 * enmascara la cifra con el escudo visual '$ ••••••' para proteger la privacidad en transporte público.
 */
export function formatCLP(amount: number, options?: FormatCLPOptions): string {
  if (isPrivacyModeGlobal && !options?.raw) {
    return '$ ••••••';
  }
  return clpFormatter.format(Math.round(amount));
}
