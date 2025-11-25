# forecasting/management/commands/retrain_live.py

import os
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import json
from datetime import datetime
from django.core.management.base import BaseCommand
from django.db.models import Sum, F

# --- UPDATED: Import from forecasting_service ---
from forecasting.forecasting_service import (
    load_live_db_data,
    load_kaggle_data,
    pivot_daily,
    create_date_features
) 

# --- Get paths from your train_models.py ---
BASE = os.path.dirname(os.path.abspath(__file__))
# Go up two levels (from management/commands) to the app folder
APP_DIR = os.path.join(BASE, '..', '..') 
DATA_DIR = os.path.join(APP_DIR, 'forecasting_data')
MODEL_PREFIX = 'model_'
MODEL_DIR = DATA_DIR


def save_metrics_json(metrics_dict):
    """
    Save metrics dictionary to forecasting_data/latest_metrics.json

    Args:
        metrics_dict: Dictionary containing test metrics for all trained models
    """
    metrics_file = os.path.join(DATA_DIR, 'latest_metrics.json')

    with open(metrics_file, 'w', encoding='utf-8') as f:
        json.dump(metrics_dict, f, ensure_ascii=False, indent=2)

    return metrics_file


# --- This is the main Django command ---
class Command(BaseCommand):
    help = 'Retrains all product forecasting models using live DB and Kaggle data.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting model retraining..."))

        # --- 1. LOAD DATA ---
        # --- UPDATED: These functions are now imported ---
        df_kaggle, bakery_articles, coffee_articles = load_kaggle_data()
        df_live = load_live_db_data()

        if df_kaggle.empty and df_live.empty:
            self.stdout.write(self.style.ERROR("No data found in CSVs or Live DB. Aborting."))
            return

        # --- 2. COMBINE DATA ---
        df = pd.concat([df_kaggle, df_live], ignore_index=True)
        df = df[df['quantity'] > 0] # remove negatives/returns
        
        # Aggregate duplicates (e.g., same day, same item in both CSV and DB)
        df = df.groupby(['date', 'article'])['quantity'].sum().reset_index()

        self.stdout.write(f"Combined data has {len(df)} total sales records.")

        # --- 3. TRAIN MODELS (Logic from train_models.py) ---
        daily = pivot_daily(df)

        all_sales = daily.sum().sort_values(ascending=False)
        
        # Use provided article lists if available, otherwise just use top-selling
        if not bakery_articles:
            bakery_articles = all_sales.head(10).index.tolist()
        if not coffee_articles:
            coffee_articles = all_sales.head(30).index.tolist()[10:] # Guess

        top_bakery = all_sales[all_sales.index.isin(bakery_articles)].head(10).index.tolist()
        top_coffee = all_sales[all_sales.index.isin(coffee_articles)].head(20).index.tolist()
        top_articles = list(dict.fromkeys(top_bakery + top_coffee))

        self.stdout.write(f"\nTraining models for {len(top_articles)} products:")

        X = create_date_features(daily.index)
        trained_list = []
        all_metrics = []  # Store metrics for each trained model

        for article in top_articles:
            if article not in daily.columns:
                self.stdout.write(f"Skipping {article} (not in data)")
                continue
            y = daily[article]

            split = int(len(X) * 0.8)
            if split < 5: # Need at least 5 data points to train
                self.stdout.write(f"Skipping {article} (not enough data)")
                continue

            # Create train/test split (80/20)
            X_train, X_test = X.iloc[:split], X.iloc[split:]
            y_train, y_test = y.iloc[:split], y.iloc[split:]

            try:
                # Train the model
                model = GradientBoostingRegressor(n_estimators=200, learning_rate=0.05, random_state=42)
                model.fit(X_train, y_train)

                # --- CALCULATE TEST SET METRICS ---
                y_pred_test = model.predict(X_test)

                # Calculate MAE, R², MAPE, and Accuracy on TEST SET
                test_mae = mean_absolute_error(y_test, y_pred_test)
                test_r2 = r2_score(y_test, y_pred_test)
                test_mape = np.mean(np.abs((y_test - y_pred_test) / (y_test + 1))) * 100
                test_accuracy = max(0, 100 - test_mape)

                # Save the model
                safe_name = article.lower().replace(' ', '_').replace('/', '_')
                fname = f"{MODEL_PREFIX}{safe_name}.joblib"

                joblib.dump(model, os.path.join(MODEL_DIR, fname))

                # Store metrics for this model
                article_metrics = {
                    'article': article,
                    'test_mae': round(test_mae, 2),
                    'test_r2': round(test_r2, 4),
                    'test_mape': round(test_mape, 2),
                    'test_accuracy': round(test_accuracy, 2),
                    'train_size': len(X_train),
                    'test_size': len(X_test)
                }
                all_metrics.append(article_metrics)
                trained_list.append(article)

                # Print test metrics to terminal
                self.stdout.write(
                    f"✓ {article:<35} | Test Accuracy: {test_accuracy:>6.2f}% | "
                    f"R²: {test_r2:>6.4f} | MAE: {test_mae:>6.2f}"
                )

            except Exception as e:
                self.stdout.write(f"!! FAILED to train model for {article}: {e}")

        # --- 4. SAVE METADATA ---
        json_path = os.path.join(MODEL_DIR, 'trained_articles.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(trained_list, f, ensure_ascii=False, indent=2)

        # --- 5. SAVE METRICS TO latest_metrics.json ---
        metrics_summary = {
            'trained_date': datetime.now().isoformat(),
            'total_models_trained': len(trained_list),
            'models': all_metrics,
            'average_metrics': {
                'test_accuracy': round(np.mean([m['test_accuracy'] for m in all_metrics]), 2) if all_metrics else 0,
                'test_r2': round(np.mean([m['test_r2'] for m in all_metrics]), 4) if all_metrics else 0,
                'test_mae': round(np.mean([m['test_mae'] for m in all_metrics]), 2) if all_metrics else 0
            }
        }

        metrics_file = save_metrics_json(metrics_summary)
        self.stdout.write(f"\n✓ Metrics saved to: {metrics_file}")

        # Print summary of metrics
        self.stdout.write("\n--- Training Complete! ---")
        self.stdout.write(f"Successfully trained {len(trained_list)} models.")
        if all_metrics:
            self.stdout.write(f"\nAverage Test Metrics:")
            self.stdout.write(f"  Accuracy: {metrics_summary['average_metrics']['test_accuracy']:.2f}%")
            self.stdout.write(f"  R² Score: {metrics_summary['average_metrics']['test_r2']:.4f}")
            self.stdout.write(f"  MAE: {metrics_summary['average_metrics']['test_mae']:.2f}")

        # --- 5. CLEANUP (from train_models.py) ---
        self.stdout.write("\nCleaning up old, unused model files...")
        
        safe_filenames = set()
        for article in trained_list:
            safe_name = article.lower().replace(' ', '_').replace('/', '_')
            fname = f"{MODEL_PREFIX}{safe_name}.joblib"
            safe_filenames.add(fname)
            
        try:
            all_files_in_dir = os.listdir(MODEL_DIR)
        except Exception as e:
            self.stdout.write(f"Error listing files in {MODEL_DIR}: {e}")
            all_files_in_dir = []
            
        deleted_count = 0
        for filename in all_files_in_dir:
            if filename.startswith(MODEL_PREFIX) and filename.endswith('.joblib'):
                if filename not in safe_filenames:
                    try:
                        os.remove(os.path.join(MODEL_DIR, filename))
                        self.stdout.write(f"Removed old model: {filename}")
                        deleted_count += 1
                    except Exception as e:
                        self.stdout.write(f"Could not remove {filename}: {e}")
                            
        self.stdout.write(f"Cleanup complete. Removed {deleted_count} old models.")
        self.stdout.write(self.style.SUCCESS("All models are now up to date."))