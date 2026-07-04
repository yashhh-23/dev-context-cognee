FROM node:20-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
# Use npm install (not npm ci) so the lock file is regenerated if
# platform-specific entries (e.g. @emnapi/runtime) are missing.
RUN npm install --prefer-offline

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
