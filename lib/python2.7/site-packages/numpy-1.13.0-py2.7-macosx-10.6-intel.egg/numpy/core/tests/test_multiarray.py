from __future__ import division, absolute_import, print_function

import collections
import tempfile
import sys
import shutil
import warnings
import operator
import io
import itertools
import functools
import ctypes
import os
import gc
from contextlib import contextmanager
if sys.version_info[0] >= 3:
    import builtins
else:
    import __builtin__ as builtins
from decimal import Decimal


import numpy as np
from numpy.compat import strchar, unicode
from test_print import in_foreign_locale
from numpy.core.multiarray_tests import (
    test_neighborhood_iterator, test_neighborhood_iterator_oob,
    test_pydatamem_seteventhook_start, test_pydatamem_seteventhook_end,
    test_inplace_increment, get_buffer_info, test_as_c_array,
    )
from numpy.testing import (
    TestCase, run_module_suite, assert_, assert_raises, assert_warns,
    assert_equal, assert_almost_equal, assert_array_equal,
    assert_array_almost_equal, assert_allclose, IS_PYPY, HAS_REFCOUNT,
    assert_array_less, runstring, dec, SkipTest, temppath, suppress_warnings
    )

# Need to test an object that does not fully implement math interface
from datetime import timedelta


if sys.version_info[:2] > (3, 2):
    # In Python 3.3 the representation of empty shape, strides and sub-offsets
    # is an empty tuple instead of None.
    # http://docs.python.org/dev/whatsnew/3.3.html#api-changes
    EMPTY = ()
else:
    EMPTY = None


def _aligned_zeros(shape, dtype=float, order="C", align=None):
    """Allocate a new ndarray with aligned memory."""
    dtype = np.dtype(dtype)
    if dtype == np.dtype(object):
        # Can't do this, fall back to standard allocation (which
        # should always be sufficiently aligned)
        if align is not None:
            raise ValueError("object array alignment not supported")
        return np.zeros(shape, dtype=dtype, order=order)
    if align is None:
        align = dtype.alignment
    if not hasattr(shape, '__len__'):
        shape = (shape,)
    size = functools.reduce(operator.mul, shape) * dtype.itemsize
    buf = np.empty(size + align + 1, np.uint8)
    offset = buf.__array_interface__['data'][0] % align
    if offset != 0:
        offset = align - offset
    # Note: slices producing 0-size arrays do not necessarily change
    # data pointer --- so we use and allocate size+1
    buf = buf[offset:offset+size+1][:-1]
    data = np.ndarray(shape, dtype, buf, order=order)
    data.fill(0)
    return data


class TestFlags(TestCase):
    def setUp(self):
        self.a = np.arange(10)

    def test_writeable(self):
        mydict = locals()
        self.a.flags.writeable = False
        self.assertRaises(ValueError, runstring, 'self.a[0] = 3', mydict)
        self.assertRaises(ValueError, runstring, 'self.a[0:1].itemset(3)', mydict)
        self.a.flags.writeable = True
        self.a[0] = 5
        self.a[0] = 0

    def test_otherflags(self):
        assert_equal(self.a.flags.carray, True)
        assert_equal(self.a.flags.farray, False)
        assert_equal(self.a.flags.behaved, True)
        assert_equal(self.a.flags.fnc, False)
        assert_equal(self.a.flags.forc, True)
        assert_equal(self.a.flags.owndata, True)
        assert_equal(self.a.flags.writeable, True)
        assert_equal(self.a.flags.aligned, True)
        assert_equal(self.a.flags.updateifcopy, False)

    def test_string_align(self):
        a = np.zeros(4, dtype=np.dtype('|S4'))
        assert_(a.flags.aligned)
        # not power of two are accessed byte-wise and thus considered aligned
        a = np.zeros(5, dtype=np.dtype('|S4'))
        assert_(a.flags.aligned)

    def test_void_align(self):
        a = np.zeros(4, dtype=np.dtype([("a", "i4"), ("b", "i4")]))
        assert_(a.flags.aligned)


class TestHash(TestCase):
    # see #3793
    def test_int(self):
        for st, ut, s in [(np.int8, np.uint8, 8),
                          (np.int16, np.uint16, 16),
                          (np.int32, np.uint32, 32),
                          (np.int64, np.uint64, 64)]:
            for i in range(1, s):
                assert_equal(hash(st(-2**i)), hash(-2**i),
                             err_msg="%r: -2**%d" % (st, i))
                assert_equal(hash(st(2**(i - 1))), hash(2**(i - 1)),
                             err_msg="%r: 2**%d" % (st, i - 1))
                assert_equal(hash(st(2**i - 1)), hash(2**i - 1),
                             err_msg="%r: 2**%d - 1" % (st, i))

                i = max(i - 1, 1)
                assert_equal(hash(ut(2**(i - 1))), hash(2**(i - 1)),
                             err_msg="%r: 2**%d" % (ut, i - 1))
                assert_equal(hash(ut(2**i - 1)), hash(2**i - 1),
                             err_msg="%r: 2**%d - 1" % (ut, i))


class TestAttributes(TestCase):
    def setUp(self):
        self.one = np.arange(10)
        self.two = np.arange(20).reshape(4, 5)
        self.three = np.arange(60, dtype=np.float64).reshape(2, 5, 6)

    def test_attributes(self):
        assert_equal(self.one.shape, (10,))
        assert_equal(self.two.shape, (4, 5))
        assert_equal(self.three.shape, (2, 5, 6))
        self.three.shape = (10, 3, 2)
        assert_equal(self.three.shape, (10, 3, 2))
        self.three.shape = (2, 5, 6)
        assert_equal(self.one.strides, (self.one.itemsize,))
        num = self.two.itemsize
        assert_equal(self.two.strides, (5*num, num))
        num = self.three.itemsize
        assert_equal(self.three.strides, (30*num, 6*num, num))
        assert_equal(self.one.ndim, 1)
        assert_equal(self.two.ndim, 2)
        assert_equal(self.three.ndim, 3)
        num = self.two.itemsize
        assert_equal(self.two.size, 20)
        assert_equal(self.two.nbytes, 20*num)
        assert_equal(self.two.itemsize, self.two.dtype.itemsize)
        assert_equal(self.two.base, np.arange(20))

    def test_dtypeattr(self):
        assert_equal(self.one.dtype, np.dtype(np.int_))
        assert_equal(self.three.dtype, np.dtype(np.float_))
        assert_equal(self.one.dtype.char, 'l')
        assert_equal(self.three.dtype.char, 'd')
        self.assertTrue(self.three.dtype.str[0] in '<>')
        assert_equal(self.one.dtype.str[1], 'i')
        assert_equal(self.three.dtype.str[1], 'f')

    def test_int_subclassing(self):
        # Regression test for https://github.com/numpy/numpy/pull/3526

        numpy_int = np.int_(0)

        if sys.version_info[0] >= 3:
            # On Py3k int_ should not inherit from int, because it's not
            # fixed-width anymore
            assert_equal(isinstance(numpy_int, int), False)
        else:
            # Otherwise, it should inherit from int...
            assert_equal(isinstance(numpy_int, int), True)

            # ... and fast-path checks on C-API level should also work
            from numpy.core.multiarray_tests import test_int_subclass
            assert_equal(test_int_subclass(numpy_int), True)

    def test_stridesattr(self):
        x = self.one

        def make_array(size, offset, strides):
            return np.ndarray(size, buffer=x, dtype=int,
                              offset=offset*x.itemsize,
                              strides=strides*x.itemsize)

        assert_equal(make_array(4, 4, -1), np.array([4, 3, 2, 1]))
        self.assertRaises(ValueError, make_array, 4, 4, -2)
        self.assertRaises(ValueError, make_array, 4, 2, -1)
        self.assertRaises(ValueError, make_array, 8, 3, 1)
        assert_equal(make_array(8, 3, 0), np.array([3]*8))
        # Check behavior reported in gh-2503:
        self.assertRaises(ValueError, make_array, (2, 3), 5, np.array([-2, -3]))
        make_array(0, 0, 10)

    def test_set_stridesattr(self):
        x = self.one

        def make_array(size, offset, strides):
            try:
                r = np.ndarray([size], dtype=int, buffer=x,
                               offset=offset*x.itemsize)
            except Exception as e:
                raise RuntimeError(e)
            r.strides = strides = strides*x.itemsize
            return r

        assert_equal(make_array(4, 4, -1), np.array([4, 3, 2, 1]))
        assert_equal(make_array(7, 3, 1), np.array([3, 4, 5, 6, 7, 8, 9]))
        self.assertRaises(ValueError, make_array, 4, 4, -2)
        self.assertRaises(ValueError, make_array, 4, 2, -1)
        self.assertRaises(RuntimeError, make_array, 8, 3, 1)
        # Check that the true extent of the array is used.
        # Test relies on as_strided base not exposing a buffer.
        x = np.lib.stride_tricks.as_strided(np.arange(1), (10, 10), (0, 0))

        def set_strides(arr, strides):
            arr.strides = strides

        self.assertRaises(ValueError, set_strides, x, (10*x.itemsize, x.itemsize))

        # Test for offset calculations:
        x = np.lib.stride_tricks.as_strided(np.arange(10, dtype=np.int8)[-1],
                                                    shape=(10,), strides=(-1,))
        self.assertRaises(ValueError, set_strides, x[::-1], -1)
        a = x[::-1]
        a.strides = 1
        a[::2].strides = 2

    def test_fill(self):
        for t in "?bhilqpBHILQPfdgFDGO":
            x = np.empty((3, 2, 1), t)
            y = np.empty((3, 2, 1), t)
            x.fill(1)
            y[...] = 1
            assert_equal(x, y)

    def test_fill_max_uint64(self):
        x = np.empty((3, 2, 1), dtype=np.uint64)
        y = np.empty((3, 2, 1), dtype=np.uint64)
        value = 2**64 - 1
        y[...] = value
        x.fill(value)
        assert_array_equal(x, y)

    def test_fill_struct_array(self):
        # Filling from a scalar
        x = np.array([(0, 0.0), (1, 1.0)], dtype='i4,f8')
        x.fill(x[0])
        assert_equal(x['f1'][1], x['f1'][0])
        # Filling from a tuple that can be converted
        # to a scalar
        x = np.zeros(2, dtype=[('a', 'f8'), ('b', 'i4')])
        x.fill((3.5, -2))
        assert_array_equal(x['a'], [3.5, 3.5])
        assert_array_equal(x['b'], [-2, -2])


class TestArrayConstruction(TestCase):
    def test_array(self):
        d = np.ones(6)
        r = np.array([d, d])
        assert_equal(r, np.ones((2, 6)))

        d = np.ones(6)
        tgt = np.ones((2, 6))
        r = np.array([d, d])
        assert_equal(r, tgt)
        tgt[1] = 2
        r = np.array([d, d + 1])
        assert_equal(r, tgt)

        d = np.ones(6)
        r = np.array([[d, d]])
        assert_equal(r, np.ones((1, 2, 6)))

        d = np.ones(6)
        r = np.array([[d, d], [d, d]])
        assert_equal(r, np.ones((2, 2, 6)))

        d = np.ones((6, 6))
        r = np.array([d, d])
        assert_equal(r, np.ones((2, 6, 6)))

        d = np.ones((6, ))
        r = np.array([[d, d + 1], d + 2])
        assert_equal(len(r), 2)
        assert_equal(r[0], [d, d + 1])
        assert_equal(r[1], d + 2)

        tgt = np.ones((2, 3), dtype=np.bool)
        tgt[0, 2] = False
        tgt[1, 0:2] = False
        r = np.array([[True, True, False], [False, False, True]])
        assert_equal(r, tgt)
        r = np.array([[True, False], [True, False], [False, True]])
        assert_equal(r, tgt.T)

    def test_array_empty(self):
        assert_raises(TypeError, np.array)

    def test_array_copy_false(self):
        d = np.array([1, 2, 3])
        e = np.array(d, copy=False)
        d[1] = 3
        assert_array_equal(e, [1, 3, 3])
        e = np.array(d, copy=False, order='F')
        d[1] = 4
        assert_array_equal(e, [1, 4, 3])
        e[2] = 7
        assert_array_equal(d, [1, 4, 7])

    def test_array_copy_true(self):
        d = np.array([[1,2,3], [1, 2, 3]])
        e = np.array(d, copy=True)
        d[0, 1] = 3
        e[0, 2] = -7
        assert_array_equal(e, [[1, 2, -7], [1, 2, 3]])
        assert_array_equal(d, [[1, 3, 3], [1, 2, 3]])
        e = np.array(d, copy=True, order='F')
        d[0, 1] = 5
        e[0, 2] = 7
        assert_array_equal(e, [[1, 3, 7], [1, 2, 3]])
        assert_array_equal(d, [[1, 5, 3], [1,2,3]])

    def test_array_cont(self):
        d = np.ones(10)[::2]
        assert_(np.ascontiguousarray(d).flags.c_contiguous)
        assert_(np.ascontiguousarray(d).flags.f_contiguous)
        assert_(np.asfortranarray(d).flags.c_contiguous)
        assert_(np.asfortranarray(d).flags.f_contiguous)
        d = np.ones((10, 10))[::2,::2]
        assert_(np.ascontiguousarray(d).flags.c_contiguous)
        assert_(np.asfortranarray(d).flags.f_contiguous)


class TestAssignment(TestCase):
    def test_assignment_broadcasting(self):
        a = np.arange(6).reshape(2, 3)

        # Broadcasting the input to the output
        a[...] = np.arange(3)
        assert_equal(a, [[0, 1, 2], [0, 1, 2]])
        a[...] = np.arange(2).reshape(2, 1)
        assert_equal(a, [[0, 0, 0], [1, 1, 1]])

        # For compatibility with <= 1.5, a limited version of broadcasting
        # the output to the input.
        #
        # This behavior is inconsistent with NumPy broadcasting
        # in general, because it only uses one of the two broadcasting
        # rules (adding a new "1" dimension to the left of the shape),
        # applied to the output instead of an input. In NumPy 2.0, this kind
        # of broadcasting assignment will likely be disallowed.
        a[...] = np.arange(6)[::-1].reshape(1, 2, 3)
        assert_equal(a, [[5, 4, 3], [2, 1, 0]])
        # The other type of broadcasting would require a reduction operation.

        def assign(a, b):
            a[...] = b

        assert_raises(ValueError, assign, a, np.arange(12).reshape(2, 2, 3))

    def test_assignment_errors(self):
        # Address issue #2276
        class C:
            pass
        a = np.zeros(1)

        def assign(v):
            a[0] = v

        assert_raises((AttributeError, TypeError), assign, C())
        assert_raises(ValueError, assign, [1])

    def test_unicode_assignment(self):
        # gh-5049
        from numpy.core.numeric import set_string_function

        @contextmanager
        def inject_str(s):
            """ replace ndarray.__str__ temporarily """
            set_string_function(lambda x: s, repr=False)
            try:
                yield
            finally:
                set_string_function(None, repr=False)

        a1d = np.array([u'test'])
        a0d = np.array(u'done')
        with inject_str(u'bad'):
            a1d[0] = a0d  # previously this would invoke __str__
        assert_equal(a1d[0], u'done')

        # this would crash for the same reason
        np.array([np.array(u'\xe5\xe4\xf6')])

    def test_stringlike_empty_list(self):
        # gh-8902
        u = np.array([u'done'])
        b = np.array([b'done'])

        class bad_sequence(object):
            def __getitem__(self): pass
            def __len__(self): raise RuntimeError

        assert_raises(ValueError, operator.setitem, u, 0, [])
        assert_raises(ValueError, operator.setitem, b, 0, [])

        assert_raises(ValueError, operator.setitem, u, 0, bad_sequence())
        assert_raises(ValueError, operator.setitem, b, 0, bad_sequence())

    def test_longdouble_assignment(self):
        # only relevant if longdouble is larger than float
        # we're looking for loss of precision

        # gh-8902
        tinyb = np.nextafter(np.longdouble(0), 1)
        tinya =  np.nextafter(np.longdouble(0), -1)
        tiny1d = np.array([tinya])
        assert_equal(tiny1d[0], tinya)

        # scalar = scalar
        tiny1d[0] = tinyb
        assert_equal(tiny1d[0], tinyb)

        # 0d = scalar
        tiny1d[0, ...] = tinya
        assert_equal(tiny1d[0], tinya)

        # 0d = 0d
        tiny1d[0, ...] = tinyb[...]
        assert_equal(tiny1d[0], tinyb)

        # scalar = 0d
        tiny1d[0] = tinyb[...]
        assert_equal(tiny1d[0], tinyb)

        arr = np.array([np.array(tinya)])
        assert_equal(arr[0], tinya)


class TestDtypedescr(TestCase):
    def test_construction(self):
        d1 = np.dtype('i4')
        assert_equal(d1, np.dtype(np.int32))
        d2 = np.dtype('f8')
        assert_equal(d2, np.dtype(np.float64))

    def test_byteorders(self):
        self.assertNotEqual(np.dtype('<i4'), np.dtype('>i4'))
        self.assertNotEqual(np.dtype([('a', '<i4')]), np.dtype([('a', '>i4')]))


class TestZeroRank(TestCase):
    def setUp(self):
        self.d = np.array(0), np.array('x', object)

    def test_ellipsis_subscript(self):
        a, b = self.d
        self.assertEqual(a[...], 0)
        self.assertEqual(b[...], 'x')
        self.assertTrue(a[...].base is a)  # `a[...] is a` in numpy <1.9.
        self.assertTrue(b[...].base is b)  # `b[...] is b` in numpy <1.9.

    def test_empty_subscript(self):
        a, b = self.d
        self.assertEqual(a[()], 0)
        self.assertEqual(b[()], 'x')
        self.assertTrue(type(a[()]) is a.dtype.type)
        self.assertTrue(type(b[()]) is str)

    def test_invalid_subscript(self):
        a, b = self.d
        self.assertRaises(IndexError, lambda x: x[0], a)
        self.assertRaises(IndexError, lambda x: x[0], b)
        self.assertRaises(IndexError, lambda x: x[np.array([], int)], a)
        self.assertRaises(IndexError, lambda x: x[np.array([], int)], b)

    def test_ellipsis_subscript_assignment(self):
        a, b = self.d
        a[...] = 42
        self.assertEqual(a, 42)
        b[...] = ''
        self.assertEqual(b.item(), '')

    def test_empty_subscript_assignment(self):
        a, b = self.d
        a[()] = 42
        self.assertEqual(a, 42)
        b[()] = ''
        self.assertEqual(b.item(), '')

    def test_invalid_subscript_assignment(self):
        a, b = self.d

        def assign(x, i, v):
            x[i] = v

        self.assertRaises(IndexError, assign, a, 0, 42)
        self.assertRaises(IndexError, assign, b, 0, '')
        self.assertRaises(ValueError, assign, a, (), '')

    def test_newaxis(self):
        a, b = self.d
        self.assertEqual(a[np.newaxis].shape, (1,))
        self.assertEqual(a[..., np.newaxis].shape, (1,))
        self.assertEqual(a[np.newaxis, ...].shape, (1,))
        self.assertEqual(a[..., np.newaxis].shape, (1,))
        self.assertEqual(a[np.newaxis, ..., np.newaxis].shape, (1, 1))
        self.assertEqual(a[..., np.newaxis, np.newaxis].shape, (1, 1))
        self.assertEqual(a[np.newaxis, np.newaxis, ...].shape, (1, 1))
        self.assertEqual(a[(np.newaxis,)*10].shape, (1,)*10)

    def test_invalid_newaxis(self):
        a, b = self.d

        def subscript(x, i):
            x[i]

        self.assertRaises(IndexError, subscript, a, (np.newaxis, 0))
        self.assertRaises(IndexError, subscript, a, (np.newaxis,)*50)

    def test_constructor(self):
        x = np.ndarray(())
        x[()] = 5
        self.assertEqual(x[()], 5)
        y = np.ndarray((), buffer=x)
        y[()] = 6
        self.assertEqual(x[()], 6)

    def test_output(self):
        x = np.array(2)
        self.assertRaises(ValueError, np.add, x, [1], x)


class TestScalarIndexing(TestCase):
    def setUp(self):
        self.d = np.array([0, 1])[0]

    def test_ellipsis_subscript(self):
        a = self.d
        self.assertEqual(a[...], 0)
        self.assertEqual(a[...].shape, ())

    def test_empty_subscript(self):
        a = self.d
        self.assertEqual(a[()], 0)
        self.assertEqual(a[()].shape, ())

    def test_invalid_subscript(self):
        a = self.d
        self.assertRaises(IndexError, lambda x: x[0], a)
        self.assertRaises(IndexError, lambda x: x[np.array([], int)], a)

    def test_invalid_subscript_assignment(self):
        a = self.d

        def assign(x, i, v):
            x[i] = v

        self.assertRaises(TypeError, assign, a, 0, 42)

    def test_newaxis(self):
        a = self.d
        self.assertEqual(a[np.newaxis].shape, (1,))
        self.assertEqual(a[..., np.newaxis].shape, (1,))
        self.assertEqual(a[np.newaxis, ...].shape, (1,))
        self.assertEqual(a[..., np.newaxis].shape, (1,))
        self.assertEqual(a[np.newaxis, ..., np.newaxis].shape, (1, 1))
        self.assertEqual(a[..., np.newaxis, np.newaxis].shape, (1, 1))
        self.assertEqual(a[np.newaxis, np.newaxis, ...].shape, (1, 1))
        self.assertEqual(a[(np.newaxis,)*10].shape, (1,)*10)

    def test_invalid_newaxis(self):
        a = self.d

        def subscript(x, i):
            x[i]

        self.assertRaises(IndexError, subscript, a, (np.newaxis, 0))
        self.assertRaises(IndexError, subscript, a, (np.newaxis,)*50)

    def test_overlapping_assignment(self):
        # With positive strides
        a = np.arange(4)
        a[:-1] = a[1:]
        assert_equal(a, [1, 2, 3, 3])

        a = np.arange(4)
        a[1:] = a[:-1]
        assert_equal(a, [0, 0, 1, 2])

        # With positive and negative strides
        a = np.arange(4)
        a[:] = a[::-1]
        assert_equal(a, [3, 2, 1, 0])

        a = np.arange(6).reshape(2, 3)
        a[::-1,:] = a[:, ::-1]
        assert_equal(a, [[5, 4, 3], [2, 1, 0]])

        a = np.arange(6).reshape(2, 3)
        a[::-1, ::-1] = a[:, ::-1]
        assert_equal(a, [[3, 4, 5], [0, 1, 2]])

        # With just one element overlapping
        a = np.arange(5)
        a[:3] = a[2:]
        assert_equal(a, [2, 3, 4, 3, 4])

        a = np.arange(5)
        a[2:] = a[:3]
        assert_equal(a, [0, 1, 0, 1, 2])

        a = np.arange(5)
        a[2::-1] = a[2:]
        assert_equal(a, [4, 3, 2, 3, 4])

        a = np.arange(5)
        a[2:] = a[2::-1]
        assert_equal(a, [0, 1, 2, 1, 0])

        a = np.arange(5)
        a[2::-1] = a[:1:-1]
        assert_equal(a, [2, 3, 4, 3, 4])

        a = np.arange(5)
        a[:1:-1] = a[2::-1]
        assert_equal(a, [0, 1, 0, 1, 2])


