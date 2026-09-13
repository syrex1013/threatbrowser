# ThreatBrowser CLI/automation runtime on the CloakBrowser stealth engine
FROM node:22-bookworm-slim

WORKDIR /app

# Chromium shared-library runtime for the stealth engine.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libglib2.0-0 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Package metadata first for layer caching.
COPY .npmrc package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

COPY bin ./bin

# Pre-download the stealth Chromium binary into the image (signed, checksummed).
ENV CLOAKBROWSER_CACHE_DIR=/opt/cloakbrowser
RUN node bin/threatbrowser.mjs install

RUN mkdir -p /home/node/.config/threatbrowser \
    && chown -R node:node /opt/cloakbrowser /home/node

USER node
ENV HOME=/home/node \
    THREATBROWSER_DATA_DIR=/home/node/.config/threatbrowser \
    CLOAKBROWSER_CACHE_DIR=/opt/cloakbrowser \
    CLOAKBROWSER_AUTO_UPDATE=false

# Runtime overrides (never baked into layers): CLOAKBROWSER_LICENSE_KEY,
# CLOAKBROWSER_BINARY_PATH, CLOAKBROWSER_RELEASE_CHANNEL.
ENTRYPOINT ["node", "bin/threatbrowser.mjs"]
CMD ["info"]
