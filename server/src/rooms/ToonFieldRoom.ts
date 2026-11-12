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
  voiceEnabled: t.boolean().default(false),
  voiceActive: t.boolean().default(false),
}, "Player");

const State = schema({
  players: t.map(Player),
}, "ToonFieldState");

const NAME_MAX = 18;
const MOVE_MIN_MS = 25; // client sends about every 80 ms
const EMOTE_MIN_MS = 500;
const CHAT_MAX = 160;
const CHAT_MIN_MS = 400;
const TYPING_MIN_MS = 250;
const VOICE_STATE_MIN_MS = 80;

export class ToonFieldRoom extends Room {
  state = new State();
  maxClients = 30;

  private lastMove = new Map<string, number>();
  private lastPosition = new Map<string, { x: number; z: number; at: number }>();
  private lastEmote = new Map<string, number>();
  private lastChat = new Map<string, number>();
  private lastTyping = new Map<string, number>();
  private lastVoiceState = new Map<string, number>();
  private typingPlayers = new Set<string>();

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
      const rideYaw = Number.isFinite(data.rideYaw)
        ? data.rideYaw
        : p.yaw - (ride === "bike" ? Math.PI / 2 : 0);
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

    this.onMessage("typing", (client, data: any) => {
      if (!data || typeof data.typing !== "boolean" || !this.state.players.has(client.sessionId)) return;

      const now = Date.now();
      if (data.typing) {
        if (now - (this.lastTyping.get(client.sessionId) ?? 0) < TYPING_MIN_MS) return;
        this.lastTyping.set(client.sessionId, now);
        this.typingPlayers.add(client.sessionId);
      } else {
        this.lastTyping.delete(client.sessionId);
        if (!this.typingPlayers.delete(client.sessionId)) return;
      }

      this.broadcast("typing", {
        sessionId: client.sessionId,
        typing: data.typing,
      });
    });

    this.onMessage("chat", (client, data: any) => {
      if (!data || typeof data.text !== "string") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const text = [...data.text.replace(/\s+/g, " ").trim()].slice(0, CHAT_MAX).join("");
      if (!text) return;

      const now = Date.now();
      if (now - (this.lastChat.get(client.sessionId) ?? 0) < CHAT_MIN_MS) return;
      this.lastChat.set(client.sessionId, now);

      this.broadcast("chat", {
        sessionId: client.sessionId,
        name: player.name,
        text,
      });
    });

    this.onMessage("voiceState", (client, data: any) => {
      if (!data || typeof data.enabled !== "boolean" || typeof data.speaking !== "boolean") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const now = Date.now();
      if (data.enabled && now - (this.lastVoiceState.get(client.sessionId) ?? 0) < VOICE_STATE_MIN_MS) return;
      this.lastVoiceState.set(client.sessionId, now);
      player.voiceEnabled = data.enabled;
      player.voiceActive = data.enabled && data.speaking;
    });

    this.onMessage("voiceSignal", (client, data: any) => {
      if (!data || typeof data.target !== "string" || data.target === client.sessionId) return;
      const sender = this.state.players.get(client.sessionId);
      const recipient = this.state.players.get(data.target);
      if (!sender || !recipient || !sender.voiceEnabled || !recipient.voiceEnabled) return;
      if (Math.hypot(sender.x - recipient.x, sender.z - recipient.z) > 25) return;
      const target = this.clients.find((roomClient) => roomClient.sessionId === data.target);
      if (!target || !data.signal || typeof data.signal !== "object" || Array.isArray(data.signal)) return;

      const signal = data.signal;
      if ((signal.type === "offer" || signal.type === "answer") &&
          typeof signal.sdp === "string" && signal.sdp.length <= 16000) {
        target.send("voiceSignal", {
          from: client.sessionId,
          signal: { type: signal.type, sdp: signal.sdp },
        });
        return;
      }

      if (typeof signal.candidate !== "string" || signal.candidate.length > 4096) return;
      target.send("voiceSignal", {
        from: client.sessionId,
        signal: {
          candidate: signal.candidate,
          sdpMid: typeof signal.sdpMid === "string" ? signal.sdpMid.slice(0, 128) : null,
          sdpMLineIndex: Number.isInteger(signal.sdpMLineIndex) ? signal.sdpMLineIndex : null,
          ...(typeof signal.usernameFragment === "string"
            ? { usernameFragment: signal.usernameFragment.slice(0, 128) }
            : {}),
        },
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
    if (this.typingPlayers.delete(client.sessionId)) {
      this.broadcast("typing", { sessionId: client.sessionId, typing: false });
    }
    this.state.players.delete(client.sessionId);
    this.lastMove.delete(client.sessionId);
    this.lastPosition.delete(client.sessionId);
    this.lastEmote.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
    this.lastTyping.delete(client.sessionId);
    this.lastVoiceState.delete(client.sessionId);
  }
}