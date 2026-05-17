import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import colors from '../theme/colors';
import CaseCard from '../components/CaseCard';
import SCREENS from '../constants/screenNames';
import { fetchSessions } from '../store/slices/chatSlice';
import axiosClient from '../api/axiosClient';

const ArchiveScreen = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { sessions, loadingSessions } = useSelector(state => state.chat);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoryNames, setCategoryNames] = useState(['All']);

  useEffect(() => {
    dispatch(fetchSessions());
    // Fetch real categories from DB
    axiosClient.get('/chat/categories').then(res => {
      const names = res.data.data?.map(c => c.name) || [];
      setCategoryNames(['All', ...names]);
    }).catch(() => {});
  }, [dispatch]);

  const categories = categoryNames;

  // Archive = only resolved/closed sessions
  const filteredSessions = sessions.filter(session => {
    const isResolved = session.status === 'resolved';
    const matchesSearch = (session.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || session.category === selectedCategory;
    return isResolved && matchesSearch && matchesCategory;
  });

  const renderSessionItem = ({ item }) => (
    <View style={styles.cardContainer}>
      <CaseCard 
        title={item.title || 'Chat Session'}
        date={new Date(item.updatedAt).toLocaleDateString()}
        status="Closed" // Archive usually means closed cases
        onPress={() => navigation.navigate(SCREENS.CHAT, { sessionId: item._id })}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={[styles.title, i18n.language === 'ur' && styles.urduText]}>Case Archive</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your cases..."
          placeholderTextColor="#888888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.categoryChip, selectedCategory === item && styles.activeChip]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.categoryText, selectedCategory === item && styles.activeChipText]}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.categoryList}
        />
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={item => item._id}
        renderItem={renderSessionItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No cases found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, backgroundColor: colors.surface },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: 'bold' },
  searchContainer: { paddingHorizontal: 16, marginTop: 10 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF'
  },
  categoryContainer: { marginTop: 15 },
  categoryList: { paddingLeft: 16, paddingRight: 8 },
  categoryChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border,
    marginRight: 8
  },
  activeChip: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryText: { color: colors.textSecondary, fontSize: 13 },
  activeChipText: { color: '#000000', fontWeight: 'bold' },
  listContent: { padding: 16, paddingBottom: 80 },
  cardContainer: { marginBottom: 12 },
  emptyContainer: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  urduText: { fontFamily: 'NotoNastaliqUrdu', textAlign: 'right' },
});

export default ArchiveScreen;
