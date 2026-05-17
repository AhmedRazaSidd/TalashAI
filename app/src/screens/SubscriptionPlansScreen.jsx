import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { updateProfileSuccess } from '../store/slices/authSlice';
import colors from '../theme/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const SubscriptionPlansScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const user = useSelector((state) => state.auth.user);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mock payment details
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axiosClient.get('/subscription-plans');
        if (response.data.success) {
          setPlans(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load plans', err);
        Alert.alert('Error', 'Failed to retrieve subscription plans. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleOpenCheckout = (plan) => {
    if (user?.subscriptionStatus === 'active' && user?.subscriptionPlanId?._id === plan._id) {
      Alert.alert('Info', 'You are already subscribed to this plan!');
      return;
    }
    setSelectedPlan(plan);
    setCheckoutVisible(true);
  };

  const handleSubscribe = async () => {
    if (selectedPlan.price > 0 && (!cardNumber || !expiry || !cvv)) {
      Alert.alert('Error', 'Please complete all payment fields.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axiosClient.post(`/subscription-plans/${selectedPlan._id}/subscribe`);
      if (response.data.success) {
        // Sync local Redux state
        dispatch(updateProfileSuccess(response.data.data));
        setCheckoutVisible(false);
        setCardNumber('');
        setExpiry('');
        setCvv('');
        Alert.alert(
          'Success! 👑',
          `Successfully subscribed to ${selectedPlan.name}. Welcome to Premium features!`,
          [{ text: 'Great!', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err) {
      console.error('Subscription error', err);
      Alert.alert('Subscription Failed', err.response?.data?.message || 'An error occurred during checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRemainingDays = () => {
    if (!user?.subscriptionExpiresAt) return 0;
    const expiryDate = new Date(user.subscriptionExpiresAt);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Plans</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container} 
        contentContainerStyle={[styles.contentContainer, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* CURRENT SUBSCRIPTION CARD */}
        <View style={styles.currentSubCard}>
          <Text style={styles.subCardLabel}>YOUR ACTIVE STATUS</Text>
          {user?.subscriptionStatus === 'active' ? (
            <View style={{ marginTop: 8 }}>
              <View style={styles.activeRow}>
                <Text style={styles.activePlanName}>
                  <Ionicons name="sparkles" size={16} color="#FFD700" /> {user.subscriptionPlanId?.name || 'Premium Plan'}
                </Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.activeExpiry}>
                Expires on: {new Date(user.subscriptionExpiresAt).toLocaleDateString()} ({getRemainingDays()} days left)
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.inactiveText}>No Active Premium Subscription</Text>
              <Text style={styles.inactiveDesc}>Upgrade your plan below to unlock unlimited legal counseling and realistic voice modes.</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>CHOOSE A PREMIUM TIER</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          plans.map((plan) => {
            const isCurrent = user?.subscriptionStatus === 'active' && user?.subscriptionPlanId?._id === plan._id;
            return (
              <View key={plan._id} style={[styles.planCard, isCurrent && styles.activePlanCard]}>
                {plan.price > 500 && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>POPULAR</Text>
                  </View>
                )}
                
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.currency} {plan.price}</Text>
                  <Text style={styles.planDuration}>/ {plan.durationInDays} Days</Text>
                </View>

                {/* Features Listing */}
                <View style={styles.featuresList}>
                  {plan.features?.map((feature, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <Text style={styles.checkIcon}>✓</Text>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.subscribeBtn, isCurrent && styles.currentPlanBtn]}
                  onPress={() => handleOpenCheckout(plan)}
                  disabled={isCurrent}
                >
                  <Text style={[styles.subscribeBtnText, isCurrent && styles.currentPlanBtnText]}>
                    {isCurrent ? 'Current Plan' : plan.price === 0 ? 'Activate Free Tier' : 'Upgrade Plan'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CHECKOUT MODAL */}
      <Modal visible={checkoutVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.checkoutSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Checkout</Text>
              <TouchableOpacity onPress={() => setCheckoutVisible(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPlan && (
              <ScrollView 
                showsVerticalScrollIndicator={false} 
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.checkoutPlanSummary}>
                  <Text style={styles.checkoutPlanLabel}>Selected Tier</Text>
                  <Text style={styles.checkoutPlanName}>{selectedPlan.name}</Text>
                  <Text style={styles.checkoutPrice}>
                    {selectedPlan.currency} {selectedPlan.price}
                  </Text>
                </View>

                {selectedPlan.price > 0 ? (
                  <View style={styles.paymentForm}>
                    <Text style={styles.paymentHeader}>💳 Card Details (Simulated Checkout)</Text>
                    
                    <TextInput
                      style={styles.inputField}
                      placeholder="Card Number (XXXX-XXXX-XXXX-XXXX)"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={cardNumber}
                      onChangeText={setCardNumber}
                      maxLength={16}
                    />

                    <View style={styles.formRow}>
                      <TextInput
                        style={[styles.inputField, { flex: 1, marginRight: 8 }]}
                        placeholder="MM/YY"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={expiry}
                        onChangeText={setExpiry}
                        maxLength={5}
                      />
                      <TextInput
                        style={[styles.inputField, { flex: 1, marginLeft: 8 }]}
                        placeholder="CVV"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        secureTextEntry={true}
                        value={cvv}
                        onChangeText={setCvv}
                        maxLength={3}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.freePlanNotice}>
                    <Text style={styles.freePlanTitle}>Instant Activation</Text>
                    <Text style={styles.freePlanDesc}>No card details needed for Free and Basic AI Standard tiers.</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={handleSubscribe}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.payBtnText}>
                      {selectedPlan.price > 0 ? `Pay & Subscribe Now` : 'Activate Now'}
                    </Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.legalNotice}>
                  By proceeding, you agree to the Talash AI Legal and Consultation Terms of Service. Purchases are immediately processed and renewed dynamically.
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  container: { flex: 1, padding: 20 },
  contentContainer: { paddingBottom: 40 },
  
  // CURRENT SUB CARD
  currentSubCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
  },
  subCardLabel: { color: colors.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: 'bold' },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  activePlanName: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  activeBadge: { backgroundColor: 'rgba(76, 217, 100, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { color: '#4CD964', fontSize: 10, fontWeight: 'bold' },
  activeExpiry: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  inactiveText: { color: '#FF453A', fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  inactiveDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },

  sectionTitle: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', marginBottom: 16 },

  // PLAN CARD
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  activePlanCard: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestValueText: { color: '#000000', fontSize: 9, fontWeight: 'bold' },
  planName: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  planPrice: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
  planDuration: { color: colors.textSecondary, fontSize: 14, marginLeft: 6, marginBottom: 4 },

  featuresList: { marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkIcon: { color: colors.accent, fontSize: 14, marginRight: 10, fontWeight: 'bold' },
  featureText: { color: '#E5E5EA', fontSize: 13, flex: 1, lineHeight: 18 },

  subscribeBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnText: { color: '#000000', fontSize: 15, fontWeight: 'bold' },
  currentPlanBtn: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  currentPlanBtnText: { color: colors.textSecondary },

  // MODAL CHEKCOUT
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  checkoutSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 24,
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  closeModalBtn: { padding: 4 },
  closeModalText: { color: colors.textSecondary, fontSize: 20 },

  checkoutPlanSummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkoutPlanLabel: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  checkoutPlanName: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  checkoutPrice: { color: colors.accent, fontSize: 26, fontWeight: 'bold', marginTop: 4 },

  paymentForm: { marginBottom: 20 },
  paymentHeader: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  inputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
  },
  formRow: { flexDirection: 'row', justifyContent: 'space-between' },

  freePlanNotice: {
    backgroundColor: 'rgba(76, 217, 100, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  freePlanTitle: { color: '#4CD964', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  freePlanDesc: { color: colors.textSecondary, fontSize: 12 },

  payBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  payBtnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  legalNotice: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});

export default SubscriptionPlansScreen;
