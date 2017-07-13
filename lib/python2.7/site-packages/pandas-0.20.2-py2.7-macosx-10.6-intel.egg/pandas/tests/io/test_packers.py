import pytest

from warnings import catch_warnings
import os
import datetime
import numpy as np
import sys
from distutils.version import LooseVersion

from pandas import compat
from pandas.compat import u, PY3
from pandas import (Series, DataFrame, Panel, MultiIndex, bdate_range,
                    date_range, period_range, Index, Categorical)
from pandas.errors import PerformanceWarning
from pandas.io.packers import to_msgpack, read_msgpack
import pandas.util.testing as tm
from pandas.util.testing import (ensure_clean,
                                 assert_categorical_equal,
                                 assert_frame_equal,
                                 assert_index_equal,
                                 assert_series_equal,
                                 patch)
from pandas.tests.test_panel import assert_panel_equal

import pandas
from pandas import Timestamp, NaT
from pandas._libs.tslib import iNaT

nan = np.nan

try:
    import blosc  # NOQA
except ImportError:
    _BLOSC_INSTALLED = False
else:
    _BLOSC_INSTALLED = True

try:
    import zlib  # NOQA
except ImportError:
    _ZLIB_INSTALLED = False
else:
    _ZLIB_INSTALLED = True


@pytest.fixture(scope='module')
def current_packers_data():
    # our current version packers data
    from pandas.tests.io.generate_legacy_storage_files import (
        create_msgpack_data)
    return create_msgpack_data()


@pytest.fixture(scope='module')
def all_packers_data():
    # our all of our current version packers data
    from pandas.tests.io.generate_legacy_storage_files import (
        create_data)
    return create_data()


def check_arbitrary(a, b):

    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        assert(len(a) == len(b))
        for a_, b_ in zip(a, b):
            check_arbitrary(a_, b_)
    elif isinstance(a, Panel):
        assert_panel_equal(a, b)
    elif isinstance(a, DataFrame):
        assert_frame_equal(a, b)
    elif isinstance(a, Series):
        assert_series_equal(a, b)
    elif isinstance(a, Index):
        assert_index_equal(a, b)
    elif isinstance(a, Categorical):
        # Temp,
        # Categorical.categories is changed from str to bytes in PY3
        # maybe the same as GH 13591
        if PY3 and b.categories.inferred_type == 'string':
            pass
        else:
            tm.assert_categorical_equal(a, b)
    elif a is NaT:
        assert b is NaT
    elif isinstance(a, Timestamp):
        assert a == b
        assert a.freq == b.freq
    else:
        assert(a == b)


class TestPackers(object):

    def setup_method(self, method):
        self.path = '__%s__.msg' % tm.rands(10)

    def teardown_method(self, method):
        pass

    def encode_decode(self, x, compress=None, **kwargs):
        with ensure_clean(self.path) as p:
            to_msgpack(p, x, compress=compress, **kwargs)
            return read_msgpack(p, **kwargs)


class TestAPI(TestPackers):

    def test_string_io(self):

        df = DataFrame(np.random.randn(10, 2))
        s = df.to_msgpack(None)
        result = read_msgpack(s)
        tm.assert_frame_equal(result, df)

        s = df.to_msgpack()
        result = read_msgpack(s)
        tm.assert_frame_equal(result, df)

        s = df.to_msgpack()
        result = read_msgpack(compat.BytesIO(s))
        tm.assert_frame_equal(result, df)

        s = to_msgpack(None, df)
        result = read_msgpack(s)
        tm.assert_frame_equal(result, df)

        with ensure_clean(self.path) as p:

            s = df.to_msgpack()
            fh = open(p, 'wb')
            fh.write(s)
            fh.close()
            result = read_msgpack(p)
            tm.assert_frame_equal(result, df)

    @pytest.mark.xfail(reason="msgpack currently doesn't work with pathlib")
    def test_path_pathlib(self):
        df = tm.makeDataFrame()
        result = tm.round_trip_pathlib(df.to_msgpack, read_msgpack)
        tm.assert_frame_equal(df, result)

    @pytest.mark.xfail(reason="msgpack currently doesn't work with localpath")
    def test_path_localpath(self):
        df = tm.makeDataFrame()
        result = tm.round_trip_localpath(df.to_msgpack, read_msgpack)
        tm.assert_frame_equal(df, result)

    def test_iterator_with_string_io(self):

        dfs = [DataFrame(np.random.randn(10, 2)) for i in range(5)]
        s = to_msgpack(None, *dfs)
        for i, result in enumerate(read_msgpack(s, iterator=True)):
            tm.assert_frame_equal(result, dfs[i])

    def test_invalid_arg(self):
        # GH10369
        class A(object):

            def __init__(self):
                self.read = 0

        pytest.raises(ValueError, read_msgpack, path_or_buf=None)
        pytest.raises(ValueError, read_msgpack, path_or_buf={})
        pytest.raises(ValueError, read_msgpack, path_or_buf=A())


