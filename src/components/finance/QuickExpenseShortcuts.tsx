import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bus,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Minus,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { usePrivacy } from '@/context/PrivacyContext';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { Account, CreateVariableExpenseInput } from '@/lib/api';
import { formatCLP } from '@/lib/currency';
import { getStoredItem, saveStoredItem } from '@/lib/storage';
import { colors, radius } from '@/theme/tokens';

export interface QuickShortcutItem {
  id: string;
  label: string;
  defaultAmount: number;
  category: string;
  iconName: 'Croissant' | 'CupSoda' | 'Cookie' | 'Coffee' | 'Bus' | 'UtensilsCrossed' | 'ShoppingCart' | 'Pill' | 'Car';
  color: string;
  isCustom?: boolean;
}

export const DEFAULT_QUICK_SHORTCUTS: QuickShortcutItem[] = [
  { id: 'pan', label: 'Pan Diario', defaultAmount: 2000, category: 'alimentacion', iconName: 'Croissant', color: '#10B981' },
  { id: 'bebida', label: 'Bebida / Jugo', defaultAmount: 1500, category: 'bebidas', iconName: 'CupSoda', color: '#F59E0B' },
  { id: 'snack', label: 'Snack / Kiosko', defaultAmount: 1200, category: 'alimentacion', iconName: 'Cookie', color: '#EC4899' },
  { id: 'cafe', label: 'Café / Desayuno', defaultAmount: 2500, category: 'bebidas', iconName: 'Coffee', color: '#EAB308' },
  { id: 'metro', label: 'Metro / Bip!', defaultAmount: 840, category: 'transporte', iconName: 'Bus', color: '#38BDF8' },
  { id: 'almuerzo', label: 'Almuerzo Menú', defaultAmount: 6500, category: 'alimentacion', iconName: 'UtensilsCrossed', color: '#10B981' },
  { id: 'super', label: 'Supermercado Exprés', defaultAmount: 15000, category: 'alimentacion', iconName: 'ShoppingCart', color: '#34D399' },
  { id: 'farmacia', label: 'Farmacia / Salud', defaultAmount: 8000, category: 'general', iconName: 'Pill', color: '#F43F5E' },
  { id: 'auto', label: 'Estacionamiento / Peaje', defaultAmount: 2500, category: 'transporte', iconName: 'Car', color: '#64748B' },
];

const STORAGE_KEY = '@finanzapp_quick_shortcuts_v1';

interface QuickExpenseShortcutsProps {
  accounts: Account[];
  checkingAccounts: Account[];
  period: string;
  onQuickLog: (input: CreateVariableExpenseInput) => Promise<void>;
  isMobile: boolean;
}

