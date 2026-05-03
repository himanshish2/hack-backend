// ==========================
// 1. IMPORTS
// ==========================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");

// ==========================
// 2. DEBUG ENV
// ==========================
console.log("👉 GROQ KEY LOADED:", !!process.env.GROQ_API_KEY);

// ==========================
// 3. APP SETUP
// ==========================
const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// 4. MULTER SETUP
// ==========================
const upload = multer({ dest: "uploads/" });

// ==========================
// 5. PORT
// ==========================
const PORT = process.env.PORT || 5000;

// ==========================
// 6. TEST ROUTE
// ==========================
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ==========================
// 7. REWRITE API
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
// 8. UPLOAD + PDF + AI
// ==========================
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    console.log("📥 Upload request received");

    if (!req.file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📄 File received:", req.file.originalname);

    // 1. Read PDF
    const fileBuffer = fs.readFileSync(req.file.path);

    // 2. Extract text
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text || "";

    console.log("📌 PDF TEXT PREVIEW:");
    console.log(extractedText.slice(0, 200));

    // 3. AI CALL TRACE START
    console.log("🔥 Calling AI parser...");

    let structuredData = await callAIForParsing(extractedText);

    // 4. AI RESULT CHECK
    if (structuredData) {
      console.log("✅ AI SUCCESS");
    } else {
      console.log("⚠️ AI FAILED → using fallback parser");
      structuredData = extractStructuredData(extractedText);
    }

    console.log("📊 FINAL STRUCTURED DATA:");
    console.log(JSON.stringify(structuredData, null, 2));

    // 5. Cleanup safely
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.log("⚠️ File cleanup failed (ignore)");
    }

    // 6. Response
    return res.json({
      message: "PDF processed successfully",
      preview: extractedText.slice(0, 300),
      structuredData
    });

  } catch (error) {
    console.error("❌ Upload error FULL:", error);

    return res.status(500).json({
      error: "Failed to process PDF",
      details: error.message
    });
  }
});

// ==========================
// 9. GROQ AI FUNCTION (FIXED)
// ==========================
async function callAIForParsing(text) {
  try {
    const prompt = `
You are an expert Resume-to-Portfolio AI system.

Your job is to convert raw resume text into a PERFECT structured JSON that can be directly used in a portfolio website.

🚨 STRICT RULES:
- Return ONLY valid JSON (no markdown, no explanation)
- Never include extra text
- Always follow the schema exactly
- If data is missing, use empty strings or empty arrays
- NEVER put long sentences inside arrays unless required
- Always extract and structure intelligently

---

📦 OUTPUT FORMAT (MUST FOLLOW EXACTLY):

{
  "name": "",
  "email": "",
  "summary": "",
  "skills": [],
  "projects": [
    {
      "title": "",
      "description": "",
      "tech": []
    }
  ],
  "education": [
    {
      "degree": "",
      "college": "",
      "year": ""
    }
  ],
  "experience": [
    {
      "role": "",
      "company": "",
      "duration": "",
      "points": []
    }
  ]
}

---

🧠 INTELLIGENCE RULES:

1. SUMMARY:
- Write a 2-line professional summary
- Highlight role, skills, and domain

2. SKILLS:
- Extract ALL technical + soft skills
- Remove duplicates
- Normalize names (e.g. "js" → "JavaScript")

3. PROJECTS:
- Convert each project into OBJECT
- Infer title if missing
- Extract tech stack separately
- Keep description clean and short

4. EXPERIENCE:
- Convert bullet points into array
- Extract company, role, duration if possible

5. EDUCATION:
- Always structure properly if found

---

📄 RESUME TEXT:
${text.slice(0, 4000)}
`;


    console.log("🚀 Sending request to Groq...");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
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

    console.log("✅ Got response from Groq");

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
// 10. FALLBACK PARSER
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
// 11. MOCK REWRITE
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
// 12. START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});