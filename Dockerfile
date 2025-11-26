# Use official Python slim image
FROM python:3.12-slim

# Environment settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt /app/

# Install dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the entire project
COPY . /app/

# Create staticfiles directory (writable)
RUN mkdir -p /app/staticfiles

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port (Railway injects $PORT at runtime)
EXPOSE 8000

# Run Gunicorn
CMD gunicorn dejabrew.wsgi:application --bind 0.0.0.0:$PORT
