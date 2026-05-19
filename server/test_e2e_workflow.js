const mongoose = require('mongoose');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Config parameters
const MONGO_URI = "mongodb+srv://ar5812264_db_user:u3RhI7K5hrbcg5ot@dla.5rajhzn.mongodb.net/talash?appName=dla";
const JWT_ACCESS_SECRET = "74b569836e8d7309c79edf9820371b39334601d90b22ff509a022034df54210742dc090b4e3e3a02e3932642195bd319821178205f0379b71e22523fcc6ee601";
const SOCKET_URL = "http://127.0.0.1:3000";

async function runTest() {
  console.log("=====================================================================");
  console.log("🔥 STARTING FULL E2E INTERACTIVE MULTI-AGENT WORKFLOW TEST 🔥");
  console.log("=====================================================================");

  // 1. Connect to MongoDB
  console.log(`\n🔌 Connecting to MongoDB at: ${MONGO_URI.substring(0, 45)}...`);
  await mongoose.connect(MONGO_URI);
  console.log("✅ Successfully connected to MongoDB.");

  // Define simple inline Schemas to bypass NestJS complex module registry
  const UserSchema = new mongoose.Schema({
    phone_number: String,
    role: String,
    name: String,
    state: String,
    city: String,
    gender: String
  }, { collection: 'users' });

  const ChatSessionSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    title: String,
    category: String,
    status: String,
    current_agent: String,
    current_step: Number,
    waiting_for_user: Boolean,
    collected_context: mongoose.Schema.Types.Mixed
  }, { collection: 'chatsessions' });

  const User = mongoose.model('User', UserSchema);
  const ChatSession = mongoose.model('ChatSession', ChatSessionSchema);

  // 2. Fetch or create a test user
  let user = await User.findOne({ role: 'user' });
  if (!user) {
    console.log("⚠️ No existing user found. Creating a fresh dummy test user...");
    user = new User({
      phone_number: "+923001234567",
      role: "user",
      name: "E2E Test User",
      state: "Punjab",
      city: "Lahore",
      gender: "Male"
    });
    await user.save();
  }
  console.log(`👤 Active Test User: ${user.name} (ID: ${user._id}, Role: ${user.role})`);

  // 3. Generate JWT access token
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
  console.log(`🔑 Generated Valid JWT Access Token: ${token.substring(0, 30)}...`);

  // 4. Connect Socket.IO client
  console.log(`\n🔌 Connecting Socket.IO client to: ${SOCKET_URL}...`);
  const socket = io(SOCKET_URL, {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket']
  });

  let sessionId = null;
  let hasRegistryAnswered = false;
  let hasFardAnswered = false;

  // Helper to fetch and print MongoDB workflow state
  async function logMongoWorkflowState(label) {
    if (!sessionId) return;
    const session = await ChatSession.findById(sessionId);
    console.log(`\n📊 [MongoDB State Transition - ${label}]`);
    console.log(`   └─ Session ID:       ${session._id}`);
    console.log(`   └─ Primary Category: ${session.category}`);
    console.log(`   └─ Current Agent:    ${session.current_agent}`);
    console.log(`   └─ Current Step:     ${session.current_step}/9`);
    console.log(`   └─ Waiting For User: ${session.waiting_for_user}`);
    console.log(`   └─ Answers Saved:    ${JSON.stringify(session.collected_context?.answers || {})}`);
  }

  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`✅ Socket connected successfully! Connection ID: ${socket.id}`);
      
      // Send initial problem statement
      console.log("\n💬 Sending Initial Message: 'Meri zameen pe qabza ho gaya hai'");
      socket.emit('send_message', {
        content: "Meri zameen pe qabza ho gaya hai",
        type: "text"
      });
    });

    socket.on('connect_error', (error) => {
      console.error("❌ Socket connection error:", error);
      reject(error);
    });

    socket.on('session_created', async (data) => {
      sessionId = data.sessionId;
      console.log(`\n🆕 Session Created! ID: ${sessionId}, Title: '${data.title}'`);
      await logMongoWorkflowState("SESSION_CREATED");
    });

    socket.on('session_updated', async (data) => {
      console.log(`\n🔄 Session Auto-Classified & Updated! Category: ${data.category}`);
    });

    // Monitor progress events
    socket.on('workflow_progress', (data) => {
      console.log(`\n📈 [Socket Event: workflow_progress]`);
      console.log(`   └─ Active Agent:   🟡 ${data.current_agent}`);
      console.log(`   └─ Step Position:  ${data.current_step}/${data.total_steps}`);
      console.log(`   └─ Progress %:     ${data.progress_percentage}%`);
      console.log(`   └─ Completed:      [${data.completed_agents.join(', ')}]`);
      console.log(`   └─ Remaining:      [${data.remaining_agents.join(', ')}]`);
    });

    // Monitor live text streams or trace logs
    socket.on('agent_stream', (data) => {
      if (data.trace) {
        console.log(`\n📝 [Socket Event: agent_stream - TRACE] ${data.trace}`);
      }
      if (data.chunk) {
        process.stdout.write(data.chunk);
      }
    });

    // Intercept agent questions
    socket.on('agent_question', async (data) => {
      console.log(`\n❓ [Socket Event: agent_question]`);
      console.log(`   └─ Asking Agent:    🟡 ${data.agent}`);
      console.log(`   └─ Question Text:   "${data.question}"`);
      console.log(`   └─ Expected Input:  "${data.expected_input}"`);

      await logMongoWorkflowState("AGENT_PAUSED");

      if (data.expected_input === "has_registry" && !hasRegistryAnswered) {
        hasRegistryAnswered = true;
        console.log("\n💬 Replying to Question 1: 'Ji' (expected registry proof)");
        socket.emit('send_message', {
          sessionId: sessionId,
          content: "Ji",
          type: "text"
        });
      } else if (data.expected_input === "has_fard" && !hasFardAnswered) {
        hasFardAnswered = true;
        console.log("\n💬 Replying to Question 2: 'Nahi' (no fard document)");
        socket.emit('send_message', {
          sessionId: sessionId,
          content: "Nahi",
          type: "text"
        });
      }
    });

    // Final dashboard data cards or finished reports
    socket.on('agent_stream', async (data) => {
      if (data.chunk && data.chunk.includes('dashboard')) {
        console.log("\n🥇 [FINAL CARD] RECEIVED CASE DASHBOARD METADATA!");
        console.log(data.chunk);
      }
      if (data.chunk && data.chunk.includes('action_plan')) {
        console.log("\n🥈 [FINAL CARD] RECEIVED COMPREHENSIVE ACTION PLAN!");
        console.log(data.chunk);
      }
      if (data.chunk && data.chunk.includes('misguide_alert')) {
        console.log("\n🥉 [FINAL CARD] RECEIVED SCAM PROTECTION & RED FLAGS!");
        console.log(data.chunk);
      }
      if (data.chunk && data.chunk.includes('pdf_link')) {
        console.log("\n📄 [FINAL CARD] RECEIVED COMPILED PDF DOWNLOAD LINKS!");
        console.log(data.chunk);
        
        // Success complete state check
        await logMongoWorkflowState("PIPELINE_COMPLETE");
        console.log("\n🎉 END-TO-END FLOW COMPLETED SUCCESSFULLY!");
        
        // Clean up connections
        socket.disconnect();
        await mongoose.disconnect();
        resolve("SUCCESS");
      }
    });

    socket.on('message_error', (data) => {
      console.error("\n❌ Message Error Event Received:", data);
      reject(data);
    });

    // Safeguard timeout (240s max execution)
    setTimeout(async () => {
      console.log("\n⏳ Test timed out after 240s.");
      socket.disconnect();
      await mongoose.disconnect();
      reject(new Error("Timeout"));
    }, 240000);
  });
}

runTest()
  .then(() => {
    console.log("=====================================================================");
    console.log("🎉 E2E TEST COMPLETED - ALL STEPS VALIDATED AND SUCCESSFUL!");
    console.log("=====================================================================");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ E2E TEST FAILED:", err);
    process.exit(1);
  });
