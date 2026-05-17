import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import CustomInput from '../components/CustomInput';
import GenderToggle from '../components/GenderToggle';
import CustomButton from '../components/CustomButton';
import { signupUser, clearError } from '../store/slices/authSlice';
import SCREENS from '../constants/screenNames';
import colors from '../theme/colors';

const SignupScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  const { loading, error, isAuthenticated } = useSelector(state => state.auth);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [stateName, setStateName] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [isLawyer, setIsLawyer] = useState(false);
  const [licenseId, setLicenseId] = useState('');
  const [specialization, setSpecialization] = useState('');

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

  const handleSignup = () => {
    if (!name || !phone || !password || !stateName || !city || !gender) {
      Alert.alert(t('error') || 'Error', t('fillAllFields') || 'Please fill all fields');
      return;
    }

    if (isLawyer && !licenseId) {
      Alert.alert(t('error') || 'Error', 'Please enter your Bar License ID');
      return;
    }

    dispatch(signupUser({ 
      name, 
      phone_number: phone, 
      password, 
      state: stateName,
      city, 
      gender,
      role: isLawyer ? 'lawyer' : 'user',
      licenseId: isLawyer ? licenseId : undefined,
      specializations: isLawyer ? [specialization] : undefined,
    }));
  };

  return (
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

      <Text style={styles.welcomeText}>Create an account</Text>

      <View style={styles.form}>
        <CustomInput label={t('enterName')} value={name} onChangeText={setName} />
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
        <CustomInput label="State" value={stateName} onChangeText={setStateName} />
        <CustomInput label={t('city')} value={city} onChangeText={setCity} />
        
        <Text style={styles.label}>{t('gender')}</Text>
        <GenderToggle 
          selected={gender} 
          onSelect={setGender} 
          maleText={t('male')} 
          femaleText={t('female')} 
        />

        <TouchableOpacity 
          style={styles.lawyerToggle} 
          onPress={() => setIsLawyer(!isLawyer)}
        >
          <View style={[styles.checkbox, isLawyer && styles.checkboxActive]} />
          <Text style={styles.lawyerToggleText}>I am a legal professional (Lawyer)</Text>
        </TouchableOpacity>

        {isLawyer && (
          <View style={{ marginTop: 10 }}>
            <CustomInput label="Bar Association License ID" value={licenseId} onChangeText={setLicenseId} />
            <CustomInput label="Specialization (e.g. Property, Family)" value={specialization} onChangeText={setSpecialization} />
          </View>
        )}
      </View>

      <View style={{ marginTop: 32 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : (
          <CustomButton
            title="Create Account"
            variant="primary"
            onPress={handleSignup}
          />
        )}
      </View>

      <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate(SCREENS.LOGIN)}>
        <Text style={styles.loginText}>Already have an account? <Text style={{ color: colors.accent }}>Login</Text></Text>
      </TouchableOpacity>

      <View style={styles.bottomDecoration}>
        <View style={styles.smallCircle} />
        <View style={styles.smallCircle} />
        <View style={styles.smallCircle} />
        <View style={styles.smallCircle} />
      </View>
    </ScrollView>
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
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginText: {
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
  lawyerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.accent,
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
  },
  lawyerToggleText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
});

export default SignupScreen;
