#!/usr/bin/env python
"""
DejaBrew Complete Forecasting Training System
==============================================

This script trains forecasting models for:
1. AGGREGATED SALES - Total revenue predictions
2. INVENTORY DEPLETION - Days until ingredients run out

Uses: Coffee Shop Sales dataset (Ahmed Abas)
Model: Gradient Boosting Regression
Output: Accuracy metrics + trained models
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import json
from datetime import datetime, timedelta

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'forecasting_data')
os.makedirs(DATA_DIR, exist_ok=True)

# File paths - try multiple common names
CSV_NAMES = [
    'Coffee Shop Sales.csv',  # Original Kaggle name
    'coffee_shop_sales.csv',   # Lowercase with underscores
    'coffee_shop_sales.xlsx',  # Excel format
    'Coffee Shop Sales.xlsx'   # Original Excel name
]

COFFEE_SHOP_CSV = None
for csv_name in CSV_NAMES:
    csv_path = os.path.join(DATA_DIR, csv_name)
    if os.path.exists(csv_path):
        COFFEE_SHOP_CSV = csv_path
        break

MODELS_DIR = DATA_DIR
AGGREGATED_MODEL = os.path.join(MODELS_DIR, 'model_aggregated_sales.joblib')
PRODUCT_MODEL_PREFIX = 'model_'


def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")


def load_coffee_shop_data():
    """
    Load Coffee Shop Sales dataset (Ahmed Abas)

    Expected columns:
    - transaction_date: Date of sale
    - product_detail: Product name
    - transaction_qty: Quantity sold
    - unit_price: Price per unit (for revenue calculation)
    """
    print_header("LOADING COFFEE SHOP SALES DATA")

    if COFFEE_SHOP_CSV is None:
        print(f"❌ ERROR: Coffee Shop Sales CSV not found!")
        print(f"\nSearched for these files in {DATA_DIR}:")
        for name in CSV_NAMES:
            print(f"  - {name}")
        print(f"\nYour options:")
        print(f"1. Move your CSV to: {DATA_DIR}/")
        print(f"   Accepted names: 'Coffee Shop Sales.csv' or 'coffee_shop_sales.csv'")
        print(f"2. Or rename it:")
        print(f"   mv '{DATA_DIR}/Your File.csv' '{DATA_DIR}/Coffee Shop Sales.csv'")
        print(f"\nThen run this script again")
        sys.exit(1)

    try:
        csv_filename = os.path.basename(COFFEE_SHOP_CSV)
        print(f"Loading: {csv_filename}")

        # Read CSV or Excel
        if COFFEE_SHOP_CSV.endswith('.csv'):
            df = pd.read_csv(COFFEE_SHOP_CSV)
        elif COFFEE_SHOP_CSV.endswith(('.xlsx', '.xls')):
            print(f"Detected Excel file, converting to CSV format...")
            df = pd.read_excel(COFFEE_SHOP_CSV)
        else:
            raise ValueError(f"Unsupported file format: {COFFEE_SHOP_CSV}")

        print(f"✓ CSV loaded: {len(df):,} rows")
        print(f"\nColumns found: {df.columns.tolist()}")

        # Check required columns
        required = ['transaction_date', 'product_detail', 'transaction_qty']
        missing = [col for col in required if col not in df.columns]

        if missing:
            print(f"\n❌ ERROR: Missing required columns: {missing}")
            print(f"\nYour CSV must have:")
            print(f"  - transaction_date (date of sale)")
            print(f"  - product_detail (product name)")
            print(f"  - transaction_qty (quantity sold)")
            print(f"  - unit_price (price per unit) [optional]")
            sys.exit(1)

        # Preprocess
        df = df.rename(columns={
            'transaction_date': 'date',
            'product_detail': 'product',
            'transaction_qty': 'quantity'
        })

        df['date'] = pd.to_datetime(df['date'])
        df = df[df['quantity'] > 0]  # Remove invalid quantities
        df['product'] = df['product'].str.strip()

        # Add unit_price if exists, otherwise set default
        if 'unit_price' in df.columns:
            df['revenue'] = df['quantity'] * df['unit_price']
        else:
            print("\n⚠️  Warning: 'unit_price' column not found. Using quantity as proxy for revenue.")
            df['revenue'] = df['quantity']

        print(f"\n✓ Data preprocessed successfully!")
        print(f"  Total transactions: {len(df):,}")
        print(f"  Date range: {df['date'].min().date()} to {df['date'].max().date()}")
        print(f"  Days of data: {(df['date'].max() - df['date'].min()).days}")
        print(f"  Unique products: {df['product'].nunique()}")
        print(f"  Total revenue: ${df['revenue'].sum():,.2f}")

        return df

    except Exception as e:
        print(f"\n❌ ERROR loading CSV: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def create_date_features(df_index):
    """Create time-based features from datetime index"""
    features = pd.DataFrame(index=df_index)
    features['day_of_week'] = features.index.dayofweek
    features['month'] = features.index.month
    features['day_of_year'] = features.index.dayofyear
    features['year'] = features.index.year
    features['week_of_year'] = features.index.isocalendar().week
    return features


def train_aggregated_sales_model(df):
    """
    Train a single model for TOTAL AGGREGATED SALES (revenue)
    This predicts the total daily revenue across all products
    """
    print_header("TRAINING AGGREGATED SALES MODEL")

    # Aggregate daily total revenue
    daily_revenue = df.groupby('date')['revenue'].sum().sort_index()

    print(f"Daily revenue data:")
    print(f"  Total days: {len(daily_revenue)}")
    print(f"  Average daily revenue: ${daily_revenue.mean():,.2f}")
    print(f"  Max daily revenue: ${daily_revenue.max():,.2f}")
    print(f"  Min daily revenue: ${daily_revenue.min():,.2f}")

    # Create features
    X = create_date_features(daily_revenue.index)
    y = daily_revenue.values

    # Train/test split (80/20 chronological)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print(f"\nTraining split:")
    print(f"  Training samples: {len(X_train)}")
    print(f"  Test samples: {len(X_test)}")

    # Train Gradient Boosting model
    print(f"\nTraining Gradient Boosting Regressor...")
    model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=5,
        min_samples_split=10,
        min_samples_leaf=4,
        random_state=42,
        verbose=0
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # Calculate metrics
    train_mae = mean_absolute_error(y_train, y_pred_train)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
    train_r2 = r2_score(y_train, y_pred_train)
    train_mape = np.mean(np.abs((y_train - y_pred_train) / (y_train + 1))) * 100
    train_accuracy = max(0, 100 - train_mape)

    test_mae = mean_absolute_error(y_test, y_pred_test)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
    test_r2 = r2_score(y_test, y_pred_test)
    test_mape = np.mean(np.abs((y_test - y_pred_test) / (y_test + 1))) * 100
    test_accuracy = max(0, 100 - test_mape)

    print(f"\n{'Metric':<20} {'Training':<15} {'Test':<15}")
    print("-" * 50)
    print(f"{'MAE':<20} ${train_mae:<14,.2f} ${test_mae:<14,.2f}")
    print(f"{'RMSE':<20} ${train_rmse:<14,.2f} ${test_rmse:<14,.2f}")
    print(f"{'R² Score':<20} {train_r2:<14.4f} {test_r2:<14.4f}")
    print(f"{'MAPE':<20} {train_mape:<14.2f}% {test_mape:<14.2f}%")
    print(f"{'Accuracy':<20} {train_accuracy:<14.2f}% {test_accuracy:<14.2f}%")

    # Save model
    joblib.dump(model, AGGREGATED_MODEL)
    print(f"\n✓ Model saved: {AGGREGATED_MODEL}")

    metrics = {
        'model_type': 'aggregated_sales',
        'train_metrics': {
            'mae': round(train_mae, 2),
            'rmse': round(train_rmse, 2),
            'r2': round(train_r2, 4),
            'mape': round(train_mape, 2),
            'accuracy': round(train_accuracy, 2)
        },
        'test_metrics': {
            'mae': round(test_mae, 2),
            'rmse': round(test_rmse, 2),
            'r2': round(test_r2, 4),
            'mape': round(test_mape, 2),
            'accuracy': round(test_accuracy, 2)
        },
        'data_points': len(daily_revenue),
        'train_size': len(X_train),
        'test_size': len(X_test),
        'date_range': {
            'start': str(daily_revenue.index.min().date()),
            'end': str(daily_revenue.index.max().date())
        }
    }

    return metrics


def train_per_product_models(df, top_n=30):
    """
    Train individual models for top N products
    Used for inventory forecasting (ingredient depletion)
    """
    print_header(f"TRAINING PER-PRODUCT MODELS (Top {top_n})")

    # Aggregate daily sales per product
    daily_products = df.groupby(['date', 'product'])['quantity'].sum().reset_index()
    daily_pivot = daily_products.pivot_table(
        index='date',
        columns='product',
        values='quantity',
        aggfunc='sum'
    ).fillna(0)

    # Get top N products by total sales
    product_sales = daily_pivot.sum().sort_values(ascending=False)
    top_products = product_sales.head(top_n).index.tolist()

    print(f"Top {len(top_products)} products by sales volume:")
    for i, product in enumerate(top_products[:10], 1):
        print(f"  {i}. {product}: {int(product_sales[product]):,} units")
    if len(top_products) > 10:
        print(f"  ... and {len(top_products) - 10} more")

    # Create features once for all products
    X = create_date_features(daily_pivot.index)

    trained_models = []
    product_metrics = []

    print(f"\nTraining models...")
    for i, product in enumerate(top_products, 1):
        if product not in daily_pivot.columns:
            continue

        y = daily_pivot[product].values

        # Check sufficient data
        if len(X) < 30:
            print(f"[{i}/{len(top_products)}] ⊘ {product} - Insufficient data")
            continue

        # Split
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        try:
            # Train
            model = GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=5,
                min_samples_split=10,
                min_samples_leaf=4,
                random_state=42,
                verbose=0
            )
            model.fit(X_train, y_train)

            # Evaluate
            y_pred_test = model.predict(X_test)
            test_mae = mean_absolute_error(y_test, y_pred_test)
            test_r2 = r2_score(y_test, y_pred_test)
            test_mape = np.mean(np.abs((y_test - y_pred_test) / (y_test + 1))) * 100
            test_accuracy = max(0, 100 - test_mape)

            # Save
            safe_name = product.lower().replace(' ', '_').replace('/', '_').replace('&', 'and')
            model_file = f"{PRODUCT_MODEL_PREFIX}{safe_name}.joblib"
            joblib.dump(model, os.path.join(MODELS_DIR, model_file))

            trained_models.append(product)
            product_metrics.append({
                'product': product,
                'accuracy': round(test_accuracy, 2),
                'r2': round(test_r2, 4),
                'mae': round(test_mae, 2)
            })

            print(f"[{i}/{len(top_products)}] ✓ {product:<35} Acc: {test_accuracy:>6.2f}% | R²: {test_r2:>6.4f}")

        except Exception as e:
            print(f"[{i}/{len(top_products)}] ✗ {product} - Error: {e}")

    print(f"\n✓ Successfully trained {len(trained_models)} product models")

    # Save trained products list
    products_file = os.path.join(MODELS_DIR, 'trained_articles.json')
    with open(products_file, 'w') as f:
        json.dump(trained_models, f, indent=2)
    print(f"✓ Product list saved: {products_file}")

    return product_metrics, trained_models


def save_training_summary(aggregated_metrics, product_metrics, trained_products):
    """Save comprehensive training summary"""
    summary = {
        'training_date': datetime.now().isoformat(),
        'aggregated_sales_model': aggregated_metrics,
        'product_models': {
            'total_trained': len(trained_products),
            'products': trained_products,
            'average_accuracy': round(np.mean([m['accuracy'] for m in product_metrics]), 2) if product_metrics else 0,
            'average_r2': round(np.mean([m['r2'] for m in product_metrics]), 4) if product_metrics else 0,
            'metrics_by_product': product_metrics
        }
    }

    summary_file = os.path.join(MODELS_DIR, 'training_summary.json')
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\n✓ Training summary saved: {summary_file}")
    return summary


def cleanup_old_models(keep_products):
    """Remove old/unused model files"""
    print_header("CLEANING UP OLD MODELS")

    # Files to keep
    keep_files = {'training_summary.json', 'trained_articles.json', 'product_mapping.json', 'coffee_shop_sales.csv'}
    keep_files.add('model_aggregated_sales.joblib')

    for product in keep_products:
        safe_name = product.lower().replace(' ', '_').replace('/', '_').replace('&', 'and')
        keep_files.add(f"{PRODUCT_MODEL_PREFIX}{safe_name}.joblib")

    # Delete old files
    deleted = 0
    try:
        for filename in os.listdir(MODELS_DIR):
            if filename.endswith('.joblib') and filename not in keep_files:
                os.remove(os.path.join(MODELS_DIR, filename))
                print(f"  Deleted: {filename}")
                deleted += 1
    except Exception as e:
        print(f"Error during cleanup: {e}")

    print(f"\n✓ Cleanup complete. Removed {deleted} old model(s)")


def main():
    """Main training pipeline"""
    print("\n" + "=" * 80)
    print("  DEJABREW FORECASTING TRAINING SYSTEM")
    print("  " + "=" * 78)
    print("  Dataset: Coffee Shop Sales (Ahmed Abas)")
    print("  Model: Gradient Boosting Regression")
    print("  Outputs: Aggregated Sales + Per-Product Models")
    print("=" * 80)

    # Load data
    df = load_coffee_shop_data()

    # Train aggregated sales model
    agg_metrics = train_aggregated_sales_model(df)

    # Train per-product models
    prod_metrics, trained_prods = train_per_product_models(df, top_n=30)

    # Save summary
    summary = save_training_summary(agg_metrics, prod_metrics, trained_prods)

    # Cleanup old models
    cleanup_old_models(trained_prods)

    # Final summary
    print_header("TRAINING COMPLETE!")

    print("AGGREGATED SALES MODEL:")
    print(f"  Test Accuracy: {agg_metrics['test_metrics']['accuracy']:.2f}%")
    print(f"  Test R² Score: {agg_metrics['test_metrics']['r2']:.4f}")
    print(f"  Test MAE: ${agg_metrics['test_metrics']['mae']:,.2f}")

    print(f"\nPER-PRODUCT MODELS:")
    print(f"  Total trained: {len(trained_prods)}")
    if prod_metrics:
        print(f"  Average accuracy: {np.mean([m['accuracy'] for m in prod_metrics]):.2f}%")
        print(f"  Average R² score: {np.mean([m['r2'] for m in prod_metrics]):.4f}")

    print(f"\nMODELS SAVED TO: {MODELS_DIR}/")
    print(f"  - model_aggregated_sales.joblib (for dashboard)")
    print(f"  - model_*.joblib ({len(trained_prods)} product models for inventory)")
    print(f"  - trained_articles.json")
    print(f"  - training_summary.json")

    print("\n" + "=" * 80)
    print("✅ SUCCESS! Your forecasting models are ready to use!")
    print("=" * 80)
    print("\nNext steps:")
    print("  1. Models are already in the correct location")
    print("  2. Restart your Django server")
    print("  3. Check dashboard for aggregated sales forecast")
    print("  4. Check inventory page for depletion predictions")
    print("\n" + "=" * 80 + "\n")


if __name__ == '__main__':
    main()
