from __future__ import division, absolute_import, print_function

import operator
import warnings
import sys
import decimal

import numpy as np
from numpy.testing import (
    run_module_suite, TestCase, assert_, assert_equal, assert_array_equal,
    assert_almost_equal, assert_array_almost_equal, assert_raises,
    assert_allclose, assert_array_max_ulp, assert_warns,
    assert_raises_regex, dec, suppress_warnings
)
from numpy.testing.utils import HAS_REFCOUNT
import numpy.lib.function_base as nfb
from numpy.random import rand
from numpy.lib import (
    add_newdoc_ufunc, angle, average, bartlett, blackman, corrcoef, cov,
    delete, diff, digitize, extract, flipud, gradient, hamming, hanning,
    histogram, histogramdd, i0, insert, interp, kaiser, meshgrid, msort,
    piecewise, place, rot90, select, setxor1d, sinc, split, trapz, trim_zeros,
    unwrap, unique, vectorize
)

from numpy.compat import long


def get_mat(n):
    data = np.arange(n)
    data = np.add.outer(data, data)
    return data


class TestRot90(TestCase):
    def test_basic(self):
        self.assertRaises(ValueError, rot90, np.ones(4))
        assert_raises(ValueError, rot90, np.ones((2,2,2)), axes=(0,1,2))
        assert_raises(ValueError, rot90, np.ones((2,2)), axes=(0,2))
        assert_raises(ValueError, rot90, np.ones((2,2)), axes=(1,1))
        assert_raises(ValueError, rot90, np.ones((2,2,2)), axes=(-2,1))

        a = [[0, 1, 2],
             [3, 4, 5]]
        b1 = [[2, 5],
              [1, 4],
              [0, 3]]
        b2 = [[5, 4, 3],
              [2, 1, 0]]
        b3 = [[3, 0],
              [4, 1],
              [5, 2]]
        b4 = [[0, 1, 2],
              [3, 4, 5]]

        for k in range(-3, 13, 4):
            assert_equal(rot90(a, k=k), b1)
        for k in range(-2, 13, 4):
            assert_equal(rot90(a, k=k), b2)
        for k in range(-1, 13, 4):
            assert_equal(rot90(a, k=k), b3)
        for k in range(0, 13, 4):
            assert_equal(rot90(a, k=k), b4)

        assert_equal(rot90(rot90(a, axes=(0,1)), axes=(1,0)), a)
        assert_equal(rot90(a, k=1, axes=(1,0)), rot90(a, k=-1, axes=(0,1)))

    def test_axes(self):
        a = np.ones((50, 40, 3))
        assert_equal(rot90(a).shape, (40, 50, 3))
        assert_equal(rot90(a, axes=(0,2)), rot90(a, axes=(0,-1)))
        assert_equal(rot90(a, axes=(1,2)), rot90(a, axes=(-2,-1)))

    def test_rotation_axes(self):
        a = np.arange(8).reshape((2,2,2))

        a_rot90_01 = [[[2, 3],
                       [6, 7]],
                      [[0, 1],
                       [4, 5]]]
        a_rot90_12 = [[[1, 3],
                       [0, 2]],
                      [[5, 7],
                       [4, 6]]]
        a_rot90_20 = [[[4, 0],
                       [6, 2]],
                      [[5, 1],
                       [7, 3]]]
        a_rot90_10 = [[[4, 5],
                       [0, 1]],
                      [[6, 7],
                       [2, 3]]]

        assert_equal(rot90(a, axes=(0, 1)), a_rot90_01)
        assert_equal(rot90(a, axes=(1, 0)), a_rot90_10)
        assert_equal(rot90(a, axes=(1, 2)), a_rot90_12)

        for k in range(1,5):
            assert_equal(rot90(a, k=k, axes=(2, 0)),
                         rot90(a_rot90_20, k=k-1, axes=(2, 0)))


class TestFlip(TestCase):

    def test_axes(self):
        self.assertRaises(ValueError, np.flip, np.ones(4), axis=1)
        self.assertRaises(ValueError, np.flip, np.ones((4, 4)), axis=2)
        self.assertRaises(ValueError, np.flip, np.ones((4, 4)), axis=-3)

    def test_basic_lr(self):
        a = get_mat(4)
        b = a[:, ::-1]
        assert_equal(np.flip(a, 1), b)
        a = [[0, 1, 2],
             [3, 4, 5]]
        b = [[2, 1, 0],
             [5, 4, 3]]
        assert_equal(np.flip(a, 1), b)

    def test_basic_ud(self):
        a = get_mat(4)
        b = a[::-1, :]
        assert_equal(np.flip(a, 0), b)
        a = [[0, 1, 2],
             [3, 4, 5]]
        b = [[3, 4, 5],
             [0, 1, 2]]
        assert_equal(np.flip(a, 0), b)

    def test_3d_swap_axis0(self):
        a = np.array([[[0, 1],
                       [2, 3]],
                      [[4, 5],
                       [6, 7]]])

        b = np.array([[[4, 5],
                       [6, 7]],
                      [[0, 1],
                       [2, 3]]])

        assert_equal(np.flip(a, 0), b)

    def test_3d_swap_axis1(self):
        a = np.array([[[0, 1],
                       [2, 3]],
                      [[4, 5],
                       [6, 7]]])

        b = np.array([[[2, 3],
                       [0, 1]],
                      [[6, 7],
                       [4, 5]]])

        assert_equal(np.flip(a, 1), b)

    def test_3d_swap_axis2(self):
        a = np.array([[[0, 1],
                       [2, 3]],
                      [[4, 5],
                       [6, 7]]])

        b = np.array([[[1, 0],
                       [3, 2]],
                      [[5, 4],
                       [7, 6]]])

        assert_equal(np.flip(a, 2), b)

    def test_4d(self):
        a = np.arange(2 * 3 * 4 * 5).reshape(2, 3, 4, 5)
        for i in range(a.ndim):
            assert_equal(np.flip(a, i),
                         np.flipud(a.swapaxes(0, i)).swapaxes(i, 0))


class TestAny(TestCase):

    def test_basic(self):
        y1 = [0, 0, 1, 0]
        y2 = [0, 0, 0, 0]
        y3 = [1, 0, 1, 0]
        assert_(np.any(y1))
        assert_(np.any(y3))
        assert_(not np.any(y2))

    def test_nd(self):
        y1 = [[0, 0, 0], [0, 1, 0], [1, 1, 0]]
        assert_(np.any(y1))
        assert_array_equal(np.sometrue(y1, axis=0), [1, 1, 0])
        assert_array_equal(np.sometrue(y1, axis=1), [0, 1, 1])


class TestAll(TestCase):

    def test_basic(self):
        y1 = [0, 1, 1, 0]
        y2 = [0, 0, 0, 0]
        y3 = [1, 1, 1, 1]
        assert_(not np.all(y1))
        assert_(np.all(y3))
        assert_(not np.all(y2))
        assert_(np.all(~np.array(y2)))

    def test_nd(self):
        y1 = [[0, 0, 1], [0, 1, 1], [1, 1, 1]]
        assert_(not np.all(y1))
        assert_array_equal(np.alltrue(y1, axis=0), [0, 0, 1])
        assert_array_equal(np.alltrue(y1, axis=1), [0, 0, 1])


class TestCopy(TestCase):

    def test_basic(self):
        a = np.array([[1, 2], [3, 4]])
        a_copy = np.copy(a)
        assert_array_equal(a, a_copy)
        a_copy[0, 0] = 10
        assert_equal(a[0, 0], 1)
        assert_equal(a_copy[0, 0], 10)

    def test_order(self):
        # It turns out that people rely on np.copy() preserving order by
        # default; changing this broke scikit-learn:
        # github.com/scikit-learn/scikit-learn/commit/7842748cf777412c506a8c0ed28090711d3a3783  # noqa
        a = np.array([[1, 2], [3, 4]])
        assert_(a.flags.c_contiguous)
        assert_(not a.flags.f_contiguous)
        a_fort = np.array([[1, 2], [3, 4]], order="F")
        assert_(not a_fort.flags.c_contiguous)
        assert_(a_fort.flags.f_contiguous)
        a_copy = np.copy(a)
        assert_(a_copy.flags.c_contiguous)
        assert_(not a_copy.flags.f_contiguous)
        a_fort_copy = np.copy(a_fort)
        assert_(not a_fort_copy.flags.c_contiguous)
        assert_(a_fort_copy.flags.f_contiguous)


class TestAverage(TestCase):

    def test_basic(self):
        y1 = np.array([1, 2, 3])
        assert_(average(y1, axis=0) == 2.)
        y2 = np.array([1., 2., 3.])
        assert_(average(y2, axis=0) == 2.)
        y3 = [0., 0., 0.]
        assert_(average(y3, axis=0) == 0.)

        y4 = np.ones((4, 4))
        y4[0, 1] = 0
        y4[1, 0] = 2
        assert_almost_equal(y4.mean(0), average(y4, 0))
        assert_almost_equal(y4.mean(1), average(y4, 1))

        y5 = rand(5, 5)
        assert_almost_equal(y5.mean(0), average(y5, 0))
        assert_almost_equal(y5.mean(1), average(y5, 1))

        y6 = np.matrix(rand(5, 5))
        assert_array_equal(y6.mean(0), average(y6, 0))

    def test_weights(self):
        y = np.arange(10)
        w = np.arange(10)
        actual = average(y, weights=w)
        desired = (np.arange(10) ** 2).sum() * 1. / np.arange(10).sum()
        assert_almost_equal(actual, desired)

        y1 = np.array([[1, 2, 3], [4, 5, 6]])
        w0 = [1, 2]
        actual = average(y1, weights=w0, axis=0)
        desired = np.array([3., 4., 5.])
        assert_almost_equal(actual, desired)

        w1 = [0, 0, 1]
        actual = average(y1, weights=w1, axis=1)
        desired = np.array([3., 6.])
        assert_almost_equal(actual, desired)

        # This should raise an error. Can we test for that ?
        # assert_equal(average(y1, weights=w1), 9./2.)

        # 2D Case
        w2 = [[0, 0, 1], [0, 0, 2]]
        desired = np.array([3., 6.])
        assert_array_equal(average(y1, weights=w2, axis=1), desired)
        assert_equal(average(y1, weights=w2), 5.)

        y3 = rand(5).astype(np.float32)
        w3 = rand(5).astype(np.float64)

        assert_(np.average(y3, weights=w3).dtype == np.result_type(y3, w3))

    def test_returned(self):
        y = np.array([[1, 2, 3], [4, 5, 6]])

        # No weights
        avg, scl = average(y, returned=True)
        assert_equal(scl, 6.)

        avg, scl = average(y, 0, returned=True)
        assert_array_equal(scl, np.array([2., 2., 2.]))

        avg, scl = average(y, 1, returned=True)
        assert_array_equal(scl, np.array([3., 3.]))

        # With weights
        w0 = [1, 2]
        avg, scl = average(y, weights=w0, axis=0, returned=True)
        assert_array_equal(scl, np.array([3., 3., 3.]))

        w1 = [1, 2, 3]
        avg, scl = average(y, weights=w1, axis=1, returned=True)
        assert_array_equal(scl, np.array([6., 6.]))

        w2 = [[0, 0, 1], [1, 2, 3]]
        avg, scl = average(y, weights=w2, axis=1, returned=True)
        assert_array_equal(scl, np.array([1., 6.]))

    def test_subclasses(self):
        class subclass(np.ndarray):
            pass
        a = np.array([[1,2],[3,4]]).view(subclass)
        w = np.array([[1,2],[3,4]]).view(subclass)

        assert_equal(type(np.average(a)), subclass)
        assert_equal(type(np.average(a, weights=w)), subclass)

        # also test matrices
        a = np.matrix([[1,2],[3,4]])
        w = np.matrix([[1,2],[3,4]])

        r = np.average(a, axis=0, weights=w)
        assert_equal(type(r), np.matrix)
        assert_equal(r, [[2.5, 10.0/3]])

    def test_upcasting(self):
        types = [('i4', 'i4', 'f8'), ('i4', 'f4', 'f8'), ('f4', 'i4', 'f8'),
                 ('f4', 'f4', 'f4'), ('f4', 'f8', 'f8')]
        for at, wt, rt in types:
            a = np.array([[1,2],[3,4]], dtype=at)
            w = np.array([[1,2],[3,4]], dtype=wt)
            assert_equal(np.average(a, weights=w).dtype, np.dtype(rt))

    def test_object_dtype(self):
        a = np.array([decimal.Decimal(x) for x in range(10)])
        w = np.array([decimal.Decimal(1) for _ in range(10)])
        w /= w.sum()
        assert_almost_equal(a.mean(0), average(a, weights=w)) 

class TestSelect(TestCase):
    choices = [np.array([1, 2, 3]),
               np.array([4, 5, 6]),
               np.array([7, 8, 9])]
    conditions = [np.array([False, False, False]),
                  np.array([False, True, False]),
                  np.array([False, False, True])]

    def _select(self, cond, values, default=0):
        output = []
        for m in range(len(cond)):
            output += [V[m] for V, C in zip(values, cond) if C[m]] or [default]
        return output

    def test_basic(self):
        choices = self.choices
        conditions = self.conditions
        assert_array_equal(select(conditions, choices, default=15),
                           self._select(conditions, choices, default=15))

        assert_equal(len(choices), 3)
        assert_equal(len(conditions), 3)

    def test_broadcasting(self):
        conditions = [np.array(True), np.array([False, True, False])]
        choices = [1, np.arange(12).reshape(4, 3)]
        assert_array_equal(select(conditions, choices), np.ones((4, 3)))
        # default can broadcast too:
        assert_equal(select([True], [0], default=[0]).shape, (1,))

    def test_return_dtype(self):
        assert_equal(select(self.conditions, self.choices, 1j).dtype,
                     np.complex_)
        # But the conditions need to be stronger then the scalar default
        # if it is scalar.
        choices = [choice.astype(np.int8) for choice in self.choices]
        assert_equal(select(self.conditions, choices).dtype, np.int8)

        d = np.array([1, 2, 3, np.nan, 5, 7])
        m = np.isnan(d)
        assert_equal(select([m], [d]), [0, 0, 0, np.nan, 0, 0])

    def test_deprecated_empty(self):
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            assert_equal(select([], [], 3j), 3j)

        with warnings.catch_warnings():
            warnings.simplefilter("always")
            assert_warns(DeprecationWarning, select, [], [])
            warnings.simplefilter("error")
            assert_raises(DeprecationWarning, select, [], [])

    def test_non_bool_deprecation(self):
        choices = self.choices
        conditions = self.conditions[:]
        with warnings.catch_warnings():
            warnings.filterwarnings("always")
            conditions[0] = conditions[0].astype(np.int_)
            assert_warns(DeprecationWarning, select, conditions, choices)
            conditions[0] = conditions[0].astype(np.uint8)
            assert_warns(DeprecationWarning, select, conditions, choices)
            warnings.filterwarnings("error")
            assert_raises(DeprecationWarning, select, conditions, choices)

    def test_many_arguments(self):
        # This used to be limited by NPY_MAXARGS == 32
        conditions = [np.array([False])] * 100
        choices = [np.array([1])] * 100
        select(conditions, choices)


