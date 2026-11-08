import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStoredItem, saveStoredItem } from '@/lib/storage';
import {
  FormatCLPOptions,
  formatCLP as libFormatCLP,
  getGlobalPrivacyMode,
  setGlobalPrivacyMode,
  subscribePrivacyMode,
} from '@/lib/currency';

export const PRIVACY_STORAGE_KEY = '@finanzapp_privacy_mode_v1';

export interface PrivacyContextType {
  /**
   * Indica si el Modo Privado / Camouflage Mode está activo.
   */
  isPrivacyEnabled: boolean;
  /**
   * Alterna el estado del Modo Privado y persiste la preferencia.
   */
  togglePrivacy: () => void;
  /**
   * Establece explícitamente el estado del Modo Privado.
   */
  setPrivacy: (enabled: boolean) => void;
  /**
   * Helper de formateo consciente del contexto.
   */
  formatCLP: (amount: number, options?: FormatCLPOptions) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivacyEnabled: false,
  togglePrivacy: () => {},
  setPrivacy: () => {},
  formatCLP: libFormatCLP,
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivacyEnabled, setIsPrivacyEnabled] = useState<boolean>(getGlobalPrivacyMode());

  // Cargar preferencia persistida al arrancar la app
  useEffect(() => {
    let mounted = true;

    getStoredItem(PRIVACY_STORAGE_KEY)
      .then((stored) => {
        if (!mounted || stored === null) return;
        const enabled = stored === 'true';
        setGlobalPrivacyMode(enabled);
        setIsPrivacyEnabled(enabled);
      })
      .catch(() => {});

    // Suscribirse a cambios sincrónicos/reactivos
    const unsubscribe = subscribePrivacyMode((enabled) => {
      if (mounted) {
        setIsPrivacyEnabled(enabled);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setPrivacy = useCallback((enabled: boolean) => {
    setGlobalPrivacyMode(enabled);
    setIsPrivacyEnabled(enabled);
    saveStoredItem(PRIVACY_STORAGE_KEY, String(enabled)).catch(() => {});
  }, []);

  const togglePrivacy = useCallback(() => {
    const nextState = !getGlobalPrivacyMode();
    setPrivacy(nextState);
  }, [setPrivacy]);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyEnabled,
        togglePrivacy,
        setPrivacy,
        formatCLP: libFormatCLP,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextType {
  const context = useContext(PrivacyContext);
  if (!context) {
    return {
      isPrivacyEnabled: getGlobalPrivacyMode(),
      togglePrivacy: () => setGlobalPrivacyMode(!getGlobalPrivacyMode()),
      setPrivacy: (enabled: boolean) => setGlobalPrivacyMode(enabled),
      formatCLP: libFormatCLP,
    };
  }
  return context;
}
