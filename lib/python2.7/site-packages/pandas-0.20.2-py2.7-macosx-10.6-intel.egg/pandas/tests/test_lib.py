# -*- coding: utf-8 -*-

import pytest

import numpy as np
import pandas as pd
import pandas._libs.lib as lib
import pandas.util.testing as tm


class TestMisc(object):

    def test_max_len_string_array(self):

        arr = a = np.array(['foo', 'b', np.nan], dtype='object')
        assert lib.max_len_string_array(arr), 3

        # unicode
        arr = a.astype('U').astype(object)
        assert lib.max_len_string_array(arr), 3

        # bytes for python3
        arr = a.astype('S').astype(object)
        assert lib.max_len_string_array(arr), 3

        # raises
        pytest.raises(TypeError,
                      lambda: lib.max_len_string_array(arr.astype('U')))

    def test_fast_unique_multiple_list_gen_sort(self):
        keys = [['p', 'a'], ['n', 'd'], ['a', 's']]

        gen = (key for key in keys)
        expected = np.array(['a', 'd', 'n', 'p', 's'])
        out = lib.fast_unique_multiple_list_gen(gen, sort=True)
        tm.assert_numpy_array_equal(np.array(out), expected)

        gen = (key for key in keys)
        expected = np.array(['p', 'a', 'n', 'd', 's'])
        out = lib.fast_unique_multiple_list_gen(gen, sort=False)
        tm.assert_numpy_array_equal(np.array(out), expected)


