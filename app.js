import express from "express";
import cors from "cors";
import http from "http";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";
import { Server } from "socket.io";
import bcrypt from "bcrypt";
import session from "express-session";

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({ secret: "secret-key", resave: false, saveUninitialized: true }));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ------------------------
// Registration
// ------------------------
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(`INSERT INTO users (username, password, role) VALUES ($1,$2,$3)`, [username, hashedPassword, role]);
    res.status(200).json({ message: "Registration successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "User already exists or DB error" });
  }
});

// ------------------------
// Login
// ------------------------
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
    if (result.rows.length === 0) return res.status(400).json({ message: "User not found" });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid password" });

    req.session.user = { username: user.username, role: user.role };
    res.status(200).json({ message: "Login successful", role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

// ------------------------
// Fetch Cars (buyers)
// ------------------------
app.get("/api/cars", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, b.name AS brand, c.model, c.year, c.engine, c.horse_power, c.gearbox, c.price, c.image
      FROM cars c
      JOIN brands b ON c.brand_id = b.id
      ORDER BY b.name, c.model
    `);
    const carsData = {};
    result.rows.forEach(car => {
      if (!carsData[car.brand]) carsData[car.brand] = {};
      carsData[car.brand][car.model] = {
         brand: car.brand,       // <-- add this
         model: car.model,
         year: car.year,
         engine: car.engine,
         horsePower: car.horse_power,
         gearbox: car.gearbox,
         price: car.price,
        image: car.image
      };
    });
    res.json(carsData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

// ------------------------
// Add Car (sellers)
// ------------------------

app.post("/api/cars", async (req, res) => {
  console.log("Received car data:", req.body);
  console.log("Session user:", req.session.user);
  const user = req.session.user;
  if (!user || user.role !== "seller") return res.status(403).json({ message: "Unauthorized" });

  const { brand_id, model, year, engine, horsePower, gearbox, price, image } = req.body;
  try {
    await pool.query(
      `INSERT INTO cars (brand_id, model, year, engine, horse_power, gearbox, price, image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [brand_id, model, year, engine, horsePower, gearbox, price, image]
    );
    res.status(200).json({ message: "Car added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/api/message", async (req, res) => {
    const { carId, sender, text } = req.body;
    console.log(carId);
    console.log(sender);
    console.log(text);
    
    if (!sender || !text || !carId) return res.status(400).json({ message: "Missing data" });

    try {
        await pool.query(
            `INSERT INTO messages (car_id, sender, message) VALUES ($1, $2, $3)`,
            [carId, sender, text]
        );

        // Emit to sellers
        io.emit("receiveMessage", { carId, sender, text });
        res.status(200).json({ message: "Message sent" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "DB error" });
    }
});
app.get("/api/brands", async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM brands ORDER BY name`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error fetching brands" });
  }
});

// Get all messages for all cars
app.get("/api/messages", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.car_id, m.sender, m.message, m.created_at, c.model, b.name AS brand
      FROM messages m
      JOIN cars c ON m.car_id = c.id
      JOIN brands b ON c.brand_id = b.id
      ORDER BY m.created_at
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});


app.get("/api/messages/:carId", async (req, res) => {
    const carId = req.params.carId;
    try {
        const result = await pool.query(
            `SELECT * FROM messages WHERE car_id = $1 ORDER BY created_at`,
            [carId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "DB error" });
    }
});
// ------------------------
// Socket.io Chat
// ------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("sendMessage", (msg) => {
    io.emit("receiveMessage", msg);
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// -------------------------
// Auth routes (example)
// -------------------------
app.post("/api/register", async (req, res) => {
  // your registration logic
});

app.post("/api/login", async (req, res) => {
  // your login logic
});

// -------------------------
// ✅ ADD THIS HERE — Seller adds a car
// -------------------------

// -------------------------
// ✅ And below it — Seller fetches their own cars
// -------------------------
app.get("/api/cars", async (req, res) => {
  const sellerId = req.session.user?.id;
  if (!sellerId) return res.status(403).json({ message: "Not authorized" });

  try {
    const result = await pool.query(
      "SELECT * FROM cars WHERE seller_id = $1 ORDER BY id DESC",
      [sellerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error loading cars:", err);
    res.status(500).json({ message: "Database error while loading cars" });
  }
});




server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
