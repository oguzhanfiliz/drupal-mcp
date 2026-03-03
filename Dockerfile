FROM node:22-slim

# Install ripgrep and ddev dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ripgrep curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install ddev
RUN curl -fsSL https://pkg.ddev.com/apt/gpg.key | gpg --dearmor -o /usr/share/keyrings/ddev.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/ddev.gpg] https://pkg.ddev.com/apt/ * *" > /etc/apt/sources.list.d/ddev.list && \
    apt-get update && apt-get install -y ddev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Copy config
COPY config/ ./config/

# Create logs directory
RUN mkdir -p /app/logs

ENTRYPOINT ["node", "dist/index.js"]
