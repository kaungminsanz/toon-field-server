import server from "./app.config.js";

const PORT = Number(process.env.PORT) || 2567;

console.log("Starting Toon Field server...");
console.log("Railway PORT:", process.env.PORT);

server.listen(PORT, "0.0.0.0");

console.log("Listen command executed on port:", PORT);