# In your app: forecasting/views.py
import json
import os
import pandas as pd # Import pandas
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.shortcuts import get_object_or_404, render
# --- UPDATED IMPORTS ---
from forecasting.forecasting_service import (
    predict_for_item, compute_inventory_forecast, list_available_models,
    map_item_to_article, load_live_db_data, load_kaggle_data
)
# --- END UPDATED IMPORTS ---
from pos.models import Item, Ingredient
import datetime
from datetime import timedelta # Import timedelta
from django.utils import timezone # Import timezone
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth # Import Trunc functions
from decimal import Decimal # Import Decimal

# Get forecasting data directory path
FORECASTING_DATA_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    'forecasting_data'
)


# Helper to extract recipe given an item name
def recipe_extractor_by_item_name(item_name):
    try:
        item = Item.objects.filter(name__iexact=item_name).first()
        if not item:
            # fallback: try fuzzy matching by Item.name
            item = Item.objects.filter(name__icontains=item_name).first()
        if not item:
            return []
        return item.recipe or []
    except Exception:
        return []

# --- UPDATED HELPER: Processes combined data for the chart ---
def get_combined_historical_chart_data(period, end_date):
    """
    Loads, combines, and aggregates Kaggle + Live data
    to match the format needed by the chart.
    
    --- NOW CALCULATES REVENUE ---
    """
    print("Loading combined historical data for chart...")
    
    # --- NEW: Get a price map from the database ---
    price_map = {item.name: item.price for item in Item.objects.filter(is_active=True)}
    
    df_kaggle, _, _ = load_kaggle_data()
    df_live = load_live_db_data()

    if df_kaggle.empty and df_live.empty:
        print("No historical data found.")
        return []

    # Combine data
    df = pd.concat([df_kaggle, df_live], ignore_index=True)
    df = df[df['quantity'] > 0] # remove negatives/returns
    
    # --- NEW: Map prices and calculate revenue ---
    # Use .get() to avoid errors for products not in the DB (like old Kaggle items)
    df['price'] = df['article'].map(price_map).fillna(Decimal('0.0'))
    
    # Ensure quantity is numeric before multiplying
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
    
    # Calculate revenue (price is Decimal, quantity is float/int)
    # We must convert to Decimal for accuracy
    df['revenue'] = df.apply(lambda row: Decimal(row['quantity']) * row['price'], axis=1)
    # --- END NEW ---
    
    # Aggregate duplicates (e.g., same day, same item in both CSV and DB)
    # --- MODIFIED: Aggregate revenue ---
    df_agg = df.groupby('date')['revenue'].sum().reset_index()
    df_agg['date'] = pd.to_datetime(df_agg['date'])
    
    # Set index for resampling
    df_agg = df_agg.set_index('date').sort_index()

    # Create a full date range to fill gaps
    if df_agg.empty:
         start_range = end_date
    else:
         start_range = df_agg.index.min()
         
    # Filter data up to the end_date
    df_agg = df_agg[df_agg.index <= pd.to_datetime(end_date)]
    
    sales_data = []

    if period == 'daily':
        # Get 7 days ending on end_date
        start_date = end_date - timedelta(days=6)
        # --- MODIFIED ---
        daily_sales = df_agg.resample('D').sum()['revenue'].fillna(Decimal('0.0'))
        daily_sales = daily_sales[(daily_sales.index.date >= start_date) & (daily_sales.index.date <= end_date)]
        
        # Create a full index for the 7-day period
        full_index = pd.date_range(start=start_date, end=end_date, freq='D')
        daily_sales = daily_sales.reindex(full_index, fill_value=Decimal('0.0'))

        for date, sales in daily_sales.items():
            sales_data.append({'label': date.strftime('%a'), 'sales': float(sales)}) # 'sales' is now revenue
        
    elif period == 'weekly':
        # Get 8 weeks ending on end_date's week
        start_date = end_date - timedelta(weeks=7)
        # --- MODIFIED ---
        weekly_sales = df_agg.resample('W').sum()['revenue'].fillna(Decimal('0.0'))
        weekly_sales = weekly_sales[(weekly_sales.index.date >= start_date)] # approx
        
        for date, sales in weekly_sales.items():
             sales_data.append({'label': f"Wk {date.strftime('%U')}", 'sales': float(sales)})
             
    elif period == 'monthly':
        start_date = (end_date.replace(day=1) - timedelta(days=150)).replace(day=1)
        # --- MODIFIED ---
        monthly_sales = df_agg.resample('MS').sum()['revenue'].fillna(Decimal('0.0'))
        monthly_sales = monthly_sales[(monthly_sales.index.date >= start_date)]
        
        for date, sales in monthly_sales.items():
            sales_data.append({'label': date.strftime('%b %Y'), 'sales': float(sales)})

    return sales_data


