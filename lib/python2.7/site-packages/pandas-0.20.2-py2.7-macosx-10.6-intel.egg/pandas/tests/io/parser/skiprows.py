# -*- coding: utf-8 -*-

"""
Tests that skipped rows are properly handled during
parsing for all of the parsers defined in parsers.py
"""

from datetime import datetime

import numpy as np

import pandas.util.testing as tm

from pandas import DataFrame
from pandas.errors import EmptyDataError
from pandas.compat import StringIO, range, lrange


class SkipRowsTests(object):

    def test_skiprows_bug(self):
        # see gh-505
        text = """#foo,a,b,c
#foo,a,b,c
#foo,a,b,c
#foo,a,b,c
#foo,a,b,c
#foo,a,b,c
1/1/2000,1.,2.,3.
1/2/2000,4,5,6
1/3/2000,7,8,9
"""
        data = self.read_csv(StringIO(text), skiprows=lrange(6), header=None,
                             index_col=0, parse_dates=True)

        data2 = self.read_csv(StringIO(text), skiprows=6, header=None,
                              index_col=0, parse_dates=True)

        expected = DataFrame(np.arange(1., 10.).reshape((3, 3)),
                             columns=[1, 2, 3],
                             index=[datetime(2000, 1, 1), datetime(2000, 1, 2),
                                    datetime(2000, 1, 3)])
        expected.index.name = 0
        tm.assert_frame_equal(data, expected)
        tm.assert_frame_equal(data, data2)

    def test_deep_skiprows(self):
        # see gh-4382
        text = "a,b,c\n" + \
               "\n".join([",".join([str(i), str(i + 1), str(i + 2)])
                          for i in range(10)])
        condensed_text = "a,b,c\n" + \
                         "\n".join([",".join([str(i), str(i + 1), str(i + 2)])
                                    for i in [0, 1, 2, 3, 4, 6, 8, 9]])
        data = self.read_csv(StringIO(text), skiprows=[6, 8])
        condensed_data = self.read_csv(StringIO(condensed_text))
        tm.assert_frame_equal(data, condensed_data)

    def test_skiprows_blank(self):
        # see gh-9832
        text = """#foo,a,b,c
#foo,a,b,c

#foo,a,b,c
#foo,a,b,c

1/1/2000,1.,2.,3.
1/2/2000,4,5,6
1/3/2000,7,8,9
"""
        data = self.read_csv(StringIO(text), skiprows=6, header=None,
                             index_col=0, parse_dates=True)

        expected = DataFrame(np.arange(1., 10.).reshape((3, 3)),
                             columns=[1, 2, 3],
                             index=[datetime(2000, 1, 1), datetime(2000, 1, 2),
                                    datetime(2000, 1, 3)])
        expected.index.name = 0
        tm.assert_frame_equal(data, expected)

    def test_skiprow_with_newline(self):
        # see gh-12775 and gh-10911
        data = """id,text,num_lines
1,"line 11
line 12",2
2,"line 21
line 22",2
3,"line 31",1"""
        expected = [[2, 'line 21\nline 22', 2],
                    [3, 'line 31', 1]]
        expected = DataFrame(expected, columns=[
            'id', 'text', 'num_lines'])
        df = self.read_csv(StringIO(data), skiprows=[1])
        tm.assert_frame_equal(df, expected)

        data = ('a,b,c\n~a\n b~,~e\n d~,'
                '~f\n f~\n1,2,~12\n 13\n 14~')
        expected = [['a\n b', 'e\n d', 'f\n f']]
        expected = DataFrame(expected, columns=[
            'a', 'b', 'c'])
        df = self.read_csv(StringIO(data),
                           quotechar="~",
                           skiprows=[2])
        tm.assert_frame_equal(df, expected)

        data = ('Text,url\n~example\n '
                'sentence\n one~,url1\n~'
                'example\n sentence\n two~,url2\n~'
                'example\n sentence\n three~,url3')
        expected = [['example\n sentence\n two', 'url2']]
        expected = DataFrame(expected, columns=[
            'Text', 'url'])
        df = self.read_csv(StringIO(data),
                           quotechar="~",
                           skiprows=[1, 3])
        tm.assert_frame_equal(df, expected)

    def test_skiprow_with_quote(self):
        # see gh-12775 and gh-10911
        data = """id,text,num_lines
1,"line '11' line 12",2
2,"line '21' line 22",2
3,"line '31' line 32",1"""
        expected = [[2, "line '21' line 22", 2],
                    [3, "line '31' line 32", 1]]
        expected = DataFrame(expected, columns=[
            'id', 'text', 'num_lines'])
        df = self.read_csv(StringIO(data), skiprows=[1])
        tm.assert_frame_equal(df, expected)

    def test_skiprow_with_newline_and_quote(self):
        # see gh-12775 and gh-10911
        data = """id,text,num_lines
1,"line \n'11' line 12",2
2,"line \n'21' line 22",2
3,"line \n'31' line 32",1"""
        expected = [[2, "line \n'21' line 22", 2],
                    [3, "line \n'31' line 32", 1]]
        expected = DataFrame(expected, columns=[
            'id', 'text', 'num_lines'])
        df = self.read_csv(StringIO(data), skiprows=[1])
        tm.assert_frame_equal(df, expected)

        data = """id,text,num_lines
1,"line '11\n' line 12",2
2,"line '21\n' line 22",2
3,"line '31\n' line 32",1"""
        expected = [[2, "line '21\n' line 22", 2],
                    [3, "line '31\n' line 32", 1]]
        expected = DataFrame(expected, columns=[
            'id', 'text', 'num_lines'])
        df = self.read_csv(StringIO(data), skiprows=[1])
        tm.assert_frame_equal(df, expected)

        data = """id,text,num_lines
1,"line '11\n' \r\tline 12",2
2,"line '21\n' \r\tline 22",2
3,"line '31\n' \r\tline 32",1"""
        expected = [[2, "line '21\n' \r\tline 22", 2],
                    [3, "line '31\n' \r\tline 32", 1]]
        expected = DataFrame(expected, columns=[
            'id', 'text', 'num_lines'])
        df = self.read_csv(StringIO(data), skiprows=[1])
        tm.assert_frame_equal(df, expected)

    def test_skiprows_lineterminator(self):
        # see gh-9079
        data = '\n'.join(['SMOSMANIA ThetaProbe-ML2X ',
                          '2007/01/01 01:00   0.2140 U M ',
                          '2007/01/01 02:00   0.2141 M O ',
                          '2007/01/01 04:00   0.2142 D M '])
        expected = DataFrame([['2007/01/01', '01:00', 0.2140, 'U', 'M'],
                              ['2007/01/01', '02:00', 0.2141, 'M', 'O'],
                              ['2007/01/01', '04:00', 0.2142, 'D', 'M']],
                             columns=['date', 'time', 'var', 'flag',
                                      'oflag'])

        # test with default line terminators "LF" and "CRLF"
        df = self.read_csv(StringIO(data), skiprows=1, delim_whitespace=True,
                           names=['date', 'time', 'var', 'flag', 'oflag'])
        tm.assert_frame_equal(df, expected)

        df = self.read_csv(StringIO(data.replace('\n', '\r\n')),
                           skiprows=1, delim_whitespace=True,
                           names=['date', 'time', 'var', 'flag', 'oflag'])
        tm.assert_frame_equal(df, expected)

        # "CR" is not respected with the Python parser yet
        if self.engine == 'c':
            df = self.read_csv(StringIO(data.replace('\n', '\r')),
                               skiprows=1, delim_whitespace=True,
                               names=['date', 'time', 'var', 'flag', 'oflag'])
            tm.assert_frame_equal(df, expected)

    def test_skiprows_infield_quote(self):
        # see gh-14459
        data = 'a"\nb"\na\n1'
        expected = DataFrame({'a': [1]})

        df = self.read_csv(StringIO(data), skiprows=2)
        tm.assert_frame_equal(df, expected)

    def test_skiprows_callable(self):
        data = 'a\n1\n2\n3\n4\n5'

        skiprows = lambda x: x % 2 == 0
        expected = DataFrame({'1': [3, 5]})
        df = self.read_csv(StringIO(data), skiprows=skiprows)
        tm.assert_frame_equal(df, expected)

        expected = DataFrame({'foo': [3, 5]})
        df = self.read_csv(StringIO(data), skiprows=skiprows,
                           header=0, names=['foo'])
        tm.assert_frame_equal(df, expected)

        skiprows = lambda x: True
        msg = "No columns to parse from file"
        with tm.assert_raises_regex(EmptyDataError, msg):
            self.read_csv(StringIO(data), skiprows=skiprows)

        # This is a bad callable and should raise.
        msg = "by zero"
        skiprows = lambda x: 1 / 0
        with tm.assert_raises_regex(ZeroDivisionError, msg):
            self.read_csv(StringIO(data), skiprows=skiprows)
