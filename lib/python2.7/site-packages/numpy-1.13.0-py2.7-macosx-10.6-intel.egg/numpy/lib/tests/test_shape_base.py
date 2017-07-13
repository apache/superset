from __future__ import division, absolute_import, print_function

import numpy as np
import warnings

from numpy.lib.shape_base import (
    apply_along_axis, apply_over_axes, array_split, split, hsplit, dsplit,
    vsplit, dstack, column_stack, kron, tile, expand_dims,
    )
from numpy.testing import (
    run_module_suite, TestCase, assert_, assert_equal, assert_array_equal,
    assert_raises, assert_warns
    )


class TestApplyAlongAxis(TestCase):
    def test_simple(self):
        a = np.ones((20, 10), 'd')
        assert_array_equal(
            apply_along_axis(len, 0, a), len(a)*np.ones(a.shape[1]))

    def test_simple101(self, level=11):
        a = np.ones((10, 101), 'd')
        assert_array_equal(
            apply_along_axis(len, 0, a), len(a)*np.ones(a.shape[1]))

    def test_3d(self):
        a = np.arange(27).reshape((3, 3, 3))
        assert_array_equal(apply_along_axis(np.sum, 0, a),
                           [[27, 30, 33], [36, 39, 42], [45, 48, 51]])

    def test_preserve_subclass(self):
        # this test is particularly malicious because matrix
        # refuses to become 1d
        def double(row):
            return row * 2
        m = np.matrix([[0, 1], [2, 3]])
        expected = np.matrix([[0, 2], [4, 6]])

        result = apply_along_axis(double, 0, m)
        assert_(isinstance(result, np.matrix))
        assert_array_equal(result, expected)

        result = apply_along_axis(double, 1, m)
        assert_(isinstance(result, np.matrix))
        assert_array_equal(result, expected)

    def test_subclass(self):
        class MinimalSubclass(np.ndarray):
            data = 1

        def minimal_function(array):
            return array.data

        a = np.zeros((6, 3)).view(MinimalSubclass)

        assert_array_equal(
            apply_along_axis(minimal_function, 0, a), np.array([1, 1, 1])
        )

    def test_scalar_array(self, cls=np.ndarray):
        a = np.ones((6, 3)).view(cls)
        res = apply_along_axis(np.sum, 0, a)
        assert_(isinstance(res, cls))
        assert_array_equal(res, np.array([6, 6, 6]).view(cls))

    def test_0d_array(self, cls=np.ndarray):
        def sum_to_0d(x):
            """ Sum x, returning a 0d array of the same class """
            assert_equal(x.ndim, 1)
            return np.squeeze(np.sum(x, keepdims=True))
        a = np.ones((6, 3)).view(cls)
        res = apply_along_axis(sum_to_0d, 0, a)
        assert_(isinstance(res, cls))
        assert_array_equal(res, np.array([6, 6, 6]).view(cls))

        res = apply_along_axis(sum_to_0d, 1, a)
        assert_(isinstance(res, cls))
        assert_array_equal(res, np.array([3, 3, 3, 3, 3, 3]).view(cls))

    def test_axis_insertion(self, cls=np.ndarray):
        def f1to2(x):
            """produces an assymmetric non-square matrix from x"""
            assert_equal(x.ndim, 1)
            return (x[::-1] * x[1:,None]).view(cls)

        a2d = np.arange(6*3).reshape((6, 3))

        # 2d insertion along first axis
        actual = apply_along_axis(f1to2, 0, a2d)
        expected = np.stack([
            f1to2(a2d[:,i]) for i in range(a2d.shape[1])
        ], axis=-1).view(cls)
        assert_equal(type(actual), type(expected))
        assert_equal(actual, expected)

        # 2d insertion along last axis
        actual = apply_along_axis(f1to2, 1, a2d)
        expected = np.stack([
            f1to2(a2d[i,:]) for i in range(a2d.shape[0])
        ], axis=0).view(cls)
        assert_equal(type(actual), type(expected))
        assert_equal(actual, expected)

        # 3d insertion along middle axis
        a3d = np.arange(6*5*3).reshape((6, 5, 3))

        actual = apply_along_axis(f1to2, 1, a3d)
        expected = np.stack([
            np.stack([
                f1to2(a3d[i,:,j]) for i in range(a3d.shape[0])
            ], axis=0)
            for j in range(a3d.shape[2])
        ], axis=-1).view(cls)
        assert_equal(type(actual), type(expected))
        assert_equal(actual, expected)

    def test_subclass_preservation(self):
        class MinimalSubclass(np.ndarray):
            pass
        self.test_scalar_array(MinimalSubclass)
        self.test_0d_array(MinimalSubclass)
        self.test_axis_insertion(MinimalSubclass)

    def test_axis_insertion_ma(self):
        def f1to2(x):
            """produces an assymmetric non-square matrix from x"""
            assert_equal(x.ndim, 1)
            res = x[::-1] * x[1:,None]
            return np.ma.masked_where(res%5==0, res)
        a = np.arange(6*3).reshape((6, 3))
        res = apply_along_axis(f1to2, 0, a)
        assert_(isinstance(res, np.ma.masked_array))
        assert_equal(res.ndim, 3)
        assert_array_equal(res[:,:,0].mask, f1to2(a[:,0]).mask)
        assert_array_equal(res[:,:,1].mask, f1to2(a[:,1]).mask)
        assert_array_equal(res[:,:,2].mask, f1to2(a[:,2]).mask)

    def test_tuple_func1d(self):
        def sample_1d(x):
            return x[1], x[0]
        res = np.apply_along_axis(sample_1d, 1, np.array([[1, 2], [3, 4]]))
        assert_array_equal(res, np.array([[2, 1], [4, 3]]))

    def test_empty(self):
        # can't apply_along_axis when there's no chance to call the function
        def never_call(x):
            assert_(False) # should never be reached

        a = np.empty((0, 0))
        assert_raises(ValueError, np.apply_along_axis, never_call, 0, a)
        assert_raises(ValueError, np.apply_along_axis, never_call, 1, a)

        # but it's sometimes ok with some non-zero dimensions
        def empty_to_1(x):
            assert_(len(x) == 0)
            return 1

        a = np.empty((10, 0))
        actual = np.apply_along_axis(empty_to_1, 1, a)
        assert_equal(actual, np.ones(10))
        assert_raises(ValueError, np.apply_along_axis, empty_to_1, 0, a)

    def test_with_iterable_object(self):
        # from issue 5248
        d = np.array([
            [set([1, 11]), set([2, 22]), set([3, 33])],
            [set([4, 44]), set([5, 55]), set([6, 66])]
        ])
        actual = np.apply_along_axis(lambda a: set.union(*a), 0, d)
        expected = np.array([{1, 11, 4, 44}, {2, 22, 5, 55}, {3, 33, 6, 66}])

        assert_equal(actual, expected)

        # issue 8642 - assert_equal doesn't detect this!
        for i in np.ndindex(actual.shape):
            assert_equal(type(actual[i]), type(expected[i]))


