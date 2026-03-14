# mailhub-postfix data directory

Files here are bind-mounted into the container as `/home/mailhub-postfix`. Any file you add overrides the image default.

## Optional config files (copy from .example then edit)

| File         | Purpose |
|-------------|---------|
| `main.cf`   | Postfix main config. Env vars `MYHOSTNAME`, `MYDOMAIN`, `RELAYHOST` are applied at runtime even if you override this file. |
| `master.cf` | Postfix master config (services, content filter). |
| `aliases`   | Local aliases; run `newaliases` after editing (or let entrypoint do it on start). |
| `fetchmailrc` | Fetchmail config (poll external mailboxes). **Must be mode 700** — container sets this at startup if needed. |
| `sasl_passwd` | Relay SMTP auth: one line `[relayhost] username:password`. Then inside container run `postmap /home/mailhub-postfix/sasl_passwd` and ensure `main.cf` has `smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd.db`. |

## Steps

1. Copy only the `.example` files you need to the real name (e.g. `cp fetchmailrc.example fetchmailrc`).
2. Edit and, for `fetchmailrc`, run `chmod 700 fetchmailrc`.
3. Restart the container.
