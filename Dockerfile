FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM ollama/ollama:latest AS ollama

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    API_PREFIX=api/v1 \
    LD_LIBRARY_PATH=/usr/lib/ollama
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libgomp1 libopenblas0 libvulkan1 \
    && rm -rf /var/lib/apt/lists/*
# Keep the official layout. The binary looks for llama-server in ../lib/ollama
# relative to itself, so /usr/local/bin/ollama never sees /usr/lib/ollama.
COPY --from=ollama /usr/bin/ollama /usr/bin/ollama
COPY --from=ollama /usr/lib/ollama /usr/lib/ollama
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /home/node/.ollama && chown -R node:node /home/node/.ollama
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/'+(process.env.API_PREFIX||'api/v1')+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
