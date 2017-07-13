from __future__ import absolute_import

import pickle
import sys

from kombu.utils.functional import lazy, maybe_evaluate

from kombu.tests.case import Case, SkipTest


def double(x):
    return x * 2


class test_lazy(Case):

    def test__str__(self):
        self.assertEqual(
            str(lazy(lambda: 'the quick brown fox')),
            'the quick brown fox',
        )

    def test__repr__(self):
        self.assertEqual(
            repr(lazy(lambda: 'fi fa fo')),
            "'fi fa fo'",
        )

    def test__cmp__(self):
        if sys.version_info[0] == 3:
            raise SkipTest('irrelevant on py3')

        self.assertEqual(lazy(lambda: 10).__cmp__(lazy(lambda: 20)), -1)
        self.assertEqual(lazy(lambda: 10).__cmp__(5), 1)

    def test_evaluate(self):
        self.assertEqual(lazy(lambda: 2 + 2)(), 4)
        self.assertEqual(lazy(lambda x: x * 4, 2), 8)
        self.assertEqual(lazy(lambda x: x * 8, 2)(), 16)

    def test_cmp(self):
        self.assertEqual(lazy(lambda: 10), lazy(lambda: 10))
        self.assertNotEqual(lazy(lambda: 10), lazy(lambda: 20))

    def test__reduce__(self):
        x = lazy(double, 4)
        y = pickle.loads(pickle.dumps(x))
        self.assertEqual(x(), y())

    def test__deepcopy__(self):
        from copy import deepcopy
        x = lazy(double, 4)
        y = deepcopy(x)
        self.assertEqual(x._fun, y._fun)
        self.assertEqual(x._args, y._args)
        self.assertEqual(x(), y())


class test_maybe_evaluate(Case):

    def test_evaluates(self):
        self.assertEqual(maybe_evaluate(lazy(lambda: 10)), 10)
        self.assertEqual(maybe_evaluate(20), 20)
