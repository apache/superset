# -*- coding: utf-8 -*-
"""
    celery.backends.base
    ~~~~~~~~~~~~~~~~~~~~

    Result backend base classes.

    - :class:`BaseBackend` defines the interface.

    - :class:`KeyValueStoreBackend` is a common base class
      using K/V semantics like _get and _put.

"""
from __future__ import absolute_import

import time
import sys

from datetime import timedelta

from billiard.einfo import ExceptionInfo
from kombu.serialization import (
    dumps, loads, prepare_accept_content,
    registry as serializer_registry,
)
from kombu.utils.encoding import bytes_to_str, ensure_bytes, from_utf8
from kombu.utils.url import maybe_sanitize_url

from celery import states
from celery import current_app, maybe_signature
from celery.app import current_task
from celery.exceptions import ChordError, TimeoutError, TaskRevokedError
from celery.five import items
from celery.result import (
    GroupResult, ResultBase, allow_join_result, result_from_tuple,
)
from celery.utils import timeutils
from celery.utils.functional import LRUCache
from celery.utils.log import get_logger
from celery.utils.serialization import (
    get_pickled_exception,
    get_pickleable_exception,
    create_exception_cls,
)

__all__ = ['BaseBackend', 'KeyValueStoreBackend', 'DisabledBackend']

EXCEPTION_ABLE_CODECS = frozenset(['pickle'])
PY3 = sys.version_info >= (3, 0)

logger = get_logger(__name__)


def unpickle_backend(cls, args, kwargs):
    """Return an unpickled backend."""
    return cls(*args, app=current_app._get_current_object(), **kwargs)


class _nulldict(dict):

    def ignore(self, *a, **kw):
        pass
    __setitem__ = update = setdefault = ignore


class BaseBackend(object):
    READY_STATES = states.READY_STATES
    UNREADY_STATES = states.UNREADY_STATES
    EXCEPTION_STATES = states.EXCEPTION_STATES

    TimeoutError = TimeoutError

    #: Time to sleep between polling each individual item
    #: in `ResultSet.iterate`. as opposed to the `interval`
    #: argument which is for each pass.
    subpolling_interval = None

    #: If true the backend must implement :meth:`get_many`.
    supports_native_join = False

    #: If true the backend must automatically expire results.
    #: The daily backend_cleanup periodic task will not be triggered
    #: in this case.
    supports_autoexpire = False

    #: Set to true if the backend is peristent by default.
    persistent = True

    retry_policy = {
        'max_retries': 20,
        'interval_start': 0,
        'interval_step': 1,
        'interval_max': 1,
    }

    def __init__(self, app,
                 serializer=None, max_cached_results=None, accept=None,
                 url=None, **kwargs):
        self.app = app
        conf = self.app.conf
        self.serializer = serializer or conf.CELERY_RESULT_SERIALIZER
        (self.content_type,
         self.content_encoding,
         self.encoder) = serializer_registry._encoders[self.serializer]
        cmax = max_cached_results or conf.CELERY_MAX_CACHED_RESULTS
        self._cache = _nulldict() if cmax == -1 else LRUCache(limit=cmax)
        self.accept = prepare_accept_content(
            conf.CELERY_ACCEPT_CONTENT if accept is None else accept,
        )
        self.url = url

    def as_uri(self, include_password=False):
        """Return the backend as an URI, sanitizing the password or not"""
        # when using maybe_sanitize_url(), "/" is added
        # we're stripping it for consistency
        if include_password:
            return self.url
        url = maybe_sanitize_url(self.url or '')
        return url[:-1] if url.endswith(':///') else url

    def mark_as_started(self, task_id, **meta):
        """Mark a task as started"""
        return self.store_result(task_id, meta, status=states.STARTED)

    def mark_as_done(self, task_id, result, request=None):
        """Mark task as successfully executed."""
        return self.store_result(task_id, result,
                                 status=states.SUCCESS, request=request)

    def mark_as_failure(self, task_id, exc, traceback=None, request=None):
        """Mark task as executed with failure. Stores the exception."""
        return self.store_result(task_id, exc, status=states.FAILURE,
                                 traceback=traceback, request=request)

    def chord_error_from_stack(self, callback, exc=None):
        from celery import group
        app = self.app
        backend = app._tasks[callback.task].backend
        try:
            group(
                [app.signature(errback)
                 for errback in callback.options.get('link_error') or []],
                app=app,
            ).apply_async((callback.id, ))
        except Exception as eb_exc:
            return backend.fail_from_current_stack(callback.id, exc=eb_exc)
        else:
            return backend.fail_from_current_stack(callback.id, exc=exc)

    def fail_from_current_stack(self, task_id, exc=None):
        type_, real_exc, tb = sys.exc_info()
        try:
            exc = real_exc if exc is None else exc
            ei = ExceptionInfo((type_, exc, tb))
            self.mark_as_failure(task_id, exc, ei.traceback)
            return ei
        finally:
            del(tb)

    def mark_as_retry(self, task_id, exc, traceback=None, request=None):
        """Mark task as being retries. Stores the current
        exception (if any)."""
        return self.store_result(task_id, exc, status=states.RETRY,
                                 traceback=traceback, request=request)

    def mark_as_revoked(self, task_id, reason='', request=None):
        return self.store_result(task_id, TaskRevokedError(reason),
                                 status=states.REVOKED, traceback=None,
                                 request=request)

    def prepare_exception(self, exc, serializer=None):
        """Prepare exception for serialization."""
        serializer = self.serializer if serializer is None else serializer
        if serializer in EXCEPTION_ABLE_CODECS:
            return get_pickleable_exception(exc)
        return {'exc_type': type(exc).__name__, 'exc_message': str(exc)}

    def exception_to_python(self, exc):
        """Convert serialized exception to Python exception."""
        if exc:
            if not isinstance(exc, BaseException):
                exc = create_exception_cls(
                    from_utf8(exc['exc_type']), __name__)(exc['exc_message'])
            if self.serializer in EXCEPTION_ABLE_CODECS:
                exc = get_pickled_exception(exc)
        return exc

    def prepare_value(self, result):
        """Prepare value for storage."""
        if self.serializer != 'pickle' and isinstance(result, ResultBase):
            return result.as_tuple()
        return result

    def encode(self, data):
        _, _, payload = dumps(data, serializer=self.serializer)
        return payload

    def meta_from_decoded(self, meta):
        if meta['status'] in self.EXCEPTION_STATES:
            meta['result'] = self.exception_to_python(meta['result'])
        return meta

    def decode_result(self, payload):
        return self.meta_from_decoded(self.decode(payload))

    def decode(self, payload):
        payload = PY3 and payload or str(payload)
        return loads(payload,
                     content_type=self.content_type,
                     content_encoding=self.content_encoding,
                     accept=self.accept)

    def wait_for(self, task_id,
                 timeout=None, interval=0.5, no_ack=True, on_interval=None):
        """Wait for task and return its result.

        If the task raises an exception, this exception
        will be re-raised by :func:`wait_for`.

        If `timeout` is not :const:`None`, this raises the
        :class:`celery.exceptions.TimeoutError` exception if the operation
        takes longer than `timeout` seconds.

        """

        time_elapsed = 0.0

        while 1:
            meta = self.get_task_meta(task_id)
            if meta['status'] in states.READY_STATES:
                return meta
            if on_interval:
                on_interval()
            # avoid hammering the CPU checking status.
            time.sleep(interval)
            time_elapsed += interval
            if timeout and time_elapsed >= timeout:
                raise TimeoutError('The operation timed out.')

    def prepare_expires(self, value, type=None):
        if value is None:
            value = self.app.conf.CELERY_TASK_RESULT_EXPIRES
        if isinstance(value, timedelta):
            value = timeutils.timedelta_seconds(value)
        if value is not None and type:
            return type(value)
        return value

    def prepare_persistent(self, enabled=None):
        if enabled is not None:
            return enabled
        p = self.app.conf.CELERY_RESULT_PERSISTENT
        return self.persistent if p is None else p

    def encode_result(self, result, status):
        if isinstance(result, ExceptionInfo):
            result = result.exception
        if status in self.EXCEPTION_STATES and isinstance(result, Exception):
            return self.prepare_exception(result)
        else:
            return self.prepare_value(result)

    def is_cached(self, task_id):
        return task_id in self._cache

    def store_result(self, task_id, result, status,
                     traceback=None, request=None, **kwargs):
        """Update task state and result."""
        result = self.encode_result(result, status)
        self._store_result(task_id, result, status, traceback,
                           request=request, **kwargs)
        return result

    def forget(self, task_id):
        self._cache.pop(task_id, None)
        self._forget(task_id)

    def _forget(self, task_id):
        raise NotImplementedError('backend does not implement forget.')

    def get_status(self, task_id):
        """Get the status of a task."""
        return self.get_task_meta(task_id)['status']

    def get_traceback(self, task_id):
        """Get the traceback for a failed task."""
        return self.get_task_meta(task_id).get('traceback')

    def get_result(self, task_id):
        """Get the result of a task."""
        return self.get_task_meta(task_id).get('result')

    def get_children(self, task_id):
        """Get the list of subtasks sent by a task."""
        try:
            return self.get_task_meta(task_id)['children']
        except KeyError:
            pass

    def get_task_meta(self, task_id, cache=True):
        if cache:
            try:
                return self._cache[task_id]
            except KeyError:
                pass

        meta = self._get_task_meta_for(task_id)
        if cache and meta.get('status') == states.SUCCESS:
            self._cache[task_id] = meta
        return meta

    def reload_task_result(self, task_id):
        """Reload task result, even if it has been previously fetched."""
        self._cache[task_id] = self.get_task_meta(task_id, cache=False)

    def reload_group_result(self, group_id):
        """Reload group result, even if it has been previously fetched."""
        self._cache[group_id] = self.get_group_meta(group_id, cache=False)

    def get_group_meta(self, group_id, cache=True):
        if cache:
            try:
                return self._cache[group_id]
            except KeyError:
                pass

        meta = self._restore_group(group_id)
        if cache and meta is not None:
            self._cache[group_id] = meta
        return meta

    def restore_group(self, group_id, cache=True):
        """Get the result for a group."""
        meta = self.get_group_meta(group_id, cache=cache)
        if meta:
            return meta['result']

    def save_group(self, group_id, result):
        """Store the result of an executed group."""
        return self._save_group(group_id, result)

    def delete_group(self, group_id):
        self._cache.pop(group_id, None)
        return self._delete_group(group_id)

    def cleanup(self):
        """Backend cleanup. Is run by
        :class:`celery.task.DeleteExpiredTaskMetaTask`."""
        pass

    def process_cleanup(self):
        """Cleanup actions to do at the end of a task worker process."""
        pass

    def on_task_call(self, producer, task_id):
        return {}

    def on_chord_part_return(self, task, state, result, propagate=False):
        pass

    def fallback_chord_unlock(self, group_id, body, result=None,
                              countdown=1, **kwargs):
        kwargs['result'] = [r.as_tuple() for r in result]
        self.app.tasks['celery.chord_unlock'].apply_async(
            (group_id, body, ), kwargs, countdown=countdown,
        )

    def apply_chord(self, header, partial_args, group_id, body, **options):
        result = header(*partial_args, task_id=group_id)
        self.fallback_chord_unlock(group_id, body, **options)
        return result

    def current_task_children(self, request=None):
        request = request or getattr(current_task(), 'request', None)
        if request:
            return [r.as_tuple() for r in getattr(request, 'children', [])]

    def __reduce__(self, args=(), kwargs={}):
        return (unpickle_backend, (self.__class__, args, kwargs))
