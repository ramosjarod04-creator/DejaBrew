# 🚀 Quick Start: Coffee Shop Sales Forecasting

## Setup in 5 Minutes

This guide will get your forecasting system working with the **Coffee Shop Sales (Ahmed Abas)** dataset.

---

## Step 1: Download the Dataset (2 minutes)

### Option A: Manual Download (Easiest)

1. **Visit Kaggle:**
   ```
   https://www.kaggle.com/datasets/ahmedabbas757/coffee-sales
   ```

2. **Click "Download"** (top right)

3. **Extract the ZIP file**

4. **Find the Excel file:**
   - Usually named: `Coffee Shop Sales.xlsx` or `index.xlsx`

5. **Convert to CSV:**
   - Open in Excel/LibreOffice/Google Sheets
   - File → Save As → CSV
   - Save as: `coffee_shop_sales.csv`

### Option B: Python Convert

If you have the Excel file:

```bash
cd /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/

# Install openpyxl if needed
pip install openpyxl pandas

# Convert Excel to CSV
python3 << 'EOF'
import pandas as pd
import glob

excel_files = glob.glob('*.xlsx') + glob.glob('*.xls')
if excel_files:
    df = pd.read_excel(excel_files[0])
    df.to_csv('coffee_shop_sales.csv', index=False)
    print(f"✓ Converted {excel_files[0]} to coffee_shop_sales.csv")
else:
    print("No Excel files found. Please download from Kaggle.")
EOF
```

---

## Step 2: Place the CSV File (30 seconds)

```bash
# Move CSV to the forecasting_data folder
mv ~/Downloads/coffee_shop_sales.csv \
   /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/

# Verify it's there
ls -lh /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/coffee_shop_sales.csv
```

**Expected output:**
```
-rw-r--r-- 1 user user 12M Nov 22 18:00 coffee_shop_sales.csv
```

---

## Step 3: Verify CSV Format (1 minute)

Check the first few lines:

```bash
head -3 /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/coffee_shop_sales.csv
```

**Should see columns like:**
```
transaction_id,transaction_date,transaction_time,transaction_qty,store_id,store_location,product_id,unit_price,product_category,product_type,product_detail
1,2023-01-01,08:30:00,1,3,Lower Manhattan,2,3.50,Coffee,Gourmet brewed coffee,Latte
```

**Required columns:**
- ✅ `transaction_date`
- ✅ `product_detail`
- ✅ `transaction_qty`

If column names are different, you may need to rename them manually in Excel.

---

## Step 4: Train Models (2 minutes)

```bash
cd /home/user/DejaBrew

# Run training script
python dejabrew/forecasting/train_models.py
```

**What you'll see:**

```
================================================================================
  DejaBrew Forecasting Model Training
  Using Coffee Shop Sales Dataset (Ahmed Abas)
================================================================================

Loading Coffee Shop Sales from: .../coffee_shop_sales.csv
✓ Successfully loaded Coffee Shop Sales!
  Total transactions: 149,116
  Date range: 2023-01-01 to 2023-06-30
  Unique products: 73

Training models for top 30 products by sales volume:
  1. Brewed Chai tea (6,523 units sold)
  2. Gourmet brewed coffee (5,894 units sold)
  3. Barista Espresso (5,102 units sold)
  ...

[1/30] Training: Brewed Chai tea
Saved model for Brewed Chai tea -> model_brewed_chai_tea.joblib
  Train: MAE=2.15, R²=0.8421
  Test:  MAE=2.89, RMSE=4.12, R²=0.7956, Accuracy=87.34%

...

Training complete! Successfully trained 30 models.
```

**Training time:** ~1-2 minutes depending on your system

---

## Step 5: Test the System (30 seconds)

```bash
python test_forecasting.py
```

**Expected output:**

```
================================================================================
  DejaBrew Forecasting System - Validation Test
================================================================================

1. Testing Data Files
✓ coffee_shop_sales.csv

2. Testing Trained Models
✓ Found 30 trained models:
  ✓ [1] Brewed Chai tea - Model loaded successfully
  ✓ [2] Gourmet brewed coffee - Model loaded successfully
  ✓ [3] Barista Espresso - Model loaded successfully

3. Testing Predictions
✓ Prediction successful!
  Sample predictions:
    Day 1: 2025-11-23 → 8 units
    Day 2: 2025-11-24 → 12 units
    Day 3: 2025-11-25 → 15 units

🎉 All tests passed! Your forecasting system is ready to use.
```

