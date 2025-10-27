# Исправления ошибок 404

## Проблемы, которые были найдены и исправлены:

### 1. Неправильные пути в index.html

**Проблема:**
В файле `src/index.html` были указаны неправильные пути к ресурсам:
- `<link rel="stylesheet" href="src/styles/components.css">` (строка 12)
- `<script type="module" src="src/main.js"></script>` (строка 246)

**Причина:**
Поскольку в `vite.config.js` указано `root: 'src'`, Vite считает папку `src` корневой директорией. Поэтому пути в HTML должны быть относительными от этой папки, а не включать `src/` в начале.

**Решение:**
Изменены пути на относительные:
- `<link rel="stylesheet" href="./styles/components.css">`
- `<script type="module" src="./main.js">`

### 2. Структура проекта

Правильная структура проекта:
```
ByAgent-fixed/
├── config/
│   └── constants.js
├── src/
│   ├── components/
│   │   ├── agent-analytics.js
│   │   └── open-interest.js
│   ├── services/
│   │   └── bybit-api.js
│   ├── styles/
│   │   └── components.css
│   ├── utils/
│   │   ├── formatters.js
│   │   ├── helpers.js
│   │   └── indicators.js
│   ├── index.html
│   └── main.js
├── public/
│   └── _redirects
├── package.json
├── vite.config.js
└── vercel.json
```

## Как запустить проект:

1. Установите зависимости:
```bash
pnpm install
```

2. Запустите dev-сервер:
```bash
pnpm run dev
```

3. Откройте браузер по адресу: http://localhost:5173/

## Как собрать проект для продакшена:

```bash
pnpm run build
```

Результат будет в папке `dist/`

## Примечания:

- Все импорты в JavaScript файлах корректны и используют правильные относительные пути
- Vite автоматически обрабатывает модули ES6
- Конфигурация Vite настроена правильно с `root: 'src'`

