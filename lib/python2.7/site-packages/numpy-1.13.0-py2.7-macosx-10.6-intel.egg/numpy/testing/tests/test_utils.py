from __future__ import division, absolute_import, print_function

import warnings
import sys
import os
import itertools

import numpy as np
from numpy.testing import (
    assert_equal, assert_array_equal, assert_almost_equal,
    assert_array_almost_equal, assert_array_less, build_err_msg,
    raises, assert_raises, assert_warns, assert_no_warnings,
    assert_allclose, assert_approx_equal,
    assert_array_almost_equal_nulp, assert_array_max_ulp,
    clear_and_catch_warnings, suppress_warnings, run_module_suite,
    assert_string_equal, assert_, tempdir, temppath,
    )
import unittest


class _GenericTest(object):

    def _test_equal(self, a, b):
        self._assert_func(a, b)

    def _test_not_equal(self, a, b):
        try:
            self._assert_func(a, b)
        except AssertionError:
            pass
        else:
            raise AssertionError("a and b are found equal but are not")

    def test_array_rank1_eq(self):
        """Test two equal array of rank 1 are found equal."""
        a = np.array([1, 2])
        b = np.array([1, 2])

        self._test_equal(a, b)

    def test_array_rank1_noteq(self):
        """Test two different array of rank 1 are found not equal."""
        a = np.array([1, 2])
        b = np.array([2, 2])

        self._test_not_equal(a, b)

    def test_array_rank2_eq(self):
        """Test two equal array of rank 2 are found equal."""
        a = np.array([[1, 2], [3, 4]])
        b = np.array([[1, 2], [3, 4]])

        self._test_equal(a, b)

    def test_array_diffshape(self):
        """Test two arrays with different shapes are found not equal."""
        a = np.array([1, 2])
        b = np.array([[1, 2], [1, 2]])

        self._test_not_equal(a, b)

    def test_objarray(self):
        """Test object arrays."""
        a = np.array([1, 1], dtype=np.object)
        self._test_equal(a, 1)

    def test_array_likes(self):
        self._test_equal([1, 2, 3], (1, 2, 3))


class TestArrayEqual(_GenericTest, unittest.TestCase):

    def setUp(self):
        self._assert_func = assert_array_equal

    def test_generic_rank1(self):
        """Test rank 1 array for all dtypes."""
        def foo(t):
            a = np.empty(2, t)
            a.fill(1)
            b = a.copy()
            c = a.copy()
            c.fill(0)
            self._test_equal(a, b)
            self._test_not_equal(c, b)

        # Test numeric types and object
        for t in '?bhilqpBHILQPfdgFDG':
            foo(t)

        # Test strings
        for t in ['S1', 'U1']:
            foo(t)

    def test_generic_rank3(self):
        """Test rank 3 array for all dtypes."""
        def foo(t):
            a = np.empty((4, 2, 3), t)
            a.fill(1)
            b = a.copy()
            c = a.copy()
            c.fill(0)
            self._test_equal(a, b)
            self._test_not_equal(c, b)

        # Test numeric types and object
        for t in '?bhilqpBHILQPfdgFDG':
            foo(t)

        # Test strings
        for t in ['S1', 'U1']:
            foo(t)

    def test_nan_array(self):
        """Test arrays with nan values in them."""
        a = np.array([1, 2, np.nan])
        b = np.array([1, 2, np.nan])

        self._test_equal(a, b)

        c = np.array([1, 2, 3])
        self._test_not_equal(c, b)

    def test_string_arrays(self):
        """Test two arrays with different shapes are found not equal."""
        a = np.array(['floupi', 'floupa'])
        b = np.array(['floupi', 'floupa'])

        self._test_equal(a, b)

        c = np.array(['floupipi', 'floupa'])

        self._test_not_equal(c, b)

    def test_recarrays(self):
        """Test record arrays."""
        a = np.empty(2, [('floupi', np.float), ('floupa', np.float)])
        a['floupi'] = [1, 2]
        a['floupa'] = [1, 2]
        b = a.copy()

        self._test_equal(a, b)

        c = np.empty(2, [('floupipi', np.float), ('floupa', np.float)])
        c['floupipi'] = a['floupi'].copy()
        c['floupa'] = a['floupa'].copy()

        with suppress_warnings() as sup:
            l = sup.record(FutureWarning, message="elementwise == ")
            self._test_not_equal(c, b)
            assert_(len(l) == 1)


