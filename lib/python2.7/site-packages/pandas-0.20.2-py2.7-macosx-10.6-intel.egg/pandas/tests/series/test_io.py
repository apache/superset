# coding=utf-8
# pylint: disable-msg=E1101,W0612

from datetime import datetime

import numpy as np
import pandas as pd

from pandas import Series, DataFrame

from pandas.compat import StringIO, u, long
from pandas.util.testing import (assert_series_equal, assert_almost_equal,
                                 assert_frame_equal, ensure_clean)
import pandas.util.testing as tm

from .common import TestData


class TestSeriesToCSV(TestData):

    def test_from_csv(self):

        with ensure_clean() as path:
            self.ts.to_csv(path)
            ts = Series.from_csv(path)
            assert_series_equal(self.ts, ts, check_names=False)
            assert ts.name is None
            assert ts.index.name is None

            # GH10483
            self.ts.to_csv(path, header=True)
            ts_h = Series.from_csv(path, header=0)
            assert ts_h.name == 'ts'

            self.series.to_csv(path)
            series = Series.from_csv(path)
            assert series.name is None
            assert series.index.name is None
            assert_series_equal(self.series, series, check_names=False)
            assert series.name is None
            assert series.index.name is None

            self.series.to_csv(path, header=True)
            series_h = Series.from_csv(path, header=0)
            assert series_h.name == 'series'

            outfile = open(path, 'w')
            outfile.write('1998-01-01|1.0\n1999-01-01|2.0')
            outfile.close()
            series = Series.from_csv(path, sep='|')
            checkseries = Series({datetime(1998, 1, 1): 1.0,
                                  datetime(1999, 1, 1): 2.0})
            assert_series_equal(checkseries, series)

            series = Series.from_csv(path, sep='|', parse_dates=False)
            checkseries = Series({'1998-01-01': 1.0, '1999-01-01': 2.0})
            assert_series_equal(checkseries, series)

    def test_to_csv(self):
        import io

        with ensure_clean() as path:
            self.ts.to_csv(path)

            with io.open(path, newline=None) as f:
                lines = f.readlines()
            assert (lines[1] != '\n')

            self.ts.to_csv(path, index=False)
            arr = np.loadtxt(path)
            assert_almost_equal(arr, self.ts.values)

    def test_to_csv_unicode_index(self):
        buf = StringIO()
        s = Series([u("\u05d0"), "d2"], index=[u("\u05d0"), u("\u05d1")])

        s.to_csv(buf, encoding='UTF-8')
        buf.seek(0)

        s2 = Series.from_csv(buf, index_col=0, encoding='UTF-8')

        assert_series_equal(s, s2)

    def test_to_csv_float_format(self):

        with ensure_clean() as filename:
            ser = Series([0.123456, 0.234567, 0.567567])
            ser.to_csv(filename, float_format='%.2f')

            rs = Series.from_csv(filename)
            xp = Series([0.12, 0.23, 0.57])
            assert_series_equal(rs, xp)

    def test_to_csv_list_entries(self):
        s = Series(['jack and jill', 'jesse and frank'])

        split = s.str.split(r'\s+and\s+')

        buf = StringIO()
        split.to_csv(buf)

    def test_to_csv_path_is_none(self):
        # GH 8215
        # Series.to_csv() was returning None, inconsistent with
        # DataFrame.to_csv() which returned string
        s = Series([1, 2, 3])
        csv_str = s.to_csv(path=None)
        assert isinstance(csv_str, str)


class TestSeriesIO(TestData):

    def test_to_frame(self):
        self.ts.name = None
        rs = self.ts.to_frame()
        xp = pd.DataFrame(self.ts.values, index=self.ts.index)
        assert_frame_equal(rs, xp)

        self.ts.name = 'testname'
        rs = self.ts.to_frame()
        xp = pd.DataFrame(dict(testname=self.ts.values), index=self.ts.index)
        assert_frame_equal(rs, xp)

        rs = self.ts.to_frame(name='testdifferent')
        xp = pd.DataFrame(
            dict(testdifferent=self.ts.values), index=self.ts.index)
        assert_frame_equal(rs, xp)

    def test_to_dict(self):
        tm.assert_series_equal(Series(self.ts.to_dict(), name='ts'), self.ts)

    def test_timeseries_periodindex(self):
        # GH2891
        from pandas import period_range
        prng = period_range('1/1/2011', '1/1/2012', freq='M')
        ts = Series(np.random.randn(len(prng)), prng)
        new_ts = tm.round_trip_pickle(ts)
        assert new_ts.index.freq == 'M'

    def test_pickle_preserve_name(self):
        for n in [777, 777., 'name', datetime(2001, 11, 11), (1, 2)]:
            unpickled = self._pickle_roundtrip_name(tm.makeTimeSeries(name=n))
            assert unpickled.name == n

    def _pickle_roundtrip_name(self, obj):

        with ensure_clean() as path:
            obj.to_pickle(path)
            unpickled = pd.read_pickle(path)
            return unpickled

    def test_to_frame_expanddim(self):
        # GH 9762

        class SubclassedSeries(Series):

            @property
            def _constructor_expanddim(self):
                return SubclassedFrame

        class SubclassedFrame(DataFrame):
            pass

        s = SubclassedSeries([1, 2, 3], name='X')
        result = s.to_frame()
        assert isinstance(result, SubclassedFrame)
        expected = SubclassedFrame({'X': [1, 2, 3]})
        assert_frame_equal(result, expected)


class TestSeriesToList(TestData):

    def test_tolist(self):
        rs = self.ts.tolist()
        xp = self.ts.values.tolist()
        assert_almost_equal(rs, xp)

        # datetime64
        s = Series(self.ts.index)
        rs = s.tolist()
        assert self.ts.index[0] == rs[0]

    def test_tolist_np_int(self):
        # GH10904
        for t in ['int8', 'int16', 'int32', 'int64']:
            s = pd.Series([1], dtype=t)
            assert isinstance(s.tolist()[0], (int, long))

    def test_tolist_np_uint(self):
        # GH10904
        for t in ['uint8', 'uint16']:
            s = pd.Series([1], dtype=t)
            assert isinstance(s.tolist()[0], int)
        for t in ['uint32', 'uint64']:
            s = pd.Series([1], dtype=t)
            assert isinstance(s.tolist()[0], long)

    def test_tolist_np_float(self):
        # GH10904
        for t in ['float16', 'float32', 'float64']:
            s = pd.Series([1], dtype=t)
            assert isinstance(s.tolist()[0], float)
