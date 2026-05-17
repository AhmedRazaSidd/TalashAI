import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import colors from '../theme/colors';
import { updateProfileSuccess } from '../store/slices/authSlice'; // To sync redux state
import Ionicons from '@expo/vector-icons/Ionicons';

const SecuritySettingsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  
  // Voice Mode state
  const [isAudioMode, setIsAudioMode] = useState(user?.voiceResponseMode === 'audio');
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleVoiceToggle = async (value) => {
    setIsAudioMode(value);
    setVoiceLoading(true);
    try {
      const mode = value ? 'audio' : 'text';
      const response = await axiosClient.patch(
        '/profile/settings',
        { voiceResponseMode: mode }
      );
      if (response.data.success) {
        dispatch(updateProfileSuccess(response.data.data));
        Alert.alert('Settings Saved', `AI Response Mode set to ${mode === 'audio' ? 'Full Voice' : 'Text Only'}`);
      }
    } catch (err) {
      setIsAudioMode(!value); // Revert on failure
      Alert.alert('Error', 'Failed to update voice response mode.');
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long.');
      return;
    }

    setPwdLoading(true);
    try {
      const response = await axiosClient.post(
        '/profile/change-password',
        { oldPassword, newPassword }
      );
      if (response.data.success) {
        Alert.alert('Success', 'Password changed successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security Settings</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* SECTION 1 — AI VOICE PREFERENCE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI VOICE PREFERENCE</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Interactive Voice Assistant</Text>
              <Text style={styles.settingDesc}>Allow Talash AI to answer with realistic Pakistani audio translations instead of just text.</Text>
            </View>
            {voiceLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Switch
                value={isAudioMode}
                onValueChange={handleVoiceToggle}
                trackColor={{ false: '#333', true: colors.accent }}
                thumbColor={isAudioMode ? '#000' : '#888'}
              />
            )}
          </View>
        </View>

        {/* SECTION 2 — SECURITY LOCKDOWN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHANGE ACCOUNT PASSWORD</Text>
          
          <CustomInput
            label="Current Password"
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry={true}
          />
          <CustomInput
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={true}
          />
          <CustomInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={true}
          />

          <View style={{ marginTop: 16 }}>
            {pwdLoading ? (
              <ActivityIndicator size="large" color={colors.accent} />
            ) : (
              <CustomButton
                title="Change Password"
                variant="primary"
                onPress={handleChangePassword}
              />
            )}
          </View>
        </View>

      </ScrollView>
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
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  settingDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
});

export default SecuritySettingsScreen;
