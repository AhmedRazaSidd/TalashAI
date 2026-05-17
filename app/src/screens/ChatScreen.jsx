import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  FlatList,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import colors from '../theme/colors';
import i18n from '../i18n/index';
import Ionicons from '@expo/vector-icons/Ionicons';
import socketClient from '../api/socketClient';
import axiosClient from '../api/axiosClient';
import AudioPlayer from '../components/AudioPlayer';
import { fetchSessionMessages, clearCurrentSession, addMessageToSession, toggleBookmark } from '../store/slices/chatSlice';
import SCREENS from '../constants/screenNames';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

const ChatScreen = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const route = useRoute();
  const navigation = useNavigation();

  const user = useSelector(state => state.auth.user);
  const userName = user?.name || 'User';

  const { sessions, currentSessionMessages, loadingMessages } = useSelector(state => state.chat);

  // Accept sessionId from params, or null for a new session
  const [sessionId, setSessionId] = useState(route.params?.sessionId || null);
  const initialMessage = route.params?.initialMessage || null;
  const [session, setSession] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const flatListRef = useRef(null);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axiosClient.get(`/chat/sessions/${sessionId}`);
        setSession(res.data.data);
      } catch (err) {
        console.error('Failed to fetch session', err);
      }
    };
    if (sessionId) fetchSession();
  }, [sessionId]);

  // Initialize socket and fetch history
  useEffect(() => {
    dispatch(clearCurrentSession());
    socketClient.connect();

    if (sessionId) {
      dispatch(fetchSessionMessages({ sessionId }));
      socketClient.emit('join_session', { sessionId });
    } else if (initialMessage) {
      // Auto-send the initial message to start the session
      const tempId = Date.now().toString();
      dispatch(addMessageToSession({
        _id: tempId, tempId, role: 'user', content: initialMessage, type: 'text', createdAt: new Date().toISOString()
      }));
      setIsTyping(true);
      socketClient.emit('send_message', { content: initialMessage, type: 'text' });
      // Clear initialMessage from params so it doesn't re-trigger
      navigation.setParams({ initialMessage: null });
    }

    const onSessionCreated = (data) => {
      setSessionId(data.sessionId);
    };

    const onMessageDone = (data) => {
      setIsTyping(false);
      // The backend returns { fullMessage, sessionId, messageId, audioUrl }
      dispatch(addMessageToSession({
        _id: data.messageId,
        role: 'assistant',
        content: data.fullMessage,
        audioUrl: data.audioUrl,
        type: data.audioUrl ? 'audio' : 'text',
        createdAt: new Date().toISOString()
      }));
    };

    const onMessageError = (data) => {
      setIsTyping(false);
      console.error('[Chat] Error:', data.error);
      Alert.alert('Message Failed', data.error || 'Something went wrong. Please try again.');
    };

    socketClient.on('session_created', onSessionCreated);
    socketClient.on('message_done', onMessageDone);
    socketClient.on('message_error', onMessageError);

    return () => {
      socketClient.off('session_created', onSessionCreated);
      socketClient.off('message_done', onMessageDone);
      socketClient.off('message_error', onMessageError);
      // Don't disconnect socket entirely, just cleanup listeners
    };
  }, [sessionId, dispatch]);

  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true })
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 300, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setIsDrawerOpen(false));
  };

  const clearChat = () => {
    setSessionId(null);
    dispatch(clearCurrentSession());
    // Optionally navigate back so the stack doesn't get messed up if we came from Home
    navigation.setParams({ sessionId: null });
  };

  const handleSend = () => {
    if (!inputText.trim() || isTyping) return;

    const tempId = Date.now().toString();
    const content = inputText.trim();

    // Add optimistic user message to Redux
    dispatch(addMessageToSession({
      _id: tempId,
      tempId,
      role: 'user',
      content,
      type: 'text',
      createdAt: new Date().toISOString()
    }));

    setInputText('');
    setIsTyping(true);

    // Emit to backend
    socketClient.emit('send_message', {
      sessionId,
      content,
      type: 'text'
    });
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri && sessionId) {
        // Read file as base64
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Add optimistic user message to Redux
        const tempId = Date.now().toString();
        dispatch(addMessageToSession({
          _id: tempId,
          tempId,
          role: 'user',
          content: 'Voice Message',
          type: 'voice',
          audioUrl: uri, // Temporary local URI for optimistic UI
          createdAt: new Date().toISOString()
        }));

        setIsTyping(true);

        socketClient.emit('voice_message', {
          sessionId,
          audioBase64: base64Audio
        });
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const handleAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Optimistic UI for attachment
        const tempId = Date.now().toString();
        dispatch(addMessageToSession({
          _id: tempId, tempId, role: 'user', content: file.name, type: 'attachment', createdAt: new Date().toISOString()
        }));

        const formData = new FormData();
        if (Platform.OS === 'web' && file.file) {
          formData.append('file', file.file);
        } else {
          formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || 'application/octet-stream',
          });
        }

        // Send to backend endpoint
        const response = await axiosClient.post(`/chat/sessions/${sessionId}/attachments`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Backend response has the final message with real ID
        if (response.data?.data) {
          // Replace temp message... wait, chatSlice doesn't have an update mechanism for attachments easily unless we add one.
          // Or we can just re-fetch messages!
          dispatch(fetchSessionMessages({ sessionId }));
        }
      }
    } catch (error) {
      console.error('Attachment failed', error);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    const isLawyer = item.role === 'lawyer';
    const timestamp = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    // Detect URLs in text content for clickable links
    const renderTextContent = (text) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = text.split(urlRegex);
      return (
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
          {parts.map((part, i) =>
            urlRegex.test(part) ? (
              <Text
                key={i}
                style={styles.linkText}
                onPress={() => Linking.openURL(part).catch(() => { })}
              >
                {part}
              </Text>
            ) : (
              part
            )
          )}
        </Text>
      );
    };

    const renderBubbleContent = () => {
      if (item.type === 'voice' || item.type === 'audio' || item.audioUrl) {
        return <AudioPlayer audioUrl={item.audioUrl} isUser={isUser} />;
      }

      if (item.type === 'attachment' || item.fileUrl) {
        const url = item.fileUrl || '';
        const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(url) || url.includes('/image/upload/') || (item.content && /\.(png|jpe?g|gif|webp|bmp)$/i.test(item.content));

        if (isImage && url) {
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => Linking.openURL(url).catch(() => { })}
            >
              <Image
                source={{ uri: url }}
                style={{
                  width: 200,
                  height: 150,
                  borderRadius: 12,
                  marginBottom: 4,
                }}
                resizeMode="cover"
              />
              {item.content ? (
                <Text style={[
                  styles.bubbleText,
                  isUser ? styles.userText : styles.aiText,
                  { fontSize: 12, opacity: 0.8, marginTop: 4 }
                ]}>
                  {item.content}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => url && Linking.openURL(url).catch(() => { })}
          >
            <Text style={{ fontSize: 20, marginRight: 8 }}>📄</Text>
            <Text style={[
              styles.bubbleText,
              isUser ? styles.userText : styles.aiText,
              { textDecorationLine: 'underline' }
            ]}>
              {item.content || 'Document'}
            </Text>
          </TouchableOpacity>
        );
      }

      return renderTextContent(item.content || item.text);
    };

    return (
      <View style={isUser ? styles.userBubbleContainer : styles.aiBubbleContainer}>
        {!isUser && (
          <Text style={styles.roleIndicator}>
            {isLawyer ? '⚖️ Professional Lawyer' : t('talashAI')}
          </Text>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => {
            if (item._id && !item.tempId) {
              dispatch(toggleBookmark({ messageId: item._id }));
            }
          }}
        >
          <View style={[
            styles.bubble,
            isUser ? styles.userBubble : (isLawyer ? styles.lawyerBubble : styles.aiBubble),
            item.tempId && styles.pendingBubble,
          ]}>
            {renderBubbleContent()}
            {(item.type === 'voice' || item.type === 'audio' || item.audioUrl) ? (
              <AudioPlayer audioUrl={item.audioUrl} isUser={isUser} />
            ) : item.type === 'attachment' || item.fileUrl ? (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => item.fileUrl && Linking.openURL(item.fileUrl).catch(() => { })}
              >
                <Ionicons name="document-text" size={20} color={isUser ? "#000000" : colors.accent} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.bubbleText,
                  isUser ? styles.userText : styles.aiText,
                  { textDecorationLine: 'underline' }
                ]}>
                  {item.content || 'Document'}
                </Text>
              </TouchableOpacity>
            ) : (
              renderTextContent(item.content || item.text)
            )}

            {/* Bottom row: bookmark star + timestamp */}
            <View style={styles.messageMeta}>
              {item.isBookmarked && <Text style={styles.bookmarkStar}>⭐</Text>}
              <Text style={[styles.timeText, isUser ? styles.timeTextUser : styles.timeTextAI]}>
                {timestamp}
              </Text>
              {isUser && (
                <Text style={styles.statusText}>
                  {item.tempId ? '🕐' : item.status === 'read' ? '✔✔' : '✔'}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Messages from Redux are stored oldest-first (pushed in order).
  // We use inverted FlatList so newest appears at the bottom — no manual reversal needed.

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View style={styles.header}>
          {/* LEFT: Back button (if navigated here) or hamburger drawer */}
          <View style={styles.headerLeft}>
            {navigation.canGoBack() ? (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={openDrawer} style={styles.drawerButton}>
              <Ionicons name="menu" size={24} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* CENTER: Title */}
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{session?.title || 'Chat Session'}</Text>
            <TouchableOpacity
              disabled={!session?.lawyerId || user?.role === 'lawyer'}
              onPress={() => navigation.navigate(SCREENS.LAWYER_PROFILE, { lawyerId: session.lawyerId })}
            >
              <View style={styles.headerSubtitleRow}>
                {session?.status === 'with_lawyer' ? (
                  <>
                    <Ionicons name="shield-checkmark" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.headerSubtitleText}>Lawyer Active</Text>
                  </>
                ) : session?.status === 'resolved' ? (
                  <>
                    <Ionicons name="checkmark-circle" size={12} color="#4CD964" style={{ marginRight: 4 }} />
                    <Text style={[styles.headerSubtitleText, { color: '#4CD964' }]}>Resolved</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.headerSubtitleText}>Talash AI</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* RIGHT: Action icons */}
          <View style={styles.headerActions}>
            {user?.role === 'lawyer' && session?.status !== 'resolved' && (
              <TouchableOpacity style={styles.iconButton} onPress={async () => {
                try {
                  await axiosClient.patch(`/chat/sessions/${sessionId}`, { status: 'resolved' });
                  Alert.alert('Success', 'Case marked as resolved');
                  navigation.goBack();
                } catch (err) {
                  Alert.alert('Error', 'Failed to resolve case');
                }
              }}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            )}
            {user?.role === 'lawyer' && (
              <TouchableOpacity style={styles.iconButton} onPress={async () => {
                try {
                  const res = await axiosClient.get(`/chat/sessions/${sessionId}/summary`);
                  setAiSummary(res.data.data.summary);
                  setShowSummary(true);
                } catch (err) {
                  Alert.alert('Error', 'Could not generate summary.');
                }
              }}>
                <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconButton} onPress={() => sessionId && navigation.navigate(SCREENS.CHAT_DETAILS, { sessionId })}>
              <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* AI SUMMARY MODAL */}
        {showSummary && (
          <View style={styles.summaryOverlay}>
            <View style={styles.summaryModal}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="sparkles" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.summaryTitle, { marginBottom: 0 }]}>AI Case Brief</Text>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                <Text style={styles.summaryText}>{aiSummary}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.closeSummary} onPress={() => setShowSummary(false)}>
                <Text style={styles.closeSummaryText}>Close Brief</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CHAT MESSAGES AREA */}
        {loadingMessages && currentSessionMessages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={[...currentSessionMessages].reverse()}
            keyExtractor={(item, index) => item._id?.toString() || index.toString()}
            renderItem={renderMessage}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            inverted
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={true}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={15}
          />
        )}

        {isTyping && (
          <View style={styles.typingIndicatorContainer}>
            <Text style={styles.typingText}>Talash AI is thinking...</Text>
          </View>
        )}

        {/* BOTTOM INPUT BAR */}
        <View style={styles.bottomInputBar}>
          <TouchableOpacity style={styles.paperclipButton} onPress={handleAttachment}>
            <Ionicons name="attach" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.chatInput,
              isFocused && styles.chatInputFocused,
              i18n.language === 'ur' && styles.urduInput
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isRecording ? (i18n.language === 'ur' ? "آڈیو ریکارڈ ہو رہی ہے..." : "Recording audio...") : (t('typeQuestion') || 'Message')}
            placeholderTextColor="#888888"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!isTyping && !isRecording}
            multiline
          />

          {inputText.trim().length > 0 ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.sendButton, isTyping && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={isTyping}
            >
              <Ionicons name="send" size={18} color={colors.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.micButton, isRecording && { backgroundColor: colors.error }]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={isTyping}
            >
              <Ionicons name={isRecording ? "stop" : "mic"} size={20} color={isRecording ? "#FFFFFF" : colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* DRAWER */}
      {isDrawerOpen && (
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={closeDrawer} />
        </Animated.View>
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <View style={styles.drawerTop}>
          <Text style={styles.drawerTitle}>{t('chatHistory')}</Text>
          <TouchableOpacity onPress={closeDrawer}>
            <Ionicons name="close" size={24} color="#888888" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerScrollContent}>
          {sessions.map(item => (
            <TouchableOpacity
              key={item._id}
              style={styles.historyItem}
              onPress={() => {
                closeDrawer();
                setSessionId(item._id);
              }}
            >
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historyDate}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.drawerBottom}>
          <Text style={styles.drawerUser}>{userName}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    paddingTop: 14, paddingBottom: 12, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 64 },
  backButton: { padding: 6, marginRight: 2 },
  backIcon: { fontSize: 26, color: colors.accent, lineHeight: 30 },
  drawerButton: { padding: 6 },
  hamburger: { fontSize: 22, color: colors.accent },
  headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerSubtitleText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 64, justifyContent: 'flex-end' },
  iconButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.glass,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border
  },
  iconText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { flex: 1, backgroundColor: colors.background },
  messageListContent: { paddingHorizontal: 16, paddingVertical: 16 },
  userBubbleContainer: { alignSelf: 'flex-end', maxWidth: '85%', marginBottom: 12 },
  aiBubbleContainer: { alignSelf: 'flex-start', maxWidth: '85%', marginBottom: 12 },
  roleIndicator: { color: colors.textSecondary, fontSize: 10, marginBottom: 4, marginLeft: 12 },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  userBubble: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  lawyerBubble: { backgroundColor: colors.lawyer, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#000000', fontWeight: '500' },
  aiText: { color: '#FFFFFF' },
  linkText: { color: colors.accent, textDecorationLine: 'underline' },
  pendingBubble: { opacity: 0.65 },
  roleIndicator: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bookmarkStar: { fontSize: 10 },
  timeText: { fontSize: 10 },
  timeTextUser: { color: 'rgba(0,0,0,0.5)' },
  timeTextAI: { color: 'rgba(255,255,255,0.45)' },
  statusText: { fontSize: 10, color: 'rgba(0,0,0,0.5)' },
  typingIndicatorContainer: { paddingHorizontal: 20, paddingVertical: 10 },
  typingText: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' },
  bottomInputBar: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  paperclipButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#222222',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  paperclipIcon: { fontSize: 22 },
  chatInput: {
    flex: 1, backgroundColor: '#222222', borderRadius: 22, color: '#FFFFFF',
    fontSize: 15, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    maxHeight: 120, minHeight: 44,
  },
  chatInputFocused: { backgroundColor: '#2a2a2a' },
  actionButton: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  sendButton: { backgroundColor: 'rgba(201, 168, 76, 0.15)', borderWidth: 1, borderColor: colors.accent },
  micButton: { backgroundColor: 'rgba(201, 168, 76, 0.15)', borderWidth: 1, borderColor: colors.accent },
  actionIcon: { fontSize: 20, color: '#FFFFFF', fontWeight: 'bold' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000080', zIndex: 998 },
  backdropTouchable: { flex: 1 },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#111111', borderRightWidth: 1, borderRightColor: colors.border, zIndex: 999 },
  drawerTop: { paddingTop: 60, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  drawerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  closeDrawer: { color: '#888888', fontSize: 20, padding: 4 },
  drawerScroll: { flex: 1 },
  drawerScrollContent: { paddingHorizontal: 16 },
  historyItem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, marginBottom: 6 },
  historyTitle: { color: '#FFFFFF', fontSize: 14 },
  historyDate: { color: '#888888', fontSize: 11, marginTop: 3 },
  drawerBottom: { paddingBottom: 30, paddingHorizontal: 16, paddingTop: 20 },
  drawerUser: { color: '#888888', fontSize: 13 },
  summaryOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  summaryModal: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%',
    borderWidth: 1, borderColor: colors.accent
  },
  summaryTitle: { color: colors.accent, fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  summaryText: { color: '#FFFFFF', fontSize: 14, lineHeight: 22 },
  closeSummary: { marginTop: 20, backgroundColor: colors.accent, padding: 12, borderRadius: 8, alignItems: 'center' },
  closeSummaryText: { color: '#000000', fontWeight: 'bold' },
});

export default ChatScreen;