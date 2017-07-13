# pylint: disable=E1101

from warnings import catch_warnings
from datetime import datetime, timedelta
from functools import partial
from textwrap import dedent

import pytest
import numpy as np

import pandas as pd
import pandas.tseries.offsets as offsets
import pandas.util.testing as tm
from pandas import (Series, DataFrame, Panel, Index, isnull,
                    notnull, Timestamp)

from pandas.core.dtypes.generic import ABCSeries, ABCDataFrame
from pandas.compat import range, lrange, zip, product, OrderedDict
from pandas.core.base import SpecificationError
from pandas.errors import UnsupportedFunctionCall
from pandas.core.groupby import DataError
from pandas.tseries.frequencies import MONTHS, DAYS
from pandas.tseries.frequencies import to_offset
from pandas.core.indexes.datetimes import date_range
from pandas.tseries.offsets import Minute, BDay
from pandas.core.indexes.period import period_range, PeriodIndex, Period
from pandas.core.resample import (DatetimeIndex, TimeGrouper,
                                  DatetimeIndexResampler)
from pandas.core.indexes.timedeltas import timedelta_range, TimedeltaIndex
from pandas.util.testing import (assert_series_equal, assert_almost_equal,
                                 assert_frame_equal, assert_index_equal)
from pandas._libs.period import IncompatibleFrequency

bday = BDay()

# The various methods we support
downsample_methods = ['min', 'max', 'first', 'last', 'sum', 'mean', 'sem',
                      'median', 'prod', 'var', 'ohlc']
upsample_methods = ['count', 'size']
series_methods = ['nunique']
resample_methods = downsample_methods + upsample_methods + series_methods


def _simple_ts(start, end, freq='D'):
    rng = date_range(start, end, freq=freq)
    return Series(np.random.randn(len(rng)), index=rng)


def _simple_pts(start, end, freq='D'):
    rng = period_range(start, end, freq=freq)
    return Series(np.random.randn(len(rng)), index=rng)


class TestResampleAPI(object):

    def setup_method(self, method):
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='Min')

        self.series = Series(np.random.rand(len(dti)), dti)
        self.frame = DataFrame(
            {'A': self.series, 'B': self.series, 'C': np.arange(len(dti))})

    def test_str(self):

        r = self.series.resample('H')
        assert ('DatetimeIndexResampler [freq=<Hour>, axis=0, closed=left, '
                'label=left, convention=start, base=0]' in str(r))

    def test_api(self):

        r = self.series.resample('H')
        result = r.mean()
        assert isinstance(result, Series)
        assert len(result) == 217

        r = self.series.to_frame().resample('H')
        result = r.mean()
        assert isinstance(result, DataFrame)
        assert len(result) == 217

    def test_api_changes_v018(self):

        # change from .resample(....., how=...)
        # to .resample(......).how()

        r = self.series.resample('H')
        assert isinstance(r, DatetimeIndexResampler)

        for how in ['sum', 'mean', 'prod', 'min', 'max', 'var', 'std']:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = self.series.resample('H', how=how)
                expected = getattr(self.series.resample('H'), how)()
                tm.assert_series_equal(result, expected)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = self.series.resample('H', how='ohlc')
            expected = self.series.resample('H').ohlc()
            tm.assert_frame_equal(result, expected)

        # compat for pandas-like methods
        for how in ['sort_values', 'isnull']:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                getattr(r, how)()

        # invalids as these can be setting operations
        r = self.series.resample('H')
        pytest.raises(ValueError, lambda: r.iloc[0])
        pytest.raises(ValueError, lambda: r.iat[0])
        pytest.raises(ValueError, lambda: r.loc[0])
        pytest.raises(ValueError, lambda: r.loc[
            Timestamp('2013-01-01 00:00:00', offset='H')])
        pytest.raises(ValueError, lambda: r.at[
            Timestamp('2013-01-01 00:00:00', offset='H')])

        def f():
            r[0] = 5

        pytest.raises(ValueError, f)

        # str/repr
        r = self.series.resample('H')
        with tm.assert_produces_warning(None):
            str(r)
        with tm.assert_produces_warning(None):
            repr(r)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            tm.assert_numpy_array_equal(np.array(r), np.array(r.mean()))

        # masquerade as Series/DataFrame as needed for API compat
        assert isinstance(self.series.resample('H'), ABCSeries)
        assert not isinstance(self.frame.resample('H'), ABCSeries)
        assert not isinstance(self.series.resample('H'), ABCDataFrame)
        assert isinstance(self.frame.resample('H'), ABCDataFrame)

        # bin numeric ops
        for op in ['__add__', '__mul__', '__truediv__', '__div__', '__sub__']:

            if getattr(self.series, op, None) is None:
                continue
            r = self.series.resample('H')

            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                assert isinstance(getattr(r, op)(2), pd.Series)

        # unary numeric ops
        for op in ['__pos__', '__neg__', '__abs__', '__inv__']:

            if getattr(self.series, op, None) is None:
                continue
            r = self.series.resample('H')

            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                assert isinstance(getattr(r, op)(), pd.Series)

        # comparison ops
        for op in ['__lt__', '__le__', '__gt__', '__ge__', '__eq__', '__ne__']:
            r = self.series.resample('H')

            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                assert isinstance(getattr(r, op)(2), pd.Series)

        # IPython introspection shouldn't trigger warning GH 13618
        for op in ['_repr_json', '_repr_latex',
                   '_ipython_canary_method_should_not_exist_']:
            r = self.series.resample('H')
            with tm.assert_produces_warning(None):
                getattr(r, op, None)

        # getitem compat
        df = self.series.to_frame('foo')

        # same as prior versions for DataFrame
        pytest.raises(KeyError, lambda: df.resample('H')[0])

        # compat for Series
        # but we cannot be sure that we need a warning here
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = self.series.resample('H')[0]
            expected = self.series.resample('H').mean()[0]
            assert result == expected

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = self.series.resample('H')['2005-01-09 23:00:00']
            expected = self.series.resample('H').mean()['2005-01-09 23:00:00']
            assert result == expected

    def test_groupby_resample_api(self):

        # GH 12448
        # .groupby(...).resample(...) hitting warnings
        # when appropriate
        df = DataFrame({'date': pd.date_range(start='2016-01-01',
                                              periods=4,
                                              freq='W'),
                        'group': [1, 1, 2, 2],
                        'val': [5, 6, 7, 8]}).set_index('date')

        # replication step
        i = pd.date_range('2016-01-03', periods=8).tolist() + \
            pd.date_range('2016-01-17', periods=8).tolist()
        index = pd.MultiIndex.from_arrays([[1] * 8 + [2] * 8, i],
                                          names=['group', 'date'])
        expected = DataFrame({'val': [5] * 7 + [6] + [7] * 7 + [8]},
                             index=index)
        result = df.groupby('group').apply(
            lambda x: x.resample('1D').ffill())[['val']]
        assert_frame_equal(result, expected)

    def test_groupby_resample_on_api(self):

        # GH 15021
        # .groupby(...).resample(on=...) results in an unexpected
        # keyword warning.
        df = pd.DataFrame({'key': ['A', 'B'] * 5,
                           'dates': pd.date_range('2016-01-01', periods=10),
                           'values': np.random.randn(10)})

        expected = df.set_index('dates').groupby('key').resample('D').mean()

        result = df.groupby('key').resample('D', on='dates').mean()
        assert_frame_equal(result, expected)

    def test_plot_api(self):
        tm._skip_if_no_mpl()

        # .resample(....).plot(...)
        # hitting warnings
        # GH 12448
        s = Series(np.random.randn(60),
                   index=date_range('2016-01-01', periods=60, freq='1min'))
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = s.resample('15min').plot()
            tm.assert_is_valid_plot_return_object(result)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = s.resample('15min', how='sum').plot()
            tm.assert_is_valid_plot_return_object(result)

    def test_getitem(self):

        r = self.frame.resample('H')
        tm.assert_index_equal(r._selected_obj.columns, self.frame.columns)

        r = self.frame.resample('H')['B']
        assert r._selected_obj.name == self.frame.columns[1]

        # technically this is allowed
        r = self.frame.resample('H')['A', 'B']
        tm.assert_index_equal(r._selected_obj.columns,
                              self.frame.columns[[0, 1]])

        r = self.frame.resample('H')['A', 'B']
        tm.assert_index_equal(r._selected_obj.columns,
                              self.frame.columns[[0, 1]])

    def test_select_bad_cols(self):

        g = self.frame.resample('H')
        pytest.raises(KeyError, g.__getitem__, ['D'])

        pytest.raises(KeyError, g.__getitem__, ['A', 'D'])
        with tm.assert_raises_regex(KeyError, '^[^A]+$'):
            # A should not be referenced as a bad column...
            # will have to rethink regex if you change message!
            g[['A', 'D']]

    def test_attribute_access(self):

        r = self.frame.resample('H')
        tm.assert_series_equal(r.A.sum(), r['A'].sum())

        # getting
        pytest.raises(AttributeError, lambda: r.F)

        # setting
        def f():
            r.F = 'bah'

        pytest.raises(ValueError, f)

    def test_api_compat_before_use(self):

        # make sure that we are setting the binner
        # on these attributes
        for attr in ['groups', 'ngroups', 'indices']:
            rng = pd.date_range('1/1/2012', periods=100, freq='S')
            ts = pd.Series(np.arange(len(rng)), index=rng)
            rs = ts.resample('30s')

            # before use
            getattr(rs, attr)

            # after grouper is initialized is ok
            rs.mean()
            getattr(rs, attr)

    def tests_skip_nuisance(self):

        df = self.frame
        df['D'] = 'foo'
        r = df.resample('H')
        result = r[['A', 'B']].sum()
        expected = pd.concat([r.A.sum(), r.B.sum()], axis=1)
        assert_frame_equal(result, expected)

        expected = r[['A', 'B', 'C']].sum()
        result = r.sum()
        assert_frame_equal(result, expected)

    def test_downsample_but_actually_upsampling(self):

        # this is reindex / asfreq
        rng = pd.date_range('1/1/2012', periods=100, freq='S')
        ts = pd.Series(np.arange(len(rng), dtype='int64'), index=rng)
        result = ts.resample('20s').asfreq()
        expected = Series([0, 20, 40, 60, 80],
                          index=pd.date_range('2012-01-01 00:00:00',
                                              freq='20s',
                                              periods=5))
        assert_series_equal(result, expected)

    def test_combined_up_downsampling_of_irregular(self):

        # since we are reallydoing an operation like this
        # ts2.resample('2s').mean().ffill()
        # preserve these semantics

        rng = pd.date_range('1/1/2012', periods=100, freq='S')
        ts = pd.Series(np.arange(len(rng)), index=rng)
        ts2 = ts.iloc[[0, 1, 2, 3, 5, 7, 11, 15, 16, 25, 30]]

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = ts2.resample('2s', how='mean', fill_method='ffill')
        expected = ts2.resample('2s').mean().ffill()
        assert_series_equal(result, expected)

    def test_transform(self):

        r = self.series.resample('20min')
        expected = self.series.groupby(
            pd.Grouper(freq='20min')).transform('mean')
        result = r.transform('mean')
        assert_series_equal(result, expected)

    def test_fillna(self):

        # need to upsample here
        rng = pd.date_range('1/1/2012', periods=10, freq='2S')
        ts = pd.Series(np.arange(len(rng), dtype='int64'), index=rng)
        r = ts.resample('s')

        expected = r.ffill()
        result = r.fillna(method='ffill')
        assert_series_equal(result, expected)

        expected = r.bfill()
        result = r.fillna(method='bfill')
        assert_series_equal(result, expected)

        with pytest.raises(ValueError):
            r.fillna(0)

    def test_apply_without_aggregation(self):

        # both resample and groupby should work w/o aggregation
        r = self.series.resample('20min')
        g = self.series.groupby(pd.Grouper(freq='20min'))

        for t in [g, r]:
            result = t.apply(lambda x: x)
            assert_series_equal(result, self.series)

    def test_agg_consistency(self):

        # make sure that we are consistent across
        # similar aggregations with and w/o selection list
        df = DataFrame(np.random.randn(1000, 3),
                       index=pd.date_range('1/1/2012', freq='S', periods=1000),
                       columns=['A', 'B', 'C'])

        r = df.resample('3T')

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            expected = r[['A', 'B', 'C']].agg({'r1': 'mean', 'r2': 'sum'})
            result = r.agg({'r1': 'mean', 'r2': 'sum'})
        assert_frame_equal(result, expected)

    # TODO: once GH 14008 is fixed, move these tests into
    # `Base` test class
    def test_agg(self):
        # test with all three Resampler apis and TimeGrouper

        np.random.seed(1234)
        index = date_range(datetime(2005, 1, 1),
                           datetime(2005, 1, 10), freq='D')
        index.name = 'date'
        df = pd.DataFrame(np.random.rand(10, 2),
                          columns=list('AB'),
                          index=index)
        df_col = df.reset_index()
        df_mult = df_col.copy()
        df_mult.index = pd.MultiIndex.from_arrays([range(10), df.index],
                                                  names=['index', 'date'])
        r = df.resample('2D')
        cases = [
            r,
            df_col.resample('2D', on='date'),
            df_mult.resample('2D', level='date'),
            df.groupby(pd.Grouper(freq='2D'))
        ]

        a_mean = r['A'].mean()
        a_std = r['A'].std()
        a_sum = r['A'].sum()
        b_mean = r['B'].mean()
        b_std = r['B'].std()
        b_sum = r['B'].sum()

        expected = pd.concat([a_mean, a_std, b_mean, b_std], axis=1)
        expected.columns = pd.MultiIndex.from_product([['A', 'B'],
                                                       ['mean', 'std']])
        for t in cases:
            result = t.aggregate([np.mean, np.std])
            assert_frame_equal(result, expected)

        expected = pd.concat([a_mean, b_std], axis=1)
        for t in cases:
            result = t.aggregate({'A': np.mean,
                                  'B': np.std})
            assert_frame_equal(result, expected, check_like=True)

        expected = pd.concat([a_mean, a_std], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'mean'),
                                                      ('A', 'std')])
        for t in cases:
            result = t.aggregate({'A': ['mean', 'std']})
            assert_frame_equal(result, expected)

        expected = pd.concat([a_mean, a_sum], axis=1)
        expected.columns = ['mean', 'sum']
        for t in cases:
            result = t['A'].aggregate(['mean', 'sum'])
        assert_frame_equal(result, expected)

        expected = pd.concat([a_mean, a_sum], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'mean'),
                                                      ('A', 'sum')])
        for t in cases:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t.aggregate({'A': {'mean': 'mean', 'sum': 'sum'}})
            assert_frame_equal(result, expected, check_like=True)

        expected = pd.concat([a_mean, a_sum, b_mean, b_sum], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'mean'),
                                                      ('A', 'sum'),
                                                      ('B', 'mean2'),
                                                      ('B', 'sum2')])
        for t in cases:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t.aggregate({'A': {'mean': 'mean', 'sum': 'sum'},
                                      'B': {'mean2': 'mean', 'sum2': 'sum'}})
            assert_frame_equal(result, expected, check_like=True)

        expected = pd.concat([a_mean, a_std, b_mean, b_std], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'mean'),
                                                      ('A', 'std'),
                                                      ('B', 'mean'),
                                                      ('B', 'std')])
        for t in cases:
            result = t.aggregate({'A': ['mean', 'std'],
                                  'B': ['mean', 'std']})
            assert_frame_equal(result, expected, check_like=True)

        expected = pd.concat([a_mean, a_sum, b_mean, b_sum], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('r1', 'A', 'mean'),
                                                      ('r1', 'A', 'sum'),
                                                      ('r2', 'B', 'mean'),
                                                      ('r2', 'B', 'sum')])

    def test_agg_misc(self):
        # test with all three Resampler apis and TimeGrouper

        np.random.seed(1234)
        index = date_range(datetime(2005, 1, 1),
                           datetime(2005, 1, 10), freq='D')
        index.name = 'date'
        df = pd.DataFrame(np.random.rand(10, 2),
                          columns=list('AB'),
                          index=index)
        df_col = df.reset_index()
        df_mult = df_col.copy()
        df_mult.index = pd.MultiIndex.from_arrays([range(10), df.index],
                                                  names=['index', 'date'])

        r = df.resample('2D')
        cases = [
            r,
            df_col.resample('2D', on='date'),
            df_mult.resample('2D', level='date'),
            df.groupby(pd.Grouper(freq='2D'))
        ]

        # passed lambda
        for t in cases:
            result = t.agg({'A': np.sum,
                            'B': lambda x: np.std(x, ddof=1)})
            rcustom = t['B'].apply(lambda x: np.std(x, ddof=1))
            expected = pd.concat([r['A'].sum(), rcustom], axis=1)
            assert_frame_equal(result, expected, check_like=True)

        # agg with renamers
        expected = pd.concat([t['A'].sum(),
                              t['B'].sum(),
                              t['A'].mean(),
                              t['B'].mean()],
                             axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('result1', 'A'),
                                                      ('result1', 'B'),
                                                      ('result2', 'A'),
                                                      ('result2', 'B')])

        for t in cases:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t[['A', 'B']].agg(OrderedDict([('result1', np.sum),
                                                        ('result2', np.mean)]))
            assert_frame_equal(result, expected, check_like=True)

        # agg with different hows
        expected = pd.concat([t['A'].sum(),
                              t['A'].std(),
                              t['B'].mean(),
                              t['B'].std()],
                             axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('A', 'sum'),
                                                      ('A', 'std'),
                                                      ('B', 'mean'),
                                                      ('B', 'std')])
        for t in cases:
            result = t.agg(OrderedDict([('A', ['sum', 'std']),
                                        ('B', ['mean', 'std'])]))
            assert_frame_equal(result, expected, check_like=True)

        # equivalent of using a selection list / or not
        for t in cases:
            result = t[['A', 'B']].agg({'A': ['sum', 'std'],
                                        'B': ['mean', 'std']})
            assert_frame_equal(result, expected, check_like=True)

        # series like aggs
        for t in cases:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t['A'].agg({'A': ['sum', 'std']})
            expected = pd.concat([t['A'].sum(),
                                  t['A'].std()],
                                 axis=1)
            expected.columns = pd.MultiIndex.from_tuples([('A', 'sum'),
                                                          ('A', 'std')])
            assert_frame_equal(result, expected, check_like=True)

            expected = pd.concat([t['A'].agg(['sum', 'std']),
                                  t['A'].agg(['mean', 'std'])],
                                 axis=1)
            expected.columns = pd.MultiIndex.from_tuples([('A', 'sum'),
                                                          ('A', 'std'),
                                                          ('B', 'mean'),
                                                          ('B', 'std')])
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t['A'].agg({'A': ['sum', 'std'],
                                     'B': ['mean', 'std']})
            assert_frame_equal(result, expected, check_like=True)

        # errors
        # invalid names in the agg specification
        for t in cases:
            def f():
                with tm.assert_produces_warning(FutureWarning,
                                                check_stacklevel=False):
                    t[['A']].agg({'A': ['sum', 'std'],
                                  'B': ['mean', 'std']})

            pytest.raises(SpecificationError, f)

    def test_agg_nested_dicts(self):

        np.random.seed(1234)
        index = date_range(datetime(2005, 1, 1),
                           datetime(2005, 1, 10), freq='D')
        index.name = 'date'
        df = pd.DataFrame(np.random.rand(10, 2),
                          columns=list('AB'),
                          index=index)
        df_col = df.reset_index()
        df_mult = df_col.copy()
        df_mult.index = pd.MultiIndex.from_arrays([range(10), df.index],
                                                  names=['index', 'date'])
        r = df.resample('2D')
        cases = [
            r,
            df_col.resample('2D', on='date'),
            df_mult.resample('2D', level='date'),
            df.groupby(pd.Grouper(freq='2D'))
        ]

        for t in cases:
            def f():
                t.aggregate({'r1': {'A': ['mean', 'sum']},
                             'r2': {'B': ['mean', 'sum']}})
                pytest.raises(ValueError, f)

        for t in cases:
            expected = pd.concat([t['A'].mean(), t['A'].std(), t['B'].mean(),
                                  t['B'].std()], axis=1)
            expected.columns = pd.MultiIndex.from_tuples([('ra', 'mean'), (
                'ra', 'std'), ('rb', 'mean'), ('rb', 'std')])

            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t[['A', 'B']].agg({'A': {'ra': ['mean', 'std']},
                                            'B': {'rb': ['mean', 'std']}})
            assert_frame_equal(result, expected, check_like=True)

            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = t.agg({'A': {'ra': ['mean', 'std']},
                                'B': {'rb': ['mean', 'std']}})
            assert_frame_equal(result, expected, check_like=True)

    def test_selection_api_validation(self):
        # GH 13500
        index = date_range(datetime(2005, 1, 1),
                           datetime(2005, 1, 10), freq='D')
        df = pd.DataFrame({'date': index,
                           'a': np.arange(len(index), dtype=np.int64)},
                          index=pd.MultiIndex.from_arrays([
                              np.arange(len(index), dtype=np.int64),
                              index], names=['v', 'd']))
        df_exp = pd.DataFrame({'a': np.arange(len(index), dtype=np.int64)},
                              index=index)

        # non DatetimeIndex
        with pytest.raises(TypeError):
            df.resample('2D', level='v')

        with pytest.raises(ValueError):
            df.resample('2D', on='date', level='d')

        with pytest.raises(TypeError):
            df.resample('2D', on=['a', 'date'])

        with pytest.raises(KeyError):
            df.resample('2D', level=['a', 'date'])

        # upsampling not allowed
        with pytest.raises(ValueError):
            df.resample('2D', level='d').asfreq()

        with pytest.raises(ValueError):
            df.resample('2D', on='date').asfreq()

        exp = df_exp.resample('2D').sum()
        exp.index.name = 'date'
        assert_frame_equal(exp, df.resample('2D', on='date').sum())

        exp.index.name = 'd'
        assert_frame_equal(exp, df.resample('2D', level='d').sum())