class TestInsert(TestCase):

    def test_basic(self):
        a = [1, 2, 3]
        assert_equal(insert(a, 0, 1), [1, 1, 2, 3])
        assert_equal(insert(a, 3, 1), [1, 2, 3, 1])
        assert_equal(insert(a, [1, 1, 1], [1, 2, 3]), [1, 1, 2, 3, 2, 3])
        assert_equal(insert(a, 1, [1, 2, 3]), [1, 1, 2, 3, 2, 3])
        assert_equal(insert(a, [1, -1, 3], 9), [1, 9, 2, 9, 3, 9])
        assert_equal(insert(a, slice(-1, None, -1), 9), [9, 1, 9, 2, 9, 3])
        assert_equal(insert(a, [-1, 1, 3], [7, 8, 9]), [1, 8, 2, 7, 3, 9])
        b = np.array([0, 1], dtype=np.float64)
        assert_equal(insert(b, 0, b[0]), [0., 0., 1.])
        assert_equal(insert(b, [], []), b)
        # Bools will be treated differently in the future:
        # assert_equal(insert(a, np.array([True]*4), 9), [9, 1, 9, 2, 9, 3, 9])
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', FutureWarning)
            assert_equal(
                insert(a, np.array([True] * 4), 9), [1, 9, 9, 9, 9, 2, 3])
            assert_(w[0].category is FutureWarning)

    def test_multidim(self):
        a = [[1, 1, 1]]
        r = [[2, 2, 2],
             [1, 1, 1]]
        assert_equal(insert(a, 0, [1]), [1, 1, 1, 1])
        assert_equal(insert(a, 0, [2, 2, 2], axis=0), r)
        assert_equal(insert(a, 0, 2, axis=0), r)
        assert_equal(insert(a, 2, 2, axis=1), [[1, 1, 2, 1]])

        a = np.array([[1, 1], [2, 2], [3, 3]])
        b = np.arange(1, 4).repeat(3).reshape(3, 3)
        c = np.concatenate(
            (a[:, 0:1], np.arange(1, 4).repeat(3).reshape(3, 3).T,
             a[:, 1:2]), axis=1)
        assert_equal(insert(a, [1], [[1], [2], [3]], axis=1), b)
        assert_equal(insert(a, [1], [1, 2, 3], axis=1), c)
        # scalars behave differently, in this case exactly opposite:
        assert_equal(insert(a, 1, [1, 2, 3], axis=1), b)
        assert_equal(insert(a, 1, [[1], [2], [3]], axis=1), c)

        a = np.arange(4).reshape(2, 2)
        assert_equal(insert(a[:, :1], 1, a[:, 1], axis=1), a)
        assert_equal(insert(a[:1,:], 1, a[1,:], axis=0), a)

        # negative axis value
        a = np.arange(24).reshape((2, 3, 4))
        assert_equal(insert(a, 1, a[:,:, 3], axis=-1),
                     insert(a, 1, a[:,:, 3], axis=2))
        assert_equal(insert(a, 1, a[:, 2,:], axis=-2),
                     insert(a, 1, a[:, 2,:], axis=1))

        # invalid axis value
        assert_raises(np.AxisError, insert, a, 1, a[:, 2, :], axis=3)
        assert_raises(np.AxisError, insert, a, 1, a[:, 2, :], axis=-4)

        # negative axis value
        a = np.arange(24).reshape((2, 3, 4))
        assert_equal(insert(a, 1, a[:, :, 3], axis=-1),
                     insert(a, 1, a[:, :, 3], axis=2))
        assert_equal(insert(a, 1, a[:, 2, :], axis=-2),
                     insert(a, 1, a[:, 2, :], axis=1))

    def test_0d(self):
        # This is an error in the future
        a = np.array(1)
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', DeprecationWarning)
            assert_equal(insert(a, [], 2, axis=0), np.array(2))
            assert_(w[0].category is DeprecationWarning)

    def test_subclass(self):
        class SubClass(np.ndarray):
            pass
        a = np.arange(10).view(SubClass)
        assert_(isinstance(np.insert(a, 0, [0]), SubClass))
        assert_(isinstance(np.insert(a, [], []), SubClass))
        assert_(isinstance(np.insert(a, [0, 1], [1, 2]), SubClass))
        assert_(isinstance(np.insert(a, slice(1, 2), [1, 2]), SubClass))
        assert_(isinstance(np.insert(a, slice(1, -2, -1), []), SubClass))
        # This is an error in the future:
        a = np.array(1).view(SubClass)
        assert_(isinstance(np.insert(a, 0, [0]), SubClass))

    def test_index_array_copied(self):
        x = np.array([1, 1, 1])
        np.insert([0, 1, 2], x, [3, 4, 5])
        assert_equal(x, np.array([1, 1, 1]))

    def test_structured_array(self):
        a = np.array([(1, 'a'), (2, 'b'), (3, 'c')],
                     dtype=[('foo', 'i'), ('bar', 'a1')])
        val = (4, 'd')
        b = np.insert(a, 0, val)
        assert_array_equal(b[0], np.array(val, dtype=b.dtype))
        val = [(4, 'd')] * 2
        b = np.insert(a, [0, 2], val)
        assert_array_equal(b[[0, 3]], np.array(val, dtype=b.dtype))


class TestAmax(TestCase):

    def test_basic(self):
        a = [3, 4, 5, 10, -3, -5, 6.0]
        assert_equal(np.amax(a), 10.0)
        b = [[3, 6.0, 9.0],
             [4, 10.0, 5.0],
             [8, 3.0, 2.0]]
        assert_equal(np.amax(b, axis=0), [8.0, 10.0, 9.0])
        assert_equal(np.amax(b, axis=1), [9.0, 10.0, 8.0])


class TestAmin(TestCase):

    def test_basic(self):
        a = [3, 4, 5, 10, -3, -5, 6.0]
        assert_equal(np.amin(a), -5.0)
        b = [[3, 6.0, 9.0],
             [4, 10.0, 5.0],
             [8, 3.0, 2.0]]
        assert_equal(np.amin(b, axis=0), [3.0, 3.0, 2.0])
        assert_equal(np.amin(b, axis=1), [3.0, 4.0, 2.0])


class TestPtp(TestCase):

    def test_basic(self):
        a = np.array([3, 4, 5, 10, -3, -5, 6.0])
        assert_equal(a.ptp(axis=0), 15.0)
        b = np.array([[3, 6.0, 9.0],
                      [4, 10.0, 5.0],
                      [8, 3.0, 2.0]])
        assert_equal(b.ptp(axis=0), [5.0, 7.0, 7.0])
        assert_equal(b.ptp(axis=-1), [6.0, 6.0, 6.0])


class TestCumsum(TestCase):

    def test_basic(self):
        ba = [1, 2, 10, 11, 6, 5, 4]
        ba2 = [[1, 2, 3, 4], [5, 6, 7, 9], [10, 3, 4, 5]]
        for ctype in [np.int8, np.uint8, np.int16, np.uint16, np.int32,
                      np.uint32, np.float32, np.float64, np.complex64,
                      np.complex128]:
            a = np.array(ba, ctype)
            a2 = np.array(ba2, ctype)

            tgt = np.array([1, 3, 13, 24, 30, 35, 39], ctype)
            assert_array_equal(np.cumsum(a, axis=0), tgt)

            tgt = np.array(
                [[1, 2, 3, 4], [6, 8, 10, 13], [16, 11, 14, 18]], ctype)
            assert_array_equal(np.cumsum(a2, axis=0), tgt)

            tgt = np.array(
                [[1, 3, 6, 10], [5, 11, 18, 27], [10, 13, 17, 22]], ctype)
            assert_array_equal(np.cumsum(a2, axis=1), tgt)


class TestProd(TestCase):

    def test_basic(self):
        ba = [1, 2, 10, 11, 6, 5, 4]
        ba2 = [[1, 2, 3, 4], [5, 6, 7, 9], [10, 3, 4, 5]]
        for ctype in [np.int16, np.uint16, np.int32, np.uint32,
                      np.float32, np.float64, np.complex64, np.complex128]:
            a = np.array(ba, ctype)
            a2 = np.array(ba2, ctype)
            if ctype in ['1', 'b']:
                self.assertRaises(ArithmeticError, np.prod, a)
                self.assertRaises(ArithmeticError, np.prod, a2, 1)
            else:
                assert_equal(a.prod(axis=0), 26400)
                assert_array_equal(a2.prod(axis=0),
                                   np.array([50, 36, 84, 180], ctype))
                assert_array_equal(a2.prod(axis=-1),
                                   np.array([24, 1890, 600], ctype))


class TestCumprod(TestCase):

    def test_basic(self):
        ba = [1, 2, 10, 11, 6, 5, 4]
        ba2 = [[1, 2, 3, 4], [5, 6, 7, 9], [10, 3, 4, 5]]
        for ctype in [np.int16, np.uint16, np.int32, np.uint32,
                      np.float32, np.float64, np.complex64, np.complex128]:
            a = np.array(ba, ctype)
            a2 = np.array(ba2, ctype)
            if ctype in ['1', 'b']:
                self.assertRaises(ArithmeticError, np.cumprod, a)
                self.assertRaises(ArithmeticError, np.cumprod, a2, 1)
                self.assertRaises(ArithmeticError, np.cumprod, a)
            else:
                assert_array_equal(np.cumprod(a, axis=-1),
                                   np.array([1, 2, 20, 220,
                                             1320, 6600, 26400], ctype))
                assert_array_equal(np.cumprod(a2, axis=0),
                                   np.array([[1, 2, 3, 4],
                                             [5, 12, 21, 36],
                                             [50, 36, 84, 180]], ctype))
                assert_array_equal(np.cumprod(a2, axis=-1),
                                   np.array([[1, 2, 6, 24],
                                             [5, 30, 210, 1890],
                                             [10, 30, 120, 600]], ctype))


class TestDiff(TestCase):

    def test_basic(self):
        x = [1, 4, 6, 7, 12]
        out = np.array([3, 2, 1, 5])
        out2 = np.array([-1, -1, 4])
        out3 = np.array([0, 5])
        assert_array_equal(diff(x), out)
        assert_array_equal(diff(x, n=2), out2)
        assert_array_equal(diff(x, n=3), out3)

    def test_nd(self):
        x = 20 * rand(10, 20, 30)
        out1 = x[:, :, 1:] - x[:, :, :-1]
        out2 = out1[:, :, 1:] - out1[:, :, :-1]
        out3 = x[1:, :, :] - x[:-1, :, :]
        out4 = out3[1:, :, :] - out3[:-1, :, :]
        assert_array_equal(diff(x), out1)
        assert_array_equal(diff(x, n=2), out2)
        assert_array_equal(diff(x, axis=0), out3)
        assert_array_equal(diff(x, n=2, axis=0), out4)


class TestDelete(TestCase):

    def setUp(self):
        self.a = np.arange(5)
        self.nd_a = np.arange(5).repeat(2).reshape(1, 5, 2)

    def _check_inverse_of_slicing(self, indices):
        a_del = delete(self.a, indices)
        nd_a_del = delete(self.nd_a, indices, axis=1)
        msg = 'Delete failed for obj: %r' % indices
        # NOTE: The cast should be removed after warning phase for bools
        if not isinstance(indices, (slice, int, long, np.integer)):
            indices = np.asarray(indices, dtype=np.intp)
            indices = indices[(indices >= 0) & (indices < 5)]
        assert_array_equal(setxor1d(a_del, self.a[indices, ]), self.a,
                           err_msg=msg)
        xor = setxor1d(nd_a_del[0,:, 0], self.nd_a[0, indices, 0])
        assert_array_equal(xor, self.nd_a[0,:, 0], err_msg=msg)

    def test_slices(self):
        lims = [-6, -2, 0, 1, 2, 4, 5]
        steps = [-3, -1, 1, 3]
        for start in lims:
            for stop in lims:
                for step in steps:
                    s = slice(start, stop, step)
                    self._check_inverse_of_slicing(s)

    def test_fancy(self):
        # Deprecation/FutureWarning tests should be kept after change.
        self._check_inverse_of_slicing(np.array([[0, 1], [2, 1]]))
        with warnings.catch_warnings():
            warnings.filterwarnings('error', category=DeprecationWarning)
            assert_raises(DeprecationWarning, delete, self.a, [100])
            assert_raises(DeprecationWarning, delete, self.a, [-100])
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', category=FutureWarning)
            self._check_inverse_of_slicing([0, -1, 2, 2])
            obj = np.array([True, False, False], dtype=bool)
            self._check_inverse_of_slicing(obj)
            assert_(w[0].category is FutureWarning)
            assert_(w[1].category is FutureWarning)

    def test_single(self):
        self._check_inverse_of_slicing(0)
        self._check_inverse_of_slicing(-4)

    def test_0d(self):
        a = np.array(1)
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', DeprecationWarning)
            assert_equal(delete(a, [], axis=0), a)
            assert_(w[0].category is DeprecationWarning)

    def test_subclass(self):
        class SubClass(np.ndarray):
            pass
        a = self.a.view(SubClass)
        assert_(isinstance(delete(a, 0), SubClass))
        assert_(isinstance(delete(a, []), SubClass))
        assert_(isinstance(delete(a, [0, 1]), SubClass))
        assert_(isinstance(delete(a, slice(1, 2)), SubClass))
        assert_(isinstance(delete(a, slice(1, -2)), SubClass))

    def test_array_order_preserve(self):
        # See gh-7113
        k = np.arange(10).reshape(2, 5, order='F')
        m = delete(k, slice(60, None), axis=1)

        # 'k' is Fortran ordered, and 'm' should have the
        # same ordering as 'k' and NOT become C ordered
        assert_equal(m.flags.c_contiguous, k.flags.c_contiguous)
        assert_equal(m.flags.f_contiguous, k.flags.f_contiguous)


class TestGradient(TestCase):

    def test_basic(self):
        v = [[1, 1], [3, 4]]
        x = np.array(v)
        dx = [np.array([[2., 3.], [2., 3.]]),
              np.array([[0., 0.], [1., 1.]])]
        assert_array_equal(gradient(x), dx)
        assert_array_equal(gradient(v), dx)

    def test_args(self):    
        dx = np.cumsum(np.ones(5))
        dx_uneven = [1., 2., 5., 9., 11.]
        f_2d = np.arange(25).reshape(5, 5)

        # distances must be scalars or have size equal to gradient[axis]
        gradient(np.arange(5), 3.)
        gradient(np.arange(5), dx)
        gradient(f_2d, 1.5)  # dy is set equal to dx because scalar

        gradient(f_2d, dx_uneven, dx_uneven)
        # mix between even and uneven spaces and
        # mix between scalar and vector
        gradient(f_2d, dx, 2)

        # 2D but axis specified
        gradient(f_2d, dx, axis=1)

    def test_badargs(self):
        f_2d = np.arange(25).reshape(5, 5)
        x = np.cumsum(np.ones(5))

        # wrong sizes
        assert_raises(ValueError, gradient, f_2d, x, np.ones(2))
        assert_raises(ValueError, gradient, f_2d, 1, np.ones(2))
        assert_raises(ValueError, gradient, f_2d, np.ones(2), np.ones(2))
        # wrong number of arguments
        assert_raises(TypeError, gradient, f_2d, x)
        assert_raises(TypeError, gradient, f_2d, x, axis=(0,1))
        assert_raises(TypeError, gradient, f_2d, x, x, x)
        assert_raises(TypeError, gradient, f_2d, 1, 1, 1)
        assert_raises(TypeError, gradient, f_2d, x, x, axis=1)
        assert_raises(TypeError, gradient, f_2d, 1, 1, axis=1)

    def test_datetime64(self):
        # Make sure gradient() can handle special types like datetime64
        x = np.array(
            ['1910-08-16', '1910-08-11', '1910-08-10', '1910-08-12',
             '1910-10-12', '1910-12-12', '1912-12-12'],
            dtype='datetime64[D]')
        dx = np.array(
            [-5, -3, 0, 31, 61, 396, 731],
            dtype='timedelta64[D]')
        assert_array_equal(gradient(x), dx)
        assert_(dx.dtype == np.dtype('timedelta64[D]'))

    def test_masked(self):
        # Make sure that gradient supports subclasses like masked arrays
        x = np.ma.array([[1, 1], [3, 4]],
                        mask=[[False, False], [False, False]])
        out = gradient(x)[0]
        assert_equal(type(out), type(x))
        # And make sure that the output and input don't have aliased mask
        # arrays
        assert_(x.mask is not out.mask)
        # Also check that edge_order=2 doesn't alter the original mask
        x2 = np.ma.arange(5)
        x2[2] = np.ma.masked
        np.gradient(x2, edge_order=2)
        assert_array_equal(x2.mask, [False, False, True, False, False])

    def test_second_order_accurate(self):
        # Testing that the relative numerical error is less that 3% for
        # this example problem. This corresponds to second order
        # accurate finite differences for all interior and boundary
        # points.
        x = np.linspace(0, 1, 10)
        dx = x[1] - x[0]
        y = 2 * x ** 3 + 4 * x ** 2 + 2 * x
        analytical = 6 * x ** 2 + 8 * x + 2
        num_error = np.abs((np.gradient(y, dx, edge_order=2) / analytical) - 1)
        assert_(np.all(num_error < 0.03) == True)

        # test with unevenly spaced
        np.random.seed(0)
        x = np.sort(np.random.random(10))
        y = 2 * x ** 3 + 4 * x ** 2 + 2 * x
        analytical = 6 * x ** 2 + 8 * x + 2
        num_error = np.abs((np.gradient(y, x, edge_order=2) / analytical) - 1)
        assert_(np.all(num_error < 0.03) == True)

    def test_spacing(self):
        f = np.array([0, 2., 3., 4., 5., 5.])
        f = np.tile(f, (6,1)) + f.reshape(-1, 1) 
        x_uneven = np.array([0., 0.5, 1., 3., 5., 7.])
        x_even = np.arange(6.)
        
        fdx_even_ord1 = np.tile([2., 1.5, 1., 1., 0.5, 0.], (6,1))
        fdx_even_ord2 = np.tile([2.5, 1.5, 1., 1., 0.5, -0.5], (6,1))
        fdx_uneven_ord1 = np.tile([4., 3., 1.7, 0.5, 0.25, 0.], (6,1))
        fdx_uneven_ord2 = np.tile([5., 3., 1.7, 0.5, 0.25, -0.25], (6,1))
        
        # evenly spaced
        for edge_order, exp_res in [(1, fdx_even_ord1), (2, fdx_even_ord2)]:
            res1 = gradient(f, 1., axis=(0,1), edge_order=edge_order)
            res2 = gradient(f, x_even, x_even,
                            axis=(0,1), edge_order=edge_order)
            res3 = gradient(f, x_even, x_even,
                            axis=None, edge_order=edge_order)
            assert_array_equal(res1, res2)
            assert_array_equal(res2, res3)
            assert_almost_equal(res1[0], exp_res.T)    
            assert_almost_equal(res1[1], exp_res)    
            
            res1 = gradient(f, 1., axis=0, edge_order=edge_order)
            res2 = gradient(f, x_even, axis=0, edge_order=edge_order)
            assert_(res1.shape == res2.shape)
            assert_almost_equal(res2, exp_res.T)
            
            res1 = gradient(f, 1., axis=1, edge_order=edge_order)
            res2 = gradient(f, x_even, axis=1, edge_order=edge_order)
            assert_(res1.shape == res2.shape)
            assert_array_equal(res2, exp_res)
            
        # unevenly spaced
        for edge_order, exp_res in [(1, fdx_uneven_ord1), (2, fdx_uneven_ord2)]:
            res1 = gradient(f, x_uneven, x_uneven,
                            axis=(0,1), edge_order=edge_order)
            res2 = gradient(f, x_uneven, x_uneven,
                            axis=None, edge_order=edge_order)
            assert_array_equal(res1, res2)
            assert_almost_equal(res1[0], exp_res.T)
            assert_almost_equal(res1[1], exp_res)
            
            res1 = gradient(f, x_uneven, axis=0, edge_order=edge_order)
            assert_almost_equal(res1, exp_res.T)
            
            res1 = gradient(f, x_uneven, axis=1, edge_order=edge_order)
            assert_almost_equal(res1, exp_res)
                
        # mixed
        res1 = gradient(f, x_even, x_uneven, axis=(0,1), edge_order=1)
        res2 = gradient(f, x_uneven, x_even, axis=(1,0), edge_order=1)
        assert_array_equal(res1[0], res2[1])
        assert_array_equal(res1[1], res2[0])
        assert_almost_equal(res1[0], fdx_even_ord1.T)
        assert_almost_equal(res1[1], fdx_uneven_ord1)
        
        res1 = gradient(f, x_even, x_uneven, axis=(0,1), edge_order=2)
        res2 = gradient(f, x_uneven, x_even, axis=(1,0), edge_order=2)
        assert_array_equal(res1[0], res2[1])
        assert_array_equal(res1[1], res2[0])
        assert_almost_equal(res1[0], fdx_even_ord2.T)
        assert_almost_equal(res1[1], fdx_uneven_ord2)
        
    def test_specific_axes(self):
        # Testing that gradient can work on a given axis only
        v = [[1, 1], [3, 4]]
        x = np.array(v)
        dx = [np.array([[2., 3.], [2., 3.]]),
              np.array([[0., 0.], [1., 1.]])]
        assert_array_equal(gradient(x, axis=0), dx[0])
        assert_array_equal(gradient(x, axis=1), dx[1])
        assert_array_equal(gradient(x, axis=-1), dx[1])
        assert_array_equal(gradient(x, axis=(1, 0)), [dx[1], dx[0]])

        # test axis=None which means all axes
        assert_almost_equal(gradient(x, axis=None), [dx[0], dx[1]])
        # and is the same as no axis keyword given
        assert_almost_equal(gradient(x, axis=None), gradient(x))

        # test vararg order
        assert_array_equal(gradient(x, 2, 3, axis=(1, 0)),
                           [dx[1]/2.0, dx[0]/3.0])
        # test maximal number of varargs
        assert_raises(TypeError, gradient, x, 1, 2, axis=1)

        assert_raises(np.AxisError, gradient, x, axis=3)
        assert_raises(np.AxisError, gradient, x, axis=-3)
        # assert_raises(TypeError, gradient, x, axis=[1,])
        
    def test_timedelta64(self):
        # Make sure gradient() can handle special types like timedelta64
        x = np.array(
            [-5, -3, 10, 12, 61, 321, 300],
            dtype='timedelta64[D]')
        dx = np.array(
            [2, 7, 7, 25, 154, 119, -21],
            dtype='timedelta64[D]')
        assert_array_equal(gradient(x), dx)
        assert_(dx.dtype == np.dtype('timedelta64[D]'))

    def test_values(self):
        # needs at least 2 points for edge_order ==1
        gradient(np.arange(2), edge_order=1)
        # needs at least 3 points for edge_order ==1
        gradient(np.arange(3), edge_order=2)
        
        assert_raises(ValueError, gradient, np.arange(0), edge_order=1)
        assert_raises(ValueError, gradient, np.arange(0), edge_order=2)
        assert_raises(ValueError, gradient, np.arange(1), edge_order=1)
        assert_raises(ValueError, gradient, np.arange(1), edge_order=2)
        assert_raises(ValueError, gradient, np.arange(2), edge_order=2)  


