from __future__ import absolute_import

import sys
import time

import celery.utils.timer2 as timer2

from celery.tests.case import Case, Mock, patch
from kombu.tests.case import redirect_stdouts


class test_Entry(Case):

    def test_call(self):
        scratch = [None]

        def timed(x, y, moo='foo'):
            scratch[0] = (x, y, moo)

        tref = timer2.Entry(timed, (4, 4), {'moo': 'baz'})
        tref()

        self.assertTupleEqual(scratch[0], (4, 4, 'baz'))

    def test_cancel(self):
        tref = timer2.Entry(lambda x: x, (1, ), {})
        tref.cancel()
        self.assertTrue(tref.cancelled)

    def test_repr(self):
        tref = timer2.Entry(lambda x: x(1, ), {})
        self.assertTrue(repr(tref))


class test_Schedule(Case):

    def test_supports_Timer_interface(self):
        x = timer2.Schedule()
        x.stop()

        tref = Mock()
        x.cancel(tref)
        tref.cancel.assert_called_with()

        self.assertIs(x.schedule, x)

    def test_handle_error(self):
        from datetime import datetime
        scratch = [None]

        def on_error(exc_info):
            scratch[0] = exc_info

        s = timer2.Schedule(on_error=on_error)

        with patch('kombu.async.timer.to_timestamp') as tot:
            tot.side_effect = OverflowError()
            s.enter_at(timer2.Entry(lambda: None, (), {}),
                       eta=datetime.now())
            s.enter_at(timer2.Entry(lambda: None, (), {}), eta=None)
            s.on_error = None
            with self.assertRaises(OverflowError):
                s.enter_at(timer2.Entry(lambda: None, (), {}),
                           eta=datetime.now())
        exc = scratch[0]
        self.assertIsInstance(exc, OverflowError)


class test_Timer(Case):

    def test_enter_after(self):
        t = timer2.Timer()
        try:
            done = [False]

            def set_done():
                done[0] = True

            t.call_after(0.3, set_done)
            mss = 0
            while not done[0]:
                if mss >= 2.0:
                    raise Exception('test timed out')
                time.sleep(0.1)
                mss += 0.1
        finally:
            t.stop()

    def test_exit_after(self):
        t = timer2.Timer()
        t.call_after = Mock()
        t.exit_after(0.3, priority=10)
        t.call_after.assert_called_with(0.3, sys.exit, 10)

    def test_ensure_started_not_started(self):
        t = timer2.Timer()
        t.running = True
        t.start = Mock()
        t.ensure_started()
        self.assertFalse(t.start.called)

    def test_call_repeatedly(self):
        t = timer2.Timer()
        try:
            t.schedule.enter_after = Mock()

            myfun = Mock()
            myfun.__name__ = 'myfun'
            t.call_repeatedly(0.03, myfun)

            self.assertEqual(t.schedule.enter_after.call_count, 1)
            args1, _ = t.schedule.enter_after.call_args_list[0]
            sec1, tref1, _ = args1
            self.assertEqual(sec1, 0.03)
            tref1()

            self.assertEqual(t.schedule.enter_after.call_count, 2)
            args2, _ = t.schedule.enter_after.call_args_list[1]
            sec2, tref2, _ = args2
            self.assertEqual(sec2, 0.03)
            tref2.cancelled = True
            tref2()

            self.assertEqual(t.schedule.enter_after.call_count, 2)
        finally:
            t.stop()

    @patch('kombu.async.timer.logger')
    def test_apply_entry_error_handled(self, logger):
        t = timer2.Timer()
        t.schedule.on_error = None

        fun = Mock()
        fun.side_effect = ValueError()

        t.schedule.apply_entry(fun)
        self.assertTrue(logger.error.called)

    @redirect_stdouts
    def test_apply_entry_error_not_handled(self, stdout, stderr):
        t = timer2.Timer()
        t.schedule.on_error = Mock()

        fun = Mock()
        fun.side_effect = ValueError()
        t.schedule.apply_entry(fun)
        fun.assert_called_with()
        self.assertFalse(stderr.getvalue())

    @patch('os._exit')
    def test_thread_crash(self, _exit):
        t = timer2.Timer()
        t._next_entry = Mock()
        t._next_entry.side_effect = OSError(131)
        t.run()
        _exit.assert_called_with(1)

    def test_gc_race_lost(self):
        t = timer2.Timer()
        t._is_stopped.set = Mock()
        t._is_stopped.set.side_effect = TypeError()

        t._is_shutdown.set()
        t.run()
        t._is_stopped.set.assert_called_with()

    def test_to_timestamp(self):
        self.assertIs(timer2.to_timestamp(3.13), 3.13)

    def test_test_enter(self):
        t = timer2.Timer()
        t._do_enter = Mock()
        e = Mock()
        t.enter(e, 13, 0)
        t._do_enter.assert_called_with('enter_at', e, 13, priority=0)

    def test_test_enter_after(self):
        t = timer2.Timer()
        t._do_enter = Mock()
        t.enter_after()
        t._do_enter.assert_called_with('enter_after')

    def test_cancel(self):
        t = timer2.Timer()
        tref = Mock()
        t.cancel(tref)
        tref.cancel.assert_called_with()
