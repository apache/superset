from itertools import product
import pytest
import sys
import warnings
from warnings import catch_warnings

from datetime import datetime, timedelta
from numpy.random import randn
import numpy as np
from distutils.version import LooseVersion

import pandas as pd
from pandas import (Series, DataFrame, bdate_range, isnull,
                    notnull, concat, Timestamp, Index)
import pandas.stats.moments as mom
import pandas.core.window as rwindow
import pandas.tseries.offsets as offsets
from pandas.core.base import SpecificationError
from pandas.errors import UnsupportedFunctionCall
import pandas.util.testing as tm
from pandas.compat import range, zip, PY3

N, K = 100, 10


def assert_equal(left, right):
    if isinstance(left, Series):
        tm.assert_series_equal(left, right)
    else:
        tm.assert_frame_equal(left, right)


class Base(object):

    _nan_locs = np.arange(20, 40)
    _inf_locs = np.array([])

    def _create_data(self):
        arr = randn(N)
        arr[self._nan_locs] = np.NaN

        self.arr = arr
        self.rng = bdate_range(datetime(2009, 1, 1), periods=N)
        self.series = Series(arr.copy(), index=self.rng)
        self.frame = DataFrame(randn(N, K), index=self.rng,
                               columns=np.arange(K))


class TestApi(Base):

    def setup_method(self, method):
        self._create_data()

    def test_getitem(self):

        r = self.frame.rolling(window=5)
        tm.assert_index_equal(r._selected_obj.columns, self.frame.columns)

        r = self.frame.rolling(window=5)[1]
        assert r._selected_obj.name == self.frame.columns[1]

        # technically this is allowed
        r = self.frame.rolling(window=5)[1, 3]
        tm.assert_index_equal(r._selected_obj.columns,
                              self.frame.columns[[1, 3]])

        r = self.frame.rolling(window=5)[[1, 3]]
        tm.assert_index_equal(r._selected_obj.columns,
                              self.frame.columns[[1, 3]])

    def test_select_bad_cols(self):
        df = DataFrame([[1, 2]], columns=['A', 'B'])
        g = df.rolling(window=5)
        pytest.raises(KeyError, g.__getitem__, ['C'])  # g[['C']]

        pytest.raises(KeyError, g.__getitem__, ['A', 'C'])  # g[['A', 'C']]
        with tm.assert_raises_regex(KeyError, '^[^A]+$'):
            # A should not be referenced as a bad column...
            # will have to rethink regex if you change message!
            g[['A', 'C']]

    def test_attribute_access(self):

        df = DataFrame([[1, 2]], columns=['A', 'B'])
        r = df.rolling(window=5)
        tm.assert_series_equal(r.A.sum(), r['A'].sum())
        pytest.raises(AttributeError, lambda: r.F)

    def tests_skip_nuisance(self):

        df = DataFrame({'A': range(5), 'B': range(5, 10), 'C': 'foo'})

        r = df.rolling(window=3)
        result = r[['A', 'B']].sum()
        expected = DataFrame({'A': [np.nan, np.nan, 3, 6, 9],
                              'B': [np.nan, np.nan, 18, 21, 24]},
                             columns=list('AB'))
        tm.assert_frame_equal(result, expected)

        expected = pd.concat([r[['A', 'B']].sum(), df[['C']]], axis=1)
        result = r.sum()
        tm.assert_frame_equal(result, expected, check_like=True)

    def test_agg(self):
        df = DataFrame({'A': range(5), 'B': range(0, 10, 2)})

        r = df.rolling(window=3)
        a_mean = r['A'].mean()
        a_std = r['A'].std()
        a_sum = r['A'].sum()
        b_mean = r['B'].mean()
        b_std = r['B'].std()
        b_sum = r['B'].sum()

        result = r.aggregate([np.mean, np.std])
        expected = pd.concat([a_mean, a_std, b_mean, b_std], axis=1)
        expected.columns = pd.MultiIndex.from_product([['A', 'B'], ['mean',
                                                                    'std']])
        tm.assert_frame_equal(result, expected)

        result = r.aggregate({'A': np.mean, 'B': np.std})

        expected = pd.concat([a_mean, b_std], axis=1)
        tm.assert_frame_equal(result, expected, check_like=True)

        result = r.aggregate({'A': ['mean', 'std']})
        expected = pd.concat([a_mean, a_std], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'mean'), ('A',
                                                                      'std')])
        tm.assert_frame_equal(result, expected)

        result = r['A'].aggregate(['mean', 'sum'])
        expected = pd.concat([a_mean, a_sum], axis=1)
        expected.columns = ['mean', 'sum']
        tm.assert_frame_equal(result, expected)

        with catch_warnings(record=True):
            result = r.aggregate({'A': {'mean': 'mean', 'sum': 'sum'}})
        expected = pd.concat([a_mean, a_sum], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'mean'),
                                                      ('A', 'sum')])
        tm.assert_frame_equal(result, expected, check_like=True)

        with catch_warnings(record=True):
            result = r.aggregate({'A': {'mean': 'mean',
                                        'sum': 'sum'},
                                  'B': {'mean2': 'mean',
                                        'sum2': 'sum'}})
        expected = pd.concat([a_mean, a_sum, b_mean, b_sum], axis=1)
        exp_cols = [('A', 'mean'), ('A', 'sum'), ('B', 'mean2'), ('B', 'sum2')]
        expected.columns = pd.MultiIndex.from_tuples(exp_cols)
        tm.assert_frame_equal(result, expected, check_like=True)

        result = r.aggregate({'A': ['mean', 'std'], 'B': ['mean', 'std']})
        expected = pd.concat([a_mean, a_std, b_mean, b_std], axis=1)

        exp_cols = [('A', 'mean'), ('A', 'std'), ('B', 'mean'), ('B', 'std')]
        expected.columns = pd.MultiIndex.from_tuples(exp_cols)
        tm.assert_frame_equal(result, expected, check_like=True)

        # passed lambda
        result = r.agg({'A': np.sum, 'B': lambda x: np.std(x, ddof=1)})
        rcustom = r['B'].apply(lambda x: np.std(x, ddof=1))
        expected = pd.concat([a_sum, rcustom], axis=1)
        tm.assert_frame_equal(result, expected, check_like=True)

    def test_agg_consistency(self):

        df = DataFrame({'A': range(5), 'B': range(0, 10, 2)})
        r = df.rolling(window=3)

        result = r.agg([np.sum, np.mean]).columns
        expected = pd.MultiIndex.from_product([list('AB'), ['sum', 'mean']])
        tm.assert_index_equal(result, expected)

        result = r['A'].agg([np.sum, np.mean]).columns
        expected = Index(['sum', 'mean'])
        tm.assert_index_equal(result, expected)

        result = r.agg({'A': [np.sum, np.mean]}).columns
        expected = pd.MultiIndex.from_tuples([('A', 'sum'), ('A', 'mean')])
        tm.assert_index_equal(result, expected)

    def test_agg_nested_dicts(self):

        # API change for disallowing these types of nested dicts
        df = DataFrame({'A': range(5), 'B': range(0, 10, 2)})
        r = df.rolling(window=3)

        def f():
            r.aggregate({'r1': {'A': ['mean', 'sum']},
                         'r2': {'B': ['mean', 'sum']}})

        pytest.raises(SpecificationError, f)

        expected = pd.concat([r['A'].mean(), r['A'].std(), r['B'].mean(),
                              r['B'].std()], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('ra', 'mean'), (
            'ra', 'std'), ('rb', 'mean'), ('rb', 'std')])
        with catch_warnings(record=True):
            result = r[['A', 'B']].agg({'A': {'ra': ['mean', 'std']},
                                        'B': {'rb': ['mean', 'std']}})
        tm.assert_frame_equal(result, expected, check_like=True)

        with catch_warnings(record=True):
            result = r.agg({'A': {'ra': ['mean', 'std']},
                            'B': {'rb': ['mean', 'std']}})
        expected.columns = pd.MultiIndex.from_tuples([('A', 'ra', 'mean'), (
            'A', 'ra', 'std'), ('B', 'rb', 'mean'), ('B', 'rb', 'std')])
        tm.assert_frame_equal(result, expected, check_like=True)

    def test_count_nonnumeric_types(self):
        # GH12541
        cols = ['int', 'float', 'string', 'datetime', 'timedelta', 'periods',
                'fl_inf', 'fl_nan', 'str_nan', 'dt_nat', 'periods_nat']

        df = DataFrame(
            {'int': [1, 2, 3],
             'float': [4., 5., 6.],
             'string': list('abc'),
             'datetime': pd.date_range('20170101', periods=3),
             'timedelta': pd.timedelta_range('1 s', periods=3, freq='s'),
             'periods': [pd.Period('2012-01'), pd.Period('2012-02'),
                         pd.Period('2012-03')],
             'fl_inf': [1., 2., np.Inf],
             'fl_nan': [1., 2., np.NaN],
             'str_nan': ['aa', 'bb', np.NaN],
             'dt_nat': [pd.Timestamp('20170101'), pd.Timestamp('20170203'),
                        pd.Timestamp(None)],
             'periods_nat': [pd.Period('2012-01'), pd.Period('2012-02'),
                             pd.Period(None)]},
            columns=cols)

        expected = DataFrame(
            {'int': [1., 2., 2.],
             'float': [1., 2., 2.],
             'string': [1., 2., 2.],
             'datetime': [1., 2., 2.],
             'timedelta': [1., 2., 2.],
             'periods': [1., 2., 2.],
             'fl_inf': [1., 2., 2.],
             'fl_nan': [1., 2., 1.],
             'str_nan': [1., 2., 1.],
             'dt_nat': [1., 2., 1.],
             'periods_nat': [1., 2., 1.]},
            columns=cols)

        result = df.rolling(window=2).count()
        tm.assert_frame_equal(result, expected)

        result = df.rolling(1).count()
        expected = df.notnull().astype(float)
        tm.assert_frame_equal(result, expected)

    def test_window_with_args(self):
        tm._skip_if_no_scipy()

        # make sure that we are aggregating window functions correctly with arg
        r = Series(np.random.randn(100)).rolling(window=10, min_periods=1,
                                                 win_type='gaussian')
        expected = pd.concat([r.mean(std=10), r.mean(std=.01)], axis=1)
        expected.columns = ['<lambda>', '<lambda>']
        result = r.aggregate([lambda x: x.mean(std=10),
                              lambda x: x.mean(std=.01)])
        tm.assert_frame_equal(result, expected)

        def a(x):
            return x.mean(std=10)

        def b(x):
            return x.mean(std=0.01)

        expected = pd.concat([r.mean(std=10), r.mean(std=.01)], axis=1)
        expected.columns = ['a', 'b']
        result = r.aggregate([a, b])
        tm.assert_frame_equal(result, expected)

    def test_preserve_metadata(self):
        # GH 10565
        s = Series(np.arange(100), name='foo')

        s2 = s.rolling(30).sum()
        s3 = s.rolling(20).sum()
        assert s2.name == 'foo'
        assert s3.name == 'foo'

    def test_how_compat(self):
        # in prior versions, we would allow how to be used in the resample
        # now that its deprecated, we need to handle this in the actual
        # aggregation functions
        s = pd.Series(
            np.random.randn(20),
            index=pd.date_range('1/1/2000', periods=20, freq='12H'))

        for how in ['min', 'max', 'median']:
            for op in ['mean', 'sum', 'std', 'var', 'kurt', 'skew']:
                for t in ['rolling', 'expanding']:

                    with catch_warnings(record=True):

                        dfunc = getattr(pd, "{0}_{1}".format(t, op))
                        if dfunc is None:
                            continue

                        if t == 'rolling':
                            kwargs = {'window': 5}
                        else:
                            kwargs = {}
                        result = dfunc(s, freq='D', how=how, **kwargs)

                        expected = getattr(
                            getattr(s, t)(freq='D', **kwargs), op)(how=how)
                        tm.assert_series_equal(result, expected)


class TestWindow(Base):

    def setup_method(self, method):
        self._create_data()

    def test_constructor(self):
        # GH 12669
        tm._skip_if_no_scipy()

        for o in [self.series, self.frame]:
            c = o.rolling

            # valid
            c(win_type='boxcar', window=2, min_periods=1)
            c(win_type='boxcar', window=2, min_periods=1, center=True)
            c(win_type='boxcar', window=2, min_periods=1, center=False)

            for wt in ['boxcar', 'triang', 'blackman', 'hamming', 'bartlett',
                       'bohman', 'blackmanharris', 'nuttall', 'barthann']:
                c(win_type=wt, window=2)

            # not valid
            for w in [2., 'foo', np.array([2])]:
                with pytest.raises(ValueError):
                    c(win_type='boxcar', window=2, min_periods=w)
                with pytest.raises(ValueError):
                    c(win_type='boxcar', window=2, min_periods=1, center=w)

            for wt in ['foobar', 1]:
                with pytest.raises(ValueError):
                    c(win_type=wt, window=2)

    def test_numpy_compat(self):
        # see gh-12811
        w = rwindow.Window(Series([2, 4, 6]), window=[0, 2])

        msg = "numpy operations are not valid with window objects"

        for func in ('sum', 'mean'):
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(w, func), 1, 2, 3)
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(w, func), dtype=np.float64)


class TestRolling(Base):

    def setup_method(self, method):
        self._create_data()

    def test_doc_string(self):

        df = DataFrame({'B': [0, 1, 2, np.nan, 4]})
        df
        df.rolling(2).sum()
        df.rolling(2, min_periods=1).sum()

    def test_constructor(self):
        # GH 12669

        for o in [self.series, self.frame]:
            c = o.rolling

            # valid
            c(window=2)
            c(window=2, min_periods=1)
            c(window=2, min_periods=1, center=True)
            c(window=2, min_periods=1, center=False)

            # GH 13383
            c(0)
            with pytest.raises(ValueError):
                c(-1)

            # not valid
            for w in [2., 'foo', np.array([2])]:
                with pytest.raises(ValueError):
                    c(window=w)
                with pytest.raises(ValueError):
                    c(window=2, min_periods=w)
                with pytest.raises(ValueError):
                    c(window=2, min_periods=1, center=w)

    def test_constructor_with_win_type(self):
        # GH 13383
        tm._skip_if_no_scipy()
        for o in [self.series, self.frame]:
            c = o.rolling
            c(0, win_type='boxcar')
            with pytest.raises(ValueError):
                c(-1, win_type='boxcar')

    def test_constructor_with_timedelta_window(self):
        # GH 15440
        n = 10
        df = pd.DataFrame({'value': np.arange(n)},
                          index=pd.date_range('2015-12-24',
                                              periods=n,
                                              freq="D"))
        expected_data = np.append([0., 1.], np.arange(3., 27., 3))
        for window in [timedelta(days=3), pd.Timedelta(days=3)]:
            result = df.rolling(window=window).sum()
            expected = pd.DataFrame({'value': expected_data},
                                    index=pd.date_range('2015-12-24',
                                                        periods=n,
                                                        freq="D"))
            tm.assert_frame_equal(result, expected)
            expected = df.rolling('3D').sum()
            tm.assert_frame_equal(result, expected)

    def test_numpy_compat(self):
        # see gh-12811
        r = rwindow.Rolling(Series([2, 4, 6]), window=2)

        msg = "numpy operations are not valid with window objects"

        for func in ('std', 'mean', 'sum', 'max', 'min', 'var'):
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(r, func), 1, 2, 3)
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(r, func), dtype=np.float64)

    def test_closed(self):
        df = DataFrame({'A': [0, 1, 2, 3, 4]})
        # closed only allowed for datetimelike
        with pytest.raises(ValueError):
            df.rolling(window=3, closed='neither')

    @pytest.mark.parametrize('roller', ['1s', 1])
    def tests_empty_df_rolling(self, roller):
        # GH 15819 Verifies that datetime and integer rolling windows can be
        # applied to empty DataFrames
        expected = DataFrame()
        result = DataFrame().rolling(roller).sum()
        tm.assert_frame_equal(result, expected)

        # Verifies that datetime and integer rolling windows can be applied to
        # empty DataFrames with datetime index
        expected = DataFrame(index=pd.DatetimeIndex([]))
        result = DataFrame(index=pd.DatetimeIndex([])).rolling(roller).sum()
        tm.assert_frame_equal(result, expected)


class TestExpanding(Base):

    def setup_method(self, method):
        self._create_data()

    def test_doc_string(self):

        df = DataFrame({'B': [0, 1, 2, np.nan, 4]})
        df
        df.expanding(2).sum()

    def test_constructor(self):
        # GH 12669

        for o in [self.series, self.frame]:
            c = o.expanding

            # valid
            c(min_periods=1)
            c(min_periods=1, center=True)
            c(min_periods=1, center=False)

            # not valid
            for w in [2., 'foo', np.array([2])]:
                with pytest.raises(ValueError):
                    c(min_periods=w)
                with pytest.raises(ValueError):
                    c(min_periods=1, center=w)

    def test_numpy_compat(self):
        # see gh-12811
        e = rwindow.Expanding(Series([2, 4, 6]), window=2)

        msg = "numpy operations are not valid with window objects"

        for func in ('std', 'mean', 'sum', 'max', 'min', 'var'):
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(e, func), 1, 2, 3)
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(e, func), dtype=np.float64)

    @pytest.mark.parametrize(
        'expander',
        [1, pytest.mark.xfail(
            reason='GH 16425 expanding with offset not supported')('1s')])
    def tests_empty_df_expanding(self, expander):
        # GH 15819 Verifies that datetime and integer expanding windows can be
        # applied to empty DataFrames
        expected = DataFrame()
        result = DataFrame().expanding(expander).sum()
        tm.assert_frame_equal(result, expected)

        # Verifies that datetime and integer expanding windows can be applied
        # to empty DataFrames with datetime index
        expected = DataFrame(index=pd.DatetimeIndex([]))
        result = DataFrame(
            index=pd.DatetimeIndex([])).expanding(expander).sum()
        tm.assert_frame_equal(result, expected)


