/**
 * SettlementsScreen — exact port of web's SettlementsPage.tsx
 *
 * Sections:
 *  1. Balances to Settle (you owe others)
 *  2. Owed to You
 *  3. Pending Confirmation (approve button for receiver)
 *  4. Past Settlements
 *  5. Settlement bottom-sheet modal: UPI deep link + QR + Cash
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Pressable, Linking, Image, Alert, Clipboard, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';
import { useAuthStore } from '../store/auth';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { settlementsAPI } from '../api/services';
import { colors, fontSizes, fontWeights, radius, spacing, shadows } from '../theme';

interface ActiveSettlement {
  friendId: string;
  name: string;
  amount: number;
  upiId?: string;
  mobileNumber?: string;
}

export default function SettlementsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { ready, mySettlements, perUserBalances, resolveName, users } = useRealtimeStore(user?.id);

  const [activeSettlement, setActiveSettlement] = useState<ActiveSettlement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gpayOpened, setGpayOpened] = useState(false);

  const [customUpiInput, setCustomUpiInput] = useState('');
  const [customUpiSuffix, setCustomUpiSuffix] = useState('@okaxis');

  const pendingSettlements = mySettlements.filter(s => s.status === 'pending');
  const completedSettlements = mySettlements.filter(s => s.status === 'completed');

  const pendingByMe = new Set(
    pendingSettlements.filter(s => s.payer_id === user?.id).map(s => s.receiver_id)
  );

  const toSettleList = perUserBalances
    .filter(b => b.balance < 0)
    .map(b => ({ friendId: b.user_id, name: resolveName(b.user_id), balance: b.balance }));

  const owedToYouList = perUserBalances
    .filter(b => b.balance > 0)
    .map(b => ({ friendId: b.user_id, name: resolveName(b.user_id), balance: b.balance }));

  const openModal = (friendId: string, name: string, amount: number) => {
    const upiId = (users as any)[friendId]?.upi_id || undefined;
    const mobileNumber = (users as any)[friendId]?.mobile_number || undefined;
    setActiveSettlement({ friendId, name, amount, upiId, mobileNumber });
    setCustomUpiInput('');
    setCustomUpiSuffix('@okaxis');
    setGpayOpened(false);
    setSubmitting(false);
  };

  const handleSettleUp = async (method = 'GPay', status: 'pending' | 'completed' = 'pending') => {
    if (!activeSettlement || submitting) return;
    setSubmitting(true);
    try {
      await settlementsAPI.create({
        receiver_id: activeSettlement.friendId,
        amount: activeSettlement.amount,
        payment_method: method,
        status,
      });
      setActiveSettlement(null);
      setGpayOpened(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (settlementId: string) => {
    try {
      await settlementsAPI.approve(settlementId);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve settlement');
    }
  };

  const formatUpiId = (id: string, app: 'gpay' | 'phonepe' | 'paytm' | 'generic') => {
    const trimmed = id.trim();
    const isRawMobile = /^\d{10}$/.test(trimmed);
    if (isRawMobile) {
      if (app === 'gpay' || app === 'generic') return `${trimmed}@okaxis`;
      if (app === 'phonepe') return `${trimmed}@ybl`;
      if (app === 'paytm') return `${trimmed}@paytm`;
    }
    return trimmed;
  };

  const getUpiParams = (a: ActiveSettlement, overrideUpiId: string | undefined, app: 'gpay' | 'phonepe' | 'paytm' | 'generic') => {
    const rawId = overrideUpiId || a.mobileNumber || a.upiId;
    if (!rawId) return '';
    const formattedId = formatUpiId(rawId, app);
    return `pa=${encodeURIComponent(formattedId)}&pn=${encodeURIComponent(a.name.trim())}&cu=INR&tn=${encodeURIComponent('BudgetBuddy Settlement')}`;
  };

  const getUpiLink = (a: ActiveSettlement, overrideUpiId?: string) => {
    const params = getUpiParams(a, overrideUpiId, 'generic');
    return params ? `upi://pay?${params}` : '';
  };

  const getQrUrl = (a: ActiveSettlement, overrideUpiId?: string) => {
    const link = getUpiLink(a, overrideUpiId);
    return link ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}` : '';
  };

  const launchUpiApp = async (a: ActiveSettlement, app: 'gpay' | 'phonepe' | 'paytm' | 'generic', overrideUpiId?: string) => {
    const rawId = overrideUpiId || a.mobileNumber || a.upiId;
    if (!rawId) {
      Alert.alert('Error', 'Invalid payee details');
      return;
    }

    const formattedId = formatUpiId(rawId, app);
    const params = `pa=${encodeURIComponent(formattedId)}&pn=${encodeURIComponent(a.name.trim())}&cu=INR&tn=${encodeURIComponent('BudgetBuddy Settlement')}`;

    let link = `upi://pay?${params}`;
    if (app === 'gpay') {
      link = `tez://upi/pay?${params}`;
    } else if (app === 'phonepe') {
      link = `phonepe://pay?${params}`;
    } else if (app === 'paytm') {
      link = `paytmmp://pay?${params}`;
    }

    console.log('[UPI INTENT] Initiating Launch Sequence for:', app);
    console.log('[UPI INTENT] Target VPA:', formattedId);
    console.log('[UPI INTENT] Raw Deep Link:', link);

    try {
      const canOpen = await Linking.canOpenURL(link);
      if (canOpen) {
        await Linking.openURL(link);
        setGpayOpened(true);
      } else {
        // Fallback to generic upi:// scheme
        const fallbackLink = `upi://pay?${params}`;
        const canOpenFallback = await Linking.canOpenURL(fallbackLink);
        if (canOpenFallback) {
          await Linking.openURL(fallbackLink);
          setGpayOpened(true);
        } else {
          Alert.alert('No UPI App', 'Could not find a supporting UPI app. Please pay manually or scan the QR Code.');
          setGpayOpened(true);
        }
      }
    } catch (err) {
      console.error('[UPI INTENT] Exception:', err);
      Alert.alert('Launch Failed', 'Failed to launch the UPI app. Please pay manually or scan the QR Code.');
      setGpayOpened(true);
    }
  };

  if (!ready) {
    return (
      <View style={styles.root}>
        <TopBar title="Settle Up" showBack={false} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Skeleton height={48} />
          <Skeleton height={128} />
          <Skeleton height={192} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title="Settle Up" showBack={false} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balances to Settle ─────────────────────────────────────── */}
        <Card glass>
          <Text style={styles.sectionTitle}>Balances to Settle</Text>
          {toSettleList.length === 0 ? (
            <Text style={styles.emptyText}>No outstanding balances. 🎉</Text>
          ) : (
            toSettleList.map(item => {
              const isPending = pendingByMe.has(item.friendId);
              return (
                <View key={item.friendId} style={styles.balanceRow}>
                  <View style={styles.avatarSmall}>
                    <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName}>{item.name}</Text>
                    <Text style={[styles.balanceAmt, { color: colors.error }]}>
                      You owe: ₹{Math.abs(item.balance).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  {isPending ? (
                    <View style={styles.pendingChip}>
                      <Ionicons name="time-outline" size={12} color="#d97706" />
                      <Text style={styles.pendingChipText}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.settleBtn}
                      onPress={() => openModal(item.friendId, item.name, Math.abs(item.balance))}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.settleBtnText}>Settle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </Card>

        {/* ── Owed to You ─────────────────────────────────────────────── */}
        <Card glass>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>Owed to You</Text>
          {owedToYouList.length === 0 ? (
            <Text style={styles.emptyText}>No outstanding receivables.</Text>
          ) : (
            owedToYouList.map(item => (
              <View key={item.friendId} style={styles.balanceRow}>
                <View style={[styles.avatarSmall, { backgroundColor: colors.secondaryContainer }]}>
                  <Text style={[styles.avatarText, { color: colors.secondary }]}>{item.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceName}>{item.name}</Text>
                  <Text style={[styles.balanceAmt, { color: colors.secondary }]}>
                    Owes you: ₹{item.balance.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.awaitingChip}>
                  <Text style={styles.awaitingText}>Awaiting payment</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* ── Pending Confirmation ─────────────────────────────────────── */}
        <Card glass>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Pending Confirmation</Text>
            {pendingSettlements.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingSettlements.length}</Text>
              </View>
            )}
          </View>
          {pendingSettlements.length === 0 ? (
            <Text style={styles.emptyText}>No settlements pending confirmation.</Text>
          ) : (
            pendingSettlements.map(s => {
              const isPayer = s.payer_id === user?.id;
              const otherName = isPayer ? resolveName(s.receiver_id) : resolveName(s.payer_id);
              return (
                <View key={s.id} style={styles.pendingRow}>
                  <View style={[styles.avatarSmall, { backgroundColor: '#fef3c7', width: 36, height: 36, borderRadius: 18 }]}>
                    <Text style={[styles.avatarText, { color: '#b45309', fontSize: 13 }]}>{otherName[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName}>
                      {isPayer ? `You paid ${otherName}` : `${otherName} paid you`}
                    </Text>
                    <Text style={styles.expenseMeta}>
                      {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · {s.payment_method}
                    </Text>
                  </View>
                  <View style={styles.pendingRight}>
                    <Text style={styles.pendingAmt}>₹{s.amount.toLocaleString('en-IN')}</Text>
                    {!isPayer ? (
                      <TouchableOpacity
                        style={styles.confirmBtn}
                        onPress={() => handleApprove(s.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.confirmBtnText}>Confirm</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.awaitingText}>Awaiting confirm</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ── Past Settlements ─────────────────────────────────────────── */}
        <Card glass>
          <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>Past Settlements</Text>
          {completedSettlements.length === 0 ? (
            <Text style={styles.emptyText}>No completed settlements yet.</Text>
          ) : (
            completedSettlements.map(s => {
              const isPayer = s.payer_id === user?.id;
              const otherName = isPayer ? resolveName(s.receiver_id) : resolveName(s.payer_id);
              return (
                <View key={s.id} style={styles.balanceRow}>
                  <View style={[styles.avatarSmall, { backgroundColor: colors.bgSurfaceContainer }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{otherName[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName}>
                      {isPayer ? `You paid ${otherName}` : `${otherName} paid you`}
                    </Text>
                    <Text style={styles.expenseMeta}>
                      {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} · {s.payment_method}
                    </Text>
                  </View>
                  <Text style={[styles.pendingAmt, { color: isPayer ? colors.error : colors.secondary }]}>
                    {isPayer ? '-' : '+'} ₹{s.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      {/* ── Settlement Modal ──────────────────────────────────────────── */}
      <Modal
        visible={!!activeSettlement}
        transparent
        animationType="slide"
        onRequestClose={() => { setActiveSettlement(null); setGpayOpened(false); }}
      >
        <Pressable style={styles.overlay} onPress={() => { setActiveSettlement(null); setGpayOpened(false); }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settle up</Text>
              <TouchableOpacity onPress={() => { setActiveSettlement(null); setGpayOpened(false); }}>
                <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            {activeSettlement && (() => {
              const isMobileNumber = /^\d{10}$/.test(customUpiInput.trim());
              const effectiveUpiId = activeSettlement.mobileNumber || activeSettlement.upiId || (customUpiInput.trim() ? (isMobileNumber ? `${customUpiInput.trim()}${customUpiSuffix}` : customUpiInput.trim()) : undefined);
              return (
                <>
                  {/* Person + Amount */}
                  <View style={styles.modalPerson}>
                    <View style={styles.modalAvatar}>
                      <Text style={styles.modalAvatarText}>{activeSettlement.name[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.modalName}>{activeSettlement.name}</Text>
                    <Text style={styles.modalSub}>Outstanding balance settlement</Text>
                    <Text style={styles.modalAmount}>₹{activeSettlement.amount.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* If the friend has no UPI and no mobile number, show the custom input field at the top */}
                  {!activeSettlement.upiId && !activeSettlement.mobileNumber && (
                    <View style={styles.customInputSection}>
                      <Text style={styles.customInputLabel}>
                        {activeSettlement.name} hasn't added payment details
                      </Text>
                      <Text style={styles.customInputSub}>
                        Enter their UPI ID or Mobile Number to enable GPay / UPI payments:
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 9876543210 or name@okaxis"
                        value={customUpiInput}
                        onChangeText={setCustomUpiInput}
                        placeholderTextColor={colors.onSurfaceVariant + '70'}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      {/* If they typed a 10-digit number, show the app (suffix) selector */}
                      {isMobileNumber && (
                        <View style={styles.suffixSelectorContainer}>
                          <Text style={styles.suffixSelectorLabel}>Select their UPI application:</Text>
                          <View style={styles.suffixBtnRow}>
                            <TouchableOpacity
                              style={[styles.suffixBtn, customUpiSuffix === '@okaxis' && styles.suffixBtnActive]}
                              onPress={() => setCustomUpiSuffix('@okaxis')}
                            >
                              <Text style={[styles.suffixBtnText, customUpiSuffix === '@okaxis' && styles.suffixBtnTextActive]}>GPay (@okaxis)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.suffixBtn, customUpiSuffix === '@ybl' && styles.suffixBtnActive]}
                              onPress={() => setCustomUpiSuffix('@ybl')}
                            >
                              <Text style={[styles.suffixBtnText, customUpiSuffix === '@ybl' && styles.suffixBtnTextActive]}>PhonePe (@ybl)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.suffixBtn, customUpiSuffix === '@paytm' && styles.suffixBtnActive]}
                              onPress={() => setCustomUpiSuffix('@paytm')}
                            >
                              <Text style={[styles.suffixBtnText, customUpiSuffix === '@paytm' && styles.suffixBtnTextActive]}>Paytm (@paytm)</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {effectiveUpiId ? (
                    <View style={styles.upiSection}>
                      <Text style={styles.stepLabel}>
                        {/^\d{10}$/.test(effectiveUpiId) ? 'Mobile Number' : 'UPI ID'}
                      </Text>
                      
                      {/* Copy UPI Option */}
                      <View style={styles.copyUpiRow}>
                        <Text style={styles.upiIdText} numberOfLines={1}>
                          {effectiveUpiId}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => {
                            Clipboard.setString(effectiveUpiId || '');
                            Alert.alert('Copied', `${/^\d{10}$/.test(effectiveUpiId) ? 'Mobile Number' : 'UPI ID'} copied to clipboard!`);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="copy-outline" size={14} color={colors.primary} />
                          <Text style={styles.copyBtnText}>Copy</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.stepLabel}>Step 1 — Choose your UPI app</Text>
                      <View style={styles.appBtnRow}>
                        {/* Google Pay */}
                        <TouchableOpacity
                          style={[styles.appBtn, { borderColor: '#1a73e830', backgroundColor: '#1a73e808' }]}
                          onPress={() => launchUpiApp(activeSettlement, 'gpay', effectiveUpiId)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="logo-google" size={18} color="#1a73e8" />
                          <Text style={[styles.appBtnText, { color: '#1a73e8' }]}>GPay</Text>
                        </TouchableOpacity>
                        
                        {/* PhonePe */}
                        <TouchableOpacity
                          style={[styles.appBtn, { borderColor: '#5f259f30', backgroundColor: '#5f259f08' }]}
                          onPress={() => launchUpiApp(activeSettlement, 'phonepe', effectiveUpiId)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="wallet-outline" size={18} color="#5f259f" />
                          <Text style={[styles.appBtnText, { color: '#5f259f' }]}>PhonePe</Text>
                        </TouchableOpacity>

                        {/* Paytm */}
                        <TouchableOpacity
                          style={[styles.appBtn, { borderColor: '#00BAF230', backgroundColor: '#00BAF208' }]}
                          onPress={() => launchUpiApp(activeSettlement, 'paytm', effectiveUpiId)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="cash-outline" size={18} color="#00BAF2" />
                          <Text style={[styles.appBtnText, { color: '#00BAF2' }]}>Paytm</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Generic Fallback */}
                      <TouchableOpacity
                        style={styles.genericUpiBtn}
                        onPress={() => launchUpiApp(activeSettlement, 'generic', effectiveUpiId)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="card-outline" size={16} color={colors.primary} />
                        <Text style={styles.genericUpiBtnText}>Other UPI App</Text>
                      </TouchableOpacity>

                      {/* QR Code */}
                      <TouchableOpacity 
                        style={styles.qrBox}
                        onPress={() => launchUpiApp(activeSettlement, 'generic', effectiveUpiId)}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: getQrUrl(activeSettlement, effectiveUpiId) }}
                          style={styles.qrImg}
                          resizeMode="contain"
                        />
                        <Text style={styles.qrLabel}>Scan QR or tap it to open payment app</Text>
                      </TouchableOpacity>

                      <Text style={styles.stepLabel}>Step 2 — Confirm after paying</Text>
                      {gpayOpened ? (
                        <TouchableOpacity
                          style={[styles.confirmGpayBtn, submitting && { opacity: 0.65 }]}
                          onPress={() => handleSettleUp('GPay', 'pending')}
                          disabled={submitting}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-circle-outline" size={18} color={colors.onSecondary} />
                          <Text style={styles.confirmGpayText}>
                            {submitting ? 'Recording…' : "I've Paid — Confirm"}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.gpayHint}>Tap a payment option first, then confirm here.</Text>
                      )}

                      <View style={styles.cashRow}>
                        <Text style={styles.cashLabel}>Paying cash instead?</Text>
                        <TouchableOpacity onPress={() => handleSettleUp('Cash', 'pending')} disabled={submitting}>
                          <Text style={styles.cashLink}>Record Cash</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noUpiSection}>
                      <TouchableOpacity
                        style={[styles.gpayBtn, submitting && { opacity: 0.65 }]}
                        onPress={() => handleSettleUp('Cash', 'pending')}
                        disabled={submitting}
                      >
                        <Text style={styles.gpayBtnText}>{submitting ? 'Recording…' : 'Record as Cash Payment'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => handleSettleUp('GPay', 'pending')}
                        disabled={submitting}
                      >
                        <Text style={styles.secondaryBtnText}>Record pending GPay request</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.md },

  sectionTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  emptyText: { color: colors.onSurfaceVariant + '99', fontSize: fontSizes.sm, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.primary },
  balanceInfo: { flex: 1 },
  balanceName: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  balanceAmt: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, marginTop: 2 },
  expenseMeta: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant + '99', marginTop: 2 },

  settleBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    backgroundColor: colors.primary, ...shadows.card,
  },
  settleBtnText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.onPrimary },

  pendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#d97706' + '60',
    borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3,
  },
  pendingChipText: { fontSize: 10, color: '#92400e', fontWeight: fontWeights.bold },

  awaitingChip: {
    backgroundColor: colors.bgSurfaceContainer, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3,
  },
  awaitingText: { fontSize: 10, color: colors.onSurfaceVariant + '99', fontStyle: 'italic' },

  badge: {
    backgroundColor: '#f59e0b', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: fontWeights.bold },

  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pendingIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center',
  },
  pendingRight: { alignItems: 'flex-end', gap: 4 },
  pendingAmt: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.primary },
  confirmBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  confirmBtnText: { fontSize: 11, fontWeight: fontWeights.bold, color: colors.onSecondary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    padding: spacing.xl, gap: spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '20', paddingBottom: 12 },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary },
  modalPerson: { alignItems: 'center', gap: 6 },
  modalAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  modalAvatarText: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.primary },
  modalName: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.primary },
  modalSub: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant },
  modalAmount: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.error },

  upiSection: { gap: spacing.sm },
  stepLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.onSurfaceVariant + '99', textTransform: 'uppercase', letterSpacing: 0.5 },
  gpayBtn: {
    height: 48, borderRadius: radius.xl, backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.float,
  },
  gpayBtnText: { color: colors.onPrimary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  qrBox: { alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.outlineVariant + '20', padding: 12, gap: 6 },
  qrImg: { width: 144, height: 144 },
  qrLabel: { fontSize: 10, color: '#71717a', fontWeight: fontWeights.semibold },
  confirmGpayBtn: {
    height: 44, borderRadius: radius.xl, backgroundColor: colors.secondary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmGpayText: { color: colors.onSecondary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  gpayHint: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant + '80', textAlign: 'center', fontStyle: 'italic' },
  cashRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.outlineVariant + '20', paddingTop: 12 },
  cashLabel: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant },
  cashLink: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.primary },

  noUpiSection: { gap: spacing.sm },
  noUpiAlert: { backgroundColor: colors.errorContainer, borderWidth: 1, borderColor: colors.error + '30', borderRadius: radius.lg, padding: 12 },
  noUpiText: { fontSize: fontSizes.xs, color: colors.error, textAlign: 'center' },
  secondaryBtn: {
    height: 40, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: fontWeights.semibold },
  
  copyUpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSurfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  upiIdText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    flex: 1,
    marginRight: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  customInputSection: {
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSurfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
    gap: 8,
  },
  customInputLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  customInputSub: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant + 'cc',
  },
  textInput: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
    paddingHorizontal: 12,
    backgroundColor: colors.bgSurfaceContainer,
    color: colors.primary,
    fontSize: fontSizes.sm,
  },
  suffixSelectorContainer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
    paddingTop: 8,
    gap: 6,
  },
  suffixSelectorLabel: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.onSurfaceVariant + '80',
    textTransform: 'uppercase',
  },
  suffixBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  suffixBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suffixBtnActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  suffixBtnText: {
    fontSize: 9,
    fontWeight: fontWeights.bold,
    color: colors.onSurfaceVariant,
  },
  suffixBtnTextActive: {
    color: colors.primary,
  },
  appBtnRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  appBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  appBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  genericUpiBtn: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 2,
  },
  genericUpiBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: fontWeights.semibold,
  },
});
