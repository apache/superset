from __future__ import absolute_import

import sys

from celery.app.defaults import is_pypy
from celery.concurrency.eventlet import (
    apply_target,
    Schedule,
    Timer,
    TaskPool,
)

from celery.tests.case import (
    AppCase, Mock, SkipTest, mock_module, patch, patch_many, skip_if_pypy,
)


class EventletCase(AppCase):

    @skip_if_pypy
    def setup(self):
        if is_pypy:
            raise SkipTest('mock_modules not working on PyPy1.9')
        try:
            self.eventlet = __import__('eventlet')
        except ImportError:
            raise SkipTest(
                'eventlet not installed, skipping related tests.')

    @skip_if_pypy
    def teardown(self):
        for mod in [mod for mod in sys.modules if mod.startswith('eventlet')]:
            try:
                del(sys.modules[mod])
            except KeyError:
                pass


class test_aaa_eventlet_patch(EventletCase):

    def test_aaa_is_patched(self):
        with patch('eventlet.monkey_patch', create=True) as monkey_patch:
            from celery import maybe_patch_concurrency
            maybe_patch_concurrency(['x', '-P', 'eventlet'])
            monkey_patch.assert_called_with()


eventlet_modules = (
    'eventlet',
    'eventlet.debug',
    'eventlet.greenthread',
    'eventlet.greenpool',
    'greenlet',
)


class test_Schedule(EventletCase):

    def test_sched(self):
        with mock_module(*eventlet_modules):
            with patch_many('eventlet.greenthread.spawn_after',
                            'greenlet.GreenletExit') as (spawn_after,
                                                         GreenletExit):
                x = Schedule()
                x.GreenletExit = KeyError
                entry = Mock()
                g = x._enter(1, 0, entry)
                self.assertTrue(x.queue)

                x._entry_exit(g, entry)
                g.wait.side_effect = KeyError()
                x._entry_exit(g, entry)
                entry.cancel.assert_called_with()
                self.assertFalse(x._queue)

                x._queue.add(g)
                x.clear()
                x._queue.add(g)
                g.cancel.side_effect = KeyError()
                x.clear()


class test_TaskPool(EventletCase):

    def test_pool(self):
        with mock_module(*eventlet_modules):
            with patch_many('eventlet.greenpool.GreenPool',
                            'eventlet.greenthread') as (GreenPool,
                                                        greenthread):
                x = TaskPool()
                x.on_start()
                x.on_stop()
                x.on_apply(Mock())
                x._pool = None
                x.on_stop()
                self.assertTrue(x.getpid())

    @patch('celery.concurrency.eventlet.base')
    def test_apply_target(self, base):
        apply_target(Mock(), getpid=Mock())
        self.assertTrue(base.apply_target.called)


class test_Timer(EventletCase):

    def test_timer(self):
        x = Timer()
        x.ensure_started()
        x.schedule = Mock()
        x.start()
        x.stop()
        x.schedule.clear.assert_called_with()

        tref = Mock()
        x.cancel(tref)
        x.schedule.GreenletExit = KeyError
        tref.cancel.side_effect = KeyError()
        x.cancel(tref)
