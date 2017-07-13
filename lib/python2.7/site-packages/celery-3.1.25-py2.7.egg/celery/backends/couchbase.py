# -*- coding: utf-8 -*-
"""
    celery.backends.couchbase
    ~~~~~~~~~~~~~~~~~~~~~~~~~

    CouchBase result store backend.

"""
from __future__ import absolute_import

import logging

try:
    from couchbase import Couchbase
    from couchbase.connection import Connection
    from couchbase.exceptions import NotFoundError
except ImportError:
    Couchbase = Connection = NotFoundError = None   # noqa

from kombu.utils.url import _parse_url

from celery.exceptions import ImproperlyConfigured
from celery.utils.timeutils import maybe_timedelta

from .base import KeyValueStoreBackend

__all__ = ['CouchBaseBackend']


class CouchBaseBackend(KeyValueStoreBackend):
    """CouchBase backend.

    :raises celery.exceptions.ImproperlyConfigured: if
        module :mod:`couchbase` is not available.

    """
    bucket = 'default'
    host = 'localhost'
    port = 8091
    username = None
    password = None
    quiet = False
    conncache = None
    unlock_gil = True
    timeout = 2.5
    transcoder = None

    def __init__(self, url=None, *args, **kwargs):
        super(CouchBaseBackend, self).__init__(*args, **kwargs)
        self.url = url

        self.expires = kwargs.get('expires') or maybe_timedelta(
            self.app.conf.CELERY_TASK_RESULT_EXPIRES)

        if Couchbase is None:
            raise ImproperlyConfigured(
                'You need to install the couchbase library to use the '
                'CouchBase backend.',
            )

        uhost = uport = uname = upass = ubucket = None
        if url:
            _, uhost, uport, uname, upass, ubucket, _ = _parse_url(url)
            ubucket = ubucket.strip('/') if ubucket else None

        config = self.app.conf.get('CELERY_COUCHBASE_BACKEND_SETTINGS', None)
        if config is not None:
            if not isinstance(config, dict):
                raise ImproperlyConfigured(
                    'Couchbase backend settings should be grouped in a dict',
                )
        else:
            config = {}

        self.host = uhost or config.get('host', self.host)
        self.port = int(uport or config.get('port', self.port))
        self.bucket = ubucket or config.get('bucket', self.bucket)
        self.username = uname or config.get('username', self.username)
        self.password = upass or config.get('password', self.password)

        self._connection = None

    def _get_connection(self):
        """Connect to the Couchbase server."""
        if self._connection is None:
            kwargs = {'bucket': self.bucket, 'host': self.host}

            if self.port:
                kwargs.update({'port': self.port})
            if self.username:
                kwargs.update({'username': self.username})
            if self.password:
                kwargs.update({'password': self.password})

            logging.debug('couchbase settings %r', kwargs)
            self._connection = Connection(**kwargs)
        return self._connection

    @property
    def connection(self):
        return self._get_connection()

    def get(self, key):
        try:
            return self.connection.get(key).value
        except NotFoundError:
            return None

    def set(self, key, value):
        self.connection.set(key, value)

    def mget(self, keys):
        return [self.get(key) for key in keys]

    def delete(self, key):
        self.connection.delete(key)
