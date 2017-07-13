# -*- coding: utf-8 -*-
from __future__ import division, absolute_import, print_function

import sys

import numpy as np
from numpy.testing import (
     TestCase, run_module_suite, assert_, assert_equal
)

class TestArrayRepr(object):
    def test_nan_inf(self):
        x = np.array([np.nan, np.inf])
        assert_equal(repr(x), 'array([ nan,  inf])')

    def test_subclass(self):
        class sub(np.ndarray): pass

        # one dimensional
        x1d = np.array([1, 2]).view(sub)
        assert_equal(repr(x1d), 'sub([1, 2])')

        # two dimensional
        x2d = np.array([[1, 2], [3, 4]]).view(sub)
        assert_equal(repr(x2d),
            'sub([[1, 2],\n'
            '     [3, 4]])')

        # two dimensional with flexible dtype
        xstruct = np.ones((2,2), dtype=[('a', 'i4')]).view(sub)
        assert_equal(repr(xstruct),
            "sub([[(1,), (1,)],\n"
            "     [(1,), (1,)]],\n"
            "    dtype=[('a', '<i4')])"
        )

    def test_self_containing(self):
        arr0d = np.array(None)
        arr0d[()] = arr0d
        assert_equal(repr(arr0d),
            'array(array(..., dtype=object), dtype=object)')

        arr1d = np.array([None, None])
        arr1d[1] = arr1d
        assert_equal(repr(arr1d),
            'array([None, array(..., dtype=object)], dtype=object)')

        first = np.array(None)
        second = np.array(None)
        first[()] = second
        second[()] = first
        assert_equal(repr(first),
            'array(array(array(..., dtype=object), dtype=object), dtype=object)')

    def test_containing_list(self):
        # printing square brackets directly would be ambiguuous
        arr1d = np.array([None, None])
        arr1d[0] = [1, 2]
        arr1d[1] = [3]
        assert_equal(repr(arr1d),
            'array([list([1, 2]), list([3])], dtype=object)')


class TestComplexArray(TestCase):
    def test_str(self):
        rvals = [0, 1, -1, np.inf, -np.inf, np.nan]
        cvals = [complex(rp, ip) for rp in rvals for ip in rvals]
        dtypes = [np.complex64, np.cdouble, np.clongdouble]
        actual = [str(np.array([c], dt)) for c in cvals for dt in dtypes]
        wanted = [
            '[ 0.+0.j]',    '[ 0.+0.j]',    '[ 0.0+0.0j]',
            '[ 0.+1.j]',    '[ 0.+1.j]',    '[ 0.0+1.0j]',
            '[ 0.-1.j]',    '[ 0.-1.j]',    '[ 0.0-1.0j]',
            '[ 0.+infj]',   '[ 0.+infj]',   '[ 0.0+infj]',
            '[ 0.-infj]',   '[ 0.-infj]',   '[ 0.0-infj]',
            '[ 0.+nanj]',   '[ 0.+nanj]',   '[ 0.0+nanj]',
            '[ 1.+0.j]',    '[ 1.+0.j]',    '[ 1.0+0.0j]',
            '[ 1.+1.j]',    '[ 1.+1.j]',    '[ 1.0+1.0j]',
            '[ 1.-1.j]',    '[ 1.-1.j]',    '[ 1.0-1.0j]',
            '[ 1.+infj]',   '[ 1.+infj]',   '[ 1.0+infj]',
            '[ 1.-infj]',   '[ 1.-infj]',   '[ 1.0-infj]',
            '[ 1.+nanj]',   '[ 1.+nanj]',   '[ 1.0+nanj]',
            '[-1.+0.j]',    '[-1.+0.j]',    '[-1.0+0.0j]',
            '[-1.+1.j]',    '[-1.+1.j]',    '[-1.0+1.0j]',
            '[-1.-1.j]',    '[-1.-1.j]',    '[-1.0-1.0j]',
            '[-1.+infj]',   '[-1.+infj]',   '[-1.0+infj]',
            '[-1.-infj]',   '[-1.-infj]',   '[-1.0-infj]',
            '[-1.+nanj]',   '[-1.+nanj]',   '[-1.0+nanj]',
            '[ inf+0.j]',   '[ inf+0.j]',   '[ inf+0.0j]',
            '[ inf+1.j]',   '[ inf+1.j]',   '[ inf+1.0j]',
            '[ inf-1.j]',   '[ inf-1.j]',   '[ inf-1.0j]',
            '[ inf+infj]',  '[ inf+infj]',  '[ inf+infj]',
            '[ inf-infj]',  '[ inf-infj]',  '[ inf-infj]',
            '[ inf+nanj]',  '[ inf+nanj]',  '[ inf+nanj]',
            '[-inf+0.j]',   '[-inf+0.j]',   '[-inf+0.0j]',
            '[-inf+1.j]',   '[-inf+1.j]',   '[-inf+1.0j]',
            '[-inf-1.j]',   '[-inf-1.j]',   '[-inf-1.0j]',
            '[-inf+infj]',  '[-inf+infj]',  '[-inf+infj]',
            '[-inf-infj]',  '[-inf-infj]',  '[-inf-infj]',
            '[-inf+nanj]',  '[-inf+nanj]',  '[-inf+nanj]',
            '[ nan+0.j]',   '[ nan+0.j]',   '[ nan+0.0j]',
            '[ nan+1.j]',   '[ nan+1.j]',   '[ nan+1.0j]',
            '[ nan-1.j]',   '[ nan-1.j]',   '[ nan-1.0j]',
            '[ nan+infj]',  '[ nan+infj]',  '[ nan+infj]',
            '[ nan-infj]',  '[ nan-infj]',  '[ nan-infj]',
            '[ nan+nanj]',  '[ nan+nanj]',  '[ nan+nanj]']

        for res, val in zip(actual, wanted):
            assert_(res == val)

