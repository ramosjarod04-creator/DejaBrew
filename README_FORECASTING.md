# 🚀 DejaBrew Forecasting - Quick Start

## What You Get

✅ **Aggregated Sales Forecasting** - Predict total daily revenue
✅ **Inventory Depletion Forecasting** - Know when ingredients will run out
✅ **Accuracy Metrics** - MAE, RMSE, R², Accuracy %
✅ **Dashboard Integration** - See forecasts in your dashboard
✅ **Automatic Cleanup** - Old models removed automatically

---

## 3-Step Setup

### Step 1: Place Your CSV

```bash
mv ~/Downloads/coffee_shop_sales.csv \
   /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
```

### Step 2: Run Setup Script

```bash
cd /home/user/DejaBrew
./cleanup_and_setup.sh
```

### Step 3: Train Models

```bash
cd /home/user/DejaBrew/dejabrew
python forecasting/train_forecasting.py
```

**That's it!** Models are trained and ready to use.

---

## What Happens During Training

```
1. Loads coffee_shop_sales.csv ✓
2. Trains aggregated sales model (for dashboard) ✓
3. Trains per-product models (for inventory) ✓
4. Evaluates accuracy ✓
5. Saves models ✓
6. Cleans up old files ✓
```

**Expected time:** 2-3 minutes

---

## After Training

### Restart Django

```bash
cd /home/user/DejaBrew/dejabrew
python manage.py runserver
```

### View Forecasts

- **Dashboard:** http://localhost:8000/
  - Scroll to "Sales Forecast (Aggregated)"
  - See historical + predicted revenue
  - Toggle Daily/Weekly/Monthly views

- **Inventory:** http://localhost:8000/inventory/
  - See "Days to Empty" for each ingredient
  - Based on predicted sales

---

## Expected Accuracy

- **Aggregated Sales:** 90-95% accuracy
- **Per-Product:** 85-90% accuracy
- **R² Score:** 0.80-0.90

---

## Files Created

After training, you'll have:

```
forecasting_data/
├── coffee_shop_sales.csv (your data)
├── model_aggregated_sales.joblib (dashboard model)
├── model_*.joblib (30 product models)
├── trained_articles.json (product list)
└── training_summary.json (accuracy metrics)
```

---

## Troubleshooting

**CSV not found?**
```bash
# Check location
ls ~/Downloads/coffee_shop_sales.csv

# Move it
mv ~/Downloads/coffee_shop_sales.csv \
   /home/user/DejaBrew/dejabrew/forecasting/forecasting_data/
```

**Low accuracy?**
- Need 60+ days of data
- Check for data quality issues
- Retrain weekly for best results

**Dashboard not showing forecast?**
```bash
# Restart Django
python manage.py runserver

# Clear browser cache
Ctrl + Shift + R
```

---

## Complete Documentation

📚 **[COMPLETE_FORECASTING_GUIDE.md](COMPLETE_FORECASTING_GUIDE.md)** - Full setup guide

---

## Retraining

Run anytime to update your models:

```bash
cd /home/user/DejaBrew/dejabrew
python forecasting/train_forecasting.py
```

Recommended: Weekly retraining for best accuracy

---

## What's New vs Old System

| Old System | New System |
|------------|------------|
| ❌ Per-product only | ✅ Aggregated + Per-product |
| ❌ No accuracy metrics | ✅ Full metrics (MAE, RMSE, R², Accuracy) |
| ❌ Manual cleanup needed | ✅ Automatic cleanup |
| ❌ Complex setup | ✅ 3-step setup |
| ❌ Multiple CSV files | ✅ Single CSV file |

---

## Success Checklist

- [ ] CSV in forecasting_data/
- [ ] Training completed (accuracy >85%)
- [ ] Models saved (check .joblib files)
- [ ] Django restarted
- [ ] Dashboard shows forecast
- [ ] Inventory shows depletion

---

**That's it! Your forecasting system is ready!** 🎉

Need help? Check [COMPLETE_FORECASTING_GUIDE.md](COMPLETE_FORECASTING_GUIDE.md)
