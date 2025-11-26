# -----------------------------
# Builder stage
# -----------------------------
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        gfortran \
        libpq-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
        libpng-dev \
        libfreetype6-dev \
        libblas-dev \
        liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from root
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# -----------------------------
# Runtime stage
# -----------------------------
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install runtime libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 \
        libjpeg62-turbo \
        libpng16-16 \
        libfreetype6 \
        libblas3 \
        liblapack3 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local /usr/local

# Copy all project files from root
COPY . .

# Collect static files (assuming manage.py is in dejabrew/)
WORKDIR /app/dejabrew
RUN mkdir -p /app/dejabrew/staticfiles
RUN python manage.py collectstatic --noinput

# Optional: create non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Expose port (Railway injects $PORT)
EXPOSE 8000

# Start Gunicorn
CMD ["sh", "-c", "gunicorn dejabrew.wsgi:application --bind 0.0.0.0:$PORT --workers 4"]
