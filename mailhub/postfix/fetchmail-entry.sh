#!/bin/sh
# Run fetchmail if fetchmailrc exists; otherwise sleep (so container still runs without fetchmail)
if [ ! -f /home/mailhub-postfix/fetchmailrc ]; then
  echo "No /home/mailhub-postfix/fetchmailrc; skipping fetchmail"
  exec sleep infinity
fi
POLL=${FETCHMAIL_POLL:-60}
exec /usr/bin/fetchmail -d "$POLL" -f /home/mailhub-postfix/fetchmailrc \
  --pidfile /home/mailhub-postfix/fetchmail.pid \
  -i /home/mailhub-postfix/.fetchids --nodetach
