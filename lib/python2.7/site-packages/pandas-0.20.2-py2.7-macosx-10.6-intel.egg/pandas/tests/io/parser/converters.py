# -*- coding: utf-8 -*-

"""
Tests column conversion functionality during parsing
for all of the parsers defined in parsers.py
"""

from datetime import datetime

import pytest

import numpy as np
import pandas as pd
import pandas.util.testing as tm

from pandas._libs.lib import Timestamp
from pandas import DataFrame, Index
from pandas.compat import parse_date, StringIO, lmap


class ConverterTests(object):

    def test_converters_type_must_be_dict(self):
        data = """index,A,B,C,D
foo,2,3,4,5
"""
        with tm.assert_raises_regex(TypeError, 'Type converters.+'):
            self.read_csv(StringIO(data), converters=0)

    def test_converters(self):
        data = """A,B,C,D
a,1,2,01/01/2009
b,3,4,01/02/2009
c,4,5,01/03/2009
"""
        result = self.read_csv(StringIO(data), converters={'D': parse_date})
        result2 = self.read_csv(StringIO(data), converters={3: parse_date})

        expected = self.read_csv(StringIO(data))
        expected['D'] = expected['D'].map(parse_date)

        assert isinstance(result['D'][0], (datetime, Timestamp))
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result2, expected)

        # produce integer
        converter = lambda x: int(x.split('/')[2])
        result = self.read_csv(StringIO(data), converters={'D': converter})
        expected = self.read_csv(StringIO(data))
        expected['D'] = expected['D'].map(converter)
        tm.assert_frame_equal(result, expected)

    def test_converters_no_implicit_conv(self):
        # see gh-2184
        data = """000102,1.2,A\n001245,2,B"""
        f = lambda x: x.strip()
        converter = {0: f}
        df = self.read_csv(StringIO(data), header=None, converters=converter)
        assert df[0].dtype == object

    def test_converters_euro_decimal_format(self):
        data = """Id;Number1;Number2;Text1;Text2;Number3
1;1521,1541;187101,9543;ABC;poi;4,738797819
2;121,12;14897,76;DEF;uyt;0,377320872
3;878,158;108013,434;GHI;rez;2,735694704"""
        f = lambda x: float(x.replace(",", "."))
        converter = {'Number1': f, 'Number2': f, 'Number3': f}
        df2 = self.read_csv(StringIO(data), sep=';', converters=converter)
        assert df2['Number1'].dtype == float
        assert df2['Number2'].dtype == float
        assert df2['Number3'].dtype == float

    def test_converter_return_string_bug(self):
        # see gh-583
        data = """Id;Number1;Number2;Text1;Text2;Number3
1;1521,1541;187101,9543;ABC;poi;4,738797819
2;121,12;14897,76;DEF;uyt;0,377320872
3;878,158;108013,434;GHI;rez;2,735694704"""
        f = lambda x: float(x.replace(",", "."))
        converter = {'Number1': f, 'Number2': f, 'Number3': f}
        df2 = self.read_csv(StringIO(data), sep=';', converters=converter)
        assert df2['Number1'].dtype == float

    def test_converters_corner_with_nas(self):
        # skip aberration observed on Win64 Python 3.2.2
        if hash(np.int64(-1)) != -2:
            pytest.skip("skipping because of windows hash on Python"
                        " 3.2.2")

        data = """id,score,days
1,2,12
2,2-5,
3,,14+
4,6-12,2"""

        def convert_days(x):
            x = x.strip()
            if not x:
                return np.nan

            is_plus = x.endswith('+')
            if is_plus:
                x = int(x[:-1]) + 1
            else:
                x = int(x)
            return x

        def convert_days_sentinel(x):
            x = x.strip()
            if not x:
                return np.nan

            is_plus = x.endswith('+')
            if is_plus:
                x = int(x[:-1]) + 1
            else:
                x = int(x)
            return x

        def convert_score(x):
            x = x.strip()
            if not x:
                return np.nan
            if x.find('-') > 0:
                valmin, valmax = lmap(int, x.split('-'))
                val = 0.5 * (valmin + valmax)
            else:
                val = float(x)

            return val

        fh = StringIO(data)
        result = self.read_csv(fh, converters={'score': convert_score,
                                               'days': convert_days},
                               na_values=['', None])
        assert pd.isnull(result['days'][1])

        fh = StringIO(data)
        result2 = self.read_csv(fh, converters={'score': convert_score,
                                                'days': convert_days_sentinel},
                                na_values=['', None])
        tm.assert_frame_equal(result, result2)

    def test_converter_index_col_bug(self):
        # see gh-1835
        data = "A;B\n1;2\n3;4"

        rs = self.read_csv(StringIO(data), sep=';', index_col='A',
                           converters={'A': lambda x: x})

        xp = DataFrame({'B': [2, 4]}, index=Index([1, 3], name='A'))
        tm.assert_frame_equal(rs, xp)
        assert rs.index.name == xp.index.name
