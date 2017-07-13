# -*- coding: utf-8 -*-
"""
    celery.security.utils
    ~~~~~~~~~~~~~~~~~~~~~

    Utilities used by the message signing serializer.

"""
from __future__ import absolute_import

import sys

from contextlib import contextmanager

from celery.exceptions import SecurityError
from celery.five import reraise

try:
    from OpenSSL import crypto
except ImportError:  # pragma: no cover
    crypto = None    # noqa

__all__ = ['reraise_errors']


@contextmanager
def reraise_errors(msg='{0!r}', errors=None):
    assert crypto is not None
    errors = (crypto.Error, ) if errors is None else errors
    try:
        yield
    except errors as exc:
        reraise(SecurityError,
                SecurityError(msg.format(exc)),
                sys.exc_info()[2])