class TestEWM(Base):

    def setup_method(self, method):
        self._create_data()

    def test_doc_string(self):

        df = DataFrame({'B': [0, 1, 2, np.nan, 4]})
        df
        df.ewm(com=0.5).mean()

    def test_constructor(self):
        for o in [self.series, self.frame]:
            c = o.ewm

            # valid
            c(com=0.5)
            c(span=1.5)
            c(alpha=0.5)
            c(halflife=0.75)
            c(com=0.5, span=None)
            c(alpha=0.5, com=None)
            c(halflife=0.75, alpha=None)

            # not valid: mutually exclusive
            with pytest.raises(ValueError):
                c(com=0.5, alpha=0.5)
            with pytest.raises(ValueError):
                c(span=1.5, halflife=0.75)
            with pytest.raises(ValueError):
                c(alpha=0.5, span=1.5)

            # not valid: com < 0
            with pytest.raises(ValueError):
                c(com=-0.5)

            # not valid: span < 1
            with pytest.raises(ValueError):
                c(span=0.5)

            # not valid: halflife <= 0
            with pytest.raises(ValueError):
                c(halflife=0)

            # not valid: alpha <= 0 or alpha > 1
            for alpha in (-0.5, 1.5):
                with pytest.raises(ValueError):
                    c(alpha=alpha)

    def test_numpy_compat(self):
        # see gh-12811
        e = rwindow.EWM(Series([2, 4, 6]), alpha=0.5)

        msg = "numpy operations are not valid with window objects"

        for func in ('std', 'mean', 'var'):
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(e, func), 1, 2, 3)
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(e, func), dtype=np.float64)


class TestDeprecations(Base):
    """ test that we are catching deprecation warnings """

    def setup_method(self, method):
        self._create_data()

    def test_deprecations(self):

        with catch_warnings(record=True):
            mom.rolling_mean(np.ones(10), 3, center=True, axis=0)
            mom.rolling_mean(Series(np.ones(10)), 3, center=True, axis=0)


# gh-12373 : rolling functions error on float32 data
# make sure rolling functions works for different dtypes
#
# NOTE that these are yielded tests and so _create_data
# is explicitly called.
#
# further note that we are only checking rolling for fully dtype
# compliance (though both expanding and ewm inherit)
class Dtype(object):
    window = 2

    funcs = {
        'count': lambda v: v.count(),
        'max': lambda v: v.max(),
        'min': lambda v: v.min(),
        'sum': lambda v: v.sum(),
        'mean': lambda v: v.mean(),
        'std': lambda v: v.std(),
        'var': lambda v: v.var(),
        'median': lambda v: v.median()
    }

    def get_expects(self):
        expects = {
            'sr1': {
                'count': Series([1, 2, 2, 2, 2], dtype='float64'),
                'max': Series([np.nan, 1, 2, 3, 4], dtype='float64'),
                'min': Series([np.nan, 0, 1, 2, 3], dtype='float64'),
                'sum': Series([np.nan, 1, 3, 5, 7], dtype='float64'),
                'mean': Series([np.nan, .5, 1.5, 2.5, 3.5], dtype='float64'),
                'std': Series([np.nan] + [np.sqrt(.5)] * 4, dtype='float64'),
                'var': Series([np.nan, .5, .5, .5, .5], dtype='float64'),
                'median': Series([np.nan, .5, 1.5, 2.5, 3.5], dtype='float64')
            },
            'sr2': {
                'count': Series([1, 2, 2, 2, 2], dtype='float64'),
                'max': Series([np.nan, 10, 8, 6, 4], dtype='float64'),
                'min': Series([np.nan, 8, 6, 4, 2], dtype='float64'),
                'sum': Series([np.nan, 18, 14, 10, 6], dtype='float64'),
                'mean': Series([np.nan, 9, 7, 5, 3], dtype='float64'),
                'std': Series([np.nan] + [np.sqrt(2)] * 4, dtype='float64'),
                'var': Series([np.nan, 2, 2, 2, 2], dtype='float64'),
                'median': Series([np.nan, 9, 7, 5, 3], dtype='float64')
            },
            'df': {
                'count': DataFrame({0: Series([1, 2, 2, 2, 2]),
                                    1: Series([1, 2, 2, 2, 2])},
                                   dtype='float64'),
                'max': DataFrame({0: Series([np.nan, 2, 4, 6, 8]),
                                  1: Series([np.nan, 3, 5, 7, 9])},
                                 dtype='float64'),
                'min': DataFrame({0: Series([np.nan, 0, 2, 4, 6]),
                                  1: Series([np.nan, 1, 3, 5, 7])},
                                 dtype='float64'),
                'sum': DataFrame({0: Series([np.nan, 2, 6, 10, 14]),
                                  1: Series([np.nan, 4, 8, 12, 16])},
                                 dtype='float64'),
                'mean': DataFrame({0: Series([np.nan, 1, 3, 5, 7]),
                                   1: Series([np.nan, 2, 4, 6, 8])},
                                  dtype='float64'),
                'std': DataFrame({0: Series([np.nan] + [np.sqrt(2)] * 4),
                                  1: Series([np.nan] + [np.sqrt(2)] * 4)},
                                 dtype='float64'),
                'var': DataFrame({0: Series([np.nan, 2, 2, 2, 2]),
                                  1: Series([np.nan, 2, 2, 2, 2])},
                                 dtype='float64'),
                'median': DataFrame({0: Series([np.nan, 1, 3, 5, 7]),
                                     1: Series([np.nan, 2, 4, 6, 8])},
                                    dtype='float64'),
            }
        }
        return expects

    def _create_dtype_data(self, dtype):
        sr1 = Series(range(5), dtype=dtype)
        sr2 = Series(range(10, 0, -2), dtype=dtype)
        df = DataFrame(np.arange(10).reshape((5, 2)), dtype=dtype)

        data = {
            'sr1': sr1,
            'sr2': sr2,
            'df': df
        }

        return data

    def _create_data(self):
        self.data = self._create_dtype_data(self.dtype)
        self.expects = self.get_expects()

    def test_dtypes(self):
        self._create_data()
        for f_name, d_name in product(self.funcs.keys(), self.data.keys()):

            f = self.funcs[f_name]
            d = self.data[d_name]
            exp = self.expects[d_name][f_name]
            self.check_dtypes(f, f_name, d, d_name, exp)

    def check_dtypes(self, f, f_name, d, d_name, exp):
        roll = d.rolling(window=self.window)
        result = f(roll)
        tm.assert_almost_equal(result, exp)


class TestDtype_object(Dtype):
    dtype = object


class Dtype_integer(Dtype):
    pass


class TestDtype_int8(Dtype_integer):
    dtype = np.int8


class TestDtype_int16(Dtype_integer):
    dtype = np.int16


class TestDtype_int32(Dtype_integer):
    dtype = np.int32


class TestDtype_int64(Dtype_integer):
    dtype = np.int64


class Dtype_uinteger(Dtype):
    pass


class TestDtype_uint8(Dtype_uinteger):
    dtype = np.uint8


class TestDtype_uint16(Dtype_uinteger):
    dtype = np.uint16


class TestDtype_uint32(Dtype_uinteger):
    dtype = np.uint32


class TestDtype_uint64(Dtype_uinteger):
    dtype = np.uint64


class Dtype_float(Dtype):
    pass


class TestDtype_float16(Dtype_float):
    dtype = np.float16


class TestDtype_float32(Dtype_float):
    dtype = np.float32


class TestDtype_float64(Dtype_float):
    dtype = np.float64


class TestDtype_category(Dtype):
    dtype = 'category'
    include_df = False

    def _create_dtype_data(self, dtype):
        sr1 = Series(range(5), dtype=dtype)
        sr2 = Series(range(10, 0, -2), dtype=dtype)

        data = {
            'sr1': sr1,
            'sr2': sr2
        }

        return data


class DatetimeLike(Dtype):

    def check_dtypes(self, f, f_name, d, d_name, exp):

        roll = d.rolling(window=self.window)

        if f_name == 'count':
            result = f(roll)
            tm.assert_almost_equal(result, exp)

        else:

            # other methods not Implemented ATM
            with pytest.raises(NotImplementedError):
                f(roll)


class TestDtype_timedelta(DatetimeLike):
    dtype = np.dtype('m8[ns]')


class TestDtype_datetime(DatetimeLike):
    dtype = np.dtype('M8[ns]')


class TestDtype_datetime64UTC(DatetimeLike):
    dtype = 'datetime64[ns, UTC]'

    def _create_data(self):
        pytest.skip("direct creation of extension dtype "
                    "datetime64[ns, UTC] is not supported ATM")


