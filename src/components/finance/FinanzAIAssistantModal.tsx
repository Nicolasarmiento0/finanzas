import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react-native';
import { AccordionToggle } from '@/components/ui/AccordionToggle';
import { ChatMessage, useFinanzAI } from '@/context/FinanzAIContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useResponsive } from '@/hooks/useResponsive';
import type { ProposedChatAction, QueryEngineResult } from '@/lib/queryEngine';
import { colors, radius } from '@/theme/tokens';

function maskSensitiveText(text: string, isPrivacyEnabled: boolean): string {
  if (!isPrivacyEnabled || !text) return text;
  return text.replace(/\$\s?\d+(?:[.,]\d+)*/g, '$ ••••••');
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const ACCENTS = {
  emerald: '#34D399',
  amber: '#F59E0B',
  coral: '#F43F5E',
  blue: '#38BDF8',
  textTertiary: '#71717A',
};

const QUICK_PILLS = [
  {
    id: 'wishlist_today',
    label: '🛍️ ¿Qué de mis futuras compras puedo comprar hoy?',
    query: '¿Qué de mis futuras compras puedo comprar hoy?',
  },
  {
    id: 'wishlist_plan',
    label: '📅 ¿Cuál es mi plan óptimo para comprar mi lista de deseos?',
    query: '¿Cuál es mi plan óptimo para comprar mi lista de deseos?',
  },
  {
    id: 'future_save_april',
    label: '📅 ¿Cuánto podré ahorrar en abril?',
    query: '¿Cuánto podré ahorrar en abril?',
  },
  {
    id: 'safe_save',
    label: '💰 ¿Cuánto puedo ahorrar hoy?',
    query: '¿Cuánto puedo ahorrar hoy de mi saldo?',
  },
  {
    id: 'income_cashflow',
    label: '💵 ¿Cuál es mi sueldo y flujo libre?',
    query: '¿Cuál es mi sueldo y cuánto me queda libre?',
  },
  {
    id: 'spend_50k',
    label: '🛍️ ¿Puedo gastar $50.000?',
    query: '¿Puedo gastar $50.000 hoy?',
  },
  {
    id: 'best_invest',
    label: '📈 ¿Dónde me conviene invertir?',
    query: '¿En qué cuenta me recomiendas invertir?',
  },
  {
    id: 'card_vs_save',
    label: '💳 ¿Pagar tarjeta o ahorrar?',
    query: '¿Me conviene pagar la tarjeta o ahorrar?',
  },
  {
    id: 'card_limits',
    label: '💳 ¿Cuál es el cupo de mis tarjetas?',
    query: '¿Cuál es el cupo de mis tarjetas de crédito?',
  },
  {
    id: 'survival',
    label: '🛡️ ¿Cómo van mis finanzas?',
    query: '¿Cómo va mi salud financiera y fondo de emergencia?',
  },
  {
    id: 'subscriptions',
    label: '📱 ¿Cuánto gasto en suscripciones?',
    query: '¿Cuánto gasto en suscripciones mensuales?',
  },
  {
    id: 'pending_bills',
    label: '📅 ¿Qué cuentas debo este mes?',
    query: '¿Qué cuentas me faltan pagar este mes?',
  },
  {
    id: 'category_audit',
    label: '📉 ¿Dónde se fue más plata?',
    query: '¿En qué categoría se fue más dinero este mes?',
  },
];

export function FinanzAIAssistantModal() {
  const {
    isOpen,
    closeFinanzAI,
    executeFinanzAIQuery,
    messages,
    clearConversation,
    loadingData,
    isSending,
    executeProposedAction,
    requestDashboardTab,
  } = useFinanzAI();
  const { isPrivacyEnabled } = usePrivacy();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const chatScrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [executingActionKey, setExecutingActionKey] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages.length, loadingData, isSending]);

  if (!isOpen) return null;

  const mask = (text: string) => maskSensitiveText(text, isPrivacyEnabled);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    executeFinanzAIQuery(text);
    setInputText('');
  };

  const handlePillPress = (query: string) => {
    setInputText('');
    executeFinanzAIQuery(query);
  };

  const handleClearChat = () => {
    setPendingActionKey(null);
    setExecutingActionKey(null);
    setActionFeedback({});
    setExpandedBreakdowns({});
    clearConversation();
  };

  const handleLegacyAction = (result: QueryEngineResult) => {
    if (result.actionType === 'view_cards') {
      requestDashboardTab('cards');
    } else if (result.actionType === 'view_fixed') {
      requestDashboardTab('fixed');
    }
    closeFinanzAI();

    if (result.actionType === 'view_cards' || result.actionType === 'view_fixed') {
      router.push('/(main)/dashboard');
    }
  };

  const handleProposedActionPress = async (msgId: string, action: ProposedChatAction) => {
    if (action.type === 'navigate_tab') {
      if (action.payload.tab) {
        requestDashboardTab(action.payload.tab);
      }
      closeFinanzAI();
      router.push('/(main)/dashboard');
      return;
    }

    const actionKey = `${msgId}:${action.id}`;
    if (pendingActionKey !== actionKey) {
      setPendingActionKey(actionKey);
      return;
    }

    setExecutingActionKey(actionKey);
    const res = await executeProposedAction(action);
    setExecutingActionKey(null);
    setPendingActionKey(null);
    setActionFeedback((prev) => ({
      ...prev,
      [actionKey]: res,
    }));
  };

  const toggleBreakdown = (msgId: string) => {
    setExpandedBreakdowns((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Determinar paleta de color según el veredicto
  const getVerdictStyle = (tone?: string) => {
    switch (tone) {
      case 'emerald':
        return {
          bg: 'rgba(52, 211, 153, 0.12)',
          border: 'rgba(52, 211, 153, 0.35)',
          text: ACCENTS.emerald,
          icon: CheckCircle2,
        };
      case 'amber':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.35)',
          text: ACCENTS.amber,
          icon: AlertTriangle,
        };
      case 'coral':
        return {
          bg: 'rgba(244, 63, 94, 0.12)',
          border: 'rgba(244, 63, 94, 0.35)',
          text: ACCENTS.coral,
          icon: AlertTriangle,
        };
      case 'blue':
      default:
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.35)',
          text: ACCENTS.blue,
          icon: Sparkles,
        };
    }
  };

  const lastAssistantMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  })();

  const renderAssistantBubble = (msg: ChatMessage) => {
    const res = msg.structuredResult;
    const isLatestAssistant = msg.id === lastAssistantMsgId;
    const timeLabel = formatMessageTime(msg.createdAt);

    if (!res) {
      return (
        <View key={msg.id} style={styles.assistantRow}>
          <View style={styles.assistantBubble}>
            <Text style={styles.recommendationText}>{mask(msg.text)}</Text>
            <View style={styles.assistantFooterRow}>
              <View
                style={[
                  styles.sourceBadge,
                  msg.source === 'workers_ai' && styles.sourceBadgeAI,
                ]}
              >
                <Text
                  style={[
                    styles.sourceBadgeText,
                    msg.source === 'workers_ai' && styles.sourceBadgeTextAI,
                  ]}
                >
                  {msg.source === 'workers_ai' ? '✨ Workers AI' : '⚡ Motor Local'}
                </Text>
              </View>
              {timeLabel ? <Text style={styles.msgTimestamp}>{timeLabel}</Text> : null}
            </View>
          </View>
        </View>
      );
    }

    const verdictTheme = getVerdictStyle(res.verdictTone);
    const VerdictIcon = verdictTheme.icon;
    const isBreakdownOpen = Boolean(expandedBreakdowns[msg.id]);

    return (
      <View key={msg.id} style={styles.assistantRow}>
        <View style={styles.assistantBubble}>
          {/* Badge de Veredicto */}
          <View
            style={[
              styles.verdictBadge,
              {
                backgroundColor: verdictTheme.bg,
                borderColor: verdictTheme.border,
              },
            ]}
          >
            <VerdictIcon size={15} color={verdictTheme.text} />
            <Text
              style={[styles.verdictText, { color: verdictTheme.text }]}
              numberOfLines={2}
            >
              {mask(res.verdict)}
            </Text>
          </View>

          {/* Recomendación Ejecutiva Principal */}
          <Text style={styles.recommendationText}>{mask(res.recommendation)}</Text>

          {/* Entidades Multi-Entidad Detectadas */}
          {res.extractedEntities &&
          (res.extractedEntities.category ||
            res.extractedEntities.installmentsCount ||
            res.extractedEntities.matchedCardName ||
            res.extractedEntities.matchedFuturePurchase) ? (
            <View style={styles.entityChipsRow}>
              {res.extractedEntities.matchedFuturePurchase ? (
                <View style={styles.entityChip}>
                  <Text style={styles.entityChipText}>
                    🛍️ {res.extractedEntities.matchedFuturePurchase.title}
                  </Text>
                </View>
              ) : null}
              {res.extractedEntities.category ? (
                <View style={styles.entityChip}>
                  <Text style={styles.entityChipText}>
                    🏷️ {res.extractedEntities.category}
                  </Text>
                </View>
              ) : null}
              {res.extractedEntities.paymentMode === 'installments' ? (
                <View style={styles.entityChip}>
                  <Text style={styles.entityChipText}>
                    💳 {res.extractedEntities.installmentsCount || 3} cuotas
                  </Text>
                </View>
              ) : res.extractedEntities.paymentMode === 'cash' ? (
                <View style={styles.entityChip}>
                  <Text style={styles.entityChipText}>💵 Al contado</Text>
                </View>
              ) : null}
              {res.extractedEntities.matchedCardName ? (
                <View style={styles.entityChip}>
                  <Text style={styles.entityChipText}>
                    💳 {res.extractedEntities.matchedCardName}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Métricas Destacadas */}
          {res.metrics && res.metrics.length > 0 ? (
            <View style={styles.metricsRow}>
              {res.metrics.map((metric, idx) => (
                <View key={idx} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{mask(metric.value)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Desglose Matemático Transparente (Acordeón Colapsable) */}
          {res.detailedBreakdown.length > 0 ? (
            <View style={styles.breakdownBox}>
              <View style={styles.breakdownHeaderRow}>
                <Text style={styles.breakdownEyebrow}>
                  DESGLOSE MATEMÁTICO TRANSPARENTE
                </Text>
                <AccordionToggle
                  expanded={isBreakdownOpen}
                  onPress={() => toggleBreakdown(msg.id)}
                  count={res.detailedBreakdown.length}
                  accessibilityLabel="Alternar desglose matemático"
                />
              </View>
              {isBreakdownOpen ? (
                <View style={styles.breakdownBody}>
                  {res.detailedBreakdown.map((line, idx) => (
                    <Text key={idx} style={styles.breakdownLine}>
                      {mask(line)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Action Cards Confirmables en 1 Toque */}
          {res.proposedActions && res.proposedActions.length > 0 ? (
            <View style={styles.actionCardsSection}>
              <Text style={styles.followUpsLabel}>ACCIONES SUGERIDAS</Text>
              {res.proposedActions.map((action) => {
                const actionKey = `${msg.id}:${action.id}`;
                const feedback = actionFeedback[actionKey];
                const isConfirming = pendingActionKey === actionKey;
                const isExecuting = executingActionKey === actionKey;
                const isDone = Boolean(feedback?.ok);

                if (action.type === 'navigate_tab') {
                  return (
                    <Pressable
                      key={action.id}
                      onPress={() => handleProposedActionPress(msg.id, action)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.actionButtonText}>{mask(action.label)}</Text>
                      <ArrowRight size={15} color={colors.buttonPrimaryText} />
                    </Pressable>
                  );
                }

                return (
                  <View
                    key={action.id}
                    style={[
                      styles.actionCardBox,
                      isDone && styles.actionCardDone,
                    ]}
                  >
                    <View style={styles.actionCardHeader}>
                      <Text style={styles.actionCardTitle}>{mask(action.label)}</Text>
                      {action.description ? (
                        <Text style={styles.actionCardDesc}>{mask(action.description)}</Text>
                      ) : null}
                    </View>

                    {feedback ? (
                      <View
                        style={[
                          styles.actionFeedbackPill,
                          feedback.ok
                            ? styles.actionFeedbackOk
                            : styles.actionFeedbackErr,
                        ]}
                      >
                        <Check
                          size={13}
                          color={feedback.ok ? ACCENTS.emerald : ACCENTS.coral}
                        />
                        <Text
                          style={[
                            styles.actionFeedbackText,
                            { color: feedback.ok ? ACCENTS.emerald : ACCENTS.coral },
                          ]}
                        >
                          {mask(feedback.message)}
                        </Text>
                      </View>
                    ) : isConfirming ? (
                      <View style={styles.actionConfirmRow}>
                        <Pressable
                          onPress={() => setPendingActionKey(null)}
                          disabled={isExecuting}
                          style={({ pressed }) => [
                            styles.actionCancelBtn,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <Text style={styles.actionCancelText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleProposedActionPress(msg.id, action)}
                          disabled={isExecuting}
                          style={({ pressed }) => [
                            styles.actionConfirmBtn,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          {isExecuting ? (
                            <ActivityIndicator size="small" color="#052e16" />
                          ) : (
                            <>
                              <Check size={14} color="#052e16" />
                              <Text style={styles.actionConfirmText}>
                                {action.confirmLabel || 'Confirmar'}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleProposedActionPress(msg.id, action)}
                        style={({ pressed }) => [
                          styles.actionTriggerBtn,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.actionTriggerText}>Ejecutar acción</Text>
                        <ArrowRight size={14} color={ACCENTS.emerald} />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ) : res.actionLabel ? (
            <Pressable
              onPress={() => handleLegacyAction(res)}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.actionButtonText}>{mask(res.actionLabel)}</Text>
              <ArrowRight size={15} color={colors.buttonPrimaryText} />
            </Pressable>
          ) : null}

          {/* Preguntas Sugeridas / Follow-ups (solo en el último turno para no saturar el hilo) */}
          {isLatestAssistant &&
          res.suggestedFollowUps &&
          res.suggestedFollowUps.length > 0 ? (
            <View style={styles.followUpsContainer}>
              <Text style={styles.followUpsLabel}>
                PREGUNTAS SUGERIDAS RELACIONADAS
              </Text>
              <View style={styles.followUpsList}>
                {res.suggestedFollowUps.map((q, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handlePillPress(q)}
                    style={({ pressed }) => [
                      styles.followUpItem,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Sparkles size={13} color={ACCENTS.emerald} />
                    <Text style={styles.followUpText}>{mask(q)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.assistantFooterRow}>
            <View
              style={[
                styles.sourceBadge,
                msg.source === 'workers_ai' && styles.sourceBadgeAI,
              ]}
            >
              <Text
                style={[
                  styles.sourceBadgeText,
                  msg.source === 'workers_ai' && styles.sourceBadgeTextAI,
                ]}
              >
                {msg.source === 'workers_ai' ? '✨ Workers AI' : '⚡ Motor Local'}
              </Text>
            </View>
            {timeLabel ? <Text style={styles.msgTimestamp}>{timeLabel}</Text> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={closeFinanzAI}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdropPressable} onPress={closeFinanzAI} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContentWrapper, isDesktop && styles.modalContentWrapperDesktop]}
        >
          <View style={styles.glassContainer}>
            {/* Cabecera del Asistente */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.sparkleIconBox}>
                  <Sparkles size={18} color={ACCENTS.emerald} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>FinanzAI · Chat Financiero</Text>
                  <Text style={styles.headerSubtitle}>
                    Workers AI · Motor Determinista Activo
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  onPress={handleClearChat}
                  accessibilityLabel="Nueva conversación"
                  style={({ pressed }) => [
                    styles.resetChatButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={8}
                >
                  <RotateCcw size={14} color={colors.textSecondary} />
                  <Text style={styles.resetChatText}>Nueva</Text>
                </Pressable>

                <Pressable
                  onPress={closeFinanzAI}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={10}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Píldoras de 1 Toque (Horizontal Scroll) */}
            <View style={styles.pillsSection}>
              <Text style={styles.pillsSectionLabel}>CONSULTAS RÁPIDAS (1 TOQUE)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsScrollContainer}
              >
                {QUICK_PILLS.map((pill) => (
                  <Pressable
                    key={pill.id}
                    onPress={() => handlePillPress(pill.query)}
                    style={({ pressed }) => [
                      styles.pillButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.pillText}>{pill.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Hilo de Conversación (Burbujas Usuario / FinanzAI) */}
            <ScrollView
              ref={chatScrollRef}
              style={styles.resultScrollView}
              contentContainerStyle={styles.chatThreadContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                chatScrollRef.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  const t = formatMessageTime(msg.createdAt);
                  return (
                    <View key={msg.id} style={styles.userRow}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userBubbleText}>{mask(msg.text)}</Text>
                        {t ? <Text style={styles.userTimestamp}>{t}</Text> : null}
                      </View>
                    </View>
                  );
                }
                return renderAssistantBubble(msg);
              })}

              {loadingData || isSending ? (
                <View style={styles.assistantRow}>
                  <View style={styles.loadingBubble}>
                    <ActivityIndicator size="small" color={ACCENTS.emerald} />
                    <Text style={styles.loadingBubbleText}>
                      {isSending ? 'Consultando tus cuentas con IA...' : 'Analizando tus cuentas...'}
                    </Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Barra Inferior de Redacción (Composer) */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Escribe aquí... ej: ¿Y en 6 cuotas? o ¿Puedo gastar 45 lucas?"
                  placeholderTextColor={ACCENTS.textTertiary}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  autoFocus={isDesktop}
                />
                {inputText.length > 0 ? (
                  <Pressable
                    onPress={() => setInputText('')}
                    style={styles.inputClearButton}
                  >
                    <X size={15} color={ACCENTS.textTertiary} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  !inputText.trim() && styles.sendButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Send
                  size={16}
                  color={inputText.trim() ? colors.buttonPrimaryText : ACCENTS.textTertiary}
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContentWrapper: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    zIndex: 10,
  },
  modalContentWrapperDesktop: {
    maxWidth: 680,
  },
  glassContainer: {
    backgroundColor: colors.obsidianHero,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.bentoBorderStrong,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sparkleIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resetChatText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  // Input (Bottom Composer)
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(5, 5, 5, 0.4)',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bentoCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bentoBorderStrong,
    paddingHorizontal: 14,
    height: 44,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  inputClearButton: {
    padding: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.buttonPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  // Pills
  pillsSection: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  pillsSectionLabel: {
    color: ACCENTS.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  pillsScrollContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  pillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  // Chat Thread
  resultScrollView: {
    flexGrow: 1,
    maxHeight: 460,
  },
  chatThreadContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  userBubbleText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    textAlign: 'right',
  },
  assistantRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  assistantBubble: {
    width: '94%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 20,
    borderTopLeftRadius: 4,
    padding: 14,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loadingBubbleText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  assistantFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sourceBadgeAI: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.28)',
  },
  sourceBadgeText: {
    color: ACCENTS.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  sourceBadgeTextAI: {
    color: ACCENTS.emerald,
  },
  msgTimestamp: {
    color: ACCENTS.textTertiary,
    fontSize: 10,
    textAlign: 'right',
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 14,
  },
  verdictText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  recommendationText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.bentoCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    padding: 12,
  },
  metricLabel: {
    color: ACCENTS.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  breakdownBox: {
    backgroundColor: colors.bentoCardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  breakdownEyebrow: {
    flex: 1,
    color: ACCENTS.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  breakdownBody: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  breakdownLine: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.buttonPrimaryBg,
    borderRadius: radius.md,
    paddingVertical: 11,
    marginBottom: 16,
  },
  actionButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  followUpsContainer: {
    marginTop: 4,
  },
  followUpsLabel: {
    color: ACCENTS.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  followUpsList: {
    gap: 6,
  },
  followUpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  followUpText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  entityChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  entityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  entityChipText: {
    color: ACCENTS.blue,
    fontSize: 11,
    fontWeight: '600',
  },
  actionCardsSection: {
    gap: 10,
    marginBottom: 16,
  },
  actionCardBox: {
    backgroundColor: colors.bentoCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bentoBorderStrong,
    padding: 12,
    gap: 10,
  },
  actionCardDone: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  actionCardHeader: {
    gap: 3,
  },
  actionCardTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionCardDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  actionTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.32)',
  },
  actionTriggerText: {
    color: ACCENTS.emerald,
    fontSize: 12,
    fontWeight: '700',
  },
  actionConfirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionCancelText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: ACCENTS.emerald,
  },
  actionConfirmText: {
    color: '#052e16',
    fontSize: 12,
    fontWeight: '700',
  },
  actionFeedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  actionFeedbackOk: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  actionFeedbackErr: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  actionFeedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
});
