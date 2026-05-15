# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Type check
RUN npm run type-check

# Test
RUN npm test -- --run

# Build
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built distribution from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S slak -u 1001

USER slak

# Health check (verify CLI works)
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD node dist/commands/auth/test.js --help > /dev/null 2>&1 || exit 1

ENTRYPOINT ["node", "bin/run.js"]
CMD ["--help"]
