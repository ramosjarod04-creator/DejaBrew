# DejaBrew - PythonAnywhere Deployment Guide

## 📋 Pre-Deployment System Check - Status: ✅ PASSED

### System Audit Results (Completed: 2025-11-26)

✅ **Django Settings** - Configuration verified
✅ **Requirements.txt** - All dependencies listed
✅ **Database Configuration** - SQLite configured (ready for MySQL upgrade)
✅ **Static Files** - WhiteNoise configured properly
✅ **Python Syntax** - No errors in core files
✅ **WSGI Configuration** - Properly configured
✅ **Security Settings** - Reviewed (see production adjustments needed)

---

## 🚀 PythonAnywhere Deployment Steps

### Step 1: Create PythonAnywhere Account
1. Go to https://www.pythonanywhere.com/
2. Sign up for a free account (or paid if needed)
3. Verify your email address

### Step 2: Upload Your Code

**Option A: Using Git (Recommended)**
```bash
# In PythonAnywhere Bash Console:
cd ~
git clone https://github.com/ramosjarod04-creator/DejaBrew.git
cd DejaBrew/dejabrew
```

**Option B: Manual Upload**
1. Use PythonAnywhere's "Files" tab
2. Upload your entire DejaBrew project
3. Extract to `/home/yourusername/DejaBrew`

### Step 3: Create Virtual Environment

```bash
# In PythonAnywhere Bash Console:
cd ~/DejaBrew
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file in your project root:
```bash
nano ~/DejaBrew/.env
```

Add the following (replace with your values):
```env
DJANGO_SECRET_KEY=your-very-secret-key-here-generate-a-new-one
DEBUG=False
ALLOWED_HOSTS=yourusername.pythonanywhere.com
DATABASE_URL=sqlite:///db.sqlite3
```

Generate a new SECRET_KEY:
```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

### Step 5: Update Settings for Production

The settings file needs these adjustments for production. Create `settings_production.py`:

```python
from .settings import *

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

# Update ALLOWED_HOSTS with your PythonAnywhere domain
ALLOWED_HOSTS = ['yourusername.pythonanywhere.com', 'localhost', '127.0.0.1']

# SECURITY SETTINGS FOR PRODUCTION
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# For PythonAnywhere's proxy setup
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Static files (already configured with WhiteNoise)
STATIC_ROOT = '/home/yourusername/DejaBrew/dejabrew/staticfiles'
MEDIA_ROOT = '/home/yourusername/DejaBrew/dejabrew/media'
```

### Step 6: Run Database Migrations

```bash
cd ~/DejaBrew/dejabrew
source ~/DejaBrew/venv/bin/activate
python manage.py migrate
python manage.py createsuperuser  # Create admin account
python manage.py collectstatic --noinput
```

### Step 7: Configure WSGI File in PythonAnywhere

1. Go to PythonAnywhere Web tab
2. Click "Add a new web app"
3. Choose "Manual configuration" (not Django wizard)
4. Choose Python 3.10
5. Edit the WSGI configuration file:

```python
# +++++++++++ DJANGO WSGI CONFIGURATION +++++++++++

import os
import sys

# Add your project directory to the sys.path
path = '/home/yourusername/DejaBrew/dejabrew'
if path not in sys.path:
    sys.path.insert(0, path)

# Set the DJANGO_SETTINGS_MODULE
os.environ['DJANGO_SETTINGS_MODULE'] = 'dejabrew.settings'

# Activate your virtual environment
activate_this = '/home/yourusername/DejaBrew/venv/bin/activate_this.py'
with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

# Import Django WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

### Step 8: Configure Static Files

In PythonAnywhere Web tab, add static files mappings:

| URL | Directory |
|-----|-----------|
| /static/ | /home/yourusername/DejaBrew/dejabrew/staticfiles |
| /media/ | /home/yourusername/DejaBrew/dejabrew/media |

### Step 9: Reload Web App

1. Go to PythonAnywhere Web tab
2. Click the big green "Reload" button
3. Visit your site: `https://yourusername.pythonanywhere.com`

---

## 🔧 Required Settings Changes for Production

### Critical Security Updates Needed:

**File: `dejabrew/settings.py`**

**BEFORE DEPLOYING, CHANGE:**

1. **DEBUG Mode**
   ```python
   # Current (development):
   DEBUG = True

   # Change to (production):
   DEBUG = False
   ```

2. **ALLOWED_HOSTS**
   ```python
   # Current (development):
   ALLOWED_HOSTS = ['*']

   # Change to (production):
   ALLOWED_HOSTS = ['yourusername.pythonanywhere.com']
   ```