class TestNumpy(TestPackers):

    def test_numpy_scalar_float(self):
        x = np.float32(np.random.rand())
        x_rec = self.encode_decode(x)
        tm.assert_almost_equal(x, x_rec)

    def test_numpy_scalar_complex(self):
        x = np.complex64(np.random.rand() + 1j * np.random.rand())
        x_rec = self.encode_decode(x)
        assert np.allclose(x, x_rec)

    def test_scalar_float(self):
        x = np.random.rand()
        x_rec = self.encode_decode(x)
        tm.assert_almost_equal(x, x_rec)

    def test_scalar_complex(self):
        x = np.random.rand() + 1j * np.random.rand()
        x_rec = self.encode_decode(x)
        assert np.allclose(x, x_rec)

    def test_list_numpy_float(self):
        x = [np.float32(np.random.rand()) for i in range(5)]
        x_rec = self.encode_decode(x)
        # current msgpack cannot distinguish list/tuple
        tm.assert_almost_equal(tuple(x), x_rec)

        x_rec = self.encode_decode(tuple(x))
        tm.assert_almost_equal(tuple(x), x_rec)

    def test_list_numpy_float_complex(self):
        if not hasattr(np, 'complex128'):
            pytest.skip('numpy cant handle complex128')

        x = [np.float32(np.random.rand()) for i in range(5)] + \
            [np.complex128(np.random.rand() + 1j * np.random.rand())
             for i in range(5)]
        x_rec = self.encode_decode(x)
        assert np.allclose(x, x_rec)

    def test_list_float(self):
        x = [np.random.rand() for i in range(5)]
        x_rec = self.encode_decode(x)
        # current msgpack cannot distinguish list/tuple
        tm.assert_almost_equal(tuple(x), x_rec)

        x_rec = self.encode_decode(tuple(x))
        tm.assert_almost_equal(tuple(x), x_rec)

    def test_list_float_complex(self):
        x = [np.random.rand() for i in range(5)] + \
            [(np.random.rand() + 1j * np.random.rand()) for i in range(5)]
        x_rec = self.encode_decode(x)
        assert np.allclose(x, x_rec)

    def test_dict_float(self):
        x = {'foo': 1.0, 'bar': 2.0}
        x_rec = self.encode_decode(x)
        tm.assert_almost_equal(x, x_rec)

    def test_dict_complex(self):
        x = {'foo': 1.0 + 1.0j, 'bar': 2.0 + 2.0j}
        x_rec = self.encode_decode(x)
        tm.assert_dict_equal(x, x_rec)

        for key in x:
            tm.assert_class_equal(x[key], x_rec[key], obj="complex value")

    def test_dict_numpy_float(self):
        x = {'foo': np.float32(1.0), 'bar': np.float32(2.0)}
        x_rec = self.encode_decode(x)
        tm.assert_almost_equal(x, x_rec)

    def test_dict_numpy_complex(self):
        x = {'foo': np.complex128(1.0 + 1.0j),
             'bar': np.complex128(2.0 + 2.0j)}
        x_rec = self.encode_decode(x)
        tm.assert_dict_equal(x, x_rec)

        for key in x:
            tm.assert_class_equal(x[key], x_rec[key], obj="numpy complex128")

    def test_numpy_array_float(self):

        # run multiple times
        for n in range(10):
            x = np.random.rand(10)
            for dtype in ['float32', 'float64']:
                x = x.astype(dtype)
                x_rec = self.encode_decode(x)
                tm.assert_almost_equal(x, x_rec)

    def test_numpy_array_complex(self):
        x = (np.random.rand(5) + 1j * np.random.rand(5)).astype(np.complex128)
        x_rec = self.encode_decode(x)
        assert (all(map(lambda x, y: x == y, x, x_rec)) and
                x.dtype == x_rec.dtype)

    def test_list_mixed(self):
        x = [1.0, np.float32(3.5), np.complex128(4.25), u('foo')]
        x_rec = self.encode_decode(x)
        # current msgpack cannot distinguish list/tuple
        tm.assert_almost_equal(tuple(x), x_rec)

        x_rec = self.encode_decode(tuple(x))
        tm.assert_almost_equal(tuple(x), x_rec)