class TestMoments(Base):

    def setup_method(self, method):
        self._create_data()

    def test_centered_axis_validation(self):

        # ok
        Series(np.ones(10)).rolling(window=3, center=True, axis=0).mean()

        # bad axis
        with pytest.raises(ValueError):
            Series(np.ones(10)).rolling(window=3, center=True, axis=1).mean()

        # ok ok
        DataFrame(np.ones((10, 10))).rolling(window=3, center=True,
                                             axis=0).mean()
        DataFrame(np.ones((10, 10))).rolling(window=3, center=True,
                                             axis=1).mean()

        # bad axis
        with pytest.raises(ValueError):
            (DataFrame(np.ones((10, 10)))
             .rolling(window=3, center=True, axis=2).mean())

    def test_rolling_sum(self):
        self._check_moment_func(mom.rolling_sum, np.sum, name='sum')

    def test_rolling_count(self):
        counter = lambda x: np.isfinite(x).astype(float).sum()
        self._check_moment_func(mom.rolling_count, counter, name='count',
                                has_min_periods=False, preserve_nan=False,
                                fill_value=0)

    def test_rolling_mean(self):
        self._check_moment_func(mom.rolling_mean, np.mean, name='mean')

    def test_cmov_mean(self):
        # GH 8238
        tm._skip_if_no_scipy()

        vals = np.array([6.95, 15.21, 4.72, 9.12, 13.81, 13.49, 16.68, 9.48,
                         10.63, 14.48])
        xp = np.array([np.nan, np.nan, 9.962, 11.27, 11.564, 12.516, 12.818,
                       12.952, np.nan, np.nan])

        with catch_warnings(record=True):
            rs = mom.rolling_mean(vals, 5, center=True)
            tm.assert_almost_equal(xp, rs)

        xp = Series(rs)
        rs = Series(vals).rolling(5, center=True).mean()
        tm.assert_series_equal(xp, rs)

    def test_cmov_window(self):
        # GH 8238
        tm._skip_if_no_scipy()

        vals = np.array([6.95, 15.21, 4.72, 9.12, 13.81, 13.49, 16.68, 9.48,
                         10.63, 14.48])
        xp = np.array([np.nan, np.nan, 9.962, 11.27, 11.564, 12.516, 12.818,
                       12.952, np.nan, np.nan])

        with catch_warnings(record=True):
            rs = mom.rolling_window(vals, 5, 'boxcar', center=True)
            tm.assert_almost_equal(xp, rs)

        xp = Series(rs)
        rs = Series(vals).rolling(5, win_type='boxcar', center=True).mean()
        tm.assert_series_equal(xp, rs)

    def test_cmov_window_corner(self):
        # GH 8238
        tm._skip_if_no_scipy()

        # all nan
        vals = np.empty(10, dtype=float)
        vals.fill(np.nan)
        with catch_warnings(record=True):
            rs = mom.rolling_window(vals, 5, 'boxcar', center=True)
            assert np.isnan(rs).all()

        # empty
        vals = np.array([])
        with catch_warnings(record=True):
            rs = mom.rolling_window(vals, 5, 'boxcar', center=True)
            assert len(rs) == 0

        # shorter than window
        vals = np.random.randn(5)
        with catch_warnings(record=True):
            rs = mom.rolling_window(vals, 10, 'boxcar')
            assert np.isnan(rs).all()
            assert len(rs) == 5

    def test_cmov_window_frame(self):
        # Gh 8238
        tm._skip_if_no_scipy()

        vals = np.array([[12.18, 3.64], [10.18, 9.16], [13.24, 14.61],
                         [4.51, 8.11], [6.15, 11.44], [9.14, 6.21],
                         [11.31, 10.67], [2.94, 6.51], [9.42, 8.39], [12.44,
                                                                      7.34]])

        xp = np.array([[np.nan, np.nan], [np.nan, np.nan], [9.252, 9.392],
                       [8.644, 9.906], [8.87, 10.208], [6.81, 8.588],
                       [7.792, 8.644], [9.05, 7.824], [np.nan, np.nan
                                                       ], [np.nan, np.nan]])

        # DataFrame
        rs = DataFrame(vals).rolling(5, win_type='boxcar', center=True).mean()
        tm.assert_frame_equal(DataFrame(xp), rs)

        # invalid method
        with pytest.raises(AttributeError):
            (DataFrame(vals).rolling(5, win_type='boxcar', center=True)
             .std())

        # sum
        xp = np.array([[np.nan, np.nan], [np.nan, np.nan], [46.26, 46.96],
                       [43.22, 49.53], [44.35, 51.04], [34.05, 42.94],
                       [38.96, 43.22], [45.25, 39.12], [np.nan, np.nan
                                                        ], [np.nan, np.nan]])

        rs = DataFrame(vals).rolling(5, win_type='boxcar', center=True).sum()
        tm.assert_frame_equal(DataFrame(xp), rs)

    def test_cmov_window_na_min_periods(self):
        tm._skip_if_no_scipy()

        # min_periods
        vals = Series(np.random.randn(10))
        vals[4] = np.nan
        vals[8] = np.nan

        xp = vals.rolling(5, min_periods=4, center=True).mean()
        rs = vals.rolling(5, win_type='boxcar', min_periods=4,
                          center=True).mean()
        tm.assert_series_equal(xp, rs)

    def test_cmov_window_regular(self):
        # GH 8238
        tm._skip_if_no_scipy()

        win_types = ['triang', 'blackman', 'hamming', 'bartlett', 'bohman',
                     'blackmanharris', 'nuttall', 'barthann']

        vals = np.array([6.95, 15.21, 4.72, 9.12, 13.81, 13.49, 16.68, 9.48,
                         10.63, 14.48])
        xps = {
            'hamming': [np.nan, np.nan, 8.71384, 9.56348, 12.38009, 14.03687,
                        13.8567, 11.81473, np.nan, np.nan],
            'triang': [np.nan, np.nan, 9.28667, 10.34667, 12.00556, 13.33889,
                       13.38, 12.33667, np.nan, np.nan],
            'barthann': [np.nan, np.nan, 8.4425, 9.1925, 12.5575, 14.3675,
                         14.0825, 11.5675, np.nan, np.nan],
            'bohman': [np.nan, np.nan, 7.61599, 9.1764, 12.83559, 14.17267,
                       14.65923, 11.10401, np.nan, np.nan],
            'blackmanharris': [np.nan, np.nan, 6.97691, 9.16438, 13.05052,
                               14.02156, 15.10512, 10.74574, np.nan, np.nan],
            'nuttall': [np.nan, np.nan, 7.04618, 9.16786, 13.02671, 14.03559,
                        15.05657, 10.78514, np.nan, np.nan],
            'blackman': [np.nan, np.nan, 7.73345, 9.17869, 12.79607, 14.20036,
                         14.57726, 11.16988, np.nan, np.nan],
            'bartlett': [np.nan, np.nan, 8.4425, 9.1925, 12.5575, 14.3675,
                         14.0825, 11.5675, np.nan, np.nan]
        }

        for wt in win_types:
            xp = Series(xps[wt])
            rs = Series(vals).rolling(5, win_type=wt, center=True).mean()
            tm.assert_series_equal(xp, rs)

    def test_cmov_window_regular_linear_range(self):
        # GH 8238
        tm._skip_if_no_scipy()

        win_types = ['triang', 'blackman', 'hamming', 'bartlett', 'bohman',
                     'blackmanharris', 'nuttall', 'barthann']

        vals = np.array(range(10), dtype=np.float)
        xp = vals.copy()
        xp[:2] = np.nan
        xp[-2:] = np.nan
        xp = Series(xp)

        for wt in win_types:
            rs = Series(vals).rolling(5, win_type=wt, center=True).mean()
            tm.assert_series_equal(xp, rs)

    def test_cmov_window_regular_missing_data(self):
        # GH 8238
        tm._skip_if_no_scipy()

        win_types = ['triang', 'blackman', 'hamming', 'bartlett', 'bohman',
                     'blackmanharris', 'nuttall', 'barthann']

        vals = np.array([6.95, 15.21, 4.72, 9.12, 13.81, 13.49, 16.68, np.nan,
                         10.63, 14.48])
        xps = {
            'bartlett': [np.nan, np.nan, 9.70333, 10.5225, 8.4425, 9.1925,
                         12.5575, 14.3675, 15.61667, 13.655],
            'blackman': [np.nan, np.nan, 9.04582, 11.41536, 7.73345, 9.17869,
                         12.79607, 14.20036, 15.8706, 13.655],
            'barthann': [np.nan, np.nan, 9.70333, 10.5225, 8.4425, 9.1925,
                         12.5575, 14.3675, 15.61667, 13.655],
            'bohman': [np.nan, np.nan, 8.9444, 11.56327, 7.61599, 9.1764,
                       12.83559, 14.17267, 15.90976, 13.655],
            'hamming': [np.nan, np.nan, 9.59321, 10.29694, 8.71384, 9.56348,
                        12.38009, 14.20565, 15.24694, 13.69758],
            'nuttall': [np.nan, np.nan, 8.47693, 12.2821, 7.04618, 9.16786,
                        13.02671, 14.03673, 16.08759, 13.65553],
            'triang': [np.nan, np.nan, 9.33167, 9.76125, 9.28667, 10.34667,
                       12.00556, 13.82125, 14.49429, 13.765],
            'blackmanharris': [np.nan, np.nan, 8.42526, 12.36824, 6.97691,
                               9.16438, 13.05052, 14.02175, 16.1098, 13.65509]
        }

        for wt in win_types:
            xp = Series(xps[wt])
            rs = Series(vals).rolling(5, win_type=wt, min_periods=3).mean()
            tm.assert_series_equal(xp, rs)

    def test_cmov_window_special(self):
        # GH 8238
        tm._skip_if_no_scipy()

        win_types = ['kaiser', 'gaussian', 'general_gaussian', 'slepian']
        kwds = [{'beta': 1.}, {'std': 1.}, {'power': 2.,
                                            'width': 2.}, {'width': 0.5}]

        vals = np.array([6.95, 15.21, 4.72, 9.12, 13.81, 13.49, 16.68, 9.48,
                         10.63, 14.48])

        xps = {
            'gaussian': [np.nan, np.nan, 8.97297, 9.76077, 12.24763, 13.89053,
                         13.65671, 12.01002, np.nan, np.nan],
            'general_gaussian': [np.nan, np.nan, 9.85011, 10.71589, 11.73161,
                                 13.08516, 12.95111, 12.74577, np.nan, np.nan],
            'slepian': [np.nan, np.nan, 9.81073, 10.89359, 11.70284, 12.88331,
                        12.96079, 12.77008, np.nan, np.nan],
            'kaiser': [np.nan, np.nan, 9.86851, 11.02969, 11.65161, 12.75129,
                       12.90702, 12.83757, np.nan, np.nan]
        }

        for wt, k in zip(win_types, kwds):
            xp = Series(xps[wt])
            rs = Series(vals).rolling(5, win_type=wt, center=True).mean(**k)
            tm.assert_series_equal(xp, rs)

    def test_cmov_window_special_linear_range(self):
        # GH 8238
        tm._skip_if_no_scipy()

        win_types = ['kaiser', 'gaussian', 'general_gaussian', 'slepian']
        kwds = [{'beta': 1.}, {'std': 1.}, {'power': 2.,
                                            'width': 2.}, {'width': 0.5}]

        vals = np.array(range(10), dtype=np.float)
        xp = vals.copy()
        xp[:2] = np.nan
        xp[-2:] = np.nan
        xp = Series(xp)

        for wt, k in zip(win_types, kwds):
            rs = Series(vals).rolling(5, win_type=wt, center=True).mean(**k)
            tm.assert_series_equal(xp, rs)

    def test_rolling_median(self):
        with catch_warnings(record=True):
            self._check_moment_func(mom.rolling_median, np.median,
                                    name='median')

    def test_rolling_min(self):

        with catch_warnings(record=True):
            self._check_moment_func(mom.rolling_min, np.min, name='min')

        with catch_warnings(record=True):
            a = np.array([1, 2, 3, 4, 5])
            b = mom.rolling_min(a, window=100, min_periods=1)
            tm.assert_almost_equal(b, np.ones(len(a)))

            pytest.raises(ValueError, mom.rolling_min, np.array([1, 2, 3]),
                          window=3, min_periods=5)

    def test_rolling_max(self):

        with catch_warnings(record=True):
            self._check_moment_func(mom.rolling_max, np.max, name='max')

        with catch_warnings(record=True):
            a = np.array([1, 2, 3, 4, 5], dtype=np.float64)
            b = mom.rolling_max(a, window=100, min_periods=1)
            tm.assert_almost_equal(a, b)

            pytest.raises(ValueError, mom.rolling_max, np.array([1, 2, 3]),
                          window=3, min_periods=5)

    def test_rolling_quantile(self):
        qs = [0.0, .1, .5, .9, 1.0]

        def scoreatpercentile(a, per):
            values = np.sort(a, axis=0)

            idx = per / 1. * (values.shape[0] - 1)
            return values[int(idx)]

        for q in qs:

            def f(x, window, quantile, min_periods=None, freq=None,
                  center=False):
                return mom.rolling_quantile(x, window, quantile,
                                            min_periods=min_periods, freq=freq,
                                            center=center)

            def alt(x):
                return scoreatpercentile(x, q)

            self._check_moment_func(f, alt, name='quantile', quantile=q)

    def test_rolling_quantile_param(self):
        ser = Series([0.0, .1, .5, .9, 1.0])

        with pytest.raises(ValueError):
            ser.rolling(3).quantile(-0.1)

        with pytest.raises(ValueError):
            ser.rolling(3).quantile(10.0)

        with pytest.raises(TypeError):
            ser.rolling(3).quantile('foo')

    def test_rolling_apply(self):
        # suppress warnings about empty slices, as we are deliberately testing
        # with a 0-length Series
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore",
                                    message=".*(empty slice|0 for slice).*",
                                    category=RuntimeWarning)

            ser = Series([])
            tm.assert_series_equal(ser,
                                   ser.rolling(10).apply(lambda x: x.mean()))

            f = lambda x: x[np.isfinite(x)].mean()

            def roll_mean(x, window, min_periods=None, freq=None, center=False,
                          **kwargs):
                return mom.rolling_apply(x, window, func=f,
                                         min_periods=min_periods, freq=freq,
                                         center=center)

            self._check_moment_func(roll_mean, np.mean, name='apply', func=f)

        # GH 8080
        s = Series([None, None, None])
        result = s.rolling(2, min_periods=0).apply(lambda x: len(x))
        expected = Series([1., 2., 2.])
        tm.assert_series_equal(result, expected)

        result = s.rolling(2, min_periods=0).apply(len)
        tm.assert_series_equal(result, expected)

    def test_rolling_apply_out_of_bounds(self):
        # #1850
        arr = np.arange(4)

        # it works!
        with catch_warnings(record=True):
            result = mom.rolling_apply(arr, 10, np.sum)
        assert isnull(result).all()

        with catch_warnings(record=True):
            result = mom.rolling_apply(arr, 10, np.sum, min_periods=1)
        tm.assert_almost_equal(result, result)

    def test_rolling_std(self):
        self._check_moment_func(mom.rolling_std, lambda x: np.std(x, ddof=1),
                                name='std')
        self._check_moment_func(mom.rolling_std, lambda x: np.std(x, ddof=0),
                                name='std', ddof=0)

    def test_rolling_std_1obs(self):
        with catch_warnings(record=True):
            result = mom.rolling_std(np.array([1., 2., 3., 4., 5.]),
                                     1, min_periods=1)
        expected = np.array([np.nan] * 5)
        tm.assert_almost_equal(result, expected)

        with catch_warnings(record=True):
            result = mom.rolling_std(np.array([1., 2., 3., 4., 5.]),
                                     1, min_periods=1, ddof=0)
        expected = np.zeros(5)
        tm.assert_almost_equal(result, expected)

        with catch_warnings(record=True):
            result = mom.rolling_std(np.array([np.nan, np.nan, 3., 4., 5.]),
                                     3, min_periods=2)
        assert np.isnan(result[2])

    def test_rolling_std_neg_sqrt(self):
        # unit test from Bottleneck

        # Test move_nanstd for neg sqrt.

        a = np.array([0.0011448196318903589, 0.00028718669878572767,
                      0.00028718669878572767, 0.00028718669878572767,
                      0.00028718669878572767])
        with catch_warnings(record=True):
            b = mom.rolling_std(a, window=3)
        assert np.isfinite(b[2:]).all()

        with catch_warnings(record=True):
            b = mom.ewmstd(a, span=3)
        assert np.isfinite(b[2:]).all()

    def test_rolling_var(self):
        self._check_moment_func(mom.rolling_var, lambda x: np.var(x, ddof=1),
                                test_stable=True, name='var')
        self._check_moment_func(mom.rolling_var, lambda x: np.var(x, ddof=0),
                                name='var', ddof=0)

    def test_rolling_skew(self):
        try:
            from scipy.stats import skew
        except ImportError:
            pytest.skip('no scipy')
        self._check_moment_func(mom.rolling_skew,
                                lambda x: skew(x, bias=False), name='skew')

    def test_rolling_kurt(self):
        try:
            from scipy.stats import kurtosis
        except ImportError:
            pytest.skip('no scipy')
        self._check_moment_func(mom.rolling_kurt,
                                lambda x: kurtosis(x, bias=False), name='kurt')

    def test_fperr_robustness(self):
        # TODO: remove this once python 2.5 out of picture
        if PY3:
            pytest.skip("doesn't work on python 3")

        # #2114
        data = '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x1a@\xaa\xaa\xaa\xaa\xaa\xaa\x02@8\x8e\xe38\x8e\xe3\xe8?z\t\xed%\xb4\x97\xd0?\xa2\x0c<\xdd\x9a\x1f\xb6?\x82\xbb\xfa&y\x7f\x9d?\xac\'\xa7\xc4P\xaa\x83?\x90\xdf\xde\xb0k8j?`\xea\xe9u\xf2zQ?*\xe37\x9d\x98N7?\xe2.\xf5&v\x13\x1f?\xec\xc9\xf8\x19\xa4\xb7\x04?\x90b\xf6w\x85\x9f\xeb>\xb5A\xa4\xfaXj\xd2>F\x02\xdb\xf8\xcb\x8d\xb8>.\xac<\xfb\x87^\xa0>\xe8:\xa6\xf9_\xd3\x85>\xfb?\xe2cUU\xfd?\xfc\x7fA\xed8\x8e\xe3?\xa5\xaa\xac\x91\xf6\x12\xca?n\x1cs\xb6\xf9a\xb1?\xe8%D\xf3L-\x97?5\xddZD\x11\xe7~?#>\xe7\x82\x0b\x9ad?\xd9R4Y\x0fxK?;7x;\nP2?N\xf4JO\xb8j\x18?4\xf81\x8a%G\x00?\x9a\xf5\x97\r2\xb4\xe5>\xcd\x9c\xca\xbcB\xf0\xcc>3\x13\x87(\xd7J\xb3>\x99\x19\xb4\xe0\x1e\xb9\x99>ff\xcd\x95\x14&\x81>\x88\x88\xbc\xc7p\xddf>`\x0b\xa6_\x96|N>@\xb2n\xea\x0eS4>U\x98\x938i\x19\x1b>\x8eeb\xd0\xf0\x10\x02>\xbd\xdc-k\x96\x16\xe8=(\x93\x1e\xf2\x0e\x0f\xd0=\xe0n\xd3Bii\xb5=*\xe9\x19Y\x8c\x8c\x9c=\xc6\xf0\xbb\x90]\x08\x83=]\x96\xfa\xc0|`i=>d\xfc\xd5\xfd\xeaP=R0\xfb\xc7\xa7\x8e6=\xc2\x95\xf9_\x8a\x13\x1e=\xd6c\xa6\xea\x06\r\x04=r\xda\xdd8\t\xbc\xea<\xf6\xe6\x93\xd0\xb0\xd2\xd1<\x9d\xdeok\x96\xc3\xb7<&~\xea9s\xaf\x9f<UUUUUU\x13@q\x1c\xc7q\x1c\xc7\xf9?\xf6\x12\xdaKh/\xe1?\xf2\xc3"e\xe0\xe9\xc6?\xed\xaf\x831+\x8d\xae?\xf3\x1f\xad\xcb\x1c^\x94?\x15\x1e\xdd\xbd>\xb8\x02@\xc6\xd2&\xfd\xa8\xf5\xe8?\xd9\xe1\x19\xfe\xc5\xa3\xd0?v\x82"\xa8\xb2/\xb6?\x9dX\x835\xee\x94\x9d?h\x90W\xce\x9e\xb8\x83?\x8a\xc0th~Kj?\\\x80\xf8\x9a\xa9\x87Q?%\xab\xa0\xce\x8c_7?1\xe4\x80\x13\x11*\x1f? \x98\x00\r\xb6\xc6\x04?\x80u\xabf\x9d\xb3\xeb>UNrD\xbew\xd2>\x1c\x13C[\xa8\x9f\xb8>\x12b\xd7<pj\xa0>m-\x1fQ@\xe3\x85>\xe6\x91)l\x00/m>Da\xc6\xf2\xaatS>\x05\xd7]\xee\xe3\xf09>'  # noqa

        arr = np.frombuffer(data, dtype='<f8')
        if sys.byteorder != "little":
            arr = arr.byteswap().newbyteorder()

        with catch_warnings(record=True):
            result = mom.rolling_sum(arr, 2)
        assert (result[1:] >= 0).all()

        with catch_warnings(record=True):
            result = mom.rolling_mean(arr, 2)
        assert (result[1:] >= 0).all()

        with catch_warnings(record=True):
            result = mom.rolling_var(arr, 2)
        assert (result[1:] >= 0).all()

        # #2527, ugh
        arr = np.array([0.00012456, 0.0003, 0])
        with catch_warnings(record=True):
            result = mom.rolling_mean(arr, 1)
        assert result[-1] >= 0

        with catch_warnings(record=True):
            result = mom.rolling_mean(-arr, 1)
        assert result[-1] <= 0

    def _check_moment_func(self, f, static_comp, name=None, window=50,
                           has_min_periods=True, has_center=True,
                           has_time_rule=True, preserve_nan=True,
                           fill_value=None, test_stable=False, **kwargs):

        with warnings.catch_warnings(record=True):
            self._check_ndarray(f, static_comp, window=window,
                                has_min_periods=has_min_periods,
                                preserve_nan=preserve_nan,
                                has_center=has_center, fill_value=fill_value,
                                test_stable=test_stable, **kwargs)

        with warnings.catch_warnings(record=True):
            self._check_structures(f, static_comp,
                                   has_min_periods=has_min_periods,
                                   has_time_rule=has_time_rule,
                                   fill_value=fill_value,
                                   has_center=has_center, **kwargs)

        # new API
        if name is not None:
            self._check_structures(f, static_comp, name=name,
                                   has_min_periods=has_min_periods,
                                   has_time_rule=has_time_rule,
                                   fill_value=fill_value,
                                   has_center=has_center, **kwargs)

    def _check_ndarray(self, f, static_comp, window=50, has_min_periods=True,
                       preserve_nan=True, has_center=True, fill_value=None,
                       test_stable=False, test_window=True, **kwargs):
        def get_result(arr, window, min_periods=None, center=False):
            return f(arr, window, min_periods=min_periods, center=center, **
                     kwargs)

        result = get_result(self.arr, window)
        tm.assert_almost_equal(result[-1], static_comp(self.arr[-50:]))

        if preserve_nan:
            assert (np.isnan(result[self._nan_locs]).all())

        # excluding NaNs correctly
        arr = randn(50)
        arr[:10] = np.NaN
        arr[-10:] = np.NaN

        if has_min_periods:
            result = get_result(arr, 50, min_periods=30)
            tm.assert_almost_equal(result[-1], static_comp(arr[10:-10]))

            # min_periods is working correctly
            result = get_result(arr, 20, min_periods=15)
            assert np.isnan(result[23])
            assert not np.isnan(result[24])

            assert not np.isnan(result[-6])
            assert np.isnan(result[-5])

            arr2 = randn(20)
            result = get_result(arr2, 10, min_periods=5)
            assert isnull(result[3])
            assert notnull(result[4])

            # min_periods=0
            result0 = get_result(arr, 20, min_periods=0)
            result1 = get_result(arr, 20, min_periods=1)
            tm.assert_almost_equal(result0, result1)
        else:
            result = get_result(arr, 50)
            tm.assert_almost_equal(result[-1], static_comp(arr[10:-10]))

        # GH 7925
        if has_center:
            if has_min_periods:
                result = get_result(arr, 20, min_periods=15, center=True)
                expected = get_result(
                    np.concatenate((arr, np.array([np.NaN] * 9))), 20,
                    min_periods=15)[9:]
            else:
                result = get_result(arr, 20, center=True)
                expected = get_result(
                    np.concatenate((arr, np.array([np.NaN] * 9))), 20)[9:]

            tm.assert_numpy_array_equal(result, expected)

        if test_stable:
            result = get_result(self.arr + 1e9, window)
            tm.assert_almost_equal(result[-1],
                                   static_comp(self.arr[-50:] + 1e9))

        # Test window larger than array, #7297
        if test_window:
            if has_min_periods:
                for minp in (0, len(self.arr) - 1, len(self.arr)):
                    result = get_result(self.arr, len(self.arr) + 1,
                                        min_periods=minp)
                    expected = get_result(self.arr, len(self.arr),
                                          min_periods=minp)
                    nan_mask = np.isnan(result)
                    tm.assert_numpy_array_equal(nan_mask, np.isnan(expected))

                    nan_mask = ~nan_mask
                    tm.assert_almost_equal(result[nan_mask],
                                           expected[nan_mask])
            else:
                result = get_result(self.arr, len(self.arr) + 1)
                expected = get_result(self.arr, len(self.arr))
                nan_mask = np.isnan(result)
                tm.assert_numpy_array_equal(nan_mask, np.isnan(expected))

                nan_mask = ~nan_mask
                tm.assert_almost_equal(result[nan_mask], expected[nan_mask])

    def _check_structures(self, f, static_comp, name=None,
                          has_min_periods=True, has_time_rule=True,
                          has_center=True, fill_value=None, **kwargs):
        def get_result(obj, window, min_periods=None, freq=None, center=False):

            # check via the API calls if name is provided
            if name is not None:

                # catch a freq deprecation warning if freq is provided and not
                # None
                with catch_warnings(record=True):
                    r = obj.rolling(window=window, min_periods=min_periods,
                                    freq=freq, center=center)
                return getattr(r, name)(**kwargs)

            # check via the moments API
            with catch_warnings(record=True):
                return f(obj, window=window, min_periods=min_periods,
                         freq=freq, center=center, **kwargs)

        series_result = get_result(self.series, window=50)
        frame_result = get_result(self.frame, window=50)

        assert isinstance(series_result, Series)
        assert type(frame_result) == DataFrame

        # check time_rule works
        if has_time_rule:
            win = 25
            minp = 10

            if has_min_periods:
                series_result = get_result(self.series[::2], window=win,
                                           min_periods=minp, freq='B')
                frame_result = get_result(self.frame[::2], window=win,
                                          min_periods=minp, freq='B')
            else:
                series_result = get_result(self.series[::2], window=win,
                                           freq='B')
                frame_result = get_result(self.frame[::2], window=win,
                                          freq='B')

            last_date = series_result.index[-1]
            prev_date = last_date - 24 * offsets.BDay()

            trunc_series = self.series[::2].truncate(prev_date, last_date)
            trunc_frame = self.frame[::2].truncate(prev_date, last_date)

            tm.assert_almost_equal(series_result[-1],
                                   static_comp(trunc_series))

            tm.assert_series_equal(frame_result.xs(last_date),
                                   trunc_frame.apply(static_comp),
                                   check_names=False)

        # GH 7925
        if has_center:

            # shifter index
            s = ['x%d' % x for x in range(12)]

            if has_min_periods:
                minp = 10

                series_xp = get_result(
                    self.series.reindex(list(self.series.index) + s),
                    window=25,
                    min_periods=minp).shift(-12).reindex(self.series.index)
                frame_xp = get_result(
                    self.frame.reindex(list(self.frame.index) + s),
                    window=25,
                    min_periods=minp).shift(-12).reindex(self.frame.index)

                series_rs = get_result(self.series, window=25,
                                       min_periods=minp, center=True)
                frame_rs = get_result(self.frame, window=25, min_periods=minp,
                                      center=True)

            else:
                series_xp = get_result(
                    self.series.reindex(list(self.series.index) + s),
                    window=25).shift(-12).reindex(self.series.index)
                frame_xp = get_result(
                    self.frame.reindex(list(self.frame.index) + s),
                    window=25).shift(-12).reindex(self.frame.index)

                series_rs = get_result(self.series, window=25, center=True)
                frame_rs = get_result(self.frame, window=25, center=True)

            if fill_value is not None:
                series_xp = series_xp.fillna(fill_value)
                frame_xp = frame_xp.fillna(fill_value)
            tm.assert_series_equal(series_xp, series_rs)
            tm.assert_frame_equal(frame_xp, frame_rs)

    def test_ewma(self):
        self._check_ew(mom.ewma, name='mean')

        arr = np.zeros(1000)
        arr[5] = 1
        with catch_warnings(record=True):
            result = mom.ewma(arr, span=100, adjust=False).sum()
        assert np.abs(result - 1) < 1e-2

        s = Series([1.0, 2.0, 4.0, 8.0])

        expected = Series([1.0, 1.6, 2.736842, 4.923077])
        for f in [lambda s: s.ewm(com=2.0, adjust=True).mean(),
                  lambda s: s.ewm(com=2.0, adjust=True,
                                  ignore_na=False).mean(),
                  lambda s: s.ewm(com=2.0, adjust=True, ignore_na=True).mean(),
                  ]:
            result = f(s)
            tm.assert_series_equal(result, expected)

        expected = Series([1.0, 1.333333, 2.222222, 4.148148])
        for f in [lambda s: s.ewm(com=2.0, adjust=False).mean(),
                  lambda s: s.ewm(com=2.0, adjust=False,
                                  ignore_na=False).mean(),
                  lambda s: s.ewm(com=2.0, adjust=False,
                                  ignore_na=True).mean(),
                  ]:
            result = f(s)
            tm.assert_series_equal(result, expected)

    def test_ewma_nan_handling(self):
        s = Series([1.] + [np.nan] * 5 + [1.])
        result = s.ewm(com=5).mean()
        tm.assert_series_equal(result, Series([1.] * len(s)))

        s = Series([np.nan] * 2 + [1.] + [np.nan] * 2 + [1.])
        result = s.ewm(com=5).mean()
        tm.assert_series_equal(result, Series([np.nan] * 2 + [1.] * 4))

        # GH 7603
        s0 = Series([np.nan, 1., 101.])
        s1 = Series([1., np.nan, 101.])
        s2 = Series([np.nan, 1., np.nan, np.nan, 101., np.nan])
        s3 = Series([1., np.nan, 101., 50.])
        com = 2.
        alpha = 1. / (1. + com)

        def simple_wma(s, w):
            return (s.multiply(w).cumsum() / w.cumsum()).fillna(method='ffill')

        for (s, adjust, ignore_na, w) in [
            (s0, True, False, [np.nan, (1. - alpha), 1.]),
            (s0, True, True, [np.nan, (1. - alpha), 1.]),
            (s0, False, False, [np.nan, (1. - alpha), alpha]),
            (s0, False, True, [np.nan, (1. - alpha), alpha]),
            (s1, True, False, [(1. - alpha) ** 2, np.nan, 1.]),
            (s1, True, True, [(1. - alpha), np.nan, 1.]),
            (s1, False, False, [(1. - alpha) ** 2, np.nan, alpha]),
            (s1, False, True, [(1. - alpha), np.nan, alpha]),
            (s2, True, False, [np.nan, (1. - alpha) **
                               3, np.nan, np.nan, 1., np.nan]),
            (s2, True, True, [np.nan, (1. - alpha),
                              np.nan, np.nan, 1., np.nan]),
            (s2, False, False, [np.nan, (1. - alpha) **
                                3, np.nan, np.nan, alpha, np.nan]),
            (s2, False, True, [np.nan, (1. - alpha),
                               np.nan, np.nan, alpha, np.nan]),
            (s3, True, False, [(1. - alpha) **
                               3, np.nan, (1. - alpha), 1.]),
            (s3, True, True, [(1. - alpha) **
                              2, np.nan, (1. - alpha), 1.]),
            (s3, False, False, [(1. - alpha) ** 3, np.nan,
                                (1. - alpha) * alpha,
                                alpha * ((1. - alpha) ** 2 + alpha)]),
            (s3, False, True, [(1. - alpha) ** 2,
                               np.nan, (1. - alpha) * alpha, alpha])]:
            expected = simple_wma(s, Series(w))
            result = s.ewm(com=com, adjust=adjust, ignore_na=ignore_na).mean()

            tm.assert_series_equal(result, expected)
            if ignore_na is False:
                # check that ignore_na defaults to False
                result = s.ewm(com=com, adjust=adjust).mean()
                tm.assert_series_equal(result, expected)

    def test_ewmvar(self):
        self._check_ew(mom.ewmvar, name='var')

    def test_ewmvol(self):
        self._check_ew(mom.ewmvol, name='vol')

    def test_ewma_span_com_args(self):
        with catch_warnings(record=True):
            A = mom.ewma(self.arr, com=9.5)
            B = mom.ewma(self.arr, span=20)
            tm.assert_almost_equal(A, B)

            pytest.raises(ValueError, mom.ewma, self.arr, com=9.5, span=20)
            pytest.raises(ValueError, mom.ewma, self.arr)

    def test_ewma_halflife_arg(self):
        with catch_warnings(record=True):
            A = mom.ewma(self.arr, com=13.932726172912965)
            B = mom.ewma(self.arr, halflife=10.0)
            tm.assert_almost_equal(A, B)

            pytest.raises(ValueError, mom.ewma, self.arr, span=20,
                          halflife=50)
            pytest.raises(ValueError, mom.ewma, self.arr, com=9.5,
                          halflife=50)
            pytest.raises(ValueError, mom.ewma, self.arr, com=9.5, span=20,
                          halflife=50)
            pytest.raises(ValueError, mom.ewma, self.arr)

    def test_ewma_alpha_old_api(self):
        # GH 10789
        with catch_warnings(record=True):
            a = mom.ewma(self.arr, alpha=0.61722699889169674)
            b = mom.ewma(self.arr, com=0.62014947789973052)
            c = mom.ewma(self.arr, span=2.240298955799461)
            d = mom.ewma(self.arr, halflife=0.721792864318)
            tm.assert_numpy_array_equal(a, b)
            tm.assert_numpy_array_equal(a, c)
            tm.assert_numpy_array_equal(a, d)

    def test_ewma_alpha_arg_old_api(self):
        # GH 10789
        with catch_warnings(record=True):
            pytest.raises(ValueError, mom.ewma, self.arr)
            pytest.raises(ValueError, mom.ewma, self.arr,
                          com=10.0, alpha=0.5)
            pytest.raises(ValueError, mom.ewma, self.arr,
                          span=10.0, alpha=0.5)
            pytest.raises(ValueError, mom.ewma, self.arr,
                          halflife=10.0, alpha=0.5)

    def test_ewm_alpha(self):
        # GH 10789
        s = Series(self.arr)
        a = s.ewm(alpha=0.61722699889169674).mean()
        b = s.ewm(com=0.62014947789973052).mean()
        c = s.ewm(span=2.240298955799461).mean()
        d = s.ewm(halflife=0.721792864318).mean()
        tm.assert_series_equal(a, b)
        tm.assert_series_equal(a, c)
        tm.assert_series_equal(a, d)

    def test_ewm_alpha_arg(self):
        # GH 10789
        s = Series(self.arr)
        pytest.raises(ValueError, s.ewm)
        pytest.raises(ValueError, s.ewm, com=10.0, alpha=0.5)
        pytest.raises(ValueError, s.ewm, span=10.0, alpha=0.5)
        pytest.raises(ValueError, s.ewm, halflife=10.0, alpha=0.5)

    def test_ewm_domain_checks(self):
        # GH 12492
        s = Series(self.arr)
        # com must satisfy: com >= 0
        pytest.raises(ValueError, s.ewm, com=-0.1)
        s.ewm(com=0.0)
        s.ewm(com=0.1)
        # span must satisfy: span >= 1
        pytest.raises(ValueError, s.ewm, span=-0.1)
        pytest.raises(ValueError, s.ewm, span=0.0)
        pytest.raises(ValueError, s.ewm, span=0.9)
        s.ewm(span=1.0)
        s.ewm(span=1.1)
        # halflife must satisfy: halflife > 0
        pytest.raises(ValueError, s.ewm, halflife=-0.1)
        pytest.raises(ValueError, s.ewm, halflife=0.0)
        s.ewm(halflife=0.1)
        # alpha must satisfy: 0 < alpha <= 1
        pytest.raises(ValueError, s.ewm, alpha=-0.1)
        pytest.raises(ValueError, s.ewm, alpha=0.0)
        s.ewm(alpha=0.1)
        s.ewm(alpha=1.0)
        pytest.raises(ValueError, s.ewm, alpha=1.1)

    def test_ew_empty_arrays(self):
        arr = np.array([], dtype=np.float64)

        funcs = [mom.ewma, mom.ewmvol, mom.ewmvar]
        for f in funcs:
            with catch_warnings(record=True):
                result = f(arr, 3)
            tm.assert_almost_equal(result, arr)

    def _check_ew(self, func, name=None):
        with catch_warnings(record=True):
            self._check_ew_ndarray(func, name=name)
        self._check_ew_structures(func, name=name)

    def _check_ew_ndarray(self, func, preserve_nan=False, name=None):
        result = func(self.arr, com=10)
        if preserve_nan:
            assert (np.isnan(result[self._nan_locs]).all())

        # excluding NaNs correctly
        arr = randn(50)
        arr[:10] = np.NaN
        arr[-10:] = np.NaN
        s = Series(arr)

        # check min_periods
        # GH 7898
        result = func(s, 50, min_periods=2)
        assert np.isnan(result.values[:11]).all()
        assert not np.isnan(result.values[11:]).any()

        for min_periods in (0, 1):
            result = func(s, 50, min_periods=min_periods)
            if func == mom.ewma:
                assert np.isnan(result.values[:10]).all()
                assert not np.isnan(result.values[10:]).any()
            else:
                # ewmstd, ewmvol, ewmvar (with bias=False) require at least two
                # values
                assert np.isnan(result.values[:11]).all()
                assert not np.isnan(result.values[11:]).any()

            # check series of length 0
            result = func(Series([]), 50, min_periods=min_periods)
            tm.assert_series_equal(result, Series([]))

            # check series of length 1
            result = func(Series([1.]), 50, min_periods=min_periods)
            if func == mom.ewma:
                tm.assert_series_equal(result, Series([1.]))
            else:
                # ewmstd, ewmvol, ewmvar with bias=False require at least two
                # values
                tm.assert_series_equal(result, Series([np.NaN]))

        # pass in ints
        result2 = func(np.arange(50), span=10)
        assert result2.dtype == np.float_

    def _check_ew_structures(self, func, name):
        series_result = getattr(self.series.ewm(com=10), name)()
        assert isinstance(series_result, Series)

        frame_result = getattr(self.frame.ewm(com=10), name)()
        assert type(frame_result) == DataFrame


