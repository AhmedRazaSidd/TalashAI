import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import colors from '../theme/colors';
import CaseCard from '../components/CaseCard';
import SCREENS from '../constants/screenNames';
import { fetchSessions } from '../store/slices/chatSlice';
import { syncPushToken } from '../api/notifications';
import axiosClient from '../api/axiosClient';

const HomeScreen = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const user = useSelector(state => state.auth.user);
  const { sessions, loadingSessions } = useSelector(state => state.chat);
  const isLawyer = user?.role === 'lawyer';
  
  const handleClaimCase = async (sessionId) => {
    try {
      await axiosClient.post(`/chat/sessions/${sessionId}/claim`);
      Alert.alert('Success', 'You have claimed this case. You can now chat with the victim.');
      dispatch(fetchSessions());
    } catch (error) {
      console.error('Error claiming case:', error);
      Alert.alert('Error', 'Failed to claim case.');
    }
  };

  const userName = user?.name || 'User';
  const initial = userName.charAt(0).toUpperCase();

  useFocusEffect(
    React.useCallback(() => {
      if (isLawyer) {
        // Lawyers see all unclaimed active sessions across the platform
        dispatch(fetchSessions({ forLawyer: true }));
      } else {
        dispatch(fetchSessions());
      }
      syncPushToken();
    }, [dispatch, isLawyer])
  );



  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
      >
        
        {/* SECTION 1 — HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>{t('appName')}</Text>
            <Text style={[styles.greeting, i18n.language === 'ur' && styles.urduText]}>
              {t('goodMorning')} {userName} {user?.subscriptionStatus === 'active' && '👑'}
            </Text>
          </View>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* SECTION 2 — HERO ACTION */}
        <TouchableOpacity 
          style={styles.heroActionCard} 
          onPress={() => navigation.navigate(SCREENS.CREATE_CASE)}
        >
          <View style={styles.heroActionLeft}>
            <Text style={[styles.heroActionTitle, i18n.language === 'ur' && styles.urduTextSmall]}>
              {t('startNewCase')}
            </Text>
            <Text style={[styles.heroActionSubtitle, i18n.language === 'ur' && styles.urduTextTiny]}>
              Describe your legal issue for AI analysis.
            </Text>
          </View>
          <View style={styles.heroActionIcon}>
             <Text style={{ fontSize: 24 }}>⚖️</Text>
          </View>
        </TouchableOpacity>





        {/* SECTION 5 — RECENT CASES (Victim) or AVAILABLE CASES (Lawyer) */}
        <View style={styles.recentCasesHeader}>
          <Text style={styles.sectionTitleNoMargin}>
            {isLawyer ? 'Available Consultations' : t('recentCases')}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate(SCREENS.LAWYER_LIST)}>
            <Text style={styles.seeAllText}>{isLawyer ? t('seeAll') : 'Browse Experts'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentCasesList}>
          {loadingSessions && <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Loading sessions...</Text>}
          {!loadingSessions && sessions.length === 0 && (
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {isLawyer ? 'No available cases found in your region.' : 'No recent chats found.'}
            </Text>
          )}
          {sessions.map((session) => (
            <View key={session._id} style={styles.caseWrapper}>
              <CaseCard 
                title={session.title || 'Chat Session'}
                date={new Date(session.updatedAt).toLocaleDateString()}
                status={isLawyer ? (session.category || 'General') : 'Active'}
                onPress={() => navigation.navigate(SCREENS.CHAT, { sessionId: session._id })}
              />
              {isLawyer && !session.lawyerId && (
                <TouchableOpacity 
                  style={styles.claimButton}
                  onPress={() => handleClaimCase(session._id)}
                >
                  <Text style={styles.claimButtonText}>Claim Case</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* SECTION 6 — BOTTOM PADDING */}
        <View style={styles.bottomPadding} />

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.surface,
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  logoText: {
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: 4,
  },
  greeting: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 24,
  },
  heroActionCard: {
    backgroundColor: colors.accent,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  heroActionLeft: { flex: 1 },
  heroActionTitle: {
    color: '#000000',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  heroActionSubtitle: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 13,
    lineHeight: 18,
  },
  heroActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  recentCasesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitleNoMargin: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: colors.accent,
    fontSize: 13,
  },
  recentCasesList: {
    marginHorizontal: 16,
  },
  caseWrapper: {
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButton: {
    backgroundColor: colors.accent,
    padding: 8,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  urduText: { fontFamily: 'NotoNastaliqUrdu', textAlign: 'right' },
  urduTextSmall: { fontFamily: 'NotoNastaliqUrdu', textAlign: 'right', fontSize: 16 },
  urduTextTiny: { fontFamily: 'NotoNastaliqUrdu', textAlign: 'right', fontSize: 12 },
  bottomPadding: {
    height: 20,
  },
});

export default HomeScreen;
