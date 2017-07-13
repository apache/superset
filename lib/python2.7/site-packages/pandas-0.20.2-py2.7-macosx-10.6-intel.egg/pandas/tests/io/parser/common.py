# -*- coding: utf-8 -*-

import csv
import os
import platform
import codecs

import re
import sys
from datetime import datetime

import pytest
import numpy as np
from pandas._libs.lib import Timestamp

import pandas as pd
import pandas.util.testing as tm
from pandas import DataFrame, Series, Index, MultiIndex
from pandas import compat
from pandas.compat import (StringIO, BytesIO, PY3,
                           range, lrange, u)
from pandas.errors import DtypeWarning, EmptyDataError, ParserError
from pandas.io.common import URLError
from pandas.io.parsers import TextFileReader, TextParser


class ParserTests(object):
    """
    Want to be able to test either C+Cython or Python+Cython parsers
    """
    data1 = """index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
qux,12,13,14,15
foo2,12,13,14,15
bar2,12,13,14,15
"""

    def test_empty_decimal_marker(self):
        data = """A|B|C
1|2,334|5
10|13|10.
"""
        # Parsers support only length-1 decimals
        msg = 'Only length-1 decimal markers supported'
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), decimal='')

    def test_bad_stream_exception(self):
        # Issue 13652:
        # This test validates that both python engine
        # and C engine will raise UnicodeDecodeError instead of
        # c engine raising ParserError and swallowing exception
        # that caused read to fail.
        handle = open(self.csv_shiftjs, "rb")
        codec = codecs.lookup("utf-8")
        utf8 = codecs.lookup('utf-8')
        # stream must be binary UTF8
        stream = codecs.StreamRecoder(
            handle, utf8.encode, utf8.decode, codec.streamreader,
            codec.streamwriter)
        if compat.PY3:
            msg = "'utf-8' codec can't decode byte"
        else:
            msg = "'utf8' codec can't decode byte"
        with tm.assert_raises_regex(UnicodeDecodeError, msg):
            self.read_csv(stream)
        stream.close()

    def test_read_csv(self):
        if not compat.PY3:
            if compat.is_platform_windows():
                prefix = u("file:///")
            else:
                prefix = u("file://")

            fname = prefix + compat.text_type(self.csv1)
            self.read_csv(fname, index_col=0, parse_dates=True)

    def test_1000_sep(self):
        data = """A|B|C
1|2,334|5
10|13|10.
"""
        expected = DataFrame({
            'A': [1, 10],
            'B': [2334, 13],
            'C': [5, 10.]
        })

        df = self.read_csv(StringIO(data), sep='|', thousands=',')
        tm.assert_frame_equal(df, expected)

        df = self.read_table(StringIO(data), sep='|', thousands=',')
        tm.assert_frame_equal(df, expected)

    def test_squeeze(self):
        data = """\
a,1
b,2
c,3
"""
        idx = Index(['a', 'b', 'c'], name=0)
        expected = Series([1, 2, 3], name=1, index=idx)
        result = self.read_table(StringIO(data), sep=',', index_col=0,
                                 header=None, squeeze=True)
        assert isinstance(result, Series)
        tm.assert_series_equal(result, expected)

    def test_squeeze_no_view(self):
        # see gh-8217
        # Series should not be a view
        data = """time,data\n0,10\n1,11\n2,12\n4,14\n5,15\n3,13"""
        result = self.read_csv(StringIO(data), index_col='time', squeeze=True)
        assert not result._is_view

    def test_malformed(self):
        # see gh-6607

        # all
        data = """ignore
A,B,C
1,2,3 # comment
1,2,3,4,5
2,3,4
"""
        msg = 'Expected 3 fields in line 4, saw 5'
        with tm.assert_raises_regex(Exception, msg):
            self.read_table(StringIO(data), sep=',',
                            header=1, comment='#')

        # first chunk
        data = """ignore
A,B,C
skip
1,2,3
3,5,10 # comment
1,2,3,4,5
2,3,4
"""
        msg = 'Expected 3 fields in line 6, saw 5'
        with tm.assert_raises_regex(Exception, msg):
            it = self.read_table(StringIO(data), sep=',',
                                 header=1, comment='#',
                                 iterator=True, chunksize=1,
                                 skiprows=[2])
            it.read(5)

        # middle chunk
        data = """ignore
A,B,C
skip
1,2,3
3,5,10 # comment
1,2,3,4,5
2,3,4
"""
        msg = 'Expected 3 fields in line 6, saw 5'
        with tm.assert_raises_regex(Exception, msg):
            it = self.read_table(StringIO(data), sep=',', header=1,
                                 comment='#', iterator=True, chunksize=1,
                                 skiprows=[2])
            it.read(3)

        # last chunk
        data = """ignore
A,B,C
skip
1,2,3
3,5,10 # comment
1,2,3,4,5
2,3,4
"""
        msg = 'Expected 3 fields in line 6, saw 5'
        with tm.assert_raises_regex(Exception, msg):
            it = self.read_table(StringIO(data), sep=',', header=1,
                                 comment='#', iterator=True, chunksize=1,
                                 skiprows=[2])
            it.read()

        # skipfooter is not supported with the C parser yet
        if self.engine == 'python':
            # skipfooter
            data = """ignore
A,B,C
1,2,3 # comment
1,2,3,4,5
2,3,4
footer
"""
            msg = 'Expected 3 fields in line 4, saw 5'
            with tm.assert_raises_regex(Exception, msg):
                self.read_table(StringIO(data), sep=',',
                                header=1, comment='#',
                                skipfooter=1)

    def test_quoting(self):
        bad_line_small = """printer\tresult\tvariant_name
Klosterdruckerei\tKlosterdruckerei <Salem> (1611-1804)\tMuller, Jacob
Klosterdruckerei\tKlosterdruckerei <Salem> (1611-1804)\tMuller, Jakob
Klosterdruckerei\tKlosterdruckerei <Kempten> (1609-1805)\t"Furststiftische Hofdruckerei,  <Kempten""
Klosterdruckerei\tKlosterdruckerei <Kempten> (1609-1805)\tGaller, Alois
Klosterdruckerei\tKlosterdruckerei <Kempten> (1609-1805)\tHochfurstliche Buchhandlung <Kempten>"""  # noqa
        pytest.raises(Exception, self.read_table, StringIO(bad_line_small),
                      sep='\t')

        good_line_small = bad_line_small + '"'
        df = self.read_table(StringIO(good_line_small), sep='\t')
        assert len(df) == 3

    def test_unnamed_columns(self):
        data = """A,B,C,,
1,2,3,4,5
6,7,8,9,10
11,12,13,14,15
"""
        expected = np.array([[1, 2, 3, 4, 5],
                             [6, 7, 8, 9, 10],
                             [11, 12, 13, 14, 15]], dtype=np.int64)
        df = self.read_table(StringIO(data), sep=',')
        tm.assert_almost_equal(df.values, expected)
        tm.assert_index_equal(df.columns,
                              Index(['A', 'B', 'C', 'Unnamed: 3',
                                     'Unnamed: 4']))

    def test_duplicate_columns(self):
        # TODO: add test for condition 'mangle_dupe_cols=False'
        # once it is actually supported (gh-12935)
        data = """A,A,B,B,B
1,2,3,4,5
6,7,8,9,10
11,12,13,14,15
"""

        for method in ('read_csv', 'read_table'):

            # check default behavior
            df = getattr(self, method)(StringIO(data), sep=',')
            assert list(df.columns) == ['A', 'A.1', 'B', 'B.1', 'B.2']

            df = getattr(self, method)(StringIO(data), sep=',',
                                       mangle_dupe_cols=True)
            assert list(df.columns) == ['A', 'A.1', 'B', 'B.1', 'B.2']

    def test_csv_mixed_type(self):
        data = """A,B,C
a,1,2
b,3,4
c,4,5
"""
        expected = DataFrame({'A': ['a', 'b', 'c'],
                              'B': [1, 3, 4],
                              'C': [2, 4, 5]})
        out = self.read_csv(StringIO(data))
        tm.assert_frame_equal(out, expected)

    def test_read_csv_dataframe(self):
        df = self.read_csv(self.csv1, index_col=0, parse_dates=True)
        df2 = self.read_table(self.csv1, sep=',', index_col=0,
                              parse_dates=True)
        tm.assert_index_equal(df.columns, pd.Index(['A', 'B', 'C', 'D']))
        assert df.index.name == 'index'
        assert isinstance(
            df.index[0], (datetime, np.datetime64, Timestamp))
        assert df.values.dtype == np.float64
        tm.assert_frame_equal(df, df2)

    def test_read_csv_no_index_name(self):
        df = self.read_csv(self.csv2, index_col=0, parse_dates=True)
        df2 = self.read_table(self.csv2, sep=',', index_col=0,
                              parse_dates=True)
        tm.assert_index_equal(df.columns,
                              pd.Index(['A', 'B', 'C', 'D', 'E']))
        assert isinstance(df.index[0], (datetime, np.datetime64, Timestamp))
        assert df.loc[:, ['A', 'B', 'C', 'D']].values.dtype == np.float64
        tm.assert_frame_equal(df, df2)

    def test_read_table_unicode(self):
        fin = BytesIO(u('\u0141aski, Jan;1').encode('utf-8'))
        df1 = self.read_table(fin, sep=";", encoding="utf-8", header=None)
        assert isinstance(df1[0].values[0], compat.text_type)

    def test_read_table_wrong_num_columns(self):
        # too few!
        data = """A,B,C,D,E,F
1,2,3,4,5,6
6,7,8,9,10,11,12
11,12,13,14,15,16
"""
        pytest.raises(ValueError, self.read_csv, StringIO(data))

    def test_read_duplicate_index_explicit(self):
        data = """index,A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
qux,12,13,14,15
foo,12,13,14,15
bar,12,13,14,15
"""

        result = self.read_csv(StringIO(data), index_col=0)
        expected = self.read_csv(StringIO(data)).set_index(
            'index', verify_integrity=False)
        tm.assert_frame_equal(result, expected)

        result = self.read_table(StringIO(data), sep=',', index_col=0)
        expected = self.read_table(StringIO(data), sep=',', ).set_index(
            'index', verify_integrity=False)
        tm.assert_frame_equal(result, expected)

    def test_read_duplicate_index_implicit(self):
        data = """A,B,C,D
foo,2,3,4,5
bar,7,8,9,10
baz,12,13,14,15
qux,12,13,14,15
foo,12,13,14,15
bar,12,13,14,15
"""

        # make sure an error isn't thrown
        self.read_csv(StringIO(data))
        self.read_table(StringIO(data), sep=',')

    def test_parse_bools(self):
        data = """A,B
True,1
False,2
True,3
"""
        data = self.read_csv(StringIO(data))
        assert data['A'].dtype == np.bool_

        data = """A,B
YES,1
no,2
yes,3
No,3
Yes,3
"""
        data = self.read_csv(StringIO(data),
                             true_values=['yes', 'Yes', 'YES'],
                             false_values=['no', 'NO', 'No'])
        assert data['A'].dtype == np.bool_

        data = """A,B
TRUE,1
FALSE,2
TRUE,3
"""
        data = self.read_csv(StringIO(data))
        assert data['A'].dtype == np.bool_

        data = """A,B
foo,bar
bar,foo"""
        result = self.read_csv(StringIO(data), true_values=['foo'],
                               false_values=['bar'])
        expected = DataFrame({'A': [True, False], 'B': [False, True]})
        tm.assert_frame_equal(result, expected)

    def test_int_conversion(self):
        data = """A,B
1.0,1
2.0,2
3.0,3
"""
        data = self.read_csv(StringIO(data))
        assert data['A'].dtype == np.float64
        assert data['B'].dtype == np.int64

    def test_read_nrows(self):
        expected = self.read_csv(StringIO(self.data1))[:3]

        df = self.read_csv(StringIO(self.data1), nrows=3)
        tm.assert_frame_equal(df, expected)

        # see gh-10476
        df = self.read_csv(StringIO(self.data1), nrows=3.0)
        tm.assert_frame_equal(df, expected)

        msg = r"'nrows' must be an integer >=0"

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(self.data1), nrows=1.2)

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(self.data1), nrows='foo')

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(self.data1), nrows=-1)

    def test_read_chunksize(self):
        reader = self.read_csv(StringIO(self.data1), index_col=0, chunksize=2)
        df = self.read_csv(StringIO(self.data1), index_col=0)

        chunks = list(reader)

        tm.assert_frame_equal(chunks[0], df[:2])
        tm.assert_frame_equal(chunks[1], df[2:4])
        tm.assert_frame_equal(chunks[2], df[4:])

        # with invalid chunksize value:
        msg = r"'chunksize' must be an integer >=1"

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(self.data1), chunksize=1.3)

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(self.data1), chunksize='foo')

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(self.data1), chunksize=0)

    def test_read_chunksize_and_nrows(self):

        # gh-15755
        # With nrows
        reader = self.read_csv(StringIO(self.data1), index_col=0,
                               chunksize=2, nrows=5)
        df = self.read_csv(StringIO(self.data1), index_col=0, nrows=5)

        tm.assert_frame_equal(pd.concat(reader), df)

        # chunksize > nrows
        reader = self.read_csv(StringIO(self.data1), index_col=0,
                               chunksize=8, nrows=5)
        df = self.read_csv(StringIO(self.data1), index_col=0, nrows=5)

        tm.assert_frame_equal(pd.concat(reader), df)

        # with changing "size":
        reader = self.read_csv(StringIO(self.data1), index_col=0,
                               chunksize=8, nrows=5)
        df = self.read_csv(StringIO(self.data1), index_col=0, nrows=5)

        tm.assert_frame_equal(reader.get_chunk(size=2), df.iloc[:2])
        tm.assert_frame_equal(reader.get_chunk(size=4), df.iloc[2:5])
        with pytest.raises(StopIteration):
            reader.get_chunk(size=3)

    def test_read_chunksize_named(self):
        reader = self.read_csv(
            StringIO(self.data1), index_col='index', chunksize=2)
        df = self.read_csv(StringIO(self.data1), index_col='index')

        chunks = list(reader)

        tm.assert_frame_equal(chunks[0], df[:2])
        tm.assert_frame_equal(chunks[1], df[2:4])
        tm.assert_frame_equal(chunks[2], df[4:])

    def test_get_chunk_passed_chunksize(self):
        data = """A,B,C
1,2,3
4,5,6
7,8,9
1,2,3"""
        result = self.read_csv(StringIO(data), chunksize=2)

        piece = result.get_chunk()
        assert len(piece) == 2

    def test_read_chunksize_generated_index(self):
        # GH 12185
        reader = self.read_csv(StringIO(self.data1), chunksize=2)
        df = self.read_csv(StringIO(self.data1))

        tm.assert_frame_equal(pd.concat(reader), df)

        reader = self.read_csv(StringIO(self.data1), chunksize=2, index_col=0)
        df = self.read_csv(StringIO(self.data1), index_col=0)

        tm.assert_frame_equal(pd.concat(reader), df)

    def test_read_text_list(self):
        data = """A,B,C\nfoo,1,2,3\nbar,4,5,6"""
        as_list = [['A', 'B', 'C'], ['foo', '1', '2', '3'], ['bar',
                                                             '4', '5', '6']]
        df = self.read_csv(StringIO(data), index_col=0)

        parser = TextParser(as_list, index_col=0, chunksize=2)
        chunk = parser.read(None)

        tm.assert_frame_equal(chunk, df)

    def test_iterator(self):
        # See gh-6607
        reader = self.read_csv(StringIO(self.data1), index_col=0,
                               iterator=True)
        df = self.read_csv(StringIO(self.data1), index_col=0)

        chunk = reader.read(3)
        tm.assert_frame_equal(chunk, df[:3])

        last_chunk = reader.read(5)
        tm.assert_frame_equal(last_chunk, df[3:])

        # pass list
        lines = list(csv.reader(StringIO(self.data1)))
        parser = TextParser(lines, index_col=0, chunksize=2)

        df = self.read_csv(StringIO(self.data1), index_col=0)

        chunks = list(parser)
        tm.assert_frame_equal(chunks[0], df[:2])
        tm.assert_frame_equal(chunks[1], df[2:4])
        tm.assert_frame_equal(chunks[2], df[4:])

        # pass skiprows
        parser = TextParser(lines, index_col=0, chunksize=2, skiprows=[1])
        chunks = list(parser)
        tm.assert_frame_equal(chunks[0], df[1:3])

        treader = self.read_table(StringIO(self.data1), sep=',', index_col=0,
                                  iterator=True)
        assert isinstance(treader, TextFileReader)

        # gh-3967: stopping iteration when chunksize is specified
        data = """A,B,C
foo,1,2,3
bar,4,5,6
baz,7,8,9
"""
        reader = self.read_csv(StringIO(data), iterator=True)
        result = list(reader)
        expected = DataFrame(dict(A=[1, 4, 7], B=[2, 5, 8], C=[
            3, 6, 9]), index=['foo', 'bar', 'baz'])
        tm.assert_frame_equal(result[0], expected)

        # chunksize = 1
        reader = self.read_csv(StringIO(data), chunksize=1)
        result = list(reader)
        expected = DataFrame(dict(A=[1, 4, 7], B=[2, 5, 8], C=[
            3, 6, 9]), index=['foo', 'bar', 'baz'])
        assert len(result) == 3
        tm.assert_frame_equal(pd.concat(result), expected)

        # skipfooter is not supported with the C parser yet
        if self.engine == 'python':
            # test bad parameter (skipfooter)
            reader = self.read_csv(StringIO(self.data1), index_col=0,
                                   iterator=True, skipfooter=1)
            pytest.raises(ValueError, reader.read, 3)

    def test_pass_names_with_index(self):
        lines = self.data1.split('\n')
        no_header = '\n'.join(lines[1:])

        # regular index
        names = ['index', 'A', 'B', 'C', 'D']
        df = self.read_csv(StringIO(no_header), index_col=0, names=names)
        expected = self.read_csv(StringIO(self.data1), index_col=0)
        tm.assert_frame_equal(df, expected)

        # multi index
        data = """index1,index2,A,B,C,D
foo,one,2,3,4,5
foo,two,7,8,9,10
foo,three,12,13,14,15
bar,one,12,13,14,15
bar,two,12,13,14,15
"""
        lines = data.split('\n')
        no_header = '\n'.join(lines[1:])
        names = ['index1', 'index2', 'A', 'B', 'C', 'D']
        df = self.read_csv(StringIO(no_header), index_col=[0, 1],
                           names=names)
        expected = self.read_csv(StringIO(data), index_col=[0, 1])
        tm.assert_frame_equal(df, expected)

        df = self.read_csv(StringIO(data), index_col=['index1', 'index2'])
        tm.assert_frame_equal(df, expected)

    def test_multi_index_no_level_names(self):
        data = """index1,index2,A,B,C,D
foo,one,2,3,4,5
foo,two,7,8,9,10
foo,three,12,13,14,15
bar,one,12,13,14,15
bar,two,12,13,14,15
"""

        data2 = """A,B,C,D
foo,one,2,3,4,5
foo,two,7,8,9,10
foo,three,12,13,14,15
bar,one,12,13,14,15
bar,two,12,13,14,15
"""

        lines = data.split('\n')
        no_header = '\n'.join(lines[1:])
        names = ['A', 'B', 'C', 'D']

        df = self.read_csv(StringIO(no_header), index_col=[0, 1],
                           header=None, names=names)
        expected = self.read_csv(StringIO(data), index_col=[0, 1])
        tm.assert_frame_equal(df, expected, check_names=False)

        # 2 implicit first cols
        df2 = self.read_csv(StringIO(data2))
        tm.assert_frame_equal(df2, df)

        # reverse order of index
        df = self.read_csv(StringIO(no_header), index_col=[1, 0], names=names,
                           header=None)
        expected = self.read_csv(StringIO(data), index_col=[1, 0])
        tm.assert_frame_equal(df, expected, check_names=False)

    def test_multi_index_blank_df(self):
        # GH 14545
        data = """a,b
"""
        df = self.read_csv(StringIO(data), header=[0])
        expected = DataFrame(columns=['a', 'b'])
        tm.assert_frame_equal(df, expected)
        round_trip = self.read_csv(StringIO(
            expected.to_csv(index=False)), header=[0])
        tm.assert_frame_equal(round_trip, expected)

        data_multiline = """a,b
c,d
"""
        df2 = self.read_csv(StringIO(data_multiline), header=[0, 1])
        cols = MultiIndex.from_tuples([('a', 'c'), ('b', 'd')])
        expected2 = DataFrame(columns=cols)
        tm.assert_frame_equal(df2, expected2)
        round_trip = self.read_csv(StringIO(
            expected2.to_csv(index=False)), header=[0, 1])
        tm.assert_frame_equal(round_trip, expected2)

    def test_no_unnamed_index(self):
        data = """ id c0 c1 c2
0 1 0 a b
1 2 0 c d
2 2 2 e f
"""
        df = self.read_table(StringIO(data), sep=' ')
        assert df.index.name is None

    def test_read_csv_parse_simple_list(self):
        text = """foo
bar baz
qux foo
foo
bar"""
        df = self.read_csv(StringIO(text), header=None)
        expected = DataFrame({0: ['foo', 'bar baz', 'qux foo',
                                  'foo', 'bar']})
        tm.assert_frame_equal(df, expected)

    @tm.network
    def test_url(self):
        # HTTP(S)
        url = ('https://raw.github.com/pandas-dev/pandas/master/'
               'pandas/tests/io/parser/data/salaries.csv')
        url_table = self.read_table(url)
        dirpath = tm.get_data_path()
        localtable = os.path.join(dirpath, 'salaries.csv')
        local_table = self.read_table(localtable)
        tm.assert_frame_equal(url_table, local_table)
        # TODO: ftp testing

    @tm.slow
    def test_file(self):
        dirpath = tm.get_data_path()
        localtable = os.path.join(dirpath, 'salaries.csv')
        local_table = self.read_table(localtable)

        try:
            url_table = self.read_table('file://localhost/' + localtable)
        except URLError:
            # fails on some systems
            pytest.skip("failing on %s" %
                        ' '.join(platform.uname()).strip())

        tm.assert_frame_equal(url_table, local_table)

    def test_path_pathlib(self):
        df = tm.makeDataFrame()
        result = tm.round_trip_pathlib(df.to_csv,
                                       lambda p: self.read_csv(p, index_col=0))
        tm.assert_frame_equal(df, result)

    def test_path_localpath(self):
        df = tm.makeDataFrame()
        result = tm.round_trip_localpath(
            df.to_csv,
            lambda p: self.read_csv(p, index_col=0))
        tm.assert_frame_equal(df, result)

    def test_nonexistent_path(self):
        # gh-2428: pls no segfault
        # gh-14086: raise more helpful FileNotFoundError
        path = '%s.csv' % tm.rands(10)
        pytest.raises(compat.FileNotFoundError, self.read_csv, path)

    def test_missing_trailing_delimiters(self):
        data = """A,B,C,D
1,2,3,4
1,3,3,
1,4,5"""
        result = self.read_csv(StringIO(data))
        assert result['D'].isnull()[1:].all()

    def test_skipinitialspace(self):
        s = ('"09-Apr-2012", "01:10:18.300", 2456026.548822908, 12849, '
             '1.00361,  1.12551, 330.65659, 0355626618.16711,  73.48821, '
             '314.11625,  1917.09447,   179.71425,  80.000, 240.000, -350,  '
             '70.06056, 344.98370, 1,   1, -0.689265, -0.692787,  '
             '0.212036,    14.7674,   41.605,   -9999.0,   -9999.0,   '
             '-9999.0,   -9999.0,   -9999.0,  -9999.0, 000, 012, 128')

        sfile = StringIO(s)
        # it's 33 columns
        result = self.read_csv(sfile, names=lrange(33), na_values=['-9999.0'],
                               header=None, skipinitialspace=True)
        assert pd.isnull(result.iloc[0, 29])

    def test_utf16_bom_skiprows(self):
        # #2298
        data = u("""skip this
skip this too
A\tB\tC
1\t2\t3
4\t5\t6""")

        data2 = u("""skip this
skip this too
A,B,C
1,2,3
4,5,6""")

        path = '__%s__.csv' % tm.rands(10)

        with tm.ensure_clean(path) as path:
            for sep, dat in [('\t', data), (',', data2)]:
                for enc in ['utf-16', 'utf-16le', 'utf-16be']:
                    bytes = dat.encode(enc)
                    with open(path, 'wb') as f:
                        f.write(bytes)

                    s = BytesIO(dat.encode('utf-8'))
                    if compat.PY3:
                        # somewhat False since the code never sees bytes
                        from io import TextIOWrapper
                        s = TextIOWrapper(s, encoding='utf-8')

                    result = self.read_csv(path, encoding=enc, skiprows=2,
                                           sep=sep)
                    expected = self.read_csv(s, encoding='utf-8', skiprows=2,
                                             sep=sep)
                    s.close()

                    tm.assert_frame_equal(result, expected)

    def test_utf16_example(self):
        path = tm.get_data_path('utf16_ex.txt')

        # it works! and is the right length
        result = self.read_table(path, encoding='utf-16')
        assert len(result) == 50

        if not compat.PY3:
            buf = BytesIO(open(path, 'rb').read())
            result = self.read_table(buf, encoding='utf-16')
            assert len(result) == 50

    def test_unicode_encoding(self):
        pth = tm.get_data_path('unicode_series.csv')

        result = self.read_csv(pth, header=None, encoding='latin-1')
        result = result.set_index(0)

        got = result[1][1632]
        expected = u('\xc1 k\xf6ldum klaka (Cold Fever) (1994)')

        assert got == expected

    def test_trailing_delimiters(self):
        # #2442. grumble grumble
        data = """A,B,C
1,2,3,
4,5,6,
7,8,9,"""
        result = self.read_csv(StringIO(data), index_col=False)

        expected = DataFrame({'A': [1, 4, 7], 'B': [2, 5, 8],
                              'C': [3, 6, 9]})

        tm.assert_frame_equal(result, expected)

    def test_escapechar(self):
        # http://stackoverflow.com/questions/13824840/feature-request-for-
        # pandas-read-csv
        data = '''SEARCH_TERM,ACTUAL_URL
"bra tv bord","http://www.ikea.com/se/sv/catalog/categories/departments/living_room/10475/?se%7cps%7cnonbranded%7cvardagsrum%7cgoogle%7ctv_bord"
"tv p\xc3\xa5 hjul","http://www.ikea.com/se/sv/catalog/categories/departments/living_room/10475/?se%7cps%7cnonbranded%7cvardagsrum%7cgoogle%7ctv_bord"
"SLAGBORD, \\"Bergslagen\\", IKEA:s 1700-tals serie","http://www.ikea.com/se/sv/catalog/categories/departments/living_room/10475/?se%7cps%7cnonbranded%7cvardagsrum%7cgoogle%7ctv_bord"'''  # noqa

        result = self.read_csv(StringIO(data), escapechar='\\',
                               quotechar='"', encoding='utf-8')
        assert result['SEARCH_TERM'][2] == ('SLAGBORD, "Bergslagen", '
                                            'IKEA:s 1700-tals serie')
        tm.assert_index_equal(result.columns,
                              Index(['SEARCH_TERM', 'ACTUAL_URL']))

    def test_int64_min_issues(self):
        # #2599
        data = 'A,B\n0,0\n0,'

        result = self.read_csv(StringIO(data))
        expected = DataFrame({'A': [0, 0], 'B': [0, np.nan]})

        tm.assert_frame_equal(result, expected)

    def test_parse_integers_above_fp_precision(self):
        data = """Numbers
17007000002000191
17007000002000191
17007000002000191
17007000002000191
17007000002000192
17007000002000192
17007000002000192
17007000002000192
17007000002000192
17007000002000194"""

        result = self.read_csv(StringIO(data))
        expected = DataFrame({'Numbers': [17007000002000191,
                                          17007000002000191,
                                          17007000002000191,
                                          17007000002000191,
                                          17007000002000192,
                                          17007000002000192,
                                          17007000002000192,
                                          17007000002000192,
                                          17007000002000192,
                                          17007000002000194]})

        assert np.array_equal(result['Numbers'], expected['Numbers'])

    def test_chunks_have_consistent_numerical_type(self):
        integers = [str(i) for i in range(499999)]
        data = "a\n" + "\n".join(integers + ["1.0", "2.0"] + integers)

        with tm.assert_produces_warning(False):
            df = self.read_csv(StringIO(data))
        # Assert that types were coerced.
        assert type(df.a[0]) is np.float64
        assert df.a.dtype == np.float

    def test_warn_if_chunks_have_mismatched_type(self):
        warning_type = False
        integers = [str(i) for i in range(499999)]
        data = "a\n" + "\n".join(integers + ['a', 'b'] + integers)

        # see gh-3866: if chunks are different types and can't
        # be coerced using numerical types, then issue warning.
        if self.engine == 'c' and self.low_memory:
            warning_type = DtypeWarning

        with tm.assert_produces_warning(warning_type):
            df = self.read_csv(StringIO(data))
        assert df.a.dtype == np.object

    def test_integer_overflow_bug(self):
        # see gh-2601
        data = "65248E10 11\n55555E55 22\n"

        result = self.read_csv(StringIO(data), header=None, sep=' ')
        assert result[0].dtype == np.float64

        result = self.read_csv(StringIO(data), header=None, sep=r'\s+')
        assert result[0].dtype == np.float64

    def test_catch_too_many_names(self):
        # see gh-5156
        data = """\
1,2,3
4,,6
7,8,9
10,11,12\n"""
        pytest.raises(ValueError, self.read_csv, StringIO(data),
                      header=0, names=['a', 'b', 'c', 'd'])

    def test_ignore_leading_whitespace(self):
        # see gh-3374, gh-6607
        data = ' a b c\n 1 2 3\n 4 5 6\n 7 8 9'
        result = self.read_table(StringIO(data), sep=r'\s+')
        expected = DataFrame({'a': [1, 4, 7], 'b': [2, 5, 8], 'c': [3, 6, 9]})
        tm.assert_frame_equal(result, expected)

    def test_chunk_begins_with_newline_whitespace(self):
        # see gh-10022
        data = '\n hello\nworld\n'
        result = self.read_csv(StringIO(data), header=None)
        assert len(result) == 2

        # see gh-9735: this issue is C parser-specific (bug when
        # parsing whitespace and characters at chunk boundary)
        if self.engine == 'c':
            chunk1 = 'a' * (1024 * 256 - 2) + '\na'
            chunk2 = '\n a'
            result = self.read_csv(StringIO(chunk1 + chunk2), header=None)
            expected = DataFrame(['a' * (1024 * 256 - 2), 'a', ' a'])
            tm.assert_frame_equal(result, expected)

    def test_empty_with_index(self):
        # see gh-10184
        data = 'x,y'
        result = self.read_csv(StringIO(data), index_col=0)
        expected = DataFrame([], columns=['y'], index=Index([], name='x'))
        tm.assert_frame_equal(result, expected)

    def test_empty_with_multiindex(self):
        # see gh-10467
        data = 'x,y,z'
        result = self.read_csv(StringIO(data), index_col=['x', 'y'])
        expected = DataFrame([], columns=['z'],
                             index=MultiIndex.from_arrays(
                                 [[]] * 2, names=['x', 'y']))
        tm.assert_frame_equal(result, expected, check_index_type=False)

    def test_empty_with_reversed_multiindex(self):
        data = 'x,y,z'
        result = self.read_csv(StringIO(data), index_col=[1, 0])
        expected = DataFrame([], columns=['z'],
                             index=MultiIndex.from_arrays(
                                 [[]] * 2, names=['y', 'x']))
        tm.assert_frame_equal(result, expected, check_index_type=False)

    def test_float_parser(self):
        # see gh-9565
        data = '45e-1,4.5,45.,inf,-inf'
        result = self.read_csv(StringIO(data), header=None)
        expected = DataFrame([[float(s) for s in data.split(',')]])
        tm.assert_frame_equal(result, expected)

    def test_scientific_no_exponent(self):
        # see gh-12215
        df = DataFrame.from_items([('w', ['2e']), ('x', ['3E']),
                                   ('y', ['42e']), ('z', ['632E'])])
        data = df.to_csv(index=False)
        for prec in self.float_precision_choices:
            df_roundtrip = self.read_csv(
                StringIO(data), float_precision=prec)
            tm.assert_frame_equal(df_roundtrip, df)

    def test_int64_overflow(self):
        data = """ID
00013007854817840016671868
00013007854817840016749251
00013007854817840016754630
00013007854817840016781876
00013007854817840017028824
00013007854817840017963235
00013007854817840018860166"""

        # 13007854817840016671868 > UINT64_MAX, so this
        # will overflow and return object as the dtype.
        result = self.read_csv(StringIO(data))
        assert result['ID'].dtype == object

        # 13007854817840016671868 > UINT64_MAX, so attempts
        # to cast to either int64 or uint64 will result in
        # an OverflowError being raised.
        for conv in (np.int64, np.uint64):
            pytest.raises(OverflowError, self.read_csv,
                          StringIO(data), converters={'ID': conv})

        # These numbers fall right inside the int64-uint64 range,
        # so they should be parsed as string.
        ui_max = np.iinfo(np.uint64).max
        i_max = np.iinfo(np.int64).max
        i_min = np.iinfo(np.int64).min

        for x in [i_max, i_min, ui_max]:
            result = self.read_csv(StringIO(str(x)), header=None)
            expected = DataFrame([x])
            tm.assert_frame_equal(result, expected)

        # These numbers fall just outside the int64-uint64 range,
        # so they should be parsed as string.
        too_big = ui_max + 1
        too_small = i_min - 1

        for x in [too_big, too_small]:
            result = self.read_csv(StringIO(str(x)), header=None)
            expected = DataFrame([str(x)])
            tm.assert_frame_equal(result, expected)

        # No numerical dtype can hold both negative and uint64 values,
        # so they should be cast as string.
        data = '-1\n' + str(2**63)
        expected = DataFrame([str(-1), str(2**63)])
        result = self.read_csv(StringIO(data), header=None)
        tm.assert_frame_equal(result, expected)

        data = str(2**63) + '\n-1'
        expected = DataFrame([str(2**63), str(-1)])
        result = self.read_csv(StringIO(data), header=None)
        tm.assert_frame_equal(result, expected)

    def test_empty_with_nrows_chunksize(self):
        # see gh-9535
        expected = DataFrame([], columns=['foo', 'bar'])
        result = self.read_csv(StringIO('foo,bar\n'), nrows=10)
        tm.assert_frame_equal(result, expected)

        result = next(iter(self.read_csv(
            StringIO('foo,bar\n'), chunksize=10)))
        tm.assert_frame_equal(result, expected)

        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            result = self.read_csv(StringIO('foo,bar\n'),
                                   nrows=10, as_recarray=True)
            result = DataFrame(result[2], columns=result[1],
                               index=result[0])
            tm.assert_frame_equal(DataFrame.from_records(
                result), expected, check_index_type=False)

        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            result = next(iter(self.read_csv(StringIO('foo,bar\n'),
                                             chunksize=10, as_recarray=True)))
            result = DataFrame(result[2], columns=result[1], index=result[0])
            tm.assert_frame_equal(DataFrame.from_records(result), expected,
                                  check_index_type=False)

    def test_eof_states(self):
        # see gh-10728, gh-10548

        # With skip_blank_lines = True
        expected = DataFrame([[4, 5, 6]], columns=['a', 'b', 'c'])

        # gh-10728: WHITESPACE_LINE
        data = 'a,b,c\n4,5,6\n '
        result = self.read_csv(StringIO(data))
        tm.assert_frame_equal(result, expected)

        # gh-10548: EAT_LINE_COMMENT
        data = 'a,b,c\n4,5,6\n#comment'
        result = self.read_csv(StringIO(data), comment='#')
        tm.assert_frame_equal(result, expected)

        # EAT_CRNL_NOP
        data = 'a,b,c\n4,5,6\n\r'
        result = self.read_csv(StringIO(data))
        tm.assert_frame_equal(result, expected)

        # EAT_COMMENT
        data = 'a,b,c\n4,5,6#comment'
        result = self.read_csv(StringIO(data), comment='#')
        tm.assert_frame_equal(result, expected)

        # SKIP_LINE
        data = 'a,b,c\n4,5,6\nskipme'
        result = self.read_csv(StringIO(data), skiprows=[2])
        tm.assert_frame_equal(result, expected)

        # With skip_blank_lines = False

        # EAT_LINE_COMMENT
        data = 'a,b,c\n4,5,6\n#comment'
        result = self.read_csv(
            StringIO(data), comment='#', skip_blank_lines=False)
        expected = DataFrame([[4, 5, 6]], columns=['a', 'b', 'c'])
        tm.assert_frame_equal(result, expected)

        # IN_FIELD
        data = 'a,b,c\n4,5,6\n '
        result = self.read_csv(StringIO(data), skip_blank_lines=False)
        expected = DataFrame(
            [['4', 5, 6], [' ', None, None]], columns=['a', 'b', 'c'])
        tm.assert_frame_equal(result, expected)

        # EAT_CRNL
        data = 'a,b,c\n4,5,6\n\r'
        result = self.read_csv(StringIO(data), skip_blank_lines=False)
        expected = DataFrame(
            [[4, 5, 6], [None, None, None]], columns=['a', 'b', 'c'])
        tm.assert_frame_equal(result, expected)

        # Should produce exceptions

        # ESCAPED_CHAR
        data = "a,b,c\n4,5,6\n\\"
        pytest.raises(Exception, self.read_csv,
                      StringIO(data), escapechar='\\')

        # ESCAPE_IN_QUOTED_FIELD
        data = 'a,b,c\n4,5,6\n"\\'
        pytest.raises(Exception, self.read_csv,
                      StringIO(data), escapechar='\\')

        # IN_QUOTED_FIELD
        data = 'a,b,c\n4,5,6\n"'
        pytest.raises(Exception, self.read_csv,
                      StringIO(data), escapechar='\\')

    def test_uneven_lines_with_usecols(self):
        # See gh-12203
        csv = r"""a,b,c
        0,1,2
        3,4,5,6,7
        8,9,10
        """

        # make sure that an error is still thrown
        # when the 'usecols' parameter is not provided
        msg = r"Expected \d+ fields in line \d+, saw \d+"
        with tm.assert_raises_regex(ValueError, msg):
            df = self.read_csv(StringIO(csv))

        expected = DataFrame({
            'a': [0, 3, 8],
            'b': [1, 4, 9]
        })

        usecols = [0, 1]
        df = self.read_csv(StringIO(csv), usecols=usecols)
        tm.assert_frame_equal(df, expected)

        usecols = ['a', 'b']
        df = self.read_csv(StringIO(csv), usecols=usecols)
        tm.assert_frame_equal(df, expected)

    def test_read_empty_with_usecols(self):
        # See gh-12493
        names = ['Dummy', 'X', 'Dummy_2']
        usecols = names[1:2]  # ['X']

        # first, check to see that the response of
        # parser when faced with no provided columns
        # throws the correct error, with or without usecols
        errmsg = "No columns to parse from file"

        with tm.assert_raises_regex(EmptyDataError, errmsg):
            self.read_csv(StringIO(''))

        with tm.assert_raises_regex(EmptyDataError, errmsg):
            self.read_csv(StringIO(''), usecols=usecols)

        expected = DataFrame(columns=usecols, index=[0], dtype=np.float64)
        df = self.read_csv(StringIO(',,'), names=names, usecols=usecols)
        tm.assert_frame_equal(df, expected)

        expected = DataFrame(columns=usecols)
        df = self.read_csv(StringIO(''), names=names, usecols=usecols)
        tm.assert_frame_equal(df, expected)

    def test_trailing_spaces(self):
        data = "A B C  \nrandom line with trailing spaces    \nskip\n1,2,3\n1,2.,4.\nrandom line with trailing tabs\t\t\t\n   \n5.1,NaN,10.0\n"  # noqa
        expected = DataFrame([[1., 2., 4.],
                              [5.1, np.nan, 10.]])

        # gh-8661, gh-8679: this should ignore six lines including
        # lines with trailing whitespace and blank lines
        df = self.read_csv(StringIO(data.replace(',', '  ')),
                           header=None, delim_whitespace=True,
                           skiprows=[0, 1, 2, 3, 5, 6], skip_blank_lines=True)
        tm.assert_frame_equal(df, expected)
        df = self.read_table(StringIO(data.replace(',', '  ')),
                             header=None, delim_whitespace=True,
                             skiprows=[0, 1, 2, 3, 5, 6],
                             skip_blank_lines=True)
        tm.assert_frame_equal(df, expected)

        # gh-8983: test skipping set of rows after a row with trailing spaces
        expected = DataFrame({"A": [1., 5.1], "B": [2., np.nan],
                              "C": [4., 10]})
        df = self.read_table(StringIO(data.replace(',', '  ')),
                             delim_whitespace=True,
                             skiprows=[1, 2, 3, 5, 6], skip_blank_lines=True)
        tm.assert_frame_equal(df, expected)

    def test_raise_on_sep_with_delim_whitespace(self):
        # see gh-6607
        data = 'a b c\n1 2 3'
        with tm.assert_raises_regex(ValueError,
                                    'you can only specify one'):
            self.read_table(StringIO(data), sep=r'\s', delim_whitespace=True)

    def test_single_char_leading_whitespace(self):
        # see gh-9710
        data = """\
MyColumn
   a
   b
   a
   b\n"""

        expected = DataFrame({'MyColumn': list('abab')})

        result = self.read_csv(StringIO(data), delim_whitespace=True,
                               skipinitialspace=True)
        tm.assert_frame_equal(result, expected)

        result = self.read_csv(StringIO(data), skipinitialspace=True)
        tm.assert_frame_equal(result, expected)

    def test_empty_lines(self):
        data = """\
A,B,C
1,2.,4.


5.,NaN,10.0

-70,.4,1
"""
        expected = np.array([[1., 2., 4.],
                             [5., np.nan, 10.],
                             [-70., .4, 1.]])
        df = self.read_csv(StringIO(data))
        tm.assert_numpy_array_equal(df.values, expected)
        df = self.read_csv(StringIO(data.replace(',', '  ')), sep=r'\s+')
        tm.assert_numpy_array_equal(df.values, expected)
        expected = np.array([[1., 2., 4.],
                             [np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan],
                             [5., np.nan, 10.],
                             [np.nan, np.nan, np.nan],
                             [-70., .4, 1.]])
        df = self.read_csv(StringIO(data), skip_blank_lines=False)
        tm.assert_numpy_array_equal(df.values, expected)

    def test_whitespace_lines(self):
        data = """

\t  \t\t
  \t
A,B,C
  \t    1,2.,4.
5.,NaN,10.0
"""
        expected = np.array([[1, 2., 4.],
                             [5., np.nan, 10.]])
        df = self.read_csv(StringIO(data))
        tm.assert_numpy_array_equal(df.values, expected)

    def test_regex_separator(self):
        # see gh-6607
        data = """   A   B   C   D
a   1   2   3   4
b   1   2   3   4
c   1   2   3   4
"""
        df = self.read_table(StringIO(data), sep=r'\s+')
        expected = self.read_csv(StringIO(re.sub('[ ]+', ',', data)),
                                 index_col=0)
        assert expected.index.name is None
        tm.assert_frame_equal(df, expected)

        data = '    a b c\n1 2 3 \n4 5  6\n 7 8 9'
        result = self.read_table(StringIO(data), sep=r'\s+')
        expected = DataFrame([[1, 2, 3], [4, 5, 6], [7, 8, 9]],
                             columns=['a', 'b', 'c'])
        tm.assert_frame_equal(result, expected)

    @tm.capture_stdout
    def test_verbose_import(self):
        text = """a,b,c,d
one,1,2,3
one,1,2,3
,1,2,3
one,1,2,3
,1,2,3
,1,2,3
one,1,2,3
two,1,2,3"""

        # Engines are verbose in different ways.
        self.read_csv(StringIO(text), verbose=True)
        output = sys.stdout.getvalue()

        if self.engine == 'c':
            assert 'Tokenization took:' in output
            assert 'Parser memory cleanup took:' in output
        else:  # Python engine
            assert output == 'Filled 3 NA values in column a\n'

        # Reset the stdout buffer.
        sys.stdout = StringIO()

        text = """a,b,c,d
one,1,2,3
two,1,2,3
three,1,2,3
four,1,2,3
five,1,2,3
,1,2,3
seven,1,2,3
eight,1,2,3"""

        self.read_csv(StringIO(text), verbose=True, index_col=0)
        output = sys.stdout.getvalue()

        # Engines are verbose in different ways.
        if self.engine == 'c':
            assert 'Tokenization took:' in output
            assert 'Parser memory cleanup took:' in output
        else:  # Python engine
            assert output == 'Filled 1 NA values in column a\n'

    def test_iteration_open_handle(self):
        if PY3:
            pytest.skip(
                "won't work in Python 3 {0}".format(sys.version_info))

        with tm.ensure_clean() as path:
            with open(path, 'wb') as f:
                f.write('AAA\nBBB\nCCC\nDDD\nEEE\nFFF\nGGG')

            with open(path, 'rb') as f:
                for line in f:
                    if 'CCC' in line:
                        break

                if self.engine == 'c':
                    pytest.raises(Exception, self.read_table,
                                  f, squeeze=True, header=None)
                else:
                    result = self.read_table(f, squeeze=True, header=None)
                    expected = Series(['DDD', 'EEE', 'FFF', 'GGG'], name=0)
                    tm.assert_series_equal(result, expected)

    def test_1000_sep_with_decimal(self):
        data = """A|B|C
1|2,334.01|5
10|13|10.
"""
        expected = DataFrame({
            'A': [1, 10],
            'B': [2334.01, 13],
            'C': [5, 10.]
        })

        assert expected.A.dtype == 'int64'
        assert expected.B.dtype == 'float'
        assert expected.C.dtype == 'float'

        df = self.read_csv(StringIO(data), sep='|', thousands=',', decimal='.')
        tm.assert_frame_equal(df, expected)

        df = self.read_table(StringIO(data), sep='|',
                             thousands=',', decimal='.')
        tm.assert_frame_equal(df, expected)

        data_with_odd_sep = """A|B|C
1|2.334,01|5
10|13|10,
"""
        df = self.read_csv(StringIO(data_with_odd_sep),
                           sep='|', thousands='.', decimal=',')
        tm.assert_frame_equal(df, expected)

        df = self.read_table(StringIO(data_with_odd_sep),
                             sep='|', thousands='.', decimal=',')
        tm.assert_frame_equal(df, expected)

    def test_euro_decimal_format(self):
        data = """Id;Number1;Number2;Text1;Text2;Number3
1;1521,1541;187101,9543;ABC;poi;4,738797819
2;121,12;14897,76;DEF;uyt;0,377320872
3;878,158;108013,434;GHI;rez;2,735694704"""

        df2 = self.read_csv(StringIO(data), sep=';', decimal=',')
        assert df2['Number1'].dtype == float
        assert df2['Number2'].dtype == float
        assert df2['Number3'].dtype == float

    def test_read_duplicate_names(self):
        # See gh-7160
        data = "a,b,a\n0,1,2\n3,4,5"
        df = self.read_csv(StringIO(data))
        expected = DataFrame([[0, 1, 2], [3, 4, 5]],
                             columns=['a', 'b', 'a.1'])
        tm.assert_frame_equal(df, expected)

        data = "0,1,2\n3,4,5"
        df = self.read_csv(StringIO(data), names=["a", "b", "a"])
        expected = DataFrame([[0, 1, 2], [3, 4, 5]],
                             columns=['a', 'b', 'a.1'])
        tm.assert_frame_equal(df, expected)

    def test_inf_parsing(self):
        data = """\
,A
a,inf
b,-inf
c,+Inf
d,-Inf
e,INF
f,-INF
g,+INf
h,-INf
i,inF
j,-inF"""
        inf = float('inf')
        expected = Series([inf, -inf] * 5)

        df = self.read_csv(StringIO(data), index_col=0)
        tm.assert_almost_equal(df['A'].values, expected.values)

        df = self.read_csv(StringIO(data), index_col=0, na_filter=False)
        tm.assert_almost_equal(df['A'].values, expected.values)

    def test_raise_on_no_columns(self):
        # single newline
        data = "\n"
        pytest.raises(EmptyDataError, self.read_csv, StringIO(data))

        # test with more than a single newline
        data = "\n\n\n"
        pytest.raises(EmptyDataError, self.read_csv, StringIO(data))

    def test_compact_ints_use_unsigned(self):
        # see gh-13323
        data = 'a,b,c\n1,9,258'

        # sanity check
        expected = DataFrame({
            'a': np.array([1], dtype=np.int64),
            'b': np.array([9], dtype=np.int64),
            'c': np.array([258], dtype=np.int64),
        })
        out = self.read_csv(StringIO(data))
        tm.assert_frame_equal(out, expected)

        expected = DataFrame({
            'a': np.array([1], dtype=np.int8),
            'b': np.array([9], dtype=np.int8),
            'c': np.array([258], dtype=np.int16),
        })

        # default behaviour for 'use_unsigned'
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            out = self.read_csv(StringIO(data), compact_ints=True)
            tm.assert_frame_equal(out, expected)

        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            out = self.read_csv(StringIO(data), compact_ints=True,
                                use_unsigned=False)
            tm.assert_frame_equal(out, expected)

        expected = DataFrame({
            'a': np.array([1], dtype=np.uint8),
            'b': np.array([9], dtype=np.uint8),
            'c': np.array([258], dtype=np.uint16),
        })

        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            out = self.read_csv(StringIO(data), compact_ints=True,
                                use_unsigned=True)
            tm.assert_frame_equal(out, expected)

    def test_compact_ints_as_recarray(self):
        data = ('0,1,0,0\n'
                '1,1,0,0\n'
                '0,1,0,1')

        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            result = self.read_csv(StringIO(data), delimiter=',', header=None,
                                   compact_ints=True, as_recarray=True)
            ex_dtype = np.dtype([(str(i), 'i1') for i in range(4)])
            assert result.dtype == ex_dtype

        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            result = self.read_csv(StringIO(data), delimiter=',', header=None,
                                   as_recarray=True, compact_ints=True,
                                   use_unsigned=True)
            ex_dtype = np.dtype([(str(i), 'u1') for i in range(4)])
            assert result.dtype == ex_dtype

    def test_as_recarray(self):
        # basic test
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = 'a,b\n1,a\n2,b'
            expected = np.array([(1, 'a'), (2, 'b')],
                                dtype=[('a', '=i8'), ('b', 'O')])
            out = self.read_csv(StringIO(data), as_recarray=True)
            tm.assert_numpy_array_equal(out, expected)

        # index_col ignored
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = 'a,b\n1,a\n2,b'
            expected = np.array([(1, 'a'), (2, 'b')],
                                dtype=[('a', '=i8'), ('b', 'O')])
            out = self.read_csv(StringIO(data), as_recarray=True, index_col=0)
            tm.assert_numpy_array_equal(out, expected)

        # respects names
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = '1,a\n2,b'
            expected = np.array([(1, 'a'), (2, 'b')],
                                dtype=[('a', '=i8'), ('b', 'O')])
            out = self.read_csv(StringIO(data), names=['a', 'b'],
                                header=None, as_recarray=True)
            tm.assert_numpy_array_equal(out, expected)

        # header order is respected even though it conflicts
        # with the natural ordering of the column names
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = 'b,a\n1,a\n2,b'
            expected = np.array([(1, 'a'), (2, 'b')],
                                dtype=[('b', '=i8'), ('a', 'O')])
            out = self.read_csv(StringIO(data), as_recarray=True)
            tm.assert_numpy_array_equal(out, expected)

        # overrides the squeeze parameter
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = 'a\n1'
            expected = np.array([(1,)], dtype=[('a', '=i8')])
            out = self.read_csv(StringIO(data), as_recarray=True, squeeze=True)
            tm.assert_numpy_array_equal(out, expected)

        # does data conversions before doing recarray conversion
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = 'a,b\n1,a\n2,b'
            conv = lambda x: int(x) + 1
            expected = np.array([(2, 'a'), (3, 'b')],
                                dtype=[('a', '=i8'), ('b', 'O')])
            out = self.read_csv(StringIO(data), as_recarray=True,
                                converters={'a': conv})
            tm.assert_numpy_array_equal(out, expected)

        # filters by usecols before doing recarray conversion
        with tm.assert_produces_warning(
                FutureWarning, check_stacklevel=False):
            data = 'a,b\n1,a\n2,b'
            expected = np.array([(1,), (2,)], dtype=[('a', '=i8')])
            out = self.read_csv(StringIO(data), as_recarray=True,
                                usecols=['a'])
            tm.assert_numpy_array_equal(out, expected)

    def test_memory_map(self):
        mmap_file = os.path.join(self.dirpath, 'test_mmap.csv')
        expected = DataFrame({
            'a': [1, 2, 3],
            'b': ['one', 'two', 'three'],
            'c': ['I', 'II', 'III']
        })

        out = self.read_csv(mmap_file, memory_map=True)
        tm.assert_frame_equal(out, expected)

    def test_null_byte_char(self):
        # see gh-2741
        data = '\x00,foo'
        cols = ['a', 'b']

        expected = DataFrame([[np.nan, 'foo']],
                             columns=cols)

        if self.engine == 'c':
            out = self.read_csv(StringIO(data), names=cols)
            tm.assert_frame_equal(out, expected)
        else:
            msg = "NULL byte detected"
            with tm.assert_raises_regex(ParserError, msg):
                self.read_csv(StringIO(data), names=cols)

    def test_utf8_bom(self):
        # see gh-4793
        bom = u('\ufeff')
        utf8 = 'utf-8'

        def _encode_data_with_bom(_data):
            bom_data = (bom + _data).encode(utf8)
            return BytesIO(bom_data)

        # basic test
        data = 'a\n1'
        expected = DataFrame({'a': [1]})

        out = self.read_csv(_encode_data_with_bom(data),
                            encoding=utf8)
        tm.assert_frame_equal(out, expected)

        # test with "regular" quoting
        data = '"a"\n1'
        expected = DataFrame({'a': [1]})

        out = self.read_csv(_encode_data_with_bom(data),
                            encoding=utf8, quotechar='"')
        tm.assert_frame_equal(out, expected)

        # test in a data row instead of header
        data = 'b\n1'
        expected = DataFrame({'a': ['b', '1']})

        out = self.read_csv(_encode_data_with_bom(data),
                            encoding=utf8, names=['a'])
        tm.assert_frame_equal(out, expected)

        # test in empty data row with skipping
        data = '\n1'
        expected = DataFrame({'a': [1]})

        out = self.read_csv(_encode_data_with_bom(data),
                            encoding=utf8, names=['a'],
                            skip_blank_lines=True)
        tm.assert_frame_equal(out, expected)

        # test in empty data row without skipping
        data = '\n1'
        expected = DataFrame({'a': [np.nan, 1.0]})

        out = self.read_csv(_encode_data_with_bom(data),
                            encoding=utf8, names=['a'],
                            skip_blank_lines=False)
        tm.assert_frame_equal(out, expected)

    def test_temporary_file(self):
        # see gh-13398
        data1 = "0 0"

        from tempfile import TemporaryFile
        new_file = TemporaryFile("w+")
        new_file.write(data1)
        new_file.flush()
        new_file.seek(0)

        result = self.read_csv(new_file, sep=r'\s+', header=None)
        new_file.close()
        expected = DataFrame([[0, 0]])
        tm.assert_frame_equal(result, expected)

    def test_read_csv_utf_aliases(self):
        # see gh issue 13549
        expected = pd.DataFrame({'mb_num': [4.8], 'multibyte': ['test']})
        for byte in [8, 16]:
            for fmt in ['utf-{0}', 'utf_{0}', 'UTF-{0}', 'UTF_{0}']:
                encoding = fmt.format(byte)
                data = 'mb_num,multibyte\n4.8,test'.encode(encoding)
                result = self.read_csv(BytesIO(data), encoding=encoding)
                tm.assert_frame_equal(result, expected)

    def test_internal_eof_byte(self):
        # see gh-5500
        data = "a,b\n1\x1a,2"

        expected = pd.DataFrame([["1\x1a", 2]], columns=['a', 'b'])
        result = self.read_csv(StringIO(data))
        tm.assert_frame_equal(result, expected)

    def test_file_handles(self):
        # GH 14418 - don't close user provided file handles

        fh = StringIO('a,b\n1,2')
        self.read_csv(fh)
        assert not fh.closed

        with open(self.csv1, 'r') as f:
            self.read_csv(f)
            assert not f.closed

        # mmap not working with python engine
        if self.engine != 'python':

            import mmap
            with open(self.csv1, 'r') as f:
                m = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
                self.read_csv(m)
                # closed attribute new in python 3.2
                if PY3:
                    assert not m.closed
                m.close()

    def test_invalid_file_buffer(self):
        # see gh-15337

        class InvalidBuffer(object):
            pass

        msg = "Invalid file path or buffer object type"

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(InvalidBuffer())

        # gh-16135: we want to ensure that "tell" and "seek"
        # aren't actually being used when we call `read_csv`
        #
        # Thus, while the object may look "invalid" (these
        # methods are attributes of the `StringIO` class),
        # it is still a valid file-object for our purposes.
        class NoSeekTellBuffer(StringIO):
            def tell(self):
                raise AttributeError("No tell method")

            def seek(self, pos, whence=0):
                raise AttributeError("No seek method")

        data = "a\n1"

        expected = pd.DataFrame({"a": [1]})
        result = self.read_csv(NoSeekTellBuffer(data))

        tm.assert_frame_equal(result, expected)

        if PY3:
            from unittest import mock

            with tm.assert_raises_regex(ValueError, msg):
                self.read_csv(mock.Mock())

    @tm.capture_stderr
    def test_skip_bad_lines(self):
        # see gh-15925
        data = 'a\n1\n1,2,3\n4\n5,6,7'

        with pytest.raises(ParserError):
            self.read_csv(StringIO(data))

        with pytest.raises(ParserError):
            self.read_csv(StringIO(data), error_bad_lines=True)

        expected = DataFrame({'a': [1, 4]})

        out = self.read_csv(StringIO(data),
                            error_bad_lines=False,
                            warn_bad_lines=False)
        tm.assert_frame_equal(out, expected)

        val = sys.stderr.getvalue()
        assert val == ''

        # Reset the stderr buffer.
        sys.stderr = StringIO()

        out = self.read_csv(StringIO(data),
                            error_bad_lines=False,
                            warn_bad_lines=True)
        tm.assert_frame_equal(out, expected)

        val = sys.stderr.getvalue()
        assert 'Skipping line 3' in val
        assert 'Skipping line 5' in val
