from __future__ import absolute_import

import time
import itertools

from billiard.einfo import ExceptionInfo

from celery.tests.case import AppCase, SkipTest


def do_something(i):
    return i * i


def long_something():
    time.sleep(1)


def raise_something(i):
    try:
        raise KeyError('FOO EXCEPTION')
    except KeyError:
        return ExceptionInfo()


class test_TaskPool(AppCase):

    def setup(self):
        try:
            __import__('multiprocessing')
        except ImportError:
            raise SkipTest('multiprocessing not supported')
        from celery.concurrency.prefork import TaskPool
        self.TaskPool = TaskPool

    def test_attrs(self):
        p = self.TaskPool(2)
        self.assertEqual(p.limit, 2)
        self.assertIsNone(p._pool)

    def x_apply(self):
        p = self.TaskPool(2)
        p.start()
        scratchpad = {}
        proc_counter = itertools.count()

        def mycallback(ret_value):
            process = next(proc_counter)
            scratchpad[process] = {}
            scratchpad[process]['ret_value'] = ret_value

        myerrback = mycallback

        res = p.apply_async(do_something, args=[10], callback=mycallback)
        res2 = p.apply_async(raise_something, args=[10], errback=myerrback)
        res3 = p.apply_async(do_something, args=[20], callback=mycallback)

        self.assertEqual(res.get(), 100)
        time.sleep(0.5)
        self.assertDictContainsSubset({'ret_value': 100},
                                      scratchpad.get(0))

        self.assertIsInstance(res2.get(), ExceptionInfo)
        self.assertTrue(scratchpad.get(1))
        time.sleep(1)
        self.assertIsInstance(scratchpad[1]['ret_value'],
                              ExceptionInfo)
        self.assertEqual(scratchpad[1]['ret_value'].exception.args,
                         ('FOO EXCEPTION', ))

        self.assertEqual(res3.get(), 400)
        time.sleep(0.5)
        self.assertDictContainsSubset({'ret_value': 400},
                                      scratchpad.get(2))

        res3 = p.apply_async(do_something, args=[30], callback=mycallback)

        self.assertEqual(res3.get(), 900)
        time.sleep(0.5)
        self.assertDictContainsSubset({'ret_value': 900},
                                      scratchpad.get(3))
        p.stop()
