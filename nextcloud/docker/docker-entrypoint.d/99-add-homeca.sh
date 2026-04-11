#!/bin/bash
set -e

CA_FILE="/var/www/HomeCA.crt"
NC_BUNDLE="/var/www/html/resources/config/ca-bundle.crt"

if [ -f "$CA_FILE" ] && [ -f "$NC_BUNDLE" ]; then
    echo "Appending HomeCA to Nextcloud bundle"
    cat "$CA_FILE" >> "$NC_BUNDLE"
fi
