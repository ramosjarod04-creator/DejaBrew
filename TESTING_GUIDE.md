# DejaBrew - Local Testing Guide

Before deploying to production, test all functionality locally.

## 🧪 Pre-Deployment Tests

### 1. Authentication System Test

#### Test Admin Login
```bash
cd dejabrew
python manage.py runserver
```

1. Navigate to `http://127.0.0.1:8000/admin/`
2. Login with your superuser credentials
3. Verify you can access admin panel

#### Test Void Function Authentication

1. Go to `http://127.0.0.1:8000/cashier/`
2. Add an item to cart
3. Click the "×" (void) button on the item
4. **Expected**: Admin authentication modal appears
5. Enter admin username and password
6. Click "Authenticate" or press Enter
7. **Expected**: Item is removed from cart
8. **Expected**: Success notification: "Item voided successfully"

**✅ PASS CRITERIA**: Item must be removed after successful authentication

#### Test Discount Function Authentication

1. On cashier POS, add items to cart
2. Click "Apply Discount (Admin)"
3. **Expected**: Discount modal appears
4. Select a discount type
5. **Expected**: Admin authentication modal appears
6. Enter credentials
7. **Expected**: Discount is applied

**✅ PASS CRITERIA**: Discount must be applied after authentication

### 2. Modal System Test

#### Desktop/Tablet View (Screen > 768px)

1. Resize browser to desktop size (1920x1080)
2. Click "Apply Discount"
3. **Expected**: Modal appears centered
4. **Expected**: Background is dimmed
5. **Expected**: Cannot scroll background while modal is open
6. Click outside modal
7. **Expected**: Modal closes
8. Press ESC key
9. **Expected**: Modal closes

**✅ PASS CRITERIA**: Modal must be centered, scrolling locked, closable

#### Mobile View (Screen < 768px)

1. Resize browser to mobile size (375x667) or use DevTools
2. Open any modal (discount, admin auth, payment)
3. **Expected**: Modal covers entire screen
4. **Expected**: Modal is scrollable if content is tall
5. **Expected**: Buttons are stacked vertically
6. **Expected**: Text is readable, not cut off

**✅ PASS CRITERIA**: Modal must fit screen, be scrollable, fully visible

### 3. Enter Key Support Test

1. Open admin authentication modal
2. Type username
3. Press **Enter**
4. **Expected**: Nothing happens (cursor moves to password field)
5. Type password
6. Press **Enter**
7. **Expected**: Authentication process starts

**✅ PASS CRITERIA**: Enter key must trigger authentication

### 4. Network Access Test

1. Find your computer's IP address:
   - Windows: `ipconfig` → Look for "IPv4 Address"
   - Mac/Linux: `ifconfig` → Look for "inet"

2. Run server on all interfaces:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

3. On another device (phone, tablet) on same network:
   - Navigate to `http://YOUR_IP:8000/cashier/`
   - Example: `http://192.168.1.100:8000/cashier/`

4. **Expected**: Page loads correctly
5. Test void function on mobile device
6. **Expected**: Authentication works

**✅ PASS CRITERIA**: System accessible from other devices on network

### 5. Order Processing Test

1. Add multiple items to cart
2. Select payment method (Cash/GCash/Card)
3. Choose dining option (Dine-In/Take-Out)
4. Click "Process Order"

**For Cash:**
- **Expected**: Order completes immediately
- **Expected**: Order Complete modal appears

**For GCash/Card:**
- **Expected**: Payment details modal appears
- Enter reference number (13 digits)
- **Expected**: Order completes
- **Expected**: Order Complete modal appears

5. Click "View Receipt"
6. **Expected**: Receipt preview modal appears
7. **Expected**: Receipt is properly formatted
8. Click "Print Receipt"
9. **Expected**: Print dialog appears

**✅ PASS CRITERIA**: All payment methods work, receipt displays correctly

### 6. Inventory Deduction Test

1. Note current stock of a product in inventory
2. Process an order with that product
3. Go to Admin → Inventory
4. **Expected**: Stock is reduced by quantity ordered

