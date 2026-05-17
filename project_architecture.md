# Talash AI Legal Platform — System Architecture & Scope

Talash is a sophisticated, dual-sided legal consultation platform designed specifically for the Pakistani legal ecosystem. It leverages Artificial Intelligence to provide instant legal guidance to victims while offering a marketplace for professional lawyers to provide expert consultations.

---

## 1. Project Scope & Overview

Talash aims to bridge the gap between victims and legal aid. The project scope includes:
- **Instant AI Legal Intake:** A specialized AI expert in Pakistani Law.
- **Document Analysis (RAG):** AI capability to "read" and analyze legal documents (registries, notices, etc.).
- **Lawyer Marketplace:** A verified portal for lawyers to claim and manage cases.
- **Modern Communication:** Full support for real-time text, voice notes, and file sharing.
- **Case Management:** Archiving, search, and categorization of legal disputes.

---

## 2. Technology Stack

### **Frontend (Mobile App)**
- **Framework:** React Native (Expo)
- **State Management:** Redux Toolkit
- **Navigation:** React Navigation (Stack, Tabs, Drawer)
- **UI Components:** React Native Paper + Custom Vanilla CSS
- **Real-time:** Socket.io-client
- **Internationalization:** i18next (English & Urdu support)
- **Typography:** Noto Nastaliq Urdu (Premium calligraphy)

### **Backend (Server)**
- **Framework:** NestJS (Node.js)
- **Database:** MongoDB (via Mongoose)
- **Real-time Engine:** Socket.io (WebSockets)
- **File Storage:** Cloudinary (Images, PDF, Audio)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Security:** Passport.js + JWT (Access/Refresh token rotation)

### **AI Infrastructure**
- **Engine:** Custom Python-based AI API wrapper (LLM-agnostic)
- **Memory:** Session-based context + Vectorized document context (RAG)
- **Personality:** Specialized in Pakistani PPC, CPC, and Family Laws.

---

## 3. System Architecture

### **A. Authentication & Security**
The system uses a multi-layered security approach:
1. **User/Lawyer Roles:** Defined at signup, controlling access to the Marketplace.
2. **JWT Flow:** Secured via Access Tokens (short-lived) and Refresh Tokens (long-lived).
3. **Guard Layers:** Every API and WebSocket event is protected by a JWT Guard.

### **B. The Hybrid Chat Flow**
This is the core logic of Talash:
1. **Intake Mode:** A user creates a case (e.g., "Property Dispute"). They interact with the **Talash AI**.
2. **Document RAG:** The user uploads documents. The backend uploads them to Cloudinary and passes the context to the AI Service.
3. **Escalation:** When the user needs a human, the case status changes to `waiting_for_lawyer`.
4. **Marketplace:** Lawyers see the case in their feed. Once "Claimed," the `lawyerId` is linked to the session.
5. **Human Consultation:** The chat transitions to a Human-to-Human mode, though the AI history remains visible to the lawyer for context.

### **C. Notification System**
- **Device Sync:** On login, the mobile app registers its FCM Token to the backend.
- **Triggered Alerts:** When a lawyer or the AI sends a message, the backend triggers a push notification via the `NotificationService`.

---

## 4. Database Structure (Key Schemas)

- **User:** Stores profile, role (user/lawyer), professional credentials (license ID), and FCM tokens.
- **ChatSession:** The container for a case. Stores the title, category (Property, Family, etc.), victim ID, lawyer ID, and status (Active, Resolved).
- **Message:** The atomic unit of communication. Stores role (user, assistant, lawyer), content, type (text, voice, attachment), and status (sent, delivered, read).
- **Notification:** A history of all push alerts sent to a user.

---

## 5. Directory Structure

### **Server (NestJS)**
```text
/src
  /modules
    /auth         # Login, Signup, Token logic
    /user         # Profile, Admin User Mgmt, Lawyer Details
    /chat         # Gateways, Sessions, Messages, AI Integration
    /notification # Firebase FCM integration
    /cloudinary   # Media upload handlers
```

### **App (React Native)**
```text
/src
  /api            # Axios clients and Push Notification utils
  /store          # Redux slices (auth, chat, ui)
  /navigation     # Stack and Tab definitions
  /screens        # Functional screens (HomeScreen, ChatScreen, etc.)
  /components     # Reusable UI (Bubble, Input, Button)
  /i18n           # Translation files (en, ur)
```

---

## 6. Summary of Operation
1. **Onboarding:** User/Lawyer signs up. License verification requested for lawyers.
2. **Case Creation:** User describes their problem and uploads evidence.
3. **AI Consultation:** AI analyzes files and provides legal advice based on Pakistani law.
4. **Professional Handover:** Lawyer claims the case from the public feed.
5. **Resolution:** Lawyer and User chat until the case is marked as "Resolved."
6. **Persistence:** All chats are archived and searchable for future reference.
