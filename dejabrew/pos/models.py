from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal
from django.utils import timezone


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('staff', 'Staff'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Ingredient(models.Model):
    STATUS_CHOICES = [
        ('In Stock', 'In Stock'),
        ('Low Stock', 'Low Stock'),
        ('Out of Stock', 'Out of Stock'),
    ]
    # --- NEW: Ingredient Type ---
    INGREDIENT_TYPE_CHOICES = [
        ('non-perishable', 'Non-Perishable'),
        ('perishable', 'Perishable'),
    ]
    # --- END NEW ---

    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, blank=True)
    mainStock = models.FloatField(default=0)
    stockRoom = models.FloatField(default=0)
    unit = models.CharField(max_length=20)
    reorder = models.FloatField(default=0)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='In Stock')
    
    # --- NEW: Ingredient Type Field ---
    ingredient_type = models.CharField(
        max_length=20, 
        choices=INGREDIENT_TYPE_CHOICES, 
        default='non-perishable',
        verbose_name="Perishable Type"
    )
    # --- END NEW ---

    def __str__(self):
        return self.name


class Item(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, default='General', blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    image_url = models.CharField(max_length=500, blank=True)
    recipe = models.JSONField(default=list, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def get_status(self):
        if not self.is_active:
             return 'inactive'
        if self.stock <= 0:
            return 'out of stock'
        elif self.stock <= 10:
            return 'low stock'
        else:
            return 'in stock'

    def __str__(self):
        return self.name

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('cancelled', 'Cancelled'),
    ]
    created_at = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    customer_name = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    cashier = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    # NEW FIELDS ADDED:
    payment_method = models.CharField(max_length=50, default='Cash', blank=True)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.id} - {self.total}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    qty = models.IntegerField()
    price_at_order = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def subtotal(self):
        return self.qty * self.price_at_order

    def __str__(self):
        return f"{self.qty} x {self.item.name}"


class AuditTrail(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    CATEGORY_CHOICES = [
        ('system', 'System'), ('auth', 'Authentication'), ('user', 'User Management'),
        ('inventory', 'Inventory'), ('sales', 'Sales'), ('other', 'Other'),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=100)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    severity = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action} [{self.category}/{self.severity}] at {self.timestamp}"


# --- NEW: Waste Log Model ---
class WastedLog(models.Model):
    REASON_CHOICES = [
        ('End-of-day spoilage', 'End-of-day spoilage'),
        ('Manual Entry - Spoilage', 'Manual Entry - Spoilage'),
        ('Manual Entry - Error', 'Manual Entry - Error'),
        ('Manual Entry - Other', 'Manual Entry - Other'),
    ]
    ingredient = models.ForeignKey(Ingredient, on_delete=models.SET_NULL, null=True, blank=True)
    ingredient_name = models.CharField(max_length=100) # Preserves name if ingredient is deleted
    quantity = models.FloatField()
    unit = models.CharField(max_length=20)
    cost_at_waste = models.DecimalField(max_digits=10, decimal_places=2, help_text="The total cost of the wasted items")
    wasted_at = models.DateTimeField(default=timezone.now)
    reason = models.CharField(max_length=100, choices=REASON_CHOICES, default='Manual Entry - Other')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, help_text="User who recorded the waste")

    class Meta:
        ordering = ['-wasted_at']

    def __str__(self):
        return f"{self.quantity}{self.unit} of {self.ingredient_name} wasted"
# --- END NEW ---