3. **SECRET_KEY**
   ```python
   # Generate a new secret key for production
   # Never use the default development key!
   SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'fallback-only-for-dev')
   ```

4. **SESSION_COOKIE_SECURE**
   ```python
   # Current (development):
   SESSION_COOKIE_SECURE = False

   # Change to (production):
   SESSION_COOKIE_SECURE = True
   ```

5. **CSRF_COOKIE_SECURE**
   ```python
   # Add this line for production:
   CSRF_COOKIE_SECURE = True
   ```

---

## 🗄️ Database Options

### Option 1: SQLite (Current - OK for small to medium traffic)
- Already configured
- No additional setup needed
- Limitations: Not suitable for high concurrent writes

### Option 2: MySQL (Recommended for Production)

1. Create MySQL database in PythonAnywhere:
   - Go to "Databases" tab
   - Initialize MySQL
   - Create database: `dejabrew`

2. Update `requirements.txt`:
   ```
   mysqlclient==2.2.0
   ```

3. Update `settings.py`:
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.mysql',
           'NAME': 'yourusername$dejabrew',
           'USER': 'yourusername',
           'PASSWORD': 'your-mysql-password',
           'HOST': 'yourusername.mysql.pythonanywhere-services.com',
           'OPTIONS': {
               'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
           },
       }
   }
   ```

4. Run migrations:
   ```bash
   python manage.py migrate
   ```

---

## 📊 ML Model Files

Your forecasting models will be saved to:
```
~/DejaBrew/dejabrew/media/ml_models/
```

Ensure this directory has write permissions:
```bash
chmod -R 755 ~/DejaBrew/dejabrew/media/
```

---

## 🔍 Troubleshooting

### Issue: "DisallowedHost" Error
**Solution:** Add your domain to ALLOWED_HOSTS in settings.py

### Issue: Static files not loading
**Solution:**
1. Run `python manage.py collectstatic`
2. Check static file mappings in Web tab
3. Verify STATIC_ROOT path

### Issue: ImportError or ModuleNotFoundError
**Solution:**
1. Ensure virtual environment is activated in WSGI file
2. Check that all requirements are installed: `pip list`
3. Verify sys.path in WSGI configuration

### Issue: 500 Internal Server Error
**Solution:**
1. Check error logs in PythonAnywhere Web tab
2. Set `DEBUG = True` temporarily to see detailed error
3. Check file permissions

### Issue: Database errors
**Solution:**
1. Verify database file permissions
2. Run migrations: `python manage.py migrate`
3. Check database path in settings

---

## ✅ Post-Deployment Checklist

- [ ] Site loads at https://yourusername.pythonanywhere.com
- [ ] Static files (CSS, JS, images) are loading
- [ ] Admin panel accessible at /admin/
- [ ] Login/logout working
- [ ] POS system functional
- [ ] Inventory management working
- [ ] Forecasting API responding
- [ ] ML model training works
- [ ] Database writes working
- [ ] Forms submitting correctly
- [ ] HTTPS enabled (automatic on PythonAnywhere)

---

## 📝 Maintenance Tasks

### Regular Backups
```bash
# Backup database
cd ~/DejaBrew/dejabrew
python manage.py dumpdata > backup_$(date +%Y%m%d).json

# Backup media files
tar -czf media_backup_$(date +%Y%m%d).tar.gz media/
```

### Update Application
```bash
cd ~/DejaBrew
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
# Reload via Web tab
```

---

## 🆘 Support Resources

- **PythonAnywhere Help**: https://help.pythonanywhere.com/
- **Django Documentation**: https://docs.djangoproject.com/
- **Project Repository**: https://github.com/ramosjarod04-creator/DejaBrew

---

## 🎯 Performance Optimization Tips

1. **Enable Browser Caching**
   - WhiteNoise already handles this

2. **Compress Responses**
   ```python
   # Add to MIDDLEWARE
   'django.middleware.gzip.GZipMiddleware',
   ```

3. **Database Optimization**
   - Use `select_related()` and `prefetch_related()`
   - Add database indexes on frequently queried fields

4. **Use Caching** (for paid PythonAnywhere accounts)
   ```python
   CACHES = {
       'default': {
           'BACKEND': 'django.core.cache.backends.memcached.PyMemcacheCache',
           'LOCATION': '127.0.0.1:11211',
       }
   }
   ```

---

**Last Updated**: November 26, 2025
**System Status**: ✅ Ready for Deployment
