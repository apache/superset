# -*- coding: utf-8 -*-
from __future__ import print_function

import numpy as np
import pandas as pd

import pandas.util.testing as tm
from pandas.compat import (is_platform_windows,
                           is_platform_32bit)
from pandas.core.config import option_context


use_32bit_repr = is_platform_windows() or is_platform_32bit()


class TestSparseSeriesFormatting(object):

    @property
    def dtype_format_for_platform(self):
        return '' if use_32bit_repr else ', dtype=int32'

    def test_sparse_max_row(self):
        s = pd.Series([1, np.nan, np.nan, 3, np.nan]).to_sparse()
        result = repr(s)
        dfm = self.dtype_format_for_platform
        exp = ("0    1.0\n1    NaN\n2    NaN\n3    3.0\n"
               "4    NaN\ndtype: float64\nBlockIndex\n"
               "Block locations: array([0, 3]{0})\n"
               "Block lengths: array([1, 1]{0})".format(dfm))
        assert result == exp

        with option_context("display.max_rows", 3):
            # GH 10560
            result = repr(s)
            exp = ("0    1.0\n    ... \n4    NaN\n"
                   "Length: 5, dtype: float64\nBlockIndex\n"
                   "Block locations: array([0, 3]{0})\n"
                   "Block lengths: array([1, 1]{0})".format(dfm))
            assert result == exp

    def test_sparse_mi_max_row(self):
        idx = pd.MultiIndex.from_tuples([('A', 0), ('A', 1), ('B', 0),
                                         ('C', 0), ('C', 1), ('C', 2)])
        s = pd.Series([1, np.nan, np.nan, 3, np.nan, np.nan],
                      index=idx).to_sparse()
        result = repr(s)
        dfm = self.dtype_format_for_platform
        exp = ("A  0    1.0\n   1    NaN\nB  0    NaN\n"
               "C  0    3.0\n   1    NaN\n   2    NaN\n"
               "dtype: float64\nBlockIndex\n"
               "Block locations: array([0, 3]{0})\n"
               "Block lengths: array([1, 1]{0})".format(dfm))
        assert result == exp

        with option_context("display.max_rows", 3,
                            "display.show_dimensions", False):
            # GH 13144
            result = repr(s)
            exp = ("A  0    1.0\n       ... \nC  2    NaN\n"
                   "dtype: float64\nBlockIndex\n"
                   "Block locations: array([0, 3]{0})\n"
                   "Block lengths: array([1, 1]{0})".format(dfm))
            assert result == exp

    def test_sparse_bool(self):
        # GH 13110
        s = pd.SparseSeries([True, False, False, True, False, False],
                            fill_value=False)
        result = repr(s)
        dtype = '' if use_32bit_repr else ', dtype=int32'
        exp = ("0     True\n1    False\n2    False\n"
               "3     True\n4    False\n5    False\n"
               "dtype: bool\nBlockIndex\n"
               "Block locations: array([0, 3]{0})\n"
               "Block lengths: array([1, 1]{0})".format(dtype))
        assert result == exp

        with option_context("display.max_rows", 3):
            result = repr(s)
            exp = ("0     True\n     ...  \n5    False\n"
                   "Length: 6, dtype: bool\nBlockIndex\n"
                   "Block locations: array([0, 3]{0})\n"
                   "Block lengths: array([1, 1]{0})".format(dtype))
            assert result == exp

    def test_sparse_int(self):
        # GH 13110
        s = pd.SparseSeries([0, 1, 0, 0, 1, 0], fill_value=False)

        result = repr(s)
        dtype = '' if use_32bit_repr else ', dtype=int32'
        exp = ("0    0\n1    1\n2    0\n3    0\n4    1\n"
               "5    0\ndtype: int64\nBlockIndex\n"
               "Block locations: array([1, 4]{0})\n"
               "Block lengths: array([1, 1]{0})".format(dtype))
        assert result == exp

        with option_context("display.max_rows", 3,
                            "display.show_dimensions", False):
            result = repr(s)
            exp = ("0    0\n    ..\n5    0\n"
                   "dtype: int64\nBlockIndex\n"
                   "Block locations: array([1, 4]{0})\n"
                   "Block lengths: array([1, 1]{0})".format(dtype))
            assert result == exp


class TestSparseDataFrameFormatting(object):

    def test_sparse_frame(self):
        # GH 13110
        df = pd.DataFrame({'A': [True, False, True, False, True],
                           'B': [True, False, True, False, True],
                           'C': [0, 0, 3, 0, 5],
                           'D': [np.nan, np.nan, np.nan, 1, 2]})
        sparse = df.to_sparse()
        assert repr(sparse) == repr(df)

        with option_context("display.max_rows", 3):
            assert repr(sparse) == repr(df)

    def test_sparse_repr_after_set(self):
        # GH 15488
        sdf = pd.SparseDataFrame([[np.nan, 1], [2, np.nan]])
        res = sdf.copy()

        # Ignore the warning
        with pd.option_context('mode.chained_assignment', None):
            sdf[0][1] = 2  # This line triggers the bug

        repr(sdf)
        tm.assert_sp_frame_equal(sdf, res)
