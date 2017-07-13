"""
kombu.pools
===========

Public resource pools.

"""
from __future__ import absolute_import

import os

from itertools import chain

from .connection import Resource
from .five import range, values
from .messaging import Producer
from .utils import EqualityDict
from .utils.functional import lazy

__all__ = ['ProducerPool', 'PoolGroup', 'register_group',
           'connections', 'producers', 'get_limit', 'set_limit', 'reset']
_limit = [200]
_used = [False]
_groups = []
use_global_limit = object()
disable_limit_protection = os.environ.get('KOMBU_DISABLE_LIMIT_PROTECTION')


class ProducerPool(Resource):
    Producer = Producer

    def __init__(self, connections, *args, **kwargs):
        self.connections = connections
        self.Producer = kwargs.pop('Producer', None) or self.Producer
        super(ProducerPool, self).__init__(*args, **kwargs)

    def _acquire_connection(self):
        return self.connections.acquire(block=True)

    def create_producer(self):
        conn = self._acquire_connection()
        try:
            return self.Producer(conn)
        except BaseException:
            conn.release()
            raise

    def new(self):
        return lazy(self.create_producer)

    def setup(self):
        if self.limit:
            for _ in range(self.limit):
                self._resource.put_nowait(self.new())

    def close_resource(self, resource):
        pass

    def prepare(self, p):
        if callable(p):
            p = p()
        if p._channel is None:
            conn = self._acquire_connection()
            try:
                p.revive(conn)
            except BaseException:
                conn.release()
                raise
        return p

    def release(self, resource):
        if resource.__connection__:
            resource.__connection__.release()
        resource.channel = None
        super(ProducerPool, self).release(resource)


class PoolGroup(EqualityDict):

    def __init__(self, limit=None):
        self.limit = limit

    def create(self, resource, limit):
        raise NotImplementedError('PoolGroups must define ``create``')

    def __missing__(self, resource):
        limit = self.limit
        if limit is use_global_limit:
            limit = get_limit()
        if not _used[0]:
            _used[0] = True
        k = self[resource] = self.create(resource, limit)
        return k


def register_group(group):
    _groups.append(group)
    return group


class Connections(PoolGroup):

    def create(self, connection, limit):
        return connection.Pool(limit=limit)
connections = register_group(Connections(limit=use_global_limit))


class Producers(PoolGroup):

    def create(self, connection, limit):
        return ProducerPool(connections[connection], limit=limit)
producers = register_group(Producers(limit=use_global_limit))


def _all_pools():
    return chain(*[(values(g) if g else iter([])) for g in _groups])


def get_limit():
    return _limit[0]


def set_limit(limit, force=False, reset_after=False):
    limit = limit or 0
    glimit = _limit[0] or 0
    if limit < glimit:
        if not disable_limit_protection and (_used[0] and not force):
            raise RuntimeError("Can't lower limit after pool in use.")
        reset_after = True
    if limit != glimit:
        _limit[0] = limit
        for pool in _all_pools():
            pool.limit = limit
        if reset_after:
            reset()
    return limit


def reset(*args, **kwargs):
    for pool in _all_pools():
        try:
            pool.force_close_all()
        except Exception:
            pass
    for group in _groups:
        group.clear()
    _used[0] = False

try:
    from multiprocessing.util import register_after_fork
    register_after_fork(connections, reset)
except ImportError:  # pragma: no cover
    pass
