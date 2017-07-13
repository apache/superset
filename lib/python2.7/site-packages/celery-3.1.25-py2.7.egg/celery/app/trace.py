# -*- coding: utf-8 -*-
"""
    celery.app.trace
    ~~~~~~~~~~~~~~~~

    This module defines how the task execution is traced:
    errors are recorded, handlers are applied and so on.

"""
from __future__ import absolute_import

# ## ---
# This is the heart of the worker, the inner loop so to speak.
# It used to be split up into nice little classes and methods,
# but in the end it only resulted in bad performance and horrible tracebacks,
# so instead we now use one closure per task class.

import os
import socket
import sys

from warnings import warn

from billiard.einfo import ExceptionInfo
from kombu.exceptions import EncodeError
from kombu.utils import kwdict

from celery import current_app, group
from celery import states, signals
from celery._state import _task_stack
from celery.app import set_default_app
from celery.app.task import Task as BaseTask, Context
from celery.exceptions import Ignore, Reject, Retry
from celery.utils.log import get_logger
from celery.utils.objects import mro_lookup
from celery.utils.serialization import (
    get_pickleable_exception,
    get_pickleable_etype,
)

__all__ = ['TraceInfo', 'build_tracer', 'trace_task', 'eager_trace_task',
           'setup_worker_optimizations', 'reset_worker_optimizations']

_logger = get_logger(__name__)

send_prerun = signals.task_prerun.send
send_postrun = signals.task_postrun.send
send_success = signals.task_success.send
STARTED = states.STARTED
SUCCESS = states.SUCCESS
IGNORED = states.IGNORED
REJECTED = states.REJECTED
RETRY = states.RETRY
FAILURE = states.FAILURE
EXCEPTION_STATES = states.EXCEPTION_STATES
IGNORE_STATES = frozenset([IGNORED, RETRY, REJECTED])

#: set by :func:`setup_worker_optimizations`
_tasks = None
_patched = {}


def task_has_custom(task, attr):
    """Return true if the task or one of its bases
    defines ``attr`` (excluding the one in BaseTask)."""
    return mro_lookup(task.__class__, attr, stop=(BaseTask, object),
                      monkey_patched=['celery.app.task'])


class TraceInfo(object):
    __slots__ = ('state', 'retval')

    def __init__(self, state, retval=None):
        self.state = state
        self.retval = retval

    def handle_error_state(self, task, eager=False):
        store_errors = not eager
        if task.ignore_result:
            store_errors = task.store_errors_even_if_ignored

        return {
            RETRY: self.handle_retry,
            FAILURE: self.handle_failure,
        }[self.state](task, store_errors=store_errors)

    def handle_retry(self, task, store_errors=True):
        """Handle retry exception."""
        # the exception raised is the Retry semi-predicate,
        # and it's exc' attribute is the original exception raised (if any).
        req = task.request
        type_, _, tb = sys.exc_info()
        try:
            reason = self.retval
            einfo = ExceptionInfo((type_, reason, tb))
            if store_errors:
                task.backend.mark_as_retry(
                    req.id, reason.exc, einfo.traceback, request=req,
                )
            task.on_retry(reason.exc, req.id, req.args, req.kwargs, einfo)
            signals.task_retry.send(sender=task, request=req,
                                    reason=reason, einfo=einfo)
            return einfo
        finally:
            del(tb)

    def handle_failure(self, task, store_errors=True):
        """Handle exception."""
        req = task.request
        type_, _, tb = sys.exc_info()
        try:
            exc = self.retval
            einfo = ExceptionInfo()
            einfo.exception = get_pickleable_exception(einfo.exception)
            einfo.type = get_pickleable_etype(einfo.type)
            if store_errors:
                task.backend.mark_as_failure(
                    req.id, exc, einfo.traceback, request=req,
                )
            task.on_failure(exc, req.id, req.args, req.kwargs, einfo)
            signals.task_failure.send(sender=task, task_id=req.id,
                                      exception=exc, args=req.args,
                                      kwargs=req.kwargs,
                                      traceback=tb,
                                      einfo=einfo)
            return einfo
        finally:
            del(tb)


def build_tracer(name, task, loader=None, hostname=None, store_errors=True,
                 Info=TraceInfo, eager=False, propagate=False, app=None,
                 IGNORE_STATES=IGNORE_STATES):
    """Return a function that traces task execution; catches all
    exceptions and updates result backend with the state and result

    If the call was successful, it saves the result to the task result
    backend, and sets the task status to `"SUCCESS"`.

    If the call raises :exc:`~@Retry`, it extracts
    the original exception, uses that as the result and sets the task state
    to `"RETRY"`.

    If the call results in an exception, it saves the exception as the task
    result, and sets the task state to `"FAILURE"`.

    Return a function that takes the following arguments:

        :param uuid: The id of the task.
        :param args: List of positional args to pass on to the function.
        :param kwargs: Keyword arguments mapping to pass on to the function.
        :keyword request: Request dict.

    """
    # If the task doesn't define a custom __call__ method
    # we optimize it away by simply calling the run method directly,
    # saving the extra method call and a line less in the stack trace.
    fun = task if task_has_custom(task, '__call__') else task.run

    loader = loader or app.loader
    backend = task.backend
    ignore_result = task.ignore_result
    track_started = task.track_started
    track_started = not eager and (task.track_started and not ignore_result)
    publish_result = not eager and not ignore_result
    hostname = hostname or socket.gethostname()

    loader_task_init = loader.on_task_init
    loader_cleanup = loader.on_process_cleanup

    task_on_success = None
    task_after_return = None
    if task_has_custom(task, 'on_success'):
        task_on_success = task.on_success
    if task_has_custom(task, 'after_return'):
        task_after_return = task.after_return

    store_result = backend.store_result
    backend_cleanup = backend.process_cleanup

    pid = os.getpid()

    request_stack = task.request_stack
    push_request = request_stack.push
    pop_request = request_stack.pop
    push_task = _task_stack.push
    pop_task = _task_stack.pop
    on_chord_part_return = backend.on_chord_part_return

    prerun_receivers = signals.task_prerun.receivers
    postrun_receivers = signals.task_postrun.receivers
    success_receivers = signals.task_success.receivers

    from celery import canvas
    signature = canvas.maybe_signature  # maybe_ does not clone if already

    def on_error(request, exc, uuid, state=FAILURE, call_errbacks=True):
        if propagate:
            raise
        I = Info(state, exc)
        R = I.handle_error_state(task, eager=eager)
        if call_errbacks:
            group(
                [signature(errback, app=app)
                 for errback in request.errbacks or []], app=app,
            ).apply_async((uuid, ))
        return I, R, I.state, I.retval

    def trace_task(uuid, args, kwargs, request=None):
        # R      - is the possibly prepared return value.
        # I      - is the Info object.
        # retval - is the always unmodified return value.
        # state  - is the resulting task state.

        # This function is very long because we have unrolled all the calls
        # for performance reasons, and because the function is so long
        # we want the main variables (I, and R) to stand out visually from the
        # the rest of the variables, so breaking PEP8 is worth it ;)
        R = I = retval = state = None
        kwargs = kwdict(kwargs)
        try:
            push_task(task)
            task_request = Context(request or {}, args=args,
                                   called_directly=False, kwargs=kwargs)
            push_request(task_request)
            try:
                # -*- PRE -*-
                if prerun_receivers:
                    send_prerun(sender=task, task_id=uuid, task=task,
                                args=args, kwargs=kwargs)
                loader_task_init(uuid, task)
                if track_started:
                    store_result(
                        uuid, {'pid': pid, 'hostname': hostname}, STARTED,
                        request=task_request,
                    )

                # -*- TRACE -*-
                try:
                    R = retval = fun(*args, **kwargs)
                    state = SUCCESS
                except Reject as exc:
                    I, R = Info(REJECTED, exc), ExceptionInfo(internal=True)
                    state, retval = I.state, I.retval
                except Ignore as exc:
                    I, R = Info(IGNORED, exc), ExceptionInfo(internal=True)
                    state, retval = I.state, I.retval
                except Retry as exc:
                    I, R, state, retval = on_error(
                        task_request, exc, uuid, RETRY, call_errbacks=False,
                    )
                except Exception as exc:
                    I, R, state, retval = on_error(task_request, exc, uuid)
                except BaseException as exc:
                    raise
                else:
                    try:
                        # callback tasks must be applied before the result is
                        # stored, so that result.children is populated.

                        # groups are called inline and will store trail
                        # separately, so need to call them separately
                        # so that the trail's not added multiple times :(
                        # (Issue #1936)
                        callbacks = task.request.callbacks
                        if callbacks:
                            if len(task.request.callbacks) > 1:
                                sigs, groups = [], []
                                for sig in callbacks:
                                    sig = signature(sig, app=app)
                                    if isinstance(sig, group):
                                        groups.append(sig)
                                    else:
                                        sigs.append(sig)
                                for group_ in groups:
                                    group_.apply_async((retval, ))
                                if sigs:
                                    group(sigs).apply_async((retval, ))
                            else:
                                signature(callbacks[0], app=app).delay(retval)
                        if publish_result:
                            store_result(
                                uuid, retval, SUCCESS, request=task_request,
                            )
                    except EncodeError as exc:
                        I, R, state, retval = on_error(task_request, exc, uuid)
                    else:
                        if task_on_success:
                            task_on_success(retval, uuid, args, kwargs)
                        if success_receivers:
                            send_success(sender=task, result=retval)

                # -* POST *-
                if state not in IGNORE_STATES:
                    if task_request.chord:
                        on_chord_part_return(task, state, R)
                    if task_after_return:
                        task_after_return(
                            state, retval, uuid, args, kwargs, None,
                        )
            finally:
                try:
                    if postrun_receivers:
                        send_postrun(sender=task, task_id=uuid, task=task,
                                     args=args, kwargs=kwargs,
                                     retval=retval, state=state)
                finally:
                    pop_task()
                    pop_request()
                    if not eager:
                        try:
                            backend_cleanup()
                            loader_cleanup()
                        except (KeyboardInterrupt, SystemExit, MemoryError):
                            raise
                        except Exception as exc:
                            _logger.error('Process cleanup failed: %r', exc,
                                          exc_info=True)
        except MemoryError:
            raise
        except Exception as exc:
            if eager:
                raise
            R = report_internal_error(task, exc)
        return R, I

    return trace_task


