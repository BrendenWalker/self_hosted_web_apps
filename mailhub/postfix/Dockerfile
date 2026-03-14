# Mailhub Postfix + Fetchmail
# Config/variable data in /home/mailhub-postfix (bind from host).
# Optional: .fetchids, main.cf, master.cf, aliases, fetchmailrc, sasl_passwd.db

# Pin digest to avoid unnecessary re-pulls and improve cache; matches alpine:3.20
FROM alpine:3.20@sha256:b0cb30c51c47cdfde647364301758b14c335dea2fddc9490d4f007d67ecb2538

ARG VERSION=dev
ENV VERSION=$VERSION

RUN apk add --no-cache \
    postfix \
    fetchmail \
    supervisor \
    bash

# Default config (can be overridden by files in /home/mailhub-postfix)
RUN mkdir -p /etc/postfix.default
COPY mailhub/postfix/main.cf mailhub/postfix/master.cf mailhub/postfix/aliases /etc/postfix.default/

COPY mailhub/postfix/postfix-entry.sh /usr/local/bin/postfix-entry.sh
COPY mailhub/postfix/fetchmail-entry.sh /usr/local/bin/fetchmail-entry.sh
RUN sed -i 's/\r$//' /usr/local/bin/postfix-entry.sh /usr/local/bin/fetchmail-entry.sh && \
    chmod +x /usr/local/bin/postfix-entry.sh /usr/local/bin/fetchmail-entry.sh

COPY mailhub/postfix/supervisord.conf /etc/supervisord.conf

RUN mkdir -p /home/mailhub-postfix /var/spool/postfix /var/lib/postfix && \
    chown -R postfix:postfix /var/spool/postfix /var/lib/postfix

EXPOSE 25 465

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
