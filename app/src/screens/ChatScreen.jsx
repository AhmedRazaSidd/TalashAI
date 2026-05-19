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

// --- Custom Artifact Components ---

const ArtifactCard = ({ title, icon, color = colors.accent, children }) => (
  <View style={[styles.artifactCard, { borderColor: color }]}>
    <View style={styles.artifactHeader}>
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 6 }} />
      <Text style={[styles.artifactTitle, { color }]}>{title}</Text>
    </View>
    <View style={styles.artifactBody}>{children}</View>
  </View>
);

const renderArtifact = (content) => {
  // Regex to detect JSON code blocks labeled as special artifacts
  const artifactRegex = /```json\s*([\s\S]*?)\s*```/g;
  let lastIndex = 0;
  let match;
  const elements = [];

  while ((match = artifactRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(<Text key={`text-${lastIndex}`} style={styles.aiText}>{content.substring(lastIndex, match.index)}</Text>);
    }
    
    try {
      const data = JSON.parse(match[1]);
      if (data.type === 'dashboard') {
        elements.push(
          <ArtifactCard key={`art-${match.index}`} title="Case Readiness Dashboard" icon="speedometer" color="#4CD964">
            <Text style={styles.artifactText}>Readiness Score: <Text style={{fontWeight: 'bold', fontSize: 18}}>{data.score}%</Text></Text>
            <Text style={styles.artifactText}>Status: {data.status}</Text>
          </ArtifactCard>
        );
      } else if (data.type === 'action_plan') {
        elements.push(
          <ArtifactCard key={`art-${match.index}`} title="Recommended Action Plan" icon="list" color={colors.accent}>
            {data.steps?.map((step, idx) => (
              <Text key={idx} style={styles.artifactText}>
                <Text style={{fontWeight: 'bold'}}>{idx + 1}.</Text> {step}
              </Text>
            ))}
          </ArtifactCard>
        );
      } else if (data.type === 'misguide_alert') {
        elements.push(
          <ArtifactCard key={`art-${match.index}`} title="Misguide Alert" icon="warning" color={colors.error}>
            {data.flags?.map((flag, idx) => (
              <Text key={idx} style={[styles.artifactText, { color: '#ffcccc' }]}>• {flag}</Text>
            ))}
          </ArtifactCard>
        );
      } else if (data.type === 'pdf_link') {
        elements.push(
          <ArtifactCard key={`art-${match.index}`} title="Generated Document" icon="document-text" color="#5AC8FA">
            <TouchableOpacity style={styles.pdfButton} onPress={() => Linking.openURL(data.url)}>
              <Ionicons name="download" size={16} color="#000" style={{ marginRight: 6 }} />
              <Text style={{ fontWeight: 'bold', color: '#000' }}>Download {data.filename}</Text>
            </TouchableOpacity>
          </ArtifactCard>
        );
      } else {
        // Not a recognized artifact, just render as raw text
        elements.push(<Text key={`raw-${match.index}`} style={styles.aiText}>{match[0]}</Text>);
      }
    } catch (e) {
      // Failed to parse JSON, render as raw text
      elements.push(<Text key={`raw-${match.index}`} style={styles.aiText}>{match[0]}</Text>);
    }
    lastIndex = artifactRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    elements.push(<Text key={`text-${lastIndex}`} style={styles.aiText}>{content.substring(lastIndex)}</Text>);
  }

  return <View>{elements}</View>;
};

// --- Compact Workflow Timeline & Question Card Components ---

