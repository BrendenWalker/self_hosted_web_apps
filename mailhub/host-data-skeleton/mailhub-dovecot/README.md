# mailhub-dovecot data directory

This directory is bind-mounted as `/home/mailhub-dovecot`. You **must** provide a `users` file (passwd-file format) so Dovecot can authenticate and deliver mail.

## Required

- **users** — Copy from `users.example` to `users` and add your accounts. Format:  
  `user:password:uid:gid:gecos:home:shell`  
  Use the **local part** as `user` (e.g. `braindead` for `braindead@localhost`).  
  Password: `{PLAIN}yourpassword` or `{BLF-CRYPT}$2y$05$...`. No colons in the password.  
  Use Unix line endings (LF). Entrypoint normalizes CRLF→LF on start.

## Optional

- **maildir/** — Created automatically per user from `users` (cur, new, tmp). Mail is stored here.
- **sieve/** — Default Sieve script; active script is `~/.dovecot.sieve` per user (e.g. via ManageSieve on port 4190).
- **ssl/** — If you add `cert.pem` and `key.pem`, enable SSL in Dovecot config (image may check for these).

## Example users line

```
braindead:{PLAIN}yourpassword:5000:5000::/home/mailhub-dovecot/maildir/braindead::
```

Uid/gid 5000:5000 match the image’s `vmail` user. Home must be under `/home/mailhub-dovecot` (e.g. `.../maildir/braindead`).