class TestPairwise(object):

    # GH 7738
    df1s = [DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]], columns=[0, 1]),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]], columns=[1, 0]),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]], columns=[1, 1]),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]],
                      columns=['C', 'C']),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]], columns=[1., 0]),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]], columns=[0., 1]),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1]], columns=['C', 1]),
            DataFrame([[2., 4.], [1., 2.], [5., 2.], [8., 1.]],
                      columns=[1, 0.]),
            DataFrame([[2, 4.], [1, 2.], [5, 2.], [8, 1.]],
                      columns=[0, 1.]),
            DataFrame([[2, 4], [1, 2], [5, 2], [8, 1.]],
                      columns=[1., 'X']), ]
    df2 = DataFrame([[None, 1, 1], [None, 1, 2],
                     [None, 3, 2], [None, 8, 1]], columns=['Y', 'Z', 'X'])
    s = Series([1, 1, 3, 8])

    def compare(self, result, expected):

        # since we have sorted the results
        # we can only compare non-nans
        result = result.dropna().values
        expected = expected.dropna().values

        tm.assert_numpy_array_equal(result, expected)

    @pytest.mark.parametrize('f', [lambda x: x.cov(), lambda x: x.corr()])
    def test_no_flex(self, f):

        # DataFrame methods (which do not call _flex_binary_moment())

        results = [f(df) for df in self.df1s]
        for (df, result) in zip(self.df1s, results):
            tm.assert_index_equal(result.index, df.columns)
            tm.assert_index_equal(result.columns, df.columns)
        for i, result in enumerate(results):
            if i > 0:
                self.compare(result, results[0])

    @pytest.mark.parametrize(
        'f', [lambda x: x.expanding().cov(pairwise=True),
              lambda x: x.expanding().corr(pairwise=True),
              lambda x: x.rolling(window=3).cov(pairwise=True),
              lambda x: x.rolling(window=3).corr(pairwise=True),
              lambda x: x.ewm(com=3).cov(pairwise=True),
              lambda x: x.ewm(com=3).corr(pairwise=True)])
    def test_pairwise_with_self(self, f):

        # DataFrame with itself, pairwise=True
        results = [f(df) for df in self.df1s]
        for (df, result) in zip(self.df1s, results):
            tm.assert_index_equal(result.index.levels[0],
                                  df.index,
                                  check_names=False)
            tm.assert_index_equal(result.index.levels[1],
                                  df.columns,
                                  check_names=False)
            tm.assert_index_equal(result.columns, df.columns)
        for i, result in enumerate(results):
            if i > 0:
                self.compare(result, results[0])

    @pytest.mark.parametrize(
        'f', [lambda x: x.expanding().cov(pairwise=False),
              lambda x: x.expanding().corr(pairwise=False),
              lambda x: x.rolling(window=3).cov(pairwise=False),
              lambda x: x.rolling(window=3).corr(pairwise=False),
              lambda x: x.ewm(com=3).cov(pairwise=False),
              lambda x: x.ewm(com=3).corr(pairwise=False), ])
    def test_no_pairwise_with_self(self, f):

        # DataFrame with itself, pairwise=False
        results = [f(df) for df in self.df1s]
        for (df, result) in zip(self.df1s, results):
            tm.assert_index_equal(result.index, df.index)
            tm.assert_index_equal(result.columns, df.columns)
        for i, result in enumerate(results):
            if i > 0:
                self.compare(result, results[0])

    @pytest.mark.parametrize(
        'f', [lambda x, y: x.expanding().cov(y, pairwise=True),
              lambda x, y: x.expanding().corr(y, pairwise=True),
              lambda x, y: x.rolling(window=3).cov(y, pairwise=True),
              lambda x, y: x.rolling(window=3).corr(y, pairwise=True),
              lambda x, y: x.ewm(com=3).cov(y, pairwise=True),
              lambda x, y: x.ewm(com=3).corr(y, pairwise=True), ])
    def test_pairwise_with_other(self, f):

        # DataFrame with another DataFrame, pairwise=True
        results = [f(df, self.df2) for df in self.df1s]
        for (df, result) in zip(self.df1s, results):
            tm.assert_index_equal(result.index.levels[0],
                                  df.index,
                                  check_names=False)
            tm.assert_index_equal(result.index.levels[1],
                                  self.df2.columns,
                                  check_names=False)
        for i, result in enumerate(results):
            if i > 0:
                self.compare(result, results[0])

    @pytest.mark.parametrize(
        'f', [lambda x, y: x.expanding().cov(y, pairwise=False),
              lambda x, y: x.expanding().corr(y, pairwise=False),
              lambda x, y: x.rolling(window=3).cov(y, pairwise=False),
              lambda x, y: x.rolling(window=3).corr(y, pairwise=False),
              lambda x, y: x.ewm(com=3).cov(y, pairwise=False),
              lambda x, y: x.ewm(com=3).corr(y, pairwise=False), ])
    def test_no_pairwise_with_other(self, f):

        # DataFrame with another DataFrame, pairwise=False
        results = [f(df, self.df2) if df.columns.is_unique else None
                   for df in self.df1s]
        for (df, result) in zip(self.df1s, results):
            if result is not None:
                with catch_warnings(record=True):
                    # we can have int and str columns
                    expected_index = df.index.union(self.df2.index)
                    expected_columns = df.columns.union(self.df2.columns)
                tm.assert_index_equal(result.index, expected_index)
                tm.assert_index_equal(result.columns, expected_columns)
            else:
                tm.assert_raises_regex(
                    ValueError, "'arg1' columns are not unique", f, df,
                    self.df2)
                tm.assert_raises_regex(
                    ValueError, "'arg2' columns are not unique", f,
                    self.df2, df)

    @pytest.mark.parametrize(
        'f', [lambda x, y: x.expanding().cov(y),
              lambda x, y: x.expanding().corr(y),
              lambda x, y: x.rolling(window=3).cov(y),
              lambda x, y: x.rolling(window=3).corr(y),
              lambda x, y: x.ewm(com=3).cov(y),
              lambda x, y: x.ewm(com=3).corr(y), ])
    def test_pairwise_with_series(self, f):

        # DataFrame with a Series
        results = ([f(df, self.s) for df in self.df1s] +
                   [f(self.s, df) for df in self.df1s])
        for (df, result) in zip(self.df1s, results):
            tm.assert_index_equal(result.index, df.index)
            tm.assert_index_equal(result.columns, df.columns)
        for i, result in enumerate(results):
            if i > 0:
                self.compare(result, results[0])


