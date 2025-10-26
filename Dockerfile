FROM oven/bun:1-alpine

# Install JDK for jarsigner
RUN apk add --no-cache openjdk11-jre

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Create necessary directories
RUN mkdir -p /app/uploads/incoming /app/uploads/signed /app/keys /app/certs

# Expose ports (HTTP and HTTPS)
EXPOSE 80 443 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["bun", "src/index.ts"]
