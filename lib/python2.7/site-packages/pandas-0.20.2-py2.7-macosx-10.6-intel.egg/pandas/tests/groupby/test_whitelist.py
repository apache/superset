"""
test methods relating to generic function evaluation
the so-called white/black lists
"""

import pytest
from string import ascii_lowercase
import numpy as np
from pandas import DataFrame, Series, compat, date_range, Index, MultiIndex
from pandas.util import testing as tm
from pandas.compat import lrange, product

AGG_FUNCTIONS = ['sum', 'prod', 'min', 'max', 'median', 'mean', 'skew',
                 'mad', 'std', 'var', 'sem']
AGG_FUNCTIONS_WITH_SKIPNA = ['skew', 'mad']

df_whitelist = frozenset([
    'last',
    'first',
    'mean',
    'sum',
    'min',
    'max',
    'head',
    'tail',
    'cumcount',
    'ngroup',
    'resample',
    'rank',
    'quantile',
    'fillna',
    'mad',
    'any',
    'all',
    'take',
    'idxmax',
    'idxmin',
    'shift',
    'tshift',
    'ffill',
    'bfill',
    'pct_change',
    'skew',
    'plot',
    'boxplot',
    'hist',
    'median',
    'dtypes',
    'corrwith',
    'corr',
    'cov',
    'diff',
])

s_whitelist = frozenset([
    'last',
    'first',
    'mean',
    'sum',
    'min',
    'max',
    'head',
    'tail',
    'cumcount',
    'ngroup',
    'resample',
    'rank',
    'quantile',
    'fillna',
    'mad',
    'any',
    'all',
    'take',
    'idxmax',
    'idxmin',
    'shift',
    'tshift',
    'ffill',
    'bfill',
    'pct_change',
    'skew',
    'plot',
    'hist',
    'median',
    'dtype',
    'corr',
    'cov',
    'diff',
    'unique',
    'nlargest',
    'nsmallest',
])


@pytest.fixture
def mframe():
    index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                              'three']],
                       labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                               [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                       names=['first', 'second'])
    return DataFrame(np.random.randn(10, 3), index=index,
                     columns=['A', 'B', 'C'])


@pytest.fixture
def df():
    return DataFrame(
        {'A': ['foo', 'bar', 'foo', 'bar', 'foo', 'bar', 'foo', 'foo'],
         'B': ['one', 'one', 'two', 'three', 'two', 'two', 'one', 'three'],
         'C': np.random.randn(8),
         'D': np.random.randn(8)})


@pytest.fixture
def df_letters():
    letters = np.array(list(ascii_lowercase))
    N = 10
    random_letters = letters.take(np.random.randint(0, 26, N))
    df = DataFrame({'floats': N / 10 * Series(np.random.random(N)),
                    'letters': Series(random_letters)})
    return df


@pytest.mark.parametrize(
    "obj, whitelist", zip((df_letters(), df_letters().floats),
                          (df_whitelist, s_whitelist)))
def test_groupby_whitelist(df_letters, obj, whitelist):
    df = df_letters

    # these are aliases so ok to have the alias __name__
    alias = {'bfill': 'backfill',
             'ffill': 'pad',
             'boxplot': None}

    gb = obj.groupby(df.letters)

    assert whitelist == gb._apply_whitelist
    for m in whitelist:

        m = alias.get(m, m)
        if m is None:
            continue

        f = getattr(type(gb), m)

        # name
        try:
            n = f.__name__
        except AttributeError:
            continue
        assert n == m

        # qualname
        if compat.PY3:
            try:
                n = f.__qualname__
            except AttributeError:
                continue
            assert n.endswith(m)


@pytest.fixture
def raw_frame():
    index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                              'three']],
                       labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                               [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                       names=['first', 'second'])
    raw_frame = DataFrame(np.random.randn(10, 3), index=index,
                          columns=Index(['A', 'B', 'C'], name='exp'))
    raw_frame.iloc[1, [1, 2]] = np.nan
    raw_frame.iloc[7, [0, 1]] = np.nan
    return raw_frame


@pytest.mark.parametrize(
    "op, level, axis, skipna",
    product(AGG_FUNCTIONS,
            lrange(2), lrange(2),
            [True, False]))
