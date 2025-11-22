# 📊 DejaBrew Sales & Inventory Forecasting System

## Complete Guide to Training and Integration

This guide explains how to train your Gradient Boosting forecasting models using the Kaggle dataset and integrate them into your DejaBrew system.

---

## 🎯 Overview

Your DejaBrew system uses **Gradient Boosting Regression** to forecast:
- **Sales**: Predicted revenue per product
- **Inventory**: Ingredient depletion based on forecasted sales

### Current Implementation
- ✅ Gradient Boosting models trained per product
- ✅ Real-time API endpoint for predictions
- ✅ Dashboard integration with interactive charts
- ✅ Inventory depletion forecasts
- ✅ Support for daily, weekly, monthly aggregations

---

## 📦 Option 1: Train in Google Colab (Recommended for Best Accuracy)

### Why Google Colab?
- **Free GPU/TPU** for faster training
- **Pre-installed libraries** (scikit-learn, pandas, etc.)
- **Kaggle integration** for easy dataset access
- **Advanced features**: Lag features + rolling averages for higher accuracy

### Steps:

#### 1. **Upload the Notebook to Google Colab**

The file `DejaBrew_Forecasting_Training.ipynb` is already created in your project root.

1. Go to https://colab.research.google.com/
2. Click **File → Upload notebook**
3. Upload `DejaBrew_Forecasting_Training.ipynb`

#### 2. **Setup Kaggle API**

1. Go to https://www.kaggle.com/settings/account
2. Scroll to **API** section
3. Click **"Create New API Token"**
4. Download `kaggle.json`
5. In Colab, run the Kaggle setup cell and upload your `kaggle.json`

#### 3. **Run the Notebook**

Execute all cells in order:
- ✅ Install dependencies
- ✅ Download "Coffee Shop Sales by Ahmed Abas" dataset
- ✅ Load and explore data
- ✅ Preprocess data
- ✅ Train models with advanced features (lag + rolling averages)
- ✅ Evaluate accuracy (MAE, RMSE, MAPE, R²)
- ✅ Download trained models

**Expected Output:**
```
Total models trained: 30
Average Test Accuracy: 85-95%
Average Test R²: 0.75-0.90
Average Test MAE: 2-5 units
```

#### 4. **Download and Integrate Models**

After training completes:

1. Download `dejabrew_trained_models.zip`
2. Extract the ZIP file
3. Copy all `.joblib` files to: `dejabrew/forecasting/forecasting_data/`
4. Copy `trained_articles.json` to: `dejabrew/forecasting/forecasting_data/`

#### 5. **Restart Django Server**

```bash
cd dejabrew
python manage.py runserver
```

✅ Your forecasting system now uses the newly trained models!

---

## 🖥️ Option 2: Train Locally (Quick Setup)

If you already have Kaggle CSV data files locally, you can train models directly on your machine.

### Requirements:
- Python 3.8+
- scikit-learn, pandas, numpy, joblib

### Steps:

#### 1. **Place Your Dataset Files**

Put your CSV files in `dejabrew/forecasting/forecasting_data/`:

- `bakery_sales.csv` - Format: `date`, `article`, `quantity`
- `Coffe_sales.csv` - Format: `Date`, `coffee_name` (quantity assumed as 1)

**Note:** For the "Coffee Shop Sales by Ahmed Abas" dataset:
- Download from Kaggle: https://www.kaggle.com/datasets/ahmedabbas757/coffee-sales
- Convert Excel to CSV if needed
- Ensure column names match: `transaction_date`, `product_detail`, `transaction_qty`

#### 2. **Run Training Script**

```bash
cd dejabrew
python forecasting/train_models.py
```

#### 3. **View Results**

The script will:
- ✅ Load data from CSVs
- ✅ Train models for top 10 bakery + top 20 coffee products
- ✅ Show accuracy metrics (MAE, RMSE, R², Accuracy %)
- ✅ Save models as `.joblib` files
- ✅ Create `trained_articles.json`

**Sample Output:**
```
Training models for 23 products:
['Latte', 'Cappuccino', 'Espresso', ...]

[1/23] Training: Latte
  ✓ Saved model for Latte -> model_latte.joblib
  Train: MAE=1.23, R²=0.8456
  Test:  MAE=1.45, RMSE=2.12, R²=0.8234, Accuracy=89.45%

...

Training complete! Successfully trained 23 models.
```

#### 4. **Restart Django Server**

```bash
python manage.py runserver
```

✅ Your models are now active!

---

## 🔧 Option 3: Retrain with Live Database Data

Your system can retrain models using **live sales data from your database** combined with historical Kaggle data.

### Command:

```bash
cd dejabrew
python manage.py retrain_live
```

### What it does:
- Loads all `paid` orders from your database
- Combines with historical Kaggle CSV data
- Trains models for top-selling products
- Updates model files automatically
- Cleans up old, unused models

**Best for:** Regular model updates with fresh sales data

---

## 📊 Using the Forecasting System

### 1. **Dashboard View**

Visit: `http://localhost:8000/` (your dashboard)

You'll see:
- **Aggregated Sales Forecast Chart**: Combined revenue forecast across all products
- **Per-Product Forecast Table**: Detailed predictions for each item
- **Inventory Forecast**: Days-to-empty for ingredients
- **Period Filters**: Daily, Weekly, Monthly views

### 2. **API Endpoint**

**URL:** `/forecasting/api/predict/`

**Parameters:**
- `days` (default: 7): Number of days to forecast (1-90)
- `item` (optional): Specific product name
- `period` (default: daily): Aggregation period (daily, weekly, monthly)
- `end_date` (default: today): Reference date (YYYY-MM-DD)

