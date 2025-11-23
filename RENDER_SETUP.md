# DejaBrew Render Deployment Guide

Complete guide to deploy DejaBrew to Render.com with PostgreSQL database.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Repository Setup](#repository-setup)
4. [Render Configuration](#render-configuration)
5. [Environment Variables](#environment-variables)
6. [Deployment Steps](#deployment-steps)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- GitHub account with the DejaBrew repository
- Render.com account (free or paid)
- Git installed locally
- PostgreSQL 18 database (provided by Render or external)

---

## Database Setup

### Option 1: Using Existing Render PostgreSQL (Recommended)

Your database credentials:
```
Hostname: dpg-d4hhg8adbo4c73bfojjg-a
Port: 5432
Database: dejabrew
Username: dejabrew_user
Password: 1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3
Region: Singapore
PostgreSQL Version: 18
```

**Internal Connection String (from Render services):**
```
postgresql://dejabrew_user:1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3@dpg-d4hhg8adbo4c73bfojjg-a/dejabrew
```

**External Connection String (from external applications):**
```
postgresql://dejabrew_user:1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3@dpg-d4hhg8adbo4c73bfojjg-a.singapore-postgres.render.com/dejabrew
```

### Option 2: Create New PostgreSQL on Render

1. Log in to [Render.com](https://render.com)
2. Go to Dashboard → New → PostgreSQL
3. Configure:
   - **Name:** dejabrew
   - **Database:** dejabrew
   - **User:** dejabrew_user
   - **Region:** Singapore
   - **PostgreSQL Version:** 18
   - **Plan:** Standard or higher

4. Copy the connection string after creation

---

## Repository Setup

### 1. Update Local Repository

Ensure all Render configuration files are in your repository root:

```bash
cd /path/to/DejaBrew
git status
```

The following files should be present:
- `render.yaml` - Render service configuration
- `build.sh` - Build script with executable permissions
- `requirements.txt` - Python dependencies
- `.env.example` - Environment variables template

### 2. Commit Configuration Files

```bash
git add render.yaml build.sh requirements.txt .env.example
git commit -m "Add Render deployment configuration"
git push origin main
```

---

## Render Configuration

### Method 1: Using render.yaml (Recommended)

1. **Create Web Service from GitHub**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Select branch (e.g., `main`)
   - Choose "Python" as the environment

2. **Render will automatically:**
   - Detect `render.yaml` in repository root
   - Apply all service configurations
   - Set up PostgreSQL connection
   - Configure environment variables

3. **Key Configuration Points:**

   **render.yaml** includes:
   - Web service on port 8000
   - Build command: `./build.sh`
   - Start command: `gunicorn dejabrew.wsgi:application`
   - PostgreSQL service (optional - can use existing)
   - Environment variables for Django

### Method 2: Manual Configuration

If `render.yaml` is not auto-detected:

1. **Create Web Service**
   ```
   Name: dejabrew
   Environment: Python 3.11
   Build Command: ./build.sh
   Start Command: gunicorn dejabrew.wsgi:application --bind 0.0.0.0:$PORT --workers 2
   ```

2. **Link PostgreSQL Database**
   - In Render dashboard, go to your web service
   - Click "Environment" tab
   - Add environment variable:
     ```
     DATABASE_URL=postgresql://dejabrew_user:1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3@dpg-d4hhg8adbo4c73bfojjg-a.singapore-postgres.render.com/dejabrew
     ```

---

## Environment Variables

### Required Variables

Set these in Render Dashboard → Environment:

```env
# Django Settings
DEBUG=false
DJANGO_SECRET_KEY=your-secure-key-here-generate-new
ENVIRONMENT=production
ALLOWED_HOSTS=dejabrew.onrender.com
CORS_ALLOWED_ORIGINS=https://dejabrew.onrender.com

# Database
DATABASE_URL=postgresql://dejabrew_user:1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3@dpg-d4hhg8adbo4c73bfojjg-a.singapore-postgres.render.com/dejabrew

# Security (for HTTPS)
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
SECURE_SSL_REDIRECT=true
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=true
SECURE_HSTS_PRELOAD=true
```

### Generate Secure Django Secret Key

```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Or use an online generator (for non-sensitive projects):
- https://djecrety.ir/

### Optional Variables

```env
WORKERS=2           # Number of Gunicorn workers
PORT=8000          # Port number
PYTHON_VERSION=3.11  # Python version
```

---

## Deployment Steps

### Step 1: Prepare Code

```bash
# Ensure you're on main branch
git checkout main

# Pull latest changes
git pull origin main

# Verify all files are committed
git status
```

### Step 2: Deploy to Render

#### Option A: Using render.yaml (Automatic)

```bash
git push origin main
```

Render will automatically detect `render.yaml` and deploy using those settings.

#### Option B: Manual Deployment

1. Go to [Render.com Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Select your GitHub repository
4. Configure as per "Render Configuration" section above
5. Click "Create Web Service"

### Step 3: Monitor Deployment

1. Go to your service page on Render
2. Click "Logs" tab
3. Watch for:
   ```
   📦 Installing dependencies...
   🎨 Collecting static files...
   🗄️ Running database migrations...
   ✅ Build completed successfully!
   ```

### Step 4: Access Your Application

Once deployment completes:
- Visit: `https://dejabrew.onrender.com`
- Admin panel: `https://dejabrew.onrender.com/admin`

---

## Post-Deployment

### Create Superuser

```bash
# From Render Shell (in Dashboard)
python /var/task/dejabrew/manage.py createsuperuser
```

Or use Django shell:

```bash
# Connect to Render shell
python manage.py shell

# Create superuser via shell
from django.contrib.auth.models import User
User.objects.create_superuser('admin', 'admin@dejabrew.com', 'secure_password')
```

### Database Migrations

Migrations run automatically during build (`build.sh`), but you can manually run:

```bash
# From Render Shell
python /var/task/dejabrew/manage.py migrate
python /var/task/dejabrew/manage.py migrate --app pos
python /var/task/dejabrew/manage.py migrate --app forecasting
```

### Load Sample Data

```bash
# From Render Shell
python /var/task/dejabrew/manage.py loaddata pos/fixtures/sample_items.json
```

### Run Management Commands

```bash
# General format
python /var/task/dejabrew/manage.py <command>

# Examples
python /var/task/dejabrew/manage.py populate_inventory_transactions
python /var/task/dejabrew/manage.py collectstatic --noinput
```

---

## Troubleshooting

### Issue: Build Fails

**Error:** `Command './build.sh' failed`

**Solution:**
1. Verify `build.sh` has execute permissions:
   ```bash
   chmod +x build.sh
   ```
2. Commit and push:
   ```bash
   git add build.sh
   git commit -m "Fix build script permissions"
   git push origin main
   ```

### Issue: Database Connection Error

**Error:** `OperationalError: could not translate host name`

**Solution:**
1. Verify `DATABASE_URL` environment variable is set correctly
2. Check if PostgreSQL service is running on Render
3. Test connection string format:
   ```
   postgresql://username:password@host:port/database
   ```

### Issue: Static Files Not Loading

**Error:** 404 on CSS/JS files

**Solution:**
1. Verify `build.sh` runs `collectstatic`:
   ```bash
   python manage.py collectstatic --noinput --clear
   ```
2. Check WhiteNoise is in MIDDLEWARE (in `settings.py`)
3. Restart the web service

### Issue: Permission Denied on Migrations

**Error:** `permission denied for schema public`

**Solution:**
1. Ensure PostgreSQL user has proper permissions:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE dejabrew TO dejabrew_user;
   ```
2. Or run migrations as superuser initially
3. Contact Render support for managed database issues

### Issue: High Memory Usage

**Solution:**
- Reduce Gunicorn workers in `render.yaml` or environment:
  ```env
  WORKERS=1
  ```
- Upgrade to larger Render plan
- Monitor with Render's built-in monitoring

### Issue: Timeouts During Build

**Error:** `Build failed to complete in time`

**Solution:**
1. Optimize `build.sh` - remove unnecessary steps
2. Use a pip cache to speed up dependency installation
3. Contact Render support to increase timeout
4. Upgrade to a paid plan for faster builds

---

## Database Backup & Recovery

### Automated Backups

Render PostgreSQL provides:
- Daily backups (free plan)
- Hourly backups (paid plans)

### Manual Backup

```bash
# Export database
PGPASSWORD=1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3 pg_dump -h dpg-d4hhg8adbo4c73bfojjg-a.singapore-postgres.render.com -U dejabrew_user dejabrew > backup.sql

# Restore database
PGPASSWORD=1b5ok1iokWCr5VM4pdycvIbGhM8r9gF3 psql -h dpg-d4hhg8adbo4c73bfojjg-a.singapore-postgres.render.com -U dejabrew_user dejabrew < backup.sql
```

---

## Monitoring & Logging

### View Logs

1. Render Dashboard → Your Service → Logs
2. Filter by:
   - Deployment logs
   - Runtime logs
   - All logs

### Monitor Performance

1. Render Dashboard → Your Service → Metrics
2. Track:
   - CPU usage
   - Memory usage
   - Network I/O
   - Response time

### Setup Alerts

- Go to Settings → Notifications
- Configure email alerts for:
  - Build failures
  - Deployment failures
  - Service crashes
  - Resource limits

---

## File Structure

```
DejaBrew/
├── render.yaml              # Render service configuration
├── build.sh                 # Build script
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── RENDER_SETUP.md         # This file
├── dejabrew/               # Django project
│   ├── manage.py
│   ├── dejabrew/
│   │   ├── settings.py     # Updated for Render
│   │   ├── wsgi.py
│   │   └── urls.py
│   ├── pos/                # POS app
│   ├── forecasting/        # Forecasting app
│   └── db.sqlite3          # Local SQLite (dev only)
├── .git/
├── .gitignore
└── README.md
```

---

## Next Steps

1. **Configure CI/CD (Optional)**
   - Set up automatic deployments on push
   - Add GitHub Actions for testing

2. **Setup Custom Domain**
   - Render Dashboard → Custom Domain
   - Update DNS records

3. **Setup SSL/HTTPS**
   - Automatically provided by Render
   - Or use custom certificates

4. **Monitor & Optimize**
   - Review performance metrics
   - Optimize database queries
   - Setup caching strategy

---

## Support & Resources

- **Render Documentation:** https://render.com/docs
- **Django Documentation:** https://docs.djangoproject.com
- **PostgreSQL Documentation:** https://www.postgresql.org/docs
- **Gunicorn Documentation:** https://gunicorn.org

---

## Deployment Checklist

- [ ] All files committed to Git
- [ ] `requirements.txt` updated with all dependencies
- [ ] `build.sh` has execute permissions
- [ ] `DJANGO_SECRET_KEY` generated and set
- [ ] `DATABASE_URL` environment variable set
- [ ] `ALLOWED_HOSTS` configured for your domain
- [ ] `DEBUG=false` for production
- [ ] Static files collection configured
- [ ] Database migrations tested locally
- [ ] Superuser created
- [ ] Sample data loaded (if needed)
- [ ] Logs monitored during deployment
- [ ] Application accessible at deployment URL

---

**Last Updated:** 2025-11-23
**Django Version:** 4.2.8
**PostgreSQL Version:** 18
**Python Version:** 3.13
