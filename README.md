# APK Re-signing Service 

> **[Русская версия документации / Russian version](README_ru.md)**

## Project Overview

A microservice for automatic re-signing of Android APK files using an existing signing key.
The service is designed for integration into CI/CD pipelines during Android application development,
when the original signing key is held by a third party.

## Technical Architecture

The service is built on Node.js using the Express.js framework and runs in a Docker container.
APK signing is performed using jarsigner via child_process.
Uploaded APK files are temporarily saved to disk, signed using a JKS keystore,
after which the signed file becomes available for download.

## API Endpoints

### POST /api/sign
Accepts an APK file for signing. Requires authorization via Bearer token in the `Authorization` header.

**Request:**
- Content-Type: multipart/form-data
- Body: apk file (field "file")
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
Download the signed APK file. Requires authorization.

**Response:**
- Content-Type: application/vnd.android.package-archive
- File stream of the signed APK

## Project Structure

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

## Environment Variables

```sh
# Server Configuration
PORT=3000
NODE_ENV=production

# Authentication
STATIC_AUTH_TOKEN=your-secure-token-here-change-this

# SSL/HTTPS Configuration (optional)
SSL_ENABLED=false                      # Enable SSL (true/false)
SSL_DOMAIN=                            # Your domain (required for production SSL)
SSL_EMAIL=                             # Email for Let's Encrypt notifications
SSL_STAGING=true                       # Use Let's Encrypt staging server for testing
SSL_CERT_DIR=/app/certs               # Directory for SSL certificates
HTTP_PORT=80                          # HTTP port (for ACME challenges)
HTTPS_PORT=443                        # HTTPS port

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


## Installation Instructions

1. Create an environment file
```sh
cp .env.example .env
```
2. Fill in the environment file

## Running Instructions

Direct run option
```sh
npm install
npm run build
npm run start
# or
bun install
bun run build
bun start
```

Docker run option
```sh
docker-compose up -d
# or 
docker build -t apk-signing-service .
docker run -d --name apk-signing-service -p 3000:3000 -p 80:80 -p 443:443 -v ./keys:/app/keys:ro -v uploads:/app/uploads -v certs:/app/certs --env-file .env --restart unless-stopped --health-cmd="wget --quiet --tries=1 --spider http://localhost:3000/health" --health-interval=30s --health-timeout=10s --health-retries=3 --health-start-period=10s apk-signing-service
```

## Signing Process

1. Client uploads APK with authorization token
2. Service validates token and file
3. APK is saved to a temporary directory
4. Command `apksigner sign` is executed with parameters from ENV
5. Signed APK is saved with a unique ID
6. Client receives JSON with a download link
7. Background task deletes files older than N hours

## Security

- Static token for basic authorization of all requests
- JKS file is mounted in the container via volume (not in image)
- Sensitive data variables via Docker secrets or encrypted env
- Helmet middleware for HTTP header security
- File size limit
- Automatic temporary file cleanup


## Integration in CI/CD

Example of usage in GitHub Actions:

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
