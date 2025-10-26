# Описание проекта APK Re-signing Service

> **[English version / Английская версия](README.md)**

## Обзор проекта

Микросервис для автоматической переподписи Android APK файлов с использованием существующего ключа подписи. 
Сервис предназначен для интеграции в CI/CD pipeline при разработке Android приложения, 
когда оригинальный ключ подписи находится у третьей стороны.

## Техническая архитектура

Сервис построен на Node.js с использованием Express.js фреймворка и работает в Docker контейнере. 
Подпись APK выполняется с помощью jarsigner через child_process. 
Загруженные APK файлы временно сохраняются на диске, подписываются с использованием JKS keystore, 
после чего подписанный файл становится доступен для скачивания.

## API эндпоинты

### POST /api/sign
Принимает APK файл для подписи. Требует авторизацию через Bearer token в заголовке `Authorization`.

**Request:**
- Content-Type: multipart/form-data
- Body: apk файл (поле "file")
- Header: Authorization: Bearer {STATIC_TOKEN}

**Response:**
```json
{
  "success": true,
  "downloadUrl": "/api/download/{fileId}",
  "filename": "app-signed.apk",
  "expiresAt": "2025-10-26T10:00:00.000Z"
}
```

### GET /api/download/:fileId
Скачивание подписанного APK файла. Требует авторизацию.

**Response:**
- Content-Type: application/vnd.android.package-archive
- File stream подписанного APK

## Структура проекта

```
apk-signing-service/
├── src/
│   ├── index.js              # Entry point
│   ├── middleware/
│   │   └── auth.js           # Token authentication
│   ├── services/
│   │   ├── upload.js         # File upload handling
│   │   ├── signing.js        # APK signing logic
│   │   └── cleanup.js        # Temp files cleanup
│   └── utils/
│       └── validation.js     # Input validation
├── uploads/                  # Temp storage (не в git)
├── keys/
│   └── keystore.jks         # JKS файл (не в git)
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .dockerignore
├── .gitignore
└── package.json
```

## Переменные окружения

```sh
# Server Configuration
PORT=3000
NODE_ENV=production

# Authentication
STATIC_AUTH_TOKEN=your-secure-token-here-change-this

# SSL/HTTPS Configuration (опционально)
SSL_ENABLED=false                      # Включить SSL (true/false)
SSL_DOMAIN=                            # Ваш домен (обязательно для production SSL)
SSL_EMAIL=                             # Email для уведомлений Let's Encrypt
SSL_STAGING=true                       # Использовать staging сервер Let's Encrypt для тестирования
SSL_CERT_DIR=/app/certs               # Директория для SSL сертификатов
HTTP_PORT=80                          # HTTP порт (для ACME challenges)
HTTPS_PORT=443                        # HTTPS порт

# Keystore Configuration
KEYSTORE_PATH=/app/keys/keystore.jks
KEYSTORE_PASSWORD=your-keystore-password
KEY_ALIAS=your-key-alias
KEY_PASSWORD=your-key-password

# File Storage Configuration
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=104857600
# Время жизни подписанного apk
FILE_RETENTION_HOURS=24

# Ограничение количества файлов в директориях  внутри uploads: incoming и signed
MAX_FILES_PER_DIRECTORY=10
```

> 📖 **Подробная инструкция по настройке SSL/HTTPS: [docs/SSL_SETUP.md](docs/SSL_SETUP.md)**


## Инструкция по установке

1. Создаем файл окружения
```sh
cp .env.example .env
```
2. Заполняем файл окружения

## Инструкция по запуску

Вариант прямого запуска
```sh
npm install
npm run start
```

Вариант запуска через Docker
```sh
docker-compose up -d
# или
docker build -t apk-signing-service .
docker run -d --name apk-signing-service -p 3000:3000 -p 80:80 -p 443:443 -v ./keys:/app/keys:ro -v uploads:/app/uploads -v certs:/app/certs --env-file .env --restart unless-stopped --health-cmd="wget --quiet --tries=1 --spider http://localhost:3000/health" --health-interval=30s --health-timeout=10s --health-retries=3 --health-start-period=10s apk-signing-service
```

## Процесс подписи

1. Клиент загружает APK с токеном авторизации
2. Сервис валидирует токен и файл
3. APK сохраняется во временную директорию
4. Выполняется команда `apksigner sign` с параметрами из ENV
5. Подписанный APK сохраняется с уникальным ID
6. Клиенту возвращается JSON со ссылкой на скачивание
7. Фоновая задача удаляет файлы старше N часов

## Безопасность

- Статический токен для базовой авторизации всех запросов
- JKS файл монтируется в контейнер через volume (не в образе)
- Переменные окружения с чувствительными данными через Docker secrets или encrypted env
- Helmet middleware для HTTP заголовков безопасности
- Ограничение размера загружаемых файлов
- Автоматическая очистка временных файлов


## Интеграция в CI/CD

Пример использования в GitHub Actions:

```yaml
- name: Sign APK
  run: |
    curl -X POST \
      -H "Authorization: Bearer ${{ secrets.SIGNING_TOKEN }}" \
      -F "file=@app-release-unsigned.apk" \
      https://signing-service.example.com/api/sign \
      -o response.json
    
    DOWNLOAD_URL=$(jq -r '.downloadUrl' response.json)
    
    curl -H "Authorization: Bearer ${{ secrets.SIGNING_TOKEN }}" \
      "https://signing-service.example.com${DOWNLOAD_URL}" \
      -o app-release-signed.apk
```
