from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from .models import Item, Order, OrderItem, AuditTrail, UserProfile, Ingredient, WastedLog, InventoryTransaction
from .serializers import ItemSerializer, OrderSerializer, IngredientSerializer
from django.http import JsonResponse, QueryDict
from django.core.serializers import serialize
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from datetime import timedelta, datetime
import json
from collections import defaultdict
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
from django.db import transaction
from decimal import Decimal
from django.template.loader import render_to_string
import os
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import time


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class IngredientViewSet(viewsets.ModelViewSet):
    queryset = Ingredient.objects.all().order_by('name')
    serializer_class = IngredientSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ['update', 'partial_update']:
             return [IsAuthenticated()]
        if self.action in ['create', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_audit(
            self.request, self.request.user, "Create Ingredient",
            f"User '{self.request.user.username}' created ingredient '{instance.name}'",
            category="inventory", severity="medium"
        )

    def perform_update(self, serializer):
        instance = self.get_object()

        old_mainStock = instance.mainStock
        old_stockRoom = instance.stockRoom
        old_status = instance.status
        old_name = instance.name
        old_cost = instance.cost
        old_ingredient_type = instance.ingredient_type

        is_admin = self.request.user.is_superuser or (hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'admin')

        if not is_admin:
            allowed_updates = {'status'}
            if not set(serializer.validated_data.keys()).issubset(allowed_updates):
                 from rest_framework.exceptions import PermissionDenied
                 raise PermissionDenied("Staff members can only update the ingredient status.")

        serializer.save()

        instance.refresh_from_db()

        changes = []
        action = "Update Ingredient"
        severity = "medium"

        # Track inventory transactions for stock changes
        if old_mainStock != instance.mainStock and old_stockRoom != instance.stockRoom:
            # This is a transfer between locations
            action = "Stock Transfer"
            severity = "low"
            changes.append(f"mainStock: {old_mainStock} -> {instance.mainStock}")
            changes.append(f"stockRoom: {old_stockRoom} -> {instance.stockRoom}")

            # Determine transfer direction
            main_diff = instance.mainStock - old_mainStock
            if main_diff > 0:
                # Transfer from stock room to main
                create_inventory_transaction(
                    ingredient=instance,
                    transaction_type='TRANSFER_TO_MAIN',
                    quantity=main_diff,
                    user=self.request.user,
                    notes=f"Transferred {main_diff}{instance.unit} from stock room to main stock"
                )
            else:
                # Transfer from main to stock room
                create_inventory_transaction(
                    ingredient=instance,
                    transaction_type='TRANSFER_TO_ROOM',
                    quantity=abs(main_diff),
                    user=self.request.user,
                    notes=f"Transferred {abs(main_diff)}{instance.unit} from main stock to stock room"
                )

        else:
            if old_mainStock != instance.mainStock:
                changes.append(f"mainStock: {old_mainStock} -> {instance.mainStock}")
                stock_diff = instance.mainStock - old_mainStock

                if stock_diff > 0:
                    # Stock added to main
                    create_inventory_transaction(
                        ingredient=instance,
                        transaction_type='STOCK_IN',
                        quantity=stock_diff,
                        user=self.request.user,
                        notes=f"Added {stock_diff}{instance.unit} to main stock"
                    )
                else:
                    # Stock removed from main (manual adjustment)
                    create_inventory_transaction(
                        ingredient=instance,
                        transaction_type='ADJUSTMENT',
                        quantity=stock_diff,
                        user=self.request.user,
                        notes=f"Manual adjustment: removed {abs(stock_diff)}{instance.unit} from main stock"
                    )

            if old_stockRoom != instance.stockRoom:
                changes.append(f"stockRoom: {old_stockRoom} -> {instance.stockRoom}")
                stock_diff = instance.stockRoom - old_stockRoom

                if stock_diff > 0:
                    # Stock added to room
                    create_inventory_transaction(
                        ingredient=instance,
                        transaction_type='STOCK_IN',
                        quantity=stock_diff,
                        user=self.request.user,
                        notes=f"Added {stock_diff}{instance.unit} to stock room"
                    )
                else:
                    # Stock removed from room (manual adjustment)
                    create_inventory_transaction(
                        ingredient=instance,
                        transaction_type='ADJUSTMENT',
                        quantity=stock_diff,
                        user=self.request.user,
                        notes=f"Manual adjustment: removed {abs(stock_diff)}{instance.unit} from stock room"
                    )

        if old_status != instance.status:
            changes.append(f"status: '{old_status}' -> '{instance.status}'")
            if not changes:
                action = "Update Ingredient Status"
                if instance.status == 'Out of Stock':
                    severity = 'high'
        
        if is_admin:
             if old_name != instance.name:
                changes.append(f"name: '{old_name}' -> '{instance.name}'")
             if old_cost != instance.cost:
                changes.append(f"cost: ₱{old_cost} -> ₱{instance.cost}")
             if old_ingredient_type != instance.ingredient_type:
                changes.append(f"type: '{old_ingredient_type}' -> '{instance.ingredient_type}'")
        
        if changes:
            change_description = ", ".join(changes)
            log_audit(
                self.request, self.request.user, action,
                f"User '{self.request.user.username}' updated '{instance.name}': {change_description}",
                category="inventory", severity=severity
            )

    def perform_destroy(self, instance):
        ingredient_name = instance.name
        instance.delete()
        log_audit(
            self.request, self.request.user, "Delete Ingredient",
            f"User '{self.request.user.username}' deleted ingredient '{ingredient_name}'",
            category="inventory", severity="high"
        )


class ItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Item.objects.filter(is_active=True).order_by('id')
    serializer_class = ItemSerializer
    pagination_class = StandardResultsSetPagination
    permission_classes = [AllowAny]


class OrderViewSet(viewsets.ModelViewSet):
    queryset = (
        Order.objects.all()
        .order_by('-created_at')
        .select_related('cashier')
        .prefetch_related('items__item')
    )
    serializer_class = OrderSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [AllowAny()]


def require_admin_access(request, fallback_url='staff_dashboard'):
    if not request.user.is_authenticated:
        return redirect('login')
    try:
        is_admin = request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'admin')
        if is_admin:
            return True
    except UserProfile.DoesNotExist:
        pass
    messages.warning(request, 'Access denied. Admin privileges required.')
    if hasattr(request.user, 'profile') and request.user.profile.role == 'staff':
        return redirect(fallback_url)
    return redirect('login')


