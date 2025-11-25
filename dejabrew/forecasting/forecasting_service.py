# forecasting/forecasting_service.py
import os
import joblib
import pandas as pd
import datetime
import json
from difflib import get_close_matches
from django.conf import settings
from django.utils import timezone
from django.db.models import Sum, F
from django.core.cache import cache
from collections import defaultdict

# --- Import your project's models ---
def get_order_item_model():
    from pos.models import OrderItem
    return OrderItem

# --- Get paths ---
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, 'forecasting_data')

# Ahmed Abas Coffee Shop Sales dataset - try multiple names
CSV_NAMES = ['Coffee Shop Sales.csv', 'coffee_shop_sales.csv']
COFFEE_SHOP_SALES_CSV = None
for csv_name in CSV_NAMES:
    csv_path = os.path.join(DATA_DIR, csv_name)
    if os.path.exists(csv_path):
        COFFEE_SHOP_SALES_CSV = csv_path
        break

# Legacy CSV files (fallback)
GENERATED_CSV = os.path.join(DATA_DIR, 'generated_sales.csv')
MODEL_PREFIX = 'model_'
MODEL_CACHE = {}

MAPPING_FILE = os.path.join(DATA_DIR, 'product_mapping.json')


def load_live_db_data():
    """
    Loads all 'paid' sales data directly from the Django database.
    """
    print("Loading sales data from live database...")
    OrderItem = get_order_item_model()

    qs = OrderItem.objects.filter(order__status='paid') \
                          .annotate(date=F('order__created_at__date')) \
                          .values('date', 'item__name') \
                          .annotate(quantity=Sum('qty')) \
                          .order_by('date')

    if not qs.exists():
        print("No sales data found in database.")
        return pd.DataFrame(columns=['date', 'article', 'quantity'])

    df = pd.DataFrame.from_records(qs)
    df = df.rename(columns={'item__name': 'article'})
    df['date'] = pd.to_datetime(df['date'])
    
    if not df.empty:
        df['article'] = df['article'].str.strip()

    print(f"Loaded {len(df)} aggregated sales records from DB.")
    return df[['date', 'article', 'quantity']]