class Base(object):
    """
    base class for resampling testing, calling
    .create_series() generates a series of each index type
    """

    def create_index(self, *args, **kwargs):
        """ return the _index_factory created using the args, kwargs """
        factory = self._index_factory()
        return factory(*args, **kwargs)

    def test_asfreq_downsample(self):
        s = self.create_series()

        result = s.resample('2D').asfreq()
        expected = s.reindex(s.index.take(np.arange(0, len(s.index), 2)))
        expected.index.freq = to_offset('2D')
        assert_series_equal(result, expected)

        frame = s.to_frame('value')
        result = frame.resample('2D').asfreq()
        expected = frame.reindex(
            frame.index.take(np.arange(0, len(frame.index), 2)))
        expected.index.freq = to_offset('2D')
        assert_frame_equal(result, expected)

    def test_asfreq_upsample(self):
        s = self.create_series()

        result = s.resample('1H').asfreq()
        new_index = self.create_index(s.index[0], s.index[-1], freq='1H')
        expected = s.reindex(new_index)
        assert_series_equal(result, expected)

        frame = s.to_frame('value')
        result = frame.resample('1H').asfreq()
        new_index = self.create_index(frame.index[0],
                                      frame.index[-1], freq='1H')
        expected = frame.reindex(new_index)
        assert_frame_equal(result, expected)

    def test_asfreq_fill_value(self):
        # test for fill value during resampling, issue 3715

        s = self.create_series()

        result = s.resample('1H').asfreq()
        new_index = self.create_index(s.index[0], s.index[-1], freq='1H')
        expected = s.reindex(new_index)
        assert_series_equal(result, expected)

        frame = s.to_frame('value')
        frame.iloc[1] = None
        result = frame.resample('1H').asfreq(fill_value=4.0)
        new_index = self.create_index(frame.index[0],
                                      frame.index[-1], freq='1H')
        expected = frame.reindex(new_index, fill_value=4.0)
        assert_frame_equal(result, expected)

    def test_resample_interpolate(self):
        # # 12925
        df = self.create_series().to_frame('value')
        assert_frame_equal(
            df.resample('1T').asfreq().interpolate(),
            df.resample('1T').interpolate())

    def test_raises_on_non_datetimelike_index(self):
        # this is a non datetimelike index
        xp = DataFrame()
        pytest.raises(TypeError, lambda: xp.resample('A').mean())

    def test_resample_empty_series(self):
        # GH12771 & GH12868

        s = self.create_series()[:0]

        for freq in ['M', 'D', 'H']:
            # need to test for ohlc from GH13083
            methods = [method for method in resample_methods
                       if method != 'ohlc']
            for method in methods:
                result = getattr(s.resample(freq), method)()

                expected = s.copy()
                expected.index = s.index._shallow_copy(freq=freq)
                assert_index_equal(result.index, expected.index)
                assert result.index.freq == expected.index.freq
                assert_series_equal(result, expected, check_dtype=False)

    def test_resample_empty_dataframe(self):
        # GH13212
        index = self.create_series().index[:0]
        f = DataFrame(index=index)

        for freq in ['M', 'D', 'H']:
            # count retains dimensions too
            methods = downsample_methods + ['count']
            for method in methods:
                result = getattr(f.resample(freq), method)()

                expected = f.copy()
                expected.index = f.index._shallow_copy(freq=freq)
                assert_index_equal(result.index, expected.index)
                assert result.index.freq == expected.index.freq
                assert_frame_equal(result, expected, check_dtype=False)

            # test size for GH13212 (currently stays as df)

    def test_resample_empty_dtypes(self):

        # Empty series were sometimes causing a segfault (for the functions
        # with Cython bounds-checking disabled) or an IndexError.  We just run
        # them to ensure they no longer do.  (GH #10228)
        for index in tm.all_timeseries_index_generator(0):
            for dtype in (np.float, np.int, np.object, 'datetime64[ns]'):
                for how in downsample_methods + upsample_methods:
                    empty_series = pd.Series([], index, dtype)
                    try:
                        getattr(empty_series.resample('d'), how)()
                    except DataError:
                        # Ignore these since some combinations are invalid
                        # (ex: doing mean with dtype of np.object)
                        pass

    def test_resample_loffset_arg_type(self):
        # GH 13218, 15002
        df = self.create_series().to_frame('value')
        expected_means = [df.values[i:i + 2].mean()
                          for i in range(0, len(df.values), 2)]
        expected_index = self.create_index(df.index[0],
                                           periods=len(df.index) / 2,
                                           freq='2D')

        # loffset coreces PeriodIndex to DateTimeIndex
        if isinstance(expected_index, PeriodIndex):
            expected_index = expected_index.to_timestamp()

        expected_index += timedelta(hours=2)
        expected = DataFrame({'value': expected_means}, index=expected_index)

        for arg in ['mean', {'value': 'mean'}, ['mean']]:

            result_agg = df.resample('2D', loffset='2H').agg(arg)

            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result_how = df.resample('2D', how=arg, loffset='2H')

            if isinstance(arg, list):
                expected.columns = pd.MultiIndex.from_tuples([('value',
                                                               'mean')])

            # GH 13022, 7687 - TODO: fix resample w/ TimedeltaIndex
            if isinstance(expected.index, TimedeltaIndex):
                with pytest.raises(AssertionError):
                    assert_frame_equal(result_agg, expected)
                    assert_frame_equal(result_how, expected)
            else:
                assert_frame_equal(result_agg, expected)
                assert_frame_equal(result_how, expected)


