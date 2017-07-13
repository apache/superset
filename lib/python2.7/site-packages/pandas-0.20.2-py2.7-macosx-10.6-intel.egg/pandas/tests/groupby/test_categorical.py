# -*- coding: utf-8 -*-
from __future__ import print_function
from datetime import datetime

import pytest

import numpy as np
from numpy import nan

import pandas as pd
from pandas import (Index, MultiIndex, CategoricalIndex,
                    DataFrame, Categorical, Series, Interval)
from pandas.util.testing import assert_frame_equal, assert_series_equal
import pandas.util.testing as tm
from .common import MixIn


class TestGroupByCategorical(MixIn):

    def test_level_groupby_get_group(self):
        # GH15155
        df = DataFrame(data=np.arange(2, 22, 2),
                       index=MultiIndex(
                           levels=[pd.CategoricalIndex(["a", "b"]), range(10)],
                           labels=[[0] * 5 + [1] * 5, range(10)],
                           names=["Index1", "Index2"]))
        g = df.groupby(level=["Index1"])

        # expected should equal test.loc[["a"]]
        # GH15166
        expected = DataFrame(data=np.arange(2, 12, 2),
                             index=pd.MultiIndex(levels=[pd.CategoricalIndex(
                                 ["a", "b"]), range(5)],
            labels=[[0] * 5, range(5)],
            names=["Index1", "Index2"]))
        result = g.get_group('a')

        assert_frame_equal(result, expected)

    def test_apply_use_categorical_name(self):
        from pandas import qcut
        cats = qcut(self.df.C, 4)

        def get_stats(group):
            return {'min': group.min(),
                    'max': group.max(),
                    'count': group.count(),
                    'mean': group.mean()}

        result = self.df.groupby(cats).D.apply(get_stats)
        assert result.index.names[0] == 'C'

    def test_apply_categorical_data(self):
        # GH 10138
        for ordered in [True, False]:
            dense = Categorical(list('abc'), ordered=ordered)
            # 'b' is in the categories but not in the list
            missing = Categorical(
                list('aaa'), categories=['a', 'b'], ordered=ordered)
            values = np.arange(len(dense))
            df = DataFrame({'missing': missing,
                            'dense': dense,
                            'values': values})
            grouped = df.groupby(['missing', 'dense'])

            # missing category 'b' should still exist in the output index
            idx = MultiIndex.from_product(
                [Categorical(['a', 'b'], ordered=ordered),
                 Categorical(['a', 'b', 'c'], ordered=ordered)],
                names=['missing', 'dense'])
            expected = DataFrame([0, 1, 2, np.nan, np.nan, np.nan],
                                 index=idx,
                                 columns=['values'])

            assert_frame_equal(grouped.apply(lambda x: np.mean(x)), expected)
            assert_frame_equal(grouped.mean(), expected)
            assert_frame_equal(grouped.agg(np.mean), expected)

            # but for transform we should still get back the original index
            idx = MultiIndex.from_product([['a'], ['a', 'b', 'c']],
                                          names=['missing', 'dense'])
            expected = Series(1, index=idx)
            assert_series_equal(grouped.apply(lambda x: 1), expected)

    def test_groupby_categorical(self):
        levels = ['foo', 'bar', 'baz', 'qux']
        codes = np.random.randint(0, 4, size=100)

        cats = Categorical.from_codes(codes, levels, ordered=True)

        data = DataFrame(np.random.randn(100, 4))

        result = data.groupby(cats).mean()

        expected = data.groupby(np.asarray(cats)).mean()
        exp_idx = CategoricalIndex(levels, categories=cats.categories,
                                   ordered=True)
        expected = expected.reindex(exp_idx)

        assert_frame_equal(result, expected)

        grouped = data.groupby(cats)
        desc_result = grouped.describe()

        idx = cats.codes.argsort()
        ord_labels = np.asarray(cats).take(idx)
        ord_data = data.take(idx)

        exp_cats = Categorical(ord_labels, ordered=True,
                               categories=['foo', 'bar', 'baz', 'qux'])
        expected = ord_data.groupby(exp_cats, sort=False).describe()
        assert_frame_equal(desc_result, expected)

        # GH 10460
        expc = Categorical.from_codes(np.arange(4).repeat(8),
                                      levels, ordered=True)
        exp = CategoricalIndex(expc)
        tm.assert_index_equal((desc_result.stack().index
                               .get_level_values(0)), exp)
        exp = Index(['count', 'mean', 'std', 'min', '25%', '50%',
                     '75%', 'max'] * 4)
        tm.assert_index_equal((desc_result.stack().index
                               .get_level_values(1)), exp)

    def test_groupby_datetime_categorical(self):
        # GH9049: ensure backward compatibility
        levels = pd.date_range('2014-01-01', periods=4)
        codes = np.random.randint(0, 4, size=100)

        cats = Categorical.from_codes(codes, levels, ordered=True)

        data = DataFrame(np.random.randn(100, 4))
        result = data.groupby(cats).mean()

        expected = data.groupby(np.asarray(cats)).mean()
        expected = expected.reindex(levels)
        expected.index = CategoricalIndex(expected.index,
                                          categories=expected.index,
                                          ordered=True)

        assert_frame_equal(result, expected)

        grouped = data.groupby(cats)
        desc_result = grouped.describe()

        idx = cats.codes.argsort()
        ord_labels = cats.take_nd(idx)
        ord_data = data.take(idx)
        expected = ord_data.groupby(ord_labels).describe()
        assert_frame_equal(desc_result, expected)
        tm.assert_index_equal(desc_result.index, expected.index)
        tm.assert_index_equal(
            desc_result.index.get_level_values(0),
            expected.index.get_level_values(0))

        # GH 10460
        expc = Categorical.from_codes(
            np.arange(4).repeat(8), levels, ordered=True)
        exp = CategoricalIndex(expc)
        tm.assert_index_equal((desc_result.stack().index
                               .get_level_values(0)), exp)
        exp = Index(['count', 'mean', 'std', 'min', '25%', '50%',
                     '75%', 'max'] * 4)
        tm.assert_index_equal((desc_result.stack().index
                               .get_level_values(1)), exp)

    def test_groupby_categorical_index(self):

        s = np.random.RandomState(12345)
        levels = ['foo', 'bar', 'baz', 'qux']
        codes = s.randint(0, 4, size=20)
        cats = Categorical.from_codes(codes, levels, ordered=True)
        df = DataFrame(
            np.repeat(
                np.arange(20), 4).reshape(-1, 4), columns=list('abcd'))
        df['cats'] = cats

        # with a cat index
        result = df.set_index('cats').groupby(level=0).sum()
        expected = df[list('abcd')].groupby(cats.codes).sum()
        expected.index = CategoricalIndex(
            Categorical.from_codes(
                [0, 1, 2, 3], levels, ordered=True), name='cats')
        assert_frame_equal(result, expected)

        # with a cat column, should produce a cat index
        result = df.groupby('cats').sum()
        expected = df[list('abcd')].groupby(cats.codes).sum()
        expected.index = CategoricalIndex(
            Categorical.from_codes(
                [0, 1, 2, 3], levels, ordered=True), name='cats')
        assert_frame_equal(result, expected)

    def test_groupby_describe_categorical_columns(self):
        # GH 11558
        cats = pd.CategoricalIndex(['qux', 'foo', 'baz', 'bar'],
                                   categories=['foo', 'bar', 'baz', 'qux'],
                                   ordered=True)
        df = DataFrame(np.random.randn(20, 4), columns=cats)
        result = df.groupby([1, 2, 3, 4] * 5).describe()

        tm.assert_index_equal(result.stack().columns, cats)
        tm.assert_categorical_equal(result.stack().columns.values, cats.values)

    def test_groupby_unstack_categorical(self):
        # GH11558 (example is taken from the original issue)
        df = pd.DataFrame({'a': range(10),
                           'medium': ['A', 'B'] * 5,
                           'artist': list('XYXXY') * 2})
        df['medium'] = df['medium'].astype('category')

        gcat = df.groupby(['artist', 'medium'])['a'].count().unstack()
        result = gcat.describe()

        exp_columns = pd.CategoricalIndex(['A', 'B'], ordered=False,
                                          name='medium')
        tm.assert_index_equal(result.columns, exp_columns)
        tm.assert_categorical_equal(result.columns.values, exp_columns.values)

        result = gcat['A'] + gcat['B']
        expected = pd.Series([6, 4], index=pd.Index(['X', 'Y'], name='artist'))
        tm.assert_series_equal(result, expected)

    def test_groupby_bins_unequal_len(self):
        # GH3011
        series = Series([np.nan, np.nan, 1, 1, 2, 2, 3, 3, 4, 4])
        bins = pd.cut(series.dropna().values, 4)

        # len(bins) != len(series) here
        def f():
            series.groupby(bins).mean()
        pytest.raises(ValueError, f)

    def test_groupby_multi_categorical_as_index(self):
        # GH13204
        df = DataFrame({'cat': Categorical([1, 2, 2], [1, 2, 3]),
                        'A': [10, 11, 11],
                        'B': [101, 102, 103]})
        result = df.groupby(['cat', 'A'], as_index=False).sum()
        expected = DataFrame({'cat': Categorical([1, 1, 2, 2, 3, 3]),
                              'A': [10, 11, 10, 11, 10, 11],
                              'B': [101.0, nan, nan, 205.0, nan, nan]},
                             columns=['cat', 'A', 'B'])
        tm.assert_frame_equal(result, expected)

        # function grouper
        f = lambda r: df.loc[r, 'A']
        result = df.groupby(['cat', f], as_index=False).sum()
        expected = DataFrame({'cat': Categorical([1, 1, 2, 2, 3, 3]),
                              'A': [10.0, nan, nan, 22.0, nan, nan],
                              'B': [101.0, nan, nan, 205.0, nan, nan]},
                             columns=['cat', 'A', 'B'])
        tm.assert_frame_equal(result, expected)

        # another not in-axis grouper (conflicting names in index)
        s = Series(['a', 'b', 'b'], name='cat')
        result = df.groupby(['cat', s], as_index=False).sum()
        expected = DataFrame({'cat': Categorical([1, 1, 2, 2, 3, 3]),
                              'A': [10.0, nan, nan, 22.0, nan, nan],
                              'B': [101.0, nan, nan, 205.0, nan, nan]},
                             columns=['cat', 'A', 'B'])
        tm.assert_frame_equal(result, expected)

        # is original index dropped?
        expected = DataFrame({'cat': Categorical([1, 1, 2, 2, 3, 3]),
                              'A': [10, 11, 10, 11, 10, 11],
                              'B': [101.0, nan, nan, 205.0, nan, nan]},
                             columns=['cat', 'A', 'B'])

        group_columns = ['cat', 'A']

        for name in [None, 'X', 'B', 'cat']:
            df.index = Index(list("abc"), name=name)

            if name in group_columns and name in df.index.names:
                with tm.assert_produces_warning(FutureWarning,
                                                check_stacklevel=False):
                    result = df.groupby(group_columns, as_index=False).sum()

            else:
                result = df.groupby(group_columns, as_index=False).sum()

            tm.assert_frame_equal(result, expected, check_index_type=True)

    def test_groupby_preserve_categories(self):
        # GH-13179
        categories = list('abc')

        # ordered=True
        df = DataFrame({'A': pd.Categorical(list('ba'),
                                            categories=categories,
                                            ordered=True)})
        index = pd.CategoricalIndex(categories, categories, ordered=True)
        tm.assert_index_equal(df.groupby('A', sort=True).first().index, index)
        tm.assert_index_equal(df.groupby('A', sort=False).first().index, index)

        # ordered=False
        df = DataFrame({'A': pd.Categorical(list('ba'),
                                            categories=categories,
                                            ordered=False)})
        sort_index = pd.CategoricalIndex(categories, categories, ordered=False)
        nosort_index = pd.CategoricalIndex(list('bac'), list('bac'),
                                           ordered=False)
        tm.assert_index_equal(df.groupby('A', sort=True).first().index,
                              sort_index)
        tm.assert_index_equal(df.groupby('A', sort=False).first().index,
                              nosort_index)

    def test_groupby_preserve_categorical_dtype(self):
        # GH13743, GH13854
        df = DataFrame({'A': [1, 2, 1, 1, 2],
                        'B': [10, 16, 22, 28, 34],
                        'C1': Categorical(list("abaab"),
                                          categories=list("bac"),
                                          ordered=False),
                        'C2': Categorical(list("abaab"),
                                          categories=list("bac"),
                                          ordered=True)})
        # single grouper
        exp_full = DataFrame({'A': [2.0, 1.0, np.nan],
                              'B': [25.0, 20.0, np.nan],
                              'C1': Categorical(list("bac"),
                                                categories=list("bac"),
                                                ordered=False),
                              'C2': Categorical(list("bac"),
                                                categories=list("bac"),
                                                ordered=True)})
        for col in ['C1', 'C2']:
            result1 = df.groupby(by=col, as_index=False).mean()
            result2 = df.groupby(by=col, as_index=True).mean().reset_index()
            expected = exp_full.reindex(columns=result1.columns)
            tm.assert_frame_equal(result1, expected)
            tm.assert_frame_equal(result2, expected)

        # multiple grouper
        exp_full = DataFrame({'A': [1, 1, 1, 2, 2, 2],
                              'B': [np.nan, 20.0, np.nan, 25.0, np.nan,
                                    np.nan],
                              'C1': Categorical(list("bacbac"),
                                                categories=list("bac"),
                                                ordered=False),
                              'C2': Categorical(list("bacbac"),
                                                categories=list("bac"),
                                                ordered=True)})
        for cols in [['A', 'C1'], ['A', 'C2']]:
            result1 = df.groupby(by=cols, as_index=False).mean()
            result2 = df.groupby(by=cols, as_index=True).mean().reset_index()
            expected = exp_full.reindex(columns=result1.columns)
            tm.assert_frame_equal(result1, expected)
            tm.assert_frame_equal(result2, expected)

    def test_groupby_categorical_no_compress(self):
        data = Series(np.random.randn(9))

        codes = np.array([0, 0, 0, 1, 1, 1, 2, 2, 2])
        cats = Categorical.from_codes(codes, [0, 1, 2], ordered=True)

        result = data.groupby(cats).mean()
        exp = data.groupby(codes).mean()

        exp.index = CategoricalIndex(exp.index, categories=cats.categories,
                                     ordered=cats.ordered)
        assert_series_equal(result, exp)

        codes = np.array([0, 0, 0, 1, 1, 1, 3, 3, 3])
        cats = Categorical.from_codes(codes, [0, 1, 2, 3], ordered=True)

        result = data.groupby(cats).mean()
        exp = data.groupby(codes).mean().reindex(cats.categories)
        exp.index = CategoricalIndex(exp.index, categories=cats.categories,
                                     ordered=cats.ordered)
        assert_series_equal(result, exp)

        cats = Categorical(["a", "a", "a", "b", "b", "b", "c", "c", "c"],
                           categories=["a", "b", "c", "d"], ordered=True)
        data = DataFrame({"a": [1, 1, 1, 2, 2, 2, 3, 4, 5], "b": cats})

        result = data.groupby("b").mean()
        result = result["a"].values
        exp = np.array([1, 2, 4, np.nan])
        tm.assert_numpy_array_equal(result, exp)

    def test_groupby_sort_categorical(self):
        # dataframe groupby sort was being ignored # GH 8868
        df = DataFrame([['(7.5, 10]', 10, 10],
                        ['(7.5, 10]', 8, 20],
                        ['(2.5, 5]', 5, 30],
                        ['(5, 7.5]', 6, 40],
                        ['(2.5, 5]', 4, 50],
                        ['(0, 2.5]', 1, 60],
                        ['(5, 7.5]', 7, 70]], columns=['range', 'foo', 'bar'])
        df['range'] = Categorical(df['range'], ordered=True)
        index = CategoricalIndex(['(0, 2.5]', '(2.5, 5]', '(5, 7.5]',
                                  '(7.5, 10]'], name='range', ordered=True)
        result_sort = DataFrame([[1, 60], [5, 30], [6, 40], [10, 10]],
                                columns=['foo', 'bar'], index=index)

        col = 'range'
        assert_frame_equal(result_sort, df.groupby(col, sort=True).first())
        # when categories is ordered, group is ordered by category's order
        assert_frame_equal(result_sort, df.groupby(col, sort=False).first())

        df['range'] = Categorical(df['range'], ordered=False)
        index = CategoricalIndex(['(0, 2.5]', '(2.5, 5]', '(5, 7.5]',
                                  '(7.5, 10]'], name='range')
        result_sort = DataFrame([[1, 60], [5, 30], [6, 40], [10, 10]],
                                columns=['foo', 'bar'], index=index)

        index = CategoricalIndex(['(7.5, 10]', '(2.5, 5]', '(5, 7.5]',
                                  '(0, 2.5]'],
                                 categories=['(7.5, 10]', '(2.5, 5]',
                                             '(5, 7.5]', '(0, 2.5]'],
                                 name='range')
        result_nosort = DataFrame([[10, 10], [5, 30], [6, 40], [1, 60]],
                                  index=index, columns=['foo', 'bar'])

        col = 'range'
        # this is an unordered categorical, but we allow this ####
        assert_frame_equal(result_sort, df.groupby(col, sort=True).first())
        assert_frame_equal(result_nosort, df.groupby(col, sort=False).first())

    def test_groupby_sort_categorical_datetimelike(self):
        # GH10505

        # use same data as test_groupby_sort_categorical, which category is
        # corresponding to datetime.month
        df = DataFrame({'dt': [datetime(2011, 7, 1), datetime(2011, 7, 1),
                               datetime(2011, 2, 1), datetime(2011, 5, 1),
                               datetime(2011, 2, 1), datetime(2011, 1, 1),
                               datetime(2011, 5, 1)],
                        'foo': [10, 8, 5, 6, 4, 1, 7],
                        'bar': [10, 20, 30, 40, 50, 60, 70]},
                       columns=['dt', 'foo', 'bar'])

        # ordered=True
        df['dt'] = Categorical(df['dt'], ordered=True)
        index = [datetime(2011, 1, 1), datetime(2011, 2, 1),
                 datetime(2011, 5, 1), datetime(2011, 7, 1)]
        result_sort = DataFrame(
            [[1, 60], [5, 30], [6, 40], [10, 10]], columns=['foo', 'bar'])
        result_sort.index = CategoricalIndex(index, name='dt', ordered=True)

        index = [datetime(2011, 7, 1), datetime(2011, 2, 1),
                 datetime(2011, 5, 1), datetime(2011, 1, 1)]
        result_nosort = DataFrame([[10, 10], [5, 30], [6, 40], [1, 60]],
                                  columns=['foo', 'bar'])
        result_nosort.index = CategoricalIndex(index, categories=index,
                                               name='dt', ordered=True)

        col = 'dt'
        assert_frame_equal(result_sort, df.groupby(col, sort=True).first())
        # when categories is ordered, group is ordered by category's order
        assert_frame_equal(result_sort, df.groupby(col, sort=False).first())

        # ordered = False
        df['dt'] = Categorical(df['dt'], ordered=False)
        index = [datetime(2011, 1, 1), datetime(2011, 2, 1),
                 datetime(2011, 5, 1), datetime(2011, 7, 1)]
        result_sort = DataFrame(
            [[1, 60], [5, 30], [6, 40], [10, 10]], columns=['foo', 'bar'])
        result_sort.index = CategoricalIndex(index, name='dt')

        index = [datetime(2011, 7, 1), datetime(2011, 2, 1),
                 datetime(2011, 5, 1), datetime(2011, 1, 1)]
        result_nosort = DataFrame([[10, 10], [5, 30], [6, 40], [1, 60]],
                                  columns=['foo', 'bar'])
        result_nosort.index = CategoricalIndex(index, categories=index,
                                               name='dt')

        col = 'dt'
        assert_frame_equal(result_sort, df.groupby(col, sort=True).first())
        assert_frame_equal(result_nosort, df.groupby(col, sort=False).first())

    def test_groupby_categorical_two_columns(self):

        # https://github.com/pandas-dev/pandas/issues/8138
        d = {'cat':
             pd.Categorical(["a", "b", "a", "b"], categories=["a", "b", "c"],
                            ordered=True),
             'ints': [1, 1, 2, 2],
             'val': [10, 20, 30, 40]}
        test = pd.DataFrame(d)

        # Grouping on a single column
        groups_single_key = test.groupby("cat")
        res = groups_single_key.agg('mean')

        exp_index = pd.CategoricalIndex(["a", "b", "c"], name="cat",
                                        ordered=True)
        exp = DataFrame({"ints": [1.5, 1.5, np.nan], "val": [20, 30, np.nan]},
                        index=exp_index)
        tm.assert_frame_equal(res, exp)

        # Grouping on two columns
        groups_double_key = test.groupby(["cat", "ints"])
        res = groups_double_key.agg('mean')
        exp = DataFrame({"val": [10, 30, 20, 40, np.nan, np.nan],
                         "cat": pd.Categorical(["a", "a", "b", "b", "c", "c"],
                                               ordered=True),
                         "ints": [1, 2, 1, 2, 1, 2]}).set_index(["cat", "ints"
                                                                 ])
        tm.assert_frame_equal(res, exp)

        # GH 10132
        for key in [('a', 1), ('b', 2), ('b', 1), ('a', 2)]:
            c, i = key
            result = groups_double_key.get_group(key)
            expected = test[(test.cat == c) & (test.ints == i)]
            assert_frame_equal(result, expected)

        d = {'C1': [3, 3, 4, 5], 'C2': [1, 2, 3, 4], 'C3': [10, 100, 200, 34]}
        test = pd.DataFrame(d)
        values = pd.cut(test['C1'], [1, 2, 3, 6])
        values.name = "cat"
        groups_double_key = test.groupby([values, 'C2'])

        res = groups_double_key.agg('mean')
        nan = np.nan
        idx = MultiIndex.from_product(
            [Categorical([Interval(1, 2), Interval(2, 3),
                          Interval(3, 6)], ordered=True),
             [1, 2, 3, 4]],
            names=["cat", "C2"])
        exp = DataFrame({"C1": [nan, nan, nan, nan, 3, 3,
                                nan, nan, nan, nan, 4, 5],
                         "C3": [nan, nan, nan, nan, 10, 100,
                                nan, nan, nan, nan, 200, 34]}, index=idx)
        tm.assert_frame_equal(res, exp)
