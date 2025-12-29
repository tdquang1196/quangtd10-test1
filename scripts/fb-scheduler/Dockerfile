# FB Auto-Comment Worker Dockerfile
# For deployment on Railway

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Start the worker
CMD ["npm", "start"]