export function QuickExpenseShortcuts({
  accounts,
  checkingAccounts,
  period,
  onQuickLog,
  isMobile,
}: QuickExpenseShortcutsProps) {
  const { isPrivacyEnabled } = usePrivacy();
  // Lista de atajos configurados
  const [shortcuts, setShortcuts] = useState<QuickShortcutItem[]>(DEFAULT_QUICK_SHORTCUTS);
  const [loadedStorage, setLoadedStorage] = useState(false);

  // Modal de registro rápido (al vuelo con edición)
  const [activeItem, setActiveItem] = useState<QuickShortcutItem | null>(null);
  const [amountInput, setAmountInput] = useState<string>('0');
  const [dateInput, setDateInput] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [rememberAsDefault, setRememberAsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Modal de configuración / edición de valores predeterminados
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Cargar atajos personalizados desde almacenamiento local
  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as QuickShortcutItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setShortcuts(parsed);
          }
        }
      } catch {
        // Fallback a los valores predeterminados
      } finally {
        setLoadedStorage(true);
      }
    })();
  }, []);

  // Guardar en almacenamiento
  const persistShortcuts = async (updated: QuickShortcutItem[]) => {
    setShortcuts(updated);
    try {
      await saveStoredItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignorar error de guardado local
    }
  };

  // Abrir modal de registro rápido
  const handleOpenQuickLog = (item: QuickShortcutItem) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setActiveItem(item);
    setAmountInput(String(item.defaultAmount));
    setDateInput(todayStr);
    setSelectedAccountId(checkingAccounts[0]?.id || '');
    setRememberAsDefault(false);
  };

  const handleCloseQuickLog = () => {
    setActiveItem(null);
    setIsSubmitting(false);
  };

  // Ajustes de monto en saltos de $100, $500, etc.
  const handleAdjustAmount = (delta: number) => {
    const current = Number(amountInput.replace(/\D/g, '') || 0);
    const next = Math.max(0, current + delta);
    setAmountInput(String(next));
  };

  // Confirmar y registrar gasto variable
  const handleConfirmQuickLog = async () => {
    if (!activeItem) return;
    const finalAmount = Math.round(Number(amountInput.replace(/\D/g, '') || 0));
    if (finalAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await onQuickLog({
        title: activeItem.label,
        amount: finalAmount,
        category: activeItem.category,
        date: dateInput || undefined,
        period: dateInput ? dateInput.slice(0, 7) : period,
        account_id: selectedAccountId || checkingAccounts[0]?.id || undefined,
        deduct_from_balance: false,
      });

      // Si el usuario marcó recordar este monto como nuevo valor base
      if (rememberAsDefault && finalAmount !== activeItem.defaultAmount) {
        const updated = shortcuts.map((s) =>
          s.id === activeItem.id ? { ...s, defaultAmount: finalAmount } : s
        );
        await persistShortcuts(updated);
      }

      setFeedbackMessage(`${activeItem.label} (-${formatCLP(finalAmount)}) registrado`);
      setTimeout(() => setFeedbackMessage(null), 3500);
      handleCloseQuickLog();
    } catch {
      // Error manejado en componente superior
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renderizador de iconos Lucide
  const renderIcon = (name: QuickShortcutItem['iconName'], size: number, color: string) => {
    switch (name) {
      case 'Croissant':
        return <Croissant size={size} color={color} />;
      case 'CupSoda':
        return <CupSoda size={size} color={color} />;
      case 'Cookie':
        return <Cookie size={size} color={color} />;
      case 'Coffee':
        return <Coffee size={size} color={color} />;
      case 'Bus':
        return <Bus size={size} color={color} />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed size={size} color={color} />;
      case 'ShoppingCart':
        return <ShoppingCart size={size} color={color} />;
      case 'Pill':
        return <Pill size={size} color={color} />;
      case 'Car':
        return <Car size={size} color={color} />;
      default:
        return <Tag size={size} color={color} />;
    }
  };

  // Guardar edición de un atajo individual en el configurador
  const handleSaveShortcutConfig = async (id: string) => {
    const amountNum = Math.round(Number(editAmount.replace(/\D/g, '') || 0));
    if (!editLabel.trim() || amountNum <= 0) return;

    const updated = shortcuts.map((s) =>
      s.id === id ? { ...s, label: editLabel.trim(), defaultAmount: amountNum } : s
    );
    await persistShortcuts(updated);
    setEditingShortcutId(null);
  };

  const handleResetToDefaults = async () => {
    await persistShortcuts(DEFAULT_QUICK_SHORTCUTS);
    setEditingShortcutId(null);
  };

  return (
    <View style={styles.container}>
      {/* Cabecera de la Barra de Atajos Rápidos */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.badgeRow}>
            <Sparkles size={13} color="#34D399" />
            <Text style={styles.badgeText}>MICRO-GASTOS CHILENOS</Text>
          </View>
          <Text style={styles.sectionTitle}>Acciones Rápidas (1 Toque + Edición)</Text>
          <Text style={styles.sectionSubtitle}>
            Toca un botón para registrar al instante o ajustar el precio en saltos de $100 pesos.
          </Text>
        </View>

        <Pressable
          onPress={() => setShowConfigModal(true)}
          style={styles.configBtn}
        >
          <SlidersHorizontal size={14} color={colors.textSecondary} />
          <Text style={styles.configBtnText}>Configurar Atajos</Text>
        </Pressable>
      </View>

      {/* Toast sutil de confirmación inmediata */}
      {feedbackMessage ? (
        <View style={styles.toastBox}>
          <CheckCircle2 size={14} color="#34D399" />
          <Text style={styles.toastText}>{feedbackMessage}</Text>
        </View>
      ) : null}

      {/* Carrusel Horizontal de Atajos Rápidos */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {shortcuts.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => handleOpenQuickLog(item)}
            style={({ pressed }) => [
              styles.shortcutCard,
              { borderColor: `${item.color}35` },
              pressed && styles.shortcutCardPressed,
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
              {renderIcon(item.iconName, 18, item.color)}
            </View>

            <View style={styles.cardInfoCol}>
              <Text style={styles.cardLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.cardAmount, { color: item.color }]}>
                {formatCLP(item.defaultAmount)}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* =====================================================================
          MODAL DE REGISTRO RÁPIDO CON MONTO EDITABLE EN SALTOS DE $100
         ===================================================================== */}
      {activeItem ? (
        <Modal
          visible={Boolean(activeItem)}
          transparent
          animationType="fade"
          onRequestClose={handleCloseQuickLog}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, isMobile && styles.modalBoxMobile]}>
              {/* Header Modal */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={[styles.modalIconWrap, { backgroundColor: `${activeItem.color}22` }]}>
                    {renderIcon(activeItem.iconName, 18, activeItem.color)}
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>{activeItem.label}</Text>
                    <Text style={styles.modalSub}>
                      Categoría: {activeItem.category.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Pressable onPress={handleCloseQuickLog} style={styles.closeBtn}>
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Input Principal de Monto CLP con Foco */}
              <View style={styles.amountDisplayBox}>
                <Text style={styles.amountLabel}>MONTO A REGISTRAR (CLP)</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.amountCurrencyPrefix}>$</Text>
                  <TextInput
                    value={amountInput}
                    onChangeText={setAmountInput}
                    keyboardType="numeric"
                    style={styles.amountTextInput}
                    selectTextOnFocus
                    autoFocus
                  />
                </View>
                <Text style={styles.amountFormattedHint}>
                  {formatCLP(Number(amountInput.replace(/\D/g, '') || 0))}
                </Text>
              </View>

              {/* Botones de Ajuste Rápido de Precio (Requerimiento: saltos de a $100 pesos) */}
              <View style={styles.stepsSection}>
                <Text style={styles.stepsSectionLabel}>AJUSTAR MONTO AL VUELO</Text>
                <View style={styles.stepsRow}>
                  <Pressable
                    onPress={() => handleAdjustAmount(-500)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>-$500</Text>
                  </Pressable>

                  {/* Salto solicitado de $100 pesos hacia abajo */}
                  <Pressable
                    onPress={() => handleAdjustAmount(-100)}
                    style={[styles.stepBtn, styles.stepBtnEmphasis]}
                  >
                    <Text style={[styles.stepBtnText, styles.stepBtnTextEmphasis]}>-$100</Text>
                  </Pressable>

                  {/* Salto solicitado de $100 pesos hacia arriba */}
                  <Pressable
                    onPress={() => handleAdjustAmount(100)}
                    style={[styles.stepBtn, styles.stepBtnEmphasis]}
                  >
                    <Text style={[styles.stepBtnText, styles.stepBtnTextEmphasis]}>+$100</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleAdjustAmount(500)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>+$500</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleAdjustAmount(1000)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepBtnText}>+$1.000</Text>
                  </Pressable>
                </View>
              </View>

              {/* Selector de Cuenta Débito de Pago */}
              {checkingAccounts.length > 0 ? (
                <View style={styles.accountSection}>
                  <Text style={styles.stepsSectionLabel}>DESCONTAR DE CUENTA</Text>
                  <View style={styles.accountsChipsRow}>
                    {checkingAccounts.map((acc) => {
                      const isSelected = (selectedAccountId || checkingAccounts[0]?.id) === acc.id;
                      return (
                        <Pressable
                          key={acc.id}
                          onPress={() => setSelectedAccountId(acc.id)}
                          style={[styles.accountChip, isSelected && styles.accountChipSelected]}
                        >
                          <Wallet
                            size={12}
                            color={isSelected ? colors.buttonPrimaryText : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.accountChipText,
                              isSelected && styles.accountChipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {acc.name} ({formatCLP(acc.current_balance)})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Checkbox para recordar nuevo valor predeterminado */}
              <Pressable
                onPress={() => setRememberAsDefault(!rememberAsDefault)}
                style={styles.rememberRow}
              >
                <View style={[styles.checkbox, rememberAsDefault && styles.checkboxActive]}>
                  {rememberAsDefault ? <Check size={11} color="#050505" strokeWidth={3} /> : null}
                </View>
                <Text style={styles.rememberText}>
                  Recordar este monto como mi nuevo valor base para {activeItem.label}
                </Text>
              </Pressable>

              {/* Acciones de Guardar / Cancelar */}
              <View style={styles.modalActions}>
                <TeslaButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={handleCloseQuickLog}
                />
                <TeslaButton
                  title={`Registrar ${formatCLP(Number(amountInput.replace(/\D/g, '') || 0))}`}
                  onPress={handleConfirmQuickLog}
                  loading={isSubmitting}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* =====================================================================
          MODAL DE CONFIGURACIÓN DEL CATÁLOGO DE ATAJOS
         ===================================================================== */}
      {showConfigModal ? (
        <Modal
          visible={showConfigModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfigModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.configModalBox, isMobile && styles.modalBoxMobile]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <SlidersHorizontal size={18} color="#34D399" />
                  <View>
                    <Text style={styles.modalTitle}>Configurar Atajos Rápidos</Text>
                    <Text style={styles.modalSub}>
                      Edita el nombre y monto predeterminado de cada botón
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setShowConfigModal(false)} style={styles.closeBtn}>
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={styles.configList} showsVerticalScrollIndicator={false}>
                {shortcuts.map((s) => {
                  const isEditingThis = editingShortcutId === s.id;
                  return (
                    <View key={s.id} style={styles.configItemRow}>
                      <View style={[styles.modalIconWrap, { backgroundColor: `${s.color}22` }]}>
                        {renderIcon(s.iconName, 15, s.color)}
                      </View>

                      {isEditingThis ? (
                        <View style={styles.configEditForm}>
                          <TextInput
                            value={editLabel}
                            onChangeText={setEditLabel}
                            placeholder="Nombre del atajo"
                            placeholderTextColor={colors.textMuted}
                            style={styles.configEditInput}
                          />
                          <TextInput
                            value={editAmount}
                            onChangeText={setEditAmount}
                            placeholder="Monto CLP"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            style={styles.configEditInput}
                          />
                          <View style={styles.configActionMiniRow}>
                            <Pressable
                              onPress={() => setEditingShortcutId(null)}
                              style={styles.configMiniBtnCancel}
                            >
                              <Text style={styles.configMiniBtnText}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleSaveShortcutConfig(s.id)}
                              style={styles.configMiniBtnSave}
                            >
                              <Text style={styles.configMiniBtnSaveText}>Guardar</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.configItemInfoRow}>
                          <View style={styles.configItemTexts}>
                            <Text style={styles.configItemLabel}>{s.label}</Text>
                            <Text style={styles.configItemAmount}>
                              Predeterminado: {formatCLP(s.defaultAmount)}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setEditingShortcutId(s.id);
                              setEditLabel(s.label);
                              setEditAmount(String(s.defaultAmount));
                            }}
                            style={styles.configEditIconBtn}
                          >
                            <Pencil size={13} color={colors.textSecondary} />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.configFooterRow}>
                <Pressable onPress={handleResetToDefaults} style={styles.resetBtn}>
                  <RotateCcw size={13} color={colors.textSecondary} />
                  <Text style={styles.resetBtnText}>Restablecer Valores de Fábrica</Text>
                </Pressable>
                <TeslaButton
                  title="Listo"
                  onPress={() => setShowConfigModal(false)}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 220,
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  configBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  toastText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.bentoCard,
    minWidth: 145,
  },
  shortcutCardPressed: {
    opacity: 0.75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoCol: {
    flexDirection: 'column',
    gap: 2,
  },
  cardLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardAmount: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.bentoBorderStrong,
    backgroundColor: colors.obsidianHero,
    padding: 22,
    gap: 16,
  },
  modalBoxMobile: {
    maxWidth: '100%',
    padding: 18,
  },
  configModalBox: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.bentoBorderStrong,
    backgroundColor: colors.obsidianHero,
    padding: 22,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },

  // Amount Display & Input
  amountDisplayBox: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: colors.bentoCard,
    alignItems: 'center',
    gap: 4,
  },
  amountLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountCurrencyPrefix: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    marginRight: 4,
  },
  amountTextInput: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 140,
    padding: 0,
  },
  amountFormattedHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Steps Row ($100 jumps)
  stepsSection: {
    gap: 8,
  },
  stepsSectionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnEmphasis: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  stepBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  stepBtnTextEmphasis: {
    color: '#34D399',
    fontWeight: '800',
  },

  // Account Chips
  accountSection: {
    gap: 8,
  },
  accountsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  accountChipSelected: {
    borderColor: colors.buttonPrimaryBg,
    backgroundColor: colors.buttonPrimaryBg,
  },
  accountChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  accountChipTextSelected: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },

  // Remember as default checkbox
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: '#34D399',
    backgroundColor: '#34D399',
  },
  rememberText: {
    color: colors.textSecondary,
    fontSize: 11,
    flex: 1,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  // Config Modal List
  configList: {
    maxHeight: 380,
  },
  configItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  configItemInfoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configItemTexts: {
    flex: 1,
  },
  configItemLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  configItemAmount: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  configEditIconBtn: {
    padding: 8,
  },
  configEditForm: {
    flex: 1,
    gap: 8,
  },
  configEditInput: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: colors.textPrimary,
    fontSize: 12,
  },
  configActionMiniRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  configMiniBtnCancel: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  configMiniBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  configMiniBtnSave: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.buttonPrimaryBg,
  },
  configMiniBtnSaveText: {
    color: colors.buttonPrimaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  configFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
    flexWrap: 'wrap',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  resetBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
});
