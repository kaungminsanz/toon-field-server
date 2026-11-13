# Welcome to Colyseus!

This project was created with [⚔️ `create-colyseus-app`](https://github.com/colyseus/create-colyseus-app/).

[Documentation](https://docs.colyseus.io/)

## :crossed_swords: Usage

```
npm start
```

Then open http://localhost:2567 to play, or /monitor for the monitor.

The standalone game page is `index.html`. Its multiplayer URL defaults to the
page's origin, maps a forwarded Codespaces port to the Colyseus server on
2567, and uses `ws://localhost:2567` when opened as a local file. If the page
and game server are hosted separately, set the `colyseus-server-url` meta tag
in `index.html` to the server's WebSocket URL. For the Railway deployment,
use `wss://<your-railway-domain>`; leave the tag empty for Codespaces
development auto-detection.

## Railway deployment

1. Create a Railway project and deploy this repository as a service. Set the
   service's **Root Directory** to `/server`.
2. The included `railway.json` builds with `npm run build`, starts the
   compiled server, checks `/hi`, and configures restart-on-failure. Railway
   supplies `PORT`; the server binds to `0.0.0.0` and falls back to `2567`
   for local development.
3. In the Railway service's **Settings → Networking**, generate a public
   domain. Confirm the deployment is healthy at `https://<your-railway-domain>/hi`.
4. Configure the Netlify site with the repository root as its base directory
   and `server` as its publish directory. In the source `server/index.html`,
   set `<meta name="colyseus-server-url" content="wss://<your-railway-domain>">`
   to the Railway public domain, then commit and redeploy the frontend. Do not
   include a port in the URL; Railway terminates TLS and forwards WebSocket
   traffic to the server's assigned `PORT`.
5. To continue using the same page in Codespaces, clear the meta tag's
   `content` value there. The page then selects the forwarded port ending in
   `-2567.app.github.dev` automatically.

Keep the game's room name (`toon_field`) unchanged when connecting through the
Netlify page. The Railway TLS WebSocket connection carries the existing
Colyseus multiplayer and voice-signaling messages; WebRTC voice audio remains
peer-to-peer and still requires working ICE/STUN/TURN configuration.

Voice chat is opt-in and works alongside text chat. Nearby mode connects
players within 20 game units, with positional HRTF audio and distance-based
volume. Use **Mute mic** to stop transmitting without leaving the voice
channel.

Voice uses peer-to-peer WebRTC audio and requires microphone permission in the
browser. The `voice-ice-servers` meta tag in `index.html` must contain a JSON
array of ICE server objects. It defaults to Google's public STUN service for
NAT discovery; STUN sees the connecting clients' network addresses, while
voice audio remains peer-to-peer. Replace it with infrastructure you control
if needed. Some restrictive networks require TURN; do not put long-lived TURN
credentials in the public HTML.

## Structure

- `src/index.ts`: entry point — leave it alone if you plan to deploy to Colyseus Cloud
- `src/app.config.ts`: server configuration — rooms, HTTP routes, express middleware
- `src/rooms/MyRoom.ts`: your room handler
- `src/rooms/schema/MyRoomState.ts`: the state synchronized to every client in the room
- `test/MyRoom.test.ts`: boots the real server and connects a real client
- `loadtest/example.ts`: scriptable client for `npm run loadtest`
- `ecosystem.config.cjs`: pm2 configuration, used when deploying to Colyseus Cloud

## Scripts

- `npm start`: run the server in watch mode (`tsx watch src/index.ts`)
- `npm test`: run the mocha test suite
- `npm run build`: compile to `build/`
- `npm run loadtest`: connect N simulated clients with [`@colyseus/loadtest`](https://github.com/colyseus/colyseus-loadtest/)

