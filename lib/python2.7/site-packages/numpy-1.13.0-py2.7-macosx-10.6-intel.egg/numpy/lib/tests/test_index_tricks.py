from __future__ import division, absolute_import, print_function

import numpy as np
from numpy.testing import (
    run_module_suite, TestCase, assert_, assert_equal, assert_array_equal,
    assert_almost_equal, assert_array_almost_equal, assert_raises
    )
from numpy.lib.index_tricks import (
    mgrid, ndenumerate, fill_diagonal, diag_indices, diag_indices_from,
    index_exp, ndindex, r_, s_, ix_
    )


class TestRavelUnravelIndex(TestCase):
    def test_basic(self):
        assert_equal(np.unravel_index(2, (2, 2)), (1, 0))
        assert_equal(np.ravel_multi_index((1, 0), (2, 2)), 2)
        assert_equal(np.unravel_index(254, (17, 94)), (2, 66))
        assert_equal(np.ravel_multi_index((2, 66), (17, 94)), 254)
        assert_raises(ValueError, np.unravel_index, -1, (2, 2))
        assert_raises(TypeError, np.unravel_index, 0.5, (2, 2))
        assert_raises(ValueError, np.unravel_index, 4, (2, 2))
        assert_raises(ValueError, np.ravel_multi_index, (-3, 1), (2, 2))
        assert_raises(ValueError, np.ravel_multi_index, (2, 1), (2, 2))
        assert_raises(ValueError, np.ravel_multi_index, (0, -3), (2, 2))
        assert_raises(ValueError, np.ravel_multi_index, (0, 2), (2, 2))
        assert_raises(TypeError, np.ravel_multi_index, (0.1, 0.), (2, 2))

        assert_equal(np.unravel_index((2*3 + 1)*6 + 4, (4, 3, 6)), [2, 1, 4])
        assert_equal(
            np.ravel_multi_index([2, 1, 4], (4, 3, 6)), (2*3 + 1)*6 + 4)

        arr = np.array([[3, 6, 6], [4, 5, 1]])
        assert_equal(np.ravel_multi_index(arr, (7, 6)), [22, 41, 37])
        assert_equal(
            np.ravel_multi_index(arr, (7, 6), order='F'), [31, 41, 13])
        assert_equal(
            np.ravel_multi_index(arr, (4, 6), mode='clip'), [22, 23, 19])
        assert_equal(np.ravel_multi_index(arr, (4, 4), mode=('clip', 'wrap')),
                     [12, 13, 13])
        assert_equal(np.ravel_multi_index((3, 1, 4, 1), (6, 7, 8, 9)), 1621)

        assert_equal(np.unravel_index(np.array([22, 41, 37]), (7, 6)),
                     [[3, 6, 6], [4, 5, 1]])
        assert_equal(
            np.unravel_index(np.array([31, 41, 13]), (7, 6), order='F'),
            [[3, 6, 6], [4, 5, 1]])
        assert_equal(np.unravel_index(1621, (6, 7, 8, 9)), [3, 1, 4, 1])

    def test_big_indices(self):
        # ravel_multi_index for big indices (issue #7546)
        if np.intp == np.int64:
            arr = ([1, 29], [3, 5], [3, 117], [19, 2],
                   [2379, 1284], [2, 2], [0, 1])
            assert_equal(
                np.ravel_multi_index(arr, (41, 7, 120, 36, 2706, 8, 6)),
                [5627771580, 117259570957])

        # test overflow checking for too big array (issue #7546)
        dummy_arr = ([0],[0])
        half_max = np.iinfo(np.intp).max // 2
        assert_equal(
            np.ravel_multi_index(dummy_arr, (half_max, 2)), [0])
        assert_raises(ValueError,
            np.ravel_multi_index, dummy_arr, (half_max+1, 2))
        assert_equal(
            np.ravel_multi_index(dummy_arr, (half_max, 2), order='F'), [0])
        assert_raises(ValueError,
            np.ravel_multi_index, dummy_arr, (half_max+1, 2), order='F')

    def test_dtypes(self):
        # Test with different data types
        for dtype in [np.int16, np.uint16, np.int32,
                      np.uint32, np.int64, np.uint64]:
            coords = np.array(
                [[1, 0, 1, 2, 3, 4], [1, 6, 1, 3, 2, 0]], dtype=dtype)
            shape = (5, 8)
            uncoords = 8*coords[0]+coords[1]
            assert_equal(np.ravel_multi_index(coords, shape), uncoords)
            assert_equal(coords, np.unravel_index(uncoords, shape))
            uncoords = coords[0]+5*coords[1]
            assert_equal(
                np.ravel_multi_index(coords, shape, order='F'), uncoords)
            assert_equal(coords, np.unravel_index(uncoords, shape, order='F'))

            coords = np.array(
                [[1, 0, 1, 2, 3, 4], [1, 6, 1, 3, 2, 0], [1, 3, 1, 0, 9, 5]],
                dtype=dtype)
            shape = (5, 8, 10)
            uncoords = 10*(8*coords[0]+coords[1])+coords[2]
            assert_equal(np.ravel_multi_index(coords, shape), uncoords)
            assert_equal(coords, np.unravel_index(uncoords, shape))
            uncoords = coords[0]+5*(coords[1]+8*coords[2])
            assert_equal(
                np.ravel_multi_index(coords, shape, order='F'), uncoords)
            assert_equal(coords, np.unravel_index(uncoords, shape, order='F'))

    def test_clipmodes(self):
        # Test clipmodes
        assert_equal(
            np.ravel_multi_index([5, 1, -1, 2], (4, 3, 7, 12), mode='wrap'),
            np.ravel_multi_index([1, 1, 6, 2], (4, 3, 7, 12)))
        assert_equal(np.ravel_multi_index([5, 1, -1, 2], (4, 3, 7, 12),
                                          mode=(
                                              'wrap', 'raise', 'clip', 'raise')),
                     np.ravel_multi_index([1, 1, 0, 2], (4, 3, 7, 12)))
        assert_raises(
            ValueError, np.ravel_multi_index, [5, 1, -1, 2], (4, 3, 7, 12))

    def test_writeability(self):
        # See gh-7269
        x, y = np.unravel_index([1, 2, 3], (4, 5))
        self.assertTrue(x.flags.writeable)
        self.assertTrue(y.flags.writeable)