**For recipe items:**
- Check ingredient stocks before order
- Process order
- **Expected**: Ingredient stocks reduced correctly

**✅ PASS CRITERIA**: Inventory must update automatically

### 7. Static Files Test

```bash
python manage.py collectstatic --noinput
```

1. **Expected**: No errors
2. **Expected**: `staticfiles` folder created
3. Check `staticfiles` folder contains:
   - CSS files
   - JavaScript files
   - Images
   - Admin static files

**✅ PASS CRITERIA**: All static files collected successfully

### 8. Database Migrations Test

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py check
```

1. **Expected**: No errors
2. **Expected**: "No changes detected" or migrations apply successfully
3. **Expected**: System check passes

**✅ PASS CRITERIA**: No migration errors, system check passes

## 🐛 Known Issues to Test For

### Issue: Modal appears behind content
- **Test**: Open modal, check z-index
- **Fix**: Verify `z-index: 10001` or higher

### Issue: Can't authenticate admin
- **Test**: Void an item
- **Fix**: Check console for errors, verify `/api/verify-admin/` works

### Issue: Static files 404 in production
- **Test**: After `collectstatic`, check `/static/` URLs
- **Fix**: Verify STATIC_ROOT and whitenoise config

### Issue: CORS errors
- **Test**: API calls from frontend
- **Fix**: Verify `django-cors-headers` installed and configured

## 📊 Performance Tests

### Load Time Test
1. Open DevTools → Network tab
2. Refresh cashier POS page
3. **Expected**: Page loads in < 3 seconds
4. **Expected**: No 404 errors for static files

### Mobile Performance Test
1. Open DevTools → Toggle device toolbar
2. Set throttling to "Slow 3G"
3. Reload page
4. **Expected**: Page still usable (< 10 seconds load)

### Concurrent Users Test
1. Open cashier POS in 3+ browser tabs
2. Process orders simultaneously
3. **Expected**: No conflicts
4. **Expected**: Inventory updates correctly

## ✅ Final Checklist Before Deployment

- [ ] All authentication tests pass
- [ ] Void function works correctly
- [ ] Discount function works correctly
- [ ] Modals display correctly on desktop
- [ ] Modals display correctly on mobile
- [ ] Enter key triggers authentication
- [ ] Network access works from other devices
- [ ] Order processing works for all payment methods
- [ ] Inventory deducts correctly
- [ ] Static files collect without errors
- [ ] Database migrations work
- [ ] No console errors
- [ ] No 404 errors for resources
- [ ] Page load time acceptable
- [ ] Mobile performance acceptable
- [ ] System works on different browsers (Chrome, Firefox, Safari)

## 🎯 Critical Test Scenarios

### Scenario 1: Rush Hour Simulation
1. Open 2 browser tabs (2 cashiers)
2. Process orders simultaneously
3. Use same products
4. **Expected**: No inventory conflicts
5. **Expected**: Both orders process correctly

### Scenario 2: Network Interruption
1. Start processing order
2. Disconnect internet
3. **Expected**: Graceful error message
4. Reconnect internet
5. **Expected**: Can retry order

### Scenario 3: Invalid Data Entry
1. Try to void without authentication
2. **Expected**: Authentication required
3. Try to enter invalid reference number (< 13 digits)
4. **Expected**: Validation error
5. Try to order more than available stock
6. **Expected**: Cannot exceed stock error

## 📝 Test Results Template

```
Test Date: YYYY-MM-DD
Tester: [Your Name]
Environment: [Local/Staging/Production]

Authentication Tests: [ PASS / FAIL ]
Modal Tests: [ PASS / FAIL ]
Order Processing: [ PASS / FAIL ]
Inventory Tests: [ PASS / FAIL ]
Network Access: [ PASS / FAIL ]
Static Files: [ PASS / FAIL ]

Issues Found:
1. [Issue description]
2. [Issue description]

Notes:
[Any additional observations]
```

---

**Remember**: Always test locally before deploying to production!
