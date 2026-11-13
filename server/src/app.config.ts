
import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  createRouter,
  createEndpoint,
} from "colyseus";
import { fileURLToPath } from "node:url";

import { MyRoom } from "./rooms/MyRoom.js";
import { ToonFieldRoom } from "./rooms/ToonFieldRoom.js";

const gamePage = fileURLToPath(new URL("../index.html", import.meta.url));

const server = defineServer({
  rooms: {
    my_room: defineRoom(MyRoom),
    toon_field: defineRoom(ToonFieldRoom),
  },

  routes: createRouter({
    api_hello: createEndpoint(
      "/api/hello",
      { method: "GET" },
      async () => {
        return { message: "Hello World" };
      }
    ),
  }),

  express: (app) => {
    app.get("/", (_req, res) => {
      res.sendFile(gamePage);
    });

    app.get("/hi", (_req, res) => {
      res.send("Colyseus server is running!");
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
      app.use("/", playground());
    }
  },
});

export default server;
