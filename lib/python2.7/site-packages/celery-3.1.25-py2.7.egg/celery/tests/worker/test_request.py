# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import anyjson
import os
import signal
import socket
import sys

from datetime import datetime, timedelta

from billiard.einfo import ExceptionInfo
from kombu.transport.base import Message
from kombu.utils.encoding import from_utf8, default_encode

from celery import states
from celery.app.trace import (
    trace_task,
    _trace_task_ret,
    TraceInfo,
    mro_lookup,
    build_tracer,
    setup_worker_optimizations,
    reset_worker_optimizations,
)
from celery.concurrency.base import BasePool
from celery.exceptions import (
    Ignore,
    InvalidTaskError,
    Retry,
    TaskRevokedError,
    Terminated,
    WorkerLostError,
)
from celery.five import keys, monotonic
from celery.signals import task_revoked
from celery.utils import uuid
from celery.worker import job as module
from celery.worker.job import Request, logger as req_logger
from celery.worker.state import revoked

from celery.tests.case import (
    AppCase,
    Case,
    Mock,
    SkipTest,
    assert_signal_called,
    body_from_sig,
    patch,
)


class test_mro_lookup(Case):

    def test_order(self):

        class A(object):
            pass

        class B(A):
            pass

        class C(B):
            pass

        class D(C):

            @classmethod
            def mro(cls):
                return ()

        A.x = 10
        self.assertEqual(mro_lookup(C, 'x'), A)
        self.assertIsNone(mro_lookup(C, 'x', stop=(A, )))
        B.x = 10
        self.assertEqual(mro_lookup(C, 'x'), B)
        C.x = 10
        self.assertEqual(mro_lookup(C, 'x'), C)
        self.assertIsNone(mro_lookup(D, 'x'))


def jail(app, task_id, name, args, kwargs):
    request = {'id': task_id}
    task = app.tasks[name]
    task.__trace__ = None  # rebuild
    return trace_task(
        task, task_id, args, kwargs, request=request, eager=False, app=app,
    )


class test_default_encode(AppCase):

    def setup(self):
        if sys.version_info >= (3, 0):
            raise SkipTest('py3k: not relevant')

    def test_jython(self):
        prev, sys.platform = sys.platform, 'java 1.6.1'
        try:
            self.assertEqual(default_encode(bytes('foo')), 'foo')
        finally:
            sys.platform = prev

    def test_cpython(self):
        prev, sys.platform = sys.platform, 'darwin'
        gfe, sys.getfilesystemencoding = (
            sys.getfilesystemencoding,
            lambda: 'utf-8',
        )
        try:
            self.assertEqual(default_encode(bytes('foo')), 'foo')
        finally:
            sys.platform = prev
            sys.getfilesystemencoding = gfe


class test_Retry(AppCase):

    def test_retry_semipredicate(self):
        try:
            raise Exception('foo')
        except Exception as exc:
            ret = Retry('Retrying task', exc)
            self.assertEqual(ret.exc, exc)