class TestBuildErrorMessage(unittest.TestCase):

    def test_build_err_msg_defaults(self):
        x = np.array([1.00001, 2.00002, 3.00003])
        y = np.array([1.00002, 2.00003, 3.00004])
        err_msg = 'There is a mismatch'

        a = build_err_msg([x, y], err_msg)
        b = ('\nItems are not equal: There is a mismatch\n ACTUAL: array([ '
             '1.00001,  2.00002,  3.00003])\n DESIRED: array([ 1.00002,  '
             '2.00003,  3.00004])')
        self.assertEqual(a, b)

    def test_build_err_msg_no_verbose(self):
        x = np.array([1.00001, 2.00002, 3.00003])
        y = np.array([1.00002, 2.00003, 3.00004])
        err_msg = 'There is a mismatch'

        a = build_err_msg([x, y], err_msg, verbose=False)
        b = '\nItems are not equal: There is a mismatch'
        self.assertEqual(a, b)

    def test_build_err_msg_custom_names(self):
        x = np.array([1.00001, 2.00002, 3.00003])
        y = np.array([1.00002, 2.00003, 3.00004])
        err_msg = 'There is a mismatch'

        a = build_err_msg([x, y], err_msg, names=('FOO', 'BAR'))
        b = ('\nItems are not equal: There is a mismatch\n FOO: array([ '
             '1.00001,  2.00002,  3.00003])\n BAR: array([ 1.00002,  2.00003,  '
             '3.00004])')
        self.assertEqual(a, b)

    def test_build_err_msg_custom_precision(self):
        x = np.array([1.000000001, 2.00002, 3.00003])
        y = np.array([1.000000002, 2.00003, 3.00004])
        err_msg = 'There is a mismatch'

        a = build_err_msg([x, y], err_msg, precision=10)
        b = ('\nItems are not equal: There is a mismatch\n ACTUAL: array([ '
             '1.000000001,  2.00002    ,  3.00003    ])\n DESIRED: array([ '
             '1.000000002,  2.00003    ,  3.00004    ])')
        self.assertEqual(a, b)


class TestEqual(TestArrayEqual):

    def setUp(self):
        self._assert_func = assert_equal

    def test_nan_items(self):
        self._assert_func(np.nan, np.nan)
        self._assert_func([np.nan], [np.nan])
        self._test_not_equal(np.nan, [np.nan])
        self._test_not_equal(np.nan, 1)

    def test_inf_items(self):
        self._assert_func(np.inf, np.inf)
        self._assert_func([np.inf], [np.inf])
        self._test_not_equal(np.inf, [np.inf])

    def test_nat_items(self):
        # not a datetime
        nadt_no_unit = np.datetime64("NaT")
        nadt_s = np.datetime64("NaT", "s")
        nadt_d = np.datetime64("NaT", "ns")
        # not a timedelta
        natd_no_unit = np.timedelta64("NaT")
        natd_s = np.timedelta64("NaT", "s")
        natd_d = np.timedelta64("NaT", "ns")

        dts = [nadt_no_unit, nadt_s, nadt_d]
        tds = [natd_no_unit, natd_s, natd_d]
        for a, b in itertools.product(dts, dts):
            self._assert_func(a, b)
            self._assert_func([a], [b])
            self._test_not_equal([a], b)

        for a, b in itertools.product(tds, tds):
            self._assert_func(a, b)
            self._assert_func([a], [b])
            self._test_not_equal([a], b)

        for a, b in itertools.product(tds, dts):
            self._test_not_equal(a, b)
            self._test_not_equal(a, [b])
            self._test_not_equal([a], [b])
            self._test_not_equal([a], np.datetime64("2017-01-01", "s"))
            self._test_not_equal([b], np.datetime64("2017-01-01", "s"))
            self._test_not_equal([a], np.timedelta64(123, "s"))
            self._test_not_equal([b], np.timedelta64(123, "s"))

    def test_non_numeric(self):
        self._assert_func('ab', 'ab')
        self._test_not_equal('ab', 'abb')

    def test_complex_item(self):
        self._assert_func(complex(1, 2), complex(1, 2))
        self._assert_func(complex(1, np.nan), complex(1, np.nan))
        self._test_not_equal(complex(1, np.nan), complex(1, 2))
        self._test_not_equal(complex(np.nan, 1), complex(1, np.nan))
        self._test_not_equal(complex(np.nan, np.inf), complex(np.nan, 2))

    def test_negative_zero(self):
        self._test_not_equal(np.PZERO, np.NZERO)

    def test_complex(self):
        x = np.array([complex(1, 2), complex(1, np.nan)])
        y = np.array([complex(1, 2), complex(1, 2)])
        self._assert_func(x, x)
        self._test_not_equal(x, y)

    def test_error_message(self):
        try:
            self._assert_func(np.array([1, 2]), np.matrix([1, 2]))
        except AssertionError as e:
            self.assertEqual(
                str(e),
                "\nArrays are not equal\n\n"
                "(shapes (2,), (1, 2) mismatch)\n"
                " x: array([1, 2])\n"
                " y: [repr failed for <matrix>: The truth value of an array "
                "with more than one element is ambiguous. Use a.any() or "
                "a.all()]")