class TestBasic(TestPackers):

    def test_timestamp(self):

        for i in [Timestamp(
            '20130101'), Timestamp('20130101', tz='US/Eastern'),
                Timestamp('201301010501')]:
            i_rec = self.encode_decode(i)
            assert i == i_rec

    def test_nat(self):
        nat_rec = self.encode_decode(NaT)
        assert NaT is nat_rec

    def test_datetimes(self):

        # fails under 2.6/win32 (np.datetime64 seems broken)

        if LooseVersion(sys.version) < '2.7':
            pytest.skip('2.6 with np.datetime64 is broken')

        for i in [datetime.datetime(2013, 1, 1),
                  datetime.datetime(2013, 1, 1, 5, 1),
                  datetime.date(2013, 1, 1),
                  np.datetime64(datetime.datetime(2013, 1, 5, 2, 15))]:
            i_rec = self.encode_decode(i)
            assert i == i_rec

    def test_timedeltas(self):

        for i in [datetime.timedelta(days=1),
                  datetime.timedelta(days=1, seconds=10),
                  np.timedelta64(1000000)]:
            i_rec = self.encode_decode(i)
            assert i == i_rec


class TestIndex(TestPackers):

    def setup_method(self, method):
        super(TestIndex, self).setup_method(method)

        self.d = {
            'string': tm.makeStringIndex(100),
            'date': tm.makeDateIndex(100),
            'int': tm.makeIntIndex(100),
            'rng': tm.makeRangeIndex(100),
            'float': tm.makeFloatIndex(100),
            'empty': Index([]),
            'tuple': Index(zip(['foo', 'bar', 'baz'], [1, 2, 3])),
            'period': Index(period_range('2012-1-1', freq='M', periods=3)),
            'date2': Index(date_range('2013-01-1', periods=10)),
            'bdate': Index(bdate_range('2013-01-02', periods=10)),
            'cat': tm.makeCategoricalIndex(100)
        }

        self.mi = {
            'reg': MultiIndex.from_tuples([('bar', 'one'), ('baz', 'two'),
                                           ('foo', 'two'),
                                           ('qux', 'one'), ('qux', 'two')],
                                          names=['first', 'second']),
        }

    def test_basic_index(self):

        for s, i in self.d.items():
            i_rec = self.encode_decode(i)
            tm.assert_index_equal(i, i_rec)

        # datetime with no freq (GH5506)
        i = Index([Timestamp('20130101'), Timestamp('20130103')])
        i_rec = self.encode_decode(i)
        tm.assert_index_equal(i, i_rec)

        # datetime with timezone
        i = Index([Timestamp('20130101 9:00:00'), Timestamp(
            '20130103 11:00:00')]).tz_localize('US/Eastern')
        i_rec = self.encode_decode(i)
        tm.assert_index_equal(i, i_rec)

    def test_multi_index(self):

        for s, i in self.mi.items():
            i_rec = self.encode_decode(i)
            tm.assert_index_equal(i, i_rec)

    def test_unicode(self):
        i = tm.makeUnicodeIndex(100)

        i_rec = self.encode_decode(i)
        tm.assert_index_equal(i, i_rec)

    def categorical_index(self):
        # GH15487
        df = DataFrame(np.random.randn(10, 2))
        df = df.astype({0: 'category'}).set_index(0)
        result = self.encode_decode(df)
        tm.assert_frame_equal(result, df)