class test_trace_task(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def mytask(i, **kwargs):
            return i ** i
        self.mytask = mytask

        @self.app.task(shared=False)
        def mytask_raising(i):
            raise KeyError(i)
        self.mytask_raising = mytask_raising

    @patch('celery.app.trace._logger')
    def test_process_cleanup_fails(self, _logger):
        self.mytask.backend = Mock()
        self.mytask.backend.process_cleanup = Mock(side_effect=KeyError())
        tid = uuid()
        ret = jail(self.app, tid, self.mytask.name, [2], {})
        self.assertEqual(ret, 4)
        self.assertTrue(self.mytask.backend.store_result.called)
        self.assertIn('Process cleanup failed', _logger.error.call_args[0][0])

    def test_process_cleanup_BaseException(self):
        self.mytask.backend = Mock()
        self.mytask.backend.process_cleanup = Mock(side_effect=SystemExit())
        with self.assertRaises(SystemExit):
            jail(self.app, uuid(), self.mytask.name, [2], {})

    def test_execute_jail_success(self):
        ret = jail(self.app, uuid(), self.mytask.name, [2], {})
        self.assertEqual(ret, 4)

    def test_marked_as_started(self):
        _started = []

        def store_result(tid, meta, state, **kwars):
            if state == states.STARTED:
                _started.append(tid)
        self.mytask.backend.store_result = Mock(name='store_result')
        self.mytask.backend.store_result.side_effect = store_result
        self.mytask.track_started = True

        tid = uuid()
        jail(self.app, tid, self.mytask.name, [2], {})
        self.assertIn(tid, _started)

        self.mytask.ignore_result = True
        tid = uuid()
        jail(self.app, tid, self.mytask.name, [2], {})
        self.assertNotIn(tid, _started)

    def test_execute_jail_failure(self):
        ret = jail(
            self.app, uuid(), self.mytask_raising.name, [4], {},
        )
        self.assertIsInstance(ret, ExceptionInfo)
        self.assertTupleEqual(ret.exception.args, (4, ))

    def test_execute_ignore_result(self):

        @self.app.task(shared=False, ignore_result=True)
        def ignores_result(i):
            return i ** i

        task_id = uuid()
        ret = jail(self.app, task_id, ignores_result.name, [4], {})
        self.assertEqual(ret, 256)
        self.assertFalse(self.app.AsyncResult(task_id).ready())


class MockEventDispatcher(object):

    def __init__(self):
        self.sent = []
        self.enabled = True

    def send(self, event, **fields):
        self.sent.append(event)


class test_Request(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def add(x, y, **kw_):
            return x + y
        self.add = add

        @self.app.task(shared=False)
        def mytask(i, **kwargs):
            return i ** i
        self.mytask = mytask

        @self.app.task(shared=False)
        def mytask_raising(i):
            raise KeyError(i)
        self.mytask_raising = mytask_raising

    def get_request(self, sig, Request=Request, **kwargs):
        return Request(
            body_from_sig(self.app, sig),
            on_ack=Mock(),
            eventer=Mock(),
            app=self.app,
            connection_errors=(socket.error, ),
            task=sig.type,
            **kwargs
        )

    def test_invalid_eta_raises_InvalidTaskError(self):
        with self.assertRaises(InvalidTaskError):
            self.get_request(self.add.s(2, 2).set(eta='12345'))

    def test_invalid_expires_raises_InvalidTaskError(self):
        with self.assertRaises(InvalidTaskError):
            self.get_request(self.add.s(2, 2).set(expires='12345'))

    def test_valid_expires_with_utc_makes_aware(self):
        with patch('celery.worker.job.maybe_make_aware') as mma:
            self.get_request(self.add.s(2, 2).set(expires=10))
            self.assertTrue(mma.called)

    def test_maybe_expire_when_expires_is_None(self):
        req = self.get_request(self.add.s(2, 2))
        self.assertFalse(req.maybe_expire())

    def test_on_retry_acks_if_late(self):
        self.add.acks_late = True
        req = self.get_request(self.add.s(2, 2))
        req.on_retry(Mock())
        req.on_ack.assert_called_with(req_logger, req.connection_errors)

    def test_on_failure_Termianted(self):
        einfo = None
        try:
            raise Terminated('9')
        except Terminated:
            einfo = ExceptionInfo()
        self.assertIsNotNone(einfo)
        req = self.get_request(self.add.s(2, 2))
        req.on_failure(einfo)
        req.eventer.send.assert_called_with(
            'task-revoked',
            uuid=req.id, terminated=True, signum='9', expired=False,
        )

    def test_log_error_propagates_MemoryError(self):
        einfo = None
        try:
            raise MemoryError()
        except MemoryError:
            einfo = ExceptionInfo(internal=True)
        self.assertIsNotNone(einfo)
        req = self.get_request(self.add.s(2, 2))
        with self.assertRaises(MemoryError):
            req._log_error(einfo)

    def test_log_error_when_Ignore(self):
        einfo = None
        try:
            raise Ignore()
        except Ignore:
            einfo = ExceptionInfo(internal=True)
        self.assertIsNotNone(einfo)
        req = self.get_request(self.add.s(2, 2))
        req._log_error(einfo)
        req.on_ack.assert_called_with(req_logger, req.connection_errors)

    def test_tzlocal_is_cached(self):
        req = self.get_request(self.add.s(2, 2))
        req._tzlocal = 'foo'
        self.assertEqual(req.tzlocal, 'foo')

    def test_execute_magic_kwargs(self):
        task = self.add.s(2, 2)
        task.freeze()
        req = self.get_request(task)
        self.add.accept_magic_kwargs = True
        pool = Mock()
        req.execute_using_pool(pool)
        self.assertTrue(pool.apply_async.called)
        args = pool.apply_async.call_args[1]['args']
        self.assertEqual(args[0], task.task)
        self.assertEqual(args[1], task.id)
        self.assertEqual(args[2], task.args)
        kwargs = args[3]
        self.assertEqual(kwargs.get('task_name'), task.task)

    def xRequest(self, body=None, **kwargs):
        body = dict({'task': self.mytask.name,
                     'id': uuid(),
                     'args': [1],
                     'kwargs': {'f': 'x'}}, **body or {})
        return Request(body, app=self.app, **kwargs)

    def test_task_wrapper_repr(self):
        self.assertTrue(repr(self.xRequest()))

    @patch('celery.worker.job.kwdict')
    def test_kwdict(self, kwdict):
        prev, module.NEEDS_KWDICT = module.NEEDS_KWDICT, True
        try:
            self.xRequest()
            self.assertTrue(kwdict.called)
        finally:
            module.NEEDS_KWDICT = prev

    def test_sets_store_errors(self):
        self.mytask.ignore_result = True
        job = self.xRequest()
        self.assertFalse(job.store_errors)

        self.mytask.store_errors_even_if_ignored = True
        job = self.xRequest()
        self.assertTrue(job.store_errors)

    def test_send_event(self):
        job = self.xRequest()
        job.eventer = MockEventDispatcher()
        job.send_event('task-frobulated')
        self.assertIn('task-frobulated', job.eventer.sent)

    def test_send_events__disabled_at_task_level(self):
        job = self.xRequest()
        job.task.send_events = False
        job.eventer = Mock(name='.eventer')
        job.send_event('task-frobulated')
        job.eventer.send.assert_not_called()

    def test_on_retry(self):
        job = Request({
            'task': self.mytask.name,
            'id': uuid(),
            'args': [1],
            'kwargs': {'f': 'x'},
        }, app=self.app)
        job.eventer = MockEventDispatcher()
        try:
            raise Retry('foo', KeyError('moofoobar'))
        except:
            einfo = ExceptionInfo()
            job.on_failure(einfo)
            self.assertIn('task-retried', job.eventer.sent)
            prev, module._does_info = module._does_info, False
            try:
                job.on_failure(einfo)
            finally:
                module._does_info = prev
            einfo.internal = True
            job.on_failure(einfo)

    def test_compat_properties(self):
        job = Request({
            'task': self.mytask.name,
            'id': uuid(),
            'args': [1],
            'kwargs': {'f': 'x'},
        }, app=self.app)
        self.assertEqual(job.task_id, job.id)
        self.assertEqual(job.task_name, job.name)
        job.task_id = 'ID'
        self.assertEqual(job.id, 'ID')
        job.task_name = 'NAME'
        self.assertEqual(job.name, 'NAME')

    def test_terminate__task_started(self):
        pool = Mock()
        signum = signal.SIGTERM
        job = Request({
            'task': self.mytask.name,
            'id': uuid(),
            'args': [1],
            'kwrgs': {'f': 'x'},
        }, app=self.app)
        with assert_signal_called(
                task_revoked, sender=job.task, request=job,
                terminated=True, expired=False, signum=signum):
            job.time_start = monotonic()
            job.worker_pid = 313
            job.terminate(pool, signal='TERM')
            pool.terminate_job.assert_called_with(job.worker_pid, signum)

    def test_terminate__task_reserved(self):
        pool = Mock()
        job = Request({
            'task': self.mytask.name,
            'id': uuid(),
            'args': [1],
            'kwargs': {'f': 'x'},
        }, app=self.app)
        job.time_start = None
        job.terminate(pool, signal='TERM')
        self.assertFalse(pool.terminate_job.called)
        self.assertTupleEqual(job._terminate_on_ack, (pool, 15))
        job.terminate(pool, signal='TERM')

    def test_revoked_expires_expired(self):
        job = Request({
            'task': self.mytask.name,
            'id': uuid(),
            'args': [1],
            'kwargs': {'f': 'x'},
            'expires': datetime.utcnow() - timedelta(days=1),
        }, app=self.app)
        with assert_signal_called(
                task_revoked, sender=job.task, request=job,
                terminated=False, expired=True, signum=None):
            job.revoked()
            self.assertIn(job.id, revoked)
            self.assertEqual(
                self.mytask.backend.get_status(job.id),
                states.REVOKED,
            )

    def test_revoked_expires_not_expired(self):
        job = self.xRequest({
            'expires': datetime.utcnow() + timedelta(days=1),
        })
        job.revoked()
        self.assertNotIn(job.id, revoked)
        self.assertNotEqual(
            self.mytask.backend.get_status(job.id),
            states.REVOKED,
        )

    def test_revoked_expires_ignore_result(self):
        self.mytask.ignore_result = True
        job = self.xRequest({
            'expires': datetime.utcnow() - timedelta(days=1),
        })
        job.revoked()
        self.assertIn(job.id, revoked)
        self.assertNotEqual(
            self.mytask.backend.get_status(job.id), states.REVOKED,
        )

    def test_send_email(self):
        app = self.app
        mail_sent = [False]

        def mock_mail_admins(*args, **kwargs):
            mail_sent[0] = True

        def get_ei():
            try:
                raise KeyError('moofoobar')
            except:
                return ExceptionInfo()

        app.mail_admins = mock_mail_admins
        self.mytask.send_error_emails = True
        job = self.xRequest()
        einfo = get_ei()
        job.on_failure(einfo)
        self.assertTrue(mail_sent[0])

        einfo = get_ei()
        mail_sent[0] = False
        self.mytask.send_error_emails = False
        job.on_failure(einfo)
        self.assertFalse(mail_sent[0])

        einfo = get_ei()
        mail_sent[0] = False
        self.mytask.send_error_emails = True
        job.on_failure(einfo)
        self.assertTrue(mail_sent[0])

    def test_already_revoked(self):
        job = self.xRequest()
        job._already_revoked = True
        self.assertTrue(job.revoked())

    def test_revoked(self):
        job = self.xRequest()
        with assert_signal_called(
                task_revoked, sender=job.task, request=job,
                terminated=False, expired=False, signum=None):
            revoked.add(job.id)
            self.assertTrue(job.revoked())
            self.assertTrue(job._already_revoked)
            self.assertTrue(job.acknowledged)

    def test_execute_does_not_execute_revoked(self):
        job = self.xRequest()
        revoked.add(job.id)
        job.execute()

    def test_execute_acks_late(self):
        self.mytask_raising.acks_late = True
        job = self.xRequest({
            'task': self.mytask_raising.name,
            'kwargs': {},
        })
        job.execute()
        self.assertTrue(job.acknowledged)
        job.execute()

    def test_execute_using_pool_does_not_execute_revoked(self):
        job = self.xRequest()
        revoked.add(job.id)
        with self.assertRaises(TaskRevokedError):
            job.execute_using_pool(None)

    def test_on_accepted_acks_early(self):
        job = self.xRequest()
        job.on_accepted(pid=os.getpid(), time_accepted=monotonic())
        self.assertTrue(job.acknowledged)
        prev, module._does_debug = module._does_debug, False
        try:
            job.on_accepted(pid=os.getpid(), time_accepted=monotonic())
        finally:
            module._does_debug = prev

    def test_on_accepted_acks_late(self):
        job = self.xRequest()
        self.mytask.acks_late = True
        job.on_accepted(pid=os.getpid(), time_accepted=monotonic())
        self.assertFalse(job.acknowledged)

    def test_on_accepted_terminates(self):
        signum = signal.SIGTERM
        pool = Mock()
        job = self.xRequest()
        with assert_signal_called(
                task_revoked, sender=job.task, request=job,
                terminated=True, expired=False, signum=signum):
            job.terminate(pool, signal='TERM')
            self.assertFalse(pool.terminate_job.call_count)
            job.on_accepted(pid=314, time_accepted=monotonic())
            pool.terminate_job.assert_called_with(314, signum)

    def test_on_success_acks_early(self):
        job = self.xRequest()
        job.time_start = 1
        job.on_success(42)
        prev, module._does_info = module._does_info, False
        try:
            job.on_success(42)
            self.assertFalse(job.acknowledged)
        finally:
            module._does_info = prev

    def test_on_success_BaseException(self):
        job = self.xRequest()
        job.time_start = 1
        with self.assertRaises(SystemExit):
            try:
                raise SystemExit()
            except SystemExit:
                job.on_success(ExceptionInfo())
            else:
                assert False

    def test_on_success_eventer(self):
        job = self.xRequest()
        job.time_start = 1
        job.eventer = Mock()
        job.eventer.send = Mock()
        job.on_success(42)
        self.assertTrue(job.eventer.send.called)

    def test_on_success_when_failure(self):
        job = self.xRequest()
        job.time_start = 1
        job.on_failure = Mock()
        try:
            raise KeyError('foo')
        except Exception:
            job.on_success(ExceptionInfo())
            self.assertTrue(job.on_failure.called)

    def test_on_success_acks_late(self):
        job = self.xRequest()
        job.time_start = 1
        self.mytask.acks_late = True
        job.on_success(42)
        self.assertTrue(job.acknowledged)

    def test_on_failure_WorkerLostError(self):

        def get_ei():
            try:
                raise WorkerLostError('do re mi')
            except WorkerLostError:
                return ExceptionInfo()

        job = self.xRequest()
        exc_info = get_ei()
        job.on_failure(exc_info)
        self.assertEqual(
            self.mytask.backend.get_status(job.id), states.FAILURE,
        )

        self.mytask.ignore_result = True
        exc_info = get_ei()
        job = self.xRequest()
        job.on_failure(exc_info)
        self.assertEqual(
            self.mytask.backend.get_status(job.id), states.PENDING,
        )

    def test_on_failure_acks_late(self):
        job = self.xRequest()
        job.time_start = 1
        self.mytask.acks_late = True
        try:
            raise KeyError('foo')
        except KeyError:
            exc_info = ExceptionInfo()
            job.on_failure(exc_info)
            self.assertTrue(job.acknowledged)

    def test_from_message_invalid_kwargs(self):
        body = dict(task=self.mytask.name, id=1, args=(), kwargs='foo')
        with self.assertRaises(InvalidTaskError):
            Request(body, message=None, app=self.app)

    @patch('celery.worker.job.error')
    @patch('celery.worker.job.warn')
    def test_on_timeout(self, warn, error):

        job = self.xRequest()
        job.on_timeout(soft=True, timeout=1337)
        self.assertIn('Soft time limit', warn.call_args[0][0])
        job.on_timeout(soft=False, timeout=1337)
        self.assertIn('Hard time limit', error.call_args[0][0])
        self.assertEqual(
            self.mytask.backend.get_status(job.id), states.FAILURE,
        )

        self.mytask.ignore_result = True
        job = self.xRequest()
        job.on_timeout(soft=True, timeout=1336)
        self.assertEqual(
            self.mytask.backend.get_status(job.id), states.PENDING,
        )

    def test_fast_trace_task(self):
        from celery.app import trace
        setup_worker_optimizations(self.app)
        self.assertIs(trace.trace_task_ret, trace._fast_trace_task)
        try:
            self.mytask.__trace__ = build_tracer(
                self.mytask.name, self.mytask, self.app.loader, 'test',
                app=self.app,
            )
            res = trace.trace_task_ret(self.mytask.name, uuid(), [4], {})
            self.assertEqual(res, 4 ** 4)
        finally:
            reset_worker_optimizations()
            self.assertIs(trace.trace_task_ret, trace._trace_task_ret)
        delattr(self.mytask, '__trace__')
        res = trace.trace_task_ret(
            self.mytask.name, uuid(), [4], {}, app=self.app,
        )
        self.assertEqual(res, 4 ** 4)

    def test_trace_task_ret(self):
        self.mytask.__trace__ = build_tracer(
            self.mytask.name, self.mytask, self.app.loader, 'test',
            app=self.app,
        )
        res = _trace_task_ret(self.mytask.name, uuid(), [4], {}, app=self.app)
        self.assertEqual(res, 4 ** 4)

    def test_trace_task_ret__no_trace(self):
        try:
            delattr(self.mytask, '__trace__')
        except AttributeError:
            pass
        res = _trace_task_ret(self.mytask.name, uuid(), [4], {}, app=self.app)
        self.assertEqual(res, 4 ** 4)

    def test_trace_catches_exception(self):

        def _error_exec(self, *args, **kwargs):
            raise KeyError('baz')

        @self.app.task(request=None, shared=False)
        def raising():
            raise KeyError('baz')

        with self.assertWarnsRegex(RuntimeWarning,
                                   r'Exception raised outside'):
            res = trace_task(raising, uuid(), [], {}, app=self.app)
            self.assertIsInstance(res, ExceptionInfo)

    def test_worker_task_trace_handle_retry(self):
        tid = uuid()
        self.mytask.push_request(id=tid)
        try:
            raise ValueError('foo')
        except Exception as exc:
            try:
                raise Retry(str(exc), exc=exc)
            except Retry as exc:
                w = TraceInfo(states.RETRY, exc)
                w.handle_retry(self.mytask, store_errors=False)
                self.assertEqual(
                    self.mytask.backend.get_status(tid), states.PENDING,
                )
                w.handle_retry(self.mytask, store_errors=True)
                self.assertEqual(
                    self.mytask.backend.get_status(tid), states.RETRY,
                )
        finally:
            self.mytask.pop_request()

    def test_worker_task_trace_handle_failure(self):
        tid = uuid()
        self.mytask.push_request()
        try:
            self.mytask.request.id = tid
            try:
                raise ValueError('foo')
            except Exception as exc:
                w = TraceInfo(states.FAILURE, exc)
                w.handle_failure(self.mytask, store_errors=False)
                self.assertEqual(
                    self.mytask.backend.get_status(tid), states.PENDING,
                )
                w.handle_failure(self.mytask, store_errors=True)
                self.assertEqual(
                    self.mytask.backend.get_status(tid), states.FAILURE,
                )
        finally:
            self.mytask.pop_request()

    def test_task_wrapper_mail_attrs(self):
        job = self.xRequest({'args': [], 'kwargs': {}})
        x = job.success_msg % {
            'name': job.name,
            'id': job.id,
            'return_value': 10,
            'runtime': 0.3641,
        }
        self.assertTrue(x)
        x = job.error_msg % {
            'name': job.name,
            'id': job.id,
            'exc': 'FOOBARBAZ',
            'description': 'raised unexpected',
            'traceback': 'foobarbaz',
        }
        self.assertTrue(x)

    def test_from_message(self):
        us = 'æØåveéðƒeæ'
        body = {'task': self.mytask.name, 'id': uuid(),
                'args': [2], 'kwargs': {us: 'bar'}}
        m = Message(None, body=anyjson.dumps(body), backend='foo',
                    content_type='application/json',
                    content_encoding='utf-8')
        job = Request(m.decode(), message=m, app=self.app)
        self.assertIsInstance(job, Request)
        self.assertEqual(job.name, body['task'])
        self.assertEqual(job.id, body['id'])
        self.assertEqual(job.args, body['args'])
        us = from_utf8(us)
        if sys.version_info < (2, 6):
            self.assertEqual(next(keys(job.kwargs)), us)
            self.assertIsInstance(next(keys(job.kwargs)), str)

    def test_from_message_empty_args(self):
        body = {'task': self.mytask.name, 'id': uuid()}
        m = Message(None, body=anyjson.dumps(body), backend='foo',
                    content_type='application/json',
                    content_encoding='utf-8')
        job = Request(m.decode(), message=m, app=self.app)
        self.assertIsInstance(job, Request)
        self.assertEqual(job.args, [])
        self.assertEqual(job.kwargs, {})

    def test_from_message_missing_required_fields(self):
        body = {}
        m = Message(None, body=anyjson.dumps(body), backend='foo',
                    content_type='application/json',
                    content_encoding='utf-8')
        with self.assertRaises(KeyError):
            Request(m.decode(), message=m, app=self.app)

    def test_from_message_nonexistant_task(self):
        body = {'task': 'cu.mytask.doesnotexist', 'id': uuid(),
                'args': [2], 'kwargs': {'æØåveéðƒeæ': 'bar'}}
        m = Message(None, body=anyjson.dumps(body), backend='foo',
                    content_type='application/json',
                    content_encoding='utf-8')
        with self.assertRaises(KeyError):
            Request(m.decode(), message=m, app=self.app)

    def test_execute(self):
        tid = uuid()
        job = self.xRequest({'id': tid, 'args': [4], 'kwargs': {}})
        self.assertEqual(job.execute(), 256)
        meta = self.mytask.backend.get_task_meta(tid)
        self.assertEqual(meta['status'], states.SUCCESS)
        self.assertEqual(meta['result'], 256)

    def test_execute_success_no_kwargs(self):

        @self.app.task  # traverses coverage for decorator without parens
        def mytask_no_kwargs(i):
            return i ** i

        tid = uuid()
        job = self.xRequest({
            'task': mytask_no_kwargs.name,
            'id': tid,
            'args': [4],
            'kwargs': {},
        })
        self.assertEqual(job.execute(), 256)
        meta = mytask_no_kwargs.backend.get_task_meta(tid)
        self.assertEqual(meta['result'], 256)
        self.assertEqual(meta['status'], states.SUCCESS)

    def test_execute_success_some_kwargs(self):
        scratch = {'task_id': None}

        @self.app.task(shared=False, accept_magic_kwargs=True)
        def mytask_some_kwargs(i, task_id):
            scratch['task_id'] = task_id
            return i ** i

        tid = uuid()
        job = self.xRequest({
            'task': mytask_some_kwargs.name,
            'id': tid,
            'args': [4],
            'kwargs': {},
        })
        self.assertEqual(job.execute(), 256)
        meta = mytask_some_kwargs.backend.get_task_meta(tid)
        self.assertEqual(scratch.get('task_id'), tid)
        self.assertEqual(meta['result'], 256)
        self.assertEqual(meta['status'], states.SUCCESS)

    def test_execute_ack(self):
        scratch = {'ACK': False}

        def on_ack(*args, **kwargs):
            scratch['ACK'] = True

        tid = uuid()
        job = self.xRequest({'id': tid, 'args': [4]}, on_ack=on_ack)
        self.assertEqual(job.execute(), 256)
        meta = self.mytask.backend.get_task_meta(tid)
        self.assertTrue(scratch['ACK'])
        self.assertEqual(meta['result'], 256)
        self.assertEqual(meta['status'], states.SUCCESS)

    def test_execute_fail(self):
        tid = uuid()
        job = self.xRequest({
            'task': self.mytask_raising.name,
            'id': tid,
            'args': [4],
            'kwargs': {},
        })
        self.assertIsInstance(job.execute(), ExceptionInfo)
        meta = self.mytask_raising.backend.get_task_meta(tid)
        self.assertEqual(meta['status'], states.FAILURE)
        self.assertIsInstance(meta['result'], KeyError)

    def test_execute_using_pool(self):
        tid = uuid()
        job = self.xRequest({'id': tid, 'args': [4]})

        class MockPool(BasePool):
            target = None
            args = None
            kwargs = None

            def __init__(self, *args, **kwargs):
                pass

            def apply_async(self, target, args=None, kwargs=None,
                            *margs, **mkwargs):
                self.target = target
                self.args = args
                self.kwargs = kwargs

        p = MockPool()
        job.execute_using_pool(p)
        self.assertTrue(p.target)
        self.assertEqual(p.args[0], self.mytask.name)
        self.assertEqual(p.args[1], tid)
        self.assertEqual(p.args[2], [4])
        self.assertIn('f', p.args[3])
        self.assertIn([4], p.args)

        job.task.accept_magic_kwargs = False
        job.execute_using_pool(p)

    def test_default_kwargs(self):
        self.maxDiff = 3000
        tid = uuid()
        job = self.xRequest({'id': tid, 'args': [4]})
        self.assertDictEqual(
            job.extend_with_default_kwargs(), {
                'f': 'x',
                'logfile': None,
                'loglevel': None,
                'task_id': job.id,
                'task_retries': 0,
                'task_is_eager': False,
                'delivery_info': {
                    'exchange': None,
                    'routing_key': None,
                    'priority': 0,
                    'redelivered': False,
                },
                'task_name': job.name})

    @patch('celery.worker.job.logger')
    def _test_on_failure(self, exception, logger):
        app = self.app
        tid = uuid()
        job = self.xRequest({'id': tid, 'args': [4]})
        try:
            raise exception
        except Exception:
            exc_info = ExceptionInfo()
            app.conf.CELERY_SEND_TASK_ERROR_EMAILS = True
            job.on_failure(exc_info)
            self.assertTrue(logger.log.called)
            context = logger.log.call_args[0][2]
            self.assertEqual(self.mytask.name, context['name'])
            self.assertIn(tid, context['id'])

    def test_on_failure(self):
        self._test_on_failure(Exception('Inside unit tests'))

    def test_on_failure_unicode_exception(self):
        self._test_on_failure(Exception('Бобры атакуют'))

    def test_on_failure_utf8_exception(self):
        self._test_on_failure(Exception(
            from_utf8('Бобры атакуют')))
