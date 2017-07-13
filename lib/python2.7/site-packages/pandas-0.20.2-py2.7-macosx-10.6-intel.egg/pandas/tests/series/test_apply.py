# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytest

from collections import Counter, defaultdict, OrderedDict

import numpy as np
import pandas as pd

from pandas import (Index, Series, DataFrame, isnull)
from pandas.compat import lrange
from pandas import compat
from pandas.util.testing import assert_series_equal, assert_frame_equal
import pandas.util.testing as tm

from .common import TestData


class TestSeriesApply(TestData):

    def test_apply(self):
        with np.errstate(all='ignore'):
            tm.assert_series_equal(self.ts.apply(np.sqrt), np.sqrt(self.ts))

            # element-wise apply
            import math
            tm.assert_series_equal(self.ts.apply(math.exp), np.exp(self.ts))

        # empty series
        s = Series(dtype=object, name='foo', index=pd.Index([], name='bar'))
        rs = s.apply(lambda x: x)
        tm.assert_series_equal(s, rs)

        # check all metadata (GH 9322)
        assert s is not rs
        assert s.index is rs.index
        assert s.dtype == rs.dtype
        assert s.name == rs.name

        # index but no data
        s = Series(index=[1, 2, 3])
        rs = s.apply(lambda x: x)
        tm.assert_series_equal(s, rs)

    def test_apply_same_length_inference_bug(self):
        s = Series([1, 2])
        f = lambda x: (x, x + 1)

        result = s.apply(f)
        expected = s.map(f)
        assert_series_equal(result, expected)

        s = Series([1, 2, 3])
        result = s.apply(f)
        expected = s.map(f)
        assert_series_equal(result, expected)

    def test_apply_dont_convert_dtype(self):
        s = Series(np.random.randn(10))

        f = lambda x: x if x > 0 else np.nan
        result = s.apply(f, convert_dtype=False)
        assert result.dtype == object

    def test_with_string_args(self):

        for arg in ['sum', 'mean', 'min', 'max', 'std']:
            result = self.ts.apply(arg)
            expected = getattr(self.ts, arg)()
            assert result == expected

    def test_apply_args(self):
        s = Series(['foo,bar'])

        result = s.apply(str.split, args=(',', ))
        assert result[0] == ['foo', 'bar']
        assert isinstance(result[0], list)

    def test_apply_box(self):
        # ufunc will not be boxed. Same test cases as the test_map_box
        vals = [pd.Timestamp('2011-01-01'), pd.Timestamp('2011-01-02')]
        s = pd.Series(vals)
        assert s.dtype == 'datetime64[ns]'
        # boxed value must be Timestamp instance
        res = s.apply(lambda x: '{0}_{1}_{2}'.format(x.__class__.__name__,
                                                     x.day, x.tz))
        exp = pd.Series(['Timestamp_1_None', 'Timestamp_2_None'])
        tm.assert_series_equal(res, exp)

        vals = [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                pd.Timestamp('2011-01-02', tz='US/Eastern')]
        s = pd.Series(vals)
        assert s.dtype == 'datetime64[ns, US/Eastern]'
        res = s.apply(lambda x: '{0}_{1}_{2}'.format(x.__class__.__name__,
                                                     x.day, x.tz))
        exp = pd.Series(['Timestamp_1_US/Eastern', 'Timestamp_2_US/Eastern'])
        tm.assert_series_equal(res, exp)

        # timedelta
        vals = [pd.Timedelta('1 days'), pd.Timedelta('2 days')]
        s = pd.Series(vals)
        assert s.dtype == 'timedelta64[ns]'
        res = s.apply(lambda x: '{0}_{1}'.format(x.__class__.__name__, x.days))
        exp = pd.Series(['Timedelta_1', 'Timedelta_2'])
        tm.assert_series_equal(res, exp)

        # period (object dtype, not boxed)
        vals = [pd.Period('2011-01-01', freq='M'),
                pd.Period('2011-01-02', freq='M')]
        s = pd.Series(vals)
        assert s.dtype == 'object'
        res = s.apply(lambda x: '{0}_{1}'.format(x.__class__.__name__,
                                                 x.freqstr))
        exp = pd.Series(['Period_M', 'Period_M'])
        tm.assert_series_equal(res, exp)

    def test_apply_datetimetz(self):
        values = pd.date_range('2011-01-01', '2011-01-02',
                               freq='H').tz_localize('Asia/Tokyo')
        s = pd.Series(values, name='XX')

        result = s.apply(lambda x: x + pd.offsets.Day())
        exp_values = pd.date_range('2011-01-02', '2011-01-03',
                                   freq='H').tz_localize('Asia/Tokyo')
        exp = pd.Series(exp_values, name='XX')
        tm.assert_series_equal(result, exp)

        # change dtype
        # GH 14506 : Returned dtype changed from int32 to int64
        result = s.apply(lambda x: x.hour)
        exp = pd.Series(list(range(24)) + [0], name='XX', dtype=np.int64)
        tm.assert_series_equal(result, exp)

        # not vectorized
        def f(x):
            if not isinstance(x, pd.Timestamp):
                raise ValueError
            return str(x.tz)

        result = s.map(f)
        exp = pd.Series(['Asia/Tokyo'] * 25, name='XX')
        tm.assert_series_equal(result, exp)

    def test_apply_dict_depr(self):

        tsdf = pd.DataFrame(np.random.randn(10, 3),
                            columns=['A', 'B', 'C'],
                            index=pd.date_range('1/1/2000', periods=10))
        with tm.assert_produces_warning(FutureWarning):
            tsdf.A.agg({'foo': ['sum', 'mean']})


