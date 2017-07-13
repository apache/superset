# -*- coding: utf-8 -*-
""" Test printing of scalar types.

"""
from __future__ import division, absolute_import, print_function

import numpy as np
from numpy.testing import TestCase, assert_, run_module_suite


class TestRealScalars(TestCase):
    def test_str(self):
        svals = [0.0, -0.0, 1, -1, np.inf, -np.inf, np.nan]
        styps = [np.float16, np.float32, np.float64, np.longdouble]
        actual = [str(f(c)) for c in svals for f in styps]
        wanted = [
             '0.0',  '0.0',  '0.0',  '0.0',
             '-0.0', '-0.0', '-0.0', '-0.0',
             '1.0',  '1.0',  '1.0',  '1.0',
             '-1.0', '-1.0', '-1.0', '-1.0',
             'inf',  'inf',  'inf',  'inf',
             '-inf', '-inf', '-inf', '-inf',
             'nan',  'nan',  'nan',  'nan']

        for res, val in zip(actual, wanted):
            assert_(res == val)


if __name__ == "__main__":
    run_module_suite()