class TestSeries(TestPackers):

    def setup_method(self, method):
        super(TestSeries, self).setup_method(method)

        self.d = {}

        s = tm.makeStringSeries()
        s.name = 'string'
        self.d['string'] = s

        s = tm.makeObjectSeries()
        s.name = 'object'
        self.d['object'] = s

        s = Series(iNaT, dtype='M8[ns]', index=range(5))
        self.d['date'] = s

        data = {
            'A': [0., 1., 2., 3., np.nan],
            'B': [0, 1, 0, 1, 0],
            'C': ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
            'D': date_range('1/1/2009', periods=5),
            'E': [0., 1, Timestamp('20100101'), 'foo', 2.],
            'F': [Timestamp('20130102', tz='US/Eastern')] * 2 +
                 [Timestamp('20130603', tz='CET')] * 3,
            'G': [Timestamp('20130102', tz='US/Eastern')] * 5,
            'H': Categorical([1, 2, 3, 4, 5]),
            'I': Categorical([1, 2, 3, 4, 5], ordered=True),
        }

        self.d['float'] = Series(data['A'])
        self.d['int'] = Series(data['B'])
        self.d['mixed'] = Series(data['E'])
        self.d['dt_tz_mixed'] = Series(data['F'])
        self.d['dt_tz'] = Series(data['G'])
        self.d['cat_ordered'] = Series(data['H'])
        self.d['cat_unordered'] = Series(data['I'])

    def test_basic(self):

        # run multiple times here
        for n in range(10):
            for s, i in self.d.items():
                i_rec = self.encode_decode(i)
                assert_series_equal(i, i_rec)


class TestCategorical(TestPackers):

    def setup_method(self, method):
        super(TestCategorical, self).setup_method(method)

        self.d = {}

        self.d['plain_str'] = Categorical(['a', 'b', 'c', 'd', 'e'])
        self.d['plain_str_ordered'] = Categorical(['a', 'b', 'c', 'd', 'e'],
                                                  ordered=True)

        self.d['plain_int'] = Categorical([5, 6, 7, 8])
        self.d['plain_int_ordered'] = Categorical([5, 6, 7, 8], ordered=True)

    def test_basic(self):

        # run multiple times here
        for n in range(10):
            for s, i in self.d.items():
                i_rec = self.encode_decode(i)
                assert_categorical_equal(i, i_rec)