**Examples:**

```bash
# Get 7-day forecast for all products
curl http://localhost:8000/forecasting/api/predict/?days=7

# Get 30-day forecast for Latte
curl http://localhost:8000/forecasting/api/predict/?days=30&item=Latte

# Get weekly forecast
curl http://localhost:8000/forecasting/api/predict/?days=28&period=weekly
```

**Response Format:**

```json
{
  "success": true,
  "predictions": [
    {
      "item": "Latte",
      "predictions": [
        {"date": "2025-11-23", "predicted_quantity": 45},
        {"date": "2025-11-24", "predicted_quantity": 52},
        ...
      ]
    }
  ],
  "aggregated_forecast": [
    {"date": "2025-11-23", "predicted_revenue": 1250.50},
    ...
  ],
  "combined_historical": [
    {"label": "Mon", "sales": 1100.25},
    ...
  ],
  "inventory_forecast": [
    {
      "name": "Coffee Beans",
      "unit": "kg",
      "forecast": [10.5, 9.2, 7.8, ...],
      "days_to_empty": 12
    },
    ...
  ]
}
```

---

## 🎯 Model Accuracy & Performance

### Metrics Explained:

1. **Accuracy (%)**: `100% - MAPE`
   - Higher is better (>80% is good, >90% is excellent)
   - Represents how close predictions are to actual values

2. **R² Score**: Coefficient of determination
   - Range: 0 to 1 (1 is perfect)
   - >0.7 is good, >0.85 is excellent

3. **MAE (Mean Absolute Error)**: Average error in units
   - Lower is better
   - Represents average difference between predicted and actual sales

4. **RMSE (Root Mean Squared Error)**: Standard deviation of errors
   - Lower is better
   - Penalizes larger errors more than MAE

### Typical Performance:
- **Accuracy**: 85-95%
- **R² Score**: 0.75-0.90
- **MAE**: 2-5 units

---

## 🔍 Troubleshooting

### Issue: "No model found for that item"

**Cause:** Item name in database doesn't match trained article names

**Solutions:**
1. Check `trained_articles.json` for exact product names
2. Add mapping in `forecasting_data/product_mapping.json`:

```json
{
  "Your Database Item Name": "Trained Article Name",
  "Cafe Latte": "Latte",
  "Croissant (Plain)": "CROISSANT"
}
```

3. Retrain models to include your database items

### Issue: Low accuracy (<70%)

**Causes & Solutions:**
- **Insufficient data**: Need at least 60+ days of sales history
- **Irregular sales patterns**: Some products may be seasonal or sporadic
- **Data quality**: Check for outliers, missing values, or data entry errors

**Fixes:**
- Collect more historical data
- Consider using weekly/monthly aggregation
- Train with advanced features in Colab (lag + rolling averages)

### Issue: Models not loading

**Check:**
1. Files exist: `ls dejabrew/forecasting/forecasting_data/*.joblib`
2. Permissions: `chmod 644 forecasting_data/*.joblib`
3. Django cache: `python manage.py clear_cache` or restart server

---

## 📁 File Structure

```
dejabrew/
├── forecasting/
│   ├── forecasting_data/          # Data and models directory
│   │   ├── model_*.joblib          # Trained models (one per product)
│   │   ├── trained_articles.json   # List of trained products
│   │   ├── product_mapping.json    # Custom name mappings
│   │   ├── bakery_sales.csv        # Historical bakery data
│   │   ├── Coffe_sales.csv         # Historical coffee data
│   │   ├── generated_sales.csv     # Generated sales data
│   │   └── generated_sales_sep_nov.csv
│   ├── forecasting_service.py      # Core forecasting logic
│   ├── train_models.py             # Local training script
│   ├── views.py                    # API endpoints
│   ├── models.py                   # Django models
│   └── management/
│       └── commands/
│           └── retrain_live.py     # Live retraining command
├── pos/
│   ├── models.py                   # Item, Order, Ingredient models
│   └── templates/
│       └── dashboard.html          # Dashboard with forecast charts
└── DejaBrew_Forecasting_Training.ipynb  # Google Colab notebook
```

---

## 🚀 Advanced: Improving Accuracy

### 1. **Use Advanced Features (Colab)**

The Colab notebook trains with:
- **Lag features**: Sales from 1, 2, 3, 7, 14 days ago
- **Rolling averages**: 7-day and 14-day moving averages

This typically improves accuracy by 5-15%.

### 2. **Hyperparameter Tuning**

Edit `train_models.py` or Colab notebook:

```python
model = GradientBoostingRegressor(
    n_estimators=300,        # More trees (200-500)
    learning_rate=0.03,      # Lower = more accurate but slower (0.01-0.1)
    max_depth=7,             # Tree depth (3-10)
    min_samples_split=20,    # Min samples to split (10-50)
    min_samples_leaf=5,      # Min samples per leaf (1-10)
    random_state=42
)
```

### 3. **Regular Retraining**

Set up a cron job to retrain weekly:

```bash
0 2 * * 0 cd /path/to/dejabrew && python manage.py retrain_live
```

---

## 📚 Next Steps

1. ✅ **Train your models** using Google Colab or locally
2. ✅ **Integrate models** into your Django system
3. ✅ **Test predictions** via API or dashboard
4. ✅ **Monitor accuracy** and retrain as needed
5. ✅ **Set up automated retraining** for fresh data

---

## 🆘 Support

For issues or questions:
1. Check this README
2. Review Colab notebook comments
3. Check Django logs: `tail -f dejabrew/debug.log`
4. Contact your development team

---

**Last Updated:** 2025-11-22
**Version:** 1.0.0
**System:** DejaBrew POS & Inventory Management
