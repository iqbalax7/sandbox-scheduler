# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add labels for better maintainability
LABEL maintainer="sandbox-scheduler-team"
LABEL description="Healthcare appointment scheduling backend"
LABEL version="1.0.0"

# Install system dependencies for better performance and security
RUN apk add --no-cache \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nodejs:nodejs /app

# Switch to non-root user for security
USER nodejs

# Expose the application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
