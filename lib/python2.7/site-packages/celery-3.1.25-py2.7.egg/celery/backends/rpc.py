# -*- coding: utf-8 -*-
"""
    celery.backends.rpc
    ~~~~~~~~~~~~~~~~~~~

    RPC-style result backend, using reply-to and one queue per client.

"""
from __future__ import absolute_import

from kombu import Consumer, Exchange
from kombu.common import maybe_declare
from kombu.utils import cached_property

from celery import current_task
from celery.backends import amqp

__all__ = ['RPCBackend']


class RPCBackend(amqp.AMQPBackend):
    persistent = False

    class Consumer(Consumer):
        auto_declare = False

    def _create_exchange(self, name, type='direct', delivery_mode=2):
        # uses direct to queue routing (anon exchange).
        return Exchange(None)

    def on_task_call(self, producer, task_id):
        maybe_declare(self.binding(producer.channel), retry=True)

    def _create_binding(self, task_id):
        return self.binding

    def _many_bindings(self, ids):
        return [self.binding]

    def rkey(self, task_id):
        return task_id

    def destination_for(self, task_id, request):
        # Request is a new argument for backends, so must still support
        # old code that rely on current_task
        try:
            request = request or current_task.request
        except AttributeError:
            raise RuntimeError(
                'RPC backend missing task request for {0!r}'.format(task_id),
            )
        return request.reply_to, request.correlation_id or task_id

    def on_reply_declare(self, task_id):
        pass

    def as_uri(self, include_password=True):
        return 'rpc://'

    @property
    def binding(self):
        return self.Queue(self.oid, self.exchange, self.oid,
                          durable=False, auto_delete=False)

    @cached_property
    def oid(self):
        return self.app.oid
