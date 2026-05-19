const mongoose = require('mongoose');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Config parameters
const MONGO_URI = "mongodb+srv://ar5812264_db_user:u3RhI7K5hrbcg5ot@dla.5rajhzn.mongodb.net/talash?appName=dla";
const JWT_ACCESS_SECRET = "74b569836e8d7309c79edf9820371b39334601d90b22ff509a022034df54210742dc090b4e3e3a02e3932642195bd319821178205f0379b71e22523fcc6ee601";
const SOCKET_URL = "http://127.0.0.1:3000";

async function runTest() {
  console.log("=====================================================================");
  console.log("🔥 STARTING FULL E2E DYNAMIC INVESTIGATION WORKFLOW TEST 🔥");
  console.log("=====================================================================");

  // 1. Connect to MongoDB
  console.log(`\n🔌 Connecting to MongoDB at: ${MONGO_URI.substring(0, 45)}...`);
  await mongoose.connect(MONGO_URI);
  console.log("✅ Successfully connected to MongoDB.");

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

  const User = mongoose.model('UserDynamic', UserSchema);
  const ChatSession = mongoose.model('ChatSessionDynamic', ChatSessionSchema);

  // 2. Fetch or create a test user
  let user = await User.findOne({ role: 'user' });
  if (!user) {
    user = new User({
      phone_number: "+923009999999",
      role: "user",
      name: "Ahmed Ali",
      state: "Punjab",
      city: "Lahore",
      gender: "Male"
    });
    await user.save();
  }
  console.log(`👤 Active Test User: ${user.name} (ID: ${user._id})`);

  // 3. Generate JWT access token
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );

  // 4. Connect Socket.IO client
  const socket = io(SOCKET_URL, {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket']
  });

  let sessionId = null;
  let dynamicQuestionCount = 0;
  let hasRegistryAnswered = false;
  let hasFardAnswered = false;

  async function logMongoWorkflowState(label) {
    if (!sessionId) return;
    const session = await ChatSession.findById(sessionId);
    console.log(`\n📊 [MongoDB State Transition - ${label}]`);
    console.log(`   └─ Agent:          ${session.current_agent}`);
    console.log(`   └─ Step:           ${session.current_step}/9`);
    console.log(`   └─ Waiting User:   ${session.waiting_for_user}`);
    console.log(`   └─ Memory Answers: ${JSON.stringify(session.collected_context?.investigation_memory?.answered_topics || {})}`);
    console.log(`   └─ Doc Answers:    ${JSON.stringify(session.collected_context?.answers?.DocumentChecker || {})}`);
  }

  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`✅ Socket connected! ID: ${socket.id}`);
      console.log("\n💬 Sending Initial Message: 'Meri zameen pe qabza ho gaya hai'");
      socket.emit('send_message', {
        content: "Meri zameen pe qabza ho gaya hai",
        type: "text"
      });
    });

    socket.on('connect_error', (error) => {
      console.error("❌ Socket error:", error);
      reject(error);
    });

    socket.on('session_created', async (data) => {
      sessionId = data.sessionId;
      console.log(`🆕 Session Created! ID: ${sessionId}`);
    });

    socket.on('workflow_progress', (data) => {
      console.log(`📈 [Progress] Active: 🟡 ${data.current_agent} | Step: ${data.current_step}/${data.total_steps} | Completed: [${data.completed_agents.join(', ')}]`);
    });

    socket.on('agent_stream', (data) => {
      if (data.trace) {
        console.log(`📝 [Trace] ${data.trace}`);
      }
      if (data.chunk) {
        process.stdout.write(data.chunk);
      }
    });

    socket.on('agent_question', async (data) => {
      console.log(`\n❓ [Socket Event: agent_question]`);
      console.log(`   ├─ Asking Agent:          🟡 ${data.agent}`);
      console.log(`   ├─ Question:              "${data.question}"`);
      console.log(`   ├─ Expected Information:  "${data.expected_information}"`);
      console.log(`   ├─ Reason:                "${data.reason}"`);
      console.log(`   └─ Priority:              "${data.priority}"`);

      await logMongoWorkflowState("AGENT_PAUSED");

      // Handle dynamic questions from QuestioningAgent
      if (data.agent === "QuestioningAgent") {
        dynamicQuestionCount++;
        if (dynamicQuestionCount === 1) {
          console.log("\n💬 [Reply 1] Doh saal se qabza hai aur boundaries wahan bani hui hain.");
          socket.emit('send_message', {
            sessionId: sessionId,
            content: "Doh saal se qabza hai aur boundaries wahan bani hui hain",
            type: "text"
          });
        } else if (dynamicQuestionCount === 2) {
          console.log("\n💬 [Reply 2] Mera koi rishtedar nahi hai, ye anjaan log hain.");
          socket.emit('send_message', {
            sessionId: sessionId,
            content: "Mera koi rishtedar nahi hai, ye anjaan log hain",
            type: "text"
          });
        }
      } 
      // Handle static/doc check pauses
      else if (data.agent === "DocumentChecker") {
        if (data.expected_input === "has_registry" && !hasRegistryAnswered) {
          hasRegistryAnswered = true;
          console.log("\n💬 [Reply 3] Ji");
          socket.emit('send_message', {
            sessionId: sessionId,
            content: "Ji",
            type: "text"
          });
        } else if (data.expected_input === "has_fard" && !hasFardAnswered) {
          hasFardAnswered = true;
          console.log("\n💬 [Reply 4] Nahi");
          socket.emit('send_message', {
            sessionId: sessionId,
            content: "Nahi",
            type: "text"
          });
        }
      }
    });

    socket.on('agent_stream', async (data) => {
      if (data.chunk && data.chunk.includes('pdf_link')) {
        console.log("\n📄 [FINAL CARD] RECEIVED COMPILED PDF DOWNLOAD LINKS!");
        await logMongoWorkflowState("PIPELINE_COMPLETE");
        console.log("\n🎉 END-TO-END FLOW COMPLETED SUCCESSFULLY!");
        
        socket.disconnect();
        await mongoose.disconnect();
        resolve("SUCCESS");
      }
    });

    socket.on('message_error', (data) => {
      console.error("\n❌ Error:", data);
      reject(data);
    });

    // Safeguard timeout (240s max execution)
    setTimeout(async () => {
      console.log("\n⏳ Test timed out.");
      socket.disconnect();
      await mongoose.disconnect();
      reject(new Error("Timeout"));
    }, 240000);
  });
}

runTest()
  .then(() => {
    console.log("\n=====================================================================");
    console.log("🎉 E2E DYNAMIC INVESTIGATION WORKFLOW VALIDATED AND SUCCESSFUL!");
    console.log("=====================================================================");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ E2E TEST FAILED:", err);
    process.exit(1);
  });