# create the data only once as we are not setting it
def _create_consistency_data():
    def create_series():
        return [Series(),
                Series([np.nan]),
                Series([np.nan, np.nan]),
                Series([3.]),
                Series([np.nan, 3.]),
                Series([3., np.nan]),
                Series([1., 3.]),
                Series([2., 2.]),
                Series([3., 1.]),
                Series([5., 5., 5., 5., np.nan, np.nan, np.nan, 5., 5., np.nan,
                        np.nan]),
                Series([np.nan, 5., 5., 5., np.nan, np.nan, np.nan, 5., 5.,
                        np.nan, np.nan]),
                Series([np.nan, np.nan, 5., 5., np.nan, np.nan, np.nan, 5., 5.,
                        np.nan, np.nan]),
                Series([np.nan, 3., np.nan, 3., 4., 5., 6., np.nan, np.nan, 7.,
                        12., 13., 14., 15.]),
                Series([np.nan, 5., np.nan, 2., 4., 0., 9., np.nan, np.nan, 3.,
                        12., 13., 14., 15.]),
                Series([2., 3., np.nan, 3., 4., 5., 6., np.nan, np.nan, 7.,
                        12., 13., 14., 15.]),
                Series([2., 5., np.nan, 2., 4., 0., 9., np.nan, np.nan, 3.,
                        12., 13., 14., 15.]),
                Series(range(10)),
                Series(range(20, 0, -2)), ]

    def create_dataframes():
        return ([DataFrame(),
                 DataFrame(columns=['a']),
                 DataFrame(columns=['a', 'a']),
                 DataFrame(columns=['a', 'b']),
                 DataFrame(np.arange(10).reshape((5, 2))),
                 DataFrame(np.arange(25).reshape((5, 5))),
                 DataFrame(np.arange(25).reshape((5, 5)),
                           columns=['a', 'b', 99, 'd', 'd'])] +
                [DataFrame(s) for s in create_series()])

    def is_constant(x):
        values = x.values.ravel()
        return len(set(values[notnull(values)])) == 1

    def no_nans(x):
        return x.notnull().all().all()

    # data is a tuple(object, is_contant, no_nans)
    data = create_series() + create_dataframes()

    return [(x, is_constant(x), no_nans(x)) for x in data]


_consistency_data = _create_consistency_data()


