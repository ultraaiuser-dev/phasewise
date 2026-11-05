// One origin for browser tests: actual Socket.IO server plus built client.
import express from "express";
import path from "node:path";
import { createServer } from "../packages/server/dist/server.js";
const { app, httpServer } = createServer();
app.use(express.static(path.resolve("packages/client/dist")));
app.get("*", (_req, res) =>
  res.sendFile(path.resolve("packages/client/dist/index.html")),
);
httpServer.listen(5180, "127.0.0.1", () =>
  console.log("Browser test server http://127.0.0.1:5180"),
);
