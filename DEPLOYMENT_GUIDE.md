# DejaBrew - Hostinger Deployment Guide

This guide will walk you through deploying the DejaBrew POS system to Hostinger Python hosting.

## 📋 Prerequisites

1. Hostinger Python Hosting Account
2. SSH access to your Hostinger server
3. Domain name (optional, but recommended)
4. Basic knowledge of terminal/command line

## 🚀 Deployment Steps

### Step 1: Prepare Your Local Environment

1. **Test locally first**:
   ```bash
   cd dejabrew
   python manage.py check
   python manage.py collectstatic --noinput
   ```

2. **Create a superuser** (if you haven't already):
   ```bash
   python manage.py createsuperuser
   ```
   - Username: `admin`
   - Password: Choose a strong password
   - This account will be used for void/discount authentication

### Step 2: Upload to Hostinger

#### Option A: Via SSH and Git (Recommended)

1. **SSH into your Hostinger server**:
   ```bash
   ssh username@your-server.com
   ```

2. **Clone your repository**:
   ```bash
   cd ~/domains/yourdomain.com/public_html
   git clone https://github.com/ramosjarod04-creator/DejaBrew.git
   cd DejaBrew
   ```

#### Option B: Via File Manager

1. Compress your project folder locally
2. Upload via Hostinger File Manager
3. Extract in the appropriate directory

### Step 3: Set Up Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit .env with production values**:
   ```bash
   nano .env
   ```

   Update these values:
   ```env
   DEBUG=False
   SECRET_KEY=generate-a-new-secret-key-here-very-long-and-random
   ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,your-server-ip
   CSRF_COOKIE_SECURE=True
   SESSION_COOKIE_SECURE=True
   ```

   **Generate a new SECRET_KEY**:
   ```python
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   ```

### Step 5: Update Django Settings for Production

Edit `dejabrew/dejabrew/settings.py`:

```python
import os
from decouple import config, Csv

# Production settings
DEBUG = config('DEBUG', default=False, cast=bool)
SECRET_KEY = config('SECRET_KEY')
ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())

# Security settings
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
```

### Step 6: Collect Static Files

```bash
cd dejabrew
python manage.py collectstatic --noinput
```

This creates a `staticfiles` folder with all CSS, JS, and images.

### Step 7: Set Up Database

```bash
# Run migrations
python manage.py migrate

# Create superuser (if not done locally)
python manage.py createsuperuser
```

### Step 8: Configure Gunicorn

1. **Test Gunicorn**:
   ```bash
   gunicorn dejabrew.wsgi:application --bind 0.0.0.0:8000
   ```

2. **If it works, configure systemd service** (create `/etc/systemd/system/dejabrew.service`):
   ```ini
   [Unit]
   Description=DejaBrew Gunicorn Service
   After=network.target

   [Service]
   User=your-username
   Group=www-data
   WorkingDirectory=/path/to/DejaBrew/dejabrew
   Environment="PATH=/path/to/DejaBrew/venv/bin"
   ExecStart=/path/to/DejaBrew/venv/bin/gunicorn --config /path/to/DejaBrew/gunicorn_config.py dejabrew.wsgi:application

   [Install]
   WantedBy=multi-user.target
   ```

3. **Start the service**:
   ```bash
   sudo systemctl start dejabrew
   sudo systemctl enable dejabrew
   sudo systemctl status dejabrew
   ```

### Step 9: Configure Nginx (if using)

Create `/etc/nginx/sites-available/dejabrew`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;

    location /static/ {
        alias /path/to/DejaBrew/dejabrew/staticfiles/;
    }

    location /media/ {
        alias /path/to/DejaBrew/dejabrew/media/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/dejabrew /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 10: Set Up SSL (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 🔧 Troubleshooting

### Static Files Not Loading

```bash
# Re-collect static files
python manage.py collectstatic --clear --noinput

# Check permissions
chmod -R 755 staticfiles/
```

### Database Errors

```bash
# Reset migrations (DANGER: only on fresh install)
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
python manage.py makemigrations
python manage.py migrate
```

### Gunicorn Won't Start

```bash
# Check logs
journalctl -u dejabrew.service -n 50

# Test manually
cd dejabrew
gunicorn dejabrew.wsgi:application --bind 0.0.0.0:8000 --log-level debug
```

## 📱 Accessing the System

Once deployed:

- **Admin Panel**: `https://yourdomain.com/admin/`
- **Cashier POS**: `https://yourdomain.com/cashier/`
- **Admin POS**: `https://yourdomain.com/admin-pos/`
- **Dashboard**: `https://yourdomain.com/`

## 🔐 Security Checklist

- [ ] DEBUG is set to False in production
- [ ] SECRET_KEY is changed from default
- [ ] ALLOWED_HOSTS is configured correctly
- [ ] SSL certificate is installed
- [ ] Firewall is configured
- [ ] Regular backups are scheduled
- [ ] Strong admin password is set

## 🔄 Updates and Maintenance

### Pulling Updates

```bash
cd /path/to/DejaBrew
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
cd dejabrew
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart dejabrew
```

### Backup Database

```bash
python manage.py dumpdata > backup_$(date +%Y%m%d).json
```

### Restore Database

```bash
python manage.py loaddata backup_YYYYMMDD.json
```

## 📊 Monitoring

### Check Application Status

```bash
sudo systemctl status dejabrew
```

### View Logs

```bash
journalctl -u dejabrew.service -f
```

### Check Resource Usage

```bash
htop
```

## 🆘 Support

If you encounter issues:

1. Check the logs: `journalctl -u dejabrew.service -n 100`
2. Verify all services are running: `sudo systemctl status dejabrew nginx`
3. Test database connection: `python manage.py dbshell`
4. Check static files: Visit `/static/admin/css/base.css`

## 🎉 Post-Deployment Checklist

- [ ] System is accessible via domain
- [ ] Admin panel works
- [ ] Cashier POS loads correctly
- [ ] Authentication works (test void/discount)
- [ ] Products display correctly
- [ ] Orders process successfully
- [ ] Receipt printing works
- [ ] Inventory updates correctly
- [ ] Forecasting module works
- [ ] Mobile responsiveness checked
- [ ] SSL certificate is active
- [ ] Backups are configured

---

**Congratulations!** Your DejaBrew POS system is now live! 🎊
