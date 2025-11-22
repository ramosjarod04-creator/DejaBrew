#!/usr/bin/env python
"""
Quick validation script for DejaBrew Forecasting System
Run this to test if your forecasting models are properly set up.
"""
import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'dejabrew'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dejabrew.settings')
django.setup()

from forecasting.forecasting_service import (
    list_available_models,
    load_model_for_article,
    predict_for_item,
    load_kaggle_data,
    load_live_db_data
)
from pos.models import Item
import json


def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80 + "\n")


def test_data_files():
    """Test if CSV data files exist"""
    print_header("1. Testing Data Files")

    data_dir = os.path.join('dejabrew', 'forecasting', 'forecasting_data')
    required_files = ['bakery_sales.csv', 'Coffe_sales.csv']
    optional_files = ['generated_sales.csv', 'generated_sales_sep_nov.csv']

    print("Required files:")
    all_found = True
    for f in required_files:
        path = os.path.join(data_dir, f)
        exists = os.path.exists(path)
        status = "✓" if exists else "✗"
        print(f"  {status} {f}")
        if not exists:
            all_found = False

    print("\nOptional files:")
    for f in optional_files:
        path = os.path.join(data_dir, f)
        exists = os.path.exists(path)
        status = "✓" if exists else "○"
        print(f"  {status} {f}")

    return all_found


def test_trained_models():
    """Test if models are trained and accessible"""
    print_header("2. Testing Trained Models")

    models = list_available_models()

    if not models:
        print("✗ No trained models found!")
        print("\n  Fix: Run one of these commands:")
        print("    - python dejabrew/forecasting/train_models.py")
        print("    - python manage.py retrain_live")
        print("    - Or train in Google Colab and copy .joblib files")
        return False

    print(f"✓ Found {len(models)} trained models:\n")

    # Test loading a few models
    test_count = min(3, len(models))
    success_count = 0

    for i, article in enumerate(models[:test_count], 1):
        model = load_model_for_article(article)
        if model:
            print(f"  ✓ [{i}] {article} - Model loaded successfully")
            success_count += 1
        else:
            print(f"  ✗ [{i}] {article} - Failed to load model")

    if success_count < test_count:
        print(f"\n⚠ Warning: {test_count - success_count}/{test_count} models failed to load")
        return False

    print(f"\n  Total trained products: {len(models)}")
    if len(models) > 3:
        print(f"  (showing first 3, see trained_articles.json for full list)")

    return True


def test_database_items():
    """Test if database items can be mapped to trained models"""
    print_header("3. Testing Database Integration")

    models = list_available_models()
    if not models:
        print("⊘ Skipped (no models found)")
        return False

    items = Item.objects.filter(is_active=True)
    item_count = items.count()

    if item_count == 0:
        print("⚠ Warning: No active items in database")
        print("  Add items in Django admin: /admin/pos/item/")
        return False

    print(f"Found {item_count} active items in database\n")

    # Test mapping for first 5 items
    test_items = items[:5]
    mapped_count = 0

    for item in test_items:
        from forecasting.forecasting_service import map_item_to_article
        article = map_item_to_article(item.name)

        if article:
            print(f"  ✓ {item.name} → {article}")
            mapped_count += 1
        else:
            print(f"  ✗ {item.name} → No model found")

    if mapped_count == 0:
        print("\n⚠ Warning: No database items map to trained models")
        print("\n  Fix: Add product_mapping.json with your item mappings:")
        print('    {"Your Item Name": "Trained Article Name"}')
        return False

    print(f"\n  Mapped: {mapped_count}/{len(test_items)} items tested")
    return True


def test_predictions():
    """Test if predictions work"""
    print_header("4. Testing Predictions")

    models = list_available_models()
    if not models:
        print("⊘ Skipped (no models found)")
        return False

    # Test with first available model
    test_article = models[0]
    print(f"Testing prediction for: {test_article}\n")

    try:
        predictions = predict_for_item(test_article, days=7, period='daily')

        if predictions:
            print(f"✓ Prediction successful!\n")
            print("  Sample predictions:")
            for i, pred in enumerate(predictions[:3], 1):
                print(f"    Day {i}: {pred['date']} → {pred['predicted_quantity']} units")

            if len(predictions) > 3:
                print(f"    ... ({len(predictions) - 3} more days)")

            return True
        else:
            print("✗ Prediction returned None")
            return False

    except Exception as e:
        print(f"✗ Prediction failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_kaggle_data_loading():
    """Test if Kaggle data can be loaded"""
    print_header("5. Testing Kaggle Data Loading")

    try:
        df, bakery_articles, coffee_articles = load_kaggle_data()

        if df is not None and len(df) > 0:
            print(f"✓ Successfully loaded Kaggle data")
            print(f"  Total records: {len(df)}")
            print(f"  Bakery articles: {len(bakery_articles)}")
            print(f"  Coffee articles: {len(coffee_articles)}")
            print(f"  Date range: {df['date'].min()} to {df['date'].max()}")
            return True
        else:
            print("⚠ No Kaggle data loaded (this is OK if you haven't added CSV files yet)")
            return False

    except Exception as e:
        print(f"✗ Failed to load Kaggle data: {str(e)}")
        return False


def test_live_db_data():
    """Test if live database data can be loaded"""
    print_header("6. Testing Live Database Data")

    try:
        df = load_live_db_data()

        if len(df) > 0:
            print(f"✓ Successfully loaded live database data")
            print(f"  Total records: {len(df)}")
            print(f"  Date range: {df['date'].min()} to {df['date'].max()}")
            print(f"  Unique products: {df['article'].nunique()}")
            return True
        else:
            print("⚠ No sales data in database yet")
            print("  This is normal for new installations")
            print("  Sales data will accumulate as you process orders")
            return False

    except Exception as e:
        print(f"✗ Failed to load database data: {str(e)}")
        return False


def print_summary(results):
    """Print final summary"""
    print_header("SUMMARY")

    total = len(results)
    passed = sum(results.values())

    print("Test Results:")
    for test_name, passed_test in results.items():
        status = "✓ PASS" if passed_test else "✗ FAIL"
        print(f"  {status} - {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! Your forecasting system is ready to use.")
        print("\nNext steps:")
        print("  1. Visit your dashboard: http://localhost:8000/")
        print("  2. Try the API: http://localhost:8000/forecasting/api/predict/?days=7")
        print("  3. Check FORECASTING_SETUP.md for detailed usage instructions")
    else:
        print("\n⚠ Some tests failed. Please fix the issues above.")
        print("\nQuick fixes:")
        print("  - Missing data files? Add CSV files to forecasting/forecasting_data/")
        print("  - No models? Run: python dejabrew/forecasting/train_models.py")
        print("  - No database items? Add items in Django admin: /admin/pos/item/")


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("  DejaBrew Forecasting System - Validation Test")
    print("=" * 80)

    results = {}

    # Run tests
    results["Data Files"] = test_data_files()
    results["Trained Models"] = test_trained_models()
    results["Database Integration"] = test_database_items()
    results["Predictions"] = test_predictions()
    results["Kaggle Data Loading"] = test_kaggle_data_loading()
    results["Live Database Data"] = test_live_db_data()

    # Print summary
    print_summary(results)

    print("\n" + "=" * 80 + "\n")


if __name__ == '__main__':
    main()
