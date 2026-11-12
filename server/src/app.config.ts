
import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  createRouter,
  createEndpoint,
} from "colyseus";

import { MyRoom } from "./rooms/MyRoom.js";
import { ToonFieldRoom } from "./rooms/ToonFieldRoom.js";

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
