# -*- coding: utf-8 -*-

from __future__ import print_function

from datetime import datetime
import operator

import pytest

from numpy import nan, random
import numpy as np

from pandas.compat import lrange
from pandas import compat
from pandas import (DataFrame, Series, MultiIndex, Timestamp,
                    date_range)
import pandas.core.common as com
import pandas.io.formats.printing as printing
import pandas as pd

from pandas.util.testing import (assert_numpy_array_equal,
                                 assert_series_equal,
                                 assert_frame_equal)

import pandas.util.testing as tm

from pandas.tests.frame.common import (TestData, _check_mixed_float,
                                       _check_mixed_int)


class TestDataFrameOperators(TestData):

    def test_operators(self):
        garbage = random.random(4)
        colSeries = Series(garbage, index=np.array(self.frame.columns))

        idSum = self.frame + self.frame
        seriesSum = self.frame + colSeries

        for col, series in compat.iteritems(idSum):
            for idx, val in compat.iteritems(series):
                origVal = self.frame[col][idx] * 2
                if not np.isnan(val):
                    assert val == origVal
                else:
                    assert np.isnan(origVal)

        for col, series in compat.iteritems(seriesSum):
            for idx, val in compat.iteritems(series):
                origVal = self.frame[col][idx] + colSeries[col]
                if not np.isnan(val):
                    assert val == origVal
                else:
                    assert np.isnan(origVal)

        added = self.frame2 + self.frame2
        expected = self.frame2 * 2
        assert_frame_equal(added, expected)

        df = DataFrame({'a': ['a', None, 'b']})
        assert_frame_equal(df + df, DataFrame({'a': ['aa', np.nan, 'bb']}))

        # Test for issue #10181
        for dtype in ('float', 'int64'):
            frames = [
                DataFrame(dtype=dtype),
                DataFrame(columns=['A'], dtype=dtype),
                DataFrame(index=[0], dtype=dtype),
            ]
            for df in frames:
                assert (df + df).equals(df)
                assert_frame_equal(df + df, df)

    def test_ops_np_scalar(self):
        vals, xs = np.random.rand(5, 3), [nan, 7, -23, 2.718, -3.14, np.inf]
        f = lambda x: DataFrame(x, index=list('ABCDE'),
                                columns=['jim', 'joe', 'jolie'])

        df = f(vals)

        for x in xs:
            assert_frame_equal(df / np.array(x), f(vals / x))
            assert_frame_equal(np.array(x) * df, f(vals * x))
            assert_frame_equal(df + np.array(x), f(vals + x))
            assert_frame_equal(np.array(x) - df, f(x - vals))

    def test_operators_boolean(self):

        # GH 5808
        # empty frames, non-mixed dtype

        result = DataFrame(index=[1]) & DataFrame(index=[1])
        assert_frame_equal(result, DataFrame(index=[1]))

        result = DataFrame(index=[1]) | DataFrame(index=[1])
        assert_frame_equal(result, DataFrame(index=[1]))

        result = DataFrame(index=[1]) & DataFrame(index=[1, 2])
        assert_frame_equal(result, DataFrame(index=[1, 2]))

        result = DataFrame(index=[1], columns=['A']) & DataFrame(
            index=[1], columns=['A'])
        assert_frame_equal(result, DataFrame(index=[1], columns=['A']))

        result = DataFrame(True, index=[1], columns=['A']) & DataFrame(
            True, index=[1], columns=['A'])
        assert_frame_equal(result, DataFrame(True, index=[1], columns=['A']))

        result = DataFrame(True, index=[1], columns=['A']) | DataFrame(
            True, index=[1], columns=['A'])
        assert_frame_equal(result, DataFrame(True, index=[1], columns=['A']))

        # boolean ops
        result = DataFrame(1, index=[1], columns=['A']) | DataFrame(
            True, index=[1], columns=['A'])
        assert_frame_equal(result, DataFrame(1, index=[1], columns=['A']))

        def f():
            DataFrame(1.0, index=[1], columns=['A']) | DataFrame(
                True, index=[1], columns=['A'])
        pytest.raises(TypeError, f)

        def f():
            DataFrame('foo', index=[1], columns=['A']) | DataFrame(
                True, index=[1], columns=['A'])
        pytest.raises(TypeError, f)

    def test_operators_none_as_na(self):
        df = DataFrame({"col1": [2, 5.0, 123, None],
                        "col2": [1, 2, 3, 4]}, dtype=object)

        ops = [operator.add, operator.sub, operator.mul, operator.truediv]

        # since filling converts dtypes from object, changed expected to be
        # object
        for op in ops:
            filled = df.fillna(np.nan)
            result = op(df, 3)
            expected = op(filled, 3).astype(object)
            expected[com.isnull(expected)] = None
            assert_frame_equal(result, expected)

            result = op(df, df)
            expected = op(filled, filled).astype(object)
            expected[com.isnull(expected)] = None
            assert_frame_equal(result, expected)

            result = op(df, df.fillna(7))
            assert_frame_equal(result, expected)

            result = op(df.fillna(7), df)
            assert_frame_equal(result, expected, check_dtype=False)

    def test_comparison_invalid(self):

        def check(df, df2):

            for (x, y) in [(df, df2), (df2, df)]:
                pytest.raises(TypeError, lambda: x == y)
                pytest.raises(TypeError, lambda: x != y)
                pytest.raises(TypeError, lambda: x >= y)
                pytest.raises(TypeError, lambda: x > y)
                pytest.raises(TypeError, lambda: x < y)
                pytest.raises(TypeError, lambda: x <= y)

        # GH4968
        # invalid date/int comparisons
        df = DataFrame(np.random.randint(10, size=(10, 1)), columns=['a'])
        df['dates'] = date_range('20010101', periods=len(df))

        df2 = df.copy()
        df2['dates'] = df['a']
        check(df, df2)

        df = DataFrame(np.random.randint(10, size=(10, 2)), columns=['a', 'b'])
        df2 = DataFrame({'a': date_range('20010101', periods=len(
            df)), 'b': date_range('20100101', periods=len(df))})
        check(df, df2)

    def test_timestamp_compare(self):
        # make sure we can compare Timestamps on the right AND left hand side
        # GH4982
        df = DataFrame({'dates1': date_range('20010101', periods=10),
                        'dates2': date_range('20010102', periods=10),
                        'intcol': np.random.randint(1000000000, size=10),
                        'floatcol': np.random.randn(10),
                        'stringcol': list(tm.rands(10))})
        df.loc[np.random.rand(len(df)) > 0.5, 'dates2'] = pd.NaT
        ops = {'gt': 'lt', 'lt': 'gt', 'ge': 'le', 'le': 'ge', 'eq': 'eq',
               'ne': 'ne'}
        for left, right in ops.items():
            left_f = getattr(operator, left)
            right_f = getattr(operator, right)

            # no nats
            expected = left_f(df, Timestamp('20010109'))
            result = right_f(Timestamp('20010109'), df)
            assert_frame_equal(result, expected)

            # nats
            expected = left_f(df, Timestamp('nat'))
            result = right_f(Timestamp('nat'), df)
            assert_frame_equal(result, expected)

    def test_modulo(self):
        # GH3590, modulo as ints
        p = DataFrame({'first': [3, 4, 5, 8], 'second': [0, 0, 0, 3]})

        # this is technically wrong as the integer portion is coerced to float
        # ###
        expected = DataFrame({'first': Series([0, 0, 0, 0], dtype='float64'),
                              'second': Series([np.nan, np.nan, np.nan, 0])})
        result = p % p
        assert_frame_equal(result, expected)

        # numpy has a slightly different (wrong) treatement
        with np.errstate(all='ignore'):
            arr = p.values % p.values
        result2 = DataFrame(arr, index=p.index,
                            columns=p.columns, dtype='float64')
        result2.iloc[0:3, 1] = np.nan
        assert_frame_equal(result2, expected)

        result = p % 0
        expected = DataFrame(np.nan, index=p.index, columns=p.columns)
        assert_frame_equal(result, expected)

        # numpy has a slightly different (wrong) treatement
        with np.errstate(all='ignore'):
            arr = p.values.astype('float64') % 0
        result2 = DataFrame(arr, index=p.index, columns=p.columns)
        assert_frame_equal(result2, expected)

        # not commutative with series
        p = DataFrame(np.random.randn(10, 5))
        s = p[0]
        res = s % p
        res2 = p % s
        assert not np.array_equal(res.fillna(0), res2.fillna(0))

    def test_div(self):

        # integer div, but deal with the 0's (GH 9144)
        p = DataFrame({'first': [3, 4, 5, 8], 'second': [0, 0, 0, 3]})
        result = p / p

        expected = DataFrame({'first': Series([1.0, 1.0, 1.0, 1.0]),
                              'second': Series([nan, nan, nan, 1])})
        assert_frame_equal(result, expected)

        with np.errstate(all='ignore'):
            arr = p.values.astype('float') / p.values
        result2 = DataFrame(arr, index=p.index,
                            columns=p.columns)
        assert_frame_equal(result2, expected)

        result = p / 0
        expected = DataFrame(np.inf, index=p.index, columns=p.columns)
        expected.iloc[0:3, 1] = nan
        assert_frame_equal(result, expected)

        # numpy has a slightly different (wrong) treatement
        with np.errstate(all='ignore'):
            arr = p.values.astype('float64') / 0
        result2 = DataFrame(arr, index=p.index,
                            columns=p.columns)
        assert_frame_equal(result2, expected)

        p = DataFrame(np.random.randn(10, 5))
        s = p[0]
        res = s / p
        res2 = p / s
        assert not np.array_equal(res.fillna(0), res2.fillna(0))

    def test_logical_operators(self):

        def _check_bin_op(op):
            result = op(df1, df2)
            expected = DataFrame(op(df1.values, df2.values), index=df1.index,
                                 columns=df1.columns)
            assert result.values.dtype == np.bool_
            assert_frame_equal(result, expected)

        def _check_unary_op(op):
            result = op(df1)
            expected = DataFrame(op(df1.values), index=df1.index,
                                 columns=df1.columns)
            assert result.values.dtype == np.bool_
            assert_frame_equal(result, expected)

        df1 = {'a': {'a': True, 'b': False, 'c': False, 'd': True, 'e': True},
               'b': {'a': False, 'b': True, 'c': False,
                     'd': False, 'e': False},
               'c': {'a': False, 'b': False, 'c': True,
                     'd': False, 'e': False},
               'd': {'a': True, 'b': False, 'c': False, 'd': True, 'e': True},
               'e': {'a': True, 'b': False, 'c': False, 'd': True, 'e': True}}

        df2 = {'a': {'a': True, 'b': False, 'c': True, 'd': False, 'e': False},
               'b': {'a': False, 'b': True, 'c': False,
                     'd': False, 'e': False},
               'c': {'a': True, 'b': False, 'c': True, 'd': False, 'e': False},
               'd': {'a': False, 'b': False, 'c': False,
                     'd': True, 'e': False},
               'e': {'a': False, 'b': False, 'c': False,
                     'd': False, 'e': True}}

        df1 = DataFrame(df1)
        df2 = DataFrame(df2)

        _check_bin_op(operator.and_)
        _check_bin_op(operator.or_)
        _check_bin_op(operator.xor)

        # operator.neg is deprecated in numpy >= 1.9
        _check_unary_op(operator.inv)

    def test_logical_typeerror(self):
        if not compat.PY3:
            pytest.raises(TypeError, self.frame.__eq__, 'foo')
            pytest.raises(TypeError, self.frame.__lt__, 'foo')
            pytest.raises(TypeError, self.frame.__gt__, 'foo')
            pytest.raises(TypeError, self.frame.__ne__, 'foo')
        else:
            pytest.skip('test_logical_typeerror not tested on PY3')

    def test_logical_with_nas(self):
        d = DataFrame({'a': [np.nan, False], 'b': [True, True]})

        # GH4947
        # bool comparisons should return bool
        result = d['a'] | d['b']
        expected = Series([False, True])
        assert_series_equal(result, expected)

        # GH4604, automatic casting here
        result = d['a'].fillna(False) | d['b']
        expected = Series([True, True])
        assert_series_equal(result, expected)

        result = d['a'].fillna(False, downcast=False) | d['b']
        expected = Series([True, True])
        assert_series_equal(result, expected)

    def test_neg(self):
        # what to do?
        assert_frame_equal(-self.frame, -1 * self.frame)

    def test_invert(self):
        assert_frame_equal(-(self.frame < 0), ~(self.frame < 0))

    def test_arith_flex_frame(self):
        ops = ['add', 'sub', 'mul', 'div', 'truediv', 'pow', 'floordiv', 'mod']
        if not compat.PY3:
            aliases = {}
        else:
            aliases = {'div': 'truediv'}

        for op in ops:
            try:
                alias = aliases.get(op, op)
                f = getattr(operator, alias)
                result = getattr(self.frame, op)(2 * self.frame)
                exp = f(self.frame, 2 * self.frame)
                assert_frame_equal(result, exp)

                # vs mix float
                result = getattr(self.mixed_float, op)(2 * self.mixed_float)
                exp = f(self.mixed_float, 2 * self.mixed_float)
                assert_frame_equal(result, exp)
                _check_mixed_float(result, dtype=dict(C=None))

                # vs mix int
                if op in ['add', 'sub', 'mul']:
                    result = getattr(self.mixed_int, op)(2 + self.mixed_int)
                    exp = f(self.mixed_int, 2 + self.mixed_int)

                    # no overflow in the uint
                    dtype = None
                    if op in ['sub']:
                        dtype = dict(B='uint64', C=None)
                    elif op in ['add', 'mul']:
                        dtype = dict(C=None)
                    assert_frame_equal(result, exp)
                    _check_mixed_int(result, dtype=dtype)

                    # rops
                    r_f = lambda x, y: f(y, x)
                    result = getattr(self.frame, 'r' + op)(2 * self.frame)
                    exp = r_f(self.frame, 2 * self.frame)
                    assert_frame_equal(result, exp)

                    # vs mix float
                    result = getattr(self.mixed_float, op)(
                        2 * self.mixed_float)
                    exp = f(self.mixed_float, 2 * self.mixed_float)
                    assert_frame_equal(result, exp)
                    _check_mixed_float(result, dtype=dict(C=None))

                    result = getattr(self.intframe, op)(2 * self.intframe)
                    exp = f(self.intframe, 2 * self.intframe)
                    assert_frame_equal(result, exp)

                    # vs mix int
                    if op in ['add', 'sub', 'mul']:
                        result = getattr(self.mixed_int, op)(
                            2 + self.mixed_int)
                        exp = f(self.mixed_int, 2 + self.mixed_int)

                        # no overflow in the uint
                        dtype = None
                        if op in ['sub']:
                            dtype = dict(B='uint64', C=None)
                        elif op in ['add', 'mul']:
                            dtype = dict(C=None)
                        assert_frame_equal(result, exp)
                        _check_mixed_int(result, dtype=dtype)
            except:
                printing.pprint_thing("Failing operation %r" % op)
                raise

            # ndim >= 3
            ndim_5 = np.ones(self.frame.shape + (3, 4, 5))
            msg = "Unable to coerce to Series/DataFrame"
            with tm.assert_raises_regex(ValueError, msg):
                f(self.frame, ndim_5)

            with tm.assert_raises_regex(ValueError, msg):
                getattr(self.frame, op)(ndim_5)

        # res_add = self.frame.add(self.frame)
        # res_sub = self.frame.sub(self.frame)
        # res_mul = self.frame.mul(self.frame)
        # res_div = self.frame.div(2 * self.frame)

        # assert_frame_equal(res_add, self.frame + self.frame)
        # assert_frame_equal(res_sub, self.frame - self.frame)
        # assert_frame_equal(res_mul, self.frame * self.frame)
        # assert_frame_equal(res_div, self.frame / (2 * self.frame))

        const_add = self.frame.add(1)
        assert_frame_equal(const_add, self.frame + 1)

        # corner cases
        result = self.frame.add(self.frame[:0])
        assert_frame_equal(result, self.frame * np.nan)

        result = self.frame[:0].add(self.frame)
        assert_frame_equal(result, self.frame * np.nan)
        with tm.assert_raises_regex(NotImplementedError, 'fill_value'):
            self.frame.add(self.frame.iloc[0], fill_value=3)
        with tm.assert_raises_regex(NotImplementedError, 'fill_value'):
            self.frame.add(self.frame.iloc[0], axis='index', fill_value=3)

    def test_binary_ops_align(self):

        # test aligning binary ops

        # GH 6681
        index = MultiIndex.from_product([list('abc'),
                                         ['one', 'two', 'three'],
                                         [1, 2, 3]],
                                        names=['first', 'second', 'third'])

        df = DataFrame(np.arange(27 * 3).reshape(27, 3),
                       index=index,
                       columns=['value1', 'value2', 'value3']).sort_index()

        idx = pd.IndexSlice
        for op in ['add', 'sub', 'mul', 'div', 'truediv']:
            opa = getattr(operator, op, None)
            if opa is None:
                continue

            x = Series([1.0, 10.0, 100.0], [1, 2, 3])
            result = getattr(df, op)(x, level='third', axis=0)

            expected = pd.concat([opa(df.loc[idx[:, :, i], :], v)
                                  for i, v in x.iteritems()]).sort_index()
            assert_frame_equal(result, expected)

            x = Series([1.0, 10.0], ['two', 'three'])
            result = getattr(df, op)(x, level='second', axis=0)

            expected = (pd.concat([opa(df.loc[idx[:, i], :], v)
                                   for i, v in x.iteritems()])
                        .reindex_like(df).sort_index())
            assert_frame_equal(result, expected)

        # GH9463 (alignment level of dataframe with series)

        midx = MultiIndex.from_product([['A', 'B'], ['a', 'b']])
        df = DataFrame(np.ones((2, 4), dtype='int64'), columns=midx)
        s = pd.Series({'a': 1, 'b': 2})

        df2 = df.copy()
        df2.columns.names = ['lvl0', 'lvl1']
        s2 = s.copy()
        s2.index.name = 'lvl1'

        # different cases of integer/string level names:
        res1 = df.mul(s, axis=1, level=1)
        res2 = df.mul(s2, axis=1, level=1)
        res3 = df2.mul(s, axis=1, level=1)
        res4 = df2.mul(s2, axis=1, level=1)
        res5 = df2.mul(s, axis=1, level='lvl1')
        res6 = df2.mul(s2, axis=1, level='lvl1')

        exp = DataFrame(np.array([[1, 2, 1, 2], [1, 2, 1, 2]], dtype='int64'),
                        columns=midx)

        for res in [res1, res2]:
            assert_frame_equal(res, exp)

        exp.columns.names = ['lvl0', 'lvl1']
        for res in [res3, res4, res5, res6]:
            assert_frame_equal(res, exp)

    def test_arith_mixed(self):

        left = DataFrame({'A': ['a', 'b', 'c'],
                          'B': [1, 2, 3]})

        result = left + left
        expected = DataFrame({'A': ['aa', 'bb', 'cc'],
                              'B': [2, 4, 6]})
        assert_frame_equal(result, expected)

    def test_arith_getitem_commute(self):
        df = DataFrame({'A': [1.1, 3.3], 'B': [2.5, -3.9]})

        self._test_op(df, operator.add)
        self._test_op(df, operator.sub)
        self._test_op(df, operator.mul)
        self._test_op(df, operator.truediv)
        self._test_op(df, operator.floordiv)
        self._test_op(df, operator.pow)

        self._test_op(df, lambda x, y: y + x)
        self._test_op(df, lambda x, y: y - x)
        self._test_op(df, lambda x, y: y * x)
        self._test_op(df, lambda x, y: y / x)
        self._test_op(df, lambda x, y: y ** x)

        self._test_op(df, lambda x, y: x + y)
        self._test_op(df, lambda x, y: x - y)
        self._test_op(df, lambda x, y: x * y)
        self._test_op(df, lambda x, y: x / y)
        self._test_op(df, lambda x, y: x ** y)

    @staticmethod
    def _test_op(df, op):
        result = op(df, 1)

        if not df.columns.is_unique:
            raise ValueError("Only unique columns supported by this test")

        for col in result.columns:
            assert_series_equal(result[col], op(df[col], 1))

    def test_bool_flex_frame(self):
        data = np.random.randn(5, 3)
        other_data = np.random.randn(5, 3)
        df = DataFrame(data)
        other = DataFrame(other_data)
        ndim_5 = np.ones(df.shape + (1, 3))

        # Unaligned
        def _check_unaligned_frame(meth, op, df, other):
            part_o = other.loc[3:, 1:].copy()
            rs = meth(part_o)
            xp = op(df, part_o.reindex(index=df.index, columns=df.columns))
            assert_frame_equal(rs, xp)

        # DataFrame
        assert df.eq(df).values.all()
        assert not df.ne(df).values.any()
        for op in ['eq', 'ne', 'gt', 'lt', 'ge', 'le']:
            f = getattr(df, op)
            o = getattr(operator, op)
            # No NAs
            assert_frame_equal(f(other), o(df, other))
            _check_unaligned_frame(f, o, df, other)
            # ndarray
            assert_frame_equal(f(other.values), o(df, other.values))
            # scalar
            assert_frame_equal(f(0), o(df, 0))
            # NAs
            msg = "Unable to coerce to Series/DataFrame"
            assert_frame_equal(f(np.nan), o(df, np.nan))
            with tm.assert_raises_regex(ValueError, msg):
                f(ndim_5)

        # Series
        def _test_seq(df, idx_ser, col_ser):
            idx_eq = df.eq(idx_ser, axis=0)
            col_eq = df.eq(col_ser)
            idx_ne = df.ne(idx_ser, axis=0)
            col_ne = df.ne(col_ser)
            assert_frame_equal(col_eq, df == Series(col_ser))
            assert_frame_equal(col_eq, -col_ne)
            assert_frame_equal(idx_eq, -idx_ne)
            assert_frame_equal(idx_eq, df.T.eq(idx_ser).T)
            assert_frame_equal(col_eq, df.eq(list(col_ser)))
            assert_frame_equal(idx_eq, df.eq(Series(idx_ser), axis=0))
            assert_frame_equal(idx_eq, df.eq(list(idx_ser), axis=0))

            idx_gt = df.gt(idx_ser, axis=0)
            col_gt = df.gt(col_ser)
            idx_le = df.le(idx_ser, axis=0)
            col_le = df.le(col_ser)

            assert_frame_equal(col_gt, df > Series(col_ser))
            assert_frame_equal(col_gt, -col_le)
            assert_frame_equal(idx_gt, -idx_le)
            assert_frame_equal(idx_gt, df.T.gt(idx_ser).T)

            idx_ge = df.ge(idx_ser, axis=0)
            col_ge = df.ge(col_ser)
            idx_lt = df.lt(idx_ser, axis=0)
            col_lt = df.lt(col_ser)
            assert_frame_equal(col_ge, df >= Series(col_ser))
            assert_frame_equal(col_ge, -col_lt)
            assert_frame_equal(idx_ge, -idx_lt)
            assert_frame_equal(idx_ge, df.T.ge(idx_ser).T)

        idx_ser = Series(np.random.randn(5))
        col_ser = Series(np.random.randn(3))
        _test_seq(df, idx_ser, col_ser)

        # list/tuple
        _test_seq(df, idx_ser.values, col_ser.values)

        # NA
        df.loc[0, 0] = np.nan
        rs = df.eq(df)
        assert not rs.loc[0, 0]
        rs = df.ne(df)
        assert rs.loc[0, 0]
        rs = df.gt(df)
        assert not rs.loc[0, 0]
        rs = df.lt(df)
        assert not rs.loc[0, 0]
        rs = df.ge(df)
        assert not rs.loc[0, 0]
        rs = df.le(df)
        assert not rs.loc[0, 0]

        # complex
        arr = np.array([np.nan, 1, 6, np.nan])
        arr2 = np.array([2j, np.nan, 7, None])
        df = DataFrame({'a': arr})
        df2 = DataFrame({'a': arr2})
        rs = df.gt(df2)
        assert not rs.values.any()
        rs = df.ne(df2)
        assert rs.values.all()

        arr3 = np.array([2j, np.nan, None])
        df3 = DataFrame({'a': arr3})
        rs = df3.gt(2j)
        assert not rs.values.any()

        # corner, dtype=object
        df1 = DataFrame({'col': ['foo', np.nan, 'bar']})
        df2 = DataFrame({'col': ['foo', datetime.now(), 'bar']})
        result = df1.ne(df2)
        exp = DataFrame({'col': [False, True, False]})
        assert_frame_equal(result, exp)

    def test_return_dtypes_bool_op_costant(self):
        # GH15077
        df = DataFrame({'x': [1, 2, 3], 'y': [1., 2., 3.]})
        const = 2

        # not empty DataFrame
        for op in ['eq', 'ne', 'gt', 'lt', 'ge', 'le']:
            result = getattr(df, op)(const).get_dtype_counts()
            tm.assert_series_equal(result, Series([2], ['bool']))

        # empty DataFrame
        empty = df.iloc[:0]
        for op in ['eq', 'ne', 'gt', 'lt', 'ge', 'le']:
            result = getattr(empty, op)(const).get_dtype_counts()
            tm.assert_series_equal(result, Series([2], ['bool']))

    def test_dti_tz_convert_to_utc(self):
        base = pd.DatetimeIndex(['2011-01-01', '2011-01-02',
                                 '2011-01-03'], tz='UTC')
        idx1 = base.tz_convert('Asia/Tokyo')[:2]
        idx2 = base.tz_convert('US/Eastern')[1:]

        df1 = DataFrame({'A': [1, 2]}, index=idx1)
        df2 = DataFrame({'A': [1, 1]}, index=idx2)
        exp = DataFrame({'A': [np.nan, 3, np.nan]}, index=base)
        assert_frame_equal(df1 + df2, exp)

    def test_arith_flex_series(self):
        df = self.simple

        row = df.xs('a')
        col = df['two']
        # after arithmetic refactor, add truediv here
        ops = ['add', 'sub', 'mul', 'mod']
        for op in ops:
            f = getattr(df, op)
            op = getattr(operator, op)
            assert_frame_equal(f(row), op(df, row))
            assert_frame_equal(f(col, axis=0), op(df.T, col).T)

        # special case for some reason
        assert_frame_equal(df.add(row, axis=None), df + row)

        # cases which will be refactored after big arithmetic refactor
        assert_frame_equal(df.div(row), df / row)
        assert_frame_equal(df.div(col, axis=0), (df.T / col).T)

        # broadcasting issue in GH7325
        df = DataFrame(np.arange(3 * 2).reshape((3, 2)), dtype='int64')
        expected = DataFrame([[nan, np.inf], [1.0, 1.5], [1.0, 1.25]])
        result = df.div(df[0], axis='index')
        assert_frame_equal(result, expected)

        df = DataFrame(np.arange(3 * 2).reshape((3, 2)), dtype='float64')
        expected = DataFrame([[np.nan, np.inf], [1.0, 1.5], [1.0, 1.25]])
        result = df.div(df[0], axis='index')
        assert_frame_equal(result, expected)

    def test_arith_non_pandas_object(self):
        df = self.simple

        val1 = df.xs('a').values
        added = DataFrame(df.values + val1, index=df.index, columns=df.columns)
        assert_frame_equal(df + val1, added)

        added = DataFrame((df.values.T + val1).T,
                          index=df.index, columns=df.columns)
        assert_frame_equal(df.add(val1, axis=0), added)

        val2 = list(df['two'])

        added = DataFrame(df.values + val2, index=df.index, columns=df.columns)
        assert_frame_equal(df + val2, added)

        added = DataFrame((df.values.T + val2).T, index=df.index,
                          columns=df.columns)
        assert_frame_equal(df.add(val2, axis='index'), added)

        val3 = np.random.rand(*df.shape)
        added = DataFrame(df.values + val3, index=df.index, columns=df.columns)
        assert_frame_equal(df.add(val3), added)

    def test_combineFrame(self):
        frame_copy = self.frame.reindex(self.frame.index[::2])

        del frame_copy['D']
        frame_copy['C'][:5] = nan

        added = self.frame + frame_copy

        indexer = added['A'].valid().index
        exp = (self.frame['A'] * 2).copy()

        tm.assert_series_equal(added['A'].valid(), exp.loc[indexer])

        exp.loc[~exp.index.isin(indexer)] = np.nan
        tm.assert_series_equal(added['A'], exp.loc[added['A'].index])

        assert np.isnan(added['C'].reindex(frame_copy.index)[:5]).all()

        # assert(False)

        assert np.isnan(added['D']).all()

        self_added = self.frame + self.frame
        tm.assert_index_equal(self_added.index, self.frame.index)

        added_rev = frame_copy + self.frame
        assert np.isnan(added['D']).all()
        assert np.isnan(added_rev['D']).all()

        # corner cases

        # empty
        plus_empty = self.frame + self.empty
        assert np.isnan(plus_empty.values).all()

        empty_plus = self.empty + self.frame
        assert np.isnan(empty_plus.values).all()

        empty_empty = self.empty + self.empty
        assert empty_empty.empty

        # out of order
        reverse = self.frame.reindex(columns=self.frame.columns[::-1])

        assert_frame_equal(reverse + self.frame, self.frame * 2)

        # mix vs float64, upcast
        added = self.frame + self.mixed_float
        _check_mixed_float(added, dtype='float64')
        added = self.mixed_float + self.frame
        _check_mixed_float(added, dtype='float64')

        # mix vs mix
        added = self.mixed_float + self.mixed_float2
        _check_mixed_float(added, dtype=dict(C=None))
        added = self.mixed_float2 + self.mixed_float
        _check_mixed_float(added, dtype=dict(C=None))

        # with int
        added = self.frame + self.mixed_int
        _check_mixed_float(added, dtype='float64')

    def test_combineSeries(self):

        # Series
        series = self.frame.xs(self.frame.index[0])

        added = self.frame + series

        for key, s in compat.iteritems(added):
            assert_series_equal(s, self.frame[key] + series[key])

        larger_series = series.to_dict()
        larger_series['E'] = 1
        larger_series = Series(larger_series)
        larger_added = self.frame + larger_series

        for key, s in compat.iteritems(self.frame):
            assert_series_equal(larger_added[key], s + series[key])
        assert 'E' in larger_added
        assert np.isnan(larger_added['E']).all()

        # vs mix (upcast) as needed
        added = self.mixed_float + series
        _check_mixed_float(added, dtype='float64')
        added = self.mixed_float + series.astype('float32')
        _check_mixed_float(added, dtype=dict(C=None))
        added = self.mixed_float + series.astype('float16')
        _check_mixed_float(added, dtype=dict(C=None))

        # these raise with numexpr.....as we are adding an int64 to an
        # uint64....weird vs int

        # added = self.mixed_int + (100*series).astype('int64')
        # _check_mixed_int(added, dtype = dict(A = 'int64', B = 'float64', C =
        # 'int64', D = 'int64'))
        # added = self.mixed_int + (100*series).astype('int32')
        # _check_mixed_int(added, dtype = dict(A = 'int32', B = 'float64', C =
        # 'int32', D = 'int64'))

        # TimeSeries
        ts = self.tsframe['A']

        # 10890
        # we no longer allow auto timeseries broadcasting
        # and require explict broadcasting
        added = self.tsframe.add(ts, axis='index')

        for key, col in compat.iteritems(self.tsframe):
            result = col + ts
            assert_series_equal(added[key], result, check_names=False)
            assert added[key].name == key
            if col.name == ts.name:
                assert result.name == 'A'
            else:
                assert result.name is None

        smaller_frame = self.tsframe[:-5]
        smaller_added = smaller_frame.add(ts, axis='index')

        tm.assert_index_equal(smaller_added.index, self.tsframe.index)

        smaller_ts = ts[:-5]
        smaller_added2 = self.tsframe.add(smaller_ts, axis='index')
        assert_frame_equal(smaller_added, smaller_added2)

        # length 0, result is all-nan
        result = self.tsframe.add(ts[:0], axis='index')
        expected = DataFrame(np.nan, index=self.tsframe.index,
                             columns=self.tsframe.columns)
        assert_frame_equal(result, expected)

        # Frame is all-nan
        result = self.tsframe[:0].add(ts, axis='index')
        expected = DataFrame(np.nan, index=self.tsframe.index,
                             columns=self.tsframe.columns)
        assert_frame_equal(result, expected)

        # empty but with non-empty index
        frame = self.tsframe[:1].reindex(columns=[])
        result = frame.mul(ts, axis='index')
        assert len(result) == len(ts)

    def test_combineFunc(self):
        result = self.frame * 2
        tm.assert_numpy_array_equal(result.values, self.frame.values * 2)

        # vs mix
        result = self.mixed_float * 2
        for c, s in compat.iteritems(result):
            tm.assert_numpy_array_equal(
                s.values, self.mixed_float[c].values * 2)
        _check_mixed_float(result, dtype=dict(C=None))

        result = self.empty * 2
        assert result.index is self.empty.index
        assert len(result.columns) == 0

    def test_comparisons(self):
        df1 = tm.makeTimeDataFrame()
        df2 = tm.makeTimeDataFrame()

        row = self.simple.xs('a')
        ndim_5 = np.ones(df1.shape + (1, 1, 1))

        def test_comp(func):
            result = func(df1, df2)
            tm.assert_numpy_array_equal(result.values,
                                        func(df1.values, df2.values))
            with tm.assert_raises_regex(ValueError,
                                        'Wrong number of dimensions'):
                func(df1, ndim_5)

            result2 = func(self.simple, row)
            tm.assert_numpy_array_equal(result2.values,
                                        func(self.simple.values, row.values))

            result3 = func(self.frame, 0)
            tm.assert_numpy_array_equal(result3.values,
                                        func(self.frame.values, 0))

            with tm.assert_raises_regex(ValueError,
                                        'Can only compare identically'
                                        '-labeled DataFrame'):
                func(self.simple, self.simple[:2])

        test_comp(operator.eq)
        test_comp(operator.ne)
        test_comp(operator.lt)
        test_comp(operator.gt)
        test_comp(operator.ge)
        test_comp(operator.le)

    def test_comparison_protected_from_errstate(self):
        missing_df = tm.makeDataFrame()
        missing_df.iloc[0]['A'] = np.nan
        with np.errstate(invalid='ignore'):
            expected = missing_df.values < 0
        with np.errstate(invalid='raise'):
            result = (missing_df < 0).values
        tm.assert_numpy_array_equal(result, expected)

    def test_string_comparison(self):
        df = DataFrame([{"a": 1, "b": "foo"}, {"a": 2, "b": "bar"}])
        mask_a = df.a > 1
        assert_frame_equal(df[mask_a], df.loc[1:1, :])
        assert_frame_equal(df[-mask_a], df.loc[0:0, :])

        mask_b = df.b == "foo"
        assert_frame_equal(df[mask_b], df.loc[0:0, :])
        assert_frame_equal(df[-mask_b], df.loc[1:1, :])

    def test_float_none_comparison(self):
        df = DataFrame(np.random.randn(8, 3), index=lrange(8),
                       columns=['A', 'B', 'C'])

        pytest.raises(TypeError, df.__eq__, None)

    def test_boolean_comparison(self):

        # GH 4576
        # boolean comparisons with a tuple/list give unexpected results
        df = DataFrame(np.arange(6).reshape((3, 2)))
        b = np.array([2, 2])
        b_r = np.atleast_2d([2, 2])
        b_c = b_r.T
        l = (2, 2, 2)
        tup = tuple(l)

        # gt
        expected = DataFrame([[False, False], [False, True], [True, True]])
        result = df > b
        assert_frame_equal(result, expected)

        result = df.values > b
        assert_numpy_array_equal(result, expected.values)

        result = df > l
        assert_frame_equal(result, expected)

        result = df > tup
        assert_frame_equal(result, expected)

        result = df > b_r
        assert_frame_equal(result, expected)

        result = df.values > b_r
        assert_numpy_array_equal(result, expected.values)

        pytest.raises(ValueError, df.__gt__, b_c)
        pytest.raises(ValueError, df.values.__gt__, b_c)

        # ==
        expected = DataFrame([[False, False], [True, False], [False, False]])
        result = df == b
        assert_frame_equal(result, expected)

        result = df == l
        assert_frame_equal(result, expected)

        result = df == tup
        assert_frame_equal(result, expected)

        result = df == b_r
        assert_frame_equal(result, expected)

        result = df.values == b_r
        assert_numpy_array_equal(result, expected.values)

        pytest.raises(ValueError, lambda: df == b_c)
        assert not np.array_equal(df.values, b_c)

        # with alignment
        df = DataFrame(np.arange(6).reshape((3, 2)),
                       columns=list('AB'), index=list('abc'))
        expected.index = df.index
        expected.columns = df.columns

        result = df == l
        assert_frame_equal(result, expected)

        result = df == tup
        assert_frame_equal(result, expected)

        # not shape compatible
        pytest.raises(ValueError, lambda: df == (2, 2))
        pytest.raises(ValueError, lambda: df == [2, 2])

    def test_combine_generic(self):
        df1 = self.frame
        df2 = self.frame.loc[self.frame.index[:-5], ['A', 'B', 'C']]

        combined = df1.combine(df2, np.add)
        combined2 = df2.combine(df1, np.add)
        assert combined['D'].isnull().all()
        assert combined2['D'].isnull().all()

        chunk = combined.loc[combined.index[:-5], ['A', 'B', 'C']]
        chunk2 = combined2.loc[combined2.index[:-5], ['A', 'B', 'C']]

        exp = self.frame.loc[self.frame.index[:-5],
                             ['A', 'B', 'C']].reindex_like(chunk) * 2
        assert_frame_equal(chunk, exp)
        assert_frame_equal(chunk2, exp)

    def test_inplace_ops_alignment(self):

        # inplace ops / ops alignment
        # GH 8511

        columns = list('abcdefg')
        X_orig = DataFrame(np.arange(10 * len(columns))
                           .reshape(-1, len(columns)),
                           columns=columns, index=range(10))
        Z = 100 * X_orig.iloc[:, 1:-1].copy()
        block1 = list('bedcf')
        subs = list('bcdef')

        # add
        X = X_orig.copy()
        result1 = (X[block1] + Z).reindex(columns=subs)

        X[block1] += Z
        result2 = X.reindex(columns=subs)

        X = X_orig.copy()
        result3 = (X[block1] + Z[block1]).reindex(columns=subs)

        X[block1] += Z[block1]
        result4 = X.reindex(columns=subs)

        assert_frame_equal(result1, result2)
        assert_frame_equal(result1, result3)
        assert_frame_equal(result1, result4)

        # sub
        X = X_orig.copy()
        result1 = (X[block1] - Z).reindex(columns=subs)

        X[block1] -= Z
        result2 = X.reindex(columns=subs)

        X = X_orig.copy()
        result3 = (X[block1] - Z[block1]).reindex(columns=subs)

        X[block1] -= Z[block1]
        result4 = X.reindex(columns=subs)

        assert_frame_equal(result1, result2)
        assert_frame_equal(result1, result3)
        assert_frame_equal(result1, result4)

    def test_inplace_ops_identity(self):

        # GH 5104
        # make sure that we are actually changing the object
        s_orig = Series([1, 2, 3])
        df_orig = DataFrame(np.random.randint(0, 5, size=10).reshape(-1, 5))

        # no dtype change
        s = s_orig.copy()
        s2 = s
        s += 1
        assert_series_equal(s, s2)
        assert_series_equal(s_orig + 1, s)
        assert s is s2
        assert s._data is s2._data

        df = df_orig.copy()
        df2 = df
        df += 1
        assert_frame_equal(df, df2)
        assert_frame_equal(df_orig + 1, df)
        assert df is df2
        assert df._data is df2._data

        # dtype change
        s = s_orig.copy()
        s2 = s
        s += 1.5
        assert_series_equal(s, s2)
        assert_series_equal(s_orig + 1.5, s)

        df = df_orig.copy()
        df2 = df
        df += 1.5
        assert_frame_equal(df, df2)
        assert_frame_equal(df_orig + 1.5, df)
        assert df is df2
        assert df._data is df2._data

        # mixed dtype
        arr = np.random.randint(0, 10, size=5)
        df_orig = DataFrame({'A': arr.copy(), 'B': 'foo'})
        df = df_orig.copy()
        df2 = df
        df['A'] += 1
        expected = DataFrame({'A': arr.copy() + 1, 'B': 'foo'})
        assert_frame_equal(df, expected)
        assert_frame_equal(df2, expected)
        assert df._data is df2._data

        df = df_orig.copy()
        df2 = df
        df['A'] += 1.5
        expected = DataFrame({'A': arr.copy() + 1.5, 'B': 'foo'})
        assert_frame_equal(df, expected)
        assert_frame_equal(df2, expected)
        assert df._data is df2._data

    def test_alignment_non_pandas(self):
        index = ['A', 'B', 'C']
        columns = ['X', 'Y', 'Z']
        df = pd.DataFrame(np.random.randn(3, 3), index=index, columns=columns)

        align = pd.core.ops._align_method_FRAME

        for val in [[1, 2, 3], (1, 2, 3), np.array([1, 2, 3], dtype=np.int64)]:

            tm.assert_series_equal(align(df, val, 'index'),
                                   Series([1, 2, 3], index=df.index))
            tm.assert_series_equal(align(df, val, 'columns'),
                                   Series([1, 2, 3], index=df.columns))

        # length mismatch
        msg = 'Unable to coerce to Series, length must be 3: given 2'
        for val in [[1, 2], (1, 2), np.array([1, 2])]:
            with tm.assert_raises_regex(ValueError, msg):
                align(df, val, 'index')

            with tm.assert_raises_regex(ValueError, msg):
                align(df, val, 'columns')

        val = np.array([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        tm.assert_frame_equal(align(df, val, 'index'),
                              DataFrame(val, index=df.index,
                                        columns=df.columns))
        tm.assert_frame_equal(align(df, val, 'columns'),
                              DataFrame(val, index=df.index,
                                        columns=df.columns))

        # shape mismatch
        msg = 'Unable to coerce to DataFrame, shape must be'
        val = np.array([[1, 2, 3], [4, 5, 6]])
        with tm.assert_raises_regex(ValueError, msg):
            align(df, val, 'index')

        with tm.assert_raises_regex(ValueError, msg):
            align(df, val, 'columns')

        val = np.zeros((3, 3, 3))
        with pytest.raises(ValueError):
            align(df, val, 'index')
        with pytest.raises(ValueError):
            align(df, val, 'columns')
