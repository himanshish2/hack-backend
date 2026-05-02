// 1. Import packages
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
require("dotenv").config();

// 2. Create app
const app = express();

// 3. Middleware
app.use(cors());
app.use(express.json());

// 4. Multer setup
const upload = multer({ dest: "uploads/" });

// 5. Port
const PORT = process.env.PORT || 5000;

// 6. Test route
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// 7. Rewrite API
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

//uploading stuff
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    // 🔍 Debug log (keep this for now)
    console.log("File received:", req.file);

    // ❌ If no file
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 📂 Read uploaded file
    const fileBuffer = fs.readFileSync(req.file.path);

    // 📄 Parse PDF
    const data = await pdfParse(fileBuffer);

    // 🧠 Extract text safely
    const extractedText = data.text || "";

    // 📤 Send response
    res.json({
      message: "PDF processed successfully",
      preview: extractedText.slice(0, 500)
});

  } catch (error) {
    console.error("Upload error:", error);

    res.status(500).json({
      error: "Failed to process PDF",
      details: error.message
    });
  }
});

// 9. Mock AI function
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

function extractStructuredData(text) {
  const lines = text.split("\n").map(l => l.trim());

  let name = "";
  let email = "";
  let skills = [];

  // Extract name (first non-empty line)
  name = lines.find(line => line.length > 0) || "";

  // Extract email
  const emailMatch = text.match(/\S+@\S+\.\S+/);
  email = emailMatch ? emailMatch[0] : "";

  // Extract skills (very basic logic)
  const skillLine = lines.find(line =>
    line.toLowerCase().includes("skill")
  );

  if (skillLine) {
    skills = skillLine
      .split(":")[1]
      ?.split(",")
      .map(s => s.trim()) || [];
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

// 10. Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});