class TestNDFrame(TestPackers):

    def setup_method(self, method):
        super(TestNDFrame, self).setup_method(method)

        data = {
            'A': [0., 1., 2., 3., np.nan],
            'B': [0, 1, 0, 1, 0],
            'C': ['foo1', 'foo2', 'foo3', 'foo4', 'foo5'],
            'D': date_range('1/1/2009', periods=5),
            'E': [0., 1, Timestamp('20100101'), 'foo', 2.],
            'F': [Timestamp('20130102', tz='US/Eastern')] * 5,
            'G': [Timestamp('20130603', tz='CET')] * 5,
            'H': Categorical(['a', 'b', 'c', 'd', 'e']),
            'I': Categorical(['a', 'b', 'c', 'd', 'e'], ordered=True),
        }

        self.frame = {
            'float': DataFrame(dict(A=data['A'], B=Series(data['A']) + 1)),
            'int': DataFrame(dict(A=data['B'], B=Series(data['B']) + 1)),
            'mixed': DataFrame(data)}

        with catch_warnings(record=True):
            self.panel = {
                'float': Panel(dict(ItemA=self.frame['float'],
                                    ItemB=self.frame['float'] + 1))}

    def test_basic_frame(self):

        for s, i in self.frame.items():
            i_rec = self.encode_decode(i)
            assert_frame_equal(i, i_rec)

    def test_basic_panel(self):

        with catch_warnings(record=True):
            for s, i in self.panel.items():
                i_rec = self.encode_decode(i)
                assert_panel_equal(i, i_rec)

    def test_multi(self):

        i_rec = self.encode_decode(self.frame)
        for k in self.frame.keys():
            assert_frame_equal(self.frame[k], i_rec[k])

        l = tuple([self.frame['float'], self.frame['float'].A,
                   self.frame['float'].B, None])
        l_rec = self.encode_decode(l)
        check_arbitrary(l, l_rec)

        # this is an oddity in that packed lists will be returned as tuples
        l = [self.frame['float'], self.frame['float']
             .A, self.frame['float'].B, None]
        l_rec = self.encode_decode(l)
        assert isinstance(l_rec, tuple)
        check_arbitrary(l, l_rec)

    def test_iterator(self):

        l = [self.frame['float'], self.frame['float']
             .A, self.frame['float'].B, None]

        with ensure_clean(self.path) as path:
            to_msgpack(path, *l)
            for i, packed in enumerate(read_msgpack(path, iterator=True)):
                check_arbitrary(packed, l[i])

    def tests_datetimeindex_freq_issue(self):

        # GH 5947
        # inferring freq on the datetimeindex
        df = DataFrame([1, 2, 3], index=date_range('1/1/2013', '1/3/2013'))
        result = self.encode_decode(df)
        assert_frame_equal(result, df)

        df = DataFrame([1, 2], index=date_range('1/1/2013', '1/2/2013'))
        result = self.encode_decode(df)
        assert_frame_equal(result, df)

    def test_dataframe_duplicate_column_names(self):

        # GH 9618
        expected_1 = DataFrame(columns=['a', 'a'])
        expected_2 = DataFrame(columns=[1] * 100)
        expected_2.loc[0] = np.random.randn(100)
        expected_3 = DataFrame(columns=[1, 1])
        expected_3.loc[0] = ['abc', np.nan]

        result_1 = self.encode_decode(expected_1)
        result_2 = self.encode_decode(expected_2)
        result_3 = self.encode_decode(expected_3)

        assert_frame_equal(result_1, expected_1)
        assert_frame_equal(result_2, expected_2)
        assert_frame_equal(result_3, expected_3)


class TestSparse(TestPackers):

    def _check_roundtrip(self, obj, comparator, **kwargs):

        # currently these are not implemetned
        # i_rec = self.encode_decode(obj)
        # comparator(obj, i_rec, **kwargs)
        pytest.raises(NotImplementedError, self.encode_decode, obj)

    def test_sparse_series(self):

        s = tm.makeStringSeries()
        s[3:5] = np.nan
        ss = s.to_sparse()
        self._check_roundtrip(ss, tm.assert_series_equal,
                              check_series_type=True)

        ss2 = s.to_sparse(kind='integer')
        self._check_roundtrip(ss2, tm.assert_series_equal,
                              check_series_type=True)

        ss3 = s.to_sparse(fill_value=0)
        self._check_roundtrip(ss3, tm.assert_series_equal,
                              check_series_type=True)

    def test_sparse_frame(self):

        s = tm.makeDataFrame()
        s.loc[3:5, 1:3] = np.nan
        s.loc[8:10, -2] = np.nan
        ss = s.to_sparse()

        self._check_roundtrip(ss, tm.assert_frame_equal,
                              check_frame_type=True)

        ss2 = s.to_sparse(kind='integer')
        self._check_roundtrip(ss2, tm.assert_frame_equal,
                              check_frame_type=True)

        ss3 = s.to_sparse(fill_value=0)
        self._check_roundtrip(ss3, tm.assert_frame_equal,
                              check_frame_type=True)


