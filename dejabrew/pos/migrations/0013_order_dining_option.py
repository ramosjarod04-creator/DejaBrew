# Generated migration for adding dining_option field to Order model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0012_alter_inventorytransaction_created_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='dining_option',
            field=models.CharField(
                blank=True,
                choices=[('dine-in', 'Dine-In'), ('take-out', 'Take-Out')],
                default='dine-in',
                max_length=20
            ),
        ),
    ]