class TestAngle(TestCase):

    def test_basic(self):
        x = [1 + 3j, np.sqrt(2) / 2.0 + 1j * np.sqrt(2) / 2,
             1, 1j, -1, -1j, 1 - 3j, -1 + 3j]
        y = angle(x)
        yo = [
            np.arctan(3.0 / 1.0),
            np.arctan(1.0), 0, np.pi / 2, np.pi, -np.pi / 2.0,
            -np.arctan(3.0 / 1.0), np.pi - np.arctan(3.0 / 1.0)]
        z = angle(x, deg=1)
        zo = np.array(yo) * 180 / np.pi
        assert_array_almost_equal(y, yo, 11)
        assert_array_almost_equal(z, zo, 11)


class TestTrimZeros(TestCase):

    """
    Only testing for integer splits.

    """

    def test_basic(self):
        a = np.array([0, 0, 1, 2, 3, 4, 0])
        res = trim_zeros(a)
        assert_array_equal(res, np.array([1, 2, 3, 4]))

    def test_leading_skip(self):
        a = np.array([0, 0, 1, 0, 2, 3, 4, 0])
        res = trim_zeros(a)
        assert_array_equal(res, np.array([1, 0, 2, 3, 4]))

    def test_trailing_skip(self):
        a = np.array([0, 0, 1, 0, 2, 3, 0, 4, 0])
        res = trim_zeros(a)
        assert_array_equal(res, np.array([1, 0, 2, 3, 0, 4]))


class TestExtins(TestCase):

    def test_basic(self):
        a = np.array([1, 3, 2, 1, 2, 3, 3])
        b = extract(a > 1, a)
        assert_array_equal(b, [3, 2, 2, 3, 3])

    def test_place(self):
        # Make sure that non-np.ndarray objects
        # raise an error instead of doing nothing
        assert_raises(TypeError, place, [1, 2, 3], [True, False], [0, 1])

        a = np.array([1, 4, 3, 2, 5, 8, 7])
        place(a, [0, 1, 0, 1, 0, 1, 0], [2, 4, 6])
        assert_array_equal(a, [1, 2, 3, 4, 5, 6, 7])

        place(a, np.zeros(7), [])
        assert_array_equal(a, np.arange(1, 8))

        place(a, [1, 0, 1, 0, 1, 0, 1], [8, 9])
        assert_array_equal(a, [8, 2, 9, 4, 8, 6, 9])
        assert_raises_regex(ValueError, "Cannot insert from an empty array",
                            lambda: place(a, [0, 0, 0, 0, 0, 1, 0], []))

        # See Issue #6974
        a = np.array(['12', '34'])
        place(a, [0, 1], '9')
        assert_array_equal(a, ['12', '9'])

    def test_both(self):
        a = rand(10)
        mask = a > 0.5
        ac = a.copy()
        c = extract(mask, a)
        place(a, mask, 0)
        place(a, mask, c)
        assert_array_equal(a, ac)


class TestVectorize(TestCase):

    def test_simple(self):
        def addsubtract(a, b):
            if a > b:
                return a - b
            else:
                return a + b

        f = vectorize(addsubtract)
        r = f([0, 3, 6, 9], [1, 3, 5, 7])
        assert_array_equal(r, [1, 6, 1, 2])

    def test_scalar(self):
        def addsubtract(a, b):
            if a > b:
                return a - b
            else:
                return a + b

        f = vectorize(addsubtract)
        r = f([0, 3, 6, 9], 5)
        assert_array_equal(r, [5, 8, 1, 4])

    def test_large(self):
        x = np.linspace(-3, 2, 10000)
        f = vectorize(lambda x: x)
        y = f(x)
        assert_array_equal(y, x)

    def test_ufunc(self):
        import math
        f = vectorize(math.cos)
        args = np.array([0, 0.5 * np.pi, np.pi, 1.5 * np.pi, 2 * np.pi])
        r1 = f(args)
        r2 = np.cos(args)
        assert_array_almost_equal(r1, r2)

    def test_keywords(self):

        def foo(a, b=1):
            return a + b

        f = vectorize(foo)
        args = np.array([1, 2, 3])
        r1 = f(args)
        r2 = np.array([2, 3, 4])
        assert_array_equal(r1, r2)
        r1 = f(args, 2)
        r2 = np.array([3, 4, 5])
        assert_array_equal(r1, r2)

    def test_keywords_no_func_code(self):
        # This needs to test a function that has keywords but
        # no func_code attribute, since otherwise vectorize will
        # inspect the func_code.
        import random
        try:
            vectorize(random.randrange)  # Should succeed
        except:
            raise AssertionError()

    def test_keywords2_ticket_2100(self):
        # Test kwarg support: enhancement ticket 2100

        def foo(a, b=1):
            return a + b

        f = vectorize(foo)
        args = np.array([1, 2, 3])
        r1 = f(a=args)
        r2 = np.array([2, 3, 4])
        assert_array_equal(r1, r2)
        r1 = f(b=1, a=args)
        assert_array_equal(r1, r2)
        r1 = f(args, b=2)
        r2 = np.array([3, 4, 5])
        assert_array_equal(r1, r2)

    def test_keywords3_ticket_2100(self):
        # Test excluded with mixed positional and kwargs: ticket 2100
        def mypolyval(x, p):
            _p = list(p)
            res = _p.pop(0)
            while _p:
                res = res * x + _p.pop(0)
            return res

        vpolyval = np.vectorize(mypolyval, excluded=['p', 1])
        ans = [3, 6]
        assert_array_equal(ans, vpolyval(x=[0, 1], p=[1, 2, 3]))
        assert_array_equal(ans, vpolyval([0, 1], p=[1, 2, 3]))
        assert_array_equal(ans, vpolyval([0, 1], [1, 2, 3]))

    def test_keywords4_ticket_2100(self):
        # Test vectorizing function with no positional args.
        @vectorize
        def f(**kw):
            res = 1.0
            for _k in kw:
                res *= kw[_k]
            return res

        assert_array_equal(f(a=[1, 2], b=[3, 4]), [3, 8])

    def test_keywords5_ticket_2100(self):
        # Test vectorizing function with no kwargs args.
        @vectorize
        def f(*v):
            return np.prod(v)

        assert_array_equal(f([1, 2], [3, 4]), [3, 8])

    def test_coverage1_ticket_2100(self):
        def foo():
            return 1

        f = vectorize(foo)
        assert_array_equal(f(), 1)

    def test_assigning_docstring(self):
        def foo(x):
            """Original documentation"""
            return x

        f = vectorize(foo)
        assert_equal(f.__doc__, foo.__doc__)

        doc = "Provided documentation"
        f = vectorize(foo, doc=doc)
        assert_equal(f.__doc__, doc)

    def test_UnboundMethod_ticket_1156(self):
        # Regression test for issue 1156
        class Foo:
            b = 2

            def bar(self, a):
                return a ** self.b

        assert_array_equal(vectorize(Foo().bar)(np.arange(9)),
                           np.arange(9) ** 2)
        assert_array_equal(vectorize(Foo.bar)(Foo(), np.arange(9)),
                           np.arange(9) ** 2)

    def test_execution_order_ticket_1487(self):
        # Regression test for dependence on execution order: issue 1487
        f1 = vectorize(lambda x: x)
        res1a = f1(np.arange(3))
        res1b = f1(np.arange(0.1, 3))
        f2 = vectorize(lambda x: x)
        res2b = f2(np.arange(0.1, 3))
        res2a = f2(np.arange(3))
        assert_equal(res1a, res2a)
        assert_equal(res1b, res2b)

    def test_string_ticket_1892(self):
        # Test vectorization over strings: issue 1892.
        f = np.vectorize(lambda x: x)
        s = '0123456789' * 10
        assert_equal(s, f(s))

    def test_cache(self):
        # Ensure that vectorized func called exactly once per argument.
        _calls = [0]

        @vectorize
        def f(x):
            _calls[0] += 1
            return x ** 2

        f.cache = True
        x = np.arange(5)
        assert_array_equal(f(x), x * x)
        assert_equal(_calls[0], len(x))

    def test_otypes(self):
        f = np.vectorize(lambda x: x)
        f.otypes = 'i'
        x = np.arange(5)
        assert_array_equal(f(x), x)

    def test_parse_gufunc_signature(self):
        assert_equal(nfb._parse_gufunc_signature('(x)->()'), ([('x',)], [()]))
        assert_equal(nfb._parse_gufunc_signature('(x,y)->()'),
                     ([('x', 'y')], [()]))
        assert_equal(nfb._parse_gufunc_signature('(x),(y)->()'),
                     ([('x',), ('y',)], [()]))
        assert_equal(nfb._parse_gufunc_signature('(x)->(y)'),
                     ([('x',)], [('y',)]))
        assert_equal(nfb._parse_gufunc_signature('(x)->(y),()'),
                     ([('x',)], [('y',), ()]))
        assert_equal(nfb._parse_gufunc_signature('(),(a,b,c),(d)->(d,e)'),
                     ([(), ('a', 'b', 'c'), ('d',)], [('d', 'e')]))
        with assert_raises(ValueError):
            nfb._parse_gufunc_signature('(x)(y)->()')
        with assert_raises(ValueError):
            nfb._parse_gufunc_signature('(x),(y)->')
        with assert_raises(ValueError):
            nfb._parse_gufunc_signature('((x))->(x)')

    def test_signature_simple(self):
        def addsubtract(a, b):
            if a > b:
                return a - b
            else:
                return a + b

        f = vectorize(addsubtract, signature='(),()->()')
        r = f([0, 3, 6, 9], [1, 3, 5, 7])
        assert_array_equal(r, [1, 6, 1, 2])

    def test_signature_mean_last(self):
        def mean(a):
            return a.mean()

        f = vectorize(mean, signature='(n)->()')
        r = f([[1, 3], [2, 4]])
        assert_array_equal(r, [2, 3])

    def test_signature_center(self):
        def center(a):
            return a - a.mean()

        f = vectorize(center, signature='(n)->(n)')
        r = f([[1, 3], [2, 4]])
        assert_array_equal(r, [[-1, 1], [-1, 1]])

    def test_signature_two_outputs(self):
        f = vectorize(lambda x: (x, x), signature='()->(),()')
        r = f([1, 2, 3])
        assert_(isinstance(r, tuple) and len(r) == 2)
        assert_array_equal(r[0], [1, 2, 3])
        assert_array_equal(r[1], [1, 2, 3])

    def test_signature_outer(self):
        f = vectorize(np.outer, signature='(a),(b)->(a,b)')
        r = f([1, 2], [1, 2, 3])
        assert_array_equal(r, [[1, 2, 3], [2, 4, 6]])

        r = f([[[1, 2]]], [1, 2, 3])
        assert_array_equal(r, [[[[1, 2, 3], [2, 4, 6]]]])

        r = f([[1, 0], [2, 0]], [1, 2, 3])
        assert_array_equal(r, [[[1, 2, 3], [0, 0, 0]],
                               [[2, 4, 6], [0, 0, 0]]])

        r = f([1, 2], [[1, 2, 3], [0, 0, 0]])
        assert_array_equal(r, [[[1, 2, 3], [2, 4, 6]],
                               [[0, 0, 0], [0, 0, 0]]])

    def test_signature_computed_size(self):
        f = vectorize(lambda x: x[:-1], signature='(n)->(m)')
        r = f([1, 2, 3])
        assert_array_equal(r, [1, 2])

        r = f([[1, 2, 3], [2, 3, 4]])
        assert_array_equal(r, [[1, 2], [2, 3]])

    def test_signature_excluded(self):

        def foo(a, b=1):
            return a + b

        f = vectorize(foo, signature='()->()', excluded={'b'})
        assert_array_equal(f([1, 2, 3]), [2, 3, 4])
        assert_array_equal(f([1, 2, 3], b=0), [1, 2, 3])

    def test_signature_otypes(self):
        f = vectorize(lambda x: x, signature='(n)->(n)', otypes=['float64'])
        r = f([1, 2, 3])
        assert_equal(r.dtype, np.dtype('float64'))
        assert_array_equal(r, [1, 2, 3])

    def test_signature_invalid_inputs(self):
        f = vectorize(operator.add, signature='(n),(n)->(n)')
        with assert_raises_regex(TypeError, 'wrong number of positional'):
            f([1, 2])
        with assert_raises_regex(
                ValueError, 'does not have enough dimensions'):
            f(1, 2)
        with assert_raises_regex(
                ValueError, 'inconsistent size for core dimension'):
            f([1, 2], [1, 2, 3])

        f = vectorize(operator.add, signature='()->()')
        with assert_raises_regex(TypeError, 'wrong number of positional'):
            f(1, 2)

    def test_signature_invalid_outputs(self):

        f = vectorize(lambda x: x[:-1], signature='(n)->(n)')
        with assert_raises_regex(
                ValueError, 'inconsistent size for core dimension'):
            f([1, 2, 3])

        f = vectorize(lambda x: x, signature='()->(),()')
        with assert_raises_regex(ValueError, 'wrong number of outputs'):
            f(1)

        f = vectorize(lambda x: (x, x), signature='()->()')
        with assert_raises_regex(ValueError, 'wrong number of outputs'):
            f([1, 2])

    def test_size_zero_output(self):
        # see issue 5868
        f = np.vectorize(lambda x: x)
        x = np.zeros([0, 5], dtype=int)
        with assert_raises_regex(ValueError, 'otypes'):
            f(x)

        f.otypes = 'i'
        assert_array_equal(f(x), x)

        f = np.vectorize(lambda x: x, signature='()->()')
        with assert_raises_regex(ValueError, 'otypes'):
            f(x)

        f = np.vectorize(lambda x: x, signature='()->()', otypes='i')
        assert_array_equal(f(x), x)

        f = np.vectorize(lambda x: x, signature='(n)->(n)', otypes='i')
        assert_array_equal(f(x), x)

        f = np.vectorize(lambda x: x, signature='(n)->(n)')
        assert_array_equal(f(x.T), x.T)

        f = np.vectorize(lambda x: [x], signature='()->(n)', otypes='i')
        with assert_raises_regex(ValueError, 'new output dimensions'):
            f(x)


