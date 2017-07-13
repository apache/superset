from __future__ import division, absolute_import, print_function

import warnings
import numpy as np
from numpy.core import (array, arange, atleast_1d, atleast_2d, atleast_3d,
                        block, vstack, hstack, newaxis, concatenate, stack)
from numpy.testing import (TestCase, assert_, assert_raises,
                           assert_array_equal, assert_equal, run_module_suite,
                           assert_raises_regex, assert_almost_equal)

from numpy.compat import long

class TestAtleast1d(TestCase):
    def test_0D_array(self):
        a = array(1)
        b = array(2)
        res = [atleast_1d(a), atleast_1d(b)]
        desired = [array([1]), array([2])]
        assert_array_equal(res, desired)

    def test_1D_array(self):
        a = array([1, 2])
        b = array([2, 3])
        res = [atleast_1d(a), atleast_1d(b)]
        desired = [array([1, 2]), array([2, 3])]
        assert_array_equal(res, desired)

    def test_2D_array(self):
        a = array([[1, 2], [1, 2]])
        b = array([[2, 3], [2, 3]])
        res = [atleast_1d(a), atleast_1d(b)]
        desired = [a, b]
        assert_array_equal(res, desired)

    def test_3D_array(self):
        a = array([[1, 2], [1, 2]])
        b = array([[2, 3], [2, 3]])
        a = array([a, a])
        b = array([b, b])
        res = [atleast_1d(a), atleast_1d(b)]
        desired = [a, b]
        assert_array_equal(res, desired)

    def test_r1array(self):
        """ Test to make sure equivalent Travis O's r1array function
        """
        assert_(atleast_1d(3).shape == (1,))
        assert_(atleast_1d(3j).shape == (1,))
        assert_(atleast_1d(long(3)).shape == (1,))
        assert_(atleast_1d(3.0).shape == (1,))
        assert_(atleast_1d([[2, 3], [4, 5]]).shape == (2, 2))


class TestAtleast2d(TestCase):
    def test_0D_array(self):
        a = array(1)
        b = array(2)
        res = [atleast_2d(a), atleast_2d(b)]
        desired = [array([[1]]), array([[2]])]
        assert_array_equal(res, desired)

    def test_1D_array(self):
        a = array([1, 2])
        b = array([2, 3])
        res = [atleast_2d(a), atleast_2d(b)]
        desired = [array([[1, 2]]), array([[2, 3]])]
        assert_array_equal(res, desired)

    def test_2D_array(self):
        a = array([[1, 2], [1, 2]])
        b = array([[2, 3], [2, 3]])
        res = [atleast_2d(a), atleast_2d(b)]
        desired = [a, b]
        assert_array_equal(res, desired)

    def test_3D_array(self):
        a = array([[1, 2], [1, 2]])
        b = array([[2, 3], [2, 3]])
        a = array([a, a])
        b = array([b, b])
        res = [atleast_2d(a), atleast_2d(b)]
        desired = [a, b]
        assert_array_equal(res, desired)

    def test_r2array(self):
        """ Test to make sure equivalent Travis O's r2array function
        """
        assert_(atleast_2d(3).shape == (1, 1))
        assert_(atleast_2d([3j, 1]).shape == (1, 2))
        assert_(atleast_2d([[[3, 1], [4, 5]], [[3, 5], [1, 2]]]).shape == (2, 2, 2))


class TestAtleast3d(TestCase):
    def test_0D_array(self):
        a = array(1)
        b = array(2)
        res = [atleast_3d(a), atleast_3d(b)]
        desired = [array([[[1]]]), array([[[2]]])]
        assert_array_equal(res, desired)

    def test_1D_array(self):
        a = array([1, 2])
        b = array([2, 3])
        res = [atleast_3d(a), atleast_3d(b)]
        desired = [array([[[1], [2]]]), array([[[2], [3]]])]
        assert_array_equal(res, desired)

    def test_2D_array(self):
        a = array([[1, 2], [1, 2]])
        b = array([[2, 3], [2, 3]])
        res = [atleast_3d(a), atleast_3d(b)]
        desired = [a[:,:, newaxis], b[:,:, newaxis]]
        assert_array_equal(res, desired)

    def test_3D_array(self):
        a = array([[1, 2], [1, 2]])
        b = array([[2, 3], [2, 3]])
        a = array([a, a])
        b = array([b, b])
        res = [atleast_3d(a), atleast_3d(b)]
        desired = [a, b]
        assert_array_equal(res, desired)


