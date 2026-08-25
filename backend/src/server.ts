import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runMockAgent } from "./agent/mockAgent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RevenueGuard AI Backend",
    agent: "gemini",
  });
});

// AI investigation endpoint
app.post("/api/investigate", async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        error: "customerId is required",
      });
    }

    const decision = await runMockAgent(customerId);

    return res.json(decision);
  } catch (error) {
    console.error("Investigation error:", error);

    return res.status(500).json({
      error: "Investigation failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `RevenueGuard backend running on http://localhost:${PORT}`
  );
});