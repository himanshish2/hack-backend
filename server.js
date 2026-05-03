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
// 3. MULTER
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
// 7. UPLOAD + AI PARSING
// ==========================
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    console.log("STRUCTURED DATA FROM AI:", structuredData);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text || "";

    console.log("Extracted text preview:", extractedText.slice(0, 200));

    // 🔥 Call AI
    let structuredData = await callAIForParsing(extractedText);

    // 🛟 fallback
    if (!structuredData) {
      structuredData = extractStructuredData(extractedText);
    }

    // 🧹 cleanup
    fs.unlinkSync(req.file.path);

    res.json({
      message: "PDF processed successfully",
      preview: extractedText.slice(0, 300),
      structuredData
    });

  } catch (error) {
    console.error("Upload error:", error);

    res.status(500).json({
      error: "Failed to process PDF",
      details: error.message
    });
  }
});

// ==========================
// 8. AI FUNCTION (FIXED)
// ==========================
async function callAIForParsing(text) {
  try {
    const prompt = `
You are a resume parser.

Extract structured JSON ONLY.

Return format:
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
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct", // stable free model
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("RAW AI RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    let aiText = response.data?.choices?.[0]?.message?.content;

    if (!aiText) {
      console.log("❌ AI returned empty response");
      return null;
    }

    aiText = aiText.replace(/```json|```/g, "").trim();

    console.log("CLEAN AI TEXT:");
    console.log(aiText);

    const parsed = JSON.parse(aiText);
    return parsed;

  } catch (err) {
    console.log("❌ AI ERROR:");
    console.log(err.response?.data || err.message);
    return null;
  }
}

// ==========================
// 9. FALLBACK PARSER
// ==========================
function extractStructuredData(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const email = text.match(/\S+@\S+\.\S+/)?.[0] || "";

  const name = lines.find(l =>
    l.length > 2 &&
    !l.includes("@") &&
    !l.toLowerCase().includes("skill")
  ) || "Unknown";

  // better skill detection
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