class TestMomentsConsistency(Base):
    base_functions = [
        (lambda v: Series(v).count(), None, 'count'),
        (lambda v: Series(v).max(), None, 'max'),
        (lambda v: Series(v).min(), None, 'min'),
        (lambda v: Series(v).sum(), None, 'sum'),
        (lambda v: Series(v).mean(), None, 'mean'),
        (lambda v: Series(v).std(), 1, 'std'),
        (lambda v: Series(v).cov(Series(v)), None, 'cov'),
        (lambda v: Series(v).corr(Series(v)), None, 'corr'),
        (lambda v: Series(v).var(), 1, 'var'),

        # restore once GH 8086 is fixed
        # lambda v: Series(v).skew(), 3, 'skew'),
        # (lambda v: Series(v).kurt(), 4, 'kurt'),

        # (lambda x, min_periods: mom.expanding_quantile(x, 0.3,
        # min_periods=min_periods, 'quantile'),

        # restore once GH 8084 is fixed
        # lambda v: Series(v).quantile(0.3), None, 'quantile'),

        (lambda v: Series(v).median(), None, 'median'),
        (np.nanmax, 1, 'max'),
        (np.nanmin, 1, 'min'),
        (np.nansum, 1, 'sum'),
    ]
    if np.__version__ >= LooseVersion('1.8.0'):
        base_functions += [
            (np.nanmean, 1, 'mean'),
            (lambda v: np.nanstd(v, ddof=1), 1, 'std'),
            (lambda v: np.nanvar(v, ddof=1), 1, 'var'),
        ]
    if np.__version__ >= LooseVersion('1.9.0'):
        base_functions += [(np.nanmedian, 1, 'median'), ]
    no_nan_functions = [
        (np.max, None, 'max'),
        (np.min, None, 'min'),
        (np.sum, None, 'sum'),
        (np.mean, None, 'mean'),
        (lambda v: np.std(v, ddof=1), 1, 'std'),
        (lambda v: np.var(v, ddof=1), 1, 'var'),
        (np.median, None, 'median'),
    ]

    def _create_data(self):
        super(TestMomentsConsistency, self)._create_data()
        self.data = _consistency_data

    def setup_method(self, method):
        self._create_data()

    def _test_moments_consistency(self, min_periods, count, mean, mock_mean,
                                  corr, var_unbiased=None, std_unbiased=None,
                                  cov_unbiased=None, var_biased=None,
                                  std_biased=None, cov_biased=None,
                                  var_debiasing_factors=None):
        def _non_null_values(x):
            values = x.values.ravel()
            return set(values[notnull(values)].tolist())

        for (x, is_constant, no_nans) in self.data:
            count_x = count(x)
            mean_x = mean(x)

            if mock_mean:
                # check that mean equals mock_mean
                expected = mock_mean(x)
                assert_equal(mean_x, expected.astype('float64'))

            # check that correlation of a series with itself is either 1 or NaN
            corr_x_x = corr(x, x)

            # assert _non_null_values(corr_x_x).issubset(set([1.]))
            # restore once rolling_cov(x, x) is identically equal to var(x)

            if is_constant:
                exp = x.max() if isinstance(x, Series) else x.max().max()

                # check mean of constant series
                expected = x * np.nan
                expected[count_x >= max(min_periods, 1)] = exp
                assert_equal(mean_x, expected)

                # check correlation of constant series with itself is NaN
                expected[:] = np.nan
                assert_equal(corr_x_x, expected)

            if var_unbiased and var_biased and var_debiasing_factors:
                # check variance debiasing factors
                var_unbiased_x = var_unbiased(x)
                var_biased_x = var_biased(x)
                var_debiasing_factors_x = var_debiasing_factors(x)
                assert_equal(var_unbiased_x, var_biased_x *
                             var_debiasing_factors_x)

            for (std, var, cov) in [(std_biased, var_biased, cov_biased),
                                    (std_unbiased, var_unbiased, cov_unbiased)
                                    ]:

                # check that var(x), std(x), and cov(x) are all >= 0
                var_x = var(x)
                std_x = std(x)
                assert not (var_x < 0).any().any()
                assert not (std_x < 0).any().any()
                if cov:
                    cov_x_x = cov(x, x)
                    assert not (cov_x_x < 0).any().any()

                    # check that var(x) == cov(x, x)
                    assert_equal(var_x, cov_x_x)

                # check that var(x) == std(x)^2
                assert_equal(var_x, std_x * std_x)

                if var is var_biased:
                    # check that biased var(x) == mean(x^2) - mean(x)^2
                    mean_x2 = mean(x * x)
                    assert_equal(var_x, mean_x2 - (mean_x * mean_x))

                if is_constant:
                    # check that variance of constant series is identically 0
                    assert not (var_x > 0).any().any()
                    expected = x * np.nan
                    expected[count_x >= max(min_periods, 1)] = 0.
                    if var is var_unbiased:
                        expected[count_x < 2] = np.nan
                    assert_equal(var_x, expected)

                if isinstance(x, Series):
                    for (y, is_constant, no_nans) in self.data:
                        if not x.isnull().equals(y.isnull()):
                            # can only easily test two Series with similar
                            # structure
                            continue

                        # check that cor(x, y) is symmetric
                        corr_x_y = corr(x, y)
                        corr_y_x = corr(y, x)
                        assert_equal(corr_x_y, corr_y_x)

                        if cov:
                            # check that cov(x, y) is symmetric
                            cov_x_y = cov(x, y)
                            cov_y_x = cov(y, x)
                            assert_equal(cov_x_y, cov_y_x)

                            # check that cov(x, y) == (var(x+y) - var(x) -
                            # var(y)) / 2
                            var_x_plus_y = var(x + y)
                            var_y = var(y)
                            assert_equal(cov_x_y, 0.5 *
                                         (var_x_plus_y - var_x - var_y))

                            # check that corr(x, y) == cov(x, y) / (std(x) *
                            # std(y))
                            std_y = std(y)
                            assert_equal(corr_x_y, cov_x_y / (std_x * std_y))

                            if cov is cov_biased:
                                # check that biased cov(x, y) == mean(x*y) -
                                # mean(x)*mean(y)
                                mean_y = mean(y)
                                mean_x_times_y = mean(x * y)
                                assert_equal(cov_x_y, mean_x_times_y -
                                             (mean_x * mean_y))

    @tm.slow
    def test_ewm_consistency(self):
        def _weights(s, com, adjust, ignore_na):
            if isinstance(s, DataFrame):
                if not len(s.columns):
                    return DataFrame(index=s.index, columns=s.columns)
                w = concat([
                    _weights(s.iloc[:, i], com=com, adjust=adjust,
                             ignore_na=ignore_na)
                    for i, _ in enumerate(s.columns)], axis=1)
                w.index = s.index
                w.columns = s.columns
                return w

            w = Series(np.nan, index=s.index)
            alpha = 1. / (1. + com)
            if ignore_na:
                w[s.notnull()] = _weights(s[s.notnull()], com=com,
                                          adjust=adjust, ignore_na=False)
            elif adjust:
                for i in range(len(s)):
                    if s.iat[i] == s.iat[i]:
                        w.iat[i] = pow(1. / (1. - alpha), i)
            else:
                sum_wts = 0.
                prev_i = -1
                for i in range(len(s)):
                    if s.iat[i] == s.iat[i]:
                        if prev_i == -1:
                            w.iat[i] = 1.
                        else:
                            w.iat[i] = alpha * sum_wts / pow(1. - alpha,
                                                             i - prev_i)
                        sum_wts += w.iat[i]
                        prev_i = i
            return w

        def _variance_debiasing_factors(s, com, adjust, ignore_na):
            weights = _weights(s, com=com, adjust=adjust, ignore_na=ignore_na)
            cum_sum = weights.cumsum().fillna(method='ffill')
            cum_sum_sq = (weights * weights).cumsum().fillna(method='ffill')
            numerator = cum_sum * cum_sum
            denominator = numerator - cum_sum_sq
            denominator[denominator <= 0.] = np.nan
            return numerator / denominator

        def _ewma(s, com, min_periods, adjust, ignore_na):
            weights = _weights(s, com=com, adjust=adjust, ignore_na=ignore_na)
            result = s.multiply(weights).cumsum().divide(weights.cumsum(
            )).fillna(method='ffill')
            result[s.expanding().count() < (max(min_periods, 1) if min_periods
                                            else 1)] = np.nan
            return result

        com = 3.
        for min_periods, adjust, ignore_na in product([0, 1, 2, 3, 4],
                                                      [True, False],
                                                      [False, True]):
            # test consistency between different ewm* moments
            self._test_moments_consistency(
                min_periods=min_periods,
                count=lambda x: x.expanding().count(),
                mean=lambda x: x.ewm(com=com, min_periods=min_periods,
                                     adjust=adjust,
                                     ignore_na=ignore_na).mean(),
                mock_mean=lambda x: _ewma(x, com=com,
                                          min_periods=min_periods,
                                          adjust=adjust,
                                          ignore_na=ignore_na),
                corr=lambda x, y: x.ewm(com=com, min_periods=min_periods,
                                        adjust=adjust,
                                        ignore_na=ignore_na).corr(y),
                var_unbiased=lambda x: (
                    x.ewm(com=com, min_periods=min_periods,
                          adjust=adjust,
                          ignore_na=ignore_na).var(bias=False)),
                std_unbiased=lambda x: (
                    x.ewm(com=com, min_periods=min_periods,
                          adjust=adjust, ignore_na=ignore_na)
                    .std(bias=False)),
                cov_unbiased=lambda x, y: (
                    x.ewm(com=com, min_periods=min_periods,
                          adjust=adjust, ignore_na=ignore_na)
                    .cov(y, bias=False)),
                var_biased=lambda x: (
                    x.ewm(com=com, min_periods=min_periods,
                          adjust=adjust, ignore_na=ignore_na)
                    .var(bias=True)),
                std_biased=lambda x: x.ewm(com=com, min_periods=min_periods,
                                           adjust=adjust,
                                           ignore_na=ignore_na).std(bias=True),
                cov_biased=lambda x, y: (
                    x.ewm(com=com, min_periods=min_periods,
                          adjust=adjust, ignore_na=ignore_na)
                    .cov(y, bias=True)),
                var_debiasing_factors=lambda x: (
                    _variance_debiasing_factors(x, com=com, adjust=adjust,
                                                ignore_na=ignore_na)))

    @tm.slow
    def test_expanding_consistency(self):

        # suppress warnings about empty slices, as we are deliberately testing
        # with empty/0-length Series/DataFrames
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore",
                                    message=".*(empty slice|0 for slice).*",
                                    category=RuntimeWarning)

            for min_periods in [0, 1, 2, 3, 4]:

                # test consistency between different expanding_* moments
                self._test_moments_consistency(
                    min_periods=min_periods,
                    count=lambda x: x.expanding().count(),
                    mean=lambda x: x.expanding(
                        min_periods=min_periods).mean(),
                    mock_mean=lambda x: x.expanding(
                        min_periods=min_periods).sum() / x.expanding().count(),
                    corr=lambda x, y: x.expanding(
                        min_periods=min_periods).corr(y),
                    var_unbiased=lambda x: x.expanding(
                        min_periods=min_periods).var(),
                    std_unbiased=lambda x: x.expanding(
                        min_periods=min_periods).std(),
                    cov_unbiased=lambda x, y: x.expanding(
                        min_periods=min_periods).cov(y),
                    var_biased=lambda x: x.expanding(
                        min_periods=min_periods).var(ddof=0),
                    std_biased=lambda x: x.expanding(
                        min_periods=min_periods).std(ddof=0),
                    cov_biased=lambda x, y: x.expanding(
                        min_periods=min_periods).cov(y, ddof=0),
                    var_debiasing_factors=lambda x: (
                        x.expanding().count() /
                        (x.expanding().count() - 1.)
                        .replace(0., np.nan)))

                # test consistency between expanding_xyz() and either (a)
                # expanding_apply of Series.xyz(), or (b) expanding_apply of
                # np.nanxyz()
                for (x, is_constant, no_nans) in self.data:
                    functions = self.base_functions

                    # GH 8269
                    if no_nans:
                        functions = self.base_functions + self.no_nan_functions
                    for (f, require_min_periods, name) in functions:
                        expanding_f = getattr(
                            x.expanding(min_periods=min_periods), name)

                        if (require_min_periods and
                                (min_periods is not None) and
                                (min_periods < require_min_periods)):
                            continue

                        if name == 'count':
                            expanding_f_result = expanding_f()
                            expanding_apply_f_result = x.expanding(
                                min_periods=0).apply(func=f)
                        else:
                            if name in ['cov', 'corr']:
                                expanding_f_result = expanding_f(
                                    pairwise=False)
                            else:
                                expanding_f_result = expanding_f()
                            expanding_apply_f_result = x.expanding(
                                min_periods=min_periods).apply(func=f)

                        if not tm._incompat_bottleneck_version(name):
                            assert_equal(expanding_f_result,
                                         expanding_apply_f_result)

    @tm.slow
    def test_rolling_consistency(self):

        # suppress warnings about empty slices, as we are deliberately testing
        # with empty/0-length Series/DataFrames
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore",
                                    message=".*(empty slice|0 for slice).*",
                                    category=RuntimeWarning)

            def cases():
                for window in [1, 2, 3, 10, 20]:
                    for min_periods in set([0, 1, 2, 3, 4, window]):
                        if min_periods and (min_periods > window):
                            continue
                        for center in [False, True]:
                            yield window, min_periods, center

            for window, min_periods, center in cases():
                # test consistency between different rolling_* moments
                self._test_moments_consistency(
                    min_periods=min_periods,
                    count=lambda x: (
                        x.rolling(window=window, center=center)
                        .count()),
                    mean=lambda x: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).mean()),
                    mock_mean=lambda x: (
                        x.rolling(window=window,
                                  min_periods=min_periods,
                                  center=center).sum()
                        .divide(x.rolling(window=window,
                                          min_periods=min_periods,
                                          center=center).count())),
                    corr=lambda x, y: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).corr(y)),

                    var_unbiased=lambda x: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).var()),

                    std_unbiased=lambda x: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).std()),

                    cov_unbiased=lambda x, y: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).cov(y)),

                    var_biased=lambda x: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).var(ddof=0)),

                    std_biased=lambda x: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).std(ddof=0)),

                    cov_biased=lambda x, y: (
                        x.rolling(window=window, min_periods=min_periods,
                                  center=center).cov(y, ddof=0)),
                    var_debiasing_factors=lambda x: (
                        x.rolling(window=window, center=center).count()
                        .divide((x.rolling(window=window, center=center)
                                 .count() - 1.)
                                .replace(0., np.nan))))

                # test consistency between rolling_xyz() and either (a)
                # rolling_apply of Series.xyz(), or (b) rolling_apply of
                # np.nanxyz()
                for (x, is_constant, no_nans) in self.data:
                    functions = self.base_functions

                    # GH 8269
                    if no_nans:
                        functions = self.base_functions + self.no_nan_functions
                    for (f, require_min_periods, name) in functions:
                        rolling_f = getattr(
                            x.rolling(window=window, center=center,
                                      min_periods=min_periods), name)

                        if require_min_periods and (
                                min_periods is not None) and (
                                    min_periods < require_min_periods):
                            continue

                        if name == 'count':
                            rolling_f_result = rolling_f()
                            rolling_apply_f_result = x.rolling(
                                window=window, min_periods=0,
                                center=center).apply(func=f)
                        else:
                            if name in ['cov', 'corr']:
                                rolling_f_result = rolling_f(
                                    pairwise=False)
                            else:
                                rolling_f_result = rolling_f()
                            rolling_apply_f_result = x.rolling(
                                window=window, min_periods=min_periods,
                                center=center).apply(func=f)
                        if not tm._incompat_bottleneck_version(name):
                            assert_equal(rolling_f_result,
                                         rolling_apply_f_result)

    # binary moments
    def test_rolling_cov(self):
        A = self.series
        B = A + randn(len(A))

        result = A.rolling(window=50, min_periods=25).cov(B)
        tm.assert_almost_equal(result[-1], np.cov(A[-50:], B[-50:])[0, 1])

    def test_rolling_cov_pairwise(self):
        self._check_pairwise_moment('rolling', 'cov', window=10, min_periods=5)

    def test_rolling_corr(self):
        A = self.series
        B = A + randn(len(A))

        result = A.rolling(window=50, min_periods=25).corr(B)
        tm.assert_almost_equal(result[-1], np.corrcoef(A[-50:], B[-50:])[0, 1])

        # test for correct bias correction
        a = tm.makeTimeSeries()
        b = tm.makeTimeSeries()
        a[:5] = np.nan
        b[:10] = np.nan

        result = a.rolling(window=len(a), min_periods=1).corr(b)
        tm.assert_almost_equal(result[-1], a.corr(b))

    def test_rolling_corr_pairwise(self):
        self._check_pairwise_moment('rolling', 'corr', window=10,
                                    min_periods=5)

    def _check_pairwise_moment(self, dispatch, name, **kwargs):
        def get_result(obj, obj2=None):
            return getattr(getattr(obj, dispatch)(**kwargs), name)(obj2)

        result = get_result(self.frame)
        result = result.loc[(slice(None), 1), 5]
        result.index = result.index.droplevel(1)
        expected = get_result(self.frame[1], self.frame[5])
        tm.assert_series_equal(result, expected, check_names=False)

    def test_flex_binary_moment(self):
        # GH3155
        # don't blow the stack
        pytest.raises(TypeError, rwindow._flex_binary_moment, 5, 6, None)

    def test_corr_sanity(self):
        # GH 3155
        df = DataFrame(np.array(
            [[0.87024726, 0.18505595], [0.64355431, 0.3091617],
             [0.92372966, 0.50552513], [0.00203756, 0.04520709],
             [0.84780328, 0.33394331], [0.78369152, 0.63919667]]))

        res = df[0].rolling(5, center=True).corr(df[1])
        assert all([np.abs(np.nan_to_num(x)) <= 1 for x in res])

        # and some fuzzing
        for _ in range(10):
            df = DataFrame(np.random.rand(30, 2))
            res = df[0].rolling(5, center=True).corr(df[1])
            try:
                assert all([np.abs(np.nan_to_num(x)) <= 1 for x in res])
            except AssertionError:
                print(res)

    def test_flex_binary_frame(self):
        def _check(method):
            series = self.frame[1]

            res = getattr(series.rolling(window=10), method)(self.frame)
            res2 = getattr(self.frame.rolling(window=10), method)(series)
            exp = self.frame.apply(lambda x: getattr(
                series.rolling(window=10), method)(x))

            tm.assert_frame_equal(res, exp)
            tm.assert_frame_equal(res2, exp)

            frame2 = self.frame.copy()
            frame2.values[:] = np.random.randn(*frame2.shape)

            res3 = getattr(self.frame.rolling(window=10), method)(frame2)
            exp = DataFrame(dict((k, getattr(self.frame[k].rolling(
                window=10), method)(frame2[k])) for k in self.frame))
            tm.assert_frame_equal(res3, exp)

        methods = ['corr', 'cov']
        for meth in methods:
            _check(meth)

    def test_ewmcov(self):
        self._check_binary_ew('cov')

    def test_ewmcov_pairwise(self):
        self._check_pairwise_moment('ewm', 'cov', span=10, min_periods=5)

    def test_ewmcorr(self):
        self._check_binary_ew('corr')

    def test_ewmcorr_pairwise(self):
        self._check_pairwise_moment('ewm', 'corr', span=10, min_periods=5)

    def _check_binary_ew(self, name):
        def func(A, B, com, **kwargs):
            return getattr(A.ewm(com, **kwargs), name)(B)

        A = Series(randn(50), index=np.arange(50))
        B = A[2:] + randn(48)

        A[:10] = np.NaN
        B[-10:] = np.NaN

        result = func(A, B, 20, min_periods=5)
        assert np.isnan(result.values[:14]).all()
        assert not np.isnan(result.values[14:]).any()

        # GH 7898
        for min_periods in (0, 1, 2):
            result = func(A, B, 20, min_periods=min_periods)
            # binary functions (ewmcov, ewmcorr) with bias=False require at
            # least two values
            assert np.isnan(result.values[:11]).all()
            assert not np.isnan(result.values[11:]).any()

            # check series of length 0
            result = func(Series([]), Series([]), 50, min_periods=min_periods)
            tm.assert_series_equal(result, Series([]))

            # check series of length 1
            result = func(
                Series([1.]), Series([1.]), 50, min_periods=min_periods)
            tm.assert_series_equal(result, Series([np.NaN]))

        pytest.raises(Exception, func, A, randn(50), 20, min_periods=5)

    def test_expanding_apply(self):
        ser = Series([])
        tm.assert_series_equal(ser, ser.expanding().apply(lambda x: x.mean()))

        def expanding_mean(x, min_periods=1, freq=None):
            return mom.expanding_apply(x, lambda x: x.mean(),
                                       min_periods=min_periods, freq=freq)

        self._check_expanding(expanding_mean, np.mean)

        # GH 8080
        s = Series([None, None, None])
        result = s.expanding(min_periods=0).apply(lambda x: len(x))
        expected = Series([1., 2., 3.])
        tm.assert_series_equal(result, expected)

    def test_expanding_apply_args_kwargs(self):
        def mean_w_arg(x, const):
            return np.mean(x) + const

        df = DataFrame(np.random.rand(20, 3))

        expected = df.expanding().apply(np.mean) + 20.

        tm.assert_frame_equal(df.expanding().apply(mean_w_arg, args=(20, )),
                              expected)
        tm.assert_frame_equal(df.expanding().apply(mean_w_arg,
                                                   kwargs={'const': 20}),
                              expected)

    def test_expanding_corr(self):
        A = self.series.dropna()
        B = (A + randn(len(A)))[:-5]

        result = A.expanding().corr(B)

        rolling_result = A.rolling(window=len(A), min_periods=1).corr(B)

        tm.assert_almost_equal(rolling_result, result)

    def test_expanding_count(self):
        result = self.series.expanding().count()
        tm.assert_almost_equal(result, self.series.rolling(
            window=len(self.series)).count())

    def test_expanding_quantile(self):
        result = self.series.expanding().quantile(0.5)

        rolling_result = self.series.rolling(window=len(self.series),
                                             min_periods=1).quantile(0.5)

        tm.assert_almost_equal(result, rolling_result)

    def test_expanding_cov(self):
        A = self.series
        B = (A + randn(len(A)))[:-5]

        result = A.expanding().cov(B)

        rolling_result = A.rolling(window=len(A), min_periods=1).cov(B)

        tm.assert_almost_equal(rolling_result, result)

    def test_expanding_max(self):
        self._check_expanding(mom.expanding_max, np.max, preserve_nan=False)

    def test_expanding_cov_pairwise(self):
        result = self.frame.expanding().corr()

        rolling_result = self.frame.rolling(window=len(self.frame),
                                            min_periods=1).corr()

        tm.assert_frame_equal(result, rolling_result)

    def test_expanding_corr_pairwise(self):
        result = self.frame.expanding().corr()

        rolling_result = self.frame.rolling(window=len(self.frame),
                                            min_periods=1).corr()
        tm.assert_frame_equal(result, rolling_result)

    def test_expanding_cov_diff_index(self):
        # GH 7512
        s1 = Series([1, 2, 3], index=[0, 1, 2])
        s2 = Series([1, 3], index=[0, 2])
        result = s1.expanding().cov(s2)
        expected = Series([None, None, 2.0])
        tm.assert_series_equal(result, expected)

        s2a = Series([1, None, 3], index=[0, 1, 2])
        result = s1.expanding().cov(s2a)
        tm.assert_series_equal(result, expected)

        s1 = Series([7, 8, 10], index=[0, 1, 3])
        s2 = Series([7, 9, 10], index=[0, 2, 3])
        result = s1.expanding().cov(s2)
        expected = Series([None, None, None, 4.5])
        tm.assert_series_equal(result, expected)

    def test_expanding_corr_diff_index(self):
        # GH 7512
        s1 = Series([1, 2, 3], index=[0, 1, 2])
        s2 = Series([1, 3], index=[0, 2])
        result = s1.expanding().corr(s2)
        expected = Series([None, None, 1.0])
        tm.assert_series_equal(result, expected)

        s2a = Series([1, None, 3], index=[0, 1, 2])
        result = s1.expanding().corr(s2a)
        tm.assert_series_equal(result, expected)

        s1 = Series([7, 8, 10], index=[0, 1, 3])
        s2 = Series([7, 9, 10], index=[0, 2, 3])
        result = s1.expanding().corr(s2)
        expected = Series([None, None, None, 1.])
        tm.assert_series_equal(result, expected)

    def test_rolling_cov_diff_length(self):
        # GH 7512
        s1 = Series([1, 2, 3], index=[0, 1, 2])
        s2 = Series([1, 3], index=[0, 2])
        result = s1.rolling(window=3, min_periods=2).cov(s2)
        expected = Series([None, None, 2.0])
        tm.assert_series_equal(result, expected)

        s2a = Series([1, None, 3], index=[0, 1, 2])
        result = s1.rolling(window=3, min_periods=2).cov(s2a)
        tm.assert_series_equal(result, expected)

    def test_rolling_corr_diff_length(self):
        # GH 7512
        s1 = Series([1, 2, 3], index=[0, 1, 2])
        s2 = Series([1, 3], index=[0, 2])
        result = s1.rolling(window=3, min_periods=2).corr(s2)
        expected = Series([None, None, 1.0])
        tm.assert_series_equal(result, expected)

        s2a = Series([1, None, 3], index=[0, 1, 2])
        result = s1.rolling(window=3, min_periods=2).corr(s2a)
        tm.assert_series_equal(result, expected)

    def test_rolling_functions_window_non_shrinkage(self):
        # GH 7764
        s = Series(range(4))
        s_expected = Series(np.nan, index=s.index)
        df = DataFrame([[1, 5], [3, 2], [3, 9], [-1, 0]], columns=['A', 'B'])
        df_expected = DataFrame(np.nan, index=df.index, columns=df.columns)

        functions = [lambda x: (x.rolling(window=10, min_periods=5)
                                .cov(x, pairwise=False)),
                     lambda x: (x.rolling(window=10, min_periods=5)
                                .corr(x, pairwise=False)),
                     lambda x: x.rolling(window=10, min_periods=5).max(),
                     lambda x: x.rolling(window=10, min_periods=5).min(),
                     lambda x: x.rolling(window=10, min_periods=5).sum(),
                     lambda x: x.rolling(window=10, min_periods=5).mean(),
                     lambda x: x.rolling(window=10, min_periods=5).std(),
                     lambda x: x.rolling(window=10, min_periods=5).var(),
                     lambda x: x.rolling(window=10, min_periods=5).skew(),
                     lambda x: x.rolling(window=10, min_periods=5).kurt(),
                     lambda x: x.rolling(
                         window=10, min_periods=5).quantile(quantile=0.5),
                     lambda x: x.rolling(window=10, min_periods=5).median(),
                     lambda x: x.rolling(window=10, min_periods=5).apply(sum),
                     lambda x: x.rolling(win_type='boxcar',
                                         window=10, min_periods=5).mean()]
        for f in functions:
            try:
                s_result = f(s)
                tm.assert_series_equal(s_result, s_expected)

                df_result = f(df)
                tm.assert_frame_equal(df_result, df_expected)
            except (ImportError):

                # scipy needed for rolling_window
                continue

    def test_rolling_functions_window_non_shrinkage_binary(self):

        # corr/cov return a MI DataFrame
        df = DataFrame([[1, 5], [3, 2], [3, 9], [-1, 0]],
                       columns=Index(['A', 'B'], name='foo'),
                       index=Index(range(4), name='bar'))
        df_expected = DataFrame(
            columns=Index(['A', 'B'], name='foo'),
            index=pd.MultiIndex.from_product([df.index, df.columns],
                                             names=['bar', 'foo']),
            dtype='float64')
        functions = [lambda x: (x.rolling(window=10, min_periods=5)
                                .cov(x, pairwise=True)),
                     lambda x: (x.rolling(window=10, min_periods=5)
                                .corr(x, pairwise=True))]
        for f in functions:
            df_result = f(df)
            tm.assert_frame_equal(df_result, df_expected)

    def test_moment_functions_zero_length(self):
        # GH 8056
        s = Series()
        s_expected = s
        df1 = DataFrame()
        df1_expected = df1
        df2 = DataFrame(columns=['a'])
        df2['a'] = df2['a'].astype('float64')
        df2_expected = df2

        functions = [lambda x: x.expanding().count(),
                     lambda x: x.expanding(min_periods=5).cov(
                         x, pairwise=False),
                     lambda x: x.expanding(min_periods=5).corr(
                         x, pairwise=False),
                     lambda x: x.expanding(min_periods=5).max(),
                     lambda x: x.expanding(min_periods=5).min(),
                     lambda x: x.expanding(min_periods=5).sum(),
                     lambda x: x.expanding(min_periods=5).mean(),
                     lambda x: x.expanding(min_periods=5).std(),
                     lambda x: x.expanding(min_periods=5).var(),
                     lambda x: x.expanding(min_periods=5).skew(),
                     lambda x: x.expanding(min_periods=5).kurt(),
                     lambda x: x.expanding(min_periods=5).quantile(0.5),
                     lambda x: x.expanding(min_periods=5).median(),
                     lambda x: x.expanding(min_periods=5).apply(sum),
                     lambda x: x.rolling(window=10).count(),
                     lambda x: x.rolling(window=10, min_periods=5).cov(
                         x, pairwise=False),
                     lambda x: x.rolling(window=10, min_periods=5).corr(
                         x, pairwise=False),
                     lambda x: x.rolling(window=10, min_periods=5).max(),
                     lambda x: x.rolling(window=10, min_periods=5).min(),
                     lambda x: x.rolling(window=10, min_periods=5).sum(),
                     lambda x: x.rolling(window=10, min_periods=5).mean(),
                     lambda x: x.rolling(window=10, min_periods=5).std(),
                     lambda x: x.rolling(window=10, min_periods=5).var(),
                     lambda x: x.rolling(window=10, min_periods=5).skew(),
                     lambda x: x.rolling(window=10, min_periods=5).kurt(),
                     lambda x: x.rolling(
                         window=10, min_periods=5).quantile(0.5),
                     lambda x: x.rolling(window=10, min_periods=5).median(),
                     lambda x: x.rolling(window=10, min_periods=5).apply(sum),
                     lambda x: x.rolling(win_type='boxcar',
                                         window=10, min_periods=5).mean(),
                     ]
        for f in functions:
            try:
                s_result = f(s)
                tm.assert_series_equal(s_result, s_expected)

                df1_result = f(df1)
                tm.assert_frame_equal(df1_result, df1_expected)

                df2_result = f(df2)
                tm.assert_frame_equal(df2_result, df2_expected)
            except (ImportError):

                # scipy needed for rolling_window
                continue

    def test_moment_functions_zero_length_pairwise(self):

        df1 = DataFrame()
        df1_expected = df1
        df2 = DataFrame(columns=Index(['a'], name='foo'),
                        index=Index([], name='bar'))
        df2['a'] = df2['a'].astype('float64')

        df1_expected = DataFrame(
            index=pd.MultiIndex.from_product([df1.index, df1.columns]),
            columns=Index([]))
        df2_expected = DataFrame(
            index=pd.MultiIndex.from_product([df2.index, df2.columns],
                                             names=['bar', 'foo']),
            columns=Index(['a'], name='foo'),
            dtype='float64')

        functions = [lambda x: (x.expanding(min_periods=5)
                                .cov(x, pairwise=True)),
                     lambda x: (x.expanding(min_periods=5)
                                .corr(x, pairwise=True)),
                     lambda x: (x.rolling(window=10, min_periods=5)
                                .cov(x, pairwise=True)),
                     lambda x: (x.rolling(window=10, min_periods=5)
                                .corr(x, pairwise=True)),
                     ]
        for f in functions:
            df1_result = f(df1)
            tm.assert_frame_equal(df1_result, df1_expected)

            df2_result = f(df2)
            tm.assert_frame_equal(df2_result, df2_expected)

    def test_expanding_cov_pairwise_diff_length(self):
        # GH 7512
        df1 = DataFrame([[1, 5], [3, 2], [3, 9]],
                        columns=Index(['A', 'B'], name='foo'))
        df1a = DataFrame([[1, 5], [3, 9]],
                         index=[0, 2],
                         columns=Index(['A', 'B'], name='foo'))
        df2 = DataFrame([[5, 6], [None, None], [2, 1]],
                        columns=Index(['X', 'Y'], name='foo'))
        df2a = DataFrame([[5, 6], [2, 1]],
                         index=[0, 2],
                         columns=Index(['X', 'Y'], name='foo'))
        # TODO: xref gh-15826
        # .loc is not preserving the names
        result1 = df1.expanding().cov(df2a, pairwise=True).loc[2]
        result2 = df1.expanding().cov(df2a, pairwise=True).loc[2]
        result3 = df1a.expanding().cov(df2, pairwise=True).loc[2]
        result4 = df1a.expanding().cov(df2a, pairwise=True).loc[2]
        expected = DataFrame([[-3.0, -6.0], [-5.0, -10.0]],
                             columns=Index(['A', 'B'], name='foo'),
                             index=Index(['X', 'Y'], name='foo'))
        tm.assert_frame_equal(result1, expected)
        tm.assert_frame_equal(result2, expected)
        tm.assert_frame_equal(result3, expected)
        tm.assert_frame_equal(result4, expected)

    def test_expanding_corr_pairwise_diff_length(self):
        # GH 7512
        df1 = DataFrame([[1, 2], [3, 2], [3, 4]],
                        columns=['A', 'B'],
                        index=Index(range(3), name='bar'))
        df1a = DataFrame([[1, 2], [3, 4]],
                         index=Index([0, 2], name='bar'),
                         columns=['A', 'B'])
        df2 = DataFrame([[5, 6], [None, None], [2, 1]],
                        columns=['X', 'Y'],
                        index=Index(range(3), name='bar'))
        df2a = DataFrame([[5, 6], [2, 1]],
                         index=Index([0, 2], name='bar'),
                         columns=['X', 'Y'])
        result1 = df1.expanding().corr(df2, pairwise=True).loc[2]
        result2 = df1.expanding().corr(df2a, pairwise=True).loc[2]
        result3 = df1a.expanding().corr(df2, pairwise=True).loc[2]
        result4 = df1a.expanding().corr(df2a, pairwise=True).loc[2]
        expected = DataFrame([[-1.0, -1.0], [-1.0, -1.0]],
                             columns=['A', 'B'],
                             index=Index(['X', 'Y']))
        tm.assert_frame_equal(result1, expected)
        tm.assert_frame_equal(result2, expected)
        tm.assert_frame_equal(result3, expected)
        tm.assert_frame_equal(result4, expected)

    def test_rolling_skew_edge_cases(self):

        all_nan = Series([np.NaN] * 5)

        # yields all NaN (0 variance)
        d = Series([1] * 5)
        x = d.rolling(window=5).skew()
        tm.assert_series_equal(all_nan, x)

        # yields all NaN (window too small)
        d = Series(np.random.randn(5))
        x = d.rolling(window=2).skew()
        tm.assert_series_equal(all_nan, x)

        # yields [NaN, NaN, NaN, 0.177994, 1.548824]
        d = Series([-1.50837035, -0.1297039, 0.19501095, 1.73508164, 0.41941401
                    ])
        expected = Series([np.NaN, np.NaN, np.NaN, 0.177994, 1.548824])
        x = d.rolling(window=4).skew()
        tm.assert_series_equal(expected, x)

    def test_rolling_kurt_edge_cases(self):

        all_nan = Series([np.NaN] * 5)

        # yields all NaN (0 variance)
        d = Series([1] * 5)
        x = d.rolling(window=5).kurt()
        tm.assert_series_equal(all_nan, x)

        # yields all NaN (window too small)
        d = Series(np.random.randn(5))
        x = d.rolling(window=3).kurt()
        tm.assert_series_equal(all_nan, x)

        # yields [NaN, NaN, NaN, 1.224307, 2.671499]
        d = Series([-1.50837035, -0.1297039, 0.19501095, 1.73508164, 0.41941401
                    ])
        expected = Series([np.NaN, np.NaN, np.NaN, 1.224307, 2.671499])
        x = d.rolling(window=4).kurt()
        tm.assert_series_equal(expected, x)

    def _check_expanding_ndarray(self, func, static_comp, has_min_periods=True,
                                 has_time_rule=True, preserve_nan=True):
        result = func(self.arr)

        tm.assert_almost_equal(result[10], static_comp(self.arr[:11]))

        if preserve_nan:
            assert (np.isnan(result[self._nan_locs]).all())

        arr = randn(50)

        if has_min_periods:
            result = func(arr, min_periods=30)
            assert (np.isnan(result[:29]).all())
            tm.assert_almost_equal(result[-1], static_comp(arr[:50]))

            # min_periods is working correctly
            result = func(arr, min_periods=15)
            assert np.isnan(result[13])
            assert not np.isnan(result[14])

            arr2 = randn(20)
            result = func(arr2, min_periods=5)
            assert isnull(result[3])
            assert notnull(result[4])

            # min_periods=0
            result0 = func(arr, min_periods=0)
            result1 = func(arr, min_periods=1)
            tm.assert_almost_equal(result0, result1)
        else:
            result = func(arr)
            tm.assert_almost_equal(result[-1], static_comp(arr[:50]))

    def _check_expanding_structures(self, func):
        series_result = func(self.series)
        assert isinstance(series_result, Series)
        frame_result = func(self.frame)
        assert type(frame_result) == DataFrame

    def _check_expanding(self, func, static_comp, has_min_periods=True,
                         has_time_rule=True, preserve_nan=True):
        with warnings.catch_warnings(record=True):
            self._check_expanding_ndarray(func, static_comp,
                                          has_min_periods=has_min_periods,
                                          has_time_rule=has_time_rule,
                                          preserve_nan=preserve_nan)
        with warnings.catch_warnings(record=True):
            self._check_expanding_structures(func)

    def test_rolling_max_gh6297(self):
        """Replicate result expected in GH #6297"""

        indices = [datetime(1975, 1, i) for i in range(1, 6)]
        # So that we can have 2 datapoints on one of the days
        indices.append(datetime(1975, 1, 3, 6, 0))
        series = Series(range(1, 7), index=indices)
        # Use floats instead of ints as values
        series = series.map(lambda x: float(x))
        # Sort chronologically
        series = series.sort_index()

        expected = Series([1.0, 2.0, 6.0, 4.0, 5.0],
                          index=[datetime(1975, 1, i, 0) for i in range(1, 6)])
        with catch_warnings(record=True):
            x = series.rolling(window=1, freq='D').max()
        tm.assert_series_equal(expected, x)

    def test_rolling_max_how_resample(self):

        indices = [datetime(1975, 1, i) for i in range(1, 6)]
        # So that we can have 3 datapoints on last day (4, 10, and 20)
        indices.append(datetime(1975, 1, 5, 1))
        indices.append(datetime(1975, 1, 5, 2))
        series = Series(list(range(0, 5)) + [10, 20], index=indices)
        # Use floats instead of ints as values
        series = series.map(lambda x: float(x))
        # Sort chronologically
        series = series.sort_index()

        # Default how should be max
        expected = Series([0.0, 1.0, 2.0, 3.0, 20.0],
                          index=[datetime(1975, 1, i, 0) for i in range(1, 6)])
        with catch_warnings(record=True):
            x = series.rolling(window=1, freq='D').max()
        tm.assert_series_equal(expected, x)

        # Now specify median (10.0)
        expected = Series([0.0, 1.0, 2.0, 3.0, 10.0],
                          index=[datetime(1975, 1, i, 0) for i in range(1, 6)])
        with catch_warnings(record=True):
            x = series.rolling(window=1, freq='D').max(how='median')
        tm.assert_series_equal(expected, x)

        # Now specify mean (4+10+20)/3
        v = (4.0 + 10.0 + 20.0) / 3.0
        expected = Series([0.0, 1.0, 2.0, 3.0, v],
                          index=[datetime(1975, 1, i, 0) for i in range(1, 6)])
        with catch_warnings(record=True):
            x = series.rolling(window=1, freq='D').max(how='mean')
            tm.assert_series_equal(expected, x)

    def test_rolling_min_how_resample(self):

        indices = [datetime(1975, 1, i) for i in range(1, 6)]
        # So that we can have 3 datapoints on last day (4, 10, and 20)
        indices.append(datetime(1975, 1, 5, 1))
        indices.append(datetime(1975, 1, 5, 2))
        series = Series(list(range(0, 5)) + [10, 20], index=indices)
        # Use floats instead of ints as values
        series = series.map(lambda x: float(x))
        # Sort chronologically
        series = series.sort_index()

        # Default how should be min
        expected = Series([0.0, 1.0, 2.0, 3.0, 4.0],
                          index=[datetime(1975, 1, i, 0) for i in range(1, 6)])
        with catch_warnings(record=True):
            r = series.rolling(window=1, freq='D')
            tm.assert_series_equal(expected, r.min())

    def test_rolling_median_how_resample(self):

        indices = [datetime(1975, 1, i) for i in range(1, 6)]
        # So that we can have 3 datapoints on last day (4, 10, and 20)
        indices.append(datetime(1975, 1, 5, 1))
        indices.append(datetime(1975, 1, 5, 2))
        series = Series(list(range(0, 5)) + [10, 20], index=indices)
        # Use floats instead of ints as values
        series = series.map(lambda x: float(x))
        # Sort chronologically
        series = series.sort_index()

        # Default how should be median
        expected = Series([0.0, 1.0, 2.0, 3.0, 10],
                          index=[datetime(1975, 1, i, 0) for i in range(1, 6)])
        with catch_warnings(record=True):
            x = series.rolling(window=1, freq='D').median()
            tm.assert_series_equal(expected, x)

    def test_rolling_median_memory_error(self):
        # GH11722
        n = 20000
        Series(np.random.randn(n)).rolling(window=2, center=False).median()
        Series(np.random.randn(n)).rolling(window=2, center=False).median()

    def test_rolling_min_max_numeric_types(self):

        # GH12373
        types_test = [np.dtype("f{}".format(width)) for width in [4, 8]]
        types_test.extend([np.dtype("{}{}".format(sign, width))
                           for width in [1, 2, 4, 8] for sign in "ui"])
        for data_type in types_test:
            # Just testing that these don't throw exceptions and that
            # the return type is float64. Other tests will cover quantitative
            # correctness
            result = (DataFrame(np.arange(20, dtype=data_type))
                      .rolling(window=5).max())
            assert result.dtypes[0] == np.dtype("f8")
            result = (DataFrame(np.arange(20, dtype=data_type))
                      .rolling(window=5).min())
            assert result.dtypes[0] == np.dtype("f8")


