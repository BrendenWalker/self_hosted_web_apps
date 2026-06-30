# Deployment Guide (PetHub)

## Pre-built Docker images

Images are **public** on Docker Hub: [derpmhichurp repositories](https://hub.docker.com/repositories/derpmhichurp).

| Image | Description |
|-------|-------------|
| `derpmhichurp/pethub-backend` | Flask API (Gunicorn) |
| `derpmhichurp/pethub-frontend` | React SPA (nginx) |

```bash
docker pull derpmhichurp/pethub-backend:latest
docker pull derpmhichurp/pethub-frontend:latest
```

Tags: `latest` (stable on `main`), `beta` (pre-release from other branches), or pinned semver.

## Portainer

1. Deploy [portainer-stack.yml](portainer-stack.yml) as a Compose stack on Docker Standalone.
2. Set `DOCKER_HUB_REGISTRY_USERNAME=derpmhichurp`, `IMAGE_TAG=latest` (or a pinned version), and `DB_*` / Flask secrets.
3. Create external network `edge` once if your stack references it: `docker network create edge`.

Default ports: backend **8120**, frontend **8130**.

## Releases

```bash
git tag pethub/1.0.0
git push origin pethub/1.0.0
```

Tag on `main` without a pre-release suffix also publishes `:latest`. Tags on other branches also publish `:beta`.

See [KitchenHub DEPLOYMENT.md](../kitchenhub/DEPLOYMENT.md) for GitHub Actions secrets/variables.
