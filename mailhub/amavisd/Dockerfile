# Mailhub Amavisd + ClamAV + SpamAssassin (file-based Bayes)
# Config/variable data in /home/mailhub-amavisd (bind from host).

# Pin to release tag for reproducible builds (bookworm = Debian 12)
FROM debian:bookworm-slim

ARG VERSION=dev
ENV VERSION=$VERSION
ENV PATH="/usr/bin:/usr/local/bin:/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    amavisd-new \
    clamav \
    clamav-daemon \
    spamassassin \
    supervisor \
    netbase \
    gzip \
    xz-utils \
    unzip \
    p7zip-full \
    bzip2 \
    cpio \
    lrzip \
    lz4 \
    zstd \
    cabextract \
    unrar-free \
    rpm2cpio \
    arj \   
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/clamav /var/lib/clamav /var/log/clamav /etc/amavis/conf.d /var/amavis \
    && chown -R clamav:clamav /var/lib/clamav /var/log/clamav /run/clamav \
    && chown amavis:amavis /var/amavis

# Amavisd looks for "7zz" and "lz4c" by name; p7zip provides 7za/7z, lz4 provides lz4
RUN ln -sf /usr/bin/7za /usr/local/bin/7zz 2>/dev/null || true \
    && ( ln -sf /usr/bin/lz4 /usr/local/bin/lz4c 2>/dev/null || true )

# Default configs (override by files in /home/mailhub-amavisd)
COPY mailhub/amavisd/amavisd.conf /etc/amavis/amavisd.conf
COPY mailhub/amavisd/50-user.conf /etc/amavis/conf.d/50-user.conf
COPY mailhub/amavisd/clamd.conf /etc/clamav/clamd.conf
COPY mailhub/amavisd/local.cf /etc/spamassassin/local.cf
COPY mailhub/amavisd/supervisord.conf /etc/supervisord.conf
COPY mailhub/amavisd/amavisd-entry.sh /usr/local/bin/amavisd-entry.sh
RUN sed -i 's/\r$//' /etc/amavis/amavisd.conf /etc/amavis/conf.d/50-user.conf \
    /etc/clamav/clamd.conf /etc/spamassassin/local.cf /etc/supervisord.conf \
    /usr/local/bin/amavisd-entry.sh \
    && chmod +x /usr/local/bin/amavisd-entry.sh

RUN mkdir -p /home/mailhub-amavisd/bayes && chown amavis:amavis /home/mailhub-amavisd/bayes

# Allow amavis to read clamav socket
RUN adduser amavis clamav 2>/dev/null || true

EXPOSE 10024 10025

CMD ["/usr/local/bin/amavisd-entry.sh"]
