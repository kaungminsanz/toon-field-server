FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json ./

RUN npm ci

COPY server/ ./

RUN npm run build

ENV NODE_ENV=production

CMD ["npm", "run", "start:railway"]
