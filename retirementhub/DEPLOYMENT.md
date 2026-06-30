# Deployment Guide (RetirementHub)

## Pre-built Docker images

Images are **public** on Docker Hub: [derpmhichurp repositories](https://hub.docker.com/repositories/derpmhichurp).

| Image | Description |
|-------|-------------|
| `derpmhichurp/retirementhub-backend` | Express API |
| `derpmhichurp/retirementhub-frontend` | React SPA (nginx) |

```bash
docker pull derpmhichurp/retirementhub-backend:latest
docker pull derpmhichurp/retirementhub-frontend:latest
```

Tags: `latest` (stable on `main`), `beta` (pre-release from other branches), or pinned semver (e.g. `2.0.3`).

## Portainer

1. Deploy [portainer-stack.yml](portainer-stack.yml) as a Compose stack on Docker Standalone.
2. Set `DOCKER_HUB_REGISTRY_USERNAME=derpmhichurp`, `IMAGE_TAG=latest` (or a pinned version), and `DB_*` variables.
3. Create external network `edge` once if your stack references it: `docker network create edge`.

Default ports: backend **8100**, frontend **8110**.

## Releases

Push a version tag to trigger CI (from repo root workflow):

```bash
git tag retirementhub/1.0.0
git push origin retirementhub/1.0.0
```

Tag on `main` without a pre-release suffix also publishes `:latest`. Tags on other branches also publish `:beta`.

See [KitchenHub DEPLOYMENT.md](../kitchenhub/DEPLOYMENT.md) for GitHub Actions secrets/variables (same `DOCKER_HUB_USERNAME` variable and `DOCKER_HUB_TOKEN` secret pattern).
