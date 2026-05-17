# Talash AI — Complete Project Scope

> **Last Updated:** May 2026  
> **Status:** Active Development — Sprint 1 Complete

---

## 1. What Is Talash AI?

**Talash AI** is a Pakistani legal marketplace and AI assistant platform. It connects citizens with verified lawyers and provides AI-powered legal guidance based on Pakistani law (PPC, CPC, Family Law, Property Law, etc.).

The system has three distinct user roles:
- **Victim/User** — A citizen seeking legal help
- **Lawyer** — A verified legal professional offering consultations
- **Admin** — A system operator who manages the platform via the backend API

---

## 2. System Architecture

```
┌─────────────────────────────────────────┐
│           React Native (Expo)           │
│            Mobile Application           │
│  iOS · Android · Physical · Emulator    │
└──────────────────┬──────────────────────┘
                   │ HTTP (axiosClient)
                   │ WebSocket (socketClient)
                   ▼
┌─────────────────────────────────────────┐
│         NestJS REST + WebSocket         │
│           Backend (Port 3000)           │
│   JWT Auth · Guards · Swagger Docs      │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌────────────────┐   ┌────────────────────┐
│  MongoDB Atlas │   │  External Services │
│  (Mongoose)    │   │  · Cloudinary CDN  │
│                │   │  · Firebase FCM    │
│                │   │  · Python AI API   │
└────────────────┘   └────────────────────┘
```

**Key Infrastructure:**
- **Backend:** NestJS (TypeScript), running on Node.js
- **Database:** MongoDB Atlas via Mongoose ODM
- **Mobile:** Expo / React Native
- **State:** Redux Toolkit (`authSlice`, `chatSlice`, `casesSlice`)
- **Real-time:** Socket.IO (WebSocket) for live chat
- **File Storage:** Cloudinary (avatars, attachments, voice messages)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **AI Engine:** Python microservice (external API) — Talash AI language model

---

## 3. Backend Modules (11 Total)

### 3.1 `AuthModule`
**Route prefix:** `/auth`

| Endpoint | Description |
|----------|-------------|
| `POST /auth/signup` | Register as user or lawyer |
| `POST /auth/login` | Authenticate and receive JWT token |

- JWT-based stateless authentication
- `bcrypt` password hashing at registration
- Tokens stored in `AsyncStorage` on the mobile client
- `JwtAuthGuard` protects all private routes
- `RolesGuard` enforces role-based access (user / lawyer / admin)

---

### 3.2 `UserModule`
**Route prefixes:** `/profile`, `/lawyers`, `/admin/users`, `/seed`

#### Profile Controller (`/profile`)
| Endpoint | Description |
|----------|-------------|
| `GET /profile` | Get current user's profile |
| `PATCH /profile` | Update name, city, state |
| `PATCH /profile/settings` | Update app preferences (e.g., `voiceResponseMode`) |
| `POST /profile/avatar` | Upload avatar to Cloudinary |
| `POST /profile/change-password` | Change password with `bcrypt` verification |

#### Lawyers Controller (`/lawyers`)
| Endpoint | Description |
|----------|-------------|
| `GET /lawyers` | List all verified lawyers (filter by sort, specialization, search) |
| `GET /lawyers/:id` | Get full lawyer profile with embedded reviews |
| `POST /lawyers/:id/reviews` | Submit a review for a lawyer |

#### Admin User Controller (`/admin/users`)
| Endpoint | Description |
|----------|-------------|
| `GET /admin/users` | Paginated list of all users |
| `GET /admin/users/:id` | Get a specific user |
| `PATCH /admin/users/:id` | Update user (verify, ban, change role) |
| `DELETE /admin/users/:id` | Delete user (cascading — removes chats, messages, reviews) |

#### Seed Controller (`/seed`)
| Endpoint | Description |
|----------|-------------|
| `POST /seed` | Wipes and re-seeds the database with dummy data (dev only) |

**Seed creates:** Categories, Lawyers, Victims, FAQs

---

### 3.3 `ChatModule`
**Route prefix:** `/chat`  
**Real-time:** Socket.IO Gateway

This is the core module of the platform.

#### REST Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /chat/categories` | Fetch all legal case categories |
| `POST /chat/sessions` | Create a new chat session |
| `GET /chat/sessions` | Get current user's sessions (paginated) |
| `GET /chat/sessions/:id` | Get a single session by ID |
| `PATCH /chat/sessions/:id` | Update session (status, title, category) |
| `GET /chat/sessions/:id/messages` | Get session messages (cursor-paginated) |
| `GET /chat/sessions/:id/summary` | Get AI-generated case summary |
| `GET /chat/sessions/:id/media` | Get all file attachments in a session |
| `GET /chat/sessions/:id/bookmarks` | Get all bookmarked messages |
| `POST /chat/sessions/:id/attachments` | Upload a file to a session (Cloudinary) |
| `POST /chat/sessions/:id/takeover` | Lawyer takes over from AI |
| `POST /chat/sessions/:id/claim` | Lawyer claims a session |
| `PATCH /chat/messages/:id/bookmark` | Toggle bookmark on a message |

