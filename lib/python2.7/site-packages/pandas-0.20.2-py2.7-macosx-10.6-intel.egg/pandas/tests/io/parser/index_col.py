# -*- coding: utf-8 -*-

"""
Tests that the specified index column (a.k.a 'index_col')
is properly handled or inferred during parsing for all of
the parsers defined in parsers.py
"""

import pytest

import pandas.util.testing as tm

from pandas import DataFrame, Index, MultiIndex
from pandas.compat import StringIO


class IndexColTests(object):

    def test_index_col_named(self):
        no_header = """\
KORD1,19990127, 19:00:00, 18:56:00, 0.8100, 2.8100, 7.2000, 0.0000, 280.0000
KORD2,19990127, 20:00:00, 19:56:00, 0.0100, 2.2100, 7.2000, 0.0000, 260.0000
KORD3,19990127, 21:00:00, 20:56:00, -0.5900, 2.2100, 5.7000, 0.0000, 280.0000
KORD4,19990127, 21:00:00, 21:18:00, -0.9900, 2.0100, 3.6000, 0.0000, 270.0000
KORD5,19990127, 22:00:00, 21:56:00, -0.5900, 1.7100, 5.1000, 0.0000, 290.0000
KORD6,19990127, 23:00:00, 22:56:00, -0.5900, 1.7100, 4.6000, 0.0000, 280.0000"""  # noqa

        h = "ID,date,NominalTime,ActualTime,TDew,TAir,Windspeed,Precip,WindDir\n"  # noqa
        data = h + no_header
        rs = self.read_csv(StringIO(data), index_col='ID')
        xp = self.read_csv(StringIO(data), header=0).set_index('ID')
        tm.assert_frame_equal(rs, xp)

        pytest.raises(ValueError, self.read_csv, StringIO(no_header),
                      index_col='ID')

        data = """\
1,2,3,4,hello
5,6,7,8,world
9,10,11,12,foo
"""
        names = ['a', 'b', 'c', 'd', 'message']
        xp = DataFrame({'a': [1, 5, 9], 'b': [2, 6, 10], 'c': [3, 7, 11],
                        'd': [4, 8, 12]},
                       index=Index(['hello', 'world', 'foo'], name='message'))
        rs = self.read_csv(StringIO(data), names=names, index_col=['message'])
        tm.assert_frame_equal(xp, rs)
        assert xp.index.name == rs.index.name

        rs = self.read_csv(StringIO(data), names=names, index_col='message')
        tm.assert_frame_equal(xp, rs)
        assert xp.index.name == rs.index.name

    def test_index_col_is_true(self):
        # see gh-9798
        pytest.raises(ValueError, self.read_csv,
                      StringIO(self.ts_data), index_col=True)

    def test_infer_index_col(self):
        data = """A,B,C
foo,1,2,3
bar,4,5,6
baz,7,8,9
"""
        data = self.read_csv(StringIO(data))
        assert data.index.equals(Index(['foo', 'bar', 'baz']))

    def test_empty_index_col_scenarios(self):
        data = 'x,y,z'

        # None, no index
        index_col, expected = None, DataFrame([], columns=list('xyz')),
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col), expected)

        # False, no index
        index_col, expected = False, DataFrame([], columns=list('xyz')),
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col), expected)

        # int, first column
        index_col, expected = 0, DataFrame(
            [], columns=['y', 'z'], index=Index([], name='x'))
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col), expected)

        # int, not first column
        index_col, expected = 1, DataFrame(
            [], columns=['x', 'z'], index=Index([], name='y'))
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col), expected)

        # str, first column
        index_col, expected = 'x', DataFrame(
            [], columns=['y', 'z'], index=Index([], name='x'))
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col), expected)

        # str, not the first column
        index_col, expected = 'y', DataFrame(
            [], columns=['x', 'z'], index=Index([], name='y'))
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col), expected)

        # list of int
        index_col, expected = [0, 1], DataFrame(
            [], columns=['z'], index=MultiIndex.from_arrays(
                [[]] * 2, names=['x', 'y']))
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col),
            expected, check_index_type=False)

        # list of str
        index_col = ['x', 'y']
        expected = DataFrame([], columns=['z'],
                             index=MultiIndex.from_arrays(
                                 [[]] * 2, names=['x', 'y']))
        tm.assert_frame_equal(self.read_csv(StringIO(
            data), index_col=index_col),
            expected, check_index_type=False)

        # list of int, reversed sequence
        index_col = [1, 0]
        expected = DataFrame([], columns=['z'], index=MultiIndex.from_arrays(
            [[]] * 2, names=['y', 'x']))
        tm.assert_frame_equal(self.read_csv(
            StringIO(data), index_col=index_col),
            expected, check_index_type=False)

        # list of str, reversed sequence
        index_col = ['y', 'x']
        expected = DataFrame([], columns=['z'], index=MultiIndex.from_arrays(
            [[]] * 2, names=['y', 'x']))
        tm.assert_frame_equal(self.read_csv(StringIO(
            data), index_col=index_col),
            expected, check_index_type=False)

    def test_empty_with_index_col_false(self):
        # see gh-10413
        data = 'x,y'
        result = self.read_csv(StringIO(data), index_col=False)
        expected = DataFrame([], columns=['x', 'y'])
        tm.assert_frame_equal(result, expected)
