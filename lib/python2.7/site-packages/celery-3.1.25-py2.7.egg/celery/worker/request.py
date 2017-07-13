# -*- coding: utf-8 -*-
"""This module defines the :class:`Request` class, that specifies
how tasks are executed."""
from __future__ import absolute_import, unicode_literals

import logging
import sys

from datetime import datetime
from weakref import ref

from billiard.common import TERM_SIGNAME
from kombu.utils.encoding import safe_repr, safe_str
from kombu.utils.objects import cached_property

from celery import signals
from celery.app.trace import trace_task, trace_task_ret
from celery.exceptions import (
    Ignore, TaskRevokedError, InvalidTaskError,
    SoftTimeLimitExceeded, TimeLimitExceeded,
    WorkerLostError, Terminated, Retry, Reject,
)
from celery.five import python_2_unicode_compatible, string
from celery.platforms import signals as _signals
from celery.utils.functional import maybe, noop
from celery.utils.log import get_logger
from celery.utils.nodenames import gethostname
from celery.utils.time import maybe_iso8601, timezone, maybe_make_aware
from celery.utils.serialization import get_pickled_exception

from . import state

__all__ = ['Request']

IS_PYPY = hasattr(sys, 'pypy_version_info')

logger = get_logger(__name__)
debug, info, warn, error = (logger.debug, logger.info,
                            logger.warning, logger.error)
_does_info = False
_does_debug = False


def __optimize__():
    # this is also called by celery.app.trace.setup_worker_optimizations
    global _does_debug
    global _does_info
    _does_debug = logger.isEnabledFor(logging.DEBUG)
    _does_info = logger.isEnabledFor(logging.INFO)
__optimize__()

# Localize
tz_or_local = timezone.tz_or_local
send_revoked = signals.task_revoked.send

task_accepted = state.task_accepted
task_ready = state.task_ready
revoked_tasks = state.revoked