class TestSeriesAggregate(TestData):

    _multiprocess_can_split_ = True

    def test_transform(self):
        # transforming functions

        with np.errstate(all='ignore'):

            f_sqrt = np.sqrt(self.series)
            f_abs = np.abs(self.series)

            # ufunc
            result = self.series.transform(np.sqrt)
            expected = f_sqrt.copy()
            assert_series_equal(result, expected)

            result = self.series.apply(np.sqrt)
            assert_series_equal(result, expected)

            # list-like
            result = self.series.transform([np.sqrt])
            expected = f_sqrt.to_frame().copy()
            expected.columns = ['sqrt']
            assert_frame_equal(result, expected)

            result = self.series.transform([np.sqrt])
            assert_frame_equal(result, expected)

            result = self.series.transform(['sqrt'])
            assert_frame_equal(result, expected)

            # multiple items in list
            # these are in the order as if we are applying both functions per
            # series and then concatting
            expected = pd.concat([f_sqrt, f_abs], axis=1)
            expected.columns = ['sqrt', 'absolute']
            result = self.series.apply([np.sqrt, np.abs])
            assert_frame_equal(result, expected)

            result = self.series.transform(['sqrt', 'abs'])
            expected.columns = ['sqrt', 'abs']
            assert_frame_equal(result, expected)

            # dict, provide renaming
            expected = pd.concat([f_sqrt, f_abs], axis=1)
            expected.columns = ['foo', 'bar']
            expected = expected.unstack().rename('series')

            result = self.series.apply({'foo': np.sqrt, 'bar': np.abs})
            assert_series_equal(result.reindex_like(expected), expected)

    def test_transform_and_agg_error(self):
        # we are trying to transform with an aggregator
        def f():
            self.series.transform(['min', 'max'])
        pytest.raises(ValueError, f)

        def f():
            with np.errstate(all='ignore'):
                self.series.agg(['sqrt', 'max'])
        pytest.raises(ValueError, f)

        def f():
            with np.errstate(all='ignore'):
                self.series.transform(['sqrt', 'max'])
        pytest.raises(ValueError, f)

        def f():
            with np.errstate(all='ignore'):
                self.series.agg({'foo': np.sqrt, 'bar': 'sum'})
        pytest.raises(ValueError, f)

    def test_demo(self):
        # demonstration tests
        s = Series(range(6), dtype='int64', name='series')

        result = s.agg(['min', 'max'])
        expected = Series([0, 5], index=['min', 'max'], name='series')
        tm.assert_series_equal(result, expected)

        result = s.agg({'foo': 'min'})
        expected = Series([0], index=['foo'], name='series')
        tm.assert_series_equal(result, expected)

        # nested renaming
        with tm.assert_produces_warning(FutureWarning):
            result = s.agg({'foo': ['min', 'max']})

        expected = DataFrame(
            {'foo': [0, 5]},
            index=['min', 'max']).unstack().rename('series')
        tm.assert_series_equal(result, expected)

    def test_multiple_aggregators_with_dict_api(self):

        s = Series(range(6), dtype='int64', name='series')
        # nested renaming
        with tm.assert_produces_warning(FutureWarning):
            result = s.agg({'foo': ['min', 'max'], 'bar': ['sum', 'mean']})

        expected = DataFrame(
            {'foo': [5.0, np.nan, 0.0, np.nan],
             'bar': [np.nan, 2.5, np.nan, 15.0]},
            columns=['foo', 'bar'],
            index=['max', 'mean',
                   'min', 'sum']).unstack().rename('series')
        tm.assert_series_equal(result.reindex_like(expected), expected)

    def test_agg_apply_evaluate_lambdas_the_same(self):
        # test that we are evaluating row-by-row first
        # before vectorized evaluation
        result = self.series.apply(lambda x: str(x))
        expected = self.series.agg(lambda x: str(x))
        tm.assert_series_equal(result, expected)

        result = self.series.apply(str)
        expected = self.series.agg(str)
        tm.assert_series_equal(result, expected)

    def test_with_nested_series(self):
        # GH 2316
        # .agg with a reducer and a transform, what to do
        result = self.ts.apply(lambda x: Series(
            [x, x ** 2], index=['x', 'x^2']))
        expected = DataFrame({'x': self.ts, 'x^2': self.ts ** 2})
        tm.assert_frame_equal(result, expected)

        result = self.ts.agg(lambda x: Series(
            [x, x ** 2], index=['x', 'x^2']))
        tm.assert_frame_equal(result, expected)

    def test_replicate_describe(self):
        # this also tests a result set that is all scalars
        expected = self.series.describe()
        result = self.series.apply(OrderedDict(
            [('count', 'count'),
             ('mean', 'mean'),
             ('std', 'std'),
             ('min', 'min'),
             ('25%', lambda x: x.quantile(0.25)),
             ('50%', 'median'),
             ('75%', lambda x: x.quantile(0.75)),
             ('max', 'max')]))
        assert_series_equal(result, expected)

    def test_reduce(self):
        # reductions with named functions
        result = self.series.agg(['sum', 'mean'])
        expected = Series([self.series.sum(),
                           self.series.mean()],
                          ['sum', 'mean'],
                          name=self.series.name)
        assert_series_equal(result, expected)

    def test_non_callable_aggregates(self):
        # test agg using non-callable series attributes
        s = Series([1, 2, None])

        # Calling agg w/ just a string arg same as calling s.arg
        result = s.agg('size')
        expected = s.size
        assert result == expected

        # test when mixed w/ callable reducers
        result = s.agg(['size', 'count', 'mean'])
        expected = Series(OrderedDict({'size': 3.0,
                                       'count': 2.0,
                                       'mean': 1.5}))
        assert_series_equal(result[expected.index], expected)