class TestArrayAlmostEqual(_GenericTest, unittest.TestCase):

    def setUp(self):
        self._assert_func = assert_array_almost_equal

    def test_closeness(self):
        # Note that in the course of time we ended up with
        #     `abs(x - y) < 1.5 * 10**(-decimal)`
        # instead of the previously documented
        #     `abs(x - y) < 0.5 * 10**(-decimal)`
        # so this check serves to preserve the wrongness.

        # test scalars
        self._assert_func(1.499999, 0.0, decimal=0)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(1.5, 0.0, decimal=0))

        # test arrays
        self._assert_func([1.499999], [0.0], decimal=0)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func([1.5], [0.0], decimal=0))

    def test_simple(self):
        x = np.array([1234.2222])
        y = np.array([1234.2223])

        self._assert_func(x, y, decimal=3)
        self._assert_func(x, y, decimal=4)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(x, y, decimal=5))

    def test_nan(self):
        anan = np.array([np.nan])
        aone = np.array([1])
        ainf = np.array([np.inf])
        self._assert_func(anan, anan)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(anan, aone))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(anan, ainf))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(ainf, anan))

    def test_inf(self):
        a = np.array([[1., 2.], [3., 4.]])
        b = a.copy()
        a[0, 0] = np.inf
        self.assertRaises(AssertionError,
                lambda: self._assert_func(a, b))
        b[0, 0] = -np.inf
        self.assertRaises(AssertionError,
                lambda: self._assert_func(a, b))

    def test_subclass(self):
        a = np.array([[1., 2.], [3., 4.]])
        b = np.ma.masked_array([[1., 2.], [0., 4.]],
                               [[False, False], [True, False]])
        self._assert_func(a, b)
        self._assert_func(b, a)
        self._assert_func(b, b)

    def test_matrix(self):
        # Matrix slicing keeps things 2-D, while array does not necessarily.
        # See gh-8452.
        m1 = np.matrix([[1., 2.]])
        m2 = np.matrix([[1., np.nan]])
        m3 = np.matrix([[1., -np.inf]])
        m4 = np.matrix([[np.nan, np.inf]])
        m5 = np.matrix([[1., 2.], [np.nan, np.inf]])
        for m in m1, m2, m3, m4, m5:
            self._assert_func(m, m)
            a = np.array(m)
            self._assert_func(a, m)
            self._assert_func(m, a)

    def test_subclass_that_cannot_be_bool(self):
        # While we cannot guarantee testing functions will always work for
        # subclasses, the tests should ideally rely only on subclasses having
        # comparison operators, not on them being able to store booleans
        # (which, e.g., astropy Quantity cannot usefully do). See gh-8452.
        class MyArray(np.ndarray):
            def __lt__(self, other):
                return super(MyArray, self).__lt__(other).view(np.ndarray)

            def all(self, *args, **kwargs):
                raise NotImplementedError

        a = np.array([1., 2.]).view(MyArray)
        self._assert_func(a, a)