class TestArray2String(TestCase):
    def test_basic(self):
        """Basic test of array2string."""
        a = np.arange(3)
        assert_(np.array2string(a) == '[0 1 2]')
        assert_(np.array2string(a, max_line_width=4) == '[0 1\n 2]')

    def test_style_keyword(self):
        """This should only apply to 0-D arrays. See #1218."""
        stylestr = np.array2string(np.array(1.5),
                                   style=lambda x: "Value in 0-D array: " + str(x))
        assert_(stylestr == 'Value in 0-D array: 1.5')

    def test_format_function(self):
        """Test custom format function for each element in array."""
        def _format_function(x):
            if np.abs(x) < 1:
                return '.'
            elif np.abs(x) < 2:
                return 'o'
            else:
                return 'O'

        x = np.arange(3)
        if sys.version_info[0] >= 3:
            x_hex = "[0x0 0x1 0x2]"
            x_oct = "[0o0 0o1 0o2]"
        else:
            x_hex = "[0x0L 0x1L 0x2L]"
            x_oct = "[0L 01L 02L]"
        assert_(np.array2string(x, formatter={'all':_format_function}) ==
                "[. o O]")
        assert_(np.array2string(x, formatter={'int_kind':_format_function}) ==
                "[. o O]")
        assert_(np.array2string(x, formatter={'all':lambda x: "%.4f" % x}) ==
                "[0.0000 1.0000 2.0000]")
        assert_equal(np.array2string(x, formatter={'int':lambda x: hex(x)}),
                x_hex)
        assert_equal(np.array2string(x, formatter={'int':lambda x: oct(x)}),
                x_oct)

        x = np.arange(3.)
        assert_(np.array2string(x, formatter={'float_kind':lambda x: "%.2f" % x}) ==
                "[0.00 1.00 2.00]")
        assert_(np.array2string(x, formatter={'float':lambda x: "%.2f" % x}) ==
                "[0.00 1.00 2.00]")

        s = np.array(['abc', 'def'])
        assert_(np.array2string(s, formatter={'numpystr':lambda s: s*2}) ==
                '[abcabc defdef]')

    def test_structure_format(self):
        dt = np.dtype([('name', np.str_, 16), ('grades', np.float64, (2,))])
        x = np.array([('Sarah', (8.0, 7.0)), ('John', (6.0, 7.0))], dtype=dt)
        assert_equal(np.array2string(x),
                "[('Sarah', [ 8.,  7.]) ('John', [ 6.,  7.])]")

        # for issue #5692
        A = np.zeros(shape=10, dtype=[("A", "M8[s]")])
        A[5:].fill(np.datetime64('NaT'))
        assert_equal(np.array2string(A),
                "[('1970-01-01T00:00:00',) ('1970-01-01T00:00:00',) " +
                "('1970-01-01T00:00:00',)\n ('1970-01-01T00:00:00',) " +
                "('1970-01-01T00:00:00',) ('NaT',) ('NaT',)\n " +
                "('NaT',) ('NaT',) ('NaT',)]")

        # See #8160
        struct_int = np.array([([1, -1],), ([123, 1],)], dtype=[('B', 'i4', 2)])
        assert_equal(np.array2string(struct_int),
                "[([  1,  -1],) ([123,   1],)]")
        struct_2dint = np.array([([[0, 1], [2, 3]],), ([[12, 0], [0, 0]],)],
                dtype=[('B', 'i4', (2, 2))])
        assert_equal(np.array2string(struct_2dint),
                "[([[ 0,  1], [ 2,  3]],) ([[12,  0], [ 0,  0]],)]")

        # See #8172
        array_scalar = np.array(
                (1., 2.1234567890123456789, 3.), dtype=('f8,f8,f8'))
        assert_equal(np.array2string(array_scalar), "( 1.,  2.12345679,  3.)")


