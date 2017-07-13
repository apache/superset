# -*- coding: utf-8 -*-
from __future__ import print_function

import numpy as np

from pandas import (DataFrame, Series, MultiIndex)
from pandas.util.testing import assert_series_equal
from pandas.compat import (range, product as cart_product)


class TestCounting(object):

    def test_cumcount(self):
        df = DataFrame([['a'], ['a'], ['a'], ['b'], ['a']], columns=['A'])
        g = df.groupby('A')
        sg = g.A

        expected = Series([0, 1, 2, 0, 3])

        assert_series_equal(expected, g.cumcount())
        assert_series_equal(expected, sg.cumcount())

    def test_cumcount_empty(self):
        ge = DataFrame().groupby(level=0)
        se = Series().groupby(level=0)

        # edge case, as this is usually considered float
        e = Series(dtype='int64')

        assert_series_equal(e, ge.cumcount())
        assert_series_equal(e, se.cumcount())

    def test_cumcount_dupe_index(self):
        df = DataFrame([['a'], ['a'], ['a'], ['b'], ['a']], columns=['A'],
                       index=[0] * 5)
        g = df.groupby('A')
        sg = g.A

        expected = Series([0, 1, 2, 0, 3], index=[0] * 5)

        assert_series_equal(expected, g.cumcount())
        assert_series_equal(expected, sg.cumcount())

    def test_cumcount_mi(self):
        mi = MultiIndex.from_tuples([[0, 1], [1, 2], [2, 2], [2, 2], [1, 0]])
        df = DataFrame([['a'], ['a'], ['a'], ['b'], ['a']], columns=['A'],
                       index=mi)
        g = df.groupby('A')
        sg = g.A

        expected = Series([0, 1, 2, 0, 3], index=mi)

        assert_series_equal(expected, g.cumcount())
        assert_series_equal(expected, sg.cumcount())

    def test_cumcount_groupby_not_col(self):
        df = DataFrame([['a'], ['a'], ['a'], ['b'], ['a']], columns=['A'],
                       index=[0] * 5)
        g = df.groupby([0, 0, 0, 1, 0])
        sg = g.A

        expected = Series([0, 1, 2, 0, 3], index=[0] * 5)

        assert_series_equal(expected, g.cumcount())
        assert_series_equal(expected, sg.cumcount())

    def test_ngroup(self):
        df = DataFrame({'A': list('aaaba')})
        g = df.groupby('A')
        sg = g.A

        expected = Series([0, 0, 0, 1, 0])

        assert_series_equal(expected, g.ngroup())
        assert_series_equal(expected, sg.ngroup())

    def test_ngroup_distinct(self):
        df = DataFrame({'A': list('abcde')})
        g = df.groupby('A')
        sg = g.A

        expected = Series(range(5), dtype='int64')

        assert_series_equal(expected, g.ngroup())
        assert_series_equal(expected, sg.ngroup())

    def test_ngroup_one_group(self):
        df = DataFrame({'A': [0] * 5})
        g = df.groupby('A')
        sg = g.A

        expected = Series([0] * 5)

        assert_series_equal(expected, g.ngroup())
        assert_series_equal(expected, sg.ngroup())

    def test_ngroup_empty(self):
        ge = DataFrame().groupby(level=0)
        se = Series().groupby(level=0)

        # edge case, as this is usually considered float
        e = Series(dtype='int64')

        assert_series_equal(e, ge.ngroup())
        assert_series_equal(e, se.ngroup())

    def test_ngroup_series_matches_frame(self):
        df = DataFrame({'A': list('aaaba')})
        s = Series(list('aaaba'))

        assert_series_equal(df.groupby(s).ngroup(),
                            s.groupby(s).ngroup())

    def test_ngroup_dupe_index(self):
        df = DataFrame({'A': list('aaaba')}, index=[0] * 5)
        g = df.groupby('A')
        sg = g.A

        expected = Series([0, 0, 0, 1, 0], index=[0] * 5)

        assert_series_equal(expected, g.ngroup())
        assert_series_equal(expected, sg.ngroup())

    def test_ngroup_mi(self):
        mi = MultiIndex.from_tuples([[0, 1], [1, 2], [2, 2], [2, 2], [1, 0]])
        df = DataFrame({'A': list('aaaba')}, index=mi)
        g = df.groupby('A')
        sg = g.A
        expected = Series([0, 0, 0, 1, 0], index=mi)

        assert_series_equal(expected, g.ngroup())
        assert_series_equal(expected, sg.ngroup())

    def test_ngroup_groupby_not_col(self):
        df = DataFrame({'A': list('aaaba')}, index=[0] * 5)
        g = df.groupby([0, 0, 0, 1, 0])
        sg = g.A

        expected = Series([0, 0, 0, 1, 0], index=[0] * 5)

        assert_series_equal(expected, g.ngroup())
        assert_series_equal(expected, sg.ngroup())

    def test_ngroup_descending(self):
        df = DataFrame(['a', 'a', 'b', 'a', 'b'], columns=['A'])
        g = df.groupby(['A'])

        ascending = Series([0, 0, 1, 0, 1])
        descending = Series([1, 1, 0, 1, 0])

        assert_series_equal(descending, (g.ngroups - 1) - ascending)
        assert_series_equal(ascending, g.ngroup(ascending=True))
        assert_series_equal(descending, g.ngroup(ascending=False))

    def test_ngroup_matches_cumcount(self):
        # verify one manually-worked out case works
        df = DataFrame([['a', 'x'], ['a', 'y'], ['b', 'x'],
                        ['a', 'x'], ['b', 'y']], columns=['A', 'X'])
        g = df.groupby(['A', 'X'])
        g_ngroup = g.ngroup()
        g_cumcount = g.cumcount()
        expected_ngroup = Series([0, 1, 2, 0, 3])
        expected_cumcount = Series([0, 0, 0, 1, 0])

        assert_series_equal(g_ngroup, expected_ngroup)
        assert_series_equal(g_cumcount, expected_cumcount)

    def test_ngroup_cumcount_pair(self):
        # brute force comparison for all small series
        for p in cart_product(range(3), repeat=4):
            df = DataFrame({'a': p})
            g = df.groupby(['a'])

            order = sorted(set(p))
            ngroupd = [order.index(val) for val in p]
            cumcounted = [p[:i].count(val) for i, val in enumerate(p)]

            assert_series_equal(g.ngroup(), Series(ngroupd))
            assert_series_equal(g.cumcount(), Series(cumcounted))

    def test_ngroup_respects_groupby_order(self):
        np.random.seed(0)
        df = DataFrame({'a': np.random.choice(list('abcdef'), 100)})
        for sort_flag in (False, True):
            g = df.groupby(['a'], sort=sort_flag)
            df['group_id'] = -1
            df['group_index'] = -1

            for i, (_, group) in enumerate(g):
                df.loc[group.index, 'group_id'] = i
                for j, ind in enumerate(group.index):
                    df.loc[ind, 'group_index'] = j

            assert_series_equal(Series(df['group_id'].values),
                                g.ngroup())
            assert_series_equal(Series(df['group_index'].values),
                                g.cumcount())
