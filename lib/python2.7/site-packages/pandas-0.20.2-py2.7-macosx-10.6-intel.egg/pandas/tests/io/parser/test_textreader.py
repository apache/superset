# -*- coding: utf-8 -*-

"""
Tests the TextReader class in parsers.pyx, which
is integral to the C engine in parsers.py
"""

import pytest

from pandas.compat import StringIO, BytesIO, map
from pandas import compat

import os
import sys

from numpy import nan
import numpy as np

from pandas import DataFrame
from pandas.io.parsers import (read_csv, TextFileReader)
from pandas.util.testing import assert_frame_equal

import pandas.util.testing as tm

from pandas._libs.parsers import TextReader
import pandas._libs.parsers as parser


class TestTextReader(object):

    def setup_method(self, method):
        self.dirpath = tm.get_data_path()
        self.csv1 = os.path.join(self.dirpath, 'test1.csv')
        self.csv2 = os.path.join(self.dirpath, 'test2.csv')
        self.xls1 = os.path.join(self.dirpath, 'test.xls')

    def test_file_handle(self):
        try:
            f = open(self.csv1, 'rb')
            reader = TextReader(f)
            result = reader.read()  # noqa
        finally:
            f.close()

    def test_string_filename(self):
        reader = TextReader(self.csv1, header=None)
        reader.read()

    def test_file_handle_mmap(self):
        try:
            f = open(self.csv1, 'rb')
            reader = TextReader(f, memory_map=True, header=None)
            reader.read()
        finally:
            f.close()

    def test_StringIO(self):
        with open(self.csv1, 'rb') as f:
            text = f.read()
        src = BytesIO(text)
        reader = TextReader(src, header=None)
        reader.read()

    def test_string_factorize(self):
        # should this be optional?
        data = 'a\nb\na\nb\na'
        reader = TextReader(StringIO(data), header=None)
        result = reader.read()
        assert len(set(map(id, result[0]))) == 2

    def test_skipinitialspace(self):
        data = ('a,   b\n'
                'a,   b\n'
                'a,   b\n'
                'a,   b')

        reader = TextReader(StringIO(data), skipinitialspace=True,
                            header=None)
        result = reader.read()

        tm.assert_numpy_array_equal(result[0], np.array(['a', 'a', 'a', 'a'],
                                                        dtype=np.object_))
        tm.assert_numpy_array_equal(result[1], np.array(['b', 'b', 'b', 'b'],
                                                        dtype=np.object_))

    def test_parse_booleans(self):
        data = 'True\nFalse\nTrue\nTrue'

        reader = TextReader(StringIO(data), header=None)
        result = reader.read()

        assert result[0].dtype == np.bool_

    def test_delimit_whitespace(self):
        data = 'a  b\na\t\t "b"\n"a"\t \t b'

        reader = TextReader(StringIO(data), delim_whitespace=True,
                            header=None)
        result = reader.read()

        tm.assert_numpy_array_equal(result[0], np.array(['a', 'a', 'a'],
                                                        dtype=np.object_))
        tm.assert_numpy_array_equal(result[1], np.array(['b', 'b', 'b'],
                                                        dtype=np.object_))

    def test_embedded_newline(self):
        data = 'a\n"hello\nthere"\nthis'

        reader = TextReader(StringIO(data), header=None)
        result = reader.read()

        expected = np.array(['a', 'hello\nthere', 'this'], dtype=np.object_)
        tm.assert_numpy_array_equal(result[0], expected)

    def test_euro_decimal(self):
        data = '12345,67\n345,678'

        reader = TextReader(StringIO(data), delimiter=':',
                            decimal=',', header=None)
        result = reader.read()

        expected = np.array([12345.67, 345.678])
        tm.assert_almost_equal(result[0], expected)

    def test_integer_thousands(self):
        data = '123,456\n12,500'

        reader = TextReader(StringIO(data), delimiter=':',
                            thousands=',', header=None)
        result = reader.read()

        expected = np.array([123456, 12500], dtype=np.int64)
        tm.assert_almost_equal(result[0], expected)

    def test_integer_thousands_alt(self):
        data = '123.456\n12.500'

        reader = TextFileReader(StringIO(data), delimiter=':',
                                thousands='.', header=None)
        result = reader.read()

        expected = DataFrame([123456, 12500])
        tm.assert_frame_equal(result, expected)

    @tm.capture_stderr
    def test_skip_bad_lines(self):
        # too many lines, see #2430 for why
        data = ('a:b:c\n'
                'd:e:f\n'
                'g:h:i\n'
                'j:k:l:m\n'
                'l:m:n\n'
                'o:p:q:r')

        reader = TextReader(StringIO(data), delimiter=':',
                            header=None)
        pytest.raises(parser.ParserError, reader.read)

        reader = TextReader(StringIO(data), delimiter=':',
                            header=None,
                            error_bad_lines=False,
                            warn_bad_lines=False)
        result = reader.read()
        expected = {0: ['a', 'd', 'g', 'l'],
                    1: ['b', 'e', 'h', 'm'],
                    2: ['c', 'f', 'i', 'n']}
        assert_array_dicts_equal(result, expected)

        reader = TextReader(StringIO(data), delimiter=':',
                            header=None,
                            error_bad_lines=False,
                            warn_bad_lines=True)
        reader.read()
        val = sys.stderr.getvalue()

        assert 'Skipping line 4' in val
        assert 'Skipping line 6' in val

    def test_header_not_enough_lines(self):
        data = ('skip this\n'
                'skip this\n'
                'a,b,c\n'
                '1,2,3\n'
                '4,5,6')

        reader = TextReader(StringIO(data), delimiter=',', header=2)
        header = reader.header
        expected = [['a', 'b', 'c']]
        assert header == expected

        recs = reader.read()
        expected = {0: [1, 4], 1: [2, 5], 2: [3, 6]}
        assert_array_dicts_equal(expected, recs)

        # not enough rows
        pytest.raises(parser.ParserError, TextReader, StringIO(data),
                      delimiter=',', header=5, as_recarray=True)

    def test_header_not_enough_lines_as_recarray(self):
        data = ('skip this\n'
                'skip this\n'
                'a,b,c\n'
                '1,2,3\n'
                '4,5,6')

        reader = TextReader(StringIO(data), delimiter=',', header=2,
                            as_recarray=True)
        header = reader.header
        expected = [['a', 'b', 'c']]
        assert header == expected

        recs = reader.read()
        expected = {'a': [1, 4], 'b': [2, 5], 'c': [3, 6]}
        assert_array_dicts_equal(expected, recs)

        # not enough rows
        pytest.raises(parser.ParserError, TextReader, StringIO(data),
                      delimiter=',', header=5, as_recarray=True)

    def test_escapechar(self):
        data = ('\\"hello world\"\n'
                '\\"hello world\"\n'
                '\\"hello world\"')

        reader = TextReader(StringIO(data), delimiter=',', header=None,
                            escapechar='\\')
        result = reader.read()
        expected = {0: ['"hello world"'] * 3}
        assert_array_dicts_equal(result, expected)

    def test_eof_has_eol(self):
        # handling of new line at EOF
        pass

    def test_na_substitution(self):
        pass

    def test_numpy_string_dtype(self):
        data = """\
a,1
aa,2
aaa,3
aaaa,4
aaaaa,5"""

        def _make_reader(**kwds):
            return TextReader(StringIO(data), delimiter=',', header=None,
                              **kwds)

        reader = _make_reader(dtype='S5,i4')
        result = reader.read()

        assert result[0].dtype == 'S5'

        ex_values = np.array(['a', 'aa', 'aaa', 'aaaa', 'aaaaa'], dtype='S5')
        assert (result[0] == ex_values).all()
        assert result[1].dtype == 'i4'

        reader = _make_reader(dtype='S4')
        result = reader.read()
        assert result[0].dtype == 'S4'
        ex_values = np.array(['a', 'aa', 'aaa', 'aaaa', 'aaaa'], dtype='S4')
        assert (result[0] == ex_values).all()
        assert result[1].dtype == 'S4'

    def test_numpy_string_dtype_as_recarray(self):
        data = """\
a,1
aa,2
aaa,3
aaaa,4
aaaaa,5"""

        def _make_reader(**kwds):
            return TextReader(StringIO(data), delimiter=',', header=None,
                              **kwds)

        reader = _make_reader(dtype='S4', as_recarray=True)
        result = reader.read()
        assert result['0'].dtype == 'S4'
        ex_values = np.array(['a', 'aa', 'aaa', 'aaaa', 'aaaa'], dtype='S4')
        assert (result['0'] == ex_values).all()
        assert result['1'].dtype == 'S4'

    def test_pass_dtype(self):
        data = """\
one,two
1,a
2,b
3,c
4,d"""

        def _make_reader(**kwds):
            return TextReader(StringIO(data), delimiter=',', **kwds)

        reader = _make_reader(dtype={'one': 'u1', 1: 'S1'})
        result = reader.read()
        assert result[0].dtype == 'u1'
        assert result[1].dtype == 'S1'

        reader = _make_reader(dtype={'one': np.uint8, 1: object})
        result = reader.read()
        assert result[0].dtype == 'u1'
        assert result[1].dtype == 'O'

        reader = _make_reader(dtype={'one': np.dtype('u1'),
                                     1: np.dtype('O')})
        result = reader.read()
        assert result[0].dtype == 'u1'
        assert result[1].dtype == 'O'

    def test_usecols(self):
        data = """\
a,b,c
1,2,3
4,5,6
7,8,9
10,11,12"""

        def _make_reader(**kwds):
            return TextReader(StringIO(data), delimiter=',', **kwds)

        reader = _make_reader(usecols=(1, 2))
        result = reader.read()

        exp = _make_reader().read()
        assert len(result) == 2
        assert (result[1] == exp[1]).all()
        assert (result[2] == exp[2]).all()

    def test_cr_delimited(self):
        def _test(text, **kwargs):
            nice_text = text.replace('\r', '\r\n')
            result = TextReader(StringIO(text), **kwargs).read()
            expected = TextReader(StringIO(nice_text), **kwargs).read()
            assert_array_dicts_equal(result, expected)

        data = 'a,b,c\r1,2,3\r4,5,6\r7,8,9\r10,11,12'
        _test(data, delimiter=',')

        data = 'a  b  c\r1  2  3\r4  5  6\r7  8  9\r10  11  12'
        _test(data, delim_whitespace=True)

        data = 'a,b,c\r1,2,3\r4,5,6\r,88,9\r10,11,12'
        _test(data, delimiter=',')

        sample = ('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O\r'
                  'AAAAA,BBBBB,0,0,0,0,0,0,0,0,0,0,0,0,0\r'
                  ',BBBBB,0,0,0,0,0,0,0,0,0,0,0,0,0')
        _test(sample, delimiter=',')

        data = 'A  B  C\r  2  3\r4  5  6'
        _test(data, delim_whitespace=True)

        data = 'A B C\r2 3\r4 5 6'
        _test(data, delim_whitespace=True)

    def test_empty_field_eof(self):
        data = 'a,b,c\n1,2,3\n4,,'

        result = TextReader(StringIO(data), delimiter=',').read()

        expected = {0: np.array([1, 4]),
                    1: np.array(['2', ''], dtype=object),
                    2: np.array(['3', ''], dtype=object)}
        assert_array_dicts_equal(result, expected)

        # GH5664
        a = DataFrame([['b'], [nan]], columns=['a'], index=['a', 'c'])
        b = DataFrame([[1, 1, 1, 0], [1, 1, 1, 0]],
                      columns=list('abcd'),
                      index=[1, 1])
        c = DataFrame([[1, 2, 3, 4], [6, nan, nan, nan],
                       [8, 9, 10, 11], [13, 14, nan, nan]],
                      columns=list('abcd'),
                      index=[0, 5, 7, 12])

        for _ in range(100):
            df = read_csv(StringIO('a,b\nc\n'), skiprows=0,
                          names=['a'], engine='c')
            assert_frame_equal(df, a)

            df = read_csv(StringIO('1,1,1,1,0\n' * 2 + '\n' * 2),
                          names=list("abcd"), engine='c')
            assert_frame_equal(df, b)

            df = read_csv(StringIO('0,1,2,3,4\n5,6\n7,8,9,10,11\n12,13,14'),
                          names=list('abcd'), engine='c')
            assert_frame_equal(df, c)

    def test_empty_csv_input(self):
        # GH14867
        df = read_csv(StringIO(), chunksize=20, header=None,
                      names=['a', 'b', 'c'])
        assert isinstance(df, TextFileReader)


def assert_array_dicts_equal(left, right):
    for k, v in compat.iteritems(left):
        assert(np.array_equal(v, right[k]))
