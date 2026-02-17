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

The workflow uses **semver-based versioning** for safety and consistency:

### Version Tag Releases (Builds & Pushes)

- ✅ **Only builds and pushes on semver tags** (e.g., `v1.0.0`, `v2.1.3`, `v1.0.0-beta.1`)
- ✅ Validates tag format matches semver specification
- ✅ Tags images with:
  - Full tag name: `v1.0.0`
  - Version without 'v': `1.0.0`
  - `latest` (only for stable releases, not pre-releases)
- ✅ Automatically updates Docker Hub repository descriptions

### Pull Request Validation

- ✅ **PRs build but don't push** (for testing)
- ✅ Validates PR includes version information (warning only, doesn't block)
- ✅ Only triggers when files in `kitchenhub/` directory change

### Creating a Release

1. Create a semver tag: `git tag v1.0.0`
2. Push the tag: `git push origin v1.0.0`
3. The workflow will automatically:
   - Validate the tag format
   - Build and push images
   - Tag with version and `latest` (if stable release)
   - Update Docker Hub descriptions

**Supported tag formats:**
- `v1.0.0` - Stable release (tags as `latest`)
- `v1.0.0-beta.1` - Pre-release (doesn't tag as `latest`)
- `v2.1.3+build.1` - Build metadata

## Testing the Workflow

### Testing with a PR

1. Create a pull request to `main`/`master`
2. The workflow will build images (but not push) for testing
3. Check the Actions tab to see build results

### Creating a Release

1. **Create and push a version tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **The workflow will automatically:**
   - Validate the semver format
   - Build both backend and frontend images
   - Push to Docker Hub with version tags
   - Update Docker Hub descriptions

3. **Check the results:**
   - Go to **Actions** tab to see the workflow run
   - Check Docker Hub for your new images
   - Images will be tagged as: `v1.0.0`, `1.0.0`, and `latest` (for stable releases)

## Image Naming Convention

Images will be published as:
- `{DOCKER_HUB_USERNAME}/{BACKEND_IMAGE_NAME}:{tag}`
- `{DOCKER_HUB_USERNAME}/{FRONTEND_IMAGE_NAME}:{tag}`

Example: `derpmhichurp/kitchenhub-backend:latest`

## Docker Hub Repository Descriptions

The workflow automatically updates Docker Hub repository descriptions from markdown files:

- **Location**: `kitchenhub/docker-descriptions/`
- **Files**: `backend.md` and `frontend.md`
- **When**: After successfully pushing images (not on pull requests)

Simply edit these markdown files and commit. The next build will automatically sync them to Docker Hub.

See `kitchenhub/docker-descriptions/README.md` for more details.

## Next Steps

1. ✅ Configure secrets in GitHub (see above)
2. ✅ Review and customize Docker Hub descriptions in `kitchenhub/docker-descriptions/`
3. ✅ Push code to GitHub
4. ✅ Verify workflow runs successfully
5. ✅ Check Docker Hub repositories to see updated descriptions
6. ✅ Update Portainer stack with your image names (see `kitchenhub/DEPLOYMENT.md`)

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