def log_audit(request, user, action, description, category="system", severity="low"):
    try:
        ip_address = None
        if request:
            ip_address = get_client_ip(request)
        
        AuditTrail.objects.create(
            user=user, action=action, description=description,
            ip_address=ip_address, category=category, severity=severity,
        )
    except Exception as e:
        print(f"⚠️ Audit log error: {e}")


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR', 'Unknown')


def create_inventory_transaction(ingredient, transaction_type, quantity, user, notes="", reference=""):
    """
    Helper function to create an InventoryTransaction record

    Args:
        ingredient: Ingredient instance
        transaction_type: One of the TRANSACTION_TYPE_CHOICES
        quantity: Float (positive for IN, negative for OUT)
        user: User instance
        notes: Optional notes
        reference: Optional reference (Order ID, Waste Log ID, etc.)
    """
    try:
        # Get fresh stock levels
        ingredient.refresh_from_db()

        transaction = InventoryTransaction.objects.create(
            ingredient=ingredient,
            ingredient_name=ingredient.name,
            transaction_type=transaction_type,
            quantity=quantity,
            unit=ingredient.unit,
            cost_per_unit=ingredient.cost,
            total_cost=Decimal(str(abs(quantity))) * ingredient.cost,
            main_stock_after=ingredient.mainStock,
            stock_room_after=ingredient.stockRoom,
            notes=notes,
            reference=reference,
            user=user
        )
        print(f"✓ Created {transaction_type} transaction for {ingredient.name}: {quantity}{ingredient.unit}")
        return transaction
    except Exception as e:
        print(f"⚠️ Failed to create inventory transaction for {ingredient.name}: {e}")
        import traceback
        traceback.print_exc()
        raise  # Re-raise the exception so we can see it


def save_receipt_to_file(order, order_items_list, subtotal, discount, discount_amount, total, payment_method, 
                         vatable_amount=None, vat_amount=None, discount_type='regular', discount_id=''):
    try:
        receipt_context = {
            'order': order,
            'order_items': order_items_list,
            'subtotal': subtotal,
            'vatable_amount': vatable_amount,
            'vat_amount': vat_amount,
            'discount_type': discount_type,
            'discount_id': discount_id,
            'discount_percent': discount,
            'discount_amount': discount_amount,
            'total': total,
            'payment_method': payment_method
        }
        
        receipt_html = render_to_string('pos/receipt/_receipt_template.html', receipt_context)
        
        receipt_dir = os.path.join(settings.BASE_DIR, 'pos', 'static', 'pos', 'receipt')
        
        os.makedirs(receipt_dir, exist_ok=True)
        
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        filename = f'receipt_order_{order.id}_{timestamp}.html'
        filepath = os.path.join(receipt_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(receipt_html)
        
        return f'pos/receipt/{filename}'
        
    except Exception as e:
        print(f"⚠️ Error saving receipt to file: {e}")
        return None


def handle_uploaded_file(f):
    try:
        save_dir = os.path.join(settings.BASE_DIR, 'pos', 'static', 'pos', 'img')
        os.makedirs(save_dir, exist_ok=True)
        
        fname, ext = os.path.splitext(f.name)
        safe_fname = "".join(c for c in fname if c.isalnum() or c in ('_','-')).rstrip()
        unique_filename = f"{safe_fname}_{int(time.time())}{ext}"
        
        save_path = os.path.join(save_dir, unique_filename)

        with default_storage.open(save_path, 'wb+') as destination:
            for chunk in f.chunks():
                destination.write(chunk)
        
        url_path = f'/static/pos/img/{unique_filename}'
        return url_path
        
    except Exception as e:
        print(f"⚠️ Error saving uploaded file: {e}")
        return None

def login_view(request):
    if request.user.is_authenticated:
        try:
            is_admin = request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'admin')
            if is_admin:
                return redirect('dashboard')
            elif hasattr(request.user, 'profile') and request.user.profile.role == 'staff':
                 return redirect('staff_dashboard')
            else:
                 return redirect('cashier_pos')
        except UserProfile.DoesNotExist:
             return redirect('cashier_pos')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            log_audit(request, user, "Login", f"User '{user.username}' logged in", category="auth")
            try:
                is_admin = user.is_superuser or (hasattr(user, 'profile') and user.profile.role == 'admin')
                if is_admin:
                    return redirect('dashboard')
                elif hasattr(user, 'profile') and user.profile.role == 'staff':
                    return redirect('staff_dashboard')
                else:
                    return redirect('cashier_pos')
            except UserProfile.DoesNotExist:
                 return redirect('cashier_pos')
        else:
            messages.error(request, 'Invalid Username or Password!')
    return render(request, 'login.html')


@login_required
def logout_view(request):
    user = request.user
    log_audit(request, user, "Logout", f"User '{user.username}' logged out", category="auth")
    logout(request)
    messages.success(request, 'You have been logged out successfully.')
    return redirect('login')


