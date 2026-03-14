# Mailhub Dovecot + Pigeonhole (LMTP, IMAP, ManageSieve)
# Config and data in /home/mailhub-dovecot (bind from host).
# Provide: users (passwd-file), maildir/<user> per user, sieve/default.sieve.

FROM alpine:3.20

ARG VERSION=dev
ENV VERSION=$VERSION

RUN apk add --no-cache dovecot dovecot-pigeonhole-plugin dovecot-lmtpd

# Default config (override by files in /home/mailhub-dovecot)
COPY mailhub/dovecot/dovecot.conf /etc/dovecot/dovecot.conf
COPY mailhub/dovecot/default.sieve /etc/dovecot/default.sieve
COPY mailhub/dovecot/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY mailhub/scripts/regenerate-dovecot-subscriptions.sh /usr/local/bin/regenerate-dovecot-subscriptions
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh \
  && sed -i 's/\r$//' /usr/local/bin/regenerate-dovecot-subscriptions && chmod +x /usr/local/bin/regenerate-dovecot-subscriptions

RUN mkdir -p /home/mailhub-dovecot/maildir /home/mailhub-dovecot/sieve \
  && cp /etc/dovecot/default.sieve /home/mailhub-dovecot/sieve/default.sieve \
  && adduser -D -u 5000 -g "Virtual Mail" vmail \
  && chown -R vmail:vmail /home/mailhub-dovecot

EXPOSE 24 143 993 4190 995

CMD ["/usr/local/bin/entrypoint.sh"]