class TestDigitize(TestCase):

    def test_forward(self):
        x = np.arange(-6, 5)
        bins = np.arange(-5, 5)
        assert_array_equal(digitize(x, bins), np.arange(11))

    def test_reverse(self):
        x = np.arange(5, -6, -1)
        bins = np.arange(5, -5, -1)
        assert_array_equal(digitize(x, bins), np.arange(11))

    def test_random(self):
        x = rand(10)
        bin = np.linspace(x.min(), x.max(), 10)
        assert_(np.all(digitize(x, bin) != 0))

    def test_right_basic(self):
        x = [1, 5, 4, 10, 8, 11, 0]
        bins = [1, 5, 10]
        default_answer = [1, 2, 1, 3, 2, 3, 0]
        assert_array_equal(digitize(x, bins), default_answer)
        right_answer = [0, 1, 1, 2, 2, 3, 0]
        assert_array_equal(digitize(x, bins, True), right_answer)

    def test_right_open(self):
        x = np.arange(-6, 5)
        bins = np.arange(-6, 4)
        assert_array_equal(digitize(x, bins, True), np.arange(11))

    def test_right_open_reverse(self):
        x = np.arange(5, -6, -1)
        bins = np.arange(4, -6, -1)
        assert_array_equal(digitize(x, bins, True), np.arange(11))

    def test_right_open_random(self):
        x = rand(10)
        bins = np.linspace(x.min(), x.max(), 10)
        assert_(np.all(digitize(x, bins, True) != 10))

    def test_monotonic(self):
        x = [-1, 0, 1, 2]
        bins = [0, 0, 1]
        assert_array_equal(digitize(x, bins, False), [0, 2, 3, 3])
        assert_array_equal(digitize(x, bins, True), [0, 0, 2, 3])
        bins = [1, 1, 0]
        assert_array_equal(digitize(x, bins, False), [3, 2, 0, 0])
        assert_array_equal(digitize(x, bins, True), [3, 3, 2, 0])
        bins = [1, 1, 1, 1]
        assert_array_equal(digitize(x, bins, False), [0, 0, 4, 4])
        assert_array_equal(digitize(x, bins, True), [0, 0, 0, 4])
        bins = [0, 0, 1, 0]
        assert_raises(ValueError, digitize, x, bins)
        bins = [1, 1, 0, 1]
        assert_raises(ValueError, digitize, x, bins)

    def test_casting_error(self):
        x = [1, 2, 3 + 1.j]
        bins = [1, 2, 3]
        assert_raises(TypeError, digitize, x, bins)
        x, bins = bins, x
        assert_raises(TypeError, digitize, x, bins)

    def test_return_type(self):
        # Functions returning indices should always return base ndarrays
        class A(np.ndarray):
            pass
        a = np.arange(5).view(A)
        b = np.arange(1, 3).view(A)
        assert_(not isinstance(digitize(b, a, False), A))
        assert_(not isinstance(digitize(b, a, True), A))


class TestUnwrap(TestCase):

    def test_simple(self):
        # check that unwrap removes jumps greather that 2*pi
        assert_array_equal(unwrap([1, 1 + 2 * np.pi]), [1, 1])
        # check that unwrap maintans continuity
        assert_(np.all(diff(unwrap(rand(10) * 100)) < np.pi))


class TestFilterwindows(TestCase):

    def test_hanning(self):
        # check symmetry
        w = hanning(10)
        assert_array_almost_equal(w, flipud(w), 7)
        # check known value
        assert_almost_equal(np.sum(w, axis=0), 4.500, 4)

    def test_hamming(self):
        # check symmetry
        w = hamming(10)
        assert_array_almost_equal(w, flipud(w), 7)
        # check known value
        assert_almost_equal(np.sum(w, axis=0), 4.9400, 4)

    def test_bartlett(self):
        # check symmetry
        w = bartlett(10)
        assert_array_almost_equal(w, flipud(w), 7)
        # check known value
        assert_almost_equal(np.sum(w, axis=0), 4.4444, 4)

    def test_blackman(self):
        # check symmetry
        w = blackman(10)
        assert_array_almost_equal(w, flipud(w), 7)
        # check known value
        assert_almost_equal(np.sum(w, axis=0), 3.7800, 4)


class TestTrapz(TestCase):

    def test_simple(self):
        x = np.arange(-10, 10, .1)
        r = trapz(np.exp(-.5 * x ** 2) / np.sqrt(2 * np.pi), dx=0.1)
        # check integral of normal equals 1
        assert_almost_equal(r, 1, 7)

    def test_ndim(self):
        x = np.linspace(0, 1, 3)
        y = np.linspace(0, 2, 8)
        z = np.linspace(0, 3, 13)

        wx = np.ones_like(x) * (x[1] - x[0])
        wx[0] /= 2
        wx[-1] /= 2
        wy = np.ones_like(y) * (y[1] - y[0])
        wy[0] /= 2
        wy[-1] /= 2
        wz = np.ones_like(z) * (z[1] - z[0])
        wz[0] /= 2
        wz[-1] /= 2

        q = x[:, None, None] + y[None,:, None] + z[None, None,:]

        qx = (q * wx[:, None, None]).sum(axis=0)
        qy = (q * wy[None, :, None]).sum(axis=1)
        qz = (q * wz[None, None, :]).sum(axis=2)

        # n-d `x`
        r = trapz(q, x=x[:, None, None], axis=0)
        assert_almost_equal(r, qx)
        r = trapz(q, x=y[None,:, None], axis=1)
        assert_almost_equal(r, qy)
        r = trapz(q, x=z[None, None,:], axis=2)
        assert_almost_equal(r, qz)

        # 1-d `x`
        r = trapz(q, x=x, axis=0)
        assert_almost_equal(r, qx)
        r = trapz(q, x=y, axis=1)
        assert_almost_equal(r, qy)
        r = trapz(q, x=z, axis=2)
        assert_almost_equal(r, qz)

    def test_masked(self):
        # Testing that masked arrays behave as if the function is 0 where
        # masked
        x = np.arange(5)
        y = x * x
        mask = x == 2
        ym = np.ma.array(y, mask=mask)
        r = 13.0  # sum(0.5 * (0 + 1) * 1.0 + 0.5 * (9 + 16))
        assert_almost_equal(trapz(ym, x), r)

        xm = np.ma.array(x, mask=mask)
        assert_almost_equal(trapz(ym, xm), r)

        xm = np.ma.array(x, mask=mask)
        assert_almost_equal(trapz(y, xm), r)

    def test_matrix(self):
        # Test to make sure matrices give the same answer as ndarrays
        x = np.linspace(0, 5)
        y = x * x
        r = trapz(y, x)
        mx = np.matrix(x)
        my = np.matrix(y)
        mr = trapz(my, mx)
        assert_almost_equal(mr, r)


class TestSinc(TestCase):

    def test_simple(self):
        assert_(sinc(0) == 1)
        w = sinc(np.linspace(-1, 1, 100))
        # check symmetry
        assert_array_almost_equal(w, flipud(w), 7)

    def test_array_like(self):
        x = [0, 0.5]
        y1 = sinc(np.array(x))
        y2 = sinc(list(x))
        y3 = sinc(tuple(x))
        assert_array_equal(y1, y2)
        assert_array_equal(y1, y3)


class TestHistogram(TestCase):

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_simple(self):
        n = 100
        v = rand(n)
        (a, b) = histogram(v)
        # check if the sum of the bins equals the number of samples
        assert_equal(np.sum(a, axis=0), n)
        # check that the bin counts are evenly spaced when the data is from
        # a linear function
        (a, b) = histogram(np.linspace(0, 10, 100))
        assert_array_equal(a, 10)

    def test_one_bin(self):
        # Ticket 632
        hist, edges = histogram([1, 2, 3, 4], [1, 2])
        assert_array_equal(hist, [2, ])
        assert_array_equal(edges, [1, 2])
        assert_raises(ValueError, histogram, [1, 2], bins=0)
        h, e = histogram([1, 2], bins=1)
        assert_equal(h, np.array([2]))
        assert_allclose(e, np.array([1., 2.]))

    def test_normed(self):
        # Check that the integral of the density equals 1.
        n = 100
        v = rand(n)
        a, b = histogram(v, normed=True)
        area = np.sum(a * diff(b))
        assert_almost_equal(area, 1)

        # Check with non-constant bin widths (buggy but backwards
        # compatible)
        v = np.arange(10)
        bins = [0, 1, 5, 9, 10]
        a, b = histogram(v, bins, normed=True)
        area = np.sum(a * diff(b))
        assert_almost_equal(area, 1)

    def test_density(self):
        # Check that the integral of the density equals 1.
        n = 100
        v = rand(n)
        a, b = histogram(v, density=True)
        area = np.sum(a * diff(b))
        assert_almost_equal(area, 1)

        # Check with non-constant bin widths
        v = np.arange(10)
        bins = [0, 1, 3, 6, 10]
        a, b = histogram(v, bins, density=True)
        assert_array_equal(a, .1)
        assert_equal(np.sum(a * diff(b)), 1)

        # Variale bin widths are especially useful to deal with
        # infinities.
        v = np.arange(10)
        bins = [0, 1, 3, 6, np.inf]
        a, b = histogram(v, bins, density=True)
        assert_array_equal(a, [.1, .1, .1, 0.])

        # Taken from a bug report from N. Becker on the numpy-discussion
        # mailing list Aug. 6, 2010.
        counts, dmy = np.histogram(
            [1, 2, 3, 4], [0.5, 1.5, np.inf], density=True)
        assert_equal(counts, [.25, 0])

    def test_outliers(self):
        # Check that outliers are not tallied
        a = np.arange(10) + .5

        # Lower outliers
        h, b = histogram(a, range=[0, 9])
        assert_equal(h.sum(), 9)

        # Upper outliers
        h, b = histogram(a, range=[1, 10])
        assert_equal(h.sum(), 9)

        # Normalization
        h, b = histogram(a, range=[1, 9], normed=True)
        assert_almost_equal((h * diff(b)).sum(), 1, decimal=15)

        # Weights
        w = np.arange(10) + .5
        h, b = histogram(a, range=[1, 9], weights=w, normed=True)
        assert_equal((h * diff(b)).sum(), 1)

        h, b = histogram(a, bins=8, range=[1, 9], weights=w)
        assert_equal(h, w[1:-1])

    def test_type(self):
        # Check the type of the returned histogram
        a = np.arange(10) + .5
        h, b = histogram(a)
        assert_(np.issubdtype(h.dtype, int))

        h, b = histogram(a, normed=True)
        assert_(np.issubdtype(h.dtype, float))

        h, b = histogram(a, weights=np.ones(10, int))
        assert_(np.issubdtype(h.dtype, int))

        h, b = histogram(a, weights=np.ones(10, float))
        assert_(np.issubdtype(h.dtype, float))

    def test_f32_rounding(self):
        # gh-4799, check that the rounding of the edges works with float32
        x = np.array([276.318359, -69.593948, 21.329449], dtype=np.float32)
        y = np.array([5005.689453, 4481.327637, 6010.369629], dtype=np.float32)
        counts_hist, xedges, yedges = np.histogram2d(x, y, bins=100)
        assert_equal(counts_hist.sum(), 3.)

    def test_weights(self):
        v = rand(100)
        w = np.ones(100) * 5
        a, b = histogram(v)
        na, nb = histogram(v, normed=True)
        wa, wb = histogram(v, weights=w)
        nwa, nwb = histogram(v, weights=w, normed=True)
        assert_array_almost_equal(a * 5, wa)
        assert_array_almost_equal(na, nwa)

        # Check weights are properly applied.
        v = np.linspace(0, 10, 10)
        w = np.concatenate((np.zeros(5), np.ones(5)))
        wa, wb = histogram(v, bins=np.arange(11), weights=w)
        assert_array_almost_equal(wa, w)

        # Check with integer weights
        wa, wb = histogram([1, 2, 2, 4], bins=4, weights=[4, 3, 2, 1])
        assert_array_equal(wa, [4, 5, 0, 1])
        wa, wb = histogram(
            [1, 2, 2, 4], bins=4, weights=[4, 3, 2, 1], normed=True)
        assert_array_almost_equal(wa, np.array([4, 5, 0, 1]) / 10. / 3. * 4)

        # Check weights with non-uniform bin widths
        a, b = histogram(
            np.arange(9), [0, 1, 3, 6, 10],
            weights=[2, 1, 1, 1, 1, 1, 1, 1, 1], density=True)
        assert_almost_equal(a, [.2, .1, .1, .075])

    def test_exotic_weights(self):

        # Test the use of weights that are not integer or floats, but e.g.
        # complex numbers or object types.

        # Complex weights
        values = np.array([1.3, 2.5, 2.3])
        weights = np.array([1, -1, 2]) + 1j * np.array([2, 1, 2])

        # Check with custom bins
        wa, wb = histogram(values, bins=[0, 2, 3], weights=weights)
        assert_array_almost_equal(wa, np.array([1, 1]) + 1j * np.array([2, 3]))

        # Check with even bins
        wa, wb = histogram(values, bins=2, range=[1, 3], weights=weights)
        assert_array_almost_equal(wa, np.array([1, 1]) + 1j * np.array([2, 3]))

        # Decimal weights
        from decimal import Decimal
        values = np.array([1.3, 2.5, 2.3])
        weights = np.array([Decimal(1), Decimal(2), Decimal(3)])

        # Check with custom bins
        wa, wb = histogram(values, bins=[0, 2, 3], weights=weights)
        assert_array_almost_equal(wa, [Decimal(1), Decimal(5)])

        # Check with even bins
        wa, wb = histogram(values, bins=2, range=[1, 3], weights=weights)
        assert_array_almost_equal(wa, [Decimal(1), Decimal(5)])

    def test_no_side_effects(self):
        # This is a regression test that ensures that values passed to
        # ``histogram`` are unchanged.
        values = np.array([1.3, 2.5, 2.3])
        np.histogram(values, range=[-10, 10], bins=100)
        assert_array_almost_equal(values, [1.3, 2.5, 2.3])

    def test_empty(self):
        a, b = histogram([], bins=([0, 1]))
        assert_array_equal(a, np.array([0]))
        assert_array_equal(b, np.array([0, 1]))

    def test_error_binnum_type (self):
        # Tests if right Error is raised if bins argument is float
        vals = np.linspace(0.0, 1.0, num=100)
        histogram(vals, 5)
        assert_raises(TypeError, histogram, vals, 2.4)

    def test_finite_range(self):
        # Normal ranges should be fine
        vals = np.linspace(0.0, 1.0, num=100)
        histogram(vals, range=[0.25,0.75])
        assert_raises(ValueError, histogram, vals, range=[np.nan,0.75])
        assert_raises(ValueError, histogram, vals, range=[0.25,np.inf])

    def test_bin_edge_cases(self):
        # Ensure that floating-point computations correctly place edge cases.
        arr = np.array([337, 404, 739, 806, 1007, 1811, 2012])
        hist, edges = np.histogram(arr, bins=8296, range=(2, 2280))
        mask = hist > 0
        left_edges = edges[:-1][mask]
        right_edges = edges[1:][mask]
        for x, left, right in zip(arr, left_edges, right_edges):
            self.assertGreaterEqual(x, left)
            self.assertLess(x, right)

    def test_last_bin_inclusive_range(self):
        arr = np.array([0.,  0.,  0.,  1.,  2.,  3.,  3.,  4.,  5.])
        hist, edges = np.histogram(arr, bins=30, range=(-0.5, 5))
        self.assertEqual(hist[-1], 1)


