# Деплой на Vercel

## Настройка

1. Убедитесь, что все переменные окружения настроены в Vercel Dashboard:
   - `MONGODB_URI` - URI подключения к MongoDB
   - `JWT_SECRET` - Секретный ключ для JWT токенов
   - `CORS_ORIGIN` - Разрешенный origin для CORS (например, `https://your-frontend.vercel.app`)

2. Структура проекта:
   - `api/index.ts` - Serverless функция для Vercel
   - `src/server.ts` - Основной сервер для локальной разработки
   - `vercel.json` - Конфигурация Vercel

## Проблемы и решения

### Ошибка компиляции TypeScript

Если сборка падает на этапе `npm run build`, проверьте:
1. Все зависимости установлены: `npm install`
2. TypeScript компилируется без ошибок локально: `npm run build`
3. Все импорты используют правильные пути

### Проблемы с ES Modules

Если возникают проблемы с ES modules, убедитесь что:
- `package.json` содержит `"type": "module"`
- Все импорты используют расширения `.js` для скомпилированных файлов (TypeScript автоматически обработает это)

### Проблемы с MongoDB подключением

Убедитесь что:
- `MONGODB_URI` правильно настроен в Vercel Dashboard
- MongoDB Atlas разрешает подключения с IP адресов Vercel (или использует `0.0.0.0/0` для всех IP)

## Локальная разработка

Для локальной разработки используйте:
```bash
npm run dev
```

Сервер запустится на `http://localhost:3000` (или порт из `PORT` env variable).

## Деплой

Vercel автоматически обнаружит проект и использует `vercel.json` для конфигурации.
Serverless функция будет доступна по адресу: `https://your-project.vercel.app/api/*`