class TestGrouperGrouping(object):

    def setup_method(self, method):
        self.series = Series(np.arange(10))
        self.frame = DataFrame({'A': [1] * 20 + [2] * 12 + [3] * 8,
                                'B': np.arange(40)})

    def test_mutated(self):

        def f():
            self.frame.groupby('A', foo=1)
        pytest.raises(TypeError, f)

        g = self.frame.groupby('A')
        assert not g.mutated
        g = self.frame.groupby('A', mutated=True)
        assert g.mutated

    def test_getitem(self):
        g = self.frame.groupby('A')
        g_mutated = self.frame.groupby('A', mutated=True)

        expected = g_mutated.B.apply(lambda x: x.rolling(2).mean())

        result = g.rolling(2).mean().B
        tm.assert_series_equal(result, expected)

        result = g.rolling(2).B.mean()
        tm.assert_series_equal(result, expected)

        result = g.B.rolling(2).mean()
        tm.assert_series_equal(result, expected)

        result = self.frame.B.groupby(self.frame.A).rolling(2).mean()
        tm.assert_series_equal(result, expected)

    def test_getitem_multiple(self):

        # GH 13174
        g = self.frame.groupby('A')
        r = g.rolling(2)
        g_mutated = self.frame.groupby('A', mutated=True)
        expected = g_mutated.B.apply(lambda x: x.rolling(2).count())

        result = r.B.count()
        tm.assert_series_equal(result, expected)

        result = r.B.count()
        tm.assert_series_equal(result, expected)

    def test_rolling(self):
        g = self.frame.groupby('A')
        r = g.rolling(window=4)

        for f in ['sum', 'mean', 'min', 'max', 'count', 'kurt', 'skew']:

            result = getattr(r, f)()
            expected = g.apply(lambda x: getattr(x.rolling(4), f)())
            tm.assert_frame_equal(result, expected)

        for f in ['std', 'var']:
            result = getattr(r, f)(ddof=1)
            expected = g.apply(lambda x: getattr(x.rolling(4), f)(ddof=1))
            tm.assert_frame_equal(result, expected)

        result = r.quantile(0.5)
        expected = g.apply(lambda x: x.rolling(4).quantile(0.5))
        tm.assert_frame_equal(result, expected)

    def test_rolling_corr_cov(self):
        g = self.frame.groupby('A')
        r = g.rolling(window=4)

        for f in ['corr', 'cov']:
            result = getattr(r, f)(self.frame)

            def func(x):
                return getattr(x.rolling(4), f)(self.frame)
            expected = g.apply(func)
            tm.assert_frame_equal(result, expected)

            result = getattr(r.B, f)(pairwise=True)

            def func(x):
                return getattr(x.B.rolling(4), f)(pairwise=True)
            expected = g.apply(func)
            tm.assert_series_equal(result, expected)

    def test_rolling_apply(self):
        g = self.frame.groupby('A')
        r = g.rolling(window=4)

        # reduction
        result = r.apply(lambda x: x.sum())
        expected = g.apply(lambda x: x.rolling(4).apply(lambda y: y.sum()))
        tm.assert_frame_equal(result, expected)

    def test_expanding(self):
        g = self.frame.groupby('A')
        r = g.expanding()

        for f in ['sum', 'mean', 'min', 'max', 'count', 'kurt', 'skew']:

            result = getattr(r, f)()
            expected = g.apply(lambda x: getattr(x.expanding(), f)())
            tm.assert_frame_equal(result, expected)

        for f in ['std', 'var']:
            result = getattr(r, f)(ddof=0)
            expected = g.apply(lambda x: getattr(x.expanding(), f)(ddof=0))
            tm.assert_frame_equal(result, expected)

        result = r.quantile(0.5)
        expected = g.apply(lambda x: x.expanding().quantile(0.5))
        tm.assert_frame_equal(result, expected)

    def test_expanding_corr_cov(self):
        g = self.frame.groupby('A')
        r = g.expanding()

        for f in ['corr', 'cov']:
            result = getattr(r, f)(self.frame)

            def func(x):
                return getattr(x.expanding(), f)(self.frame)
            expected = g.apply(func)
            tm.assert_frame_equal(result, expected)

            result = getattr(r.B, f)(pairwise=True)

            def func(x):
                return getattr(x.B.expanding(), f)(pairwise=True)
            expected = g.apply(func)
            tm.assert_series_equal(result, expected)

    def test_expanding_apply(self):
        g = self.frame.groupby('A')
        r = g.expanding()

        # reduction
        result = r.apply(lambda x: x.sum())
        expected = g.apply(lambda x: x.expanding().apply(lambda y: y.sum()))
        tm.assert_frame_equal(result, expected)