class TestDatetimeIndex(Base):
    _index_factory = lambda x: date_range

    def setup_method(self, method):
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='Min')

        self.series = Series(np.random.rand(len(dti)), dti)

    def create_series(self):
        i = date_range(datetime(2005, 1, 1),
                       datetime(2005, 1, 10), freq='D')

        return Series(np.arange(len(i)), index=i, name='dti')

    def test_custom_grouper(self):

        dti = DatetimeIndex(freq='Min', start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10))

        s = Series(np.array([1] * len(dti)), index=dti, dtype='int64')

        b = TimeGrouper(Minute(5))
        g = s.groupby(b)

        # check all cython functions work
        funcs = ['add', 'mean', 'prod', 'ohlc', 'min', 'max', 'var']
        for f in funcs:
            g._cython_agg_general(f)

        b = TimeGrouper(Minute(5), closed='right', label='right')
        g = s.groupby(b)
        # check all cython functions work
        funcs = ['add', 'mean', 'prod', 'ohlc', 'min', 'max', 'var']
        for f in funcs:
            g._cython_agg_general(f)

        assert g.ngroups == 2593
        assert notnull(g.mean()).all()

        # construct expected val
        arr = [1] + [5] * 2592
        idx = dti[0:-1:5]
        idx = idx.append(dti[-1:])
        expect = Series(arr, index=idx)

        # GH2763 - return in put dtype if we can
        result = g.agg(np.sum)
        assert_series_equal(result, expect)

        df = DataFrame(np.random.rand(len(dti), 10),
                       index=dti, dtype='float64')
        r = df.groupby(b).agg(np.sum)

        assert len(r.columns) == 10
        assert len(r.index) == 2593

    def test_resample_basic(self):
        rng = date_range('1/1/2000 00:00:00', '1/1/2000 00:13:00', freq='min',
                         name='index')
        s = Series(np.random.randn(14), index=rng)
        result = s.resample('5min', closed='right', label='right').mean()

        exp_idx = date_range('1/1/2000', periods=4, freq='5min', name='index')
        expected = Series([s[0], s[1:6].mean(), s[6:11].mean(), s[11:].mean()],
                          index=exp_idx)
        assert_series_equal(result, expected)
        assert result.index.name == 'index'

        result = s.resample('5min', closed='left', label='right').mean()

        exp_idx = date_range('1/1/2000 00:05', periods=3, freq='5min',
                             name='index')
        expected = Series([s[:5].mean(), s[5:10].mean(),
                           s[10:].mean()], index=exp_idx)
        assert_series_equal(result, expected)

        s = self.series
        result = s.resample('5Min').last()
        grouper = TimeGrouper(Minute(5), closed='left', label='left')
        expect = s.groupby(grouper).agg(lambda x: x[-1])
        assert_series_equal(result, expect)

    def test_resample_how(self):
        rng = date_range('1/1/2000 00:00:00', '1/1/2000 00:13:00', freq='min',
                         name='index')
        s = Series(np.random.randn(14), index=rng)
        grouplist = np.ones_like(s)
        grouplist[0] = 0
        grouplist[1:6] = 1
        grouplist[6:11] = 2
        grouplist[11:] = 3
        args = downsample_methods

        def _ohlc(group):
            if isnull(group).all():
                return np.repeat(np.nan, 4)
            return [group[0], group.max(), group.min(), group[-1]]

        inds = date_range('1/1/2000', periods=4, freq='5min', name='index')

        for arg in args:
            if arg == 'ohlc':
                func = _ohlc
            else:
                func = arg
            try:
                result = getattr(s.resample(
                    '5min', closed='right', label='right'), arg)()

                expected = s.groupby(grouplist).agg(func)
                assert result.index.name == 'index'
                if arg == 'ohlc':
                    expected = DataFrame(expected.values.tolist())
                    expected.columns = ['open', 'high', 'low', 'close']
                    expected.index = Index(inds, name='index')
                    assert_frame_equal(result, expected)
                else:
                    expected.index = inds
                    assert_series_equal(result, expected)
            except BaseException as exc:

                exc.args += ('how=%s' % arg,)
                raise

    def test_numpy_compat(self):
        # see gh-12811
        s = Series([1, 2, 3, 4, 5], index=date_range(
            '20130101', periods=5, freq='s'))
        r = s.resample('2s')

        msg = "numpy operations are not valid with resample"

        for func in ('min', 'max', 'sum', 'prod',
                     'mean', 'var', 'std'):
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(r, func),
                                   func, 1, 2, 3)
            tm.assert_raises_regex(UnsupportedFunctionCall, msg,
                                   getattr(r, func), axis=1)

    def test_resample_how_callables(self):
        # GH 7929
        data = np.arange(5, dtype=np.int64)
        ind = pd.DatetimeIndex(start='2014-01-01', periods=len(data), freq='d')
        df = pd.DataFrame({"A": data, "B": data}, index=ind)

        def fn(x, a=1):
            return str(type(x))

        class fn_class:

            def __call__(self, x):
                return str(type(x))

        df_standard = df.resample("M").apply(fn)
        df_lambda = df.resample("M").apply(lambda x: str(type(x)))
        df_partial = df.resample("M").apply(partial(fn))
        df_partial2 = df.resample("M").apply(partial(fn, a=2))
        df_class = df.resample("M").apply(fn_class())

        assert_frame_equal(df_standard, df_lambda)
        assert_frame_equal(df_standard, df_partial)
        assert_frame_equal(df_standard, df_partial2)
        assert_frame_equal(df_standard, df_class)

    def test_resample_with_timedeltas(self):

        expected = DataFrame({'A': np.arange(1480)})
        expected = expected.groupby(expected.index // 30).sum()
        expected.index = pd.timedelta_range('0 days', freq='30T', periods=50)

        df = DataFrame({'A': np.arange(1480)}, index=pd.to_timedelta(
            np.arange(1480), unit='T'))
        result = df.resample('30T').sum()

        assert_frame_equal(result, expected)

        s = df['A']
        result = s.resample('30T').sum()
        assert_series_equal(result, expected['A'])

    def test_resample_single_period_timedelta(self):

        s = Series(list(range(5)), index=pd.timedelta_range(
            '1 day', freq='s', periods=5))
        result = s.resample('2s').sum()
        expected = Series([1, 5, 4], index=pd.timedelta_range(
            '1 day', freq='2s', periods=3))
        assert_series_equal(result, expected)

    def test_resample_timedelta_idempotency(self):

        # GH 12072
        index = pd.timedelta_range('0', periods=9, freq='10L')
        series = pd.Series(range(9), index=index)
        result = series.resample('10L').mean()
        expected = series
        assert_series_equal(result, expected)

    def test_resample_rounding(self):
        # GH 8371
        # odd results when rounding is needed

        data = """date,time,value
11-08-2014,00:00:01.093,1
11-08-2014,00:00:02.159,1
11-08-2014,00:00:02.667,1
11-08-2014,00:00:03.175,1
11-08-2014,00:00:07.058,1
11-08-2014,00:00:07.362,1
11-08-2014,00:00:08.324,1
11-08-2014,00:00:08.830,1
11-08-2014,00:00:08.982,1
11-08-2014,00:00:09.815,1
11-08-2014,00:00:10.540,1
11-08-2014,00:00:11.061,1
11-08-2014,00:00:11.617,1
11-08-2014,00:00:13.607,1
11-08-2014,00:00:14.535,1
11-08-2014,00:00:15.525,1
11-08-2014,00:00:17.960,1
11-08-2014,00:00:20.674,1
11-08-2014,00:00:21.191,1"""

        from pandas.compat import StringIO
        df = pd.read_csv(StringIO(data), parse_dates={'timestamp': [
            'date', 'time']}, index_col='timestamp')
        df.index.name = None
        result = df.resample('6s').sum()
        expected = DataFrame({'value': [
            4, 9, 4, 2
        ]}, index=date_range('2014-11-08', freq='6s', periods=4))
        assert_frame_equal(result, expected)

        result = df.resample('7s').sum()
        expected = DataFrame({'value': [
            4, 10, 4, 1
        ]}, index=date_range('2014-11-08', freq='7s', periods=4))
        assert_frame_equal(result, expected)

        result = df.resample('11s').sum()
        expected = DataFrame({'value': [
            11, 8
        ]}, index=date_range('2014-11-08', freq='11s', periods=2))
        assert_frame_equal(result, expected)

        result = df.resample('13s').sum()
        expected = DataFrame({'value': [
            13, 6
        ]}, index=date_range('2014-11-08', freq='13s', periods=2))
        assert_frame_equal(result, expected)

        result = df.resample('17s').sum()
        expected = DataFrame({'value': [
            16, 3
        ]}, index=date_range('2014-11-08', freq='17s', periods=2))
        assert_frame_equal(result, expected)

    def test_resample_basic_from_daily(self):
        # from daily
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='D', name='index')

        s = Series(np.random.rand(len(dti)), dti)

        # to weekly
        result = s.resample('w-sun').last()

        assert len(result) == 3
        assert (result.index.dayofweek == [6, 6, 6]).all()
        assert result.iloc[0] == s['1/2/2005']
        assert result.iloc[1] == s['1/9/2005']
        assert result.iloc[2] == s.iloc[-1]

        result = s.resample('W-MON').last()
        assert len(result) == 2
        assert (result.index.dayofweek == [0, 0]).all()
        assert result.iloc[0] == s['1/3/2005']
        assert result.iloc[1] == s['1/10/2005']

        result = s.resample('W-TUE').last()
        assert len(result) == 2
        assert (result.index.dayofweek == [1, 1]).all()
        assert result.iloc[0] == s['1/4/2005']
        assert result.iloc[1] == s['1/10/2005']

        result = s.resample('W-WED').last()
        assert len(result) == 2
        assert (result.index.dayofweek == [2, 2]).all()
        assert result.iloc[0] == s['1/5/2005']
        assert result.iloc[1] == s['1/10/2005']

        result = s.resample('W-THU').last()
        assert len(result) == 2
        assert (result.index.dayofweek == [3, 3]).all()
        assert result.iloc[0] == s['1/6/2005']
        assert result.iloc[1] == s['1/10/2005']

        result = s.resample('W-FRI').last()
        assert len(result) == 2
        assert (result.index.dayofweek == [4, 4]).all()
        assert result.iloc[0] == s['1/7/2005']
        assert result.iloc[1] == s['1/10/2005']

        # to biz day
        result = s.resample('B').last()
        assert len(result) == 7
        assert (result.index.dayofweek == [4, 0, 1, 2, 3, 4, 0]).all()

        assert result.iloc[0] == s['1/2/2005']
        assert result.iloc[1] == s['1/3/2005']
        assert result.iloc[5] == s['1/9/2005']
        assert result.index.name == 'index'

    def test_resample_upsampling_picked_but_not_correct(self):

        # Test for issue #3020
        dates = date_range('01-Jan-2014', '05-Jan-2014', freq='D')
        series = Series(1, index=dates)

        result = series.resample('D').mean()
        assert result.index[0] == dates[0]

        # GH 5955
        # incorrect deciding to upsample when the axis frequency matches the
        # resample frequency

        import datetime
        s = Series(np.arange(1., 6), index=[datetime.datetime(
            1975, 1, i, 12, 0) for i in range(1, 6)])
        expected = Series(np.arange(1., 6), index=date_range(
            '19750101', periods=5, freq='D'))

        result = s.resample('D').count()
        assert_series_equal(result, Series(1, index=expected.index))

        result1 = s.resample('D').sum()
        result2 = s.resample('D').mean()
        assert_series_equal(result1, expected)
        assert_series_equal(result2, expected)

    def test_resample_frame_basic(self):
        df = tm.makeTimeDataFrame()

        b = TimeGrouper('M')
        g = df.groupby(b)

        # check all cython functions work
        funcs = ['add', 'mean', 'prod', 'min', 'max', 'var']
        for f in funcs:
            g._cython_agg_general(f)

        result = df.resample('A').mean()
        assert_series_equal(result['A'], df['A'].resample('A').mean())

        result = df.resample('M').mean()
        assert_series_equal(result['A'], df['A'].resample('M').mean())

        df.resample('M', kind='period').mean()
        df.resample('W-WED', kind='period').mean()

    def test_resample_loffset(self):
        rng = date_range('1/1/2000 00:00:00', '1/1/2000 00:13:00', freq='min')
        s = Series(np.random.randn(14), index=rng)

        result = s.resample('5min', closed='right', label='right',
                            loffset=timedelta(minutes=1)).mean()
        idx = date_range('1/1/2000', periods=4, freq='5min')
        expected = Series([s[0], s[1:6].mean(), s[6:11].mean(), s[11:].mean()],
                          index=idx + timedelta(minutes=1))
        assert_series_equal(result, expected)

        expected = s.resample(
            '5min', closed='right', label='right',
            loffset='1min').mean()
        assert_series_equal(result, expected)

        expected = s.resample(
            '5min', closed='right', label='right',
            loffset=Minute(1)).mean()
        assert_series_equal(result, expected)

        assert result.index.freq == Minute(5)

        # from daily
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='D')
        ser = Series(np.random.rand(len(dti)), dti)

        # to weekly
        result = ser.resample('w-sun').last()
        expected = ser.resample('w-sun', loffset=-bday).last()
        assert result.index[0] - bday == expected.index[0]

    def test_resample_loffset_count(self):
        # GH 12725
        start_time = '1/1/2000 00:00:00'
        rng = date_range(start_time, periods=100, freq='S')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.resample('10S', loffset='1s').count()

        expected_index = (
            date_range(start_time, periods=10, freq='10S') +
            timedelta(seconds=1)
        )
        expected = pd.Series(10, index=expected_index)

        assert_series_equal(result, expected)

        # Same issue should apply to .size() since it goes through
        #   same code path
        result = ts.resample('10S', loffset='1s').size()

        assert_series_equal(result, expected)

    def test_resample_upsample(self):
        # from daily
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='D', name='index')

        s = Series(np.random.rand(len(dti)), dti)

        # to minutely, by padding
        result = s.resample('Min').pad()
        assert len(result) == 12961
        assert result[0] == s[0]
        assert result[-1] == s[-1]

        assert result.index.name == 'index'

    def test_resample_how_method(self):
        # GH9915
        s = pd.Series([11, 22],
                      index=[Timestamp('2015-03-31 21:48:52.672000'),
                             Timestamp('2015-03-31 21:49:52.739000')])
        expected = pd.Series([11, np.NaN, np.NaN, np.NaN, np.NaN, np.NaN, 22],
                             index=[Timestamp('2015-03-31 21:48:50'),
                                    Timestamp('2015-03-31 21:49:00'),
                                    Timestamp('2015-03-31 21:49:10'),
                                    Timestamp('2015-03-31 21:49:20'),
                                    Timestamp('2015-03-31 21:49:30'),
                                    Timestamp('2015-03-31 21:49:40'),
                                    Timestamp('2015-03-31 21:49:50')])
        assert_series_equal(s.resample("10S").mean(), expected)

    def test_resample_extra_index_point(self):
        # GH 9756
        index = DatetimeIndex(start='20150101', end='20150331', freq='BM')
        expected = DataFrame({'A': Series([21, 41, 63], index=index)})

        index = DatetimeIndex(start='20150101', end='20150331', freq='B')
        df = DataFrame(
            {'A': Series(range(len(index)), index=index)}, dtype='int64')
        result = df.resample('BM').last()
        assert_frame_equal(result, expected)

    def test_upsample_with_limit(self):
        rng = date_range('1/1/2000', periods=3, freq='5t')
        ts = Series(np.random.randn(len(rng)), rng)

        result = ts.resample('t').ffill(limit=2)
        expected = ts.reindex(result.index, method='ffill', limit=2)
        assert_series_equal(result, expected)

    def test_resample_ohlc(self):
        s = self.series

        grouper = TimeGrouper(Minute(5))
        expect = s.groupby(grouper).agg(lambda x: x[-1])
        result = s.resample('5Min').ohlc()

        assert len(result) == len(expect)
        assert len(result.columns) == 4

        xs = result.iloc[-2]
        assert xs['open'] == s[-6]
        assert xs['high'] == s[-6:-1].max()
        assert xs['low'] == s[-6:-1].min()
        assert xs['close'] == s[-2]

        xs = result.iloc[0]
        assert xs['open'] == s[0]
        assert xs['high'] == s[:5].max()
        assert xs['low'] == s[:5].min()
        assert xs['close'] == s[4]

    def test_resample_ohlc_result(self):

        # GH 12332
        index = pd.date_range('1-1-2000', '2-15-2000', freq='h')
        index = index.union(pd.date_range('4-15-2000', '5-15-2000', freq='h'))
        s = Series(range(len(index)), index=index)

        a = s.loc[:'4-15-2000'].resample('30T').ohlc()
        assert isinstance(a, DataFrame)

        b = s.loc[:'4-14-2000'].resample('30T').ohlc()
        assert isinstance(b, DataFrame)

        # GH12348
        # raising on odd period
        rng = date_range('2013-12-30', '2014-01-07')
        index = rng.drop([Timestamp('2014-01-01'),
                          Timestamp('2013-12-31'),
                          Timestamp('2014-01-04'),
                          Timestamp('2014-01-05')])
        df = DataFrame(data=np.arange(len(index)), index=index)
        result = df.resample('B').mean()
        expected = df.reindex(index=date_range(rng[0], rng[-1], freq='B'))
        assert_frame_equal(result, expected)

    def test_resample_ohlc_dataframe(self):
        df = (
            pd.DataFrame({
                'PRICE': {
                    Timestamp('2011-01-06 10:59:05', tz=None): 24990,
                    Timestamp('2011-01-06 12:43:33', tz=None): 25499,
                    Timestamp('2011-01-06 12:54:09', tz=None): 25499},
                'VOLUME': {
                    Timestamp('2011-01-06 10:59:05', tz=None): 1500000000,
                    Timestamp('2011-01-06 12:43:33', tz=None): 5000000000,
                    Timestamp('2011-01-06 12:54:09', tz=None): 100000000}})
        ).reindex_axis(['VOLUME', 'PRICE'], axis=1)
        res = df.resample('H').ohlc()
        exp = pd.concat([df['VOLUME'].resample('H').ohlc(),
                         df['PRICE'].resample('H').ohlc()],
                        axis=1,
                        keys=['VOLUME', 'PRICE'])
        assert_frame_equal(exp, res)

        df.columns = [['a', 'b'], ['c', 'd']]
        res = df.resample('H').ohlc()
        exp.columns = pd.MultiIndex.from_tuples([
            ('a', 'c', 'open'), ('a', 'c', 'high'), ('a', 'c', 'low'),
            ('a', 'c', 'close'), ('b', 'd', 'open'), ('b', 'd', 'high'),
            ('b', 'd', 'low'), ('b', 'd', 'close')])
        assert_frame_equal(exp, res)

        # dupe columns fail atm
        # df.columns = ['PRICE', 'PRICE']

    def test_resample_dup_index(self):

        # GH 4812
        # dup columns with resample raising
        df = DataFrame(np.random.randn(4, 12), index=[2000, 2000, 2000, 2000],
                       columns=[Period(year=2000, month=i + 1, freq='M')
                                for i in range(12)])
        df.iloc[3, :] = np.nan
        result = df.resample('Q', axis=1).mean()
        expected = df.groupby(lambda x: int((x.month - 1) / 3), axis=1).mean()
        expected.columns = [
            Period(year=2000, quarter=i + 1, freq='Q') for i in range(4)]
        assert_frame_equal(result, expected)

    def test_resample_reresample(self):
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='D')
        s = Series(np.random.rand(len(dti)), dti)
        bs = s.resample('B', closed='right', label='right').mean()
        result = bs.resample('8H').mean()
        assert len(result) == 22
        assert isinstance(result.index.freq, offsets.DateOffset)
        assert result.index.freq == offsets.Hour(8)

    def test_resample_timestamp_to_period(self):
        ts = _simple_ts('1/1/1990', '1/1/2000')

        result = ts.resample('A-DEC', kind='period').mean()
        expected = ts.resample('A-DEC').mean()
        expected.index = period_range('1990', '2000', freq='a-dec')
        assert_series_equal(result, expected)

        result = ts.resample('A-JUN', kind='period').mean()
        expected = ts.resample('A-JUN').mean()
        expected.index = period_range('1990', '2000', freq='a-jun')
        assert_series_equal(result, expected)

        result = ts.resample('M', kind='period').mean()
        expected = ts.resample('M').mean()
        expected.index = period_range('1990-01', '2000-01', freq='M')
        assert_series_equal(result, expected)

        result = ts.resample('M', kind='period').mean()
        expected = ts.resample('M').mean()
        expected.index = period_range('1990-01', '2000-01', freq='M')
        assert_series_equal(result, expected)

    def test_ohlc_5min(self):
        def _ohlc(group):
            if isnull(group).all():
                return np.repeat(np.nan, 4)
            return [group[0], group.max(), group.min(), group[-1]]

        rng = date_range('1/1/2000 00:00:00', '1/1/2000 5:59:50', freq='10s')
        ts = Series(np.random.randn(len(rng)), index=rng)

        resampled = ts.resample('5min', closed='right',
                                label='right').ohlc()

        assert (resampled.loc['1/1/2000 00:00'] == ts[0]).all()

        exp = _ohlc(ts[1:31])
        assert (resampled.loc['1/1/2000 00:05'] == exp).all()

        exp = _ohlc(ts['1/1/2000 5:55:01':])
        assert (resampled.loc['1/1/2000 6:00:00'] == exp).all()

    def test_downsample_non_unique(self):
        rng = date_range('1/1/2000', '2/29/2000')
        rng2 = rng.repeat(5).values
        ts = Series(np.random.randn(len(rng2)), index=rng2)

        result = ts.resample('M').mean()

        expected = ts.groupby(lambda x: x.month).mean()
        assert len(result) == 2
        assert_almost_equal(result[0], expected[1])
        assert_almost_equal(result[1], expected[2])

    def test_asfreq_non_unique(self):
        # GH #1077
        rng = date_range('1/1/2000', '2/29/2000')
        rng2 = rng.repeat(2).values
        ts = Series(np.random.randn(len(rng2)), index=rng2)

        pytest.raises(Exception, ts.asfreq, 'B')

    def test_resample_axis1(self):
        rng = date_range('1/1/2000', '2/29/2000')
        df = DataFrame(np.random.randn(3, len(rng)), columns=rng,
                       index=['a', 'b', 'c'])

        result = df.resample('M', axis=1).mean()
        expected = df.T.resample('M').mean().T
        tm.assert_frame_equal(result, expected)

    def test_resample_panel(self):
        rng = date_range('1/1/2000', '6/30/2000')
        n = len(rng)

        with catch_warnings(record=True):
            panel = Panel(np.random.randn(3, n, 5),
                          items=['one', 'two', 'three'],
                          major_axis=rng,
                          minor_axis=['a', 'b', 'c', 'd', 'e'])

            result = panel.resample('M', axis=1).mean()

            def p_apply(panel, f):
                result = {}
                for item in panel.items:
                    result[item] = f(panel[item])
                return Panel(result, items=panel.items)

            expected = p_apply(panel, lambda x: x.resample('M').mean())
            tm.assert_panel_equal(result, expected)

            panel2 = panel.swapaxes(1, 2)
            result = panel2.resample('M', axis=2).mean()
            expected = p_apply(panel2,
                               lambda x: x.resample('M', axis=1).mean())
            tm.assert_panel_equal(result, expected)

    def test_resample_panel_numpy(self):
        rng = date_range('1/1/2000', '6/30/2000')
        n = len(rng)

        with catch_warnings(record=True):
            panel = Panel(np.random.randn(3, n, 5),
                          items=['one', 'two', 'three'],
                          major_axis=rng,
                          minor_axis=['a', 'b', 'c', 'd', 'e'])

            result = panel.resample('M', axis=1).apply(lambda x: x.mean(1))
            expected = panel.resample('M', axis=1).mean()
            tm.assert_panel_equal(result, expected)

            panel = panel.swapaxes(1, 2)
            result = panel.resample('M', axis=2).apply(lambda x: x.mean(2))
            expected = panel.resample('M', axis=2).mean()
            tm.assert_panel_equal(result, expected)

    def test_resample_anchored_ticks(self):
        # If a fixed delta (5 minute, 4 hour) evenly divides a day, we should
        # "anchor" the origin at midnight so we get regular intervals rather
        # than starting from the first timestamp which might start in the
        # middle of a desired interval

        rng = date_range('1/1/2000 04:00:00', periods=86400, freq='s')
        ts = Series(np.random.randn(len(rng)), index=rng)
        ts[:2] = np.nan  # so results are the same

        freqs = ['t', '5t', '15t', '30t', '4h', '12h']
        for freq in freqs:
            result = ts[2:].resample(freq, closed='left', label='left').mean()
            expected = ts.resample(freq, closed='left', label='left').mean()
            assert_series_equal(result, expected)

    def test_resample_single_group(self):
        mysum = lambda x: x.sum()

        rng = date_range('2000-1-1', '2000-2-10', freq='D')
        ts = Series(np.random.randn(len(rng)), index=rng)
        assert_series_equal(ts.resample('M').sum(),
                            ts.resample('M').apply(mysum))

        rng = date_range('2000-1-1', '2000-1-10', freq='D')
        ts = Series(np.random.randn(len(rng)), index=rng)
        assert_series_equal(ts.resample('M').sum(),
                            ts.resample('M').apply(mysum))

        # GH 3849
        s = Series([30.1, 31.6], index=[Timestamp('20070915 15:30:00'),
                                        Timestamp('20070915 15:40:00')])
        expected = Series([0.75], index=[Timestamp('20070915')])
        result = s.resample('D').apply(lambda x: np.std(x))
        assert_series_equal(result, expected)

    def test_resample_base(self):
        rng = date_range('1/1/2000 00:00:00', '1/1/2000 02:00', freq='s')
        ts = Series(np.random.randn(len(rng)), index=rng)

        resampled = ts.resample('5min', base=2).mean()
        exp_rng = date_range('12/31/1999 23:57:00', '1/1/2000 01:57',
                             freq='5min')
        tm.assert_index_equal(resampled.index, exp_rng)

    def test_resample_base_with_timedeltaindex(self):

        # GH 10530
        rng = timedelta_range(start='0s', periods=25, freq='s')
        ts = Series(np.random.randn(len(rng)), index=rng)

        with_base = ts.resample('2s', base=5).mean()
        without_base = ts.resample('2s').mean()

        exp_without_base = timedelta_range(start='0s', end='25s', freq='2s')
        exp_with_base = timedelta_range(start='5s', end='29s', freq='2s')

        tm.assert_index_equal(without_base.index, exp_without_base)
        tm.assert_index_equal(with_base.index, exp_with_base)

    def test_resample_categorical_data_with_timedeltaindex(self):
        # GH #12169
        df = DataFrame({'Group_obj': 'A'},
                       index=pd.to_timedelta(list(range(20)), unit='s'))
        df['Group'] = df['Group_obj'].astype('category')
        result = df.resample('10s').agg(lambda x: (x.value_counts().index[0]))
        expected = DataFrame({'Group_obj': ['A', 'A'],
                              'Group': ['A', 'A']},
                             index=pd.to_timedelta([0, 10], unit='s'))
        expected = expected.reindex_axis(['Group_obj', 'Group'], 1)
        tm.assert_frame_equal(result, expected)

    def test_resample_daily_anchored(self):
        rng = date_range('1/1/2000 0:00:00', periods=10000, freq='T')
        ts = Series(np.random.randn(len(rng)), index=rng)
        ts[:2] = np.nan  # so results are the same

        result = ts[2:].resample('D', closed='left', label='left').mean()
        expected = ts.resample('D', closed='left', label='left').mean()
        assert_series_equal(result, expected)

    def test_resample_to_period_monthly_buglet(self):
        # GH #1259

        rng = date_range('1/1/2000', '12/31/2000')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.resample('M', kind='period').mean()
        exp_index = period_range('Jan-2000', 'Dec-2000', freq='M')
        tm.assert_index_equal(result.index, exp_index)

    def test_period_with_agg(self):

        # aggregate a period resampler with a lambda
        s2 = pd.Series(np.random.randint(0, 5, 50),
                       index=pd.period_range('2012-01-01',
                                             freq='H',
                                             periods=50),
                       dtype='float64')

        expected = s2.to_timestamp().resample('D').mean().to_period()
        result = s2.resample('D').agg(lambda x: x.mean())
        assert_series_equal(result, expected)

    def test_resample_segfault(self):
        # GH 8573
        # segfaulting in older versions
        all_wins_and_wagers = [
            (1, datetime(2013, 10, 1, 16, 20), 1, 0),
            (2, datetime(2013, 10, 1, 16, 10), 1, 0),
            (2, datetime(2013, 10, 1, 18, 15), 1, 0),
            (2, datetime(2013, 10, 1, 16, 10, 31), 1, 0)]

        df = pd.DataFrame.from_records(all_wins_and_wagers,
                                       columns=("ID", "timestamp", "A", "B")
                                       ).set_index("timestamp")
        result = df.groupby("ID").resample("5min").sum()
        expected = df.groupby("ID").apply(lambda x: x.resample("5min").sum())
        assert_frame_equal(result, expected)

    def test_resample_dtype_preservation(self):

        # GH 12202
        # validation tests for dtype preservation

        df = DataFrame({'date': pd.date_range(start='2016-01-01',
                                              periods=4, freq='W'),
                        'group': [1, 1, 2, 2],
                        'val': Series([5, 6, 7, 8],
                                      dtype='int32')}
                       ).set_index('date')

        result = df.resample('1D').ffill()
        assert result.val.dtype == np.int32

        result = df.groupby('group').resample('1D').ffill()
        assert result.val.dtype == np.int32

    def test_resample_dtype_coerceion(self):

        pytest.importorskip('scipy')

        # GH 16361
        df = {"a": [1, 3, 1, 4]}
        df = pd.DataFrame(
            df, index=pd.date_range("2017-01-01", "2017-01-04"))

        expected = (df.astype("float64")
                    .resample("H")
                    .mean()
                    ["a"]
                    .interpolate("cubic")
                    )

        result = df.resample("H")["a"].mean().interpolate("cubic")
        tm.assert_series_equal(result, expected)

        result = df.resample("H").mean()["a"].interpolate("cubic")
        tm.assert_series_equal(result, expected)

    def test_weekly_resample_buglet(self):
        # #1327
        rng = date_range('1/1/2000', freq='B', periods=20)
        ts = Series(np.random.randn(len(rng)), index=rng)

        resampled = ts.resample('W').mean()
        expected = ts.resample('W-SUN').mean()
        assert_series_equal(resampled, expected)

    def test_monthly_resample_error(self):
        # #1451
        dates = date_range('4/16/2012 20:00', periods=5000, freq='h')
        ts = Series(np.random.randn(len(dates)), index=dates)
        # it works!
        ts.resample('M')

    def test_nanosecond_resample_error(self):
        # GH 12307 - Values falls after last bin when
        # Resampling using pd.tseries.offsets.Nano as period
        start = 1443707890427
        exp_start = 1443707890400
        indx = pd.date_range(
            start=pd.to_datetime(start),
            periods=10,
            freq='100n'
        )
        ts = pd.Series(range(len(indx)), index=indx)
        r = ts.resample(pd.tseries.offsets.Nano(100))
        result = r.agg('mean')

        exp_indx = pd.date_range(
            start=pd.to_datetime(exp_start),
            periods=10,
            freq='100n'
        )
        exp = pd.Series(range(len(exp_indx)), index=exp_indx)

        assert_series_equal(result, exp)

    def test_resample_anchored_intraday(self):
        # #1471, #1458

        rng = date_range('1/1/2012', '4/1/2012', freq='100min')
        df = DataFrame(rng.month, index=rng)

        result = df.resample('M').mean()
        expected = df.resample(
            'M', kind='period').mean().to_timestamp(how='end')
        tm.assert_frame_equal(result, expected)

        result = df.resample('M', closed='left').mean()
        exp = df.tshift(1, freq='D').resample('M', kind='period').mean()
        exp = exp.to_timestamp(how='end')

        tm.assert_frame_equal(result, exp)

        rng = date_range('1/1/2012', '4/1/2012', freq='100min')
        df = DataFrame(rng.month, index=rng)

        result = df.resample('Q').mean()
        expected = df.resample(
            'Q', kind='period').mean().to_timestamp(how='end')
        tm.assert_frame_equal(result, expected)

        result = df.resample('Q', closed='left').mean()
        expected = df.tshift(1, freq='D').resample('Q', kind='period',
                                                   closed='left').mean()
        expected = expected.to_timestamp(how='end')
        tm.assert_frame_equal(result, expected)

        ts = _simple_ts('2012-04-29 23:00', '2012-04-30 5:00', freq='h')
        resampled = ts.resample('M').mean()
        assert len(resampled) == 1

    def test_resample_anchored_monthstart(self):
        ts = _simple_ts('1/1/2000', '12/31/2002')

        freqs = ['MS', 'BMS', 'QS-MAR', 'AS-DEC', 'AS-JUN']

        for freq in freqs:
            ts.resample(freq).mean()

    def test_resample_anchored_multiday(self):
        # When resampling a range spanning multiple days, ensure that the
        # start date gets used to determine the offset.  Fixes issue where
        # a one day period is not a multiple of the frequency.
        #
        # See: https://github.com/pandas-dev/pandas/issues/8683

        index = pd.date_range(
            '2014-10-14 23:06:23.206', periods=3, freq='400L'
        ) | pd.date_range(
            '2014-10-15 23:00:00', periods=2, freq='2200L')

        s = pd.Series(np.random.randn(5), index=index)

        # Ensure left closing works
        result = s.resample('2200L').mean()
        assert result.index[-1] == pd.Timestamp('2014-10-15 23:00:02.000')

        # Ensure right closing works
        result = s.resample('2200L', label='right').mean()
        assert result.index[-1] == pd.Timestamp('2014-10-15 23:00:04.200')

    def test_corner_cases(self):
        # miscellaneous test coverage

        rng = date_range('1/1/2000', periods=12, freq='t')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.resample('5t', closed='right', label='left').mean()
        ex_index = date_range('1999-12-31 23:55', periods=4, freq='5t')
        tm.assert_index_equal(result.index, ex_index)

        len0pts = _simple_pts('2007-01', '2010-05', freq='M')[:0]
        # it works
        result = len0pts.resample('A-DEC').mean()
        assert len(result) == 0

        # resample to periods
        ts = _simple_ts('2000-04-28', '2000-04-30 11:00', freq='h')
        result = ts.resample('M', kind='period').mean()
        assert len(result) == 1
        assert result.index[0] == Period('2000-04', freq='M')

    def test_anchored_lowercase_buglet(self):
        dates = date_range('4/16/2012 20:00', periods=50000, freq='s')
        ts = Series(np.random.randn(len(dates)), index=dates)
        # it works!
        ts.resample('d').mean()

    def test_upsample_apply_functions(self):
        # #1596
        rng = pd.date_range('2012-06-12', periods=4, freq='h')

        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.resample('20min').aggregate(['mean', 'sum'])
        assert isinstance(result, DataFrame)

    def test_resample_not_monotonic(self):
        rng = pd.date_range('2012-06-12', periods=200, freq='h')
        ts = Series(np.random.randn(len(rng)), index=rng)

        ts = ts.take(np.random.permutation(len(ts)))

        result = ts.resample('D').sum()
        exp = ts.sort_index().resample('D').sum()
        assert_series_equal(result, exp)

    def test_resample_median_bug_1688(self):

        for dtype in ['int64', 'int32', 'float64', 'float32']:
            df = DataFrame([1, 2], index=[datetime(2012, 1, 1, 0, 0, 0),
                                          datetime(2012, 1, 1, 0, 5, 0)],
                           dtype=dtype)

            result = df.resample("T").apply(lambda x: x.mean())
            exp = df.asfreq('T')
            tm.assert_frame_equal(result, exp)

            result = df.resample("T").median()
            exp = df.asfreq('T')
            tm.assert_frame_equal(result, exp)

    def test_how_lambda_functions(self):

        ts = _simple_ts('1/1/2000', '4/1/2000')

        result = ts.resample('M').apply(lambda x: x.mean())
        exp = ts.resample('M').mean()
        tm.assert_series_equal(result, exp)

        foo_exp = ts.resample('M').mean()
        foo_exp.name = 'foo'
        bar_exp = ts.resample('M').std()
        bar_exp.name = 'bar'

        result = ts.resample('M').apply(
            [lambda x: x.mean(), lambda x: x.std(ddof=1)])
        result.columns = ['foo', 'bar']
        tm.assert_series_equal(result['foo'], foo_exp)
        tm.assert_series_equal(result['bar'], bar_exp)

        # this is a MI Series, so comparing the names of the results
        # doesn't make sense
        result = ts.resample('M').aggregate({'foo': lambda x: x.mean(),
                                             'bar': lambda x: x.std(ddof=1)})
        tm.assert_series_equal(result['foo'], foo_exp, check_names=False)
        tm.assert_series_equal(result['bar'], bar_exp, check_names=False)

    def test_resample_unequal_times(self):
        # #1772
        start = datetime(1999, 3, 1, 5)
        # end hour is less than start
        end = datetime(2012, 7, 31, 4)
        bad_ind = date_range(start, end, freq="30min")
        df = DataFrame({'close': 1}, index=bad_ind)

        # it works!
        df.resample('AS').sum()

    def test_resample_consistency(self):

        # GH 6418
        # resample with bfill / limit / reindex consistency

        i30 = pd.date_range('2002-02-02', periods=4, freq='30T')
        s = pd.Series(np.arange(4.), index=i30)
        s[2] = np.NaN

        # Upsample by factor 3 with reindex() and resample() methods:
        i10 = pd.date_range(i30[0], i30[-1], freq='10T')

        s10 = s.reindex(index=i10, method='bfill')
        s10_2 = s.reindex(index=i10, method='bfill', limit=2)
        rl = s.reindex_like(s10, method='bfill', limit=2)
        r10_2 = s.resample('10Min').bfill(limit=2)
        r10 = s.resample('10Min').bfill()

        # s10_2, r10, r10_2, rl should all be equal
        assert_series_equal(s10_2, r10)
        assert_series_equal(s10_2, r10_2)
        assert_series_equal(s10_2, rl)

    def test_resample_timegrouper(self):
        # GH 7227
        dates1 = [datetime(2014, 10, 1), datetime(2014, 9, 3),
                  datetime(2014, 11, 5), datetime(2014, 9, 5),
                  datetime(2014, 10, 8), datetime(2014, 7, 15)]

        dates2 = dates1[:2] + [pd.NaT] + dates1[2:4] + [pd.NaT] + dates1[4:]
        dates3 = [pd.NaT] + dates1 + [pd.NaT]

        for dates in [dates1, dates2, dates3]:
            df = DataFrame(dict(A=dates, B=np.arange(len(dates))))
            result = df.set_index('A').resample('M').count()
            exp_idx = pd.DatetimeIndex(['2014-07-31', '2014-08-31',
                                        '2014-09-30',
                                        '2014-10-31', '2014-11-30'],
                                       freq='M', name='A')
            expected = DataFrame({'B': [1, 0, 2, 2, 1]}, index=exp_idx)
            assert_frame_equal(result, expected)

            result = df.groupby(pd.Grouper(freq='M', key='A')).count()
            assert_frame_equal(result, expected)

            df = DataFrame(dict(A=dates, B=np.arange(len(dates)), C=np.arange(
                len(dates))))
            result = df.set_index('A').resample('M').count()
            expected = DataFrame({'B': [1, 0, 2, 2, 1], 'C': [1, 0, 2, 2, 1]},
                                 index=exp_idx, columns=['B', 'C'])
            assert_frame_equal(result, expected)

            result = df.groupby(pd.Grouper(freq='M', key='A')).count()
            assert_frame_equal(result, expected)

    def test_resample_nunique(self):

        # GH 12352
        df = DataFrame({
            'ID': {pd.Timestamp('2015-06-05 00:00:00'): '0010100903',
                   pd.Timestamp('2015-06-08 00:00:00'): '0010150847'},
            'DATE': {pd.Timestamp('2015-06-05 00:00:00'): '2015-06-05',
                     pd.Timestamp('2015-06-08 00:00:00'): '2015-06-08'}})
        r = df.resample('D')
        g = df.groupby(pd.Grouper(freq='D'))
        expected = df.groupby(pd.TimeGrouper('D')).ID.apply(lambda x:
                                                            x.nunique())
        assert expected.name == 'ID'

        for t in [r, g]:
            result = r.ID.nunique()
            assert_series_equal(result, expected)

        result = df.ID.resample('D').nunique()
        assert_series_equal(result, expected)

        result = df.ID.groupby(pd.Grouper(freq='D')).nunique()
        assert_series_equal(result, expected)

    def test_resample_nunique_with_date_gap(self):
        # GH 13453
        index = pd.date_range('1-1-2000', '2-15-2000', freq='h')
        index2 = pd.date_range('4-15-2000', '5-15-2000', freq='h')
        index3 = index.append(index2)
        s = pd.Series(range(len(index3)), index=index3, dtype='int64')
        r = s.resample('M')

        # Since all elements are unique, these should all be the same
        results = [
            r.count(),
            r.nunique(),
            r.agg(pd.Series.nunique),
            r.agg('nunique')
        ]

        assert_series_equal(results[0], results[1])
        assert_series_equal(results[0], results[2])
        assert_series_equal(results[0], results[3])

    def test_resample_group_info(self):  # GH10914
        for n, k in product((10000, 100000), (10, 100, 1000)):
            dr = date_range(start='2015-08-27', periods=n // 10, freq='T')
            ts = Series(np.random.randint(0, n // k, n).astype('int64'),
                        index=np.random.choice(dr, n))

            left = ts.resample('30T').nunique()
            ix = date_range(start=ts.index.min(), end=ts.index.max(),
                            freq='30T')

            vals = ts.values
            bins = np.searchsorted(ix.values, ts.index, side='right')

            sorter = np.lexsort((vals, bins))
            vals, bins = vals[sorter], bins[sorter]

            mask = np.r_[True, vals[1:] != vals[:-1]]
            mask |= np.r_[True, bins[1:] != bins[:-1]]

            arr = np.bincount(bins[mask] - 1,
                              minlength=len(ix)).astype('int64', copy=False)
            right = Series(arr, index=ix)

            assert_series_equal(left, right)

    def test_resample_size(self):
        n = 10000
        dr = date_range('2015-09-19', periods=n, freq='T')
        ts = Series(np.random.randn(n), index=np.random.choice(dr, n))

        left = ts.resample('7T').size()
        ix = date_range(start=left.index.min(), end=ts.index.max(), freq='7T')

        bins = np.searchsorted(ix.values, ts.index.values, side='right')
        val = np.bincount(bins, minlength=len(ix) + 1)[1:].astype('int64',
                                                                  copy=False)

        right = Series(val, index=ix)
        assert_series_equal(left, right)

    def test_resample_across_dst(self):
        # The test resamples a DatetimeIndex with values before and after a
        # DST change
        # Issue: 14682

        # The DatetimeIndex we will start with
        # (note that DST happens at 03:00+02:00 -> 02:00+01:00)
        # 2016-10-30 02:23:00+02:00, 2016-10-30 02:23:00+01:00
        df1 = DataFrame([1477786980, 1477790580], columns=['ts'])
        dti1 = DatetimeIndex(pd.to_datetime(df1.ts, unit='s')
                             .dt.tz_localize('UTC')
                             .dt.tz_convert('Europe/Madrid'))

        # The expected DatetimeIndex after resampling.
        # 2016-10-30 02:00:00+02:00, 2016-10-30 02:00:00+01:00
        df2 = DataFrame([1477785600, 1477789200], columns=['ts'])
        dti2 = DatetimeIndex(pd.to_datetime(df2.ts, unit='s')
                             .dt.tz_localize('UTC')
                             .dt.tz_convert('Europe/Madrid'))
        df = DataFrame([5, 5], index=dti1)

        result = df.resample(rule='H').sum()
        expected = DataFrame([5, 5], index=dti2)

        assert_frame_equal(result, expected)

    def test_resample_dst_anchor(self):
        # 5172
        dti = DatetimeIndex([datetime(2012, 11, 4, 23)], tz='US/Eastern')
        df = DataFrame([5], index=dti)
        assert_frame_equal(df.resample(rule='D').sum(),
                           DataFrame([5], index=df.index.normalize()))
        df.resample(rule='MS').sum()
        assert_frame_equal(
            df.resample(rule='MS').sum(),
            DataFrame([5], index=DatetimeIndex([datetime(2012, 11, 1)],
                                               tz='US/Eastern')))

        dti = date_range('2013-09-30', '2013-11-02', freq='30Min',
                         tz='Europe/Paris')
        values = range(dti.size)
        df = DataFrame({"a": values,
                        "b": values,
                        "c": values}, index=dti, dtype='int64')
        how = {"a": "min", "b": "max", "c": "count"}

        assert_frame_equal(
            df.resample("W-MON").agg(how)[["a", "b", "c"]],
            DataFrame({"a": [0, 48, 384, 720, 1056, 1394],
                       "b": [47, 383, 719, 1055, 1393, 1586],
                       "c": [48, 336, 336, 336, 338, 193]},
                      index=date_range('9/30/2013', '11/4/2013',
                                       freq='W-MON', tz='Europe/Paris')),
            'W-MON Frequency')

        assert_frame_equal(
            df.resample("2W-MON").agg(how)[["a", "b", "c"]],
            DataFrame({"a": [0, 48, 720, 1394],
                       "b": [47, 719, 1393, 1586],
                       "c": [48, 672, 674, 193]},
                      index=date_range('9/30/2013', '11/11/2013',
                                       freq='2W-MON', tz='Europe/Paris')),
            '2W-MON Frequency')

        assert_frame_equal(
            df.resample("MS").agg(how)[["a", "b", "c"]],
            DataFrame({"a": [0, 48, 1538],
                       "b": [47, 1537, 1586],
                       "c": [48, 1490, 49]},
                      index=date_range('9/1/2013', '11/1/2013',
                                       freq='MS', tz='Europe/Paris')),
            'MS Frequency')

        assert_frame_equal(
            df.resample("2MS").agg(how)[["a", "b", "c"]],
            DataFrame({"a": [0, 1538],
                       "b": [1537, 1586],
                       "c": [1538, 49]},
                      index=date_range('9/1/2013', '11/1/2013',
                                       freq='2MS', tz='Europe/Paris')),
            '2MS Frequency')

        df_daily = df['10/26/2013':'10/29/2013']
        assert_frame_equal(
            df_daily.resample("D").agg({"a": "min", "b": "max", "c": "count"})
            [["a", "b", "c"]],
            DataFrame({"a": [1248, 1296, 1346, 1394],
                       "b": [1295, 1345, 1393, 1441],
                       "c": [48, 50, 48, 48]},
                      index=date_range('10/26/2013', '10/29/2013',
                                       freq='D', tz='Europe/Paris')),
            'D Frequency')

    def test_resample_with_nat(self):
        # GH 13020
        index = DatetimeIndex([pd.NaT,
                               '1970-01-01 00:00:00',
                               pd.NaT,
                               '1970-01-01 00:00:01',
                               '1970-01-01 00:00:02'])
        frame = DataFrame([2, 3, 5, 7, 11], index=index)

        index_1s = DatetimeIndex(['1970-01-01 00:00:00',
                                  '1970-01-01 00:00:01',
                                  '1970-01-01 00:00:02'])
        frame_1s = DataFrame([3, 7, 11], index=index_1s)
        assert_frame_equal(frame.resample('1s').mean(), frame_1s)

        index_2s = DatetimeIndex(['1970-01-01 00:00:00',
                                  '1970-01-01 00:00:02'])
        frame_2s = DataFrame([5, 11], index=index_2s)
        assert_frame_equal(frame.resample('2s').mean(), frame_2s)

        index_3s = DatetimeIndex(['1970-01-01 00:00:00'])
        frame_3s = DataFrame([7], index=index_3s)
        assert_frame_equal(frame.resample('3s').mean(), frame_3s)

        assert_frame_equal(frame.resample('60s').mean(), frame_3s)

    def test_resample_timedelta_values(self):
        # GH 13119
        # check that timedelta dtype is preserved when NaT values are
        # introduced by the resampling

        times = timedelta_range('1 day', '4 day', freq='4D')
        df = DataFrame({'time': times}, index=times)

        times2 = timedelta_range('1 day', '4 day', freq='2D')
        exp = Series(times2, index=times2, name='time')
        exp.iloc[1] = pd.NaT

        res = df.resample('2D').first()['time']
        tm.assert_series_equal(res, exp)
        res = df['time'].resample('2D').first()
        tm.assert_series_equal(res, exp)

    def test_resample_datetime_values(self):
        # GH 13119
        # check that datetime dtype is preserved when NaT values are
        # introduced by the resampling

        dates = [datetime(2016, 1, 15), datetime(2016, 1, 19)]
        df = DataFrame({'timestamp': dates}, index=dates)

        exp = Series([datetime(2016, 1, 15), pd.NaT, datetime(2016, 1, 19)],
                     index=date_range('2016-01-15', periods=3, freq='2D'),
                     name='timestamp')

        res = df.resample('2D').first()['timestamp']
        tm.assert_series_equal(res, exp)
        res = df['timestamp'].resample('2D').first()
        tm.assert_series_equal(res, exp)


class TestPeriodIndex(Base):
    _index_factory = lambda x: period_range

    def create_series(self):
        i = period_range(datetime(2005, 1, 1),
                         datetime(2005, 1, 10), freq='D')

        return Series(np.arange(len(i)), index=i, name='pi')

    def test_asfreq_downsample(self):

        # series
        s = self.create_series()
        expected = s.reindex(s.index.take(np.arange(0, len(s.index), 2)))
        expected.index = expected.index.to_timestamp()
        expected.index.freq = to_offset('2D')

        # this is a bug, this *should* return a PeriodIndex
        # directly
        # GH 12884
        result = s.resample('2D').asfreq()
        assert_series_equal(result, expected)

        # frame
        frame = s.to_frame('value')
        expected = frame.reindex(
            frame.index.take(np.arange(0, len(frame.index), 2)))
        expected.index = expected.index.to_timestamp()
        expected.index.freq = to_offset('2D')
        result = frame.resample('2D').asfreq()
        assert_frame_equal(result, expected)

    def test_asfreq_upsample(self):

        # this is a bug, this *should* return a PeriodIndex
        # directly
        # GH 12884
        s = self.create_series()
        new_index = date_range(s.index[0].to_timestamp(how='start'),
                               (s.index[-1] + 1).to_timestamp(how='start'),
                               freq='1H',
                               closed='left')
        expected = s.to_timestamp().reindex(new_index).to_period()
        result = s.resample('1H').asfreq()
        assert_series_equal(result, expected)

        frame = s.to_frame('value')
        new_index = date_range(frame.index[0].to_timestamp(how='start'),
                               (frame.index[-1] + 1).to_timestamp(how='start'),
                               freq='1H',
                               closed='left')
        expected = frame.to_timestamp().reindex(new_index).to_period()
        result = frame.resample('1H').asfreq()
        assert_frame_equal(result, expected)

    def test_asfreq_fill_value(self):
        # test for fill value during resampling, issue 3715

        s = self.create_series()
        new_index = date_range(s.index[0].to_timestamp(how='start'),
                               (s.index[-1]).to_timestamp(how='start'),
                               freq='1H')
        expected = s.to_timestamp().reindex(new_index, fill_value=4.0)
        result = s.resample('1H', kind='timestamp').asfreq(fill_value=4.0)
        assert_series_equal(result, expected)

        frame = s.to_frame('value')
        new_index = date_range(frame.index[0].to_timestamp(how='start'),
                               (frame.index[-1]).to_timestamp(how='start'),
                               freq='1H')
        expected = frame.to_timestamp().reindex(new_index, fill_value=3.0)
        result = frame.resample('1H', kind='timestamp').asfreq(fill_value=3.0)
        assert_frame_equal(result, expected)

    def test_selection(self):
        index = self.create_series().index
        # This is a bug, these should be implemented
        # GH 14008
        df = pd.DataFrame({'date': index,
                           'a': np.arange(len(index), dtype=np.int64)},
                          index=pd.MultiIndex.from_arrays([
                              np.arange(len(index), dtype=np.int64),
                              index], names=['v', 'd']))

        with pytest.raises(NotImplementedError):
            df.resample('2D', on='date')

        with pytest.raises(NotImplementedError):
            df.resample('2D', level='d')

    def test_annual_upsample_D_s_f(self):
        self._check_annual_upsample_cases('D', 'start', 'ffill')

    def test_annual_upsample_D_e_f(self):
        self._check_annual_upsample_cases('D', 'end', 'ffill')

    def test_annual_upsample_D_s_b(self):
        self._check_annual_upsample_cases('D', 'start', 'bfill')

    def test_annual_upsample_D_e_b(self):
        self._check_annual_upsample_cases('D', 'end', 'bfill')

    def test_annual_upsample_B_s_f(self):
        self._check_annual_upsample_cases('B', 'start', 'ffill')

    def test_annual_upsample_B_e_f(self):
        self._check_annual_upsample_cases('B', 'end', 'ffill')

    def test_annual_upsample_B_s_b(self):
        self._check_annual_upsample_cases('B', 'start', 'bfill')

    def test_annual_upsample_B_e_b(self):
        self._check_annual_upsample_cases('B', 'end', 'bfill')

    def test_annual_upsample_M_s_f(self):
        self._check_annual_upsample_cases('M', 'start', 'ffill')

    def test_annual_upsample_M_e_f(self):
        self._check_annual_upsample_cases('M', 'end', 'ffill')

    def test_annual_upsample_M_s_b(self):
        self._check_annual_upsample_cases('M', 'start', 'bfill')

    def test_annual_upsample_M_e_b(self):
        self._check_annual_upsample_cases('M', 'end', 'bfill')

    def _check_annual_upsample_cases(self, targ, conv, meth, end='12/31/1991'):
        for month in MONTHS:
            ts = _simple_pts('1/1/1990', end, freq='A-%s' % month)

            result = getattr(ts.resample(targ, convention=conv), meth)()
            expected = result.to_timestamp(targ, how=conv)
            expected = expected.asfreq(targ, meth).to_period()
            assert_series_equal(result, expected)

    def test_basic_downsample(self):
        ts = _simple_pts('1/1/1990', '6/30/1995', freq='M')
        result = ts.resample('a-dec').mean()

        expected = ts.groupby(ts.index.year).mean()
        expected.index = period_range('1/1/1990', '6/30/1995', freq='a-dec')
        assert_series_equal(result, expected)

        # this is ok
        assert_series_equal(ts.resample('a-dec').mean(), result)
        assert_series_equal(ts.resample('a').mean(), result)

    def test_not_subperiod(self):
        # These are incompatible period rules for resampling
        ts = _simple_pts('1/1/1990', '6/30/1995', freq='w-wed')
        pytest.raises(ValueError, lambda: ts.resample('a-dec').mean())
        pytest.raises(ValueError, lambda: ts.resample('q-mar').mean())
        pytest.raises(ValueError, lambda: ts.resample('M').mean())
        pytest.raises(ValueError, lambda: ts.resample('w-thu').mean())

    def test_basic_upsample(self):
        ts = _simple_pts('1/1/1990', '6/30/1995', freq='M')
        result = ts.resample('a-dec').mean()

        resampled = result.resample('D', convention='end').ffill()

        expected = result.to_timestamp('D', how='end')
        expected = expected.asfreq('D', 'ffill').to_period()

        assert_series_equal(resampled, expected)

    def test_upsample_with_limit(self):
        rng = period_range('1/1/2000', periods=5, freq='A')
        ts = Series(np.random.randn(len(rng)), rng)

        result = ts.resample('M', convention='end').ffill(limit=2)
        expected = ts.asfreq('M').reindex(result.index, method='ffill',
                                          limit=2)
        assert_series_equal(result, expected)

    def test_annual_upsample(self):
        ts = _simple_pts('1/1/1990', '12/31/1995', freq='A-DEC')
        df = DataFrame({'a': ts})
        rdf = df.resample('D').ffill()
        exp = df['a'].resample('D').ffill()
        assert_series_equal(rdf['a'], exp)

        rng = period_range('2000', '2003', freq='A-DEC')
        ts = Series([1, 2, 3, 4], index=rng)

        result = ts.resample('M').ffill()
        ex_index = period_range('2000-01', '2003-12', freq='M')

        expected = ts.asfreq('M', how='start').reindex(ex_index,
                                                       method='ffill')
        assert_series_equal(result, expected)

    def test_quarterly_upsample(self):
        targets = ['D', 'B', 'M']

        for month in MONTHS:
            ts = _simple_pts('1/1/1990', '12/31/1995', freq='Q-%s' % month)

            for targ, conv in product(targets, ['start', 'end']):
                result = ts.resample(targ, convention=conv).ffill()
                expected = result.to_timestamp(targ, how=conv)
                expected = expected.asfreq(targ, 'ffill').to_period()
                assert_series_equal(result, expected)

    def test_monthly_upsample(self):
        targets = ['D', 'B']

        ts = _simple_pts('1/1/1990', '12/31/1995', freq='M')

        for targ, conv in product(targets, ['start', 'end']):
            result = ts.resample(targ, convention=conv).ffill()
            expected = result.to_timestamp(targ, how=conv)
            expected = expected.asfreq(targ, 'ffill').to_period()
            assert_series_equal(result, expected)

    def test_resample_basic(self):
        # GH3609
        s = Series(range(100), index=date_range(
            '20130101', freq='s', periods=100, name='idx'), dtype='float')
        s[10:30] = np.nan
        index = PeriodIndex([
            Period('2013-01-01 00:00', 'T'),
            Period('2013-01-01 00:01', 'T')], name='idx')
        expected = Series([34.5, 79.5], index=index)
        result = s.to_period().resample('T', kind='period').mean()
        assert_series_equal(result, expected)
        result2 = s.resample('T', kind='period').mean()
        assert_series_equal(result2, expected)

    def test_resample_count(self):

        # GH12774
        series = pd.Series(1, index=pd.period_range(start='2000',
                                                    periods=100))
        result = series.resample('M').count()

        expected_index = pd.period_range(start='2000', freq='M', periods=4)
        expected = pd.Series([31, 29, 31, 9], index=expected_index)

        assert_series_equal(result, expected)

    def test_resample_same_freq(self):

        # GH12770
        series = pd.Series(range(3), index=pd.period_range(
            start='2000', periods=3, freq='M'))
        expected = series

        for method in resample_methods:
            result = getattr(series.resample('M'), method)()
            assert_series_equal(result, expected)

    def test_resample_incompat_freq(self):

        with pytest.raises(IncompatibleFrequency):
            pd.Series(range(3), index=pd.period_range(
                start='2000', periods=3, freq='M')).resample('W').mean()

    def test_with_local_timezone_pytz(self):
        # GH5430
        tm._skip_if_no_pytz()
        import pytz

        local_timezone = pytz.timezone('America/Los_Angeles')

        start = datetime(year=2013, month=11, day=1, hour=0, minute=0,
                         tzinfo=pytz.utc)
        # 1 day later
        end = datetime(year=2013, month=11, day=2, hour=0, minute=0,
                       tzinfo=pytz.utc)

        index = pd.date_range(start, end, freq='H')

        series = pd.Series(1, index=index)
        series = series.tz_convert(local_timezone)
        result = series.resample('D', kind='period').mean()

        # Create the expected series
        # Index is moved back a day with the timezone conversion from UTC to
        # Pacific
        expected_index = (pd.period_range(start=start, end=end, freq='D') - 1)
        expected = pd.Series(1, index=expected_index)
        assert_series_equal(result, expected)

    def test_with_local_timezone_dateutil(self):
        # GH5430
        tm._skip_if_no_dateutil()
        import dateutil

        local_timezone = 'dateutil/America/Los_Angeles'

        start = datetime(year=2013, month=11, day=1, hour=0, minute=0,
                         tzinfo=dateutil.tz.tzutc())
        # 1 day later
        end = datetime(year=2013, month=11, day=2, hour=0, minute=0,
                       tzinfo=dateutil.tz.tzutc())

        index = pd.date_range(start, end, freq='H', name='idx')

        series = pd.Series(1, index=index)
        series = series.tz_convert(local_timezone)
        result = series.resample('D', kind='period').mean()

        # Create the expected series
        # Index is moved back a day with the timezone conversion from UTC to
        # Pacific
        expected_index = (pd.period_range(start=start, end=end, freq='D',
                                          name='idx') - 1)
        expected = pd.Series(1, index=expected_index)
        assert_series_equal(result, expected)

    def test_fill_method_and_how_upsample(self):
        # GH2073
        s = Series(np.arange(9, dtype='int64'),
                   index=date_range('2010-01-01', periods=9, freq='Q'))
        last = s.resample('M').ffill()
        both = s.resample('M').ffill().resample('M').last().astype('int64')
        assert_series_equal(last, both)

    def test_weekly_upsample(self):
        targets = ['D', 'B']

        for day in DAYS:
            ts = _simple_pts('1/1/1990', '12/31/1995', freq='W-%s' % day)

            for targ, conv in product(targets, ['start', 'end']):
                result = ts.resample(targ, convention=conv).ffill()
                expected = result.to_timestamp(targ, how=conv)
                expected = expected.asfreq(targ, 'ffill').to_period()
                assert_series_equal(result, expected)

    def test_resample_to_timestamps(self):
        ts = _simple_pts('1/1/1990', '12/31/1995', freq='M')

        result = ts.resample('A-DEC', kind='timestamp').mean()
        expected = ts.to_timestamp(how='end').resample('A-DEC').mean()
        assert_series_equal(result, expected)

    def test_resample_to_quarterly(self):
        for month in MONTHS:
            ts = _simple_pts('1990', '1992', freq='A-%s' % month)
            quar_ts = ts.resample('Q-%s' % month).ffill()

            stamps = ts.to_timestamp('D', how='start')
            qdates = period_range(ts.index[0].asfreq('D', 'start'),
                                  ts.index[-1].asfreq('D', 'end'),
                                  freq='Q-%s' % month)

            expected = stamps.reindex(qdates.to_timestamp('D', 's'),
                                      method='ffill')
            expected.index = qdates

            assert_series_equal(quar_ts, expected)

        # conforms, but different month
        ts = _simple_pts('1990', '1992', freq='A-JUN')

        for how in ['start', 'end']:
            result = ts.resample('Q-MAR', convention=how).ffill()
            expected = ts.asfreq('Q-MAR', how=how)
            expected = expected.reindex(result.index, method='ffill')

            # .to_timestamp('D')
            # expected = expected.resample('Q-MAR').ffill()

            assert_series_equal(result, expected)

    def test_resample_fill_missing(self):
        rng = PeriodIndex([2000, 2005, 2007, 2009], freq='A')

        s = Series(np.random.randn(4), index=rng)

        stamps = s.to_timestamp()
        filled = s.resample('A').ffill()
        expected = stamps.resample('A').ffill().to_period('A')
        assert_series_equal(filled, expected)

    def test_cant_fill_missing_dups(self):
        rng = PeriodIndex([2000, 2005, 2005, 2007, 2007], freq='A')
        s = Series(np.random.randn(5), index=rng)
        pytest.raises(Exception, lambda: s.resample('A').ffill())

    def test_resample_5minute(self):
        rng = period_range('1/1/2000', '1/5/2000', freq='T')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.resample('5min').mean()
        expected = ts.to_timestamp().resample('5min').mean()
        assert_series_equal(result, expected)

    def test_upsample_daily_business_daily(self):
        ts = _simple_pts('1/1/2000', '2/1/2000', freq='B')

        result = ts.resample('D').asfreq()
        expected = ts.asfreq('D').reindex(period_range('1/3/2000', '2/1/2000'))
        assert_series_equal(result, expected)

        ts = _simple_pts('1/1/2000', '2/1/2000')
        result = ts.resample('H', convention='s').asfreq()
        exp_rng = period_range('1/1/2000', '2/1/2000 23:00', freq='H')
        expected = ts.asfreq('H', how='s').reindex(exp_rng)
        assert_series_equal(result, expected)

    def test_resample_irregular_sparse(self):
        dr = date_range(start='1/1/2012', freq='5min', periods=1000)
        s = Series(np.array(100), index=dr)
        # subset the data.
        subset = s[:'2012-01-04 06:55']

        result = subset.resample('10min').apply(len)
        expected = s.resample('10min').apply(len).loc[result.index]
        assert_series_equal(result, expected)

    def test_resample_weekly_all_na(self):
        rng = date_range('1/1/2000', periods=10, freq='W-WED')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.resample('W-THU').asfreq()

        assert result.isnull().all()

        result = ts.resample('W-THU').asfreq().ffill()[:-1]
        expected = ts.asfreq('W-THU').ffill()
        assert_series_equal(result, expected)

    def test_resample_tz_localized(self):
        dr = date_range(start='2012-4-13', end='2012-5-1')
        ts = Series(lrange(len(dr)), dr)

        ts_utc = ts.tz_localize('UTC')
        ts_local = ts_utc.tz_convert('America/Los_Angeles')

        result = ts_local.resample('W').mean()

        ts_local_naive = ts_local.copy()
        ts_local_naive.index = [x.replace(tzinfo=None)
                                for x in ts_local_naive.index.to_pydatetime()]

        exp = ts_local_naive.resample(
            'W').mean().tz_localize('America/Los_Angeles')

        assert_series_equal(result, exp)

        # it works
        result = ts_local.resample('D').mean()

        # #2245
        idx = date_range('2001-09-20 15:59', '2001-09-20 16:00', freq='T',
                         tz='Australia/Sydney')
        s = Series([1, 2], index=idx)

        result = s.resample('D', closed='right', label='right').mean()
        ex_index = date_range('2001-09-21', periods=1, freq='D',
                              tz='Australia/Sydney')
        expected = Series([1.5], index=ex_index)

        assert_series_equal(result, expected)

        # for good measure
        result = s.resample('D', kind='period').mean()
        ex_index = period_range('2001-09-20', periods=1, freq='D')
        expected = Series([1.5], index=ex_index)
        assert_series_equal(result, expected)

        # GH 6397
        # comparing an offset that doesn't propagate tz's
        rng = date_range('1/1/2011', periods=20000, freq='H')
        rng = rng.tz_localize('EST')
        ts = DataFrame(index=rng)
        ts['first'] = np.random.randn(len(rng))
        ts['second'] = np.cumsum(np.random.randn(len(rng)))
        expected = DataFrame(
            {
                'first': ts.resample('A').sum()['first'],
                'second': ts.resample('A').mean()['second']},
            columns=['first', 'second'])
        result = ts.resample(
            'A').agg({'first': np.sum,
                      'second': np.mean}).reindex(columns=['first', 'second'])
        assert_frame_equal(result, expected)

    def test_closed_left_corner(self):
        # #1465
        s = Series(np.random.randn(21),
                   index=date_range(start='1/1/2012 9:30',
                                    freq='1min', periods=21))
        s[0] = np.nan

        result = s.resample('10min', closed='left', label='right').mean()
        exp = s[1:].resample('10min', closed='left', label='right').mean()
        assert_series_equal(result, exp)

        result = s.resample('10min', closed='left', label='left').mean()
        exp = s[1:].resample('10min', closed='left', label='left').mean()

        ex_index = date_range(start='1/1/2012 9:30', freq='10min', periods=3)

        tm.assert_index_equal(result.index, ex_index)
        assert_series_equal(result, exp)

    def test_quarterly_resampling(self):
        rng = period_range('2000Q1', periods=10, freq='Q-DEC')
        ts = Series(np.arange(10), index=rng)

        result = ts.resample('A').mean()
        exp = ts.to_timestamp().resample('A').mean().to_period()
        assert_series_equal(result, exp)

    def test_resample_weekly_bug_1726(self):
        # 8/6/12 is a Monday
        ind = DatetimeIndex(start="8/6/2012", end="8/26/2012", freq="D")
        n = len(ind)
        data = [[x] * 5 for x in range(n)]
        df = DataFrame(data, columns=['open', 'high', 'low', 'close', 'vol'],
                       index=ind)

        # it works!
        df.resample('W-MON', closed='left', label='left').first()

    def test_resample_bms_2752(self):
        # GH2753
        foo = pd.Series(index=pd.bdate_range('20000101', '20000201'))
        res1 = foo.resample("BMS").mean()
        res2 = foo.resample("BMS").mean().resample("B").mean()
        assert res1.index[0] == Timestamp('20000103')
        assert res1.index[0] == res2.index[0]

    # def test_monthly_convention_span(self):
    #     rng = period_range('2000-01', periods=3, freq='M')
    #     ts = Series(np.arange(3), index=rng)

    #     # hacky way to get same thing
    #     exp_index = period_range('2000-01-01', '2000-03-31', freq='D')
    #     expected = ts.asfreq('D', how='end').reindex(exp_index)
    #     expected = expected.fillna(method='bfill')

    #     result = ts.resample('D', convention='span').mean()

    #     assert_series_equal(result, expected)

    def test_default_right_closed_label(self):
        end_freq = ['D', 'Q', 'M', 'D']
        end_types = ['M', 'A', 'Q', 'W']

        for from_freq, to_freq in zip(end_freq, end_types):
            idx = DatetimeIndex(start='8/15/2012', periods=100, freq=from_freq)
            df = DataFrame(np.random.randn(len(idx), 2), idx)

            resampled = df.resample(to_freq).mean()
            assert_frame_equal(resampled, df.resample(to_freq, closed='right',
                                                      label='right').mean())

    def test_default_left_closed_label(self):
        others = ['MS', 'AS', 'QS', 'D', 'H']
        others_freq = ['D', 'Q', 'M', 'H', 'T']

        for from_freq, to_freq in zip(others_freq, others):
            idx = DatetimeIndex(start='8/15/2012', periods=100, freq=from_freq)
            df = DataFrame(np.random.randn(len(idx), 2), idx)

            resampled = df.resample(to_freq).mean()
            assert_frame_equal(resampled, df.resample(to_freq, closed='left',
                                                      label='left').mean())

    def test_all_values_single_bin(self):
        # 2070
        index = period_range(start="2012-01-01", end="2012-12-31", freq="M")
        s = Series(np.random.randn(len(index)), index=index)

        result = s.resample("A").mean()
        tm.assert_almost_equal(result[0], s.mean())

    def test_evenly_divisible_with_no_extra_bins(self):
        # 4076
        # when the frequency is evenly divisible, sometimes extra bins

        df = DataFrame(np.random.randn(9, 3),
                       index=date_range('2000-1-1', periods=9))
        result = df.resample('5D').mean()
        expected = pd.concat(
            [df.iloc[0:5].mean(), df.iloc[5:].mean()], axis=1).T
        expected.index = [Timestamp('2000-1-1'), Timestamp('2000-1-6')]
        assert_frame_equal(result, expected)

        index = date_range(start='2001-5-4', periods=28)
        df = DataFrame(
            [{'REST_KEY': 1, 'DLY_TRN_QT': 80, 'DLY_SLS_AMT': 90,
              'COOP_DLY_TRN_QT': 30, 'COOP_DLY_SLS_AMT': 20}] * 28 +
            [{'REST_KEY': 2, 'DLY_TRN_QT': 70, 'DLY_SLS_AMT': 10,
              'COOP_DLY_TRN_QT': 50, 'COOP_DLY_SLS_AMT': 20}] * 28,
            index=index.append(index)).sort_index()

        index = date_range('2001-5-4', periods=4, freq='7D')
        expected = DataFrame(
            [{'REST_KEY': 14, 'DLY_TRN_QT': 14, 'DLY_SLS_AMT': 14,
              'COOP_DLY_TRN_QT': 14, 'COOP_DLY_SLS_AMT': 14}] * 4,
            index=index)
        result = df.resample('7D').count()
        assert_frame_equal(result, expected)

        expected = DataFrame(
            [{'REST_KEY': 21, 'DLY_TRN_QT': 1050, 'DLY_SLS_AMT': 700,
              'COOP_DLY_TRN_QT': 560, 'COOP_DLY_SLS_AMT': 280}] * 4,
            index=index)
        result = df.resample('7D').sum()
        assert_frame_equal(result, expected)


class TestTimedeltaIndex(Base):
    _index_factory = lambda x: timedelta_range

    def create_series(self):
        i = timedelta_range('1 day',
                            '10 day', freq='D')

        return Series(np.arange(len(i)), index=i, name='tdi')

    def test_asfreq_bug(self):
        import datetime as dt
        df = DataFrame(data=[1, 3],
                       index=[dt.timedelta(), dt.timedelta(minutes=3)])
        result = df.resample('1T').asfreq()
        expected = DataFrame(data=[1, np.nan, np.nan, 3],
                             index=timedelta_range('0 day',
                                                   periods=4,
                                                   freq='1T'))
        assert_frame_equal(result, expected)


class TestResamplerGrouper(object):

    def setup_method(self, method):
        self.frame = DataFrame({'A': [1] * 20 + [2] * 12 + [3] * 8,
                                'B': np.arange(40)},
                               index=date_range('1/1/2000',
                                                freq='s',
                                                periods=40))

    def test_back_compat_v180(self):

        df = self.frame
        for how in ['sum', 'mean', 'prod', 'min', 'max', 'var', 'std']:
            with tm.assert_produces_warning(FutureWarning,
                                            check_stacklevel=False):
                result = df.groupby('A').resample('4s', how=how)
                expected = getattr(df.groupby('A').resample('4s'), how)()
                assert_frame_equal(result, expected)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = df.groupby('A').resample('4s', how='mean',
                                              fill_method='ffill')
            expected = df.groupby('A').resample('4s').mean().ffill()
            assert_frame_equal(result, expected)

    def test_tab_complete_ipython6_warning(self, ip):
        from IPython.core.completer import provisionalcompleter
        code = dedent("""\
        import pandas.util.testing as tm
        s = tm.makeTimeSeries()
        rs = s.resample("D")
        """)
        ip.run_code(code)

        with tm.assert_produces_warning(None):
            with provisionalcompleter('ignore'):
                list(ip.Completer.completions('rs.', 1))

    def test_deferred_with_groupby(self):

        # GH 12486
        # support deferred resample ops with groupby
        data = [['2010-01-01', 'A', 2], ['2010-01-02', 'A', 3],
                ['2010-01-05', 'A', 8], ['2010-01-10', 'A', 7],
                ['2010-01-13', 'A', 3], ['2010-01-01', 'B', 5],
                ['2010-01-03', 'B', 2], ['2010-01-04', 'B', 1],
                ['2010-01-11', 'B', 7], ['2010-01-14', 'B', 3]]

        df = DataFrame(data, columns=['date', 'id', 'score'])
        df.date = pd.to_datetime(df.date)
        f = lambda x: x.set_index('date').resample('D').asfreq()
        expected = df.groupby('id').apply(f)
        result = df.set_index('date').groupby('id').resample('D').asfreq()
        assert_frame_equal(result, expected)

        df = DataFrame({'date': pd.date_range(start='2016-01-01',
                                              periods=4,
                                              freq='W'),
                        'group': [1, 1, 2, 2],
                        'val': [5, 6, 7, 8]}).set_index('date')

        f = lambda x: x.resample('1D').ffill()
        expected = df.groupby('group').apply(f)
        result = df.groupby('group').resample('1D').ffill()
        assert_frame_equal(result, expected)

    def test_getitem(self):
        g = self.frame.groupby('A')

        expected = g.B.apply(lambda x: x.resample('2s').mean())

        result = g.resample('2s').B.mean()
        assert_series_equal(result, expected)

        result = g.B.resample('2s').mean()
        assert_series_equal(result, expected)

        result = g.resample('2s').mean().B
        assert_series_equal(result, expected)

    def test_getitem_multiple(self):

        # GH 13174
        # multiple calls after selection causing an issue with aliasing
        data = [{'id': 1, 'buyer': 'A'}, {'id': 2, 'buyer': 'B'}]
        df = pd.DataFrame(data, index=pd.date_range('2016-01-01', periods=2))
        r = df.groupby('id').resample('1D')
        result = r['buyer'].count()
        expected = pd.Series([1, 1],
                             index=pd.MultiIndex.from_tuples(
                                 [(1, pd.Timestamp('2016-01-01')),
                                  (2, pd.Timestamp('2016-01-02'))],
                                 names=['id', None]),
                             name='buyer')
        assert_series_equal(result, expected)

        result = r['buyer'].count()
        assert_series_equal(result, expected)

    def test_methods(self):
        g = self.frame.groupby('A')
        r = g.resample('2s')

        for f in ['first', 'last', 'median', 'sem', 'sum', 'mean',
                  'min', 'max']:
            result = getattr(r, f)()
            expected = g.apply(lambda x: getattr(x.resample('2s'), f)())
            assert_frame_equal(result, expected)

        for f in ['size']:
            result = getattr(r, f)()
            expected = g.apply(lambda x: getattr(x.resample('2s'), f)())
            assert_series_equal(result, expected)

        for f in ['count']:
            result = getattr(r, f)()
            expected = g.apply(lambda x: getattr(x.resample('2s'), f)())
            assert_frame_equal(result, expected)

        # series only
        for f in ['nunique']:
            result = getattr(r.B, f)()
            expected = g.B.apply(lambda x: getattr(x.resample('2s'), f)())
            assert_series_equal(result, expected)

        for f in ['backfill', 'ffill', 'asfreq']:
            result = getattr(r, f)()
            expected = g.apply(lambda x: getattr(x.resample('2s'), f)())
            assert_frame_equal(result, expected)

        result = r.ohlc()
        expected = g.apply(lambda x: x.resample('2s').ohlc())
        assert_frame_equal(result, expected)

        for f in ['std', 'var']:
            result = getattr(r, f)(ddof=1)
            expected = g.apply(lambda x: getattr(x.resample('2s'), f)(ddof=1))
            assert_frame_equal(result, expected)

    def test_apply(self):

        g = self.frame.groupby('A')
        r = g.resample('2s')

        # reduction
        expected = g.resample('2s').sum()

        def f(x):
            return x.resample('2s').sum()

        result = r.apply(f)
        assert_frame_equal(result, expected)

        def f(x):
            return x.resample('2s').apply(lambda y: y.sum())

        result = g.apply(f)
        assert_frame_equal(result, expected)

    def test_resample_groupby_with_label(self):
        # GH 13235
        index = date_range('2000-01-01', freq='2D', periods=5)
        df = DataFrame(index=index,
                       data={'col0': [0, 0, 1, 1, 2], 'col1': [1, 1, 1, 1, 1]}
                       )
        result = df.groupby('col0').resample('1W', label='left').sum()

        mi = [np.array([0, 0, 1, 2]),
              pd.to_datetime(np.array(['1999-12-26', '2000-01-02',
                                       '2000-01-02', '2000-01-02'])
                             )
              ]
        mindex = pd.MultiIndex.from_arrays(mi, names=['col0', None])
        expected = DataFrame(data={'col0': [0, 0, 2, 2], 'col1': [1, 1, 2, 1]},
                             index=mindex
                             )

        assert_frame_equal(result, expected)

    def test_consistency_with_window(self):

        # consistent return values with window
        df = self.frame
        expected = pd.Int64Index([1, 2, 3], name='A')
        result = df.groupby('A').resample('2s').mean()
        assert result.index.nlevels == 2
        tm.assert_index_equal(result.index.levels[0], expected)

        result = df.groupby('A').rolling(20).mean()
        assert result.index.nlevels == 2
        tm.assert_index_equal(result.index.levels[0], expected)

    def test_median_duplicate_columns(self):
        # GH 14233

        df = pd.DataFrame(np.random.randn(20, 3),
                          columns=list('aaa'),
                          index=pd.date_range('2012-01-01',
                                              periods=20, freq='s'))
        df2 = df.copy()
        df2.columns = ['a', 'b', 'c']
        expected = df2.resample('5s').median()
        result = df.resample('5s').median()
        expected.columns = result.columns
        assert_frame_equal(result, expected)


class TestTimeGrouper(object):

    def setup_method(self, method):
        self.ts = Series(np.random.randn(1000),
                         index=date_range('1/1/2000', periods=1000))

    def test_apply(self):
        grouper = TimeGrouper('A', label='right', closed='right')

        grouped = self.ts.groupby(grouper)

        f = lambda x: x.sort_values()[-3:]

        applied = grouped.apply(f)
        expected = self.ts.groupby(lambda x: x.year).apply(f)

        applied.index = applied.index.droplevel(0)
        expected.index = expected.index.droplevel(0)
        assert_series_equal(applied, expected)

    def test_count(self):
        self.ts[::3] = np.nan

        expected = self.ts.groupby(lambda x: x.year).count()

        grouper = TimeGrouper('A', label='right', closed='right')
        result = self.ts.groupby(grouper).count()
        expected.index = result.index
        assert_series_equal(result, expected)

        result = self.ts.resample('A').count()
        expected.index = result.index
        assert_series_equal(result, expected)

    def test_numpy_reduction(self):
        result = self.ts.resample('A', closed='right').prod()

        expected = self.ts.groupby(lambda x: x.year).agg(np.prod)
        expected.index = result.index

        assert_series_equal(result, expected)

    def test_apply_iteration(self):
        # #2300
        N = 1000
        ind = pd.date_range(start="2000-01-01", freq="D", periods=N)
        df = DataFrame({'open': 1, 'close': 2}, index=ind)
        tg = TimeGrouper('M')

        _, grouper, _ = tg._get_grouper(df)

        # Errors
        grouped = df.groupby(grouper, group_keys=False)
        f = lambda df: df['close'] / df['open']

        # it works!
        result = grouped.apply(f)
        tm.assert_index_equal(result.index, df.index)

    def test_panel_aggregation(self):
        ind = pd.date_range('1/1/2000', periods=100)
        data = np.random.randn(2, len(ind), 4)

        with catch_warnings(record=True):
            wp = Panel(data, items=['Item1', 'Item2'], major_axis=ind,
                       minor_axis=['A', 'B', 'C', 'D'])

            tg = TimeGrouper('M', axis=1)
            _, grouper, _ = tg._get_grouper(wp)
            bingrouped = wp.groupby(grouper)
            binagg = bingrouped.mean()

            def f(x):
                assert (isinstance(x, Panel))
                return x.mean(1)

            result = bingrouped.agg(f)
            tm.assert_panel_equal(result, binagg)

    def test_fails_on_no_datetime_index(self):
        index_names = ('Int64Index', 'Index', 'Float64Index', 'MultiIndex')
        index_funcs = (tm.makeIntIndex,
                       tm.makeUnicodeIndex, tm.makeFloatIndex,
                       lambda m: tm.makeCustomIndex(m, 2))
        n = 2
        for name, func in zip(index_names, index_funcs):
            index = func(n)
            df = DataFrame({'a': np.random.randn(n)}, index=index)
            with tm.assert_raises_regex(TypeError,
                                        "Only valid with "
                                        "DatetimeIndex, TimedeltaIndex "
                                        "or PeriodIndex, but got an "
                                        "instance of %r" % name):
                df.groupby(TimeGrouper('D'))

        # PeriodIndex gives a specific error message
        df = DataFrame({'a': np.random.randn(n)}, index=tm.makePeriodIndex(n))
        with tm.assert_raises_regex(TypeError,
                                    "axis must be a DatetimeIndex, but "
                                    "got an instance of 'PeriodIndex'"):
            df.groupby(TimeGrouper('D'))

    def test_aaa_group_order(self):
        # GH 12840
        # check TimeGrouper perform stable sorts
        n = 20
        data = np.random.randn(n, 4)
        df = DataFrame(data, columns=['A', 'B', 'C', 'D'])
        df['key'] = [datetime(2013, 1, 1), datetime(2013, 1, 2),
                     datetime(2013, 1, 3), datetime(2013, 1, 4),
                     datetime(2013, 1, 5)] * 4
        grouped = df.groupby(TimeGrouper(key='key', freq='D'))

        tm.assert_frame_equal(grouped.get_group(datetime(2013, 1, 1)),
                              df[::5])
        tm.assert_frame_equal(grouped.get_group(datetime(2013, 1, 2)),
                              df[1::5])
        tm.assert_frame_equal(grouped.get_group(datetime(2013, 1, 3)),
                              df[2::5])
        tm.assert_frame_equal(grouped.get_group(datetime(2013, 1, 4)),
                              df[3::5])
        tm.assert_frame_equal(grouped.get_group(datetime(2013, 1, 5)),
                              df[4::5])

    def test_aggregate_normal(self):
        # check TimeGrouper's aggregation is identical as normal groupby

        n = 20
        data = np.random.randn(n, 4)
        normal_df = DataFrame(data, columns=['A', 'B', 'C', 'D'])
        normal_df['key'] = [1, 2, 3, 4, 5] * 4

        dt_df = DataFrame(data, columns=['A', 'B', 'C', 'D'])
        dt_df['key'] = [datetime(2013, 1, 1), datetime(2013, 1, 2),
                        datetime(2013, 1, 3), datetime(2013, 1, 4),
                        datetime(2013, 1, 5)] * 4

        normal_grouped = normal_df.groupby('key')
        dt_grouped = dt_df.groupby(TimeGrouper(key='key', freq='D'))

        for func in ['min', 'max', 'prod', 'var', 'std', 'mean']:
            expected = getattr(normal_grouped, func)()
            dt_result = getattr(dt_grouped, func)()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            assert_frame_equal(expected, dt_result)

        for func in ['count', 'sum']:
            expected = getattr(normal_grouped, func)()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            dt_result = getattr(dt_grouped, func)()
            assert_frame_equal(expected, dt_result)

        # GH 7453
        for func in ['size']:
            expected = getattr(normal_grouped, func)()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            dt_result = getattr(dt_grouped, func)()
            assert_series_equal(expected, dt_result)

        # GH 7453
        for func in ['first', 'last']:
            expected = getattr(normal_grouped, func)()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            dt_result = getattr(dt_grouped, func)()
            assert_frame_equal(expected, dt_result)

        # if TimeGrouper is used included, 'nth' doesn't work yet

        """
        for func in ['nth']:
            expected = getattr(normal_grouped, func)(3)
            expected.index = date_range(start='2013-01-01',
                                        freq='D', periods=5, name='key')
            dt_result = getattr(dt_grouped, func)(3)
            assert_frame_equal(expected, dt_result)
        """

    def test_aggregate_with_nat(self):
        # check TimeGrouper's aggregation is identical as normal groupby

        n = 20
        data = np.random.randn(n, 4).astype('int64')
        normal_df = DataFrame(data, columns=['A', 'B', 'C', 'D'])
        normal_df['key'] = [1, 2, np.nan, 4, 5] * 4

        dt_df = DataFrame(data, columns=['A', 'B', 'C', 'D'])
        dt_df['key'] = [datetime(2013, 1, 1), datetime(2013, 1, 2), pd.NaT,
                        datetime(2013, 1, 4), datetime(2013, 1, 5)] * 4

        normal_grouped = normal_df.groupby('key')
        dt_grouped = dt_df.groupby(TimeGrouper(key='key', freq='D'))

        for func in ['min', 'max', 'sum', 'prod']:
            normal_result = getattr(normal_grouped, func)()
            dt_result = getattr(dt_grouped, func)()
            pad = DataFrame([[np.nan, np.nan, np.nan, np.nan]], index=[3],
                            columns=['A', 'B', 'C', 'D'])
            expected = normal_result.append(pad)
            expected = expected.sort_index()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            assert_frame_equal(expected, dt_result)

        for func in ['count']:
            normal_result = getattr(normal_grouped, func)()
            pad = DataFrame([[0, 0, 0, 0]], index=[3],
                            columns=['A', 'B', 'C', 'D'])
            expected = normal_result.append(pad)
            expected = expected.sort_index()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            dt_result = getattr(dt_grouped, func)()
            assert_frame_equal(expected, dt_result)

        for func in ['size']:
            normal_result = getattr(normal_grouped, func)()
            pad = Series([0], index=[3])
            expected = normal_result.append(pad)
            expected = expected.sort_index()
            expected.index = date_range(start='2013-01-01', freq='D',
                                        periods=5, name='key')
            dt_result = getattr(dt_grouped, func)()
            assert_series_equal(expected, dt_result)
            # GH 9925
            assert dt_result.index.name == 'key'

            # if NaT is included, 'var', 'std', 'mean', 'first','last'
            # and 'nth' doesn't work yet
