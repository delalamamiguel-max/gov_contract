FROM apify/actor-node-playwright-chrome:20

# Chromium is already bundled in the base image (matching Playwright 1.60.0);
# don't re-download it during npm install.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install dependencies.
COPY --chown=myuser package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && echo "Installed dependencies:" && npm ls --omit=dev || true

# Copy the source.
COPY --chown=myuser . ./

CMD ["npm", "start", "--silent"]