@python_2_unicode_compatible
class Request(object):
    """A request for task execution."""
    acknowledged = False
    time_start = None
    worker_pid = None
    time_limits = (None, None)
    _already_revoked = False
    _terminate_on_ack = None
    _apply_result = None
    _tzlocal = None

    if not IS_PYPY:  # pragma: no cover
        __slots__ = (
            'app', 'type', 'name', 'id', 'root_id', 'parent_id',
            'on_ack', 'body', 'hostname', 'eventer', 'connection_errors',
            'task', 'eta', 'expires', 'request_dict', 'on_reject', 'utc',
            'content_type', 'content_encoding', 'argsrepr', 'kwargsrepr',
            '_decoded',
            '__weakref__', '__dict__',
        )

    def __init__(self, message, on_ack=noop,
                 hostname=None, eventer=None, app=None,
                 connection_errors=None, request_dict=None,
                 task=None, on_reject=noop, body=None,
                 headers=None, decoded=False, utc=True,
                 maybe_make_aware=maybe_make_aware,
                 maybe_iso8601=maybe_iso8601, **opts):
        if headers is None:
            headers = message.headers
        if body is None:
            body = message.body
        self.app = app
        self.message = message
        self.body = body
        self.utc = utc
        self._decoded = decoded
        if decoded:
            self.content_type = self.content_encoding = None
        else:
            self.content_type, self.content_encoding = (
                message.content_type, message.content_encoding,
            )

        self.id = headers['id']
        type = self.type = self.name = headers['task']
        self.root_id = headers.get('root_id')
        self.parent_id = headers.get('parent_id')
        if 'shadow' in headers:
            self.name = headers['shadow'] or self.name
        if 'timelimit' in headers:
            self.time_limits = headers['timelimit']
        self.argsrepr = headers.get('argsrepr', '')
        self.kwargsrepr = headers.get('kwargsrepr', '')
        self.on_ack = on_ack
        self.on_reject = on_reject
        self.hostname = hostname or gethostname()
        self.eventer = eventer
        self.connection_errors = connection_errors or ()
        self.task = task or self.app.tasks[type]

        # timezone means the message is timezone-aware, and the only timezone
        # supported at this point is UTC.
        eta = headers.get('eta')
        if eta is not None:
            try:
                eta = maybe_iso8601(eta)
            except (AttributeError, ValueError, TypeError) as exc:
                raise InvalidTaskError(
                    'invalid ETA value {0!r}: {1}'.format(eta, exc))
            self.eta = maybe_make_aware(eta, self.tzlocal)
        else:
            self.eta = None

        expires = headers.get('expires')
        if expires is not None:
            try:
                expires = maybe_iso8601(expires)
            except (AttributeError, ValueError, TypeError) as exc:
                raise InvalidTaskError(
                    'invalid expires value {0!r}: {1}'.format(expires, exc))
            self.expires = maybe_make_aware(expires, self.tzlocal)
        else:
            self.expires = None

        delivery_info = message.delivery_info or {}
        properties = message.properties or {}
        headers.update({
            'reply_to': properties.get('reply_to'),
            'correlation_id': properties.get('correlation_id'),
            'delivery_info': {
                'exchange': delivery_info.get('exchange'),
                'routing_key': delivery_info.get('routing_key'),
                'priority': properties.get('priority'),
                'redelivered': delivery_info.get('redelivered'),
            }

        })
        self.request_dict = headers

    @property
    def delivery_info(self):
        return self.request_dict['delivery_info']

    def execute_using_pool(self, pool, **kwargs):
        """Used by the worker to send this task to the pool.

        Arguments:
            pool (~celery.concurrency.base.TaskPool): The execution pool
                used to execute this request.

        Raises:
            celery.exceptions.TaskRevokedError: if the task was revoked.
        """
        task_id = self.id
        task = self.task
        if self.revoked():
            raise TaskRevokedError(task_id)

        time_limit, soft_time_limit = self.time_limits
        result = pool.apply_async(
            trace_task_ret,
            args=(self.type, task_id, self.request_dict, self.body,
                  self.content_type, self.content_encoding),
            accept_callback=self.on_accepted,
            timeout_callback=self.on_timeout,
            callback=self.on_success,
            error_callback=self.on_failure,
            soft_timeout=soft_time_limit or task.soft_time_limit,
            timeout=time_limit or task.time_limit,
            correlation_id=task_id,
        )
        # cannot create weakref to None
        self._apply_result = maybe(ref, result)
        return result

    def execute(self, loglevel=None, logfile=None):
        """Execute the task in a :func:`~celery.app.trace.trace_task`.

        Arguments:
            loglevel (int): The loglevel used by the task.
            logfile (str): The logfile used by the task.
        """
        if self.revoked():
            return

        # acknowledge task as being processed.
        if not self.task.acks_late:
            self.acknowledge()

        request = self.request_dict
        args, kwargs, embed = self._payload
        request.update({'loglevel': loglevel, 'logfile': logfile,
                        'hostname': self.hostname, 'is_eager': False,
                        'args': args, 'kwargs': kwargs}, **embed or {})
        retval = trace_task(self.task, self.id, args, kwargs, request,
                            hostname=self.hostname, loader=self.app.loader,
                            app=self.app)[0]
        self.acknowledge()
        return retval

    def maybe_expire(self):
        """If expired, mark the task as revoked."""
        if self.expires:
            now = datetime.now(self.expires.tzinfo)
            if now > self.expires:
                revoked_tasks.add(self.id)
                return True

    def terminate(self, pool, signal=None):
        signal = _signals.signum(signal or TERM_SIGNAME)
        if self.time_start:
            pool.terminate_job(self.worker_pid, signal)
            self._announce_revoked('terminated', True, signal, False)
        else:
            self._terminate_on_ack = pool, signal
        if self._apply_result is not None:
            obj = self._apply_result()  # is a weakref
            if obj is not None:
                obj.terminate(signal)

    def _announce_revoked(self, reason, terminated, signum, expired):
        task_ready(self)
        self.send_event('task-revoked',
                        terminated=terminated, signum=signum, expired=expired)
        self.task.backend.mark_as_revoked(
            self.id, reason, request=self, store_result=self.store_errors,
        )
        self.acknowledge()
        self._already_revoked = True
        send_revoked(self.task, request=self,
                     terminated=terminated, signum=signum, expired=expired)

    def revoked(self):
        """If revoked, skip task and mark state."""
        expired = False
        if self._already_revoked:
            return True
        if self.expires:
            expired = self.maybe_expire()
        if self.id in revoked_tasks:
            info('Discarding revoked task: %s[%s]', self.name, self.id)
            self._announce_revoked(
                'expired' if expired else 'revoked', False, None, expired,
            )
            return True
        return False

    def send_event(self, type, **fields):
        if self.eventer and self.eventer.enabled and self.task.send_events:
            self.eventer.send(type, uuid=self.id, **fields)

    def on_accepted(self, pid, time_accepted):
        """Handler called when task is accepted by worker pool."""
        self.worker_pid = pid
        self.time_start = time_accepted
        task_accepted(self)
        if not self.task.acks_late:
            self.acknowledge()
        self.send_event('task-started')
        if _does_debug:
            debug('Task accepted: %s[%s] pid:%r', self.name, self.id, pid)
        if self._terminate_on_ack is not None:
            self.terminate(*self._terminate_on_ack)

    def on_timeout(self, soft, timeout):
        """Handler called if the task times out."""
        task_ready(self)
        if soft:
            warn('Soft time limit (%ss) exceeded for %s[%s]',
                 soft, self.name, self.id)
            exc = SoftTimeLimitExceeded(soft)
        else:
            error('Hard time limit (%ss) exceeded for %s[%s]',
                  timeout, self.name, self.id)
            exc = TimeLimitExceeded(timeout)

        self.task.backend.mark_as_failure(
            self.id, exc, request=self, store_result=self.store_errors,
        )

        if self.task.acks_late:
            self.acknowledge()

    def on_success(self, failed__retval__runtime, **kwargs):
        """Handler called if the task was successfully processed."""
        failed, retval, runtime = failed__retval__runtime
        if failed:
            if isinstance(retval.exception, (SystemExit, KeyboardInterrupt)):
                raise retval.exception
            return self.on_failure(retval, return_ok=True)
        task_ready(self)

        if self.task.acks_late:
            self.acknowledge()

        self.send_event('task-succeeded', result=retval, runtime=runtime)

    def on_retry(self, exc_info):
        """Handler called if the task should be retried."""
        if self.task.acks_late:
            self.acknowledge()

        self.send_event('task-retried',
                        exception=safe_repr(exc_info.exception.exc),
                        traceback=safe_str(exc_info.traceback))

    def on_failure(self, exc_info, send_failed_event=True, return_ok=False):
        """Handler called if the task raised an exception."""
        task_ready(self)
        if isinstance(exc_info.exception, MemoryError):
            raise MemoryError('Process got: %s' % (exc_info.exception,))
        elif isinstance(exc_info.exception, Reject):
            return self.reject(requeue=exc_info.exception.requeue)
        elif isinstance(exc_info.exception, Ignore):
            return self.acknowledge()

        exc = exc_info.exception

        if isinstance(exc, Retry):
            return self.on_retry(exc_info)

        # These are special cases where the process wouldn't've had
        # time to write the result.
        if isinstance(exc, Terminated):
            self._announce_revoked(
                'terminated', True, string(exc), False)
            send_failed_event = False  # already sent revoked event
        elif isinstance(exc, WorkerLostError) or not return_ok:
            self.task.backend.mark_as_failure(
                self.id, exc, request=self, store_result=self.store_errors,
            )
        # (acks_late) acknowledge after result stored.
        if self.task.acks_late:
            requeue = self.delivery_info.get('redelivered', None) is False
            reject = (
                self.task.reject_on_worker_lost and
                isinstance(exc, WorkerLostError)
            )
            if reject:
                self.reject(requeue=requeue)
                send_failed_event = False
            else:
                self.acknowledge()

        if send_failed_event:
            self.send_event(
                'task-failed',
                exception=safe_repr(get_pickled_exception(exc_info.exception)),
                traceback=exc_info.traceback,
            )

        if not return_ok:
            error('Task handler raised error: %r', exc,
                  exc_info=exc_info.exc_info)

    def acknowledge(self):
        """Acknowledge task."""
        if not self.acknowledged:
            self.on_ack(logger, self.connection_errors)
            self.acknowledged = True

    def reject(self, requeue=False):
        if not self.acknowledged:
            self.on_reject(logger, self.connection_errors, requeue)
            self.acknowledged = True
            self.send_event('task-rejected', requeue=requeue)

    def info(self, safe=False):
        return {
            'id': self.id,
            'name': self.name,
            'args': self.argsrepr,
            'kwargs': self.kwargsrepr,
            'type': self.type,
            'body': self.body,
            'hostname': self.hostname,
            'time_start': self.time_start,
            'acknowledged': self.acknowledged,
            'delivery_info': self.delivery_info,
            'worker_pid': self.worker_pid,
        }

    def __str__(self):
        return ' '.join([
            self.humaninfo(),
            ' ETA:[{0}]'.format(self.eta) if self.eta else '',
            ' expires:[{0}]'.format(self.expires) if self.expires else '',
        ])

    def humaninfo(self):
        return '{0.name}[{0.id}]'.format(self)

    def __repr__(self):
        return '<{0}: {1} {2} {3}>'.format(
            type(self).__name__, self.humaninfo(),
            self.argsrepr, self.kwargsrepr,
        )

    @property
    def tzlocal(self):
        if self._tzlocal is None:
            self._tzlocal = self.app.conf.timezone
        return self._tzlocal

    @property
    def store_errors(self):
        return (not self.task.ignore_result or
                self.task.store_errors_even_if_ignored)

    @property
    def task_id(self):
        # XXX compat
        return self.id

    @task_id.setter  # noqa
    def task_id(self, value):
        self.id = value

    @property
    def task_name(self):
        # XXX compat
        return self.name

    @task_name.setter  # noqa
    def task_name(self, value):
        self.name = value

    @property
    def reply_to(self):
        # used by rpc backend when failures reported by parent process
        return self.request_dict['reply_to']

    @property
    def correlation_id(self):
        # used similarly to reply_to
        return self.request_dict['correlation_id']

    @cached_property
    def _payload(self):
        return self.body if self._decoded else self.message.payload

    @cached_property
    def chord(self):
        # used by backend.mark_as_failure when failure is reported
        # by parent process
        _, _, embed = self._payload
        return embed.get('chord')

    @cached_property
    def errbacks(self):
        # used by backend.mark_as_failure when failure is reported
        # by parent process
        _, _, embed = self._payload
        return embed.get('errbacks')

    @cached_property
    def group(self):
        # used by backend.on_chord_part_return when failures reported
        # by parent process
        return self.request_dict['group']