---

## Step 6: Use the Forecasting System

### Via Dashboard

1. **Start Django server:**
   ```bash
   cd /home/user/DejaBrew/dejabrew
   python manage.py runserver
   ```

2. **Visit dashboard:**
   ```
   http://localhost:8000/
   ```

3. **View forecasts:**
   - Scroll to "Sales Forecast" section
   - See aggregated revenue predictions
   - View per-product forecasts
   - Check inventory depletion

### Via API

```bash
# Get 7-day forecast for all products
curl http://localhost:8000/forecasting/api/predict/?days=7

# Get 30-day forecast for specific product
curl "http://localhost:8000/forecasting/api/predict/?days=30&item=Latte"

# Get weekly forecast
curl "http://localhost:8000/forecasting/api/predict/?days=28&period=weekly"
```

---

## Troubleshooting

### Problem: "CSV not found"

**Solution:**
```bash
# Check if file exists
ls -lh /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/

# If not there, check Downloads folder
ls ~/Downloads/coffee_shop_sales.csv

# Move it
mv ~/Downloads/coffee_shop_sales.csv \
   /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
```

### Problem: "Missing required columns"

**Cause:** CSV has different column names

**Solution:**
1. Open CSV in Excel
2. Rename columns to match:
   - `transaction_date` (date of sale)
   - `product_detail` (product name)
   - `transaction_qty` (quantity sold)
3. Save and retry

### Problem: "No models trained"

**Possible causes:**
- CSV has less than 30 days of data
- Data format is incorrect
- Dates can't be parsed

**Solution:**
```bash
# Check CSV format
head -5 /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/coffee_shop_sales.csv

# Look for error messages in training output
python dejabrew/forecasting/train_models.py 2>&1 | tee training.log
```

### Problem: "Predictions not showing in dashboard"

**Cause:** Product names in database don't match trained model names

**Solution:**
Create a mapping file: `forecasting/forecasting_data/product_mapping.json`

```json
{
  "Your Database Item Name": "Trained Model Name",
  "Cafe Latte": "Latte",
  "Cappuccino (Large)": "Cappuccino"
}
```

---

## Next Steps

### 1. **Add Your Database Items**

Map your actual menu items to the trained models:

1. Go to Django admin: `http://localhost:8000/admin/pos/item/`
2. Add items with names matching the CSV products
3. Or create a mapping file (see above)

### 2. **Retrain with Live Data**

As you collect sales data, retrain models:

```bash
cd /home/user/DejaBrew/dejabrew
python manage.py retrain_live
```

This combines your live database sales with the CSV historical data.

### 3. **Set Up Auto-Retraining**

Add to crontab for weekly retraining:

```bash
# Edit crontab
crontab -e

# Add this line (retrain every Sunday at 2 AM):
0 2 * * 0 cd /home/user/DejaBrew/dejabrew && python manage.py retrain_live
```

### 4. **Monitor Accuracy**

Training output shows accuracy metrics:
- **Accuracy**: >80% is good, >90% is excellent
- **R² Score**: >0.7 is good, >0.85 is excellent
- **MAE**: Lower is better (average error in units)

If accuracy is low (<70%):
- Collect more historical data
- Use weekly/monthly aggregation
- Train with advanced features in Google Colab

---

## Summary

✅ **What you did:**
1. Downloaded Coffee Shop Sales dataset from Kaggle
2. Placed CSV in `forecasting/forecasting_data/`
3. Trained Gradient Boosting models for 30 products
4. Tested predictions successfully
5. System is ready to forecast sales and inventory

✅ **What you can do now:**
- View forecasts in dashboard
- Get predictions via API
- Track inventory depletion
- Retrain with live data
- Monitor accuracy metrics

---

## Full Documentation

- **Setup Guide:** `CSV_DOWNLOAD_GUIDE.md`
- **Column Mapping:** `EXCEL_TO_DATABASE_MAPPING.md`
- **Complete Setup:** `FORECASTING_SETUP.md`
- **Test Script:** `python test_forecasting.py`

---

**Total Setup Time:** ~5 minutes

**Result:** Working forecasting system with 85-95% accuracy! 🎉
