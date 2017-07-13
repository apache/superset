from pandas import DataFrame
import numpy as np
import pandas as pd
from pandas.util import testing as tm


class TestToCSV(object):

    def test_to_csv_quotechar(self):
        df = DataFrame({'col': [1, 2]})
        expected = """\
"","col"
"0","1"
"1","2"
"""

        with tm.ensure_clean('test.csv') as path:
            df.to_csv(path, quoting=1)  # 1=QUOTE_ALL
            with open(path, 'r') as f:
                assert f.read() == expected

        expected = """\
$$,$col$
$0$,$1$
$1$,$2$
"""

        with tm.ensure_clean('test.csv') as path:
            df.to_csv(path, quoting=1, quotechar="$")
            with open(path, 'r') as f:
                assert f.read() == expected

        with tm.ensure_clean('test.csv') as path:
            with tm.assert_raises_regex(TypeError, 'quotechar'):
                df.to_csv(path, quoting=1, quotechar=None)

    def test_to_csv_doublequote(self):
        df = DataFrame({'col': ['a"a', '"bb"']})
        expected = '''\
"","col"
"0","a""a"
"1","""bb"""
'''

        with tm.ensure_clean('test.csv') as path:
            df.to_csv(path, quoting=1, doublequote=True)  # QUOTE_ALL
            with open(path, 'r') as f:
                assert f.read() == expected

        from _csv import Error
        with tm.ensure_clean('test.csv') as path:
            with tm.assert_raises_regex(Error, 'escapechar'):
                df.to_csv(path, doublequote=False)  # no escapechar set

    def test_to_csv_escapechar(self):
        df = DataFrame({'col': ['a"a', '"bb"']})
        expected = '''\
"","col"
"0","a\\"a"
"1","\\"bb\\""
'''

        with tm.ensure_clean('test.csv') as path:  # QUOTE_ALL
            df.to_csv(path, quoting=1, doublequote=False, escapechar='\\')
            with open(path, 'r') as f:
                assert f.read() == expected

        df = DataFrame({'col': ['a,a', ',bb,']})
        expected = """\
,col
0,a\\,a
1,\\,bb\\,
"""

        with tm.ensure_clean('test.csv') as path:
            df.to_csv(path, quoting=3, escapechar='\\')  # QUOTE_NONE
            with open(path, 'r') as f:
                assert f.read() == expected

    def test_csv_to_string(self):
        df = DataFrame({'col': [1, 2]})
        expected = ',col\n0,1\n1,2\n'
        assert df.to_csv() == expected

    def test_to_csv_decimal(self):
        # GH 781
        df = DataFrame({'col1': [1], 'col2': ['a'], 'col3': [10.1]})

        expected_default = ',col1,col2,col3\n0,1,a,10.1\n'
        assert df.to_csv() == expected_default

        expected_european_excel = ';col1;col2;col3\n0;1;a;10,1\n'
        assert df.to_csv(decimal=',', sep=';') == expected_european_excel

        expected_float_format_default = ',col1,col2,col3\n0,1,a,10.10\n'
        assert df.to_csv(float_format='%.2f') == expected_float_format_default

        expected_float_format = ';col1;col2;col3\n0;1;a;10,10\n'
        assert df.to_csv(decimal=',', sep=';',
                         float_format='%.2f') == expected_float_format

        # GH 11553: testing if decimal is taken into account for '0.0'
        df = pd.DataFrame({'a': [0, 1.1], 'b': [2.2, 3.3], 'c': 1})
        expected = 'a,b,c\n0^0,2^2,1\n1^1,3^3,1\n'
        assert df.to_csv(index=False, decimal='^') == expected

        # same but for an index
        assert df.set_index('a').to_csv(decimal='^') == expected

        # same for a multi-index
        assert df.set_index(['a', 'b']).to_csv(decimal="^") == expected

    def test_to_csv_float_format(self):
        # testing if float_format is taken into account for the index
        # GH 11553
        df = pd.DataFrame({'a': [0, 1], 'b': [2.2, 3.3], 'c': 1})
        expected = 'a,b,c\n0,2.20,1\n1,3.30,1\n'
        assert df.set_index('a').to_csv(float_format='%.2f') == expected

        # same for a multi-index
        assert df.set_index(['a', 'b']).to_csv(
            float_format='%.2f') == expected

    def test_to_csv_na_rep(self):
        # testing if NaN values are correctly represented in the index
        # GH 11553
        df = DataFrame({'a': [0, np.NaN], 'b': [0, 1], 'c': [2, 3]})
        expected = "a,b,c\n0.0,0,2\n_,1,3\n"
        assert df.set_index('a').to_csv(na_rep='_') == expected
        assert df.set_index(['a', 'b']).to_csv(na_rep='_') == expected

        # now with an index containing only NaNs
        df = DataFrame({'a': np.NaN, 'b': [0, 1], 'c': [2, 3]})
        expected = "a,b,c\n_,0,2\n_,1,3\n"
        assert df.set_index('a').to_csv(na_rep='_') == expected
        assert df.set_index(['a', 'b']).to_csv(na_rep='_') == expected

        # check if na_rep parameter does not break anything when no NaN
        df = DataFrame({'a': 0, 'b': [0, 1], 'c': [2, 3]})
        expected = "a,b,c\n0,0,2\n0,1,3\n"
        assert df.set_index('a').to_csv(na_rep='_') == expected
        assert df.set_index(['a', 'b']).to_csv(na_rep='_') == expected

    def test_to_csv_date_format(self):
        # GH 10209
        df_sec = DataFrame({'A': pd.date_range('20130101', periods=5, freq='s')
                            })
        df_day = DataFrame({'A': pd.date_range('20130101', periods=5, freq='d')
                            })

        expected_default_sec = (',A\n0,2013-01-01 00:00:00\n1,'
                                '2013-01-01 00:00:01\n2,2013-01-01 00:00:02'
                                '\n3,2013-01-01 00:00:03\n4,'
                                '2013-01-01 00:00:04\n')
        assert df_sec.to_csv() == expected_default_sec

        expected_ymdhms_day = (',A\n0,2013-01-01 00:00:00\n1,'
                               '2013-01-02 00:00:00\n2,2013-01-03 00:00:00'
                               '\n3,2013-01-04 00:00:00\n4,'
                               '2013-01-05 00:00:00\n')
        assert (df_day.to_csv(date_format='%Y-%m-%d %H:%M:%S') ==
                expected_ymdhms_day)

        expected_ymd_sec = (',A\n0,2013-01-01\n1,2013-01-01\n2,'
                            '2013-01-01\n3,2013-01-01\n4,2013-01-01\n')
        assert df_sec.to_csv(date_format='%Y-%m-%d') == expected_ymd_sec

        expected_default_day = (',A\n0,2013-01-01\n1,2013-01-02\n2,'
                                '2013-01-03\n3,2013-01-04\n4,2013-01-05\n')
        assert df_day.to_csv() == expected_default_day
        assert df_day.to_csv(date_format='%Y-%m-%d') == expected_default_day

        # testing if date_format parameter is taken into account for
        # multi-indexed dataframes (GH 7791)
        df_sec['B'] = 0
        df_sec['C'] = 1
        expected_ymd_sec = 'A,B,C\n2013-01-01,0,1\n'
        df_sec_grouped = df_sec.groupby([pd.Grouper(key='A', freq='1h'), 'B'])
        assert (df_sec_grouped.mean().to_csv(date_format='%Y-%m-%d') ==
                expected_ymd_sec)

    def test_to_csv_multi_index(self):
        # see gh-6618
        df = DataFrame([1], columns=pd.MultiIndex.from_arrays([[1], [2]]))

        exp = ",1\n,2\n0,1\n"
        assert df.to_csv() == exp

        exp = "1\n2\n1\n"
        assert df.to_csv(index=False) == exp

        df = DataFrame([1], columns=pd.MultiIndex.from_arrays([[1], [2]]),
                       index=pd.MultiIndex.from_arrays([[1], [2]]))

        exp = ",,1\n,,2\n1,2,1\n"
        assert df.to_csv() == exp

        exp = "1\n2\n1\n"
        assert df.to_csv(index=False) == exp

        df = DataFrame(
            [1], columns=pd.MultiIndex.from_arrays([['foo'], ['bar']]))

        exp = ",foo\n,bar\n0,1\n"
        assert df.to_csv() == exp

        exp = "foo\nbar\n1\n"
        assert df.to_csv(index=False) == exp
