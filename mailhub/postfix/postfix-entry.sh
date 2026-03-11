#!/bin/sh
set -e
CONF_DIR=/etc/postfix
DATA_DIR=/home/mailhub-postfix

# Use config from data dir if present, else use image defaults
if [ -f "$DATA_DIR/main.cf" ]; then
  cp "$DATA_DIR/main.cf" "$CONF_DIR/main.cf"
else
  cp /etc/postfix.default/main.cf "$CONF_DIR/main.cf"
fi
if [ -f "$DATA_DIR/master.cf" ]; then
  cp "$DATA_DIR/master.cf" "$CONF_DIR/master.cf"
else
  cp /etc/postfix.default/master.cf "$CONF_DIR/master.cf"
fi
if [ -f "$DATA_DIR/aliases" ]; then
  cp "$DATA_DIR/aliases" "$CONF_DIR/aliases"
  newaliases
else
  cp /etc/postfix.default/aliases "$CONF_DIR/aliases"
  newaliases
fi

# Set runtime options from env
[ -n "$MYHOSTNAME" ] && postconf -e myhostname="$MYHOSTNAME"
[ -n "$MYDOMAIN" ] && postconf -e mydomain="$MYDOMAIN" myorigin="\$mydomain"
[ -n "$RELAYHOST" ] && postconf -e relayhost="[$RELAYHOST]"
# SASL for relay (optional): set smtp_sasl_password_maps if sasl_passwd.db exists in data dir
if [ -f "$DATA_DIR/sasl_passwd.db" ]; then
  cp "$DATA_DIR/sasl_passwd.db" "$CONF_DIR/sasl_passwd.db"
  postconf -e smtp_sasl_password_maps=hash:$CONF_DIR/sasl_passwd.db
  postconf -e smtp_sasl_security_options=noanonymous
fi

exec postfix start-fg
