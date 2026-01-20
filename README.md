# Flight Connect Backend

Backend API для приложения Flight Connect с использованием Node.js, Express и MongoDB.

## Требования

- Node.js 18+ 
- MongoDB (локально или MongoDB Atlas)
- npm или yarn

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` и укажите необходимые переменные окружения (см. раздел "Конфигурация")

3. Запустите сервер в режиме разработки:
```bash
npm run dev
```

Или соберите и запустите в production режиме:
```bash
npm run build
npm start
```

## Конфигурация

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/flight-connect
# или для MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/flight-connect

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:8080
```

## API Endpoints

### Sessions (Сессии)

- `GET /api/sessions` - Получить все сессии
- `GET /api/sessions/upcoming` - Получить предстоящие сессии
- `GET /api/sessions/completed` - Получить завершенные сессии
- `GET /api/sessions/:id` - Получить сессию по ID
- `POST /api/sessions` - Создать новую сессию
- `PATCH /api/sessions/:id` - Обновить сессию
- `DELETE /api/sessions/:id` - Удалить сессию
- `GET /api/sessions/:id/participants` - Получить участников сессии

### Participants (Участники)

- `GET /api/participants` - Получить всех участников
- `GET /api/participants/:id` - Получить участника по ID
- `POST /api/participants` - Создать нового участника
- `PATCH /api/participants/:id` - Обновить участника
- `DELETE /api/participants/:id` - Удалить участника

## Структура базы данных

### Коллекция `sessions`

- `_id` - ObjectId (автоматически)
- `id` - String (уникальный идентификатор)
- `sessionCode` - String (3 буквы, уникальный)
- `date` - String (ISO дата: YYYY-MM-DD)
- `registrationStartTime` - String (HH:mm)
- `startTime` - String (HH:mm)
- `endTime` - String (опционально, HH:mm)
- `status` - String (open | closing | closed | completed)
- `closingMinutes` - Number (минуты до закрытия регистрации)
- `comments` - String (комментарии диспетчера)
- `createdAt` - Date
- `updatedAt` - Date

### Коллекция `participants`

- `_id` - ObjectId (автоматически)
- `id` - String (уникальный идентификатор)
- `sessionId` - String (ID сессии)
- `name` - String (имя пилота)
- `validationCode` - String (3 буквы, без учета регистра)
- `code` - String (личный код участника)
- `isValid` - Boolean | Null (null = не проверен, true = валидный, false = невалидный)
- `registeredAt` - Date

## Индексы

### Sessions
- `sessionCode` - уникальный индекс
- `date + startTime` - составной индекс
- `status` - индекс
- `createdAt` - индекс

### Participants
- `sessionId` - индекс
- `sessionId + validationCode` - составной индекс
- `registeredAt` - индекс

## Разработка

Проект использует TypeScript. Для разработки используется `tsx` для hot-reload.

```bash
npm run dev
```

Для проверки кода:
```bash
npm run lint
```

## Лицензия

ISC

