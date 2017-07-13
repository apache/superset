# -*- coding: utf-8 -*-

import pytest
import numpy as np

from pandas import compat
from pandas import (DataFrame, Series, MultiIndex, Timestamp,
                    date_range)

import pandas.util.testing as tm
from pandas.tests.frame.common import TestData


class TestDataFrameConvertTo(TestData):

    def test_to_dict(self):
        test_data = {
            'A': {'1': 1, '2': 2},
            'B': {'1': '1', '2': '2', '3': '3'},
        }
        recons_data = DataFrame(test_data).to_dict()

        for k, v in compat.iteritems(test_data):
            for k2, v2 in compat.iteritems(v):
                assert v2 == recons_data[k][k2]

        recons_data = DataFrame(test_data).to_dict("l")

        for k, v in compat.iteritems(test_data):
            for k2, v2 in compat.iteritems(v):
                assert v2 == recons_data[k][int(k2) - 1]

        recons_data = DataFrame(test_data).to_dict("s")

        for k, v in compat.iteritems(test_data):
            for k2, v2 in compat.iteritems(v):
                assert v2 == recons_data[k][k2]

        recons_data = DataFrame(test_data).to_dict("sp")
        expected_split = {'columns': ['A', 'B'], 'index': ['1', '2', '3'],
                          'data': [[1.0, '1'], [2.0, '2'], [np.nan, '3']]}
        tm.assert_dict_equal(recons_data, expected_split)

        recons_data = DataFrame(test_data).to_dict("r")
        expected_records = [{'A': 1.0, 'B': '1'},
                            {'A': 2.0, 'B': '2'},
                            {'A': np.nan, 'B': '3'}]
        assert isinstance(recons_data, list)
        assert len(recons_data) == 3
        for l, r in zip(recons_data, expected_records):
            tm.assert_dict_equal(l, r)

        # GH10844
        recons_data = DataFrame(test_data).to_dict("i")

        for k, v in compat.iteritems(test_data):
            for k2, v2 in compat.iteritems(v):
                assert v2 == recons_data[k2][k]

    def test_to_dict_timestamp(self):

        # GH11247
        # split/records producing np.datetime64 rather than Timestamps
        # on datetime64[ns] dtypes only

        tsmp = Timestamp('20130101')
        test_data = DataFrame({'A': [tsmp, tsmp], 'B': [tsmp, tsmp]})
        test_data_mixed = DataFrame({'A': [tsmp, tsmp], 'B': [1, 2]})

        expected_records = [{'A': tsmp, 'B': tsmp},
                            {'A': tsmp, 'B': tsmp}]
        expected_records_mixed = [{'A': tsmp, 'B': 1},
                                  {'A': tsmp, 'B': 2}]

        assert (test_data.to_dict(orient='records') ==
                expected_records)
        assert (test_data_mixed.to_dict(orient='records') ==
                expected_records_mixed)

        expected_series = {
            'A': Series([tsmp, tsmp], name='A'),
            'B': Series([tsmp, tsmp], name='B'),
        }
        expected_series_mixed = {
            'A': Series([tsmp, tsmp], name='A'),
            'B': Series([1, 2], name='B'),
        }

        tm.assert_dict_equal(test_data.to_dict(orient='series'),
                             expected_series)
        tm.assert_dict_equal(test_data_mixed.to_dict(orient='series'),
                             expected_series_mixed)

        expected_split = {
            'index': [0, 1],
            'data': [[tsmp, tsmp],
                     [tsmp, tsmp]],
            'columns': ['A', 'B']
        }
        expected_split_mixed = {
            'index': [0, 1],
            'data': [[tsmp, 1],
                     [tsmp, 2]],
            'columns': ['A', 'B']
        }

        tm.assert_dict_equal(test_data.to_dict(orient='split'),
                             expected_split)
        tm.assert_dict_equal(test_data_mixed.to_dict(orient='split'),
                             expected_split_mixed)

    def test_to_dict_invalid_orient(self):
        df = DataFrame({'A': [0, 1]})
        pytest.raises(ValueError, df.to_dict, orient='xinvalid')

    def test_to_records_dt64(self):
        df = DataFrame([["one", "two", "three"],
                        ["four", "five", "six"]],
                       index=date_range("2012-01-01", "2012-01-02"))
        assert df.to_records()['index'][0] == df.index[0]

        rs = df.to_records(convert_datetime64=False)
        assert rs['index'][0] == df.index.values[0]

    def test_to_records_with_multindex(self):
        # GH3189
        index = [['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux'],
                 ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        data = np.zeros((8, 4))
        df = DataFrame(data, index=index)
        r = df.to_records(index=True)['level_0']
        assert 'bar' in r
        assert 'one' not in r

    def test_to_records_with_Mapping_type(self):
        import email
        from email.parser import Parser
        import collections

        collections.Mapping.register(email.message.Message)

        headers = Parser().parsestr('From: <user@example.com>\n'
                                    'To: <someone_else@example.com>\n'
                                    'Subject: Test message\n'
                                    '\n'
                                    'Body would go here\n')

        frame = DataFrame.from_records([headers])
        all(x in frame for x in ['Type', 'Subject', 'From'])

    def test_to_records_floats(self):
        df = DataFrame(np.random.rand(10, 10))
        df.to_records()

    def test_to_records_index_name(self):
        df = DataFrame(np.random.randn(3, 3))
        df.index.name = 'X'
        rs = df.to_records()
        assert 'X' in rs.dtype.fields

        df = DataFrame(np.random.randn(3, 3))
        rs = df.to_records()
        assert 'index' in rs.dtype.fields

        df.index = MultiIndex.from_tuples([('a', 'x'), ('a', 'y'), ('b', 'z')])
        df.index.names = ['A', None]
        rs = df.to_records()
        assert 'level_0' in rs.dtype.fields

    def test_to_records_with_unicode_index(self):
        # GH13172
        # unicode_literals conflict with to_records
        result = DataFrame([{u'a': u'x', u'b': 'y'}]).set_index(u'a')\
            .to_records()
        expected = np.rec.array([('x', 'y')], dtype=[('a', 'O'), ('b', 'O')])
        tm.assert_almost_equal(result, expected)

    def test_to_records_with_unicode_column_names(self):
        # xref issue: https://github.com/numpy/numpy/issues/2407
        # Issue #11879. to_records used to raise an exception when used
        # with column names containing non ascii caracters in Python 2
        result = DataFrame(data={u"accented_name_é": [1.0]}).to_records()

        # Note that numpy allows for unicode field names but dtypes need
        # to be specified using dictionnary intsead of list of tuples.
        expected = np.rec.array(
            [(0, 1.0)],
            dtype={"names": ["index", u"accented_name_é"],
                   "formats": ['<i8', '<f8']}
        )
        tm.assert_almost_equal(result, expected)


@pytest.mark.parametrize('tz', ['UTC', 'GMT', 'US/Eastern'])
def test_to_records_datetimeindex_with_tz(tz):
    # GH13937
    dr = date_range('2016-01-01', periods=10,
                    freq='S', tz=tz)

    df = DataFrame({'datetime': dr}, index=dr)

    expected = df.to_records()
    result = df.tz_convert("UTC").to_records()

    # both converted to UTC, so they are equal
    tm.assert_numpy_array_equal(result, expected)