class TestHistogramOptimBinNums(TestCase):
    """
    Provide test coverage when using provided estimators for optimal number of
    bins
    """

    def test_empty(self):
        estimator_list = ['fd', 'scott', 'rice', 'sturges',
                          'doane', 'sqrt', 'auto']
        # check it can deal with empty data
        for estimator in estimator_list:
            a, b = histogram([], bins=estimator)
            assert_array_equal(a, np.array([0]))
            assert_array_equal(b, np.array([0, 1]))

    def test_simple(self):
        """
        Straightforward testing with a mixture of linspace data (for
        consistency). All test values have been precomputed and the values
        shouldn't change
        """
        # Some basic sanity checking, with some fixed data.
        # Checking for the correct number of bins
        basic_test = {50:   {'fd': 4,  'scott': 4,  'rice': 8,  'sturges': 7,
                             'doane': 8, 'sqrt': 8, 'auto': 7},
                      500:  {'fd': 8,  'scott': 8,  'rice': 16, 'sturges': 10,
                             'doane': 12, 'sqrt': 23, 'auto': 10},
                      5000: {'fd': 17, 'scott': 17, 'rice': 35, 'sturges': 14,
                             'doane': 17, 'sqrt': 71, 'auto': 17}}

        for testlen, expectedResults in basic_test.items():
            # Create some sort of non uniform data to test with
            # (2 peak uniform mixture)
            x1 = np.linspace(-10, -1, testlen // 5 * 2)
            x2 = np.linspace(1, 10, testlen // 5 * 3)
            x = np.concatenate((x1, x2))
            for estimator, numbins in expectedResults.items():
                a, b = np.histogram(x, estimator)
                assert_equal(len(a), numbins, err_msg="For the {0} estimator "
                             "with datasize of {1}".format(estimator, testlen))

    def test_small(self):
        """
        Smaller datasets have the potential to cause issues with the data
        adaptive methods, especially the FD method. All bin numbers have been
        precalculated.
        """
        small_dat = {1: {'fd': 1, 'scott': 1, 'rice': 1, 'sturges': 1,
                         'doane': 1, 'sqrt': 1},
                     2: {'fd': 2, 'scott': 1, 'rice': 3, 'sturges': 2,
                         'doane': 1, 'sqrt': 2},
                     3: {'fd': 2, 'scott': 2, 'rice': 3, 'sturges': 3,
                         'doane': 3, 'sqrt': 2}}

        for testlen, expectedResults in small_dat.items():
            testdat = np.arange(testlen)
            for estimator, expbins in expectedResults.items():
                a, b = np.histogram(testdat, estimator)
                assert_equal(len(a), expbins, err_msg="For the {0} estimator "
                             "with datasize of {1}".format(estimator, testlen))

    def test_incorrect_methods(self):
        """
        Check a Value Error is thrown when an unknown string is passed in
        """
        check_list = ['mad', 'freeman', 'histograms', 'IQR']
        for estimator in check_list:
            assert_raises(ValueError, histogram, [1, 2, 3], estimator)

    def test_novariance(self):
        """
        Check that methods handle no variance in data
        Primarily for Scott and FD as the SD and IQR are both 0 in this case
        """
        novar_dataset = np.ones(100)
        novar_resultdict = {'fd': 1, 'scott': 1, 'rice': 1, 'sturges': 1,
                            'doane': 1, 'sqrt': 1, 'auto': 1}

        for estimator, numbins in novar_resultdict.items():
            a, b = np.histogram(novar_dataset, estimator)
            assert_equal(len(a), numbins, err_msg="{0} estimator, "
                         "No Variance test".format(estimator))

    def test_outlier(self):
        """
        Check the FD, Scott and Doane with outliers.

        The FD estimates a smaller binwidth since it's less affected by
        outliers. Since the range is so (artificially) large, this means more
        bins, most of which will be empty, but the data of interest usually is
        unaffected. The Scott estimator is more affected and returns fewer bins,
        despite most of the variance being in one area of the data. The Doane
        estimator lies somewhere between the other two.
        """
        xcenter = np.linspace(-10, 10, 50)
        outlier_dataset = np.hstack((np.linspace(-110, -100, 5), xcenter))

        outlier_resultdict = {'fd': 21, 'scott': 5, 'doane': 11}

        for estimator, numbins in outlier_resultdict.items():
            a, b = np.histogram(outlier_dataset, estimator)
            assert_equal(len(a), numbins)

    def test_simple_range(self):
        """
        Straightforward testing with a mixture of linspace data (for
        consistency). Adding in a 3rd mixture that will then be
        completely ignored. All test values have been precomputed and
        the shouldn't change.
        """
        # some basic sanity checking, with some fixed data. 
        # Checking for the correct number of bins
        basic_test = {
                      50:   {'fd': 8,  'scott': 8,  'rice': 15,
                             'sturges': 14, 'auto': 14},
                      500:  {'fd': 15, 'scott': 16, 'rice': 32,
                             'sturges': 20, 'auto': 20},
                      5000: {'fd': 33, 'scott': 33, 'rice': 69,
                             'sturges': 27, 'auto': 33}
                     }

        for testlen, expectedResults in basic_test.items():
            # create some sort of non uniform data to test with 
            # (3 peak uniform mixture)
            x1 = np.linspace(-10, -1, testlen // 5 * 2)
            x2 = np.linspace(1, 10, testlen // 5 * 3)
            x3 = np.linspace(-100, -50, testlen)
            x = np.hstack((x1, x2, x3))
            for estimator, numbins in expectedResults.items():
                a, b = np.histogram(x, estimator, range = (-20, 20))
                msg = "For the {0} estimator".format(estimator)
                msg += " with datasize of {0}".format(testlen)
                assert_equal(len(a), numbins, err_msg=msg)

    def test_simple_weighted(self):
        """
        Check that weighted data raises a TypeError
        """
        estimator_list = ['fd', 'scott', 'rice', 'sturges', 'auto']
        for estimator in estimator_list:
            assert_raises(TypeError, histogram, [1, 2, 3], 
                          estimator, weights=[1, 2, 3])


class TestHistogramdd(TestCase):

    def test_simple(self):
        x = np.array([[-.5, .5, 1.5], [-.5, 1.5, 2.5], [-.5, 2.5, .5],
                      [.5,  .5, 1.5], [.5,  1.5, 2.5], [.5,  2.5, 2.5]])
        H, edges = histogramdd(x, (2, 3, 3),
                               range=[[-1, 1], [0, 3], [0, 3]])
        answer = np.array([[[0, 1, 0], [0, 0, 1], [1, 0, 0]],
                           [[0, 1, 0], [0, 0, 1], [0, 0, 1]]])
        assert_array_equal(H, answer)

        # Check normalization
        ed = [[-2, 0, 2], [0, 1, 2, 3], [0, 1, 2, 3]]
        H, edges = histogramdd(x, bins=ed, normed=True)
        assert_(np.all(H == answer / 12.))

        # Check that H has the correct shape.
        H, edges = histogramdd(x, (2, 3, 4),
                               range=[[-1, 1], [0, 3], [0, 4]],
                               normed=True)
        answer = np.array([[[0, 1, 0, 0], [0, 0, 1, 0], [1, 0, 0, 0]],
                           [[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 1, 0]]])
        assert_array_almost_equal(H, answer / 6., 4)
        # Check that a sequence of arrays is accepted and H has the correct
        # shape.
        z = [np.squeeze(y) for y in split(x, 3, axis=1)]
        H, edges = histogramdd(
            z, bins=(4, 3, 2), range=[[-2, 2], [0, 3], [0, 2]])
        answer = np.array([[[0, 0], [0, 0], [0, 0]],
                           [[0, 1], [0, 0], [1, 0]],
                           [[0, 1], [0, 0], [0, 0]],
                           [[0, 0], [0, 0], [0, 0]]])
        assert_array_equal(H, answer)

        Z = np.zeros((5, 5, 5))
        Z[list(range(5)), list(range(5)), list(range(5))] = 1.
        H, edges = histogramdd([np.arange(5), np.arange(5), np.arange(5)], 5)
        assert_array_equal(H, Z)

    def test_shape_3d(self):
        # All possible permutations for bins of different lengths in 3D.
        bins = ((5, 4, 6), (6, 4, 5), (5, 6, 4), (4, 6, 5), (6, 5, 4),
                (4, 5, 6))
        r = rand(10, 3)
        for b in bins:
            H, edges = histogramdd(r, b)
            assert_(H.shape == b)

    def test_shape_4d(self):
        # All possible permutations for bins of different lengths in 4D.
        bins = ((7, 4, 5, 6), (4, 5, 7, 6), (5, 6, 4, 7), (7, 6, 5, 4),
                (5, 7, 6, 4), (4, 6, 7, 5), (6, 5, 7, 4), (7, 5, 4, 6),
                (7, 4, 6, 5), (6, 4, 7, 5), (6, 7, 5, 4), (4, 6, 5, 7),
                (4, 7, 5, 6), (5, 4, 6, 7), (5, 7, 4, 6), (6, 7, 4, 5),
                (6, 5, 4, 7), (4, 7, 6, 5), (4, 5, 6, 7), (7, 6, 4, 5),
                (5, 4, 7, 6), (5, 6, 7, 4), (6, 4, 5, 7), (7, 5, 6, 4))

        r = rand(10, 4)
        for b in bins:
            H, edges = histogramdd(r, b)
            assert_(H.shape == b)

    def test_weights(self):
        v = rand(100, 2)
        hist, edges = histogramdd(v)
        n_hist, edges = histogramdd(v, normed=True)
        w_hist, edges = histogramdd(v, weights=np.ones(100))
        assert_array_equal(w_hist, hist)
        w_hist, edges = histogramdd(v, weights=np.ones(100) * 2, normed=True)
        assert_array_equal(w_hist, n_hist)
        w_hist, edges = histogramdd(v, weights=np.ones(100, int) * 2)
        assert_array_equal(w_hist, 2 * hist)

    def test_identical_samples(self):
        x = np.zeros((10, 2), int)
        hist, edges = histogramdd(x, bins=2)
        assert_array_equal(edges[0], np.array([-0.5, 0., 0.5]))

    def test_empty(self):
        a, b = histogramdd([[], []], bins=([0, 1], [0, 1]))
        assert_array_max_ulp(a, np.array([[0.]]))
        a, b = np.histogramdd([[], [], []], bins=2)
        assert_array_max_ulp(a, np.zeros((2, 2, 2)))

    def test_bins_errors(self):
        # There are two ways to specify bins. Check for the right errors
        # when mixing those.
        x = np.arange(8).reshape(2, 4)
        assert_raises(ValueError, np.histogramdd, x, bins=[-1, 2, 4, 5])
        assert_raises(ValueError, np.histogramdd, x, bins=[1, 0.99, 1, 1])
        assert_raises(
            ValueError, np.histogramdd, x, bins=[1, 1, 1, [1, 2, 2, 3]])
        assert_raises(
            ValueError, np.histogramdd, x, bins=[1, 1, 1, [1, 2, 3, -3]])
        assert_(np.histogramdd(x, bins=[1, 1, 1, [1, 2, 3, 4]]))

    def test_inf_edges(self):
        # Test using +/-inf bin edges works. See #1788.
        with np.errstate(invalid='ignore'):
            x = np.arange(6).reshape(3, 2)
            expected = np.array([[1, 0], [0, 1], [0, 1]])
            h, e = np.histogramdd(x, bins=[3, [-np.inf, 2, 10]])
            assert_allclose(h, expected)
            h, e = np.histogramdd(x, bins=[3, np.array([-1, 2, np.inf])])
            assert_allclose(h, expected)
            h, e = np.histogramdd(x, bins=[3, [-np.inf, 3, np.inf]])
            assert_allclose(h, expected)

    def test_rightmost_binedge(self):
        # Test event very close to rightmost binedge. See Github issue #4266
        x = [0.9999999995]
        bins = [[0., 0.5, 1.0]]
        hist, _ = histogramdd(x, bins=bins)
        assert_(hist[0] == 0.0)
        assert_(hist[1] == 1.)
        x = [1.0]
        bins = [[0., 0.5, 1.0]]
        hist, _ = histogramdd(x, bins=bins)
        assert_(hist[0] == 0.0)
        assert_(hist[1] == 1.)
        x = [1.0000000001]
        bins = [[0., 0.5, 1.0]]
        hist, _ = histogramdd(x, bins=bins)
        assert_(hist[0] == 0.0)
        assert_(hist[1] == 1.)
        x = [1.0001]
        bins = [[0., 0.5, 1.0]]
        hist, _ = histogramdd(x, bins=bins)
        assert_(hist[0] == 0.0)
        assert_(hist[1] == 0.0)

    def test_finite_range(self):
        vals = np.random.random((100, 3))
        histogramdd(vals, range=[[0.0, 1.0], [0.25, 0.75], [0.25, 0.5]])
        assert_raises(ValueError, histogramdd, vals,
                      range=[[0.0, 1.0], [0.25, 0.75], [0.25, np.inf]])
        assert_raises(ValueError, histogramdd, vals,
                      range=[[0.0, 1.0], [np.nan, 0.75], [0.25, 0.5]])


class TestUnique(TestCase):

    def test_simple(self):
        x = np.array([4, 3, 2, 1, 1, 2, 3, 4, 0])
        assert_(np.all(unique(x) == [0, 1, 2, 3, 4]))
        assert_(unique(np.array([1, 1, 1, 1, 1])) == np.array([1]))
        x = ['widget', 'ham', 'foo', 'bar', 'foo', 'ham']
        assert_(np.all(unique(x) == ['bar', 'foo', 'ham', 'widget']))
        x = np.array([5 + 6j, 1 + 1j, 1 + 10j, 10, 5 + 6j])
        assert_(np.all(unique(x) == [1 + 1j, 1 + 10j, 5 + 6j, 10]))


class TestCheckFinite(TestCase):

    def test_simple(self):
        a = [1, 2, 3]
        b = [1, 2, np.inf]
        c = [1, 2, np.nan]
        np.lib.asarray_chkfinite(a)
        assert_raises(ValueError, np.lib.asarray_chkfinite, b)
        assert_raises(ValueError, np.lib.asarray_chkfinite, c)

    def test_dtype_order(self):
        # Regression test for missing dtype and order arguments
        a = [1, 2, 3]
        a = np.lib.asarray_chkfinite(a, order='F', dtype=np.float64)
        assert_(a.dtype == np.float64)


class TestCorrCoef(TestCase):
    A = np.array(
        [[0.15391142, 0.18045767, 0.14197213],
         [0.70461506, 0.96474128, 0.27906989],
         [0.9297531, 0.32296769, 0.19267156]])
    B = np.array(
        [[0.10377691, 0.5417086, 0.49807457],
         [0.82872117, 0.77801674, 0.39226705],
         [0.9314666, 0.66800209, 0.03538394]])
    res1 = np.array(
        [[1., 0.9379533, -0.04931983],
         [0.9379533, 1., 0.30007991],
         [-0.04931983, 0.30007991, 1.]])
    res2 = np.array(
        [[1., 0.9379533, -0.04931983, 0.30151751, 0.66318558, 0.51532523],
         [0.9379533, 1., 0.30007991, -0.04781421, 0.88157256, 0.78052386],
         [-0.04931983, 0.30007991, 1., -0.96717111, 0.71483595, 0.83053601],
         [0.30151751, -0.04781421, -0.96717111, 1., -0.51366032, -0.66173113],
         [0.66318558, 0.88157256, 0.71483595, -0.51366032, 1., 0.98317823],
         [0.51532523, 0.78052386, 0.83053601, -0.66173113, 0.98317823, 1.]])

    def test_non_array(self):
        assert_almost_equal(np.corrcoef([0, 1, 0], [1, 0, 1]),
                            [[1., -1.], [-1.,  1.]])

    def test_simple(self):
        tgt1 = corrcoef(self.A)
        assert_almost_equal(tgt1, self.res1)
        assert_(np.all(np.abs(tgt1) <= 1.0))

        tgt2 = corrcoef(self.A, self.B)
        assert_almost_equal(tgt2, self.res2)
        assert_(np.all(np.abs(tgt2) <= 1.0))

    def test_ddof(self):
        # ddof raises DeprecationWarning
        with suppress_warnings() as sup:
            warnings.simplefilter("always")
            assert_warns(DeprecationWarning, corrcoef, self.A, ddof=-1)
            sup.filter(DeprecationWarning)
            # ddof has no or negligible effect on the function
            assert_almost_equal(corrcoef(self.A, ddof=-1), self.res1)
            assert_almost_equal(corrcoef(self.A, self.B, ddof=-1), self.res2)
            assert_almost_equal(corrcoef(self.A, ddof=3), self.res1)
            assert_almost_equal(corrcoef(self.A, self.B, ddof=3), self.res2)

    def test_bias(self):
        # bias raises DeprecationWarning
        with suppress_warnings() as sup:
            warnings.simplefilter("always")
            assert_warns(DeprecationWarning, corrcoef, self.A, self.B, 1, 0)
            assert_warns(DeprecationWarning, corrcoef, self.A, bias=0)
            sup.filter(DeprecationWarning)
            # bias has no or negligible effect on the function
            assert_almost_equal(corrcoef(self.A, bias=1), self.res1)

    def test_complex(self):
        x = np.array([[1, 2, 3], [1j, 2j, 3j]])
        res = corrcoef(x)
        tgt = np.array([[1., -1.j], [1.j, 1.]])
        assert_allclose(res, tgt)
        assert_(np.all(np.abs(res) <= 1.0))

    def test_xy(self):
        x = np.array([[1, 2, 3]])
        y = np.array([[1j, 2j, 3j]])
        assert_allclose(np.corrcoef(x, y), np.array([[1., -1.j], [1.j, 1.]]))

    def test_empty(self):
        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            assert_array_equal(corrcoef(np.array([])), np.nan)
            assert_array_equal(corrcoef(np.array([]).reshape(0, 2)),
                               np.array([]).reshape(0, 0))
            assert_array_equal(corrcoef(np.array([]).reshape(2, 0)),
                               np.array([[np.nan, np.nan], [np.nan, np.nan]]))

    def test_extreme(self):
        x = [[1e-100, 1e100], [1e100, 1e-100]]
        with np.errstate(all='raise'):
            c = corrcoef(x)
        assert_array_almost_equal(c, np.array([[1., -1.], [-1., 1.]]))
        assert_(np.all(np.abs(c) <= 1.0))


class TestCov(TestCase):
    x1 = np.array([[0, 2], [1, 1], [2, 0]]).T
    res1 = np.array([[1., -1.], [-1., 1.]])
    x2 = np.array([0.0, 1.0, 2.0], ndmin=2)
    frequencies = np.array([1, 4, 1])
    x2_repeats = np.array([[0.0], [1.0], [1.0], [1.0], [1.0], [2.0]]).T
    res2 = np.array([[0.4, -0.4], [-0.4, 0.4]])
    unit_frequencies = np.ones(3, dtype=np.integer)
    weights = np.array([1.0, 4.0, 1.0])
    res3 = np.array([[2. / 3., -2. / 3.], [-2. / 3., 2. / 3.]])
    unit_weights = np.ones(3)
    x3 = np.array([0.3942, 0.5969, 0.7730, 0.9918, 0.7964])

    def test_basic(self):
        assert_allclose(cov(self.x1), self.res1)

    def test_complex(self):
        x = np.array([[1, 2, 3], [1j, 2j, 3j]])
        assert_allclose(cov(x), np.array([[1., -1.j], [1.j, 1.]]))

    def test_xy(self):
        x = np.array([[1, 2, 3]])
        y = np.array([[1j, 2j, 3j]])
        assert_allclose(cov(x, y), np.array([[1., -1.j], [1.j, 1.]]))

    def test_empty(self):
        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            assert_array_equal(cov(np.array([])), np.nan)
            assert_array_equal(cov(np.array([]).reshape(0, 2)),
                               np.array([]).reshape(0, 0))
            assert_array_equal(cov(np.array([]).reshape(2, 0)),
                               np.array([[np.nan, np.nan], [np.nan, np.nan]]))

    def test_wrong_ddof(self):
        with warnings.catch_warnings(record=True):
            warnings.simplefilter('always', RuntimeWarning)
            assert_array_equal(cov(self.x1, ddof=5),
                               np.array([[np.inf, -np.inf],
                                         [-np.inf, np.inf]]))

    def test_1D_rowvar(self):
        assert_allclose(cov(self.x3), cov(self.x3, rowvar=0))
        y = np.array([0.0780, 0.3107, 0.2111, 0.0334, 0.8501])
        assert_allclose(cov(self.x3, y), cov(self.x3, y, rowvar=0))

    def test_1D_variance(self):
        assert_allclose(cov(self.x3, ddof=1), np.var(self.x3, ddof=1))

    def test_fweights(self):
        assert_allclose(cov(self.x2, fweights=self.frequencies),
                        cov(self.x2_repeats))
        assert_allclose(cov(self.x1, fweights=self.frequencies),
                        self.res2)
        assert_allclose(cov(self.x1, fweights=self.unit_frequencies),
                        self.res1)
        nonint = self.frequencies + 0.5
        assert_raises(TypeError, cov, self.x1, fweights=nonint)
        f = np.ones((2, 3), dtype=np.integer)
        assert_raises(RuntimeError, cov, self.x1, fweights=f)
        f = np.ones(2, dtype=np.integer)
        assert_raises(RuntimeError, cov, self.x1, fweights=f)
        f = -1 * np.ones(3, dtype=np.integer)
        assert_raises(ValueError, cov, self.x1, fweights=f)

    def test_aweights(self):
        assert_allclose(cov(self.x1, aweights=self.weights), self.res3)
        assert_allclose(cov(self.x1, aweights=3.0 * self.weights),
                        cov(self.x1, aweights=self.weights))
        assert_allclose(cov(self.x1, aweights=self.unit_weights), self.res1)
        w = np.ones((2, 3))
        assert_raises(RuntimeError, cov, self.x1, aweights=w)
        w = np.ones(2)
        assert_raises(RuntimeError, cov, self.x1, aweights=w)
        w = -1.0 * np.ones(3)
        assert_raises(ValueError, cov, self.x1, aweights=w)

    def test_unit_fweights_and_aweights(self):
        assert_allclose(cov(self.x2, fweights=self.frequencies,
                            aweights=self.unit_weights),
                        cov(self.x2_repeats))
        assert_allclose(cov(self.x1, fweights=self.frequencies,
                            aweights=self.unit_weights),
                        self.res2)
        assert_allclose(cov(self.x1, fweights=self.unit_frequencies,
                            aweights=self.unit_weights),
                        self.res1)
        assert_allclose(cov(self.x1, fweights=self.unit_frequencies,
                            aweights=self.weights),
                        self.res3)
        assert_allclose(cov(self.x1, fweights=self.unit_frequencies,
                            aweights=3.0 * self.weights),
                        cov(self.x1, aweights=self.weights))
        assert_allclose(cov(self.x1, fweights=self.unit_frequencies,
                            aweights=self.unit_weights),
                        self.res1)


class Test_I0(TestCase):

    def test_simple(self):
        assert_almost_equal(
            i0(0.5),
            np.array(1.0634833707413234))

        A = np.array([0.49842636, 0.6969809, 0.22011976, 0.0155549])
        assert_almost_equal(
            i0(A),
            np.array([1.06307822, 1.12518299, 1.01214991, 1.00006049]))

        B = np.array([[0.827002, 0.99959078],
                      [0.89694769, 0.39298162],
                      [0.37954418, 0.05206293],
                      [0.36465447, 0.72446427],
                      [0.48164949, 0.50324519]])
        assert_almost_equal(
            i0(B),
            np.array([[1.17843223, 1.26583466],
                      [1.21147086, 1.03898290],
                      [1.03633899, 1.00067775],
                      [1.03352052, 1.13557954],
                      [1.05884290, 1.06432317]]))


class TestKaiser(TestCase):

    def test_simple(self):
        assert_(np.isfinite(kaiser(1, 1.0)))
        assert_almost_equal(kaiser(0, 1.0),
                            np.array([]))
        assert_almost_equal(kaiser(2, 1.0),
                            np.array([0.78984831, 0.78984831]))
        assert_almost_equal(kaiser(5, 1.0),
                            np.array([0.78984831, 0.94503323, 1.,
                                      0.94503323, 0.78984831]))
        assert_almost_equal(kaiser(5, 1.56789),
                            np.array([0.58285404, 0.88409679, 1.,
                                      0.88409679, 0.58285404]))

    def test_int_beta(self):
        kaiser(3, 4)


class TestMsort(TestCase):

    def test_simple(self):
        A = np.array([[0.44567325, 0.79115165, 0.54900530],
                      [0.36844147, 0.37325583, 0.96098397],
                      [0.64864341, 0.52929049, 0.39172155]])
        assert_almost_equal(
            msort(A),
            np.array([[0.36844147, 0.37325583, 0.39172155],
                      [0.44567325, 0.52929049, 0.54900530],
                      [0.64864341, 0.79115165, 0.96098397]]))


class TestMeshgrid(TestCase):

    def test_simple(self):
        [X, Y] = meshgrid([1, 2, 3], [4, 5, 6, 7])
        assert_array_equal(X, np.array([[1, 2, 3],
                                        [1, 2, 3],
                                        [1, 2, 3],
                                        [1, 2, 3]]))
        assert_array_equal(Y, np.array([[4, 4, 4],
                                        [5, 5, 5],
                                        [6, 6, 6],
                                        [7, 7, 7]]))

    def test_single_input(self):
        [X] = meshgrid([1, 2, 3, 4])
        assert_array_equal(X, np.array([1, 2, 3, 4]))

    def test_no_input(self):
        args = []
        assert_array_equal([], meshgrid(*args))
        assert_array_equal([], meshgrid(*args, copy=False))

    def test_indexing(self):
        x = [1, 2, 3]
        y = [4, 5, 6, 7]
        [X, Y] = meshgrid(x, y, indexing='ij')
        assert_array_equal(X, np.array([[1, 1, 1, 1],
                                        [2, 2, 2, 2],
                                        [3, 3, 3, 3]]))
        assert_array_equal(Y, np.array([[4, 5, 6, 7],
                                        [4, 5, 6, 7],
                                        [4, 5, 6, 7]]))

        # Test expected shapes:
        z = [8, 9]
        assert_(meshgrid(x, y)[0].shape == (4, 3))
        assert_(meshgrid(x, y, indexing='ij')[0].shape == (3, 4))
        assert_(meshgrid(x, y, z)[0].shape == (4, 3, 2))
        assert_(meshgrid(x, y, z, indexing='ij')[0].shape == (3, 4, 2))

        assert_raises(ValueError, meshgrid, x, y, indexing='notvalid')

    def test_sparse(self):
        [X, Y] = meshgrid([1, 2, 3], [4, 5, 6, 7], sparse=True)
        assert_array_equal(X, np.array([[1, 2, 3]]))
        assert_array_equal(Y, np.array([[4], [5], [6], [7]]))

    def test_invalid_arguments(self):
        # Test that meshgrid complains about invalid arguments
        # Regression test for issue #4755:
        # https://github.com/numpy/numpy/issues/4755
        assert_raises(TypeError, meshgrid,
                      [1, 2, 3], [4, 5, 6, 7], indices='ij')

    def test_return_type(self):
        # Test for appropriate dtype in returned arrays.
        # Regression test for issue #5297
        # https://github.com/numpy/numpy/issues/5297
        x = np.arange(0, 10, dtype=np.float32)
        y = np.arange(10, 20, dtype=np.float64)

        X, Y = np.meshgrid(x,y)

        assert_(X.dtype == x.dtype)
        assert_(Y.dtype == y.dtype)

        # copy
        X, Y = np.meshgrid(x,y, copy=True)

        assert_(X.dtype == x.dtype)
        assert_(Y.dtype == y.dtype)

        # sparse
        X, Y = np.meshgrid(x,y, sparse=True)

        assert_(X.dtype == x.dtype)
        assert_(Y.dtype == y.dtype)

    def test_writeback(self):
        # Issue 8561
        X = np.array([1.1, 2.2])
        Y = np.array([3.3, 4.4])
        x, y = np.meshgrid(X, Y, sparse=False, copy=True)

        x[0, :] = 0
        assert_equal(x[0, :], 0)
        assert_equal(x[1, :], X)


class TestPiecewise(TestCase):

    def test_simple(self):
        # Condition is single bool list
        x = piecewise([0, 0], [True, False], [1])
        assert_array_equal(x, [1, 0])

        # List of conditions: single bool list
        x = piecewise([0, 0], [[True, False]], [1])
        assert_array_equal(x, [1, 0])

        # Conditions is single bool array
        x = piecewise([0, 0], np.array([True, False]), [1])
        assert_array_equal(x, [1, 0])

        # Condition is single int array
        x = piecewise([0, 0], np.array([1, 0]), [1])
        assert_array_equal(x, [1, 0])

        # List of conditions: int array
        x = piecewise([0, 0], [np.array([1, 0])], [1])
        assert_array_equal(x, [1, 0])

        x = piecewise([0, 0], [[False, True]], [lambda x:-1])
        assert_array_equal(x, [0, -1])

    def test_two_conditions(self):
        x = piecewise([1, 2], [[True, False], [False, True]], [3, 4])
        assert_array_equal(x, [3, 4])

    def test_scalar_domains_three_conditions(self):
        x = piecewise(3, [True, False, False], [4, 2, 0])
        assert_equal(x, 4)

    def test_default(self):
        # No value specified for x[1], should be 0
        x = piecewise([1, 2], [True, False], [2])
        assert_array_equal(x, [2, 0])

        # Should set x[1] to 3
        x = piecewise([1, 2], [True, False], [2, 3])
        assert_array_equal(x, [2, 3])

    def test_0d(self):
        x = np.array(3)
        y = piecewise(x, x > 3, [4, 0])
        assert_(y.ndim == 0)
        assert_(y == 0)

        x = 5
        y = piecewise(x, [[True], [False]], [1, 0])
        assert_(y.ndim == 0)
        assert_(y == 1)

        # With 3 ranges (It was failing, before)
        y = piecewise(x, [False, False, True], [1, 2, 3])
        assert_array_equal(y, 3)

    def test_0d_comparison(self):
        x = 3
        y = piecewise(x, [x <= 3, x > 3], [4, 0])  # Should succeed.
        assert_equal(y, 4)

        # With 3 ranges (It was failing, before)
        x = 4
        y = piecewise(x, [x <= 3, (x > 3) * (x <= 5), x > 5], [1, 2, 3])
        assert_array_equal(y, 2)

    def test_multidimensional_extrafunc(self):
        x = np.array([[-2.5, -1.5, -0.5],
                      [0.5, 1.5, 2.5]])
        y = piecewise(x, [x < 0, x >= 2], [-1, 1, 3])
        assert_array_equal(y, np.array([[-1., -1., -1.],
                                        [3., 3., 1.]]))


class TestBincount(TestCase):

    def test_simple(self):
        y = np.bincount(np.arange(4))
        assert_array_equal(y, np.ones(4))

    def test_simple2(self):
        y = np.bincount(np.array([1, 5, 2, 4, 1]))
        assert_array_equal(y, np.array([0, 2, 1, 0, 1, 1]))

    def test_simple_weight(self):
        x = np.arange(4)
        w = np.array([0.2, 0.3, 0.5, 0.1])
        y = np.bincount(x, w)
        assert_array_equal(y, w)

    def test_simple_weight2(self):
        x = np.array([1, 2, 4, 5, 2])
        w = np.array([0.2, 0.3, 0.5, 0.1, 0.2])
        y = np.bincount(x, w)
        assert_array_equal(y, np.array([0, 0.2, 0.5, 0, 0.5, 0.1]))

    def test_with_minlength(self):
        x = np.array([0, 1, 0, 1, 1])
        y = np.bincount(x, minlength=3)
        assert_array_equal(y, np.array([2, 3, 0]))
        x = []
        y = np.bincount(x, minlength=0)
        assert_array_equal(y, np.array([]))

    def test_with_minlength_smaller_than_maxvalue(self):
        x = np.array([0, 1, 1, 2, 2, 3, 3])
        y = np.bincount(x, minlength=2)
        assert_array_equal(y, np.array([1, 2, 2, 2]))
        y = np.bincount(x, minlength=0)
        assert_array_equal(y, np.array([1, 2, 2, 2]))

    def test_with_minlength_and_weights(self):
        x = np.array([1, 2, 4, 5, 2])
        w = np.array([0.2, 0.3, 0.5, 0.1, 0.2])
        y = np.bincount(x, w, 8)
        assert_array_equal(y, np.array([0, 0.2, 0.5, 0, 0.5, 0.1, 0, 0]))

    def test_empty(self):
        x = np.array([], dtype=int)
        y = np.bincount(x)
        assert_array_equal(x, y)

    def test_empty_with_minlength(self):
        x = np.array([], dtype=int)
        y = np.bincount(x, minlength=5)
        assert_array_equal(y, np.zeros(5, dtype=int))

    def test_with_incorrect_minlength(self):
        x = np.array([], dtype=int)
        assert_raises_regex(TypeError,
                            "'str' object cannot be interpreted",
                            lambda: np.bincount(x, minlength="foobar"))
        assert_raises_regex(ValueError,
                            "must be non-negative",
                            lambda: np.bincount(x, minlength=-1))

        x = np.arange(5)
        assert_raises_regex(TypeError,
                            "'str' object cannot be interpreted",
                            lambda: np.bincount(x, minlength="foobar"))
        assert_raises_regex(ValueError,
                            "minlength must be non-negative",
                            lambda: np.bincount(x, minlength=-1))

    @dec.skipif(not HAS_REFCOUNT, "python has no sys.getrefcount")
    def test_dtype_reference_leaks(self):
        # gh-6805
        intp_refcount = sys.getrefcount(np.dtype(np.intp))
        double_refcount = sys.getrefcount(np.dtype(np.double))

        for j in range(10):
            np.bincount([1, 2, 3])
        assert_equal(sys.getrefcount(np.dtype(np.intp)), intp_refcount)
        assert_equal(sys.getrefcount(np.dtype(np.double)), double_refcount)

        for j in range(10):
            np.bincount([1, 2, 3], [4, 5, 6])
        assert_equal(sys.getrefcount(np.dtype(np.intp)), intp_refcount)
        assert_equal(sys.getrefcount(np.dtype(np.double)), double_refcount)


class TestInterp(TestCase):

    def test_exceptions(self):
        assert_raises(ValueError, interp, 0, [], [])
        assert_raises(ValueError, interp, 0, [0], [1, 2])
        assert_raises(ValueError, interp, 0, [0, 1], [1, 2], period=0)
        assert_raises(ValueError, interp, 0, [], [], period=360)
        assert_raises(ValueError, interp, 0, [0], [1, 2], period=360)

    def test_basic(self):
        x = np.linspace(0, 1, 5)
        y = np.linspace(0, 1, 5)
        x0 = np.linspace(0, 1, 50)
        assert_almost_equal(np.interp(x0, x, y), x0)

    def test_right_left_behavior(self):
        # Needs range of sizes to test different code paths.
        # size ==1 is special cased, 1 < size < 5 is linear search, and
        # size >= 5 goes through local search and possibly binary search.
        for size in range(1, 10):
            xp = np.arange(size, dtype=np.double)
            yp = np.ones(size, dtype=np.double)
            incpts = np.array([-1, 0, size - 1, size], dtype=np.double)
            decpts = incpts[::-1]

            incres = interp(incpts, xp, yp)
            decres = interp(decpts, xp, yp)
            inctgt = np.array([1, 1, 1, 1], dtype=np.float)
            dectgt = inctgt[::-1]
            assert_equal(incres, inctgt)
            assert_equal(decres, dectgt)

            incres = interp(incpts, xp, yp, left=0)
            decres = interp(decpts, xp, yp, left=0)
            inctgt = np.array([0, 1, 1, 1], dtype=np.float)
            dectgt = inctgt[::-1]
            assert_equal(incres, inctgt)
            assert_equal(decres, dectgt)

            incres = interp(incpts, xp, yp, right=2)
            decres = interp(decpts, xp, yp, right=2)
            inctgt = np.array([1, 1, 1, 2], dtype=np.float)
            dectgt = inctgt[::-1]
            assert_equal(incres, inctgt)
            assert_equal(decres, dectgt)

            incres = interp(incpts, xp, yp, left=0, right=2)
            decres = interp(decpts, xp, yp, left=0, right=2)
            inctgt = np.array([0, 1, 1, 2], dtype=np.float)
            dectgt = inctgt[::-1]
            assert_equal(incres, inctgt)
            assert_equal(decres, dectgt)

    def test_scalar_interpolation_point(self):
        x = np.linspace(0, 1, 5)
        y = np.linspace(0, 1, 5)
        x0 = 0
        assert_almost_equal(np.interp(x0, x, y), x0)
        x0 = .3
        assert_almost_equal(np.interp(x0, x, y), x0)
        x0 = np.float32(.3)
        assert_almost_equal(np.interp(x0, x, y), x0)
        x0 = np.float64(.3)
        assert_almost_equal(np.interp(x0, x, y), x0)
        x0 = np.nan
        assert_almost_equal(np.interp(x0, x, y), x0)

    def test_complex_interp(self):
        # test complex interpolation
        x = np.linspace(0, 1, 5)
        y = np.linspace(0, 1, 5) + (1 + np.linspace(0, 1, 5))*1.0j
        x0 = 0.3
        y0 = x0 + (1+x0)*1.0j
        assert_almost_equal(np.interp(x0, x, y), y0)
        # test complex left and right
        x0 = -1
        left = 2 + 3.0j
        assert_almost_equal(np.interp(x0, x, y, left=left), left)
        x0 = 2.0
        right = 2 + 3.0j
        assert_almost_equal(np.interp(x0, x, y, right=right), right)
        # test complex periodic
        x = [-180, -170, -185, 185, -10, -5, 0, 365]
        xp = [190, -190, 350, -350]
        fp = [5+1.0j, 10+2j, 3+3j, 4+4j]
        y = [7.5+1.5j, 5.+1.0j, 8.75+1.75j, 6.25+1.25j, 3.+3j, 3.25+3.25j,
             3.5+3.5j, 3.75+3.75j]
        assert_almost_equal(np.interp(x, xp, fp, period=360), y)

    def test_zero_dimensional_interpolation_point(self):
        x = np.linspace(0, 1, 5)
        y = np.linspace(0, 1, 5)
        x0 = np.array(.3)
        assert_almost_equal(np.interp(x0, x, y), x0)
        x0 = np.array(.3, dtype=object)
        assert_almost_equal(np.interp(x0, x, y), .3)

    def test_if_len_x_is_small(self):
        xp = np.arange(0, 10, 0.0001)
        fp = np.sin(xp)
        assert_almost_equal(np.interp(np.pi, xp, fp), 0.0)

    def test_period(self):
        x = [-180, -170, -185, 185, -10, -5, 0, 365]
        xp = [190, -190, 350, -350]
        fp = [5, 10, 3, 4]
        y = [7.5, 5., 8.75, 6.25, 3., 3.25, 3.5, 3.75]
        assert_almost_equal(np.interp(x, xp, fp, period=360), y)
        x = np.array(x, order='F').reshape(2, -1)
        y = np.array(y, order='C').reshape(2, -1)
        assert_almost_equal(np.interp(x, xp, fp, period=360), y)


def compare_results(res, desired):
    for i in range(len(desired)):
        assert_array_equal(res[i], desired[i])


class TestPercentile(TestCase):

    def test_basic(self):
        x = np.arange(8) * 0.5
        assert_equal(np.percentile(x, 0), 0.)
        assert_equal(np.percentile(x, 100), 3.5)
        assert_equal(np.percentile(x, 50), 1.75)
        x[1] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(x, 0), np.nan)
            assert_equal(np.percentile(x, 0, interpolation='nearest'), np.nan)
            assert_(w[0].category is RuntimeWarning)

    def test_api(self):
        d = np.ones(5)
        np.percentile(d, 5, None, None, False)
        np.percentile(d, 5, None, None, False, 'linear')
        o = np.ones((1,))
        np.percentile(d, 5, None, o, False, 'linear')

    def test_2D(self):
        x = np.array([[1, 1, 1],
                      [1, 1, 1],
                      [4, 4, 3],
                      [1, 1, 1],
                      [1, 1, 1]])
        assert_array_equal(np.percentile(x, 50, axis=0), [1, 1, 1])

    def test_linear(self):

        # Test defaults
        assert_equal(np.percentile(range(10), 50), 4.5)

        # explicitly specify interpolation_method 'linear' (the default)
        assert_equal(np.percentile(range(10), 50,
                                   interpolation='linear'), 4.5)

    def test_lower_higher(self):

        # interpolation_method 'lower'/'higher'
        assert_equal(np.percentile(range(10), 50,
                                   interpolation='lower'), 4)
        assert_equal(np.percentile(range(10), 50,
                                   interpolation='higher'), 5)

    def test_midpoint(self):
        assert_equal(np.percentile(range(10), 51,
                                   interpolation='midpoint'), 4.5)
        assert_equal(np.percentile(range(11), 51,
                                   interpolation='midpoint'), 5.5)
        assert_equal(np.percentile(range(11), 50,
                                   interpolation='midpoint'), 5)

    def test_nearest(self):
        assert_equal(np.percentile(range(10), 51,
                                   interpolation='nearest'), 5)
        assert_equal(np.percentile(range(10), 49,
                                   interpolation='nearest'), 4)

    def test_sequence(self):
        x = np.arange(8) * 0.5
        assert_equal(np.percentile(x, [0, 100, 50]), [0, 3.5, 1.75])

    def test_axis(self):
        x = np.arange(12).reshape(3, 4)

        assert_equal(np.percentile(x, (25, 50, 100)), [2.75, 5.5, 11.0])

        r0 = [[2, 3, 4, 5], [4, 5, 6, 7], [8, 9, 10, 11]]
        assert_equal(np.percentile(x, (25, 50, 100), axis=0), r0)

        r1 = [[0.75, 1.5, 3], [4.75, 5.5, 7], [8.75, 9.5, 11]]
        assert_equal(np.percentile(x, (25, 50, 100), axis=1), np.array(r1).T)

        # ensure qth axis is always first as with np.array(old_percentile(..))
        x = np.arange(3 * 4 * 5 * 6).reshape(3, 4, 5, 6)
        assert_equal(np.percentile(x, (25, 50)).shape, (2,))
        assert_equal(np.percentile(x, (25, 50, 75)).shape, (3,))
        assert_equal(np.percentile(x, (25, 50), axis=0).shape, (2, 4, 5, 6))
        assert_equal(np.percentile(x, (25, 50), axis=1).shape, (2, 3, 5, 6))
        assert_equal(np.percentile(x, (25, 50), axis=2).shape, (2, 3, 4, 6))
        assert_equal(np.percentile(x, (25, 50), axis=3).shape, (2, 3, 4, 5))
        assert_equal(
            np.percentile(x, (25, 50, 75), axis=1).shape, (3, 3, 5, 6))
        assert_equal(np.percentile(x, (25, 50),
                                   interpolation="higher").shape, (2,))
        assert_equal(np.percentile(x, (25, 50, 75),
                                   interpolation="higher").shape, (3,))
        assert_equal(np.percentile(x, (25, 50), axis=0,
                                   interpolation="higher").shape, (2, 4, 5, 6))
        assert_equal(np.percentile(x, (25, 50), axis=1,
                                   interpolation="higher").shape, (2, 3, 5, 6))
        assert_equal(np.percentile(x, (25, 50), axis=2,
                                   interpolation="higher").shape, (2, 3, 4, 6))
        assert_equal(np.percentile(x, (25, 50), axis=3,
                                   interpolation="higher").shape, (2, 3, 4, 5))
        assert_equal(np.percentile(x, (25, 50, 75), axis=1,
                                   interpolation="higher").shape, (3, 3, 5, 6))

    def test_scalar_q(self):
        # test for no empty dimensions for compatibility with old percentile
        x = np.arange(12).reshape(3, 4)
        assert_equal(np.percentile(x, 50), 5.5)
        self.assertTrue(np.isscalar(np.percentile(x, 50)))
        r0 = np.array([4.,  5.,  6.,  7.])
        assert_equal(np.percentile(x, 50, axis=0), r0)
        assert_equal(np.percentile(x, 50, axis=0).shape, r0.shape)
        r1 = np.array([1.5,  5.5,  9.5])
        assert_almost_equal(np.percentile(x, 50, axis=1), r1)
        assert_equal(np.percentile(x, 50, axis=1).shape, r1.shape)

        out = np.empty(1)
        assert_equal(np.percentile(x, 50, out=out), 5.5)
        assert_equal(out, 5.5)
        out = np.empty(4)
        assert_equal(np.percentile(x, 50, axis=0, out=out), r0)
        assert_equal(out, r0)
        out = np.empty(3)
        assert_equal(np.percentile(x, 50, axis=1, out=out), r1)
        assert_equal(out, r1)

        # test for no empty dimensions for compatibility with old percentile
        x = np.arange(12).reshape(3, 4)
        assert_equal(np.percentile(x, 50, interpolation='lower'), 5.)
        self.assertTrue(np.isscalar(np.percentile(x, 50)))
        r0 = np.array([4.,  5.,  6.,  7.])
        c0 = np.percentile(x, 50, interpolation='lower', axis=0)
        assert_equal(c0, r0)
        assert_equal(c0.shape, r0.shape)
        r1 = np.array([1.,  5.,  9.])
        c1 = np.percentile(x, 50, interpolation='lower', axis=1)
        assert_almost_equal(c1, r1)
        assert_equal(c1.shape, r1.shape)

        out = np.empty((), dtype=x.dtype)
        c = np.percentile(x, 50, interpolation='lower', out=out)
        assert_equal(c, 5)
        assert_equal(out, 5)
        out = np.empty(4, dtype=x.dtype)
        c = np.percentile(x, 50, interpolation='lower', axis=0, out=out)
        assert_equal(c, r0)
        assert_equal(out, r0)
        out = np.empty(3, dtype=x.dtype)
        c = np.percentile(x, 50, interpolation='lower', axis=1, out=out)
        assert_equal(c, r1)
        assert_equal(out, r1)

    def test_exception(self):
        assert_raises(ValueError, np.percentile, [1, 2], 56,
                      interpolation='foobar')
        assert_raises(ValueError, np.percentile, [1], 101)
        assert_raises(ValueError, np.percentile, [1], -1)
        assert_raises(ValueError, np.percentile, [1], list(range(50)) + [101])
        assert_raises(ValueError, np.percentile, [1], list(range(50)) + [-0.1])

    def test_percentile_list(self):
        assert_equal(np.percentile([1, 2, 3], 0), 1)

    def test_percentile_out(self):
        x = np.array([1, 2, 3])
        y = np.zeros((3,))
        p = (1, 2, 3)
        np.percentile(x, p, out=y)
        assert_equal(y, np.percentile(x, p))

        x = np.array([[1, 2, 3],
                      [4, 5, 6]])

        y = np.zeros((3, 3))
        np.percentile(x, p, axis=0, out=y)
        assert_equal(y, np.percentile(x, p, axis=0))

        y = np.zeros((3, 2))
        np.percentile(x, p, axis=1, out=y)
        assert_equal(y, np.percentile(x, p, axis=1))

        x = np.arange(12).reshape(3, 4)
        # q.dim > 1, float
        r0 = np.array([[2.,  3.,  4., 5.], [4., 5., 6., 7.]])
        out = np.empty((2, 4))
        assert_equal(np.percentile(x, (25, 50), axis=0, out=out), r0)
        assert_equal(out, r0)
        r1 = np.array([[0.75,  4.75,  8.75], [1.5,  5.5,  9.5]])
        out = np.empty((2, 3))
        assert_equal(np.percentile(x, (25, 50), axis=1, out=out), r1)
        assert_equal(out, r1)

        # q.dim > 1, int
        r0 = np.array([[0,  1,  2, 3], [4, 5, 6, 7]])
        out = np.empty((2, 4), dtype=x.dtype)
        c = np.percentile(x, (25, 50), interpolation='lower', axis=0, out=out)
        assert_equal(c, r0)
        assert_equal(out, r0)
        r1 = np.array([[0,  4,  8], [1,  5,  9]])
        out = np.empty((2, 3), dtype=x.dtype)
        c = np.percentile(x, (25, 50), interpolation='lower', axis=1, out=out)
        assert_equal(c, r1)
        assert_equal(out, r1)

    def test_percentile_empty_dim(self):
        # empty dims are preserved
        d = np.arange(11 * 2).reshape(11, 1, 2, 1)
        assert_array_equal(np.percentile(d, 50, axis=0).shape, (1, 2, 1))
        assert_array_equal(np.percentile(d, 50, axis=1).shape, (11, 2, 1))
        assert_array_equal(np.percentile(d, 50, axis=2).shape, (11, 1, 1))
        assert_array_equal(np.percentile(d, 50, axis=3).shape, (11, 1, 2))
        assert_array_equal(np.percentile(d, 50, axis=-1).shape, (11, 1, 2))
        assert_array_equal(np.percentile(d, 50, axis=-2).shape, (11, 1, 1))
        assert_array_equal(np.percentile(d, 50, axis=-3).shape, (11, 2, 1))
        assert_array_equal(np.percentile(d, 50, axis=-4).shape, (1, 2, 1))

        assert_array_equal(np.percentile(d, 50, axis=2,
                                         interpolation='midpoint').shape,
                           (11, 1, 1))
        assert_array_equal(np.percentile(d, 50, axis=-2,
                                         interpolation='midpoint').shape,
                           (11, 1, 1))

        assert_array_equal(np.array(np.percentile(d, [10, 50], axis=0)).shape,
                           (2, 1, 2, 1))
        assert_array_equal(np.array(np.percentile(d, [10, 50], axis=1)).shape,
                           (2, 11, 2, 1))
        assert_array_equal(np.array(np.percentile(d, [10, 50], axis=2)).shape,
                           (2, 11, 1, 1))
        assert_array_equal(np.array(np.percentile(d, [10, 50], axis=3)).shape,
                           (2, 11, 1, 2))

    def test_percentile_no_overwrite(self):
        a = np.array([2, 3, 4, 1])
        np.percentile(a, [50], overwrite_input=False)
        assert_equal(a, np.array([2, 3, 4, 1]))

        a = np.array([2, 3, 4, 1])
        np.percentile(a, [50])
        assert_equal(a, np.array([2, 3, 4, 1]))

    def test_no_p_overwrite(self):
        p = np.linspace(0., 100., num=5)
        np.percentile(np.arange(100.), p, interpolation="midpoint")
        assert_array_equal(p, np.linspace(0., 100., num=5))
        p = np.linspace(0., 100., num=5).tolist()
        np.percentile(np.arange(100.), p, interpolation="midpoint")
        assert_array_equal(p, np.linspace(0., 100., num=5).tolist())

    def test_percentile_overwrite(self):
        a = np.array([2, 3, 4, 1])
        b = np.percentile(a, [50], overwrite_input=True)
        assert_equal(b, np.array([2.5]))

        b = np.percentile([2, 3, 4, 1], [50], overwrite_input=True)
        assert_equal(b, np.array([2.5]))

    def test_extended_axis(self):
        o = np.random.normal(size=(71, 23))
        x = np.dstack([o] * 10)
        assert_equal(np.percentile(x, 30, axis=(0, 1)), np.percentile(o, 30))
        x = np.rollaxis(x, -1, 0)
        assert_equal(np.percentile(x, 30, axis=(-2, -1)), np.percentile(o, 30))
        x = x.swapaxes(0, 1).copy()
        assert_equal(np.percentile(x, 30, axis=(0, -1)), np.percentile(o, 30))
        x = x.swapaxes(0, 1).copy()

        assert_equal(np.percentile(x, [25, 60], axis=(0, 1, 2)),
                     np.percentile(x, [25, 60], axis=None))
        assert_equal(np.percentile(x, [25, 60], axis=(0,)),
                     np.percentile(x, [25, 60], axis=0))

        d = np.arange(3 * 5 * 7 * 11).reshape((3, 5, 7, 11))
        np.random.shuffle(d.ravel())
        assert_equal(np.percentile(d, 25,  axis=(0, 1, 2))[0],
                     np.percentile(d[:,:,:, 0].flatten(), 25))
        assert_equal(np.percentile(d, [10, 90], axis=(0, 1, 3))[:, 1],
                     np.percentile(d[:,:, 1,:].flatten(), [10, 90]))
        assert_equal(np.percentile(d, 25, axis=(3, 1, -4))[2],
                     np.percentile(d[:,:, 2,:].flatten(), 25))
        assert_equal(np.percentile(d, 25, axis=(3, 1, 2))[2],
                     np.percentile(d[2,:,:,:].flatten(), 25))
        assert_equal(np.percentile(d, 25, axis=(3, 2))[2, 1],
                     np.percentile(d[2, 1,:,:].flatten(), 25))
        assert_equal(np.percentile(d, 25, axis=(1, -2))[2, 1],
                     np.percentile(d[2,:,:, 1].flatten(), 25))
        assert_equal(np.percentile(d, 25, axis=(1, 3))[2, 2],
                     np.percentile(d[2,:, 2,:].flatten(), 25))

    def test_extended_axis_invalid(self):
        d = np.ones((3, 5, 7, 11))
        assert_raises(np.AxisError, np.percentile, d, axis=-5, q=25)
        assert_raises(np.AxisError, np.percentile, d, axis=(0, -5), q=25)
        assert_raises(np.AxisError, np.percentile, d, axis=4, q=25)
        assert_raises(np.AxisError, np.percentile, d, axis=(0, 4), q=25)
        # each of these refers to the same axis twice
        assert_raises(ValueError, np.percentile, d, axis=(1, 1), q=25)
        assert_raises(ValueError, np.percentile, d, axis=(-1, -1), q=25)
        assert_raises(ValueError, np.percentile, d, axis=(3, -1), q=25)

    def test_keepdims(self):
        d = np.ones((3, 5, 7, 11))
        assert_equal(np.percentile(d, 7, axis=None, keepdims=True).shape,
                     (1, 1, 1, 1))
        assert_equal(np.percentile(d, 7, axis=(0, 1), keepdims=True).shape,
                     (1, 1, 7, 11))
        assert_equal(np.percentile(d, 7, axis=(0, 3), keepdims=True).shape,
                     (1, 5, 7, 1))
        assert_equal(np.percentile(d, 7, axis=(1,), keepdims=True).shape,
                     (3, 1, 7, 11))
        assert_equal(np.percentile(d, 7, (0, 1, 2, 3), keepdims=True).shape,
                     (1, 1, 1, 1))
        assert_equal(np.percentile(d, 7, axis=(0, 1, 3), keepdims=True).shape,
                     (1, 1, 7, 1))

        assert_equal(np.percentile(d, [1, 7], axis=(0, 1, 3),
                                   keepdims=True).shape, (2, 1, 1, 7, 1))
        assert_equal(np.percentile(d, [1, 7], axis=(0, 3),
                                   keepdims=True).shape, (2, 1, 5, 7, 1))

    def test_out(self):
        o = np.zeros((4,))
        d = np.ones((3, 4))
        assert_equal(np.percentile(d, 0, 0, out=o), o)
        assert_equal(np.percentile(d, 0, 0, interpolation='nearest', out=o), o)
        o = np.zeros((3,))
        assert_equal(np.percentile(d, 1, 1, out=o), o)
        assert_equal(np.percentile(d, 1, 1, interpolation='nearest', out=o), o)

        o = np.zeros(())
        assert_equal(np.percentile(d, 2, out=o), o)
        assert_equal(np.percentile(d, 2, interpolation='nearest', out=o), o)

    def test_out_nan(self):
        with warnings.catch_warnings(record=True):
            warnings.filterwarnings('always', '', RuntimeWarning)
            o = np.zeros((4,))
            d = np.ones((3, 4))
            d[2, 1] = np.nan
            assert_equal(np.percentile(d, 0, 0, out=o), o)
            assert_equal(
                np.percentile(d, 0, 0, interpolation='nearest', out=o), o)
            o = np.zeros((3,))
            assert_equal(np.percentile(d, 1, 1, out=o), o)
            assert_equal(
                np.percentile(d, 1, 1, interpolation='nearest', out=o), o)
            o = np.zeros(())
            assert_equal(np.percentile(d, 1, out=o), o)
            assert_equal(
                np.percentile(d, 1, interpolation='nearest', out=o), o)

    def test_nan_behavior(self):
        a = np.arange(24, dtype=float)
        a[2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, 0.3), np.nan)
            assert_equal(np.percentile(a, 0.3, axis=0), np.nan)
            assert_equal(np.percentile(a, [0.3, 0.6], axis=0),
                         np.array([np.nan] * 2))
            assert_(w[0].category is RuntimeWarning)
            assert_(w[1].category is RuntimeWarning)
            assert_(w[2].category is RuntimeWarning)

        a = np.arange(24, dtype=float).reshape(2, 3, 4)
        a[1, 2, 3] = np.nan
        a[1, 1, 2] = np.nan

        # no axis
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, 0.3), np.nan)
            assert_equal(np.percentile(a, 0.3).ndim, 0)
            assert_(w[0].category is RuntimeWarning)

        # axis0 zerod
        b = np.percentile(np.arange(24, dtype=float).reshape(2, 3, 4), 0.3, 0)
        b[2, 3] = np.nan
        b[1, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, 0.3, 0), b)

        # axis0 not zerod
        b = np.percentile(np.arange(24, dtype=float).reshape(2, 3, 4),
                          [0.3, 0.6], 0)
        b[:, 2, 3] = np.nan
        b[:, 1, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, [0.3, 0.6], 0), b)

        # axis1 zerod
        b = np.percentile(np.arange(24, dtype=float).reshape(2, 3, 4), 0.3, 1)
        b[1, 3] = np.nan
        b[1, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, 0.3, 1), b)
        # axis1 not zerod
        b = np.percentile(
            np.arange(24, dtype=float).reshape(2, 3, 4), [0.3, 0.6], 1)
        b[:, 1, 3] = np.nan
        b[:, 1, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, [0.3, 0.6], 1), b)

        # axis02 zerod
        b = np.percentile(
            np.arange(24, dtype=float).reshape(2, 3, 4), 0.3, (0, 2))
        b[1] = np.nan
        b[2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, 0.3, (0, 2)), b)
        # axis02 not zerod
        b = np.percentile(np.arange(24, dtype=float).reshape(2, 3, 4),
                          [0.3, 0.6], (0, 2))
        b[:, 1] = np.nan
        b[:, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(a, [0.3, 0.6], (0, 2)), b)
        # axis02 not zerod with nearest interpolation
        b = np.percentile(np.arange(24, dtype=float).reshape(2, 3, 4),
                          [0.3, 0.6], (0, 2), interpolation='nearest')
        b[:, 1] = np.nan
        b[:, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.percentile(
                a, [0.3, 0.6], (0, 2), interpolation='nearest'), b)


