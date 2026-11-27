# LanLords Admin

The admin panel for Lanlords. It needs to run on a system with Docker and uses
the Docket socket to run game-servers in Docker containers. This is very
opiniated and created specifically for the Lanlords LAN event.

## Development

```sh
npm install
npm run dev
```

`npm run dev` starts the API (`http://127.0.0.1:8787`) and Vite
(`http://127.0.0.1:5173`) together. Vite proxies `/api` to the backend. Set
`PORT`/`API_URL` if you need different ports.

Other commands:

- `npm run dev:web` / `npm run dev:server` — run one side only
- `npm run typecheck`
- `npm test`
- `npm run build && npm start` — production build

The backend reads `config.yaml` and the templates in `templates/`. Override the
paths with `CONFIG_PATH` and `TEMPLATES_DIR`.

When the backend runs on the host (plain `npm run dev`), container management
and logs work through the socket, but live query metrics may not reach
container IPs on Docker Desktop. Use the compose setup for live metrics.

## Configuration

The schema is defined in the `config.yaml` file and validated at startup. Each
game defines:

- `image` and optional `tag` (defaults to `defaults.tag`)
- optional `network` — omit it for the Docker default bridge; in production set
  `local` to attach game containers to the macvlan network
- `command` — CLI arguments with `{placeholder}` variables
- `configs[].template` / `configs[].target` — Nunjucks template and its absolute
  path inside the game container
- optional `query` — `gamedig` type and game port (gamedig handles separate query ports)

Rendered configs are uploaded into the container before it starts, so no host
path is shared with the admin container. Creating a server never pulls its
image: the tag must already be present locally. Pull or update images
explicitly from the **Images** dialog in the admin UI (or `POST
/api/images/pull` and `/api/images/pull-all`); this keeps game client versions
from changing unexpectedly.

## Docker

```sh
docker compose up -d --build
```

The compose file mounts `/var/run/docker.sock`, `config.yaml`, and `templates/`,
and uses Docker's default bridge so it can reach game containers created without
a `network`. The admin container intentionally runs as root to access the Docker
socket.

In production, attach the admin container to the same `local` macvlan network
(or otherwise make game container IPs reachable); otherwise container state and
logs still work, but live query metrics show as unavailable.
