# Generated manually for inventory transaction tracking

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('pos', '0010_ingredient_ingredient_type_wastedlog'),
    ]

    operations = [
        migrations.CreateModel(
            name='InventoryTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ingredient_name', models.CharField(max_length=100)),
                ('transaction_type', models.CharField(choices=[('STOCK_IN', 'Stock In'), ('STOCK_OUT', 'Stock Out'), ('TRANSFER_TO_MAIN', 'Transfer to Main Stock'), ('TRANSFER_TO_ROOM', 'Transfer to Stock Room'), ('WASTE', 'Waste'), ('ADJUSTMENT', 'Manual Adjustment')], max_length=20)),
                ('quantity', models.FloatField()),
                ('unit', models.CharField(max_length=20)),
                ('cost_per_unit', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('total_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('main_stock_after', models.FloatField(default=0)),
                ('stock_room_after', models.FloatField(default=0)),
                ('notes', models.TextField(blank=True)),
                ('reference', models.CharField(blank=True, max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('ingredient', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='pos.ingredient')),
                ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='inventorytransaction',
            index=models.Index(fields=['-created_at'], name='pos_invento_created_7f8c9d_idx'),
        ),
        migrations.AddIndex(
            model_name='inventorytransaction',
            index=models.Index(fields=['ingredient', '-created_at'], name='pos_invento_ingredi_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='inventorytransaction',
            index=models.Index(fields=['transaction_type', '-created_at'], name='pos_invento_transac_d4e5f6_idx'),
        ),
    ]
