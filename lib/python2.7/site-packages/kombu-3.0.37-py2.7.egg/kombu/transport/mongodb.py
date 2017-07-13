"""
kombu.transport.mongodb
=======================

MongoDB transport.

:copyright: (c) 2010 - 2013 by Flavio Percoco Premoli.
:license: BSD, see LICENSE for more details.

"""
from __future__ import absolute_import

import pymongo

from pymongo import errors
from anyjson import loads, dumps
from pymongo import MongoClient, uri_parser

from kombu.five import Empty
from kombu.syn import _detect_environment
from kombu.utils.encoding import bytes_to_str

from . import virtual

try:
    from pymongo.cursor import CursorType
except ImportError:
    class CursorType(object):  # noqa
        pass

DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 27017

DEFAULT_MESSAGES_COLLECTION = 'messages'
DEFAULT_ROUTING_COLLECTION = 'messages.routing'
DEFAULT_BROADCAST_COLLECTION = 'messages.broadcast'


class BroadcastCursor(object):
    """Cursor for broadcast queues."""

    def __init__(self, cursor):
        self._cursor = cursor

        self.purge(rewind=False)

    def get_size(self):
        return self._cursor.count() - self._offset

    def close(self):
        self._cursor.close()

    def purge(self, rewind=True):
        if rewind:
            self._cursor.rewind()

        # Fast forward the cursor past old events
        self._offset = self._cursor.count()
        self._cursor = self._cursor.skip(self._offset)

    def __iter__(self):
        return self

    def __next__(self):
        while True:
            try:
                msg = next(self._cursor)
            except pymongo.errors.OperationFailure as exc:
                # In some cases tailed cursor can become invalid
                # and have to be reinitalized
                if 'not valid at server' in exc.message:
                    self.purge()

                    continue

                raise
            else:
                break

        self._offset += 1

        return msg
    next = __next__


