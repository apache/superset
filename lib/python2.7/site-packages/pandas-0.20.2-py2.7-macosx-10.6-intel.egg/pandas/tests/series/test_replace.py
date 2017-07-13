# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytest

import numpy as np
import pandas as pd
import pandas._libs.lib as lib
import pandas.util.testing as tm

from .common import TestData


class TestSeriesReplace(TestData):
    def test_replace(self):
        N = 100
        ser = pd.Series(np.random.randn(N))
        ser[0:4] = np.nan
        ser[6:10] = 0

        # replace list with a single value
        ser.replace([np.nan], -1, inplace=True)

        exp = ser.fillna(-1)
        tm.assert_series_equal(ser, exp)

        rs = ser.replace(0., np.nan)
        ser[ser == 0.] = np.nan
        tm.assert_series_equal(rs, ser)

        ser = pd.Series(np.fabs(np.random.randn(N)), tm.makeDateIndex(N),
                        dtype=object)
        ser[:5] = np.nan
        ser[6:10] = 'foo'
        ser[20:30] = 'bar'

        # replace list with a single value
        rs = ser.replace([np.nan, 'foo', 'bar'], -1)

        assert (rs[:5] == -1).all()
        assert (rs[6:10] == -1).all()
        assert (rs[20:30] == -1).all()
        assert (pd.isnull(ser[:5])).all()

        # replace with different values
        rs = ser.replace({np.nan: -1, 'foo': -2, 'bar': -3})

        assert (rs[:5] == -1).all()
        assert (rs[6:10] == -2).all()
        assert (rs[20:30] == -3).all()
        assert (pd.isnull(ser[:5])).all()

        # replace with different values with 2 lists
        rs2 = ser.replace([np.nan, 'foo', 'bar'], [-1, -2, -3])
        tm.assert_series_equal(rs, rs2)

        # replace inplace
        ser.replace([np.nan, 'foo', 'bar'], -1, inplace=True)

        assert (ser[:5] == -1).all()
        assert (ser[6:10] == -1).all()
        assert (ser[20:30] == -1).all()

        ser = pd.Series([np.nan, 0, np.inf])
        tm.assert_series_equal(ser.replace(np.nan, 0), ser.fillna(0))

        ser = pd.Series([np.nan, 0, 'foo', 'bar', np.inf, None, lib.NaT])
        tm.assert_series_equal(ser.replace(np.nan, 0), ser.fillna(0))
        filled = ser.copy()
        filled[4] = 0
        tm.assert_series_equal(ser.replace(np.inf, 0), filled)

        ser = pd.Series(self.ts.index)
        tm.assert_series_equal(ser.replace(np.nan, 0), ser.fillna(0))

        # malformed
        pytest.raises(ValueError, ser.replace, [1, 2, 3], [np.nan, 0])

        # make sure that we aren't just masking a TypeError because bools don't
        # implement indexing
        with tm.assert_raises_regex(TypeError, 'Cannot compare types .+'):
            ser.replace([1, 2], [np.nan, 0])

        ser = pd.Series([0, 1, 2, 3, 4])
        result = ser.replace([0, 1, 2, 3, 4], [4, 3, 2, 1, 0])
        tm.assert_series_equal(result, pd.Series([4, 3, 2, 1, 0]))

    def test_replace_gh5319(self):
        # API change from 0.12?
        # GH 5319
        ser = pd.Series([0, np.nan, 2, 3, 4])
        expected = ser.ffill()
        result = ser.replace([np.nan])
        tm.assert_series_equal(result, expected)

        ser = pd.Series([0, np.nan, 2, 3, 4])
        expected = ser.ffill()
        result = ser.replace(np.nan)
        tm.assert_series_equal(result, expected)
        # GH 5797
        ser = pd.Series(pd.date_range('20130101', periods=5))
        expected = ser.copy()
        expected.loc[2] = pd.Timestamp('20120101')
        result = ser.replace({pd.Timestamp('20130103'):
                              pd.Timestamp('20120101')})
        tm.assert_series_equal(result, expected)
        result = ser.replace(pd.Timestamp('20130103'),
                             pd.Timestamp('20120101'))
        tm.assert_series_equal(result, expected)

    def test_replace_with_single_list(self):
        ser = pd.Series([0, 1, 2, 3, 4])
        result = ser.replace([1, 2, 3])
        tm.assert_series_equal(result, pd.Series([0, 0, 0, 0, 4]))

        s = ser.copy()
        s.replace([1, 2, 3], inplace=True)
        tm.assert_series_equal(s, pd.Series([0, 0, 0, 0, 4]))

        # make sure things don't get corrupted when fillna call fails
        s = ser.copy()
        with pytest.raises(ValueError):
            s.replace([1, 2, 3], inplace=True, method='crash_cymbal')
        tm.assert_series_equal(s, ser)

    def test_replace_mixed_types(self):
        s = pd.Series(np.arange(5), dtype='int64')

        def check_replace(to_rep, val, expected):
            sc = s.copy()
            r = s.replace(to_rep, val)
            sc.replace(to_rep, val, inplace=True)
            tm.assert_series_equal(expected, r)
            tm.assert_series_equal(expected, sc)

        # MUST upcast to float
        e = pd.Series([0., 1., 2., 3., 4.])
        tr, v = [3], [3.0]
        check_replace(tr, v, e)

        # MUST upcast to float
        e = pd.Series([0, 1, 2, 3.5, 4])
        tr, v = [3], [3.5]
        check_replace(tr, v, e)

        # casts to object
        e = pd.Series([0, 1, 2, 3.5, 'a'])
        tr, v = [3, 4], [3.5, 'a']
        check_replace(tr, v, e)

        # again casts to object
        e = pd.Series([0, 1, 2, 3.5, pd.Timestamp('20130101')])
        tr, v = [3, 4], [3.5, pd.Timestamp('20130101')]
        check_replace(tr, v, e)

        # casts to object
        e = pd.Series([0, 1, 2, 3.5, True], dtype='object')
        tr, v = [3, 4], [3.5, True]
        check_replace(tr, v, e)

        # test an object with dates + floats + integers + strings
        dr = pd.date_range('1/1/2001', '1/10/2001',
                           freq='D').to_series().reset_index(drop=True)
        result = dr.astype(object).replace(
            [dr[0], dr[1], dr[2]], [1.0, 2, 'a'])
        expected = pd.Series([1.0, 2, 'a'] + dr[3:].tolist(), dtype=object)
        tm.assert_series_equal(result, expected)

    def test_replace_bool_with_string_no_op(self):
        s = pd.Series([True, False, True])
        result = s.replace('fun', 'in-the-sun')
        tm.assert_series_equal(s, result)

    def test_replace_bool_with_string(self):
        # nonexistent elements
        s = pd.Series([True, False, True])
        result = s.replace(True, '2u')
        expected = pd.Series(['2u', False, '2u'])
        tm.assert_series_equal(expected, result)

    def test_replace_bool_with_bool(self):
        s = pd.Series([True, False, True])
        result = s.replace(True, False)
        expected = pd.Series([False] * len(s))
        tm.assert_series_equal(expected, result)

    def test_replace_with_dict_with_bool_keys(self):
        s = pd.Series([True, False, True])
        with tm.assert_raises_regex(TypeError, 'Cannot compare types .+'):
            s.replace({'asdf': 'asdb', True: 'yes'})

    def test_replace2(self):
        N = 100
        ser = pd.Series(np.fabs(np.random.randn(N)), tm.makeDateIndex(N),
                        dtype=object)
        ser[:5] = np.nan
        ser[6:10] = 'foo'
        ser[20:30] = 'bar'

        # replace list with a single value
        rs = ser.replace([np.nan, 'foo', 'bar'], -1)

        assert (rs[:5] == -1).all()
        assert (rs[6:10] == -1).all()
        assert (rs[20:30] == -1).all()
        assert (pd.isnull(ser[:5])).all()

        # replace with different values
        rs = ser.replace({np.nan: -1, 'foo': -2, 'bar': -3})

        assert (rs[:5] == -1).all()
        assert (rs[6:10] == -2).all()
        assert (rs[20:30] == -3).all()
        assert (pd.isnull(ser[:5])).all()

        # replace with different values with 2 lists
        rs2 = ser.replace([np.nan, 'foo', 'bar'], [-1, -2, -3])
        tm.assert_series_equal(rs, rs2)

        # replace inplace
        ser.replace([np.nan, 'foo', 'bar'], -1, inplace=True)
        assert (ser[:5] == -1).all()
        assert (ser[6:10] == -1).all()
        assert (ser[20:30] == -1).all()

    def test_replace_with_empty_dictlike(self):
        # GH 15289
        s = pd.Series(list('abcd'))
        tm.assert_series_equal(s, s.replace(dict()))
        tm.assert_series_equal(s, s.replace(pd.Series([])))

    def test_replace_string_with_number(self):
        # GH 15743
        s = pd.Series([1, 2, 3])
        result = s.replace('2', np.nan)
        expected = pd.Series([1, 2, 3])
        tm.assert_series_equal(expected, result)

    def test_replace_unicode_with_number(self):
        # GH 15743
        s = pd.Series([1, 2, 3])
        result = s.replace(u'2', np.nan)
        expected = pd.Series([1, 2, 3])
        tm.assert_series_equal(expected, result)

    def test_replace_mixed_types_with_string(self):
        # Testing mixed
        s = pd.Series([1, 2, 3, '4', 4, 5])
        result = s.replace([2, '4'], np.nan)
        expected = pd.Series([1, np.nan, 3, np.nan, 4, 5])
        tm.assert_series_equal(expected, result)
