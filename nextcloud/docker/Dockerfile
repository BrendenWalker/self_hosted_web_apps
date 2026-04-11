FROM nextcloud:33-apache

RUN apt-get update && \
    apt-get install -y \
        smbclient \
        libsmbclient-dev \
        $PHPIZE_DEPS \
    && pecl install smbclient \
    && docker-php-ext-enable smbclient \
    && apt-get purge -y --auto-remove $PHPIZE_DEPS \
    && rm -rf /var/lib/apt/lists/*

# Optional: add docker/certs/HomeCA.crt (PEM) before build to trust an internal CA.
COPY certs/ /tmp/certs/
RUN if [ -f /tmp/certs/HomeCA.crt ]; then \
      cp /tmp/certs/HomeCA.crt /usr/local/share/ca-certificates/HomeCA.crt && \
      update-ca-certificates && \
      cp /tmp/certs/HomeCA.crt /var/www/HomeCA.crt && \
      chmod 644 /var/www/HomeCA.crt; \
    fi \
    && rm -rf /tmp/certs

COPY docker-entrypoint.d/99-add-homeca.sh /docker-entrypoint-hooks.d/before-starting/99-add-homeca.sh
