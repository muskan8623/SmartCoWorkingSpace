const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");

const { initializeSocket } = require("./config/socket");

const connectDatabase = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const matchingRoutes = require("./routes/matchingRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

dotenv.config();

const app = express();
const server = http.createServer(app);
initializeSocket(server);


const PORT = Number(process.env.PORT) || 5000;

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);


app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Co-Working Space Management API",
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running",
    database: "connected",
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const startServer = async () => {
  try {
    await connectDatabase();

    server.listen(PORT, () => {
      console.log(
        `Smart Co-Working Space API running on port ${PORT}`
      );
      console.log(
        `Health check: http://localhost:${PORT}/api/health`
      );
    });
  } catch (error) {
    console.error("Server startup failed.");
    process.exit(1);
  }
};

startServer();