class TestCompression(TestPackers):
    """See https://github.com/pandas-dev/pandas/pull/9783
    """

    def setup_method(self, method):
        try:
            from sqlalchemy import create_engine
            self._create_sql_engine = create_engine
        except ImportError:
            self._SQLALCHEMY_INSTALLED = False
        else:
            self._SQLALCHEMY_INSTALLED = True

        super(TestCompression, self).setup_method(method)
        data = {
            'A': np.arange(1000, dtype=np.float64),
            'B': np.arange(1000, dtype=np.int32),
            'C': list(100 * 'abcdefghij'),
            'D': date_range(datetime.datetime(2015, 4, 1), periods=1000),
            'E': [datetime.timedelta(days=x) for x in range(1000)],
        }
        self.frame = {
            'float': DataFrame(dict((k, data[k]) for k in ['A', 'A'])),
            'int': DataFrame(dict((k, data[k]) for k in ['B', 'B'])),
            'mixed': DataFrame(data),
        }

    def test_plain(self):
        i_rec = self.encode_decode(self.frame)
        for k in self.frame.keys():
            assert_frame_equal(self.frame[k], i_rec[k])

    def _test_compression(self, compress):
        i_rec = self.encode_decode(self.frame, compress=compress)
        for k in self.frame.keys():
            value = i_rec[k]
            expected = self.frame[k]
            assert_frame_equal(value, expected)
            # make sure that we can write to the new frames
            for block in value._data.blocks:
                assert block.values.flags.writeable

    def test_compression_zlib(self):
        if not _ZLIB_INSTALLED:
            pytest.skip('no zlib')
        self._test_compression('zlib')

    def test_compression_blosc(self):
        if not _BLOSC_INSTALLED:
            pytest.skip('no blosc')
        self._test_compression('blosc')

    def _test_compression_warns_when_decompress_caches(self, compress):
        not_garbage = []
        control = []  # copied data

        compress_module = globals()[compress]
        real_decompress = compress_module.decompress

        def decompress(ob):
            """mock decompress function that delegates to the real
            decompress but caches the result and a copy of the result.
            """
            res = real_decompress(ob)
            not_garbage.append(res)  # hold a reference to this bytes object
            control.append(bytearray(res))  # copy the data here to check later
            return res

        # types mapped to values to add in place.
        rhs = {
            np.dtype('float64'): 1.0,
            np.dtype('int32'): 1,
            np.dtype('object'): 'a',
            np.dtype('datetime64[ns]'): np.timedelta64(1, 'ns'),
            np.dtype('timedelta64[ns]'): np.timedelta64(1, 'ns'),
        }

        with patch(compress_module, 'decompress', decompress), \
                tm.assert_produces_warning(PerformanceWarning) as ws:

            i_rec = self.encode_decode(self.frame, compress=compress)
            for k in self.frame.keys():

                value = i_rec[k]
                expected = self.frame[k]
                assert_frame_equal(value, expected)
                # make sure that we can write to the new frames even though
                # we needed to copy the data
                for block in value._data.blocks:
                    assert block.values.flags.writeable
                    # mutate the data in some way
                    block.values[0] += rhs[block.dtype]

        for w in ws:
            # check the messages from our warnings
            assert str(w.message) == ('copying data after decompressing; '
                                      'this may mean that decompress is '
                                      'caching its result')

        for buf, control_buf in zip(not_garbage, control):
            # make sure none of our mutations above affected the
            # original buffers
            assert buf == control_buf

    def test_compression_warns_when_decompress_caches_zlib(self):
        if not _ZLIB_INSTALLED:
            pytest.skip('no zlib')
        self._test_compression_warns_when_decompress_caches('zlib')

    def test_compression_warns_when_decompress_caches_blosc(self):
        if not _BLOSC_INSTALLED:
            pytest.skip('no blosc')
        self._test_compression_warns_when_decompress_caches('blosc')

    def _test_small_strings_no_warn(self, compress):
        empty = np.array([], dtype='uint8')
        with tm.assert_produces_warning(None):
            empty_unpacked = self.encode_decode(empty, compress=compress)

        tm.assert_numpy_array_equal(empty_unpacked, empty)
        assert empty_unpacked.flags.writeable

        char = np.array([ord(b'a')], dtype='uint8')
        with tm.assert_produces_warning(None):
            char_unpacked = self.encode_decode(char, compress=compress)

        tm.assert_numpy_array_equal(char_unpacked, char)
        assert char_unpacked.flags.writeable
        # if this test fails I am sorry because the interpreter is now in a
        # bad state where b'a' points to 98 == ord(b'b').
        char_unpacked[0] = ord(b'b')

        # we compare the ord of bytes b'a' with unicode u'a' because the should
        # always be the same (unless we were able to mutate the shared
        # character singleton in which case ord(b'a') == ord(b'b').
        assert ord(b'a') == ord(u'a')
        tm.assert_numpy_array_equal(
            char_unpacked,
            np.array([ord(b'b')], dtype='uint8'),
        )

    def test_small_strings_no_warn_zlib(self):
        if not _ZLIB_INSTALLED:
            pytest.skip('no zlib')
        self._test_small_strings_no_warn('zlib')

    def test_small_strings_no_warn_blosc(self):
        if not _BLOSC_INSTALLED:
            pytest.skip('no blosc')
        self._test_small_strings_no_warn('blosc')

    def test_readonly_axis_blosc(self):
        # GH11880
        if not _BLOSC_INSTALLED:
            pytest.skip('no blosc')
        df1 = DataFrame({'A': list('abcd')})
        df2 = DataFrame(df1, index=[1., 2., 3., 4.])
        assert 1 in self.encode_decode(df1['A'], compress='blosc')
        assert 1. in self.encode_decode(df2['A'], compress='blosc')

    def test_readonly_axis_zlib(self):
        # GH11880
        df1 = DataFrame({'A': list('abcd')})
        df2 = DataFrame(df1, index=[1., 2., 3., 4.])
        assert 1 in self.encode_decode(df1['A'], compress='zlib')
        assert 1. in self.encode_decode(df2['A'], compress='zlib')

    def test_readonly_axis_blosc_to_sql(self):
        # GH11880
        if not _BLOSC_INSTALLED:
            pytest.skip('no blosc')
        if not self._SQLALCHEMY_INSTALLED:
            pytest.skip('no sqlalchemy')
        expected = DataFrame({'A': list('abcd')})
        df = self.encode_decode(expected, compress='blosc')
        eng = self._create_sql_engine("sqlite:///:memory:")
        df.to_sql('test', eng, if_exists='append')
        result = pandas.read_sql_table('test', eng, index_col='index')
        result.index.names = [None]
        assert_frame_equal(expected, result)

    def test_readonly_axis_zlib_to_sql(self):
        # GH11880
        if not _ZLIB_INSTALLED:
            pytest.skip('no zlib')
        if not self._SQLALCHEMY_INSTALLED:
            pytest.skip('no sqlalchemy')
        expected = DataFrame({'A': list('abcd')})
        df = self.encode_decode(expected, compress='zlib')
        eng = self._create_sql_engine("sqlite:///:memory:")
        df.to_sql('test', eng, if_exists='append')
        result = pandas.read_sql_table('test', eng, index_col='index')
        result.index.names = [None]
        assert_frame_equal(expected, result)


