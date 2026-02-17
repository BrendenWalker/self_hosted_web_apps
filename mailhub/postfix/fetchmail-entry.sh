#!/bin/sh
# Run fetchmail if fetchmailrc exists; otherwise sleep (so container still runs without fetchmail)
if [ ! -f /home/mailhub-postfix/fetchmailrc ]; then
  echo "No /home/mailhub-postfix/fetchmailrc; skipping fetchmail"
  exec sleep infinity
fi
# Fetchmail requires fetchmailrc to be mode 700 (baked into image so host-created files work)
chmod 700 /home/mailhub-postfix/fetchmailrc
POLL=${FETCHMAIL_POLL:-300}
VERBOSE=""
[ -n "$FETCHMAIL_VERBOSE" ] && VERBOSE="-v"

# One-shot fetch immediately at startup (then daemon polls every POLL seconds)
echo "fetchmail: running initial fetch..."
if /usr/bin/fetchmail -f /home/mailhub-postfix/fetchmailrc \
  -i /home/mailhub-postfix/.fetchids --nodetach $VERBOSE 2>&1; then
  echo "fetchmail: initial fetch done."
else
  echo "fetchmail: initial fetch exited (may be no mail or transient error)."
fi

exec /usr/bin/fetchmail -d "$POLL" -f /home/mailhub-postfix/fetchmailrc \
  --pidfile /home/mailhub-postfix/fetchmail.pid \
  -i /home/mailhub-postfix/.fetchids --nodetach $VERBOSE
