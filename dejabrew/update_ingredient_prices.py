#!/usr/bin/env python3
"""
Update ingredient prices to realistic Philippine market rates
"""
import sqlite3
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')

# Philippine market-based prices (per unit)
# Researched based on typical bulk/wholesale prices for café operations
price_updates = {
    'Coffee Beans': 0.50,          # ₱500/kg premium beans
    'Milk': 0.10,                  # ₱100/liter fresh milk
    'Sugar': 0.06,                 # ₱60/kg white sugar
    'All-purpose flour': 0.05,     # ₱50/kg flour
    'Butter': 1.25,                # ₱250/200g butter
    'Eggs': 0.20,                  # ₱10/piece (50g per egg)
    'Cream cheese': 0.85,          # ₱170/200g cream cheese
    'Cocoa Powder': 0.70,          # ₱175/250g cocoa
    'Chocolate Syrup': 0.35,       # ₱120/350ml syrup
    'Vanilla extract': 2.80,       # ₱85/30ml vanilla
    'Strawbery': 0.25,             # ₱250/kg strawberries (note: typo in DB)
    'Whipped cream': 0.70,         # ₱175/250ml whipped cream
    'Chicken Breast': 0.24,        # ₱240/kg chicken
    'Condensed milk': 0.14,        # ₱42/300ml condensed milk
    'Ube syrup': 0.30,             # ₱105/350ml ube syrup
    'Biscoff spread': 0.70,        # ₱280/400g Biscoff spread
    'Hot Sauce': 0.45,             # ₱68/150ml hot sauce
    'Cornstarch': 0.09,            # ₱36/400g cornstarch
    'All-purpose cream': 0.18,     # ₱45/250ml cream
    'Blueberry filling': 0.45,     # ₱135/300g blueberry filling
    'Graham crumbs': 0.35,         # ₱70/200g graham crumbs
    'Crushed Biscoff cookies': 0.85,  # ₱170/200g crushed cookies
    'Unsalted butter': 1.25,       # ₱250/200g unsalted butter
    'Skinny Fries': 0.10,          # ₱100/kg frozen fries
    'Ube powder': 1.30,            # ₱130/100g ube powder
    'Yield': 0.50,                 # Keep as is (not sure what this is)
}

def update_prices():
    """Update ingredient prices in the database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("=" * 80)
    print("UPDATING INGREDIENT PRICES TO PHILIPPINE MARKET RATES")
    print("=" * 80)
    print()

    updated_count = 0

    for ingredient_name, new_price in price_updates.items():
        # Get current price
        cursor.execute('SELECT id, cost, unit FROM pos_ingredient WHERE name = ?', (ingredient_name,))
        result = cursor.fetchone()

        if result:
            ing_id, old_price, unit = result

            # Update the price
            cursor.execute('UPDATE pos_ingredient SET cost = ? WHERE id = ?', (new_price, ing_id))

            print(f"✓ {ingredient_name:30} {old_price:>8.2f} → {new_price:>8.2f} /{unit}")
            updated_count += 1
        else:
            print(f"✗ {ingredient_name:30} NOT FOUND")

    conn.commit()
    conn.close()

    print()
    print("=" * 80)
    print(f"Updated {updated_count} ingredients successfully!")
    print("=" * 80)

if __name__ == '__main__':
    update_prices()
