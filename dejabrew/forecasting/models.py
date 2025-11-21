from django.db import models
from django.conf import settings
import os

def model_upload_path(instance, filename):
    return os.path.join('forecast_models', filename)

class ForecastModelRecord(models.Model):
    """
    Stores info about trained models (one per product or a global model)
    """
    name = models.CharField(max_length=200)
    product_id = models.CharField(max_length=100, blank=True, null=True)
    model_file = models.FileField(upload_to=model_upload_path)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.product_id:
            return f"{self.name} (product {self.product_id})"
        return self.namee