def create_request_cls(base, task, pool, hostname, eventer,
                       ref=ref, revoked_tasks=revoked_tasks,
                       task_ready=task_ready):
    from celery.app.trace import trace_task_ret as trace
    default_time_limit = task.time_limit
    default_soft_time_limit = task.soft_time_limit
    apply_async = pool.apply_async
    acks_late = task.acks_late
    events = eventer and eventer.enabled

    class Request(base):

        def execute_using_pool(self, pool, **kwargs):
            task_id = self.id
            if (self.expires or task_id in revoked_tasks) and self.revoked():
                raise TaskRevokedError(task_id)

            time_limit, soft_time_limit = self.time_limits
            result = apply_async(
                trace,
                args=(self.type, task_id, self.request_dict, self.body,
                      self.content_type, self.content_encoding),
                accept_callback=self.on_accepted,
                timeout_callback=self.on_timeout,
                callback=self.on_success,
                error_callback=self.on_failure,
                soft_timeout=soft_time_limit or default_soft_time_limit,
                timeout=time_limit or default_time_limit,
                correlation_id=task_id,
            )
            # cannot create weakref to None
            self._apply_result = maybe(ref, result)
            return result

        def on_success(self, failed__retval__runtime, **kwargs):
            failed, retval, runtime = failed__retval__runtime
            if failed:
                if isinstance(retval.exception, (
                        SystemExit, KeyboardInterrupt)):
                    raise retval.exception
                return self.on_failure(retval, return_ok=True)
            task_ready(self)

            if acks_late:
                self.acknowledge()

            if events:
                self.send_event(
                    'task-succeeded', result=retval, runtime=runtime,
                )

    return Request
