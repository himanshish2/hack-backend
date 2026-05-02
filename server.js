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
    console.log("File received:", req.file);

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
You are an expert resume parser.

Return ONLY valid JSON. No explanation. No markdown.

Format:
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
        model: "openchat/openchat-3.5",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("FULL AI RESPONSE:", JSON.stringify(response.data, null, 2));

    let aiText = response.data.choices?.[0]?.message?.content;

    if (!aiText) {
      console.error("AI returned empty response");
      return null;
    }

    aiText = aiText.replace(/```json|```/g, "").trim();

    console.log("CLEANED AI TEXT:", aiText);

    try {
      return JSON.parse(aiText);
    } catch (err) {
      console.error("JSON PARSE FAILED:", aiText);
      return null;
    }

  } catch (error) {
    console.error("AI ERROR:", error.response?.data || error.message);
    return null;
  }
}

// ==========================
// 9. FALLBACK PARSER
// ==========================
function extractStructuredData(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const name = lines[0] || "";

  const emailMatch = text.match(/\S+@\S+\.\S+/);
  const email = emailMatch ? emailMatch[0] : "";

  let skills = [];
  const skillLine = lines.find(line =>
    line.toLowerCase().includes("skill")
  );

  if (skillLine && skillLine.includes(":")) {
    skills = skillLine
      .split(":")[1]
      .split(",")
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