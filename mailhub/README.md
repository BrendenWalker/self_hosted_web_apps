# Mailhub

Dockerized mail stack: **Postfix** (+ Fetchmail) → **Amavisd** (ClamAV + SpamAssassin) → **Dovecot** (LMTP, IMAP, Sieve/ManageSieve). Replaces a legacy Gentoo setup that used Courier-IMAP and procmail.

## Architecture

- **mailhub-postfix**: SMTP (25, 465), receives mail and sends through amavisd; after filtering, delivers via LMTP to Dovecot. Runs Fetchmail daemon (optional) to poll external mailboxes and inject into Postfix.
- **mailhub-amavisd**: Content filter (ports 10024/10025); runs ClamAV and SpamAssassin (file-based Bayes). Receives from Postfix, reinjects to Postfix after scanning.
- **mailhub-dovecot**: LMTP (port 24) for delivery + Sieve; IMAPS (993), ManageSieve (4190), POP3S (995). Maildir under `/home/mailhub-dovecot`; users via passwd-file.

All config and variable data lives under `**/home/<container_name>`** on the host (bind-mounted). Back up and edit these dirs as needed.

## Deploy (Portainer stack)

1. **Build and push images** (or use CI):
  - Tag format: `mailhub/<version>` (e.g. `mailhub/1.0.0`). Push tag to trigger [GitHub Actions](.github/workflows/docker-build.yml); images are built and pushed to Docker Hub.
  - Or build locally from repo root:  
  `docker build -t youruser/mailhub-postfix:latest -f mailhub/postfix/Dockerfile .`  
  (and same for `mailhub/amavisd/Dockerfile`, `mailhub/dovecot/Dockerfile`).
  - **Local testing without registry**: from repo root run  
  `docker compose -f mailhub/docker-compose.yml up --build`.
2. **Prepare host data dirs** (e.g. `./mailhub-data` or `/host/data/mailhub`):
  - **Skeleton**: Copy `mailhub/host-data-skeleton` to your data root for a ready-made directory layout and commented example configs (`.example` files). Copy only the examples you need to the real filenames and edit.
  - `mailhub-postfix`: optional `main.cf`, `master.cf`, `aliases`, `fetchmailrc`, `sasl_passwd`. **fetchmailrc** must be mode 700 — the container sets this at startup if you forget. For relayhost SMTP auth put `sasl_passwd` here, then inside the container run `postmap /home/mailhub-postfix/sasl_passwd` and set `smtp_sasl_password_maps` in `main.cf`.
  - `mailhub-amavisd`: optional `amavisd.conf`, `clamd.conf`, `local.cf`; ClamAV DB and SpamAssassin Bayes live here. ClamAV DB is downloaded on first container start; to update it periodically run `docker exec mailhub-amavisd freshclam` (e.g. from cron).
  - `mailhub-dovecot`: **required** `users` (passwd-file format: `user:password:uid:gid:gecos:home:shell`). Use the **local part** as `user` (e.g. `braindead`); LMTP recipient `braindead@localhost` will match via `auth_username_format`. For **plaintext** passwords use the `{PLAIN}` prefix in the password field. Example:  
  `braindead:{PLAIN}yourpassword:5000:5000::/home/mailhub-dovecot/maildir/braindead::`  
  Or use a hash: `{BLF-CRYPT}$2y$05$...`. The entrypoint creates `maildir/<user>/cur`, `new`, `tmp` from `users` and chowns to the file’s uid:gid (use 5000:5000 to match the image’s `vmail` user). Sieve scripts in `sieve/` or per-user `~/sieve`, active script `~/.dovecot.sieve`.  
  **Auth:** Password must not contain colons. Use Unix line endings (LF) in `users` (entrypoint normalizes CRLF→LF on start). If IMAP login fails, check Dovecot logs for the auth_verbose reason.
3. **Portainer**: Add stack from `mailhub/portainer-stack.yml`. Set env (or use `.env` from `.env.example`):
  - `DOCKER_HUB_REGISTRY_USERNAME`, `IMAGE_TAG`
  - `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`
  - `MAILHUB_DATA_ROOT` = host path to the data dir (e.g. `/host/data/mailhub` or `./mailhub-data`).
  - **Outbound (fetchmail / relay)**: All services attach to an external network named `public` so the stack declares networks consistently and `mailhub-postfix` can reach the internet. Create it once before deploying:  
  `docker network create public`  
  If you use a different network for outbound, change the name in the stack’s `networks` section and under each service’s `networks`.
4. **ManageSieve**: Connect mail clients to ManageSieve (port 4190) with the same credentials as IMAP to manage Sieve filters remotely.

## Env vars (see .env.example)