class TestAlmostEqual(_GenericTest, unittest.TestCase):

    def setUp(self):
        self._assert_func = assert_almost_equal

    def test_closeness(self):
        # Note that in the course of time we ended up with
        #     `abs(x - y) < 1.5 * 10**(-decimal)`
        # instead of the previously documented
        #     `abs(x - y) < 0.5 * 10**(-decimal)`
        # so this check serves to preserve the wrongness.

        # test scalars
        self._assert_func(1.499999, 0.0, decimal=0)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(1.5, 0.0, decimal=0))

        # test arrays
        self._assert_func([1.499999], [0.0], decimal=0)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func([1.5], [0.0], decimal=0))

    def test_nan_item(self):
        self._assert_func(np.nan, np.nan)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(np.nan, 1))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(np.nan, np.inf))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(np.inf, np.nan))

    def test_inf_item(self):
        self._assert_func(np.inf, np.inf)
        self._assert_func(-np.inf, -np.inf)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(np.inf, 1))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(-np.inf, np.inf))

    def test_simple_item(self):
        self._test_not_equal(1, 2)

    def test_complex_item(self):
        self._assert_func(complex(1, 2), complex(1, 2))
        self._assert_func(complex(1, np.nan), complex(1, np.nan))
        self._assert_func(complex(np.inf, np.nan), complex(np.inf, np.nan))
        self._test_not_equal(complex(1, np.nan), complex(1, 2))
        self._test_not_equal(complex(np.nan, 1), complex(1, np.nan))
        self._test_not_equal(complex(np.nan, np.inf), complex(np.nan, 2))

    def test_complex(self):
        x = np.array([complex(1, 2), complex(1, np.nan)])
        z = np.array([complex(1, 2), complex(np.nan, 1)])
        y = np.array([complex(1, 2), complex(1, 2)])
        self._assert_func(x, x)
        self._test_not_equal(x, y)
        self._test_not_equal(x, z)

    def test_error_message(self):
        """Check the message is formatted correctly for the decimal value"""
        x = np.array([1.00000000001, 2.00000000002, 3.00003])
        y = np.array([1.00000000002, 2.00000000003, 3.00004])

        # test with a different amount of decimal digits
        # note that we only check for the formatting of the arrays themselves
        b = ('x: array([ 1.00000000001,  2.00000000002,  3.00003     '
             ' ])\n y: array([ 1.00000000002,  2.00000000003,  3.00004      ])')
        try:
            self._assert_func(x, y, decimal=12)
        except AssertionError as e:
            # remove anything that's not the array string
            self.assertEqual(str(e).split('%)\n ')[1], b)

        # with the default value of decimal digits, only the 3rd element differs
        # note that we only check for the formatting of the arrays themselves
        b = ('x: array([ 1.     ,  2.     ,  3.00003])\n y: array([ 1.     ,  '
             '2.     ,  3.00004])')
        try:
            self._assert_func(x, y)
        except AssertionError as e:
            # remove anything that's not the array string
            self.assertEqual(str(e).split('%)\n ')[1], b)

    def test_matrix(self):
        # Matrix slicing keeps things 2-D, while array does not necessarily.
        # See gh-8452.
        m1 = np.matrix([[1., 2.]])
        m2 = np.matrix([[1., np.nan]])
        m3 = np.matrix([[1., -np.inf]])
        m4 = np.matrix([[np.nan, np.inf]])
        m5 = np.matrix([[1., 2.], [np.nan, np.inf]])
        for m in m1, m2, m3, m4, m5:
            self._assert_func(m, m)
            a = np.array(m)
            self._assert_func(a, m)
            self._assert_func(m, a)

    def test_subclass_that_cannot_be_bool(self):
        # While we cannot guarantee testing functions will always work for
        # subclasses, the tests should ideally rely only on subclasses having
        # comparison operators, not on them being able to store booleans
        # (which, e.g., astropy Quantity cannot usefully do). See gh-8452.
        class MyArray(np.ndarray):
            def __lt__(self, other):
                return super(MyArray, self).__lt__(other).view(np.ndarray)

            def all(self, *args, **kwargs):
                raise NotImplementedError

        a = np.array([1., 2.]).view(MyArray)
        self._assert_func(a, a)


class TestApproxEqual(unittest.TestCase):

    def setUp(self):
        self._assert_func = assert_approx_equal

    def test_simple_arrays(self):
        x = np.array([1234.22])
        y = np.array([1234.23])

        self._assert_func(x, y, significant=5)
        self._assert_func(x, y, significant=6)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(x, y, significant=7))

    def test_simple_items(self):
        x = 1234.22
        y = 1234.23

        self._assert_func(x, y, significant=4)
        self._assert_func(x, y, significant=5)
        self._assert_func(x, y, significant=6)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(x, y, significant=7))

    def test_nan_array(self):
        anan = np.array(np.nan)
        aone = np.array(1)
        ainf = np.array(np.inf)
        self._assert_func(anan, anan)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(anan, aone))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(anan, ainf))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(ainf, anan))

    def test_nan_items(self):
        anan = np.array(np.nan)
        aone = np.array(1)
        ainf = np.array(np.inf)
        self._assert_func(anan, anan)
        self.assertRaises(AssertionError,
                lambda: self._assert_func(anan, aone))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(anan, ainf))
        self.assertRaises(AssertionError,
                lambda: self._assert_func(ainf, anan))


