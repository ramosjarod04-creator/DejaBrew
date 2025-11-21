"""
Django management command to populate InventoryTransaction table from historical data
Backfills data from existing orders and waste logs
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from pos.models import Order, OrderItem, WastedLog, InventoryTransaction, Ingredient
from decimal import Decimal
from django.utils import timezone


class Command(BaseCommand):
    help = 'Populate InventoryTransaction table from historical orders and waste logs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing transactions before populating',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting inventory transaction population...'))

        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing transactions...'))
            InventoryTransaction.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Existing transactions cleared'))

        # Counter for statistics
        stock_out_count = 0
        waste_count = 0
        errors = 0

        # Process historical orders for STOCK_OUT transactions
        self.stdout.write('\n' + self.style.WARNING('Processing orders for ingredient usage...'))

        orders = Order.objects.filter(status='paid').prefetch_related('items__item').order_by('created_at')

        for order in orders:
            try:
                with transaction.atomic():
                    for order_item in order.items.all():
                        item = order_item.item

                        # Check if item has a recipe
                        if isinstance(item.recipe, list) and len(item.recipe) > 0:
                            for recipe_ingredient in item.recipe:
                                ingredient_name = recipe_ingredient.get('ingredient')
                                quantity_per_item = recipe_ingredient.get('quantity', 0)

                                if ingredient_name and quantity_per_item > 0:
                                    try:
                                        ingredient = Ingredient.objects.get(name=ingredient_name)

                                        total_quantity = float(quantity_per_item) * order_item.qty

                                        # Create STOCK_OUT transaction
                                        InventoryTransaction.objects.create(
                                            ingredient=ingredient,
                                            ingredient_name=ingredient.name,
                                            transaction_type='STOCK_OUT',
                                            quantity=-total_quantity,  # Negative for stock out
                                            unit=ingredient.unit,
                                            cost_per_unit=ingredient.cost,
                                            total_cost=Decimal(str(total_quantity)) * ingredient.cost,
                                            main_stock_after=ingredient.mainStock,
                                            stock_room_after=ingredient.stockRoom,
                                            notes=f"Used in order (recipe for {item.name})",
                                            reference=f"Order-{order.id}",
                                            user=order.cashier,
                                            created_at=order.created_at
                                        )

                                        stock_out_count += 1

                                    except Ingredient.DoesNotExist:
                                        self.stdout.write(
                                            self.style.WARNING(
                                                f'  Ingredient "{ingredient_name}" not found for order {order.id}'
                                            )
                                        )
                                        errors += 1
                                        continue

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  Error processing order {order.id}: {str(e)}')
                )
                errors += 1

        self.stdout.write(
            self.style.SUCCESS(f'✓ Created {stock_out_count} STOCK_OUT transactions from orders')
        )

        # Process waste logs for WASTE transactions
        self.stdout.write('\n' + self.style.WARNING('Processing waste logs...'))

        waste_logs = WastedLog.objects.all().order_by('wasted_at')

        for waste_log in waste_logs:
            try:
                with transaction.atomic():
                    # Get current ingredient or use preserved name
                    ingredient = waste_log.ingredient

                    if ingredient:
                        # Create WASTE transaction
                        InventoryTransaction.objects.create(
                            ingredient=ingredient,
                            ingredient_name=waste_log.ingredient_name,
                            transaction_type='WASTE',
                            quantity=-waste_log.quantity,  # Negative for waste
                            unit=waste_log.unit,
                            cost_per_unit=waste_log.cost_at_waste / Decimal(str(waste_log.quantity)) if waste_log.quantity > 0 else Decimal('0'),
                            total_cost=waste_log.cost_at_waste,
                            main_stock_after=ingredient.mainStock,
                            stock_room_after=ingredient.stockRoom,
                            notes=f"Waste recorded: {waste_log.reason}",
                            reference=f"WasteLog-{waste_log.id}",
                            user=waste_log.user,
                            created_at=waste_log.wasted_at
                        )

                        waste_count += 1
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  Ingredient for waste log {waste_log.id} no longer exists'
                            )
                        )
                        errors += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  Error processing waste log {waste_log.id}: {str(e)}')
                )
                errors += 1

        self.stdout.write(
            self.style.SUCCESS(f'✓ Created {waste_count} WASTE transactions from waste logs')
        )

        # Summary
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('SUMMARY:'))
        self.stdout.write(f'  Stock Out Transactions: {stock_out_count}')
        self.stdout.write(f'  Waste Transactions: {waste_count}')
        self.stdout.write(f'  Total Transactions Created: {stock_out_count + waste_count}')
        if errors > 0:
            self.stdout.write(self.style.WARNING(f'  Errors: {errors}'))
        self.stdout.write('=' * 70)

        self.stdout.write('\n' + self.style.SUCCESS('✓ Inventory transaction population complete!'))
        self.stdout.write(
            self.style.SUCCESS('  You can now view historical data in the Inventory Monitoring page')
        )
