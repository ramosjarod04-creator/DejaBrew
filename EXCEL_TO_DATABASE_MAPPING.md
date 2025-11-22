# 📋 Excel to Database Column Mapping Guide

## Coffee Shop Sales CSV → DejaBrew Database

This guide explains how the **Coffee Shop Sales (Ahmed Abas)** dataset columns map to your DejaBrew database schema.

---

## 📊 Coffee Shop Sales CSV Structure

The Ahmed Abas dataset has these columns:

| Column Name | Data Type | Description | Example |
|-------------|-----------|-------------|---------|
| `transaction_id` | Integer | Unique transaction ID | 1, 2, 3... |
| `transaction_date` | Date | Date of sale | 2023-01-01 |
| `transaction_time` | Time | Time of sale | 08:30:00 |
| `transaction_qty` | Integer | Quantity sold | 1, 2, 3... |
| `store_id` | Integer | Store identifier | 3, 5, 8 |
| `store_location` | String | Store location | Lower Manhattan |
| `product_id` | Integer | Product ID | 2, 15, 42 |
| `unit_price` | Decimal | Price per unit | 3.50 |
| `product_category` | String | Product category | Coffee, Bakery, Tea |
| `product_type` | String | Product subcategory | Gourmet brewed coffee |
| `product_detail` | String | Product name | **Latte, Cappuccino** |

---

## 🗄️ Your DejaBrew Database Schema

### **Item Model** (pos/models.py)
```python
class Item(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    image_url = models.CharField(max_length=500, blank=True)
    recipe = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
```

### **Order Model**
```python
class Order(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    customer_name = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20)  # 'pending', 'paid', 'cancelled'
    cashier = models.ForeignKey(User, on_delete=models.SET_NULL)
    payment_method = models.CharField(max_length=50, default='Cash')
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    dining_option = models.CharField(max_length=20)  # 'dine-in', 'take-out'
    reference_number = models.CharField(max_length=100, blank=True)
```

### **OrderItem Model**
```python
class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    qty = models.IntegerField()
    price_at_order = models.DecimalField(max_digits=10, decimal_places=2)
```

### **Ingredient Model**
```python
class Ingredient(models.Model):
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, blank=True)
    mainStock = models.FloatField(default=0)
    stockRoom = models.FloatField(default=0)
    unit = models.CharField(max_length=20)
    reorder = models.FloatField(default=0)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20)  # 'In Stock', 'Low Stock', 'Out of Stock'
    ingredient_type = models.CharField(max_length=20)  # 'perishable', 'non-perishable'
```

---

## 🔄 Column Mapping

### For Forecasting (No Import Needed)

**The forecasting system reads CSV directly** - no database import required!

```
CSV Column              →  Used For
=====================================
transaction_date        →  Time series date
product_detail          →  Product name (matched to trained models)
transaction_qty         →  Sales quantity to predict
```

### For Database Import (Optional)

If you want to import the CSV data into Django:

#### **CSV → Item Table**

```python
# One unique Item per product_detail
csv['product_detail']    →  Item.name          # "Latte", "Cappuccino"
csv['product_category']  →  Item.category      # "Coffee", "Bakery"
csv['unit_price']        →  Item.price         # 3.50, 4.00
''                       →  Item.stock         # Set to 0 (default)
''                       →  Item.is_active     # Set to True
''                       →  Item.description   # Leave blank
```

#### **CSV → Order Table**

```python
# One Order per unique transaction_id
csv['transaction_date']  →  Order.created_at (date)     # 2023-01-01
csv['transaction_time']  →  Order.created_at (time)     # 08:30:00
(calculated)             →  Order.total                  # Sum of (qty * price)
'paid'                   →  Order.status                 # Always 'paid' for historical data
'Cash'                   →  Order.payment_method         # Default to 'Cash'
'Historical Import'      →  Order.customer_name          # Or leave blank
'dine-in'                →  Order.dining_option          # Default
0                        →  Order.discount               # No discount
''                       →  Order.reference_number       # Leave blank
```

#### **CSV → OrderItem Table**

```python
# One OrderItem per CSV row
(by transaction_id)      →  OrderItem.order             # ForeignKey to Order
(by product_detail)      →  OrderItem.item              # ForeignKey to Item
csv['transaction_qty']   →  OrderItem.qty               # 1, 2, 3
csv['unit_price']        →  OrderItem.price_at_order    # 3.50, 4.00
```

---

## 📝 Example Mapping

