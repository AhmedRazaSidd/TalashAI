import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import LanguageModal from '../components/LanguageModal';
import { loginUser, setLanguage, clearError } from '../store/slices/authSlice';
import SCREENS from '../constants/screenNames';
import colors from '../theme/colors';
import i18n from '../i18n/index';

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  const { languageSelected, loading, error, isAuthenticated } = useSelector(state => state.auth);
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!languageSelected) {
      setShowModal(true);
    }
  }, [languageSelected]);

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace(SCREENS.MAIN_TABS);
    }
  }, [isAuthenticated, navigation]);

  useEffect(() => {
    if (error) {
      Alert.alert(t('error') || 'Error', error);
      dispatch(clearError());
    }
  }, [error, dispatch, t]);

  const handleLanguageSelect = (lang) => {
    dispatch(setLanguage(lang));
    i18n.changeLanguage(lang);
    setShowModal(false);
  };

  const handleLogin = () => {
    if (!phone || !password) {
      Alert.alert(t('error') || 'Error', 'Please enter your phone number and password');
      return;
    }
    dispatch(loginUser({ phone_number: phone, password }));
  };

  return (
    <>
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.circle} />
        <Text style={styles.headerTitle}>{t('appName')}</Text>
      </View>

      <Text style={styles.welcomeText}>Welcome back</Text>

      <View style={styles.form}>
        <CustomInput
          label={t('enterPhone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <CustomInput 
          label="Password" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry={true} 
        />
      </View>

      <View style={{ marginTop: 32 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : (
          <CustomButton
            title="Login"
            variant="primary"
            onPress={handleLogin}
          />
        )}
      </View>

      <TouchableOpacity style={styles.signupLink} onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.signupText}>Don't have an account? <Text style={{ color: colors.accent }}>Sign Up</Text></Text>
      </TouchableOpacity>

      <View style={styles.bottomDecoration}>
        <View style={styles.smallCircle} />
        <View style={styles.smallCircle} />
        <View style={styles.smallCircle} />
        <View style={styles.smallCircle} />
      </View>
    </ScrollView>

    <LanguageModal visible={showModal} onSelect={handleLanguageSelect} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
  },
  circle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333333',
    marginRight: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  welcomeText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 24,
  },
  form: {
    // form wrap
  },
  signupLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  signupText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  bottomDecoration: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  smallCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
});

export default LoginScreen;
