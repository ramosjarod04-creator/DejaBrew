"""
Production settings for DejaBrew POS System
Use this settings file on PythonAnywhere or other production servers

Usage:
    Set environment variable: DJANGO_SETTINGS_MODULE=dejabrew.settings_production
    Or in WSGI file: os.environ['DJANGO_SETTINGS_MODULE'] = 'dejabrew.settings_production'
"""

from .settings import *
import os

# SECURITY WARNING: keep the secret key used in production secret!
# Generate a new one using: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    # WARNING: Change this immediately! Never use default in production!
    'CHANGE-THIS-SECRET-KEY-IN-PRODUCTION'
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# Update with your actual PythonAnywhere domain or production domain
ALLOWED_HOSTS = os.environ.get(
    'ALLOWED_HOSTS',
    'yourusername.pythonanywhere.com,localhost,127.0.0.1'
).split(',')

# ==================== SECURITY SETTINGS ====================
# These settings enhance security in production

# Ensure cookies are only sent over HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Enable HTTPS redirect
SECURE_SSL_REDIRECT = True

# For PythonAnywhere's proxy setup (they handle SSL termination)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Additional security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HSTS (HTTP Strict Transport Security)
# Uncomment after confirming HTTPS works properly
# SECURE_HSTS_SECONDS = 31536000  # 1 year
# SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# SECURE_HSTS_PRELOAD = True

# ==================== SESSION SETTINGS ====================
SESSION_COOKIE_AGE = 3600  # 1 hour
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_NAME = 'dejabrew_sessionid'

# ==================== STATIC FILES ====================
# For PythonAnywhere, use absolute paths
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Ensure directories exist
os.makedirs(STATIC_ROOT, exist_ok=True)
os.makedirs(MEDIA_ROOT, exist_ok=True)

# ==================== DATABASE ====================
# Option 1: Keep SQLite (current setup)
# No changes needed - already configured in base settings.py

# Option 2: Use MySQL on PythonAnywhere (recommended for production)
# Uncomment and configure when ready:
"""
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ.get('DB_NAME', 'yourusername$dejabrew'),
        'USER': os.environ.get('DB_USER', 'yourusername'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'yourusername.mysql.pythonanywhere-services.com'),
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
        },
    }
}
"""

# ==================== LOGGING ====================
# Enhanced logging for production debugging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'WARNING',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.log'),
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'WARNING',
            'propagate': False,
        },
        'pos': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'forecasting': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Create logs directory
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)

# ==================== CORS ====================
# Tighten CORS for production
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://yourusername.pythonanywhere.com",
    # Add your actual domain here
]

# If you need to allow credentials (cookies, auth headers)
CORS_ALLOW_CREDENTIALS = True

# ==================== EMAIL CONFIGURATION ====================
# Configure email backend for production (optional)
# For PythonAnywhere, you can use SMTP
"""
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # Or your SMTP server
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@dejabrew.com')
"""

# ==================== PERFORMANCE ====================
# Enable GZip compression middleware (already in MIDDLEWARE)
# Whitenoise handles caching automatically

# Database connection pooling (for MySQL)
# CONN_MAX_AGE = 600  # 10 minutes

# ==================== ML MODEL STORAGE ====================
# Ensure ML models directory exists
ML_MODELS_DIR = os.path.join(MEDIA_ROOT, 'ml_models')
os.makedirs(ML_MODELS_DIR, exist_ok=True)

# ==================== ADMIN ====================
# Customize admin site
ADMIN_SITE_HEADER = "DejaBrew POS Administration"
ADMIN_SITE_TITLE = "DejaBrew Admin"
ADMIN_INDEX_TITLE = "Welcome to DejaBrew POS Admin"

print("=" * 50)
print("DejaBrew Production Settings Loaded")
print(f"DEBUG: {DEBUG}")
print(f"ALLOWED_HOSTS: {ALLOWED_HOSTS}")
print(f"SECRET_KEY: {'***' if SECRET_KEY != 'CHANGE-THIS-SECRET-KEY-IN-PRODUCTION' else 'WARNING: USING DEFAULT KEY!'}")
print("=" * 50)