class TestGrid(TestCase):
    def test_basic(self):
        a = mgrid[-1:1:10j]
        b = mgrid[-1:1:0.1]
        assert_(a.shape == (10,))
        assert_(b.shape == (20,))
        assert_(a[0] == -1)
        assert_almost_equal(a[-1], 1)
        assert_(b[0] == -1)
        assert_almost_equal(b[1]-b[0], 0.1, 11)
        assert_almost_equal(b[-1], b[0]+19*0.1, 11)
        assert_almost_equal(a[1]-a[0], 2.0/9.0, 11)

    def test_linspace_equivalence(self):
        y, st = np.linspace(2, 10, retstep=1)
        assert_almost_equal(st, 8/49.0)
        assert_array_almost_equal(y, mgrid[2:10:50j], 13)

    def test_nd(self):
        c = mgrid[-1:1:10j, -2:2:10j]
        d = mgrid[-1:1:0.1, -2:2:0.2]
        assert_(c.shape == (2, 10, 10))
        assert_(d.shape == (2, 20, 20))
        assert_array_equal(c[0][0, :], -np.ones(10, 'd'))
        assert_array_equal(c[1][:, 0], -2*np.ones(10, 'd'))
        assert_array_almost_equal(c[0][-1, :], np.ones(10, 'd'), 11)
        assert_array_almost_equal(c[1][:, -1], 2*np.ones(10, 'd'), 11)
        assert_array_almost_equal(d[0, 1, :] - d[0, 0, :],
                                  0.1*np.ones(20, 'd'), 11)
        assert_array_almost_equal(d[1, :, 1] - d[1, :, 0],
                                  0.2*np.ones(20, 'd'), 11)