#### WebSocket Events (Socket.IO)
| Direction | Event | Description |
|-----------|-------|-------------|
| Client → Server | `send_message` | Send a text message |
| Client → Server | `voice_message` | Send a base64 voice recording |
| Client → Server | `join_session` | Join a session room |
| Server → Client | `message_chunk` | Streamed AI response token |
| Server → Client | `message_done` | Full AI response complete (with optional `audioUrl`) |
| Server → Client | `session_created` | Emitted when a new session is auto-created |
| Server → Client | `message_error` | Error in AI processing |

#### AI Pipeline (per message)
1. User sends message via socket
2. `ChatGateway` receives, saves message to DB
3. Calls `AiService.streamTextResponse()` with full conversation history
4. `AiService` proxies to **Python AI API** (streaming HTTP)
5. Each token is emitted back as `message_chunk` for real-time display
6. When complete, `message_done` is emitted with the full message
7. If `voiceResponseMode = 'audio'`, the response is also synthesized to audio and uploaded to Cloudinary, with the `audioUrl` attached to `message_done`

#### Session Statuses
| Status | Meaning |
|--------|---------|
| `active` | Being handled by AI |
| `with_lawyer` | A lawyer has taken over |
| `resolved` | Case closed by lawyer |

---

### 3.4 `FaqModule`
**Route prefix:** `/faq`

| Endpoint | Description |
|----------|-------------|
| `GET /faq` | Public — fetch all active FAQs (used in Support screen) |
| Admin routes | Create, update, delete, reorder FAQs |

**Schema fields:** `question`, `answer`, `isActive`, `order`

---

### 3.5 `FeedbackReportModule`
**Route prefixes:** `/feedback`, `/reports`

| Endpoint | Description |
|----------|-------------|
| `POST /feedback` | Submit app feedback (bug / feature / other) |
| `POST /reports` | Report a user or message |
| Admin routes | View all feedback and reports |

---

### 3.6 `NotificationModule`
**Route prefix:** `/notifications`

| Endpoint | Description |
|----------|-------------|
| `GET /notifications` | Get current user's notifications |
| Admin routes | Send push notifications (to user or all) |

- Uses **Firebase Cloud Messaging (FCM)** for push delivery
- Saves notification history to MongoDB
- Supports `targetType`: `user` (specific user) or `all` (broadcast)

---

### 3.7 `SubscriptionPlanModule`
**Route prefix:** `/subscription-plans`

| Endpoint | Description |
|----------|-------------|
| `GET /subscription-plans` | Get all active plans (public) |
| Admin routes | Create, update, delete plans |

**Schema fields:** `name`, `price`, `features[]`, `durationDays`, `isActive`

> Plans are defined but payment integration is not yet wired to a payment gateway.

---

### 3.8 `AppConfigModule`
**Route prefix:** `/app-config`

Provides a centralized, hot-reloadable configuration store for the entire platform. Seeded automatically on startup.

| Config Key | Default | Description |
|------------|---------|-------------|
| `ai_system_prompt` | Legal AI prompt | The base instruction for Talash AI |
| `max_messages_per_day` | 100 | Rate limit per user |
| `max_voice_per_day` | 50 | Voice message rate limit |
| `maintenance_mode` | false | Puts the app in read-only mode |
| `force_update` | false | Forces mobile app to update |
| `min_app_version` | 1.0.0 | Minimum allowed app version |

---

### 3.9 `AnalyticsModule`
**Route prefix:** `/admin/analytics`

Admin-only dashboard metrics:
- Total users, sessions, messages
- Messages-per-day activity graph (last 7 days)
- Message type distribution (text vs. voice vs. attachment)

---

### 3.10 `CloudinaryModule`
Not directly routable — an internal service consumed by other modules.

- Handles image and file uploads (avatars, attachments, voice audio)
- Returns `secure_url` for CDN-hosted assets
- Used by: `ProfileController`, `ChatController` (attachments), `AiService` (voice synthesis)

---

### 3.11 `BookmarkModule`
An internal concern managed via the Chat module.

- Messages can be long-press bookmarked in the chat UI
- Bookmarks persist in MongoDB on the `Message` document (`isBookmarked: boolean`)
- Retrievable via `GET /chat/sessions/:id/bookmarks`
- Viewable in `ChatDetailsScreen` under the "Bookmarks" tab

---

## 4. Mobile Application — 14 Screens

### Auth Flow
| Screen | Description |
|--------|-------------|
| `SplashScreen` | Logo animation on launch, auto-navigates based on auth state |
| `LoginScreen` | Phone number + password login → JWT stored in AsyncStorage |
| `SignupScreen` | Register as user or lawyer with role-specific fields |