class TestHstack(TestCase):
    def test_non_iterable(self):
        assert_raises(TypeError, hstack, 1)

    def test_empty_input(self):
        assert_raises(ValueError, hstack, ())

    def test_0D_array(self):
        a = array(1)
        b = array(2)
        res = hstack([a, b])
        desired = array([1, 2])
        assert_array_equal(res, desired)

    def test_1D_array(self):
        a = array([1])
        b = array([2])
        res = hstack([a, b])
        desired = array([1, 2])
        assert_array_equal(res, desired)

    def test_2D_array(self):
        a = array([[1], [2]])
        b = array([[1], [2]])
        res = hstack([a, b])
        desired = array([[1, 1], [2, 2]])
        assert_array_equal(res, desired)


class TestVstack(TestCase):
    def test_non_iterable(self):
        assert_raises(TypeError, vstack, 1)

    def test_empty_input(self):
        assert_raises(ValueError, vstack, ())

    def test_0D_array(self):
        a = array(1)
        b = array(2)
        res = vstack([a, b])
        desired = array([[1], [2]])
        assert_array_equal(res, desired)

    def test_1D_array(self):
        a = array([1])
        b = array([2])
        res = vstack([a, b])
        desired = array([[1], [2]])
        assert_array_equal(res, desired)

    def test_2D_array(self):
        a = array([[1], [2]])
        b = array([[1], [2]])
        res = vstack([a, b])
        desired = array([[1], [2], [1], [2]])
        assert_array_equal(res, desired)

    def test_2D_array2(self):
        a = array([1, 2])
        b = array([1, 2])
        res = vstack([a, b])
        desired = array([[1, 2], [1, 2]])
        assert_array_equal(res, desired)


class TestConcatenate(TestCase):
    def test_exceptions(self):
        # test axis must be in bounds
        for ndim in [1, 2, 3]:
            a = np.ones((1,)*ndim)
            np.concatenate((a, a), axis=0)  # OK
            assert_raises(np.AxisError, np.concatenate, (a, a), axis=ndim)
            assert_raises(np.AxisError, np.concatenate, (a, a), axis=-(ndim + 1))

        # Scalars cannot be concatenated
        assert_raises(ValueError, concatenate, (0,))
        assert_raises(ValueError, concatenate, (np.array(0),))

        # test shapes must match except for concatenation axis
        a = np.ones((1, 2, 3))
        b = np.ones((2, 2, 3))
        axis = list(range(3))
        for i in range(3):
            np.concatenate((a, b), axis=axis[0])  # OK
            assert_raises(ValueError, np.concatenate, (a, b), axis=axis[1])
            assert_raises(ValueError, np.concatenate, (a, b), axis=axis[2])
            a = np.rollaxis(a, -1)
            b = np.rollaxis(b, -1)
            axis.append(axis.pop(0))

        # No arrays to concatenate raises ValueError
        assert_raises(ValueError, concatenate, ())

    def test_concatenate_axis_None(self):
        a = np.arange(4, dtype=np.float64).reshape((2, 2))
        b = list(range(3))
        c = ['x']
        r = np.concatenate((a, a), axis=None)
        assert_equal(r.dtype, a.dtype)
        assert_equal(r.ndim, 1)
        r = np.concatenate((a, b), axis=None)
        assert_equal(r.size, a.size + len(b))
        assert_equal(r.dtype, a.dtype)
        r = np.concatenate((a, b, c), axis=None)
        d = array(['0.0', '1.0', '2.0', '3.0',
                   '0', '1', '2', 'x'])
        assert_array_equal(r, d)

    def test_large_concatenate_axis_None(self):
        # When no axis is given, concatenate uses flattened versions.
        # This also had a bug with many arrays (see gh-5979).
        x = np.arange(1, 100)
        r = np.concatenate(x, None)
        assert_array_equal(x, r)

        # This should probably be deprecated:
        r = np.concatenate(x, 100)  # axis is >= MAXDIMS
        assert_array_equal(x, r)

    def test_concatenate(self):
        # Test concatenate function
        # One sequence returns unmodified (but as array)
        r4 = list(range(4))
        assert_array_equal(concatenate((r4,)), r4)
        # Any sequence
        assert_array_equal(concatenate((tuple(r4),)), r4)
        assert_array_equal(concatenate((array(r4),)), r4)
        # 1D default concatenation
        r3 = list(range(3))
        assert_array_equal(concatenate((r4, r3)), r4 + r3)
        # Mixed sequence types
        assert_array_equal(concatenate((tuple(r4), r3)), r4 + r3)
        assert_array_equal(concatenate((array(r4), r3)), r4 + r3)
        # Explicit axis specification
        assert_array_equal(concatenate((r4, r3), 0), r4 + r3)
        # Including negative
        assert_array_equal(concatenate((r4, r3), -1), r4 + r3)
        # 2D
        a23 = array([[10, 11, 12], [13, 14, 15]])
        a13 = array([[0, 1, 2]])
        res = array([[10, 11, 12], [13, 14, 15], [0, 1, 2]])
        assert_array_equal(concatenate((a23, a13)), res)
        assert_array_equal(concatenate((a23, a13), 0), res)
        assert_array_equal(concatenate((a23.T, a13.T), 1), res.T)
        assert_array_equal(concatenate((a23.T, a13.T), -1), res.T)
        # Arrays much match shape
        assert_raises(ValueError, concatenate, (a23.T, a13.T), 0)
        # 3D
        res = arange(2 * 3 * 7).reshape((2, 3, 7))
        a0 = res[..., :4]
        a1 = res[..., 4:6]
        a2 = res[..., 6:]
        assert_array_equal(concatenate((a0, a1, a2), 2), res)
        assert_array_equal(concatenate((a0, a1, a2), -1), res)
        assert_array_equal(concatenate((a0.T, a1.T, a2.T), 0), res.T)


def test_stack():
    # non-iterable input
    assert_raises(TypeError, stack, 1)

    # 0d input
    for input_ in [(1, 2, 3),
                   [np.int32(1), np.int32(2), np.int32(3)],
                   [np.array(1), np.array(2), np.array(3)]]:
        assert_array_equal(stack(input_), [1, 2, 3])
    # 1d input examples
    a = np.array([1, 2, 3])
    b = np.array([4, 5, 6])
    r1 = array([[1, 2, 3], [4, 5, 6]])
    assert_array_equal(np.stack((a, b)), r1)
    assert_array_equal(np.stack((a, b), axis=1), r1.T)
    # all input types
    assert_array_equal(np.stack(list([a, b])), r1)
    assert_array_equal(np.stack(array([a, b])), r1)
    # all shapes for 1d input
    arrays = [np.random.randn(3) for _ in range(10)]
    axes = [0, 1, -1, -2]
    expected_shapes = [(10, 3), (3, 10), (3, 10), (10, 3)]
    for axis, expected_shape in zip(axes, expected_shapes):
        assert_equal(np.stack(arrays, axis).shape, expected_shape)
    assert_raises_regex(np.AxisError, 'out of bounds', stack, arrays, axis=2)
    assert_raises_regex(np.AxisError, 'out of bounds', stack, arrays, axis=-3)
    # all shapes for 2d input
    arrays = [np.random.randn(3, 4) for _ in range(10)]
    axes = [0, 1, 2, -1, -2, -3]
    expected_shapes = [(10, 3, 4), (3, 10, 4), (3, 4, 10),
                        (3, 4, 10), (3, 10, 4), (10, 3, 4)]
    for axis, expected_shape in zip(axes, expected_shapes):
        assert_equal(np.stack(arrays, axis).shape, expected_shape)
    # empty arrays
    assert_(stack([[], [], []]).shape == (3, 0))
    assert_(stack([[], [], []], axis=1).shape == (0, 3))
    # edge cases
    assert_raises_regex(ValueError, 'need at least one array', stack, [])
    assert_raises_regex(ValueError, 'must have the same shape',
                        stack, [1, np.arange(3)])
    assert_raises_regex(ValueError, 'must have the same shape',
                        stack, [np.arange(3), 1])
    assert_raises_regex(ValueError, 'must have the same shape',
                        stack, [np.arange(3), 1], axis=1)
    assert_raises_regex(ValueError, 'must have the same shape',
                        stack, [np.zeros((3, 3)), np.zeros(3)], axis=1)
    assert_raises_regex(ValueError, 'must have the same shape',
                        stack, [np.arange(2), np.arange(3)])
    # np.matrix
    m = np.matrix([[1, 2], [3, 4]])
    assert_raises_regex(ValueError, 'shape too large to be a matrix',
                        stack, [m, m])


