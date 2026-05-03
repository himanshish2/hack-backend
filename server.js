// ==========================
// 1. IMPORTS
// ==========================
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");
require("dotenv").config();

// ==========================
// 2. APP SETUP
// ==========================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// 3. MULTER SETUP
// ==========================
const upload = multer({ dest: "uploads/" });

// ==========================
// 4. PORT
// ==========================
const PORT = process.env.PORT || 5000;

// ==========================
// 5. TEST ROUTE
// ==========================
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ==========================
// 6. REWRITE API (MOCK)
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
    console.error("Rewrite error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ==========================
// 7. UPLOAD + PDF + AI
// ==========================
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text || "";

    console.log("PDF TEXT PREVIEW:", extractedText.slice(0, 200));

    let structuredData = await callAIForParsing(extractedText);

    if (!structuredData) {
      structuredData = extractStructuredData(extractedText);
    }

    console.log("FINAL STRUCTURED DATA:", structuredData);

    fs.unlinkSync(req.file.path);

    return res.json({
      message: "PDF processed successfully",
      preview: extractedText.slice(0, 300),
      structuredData
    });

  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      error: "Failed to process PDF",
      details: error.message
    });
  }
});

// ==========================
// 8. GROQ AI FUNCTION (FIXED)
// ==========================
async function callAIForParsing(text) {
  try {
    const prompt = `
You are a resume parser.

Return ONLY valid JSON:

{
  "name": "",
  "email": "",
  "summary": "",
  "skills": [],
  "projects": [],
  "education": [],
  "experience": []
}

Resume:
${text.slice(0, 3000)}
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("GROQ RAW RESPONSE RECEIVED");

    let aiText = response.data?.choices?.[0]?.message?.content;

    if (!aiText) return null;

    aiText = aiText.replace(/```json|```/g, "").trim();

    return JSON.parse(aiText);

  } catch (err) {
    console.log("GROQ ERROR:", err.response?.data || err.message);
    return null;
  }
}

// ==========================
// 9. FALLBACK PARSER
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

  let skills = [];
  const skillMatch = text.match(/skills?:([\s\S]*?)(education|experience|projects|$)/i);

  if (skillMatch?.[1]) {
    skills = skillMatch[1]
      .split(/,|\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  return {
    name,
    email,
    summary: "",
    skills,
    projects: [],
    education: [],
    experience: []
  };
}

// ==========================
// 10. MOCK REWRITE
// ==========================
function simulateAIRewrite(text, tone) {
  if (tone === "professional") {
    return `Developed and delivered: ${text}`;
  }
  if (tone === "casual") {
    return `Basically, I worked on this: ${text}`;
  }
  if (tone === "bold") {
    return `🚀 Built something impactful: ${text}`;
  }
  return text;
}

// ==========================
// 11. START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});