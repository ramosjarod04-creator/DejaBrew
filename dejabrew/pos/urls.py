from django.urls import path, include
from rest_framework import routers
from . import views
from forecasting import views as forecast_views

router = routers.DefaultRouter()
router.register(r'ingredients', views.IngredientViewSet, basename='ingredient')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'orders', views.OrderViewSet, basename='order')

urlpatterns = [
    path('api/', include(router.urls)),

    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('', views.dashboard, name='dashboard'),
    path('staff-dashboard/', views.staff_dashboard, name='staff_dashboard'),
    path('cashier/', views.cashier_pos_page, name='cashier_pos'),
    path('admin-pos/', views.admin_pos, name='admin-pos'),

    path('inventory/', views.inventory_view, name='inventory'), # Unified inventory URL
    # path('staff-inventory/', views.inventory_view, name='staff_inventory'), # REMOVE THIS LINE
    path('stock-room/', views.stock_room, name='stock-room'),
    path('products/', views.products_view, name='products'),


    path('waste-inventory/', views.waste_inventory_view, name='waste_inventory'),


    path('users/', views.user_management, name='user_management'),
    path('users/create/', views.create_user, name='create_user'),
    path('users/edit/<int:user_id>/', views.edit_user, name='edit_user'),
    path('users/delete/<int:user_id>/', views.delete_user, name='delete_user'),

    path('audit-trail/', views.audit_trail, name='audit_trail'),
    path('audit/api/logs/', views.audit_logs_api, name='audit_logs_api'),

    path('api/process-order/', views.process_order, name='process_order'),
    path('api/verify-admin/', views.verify_admin_api, name='verify_admin_api'),
    path('api/log-void-action/', views.log_void_action, name='log_void_action'),
    path('api/recent-orders/', views.recent_orders_api, name='recent_orders_api'),
    path('api/best-selling-products/', views.get_best_selling_products_api, name='best_selling_products_api'),
    path('api/product-categories/', views.get_product_categories_api, name='product_categories_api'),
    path('api/rename-coffee-to-drinks/', views.rename_coffee_categories_to_drinks, name='rename_coffee_to_drinks'),
    path('api/dashboard-sales/', views.dashboard_sales_data, name='dashboard_sales_data'),
    path('api/products/', views.get_products_api, name='get_products_api'),
    path('api/products/create/', views.create_product, name='create_product'),
    path('api/products/<int:product_id>/update/', views.update_product, name='update_product'),
    path('api/products/<int:product_id>/delete/', views.delete_product, name='delete_product'),
    path('api/inventory/consumption/', views.inventory_consumption_api, name='api_inventory_consumption'),
    path('api/waste-log/', views.waste_log_api, name='waste_log_api'),
    path('api/record-waste/', views.record_waste, name='record_waste'),
    

    path('api/order/<int:order_id>/', views.order_details_api, name='order_details_api'),

    # Inventory Monitoring
    path('inventory-monitoring/', views.inventory_monitoring_view, name='inventory_monitoring'),
    path('api/inventory-monitoring/', views.inventory_monitoring_api, name='api_inventory_monitoring'),
    path('api/inventory-monitoring/export/', views.export_inventory_monitoring, name='export_inventory_monitoring'),
    path('api/inventory-monitoring/populate/', views.populate_historical_transactions, name='populate_historical_transactions'),
    path('api/inventory-monitoring/debug/', views.debug_transactions, name='debug_transactions'),

    # Sales Monitoring
    path('sales-monitoring/', views.sales_monitoring_view, name='sales_monitoring'),
    path('api/sales-monitoring/', views.sales_monitoring_api, name='api_sales_monitoring'),

    # Forecasting endpoints
    path('forecasting/api/predict/', forecast_views.predict_api, name='forecast_predict_api'),
    path('upload_model/', forecast_views.upload_model_view, name='upload_model'),
    path('metrics_dashboard/', forecast_views.metrics_dashboard_view, name='metrics_dashboard'),
    
    path('run-retrain/', views.run_retrain),
    path('populate-inventory/', views.populate_inventory),
]