@login_required
def dashboard(request):
    admin_check = require_admin_access(request, 'staff_dashboard')
    if admin_check is not True:
        return admin_check

    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')
    
    if not start_date_str or not end_date_str:
        today = timezone.now().date()
        today_str = today.isoformat()
        
        query_params = QueryDict(mutable=True)
        query_params['start_date'] = today_str
        query_params['end_date'] = today_str
        
        return redirect(f"{request.path}?{query_params.urlencode()}")

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        today = timezone.now().date()
        start_date = today
        end_date = today
        start_date_str = today.isoformat()
        end_date_str = today.isoformat()

    filter_start = timezone.make_aware(timezone.datetime.combine(start_date, timezone.datetime.min.time()))
    filter_end = timezone.make_aware(timezone.datetime.combine(end_date, timezone.datetime.max.time()))

    paid_orders = Order.objects.filter(status='paid', created_at__range=[filter_start, filter_end])
    
    total_sales_count = paid_orders.count()
    total_revenue = paid_orders.aggregate(total_sum=Sum('total'))['total_sum'] or 0
    
    top_product = OrderItem.objects.filter(
        order__status='paid', 
        order__created_at__range=[filter_start, filter_end]
    ).values('item__name').annotate(
        total_qty=Sum('qty'), 
        total_value=Sum(F('qty') * F('price_at_order'))
    ).order_by('-total_qty').first()

    low_stock_ingredients = Ingredient.objects.filter(
        Q(mainStock__lte=F('reorder'), mainStock__gt=0) | Q(mainStock=0, stockRoom__gt=0)
    ).values_list('name', 'mainStock', 'status')
    low_stock_products = Item.objects.filter(
        is_active=True, 
        stock__lte=10
    ).values_list('name', 'stock', 'recipe')
    low_stock_warnings = []
    for name, stock, status in low_stock_ingredients:
        low_stock_warnings.append({'name': f"{name} (Ingredient)", 'stock': stock, 'status': status})
    for name, stock, recipe in low_stock_products:
        status_str = "Low Stock" if stock > 0 else "Out of Stock"
        label = "(Recipe Product)" if (recipe and len(recipe) > 0) else "(Product)"
        low_stock_warnings.append({'name': f"{name} {label}", 'stock': stock, 'status': status_str})
    low_stock_warnings.sort(key=lambda x: x['stock'])
    low_stock_items_count = len(low_stock_warnings)
    
    admin_user_q = Q(cashier__is_superuser=True) | Q(cashier__profile__role='admin')
    
    staff_sales_query = Order.objects.filter(
        status='paid', 
        created_at__range=[filter_start, filter_end]
    ).exclude(admin_user_q)

    top_staff = staff_sales_query.values(
        'cashier__username'
    ).annotate(
        total_sales=Sum('total'),
        total_orders=Count('id')
    ).order_by('-total_sales').first()
    
    all_staff_sales = staff_sales_query.values(
        'cashier__username'
    ).annotate(
        total_sales=Sum('total'),
        total_orders=Count('id')
    ).order_by('-total_sales')

    recent_transactions = Order.objects.filter(status='paid').select_related('cashier').order_by('-created_at')[:50]
    
    context = { 
        'username': request.user.username, 
        'total_sales_count': total_sales_count, 
        'total_revenue': total_revenue, 
        'low_stock_items': low_stock_items_count,
        'top_staff': top_staff,
        'all_staff_sales': all_staff_sales,
        'top_product': top_product, 
        'recent_transactions': recent_transactions,
        'low_stock_warnings': low_stock_warnings,
        'user_role': 'admin',
        'start_date_str': start_date_str,
        'end_date_str': end_date_str
    }
    return render(request, 'dashboard.html', context)

@login_required
def staff_dashboard(request):
    if not request.user.is_authenticated:
        return redirect('login')
    try:
        is_admin = request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'admin')
        if is_admin:
            messages.info(request, "Admins should use the main dashboard.")
            return redirect('dashboard')
    except UserProfile.DoesNotExist:
        if request.user.is_superuser:
             messages.info(request, "Admins should use the main dashboard.")
             return redirect('dashboard')
    
    today = timezone.localtime(timezone.now()).date()
    today_start = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
    today_end = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.max.time()))
    
    my_sales_today = Order.objects.filter(
        cashier=request.user, 
        status='paid', 
        created_at__range=[today_start, today_end]
    )
    
    my_sales_count = my_sales_today.count()
    my_revenue_today = my_sales_today.aggregate(total=Sum('total'))['total'] or 0
    my_recent_transactions = Order.objects.filter(cashier=request.user, status='paid').order_by('-created_at')[:5]
    
    context = { 
        'username': request.user.username, 
        'my_sales_count': my_sales_count, 
        'my_revenue_today': my_revenue_today, 
        'my_recent_transactions': my_recent_transactions, 
        'is_staff_dashboard': True, 
        'user_role': 'staff' 
    }
    return render(request, 'staff_dashboard.html', context)


@login_required
def dashboard_sales_data(request):
    end_date_str = request.GET.get('end_date')
    try:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        end_date = timezone.now().date()

    period = request.GET.get('period', 'daily')
    sales_data = []
    base_queryset = Order.objects.filter(status='paid')
    try:
        if period == 'daily':
            start_date = end_date - timedelta(days=6)
            queryset = base_queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
            sales_by_period = queryset.annotate(period=TruncDay('created_at')).values('period').annotate(total=Sum('total')).order_by('period')
            sales_dict = {item['period'].date(): item['total'] for item in sales_by_period}
            for i in range(7): 
                date = start_date + timedelta(days=i)
                sales_data.append({'label': date.strftime('%a'), 'sales': float(sales_dict.get(date, 0))})
        elif period == 'weekly':
            start_date = end_date - timedelta(weeks=7) 
            queryset = base_queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
            sales_by_period = queryset.annotate(period=TruncWeek('created_at')).values('period').annotate(total=Sum('total')).order_by('period')
            sales_dict = {item['period'].date(): item['total'] for item in sales_by_period}
            for i in range(8): 
                week_start_date = start_date + timedelta(weeks=i)
                key_date = week_start_date - timedelta(days=week_start_date.weekday())
                sales_data.append({'label': f"Wk {week_start_date.strftime('%U')}", 'sales': float(sales_dict.get(key_date, 0))})
        elif period == 'monthly':
            start_date = (end_date.replace(day=1) - timedelta(days=150)).replace(day=1)
            queryset = base_queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
            sales_by_period = queryset.annotate(period=TruncMonth('created_at')).values('period').annotate(total=Sum('total')).order_by('period')
            for item in sales_by_period: 
                sales_data.append({'label': item['period'].strftime('%b %Y'), 'sales': float(item['total'])})
        else: 
            return JsonResponse({'success': False, 'error': 'Invalid period specified'}, status=400)
        
        return JsonResponse({'sales_data': sales_data})
    except Exception as e: 
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def cashier_pos_page(request):
    context = {'username': request.user.username}
    if request.user.is_superuser: context['user_role'] = 'admin'
    elif hasattr(request.user, 'profile'):
        try: context['user_role'] = request.user.profile.role
        except UserProfile.DoesNotExist: context['user_role'] = 'unknown'
    else: context['user_role'] = 'unknown'
    return render(request, 'cashier-pos.html', context)


