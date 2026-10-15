# ====================================================
# Multi-stage Dockerfile for SevaNest Admin Portal
# ====================================================

# ----------------------------------------------------
# 1. Base Stage
# ----------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app

# ----------------------------------------------------
# 2. Dependencies Stage
# ----------------------------------------------------
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# ----------------------------------------------------
# 3. Development Stage (Vite HMR dev server)
# ----------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ----------------------------------------------------
# 4. Builder Stage (Compiles TypeScript & builds bundle)
# ----------------------------------------------------
FROM dependencies AS builder
COPY . .

# Build-time Vite arguments
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_ENV=production
ARG VITE_USE_MOCK_AUTH=false
ARG VITE_API_TIMEOUT_MS=15000
ARG VITE_ENABLE_TELEMETRY=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_USE_MOCK_AUTH=$VITE_USE_MOCK_AUTH \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS \
    VITE_ENABLE_TELEMETRY=$VITE_ENABLE_TELEMETRY

RUN npm run build

# ----------------------------------------------------
# 5. Production Stage (Lightweight Nginx server)
# ----------------------------------------------------
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
