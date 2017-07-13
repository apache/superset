# -*- coding: utf-8 -*-

"""
Test output formatting for Series/DataFrame, including to_string & reprs
"""

from __future__ import print_function
import re

import itertools
from operator import methodcaller
import os
import sys
import warnings
from datetime import datetime

import pytest

import numpy as np
import pandas as pd
from pandas import (DataFrame, Series, Index, Timestamp, MultiIndex,
                    date_range, NaT, read_table)
from pandas.compat import (range, zip, lrange, StringIO, PY3,
                           u, lzip, is_platform_windows,
                           is_platform_32bit)
import pandas.compat as compat

import pandas.io.formats.format as fmt
import pandas.io.formats.printing as printing

import pandas.util.testing as tm
from pandas.io.formats.terminal import get_terminal_size
from pandas.core.config import (set_option, get_option, option_context,
                                reset_option)

use_32bit_repr = is_platform_windows() or is_platform_32bit()

_frame = DataFrame(tm.getSeriesData())


def curpath():
    pth, _ = os.path.split(os.path.abspath(__file__))
    return pth


def has_info_repr(df):
    r = repr(df)
    c1 = r.split('\n')[0].startswith("<class")
    c2 = r.split('\n')[0].startswith(r"&lt;class")  # _repr_html_
    return c1 or c2


def has_non_verbose_info_repr(df):
    has_info = has_info_repr(df)
    r = repr(df)

    # 1. <class>
    # 2. Index
    # 3. Columns
    # 4. dtype
    # 5. memory usage
    # 6. trailing newline
    nv = len(r.split('\n')) == 6
    return has_info and nv


def has_horizontally_truncated_repr(df):
    try:  # Check header row
        fst_line = np.array(repr(df).splitlines()[0].split())
        cand_col = np.where(fst_line == '...')[0][0]
    except:
        return False
    # Make sure each row has this ... in the same place
    r = repr(df)
    for ix, l in enumerate(r.splitlines()):
        if not r.split()[cand_col] == '...':
            return False
    return True


def has_vertically_truncated_repr(df):
    r = repr(df)
    only_dot_row = False
    for row in r.splitlines():
        if re.match(r'^[\.\ ]+$', row):
            only_dot_row = True
    return only_dot_row


def has_truncated_repr(df):
    return has_horizontally_truncated_repr(
        df) or has_vertically_truncated_repr(df)


def has_doubly_truncated_repr(df):
    return has_horizontally_truncated_repr(
        df) and has_vertically_truncated_repr(df)


def has_expanded_repr(df):
    r = repr(df)
    for line in r.split('\n'):
        if line.endswith('\\'):
            return True
    return False