@require_GET
def predict_api(request):
    """
    Endpoint: /forecasting/api/predict/?days=7&retrain=0&item=Latte&end_date=YYYY-MM-DD
    Returns BOTH aggregated forecast AND combined historical data.
    
    --- NOW PREDICTS REVENUE ---
    """
    try:
        days = int(request.GET.get('days', 7))
        days = max(1, min(days, 90))
        item_param = request.GET.get('item', '').strip()
        period = request.GET.get('period', 'daily') # Get period
        
        # --- Read end_date (which is "today") from the URL ---
        end_date_str = request.GET.get('end_date')
        try:
            # Use the date from the URL
            today_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            # Fallback to server's 'today'
            today_date = timezone.now().date()
        
        # --- THIS IS THE FIX ---
        # Set the forecast start date to TOMORROW
        start_date = today_date + datetime.timedelta(days=1)
        # --- END OF FIX ---
        
        # This will hold {item_name: {'series': [qty1, ...], 'price': ...}}
        predictions = {} 
        
        # This will hold the full data for 'per_item_predictions'
        # {item_name: [{'date': ..., 'predicted_quantity': ...}, ...]}
        full_preds_by_item = {}

        # If item specified, return only that item's forecast
        if item_param:
            preds = predict_for_item(item_param, days=days, start_date=start_date)
            if preds is None:
                return JsonResponse({'success': False, 'error': 'No model found for that item.'}, status=404)
            
            # --- NEW: Get item's price ---
            item = Item.objects.filter(name__iexact=item_param).first()
            item_price = item.price if item else Decimal('0.0')

            full_preds_by_item[item_param] = preds
            predictions[item_param] = {
                'series': [p['predicted_quantity'] for p in preds],
                'price': item_price
            }
        else:
            # Predict for all Items that can be mapped
            items = Item.objects.filter(is_active=True).order_by('id')
            for it in items:
                # use Item.name as key
                preds = predict_for_item(it.name, days=days, start_date=start_date)
                if preds:
                    full_preds_by_item[it.name] = preds
                    # --- MODIFIED: Store price along with the series ---
                    predictions[it.name] = {
                        'series': [p['predicted_quantity'] for p in preds],
                        'price': it.price # This is a Decimal
                    }
        
        # Build per-item predictions list in template-friendly format
        per_item_predictions = []
        for item_name, pred_list in full_preds_by_item.items():
            per_item_predictions.append({
                'item': item_name,
                'predictions': pred_list
            })

        # --- Create aggregated forecast for the dashboard chart ---
        aggregated_forecast = []
        
        # 'today' here is a bad variable name, it's actually the forecast start date (tomorrow)
        forecast_start_date = start_date 
        
        for d in range(days):
            # --- MODIFIED: Use Decimal for precision ---
            total_for_day = Decimal('0.0')
            
            for item_name, data in predictions.items():
                series = data['series']
                price = data['price'] # This is a Decimal
                if d < len(series):
                    # series[d] is an int, price is a Decimal
                    total_for_day += Decimal(series[d]) * price
            
            aggregated_forecast.append({
                'date': (forecast_start_date + datetime.timedelta(days=d)).isoformat(),
                'predicted_revenue': float(total_for_day) # Convert to float for JSON
            })
        # --- END MODIFICATION ---

        # --- Get Combined Historical Data (using "today", NOT tomorrow) ---
        combined_historical = get_combined_historical_chart_data(period, today_date)
        # --- END ---

        # Inventory forecast: compute ingredient depletion
        # This needs the *quantity* predictions
        quantity_predictions = {name: data['series'] for name, data in predictions.items()}
        inventory_forecast = compute_inventory_forecast(
            quantity_predictions,
            IngredientModel=Ingredient,
            RecipeExtractor=lambda name: recipe_extractor_by_item_name(name),
            days=days
        )

        return JsonResponse({
            'success': True,
            'predictions': per_item_predictions,      # For per-item details
            'aggregated_forecast': aggregated_forecast, # For the green forecast line
            'combined_historical': combined_historical, # For the brown historical line
            'inventory_forecast': inventory_forecast,   # For the inventory table
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def upload_model_view(request):
    """
    Upload View: Accepts a .joblib model file trained in Google Colab
    and saves it to forecasting_data/latest_colab_model.joblib

    Endpoint: /upload_model/
    Method: POST
    Accepts: multipart/form-data with 'model_file' field
    """
    try:
        if 'model_file' not in request.FILES:
            return JsonResponse({
                'success': False,
                'error': 'No model_file provided in request'
            }, status=400)

        uploaded_file = request.FILES['model_file']

        # Validate file extension
        if not uploaded_file.name.endswith('.joblib'):
            return JsonResponse({
                'success': False,
                'error': 'File must be a .joblib file'
            }, status=400)

        # Ensure forecasting_data directory exists
        os.makedirs(FORECASTING_DATA_DIR, exist_ok=True)

        # Save to latest_colab_model.joblib
        save_path = os.path.join(FORECASTING_DATA_DIR, 'latest_colab_model.joblib')

        with open(save_path, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        return JsonResponse({
            'success': True,
            'message': 'Model uploaded successfully',
            'saved_to': save_path
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_GET
def metrics_dashboard_view(request):
    """
    Metrics View: Reads latest_metrics.json and returns the data
    Can be used both as JSON API or to render a template

    Endpoint: /metrics_dashboard/
    Method: GET

    Query params:
    - format=json : Returns JSON response (default)
    - format=html : Renders template with metrics data
    """
    try:
        metrics_file = os.path.join(FORECASTING_DATA_DIR, 'latest_metrics.json')

        if not os.path.exists(metrics_file):
            return JsonResponse({
                'success': False,
                'error': 'No metrics file found. Please run model retraining first.'
            }, status=404)

        # Read metrics from file
        with open(metrics_file, 'r', encoding='utf-8') as f:
            metrics_data = json.load(f)

        # Check if user wants HTML or JSON response
        response_format = request.GET.get('format', 'json')

        if response_format == 'html':
            # Render template with metrics data
            return render(request, 'forecasting/metrics_dashboard.html', {
                'metrics': metrics_data
            })
        else:
            # Return JSON response
            return JsonResponse({
                'success': True,
                'metrics': metrics_data
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)