class TestApplyOverAxes(TestCase):
    def test_simple(self):
        a = np.arange(24).reshape(2, 3, 4)
        aoa_a = apply_over_axes(np.sum, a, [0, 2])
        assert_array_equal(aoa_a, np.array([[[60], [92], [124]]]))


class TestExpandDims(TestCase):
    def test_functionality(self):
        s = (2, 3, 4, 5)
        a = np.empty(s)
        for axis in range(-5, 4):
            b = expand_dims(a, axis)
            assert_(b.shape[axis] == 1)
            assert_(np.squeeze(b).shape == s)

    def test_deprecations(self):
        # 2017-05-17, 1.13.0
        s = (2, 3, 4, 5)
        a = np.empty(s)
        with warnings.catch_warnings():
            warnings.simplefilter("always")
            assert_warns(DeprecationWarning, expand_dims, a, -6)
            assert_warns(DeprecationWarning, expand_dims, a, 5)


class TestArraySplit(TestCase):
    def test_integer_0_split(self):
        a = np.arange(10)
        assert_raises(ValueError, array_split, a, 0)

    def test_integer_split(self):
        a = np.arange(10)
        res = array_split(a, 1)
        desired = [np.arange(10)]
        compare_results(res, desired)

        res = array_split(a, 2)
        desired = [np.arange(5), np.arange(5, 10)]
        compare_results(res, desired)

        res = array_split(a, 3)
        desired = [np.arange(4), np.arange(4, 7), np.arange(7, 10)]
        compare_results(res, desired)

        res = array_split(a, 4)
        desired = [np.arange(3), np.arange(3, 6), np.arange(6, 8),
                   np.arange(8, 10)]
        compare_results(res, desired)

        res = array_split(a, 5)
        desired = [np.arange(2), np.arange(2, 4), np.arange(4, 6),
                   np.arange(6, 8), np.arange(8, 10)]
        compare_results(res, desired)

        res = array_split(a, 6)
        desired = [np.arange(2), np.arange(2, 4), np.arange(4, 6),
                   np.arange(6, 8), np.arange(8, 9), np.arange(9, 10)]
        compare_results(res, desired)

        res = array_split(a, 7)
        desired = [np.arange(2), np.arange(2, 4), np.arange(4, 6),
                   np.arange(6, 7), np.arange(7, 8), np.arange(8, 9),
                   np.arange(9, 10)]
        compare_results(res, desired)

        res = array_split(a, 8)
        desired = [np.arange(2), np.arange(2, 4), np.arange(4, 5),
                   np.arange(5, 6), np.arange(6, 7), np.arange(7, 8),
                   np.arange(8, 9), np.arange(9, 10)]
        compare_results(res, desired)

        res = array_split(a, 9)
        desired = [np.arange(2), np.arange(2, 3), np.arange(3, 4),
                   np.arange(4, 5), np.arange(5, 6), np.arange(6, 7),
                   np.arange(7, 8), np.arange(8, 9), np.arange(9, 10)]
        compare_results(res, desired)

        res = array_split(a, 10)
        desired = [np.arange(1), np.arange(1, 2), np.arange(2, 3),
                   np.arange(3, 4), np.arange(4, 5), np.arange(5, 6),
                   np.arange(6, 7), np.arange(7, 8), np.arange(8, 9),
                   np.arange(9, 10)]
        compare_results(res, desired)

        res = array_split(a, 11)
        desired = [np.arange(1), np.arange(1, 2), np.arange(2, 3),
                   np.arange(3, 4), np.arange(4, 5), np.arange(5, 6),
                   np.arange(6, 7), np.arange(7, 8), np.arange(8, 9),
                   np.arange(9, 10), np.array([])]
        compare_results(res, desired)

    def test_integer_split_2D_rows(self):
        a = np.array([np.arange(10), np.arange(10)])
        res = array_split(a, 3, axis=0)
        tgt = [np.array([np.arange(10)]), np.array([np.arange(10)]),
                   np.zeros((0, 10))]
        compare_results(res, tgt)
        assert_(a.dtype.type is res[-1].dtype.type)

        # Same thing for manual splits:
        res = array_split(a, [0, 1, 2], axis=0)
        tgt = [np.zeros((0, 10)), np.array([np.arange(10)]),
               np.array([np.arange(10)])]
        compare_results(res, tgt)
        assert_(a.dtype.type is res[-1].dtype.type)

    def test_integer_split_2D_cols(self):
        a = np.array([np.arange(10), np.arange(10)])
        res = array_split(a, 3, axis=-1)
        desired = [np.array([np.arange(4), np.arange(4)]),
                   np.array([np.arange(4, 7), np.arange(4, 7)]),
                   np.array([np.arange(7, 10), np.arange(7, 10)])]
        compare_results(res, desired)

    def test_integer_split_2D_default(self):
        """ This will fail if we change default axis
        """
        a = np.array([np.arange(10), np.arange(10)])
        res = array_split(a, 3)
        tgt = [np.array([np.arange(10)]), np.array([np.arange(10)]),
                   np.zeros((0, 10))]
        compare_results(res, tgt)
        assert_(a.dtype.type is res[-1].dtype.type)
        # perhaps should check higher dimensions

    def test_index_split_simple(self):
        a = np.arange(10)
        indices = [1, 5, 7]
        res = array_split(a, indices, axis=-1)
        desired = [np.arange(0, 1), np.arange(1, 5), np.arange(5, 7),
                   np.arange(7, 10)]
        compare_results(res, desired)

    def test_index_split_low_bound(self):
        a = np.arange(10)
        indices = [0, 5, 7]
        res = array_split(a, indices, axis=-1)
        desired = [np.array([]), np.arange(0, 5), np.arange(5, 7),
                   np.arange(7, 10)]
        compare_results(res, desired)

    def test_index_split_high_bound(self):
        a = np.arange(10)
        indices = [0, 5, 7, 10, 12]
        res = array_split(a, indices, axis=-1)
        desired = [np.array([]), np.arange(0, 5), np.arange(5, 7),
                   np.arange(7, 10), np.array([]), np.array([])]
        compare_results(res, desired)