class TestPrintOptions:
    """Test getting and setting global print options."""

    def setUp(self):
        self.oldopts = np.get_printoptions()

    def tearDown(self):
        np.set_printoptions(**self.oldopts)

    def test_basic(self):
        x = np.array([1.5, 0, 1.234567890])
        assert_equal(repr(x), "array([ 1.5       ,  0.        ,  1.23456789])")
        np.set_printoptions(precision=4)
        assert_equal(repr(x), "array([ 1.5   ,  0.    ,  1.2346])")

    def test_precision_zero(self):
        np.set_printoptions(precision=0)
        for values, string in (
                ([0.], " 0."), ([.3], " 0."), ([-.3], "-0."), ([.7], " 1."),
                ([1.5], " 2."), ([-1.5], "-2."), ([-15.34], "-15."),
                ([100.], " 100."), ([.2, -1, 122.51], "   0.,   -1.,  123."),
                ([0], "0"), ([-12], "-12"), ([complex(.3, -.7)], " 0.-1.j")):
            x = np.array(values)
            assert_equal(repr(x), "array([%s])" % string)

    def test_formatter(self):
        x = np.arange(3)
        np.set_printoptions(formatter={'all':lambda x: str(x-1)})
        assert_equal(repr(x), "array([-1, 0, 1])")

    def test_formatter_reset(self):
        x = np.arange(3)
        np.set_printoptions(formatter={'all':lambda x: str(x-1)})
        assert_equal(repr(x), "array([-1, 0, 1])")
        np.set_printoptions(formatter={'int':None})
        assert_equal(repr(x), "array([0, 1, 2])")

        np.set_printoptions(formatter={'all':lambda x: str(x-1)})
        assert_equal(repr(x), "array([-1, 0, 1])")
        np.set_printoptions(formatter={'all':None})
        assert_equal(repr(x), "array([0, 1, 2])")

        np.set_printoptions(formatter={'int':lambda x: str(x-1)})
        assert_equal(repr(x), "array([-1, 0, 1])")
        np.set_printoptions(formatter={'int_kind':None})
        assert_equal(repr(x), "array([0, 1, 2])")

        x = np.arange(3.)
        np.set_printoptions(formatter={'float':lambda x: str(x-1)})
        assert_equal(repr(x), "array([-1.0, 0.0, 1.0])")
        np.set_printoptions(formatter={'float_kind':None})
        assert_equal(repr(x), "array([ 0.,  1.,  2.])")

def test_unicode_object_array():
    import sys
    if sys.version_info[0] >= 3:
        expected = "array(['é'], dtype=object)"
    else:
        expected = "array([u'\\xe9'], dtype=object)"
    x = np.array([u'\xe9'], dtype=object)
    assert_equal(repr(x), expected)


if __name__ == "__main__":
    run_module_suite()
