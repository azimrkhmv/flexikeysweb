# FlexiKeys web — production image (Next.js standalone server). Build from apps/web:
#   docker build -t flexikeys-web --build-arg NEXT_PUBLIC_SITE_URL=https://flexikeys.uz .
#   docker run -p 3000:3000 flexikeys-web

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Public build-time settings (inlined into the client bundle / static pages).
ARG NEXT_PUBLIC_SITE_URL=https://flexikeys.uz
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/uz >/dev/null || exit 1
CMD ["node", "server.js"]
