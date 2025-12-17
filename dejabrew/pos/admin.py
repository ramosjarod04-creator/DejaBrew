from django.contrib import admin
from .models import Item, Order, OrderItem, UserProfile, AuditTrail, Ingredient, WastedLog, InventoryTransaction


# =======================
#  ITEM ADMIN
# =======================
@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'price', 'stock', 'is_promo_active', 'promo_type', 'get_effective_price')
    search_fields = ('name', 'description')
    list_filter = ('stock', 'is_promo_active', 'promo_type', 'category')
    ordering = ('id',)

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'category', 'image_url', 'is_active')
        }),
        ('Pricing & Stock', {
            'fields': ('price', 'stock')
        }),
        ('Recipe (For items made from ingredients)', {
            'fields': ('recipe',),
            'classes': ('collapse',)
        }),
        ('Promotional Settings', {
            'fields': ('is_promo_active', 'promo_type', 'promo_price', 'promo_discount_percent'),
            'description': 'Configure promotional pricing. For Buy 1 Take 1, just activate the promo. For Special Price, set promo_price. For Percentage Off, set promo_discount_percent.'
        }),
    )

    def get_effective_price(self, obj):
        if obj.is_promo_active:
            if obj.promo_type == 'special_price' and obj.promo_price:
                return f"₱{obj.promo_price:.2f} (PROMO)"
            elif obj.promo_type == 'percentage_off' and obj.promo_discount_percent:
                discounted = obj.price * (1 - obj.promo_discount_percent / 100)
                return f"₱{discounted:.2f} (PROMO)"
            elif obj.promo_type == 'b1t1':
                return f"₱{obj.price:.2f} (B1T1)"
        return f"₱{obj.price:.2f}"
    get_effective_price.short_description = 'Effective Price'

    # Optional: Low-stock warning in list_display
    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related(None)  # No relations needed


# =======================
#  ORDER ADMIN
# =======================
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    readonly_fields = ('price_at_order',)
    extra = 0
    fields = ('item', 'qty', 'price_at_order',)  # Matches model fields


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'get_total_display', 'status', 'cashier', 'customer_name')
    list_filter = ('status', 'created_at')
    search_fields = ('id', 'cashier__username', 'cashier__email', 'customer_name')
    inlines = [OrderItemInline]
    ordering = ('-created_at',)
    autocomplete_fields = ('cashier',)  # Efficient FK selection
    date_hierarchy = 'created_at'  # Date-based navigation

    def get_total_display(self, obj):
        return f"${obj.total:.2f}"
    get_total_display.short_description = 'Total'

    # Bulk actions for status updates (matches STATUS_CHOICES)
    actions = ['mark_as_paid', 'mark_as_cancelled']

    def mark_as_paid(self, request, queryset):
        updated = queryset.update(status='paid')
        self.message_user(request, f'{updated} order(s) marked as paid.')
    mark_as_paid.short_description = 'Mark selected orders as paid'

    def mark_as_cancelled(self, request, queryset):
        updated = queryset.update(status='cancelled')
        self.message_user(request, f'{updated} order(s) marked as cancelled.')
    mark_as_cancelled.short_description = 'Mark selected orders as cancelled'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('cashier', 'items__item')


# =======================
#  USER PROFILE ADMIN
# =======================
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')
    search_fields = ('user__username', 'user__email', 'role')
    list_filter = ('role',)  # Filters by 'admin'/'staff'
    autocomplete_fields = ('user',)
    # Exclude user creation here; use Django's User admin or custom views


# =======================
#  AUDIT TRAIL ADMIN
# =======================
@admin.register(AuditTrail)
class AuditTrailAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'description', 'timestamp', 'ip_address')
    search_fields = ('user__username', 'user__email', 'action', 'description', 'ip_address')
    list_filter = ('action', 'timestamp', 'ip_address')  # IP filter works with GenericIPAddressField
    ordering = ('-timestamp',)
    date_hierarchy = 'timestamp'
    readonly_fields = ('timestamp', 'ip_address', 'user')  # Prevent tampering with logs

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    # Optional: Hide add/change buttons since logs are auto-generated
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# =======================
#  INGREDIENT ADMIN
# =======================
@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'category', 'mainStock', 'stockRoom', 'unit', 'cost', 'status', 'ingredient_type')
    search_fields = ('name', 'category')
    list_filter = ('status', 'category', 'ingredient_type')
    ordering = ('name',)


# =======================
#  WASTED LOG ADMIN
# =======================
@admin.register(WastedLog)
class WastedLogAdmin(admin.ModelAdmin):
    list_display = ('ingredient_name', 'quantity', 'unit', 'cost_at_waste', 'wasted_at', 'reason', 'user')
    search_fields = ('ingredient_name', 'reason', 'user__username')
    list_filter = ('reason', 'wasted_at')
    ordering = ('-wasted_at',)
    readonly_fields = ('wasted_at',)
    date_hierarchy = 'wasted_at'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('ingredient', 'user')


# =======================
#  INVENTORY TRANSACTION ADMIN
# =======================
@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'ingredient_name', 'transaction_type', 'quantity', 'unit', 'total_cost', 'user')
    search_fields = ('ingredient_name', 'transaction_type', 'user__username', 'notes', 'reference')
    list_filter = ('transaction_type', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'main_stock_after', 'stock_room_after')
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Transaction Info', {
            'fields': ('ingredient', 'ingredient_name', 'transaction_type', 'created_at')
        }),
        ('Quantity & Cost', {
            'fields': ('quantity', 'unit', 'cost_per_unit', 'total_cost')
        }),
        ('Stock Levels After Transaction', {
            'fields': ('main_stock_after', 'stock_room_after')
        }),
        ('Additional Details', {
            'fields': ('notes', 'reference', 'user')
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('ingredient', 'user')

    # Make transactions read-only after creation to maintain audit trail integrity
    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete transactions
        return request.user.is_superuser