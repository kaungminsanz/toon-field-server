import server from "./app.config.js";

const PORT = Number(process.env.PORT) || 2567;

console.log("Starting Toon Field server...");
console.log("Railway PORT:", PORT);

server.listen(PORT, "0.0.0.0")
  .then(() => {
    console.log(`✅ SERVER LISTENING on 0.0.0.0:${PORT}`);
  })
  .catch((error) => {
    console.error("❌ SERVER START FAILED:", error);
    process.exit(1);
  });