# mailhub-amavisd data directory

This directory is bind-mounted as `/home/mailhub-amavisd`. ClamAV virus DB and SpamAssassin Bayes data are stored here. **Back up this directory** (including the `bayes/` subdir) to preserve the SpamAssassin database.

## Env vars when the stack doesn't pass them

If the amavisd container does not receive `AMAVISD_LOCAL_DOMAINS`, `MYDOMAIN`, quarantine addresses, etc. from the orchestrator (e.g. Portainer stack env not applied to this service), use **stack.env**:

1. Copy `stack.env.example` to `stack.env` in this directory (same folder as `bayes/`, on the host under your mailhub-amavisd data path).
2. Edit `stack.env`: uncomment and set the variables you need (e.g. `AMAVISD_LOCAL_DOMAINS=plud.org`, `MYDOMAIN=plud.org`, `AMAVISD_SPAM_QUARANTINE_TO=...`, `AMAVISD_VIRUS_QUARANTINE_TO=...`).
3. Restart the amavisd container. The entrypoint sources `stack.env` before starting supervisord, so amavisd gets these values.

## Contents (created at runtime if missing)

- **ClamAV DB** — Downloaded on first start (`freshclam`). Update periodically:  
  `docker exec mailhub-amavisd freshclam` (e.g. from cron).
- **Bayes** — SpamAssassin file-based Bayes under `bayes/` (created at runtime). This lives on the host so backups of this data dir include the SpamAssassin database.

## Optional config overrides

The image uses built-in amavisd/ClamAV/SpamAssassin config. To customize without rebuilding:

- Copy `local.cf.example` to `local.cf` to tune SpamAssassin (scores, Bayes, etc.). If the container does not yet load `local.cf` from this dir, you can copy it into the container or use a custom entrypoint.

For now, use this folder mainly for **persistent data** (ClamAV DB, Bayes). Reference `.example` files are for local editing and copying into the container if needed.
