from __future__ import absolute_import

import os

from itertools import count

from celery.concurrency.base import apply_target, BasePool
from celery.tests.case import AppCase, Mock


class test_BasePool(AppCase):

    def test_apply_target(self):

        scratch = {}
        counter = count(0)

        def gen_callback(name, retval=None):

            def callback(*args):
                scratch[name] = (next(counter), args)
                return retval

            return callback

        apply_target(gen_callback('target', 42),
                     args=(8, 16),
                     callback=gen_callback('callback'),
                     accept_callback=gen_callback('accept_callback'))

        self.assertDictContainsSubset(
            {'target': (1, (8, 16)), 'callback': (2, (42, ))},
            scratch,
        )
        pa1 = scratch['accept_callback']
        self.assertEqual(0, pa1[0])
        self.assertEqual(pa1[1][0], os.getpid())
        self.assertTrue(pa1[1][1])

        # No accept callback
        scratch.clear()
        apply_target(gen_callback('target', 42),
                     args=(8, 16),
                     callback=gen_callback('callback'),
                     accept_callback=None)
        self.assertDictEqual(scratch,
                             {'target': (3, (8, 16)),
                              'callback': (4, (42, ))})

    def test_does_not_debug(self):
        x = BasePool(10)
        x._does_debug = False
        x.apply_async(object)

    def test_num_processes(self):
        self.assertEqual(BasePool(7).num_processes, 7)

    def test_interface_on_start(self):
        BasePool(10).on_start()

    def test_interface_on_stop(self):
        BasePool(10).on_stop()

    def test_interface_on_apply(self):
        BasePool(10).on_apply()

    def test_interface_info(self):
        self.assertDictEqual(BasePool(10).info, {})

    def test_active(self):
        p = BasePool(10)
        self.assertFalse(p.active)
        p._state = p.RUN
        self.assertTrue(p.active)

    def test_restart(self):
        p = BasePool(10)
        with self.assertRaises(NotImplementedError):
            p.restart()

    def test_interface_on_terminate(self):
        p = BasePool(10)
        p.on_terminate()

    def test_interface_terminate_job(self):
        with self.assertRaises(NotImplementedError):
            BasePool(10).terminate_job(101)

    def test_interface_did_start_ok(self):
        self.assertTrue(BasePool(10).did_start_ok())

    def test_interface_register_with_event_loop(self):
        self.assertIsNone(
            BasePool(10).register_with_event_loop(Mock()),
        )

    def test_interface_on_soft_timeout(self):
        self.assertIsNone(BasePool(10).on_soft_timeout(Mock()))

    def test_interface_on_hard_timeout(self):
        self.assertIsNone(BasePool(10).on_hard_timeout(Mock()))

    def test_interface_close(self):
        p = BasePool(10)
        p.on_close = Mock()
        p.close()
        self.assertEqual(p._state, p.CLOSE)
        p.on_close.assert_called_with()

    def test_interface_no_close(self):
        self.assertIsNone(BasePool(10).on_close())