class TestRollingTS(object):

    # rolling time-series friendly
    # xref GH13327

    def setup_method(self, method):

        self.regular = DataFrame({'A': pd.date_range('20130101',
                                                     periods=5,
                                                     freq='s'),
                                  'B': range(5)}).set_index('A')

        self.ragged = DataFrame({'B': range(5)})
        self.ragged.index = [Timestamp('20130101 09:00:00'),
                             Timestamp('20130101 09:00:02'),
                             Timestamp('20130101 09:00:03'),
                             Timestamp('20130101 09:00:05'),
                             Timestamp('20130101 09:00:06')]

    def test_doc_string(self):

        df = DataFrame({'B': [0, 1, 2, np.nan, 4]},
                       index=[Timestamp('20130101 09:00:00'),
                              Timestamp('20130101 09:00:02'),
                              Timestamp('20130101 09:00:03'),
                              Timestamp('20130101 09:00:05'),
                              Timestamp('20130101 09:00:06')])
        df
        df.rolling('2s').sum()

    def test_valid(self):

        df = self.regular

        # not a valid freq
        with pytest.raises(ValueError):
            df.rolling(window='foobar')

        # not a datetimelike index
        with pytest.raises(ValueError):
            df.reset_index().rolling(window='foobar')

        # non-fixed freqs
        for freq in ['2MS', pd.offsets.MonthBegin(2)]:
            with pytest.raises(ValueError):
                df.rolling(window=freq)

        for freq in ['1D', pd.offsets.Day(2), '2ms']:
            df.rolling(window=freq)

        # non-integer min_periods
        for minp in [1.0, 'foo', np.array([1, 2, 3])]:
            with pytest.raises(ValueError):
                df.rolling(window='1D', min_periods=minp)

        # center is not implemented
        with pytest.raises(NotImplementedError):
            df.rolling(window='1D', center=True)

    def test_on(self):

        df = self.regular

        # not a valid column
        with pytest.raises(ValueError):
            df.rolling(window='2s', on='foobar')

        # column is valid
        df = df.copy()
        df['C'] = pd.date_range('20130101', periods=len(df))
        df.rolling(window='2d', on='C').sum()

        # invalid columns
        with pytest.raises(ValueError):
            df.rolling(window='2d', on='B')

        # ok even though on non-selected
        df.rolling(window='2d', on='C').B.sum()

    def test_monotonic_on(self):

        # on/index must be monotonic
        df = DataFrame({'A': pd.date_range('20130101',
                                           periods=5,
                                           freq='s'),
                        'B': range(5)})

        assert df.A.is_monotonic
        df.rolling('2s', on='A').sum()

        df = df.set_index('A')
        assert df.index.is_monotonic
        df.rolling('2s').sum()

        # non-monotonic
        df.index = reversed(df.index.tolist())
        assert not df.index.is_monotonic

        with pytest.raises(ValueError):
            df.rolling('2s').sum()

        df = df.reset_index()
        with pytest.raises(ValueError):
            df.rolling('2s', on='A').sum()

    def test_frame_on(self):

        df = DataFrame({'B': range(5),
                        'C': pd.date_range('20130101 09:00:00',
                                           periods=5,
                                           freq='3s')})

        df['A'] = [Timestamp('20130101 09:00:00'),
                   Timestamp('20130101 09:00:02'),
                   Timestamp('20130101 09:00:03'),
                   Timestamp('20130101 09:00:05'),
                   Timestamp('20130101 09:00:06')]

        # we are doing simulating using 'on'
        expected = (df.set_index('A')
                    .rolling('2s')
                    .B
                    .sum()
                    .reset_index(drop=True)
                    )

        result = (df.rolling('2s', on='A')
                    .B
                    .sum()
                  )
        tm.assert_series_equal(result, expected)

        # test as a frame
        # we should be ignoring the 'on' as an aggregation column
        # note that the expected is setting, computing, and reseting
        # so the columns need to be switched compared
        # to the actual result where they are ordered as in the
        # original
        expected = (df.set_index('A')
                      .rolling('2s')[['B']]
                      .sum()
                      .reset_index()[['B', 'A']]
                    )

        result = (df.rolling('2s', on='A')[['B']]
                    .sum()
                  )
        tm.assert_frame_equal(result, expected)

    def test_frame_on2(self):

        # using multiple aggregation columns
        df = DataFrame({'A': [0, 1, 2, 3, 4],
                        'B': [0, 1, 2, np.nan, 4],
                        'C': pd.Index([pd.Timestamp('20130101 09:00:00'),
                                       pd.Timestamp('20130101 09:00:02'),
                                       pd.Timestamp('20130101 09:00:03'),
                                       pd.Timestamp('20130101 09:00:05'),
                                       pd.Timestamp('20130101 09:00:06')])},
                       columns=['A', 'C', 'B'])

        expected1 = DataFrame({'A': [0., 1, 3, 3, 7],
                               'B': [0, 1, 3, np.nan, 4],
                               'C': df['C']},
                              columns=['A', 'C', 'B'])

        result = df.rolling('2s', on='C').sum()
        expected = expected1
        tm.assert_frame_equal(result, expected)

        expected = Series([0, 1, 3, np.nan, 4], name='B')
        result = df.rolling('2s', on='C').B.sum()
        tm.assert_series_equal(result, expected)

        expected = expected1[['A', 'B', 'C']]
        result = df.rolling('2s', on='C')[['A', 'B', 'C']].sum()
        tm.assert_frame_equal(result, expected)

    def test_basic_regular(self):

        df = self.regular.copy()

        df.index = pd.date_range('20130101', periods=5, freq='D')
        expected = df.rolling(window=1, min_periods=1).sum()
        result = df.rolling(window='1D').sum()
        tm.assert_frame_equal(result, expected)

        df.index = pd.date_range('20130101', periods=5, freq='2D')
        expected = df.rolling(window=1, min_periods=1).sum()
        result = df.rolling(window='2D', min_periods=1).sum()
        tm.assert_frame_equal(result, expected)

        expected = df.rolling(window=1, min_periods=1).sum()
        result = df.rolling(window='2D', min_periods=1).sum()
        tm.assert_frame_equal(result, expected)

        expected = df.rolling(window=1).sum()
        result = df.rolling(window='2D').sum()
        tm.assert_frame_equal(result, expected)

    def test_min_periods(self):

        # compare for min_periods
        df = self.regular

        # these slightly different
        expected = df.rolling(2, min_periods=1).sum()
        result = df.rolling('2s').sum()
        tm.assert_frame_equal(result, expected)

        expected = df.rolling(2, min_periods=1).sum()
        result = df.rolling('2s', min_periods=1).sum()
        tm.assert_frame_equal(result, expected)

    def test_closed(self):

        # xref GH13965

        df = DataFrame({'A': [1] * 5},
                       index=[pd.Timestamp('20130101 09:00:01'),
                              pd.Timestamp('20130101 09:00:02'),
                              pd.Timestamp('20130101 09:00:03'),
                              pd.Timestamp('20130101 09:00:04'),
                              pd.Timestamp('20130101 09:00:06')])

        # closed must be 'right', 'left', 'both', 'neither'
        with pytest.raises(ValueError):
            self.regular.rolling(window='2s', closed="blabla")

        expected = df.copy()
        expected["A"] = [1.0, 2, 2, 2, 1]
        result = df.rolling('2s', closed='right').sum()
        tm.assert_frame_equal(result, expected)

        # default should be 'right'
        result = df.rolling('2s').sum()
        tm.assert_frame_equal(result, expected)

        expected = df.copy()
        expected["A"] = [1.0, 2, 3, 3, 2]
        result = df.rolling('2s', closed='both').sum()
        tm.assert_frame_equal(result, expected)

        expected = df.copy()
        expected["A"] = [np.nan, 1.0, 2, 2, 1]
        result = df.rolling('2s', closed='left').sum()
        tm.assert_frame_equal(result, expected)

        expected = df.copy()
        expected["A"] = [np.nan, 1.0, 1, 1, np.nan]
        result = df.rolling('2s', closed='neither').sum()
        tm.assert_frame_equal(result, expected)

    def test_ragged_sum(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).sum()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).sum()
        expected = df.copy()
        expected['B'] = [0.0, 1, 3, 3, 7]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=2).sum()
        expected = df.copy()
        expected['B'] = [np.nan, np.nan, 3, np.nan, 7]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='3s', min_periods=1).sum()
        expected = df.copy()
        expected['B'] = [0.0, 1, 3, 5, 7]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='3s').sum()
        expected = df.copy()
        expected['B'] = [0.0, 1, 3, 5, 7]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='4s', min_periods=1).sum()
        expected = df.copy()
        expected['B'] = [0.0, 1, 3, 6, 9]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='4s', min_periods=3).sum()
        expected = df.copy()
        expected['B'] = [np.nan, np.nan, 3, 6, 9]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).sum()
        expected = df.copy()
        expected['B'] = [0.0, 1, 3, 6, 10]
        tm.assert_frame_equal(result, expected)

    def test_ragged_mean(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).mean()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).mean()
        expected = df.copy()
        expected['B'] = [0.0, 1, 1.5, 3.0, 3.5]
        tm.assert_frame_equal(result, expected)

    def test_ragged_median(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).median()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).median()
        expected = df.copy()
        expected['B'] = [0.0, 1, 1.5, 3.0, 3.5]
        tm.assert_frame_equal(result, expected)

    def test_ragged_quantile(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).quantile(0.5)
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).quantile(0.5)
        expected = df.copy()
        expected['B'] = [0.0, 1, 1.0, 3.0, 3.0]
        tm.assert_frame_equal(result, expected)

    def test_ragged_std(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).std(ddof=0)
        expected = df.copy()
        expected['B'] = [0.0] * 5
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='1s', min_periods=1).std(ddof=1)
        expected = df.copy()
        expected['B'] = [np.nan] * 5
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='3s', min_periods=1).std(ddof=0)
        expected = df.copy()
        expected['B'] = [0.0] + [0.5] * 4
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).std(ddof=1)
        expected = df.copy()
        expected['B'] = [np.nan, 0.707107, 1.0, 1.0, 1.290994]
        tm.assert_frame_equal(result, expected)

    def test_ragged_var(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).var(ddof=0)
        expected = df.copy()
        expected['B'] = [0.0] * 5
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='1s', min_periods=1).var(ddof=1)
        expected = df.copy()
        expected['B'] = [np.nan] * 5
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='3s', min_periods=1).var(ddof=0)
        expected = df.copy()
        expected['B'] = [0.0] + [0.25] * 4
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).var(ddof=1)
        expected = df.copy()
        expected['B'] = [np.nan, 0.5, 1.0, 1.0, 1 + 2 / 3.]
        tm.assert_frame_equal(result, expected)

    def test_ragged_skew(self):

        df = self.ragged
        result = df.rolling(window='3s', min_periods=1).skew()
        expected = df.copy()
        expected['B'] = [np.nan] * 5
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).skew()
        expected = df.copy()
        expected['B'] = [np.nan] * 2 + [0.0, 0.0, 0.0]
        tm.assert_frame_equal(result, expected)

    def test_ragged_kurt(self):

        df = self.ragged
        result = df.rolling(window='3s', min_periods=1).kurt()
        expected = df.copy()
        expected['B'] = [np.nan] * 5
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).kurt()
        expected = df.copy()
        expected['B'] = [np.nan] * 4 + [-1.2]
        tm.assert_frame_equal(result, expected)

    def test_ragged_count(self):

        df = self.ragged
        result = df.rolling(window='1s', min_periods=1).count()
        expected = df.copy()
        expected['B'] = [1.0, 1, 1, 1, 1]
        tm.assert_frame_equal(result, expected)

        df = self.ragged
        result = df.rolling(window='1s').count()
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).count()
        expected = df.copy()
        expected['B'] = [1.0, 1, 2, 1, 2]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=2).count()
        expected = df.copy()
        expected['B'] = [np.nan, np.nan, 2, np.nan, 2]
        tm.assert_frame_equal(result, expected)

    def test_regular_min(self):

        df = DataFrame({'A': pd.date_range('20130101',
                                           periods=5,
                                           freq='s'),
                        'B': [0.0, 1, 2, 3, 4]}).set_index('A')
        result = df.rolling('1s').min()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        df = DataFrame({'A': pd.date_range('20130101',
                                           periods=5,
                                           freq='s'),
                        'B': [5, 4, 3, 4, 5]}).set_index('A')

        tm.assert_frame_equal(result, expected)
        result = df.rolling('2s').min()
        expected = df.copy()
        expected['B'] = [5.0, 4, 3, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling('5s').min()
        expected = df.copy()
        expected['B'] = [5.0, 4, 3, 3, 3]
        tm.assert_frame_equal(result, expected)

    def test_ragged_min(self):

        df = self.ragged

        result = df.rolling(window='1s', min_periods=1).min()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).min()
        expected = df.copy()
        expected['B'] = [0.0, 1, 1, 3, 3]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).min()
        expected = df.copy()
        expected['B'] = [0.0, 0, 0, 1, 1]
        tm.assert_frame_equal(result, expected)

    def test_perf_min(self):

        N = 10000

        dfp = DataFrame({'B': np.random.randn(N)},
                        index=pd.date_range('20130101',
                                            periods=N,
                                            freq='s'))
        expected = dfp.rolling(2, min_periods=1).min()
        result = dfp.rolling('2s').min()
        assert ((result - expected) < 0.01).all().bool()

        expected = dfp.rolling(200, min_periods=1).min()
        result = dfp.rolling('200s').min()
        assert ((result - expected) < 0.01).all().bool()

    def test_ragged_max(self):

        df = self.ragged

        result = df.rolling(window='1s', min_periods=1).max()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).max()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).max()
        expected = df.copy()
        expected['B'] = [0.0, 1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

    def test_ragged_apply(self):

        df = self.ragged

        f = lambda x: 1
        result = df.rolling(window='1s', min_periods=1).apply(f)
        expected = df.copy()
        expected['B'] = 1.
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='2s', min_periods=1).apply(f)
        expected = df.copy()
        expected['B'] = 1.
        tm.assert_frame_equal(result, expected)

        result = df.rolling(window='5s', min_periods=1).apply(f)
        expected = df.copy()
        expected['B'] = 1.
        tm.assert_frame_equal(result, expected)

    def test_all(self):

        # simple comparision of integer vs time-based windowing
        df = self.regular * 2
        er = df.rolling(window=1)
        r = df.rolling(window='1s')

        for f in ['sum', 'mean', 'count', 'median', 'std',
                  'var', 'kurt', 'skew', 'min', 'max']:

            result = getattr(r, f)()
            expected = getattr(er, f)()
            tm.assert_frame_equal(result, expected)

        result = r.quantile(0.5)
        expected = er.quantile(0.5)
        tm.assert_frame_equal(result, expected)

        result = r.apply(lambda x: 1)
        expected = er.apply(lambda x: 1)
        tm.assert_frame_equal(result, expected)

    def test_all2(self):

        # more sophisticated comparision of integer vs.
        # time-based windowing
        df = DataFrame({'B': np.arange(50)},
                       index=pd.date_range('20130101',
                                           periods=50, freq='H')
                       )
        # in-range data
        dft = df.between_time("09:00", "16:00")

        r = dft.rolling(window='5H')

        for f in ['sum', 'mean', 'count', 'median', 'std',
                  'var', 'kurt', 'skew', 'min', 'max']:

            result = getattr(r, f)()

            # we need to roll the days separately
            # to compare with a time-based roll
            # finally groupby-apply will return a multi-index
            # so we need to drop the day
            def agg_by_day(x):
                x = x.between_time("09:00", "16:00")
                return getattr(x.rolling(5, min_periods=1), f)()
            expected = df.groupby(df.index.day).apply(
                agg_by_day).reset_index(level=0, drop=True)

            tm.assert_frame_equal(result, expected)

    def test_groupby_monotonic(self):

        # GH 15130
        # we don't need to validate monotonicity when grouping

        data = [
            ['David', '1/1/2015', 100], ['David', '1/5/2015', 500],
            ['David', '5/30/2015', 50], ['David', '7/25/2015', 50],
            ['Ryan', '1/4/2014', 100], ['Ryan', '1/19/2015', 500],
            ['Ryan', '3/31/2016', 50], ['Joe', '7/1/2015', 100],
            ['Joe', '9/9/2015', 500], ['Joe', '10/15/2015', 50]]

        df = pd.DataFrame(data=data, columns=['name', 'date', 'amount'])
        df['date'] = pd.to_datetime(df['date'])

        expected = df.set_index('date').groupby('name').apply(
            lambda x: x.rolling('180D')['amount'].sum())
        result = df.groupby('name').rolling('180D', on='date')['amount'].sum()
        tm.assert_series_equal(result, expected)

    def test_non_monotonic(self):
        # GH 13966 (similar to #15130, closed by #15175)

        dates = pd.date_range(start='2016-01-01 09:30:00',
                              periods=20, freq='s')
        df = pd.DataFrame({'A': [1] * 20 + [2] * 12 + [3] * 8,
                           'B': np.concatenate((dates, dates)),
                           'C': np.arange(40)})

        result = df.groupby('A').rolling('4s', on='B').C.mean()
        expected = df.set_index('B').groupby('A').apply(
            lambda x: x.rolling('4s')['C'].mean())
        tm.assert_series_equal(result, expected)

        df2 = df.sort_values('B')
        result = df2.groupby('A').rolling('4s', on='B').C.mean()
        tm.assert_series_equal(result, expected)

    def test_rolling_cov_offset(self):
        # GH16058

        idx = pd.date_range('2017-01-01', periods=24, freq='1h')
        ss = pd.Series(np.arange(len(idx)), index=idx)

        result = ss.rolling('2h').cov()
        expected = pd.Series([np.nan] + [0.5 for _ in range(len(idx) - 1)],
                             index=idx)
        tm.assert_series_equal(result, expected)

        expected2 = ss.rolling(2, min_periods=1).cov()
        tm.assert_series_equal(result, expected2)

        result = ss.rolling('3h').cov()
        expected = pd.Series([np.nan, 0.5] +
                             [1.0 for _ in range(len(idx) - 2)],
                             index=idx)
        tm.assert_series_equal(result, expected)

        expected2 = ss.rolling(3, min_periods=1).cov()
        tm.assert_series_equal(result, expected2)
