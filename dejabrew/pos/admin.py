from django.contrib import admin
from .models import Item, Order, OrderItem, UserProfile, AuditTrail


# =======================
#  ITEM ADMIN
# =======================
@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'price', 'stock')
    search_fields = ('name', 'description')
    list_filter = ('stock',)
    ordering = ('id',)
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