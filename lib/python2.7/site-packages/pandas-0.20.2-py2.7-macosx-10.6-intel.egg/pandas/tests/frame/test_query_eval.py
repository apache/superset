# -*- coding: utf-8 -*-

from __future__ import print_function

import operator
import pytest

from pandas.compat import (zip, range, lrange, StringIO)
from pandas import DataFrame, Series, Index, MultiIndex, date_range
import pandas as pd
import numpy as np

from numpy.random import randn

from pandas.util.testing import (assert_series_equal,
                                 assert_frame_equal,
                                 makeCustomDataframe as mkdf)

import pandas.util.testing as tm
from pandas.core.computation import _NUMEXPR_INSTALLED

from pandas.tests.frame.common import TestData


PARSERS = 'python', 'pandas'
ENGINES = 'python', 'numexpr'


@pytest.fixture(params=PARSERS, ids=lambda x: x)
def parser(request):
    return request.param


@pytest.fixture(params=ENGINES, ids=lambda x: x)
def engine(request):
    return request.param


def skip_if_no_pandas_parser(parser):
    if parser != 'pandas':
        pytest.skip("cannot evaluate with parser {0!r}".format(parser))


def skip_if_no_ne(engine='numexpr'):
    if engine == 'numexpr':
        if not _NUMEXPR_INSTALLED:
            pytest.skip("cannot query engine numexpr when numexpr not "
                        "installed")


class TestCompat(object):

    def setup_method(self, method):
        self.df = DataFrame({'A': [1, 2, 3]})
        self.expected1 = self.df[self.df.A > 0]
        self.expected2 = self.df.A + 1

    def test_query_default(self):

        # GH 12749
        # this should always work, whether _NUMEXPR_INSTALLED or not
        df = self.df
        result = df.query('A>0')
        assert_frame_equal(result, self.expected1)
        result = df.eval('A+1')
        assert_series_equal(result, self.expected2, check_names=False)

    def test_query_None(self):

        df = self.df
        result = df.query('A>0', engine=None)
        assert_frame_equal(result, self.expected1)
        result = df.eval('A+1', engine=None)
        assert_series_equal(result, self.expected2, check_names=False)

    def test_query_python(self):

        df = self.df
        result = df.query('A>0', engine='python')
        assert_frame_equal(result, self.expected1)
        result = df.eval('A+1', engine='python')
        assert_series_equal(result, self.expected2, check_names=False)

    def test_query_numexpr(self):

        df = self.df
        if _NUMEXPR_INSTALLED:
            result = df.query('A>0', engine='numexpr')
            assert_frame_equal(result, self.expected1)
            result = df.eval('A+1', engine='numexpr')
            assert_series_equal(result, self.expected2, check_names=False)
        else:
            pytest.raises(ImportError,
                          lambda: df.query('A>0', engine='numexpr'))
            pytest.raises(ImportError,
                          lambda: df.eval('A+1', engine='numexpr'))


class TestDataFrameEval(TestData):

    def test_ops(self):

        # tst ops and reversed ops in evaluation
        # GH7198

        # smaller hits python, larger hits numexpr
        for n in [4, 4000]:

            df = DataFrame(1, index=range(n), columns=list('abcd'))
            df.iloc[0] = 2
            m = df.mean()

            for op_str, op, rop in [('+', '__add__', '__radd__'),
                                    ('-', '__sub__', '__rsub__'),
                                    ('*', '__mul__', '__rmul__'),
                                    ('/', '__truediv__', '__rtruediv__')]:

                base = (DataFrame(np.tile(m.values, n)  # noqa
                                  .reshape(n, -1),
                                  columns=list('abcd')))

                expected = eval("base{op}df".format(op=op_str))

                # ops as strings
                result = eval("m{op}df".format(op=op_str))
                assert_frame_equal(result, expected)

                # these are commutative
                if op in ['+', '*']:
                    result = getattr(df, op)(m)
                    assert_frame_equal(result, expected)

                # these are not
                elif op in ['-', '/']:
                    result = getattr(df, rop)(m)
                    assert_frame_equal(result, expected)

        # GH7192
        df = DataFrame(dict(A=np.random.randn(25000)))
        df.iloc[0:5] = np.nan
        expected = (1 - np.isnan(df.iloc[0:25]))
        result = (1 - np.isnan(df)).iloc[0:25]
        assert_frame_equal(result, expected)

    def test_query_non_str(self):
        # GH 11485
        df = pd.DataFrame({'A': [1, 2, 3], 'B': ['a', 'b', 'b']})

        msg = "expr must be a string to be evaluated"
        with tm.assert_raises_regex(ValueError, msg):
            df.query(lambda x: x.B == "b")

        with tm.assert_raises_regex(ValueError, msg):
            df.query(111)

    def test_query_empty_string(self):
        # GH 13139
        df = pd.DataFrame({'A': [1, 2, 3]})

        msg = "expr cannot be an empty string"
        with tm.assert_raises_regex(ValueError, msg):
            df.query('')

    def test_eval_resolvers_as_list(self):
        # GH 14095
        df = DataFrame(randn(10, 2), columns=list('ab'))
        dict1 = {'a': 1}
        dict2 = {'b': 2}
        assert (df.eval('a + b', resolvers=[dict1, dict2]) ==
                dict1['a'] + dict2['b'])
        assert (pd.eval('a + b', resolvers=[dict1, dict2]) ==
                dict1['a'] + dict2['b'])


