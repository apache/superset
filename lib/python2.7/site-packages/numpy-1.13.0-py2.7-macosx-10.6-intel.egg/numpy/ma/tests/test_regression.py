from __future__ import division, absolute_import, print_function

import warnings

import numpy as np
from numpy.testing import (assert_, TestCase, assert_array_equal,
                           assert_allclose, run_module_suite,
                           suppress_warnings)

rlevel = 1


class TestRegression(TestCase):
    def test_masked_array_create(self,level=rlevel):
        # Ticket #17
        x = np.ma.masked_array([0, 1, 2, 3, 0, 4, 5, 6],
                               mask=[0, 0, 0, 1, 1, 1, 0, 0])
        assert_array_equal(np.ma.nonzero(x), [[1, 2, 6, 7]])

    def test_masked_array(self,level=rlevel):
        # Ticket #61
        np.ma.array(1, mask=[1])

    def test_mem_masked_where(self,level=rlevel):
        # Ticket #62
        from numpy.ma import masked_where, MaskType
        a = np.zeros((1, 1))
        b = np.zeros(a.shape, MaskType)
        c = masked_where(b, a)
        a-c

    def test_masked_array_multiply(self,level=rlevel):
        # Ticket #254
        a = np.ma.zeros((4, 1))
        a[2, 0] = np.ma.masked
        b = np.zeros((4, 2))
        a*b
        b*a

    def test_masked_array_repeat(self, level=rlevel):
        # Ticket #271
        np.ma.array([1], mask=False).repeat(10)

    def test_masked_array_repr_unicode(self):
        # Ticket #1256
        repr(np.ma.array(u"Unicode"))

    def test_atleast_2d(self):
        # Ticket #1559
        a = np.ma.masked_array([0.0, 1.2, 3.5], mask=[False, True, False])
        b = np.atleast_2d(a)
        assert_(a.mask.ndim == 1)
        assert_(b.mask.ndim == 2)

    def test_set_fill_value_unicode_py3(self):
        # Ticket #2733
        a = np.ma.masked_array(['a', 'b', 'c'], mask=[1, 0, 0])
        a.fill_value = 'X'
        assert_(a.fill_value == 'X')

    def test_var_sets_maskedarray_scalar(self):
        # Issue gh-2757
        a = np.ma.array(np.arange(5), mask=True)
        mout = np.ma.array(-1, dtype=float)
        a.var(out=mout)
        assert_(mout._data == 0)

    def test_ddof_corrcoef(self):
        # See gh-3336
        x = np.ma.masked_equal([1, 2, 3, 4, 5], 4)
        y = np.array([2, 2.5, 3.1, 3, 5])
        # this test can be removed after deprecation.
        with suppress_warnings() as sup:
            sup.filter(DeprecationWarning, "bias and ddof have no effect")
            r0 = np.ma.corrcoef(x, y, ddof=0)
            r1 = np.ma.corrcoef(x, y, ddof=1)
            # ddof should not have an effect (it gets cancelled out)
            assert_allclose(r0.data, r1.data)

if __name__ == "__main__":
    run_module_suite()
