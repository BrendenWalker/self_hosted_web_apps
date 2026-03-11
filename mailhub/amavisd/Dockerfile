# Mailhub Amavisd + ClamAV + SpamAssassin (file-based Bayes)
# Config/variable data in /home/mailhub-amavisd (bind from host).

FROM debian:bookworm-slim

ARG VERSION=dev
ENV VERSION=$VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
    amavisd-new \
    clamav \
    clamav-daemon \
    spamassassin \
    supervisor \
    netbase \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/clamav /var/lib/clamav /var/log/clamav /etc/amavis/conf.d \
    && chown -R clamav:clamav /var/lib/clamav /var/log/clamav /run/clamav

# Default configs (override by files in /home/mailhub-amavisd)
COPY mailhub/amavisd/amavisd.conf /etc/amavis/amavisd.conf
COPY mailhub/amavisd/50-user.conf /etc/amavis/conf.d/50-user.conf
COPY mailhub/amavisd/clamd.conf /etc/clamav/clamd.conf
COPY mailhub/amavisd/local.cf /etc/spamassassin/local.cf
COPY mailhub/amavisd/supervisord.conf /etc/supervisord.conf

RUN mkdir -p /home/mailhub-amavisd/bayes && chown amavis:amavis /home/mailhub-amavisd/bayes

# Allow amavis to read clamav socket
RUN adduser amavis clamav 2>/dev/null || true

EXPOSE 10024 10025

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