class TestSplit(TestCase):
    # The split function is essentially the same as array_split,
    # except that it test if splitting will result in an
    # equal split.  Only test for this case.

    def test_equal_split(self):
        a = np.arange(10)
        res = split(a, 2)
        desired = [np.arange(5), np.arange(5, 10)]
        compare_results(res, desired)

    def test_unequal_split(self):
        a = np.arange(10)
        assert_raises(ValueError, split, a, 3)

class TestColumnStack(TestCase):
    def test_non_iterable(self):
        assert_raises(TypeError, column_stack, 1)


class TestDstack(TestCase):
    def test_non_iterable(self):
        assert_raises(TypeError, dstack, 1)

    def test_0D_array(self):
        a = np.array(1)
        b = np.array(2)
        res = dstack([a, b])
        desired = np.array([[[1, 2]]])
        assert_array_equal(res, desired)

    def test_1D_array(self):
        a = np.array([1])
        b = np.array([2])
        res = dstack([a, b])
        desired = np.array([[[1, 2]]])
        assert_array_equal(res, desired)

    def test_2D_array(self):
        a = np.array([[1], [2]])
        b = np.array([[1], [2]])
        res = dstack([a, b])
        desired = np.array([[[1, 1]], [[2, 2, ]]])
        assert_array_equal(res, desired)

    def test_2D_array2(self):
        a = np.array([1, 2])
        b = np.array([1, 2])
        res = dstack([a, b])
        desired = np.array([[[1, 1], [2, 2]]])
        assert_array_equal(res, desired)


