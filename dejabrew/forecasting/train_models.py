# forecasting/train_models.py
"""
Train per-product models using Coffee Shop Sales dataset (Ahmed Abas).
- Reads: forecasting/forecasting_data/coffee_shop_sales.csv
- Trains models for top-selling products
- Evaluates with MAE, RMSE, R², and Accuracy metrics
- Includes cleanup step to remove old/unused models
"""
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import json

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'forecasting_data')
os.makedirs(DATA_DIR, exist_ok=True)

# Ahmed Abas Coffee Shop Sales dataset
COFFEE_SHOP_SALES_CSV = os.path.join(DATA_DIR, 'coffee_shop_sales.csv')
# Fallback legacy data
GENERATED_CSV = os.path.join(DATA_DIR, 'generated_sales.csv')

MODEL_PREFIX = 'model_'
MODEL_DIR = DATA_DIR

def load_data():
    """
    Loads Coffee Shop Sales dataset (Ahmed Abas).

    Expected CSV columns:
    - transaction_date: Date of sale
    - product_detail: Product name
    - transaction_qty: Quantity sold

    Returns:
    1. A DataFrame with columns: date, article, quantity
    2. A list of unique product names
    """
    all_dfs = []
    all_articles = []

    # 1. Load Coffee Shop Sales (Ahmed Abas dataset)
    if os.path.exists(COFFEE_SHOP_SALES_CSV):
        try:
            print(f"Loading Coffee Shop Sales from: {COFFEE_SHOP_SALES_CSV}")
            df_coffee_shop = pd.read_csv(COFFEE_SHOP_SALES_CSV)

            # Check for required columns
            required_cols = ['transaction_date', 'product_detail', 'transaction_qty']
            missing_cols = [col for col in required_cols if col not in df_coffee_shop.columns]

            if missing_cols:
                print(f"❌ Error: Missing required columns: {missing_cols}")
                print(f"   Found columns: {df_coffee_shop.columns.tolist()}")
                print(f"\n   Expected Ahmed Abas Coffee Shop Sales format:")
                print(f"   - transaction_date, product_detail, transaction_qty")
            else:
                # Rename to standard format
                df_coffee_shop = df_coffee_shop.rename(columns={
                    'transaction_date': 'date',
                    'product_detail': 'article',
                    'transaction_qty': 'quantity'
                })

                # Convert date and clean article names
                df_coffee_shop['date'] = pd.to_datetime(df_coffee_shop['date'])
                df_coffee_shop['article'] = df_coffee_shop['article'].str.strip()

                # Remove invalid quantities
                df_coffee_shop = df_coffee_shop[df_coffee_shop['quantity'] > 0]

                # Get unique articles
                all_articles = df_coffee_shop['article'].unique().tolist()

                # Keep only needed columns
                all_dfs.append(df_coffee_shop[['date', 'article', 'quantity']])

                print(f"✓ Successfully loaded Coffee Shop Sales!")
                print(f"  Total transactions: {len(df_coffee_shop):,}")
                print(f"  Date range: {df_coffee_shop['date'].min().date()} to {df_coffee_shop['date'].max().date()}")
                print(f"  Unique products: {len(all_articles)}")

        except Exception as e:
            print(f"❌ Error loading {COFFEE_SHOP_SALES_CSV}: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"⚠ Coffee Shop Sales CSV not found at:")
        print(f"  {COFFEE_SHOP_SALES_CSV}")
        print(f"\n📥 Download instructions:")
        print(f"  1. Visit: https://www.kaggle.com/datasets/ahmedabbas757/coffee-sales")
        print(f"  2. Download the dataset")
        print(f"  3. Save as: coffee_shop_sales.csv")
        print(f"  4. Place in: {DATA_DIR}/")
        print(f"\n  See CSV_DOWNLOAD_GUIDE.md for detailed instructions")

    # 2. Fallback: Load Generated Data if Coffee Shop Sales not available
    if not all_dfs and os.path.exists(GENERATED_CSV):
        try:
            print(f"\n⚠ Using fallback data: {GENERATED_CSV}")
            df_generated = pd.read_csv(GENERATED_CSV)
            if 'date' in df_generated.columns and 'article' in df_generated.columns:
                df_generated['date'] = pd.to_datetime(df_generated['date'])
                df_generated['article'] = df_generated['article'].str.strip()
                df_generated = df_generated[df_generated['quantity'] > 0]
                all_articles = df_generated['article'].unique().tolist()
                all_dfs.append(df_generated[['date', 'article', 'quantity']])
                print(f"✓ Loaded {len(df_generated)} records from fallback data")
        except Exception as e:
            print(f"Error loading {GENERATED_CSV}: {e}")

    # 3. Combine and Final Processing
    if not all_dfs:
        raise FileNotFoundError(
            f"\n❌ No data files found!\n"
            f"   Please add coffee_shop_sales.csv to: {DATA_DIR}/\n"
            f"   See CSV_DOWNLOAD_GUIDE.md for instructions"
        )

    df = pd.concat(all_dfs, ignore_index=True)
    df = df[df['quantity'] > 0]  # remove negatives/returns

    print(f"\n✓ Final dataset ready: {len(df):,} total sales records")

    # Return dataframe and article list (second param unused, kept for compatibility)
    return df, all_articles, []

def pivot_daily(df):
    daily = df.pivot_table(index='date', columns='article', values='quantity', aggfunc='sum').fillna(0)
    return daily

def create_date_features(df_index):
    """
    Creates basic date features from a datetime index.
    """
    df = pd.DataFrame(index=df_index)
    df['day_of_week'] = df.index.dayofweek
    df['month'] = df.index.month
    df['day_of_year'] = df.index.dayofyear
    df['year'] = df.index.year
    return df


def main():
    print("=" * 80)
    print("  DejaBrew Forecasting Model Training")
    print("  Using Coffee Shop Sales Dataset (Ahmed Abas)")
    print("=" * 80 + "\n")

    # Load data
    df, all_articles, _ = load_data()
    daily = pivot_daily(df)

    # Get top-selling products
    # Train models for top 30 products (configurable)
    TOP_N_PRODUCTS = 30

    all_sales = daily.sum().sort_values(ascending=False)
    top_articles = all_sales.head(TOP_N_PRODUCTS).index.tolist()

    print(f"\nTraining models for top {len(top_articles)} products by sales volume:")
    for i, article in enumerate(top_articles[:10], 1):
        total_qty = int(all_sales[article])
        print(f"  {i}. {article} ({total_qty:,} units sold)")
    if len(top_articles) > 10:
        print(f"  ... and {len(top_articles) - 10} more products")

    print(f"\nTraining models for {len(top_articles)} products:")
    print(top_articles)

    # Create date features for all data
    X = create_date_features(daily.index)

    trained_list = [] # Store names of successfully trained models

    for article in top_articles:
        if article not in daily.columns:
            print(f"Skipping {article} (not found in data)")
            continue

        y = daily[article]

        # Check if we have enough data
        if len(X) < 30:
            print(f"Skipping {article} (not enough data: {len(X)} days)")
            continue

        # simple time-series-ish split: last 20% for testing (no shuffle)
        split = int(len(X) * 0.8)
        if split < 1 or split >= len(X):
            print(f"Skipping {article} (not enough data to split)")
            continue

        X_train, y_train = X.iloc[:split], y.iloc[:split]
        X_test, y_test = X.iloc[split:], y.iloc[split:]

        try:
            model = GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=5,
                min_samples_split=10,
                min_samples_leaf=4,
                random_state=42
            )
            model.fit(X_train, y_train)

            # Evaluate model performance
            y_pred_test = model.predict(X_test)
            y_pred_train = model.predict(X_train)

            # Calculate metrics
            test_mae = mean_absolute_error(y_test, y_pred_test)
            test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
            test_r2 = r2_score(y_test, y_pred_test)
            test_mape = np.mean(np.abs((y_test - y_pred_test) / (y_test + 1))) * 100
            test_accuracy = max(0, 100 - test_mape)

            train_mae = mean_absolute_error(y_train, y_pred_train)
            train_r2 = r2_score(y_train, y_pred_train)

            # Clean filename
            safe_name = article.lower().replace(' ', '_').replace('/', '_')
            fname = f"{MODEL_PREFIX}{safe_name}.joblib"

            joblib.dump(model, os.path.join(MODEL_DIR, fname))
            print(f"Saved model for {article} -> {fname}")
            print(f"  Train: MAE={train_mae:.2f}, R²={train_r2:.4f}")
            print(f"  Test:  MAE={test_mae:.2f}, RMSE={test_rmse:.2f}, R²={test_r2:.4f}, Accuracy={test_accuracy:.2f}%")

            trained_list.append(article) # Add to list for json file
            
        except Exception as e:
            print(f"!! FAILED to train model for {article}: {e}")

    # Save the list of all articles we successfully trained
    json_path = os.path.join(MODEL_DIR, 'trained_articles.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(trained_list, f, ensure_ascii=False, indent=2)

    print("\n--- Training complete! ---")
    print(f"Successfully trained {len(trained_list)} models.")
    print(f"Trained product list saved to {json_path}")

    # --- NEW CLEANUP STEP ---
    print("\nCleaning up old, unused model files...")
    
    # 1. Create the "safe list" of filenames we just trained
    safe_filenames = set() # Use a set for faster lookups
    for article in trained_list:
        safe_name = article.lower().replace(' ', '_').replace('/', '_')
        fname = f"{MODEL_PREFIX}{safe_name}.joblib"
        safe_filenames.add(fname)
        
    # 2. Get all files in the directory
    try:
        all_files_in_dir = os.listdir(MODEL_DIR)
    except Exception as e:
        print(f"Error listing files in {MODEL_DIR}: {e}")
        all_files_in_dir = []
        
    deleted_count = 0
    for filename in all_files_in_dir:
        # 3. Only look at model files
        if filename.startswith(MODEL_PREFIX) and filename.endswith('.joblib'):
            # 4. If this model file is NOT in our safe list, delete it
            if filename not in safe_filenames:
                try:
                    file_path = os.path.join(MODEL_DIR, filename)
                    os.remove(file_path)
                    print(f"Removed old model: {filename}")
                    deleted_count += 1
                except Exception as e:
                    print(f"Could not remove {filename}: {e}")
                        
    print(f"Cleanup complete. Removed {deleted_count} old models.")
    # --- END NEW CLEANUP STEP ---

if __name__ == '__main__':
    main()

