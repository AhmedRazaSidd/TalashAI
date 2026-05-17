import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import colors from '../theme/colors';
import CustomButton from '../components/CustomButton';

const SupportScreen = () => {
  const navigation = useNavigation();
  const token = useSelector((state) => state.auth.token);
  
  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const response = await axiosClient.get('/faq');
      if (response.data.success) {
        setFaqs(response.data.data);
      }
    } catch (err) {
      console.error('FAQ Fetch Error:', err);
    } finally {
      setLoadingFaqs(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackContent.trim()) {
      Alert.alert('Error', 'Please enter some feedback content.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axiosClient.post(
        '/feedback',
        { type: feedbackType, content: feedbackContent }
      );
      if (response.data.success) {
        Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
        setFeedbackContent('');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & Help</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* SECTION 1 — FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>
          {loadingFaqs ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
          ) : faqs.length > 0 ? (
            faqs.map((faq, index) => (
              <TouchableOpacity 
                key={faq._id || index} 
                style={styles.faqItem}
                onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Text style={styles.faqArrow}>{expandedFaq === index ? '▲' : '▼'}</Text>
                </View>
                {expandedFaq === index && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No FAQs available at the moment.</Text>
          )}
        </View>

        {/* SECTION 2 — FEEDBACK FORM */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT US / FEEDBACK</Text>
          
          <View style={styles.typeSelector}>
            {['bug', 'feature', 'other'].map((type) => (
              <TouchableOpacity 
                key={type} 
                style={[styles.typeBtn, feedbackType === type && styles.typeBtnActive]}
                onPress={() => setFeedbackType(type)}
              >
                <Text style={[styles.typeBtnText, feedbackType === type && styles.typeBtnTextActive]}>
                  {type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.feedbackInput}
            placeholder="Describe your issue or suggestion..."
            placeholderTextColor={colors.textSecondary}
            multiline={true}
            numberOfLines={5}
            value={feedbackContent}
            onChangeText={setFeedbackContent}
          />

          <View style={{ marginTop: 16 }}>
            {submitting ? (
              <ActivityIndicator size="large" color={colors.accent} />
            ) : (
              <CustomButton
                title="Submit Feedback"
                variant="primary"
                onPress={handleFeedbackSubmit}
              />
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Talash AI v1.0.0 Production</Text>
          <Text style={styles.footerText}>Contact: support@talash.ai</Text>
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
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
  },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 10 },
  faqArrow: { color: colors.accent, fontSize: 10 },
  faqAnswer: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 10 },
  emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginVertical: 10 },
  
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeBtnText: { color: colors.textSecondary, fontSize: 10, fontWeight: 'bold' },
  typeBtnTextActive: { color: '#000' },
  
  feedbackInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    height: 120,
  },
  footer: { alignItems: 'center', marginBottom: 40 },
  footerText: { color: colors.textSecondary, fontSize: 11, marginBottom: 4 },
});

export default SupportScreen;
