# Inventory Monitoring System - Setup Guide

## Overview
The Inventory Monitoring system tracks all inventory movements including:
- Stock In (adding inventory)
- Stock Out (usage from sales/recipes)
- Waste (spoilage, errors)
- Transfers (between main stock and stock room)
- Manual Adjustments

## Initial Setup

### Step 1: Run Database Migrations

First, apply the database migration to create the `pos_inventorytransaction` table:

```bash
cd /path/to/DejaBrew/dejabrew
python manage.py migrate
```

### Step 2: Populate Historical Data

To backfill transaction history from existing orders and waste logs:

```bash
python manage.py populate_inventory_transactions
```

This command will:
- Create STOCK_OUT transactions from all past orders with recipes
- Create WASTE transactions from all waste logs
- Link transactions to their source records (orders, waste logs)

**Optional:** To clear existing transactions and repopulate:
```bash
python manage.py populate_inventory_transactions --clear
```

### Step 3: Access the Monitoring Page

1. Log in to the system (Admin or Staff)
2. Navigate to **Inventory Monitoring** in the sidebar
3. Select your date range and filters
4. View reports and export data

## How It Works

### Automatic Transaction Recording

From now on, all inventory changes are **automatically recorded**:

| Action | Location | Transaction Type |
|--------|----------|------------------|
| Add stock to Main Stock | Inventory page | STOCK_IN |
| Add stock to Stock Room | Stock Room page | STOCK_IN |
| Transfer: Room → Main | Stock Room page | TRANSFER_TO_MAIN |
| Transfer: Main → Room | Inventory page | TRANSFER_TO_ROOM |
| Manual stock removal | Inventory page | ADJUSTMENT |
| Record waste | Waste Inventory | WASTE |
| Process order with recipe | POS | STOCK_OUT |

### Data Sources

The monitoring system fetches data from:
- `pos_inventorytransaction` - Main transaction log
- `pos_ingredient` - Ingredient details (name, unit, cost)
- `pos_order` - Order references
- `pos_wastedlog` - Waste references

## Using the Monitoring Page

### Filtering

1. **Date Range**: Select start and end dates (defaults to last 30 days)
2. **Ingredient**: Filter by specific ingredient
3. **Transaction Type**: Filter by Stock In, Stock Out, Waste, Transfers
4. Click **Apply Filter**

### Viewing Data

**Transactions Tab:**
- Shows all individual transactions
- Includes date/time, ingredient, type, quantity, cost, stock levels
- Sortable and filterable

**By Ingredient Tab:**
- Groups transactions by ingredient
- Shows totals for Stock In, Stock Out, Waste
- Displays current stock levels

### Exporting

Click **Export to Excel** to download a CSV file with:
- All filtered transactions
- Full details (date, ingredient, type, quantity, cost, user, notes)
- Ready to open in Excel or Google Sheets

## Troubleshooting

### No data showing in monitoring page

1. **Check if migration was run:**
   ```bash
   python manage.py showmigrations pos
   ```
   Look for `[X] 0011_inventorytransaction`

2. **Check if table exists:**
   ```bash
   python manage.py dbshell
   .tables
   # Look for pos_inventorytransaction
   .quit
   ```

3. **Run the population command:**
   ```bash
   python manage.py populate_inventory_transactions
   ```

### Transactions not being recorded

Make sure you're performing actions that trigger transactions:
- Edit ingredient stock in Inventory page
- Process orders with recipes (items that use ingredients)
- Record waste
- Transfer stock

### Historical data missing

Run the population command to backfill from existing orders and waste logs:
```bash
python manage.py populate_inventory_transactions
```

## Database Schema

### pos_inventorytransaction Table

| Field | Type | Description |
|-------|------|-------------|
| id | BigInt | Primary key |
| ingredient_id | Foreign Key | Links to pos_ingredient |
| ingredient_name | String | Preserved name |
| transaction_type | String | STOCK_IN, STOCK_OUT, WASTE, TRANSFER_TO_MAIN, TRANSFER_TO_ROOM, ADJUSTMENT |
| quantity | Float | Positive for IN, negative for OUT |
| unit | String | ml, g, pcs, etc. |
| cost_per_unit | Decimal | Cost per unit at time of transaction |
| total_cost | Decimal | Total cost of transaction |
| main_stock_after | Float | Main stock level after transaction |
| stock_room_after | Float | Stock room level after transaction |
| notes | Text | Additional details |
| reference | String | Order ID, Waste Log ID, etc. |
| created_at | DateTime | When transaction occurred |
| user_id | Foreign Key | Who made the change |

## Performance Considerations

The table has indexes on:
- `created_at` (for date range queries)
- `ingredient_id, created_at` (for ingredient-specific queries)
- `transaction_type, created_at` (for type-specific queries)

For large datasets (>100,000 transactions), consider:
- Archiving old transactions
- Using date range filters
- Limiting export sizes

## Support

For issues or questions, check:
1. Django logs: Check for any errors in console
2. Database: Verify table exists and has data
3. Network: Check browser console for API errors
