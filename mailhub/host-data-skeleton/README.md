# Mailhub host data skeleton

Copy this directory tree to your host path used as `MAILHUB_DATA_ROOT` (e.g. `./mailhub-data` or `/host/data/mailhub`). All folders and example configs are included so you can drop it into place and have a working reference.

## Quick start

1. Copy the skeleton to your data root:
   ```bash
   cp -r host-data-skeleton /path/to/mailhub-data
   ```
2. In each service subfolder, copy `.example` files to the real names when you want to override defaults (see per-service READMEs).
3. **fetchmailrc**: After creating or copying `fetchmailrc`, set permissions: `chmod 700 fetchmailrc`. (The container also fixes this at startup if you forget.)
4. Start the stack with `MAILHUB_DATA_ROOT=/path/to/mailhub-data`.

## Directory layout

- **mailhub-postfix** — Postfix + Fetchmail. Optional: `main.cf`, `master.cf`, `aliases`, `fetchmailrc` (mode 700), `sasl_passwd` (then `postmap sasl_passwd`).
- **mailhub-amavisd** — Amavisd/ClamAV/SpamAssassin. Optional overrides; ClamAV DB and Bayes data live here.
- **mailhub-dovecot** — Dovecot. **Required**: `users` (passwd-file format). Maildirs and Sieve scripts here.

See each subfolder’s README for details and commented options.