class TestEncoding(TestPackers):

    def setup_method(self, method):
        super(TestEncoding, self).setup_method(method)
        data = {
            'A': [compat.u('\u2019')] * 1000,
            'B': np.arange(1000, dtype=np.int32),
            'C': list(100 * 'abcdefghij'),
            'D': date_range(datetime.datetime(2015, 4, 1), periods=1000),
            'E': [datetime.timedelta(days=x) for x in range(1000)],
            'G': [400] * 1000
        }
        self.frame = {
            'float': DataFrame(dict((k, data[k]) for k in ['A', 'A'])),
            'int': DataFrame(dict((k, data[k]) for k in ['B', 'B'])),
            'mixed': DataFrame(data),
        }
        self.utf_encodings = ['utf8', 'utf16', 'utf32']

    def test_utf(self):
        # GH10581
        for encoding in self.utf_encodings:
            for frame in compat.itervalues(self.frame):
                result = self.encode_decode(frame, encoding=encoding)
                assert_frame_equal(result, frame)

    def test_default_encoding(self):
        for frame in compat.itervalues(self.frame):
            result = frame.to_msgpack()
            expected = frame.to_msgpack(encoding='utf8')
            assert result == expected
            result = self.encode_decode(frame)
            assert_frame_equal(result, frame)


