#!/bin/sh
set -e
# Ensure decoders are findable by amavisd (supervisord child may inherit this)
export PATH="/usr/bin:/usr/local/bin:/bin${PATH:+:$PATH}"

# Optional: load env from data dir so vars reach amavisd even when the orchestrator doesn't pass them. Read line-by-line so values with *, spaces, etc. (e.g. AMAVISD_SPAM_SUBJECT_TAG=** SPAM **) are safe.
if [ -f /home/mailhub-amavisd/stack.env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      '#'*) ;;
      [A-Za-z_][A-Za-z0-9_]*=*)
        export "$line"
        ;;
    esac
  done < /home/mailhub-amavisd/stack.env
fi

# Download ClamAV DB on first run if missing (clamd fails otherwise)
if [ ! -f /var/lib/clamav/main.cvd ] && [ ! -f /var/lib/clamav/main.cld ]; then
  echo "ClamAV DB missing, running freshclam once..."
  su clamav -s /bin/sh -c "freshclam"
fi

# Sa-learn cron: when SALEARN_USER_MAILDIRS is set, run salearn-from-maildirs.sh daily at 03:00
if [ -n "$SALEARN_USER_MAILDIRS" ]; then
  {
    echo "SALEARN_USER_MAILDIRS=$SALEARN_USER_MAILDIRS"
    echo "USER_MAILDIRS=$SALEARN_USER_MAILDIRS"
    [ -n "$SALEARN_SA_USER" ] && echo "SALEARN_SA_USER=$SALEARN_SA_USER"
    echo "0 3 * * * root /usr/local/bin/salearn-from-maildirs.sh >> /var/log/salearn.log 2>&1"
    echo ""
  } > /etc/cron.d/salearn
  chmod 0644 /etc/cron.d/salearn
  touch /var/log/salearn.log
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf
