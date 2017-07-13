# -*- coding: utf-8 -*-
"""
    celery.concurrency
    ~~~~~~~~~~~~~~~~~~

    Pool implementation abstract factory, and alias definitions.

"""
from __future__ import absolute_import

# Import from kombu directly as it's used
# early in the import stage, where celery.utils loads
# too much (e.g. for eventlet patching)
from kombu.utils import symbol_by_name

__all__ = ['get_implementation']

ALIASES = {
    'prefork': 'celery.concurrency.prefork:TaskPool',
    'eventlet': 'celery.concurrency.eventlet:TaskPool',
    'gevent': 'celery.concurrency.gevent:TaskPool',
    'threads': 'celery.concurrency.threads:TaskPool',
    'solo': 'celery.concurrency.solo:TaskPool',
    'processes': 'celery.concurrency.prefork:TaskPool',  # XXX compat alias
}


def get_implementation(cls):
    return symbol_by_name(cls, ALIASES)
