// 1. Imports
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");
require("dotenv").config();

// 2. App setup
const app = express();
app.use(cors());
app.use(express.json());

// 3. Multer
const upload = multer({ dest: "uploads/" });

// 4. Port
const PORT = process.env.PORT || 5000;

// 5. Test route
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});


// ==========================
// 🔁 REWRITE API (still mock for now)
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
// 📄 UPLOAD + AI PARSING
// ==========================
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    console.log("File received:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Read PDF
    const fileBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(fileBuffer);
    const extractedText = data.text || "";

    // 🔥 CALL AI
    let structuredData = await callAIForParsing(extractedText);

    // 🛟 FALLBACK (if AI fails)
    if (!structuredData) {
      structuredData = extractStructuredData(extractedText);
    }

    // 🧹 delete temp file
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
// 🤖 AI FUNCTION (OpenRouter)
// ==========================
async function callAIForParsing(text) {
  try {
    const prompt = `
Extract structured JSON from this resume.

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
${text.slice(0, 4000)}
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let aiText = response.data.choices[0].message.content;

    // 🧹 clean markdown if exists
    aiText = aiText.replace(/```json|```/g, "").trim();

    return JSON.parse(aiText);

  } catch (error) {
    console.error("AI error:", error.response?.data || error.message);
    return null;
  }
}


// ==========================
// 🧠 FALLBACK PARSER
// ==========================
function extractStructuredData(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let name = lines[0] || "";

  const emailMatch = text.match(/\S+@\S+\.\S+/);
  const email = emailMatch ? emailMatch[0] : "";

  const skillLine = lines.find(line =>
    line.toLowerCase().includes("skill")
  );

  let skills = [];
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
// 🎭 MOCK REWRITE (temporary)
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
// 🚀 START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});