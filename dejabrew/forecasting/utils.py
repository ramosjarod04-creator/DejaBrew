import os
import pickle
from datetime import timedelta
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import pandas as pd
from pos.models import Order, OrderItem
from django.db.models import Sum, F

from django.conf import settings

DEFAULT_CSV_PATH = os.path.join(settings.BASE_DIR, 'static', 'data', 'sales.csv')

def _infer_columns(df):
    # Try to find date, product id, and quantity columns
    date_cols = [c for c in df.columns if 'date' in c.lower()]
    qty_cols = [c for c in df.columns if any(k in c.lower() for k in ['qty','quantity','sales','sold'])]
    pid_cols = [c for c in df.columns if any(k in c.lower() for k in ['product','item','sku','id'])]

    date_col = date_cols[0] if date_cols else df.columns[0]
    qty_col = qty_cols[0] if qty_cols else df.columns[-1]
    pid_col = pid_cols[0] if pid_cols else None

    return date_col, pid_col, qty_col

def aggregate_daily(df, product_id=None):
    d = df.copy()
    if product_id:
        d = d[d['product_id'] == product_id]
    daily = d.groupby('date').agg({'quantity':'sum'}).asfreq('D', fill_value=0)
    daily = daily.rename_axis('date').reset_index()
    return daily

def load_sales_df():
    """
    Loads all 'paid' sales data directly from the database.
    """
    print("Loading sales data from database...")

    # Get all paid order items
    qs = OrderItem.objects.filter(order__status='paid') \
                          .annotate(date=F('order__created_at__date')) \
                          .values('date', 'item__name', 'item_id') \
                          .annotate(quantity=Sum('qty')) \
                          .order_by('date')

    # Convert the query results to a pandas DataFrame
    df = pd.DataFrame.from_records(qs)

    if df.empty:
        print("No sales data found in database.")
        # Return an empty DataFrame with the columns your code expects
        return pd.DataFrame(columns=['date', 'product_id', 'product_name', 'quantity'])

    # Rename columns to match what your forecasting code likely expects
    df = df.rename(columns={'item_id': 'product_id', 'item__name': 'product_name'})

    # Convert date column to datetime objects
    df['date'] = pd.to_datetime(df['date'])

    print(f"Loaded {len(df)} aggregated sales records from DB.")
    return df

def make_features(df):
    # expects df with columns ['date','quantity']
    df = df.copy()
    df['dayofweek'] = df['date'].dt.dayofweek
    df['day'] = df['date'].dt.day
    df['month'] = df['date'].dt.month
    df['is_month_start'] = df['date'].dt.is_month_start.astype(int)
    # lag features
    df = df.sort_values('date')
    for lag in [1,2,3,7,14]:
        df[f'lag_{lag}'] = df['quantity'].shift(lag).fillna(0)
    # rolling
    df['rolling_7'] = df['quantity'].rolling(7, min_periods=1).mean().shift(1).fillna(0)
    df['rolling_14'] = df['quantity'].rolling(14, min_periods=1).mean().shift(1).fillna(0)
    df = df.fillna(0)
    return df

def train_gb_model(df_daily, test_size=0.2, random_state=42):
    df_feat = make_features(df_daily)
    # drop earliest rows that have 0 from lags? keep all since filled with 0
    X = df_feat.drop(columns=['date','quantity'])
    y = df_feat['quantity']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, shuffle=False)
    model = GradientBoostingRegressor(random_state=random_state)
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = mean_squared_error(y_test, preds, squared=False)
    mape = np.mean(np.abs((y_test - preds) / (y_test.replace(0, 1)))) * 100.
    metrics = {'mae': float(mae), 'rmse': float(rmse), 'mape': float(mape)}
    return model, metrics

def forecast_next_days(model, df_daily, days=30):
    df_feat = make_features(df_daily)
    last_row = df_feat.iloc[-1:].copy()
    preds = []
    dates = []
    current_row = last_row.copy()
    for i in range(days):
        next_date = current_row['date'].iloc[0] + pd.Timedelta(days=1)
        # build row for next_date
        new_row = {}
        new_row['date'] = next_date
        new_row['dayofweek'] = next_date.dayofweek
        new_row['day'] = next_date.day
        new_row['month'] = next_date.month
        new_row['is_month_start'] = int(next_date.is_month_start)
        # compute lag features from current_row / previously predicted
        # for simplicity we'll use previous predicted values stored in preds
        history = list(df_feat['quantity'].values) + preds
        # last 14 values of history
        for lag in [1,2,3,7,14]:
            if len(history) >= lag:
                new_row[f'lag_{lag}'] = history[-lag]
            else:
                new_row[f'lag_{lag}'] = 0
        # rolling means
        window7 = np.mean(history[-7:]) if len(history) >= 1 else 0
        window14 = np.mean(history[-14:]) if len(history) >= 1 else 0
        new_row['rolling_7'] = window7
        new_row['rolling_14'] = window14
        X_new = pd.DataFrame([new_row]).drop(columns=['date'])
        yhat = model.predict(X_new)[0]
        # floor at 0
        yhat = max(0, float(yhat))
        preds.append(yhat)
        dates.append(next_date)
        # append to df_feat equivalent for next iter (not needed in detail)
        # create a pseudo row to extend 'history' already handled
        current_row = pd.DataFrame([new_row])
    return pd.DataFrame({'date': dates, 'predicted_quantity': preds})

def save_model_pickle(model, filename):
    out_dir = os.path.join(settings.MEDIA_ROOT if hasattr(settings, 'MEDIA_ROOT') else settings.BASE_DIR, 'forecast_models')
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, filename)
    with open(path, 'wb') as f:
        pickle.dump(model, f)
    return path

def load_model_pickle(path):
    with open(path, 'rb') as f:
        return pickle.load(f)
