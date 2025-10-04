const express = require("express");
const multer = require("multer");
const net = require("net");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Python server config
const PYTHON_HOST = "127.0.0.1";
const PYTHON_PORT = 5000;

// Set EJS as template engine
app.set("view engine", "ejs");
app.use(express.static("public"));

// ---------------- ROUTES ----------------

// 1️⃣ Home Page
app.get("/", (req, res) => {
  res.render("home");
});

// 2️⃣ Upload Page
app.get("/upload", (req, res) => {
  res.render("upload");
});

// Handle Upload POST
app.post("/upload", upload.single("file"), (req, res) => {
  const filename = req.file.originalname;
  const filepath = req.file.path;

  const client = new net.Socket();
  client.setTimeout(5000);

  client.connect(PYTHON_PORT, PYTHON_HOST, () => {
    console.log("Connected to Python server for upload");

    // Send upload command first
    client.write(`UPLOAD ${filename}\n`);
  });

  client.on("data", (data) => {
    const msg = data.toString().trim();

    if (msg === "READY") {
      // Python server is ready; send file data
      const fileData = fs.readFileSync(filepath);
      client.write(fileData);
    }

    if (msg === "UPLOAD_SUCCESS") {
      console.log("Upload successful");
      res.render("download", { filename });
      client.end();
    }
  });

  client.on("error", (err) => {
    console.error("Error uploading file:", err);
    res.send("❌ Upload failed.");
  });

  client.on("timeout", () => {
    console.error("Upload timeout");
    res.send("❌ Upload timed out.");
    client.destroy();
  });
});

app.get("/files", (req, res) => {
  const client = new net.Socket();
  client.setTimeout(5000);

  client.connect(PYTHON_PORT, PYTHON_HOST, () => {
    client.write("LIST\n");
  });

  let receivedData = "";

  client.on("data", (data) => {
    receivedData += data.toString();
  });

  client.on("end", () => {
    try {
      const files = JSON.parse(receivedData); // now valid JSON
      res.render("files", { files });
    } catch (err) {
      console.error("Failed to parse file list:", err);
      res.send("❌ Failed to fetch files.");
    }
  });

  client.on("error", (err) => {
    console.error("Error fetching file list:", err);
    res.send("❌ Failed to fetch files.");
  });

  client.on("timeout", () => {
    console.error("List request timeout");
    res.send("❌ Request timed out.");
    client.destroy();
  });
});



// 4️⃣ Download File
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const client = new net.Socket();
  let fileBuffer = Buffer.alloc(0);
  let fileTransferStarted = false;

  client.setTimeout(5000);

  client.connect(PYTHON_PORT, PYTHON_HOST, () => {
    client.write(`DOWNLOAD ${filename}\n`);
  });

  client.on("data", (data) => {
    const message = data.toString();

    if (!fileTransferStarted) {
      if (message.startsWith("EXISTS")) {
        client.write("ACK"); // ✅ tell Python we are ready
        fileTransferStarted = true;
      } else if (message.startsWith("FILE_NOT_FOUND")) {
        res.send("❌ File not found on server.");
        client.destroy();
      }
    } else {
      // ✅ now this is actual file content
      fileBuffer = Buffer.concat([fileBuffer, data]);
    }
  });

  client.on("end", () => {
    if (fileBuffer.length > 0) {
      const downloadsDir = path.join(__dirname, "downloads");
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

      const filePath = path.join(downloadsDir, filename);
      fs.writeFileSync(filePath, fileBuffer);
      res.download(filePath);
    }
  });

  client.on("error", (err) => {
    console.error("Error downloading file:", err);
    res.send("❌ Download failed.");
  });

  client.on("timeout", () => {
    console.error("Download timeout");
    res.send("❌ Download timed out.");
    client.destroy();
  });
});


// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`NetStore UI running at http://localhost:${PORT}`);
});
