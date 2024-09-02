// Load environment variables from .env file
require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is missing");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require('fs'); // Import fs module
const path = require('path');
const OpenAI = require("openai");

// Construct file path
const filePath = path.join(__dirname, 'Sample.docx');

// Verify if the file exists (optional, for debugging)
fs.access(filePath, fs.constants.F_OK, (err) => {
  if (err) {
    console.error(`File does not exist: ${filePath}`);
  } else {
    console.log(`File exists: ${filePath}`);
  }
});

// Initialize OpenAI with the API key from the .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use pre-existing assistant ID from environment variable
const ASSISTANT_ID = process.env.ASSISTANT_ID;

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Route for the root URL
app.get("/", (req, res) => {
  res.send("Welcome to the server!");
});

// Add the /start route
app.get("/start", async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    return res.json({ thread_id: thread.id });
  } catch (error) {
    console.error("Error creating thread:", error);
    return res.status(500).json({ error: "Failed to create thread" });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { thread_id, message } = req.body;

    if (!thread_id || !message) {
      return res.status(400).json({ error: "Missing thread_id or message" });
    }

    console.log(`Received message: ${message} for thread ID: ${thread_id}`);

    // Ensure these calls are correct and properly implemented
    await openai.beta.threads.messages.create(thread_id, {
      role: "user",
      content: message,
    });

    const run = await openai.beta.threads.runs.createAndPoll(thread_id, {
      assistant_id: ASSISTANT_ID,
    });

    const messages = await openai.beta.threads.messages.list(run.thread_id);
    const response = messages.data[0].content[0].text.value;
    return res.json({ response });
  } catch (error) {
    console.error("Error in /chat endpoint:", error);
    return res.status(500).json({ error: "Failed to handle chat", details: error.message });
  }
});

app.listen(8080, () => {
  console.log("Server running on port 8080");
});