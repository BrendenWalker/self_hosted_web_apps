# mailhub-amavisd data directory

This directory is bind-mounted as `/home/mailhub-amavisd`. ClamAV virus DB and SpamAssassin Bayes data are stored here.

## Contents (created at runtime if missing)

- **ClamAV DB** — Downloaded on first start (`freshclam`). Update periodically:  
  `docker exec mailhub-amavisd freshclam` (e.g. from cron).
- **Bayes** — SpamAssassin file-based Bayes under `bayes/` (created by image).

## Optional config overrides

The image uses built-in amavisd/ClamAV/SpamAssassin config. To customize without rebuilding:

- Copy `local.cf.example` to `local.cf` to tune SpamAssassin (scores, Bayes, etc.). If the container does not yet load `local.cf` from this dir, you can copy it into the container or use a custom entrypoint.

For now, use this folder mainly for **persistent data** (ClamAV DB, Bayes). Reference `.example` files are for local editing and copying into the container if needed.
