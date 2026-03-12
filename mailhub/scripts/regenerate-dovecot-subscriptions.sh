#!/usr/bin/env sh
# Regenerate Dovecot 'subscriptions' from maildir folders (e.g. after migrating from Courier).
# Run on the host; MAILROOT = path to the user's maildir (e.g. .../mailhub-dovecot/maildir/braindead).
# Usage: ./regenerate-dovecot-subscriptions.sh <MAILROOT> [uid:gid]

set -e
MAILROOT="${1:?Usage: $0 <MAILROOT> [uid:gid]}"
CHOWN="${2:-}"

cd "$MAILROOT"
for d in .[!.]*; do
  [ -d "$d" ] || continue
  path="${d#.}"
  path="${path//./\/}"
  while [ -n "$path" ]; do
    echo "$path"
    [ "${path#*/}" = "$path" ] && break
    path="${path%/*}"
  done
done | sort -u > subscriptions.new
mv subscriptions.new subscriptions
[ -n "$CHOWN" ] && chown "$CHOWN" subscriptions
echo "Wrote subscriptions ($(wc -l < subscriptions) entries). chown $CHOWN (if given)."
