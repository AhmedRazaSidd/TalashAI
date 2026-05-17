import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { logoutUser } from '../store/slices/authSlice';
import SCREENS from '../constants/screenNames';
import colors from '../theme/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

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
    { id: 0, icon: (color) => <Ionicons name="pencil-sharp" size={18} color={color} />, title: 'Edit Profile', action: () => navigation.navigate('EditProfile') },
    { id: 1, icon: (color) => <Ionicons name="briefcase-sharp" size={18} color={color} />, title: t('myCases').replace('📋  ', ''), action: () => navigation.navigate(SCREENS.HOME) },
    { id: 2, icon: (color) => <Ionicons name="chatbubbles-sharp" size={18} color={color} />, title: t('chatHistoryMenu').replace('💬  ', ''), action: () => navigation.navigate(SCREENS.CHAT) },
    { id: 3, icon: (color) => <Ionicons name="lock-closed-sharp" size={18} color={color} />, title: 'Security Settings', action: () => navigation.navigate(SCREENS.SECURITY_SETTINGS) },
    { id: 4, icon: (color) => <Ionicons name="help-circle-sharp" size={18} color={color} />, title: 'Support & Help', action: () => navigation.navigate(SCREENS.SUPPORT) },
    { id: 5, icon: (color) => <Ionicons name="card-sharp" size={18} color={color} />, title: 'Subscription Plans', action: () => navigation.navigate(SCREENS.SUBSCRIPTION_PLANS) },
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
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
            <Text style={[styles.userName, { marginTop: 0 }]}>{userName}</Text>
            {user?.subscriptionStatus === 'active' && (
              <Ionicons name="sparkles" size={16} color="#FFD700" style={{ marginLeft: 6 }} />
            )}
          </View>
          {user?.subscriptionStatus === 'active' && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>
                {user?.subscriptionPlanId?.name || 'PREMIUM'}
              </Text>
            </View>
          )}
          <Text style={styles.userPhone}>{userPhone}</Text>
          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.detailsText}>{userCity}</Text>
            <Text style={styles.detailsDivider}>•</Text>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.detailsText}>{userGender}</Text>
          </View>
        </View>

        {/* SECTION 3 — STATS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={20} color={colors.accent} style={{ marginBottom: 4 }} />
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>{t('casesFiled')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={colors.accent} style={{ marginBottom: 4 }} />
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>{t('pending')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color={colors.accent} style={{ marginBottom: 4 }} />
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
                {item.icon(colors.accent)}
                <Text style={styles.menuItemTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutButtonText}>{('logout')}</Text>
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
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  detailsText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  detailsDivider: {
    color: colors.border,
    marginHorizontal: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