### CSV Row:
```csv
transaction_id,transaction_date,transaction_time,transaction_qty,store_id,store_location,product_id,unit_price,product_category,product_type,product_detail
1,2023-01-01,08:30:00,2,3,Lower Manhattan,2,3.50,Coffee,Gourmet brewed coffee,Latte
```

### Maps To:

**Item:**
```python
Item.objects.get_or_create(
    name="Latte",
    defaults={
        'category': 'Coffee',
        'price': 3.50,
        'stock': 0,
        'is_active': True
    }
)
```

**Order:**
```python
Order.objects.create(
    created_at=datetime.datetime(2023, 1, 1, 8, 30, 0),
    total=7.00,  # 2 * 3.50
    status='paid',
    payment_method='Cash',
    customer_name='Historical Import',
    dining_option='dine-in',
    discount=0
)
```

**OrderItem:**
```python
OrderItem.objects.create(
    order=order,  # The Order created above
    item=item,    # The Item "Latte"
    qty=2,
    price_at_order=3.50
)
```

---

## 🚀 Import Script (Optional)

If you want to import the CSV data into your database, here's what you need:

### Step 1: Create Items from CSV

```python
import pandas as pd
from pos.models import Item

df = pd.read_csv('coffee_shop_sales.csv')

# Get unique products
unique_products = df[['product_detail', 'product_category', 'unit_price']].drop_duplicates()

for _, row in unique_products.iterrows():
    Item.objects.get_or_create(
        name=row['product_detail'],
        defaults={
            'category': row['product_category'],
            'price': row['unit_price'],
            'stock': 0,
            'is_active': True
        }
    )
```

### Step 2: Create Orders and OrderItems

```python
from pos.models import Order, OrderItem, Item
from django.utils import timezone
import datetime

df = pd.read_csv('coffee_shop_sales.csv')

# Group by transaction_id
for transaction_id, group in df.groupby('transaction_id'):
    # Create Order
    first_row = group.iloc[0]

    # Combine date and time
    order_datetime = datetime.datetime.combine(
        pd.to_datetime(first_row['transaction_date']).date(),
        pd.to_datetime(first_row['transaction_time']).time()
    )

    # Calculate total
    total = (group['transaction_qty'] * group['unit_price']).sum()

    order = Order.objects.create(
        created_at=order_datetime,
        total=total,
        status='paid',
        payment_method='Cash',
        customer_name='Historical Import',
        dining_option='dine-in'
    )

    # Create OrderItems
    for _, row in group.iterrows():
        item = Item.objects.get(name=row['product_detail'])
        OrderItem.objects.create(
            order=order,
            item=item,
            qty=row['transaction_qty'],
            price_at_order=row['unit_price']
        )
```

---

## ⚠️ Important Notes

### **For Forecasting:**
- ✅ **No database import needed** - forecasting reads CSV directly
- ✅ **Just place CSV in** `forecasting/forecasting_data/`
- ✅ **Run training:** `python forecasting/train_models.py`

### **For Database Import:**
- 📌 **Optional** - only if you want historical orders in Django admin
- 📌 **~150,000 transactions** - may take 5-10 minutes to import
- 📌 **Check for duplicates** - avoid importing same data twice
- 📌 **Backup database first:** `cp db.sqlite3 db.sqlite3.backup`

### **Data Validation:**
- ✅ Remove rows with `transaction_qty <= 0`
- ✅ Remove rows with null `product_detail`
- ✅ Convert dates properly: `pd.to_datetime()`
- ✅ Match product names exactly (case-sensitive)

---

## 🎯 Quick Checklist

**For Forecasting Only:**
- [ ] Download `coffee_shop_sales.csv` from Kaggle
- [ ] Place in `dejabrew/forecasting/forecasting_data/`
- [ ] Run: `python dejabrew/forecasting/train_models.py`
- [ ] Check accuracy metrics in output
- [ ] Test: `python test_forecasting.py`

**For Database Import:**
- [ ] Backup database: `cp db.sqlite3 db.sqlite3.backup`
- [ ] Create import script (see examples above)
- [ ] Import Items first (unique products)
- [ ] Import Orders and OrderItems
- [ ] Verify in Django admin: `/admin/pos/order/`
- [ ] Check total orders: `Order.objects.count()`

---

**Next:** Once CSV is in place, the forecasting system will automatically:
1. Load historical sales data
2. Train Gradient Boosting models
3. Generate predictions for future sales
4. Calculate inventory depletion forecasts

All without requiring database import! 🎉
