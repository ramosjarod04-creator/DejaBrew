from django.contrib import admin
from .models import ForecastModelRecord

@admin.register(ForecastModelRecord)
class ForecastModelRecordAdmin(admin.ModelAdmin):
    list_display = ('name', 'product_id', 'model_file', 'created_at')
    readonly_fields = ('created_at',)