def legacy_packers_versions():
    # yield the packers versions
    path = tm.get_data_path('legacy_msgpack')
    for v in os.listdir(path):
        p = os.path.join(path, v)
        if os.path.isdir(p):
            yield v


class TestMsgpack(object):
    """
    How to add msgpack tests:

    1. Install pandas version intended to output the msgpack.
TestPackers
    2. Execute "generate_legacy_storage_files.py" to create the msgpack.
    $ python generate_legacy_storage_files.py <output_dir> msgpack

    3. Move the created pickle to "data/legacy_msgpack/<version>" directory.
    """

    minimum_structure = {'series': ['float', 'int', 'mixed',
                                    'ts', 'mi', 'dup'],
                         'frame': ['float', 'int', 'mixed', 'mi'],
                         'panel': ['float'],
                         'index': ['int', 'date', 'period'],
                         'mi': ['reg2']}

    def check_min_structure(self, data, version):
        for typ, v in self.minimum_structure.items():
            assert typ in data, '"{0}" not found in unpacked data'.format(typ)
            for kind in v:
                msg = '"{0}" not found in data["{1}"]'.format(kind, typ)
                assert kind in data[typ], msg

    def compare(self, current_data, all_data, vf, version):
        # GH12277 encoding default used to be latin-1, now utf-8
        if LooseVersion(version) < '0.18.0':
            data = read_msgpack(vf, encoding='latin-1')
        else:
            data = read_msgpack(vf)
        self.check_min_structure(data, version)
        for typ, dv in data.items():
            assert typ in all_data, ('unpacked data contains '
                                     'extra key "{0}"'
                                     .format(typ))
            for dt, result in dv.items():
                assert dt in current_data[typ], ('data["{0}"] contains extra '
                                                 'key "{1}"'.format(typ, dt))
                try:
                    expected = current_data[typ][dt]
                except KeyError:
                    continue

                # use a specific comparator
                # if available
                comp_method = "compare_{typ}_{dt}".format(typ=typ, dt=dt)
                comparator = getattr(self, comp_method, None)
                if comparator is not None:
                    comparator(result, expected, typ, version)
                else:
                    check_arbitrary(result, expected)

        return data

    def compare_series_dt_tz(self, result, expected, typ, version):
        # 8260
        # dtype is object < 0.17.0
        if LooseVersion(version) < '0.17.0':
            expected = expected.astype(object)
            tm.assert_series_equal(result, expected)
        else:
            tm.assert_series_equal(result, expected)

    def compare_frame_dt_mixed_tzs(self, result, expected, typ, version):
        # 8260
        # dtype is object < 0.17.0
        if LooseVersion(version) < '0.17.0':
            expected = expected.astype(object)
            tm.assert_frame_equal(result, expected)
        else:
            tm.assert_frame_equal(result, expected)

    @pytest.mark.parametrize('version', legacy_packers_versions())
    def test_msgpacks_legacy(self, current_packers_data, all_packers_data,
                             version):

        pth = tm.get_data_path('legacy_msgpack/{0}'.format(version))
        n = 0
        for f in os.listdir(pth):
            # GH12142 0.17 files packed in P2 can't be read in P3
            if (compat.PY3 and version.startswith('0.17.') and
                    f.split('.')[-4][-1] == '2'):
                continue
            vf = os.path.join(pth, f)
            try:
                with catch_warnings(record=True):
                    self.compare(current_packers_data, all_packers_data,
                                 vf, version)
            except ImportError:
                # blosc not installed
                continue
            n += 1
        assert n > 0, 'Msgpack files are not tested'