- Registry/images: `DOCKER_HUB_REGISTRY_USERNAME`, `DOCKER_HUB_POSTFIX_IMAGE_NAME`, etc., `IMAGE_TAG`
- Data root: `MAILHUB_DATA_ROOT`
- Postfix: `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`, `FETCHMAIL_POLL` (default 60). Optional: `FETCHMAIL_VERBOSE=1` to log fetchmail connection/auth to container stdout for debugging.
- Ports: `SMTP_PORT`, `SMTPS_PORT`, `IMAPS_PORT`, `IMAP_PORT` (143 for plain IMAP, e.g. localhost), `MANAGESIEVE_PORT`, `POP3S_PORT`
- Amavisd: `AMAVISD_MYHOSTNAME`, `AMAVISD_INET_ACL` (optional; space-separated IPs/CIDRs allowed to connect to the content filter, e.g. `127.0.0.1 [::1] 172.16.0.0/12`; default covers localhost and Docker 172.16.0.0/12). Quarantine recipients: `AMAVISD_SPAM_QUARANTINE_TO` and `AMAVISD_VIRUS_QUARANTINE_TO` (optional; set to the recipient address for spam/virus quarantine, or leave blank/unset to disable). When spam quarantine is enabled, `AMAVISD_SPAM_KILL_LEVEL` (default 5.0) sets the SpamAssassin score at/above which mail is blocked and quarantined.

## Migrating from Courier (or other) Maildir

If you copy an existing Maildir (e.g. from Courier) into Dovecot’s user directory, **IMAP clients often show only “subscribed” folders** (LSUB). Dovecot’s folder list is built from the filesystem, but the client’s visible list comes from the `**subscriptions`** file in the user’s maildir root. If that file doesn’t list the migrated folders, they won’t appear until you subscribe to them or fix the file.

**Fix: regenerate `subscriptions`** so every maildir folder is subscribed.

**From inside the Dovecot container** (script is in the image):

```bash
docker exec mailhub-dovecot regenerate-dovecot-subscriptions /home/mailhub-dovecot/maildir/braindead 5000:5000
```

**From the host** (using the script in the repo):

```bash
./mailhub/scripts/regenerate-dovecot-subscriptions.sh /path/to/mailhub-dovecot/maildir/braindead 5000:5000
```

Then in the mail client, **refresh folder list** (e.g. right‑click account → “Refresh” or “Get Messages”). If the client has “Show only subscribed folders” enabled, turn it off to see all, or leave it on and the new `subscriptions` will make all folders appear as subscribed.

**Optional:** Clear Dovecot’s list index so it rescans dirs: remove (or rename) `dovecot.list.index.log` and `dovecot.index.cache` in the user’s maildir root, then reconnect; Dovecot will rebuild them.

## Fetchmail not fetching?

- **Logs**: `docker logs mailhub-postfix` shows fetchmail output. Set env `FETCHMAIL_VERBOSE=1` on the stack and restart to see connection/auth details.
- **First fetch**: The container runs one fetch immediately at startup, then polls every `FETCHMAIL_POLL` seconds (default 60).
- **UID tracking**: Fetchmail uses `/home/mailhub-postfix/.fetchids` so it doesn’t re-fetch the same messages. If the remote mailbox or config changed, remove that file on the host (in the postfix data dir) and restart so fetchmail rescans: e.g. `rm /path/to/mailhub-data/mailhub-postfix/.fetchids`.

## Testing quarantine

With `AMAVISD_SPAM_QUARANTINE_TO` and/or `AMAVISD_VIRUS_QUARANTINE_TO` set, amavisd sends copies of detected spam/virus to those addresses. The recipient must be a valid local address that Dovecot delivers to (add a user in `users` or use an alias). Spam is only quarantined when the message’s SpamAssassin score reaches the **kill level** (5.0 when spam quarantine is enabled); virus mail is always blocked and quarantined when virus quarantine is set.

1. **Add a quarantine mailbox** (optional but recommended): In Dovecot’s `users` file add a user that will receive quarantined mail, e.g. `spam-q` or `virus-q`. Set the env vars to the matching address, e.g. `spam-q@yourdomain.com` (or `spam-q@localhost` if that’s how you receive).

2. **Spam test** — SpamAssassin treats the **GTUBE** string as spam. Send an email (to any local user) whose **body or subject** contains this exact line:
   ```
   XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X
   ```
   If spam quarantine is enabled, a copy should be delivered to `AMAVISD_SPAM_QUARANTINE_TO`. Check that mailbox via IMAP.

3. **Virus test** — ClamAV treats the **EICAR** test string as a known virus. Send an email with the EICAR content as **body** or **attachment** (plain text):
   ```
   X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
   ```
   If virus quarantine is enabled, a copy should be delivered to `AMAVISD_VIRUS_QUARANTINE_TO`.

**Sending test mail**: From the host you can use `swaks` (e.g. `swaks --to user@yourdomain --from test@external --server localhost -p 25 --body '...'`) or any SMTP client. Ensure the message is accepted by Postfix and then check amavisd logs (`docker logs mailhub-amavisd`) and the quarantine mailbox.

## Reference configs

Legacy Gentoo configs are in `reference-config/` for comparison when tuning the Docker setup.