class TestArrayAssertLess(unittest.TestCase):

    def setUp(self):
        self._assert_func = assert_array_less

    def test_simple_arrays(self):
        x = np.array([1.1, 2.2])
        y = np.array([1.2, 2.3])

        self._assert_func(x, y)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

        y = np.array([1.0, 2.3])

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, y))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

    def test_rank2(self):
        x = np.array([[1.1, 2.2], [3.3, 4.4]])
        y = np.array([[1.2, 2.3], [3.4, 4.5]])

        self._assert_func(x, y)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

        y = np.array([[1.0, 2.3], [3.4, 4.5]])

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, y))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

    def test_rank3(self):
        x = np.ones(shape=(2, 2, 2))
        y = np.ones(shape=(2, 2, 2))+1

        self._assert_func(x, y)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

        y[0, 0, 0] = 0

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, y))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

    def test_simple_items(self):
        x = 1.1
        y = 2.2

        self._assert_func(x, y)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

        y = np.array([2.2, 3.3])

        self._assert_func(x, y)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(y, x))

        y = np.array([1.0, 3.3])

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, y))

    def test_nan_noncompare(self):
        anan = np.array(np.nan)
        aone = np.array(1)
        ainf = np.array(np.inf)
        self._assert_func(anan, anan)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(aone, anan))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(anan, aone))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(anan, ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(ainf, anan))

    def test_nan_noncompare_array(self):
        x = np.array([1.1, 2.2, 3.3])
        anan = np.array(np.nan)

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, anan))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(anan, x))

        x = np.array([1.1, 2.2, np.nan])

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, anan))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(anan, x))

        y = np.array([1.0, 2.0, np.nan])

        self._assert_func(y, x)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, y))

    def test_inf_compare(self):
        aone = np.array(1)
        ainf = np.array(np.inf)

        self._assert_func(aone, ainf)
        self._assert_func(-ainf, aone)
        self._assert_func(-ainf, ainf)
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(ainf, aone))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(aone, -ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(ainf, ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(ainf, -ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(-ainf, -ainf))

    def test_inf_compare_array(self):
        x = np.array([1.1, 2.2, np.inf])
        ainf = np.array(np.inf)

        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(ainf, x))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(x, -ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(-x, -ainf))
        self.assertRaises(AssertionError,
                          lambda: self._assert_func(-ainf, -x))
        self._assert_func(-ainf, x)


class TestRaises(unittest.TestCase):

    def setUp(self):
        class MyException(Exception):
            pass

        self.e = MyException

    def raises_exception(self, e):
        raise e

    def does_not_raise_exception(self):
        pass

    def test_correct_catch(self):
        raises(self.e)(self.raises_exception)(self.e)  # raises?

    def test_wrong_exception(self):
        try:
            raises(self.e)(self.raises_exception)(RuntimeError)  # raises?
        except RuntimeError:
            return
        else:
            raise AssertionError("should have caught RuntimeError")

    def test_catch_no_raise(self):
        try:
            raises(self.e)(self.does_not_raise_exception)()  # raises?
        except AssertionError:
            return
        else:
            raise AssertionError("should have raised an AssertionError")


class TestWarns(unittest.TestCase):

    def test_warn(self):
        def f():
            warnings.warn("yo")
            return 3

        before_filters = sys.modules['warnings'].filters[:]
        assert_equal(assert_warns(UserWarning, f), 3)
        after_filters = sys.modules['warnings'].filters

        assert_raises(AssertionError, assert_no_warnings, f)
        assert_equal(assert_no_warnings(lambda x: x, 1), 1)

        # Check that the warnings state is unchanged
        assert_equal(before_filters, after_filters,
                     "assert_warns does not preserver warnings state")

    def test_context_manager(self):

        before_filters = sys.modules['warnings'].filters[:]
        with assert_warns(UserWarning):
            warnings.warn("yo")
        after_filters = sys.modules['warnings'].filters

        def no_warnings():
            with assert_no_warnings():
                warnings.warn("yo")

        assert_raises(AssertionError, no_warnings)
        assert_equal(before_filters, after_filters,
                     "assert_warns does not preserver warnings state")

    def test_warn_wrong_warning(self):
        def f():
            warnings.warn("yo", DeprecationWarning)

        failed = False
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            try:
                # Should raise a DeprecationWarning
                assert_warns(UserWarning, f)
                failed = True
            except DeprecationWarning:
                pass

        if failed:
            raise AssertionError("wrong warning caught by assert_warn")


class TestAssertAllclose(unittest.TestCase):

    def test_simple(self):
        x = 1e-3
        y = 1e-9

        assert_allclose(x, y, atol=1)
        self.assertRaises(AssertionError, assert_allclose, x, y)

        a = np.array([x, y, x, y])
        b = np.array([x, y, x, x])

        assert_allclose(a, b, atol=1)
        self.assertRaises(AssertionError, assert_allclose, a, b)

        b[-1] = y * (1 + 1e-8)
        assert_allclose(a, b)
        self.assertRaises(AssertionError, assert_allclose, a, b,
                          rtol=1e-9)

        assert_allclose(6, 10, rtol=0.5)
        self.assertRaises(AssertionError, assert_allclose, 10, 6, rtol=0.5)

    def test_min_int(self):
        a = np.array([np.iinfo(np.int_).min], dtype=np.int_)
        # Should not raise:
        assert_allclose(a, a)

    def test_report_fail_percentage(self):
        a = np.array([1, 1, 1, 1])
        b = np.array([1, 1, 1, 2])
        try:
            assert_allclose(a, b)
            msg = ''
        except AssertionError as exc:
            msg = exc.args[0]
        self.assertTrue("mismatch 25.0%" in msg)

    def test_equal_nan(self):
        a = np.array([np.nan])
        b = np.array([np.nan])
        # Should not raise:
        assert_allclose(a, b, equal_nan=True)

    def test_not_equal_nan(self):
        a = np.array([np.nan])
        b = np.array([np.nan])
        self.assertRaises(AssertionError, assert_allclose, a, b,
                          equal_nan=False)

    def test_equal_nan_default(self):
        # Make sure equal_nan default behavior remains unchanged. (All
        # of these functions use assert_array_compare under the hood.)
        # None of these should raise.
        a = np.array([np.nan])
        b = np.array([np.nan])
        assert_array_equal(a, b)
        assert_array_almost_equal(a, b)
        assert_array_less(a, b)
        assert_allclose(a, b)


class TestArrayAlmostEqualNulp(unittest.TestCase):

    def test_float64_pass(self):
        # The number of units of least precision
        # In this case, use a few places above the lowest level (ie nulp=1)
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float64)
        x = 10**x
        x = np.r_[-x, x]

        # Addition
        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp/2.
        assert_array_almost_equal_nulp(x, y, nulp)

        # Subtraction
        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp/2.
        assert_array_almost_equal_nulp(x, y, nulp)

    def test_float64_fail(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float64)
        x = 10**x
        x = np.r_[-x, x]

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          x, y, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          x, y, nulp)

    def test_float32_pass(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float32)
        x = 10**x
        x = np.r_[-x, x]

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp/2.
        assert_array_almost_equal_nulp(x, y, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp/2.
        assert_array_almost_equal_nulp(x, y, nulp)

    def test_float32_fail(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float32)
        x = 10**x
        x = np.r_[-x, x]

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          x, y, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          x, y, nulp)

    def test_complex128_pass(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float64)
        x = 10**x
        x = np.r_[-x, x]
        xi = x + x*1j

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp/2.
        assert_array_almost_equal_nulp(xi, x + y*1j, nulp)
        assert_array_almost_equal_nulp(xi, y + x*1j, nulp)
        # The test condition needs to be at least a factor of sqrt(2) smaller
        # because the real and imaginary parts both change
        y = x + x*eps*nulp/4.
        assert_array_almost_equal_nulp(xi, y + y*1j, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp/2.
        assert_array_almost_equal_nulp(xi, x + y*1j, nulp)
        assert_array_almost_equal_nulp(xi, y + x*1j, nulp)
        y = x - x*epsneg*nulp/4.
        assert_array_almost_equal_nulp(xi, y + y*1j, nulp)

    def test_complex128_fail(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float64)
        x = 10**x
        x = np.r_[-x, x]
        xi = x + x*1j

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, x + y*1j, nulp)
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + x*1j, nulp)
        # The test condition needs to be at least a factor of sqrt(2) smaller
        # because the real and imaginary parts both change
        y = x + x*eps*nulp
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + y*1j, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, x + y*1j, nulp)
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + x*1j, nulp)
        y = x - x*epsneg*nulp
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + y*1j, nulp)

    def test_complex64_pass(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float32)
        x = 10**x
        x = np.r_[-x, x]
        xi = x + x*1j

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp/2.
        assert_array_almost_equal_nulp(xi, x + y*1j, nulp)
        assert_array_almost_equal_nulp(xi, y + x*1j, nulp)
        y = x + x*eps*nulp/4.
        assert_array_almost_equal_nulp(xi, y + y*1j, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp/2.
        assert_array_almost_equal_nulp(xi, x + y*1j, nulp)
        assert_array_almost_equal_nulp(xi, y + x*1j, nulp)
        y = x - x*epsneg*nulp/4.
        assert_array_almost_equal_nulp(xi, y + y*1j, nulp)

    def test_complex64_fail(self):
        nulp = 5
        x = np.linspace(-20, 20, 50, dtype=np.float32)
        x = 10**x
        x = np.r_[-x, x]
        xi = x + x*1j

        eps = np.finfo(x.dtype).eps
        y = x + x*eps*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, x + y*1j, nulp)
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + x*1j, nulp)
        y = x + x*eps*nulp
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + y*1j, nulp)

        epsneg = np.finfo(x.dtype).epsneg
        y = x - x*epsneg*nulp*2.
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, x + y*1j, nulp)
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + x*1j, nulp)
        y = x - x*epsneg*nulp
        self.assertRaises(AssertionError, assert_array_almost_equal_nulp,
                          xi, y + y*1j, nulp)