@login_required
@require_http_methods(["POST"])
@transaction.atomic
def process_order(request):
    try:
        data = json.loads(request.body)
        cart_items_data = data.get('items', [])
        payment_method = data.get('payment_method', 'Cash')
        discount = Decimal(data.get('discount', '0.0'))
        customer_name = data.get('customer_name', '')
        
        discount_type = data.get('discount_type', 'regular')
        discount_id = data.get('discount_id', '')
        
        payment_details = data.get('payment_details', {})
        
        if not cart_items_data: 
            return JsonResponse({'success': False, 'error': 'Cart is empty'}, status=400)
        
        required_ingredients = defaultdict(float)
        items_to_process = []

        for item_data in cart_items_data:
            try:
                item = Item.objects.get(id=item_data['id'], is_active=True)
                quantity = int(item_data['quantity'])
                items_to_process.append({'item': item, 'quantity': quantity})
                
                is_recipe_item = False
                if item.stock > 0:
                    is_recipe_item = False
                else:
                    if isinstance(item.recipe, list) and len(item.recipe) > 0:
                        for recipe_item in item.recipe:
                            ingredient_name = recipe_item.get('ingredient')
                            qty_per_item = recipe_item.get('quantity', 0)
                            if ingredient_name and qty_per_item > 0: 
                                is_recipe_item = True
                                required_ingredients[ingredient_name] += float(qty_per_item) * quantity
                
                if not is_recipe_item:
                    if item.stock < quantity: 
                        return JsonResponse({'success': False, 'error': f'Insufficient product stock for {item.name}'}, status=400)

            except Item.DoesNotExist: 
                return JsonResponse({'success': False, 'error': f'Item ID {item_data["id"]} not found or inactive'}, status=404)
            except ValueError: 
                return JsonResponse({'success': False, 'error': 'Invalid quantity received'}, status=400)
            except TypeError:
                return JsonResponse({'success': False, 'error': f'Invalid recipe format for {item.name}'}, status=500)
        
        ingredients_to_update = []
        for name, needed_qty in required_ingredients.items():
            try:
                ingredient = Ingredient.objects.get(name=name)
                if ingredient.status == 'Out of Stock' or ingredient.mainStock < needed_qty:
                    return JsonResponse({'success': False, 'error': f'Insufficient or out of stock ingredient: {name}. Needed: {needed_qty}, Available: {ingredient.mainStock}'}, status=400)
                ingredients_to_update.append({'ingredient': ingredient, 'deduct_qty': needed_qty})
            except Ingredient.DoesNotExist: 
                return JsonResponse({'success': False, 'error': f'Ingredient "{name}" not found in database'}, status=404)
        
        subtotal = sum((item['item'].price or Decimal('0.0')) * item['quantity'] for item in items_to_process)
        
        vat_rate = Decimal('0.12')
        vatable_amount = subtotal / (Decimal('1') + vat_rate)
        vat_amount = subtotal - vatable_amount
        
        discount_amount = Decimal('0.0')
        discount_percent = discount
        
        if discount_type == 'senior' or discount_type == 'pwd':
            discount_percent = Decimal('20.0')
            discount_amount = vatable_amount * (discount_percent / Decimal('100.0'))
            total_deduction = discount_amount + vat_amount
            total = subtotal - total_deduction
        else:
            discount_amount = subtotal * (discount_percent / Decimal('100.0'))
            total = subtotal - discount_amount
        
        # Attempt to save discount details if model supports it
        order_data = {
            'total': total,
            'customer_name': customer_name,
            'status': 'paid',
            'cashier': request.user,
            'payment_method': payment_method,
            'discount': discount_percent
        }
        
        # Try adding discount_type/id if your model has these fields. 
        # If not, this might error, but based on requirements we assume you want to save them.
        try:
            order = Order.objects.create(
                **order_data,
                discount_type=discount_type,
                discount_id=discount_id
            )
        except TypeError:
            # Fallback if model fields don't exist - create without extra fields
            order = Order.objects.create(**order_data)
        
        order_items_list = []
        for item_data in items_to_process:
            item = item_data['item']
            quantity = item_data['quantity']
            order_item = OrderItem.objects.create(order=order, item=item, qty=quantity, price_at_order=item.price)
            order_items_list.append(order_item)
            
            is_recipe_item = False
            if item.stock > 0:
                is_recipe_item = False
            else:
                if isinstance(item.recipe, list) and len(item.recipe) > 0:
                    for recipe_item in item.recipe:
                        if recipe_item.get('ingredient') and recipe_item.get('quantity', 0) > 0:
                            is_recipe_item = True
                            break
            
            if not is_recipe_item:
                item.stock -= quantity
                item.save(update_fields=['stock'])

        for ing_data in ingredients_to_update:
            ingredient = ing_data['ingredient']
            deduct_qty = ing_data['deduct_qty']

            ingredient.mainStock -= deduct_qty
            if ingredient.mainStock <= 0 and ingredient.stockRoom <= 0 and ingredient.status != 'Out of Stock':
                ingredient.status = 'Out of Stock'
            elif ingredient.mainStock < ingredient.reorder and ingredient.status == 'In Stock':
                ingredient.status = 'Low Stock'
            ingredient.save(update_fields=['mainStock', 'status'])

            # Create inventory transaction for stock out (usage in recipe)
            create_inventory_transaction(
                ingredient=ingredient,
                transaction_type='STOCK_OUT',
                quantity=-deduct_qty,  # Negative because it's removing from stock
                user=request.user,
                notes=f"Used in order (recipe)",
                reference=f"Order-{order.id}"
            )
        
        audit_description = f"Order #{order.id} processed. Total: ₱{total}."
        if discount_type in ['senior', 'pwd']:
            audit_description += f" {discount_type.upper()} Discount (ID: {discount_id}). VAT Exempt."
        if payment_method != 'Cash' and payment_details:
            ref_num = payment_details.get('ref_num', 'N/A')
            cust_name = payment_details.get('cust_name', 'N/A')
            audit_description += f" Method: {payment_method} (Ref: {ref_num}, Name: {cust_name})"
        
        log_audit(request, request.user, "Process Order", audit_description, category="sales", severity="medium")

        receipt_context = {
            'order': order,
            'order_items': order_items_list,
            'subtotal': subtotal,
            'vatable_amount': vatable_amount if (discount_type in ['senior', 'pwd']) else None,
            'vat_amount': vat_amount if (discount_type in ['senior', 'pwd']) else None,
            'discount_type': discount_type,
            'discount_id': discount_id,
            'discount_percent': discount_percent,
            'discount_amount': discount_amount,
            'total': total,
            'payment_method': payment_method
        }
        
        receipt_html = render_to_string('pos/receipt/_receipt_template.html', receipt_context)
        
        saved_file_path = save_receipt_to_file(
            order, order_items_list, subtotal, discount_percent, 
            discount_amount, total, payment_method, 
            vatable_amount=vatable_amount, 
            vat_amount=vat_amount,
            discount_type=discount_type,
            discount_id=discount_id
        )
        
        response_data = {
            'success': True, 
            'order_id': order.id, 
            'total': float(total), 
            'message': 'Order processed successfully!',
            'receipt_html': receipt_html
        }
        
        if saved_file_path:
            response_data['receipt_file'] = saved_file_path
        
        return JsonResponse(response_data)
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data received'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'An unexpected error occurred: {str(e)}'}, status=500)

