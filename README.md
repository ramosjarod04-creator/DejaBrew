# ☕ DejaBrew - Modern POS & Inventory Management System

A comprehensive Point of Sale (POS) and inventory management system built with Django, designed specifically for coffee shops and food service businesses.

## ✨ Features

### 🛒 Point of Sale
- **Dual POS Interfaces**: Separate interfaces for cashiers and administrators
- **Real-time Inventory Tracking**: Automatic stock deduction on orders
- **Recipe-based Products**: Support for products made from ingredients
- **Admin Authentication**: Secure void and discount operations with Enter key support
- **Multiple Payment Methods**: Cash, GCash, and Card payments
- **Digital Receipts**: Print-ready receipts with order details
- **Dining Options**: Dine-in and take-out support
- **Add-ons Management**: Dynamic add-ons for products
- **Discount System**: Regular, Senior Citizen, and PWD discounts with VAT calculations

### 📊 Inventory Management
- **Main Stock & Safety Stock**: Dual-level inventory tracking
- **Low Stock Alerts**: Automatic notifications for reordering
- **Ingredient Management**: Track raw materials and supplies
- **Waste Logging**: Record and analyze product waste
- **Stock Room Management**: Separate stock room inventory
- **Inventory Monitoring**: Real-time stock level visualization

### 📈 Analytics & Forecasting
- **Sales Forecasting**: ARIMA-based demand prediction
- **Sales Analytics**: Revenue and product performance tracking
- **Best Selling Products**: Track top performers
- **Audit Trail**: Complete transaction history

### 👥 User Management
- **Role-based Access**: Admin, Cashier, and Staff roles
- **User Profiles**: Detailed user information
- **Activity Logging**: Track user actions

### 📱 Responsive Design
- **Mobile-First**: Optimized for tablets and smartphones
- **Touch-Friendly**: Large buttons for easy interaction
- **Modal System**: Properly centered and scrollable modals
- **Network Access**: Works across local network devices

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ramosjarod04-creator/DejaBrew.git
   cd DejaBrew
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv

   # On Windows:
   venv\Scripts\activate

   # On Mac/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations**:
   ```bash
   cd dejabrew
   python manage.py migrate
   ```

5. **Create superuser**:
   ```bash
   python manage.py createsuperuser
   ```
   - This account will be used for admin authentication (void/discount operations)

6. **Run the development server**:
   ```bash
   python manage.py runserver
   ```

7. **Access the system**:
   - Admin Panel: `http://127.0.0.1:8000/admin/`
   - Cashier POS: `http://127.0.0.1:8000/cashier/`
   - Admin POS: `http://127.0.0.1:8000/admin-pos/`
   - Dashboard: `http://127.0.0.1:8000/`

### Network Access

To access from other devices on your network:

```bash
# Find your IP address
# Windows: ipconfig
# Mac/Linux: ifconfig

# Run server on all interfaces
python manage.py runserver 0.0.0.0:8000

# Access from other devices
# http://YOUR_IP:8000/cashier/
```

## 📖 Documentation

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)**: Complete guide for deploying to Hostinger
- **[Testing Guide](TESTING_GUIDE.md)**: Comprehensive testing checklist
- **[Environment Setup](.env.example)**: Environment variables template

## 🔧 Technology Stack

### Backend
- **Django 4.2.8**: Web framework
- **Django REST Framework**: API development
- **SQLite**: Database (development)
- **Gunicorn**: WSGI HTTP Server (production)
- **WhiteNoise**: Static file serving

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **CSS3**: Modern styling with flexbox/grid
- **Font Awesome**: Icons
- **Responsive Design**: Mobile-first approach

### Data Science
- **Pandas**: Data manipulation
- **NumPy**: Numerical operations
- **Scikit-learn**: Machine learning
- **Statsmodels**: Statistical modeling
- **Matplotlib**: Data visualization

## 🎯 Key Improvements (Latest Release)

### ✅ Fixed Critical Void Authentication Bug
**Problem**: Authentication modal showed success but items weren't voided.

**Root Cause**: `closeAdminPasswordModal()` was called BEFORE `adminPasswordResolve(true)`, which nullified the resolve function, leaving the promise unresolved.

**Solution**: Saved the resolve function before closing the modal, ensuring proper promise resolution.

### ✅ Enhanced Modal System
- Added body scroll locking when modals are open
- Improved centering and responsiveness
- Added Enter key support for authentication
- Fixed z-index layering issues
- Mobile-optimized modal sizing

### ✅ Production-Ready Configuration
- Added Gunicorn configuration
- Integrated WhiteNoise for static files
- Created comprehensive deployment guide
- Added environment variables support
- Configured for Hostinger hosting

## 🛡️ Security Features

- CSRF protection on all forms
- Secure admin authentication for sensitive operations
- Session-based authentication
- Password hashing
- SQL injection prevention
- XSS protection

## 📊 System Requirements

### Development
- Python 3.8+
- 2GB RAM minimum
- 500MB disk space

### Production
- Python 3.8+
- 4GB RAM recommended
- 2GB disk space
- SSL certificate (recommended)

## 🐛 Troubleshooting

### Authentication Not Working
1. Check console for errors (F12 → Console)
2. Verify superuser exists: `python manage.py createsuperuser`
3. Check `/api/verify-admin/` endpoint is accessible

### Static Files Not Loading
```bash
python manage.py collectstatic --noinput
```

### Database Errors
```bash
python manage.py migrate
python manage.py check
```

### Network Access Issues
- Ensure `ALLOWED_HOSTS = ['*']` in settings.py (development only)
- Check firewall settings
- Verify correct IP address

## 📝 License

This project is proprietary software developed for DejaBrew.

## 👨‍💻 Author

**Jarod Ramos**
- GitHub: [@ramosjarod04-creator](https://github.com/ramosjarod04-creator)

## 🙏 Acknowledgments

- Django documentation and community
- Font Awesome for icons
- The open-source community

## 📞 Support

For issues and questions:
1. Check the [Testing Guide](TESTING_GUIDE.md)
2. Review [Deployment Guide](DEPLOYMENT_GUIDE.md)
3. Check console logs for errors
4. Create an issue on GitHub

---

**Made with ☕ and ❤️ by the DejaBrew Team**
