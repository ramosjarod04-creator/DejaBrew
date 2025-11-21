# forecasting/train_models.py
"""
Train per-product models from multiple Kaggle CSVs.
- Reads: forecasting/forecasting_data/bakery_sales.csv
- Reads: forecasting/forecasting_data/Coffe_sales.csv
Combines them and trains models for the top 10 bakery + top 20 coffee products.
*** NEW: Now includes a cleanup step to remove old/unused models. ***
"""
import os
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
import joblib
import json

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'forecasting_data')
os.makedirs(DATA_DIR, exist_ok=True)

BAKERY_CSV = os.path.join(DATA_DIR, 'bakery_sales.csv')
COFFEE_CSV = os.path.join(DATA_DIR, 'Coffe_sales.csv') # Exact name from user

MODEL_PREFIX = 'model_'
MODEL_DIR = DATA_DIR

def load_data():
    """
    --- UPDATED ---
    Loads and combines data from both CSVs.
    Returns:
    1. A combined DataFrame for training.
    2. A list of unique articles from the bakery CSV.
    3. A list of unique articles from the coffee CSV.
    """
    all_dfs = []
    bakery_articles = []
    coffee_articles = []

    # 1. Load Bakery Data
    if os.path.exists(BAKERY_CSV):
        try:
            df_bakery = pd.read_csv(BAKERY_CSV)
            if 'date' not in df_bakery.columns or 'article' not in df_bakery.columns or 'quantity' not in df_bakery.columns:
                print(f"Bakery CSV missing required columns. Found: {df_bakery.columns.tolist()}")
            else:
                df_bakery['date'] = pd.to_datetime(df_bakery['date'])
                df_bakery['article'] = df_bakery['article'].str.strip()
                bakery_articles = df_bakery['article'].unique().tolist() # Get bakery names
                all_dfs.append(df_bakery[['date', 'article', 'quantity']])
                print(f"Successfully loaded {BAKERY_CSV}")
        except Exception as e:
            print(f"Error loading {BAKERY_CSV}: {e}")
    
    # 2. Load Coffee Data
    if os.path.exists(COFFEE_CSV):
        try:
            df_coffee = pd.read_csv(COFFEE_CSV)
            if 'Date' in df_coffee.columns and 'coffee_name' in df_coffee.columns:
                # Get coffee names BEFORE renaming
                coffee_articles = df_coffee['coffee_name'].str.strip().unique().tolist()
                
                # Standardize columns: ('Date' -> 'date', 'coffee_name' -> 'article')
                df_coffee.rename(columns={'Date': 'date', 'coffee_name': 'article'}, inplace=True)
                df_coffee['quantity'] = 1 # Assume quantity is 1
                df_coffee['date'] = pd.to_datetime(df_coffee['date'])
                df_coffee['article'] = df_coffee['article'].str.strip()
                all_dfs.append(df_coffee[['date', 'article', 'quantity']])
                print(f"Successfully loaded {COFFEE_CSV}")
            else:
                print(f"Coffee CSV missing required columns ('Date', 'coffee_name'). Found: {df_coffee.columns.tolist()}")
        except Exception as e:
            print(f"Error loading {COFFEE_CSV}: {e}")

    # 3. Combine and Final Processing
    if not all_dfs:
        raise FileNotFoundError(f"No data files found. Please put your CSVs at {BAKERY_CSV} and/or {COFFEE_CSV}")

    df = pd.concat(all_dfs, ignore_index=True)
    df = df[df['quantity'] > 0]  # remove negatives/returns
    
    print(f"Combined data has {len(df)} total sales records.")
    # Return all 3 items
    return df, bakery_articles, coffee_articles

def pivot_daily(df):
    daily = df.pivot_table(index='date', columns='article', values='quantity', aggfunc='sum').fillna(0)
    return daily

def create_date_features(df_index):
    df = pd.DataFrame(index=df_index)
    df['day_of_week'] = df.index.dayofweek
    df['month'] = df.index.month
    df['day_of_year'] = df.index.dayofyear
    df['year'] = df.index.year
    return df

def main():
    print("Starting model training...")
    # --- UPDATED: Get article lists from load_data ---
    df, bakery_articles, coffee_articles = load_data()
    daily = pivot_daily(df)

    # --- UPDATED: Get Top 10 Bakery + Top 20 Coffee ---
    # Get sales summary for all products
    all_sales = daily.sum().sort_values(ascending=False)
    
    # Filter sales list for bakery articles, then get top 10
    top_bakery = all_sales[all_sales.index.isin(bakery_articles)].head(10).index.tolist()
    print(f"\nFound Top {len(top_bakery)} Bakery Items...")
    
    # Filter sales list for coffee articles, then get top 20
    top_coffee = all_sales[all_sales.index.isin(coffee_articles)].head(20).index.tolist()
    print(f"Found Top {len(top_coffee)} Coffee Items...")
    
    # Combine the lists and remove any duplicates (e.g., if 'COOKIE' was in both)
    top_articles = list(dict.fromkeys(top_bakery + top_coffee))
    # --- END UPDATED ---

    print(f"\nTraining models for {len(top_articles)} products:")
    print(top_articles)
    
    X = create_date_features(daily.index)
    
    trained_list = [] # Store names of successfully trained models

    for article in top_articles:
        if article not in daily.columns:
            print(f"Skipping {article} (not found in data)")
            continue
        y = daily[article]
        
        # simple time-series-ish split: last 20% for testing (no shuffle)
        split = int(len(X) * 0.8) if len(X) >= 5 else int(len(X) * 0.7)
        if split < 1 or split >= len(X):
            print(f"Skipping {article} (not enough data to split)")
            continue
            
        X_train, y_train = X.iloc[:split], y.iloc[:split]
        
        try:
            model = GradientBoostingRegressor(n_estimators=200, learning_rate=0.05, random_state=42)
            model.fit(X_train, y_train)
            
            # Clean filename
            safe_name = article.lower().replace(' ', '_').replace('/', '_')
            fname = f"{MODEL_PREFIX}{safe_name}.joblib"
            
            joblib.dump(model, os.path.join(MODEL_DIR, fname))
            print(f"Saved model for {article} -> {fname}")
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

