#!/bin/sh
# Run SpamAssassin sa-learn from user maildirs, then remove processed messages.
#
# Scans USER_MAILDIRS (directory containing one subdir per user; each subdir is
# a maildir root) for two patterns:
#   1. .Admin.Spam.Ham + .Admin.Spam.DefinateSpam — learn ham from Ham, spam from DefinateSpam, then clean both.
#   2. .spam — learn spam only, then clean.
#
# Usage: run from cron or docker exec. Requires USER_MAILDIRS or SALEARN_USER_MAILDIRS to be set.
# Optional: SALEARN_SA_USER (default amavis) for sa-learn --username.

set -e

BASE="${SALEARN_USER_MAILDIRS:-${USER_MAILDIRS:?USER_MAILDIRS or SALEARN_USER_MAILDIRS must be set}}"
SA_USER="${SALEARN_SA_USER:-amavis}"

if [ ! -d "$BASE" ]; then
  echo "salearn: USER_MAILDIRS is not a directory: $BASE" >&2
  exit 1
fi

learn_spam() {
  dir="$1"
  for sub in cur new; do
    path="$dir/$sub"
    [ -d "$path" ] || continue
    find "$path" -type f 2>/dev/null | while read -r f; do
      sa-learn --username="$SA_USER" --spam "$f" 2>/dev/null || true
    done
  done
}

learn_ham() {
  dir="$1"
  for sub in cur new; do
    path="$dir/$sub"
    [ -d "$path" ] || continue
    find "$path" -type f 2>/dev/null | while read -r f; do
      sa-learn --username="$SA_USER" --ham "$f" 2>/dev/null || true
    done
  done
}

clean_dir() {
  dir="$1"
  for sub in cur new; do
    path="$dir/$sub"
    [ -d "$path" ] || continue
    find "$path" -mindepth 1 -delete 2>/dev/null || true
  done
}

for user_dir in "$BASE"/*; do
  [ -d "$user_dir" ] || continue
  # Skip if it's not a directory we can read (e.g. . or .. are not in * with proper glob)
  case "$user_dir" in */. | */..) continue ;; esac

  HAM_ADMIN="$user_dir/.Admin.Spam.Ham"
  SPAM_ADMIN="$user_dir/.Admin.Spam.DefinateSpam"
  SPAM_SIMPLE="$user_dir/.spam"

  if [ -d "$HAM_ADMIN" ] && [ -d "$SPAM_ADMIN" ]; then
    echo "salearn: training from $user_dir (Admin.Spam.*)"
    learn_spam "$SPAM_ADMIN"
    learn_ham "$HAM_ADMIN"
    clean_dir "$SPAM_ADMIN"
    clean_dir "$HAM_ADMIN"
  elif [ -d "$SPAM_SIMPLE" ]; then
    echo "salearn: training from $user_dir (.spam)"
    learn_spam "$SPAM_SIMPLE"
    clean_dir "$SPAM_SIMPLE"
  fi
done

echo "salearn: done."
