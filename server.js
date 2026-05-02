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

// 8. Upload + PDF parse
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(fileBuffer);

    res.json({
      message: "PDF processed successfully",
      extractedText: data.text.slice(0, 1000)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process PDF" });
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

// 10. Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});