class TestIndexing(object):

    def test_maybe_indices_to_slice_left_edge(self):
        target = np.arange(100)

        # slice
        indices = np.array([], dtype=np.int64)
        maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

        assert isinstance(maybe_slice, slice)
        tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

        for end in [1, 2, 5, 20, 99]:
            for step in [1, 2, 4]:
                indices = np.arange(0, end, step, dtype=np.int64)
                maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

                assert isinstance(maybe_slice, slice)
                tm.assert_numpy_array_equal(target[indices],
                                            target[maybe_slice])

                # reverse
                indices = indices[::-1]
                maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

                assert isinstance(maybe_slice, slice)
                tm.assert_numpy_array_equal(target[indices],
                                            target[maybe_slice])

        # not slice
        for case in [[2, 1, 2, 0], [2, 2, 1, 0], [0, 1, 2, 1], [-2, 0, 2],
                     [2, 0, -2]]:
            indices = np.array(case, dtype=np.int64)
            maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

            assert not isinstance(maybe_slice, slice)
            tm.assert_numpy_array_equal(maybe_slice, indices)
            tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

    def test_maybe_indices_to_slice_right_edge(self):
        target = np.arange(100)

        # slice
        for start in [0, 2, 5, 20, 97, 98]:
            for step in [1, 2, 4]:
                indices = np.arange(start, 99, step, dtype=np.int64)
                maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

                assert isinstance(maybe_slice, slice)
                tm.assert_numpy_array_equal(target[indices],
                                            target[maybe_slice])

                # reverse
                indices = indices[::-1]
                maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

                assert isinstance(maybe_slice, slice)
                tm.assert_numpy_array_equal(target[indices],
                                            target[maybe_slice])

        # not slice
        indices = np.array([97, 98, 99, 100], dtype=np.int64)
        maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

        assert not isinstance(maybe_slice, slice)
        tm.assert_numpy_array_equal(maybe_slice, indices)

        with pytest.raises(IndexError):
            target[indices]
        with pytest.raises(IndexError):
            target[maybe_slice]

        indices = np.array([100, 99, 98, 97], dtype=np.int64)
        maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

        assert not isinstance(maybe_slice, slice)
        tm.assert_numpy_array_equal(maybe_slice, indices)

        with pytest.raises(IndexError):
            target[indices]
        with pytest.raises(IndexError):
            target[maybe_slice]

        for case in [[99, 97, 99, 96], [99, 99, 98, 97], [98, 98, 97, 96]]:
            indices = np.array(case, dtype=np.int64)
            maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

            assert not isinstance(maybe_slice, slice)
            tm.assert_numpy_array_equal(maybe_slice, indices)
            tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

    def test_maybe_indices_to_slice_both_edges(self):
        target = np.arange(10)

        # slice
        for step in [1, 2, 4, 5, 8, 9]:
            indices = np.arange(0, 9, step, dtype=np.int64)
            maybe_slice = lib.maybe_indices_to_slice(indices, len(target))
            assert isinstance(maybe_slice, slice)
            tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

            # reverse
            indices = indices[::-1]
            maybe_slice = lib.maybe_indices_to_slice(indices, len(target))
            assert isinstance(maybe_slice, slice)
            tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

        # not slice
        for case in [[4, 2, 0, -2], [2, 2, 1, 0], [0, 1, 2, 1]]:
            indices = np.array(case, dtype=np.int64)
            maybe_slice = lib.maybe_indices_to_slice(indices, len(target))
            assert not isinstance(maybe_slice, slice)
            tm.assert_numpy_array_equal(maybe_slice, indices)
            tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

    def test_maybe_indices_to_slice_middle(self):
        target = np.arange(100)

        # slice
        for start, end in [(2, 10), (5, 25), (65, 97)]:
            for step in [1, 2, 4, 20]:
                indices = np.arange(start, end, step, dtype=np.int64)
                maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

                assert isinstance(maybe_slice, slice)
                tm.assert_numpy_array_equal(target[indices],
                                            target[maybe_slice])

                # reverse
                indices = indices[::-1]
                maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

                assert isinstance(maybe_slice, slice)
                tm.assert_numpy_array_equal(target[indices],
                                            target[maybe_slice])

        # not slice
        for case in [[14, 12, 10, 12], [12, 12, 11, 10], [10, 11, 12, 11]]:
            indices = np.array(case, dtype=np.int64)
            maybe_slice = lib.maybe_indices_to_slice(indices, len(target))

            assert not isinstance(maybe_slice, slice)
            tm.assert_numpy_array_equal(maybe_slice, indices)
            tm.assert_numpy_array_equal(target[indices], target[maybe_slice])

    def test_maybe_booleans_to_slice(self):
        arr = np.array([0, 0, 1, 1, 1, 0, 1], dtype=np.uint8)
        result = lib.maybe_booleans_to_slice(arr)
        assert result.dtype == np.bool_

        result = lib.maybe_booleans_to_slice(arr[:0])
        assert result == slice(0, 0)

    def test_get_reverse_indexer(self):
        indexer = np.array([-1, -1, 1, 2, 0, -1, 3, 4], dtype=np.int64)
        result = lib.get_reverse_indexer(indexer, 5)
        expected = np.array([4, 2, 3, 6, 7], dtype=np.int64)
        assert np.array_equal(result, expected)


class TestNullObj(object):

    _1d_methods = ['isnullobj', 'isnullobj_old']
    _2d_methods = ['isnullobj2d', 'isnullobj2d_old']

    def _check_behavior(self, arr, expected):
        for method in TestNullObj._1d_methods:
            result = getattr(lib, method)(arr)
            tm.assert_numpy_array_equal(result, expected)

        arr = np.atleast_2d(arr)
        expected = np.atleast_2d(expected)

        for method in TestNullObj._2d_methods:
            result = getattr(lib, method)(arr)
            tm.assert_numpy_array_equal(result, expected)

    def test_basic(self):
        arr = np.array([1, None, 'foo', -5.1, pd.NaT, np.nan])
        expected = np.array([False, True, False, False, True, True])

        self._check_behavior(arr, expected)

    def test_non_obj_dtype(self):
        arr = np.array([1, 3, np.nan, 5], dtype=float)
        expected = np.array([False, False, True, False])

        self._check_behavior(arr, expected)

    def test_empty_arr(self):
        arr = np.array([])
        expected = np.array([], dtype=bool)

        self._check_behavior(arr, expected)

    def test_empty_str_inp(self):
        arr = np.array([""])  # empty but not null
        expected = np.array([False])

        self._check_behavior(arr, expected)

    def test_empty_like(self):
        # see gh-13717: no segfaults!
        arr = np.empty_like([None])
        expected = np.array([True])

        self._check_behavior(arr, expected)
