# Deployment Guide

This guide covers setting up CI/CD with GitHub Actions and deploying with Portainer.

## Project Structure

This project is organized as a monorepo with the VehicleHub application in the `vehiclehub/` subfolder. The workflow is configured to only trigger builds when files in the `vehiclehub/` directory are modified.

If you use a different subfolder name, update the `paths` filter in `.github/workflows/docker-build.yml` and set the `PROJECT_SUBFOLDER` variable in GitHub (defaults to `vehiclehub`).

## GitHub Actions Setup

### Required Secrets

Configure the following secrets in your GitHub repository settings (Settings → Secrets and variables → Actions → Secrets):

1. **DOCKER_HUB_USERNAME** - Your Docker Hub username
2. **DOCKER_HUB_TOKEN** - Your Docker Hub access token (recommended) or password

**Note**: It's recommended to use a Docker Hub access token instead of your password. Create one at: https://hub.docker.com/settings/security

### Optional Variables

Configure the following variables in your GitHub repository settings (Settings → Secrets and variables → Actions → Variables):

1. **BACKEND_IMAGE_NAME** (optional) - Backend image name (defaults to `vehiclehub-backend`)
2. **FRONTEND_IMAGE_NAME** (optional) - Frontend image name (defaults to `vehiclehub-frontend`)

**Note**: Docker Hub uses the format `{username}/{repository-name}`. The image names will be constructed as `{DOCKER_HUB_USERNAME}/{BACKEND_IMAGE_NAME}` and `{DOCKER_HUB_USERNAME}/{FRONTEND_IMAGE_NAME}`.

### Image Tagging Strategy

The workflow uses **semver-based versioning** for releases. Use version tags in the form **`<service>/<version>`** with **X.X.X only** (no `v` prefix):

- **Version tags** (e.g., `vehiclehub/1.0.0`): Builds on any branch. Image is always tagged with the version (e.g. `1.0.0`).
  - **Tag on main** (stable): Also tagged as `latest`. Pre-releases on main (e.g. `1.0.0-beta.1`) are not tagged as `latest`.
  - **Tag on any other branch**: Also tagged as `beta` (floating pre-release tag).
- **Pull Requests**: Builds but doesn't push (tagged as `pr-{number}` for testing).

**Creating a Release:**
```bash
git tag vehiclehub/1.0.0
git push origin vehiclehub/1.0.0
```

Example image names:
- `derpmhichurp/vehiclehub-backend:latest` (only when tag is on main and stable)
- `derpmhichurp/vehiclehub-backend:beta` (when tag is on a branch other than main)
- `derpmhichurp/vehiclehub-backend:1.0.0`
- `derpmhichurp/vehiclehub-backend:1.0.0-beta.1` (pre-release)

## Portainer Stack Deployment

### Prerequisites

1. Portainer installed and running
2. Docker Hub images built and published (via GitHub Actions)
3. PostgreSQL database accessible from your Docker network

### Stack Configuration

1. In Portainer, go to **Stacks** → **Add Stack**
2. Name your stack (e.g., `vehiclehub`)
3. Select **Web editor** or **Upload** and paste the contents of `portainer-stack.yml`
4. Configure the following environment variables in Portainer's stack environment variables:

#### Required Variables

```env
# Docker Hub Configuration
DOCKER_HUB_REGISTRY_USERNAME=your-dockerhub-username
DOCKER_HUB_BACKEND_IMAGE_NAME=vehiclehub-backend
DOCKER_HUB_FRONTEND_IMAGE_NAME=vehiclehub-frontend
IMAGE_TAG=latest

# Database Configuration
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=vehiclehub
DB_USER=postgres
DB_PASSWORD=your-database-password

# Port Configuration (optional)
BACKEND_PORT=8090
FRONTEND_PORT=8091
```

#### Optional Variables

- `IMAGE_TAG` - Image tag to use (defaults to `latest`)
- `BACKEND_PORT` - Port mapping for backend (defaults to `8090`)
- `FRONTEND_PORT` - Port mapping for frontend (defaults to `8091`)

### Deploying the Stack

1. Fill in all required environment variables
2. Click **Deploy the stack**
3. Monitor the deployment in the **Containers** view
4. Access your application:
   - Frontend: `http://your-server:8091`
   - Backend API: `http://your-server:8090`

### Updating the Stack

To update to a new version:

1. Ensure new images are built and pushed to Docker Hub
2. Update the `IMAGE_TAG` environment variable in Portainer (or use `latest`)
3. Click **Editor** on your stack
4. Click **Update the stack** to pull and restart containers with new images

### Health Checks

The backend service includes a health check that verifies the API is responding. You can check container health in Portainer's container view.

## Troubleshooting

### Images Not Found

- Verify Docker Hub credentials and image names
- Check that images exist in Docker Hub with the specified tag
- Ensure `DOCKER_HUB_REGISTRY_USERNAME` matches your Docker Hub username
- Verify the repository names match (e.g., `derpmhichurp/vehiclehub-backend`)

### Database Connection Issues

- Verify `DB_HOST` is accessible from the Docker network
- If PostgreSQL is on the host, use `host.docker.internal` (Windows/Mac) or the host IP
- Check firewall rules and network configuration

### Build Failures

- Check GitHub Actions logs for build errors
- Verify Dockerfile paths and build contexts
- Ensure secrets are configured correctly in GitHub repository settings
