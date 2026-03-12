#!/bin/sh
# Ensure users file exists so Dovecot can start (admin must add real users)
if [ ! -f /home/mailhub-dovecot/users ]; then
  echo "# Create this file with passwd-file format: user:password:uid:gid:gecos:home:shell" > /home/mailhub-dovecot/users
  echo "# Example: braindead:{PLAIN}yourpassword:5000:5000::/home/mailhub-dovecot/maildir/braindead::" >> /home/mailhub-dovecot/users
fi
# Normalize line endings (CRLF -> LF) so Dovecot auth works; copy to temp and replace
if command -v sed >/dev/null 2>&1; then
  sed 's/\r$//' /home/mailhub-dovecot/users > /home/mailhub-dovecot/users.tmp && mv /home/mailhub-dovecot/users.tmp /home/mailhub-dovecot/users
fi
# Create Maildir (cur, new, tmp) for each user in the users file so LMTP delivery works
while IFS= read -r line; do
  case "$line" in ""|"#"*) continue ;; esac
  home=$(echo "$line" | cut -d: -f6)
  [ -z "$home" ] && continue
  for d in cur new tmp; do
    mkdir -p "$home/$d"
  done
  uid=$(echo "$line" | cut -d: -f3)
  gid=$(echo "$line" | cut -d: -f4)
  [ -n "$uid" ] && [ -n "$gid" ] && chown -R "$uid:$gid" "$home"
done < /home/mailhub-dovecot/users
exec dovecot -F