class Channel(virtual.Channel):
    _client = None
    supports_fanout = True
    _fanout_queues = {}

    def __init__(self, *vargs, **kwargs):
        super(Channel, self).__init__(*vargs, **kwargs)

        self._broadcast_cursors = {}

        # Evaluate connection
        self._create_client()

    def _new_queue(self, queue, **kwargs):
        pass

    def _get(self, queue):
        if queue in self._fanout_queues:
            try:
                msg = next(self.get_broadcast_cursor(queue))
            except StopIteration:
                msg = None
        else:
            msg = self.get_messages().find_and_modify(
                query={'queue': queue},
                sort={'_id': pymongo.ASCENDING},
                remove=True,
            )

        if msg is None:
            raise Empty()

        return loads(bytes_to_str(msg['payload']))

    def _size(self, queue):
        if queue in self._fanout_queues:
            return self.get_broadcast_cursor(queue).get_size()

        return self.get_messages().find({'queue': queue}).count()

    def _put(self, queue, message, **kwargs):
        self.get_messages().insert({'payload': dumps(message),
                                    'queue': queue})

    def _purge(self, queue):
        size = self._size(queue)

        if queue in self._fanout_queues:
            self.get_broadcaset_cursor(queue).purge()
        else:
            self.get_messages().remove({'queue': queue})

        return size

    def _parse_uri(self, scheme='mongodb://'):
        # See mongodb uri documentation:
        # http://docs.mongodb.org/manual/reference/connection-string/
        client = self.connection.client
        hostname = client.hostname

        if not hostname.startswith(scheme):
            hostname = scheme + hostname

        if not hostname[len(scheme):]:
            hostname += DEFAULT_HOST

        if client.userid and '@' not in hostname:
            head, tail = hostname.split('://')

            credentials = client.userid
            if client.password:
                credentials += ':' + client.password

            hostname = head + '://' + credentials + '@' + tail

        port = client.port if client.port is not None else DEFAULT_PORT

        parsed = uri_parser.parse_uri(hostname, port)

        dbname = parsed['database'] or client.virtual_host

        if dbname in ('/', None):
            dbname = 'kombu_default'

        options = {
            'auto_start_request': True,
            'ssl': client.ssl,
            'connectTimeoutMS': (int(client.connect_timeout * 1000)
                                 if client.connect_timeout else None),
        }
        options.update(client.transport_options)
        options.update(parsed['options'])

        return hostname, dbname, options

    def _prepare_client_options(self, options):
        if pymongo.version_tuple >= (3, ):
            options.pop('auto_start_request', None)
        return options

    def _open(self, scheme='mongodb://'):
        hostname, dbname, options = self._parse_uri(scheme=scheme)

        conf = self._prepare_client_options(options)
        conf['host'] = hostname

        env = _detect_environment()
        if env == 'gevent':
            from gevent import monkey
            monkey.patch_all()
        elif env == 'eventlet':
            from eventlet import monkey_patch
            monkey_patch()

        mongoconn = MongoClient(**conf)
        database = mongoconn[dbname]

        version = mongoconn.server_info()['version']
        if tuple(map(int, version.split('.')[:2])) < (1, 3):
            raise NotImplementedError(
                'Kombu requires MongoDB version 1.3+ (server is {0})'.format(
                    version))

        self._create_broadcast(database, options)

        self._client = database

    def _create_broadcast(self, database, options):
        '''Create capped collection for broadcast messages.'''
        if DEFAULT_BROADCAST_COLLECTION in database.collection_names():
            return

        capsize = options.get('capped_queue_size') or 100000
        database.create_collection(DEFAULT_BROADCAST_COLLECTION,
                                   size=capsize, capped=True)

    def _ensure_indexes(self):
        '''Ensure indexes on collections.'''
        self.get_messages().ensure_index(
            [('queue', 1), ('_id', 1)], background=True,
        )
        self.get_broadcast().ensure_index([('queue', 1)])
        self.get_routing().ensure_index([('queue', 1), ('exchange', 1)])

    # TODO Store a more complete exchange metatable in the routing collection
    def get_table(self, exchange):
        """Get table of bindings for ``exchange``."""
        localRoutes = frozenset(self.state.exchanges[exchange]['table'])
        brokerRoutes = self.get_messages().routing.find(
            {'exchange': exchange}
        )

        return localRoutes | frozenset((r['routing_key'],
                                        r['pattern'],
                                        r['queue']) for r in brokerRoutes)

    def _put_fanout(self, exchange, message, routing_key, **kwargs):
        """Deliver fanout message."""
        self.get_broadcast().insert({'payload': dumps(message),
                                     'queue': exchange})

    def _queue_bind(self, exchange, routing_key, pattern, queue):
        if self.typeof(exchange).type == 'fanout':
            self.create_broadcast_cursor(exchange, routing_key, pattern, queue)
            self._fanout_queues[queue] = exchange

        meta = {'exchange': exchange,
                'queue': queue,
                'routing_key': routing_key,
                'pattern': pattern}
        self.get_routing().update(meta, meta, upsert=True)

    def queue_delete(self, queue, **kwargs):
        self.get_routing().remove({'queue': queue})

        super(Channel, self).queue_delete(queue, **kwargs)

        if queue in self._fanout_queues:
            try:
                cursor = self._broadcast_cursors.pop(queue)
            except KeyError:
                pass
            else:
                cursor.close()

                self._fanout_queues.pop(queue)

    def _create_client(self):
        self._open()
        self._ensure_indexes()

    @property
    def client(self):
        if self._client is None:
            self._create_client()
        return self._client

    def get_messages(self):
        return self.client[DEFAULT_MESSAGES_COLLECTION]

    def get_routing(self):
        return self.client[DEFAULT_ROUTING_COLLECTION]

    def get_broadcast(self):
        return self.client[DEFAULT_BROADCAST_COLLECTION]

    def get_broadcast_cursor(self, queue):
        try:
            return self._broadcast_cursors[queue]
        except KeyError:
            # Cursor may be absent when Channel created more than once.
            # _fanout_queues is a class-level mutable attribute so it's
            # shared over all Channel instances.
            return self.create_broadcast_cursor(
                self._fanout_queues[queue], None, None, queue,
            )

    def create_broadcast_cursor(self, exchange, routing_key, pattern, queue):
        if pymongo.version_tuple >= (3, ):
            query = dict(filter={'queue': exchange},
                         sort=[('$natural', 1)],
                         cursor_type=CursorType.TAILABLE
                         )
        else:
            query = dict(query={'queue': exchange},
                         sort=[('$natural', 1)],
                         tailable=True
                         )

        cursor = self.get_broadcast().find(**query)
        ret = self._broadcast_cursors[queue] = BroadcastCursor(cursor)
        return ret


class Transport(virtual.Transport):
    Channel = Channel

    can_parse_url = True
    polling_interval = 1
    default_port = DEFAULT_PORT
    connection_errors = (
        virtual.Transport.connection_errors + (errors.ConnectionFailure, )
    )
    channel_errors = (
        virtual.Transport.channel_errors + (
            errors.ConnectionFailure,
            errors.OperationFailure)
    )
    driver_type = 'mongodb'
    driver_name = 'pymongo'

    def driver_version(self):
        return pymongo.version
