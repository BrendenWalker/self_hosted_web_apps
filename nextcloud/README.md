# Nextcloud (custom Apache image)

Self-hosted [Nextcloud](https://nextcloud.com/) on Docker with the **SMB** PHP extension (`smbclient`) and an optional hook to append an internal root CA to Nextcloud’s TLS bundle (for trusted connections to internal services).

## Prerequisites

- Docker and Docker Compose
- PostgreSQL reachable from the stack (existing server or separate container)
- Reverse proxy / TLS in front of production (optional for local testing)

## Quick start (Docker Compose)

1. From this directory:

   ```bash
   cp env.example .env
   ```

2. Edit `.env`: set `POSTGRES_*`, `NEXTCLOUD_TRUSTED_DOMAINS`, and host paths for volumes if not using the defaults.

3. Optional: place your internal CA PEM as `docker/certs/HomeCA.crt`, then build so the image trusts it (omit for SMB-only without custom CA).

4. Build and start:

   ```bash
   docker compose up -d --build
   ```

5. Open `http://localhost:${NEXTCLOUD_HTTP_PORT:-8120}` and complete the Nextcloud setup wizard if this is a new install.

Bind mounts under `./volumes/` hold the application tree, user data, and configuration. Point Redis in Nextcloud’s admin settings (or `config.php`) at host `redis` on the compose network if you use the included Redis service.

## Building the image without Compose

```bash
cd docker
./build.sh
```

On Windows, run the same `docker build` command from `docker/build.sh` manually, or use Compose with `--build`.

## Portainer / Swarm

- Build and tag the image (or push to your registry).
- Use `portainer-stack.yml`; define the same variables as in `env.example` in the stack environment (paths are usually absolute on the host).
- The stack expects an **external** Docker network named `web` (attach your reverse proxy to the same network). To use an internal network only, replace the `networks` section with a bridge network as in `docker-compose.yml`.

## What the image adds

- `smbclient` PECL extension and CLI `smbclient` for external storage / SMB.
- Optional `docker/certs/HomeCA.crt` baked in at build time; entrypoint hook `docker/docker-entrypoint.d/99-add-homeca.sh` appends it to `resources/config/ca-bundle.crt` when present.

## Ports

Default Compose HTTP port **8120** avoids overlapping other apps in this monorepo (VehicleHub uses 8090/8091). Override with `NEXTCLOUD_HTTP_PORT` in `.env`.