def test_regression_whitelist_methods(raw_frame, op, level, axis, skipna):
    # GH6944
    # explicity test the whitelest methods

    if axis == 0:
        frame = raw_frame
    else:
        frame = raw_frame.T

    if op in AGG_FUNCTIONS_WITH_SKIPNA:
        grouped = frame.groupby(level=level, axis=axis)
        result = getattr(grouped, op)(skipna=skipna)
        expected = getattr(frame, op)(level=level, axis=axis,
                                      skipna=skipna)
        tm.assert_frame_equal(result, expected)
    else:
        grouped = frame.groupby(level=level, axis=axis)
        result = getattr(grouped, op)()
        expected = getattr(frame, op)(level=level, axis=axis)
        tm.assert_frame_equal(result, expected)


def test_groupby_blacklist(df_letters):
    df = df_letters
    s = df_letters.floats

    blacklist = [
        'eval', 'query', 'abs', 'where',
        'mask', 'align', 'groupby', 'clip', 'astype',
        'at', 'combine', 'consolidate', 'convert_objects',
    ]
    to_methods = [method for method in dir(df) if method.startswith('to_')]

    blacklist.extend(to_methods)

    # e.g., to_csv
    defined_but_not_allowed = ("(?:^Cannot.+{0!r}.+{1!r}.+try using the "
                               "'apply' method$)")

    # e.g., query, eval
    not_defined = "(?:^{1!r} object has no attribute {0!r}$)"
    fmt = defined_but_not_allowed + '|' + not_defined
    for bl in blacklist:
        for obj in (df, s):
            gb = obj.groupby(df.letters)
            msg = fmt.format(bl, type(gb).__name__)
            with tm.assert_raises_regex(AttributeError, msg):
                getattr(gb, bl)


def test_tab_completion(mframe):
    grp = mframe.groupby(level='second')
    results = set([v for v in dir(grp) if not v.startswith('_')])
    expected = set(
        ['A', 'B', 'C', 'agg', 'aggregate', 'apply', 'boxplot', 'filter',
         'first', 'get_group', 'groups', 'hist', 'indices', 'last', 'max',
         'mean', 'median', 'min', 'ngroups', 'nth', 'ohlc', 'plot',
         'prod', 'size', 'std', 'sum', 'transform', 'var', 'sem', 'count',
         'nunique', 'head', 'describe', 'cummax', 'quantile',
         'rank', 'cumprod', 'tail', 'resample', 'cummin', 'fillna',
         'cumsum', 'cumcount', 'ngroup', 'all', 'shift', 'skew',
         'take', 'tshift', 'pct_change', 'any', 'mad', 'corr', 'corrwith',
         'cov', 'dtypes', 'ndim', 'diff', 'idxmax', 'idxmin',
         'ffill', 'bfill', 'pad', 'backfill', 'rolling', 'expanding'])
    assert results == expected


def test_groupby_function_rename(mframe):
    grp = mframe.groupby(level='second')
    for name in ['sum', 'prod', 'min', 'max', 'first', 'last']:
        f = getattr(grp, name)
        assert f.__name__ == name


def test_groupby_selection_with_methods(df):
    # some methods which require DatetimeIndex
    rng = date_range('2014', periods=len(df))
    df.index = rng

    g = df.groupby(['A'])[['C']]
    g_exp = df[['C']].groupby(df['A'])
    # TODO check groupby with > 1 col ?

    # methods which are called as .foo()
    methods = ['count',
               'corr',
               'cummax',
               'cummin',
               'cumprod',
               'describe',
               'rank',
               'quantile',
               'diff',
               'shift',
               'all',
               'any',
               'idxmin',
               'idxmax',
               'ffill',
               'bfill',
               'pct_change',
               'tshift']

    for m in methods:
        res = getattr(g, m)()
        exp = getattr(g_exp, m)()

        # should always be frames!
        tm.assert_frame_equal(res, exp)

    # methods which aren't just .foo()
    tm.assert_frame_equal(g.fillna(0), g_exp.fillna(0))
    tm.assert_frame_equal(g.dtypes, g_exp.dtypes)
    tm.assert_frame_equal(g.apply(lambda x: x.sum()),
                          g_exp.apply(lambda x: x.sum()))

    tm.assert_frame_equal(g.resample('D').mean(), g_exp.resample('D').mean())
    tm.assert_frame_equal(g.resample('D').ohlc(),
                          g_exp.resample('D').ohlc())

    tm.assert_frame_equal(g.filter(lambda x: len(x) == 3),
                          g_exp.filter(lambda x: len(x) == 3))
