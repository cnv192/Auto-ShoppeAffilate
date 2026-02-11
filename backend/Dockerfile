# =====================================================
# Tin tức 24h - Backend API Server
# Multi-stage Docker build for production
# =====================================================

# ---- Stage 1: Build dependencies ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --only=production && \
    # Clean npm cache to reduce image size
    npm cache clean --force

# ---- Stage 2: Production image ----
FROM node:20-alpine AS production

# Add labels
LABEL maintainer="Tin tức 24h Team"
LABEL description="Backend API Server for Tin tức 24h"
LABEL version="1.0.0"

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src/ ./src/
COPY sample.bin.db11/ ./sample.bin.db11/
COPY sample6.bin.db11/ ./sample6.bin.db11/

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown -R appuser:appgroup uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Switch to non-root user
USER appuser

# Health check - verify the server is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "src/server.js"]