class TestConcatenator(TestCase):
    def test_1d(self):
        assert_array_equal(r_[1, 2, 3, 4, 5, 6], np.array([1, 2, 3, 4, 5, 6]))
        b = np.ones(5)
        c = r_[b, 0, 0, b]
        assert_array_equal(c, [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1])

    def test_mixed_type(self):
        g = r_[10.1, 1:10]
        assert_(g.dtype == 'f8')

    def test_more_mixed_type(self):
        g = r_[-10.1, np.array([1]), np.array([2, 3, 4]), 10.0]
        assert_(g.dtype == 'f8')

    def test_2d(self):
        b = np.random.rand(5, 5)
        c = np.random.rand(5, 5)
        d = r_['1', b, c]  # append columns
        assert_(d.shape == (5, 10))
        assert_array_equal(d[:, :5], b)
        assert_array_equal(d[:, 5:], c)
        d = r_[b, c]
        assert_(d.shape == (10, 5))
        assert_array_equal(d[:5, :], b)
        assert_array_equal(d[5:, :], c)

    def test_matrix(self):
        a = [1, 2]
        b = [3, 4]

        ab_r = np.r_['r', a, b]
        ab_c = np.r_['c', a, b]

        assert_equal(type(ab_r), np.matrix)
        assert_equal(type(ab_c), np.matrix)

        assert_equal(np.array(ab_r), [[1,2,3,4]])
        assert_equal(np.array(ab_c), [[1],[2],[3],[4]])

        assert_raises(ValueError, lambda: np.r_['rc', a, b])

    def test_matrix_scalar(self):
        r = np.r_['r', [1, 2], 3]
        assert_equal(type(r), np.matrix)
        assert_equal(np.array(r), [[1,2,3]])

    def test_matrix_builder(self):
        a = np.array([1])
        b = np.array([2])
        c = np.array([3])
        d = np.array([4])
        actual = np.r_['a, b; c, d']
        expected = np.bmat([[a, b], [c, d]])

        assert_equal(actual, expected)
        assert_equal(type(actual), type(expected))


class TestNdenumerate(TestCase):
    def test_basic(self):
        a = np.array([[1, 2], [3, 4]])
        assert_equal(list(ndenumerate(a)),
                     [((0, 0), 1), ((0, 1), 2), ((1, 0), 3), ((1, 1), 4)])


class TestIndexExpression(TestCase):
    def test_regression_1(self):
        # ticket #1196
        a = np.arange(2)
        assert_equal(a[:-1], a[s_[:-1]])
        assert_equal(a[:-1], a[index_exp[:-1]])

    def test_simple_1(self):
        a = np.random.rand(4, 5, 6)

        assert_equal(a[:, :3, [1, 2]], a[index_exp[:, :3, [1, 2]]])
        assert_equal(a[:, :3, [1, 2]], a[s_[:, :3, [1, 2]]])


class TestIx_(TestCase):
    def test_regression_1(self):
        # Test empty inputs create ouputs of indexing type, gh-5804
        # Test both lists and arrays
        for func in (range, np.arange):
            a, = np.ix_(func(0))
            assert_equal(a.dtype, np.intp)

    def test_shape_and_dtype(self):
        sizes = (4, 5, 3, 2)
        # Test both lists and arrays
        for func in (range, np.arange):
            arrays = np.ix_(*[func(sz) for sz in sizes])
            for k, (a, sz) in enumerate(zip(arrays, sizes)):
                assert_equal(a.shape[k], sz)
                assert_(all(sh == 1 for j, sh in enumerate(a.shape) if j != k))
                assert_(np.issubdtype(a.dtype, int))

    def test_bool(self):
        bool_a = [True, False, True, True]
        int_a, = np.nonzero(bool_a)
        assert_equal(np.ix_(bool_a)[0], int_a)

    def test_1d_only(self):
        idx2d = [[1, 2, 3], [4, 5, 6]]
        assert_raises(ValueError, np.ix_, idx2d)

    def test_repeated_input(self):
        length_of_vector = 5
        x = np.arange(length_of_vector)
        out = ix_(x, x)
        assert_equal(out[0].shape, (length_of_vector, 1))
        assert_equal(out[1].shape, (1, length_of_vector))
        # check that input shape is not modified
        assert_equal(x.shape, (length_of_vector,))


