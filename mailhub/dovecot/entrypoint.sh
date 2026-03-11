#!/bin/sh
# Ensure users file exists so Dovecot can start (admin must add real users)
if [ ! -f /home/mailhub-dovecot/users ]; then
  echo "# Create this file with passwd-file format: user:password:uid:gid:gecos:home:shell" > /home/mailhub-dovecot/users
  echo "# Example: alice:plainpass:5000:5000::/home/mailhub-dovecot/maildir/alice::" >> /home/mailhub-dovecot/users
fi
exec dovecot -F
