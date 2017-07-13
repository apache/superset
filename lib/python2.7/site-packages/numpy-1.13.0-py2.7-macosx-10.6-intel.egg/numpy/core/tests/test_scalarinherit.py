# -*- coding: utf-8 -*-
""" Test printing of scalar types.

"""
from __future__ import division, absolute_import, print_function

import numpy as np
from numpy.testing import TestCase, run_module_suite, assert_


class A(object):
    pass
class B(A, np.float64):
    pass

class C(B):
    pass
class D(C, B):
    pass

class B0(np.float64, A):
    pass
class C0(B0):
    pass

class TestInherit(TestCase):
    def test_init(self):
        x = B(1.0)
        assert_(str(x) == '1.0')
        y = C(2.0)
        assert_(str(y) == '2.0')
        z = D(3.0)
        assert_(str(z) == '3.0')

    def test_init2(self):
        x = B0(1.0)
        assert_(str(x) == '1.0')
        y = C0(2.0)
        assert_(str(y) == '2.0')

if __name__ == "__main__":
    run_module_suite()