class TestULP(unittest.TestCase):

    def test_equal(self):
        x = np.random.randn(10)
        assert_array_max_ulp(x, x, maxulp=0)

    def test_single(self):
        # Generate 1 + small deviation, check that adding eps gives a few UNL
        x = np.ones(10).astype(np.float32)
        x += 0.01 * np.random.randn(10).astype(np.float32)
        eps = np.finfo(np.float32).eps
        assert_array_max_ulp(x, x+eps, maxulp=20)

    def test_double(self):
        # Generate 1 + small deviation, check that adding eps gives a few UNL
        x = np.ones(10).astype(np.float64)
        x += 0.01 * np.random.randn(10).astype(np.float64)
        eps = np.finfo(np.float64).eps
        assert_array_max_ulp(x, x+eps, maxulp=200)

    def test_inf(self):
        for dt in [np.float32, np.float64]:
            inf = np.array([np.inf]).astype(dt)
            big = np.array([np.finfo(dt).max])
            assert_array_max_ulp(inf, big, maxulp=200)

    def test_nan(self):
        # Test that nan is 'far' from small, tiny, inf, max and min
        for dt in [np.float32, np.float64]:
            if dt == np.float32:
                maxulp = 1e6
            else:
                maxulp = 1e12
            inf = np.array([np.inf]).astype(dt)
            nan = np.array([np.nan]).astype(dt)
            big = np.array([np.finfo(dt).max])
            tiny = np.array([np.finfo(dt).tiny])
            zero = np.array([np.PZERO]).astype(dt)
            nzero = np.array([np.NZERO]).astype(dt)
            self.assertRaises(AssertionError,
                                  lambda: assert_array_max_ulp(nan, inf,
                                                               maxulp=maxulp))
            self.assertRaises(AssertionError,
                                  lambda: assert_array_max_ulp(nan, big,
                                                               maxulp=maxulp))
            self.assertRaises(AssertionError,
                                  lambda: assert_array_max_ulp(nan, tiny,
                                                               maxulp=maxulp))
            self.assertRaises(AssertionError,
                                  lambda: assert_array_max_ulp(nan, zero,
                                                               maxulp=maxulp))
            self.assertRaises(AssertionError,
                                  lambda: assert_array_max_ulp(nan, nzero,
                                                               maxulp=maxulp))


class TestStringEqual(unittest.TestCase):
    def test_simple(self):
        assert_string_equal("hello", "hello")
        assert_string_equal("hello\nmultiline", "hello\nmultiline")

        try:
            assert_string_equal("foo\nbar", "hello\nbar")
        except AssertionError as exc:
            assert_equal(str(exc), "Differences in strings:\n- foo\n+ hello")
        else:
            raise AssertionError("exception not raised")

        self.assertRaises(AssertionError,
                          lambda: assert_string_equal("foo", "hello"))


def assert_warn_len_equal(mod, n_in_context, py3_n_in_context=None):
    mod_warns = mod.__warningregistry__
    # Python 3.4 appears to clear any pre-existing warnings of the same type,
    # when raising warnings inside a catch_warnings block. So, there is a
    # warning generated by the tests within the context manager, but no
    # previous warnings.
    if 'version' in mod_warns:
        if py3_n_in_context is None:
            py3_n_in_context = n_in_context
        assert_equal(len(mod_warns) - 1, py3_n_in_context)
    else:
        assert_equal(len(mod_warns), n_in_context)


def _get_fresh_mod():
    # Get this module, with warning registry empty
    my_mod = sys.modules[__name__]
    try:
        my_mod.__warningregistry__.clear()
    except AttributeError:
        pass
    return my_mod


def test_clear_and_catch_warnings():
    # Initial state of module, no warnings
    my_mod = _get_fresh_mod()
    assert_equal(getattr(my_mod, '__warningregistry__', {}), {})
    with clear_and_catch_warnings(modules=[my_mod]):
        warnings.simplefilter('ignore')
        warnings.warn('Some warning')
    assert_equal(my_mod.__warningregistry__, {})
    # Without specified modules, don't clear warnings during context
    with clear_and_catch_warnings():
        warnings.simplefilter('ignore')
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 1)
    # Confirm that specifying module keeps old warning, does not add new
    with clear_and_catch_warnings(modules=[my_mod]):
        warnings.simplefilter('ignore')
        warnings.warn('Another warning')
    assert_warn_len_equal(my_mod, 1)
    # Another warning, no module spec does add to warnings dict, except on
    # Python 3.4 (see comments in `assert_warn_len_equal`)
    with clear_and_catch_warnings():
        warnings.simplefilter('ignore')
        warnings.warn('Another warning')
    assert_warn_len_equal(my_mod, 2, 1)


def test_suppress_warnings_module():
    # Initial state of module, no warnings
    my_mod = _get_fresh_mod()
    assert_equal(getattr(my_mod, '__warningregistry__', {}), {})

    def warn_other_module():
        # Apply along axis is implemented in python; stacklevel=2 means
        # we end up inside its module, not ours.
        def warn(arr):
            warnings.warn("Some warning 2", stacklevel=2)
            return arr
        np.apply_along_axis(warn, 0, [0])

    # Test module based warning suppression:
    with suppress_warnings() as sup:
        sup.record(UserWarning)
        # suppress warning from other module (may have .pyc ending),
        # if apply_along_axis is moved, had to be changed.
        sup.filter(module=np.lib.shape_base)
        warnings.warn("Some warning")
        warn_other_module()
    # Check that the suppression did test the file correctly (this module
    # got filtered)
    assert_(len(sup.log) == 1)
    assert_(sup.log[0].message.args[0] == "Some warning")

    assert_warn_len_equal(my_mod, 0)
    sup = suppress_warnings()
    # Will have to be changed if apply_along_axis is moved:
    sup.filter(module=my_mod)
    with sup:
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 0)
    # And test repeat works:
    sup.filter(module=my_mod)
    with sup:
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 0)

    # Without specified modules, don't clear warnings during context
    with suppress_warnings():
        warnings.simplefilter('ignore')
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 1)