class TestBlock(TestCase):
    def test_block_simple_row_wise(self):
        a_2d = np.ones((2, 2))
        b_2d = 2 * a_2d
        desired = np.array([[1, 1, 2, 2],
                            [1, 1, 2, 2]])
        result = block([a_2d, b_2d])
        assert_equal(desired, result)

    def test_block_simple_column_wise(self):
        a_2d = np.ones((2, 2))
        b_2d = 2 * a_2d
        expected = np.array([[1, 1],
                             [1, 1],
                             [2, 2],
                             [2, 2]])
        result = block([[a_2d], [b_2d]])
        assert_equal(expected, result)

    def test_block_with_1d_arrays_row_wise(self):
        # # # 1-D vectors are treated as row arrays
        a = np.array([1, 2, 3])
        b = np.array([2, 3, 4])
        expected = np.array([1, 2, 3, 2, 3, 4])
        result = block([a, b])
        assert_equal(expected, result)

    def test_block_with_1d_arrays_multiple_rows(self):
        a = np.array([1, 2, 3])
        b = np.array([2, 3, 4])
        expected = np.array([[1, 2, 3, 2, 3, 4],
                             [1, 2, 3, 2, 3, 4]])
        result = block([[a, b], [a, b]])
        assert_equal(expected, result)

    def test_block_with_1d_arrays_column_wise(self):
        # # # 1-D vectors are treated as row arrays
        a_1d = np.array([1, 2, 3])
        b_1d = np.array([2, 3, 4])
        expected = np.array([[1, 2, 3],
                             [2, 3, 4]])
        result = block([[a_1d], [b_1d]])
        assert_equal(expected, result)

    def test_block_mixed_1d_and_2d(self):
        a_2d = np.ones((2, 2))
        b_1d = np.array([2, 2])
        result = block([[a_2d], [b_1d]])
        expected = np.array([[1, 1],
                             [1, 1],
                             [2, 2]])
        assert_equal(expected, result)

    def test_block_complicated(self):
        # a bit more complicated
        one_2d = np.array([[1, 1, 1]])
        two_2d = np.array([[2, 2, 2]])
        three_2d = np.array([[3, 3, 3, 3, 3, 3]])
        four_1d = np.array([4, 4, 4, 4, 4, 4])
        five_0d = np.array(5)
        six_1d = np.array([6, 6, 6, 6, 6])
        zero_2d = np.zeros((2, 6))

        expected = np.array([[1, 1, 1, 2, 2, 2],
                             [3, 3, 3, 3, 3, 3],
                             [4, 4, 4, 4, 4, 4],
                             [5, 6, 6, 6, 6, 6],
                             [0, 0, 0, 0, 0, 0],
                             [0, 0, 0, 0, 0, 0]])

        result = block([[one_2d, two_2d],
                        [three_2d],
                        [four_1d],
                        [five_0d, six_1d],
                        [zero_2d]])
        assert_equal(result, expected)

    def test_nested(self):
        one = np.array([1, 1, 1])
        two = np.array([[2, 2, 2], [2, 2, 2], [2, 2, 2]])
        three = np.array([3, 3, 3])
        four = np.array([4, 4, 4])
        five = np.array(5)
        six = np.array([6, 6, 6, 6, 6])
        zero = np.zeros((2, 6))

        result = np.block([
            [
                np.block([
                   [one],
                   [three],
                   [four]
                ]),
                two
            ],
            [five, six],
            [zero]
        ])
        expected = np.array([[1, 1, 1, 2, 2, 2],
                             [3, 3, 3, 2, 2, 2],
                             [4, 4, 4, 2, 2, 2],
                             [5, 6, 6, 6, 6, 6],
                             [0, 0, 0, 0, 0, 0],
                             [0, 0, 0, 0, 0, 0]])

        assert_equal(result, expected)

    def test_3d(self):
        a000 = np.ones((2, 2, 2), int) * 1

        a100 = np.ones((3, 2, 2), int) * 2
        a010 = np.ones((2, 3, 2), int) * 3
        a001 = np.ones((2, 2, 3), int) * 4

        a011 = np.ones((2, 3, 3), int) * 5
        a101 = np.ones((3, 2, 3), int) * 6
        a110 = np.ones((3, 3, 2), int) * 7

        a111 = np.ones((3, 3, 3), int) * 8

        result = np.block([
            [
                [a000, a001],
                [a010, a011],
            ],
            [
                [a100, a101],
                [a110, a111],
            ]
        ])
        expected = array([[[1, 1, 4, 4, 4],
                           [1, 1, 4, 4, 4],
                           [3, 3, 5, 5, 5],
                           [3, 3, 5, 5, 5],
                           [3, 3, 5, 5, 5]],

                          [[1, 1, 4, 4, 4],
                           [1, 1, 4, 4, 4],
                           [3, 3, 5, 5, 5],
                           [3, 3, 5, 5, 5],
                           [3, 3, 5, 5, 5]],

                          [[2, 2, 6, 6, 6],
                           [2, 2, 6, 6, 6],
                           [7, 7, 8, 8, 8],
                           [7, 7, 8, 8, 8],
                           [7, 7, 8, 8, 8]],

                          [[2, 2, 6, 6, 6],
                           [2, 2, 6, 6, 6],
                           [7, 7, 8, 8, 8],
                           [7, 7, 8, 8, 8],
                           [7, 7, 8, 8, 8]],

                          [[2, 2, 6, 6, 6],
                           [2, 2, 6, 6, 6],
                           [7, 7, 8, 8, 8],
                           [7, 7, 8, 8, 8],
                           [7, 7, 8, 8, 8]]])

        assert_array_equal(result, expected)

    def test_block_with_mismatched_shape(self):
        a = np.array([0, 0])
        b = np.eye(2)
        assert_raises(ValueError, np.block, [a, b])
        assert_raises(ValueError, np.block, [b, a])

    def test_no_lists(self):
        assert_equal(np.block(1),         np.array(1))
        assert_equal(np.block(np.eye(3)), np.eye(3))

    def test_invalid_nesting(self):
        msg = 'depths are mismatched'
        assert_raises_regex(ValueError, msg, np.block, [1, [2]])
        assert_raises_regex(ValueError, msg, np.block, [1, []])
        assert_raises_regex(ValueError, msg, np.block, [[1], 2])
        assert_raises_regex(ValueError, msg, np.block, [[], 2])
        assert_raises_regex(ValueError, msg, np.block, [
            [[1], [2]],
            [[3, 4]],
            [5]  # missing brackets
        ])

    def test_empty_lists(self):
        assert_raises_regex(ValueError, 'empty', np.block, [])
        assert_raises_regex(ValueError, 'empty', np.block, [[]])
        assert_raises_regex(ValueError, 'empty', np.block, [[1], []])

    def test_tuple(self):
        assert_raises_regex(TypeError, 'tuple', np.block, ([1, 2], [3, 4]))
        assert_raises_regex(TypeError, 'tuple', np.block, [(1, 2), (3, 4)])


if __name__ == "__main__":
    run_module_suite()
