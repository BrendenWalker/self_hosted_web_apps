# Mailhub

Dockerized mail stack: **Postfix** (+ Fetchmail) → **Amavisd** (ClamAV + SpamAssassin) → **Dovecot** (LMTP, IMAP, Sieve/ManageSieve). Replaces a legacy Gentoo setup that used Courier-IMAP and procmail.

## Architecture

- **mailhub-postfix**: SMTP (25, 465), receives mail and sends through amavisd; after filtering, delivers via LMTP to Dovecot. Runs Fetchmail daemon (optional) to poll external mailboxes and inject into Postfix.
- **mailhub-amavisd**: Content filter (ports 10024/10025); runs ClamAV and SpamAssassin (file-based Bayes). Receives from Postfix, reinjects to Postfix after scanning.
- **mailhub-dovecot**: LMTP (port 24) for delivery + Sieve; IMAPS (993), ManageSieve (4190), POP3S (995). Maildir under `/home/mailhub-dovecot`; users via passwd-file.

All config and variable data lives under `**/home/<container_name>`** on the host (bind-mounted). Back up and edit these dirs as needed. The **SpamAssassin Bayes database** is stored in `mailhub-amavisd/bayes/` inside the amavisd data dir, so backing up `MAILHUB_DATA_ROOT/mailhub-amavisd` (e.g. `./mailhub-data/mailhub-amavisd` or `/host/data/mailhub/mailhub-amavisd`) includes the Bayes data for restore.

## Deploy (Portainer stack)

1. **Build and push images** (or use CI):
  - Tag format: `mailhub/<version>` (e.g. `mailhub/1.0.0`). Push tag to trigger [GitHub Actions](.github/workflows/docker-build.yml); images are built and pushed to Docker Hub.
  - Or build locally from repo root:  
  `docker build -t youruser/mailhub-postfix:latest -f mailhub/postfix/Dockerfile .`  
  (and same for `mailhub/amavisd/Dockerfile`, `mailhub/dovecot/Dockerfile`).
  - **Docker Hub rate limit**: If you see `429 Too Many Requests` or "pull rate limit" when building, log in first: `docker login`. Anonymous pulls are limited (100/6 hr); a free Docker Hub account gives 200/6 hr. CI uses `DOCKER_HUB_USERNAME` and `DOCKER_HUB_TOKEN` secrets.
  - **Local testing without registry**: from repo root run  
  `docker compose -f mailhub/docker-compose.yml up --build`.
2. **Prepare host data dirs** (e.g. `./mailhub-data` or `/host/data/mailhub`):
  - **Skeleton**: Copy `mailhub/host-data-skeleton` to your data root for a ready-made directory layout and commented example configs (`.example` files). Copy only the examples you need to the real filenames and edit.
  - `mailhub-postfix`: optional `main.cf`, `master.cf`, `aliases`, `fetchmailrc`, `sasl_passwd`. **fetchmailrc** must be mode 700 — the container sets this at startup if you forget. For relayhost SMTP auth put `sasl_passwd` here, then inside the container run `postmap /home/mailhub-postfix/sasl_passwd` and set `smtp_sasl_password_maps` in `main.cf`.
  - `mailhub-amavisd`: optional `amavisd.conf`, `clamd.conf`, `local.cf`; ClamAV DB and SpamAssassin Bayes live here (Bayes in `bayes/` on the host for backup). ClamAV DB is downloaded on first container start; to update it periodically run `docker exec mailhub-amavisd freshclam` (e.g. from cron).
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

## SpamAssassin learning (sa-learn)

To improve spam filtering over time, you can train SpamAssassin from messages in specific maildir folders. When **`SALEARN_USER_MAILDIRS`** is set, the amavisd container runs a daily job (03:00) that:

1. Scans the given path (a directory containing **one subdir per user**, each subdir being that user’s maildir root).
2. For each user, looks for either:
   - **`.Admin.Spam.Ham`** and **`.Admin.Spam.DefinateSpam`** — trains ham from the first, spam from the second, then deletes the contents of both folders.
   - **`.spam`** — trains spam only, then deletes the folder contents.
3. Runs **`sa-learn`** as the amavis user so the Bayes data in the amavisd data dir is updated.

**Setup:** Set `SALEARN_USER_MAILDIRS=/home/mailhub-dovecot/maildir` in the stack env (and ensure the stack mounts the dovecot data dir into the amavisd service, as in the repo’s `docker-compose.yml` and `portainer-stack.yml`). Create the folders in each user’s maildir as needed (e.g. `.Admin.Spam.Ham`, `.Admin.Spam.DefinateSpam`, or `.spam`). Move messages into those folders (via Sieve or your client), then let the daily job train and clean.

**Manual run:**  
`docker exec mailhub-amavisd /usr/local/bin/salearn-from-maildirs.sh`  
(ensure `USER_MAILDIRS` is set in the container, e.g. via stack env `SALEARN_USER_MAILDIRS`).

**Logs:** Cron output is appended to `/var/log/salearn.log` inside the container; inspect with `docker exec mailhub-amavisd cat /var/log/salearn.log`.

## Env vars (see .env.example)