BaseDictBackend = BaseBackend  # XXX compat


class KeyValueStoreBackend(BaseBackend):
    key_t = ensure_bytes
    task_keyprefix = 'celery-task-meta-'
    group_keyprefix = 'celery-taskset-meta-'
    chord_keyprefix = 'chord-unlock-'
    implements_incr = False

    def __init__(self, *args, **kwargs):
        if hasattr(self.key_t, '__func__'):
            self.key_t = self.key_t.__func__  # remove binding
        self._encode_prefixes()
        super(KeyValueStoreBackend, self).__init__(*args, **kwargs)
        if self.implements_incr:
            self.apply_chord = self._apply_chord_incr

    def _encode_prefixes(self):
        self.task_keyprefix = self.key_t(self.task_keyprefix)
        self.group_keyprefix = self.key_t(self.group_keyprefix)
        self.chord_keyprefix = self.key_t(self.chord_keyprefix)

    def get(self, key):
        raise NotImplementedError('Must implement the get method.')

    def mget(self, keys):
        raise NotImplementedError('Does not support get_many')

    def set(self, key, value):
        raise NotImplementedError('Must implement the set method.')

    def delete(self, key):
        raise NotImplementedError('Must implement the delete method')

    def incr(self, key):
        raise NotImplementedError('Does not implement incr')

    def expire(self, key, value):
        pass

    def get_key_for_task(self, task_id, key=''):
        """Get the cache key for a task by id."""
        key_t = self.key_t
        return key_t('').join([
            self.task_keyprefix, key_t(task_id), key_t(key),
        ])

    def get_key_for_group(self, group_id, key=''):
        """Get the cache key for a group by id."""
        key_t = self.key_t
        return key_t('').join([
            self.group_keyprefix, key_t(group_id), key_t(key),
        ])

    def get_key_for_chord(self, group_id, key=''):
        """Get the cache key for the chord waiting on group with given id."""
        key_t = self.key_t
        return key_t('').join([
            self.chord_keyprefix, key_t(group_id), key_t(key),
        ])

    def _strip_prefix(self, key):
        """Takes bytes, emits string."""
        key = self.key_t(key)
        for prefix in self.task_keyprefix, self.group_keyprefix:
            if key.startswith(prefix):
                return bytes_to_str(key[len(prefix):])
        return bytes_to_str(key)

    def _filter_ready(self, values, READY_STATES=states.READY_STATES):
        for k, v in values:
            if v is not None:
                v = self.decode_result(v)
                if v['status'] in READY_STATES:
                    yield k, v

    def _mget_to_results(self, values, keys):
        if hasattr(values, 'items'):
            # client returns dict so mapping preserved.
            return dict((self._strip_prefix(k), v)
                        for k, v in self._filter_ready(items(values)))
        else:
            # client returns list so need to recreate mapping.
            return dict((bytes_to_str(keys[i]), v)
                        for i, v in self._filter_ready(enumerate(values)))

    def get_many(self, task_ids, timeout=None, interval=0.5, no_ack=True,
                 READY_STATES=states.READY_STATES):
        interval = 0.5 if interval is None else interval
        ids = task_ids if isinstance(task_ids, set) else set(task_ids)
        cached_ids = set()
        cache = self._cache
        for task_id in ids:
            try:
                cached = cache[task_id]
            except KeyError:
                pass
            else:
                if cached['status'] in READY_STATES:
                    yield bytes_to_str(task_id), cached
                    cached_ids.add(task_id)

        ids.difference_update(cached_ids)
        iterations = 0
        while ids:
            keys = list(ids)
            r = self._mget_to_results(self.mget([self.get_key_for_task(k)
                                                 for k in keys]), keys)
            cache.update(r)
            ids.difference_update(set(bytes_to_str(v) for v in r))
            for key, value in items(r):
                yield bytes_to_str(key), value
            if timeout and iterations * interval >= timeout:
                raise TimeoutError('Operation timed out ({0})'.format(timeout))
            time.sleep(interval)  # don't busy loop.
            iterations += 1

    def _forget(self, task_id):
        self.delete(self.get_key_for_task(task_id))

    def _store_result(self, task_id, result, status,
                      traceback=None, request=None, **kwargs):
        meta = {'status': status, 'result': result, 'traceback': traceback,
                'children': self.current_task_children(request)}
        self.set(self.get_key_for_task(task_id), self.encode(meta))
        return result

    def _save_group(self, group_id, result):
        self.set(self.get_key_for_group(group_id),
                 self.encode({'result': result.as_tuple()}))
        return result

    def _delete_group(self, group_id):
        self.delete(self.get_key_for_group(group_id))

    def _get_task_meta_for(self, task_id):
        """Get task metadata for a task by id."""
        meta = self.get(self.get_key_for_task(task_id))
        if not meta:
            return {'status': states.PENDING, 'result': None}
        return self.decode_result(meta)

    def _restore_group(self, group_id):
        """Get task metadata for a task by id."""
        meta = self.get(self.get_key_for_group(group_id))
        # previously this was always pickled, but later this
        # was extended to support other serializers, so the
        # structure is kind of weird.
        if meta:
            meta = self.decode(meta)
            result = meta['result']
            meta['result'] = result_from_tuple(result, self.app)
            return meta

    def _apply_chord_incr(self, header, partial_args, group_id, body,
                          result=None, **options):
        self.save_group(group_id, self.app.GroupResult(group_id, result))
        return header(*partial_args, task_id=group_id)

    def on_chord_part_return(self, task, state, result, propagate=None):
        if not self.implements_incr:
            return
        app = self.app
        if propagate is None:
            propagate = app.conf.CELERY_CHORD_PROPAGATES
        gid = task.request.group
        if not gid:
            return
        key = self.get_key_for_chord(gid)
        try:
            deps = GroupResult.restore(gid, backend=task.backend)
        except Exception as exc:
            callback = maybe_signature(task.request.chord, app=app)
            logger.error('Chord %r raised: %r', gid, exc, exc_info=1)
            return self.chord_error_from_stack(
                callback,
                ChordError('Cannot restore group: {0!r}'.format(exc)),
            )
        if deps is None:
            try:
                raise ValueError(gid)
            except ValueError as exc:
                callback = maybe_signature(task.request.chord, app=app)
                logger.error('Chord callback %r raised: %r', gid, exc,
                             exc_info=1)
                return self.chord_error_from_stack(
                    callback,
                    ChordError('GroupResult {0} no longer exists'.format(gid)),
                )
        val = self.incr(key)
        size = len(deps)
        if val > size:
            logger.warning('Chord counter incremented too many times for %r',
                           gid)
        elif val == size:
            callback = maybe_signature(task.request.chord, app=app)
            j = deps.join_native if deps.supports_native_join else deps.join
            try:
                with allow_join_result():
                    ret = j(timeout=3.0, propagate=propagate)
            except Exception as exc:
                try:
                    culprit = next(deps._failed_join_report())
                    reason = 'Dependency {0.id} raised {1!r}'.format(
                        culprit, exc,
                    )
                except StopIteration:
                    reason = repr(exc)

                logger.error('Chord %r raised: %r', gid, reason, exc_info=1)
                self.chord_error_from_stack(callback, ChordError(reason))
            else:
                try:
                    callback.delay(ret)
                except Exception as exc:
                    logger.error('Chord %r raised: %r', gid, exc, exc_info=1)
                    self.chord_error_from_stack(
                        callback,
                        ChordError('Callback error: {0!r}'.format(exc)),
                    )
            finally:
                deps.delete()
                self.client.delete(key)
        else:
            self.expire(key, 86400)


class DisabledBackend(BaseBackend):
    _cache = {}   # need this attribute to reset cache in tests.

    def store_result(self, *args, **kwargs):
        pass

    def _is_disabled(self, *args, **kwargs):
        raise NotImplementedError(
            'No result backend configured.  '
            'Please see the documentation for more information.')

    def as_uri(self, *args, **kwargs):
        return 'disabled://'

    get_state = get_status = get_result = get_traceback = _is_disabled
    wait_for = get_many = _is_disabled
