# Generated migration for promotional fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("pos", "0015_add_soft_delete_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="is_promo_active",
            field=models.BooleanField(default=False, verbose_name="Promo Active"),
        ),
        migrations.AddField(
            model_name="item",
            name="promo_type",
            field=models.CharField(
                choices=[
                    ('none', 'No Promo'),
                    ('b1t1', 'Buy 1 Take 1'),
                    ('percentage_off', 'Percentage Off'),
                    ('special_price', 'Special Price'),
                ],
                default='none',
                max_length=20,
                verbose_name="Promo Type"
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="promo_price",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
                verbose_name="Promo Price"
            ),
        ),
        migrations.AddField(
            model_name="item",
            name="promo_discount_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=5,
                null=True,
                verbose_name="Promo Discount %"
            ),
        ),
    ]
