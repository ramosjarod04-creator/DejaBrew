# ---------- BUILDER STAGE ----------
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system dependencies required for numpy, pandas, sklearn, matplotlib, Pillow, psycopg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libpq-dev \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    libpng-dev \
    libfreetype6-dev \
    libblas-dev \
    liblapack-dev \
    gfortran \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---------- RUNTIME STAGE ----------
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install only the runtime libs (much smaller than builder deps)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    libjpeg62-turbo \
    libpng16-16 \
    libfreetype6 \
    libblas3 \
    liblapack3 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local /usr/local

# Copy Django project
COPY . .

# Run as non-root for security
RUN useradd -m appuser
USER appuser

# Expose Railway port
EXPOSE 8000

# Create staticfiles directory
RUN mkdir -p /app/staticfiles

# Run migrations and collect static files
RUN python manage.py collectstatic --noinput || true

# Gunicorn entrypoint with Railway PORT support
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "sync", "--max-requests", "1000", "--timeout", "60", "dejabrew.wsgi:application"]