def test_c_():
    a = np.c_[np.array([[1, 2, 3]]), 0, 0, np.array([[4, 5, 6]])]
    assert_equal(a, [[1, 2, 3, 0, 0, 4, 5, 6]])


def test_fill_diagonal():
    a = np.zeros((3, 3), int)
    fill_diagonal(a, 5)
    yield (assert_array_equal, a,
           np.array([[5, 0, 0],
                  [0, 5, 0],
                  [0, 0, 5]]))

    #Test tall matrix
    a = np.zeros((10, 3), int)
    fill_diagonal(a, 5)
    yield (assert_array_equal, a,
           np.array([[5, 0, 0],
                  [0, 5, 0],
                  [0, 0, 5],
                  [0, 0, 0],
                  [0, 0, 0],
                  [0, 0, 0],
                  [0, 0, 0],
                  [0, 0, 0],
                  [0, 0, 0],
                  [0, 0, 0]]))

    #Test tall matrix wrap
    a = np.zeros((10, 3), int)
    fill_diagonal(a, 5, True)
    yield (assert_array_equal, a,
           np.array([[5, 0, 0],
                  [0, 5, 0],
                  [0, 0, 5],
                  [0, 0, 0],
                  [5, 0, 0],
                  [0, 5, 0],
                  [0, 0, 5],
                  [0, 0, 0],
                  [5, 0, 0],
                  [0, 5, 0]]))

    #Test wide matrix
    a = np.zeros((3, 10), int)
    fill_diagonal(a, 5)
    yield (assert_array_equal, a,
           np.array([[5, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                  [0, 5, 0, 0, 0, 0, 0, 0, 0, 0],
                  [0, 0, 5, 0, 0, 0, 0, 0, 0, 0]]))

    # The same function can operate on a 4-d array:
    a = np.zeros((3, 3, 3, 3), int)
    fill_diagonal(a, 4)
    i = np.array([0, 1, 2])
    yield (assert_equal, np.where(a != 0), (i, i, i, i))


def test_diag_indices():
    di = diag_indices(4)
    a = np.array([[1, 2, 3, 4],
               [5, 6, 7, 8],
               [9, 10, 11, 12],
               [13, 14, 15, 16]])
    a[di] = 100
    yield (assert_array_equal, a,
           np.array([[100, 2, 3, 4],
                  [5, 100, 7, 8],
                  [9, 10, 100, 12],
                  [13, 14, 15, 100]]))

    # Now, we create indices to manipulate a 3-d array:
    d3 = diag_indices(2, 3)

    # And use it to set the diagonal of a zeros array to 1:
    a = np.zeros((2, 2, 2), int)
    a[d3] = 1
    yield (assert_array_equal, a,
           np.array([[[1, 0],
                   [0, 0]],

                  [[0, 0],
                   [0, 1]]]))


def test_diag_indices_from():
    x = np.random.random((4, 4))
    r, c = diag_indices_from(x)
    assert_array_equal(r, np.arange(4))
    assert_array_equal(c, np.arange(4))


def test_ndindex():
    x = list(ndindex(1, 2, 3))
    expected = [ix for ix, e in ndenumerate(np.zeros((1, 2, 3)))]
    assert_array_equal(x, expected)

    x = list(ndindex((1, 2, 3)))
    assert_array_equal(x, expected)

    # Test use of scalars and tuples
    x = list(ndindex((3,)))
    assert_array_equal(x, list(ndindex(3)))

    # Make sure size argument is optional
    x = list(ndindex())
    assert_equal(x, [()])

    x = list(ndindex(()))
    assert_equal(x, [()])

    # Make sure 0-sized ndindex works correctly
    x = list(ndindex(*[0]))
    assert_equal(x, [])


if __name__ == "__main__":
    run_module_suite()
