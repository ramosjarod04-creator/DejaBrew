from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # This line fixes the /forecasting/api/predict/ error
    path('forecasting/', include('forecasting.urls')), 

    # This line fixes the /api/dashboard-sales/ error
    path('', include('pos.urls')), 
]