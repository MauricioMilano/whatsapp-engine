# syntax=docker/dockerfile:1.6
# ---- Stage 1: install production dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Install only production deps for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# ---- Stage 2: runtime image ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Install wget for HEALTHCHECK
RUN apk add --no-cache wget

# The official node:alpine image already ships a non-root `node` user
# (UID/GID 1000). We use it directly so the bind-mounted model.nlp
# (created on the host by the developer's primary user, also typically
# UID 1000) is writable inside the container. This keeps the image
# aligned with the node convention and avoids cross-user permission bugs.

# Copy production node_modules from the deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy application source
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node dialogue.json barber.json ./
COPY --chown=node:node migrations/ ./migrations/

# WORKDIR is created as root by Docker; chown it so the node user
# can write runtime artifacts (e.g. the node-nlp trained model.nlp cache).
RUN chown -R node:node /app

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

EXPOSE 3000

# Use the existing /health endpoint to verify the app is up
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

USER node

CMD ["node", "src/index.js"]
