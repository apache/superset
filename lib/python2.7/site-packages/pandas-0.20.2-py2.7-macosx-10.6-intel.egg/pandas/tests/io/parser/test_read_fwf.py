# -*- coding: utf-8 -*-

"""
Tests the 'read_fwf' function in parsers.py. This
test suite is independent of the others because the
engine is set to 'python-fwf' internally.
"""

from datetime import datetime

import pytest
import numpy as np
import pandas as pd
import pandas.util.testing as tm

from pandas import DataFrame
from pandas import compat
from pandas.compat import StringIO, BytesIO
from pandas.io.parsers import read_csv, read_fwf, EmptyDataError


class TestFwfParsing(object):

    def test_fwf(self):
        data_expected = """\
2011,58,360.242940,149.910199,11950.7
2011,59,444.953632,166.985655,11788.4
2011,60,364.136849,183.628767,11806.2
2011,61,413.836124,184.375703,11916.8
2011,62,502.953953,173.237159,12468.3
"""
        expected = read_csv(StringIO(data_expected),
                            engine='python', header=None)

        data1 = """\
201158    360.242940   149.910199   11950.7
201159    444.953632   166.985655   11788.4
201160    364.136849   183.628767   11806.2
201161    413.836124   184.375703   11916.8
201162    502.953953   173.237159   12468.3
"""
        colspecs = [(0, 4), (4, 8), (8, 20), (21, 33), (34, 43)]
        df = read_fwf(StringIO(data1), colspecs=colspecs, header=None)
        tm.assert_frame_equal(df, expected)

        data2 = """\
2011 58   360.242940   149.910199   11950.7
2011 59   444.953632   166.985655   11788.4
2011 60   364.136849   183.628767   11806.2
2011 61   413.836124   184.375703   11916.8
2011 62   502.953953   173.237159   12468.3
"""
        df = read_fwf(StringIO(data2), widths=[5, 5, 13, 13, 7], header=None)
        tm.assert_frame_equal(df, expected)

        # From Thomas Kluyver: apparently some non-space filler characters can
        # be seen, this is supported by specifying the 'delimiter' character:
        # http://publib.boulder.ibm.com/infocenter/dmndhelp/v6r1mx/index.jsp?topic=/com.ibm.wbit.612.help.config.doc/topics/rfixwidth.html
        data3 = """\
201158~~~~360.242940~~~149.910199~~~11950.7
201159~~~~444.953632~~~166.985655~~~11788.4
201160~~~~364.136849~~~183.628767~~~11806.2
201161~~~~413.836124~~~184.375703~~~11916.8
201162~~~~502.953953~~~173.237159~~~12468.3
"""
        df = read_fwf(
            StringIO(data3), colspecs=colspecs, delimiter='~', header=None)
        tm.assert_frame_equal(df, expected)

        with tm.assert_raises_regex(ValueError,
                                    "must specify only one of"):
            read_fwf(StringIO(data3), colspecs=colspecs, widths=[6, 10, 10, 7])

        with tm.assert_raises_regex(ValueError, "Must specify either"):
            read_fwf(StringIO(data3), colspecs=None, widths=None)

    def test_BytesIO_input(self):
        if not compat.PY3:
            pytest.skip(
                "Bytes-related test - only needs to work on Python 3")

        result = read_fwf(BytesIO("שלום\nשלום".encode('utf8')), widths=[
            2, 2], encoding='utf8')
        expected = DataFrame([["של", "ום"]], columns=["של", "ום"])
        tm.assert_frame_equal(result, expected)

    def test_fwf_colspecs_is_list_or_tuple(self):
        data = """index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
qux,12,13,14,15
foo2,12,13,14,15
bar2,12,13,14,15
"""

        with tm.assert_raises_regex(TypeError,
                                    'column specifications must '
                                    'be a list or tuple.+'):
            pd.io.parsers.FixedWidthReader(StringIO(data),
                                           {'a': 1}, ',', '#')

    def test_fwf_colspecs_is_list_or_tuple_of_two_element_tuples(self):
        data = """index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
qux,12,13,14,15
foo2,12,13,14,15
bar2,12,13,14,15
"""

        with tm.assert_raises_regex(TypeError,
                                    'Each column specification '
                                    'must be.+'):
            read_fwf(StringIO(data), [('a', 1)])

    def test_fwf_colspecs_None(self):
        # GH 7079
        data = """\
123456
456789
"""
        colspecs = [(0, 3), (3, None)]
        result = read_fwf(StringIO(data), colspecs=colspecs, header=None)
        expected = DataFrame([[123, 456], [456, 789]])
        tm.assert_frame_equal(result, expected)

        colspecs = [(None, 3), (3, 6)]
        result = read_fwf(StringIO(data), colspecs=colspecs, header=None)
        expected = DataFrame([[123, 456], [456, 789]])
        tm.assert_frame_equal(result, expected)

        colspecs = [(0, None), (3, None)]
        result = read_fwf(StringIO(data), colspecs=colspecs, header=None)
        expected = DataFrame([[123456, 456], [456789, 789]])
        tm.assert_frame_equal(result, expected)

        colspecs = [(None, None), (3, 6)]
        result = read_fwf(StringIO(data), colspecs=colspecs, header=None)
        expected = DataFrame([[123456, 456], [456789, 789]])
        tm.assert_frame_equal(result, expected)

    def test_fwf_regression(self):
        # GH 3594
        # turns out 'T060' is parsable as a datetime slice!

        tzlist = [1, 10, 20, 30, 60, 80, 100]
        ntz = len(tzlist)
        tcolspecs = [16] + [8] * ntz
        tcolnames = ['SST'] + ["T%03d" % z for z in tzlist[1:]]
        data = """  2009164202000   9.5403  9.4105  8.6571  7.8372  6.0612  5.8843  5.5192
  2009164203000   9.5435  9.2010  8.6167  7.8176  6.0804  5.8728  5.4869
  2009164204000   9.5873  9.1326  8.4694  7.5889  6.0422  5.8526  5.4657
  2009164205000   9.5810  9.0896  8.4009  7.4652  6.0322  5.8189  5.4379
  2009164210000   9.6034  9.0897  8.3822  7.4905  6.0908  5.7904  5.4039
"""

        df = read_fwf(StringIO(data),
                      index_col=0,
                      header=None,
                      names=tcolnames,
                      widths=tcolspecs,
                      parse_dates=True,
                      date_parser=lambda s: datetime.strptime(s, '%Y%j%H%M%S'))

        for c in df.columns:
            res = df.loc[:, c]
            assert len(res)

    def test_fwf_for_uint8(self):
        data = """1421302965.213420    PRI=3 PGN=0xef00      DST=0x17 SRC=0x28    04 154 00 00 00 00 00 127
1421302964.226776    PRI=6 PGN=0xf002               SRC=0x47    243 00 00 255 247 00 00 71"""  # noqa
        df = read_fwf(StringIO(data),
                      colspecs=[(0, 17), (25, 26), (33, 37),
                                (49, 51), (58, 62), (63, 1000)],
                      names=['time', 'pri', 'pgn', 'dst', 'src', 'data'],
                      converters={
                          'pgn': lambda x: int(x, 16),
                          'src': lambda x: int(x, 16),
                          'dst': lambda x: int(x, 16),
                          'data': lambda x: len(x.split(' '))})

        expected = DataFrame([[1421302965.213420, 3, 61184, 23, 40, 8],
                              [1421302964.226776, 6, 61442, None, 71, 8]],
                             columns=["time", "pri", "pgn",
                                      "dst", "src", "data"])
        expected["dst"] = expected["dst"].astype(object)

        tm.assert_frame_equal(df, expected)

    def test_fwf_compression(self):
        try:
            import gzip
            import bz2
        except ImportError:
            pytest.skip("Need gzip and bz2 to run this test")

        data = """1111111111
        2222222222
        3333333333""".strip()
        widths = [5, 5]
        names = ['one', 'two']
        expected = read_fwf(StringIO(data), widths=widths, names=names)
        if compat.PY3:
            data = bytes(data, encoding='utf-8')
        comps = [('gzip', gzip.GzipFile), ('bz2', bz2.BZ2File)]
        for comp_name, compresser in comps:
            with tm.ensure_clean() as path:
                tmp = compresser(path, mode='wb')
                tmp.write(data)
                tmp.close()
                result = read_fwf(path, widths=widths, names=names,
                                  compression=comp_name)
                tm.assert_frame_equal(result, expected)

    def test_comment_fwf(self):
        data = """
  1   2.   4  #hello world
  5  NaN  10.0
"""
        expected = np.array([[1, 2., 4],
                             [5, np.nan, 10.]])
        df = read_fwf(StringIO(data), colspecs=[(0, 3), (4, 9), (9, 25)],
                      comment='#')
        tm.assert_almost_equal(df.values, expected)

    def test_1000_fwf(self):
        data = """
 1 2,334.0    5
10   13     10.
"""
        expected = np.array([[1, 2334., 5],
                             [10, 13, 10]])
        df = read_fwf(StringIO(data), colspecs=[(0, 3), (3, 11), (12, 16)],
                      thousands=',')
        tm.assert_almost_equal(df.values, expected)

    def test_bool_header_arg(self):
        # see gh-6114
        data = """\
MyColumn
   a
   b
   a
   b"""
        for arg in [True, False]:
            with pytest.raises(TypeError):
                read_fwf(StringIO(data), header=arg)

    def test_full_file(self):
        # File with all values
        test = """index                             A    B    C
2000-01-03T00:00:00  0.980268513777    3  foo
2000-01-04T00:00:00  1.04791624281    -4  bar
2000-01-05T00:00:00  0.498580885705   73  baz
2000-01-06T00:00:00  1.12020151869     1  foo
2000-01-07T00:00:00  0.487094399463    0  bar
2000-01-10T00:00:00  0.836648671666    2  baz
2000-01-11T00:00:00  0.157160753327   34  foo"""
        colspecs = ((0, 19), (21, 35), (38, 40), (42, 45))
        expected = read_fwf(StringIO(test), colspecs=colspecs)
        tm.assert_frame_equal(expected, read_fwf(StringIO(test)))

    def test_full_file_with_missing(self):
        # File with missing values
        test = """index                             A    B    C
2000-01-03T00:00:00  0.980268513777    3  foo
2000-01-04T00:00:00  1.04791624281    -4  bar
                     0.498580885705   73  baz
2000-01-06T00:00:00  1.12020151869     1  foo
2000-01-07T00:00:00                    0  bar
2000-01-10T00:00:00  0.836648671666    2  baz
                                      34"""
        colspecs = ((0, 19), (21, 35), (38, 40), (42, 45))
        expected = read_fwf(StringIO(test), colspecs=colspecs)
        tm.assert_frame_equal(expected, read_fwf(StringIO(test)))

    def test_full_file_with_spaces(self):
        # File with spaces in columns
        test = """
Account                 Name  Balance     CreditLimit   AccountCreated
101     Keanu Reeves          9315.45     10000.00           1/17/1998
312     Gerard Butler         90.00       1000.00             8/6/2003
868     Jennifer Love Hewitt  0           17000.00           5/25/1985
761     Jada Pinkett-Smith    49654.87    100000.00          12/5/2006
317     Bill Murray           789.65      5000.00             2/5/2007
""".strip('\r\n')
        colspecs = ((0, 7), (8, 28), (30, 38), (42, 53), (56, 70))
        expected = read_fwf(StringIO(test), colspecs=colspecs)
        tm.assert_frame_equal(expected, read_fwf(StringIO(test)))

    def test_full_file_with_spaces_and_missing(self):
        # File with spaces and missing values in columsn
        test = """
Account               Name    Balance     CreditLimit   AccountCreated
101                           10000.00                       1/17/1998
312     Gerard Butler         90.00       1000.00             8/6/2003
868                                                          5/25/1985
761     Jada Pinkett-Smith    49654.87    100000.00          12/5/2006
317     Bill Murray           789.65
""".strip('\r\n')
        colspecs = ((0, 7), (8, 28), (30, 38), (42, 53), (56, 70))
        expected = read_fwf(StringIO(test), colspecs=colspecs)
        tm.assert_frame_equal(expected, read_fwf(StringIO(test)))

    def test_messed_up_data(self):
        # Completely messed up file
        test = """
   Account          Name             Balance     Credit Limit   Account Created
       101                           10000.00                       1/17/1998
       312     Gerard Butler         90.00       1000.00

       761     Jada Pinkett-Smith    49654.87    100000.00          12/5/2006
  317          Bill Murray           789.65
""".strip('\r\n')
        colspecs = ((2, 10), (15, 33), (37, 45), (49, 61), (64, 79))
        expected = read_fwf(StringIO(test), colspecs=colspecs)
        tm.assert_frame_equal(expected, read_fwf(StringIO(test)))

    def test_multiple_delimiters(self):
        test = r"""
col1~~~~~col2  col3++++++++++++++++++col4
~~22.....11.0+++foo~~~~~~~~~~Keanu Reeves
  33+++122.33\\\bar.........Gerard Butler
++44~~~~12.01   baz~~Jennifer Love Hewitt
~~55       11+++foo++++Jada Pinkett-Smith
..66++++++.03~~~bar           Bill Murray
""".strip('\r\n')
        colspecs = ((0, 4), (7, 13), (15, 19), (21, 41))
        expected = read_fwf(StringIO(test), colspecs=colspecs,
                            delimiter=' +~.\\')
        tm.assert_frame_equal(expected, read_fwf(StringIO(test),
                                                 delimiter=' +~.\\'))

    def test_variable_width_unicode(self):
        if not compat.PY3:
            pytest.skip(
                'Bytes-related test - only needs to work on Python 3')
        test = """
שלום שלום
ום   שלל
של   ום
""".strip('\r\n')
        expected = read_fwf(BytesIO(test.encode('utf8')),
                            colspecs=[(0, 4), (5, 9)],
                            header=None, encoding='utf8')
        tm.assert_frame_equal(expected, read_fwf(
            BytesIO(test.encode('utf8')), header=None, encoding='utf8'))

    def test_dtype(self):
        data = """ a    b    c
1    2    3.2
3    4    5.2
"""
        colspecs = [(0, 5), (5, 10), (10, None)]
        result = pd.read_fwf(StringIO(data), colspecs=colspecs)
        expected = pd.DataFrame({
            'a': [1, 3],
            'b': [2, 4],
            'c': [3.2, 5.2]}, columns=['a', 'b', 'c'])
        tm.assert_frame_equal(result, expected)

        expected['a'] = expected['a'].astype('float64')
        expected['b'] = expected['b'].astype(str)
        expected['c'] = expected['c'].astype('int32')
        result = pd.read_fwf(StringIO(data), colspecs=colspecs,
                             dtype={'a': 'float64', 'b': str, 'c': 'int32'})
        tm.assert_frame_equal(result, expected)

    def test_skiprows_inference(self):
        # GH11256
        test = """
Text contained in the file header

DataCol1   DataCol2
     0.0        1.0
   101.6      956.1
""".strip()
        expected = read_csv(StringIO(test), skiprows=2,
                            delim_whitespace=True)
        tm.assert_frame_equal(expected, read_fwf(
            StringIO(test), skiprows=2))

    def test_skiprows_by_index_inference(self):
        test = """
To be skipped
Not  To  Be  Skipped
Once more to be skipped
123  34   8      123
456  78   9      456
""".strip()

        expected = read_csv(StringIO(test), skiprows=[0, 2],
                            delim_whitespace=True)
        tm.assert_frame_equal(expected, read_fwf(
            StringIO(test), skiprows=[0, 2]))

    def test_skiprows_inference_empty(self):
        test = """
AA   BBB  C
12   345  6
78   901  2
""".strip()

        with pytest.raises(EmptyDataError):
            read_fwf(StringIO(test), skiprows=3)
