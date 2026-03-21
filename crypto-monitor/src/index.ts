import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { luffaClient } from "../bot/client";
import { registerHandlers } from "../bot/handler";
import apiRoutes from "../api/routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

app.use(express.static(path.join(__dirname, "../../public")));

app.get("/connect-wallet", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../public/connect.html"));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`InvesTrack API running on http://localhost:${PORT}`);
});

registerHandlers();

luffaClient
  .start()
  .then(() => {
    console.log("Luffa bot connected, polling for messages...");
  })
  .catch((err: Error) => {
    console.error("Luffa bot failed to start:", err.message);
    console.log("API server still running without bot.");
  });