class TestCreation(TestCase):
    def test_from_attribute(self):
        class x(object):
            def __array__(self, dtype=None):
                pass

        self.assertRaises(ValueError, np.array, x())

    def test_from_string(self):
        types = np.typecodes['AllInteger'] + np.typecodes['Float']
        nstr = ['123', '123']
        result = np.array([123, 123], dtype=int)
        for type in types:
            msg = 'String conversion for %s' % type
            assert_equal(np.array(nstr, dtype=type), result, err_msg=msg)

    def test_void(self):
        arr = np.array([], dtype='V')
        assert_equal(arr.dtype.kind, 'V')

    def test_too_big_error(self):
        # 45341 is the smallest integer greater than sqrt(2**31 - 1).
        # 3037000500 is the smallest integer greater than sqrt(2**63 - 1).
        # We want to make sure that the square byte array with those dimensions
        # is too big on 32 or 64 bit systems respectively.
        if np.iinfo('intp').max == 2**31 - 1:
            shape = (46341, 46341)
        elif np.iinfo('intp').max == 2**63 - 1:
            shape = (3037000500, 3037000500)
        else:
            return
        assert_raises(ValueError, np.empty, shape, dtype=np.int8)
        assert_raises(ValueError, np.zeros, shape, dtype=np.int8)
        assert_raises(ValueError, np.ones, shape, dtype=np.int8)

    def test_zeros(self):
        types = np.typecodes['AllInteger'] + np.typecodes['AllFloat']
        for dt in types:
            d = np.zeros((13,), dtype=dt)
            assert_equal(np.count_nonzero(d), 0)
            # true for ieee floats
            assert_equal(d.sum(), 0)
            assert_(not d.any())

            d = np.zeros(2, dtype='(2,4)i4')
            assert_equal(np.count_nonzero(d), 0)
            assert_equal(d.sum(), 0)
            assert_(not d.any())

            d = np.zeros(2, dtype='4i4')
            assert_equal(np.count_nonzero(d), 0)
            assert_equal(d.sum(), 0)
            assert_(not d.any())

            d = np.zeros(2, dtype='(2,4)i4, (2,4)i4')
            assert_equal(np.count_nonzero(d), 0)

    @dec.slow
    def test_zeros_big(self):
        # test big array as they might be allocated different by the system
        types = np.typecodes['AllInteger'] + np.typecodes['AllFloat']
        for dt in types:
            d = np.zeros((30 * 1024**2,), dtype=dt)
            assert_(not d.any())
            # This test can fail on 32-bit systems due to insufficient
            # contiguous memory. Deallocating the previous array increases the
            # chance of success.
            del(d)

    def test_zeros_obj(self):
        # test initialization from PyLong(0)
        d = np.zeros((13,), dtype=object)
        assert_array_equal(d, [0] * 13)
        assert_equal(np.count_nonzero(d), 0)

    def test_zeros_obj_obj(self):
        d = np.zeros(10, dtype=[('k', object, 2)])
        assert_array_equal(d['k'], 0)

    def test_zeros_like_like_zeros(self):
        # test zeros_like returns the same as zeros
        for c in np.typecodes['All']:
            if c == 'V':
                continue
            d = np.zeros((3,3), dtype=c)
            assert_array_equal(np.zeros_like(d), d)
            assert_equal(np.zeros_like(d).dtype, d.dtype)
        # explicitly check some special cases
        d = np.zeros((3,3), dtype='S5')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)
        d = np.zeros((3,3), dtype='U5')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)

        d = np.zeros((3,3), dtype='<i4')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)
        d = np.zeros((3,3), dtype='>i4')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)

        d = np.zeros((3,3), dtype='<M8[s]')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)
        d = np.zeros((3,3), dtype='>M8[s]')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)

        d = np.zeros((3,3), dtype='f4,f4')
        assert_array_equal(np.zeros_like(d), d)
        assert_equal(np.zeros_like(d).dtype, d.dtype)

    def test_empty_unicode(self):
        # don't throw decode errors on garbage memory
        for i in range(5, 100, 5):
            d = np.empty(i, dtype='U')
            str(d)

    def test_sequence_non_homogenous(self):
        assert_equal(np.array([4, 2**80]).dtype, np.object)
        assert_equal(np.array([4, 2**80, 4]).dtype, np.object)
        assert_equal(np.array([2**80, 4]).dtype, np.object)
        assert_equal(np.array([2**80] * 3).dtype, np.object)
        assert_equal(np.array([[1, 1],[1j, 1j]]).dtype, np.complex)
        assert_equal(np.array([[1j, 1j],[1, 1]]).dtype, np.complex)
        assert_equal(np.array([[1, 1, 1],[1, 1j, 1.], [1, 1, 1]]).dtype, np.complex)

    @dec.skipif(sys.version_info[0] >= 3)
    def test_sequence_long(self):
        assert_equal(np.array([long(4), long(4)]).dtype, np.long)
        assert_equal(np.array([long(4), 2**80]).dtype, np.object)
        assert_equal(np.array([long(4), 2**80, long(4)]).dtype, np.object)
        assert_equal(np.array([2**80, long(4)]).dtype, np.object)

    def test_non_sequence_sequence(self):
        """Should not segfault.

        Class Fail breaks the sequence protocol for new style classes, i.e.,
        those derived from object. Class Map is a mapping type indicated by
        raising a ValueError. At some point we may raise a warning instead
        of an error in the Fail case.

        """
        class Fail(object):
            def __len__(self):
                return 1

            def __getitem__(self, index):
                raise ValueError()

        class Map(object):
            def __len__(self):
                return 1

            def __getitem__(self, index):
                raise KeyError()

        a = np.array([Map()])
        assert_(a.shape == (1,))
        assert_(a.dtype == np.dtype(object))
        assert_raises(ValueError, np.array, [Fail()])

    def test_no_len_object_type(self):
        # gh-5100, want object array from iterable object without len()
        class Point2:
            def __init__(self):
                pass

            def __getitem__(self, ind):
                if ind in [0, 1]:
                    return ind
                else:
                    raise IndexError()
        d = np.array([Point2(), Point2(), Point2()])
        assert_equal(d.dtype, np.dtype(object))

    def test_false_len_sequence(self):
        # gh-7264, segfault for this example
        class C:
            def __getitem__(self, i):
                raise IndexError
            def __len__(self):
                return 42

        assert_raises(ValueError, np.array, C()) # segfault?

    def test_failed_len_sequence(self):
        # gh-7393
        class A(object):
            def __init__(self, data):
                self._data = data
            def __getitem__(self, item):
                return type(self)(self._data[item])
            def __len__(self):
                return len(self._data)

        # len(d) should give 3, but len(d[0]) will fail
        d = A([1,2,3])
        assert_equal(len(np.array(d)), 3)

    def test_array_too_big(self):
        # Test that array creation succeeds for arrays addressable by intp
        # on the byte level and fails for too large arrays.
        buf = np.zeros(100)

        max_bytes = np.iinfo(np.intp).max
        for dtype in ["intp", "S20", "b"]:
            dtype = np.dtype(dtype)
            itemsize = dtype.itemsize

            np.ndarray(buffer=buf, strides=(0,),
                       shape=(max_bytes//itemsize,), dtype=dtype)
            assert_raises(ValueError, np.ndarray, buffer=buf, strides=(0,),
                          shape=(max_bytes//itemsize + 1,), dtype=dtype)


class TestStructured(TestCase):
    def test_subarray_field_access(self):
        a = np.zeros((3, 5), dtype=[('a', ('i4', (2, 2)))])
        a['a'] = np.arange(60).reshape(3, 5, 2, 2)

        # Since the subarray is always in C-order, a transpose
        # does not swap the subarray:
        assert_array_equal(a.T['a'], a['a'].transpose(1, 0, 2, 3))

        # In Fortran order, the subarray gets appended
        # like in all other cases, not prepended as a special case
        b = a.copy(order='F')
        assert_equal(a['a'].shape, b['a'].shape)
        assert_equal(a.T['a'].shape, a.T.copy()['a'].shape)

    def test_subarray_comparison(self):
        # Check that comparisons between record arrays with
        # multi-dimensional field types work properly
        a = np.rec.fromrecords(
            [([1, 2, 3], 'a', [[1, 2], [3, 4]]), ([3, 3, 3], 'b', [[0, 0], [0, 0]])],
            dtype=[('a', ('f4', 3)), ('b', np.object), ('c', ('i4', (2, 2)))])
        b = a.copy()
        assert_equal(a == b, [True, True])
        assert_equal(a != b, [False, False])
        b[1].b = 'c'
        assert_equal(a == b, [True, False])
        assert_equal(a != b, [False, True])
        for i in range(3):
            b[0].a = a[0].a
            b[0].a[i] = 5
            assert_equal(a == b, [False, False])
            assert_equal(a != b, [True, True])
        for i in range(2):
            for j in range(2):
                b = a.copy()
                b[0].c[i, j] = 10
                assert_equal(a == b, [False, True])
                assert_equal(a != b, [True, False])

        # Check that broadcasting with a subarray works
        a = np.array([[(0,)], [(1,)]], dtype=[('a', 'f8')])
        b = np.array([(0,), (0,), (1,)], dtype=[('a', 'f8')])
        assert_equal(a == b, [[True, True, False], [False, False, True]])
        assert_equal(b == a, [[True, True, False], [False, False, True]])
        a = np.array([[(0,)], [(1,)]], dtype=[('a', 'f8', (1,))])
        b = np.array([(0,), (0,), (1,)], dtype=[('a', 'f8', (1,))])
        assert_equal(a == b, [[True, True, False], [False, False, True]])
        assert_equal(b == a, [[True, True, False], [False, False, True]])
        a = np.array([[([0, 0],)], [([1, 1],)]], dtype=[('a', 'f8', (2,))])
        b = np.array([([0, 0],), ([0, 1],), ([1, 1],)], dtype=[('a', 'f8', (2,))])
        assert_equal(a == b, [[True, False, False], [False, False, True]])
        assert_equal(b == a, [[True, False, False], [False, False, True]])

        # Check that broadcasting Fortran-style arrays with a subarray work
        a = np.array([[([0, 0],)], [([1, 1],)]], dtype=[('a', 'f8', (2,))], order='F')
        b = np.array([([0, 0],), ([0, 1],), ([1, 1],)], dtype=[('a', 'f8', (2,))])
        assert_equal(a == b, [[True, False, False], [False, False, True]])
        assert_equal(b == a, [[True, False, False], [False, False, True]])

        # Check that incompatible sub-array shapes don't result to broadcasting
        x = np.zeros((1,), dtype=[('a', ('f4', (1, 2))), ('b', 'i1')])
        y = np.zeros((1,), dtype=[('a', ('f4', (2,))), ('b', 'i1')])
        # This comparison invokes deprecated behaviour, and will probably
        # start raising an error eventually. What we really care about in this
        # test is just that it doesn't return True.
        with suppress_warnings() as sup:
            sup.filter(FutureWarning, "elementwise == comparison failed")
            assert_equal(x == y, False)

        x = np.zeros((1,), dtype=[('a', ('f4', (2, 1))), ('b', 'i1')])
        y = np.zeros((1,), dtype=[('a', ('f4', (2,))), ('b', 'i1')])
        # This comparison invokes deprecated behaviour, and will probably
        # start raising an error eventually. What we really care about in this
        # test is just that it doesn't return True.
        with suppress_warnings() as sup:
            sup.filter(FutureWarning, "elementwise == comparison failed")
            assert_equal(x == y, False)

        # Check that structured arrays that are different only in
        # byte-order work
        a = np.array([(5, 42), (10, 1)], dtype=[('a', '>i8'), ('b', '<f8')])
        b = np.array([(5, 43), (10, 1)], dtype=[('a', '<i8'), ('b', '>f8')])
        assert_equal(a == b, [False, True])

    def test_casting(self):
        # Check that casting a structured array to change its byte order
        # works
        a = np.array([(1,)], dtype=[('a', '<i4')])
        assert_(np.can_cast(a.dtype, [('a', '>i4')], casting='unsafe'))
        b = a.astype([('a', '>i4')])
        assert_equal(b, a.byteswap().newbyteorder())
        assert_equal(a['a'][0], b['a'][0])

        # Check that equality comparison works on structured arrays if
        # they are 'equiv'-castable
        a = np.array([(5, 42), (10, 1)], dtype=[('a', '>i4'), ('b', '<f8')])
        b = np.array([(42, 5), (1, 10)], dtype=[('b', '>f8'), ('a', '<i4')])
        assert_(np.can_cast(a.dtype, b.dtype, casting='equiv'))
        assert_equal(a == b, [True, True])

        # Check that 'equiv' casting can reorder fields and change byte
        # order
        # New in 1.12: This behavior changes in 1.13, test for dep warning
        assert_(np.can_cast(a.dtype, b.dtype, casting='equiv'))
        with assert_warns(FutureWarning):
            c = a.astype(b.dtype, casting='equiv')
        assert_equal(a == c, [True, True])

        # Check that 'safe' casting can change byte order and up-cast
        # fields
        t = [('a', '<i8'), ('b', '>f8')]
        assert_(np.can_cast(a.dtype, t, casting='safe'))
        c = a.astype(t, casting='safe')
        assert_equal((c == np.array([(5, 42), (10, 1)], dtype=t)),
                     [True, True])

        # Check that 'same_kind' casting can change byte order and
        # change field widths within a "kind"
        t = [('a', '<i4'), ('b', '>f4')]
        assert_(np.can_cast(a.dtype, t, casting='same_kind'))
        c = a.astype(t, casting='same_kind')
        assert_equal((c == np.array([(5, 42), (10, 1)], dtype=t)),
                     [True, True])

        # Check that casting fails if the casting rule should fail on
        # any of the fields
        t = [('a', '>i8'), ('b', '<f4')]
        assert_(not np.can_cast(a.dtype, t, casting='safe'))
        assert_raises(TypeError, a.astype, t, casting='safe')
        t = [('a', '>i2'), ('b', '<f8')]
        assert_(not np.can_cast(a.dtype, t, casting='equiv'))
        assert_raises(TypeError, a.astype, t, casting='equiv')
        t = [('a', '>i8'), ('b', '<i2')]
        assert_(not np.can_cast(a.dtype, t, casting='same_kind'))
        assert_raises(TypeError, a.astype, t, casting='same_kind')
        assert_(not np.can_cast(a.dtype, b.dtype, casting='no'))
        assert_raises(TypeError, a.astype, b.dtype, casting='no')

        # Check that non-'unsafe' casting can't change the set of field names
        for casting in ['no', 'safe', 'equiv', 'same_kind']:
            t = [('a', '>i4')]
            assert_(not np.can_cast(a.dtype, t, casting=casting))
            t = [('a', '>i4'), ('b', '<f8'), ('c', 'i4')]
            assert_(not np.can_cast(a.dtype, t, casting=casting))

    def test_objview(self):
        # https://github.com/numpy/numpy/issues/3286
        a = np.array([], dtype=[('a', 'f'), ('b', 'f'), ('c', 'O')])
        a[['a', 'b']]  # TypeError?

        # https://github.com/numpy/numpy/issues/3253
        dat2 = np.zeros(3, [('A', 'i'), ('B', '|O')])
        dat2[['B', 'A']]  # TypeError?

    def test_setfield(self):
        # https://github.com/numpy/numpy/issues/3126
        struct_dt = np.dtype([('elem', 'i4', 5),])
        dt = np.dtype([('field', 'i4', 10),('struct', struct_dt)])
        x = np.zeros(1, dt)
        x[0]['field'] = np.ones(10, dtype='i4')
        x[0]['struct'] = np.ones(1, dtype=struct_dt)
        assert_equal(x[0]['field'], np.ones(10, dtype='i4'))

    def test_setfield_object(self):
        # make sure object field assignment with ndarray value
        # on void scalar mimics setitem behavior
        b = np.zeros(1, dtype=[('x', 'O')])
        # next line should work identically to b['x'][0] = np.arange(3)
        b[0]['x'] = np.arange(3)
        assert_equal(b[0]['x'], np.arange(3))

        # check that broadcasting check still works
        c = np.zeros(1, dtype=[('x', 'O', 5)])

        def testassign():
            c[0]['x'] = np.arange(3)

        assert_raises(ValueError, testassign)

    def test_zero_width_string(self):
        # Test for PR #6430 / issues #473, #4955, #2585

        dt = np.dtype([('I', int), ('S', 'S0')])

        x = np.zeros(4, dtype=dt)

        assert_equal(x['S'], [b'', b'', b'', b''])
        assert_equal(x['S'].itemsize, 0)

        x['S'] = ['a', 'b', 'c', 'd']
        assert_equal(x['S'], [b'', b'', b'', b''])
        assert_equal(x['I'], [0, 0, 0, 0])

        # Variation on test case from #4955
        x['S'][x['I'] == 0] = 'hello'
        assert_equal(x['S'], [b'', b'', b'', b''])
        assert_equal(x['I'], [0, 0, 0, 0])

        # Variation on test case from #2585
        x['S'] = 'A'
        assert_equal(x['S'], [b'', b'', b'', b''])
        assert_equal(x['I'], [0, 0, 0, 0])

        # Allow zero-width dtypes in ndarray constructor
        y = np.ndarray(4, dtype=x['S'].dtype)
        assert_equal(y.itemsize, 0)
        assert_equal(x['S'], y)

        # More tests for indexing an array with zero-width fields
        assert_equal(np.zeros(4, dtype=[('a', 'S0,S0'),
                                        ('b', 'u1')])['a'].itemsize, 0)
        assert_equal(np.empty(3, dtype='S0,S0').itemsize, 0)
        assert_equal(np.zeros(4, dtype='S0,u1')['f0'].itemsize, 0)

        xx = x['S'].reshape((2, 2))
        assert_equal(xx.itemsize, 0)
        assert_equal(xx, [[b'', b''], [b'', b'']])
        # check for no uninitialized memory due to viewing S0 array
        assert_equal(xx[:].dtype, xx.dtype)
        assert_array_equal(eval(repr(xx), dict(array=np.array)), xx)

        b = io.BytesIO()
        np.save(b, xx)

        b.seek(0)
        yy = np.load(b)
        assert_equal(yy.itemsize, 0)
        assert_equal(xx, yy)

        with temppath(suffix='.npy') as tmp:
            np.save(tmp, xx)
            yy = np.load(tmp)
            assert_equal(yy.itemsize, 0)
            assert_equal(xx, yy)

    def test_base_attr(self):
        a = np.zeros(3, dtype='i4,f4')
        b = a[0]
        assert_(b.base is a)


class TestBool(TestCase):
    def test_test_interning(self):
        a0 = np.bool_(0)
        b0 = np.bool_(False)
        self.assertTrue(a0 is b0)
        a1 = np.bool_(1)
        b1 = np.bool_(True)
        self.assertTrue(a1 is b1)
        self.assertTrue(np.array([True])[0] is a1)
        self.assertTrue(np.array(True)[()] is a1)

    def test_sum(self):
        d = np.ones(101, dtype=np.bool)
        assert_equal(d.sum(), d.size)
        assert_equal(d[::2].sum(), d[::2].size)
        assert_equal(d[::-2].sum(), d[::-2].size)

        d = np.frombuffer(b'\xff\xff' * 100, dtype=bool)
        assert_equal(d.sum(), d.size)
        assert_equal(d[::2].sum(), d[::2].size)
        assert_equal(d[::-2].sum(), d[::-2].size)

    def check_count_nonzero(self, power, length):
        powers = [2 ** i for i in range(length)]
        for i in range(2**power):
            l = [(i & x) != 0 for x in powers]
            a = np.array(l, dtype=np.bool)
            c = builtins.sum(l)
            self.assertEqual(np.count_nonzero(a), c)
            av = a.view(np.uint8)
            av *= 3
            self.assertEqual(np.count_nonzero(a), c)
            av *= 4
            self.assertEqual(np.count_nonzero(a), c)
            av[av != 0] = 0xFF
            self.assertEqual(np.count_nonzero(a), c)

    def test_count_nonzero(self):
        # check all 12 bit combinations in a length 17 array
        # covers most cases of the 16 byte unrolled code
        self.check_count_nonzero(12, 17)

    @dec.slow
    def test_count_nonzero_all(self):
        # check all combinations in a length 17 array
        # covers all cases of the 16 byte unrolled code
        self.check_count_nonzero(17, 17)

    def test_count_nonzero_unaligned(self):
        # prevent mistakes as e.g. gh-4060
        for o in range(7):
            a = np.zeros((18,), dtype=np.bool)[o+1:]
            a[:o] = True
            self.assertEqual(np.count_nonzero(a), builtins.sum(a.tolist()))
            a = np.ones((18,), dtype=np.bool)[o+1:]
            a[:o] = False
            self.assertEqual(np.count_nonzero(a), builtins.sum(a.tolist()))


class TestMethods(TestCase):
    def test_compress(self):
        tgt = [[5, 6, 7, 8, 9]]
        arr = np.arange(10).reshape(2, 5)
        out = arr.compress([0, 1], axis=0)
        assert_equal(out, tgt)

        tgt = [[1, 3], [6, 8]]
        out = arr.compress([0, 1, 0, 1, 0], axis=1)
        assert_equal(out, tgt)

        tgt = [[1], [6]]
        arr = np.arange(10).reshape(2, 5)
        out = arr.compress([0, 1], axis=1)
        assert_equal(out, tgt)

        arr = np.arange(10).reshape(2, 5)
        out = arr.compress([0, 1])
        assert_equal(out, 1)

    def test_choose(self):
        x = 2*np.ones((3,), dtype=int)
        y = 3*np.ones((3,), dtype=int)
        x2 = 2*np.ones((2, 3), dtype=int)
        y2 = 3*np.ones((2, 3), dtype=int)
        ind = np.array([0, 0, 1])

        A = ind.choose((x, y))
        assert_equal(A, [2, 2, 3])

        A = ind.choose((x2, y2))
        assert_equal(A, [[2, 2, 3], [2, 2, 3]])

        A = ind.choose((x, y2))
        assert_equal(A, [[2, 2, 3], [2, 2, 3]])

    def test_prod(self):
        ba = [1, 2, 10, 11, 6, 5, 4]
        ba2 = [[1, 2, 3, 4], [5, 6, 7, 9], [10, 3, 4, 5]]

        for ctype in [np.int16, np.uint16, np.int32, np.uint32,
                      np.float32, np.float64, np.complex64, np.complex128]:
            a = np.array(ba, ctype)
            a2 = np.array(ba2, ctype)
            if ctype in ['1', 'b']:
                self.assertRaises(ArithmeticError, a.prod)
                self.assertRaises(ArithmeticError, a2.prod, axis=1)
            else:
                assert_equal(a.prod(axis=0), 26400)
                assert_array_equal(a2.prod(axis=0),
                                   np.array([50, 36, 84, 180], ctype))
                assert_array_equal(a2.prod(axis=-1),
                                   np.array([24, 1890, 600], ctype))

    def test_repeat(self):
        m = np.array([1, 2, 3, 4, 5, 6])
        m_rect = m.reshape((2, 3))

        A = m.repeat([1, 3, 2, 1, 1, 2])
        assert_equal(A, [1, 2, 2, 2, 3,
                         3, 4, 5, 6, 6])

        A = m.repeat(2)
        assert_equal(A, [1, 1, 2, 2, 3, 3,
                         4, 4, 5, 5, 6, 6])

        A = m_rect.repeat([2, 1], axis=0)
        assert_equal(A, [[1, 2, 3],
                         [1, 2, 3],
                         [4, 5, 6]])

        A = m_rect.repeat([1, 3, 2], axis=1)
        assert_equal(A, [[1, 2, 2, 2, 3, 3],
                         [4, 5, 5, 5, 6, 6]])

        A = m_rect.repeat(2, axis=0)
        assert_equal(A, [[1, 2, 3],
                         [1, 2, 3],
                         [4, 5, 6],
                         [4, 5, 6]])

        A = m_rect.repeat(2, axis=1)
        assert_equal(A, [[1, 1, 2, 2, 3, 3],
                         [4, 4, 5, 5, 6, 6]])

    def test_reshape(self):
        arr = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]])

        tgt = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]
        assert_equal(arr.reshape(2, 6), tgt)

        tgt = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]
        assert_equal(arr.reshape(3, 4), tgt)

        tgt = [[1, 10, 8, 6], [4, 2, 11, 9], [7, 5, 3, 12]]
        assert_equal(arr.reshape((3, 4), order='F'), tgt)

        tgt = [[1, 4, 7, 10], [2, 5, 8, 11], [3, 6, 9, 12]]
        assert_equal(arr.T.reshape((3, 4), order='C'), tgt)

    def test_round(self):
        def check_round(arr, expected, *round_args):
            assert_equal(arr.round(*round_args), expected)
            # With output array
            out = np.zeros_like(arr)
            res = arr.round(*round_args, out=out)
            assert_equal(out, expected)
            assert_equal(out, res)

        check_round(np.array([1.2, 1.5]), [1, 2])
        check_round(np.array(1.5), 2)
        check_round(np.array([12.2, 15.5]), [10, 20], -1)
        check_round(np.array([12.15, 15.51]), [12.2, 15.5], 1)
        # Complex rounding
        check_round(np.array([4.5 + 1.5j]), [4 + 2j])
        check_round(np.array([12.5 + 15.5j]), [10 + 20j], -1)

    def test_squeeze(self):
        a = np.array([[[1], [2], [3]]])
        assert_equal(a.squeeze(), [1, 2, 3])
        assert_equal(a.squeeze(axis=(0,)), [[1], [2], [3]])
        assert_raises(ValueError, a.squeeze, axis=(1,))
        assert_equal(a.squeeze(axis=(2,)), [[1, 2, 3]])

    def test_transpose(self):
        a = np.array([[1, 2], [3, 4]])
        assert_equal(a.transpose(), [[1, 3], [2, 4]])
        self.assertRaises(ValueError, lambda: a.transpose(0))
        self.assertRaises(ValueError, lambda: a.transpose(0, 0))
        self.assertRaises(ValueError, lambda: a.transpose(0, 1, 2))

    def test_sort(self):
        # test ordering for floats and complex containing nans. It is only
        # necessary to check the less-than comparison, so sorts that
        # only follow the insertion sort path are sufficient. We only
        # test doubles and complex doubles as the logic is the same.

        # check doubles
        msg = "Test real sort order with nans"
        a = np.array([np.nan, 1, 0])
        b = np.sort(a)
        assert_equal(b, a[::-1], msg)
        # check complex
        msg = "Test complex sort order with nans"
        a = np.zeros(9, dtype=np.complex128)
        a.real += [np.nan, np.nan, np.nan, 1, 0, 1, 1, 0, 0]
        a.imag += [np.nan, 1, 0, np.nan, np.nan, 1, 0, 1, 0]
        b = np.sort(a)
        assert_equal(b, a[::-1], msg)

        # all c scalar sorts use the same code with different types
        # so it suffices to run a quick check with one type. The number
        # of sorted items must be greater than ~50 to check the actual
        # algorithm because quick and merge sort fall over to insertion
        # sort for small arrays.
        a = np.arange(101)
        b = a[::-1].copy()
        for kind in ['q', 'm', 'h']:
            msg = "scalar sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # test complex sorts. These use the same code as the scalars
        # but the compare function differs.
        ai = a*1j + 1
        bi = b*1j + 1
        for kind in ['q', 'm', 'h']:
            msg = "complex sort, real part == 1, kind=%s" % kind
            c = ai.copy()
            c.sort(kind=kind)
            assert_equal(c, ai, msg)
            c = bi.copy()
            c.sort(kind=kind)
            assert_equal(c, ai, msg)
        ai = a + 1j
        bi = b + 1j
        for kind in ['q', 'm', 'h']:
            msg = "complex sort, imag part == 1, kind=%s" % kind
            c = ai.copy()
            c.sort(kind=kind)
            assert_equal(c, ai, msg)
            c = bi.copy()
            c.sort(kind=kind)
            assert_equal(c, ai, msg)

        # test sorting of complex arrays requiring byte-swapping, gh-5441
        for endianess in '<>':
            for dt in np.typecodes['Complex']:
                arr = np.array([1+3.j, 2+2.j, 3+1.j], dtype=endianess + dt)
                c = arr.copy()
                c.sort()
                msg = 'byte-swapped complex sort, dtype={0}'.format(dt)
                assert_equal(c, arr, msg)

        # test string sorts.
        s = 'aaaaaaaa'
        a = np.array([s + chr(i) for i in range(101)])
        b = a[::-1].copy()
        for kind in ['q', 'm', 'h']:
            msg = "string sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # test unicode sorts.
        s = 'aaaaaaaa'
        a = np.array([s + chr(i) for i in range(101)], dtype=np.unicode)
        b = a[::-1].copy()
        for kind in ['q', 'm', 'h']:
            msg = "unicode sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # test object array sorts.
        a = np.empty((101,), dtype=np.object)
        a[:] = list(range(101))
        b = a[::-1]
        for kind in ['q', 'h', 'm']:
            msg = "object sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # test record array sorts.
        dt = np.dtype([('f', float), ('i', int)])
        a = np.array([(i, i) for i in range(101)], dtype=dt)
        b = a[::-1]
        for kind in ['q', 'h', 'm']:
            msg = "object sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # test datetime64 sorts.
        a = np.arange(0, 101, dtype='datetime64[D]')
        b = a[::-1]
        for kind in ['q', 'h', 'm']:
            msg = "datetime64 sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # test timedelta64 sorts.
        a = np.arange(0, 101, dtype='timedelta64[D]')
        b = a[::-1]
        for kind in ['q', 'h', 'm']:
            msg = "timedelta64 sort, kind=%s" % kind
            c = a.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)
            c = b.copy()
            c.sort(kind=kind)
            assert_equal(c, a, msg)

        # check axis handling. This should be the same for all type
        # specific sorts, so we only check it for one type and one kind
        a = np.array([[3, 2], [1, 0]])
        b = np.array([[1, 0], [3, 2]])
        c = np.array([[2, 3], [0, 1]])
        d = a.copy()
        d.sort(axis=0)
        assert_equal(d, b, "test sort with axis=0")
        d = a.copy()
        d.sort(axis=1)
        assert_equal(d, c, "test sort with axis=1")
        d = a.copy()
        d.sort()
        assert_equal(d, c, "test sort with default axis")

        # check axis handling for multidimensional empty arrays
        a = np.array([])
        a.shape = (3, 2, 1, 0)
        for axis in range(-a.ndim, a.ndim):
            msg = 'test empty array sort with axis={0}'.format(axis)
            assert_equal(np.sort(a, axis=axis), a, msg)
        msg = 'test empty array sort with axis=None'
        assert_equal(np.sort(a, axis=None), a.ravel(), msg)

        # test generic class with bogus ordering,
        # should not segfault.
        class Boom(object):
            def __lt__(self, other):
                return True

        a = np.array([Boom()]*100, dtype=object)
        for kind in ['q', 'm', 'h']:
            msg = "bogus comparison object sort, kind=%s" % kind
            c.sort(kind=kind)

    def test_void_sort(self):
        # gh-8210 - previously segfaulted
        for i in range(4):
            arr = np.empty(1000, 'V4')
            arr[::-1].sort()

        dt = np.dtype([('val', 'i4', (1,))])
        for i in range(4):
            arr = np.empty(1000, dt)
            arr[::-1].sort()

    def test_sort_degraded(self):
        # test degraded dataset would take minutes to run with normal qsort
        d = np.arange(1000000)
        do = d.copy()
        x = d
        # create a median of 3 killer where each median is the sorted second
        # last element of the quicksort partition
        while x.size > 3:
            mid = x.size // 2
            x[mid], x[-2] = x[-2], x[mid]
            x = x[:-2]

        assert_equal(np.sort(d), do)
        assert_equal(d[np.argsort(d)], do)

    def test_copy(self):
        def assert_fortran(arr):
            assert_(arr.flags.fortran)
            assert_(arr.flags.f_contiguous)
            assert_(not arr.flags.c_contiguous)

        def assert_c(arr):
            assert_(not arr.flags.fortran)
            assert_(not arr.flags.f_contiguous)
            assert_(arr.flags.c_contiguous)

        a = np.empty((2, 2), order='F')
        # Test copying a Fortran array
        assert_c(a.copy())
        assert_c(a.copy('C'))
        assert_fortran(a.copy('F'))
        assert_fortran(a.copy('A'))

        # Now test starting with a C array.
        a = np.empty((2, 2), order='C')
        assert_c(a.copy())
        assert_c(a.copy('C'))
        assert_fortran(a.copy('F'))
        assert_c(a.copy('A'))

    def test_sort_order(self):
        # Test sorting an array with fields
        x1 = np.array([21, 32, 14])
        x2 = np.array(['my', 'first', 'name'])
        x3 = np.array([3.1, 4.5, 6.2])
        r = np.rec.fromarrays([x1, x2, x3], names='id,word,number')

        r.sort(order=['id'])
        assert_equal(r.id, np.array([14, 21, 32]))
        assert_equal(r.word, np.array(['name', 'my', 'first']))
        assert_equal(r.number, np.array([6.2, 3.1, 4.5]))

        r.sort(order=['word'])
        assert_equal(r.id, np.array([32, 21, 14]))
        assert_equal(r.word, np.array(['first', 'my', 'name']))
        assert_equal(r.number, np.array([4.5, 3.1, 6.2]))

        r.sort(order=['number'])
        assert_equal(r.id, np.array([21, 32, 14]))
        assert_equal(r.word, np.array(['my', 'first', 'name']))
        assert_equal(r.number, np.array([3.1, 4.5, 6.2]))

        if sys.byteorder == 'little':
            strtype = '>i2'
        else:
            strtype = '<i2'
        mydtype = [('name', strchar + '5'), ('col2', strtype)]
        r = np.array([('a', 1), ('b', 255), ('c', 3), ('d', 258)],
                     dtype=mydtype)
        r.sort(order='col2')
        assert_equal(r['col2'], [1, 3, 255, 258])
        assert_equal(r, np.array([('a', 1), ('c', 3), ('b', 255), ('d', 258)],
                                 dtype=mydtype))

    def test_argsort(self):
        # all c scalar argsorts use the same code with different types
        # so it suffices to run a quick check with one type. The number
        # of sorted items must be greater than ~50 to check the actual
        # algorithm because quick and merge sort fall over to insertion
        # sort for small arrays.
        a = np.arange(101)
        b = a[::-1].copy()
        for kind in ['q', 'm', 'h']:
            msg = "scalar argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), a, msg)
            assert_equal(b.copy().argsort(kind=kind), b, msg)

        # test complex argsorts. These use the same code as the scalars
        # but the compare function differs.
        ai = a*1j + 1
        bi = b*1j + 1
        for kind in ['q', 'm', 'h']:
            msg = "complex argsort, kind=%s" % kind
            assert_equal(ai.copy().argsort(kind=kind), a, msg)
            assert_equal(bi.copy().argsort(kind=kind), b, msg)
        ai = a + 1j
        bi = b + 1j
        for kind in ['q', 'm', 'h']:
            msg = "complex argsort, kind=%s" % kind
            assert_equal(ai.copy().argsort(kind=kind), a, msg)
            assert_equal(bi.copy().argsort(kind=kind), b, msg)

        # test argsort of complex arrays requiring byte-swapping, gh-5441
        for endianess in '<>':
            for dt in np.typecodes['Complex']:
                arr = np.array([1+3.j, 2+2.j, 3+1.j], dtype=endianess + dt)
                msg = 'byte-swapped complex argsort, dtype={0}'.format(dt)
                assert_equal(arr.argsort(),
                             np.arange(len(arr), dtype=np.intp), msg)

        # test string argsorts.
        s = 'aaaaaaaa'
        a = np.array([s + chr(i) for i in range(101)])
        b = a[::-1].copy()
        r = np.arange(101)
        rr = r[::-1]
        for kind in ['q', 'm', 'h']:
            msg = "string argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), r, msg)
            assert_equal(b.copy().argsort(kind=kind), rr, msg)

        # test unicode argsorts.
        s = 'aaaaaaaa'
        a = np.array([s + chr(i) for i in range(101)], dtype=np.unicode)
        b = a[::-1]
        r = np.arange(101)
        rr = r[::-1]
        for kind in ['q', 'm', 'h']:
            msg = "unicode argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), r, msg)
            assert_equal(b.copy().argsort(kind=kind), rr, msg)

        # test object array argsorts.
        a = np.empty((101,), dtype=np.object)
        a[:] = list(range(101))
        b = a[::-1]
        r = np.arange(101)
        rr = r[::-1]
        for kind in ['q', 'm', 'h']:
            msg = "object argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), r, msg)
            assert_equal(b.copy().argsort(kind=kind), rr, msg)

        # test structured array argsorts.
        dt = np.dtype([('f', float), ('i', int)])
        a = np.array([(i, i) for i in range(101)], dtype=dt)
        b = a[::-1]
        r = np.arange(101)
        rr = r[::-1]
        for kind in ['q', 'm', 'h']:
            msg = "structured array argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), r, msg)
            assert_equal(b.copy().argsort(kind=kind), rr, msg)

        # test datetime64 argsorts.
        a = np.arange(0, 101, dtype='datetime64[D]')
        b = a[::-1]
        r = np.arange(101)
        rr = r[::-1]
        for kind in ['q', 'h', 'm']:
            msg = "datetime64 argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), r, msg)
            assert_equal(b.copy().argsort(kind=kind), rr, msg)

        # test timedelta64 argsorts.
        a = np.arange(0, 101, dtype='timedelta64[D]')
        b = a[::-1]
        r = np.arange(101)
        rr = r[::-1]
        for kind in ['q', 'h', 'm']:
            msg = "timedelta64 argsort, kind=%s" % kind
            assert_equal(a.copy().argsort(kind=kind), r, msg)
            assert_equal(b.copy().argsort(kind=kind), rr, msg)

        # check axis handling. This should be the same for all type
        # specific argsorts, so we only check it for one type and one kind
        a = np.array([[3, 2], [1, 0]])
        b = np.array([[1, 1], [0, 0]])
        c = np.array([[1, 0], [1, 0]])
        assert_equal(a.copy().argsort(axis=0), b)
        assert_equal(a.copy().argsort(axis=1), c)
        assert_equal(a.copy().argsort(), c)

        # check axis handling for multidimensional empty arrays
        a = np.array([])
        a.shape = (3, 2, 1, 0)
        for axis in range(-a.ndim, a.ndim):
            msg = 'test empty array argsort with axis={0}'.format(axis)
            assert_equal(np.argsort(a, axis=axis),
                         np.zeros_like(a, dtype=np.intp), msg)
        msg = 'test empty array argsort with axis=None'
        assert_equal(np.argsort(a, axis=None),
                     np.zeros_like(a.ravel(), dtype=np.intp), msg)

        # check that stable argsorts are stable
        r = np.arange(100)
        # scalars
        a = np.zeros(100)
        assert_equal(a.argsort(kind='m'), r)
        # complex
        a = np.zeros(100, dtype=np.complex)
        assert_equal(a.argsort(kind='m'), r)
        # string
        a = np.array(['aaaaaaaaa' for i in range(100)])
        assert_equal(a.argsort(kind='m'), r)
        # unicode
        a = np.array(['aaaaaaaaa' for i in range(100)], dtype=np.unicode)
        assert_equal(a.argsort(kind='m'), r)

    def test_sort_unicode_kind(self):
        d = np.arange(10)
        k = b'\xc3\xa4'.decode("UTF8")
        assert_raises(ValueError, d.sort, kind=k)
        assert_raises(ValueError, d.argsort, kind=k)

    def test_searchsorted(self):
        # test for floats and complex containing nans. The logic is the
        # same for all float types so only test double types for now.
        # The search sorted routines use the compare functions for the
        # array type, so this checks if that is consistent with the sort
        # order.

        # check double
        a = np.array([0, 1, np.nan])
        msg = "Test real searchsorted with nans, side='l'"
        b = a.searchsorted(a, side='l')
        assert_equal(b, np.arange(3), msg)
        msg = "Test real searchsorted with nans, side='r'"
        b = a.searchsorted(a, side='r')
        assert_equal(b, np.arange(1, 4), msg)
        # check double complex
        a = np.zeros(9, dtype=np.complex128)
        a.real += [0, 0, 1, 1, 0, 1, np.nan, np.nan, np.nan]
        a.imag += [0, 1, 0, 1, np.nan, np.nan, 0, 1, np.nan]
        msg = "Test complex searchsorted with nans, side='l'"
        b = a.searchsorted(a, side='l')
        assert_equal(b, np.arange(9), msg)
        msg = "Test complex searchsorted with nans, side='r'"
        b = a.searchsorted(a, side='r')
        assert_equal(b, np.arange(1, 10), msg)
        msg = "Test searchsorted with little endian, side='l'"
        a = np.array([0, 128], dtype='<i4')
        b = a.searchsorted(np.array(128, dtype='<i4'))
        assert_equal(b, 1, msg)
        msg = "Test searchsorted with big endian, side='l'"
        a = np.array([0, 128], dtype='>i4')
        b = a.searchsorted(np.array(128, dtype='>i4'))
        assert_equal(b, 1, msg)

        # Check 0 elements
        a = np.ones(0)
        b = a.searchsorted([0, 1, 2], 'l')
        assert_equal(b, [0, 0, 0])
        b = a.searchsorted([0, 1, 2], 'r')
        assert_equal(b, [0, 0, 0])
        a = np.ones(1)
        # Check 1 element
        b = a.searchsorted([0, 1, 2], 'l')
        assert_equal(b, [0, 0, 1])
        b = a.searchsorted([0, 1, 2], 'r')
        assert_equal(b, [0, 1, 1])
        # Check all elements equal
        a = np.ones(2)
        b = a.searchsorted([0, 1, 2], 'l')
        assert_equal(b, [0, 0, 2])
        b = a.searchsorted([0, 1, 2], 'r')
        assert_equal(b, [0, 2, 2])

        # Test searching unaligned array
        a = np.arange(10)
        aligned = np.empty(a.itemsize * a.size + 1, 'uint8')
        unaligned = aligned[1:].view(a.dtype)
        unaligned[:] = a
        # Test searching unaligned array
        b = unaligned.searchsorted(a, 'l')
        assert_equal(b, a)
        b = unaligned.searchsorted(a, 'r')
        assert_equal(b, a + 1)
        # Test searching for unaligned keys
        b = a.searchsorted(unaligned, 'l')
        assert_equal(b, a)
        b = a.searchsorted(unaligned, 'r')
        assert_equal(b, a + 1)

        # Test smart resetting of binsearch indices
        a = np.arange(5)
        b = a.searchsorted([6, 5, 4], 'l')
        assert_equal(b, [5, 5, 4])
        b = a.searchsorted([6, 5, 4], 'r')
        assert_equal(b, [5, 5, 5])

        # Test all type specific binary search functions
        types = ''.join((np.typecodes['AllInteger'], np.typecodes['AllFloat'],
                         np.typecodes['Datetime'], '?O'))
        for dt in types:
            if dt == 'M':
                dt = 'M8[D]'
            if dt == '?':
                a = np.arange(2, dtype=dt)
                out = np.arange(2)
            else:
                a = np.arange(0, 5, dtype=dt)
                out = np.arange(5)
            b = a.searchsorted(a, 'l')
            assert_equal(b, out)
            b = a.searchsorted(a, 'r')
            assert_equal(b, out + 1)

    def test_searchsorted_unicode(self):
        # Test searchsorted on unicode strings.

        # 1.6.1 contained a string length miscalculation in
        # arraytypes.c.src:UNICODE_compare() which manifested as
        # incorrect/inconsistent results from searchsorted.
        a = np.array(['P:\\20x_dapi_cy3\\20x_dapi_cy3_20100185_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100186_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100187_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100189_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100190_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100191_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100192_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100193_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100194_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100195_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100196_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100197_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100198_1',
                      'P:\\20x_dapi_cy3\\20x_dapi_cy3_20100199_1'],
                     dtype=np.unicode)
        ind = np.arange(len(a))
        assert_equal([a.searchsorted(v, 'left') for v in a], ind)
        assert_equal([a.searchsorted(v, 'right') for v in a], ind + 1)
        assert_equal([a.searchsorted(a[i], 'left') for i in ind], ind)
        assert_equal([a.searchsorted(a[i], 'right') for i in ind], ind + 1)

    def test_searchsorted_with_sorter(self):
        a = np.array([5, 2, 1, 3, 4])
        s = np.argsort(a)
        assert_raises(TypeError, np.searchsorted, a, 0, sorter=(1, (2, 3)))
        assert_raises(TypeError, np.searchsorted, a, 0, sorter=[1.1])
        assert_raises(ValueError, np.searchsorted, a, 0, sorter=[1, 2, 3, 4])
        assert_raises(ValueError, np.searchsorted, a, 0, sorter=[1, 2, 3, 4, 5, 6])

        # bounds check
        assert_raises(ValueError, np.searchsorted, a, 4, sorter=[0, 1, 2, 3, 5])
        assert_raises(ValueError, np.searchsorted, a, 0, sorter=[-1, 0, 1, 2, 3])
        assert_raises(ValueError, np.searchsorted, a, 0, sorter=[4, 0, -1, 2, 3])

        a = np.random.rand(300)
        s = a.argsort()
        b = np.sort(a)
        k = np.linspace(0, 1, 20)
        assert_equal(b.searchsorted(k), a.searchsorted(k, sorter=s))

        a = np.array([0, 1, 2, 3, 5]*20)
        s = a.argsort()
        k = [0, 1, 2, 3, 5]
        expected = [0, 20, 40, 60, 80]
        assert_equal(a.searchsorted(k, side='l', sorter=s), expected)
        expected = [20, 40, 60, 80, 100]
        assert_equal(a.searchsorted(k, side='r', sorter=s), expected)

        # Test searching unaligned array
        keys = np.arange(10)
        a = keys.copy()
        np.random.shuffle(s)
        s = a.argsort()
        aligned = np.empty(a.itemsize * a.size + 1, 'uint8')
        unaligned = aligned[1:].view(a.dtype)
        # Test searching unaligned array
        unaligned[:] = a
        b = unaligned.searchsorted(keys, 'l', s)
        assert_equal(b, keys)
        b = unaligned.searchsorted(keys, 'r', s)
        assert_equal(b, keys + 1)
        # Test searching for unaligned keys
        unaligned[:] = keys
        b = a.searchsorted(unaligned, 'l', s)
        assert_equal(b, keys)
        b = a.searchsorted(unaligned, 'r', s)
        assert_equal(b, keys + 1)

        # Test all type specific indirect binary search functions
        types = ''.join((np.typecodes['AllInteger'], np.typecodes['AllFloat'],
                         np.typecodes['Datetime'], '?O'))
        for dt in types:
            if dt == 'M':
                dt = 'M8[D]'
            if dt == '?':
                a = np.array([1, 0], dtype=dt)
                # We want the sorter array to be of a type that is different
                # from np.intp in all platforms, to check for #4698
                s = np.array([1, 0], dtype=np.int16)
                out = np.array([1, 0])
            else:
                a = np.array([3, 4, 1, 2, 0], dtype=dt)
                # We want the sorter array to be of a type that is different
                # from np.intp in all platforms, to check for #4698
                s = np.array([4, 2, 3, 0, 1], dtype=np.int16)
                out = np.array([3, 4, 1, 2, 0], dtype=np.intp)
            b = a.searchsorted(a, 'l', s)
            assert_equal(b, out)
            b = a.searchsorted(a, 'r', s)
            assert_equal(b, out + 1)

        # Test non-contiguous sorter array
        a = np.array([3, 4, 1, 2, 0])
        srt = np.empty((10,), dtype=np.intp)
        srt[1::2] = -1
        srt[::2] = [4, 2, 3, 0, 1]
        s = srt[::2]
        out = np.array([3, 4, 1, 2, 0], dtype=np.intp)
        b = a.searchsorted(a, 'l', s)
        assert_equal(b, out)
        b = a.searchsorted(a, 'r', s)
        assert_equal(b, out + 1)

    def test_searchsorted_return_type(self):
        # Functions returning indices should always return base ndarrays
        class A(np.ndarray):
            pass
        a = np.arange(5).view(A)
        b = np.arange(1, 3).view(A)
        s = np.arange(5).view(A)
        assert_(not isinstance(a.searchsorted(b, 'l'), A))
        assert_(not isinstance(a.searchsorted(b, 'r'), A))
        assert_(not isinstance(a.searchsorted(b, 'l', s), A))
        assert_(not isinstance(a.searchsorted(b, 'r', s), A))

    def test_argpartition_out_of_range(self):
        # Test out of range values in kth raise an error, gh-5469
        d = np.arange(10)
        assert_raises(ValueError, d.argpartition, 10)
        assert_raises(ValueError, d.argpartition, -11)
        # Test also for generic type argpartition, which uses sorting
        # and used to not bound check kth
        d_obj = np.arange(10, dtype=object)
        assert_raises(ValueError, d_obj.argpartition, 10)
        assert_raises(ValueError, d_obj.argpartition, -11)

    def test_partition_out_of_range(self):
        # Test out of range values in kth raise an error, gh-5469
        d = np.arange(10)
        assert_raises(ValueError, d.partition, 10)
        assert_raises(ValueError, d.partition, -11)
        # Test also for generic type partition, which uses sorting
        # and used to not bound check kth
        d_obj = np.arange(10, dtype=object)
        assert_raises(ValueError, d_obj.partition, 10)
        assert_raises(ValueError, d_obj.partition, -11)

    def test_argpartition_integer(self):
        # Test non-integer values in kth raise an error/
        d = np.arange(10)
        assert_raises(TypeError, d.argpartition, 9.)
        # Test also for generic type argpartition, which uses sorting
        # and used to not bound check kth
        d_obj = np.arange(10, dtype=object)
        assert_raises(TypeError, d_obj.argpartition, 9.)

    def test_partition_integer(self):
        # Test out of range values in kth raise an error, gh-5469
        d = np.arange(10)
        assert_raises(TypeError, d.partition, 9.)
        # Test also for generic type partition, which uses sorting
        # and used to not bound check kth
        d_obj = np.arange(10, dtype=object)
        assert_raises(TypeError, d_obj.partition, 9.)

    def test_partition_empty_array(self):
        # check axis handling for multidimensional empty arrays
        a = np.array([])
        a.shape = (3, 2, 1, 0)
        for axis in range(-a.ndim, a.ndim):
            msg = 'test empty array partition with axis={0}'.format(axis)
            assert_equal(np.partition(a, 0, axis=axis), a, msg)
        msg = 'test empty array partition with axis=None'
        assert_equal(np.partition(a, 0, axis=None), a.ravel(), msg)

    def test_argpartition_empty_array(self):
        # check axis handling for multidimensional empty arrays
        a = np.array([])
        a.shape = (3, 2, 1, 0)
        for axis in range(-a.ndim, a.ndim):
            msg = 'test empty array argpartition with axis={0}'.format(axis)
            assert_equal(np.partition(a, 0, axis=axis),
                         np.zeros_like(a, dtype=np.intp), msg)
        msg = 'test empty array argpartition with axis=None'
        assert_equal(np.partition(a, 0, axis=None),
                     np.zeros_like(a.ravel(), dtype=np.intp), msg)

    def test_partition(self):
        d = np.arange(10)
        assert_raises(TypeError, np.partition, d, 2, kind=1)
        assert_raises(ValueError, np.partition, d, 2, kind="nonsense")
        assert_raises(ValueError, np.argpartition, d, 2, kind="nonsense")
        assert_raises(ValueError, d.partition, 2, axis=0, kind="nonsense")
        assert_raises(ValueError, d.argpartition, 2, axis=0, kind="nonsense")
        for k in ("introselect",):
            d = np.array([])
            assert_array_equal(np.partition(d, 0, kind=k), d)
            assert_array_equal(np.argpartition(d, 0, kind=k), d)
            d = np.ones(1)
            assert_array_equal(np.partition(d, 0, kind=k)[0], d)
            assert_array_equal(d[np.argpartition(d, 0, kind=k)],
                               np.partition(d, 0, kind=k))

            # kth not modified
            kth = np.array([30, 15, 5])
            okth = kth.copy()
            np.partition(np.arange(40), kth)
            assert_array_equal(kth, okth)

            for r in ([2, 1], [1, 2], [1, 1]):
                d = np.array(r)
                tgt = np.sort(d)
                assert_array_equal(np.partition(d, 0, kind=k)[0], tgt[0])
                assert_array_equal(np.partition(d, 1, kind=k)[1], tgt[1])
                assert_array_equal(d[np.argpartition(d, 0, kind=k)],
                                   np.partition(d, 0, kind=k))
                assert_array_equal(d[np.argpartition(d, 1, kind=k)],
                                   np.partition(d, 1, kind=k))
                for i in range(d.size):
                    d[i:].partition(0, kind=k)
                assert_array_equal(d, tgt)

            for r in ([3, 2, 1], [1, 2, 3], [2, 1, 3], [2, 3, 1],
                      [1, 1, 1], [1, 2, 2], [2, 2, 1], [1, 2, 1]):
                d = np.array(r)
                tgt = np.sort(d)
                assert_array_equal(np.partition(d, 0, kind=k)[0], tgt[0])
                assert_array_equal(np.partition(d, 1, kind=k)[1], tgt[1])
                assert_array_equal(np.partition(d, 2, kind=k)[2], tgt[2])
                assert_array_equal(d[np.argpartition(d, 0, kind=k)],
                                   np.partition(d, 0, kind=k))
                assert_array_equal(d[np.argpartition(d, 1, kind=k)],
                                   np.partition(d, 1, kind=k))
                assert_array_equal(d[np.argpartition(d, 2, kind=k)],
                                   np.partition(d, 2, kind=k))
                for i in range(d.size):
                    d[i:].partition(0, kind=k)
                assert_array_equal(d, tgt)

            d = np.ones(50)
            assert_array_equal(np.partition(d, 0, kind=k), d)
            assert_array_equal(d[np.argpartition(d, 0, kind=k)],
                               np.partition(d, 0, kind=k))

            # sorted
            d = np.arange(49)
            self.assertEqual(np.partition(d, 5, kind=k)[5], 5)
            self.assertEqual(np.partition(d, 15, kind=k)[15], 15)
            assert_array_equal(d[np.argpartition(d, 5, kind=k)],
                               np.partition(d, 5, kind=k))
            assert_array_equal(d[np.argpartition(d, 15, kind=k)],
                               np.partition(d, 15, kind=k))

            # rsorted
            d = np.arange(47)[::-1]
            self.assertEqual(np.partition(d, 6, kind=k)[6], 6)
            self.assertEqual(np.partition(d, 16, kind=k)[16], 16)
            assert_array_equal(d[np.argpartition(d, 6, kind=k)],
                               np.partition(d, 6, kind=k))
            assert_array_equal(d[np.argpartition(d, 16, kind=k)],
                               np.partition(d, 16, kind=k))

            assert_array_equal(np.partition(d, -6, kind=k),
                               np.partition(d, 41, kind=k))
            assert_array_equal(np.partition(d, -16, kind=k),
                               np.partition(d, 31, kind=k))
            assert_array_equal(d[np.argpartition(d, -6, kind=k)],
                               np.partition(d, 41, kind=k))

            # median of 3 killer, O(n^2) on pure median 3 pivot quickselect
            # exercises the median of median of 5 code used to keep O(n)
            d = np.arange(1000000)
            x = np.roll(d, d.size // 2)
            mid = x.size // 2 + 1
            assert_equal(np.partition(x, mid)[mid], mid)
            d = np.arange(1000001)
            x = np.roll(d, d.size // 2 + 1)
            mid = x.size // 2 + 1
            assert_equal(np.partition(x, mid)[mid], mid)

            # max
            d = np.ones(10)
            d[1] = 4
            assert_equal(np.partition(d, (2, -1))[-1], 4)
            assert_equal(np.partition(d, (2, -1))[2], 1)
            assert_equal(d[np.argpartition(d, (2, -1))][-1], 4)
            assert_equal(d[np.argpartition(d, (2, -1))][2], 1)
            d[1] = np.nan
            assert_(np.isnan(d[np.argpartition(d, (2, -1))][-1]))
            assert_(np.isnan(np.partition(d, (2, -1))[-1]))

            # equal elements
            d = np.arange(47) % 7
            tgt = np.sort(np.arange(47) % 7)
            np.random.shuffle(d)
            for i in range(d.size):
                self.assertEqual(np.partition(d, i, kind=k)[i], tgt[i])
            assert_array_equal(d[np.argpartition(d, 6, kind=k)],
                               np.partition(d, 6, kind=k))
            assert_array_equal(d[np.argpartition(d, 16, kind=k)],
                               np.partition(d, 16, kind=k))
            for i in range(d.size):
                d[i:].partition(0, kind=k)
            assert_array_equal(d, tgt)

            d = np.array([0, 1, 2, 3, 4, 5, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
                          7, 7, 7, 7, 7, 9])
            kth = [0, 3, 19, 20]
            assert_equal(np.partition(d, kth, kind=k)[kth], (0, 3, 7, 7))
            assert_equal(d[np.argpartition(d, kth, kind=k)][kth], (0, 3, 7, 7))

            d = np.array([2, 1])
            d.partition(0, kind=k)
            assert_raises(ValueError, d.partition, 2)
            assert_raises(np.AxisError, d.partition, 3, axis=1)
            assert_raises(ValueError, np.partition, d, 2)
            assert_raises(np.AxisError, np.partition, d, 2, axis=1)
            assert_raises(ValueError, d.argpartition, 2)
            assert_raises(np.AxisError, d.argpartition, 3, axis=1)
            assert_raises(ValueError, np.argpartition, d, 2)
            assert_raises(np.AxisError, np.argpartition, d, 2, axis=1)
            d = np.arange(10).reshape((2, 5))
            d.partition(1, axis=0, kind=k)
            d.partition(4, axis=1, kind=k)
            np.partition(d, 1, axis=0, kind=k)
            np.partition(d, 4, axis=1, kind=k)
            np.partition(d, 1, axis=None, kind=k)
            np.partition(d, 9, axis=None, kind=k)
            d.argpartition(1, axis=0, kind=k)
            d.argpartition(4, axis=1, kind=k)
            np.argpartition(d, 1, axis=0, kind=k)
            np.argpartition(d, 4, axis=1, kind=k)
            np.argpartition(d, 1, axis=None, kind=k)
            np.argpartition(d, 9, axis=None, kind=k)
            assert_raises(ValueError, d.partition, 2, axis=0)
            assert_raises(ValueError, d.partition, 11, axis=1)
            assert_raises(TypeError, d.partition, 2, axis=None)
            assert_raises(ValueError, np.partition, d, 9, axis=1)
            assert_raises(ValueError, np.partition, d, 11, axis=None)
            assert_raises(ValueError, d.argpartition, 2, axis=0)
            assert_raises(ValueError, d.argpartition, 11, axis=1)
            assert_raises(ValueError, np.argpartition, d, 9, axis=1)
            assert_raises(ValueError, np.argpartition, d, 11, axis=None)

            td = [(dt, s) for dt in [np.int32, np.float32, np.complex64]
                  for s in (9, 16)]
            for dt, s in td:
                aae = assert_array_equal
                at = self.assertTrue

                d = np.arange(s, dtype=dt)
                np.random.shuffle(d)
                d1 = np.tile(np.arange(s, dtype=dt), (4, 1))
                map(np.random.shuffle, d1)
                d0 = np.transpose(d1)
                for i in range(d.size):
                    p = np.partition(d, i, kind=k)
                    self.assertEqual(p[i], i)
                    # all before are smaller
                    assert_array_less(p[:i], p[i])
                    # all after are larger
                    assert_array_less(p[i], p[i + 1:])
                    aae(p, d[np.argpartition(d, i, kind=k)])

                    p = np.partition(d1, i, axis=1, kind=k)
                    aae(p[:, i], np.array([i] * d1.shape[0], dtype=dt))
                    # array_less does not seem to work right
                    at((p[:, :i].T <= p[:, i]).all(),
                       msg="%d: %r <= %r" % (i, p[:, i], p[:, :i].T))
                    at((p[:, i + 1:].T > p[:, i]).all(),
                       msg="%d: %r < %r" % (i, p[:, i], p[:, i + 1:].T))
                    aae(p, d1[np.arange(d1.shape[0])[:, None],
                        np.argpartition(d1, i, axis=1, kind=k)])

                    p = np.partition(d0, i, axis=0, kind=k)
                    aae(p[i, :], np.array([i] * d1.shape[0], dtype=dt))
                    # array_less does not seem to work right
                    at((p[:i, :] <= p[i, :]).all(),
                       msg="%d: %r <= %r" % (i, p[i, :], p[:i, :]))
                    at((p[i + 1:, :] > p[i, :]).all(),
                       msg="%d: %r < %r" % (i, p[i, :], p[:, i + 1:]))
                    aae(p, d0[np.argpartition(d0, i, axis=0, kind=k),
                        np.arange(d0.shape[1])[None, :]])

                    # check inplace
                    dc = d.copy()
                    dc.partition(i, kind=k)
                    assert_equal(dc, np.partition(d, i, kind=k))
                    dc = d0.copy()
                    dc.partition(i, axis=0, kind=k)
                    assert_equal(dc, np.partition(d0, i, axis=0, kind=k))
                    dc = d1.copy()
                    dc.partition(i, axis=1, kind=k)
                    assert_equal(dc, np.partition(d1, i, axis=1, kind=k))

    def assert_partitioned(self, d, kth):
        prev = 0
        for k in np.sort(kth):
            assert_array_less(d[prev:k], d[k], err_msg='kth %d' % k)
            assert_((d[k:] >= d[k]).all(),
                    msg="kth %d, %r not greater equal %d" % (k, d[k:], d[k]))
            prev = k + 1

    def test_partition_iterative(self):
            d = np.arange(17)
            kth = (0, 1, 2, 429, 231)
            assert_raises(ValueError, d.partition, kth)
            assert_raises(ValueError, d.argpartition, kth)
            d = np.arange(10).reshape((2, 5))
            assert_raises(ValueError, d.partition, kth, axis=0)
            assert_raises(ValueError, d.partition, kth, axis=1)
            assert_raises(ValueError, np.partition, d, kth, axis=1)
            assert_raises(ValueError, np.partition, d, kth, axis=None)

            d = np.array([3, 4, 2, 1])
            p = np.partition(d, (0, 3))
            self.assert_partitioned(p, (0, 3))
            self.assert_partitioned(d[np.argpartition(d, (0, 3))], (0, 3))

            assert_array_equal(p, np.partition(d, (-3, -1)))
            assert_array_equal(p, d[np.argpartition(d, (-3, -1))])

            d = np.arange(17)
            np.random.shuffle(d)
            d.partition(range(d.size))
            assert_array_equal(np.arange(17), d)
            np.random.shuffle(d)
            assert_array_equal(np.arange(17), d[d.argpartition(range(d.size))])

            # test unsorted kth
            d = np.arange(17)
            np.random.shuffle(d)
            keys = np.array([1, 3, 8, -2])
            np.random.shuffle(d)
            p = np.partition(d, keys)
            self.assert_partitioned(p, keys)
            p = d[np.argpartition(d, keys)]
            self.assert_partitioned(p, keys)
            np.random.shuffle(keys)
            assert_array_equal(np.partition(d, keys), p)
            assert_array_equal(d[np.argpartition(d, keys)], p)

            # equal kth
            d = np.arange(20)[::-1]
            self.assert_partitioned(np.partition(d, [5]*4), [5])
            self.assert_partitioned(np.partition(d, [5]*4 + [6, 13]),
                                    [5]*4 + [6, 13])
            self.assert_partitioned(d[np.argpartition(d, [5]*4)], [5])
            self.assert_partitioned(d[np.argpartition(d, [5]*4 + [6, 13])],
                                    [5]*4 + [6, 13])

            d = np.arange(12)
            np.random.shuffle(d)
            d1 = np.tile(np.arange(12), (4, 1))
            map(np.random.shuffle, d1)
            d0 = np.transpose(d1)

            kth = (1, 6, 7, -1)
            p = np.partition(d1, kth, axis=1)
            pa = d1[np.arange(d1.shape[0])[:, None],
                    d1.argpartition(kth, axis=1)]
            assert_array_equal(p, pa)
            for i in range(d1.shape[0]):
                self.assert_partitioned(p[i,:], kth)
            p = np.partition(d0, kth, axis=0)
            pa = d0[np.argpartition(d0, kth, axis=0),
                    np.arange(d0.shape[1])[None,:]]
            assert_array_equal(p, pa)
            for i in range(d0.shape[1]):
                self.assert_partitioned(p[:, i], kth)

    def test_partition_cdtype(self):
        d = np.array([('Galahad', 1.7, 38), ('Arthur', 1.8, 41),
                   ('Lancelot', 1.9, 38)],
                  dtype=[('name', '|S10'), ('height', '<f8'), ('age', '<i4')])

        tgt = np.sort(d, order=['age', 'height'])
        assert_array_equal(np.partition(d, range(d.size),
                                        order=['age', 'height']),
                           tgt)
        assert_array_equal(d[np.argpartition(d, range(d.size),
                                             order=['age', 'height'])],
                           tgt)
        for k in range(d.size):
            assert_equal(np.partition(d, k, order=['age', 'height'])[k],
                        tgt[k])
            assert_equal(d[np.argpartition(d, k, order=['age', 'height'])][k],
                         tgt[k])

        d = np.array(['Galahad', 'Arthur', 'zebra', 'Lancelot'])
        tgt = np.sort(d)
        assert_array_equal(np.partition(d, range(d.size)), tgt)
        for k in range(d.size):
            assert_equal(np.partition(d, k)[k], tgt[k])
            assert_equal(d[np.argpartition(d, k)][k], tgt[k])

    def test_partition_unicode_kind(self):
        d = np.arange(10)
        k = b'\xc3\xa4'.decode("UTF8")
        assert_raises(ValueError, d.partition, 2, kind=k)
        assert_raises(ValueError, d.argpartition, 2, kind=k)

    def test_partition_fuzz(self):
        # a few rounds of random data testing
        for j in range(10, 30):
            for i in range(1, j - 2):
                d = np.arange(j)
                np.random.shuffle(d)
                d = d % np.random.randint(2, 30)
                idx = np.random.randint(d.size)
                kth = [0, idx, i, i + 1]
                tgt = np.sort(d)[kth]
                assert_array_equal(np.partition(d, kth)[kth], tgt,
                                   err_msg="data: %r\n kth: %r" % (d, kth))

    def test_argpartition_gh5524(self):
        #  A test for functionality of argpartition on lists.
        d = [6,7,3,2,9,0]
        p = np.argpartition(d,1)
        self.assert_partitioned(np.array(d)[p],[1])

    def test_flatten(self):
        x0 = np.array([[1, 2, 3], [4, 5, 6]], np.int32)
        x1 = np.array([[[1, 2], [3, 4]], [[5, 6], [7, 8]]], np.int32)
        y0 = np.array([1, 2, 3, 4, 5, 6], np.int32)
        y0f = np.array([1, 4, 2, 5, 3, 6], np.int32)
        y1 = np.array([1, 2, 3, 4, 5, 6, 7, 8], np.int32)
        y1f = np.array([1, 5, 3, 7, 2, 6, 4, 8], np.int32)
        assert_equal(x0.flatten(), y0)
        assert_equal(x0.flatten('F'), y0f)
        assert_equal(x0.flatten('F'), x0.T.flatten())
        assert_equal(x1.flatten(), y1)
        assert_equal(x1.flatten('F'), y1f)
        assert_equal(x1.flatten('F'), x1.T.flatten())

    def test_dot(self):
        a = np.array([[1, 0], [0, 1]])
        b = np.array([[0, 1], [1, 0]])
        c = np.array([[9, 1], [1, -9]])
        d = np.arange(24).reshape(4, 6)
        ddt = np.array(
            [[  55,  145,  235,  325],
             [ 145,  451,  757, 1063],
             [ 235,  757, 1279, 1801],
             [ 325, 1063, 1801, 2539]]
        )
        dtd = np.array(
            [[504, 540, 576, 612, 648, 684],
             [540, 580, 620, 660, 700, 740],
             [576, 620, 664, 708, 752, 796],
             [612, 660, 708, 756, 804, 852],
             [648, 700, 752, 804, 856, 908],
             [684, 740, 796, 852, 908, 964]]
        )


        # gemm vs syrk optimizations
        for et in [np.float32, np.float64, np.complex64, np.complex128]:
            eaf = a.astype(et)
            assert_equal(np.dot(eaf, eaf), eaf)
            assert_equal(np.dot(eaf.T, eaf), eaf)
            assert_equal(np.dot(eaf, eaf.T), eaf)
            assert_equal(np.dot(eaf.T, eaf.T), eaf)
            assert_equal(np.dot(eaf.T.copy(), eaf), eaf)
            assert_equal(np.dot(eaf, eaf.T.copy()), eaf)
            assert_equal(np.dot(eaf.T.copy(), eaf.T.copy()), eaf)

        # syrk validations
        for et in [np.float32, np.float64, np.complex64, np.complex128]:
            eaf = a.astype(et)
            ebf = b.astype(et)
            assert_equal(np.dot(ebf, ebf), eaf)
            assert_equal(np.dot(ebf.T, ebf), eaf)
            assert_equal(np.dot(ebf, ebf.T), eaf)
            assert_equal(np.dot(ebf.T, ebf.T), eaf)

        # syrk - different shape, stride, and view validations
        for et in [np.float32, np.float64, np.complex64, np.complex128]:
            edf = d.astype(et)
            assert_equal(
                np.dot(edf[::-1, :], edf.T),
                np.dot(edf[::-1, :].copy(), edf.T.copy())
            )
            assert_equal(
                np.dot(edf[:, ::-1], edf.T),
                np.dot(edf[:, ::-1].copy(), edf.T.copy())
            )
            assert_equal(
                np.dot(edf, edf[::-1, :].T),
                np.dot(edf, edf[::-1, :].T.copy())
            )
            assert_equal(
                np.dot(edf, edf[:, ::-1].T),
                np.dot(edf, edf[:, ::-1].T.copy())
            )
            assert_equal(
                np.dot(edf[:edf.shape[0] // 2, :], edf[::2, :].T),
                np.dot(edf[:edf.shape[0] // 2, :].copy(), edf[::2, :].T.copy())
            )
            assert_equal(
                np.dot(edf[::2, :], edf[:edf.shape[0] // 2, :].T),
                np.dot(edf[::2, :].copy(), edf[:edf.shape[0] // 2, :].T.copy())
            )

        # syrk - different shape
        for et in [np.float32, np.float64, np.complex64, np.complex128]:
            edf = d.astype(et)
            eddtf = ddt.astype(et)
            edtdf = dtd.astype(et)
            assert_equal(np.dot(edf, edf.T), eddtf)
            assert_equal(np.dot(edf.T, edf), edtdf)

        # function versus methods
        assert_equal(np.dot(a, b), a.dot(b))
        assert_equal(np.dot(np.dot(a, b), c), a.dot(b).dot(c))

        # test passing in an output array
        c = np.zeros_like(a)
        a.dot(b, c)
        assert_equal(c, np.dot(a, b))

        # test keyword args
        c = np.zeros_like(a)
        a.dot(b=b, out=c)
        assert_equal(c, np.dot(a, b))

    def test_dot_type_mismatch(self):
        c = 1.
        A = np.array((1,1), dtype='i,i')

        assert_raises(TypeError, np.dot, c, A)
        assert_raises(TypeError, np.dot, A, c)

    def test_dot_out_mem_overlap(self):
        np.random.seed(1)

        # Test BLAS and non-BLAS code paths, including all dtypes
        # that dot() supports
        dtypes = [np.dtype(code) for code in np.typecodes['All']
                  if code not in 'USVM']
        for dtype in dtypes:
            a = np.random.rand(3, 3).astype(dtype)

            # Valid dot() output arrays must be aligned
            b = _aligned_zeros((3, 3), dtype=dtype)
            b[...] = np.random.rand(3, 3)

            y = np.dot(a, b)
            x = np.dot(a, b, out=b)
            assert_equal(x, y, err_msg=repr(dtype))

            # Check invalid output array
            assert_raises(ValueError, np.dot, a, b, out=b[::2])
            assert_raises(ValueError, np.dot, a, b, out=b.T)

    def test_diagonal(self):
        a = np.arange(12).reshape((3, 4))
        assert_equal(a.diagonal(), [0, 5, 10])
        assert_equal(a.diagonal(0), [0, 5, 10])
        assert_equal(a.diagonal(1), [1, 6, 11])
        assert_equal(a.diagonal(-1), [4, 9])

        b = np.arange(8).reshape((2, 2, 2))
        assert_equal(b.diagonal(), [[0, 6], [1, 7]])
        assert_equal(b.diagonal(0), [[0, 6], [1, 7]])
        assert_equal(b.diagonal(1), [[2], [3]])
        assert_equal(b.diagonal(-1), [[4], [5]])
        assert_raises(ValueError, b.diagonal, axis1=0, axis2=0)
        assert_equal(b.diagonal(0, 1, 2), [[0, 3], [4, 7]])
        assert_equal(b.diagonal(0, 0, 1), [[0, 6], [1, 7]])
        assert_equal(b.diagonal(offset=1, axis1=0, axis2=2), [[1], [3]])
        # Order of axis argument doesn't matter:
        assert_equal(b.diagonal(0, 2, 1), [[0, 3], [4, 7]])

    def test_diagonal_view_notwriteable(self):
        # this test is only for 1.9, the diagonal view will be
        # writeable in 1.10.
        a = np.eye(3).diagonal()
        assert_(not a.flags.writeable)
        assert_(not a.flags.owndata)

        a = np.diagonal(np.eye(3))
        assert_(not a.flags.writeable)
        assert_(not a.flags.owndata)

        a = np.diag(np.eye(3))
        assert_(not a.flags.writeable)
        assert_(not a.flags.owndata)

    def test_diagonal_memleak(self):
        # Regression test for a bug that crept in at one point
        a = np.zeros((100, 100))
        if HAS_REFCOUNT:
            assert_(sys.getrefcount(a) < 50)
        for i in range(100):
            a.diagonal()
        if HAS_REFCOUNT:
            assert_(sys.getrefcount(a) < 50)

    def test_trace(self):
        a = np.arange(12).reshape((3, 4))
        assert_equal(a.trace(), 15)
        assert_equal(a.trace(0), 15)
        assert_equal(a.trace(1), 18)
        assert_equal(a.trace(-1), 13)

        b = np.arange(8).reshape((2, 2, 2))
        assert_equal(b.trace(), [6, 8])
        assert_equal(b.trace(0), [6, 8])
        assert_equal(b.trace(1), [2, 3])
        assert_equal(b.trace(-1), [4, 5])
        assert_equal(b.trace(0, 0, 1), [6, 8])
        assert_equal(b.trace(0, 0, 2), [5, 9])
        assert_equal(b.trace(0, 1, 2), [3, 11])
        assert_equal(b.trace(offset=1, axis1=0, axis2=2), [1, 3])

    def test_trace_subclass(self):
        # The class would need to overwrite trace to ensure single-element
        # output also has the right subclass.
        class MyArray(np.ndarray):
            pass

        b = np.arange(8).reshape((2, 2, 2)).view(MyArray)
        t = b.trace()
        assert isinstance(t, MyArray)

    def test_put(self):
        icodes = np.typecodes['AllInteger']
        fcodes = np.typecodes['AllFloat']
        for dt in icodes + fcodes + 'O':
            tgt = np.array([0, 1, 0, 3, 0, 5], dtype=dt)

            # test 1-d
            a = np.zeros(6, dtype=dt)
            a.put([1, 3, 5], [1, 3, 5])
            assert_equal(a, tgt)

            # test 2-d
            a = np.zeros((2, 3), dtype=dt)
            a.put([1, 3, 5], [1, 3, 5])
            assert_equal(a, tgt.reshape(2, 3))

        for dt in '?':
            tgt = np.array([False, True, False, True, False, True], dtype=dt)

            # test 1-d
            a = np.zeros(6, dtype=dt)
            a.put([1, 3, 5], [True]*3)
            assert_equal(a, tgt)

            # test 2-d
            a = np.zeros((2, 3), dtype=dt)
            a.put([1, 3, 5], [True]*3)
            assert_equal(a, tgt.reshape(2, 3))

        # check must be writeable
        a = np.zeros(6)
        a.flags.writeable = False
        assert_raises(ValueError, a.put, [1, 3, 5], [1, 3, 5])

        # when calling np.put, make sure a
        # TypeError is raised if the object
        # isn't an ndarray
        bad_array = [1, 2, 3]
        assert_raises(TypeError, np.put, bad_array, [0, 2], 5)

    def test_ravel(self):
        a = np.array([[0, 1], [2, 3]])
        assert_equal(a.ravel(), [0, 1, 2, 3])
        assert_(not a.ravel().flags.owndata)
        assert_equal(a.ravel('F'), [0, 2, 1, 3])
        assert_equal(a.ravel(order='C'), [0, 1, 2, 3])
        assert_equal(a.ravel(order='F'), [0, 2, 1, 3])
        assert_equal(a.ravel(order='A'), [0, 1, 2, 3])
        assert_(not a.ravel(order='A').flags.owndata)
        assert_equal(a.ravel(order='K'), [0, 1, 2, 3])
        assert_(not a.ravel(order='K').flags.owndata)
        assert_equal(a.ravel(), a.reshape(-1))

        a = np.array([[0, 1], [2, 3]], order='F')
        assert_equal(a.ravel(), [0, 1, 2, 3])
        assert_equal(a.ravel(order='A'), [0, 2, 1, 3])
        assert_equal(a.ravel(order='K'), [0, 2, 1, 3])
        assert_(not a.ravel(order='A').flags.owndata)
        assert_(not a.ravel(order='K').flags.owndata)
        assert_equal(a.ravel(), a.reshape(-1))
        assert_equal(a.ravel(order='A'), a.reshape(-1, order='A'))

        a = np.array([[0, 1], [2, 3]])[::-1, :]
        assert_equal(a.ravel(), [2, 3, 0, 1])
        assert_equal(a.ravel(order='C'), [2, 3, 0, 1])
        assert_equal(a.ravel(order='F'), [2, 0, 3, 1])
        assert_equal(a.ravel(order='A'), [2, 3, 0, 1])
        # 'K' doesn't reverse the axes of negative strides
        assert_equal(a.ravel(order='K'), [2, 3, 0, 1])
        assert_(a.ravel(order='K').flags.owndata)

        # Test simple 1-d copy behaviour:
        a = np.arange(10)[::2]
        assert_(a.ravel('K').flags.owndata)
        assert_(a.ravel('C').flags.owndata)
        assert_(a.ravel('F').flags.owndata)

        # Not contiguous and 1-sized axis with non matching stride
        a = np.arange(2**3 * 2)[::2]
        a = a.reshape(2, 1, 2, 2).swapaxes(-1, -2)
        strides = list(a.strides)
        strides[1] = 123
        a.strides = strides
        assert_(a.ravel(order='K').flags.owndata)
        assert_equal(a.ravel('K'), np.arange(0, 15, 2))

        # contiguous and 1-sized axis with non matching stride works:
        a = np.arange(2**3)
        a = a.reshape(2, 1, 2, 2).swapaxes(-1, -2)
        strides = list(a.strides)
        strides[1] = 123
        a.strides = strides
        assert_(np.may_share_memory(a.ravel(order='K'), a))
        assert_equal(a.ravel(order='K'), np.arange(2**3))

        # Test negative strides (not very interesting since non-contiguous):
        a = np.arange(4)[::-1].reshape(2, 2)
        assert_(a.ravel(order='C').flags.owndata)
        assert_(a.ravel(order='K').flags.owndata)
        assert_equal(a.ravel('C'), [3, 2, 1, 0])
        assert_equal(a.ravel('K'), [3, 2, 1, 0])

        # 1-element tidy strides test (NPY_RELAXED_STRIDES_CHECKING):
        a = np.array([[1]])
        a.strides = (123, 432)
        # If the stride is not 8, NPY_RELAXED_STRIDES_CHECKING is messing
        # them up on purpose:
        if np.ones(1).strides == (8,):
            assert_(np.may_share_memory(a.ravel('K'), a))
            assert_equal(a.ravel('K').strides, (a.dtype.itemsize,))

        for order in ('C', 'F', 'A', 'K'):
            # 0-d corner case:
            a = np.array(0)
            assert_equal(a.ravel(order), [0])
            assert_(np.may_share_memory(a.ravel(order), a))

        # Test that certain non-inplace ravels work right (mostly) for 'K':
        b = np.arange(2**4 * 2)[::2].reshape(2, 2, 2, 2)
        a = b[..., ::2]
        assert_equal(a.ravel('K'), [0, 4, 8, 12, 16, 20, 24, 28])
        assert_equal(a.ravel('C'), [0, 4, 8, 12, 16, 20, 24, 28])
        assert_equal(a.ravel('A'), [0, 4, 8, 12, 16, 20, 24, 28])
        assert_equal(a.ravel('F'), [0, 16, 8, 24, 4, 20, 12, 28])

        a = b[::2, ...]
        assert_equal(a.ravel('K'), [0, 2, 4, 6, 8, 10, 12, 14])
        assert_equal(a.ravel('C'), [0, 2, 4, 6, 8, 10, 12, 14])
        assert_equal(a.ravel('A'), [0, 2, 4, 6, 8, 10, 12, 14])
        assert_equal(a.ravel('F'), [0, 8, 4, 12, 2, 10, 6, 14])

    def test_ravel_subclass(self):
        class ArraySubclass(np.ndarray):
            pass

        a = np.arange(10).view(ArraySubclass)
        assert_(isinstance(a.ravel('C'), ArraySubclass))
        assert_(isinstance(a.ravel('F'), ArraySubclass))
        assert_(isinstance(a.ravel('A'), ArraySubclass))
        assert_(isinstance(a.ravel('K'), ArraySubclass))

        a = np.arange(10)[::2].view(ArraySubclass)
        assert_(isinstance(a.ravel('C'), ArraySubclass))
        assert_(isinstance(a.ravel('F'), ArraySubclass))
        assert_(isinstance(a.ravel('A'), ArraySubclass))
        assert_(isinstance(a.ravel('K'), ArraySubclass))

    def test_swapaxes(self):
        a = np.arange(1*2*3*4).reshape(1, 2, 3, 4).copy()
        idx = np.indices(a.shape)
        assert_(a.flags['OWNDATA'])
        b = a.copy()
        # check exceptions
        assert_raises(ValueError, a.swapaxes, -5, 0)
        assert_raises(ValueError, a.swapaxes, 4, 0)
        assert_raises(ValueError, a.swapaxes, 0, -5)
        assert_raises(ValueError, a.swapaxes, 0, 4)

        for i in range(-4, 4):
            for j in range(-4, 4):
                for k, src in enumerate((a, b)):
                    c = src.swapaxes(i, j)
                    # check shape
                    shape = list(src.shape)
                    shape[i] = src.shape[j]
                    shape[j] = src.shape[i]
                    assert_equal(c.shape, shape, str((i, j, k)))
                    # check array contents
                    i0, i1, i2, i3 = [dim-1 for dim in c.shape]
                    j0, j1, j2, j3 = [dim-1 for dim in src.shape]
                    assert_equal(src[idx[j0], idx[j1], idx[j2], idx[j3]],
                                 c[idx[i0], idx[i1], idx[i2], idx[i3]],
                                 str((i, j, k)))
                    # check a view is always returned, gh-5260
                    assert_(not c.flags['OWNDATA'], str((i, j, k)))
                    # check on non-contiguous input array
                    if k == 1:
                        b = c

    def test_conjugate(self):
        a = np.array([1-1j, 1+1j, 23+23.0j])
        ac = a.conj()
        assert_equal(a.real, ac.real)
        assert_equal(a.imag, -ac.imag)
        assert_equal(ac, a.conjugate())
        assert_equal(ac, np.conjugate(a))

        a = np.array([1-1j, 1+1j, 23+23.0j], 'F')
        ac = a.conj()
        assert_equal(a.real, ac.real)
        assert_equal(a.imag, -ac.imag)
        assert_equal(ac, a.conjugate())
        assert_equal(ac, np.conjugate(a))

        a = np.array([1, 2, 3])
        ac = a.conj()
        assert_equal(a, ac)
        assert_equal(ac, a.conjugate())
        assert_equal(ac, np.conjugate(a))

        a = np.array([1.0, 2.0, 3.0])
        ac = a.conj()
        assert_equal(a, ac)
        assert_equal(ac, a.conjugate())
        assert_equal(ac, np.conjugate(a))

        a = np.array([1-1j, 1+1j, 1, 2.0], object)
        ac = a.conj()
        assert_equal(ac, [k.conjugate() for k in a])
        assert_equal(ac, a.conjugate())
        assert_equal(ac, np.conjugate(a))

        a = np.array([1-1j, 1, 2.0, 'f'], object)
        assert_raises(AttributeError, lambda: a.conj())
        assert_raises(AttributeError, lambda: a.conjugate())

    def test__complex__(self):
        dtypes = ['i1', 'i2', 'i4', 'i8',
                  'u1', 'u2', 'u4', 'u8',
                  'f', 'd', 'g', 'F', 'D', 'G',
                  '?', 'O']
        for dt in dtypes:
            a = np.array(7, dtype=dt)
            b = np.array([7], dtype=dt)
            c = np.array([[[[[7]]]]], dtype=dt)

            msg = 'dtype: {0}'.format(dt)
            ap = complex(a)
            assert_equal(ap, a, msg)
            bp = complex(b)
            assert_equal(bp, b, msg)
            cp = complex(c)
            assert_equal(cp, c, msg)

    def test__complex__should_not_work(self):
        dtypes = ['i1', 'i2', 'i4', 'i8',
                  'u1', 'u2', 'u4', 'u8',
                  'f', 'd', 'g', 'F', 'D', 'G',
                  '?', 'O']
        for dt in dtypes:
            a = np.array([1, 2, 3], dtype=dt)
            assert_raises(TypeError, complex, a)

        dt = np.dtype([('a', 'f8'), ('b', 'i1')])
        b = np.array((1.0, 3), dtype=dt)
        assert_raises(TypeError, complex, b)

        c = np.array([(1.0, 3), (2e-3, 7)], dtype=dt)
        assert_raises(TypeError, complex, c)

        d = np.array('1+1j')
        assert_raises(TypeError, complex, d)

        e = np.array(['1+1j'], 'U')
        assert_raises(TypeError, complex, e)


class TestBinop(object):
    def test_inplace(self):
        # test refcount 1 inplace conversion
        assert_array_almost_equal(np.array([0.5]) * np.array([1.0, 2.0]),
                                  [0.5, 1.0])

        d = np.array([0.5, 0.5])[::2]
        assert_array_almost_equal(d * (d * np.array([1.0, 2.0])),
                                  [0.25, 0.5])

        a = np.array([0.5])
        b = np.array([0.5])
        c = a + b
        c = a - b
        c = a * b
        c = a / b
        assert_equal(a, b)
        assert_almost_equal(c, 1.)

        c = a + b * 2. / b * a - a / b
        assert_equal(a, b)
        assert_equal(c, 0.5)

        # true divide
        a = np.array([5])
        b = np.array([3])
        c = (a * a) / b

        assert_almost_equal(c, 25 / 3)
        assert_equal(a, 5)
        assert_equal(b, 3)

    # ndarray.__rop__ always calls ufunc
    # ndarray.__iop__ always calls ufunc
    # ndarray.__op__, __rop__:
    #   - defer if other has __array_ufunc__ and it is None
    #           or other is not a subclass and has higher array priority
    #   - else, call ufunc
    def test_ufunc_binop_interaction(self):
        # Python method name (without underscores)
        #   -> (numpy ufunc, has_in_place_version, preferred_dtype)
        ops = {
            'add':      (np.add, True, float),
            'sub':      (np.subtract, True, float),
            'mul':      (np.multiply, True, float),
            'truediv':  (np.true_divide, True, float),
            'floordiv': (np.floor_divide, True, float),
            'mod':      (np.remainder, True, float),
            'divmod':   (np.divmod, False, float),
            'pow':      (np.power, True, int),
            'lshift':   (np.left_shift, True, int),
            'rshift':   (np.right_shift, True, int),
            'and':      (np.bitwise_and, True, int),
            'xor':      (np.bitwise_xor, True, int),
            'or':       (np.bitwise_or, True, int),
            # 'ge':       (np.less_equal, False),
            # 'gt':       (np.less, False),
            # 'le':       (np.greater_equal, False),
            # 'lt':       (np.greater, False),
            # 'eq':       (np.equal, False),
            # 'ne':       (np.not_equal, False),
        }

        class Coerced(Exception):
            pass

        def array_impl(self):
            raise Coerced

        def op_impl(self, other):
            return "forward"

        def rop_impl(self, other):
            return "reverse"

        def iop_impl(self, other):
            return "in-place"

        def array_ufunc_impl(self, ufunc, method, *args, **kwargs):
            return ("__array_ufunc__", ufunc, method, args, kwargs)

        # Create an object with the given base, in the given module, with a
        # bunch of placeholder __op__ methods, and optionally a
        # __array_ufunc__ and __array_priority__.
        def make_obj(base, array_priority=False, array_ufunc=False,
                     alleged_module="__main__"):
            class_namespace = {"__array__": array_impl}
            if array_priority is not False:
                class_namespace["__array_priority__"] = array_priority
            for op in ops:
                class_namespace["__{0}__".format(op)] = op_impl
                class_namespace["__r{0}__".format(op)] = rop_impl
                class_namespace["__i{0}__".format(op)] = iop_impl
            if array_ufunc is not False:
                class_namespace["__array_ufunc__"] = array_ufunc
            eval_namespace = {"base": base,
                              "class_namespace": class_namespace,
                              "__name__": alleged_module,
                              }
            MyType = eval("type('MyType', (base,), class_namespace)",
                          eval_namespace)
            if issubclass(MyType, np.ndarray):
                # Use this range to avoid special case weirdnesses around
                # divide-by-0, pow(x, 2), overflow due to pow(big, big), etc.
                return np.arange(3, 5).view(MyType)
            else:
                return MyType()

        def check(obj, binop_override_expected, ufunc_override_expected,
                  inplace_override_expected, check_scalar=True):
            for op, (ufunc, has_inplace, dtype) in ops.items():
                err_msg = ('op: %s, ufunc: %s, has_inplace: %s, dtype: %s'
                           % (op, ufunc, has_inplace, dtype))
                check_objs = [np.arange(3, 5, dtype=dtype)]
                if check_scalar:
                    check_objs.append(check_objs[0][0])
                for arr in check_objs:
                    arr_method = getattr(arr, "__{0}__".format(op))

                    def first_out_arg(result):
                        if op == "divmod":
                            assert_(isinstance(result, tuple))
                            return result[0]
                        else:
                            return result

                    # arr __op__ obj
                    if binop_override_expected:
                        assert_equal(arr_method(obj), NotImplemented, err_msg)
                    elif ufunc_override_expected:
                        assert_equal(arr_method(obj)[0], "__array_ufunc__",
                                     err_msg)
                    else:
                        if (isinstance(obj, np.ndarray) and
                            (type(obj).__array_ufunc__ is
                             np.ndarray.__array_ufunc__)):
                            # __array__ gets ignored
                            res = first_out_arg(arr_method(obj))
                            assert_(res.__class__ is obj.__class__, err_msg)
                        else:
                            assert_raises((TypeError, Coerced),
                                          arr_method, obj, err_msg=err_msg)
                    # obj __op__ arr
                    arr_rmethod = getattr(arr, "__r{0}__".format(op))
                    if ufunc_override_expected:
                        res = arr_rmethod(obj)
                        assert_equal(res[0], "__array_ufunc__",
                                     err_msg=err_msg)
                        assert_equal(res[1], ufunc, err_msg=err_msg)
                    else:
                        if (isinstance(obj, np.ndarray) and
                                (type(obj).__array_ufunc__ is
                                 np.ndarray.__array_ufunc__)):
                            # __array__ gets ignored
                            res = first_out_arg(arr_rmethod(obj))
                            assert_(res.__class__ is obj.__class__, err_msg)
                        else:
                            # __array_ufunc__ = "asdf" creates a TypeError
                            assert_raises((TypeError, Coerced),
                                          arr_rmethod, obj, err_msg=err_msg)

                    # arr __iop__ obj
                    # array scalars don't have in-place operators
                    if has_inplace and isinstance(arr, np.ndarray):
                        arr_imethod = getattr(arr, "__i{0}__".format(op))
                        if inplace_override_expected:
                            assert_equal(arr_method(obj), NotImplemented,
                                         err_msg=err_msg)
                        elif ufunc_override_expected:
                            res = arr_imethod(obj)
                            assert_equal(res[0], "__array_ufunc__", err_msg)
                            assert_equal(res[1], ufunc, err_msg)
                            assert_(type(res[-1]["out"]) is tuple, err_msg)
                            assert_(res[-1]["out"][0] is arr, err_msg)
                        else:
                            if (isinstance(obj, np.ndarray) and
                                    (type(obj).__array_ufunc__ is
                                    np.ndarray.__array_ufunc__)):
                                # __array__ gets ignored
                                assert_(arr_imethod(obj) is arr, err_msg)
                            else:
                                assert_raises((TypeError, Coerced),
                                              arr_imethod, obj,
                                              err_msg=err_msg)

                    op_fn = getattr(operator, op, None)
                    if op_fn is None:
                        op_fn = getattr(operator, op + "_", None)
                    if op_fn is None:
                        op_fn = getattr(builtins, op)
                    assert_equal(op_fn(obj, arr), "forward", err_msg)
                    if not isinstance(obj, np.ndarray):
                        if binop_override_expected:
                            assert_equal(op_fn(arr, obj), "reverse", err_msg)
                        elif ufunc_override_expected:
                            assert_equal(op_fn(arr, obj)[0], "__array_ufunc__",
                                         err_msg)
                    if ufunc_override_expected:
                        assert_equal(ufunc(obj, arr)[0], "__array_ufunc__",
                                     err_msg)

        # No array priority, no array_ufunc -> nothing called
        check(make_obj(object), False, False, False)
        # Negative array priority, no array_ufunc -> nothing called
        # (has to be very negative, because scalar priority is -1000000.0)
        check(make_obj(object, array_priority=-2**30), False, False, False)
        # Positive array priority, no array_ufunc -> binops and iops only
        check(make_obj(object, array_priority=1), True, False, True)
        # ndarray ignores array_priority for ndarray subclasses
        check(make_obj(np.ndarray, array_priority=1), False, False, False,
              check_scalar=False)
        # Positive array_priority and array_ufunc -> array_ufunc only
        check(make_obj(object, array_priority=1,
                       array_ufunc=array_ufunc_impl), False, True, False)
        check(make_obj(np.ndarray, array_priority=1,
                       array_ufunc=array_ufunc_impl), False, True, False)
        # array_ufunc set to None -> defer binops only
        check(make_obj(object, array_ufunc=None), True, False, False)
        check(make_obj(np.ndarray, array_ufunc=None), True, False, False,
              check_scalar=False)

    def test_ufunc_override_normalize_signature(self):
        # gh-5674
        class SomeClass(object):
            def __array_ufunc__(self, ufunc, method, *inputs, **kw):
                return kw

        a = SomeClass()
        kw = np.add(a, [1])
        assert_('sig' not in kw and 'signature' not in kw)
        kw = np.add(a, [1], sig='ii->i')
        assert_('sig' not in kw and 'signature' in kw)
        assert_equal(kw['signature'], 'ii->i')
        kw = np.add(a, [1], signature='ii->i')
        assert_('sig' not in kw and 'signature' in kw)
        assert_equal(kw['signature'], 'ii->i')

    def test_array_ufunc_index(self):
        # Check that index is set appropriately, also if only an output
        # is passed on (latter is another regression tests for github bug 4753)
        # This also checks implicitly that 'out' is always a tuple.
        class CheckIndex(object):
            def __array_ufunc__(self, ufunc, method, *inputs, **kw):
                for i, a in enumerate(inputs):
                    if a is self:
                        return i
                # calls below mean we must be in an output.
                for j, a in enumerate(kw['out']):
                    if a is self:
                        return (j,)

        a = CheckIndex()
        dummy = np.arange(2.)
        # 1 input, 1 output
        assert_equal(np.sin(a), 0)
        assert_equal(np.sin(dummy, a), (0,))
        assert_equal(np.sin(dummy, out=a), (0,))
        assert_equal(np.sin(dummy, out=(a,)), (0,))
        assert_equal(np.sin(a, a), 0)
        assert_equal(np.sin(a, out=a), 0)
        assert_equal(np.sin(a, out=(a,)), 0)
        # 1 input, 2 outputs
        assert_equal(np.modf(dummy, a), (0,))
        assert_equal(np.modf(dummy, None, a), (1,))
        assert_equal(np.modf(dummy, dummy, a), (1,))
        assert_equal(np.modf(dummy, out=(a, None)), (0,))
        assert_equal(np.modf(dummy, out=(a, dummy)), (0,))
        assert_equal(np.modf(dummy, out=(None, a)), (1,))
        assert_equal(np.modf(dummy, out=(dummy, a)), (1,))
        assert_equal(np.modf(a, out=(dummy, a)), 0)
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', DeprecationWarning)
            assert_equal(np.modf(dummy, out=a), (0,))
            assert_(w[0].category is DeprecationWarning)
        assert_raises(ValueError, np.modf, dummy, out=(a,))

        # 2 inputs, 1 output
        assert_equal(np.add(a, dummy), 0)
        assert_equal(np.add(dummy, a), 1)
        assert_equal(np.add(dummy, dummy, a), (0,))
        assert_equal(np.add(dummy, a, a), 1)
        assert_equal(np.add(dummy, dummy, out=a), (0,))
        assert_equal(np.add(dummy, dummy, out=(a,)), (0,))
        assert_equal(np.add(a, dummy, out=a), 0)

    def test_out_override(self):
        # regression test for github bug 4753
        class OutClass(np.ndarray):
            def __array_ufunc__(self, ufunc, method, *inputs, **kw):
                if 'out' in kw:
                    tmp_kw = kw.copy()
                    tmp_kw.pop('out')
                    func = getattr(ufunc, method)
                    kw['out'][0][...] = func(*inputs, **tmp_kw)

        A = np.array([0]).view(OutClass)
        B = np.array([5])
        C = np.array([6])
        np.multiply(C, B, A)
        assert_equal(A[0], 30)
        assert_(isinstance(A, OutClass))
        A[0] = 0
        np.multiply(C, B, out=A)
        assert_equal(A[0], 30)
        assert_(isinstance(A, OutClass))

    def test_pow_override_with_errors(self):
        # regression test for gh-9112
        class PowerOnly(np.ndarray):
            def __array_ufunc__(self, ufunc, method, *inputs, **kw):
                if ufunc is not np.power:
                    raise NotImplementedError
                return "POWER!"
        # explicit cast to float, to ensure the fast power path is taken.
        a = np.array(5., dtype=np.float64).view(PowerOnly)
        assert_equal(a ** 2.5, "POWER!")
        with assert_raises(NotImplementedError):
            a ** 0.5
        with assert_raises(NotImplementedError):
            a ** 0
        with assert_raises(NotImplementedError):
            a ** 1
        with assert_raises(NotImplementedError):
            a ** -1
        with assert_raises(NotImplementedError):
            a ** 2


class TestTemporaryElide(TestCase):
    # elision is only triggered on relatively large arrays

    def test_extension_incref_elide(self):
        # test extension (e.g. cython) calling PyNumber_* slots without
        # increasing the reference counts
        #
        # def incref_elide(a):
        #    d = input.copy() # refcount 1
        #    return d, d + d # PyNumber_Add without increasing refcount
        from numpy.core.multiarray_tests import incref_elide
        d = np.ones(100000)
        orig, res = incref_elide(d)
        d + d
        # the return original should not be changed to an inplace operation
        assert_array_equal(orig, d)
        assert_array_equal(res, d + d)

    def test_extension_incref_elide_stack(self):
        # scanning if the refcount == 1 object is on the python stack to check
        # that we are called directly from python is flawed as object may still
        # be above the stack pointer and we have no access to the top of it
        #
        # def incref_elide_l(d):
        #    return l[4] + l[4] # PyNumber_Add without increasing refcount
        from numpy.core.multiarray_tests import incref_elide_l
        # padding with 1 makes sure the object on the stack is not overwriten
        l = [1, 1, 1, 1, np.ones(100000)]
        res = incref_elide_l(l)
        # the return original should not be changed to an inplace operation
        assert_array_equal(l[4], np.ones(100000))
        assert_array_equal(res, l[4] + l[4])

    def test_temporary_with_cast(self):
        # check that we don't elide into a temporary which would need casting
        d = np.ones(200000, dtype=np.int64)
        assert_equal(((d + d) + 2**222).dtype, np.dtype('O'))

        r = ((d + d) / 2)
        assert_equal(r.dtype, np.dtype('f8'))

        r = np.true_divide((d + d), 2)
        assert_equal(r.dtype, np.dtype('f8'))

        r = ((d + d) / 2.)
        assert_equal(r.dtype, np.dtype('f8'))

        r = ((d + d) // 2)
        assert_equal(r.dtype, np.dtype(np.int64))

        # commutative elision into the astype result
        f = np.ones(100000, dtype=np.float32)
        assert_equal(((f + f) + f.astype(np.float64)).dtype, np.dtype('f8'))

        # no elision into lower type
        d = f.astype(np.float64)
        assert_equal(((f + f) + d).dtype, d.dtype)
        l = np.ones(100000, dtype=np.longdouble)
        assert_equal(((d + d) + l).dtype, l.dtype)

        # test unary abs with different output dtype
        for dt in (np.complex64, np.complex128, np.clongdouble):
            c = np.ones(100000, dtype=dt)
            r = abs(c * 2.0)
            assert_equal(r.dtype, np.dtype('f%d' % (c.itemsize // 2)))

    def test_elide_broadcast(self):
        # test no elision on broadcast to higher dimension
        # only triggers elision code path in debug mode as triggering it in
        # normal mode needs 256kb large matching dimension, so a lot of memory
        d = np.ones((2000, 1), dtype=int)
        b = np.ones((2000), dtype=np.bool)
        r = (1 - d) + b
        assert_equal(r, 1)
        assert_equal(r.shape, (2000, 2000))

    def test_elide_scalar(self):
        # check inplace op does not create ndarray from scalars
        a = np.bool_()
        assert_(type(~(a & a)) is np.bool_)


class TestCAPI(TestCase):
    def test_IsPythonScalar(self):
        from numpy.core.multiarray_tests import IsPythonScalar
        assert_(IsPythonScalar(b'foobar'))
        assert_(IsPythonScalar(1))
        assert_(IsPythonScalar(2**80))
        assert_(IsPythonScalar(2.))
        assert_(IsPythonScalar("a"))


class TestSubscripting(TestCase):
    def test_test_zero_rank(self):
        x = np.array([1, 2, 3])
        self.assertTrue(isinstance(x[0], np.int_))
        if sys.version_info[0] < 3:
            self.assertTrue(isinstance(x[0], int))
        self.assertTrue(type(x[0, ...]) is np.ndarray)


class TestPickling(TestCase):
    def test_roundtrip(self):
        import pickle
        carray = np.array([[2, 9], [7, 0], [3, 8]])
        DATA = [
            carray,
            np.transpose(carray),
            np.array([('xxx', 1, 2.0)], dtype=[('a', (str, 3)), ('b', int),
                                               ('c', float)])
        ]

        for a in DATA:
            assert_equal(a, pickle.loads(a.dumps()), err_msg="%r" % a)

    def _loads(self, obj):
        if sys.version_info[0] >= 3:
            return np.loads(obj, encoding='latin1')
        else:
            return np.loads(obj)

    # version 0 pickles, using protocol=2 to pickle
    # version 0 doesn't have a version field
    def test_version0_int8(self):
        s = b'\x80\x02cnumpy.core._internal\n_reconstruct\nq\x01cnumpy\nndarray\nq\x02K\x00\x85U\x01b\x87Rq\x03(K\x04\x85cnumpy\ndtype\nq\x04U\x02i1K\x00K\x01\x87Rq\x05(U\x01|NNJ\xff\xff\xff\xffJ\xff\xff\xff\xfftb\x89U\x04\x01\x02\x03\x04tb.'
        a = np.array([1, 2, 3, 4], dtype=np.int8)
        p = self._loads(s)
        assert_equal(a, p)

    def test_version0_float32(self):
        s = b'\x80\x02cnumpy.core._internal\n_reconstruct\nq\x01cnumpy\nndarray\nq\x02K\x00\x85U\x01b\x87Rq\x03(K\x04\x85cnumpy\ndtype\nq\x04U\x02f4K\x00K\x01\x87Rq\x05(U\x01<NNJ\xff\xff\xff\xffJ\xff\xff\xff\xfftb\x89U\x10\x00\x00\x80?\x00\x00\x00@\x00\x00@@\x00\x00\x80@tb.'
        a = np.array([1.0, 2.0, 3.0, 4.0], dtype=np.float32)
        p = self._loads(s)
        assert_equal(a, p)

    def test_version0_object(self):
        s = b'\x80\x02cnumpy.core._internal\n_reconstruct\nq\x01cnumpy\nndarray\nq\x02K\x00\x85U\x01b\x87Rq\x03(K\x02\x85cnumpy\ndtype\nq\x04U\x02O8K\x00K\x01\x87Rq\x05(U\x01|NNJ\xff\xff\xff\xffJ\xff\xff\xff\xfftb\x89]q\x06(}q\x07U\x01aK\x01s}q\x08U\x01bK\x02setb.'
        a = np.array([{'a': 1}, {'b': 2}])
        p = self._loads(s)
        assert_equal(a, p)

    # version 1 pickles, using protocol=2 to pickle
    def test_version1_int8(self):
        s = b'\x80\x02cnumpy.core._internal\n_reconstruct\nq\x01cnumpy\nndarray\nq\x02K\x00\x85U\x01b\x87Rq\x03(K\x01K\x04\x85cnumpy\ndtype\nq\x04U\x02i1K\x00K\x01\x87Rq\x05(K\x01U\x01|NNJ\xff\xff\xff\xffJ\xff\xff\xff\xfftb\x89U\x04\x01\x02\x03\x04tb.'
        a = np.array([1, 2, 3, 4], dtype=np.int8)
        p = self._loads(s)
        assert_equal(a, p)

    def test_version1_float32(self):
        s = b'\x80\x02cnumpy.core._internal\n_reconstruct\nq\x01cnumpy\nndarray\nq\x02K\x00\x85U\x01b\x87Rq\x03(K\x01K\x04\x85cnumpy\ndtype\nq\x04U\x02f4K\x00K\x01\x87Rq\x05(K\x01U\x01<NNJ\xff\xff\xff\xffJ\xff\xff\xff\xfftb\x89U\x10\x00\x00\x80?\x00\x00\x00@\x00\x00@@\x00\x00\x80@tb.'
        a = np.array([1.0, 2.0, 3.0, 4.0], dtype=np.float32)
        p = self._loads(s)
        assert_equal(a, p)

    def test_version1_object(self):
        s = b'\x80\x02cnumpy.core._internal\n_reconstruct\nq\x01cnumpy\nndarray\nq\x02K\x00\x85U\x01b\x87Rq\x03(K\x01K\x02\x85cnumpy\ndtype\nq\x04U\x02O8K\x00K\x01\x87Rq\x05(K\x01U\x01|NNJ\xff\xff\xff\xffJ\xff\xff\xff\xfftb\x89]q\x06(}q\x07U\x01aK\x01s}q\x08U\x01bK\x02setb.'
        a = np.array([{'a': 1}, {'b': 2}])
        p = self._loads(s)
        assert_equal(a, p)

    def test_subarray_int_shape(self):
        s = b"cnumpy.core.multiarray\n_reconstruct\np0\n(cnumpy\nndarray\np1\n(I0\ntp2\nS'b'\np3\ntp4\nRp5\n(I1\n(I1\ntp6\ncnumpy\ndtype\np7\n(S'V6'\np8\nI0\nI1\ntp9\nRp10\n(I3\nS'|'\np11\nN(S'a'\np12\ng3\ntp13\n(dp14\ng12\n(g7\n(S'V4'\np15\nI0\nI1\ntp16\nRp17\n(I3\nS'|'\np18\n(g7\n(S'i1'\np19\nI0\nI1\ntp20\nRp21\n(I3\nS'|'\np22\nNNNI-1\nI-1\nI0\ntp23\nb(I2\nI2\ntp24\ntp25\nNNI4\nI1\nI0\ntp26\nbI0\ntp27\nsg3\n(g7\n(S'V2'\np28\nI0\nI1\ntp29\nRp30\n(I3\nS'|'\np31\n(g21\nI2\ntp32\nNNI2\nI1\nI0\ntp33\nbI4\ntp34\nsI6\nI1\nI0\ntp35\nbI00\nS'\\x01\\x01\\x01\\x01\\x01\\x02'\np36\ntp37\nb."
        a = np.array([(1, (1, 2))], dtype=[('a', 'i1', (2, 2)), ('b', 'i1', 2)])
        p = self._loads(s)
        assert_equal(a, p)


class TestFancyIndexing(TestCase):
    def test_list(self):
        x = np.ones((1, 1))
        x[:, [0]] = 2.0
        assert_array_equal(x, np.array([[2.0]]))

        x = np.ones((1, 1, 1))
        x[:, :, [0]] = 2.0
        assert_array_equal(x, np.array([[[2.0]]]))

    def test_tuple(self):
        x = np.ones((1, 1))
        x[:, (0,)] = 2.0
        assert_array_equal(x, np.array([[2.0]]))
        x = np.ones((1, 1, 1))
        x[:, :, (0,)] = 2.0
        assert_array_equal(x, np.array([[[2.0]]]))

    def test_mask(self):
        x = np.array([1, 2, 3, 4])
        m = np.array([0, 1, 0, 0], bool)
        assert_array_equal(x[m], np.array([2]))

    def test_mask2(self):
        x = np.array([[1, 2, 3, 4], [5, 6, 7, 8]])
        m = np.array([0, 1], bool)
        m2 = np.array([[0, 1, 0, 0], [1, 0, 0, 0]], bool)
        m3 = np.array([[0, 1, 0, 0], [0, 0, 0, 0]], bool)
        assert_array_equal(x[m], np.array([[5, 6, 7, 8]]))
        assert_array_equal(x[m2], np.array([2, 5]))
        assert_array_equal(x[m3], np.array([2]))

    def test_assign_mask(self):
        x = np.array([1, 2, 3, 4])
        m = np.array([0, 1, 0, 0], bool)
        x[m] = 5
        assert_array_equal(x, np.array([1, 5, 3, 4]))

    def test_assign_mask2(self):
        xorig = np.array([[1, 2, 3, 4], [5, 6, 7, 8]])
        m = np.array([0, 1], bool)
        m2 = np.array([[0, 1, 0, 0], [1, 0, 0, 0]], bool)
        m3 = np.array([[0, 1, 0, 0], [0, 0, 0, 0]], bool)
        x = xorig.copy()
        x[m] = 10
        assert_array_equal(x, np.array([[1, 2, 3, 4], [10, 10, 10, 10]]))
        x = xorig.copy()
        x[m2] = 10
        assert_array_equal(x, np.array([[1, 10, 3, 4], [10, 6, 7, 8]]))
        x = xorig.copy()
        x[m3] = 10
        assert_array_equal(x, np.array([[1, 10, 3, 4], [5, 6, 7, 8]]))


class TestStringCompare(TestCase):
    def test_string(self):
        g1 = np.array(["This", "is", "example"])
        g2 = np.array(["This", "was", "example"])
        assert_array_equal(g1 == g2, [g1[i] == g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 != g2, [g1[i] != g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 <= g2, [g1[i] <= g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 >= g2, [g1[i] >= g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 < g2, [g1[i] < g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 > g2, [g1[i] > g2[i] for i in [0, 1, 2]])

    def test_mixed(self):
        g1 = np.array(["spam", "spa", "spammer", "and eggs"])
        g2 = "spam"
        assert_array_equal(g1 == g2, [x == g2 for x in g1])
        assert_array_equal(g1 != g2, [x != g2 for x in g1])
        assert_array_equal(g1 < g2, [x < g2 for x in g1])
        assert_array_equal(g1 > g2, [x > g2 for x in g1])
        assert_array_equal(g1 <= g2, [x <= g2 for x in g1])
        assert_array_equal(g1 >= g2, [x >= g2 for x in g1])

    def test_unicode(self):
        g1 = np.array([u"This", u"is", u"example"])
        g2 = np.array([u"This", u"was", u"example"])
        assert_array_equal(g1 == g2, [g1[i] == g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 != g2, [g1[i] != g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 <= g2, [g1[i] <= g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 >= g2, [g1[i] >= g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 < g2,  [g1[i] < g2[i] for i in [0, 1, 2]])
        assert_array_equal(g1 > g2,  [g1[i] > g2[i] for i in [0, 1, 2]])


class TestArgmax(TestCase):

    nan_arr = [
        ([0, 1, 2, 3, np.nan], 4),
        ([0, 1, 2, np.nan, 3], 3),
        ([np.nan, 0, 1, 2, 3], 0),
        ([np.nan, 0, np.nan, 2, 3], 0),
        ([0, 1, 2, 3, complex(0, np.nan)], 4),
        ([0, 1, 2, 3, complex(np.nan, 0)], 4),
        ([0, 1, 2, complex(np.nan, 0), 3], 3),
        ([0, 1, 2, complex(0, np.nan), 3], 3),
        ([complex(0, np.nan), 0, 1, 2, 3], 0),
        ([complex(np.nan, np.nan), 0, 1, 2, 3], 0),
        ([complex(np.nan, 0), complex(np.nan, 2), complex(np.nan, 1)], 0),
        ([complex(np.nan, np.nan), complex(np.nan, 2), complex(np.nan, 1)], 0),
        ([complex(np.nan, 0), complex(np.nan, 2), complex(np.nan, np.nan)], 0),

        ([complex(0, 0), complex(0, 2), complex(0, 1)], 1),
        ([complex(1, 0), complex(0, 2), complex(0, 1)], 0),
        ([complex(1, 0), complex(0, 2), complex(1, 1)], 2),

        ([np.datetime64('1923-04-14T12:43:12'),
          np.datetime64('1994-06-21T14:43:15'),
          np.datetime64('2001-10-15T04:10:32'),
          np.datetime64('1995-11-25T16:02:16'),
          np.datetime64('2005-01-04T03:14:12'),
          np.datetime64('2041-12-03T14:05:03')], 5),
        ([np.datetime64('1935-09-14T04:40:11'),
          np.datetime64('1949-10-12T12:32:11'),
          np.datetime64('2010-01-03T05:14:12'),
          np.datetime64('2015-11-20T12:20:59'),
          np.datetime64('1932-09-23T10:10:13'),
          np.datetime64('2014-10-10T03:50:30')], 3),
        # Assorted tests with NaTs
        ([np.datetime64('NaT'),
          np.datetime64('NaT'),
          np.datetime64('2010-01-03T05:14:12'),
          np.datetime64('NaT'),
          np.datetime64('2015-09-23T10:10:13'),
          np.datetime64('1932-10-10T03:50:30')], 4),
        ([np.datetime64('2059-03-14T12:43:12'),
          np.datetime64('1996-09-21T14:43:15'),
          np.datetime64('NaT'),
          np.datetime64('2022-12-25T16:02:16'),
          np.datetime64('1963-10-04T03:14:12'),
          np.datetime64('2013-05-08T18:15:23')], 0),
        ([np.timedelta64(2, 's'),
          np.timedelta64(1, 's'),
          np.timedelta64('NaT', 's'),
          np.timedelta64(3, 's')], 3),
        ([np.timedelta64('NaT', 's')] * 3, 0),

        ([timedelta(days=5, seconds=14), timedelta(days=2, seconds=35),
          timedelta(days=-1, seconds=23)], 0),
        ([timedelta(days=1, seconds=43), timedelta(days=10, seconds=5),
          timedelta(days=5, seconds=14)], 1),
        ([timedelta(days=10, seconds=24), timedelta(days=10, seconds=5),
          timedelta(days=10, seconds=43)], 2),

        ([False, False, False, False, True], 4),
        ([False, False, False, True, False], 3),
        ([True, False, False, False, False], 0),
        ([True, False, True, False, False], 0),
    ]

    def test_all(self):
        a = np.random.normal(0, 1, (4, 5, 6, 7, 8))
        for i in range(a.ndim):
            amax = a.max(i)
            aargmax = a.argmax(i)
            axes = list(range(a.ndim))
            axes.remove(i)
            assert_(np.all(amax == aargmax.choose(*a.transpose(i,*axes))))

    def test_combinations(self):
        for arr, pos in self.nan_arr:
            assert_equal(np.argmax(arr), pos, err_msg="%r" % arr)
            assert_equal(arr[np.argmax(arr)], np.max(arr), err_msg="%r" % arr)

    def test_output_shape(self):
        # see also gh-616
        a = np.ones((10, 5))
        # Check some simple shape mismatches
        out = np.ones(11, dtype=np.int_)
        assert_raises(ValueError, a.argmax, -1, out)

        out = np.ones((2, 5), dtype=np.int_)
        assert_raises(ValueError, a.argmax, -1, out)

        # these could be relaxed possibly (used to allow even the previous)
        out = np.ones((1, 10), dtype=np.int_)
        assert_raises(ValueError, a.argmax, -1, out)

        out = np.ones(10, dtype=np.int_)
        a.argmax(-1, out=out)
        assert_equal(out, a.argmax(-1))

    def test_argmax_unicode(self):
        d = np.zeros(6031, dtype='<U9')
        d[5942] = "as"
        assert_equal(d.argmax(), 5942)

    def test_np_vs_ndarray(self):
        # make sure both ndarray.argmax and numpy.argmax support out/axis args
        a = np.random.normal(size=(2,3))

        # check positional args
        out1 = np.zeros(2, dtype=int)
        out2 = np.zeros(2, dtype=int)
        assert_equal(a.argmax(1, out1), np.argmax(a, 1, out2))
        assert_equal(out1, out2)

        # check keyword args
        out1 = np.zeros(3, dtype=int)
        out2 = np.zeros(3, dtype=int)
        assert_equal(a.argmax(out=out1, axis=0), np.argmax(a, out=out2, axis=0))
        assert_equal(out1, out2)

    def test_object_argmax_with_NULLs(self):
        # See gh-6032
        a = np.empty(4, dtype='O')
        ctypes.memset(a.ctypes.data, 0, a.nbytes)
        assert_equal(a.argmax(), 0)
        a[3] = 10
        assert_equal(a.argmax(), 3)
        a[1] = 30
        assert_equal(a.argmax(), 1)


class TestArgmin(TestCase):

    nan_arr = [
        ([0, 1, 2, 3, np.nan], 4),
        ([0, 1, 2, np.nan, 3], 3),
        ([np.nan, 0, 1, 2, 3], 0),
        ([np.nan, 0, np.nan, 2, 3], 0),
        ([0, 1, 2, 3, complex(0, np.nan)], 4),
        ([0, 1, 2, 3, complex(np.nan, 0)], 4),
        ([0, 1, 2, complex(np.nan, 0), 3], 3),
        ([0, 1, 2, complex(0, np.nan), 3], 3),
        ([complex(0, np.nan), 0, 1, 2, 3], 0),
        ([complex(np.nan, np.nan), 0, 1, 2, 3], 0),
        ([complex(np.nan, 0), complex(np.nan, 2), complex(np.nan, 1)], 0),
        ([complex(np.nan, np.nan), complex(np.nan, 2), complex(np.nan, 1)], 0),
        ([complex(np.nan, 0), complex(np.nan, 2), complex(np.nan, np.nan)], 0),

        ([complex(0, 0), complex(0, 2), complex(0, 1)], 0),
        ([complex(1, 0), complex(0, 2), complex(0, 1)], 2),
        ([complex(1, 0), complex(0, 2), complex(1, 1)], 1),

        ([np.datetime64('1923-04-14T12:43:12'),
          np.datetime64('1994-06-21T14:43:15'),
          np.datetime64('2001-10-15T04:10:32'),
          np.datetime64('1995-11-25T16:02:16'),
          np.datetime64('2005-01-04T03:14:12'),
          np.datetime64('2041-12-03T14:05:03')], 0),
        ([np.datetime64('1935-09-14T04:40:11'),
          np.datetime64('1949-10-12T12:32:11'),
          np.datetime64('2010-01-03T05:14:12'),
          np.datetime64('2014-11-20T12:20:59'),
          np.datetime64('2015-09-23T10:10:13'),
          np.datetime64('1932-10-10T03:50:30')], 5),
        # Assorted tests with NaTs
        ([np.datetime64('NaT'),
          np.datetime64('NaT'),
          np.datetime64('2010-01-03T05:14:12'),
          np.datetime64('NaT'),
          np.datetime64('2015-09-23T10:10:13'),
          np.datetime64('1932-10-10T03:50:30')], 5),
        ([np.datetime64('2059-03-14T12:43:12'),
          np.datetime64('1996-09-21T14:43:15'),
          np.datetime64('NaT'),
          np.datetime64('2022-12-25T16:02:16'),
          np.datetime64('1963-10-04T03:14:12'),
          np.datetime64('2013-05-08T18:15:23')], 4),
        ([np.timedelta64(2, 's'),
          np.timedelta64(1, 's'),
          np.timedelta64('NaT', 's'),
          np.timedelta64(3, 's')], 1),
        ([np.timedelta64('NaT', 's')] * 3, 0),

        ([timedelta(days=5, seconds=14), timedelta(days=2, seconds=35),
          timedelta(days=-1, seconds=23)], 2),
        ([timedelta(days=1, seconds=43), timedelta(days=10, seconds=5),
          timedelta(days=5, seconds=14)], 0),
        ([timedelta(days=10, seconds=24), timedelta(days=10, seconds=5),
          timedelta(days=10, seconds=43)], 1),

        ([True, True, True, True, False], 4),
        ([True, True, True, False, True], 3),
        ([False, True, True, True, True], 0),
        ([False, True, False, True, True], 0),
    ]

    def test_all(self):
        a = np.random.normal(0, 1, (4, 5, 6, 7, 8))
        for i in range(a.ndim):
            amin = a.min(i)
            aargmin = a.argmin(i)
            axes = list(range(a.ndim))
            axes.remove(i)
            assert_(np.all(amin == aargmin.choose(*a.transpose(i,*axes))))

    def test_combinations(self):
        for arr, pos in self.nan_arr:
            assert_equal(np.argmin(arr), pos, err_msg="%r" % arr)
            assert_equal(arr[np.argmin(arr)], np.min(arr), err_msg="%r" % arr)

    def test_minimum_signed_integers(self):

        a = np.array([1, -2**7, -2**7 + 1], dtype=np.int8)
        assert_equal(np.argmin(a), 1)

        a = np.array([1, -2**15, -2**15 + 1], dtype=np.int16)
        assert_equal(np.argmin(a), 1)

        a = np.array([1, -2**31, -2**31 + 1], dtype=np.int32)
        assert_equal(np.argmin(a), 1)

        a = np.array([1, -2**63, -2**63 + 1], dtype=np.int64)
        assert_equal(np.argmin(a), 1)

    def test_output_shape(self):
        # see also gh-616
        a = np.ones((10, 5))
        # Check some simple shape mismatches
        out = np.ones(11, dtype=np.int_)
        assert_raises(ValueError, a.argmin, -1, out)

        out = np.ones((2, 5), dtype=np.int_)
        assert_raises(ValueError, a.argmin, -1, out)

        # these could be relaxed possibly (used to allow even the previous)
        out = np.ones((1, 10), dtype=np.int_)
        assert_raises(ValueError, a.argmin, -1, out)

        out = np.ones(10, dtype=np.int_)
        a.argmin(-1, out=out)
        assert_equal(out, a.argmin(-1))

    def test_argmin_unicode(self):
        d = np.ones(6031, dtype='<U9')
        d[6001] = "0"
        assert_equal(d.argmin(), 6001)

    def test_np_vs_ndarray(self):
        # make sure both ndarray.argmin and numpy.argmin support out/axis args
        a = np.random.normal(size=(2, 3))

        # check positional args
        out1 = np.zeros(2, dtype=int)
        out2 = np.ones(2, dtype=int)
        assert_equal(a.argmin(1, out1), np.argmin(a, 1, out2))
        assert_equal(out1, out2)

        # check keyword args
        out1 = np.zeros(3, dtype=int)
        out2 = np.ones(3, dtype=int)
        assert_equal(a.argmin(out=out1, axis=0), np.argmin(a, out=out2, axis=0))
        assert_equal(out1, out2)

    def test_object_argmin_with_NULLs(self):
        # See gh-6032
        a = np.empty(4, dtype='O')
        ctypes.memset(a.ctypes.data, 0, a.nbytes)
        assert_equal(a.argmin(), 0)
        a[3] = 30
        assert_equal(a.argmin(), 3)
        a[1] = 10
        assert_equal(a.argmin(), 1)


class TestMinMax(TestCase):

    def test_scalar(self):
        assert_raises(np.AxisError, np.amax, 1, 1)
        assert_raises(np.AxisError, np.amin, 1, 1)

        assert_equal(np.amax(1, axis=0), 1)
        assert_equal(np.amin(1, axis=0), 1)
        assert_equal(np.amax(1, axis=None), 1)
        assert_equal(np.amin(1, axis=None), 1)

    def test_axis(self):
        assert_raises(np.AxisError, np.amax, [1, 2, 3], 1000)
        assert_equal(np.amax([[1, 2, 3]], axis=1), 3)

    def test_datetime(self):
        # NaTs are ignored
        for dtype in ('m8[s]', 'm8[Y]'):
            a = np.arange(10).astype(dtype)
            a[3] = 'NaT'
            assert_equal(np.amin(a), a[0])
            assert_equal(np.amax(a), a[9])
            a[0] = 'NaT'
            assert_equal(np.amin(a), a[1])
            assert_equal(np.amax(a), a[9])
            a.fill('NaT')
            assert_equal(np.amin(a), a[0])
            assert_equal(np.amax(a), a[0])


class TestNewaxis(TestCase):
    def test_basic(self):
        sk = np.array([0, -0.1, 0.1])
        res = 250*sk[:, np.newaxis]
        assert_almost_equal(res.ravel(), 250*sk)


class TestClip(TestCase):
    def _check_range(self, x, cmin, cmax):
        assert_(np.all(x >= cmin))
        assert_(np.all(x <= cmax))

    def _clip_type(self, type_group, array_max,
                   clip_min, clip_max, inplace=False,
                   expected_min=None, expected_max=None):
        if expected_min is None:
            expected_min = clip_min
        if expected_max is None:
            expected_max = clip_max

        for T in np.sctypes[type_group]:
            if sys.byteorder == 'little':
                byte_orders = ['=', '>']
            else:
                byte_orders = ['<', '=']

            for byteorder in byte_orders:
                dtype = np.dtype(T).newbyteorder(byteorder)

                x = (np.random.random(1000) * array_max).astype(dtype)
                if inplace:
                    x.clip(clip_min, clip_max, x)
                else:
                    x = x.clip(clip_min, clip_max)
                    byteorder = '='

                if x.dtype.byteorder == '|':
                    byteorder = '|'
                assert_equal(x.dtype.byteorder, byteorder)
                self._check_range(x, expected_min, expected_max)
        return x

    def test_basic(self):
        for inplace in [False, True]:
            self._clip_type(
                'float', 1024, -12.8, 100.2, inplace=inplace)
            self._clip_type(
                'float', 1024, 0, 0, inplace=inplace)

            self._clip_type(
                'int', 1024, -120, 100.5, inplace=inplace)
            self._clip_type(
                'int', 1024, 0, 0, inplace=inplace)

            self._clip_type(
                'uint', 1024, 0, 0, inplace=inplace)
            self._clip_type(
                'uint', 1024, -120, 100, inplace=inplace, expected_min=0)

    def test_record_array(self):
        rec = np.array([(-5, 2.0, 3.0), (5.0, 4.0, 3.0)],
                       dtype=[('x', '<f8'), ('y', '<f8'), ('z', '<f8')])
        y = rec['x'].clip(-0.3, 0.5)
        self._check_range(y, -0.3, 0.5)

    def test_max_or_min(self):
        val = np.array([0, 1, 2, 3, 4, 5, 6, 7])
        x = val.clip(3)
        assert_(np.all(x >= 3))
        x = val.clip(min=3)
        assert_(np.all(x >= 3))
        x = val.clip(max=4)
        assert_(np.all(x <= 4))

    def test_nan(self):
        input_arr = np.array([-2., np.nan, 0.5, 3., 0.25, np.nan])
        result = input_arr.clip(-1, 1)
        expected = np.array([-1., np.nan, 0.5, 1., 0.25, np.nan])
        assert_array_equal(result, expected)


class TestCompress(TestCase):
    def test_axis(self):
        tgt = [[5, 6, 7, 8, 9]]
        arr = np.arange(10).reshape(2, 5)
        out = np.compress([0, 1], arr, axis=0)
        assert_equal(out, tgt)

        tgt = [[1, 3], [6, 8]]
        out = np.compress([0, 1, 0, 1, 0], arr, axis=1)
        assert_equal(out, tgt)

    def test_truncate(self):
        tgt = [[1], [6]]
        arr = np.arange(10).reshape(2, 5)
        out = np.compress([0, 1], arr, axis=1)
        assert_equal(out, tgt)

    def test_flatten(self):
        arr = np.arange(10).reshape(2, 5)
        out = np.compress([0, 1], arr)
        assert_equal(out, 1)


class TestPutmask(object):
    def tst_basic(self, x, T, mask, val):
        np.putmask(x, mask, val)
        assert_equal(x[mask], T(val))
        assert_equal(x.dtype, T)

    def test_ip_types(self):
        unchecked_types = [bytes, unicode, np.void, object]

        x = np.random.random(1000)*100
        mask = x < 40

        for val in [-100, 0, 15]:
            for types in np.sctypes.values():
                for T in types:
                    if T not in unchecked_types:
                        yield self.tst_basic, x.copy().astype(T), T, mask, val

    def test_mask_size(self):
        assert_raises(ValueError, np.putmask, np.array([1, 2, 3]), [True], 5)

    def tst_byteorder(self, dtype):
        x = np.array([1, 2, 3], dtype)
        np.putmask(x, [True, False, True], -1)
        assert_array_equal(x, [-1, 2, -1])

    def test_ip_byteorder(self):
        for dtype in ('>i4', '<i4'):
            yield self.tst_byteorder, dtype

    def test_record_array(self):
        # Note mixed byteorder.
        rec = np.array([(-5, 2.0, 3.0), (5.0, 4.0, 3.0)],
                      dtype=[('x', '<f8'), ('y', '>f8'), ('z', '<f8')])
        np.putmask(rec['x'], [True, False], 10)
        assert_array_equal(rec['x'], [10, 5])
        assert_array_equal(rec['y'], [2, 4])
        assert_array_equal(rec['z'], [3, 3])
        np.putmask(rec['y'], [True, False], 11)
        assert_array_equal(rec['x'], [10, 5])
        assert_array_equal(rec['y'], [11, 4])
        assert_array_equal(rec['z'], [3, 3])


class TestTake(object):
    def tst_basic(self, x):
        ind = list(range(x.shape[0]))
        assert_array_equal(x.take(ind, axis=0), x)

    def test_ip_types(self):
        unchecked_types = [bytes, unicode, np.void, object]

        x = np.random.random(24)*100
        x.shape = 2, 3, 4
        for types in np.sctypes.values():
            for T in types:
                if T not in unchecked_types:
                    yield self.tst_basic, x.copy().astype(T)

    def test_raise(self):
        x = np.random.random(24)*100
        x.shape = 2, 3, 4
        assert_raises(IndexError, x.take, [0, 1, 2], axis=0)
        assert_raises(IndexError, x.take, [-3], axis=0)
        assert_array_equal(x.take([-1], axis=0)[0], x[1])

    def test_clip(self):
        x = np.random.random(24)*100
        x.shape = 2, 3, 4
        assert_array_equal(x.take([-1], axis=0, mode='clip')[0], x[0])
        assert_array_equal(x.take([2], axis=0, mode='clip')[0], x[1])

    def test_wrap(self):
        x = np.random.random(24)*100
        x.shape = 2, 3, 4
        assert_array_equal(x.take([-1], axis=0, mode='wrap')[0], x[1])
        assert_array_equal(x.take([2], axis=0, mode='wrap')[0], x[0])
        assert_array_equal(x.take([3], axis=0, mode='wrap')[0], x[1])

    def tst_byteorder(self, dtype):
        x = np.array([1, 2, 3], dtype)
        assert_array_equal(x.take([0, 2, 1]), [1, 3, 2])

    def test_ip_byteorder(self):
        for dtype in ('>i4', '<i4'):
            yield self.tst_byteorder, dtype

    def test_record_array(self):
        # Note mixed byteorder.
        rec = np.array([(-5, 2.0, 3.0), (5.0, 4.0, 3.0)],
                      dtype=[('x', '<f8'), ('y', '>f8'), ('z', '<f8')])
        rec1 = rec.take([1])
        assert_(rec1['x'] == 5.0 and rec1['y'] == 4.0)


class TestLexsort(TestCase):
    def test_basic(self):
        a = [1, 2, 1, 3, 1, 5]
        b = [0, 4, 5, 6, 2, 3]
        idx = np.lexsort((b, a))
        expected_idx = np.array([0, 4, 2, 1, 3, 5])
        assert_array_equal(idx, expected_idx)

        x = np.vstack((b, a))
        idx = np.lexsort(x)
        assert_array_equal(idx, expected_idx)

        assert_array_equal(x[1][idx], np.sort(x[1]))

    def test_datetime(self):
        a = np.array([0,0,0], dtype='datetime64[D]')
        b = np.array([2,1,0], dtype='datetime64[D]')
        idx = np.lexsort((b, a))
        expected_idx = np.array([2, 1, 0])
        assert_array_equal(idx, expected_idx)

        a = np.array([0,0,0], dtype='timedelta64[D]')
        b = np.array([2,1,0], dtype='timedelta64[D]')
        idx = np.lexsort((b, a))
        expected_idx = np.array([2, 1, 0])
        assert_array_equal(idx, expected_idx)

    def test_object(self):  # gh-6312
        a = np.random.choice(10, 1000)
        b = np.random.choice(['abc', 'xy', 'wz', 'efghi', 'qwst', 'x'], 1000)

        for u in a, b:
            left = np.lexsort((u.astype('O'),))
            right = np.argsort(u, kind='mergesort')
            assert_array_equal(left, right)

        for u, v in (a, b), (b, a):
            idx = np.lexsort((u, v))
            assert_array_equal(idx, np.lexsort((u.astype('O'), v)))
            assert_array_equal(idx, np.lexsort((u, v.astype('O'))))
            u, v = np.array(u, dtype='object'), np.array(v, dtype='object')
            assert_array_equal(idx, np.lexsort((u, v)))

    def test_invalid_axis(self): # gh-7528
        x = np.linspace(0., 1., 42*3).reshape(42, 3)
        assert_raises(np.AxisError, np.lexsort, x, axis=2)

class TestIO(TestCase):
    """Test tofile, fromfile, tobytes, and fromstring"""

    def setUp(self):
        shape = (2, 4, 3)
        rand = np.random.random
        self.x = rand(shape) + rand(shape).astype(np.complex)*1j
        self.x[0,:, 1] = [np.nan, np.inf, -np.inf, np.nan]
        self.dtype = self.x.dtype
        self.tempdir = tempfile.mkdtemp()
        self.filename = tempfile.mktemp(dir=self.tempdir)

    def tearDown(self):
        shutil.rmtree(self.tempdir)

    def test_nofile(self):
        # this should probably be supported as a file
        # but for now test for proper errors
        b = io.BytesIO()
        assert_raises(IOError, np.fromfile, b, np.uint8, 80)
        d = np.ones(7)
        assert_raises(IOError, lambda x: x.tofile(b), d)

    def test_bool_fromstring(self):
        v = np.array([True, False, True, False], dtype=np.bool_)
        y = np.fromstring('1 0 -2.3 0.0', sep=' ', dtype=np.bool_)
        assert_array_equal(v, y)

    def test_uint64_fromstring(self):
        d = np.fromstring("9923372036854775807 104783749223640",
                          dtype=np.uint64, sep=' ')
        e = np.array([9923372036854775807, 104783749223640], dtype=np.uint64)
        assert_array_equal(d, e)

    def test_int64_fromstring(self):
        d = np.fromstring("-25041670086757 104783749223640",
                          dtype=np.int64, sep=' ')
        e = np.array([-25041670086757, 104783749223640], dtype=np.int64)
        assert_array_equal(d, e)

    def test_empty_files_binary(self):
        f = open(self.filename, 'w')
        f.close()
        y = np.fromfile(self.filename)
        assert_(y.size == 0, "Array not empty")

    def test_empty_files_text(self):
        f = open(self.filename, 'w')
        f.close()
        y = np.fromfile(self.filename, sep=" ")
        assert_(y.size == 0, "Array not empty")

    def test_roundtrip_file(self):
        f = open(self.filename, 'wb')
        self.x.tofile(f)
        f.close()
        # NB. doesn't work with flush+seek, due to use of C stdio
        f = open(self.filename, 'rb')
        y = np.fromfile(f, dtype=self.dtype)
        f.close()
        assert_array_equal(y, self.x.flat)

    def test_roundtrip_filename(self):
        self.x.tofile(self.filename)
        y = np.fromfile(self.filename, dtype=self.dtype)
        assert_array_equal(y, self.x.flat)

    def test_roundtrip_binary_str(self):
        s = self.x.tobytes()
        y = np.fromstring(s, dtype=self.dtype)
        assert_array_equal(y, self.x.flat)

        s = self.x.tobytes('F')
        y = np.fromstring(s, dtype=self.dtype)
        assert_array_equal(y, self.x.flatten('F'))

    def test_roundtrip_str(self):
        x = self.x.real.ravel()
        s = "@".join(map(str, x))
        y = np.fromstring(s, sep="@")
        # NB. str imbues less precision
        nan_mask = ~np.isfinite(x)
        assert_array_equal(x[nan_mask], y[nan_mask])
        assert_array_almost_equal(x[~nan_mask], y[~nan_mask], decimal=5)

    def test_roundtrip_repr(self):
        x = self.x.real.ravel()
        s = "@".join(map(repr, x))
        y = np.fromstring(s, sep="@")
        assert_array_equal(x, y)

    def test_unseekable_fromfile(self):
        # gh-6246
        self.x.tofile(self.filename)

        def fail(*args, **kwargs):
            raise IOError('Can not tell or seek')

        with io.open(self.filename, 'rb', buffering=0) as f:
            f.seek = fail
            f.tell = fail
            self.assertRaises(IOError, np.fromfile, f, dtype=self.dtype)

    def test_io_open_unbuffered_fromfile(self):
        # gh-6632
        self.x.tofile(self.filename)
        with io.open(self.filename, 'rb', buffering=0) as f:
            y = np.fromfile(f, dtype=self.dtype)
            assert_array_equal(y, self.x.flat)

    def test_largish_file(self):
        # check the fallocate path on files > 16MB
        d = np.zeros(4 * 1024 ** 2)
        d.tofile(self.filename)
        assert_equal(os.path.getsize(self.filename), d.nbytes)
        assert_array_equal(d, np.fromfile(self.filename))
        # check offset
        with open(self.filename, "r+b") as f:
            f.seek(d.nbytes)
            d.tofile(f)
            assert_equal(os.path.getsize(self.filename), d.nbytes * 2)
        # check append mode (gh-8329)
        open(self.filename, "w").close() # delete file contents
        with open(self.filename, "ab") as f:
            d.tofile(f)
        assert_array_equal(d, np.fromfile(self.filename))
        with open(self.filename, "ab") as f:
            d.tofile(f)
        assert_equal(os.path.getsize(self.filename), d.nbytes * 2)


    def test_io_open_buffered_fromfile(self):
        # gh-6632
        self.x.tofile(self.filename)
        with io.open(self.filename, 'rb', buffering=-1) as f:
            y = np.fromfile(f, dtype=self.dtype)
        assert_array_equal(y, self.x.flat)

    def test_file_position_after_fromfile(self):
        # gh-4118
        sizes = [io.DEFAULT_BUFFER_SIZE//8,
                 io.DEFAULT_BUFFER_SIZE,
                 io.DEFAULT_BUFFER_SIZE*8]

        for size in sizes:
            f = open(self.filename, 'wb')
            f.seek(size-1)
            f.write(b'\0')
            f.close()

            for mode in ['rb', 'r+b']:
                err_msg = "%d %s" % (size, mode)

                f = open(self.filename, mode)
                f.read(2)
                np.fromfile(f, dtype=np.float64, count=1)
                pos = f.tell()
                f.close()
                assert_equal(pos, 10, err_msg=err_msg)

    def test_file_position_after_tofile(self):
        # gh-4118
        sizes = [io.DEFAULT_BUFFER_SIZE//8,
                 io.DEFAULT_BUFFER_SIZE,
                 io.DEFAULT_BUFFER_SIZE*8]

        for size in sizes:
            err_msg = "%d" % (size,)

            f = open(self.filename, 'wb')
            f.seek(size-1)
            f.write(b'\0')
            f.seek(10)
            f.write(b'12')
            np.array([0], dtype=np.float64).tofile(f)
            pos = f.tell()
            f.close()
            assert_equal(pos, 10 + 2 + 8, err_msg=err_msg)

            f = open(self.filename, 'r+b')
            f.read(2)
            f.seek(0, 1)  # seek between read&write required by ANSI C
            np.array([0], dtype=np.float64).tofile(f)
            pos = f.tell()
            f.close()
            assert_equal(pos, 10, err_msg=err_msg)

    def _check_from(self, s, value, **kw):
        y = np.fromstring(s, **kw)
        assert_array_equal(y, value)

        f = open(self.filename, 'wb')
        f.write(s)
        f.close()
        y = np.fromfile(self.filename, **kw)
        assert_array_equal(y, value)

    def test_nan(self):
        self._check_from(
            b"nan +nan -nan NaN nan(foo) +NaN(BAR) -NAN(q_u_u_x_)",
            [np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],
            sep=' ')

    def test_inf(self):
        self._check_from(
            b"inf +inf -inf infinity -Infinity iNfInItY -inF",
            [np.inf, np.inf, -np.inf, np.inf, -np.inf, np.inf, -np.inf],
            sep=' ')

    def test_numbers(self):
        self._check_from(b"1.234 -1.234 .3 .3e55 -123133.1231e+133",
                         [1.234, -1.234, .3, .3e55, -123133.1231e+133], sep=' ')

    def test_binary(self):
        self._check_from(b'\x00\x00\x80?\x00\x00\x00@\x00\x00@@\x00\x00\x80@',
                         np.array([1, 2, 3, 4]),
                         dtype='<f4')

    @dec.slow  # takes > 1 minute on mechanical hard drive
    def test_big_binary(self):
        """Test workarounds for 32-bit limited fwrite, fseek, and ftell
        calls in windows. These normally would hang doing something like this.
        See http://projects.scipy.org/numpy/ticket/1660"""
        if sys.platform != 'win32':
            return
        try:
            # before workarounds, only up to 2**32-1 worked
            fourgbplus = 2**32 + 2**16
            testbytes = np.arange(8, dtype=np.int8)
            n = len(testbytes)
            flike = tempfile.NamedTemporaryFile()
            f = flike.file
            np.tile(testbytes, fourgbplus // testbytes.nbytes).tofile(f)
            flike.seek(0)
            a = np.fromfile(f, dtype=np.int8)
            flike.close()
            assert_(len(a) == fourgbplus)
            # check only start and end for speed:
            assert_((a[:n] == testbytes).all())
            assert_((a[-n:] == testbytes).all())
        except (MemoryError, ValueError):
            pass

    def test_string(self):
        self._check_from(b'1,2,3,4', [1., 2., 3., 4.], sep=',')

    def test_counted_string(self):
        self._check_from(b'1,2,3,4', [1., 2., 3., 4.], count=4, sep=',')
        self._check_from(b'1,2,3,4', [1., 2., 3.], count=3, sep=',')
        self._check_from(b'1,2,3,4', [1., 2., 3., 4.], count=-1, sep=',')

    def test_string_with_ws(self):
        self._check_from(b'1 2  3     4   ', [1, 2, 3, 4], dtype=int, sep=' ')

    def test_counted_string_with_ws(self):
        self._check_from(b'1 2  3     4   ', [1, 2, 3], count=3, dtype=int,
                         sep=' ')

    def test_ascii(self):
        self._check_from(b'1 , 2 , 3 , 4', [1., 2., 3., 4.], sep=',')
        self._check_from(b'1,2,3,4', [1., 2., 3., 4.], dtype=float, sep=',')

    def test_malformed(self):
        self._check_from(b'1.234 1,234', [1.234, 1.], sep=' ')

    def test_long_sep(self):
        self._check_from(b'1_x_3_x_4_x_5', [1, 3, 4, 5], sep='_x_')

    def test_dtype(self):
        v = np.array([1, 2, 3, 4], dtype=np.int_)
        self._check_from(b'1,2,3,4', v, sep=',', dtype=np.int_)

    def test_dtype_bool(self):
        # can't use _check_from because fromstring can't handle True/False
        v = np.array([True, False, True, False], dtype=np.bool_)
        s = b'1,0,-2.3,0'
        f = open(self.filename, 'wb')
        f.write(s)
        f.close()
        y = np.fromfile(self.filename, sep=',', dtype=np.bool_)
        assert_(y.dtype == '?')
        assert_array_equal(y, v)

    def test_tofile_sep(self):
        x = np.array([1.51, 2, 3.51, 4], dtype=float)
        f = open(self.filename, 'w')
        x.tofile(f, sep=',')
        f.close()
        f = open(self.filename, 'r')
        s = f.read()
        f.close()
        #assert_equal(s, '1.51,2.0,3.51,4.0')
        y = np.array([float(p) for p in s.split(',')])
        assert_array_equal(x,y)

    def test_tofile_format(self):
        x = np.array([1.51, 2, 3.51, 4], dtype=float)
        f = open(self.filename, 'w')
        x.tofile(f, sep=',', format='%.2f')
        f.close()
        f = open(self.filename, 'r')
        s = f.read()
        f.close()
        assert_equal(s, '1.51,2.00,3.51,4.00')

    def test_locale(self):
        in_foreign_locale(self.test_numbers)()
        in_foreign_locale(self.test_nan)()
        in_foreign_locale(self.test_inf)()
        in_foreign_locale(self.test_counted_string)()
        in_foreign_locale(self.test_ascii)()
        in_foreign_locale(self.test_malformed)()
        in_foreign_locale(self.test_tofile_sep)()
        in_foreign_locale(self.test_tofile_format)()


class TestFromBuffer(object):
    def tst_basic(self, buffer, expected, kwargs):
        assert_array_equal(np.frombuffer(buffer,**kwargs), expected)

    def test_ip_basic(self):
        for byteorder in ['<', '>']:
            for dtype in [float, int, np.complex]:
                dt = np.dtype(dtype).newbyteorder(byteorder)
                x = (np.random.random((4, 7))*5).astype(dt)
                buf = x.tobytes()
                yield self.tst_basic, buf, x.flat, {'dtype':dt}

    def test_empty(self):
        yield self.tst_basic, b'', np.array([]), {}


class TestFlat(TestCase):
    def setUp(self):
        a0 = np.arange(20.0)
        a = a0.reshape(4, 5)
        a0.shape = (4, 5)
        a.flags.writeable = False
        self.a = a
        self.b = a[::2, ::2]
        self.a0 = a0
        self.b0 = a0[::2, ::2]

    def test_contiguous(self):
        testpassed = False
        try:
            self.a.flat[12] = 100.0
        except ValueError:
            testpassed = True
        assert_(testpassed)
        assert_(self.a.flat[12] == 12.0)

    def test_discontiguous(self):
        testpassed = False
        try:
            self.b.flat[4] = 100.0
        except ValueError:
            testpassed = True
        assert_(testpassed)
        assert_(self.b.flat[4] == 12.0)

    def test___array__(self):
        c = self.a.flat.__array__()
        d = self.b.flat.__array__()
        e = self.a0.flat.__array__()
        f = self.b0.flat.__array__()

        assert_(c.flags.writeable is False)
        assert_(d.flags.writeable is False)
        assert_(e.flags.writeable is True)
        assert_(f.flags.writeable is True)

        assert_(c.flags.updateifcopy is False)
        assert_(d.flags.updateifcopy is False)
        assert_(e.flags.updateifcopy is False)
        assert_(f.flags.updateifcopy is True)
        assert_(f.base is self.b0)


class TestResize(TestCase):
    def test_basic(self):
        x = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
        if IS_PYPY:
            x.resize((5, 5), refcheck=False)
        else:
            x.resize((5, 5))
        assert_array_equal(x.flat[:9],
                np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]]).flat)
        assert_array_equal(x[9:].flat, 0)

    def test_check_reference(self):
        x = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
        y = x
        self.assertRaises(ValueError, x.resize, (5, 1))
        del y  # avoid pyflakes unused variable warning.

    def test_int_shape(self):
        x = np.eye(3)
        if IS_PYPY:
            x.resize(3, refcheck=False)
        else:
            x.resize(3)
        assert_array_equal(x, np.eye(3)[0,:])

    def test_none_shape(self):
        x = np.eye(3)
        x.resize(None)
        assert_array_equal(x, np.eye(3))
        x.resize()
        assert_array_equal(x, np.eye(3))

    def test_invalid_arguments(self):
        self.assertRaises(TypeError, np.eye(3).resize, 'hi')
        self.assertRaises(ValueError, np.eye(3).resize, -1)
        self.assertRaises(TypeError, np.eye(3).resize, order=1)
        self.assertRaises(TypeError, np.eye(3).resize, refcheck='hi')

    def test_freeform_shape(self):
        x = np.eye(3)
        if IS_PYPY:
            x.resize(3, 2, 1, refcheck=False)
        else:
            x.resize(3, 2, 1)
        assert_(x.shape == (3, 2, 1))

    def test_zeros_appended(self):
        x = np.eye(3)
        if IS_PYPY:
            x.resize(2, 3, 3, refcheck=False)
        else:
            x.resize(2, 3, 3)
        assert_array_equal(x[0], np.eye(3))
        assert_array_equal(x[1], np.zeros((3, 3)))

    def test_obj_obj(self):
        # check memory is initialized on resize, gh-4857
        a = np.ones(10, dtype=[('k', object, 2)])
        if IS_PYPY:
            a.resize(15, refcheck=False)
        else:
            a.resize(15,)
        assert_equal(a.shape, (15,))
        assert_array_equal(a['k'][-5:], 0)
        assert_array_equal(a['k'][:-5], 1)


class TestRecord(TestCase):
    def test_field_rename(self):
        dt = np.dtype([('f', float), ('i', int)])
        dt.names = ['p', 'q']
        assert_equal(dt.names, ['p', 'q'])

    def test_multiple_field_name_occurrence(self):
        def test_assign():
            dtype = np.dtype([("A", "f8"), ("B", "f8"), ("A", "f8")])

        # Error raised when multiple fields have the same name
        assert_raises(ValueError, test_assign)

    if sys.version_info[0] >= 3:
        def test_bytes_fields(self):
            # Bytes are not allowed in field names and not recognized in titles
            # on Py3
            assert_raises(TypeError, np.dtype, [(b'a', int)])
            assert_raises(TypeError, np.dtype, [(('b', b'a'), int)])

            dt = np.dtype([((b'a', 'b'), int)])
            assert_raises(ValueError, dt.__getitem__, b'a')

            x = np.array([(1,), (2,), (3,)], dtype=dt)
            assert_raises(IndexError, x.__getitem__, b'a')

            y = x[0]
            assert_raises(IndexError, y.__getitem__, b'a')

        def test_multiple_field_name_unicode(self):
            def test_assign_unicode():
                dt = np.dtype([("\u20B9", "f8"),
                               ("B", "f8"),
                               ("\u20B9", "f8")])

            # Error raised when multiple fields have the same name(unicode included)
            assert_raises(ValueError, test_assign_unicode)

    else:
        def test_unicode_field_titles(self):
            # Unicode field titles are added to field dict on Py2
            title = u'b'
            dt = np.dtype([((title, 'a'), int)])
            dt[title]
            dt['a']
            x = np.array([(1,), (2,), (3,)], dtype=dt)
            x[title]
            x['a']
            y = x[0]
            y[title]
            y['a']

        def test_unicode_field_names(self):
            # Unicode field names are not allowed on Py2
            title = u'b'
            assert_raises(TypeError, np.dtype, [(title, int)])
            assert_raises(TypeError, np.dtype, [(('a', title), int)])

    def test_field_names(self):
        # Test unicode and 8-bit / byte strings can be used
        a = np.zeros((1,), dtype=[('f1', 'i4'),
                                  ('f2', 'i4'),
                                  ('f3', [('sf1', 'i4')])])
        is_py3 = sys.version_info[0] >= 3
        if is_py3:
            funcs = (str,)
            # byte string indexing fails gracefully
            assert_raises(IndexError, a.__setitem__, b'f1', 1)
            assert_raises(IndexError, a.__getitem__, b'f1')
            assert_raises(IndexError, a['f1'].__setitem__, b'sf1', 1)
            assert_raises(IndexError, a['f1'].__getitem__, b'sf1')
        else:
            funcs = (str, unicode)
        for func in funcs:
            b = a.copy()
            fn1 = func('f1')
            b[fn1] = 1
            assert_equal(b[fn1], 1)
            fnn = func('not at all')
            assert_raises(ValueError, b.__setitem__, fnn, 1)
            assert_raises(ValueError, b.__getitem__, fnn)
            b[0][fn1] = 2
            assert_equal(b[fn1], 2)
            # Subfield
            assert_raises(ValueError, b[0].__setitem__, fnn, 1)
            assert_raises(ValueError, b[0].__getitem__, fnn)
            # Subfield
            fn3 = func('f3')
            sfn1 = func('sf1')
            b[fn3][sfn1] = 1
            assert_equal(b[fn3][sfn1], 1)
            assert_raises(ValueError, b[fn3].__setitem__, fnn, 1)
            assert_raises(ValueError, b[fn3].__getitem__, fnn)
            # multiple subfields
            fn2 = func('f2')
            b[fn2] = 3
            with suppress_warnings() as sup:
                sup.filter(FutureWarning,
                           "Assignment between structured arrays.*")
                sup.filter(FutureWarning,
                           "Numpy has detected that you .*")

                assert_equal(b[['f1', 'f2']][0].tolist(), (2, 3))
                assert_equal(b[['f2', 'f1']][0].tolist(), (3, 2))
                assert_equal(b[['f1', 'f3']][0].tolist(), (2, (1,)))
                # view of subfield view/copy
                assert_equal(b[['f1', 'f2']][0].view(('i4', 2)).tolist(),
                             (2, 3))
                assert_equal(b[['f2', 'f1']][0].view(('i4', 2)).tolist(),
                             (3, 2))
                view_dtype = [('f1', 'i4'), ('f3', [('', 'i4')])]
                assert_equal(b[['f1', 'f3']][0].view(view_dtype).tolist(),
                             (2, (1,)))
        # non-ascii unicode field indexing is well behaved
        if not is_py3:
            raise SkipTest('non ascii unicode field indexing skipped; '
                           'raises segfault on python 2.x')
        else:
            assert_raises(ValueError, a.__setitem__, u'\u03e0', 1)
            assert_raises(ValueError, a.__getitem__, u'\u03e0')

    def test_field_names_deprecation(self):

        def collect_warnings(f, *args, **kwargs):
            with warnings.catch_warnings(record=True) as log:
                warnings.simplefilter("always")
                f(*args, **kwargs)
            return [w.category for w in log]

        a = np.zeros((1,), dtype=[('f1', 'i4'),
                                  ('f2', 'i4'),
                                  ('f3', [('sf1', 'i4')])])
        a['f1'][0] = 1
        a['f2'][0] = 2
        a['f3'][0] = (3,)
        b = np.zeros((1,), dtype=[('f1', 'i4'),
                                  ('f2', 'i4'),
                                  ('f3', [('sf1', 'i4')])])
        b['f1'][0] = 1
        b['f2'][0] = 2
        b['f3'][0] = (3,)

        # All the different functions raise a warning, but not an error
        assert_equal(collect_warnings(a[['f1', 'f2']].__setitem__, 0, (10, 20)),
                     [FutureWarning])
        # For <=1.12 a is not modified, but it will be in 1.13
        assert_equal(a, b)

        # Views also warn
        subset = a[['f1', 'f2']]
        subset_view = subset.view()
        assert_equal(collect_warnings(subset_view['f1'].__setitem__, 0, 10),
                     [FutureWarning])
        # But the write goes through:
        assert_equal(subset['f1'][0], 10)
        # Only one warning per multiple field indexing, though (even if there
        # are multiple views involved):
        assert_equal(collect_warnings(subset['f1'].__setitem__, 0, 10), [])

        # make sure views of a multi-field index warn too
        c = np.zeros(3, dtype='i8,i8,i8')
        assert_equal(collect_warnings(c[['f0', 'f2']].view, 'i8,i8'),
                     [FutureWarning])

        # make sure assignment using a different dtype warns
        a = np.zeros(2, dtype=[('a', 'i4'), ('b', 'i4')])
        b = np.zeros(2, dtype=[('b', 'i4'), ('a', 'i4')])
        assert_equal(collect_warnings(a.__setitem__, (), b), [FutureWarning])

    def test_record_hash(self):
        a = np.array([(1, 2), (1, 2)], dtype='i1,i2')
        a.flags.writeable = False
        b = np.array([(1, 2), (3, 4)], dtype=[('num1', 'i1'), ('num2', 'i2')])
        b.flags.writeable = False
        c = np.array([(1, 2), (3, 4)], dtype='i1,i2')
        c.flags.writeable = False
        self.assertTrue(hash(a[0]) == hash(a[1]))
        self.assertTrue(hash(a[0]) == hash(b[0]))
        self.assertTrue(hash(a[0]) != hash(b[1]))
        self.assertTrue(hash(c[0]) == hash(a[0]) and c[0] == a[0])

    def test_record_no_hash(self):
        a = np.array([(1, 2), (1, 2)], dtype='i1,i2')
        self.assertRaises(TypeError, hash, a[0])

    def test_empty_structure_creation(self):
        # make sure these do not raise errors (gh-5631)
        np.array([()], dtype={'names': [], 'formats': [],
                           'offsets': [], 'itemsize': 12})
        np.array([(), (), (), (), ()], dtype={'names': [], 'formats': [],
                                           'offsets': [], 'itemsize': 12})

class TestView(TestCase):
    def test_basic(self):
        x = np.array([(1, 2, 3, 4), (5, 6, 7, 8)],
                     dtype=[('r', np.int8), ('g', np.int8),
                            ('b', np.int8), ('a', np.int8)])
        # We must be specific about the endianness here:
        y = x.view(dtype='<i4')
        # ... and again without the keyword.
        z = x.view('<i4')
        assert_array_equal(y, z)
        assert_array_equal(y, [67305985, 134678021])


def _mean(a, **args):
    return a.mean(**args)


def _var(a, **args):
    return a.var(**args)


def _std(a, **args):
    return a.std(**args)


class TestStats(TestCase):

    funcs = [_mean, _var, _std]

    def setUp(self):
        np.random.seed(range(3))
        self.rmat = np.random.random((4, 5))
        self.cmat = self.rmat + 1j * self.rmat
        self.omat = np.array([Decimal(repr(r)) for r in self.rmat.flat])
        self.omat = self.omat.reshape(4, 5)

    def test_python_type(self):
        for x in (np.float16(1.), 1, 1., 1+0j):
            assert_equal(np.mean([x]), 1.)
            assert_equal(np.std([x]), 0.)
            assert_equal(np.var([x]), 0.)

    def test_keepdims(self):
        mat = np.eye(3)
        for f in self.funcs:
            for axis in [0, 1]:
                res = f(mat, axis=axis, keepdims=True)
                assert_(res.ndim == mat.ndim)
                assert_(res.shape[axis] == 1)
            for axis in [None]:
                res = f(mat, axis=axis, keepdims=True)
                assert_(res.shape == (1, 1))

    def test_out(self):
        mat = np.eye(3)
        for f in self.funcs:
            out = np.zeros(3)
            tgt = f(mat, axis=1)
            res = f(mat, axis=1, out=out)
            assert_almost_equal(res, out)
            assert_almost_equal(res, tgt)
        out = np.empty(2)
        assert_raises(ValueError, f, mat, axis=1, out=out)
        out = np.empty((2, 2))
        assert_raises(ValueError, f, mat, axis=1, out=out)

    def test_dtype_from_input(self):

        icodes = np.typecodes['AllInteger']
        fcodes = np.typecodes['AllFloat']

        # object type
        for f in self.funcs:
            mat = np.array([[Decimal(1)]*3]*3)
            tgt = mat.dtype.type
            res = f(mat, axis=1).dtype.type
            assert_(res is tgt)
            # scalar case
            res = type(f(mat, axis=None))
            assert_(res is Decimal)

        # integer types
        for f in self.funcs:
            for c in icodes:
                mat = np.eye(3, dtype=c)
                tgt = np.float64
                res = f(mat, axis=1).dtype.type
                assert_(res is tgt)
                # scalar case
                res = f(mat, axis=None).dtype.type
                assert_(res is tgt)

        # mean for float types
        for f in [_mean]:
            for c in fcodes:
                mat = np.eye(3, dtype=c)
                tgt = mat.dtype.type
                res = f(mat, axis=1).dtype.type
                assert_(res is tgt)
                # scalar case
                res = f(mat, axis=None).dtype.type
                assert_(res is tgt)

        # var, std for float types
        for f in [_var, _std]:
            for c in fcodes:
                mat = np.eye(3, dtype=c)
                # deal with complex types
                tgt = mat.real.dtype.type
                res = f(mat, axis=1).dtype.type
                assert_(res is tgt)
                # scalar case
                res = f(mat, axis=None).dtype.type
                assert_(res is tgt)

    def test_dtype_from_dtype(self):
        mat = np.eye(3)

        # stats for integer types
        # FIXME:
        # this needs definition as there are lots places along the line
        # where type casting may take place.

        # for f in self.funcs:
        #    for c in np.typecodes['AllInteger']:
        #        tgt = np.dtype(c).type
        #        res = f(mat, axis=1, dtype=c).dtype.type
        #        assert_(res is tgt)
        #        # scalar case
        #        res = f(mat, axis=None, dtype=c).dtype.type
        #        assert_(res is tgt)

        # stats for float types
        for f in self.funcs:
            for c in np.typecodes['AllFloat']:
                tgt = np.dtype(c).type
                res = f(mat, axis=1, dtype=c).dtype.type
                assert_(res is tgt)
                # scalar case
                res = f(mat, axis=None, dtype=c).dtype.type
                assert_(res is tgt)

    def test_ddof(self):
        for f in [_var]:
            for ddof in range(3):
                dim = self.rmat.shape[1]
                tgt = f(self.rmat, axis=1) * dim
                res = f(self.rmat, axis=1, ddof=ddof) * (dim - ddof)
        for f in [_std]:
            for ddof in range(3):
                dim = self.rmat.shape[1]
                tgt = f(self.rmat, axis=1) * np.sqrt(dim)
                res = f(self.rmat, axis=1, ddof=ddof) * np.sqrt(dim - ddof)
                assert_almost_equal(res, tgt)
                assert_almost_equal(res, tgt)

    def test_ddof_too_big(self):
        dim = self.rmat.shape[1]
        for f in [_var, _std]:
            for ddof in range(dim, dim + 2):
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter('always')
                    res = f(self.rmat, axis=1, ddof=ddof)
                    assert_(not (res < 0).any())
                    assert_(len(w) > 0)
                    assert_(issubclass(w[0].category, RuntimeWarning))

    def test_empty(self):
        A = np.zeros((0, 3))
        for f in self.funcs:
            for axis in [0, None]:
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter('always')
                    assert_(np.isnan(f(A, axis=axis)).all())
                    assert_(len(w) > 0)
                    assert_(issubclass(w[0].category, RuntimeWarning))
            for axis in [1]:
                with warnings.catch_warnings(record=True) as w:
                    warnings.simplefilter('always')
                    assert_equal(f(A, axis=axis), np.zeros([]))

    def test_mean_values(self):
        for mat in [self.rmat, self.cmat, self.omat]:
            for axis in [0, 1]:
                tgt = mat.sum(axis=axis)
                res = _mean(mat, axis=axis) * mat.shape[axis]
                assert_almost_equal(res, tgt)
            for axis in [None]:
                tgt = mat.sum(axis=axis)
                res = _mean(mat, axis=axis) * np.prod(mat.shape)
                assert_almost_equal(res, tgt)

    def test_mean_float16(self):
        # This fail if the sum inside mean is done in float16 instead
        # of float32.
        assert _mean(np.ones(100000, dtype='float16')) == 1

    def test_var_values(self):
        for mat in [self.rmat, self.cmat, self.omat]:
            for axis in [0, 1, None]:
                msqr = _mean(mat * mat.conj(), axis=axis)
                mean = _mean(mat, axis=axis)
                tgt = msqr - mean * mean.conjugate()
                res = _var(mat, axis=axis)
                assert_almost_equal(res, tgt)

    def test_std_values(self):
        for mat in [self.rmat, self.cmat, self.omat]:
            for axis in [0, 1, None]:
                tgt = np.sqrt(_var(mat, axis=axis))
                res = _std(mat, axis=axis)
                assert_almost_equal(res, tgt)

    def test_subclass(self):
        class TestArray(np.ndarray):
            def __new__(cls, data, info):
                result = np.array(data)
                result = result.view(cls)
                result.info = info
                return result

            def __array_finalize__(self, obj):
                self.info = getattr(obj, "info", '')

        dat = TestArray([[1, 2, 3, 4], [5, 6, 7, 8]], 'jubba')
        res = dat.mean(1)
        assert_(res.info == dat.info)
        res = dat.std(1)
        assert_(res.info == dat.info)
        res = dat.var(1)
        assert_(res.info == dat.info)

class TestVdot(TestCase):
    def test_basic(self):
        dt_numeric = np.typecodes['AllFloat'] + np.typecodes['AllInteger']
        dt_complex = np.typecodes['Complex']

        # test real
        a = np.eye(3)
        for dt in dt_numeric + 'O':
            b = a.astype(dt)
            res = np.vdot(b, b)
            assert_(np.isscalar(res))
            assert_equal(np.vdot(b, b), 3)

        # test complex
        a = np.eye(3) * 1j
        for dt in dt_complex + 'O':
            b = a.astype(dt)
            res = np.vdot(b, b)
            assert_(np.isscalar(res))
            assert_equal(np.vdot(b, b), 3)

        # test boolean
        b = np.eye(3, dtype=np.bool)
        res = np.vdot(b, b)
        assert_(np.isscalar(res))
        assert_equal(np.vdot(b, b), True)

    def test_vdot_array_order(self):
        a = np.array([[1, 2], [3, 4]], order='C')
        b = np.array([[1, 2], [3, 4]], order='F')
        res = np.vdot(a, a)

        # integer arrays are exact
        assert_equal(np.vdot(a, b), res)
        assert_equal(np.vdot(b, a), res)
        assert_equal(np.vdot(b, b), res)

    def test_vdot_uncontiguous(self):
        for size in [2, 1000]:
            # Different sizes match different branches in vdot.
            a = np.zeros((size, 2, 2))
            b = np.zeros((size, 2, 2))
            a[:, 0, 0] = np.arange(size)
            b[:, 0, 0] = np.arange(size) + 1
            # Make a and b uncontiguous:
            a = a[..., 0]
            b = b[..., 0]

            assert_equal(np.vdot(a, b),
                         np.vdot(a.flatten(), b.flatten()))
            assert_equal(np.vdot(a, b.copy()),
                         np.vdot(a.flatten(), b.flatten()))
            assert_equal(np.vdot(a.copy(), b),
                         np.vdot(a.flatten(), b.flatten()))
            assert_equal(np.vdot(a.copy('F'), b),
                         np.vdot(a.flatten(), b.flatten()))
            assert_equal(np.vdot(a, b.copy('F')),
                         np.vdot(a.flatten(), b.flatten()))


class TestDot(TestCase):
    def setUp(self):
        np.random.seed(128)
        self.A = np.random.rand(4, 2)
        self.b1 = np.random.rand(2, 1)
        self.b2 = np.random.rand(2)
        self.b3 = np.random.rand(1, 2)
        self.b4 = np.random.rand(4)
        self.N = 7

    def test_dotmatmat(self):
        A = self.A
        res = np.dot(A.transpose(), A)
        tgt = np.array([[1.45046013, 0.86323640],
                        [0.86323640, 0.84934569]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotmatvec(self):
        A, b1 = self.A, self.b1
        res = np.dot(A, b1)
        tgt = np.array([[0.32114320], [0.04889721],
                        [0.15696029], [0.33612621]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotmatvec2(self):
        A, b2 = self.A, self.b2
        res = np.dot(A, b2)
        tgt = np.array([0.29677940, 0.04518649, 0.14468333, 0.31039293])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecmat(self):
        A, b4 = self.A, self.b4
        res = np.dot(b4, A)
        tgt = np.array([1.23495091, 1.12222648])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecmat2(self):
        b3, A = self.b3, self.A
        res = np.dot(b3, A.transpose())
        tgt = np.array([[0.58793804, 0.08957460, 0.30605758, 0.62716383]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecmat3(self):
        A, b4 = self.A, self.b4
        res = np.dot(A.transpose(), b4)
        tgt = np.array([1.23495091, 1.12222648])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecvecouter(self):
        b1, b3 = self.b1, self.b3
        res = np.dot(b1, b3)
        tgt = np.array([[0.20128610, 0.08400440], [0.07190947, 0.03001058]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecvecinner(self):
        b1, b3 = self.b1, self.b3
        res = np.dot(b3, b1)
        tgt = np.array([[ 0.23129668]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotcolumnvect1(self):
        b1 = np.ones((3, 1))
        b2 = [5.3]
        res = np.dot(b1, b2)
        tgt = np.array([5.3, 5.3, 5.3])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotcolumnvect2(self):
        b1 = np.ones((3, 1)).transpose()
        b2 = [6.2]
        res = np.dot(b2, b1)
        tgt = np.array([6.2, 6.2, 6.2])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecscalar(self):
        np.random.seed(100)
        b1 = np.random.rand(1, 1)
        b2 = np.random.rand(1, 4)
        res = np.dot(b1, b2)
        tgt = np.array([[0.15126730, 0.23068496, 0.45905553, 0.00256425]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_dotvecscalar2(self):
        np.random.seed(100)
        b1 = np.random.rand(4, 1)
        b2 = np.random.rand(1, 1)
        res = np.dot(b1, b2)
        tgt = np.array([[0.00256425],[0.00131359],[0.00200324],[ 0.00398638]])
        assert_almost_equal(res, tgt, decimal=self.N)

    def test_all(self):
        dims = [(), (1,), (1, 1)]
        dout = [(), (1,), (1, 1), (1,), (), (1,), (1, 1), (1,), (1, 1)]
        for dim, (dim1, dim2) in zip(dout, itertools.product(dims, dims)):
            b1 = np.zeros(dim1)
            b2 = np.zeros(dim2)
            res = np.dot(b1, b2)
            tgt = np.zeros(dim)
            assert_(res.shape == tgt.shape)
            assert_almost_equal(res, tgt, decimal=self.N)

    def test_vecobject(self):
        class Vec(object):
            def __init__(self, sequence=None):
                if sequence is None:
                    sequence = []
                self.array = np.array(sequence)

            def __add__(self, other):
                out = Vec()
                out.array = self.array + other.array
                return out

            def __sub__(self, other):
                out = Vec()
                out.array = self.array - other.array
                return out

            def __mul__(self, other):  # with scalar
                out = Vec(self.array.copy())
                out.array *= other
                return out

            def __rmul__(self, other):
                return self*other

        U_non_cont = np.transpose([[1., 1.], [1., 2.]])
        U_cont = np.ascontiguousarray(U_non_cont)
        x = np.array([Vec([1., 0.]), Vec([0., 1.])])
        zeros = np.array([Vec([0., 0.]), Vec([0., 0.])])
        zeros_test = np.dot(U_cont, x) - np.dot(U_non_cont, x)
        assert_equal(zeros[0].array, zeros_test[0].array)
        assert_equal(zeros[1].array, zeros_test[1].array)

    def test_dot_2args(self):
        from numpy.core.multiarray import dot

        a = np.array([[1, 2], [3, 4]], dtype=float)
        b = np.array([[1, 0], [1, 1]], dtype=float)
        c = np.array([[3, 2], [7, 4]], dtype=float)

        d = dot(a, b)
        assert_allclose(c, d)

    def test_dot_3args(self):
        from numpy.core.multiarray import dot

        np.random.seed(22)
        f = np.random.random_sample((1024, 16))
        v = np.random.random_sample((16, 32))

        r = np.empty((1024, 32))
        for i in range(12):
            dot(f, v, r)
        if HAS_REFCOUNT:
            assert_equal(sys.getrefcount(r), 2)
        r2 = dot(f, v, out=None)
        assert_array_equal(r2, r)
        assert_(r is dot(f, v, out=r))

        v = v[:, 0].copy()  # v.shape == (16,)
        r = r[:, 0].copy()  # r.shape == (1024,)
        r2 = dot(f, v)
        assert_(r is dot(f, v, r))
        assert_array_equal(r2, r)

    def test_dot_3args_errors(self):
        from numpy.core.multiarray import dot

        np.random.seed(22)
        f = np.random.random_sample((1024, 16))
        v = np.random.random_sample((16, 32))

        r = np.empty((1024, 31))
        assert_raises(ValueError, dot, f, v, r)

        r = np.empty((1024,))
        assert_raises(ValueError, dot, f, v, r)

        r = np.empty((32,))
        assert_raises(ValueError, dot, f, v, r)

        r = np.empty((32, 1024))
        assert_raises(ValueError, dot, f, v, r)
        assert_raises(ValueError, dot, f, v, r.T)

        r = np.empty((1024, 64))
        assert_raises(ValueError, dot, f, v, r[:, ::2])
        assert_raises(ValueError, dot, f, v, r[:, :32])

        r = np.empty((1024, 32), dtype=np.float32)
        assert_raises(ValueError, dot, f, v, r)

        r = np.empty((1024, 32), dtype=int)
        assert_raises(ValueError, dot, f, v, r)

    def test_dot_array_order(self):
        a = np.array([[1, 2], [3, 4]], order='C')
        b = np.array([[1, 2], [3, 4]], order='F')
        res = np.dot(a, a)

        # integer arrays are exact
        assert_equal(np.dot(a, b), res)
        assert_equal(np.dot(b, a), res)
        assert_equal(np.dot(b, b), res)

    def test_dot_scalar_and_matrix_of_objects(self):
        # Ticket #2469
        arr = np.matrix([1, 2], dtype=object)
        desired = np.matrix([[3, 6]], dtype=object)
        assert_equal(np.dot(arr, 3), desired)
        assert_equal(np.dot(3, arr), desired)

    def test_accelerate_framework_sgemv_fix(self):

        def aligned_array(shape, align, dtype, order='C'):
            d = dtype(0)
            N = np.prod(shape)
            tmp = np.zeros(N * d.nbytes + align, dtype=np.uint8)
            address = tmp.__array_interface__["data"][0]
            for offset in range(align):
                if (address + offset) % align == 0:
                    break
            tmp = tmp[offset:offset+N*d.nbytes].view(dtype=dtype)
            return tmp.reshape(shape, order=order)

        def as_aligned(arr, align, dtype, order='C'):
            aligned = aligned_array(arr.shape, align, dtype, order)
            aligned[:] = arr[:]
            return aligned

        def assert_dot_close(A, X, desired):
            assert_allclose(np.dot(A, X), desired, rtol=1e-5, atol=1e-7)

        m = aligned_array(100, 15, np.float32)
        s = aligned_array((100, 100), 15, np.float32)
        np.dot(s, m)  # this will always segfault if the bug is present

        testdata = itertools.product((15,32), (10000,), (200,89), ('C','F'))
        for align, m, n, a_order in testdata:
            # Calculation in double precision
            A_d = np.random.rand(m, n)
            X_d = np.random.rand(n)
            desired = np.dot(A_d, X_d)
            # Calculation with aligned single precision
            A_f = as_aligned(A_d, align, np.float32, order=a_order)
            X_f = as_aligned(X_d, align, np.float32)
            assert_dot_close(A_f, X_f, desired)
            # Strided A rows
            A_d_2 = A_d[::2]
            desired = np.dot(A_d_2, X_d)
            A_f_2 = A_f[::2]
            assert_dot_close(A_f_2, X_f, desired)
            # Strided A columns, strided X vector
            A_d_22 = A_d_2[:, ::2]
            X_d_2 = X_d[::2]
            desired = np.dot(A_d_22, X_d_2)
            A_f_22 = A_f_2[:, ::2]
            X_f_2 = X_f[::2]
            assert_dot_close(A_f_22, X_f_2, desired)
            # Check the strides are as expected
            if a_order == 'F':
                assert_equal(A_f_22.strides, (8, 8 * m))
            else:
                assert_equal(A_f_22.strides, (8 * n, 8))
            assert_equal(X_f_2.strides, (8,))
            # Strides in A rows + cols only
            X_f_2c = as_aligned(X_f_2, align, np.float32)
            assert_dot_close(A_f_22, X_f_2c, desired)
            # Strides just in A cols
            A_d_12 = A_d[:, ::2]
            desired = np.dot(A_d_12, X_d_2)
            A_f_12 = A_f[:, ::2]
            assert_dot_close(A_f_12, X_f_2c, desired)
            # Strides in A cols and X
            assert_dot_close(A_f_12, X_f_2, desired)


class MatmulCommon():
    """Common tests for '@' operator and numpy.matmul.

    Do not derive from TestCase to avoid nose running it.

    """
    # Should work with these types. Will want to add
    # "O" at some point
    types = "?bhilqBHILQefdgFDG"

    def test_exceptions(self):
        dims = [
            ((1,), (2,)),            # mismatched vector vector
            ((2, 1,), (2,)),         # mismatched matrix vector
            ((2,), (1, 2)),          # mismatched vector matrix
            ((1, 2), (3, 1)),        # mismatched matrix matrix
            ((1,), ()),              # vector scalar
            ((), (1)),               # scalar vector
            ((1, 1), ()),            # matrix scalar
            ((), (1, 1)),            # scalar matrix
            ((2, 2, 1), (3, 1, 2)),  # cannot broadcast
            ]

        for dt, (dm1, dm2) in itertools.product(self.types, dims):
            a = np.ones(dm1, dtype=dt)
            b = np.ones(dm2, dtype=dt)
            assert_raises(ValueError, self.matmul, a, b)

    def test_shapes(self):
        dims = [
            ((1, 1), (2, 1, 1)),     # broadcast first argument
            ((2, 1, 1), (1, 1)),     # broadcast second argument
            ((2, 1, 1), (2, 1, 1)),  # matrix stack sizes match
            ]

        for dt, (dm1, dm2) in itertools.product(self.types, dims):
            a = np.ones(dm1, dtype=dt)
            b = np.ones(dm2, dtype=dt)
            res = self.matmul(a, b)
            assert_(res.shape == (2, 1, 1))

        # vector vector returns scalars.
        for dt in self.types:
            a = np.ones((2,), dtype=dt)
            b = np.ones((2,), dtype=dt)
            c = self.matmul(a, b)
            assert_(np.array(c).shape == ())

    def test_result_types(self):
        mat = np.ones((1,1))
        vec = np.ones((1,))
        for dt in self.types:
            m = mat.astype(dt)
            v = vec.astype(dt)
            for arg in [(m, v), (v, m), (m, m)]:
                res = self.matmul(*arg)
                assert_(res.dtype == dt)

            # vector vector returns scalars
            res = self.matmul(v, v)
            assert_(type(res) is np.dtype(dt).type)

    def test_vector_vector_values(self):
        vec = np.array([1, 2])
        tgt = 5
        for dt in self.types[1:]:
            v1 = vec.astype(dt)
            res = self.matmul(v1, v1)
            assert_equal(res, tgt)

        # boolean type
        vec = np.array([True, True], dtype='?')
        res = self.matmul(vec, vec)
        assert_equal(res, True)

    def test_vector_matrix_values(self):
        vec = np.array([1, 2])
        mat1 = np.array([[1, 2], [3, 4]])
        mat2 = np.stack([mat1]*2, axis=0)
        tgt1 = np.array([7, 10])
        tgt2 = np.stack([tgt1]*2, axis=0)
        for dt in self.types[1:]:
            v = vec.astype(dt)
            m1 = mat1.astype(dt)
            m2 = mat2.astype(dt)
            res = self.matmul(v, m1)
            assert_equal(res, tgt1)
            res = self.matmul(v, m2)
            assert_equal(res, tgt2)

        # boolean type
        vec = np.array([True, False])
        mat1 = np.array([[True, False], [False, True]])
        mat2 = np.stack([mat1]*2, axis=0)
        tgt1 = np.array([True, False])
        tgt2 = np.stack([tgt1]*2, axis=0)

        res = self.matmul(vec, mat1)
        assert_equal(res, tgt1)
        res = self.matmul(vec, mat2)
        assert_equal(res, tgt2)

    def test_matrix_vector_values(self):
        vec = np.array([1, 2])
        mat1 = np.array([[1, 2], [3, 4]])
        mat2 = np.stack([mat1]*2, axis=0)
        tgt1 = np.array([5, 11])
        tgt2 = np.stack([tgt1]*2, axis=0)
        for dt in self.types[1:]:
            v = vec.astype(dt)
            m1 = mat1.astype(dt)
            m2 = mat2.astype(dt)
            res = self.matmul(m1, v)
            assert_equal(res, tgt1)
            res = self.matmul(m2, v)
            assert_equal(res, tgt2)

        # boolean type
        vec = np.array([True, False])
        mat1 = np.array([[True, False], [False, True]])
        mat2 = np.stack([mat1]*2, axis=0)
        tgt1 = np.array([True, False])
        tgt2 = np.stack([tgt1]*2, axis=0)

        res = self.matmul(vec, mat1)
        assert_equal(res, tgt1)
        res = self.matmul(vec, mat2)
        assert_equal(res, tgt2)

    def test_matrix_matrix_values(self):
        mat1 = np.array([[1, 2], [3, 4]])
        mat2 = np.array([[1, 0], [1, 1]])
        mat12 = np.stack([mat1, mat2], axis=0)
        mat21 = np.stack([mat2, mat1], axis=0)
        tgt11 = np.array([[7, 10], [15, 22]])
        tgt12 = np.array([[3, 2], [7, 4]])
        tgt21 = np.array([[1, 2], [4, 6]])
        tgt12_21 = np.stack([tgt12, tgt21], axis=0)
        tgt11_12 = np.stack((tgt11, tgt12), axis=0)
        tgt11_21 = np.stack((tgt11, tgt21), axis=0)
        for dt in self.types[1:]:
            m1 = mat1.astype(dt)
            m2 = mat2.astype(dt)
            m12 = mat12.astype(dt)
            m21 = mat21.astype(dt)

            # matrix @ matrix
            res = self.matmul(m1, m2)
            assert_equal(res, tgt12)
            res = self.matmul(m2, m1)
            assert_equal(res, tgt21)

            # stacked @ matrix
            res = self.matmul(m12, m1)
            assert_equal(res, tgt11_21)

            # matrix @ stacked
            res = self.matmul(m1, m12)
            assert_equal(res, tgt11_12)

            # stacked @ stacked
            res = self.matmul(m12, m21)
            assert_equal(res, tgt12_21)

        # boolean type
        m1 = np.array([[1, 1], [0, 0]], dtype=np.bool_)
        m2 = np.array([[1, 0], [1, 1]], dtype=np.bool_)
        m12 = np.stack([m1, m2], axis=0)
        m21 = np.stack([m2, m1], axis=0)
        tgt11 = m1
        tgt12 = m1
        tgt21 = np.array([[1, 1], [1, 1]], dtype=np.bool_)
        tgt12_21 = np.stack([tgt12, tgt21], axis=0)
        tgt11_12 = np.stack((tgt11, tgt12), axis=0)
        tgt11_21 = np.stack((tgt11, tgt21), axis=0)

        # matrix @ matrix
        res = self.matmul(m1, m2)
        assert_equal(res, tgt12)
        res = self.matmul(m2, m1)
        assert_equal(res, tgt21)

        # stacked @ matrix
        res = self.matmul(m12, m1)
        assert_equal(res, tgt11_21)

        # matrix @ stacked
        res = self.matmul(m1, m12)
        assert_equal(res, tgt11_12)

        # stacked @ stacked
        res = self.matmul(m12, m21)
        assert_equal(res, tgt12_21)


class TestMatmul(MatmulCommon, TestCase):
    matmul = np.matmul

    def test_out_arg(self):
        a = np.ones((2, 2), dtype=np.float)
        b = np.ones((2, 2), dtype=np.float)
        tgt = np.full((2,2), 2, dtype=np.float)

        # test as positional argument
        msg = "out positional argument"
        out = np.zeros((2, 2), dtype=np.float)
        self.matmul(a, b, out)
        assert_array_equal(out, tgt, err_msg=msg)

        # test as keyword argument
        msg = "out keyword argument"
        out = np.zeros((2, 2), dtype=np.float)
        self.matmul(a, b, out=out)
        assert_array_equal(out, tgt, err_msg=msg)

        # test out with not allowed type cast (safe casting)
        # einsum and cblas raise different error types, so
        # use Exception.
        msg = "out argument with illegal cast"
        out = np.zeros((2, 2), dtype=np.int32)
        assert_raises(Exception, self.matmul, a, b, out=out)

        # skip following tests for now, cblas does not allow non-contiguous
        # outputs and consistency with dot would require same type,
        # dimensions, subtype, and c_contiguous.

        # test out with allowed type cast
        # msg = "out argument with allowed cast"
        # out = np.zeros((2, 2), dtype=np.complex128)
        # self.matmul(a, b, out=out)
        # assert_array_equal(out, tgt, err_msg=msg)

        # test out non-contiguous
        # msg = "out argument with non-contiguous layout"
        # c = np.zeros((2, 2, 2), dtype=np.float)
        # self.matmul(a, b, out=c[..., 0])
        # assert_array_equal(c, tgt, err_msg=msg)


if sys.version_info[:2] >= (3, 5):
    class TestMatmulOperator(MatmulCommon, TestCase):
        import operator
        matmul = operator.matmul

        def test_array_priority_override(self):

            class A(object):
                __array_priority__ = 1000

                def __matmul__(self, other):
                    return "A"

                def __rmatmul__(self, other):
                    return "A"

            a = A()
            b = np.ones(2)
            assert_equal(self.matmul(a, b), "A")
            assert_equal(self.matmul(b, a), "A")

    def test_matmul_inplace():
        # It would be nice to support in-place matmul eventually, but for now
        # we don't have a working implementation, so better just to error out
        # and nudge people to writing "a = a @ b".
        a = np.eye(3)
        b = np.eye(3)
        assert_raises(TypeError, a.__imatmul__, b)
        import operator
        assert_raises(TypeError, operator.imatmul, a, b)
        # we avoid writing the token `exec` so as not to crash python 2's
        # parser
        exec_ = getattr(builtins, "exec")
        assert_raises(TypeError, exec_, "a @= b", globals(), locals())


class TestInner(TestCase):

    def test_inner_type_mismatch(self):
        c = 1.
        A = np.array((1,1), dtype='i,i')

        assert_raises(TypeError, np.inner, c, A)
        assert_raises(TypeError, np.inner, A, c)

    def test_inner_scalar_and_vector(self):
        for dt in np.typecodes['AllInteger'] + np.typecodes['AllFloat'] + '?':
            sca = np.array(3, dtype=dt)[()]
            vec = np.array([1, 2], dtype=dt)
            desired = np.array([3, 6], dtype=dt)
            assert_equal(np.inner(vec, sca), desired)
            assert_equal(np.inner(sca, vec), desired)

    def test_inner_scalar_and_matrix(self):
        for dt in np.typecodes['AllInteger'] + np.typecodes['AllFloat'] + '?':
            sca = np.array(3, dtype=dt)[()]
            arr = np.matrix([[1, 2], [3, 4]], dtype=dt)
            desired = np.matrix([[3, 6], [9, 12]], dtype=dt)
            assert_equal(np.inner(arr, sca), desired)
            assert_equal(np.inner(sca, arr), desired)

    def test_inner_scalar_and_matrix_of_objects(self):
        # Ticket #4482
        arr = np.matrix([1, 2], dtype=object)
        desired = np.matrix([[3, 6]], dtype=object)
        assert_equal(np.inner(arr, 3), desired)
        assert_equal(np.inner(3, arr), desired)

    def test_vecself(self):
        # Ticket 844.
        # Inner product of a vector with itself segfaults or give
        # meaningless result
        a = np.zeros(shape=(1, 80), dtype=np.float64)
        p = np.inner(a, a)
        assert_almost_equal(p, 0, decimal=14)

    def test_inner_product_with_various_contiguities(self):
        # github issue 6532
        for dt in np.typecodes['AllInteger'] + np.typecodes['AllFloat'] + '?':
            # check an inner product involving a matrix transpose
            A = np.array([[1, 2], [3, 4]], dtype=dt)
            B = np.array([[1, 3], [2, 4]], dtype=dt)
            C = np.array([1, 1], dtype=dt)
            desired = np.array([4, 6], dtype=dt)
            assert_equal(np.inner(A.T, C), desired)
            assert_equal(np.inner(C, A.T), desired)
            assert_equal(np.inner(B, C), desired)
            assert_equal(np.inner(C, B), desired)
            # check a matrix product
            desired = np.array([[7, 10], [15, 22]], dtype=dt)
            assert_equal(np.inner(A, B), desired)
            # check the syrk vs. gemm paths
            desired = np.array([[5, 11], [11, 25]], dtype=dt)
            assert_equal(np.inner(A, A), desired)
            assert_equal(np.inner(A, A.copy()), desired)
            # check an inner product involving an aliased and reversed view
            a = np.arange(5).astype(dt)
            b = a[::-1]
            desired = np.array(10, dtype=dt).item()
            assert_equal(np.inner(b, a), desired)

    def test_3d_tensor(self):
        for dt in np.typecodes['AllInteger'] + np.typecodes['AllFloat'] + '?':
            a = np.arange(24).reshape(2,3,4).astype(dt)
            b = np.arange(24, 48).reshape(2,3,4).astype(dt)
            desired = np.array(
                [[[[ 158,  182,  206],
                   [ 230,  254,  278]],

                  [[ 566,  654,  742],
                   [ 830,  918, 1006]],

                  [[ 974, 1126, 1278],
                   [1430, 1582, 1734]]],

                 [[[1382, 1598, 1814],
                   [2030, 2246, 2462]],

                  [[1790, 2070, 2350],
                   [2630, 2910, 3190]],

                  [[2198, 2542, 2886],
                   [3230, 3574, 3918]]]],
                dtype=dt
            )
            assert_equal(np.inner(a, b), desired)
            assert_equal(np.inner(b, a).transpose(2,3,0,1), desired)


class TestSummarization(TestCase):
    def test_1d(self):
        A = np.arange(1001)
        strA = '[   0    1    2 ...,  998  999 1000]'
        assert_(str(A) == strA)

        reprA = 'array([   0,    1,    2, ...,  998,  999, 1000])'
        assert_(repr(A) == reprA)

    def test_2d(self):
        A = np.arange(1002).reshape(2, 501)
        strA = '[[   0    1    2 ...,  498  499  500]\n' \
               ' [ 501  502  503 ...,  999 1000 1001]]'
        assert_(str(A) == strA)

        reprA = 'array([[   0,    1,    2, ...,  498,  499,  500],\n' \
                '       [ 501,  502,  503, ...,  999, 1000, 1001]])'
        assert_(repr(A) == reprA)


class TestAlen(TestCase):
    def test_basic(self):
        m = np.array([1, 2, 3])
        self.assertEqual(np.alen(m), 3)

        m = np.array([[1, 2, 3], [4, 5, 7]])
        self.assertEqual(np.alen(m), 2)

        m = [1, 2, 3]
        self.assertEqual(np.alen(m), 3)

        m = [[1, 2, 3], [4, 5, 7]]
        self.assertEqual(np.alen(m), 2)

    def test_singleton(self):
        self.assertEqual(np.alen(5), 1)


class TestChoose(TestCase):
    def setUp(self):
        self.x = 2*np.ones((3,), dtype=int)
        self.y = 3*np.ones((3,), dtype=int)
        self.x2 = 2*np.ones((2, 3), dtype=int)
        self.y2 = 3*np.ones((2, 3), dtype=int)
        self.ind = [0, 0, 1]

    def test_basic(self):
        A = np.choose(self.ind, (self.x, self.y))
        assert_equal(A, [2, 2, 3])

    def test_broadcast1(self):
        A = np.choose(self.ind, (self.x2, self.y2))
        assert_equal(A, [[2, 2, 3], [2, 2, 3]])

    def test_broadcast2(self):
        A = np.choose(self.ind, (self.x, self.y2))
        assert_equal(A, [[2, 2, 3], [2, 2, 3]])


class TestRepeat(TestCase):
    def setUp(self):
        self.m = np.array([1, 2, 3, 4, 5, 6])
        self.m_rect = self.m.reshape((2, 3))

    def test_basic(self):
        A = np.repeat(self.m, [1, 3, 2, 1, 1, 2])
        assert_equal(A, [1, 2, 2, 2, 3,
                         3, 4, 5, 6, 6])

    def test_broadcast1(self):
        A = np.repeat(self.m, 2)
        assert_equal(A, [1, 1, 2, 2, 3, 3,
                         4, 4, 5, 5, 6, 6])

    def test_axis_spec(self):
        A = np.repeat(self.m_rect, [2, 1], axis=0)
        assert_equal(A, [[1, 2, 3],
                         [1, 2, 3],
                         [4, 5, 6]])

        A = np.repeat(self.m_rect, [1, 3, 2], axis=1)
        assert_equal(A, [[1, 2, 2, 2, 3, 3],
                         [4, 5, 5, 5, 6, 6]])

    def test_broadcast2(self):
        A = np.repeat(self.m_rect, 2, axis=0)
        assert_equal(A, [[1, 2, 3],
                         [1, 2, 3],
                         [4, 5, 6],
                         [4, 5, 6]])

        A = np.repeat(self.m_rect, 2, axis=1)
        assert_equal(A, [[1, 1, 2, 2, 3, 3],
                         [4, 4, 5, 5, 6, 6]])


# TODO: test for multidimensional
NEIGH_MODE = {'zero': 0, 'one': 1, 'constant': 2, 'circular': 3, 'mirror': 4}


class TestNeighborhoodIter(TestCase):
    # Simple, 2d tests
    def _test_simple2d(self, dt):
        # Test zero and one padding for simple data type
        x = np.array([[0, 1], [2, 3]], dtype=dt)
        r = [np.array([[0, 0, 0], [0, 0, 1]], dtype=dt),
             np.array([[0, 0, 0], [0, 1, 0]], dtype=dt),
             np.array([[0, 0, 1], [0, 2, 3]], dtype=dt),
             np.array([[0, 1, 0], [2, 3, 0]], dtype=dt)]
        l = test_neighborhood_iterator(x, [-1, 0, -1, 1], x[0],
                NEIGH_MODE['zero'])
        assert_array_equal(l, r)

        r = [np.array([[1, 1, 1], [1, 0, 1]], dtype=dt),
             np.array([[1, 1, 1], [0, 1, 1]], dtype=dt),
             np.array([[1, 0, 1], [1, 2, 3]], dtype=dt),
             np.array([[0, 1, 1], [2, 3, 1]], dtype=dt)]
        l = test_neighborhood_iterator(x, [-1, 0, -1, 1], x[0],
                NEIGH_MODE['one'])
        assert_array_equal(l, r)

        r = [np.array([[4, 4, 4], [4, 0, 1]], dtype=dt),
             np.array([[4, 4, 4], [0, 1, 4]], dtype=dt),
             np.array([[4, 0, 1], [4, 2, 3]], dtype=dt),
             np.array([[0, 1, 4], [2, 3, 4]], dtype=dt)]
        l = test_neighborhood_iterator(x, [-1, 0, -1, 1], 4,
                NEIGH_MODE['constant'])
        assert_array_equal(l, r)

    def test_simple2d(self):
        self._test_simple2d(np.float)

    def test_simple2d_object(self):
        self._test_simple2d(Decimal)

    def _test_mirror2d(self, dt):
        x = np.array([[0, 1], [2, 3]], dtype=dt)
        r = [np.array([[0, 0, 1], [0, 0, 1]], dtype=dt),
             np.array([[0, 1, 1], [0, 1, 1]], dtype=dt),
             np.array([[0, 0, 1], [2, 2, 3]], dtype=dt),
             np.array([[0, 1, 1], [2, 3, 3]], dtype=dt)]
        l = test_neighborhood_iterator(x, [-1, 0, -1, 1], x[0],
                NEIGH_MODE['mirror'])
        assert_array_equal(l, r)

    def test_mirror2d(self):
        self._test_mirror2d(np.float)

    def test_mirror2d_object(self):
        self._test_mirror2d(Decimal)

    # Simple, 1d tests
    def _test_simple(self, dt):
        # Test padding with constant values
        x = np.linspace(1, 5, 5).astype(dt)
        r = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 0]]
        l = test_neighborhood_iterator(x, [-1, 1], x[0], NEIGH_MODE['zero'])
        assert_array_equal(l, r)

        r = [[1, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 1]]
        l = test_neighborhood_iterator(x, [-1, 1], x[0], NEIGH_MODE['one'])
        assert_array_equal(l, r)

        r = [[x[4], 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, x[4]]]
        l = test_neighborhood_iterator(x, [-1, 1], x[4], NEIGH_MODE['constant'])
        assert_array_equal(l, r)

    def test_simple_float(self):
        self._test_simple(np.float)

    def test_simple_object(self):
        self._test_simple(Decimal)

    # Test mirror modes
    def _test_mirror(self, dt):
        x = np.linspace(1, 5, 5).astype(dt)
        r = np.array([[2, 1, 1, 2, 3], [1, 1, 2, 3, 4], [1, 2, 3, 4, 5],
                [2, 3, 4, 5, 5], [3, 4, 5, 5, 4]], dtype=dt)
        l = test_neighborhood_iterator(x, [-2, 2], x[1], NEIGH_MODE['mirror'])
        self.assertTrue([i.dtype == dt for i in l])
        assert_array_equal(l, r)

    def test_mirror(self):
        self._test_mirror(np.float)

    def test_mirror_object(self):
        self._test_mirror(Decimal)

    # Circular mode
    def _test_circular(self, dt):
        x = np.linspace(1, 5, 5).astype(dt)
        r = np.array([[4, 5, 1, 2, 3], [5, 1, 2, 3, 4], [1, 2, 3, 4, 5],
                [2, 3, 4, 5, 1], [3, 4, 5, 1, 2]], dtype=dt)
        l = test_neighborhood_iterator(x, [-2, 2], x[0], NEIGH_MODE['circular'])
        assert_array_equal(l, r)

    def test_circular(self):
        self._test_circular(np.float)

    def test_circular_object(self):
        self._test_circular(Decimal)

# Test stacking neighborhood iterators
class TestStackedNeighborhoodIter(TestCase):
    # Simple, 1d test: stacking 2 constant-padded neigh iterators
    def test_simple_const(self):
        dt = np.float64
        # Test zero and one padding for simple data type
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([0], dtype=dt),
             np.array([0], dtype=dt),
             np.array([1], dtype=dt),
             np.array([2], dtype=dt),
             np.array([3], dtype=dt),
             np.array([0], dtype=dt),
             np.array([0], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-2, 4], NEIGH_MODE['zero'],
                [0, 0], NEIGH_MODE['zero'])
        assert_array_equal(l, r)

        r = [np.array([1, 0, 1], dtype=dt),
             np.array([0, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 0], dtype=dt),
             np.array([3, 0, 1], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [-1, 1], NEIGH_MODE['one'])
        assert_array_equal(l, r)

    # 2nd simple, 1d test: stacking 2 neigh iterators, mixing const padding and
    # mirror padding
    def test_simple_mirror(self):
        dt = np.float64
        # Stacking zero on top of mirror
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([0, 1, 1], dtype=dt),
             np.array([1, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 3], dtype=dt),
             np.array([3, 3, 0], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['mirror'],
                [-1, 1], NEIGH_MODE['zero'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([1, 0, 0], dtype=dt),
             np.array([0, 0, 1], dtype=dt),
             np.array([0, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 0], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [-2, 0], NEIGH_MODE['mirror'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero: 2nd
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([0, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 0], dtype=dt),
             np.array([3, 0, 0], dtype=dt),
             np.array([0, 0, 3], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [0, 2], NEIGH_MODE['mirror'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero: 3rd
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([1, 0, 0, 1, 2], dtype=dt),
             np.array([0, 0, 1, 2, 3], dtype=dt),
             np.array([0, 1, 2, 3, 0], dtype=dt),
             np.array([1, 2, 3, 0, 0], dtype=dt),
             np.array([2, 3, 0, 0, 3], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [-2, 2], NEIGH_MODE['mirror'])
        assert_array_equal(l, r)

    # 3rd simple, 1d test: stacking 2 neigh iterators, mixing const padding and
    # circular padding
    def test_simple_circular(self):
        dt = np.float64
        # Stacking zero on top of mirror
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([0, 3, 1], dtype=dt),
             np.array([3, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 1], dtype=dt),
             np.array([3, 1, 0], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['circular'],
                [-1, 1], NEIGH_MODE['zero'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([3, 0, 0], dtype=dt),
             np.array([0, 0, 1], dtype=dt),
             np.array([0, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 0], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [-2, 0], NEIGH_MODE['circular'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero: 2nd
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([0, 1, 2], dtype=dt),
             np.array([1, 2, 3], dtype=dt),
             np.array([2, 3, 0], dtype=dt),
             np.array([3, 0, 0], dtype=dt),
             np.array([0, 0, 1], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [0, 2], NEIGH_MODE['circular'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero: 3rd
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([3, 0, 0, 1, 2], dtype=dt),
             np.array([0, 0, 1, 2, 3], dtype=dt),
             np.array([0, 1, 2, 3, 0], dtype=dt),
             np.array([1, 2, 3, 0, 0], dtype=dt),
             np.array([2, 3, 0, 0, 1], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [-1, 3], NEIGH_MODE['zero'],
                [-2, 2], NEIGH_MODE['circular'])
        assert_array_equal(l, r)

    # 4th simple, 1d test: stacking 2 neigh iterators, but with lower iterator
    # being strictly within the array
    def test_simple_strict_within(self):
        dt = np.float64
        # Stacking zero on top of zero, first neighborhood strictly inside the
        # array
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([1, 2, 3, 0], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [1, 1], NEIGH_MODE['zero'],
                [-1, 2], NEIGH_MODE['zero'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero, first neighborhood strictly inside the
        # array
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([1, 2, 3, 3], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [1, 1], NEIGH_MODE['zero'],
                [-1, 2], NEIGH_MODE['mirror'])
        assert_array_equal(l, r)

        # Stacking mirror on top of zero, first neighborhood strictly inside the
        # array
        x = np.array([1, 2, 3], dtype=dt)
        r = [np.array([1, 2, 3, 1], dtype=dt)]
        l = test_neighborhood_iterator_oob(x, [1, 1], NEIGH_MODE['zero'],
                [-1, 2], NEIGH_MODE['circular'])
        assert_array_equal(l, r)

class TestWarnings(object):

    def test_complex_warning(self):
        x = np.array([1, 2])
        y = np.array([1-2j, 1+2j])

        with warnings.catch_warnings():
            warnings.simplefilter("error", np.ComplexWarning)
            assert_raises(np.ComplexWarning, x.__setitem__, slice(None), y)
            assert_equal(x, [1, 2])


class TestMinScalarType(object):

    def test_usigned_shortshort(self):
        dt = np.min_scalar_type(2**8-1)
        wanted = np.dtype('uint8')
        assert_equal(wanted, dt)

    def test_usigned_short(self):
        dt = np.min_scalar_type(2**16-1)
        wanted = np.dtype('uint16')
        assert_equal(wanted, dt)

    def test_usigned_int(self):
        dt = np.min_scalar_type(2**32-1)
        wanted = np.dtype('uint32')
        assert_equal(wanted, dt)

    def test_usigned_longlong(self):
        dt = np.min_scalar_type(2**63-1)
        wanted = np.dtype('uint64')
        assert_equal(wanted, dt)

    def test_object(self):
        dt = np.min_scalar_type(2**64)
        wanted = np.dtype('O')
        assert_equal(wanted, dt)


from numpy.core._internal import _dtype_from_pep3118


class TestPEP3118Dtype(object):
    def _check(self, spec, wanted):
        dt = np.dtype(wanted)
        actual = _dtype_from_pep3118(spec)
        assert_equal(actual, dt,
                     err_msg="spec %r != dtype %r" % (spec, wanted))

    def test_native_padding(self):
        align = np.dtype('i').alignment
        for j in range(8):
            if j == 0:
                s = 'bi'
            else:
                s = 'b%dxi' % j
            self._check('@'+s, {'f0': ('i1', 0),
                                'f1': ('i', align*(1 + j//align))})
            self._check('='+s, {'f0': ('i1', 0),
                                'f1': ('i', 1+j)})

    def test_native_padding_2(self):
        # Native padding should work also for structs and sub-arrays
        self._check('x3T{xi}', {'f0': (({'f0': ('i', 4)}, (3,)), 4)})
        self._check('^x3T{xi}', {'f0': (({'f0': ('i', 1)}, (3,)), 1)})

    def test_trailing_padding(self):
        # Trailing padding should be included, *and*, the item size
        # should match the alignment if in aligned mode
        align = np.dtype('i').alignment
        size = np.dtype('i').itemsize

        def aligned(n):
            return align*(1 + (n-1)//align)

        base = dict(formats=['i'], names=['f0'])

        self._check('ix',    dict(itemsize=aligned(size + 1), **base))
        self._check('ixx',   dict(itemsize=aligned(size + 2), **base))
        self._check('ixxx',  dict(itemsize=aligned(size + 3), **base))
        self._check('ixxxx', dict(itemsize=aligned(size + 4), **base))
        self._check('i7x',   dict(itemsize=aligned(size + 7), **base))

        self._check('^ix',    dict(itemsize=size + 1, **base))
        self._check('^ixx',   dict(itemsize=size + 2, **base))
        self._check('^ixxx',  dict(itemsize=size + 3, **base))
        self._check('^ixxxx', dict(itemsize=size + 4, **base))
        self._check('^i7x',   dict(itemsize=size + 7, **base))

    def test_native_padding_3(self):
        dt = np.dtype(
                [('a', 'b'), ('b', 'i'),
                    ('sub', np.dtype('b,i')), ('c', 'i')],
                align=True)
        self._check("T{b:a:xxxi:b:T{b:f0:=i:f1:}:sub:xxxi:c:}", dt)

        dt = np.dtype(
                [('a', 'b'), ('b', 'i'), ('c', 'b'), ('d', 'b'),
                    ('e', 'b'), ('sub', np.dtype('b,i', align=True))])
        self._check("T{b:a:=i:b:b:c:b:d:b:e:T{b:f0:xxxi:f1:}:sub:}", dt)

    def test_padding_with_array_inside_struct(self):
        dt = np.dtype(
                [('a', 'b'), ('b', 'i'), ('c', 'b', (3,)),
                    ('d', 'i')],
                align=True)
        self._check("T{b:a:xxxi:b:3b:c:xi:d:}", dt)

    def test_byteorder_inside_struct(self):
        # The byte order after @T{=i} should be '=', not '@'.
        # Check this by noting the absence of native alignment.
        self._check('@T{^i}xi', {'f0': ({'f0': ('i', 0)}, 0),
                                 'f1': ('i', 5)})

    def test_intra_padding(self):
        # Natively aligned sub-arrays may require some internal padding
        align = np.dtype('i').alignment
        size = np.dtype('i').itemsize

        def aligned(n):
            return (align*(1 + (n-1)//align))

        self._check('(3)T{ix}', (dict(
            names=['f0'],
            formats=['i'],
            offsets=[0],
            itemsize=aligned(size + 1)
        ), (3,)))

    def test_char_vs_string(self):
        dt = np.dtype('c')
        self._check('c', dt)

        dt = np.dtype([('f0', 'S1', (4,)), ('f1', 'S4')])
        self._check('4c4s', dt)

    def test_field_order(self):
        # gh-9053 - previously, we relied on dictionary key order
        self._check("(0)I:a:f:b:", [('a', 'I', (0,)), ('b', 'f')])
        self._check("(0)I:b:f:a:", [('b', 'I', (0,)), ('a', 'f')])

    def test_unnamed_fields(self):
        self._check('ii',     [('f0', 'i'), ('f1', 'i')])
        self._check('ii:f0:', [('f1', 'i'), ('f0', 'i')])

        self._check('i', 'i')
        self._check('i:f0:', [('f0', 'i')])

class TestNewBufferProtocol(object):
    def _check_roundtrip(self, obj):
        obj = np.asarray(obj)
        x = memoryview(obj)
        y = np.asarray(x)
        y2 = np.array(x)
        assert_(not y.flags.owndata)
        assert_(y2.flags.owndata)

        assert_equal(y.dtype, obj.dtype)
        assert_equal(y.shape, obj.shape)
        assert_array_equal(obj, y)

        assert_equal(y2.dtype, obj.dtype)
        assert_equal(y2.shape, obj.shape)
        assert_array_equal(obj, y2)

    def test_roundtrip(self):
        x = np.array([1, 2, 3, 4, 5], dtype='i4')
        self._check_roundtrip(x)

        x = np.array([[1, 2], [3, 4]], dtype=np.float64)
        self._check_roundtrip(x)

        x = np.zeros((3, 3, 3), dtype=np.float32)[:, 0,:]
        self._check_roundtrip(x)

        dt = [('a', 'b'),
              ('b', 'h'),
              ('c', 'i'),
              ('d', 'l'),
              ('dx', 'q'),
              ('e', 'B'),
              ('f', 'H'),
              ('g', 'I'),
              ('h', 'L'),
              ('hx', 'Q'),
              ('i', np.single),
              ('j', np.double),
              ('k', np.longdouble),
              ('ix', np.csingle),
              ('jx', np.cdouble),
              ('kx', np.clongdouble),
              ('l', 'S4'),
              ('m', 'U4'),
              ('n', 'V3'),
              ('o', '?'),
              ('p', np.half),
              ]
        x = np.array(
                [(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                    b'aaaa', 'bbbb', b'xxx', True, 1.0)],
                dtype=dt)
        self._check_roundtrip(x)

        x = np.array(([[1, 2], [3, 4]],), dtype=[('a', (int, (2, 2)))])
        self._check_roundtrip(x)

        x = np.array([1, 2, 3], dtype='>i2')
        self._check_roundtrip(x)

        x = np.array([1, 2, 3], dtype='<i2')
        self._check_roundtrip(x)

        x = np.array([1, 2, 3], dtype='>i4')
        self._check_roundtrip(x)

        x = np.array([1, 2, 3], dtype='<i4')
        self._check_roundtrip(x)

        # check long long can be represented as non-native
        x = np.array([1, 2, 3], dtype='>q')
        self._check_roundtrip(x)

        # Native-only data types can be passed through the buffer interface
        # only in native byte order
        if sys.byteorder == 'little':
            x = np.array([1, 2, 3], dtype='>g')
            assert_raises(ValueError, self._check_roundtrip, x)
            x = np.array([1, 2, 3], dtype='<g')
            self._check_roundtrip(x)
        else:
            x = np.array([1, 2, 3], dtype='>g')
            self._check_roundtrip(x)
            x = np.array([1, 2, 3], dtype='<g')
            assert_raises(ValueError, self._check_roundtrip, x)

    def test_roundtrip_half(self):
        half_list = [
            1.0,
            -2.0,
            6.5504 * 10**4,  # (max half precision)
            2**-14,  # ~= 6.10352 * 10**-5 (minimum positive normal)
            2**-24,  # ~= 5.96046 * 10**-8 (minimum strictly positive subnormal)
            0.0,
            -0.0,
            float('+inf'),
            float('-inf'),
            0.333251953125,  # ~= 1/3
        ]

        x = np.array(half_list, dtype='>e')
        self._check_roundtrip(x)
        x = np.array(half_list, dtype='<e')
        self._check_roundtrip(x)

    def test_roundtrip_single_types(self):
        for typ in np.typeDict.values():
            dtype = np.dtype(typ)

            if dtype.char in 'Mm':
                # datetimes cannot be used in buffers
                continue
            if dtype.char == 'V':
                # skip void
                continue

            x = np.zeros(4, dtype=dtype)
            self._check_roundtrip(x)

            if dtype.char not in 'qQgG':
                dt = dtype.newbyteorder('<')
                x = np.zeros(4, dtype=dt)
                self._check_roundtrip(x)

                dt = dtype.newbyteorder('>')
                x = np.zeros(4, dtype=dt)
                self._check_roundtrip(x)

    def test_roundtrip_scalar(self):
        # Issue #4015.
        self._check_roundtrip(0)

    def test_export_simple_1d(self):
        x = np.array([1, 2, 3, 4, 5], dtype='i')
        y = memoryview(x)
        assert_equal(y.format, 'i')
        assert_equal(y.shape, (5,))
        assert_equal(y.ndim, 1)
        assert_equal(y.strides, (4,))
        assert_equal(y.suboffsets, EMPTY)
        assert_equal(y.itemsize, 4)

    def test_export_simple_nd(self):
        x = np.array([[1, 2], [3, 4]], dtype=np.float64)
        y = memoryview(x)
        assert_equal(y.format, 'd')
        assert_equal(y.shape, (2, 2))
        assert_equal(y.ndim, 2)
        assert_equal(y.strides, (16, 8))
        assert_equal(y.suboffsets, EMPTY)
        assert_equal(y.itemsize, 8)

    def test_export_discontiguous(self):
        x = np.zeros((3, 3, 3), dtype=np.float32)[:, 0,:]
        y = memoryview(x)
        assert_equal(y.format, 'f')
        assert_equal(y.shape, (3, 3))
        assert_equal(y.ndim, 2)
        assert_equal(y.strides, (36, 4))
        assert_equal(y.suboffsets, EMPTY)
        assert_equal(y.itemsize, 4)

    def test_export_record(self):
        dt = [('a', 'b'),
              ('b', 'h'),
              ('c', 'i'),
              ('d', 'l'),
              ('dx', 'q'),
              ('e', 'B'),
              ('f', 'H'),
              ('g', 'I'),
              ('h', 'L'),
              ('hx', 'Q'),
              ('i', np.single),
              ('j', np.double),
              ('k', np.longdouble),
              ('ix', np.csingle),
              ('jx', np.cdouble),
              ('kx', np.clongdouble),
              ('l', 'S4'),
              ('m', 'U4'),
              ('n', 'V3'),
              ('o', '?'),
              ('p', np.half),
              ]
        x = np.array(
                [(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                    b'aaaa', 'bbbb', b'   ', True, 1.0)],
                dtype=dt)
        y = memoryview(x)
        assert_equal(y.shape, (1,))
        assert_equal(y.ndim, 1)
        assert_equal(y.suboffsets, EMPTY)

        sz = sum([np.dtype(b).itemsize for a, b in dt])
        if np.dtype('l').itemsize == 4:
            assert_equal(y.format, 'T{b:a:=h:b:i:c:l:d:q:dx:B:e:@H:f:=I:g:L:h:Q:hx:f:i:d:j:^g:k:=Zf:ix:Zd:jx:^Zg:kx:4s:l:=4w:m:3x:n:?:o:@e:p:}')
        else:
            assert_equal(y.format, 'T{b:a:=h:b:i:c:q:d:q:dx:B:e:@H:f:=I:g:Q:h:Q:hx:f:i:d:j:^g:k:=Zf:ix:Zd:jx:^Zg:kx:4s:l:=4w:m:3x:n:?:o:@e:p:}')
        # Cannot test if NPY_RELAXED_STRIDES_CHECKING changes the strides
        if not (np.ones(1).strides[0] == np.iinfo(np.intp).max):
            assert_equal(y.strides, (sz,))
        assert_equal(y.itemsize, sz)

    def test_export_subarray(self):
        x = np.array(([[1, 2], [3, 4]],), dtype=[('a', ('i', (2, 2)))])
        y = memoryview(x)
        assert_equal(y.format, 'T{(2,2)i:a:}')
        assert_equal(y.shape, EMPTY)
        assert_equal(y.ndim, 0)
        assert_equal(y.strides, EMPTY)
        assert_equal(y.suboffsets, EMPTY)
        assert_equal(y.itemsize, 16)

    def test_export_endian(self):
        x = np.array([1, 2, 3], dtype='>i')
        y = memoryview(x)
        if sys.byteorder == 'little':
            assert_equal(y.format, '>i')
        else:
            assert_equal(y.format, 'i')

        x = np.array([1, 2, 3], dtype='<i')
        y = memoryview(x)
        if sys.byteorder == 'little':
            assert_equal(y.format, 'i')
        else:
            assert_equal(y.format, '<i')

    def test_export_flags(self):
        # Check SIMPLE flag, see also gh-3613 (exception should be BufferError)
        assert_raises(ValueError, get_buffer_info, np.arange(5)[::2], ('SIMPLE',))

    def test_padding(self):
        for j in range(8):
            x = np.array([(1,), (2,)], dtype={'f0': (int, j)})
            self._check_roundtrip(x)

    def test_reference_leak(self):
        if HAS_REFCOUNT:
            count_1 = sys.getrefcount(np.core._internal)
        a = np.zeros(4)
        b = memoryview(a)
        c = np.asarray(b)
        if HAS_REFCOUNT:
            count_2 = sys.getrefcount(np.core._internal)
            assert_equal(count_1, count_2)
        del c  # avoid pyflakes unused variable warning.

    def test_padded_struct_array(self):
        dt1 = np.dtype(
                [('a', 'b'), ('b', 'i'), ('sub', np.dtype('b,i')), ('c', 'i')],
                align=True)
        x1 = np.arange(dt1.itemsize, dtype=np.int8).view(dt1)
        self._check_roundtrip(x1)

        dt2 = np.dtype(
                [('a', 'b'), ('b', 'i'), ('c', 'b', (3,)), ('d', 'i')],
                align=True)
        x2 = np.arange(dt2.itemsize, dtype=np.int8).view(dt2)
        self._check_roundtrip(x2)

        dt3 = np.dtype(
                [('a', 'b'), ('b', 'i'), ('c', 'b'), ('d', 'b'),
                    ('e', 'b'), ('sub', np.dtype('b,i', align=True))])
        x3 = np.arange(dt3.itemsize, dtype=np.int8).view(dt3)
        self._check_roundtrip(x3)

    def test_relaxed_strides(self):
        # Test that relaxed strides are converted to non-relaxed
        c = np.ones((1, 10, 10), dtype='i8')

        # Check for NPY_RELAXED_STRIDES_CHECKING:
        if np.ones((10, 1), order="C").flags.f_contiguous:
            c.strides = (-1, 80, 8)

        assert_(memoryview(c).strides == (800, 80, 8))

        # Writing C-contiguous data to a BytesIO buffer should work
        fd = io.BytesIO()
        fd.write(c.data)

        fortran = c.T
        assert_(memoryview(fortran).strides == (8, 80, 800))

        arr = np.ones((1, 10))
        if arr.flags.f_contiguous:
            shape, strides = get_buffer_info(arr, ['F_CONTIGUOUS'])
            assert_(strides[0] == 8)
            arr = np.ones((10, 1), order='F')
            shape, strides = get_buffer_info(arr, ['C_CONTIGUOUS'])
            assert_(strides[-1] == 8)


class TestArrayAttributeDeletion(object):

    def test_multiarray_writable_attributes_deletion(self):
        # ticket #2046, should not seqfault, raise AttributeError
        a = np.ones(2)
        attr = ['shape', 'strides', 'data', 'dtype', 'real', 'imag', 'flat']
        with suppress_warnings() as sup:
            sup.filter(DeprecationWarning, "Assigning the 'data' attribute")
            for s in attr:
                assert_raises(AttributeError, delattr, a, s)

    def test_multiarray_not_writable_attributes_deletion(self):
        a = np.ones(2)
        attr = ["ndim", "flags", "itemsize", "size", "nbytes", "base",
                "ctypes", "T", "__array_interface__", "__array_struct__",
                "__array_priority__", "__array_finalize__"]
        for s in attr:
            assert_raises(AttributeError, delattr, a, s)

    def test_multiarray_flags_writable_attribute_deletion(self):
        a = np.ones(2).flags
        attr = ['updateifcopy', 'aligned', 'writeable']
        for s in attr:
            assert_raises(AttributeError, delattr, a, s)

    def test_multiarray_flags_not_writable_attribute_deletion(self):
        a = np.ones(2).flags
        attr = ["contiguous", "c_contiguous", "f_contiguous", "fortran",
                "owndata", "fnc", "forc", "behaved", "carray", "farray",
                "num"]
        for s in attr:
            assert_raises(AttributeError, delattr, a, s)


def test_array_interface():
    # Test scalar coercion within the array interface
    class Foo(object):
        def __init__(self, value):
            self.value = value
            self.iface = {'typestr': '=f8'}

        def __float__(self):
            return float(self.value)

        @property
        def __array_interface__(self):
            return self.iface

    f = Foo(0.5)
    assert_equal(np.array(f), 0.5)
    assert_equal(np.array([f]), [0.5])
    assert_equal(np.array([f, f]), [0.5, 0.5])
    assert_equal(np.array(f).dtype, np.dtype('=f8'))
    # Test various shape definitions
    f.iface['shape'] = ()
    assert_equal(np.array(f), 0.5)
    f.iface['shape'] = None
    assert_raises(TypeError, np.array, f)
    f.iface['shape'] = (1, 1)
    assert_equal(np.array(f), [[0.5]])
    f.iface['shape'] = (2,)
    assert_raises(ValueError, np.array, f)

    # test scalar with no shape
    class ArrayLike(object):
        array = np.array(1)
        __array_interface__ = array.__array_interface__
    assert_equal(np.array(ArrayLike()), 1)


def test_array_interface_itemsize():
    # See gh-6361
    my_dtype = np.dtype({'names': ['A', 'B'], 'formats': ['f4', 'f4'],
                         'offsets': [0, 8], 'itemsize': 16})
    a = np.ones(10, dtype=my_dtype)
    descr_t = np.dtype(a.__array_interface__['descr'])
    typestr_t = np.dtype(a.__array_interface__['typestr'])
    assert_equal(descr_t.itemsize, typestr_t.itemsize)


def test_flat_element_deletion():
    it = np.ones(3).flat
    try:
        del it[1]
        del it[1:2]
    except TypeError:
        pass
    except:
        raise AssertionError


def test_scalar_element_deletion():
    a = np.zeros(2, dtype=[('x', 'int'), ('y', 'int')])
    assert_raises(ValueError, a[0].__delitem__, 'x')


class TestMemEventHook(TestCase):
    def test_mem_seteventhook(self):
        # The actual tests are within the C code in
        # multiarray/multiarray_tests.c.src
        test_pydatamem_seteventhook_start()
        # force an allocation and free of a numpy array
        # needs to be larger then limit of small memory cacher in ctors.c
        a = np.zeros(1000)
        del a
        gc.collect()
        test_pydatamem_seteventhook_end()

class TestMapIter(TestCase):
    def test_mapiter(self):
        # The actual tests are within the C code in
        # multiarray/multiarray_tests.c.src

        a = np.arange(12).reshape((3, 4)).astype(float)
        index = ([1, 1, 2, 0],
                 [0, 0, 2, 3])
        vals = [50, 50, 30, 16]

        test_inplace_increment(a, index, vals)
        assert_equal(a, [[0.00, 1., 2.0, 19.],
                         [104., 5., 6.0, 7.0],
                         [8.00, 9., 40., 11.]])

        b = np.arange(6).astype(float)
        index = (np.array([1, 2, 0]),)
        vals = [50, 4, 100.1]
        test_inplace_increment(b, index, vals)
        assert_equal(b, [100.1,  51.,   6.,   3.,   4.,   5.])


class TestAsCArray(TestCase):
    def test_1darray(self):
        array = np.arange(24, dtype=np.double)
        from_c = test_as_c_array(array, 3)
        assert_equal(array[3], from_c)

    def test_2darray(self):
        array = np.arange(24, dtype=np.double).reshape(3, 8)
        from_c = test_as_c_array(array, 2, 4)
        assert_equal(array[2, 4], from_c)

    def test_3darray(self):
        array = np.arange(24, dtype=np.double).reshape(2, 3, 4)
        from_c = test_as_c_array(array, 1, 2, 3)
        assert_equal(array[1, 2, 3], from_c)


class TestConversion(TestCase):
    def test_array_scalar_relational_operation(self):
        # All integer
        for dt1 in np.typecodes['AllInteger']:
            assert_(1 > np.array(0, dtype=dt1), "type %s failed" % (dt1,))
            assert_(not 1 < np.array(0, dtype=dt1), "type %s failed" % (dt1,))

            for dt2 in np.typecodes['AllInteger']:
                assert_(np.array(1, dtype=dt1) > np.array(0, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))
                assert_(not np.array(1, dtype=dt1) < np.array(0, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))

        # Unsigned integers
        for dt1 in 'BHILQP':
            assert_(-1 < np.array(1, dtype=dt1), "type %s failed" % (dt1,))
            assert_(not -1 > np.array(1, dtype=dt1), "type %s failed" % (dt1,))
            assert_(-1 != np.array(1, dtype=dt1), "type %s failed" % (dt1,))

            # Unsigned vs signed
            for dt2 in 'bhilqp':
                assert_(np.array(1, dtype=dt1) > np.array(-1, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))
                assert_(not np.array(1, dtype=dt1) < np.array(-1, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))
                assert_(np.array(1, dtype=dt1) != np.array(-1, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))

        # Signed integers and floats
        for dt1 in 'bhlqp' + np.typecodes['Float']:
            assert_(1 > np.array(-1, dtype=dt1), "type %s failed" % (dt1,))
            assert_(not 1 < np.array(-1, dtype=dt1), "type %s failed" % (dt1,))
            assert_(-1 == np.array(-1, dtype=dt1), "type %s failed" % (dt1,))

            for dt2 in 'bhlqp' + np.typecodes['Float']:
                assert_(np.array(1, dtype=dt1) > np.array(-1, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))
                assert_(not np.array(1, dtype=dt1) < np.array(-1, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))
                assert_(np.array(-1, dtype=dt1) == np.array(-1, dtype=dt2),
                        "type %s and %s failed" % (dt1, dt2))

    def test_to_bool_scalar(self):
        assert_equal(bool(np.array([False])), False)
        assert_equal(bool(np.array([True])), True)
        assert_equal(bool(np.array([[42]])), True)
        assert_raises(ValueError, bool, np.array([1, 2]))

        class NotConvertible(object):
            def __bool__(self):
                raise NotImplementedError
            __nonzero__ = __bool__  # python 2

        assert_raises(NotImplementedError, bool, np.array(NotConvertible()))
        assert_raises(NotImplementedError, bool, np.array([NotConvertible()]))

        self_containing = np.array([None])
        self_containing[0] = self_containing
        try:
            Error = RecursionError
        except NameError:
            Error = RuntimeError  # python < 3.5
        assert_raises(Error, bool, self_containing)  # previously stack overflow


class TestWhere(TestCase):
    def test_basic(self):
        dts = [np.bool, np.int16, np.int32, np.int64, np.double, np.complex128,
               np.longdouble, np.clongdouble]
        for dt in dts:
            c = np.ones(53, dtype=np.bool)
            assert_equal(np.where( c, dt(0), dt(1)), dt(0))
            assert_equal(np.where(~c, dt(0), dt(1)), dt(1))
            assert_equal(np.where(True, dt(0), dt(1)), dt(0))
            assert_equal(np.where(False, dt(0), dt(1)), dt(1))
            d = np.ones_like(c).astype(dt)
            e = np.zeros_like(d)
            r = d.astype(dt)
            c[7] = False
            r[7] = e[7]
            assert_equal(np.where(c, e, e), e)
            assert_equal(np.where(c, d, e), r)
            assert_equal(np.where(c, d, e[0]), r)
            assert_equal(np.where(c, d[0], e), r)
            assert_equal(np.where(c[::2], d[::2], e[::2]), r[::2])
            assert_equal(np.where(c[1::2], d[1::2], e[1::2]), r[1::2])
            assert_equal(np.where(c[::3], d[::3], e[::3]), r[::3])
            assert_equal(np.where(c[1::3], d[1::3], e[1::3]), r[1::3])
            assert_equal(np.where(c[::-2], d[::-2], e[::-2]), r[::-2])
            assert_equal(np.where(c[::-3], d[::-3], e[::-3]), r[::-3])
            assert_equal(np.where(c[1::-3], d[1::-3], e[1::-3]), r[1::-3])

    def test_exotic(self):
        # object
        assert_array_equal(np.where(True, None, None), np.array(None))
        # zero sized
        m = np.array([], dtype=bool).reshape(0, 3)
        b = np.array([], dtype=np.float64).reshape(0, 3)
        assert_array_equal(np.where(m, 0, b), np.array([]).reshape(0, 3))

        # object cast
        d = np.array([-1.34, -0.16, -0.54, -0.31, -0.08, -0.95, 0.000, 0.313,
                      0.547, -0.18, 0.876, 0.236, 1.969, 0.310, 0.699, 1.013,
                      1.267, 0.229, -1.39, 0.487])
        nan = float('NaN')
        e = np.array(['5z', '0l', nan, 'Wz', nan, nan, 'Xq', 'cs', nan, nan,
                     'QN', nan, nan, 'Fd', nan, nan, 'kp', nan, '36', 'i1'],
                     dtype=object)
        m = np.array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1,
                      0, 1, 1, 0, 1, 1, 0, 1, 0, 0], dtype=bool)

        r = e[:]
        r[np.where(m)] = d[np.where(m)]
        assert_array_equal(np.where(m, d, e), r)

        r = e[:]
        r[np.where(~m)] = d[np.where(~m)]
        assert_array_equal(np.where(m, e, d), r)

        assert_array_equal(np.where(m, e, e), e)

        # minimal dtype result with NaN scalar (e.g required by pandas)
        d = np.array([1., 2.], dtype=np.float32)
        e = float('NaN')
        assert_equal(np.where(True, d, e).dtype, np.float32)
        e = float('Infinity')
        assert_equal(np.where(True, d, e).dtype, np.float32)
        e = float('-Infinity')
        assert_equal(np.where(True, d, e).dtype, np.float32)
        # also check upcast
        e = float(1e150)
        assert_equal(np.where(True, d, e).dtype, np.float64)

    def test_ndim(self):
        c = [True, False]
        a = np.zeros((2, 25))
        b = np.ones((2, 25))
        r = np.where(np.array(c)[:,np.newaxis], a, b)
        assert_array_equal(r[0], a[0])
        assert_array_equal(r[1], b[0])

        a = a.T
        b = b.T
        r = np.where(c, a, b)
        assert_array_equal(r[:,0], a[:,0])
        assert_array_equal(r[:,1], b[:,0])

    def test_dtype_mix(self):
        c = np.array([False, True, False, False, False, False, True, False,
                     False, False, True, False])
        a = np.uint32(1)
        b = np.array([5., 0., 3., 2., -1., -4., 0., -10., 10., 1., 0., 3.],
                      dtype=np.float64)
        r = np.array([5., 1., 3., 2., -1., -4., 1., -10., 10., 1., 1., 3.],
                     dtype=np.float64)
        assert_equal(np.where(c, a, b), r)

        a = a.astype(np.float32)
        b = b.astype(np.int64)
        assert_equal(np.where(c, a, b), r)

        # non bool mask
        c = c.astype(np.int)
        c[c != 0] = 34242324
        assert_equal(np.where(c, a, b), r)
        # invert
        tmpmask = c != 0
        c[c == 0] = 41247212
        c[tmpmask] = 0
        assert_equal(np.where(c, b, a), r)

    def test_foreign(self):
        c = np.array([False, True, False, False, False, False, True, False,
                     False, False, True, False])
        r = np.array([5., 1., 3., 2., -1., -4., 1., -10., 10., 1., 1., 3.],
                     dtype=np.float64)
        a = np.ones(1, dtype='>i4')
        b = np.array([5., 0., 3., 2., -1., -4., 0., -10., 10., 1., 0., 3.],
                     dtype=np.float64)
        assert_equal(np.where(c, a, b), r)

        b = b.astype('>f8')
        assert_equal(np.where(c, a, b), r)

        a = a.astype('<i4')
        assert_equal(np.where(c, a, b), r)

        c = c.astype('>i4')
        assert_equal(np.where(c, a, b), r)

    def test_error(self):
        c = [True, True]
        a = np.ones((4, 5))
        b = np.ones((5, 5))
        assert_raises(ValueError, np.where, c, a, a)
        assert_raises(ValueError, np.where, c[0], a, b)

    def test_string(self):
        # gh-4778 check strings are properly filled with nulls
        a = np.array("abc")
        b = np.array("x" * 753)
        assert_equal(np.where(True, a, b), "abc")
        assert_equal(np.where(False, b, a), "abc")

        # check native datatype sized strings
        a = np.array("abcd")
        b = np.array("x" * 8)
        assert_equal(np.where(True, a, b), "abcd")
        assert_equal(np.where(False, b, a), "abcd")

    def test_empty_result(self):
        # pass empty where result through an assignment which reads the data of
        # empty arrays, error detectable with valgrind, see gh-8922
        x = np.zeros((1, 1))
        ibad = np.vstack(np.where(x == 99.))
        assert_array_equal(ibad,
                           np.atleast_2d(np.array([[],[]], dtype=np.intp)))


if not IS_PYPY:
    # sys.getsizeof() is not valid on PyPy
    class TestSizeOf(TestCase):

        def test_empty_array(self):
            x = np.array([])
            assert_(sys.getsizeof(x) > 0)

        def check_array(self, dtype):
            elem_size = dtype(0).itemsize

            for length in [10, 50, 100, 500]:
                x = np.arange(length, dtype=dtype)
                assert_(sys.getsizeof(x) > length * elem_size)

        def test_array_int32(self):
            self.check_array(np.int32)

        def test_array_int64(self):
            self.check_array(np.int64)

        def test_array_float32(self):
            self.check_array(np.float32)

        def test_array_float64(self):
            self.check_array(np.float64)

        def test_view(self):
            d = np.ones(100)
            assert_(sys.getsizeof(d[...]) < sys.getsizeof(d))

        def test_reshape(self):
            d = np.ones(100)
            assert_(sys.getsizeof(d) < sys.getsizeof(d.reshape(100, 1, 1).copy()))

        def test_resize(self):
            d = np.ones(100)
            old = sys.getsizeof(d)
            d.resize(50)
            assert_(old > sys.getsizeof(d))
            d.resize(150)
            assert_(old < sys.getsizeof(d))

        def test_error(self):
            d = np.ones(100)
            assert_raises(TypeError, d.__sizeof__, "a")


class TestHashing(TestCase):

    def test_arrays_not_hashable(self):
        x = np.ones(3)
        assert_raises(TypeError, hash, x)

    def test_collections_hashable(self):
        x = np.array([])
        self.assertFalse(isinstance(x, collections.Hashable))


class TestArrayPriority(TestCase):
    # This will go away when __array_priority__ is settled, meanwhile
    # it serves to check unintended changes.
    op = operator
    binary_ops = [
        op.pow, op.add, op.sub, op.mul, op.floordiv, op.truediv, op.mod,
        op.and_, op.or_, op.xor, op.lshift, op.rshift, op.mod, op.gt,
        op.ge, op.lt, op.le, op.ne, op.eq
        ]

    # See #7949. Dont use "/" operator With -3 switch, since python reports it
    # as a DeprecationWarning
    if sys.version_info[0] < 3 and not sys.py3kwarning:
        binary_ops.append(op.div)

    class Foo(np.ndarray):
        __array_priority__ = 100.

        def __new__(cls, *args, **kwargs):
            return np.array(*args, **kwargs).view(cls)

    class Bar(np.ndarray):
        __array_priority__ = 101.

        def __new__(cls, *args, **kwargs):
            return np.array(*args, **kwargs).view(cls)

    class Other(object):
        __array_priority__ = 1000.

        def _all(self, other):
            return self.__class__()

        __add__ = __radd__ = _all
        __sub__ = __rsub__ = _all
        __mul__ = __rmul__ = _all
        __pow__ = __rpow__ = _all
        __div__ = __rdiv__ = _all
        __mod__ = __rmod__ = _all
        __truediv__ = __rtruediv__ = _all
        __floordiv__ = __rfloordiv__ = _all
        __and__ = __rand__ = _all
        __xor__ = __rxor__ = _all
        __or__ = __ror__ = _all
        __lshift__ = __rlshift__ = _all
        __rshift__ = __rrshift__ = _all
        __eq__ = _all
        __ne__ = _all
        __gt__ = _all
        __ge__ = _all
        __lt__ = _all
        __le__ = _all

    def test_ndarray_subclass(self):
        a = np.array([1, 2])
        b = self.Bar([1, 2])
        for f in self.binary_ops:
            msg = repr(f)
            assert_(isinstance(f(a, b), self.Bar), msg)
            assert_(isinstance(f(b, a), self.Bar), msg)

    def test_ndarray_other(self):
        a = np.array([1, 2])
        b = self.Other()
        for f in self.binary_ops:
            msg = repr(f)
            assert_(isinstance(f(a, b), self.Other), msg)
            assert_(isinstance(f(b, a), self.Other), msg)

    def test_subclass_subclass(self):
        a = self.Foo([1, 2])
        b = self.Bar([1, 2])
        for f in self.binary_ops:
            msg = repr(f)
            assert_(isinstance(f(a, b), self.Bar), msg)
            assert_(isinstance(f(b, a), self.Bar), msg)

    def test_subclass_other(self):
        a = self.Foo([1, 2])
        b = self.Other()
        for f in self.binary_ops:
            msg = repr(f)
            assert_(isinstance(f(a, b), self.Other), msg)
            assert_(isinstance(f(b, a), self.Other), msg)


class TestBytestringArrayNonzero(TestCase):

    def test_empty_bstring_array_is_falsey(self):
        self.assertFalse(np.array([''], dtype=np.str))

    def test_whitespace_bstring_array_is_falsey(self):
        a = np.array(['spam'], dtype=np.str)
        a[0] = '  \0\0'
        self.assertFalse(a)

    def test_all_null_bstring_array_is_falsey(self):
        a = np.array(['spam'], dtype=np.str)
        a[0] = '\0\0\0\0'
        self.assertFalse(a)

    def test_null_inside_bstring_array_is_truthy(self):
        a = np.array(['spam'], dtype=np.str)
        a[0] = ' \0 \0'
        self.assertTrue(a)


class TestUnicodeArrayNonzero(TestCase):

    def test_empty_ustring_array_is_falsey(self):
        self.assertFalse(np.array([''], dtype=np.unicode))

    def test_whitespace_ustring_array_is_falsey(self):
        a = np.array(['eggs'], dtype=np.unicode)
        a[0] = '  \0\0'
        self.assertFalse(a)

    def test_all_null_ustring_array_is_falsey(self):
        a = np.array(['eggs'], dtype=np.unicode)
        a[0] = '\0\0\0\0'
        self.assertFalse(a)

    def test_null_inside_ustring_array_is_truthy(self):
        a = np.array(['eggs'], dtype=np.unicode)
        a[0] = ' \0 \0'
        self.assertTrue(a)


class TestCTypes(TestCase):

    def test_ctypes_is_available(self):
        test_arr = np.array([[1, 2, 3], [4, 5, 6]])

        self.assertEqual(ctypes, test_arr.ctypes._ctypes)
        assert_equal(tuple(test_arr.ctypes.shape), (2, 3))

    def test_ctypes_is_not_available(self):
        from numpy.core import _internal
        _internal.ctypes = None
        try:
            test_arr = np.array([[1, 2, 3], [4, 5, 6]])

            self.assertIsInstance(
                test_arr.ctypes._ctypes, _internal._missing_ctypes)
            assert_equal(tuple(test_arr.ctypes.shape), (2, 3))
        finally:
            _internal.ctypes = ctypes


def test_orderconverter_with_nonASCII_unicode_ordering():
    # gh-7475
    a = np.arange(5)
    assert_raises(ValueError, a.flatten, order=u'\xe2')


def test_equal_override():
    # gh-9153: ndarray.__eq__ uses special logic for structured arrays, which
    # did not respect overrides with __array_priority__ or __array_ufunc__.
    # The PR fixed this for __array_priority__ and __array_ufunc__ = None.
    class MyAlwaysEqual(object):
        def __eq__(self, other):
            return "eq"

        def __ne__(self, other):
            return "ne"

    class MyAlwaysEqualOld(MyAlwaysEqual):
        __array_priority__ = 10000

    class MyAlwaysEqualNew(MyAlwaysEqual):
        __array_ufunc__ = None

    array = np.array([(0, 1), (2, 3)], dtype='i4,i4')
    for my_always_equal_cls in MyAlwaysEqualOld, MyAlwaysEqualNew:
        my_always_equal = my_always_equal_cls()
        assert_equal(my_always_equal == array, 'eq')
        assert_equal(array == my_always_equal, 'eq')
        assert_equal(my_always_equal != array, 'ne')
        assert_equal(array != my_always_equal, 'ne')


if __name__ == "__main__":
    run_module_suite()
