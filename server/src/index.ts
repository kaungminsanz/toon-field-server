/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting, you can see "Raw usage" from the documentation.
 *
 * See: https://docs.colyseus.io/server
 */
// Import Colyseus config
import server from "./app.config.js";

const PORT = process.env.PORT || 2567;

server.listen(PORT, "0.0.0.0");