### Main App (Tab Navigation)
| Tab | Screen | Description |
|-----|--------|-------------|
| Home | `HomeScreen` | Lists active chat sessions; lawyers see claimable cases |
| Chat | `ChatScreen` | Full AI chat with real-time socket, voice, attachments |
| Explore | `LawyerListScreen` | Marketplace — browse and filter verified lawyers |
| Profile | `ProfileScreen` | Account hub with settings menu |

### Stack Screens (Pushed)
| Screen | Description |
|--------|-------------|
| `ChatDetailsScreen` | Tabbed view: Media & Docs, Links, Bookmarks for a session |
| `LawyerProfileScreen` | Full lawyer profile with stats, specializations, reviews, consultation button |
| `CreateCaseScreen` | Create a new legal case/session with category selection |
| `EditProfileScreen` | Edit name, city, state, upload avatar |
| `SecuritySettingsScreen` | Change password + AI voice mode toggle |
| `SupportScreen` | Live FAQ (from DB) + feedback submission form |
| `ArchiveScreen` | Archived/resolved chat sessions |

---

## 5. State Management (Redux Toolkit)

| Slice | Manages |
|-------|---------|
| `authSlice` | JWT token, user object, login/logout/signup thunks |
| `chatSlice` | Sessions list, current session messages, bookmarks, loading states |
| `casesSlice` | Case metadata (minimal, currently a stub) |

---

## 6. End-to-End User Flows

### Flow A: User Gets Legal Help (AI)
```
Signup → Login → HomeScreen → "New Chat"
→ Select Category → ChatScreen
→ Sends message → WebSocket → NestJS Gateway
→ AiService calls Python AI → Streams response back
→ User sees response token-by-token
→ [Optional] Upload document → AI analyzes via OCR
→ [Optional] Voice message → AI responds with audio
```

### Flow B: User Hires a Lawyer
```
Explore Tab → LawyerListScreen
→ Filter by specialization/rating/city
→ Tap lawyer → LawyerProfileScreen
→ "Start Consultation" → Creates session → Opens ChatScreen
→ Lawyer claims the session via HomeScreen
→ Lawyer takes over (status: with_lawyer)
→ Direct conversation in same ChatScreen
→ Lawyer marks case resolved
```

### Flow C: Lawyer Workflow
```
Login as lawyer → HomeScreen
→ Sees unclaimed sessions available
→ Claims a session → Status: with_lawyer
→ Converses with user in ChatScreen
→ Can request AI summary of the conversation (Σ button)
→ Marks case as resolved (✓ button)
```

### Flow D: Admin Workflow (API-only)
```
POST /auth/login (admin credentials)
→ GET /admin/users — monitor platform users
→ POST /notifications — send broadcast or targeted push
→ GET /admin/analytics — view dashboard metrics
→ PATCH /app-config — update AI prompt, toggle maintenance mode
→ CRUD /subscription-plans — manage plans
→ GET /admin/feedback — review user reports
```

---

## 7. Security & Infrastructure

| Concern | Implementation |
|---------|----------------|
| Authentication | JWT (stateless), stored in AsyncStorage |
| Password Storage | `bcrypt` (salt rounds: 10) |
| Route Protection | `JwtAuthGuard` on all private routes |
| Role Enforcement | `RolesGuard` — user / lawyer / admin |
| Input Validation | `class-validator` DTOs on all endpoints |
| File Security | Cloudinary signed uploads |
| Socket Auth | JWT passed in socket `auth` handshake |
| Cascading Deletion | Deleting a user removes all their chats, messages, and reviews |

---

## 8. Known Gaps & Next Steps

> [!IMPORTANT]
> These are features built into the architecture but not yet fully wired end-to-end.

| Gap | Status |
|-----|--------|
| Payment Gateway | `SubscriptionPlan` schema exists, no payment processor integrated |
| FCM Push Tokens | `FirebaseService` sends notifications but device FCM tokens not collected from mobile yet |
| Real Python AI URL | `PYTHON_AI_API_URL` must be set in `.env` for AI responses to work |
| Admin Dashboard UI | All admin APIs are live; no web admin panel exists |
| Strict Validation | `forbidNonWhitelisted: false` in `main.ts` — should be re-enabled after payload audit |
| `min_app_version` Enforcement | Config key exists but mobile app doesn't check it on startup |
| Profile `voiceResponseMode` | Toggle works; AI actually uses it in `AiService` to decide whether to generate audio |

---

## 9. Development Tools

| Tool | Purpose |
|------|---------|
| `POST /seed` | Wipe and re-seed DB with test users, lawyers, categories, FAQs |
| Swagger UI | Auto-generated at `http://localhost:3000/api` |
| `npm run start:dev` | NestJS hot-reload server |
| `npx expo start` | Expo dev server with Metro bundler |
