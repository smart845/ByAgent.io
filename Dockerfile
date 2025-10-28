# syntax = docker/dockerfile:1

# === 1. Build stage (Vite frontend) ===
FROM node:20-slim AS build

WORKDIR /app

# Устанавливаем pnpm (независимо от глобального окружения Fly)
RUN npm install -g pnpm

# Копируем зависимости
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Устанавливаем зависимости и билдим проект
RUN pnpm install
COPY . .
RUN pnpm run build


# === 2. Runtime stage (Express backend) ===
FROM node:20-slim AS runtime

WORKDIR /app

# Устанавливаем pnpm и только продакшн-зависимости
RUN npm install -g pnpm

COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN pnpm install --prod

# Копируем собранный фронт и серверные файлы
COPY --from=build /app/dist ./dist
COPY . .

# Fly.io требует, чтобы приложение слушало 0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
