import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  FlatList,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import axiosClient from '../api/axiosClient';

const ChatDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { sessionId } = route.params;

  const [activeTab, setActiveTab] = useState('media'); // 'media', 'links', 'bookmarks'
  const [mediaItems, setMediaItems] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [mediaRes, bookmarksRes] = await Promise.all([
          axiosClient.get(`/chat/sessions/${sessionId}/media`),
          axiosClient.get(`/chat/sessions/${sessionId}/bookmarks`)
        ]);
        setMediaItems(mediaRes.data.data);
        setBookmarks(bookmarksRes.data.data);
      } catch (err) {
        console.error('Failed to fetch details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [sessionId]);

  const attachments = mediaItems.filter(m => m.type === 'attachment' || m.fileUrl);
  const links = mediaItems.filter(m => m.content && m.content.includes('http'));

  const renderAttachment = ({ item }) => (
    <TouchableOpacity 
      style={styles.mediaItem}
      onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)}
    >
      <View style={styles.mediaIcon}>
        <Text style={styles.mediaIconText}>📄</Text>
      </View>
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName} numberOfLines={1}>
          {item.content || 'Document'}
        </Text>
        <Text style={styles.mediaDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderLink = ({ item }) => {
    // Extract the URL from content (simplified)
    const urlMatch = item.content?.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;

    return (
      <TouchableOpacity 
        style={styles.linkItem}
        onPress={() => url && Linking.openURL(url)}
      >
        <View style={styles.linkIcon}>
          <Text style={styles.linkIconText}>🔗</Text>
        </View>
        <View style={styles.linkInfo}>
          <Text style={styles.linkUrl} numberOfLines={2}>
            {url || item.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'media' && styles.activeTab]}
          onPress={() => setActiveTab('media')}
        >
          <Text style={[styles.tabText, activeTab === 'media' && styles.activeTabText]}>Media & Docs</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'links' && styles.activeTab]}
          onPress={() => setActiveTab('links')}
        >
          <Text style={[styles.tabText, activeTab === 'links' && styles.activeTabText]}>Links</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'bookmarks' && styles.activeTab]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Text style={[styles.tabText, activeTab === 'bookmarks' && styles.activeTabText]}>Bookmarks</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : activeTab === 'media' ? (
        <FlatList
          data={attachments}
          keyExtractor={item => item._id.toString()}
          renderItem={renderAttachment}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No documents shared yet.</Text>}
        />
      ) : activeTab === 'links' ? (
        <FlatList
          data={links}
          keyExtractor={item => item._id.toString()}
          renderItem={renderLink}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No links shared yet.</Text>}
        />
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={item => item._id.toString()}
          renderItem={({ item }) => (
            <View style={styles.bookmarkItem}>
              <Text style={styles.bookmarkText}>{item.content}</Text>
              <Text style={styles.bookmarkDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No bookmarked messages yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backButton: { padding: 4 },
  backIcon: { color: colors.accent, fontSize: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  
  tabs: {
    flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.accent },
  tabText: { color: '#888888', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: colors.accent },

  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888888', textAlign: 'center', marginTop: 40 },

  mediaItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 12 },
  mediaIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  mediaIconText: { fontSize: 20 },
  mediaInfo: { flex: 1 },
  mediaName: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', marginBottom: 4 },
  mediaDate: { color: '#888888', fontSize: 12 },

  linkItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 12 },
  linkIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  linkIconText: { fontSize: 18 },
  linkInfo: { flex: 1 },
  linkUrl: { color: colors.accent, fontSize: 14 },

  bookmarkItem: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.accent },
  bookmarkText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  bookmarkDate: { color: '#888888', fontSize: 12 },
});

export default ChatDetailsScreen;
