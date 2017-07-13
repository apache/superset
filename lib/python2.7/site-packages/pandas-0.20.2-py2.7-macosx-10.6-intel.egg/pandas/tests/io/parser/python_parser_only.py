# -*- coding: utf-8 -*-

"""
Tests that apply specifically to the Python parser. Unless specifically
stated as a Python-specific issue, the goal is to eventually move as many of
these tests out of this module as soon as the C parser can accept further
arguments when parsing.
"""

import csv
import pytest

import pandas.util.testing as tm
from pandas import DataFrame, Index
from pandas import compat
from pandas.errors import ParserError
from pandas.compat import StringIO, BytesIO, u


class PythonParserTests(object):

    def test_invalid_skipfooter(self):
        text = "a\n1\n2"

        # see gh-15925 (comment)
        msg = "skipfooter must be an integer"
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(text), skipfooter="foo")

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(text), skipfooter=1.5)

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(text), skipfooter=True)

        msg = "skipfooter cannot be negative"
        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(text), skipfooter=-1)

    def test_sniff_delimiter(self):
        text = """index|A|B|C
foo|1|2|3
bar|4|5|6
baz|7|8|9
"""
        data = self.read_csv(StringIO(text), index_col=0, sep=None)
        tm.assert_index_equal(data.index,
                              Index(['foo', 'bar', 'baz'], name='index'))

        data2 = self.read_csv(StringIO(text), index_col=0, delimiter='|')
        tm.assert_frame_equal(data, data2)

        text = """ignore this
ignore this too
index|A|B|C
foo|1|2|3
bar|4|5|6
baz|7|8|9
"""
        data3 = self.read_csv(StringIO(text), index_col=0,
                              sep=None, skiprows=2)
        tm.assert_frame_equal(data, data3)

        text = u("""ignore this
ignore this too
index|A|B|C
foo|1|2|3
bar|4|5|6
baz|7|8|9
""").encode('utf-8')

        s = BytesIO(text)
        if compat.PY3:
            # somewhat False since the code never sees bytes
            from io import TextIOWrapper
            s = TextIOWrapper(s, encoding='utf-8')

        data4 = self.read_csv(s, index_col=0, sep=None, skiprows=2,
                              encoding='utf-8')
        tm.assert_frame_equal(data, data4)

    def test_BytesIO_input(self):
        if not compat.PY3:
            pytest.skip(
                "Bytes-related test - only needs to work on Python 3")

        data = BytesIO("שלום::1234\n562::123".encode('cp1255'))
        result = self.read_table(data, sep="::", encoding='cp1255')
        expected = DataFrame([[562, 123]], columns=["שלום", "1234"])
        tm.assert_frame_equal(result, expected)

    def test_single_line(self):
        # see gh-6607: sniff separator
        df = self.read_csv(StringIO('1,2'), names=['a', 'b'],
                           header=None, sep=None)
        tm.assert_frame_equal(DataFrame({'a': [1], 'b': [2]}), df)

    def test_skipfooter(self):
        # see gh-6607
        data = """A,B,C
1,2,3
4,5,6
7,8,9
want to skip this
also also skip this
"""
        result = self.read_csv(StringIO(data), skipfooter=2)
        no_footer = '\n'.join(data.split('\n')[:-3])
        expected = self.read_csv(StringIO(no_footer))
        tm.assert_frame_equal(result, expected)

        result = self.read_csv(StringIO(data), nrows=3)
        tm.assert_frame_equal(result, expected)

        # skipfooter alias
        result = self.read_csv(StringIO(data), skipfooter=2)
        no_footer = '\n'.join(data.split('\n')[:-3])
        expected = self.read_csv(StringIO(no_footer))
        tm.assert_frame_equal(result, expected)

    def test_decompression_regex_sep(self):
        # see gh-6607

        try:
            import gzip
            import bz2
        except ImportError:
            pytest.skip('need gzip and bz2 to run')

        with open(self.csv1, 'rb') as f:
            data = f.read()
        data = data.replace(b',', b'::')
        expected = self.read_csv(self.csv1)

        with tm.ensure_clean() as path:
            tmp = gzip.GzipFile(path, mode='wb')
            tmp.write(data)
            tmp.close()

            result = self.read_csv(path, sep='::', compression='gzip')
            tm.assert_frame_equal(result, expected)

        with tm.ensure_clean() as path:
            tmp = bz2.BZ2File(path, mode='wb')
            tmp.write(data)
            tmp.close()

            result = self.read_csv(path, sep='::', compression='bz2')
            tm.assert_frame_equal(result, expected)

            pytest.raises(ValueError, self.read_csv,
                          path, compression='bz3')

    def test_read_table_buglet_4x_multiindex(self):
        # see gh-6607
        text = """                      A       B       C       D        E
one two three   four
a   b   10.0032 5    -0.5109 -2.3358 -0.4645  0.05076  0.3640
a   q   20      4     0.4473  1.4152  0.2834  1.00661  0.1744
x   q   30      3    -0.6662 -0.5243 -0.3580  0.89145  2.5838"""

        df = self.read_table(StringIO(text), sep=r'\s+')
        assert df.index.names == ('one', 'two', 'three', 'four')

        # see gh-6893
        data = '      A B C\na b c\n1 3 7 0 3 6\n3 1 4 1 5 9'
        expected = DataFrame.from_records(
            [(1, 3, 7, 0, 3, 6), (3, 1, 4, 1, 5, 9)],
            columns=list('abcABC'), index=list('abc'))
        actual = self.read_table(StringIO(data), sep=r'\s+')
        tm.assert_frame_equal(actual, expected)

    def test_skipfooter_with_decimal(self):
        # see gh-6971
        data = '1#2\n3#4'
        expected = DataFrame({'a': [1.2, 3.4]})

        result = self.read_csv(StringIO(data), names=['a'],
                               decimal='#')
        tm.assert_frame_equal(result, expected)

        # the stray footer line should not mess with the
        # casting of the first t    wo lines if we skip it
        data = data + '\nFooter'
        result = self.read_csv(StringIO(data), names=['a'],
                               decimal='#', skipfooter=1)
        tm.assert_frame_equal(result, expected)

    def test_encoding_non_utf8_multichar_sep(self):
        # see gh-3404
        expected = DataFrame({'a': [1], 'b': [2]})

        for sep in ['::', '#####', '!!!', '123', '#1!c5',
                    '%!c!d', '@@#4:2', '_!pd#_']:
            data = '1' + sep + '2'

            for encoding in ['utf-16', 'utf-16-be', 'utf-16-le',
                             'utf-32', 'cp037']:
                encoded_data = data.encode(encoding)
                result = self.read_csv(BytesIO(encoded_data),
                                       sep=sep, names=['a', 'b'],
                                       encoding=encoding)
                tm.assert_frame_equal(result, expected)

    def test_multi_char_sep_quotes(self):
        # see gh-13374

        data = 'a,,b\n1,,a\n2,,"2,,b"'
        msg = 'ignored when a multi-char delimiter is used'

        with tm.assert_raises_regex(ParserError, msg):
            self.read_csv(StringIO(data), sep=',,')

        # We expect no match, so there should be an assertion
        # error out of the inner context manager.
        with pytest.raises(AssertionError):
            with tm.assert_raises_regex(ParserError, msg):
                self.read_csv(StringIO(data), sep=',,',
                              quoting=csv.QUOTE_NONE)

    def test_skipfooter_bad_row(self):
        # see gh-13879
        # see gh-15910

        msg = 'parsing errors in the skipped footer rows'

        for data in ('a\n1\n"b"a',
                     'a,b,c\ncat,foo,bar\ndog,foo,"baz'):
            with tm.assert_raises_regex(ParserError, msg):
                self.read_csv(StringIO(data), skipfooter=1)

            # We expect no match, so there should be an assertion
            # error out of the inner context manager.
            with pytest.raises(AssertionError):
                with tm.assert_raises_regex(ParserError, msg):
                    self.read_csv(StringIO(data))
