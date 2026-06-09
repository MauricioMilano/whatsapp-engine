# syntax=docker/dockerfile:1.6

# ---- Stage 1: Backend production dependencies ----
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: Frontend dependencies ----
FROM node:20-alpine AS frontend-deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci && npm cache clean --force

# ---- Stage 3: Frontend build ----
FROM frontend-deps AS frontend-build
WORKDIR /app
COPY frontend/ ./
RUN npm run build

# ---- Stage 4: Runtime image ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Install wget for HEALTHCHECK
RUN apk add --no-cache wget

# The official node:alpine image already ships a non-root `node` user
# (UID/GID 1000). We use it directly so the bind-mounted model.nlp
# (created on the host by the developer's primary user, also typically
# UID 1000) is writable inside the container.

# Copy production node_modules from the backend deps stage
COPY --from=backend-deps --chown=node:node /app/node_modules ./node_modules

# Copy application source
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node dialogue.json barber.json ./
COPY --chown=node:node migrations/ ./migrations/

# Copy built frontend (from frontend-build stage)
COPY --from=frontend-build --chown=node:node /app/dist ./dist

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
