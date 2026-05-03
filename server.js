// ==========================
// 1. IMPORTS
// ==========================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const axios = require("axios");

// ==========================
// 2. ENSURE UPLOAD FOLDER
// ==========================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ==========================
// 3. DEBUG ENV
// ==========================
console.log("👉 GROQ KEY LOADED:", !!process.env.GROQ_API_KEY);

// ==========================
// 4. APP SETUP
// ==========================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// 5. MULTER SETUP
// ==========================
const upload = multer({ dest: uploadDir });

// ==========================
// 6. PORT
// ==========================
const PORT = process.env.PORT || 5000;

// ==========================
// 7. HEALTH CHECK (IMPORTANT)
// ==========================
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ==========================
// 8. REWRITE API
// ==========================
app.post("/api/rewrite", (req, res) => {
  try {
    const { text, tone } = req.body;

    if (!text || !tone) {
      return res.status(400).json({ error: "Text and tone are required" });
    }

    const rewrittenText = simulateAIRewrite(text, tone);
    res.json({ rewrittenText });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ==========================
// 9. UPLOAD + PDF + AI
// ==========================
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  let filePath = "";

  try {
    console.log("📥 Upload request received");

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    filePath = req.file.path;
    console.log("📄 File received:", req.file.originalname);

    // Read PDF
    const fileBuffer = fs.readFileSync(filePath);

    // Extract text
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text || "";

    console.log("📌 TEXT PREVIEW:", extractedText.slice(0, 200));

    // AI call
    let structuredData = await callAIForParsing(extractedText);

    if (!structuredData) {
      console.log("⚠️ AI failed → fallback");
      structuredData = extractStructuredData(extractedText);
    }

    return res.json({
      message: "PDF processed successfully",
      preview: extractedText.slice(0, 300),
      structuredData
    });

  } catch (error) {
    console.error("❌ Upload error:", error.message);

    return res.status(500).json({
      error: "Failed to process PDF",
      details: error.message
    });

  } finally {
    // Cleanup ALWAYS runs
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.log("⚠️ Cleanup failed");
      }
    }
  }
});

// ==========================
// 10. GROQ AI FUNCTION
// ==========================
async function callAIForParsing(text) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.log("❌ GROQ KEY MISSING");
      return null;
    }

    const prompt = `Convert this resume into structured JSON:\n\n${text.slice(0, 4000)}`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let aiText = response.data?.choices?.[0]?.message?.content;
    if (!aiText) return null;

    aiText = aiText.replace(/```json|```/g, "").trim();

    return JSON.parse(aiText);

  } catch (err) {
    console.log("❌ GROQ ERROR:", err.response?.data || err.message);
    return null;
  }
}

// ==========================
// 11. FALLBACK PARSER
// ==========================
function extractStructuredData(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const email = text.match(/\S+@\S+\.\S+/)?.[0] || "";

  const name =
    lines.find(l =>
      l.length > 2 &&
      !l.includes("@") &&
      !l.toLowerCase().includes("skill")
    ) || "Unknown";

  return {
    name,
    email,
    summary: "",
    skills: [],
    projects: [],
    education: [],
    experience: []
  };
}

// ==========================
// 12. MOCK REWRITE
// ==========================
function simulateAIRewrite(text, tone) {
  if (tone === "professional") return `Developed: ${text}`;
  if (tone === "casual") return `Worked on: ${text}`;
  if (tone === "bold") return `🚀 Built: ${text}`;
  return text;
}

// ==========================
// 13. START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});