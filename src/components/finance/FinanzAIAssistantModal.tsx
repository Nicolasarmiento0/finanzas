import React, { useState } from 'react';
import {
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
  CheckCircle2,
  Send,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useFinanzAI } from '@/context/FinanzAIContext';
import { usePrivacy } from '@/context/PrivacyContext';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, radius } from '@/theme/tokens';

const ACCENTS = {
  emerald: '#34D399',
  amber: '#F59E0B',
  coral: '#F43F5E',
  blue: '#38BDF8',
  textTertiary: '#71717A',
};

const QUICK_PILLS = [
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
  const { isOpen, closeFinanzAI, executeFinanzAIQuery, activeResult } = useFinanzAI();
  const { isPrivacyEnabled } = usePrivacy();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

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

  const handleAction = () => {
    if (!activeResult) return;
    closeFinanzAI();

    if (activeResult.actionType === 'view_cards') {
      router.push('/(main)/dashboard');
    } else if (activeResult.actionType === 'view_fixed') {
      router.push('/(main)/dashboard');
    }
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

  const verdictTheme = getVerdictStyle(activeResult?.verdictTone);
  const VerdictIcon = verdictTheme.icon;

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
                  <Text style={styles.headerTitle}>FinanzAI · Asistente Cuantitativo</Text>
                  <Text style={styles.headerSubtitle}>
                    Motor Determinista · Conectado a tus saldos en vivo
                  </Text>
                </View>
              </View>

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

            {/* Caja de Entrada de Texto Libre (What-If Engine) */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Pregunta libre... ej: ¿Puedo gastar 45 lucas hoy?"
                  placeholderTextColor={ACCENTS.textTertiary}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                  returnKeyType="search"
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

            {/* Cuerpo de la Respuesta */}
            <ScrollView
              style={styles.resultScrollView}
              contentContainerStyle={styles.resultScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {activeResult ? (
                <View style={styles.resultCard}>
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
                    <VerdictIcon size={16} color={verdictTheme.text} />
                    <Text
                      style={[styles.verdictText, { color: verdictTheme.text }]}
                      numberOfLines={2}
                    >
                      {activeResult.verdict}
                    </Text>
                  </View>

                  {/* Recomendación Ejecutiva Principal */}
                  <Text style={styles.recommendationText}>
                    {activeResult.recommendation}
                  </Text>

                  {/* Métricas Destacadas (si existen) */}
                  {activeResult.metrics && activeResult.metrics.length > 0 ? (
                    <View style={styles.metricsRow}>
                      {activeResult.metrics.map((metric, idx) => (
                        <View key={idx} style={styles.metricCard}>
                          <Text style={styles.metricLabel}>{metric.label}</Text>
                          <Text style={styles.metricValue}>{metric.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Desglose Matemático Transparente */}
                  {activeResult.detailedBreakdown.length > 0 ? (
                    <View style={styles.breakdownBox}>
                      <Text style={styles.breakdownEyebrow}>
                        DESGLOSE MATEMÁTICO TRANSPARENTE
                      </Text>
                      {activeResult.detailedBreakdown.map((line, idx) => (
                        <Text key={idx} style={styles.breakdownLine}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {/* Botón de Acción Directa (si aplica) */}
                  {activeResult.actionLabel ? (
                    <Pressable
                      onPress={handleAction}
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.actionButtonText}>
                        {activeResult.actionLabel}
                      </Text>
                      <ArrowRight size={15} color={colors.buttonPrimaryText} />
                    </Pressable>
                  ) : null}

                  {/* Preguntas Sugeridas / Follow-ups */}
                  {activeResult.suggestedFollowUps &&
                  activeResult.suggestedFollowUps.length > 0 ? (
                    <View style={styles.followUpsContainer}>
                      <Text style={styles.followUpsLabel}>
                        PREGUNTAS SUGERIDAS RELACIONADAS
                      </Text>
                      <View style={styles.followUpsList}>
                        {activeResult.suggestedFollowUps.map((q, idx) => (
                          <Pressable
                            key={idx}
                            onPress={() => handlePillPress(q)}
                            style={({ pressed }) => [
                              styles.followUpItem,
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            <Sparkles size={13} color={ACCENTS.emerald} />
                            <Text style={styles.followUpText}>{q}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
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
    backgroundColor: '#0C0C10',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
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
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    paddingBottom: 10,
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
  // Results
  resultScrollView: {
    flexGrow: 1,
    maxHeight: 460,
  },
  resultScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  resultCard: {
    marginTop: 6,
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
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
  },
  breakdownBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    marginBottom: 16,
  },
  breakdownEyebrow: {
    color: ACCENTS.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
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
});
