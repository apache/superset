# -*- coding: utf-8 -*-

"""
Tests the usecols functionality during parsing
for all of the parsers defined in parsers.py
"""

import pytest

import numpy as np
import pandas.util.testing as tm

from pandas import DataFrame, Index
from pandas._libs.lib import Timestamp
from pandas.compat import StringIO


class UsecolsTests(object):

    def test_raise_on_mixed_dtype_usecols(self):
        # See gh-12678
        data = """a,b,c
        1000,2000,3000
        4000,5000,6000
        """

        msg = ("'usecols' must either be all strings, all unicode, "
               "all integers or a callable")
        usecols = [0, 'b', 2]

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), usecols=usecols)

    def test_usecols(self):
        data = """\
a,b,c
1,2,3
4,5,6
7,8,9
10,11,12"""

        result = self.read_csv(StringIO(data), usecols=(1, 2))
        result2 = self.read_csv(StringIO(data), usecols=('b', 'c'))
        exp = self.read_csv(StringIO(data))

        assert len(result.columns) == 2
        assert (result['b'] == exp['b']).all()
        assert (result['c'] == exp['c']).all()

        tm.assert_frame_equal(result, result2)

        result = self.read_csv(StringIO(data), usecols=[1, 2], header=0,
                               names=['foo', 'bar'])
        expected = self.read_csv(StringIO(data), usecols=[1, 2])
        expected.columns = ['foo', 'bar']
        tm.assert_frame_equal(result, expected)

        data = """\
1,2,3
4,5,6
7,8,9
10,11,12"""
        result = self.read_csv(StringIO(data), names=['b', 'c'],
                               header=None, usecols=[1, 2])

        expected = self.read_csv(StringIO(data), names=['a', 'b', 'c'],
                                 header=None)
        expected = expected[['b', 'c']]
        tm.assert_frame_equal(result, expected)

        result2 = self.read_csv(StringIO(data), names=['a', 'b', 'c'],
                                header=None, usecols=['b', 'c'])
        tm.assert_frame_equal(result2, result)

        # see gh-5766
        result = self.read_csv(StringIO(data), names=['a', 'b'],
                               header=None, usecols=[0, 1])

        expected = self.read_csv(StringIO(data), names=['a', 'b', 'c'],
                                 header=None)
        expected = expected[['a', 'b']]
        tm.assert_frame_equal(result, expected)

        # length conflict, passed names and usecols disagree
        pytest.raises(ValueError, self.read_csv, StringIO(data),
                      names=['a', 'b'], usecols=[1], header=None)

    def test_usecols_index_col_False(self):
        # see gh-9082
        s = "a,b,c,d\n1,2,3,4\n5,6,7,8"
        s_malformed = "a,b,c,d\n1,2,3,4,\n5,6,7,8,"
        cols = ['a', 'c', 'd']
        expected = DataFrame({'a': [1, 5], 'c': [3, 7], 'd': [4, 8]})
        df = self.read_csv(StringIO(s), usecols=cols, index_col=False)
        tm.assert_frame_equal(expected, df)
        df = self.read_csv(StringIO(s_malformed),
                           usecols=cols, index_col=False)
        tm.assert_frame_equal(expected, df)

    def test_usecols_index_col_conflict(self):
        # see gh-4201: test that index_col as integer reflects usecols
        data = 'a,b,c,d\nA,a,1,one\nB,b,2,two'
        expected = DataFrame({'c': [1, 2]}, index=Index(
            ['a', 'b'], name='b'))

        df = self.read_csv(StringIO(data), usecols=['b', 'c'],
                           index_col=0)
        tm.assert_frame_equal(expected, df)

        df = self.read_csv(StringIO(data), usecols=['b', 'c'],
                           index_col='b')
        tm.assert_frame_equal(expected, df)

        df = self.read_csv(StringIO(data), usecols=[1, 2],
                           index_col='b')
        tm.assert_frame_equal(expected, df)

        df = self.read_csv(StringIO(data), usecols=[1, 2],
                           index_col=0)
        tm.assert_frame_equal(expected, df)

        expected = DataFrame(
            {'b': ['a', 'b'], 'c': [1, 2], 'd': ('one', 'two')})
        expected = expected.set_index(['b', 'c'])
        df = self.read_csv(StringIO(data), usecols=['b', 'c', 'd'],
                           index_col=['b', 'c'])
        tm.assert_frame_equal(expected, df)

    def test_usecols_implicit_index_col(self):
        # see gh-2654
        data = 'a,b,c\n4,apple,bat,5.7\n8,orange,cow,10'

        result = self.read_csv(StringIO(data), usecols=['a', 'b'])
        expected = DataFrame({'a': ['apple', 'orange'],
                              'b': ['bat', 'cow']}, index=[4, 8])

        tm.assert_frame_equal(result, expected)

    def test_usecols_regex_sep(self):
        # see gh-2733
        data = 'a  b  c\n4  apple  bat  5.7\n8  orange  cow  10'

        df = self.read_csv(StringIO(data), sep=r'\s+', usecols=('a', 'b'))

        expected = DataFrame({'a': ['apple', 'orange'],
                              'b': ['bat', 'cow']}, index=[4, 8])
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_whitespace(self):
        data = 'a  b  c\n4  apple  bat  5.7\n8  orange  cow  10'

        result = self.read_csv(StringIO(data), delim_whitespace=True,
                               usecols=('a', 'b'))
        expected = DataFrame({'a': ['apple', 'orange'],
                              'b': ['bat', 'cow']}, index=[4, 8])

        tm.assert_frame_equal(result, expected)

    def test_usecols_with_integer_like_header(self):
        data = """2,0,1
        1000,2000,3000
        4000,5000,6000
        """

        usecols = [0, 1]  # column selection by index
        expected = DataFrame(data=[[1000, 2000],
                                   [4000, 5000]],
                             columns=['2', '0'])
        df = self.read_csv(StringIO(data), usecols=usecols)
        tm.assert_frame_equal(df, expected)

        usecols = ['0', '1']  # column selection by name
        expected = DataFrame(data=[[2000, 3000],
                                   [5000, 6000]],
                             columns=['0', '1'])
        df = self.read_csv(StringIO(data), usecols=usecols)
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_parse_dates(self):
        # See gh-9755
        s = """a,b,c,d,e
        0,1,20140101,0900,4
        0,1,20140102,1000,4"""
        parse_dates = [[1, 2]]

        cols = {
            'a': [0, 0],
            'c_d': [
                Timestamp('2014-01-01 09:00:00'),
                Timestamp('2014-01-02 10:00:00')
            ]
        }
        expected = DataFrame(cols, columns=['c_d', 'a'])

        df = self.read_csv(StringIO(s), usecols=[0, 2, 3],
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

        df = self.read_csv(StringIO(s), usecols=[3, 0, 2],
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

        # See gh-13604
        s = """2008-02-07 09:40,1032.43
        2008-02-07 09:50,1042.54
        2008-02-07 10:00,1051.65
        """
        parse_dates = [0]
        names = ['date', 'values']
        usecols = names[:]

        index = Index([Timestamp('2008-02-07 09:40'),
                       Timestamp('2008-02-07 09:50'),
                       Timestamp('2008-02-07 10:00')],
                      name='date')
        cols = {'values': [1032.43, 1042.54, 1051.65]}
        expected = DataFrame(cols, index=index)

        df = self.read_csv(StringIO(s), parse_dates=parse_dates, index_col=0,
                           usecols=usecols, header=None, names=names)
        tm.assert_frame_equal(df, expected)

        # See gh-14792
        s = """a,b,c,d,e,f,g,h,i,j
        2016/09/21,1,1,2,3,4,5,6,7,8"""
        parse_dates = [0]
        usecols = list('abcdefghij')
        cols = {'a': Timestamp('2016-09-21'),
                'b': [1], 'c': [1], 'd': [2],
                'e': [3], 'f': [4], 'g': [5],
                'h': [6], 'i': [7], 'j': [8]}
        expected = DataFrame(cols, columns=usecols)
        df = self.read_csv(StringIO(s), usecols=usecols,
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

        s = """a,b,c,d,e,f,g,h,i,j\n2016/09/21,1,1,2,3,4,5,6,7,8"""
        parse_dates = [[0, 1]]
        usecols = list('abcdefghij')
        cols = {'a_b': '2016/09/21 1',
                'c': [1], 'd': [2], 'e': [3], 'f': [4],
                'g': [5], 'h': [6], 'i': [7], 'j': [8]}
        expected = DataFrame(cols, columns=['a_b'] + list('cdefghij'))
        df = self.read_csv(StringIO(s), usecols=usecols,
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_parse_dates_and_full_names(self):
        # See gh-9755
        s = """0,1,20140101,0900,4
        0,1,20140102,1000,4"""
        parse_dates = [[1, 2]]
        names = list('abcde')

        cols = {
            'a': [0, 0],
            'c_d': [
                Timestamp('2014-01-01 09:00:00'),
                Timestamp('2014-01-02 10:00:00')
            ]
        }
        expected = DataFrame(cols, columns=['c_d', 'a'])

        df = self.read_csv(StringIO(s), names=names,
                           usecols=[0, 2, 3],
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

        df = self.read_csv(StringIO(s), names=names,
                           usecols=[3, 0, 2],
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_parse_dates_and_usecol_names(self):
        # See gh-9755
        s = """0,1,20140101,0900,4
        0,1,20140102,1000,4"""
        parse_dates = [[1, 2]]
        names = list('acd')

        cols = {
            'a': [0, 0],
            'c_d': [
                Timestamp('2014-01-01 09:00:00'),
                Timestamp('2014-01-02 10:00:00')
            ]
        }
        expected = DataFrame(cols, columns=['c_d', 'a'])

        df = self.read_csv(StringIO(s), names=names,
                           usecols=[0, 2, 3],
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

        df = self.read_csv(StringIO(s), names=names,
                           usecols=[3, 0, 2],
                           parse_dates=parse_dates)
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_unicode_strings(self):
        # see gh-13219

        s = '''AAA,BBB,CCC,DDD
        0.056674973,8,True,a
        2.613230982,2,False,b
        3.568935038,7,False,a
        '''

        data = {
            'AAA': {
                0: 0.056674972999999997,
                1: 2.6132309819999997,
                2: 3.5689350380000002
            },
            'BBB': {0: 8, 1: 2, 2: 7}
        }
        expected = DataFrame(data)

        df = self.read_csv(StringIO(s), usecols=[u'AAA', u'BBB'])
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_single_byte_unicode_strings(self):
        # see gh-13219

        s = '''A,B,C,D
        0.056674973,8,True,a
        2.613230982,2,False,b
        3.568935038,7,False,a
        '''

        data = {
            'A': {
                0: 0.056674972999999997,
                1: 2.6132309819999997,
                2: 3.5689350380000002
            },
            'B': {0: 8, 1: 2, 2: 7}
        }
        expected = DataFrame(data)

        df = self.read_csv(StringIO(s), usecols=[u'A', u'B'])
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_mixed_encoding_strings(self):
        s = '''AAA,BBB,CCC,DDD
        0.056674973,8,True,a
        2.613230982,2,False,b
        3.568935038,7,False,a
        '''

        msg = ("'usecols' must either be all strings, all unicode, "
               "all integers or a callable")

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(s), usecols=[u'AAA', b'BBB'])

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(s), usecols=[b'AAA', u'BBB'])

    def test_usecols_with_multibyte_characters(self):
        s = '''あああ,いい,ううう,ええええ
        0.056674973,8,True,a
        2.613230982,2,False,b
        3.568935038,7,False,a
        '''
        data = {
            'あああ': {
                0: 0.056674972999999997,
                1: 2.6132309819999997,
                2: 3.5689350380000002
            },
            'いい': {0: 8, 1: 2, 2: 7}
        }
        expected = DataFrame(data)

        df = self.read_csv(StringIO(s), usecols=['あああ', 'いい'])
        tm.assert_frame_equal(df, expected)

    def test_usecols_with_multibyte_unicode_characters(self):
        pytest.skip('TODO: see gh-13253')

        s = '''あああ,いい,ううう,ええええ
        0.056674973,8,True,a
        2.613230982,2,False,b
        3.568935038,7,False,a
        '''
        data = {
            'あああ': {
                0: 0.056674972999999997,
                1: 2.6132309819999997,
                2: 3.5689350380000002
            },
            'いい': {0: 8, 1: 2, 2: 7}
        }
        expected = DataFrame(data)

        df = self.read_csv(StringIO(s), usecols=[u'あああ', u'いい'])
        tm.assert_frame_equal(df, expected)

    def test_empty_usecols(self):
        # should not raise
        data = 'a,b,c\n1,2,3\n4,5,6'
        expected = DataFrame()
        result = self.read_csv(StringIO(data), usecols=set([]))
        tm.assert_frame_equal(result, expected)

    def test_np_array_usecols(self):
        # See gh-12546
        data = 'a,b,c\n1,2,3'
        usecols = np.array(['a', 'b'])

        expected = DataFrame([[1, 2]], columns=usecols)
        result = self.read_csv(StringIO(data), usecols=usecols)
        tm.assert_frame_equal(result, expected)

    def test_callable_usecols(self):
        # See gh-14154
        s = '''AaA,bBb,CCC,ddd
        0.056674973,8,True,a
        2.613230982,2,False,b
        3.568935038,7,False,a
        '''

        data = {
            'AaA': {
                0: 0.056674972999999997,
                1: 2.6132309819999997,
                2: 3.5689350380000002
            },
            'bBb': {0: 8, 1: 2, 2: 7},
            'ddd': {0: 'a', 1: 'b', 2: 'a'}
        }
        expected = DataFrame(data)
        df = self.read_csv(StringIO(s), usecols=lambda x:
                           x.upper() in ['AAA', 'BBB', 'DDD'])
        tm.assert_frame_equal(df, expected)

        # Check that a callable returning only False returns
        # an empty DataFrame
        expected = DataFrame()
        df = self.read_csv(StringIO(s), usecols=lambda x: False)
        tm.assert_frame_equal(df, expected)

    def test_incomplete_first_row(self):
        # see gh-6710
        data = '1,2\n1,2,3'
        names = ['a', 'b', 'c']
        expected = DataFrame({'a': [1, 1],
                              'c': [np.nan, 3]})

        usecols = ['a', 'c']
        df = self.read_csv(StringIO(data), names=names, usecols=usecols)
        tm.assert_frame_equal(df, expected)

        usecols = lambda x: x in ['a', 'c']
        df = self.read_csv(StringIO(data), names=names, usecols=usecols)
        tm.assert_frame_equal(df, expected)

    def test_uneven_length_cols(self):
        # see gh-8985
        usecols = [0, 1, 2]
        data = '19,29,39\n' * 2 + '10,20,30,40'
        expected = DataFrame([[19, 29, 39],
                              [19, 29, 39],
                              [10, 20, 30]])
        df = self.read_csv(StringIO(data), header=None, usecols=usecols)
        tm.assert_frame_equal(df, expected)

        # see gh-9549
        usecols = ['A', 'B', 'C']
        data = ('A,B,C\n1,2,3\n3,4,5\n1,2,4,5,1,6\n'
                '1,2,3,,,1,\n1,2,3\n5,6,7')
        expected = DataFrame({'A': [1, 3, 1, 1, 1, 5],
                              'B': [2, 4, 2, 2, 2, 6],
                              'C': [3, 5, 4, 3, 3, 7]})
        df = self.read_csv(StringIO(data), usecols=usecols)
        tm.assert_frame_equal(df, expected)

    def test_raise_on_usecols_names_mismatch(self):
        # GH 14671
        data = 'a,b,c,d\n1,2,3,4\n5,6,7,8'

        if self.engine == 'c':
            msg = 'Usecols do not match names'
        else:
            msg = 'is not in list'

        usecols = ['a', 'b', 'c', 'd']
        df = self.read_csv(StringIO(data), usecols=usecols)
        expected = DataFrame({'a': [1, 5], 'b': [2, 6], 'c': [3, 7],
                              'd': [4, 8]})
        tm.assert_frame_equal(df, expected)

        usecols = ['a', 'b', 'c', 'f']
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), usecols=usecols)

        usecols = ['a', 'b', 'f']
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), usecols=usecols)

        names = ['A', 'B', 'C', 'D']

        df = self.read_csv(StringIO(data), header=0, names=names)
        expected = DataFrame({'A': [1, 5], 'B': [2, 6], 'C': [3, 7],
                              'D': [4, 8]})
        tm.assert_frame_equal(df, expected)

        # TODO: https://github.com/pandas-dev/pandas/issues/16469
        # usecols = ['A','C']
        # df = self.read_csv(StringIO(data), header=0, names=names,
        #                    usecols=usecols)
        # expected = DataFrame({'A': [1,5], 'C': [3,7]})
        # tm.assert_frame_equal(df, expected)
        #
        # usecols = [0,2]
        # df = self.read_csv(StringIO(data), header=0, names=names,
        #                    usecols=usecols)
        # expected = DataFrame({'A': [1,5], 'C': [3,7]})
        # tm.assert_frame_equal(df, expected)

        usecols = ['A', 'B', 'C', 'f']
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), header=0, names=names,
                          usecols=usecols)
        usecols = ['A', 'B', 'f']
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), names=names, usecols=usecols)
