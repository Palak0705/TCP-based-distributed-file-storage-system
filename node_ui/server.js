// ---------------- IMPORTS ----------------
const express = require("express");
const multer = require("multer");
const net = require("net");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./auth");

const app = express();
const PORT = 8000;

// ---------------- MIDDLEWARES ----------------
// ---------------- MIDDLEWARES ----------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // <-- Add this for JSON requests

// Temporary user storage (replace with DB later)
const users = [];

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Python server config
const PYTHON_HOST = "127.0.0.1";
const PYTHON_PORT = 5000;

// Set EJS as template engine
app.set("view engine", "ejs");
app.use(express.static("public"));

// Middleware to check login
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// ---------------- ROUTES ----------------

// 🏠 Home Page
app.get("/", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("home", { user: req.session.user });
});

// ---------------- AUTHENTICATION ----------------

// Register Page
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;

  // Example simple in-memory storage (replace with database in future)
  const existingUser = users.find(u => u.username === username);

  if (existingUser) {
    return res.json({ success: false, message: "Username already exists!" });
  }

  users.push({ username, password });
  return res.json({ success: true, message: "Registration successful!" });
});


// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    req.session.user = user;
    return res.json({ success: true, message: "Login successful" });
  } else {
    return res.json({ success: false, message: "Invalid username or password" });
  }
});


// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ---------------- FILE HANDLING ----------------

// Upload Page
app.get("/upload", requireLogin, (req, res) => {
  res.render("upload");
});

// Handle Upload POST
app.post("/upload", requireLogin, upload.single("file"), (req, res) => {
  const filename = req.file.originalname;
  const filepath = req.file.path;

  const client = new net.Socket();
  client.setTimeout(5000);

  client.connect(PYTHON_PORT, PYTHON_HOST, () => {
    console.log("Connected to Python server for upload");
    client.write(`UPLOAD ${filename}\n`);
  });

  client.on("data", (data) => {
    const msg = data.toString().trim();

    if (msg === "READY") {
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

// List Files
app.get("/files", requireLogin, (req, res) => {
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
      const files = JSON.parse(receivedData);
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

// Download File
app.get("/download/:filename", requireLogin, (req, res) => {
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
        client.write("ACK");
        fileTransferStarted = true;
      } else if (message.startsWith("FILE_NOT_FOUND")) {
        res.send("❌ File not found on server.");
        client.destroy();
      }
    } else {
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

// Delete File
app.post("/delete/:filename", requireLogin, (req, res) => {
  const filename = req.params.filename;
  const client = new net.Socket();

  client.setTimeout(5000);

  client.connect(PYTHON_PORT, PYTHON_HOST, () => {
    client.write(`DELETE ${filename}\n`);
  });

  client.on("data", (data) => {
    const message = data.toString().trim();
    if (message === "DELETE_SUCCESS") {
      console.log(`Deleted file: ${filename}`);
      res.redirect("/files");
    } else if (message === "FILE_NOT_FOUND") {
      res.send("❌ File not found on server.");
    }
    client.end();
  });

  client.on("error", (err) => {
    console.error("Error deleting file:", err);
    res.send("❌ Delete failed.");
  });

  client.on("timeout", () => {
    console.error("Delete timeout");
    res.send("❌ Delete timed out.");
    client.destroy();
  });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`🚀 NetStore UI running at http://localhost:${PORT}`);
});