@login_required
def recent_orders_api(request):
    orders = Order.objects.filter(status='paid').select_related('cashier').order_by('-created_at')[:5]
    orders_data = [{'id': o.id, 'total': float(o.total), 'created_at': o.created_at.strftime('%H:%M'), 'cashier': o.cashier.username if o.cashier else 'Unknown', 'customer_name': o.customer_name or 'Walk-in'} for o in orders]
    return JsonResponse({'orders': orders_data})


@login_required
@require_http_methods(["POST"])
def create_product(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    
    try:
        data = request.POST
        name = data.get('name', '').strip()
        price_str = data.get('price')
        stock_str = data.get('stock')
        
        if not name: 
            return JsonResponse({'success': False, 'error': 'Product name is required'}, status=400)
        
        try:
            price = float(price_str)
            if price < 0: raise ValueError()
        except (ValueError, TypeError):
             return JsonResponse({'success': False, 'error': 'Valid price is required'}, status=400)
        
        try:
            stock = int(stock_str)
            if stock < 0: raise ValueError()
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': 'Valid stock quantity is required'}, status=400)

        recipe_data = []
        recipe_json = data.get('recipe', '[]')
        try:
            recipe_data = json.loads(recipe_json)
            if not isinstance(recipe_data, list):
                recipe_data = []
        except json.JSONDecodeError:
            pass
        
        image_url = ''
        image_file = request.FILES.get('image_file')
        if image_file:
            image_url = handle_uploaded_file(image_file)
            if image_url is None:
                return JsonResponse({'success': False, 'error': 'Failed to save uploaded image'}, status=500)

        product = Item.objects.create(
            name=name,
            description=data.get('description', '').strip(),
            category=data.get('category', 'General').strip(),
            price=price,
            stock=stock,
            image_url=image_url,
            recipe=recipe_data
        )
        
        log_audit(request, request.user, "Create Product", f"Admin '{request.user.username}' created product '{name}'", category="inventory", severity="medium")
        return JsonResponse({'success': True, 'message': 'Product created', 'product': ItemSerializer(product).data})
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
def update_product(request, product_id):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    
    try:
        product = get_object_or_404(Item, id=product_id)
        data = request.POST
        
        old_values = {'name': product.name, 'price': float(product.price), 'stock': product.stock}
        
        product.name = data.get('name', product.name).strip()
        product.description = data.get('description', product.description).strip()
        product.category = data.get('category', product.category).strip()
        product.price = float(data.get('price', product.price))
        product.stock = int(data.get('stock', product.stock))
        product.is_active = data.get('is_active', product.is_active)

        recipe_json = data.get('recipe', '[]')
        try:
            product.recipe = json.loads(recipe_json)
            if not isinstance(product.recipe, list):
                product.recipe = []
        except json.JSONDecodeError:
            product.recipe = []

        image_file = request.FILES.get('image_file')
        if image_file:
            product.image_url = handle_uploaded_file(image_file)
            if product.image_url is None:
                 return JsonResponse({'success': False, 'error': 'Failed to save uploaded image'}, status=500)
        else:
            product.image_url = data.get('image_url', product.image_url)

        product.save()
        
        changes = []
        if old_values['name'] != product.name: changes.append(f"name: '{old_values['name']}'→'{product.name}'")
        if old_values['price'] != float(product.price): changes.append(f"price: ₱{old_values['price']}→₱{product.price}")
        if old_values['stock'] != product.stock: changes.append(f"stock: {old_values['stock']}→{product.stock}")
        change_desc = ", ".join(changes) if changes else "minor"
        
        log_audit(request, request.user, "Update Product", f"Admin '{request.user.username}' updated '{product.name}' ({change_desc})", category="inventory", severity="medium")
        return JsonResponse({'success': True, 'message': 'Product updated', 'product': ItemSerializer(product).data})
        
    except Item.DoesNotExist: 
        return JsonResponse({'success': False, 'error': 'Product not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
@require_http_methods(["DELETE", "POST"])
def delete_product(request, product_id):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    try:
        product = get_object_or_404(Item, id=product_id)
        product_name = product.name
        product.is_active = False
        product.stock = 0
        product.save(update_fields=['is_active', 'stock'])
        log_audit(request, request.user, "Deactivate Product", f"Admin '{request.user.username}' deactivated product '{product_name}'", category="inventory", severity="medium")
        return JsonResponse({'success': True, 'message': f'Product "{product_name}" deactivated'})
    except Item.DoesNotExist: return JsonResponse({'success': False, 'error': 'Product not found'}, status=404)
    except Exception as e: return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def get_products_api(request):
    try:
        products = Item.objects.filter(is_active=True).order_by('id')

        search = request.GET.get('search', '').strip()
        category_filter = request.GET.get('category', '').strip()
        status_filter = request.GET.get('status', '').strip()
        if search: products = products.filter(Q(name__icontains=search) | Q(description__icontains=search))
        if category_filter and category_filter != 'all': products = products.filter(category__iexact=category_filter)
        if status_filter and status_filter != 'all':
            if status_filter == 'in stock': products = products.filter(stock__gt=10)
            elif status_filter == 'low stock': products = products.filter(stock__lte=10, stock__gt=0)
            elif status_filter == 'out of stock': products = products.filter(stock=0)

        products_data = ItemSerializer(products, many=True).data
        
        for product in products_data:
            stock = product.get('stock', 0)
            recipe = product.get('recipe', [])
            is_recipe_item = isinstance(recipe, list) and len(recipe) > 0 and stock == 0
            
            if is_recipe_item:
                all_ingredients_available = True
                if recipe:
                    for recipe_item in recipe:
                        ingredient_name = recipe_item.get('ingredient')
                        qty_needed = recipe_item.get('quantity', 0)
                        if ingredient_name and qty_needed > 0:
                            try:
                                ingredient = Ingredient.objects.get(name=ingredient_name)
                                if ingredient.status == 'Out of Stock' or ingredient.mainStock < qty_needed:
                                    all_ingredients_available = False
                                    break
                            except Ingredient.DoesNotExist:
                                all_ingredients_available = False
                                break
                product['status'] = "available" if all_ingredients_available else "unavailable"
            else:
                if stock == 0: product['status'] = "out of stock"
                elif stock <= 10: product['status'] = "low stock"
                else: product['status'] = "in stock"
        
        active_products = Item.objects.filter(is_active=True)
        total_value = sum((p.price or 0) * (p.stock or 0) for p in active_products)
        stats = {
            'total_products': active_products.count(), 
            'in_stock': active_products.filter(stock__gt=10).count(), 
            'low_stock': active_products.filter(stock__lte=10, stock__gt=0).count(), 
            'total_value': float(total_value)
        }
        return JsonResponse({'success': True, 'products': products_data, 'stats': stats})
    except Exception as e: 
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@login_required
def inventory_consumption_api(request):
    try:
        days_to_analyze = 30
        start_date = timezone.now() - timedelta(days=days_to_analyze)
        recent_order_items = OrderItem.objects.filter(order__created_at__gte=start_date, order__status='paid').select_related('item')
        consumption_data = defaultdict(float)
        for order_item in recent_order_items:
            item = order_item.item
            if item.recipe and isinstance(item.recipe, list):
                for ingredient_in_recipe in item.recipe:
                    ingredient_name = ingredient_in_recipe.get('ingredient')
                    quantity_per_item = ingredient_in_recipe.get('quantity', 0)
                    if ingredient_name: consumption_data[ingredient_name] += float(quantity_per_item) * order_item.qty
        daily_consumption = { name: total / days_to_analyze for name, total in consumption_data.items() }
        return JsonResponse({'success': True, 'daily_consumption': daily_consumption})
    except Exception as e: return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def inventory_view(request):
    if not request.user.is_authenticated:
        return redirect('login')

    user_role = 'unknown'
    if request.user.is_superuser: user_role = 'admin'
    elif hasattr(request.user, 'profile'):
        try: user_role = request.user.profile.role
        except UserProfile.DoesNotExist:
             if request.user.is_staff: user_role = 'staff'
    elif request.user.is_staff:
        user_role = 'staff'

    context = {'username': request.user.username, 'user_role': user_role}
    return render(request, 'inventory.html', context)

@login_required
def products_view(request):
    admin_check = require_admin_access(request, 'staff_dashboard')
    if admin_check is not True:
        return admin_check
    context = {'username': request.user.username, 'user_role': 'admin'}
    return render(request, 'products.html', context)


@login_required
def user_management(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    users = User.objects.all().select_related('profile').order_by('username')
    context = {'username': request.user.username, 'users': users, 'user_role': 'admin'}
    return render(request, 'user_management.html', context)

@login_required
def create_user(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        role = request.POST.get('role')
        if not all([username, password, role]):
            messages.error(request, 'All fields required!')
            return redirect('user_management')
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Username exists!')
            return redirect('user_management')
        try:
            user = User.objects.create_user(username=username, email=request.POST.get('email', ''), password=password)
            UserProfile.objects.create(user=user, role=role)
            log_audit(request, request.user, "Create User", f"Admin '{request.user.username}' created user '{username}'", category="user", severity="medium")
            messages.success(request, f"User '{username}' created!")
        except Exception as e:
            messages.error(request, f'Error: {str(e)}')
    return redirect('user_management')

@login_required
def delete_user(request, user_id):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    user = get_object_or_404(User, id=user_id)
    if user.id == request.user.id:
        messages.error(request, 'Cannot delete self!')
        return redirect('user_management')
    username = user.username
    user.delete()
    log_audit(request, request.user, "Delete User", f"Admin '{request.user.username}' deleted user '{username}'", category="user", severity="high")
    messages.success(request, f"User '{username}' deleted!")
    return redirect('user_management')


@login_required
def stock_room(request):
    if not request.user.is_authenticated:
        return redirect('login')
    user_role = 'unknown'
    if request.user.is_superuser: user_role = 'admin'
    elif hasattr(request.user, 'profile'):
        try: user_role = request.user.profile.role
        except UserProfile.DoesNotExist:
             if request.user.is_staff: user_role = 'staff'
    elif request.user.is_staff:
        user_role = 'staff'
    if user_role not in ['admin', 'staff']:
        messages.warning(request, 'Access denied.')
        return redirect('staff_dashboard')
    context = {'username': request.user.username, 'user_role': user_role}
    return render(request, 'stock-room.html', context)


@login_required
def admin_pos(request):
    admin_check = require_admin_access(request, 'staff_dashboard')
    if admin_check is not True:
        return admin_check
    context = {'username': request.user.username, 'user_role': 'admin'}
    return render(request, 'admin-pos.html', context)


@login_required
def audit_trail(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    context = {'username': request.user.username, 'user_role': 'admin'}
    return render(request, 'audit-trail.html', context)

@login_required
def audit_logs_api(request):
    logs = AuditTrail.objects.all().order_by('-timestamp')
    data = [{ 
        "id": log.id, 
        "timestamp": log.timestamp.isoformat(),
        "user": log.user.username if log.user else "System", 
        "category": log.category or "system", 
        "action": log.action, 
        "description": log.description, 
        "severity": log.severity or "low", 
        "ip_address": log.ip_address or "N/A" 
    } for log in logs]
    return JsonResponse({"logs": data})


@login_required
def waste_inventory_view(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return admin_check
    context = {'username': request.user.username, 'user_role': 'admin'}
    return render(request, 'waste_inventory.html', context)

@login_required
def waste_log_api(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)

    logs = WastedLog.objects.all().select_related('ingredient', 'user').order_by('-wasted_at')
    
    data = [{
        "id": log.id,
        "wasted_at": log.wasted_at.isoformat(),
        "ingredient_name": log.ingredient.name if log.ingredient else log.ingredient_name,
        "quantity": log.quantity,
        "unit": log.unit,
        "cost_at_waste": float(log.cost_at_waste),
        "reason": log.get_reason_display(),
        "user": log.user.username if log.user else "System"
    } for log in logs]
    
    total_value = sum(item['cost_at_waste'] for item in data)
    stats = {
        "total_logs": len(data),
        "total_value": total_value,
        "by_reason": list(WastedLog.objects.values('reason').annotate(total=Sum('cost_at_waste')).order_by('-total'))
    }
    return JsonResponse({"logs": data, "stats": stats})

@login_required
@require_http_methods(["POST"])
@transaction.atomic
def record_waste(request):
    admin_check = require_admin_access(request)
    if admin_check is not True:
        return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)

    try:
        data = json.loads(request.body)
        ingredient_id = data.get('ingredient_id')
        quantity = float(data.get('quantity'))
        reason = data.get('reason', 'Manual Entry - Other')

        if not ingredient_id or not quantity or quantity <= 0:
            return JsonResponse({'success': False, 'error': 'Invalid data. Ingredient and positive quantity required.'}, status=400)

        ingredient = get_object_or_404(Ingredient, id=ingredient_id)
        if quantity > ingredient.mainStock:
            return JsonResponse({'success': False, 'error': f'Cannot waste {quantity}{ingredient.unit}. Only {ingredient.mainStock}{ingredient.unit} is in main stock.'}, status=400)

        total_cost = (ingredient.cost or Decimal('0.0')) * Decimal(quantity)
        waste_log = WastedLog.objects.create(
            ingredient=ingredient,
            ingredient_name=ingredient.name,
            quantity=quantity,
            unit=ingredient.unit,
            cost_at_waste=total_cost,
            reason=reason,
            user=request.user
        )

        ingredient.mainStock = F('mainStock') - quantity
        ingredient.save()
        ingredient.refresh_from_db()

        # Create inventory transaction for waste
        create_inventory_transaction(
            ingredient=ingredient,
            transaction_type='WASTE',
            quantity=-quantity,  # Negative because it's removing from stock
            user=request.user,
            notes=f"Waste recorded: {reason}",
            reference=f"WasteLog-{waste_log.id}"
        )

        log_audit(
            request, request.user, "Record Waste",
            f"User '{request.user.username}' manually recorded {quantity}{ingredient.unit} of '{ingredient.name}' as waste. Reason: {reason}. New Main Stock: {ingredient.mainStock}",
            category="inventory", severity="medium"
        )

        if ingredient.mainStock <= 0 and ingredient.stockRoom <= 0:
            ingredient.status = 'Out of Stock'
        elif ingredient.mainStock < ingredient.reorder:
             ingredient.status = 'Low Stock'
        ingredient.save(update_fields=['status'])
        return JsonResponse({'success': True, 'message': 'Waste recorded successfully.'})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data.'}, status=400)
    except Ingredient.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Ingredient not found.'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'An unexpected error occurred: {str(e)}'}, status=500)

@login_required
def order_details_api(request, order_id):
    """
    API endpoint to get the full details of a single order for the receipt modal.
    """
    try:
        order = get_object_or_404(
            Order.objects.select_related('cashier')
                         .prefetch_related('items__item'), 
            id=order_id
        )
        
        is_admin = request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'admin')
        is_staff = (hasattr(request.user, 'profile') and request.user.profile.role == 'staff')

        if not (is_admin or is_staff):
             return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)

        # Fallback safely if fields do not exist
        discount_type = getattr(order, 'discount_type', 'regular')
        discount_id = getattr(order, 'discount_id', '')

        order_data = {
            'id': order.id,
            'created_at': order.created_at.isoformat(),
            'total': float(order.total),
            'customer_name': order.customer_name or 'Walk-in',
            'status': order.status,
            'cashier_username': order.cashier.username if order.cashier else 'Unknown',
            'payment_method': order.payment_method or 'Cash',
            'discount': float(order.discount or 0),
            'discount_type': discount_type,
            'discount_id': discount_id,
            'items': [
                {
                    'id': item.id,
                    'qty': item.qty,
                    'price_at_order': float(item.price_at_order),
                    'item': {
                        'id': item.item.id,
                        'name': item.item.name,
                        'price': float(item.item.price),
                        'description': item.item.description,
                        'category': item.item.category,
                        'stock': item.item.stock,
                        'image_url': item.item.image_url,
                        'recipe': item.item.recipe,
                        'status': item.item.get_status()
                    }
                }
                for item in order.items.all()
            ]
        }

        return JsonResponse(order_data)

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ==================== INVENTORY MONITORING ENDPOINTS ====================

@login_required
def inventory_monitoring_view(request):
    """
    Render the inventory monitoring page
    """
    if not request.user.is_authenticated:
        return redirect('login')

    user_role = 'unknown'
    if request.user.is_superuser:
        user_role = 'admin'
    elif hasattr(request.user, 'profile'):
        try:
            user_role = request.user.profile.role
        except UserProfile.DoesNotExist:
            if request.user.is_staff:
                user_role = 'staff'
    elif request.user.is_staff:
        user_role = 'staff'

    context = {
        'username': request.user.username,
        'user_role': user_role
    }
    return render(request, 'inventory_monitoring.html', context)


@login_required
def inventory_monitoring_api(request):
    """
    API endpoint for inventory monitoring with date filtering
    Returns comprehensive inventory transaction data
    """
    try:
        # Get date range from query params
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        ingredient_id = request.GET.get('ingredient_id')
        transaction_type = request.GET.get('transaction_type')

        # Default to last 30 days if no dates provided
        if not end_date_str:
            end_date = timezone.now()
        else:
            end_date = timezone.datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))

        if not start_date_str:
            start_date = end_date - timedelta(days=30)
        else:
            start_date = timezone.datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))

        # Build query
        transactions = InventoryTransaction.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        ).select_related('ingredient', 'user')

        # Apply filters
        if ingredient_id:
            transactions = transactions.filter(ingredient_id=ingredient_id)

        if transaction_type:
            transactions = transactions.filter(transaction_type=transaction_type)

        # Get all ingredients for dropdown
        ingredients = Ingredient.objects.all().order_by('name').values('id', 'name', 'unit', 'category')

        # Prepare transaction data
        transactions_data = []
        for txn in transactions:
            transactions_data.append({
                'id': txn.id,
                'ingredient_name': txn.ingredient_name,
                'ingredient_id': txn.ingredient.id if txn.ingredient else None,
                'transaction_type': txn.transaction_type,
                'transaction_type_display': txn.get_transaction_type_display(),
                'quantity': float(txn.quantity),
                'unit': txn.unit,
                'cost_per_unit': float(txn.cost_per_unit),
                'total_cost': float(txn.total_cost),
                'main_stock_after': float(txn.main_stock_after),
                'stock_room_after': float(txn.stock_room_after),
                'notes': txn.notes,
                'reference': txn.reference,
                'created_at': txn.created_at.isoformat(),
                'user': txn.user.username if txn.user else 'System',
            })

        # Calculate summary statistics
        stock_in = transactions.filter(transaction_type='STOCK_IN').aggregate(
            total=Sum('quantity'),
            cost=Sum('total_cost')
        )
        stock_out = transactions.filter(transaction_type='STOCK_OUT').aggregate(
            total=Sum('quantity'),
            cost=Sum('total_cost')
        )
        waste = transactions.filter(transaction_type='WASTE').aggregate(
            total=Sum('quantity'),
            cost=Sum('total_cost')
        )
        transfers = transactions.filter(
            transaction_type__in=['TRANSFER_TO_MAIN', 'TRANSFER_TO_ROOM']
        ).aggregate(total=Count('id'))

        summary = {
            'stock_in': {
                'count': transactions.filter(transaction_type='STOCK_IN').count(),
                'total_quantity': float(stock_in['total'] or 0),
                'total_cost': float(stock_in['cost'] or 0),
            },
            'stock_out': {
                'count': transactions.filter(transaction_type='STOCK_OUT').count(),
                'total_quantity': abs(float(stock_out['total'] or 0)),
                'total_cost': float(stock_out['cost'] or 0),
            },
            'waste': {
                'count': transactions.filter(transaction_type='WASTE').count(),
                'total_quantity': float(waste['total'] or 0),
                'total_cost': float(waste['cost'] or 0),
            },
            'transfers': {
                'count': transfers['total'] or 0,
            },
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
            }
        }

        # Get ingredient-wise breakdown
        ingredient_summary = []
        ingredient_transactions = transactions.values('ingredient_id', 'ingredient_name').annotate(
            stock_in_qty=Sum('quantity', filter=Q(transaction_type='STOCK_IN')),
            stock_out_qty=Sum('quantity', filter=Q(transaction_type='STOCK_OUT')),
            waste_qty=Sum('quantity', filter=Q(transaction_type='WASTE')),
            total_cost=Sum('total_cost')
        ).order_by('-total_cost')

        for item in ingredient_transactions:
            if item['ingredient_id']:
                try:
                    ingredient = Ingredient.objects.get(id=item['ingredient_id'])
                    ingredient_summary.append({
                        'id': item['ingredient_id'],
                        'name': item['ingredient_name'],
                        'category': ingredient.category,
                        'unit': ingredient.unit,
                        'stock_in': float(item['stock_in_qty'] or 0),
                        'stock_out': abs(float(item['stock_out_qty'] or 0)),
                        'waste': float(item['waste_qty'] or 0),
                        'total_cost': float(item['total_cost'] or 0),
                        'current_main_stock': float(ingredient.mainStock),
                        'current_stock_room': float(ingredient.stockRoom),
                    })
                except Ingredient.DoesNotExist:
                    continue

        return JsonResponse({
            'success': True,
            'transactions': transactions_data,
            'summary': summary,
            'ingredient_summary': ingredient_summary,
            'ingredients': list(ingredients),
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def export_inventory_monitoring(request):
    """
    Export inventory monitoring data to CSV/Excel format
    """
    try:
        import csv
        from django.http import HttpResponse

        # Get same filters as monitoring API
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        ingredient_id = request.GET.get('ingredient_id')
        transaction_type = request.GET.get('transaction_type')
        export_format = request.GET.get('format', 'csv')  # csv or excel

        # Default to last 30 days
        if not end_date_str:
            end_date = timezone.now()
        else:
            end_date = timezone.datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))

        if not start_date_str:
            start_date = end_date - timedelta(days=30)
        else:
            start_date = timezone.datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))

        # Build query
        transactions = InventoryTransaction.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        ).select_related('ingredient', 'user').order_by('-created_at')

        if ingredient_id:
            transactions = transactions.filter(ingredient_id=ingredient_id)

        if transaction_type:
            transactions = transactions.filter(transaction_type=transaction_type)

        if export_format == 'excel':
            # For Excel export, we'll use CSV with .xlsx extension hint
            # In production, you might want to use openpyxl or xlsxwriter
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="inventory_monitoring_{start_date.strftime("%Y%m%d")}_{end_date.strftime("%Y%m%d")}.csv"'
        else:
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="inventory_monitoring_{start_date.strftime("%Y%m%d")}_{end_date.strftime("%Y%m%d")}.csv"'

        writer = csv.writer(response)

        # Write header
        writer.writerow([
            'Date',
            'Time',
            'Ingredient',
            'Category',
            'Transaction Type',
            'Quantity',
            'Unit',
            'Cost per Unit',
            'Total Cost',
            'Main Stock After',
            'Stock Room After',
            'User',
            'Reference',
            'Notes'
        ])

        # Write data
        for txn in transactions:
            writer.writerow([
                txn.created_at.strftime('%Y-%m-%d'),  # Date only
                txn.created_at.strftime('%H:%M'),     # Time only
                txn.ingredient_name,
                txn.ingredient.category if txn.ingredient else '',
                txn.get_transaction_type_display(),
                txn.quantity,
                txn.unit,
                txn.cost_per_unit,
                txn.total_cost,
                txn.main_stock_after,
                txn.stock_room_after,
                txn.user.username if txn.user else 'System',
                txn.reference,
                txn.notes
            ])

        return response

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
@transaction.atomic
def populate_historical_transactions(request):
    """
    API endpoint to populate historical inventory transactions
    Can be called from the UI
    """
    # Check admin access
    admin_check = require_admin_access(request, 'dashboard')
    if admin_check is not True:
        return JsonResponse({'success': False, 'error': 'Admin access required'}, status=403)

    try:
        # Counter for statistics
        stock_out_count = 0
        waste_count = 0
        errors = []

        # Check if already populated
        existing_count = InventoryTransaction.objects.count()
        if existing_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Transactions already exist ({existing_count} records). Clear them first if you want to repopulate.'
            })

        # Process historical orders for STOCK_OUT transactions
        orders = Order.objects.filter(status='paid').prefetch_related('items__item').order_by('created_at')

        for order in orders:
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
                                    quantity=-total_quantity,
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
                                errors.append(f'Ingredient "{ingredient_name}" not found for order {order.id}')
                                continue

        # Process waste logs for WASTE transactions
        waste_logs = WastedLog.objects.all().order_by('wasted_at')

        for waste_log in waste_logs:
            ingredient = waste_log.ingredient

            if ingredient:
                # Create WASTE transaction
                InventoryTransaction.objects.create(
                    ingredient=ingredient,
                    ingredient_name=waste_log.ingredient_name,
                    transaction_type='WASTE',
                    quantity=-waste_log.quantity,
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
                errors.append(f'Ingredient for waste log {waste_log.id} no longer exists')

        return JsonResponse({
            'success': True,
            'message': 'Historical data populated successfully',
            'stats': {
                'stock_out': stock_out_count,
                'waste': waste_count,
                'total': stock_out_count + waste_count,
                'errors': len(errors)
            },
            'errors': errors[:10]  # Return first 10 errors
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)