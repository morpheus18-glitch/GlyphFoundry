# ---------- Build stage ----------
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
ENV npm_config_legacy_peer_deps=true
FROM node:20-alpine AS build
WORKDIR /app

# Enable Corepack so yarn/pnpm work if lockfiles exist
RUN corepack enable || true

# Copy only manifests first for better caching
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./

# Install deps based on lockfile (prefer exact, reproducible installs)
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci --no-audit --no-fund --legacy-peer-deps; \
    else \
      npm install --no-audit --no-fund; \
    fi

# Bring in the rest of the app (vite.config, src, etc.)
COPY . .

# Build (use your build script if present, otherwise fallback to vite)
RUN if npm pkg get scripts.build | grep -qv 'undefined'; then \
      (npm run build || yarn build || pnpm build); \
    else \
      npx vite build; \
    fi

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

# Minimal SPA nginx config with history fallback and gzip
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on; gzip_comp_level 5; gzip_min_length 1024; gzip_proxied any;\n\
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
