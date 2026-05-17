import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import axiosClient from '../api/axiosClient';
import SCREENS from '../constants/screenNames';

const LawyerListScreen = () => {
  const navigation = useNavigation();
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rating');
  const [specialization, setSpecialization] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLawyers = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/lawyers', {
        params: { sort: sortBy, specialization, search: searchQuery }
      });
      setLawyers(res.data.data);
    } catch (err) {
      console.error('Failed to fetch lawyers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchLawyers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [sortBy, specialization, searchQuery]);

  const renderLawyerCard = ({ item }) => {
    if (loading && !lawyers.length) {
      return (
        <View style={[styles.lawyerCard, { opacity: 0.5 }]}>
          <View style={styles.avatarPlaceholder} />
          <View style={{ flex: 1 }}>
            <View style={{ height: 20, backgroundColor: '#444', width: '60%', marginBottom: 8, borderRadius: 4 }} />
            <View style={{ height: 14, backgroundColor: '#333', width: '40%', borderRadius: 4 }} />
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.lawyerCard}
        onPress={() => navigation.navigate(SCREENS.LAWYER_PROFILE, { 
          lawyerId: item._id,
          lawyer: item 
        })}
      >
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.lawyerInfo}>
          <View style={styles.lawyerHeader}>
            <Text style={styles.lawyerName}>{item.name}</Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {item.rating?.toFixed(1) || '0.0'}</Text>
            </View>
          </View>
          <Text style={styles.specializationText}>{item.specializations?.join(', ')}</Text>
          <View style={styles.lawyerFooter}>
            <Text style={styles.experienceText}>{item.experienceYears || 0} years exp.</Text>
            <Text style={styles.casesText}>{item.casesSolved || 0} cases solved</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Legal Experts</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or specialization..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <FilterBtn label="Top Rated" active={sortBy === 'rating'} onPress={() => setSortBy('rating')} />
          <FilterBtn label="Most Experienced" active={sortBy === 'experience'} onPress={() => setSortBy('experience')} />
          <FilterBtn label="Most Cases" active={sortBy === 'cases'} onPress={() => setSortBy('cases')} />
        </ScrollView>
      </View>

      <FlatList
        data={loading && !lawyers.length ? [1, 2, 3] : lawyers}
        renderItem={renderLawyerCard}
        keyExtractor={(item, index) => item._id || index.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading && <Text style={styles.empty}>No lawyers found matching criteria.</Text>}
      />
    </SafeAreaView>
  );
};

const FilterBtn = ({ label, active, onPress }) => (
  <TouchableOpacity 
    style={[styles.filterBtn, active && styles.filterBtnActive]} 
    onPress={onPress}
  >
    <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingTop: 40, paddingBottom: 10 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchInput: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, color: '#fff', borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  filters: { marginBottom: 16 },
  filterScroll: { paddingHorizontal: 20 },
  filterBtn: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textSecondary, fontSize: 13 },
  filterTextActive: { color: '#000', fontWeight: 'bold' },
  list: { padding: 20, paddingBottom: 80 },
  lawyerCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  avatarText: { color: '#000', fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  spec: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  metrics: { flexDirection: 'row', gap: 12 },
  rating: { color: colors.accent, fontSize: 12, fontWeight: 'bold' },
  cases: { color: colors.textSecondary, fontSize: 12 },
  exp: { color: colors.textSecondary, fontSize: 12 },
  arrow: { color: colors.textSecondary, fontSize: 24, marginLeft: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', marginRight: 16 },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  lawyerInfo: { flex: 1 },
  lawyerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lawyerName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ratingBadge: { backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ratingText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  specializationText: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  lawyerFooter: { flexDirection: 'row', gap: 12 },
  experienceText: { color: colors.textSecondary, fontSize: 11 },
  casesText: { color: colors.textSecondary, fontSize: 11 },
});

export default LawyerListScreen;
