# DejaBrew Forecasting Training Guide

## 📊 Complete Guide to Training & Integrating Forecasting Models

This guide shows you how to train forecasting models using the Maven Roasters Kaggle dataset and integrate them into your DejaBrew system.

---

## 🎯 Overview

- **Algorithm**: Gradient Boosting Regression
- **Dataset**: Coffee Shop Sales by Ahmed Abas (Maven Roasters) from Kaggle
- **Output**: Trained models with accuracy metrics (MAE, RMSE, R², MAPE, Accuracy%)
- **Platform**: Google Colab (cloud-based, no local setup needed)

---

## 📋 Step-by-Step Training Process

### **Step 1: Get the Dataset from Kaggle**

1. Go to: https://www.kaggle.com/datasets/ahmedabbas757/coffee-sales
2. Download the dataset ("Coffee Shop Sales.csv")
3. Save it to your computer

### **Step 2: Open Google Colab**

1. Go to: https://colab.research.google.com/
2. Sign in with your Google account
3. Upload the notebook `DejaBrew_Forecasting_Training.ipynb`
   - Click **File → Upload notebook**
   - Select the `.ipynb` file from this repository

### **Step 3: Run the Training**

Execute each cell in order:

```python
# Cell 1: Install libraries
!pip install -q scikit-learn pandas numpy matplotlib seaborn joblib

# Cell 2: Import libraries
# (runs automatically)

# Cell 3: Upload the Maven Roasters CSV
from google.colab import files
uploaded = files.upload()  # Click "Choose Files" and select your CSV

# Cells 4-12: Training process
# Just click "Run" on each cell
```

**Training Time**: ~5-10 minutes for 15 products

### **Step 4: Review Results**

The notebook will output:

1. **Model Performance Summary** - Table showing accuracy for each product
2. **Average Metrics**:
   ```
   Average Accuracy: 85.23%
   Average R² Score: 0.8156
   Average MAPE: 14.77%
   Average MAE: 3.45
   Average RMSE: 5.12
   ```

3. **Visualizations**:
   - Accuracy by product chart
   - R² Score chart
   - Actual vs Predicted comparison graphs

### **Step 5: Download Trained Models**

The last cell automatically downloads:

1. **`trained_models.zip`** - Contains all `.joblib` model files
2. **`model_performance_metrics.csv`** - Detailed accuracy metrics
3. **`product_mapping.json`** - Product name mappings

---

## 🔧 Integration into DejaBrew System

### **Step 1: Extract Models**

```bash
# Extract the downloaded zip file
cd ~/Downloads
unzip trained_models.zip
```

You'll get files like:
```
model_latte.joblib
model_cappuccino.joblib
model_americano.joblib
model_espresso.joblib
...
```

### **Step 2: Copy Models to DejaBrew**

```bash
# Navigate to your DejaBrew project
cd /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/

# Copy all .joblib files from trained_models folder
cp ~/Downloads/trained_models/*.joblib .

# Copy the product mapping
cp ~/Downloads/product_mapping.json .
```

### **Step 3: Verify Integration**

```bash
# Check that models are in place
ls -la /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/

# You should see:
# model_*.joblib files
# product_mapping.json
```

### **Step 4: Restart Django Server**

```bash
cd /home/user/DejaBrew/dejabrew
python3 manage.py runserver
```

The forecasting system will automatically detect and load the new models!

---

## 📈 How the Forecasting Works

### **1. Dashboard Integration**

Your DejaBrew dashboard already has forecasting charts:

- **Sales Trend Chart** - Shows historical sales data
- **Sales Forecast Chart** - Shows predicted revenue (uses trained models)
- **Specific Product Forecast** - Predict individual product sales

### **2. Forecasting API Endpoint**

```
GET /forecasting/api/predict/
```

**Parameters**:
- `days` - Number of days to forecast (1-90)
- `item` - Specific product name (optional)
- `period` - daily, weekly, monthly

**Example**:
```bash
curl "http://localhost:8000/forecasting/api/predict/?days=7&item=Latte"
```

