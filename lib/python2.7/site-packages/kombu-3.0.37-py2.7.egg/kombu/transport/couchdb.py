"""
kombu.transport.couchdb
=======================

CouchDB transport.

:copyright: (c) 2010 - 2013 by David Clymer.
:license: BSD, see LICENSE for more details.

"""
from __future__ import absolute_import

import socket

from anyjson import loads, dumps

from kombu.five import Empty
from kombu.utils import uuid4
from kombu.utils.encoding import bytes_to_str

from . import virtual

try:
    import couchdb
except ImportError:  # pragma: no cover
    couchdb = None   # noqa

DEFAULT_PORT = 5984
DEFAULT_DATABASE = 'kombu_default'

__author__ = 'David Clymer <david@zettazebra.com>'


def create_message_view(db):
    from couchdb import design

    view = design.ViewDefinition('kombu', 'messages', """
        function (doc) {
          if (doc.queue && doc.payload)
            emit(doc.queue, doc);
        }
        """)
    if not view.get_doc(db):
        view.sync(db)


class Channel(virtual.Channel):
    _client = None

    view_created = False

    def _put(self, queue, message, **kwargs):
        self.client.save({'_id': uuid4().hex,
                          'queue': queue,
                          'payload': dumps(message)})

    def _get(self, queue):
        result = self._query(queue, limit=1)
        if not result:
            raise Empty()

        item = result.rows[0].value
        self.client.delete(item)
        return loads(bytes_to_str(item['payload']))

    def _purge(self, queue):
        result = self._query(queue)
        for item in result:
            self.client.delete(item.value)
        return len(result)

    def _size(self, queue):
        return len(self._query(queue))

    def _open(self):
        conninfo = self.connection.client
        dbname = conninfo.virtual_host
        proto = conninfo.ssl and 'https' or 'http'
        if not dbname or dbname == '/':
            dbname = DEFAULT_DATABASE
        port = conninfo.port or DEFAULT_PORT
        server = couchdb.Server('%s://%s:%s/' % (proto,
                                                 conninfo.hostname,
                                                 port))
        # Use username and password if avaliable
        try:
            if conninfo.userid:
                server.resource.credentials = (conninfo.userid,
                                               conninfo.password)
        except AttributeError:
            pass
        try:
            return server[dbname]
        except couchdb.http.ResourceNotFound:
            return server.create(dbname)

    def _query(self, queue, **kwargs):
        if not self.view_created:
            # if the message view is not yet set up, we'll need it now.
            create_message_view(self.client)
            self.view_created = True
        return self.client.view('kombu/messages', key=queue, **kwargs)

    @property
    def client(self):
        if self._client is None:
            self._client = self._open()
        return self._client


class Transport(virtual.Transport):
    Channel = Channel

    polling_interval = 1
    default_port = DEFAULT_PORT
    connection_errors = (
        virtual.Transport.connection_errors + (
            socket.error,
            getattr(couchdb, 'HTTPError', None),
            getattr(couchdb, 'ServerError', None),
            getattr(couchdb, 'Unauthorized', None),
        )
    )
    channel_errors = (
        virtual.Transport.channel_errors + (
            getattr(couchdb, 'HTTPError', None),
            getattr(couchdb, 'ServerError', None),
            getattr(couchdb, 'PreconditionFailed', None),
            getattr(couchdb, 'ResourceConflict', None),
            getattr(couchdb, 'ResourceNotFound', None),
        )
    )
    driver_type = 'couchdb'
    driver_name = 'couchdb'

    def __init__(self, *args, **kwargs):
        if couchdb is None:
            raise ImportError('Missing couchdb library (pip install couchdb)')
        super(Transport, self).__init__(*args, **kwargs)

    def driver_version(self):
        return couchdb.__version__
