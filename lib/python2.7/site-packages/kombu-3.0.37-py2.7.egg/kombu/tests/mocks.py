from __future__ import absolute_import

from itertools import count

import anyjson

from kombu.transport import base


class Message(base.Message):

    def __init__(self, *args, **kwargs):
        self.throw_decode_error = kwargs.get('throw_decode_error', False)
        super(Message, self).__init__(*args, **kwargs)

    def decode(self):
        if self.throw_decode_error:
            raise ValueError("can't decode message")
        return super(Message, self).decode()


class Channel(base.StdChannel):
    open = True
    throw_decode_error = False
    _ids = count(1)

    def __init__(self, connection):
        self.connection = connection
        self.called = []
        self.deliveries = count(1)
        self.to_deliver = []
        self.events = {'basic_return': set()}
        self.channel_id = next(self._ids)

    def _called(self, name):
        self.called.append(name)

    def __contains__(self, key):
        return key in self.called

    def exchange_declare(self, *args, **kwargs):
        self._called('exchange_declare')

    def prepare_message(self, body, priority=0, content_type=None,
                        content_encoding=None, headers=None, properties={}):
        self._called('prepare_message')
        return dict(body=body,
                    headers=headers,
                    properties=properties,
                    priority=priority,
                    content_type=content_type,
                    content_encoding=content_encoding)

    def basic_publish(self, message, exchange='', routing_key='',
                      mandatory=False, immediate=False, **kwargs):
        self._called('basic_publish')
        return message, exchange, routing_key

    def exchange_delete(self, *args, **kwargs):
        self._called('exchange_delete')

    def queue_declare(self, *args, **kwargs):
        self._called('queue_declare')

    def queue_bind(self, *args, **kwargs):
        self._called('queue_bind')

    def queue_unbind(self, *args, **kwargs):
        self._called('queue_unbind')

    def queue_delete(self, queue, if_unused=False, if_empty=False, **kwargs):
        self._called('queue_delete')

    def basic_get(self, *args, **kwargs):
        self._called('basic_get')
        try:
            return self.to_deliver.pop()
        except IndexError:
            pass

    def queue_purge(self, *args, **kwargs):
        self._called('queue_purge')

    def basic_consume(self, *args, **kwargs):
        self._called('basic_consume')

    def basic_cancel(self, *args, **kwargs):
        self._called('basic_cancel')

    def basic_ack(self, *args, **kwargs):
        self._called('basic_ack')

    def basic_recover(self, requeue=False):
        self._called('basic_recover')

    def exchange_bind(self, *args, **kwargs):
        self._called('exchange_bind')

    def exchange_unbind(self, *args, **kwargs):
        self._called('exchange_unbind')

    def close(self):
        self._called('close')

    def message_to_python(self, message, *args, **kwargs):
        self._called('message_to_python')
        return Message(self, body=anyjson.dumps(message),
                       delivery_tag=next(self.deliveries),
                       throw_decode_error=self.throw_decode_error,
                       content_type='application/json',
                       content_encoding='utf-8')

    def flow(self, active):
        self._called('flow')

    def basic_reject(self, delivery_tag, requeue=False):
        if requeue:
            return self._called('basic_reject:requeue')
        return self._called('basic_reject')

    def basic_qos(self, prefetch_size=0, prefetch_count=0,
                  apply_global=False):
        self._called('basic_qos')


class Connection(object):
    connected = True

    def __init__(self, client):
        self.client = client

    def channel(self):
        return Channel(self)


class Transport(base.Transport):

    def establish_connection(self):
        return Connection(self.client)

    def create_channel(self, connection):
        return connection.channel()

    def drain_events(self, connection, **kwargs):
        return 'event'

    def close_connection(self, connection):
        connection.connected = False