const WorkflowTimeline = ({ progress }) => {
  if (!progress) return null;

  const { current_agent, completed_agents, remaining_agents, progress_percentage } = progress;

  const ALL_AGENTS = [
    'CaseListener', 'CaseClassifier', 'QuestioningAgent',
    'RightsAnalyzer', 'DocumentChecker', 'ActionPlanner',
    'MisguideDetector', 'PdfFormatter'
  ];

  return (
    <View style={styles.workflowContainer}>
      <View style={styles.workflowProgressRow}>
        <Text style={styles.workflowProgressText}>
          Analyzing Case: <Text style={{ color: colors.accent, fontWeight: 'bold' }}>{current_agent}</Text>
        </Text>
        <Text style={styles.workflowPercentage}>{progress_percentage}%</Text>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress_percentage}%` }]} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineScroll} contentContainerStyle={styles.timelineContent}>
        {ALL_AGENTS.map((agent) => {
          const isCompleted = completed_agents?.includes(agent);
          const isWaiting = current_agent === agent;
          
          let icon = 'ellipse-outline';
          let color = '#444';
          let textColor = '#888';
          let badgeBg = 'rgba(255,255,255,0.05)';

          if (isCompleted) {
            icon = 'checkmark-circle';
            color = '#4CD964';
            textColor = '#4CD964';
            badgeBg = 'rgba(76, 217, 100, 0.1)';
          } else if (isWaiting) {
            icon = 'time';
            color = '#FFCC00';
            textColor = '#FFCC00';
            badgeBg = 'rgba(255, 204, 0, 0.15)';
          }

          return (
            <View key={agent} style={[styles.timelineBadge, { backgroundColor: badgeBg }]}>
              <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} />
              <Text style={[styles.timelineBadgeText, { color: textColor }]}>{agent}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const AgentQuestionCard = ({ questionData }) => {
  if (!questionData) return null;

  const { question, expected_input, agent } = questionData;

  return (
    <View style={styles.questionCardContainer}>
      <View style={styles.questionCardHeader}>
        <View style={styles.questionAgentBadge}>
          <Ionicons name="sparkles" size={12} color="#000" style={{ marginRight: 4 }} />
          <Text style={styles.questionAgentText}>{agent}</Text>
        </View>
        <Text style={styles.expectedInputText}>
          Expected Input: <Text style={{ fontWeight: 'bold', color: colors.accent }}>{expected_input}</Text>
        </Text>
      </View>

      <Text style={styles.questionText}>{question}</Text>

      <View style={styles.questionCardFooter}>
        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
        <Text style={styles.waitingText}>Waiting for your reply...</Text>
      </View>
    </View>
  );
};

// -------------------------------------------------------------

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
  
  // Streaming state for agent trace
  const [activeStreamMessage, setActiveStreamMessage] = useState('');
  const [agentTrace, setAgentTrace] = useState('');

  const flatListRef = useRef(null);
  const chatInputRef = useRef(null);
  const isSendingRef = useRef(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // New interactive workflow states
  const [currentWorkflowProgress, setCurrentWorkflowProgress] = useState(null);
  const [currentAgentQuestion, setCurrentAgentQuestion] = useState(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axiosClient.get(`/chat/sessions/${sessionId}`);
        const sessionData = res.data.data;
        setSession(sessionData);

        if (sessionData) {
          const AGENT_SEQUENCE = [
            'CaseListener', 'CaseClassifier', 'QuestioningAgent',
            'RightsAnalyzer', 'DocumentChecker', 'ActionPlanner',
            'MisguideDetector', 'PdfFormatter'
          ];
          const currentStep = sessionData.current_step || 0;
          const currentAgent = sessionData.current_agent;
          const waitingForUser = sessionData.waiting_for_user;
          const collectedContext = sessionData.collected_context || {};
          const answers = collectedContext.answers || {};

          if (currentAgent) {
            const completedAgents = AGENT_SEQUENCE.slice(0, currentStep - 1);
            const remainingAgents = AGENT_SEQUENCE.slice(currentStep);
            const progressPercentage = Math.round(((currentStep - 1) / AGENT_SEQUENCE.length) * 100);

            setCurrentWorkflowProgress({
              current_agent: currentAgent,
              current_step: currentStep,
              completed_agents: completedAgents,
              remaining_agents: remainingAgents,
              progress_percentage: progressPercentage,
            });

            if (waitingForUser) {
              const lastExpectedInput = answers.last_expected_input || 'generic_reply';
              let questionText = "Aapke paas registry (Title deed) hai?";
              if (lastExpectedInput === 'has_fard') {
                questionText = "Fard ya inteqal available hai?";
              } else if (lastExpectedInput === 'user_problem_detail') {
                questionText = "Aap apne maslay ke baare mein thora tafseel se bata sakte hain taake hum behtar madad kar sakein?";
              }
              
              setCurrentAgentQuestion({
                question: questionText,
                expected_input: lastExpectedInput,
                agent: currentAgent,
              });
            } else {
              setCurrentAgentQuestion(null);
            }
          } else {
            setCurrentWorkflowProgress(null);
            setCurrentAgentQuestion(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch session', err);
      }
    };
    if (sessionId) fetchSession();
  }, [sessionId]);

  // 1. Initialize socket and register listeners ONCE
  useEffect(() => {
    socketClient.connect();

    // Clean up first to prevent duplicate registrations
    socketClient.off('session_created');
    socketClient.off('agent_stream');
    socketClient.off('message_done');
    socketClient.off('message_error');
    socketClient.off('agent_question');
    socketClient.off('workflow_progress');
    socketClient.off('pdf_ready');

    const onSessionCreated = (data) => {
      console.log('[Socket] session_created:', data);
      setSessionId(data.sessionId);
    };

    const onMessageStream = (data) => {
      setIsTyping(true);
      if (data.trace) {
        setAgentTrace(data.trace);
      }
      if (data.chunk) {
        setActiveStreamMessage(prev => prev + data.chunk);
      }
    };

    const onMessageDone = (data) => {
      console.log('[Socket] message_done:', data);
      setIsTyping(false);
      isSendingRef.current = false;
      setActiveStreamMessage('');
      setAgentTrace('');
      setCurrentAgentQuestion(null);
      setCurrentWorkflowProgress(null);

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
      console.log('[Socket] message_error:', data);
      setIsTyping(false);
      isSendingRef.current = false;
      setActiveStreamMessage('');
      setAgentTrace('');
      Alert.alert('Message Failed', data.error || 'Something went wrong. Please try again.');
    };

    const onAgentQuestion = (data) => {
      console.log('[Socket] agent_question:', data);
      setCurrentAgentQuestion(data);
      setIsTyping(false);
      isSendingRef.current = false;
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    };

    const onWorkflowProgress = (data) => {
      console.log('[Socket] workflow_progress:', data);
      setCurrentWorkflowProgress(data);
    };

    const onPdfReady = (data) => {
      console.log('[Socket] pdf_ready:', data);
      if (sessionId) {
        dispatch(fetchSessionMessages({ sessionId }));
      }
    };

    socketClient.on('session_created', onSessionCreated);
    socketClient.on('agent_stream', onMessageStream);
    socketClient.on('message_done', onMessageDone);
    socketClient.on('message_error', onMessageError);
    socketClient.on('agent_question', onAgentQuestion);
    socketClient.on('workflow_progress', onWorkflowProgress);
    socketClient.on('pdf_ready', onPdfReady);
    console.log('[SOCKET_LISTENER_REGISTERED] Registered all socket listeners.');

    return () => {
      socketClient.off('session_created');
      socketClient.off('agent_stream');
      socketClient.off('message_done');
      socketClient.off('message_error');
      socketClient.off('agent_question');
      socketClient.off('workflow_progress');
      socketClient.off('pdf_ready');
      console.log('[SOCKET_LISTENER_CLEANED] Deregistered all socket listeners.');
    };
  }, [dispatch, sessionId]);

  // 2. Fetch history and handle session state
  useEffect(() => {
    dispatch(clearCurrentSession());

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
    if (!inputText.trim() || isTyping || isSendingRef.current) return;
    isSendingRef.current = true;

    const tempId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const content = inputText.trim();

    console.log(`[SEND_MESSAGE] Sending message client-side: ${content} with tempId: ${tempId}`);

    // Clear active question overlay since we responded
    setCurrentAgentQuestion(null);

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
      type: 'text',
      clientMessageId: tempId
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
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        // Read file as base64
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Clear active question overlay since we responded
        setCurrentAgentQuestion(null);

        // Add optimistic user message to Redux
        const tempId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        console.log(`[SEND_MESSAGE] Sending voice message client-side with tempId: ${tempId}`);
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
          audioBase64: base64Audio,
          clientMessageId: tempId
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

      return isUser ? renderTextContent(item.content || item.text) : renderArtifact(item.content || item.text);
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

  // Deduplicate messages to ensure every message renders exactly once
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set();
    // Keep the latest version by iterating from the end if needed,
    // but Array.filter keeps the first occurrence which is fine for our oldest-first array
    return currentSessionMessages.filter(msg => {
      const id = msg._id || msg.tempId;
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [currentSessionMessages]);

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

        {/* WORKFLOW TIMELINE PROGRESS */}
        <WorkflowTimeline progress={currentWorkflowProgress} />

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
            data={[...uniqueMessages].reverse()}
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
          <View style={styles.streamingContainer}>
            {agentTrace ? (
              <View style={styles.traceBox}>
                <Ionicons name="terminal-outline" size={14} color="#00ff00" style={{ marginRight: 6 }} />
                <Text style={styles.traceText}>{agentTrace}</Text>
              </View>
            ) : null}
            {activeStreamMessage ? (
              <View style={[styles.bubble, styles.aiBubble, { alignSelf: 'flex-start', maxWidth: '85%', marginBottom: 12 }]}>
                {renderArtifact(activeStreamMessage)}
                <Text style={[styles.typingText, { marginTop: 8 }]}>Talash AI is typing...</Text>
              </View>
            ) : (
              <View style={styles.typingIndicatorContainer}>
                <Text style={styles.typingText}>
                  {currentWorkflowProgress?.current_agent
                    ? `📋 ${currentWorkflowProgress.current_agent} is analyzing your case...`
                    : 'Talash AI is thinking...'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AGENT QUESTION CARD */}
        <AgentQuestionCard questionData={currentAgentQuestion} />

        {/* BOTTOM INPUT BAR */}
        <View style={styles.bottomInputBar}>
          <TouchableOpacity style={styles.paperclipButton} onPress={handleAttachment}>
            <Ionicons name="attach" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            ref={chatInputRef}
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
            editable={(!isTyping || currentAgentQuestion !== null) && !isRecording}
            multiline
          />

          {inputText.trim().length > 0 ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.sendButton, (isTyping && currentAgentQuestion === null) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={isTyping && currentAgentQuestion === null}
            >
              <Ionicons name="send" size={18} color={colors.accent} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.micButton, isRecording && { backgroundColor: colors.error }]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={isTyping && currentAgentQuestion === null}
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
  artifactCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)', borderRadius: 12, borderWidth: 1, padding: 12, marginVertical: 6, width: '100%'
  },
  artifactHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 6 },
  artifactTitle: { fontSize: 14, fontWeight: 'bold' },
  artifactBody: { paddingTop: 4 },
  artifactText: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  pdfButton: { backgroundColor: '#5AC8FA', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 4 },
  streamingContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  traceBox: { backgroundColor: '#000000', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  traceText: { color: '#00ff00', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', flex: 1 },
  workflowContainer: {
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  workflowProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  workflowProgressText: {
    color: '#E0E0E0',
    fontSize: 12,
  },
  workflowPercentage: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  timelineScroll: {
    flexGrow: 0,
  },
  timelineContent: {
    gap: 8,
    paddingRight: 16,
  },
  timelineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  timelineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  questionCardContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionAgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  questionAgentText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  expectedInputText: {
    color: '#888888',
    fontSize: 10,
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  questionCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingText: {
    color: colors.accent,
    fontSize: 12,
    fontStyle: 'italic',
  },
  pdfRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
    width: '100%',
  },
  pdfInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pdfItemName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    paddingRight: 6,
  },
  pdfActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pdfOpenButton: {
    backgroundColor: '#5AC8FA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfDownloadButton: {
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default ChatScreen;