#!/usr/bin/env python
"""
Script to update all existing GCash and Card orders with a default reference number
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dejabrew.settings')
django.setup()

from pos.models import Order

def update_reference_numbers():
    """Update all GCash and Card orders that have empty or null reference numbers"""

    default_ref = "1234567890909"

    # Find all orders with GCash or Card payment that don't have reference numbers
    orders_to_update = Order.objects.filter(
        payment_method__in=['GCash', 'gcash', 'Card', 'card']
    ).filter(
        Q(reference_number__isnull=True) | Q(reference_number='')
    )

    total_count = orders_to_update.count()

    if total_count == 0:
        print("✓ All GCash and Card orders already have reference numbers!")
        return

    print(f"Found {total_count} GCash/Card orders without reference numbers")
    print(f"Updating all to reference number: {default_ref}")

    # Update all orders
    updated = orders_to_update.update(reference_number=default_ref)

    print(f"✓ Successfully updated {updated} orders with reference number")

    # Verify the update
    remaining = Order.objects.filter(
        payment_method__in=['GCash', 'gcash', 'Card', 'card']
    ).filter(
        Q(reference_number__isnull=True) | Q(reference_number='')
    ).count()

    if remaining == 0:
        print("✓ All GCash and Card orders now have reference numbers!")
    else:
        print(f"⚠ Warning: {remaining} orders still have empty reference numbers")

if __name__ == '__main__':
    from django.db.models import Q
    update_reference_numbers()