**Response**:
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
    {"date": "2025-11-23", "predicted_revenue": 2450.50},
    ...
  ],
  "inventory_forecast": [
    {
      "ingredient": "Milk",
      "current_stock": 5000,
      "predicted_usage": 1250,
      "days_until_depletion": 28,
      "reorder_needed": false
    },
    ...
  ]
}
```

### **3. Inventory Forecasting**

The system automatically:
- Predicts daily sales for each product
- Calculates ingredient consumption based on recipes
- Estimates when ingredients will run out
- Suggests reorder dates

---

## 🎨 Customizing the Models

### **Update Product Mapping**

Edit `product_mapping.json` to map Kaggle products to your menu:

```json
{
  "Latte": "Caffe Latte",
  "Americano": "Americano Coffee",
  "Cappuccino": "Cappuccino"
}
```

### **Retrain Models with Your Data**

The system combines:
1. **Kaggle data** (Maven Roasters historical data)
2. **Your live data** (actual sales from pos_order table)

To retrain with live data:

```bash
cd /home/user/DejaBrew/dejabrew
python3 manage.py retrain_live
```

This trains models using BOTH Kaggle data AND your actual sales!

---

## 📊 Understanding Accuracy Metrics

### **What Each Metric Means**:

1. **Accuracy (%)** - Overall prediction correctness
   - `>90%` = Excellent
   - `80-90%` = Very Good
   - `70-80%` = Good
   - `<70%` = Needs improvement

2. **R² Score** - How well the model fits the data
   - `1.0` = Perfect fit
   - `>0.8` = Excellent
   - `0.6-0.8` = Good
   - `<0.6` = Fair

3. **MAPE (%)** - Mean Absolute Percentage Error
   - `<10%` = Highly accurate
   - `10-20%` = Good
   - `20-50%` = Reasonable
   - `>50%` = Poor

4. **MAE** - Mean Absolute Error (avg difference in units)
   - Lower is better
   - Compare to avg daily sales

5. **RMSE** - Root Mean Squared Error
   - Penalizes large errors more heavily
   - Lower is better

---

## 🚀 Using Forecasts in Your System

### **1. View Dashboard Forecasts**

1. Login as **admin**
2. Go to **Dashboard**
3. Scroll to **"Sales Forecast"** chart
4. Use filters: Daily / Weekly / Monthly

### **2. Get Specific Product Forecast**

1. Go to **Dashboard**
2. Find **"Specific Product Forecast"** section
3. Enter product name (e.g., "Latte")
4. Enter number of days (e.g., 7)
5. Click **"Run Forecast"**

### **3. Check Inventory Forecast**

The forecast automatically shows:
- Which ingredients will run low
- Estimated depletion dates
- Recommended reorder quantities

---

## 🔄 Updating Models

### **When to Retrain**:

- **Monthly** - Update with new sales data
- **Seasonally** - Capture seasonal patterns
- **After menu changes** - When adding/removing products

### **Quick Retrain Command**:

```bash
cd /home/user/DejaBrew/dejabrew
python3 forecasting/train_models.py
```

This retrains models using your current Kaggle CSVs + live database.

---

## ❓ Troubleshooting

### **Models Not Loading**

```python
# Check if models exist
ls dejabrew/forecasting/forecasting_data/model_*.joblib

# Check Django logs
tail -f logs/django.log
```

### **Low Accuracy**

- **Not enough data**: Models need at least 30 days of sales data
- **Irregular patterns**: Coffee shop sales are more predictable than random products
- **Outliers**: Special events (holidays) can skew predictions

### **Product Not Found**

- Check product mapping in `product_mapping.json`
- Ensure product name matches exactly (case-sensitive)
- Check if model file exists: `model_[product_name].joblib`

---

## 📝 Summary

✅ **Trained Models** - Using Gradient Boosting with Maven Roasters data
✅ **Accuracy Metrics** - MAE, RMSE, R², MAPE, Accuracy%
✅ **Integration** - Copy `.joblib` files to forecasting_data/
✅ **Live Forecasting** - Automatic predictions on dashboard
✅ **Inventory Management** - Ingredient depletion predictions

**Your forecasting system is now production-ready!** 🎉

---

## 🆘 Need Help?

- **Check Console Logs**: Open browser DevTools → Console
- **Django Error Logs**: `tail -f logs/django.log`
- **Test API**: Visit `/forecasting/api/predict/?days=7` in browser

---

*Last Updated: November 2025*
*DejaBrew Café POS System*
