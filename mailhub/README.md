# Mailhub

Dockerized mail stack: **Postfix** (+ Fetchmail) → **Amavisd** (ClamAV + SpamAssassin) → **Dovecot** (LMTP, IMAP, Sieve/ManageSieve). Suited to a small self-hosted or lab deployment.

## Architecture

- **mailhub-postfix**: SMTP (25, 465), receives mail and sends through amavisd; after filtering, delivers via LMTP to Dovecot. Optional Fetchmail daemon to poll external mailboxes.
- **mailhub-amavisd**: Content filter (ports 10024/10025); ClamAV and SpamAssassin (file-based Bayes).
- **mailhub-dovecot**: LMTP (port 24) for delivery + Sieve; IMAPS (993), ManageSieve (4190), POP3S (995). Maildir under `/home/mailhub-dovecot`; users via passwd-file.

Config and variable data live under `**/home/<container_name>` on the host (bind-mounted). The SpamAssassin Bayes database is under `mailhub-amavisd/bayes/` inside the amavisd data dir—include that path when backing up.

## Deploy (Portainer stack)

1. **Images** — Build locally or use CI; see repo root workflows. For local testing: `docker compose -f mailhub/docker-compose.yml up --build`. Log in to Docker Hub if you hit pull rate limits (`docker login`).
2. **Host data dirs** — Copy `mailhub/host-data-skeleton` to your data root for layout and `.example` files. **mailhub-dovecot** needs a **`users`** file (passwd-file). Use the **local part** as `user` (e.g. `user1`); LMTP `user1@localhost` matches via `auth_username_format`. Example line:  
   `user1:{PLAIN}yourpassword:5000:5000::/home/mailhub-dovecot/maildir/user1::`  
   Or use `{BLF-CRYPT}$2y$05$...`. Entrypoint creates `maildir/<user>/cur`, `new`, `tmp`. Passwords must not contain colons; use LF in `users`.
3. **Portainer** — Deploy from `mailhub/portainer-stack.yml`. Set `DOCKER_HUB_REGISTRY_USERNAME`, `IMAGE_TAG`, `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`, `MAILHUB_DATA_ROOT`, etc. (see `.env.example`). Create external network `public` if the stack references it, or adjust the network name.
4. **ManageSieve** — Port 4190; same credentials as IMAP.

## SpamAssassin learning (sa-learn)

When **`SALEARN_USER_MAILDIRS`** is set, amavisd runs a daily job that trains from folders like `.Admin.Spam.Ham` / `.Admin.Spam.DefinateSpam` or `.spam`. Set `SALEARN_USER_MAILDIRS=/home/mailhub-dovecot/maildir` and mount dovecot data into amavisd as in the repo compose files. Manual run: `docker exec mailhub-amavisd /usr/local/bin/salearn-from-maildirs.sh`. Logs: `/var/log/salearn.log` in the container.

## Env vars

See `mailhub/.env.example` for registry/image names, `MAILHUB_DATA_ROOT`, Postfix (`MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`, `FETCHMAIL_POLL`), ports, and amavisd (`AMAVISD_*`, quarantine, `SALEARN_*`). Reference behavior notes: `reference-config/README.md`.

## Migrating Maildir (e.g. from Courier)

IMAP clients may only show subscribed folders. Regenerate `subscriptions` after migration:

```bash
docker exec mailhub-dovecot regenerate-dovecot-subscriptions /home/mailhub-dovecot/maildir/user1 5000:5000
```

Or from the host: `./mailhub/scripts/regenerate-dovecot-subscriptions.sh /path/to/mailhub-dovecot/maildir/user1 5000:5000`

Optionally remove `dovecot.list.index.log` and `dovecot.index.cache` in the user’s maildir root so Dovecot rescans.

## Operational notes

- **Registry / Portainer 500 on pull** — `docker login` on the host; verify `docker pull your-registry/mailhub-*:tag`; check [Docker status](https://status.docker.com).
- **High idle CPU** — Stack sets clamd/fetchmail limits; if clamd loops, check `docker logs mailhub-amavisd`, `clamd.log`, OOM, and image/base updates.
- **Fetchmail** — Logs on `mailhub-postfix`; `FETCHMAIL_VERBOSE=1` for detail. `.fetchids` in postfix data dir tracks UIDs; delete to force a full rescan if needed.
- **Quarantine** — Set `AMAVISD_SPAM_QUARANTINE_TO` / `AMAVISD_VIRUS_QUARANTINE_TO` to valid local users. **`MYDOMAIN`** must match the domain you receive on so Postfix treats quarantine addresses as local. If spam is discarded as outbound/nonlocal, set **`AMAVISD_LOCAL_DOMAINS`** to your parent domain (e.g. `example.com`) so addresses like `user@mail.example.com` are local—see comments in `amavisd/50-user.conf` and stack env wiring in Portainer.

**Spam test** — Body or subject containing the GTUBE line (standard SpamAssassin test string) should score as spam if quarantine is enabled. **Virus test** — Attach `mailhub/eicar-test.txt` or the exact EICAR one-liner; body-only often is not detected. Use `swaks` or any SMTP client to localhost:25 if needed.

## Reference configs

Legacy reference files are in `reference-config/` for comparison when tuning the Docker setup.
