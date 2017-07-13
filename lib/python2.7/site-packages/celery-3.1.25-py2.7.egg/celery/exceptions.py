# -*- coding: utf-8 -*-
"""
    celery.exceptions
    ~~~~~~~~~~~~~~~~~

    This module contains all exceptions used by the Celery API.

"""
from __future__ import absolute_import

import numbers

from .five import string_t

from billiard.exceptions import (  # noqa
    SoftTimeLimitExceeded, TimeLimitExceeded, WorkerLostError, Terminated,
)

__all__ = ['SecurityError', 'Ignore', 'QueueNotFound',
           'WorkerShutdown', 'WorkerTerminate',
           'ImproperlyConfigured', 'NotRegistered', 'AlreadyRegistered',
           'TimeoutError', 'MaxRetriesExceededError', 'Retry',
           'TaskRevokedError', 'NotConfigured', 'AlwaysEagerIgnored',
           'InvalidTaskError', 'ChordError', 'CPendingDeprecationWarning',
           'CDeprecationWarning', 'FixupWarning', 'DuplicateNodenameWarning',
           'SoftTimeLimitExceeded', 'TimeLimitExceeded', 'WorkerLostError',
           'Terminated']

UNREGISTERED_FMT = """\
Task of kind {0} is not registered, please make sure it's imported.\
"""


class SecurityError(Exception):
    """Security related exceptions.

    Handle with care.

    """


class Ignore(Exception):
    """A task can raise this to ignore doing state updates."""


class Reject(Exception):
    """A task can raise this if it wants to reject/requeue the message."""

    def __init__(self, reason=None, requeue=False):
        self.reason = reason
        self.requeue = requeue
        super(Reject, self).__init__(reason, requeue)

    def __repr__(self):
        return 'reject requeue=%s: %s' % (self.requeue, self.reason)


class WorkerTerminate(SystemExit):
    """Signals that the worker should terminate immediately."""
SystemTerminate = WorkerTerminate  # XXX compat


class WorkerShutdown(SystemExit):
    """Signals that the worker should perform a warm shutdown."""


class QueueNotFound(KeyError):
    """Task routed to a queue not in CELERY_QUEUES."""


class ImproperlyConfigured(ImportError):
    """Celery is somehow improperly configured."""


class NotRegistered(KeyError):
    """The task is not registered."""

    def __repr__(self):
        return UNREGISTERED_FMT.format(self)


class AlreadyRegistered(Exception):
    """The task is already registered."""


class TimeoutError(Exception):
    """The operation timed out."""


class MaxRetriesExceededError(Exception):
    """The tasks max restart limit has been exceeded."""


class Retry(Exception):
    """The task is to be retried later."""

    #: Optional message describing context of retry.
    message = None

    #: Exception (if any) that caused the retry to happen.
    exc = None

    #: Time of retry (ETA), either :class:`numbers.Real` or
    #: :class:`~datetime.datetime`.
    when = None

    def __init__(self, message=None, exc=None, when=None, **kwargs):
        from kombu.utils.encoding import safe_repr
        self.message = message
        if isinstance(exc, string_t):
            self.exc, self.excs = None, exc
        else:
            self.exc, self.excs = exc, safe_repr(exc) if exc else None
        self.when = when
        Exception.__init__(self, exc, when, **kwargs)

    def humanize(self):
        if isinstance(self.when, numbers.Real):
            return 'in {0.when}s'.format(self)
        return 'at {0.when}'.format(self)

    def __str__(self):
        if self.message:
            return self.message
        if self.excs:
            return 'Retry {0}: {1}'.format(self.humanize(), self.excs)
        return 'Retry {0}'.format(self.humanize())

    def __reduce__(self):
        return self.__class__, (self.message, self.excs, self.when)
RetryTaskError = Retry   # XXX compat


class TaskRevokedError(Exception):
    """The task has been revoked, so no result available."""


class NotConfigured(UserWarning):
    """Celery has not been configured, as no config module has been found."""


class AlwaysEagerIgnored(UserWarning):
    """send_task ignores CELERY_ALWAYS_EAGER option"""


class InvalidTaskError(Exception):
    """The task has invalid data or is not properly constructed."""


class IncompleteStream(Exception):
    """Found the end of a stream of data, but the data is not yet complete."""


class ChordError(Exception):
    """A task part of the chord raised an exception."""


class CPendingDeprecationWarning(PendingDeprecationWarning):
    pass


class CDeprecationWarning(DeprecationWarning):
    pass


class FixupWarning(UserWarning):
    pass


class DuplicateNodenameWarning(UserWarning):
    """Multiple workers are using the same nodename."""
