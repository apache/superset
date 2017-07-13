from __future__ import absolute_import

import django

from django.db import models
from django.utils.translation import ugettext_lazy as _

from .managers import QueueManager, MessageManager


class Queue(models.Model):
    name = models.CharField(_('name'), max_length=200, unique=True)

    objects = QueueManager()

    class Meta:
        if django.VERSION >= (1, 7):
            app_label = 'kombu_transport_django'
        db_table = 'djkombu_queue'
        verbose_name = _('queue')
        verbose_name_plural = _('queues')


class Message(models.Model):
    visible = models.BooleanField(default=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True, db_index=True,
                                   auto_now_add=True)
    payload = models.TextField(_('payload'), null=False)
    queue = models.ForeignKey(Queue, related_name='messages')

    objects = MessageManager()

    class Meta:
        if django.VERSION >= (1, 7):
            app_label = 'kombu_transport_django'
        db_table = 'djkombu_message'
        verbose_name = _('message')
        verbose_name_plural = _('messages')
