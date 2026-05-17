import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loadUser } from '../store/slices/authSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import Loader from '../components/Loader';
import SCREENS from '../constants/screenNames';
import colors from '../theme/colors';

const SplashScreen = ({ navigation }) => {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const { isInitialized, isAuthenticated } = useSelector(state => state.auth);

  useEffect(() => {
    // Initiate token check immediately
    dispatch(loadUser());
  }, [dispatch]);

  useEffect(() => {
    // Wait for the auth check to finish
    if (isInitialized) {
      if (isAuthenticated) {
        navigation.replace(SCREENS.MAIN_TABS);
      } else {
        navigation.replace(SCREENS.LOGIN);
      }
    }
  }, [isInitialized, isAuthenticated, navigation]);

  return (
    <LinearGradient
      colors={['#111111', '#0D0D0D']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#111111" />
      <Text style={styles.title}>{t('appName')}</Text>
      <Text style={styles.tagline}>{t('appTagline')}</Text>
      <Loader style={styles.loader} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.accent,
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 8,
  },
  subtitle: {
    color: '#666666',
    fontSize: 13,
    marginTop: 4,
  },
  loader: {
    marginTop: 40,
  },
});

export default SplashScreen;
