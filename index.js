require('dotenv').config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { OpenAI } = require("openai");
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Validate environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'ASSISTANT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is missing`);
    process.exit(1);
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;
const app = express();

// Configure CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type,Authorization',
};
app.use(cors(corsOptions));

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
app.use(express.json());

// File path operations
const filePath = path.join(__dirname, 'Sample.docx');
(async () => {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    console.log(`File exists: ${filePath}`);
  } catch (err) {
    console.error(`File does not exist: ${filePath}`);
  }
})();

app.get("/", (req, res) => {
  res.send("Welcome to the PEC.UP AI chatbot server!");
});

app.get("/start", async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    return res.json({ thread_id: thread.id });
  } catch (error) {
    console.error("Error creating thread:", error);
    return res.status(500).json({ error: "Failed to create thread", details: error.message });
  }
});

app.post("/chat", async (req, res) => {
    const { thread_id, message } = req.body;
    if (!thread_id || !message) {
      console.log("Error: Missing thread_id or message");
      return res.status(400).json({ error: "Missing thread_id or message" });
    }
    console.log(`Received message: ${message} for thread ID: ${thread_id}`);
  
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 9500) // 8.5 seconds timeout
    );
  
    const chatPromise = async () => {
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: message,
      });
  
      const run = await openai.beta.threads.runs.createAndPoll(thread_id, {
        assistant_id: ASSISTANT_ID,
      });
  
      const messages = await openai.beta.threads.messages.list(run.thread_id);
      return messages.data[0].content[0].text.value;
    };
  
    try {
      const response = await Promise.race([chatPromise(), timeoutPromise]);
      console.log("Chat response:", { response }); // Log the response
      return res.json({ response });
    } catch (error) {
      console.error("Error or timeout in /chat endpoint:", error);
      let responseObj;
      if (error.message === 'Timeout') {
        responseObj = {
          response: "I'm still processing your request. Please try again in a few seconds."
        };
      } else {
        responseObj = { error: "Failed to handle chat", details: error.message };
      }
      console.log("Error response:", responseObj); // Log the error response
      return res.status(error.message === 'Timeout' ? 200 : 500).json(responseObj);
    }
  });

const server = http.createServer(app);
server.timeout = 9000; // 9 seconds timeout

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// For Vercel deployment
module.exports = app;