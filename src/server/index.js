import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cancelSubscription,
  createSubscription,
  dataFile,
  deleteSubscription,
  getSubscription,
  listSubscriptions,
  subscriptionSummary,
  updateSubscription
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const app = express();
const port = Number(process.env.PORT || 4177);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, dataFile });
});

app.get("/api/subscriptions", async (request, response, next) => {
  try {
    response.json(await listSubscriptions(request.query));
  } catch (error) {
    next(error);
  }
});

app.get("/api/subscriptions/:id", async (request, response, next) => {
  try {
    const item = await getSubscription(request.params.id);
    if (!item) return response.status(404).json({ error: "Subscription not found" });
    response.json(item);
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscriptions", async (request, response, next) => {
  try {
    const item = await createSubscription(request.body);
    response.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/subscriptions/:id", async (request, response, next) => {
  try {
    const item = await updateSubscription(request.params.id, request.body);
    if (!item) return response.status(404).json({ error: "Subscription not found" });
    response.json(item);
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscriptions/:id/cancel", async (request, response, next) => {
  try {
    const item = await cancelSubscription(request.params.id);
    if (!item) return response.status(404).json({ error: "Subscription not found" });
    response.json(item);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/subscriptions/:id", async (request, response, next) => {
  try {
    const removed = await deleteSubscription(request.params.id);
    if (!removed) return response.status(404).json({ error: "Subscription not found" });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/summary", async (request, response, next) => {
  try {
    response.json(await subscriptionSummary(request.query));
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === "production") {
  const dist = path.join(projectRoot, "dist");
  app.use(express.static(dist));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(dist, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  const status = error.name === "ZodError" ? 400 : 500;
  response.status(status).json({
    error: status === 400 ? "Invalid subscription data" : "Server error",
    details: error.issues || error.message
  });
});

app.listen(port, () => {
  console.log(`Subscription Hub API listening on http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
});
