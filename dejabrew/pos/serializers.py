from rest_framework import serializers
from .models import Item, Order, OrderItem, Ingredient

class ItemSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = ['id','name','description','price','stock','image_url', 'category', 'recipe', 'status',
                  'is_promo_active', 'promo_type', 'promo_price', 'promo_discount_percent']

    def get_status(self, obj):
        return obj.get_status()

class OrderItemSerializer(serializers.ModelSerializer):
    item = ItemSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id','item','qty','price_at_order']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    cashier_username = serializers.ReadOnlyField(source='cashier.username')

    class Meta:
        model = Order
        fields = ['id','created_at','total','customer_name','status', 'cashier_username', 'payment_method', 'discount', 'items']
        read_only_fields = ['id','created_at', 'total']


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = '__all__'