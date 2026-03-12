#!/bin/sh
set -e
# Ensure decoders are findable by amavisd (supervisord child may inherit this)
export PATH="/usr/bin:/usr/local/bin:/bin${PATH:+:$PATH}"
# Download ClamAV DB on first run if missing (clamd fails otherwise)
if [ ! -f /var/lib/clamav/main.cvd ] && [ ! -f /var/lib/clamav/main.cld ]; then
  echo "ClamAV DB missing, running freshclam once..."
  su clamav -s /bin/sh -c "freshclam"
fi
exec /usr/bin/supervisord -c /etc/supervisord.conf