class TestSeriesMap(TestData):

    def test_map(self):
        index, data = tm.getMixedTypeDict()

        source = Series(data['B'], index=data['C'])
        target = Series(data['C'][:4], index=data['D'][:4])

        merged = target.map(source)

        for k, v in compat.iteritems(merged):
            assert v == source[target[k]]

        # input could be a dict
        merged = target.map(source.to_dict())

        for k, v in compat.iteritems(merged):
            assert v == source[target[k]]

        # function
        result = self.ts.map(lambda x: x * 2)
        tm.assert_series_equal(result, self.ts * 2)

        # GH 10324
        a = Series([1, 2, 3, 4])
        b = Series(["even", "odd", "even", "odd"], dtype="category")
        c = Series(["even", "odd", "even", "odd"])

        exp = Series(["odd", "even", "odd", np.nan], dtype="category")
        tm.assert_series_equal(a.map(b), exp)
        exp = Series(["odd", "even", "odd", np.nan])
        tm.assert_series_equal(a.map(c), exp)

        a = Series(['a', 'b', 'c', 'd'])
        b = Series([1, 2, 3, 4],
                   index=pd.CategoricalIndex(['b', 'c', 'd', 'e']))
        c = Series([1, 2, 3, 4], index=Index(['b', 'c', 'd', 'e']))

        exp = Series([np.nan, 1, 2, 3])
        tm.assert_series_equal(a.map(b), exp)
        exp = Series([np.nan, 1, 2, 3])
        tm.assert_series_equal(a.map(c), exp)

        a = Series(['a', 'b', 'c', 'd'])
        b = Series(['B', 'C', 'D', 'E'], dtype='category',
                   index=pd.CategoricalIndex(['b', 'c', 'd', 'e']))
        c = Series(['B', 'C', 'D', 'E'], index=Index(['b', 'c', 'd', 'e']))

        exp = Series(pd.Categorical([np.nan, 'B', 'C', 'D'],
                                    categories=['B', 'C', 'D', 'E']))
        tm.assert_series_equal(a.map(b), exp)
        exp = Series([np.nan, 'B', 'C', 'D'])
        tm.assert_series_equal(a.map(c), exp)

    def test_map_compat(self):
        # related GH 8024
        s = Series([True, True, False], index=[1, 2, 3])
        result = s.map({True: 'foo', False: 'bar'})
        expected = Series(['foo', 'foo', 'bar'], index=[1, 2, 3])
        assert_series_equal(result, expected)

    def test_map_int(self):
        left = Series({'a': 1., 'b': 2., 'c': 3., 'd': 4})
        right = Series({1: 11, 2: 22, 3: 33})

        assert left.dtype == np.float_
        assert issubclass(right.dtype.type, np.integer)

        merged = left.map(right)
        assert merged.dtype == np.float_
        assert isnull(merged['d'])
        assert not isnull(merged['c'])

    def test_map_type_inference(self):
        s = Series(lrange(3))
        s2 = s.map(lambda x: np.where(x == 0, 0, 1))
        assert issubclass(s2.dtype.type, np.integer)

    def test_map_decimal(self):
        from decimal import Decimal

        result = self.series.map(lambda x: Decimal(str(x)))
        assert result.dtype == np.object_
        assert isinstance(result[0], Decimal)

    def test_map_na_exclusion(self):
        s = Series([1.5, np.nan, 3, np.nan, 5])

        result = s.map(lambda x: x * 2, na_action='ignore')
        exp = s * 2
        assert_series_equal(result, exp)

    def test_map_dict_with_tuple_keys(self):
        """
        Due to new MultiIndex-ing behaviour in v0.14.0,
        dicts with tuple keys passed to map were being
        converted to a multi-index, preventing tuple values
        from being mapped properly.
        """
        df = pd.DataFrame({'a': [(1, ), (2, ), (3, 4), (5, 6)]})
        label_mappings = {(1, ): 'A', (2, ): 'B', (3, 4): 'A', (5, 6): 'B'}
        df['labels'] = df['a'].map(label_mappings)
        df['expected_labels'] = pd.Series(['A', 'B', 'A', 'B'], index=df.index)
        # All labels should be filled now
        tm.assert_series_equal(df['labels'], df['expected_labels'],
                               check_names=False)

    def test_map_counter(self):
        s = Series(['a', 'b', 'c'], index=[1, 2, 3])
        counter = Counter()
        counter['b'] = 5
        counter['c'] += 1
        result = s.map(counter)
        expected = Series([0, 5, 1], index=[1, 2, 3])
        assert_series_equal(result, expected)

    def test_map_defaultdict(self):
        s = Series([1, 2, 3], index=['a', 'b', 'c'])
        default_dict = defaultdict(lambda: 'blank')
        default_dict[1] = 'stuff'
        result = s.map(default_dict)
        expected = Series(['stuff', 'blank', 'blank'], index=['a', 'b', 'c'])
        assert_series_equal(result, expected)

    def test_map_dict_subclass_with_missing(self):
        """
        Test Series.map with a dictionary subclass that defines __missing__,
        i.e. sets a default value (GH #15999).
        """
        class DictWithMissing(dict):
            def __missing__(self, key):
                return 'missing'
        s = Series([1, 2, 3])
        dictionary = DictWithMissing({3: 'three'})
        result = s.map(dictionary)
        expected = Series(['missing', 'missing', 'three'])
        assert_series_equal(result, expected)

    def test_map_dict_subclass_without_missing(self):
        class DictWithoutMissing(dict):
            pass
        s = Series([1, 2, 3])
        dictionary = DictWithoutMissing({3: 'three'})
        result = s.map(dictionary)
        expected = Series([np.nan, np.nan, 'three'])
        assert_series_equal(result, expected)

    def test_map_box(self):
        vals = [pd.Timestamp('2011-01-01'), pd.Timestamp('2011-01-02')]
        s = pd.Series(vals)
        assert s.dtype == 'datetime64[ns]'
        # boxed value must be Timestamp instance
        res = s.map(lambda x: '{0}_{1}_{2}'.format(x.__class__.__name__,
                                                   x.day, x.tz))
        exp = pd.Series(['Timestamp_1_None', 'Timestamp_2_None'])
        tm.assert_series_equal(res, exp)

        vals = [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                pd.Timestamp('2011-01-02', tz='US/Eastern')]
        s = pd.Series(vals)
        assert s.dtype == 'datetime64[ns, US/Eastern]'
        res = s.map(lambda x: '{0}_{1}_{2}'.format(x.__class__.__name__,
                                                   x.day, x.tz))
        exp = pd.Series(['Timestamp_1_US/Eastern', 'Timestamp_2_US/Eastern'])
        tm.assert_series_equal(res, exp)

        # timedelta
        vals = [pd.Timedelta('1 days'), pd.Timedelta('2 days')]
        s = pd.Series(vals)
        assert s.dtype == 'timedelta64[ns]'
        res = s.map(lambda x: '{0}_{1}'.format(x.__class__.__name__, x.days))
        exp = pd.Series(['Timedelta_1', 'Timedelta_2'])
        tm.assert_series_equal(res, exp)

        # period (object dtype, not boxed)
        vals = [pd.Period('2011-01-01', freq='M'),
                pd.Period('2011-01-02', freq='M')]
        s = pd.Series(vals)
        assert s.dtype == 'object'
        res = s.map(lambda x: '{0}_{1}'.format(x.__class__.__name__,
                                               x.freqstr))
        exp = pd.Series(['Period_M', 'Period_M'])
        tm.assert_series_equal(res, exp)

    def test_map_categorical(self):
        values = pd.Categorical(list('ABBABCD'), categories=list('DCBA'),
                                ordered=True)
        s = pd.Series(values, name='XX', index=list('abcdefg'))

        result = s.map(lambda x: x.lower())
        exp_values = pd.Categorical(list('abbabcd'), categories=list('dcba'),
                                    ordered=True)
        exp = pd.Series(exp_values, name='XX', index=list('abcdefg'))
        tm.assert_series_equal(result, exp)
        tm.assert_categorical_equal(result.values, exp_values)

        result = s.map(lambda x: 'A')
        exp = pd.Series(['A'] * 7, name='XX', index=list('abcdefg'))
        tm.assert_series_equal(result, exp)
        assert result.dtype == np.object

        with pytest.raises(NotImplementedError):
            s.map(lambda x: x, na_action='ignore')

    def test_map_datetimetz(self):
        values = pd.date_range('2011-01-01', '2011-01-02',
                               freq='H').tz_localize('Asia/Tokyo')
        s = pd.Series(values, name='XX')

        # keep tz
        result = s.map(lambda x: x + pd.offsets.Day())
        exp_values = pd.date_range('2011-01-02', '2011-01-03',
                                   freq='H').tz_localize('Asia/Tokyo')
        exp = pd.Series(exp_values, name='XX')
        tm.assert_series_equal(result, exp)

        # change dtype
        # GH 14506 : Returned dtype changed from int32 to int64
        result = s.map(lambda x: x.hour)
        exp = pd.Series(list(range(24)) + [0], name='XX', dtype=np.int64)
        tm.assert_series_equal(result, exp)

        with pytest.raises(NotImplementedError):
            s.map(lambda x: x, na_action='ignore')

        # not vectorized
        def f(x):
            if not isinstance(x, pd.Timestamp):
                raise ValueError
            return str(x.tz)

        result = s.map(f)
        exp = pd.Series(['Asia/Tokyo'] * 25, name='XX')
        tm.assert_series_equal(result, exp)