def test_suppress_warnings_type():
    # Initial state of module, no warnings
    my_mod = _get_fresh_mod()
    assert_equal(getattr(my_mod, '__warningregistry__', {}), {})

    # Test module based warning suppression:
    with suppress_warnings() as sup:
        sup.filter(UserWarning)
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 0)
    sup = suppress_warnings()
    sup.filter(UserWarning)
    with sup:
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 0)
    # And test repeat works:
    sup.filter(module=my_mod)
    with sup:
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 0)

    # Without specified modules, don't clear warnings during context
    with suppress_warnings():
        warnings.simplefilter('ignore')
        warnings.warn('Some warning')
    assert_warn_len_equal(my_mod, 1)


def test_suppress_warnings_decorate_no_record():
    sup = suppress_warnings()
    sup.filter(UserWarning)

    @sup
    def warn(category):
        warnings.warn('Some warning', category)

    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        warn(UserWarning)  # should be supppressed
        warn(RuntimeWarning)
        assert_(len(w) == 1)


def test_suppress_warnings_record():
    sup = suppress_warnings()
    log1 = sup.record()

    with sup:
        log2 = sup.record(message='Some other warning 2')
        sup.filter(message='Some warning')
        warnings.warn('Some warning')
        warnings.warn('Some other warning')
        warnings.warn('Some other warning 2')

        assert_(len(sup.log) == 2)
        assert_(len(log1) == 1)
        assert_(len(log2) == 1)
        assert_(log2[0].message.args[0] == 'Some other warning 2')

    # Do it again, with the same context to see if some warnings survived:
    with sup:
        log2 = sup.record(message='Some other warning 2')
        sup.filter(message='Some warning')
        warnings.warn('Some warning')
        warnings.warn('Some other warning')
        warnings.warn('Some other warning 2')

        assert_(len(sup.log) == 2)
        assert_(len(log1) == 1)
        assert_(len(log2) == 1)
        assert_(log2[0].message.args[0] == 'Some other warning 2')

    # Test nested:
    with suppress_warnings() as sup:
        sup.record()
        with suppress_warnings() as sup2:
            sup2.record(message='Some warning')
            warnings.warn('Some warning')
            warnings.warn('Some other warning')
            assert_(len(sup2.log) == 1)
        assert_(len(sup.log) == 1)


def test_suppress_warnings_forwarding():
    def warn_other_module():
        # Apply along axis is implemented in python; stacklevel=2 means
        # we end up inside its module, not ours.
        def warn(arr):
            warnings.warn("Some warning", stacklevel=2)
            return arr
        np.apply_along_axis(warn, 0, [0])

    with suppress_warnings() as sup:
        sup.record()
        with suppress_warnings("always"):
            for i in range(2):
                warnings.warn("Some warning")

        assert_(len(sup.log) == 2)

    with suppress_warnings() as sup:
        sup.record()
        with suppress_warnings("location"):
            for i in range(2):
                warnings.warn("Some warning")
                warnings.warn("Some warning")

        assert_(len(sup.log) == 2)

    with suppress_warnings() as sup:
        sup.record()
        with suppress_warnings("module"):
            for i in range(2):
                warnings.warn("Some warning")
                warnings.warn("Some warning")
                warn_other_module()

        assert_(len(sup.log) == 2)

    with suppress_warnings() as sup:
        sup.record()
        with suppress_warnings("once"):
            for i in range(2):
                warnings.warn("Some warning")
                warnings.warn("Some other warning")
                warn_other_module()

        assert_(len(sup.log) == 2)


def test_tempdir():
    with tempdir() as tdir:
        fpath = os.path.join(tdir, 'tmp')
        with open(fpath, 'w'):
            pass
    assert_(not os.path.isdir(tdir))

    raised = False
    try:
        with tempdir() as tdir:
            raise ValueError()
    except ValueError:
        raised = True
    assert_(raised)
    assert_(not os.path.isdir(tdir))


def test_temppath():
    with temppath() as fpath:
        with open(fpath, 'w') as f:
            pass
    assert_(not os.path.isfile(fpath))

    raised = False
    try:
        with temppath() as fpath:
            raise ValueError()
    except ValueError:
        raised = True
    assert_(raised)
    assert_(not os.path.isfile(fpath))


class my_cacw(clear_and_catch_warnings):

    class_modules = (sys.modules[__name__],)


def test_clear_and_catch_warnings_inherit():
    # Test can subclass and add default modules
    my_mod = _get_fresh_mod()
    with my_cacw():
        warnings.simplefilter('ignore')
        warnings.warn('Some warning')
    assert_equal(my_mod.__warningregistry__, {})


if __name__ == '__main__':
    run_module_suite()