class TestMedian(TestCase):

    def test_basic(self):
        a0 = np.array(1)
        a1 = np.arange(2)
        a2 = np.arange(6).reshape(2, 3)
        assert_equal(np.median(a0), 1)
        assert_allclose(np.median(a1), 0.5)
        assert_allclose(np.median(a2), 2.5)
        assert_allclose(np.median(a2, axis=0), [1.5,  2.5,  3.5])
        assert_equal(np.median(a2, axis=1), [1, 4])
        assert_allclose(np.median(a2, axis=None), 2.5)

        a = np.array([0.0444502, 0.0463301, 0.141249, 0.0606775])
        assert_almost_equal((a[1] + a[3]) / 2., np.median(a))
        a = np.array([0.0463301, 0.0444502, 0.141249])
        assert_equal(a[0], np.median(a))
        a = np.array([0.0444502, 0.141249, 0.0463301])
        assert_equal(a[-1], np.median(a))
        # check array scalar result
        assert_equal(np.median(a).ndim, 0)
        a[1] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a).ndim, 0)
            assert_(w[0].category is RuntimeWarning)

    def test_axis_keyword(self):
        a3 = np.array([[2, 3],
                       [0, 1],
                       [6, 7],
                       [4, 5]])
        for a in [a3, np.random.randint(0, 100, size=(2, 3, 4))]:
            orig = a.copy()
            np.median(a, axis=None)
            for ax in range(a.ndim):
                np.median(a, axis=ax)
            assert_array_equal(a, orig)

        assert_allclose(np.median(a3, axis=0), [3,  4])
        assert_allclose(np.median(a3.T, axis=1), [3,  4])
        assert_allclose(np.median(a3), 3.5)
        assert_allclose(np.median(a3, axis=None), 3.5)
        assert_allclose(np.median(a3.T), 3.5)

    def test_overwrite_keyword(self):
        a3 = np.array([[2, 3],
                       [0, 1],
                       [6, 7],
                       [4, 5]])
        a0 = np.array(1)
        a1 = np.arange(2)
        a2 = np.arange(6).reshape(2, 3)
        assert_allclose(np.median(a0.copy(), overwrite_input=True), 1)
        assert_allclose(np.median(a1.copy(), overwrite_input=True), 0.5)
        assert_allclose(np.median(a2.copy(), overwrite_input=True), 2.5)
        assert_allclose(np.median(a2.copy(), overwrite_input=True, axis=0),
                        [1.5,  2.5,  3.5])
        assert_allclose(
            np.median(a2.copy(), overwrite_input=True, axis=1), [1, 4])
        assert_allclose(
            np.median(a2.copy(), overwrite_input=True, axis=None), 2.5)
        assert_allclose(
            np.median(a3.copy(), overwrite_input=True, axis=0), [3,  4])
        assert_allclose(np.median(a3.T.copy(), overwrite_input=True, axis=1),
                        [3,  4])

        a4 = np.arange(3 * 4 * 5, dtype=np.float32).reshape((3, 4, 5))
        np.random.shuffle(a4.ravel())
        assert_allclose(np.median(a4, axis=None),
                        np.median(a4.copy(), axis=None, overwrite_input=True))
        assert_allclose(np.median(a4, axis=0),
                        np.median(a4.copy(), axis=0, overwrite_input=True))
        assert_allclose(np.median(a4, axis=1),
                        np.median(a4.copy(), axis=1, overwrite_input=True))
        assert_allclose(np.median(a4, axis=2),
                        np.median(a4.copy(), axis=2, overwrite_input=True))

    def test_array_like(self):
        x = [1, 2, 3]
        assert_almost_equal(np.median(x), 2)
        x2 = [x]
        assert_almost_equal(np.median(x2), 2)
        assert_allclose(np.median(x2, axis=0), x)

    def test_subclass(self):
        # gh-3846
        class MySubClass(np.ndarray):

            def __new__(cls, input_array, info=None):
                obj = np.asarray(input_array).view(cls)
                obj.info = info
                return obj

            def mean(self, axis=None, dtype=None, out=None):
                return -7

        a = MySubClass([1, 2, 3])
        assert_equal(np.median(a), -7)

    def test_out(self):
        o = np.zeros((4,))
        d = np.ones((3, 4))
        assert_equal(np.median(d, 0, out=o), o)
        o = np.zeros((3,))
        assert_equal(np.median(d, 1, out=o), o)
        o = np.zeros(())
        assert_equal(np.median(d, out=o), o)

    def test_out_nan(self):
        with warnings.catch_warnings(record=True):
            warnings.filterwarnings('always', '', RuntimeWarning)
            o = np.zeros((4,))
            d = np.ones((3, 4))
            d[2, 1] = np.nan
            assert_equal(np.median(d, 0, out=o), o)
            o = np.zeros((3,))
            assert_equal(np.median(d, 1, out=o), o)
            o = np.zeros(())
            assert_equal(np.median(d, out=o), o)

    def test_nan_behavior(self):
        a = np.arange(24, dtype=float)
        a[2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a), np.nan)
            assert_equal(np.median(a, axis=0), np.nan)
            assert_(w[0].category is RuntimeWarning)
            assert_(w[1].category is RuntimeWarning)

        a = np.arange(24, dtype=float).reshape(2, 3, 4)
        a[1, 2, 3] = np.nan
        a[1, 1, 2] = np.nan

        # no axis
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a), np.nan)
            assert_equal(np.median(a).ndim, 0)
            assert_(w[0].category is RuntimeWarning)

        # axis0
        b = np.median(np.arange(24, dtype=float).reshape(2, 3, 4), 0)
        b[2, 3] = np.nan
        b[1, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a, 0), b)
            assert_equal(len(w), 1)

        # axis1
        b = np.median(np.arange(24, dtype=float).reshape(2, 3, 4), 1)
        b[1, 3] = np.nan
        b[1, 2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a, 1), b)
            assert_equal(len(w), 1)

        # axis02
        b = np.median(np.arange(24, dtype=float).reshape(2, 3, 4), (0, 2))
        b[1] = np.nan
        b[2] = np.nan
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a, (0, 2)), b)
            assert_equal(len(w), 1)

    def test_empty(self):
        # empty arrays
        a = np.array([], dtype=float)
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a), np.nan)
            assert_(w[0].category is RuntimeWarning)

        # multiple dimensions
        a = np.array([], dtype=float, ndmin=3)
        # no axis
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a), np.nan)
            assert_(w[0].category is RuntimeWarning)

        # axis 0 and 1
        b = np.array([], dtype=float, ndmin=2)
        assert_equal(np.median(a, axis=0), b)
        assert_equal(np.median(a, axis=1), b)

        # axis 2
        b = np.array(np.nan, dtype=float, ndmin=2)
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings('always', '', RuntimeWarning)
            assert_equal(np.median(a, axis=2), b)
            assert_(w[0].category is RuntimeWarning)

    def test_object(self):
        o = np.arange(7.)
        assert_(type(np.median(o.astype(object))), float)
        o[2] = np.nan
        assert_(type(np.median(o.astype(object))), float)

    def test_extended_axis(self):
        o = np.random.normal(size=(71, 23))
        x = np.dstack([o] * 10)
        assert_equal(np.median(x, axis=(0, 1)), np.median(o))
        x = np.rollaxis(x, -1, 0)
        assert_equal(np.median(x, axis=(-2, -1)), np.median(o))
        x = x.swapaxes(0, 1).copy()
        assert_equal(np.median(x, axis=(0, -1)), np.median(o))

        assert_equal(np.median(x, axis=(0, 1, 2)), np.median(x, axis=None))
        assert_equal(np.median(x, axis=(0, )), np.median(x, axis=0))
        assert_equal(np.median(x, axis=(-1, )), np.median(x, axis=-1))

        d = np.arange(3 * 5 * 7 * 11).reshape((3, 5, 7, 11))
        np.random.shuffle(d.ravel())
        assert_equal(np.median(d, axis=(0, 1, 2))[0],
                     np.median(d[:,:,:, 0].flatten()))
        assert_equal(np.median(d, axis=(0, 1, 3))[1],
                     np.median(d[:,:, 1,:].flatten()))
        assert_equal(np.median(d, axis=(3, 1, -4))[2],
                     np.median(d[:,:, 2,:].flatten()))
        assert_equal(np.median(d, axis=(3, 1, 2))[2],
                     np.median(d[2,:,:,:].flatten()))
        assert_equal(np.median(d, axis=(3, 2))[2, 1],
                     np.median(d[2, 1,:,:].flatten()))
        assert_equal(np.median(d, axis=(1, -2))[2, 1],
                     np.median(d[2,:,:, 1].flatten()))
        assert_equal(np.median(d, axis=(1, 3))[2, 2],
                     np.median(d[2,:, 2,:].flatten()))

    def test_extended_axis_invalid(self):
        d = np.ones((3, 5, 7, 11))
        assert_raises(np.AxisError, np.median, d, axis=-5)
        assert_raises(np.AxisError, np.median, d, axis=(0, -5))
        assert_raises(np.AxisError, np.median, d, axis=4)
        assert_raises(np.AxisError, np.median, d, axis=(0, 4))
        assert_raises(ValueError, np.median, d, axis=(1, 1))

    def test_keepdims(self):
        d = np.ones((3, 5, 7, 11))
        assert_equal(np.median(d, axis=None, keepdims=True).shape,
                     (1, 1, 1, 1))
        assert_equal(np.median(d, axis=(0, 1), keepdims=True).shape,
                     (1, 1, 7, 11))
        assert_equal(np.median(d, axis=(0, 3), keepdims=True).shape,
                     (1, 5, 7, 1))
        assert_equal(np.median(d, axis=(1,), keepdims=True).shape,
                     (3, 1, 7, 11))
        assert_equal(np.median(d, axis=(0, 1, 2, 3), keepdims=True).shape,
                     (1, 1, 1, 1))
        assert_equal(np.median(d, axis=(0, 1, 3), keepdims=True).shape,
                     (1, 1, 7, 1))


class TestAdd_newdoc_ufunc(TestCase):

    def test_ufunc_arg(self):
        assert_raises(TypeError, add_newdoc_ufunc, 2, "blah")
        assert_raises(ValueError, add_newdoc_ufunc, np.add, "blah")

    def test_string_arg(self):
        assert_raises(TypeError, add_newdoc_ufunc, np.add, 3)


class TestAdd_newdoc(TestCase):

    @dec.skipif(sys.flags.optimize == 2)
    def test_add_doc(self):
        # test np.add_newdoc
        tgt = "Current flat index into the array."
        self.assertEqual(np.core.flatiter.index.__doc__[:len(tgt)], tgt)
        self.assertTrue(len(np.core.ufunc.identity.__doc__) > 300)
        self.assertTrue(len(np.lib.index_tricks.mgrid.__doc__) > 300)


if __name__ == "__main__":
    run_module_suite()
