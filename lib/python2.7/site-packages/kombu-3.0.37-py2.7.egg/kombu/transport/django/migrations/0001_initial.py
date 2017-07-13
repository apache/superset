# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Message',
            fields=[
                ('id', models.AutoField(
                    verbose_name='ID', serialize=False,
                    auto_created=True, primary_key=True)),
                ('visible', models.BooleanField(default=True, db_index=True)),
                ('sent_at', models.DateTimeField(
                    db_index=True, auto_now_add=True, null=True)),
                ('payload', models.TextField(verbose_name='payload')),
            ],
            options={
                'db_table': 'djkombu_message',
                'verbose_name': 'message',
                'verbose_name_plural': 'messages',
            },
        ),
        migrations.CreateModel(
            name='Queue',
            fields=[
                ('id', models.AutoField(
                    verbose_name='ID', serialize=False,
                    auto_created=True, primary_key=True)),
                ('name', models.CharField(
                    unique=True, max_length=200, verbose_name='name')),
            ],
            options={
                'db_table': 'djkombu_queue',
                'verbose_name': 'queue',
                'verbose_name_plural': 'queues',
            },
        ),
        migrations.AddField(
            model_name='message',
            name='queue',
            field=models.ForeignKey(
                related_name='messages', to='kombu_transport_django.Queue'),
        ),
    ]
