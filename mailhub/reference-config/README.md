# Gentoo mail stack reference configs

These files are kept as reference when building the Docker mail stack. They were extracted from the original Gentoo server config tree; paths and daemon details (OpenRC, PAM, etc.) are for context only.

- **postfix/** – main.cf, master.cf (content_filter → amavis, reinject 10025); init.d-postfix shows dependencies (amavisd, antivirus).
- **clamav/** – clamd.conf (LocalSocket, User amavis), freshclam.conf.
- **spamassassin/** – local.cf (Bayes; Docker will use file-based, not MySQL); conf.d-spamd / init.d-spamd for daemon options.
- **courier-imap/** – authdaemond.conf (system users: authdaemond.plain); for Dovecot we will use passwd-file or similar.
- **fetchmail/** – conf.d (polling_period, pid_dir), init.d (daemon, /etc/fetchmailrc); Docker runs fetchmail inside the Postfix container.
- **mail/** – aliases (system and RFC2142); replicate in Docker Postfix.
- **amavisd/** – init.d (foreground, dependencies), amavisd_restart.start (restart hook).

Do not add secrets here; use `.env` or mounted secrets in Docker.

## Spam handling (reference behavior → Docker env)

The Gentoo setup effectively did:

- **Deliver** mail below the “kill” score (possibly with SpamAssassin headers and subject rewrite).
- **Quarantine** (and not deliver) mail at or above the kill score.
- **Subject rewrite**: SpamAssassin `local.cf` had (commented) `rewrite_header Subject *****SPAM*****`; in Docker, amavisd does the same via its spam subject tag.

In Docker this is controlled by amavisd policy and env:

| Behavior | Docker env / setting |
|----------|----------------------|
| Score above which mail is blocked and quarantined | `AMAVISD_SPAM_KILL_LEVEL` (default 5.0) |
| Score above which subject gets spam prefix | `AMAVISD_SPAM_TAG_LEVEL` (default -999 = tag all spam) |
| Score above which “spammy” headers (X-Spam-Flag etc.) are added | `AMAVISD_SPAM_TAG2_LEVEL` (optional) |
| Subject line prefix for spam | `AMAVISD_SPAM_SUBJECT_TAG` (default `***SPAM*** `) |
| Where to send quarantined spam/virus | `AMAVISD_SPAM_QUARANTINE_TO`, `AMAVISD_VIRUS_QUARANTINE_TO` |

So: mail with score **below** `AMAVISD_SPAM_KILL_LEVEL` is delivered (and can be tagged/rewritten by tag levels); mail **at or above** kill level is discarded and a copy is sent to the quarantine address when set.
