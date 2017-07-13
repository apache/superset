# -* coding: utf-8 -*-
"""
    celery.backends.cassandra
    ~~~~~~~~~~~~~~~~~~~~~~~~~

    Apache Cassandra result store backend.

"""
from __future__ import absolute_import

try:  # pragma: no cover
    import pycassa
    from thrift import Thrift
    C = pycassa.cassandra.ttypes
except ImportError:  # pragma: no cover
    pycassa = None   # noqa

import socket
import time

from celery import states
from celery.exceptions import ImproperlyConfigured
from celery.five import monotonic
from celery.utils.log import get_logger
from celery.utils.timeutils import maybe_timedelta, timedelta_seconds

from .base import BaseBackend

__all__ = ['CassandraBackend']

logger = get_logger(__name__)


class CassandraBackend(BaseBackend):
    """Highly fault tolerant Cassandra backend.

    .. attribute:: servers

        List of Cassandra servers with format: ``hostname:port``.

    :raises celery.exceptions.ImproperlyConfigured: if
        module :mod:`pycassa` is not available.

    """
    servers = []
    keyspace = None
    column_family = None
    detailed_mode = False
    _retry_timeout = 300
    _retry_wait = 3
    supports_autoexpire = True

    def __init__(self, servers=None, keyspace=None, column_family=None,
                 cassandra_options=None, detailed_mode=False, **kwargs):
        """Initialize Cassandra backend.

        Raises :class:`celery.exceptions.ImproperlyConfigured` if
        the :setting:`CASSANDRA_SERVERS` setting is not set.

        """
        super(CassandraBackend, self).__init__(**kwargs)

        self.expires = kwargs.get('expires') or maybe_timedelta(
            self.app.conf.CELERY_TASK_RESULT_EXPIRES)

        if not pycassa:
            raise ImproperlyConfigured(
                'You need to install the pycassa library to use the '
                'Cassandra backend. See https://github.com/pycassa/pycassa')

        conf = self.app.conf
        self.servers = (servers or
                        conf.get('CASSANDRA_SERVERS') or
                        self.servers)
        self.keyspace = (keyspace or
                         conf.get('CASSANDRA_KEYSPACE') or
                         self.keyspace)
        self.column_family = (column_family or
                              conf.get('CASSANDRA_COLUMN_FAMILY') or
                              self.column_family)
        self.cassandra_options = dict(conf.get('CASSANDRA_OPTIONS') or {},
                                      **cassandra_options or {})
        self.detailed_mode = (detailed_mode or
                              conf.get('CASSANDRA_DETAILED_MODE') or
                              self.detailed_mode)
        read_cons = conf.get('CASSANDRA_READ_CONSISTENCY') or 'LOCAL_QUORUM'
        write_cons = conf.get('CASSANDRA_WRITE_CONSISTENCY') or 'LOCAL_QUORUM'
        try:
            self.read_consistency = getattr(pycassa.ConsistencyLevel,
                                            read_cons)
        except AttributeError:
            self.read_consistency = pycassa.ConsistencyLevel.LOCAL_QUORUM
        try:
            self.write_consistency = getattr(pycassa.ConsistencyLevel,
                                             write_cons)
        except AttributeError:
            self.write_consistency = pycassa.ConsistencyLevel.LOCAL_QUORUM

        if not self.servers or not self.keyspace or not self.column_family:
            raise ImproperlyConfigured(
                'Cassandra backend not configured.')

        self._column_family = None

    def _retry_on_error(self, fun, *args, **kwargs):
        ts = monotonic() + self._retry_timeout
        while 1:
            try:
                return fun(*args, **kwargs)
            except (pycassa.InvalidRequestException,
                    pycassa.TimedOutException,
                    pycassa.UnavailableException,
                    pycassa.AllServersUnavailable,
                    socket.error,
                    socket.timeout,
                    Thrift.TException) as exc:
                if monotonic() > ts:
                    raise
                logger.warning('Cassandra error: %r. Retrying...', exc)
                time.sleep(self._retry_wait)

    def _get_column_family(self):
        if self._column_family is None:
            conn = pycassa.ConnectionPool(self.keyspace,
                                          server_list=self.servers,
                                          **self.cassandra_options)
            self._column_family = pycassa.ColumnFamily(
                conn, self.column_family,
                read_consistency_level=self.read_consistency,
                write_consistency_level=self.write_consistency,
            )
        return self._column_family

    def process_cleanup(self):
        if self._column_family is not None:
            self._column_family = None

    def _store_result(self, task_id, result, status,
                      traceback=None, request=None, **kwargs):
        """Store return value and status of an executed task."""

        def _do_store():
            cf = self._get_column_family()
            date_done = self.app.now()
            meta = {'status': status,
                    'date_done': date_done.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'traceback': self.encode(traceback),
                    'result': self.encode(result),
                    'children': self.encode(
                        self.current_task_children(request),
                    )}
            if self.detailed_mode:
                cf.insert(task_id, {date_done: self.encode(meta)},
                          ttl=self.expires and timedelta_seconds(self.expires))
            else:
                cf.insert(task_id, meta,
                          ttl=self.expires and timedelta_seconds(self.expires))

        return self._retry_on_error(_do_store)

    def as_uri(self, include_password=True):
        return 'cassandra://'

    def _get_task_meta_for(self, task_id):
        """Get task metadata for a task by id."""

        def _do_get():
            cf = self._get_column_family()
            try:
                if self.detailed_mode:
                    row = cf.get(task_id, column_reversed=True, column_count=1)
                    obj = self.decode(list(row.values())[0])
                else:
                    obj = cf.get(task_id)

                meta = {
                    'task_id': task_id,
                    'status': obj['status'],
                    'result': self.decode(obj['result']),
                    'date_done': obj['date_done'],
                    'traceback': self.decode(obj['traceback']),
                    'children': self.decode(obj['children']),
                }
            except (KeyError, pycassa.NotFoundException):
                meta = {'status': states.PENDING, 'result': None}
            return meta

        return self._retry_on_error(_do_get)

    def __reduce__(self, args=(), kwargs={}):
        kwargs.update(
            dict(servers=self.servers,
                 keyspace=self.keyspace,
                 column_family=self.column_family,
                 cassandra_options=self.cassandra_options))
        return super(CassandraBackend, self).__reduce__(args, kwargs)
