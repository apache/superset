from __future__ import absolute_import

from celery import uuid
from celery import signals
from celery import states
from celery.exceptions import Ignore, Retry
from celery.app.trace import (
    TraceInfo,
    eager_trace_task,
    trace_task,
    setup_worker_optimizations,
    reset_worker_optimizations,
)
from celery.tests.case import AppCase, Mock, patch


def trace(app, task, args=(), kwargs={}, propagate=False, **opts):
    return eager_trace_task(task, 'id-1', args, kwargs,
                            propagate=propagate, app=app, **opts)


class TraceCase(AppCase):

    def setup(self):
        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add

        @self.app.task(shared=False, ignore_result=True)
        def add_cast(x, y):
            return x + y
        self.add_cast = add_cast

        @self.app.task(shared=False)
        def raises(exc):
            raise exc
        self.raises = raises

    def trace(self, *args, **kwargs):
        return trace(self.app, *args, **kwargs)


class test_trace(TraceCase):

    def test_trace_successful(self):
        retval, info = self.trace(self.add, (2, 2), {})
        self.assertIsNone(info)
        self.assertEqual(retval, 4)

    def test_trace_on_success(self):

        @self.app.task(shared=False, on_success=Mock())
        def add_with_success(x, y):
            return x + y

        self.trace(add_with_success, (2, 2), {})
        self.assertTrue(add_with_success.on_success.called)

    def test_trace_after_return(self):

        @self.app.task(shared=False, after_return=Mock())
        def add_with_after_return(x, y):
            return x + y

        self.trace(add_with_after_return, (2, 2), {})
        self.assertTrue(add_with_after_return.after_return.called)

    def test_with_prerun_receivers(self):
        on_prerun = Mock()
        signals.task_prerun.connect(on_prerun)
        try:
            self.trace(self.add, (2, 2), {})
            self.assertTrue(on_prerun.called)
        finally:
            signals.task_prerun.receivers[:] = []

    def test_with_postrun_receivers(self):
        on_postrun = Mock()
        signals.task_postrun.connect(on_postrun)
        try:
            self.trace(self.add, (2, 2), {})
            self.assertTrue(on_postrun.called)
        finally:
            signals.task_postrun.receivers[:] = []

    def test_with_success_receivers(self):
        on_success = Mock()
        signals.task_success.connect(on_success)
        try:
            self.trace(self.add, (2, 2), {})
            self.assertTrue(on_success.called)
        finally:
            signals.task_success.receivers[:] = []

    def test_multiple_callbacks(self):
        """
        Regression test on trace with multiple callbacks

        Uses the signature of the following canvas:
            chain(
                empty.subtask(link=empty.subtask()),
                group(empty.subtask(), empty.subtask())
            )
        """

        @self.app.task(shared=False)
        def empty(*args, **kwargs):
            pass
        empty.backend = Mock()

        sig = {
            'chord_size': None, 'task': 'empty', 'args': (), 'options': {},
            'subtask_type': None, 'kwargs': {}, 'immutable': False
        }
        group_sig = {
            'chord_size': None, 'task': 'celery.group', 'args': (),
            'options': {}, 'subtask_type': 'group',
            'kwargs': {'tasks': (empty(), empty())}, 'immutable': False
        }
        callbacks = [sig, group_sig]

        # should not raise an exception
        self.trace(empty, [], {}, request={'callbacks': callbacks})

    def test_when_chord_part(self):

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        add.backend = Mock()

        self.trace(add, (2, 2), {}, request={'chord': uuid()})
        add.backend.on_chord_part_return.assert_called_with(add, 'SUCCESS', 4)

    def test_when_backend_cleanup_raises(self):

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        add.backend = Mock(name='backend')
        add.backend.process_cleanup.side_effect = KeyError()
        self.trace(add, (2, 2), {}, eager=False)
        add.backend.process_cleanup.assert_called_with()
        add.backend.process_cleanup.side_effect = MemoryError()
        with self.assertRaises(MemoryError):
            self.trace(add, (2, 2), {}, eager=False)

    def test_when_Ignore(self):

        @self.app.task(shared=False)
        def ignored():
            raise Ignore()

        retval, info = self.trace(ignored, (), {})
        self.assertEqual(info.state, states.IGNORED)

    def test_trace_SystemExit(self):
        with self.assertRaises(SystemExit):
            self.trace(self.raises, (SystemExit(), ), {})

    def test_trace_Retry(self):
        exc = Retry('foo', 'bar')
        _, info = self.trace(self.raises, (exc, ), {})
        self.assertEqual(info.state, states.RETRY)
        self.assertIs(info.retval, exc)

    def test_trace_exception(self):
        exc = KeyError('foo')
        _, info = self.trace(self.raises, (exc, ), {})
        self.assertEqual(info.state, states.FAILURE)
        self.assertIs(info.retval, exc)

    def test_trace_exception_propagate(self):
        with self.assertRaises(KeyError):
            self.trace(self.raises, (KeyError('foo'), ), {}, propagate=True)

    @patch('celery.app.trace.build_tracer')
    @patch('celery.app.trace.report_internal_error')
    def test_outside_body_error(self, report_internal_error, build_tracer):
        tracer = Mock()
        tracer.side_effect = KeyError('foo')
        build_tracer.return_value = tracer

        @self.app.task(shared=False)
        def xtask():
            pass

        trace_task(xtask, 'uuid', (), {})
        self.assertTrue(report_internal_error.call_count)
        self.assertIs(xtask.__trace__, tracer)


class test_TraceInfo(TraceCase):

    class TI(TraceInfo):
        __slots__ = TraceInfo.__slots__ + ('__dict__', )

    def test_handle_error_state(self):
        x = self.TI(states.FAILURE)
        x.handle_failure = Mock()
        x.handle_error_state(self.add_cast)
        x.handle_failure.assert_called_with(
            self.add_cast,
            store_errors=self.add_cast.store_errors_even_if_ignored,
        )


class test_stackprotection(AppCase):

    def test_stackprotection(self):
        setup_worker_optimizations(self.app)
        try:
            @self.app.task(shared=False, bind=True)
            def foo(self, i):
                if i:
                    return foo(0)
                return self.request

            self.assertTrue(foo(1).called_directly)
        finally:
            reset_worker_optimizations()
