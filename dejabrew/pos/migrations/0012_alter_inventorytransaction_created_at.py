# Generated manually to fix created_at field for historical data

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0011_inventorytransaction'),
    ]

    operations = [
        migrations.AlterField(
            model_name='inventorytransaction',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
