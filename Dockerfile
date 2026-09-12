# Production-ready Linux Dockerfile for FastAPI + GCC Backend
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=10000 \
    CC=gcc \
    CFLAGS="-std=c11 -O2 -pipe"

# Install GCC compiler toolchain, libc headers, and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    make \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for secure application execution
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source files
COPY . /app

# Ensure data directories exist and set appropriate permissions
RUN mkdir -p /app/data/staging /app/data && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 10000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Run Uvicorn binding to 0.0.0.0 and respecting Render dynamic $PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
