#!/usr/bin/env python
"""
Script to update all existing orders with dining_option = 'dine-in'
This ensures all historical orders have the dining_option field populated.
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dejabrew.settings')
django.setup()

from pos.models import Order

def update_orders():
    """Update all orders that have empty or null dining_option"""

    # Count orders that need updating
    orders_to_update = Order.objects.filter(dining_option__in=['', None])
    total_count = orders_to_update.count()

    if total_count == 0:
        print("✓ All orders already have dining_option set!")
        return

    print(f"Found {total_count} orders without dining_option")
    print("Updating all to 'dine-in'...")

    # Update all orders to have dining_option = 'dine-in'
    updated = orders_to_update.update(dining_option='dine-in')

    print(f"✓ Successfully updated {updated} orders with dining_option='dine-in'")

    # Verify the update
    remaining = Order.objects.filter(dining_option__in=['', None]).count()
    if remaining == 0:
        print("✓ All orders now have dining_option set!")
    else:
        print(f"⚠ Warning: {remaining} orders still have empty dining_option")

if __name__ == '__main__':
    update_orders()
