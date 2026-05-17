import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import colors from '../theme/colors';
import SCREENS from '../constants/screenNames';
import CustomButton from '../components/CustomButton';
import { createSession } from '../store/slices/chatSlice';
import axiosClient from '../api/axiosClient';
import Ionicons from '@expo/vector-icons/Ionicons';

const CreateCaseScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await axiosClient.get('/chat/categories');
        setCategories(res.data.data);
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCats();
  }, []);

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadedFiles([...uploadedFiles, ...result.assets]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const removeFile = (indexToRemove) => {
    setUploadedFiles(uploadedFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleStartChat = async () => {
    if (!selectedCategory) {
      Alert.alert('Category Required', 'Please select a legal category for your case.');
      return;
    }

    setLoading(true);
    
    try {
      const actionResult = await dispatch(createSession({ 
        category: selectedCategory.name,
        title: `${selectedCategory.name} Case`
      }));
      
      if (createSession.fulfilled.match(actionResult)) {
        const newSession = actionResult.payload;
        
        // TODO: Handle initial file uploads here before navigating if any (Phase 4.5/5)
        // We will pass the uploadedFiles to the ChatScreen to process them

        navigation.navigate(SCREENS.CHAT, { 
          sessionId: newSession._id,
          initialFiles: uploadedFiles 
        });
      } else {
        Alert.alert('Error', actionResult.payload || 'Failed to start chat');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 50, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('newCase') || 'New Case'}</Text>
          <View style={styles.rightPlaceholder} />
        </View>

        {/* CATEGORY SELECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('selectCategory') || 'Select Category'}</Text>
          <View style={styles.grid}>
            {categories.map((cat) => {
              const isSelected = selectedCategory?._id === cat._id;
              return (
                <TouchableOpacity 
                  key={cat._id} 
                  style={[styles.gridItem, isSelected && styles.gridItemActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gridIcon}>{cat.icon}</Text>
                  <Text style={[styles.gridLabel, isSelected && styles.gridLabelActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ATTACHMENTS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Initial Attachments (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Add any relevant documents, contracts, or evidence.</Text>
          
          <TouchableOpacity style={styles.uploadArea} onPress={handleFilePick}>
            <Ionicons name="attach" size={32} color={colors.accent} style={{ marginBottom: 8 }} />
            <Text style={styles.uploadText}>Tap to browse files</Text>
          </TouchableOpacity>

          {uploadedFiles.length > 0 && (
            <View style={styles.fileList}>
              {uploadedFiles.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <TouchableOpacity onPress={() => removeFile(index)}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* START CHAT BUTTON */}
        <View style={styles.bottomArea}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} />
          ) : (
            <CustomButton 
              title="Start Chatting" 
              variant="primary" 
              onPress={handleStartChat} 
            />
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16,
  },
  backButton: { padding: 4 },
  backIcon: { color: colors.accent, fontSize: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  rightPlaceholder: { width: 24 },
  
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { color: colors.textSecondary, fontSize: 14, marginBottom: 12 },
  sectionSubtitle: { color: '#888888', fontSize: 12, marginBottom: 16, marginTop: -8 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: {
    width: '48%', backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 20,
    alignItems: 'center', marginBottom: 16,
  },
  gridItemActive: { borderColor: colors.accent, backgroundColor: '#332b1a' },
  gridIcon: { fontSize: 24, marginBottom: 8 },
  gridLabel: { color: colors.textSecondary, fontSize: 14 },
  gridLabelActive: { color: colors.accent, fontWeight: 'bold' },

  uploadArea: {
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 12, padding: 30, alignItems: 'center', backgroundColor: colors.surface,
  },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { color: colors.accent, fontSize: 14, fontWeight: '500' },
  
  fileList: { marginTop: 16 },
  fileItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, padding: 12, borderRadius: 8, marginBottom: 8,
  },
  fileName: { color: '#FFFFFF', fontSize: 13, flex: 1, marginRight: 10 },
  fileRemove: { color: colors.error, fontSize: 16, fontWeight: 'bold' },

  bottomArea: { marginTop: 40, paddingHorizontal: 16 },
});

export default CreateCaseScreen;
