import { Room, Client } from "colyseus";
import { schema, t } from "@colyseus/schema";

const Player = schema({
  x: t.number().default(0),
  y: t.number().default(0),
  z: t.number().default(0),
  yaw: t.number().default(0),
  name: t.string().default("Guest"),
  look: t.string().default("{}"),
}, "Player");

const State = schema({
  players: t.map(Player),
}, "ToonFieldState");

const NAME\_MAX = 18;
const MOVE\_MIN\_MS = 25;   // client sends about every 80 ms
const EMOTE\_MIN\_MS = 500;

export class ToonFieldRoom extends Room {
  state = new State();
  maxClients = 30;

  private lastMove = new Map&lt;string, number>();
  private lastEmote = new Map&lt;string, number>();

  onCreate() {
    this.onMessage("move", (client, data: any) => {
      const now = Date.now();
      if (now - (this.lastMove.get(client.sessionId) ?? 0) &lt; MOVE\_MIN\_MS) return;
      this.lastMove.set(client.sessionId, now);

      const p = this.state.players.get(client.sessionId);
      if (!p || !data || typeof data !== "object") return;

      if (Number.isFinite(data.x)) p.x = Math.max(-590, Math.min(590, data.x));
      if (Number.isFinite(data.y)) p.y = Math.max(0, Math.min(20, data.y));
      if (Number.isFinite(data.z)) p.z = Math.max(-590, Math.min(590, data.z));
      if (Number.isFinite(data.yaw)) p.yaw = data.yaw % (Math.PI \* 2);

      if (typeof data.name === "string") {
        p.name = data.name.slice(0, NAME\_MAX);
      }

      // Outfit + ride state ("bike" / "ele" / "") travel inside look
      if (typeof data.look === "string" &amp;&amp; data.look.length &lt;= 2000) {
        try {
          const l = JSON.parse(data.look);
          if (l &amp;&amp; typeof l === "object" &amp;&amp; !Array.isArray(l)) {
            if (l.ride !== "bike" &amp;&amp; l.ride !== "ele") l.ride = "";
            p.look = JSON.stringify(l);
          }
        } catch {
          // ignore invalid JSON, keep the previous look
        }
      }
    });

    this.onMessage("emote", (client, data: any) => {
      const allowedEmotes = &#91;"wave", "dance", "laugh", "cheer"&#93;;
      if (!data || !allowedEmotes.includes(data.type)) return;

      const now = Date.now();
      if (now - (this.lastEmote.get(client.sessionId) ?? 0) &lt; EMOTE\_MIN\_MS) return;
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
      typeof options?.name === "string" &amp;&amp; options.name.trim()
        ? options.name.slice(0, NAME\_MAX)
        : "Guest";
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastMove.delete(client.sessionId);
    this.lastEmote.delete(client.sessionId);
  }
}