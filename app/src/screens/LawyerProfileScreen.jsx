import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import axiosClient from '../api/axiosClient';
import SCREENS from '../constants/screenNames';
import Ionicons from '@expo/vector-icons/Ionicons';

const LawyerProfileScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { lawyerId, lawyer: initialLawyer } = route.params || {};
  const [lawyer, setLawyer] = useState(initialLawyer || null);
  const [loading, setLoading] = useState(!initialLawyer);
  const [startingConsult, setStartingConsult] = useState(false);

  useEffect(() => {
    const fetchLawyer = async () => {
      if (!lawyerId) return;
      try {
        const res = await axiosClient.get(`/lawyers/${lawyerId}`);
        setLawyer(res.data.data);
      } catch (err) {
        console.error('Failed to fetch lawyer profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLawyer();
  }, [lawyerId]);

  if (loading) return <View style={styles.center}><Text style={{color: '#fff'}}>Loading...</Text></View>;
  if (!lawyer) return <View style={styles.center}><Text style={{color: '#fff'}}>Lawyer not found.</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Professional Profile</Text>
        <View style={{width: 24}} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{lawyer.name?.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{lawyer.name}</Text>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ Verified Professional</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{lawyer.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.metricLabel}>Rating</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{lawyer.casesSolved || 0}</Text>
            <Text style={styles.metricLabel}>Solved</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{lawyer.experienceYears || 0}y</Text>
            <Text style={styles.metricLabel}>Exp</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.consultBtn, startingConsult && { opacity: 0.7 }]}
          disabled={startingConsult}
          onPress={async () => {
            setStartingConsult(true);
            try {
              const res = await axiosClient.post('/chat/sessions', { 
                category: lawyer.specializations?.[0] || 'General',
                title: `Consultation with ${lawyer.name}`,
              });
              const sessionId = res.data.data?._id || res.data.data?.id;
              if (!sessionId) throw new Error('No session ID returned from server');
              navigation.navigate(SCREENS.CHAT, { sessionId });
            } catch (err) {
              console.error('Failed to start consultation', err);
              Alert.alert('Error', 'Could not start consultation. Please try again.');
            } finally {
              setStartingConsult(false);
            }
          }}
        >
          {startingConsult ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.consultBtnText}>Start Consultation</Text>
          )}
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>License ID</Text>
          <Text style={styles.sectionContent}>{lawyer.licenseId || 'Pending Verification'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <View style={styles.chips}>
            {lawyer.specializations?.map((s, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionContent}>
            {lawyer.lawyerDescription || 'This professional is a registered lawyer with the Bar Council of Pakistan, providing expert consultation through Talash.'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Feedback</Text>
          {lawyer.reviews?.length > 0 ? (
            lawyer.reviews.map((r, i) => (
              <View key={i} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewStars}>{'⭐'.repeat(r.rating)}</Text>
                  <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.sectionContent}>No reviews yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 40, backgroundColor: colors.surface },
  backIcon: { color: colors.accent, fontSize: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 24 },
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: '#000' },
  name: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  verifiedBadge: { backgroundColor: 'rgba(201, 168, 76, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  verifiedText: { color: colors.accent, fontSize: 12, fontWeight: 'bold' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#888888', fontSize: 13, marginBottom: 8, textTransform: 'uppercase' },
  sectionContent: { color: '#FFFFFF', fontSize: 16, lineHeight: 24 },
  metricsRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { color: colors.accent, fontSize: 18, fontWeight: 'bold' },
  metricLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  consultBtn: { backgroundColor: colors.accent, padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 32 },
  consultBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  reviewCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewStars: { fontSize: 12 },
  reviewDate: { color: colors.textSecondary, fontSize: 11 },
  reviewComment: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.accent, fontSize: 14 },
});

export default LawyerProfileScreen;
