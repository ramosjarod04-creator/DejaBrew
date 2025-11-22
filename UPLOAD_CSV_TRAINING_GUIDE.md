# 📤 Upload CSV Training Guide

## For Users Who Already Have coffee_shop_sales.csv

If you've already downloaded the **Coffee Shop Sales** dataset from Kaggle to your computer, use this simplified workflow!

---

## 🎯 Two Notebooks Available

| Notebook | Use When... |
|----------|-------------|
| **DejaBrew_Upload_CSV_Training.ipynb** | ✅ You already have the CSV file downloaded locally |
| **DejaBrew_Forecasting_Training.ipynb** | You want to download from Kaggle inside Colab |

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Upload Notebook to Google Colab

1. **Go to Google Colab:**
   ```
   https://colab.research.google.com/
   ```

2. **Click: File → Upload notebook**

3. **Select:** `DejaBrew_Upload_CSV_Training.ipynb`

### Step 2: Run the Notebook

Click **Runtime → Run all** or run each cell individually:

#### Cell 1: Install Dependencies
```python
!pip install scikit-learn pandas numpy joblib matplotlib seaborn -q
```

#### Cell 2: Upload Your CSV
- Click **"Choose Files"** button
- Select your `coffee_shop_sales.csv` file from your computer
- Wait for upload to complete

#### Cell 3: Validate Data
- Checks if CSV has correct columns
- Shows data summary

#### Cell 4: Preprocess
- Cleans and prepares data
- Shows top 10 products

#### Cell 5: Train Models
- Trains Gradient Boosting models for top 30 products
- Shows accuracy for each model

#### Cell 6: View Summary
- Displays overall accuracy metrics
- Shows distribution charts

#### Cell 7: Save Product List
- Creates `trained_articles.json`

#### Cell 8: Download Models
- Creates `dejabrew_trained_models.zip`
- Downloads to your computer automatically

---

## 📊 What You'll See

### During Upload (Cell 2):
```
📤 Please upload your coffee_shop_sales.csv file:
   (Click 'Choose Files' below)

✅ Uploaded: ['coffee_shop_sales.csv']
✓ Found CSV file: coffee_shop_sales.csv
  File size: 12,345,678 bytes

✅ Ready to proceed!
```

### During Training (Cell 5):
```
================================================================================
  TRAINING GRADIENT BOOSTING MODELS
================================================================================

Training models for top 30 products...

[1/30] ✓ Brewed Chai tea
       Accuracy: 87.34% | R²: 0.7956 | MAE: 2.89

[2/30] ✓ Gourmet brewed coffee
       Accuracy: 89.12% | R²: 0.8234 | MAE: 2.45

...

================================================================================
✓ Training complete! Successfully trained 30 models.
================================================================================
```

### Summary (Cell 6):
```
================================================================================
MODEL PERFORMANCE SUMMARY
================================================================================

Total models trained: 30
Average Accuracy: 86.74%
Average R² Score: 0.7889
Average MAE: 2.67
Average RMSE: 4.23
```

### Download (Cell 8):
```
✓ Created dejabrew_trained_models.zip

📥 Downloading...

🎉 SUCCESS! Training complete!

Model Performance:
  Average Accuracy: 86.74%
  Average R² Score: 0.7889
  Total Models: 30
```

---

## 📋 After Training

### What You Downloaded:

The `dejabrew_trained_models.zip` contains:

```
dejabrew_trained_models.zip
├── model_brewed_chai_tea.joblib
├── model_gourmet_brewed_coffee.joblib
├── model_barista_espresso.joblib
├── ... (27 more model files)
├── trained_articles.json
└── model_metrics.json
```

### Integration Steps:

1. **Extract the ZIP file:**
   ```bash
   unzip dejabrew_trained_models.zip -d trained_models
   ```

2. **Copy to your DejaBrew system:**
   ```bash
   cp trained_models/*.joblib /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
   cp trained_models/trained_articles.json /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
   ```

3. **Test the system:**
   ```bash
   cd /home/user/DejaBrew
   python test_forecasting.py
   ```

4. **Start Django server:**
   ```bash
   cd /home/user/DejaBrew/dejabrew
   python manage.py runserver
   ```

5. **View forecasts:**
   - Dashboard: `http://localhost:8000/`
   - API: `http://localhost:8000/forecasting/api/predict/?days=7`

---

## 🔧 Troubleshooting

### Problem: "Missing required columns"

**Cause:** Your CSV has different column names

**Solution:** Update Cell 4 column mapping:

```python
column_mapping = {
    'your_date_column': 'date',
    'your_product_column': 'product',
    'your_quantity_column': 'quantity'
}
```

### Problem: Upload fails

**Cause:** File too large or connection issue

**Solutions:**
- Check file size (should be <100 MB)
- Try a different browser
- Use faster internet connection
- Compress CSV if very large

### Problem: "Not enough data"

**Cause:** Product has less than 30 days of sales

**Solution:** This is normal. The system skips products with insufficient data.

### Problem: Low accuracy (<70%)

**Possible causes:**
- Product has irregular sales patterns
- Not enough historical data
- Seasonal products

**Solutions:**
- Use weekly/monthly aggregation
- Collect more data
- Train separate models for different seasons

---

## 📊 Column Requirements

Your `coffee_shop_sales.csv` must have:

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Date column | Date | Transaction date | 2023-01-01 |
| Product column | String | Product name | "Latte" |
| Quantity column | Integer | Units sold | 2 |

**Common column names:**
- Date: `transaction_date`, `Date`, `date`, `sale_date`
- Product: `product_detail`, `Product`, `product`, `item_name`
- Quantity: `transaction_qty`, `Quantity`, `quantity`, `qty`

---

## ⏱️ Training Time

| Products | Estimated Time |
|----------|----------------|
| 10 products | ~1 minute |
| 30 products | ~2-3 minutes |
| 50 products | ~4-5 minutes |

Depends on:
- Amount of historical data
- Number of transactions
- Colab server speed

---

## ✅ Success Checklist

Before closing Colab:
- [x] All cells ran without errors
- [x] Training completed successfully
- [x] `dejabrew_trained_models.zip` downloaded
- [x] Average accuracy >80%
- [x] Saw distribution charts

After integration:
- [x] Models copied to `forecasting_data/`
- [x] `test_forecasting.py` passes
- [x] Dashboard shows forecasts
- [x] API returns predictions

---

## 🎓 Tips

**For better accuracy:**
- Use at least 6 months of data
- Ensure data quality (no missing dates, duplicates)
- Include seasonal patterns
- Retrain monthly with fresh data

**For faster training:**
- Reduce `TOP_N` from 30 to 10-15 in Cell 5
- Remove visualization cells (6)
- Use Colab Pro for faster GPUs

**For production:**
- Save model files safely
- Backup before replacing old models
- Test predictions before deployment
- Monitor accuracy over time

---

## 📚 Related Guides

- **QUICK_START_FORECASTING.md** - Complete setup guide
- **CSV_DOWNLOAD_GUIDE.md** - Download from Kaggle
- **EXCEL_TO_DATABASE_MAPPING.md** - Database integration
- **FORECASTING_SETUP.md** - Detailed documentation

---

**Estimated Total Time:** 5-10 minutes from upload to download! 🚀
