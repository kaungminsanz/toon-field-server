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

  it("synchronizes ride facing and direction for remote players", async () => {
    const room = await colyseus.createRoom("toon_field", {});
    const client = await colyseus.connectTo(room);
    const observer = await colyseus.connectTo(room);

    let nextPatch = observer.waitForNextPatch();
    client.send("move", {
      x: 1,
      y: 0,
      z: 0,
      yaw: 0,
      rideYaw: 0.8,
      speed: 4.5,
      direction: -1,
      look: JSON.stringify({ ride: "ele" }),
    });
    await nextPatch;

    let player = observer.state.players.get(client.sessionId);
    assert(Math.abs(player.rideYaw - 0.8) < 0.00001);
    assert.strictEqual(player.speed, 4.5);
    assert.strictEqual(player.direction, -1);
    assert.strictEqual(JSON.parse(player.look).ride, "ele");

    await new Promise((resolve) => setTimeout(resolve, 30));
    nextPatch = observer.waitForNextPatch();
    client.send("move", {
      x: 2,
      y: 0,
      z: 0,
      yaw: 0,
      rideYaw: 1.5,
      speed: 20,
      direction: 1,
    });
    await nextPatch;
    player = observer.state.players.get(client.sessionId);
    assert.strictEqual(player.rideYaw, 1.5);
    assert.strictEqual(player.speed, 12);
    assert.strictEqual(player.direction, 1);

    await new Promise((resolve) => setTimeout(resolve, 30));
    nextPatch = observer.waitForNextPatch();
    client.send("move", { x: 2.1, y: 0, z: -1, yaw: 0 });
    await nextPatch;
    player = observer.state.players.get(client.sessionId);
    assert(player.speed > 0);
    assert.strictEqual(player.direction, -1);
    assert(Math.abs(player.rideYaw) < 0.00001);
  });

  it("broadcasts chat and typing status using the joined player's name", async () => {
    const room = await colyseus.createRoom("toon_field", {});
    const sender = await colyseus.connectTo(room, { name: "Player One" });
    const observer = await colyseus.connectTo(room);
    sender.onMessage("typing", () => {});
    sender.onMessage("chat", () => {});

    const typingStarted = new Promise((resolve) => observer.onMessage("typing", resolve));
    sender.send("typing", { typing: true });
    assert.deepStrictEqual(await typingStarted, { sessionId: sender.sessionId, typing: true });

    const chatMessage = new Promise((resolve) => observer.onMessage("chat", resolve));
    sender.send("chat", { name: "Impersonator", text: "  hello   everyone  " });
    assert.deepStrictEqual(await chatMessage, {
      sessionId: sender.sessionId,
      name: "Player One",
      text: "hello everyone",
    });

    const typingStopped = new Promise((resolve) => observer.onMessage("typing", resolve));
    sender.send("typing", { typing: false });
    assert.deepStrictEqual(await typingStopped, { sessionId: sender.sessionId, typing: false });
  });

  it("relays voice signaling between opted-in room members", async () => {
    const room = await colyseus.createRoom("toon_field", {});
    const sender = await colyseus.connectTo(room);
    const observer = await colyseus.connectTo(room);

    let nextPatch = observer.waitForNextPatch();
    sender.send("voiceState", { enabled: true, speaking: false });
    await nextPatch;
    nextPatch = sender.waitForNextPatch();
    observer.send("voiceState", { enabled: true, speaking: false });
    await nextPatch;

    const relayedSignal = new Promise((resolve) => observer.onMessage("voiceSignal", resolve));
    sender.send("voiceSignal", {
      target: observer.sessionId,
      signal: { type: "offer", sdp: "test-sdp" },
    });
    assert.deepStrictEqual(await relayedSignal, {
      from: sender.sessionId,
      signal: { type: "offer", sdp: "test-sdp" },
    });
  });
});
