import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import { MyRoomState } from "../src/rooms/schema/MyRoomState.js";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("connecting into a room", async () => {
    // `room` is the server-side Room instance reference.
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});

    // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
    const client1 = await colyseus.connectTo(room);

    // make your assertions
    assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

    assert.deepStrictEqual(client1.state.toJSON(), { mySynchronizedProperty: "Hello world" });
  });

  it("synchronizes movement speed for remote animation", async () => {
    const room = await colyseus.createRoom("toon_field", {});
    const client = await colyseus.connectTo(room);
    const observer = await colyseus.connectTo(room);

    let nextPatch = observer.waitForNextPatch();
    client.send("move", {
      x: 1,
      y: 0,
      z: 0,
      yaw: 0,
      speed: 4.5,
      look: JSON.stringify({ ride: "ele" }),
    });
    await nextPatch;

    let player = observer.state.players.get(client.sessionId);
    assert.strictEqual(player.speed, 4.5);
    assert.strictEqual(JSON.parse(player.look).ride, "ele");

    await new Promise((resolve) => setTimeout(resolve, 30));
    nextPatch = observer.waitForNextPatch();
    client.send("move", { x: 2, y: 0, z: 0, yaw: 0, speed: 20 });
    await nextPatch;
    player = observer.state.players.get(client.sessionId);
    assert.strictEqual(player.speed, 12);

    await new Promise((resolve) => setTimeout(resolve, 30));
    nextPatch = observer.waitForNextPatch();
    client.send("move", { x: 2.1, y: 0, z: 0, yaw: 0 });
    await nextPatch;
    player = observer.state.players.get(client.sessionId);
    assert(player.speed > 0);
  });
});
