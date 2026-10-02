FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src

ENV DATABASE_URL="postgresql://tesla:tesla_password@db:5432/dhaka_tesla"

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "start"]
