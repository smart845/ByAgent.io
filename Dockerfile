# syntax = docker/dockerfile:1

# -------------------------------
# 1. Билдим фронтенд через Vite
# -------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Копируем package.json и lock-файл
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Устанавливаем pnpm и зависимости
RUN npm install -g pnpm && pnpm install

# Копируем проект и билдим фронт
COPY . .
RUN pnpm run build

# -------------------------------
# 2. Запускаем Node.js сервер
# -------------------------------
FROM node:20-slim AS runtime

WORKDIR /app

# Копируем только нужные файлы
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/api ./api

# Устанавливаем только прод-зависимости
RUN npm install -g pnpm && pnpm install --prod

# Пробрасываем порт
ENV PORT=8080
EXPOSE 8080

# Запускаем твой сервер
CMD ["node", "server.js"]
