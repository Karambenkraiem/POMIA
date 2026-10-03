FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --resolveJsonModule

# ── Image finale légère ──
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma      ./prisma
COPY package*.json ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