# array_split has more comprehensive test of splitting.
# only do simple test on hsplit, vsplit, and dsplit
class TestHsplit(TestCase):
    """Only testing for integer splits.

    """
    def test_non_iterable(self):
        assert_raises(ValueError, hsplit, 1, 1)

    def test_0D_array(self):
        a = np.array(1)
        try:
            hsplit(a, 2)
            assert_(0)
        except ValueError:
            pass

    def test_1D_array(self):
        a = np.array([1, 2, 3, 4])
        res = hsplit(a, 2)
        desired = [np.array([1, 2]), np.array([3, 4])]
        compare_results(res, desired)

    def test_2D_array(self):
        a = np.array([[1, 2, 3, 4],
                  [1, 2, 3, 4]])
        res = hsplit(a, 2)
        desired = [np.array([[1, 2], [1, 2]]), np.array([[3, 4], [3, 4]])]
        compare_results(res, desired)


class TestVsplit(TestCase):
    """Only testing for integer splits.

    """
    def test_non_iterable(self):
        assert_raises(ValueError, vsplit, 1, 1)

    def test_0D_array(self):
        a = np.array(1)
        assert_raises(ValueError, vsplit, a, 2)

    def test_1D_array(self):
        a = np.array([1, 2, 3, 4])
        try:
            vsplit(a, 2)
            assert_(0)
        except ValueError:
            pass

    def test_2D_array(self):
        a = np.array([[1, 2, 3, 4],
                  [1, 2, 3, 4]])
        res = vsplit(a, 2)
        desired = [np.array([[1, 2, 3, 4]]), np.array([[1, 2, 3, 4]])]
        compare_results(res, desired)


class TestDsplit(TestCase):
    # Only testing for integer splits.
    def test_non_iterable(self):
        assert_raises(ValueError, dsplit, 1, 1)

    def test_0D_array(self):
        a = np.array(1)
        assert_raises(ValueError, dsplit, a, 2)

    def test_1D_array(self):
        a = np.array([1, 2, 3, 4])
        assert_raises(ValueError, dsplit, a, 2)

    def test_2D_array(self):
        a = np.array([[1, 2, 3, 4],
                  [1, 2, 3, 4]])
        try:
            dsplit(a, 2)
            assert_(0)
        except ValueError:
            pass

    def test_3D_array(self):
        a = np.array([[[1, 2, 3, 4],
                   [1, 2, 3, 4]],
                  [[1, 2, 3, 4],
                   [1, 2, 3, 4]]])
        res = dsplit(a, 2)
        desired = [np.array([[[1, 2], [1, 2]], [[1, 2], [1, 2]]]),
                   np.array([[[3, 4], [3, 4]], [[3, 4], [3, 4]]])]
        compare_results(res, desired)


