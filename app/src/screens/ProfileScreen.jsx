import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { logoutUser } from '../store/slices/authSlice';
import SCREENS from '../constants/screenNames';
import colors from '../theme/colors';

const ProfileScreen = () => {
  const { t } = useTranslation();
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const userName = user?.name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userPhone = user?.phone_number || '+92 300 1234567';
  const userCity = user?.city || 'Karachi';
  const userGender = user?.gender || 'Male';
  const userAvatar = user?.avatar || null;

  const handleLogout = () => {
    dispatch(logoutUser());
    navigation.reset({ index: 0, routes: [{ name: SCREENS.LOGIN }] });
  };

  const menuItems = [
    { id: 0, icon: '✎', title: 'Edit Profile', action: () => navigation.navigate('EditProfile') },
    { id: 1, icon: '◰', title: t('myCases').replace('📋  ', ''), action: () => navigation.navigate(SCREENS.HOME) },
    { id: 2, icon: '◩', title: t('chatHistoryMenu').replace('💬  ', ''), action: () => navigation.navigate(SCREENS.CHAT) },
    { id: 3, icon: '⌬', title: 'Security Settings', action: () => navigation.navigate(SCREENS.SECURITY_SETTINGS) },
    { id: 4, icon: '☏', title: 'Support & Help', action: () => navigation.navigate(SCREENS.SUPPORT) },
    { id: 5, icon: '💳', title: 'Subscription Plans', action: () => navigation.navigate(SCREENS.SUBSCRIPTION_PLANS) },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container} 
        contentContainerStyle={[styles.contentContainer, { flexGrow: 1 }]}
      >
        
        {/* SECTION 1 — HEADER */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>{t('profile')}</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutIconBtn}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 2 — AVATAR + NAME */}
        <View style={styles.profileSection}>
          <View style={styles.avatarRing}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>
            {userName} {user?.subscriptionStatus === 'active' && '👑'}
          </Text>
          {user?.subscriptionStatus === 'active' && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>
                {user?.subscriptionPlanId?.name || 'PREMIUM'}
              </Text>
            </View>
          )}
          <Text style={styles.userPhone}>{userPhone}</Text>
          <Text style={styles.userDetails}>📍 {userCity}  •  👤 {userGender}</Text>
        </View>

        {/* SECTION 3 — STATS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⚖️</Text>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>{t('casesFiled')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏳</Text>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>{t('pending')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>{t('resolved')}</Text>
          </View>
        </View>

        {/* SECTION 4 — MENU LIST */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>{t('accountSettings')}</Text>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.action}>
              <View style={styles.menuItemLeft}>
                <Text style={styles.menuItemIcon}>{item.icon}</Text>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
              </View>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SECTION 5 — LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('logout')}</Text>
        </TouchableOpacity>

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
  contentContainer: {
    paddingBottom: 80,
  },
  
  // SECTION 1 — HEADER
  header: {
    backgroundColor: colors.surface,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 24,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutIconBtn: {
    padding: 4,
  },
  logoutIcon: {
    color: colors.accent,
    fontSize: 20,
  },

  // SECTION 2 — AVATAR + NAME
  profileSection: {
    marginTop: 30,
    alignItems: 'center',
  },
  avatarRing: {
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 48,
    padding: 3,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarText: {
    color: '#000000',
    fontSize: 36,
    fontWeight: 'bold',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 14,
  },
  userPhone: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  userDetails: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },

  // SECTION 3 — STATS ROW
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 24,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'flex-start',
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statNumber: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  // SECTION 4 — MENU LIST
  menuSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  menuSectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 10,
  },
  menuItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    marginLeft: 10,
  },
  menuItemArrow: {
    color: colors.textSecondary,
    fontSize: 20,
  },

  // SECTION 5 — LOGOUT BUTTON
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  premiumBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default ProfileScreen;
