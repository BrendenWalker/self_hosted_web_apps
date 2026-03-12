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
exec /usr/bin/supervisord -c /etc/supervisord.conf