class TestSqueeze(TestCase):
    def test_basic(self):
        from numpy.random import rand

        a = rand(20, 10, 10, 1, 1)
        b = rand(20, 1, 10, 1, 20)
        c = rand(1, 1, 20, 10)
        assert_array_equal(np.squeeze(a), np.reshape(a, (20, 10, 10)))
        assert_array_equal(np.squeeze(b), np.reshape(b, (20, 10, 20)))
        assert_array_equal(np.squeeze(c), np.reshape(c, (20, 10)))

        # Squeezing to 0-dim should still give an ndarray
        a = [[[1.5]]]
        res = np.squeeze(a)
        assert_equal(res, 1.5)
        assert_equal(res.ndim, 0)
        assert_equal(type(res), np.ndarray)


class TestKron(TestCase):
    def test_return_type(self):
        a = np.ones([2, 2])
        m = np.asmatrix(a)
        assert_equal(type(kron(a, a)), np.ndarray)
        assert_equal(type(kron(m, m)), np.matrix)
        assert_equal(type(kron(a, m)), np.matrix)
        assert_equal(type(kron(m, a)), np.matrix)

        class myarray(np.ndarray):
            __array_priority__ = 0.0

        ma = myarray(a.shape, a.dtype, a.data)
        assert_equal(type(kron(a, a)), np.ndarray)
        assert_equal(type(kron(ma, ma)), myarray)
        assert_equal(type(kron(a, ma)), np.ndarray)
        assert_equal(type(kron(ma, a)), myarray)


class TestTile(TestCase):
    def test_basic(self):
        a = np.array([0, 1, 2])
        b = [[1, 2], [3, 4]]
        assert_equal(tile(a, 2), [0, 1, 2, 0, 1, 2])
        assert_equal(tile(a, (2, 2)), [[0, 1, 2, 0, 1, 2], [0, 1, 2, 0, 1, 2]])
        assert_equal(tile(a, (1, 2)), [[0, 1, 2, 0, 1, 2]])
        assert_equal(tile(b, 2), [[1, 2, 1, 2], [3, 4, 3, 4]])
        assert_equal(tile(b, (2, 1)), [[1, 2], [3, 4], [1, 2], [3, 4]])
        assert_equal(tile(b, (2, 2)), [[1, 2, 1, 2], [3, 4, 3, 4],
                                       [1, 2, 1, 2], [3, 4, 3, 4]])

    def test_tile_one_repetition_on_array_gh4679(self):
        a = np.arange(5)
        b = tile(a, 1)
        b += 2
        assert_equal(a, np.arange(5))

    def test_empty(self):
        a = np.array([[[]]])
        b = np.array([[], []])
        c = tile(b, 2).shape
        d = tile(a, (3, 2, 5)).shape
        assert_equal(c, (2, 0))
        assert_equal(d, (3, 2, 0))

    def test_kroncompare(self):
        from numpy.random import randint

        reps = [(2,), (1, 2), (2, 1), (2, 2), (2, 3, 2), (3, 2)]
        shape = [(3,), (2, 3), (3, 4, 3), (3, 2, 3), (4, 3, 2, 4), (2, 2)]
        for s in shape:
            b = randint(0, 10, size=s)
            for r in reps:
                a = np.ones(r, b.dtype)
                large = tile(b, r)
                klarge = kron(a, b)
                assert_equal(large, klarge)


class TestMayShareMemory(TestCase):
    def test_basic(self):
        d = np.ones((50, 60))
        d2 = np.ones((30, 60, 6))
        self.assertTrue(np.may_share_memory(d, d))
        self.assertTrue(np.may_share_memory(d, d[::-1]))
        self.assertTrue(np.may_share_memory(d, d[::2]))
        self.assertTrue(np.may_share_memory(d, d[1:, ::-1]))

        self.assertFalse(np.may_share_memory(d[::-1], d2))
        self.assertFalse(np.may_share_memory(d[::2], d2))
        self.assertFalse(np.may_share_memory(d[1:, ::-1], d2))
        self.assertTrue(np.may_share_memory(d2[1:, ::-1], d2))


# Utility
def compare_results(res, desired):
    for i in range(len(desired)):
        assert_array_equal(res[i], desired[i])


if __name__ == "__main__":
    run_module_suite()
