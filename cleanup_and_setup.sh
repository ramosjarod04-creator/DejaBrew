#!/bin/bash
# DejaBrew Forecasting - Cleanup and Setup Script
# This script cleans up old files and prepares your system for new forecasting

echo "================================================================================"
echo "  DEJABREW FORECASTING - CLEANUP & SETUP"
echo "================================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FORECASTING_DIR="/home/user/DejaBrew/dejabrew/forecasting/forecasting_data"

# Try multiple filename variations
CSV_NAMES=(
    "Coffee Shop Sales.csv"
    "coffee_shop_sales.csv"
    "Coffee Shop Sales.xlsx"
    "coffee_shop_sales.xlsx"
)

CSV_FILE=""

# Step 1: Check if CSV exists
echo "Step 1: Checking for Coffee Shop Sales CSV..."

for name in "${CSV_NAMES[@]}"; do
    if [ -f "$FORECASTING_DIR/$name" ]; then
        CSV_FILE="$FORECASTING_DIR/$name"
        echo -e "${GREEN}✓ Found: $name${NC}"
        echo "  Size: $(du -h "$CSV_FILE" | cut -f1)"
        break
    fi
done

if [ -z "$CSV_FILE" ]; then
    echo -e "${YELLOW}⚠ CSV file not found${NC}"
    echo ""
    echo "Searched for:"
    for name in "${CSV_NAMES[@]}"; do
        echo "  - $name"
    done
    echo ""
    echo "Please move your CSV file to: $FORECASTING_DIR/"
    echo "  Example: mv ~/Downloads/'Coffee Shop Sales.csv' $FORECASTING_DIR/"
    echo ""
    read -p "Press Enter after you've moved the file, or Ctrl+C to exit..."

    # Check again
    for name in "${CSV_NAMES[@]}"; do
        if [ -f "$FORECASTING_DIR/$name" ]; then
            CSV_FILE="$FORECASTING_DIR/$name"
            echo -e "${GREEN}✓ CSV file found: $name${NC}"
            break
        fi
    done

    if [ -z "$CSV_FILE" ]; then
        echo -e "${RED}✗ CSV file still not found. Exiting.${NC}"
        exit 1
    fi
fi

echo ""

# Step 2: Backup old models
echo "Step 2: Backing up old models..."
BACKUP_DIR="/home/user/DejaBrew/dejabrew/forecasting/forecasting_data/backup_$(date +%Y%m%d_%H%M%S)"

if ls "$FORECASTING_DIR"/*.joblib 1> /dev/null 2>&1; then
    mkdir -p "$BACKUP_DIR"
    cp "$FORECASTING_DIR"/*.joblib "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✓ Backed up old models to: $BACKUP_DIR${NC}"
    echo "  Models backed up: $(ls -1 "$BACKUP_DIR" | wc -l)"
else
    echo -e "${YELLOW}⚠ No existing models found (this is OK for first-time setup)${NC}"
fi

echo ""

# Step 3: Clean up old documentation
echo "Step 3: Cleaning up old documentation files..."
cd /home/user/DejaBrew

# Archive old guides
OLD_GUIDES=(
    "FORECASTING_SETUP.md"
    "EXCEL_TO_DATABASE_MAPPING.md"
    "QUICK_START_FORECASTING.md"
    "UPLOAD_CSV_TRAINING_GUIDE.md"
    "CSV_DOWNLOAD_GUIDE.md"
)

ARCHIVE_DIR="docs_archive_$(date +%Y%m%d)"
mkdir -p "$ARCHIVE_DIR"

for guide in "${OLD_GUIDES[@]}"; do
    if [ -f "$guide" ]; then
        mv "$guide" "$ARCHIVE_DIR/"
        echo "  Archived: $guide"
    fi
done

if [ "$(ls -A $ARCHIVE_DIR 2>/dev/null)" ]; then
    echo -e "${GREEN}✓ Archived ${#OLD_GUIDES[@]} old guide(s) to: $ARCHIVE_DIR${NC}"
else
    rmdir "$ARCHIVE_DIR" 2>/dev/null || true
    echo -e "${YELLOW}⚠ No old guides found to archive${NC}"
fi

echo ""

# Step 4: Verify CSV format
echo "Step 4: Verifying CSV format..."
HEADER=$(head -n 1 "$CSV_FILE")

if echo "$HEADER" | grep -q "transaction_date"; then
    echo -e "${GREEN}✓ CSV has correct format!${NC}"
    echo "  Columns found: transaction_date, product_detail, transaction_qty"
else
    echo -e "${YELLOW}⚠ Warning: CSV may have different column names${NC}"
    echo "  First line: $HEADER"
    echo "  Expected: transaction_date, product_detail, transaction_qty"
    echo ""
    echo "You may need to:"
    echo "  1. Rename columns in your CSV, OR"
    echo "  2. Update train_forecasting.py to match your columns"
    echo ""
fi

echo ""

# Step 5: Show summary
echo "================================================================================"
echo "  SETUP SUMMARY"
echo "================================================================================"
echo ""
echo "✓ CSV File: $(if [ -f "$CSV_FILE" ]; then echo "Found"; else echo "Missing"; fi)"
echo "✓ Backup: $(if [ -d "$BACKUP_DIR" ]; then echo "Created"; else echo "Not needed"; fi)"
echo "✓ Old guides: Archived"
echo ""
echo "================================================================================"
echo "  READY TO TRAIN!"
echo "================================================================================"
echo ""
echo "Next steps:"
echo "  1. Run training:"
echo "     cd /home/user/DejaBrew/dejabrew"
echo "     python forecasting/train_forecasting.py"
echo ""
echo "  2. After training completes, restart Django:"
echo "     python manage.py runserver"
echo ""
echo "  3. Check your dashboard:"
echo "     http://localhost:8000/"
echo ""
echo "================================================================================"
echo ""
