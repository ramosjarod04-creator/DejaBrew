# 📥 How to Download Coffee Shop Sales Dataset

## Step 1: Download from Kaggle

### Option A: Manual Download (Easiest)
1. **Visit the dataset page:**
   ```
   https://www.kaggle.com/datasets/ahmedabbas757/coffee-sales
   ```

2. **Click "Download" button** (top right corner)
   - File will download as `archive.zip` or `coffee-sales.zip`

3. **Extract the ZIP file:**
   - You'll get a file named something like:
     - `Coffee Shop Sales.xlsx` OR
     - `index.xlsx` OR
     - `coffee_shop_sales.csv`

4. **Convert to CSV if it's Excel:**
   - Open in Excel/LibreOffice
   - File → Save As → CSV (Comma delimited)
   - Save as: `coffee_shop_sales.csv`

5. **Move to forecasting_data folder:**
   ```bash
   mv ~/Downloads/coffee_shop_sales.csv /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
   ```

### Option B: Using Kaggle API (If you have kaggle.json)
```bash
# Install kaggle
pip install kaggle

# Download dataset
cd /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
kaggle datasets download -d ahmedabbas757/coffee-sales
unzip coffee-sales.zip

# Convert Excel to CSV if needed
python3 << 'EOF'
import pandas as pd
import glob

# Find the Excel file
excel_files = glob.glob('*.xlsx') + glob.glob('*.xls')
if excel_files:
    df = pd.read_excel(excel_files[0])
    df.to_csv('coffee_shop_sales.csv', index=False)
    print(f"Converted {excel_files[0]} to coffee_shop_sales.csv")
else:
    print("No Excel files found")
EOF

# Clean up
rm -f *.zip *.xlsx
```

---

## Step 2: Verify the CSV Structure

The **Coffee Shop Sales by Ahmed Abas** dataset has these columns:

| Column Name | Description | Maps to DB |
|-------------|-------------|------------|
| `transaction_id` | Unique transaction ID | Order.id |
| `transaction_date` | Date of sale | Order.created_at (date) |
| `transaction_time` | Time of sale | Order.created_at (time) |
| `transaction_qty` | Quantity sold | OrderItem.qty |
| `store_id` | Store identifier | (Not used) |
| `store_location` | Store location | (Not used) |
| `product_id` | Product ID | Item.id |
| `unit_price` | Price per unit | Item.price |
| `product_category` | Product category | Item.category |
| `product_type` | Product type/subcategory | (Not used) |
| `product_detail` | Product name | **Item.name** ⭐ |

**Check your CSV:**
```bash
cd /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
head -5 coffee_shop_sales.csv
```

Expected output:
```
transaction_id,transaction_date,transaction_time,transaction_qty,store_id,store_location,product_id,unit_price,product_category,product_type,product_detail
1,2023-01-01,08:30:00,1,3,Lower Manhattan,2,3.5,Coffee,Gourmet brewed coffee,Latte
...
```

---

## Step 3: Database Column Mapping

### If You Need to Import Data to Your Database:

**Your DejaBrew Database Structure:**
- **Item**: `name`, `category`, `price`, `stock`, `is_active`
- **Order**: `created_at`, `total`, `status`, `payment_method`, `customer_name`
- **OrderItem**: `order`, `item`, `qty`, `price_at_order`

**CSV → Database Mapping:**

```python
# Excel/CSV Column → Django Model Field
coffee_shop_sales.csv       →  DejaBrew Database
=====================================
product_detail              →  Item.name
product_category            →  Item.category
unit_price                  →  Item.price
(set manually)              →  Item.stock (default: 0)
(set manually)              →  Item.is_active (default: True)

transaction_date            →  Order.created_at (date part)
transaction_time            →  Order.created_at (time part)
(sum of qty * price)        →  Order.total
(set to 'paid')             →  Order.status
(set to 'Cash')             →  Order.payment_method

transaction_qty             →  OrderItem.qty
unit_price                  →  OrderItem.price_at_order
```

---

## Step 4: What You Need to Do

### For Forecasting (No Import Needed):
✅ **Just place the CSV file** in `forecasting/forecasting_data/`
✅ **The forecasting system will read it directly** - no database import needed!

### For Database Integration (Optional):
If you want to import the CSV data into your Django database:

1. I'll create an import script for you
2. It will:
   - Create Items from unique products in CSV
   - Create Orders from transactions
   - Link OrderItems to Orders and Items

**Do you want me to create this import script?**

---

## Quick Start (Just for Forecasting):

```bash
# 1. Download CSV from Kaggle manually
# 2. Place it in the right folder:
mv ~/Downloads/coffee_shop_sales.csv \
   /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/

# 3. Verify it's there:
ls -lh /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/coffee_shop_sales.csv

# 4. Check first few lines:
head -3 /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/coffee_shop_sales.csv

# 5. Train models (I'll update the script next):
python /home/user/DejaBrew/dejabrew/forecasting/train_models.py
```

---

## Notes:

- 📌 **Forecasting doesn't require database import** - it reads CSV directly
- 📌 **Database import is only needed** if you want historical orders in Django admin
- 📌 **The CSV has ~150,000 transactions** from Maven Roasters coffee shop
- 📌 **Date range**: Typically 2023 data (6+ months of sales)

---

**Next:** Once you place the CSV file, I'll update `forecasting_service.py` and `train_models.py` to use it!
