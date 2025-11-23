#!/bin/bash

# Exit on any error
set -e

echo "🍺 Building DejaBrew application..."

# Install Python dependencies
echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Navigate to Django app directory
cd /var/task/dejabrew

# Collect static files
echo "🎨 Collecting static files..."
python manage.py collectstatic --noinput --clear

# Run database migrations
echo "🗄️ Running database migrations..."
python manage.py migrate --noinput

# Create superuser if needed (optional - can be done via Django admin later)
# python manage.py shell < create_superuser.py

echo "✅ Build completed successfully!"
