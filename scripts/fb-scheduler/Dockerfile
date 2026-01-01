# FB Auto-Comment Browser Worker Dockerfile
# Uses Playwright for browser automation
# For deployment on Railway

FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY scripts/fb-scheduler/package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY scripts/fb-scheduler/*.ts ./
COPY scripts/fb-scheduler/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Default to browser worker (can override with WORKER_MODE env var)
ENV WORKER_MODE=browser

# Start script that chooses between regular and browser worker
CMD if [ "$WORKER_MODE" = "browser" ]; then node dist/browser-worker.js; else node dist/worker.js; fi