class TestDataFrameFormatting(object):

    def setup_method(self, method):
        self.warn_filters = warnings.filters
        warnings.filterwarnings('ignore', category=FutureWarning,
                                module=".*format")

        self.frame = _frame.copy()

    def teardown_method(self, method):
        warnings.filters = self.warn_filters

    def test_repr_embedded_ndarray(self):
        arr = np.empty(10, dtype=[('err', object)])
        for i in range(len(arr)):
            arr['err'][i] = np.random.randn(i)

        df = DataFrame(arr)
        repr(df['err'])
        repr(df)
        df.to_string()

    def test_eng_float_formatter(self):
        self.frame.loc[5] = 0

        fmt.set_eng_float_format()
        repr(self.frame)

        fmt.set_eng_float_format(use_eng_prefix=True)
        repr(self.frame)

        fmt.set_eng_float_format(accuracy=0)
        repr(self.frame)
        tm.reset_display_options()

    def test_show_null_counts(self):

        df = DataFrame(1, columns=range(10), index=range(10))
        df.iloc[1, 1] = np.nan

        def check(null_counts, result):
            buf = StringIO()
            df.info(buf=buf, null_counts=null_counts)
            assert ('non-null' in buf.getvalue()) is result

        with option_context('display.max_info_rows', 20,
                            'display.max_info_columns', 20):
            check(None, True)
            check(True, True)
            check(False, False)

        with option_context('display.max_info_rows', 5,
                            'display.max_info_columns', 5):
            check(None, False)
            check(True, False)
            check(False, False)

    def test_repr_tuples(self):
        buf = StringIO()

        df = DataFrame({'tups': lzip(range(10), range(10))})
        repr(df)
        df.to_string(col_space=10, buf=buf)

    def test_repr_truncation(self):
        max_len = 20
        with option_context("display.max_colwidth", max_len):
            df = DataFrame({'A': np.random.randn(10),
                            'B': [tm.rands(np.random.randint(
                                max_len - 1, max_len + 1)) for i in range(10)
            ]})
            r = repr(df)
            r = r[r.find('\n') + 1:]

            adj = fmt._get_adjustment()

            for line, value in lzip(r.split('\n'), df['B']):
                if adj.len(value) + 1 > max_len:
                    assert '...' in line
                else:
                    assert '...' not in line

        with option_context("display.max_colwidth", 999999):
            assert '...' not in repr(df)

        with option_context("display.max_colwidth", max_len + 2):
            assert '...' not in repr(df)

    def test_repr_chop_threshold(self):
        df = DataFrame([[0.1, 0.5], [0.5, -0.1]])
        pd.reset_option("display.chop_threshold")  # default None
        assert repr(df) == '     0    1\n0  0.1  0.5\n1  0.5 -0.1'

        with option_context("display.chop_threshold", 0.2):
            assert repr(df) == '     0    1\n0  0.0  0.5\n1  0.5  0.0'

        with option_context("display.chop_threshold", 0.6):
            assert repr(df) == '     0    1\n0  0.0  0.0\n1  0.0  0.0'

        with option_context("display.chop_threshold", None):
            assert repr(df) == '     0    1\n0  0.1  0.5\n1  0.5 -0.1'

    def test_repr_obeys_max_seq_limit(self):
        with option_context("display.max_seq_items", 2000):
            assert len(printing.pprint_thing(lrange(1000))) > 1000

        with option_context("display.max_seq_items", 5):
            assert len(printing.pprint_thing(lrange(1000))) < 100

    def test_repr_set(self):
        assert printing.pprint_thing(set([1])) == '{1}'

    def test_repr_is_valid_construction_code(self):
        # for the case of Index, where the repr is traditional rather then
        # stylized
        idx = Index(['a', 'b'])
        res = eval("pd." + repr(idx))
        tm.assert_series_equal(Series(res), Series(idx))

    def test_repr_should_return_str(self):
        # http://docs.python.org/py3k/reference/datamodel.html#object.__repr__
        # http://docs.python.org/reference/datamodel.html#object.__repr__
        # "...The return value must be a string object."

        # (str on py2.x, str (unicode) on py3)

        data = [8, 5, 3, 5]
        index1 = [u("\u03c3"), u("\u03c4"), u("\u03c5"), u("\u03c6")]
        cols = [u("\u03c8")]
        df = DataFrame(data, columns=cols, index=index1)
        assert type(df.__repr__()) == str  # both py2 / 3

    def test_repr_no_backslash(self):
        with option_context('mode.sim_interactive', True):
            df = DataFrame(np.random.randn(10, 4))
            assert '\\' not in repr(df)

    def test_expand_frame_repr(self):
        df_small = DataFrame('hello', [0], [0])
        df_wide = DataFrame('hello', [0], lrange(10))
        df_tall = DataFrame('hello', lrange(30), lrange(5))

        with option_context('mode.sim_interactive', True):
            with option_context('display.max_columns', 10, 'display.width', 20,
                                'display.max_rows', 20,
                                'display.show_dimensions', True):
                with option_context('display.expand_frame_repr', True):
                    assert not has_truncated_repr(df_small)
                    assert not has_expanded_repr(df_small)
                    assert not has_truncated_repr(df_wide)
                    assert has_expanded_repr(df_wide)
                    assert has_vertically_truncated_repr(df_tall)
                    assert has_expanded_repr(df_tall)

                with option_context('display.expand_frame_repr', False):
                    assert not has_truncated_repr(df_small)
                    assert not has_expanded_repr(df_small)
                    assert not has_horizontally_truncated_repr(df_wide)
                    assert not has_expanded_repr(df_wide)
                    assert has_vertically_truncated_repr(df_tall)
                    assert not has_expanded_repr(df_tall)

    def test_repr_non_interactive(self):
        # in non interactive mode, there can be no dependency on the
        # result of terminal auto size detection
        df = DataFrame('hello', lrange(1000), lrange(5))

        with option_context('mode.sim_interactive', False, 'display.width', 0,
                            'display.height', 0, 'display.max_rows', 5000):
            assert not has_truncated_repr(df)
            assert not has_expanded_repr(df)

    def test_repr_max_columns_max_rows(self):
        term_width, term_height = get_terminal_size()
        if term_width < 10 or term_height < 10:
            pytest.skip("terminal size too small, "
                        "{0} x {1}".format(term_width, term_height))

        def mkframe(n):
            index = ['%05d' % i for i in range(n)]
            return DataFrame(0, index, index)

        df6 = mkframe(6)
        df10 = mkframe(10)
        with option_context('mode.sim_interactive', True):
            with option_context('display.width', term_width * 2):
                with option_context('display.max_rows', 5,
                                    'display.max_columns', 5):
                    assert not has_expanded_repr(mkframe(4))
                    assert not has_expanded_repr(mkframe(5))
                    assert not has_expanded_repr(df6)
                    assert has_doubly_truncated_repr(df6)

                with option_context('display.max_rows', 20,
                                    'display.max_columns', 10):
                    # Out off max_columns boundary, but no extending
                    # since not exceeding width
                    assert not has_expanded_repr(df6)
                    assert not has_truncated_repr(df6)

                with option_context('display.max_rows', 9,
                                    'display.max_columns', 10):
                    # out vertical bounds can not result in exanded repr
                    assert not has_expanded_repr(df10)
                    assert has_vertically_truncated_repr(df10)

            # width=None in terminal, auto detection
            with option_context('display.max_columns', 100, 'display.max_rows',
                                term_width * 20, 'display.width', None):
                df = mkframe((term_width // 7) - 2)
                assert not has_expanded_repr(df)
                df = mkframe((term_width // 7) + 2)
                printing.pprint_thing(df._repr_fits_horizontal_())
                assert has_expanded_repr(df)

    def test_str_max_colwidth(self):
        # GH 7856
        df = pd.DataFrame([{'a': 'foo',
                            'b': 'bar',
                            'c': 'uncomfortably long line with lots of stuff',
                            'd': 1}, {'a': 'foo',
                                      'b': 'bar',
                                      'c': 'stuff',
                                      'd': 1}])
        df.set_index(['a', 'b', 'c'])
        assert str(df) == (
            '     a    b                                           c  d\n'
            '0  foo  bar  uncomfortably long line with lots of stuff  1\n'
            '1  foo  bar                                       stuff  1')
        with option_context('max_colwidth', 20):
            assert str(df) == ('     a    b                    c  d\n'
                               '0  foo  bar  uncomfortably lo...  1\n'
                               '1  foo  bar                stuff  1')

    def test_auto_detect(self):
        term_width, term_height = get_terminal_size()
        fac = 1.05  # Arbitrary large factor to exceed term widht
        cols = range(int(term_width * fac))
        index = range(10)
        df = DataFrame(index=index, columns=cols)
        with option_context('mode.sim_interactive', True):
            with option_context('max_rows', None):
                with option_context('max_columns', None):
                    # Wrap around with None
                    assert has_expanded_repr(df)
            with option_context('max_rows', 0):
                with option_context('max_columns', 0):
                    # Truncate with auto detection.
                    assert has_horizontally_truncated_repr(df)

            index = range(int(term_height * fac))
            df = DataFrame(index=index, columns=cols)
            with option_context('max_rows', 0):
                with option_context('max_columns', None):
                    # Wrap around with None
                    assert has_expanded_repr(df)
                    # Truncate vertically
                    assert has_vertically_truncated_repr(df)

            with option_context('max_rows', None):
                with option_context('max_columns', 0):
                    assert has_horizontally_truncated_repr(df)

    def test_to_string_repr_unicode(self):
        buf = StringIO()

        unicode_values = [u('\u03c3')] * 10
        unicode_values = np.array(unicode_values, dtype=object)
        df = DataFrame({'unicode': unicode_values})
        df.to_string(col_space=10, buf=buf)

        # it works!
        repr(df)

        idx = Index(['abc', u('\u03c3a'), 'aegdvg'])
        ser = Series(np.random.randn(len(idx)), idx)
        rs = repr(ser).split('\n')
        line_len = len(rs[0])
        for line in rs[1:]:
            try:
                line = line.decode(get_option("display.encoding"))
            except:
                pass
            if not line.startswith('dtype:'):
                assert len(line) == line_len

        # it works even if sys.stdin in None
        _stdin = sys.stdin
        try:
            sys.stdin = None
            repr(df)
        finally:
            sys.stdin = _stdin

    def test_to_string_unicode_columns(self):
        df = DataFrame({u('\u03c3'): np.arange(10.)})

        buf = StringIO()
        df.to_string(buf=buf)
        buf.getvalue()

        buf = StringIO()
        df.info(buf=buf)
        buf.getvalue()

        result = self.frame.to_string()
        assert isinstance(result, compat.text_type)

    def test_to_string_utf8_columns(self):
        n = u("\u05d0").encode('utf-8')

        with option_context('display.max_rows', 1):
            df = DataFrame([1, 2], columns=[n])
            repr(df)

    def test_to_string_unicode_two(self):
        dm = DataFrame({u('c/\u03c3'): []})
        buf = StringIO()
        dm.to_string(buf)

    def test_to_string_unicode_three(self):
        dm = DataFrame(['\xc2'])
        buf = StringIO()
        dm.to_string(buf)

    def test_to_string_with_formatters(self):
        df = DataFrame({'int': [1, 2, 3],
                        'float': [1.0, 2.0, 3.0],
                        'object': [(1, 2), True, False]},
                       columns=['int', 'float', 'object'])

        formatters = [('int', lambda x: '0x%x' % x),
                      ('float', lambda x: '[% 4.1f]' % x),
                      ('object', lambda x: '-%s-' % str(x))]
        result = df.to_string(formatters=dict(formatters))
        result2 = df.to_string(formatters=lzip(*formatters)[1])
        assert result == ('  int  float    object\n'
                          '0 0x1 [ 1.0]  -(1, 2)-\n'
                          '1 0x2 [ 2.0]    -True-\n'
                          '2 0x3 [ 3.0]   -False-')
        assert result == result2

    def test_to_string_with_datetime64_monthformatter(self):
        months = [datetime(2016, 1, 1), datetime(2016, 2, 2)]
        x = DataFrame({'months': months})

        def format_func(x):
            return x.strftime('%Y-%m')
        result = x.to_string(formatters={'months': format_func})
        expected = 'months\n0 2016-01\n1 2016-02'
        assert result.strip() == expected

    def test_to_string_with_datetime64_hourformatter(self):

        x = DataFrame({'hod': pd.to_datetime(['10:10:10.100', '12:12:12.120'],
                                             format='%H:%M:%S.%f')})

        def format_func(x):
            return x.strftime('%H:%M')

        result = x.to_string(formatters={'hod': format_func})
        expected = 'hod\n0 10:10\n1 12:12'
        assert result.strip() == expected

    def test_to_string_with_formatters_unicode(self):
        df = DataFrame({u('c/\u03c3'): [1, 2, 3]})
        result = df.to_string(formatters={u('c/\u03c3'): lambda x: '%s' % x})
        assert result == u('  c/\u03c3\n') + '0   1\n1   2\n2   3'

    def test_east_asian_unicode_frame(self):
        if PY3:
            _rep = repr
        else:
            _rep = unicode  # noqa

        # not alighned properly because of east asian width

        # mid col
        df = DataFrame({'a': [u'あ', u'いいい', u'う', u'ええええええ'],
                        'b': [1, 222, 33333, 4]},
                       index=['a', 'bb', 'c', 'ddd'])
        expected = (u"          a      b\na         あ      1\n"
                    u"bb      いいい    222\nc         う  33333\n"
                    u"ddd  ええええええ      4")
        assert _rep(df) == expected

        # last col
        df = DataFrame({'a': [1, 222, 33333, 4],
                        'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                       index=['a', 'bb', 'c', 'ddd'])
        expected = (u"         a       b\na        1       あ\n"
                    u"bb     222     いいい\nc    33333       う\n"
                    u"ddd      4  ええええええ")
        assert _rep(df) == expected

        # all col
        df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                        'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                       index=['a', 'bb', 'c', 'ddd'])
        expected = (u"         a       b\na    あああああ       あ\n"
                    u"bb       い     いいい\nc        う       う\n"
                    u"ddd    えええ  ええええええ")
        assert _rep(df) == expected

        # column name
        df = DataFrame({u'あああああ': [1, 222, 33333, 4],
                        'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                       index=['a', 'bb', 'c', 'ddd'])
        expected = (u"          b  あああああ\na         あ      1\n"
                    u"bb      いいい    222\nc         う  33333\n"
                    u"ddd  ええええええ      4")
        assert _rep(df) == expected

        # index
        df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                        'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                       index=[u'あああ', u'いいいいいい', u'うう', u'え'])
        expected = (u"            a       b\nあああ     あああああ       あ\n"
                    u"いいいいいい      い     いいい\nうう          う       う\n"
                    u"え         えええ  ええええええ")
        assert _rep(df) == expected

        # index name
        df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                        'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                       index=pd.Index([u'あ', u'い', u'うう', u'え'],
                                      name=u'おおおお'))
        expected = (u"          a       b\n"
                    u"おおおお               \n"
                    u"あ     あああああ       あ\n"
                    u"い         い     いいい\n"
                    u"うう        う       う\n"
                    u"え       えええ  ええええええ")
        assert _rep(df) == expected

        # all
        df = DataFrame({u'あああ': [u'あああ', u'い', u'う', u'えええええ'],
                        u'いいいいい': [u'あ', u'いいい', u'う', u'ええ']},
                       index=pd.Index([u'あ', u'いいい', u'うう', u'え'],
                                      name=u'お'))
        expected = (u"       あああ いいいいい\n"
                    u"お               \n"
                    u"あ      あああ     あ\n"
                    u"いいい      い   いいい\n"
                    u"うう       う     う\n"
                    u"え    えええええ    ええ")
        assert _rep(df) == expected

        # MultiIndex
        idx = pd.MultiIndex.from_tuples([(u'あ', u'いい'), (u'う', u'え'), (
            u'おおお', u'かかかか'), (u'き', u'くく')])
        df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                        'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                       index=idx)
        expected = (u"              a       b\n"
                    u"あ   いい    あああああ       あ\n"
                    u"う   え         い     いいい\n"
                    u"おおお かかかか      う       う\n"
                    u"き   くく      えええ  ええええええ")
        assert _rep(df) == expected

        # truncate
        with option_context('display.max_rows', 3, 'display.max_columns', 3):
            df = pd.DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                               'b': [u'あ', u'いいい', u'う', u'ええええええ'],
                               'c': [u'お', u'か', u'ききき', u'くくくくくく'],
                               u'ああああ': [u'さ', u'し', u'す', u'せ']},
                              columns=['a', 'b', 'c', u'ああああ'])

            expected = (u"        a ...  ああああ\n0   あああああ ...     さ\n"
                        u"..    ... ...   ...\n3     えええ ...     せ\n"
                        u"\n[4 rows x 4 columns]")
            assert _rep(df) == expected

            df.index = [u'あああ', u'いいいい', u'う', 'aaa']
            expected = (u"         a ...  ああああ\nあああ  あああああ ...     さ\n"
                        u"..     ... ...   ...\naaa    えええ ...     せ\n"
                        u"\n[4 rows x 4 columns]")
            assert _rep(df) == expected

        # Emable Unicode option -----------------------------------------
        with option_context('display.unicode.east_asian_width', True):

            # mid col
            df = DataFrame({'a': [u'あ', u'いいい', u'う', u'ええええええ'],
                            'b': [1, 222, 33333, 4]},
                           index=['a', 'bb', 'c', 'ddd'])
            expected = (u"                a      b\na              あ      1\n"
                        u"bb         いいい    222\nc              う  33333\n"
                        u"ddd  ええええええ      4")
            assert _rep(df) == expected

            # last col
            df = DataFrame({'a': [1, 222, 33333, 4],
                            'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                           index=['a', 'bb', 'c', 'ddd'])
            expected = (u"         a             b\na        1            あ\n"
                        u"bb     222        いいい\nc    33333            う\n"
                        u"ddd      4  ええええええ")
            assert _rep(df) == expected

            # all col
            df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                            'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                           index=['a', 'bb', 'c', 'ddd'])
            expected = (u"              a             b\n"
                        u"a    あああああ            あ\n"
                        u"bb           い        いいい\n"
                        u"c            う            う\n"
                        u"ddd      えええ  ええええええ")
            assert _rep(df) == expected

            # column name
            df = DataFrame({u'あああああ': [1, 222, 33333, 4],
                            'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                           index=['a', 'bb', 'c', 'ddd'])
            expected = (u"                b  あああああ\n"
                        u"a              あ           1\n"
                        u"bb         いいい         222\n"
                        u"c              う       33333\n"
                        u"ddd  ええええええ           4")
            assert _rep(df) == expected

            # index
            df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                            'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                           index=[u'あああ', u'いいいいいい', u'うう', u'え'])
            expected = (u"                       a             b\n"
                        u"あああ        あああああ            あ\n"
                        u"いいいいいい          い        いいい\n"
                        u"うう                  う            う\n"
                        u"え                えええ  ええええええ")
            assert _rep(df) == expected

            # index name
            df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                            'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                           index=pd.Index([u'あ', u'い', u'うう', u'え'],
                                          name=u'おおおお'))
            expected = (u"                   a             b\n"
                        u"おおおお                          \n"
                        u"あ        あああああ            あ\n"
                        u"い                い        いいい\n"
                        u"うう              う            う\n"
                        u"え            えええ  ええええええ")
            assert _rep(df) == expected

            # all
            df = DataFrame({u'あああ': [u'あああ', u'い', u'う', u'えええええ'],
                            u'いいいいい': [u'あ', u'いいい', u'う', u'ええ']},
                           index=pd.Index([u'あ', u'いいい', u'うう', u'え'],
                                          name=u'お'))
            expected = (u"            あああ いいいいい\n"
                        u"お                           \n"
                        u"あ          あああ         あ\n"
                        u"いいい          い     いいい\n"
                        u"うう            う         う\n"
                        u"え      えええええ       ええ")
            assert _rep(df) == expected

            # MultiIndex
            idx = pd.MultiIndex.from_tuples([(u'あ', u'いい'), (u'う', u'え'), (
                u'おおお', u'かかかか'), (u'き', u'くく')])
            df = DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                            'b': [u'あ', u'いいい', u'う', u'ええええええ']},
                           index=idx)
            expected = (u"                          a             b\n"
                        u"あ     いい      あああああ            あ\n"
                        u"う     え                い        いいい\n"
                        u"おおお かかかか          う            う\n"
                        u"き     くく          えええ  ええええええ")
            assert _rep(df) == expected

            # truncate
            with option_context('display.max_rows', 3, 'display.max_columns',
                                3):

                df = pd.DataFrame({'a': [u'あああああ', u'い', u'う', u'えええ'],
                                   'b': [u'あ', u'いいい', u'う', u'ええええええ'],
                                   'c': [u'お', u'か', u'ききき', u'くくくくくく'],
                                   u'ああああ': [u'さ', u'し', u'す', u'せ']},
                                  columns=['a', 'b', 'c', u'ああああ'])

                expected = (u"             a   ...    ああああ\n"
                            u"0   あああああ   ...          さ\n"
                            u"..         ...   ...         ...\n"
                            u"3       えええ   ...          せ\n"
                            u"\n[4 rows x 4 columns]")
                assert _rep(df) == expected

                df.index = [u'あああ', u'いいいい', u'う', 'aaa']
                expected = (u"                 a   ...    ああああ\n"
                            u"あああ  あああああ   ...          さ\n"
                            u"...            ...   ...         ...\n"
                            u"aaa         えええ   ...          せ\n"
                            u"\n[4 rows x 4 columns]")
                assert _rep(df) == expected

            # ambiguous unicode
            df = DataFrame({u'あああああ': [1, 222, 33333, 4],
                            'b': [u'あ', u'いいい', u'¡¡', u'ええええええ']},
                           index=['a', 'bb', 'c', '¡¡¡'])
            expected = (u"                b  あああああ\n"
                        u"a              あ           1\n"
                        u"bb         いいい         222\n"
                        u"c              ¡¡       33333\n"
                        u"¡¡¡  ええええええ           4")
            assert _rep(df) == expected

    def test_to_string_buffer_all_unicode(self):
        buf = StringIO()

        empty = DataFrame({u('c/\u03c3'): Series()})
        nonempty = DataFrame({u('c/\u03c3'): Series([1, 2, 3])})

        print(empty, file=buf)
        print(nonempty, file=buf)

        # this should work
        buf.getvalue()

    def test_to_string_with_col_space(self):
        df = DataFrame(np.random.random(size=(1, 3)))
        c10 = len(df.to_string(col_space=10).split("\n")[1])
        c20 = len(df.to_string(col_space=20).split("\n")[1])
        c30 = len(df.to_string(col_space=30).split("\n")[1])
        assert c10 < c20 < c30

        # GH 8230
        # col_space wasn't being applied with header=False
        with_header = df.to_string(col_space=20)
        with_header_row1 = with_header.splitlines()[1]
        no_header = df.to_string(col_space=20, header=False)
        assert len(with_header_row1) == len(no_header)

    def test_to_string_truncate_indices(self):
        for index in [tm.makeStringIndex, tm.makeUnicodeIndex, tm.makeIntIndex,
                      tm.makeDateIndex, tm.makePeriodIndex]:
            for column in [tm.makeStringIndex]:
                for h in [10, 20]:
                    for w in [10, 20]:
                        with option_context("display.expand_frame_repr",
                                            False):
                            df = DataFrame(index=index(h), columns=column(w))
                            with option_context("display.max_rows", 15):
                                if h == 20:
                                    assert has_vertically_truncated_repr(df)
                                else:
                                    assert not has_vertically_truncated_repr(
                                        df)
                            with option_context("display.max_columns", 15):
                                if w == 20:
                                    assert has_horizontally_truncated_repr(df)
                                else:
                                    assert not (
                                        has_horizontally_truncated_repr(df))
                            with option_context("display.max_rows", 15,
                                                "display.max_columns", 15):
                                if h == 20 and w == 20:
                                    assert has_doubly_truncated_repr(df)
                                else:
                                    assert not has_doubly_truncated_repr(
                                        df)

    def test_to_string_truncate_multilevel(self):
        arrays = [['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux'],
                  ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        df = DataFrame(index=arrays, columns=arrays)
        with option_context("display.max_rows", 7, "display.max_columns", 7):
            assert has_doubly_truncated_repr(df)

    def test_truncate_with_different_dtypes(self):

        # 11594, 12045
        # when truncated the dtypes of the splits can differ

        # 11594
        import datetime
        s = Series([datetime.datetime(2012, 1, 1)] * 10 +
                   [datetime.datetime(1012, 1, 2)] + [
            datetime.datetime(2012, 1, 3)] * 10)

        with pd.option_context('display.max_rows', 8):
            result = str(s)
            assert 'object' in result

        # 12045
        df = DataFrame({'text': ['some words'] + [None] * 9})

        with pd.option_context('display.max_rows', 8,
                               'display.max_columns', 3):
            result = str(df)
            assert 'None' in result
            assert 'NaN' not in result

    def test_datetimelike_frame(self):

        # GH 12211
        df = DataFrame(
            {'date': [pd.Timestamp('20130101').tz_localize('UTC')] +
                     [pd.NaT] * 5})

        with option_context("display.max_rows", 5):
            result = str(df)
            assert '2013-01-01 00:00:00+00:00' in result
            assert 'NaT' in result
            assert '...' in result
            assert '[6 rows x 1 columns]' in result

        dts = [pd.Timestamp('2011-01-01', tz='US/Eastern')] * 5 + [pd.NaT] * 5
        df = pd.DataFrame({"dt": dts,
                           "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]})
        with option_context('display.max_rows', 5):
            expected = ('                          dt   x\n'
                        '0  2011-01-01 00:00:00-05:00   1\n'
                        '1  2011-01-01 00:00:00-05:00   2\n'
                        '..                       ...  ..\n'
                        '8                        NaT   9\n'
                        '9                        NaT  10\n\n'
                        '[10 rows x 2 columns]')
            assert repr(df) == expected

        dts = [pd.NaT] * 5 + [pd.Timestamp('2011-01-01', tz='US/Eastern')] * 5
        df = pd.DataFrame({"dt": dts,
                           "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]})
        with option_context('display.max_rows', 5):
            expected = ('                          dt   x\n'
                        '0                        NaT   1\n'
                        '1                        NaT   2\n'
                        '..                       ...  ..\n'
                        '8  2011-01-01 00:00:00-05:00   9\n'
                        '9  2011-01-01 00:00:00-05:00  10\n\n'
                        '[10 rows x 2 columns]')
            assert repr(df) == expected

        dts = ([pd.Timestamp('2011-01-01', tz='Asia/Tokyo')] * 5 +
               [pd.Timestamp('2011-01-01', tz='US/Eastern')] * 5)
        df = pd.DataFrame({"dt": dts,
                           "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]})
        with option_context('display.max_rows', 5):
            expected = ('                           dt   x\n'
                        '0   2011-01-01 00:00:00+09:00   1\n'
                        '1   2011-01-01 00:00:00+09:00   2\n'
                        '..                        ...  ..\n'
                        '8   2011-01-01 00:00:00-05:00   9\n'
                        '9   2011-01-01 00:00:00-05:00  10\n\n'
                        '[10 rows x 2 columns]')
            assert repr(df) == expected

    def test_nonunicode_nonascii_alignment(self):
        df = DataFrame([["aa\xc3\xa4\xc3\xa4", 1], ["bbbb", 2]])
        rep_str = df.to_string()
        lines = rep_str.split('\n')
        assert len(lines[1]) == len(lines[2])

    def test_unicode_problem_decoding_as_ascii(self):
        dm = DataFrame({u('c/\u03c3'): Series({'test': np.nan})})
        compat.text_type(dm.to_string())

    def test_string_repr_encoding(self):
        filepath = tm.get_data_path('unicode_series.csv')
        df = pd.read_csv(filepath, header=None, encoding='latin1')
        repr(df)
        repr(df[1])

    def test_repr_corner(self):
        # representing infs poses no problems
        df = DataFrame({'foo': [-np.inf, np.inf]})
        repr(df)

    def test_frame_info_encoding(self):
        index = ['\'Til There Was You (1997)',
                 'ldum klaka (Cold Fever) (1994)']
        fmt.set_option('display.max_rows', 1)
        df = DataFrame(columns=['a', 'b', 'c'], index=index)
        repr(df)
        repr(df.T)
        fmt.set_option('display.max_rows', 200)

    def test_pprint_thing(self):
        from pandas.io.formats.printing import pprint_thing as pp_t

        if PY3:
            pytest.skip("doesn't work on Python 3")

        assert pp_t('a') == u('a')
        assert pp_t(u('a')) == u('a')
        assert pp_t(None) == 'None'
        assert pp_t(u('\u05d0'), quote_strings=True) == u("u'\u05d0'")
        assert pp_t(u('\u05d0'), quote_strings=False) == u('\u05d0')
        assert (pp_t((u('\u05d0'), u('\u05d1')), quote_strings=True) ==
                u("(u'\u05d0', u'\u05d1')"))
        assert (pp_t((u('\u05d0'), (u('\u05d1'), u('\u05d2'))),
                     quote_strings=True) == u("(u'\u05d0', "
                                              "(u'\u05d1', u'\u05d2'))"))
        assert (pp_t(('foo', u('\u05d0'), (u('\u05d0'), u('\u05d0'))),
                     quote_strings=True) == u("(u'foo', u'\u05d0', "
                                              "(u'\u05d0', u'\u05d0'))"))

        # gh-2038: escape embedded tabs in string
        assert "\t" not in pp_t("a\tb", escape_chars=("\t", ))

    def test_wide_repr(self):
        with option_context('mode.sim_interactive', True,
                            'display.show_dimensions', True):
            max_cols = get_option('display.max_columns')
            df = DataFrame(tm.rands_array(25, size=(10, max_cols - 1)))
            set_option('display.expand_frame_repr', False)
            rep_str = repr(df)

            assert "10 rows x %d columns" % (max_cols - 1) in rep_str
            set_option('display.expand_frame_repr', True)
            wide_repr = repr(df)
            assert rep_str != wide_repr

            with option_context('display.width', 120):
                wider_repr = repr(df)
                assert len(wider_repr) < len(wide_repr)

        reset_option('display.expand_frame_repr')

    def test_wide_repr_wide_columns(self):
        with option_context('mode.sim_interactive', True):
            df = DataFrame(np.random.randn(5, 3),
                           columns=['a' * 90, 'b' * 90, 'c' * 90])
            rep_str = repr(df)

            assert len(rep_str.splitlines()) == 20

    def test_wide_repr_named(self):
        with option_context('mode.sim_interactive', True):
            max_cols = get_option('display.max_columns')
            df = DataFrame(tm.rands_array(25, size=(10, max_cols - 1)))
            df.index.name = 'DataFrame Index'
            set_option('display.expand_frame_repr', False)

            rep_str = repr(df)
            set_option('display.expand_frame_repr', True)
            wide_repr = repr(df)
            assert rep_str != wide_repr

            with option_context('display.width', 150):
                wider_repr = repr(df)
                assert len(wider_repr) < len(wide_repr)

            for line in wide_repr.splitlines()[1::13]:
                assert 'DataFrame Index' in line

        reset_option('display.expand_frame_repr')

    def test_wide_repr_multiindex(self):
        with option_context('mode.sim_interactive', True):
            midx = MultiIndex.from_arrays(tm.rands_array(5, size=(2, 10)))
            max_cols = get_option('display.max_columns')
            df = DataFrame(tm.rands_array(25, size=(10, max_cols - 1)),
                           index=midx)
            df.index.names = ['Level 0', 'Level 1']
            set_option('display.expand_frame_repr', False)
            rep_str = repr(df)
            set_option('display.expand_frame_repr', True)
            wide_repr = repr(df)
            assert rep_str != wide_repr

            with option_context('display.width', 150):
                wider_repr = repr(df)
                assert len(wider_repr) < len(wide_repr)

            for line in wide_repr.splitlines()[1::13]:
                assert 'Level 0 Level 1' in line

        reset_option('display.expand_frame_repr')

    def test_wide_repr_multiindex_cols(self):
        with option_context('mode.sim_interactive', True):
            max_cols = get_option('display.max_columns')
            midx = MultiIndex.from_arrays(tm.rands_array(5, size=(2, 10)))
            mcols = MultiIndex.from_arrays(
                tm.rands_array(3, size=(2, max_cols - 1)))
            df = DataFrame(tm.rands_array(25, (10, max_cols - 1)),
                           index=midx, columns=mcols)
            df.index.names = ['Level 0', 'Level 1']
            set_option('display.expand_frame_repr', False)
            rep_str = repr(df)
            set_option('display.expand_frame_repr', True)
            wide_repr = repr(df)
            assert rep_str != wide_repr

        with option_context('display.width', 150):
            wider_repr = repr(df)
            assert len(wider_repr) < len(wide_repr)

        reset_option('display.expand_frame_repr')

    def test_wide_repr_unicode(self):
        with option_context('mode.sim_interactive', True):
            max_cols = get_option('display.max_columns')
            df = DataFrame(tm.rands_array(25, size=(10, max_cols - 1)))
            set_option('display.expand_frame_repr', False)
            rep_str = repr(df)
            set_option('display.expand_frame_repr', True)
            wide_repr = repr(df)
            assert rep_str != wide_repr

            with option_context('display.width', 150):
                wider_repr = repr(df)
                assert len(wider_repr) < len(wide_repr)

        reset_option('display.expand_frame_repr')

    def test_wide_repr_wide_long_columns(self):
        with option_context('mode.sim_interactive', True):
            df = DataFrame({'a': ['a' * 30, 'b' * 30],
                            'b': ['c' * 70, 'd' * 80]})

            result = repr(df)
            assert 'ccccc' in result
            assert 'ddddd' in result

    def test_long_series(self):
        n = 1000
        s = Series(
            np.random.randint(-50, 50, n),
            index=['s%04d' % x for x in range(n)], dtype='int64')

        import re
        str_rep = str(s)
        nmatches = len(re.findall('dtype', str_rep))
        assert nmatches == 1

    def test_index_with_nan(self):
        #  GH 2850
        df = DataFrame({'id1': {0: '1a3',
                                1: '9h4'},
                        'id2': {0: np.nan,
                                1: 'd67'},
                        'id3': {0: '78d',
                                1: '79d'},
                        'value': {0: 123,
                                  1: 64}})

        # multi-index
        y = df.set_index(['id1', 'id2', 'id3'])
        result = y.to_string()
        expected = u(
            '             value\nid1 id2 id3       \n'
            '1a3 NaN 78d    123\n9h4 d67 79d     64')
        assert result == expected

        # index
        y = df.set_index('id2')
        result = y.to_string()
        expected = u(
            '     id1  id3  value\nid2                 \n'
            'NaN  1a3  78d    123\nd67  9h4  79d     64')
        assert result == expected

        # with append (this failed in 0.12)
        y = df.set_index(['id1', 'id2']).set_index('id3', append=True)
        result = y.to_string()
        expected = u(
            '             value\nid1 id2 id3       \n'
            '1a3 NaN 78d    123\n9h4 d67 79d     64')
        assert result == expected

        # all-nan in mi
        df2 = df.copy()
        df2.loc[:, 'id2'] = np.nan
        y = df2.set_index('id2')
        result = y.to_string()
        expected = u(
            '     id1  id3  value\nid2                 \n'
            'NaN  1a3  78d    123\nNaN  9h4  79d     64')
        assert result == expected

        # partial nan in mi
        df2 = df.copy()
        df2.loc[:, 'id2'] = np.nan
        y = df2.set_index(['id2', 'id3'])
        result = y.to_string()
        expected = u(
            '         id1  value\nid2 id3            \n'
            'NaN 78d  1a3    123\n    79d  9h4     64')
        assert result == expected

        df = DataFrame({'id1': {0: np.nan,
                                1: '9h4'},
                        'id2': {0: np.nan,
                                1: 'd67'},
                        'id3': {0: np.nan,
                                1: '79d'},
                        'value': {0: 123,
                                  1: 64}})

        y = df.set_index(['id1', 'id2', 'id3'])
        result = y.to_string()
        expected = u(
            '             value\nid1 id2 id3       \n'
            'NaN NaN NaN    123\n9h4 d67 79d     64')
        assert result == expected

    def test_to_string(self):

        # big mixed
        biggie = DataFrame({'A': np.random.randn(200),
                            'B': tm.makeStringIndex(200)},
                           index=lrange(200))

        biggie.loc[:20, 'A'] = np.nan
        biggie.loc[:20, 'B'] = np.nan
        s = biggie.to_string()

        buf = StringIO()
        retval = biggie.to_string(buf=buf)
        assert retval is None
        assert buf.getvalue() == s

        assert isinstance(s, compat.string_types)

        # print in right order
        result = biggie.to_string(columns=['B', 'A'], col_space=17,
                                  float_format='%.5f'.__mod__)
        lines = result.split('\n')
        header = lines[0].strip().split()
        joined = '\n'.join([re.sub(r'\s+', ' ', x).strip() for x in lines[1:]])
        recons = read_table(StringIO(joined), names=header,
                            header=None, sep=' ')
        tm.assert_series_equal(recons['B'], biggie['B'])
        assert recons['A'].count() == biggie['A'].count()
        assert (np.abs(recons['A'].dropna() -
                       biggie['A'].dropna()) < 0.1).all()

        # expected = ['B', 'A']
        # assert header == expected

        result = biggie.to_string(columns=['A'], col_space=17)
        header = result.split('\n')[0].strip().split()
        expected = ['A']
        assert header == expected

        biggie.to_string(columns=['B', 'A'],
                         formatters={'A': lambda x: '%.1f' % x})

        biggie.to_string(columns=['B', 'A'], float_format=str)
        biggie.to_string(columns=['B', 'A'], col_space=12, float_format=str)

        frame = DataFrame(index=np.arange(200))
        frame.to_string()

    def test_to_string_no_header(self):
        df = DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})

        df_s = df.to_string(header=False)
        expected = "0  1  4\n1  2  5\n2  3  6"

        assert df_s == expected

    def test_to_string_specified_header(self):
        df = DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})

        df_s = df.to_string(header=['X', 'Y'])
        expected = '   X  Y\n0  1  4\n1  2  5\n2  3  6'

        assert df_s == expected

        with pytest.raises(ValueError):
            df.to_string(header=['X'])

    def test_to_string_no_index(self):
        df = DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})

        df_s = df.to_string(index=False)
        expected = "x  y\n1  4\n2  5\n3  6"

        assert df_s == expected

    def test_to_string_line_width_no_index(self):
        df = DataFrame({'x': [1, 2, 3], 'y': [4, 5, 6]})

        df_s = df.to_string(line_width=1, index=False)
        expected = "x  \\\n1   \n2   \n3   \n\ny  \n4  \n5  \n6"

        assert df_s == expected

    def test_to_string_float_formatting(self):
        tm.reset_display_options()
        fmt.set_option('display.precision', 5, 'display.column_space', 12,
                       'display.notebook_repr_html', False)

        df = DataFrame({'x': [0, 0.25, 3456.000, 12e+45, 1.64e+6, 1.7e+8,
                              1.253456, np.pi, -1e6]})

        df_s = df.to_string()

        # Python 2.5 just wants me to be sad. And debian 32-bit
        # sys.version_info[0] == 2 and sys.version_info[1] < 6:
        if _three_digit_exp():
            expected = ('              x\n0  0.00000e+000\n1  2.50000e-001\n'
                        '2  3.45600e+003\n3  1.20000e+046\n4  1.64000e+006\n'
                        '5  1.70000e+008\n6  1.25346e+000\n7  3.14159e+000\n'
                        '8 -1.00000e+006')
        else:
            expected = ('             x\n0  0.00000e+00\n1  2.50000e-01\n'
                        '2  3.45600e+03\n3  1.20000e+46\n4  1.64000e+06\n'
                        '5  1.70000e+08\n6  1.25346e+00\n7  3.14159e+00\n'
                        '8 -1.00000e+06')
        assert df_s == expected

        df = DataFrame({'x': [3234, 0.253]})
        df_s = df.to_string()

        expected = ('          x\n' '0  3234.000\n' '1     0.253')
        assert df_s == expected

        tm.reset_display_options()
        assert get_option("display.precision") == 6

        df = DataFrame({'x': [1e9, 0.2512]})
        df_s = df.to_string()
        # Python 2.5 just wants me to be sad. And debian 32-bit
        # sys.version_info[0] == 2 and sys.version_info[1] < 6:
        if _three_digit_exp():
            expected = ('               x\n'
                        '0  1.000000e+009\n'
                        '1  2.512000e-001')
        else:
            expected = ('              x\n'
                        '0  1.000000e+09\n'
                        '1  2.512000e-01')
        assert df_s == expected

    def test_to_string_small_float_values(self):
        df = DataFrame({'a': [1.5, 1e-17, -5.5e-7]})

        result = df.to_string()
        # sadness per above
        if '%.4g' % 1.7e8 == '1.7e+008':
            expected = ('               a\n'
                        '0  1.500000e+000\n'
                        '1  1.000000e-017\n'
                        '2 -5.500000e-007')
        else:
            expected = ('              a\n'
                        '0  1.500000e+00\n'
                        '1  1.000000e-17\n'
                        '2 -5.500000e-07')
        assert result == expected

        # but not all exactly zero
        df = df * 0
        result = df.to_string()
        expected = ('   0\n' '0  0\n' '1  0\n' '2 -0')

    def test_to_string_float_index(self):
        index = Index([1.5, 2, 3, 4, 5])
        df = DataFrame(lrange(5), index=index)

        result = df.to_string()
        expected = ('     0\n'
                    '1.5  0\n'
                    '2.0  1\n'
                    '3.0  2\n'
                    '4.0  3\n'
                    '5.0  4')
        assert result == expected

    def test_to_string_ascii_error(self):
        data = [('0  ', u('                        .gitignore '), u('     5 '),
                 ' \xe2\x80\xa2\xe2\x80\xa2\xe2\x80'
                 '\xa2\xe2\x80\xa2\xe2\x80\xa2')]
        df = DataFrame(data)

        # it works!
        repr(df)

    def test_to_string_int_formatting(self):
        df = DataFrame({'x': [-15, 20, 25, -35]})
        assert issubclass(df['x'].dtype.type, np.integer)

        output = df.to_string()
        expected = ('    x\n' '0 -15\n' '1  20\n' '2  25\n' '3 -35')
        assert output == expected

    def test_to_string_index_formatter(self):
        df = DataFrame([lrange(5), lrange(5, 10), lrange(10, 15)])

        rs = df.to_string(formatters={'__index__': lambda x: 'abc' [x]})

        xp = """\
    0   1   2   3   4
a   0   1   2   3   4
b   5   6   7   8   9
c  10  11  12  13  14\
"""

        assert rs == xp

    def test_to_string_left_justify_cols(self):
        tm.reset_display_options()
        df = DataFrame({'x': [3234, 0.253]})
        df_s = df.to_string(justify='left')
        expected = ('   x       \n' '0  3234.000\n' '1     0.253')
        assert df_s == expected

    def test_to_string_format_na(self):
        tm.reset_display_options()
        df = DataFrame({'A': [np.nan, -1, -2.1234, 3, 4],
                        'B': [np.nan, 'foo', 'foooo', 'fooooo', 'bar']})
        result = df.to_string()

        expected = ('        A       B\n'
                    '0     NaN     NaN\n'
                    '1 -1.0000     foo\n'
                    '2 -2.1234   foooo\n'
                    '3  3.0000  fooooo\n'
                    '4  4.0000     bar')
        assert result == expected

        df = DataFrame({'A': [np.nan, -1., -2., 3., 4.],
                        'B': [np.nan, 'foo', 'foooo', 'fooooo', 'bar']})
        result = df.to_string()

        expected = ('     A       B\n'
                    '0  NaN     NaN\n'
                    '1 -1.0     foo\n'
                    '2 -2.0   foooo\n'
                    '3  3.0  fooooo\n'
                    '4  4.0     bar')
        assert result == expected

    def test_to_string_line_width(self):
        df = DataFrame(123, lrange(10, 15), lrange(30))
        s = df.to_string(line_width=80)
        assert max(len(l) for l in s.split('\n')) == 80

    def test_show_dimensions(self):
        df = DataFrame(123, lrange(10, 15), lrange(30))

        with option_context('display.max_rows', 10, 'display.max_columns', 40,
                            'display.width', 500, 'display.expand_frame_repr',
                            'info', 'display.show_dimensions', True):
            assert '5 rows' in str(df)
            assert '5 rows' in df._repr_html_()
        with option_context('display.max_rows', 10, 'display.max_columns', 40,
                            'display.width', 500, 'display.expand_frame_repr',
                            'info', 'display.show_dimensions', False):
            assert '5 rows' not in str(df)
            assert '5 rows' not in df._repr_html_()
        with option_context('display.max_rows', 2, 'display.max_columns', 2,
                            'display.width', 500, 'display.expand_frame_repr',
                            'info', 'display.show_dimensions', 'truncate'):
            assert '5 rows' in str(df)
            assert '5 rows' in df._repr_html_()
        with option_context('display.max_rows', 10, 'display.max_columns', 40,
                            'display.width', 500, 'display.expand_frame_repr',
                            'info', 'display.show_dimensions', 'truncate'):
            assert '5 rows' not in str(df)
            assert '5 rows' not in df._repr_html_()

    def test_repr_html(self):
        self.frame._repr_html_()

        fmt.set_option('display.max_rows', 1, 'display.max_columns', 1)
        self.frame._repr_html_()

        fmt.set_option('display.notebook_repr_html', False)
        self.frame._repr_html_()

        tm.reset_display_options()

        df = DataFrame([[1, 2], [3, 4]])
        fmt.set_option('display.show_dimensions', True)
        assert '2 rows' in df._repr_html_()
        fmt.set_option('display.show_dimensions', False)
        assert '2 rows' not in df._repr_html_()

        tm.reset_display_options()

    def test_repr_html_wide(self):
        max_cols = get_option('display.max_columns')
        df = DataFrame(tm.rands_array(25, size=(10, max_cols - 1)))
        reg_repr = df._repr_html_()
        assert "..." not in reg_repr

        wide_df = DataFrame(tm.rands_array(25, size=(10, max_cols + 1)))
        wide_repr = wide_df._repr_html_()
        assert "..." in wide_repr

    def test_repr_html_wide_multiindex_cols(self):
        max_cols = get_option('display.max_columns')

        mcols = MultiIndex.from_product([np.arange(max_cols // 2),
                                         ['foo', 'bar']],
                                        names=['first', 'second'])
        df = DataFrame(tm.rands_array(25, size=(10, len(mcols))),
                       columns=mcols)
        reg_repr = df._repr_html_()
        assert '...' not in reg_repr

        mcols = MultiIndex.from_product((np.arange(1 + (max_cols // 2)),
                                         ['foo', 'bar']),
                                        names=['first', 'second'])
        df = DataFrame(tm.rands_array(25, size=(10, len(mcols))),
                       columns=mcols)
        wide_repr = df._repr_html_()
        assert '...' in wide_repr

    def test_repr_html_long(self):
        with option_context('display.max_rows', 60):
            max_rows = get_option('display.max_rows')
            h = max_rows - 1
            df = DataFrame({'A': np.arange(1, 1 + h),
                            'B': np.arange(41, 41 + h)})
            reg_repr = df._repr_html_()
            assert '..' not in reg_repr
            assert str(41 + max_rows // 2) in reg_repr

            h = max_rows + 1
            df = DataFrame({'A': np.arange(1, 1 + h),
                            'B': np.arange(41, 41 + h)})
            long_repr = df._repr_html_()
            assert '..' in long_repr
            assert str(41 + max_rows // 2) not in long_repr
            assert u('%d rows ') % h in long_repr
            assert u('2 columns') in long_repr

    def test_repr_html_float(self):
        with option_context('display.max_rows', 60):

            max_rows = get_option('display.max_rows')
            h = max_rows - 1
            df = DataFrame({'idx': np.linspace(-10, 10, h),
                            'A': np.arange(1, 1 + h),
                            'B': np.arange(41, 41 + h)}).set_index('idx')
            reg_repr = df._repr_html_()
            assert '..' not in reg_repr
            assert str(40 + h) in reg_repr

            h = max_rows + 1
            df = DataFrame({'idx': np.linspace(-10, 10, h),
                            'A': np.arange(1, 1 + h),
                            'B': np.arange(41, 41 + h)}).set_index('idx')
            long_repr = df._repr_html_()
            assert '..' in long_repr
            assert '31' not in long_repr
            assert u('%d rows ') % h in long_repr
            assert u('2 columns') in long_repr

    def test_repr_html_long_multiindex(self):
        max_rows = get_option('display.max_rows')
        max_L1 = max_rows // 2

        tuples = list(itertools.product(np.arange(max_L1), ['foo', 'bar']))
        idx = MultiIndex.from_tuples(tuples, names=['first', 'second'])
        df = DataFrame(np.random.randn(max_L1 * 2, 2), index=idx,
                       columns=['A', 'B'])
        reg_repr = df._repr_html_()
        assert '...' not in reg_repr

        tuples = list(itertools.product(np.arange(max_L1 + 1), ['foo', 'bar']))
        idx = MultiIndex.from_tuples(tuples, names=['first', 'second'])
        df = DataFrame(np.random.randn((max_L1 + 1) * 2, 2), index=idx,
                       columns=['A', 'B'])
        long_repr = df._repr_html_()
        assert '...' in long_repr

    def test_repr_html_long_and_wide(self):
        max_cols = get_option('display.max_columns')
        max_rows = get_option('display.max_rows')

        h, w = max_rows - 1, max_cols - 1
        df = DataFrame(dict((k, np.arange(1, 1 + h)) for k in np.arange(w)))
        assert '...' not in df._repr_html_()

        h, w = max_rows + 1, max_cols + 1
        df = DataFrame(dict((k, np.arange(1, 1 + h)) for k in np.arange(w)))
        assert '...' in df._repr_html_()

    def test_info_repr(self):
        max_rows = get_option('display.max_rows')
        max_cols = get_option('display.max_columns')
        # Long
        h, w = max_rows + 1, max_cols - 1
        df = DataFrame(dict((k, np.arange(1, 1 + h)) for k in np.arange(w)))
        assert has_vertically_truncated_repr(df)
        with option_context('display.large_repr', 'info'):
            assert has_info_repr(df)

        # Wide
        h, w = max_rows - 1, max_cols + 1
        df = DataFrame(dict((k, np.arange(1, 1 + h)) for k in np.arange(w)))
        assert has_horizontally_truncated_repr(df)
        with option_context('display.large_repr', 'info'):
            assert has_info_repr(df)

    def test_info_repr_max_cols(self):
        # GH #6939
        df = DataFrame(np.random.randn(10, 5))
        with option_context('display.large_repr', 'info',
                            'display.max_columns', 1,
                            'display.max_info_columns', 4):
            assert has_non_verbose_info_repr(df)

        with option_context('display.large_repr', 'info',
                            'display.max_columns', 1,
                            'display.max_info_columns', 5):
            assert not has_non_verbose_info_repr(df)

        # test verbose overrides
        # fmt.set_option('display.max_info_columns', 4)  # exceeded

    def test_info_repr_html(self):
        max_rows = get_option('display.max_rows')
        max_cols = get_option('display.max_columns')
        # Long
        h, w = max_rows + 1, max_cols - 1
        df = DataFrame(dict((k, np.arange(1, 1 + h)) for k in np.arange(w)))
        assert r'&lt;class' not in df._repr_html_()
        with option_context('display.large_repr', 'info'):
            assert r'&lt;class' in df._repr_html_()

        # Wide
        h, w = max_rows - 1, max_cols + 1
        df = DataFrame(dict((k, np.arange(1, 1 + h)) for k in np.arange(w)))
        assert '<class' not in df._repr_html_()
        with option_context('display.large_repr', 'info'):
            assert '&lt;class' in df._repr_html_()

    def test_fake_qtconsole_repr_html(self):
        def get_ipython():
            return {'config': {'KernelApp':
                               {'parent_appname': 'ipython-qtconsole'}}}

        repstr = self.frame._repr_html_()
        assert repstr is not None

        fmt.set_option('display.max_rows', 5, 'display.max_columns', 2)
        repstr = self.frame._repr_html_()

        assert 'class' in repstr  # info fallback
        tm.reset_display_options()

    def test_pprint_pathological_object(self):
        """
        if the test fails, the stack will overflow and nose crash,
        but it won't hang.
        """

        class A:

            def __getitem__(self, key):
                return 3  # obviously simplified

        df = DataFrame([A()])
        repr(df)  # just don't dine

    def test_float_trim_zeros(self):
        vals = [2.08430917305e+10, 3.52205017305e+10, 2.30674817305e+10,
                2.03954217305e+10, 5.59897817305e+10]
        skip = True
        for line in repr(DataFrame({'A': vals})).split('\n')[:-2]:
            if line.startswith('dtype:'):
                continue
            if _three_digit_exp():
                assert ('+010' in line) or skip
            else:
                assert ('+10' in line) or skip
            skip = False

    def test_dict_entries(self):
        df = DataFrame({'A': [{'a': 1, 'b': 2}]})

        val = df.to_string()
        assert "'a': 1" in val
        assert "'b': 2" in val

    def test_period(self):
        # GH 12615
        df = pd.DataFrame({'A': pd.period_range('2013-01',
                                                periods=4, freq='M'),
                           'B': [pd.Period('2011-01', freq='M'),
                                 pd.Period('2011-02-01', freq='D'),
                                 pd.Period('2011-03-01 09:00', freq='H'),
                                 pd.Period('2011-04', freq='M')],
                           'C': list('abcd')})
        exp = ("        A                B  C\n0 2013-01          2011-01  a\n"
               "1 2013-02       2011-02-01  b\n2 2013-03 2011-03-01 09:00  c\n"
               "3 2013-04          2011-04  d")
        assert str(df) == exp


def gen_series_formatting():
    s1 = pd.Series(['a'] * 100)
    s2 = pd.Series(['ab'] * 100)
    s3 = pd.Series(['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef'])
    s4 = s3[::-1]
    test_sers = {'onel': s1, 'twol': s2, 'asc': s3, 'desc': s4}
    return test_sers


class TestSeriesFormatting(object):

    def setup_method(self, method):
        self.ts = tm.makeTimeSeries()

    def test_repr_unicode(self):
        s = Series([u('\u03c3')] * 10)
        repr(s)

        a = Series([u("\u05d0")] * 1000)
        a.name = 'title1'
        repr(a)

    def test_to_string(self):
        buf = StringIO()

        s = self.ts.to_string()

        retval = self.ts.to_string(buf=buf)
        assert retval is None
        assert buf.getvalue().strip() == s

        # pass float_format
        format = '%.4f'.__mod__
        result = self.ts.to_string(float_format=format)
        result = [x.split()[1] for x in result.split('\n')[:-1]]
        expected = [format(x) for x in self.ts]
        assert result == expected

        # empty string
        result = self.ts[:0].to_string()
        assert result == 'Series([], Freq: B)'

        result = self.ts[:0].to_string(length=0)
        assert result == 'Series([], Freq: B)'

        # name and length
        cp = self.ts.copy()
        cp.name = 'foo'
        result = cp.to_string(length=True, name=True, dtype=True)
        last_line = result.split('\n')[-1].strip()
        assert last_line == ("Freq: B, Name: foo, "
                             "Length: %d, dtype: float64" % len(cp))

    def test_freq_name_separation(self):
        s = Series(np.random.randn(10),
                   index=date_range('1/1/2000', periods=10), name=0)

        result = repr(s)
        assert 'Freq: D, Name: 0' in result

    def test_to_string_mixed(self):
        s = Series(['foo', np.nan, -1.23, 4.56])
        result = s.to_string()
        expected = (u('0     foo\n') + u('1     NaN\n') + u('2   -1.23\n') +
                    u('3    4.56'))
        assert result == expected

        # but don't count NAs as floats
        s = Series(['foo', np.nan, 'bar', 'baz'])
        result = s.to_string()
        expected = (u('0    foo\n') + '1    NaN\n' + '2    bar\n' + '3    baz')
        assert result == expected

        s = Series(['foo', 5, 'bar', 'baz'])
        result = s.to_string()
        expected = (u('0    foo\n') + '1      5\n' + '2    bar\n' + '3    baz')
        assert result == expected

    def test_to_string_float_na_spacing(self):
        s = Series([0., 1.5678, 2., -3., 4.])
        s[::2] = np.nan

        result = s.to_string()
        expected = (u('0       NaN\n') + '1    1.5678\n' + '2       NaN\n' +
                    '3   -3.0000\n' + '4       NaN')
        assert result == expected

    def test_to_string_without_index(self):
        # GH 11729 Test index=False option
        s = Series([1, 2, 3, 4])
        result = s.to_string(index=False)
        expected = (u('1\n') + '2\n' + '3\n' + '4')
        assert result == expected

    def test_unicode_name_in_footer(self):
        s = Series([1, 2], name=u('\u05e2\u05d1\u05e8\u05d9\u05ea'))
        sf = fmt.SeriesFormatter(s, name=u('\u05e2\u05d1\u05e8\u05d9\u05ea'))
        sf._get_footer()  # should not raise exception

    def test_east_asian_unicode_series(self):
        if PY3:
            _rep = repr
        else:
            _rep = unicode  # noqa
        # not aligned properly because of east asian width

        # unicode index
        s = Series(['a', 'bb', 'CCC', 'D'],
                   index=[u'あ', u'いい', u'ううう', u'ええええ'])
        expected = (u"あ         a\nいい       bb\nううう     CCC\n"
                    u"ええええ      D\ndtype: object")
        assert _rep(s) == expected

        # unicode values
        s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                   index=['a', 'bb', 'c', 'ddd'])
        expected = (u"a         あ\nbb       いい\nc       ううう\n"
                    u"ddd    ええええ\ndtype: object")
        assert _rep(s) == expected

        # both
        s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                   index=[u'ああ', u'いいいい', u'う', u'えええ'])
        expected = (u"ああ         あ\nいいいい      いい\nう        ううう\n"
                    u"えええ     ええええ\ndtype: object")
        assert _rep(s) == expected

        # unicode footer
        s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                   index=[u'ああ', u'いいいい', u'う', u'えええ'],
                   name=u'おおおおおおお')
        expected = (u"ああ         あ\nいいいい      いい\nう        ううう\n"
                    u"えええ     ええええ\nName: おおおおおおお, dtype: object")
        assert _rep(s) == expected

        # MultiIndex
        idx = pd.MultiIndex.from_tuples([(u'あ', u'いい'), (u'う', u'え'), (
            u'おおお', u'かかかか'), (u'き', u'くく')])
        s = Series([1, 22, 3333, 44444], index=idx)
        expected = (u"あ    いい          1\n"
                    u"う    え          22\n"
                    u"おおお  かかかか     3333\n"
                    u"き    くく      44444\ndtype: int64")
        assert _rep(s) == expected

        # object dtype, shorter than unicode repr
        s = Series([1, 22, 3333, 44444], index=[1, 'AB', np.nan, u'あああ'])
        expected = (u"1          1\nAB        22\nNaN     3333\n"
                    u"あああ    44444\ndtype: int64")
        assert _rep(s) == expected

        # object dtype, longer than unicode repr
        s = Series([1, 22, 3333, 44444],
                   index=[1, 'AB', pd.Timestamp('2011-01-01'), u'あああ'])
        expected = (u"1                          1\n"
                    u"AB                        22\n"
                    u"2011-01-01 00:00:00     3333\n"
                    u"あああ                    44444\ndtype: int64")
        assert _rep(s) == expected

        # truncate
        with option_context('display.max_rows', 3):
            s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                       name=u'おおおおおおお')

            expected = (u"0       あ\n     ... \n"
                        u"3    ええええ\n"
                        u"Name: おおおおおおお, Length: 4, dtype: object")
            assert _rep(s) == expected

            s.index = [u'ああ', u'いいいい', u'う', u'えええ']
            expected = (u"ああ        あ\n       ... \n"
                        u"えええ    ええええ\n"
                        u"Name: おおおおおおお, Length: 4, dtype: object")
            assert _rep(s) == expected

        # Emable Unicode option -----------------------------------------
        with option_context('display.unicode.east_asian_width', True):

            # unicode index
            s = Series(['a', 'bb', 'CCC', 'D'],
                       index=[u'あ', u'いい', u'ううう', u'ええええ'])
            expected = (u"あ            a\nいい         bb\nううう      CCC\n"
                        u"ええええ      D\ndtype: object")
            assert _rep(s) == expected

            # unicode values
            s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                       index=['a', 'bb', 'c', 'ddd'])
            expected = (u"a            あ\nbb         いい\nc        ううう\n"
                        u"ddd    ええええ\ndtype: object")
            assert _rep(s) == expected

            # both
            s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                       index=[u'ああ', u'いいいい', u'う', u'えええ'])
            expected = (u"ああ              あ\n"
                        u"いいいい        いい\n"
                        u"う            ううう\n"
                        u"えええ      ええええ\ndtype: object")
            assert _rep(s) == expected

            # unicode footer
            s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                       index=[u'ああ', u'いいいい', u'う', u'えええ'],
                       name=u'おおおおおおお')
            expected = (u"ああ              あ\n"
                        u"いいいい        いい\n"
                        u"う            ううう\n"
                        u"えええ      ええええ\n"
                        u"Name: おおおおおおお, dtype: object")
            assert _rep(s) == expected

            # MultiIndex
            idx = pd.MultiIndex.from_tuples([(u'あ', u'いい'), (u'う', u'え'), (
                u'おおお', u'かかかか'), (u'き', u'くく')])
            s = Series([1, 22, 3333, 44444], index=idx)
            expected = (u"あ      いい            1\n"
                        u"う      え             22\n"
                        u"おおお  かかかか     3333\n"
                        u"き      くく        44444\n"
                        u"dtype: int64")
            assert _rep(s) == expected

            # object dtype, shorter than unicode repr
            s = Series([1, 22, 3333, 44444], index=[1, 'AB', np.nan, u'あああ'])
            expected = (u"1             1\nAB           22\nNaN        3333\n"
                        u"あああ    44444\ndtype: int64")
            assert _rep(s) == expected

            # object dtype, longer than unicode repr
            s = Series([1, 22, 3333, 44444],
                       index=[1, 'AB', pd.Timestamp('2011-01-01'), u'あああ'])
            expected = (u"1                          1\n"
                        u"AB                        22\n"
                        u"2011-01-01 00:00:00     3333\n"
                        u"あああ                 44444\ndtype: int64")
            assert _rep(s) == expected

            # truncate
            with option_context('display.max_rows', 3):
                s = Series([u'あ', u'いい', u'ううう', u'ええええ'],
                           name=u'おおおおおおお')
                expected = (u"0          あ\n       ...   \n"
                            u"3    ええええ\n"
                            u"Name: おおおおおおお, Length: 4, dtype: object")
                assert _rep(s) == expected

                s.index = [u'ああ', u'いいいい', u'う', u'えええ']
                expected = (u"ああ            あ\n"
                            u"            ...   \n"
                            u"えええ    ええええ\n"
                            u"Name: おおおおおおお, Length: 4, dtype: object")
                assert _rep(s) == expected

            # ambiguous unicode
            s = Series([u'¡¡', u'い¡¡', u'ううう', u'ええええ'],
                       index=[u'ああ', u'¡¡¡¡いい', u'¡¡', u'えええ'])
            expected = (u"ああ              ¡¡\n"
                        u"¡¡¡¡いい        い¡¡\n"
                        u"¡¡            ううう\n"
                        u"えええ      ええええ\ndtype: object")
            assert _rep(s) == expected

    def test_float_trim_zeros(self):
        vals = [2.08430917305e+10, 3.52205017305e+10, 2.30674817305e+10,
                2.03954217305e+10, 5.59897817305e+10]
        for line in repr(Series(vals)).split('\n'):
            if line.startswith('dtype:'):
                continue
            if _three_digit_exp():
                assert '+010' in line
            else:
                assert '+10' in line

    def test_datetimeindex(self):

        index = date_range('20130102', periods=6)
        s = Series(1, index=index)
        result = s.to_string()
        assert '2013-01-02' in result

        # nat in index
        s2 = Series(2, index=[Timestamp('20130111'), NaT])
        s = s2.append(s)
        result = s.to_string()
        assert 'NaT' in result

        # nat in summary
        result = str(s2.index)
        assert 'NaT' in result

    def test_timedelta64(self):

        from datetime import datetime, timedelta

        Series(np.array([1100, 20], dtype='timedelta64[ns]')).to_string()

        s = Series(date_range('2012-1-1', periods=3, freq='D'))

        # GH2146

        # adding NaTs
        y = s - s.shift(1)
        result = y.to_string()
        assert '1 days' in result
        assert '00:00:00' not in result
        assert 'NaT' in result

        # with frac seconds
        o = Series([datetime(2012, 1, 1, microsecond=150)] * 3)
        y = s - o
        result = y.to_string()
        assert '-1 days +23:59:59.999850' in result

        # rounding?
        o = Series([datetime(2012, 1, 1, 1)] * 3)
        y = s - o
        result = y.to_string()
        assert '-1 days +23:00:00' in result
        assert '1 days 23:00:00' in result

        o = Series([datetime(2012, 1, 1, 1, 1)] * 3)
        y = s - o
        result = y.to_string()
        assert '-1 days +22:59:00' in result
        assert '1 days 22:59:00' in result

        o = Series([datetime(2012, 1, 1, 1, 1, microsecond=150)] * 3)
        y = s - o
        result = y.to_string()
        assert '-1 days +22:58:59.999850' in result
        assert '0 days 22:58:59.999850' in result

        # neg time
        td = timedelta(minutes=5, seconds=3)
        s2 = Series(date_range('2012-1-1', periods=3, freq='D')) + td
        y = s - s2
        result = y.to_string()
        assert '-1 days +23:54:57' in result

        td = timedelta(microseconds=550)
        s2 = Series(date_range('2012-1-1', periods=3, freq='D')) + td
        y = s - td
        result = y.to_string()
        assert '2012-01-01 23:59:59.999450' in result

        # no boxing of the actual elements
        td = Series(pd.timedelta_range('1 days', periods=3))
        result = td.to_string()
        assert result == u("0   1 days\n1   2 days\n2   3 days")

    def test_mixed_datetime64(self):
        df = DataFrame({'A': [1, 2], 'B': ['2012-01-01', '2012-01-02']})
        df['B'] = pd.to_datetime(df.B)

        result = repr(df.loc[0])
        assert '2012-01-01' in result

    def test_period(self):
        # GH 12615
        index = pd.period_range('2013-01', periods=6, freq='M')
        s = Series(np.arange(6, dtype='int64'), index=index)
        exp = ("2013-01    0\n2013-02    1\n2013-03    2\n2013-04    3\n"
               "2013-05    4\n2013-06    5\nFreq: M, dtype: int64")
        assert str(s) == exp

        s = Series(index)
        exp = ("0   2013-01\n1   2013-02\n2   2013-03\n3   2013-04\n"
               "4   2013-05\n5   2013-06\ndtype: object")
        assert str(s) == exp

        # periods with mixed freq
        s = Series([pd.Period('2011-01', freq='M'),
                    pd.Period('2011-02-01', freq='D'),
                    pd.Period('2011-03-01 09:00', freq='H')])
        exp = ("0            2011-01\n1         2011-02-01\n"
               "2   2011-03-01 09:00\ndtype: object")
        assert str(s) == exp

    def test_max_multi_index_display(self):
        # GH 7101

        # doc example (indexing.rst)

        # multi-index
        arrays = [['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux'],
                  ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        tuples = list(zip(*arrays))
        index = MultiIndex.from_tuples(tuples, names=['first', 'second'])
        s = Series(np.random.randn(8), index=index)

        with option_context("display.max_rows", 10):
            assert len(str(s).split('\n')) == 10
        with option_context("display.max_rows", 3):
            assert len(str(s).split('\n')) == 5
        with option_context("display.max_rows", 2):
            assert len(str(s).split('\n')) == 5
        with option_context("display.max_rows", 1):
            assert len(str(s).split('\n')) == 4
        with option_context("display.max_rows", 0):
            assert len(str(s).split('\n')) == 10

        # index
        s = Series(np.random.randn(8), None)

        with option_context("display.max_rows", 10):
            assert len(str(s).split('\n')) == 9
        with option_context("display.max_rows", 3):
            assert len(str(s).split('\n')) == 4
        with option_context("display.max_rows", 2):
            assert len(str(s).split('\n')) == 4
        with option_context("display.max_rows", 1):
            assert len(str(s).split('\n')) == 3
        with option_context("display.max_rows", 0):
            assert len(str(s).split('\n')) == 9

    # Make sure #8532 is fixed
    def test_consistent_format(self):
        s = pd.Series([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.9999, 1, 1] * 10)
        with option_context("display.max_rows", 10,
                            "display.show_dimensions", False):
            res = repr(s)
        exp = ('0      1.0000\n1      1.0000\n2      1.0000\n3      '
               '1.0000\n4      1.0000\n        ...  \n125    '
               '1.0000\n126    1.0000\n127    0.9999\n128    '
               '1.0000\n129    1.0000\ndtype: float64')
        assert res == exp

    def chck_ncols(self, s):
        with option_context("display.max_rows", 10):
            res = repr(s)
        lines = res.split('\n')
        lines = [line for line in repr(s).split('\n')
                 if not re.match(r'[^\.]*\.+', line)][:-1]
        ncolsizes = len(set(len(line.strip()) for line in lines))
        assert ncolsizes == 1

    def test_format_explicit(self):
        test_sers = gen_series_formatting()
        with option_context("display.max_rows", 4,
                            "display.show_dimensions", False):
            res = repr(test_sers['onel'])
            exp = '0     a\n1     a\n     ..\n98    a\n99    a\ndtype: object'
            assert exp == res
            res = repr(test_sers['twol'])
            exp = ('0     ab\n1     ab\n      ..\n98    ab\n99    ab\ndtype:'
                   ' object')
            assert exp == res
            res = repr(test_sers['asc'])
            exp = ('0         a\n1        ab\n      ...  \n4     abcde\n5'
                   '    abcdef\ndtype: object')
            assert exp == res
            res = repr(test_sers['desc'])
            exp = ('5    abcdef\n4     abcde\n      ...  \n1        ab\n0'
                   '         a\ndtype: object')
            assert exp == res

    def test_ncols(self):
        test_sers = gen_series_formatting()
        for s in test_sers.values():
            self.chck_ncols(s)

    def test_max_rows_eq_one(self):
        s = Series(range(10), dtype='int64')
        with option_context("display.max_rows", 1):
            strrepr = repr(s).split('\n')
        exp1 = ['0', '0']
        res1 = strrepr[0].split()
        assert exp1 == res1
        exp2 = ['..']
        res2 = strrepr[1].split()
        assert exp2 == res2

    def test_truncate_ndots(self):
        def getndots(s):
            return len(re.match(r'[^\.]*(\.*)', s).groups()[0])

        s = Series([0, 2, 3, 6])
        with option_context("display.max_rows", 2):
            strrepr = repr(s).replace('\n', '')
        assert getndots(strrepr) == 2

        s = Series([0, 100, 200, 400])
        with option_context("display.max_rows", 2):
            strrepr = repr(s).replace('\n', '')
        assert getndots(strrepr) == 3

    def test_show_dimensions(self):
        # gh-7117
        s = Series(range(5))

        assert 'Length' not in repr(s)

        with option_context("display.max_rows", 4):
            assert 'Length' in repr(s)

        with option_context("display.show_dimensions", True):
            assert 'Length' in repr(s)

        with option_context("display.max_rows", 4,
                            "display.show_dimensions", False):
            assert 'Length' not in repr(s)

    def test_to_string_name(self):
        s = Series(range(100), dtype='int64')
        s.name = 'myser'
        res = s.to_string(max_rows=2, name=True)
        exp = '0      0\n      ..\n99    99\nName: myser'
        assert res == exp
        res = s.to_string(max_rows=2, name=False)
        exp = '0      0\n      ..\n99    99'
        assert res == exp

    def test_to_string_dtype(self):
        s = Series(range(100), dtype='int64')
        res = s.to_string(max_rows=2, dtype=True)
        exp = '0      0\n      ..\n99    99\ndtype: int64'
        assert res == exp
        res = s.to_string(max_rows=2, dtype=False)
        exp = '0      0\n      ..\n99    99'
        assert res == exp

    def test_to_string_length(self):
        s = Series(range(100), dtype='int64')
        res = s.to_string(max_rows=2, length=True)
        exp = '0      0\n      ..\n99    99\nLength: 100'
        assert res == exp

    def test_to_string_na_rep(self):
        s = pd.Series(index=range(100))
        res = s.to_string(na_rep='foo', max_rows=2)
        exp = '0    foo\n      ..\n99   foo'
        assert res == exp

    def test_to_string_float_format(self):
        s = pd.Series(range(10), dtype='float64')
        res = s.to_string(float_format=lambda x: '{0:2.1f}'.format(x),
                          max_rows=2)
        exp = '0   0.0\n     ..\n9   9.0'
        assert res == exp

    def test_to_string_header(self):
        s = pd.Series(range(10), dtype='int64')
        s.index.name = 'foo'
        res = s.to_string(header=True, max_rows=2)
        exp = 'foo\n0    0\n    ..\n9    9'
        assert res == exp
        res = s.to_string(header=False, max_rows=2)
        exp = '0    0\n    ..\n9    9'
        assert res == exp


def _three_digit_exp():
    return '%.4g' % 1.7e8 == '1.7e+008'


class TestFloatArrayFormatter(object):

    def test_misc(self):
        obj = fmt.FloatArrayFormatter(np.array([], dtype=np.float64))
        result = obj.get_result()
        assert len(result) == 0

    def test_format(self):
        obj = fmt.FloatArrayFormatter(np.array([12, 0], dtype=np.float64))
        result = obj.get_result()
        assert result[0] == " 12.0"
        assert result[1] == "  0.0"

    def test_output_significant_digits(self):
        # Issue #9764

        # In case default display precision changes:
        with pd.option_context('display.precision', 6):
            # DataFrame example from issue #9764
            d = pd.DataFrame(
                {'col1': [9.999e-8, 1e-7, 1.0001e-7, 2e-7, 4.999e-7, 5e-7,
                          5.0001e-7, 6e-7, 9.999e-7, 1e-6, 1.0001e-6, 2e-6,
                          4.999e-6, 5e-6, 5.0001e-6, 6e-6]})

            expected_output = {
                (0, 6):
                '           col1\n'
                '0  9.999000e-08\n'
                '1  1.000000e-07\n'
                '2  1.000100e-07\n'
                '3  2.000000e-07\n'
                '4  4.999000e-07\n'
                '5  5.000000e-07',
                (1, 6):
                '           col1\n'
                '1  1.000000e-07\n'
                '2  1.000100e-07\n'
                '3  2.000000e-07\n'
                '4  4.999000e-07\n'
                '5  5.000000e-07',
                (1, 8):
                '           col1\n'
                '1  1.000000e-07\n'
                '2  1.000100e-07\n'
                '3  2.000000e-07\n'
                '4  4.999000e-07\n'
                '5  5.000000e-07\n'
                '6  5.000100e-07\n'
                '7  6.000000e-07',
                (8, 16):
                '            col1\n'
                '8   9.999000e-07\n'
                '9   1.000000e-06\n'
                '10  1.000100e-06\n'
                '11  2.000000e-06\n'
                '12  4.999000e-06\n'
                '13  5.000000e-06\n'
                '14  5.000100e-06\n'
                '15  6.000000e-06',
                (9, 16):
                '        col1\n'
                '9   0.000001\n'
                '10  0.000001\n'
                '11  0.000002\n'
                '12  0.000005\n'
                '13  0.000005\n'
                '14  0.000005\n'
                '15  0.000006'
            }

            for (start, stop), v in expected_output.items():
                assert str(d[start:stop]) == v

    def test_too_long(self):
        # GH 10451
        with pd.option_context('display.precision', 4):
            # need both a number > 1e6 and something that normally formats to
            # having length > display.precision + 6
            df = pd.DataFrame(dict(x=[12345.6789]))
            assert str(df) == '            x\n0  12345.6789'
            df = pd.DataFrame(dict(x=[2e6]))
            assert str(df) == '           x\n0  2000000.0'
            df = pd.DataFrame(dict(x=[12345.6789, 2e6]))
            assert str(df) == '            x\n0  1.2346e+04\n1  2.0000e+06'


class TestRepr_timedelta64(object):

    def test_none(self):
        delta_1d = pd.to_timedelta(1, unit='D')
        delta_0d = pd.to_timedelta(0, unit='D')
        delta_1s = pd.to_timedelta(1, unit='s')
        delta_500ms = pd.to_timedelta(500, unit='ms')

        drepr = lambda x: x._repr_base()
        assert drepr(delta_1d) == "1 days"
        assert drepr(-delta_1d) == "-1 days"
        assert drepr(delta_0d) == "0 days"
        assert drepr(delta_1s) == "0 days 00:00:01"
        assert drepr(delta_500ms) == "0 days 00:00:00.500000"
        assert drepr(delta_1d + delta_1s) == "1 days 00:00:01"
        assert drepr(delta_1d + delta_500ms) == "1 days 00:00:00.500000"

    def test_even_day(self):
        delta_1d = pd.to_timedelta(1, unit='D')
        delta_0d = pd.to_timedelta(0, unit='D')
        delta_1s = pd.to_timedelta(1, unit='s')
        delta_500ms = pd.to_timedelta(500, unit='ms')

        drepr = lambda x: x._repr_base(format='even_day')
        assert drepr(delta_1d) == "1 days"
        assert drepr(-delta_1d) == "-1 days"
        assert drepr(delta_0d) == "0 days"
        assert drepr(delta_1s) == "0 days 00:00:01"
        assert drepr(delta_500ms) == "0 days 00:00:00.500000"
        assert drepr(delta_1d + delta_1s) == "1 days 00:00:01"
        assert drepr(delta_1d + delta_500ms) == "1 days 00:00:00.500000"

    def test_sub_day(self):
        delta_1d = pd.to_timedelta(1, unit='D')
        delta_0d = pd.to_timedelta(0, unit='D')
        delta_1s = pd.to_timedelta(1, unit='s')
        delta_500ms = pd.to_timedelta(500, unit='ms')

        drepr = lambda x: x._repr_base(format='sub_day')
        assert drepr(delta_1d) == "1 days"
        assert drepr(-delta_1d) == "-1 days"
        assert drepr(delta_0d) == "00:00:00"
        assert drepr(delta_1s) == "00:00:01"
        assert drepr(delta_500ms) == "00:00:00.500000"
        assert drepr(delta_1d + delta_1s) == "1 days 00:00:01"
        assert drepr(delta_1d + delta_500ms) == "1 days 00:00:00.500000"

    def test_long(self):
        delta_1d = pd.to_timedelta(1, unit='D')
        delta_0d = pd.to_timedelta(0, unit='D')
        delta_1s = pd.to_timedelta(1, unit='s')
        delta_500ms = pd.to_timedelta(500, unit='ms')

        drepr = lambda x: x._repr_base(format='long')
        assert drepr(delta_1d) == "1 days 00:00:00"
        assert drepr(-delta_1d) == "-1 days +00:00:00"
        assert drepr(delta_0d) == "0 days 00:00:00"
        assert drepr(delta_1s) == "0 days 00:00:01"
        assert drepr(delta_500ms) == "0 days 00:00:00.500000"
        assert drepr(delta_1d + delta_1s) == "1 days 00:00:01"
        assert drepr(delta_1d + delta_500ms) == "1 days 00:00:00.500000"

    def test_all(self):
        delta_1d = pd.to_timedelta(1, unit='D')
        delta_0d = pd.to_timedelta(0, unit='D')
        delta_1ns = pd.to_timedelta(1, unit='ns')

        drepr = lambda x: x._repr_base(format='all')
        assert drepr(delta_1d) == "1 days 00:00:00.000000000"
        assert drepr(delta_0d) == "0 days 00:00:00.000000000"
        assert drepr(delta_1ns) == "0 days 00:00:00.000000001"


class TestTimedelta64Formatter(object):

    def test_days(self):
        x = pd.to_timedelta(list(range(5)) + [pd.NaT], unit='D')
        result = fmt.Timedelta64Formatter(x, box=True).get_result()
        assert result[0].strip() == "'0 days'"
        assert result[1].strip() == "'1 days'"

        result = fmt.Timedelta64Formatter(x[1:2], box=True).get_result()
        assert result[0].strip() == "'1 days'"

        result = fmt.Timedelta64Formatter(x, box=False).get_result()
        assert result[0].strip() == "0 days"
        assert result[1].strip() == "1 days"

        result = fmt.Timedelta64Formatter(x[1:2], box=False).get_result()
        assert result[0].strip() == "1 days"

    def test_days_neg(self):
        x = pd.to_timedelta(list(range(5)) + [pd.NaT], unit='D')
        result = fmt.Timedelta64Formatter(-x, box=True).get_result()
        assert result[0].strip() == "'0 days'"
        assert result[1].strip() == "'-1 days'"

    def test_subdays(self):
        y = pd.to_timedelta(list(range(5)) + [pd.NaT], unit='s')
        result = fmt.Timedelta64Formatter(y, box=True).get_result()
        assert result[0].strip() == "'00:00:00'"
        assert result[1].strip() == "'00:00:01'"

    def test_subdays_neg(self):
        y = pd.to_timedelta(list(range(5)) + [pd.NaT], unit='s')
        result = fmt.Timedelta64Formatter(-y, box=True).get_result()
        assert result[0].strip() == "'00:00:00'"
        assert result[1].strip() == "'-1 days +23:59:59'"

    def test_zero(self):
        x = pd.to_timedelta(list(range(1)) + [pd.NaT], unit='D')
        result = fmt.Timedelta64Formatter(x, box=True).get_result()
        assert result[0].strip() == "'0 days'"

        x = pd.to_timedelta(list(range(1)), unit='D')
        result = fmt.Timedelta64Formatter(x, box=True).get_result()
        assert result[0].strip() == "'0 days'"


class TestDatetime64Formatter(object):

    def test_mixed(self):
        x = Series([datetime(2013, 1, 1), datetime(2013, 1, 1, 12), pd.NaT])
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01 00:00:00"
        assert result[1].strip() == "2013-01-01 12:00:00"

    def test_dates(self):
        x = Series([datetime(2013, 1, 1), datetime(2013, 1, 2), pd.NaT])
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01"
        assert result[1].strip() == "2013-01-02"

    def test_date_nanos(self):
        x = Series([Timestamp(200)])
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "1970-01-01 00:00:00.000000200"

    def test_dates_display(self):

        # 10170
        # make sure that we are consistently display date formatting
        x = Series(date_range('20130101 09:00:00', periods=5, freq='D'))
        x.iloc[1] = np.nan
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01 09:00:00"
        assert result[1].strip() == "NaT"
        assert result[4].strip() == "2013-01-05 09:00:00"

        x = Series(date_range('20130101 09:00:00', periods=5, freq='s'))
        x.iloc[1] = np.nan
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01 09:00:00"
        assert result[1].strip() == "NaT"
        assert result[4].strip() == "2013-01-01 09:00:04"

        x = Series(date_range('20130101 09:00:00', periods=5, freq='ms'))
        x.iloc[1] = np.nan
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01 09:00:00.000"
        assert result[1].strip() == "NaT"
        assert result[4].strip() == "2013-01-01 09:00:00.004"

        x = Series(date_range('20130101 09:00:00', periods=5, freq='us'))
        x.iloc[1] = np.nan
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01 09:00:00.000000"
        assert result[1].strip() == "NaT"
        assert result[4].strip() == "2013-01-01 09:00:00.000004"

        x = Series(date_range('20130101 09:00:00', periods=5, freq='N'))
        x.iloc[1] = np.nan
        result = fmt.Datetime64Formatter(x).get_result()
        assert result[0].strip() == "2013-01-01 09:00:00.000000000"
        assert result[1].strip() == "NaT"
        assert result[4].strip() == "2013-01-01 09:00:00.000000004"

    def test_datetime64formatter_yearmonth(self):
        x = Series([datetime(2016, 1, 1), datetime(2016, 2, 2)])

        def format_func(x):
            return x.strftime('%Y-%m')

        formatter = fmt.Datetime64Formatter(x, formatter=format_func)
        result = formatter.get_result()
        assert result == ['2016-01', '2016-02']

    def test_datetime64formatter_hoursecond(self):

        x = Series(pd.to_datetime(['10:10:10.100', '12:12:12.120'],
                                  format='%H:%M:%S.%f'))

        def format_func(x):
            return x.strftime('%H:%M')

        formatter = fmt.Datetime64Formatter(x, formatter=format_func)
        result = formatter.get_result()
        assert result == ['10:10', '12:12']


class TestNaTFormatting(object):

    def test_repr(self):
        assert repr(pd.NaT) == "NaT"

    def test_str(self):
        assert str(pd.NaT) == "NaT"


class TestDatetimeIndexFormat(object):

    def test_datetime(self):
        formatted = pd.to_datetime([datetime(2003, 1, 1, 12), pd.NaT]).format()
        assert formatted[0] == "2003-01-01 12:00:00"
        assert formatted[1] == "NaT"

    def test_date(self):
        formatted = pd.to_datetime([datetime(2003, 1, 1), pd.NaT]).format()
        assert formatted[0] == "2003-01-01"
        assert formatted[1] == "NaT"

    def test_date_tz(self):
        formatted = pd.to_datetime([datetime(2013, 1, 1)], utc=True).format()
        assert formatted[0] == "2013-01-01 00:00:00+00:00"

        formatted = pd.to_datetime(
            [datetime(2013, 1, 1), pd.NaT], utc=True).format()
        assert formatted[0] == "2013-01-01 00:00:00+00:00"

    def test_date_explict_date_format(self):
        formatted = pd.to_datetime([datetime(2003, 2, 1), pd.NaT]).format(
            date_format="%m-%d-%Y", na_rep="UT")
        assert formatted[0] == "02-01-2003"
        assert formatted[1] == "UT"


class TestDatetimeIndexUnicode(object):

    def test_dates(self):
        text = str(pd.to_datetime([datetime(2013, 1, 1), datetime(2014, 1, 1)
                                   ]))
        assert "['2013-01-01'," in text
        assert ", '2014-01-01']" in text

    def test_mixed(self):
        text = str(pd.to_datetime([datetime(2013, 1, 1), datetime(
            2014, 1, 1, 12), datetime(2014, 1, 1)]))
        assert "'2013-01-01 00:00:00'," in text
        assert "'2014-01-01 00:00:00']" in text


class TestStringRepTimestamp(object):

    def test_no_tz(self):
        dt_date = datetime(2013, 1, 2)
        assert str(dt_date) == str(Timestamp(dt_date))

        dt_datetime = datetime(2013, 1, 2, 12, 1, 3)
        assert str(dt_datetime) == str(Timestamp(dt_datetime))

        dt_datetime_us = datetime(2013, 1, 2, 12, 1, 3, 45)
        assert str(dt_datetime_us) == str(Timestamp(dt_datetime_us))

        ts_nanos_only = Timestamp(200)
        assert str(ts_nanos_only) == "1970-01-01 00:00:00.000000200"

        ts_nanos_micros = Timestamp(1200)
        assert str(ts_nanos_micros) == "1970-01-01 00:00:00.000001200"

    def test_tz_pytz(self):
        tm._skip_if_no_pytz()

        import pytz

        dt_date = datetime(2013, 1, 2, tzinfo=pytz.utc)
        assert str(dt_date) == str(Timestamp(dt_date))

        dt_datetime = datetime(2013, 1, 2, 12, 1, 3, tzinfo=pytz.utc)
        assert str(dt_datetime) == str(Timestamp(dt_datetime))

        dt_datetime_us = datetime(2013, 1, 2, 12, 1, 3, 45, tzinfo=pytz.utc)
        assert str(dt_datetime_us) == str(Timestamp(dt_datetime_us))

    def test_tz_dateutil(self):
        tm._skip_if_no_dateutil()
        import dateutil
        utc = dateutil.tz.tzutc()

        dt_date = datetime(2013, 1, 2, tzinfo=utc)
        assert str(dt_date) == str(Timestamp(dt_date))

        dt_datetime = datetime(2013, 1, 2, 12, 1, 3, tzinfo=utc)
        assert str(dt_datetime) == str(Timestamp(dt_datetime))

        dt_datetime_us = datetime(2013, 1, 2, 12, 1, 3, 45, tzinfo=utc)
        assert str(dt_datetime_us) == str(Timestamp(dt_datetime_us))

    def test_nat_representations(self):
        for f in (str, repr, methodcaller('isoformat')):
            assert f(pd.NaT) == 'NaT'


def test_format_percentiles():
    result = fmt.format_percentiles([0.01999, 0.02001, 0.5, 0.666666, 0.9999])
    expected = ['1.999%', '2.001%', '50%', '66.667%', '99.99%']
    assert result == expected

    result = fmt.format_percentiles([0, 0.5, 0.02001, 0.5, 0.666666, 0.9999])
    expected = ['0%', '50%', '2.0%', '50%', '66.67%', '99.99%']
    assert result == expected

    pytest.raises(ValueError, fmt.format_percentiles, [0.1, np.nan, 0.5])
    pytest.raises(ValueError, fmt.format_percentiles, [-0.001, 0.1, 0.5])
    pytest.raises(ValueError, fmt.format_percentiles, [2, 0.1, 0.5])
    pytest.raises(ValueError, fmt.format_percentiles, [0.1, 0.5, 'a'])
