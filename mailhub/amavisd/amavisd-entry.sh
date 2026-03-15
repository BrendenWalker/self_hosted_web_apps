#!/bin/sh
set -e
# Ensure decoders are findable by amavisd (supervisord child may inherit this)
export PATH="/usr/bin:/usr/local/bin:/bin${PATH:+:$PATH}"

# Optional: load env from data dir so vars reach amavisd even when the orchestrator doesn't pass them (e.g. Portainer stack env not applied to this service). Create stack.env with e.g. AMAVISD_LOCAL_DOMAINS=plud.org, MYDOMAIN=plud.org, AMAVISD_SPAM_QUARANTINE_TO=..., AMAVISD_VIRUS_QUARANTINE_TO=...
if [ -f /home/mailhub-amavisd/stack.env ]; then
  set -a
  . /home/mailhub-amavisd/stack.env
  set +a
fi

# Download ClamAV DB on first run if missing (clamd fails otherwise)
if [ ! -f /var/lib/clamav/main.cvd ] && [ ! -f /var/lib/clamav/main.cld ]; then
  echo "ClamAV DB missing, running freshclam once..."
  su clamav -s /bin/sh -c "freshclam"
fi
exec /usr/bin/supervisord -c /etc/supervisord.conf
