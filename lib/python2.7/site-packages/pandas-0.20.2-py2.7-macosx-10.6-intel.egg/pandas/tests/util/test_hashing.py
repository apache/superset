import pytest
import datetime

from warnings import catch_warnings
import numpy as np
import pandas as pd

from pandas import DataFrame, Series, Index, MultiIndex
from pandas.util import hash_array, hash_pandas_object
from pandas.core.util.hashing import hash_tuples, hash_tuple, _hash_scalar
import pandas.util.testing as tm


class TestHashing(object):

    def setup_method(self, method):
        self.df = DataFrame(
            {'i32': np.array([1, 2, 3] * 3, dtype='int32'),
             'f32': np.array([None, 2.5, 3.5] * 3, dtype='float32'),
             'cat': Series(['a', 'b', 'c'] * 3).astype('category'),
             'obj': Series(['d', 'e', 'f'] * 3),
             'bool': np.array([True, False, True] * 3),
             'dt': Series(pd.date_range('20130101', periods=9)),
             'dt_tz': Series(pd.date_range('20130101', periods=9,
                                           tz='US/Eastern')),
             'td': Series(pd.timedelta_range('2000', periods=9))})

    def test_consistency(self):
        # check that our hash doesn't change because of a mistake
        # in the actual code; this is the ground truth
        result = hash_pandas_object(Index(['foo', 'bar', 'baz']))
        expected = Series(np.array([3600424527151052760, 1374399572096150070,
                                    477881037637427054], dtype='uint64'),
                          index=['foo', 'bar', 'baz'])
        tm.assert_series_equal(result, expected)

    def test_hash_array(self):
        for name, s in self.df.iteritems():
            a = s.values
            tm.assert_numpy_array_equal(hash_array(a), hash_array(a))

    def test_hash_array_mixed(self):
        result1 = hash_array(np.array([3, 4, 'All']))
        result2 = hash_array(np.array(['3', '4', 'All']))
        result3 = hash_array(np.array([3, 4, 'All'], dtype=object))
        tm.assert_numpy_array_equal(result1, result2)
        tm.assert_numpy_array_equal(result1, result3)

    def test_hash_array_errors(self):

        for val in [5, 'foo', pd.Timestamp('20130101')]:
            pytest.raises(TypeError, hash_array, val)

    def check_equal(self, obj, **kwargs):
        a = hash_pandas_object(obj, **kwargs)
        b = hash_pandas_object(obj, **kwargs)
        tm.assert_series_equal(a, b)

        kwargs.pop('index', None)
        a = hash_pandas_object(obj, **kwargs)
        b = hash_pandas_object(obj, **kwargs)
        tm.assert_series_equal(a, b)

    def check_not_equal_with_index(self, obj):

        # check that we are not hashing the same if
        # we include the index
        if not isinstance(obj, Index):
            a = hash_pandas_object(obj, index=True)
            b = hash_pandas_object(obj, index=False)
            if len(obj):
                assert not (a == b).all()

    def test_hash_tuples(self):
        tups = [(1, 'one'), (1, 'two'), (2, 'one')]
        result = hash_tuples(tups)
        expected = hash_pandas_object(MultiIndex.from_tuples(tups)).values
        tm.assert_numpy_array_equal(result, expected)

        result = hash_tuples(tups[0])
        assert result == expected[0]

    def test_hash_tuple(self):
        # test equivalence between hash_tuples and hash_tuple
        for tup in [(1, 'one'), (1, np.nan), (1.0, pd.NaT, 'A'),
                    ('A', pd.Timestamp("2012-01-01"))]:
            result = hash_tuple(tup)
            expected = hash_tuples([tup])[0]
            assert result == expected

    def test_hash_scalar(self):
        for val in [1, 1.4, 'A', b'A', u'A', pd.Timestamp("2012-01-01"),
                    pd.Timestamp("2012-01-01", tz='Europe/Brussels'),
                    datetime.datetime(2012, 1, 1),
                    pd.Timestamp("2012-01-01", tz='EST').to_pydatetime(),
                    pd.Timedelta('1 days'), datetime.timedelta(1),
                    pd.Period('2012-01-01', freq='D'), pd.Interval(0, 1),
                    np.nan, pd.NaT, None]:
            result = _hash_scalar(val)
            expected = hash_array(np.array([val], dtype=object),
                                  categorize=True)
            assert result[0] == expected[0]

    def test_hash_tuples_err(self):

        for val in [5, 'foo', pd.Timestamp('20130101')]:
            pytest.raises(TypeError, hash_tuples, val)

    def test_multiindex_unique(self):
        mi = MultiIndex.from_tuples([(118, 472), (236, 118),
                                     (51, 204), (102, 51)])
        assert mi.is_unique
        result = hash_pandas_object(mi)
        assert result.is_unique

    def test_multiindex_objects(self):
        mi = MultiIndex(levels=[['b', 'd', 'a'], [1, 2, 3]],
                        labels=[[0, 1, 0, 2], [2, 0, 0, 1]],
                        names=['col1', 'col2'])
        recons = mi._sort_levels_monotonic()

        # these are equal
        assert mi.equals(recons)
        assert Index(mi.values).equals(Index(recons.values))

        # _hashed_values and hash_pandas_object(..., index=False)
        # equivalency
        expected = hash_pandas_object(
            mi, index=False).values
        result = mi._hashed_values
        tm.assert_numpy_array_equal(result, expected)

        expected = hash_pandas_object(
            recons, index=False).values
        result = recons._hashed_values
        tm.assert_numpy_array_equal(result, expected)

        expected = mi._hashed_values
        result = recons._hashed_values

        # values should match, but in different order
        tm.assert_numpy_array_equal(np.sort(result),
                                    np.sort(expected))

    def test_hash_pandas_object(self):

        for obj in [Series([1, 2, 3]),
                    Series([1.0, 1.5, 3.2]),
                    Series([1.0, 1.5, np.nan]),
                    Series([1.0, 1.5, 3.2], index=[1.5, 1.1, 3.3]),
                    Series(['a', 'b', 'c']),
                    Series(['a', np.nan, 'c']),
                    Series(['a', None, 'c']),
                    Series([True, False, True]),
                    Series(),
                    Index([1, 2, 3]),
                    Index([True, False, True]),
                    DataFrame({'x': ['a', 'b', 'c'], 'y': [1, 2, 3]}),
                    DataFrame(),
                    tm.makeMissingDataframe(),
                    tm.makeMixedDataFrame(),
                    tm.makeTimeDataFrame(),
                    tm.makeTimeSeries(),
                    tm.makeTimedeltaIndex(),
                    tm.makePeriodIndex(),
                    Series(tm.makePeriodIndex()),
                    Series(pd.date_range('20130101',
                                         periods=3, tz='US/Eastern')),
                    MultiIndex.from_product(
                        [range(5),
                         ['foo', 'bar', 'baz'],
                         pd.date_range('20130101', periods=2)]),
                    MultiIndex.from_product(
                        [pd.CategoricalIndex(list('aabc')),
                         range(3)])]:
            self.check_equal(obj)
            self.check_not_equal_with_index(obj)

    def test_hash_pandas_object2(self):
        for name, s in self.df.iteritems():
            self.check_equal(s)
            self.check_not_equal_with_index(s)

    def test_hash_pandas_empty_object(self):
        for obj in [Series([], dtype='float64'),
                    Series([], dtype='object'),
                    Index([])]:
            self.check_equal(obj)

            # these are by-definition the same with
            # or w/o the index as the data is empty

    def test_categorical_consistency(self):
        # GH15143
        # Check that categoricals hash consistent with their values, not codes
        # This should work for categoricals of any dtype
        for s1 in [Series(['a', 'b', 'c', 'd']),
                   Series([1000, 2000, 3000, 4000]),
                   Series(pd.date_range(0, periods=4))]:
            s2 = s1.astype('category').cat.set_categories(s1)
            s3 = s2.cat.set_categories(list(reversed(s1)))
            for categorize in [True, False]:
                # These should all hash identically
                h1 = hash_pandas_object(s1, categorize=categorize)
                h2 = hash_pandas_object(s2, categorize=categorize)
                h3 = hash_pandas_object(s3, categorize=categorize)
                tm.assert_series_equal(h1, h2)
                tm.assert_series_equal(h1, h3)

    def test_categorical_with_nan_consistency(self):
        c = pd.Categorical.from_codes(
            [-1, 0, 1, 2, 3, 4],
            categories=pd.date_range('2012-01-01', periods=5, name='B'))
        expected = hash_array(c, categorize=False)
        c = pd.Categorical.from_codes(
            [-1, 0],
            categories=[pd.Timestamp('2012-01-01')])
        result = hash_array(c, categorize=False)
        assert result[0] in expected
        assert result[1] in expected

    def test_pandas_errors(self):

        for obj in [pd.Timestamp('20130101')]:
            with pytest.raises(TypeError):
                hash_pandas_object(obj)

        with catch_warnings(record=True):
            obj = tm.makePanel()
        with pytest.raises(TypeError):
            hash_pandas_object(obj)

    def test_hash_keys(self):
        # using different hash keys, should have different hashes
        # for the same data

        # this only matters for object dtypes
        obj = Series(list('abc'))
        a = hash_pandas_object(obj, hash_key='9876543210123456')
        b = hash_pandas_object(obj, hash_key='9876543210123465')
        assert (a != b).all()

    def test_invalid_key(self):
        # this only matters for object dtypes
        def f():
            hash_pandas_object(Series(list('abc')), hash_key='foo')
        pytest.raises(ValueError, f)

    def test_alread_encoded(self):
        # if already encoded then ok

        obj = Series(list('abc')).str.encode('utf8')
        self.check_equal(obj)

    def test_alternate_encoding(self):

        obj = Series(list('abc'))
        self.check_equal(obj, encoding='ascii')

    def test_same_len_hash_collisions(self):

        for l in range(8):
            length = 2**(l + 8) + 1
            s = tm.rands_array(length, 2)
            result = hash_array(s, 'utf8')
            assert not result[0] == result[1]

        for l in range(8):
            length = 2**(l + 8)
            s = tm.rands_array(length, 2)
            result = hash_array(s, 'utf8')
            assert not result[0] == result[1]

    def test_hash_collisions(self):

        # hash collisions are bad
        # https://github.com/pandas-dev/pandas/issues/14711#issuecomment-264885726
        L = ['Ingrid-9Z9fKIZmkO7i7Cn51Li34pJm44fgX6DYGBNj3VPlOH50m7HnBlPxfIwFMrcNJNMP6PSgLmwWnInciMWrCSAlLEvt7JkJl4IxiMrVbXSa8ZQoVaq5xoQPjltuJEfwdNlO6jo8qRRHvD8sBEBMQASrRa6TsdaPTPCBo3nwIBpE7YzzmyH0vMBhjQZLx1aCT7faSEx7PgFxQhHdKFWROcysamgy9iVj8DO2Fmwg1NNl93rIAqC3mdqfrCxrzfvIY8aJdzin2cHVzy3QUJxZgHvtUtOLxoqnUHsYbNTeq0xcLXpTZEZCxD4PGubIuCNf32c33M7HFsnjWSEjE2yVdWKhmSVodyF8hFYVmhYnMCztQnJrt3O8ZvVRXd5IKwlLexiSp4h888w7SzAIcKgc3g5XQJf6MlSMftDXm9lIsE1mJNiJEv6uY6pgvC3fUPhatlR5JPpVAHNSbSEE73MBzJrhCAbOLXQumyOXigZuPoME7QgJcBalliQol7YZ9',  # noqa
             'Tim-b9MddTxOWW2AT1Py6vtVbZwGAmYCjbp89p8mxsiFoVX4FyDOF3wFiAkyQTUgwg9sVqVYOZo09Dh1AzhFHbgij52ylF0SEwgzjzHH8TGY8Lypart4p4onnDoDvVMBa0kdthVGKl6K0BDVGzyOXPXKpmnMF1H6rJzqHJ0HywfwS4XYpVwlAkoeNsiicHkJUFdUAhG229INzvIAiJuAHeJDUoyO4DCBqtoZ5TDend6TK7Y914yHlfH3g1WZu5LksKv68VQHJriWFYusW5e6ZZ6dKaMjTwEGuRgdT66iU5nqWTHRH8WSzpXoCFwGcTOwyuqPSe0fTe21DVtJn1FKj9F9nEnR9xOvJUO7E0piCIF4Ad9yAIDY4DBimpsTfKXCu1vdHpKYerzbndfuFe5AhfMduLYZJi5iAw8qKSwR5h86ttXV0Mc0QmXz8dsRvDgxjXSmupPxBggdlqUlC828hXiTPD7am0yETBV0F3bEtvPiNJfremszcV8NcqAoARMe']  # noqa

        # these should be different!
        result1 = hash_array(np.asarray(L[0:1], dtype=object), 'utf8')
        expected1 = np.array([14963968704024874985], dtype=np.uint64)
        tm.assert_numpy_array_equal(result1, expected1)

        result2 = hash_array(np.asarray(L[1:2], dtype=object), 'utf8')
        expected2 = np.array([16428432627716348016], dtype=np.uint64)
        tm.assert_numpy_array_equal(result2, expected2)

        result = hash_array(np.asarray(L, dtype=object), 'utf8')
        tm.assert_numpy_array_equal(
            result, np.concatenate([expected1, expected2], axis=0))


def test_deprecation():

    with tm.assert_produces_warning(DeprecationWarning,
                                    check_stacklevel=False):
        from pandas.tools.hashing import hash_pandas_object
        obj = Series(list('abc'))
        hash_pandas_object(obj, hash_key='9876543210123456')

    with tm.assert_produces_warning(DeprecationWarning,
                                    check_stacklevel=False):
        from pandas.tools.hashing import hash_array
        obj = np.array([1, 2, 3])
        hash_array(obj, hash_key='9876543210123456')
