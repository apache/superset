# -*- coding: utf-8 -*-
"""
    celery.backends.amqp
    ~~~~~~~~~~~~~~~~~~~~

    The AMQP result backend.

    This backend publishes results as messages.

"""
from __future__ import absolute_import

import socket

from collections import deque
from operator import itemgetter

from kombu import Exchange, Queue, Producer, Consumer

from celery import states
from celery.exceptions import TimeoutError
from celery.five import range, monotonic
from celery.utils.functional import dictfilter
from celery.utils.log import get_logger
from celery.utils.timeutils import maybe_s_to_ms

from .base import BaseBackend

__all__ = ['BacklogLimitExceeded', 'AMQPBackend']

logger = get_logger(__name__)


class BacklogLimitExceeded(Exception):
    """Too much state history to fast-forward."""


def repair_uuid(s):
    # Historically the dashes in UUIDS are removed from AMQ entity names,
    # but there is no known reason to.  Hopefully we'll be able to fix
    # this in v4.0.
    return '%s-%s-%s-%s-%s' % (s[:8], s[8:12], s[12:16], s[16:20], s[20:])


class NoCacheQueue(Queue):
    can_cache_declaration = False


class AMQPBackend(BaseBackend):
    """Publishes results by sending messages."""
    Exchange = Exchange
    Queue = NoCacheQueue
    Consumer = Consumer
    Producer = Producer

    BacklogLimitExceeded = BacklogLimitExceeded

    persistent = True
    supports_autoexpire = True
    supports_native_join = True

    retry_policy = {
        'max_retries': 20,
        'interval_start': 0,
        'interval_step': 1,
        'interval_max': 1,
    }

    def __init__(self, app, connection=None, exchange=None, exchange_type=None,
                 persistent=None, serializer=None, auto_delete=True, **kwargs):
        super(AMQPBackend, self).__init__(app, **kwargs)
        conf = self.app.conf
        self._connection = connection
        self.persistent = self.prepare_persistent(persistent)
        self.delivery_mode = 2 if self.persistent else 1
        exchange = exchange or conf.CELERY_RESULT_EXCHANGE
        exchange_type = exchange_type or conf.CELERY_RESULT_EXCHANGE_TYPE
        self.exchange = self._create_exchange(
            exchange, exchange_type, self.delivery_mode,
        )
        self.serializer = serializer or conf.CELERY_RESULT_SERIALIZER
        self.auto_delete = auto_delete

        self.expires = None
        if 'expires' not in kwargs or kwargs['expires'] is not None:
            self.expires = self.prepare_expires(kwargs.get('expires'))
        self.queue_arguments = dictfilter({
            'x-expires': maybe_s_to_ms(self.expires),
        })

    def _create_exchange(self, name, type='direct', delivery_mode=2):
        return self.Exchange(name=name,
                             type=type,
                             delivery_mode=delivery_mode,
                             durable=self.persistent,
                             auto_delete=False)

    def _create_binding(self, task_id):
        name = self.rkey(task_id)
        return self.Queue(name=name,
                          exchange=self.exchange,
                          routing_key=name,
                          durable=self.persistent,
                          auto_delete=self.auto_delete,
                          queue_arguments=self.queue_arguments)

    def revive(self, channel):
        pass

    def rkey(self, task_id):
        return task_id.replace('-', '')

    def destination_for(self, task_id, request):
        if request:
            return self.rkey(task_id), request.correlation_id or task_id
        return self.rkey(task_id), task_id

    def store_result(self, task_id, result, status,
                     traceback=None, request=None, **kwargs):
        """Send task return value and status."""
        routing_key, correlation_id = self.destination_for(task_id, request)
        if not routing_key:
            return
        with self.app.amqp.producer_pool.acquire(block=True) as producer:
            producer.publish(
                {'task_id': task_id, 'status': status,
                 'result': self.encode_result(result, status),
                 'traceback': traceback,
                 'children': self.current_task_children(request)},
                exchange=self.exchange,
                routing_key=routing_key,
                correlation_id=correlation_id,
                serializer=self.serializer,
                retry=True, retry_policy=self.retry_policy,
                declare=self.on_reply_declare(task_id),
                delivery_mode=self.delivery_mode,
            )
        return result

    def on_reply_declare(self, task_id):
        return [self._create_binding(task_id)]

    def wait_for(self, task_id, timeout=None, cache=True,
                 no_ack=True, on_interval=None,
                 READY_STATES=states.READY_STATES,
                 PROPAGATE_STATES=states.PROPAGATE_STATES,
                 **kwargs):
        cached_meta = self._cache.get(task_id)
        if cache and cached_meta and \
                cached_meta['status'] in READY_STATES:
            return cached_meta
        else:
            try:
                return self.consume(task_id, timeout=timeout, no_ack=no_ack,
                                    on_interval=on_interval)
            except socket.timeout:
                raise TimeoutError('The operation timed out.')

    def get_task_meta(self, task_id, backlog_limit=1000):
        # Polling and using basic_get
        with self.app.pool.acquire_channel(block=True) as (_, channel):
            binding = self._create_binding(task_id)(channel)
            binding.declare()

            prev = latest = acc = None
            for i in range(backlog_limit):  # spool ffwd
                acc = binding.get(
                    accept=self.accept, no_ack=False,
                )
                if not acc:  # no more messages
                    break
                if acc.payload['task_id'] == task_id:
                    prev, latest = latest, acc
                if prev:
                    # backends are not expected to keep history,
                    # so we delete everything except the most recent state.
                    prev.ack()
                    prev = None
            else:
                raise self.BacklogLimitExceeded(task_id)

            if latest:
                payload = self._cache[task_id] = \
                    self.meta_from_decoded(latest.payload)
                latest.requeue()
                return payload
            else:
                # no new state, use previous
                try:
                    return self._cache[task_id]
                except KeyError:
                    # result probably pending.
                    return {'status': states.PENDING, 'result': None}
    poll = get_task_meta  # XXX compat

    def drain_events(self, connection, consumer,
                     timeout=None, on_interval=None, now=monotonic, wait=None):
        wait = wait or connection.drain_events
        results = {}

        def callback(meta, message):
            if meta['status'] in states.READY_STATES:
                results[meta['task_id']] = self.meta_from_decoded(meta)

        consumer.callbacks[:] = [callback]
        time_start = now()

        while 1:
            # Total time spent may exceed a single call to wait()
            if timeout and now() - time_start >= timeout:
                raise socket.timeout()
            try:
                wait(timeout=1)
            except socket.timeout:
                pass
            if on_interval:
                on_interval()
            if results:  # got event on the wanted channel.
                break
        self._cache.update(results)
        return results

    def consume(self, task_id, timeout=None, no_ack=True, on_interval=None):
        wait = self.drain_events
        with self.app.pool.acquire_channel(block=True) as (conn, channel):
            binding = self._create_binding(task_id)
            with self.Consumer(channel, binding,
                               no_ack=no_ack, accept=self.accept) as consumer:
                while 1:
                    try:
                        return wait(
                            conn, consumer, timeout, on_interval)[task_id]
                    except KeyError:
                        continue

    def _many_bindings(self, ids):
        return [self._create_binding(task_id) for task_id in ids]

    def get_many(self, task_ids, timeout=None, no_ack=True,
                 now=monotonic, getfields=itemgetter('status', 'task_id'),
                 READY_STATES=states.READY_STATES,
                 PROPAGATE_STATES=states.PROPAGATE_STATES, **kwargs):
        with self.app.pool.acquire_channel(block=True) as (conn, channel):
            ids = set(task_ids)
            cached_ids = set()
            mark_cached = cached_ids.add
            for task_id in ids:
                try:
                    cached = self._cache[task_id]
                except KeyError:
                    pass
                else:
                    if cached['status'] in READY_STATES:
                        yield task_id, cached
                        mark_cached(task_id)
            ids.difference_update(cached_ids)
            results = deque()
            push_result = results.append
            push_cache = self._cache.__setitem__
            decode_result = self.meta_from_decoded

            def on_message(message):
                body = decode_result(message.decode())
                state, uid = getfields(body)
                if state in READY_STATES:
                    push_result(body) \
                        if uid in task_ids else push_cache(uid, body)

            bindings = self._many_bindings(task_ids)
            with self.Consumer(channel, bindings, on_message=on_message,
                               accept=self.accept, no_ack=no_ack):
                wait = conn.drain_events
                popleft = results.popleft
                while ids:
                    wait(timeout=timeout)
                    while results:
                        state = popleft()
                        task_id = state['task_id']
                        ids.discard(task_id)
                        push_cache(task_id, state)
                        yield task_id, state

    def reload_task_result(self, task_id):
        raise NotImplementedError(
            'reload_task_result is not supported by this backend.')

    def reload_group_result(self, task_id):
        """Reload group result, even if it has been previously fetched."""
        raise NotImplementedError(
            'reload_group_result is not supported by this backend.')

    def save_group(self, group_id, result):
        raise NotImplementedError(
            'save_group is not supported by this backend.')

    def restore_group(self, group_id, cache=True):
        raise NotImplementedError(
            'restore_group is not supported by this backend.')

    def delete_group(self, group_id):
        raise NotImplementedError(
            'delete_group is not supported by this backend.')

    def as_uri(self, include_password=True):
        return 'amqp://'

    def __reduce__(self, args=(), kwargs={}):
        kwargs.update(
            connection=self._connection,
            exchange=self.exchange.name,
            exchange_type=self.exchange.type,
            persistent=self.persistent,
            serializer=self.serializer,
            auto_delete=self.auto_delete,
            expires=self.expires,
        )
        return super(AMQPBackend, self).__reduce__(args, kwargs)
