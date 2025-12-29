# FB Auto-Comment Worker Dockerfile
# For deployment on Railway

FROM node:20-alpine

WORKDIR /app

# Copy package files from scripts/fb-scheduler
COPY scripts/fb-scheduler/package*.json ./

# Install dependencies
RUN npm install

# Copy source files from scripts/fb-scheduler
COPY scripts/fb-scheduler/*.ts ./
COPY scripts/fb-scheduler/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Start the worker
CMD ["npm", "start"]
