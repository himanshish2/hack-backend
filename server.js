
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");

// 1. Import packages
const upload = multer({ dest: "uploads/" });
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// 2. Create app
const app = express();

// 3. Middleware (must come AFTER app is created)
app.use(cors());
app.use(express.json());

// 4. Port
const PORT = process.env.PORT || 5000;

// 5. Test route
app.get("/", (req, res) => {
  res.send("This is a POST endpoint. Use Postman.");
});


// 6. Rewrite API (MOCK AI)
app.post("/api/rewrite", (req, res) => {
  try {
    const { text, tone, section } = req.body;

    // Validation
    if (!text || !tone) {
      return res.status(400).json({ error: "Text and tone are required" });
    }

    // Simulated AI response
    const rewrittenText = simulateAIRewrite(text, tone);

    res.json({ rewrittenText });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


// 7. Fake AI function
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


// 8. Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
const express = require("express");

const app = express();

const PORT = 5000;

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);

});