- Registry/images: `DOCKER_HUB_REGISTRY_USERNAME`, `DOCKER_HUB_POSTFIX_IMAGE_NAME`, etc., `IMAGE_TAG`
- Data root: `MAILHUB_DATA_ROOT`
- Postfix: `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST`, `FETCHMAIL_POLL` (default 300). Optional: `FETCHMAIL_VERBOSE=1` to log fetchmail connection/auth to container stdout for debugging.
- Ports: `SMTP_PORT`, `SMTPS_PORT`, `IMAPS_PORT`, `IMAP_PORT` (143 for plain IMAP, e.g. localhost), `MANAGESIEVE_PORT`, `POP3S_PORT`
- Amavisd: `AMAVISD_MYHOSTNAME`, `AMAVISD_INET_ACL` (optional; space-separated IPs/CIDRs allowed to connect to the content filter, e.g. `127.0.0.1 [::1] 172.16.0.0/12`; default covers localhost and Docker 172.16.0.0/12). Quarantine: `AMAVISD_SPAM_QUARANTINE_TO`, `AMAVISD_VIRUS_QUARANTINE_TO` (optional); `AMAVISD_SPAM_KILL_LEVEL` (default 5.0) — mail at/above this score is blocked and quarantined. Spam tagging: `AMAVISD_SPAM_SUBJECT_TAG` (default `***SPAM*** `), `AMAVISD_SPAM_TAG_LEVEL` (score above which Subject gets the tag; default -999), `AMAVISD_SPAM_TAG2_LEVEL` (optional; score above which X-Spam-Flag etc. are added). See `reference-config/README.md` for the legacy Gentoo behavior these map to. **Sa-learn:** `SALEARN_USER_MAILDIRS` (optional; path inside container to directory of user maildirs, e.g. `/home/mailhub-dovecot/maildir` — when set, cron runs sa-learn daily at 03:00 and cleans processed messages), `SALEARN_SA_USER` (optional; default `amavis`).

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

## 500 error when updating the image on your local Docker host

If the image built and was pushed to Docker Hub but you get a **500 Internal Server Error** when updating (pull/redeploy) on your **local Docker host**:

- **Log in on the Docker host**: So pulls use your account instead of anonymous (avoids rate limits and some registry errors). On the machine where Docker runs (or where Portainer runs), run:  
  `docker login`  
  Use the same Docker Hub username (and token/password) as the one that pushed the image. Then retry the update.

