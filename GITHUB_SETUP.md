# GitHub Repository Setup Guide

This document outlines what you need to configure after moving this repository to GitHub.

## Security Review ✅

The following items have been checked and are safe for a public repository:

- ✅ No `.env` files are committed (only `env.example` exists)
- ✅ No hardcoded passwords or secrets in code
- ✅ Migration scripts contain example passwords (e.g., "masterkey") which are local development defaults, not production secrets
- ✅ All sensitive values use environment variables or secrets

## Required GitHub Configuration

### 1. Repository Secrets

Go to: **Settings → Secrets and variables → Actions → Secrets**

Add the following secrets:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username | `myusername` |
| `DOCKER_HUB_TOKEN` | Docker Hub access token (recommended) or password | `dckr_pat_...` |

**Creating a Docker Hub Access Token:**
1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Give it a name (e.g., "GitHub Actions")
4. Set permissions (read & write)
5. Copy the token and add it as `DOCKER_HUB_TOKEN` secret

### 2. Repository Variables (Optional)

Go to: **Settings → Secrets and variables → Actions → Variables**

These are optional and have defaults:

| Variable Name | Default | Description |
|--------------|---------|-------------|
| `BACKEND_IMAGE_NAME` | `kitchenhub-backend` | Backend Docker image name |
| `FRONTEND_IMAGE_NAME` | `kitchenhub-frontend` | Frontend Docker image name |

**Note**: Docker Hub uses the format `{username}/{repository-name}`. Images will be published as `{DOCKER_HUB_USERNAME}/{BACKEND_IMAGE_NAME}` and `{DOCKER_HUB_USERNAME}/{FRONTEND_IMAGE_NAME}`.

### 3. Workflow Permissions

The workflow should work with default permissions. If you encounter permission issues:

1. Go to **Settings → Actions → General**
2. Under "Workflow permissions", ensure "Read and write permissions" is selected
3. Check "Allow GitHub Actions to create and approve pull requests" if needed

## Workflow Behavior

The workflow will:

- ✅ Build on pushes to `main`/`master` branches
- ✅ Build on tags starting with `v*` (e.g., `v1.0.0`)
- ✅ Build (but not push) on pull requests
- ✅ Only trigger when files in `kitchenhub/` directory change
- ✅ Tag images with appropriate version tags
- ✅ Push `latest` tag for main/master branch and version tags

## Testing the Workflow

1. Push your code to GitHub
2. Go to **Actions** tab in your repository
3. You should see the workflow run automatically
4. Check the logs if there are any issues

## Image Naming Convention

Images will be published as:
- `{DOCKER_HUB_USERNAME}/{BACKEND_IMAGE_NAME}:{tag}`
- `{DOCKER_HUB_USERNAME}/{FRONTEND_IMAGE_NAME}:{tag}`

Example: `derpmhichurp/kitchenhub-backend:latest`

## Next Steps

1. ✅ Configure secrets in GitHub (see above)
2. ✅ Push code to GitHub
3. ✅ Verify workflow runs successfully
4. ✅ Update Portainer stack with your image names (see `kitchenhub/DEPLOYMENT.md`)

## Troubleshooting

### Workflow fails to authenticate
- Verify `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN` secrets are set correctly
- Ensure the token has read/write permissions
- Check that the token hasn't expired

### Images not found in Docker Hub
- Verify the image names match your Docker Hub repositories (format: `username/repository-name`)
- Check that images were successfully pushed in the Actions logs
- Ensure the repositories exist on Docker Hub (e.g., `derpmhichurp/kitchenhub-backend`, `derpmhichurp/kitchenhub-frontend`)
- Verify you have push permissions to these repositories

### Workflow doesn't trigger
- Check that you're pushing to `main` or `master` branch
- Verify files are in the `kitchenhub/` directory
- Check the workflow file path is `.github/workflows/docker-build.yml`
