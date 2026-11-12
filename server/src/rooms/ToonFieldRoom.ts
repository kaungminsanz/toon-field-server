import { Room, Client } from "colyseus";
import { schema, t } from "@colyseus/schema";

const Player = schema({
  x: t.number().default(0),
  y: t.number().default(0),
  z: t.number().default(0),
  yaw: t.number().default(0),
  rideYaw: t.number().default(0),
  speed: t.number().default(0),
  direction: t.number().default(1),
  name: t.string().default("Guest"),
  look: t.string().default("{}"),
}, "Player");

const State = schema({
  players: t.map(Player),
}, "ToonFieldState");

const NAME_MAX = 18;
const MOVE_MIN_MS = 25; // client sends about every 80 ms
const EMOTE_MIN_MS = 500;

export class ToonFieldRoom extends Room {
  state = new State();
  maxClients = 30;

  private lastMove = new Map<string, number>();
  private lastPosition = new Map<string, { x: number; z: number; at: number }>();
  private lastEmote = new Map<string, number>();

  onCreate() {
    this.onMessage("move", (client, data: any) => {
      const now = Date.now();
      if (now - (this.lastMove.get(client.sessionId) ?? 0) < MOVE_MIN_MS) return;
      this.lastMove.set(client.sessionId, now);

      const p = this.state.players.get(client.sessionId);
      if (!p || !data || typeof data !== "object") return;

      if (Number.isFinite(data.x)) p.x = Math.max(-590, Math.min(590, data.x));
      if (Number.isFinite(data.y)) p.y = Math.max(0, Math.min(20, data.y));
      if (Number.isFinite(data.z)) p.z = Math.max(-590, Math.min(590, data.z));
      if (Number.isFinite(data.yaw)) p.yaw = data.yaw % (Math.PI * 2);
      const previousPosition = this.lastPosition.get(client.sessionId);
      const elapsed = previousPosition
        ? Math.max((now - previousPosition.at) / 1000, MOVE_MIN_MS / 1000)
        : MOVE_MIN_MS / 1000;
      const measuredSpeed = previousPosition
        ? Math.hypot(p.x - previousPosition.x, p.z - previousPosition.z) / elapsed
        : 0;
      const speed = Number.isFinite(data.speed) ? data.speed : measuredSpeed;
      p.speed = Math.max(0, Math.min(12, speed));
      if (data.direction === -1 || data.direction === 1) {
        p.direction = data.direction;
      } else if (previousPosition) {
        const dx = p.x - previousPosition.x;
        const dz = p.z - previousPosition.z;
        const forwardDistance = dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw);
        if (Math.abs(forwardDistance) > 0.001) {
          p.direction = forwardDistance < 0 ? -1 : 1;
        }
      }
      this.lastPosition.set(client.sessionId, { x: p.x, z: p.z, at: now });

      if (typeof data.name === "string") {
        p.name = data.name.slice(0, NAME_MAX);
      }

      // Outfit + ride state ("bike" / "ele" / "") travel inside look
      if (typeof data.look === "string" && data.look.length <= 2000) {
        try {
          const l = JSON.parse(data.look);
          if (l && typeof l === "object" && !Array.isArray(l)) {
            if (l.ride !== "bike" && l.ride !== "ele") l.ride = "";
            p.look = JSON.stringify(l);
          }
        } catch {
          // ignore invalid JSON, keep the previous look
        }
      }
      const ride = JSON.parse(p.look).ride;
      const moveYaw = p.yaw + (p.direction < 0 ? Math.PI : 0);
      const rideYaw = Number.isFinite(data.rideYaw)
        ? data.rideYaw
        : moveYaw - (ride === "bike" ? Math.PI / 2 : 0);
      const tau = Math.PI * 2;
      p.rideYaw = ((rideYaw % tau) + tau) % tau;
    });

    this.onMessage("emote", (client, data: any) => {
      const allowedEmotes = ["wave", "dance", "laugh", "cheer"];
      if (!data || !allowedEmotes.includes(data.type)) return;

      const now = Date.now();
      if (now - (this.lastEmote.get(client.sessionId) ?? 0) < EMOTE_MIN_MS) return;
      this.lastEmote.set(client.sessionId, now);

      this.broadcast("emote", {
        sessionId: client.sessionId,
        type: data.type,
      });
    });
  }

  onJoin(client: Client, options?: any) {
    const player = new Player();
    player.name =
      typeof options?.name === "string" && options.name.trim()
        ? options.name.slice(0, NAME_MAX)
        : "Guest";
    this.state.players.set(client.sessionId, player);
    this.lastPosition.set(client.sessionId, { x: player.x, z: player.z, at: Date.now() });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastMove.delete(client.sessionId);
    this.lastPosition.delete(client.sessionId);
    this.lastEmote.delete(client.sessionId);
  }
}