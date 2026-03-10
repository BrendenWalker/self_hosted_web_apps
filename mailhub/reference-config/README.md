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