class TestDataFrameQueryWithMultiIndex(object):

    def test_query_with_named_multiindex(self, parser, engine):
        tm.skip_if_no_ne(engine)
        skip_if_no_pandas_parser(parser)
        a = np.random.choice(['red', 'green'], size=10)
        b = np.random.choice(['eggs', 'ham'], size=10)
        index = MultiIndex.from_arrays([a, b], names=['color', 'food'])
        df = DataFrame(randn(10, 2), index=index)
        ind = Series(df.index.get_level_values('color').values, index=index,
                     name='color')

        # equality
        res1 = df.query('color == "red"', parser=parser, engine=engine)
        res2 = df.query('"red" == color', parser=parser, engine=engine)
        exp = df[ind == 'red']
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # inequality
        res1 = df.query('color != "red"', parser=parser, engine=engine)
        res2 = df.query('"red" != color', parser=parser, engine=engine)
        exp = df[ind != 'red']
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # list equality (really just set membership)
        res1 = df.query('color == ["red"]', parser=parser, engine=engine)
        res2 = df.query('["red"] == color', parser=parser, engine=engine)
        exp = df[ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        res1 = df.query('color != ["red"]', parser=parser, engine=engine)
        res2 = df.query('["red"] != color', parser=parser, engine=engine)
        exp = df[~ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # in/not in ops
        res1 = df.query('["red"] in color', parser=parser, engine=engine)
        res2 = df.query('"red" in color', parser=parser, engine=engine)
        exp = df[ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        res1 = df.query('["red"] not in color', parser=parser, engine=engine)
        res2 = df.query('"red" not in color', parser=parser, engine=engine)
        exp = df[~ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

    def test_query_with_unnamed_multiindex(self, parser, engine):
        tm.skip_if_no_ne(engine)
        skip_if_no_pandas_parser(parser)
        a = np.random.choice(['red', 'green'], size=10)
        b = np.random.choice(['eggs', 'ham'], size=10)
        index = MultiIndex.from_arrays([a, b])
        df = DataFrame(randn(10, 2), index=index)
        ind = Series(df.index.get_level_values(0).values, index=index)

        res1 = df.query('ilevel_0 == "red"', parser=parser, engine=engine)
        res2 = df.query('"red" == ilevel_0', parser=parser, engine=engine)
        exp = df[ind == 'red']
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # inequality
        res1 = df.query('ilevel_0 != "red"', parser=parser, engine=engine)
        res2 = df.query('"red" != ilevel_0', parser=parser, engine=engine)
        exp = df[ind != 'red']
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # list equality (really just set membership)
        res1 = df.query('ilevel_0 == ["red"]', parser=parser, engine=engine)
        res2 = df.query('["red"] == ilevel_0', parser=parser, engine=engine)
        exp = df[ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        res1 = df.query('ilevel_0 != ["red"]', parser=parser, engine=engine)
        res2 = df.query('["red"] != ilevel_0', parser=parser, engine=engine)
        exp = df[~ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # in/not in ops
        res1 = df.query('["red"] in ilevel_0', parser=parser, engine=engine)
        res2 = df.query('"red" in ilevel_0', parser=parser, engine=engine)
        exp = df[ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        res1 = df.query('["red"] not in ilevel_0', parser=parser,
                        engine=engine)
        res2 = df.query('"red" not in ilevel_0', parser=parser, engine=engine)
        exp = df[~ind.isin(['red'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # ## LEVEL 1
        ind = Series(df.index.get_level_values(1).values, index=index)
        res1 = df.query('ilevel_1 == "eggs"', parser=parser, engine=engine)
        res2 = df.query('"eggs" == ilevel_1', parser=parser, engine=engine)
        exp = df[ind == 'eggs']
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # inequality
        res1 = df.query('ilevel_1 != "eggs"', parser=parser, engine=engine)
        res2 = df.query('"eggs" != ilevel_1', parser=parser, engine=engine)
        exp = df[ind != 'eggs']
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # list equality (really just set membership)
        res1 = df.query('ilevel_1 == ["eggs"]', parser=parser, engine=engine)
        res2 = df.query('["eggs"] == ilevel_1', parser=parser, engine=engine)
        exp = df[ind.isin(['eggs'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        res1 = df.query('ilevel_1 != ["eggs"]', parser=parser, engine=engine)
        res2 = df.query('["eggs"] != ilevel_1', parser=parser, engine=engine)
        exp = df[~ind.isin(['eggs'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        # in/not in ops
        res1 = df.query('["eggs"] in ilevel_1', parser=parser, engine=engine)
        res2 = df.query('"eggs" in ilevel_1', parser=parser, engine=engine)
        exp = df[ind.isin(['eggs'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

        res1 = df.query('["eggs"] not in ilevel_1', parser=parser,
                        engine=engine)
        res2 = df.query('"eggs" not in ilevel_1', parser=parser, engine=engine)
        exp = df[~ind.isin(['eggs'])]
        assert_frame_equal(res1, exp)
        assert_frame_equal(res2, exp)

    def test_query_with_partially_named_multiindex(self, parser, engine):
        tm.skip_if_no_ne(engine)
        skip_if_no_pandas_parser(parser)
        a = np.random.choice(['red', 'green'], size=10)
        b = np.arange(10)
        index = MultiIndex.from_arrays([a, b])
        index.names = [None, 'rating']
        df = DataFrame(randn(10, 2), index=index)
        res = df.query('rating == 1', parser=parser, engine=engine)
        ind = Series(df.index.get_level_values('rating').values, index=index,
                     name='rating')
        exp = df[ind == 1]
        assert_frame_equal(res, exp)

        res = df.query('rating != 1', parser=parser, engine=engine)
        ind = Series(df.index.get_level_values('rating').values, index=index,
                     name='rating')
        exp = df[ind != 1]
        assert_frame_equal(res, exp)

        res = df.query('ilevel_0 == "red"', parser=parser, engine=engine)
        ind = Series(df.index.get_level_values(0).values, index=index)
        exp = df[ind == "red"]
        assert_frame_equal(res, exp)

        res = df.query('ilevel_0 != "red"', parser=parser, engine=engine)
        ind = Series(df.index.get_level_values(0).values, index=index)
        exp = df[ind != "red"]
        assert_frame_equal(res, exp)

    def test_query_multiindex_get_index_resolvers(self):
        df = mkdf(10, 3, r_idx_nlevels=2, r_idx_names=['spam', 'eggs'])
        resolvers = df._get_index_resolvers()

        def to_series(mi, level):
            level_values = mi.get_level_values(level)
            s = level_values.to_series()
            s.index = mi
            return s

        col_series = df.columns.to_series()
        expected = {'index': df.index,
                    'columns': col_series,
                    'spam': to_series(df.index, 'spam'),
                    'eggs': to_series(df.index, 'eggs'),
                    'C0': col_series}
        for k, v in resolvers.items():
            if isinstance(v, Index):
                assert v.is_(expected[k])
            elif isinstance(v, Series):
                assert_series_equal(v, expected[k])
            else:
                raise AssertionError("object must be a Series or Index")

    def test_raise_on_panel_with_multiindex(self, parser, engine):
        tm.skip_if_no_ne()
        p = tm.makePanel(7)
        p.items = tm.makeCustomIndex(len(p.items), nlevels=2)
        with pytest.raises(NotImplementedError):
            pd.eval('p + 1', parser=parser, engine=engine)

    def test_raise_on_panel4d_with_multiindex(self, parser, engine):
        tm.skip_if_no_ne()
        p4d = tm.makePanel4D(7)
        p4d.items = tm.makeCustomIndex(len(p4d.items), nlevels=2)
        with pytest.raises(NotImplementedError):
            pd.eval('p4d + 1', parser=parser, engine=engine)


class TestDataFrameQueryNumExprPandas(object):

    @classmethod
    def setup_class(cls):
        cls.engine = 'numexpr'
        cls.parser = 'pandas'
        tm.skip_if_no_ne(cls.engine)

    @classmethod
    def teardown_class(cls):
        del cls.engine, cls.parser

    def test_date_query_with_attribute_access(self):
        engine, parser = self.engine, self.parser
        skip_if_no_pandas_parser(parser)
        df = DataFrame(randn(5, 3))
        df['dates1'] = date_range('1/1/2012', periods=5)
        df['dates2'] = date_range('1/1/2013', periods=5)
        df['dates3'] = date_range('1/1/2014', periods=5)
        res = df.query('@df.dates1 < 20130101 < @df.dates3', engine=engine,
                       parser=parser)
        expec = df[(df.dates1 < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_query_no_attribute_access(self):
        engine, parser = self.engine, self.parser
        df = DataFrame(randn(5, 3))
        df['dates1'] = date_range('1/1/2012', periods=5)
        df['dates2'] = date_range('1/1/2013', periods=5)
        df['dates3'] = date_range('1/1/2014', periods=5)
        res = df.query('dates1 < 20130101 < dates3', engine=engine,
                       parser=parser)
        expec = df[(df.dates1 < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_query_with_NaT(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates2'] = date_range('1/1/2013', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.loc[np.random.rand(n) > 0.5, 'dates1'] = pd.NaT
        df.loc[np.random.rand(n) > 0.5, 'dates3'] = pd.NaT
        res = df.query('dates1 < 20130101 < dates3', engine=engine,
                       parser=parser)
        expec = df[(df.dates1 < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_index_query(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.set_index('dates1', inplace=True, drop=True)
        res = df.query('index < 20130101 < dates3', engine=engine,
                       parser=parser)
        expec = df[(df.index < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_index_query_with_NaT(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.iloc[0, 0] = pd.NaT
        df.set_index('dates1', inplace=True, drop=True)
        res = df.query('index < 20130101 < dates3', engine=engine,
                       parser=parser)
        expec = df[(df.index < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_index_query_with_NaT_duplicates(self):
        engine, parser = self.engine, self.parser
        n = 10
        d = {}
        d['dates1'] = date_range('1/1/2012', periods=n)
        d['dates3'] = date_range('1/1/2014', periods=n)
        df = DataFrame(d)
        df.loc[np.random.rand(n) > 0.5, 'dates1'] = pd.NaT
        df.set_index('dates1', inplace=True, drop=True)
        res = df.query('dates1 < 20130101 < dates3', engine=engine,
                       parser=parser)
        expec = df[(df.index.to_series() < '20130101') &
                   ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_query_with_non_date(self):
        engine, parser = self.engine, self.parser

        n = 10
        df = DataFrame({'dates': date_range('1/1/2012', periods=n),
                        'nondate': np.arange(n)})

        ops = '==', '!=', '<', '>', '<=', '>='

        for op in ops:
            with pytest.raises(TypeError):
                df.query('dates %s nondate' % op, parser=parser, engine=engine)

    def test_query_syntax_error(self):
        engine, parser = self.engine, self.parser
        df = DataFrame({"i": lrange(10), "+": lrange(3, 13),
                        "r": lrange(4, 14)})
        with pytest.raises(SyntaxError):
            df.query('i - +', engine=engine, parser=parser)

    def test_query_scope(self):
        from pandas.core.computation.ops import UndefinedVariableError
        engine, parser = self.engine, self.parser
        skip_if_no_pandas_parser(parser)

        df = DataFrame(np.random.randn(20, 2), columns=list('ab'))

        a, b = 1, 2  # noqa
        res = df.query('a > b', engine=engine, parser=parser)
        expected = df[df.a > df.b]
        assert_frame_equal(res, expected)

        res = df.query('@a > b', engine=engine, parser=parser)
        expected = df[a > df.b]
        assert_frame_equal(res, expected)

        # no local variable c
        with pytest.raises(UndefinedVariableError):
            df.query('@a > b > @c', engine=engine, parser=parser)

        # no column named 'c'
        with pytest.raises(UndefinedVariableError):
            df.query('@a > b > c', engine=engine, parser=parser)

    def test_query_doesnt_pickup_local(self):
        from pandas.core.computation.ops import UndefinedVariableError

        engine, parser = self.engine, self.parser
        n = m = 10
        df = DataFrame(np.random.randint(m, size=(n, 3)), columns=list('abc'))

        # we don't pick up the local 'sin'
        with pytest.raises(UndefinedVariableError):
            df.query('sin > 5', engine=engine, parser=parser)

    def test_query_builtin(self):
        from pandas.core.computation.engines import NumExprClobberingError
        engine, parser = self.engine, self.parser

        n = m = 10
        df = DataFrame(np.random.randint(m, size=(n, 3)), columns=list('abc'))

        df.index.name = 'sin'
        with tm.assert_raises_regex(NumExprClobberingError,
                                    'Variables in expression.+'):
            df.query('sin > 5', engine=engine, parser=parser)

    def test_query(self):
        engine, parser = self.engine, self.parser
        df = DataFrame(np.random.randn(10, 3), columns=['a', 'b', 'c'])

        assert_frame_equal(df.query('a < b', engine=engine, parser=parser),
                           df[df.a < df.b])
        assert_frame_equal(df.query('a + b > b * c', engine=engine,
                                    parser=parser),
                           df[df.a + df.b > df.b * df.c])

    def test_query_index_with_name(self):
        engine, parser = self.engine, self.parser
        df = DataFrame(np.random.randint(10, size=(10, 3)),
                       index=Index(range(10), name='blob'),
                       columns=['a', 'b', 'c'])
        res = df.query('(blob < 5) & (a < b)', engine=engine, parser=parser)
        expec = df[(df.index < 5) & (df.a < df.b)]
        assert_frame_equal(res, expec)

        res = df.query('blob < b', engine=engine, parser=parser)
        expec = df[df.index < df.b]

        assert_frame_equal(res, expec)

    def test_query_index_without_name(self):
        engine, parser = self.engine, self.parser
        df = DataFrame(np.random.randint(10, size=(10, 3)),
                       index=range(10), columns=['a', 'b', 'c'])

        # "index" should refer to the index
        res = df.query('index < b', engine=engine, parser=parser)
        expec = df[df.index < df.b]
        assert_frame_equal(res, expec)

        # test against a scalar
        res = df.query('index < 5', engine=engine, parser=parser)
        expec = df[df.index < 5]
        assert_frame_equal(res, expec)

    def test_nested_scope(self):
        engine = self.engine
        parser = self.parser

        skip_if_no_pandas_parser(parser)

        df = DataFrame(np.random.randn(5, 3))
        df2 = DataFrame(np.random.randn(5, 3))
        expected = df[(df > 0) & (df2 > 0)]

        result = df.query('(@df > 0) & (@df2 > 0)', engine=engine,
                          parser=parser)
        assert_frame_equal(result, expected)

        result = pd.eval('df[df > 0 and df2 > 0]', engine=engine,
                         parser=parser)
        assert_frame_equal(result, expected)

        result = pd.eval('df[df > 0 and df2 > 0 and df[df > 0] > 0]',
                         engine=engine, parser=parser)
        expected = df[(df > 0) & (df2 > 0) & (df[df > 0] > 0)]
        assert_frame_equal(result, expected)

        result = pd.eval('df[(df>0) & (df2>0)]', engine=engine, parser=parser)
        expected = df.query('(@df>0) & (@df2>0)', engine=engine, parser=parser)
        assert_frame_equal(result, expected)

    def test_nested_raises_on_local_self_reference(self):
        from pandas.core.computation.ops import UndefinedVariableError

        df = DataFrame(np.random.randn(5, 3))

        # can't reference ourself b/c we're a local so @ is necessary
        with pytest.raises(UndefinedVariableError):
            df.query('df > 0', engine=self.engine, parser=self.parser)

    def test_local_syntax(self):
        skip_if_no_pandas_parser(self.parser)

        engine, parser = self.engine, self.parser
        df = DataFrame(randn(100, 10), columns=list('abcdefghij'))
        b = 1
        expect = df[df.a < b]
        result = df.query('a < @b', engine=engine, parser=parser)
        assert_frame_equal(result, expect)

        expect = df[df.a < df.b]
        result = df.query('a < b', engine=engine, parser=parser)
        assert_frame_equal(result, expect)

    def test_chained_cmp_and_in(self):
        skip_if_no_pandas_parser(self.parser)
        engine, parser = self.engine, self.parser
        cols = list('abc')
        df = DataFrame(randn(100, len(cols)), columns=cols)
        res = df.query('a < b < c and a not in b not in c', engine=engine,
                       parser=parser)
        ind = (df.a < df.b) & (df.b < df.c) & ~df.b.isin(df.a) & ~df.c.isin(df.b)  # noqa
        expec = df[ind]
        assert_frame_equal(res, expec)

    def test_local_variable_with_in(self):
        engine, parser = self.engine, self.parser
        skip_if_no_pandas_parser(parser)
        a = Series(np.random.randint(3, size=15), name='a')
        b = Series(np.random.randint(10, size=15), name='b')
        df = DataFrame({'a': a, 'b': b})

        expected = df.loc[(df.b - 1).isin(a)]
        result = df.query('b - 1 in a', engine=engine, parser=parser)
        assert_frame_equal(expected, result)

        b = Series(np.random.randint(10, size=15), name='b')
        expected = df.loc[(b - 1).isin(a)]
        result = df.query('@b - 1 in a', engine=engine, parser=parser)
        assert_frame_equal(expected, result)

    def test_at_inside_string(self):
        engine, parser = self.engine, self.parser
        skip_if_no_pandas_parser(parser)
        c = 1  # noqa
        df = DataFrame({'a': ['a', 'a', 'b', 'b', '@c', '@c']})
        result = df.query('a == "@c"', engine=engine, parser=parser)
        expected = df[df.a == "@c"]
        assert_frame_equal(result, expected)

    def test_query_undefined_local(self):
        from pandas.core.computation.ops import UndefinedVariableError
        engine, parser = self.engine, self.parser
        skip_if_no_pandas_parser(parser)
        df = DataFrame(np.random.rand(10, 2), columns=list('ab'))
        with tm.assert_raises_regex(UndefinedVariableError,
                                    "local variable 'c' is not defined"):
            df.query('a == @c', engine=engine, parser=parser)

    def test_index_resolvers_come_after_columns_with_the_same_name(self):
        n = 1  # noqa
        a = np.r_[20:101:20]

        df = DataFrame({'index': a, 'b': np.random.randn(a.size)})
        df.index.name = 'index'
        result = df.query('index > 5', engine=self.engine, parser=self.parser)
        expected = df[df['index'] > 5]
        assert_frame_equal(result, expected)

        df = DataFrame({'index': a,
                        'b': np.random.randn(a.size)})
        result = df.query('ilevel_0 > 5', engine=self.engine,
                          parser=self.parser)
        expected = df.loc[df.index[df.index > 5]]
        assert_frame_equal(result, expected)

        df = DataFrame({'a': a, 'b': np.random.randn(a.size)})
        df.index.name = 'a'
        result = df.query('a > 5', engine=self.engine, parser=self.parser)
        expected = df[df.a > 5]
        assert_frame_equal(result, expected)

        result = df.query('index > 5', engine=self.engine, parser=self.parser)
        expected = df.loc[df.index[df.index > 5]]
        assert_frame_equal(result, expected)

    def test_inf(self):
        n = 10
        df = DataFrame({'a': np.random.rand(n), 'b': np.random.rand(n)})
        df.loc[::2, 0] = np.inf
        ops = '==', '!='
        d = dict(zip(ops, (operator.eq, operator.ne)))
        for op, f in d.items():
            q = 'a %s inf' % op
            expected = df[f(df.a, np.inf)]
            result = df.query(q, engine=self.engine, parser=self.parser)
            assert_frame_equal(result, expected)


class TestDataFrameQueryNumExprPython(TestDataFrameQueryNumExprPandas):

    @classmethod
    def setup_class(cls):
        super(TestDataFrameQueryNumExprPython, cls).setup_class()
        cls.engine = 'numexpr'
        cls.parser = 'python'
        tm.skip_if_no_ne(cls.engine)
        cls.frame = TestData().frame

    def test_date_query_no_attribute_access(self):
        engine, parser = self.engine, self.parser
        df = DataFrame(randn(5, 3))
        df['dates1'] = date_range('1/1/2012', periods=5)
        df['dates2'] = date_range('1/1/2013', periods=5)
        df['dates3'] = date_range('1/1/2014', periods=5)
        res = df.query('(dates1 < 20130101) & (20130101 < dates3)',
                       engine=engine, parser=parser)
        expec = df[(df.dates1 < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_query_with_NaT(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates2'] = date_range('1/1/2013', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.loc[np.random.rand(n) > 0.5, 'dates1'] = pd.NaT
        df.loc[np.random.rand(n) > 0.5, 'dates3'] = pd.NaT
        res = df.query('(dates1 < 20130101) & (20130101 < dates3)',
                       engine=engine, parser=parser)
        expec = df[(df.dates1 < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_index_query(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.set_index('dates1', inplace=True, drop=True)
        res = df.query('(index < 20130101) & (20130101 < dates3)',
                       engine=engine, parser=parser)
        expec = df[(df.index < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_index_query_with_NaT(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.iloc[0, 0] = pd.NaT
        df.set_index('dates1', inplace=True, drop=True)
        res = df.query('(index < 20130101) & (20130101 < dates3)',
                       engine=engine, parser=parser)
        expec = df[(df.index < '20130101') & ('20130101' < df.dates3)]
        assert_frame_equal(res, expec)

    def test_date_index_query_with_NaT_duplicates(self):
        engine, parser = self.engine, self.parser
        n = 10
        df = DataFrame(randn(n, 3))
        df['dates1'] = date_range('1/1/2012', periods=n)
        df['dates3'] = date_range('1/1/2014', periods=n)
        df.loc[np.random.rand(n) > 0.5, 'dates1'] = pd.NaT
        df.set_index('dates1', inplace=True, drop=True)
        with pytest.raises(NotImplementedError):
            df.query('index < 20130101 < dates3', engine=engine, parser=parser)

    def test_nested_scope(self):
        from pandas.core.computation.ops import UndefinedVariableError
        engine = self.engine
        parser = self.parser
        # smoke test
        x = 1  # noqa
        result = pd.eval('x + 1', engine=engine, parser=parser)
        assert result == 2

        df = DataFrame(np.random.randn(5, 3))
        df2 = DataFrame(np.random.randn(5, 3))

        # don't have the pandas parser
        with pytest.raises(SyntaxError):
            df.query('(@df>0) & (@df2>0)', engine=engine, parser=parser)

        with pytest.raises(UndefinedVariableError):
            df.query('(df>0) & (df2>0)', engine=engine, parser=parser)

        expected = df[(df > 0) & (df2 > 0)]
        result = pd.eval('df[(df > 0) & (df2 > 0)]', engine=engine,
                         parser=parser)
        assert_frame_equal(expected, result)

        expected = df[(df > 0) & (df2 > 0) & (df[df > 0] > 0)]
        result = pd.eval('df[(df > 0) & (df2 > 0) & (df[df > 0] > 0)]',
                         engine=engine, parser=parser)
        assert_frame_equal(expected, result)


class TestDataFrameQueryPythonPandas(TestDataFrameQueryNumExprPandas):

    @classmethod
    def setup_class(cls):
        super(TestDataFrameQueryPythonPandas, cls).setup_class()
        cls.engine = 'python'
        cls.parser = 'pandas'
        cls.frame = TestData().frame

    def test_query_builtin(self):
        engine, parser = self.engine, self.parser

        n = m = 10
        df = DataFrame(np.random.randint(m, size=(n, 3)), columns=list('abc'))

        df.index.name = 'sin'
        expected = df[df.index > 5]
        result = df.query('sin > 5', engine=engine, parser=parser)
        assert_frame_equal(expected, result)


class TestDataFrameQueryPythonPython(TestDataFrameQueryNumExprPython):

    @classmethod
    def setup_class(cls):
        super(TestDataFrameQueryPythonPython, cls).setup_class()
        cls.engine = cls.parser = 'python'
        cls.frame = TestData().frame

    def test_query_builtin(self):
        engine, parser = self.engine, self.parser

        n = m = 10
        df = DataFrame(np.random.randint(m, size=(n, 3)), columns=list('abc'))

        df.index.name = 'sin'
        expected = df[df.index > 5]
        result = df.query('sin > 5', engine=engine, parser=parser)
        assert_frame_equal(expected, result)


class TestDataFrameQueryStrings(object):

    def test_str_query_method(self, parser, engine):
        tm.skip_if_no_ne(engine)
        df = DataFrame(randn(10, 1), columns=['b'])
        df['strings'] = Series(list('aabbccddee'))
        expect = df[df.strings == 'a']

        if parser != 'pandas':
            col = 'strings'
            lst = '"a"'

            lhs = [col] * 2 + [lst] * 2
            rhs = lhs[::-1]

            eq, ne = '==', '!='
            ops = 2 * ([eq] + [ne])

            for lhs, op, rhs in zip(lhs, ops, rhs):
                ex = '{lhs} {op} {rhs}'.format(lhs=lhs, op=op, rhs=rhs)
                pytest.raises(NotImplementedError, df.query, ex,
                              engine=engine, parser=parser,
                              local_dict={'strings': df.strings})
        else:
            res = df.query('"a" == strings', engine=engine, parser=parser)
            assert_frame_equal(res, expect)

            res = df.query('strings == "a"', engine=engine, parser=parser)
            assert_frame_equal(res, expect)
            assert_frame_equal(res, df[df.strings.isin(['a'])])

            expect = df[df.strings != 'a']
            res = df.query('strings != "a"', engine=engine, parser=parser)
            assert_frame_equal(res, expect)

            res = df.query('"a" != strings', engine=engine, parser=parser)
            assert_frame_equal(res, expect)
            assert_frame_equal(res, df[~df.strings.isin(['a'])])

    def test_str_list_query_method(self, parser, engine):
        tm.skip_if_no_ne(engine)
        df = DataFrame(randn(10, 1), columns=['b'])
        df['strings'] = Series(list('aabbccddee'))
        expect = df[df.strings.isin(['a', 'b'])]

        if parser != 'pandas':
            col = 'strings'
            lst = '["a", "b"]'

            lhs = [col] * 2 + [lst] * 2
            rhs = lhs[::-1]

            eq, ne = '==', '!='
            ops = 2 * ([eq] + [ne])

            for lhs, op, rhs in zip(lhs, ops, rhs):
                ex = '{lhs} {op} {rhs}'.format(lhs=lhs, op=op, rhs=rhs)
                with pytest.raises(NotImplementedError):
                    df.query(ex, engine=engine, parser=parser)
        else:
            res = df.query('strings == ["a", "b"]', engine=engine,
                           parser=parser)
            assert_frame_equal(res, expect)

            res = df.query('["a", "b"] == strings', engine=engine,
                           parser=parser)
            assert_frame_equal(res, expect)

            expect = df[~df.strings.isin(['a', 'b'])]

            res = df.query('strings != ["a", "b"]', engine=engine,
                           parser=parser)
            assert_frame_equal(res, expect)

            res = df.query('["a", "b"] != strings', engine=engine,
                           parser=parser)
            assert_frame_equal(res, expect)

    def test_query_with_string_columns(self, parser, engine):
        tm.skip_if_no_ne(engine)
        df = DataFrame({'a': list('aaaabbbbcccc'),
                        'b': list('aabbccddeeff'),
                        'c': np.random.randint(5, size=12),
                        'd': np.random.randint(9, size=12)})
        if parser == 'pandas':
            res = df.query('a in b', parser=parser, engine=engine)
            expec = df[df.a.isin(df.b)]
            assert_frame_equal(res, expec)

            res = df.query('a in b and c < d', parser=parser, engine=engine)
            expec = df[df.a.isin(df.b) & (df.c < df.d)]
            assert_frame_equal(res, expec)
        else:
            with pytest.raises(NotImplementedError):
                df.query('a in b', parser=parser, engine=engine)

            with pytest.raises(NotImplementedError):
                df.query('a in b and c < d', parser=parser, engine=engine)

    def test_object_array_eq_ne(self, parser, engine):
        tm.skip_if_no_ne(engine)
        df = DataFrame({'a': list('aaaabbbbcccc'),
                        'b': list('aabbccddeeff'),
                        'c': np.random.randint(5, size=12),
                        'd': np.random.randint(9, size=12)})
        res = df.query('a == b', parser=parser, engine=engine)
        exp = df[df.a == df.b]
        assert_frame_equal(res, exp)

        res = df.query('a != b', parser=parser, engine=engine)
        exp = df[df.a != df.b]
        assert_frame_equal(res, exp)

    def test_query_with_nested_strings(self, parser, engine):
        tm.skip_if_no_ne(engine)
        skip_if_no_pandas_parser(parser)
        raw = """id          event          timestamp
        1   "page 1 load"   1/1/2014 0:00:01
        1   "page 1 exit"   1/1/2014 0:00:31
        2   "page 2 load"   1/1/2014 0:01:01
        2   "page 2 exit"   1/1/2014 0:01:31
        3   "page 3 load"   1/1/2014 0:02:01
        3   "page 3 exit"   1/1/2014 0:02:31
        4   "page 1 load"   2/1/2014 1:00:01
        4   "page 1 exit"   2/1/2014 1:00:31
        5   "page 2 load"   2/1/2014 1:01:01
        5   "page 2 exit"   2/1/2014 1:01:31
        6   "page 3 load"   2/1/2014 1:02:01
        6   "page 3 exit"   2/1/2014 1:02:31
        """
        df = pd.read_csv(StringIO(raw), sep=r'\s{2,}', engine='python',
                         parse_dates=['timestamp'])
        expected = df[df.event == '"page 1 load"']
        res = df.query("""'"page 1 load"' in event""", parser=parser,
                       engine=engine)
        assert_frame_equal(expected, res)

    def test_query_with_nested_special_character(self, parser, engine):
        skip_if_no_pandas_parser(parser)
        tm.skip_if_no_ne(engine)
        df = DataFrame({'a': ['a', 'b', 'test & test'],
                        'b': [1, 2, 3]})
        res = df.query('a == "test & test"', parser=parser, engine=engine)
        expec = df[df.a == 'test & test']
        assert_frame_equal(res, expec)

    def test_query_lex_compare_strings(self, parser, engine):
        tm.skip_if_no_ne(engine=engine)
        import operator as opr

        a = Series(np.random.choice(list('abcde'), 20))
        b = Series(np.arange(a.size))
        df = DataFrame({'X': a, 'Y': b})

        ops = {'<': opr.lt, '>': opr.gt, '<=': opr.le, '>=': opr.ge}

        for op, func in ops.items():
            res = df.query('X %s "d"' % op, engine=engine, parser=parser)
            expected = df[func(df.X, 'd')]
            assert_frame_equal(res, expected)

    def test_query_single_element_booleans(self, parser, engine):
        tm.skip_if_no_ne(engine)
        columns = 'bid', 'bidsize', 'ask', 'asksize'
        data = np.random.randint(2, size=(1, len(columns))).astype(bool)
        df = DataFrame(data, columns=columns)
        res = df.query('bid & ask', engine=engine, parser=parser)
        expected = df[df.bid & df.ask]
        assert_frame_equal(res, expected)

    def test_query_string_scalar_variable(self, parser, engine):
        tm.skip_if_no_ne(engine)
        skip_if_no_pandas_parser(parser)
        df = pd.DataFrame({'Symbol': ['BUD US', 'BUD US', 'IBM US', 'IBM US'],
                           'Price': [109.70, 109.72, 183.30, 183.35]})
        e = df[df.Symbol == 'BUD US']
        symb = 'BUD US'  # noqa
        r = df.query('Symbol == @symb', parser=parser, engine=engine)
        assert_frame_equal(e, r)


class TestDataFrameEvalNumExprPandas(object):

    @classmethod
    def setup_class(cls):
        cls.engine = 'numexpr'
        cls.parser = 'pandas'
        tm.skip_if_no_ne()

    def setup_method(self, method):
        self.frame = DataFrame(randn(10, 3), columns=list('abc'))

    def teardown_method(self, method):
        del self.frame

    def test_simple_expr(self):
        res = self.frame.eval('a + b', engine=self.engine, parser=self.parser)
        expect = self.frame.a + self.frame.b
        assert_series_equal(res, expect)

    def test_bool_arith_expr(self):
        res = self.frame.eval('a[a < 1] + b', engine=self.engine,
                              parser=self.parser)
        expect = self.frame.a[self.frame.a < 1] + self.frame.b
        assert_series_equal(res, expect)

    def test_invalid_type_for_operator_raises(self):
        df = DataFrame({'a': [1, 2], 'b': ['c', 'd']})
        ops = '+', '-', '*', '/'
        for op in ops:
            with tm.assert_raises_regex(TypeError,
                                        "unsupported operand type\(s\) "
                                        "for .+: '.+' and '.+'"):
                df.eval('a {0} b'.format(op), engine=self.engine,
                        parser=self.parser)


class TestDataFrameEvalNumExprPython(TestDataFrameEvalNumExprPandas):

    @classmethod
    def setup_class(cls):
        super(TestDataFrameEvalNumExprPython, cls).setup_class()
        cls.engine = 'numexpr'
        cls.parser = 'python'
        tm.skip_if_no_ne(cls.engine)


class TestDataFrameEvalPythonPandas(TestDataFrameEvalNumExprPandas):

    @classmethod
    def setup_class(cls):
        super(TestDataFrameEvalPythonPandas, cls).setup_class()
        cls.engine = 'python'
        cls.parser = 'pandas'


class TestDataFrameEvalPythonPython(TestDataFrameEvalNumExprPython):

    @classmethod
    def setup_class(cls):
        cls.engine = cls.parser = 'python'
