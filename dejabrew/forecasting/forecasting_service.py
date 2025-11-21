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
BAKERY_CSV = os.path.join(DATA_DIR, 'bakery_sales.csv')
COFFEE_CSV = os.path.join(DATA_DIR, 'Coffe_sales.csv')
GENERATED_CSV = os.path.join(DATA_DIR, 'generated_sales.csv')
GENERATED_CSV_2 = os.path.join(DATA_DIR, 'generated_sales_sep_nov.csv')
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
    Loads Kaggle CSVs AND generated sales data with caching
    """
    cache_key = 'kaggle_data_v1_sep_nov'
    cached_data = cache.get(cache_key)
    
    if cached_data:
        print("Loading Kaggle/Generated CSVs from cache...")
        return cached_data
        
    print("Loading Kaggle/Generated CSVs from disk...")
    all_dfs = []
    bakery_articles = []
    coffee_articles = []

    # 1. Load Bakery Data
    if os.path.exists(BAKERY_CSV):
        try:
            df_bakery = pd.read_csv(BAKERY_CSV)
            if 'date' in df_bakery.columns and 'article' in df_bakery.columns:
                df_bakery['date'] = pd.to_datetime(df_bakery['date'])
                df_bakery['article'] = df_bakery['article'].str.strip()
                bakery_articles = df_bakery['article'].unique().tolist()
                all_dfs.append(df_bakery[['date', 'article', 'quantity']])
                print(f"Successfully loaded {BAKERY_CSV}")
        except Exception as e:
            print(f"Error loading {BAKERY_CSV}: {e}")
    
    # 2. Load Coffee Data
    if os.path.exists(COFFEE_CSV):
        try:
            df_coffee = pd.read_csv(COFFEE_CSV)
            if 'Date' in df_coffee.columns and 'coffee_name' in df_coffee.columns:
                coffee_articles = df_coffee['coffee_name'].str.strip().unique().tolist()
                df_coffee.rename(columns={'Date': 'date', 'coffee_name': 'article'}, inplace=True)
                df_coffee['quantity'] = 1
                df_coffee['date'] = pd.to_datetime(df_coffee['date'])
                df_coffee['article'] = df_coffee['article'].str.strip()
                all_dfs.append(df_coffee[['date', 'article', 'quantity']])
                print(f"Successfully loaded {COFFEE_CSV}")
        except Exception as e:
            print(f"Error loading {COFFEE_CSV}: {e}")

    # 3. Load Generated Data
    if os.path.exists(GENERATED_CSV):
        try:
            df_generated = pd.read_csv(GENERATED_CSV)
            if 'date' in df_generated.columns and 'article' in df_generated.columns:
                df_generated['date'] = pd.to_datetime(df_generated['date'])
                df_generated['article'] = df_generated['article'].str.strip()
                all_dfs.append(df_generated[['date', 'article', 'quantity']])
                print(f"Successfully loaded {GENERATED_CSV}")
        except Exception as e:
            print(f"Error loading {GENERATED_CSV}: {e}")

    # 4. Load Generated Data (Sep-Nov)
    if os.path.exists(GENERATED_CSV_2):
        try:
            df_generated_2 = pd.read_csv(GENERATED_CSV_2)
            if 'date' in df_generated_2.columns and 'article' in df_generated_2.columns:
                df_generated_2['date'] = pd.to_datetime(df_generated_2['date'])
                df_generated_2['article'] = df_generated_2['article'].str.strip()
                all_dfs.append(df_generated_2[['date', 'article', 'quantity']])
                print(f"Successfully loaded {GENERATED_CSV_2}")
        except Exception as e:
            print(f"Error loading {GENERATED_CSV_2}: {e}")

    if not all_dfs:
        print("No Kaggle or Generated data files found.")
        return pd.DataFrame(), [], []

    df = pd.concat(all_dfs, ignore_index=True)
    
    cache.set(cache_key, (df, bakery_articles, coffee_articles), 3600)
    print("Saved CSV data to cache.")

    return df, bakery_articles, coffee_articles


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
        current = float(getattr(ing, 'mainStock', 0) or 0)
        forecast_levels = []
        
        # Determine number of periods based on aggregation
        if period == 'weekly':
            num_periods = (days + 6) // 7  # Round up to weeks
        elif period == 'monthly':
            num_periods = (days + 29) // 30  # Round up to months
        else:
            num_periods = days  # Daily
        
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
            
            current -= period_consumption
            forecast_levels.append(current)
        
        # Determine days to empty
        days_to_empty = None
        for i, level in enumerate(forecast_levels):
            if level <= 0:
                # Calculate actual days based on period type
                if period == 'weekly':
                    days_to_empty = (i + 1) * 7
                elif period == 'monthly':
                    days_to_empty = (i + 1) * 30
                else:
                    days_to_empty = i + 1
                break
        
        inventory_forecast.append({
            'name': ing.name,
            'unit': getattr(ing, 'unit', ''),
            'forecast': [round(x, 2) for x in forecast_levels],
            'days_to_empty': days_to_empty
        })
    
    return inventory_forecast