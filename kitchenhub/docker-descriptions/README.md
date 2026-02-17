# Docker Hub Repository Descriptions

This directory contains the markdown descriptions that are automatically synced to Docker Hub repositories during the CI/CD build process.

## Files

- `backend.md` - Description for the `kitchenhub-backend` Docker image
- `frontend.md` - Description for the `kitchenhub-frontend` Docker image

## How It Works

The GitHub Actions workflow automatically updates Docker Hub repository descriptions after successfully building and pushing images. The workflow:

1. Reads the markdown files from this directory
2. Authenticates with Docker Hub API using the configured token
3. Updates the repository descriptions via Docker Hub's REST API

## Editing Descriptions

Simply edit the markdown files in this directory and commit your changes. The next build will automatically update the Docker Hub repositories.

**Note**: The descriptions support standard markdown formatting and will be rendered on Docker Hub.

## GitHub Repository Link

If you want to include a link to the GitHub repository, you can add it manually. The workflow doesn't automatically inject the repository URL, but you can reference it like:

```markdown
See [GitHub repository](https://github.com/your-username/self_hosted_web_apps) for more information.
```

Replace `your-username` with your actual GitHub username/organization.