def trace_task(task, uuid, args, kwargs, request={}, **opts):
    try:
        if task.__trace__ is None:
            task.__trace__ = build_tracer(task.name, task, **opts)
        return task.__trace__(uuid, args, kwargs, request)[0]
    except Exception as exc:
        return report_internal_error(task, exc)


def _trace_task_ret(name, uuid, args, kwargs, request={}, app=None, **opts):
    app = app or current_app
    return trace_task(app.tasks[name],
                      uuid, args, kwargs, request, app=app, **opts)
trace_task_ret = _trace_task_ret


def _fast_trace_task(task, uuid, args, kwargs, request={}):
    # setup_worker_optimizations will point trace_task_ret to here,
    # so this is the function used in the worker.
    return _tasks[task].__trace__(uuid, args, kwargs, request)[0]


def eager_trace_task(task, uuid, args, kwargs, request=None, **opts):
    opts.setdefault('eager', True)
    return build_tracer(task.name, task, **opts)(
        uuid, args, kwargs, request)


def report_internal_error(task, exc):
    _type, _value, _tb = sys.exc_info()
    try:
        _value = task.backend.prepare_exception(exc, 'pickle')
        exc_info = ExceptionInfo((_type, _value, _tb), internal=True)
        warn(RuntimeWarning(
            'Exception raised outside body: {0!r}:\n{1}'.format(
                exc, exc_info.traceback)))
        return exc_info
    finally:
        del(_tb)


def setup_worker_optimizations(app):
    global _tasks
    global trace_task_ret

    # make sure custom Task.__call__ methods that calls super
    # will not mess up the request/task stack.
    _install_stack_protection()

    # all new threads start without a current app, so if an app is not
    # passed on to the thread it will fall back to the "default app",
    # which then could be the wrong app.  So for the worker
    # we set this to always return our app.  This is a hack,
    # and means that only a single app can be used for workers
    # running in the same process.
    app.set_current()
    set_default_app(app)

    # evaluate all task classes by finalizing the app.
    app.finalize()

    # set fast shortcut to task registry
    _tasks = app._tasks

    trace_task_ret = _fast_trace_task
    from celery.worker import job as job_module
    job_module.trace_task_ret = _fast_trace_task
    job_module.__optimize__()


def reset_worker_optimizations():
    global trace_task_ret
    trace_task_ret = _trace_task_ret
    try:
        delattr(BaseTask, '_stackprotected')
    except AttributeError:
        pass
    try:
        BaseTask.__call__ = _patched.pop('BaseTask.__call__')
    except KeyError:
        pass
    from celery.worker import job as job_module
    job_module.trace_task_ret = _trace_task_ret


def _install_stack_protection():
    # Patches BaseTask.__call__ in the worker to handle the edge case
    # where people override it and also call super.
    #
    # - The worker optimizes away BaseTask.__call__ and instead
    #   calls task.run directly.
    # - so with the addition of current_task and the request stack
    #   BaseTask.__call__ now pushes to those stacks so that
    #   they work when tasks are called directly.
    #
    # The worker only optimizes away __call__ in the case
    # where it has not been overridden, so the request/task stack
    # will blow if a custom task class defines __call__ and also
    # calls super().
    if not getattr(BaseTask, '_stackprotected', False):
        _patched['BaseTask.__call__'] = orig = BaseTask.__call__

        def __protected_call__(self, *args, **kwargs):
            stack = self.request_stack
            req = stack.top
            if req and not req._protected and \
                    len(stack) == 1 and not req.called_directly:
                req._protected = 1
                return self.run(*args, **kwargs)
            return orig(self, *args, **kwargs)
        BaseTask.__call__ = __protected_call__
        BaseTask._stackprotected = True
