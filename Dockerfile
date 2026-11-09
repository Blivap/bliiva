FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile

FROM node:26-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    API_PREFIX=api/v1
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/'+(process.env.API_PREFIX||'api/v1')+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
