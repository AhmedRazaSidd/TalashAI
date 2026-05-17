import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosClient from '../../api/axiosClient';

export const fetchSessions = createAsyncThunk(
  'chat/fetchSessions',
  async ({ page = 1, limit = 20, forLawyer = false } = {}, { rejectWithValue }) => {
    try {
      // Lawyers see all unclaimed active sessions; users see their own
      const url = forLawyer ? '/chat/sessions/available' : '/chat/sessions';
      const response = await axiosClient.get(url, { params: { page, limit } });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch sessions');
    }
  }
);

export const fetchSessionMessages = createAsyncThunk(
  'chat/fetchSessionMessages',
  async ({ sessionId, limit = 20, cursor } = {}, { rejectWithValue }) => {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      
      const response = await axiosClient.get(`/chat/sessions/${sessionId}/messages`, { params });
      return { sessionId, data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
    }
  }
);

export const createSession = createAsyncThunk(
  'chat/createSession',
  async ({ category, title }, { rejectWithValue }) => {
    try {
      const response = await axiosClient.post('/chat/sessions', { category, title });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create session');
    }
  }
);

export const toggleBookmark = createAsyncThunk(
  'chat/toggleBookmark',
  async ({ messageId }, { rejectWithValue }) => {
    try {
      const response = await axiosClient.patch(`/chat/messages/${messageId}/bookmark`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle bookmark');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    sessions: [],
    currentSessionMessages: [],
    nextCursor: null,
    hasMoreMessages: true,
    loadingSessions: false,
    loadingMessages: false,
    error: null,
  },
  reducers: {
    addMessageToSession: (state, action) => {
      // Push to END — inverted FlatList renders end as bottom of screen
      state.currentSessionMessages.push(action.payload);
    },
    clearCurrentSession: (state) => {
      state.currentSessionMessages = [];
      state.nextCursor = null;
      state.hasMoreMessages = true;
    },
    updateMessageStatus: (state, action) => {
      // Used to update a temporary user message with actual data once AI responds
      const { tempId, updatedMsg } = action.payload;
      const index = state.currentSessionMessages.findIndex(m => m._id === tempId || m.tempId === tempId);
      if (index !== -1) {
        state.currentSessionMessages[index] = { ...state.currentSessionMessages[index], ...updatedMsg };
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Sessions
      .addCase(fetchSessions.pending, (state) => {
        state.loadingSessions = true;
        state.error = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.loadingSessions = false;
        state.sessions = action.payload.data;
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.loadingSessions = false;
        state.error = action.payload;
      })
      // Fetch Messages
      .addCase(fetchSessionMessages.pending, (state) => {
        state.loadingMessages = true;
        state.error = null;
      })
      .addCase(fetchSessionMessages.fulfilled, (state, action) => {
        state.loadingMessages = false;
        const newMessages = action.payload.data.data || [];

        if (action.meta.arg.cursor) {
          // Older messages (pagination) prepend to the beginning
          state.currentSessionMessages = [...newMessages, ...state.currentSessionMessages];
        } else {
          // Fresh load — chronological order (oldest→newest), inverted FlatList shows newest at bottom
          state.currentSessionMessages = newMessages;
        }

        state.nextCursor = action.payload.data.meta?.nextCursor || null;
        state.hasMoreMessages = !!action.payload.data.meta?.nextCursor;
      })
      .addCase(fetchSessionMessages.rejected, (state, action) => {
        state.loadingMessages = false;
        state.error = action.payload;
      })
      // Toggle Bookmark
      .addCase(toggleBookmark.fulfilled, (state, action) => {
        const updatedMsg = action.payload;
        const index = state.currentSessionMessages.findIndex(m => m._id === updatedMsg._id);
        if (index !== -1) {
          state.currentSessionMessages[index].isBookmarked = updatedMsg.isBookmarked;
        }
      });
  }
});

export const { addMessageToSession, clearCurrentSession, updateMessageStatus } = chatSlice.actions;
export default chatSlice.reducer;
