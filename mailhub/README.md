# Mailhub

Dockerized mail stack: **Postfix** (+ Fetchmail) → **Amavisd** (ClamAV + SpamAssassin) → **Dovecot** (LMTP, IMAP, Sieve/ManageSieve). Replaces a legacy Gentoo setup that used Courier-IMAP and procmail.

## Architecture

- **mailhub-postfix**: SMTP (25, 465), receives mail and sends through amavisd; after filtering, delivers via LMTP to Dovecot. Runs Fetchmail daemon (optional) to poll external mailboxes and inject into Postfix.
- **mailhub-amavisd**: Content filter (ports 10024/10025); runs ClamAV and SpamAssassin (file-based Bayes). Receives from Postfix, reinjects to Postfix after scanning.
- **mailhub-dovecot**: LMTP (port 24) for delivery + Sieve; IMAPS (993), ManageSieve (4190), POP3S (995). Maildir under `/home/mailhub-dovecot`; users via passwd-file.

All config and variable data lives under **`/home/<container_name>`** on the host (bind-mounted). Back up and edit these dirs as needed.

## Deploy (Portainer stack)

1. **Build and push images** (or use CI):
   - Tag format: `mailhub/<version>` (e.g. `mailhub/1.0.0`). Push tag to trigger [GitHub Actions](.github/workflows/docker-build.yml); images are built and pushed to Docker Hub.
   - Or build locally from repo root:  
     `docker build -t youruser/mailhub-postfix:latest -f mailhub/postfix/Dockerfile .`  
     (and same for `mailhub/amavisd/Dockerfile`, `mailhub/dovecot/Dockerfile`).
   - **Local testing without registry**: from repo root run  
     `docker compose -f mailhub/docker-compose.yml up --build`.

2. **Prepare host data dirs** (e.g. `./mailhub-data` or `/host/data/mailhub`):
   - `mailhub-postfix`: optional `main.cf`, `master.cf`, `aliases`, `.fetchmailrc`. For relayhost SMTP auth put `sasl_passwd` here, then inside the container run `postmap /home/mailhub-postfix/sasl_passwd` and set `smtp_sasl_password_maps` in `main.cf`.
   - `mailhub-amavisd`: optional `amavisd.conf`, `clamd.conf`, `local.cf`; ClamAV DB and SpamAssassin Bayes live here.
   - `mailhub-dovecot`: **required** `users` (passwd-file format: `user:password:uid:gid:gecos:home:shell`). Example:  
     `alice:plainpass:5000:5000::/home/mailhub-dovecot/maildir/alice::`  
     Create `maildir/<user>` per user; Sieve scripts in `sieve/` or per-user `~/sieve`, active script `~/.dovecot.sieve`.

3. **Portainer**: Add stack from `mailhub/portainer-stack.yml`. Set env (or use `.env` from `.env.example`):
   - `DOCKER_HUB_REGISTRY_USERNAME`, `IMAGE_TAG`
   - `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`
   - `MAILHUB_DATA_ROOT` = host path to the data dir (e.g. `/host/data/mailhub` or `./mailhub-data`).

4. **ManageSieve**: Connect mail clients to ManageSieve (port 4190) with the same credentials as IMAP to manage Sieve filters remotely.

## Env vars (see .env.example)

- Registry/images: `DOCKER_HUB_REGISTRY_USERNAME`, `DOCKER_HUB_POSTFIX_IMAGE_NAME`, etc., `IMAGE_TAG`
- Data root: `MAILHUB_DATA_ROOT`
- Postfix: `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`, `FETCHMAIL_POLL`
- Ports: `SMTP_PORT`, `SMTPS_PORT`, `IMAPS_PORT`, `MANAGESIEVE_PORT`, `POP3S_PORT`

## Reference configs

Legacy Gentoo configs are in `reference-config/` for comparison when tuning the Docker setup.
