# syntax = docker/dockerfile:1

# --- Базовый образ ---
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NodeJS"
WORKDIR /app
ENV NODE_ENV=production

# Устанавливаем pnpm
RUN npm install -g pnpm@latest


# --- Сборка приложения ---
FROM base AS build

# Устанавливаем необходимые пакеты для сборки модулей
RUN apt-get update -qq && apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Копируем package.json и lock-файл
COPY package.json pnpm-lock.yaml* ./

# Устанавливаем зависимости (без строгой проверки lock-файла)
RUN pnpm install --no-frozen-lockfile

# Копируем остальной код
COPY . .

# Если есть фронтенд (vite), собираем его, но не падаем если нет
RUN pnpm run build || echo "No build step, skipping build"

# Удаляем dev-зависимости
RUN pnpm prune --prod


# --- Финальный образ ---
FROM node:${NODE_VERSION}-slim AS final

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Копируем приложение и зависимости
COPY --from=build /app ./

# Открываем порт
EXPOSE 8080

# Запуск backend-сервера (если есть server.js)
CMD ["node", "server.js"]
