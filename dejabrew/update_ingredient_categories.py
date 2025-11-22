#!/usr/bin/env python3
"""
Update ingredient categories to more specific classifications
"""
import sqlite3
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')

# Category mappings for ingredients
category_updates = {
    # Dairy products
    'All-purpose cream': 'Dairy',
    'Cream cheese': 'Dairy',
    'Butter': 'Dairy',
    'Unsalted butter': 'Dairy',
    'Eggs': 'Dairy',
    'Milk': 'Dairy',
    'Whipped cream': 'Dairy',
    'Condensed milk': 'Dairy',

    # Coffee & Beverages
    'Coffee Beans': 'Coffee',

    # Baking & Cooking
    'All-purpose flour': 'Flour',
    'Cornstarch': 'Flour',
    'Cocoa Powder': 'Baking',
    'Graham crumbs': 'Baking',

    # Sweeteners & Syrups
    'Sugar': 'Sweetener',
    'Chocolate Syrup': 'Syrup',
    'Ube syrup': 'Syrup',

    # Flavoring & Extracts
    'Vanilla extract': 'Flavoring',
    'Ube powder': 'Flavoring',

    # Cookies & Biscuits
    'Biscoff spread': 'Cookies',
    'Crushed Biscoff cookies': 'Cookies',

    # Fruits & Fillings
    'Blueberry filling': 'Fruit Filling',
    'Strawbery': 'Fruit',

    # Meat
    'Chicken Breast': 'Meat',

    # Condiments & Sauces
    'Hot Sauce': 'Sauce',

    # Frozen Foods
    'Skinny Fries': 'Frozen Food',

    # Other/Uncategorized
    'Yield': 'Other',
}

def update_categories():
    """Update ingredient categories in the database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("=" * 80)
    print("UPDATING INGREDIENT CATEGORIES")
    print("=" * 80)
    print()

    updated_count = 0

    for ingredient_name, new_category in category_updates.items():
        # Get current category
        cursor.execute('SELECT id, category FROM pos_ingredient WHERE name = ?', (ingredient_name,))
        result = cursor.fetchone()

        if result:
            ing_id, old_category = result

            # Update the category
            cursor.execute('UPDATE pos_ingredient SET category = ? WHERE id = ?', (new_category, ing_id))

            print(f"✓ {ingredient_name:<30} {old_category or '(none)':<15} → {new_category}")
            updated_count += 1
        else:
            print(f"✗ {ingredient_name:<30} NOT FOUND")

    conn.commit()
    conn.close()

    print()
    print("=" * 80)
    print(f"Updated {updated_count} ingredient categories successfully!")
    print("=" * 80)
    print()

    # Show final category distribution
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT category, COUNT(*) as count
        FROM pos_ingredient
        GROUP BY category
        ORDER BY category
    ''')

    print("Category Distribution:")
    print("-" * 40)
    for cat, count in cursor.fetchall():
        print(f"  {cat or '(no category)':<20} {count:>3} ingredients")

    conn.close()

if __name__ == '__main__':
    update_categories()
