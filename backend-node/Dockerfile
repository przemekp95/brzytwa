# Multi-stage build for Node.js API service
FROM node:18-alpine as base

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Install system dependencies for building
FROM base AS dependencies
RUN apk add --no-cache libc6-compat git

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production --no-audit --no-fund --no-scripts \
    && npm cache clean --force \
    && rm -rf ~/.npm

# Production stage
FROM base as production

# Install curl for health checks (needed for HEALTHCHECK)
RUN apk add --no-cache curl

USER nextjs

COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Build the application
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]

# Development stage (optional)
FROM base as development

RUN apk add --no-cache libc6-compat git curl

# Install all dependencies including dev
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# Install dev dependencies (jest, tsx, etc.)
RUN npm install -g concurrently tsx

USER nextjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["npm", "run", "dev"]
