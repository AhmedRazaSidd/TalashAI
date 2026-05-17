import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import CustomInput from '../components/CustomInput';
import GenderToggle from '../components/GenderToggle';
import CustomButton from '../components/CustomButton';
import { updateUserProfile, uploadAvatar, clearError } from '../store/slices/authSlice';
import colors from '../theme/colors';

const EditProfileScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  
  const { user, loading, error } = useSelector(state => state.auth);
  
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar || null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (error) {
      Alert.alert(t('error') || 'Error', error);
      dispatch(clearError());
    }
  }, [error, dispatch, t]);

  const handlePickAvatar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setAvatarUri(file.uri);
        setSelectedFile(file);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const handleSave = async () => {
    if (!name || !city || !gender) {
      Alert.alert(t('error') || 'Error', t('fillAllFields') || 'Please fill all fields');
      return;
    }

    // 1. Upload Avatar if selected
    if (selectedFile) {
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name || 'avatar.jpg',
        type: selectedFile.mimeType || 'image/jpeg',
      });
      
      const avatarAction = await dispatch(uploadAvatar(formData));
      if (uploadAvatar.rejected.match(avatarAction)) {
        return; // Error will be handled by the useEffect above
      }
    }

    // 2. Update Profile Data
    const profileAction = await dispatch(updateUserProfile({ name, city, gender }));
    if (updateUserProfile.fulfilled.match(profileAction)) {
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container} 
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.rightPlaceholder} />
        </View>

        {/* AVATAR PICKER */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar}>
            <View style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : 'U'}</Text>
                </View>
              )}
              <View style={styles.editIconBadge}>
                <Text style={styles.editIconText}>✏️</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarLabel}>Tap to change avatar</Text>
        </View>

        {/* FORM */}
        <View style={styles.form}>
          <CustomInput label={t('enterName') || 'Name'} value={name} onChangeText={setName} />
          <CustomInput label={t('city') || 'City'} value={city} onChangeText={setCity} />
          
          <Text style={styles.label}>{t('gender') || 'Gender'}</Text>
          <GenderToggle 
            selected={gender} 
            onSelect={setGender} 
            maleText={t('male') || 'Male'} 
            femaleText={t('female') || 'Female'} 
          />
        </View>

        {/* SAVE BUTTON */}
        <View style={{ marginTop: 40 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} />
          ) : (
            <CustomButton
              title="Save Changes"
              variant="primary"
              onPress={handleSave}
            />
          )}
        </View>

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
  content: {
    padding: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 4,
  },
  backIcon: {
    color: colors.accent,
    fontSize: 24,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rightPlaceholder: {
    width: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarRing: {
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 60,
    padding: 4,
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000000',
    fontSize: 40,
    fontWeight: 'bold',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: colors.background,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconText: {
    fontSize: 14,
  },
  avatarLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 12,
  },
  form: {
    marginTop: 10,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
});

export default EditProfileScreen;