def load_kaggle_data():
    """
    Loads Coffee Shop Sales CSV (Ahmed Abas dataset) with caching.

    Expected CSV columns:
    - transaction_date: Date of sale
    - product_detail: Product name
    - transaction_qty: Quantity sold
    - product_category: Product category (optional)
    """
    cache_key = 'coffee_shop_sales_v2'
    cached_data = cache.get(cache_key)

    if cached_data:
        print("Loading Coffee Shop Sales from cache...")
        return cached_data

    print("Loading Coffee Shop Sales CSV from disk...")
    all_dfs = []
    all_articles = []

    # 1. Load Coffee Shop Sales (Ahmed Abas dataset)
    if COFFEE_SHOP_SALES_CSV and os.path.exists(COFFEE_SHOP_SALES_CSV):
        try:
            csv_filename = os.path.basename(COFFEE_SHOP_SALES_CSV)
            print(f"Reading {csv_filename}...")
            df_coffee_shop = pd.read_csv(COFFEE_SHOP_SALES_CSV)

            # Check for required columns
            required_cols = ['transaction_date', 'product_detail', 'transaction_qty']
            missing_cols = [col for col in required_cols if col not in df_coffee_shop.columns]

            if missing_cols:
                print(f"Error: Missing required columns: {missing_cols}")
                print(f"Found columns: {df_coffee_shop.columns.tolist()}")
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

                # Get unique articles
                all_articles = df_coffee_shop['article'].unique().tolist()

                # Keep only needed columns
                all_dfs.append(df_coffee_shop[['date', 'article', 'quantity']])
                print(f"✓ Successfully loaded Coffee Shop Sales: {len(df_coffee_shop)} transactions")
                print(f"  Date range: {df_coffee_shop['date'].min()} to {df_coffee_shop['date'].max()}")
                print(f"  Unique products: {len(all_articles)}")

        except Exception as e:
            print(f"Error loading {COFFEE_SHOP_SALES_CSV}: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"⚠ Coffee Shop Sales CSV not found at: {COFFEE_SHOP_SALES_CSV}")
        print(f"  Please download from: https://www.kaggle.com/datasets/ahmedabbas757/coffee-sales")
        print(f"  See CSV_DOWNLOAD_GUIDE.md for instructions")

    # 2. Fallback: Load Generated Data if Coffee Shop Sales not available
    if not all_dfs and os.path.exists(GENERATED_CSV):
        try:
            print(f"Loading fallback data: {GENERATED_CSV}")
            df_generated = pd.read_csv(GENERATED_CSV)
            if 'date' in df_generated.columns and 'article' in df_generated.columns:
                df_generated['date'] = pd.to_datetime(df_generated['date'])
                df_generated['article'] = df_generated['article'].str.strip()
                all_articles = df_generated['article'].unique().tolist()
                all_dfs.append(df_generated[['date', 'article', 'quantity']])
                print(f"✓ Successfully loaded fallback data")
        except Exception as e:
            print(f"Error loading {GENERATED_CSV}: {e}")

    if not all_dfs:
        print("❌ No data files found. Please add coffee_shop_sales.csv")
        return pd.DataFrame(), [], []

    df = pd.concat(all_dfs, ignore_index=True)

    # Cache for 1 hour
    cache.set(cache_key, (df, all_articles, []), 3600)
    print("✓ Saved CSV data to cache.")

    return df, all_articles, []


def load_trained_articles():
    fn = os.path.join(DATA_DIR, 'trained_articles.json')
    if not os.path.exists(fn):
        return []
    try:
        with open(fn, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def list_available_models():
    return load_trained_articles()

def model_filename_for_article(article):
    safe = article.lower().replace(' ', '_').replace('/', '_')
    return os.path.join(DATA_DIR, f"{MODEL_PREFIX}{safe}.joblib")

def load_model_for_article(article):
    if article in MODEL_CACHE:
        return MODEL_CACHE[article]
    path = model_filename_for_article(article)
    if not os.path.exists(path):
        return None
    model = joblib.load(path)
    MODEL_CACHE[article] = model
    return model

def map_item_to_article(item_name):
    """
    Returns the best-matching article name trained in models.
    """
    # 1) explicit mapping
    if os.path.exists(MAPPING_FILE):
        try:
            with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
                mapping = json.load(f)
            if item_name in mapping:
                return mapping[item_name]
        except Exception:
            pass

    trained = load_trained_articles()
    if not trained:
        return None

    # exact match
    for a in trained:
        if a.lower() == item_name.lower():
            return a

    # fuzzy match
    candidates = get_close_matches(item_name, trained, n=1, cutoff=0.55)
    if candidates:
        return candidates[0]

    # fallback: token matching
    lower = item_name.lower()
    for a in trained:
        if a.lower() in lower or lower in a.lower():
            return a

    return None


# --- Utility functions for training ---
def pivot_daily(df):
    """
    Pivot sales data to daily format with articles as columns.

    Args:
        df: DataFrame with columns [date, article, quantity]

    Returns:
        DataFrame with dates as index and articles as columns
    """
    daily = df.pivot_table(index='date', columns='article', values='quantity', aggfunc='sum').fillna(0)
    return daily


def create_date_features(df_index):
    """
    Create time-based features from datetime index for model training.

    Args:
        df_index: DatetimeIndex

    Returns:
        DataFrame with features: day_of_week, month, day_of_year, year
    """
    df = pd.DataFrame(index=df_index)
    df['day_of_week'] = df.index.dayofweek
    df['month'] = df.index.month
    df['day_of_year'] = df.index.dayofyear
    df['year'] = df.index.year
    return df


def create_date_features_for_range(start_date, days):
    dates = [start_date + datetime.timedelta(days=i) for i in range(days)]
    df = pd.DataFrame({'date': pd.to_datetime(dates)})
    df.set_index('date', inplace=True)
    features = pd.DataFrame(index=df.index)
    features['day_of_week'] = features.index.dayofweek
    features['month'] = features.index.month
    features['day_of_year'] = features.index.dayofyear
    features['year'] = features.index.year
    return features


def predict_for_item(item_name, days=7, start_date=None, period='daily'):
    """
    Returns predictions for next `days` for the mapped article.
    Now supports aggregation by period: 'daily', 'weekly', 'monthly'
    """
    article = map_item_to_article(item_name)
    if not article:
        return None

    model = load_model_for_article(article)
    if model is None:
        return None

    # Use provided start_date or default to tomorrow
    start = start_date if start_date else (timezone.now().date() + datetime.timedelta(days=1))
    
    # Always generate daily predictions first
    features = create_date_features_for_range(start, days)
    preds = model.predict(features)
    preds = [int(max(0, round(float(p)))) for p in preds]
    
    # Create daily results
    daily_results = [
        {
            'date': (start + datetime.timedelta(days=i)).isoformat(), 
            'predicted_quantity': preds[i]
        } 
        for i in range(len(preds))
    ]
    
    # Return aggregated based on period
    if period == 'daily':
        return daily_results
    elif period == 'weekly':
        return aggregate_to_weekly(daily_results)
    elif period == 'monthly':
        return aggregate_to_monthly(daily_results)
    else:
        return daily_results


def aggregate_to_weekly(daily_predictions):
    """
    Aggregates daily predictions into weekly totals
    """
    if not daily_predictions:
        return []
    
    df = pd.DataFrame(daily_predictions)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    
    # Resample to weekly (W-SUN = week ending on Sunday)
    weekly = df.resample('W').sum()
    
    result = []
    for date, row in weekly.iterrows():
        result.append({
            'date': date.isoformat(),
            'predicted_quantity': int(row['predicted_quantity'])
        })
    
    return result


def aggregate_to_monthly(daily_predictions):
    """
    Aggregates daily predictions into monthly totals
    """
    if not daily_predictions:
        return []
    
    df = pd.DataFrame(daily_predictions)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    
    # Resample to month start
    monthly = df.resample('MS').sum()
    
    result = []
    for date, row in monthly.iterrows():
        result.append({
            'date': date.isoformat(),
            'predicted_quantity': int(row['predicted_quantity'])
        })
    
    return result


def match_ingredient_name(recipe_name, ingredients_queryset):
    """
    Fuzzy match recipe ingredient to database ingredient
    """
    names = [ing.name for ing in ingredients_queryset]
    
    # exact match
    for ing in ingredients_queryset:
        if ing.name.lower() == recipe_name.lower():
            return ing
    
    # substring match
    for ing in ingredients_queryset:
        if recipe_name.lower() in ing.name.lower() or ing.name.lower() in recipe_name.lower():
            return ing
    
    # difflib fuzzy match
    candidates = get_close_matches(recipe_name, names, n=1, cutoff=0.5)
    if candidates:
        name = candidates[0]
        for ing in ingredients_queryset:
            if ing.name == name:
                return ing
    return None


def compute_inventory_forecast(items_with_predictions, IngredientModel, RecipeExtractor, days=7, period='daily'):
    all_ingredients = list(IngredientModel.objects.all())
    ing_map = {ing.name: ing for ing in all_ingredients}

    inventory_forecast = []

    for ing in all_ingredients:
        # Get current stock (using mainStock or stock field)
        current_stock = float(getattr(ing, 'mainStock', None) or getattr(ing, 'stock', 0) or 0)

        # Skip ingredients with no stock at all
        if current_stock <= 0:
            continue

        current = current_stock
        forecast_levels = []

        # Determine number of periods based on aggregation
        if period == 'weekly':
            num_periods = (days + 6) // 7  # Round up to weeks
        elif period == 'monthly':
            num_periods = (days + 29) // 30  # Round up to months
        else:
            num_periods = days  # Daily

        # Calculate total consumption across all periods
        total_usage = 0.0

        # Calculate consumption per period
        for period_idx in range(num_periods):
            period_consumption = 0.0

            # Iterate through all items
            for item_name, preds in items_with_predictions.items():
                recipe = RecipeExtractor(item_name)
                if not recipe:
                    continue

                # Find this ingredient in the recipe
                for rec in recipe:
                    rec_ing_name = rec.get('ingredient')
                    qty_per_item = float(rec.get('quantity', 0) or 0)
                    if not rec_ing_name or qty_per_item == 0:
                        continue

                    # Match ingredient
                    matched = None
                    if rec_ing_name in ing_map:
                        matched = ing_map[rec_ing_name]
                    else:
                        matched = match_ingredient_name(rec_ing_name, all_ingredients)

                    if matched and matched.id == ing.id:
                        # Get predicted quantity for this period
                        if period_idx < len(preds):
                            predicted_qty = preds[period_idx]
                        else:
                            predicted_qty = 0

                        period_consumption += predicted_qty * qty_per_item

            total_usage += period_consumption
            current -= period_consumption
            forecast_levels.append(current)

        # Determine days to empty
        days_until_depleted = None

        # Only calculate depletion if there's actual usage
        if total_usage > 0:
            for i, level in enumerate(forecast_levels):
                if level <= 0:
                    # Calculate actual days based on period type
                    if period == 'weekly':
                        days_until_depleted = (i + 1) * 7
                    elif period == 'monthly':
                        days_until_depleted = (i + 1) * 30
                    else:
                        days_until_depleted = i + 1
                    break
        # If no usage, days_until_depleted stays None (displays as 'N/A')

        # ✅ RETURN ALL INGREDIENTS WITH STOCK (removed total_usage > 0 filter)
        inventory_forecast.append({
            'ingredient': ing.name,
            'current_stock': current_stock,
            'total_usage': total_usage,  # Can be 0 for unused ingredients
            'unit': getattr(ing, 'unit', ''),
            'days_until_depleted': days_until_depleted  # None if no usage
        })

    return inventory_forecast