- **Check Docker Hub status**: [status.docker.com](https://status.docker.com) — 500s are often temporary; wait for any incident to clear and try again.

- **Verify pull from the host**: SSH or open a shell on the Docker host and run:  
  `docker pull YOUR_USERNAME/mailhub-amavisd:YOUR_TAG`  
  Replace with your `DOCKER_HUB_REGISTRY_USERNAME` and `IMAGE_TAG`. If this succeeds, retry the update in Portainer (or your UI). If this also returns 500, the error is from Docker Hub or the network; retry later.

## High CPU when idle?

The stack is tuned to reduce idle CPU: clamd uses a single thread, `IdleTimeout`, and `SelfCheck` once per day; fetchmail defaults to a 5‑minute poll. Clamd runs with `nice -n 19`. Each container is limited to 512 MB and 0.5 CPU. Rebuild and redeploy so the updated `clamd.conf` and resource limits are in use.

If **clamd still uses high CPU with no mail traffic** (no scans requested), it may be a busy-wait bug in the ClamAV version in the image. From the **host** (strace is not in the container), find clamd’s PID then trace it:

```bash
docker top mailhub-amavisd
# Pick the PID of the clamd process (e.g. 12345), then:
strace -p 12345 -f 2>&1 | head -50
```

Repeated `epoll_pwait` or similar with no sleep suggests an upstream issue; try a newer image (or different base) or report to the ClamAV project.

**If clamd’s PID keeps changing** (PPID stable), supervisord is restarting clamd in a loop—that restart loop can cause high CPU. Find why clamd exits:

- **Container logs:** `docker logs mailhub-amavisd 2>&1` — look for repeated clamd startup lines or errors.
- **Clamd log:** `docker exec mailhub-amavisd tail -100 /var/log/clamav/clamd.log` — look for out-of-memory, fatal errors, or “Can’t connect to socket” (amavisd holding the socket).
- **OOM:** `docker inspect mailhub-amavisd --format '{{.State.OOMKilled}}'` — if `true`, the container hit the 512M limit; raise `mem_limit` for the amavisd service or tighten clamd/SpamAssassin further.

Fix the underlying exit cause (e.g. OOM, missing DB, config error); once clamd stays up, the restart loop and extra CPU stop.

## Fetchmail not fetching?

- **Logs**: `docker logs mailhub-postfix` shows fetchmail output. Set env `FETCHMAIL_VERBOSE=1` on the stack and restart to see connection/auth details.
- **First fetch**: The container runs one fetch immediately at startup, then polls every `FETCHMAIL_POLL` seconds (default 300).
- **UID tracking**: Fetchmail uses `/home/mailhub-postfix/.fetchids` so it doesn’t re-fetch the same messages. If the remote mailbox or config changed, remove that file on the host (in the postfix data dir) and restart so fetchmail rescans: e.g. `rm /path/to/mailhub-data/mailhub-postfix/.fetchids`.

## Testing quarantine

With `AMAVISD_SPAM_QUARANTINE_TO` and/or `AMAVISD_VIRUS_QUARANTINE_TO` set, amavisd sends copies of detected spam/virus to those addresses. The recipient must be a valid local address that Dovecot delivers to (add a user in `users` or use an alias). **Postfix must consider the quarantine domain local:** set **`MYDOMAIN`** to the exact domain you receive mail at (e.g. `muletrain.plud.org`), so that `mydestination` includes it and mail to `spam@muletrain.plud.org` is delivered via Dovecot instead of being relayed or bounced. Spam is only quarantined when the message’s SpamAssassin score reaches the **kill level** (5.0 when spam quarantine is enabled); virus mail is always blocked and quarantined when virus quarantine is set.

**Spam/virus shows "DiscardedOpenRelay" or "DiscardedOutbound" and never reaches quarantine:** Amavisd treats the recipient as non-local (outbound) and discards instead of quarantining. Set **`AMAVISD_LOCAL_DOMAINS`** to the **parent domain** of your local recipients (e.g. `plud.org` so that `user@muletrain.plud.org` is considered local). Use a single value; avoid extra words (e.g. use `plud.org`, not `plud.org and muletrain.plud.org`). In the stack env set e.g. `AMAVISD_LOCAL_DOMAINS=plud.org`, then **restart** the amavisd container (no image rebuild—config is read at startup). If `AMAVISD_LOCAL_DOMAINS` is unset, amavisd falls back to `MYDOMAIN` (e.g. set `MYDOMAIN=plud.org` so it matches). To confirm the variable in the container: `docker exec mailhub-amavisd env | grep AMAVISD_LOCAL_DOMAINS`. **Portainer users (env vars not in container):** (1) Ensure the stack’s **Compose content** is the latest `portainer-stack.yml`—the `mailhub-amavisd` service must list every env var (MYDOMAIN, AMAVISD_LOCAL_DOMAINS, AMAVISD_SPAM_QUARANTINE_TO, etc.) in its `environment:` section, or they will not be passed into the container even if set in Environment variables. (2) Add `AMAVISD_LOCAL_DOMAINS=plud.org` and the rest under the stack’s **Environment variables**. (3) Redeploy the stack so the amavisd container is recreated with the new env. If you override config via a file in the amavisd data dir (`amavisd.conf`), ensure it does not clear or override `@local_domains_acl` / `@local_domains_maps`, as 50-user.conf sets these after that file is loaded. If the stack never passes these env vars into the container (e.g. Portainer), use **stack.env**: in the amavisd data dir copy `stack.env.example` to `stack.env`, set `AMAVISD_LOCAL_DOMAINS=plud.org`, `MYDOMAIN=plud.org`, quarantine addresses, etc., then restart the amavisd container; the entrypoint sources `stack.env` at startup. See `host-data-skeleton/mailhub-amavisd/README.md`.

1. **Add a quarantine mailbox** (optional but recommended): In Dovecot’s `users` file add a user that will receive quarantined mail, e.g. `spam-q` or `virus-q`. Set the env vars to the matching address, e.g. `spam-q@yourdomain.com` (or `spam-q@localhost` if that’s how you receive).

2. **Spam test** — SpamAssassin treats the **GTUBE** string as spam. Send an email (to any local user) whose **body or subject** contains this exact line:
   ```
   XJS*C4JDBQADN1.NSBN3*2IDNEN*GTUBE-STANDARD-ANTI-UBE-TEST-EMAIL*C.34X
   ```
   If spam quarantine is enabled, a copy should be delivered to `AMAVISD_SPAM_QUARANTINE_TO`. Check that mailbox via IMAP.

3. **Virus test** — ClamAV treats the **EICAR** test string as a known virus. For reliable detection, send it as a **plain-text attachment**. Use the repo file `mailhub/eicar-test.txt` as the attachment, or create a file with exactly this line (no spaces/newlines before it):
   ```
   X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
   ```
   EICAR in the **body** alone often is not detected (encoding/newlines/context), so attachment is recommended. If virus quarantine is enabled, a copy should be delivered to `AMAVISD_VIRUS_QUARANTINE_TO`. If virus mail still passes, check `docker logs mailhub-amavisd` for `run_av` / `ClamAV` to see whether the scan ran and what it returned.

**Sending test mail**: From the host you can use `swaks` (e.g. `swaks --to user@yourdomain --from test@external --server localhost -p 25 --body '...'`) or any SMTP client. Ensure the message is accepted by Postfix and then check amavisd logs (`docker logs mailhub-amavisd`) and the quarantine mailbox.

**Log line “extra modules loaded”**: Amavisd lazily loads some Perl modules on first use and logs them at debug level. Harmless; you can ignore it or set a lower log level to reduce such lines.

## Reference configs

Legacy Gentoo configs are in `reference-config/` for comparison when tuning the Docker setup.