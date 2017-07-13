from __future__ import print_function

import glob
import os
import re
import warnings

try:
    from importlib import import_module
except ImportError:
    import_module = __import__

from distutils.version import LooseVersion

import pytest

import numpy as np
from numpy.random import rand

from pandas import (DataFrame, MultiIndex, read_csv, Timestamp, Index,
                    date_range, Series)
from pandas.compat import (map, zip, StringIO, string_types, BytesIO,
                           is_platform_windows, PY3)
from pandas.io.common import URLError, urlopen, file_path_to_url
from pandas.io.html import read_html
from pandas._libs.parsers import ParserError

import pandas.util.testing as tm
from pandas.util.testing import makeCustomDataframe as mkdf, network


def _have_module(module_name):
    try:
        import_module(module_name)
        return True
    except ImportError:
        return False


def _skip_if_no(module_name):
    if not _have_module(module_name):
        pytest.skip("{0!r} not found".format(module_name))


def _skip_if_none_of(module_names):
    if isinstance(module_names, string_types):
        _skip_if_no(module_names)
        if module_names == 'bs4':
            import bs4
            if bs4.__version__ == LooseVersion('4.2.0'):
                pytest.skip("Bad version of bs4: 4.2.0")
    else:
        not_found = [module_name for module_name in module_names if not
                     _have_module(module_name)]
        if set(not_found) & set(module_names):
            pytest.skip("{0!r} not found".format(not_found))
        if 'bs4' in module_names:
            import bs4
            if bs4.__version__ == LooseVersion('4.2.0'):
                pytest.skip("Bad version of bs4: 4.2.0")


DATA_PATH = tm.get_data_path()


def assert_framelist_equal(list1, list2, *args, **kwargs):
    assert len(list1) == len(list2), ('lists are not of equal size '
                                      'len(list1) == {0}, '
                                      'len(list2) == {1}'.format(len(list1),
                                                                 len(list2)))
    msg = 'not all list elements are DataFrames'
    both_frames = all(map(lambda x, y: isinstance(x, DataFrame) and
                          isinstance(y, DataFrame), list1, list2))
    assert both_frames, msg
    for frame_i, frame_j in zip(list1, list2):
        tm.assert_frame_equal(frame_i, frame_j, *args, **kwargs)
        assert not frame_i.empty, 'frames are both empty'


def test_bs4_version_fails():
    _skip_if_none_of(('bs4', 'html5lib'))
    import bs4
    if bs4.__version__ == LooseVersion('4.2.0'):
        tm.assert_raises(AssertionError, read_html, os.path.join(DATA_PATH,
                                                                 "spam.html"),
                         flavor='bs4')


class ReadHtmlMixin(object):

    def read_html(self, *args, **kwargs):
        kwargs.setdefault('flavor', self.flavor)
        return read_html(*args, **kwargs)


class TestReadHtml(ReadHtmlMixin):
    flavor = 'bs4'
    spam_data = os.path.join(DATA_PATH, 'spam.html')
    spam_data_kwargs = {}
    if PY3:
        spam_data_kwargs['encoding'] = 'UTF-8'
    banklist_data = os.path.join(DATA_PATH, 'banklist.html')

    @classmethod
    def setup_class(cls):
        _skip_if_none_of(('bs4', 'html5lib'))

    def test_to_html_compat(self):
        df = mkdf(4, 3, data_gen_f=lambda *args: rand(), c_idx_names=False,
                  r_idx_names=False).applymap('{0:.3f}'.format).astype(float)
        out = df.to_html()
        res = self.read_html(out, attrs={'class': 'dataframe'}, index_col=0)[0]
        tm.assert_frame_equal(res, df)

    @network
    def test_banklist_url(self):
        url = 'http://www.fdic.gov/bank/individual/failed/banklist.html'
        df1 = self.read_html(url, 'First Federal Bank of Florida',
                             attrs={"id": 'table'})
        df2 = self.read_html(url, 'Metcalf Bank', attrs={'id': 'table'})

        assert_framelist_equal(df1, df2)

    @network
    def test_spam_url(self):
        url = ('http://ndb.nal.usda.gov/ndb/foods/show/1732?fg=&man=&'
               'lfacet=&format=&count=&max=25&offset=&sort=&qlookup=spam')
        df1 = self.read_html(url, '.*Water.*')
        df2 = self.read_html(url, 'Unit')

        assert_framelist_equal(df1, df2)

    @tm.slow
    def test_banklist(self):
        df1 = self.read_html(self.banklist_data, '.*Florida.*',
                             attrs={'id': 'table'})
        df2 = self.read_html(self.banklist_data, 'Metcalf Bank',
                             attrs={'id': 'table'})

        assert_framelist_equal(df1, df2)

    def test_spam_no_types(self):

        # infer_types removed in #10892
        df1 = self.read_html(self.spam_data, '.*Water.*')
        df2 = self.read_html(self.spam_data, 'Unit')
        assert_framelist_equal(df1, df2)

        assert df1[0].iloc[0, 0] == 'Proximates'
        assert df1[0].columns[0] == 'Nutrient'

    def test_spam_with_types(self):
        df1 = self.read_html(self.spam_data, '.*Water.*')
        df2 = self.read_html(self.spam_data, 'Unit')
        assert_framelist_equal(df1, df2)

        assert df1[0].iloc[0, 0] == 'Proximates'
        assert df1[0].columns[0] == 'Nutrient'

    def test_spam_no_match(self):
        dfs = self.read_html(self.spam_data)
        for df in dfs:
            assert isinstance(df, DataFrame)

    def test_banklist_no_match(self):
        dfs = self.read_html(self.banklist_data, attrs={'id': 'table'})
        for df in dfs:
            assert isinstance(df, DataFrame)

    def test_spam_header(self):
        df = self.read_html(self.spam_data, '.*Water.*', header=1)[0]
        assert df.columns[0] == 'Proximates'
        assert not df.empty

    def test_skiprows_int(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=1)
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=1)

        assert_framelist_equal(df1, df2)

    def test_skiprows_xrange(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=range(2))[0]
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=range(2))[0]
        tm.assert_frame_equal(df1, df2)

    def test_skiprows_list(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=[1, 2])
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=[2, 1])

        assert_framelist_equal(df1, df2)

    def test_skiprows_set(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=set([1, 2]))
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=set([2, 1]))

        assert_framelist_equal(df1, df2)

    def test_skiprows_slice(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=1)
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=1)

        assert_framelist_equal(df1, df2)

    def test_skiprows_slice_short(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=slice(2))
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=slice(2))

        assert_framelist_equal(df1, df2)

    def test_skiprows_slice_long(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', skiprows=slice(2, 5))
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=slice(4, 1, -1))

        assert_framelist_equal(df1, df2)

    def test_skiprows_ndarray(self):
        df1 = self.read_html(self.spam_data, '.*Water.*',
                             skiprows=np.arange(2))
        df2 = self.read_html(self.spam_data, 'Unit', skiprows=np.arange(2))

        assert_framelist_equal(df1, df2)

    def test_skiprows_invalid(self):
        with tm.assert_raises_regex(TypeError, 'is not a valid type '
                                    'for skipping rows'):
            self.read_html(self.spam_data, '.*Water.*', skiprows='asdf')

    def test_index(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', index_col=0)
        df2 = self.read_html(self.spam_data, 'Unit', index_col=0)
        assert_framelist_equal(df1, df2)

    def test_header_and_index_no_types(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', header=1,
                             index_col=0)
        df2 = self.read_html(self.spam_data, 'Unit', header=1, index_col=0)
        assert_framelist_equal(df1, df2)

    def test_header_and_index_with_types(self):
        df1 = self.read_html(self.spam_data, '.*Water.*', header=1,
                             index_col=0)
        df2 = self.read_html(self.spam_data, 'Unit', header=1, index_col=0)
        assert_framelist_equal(df1, df2)

    def test_infer_types(self):

        # 10892 infer_types removed
        df1 = self.read_html(self.spam_data, '.*Water.*', index_col=0)
        df2 = self.read_html(self.spam_data, 'Unit', index_col=0)
        assert_framelist_equal(df1, df2)

    def test_string_io(self):
        with open(self.spam_data, **self.spam_data_kwargs) as f:
            data1 = StringIO(f.read())

        with open(self.spam_data, **self.spam_data_kwargs) as f:
            data2 = StringIO(f.read())

        df1 = self.read_html(data1, '.*Water.*')
        df2 = self.read_html(data2, 'Unit')
        assert_framelist_equal(df1, df2)

    def test_string(self):
        with open(self.spam_data, **self.spam_data_kwargs) as f:
            data = f.read()

        df1 = self.read_html(data, '.*Water.*')
        df2 = self.read_html(data, 'Unit')

        assert_framelist_equal(df1, df2)

    def test_file_like(self):
        with open(self.spam_data, **self.spam_data_kwargs) as f:
            df1 = self.read_html(f, '.*Water.*')

        with open(self.spam_data, **self.spam_data_kwargs) as f:
            df2 = self.read_html(f, 'Unit')

        assert_framelist_equal(df1, df2)

    @network
    def test_bad_url_protocol(self):
        with pytest.raises(URLError):
            self.read_html('git://github.com', match='.*Water.*')

    @network
    def test_invalid_url(self):
        try:
            with pytest.raises(URLError):
                self.read_html('http://www.a23950sdfa908sd.com',
                               match='.*Water.*')
        except ValueError as e:
            assert str(e) == 'No tables found'

    @tm.slow
    def test_file_url(self):
        url = self.banklist_data
        dfs = self.read_html(file_path_to_url(url), 'First',
                             attrs={'id': 'table'})
        assert isinstance(dfs, list)
        for df in dfs:
            assert isinstance(df, DataFrame)

    @tm.slow
    def test_invalid_table_attrs(self):
        url = self.banklist_data
        with tm.assert_raises_regex(ValueError, 'No tables found'):
            self.read_html(url, 'First Federal Bank of Florida',
                           attrs={'id': 'tasdfable'})

    def _bank_data(self, *args, **kwargs):
        return self.read_html(self.banklist_data, 'Metcalf',
                              attrs={'id': 'table'}, *args, **kwargs)

    @tm.slow
    def test_multiindex_header(self):
        df = self._bank_data(header=[0, 1])[0]
        assert isinstance(df.columns, MultiIndex)

    @tm.slow
    def test_multiindex_index(self):
        df = self._bank_data(index_col=[0, 1])[0]
        assert isinstance(df.index, MultiIndex)

    @tm.slow
    def test_multiindex_header_index(self):
        df = self._bank_data(header=[0, 1], index_col=[0, 1])[0]
        assert isinstance(df.columns, MultiIndex)
        assert isinstance(df.index, MultiIndex)

    @tm.slow
    def test_multiindex_header_skiprows_tuples(self):
        df = self._bank_data(header=[0, 1], skiprows=1, tupleize_cols=True)[0]
        assert isinstance(df.columns, Index)

    @tm.slow
    def test_multiindex_header_skiprows(self):
        df = self._bank_data(header=[0, 1], skiprows=1)[0]
        assert isinstance(df.columns, MultiIndex)

    @tm.slow
    def test_multiindex_header_index_skiprows(self):
        df = self._bank_data(header=[0, 1], index_col=[0, 1], skiprows=1)[0]
        assert isinstance(df.index, MultiIndex)
        assert isinstance(df.columns, MultiIndex)

    @tm.slow
    def test_regex_idempotency(self):
        url = self.banklist_data
        dfs = self.read_html(file_path_to_url(url),
                             match=re.compile(re.compile('Florida')),
                             attrs={'id': 'table'})
        assert isinstance(dfs, list)
        for df in dfs:
            assert isinstance(df, DataFrame)

    def test_negative_skiprows(self):
        with tm.assert_raises_regex(ValueError,
                                    r'\(you passed a negative value\)'):
            self.read_html(self.spam_data, 'Water', skiprows=-1)

    @network
    def test_multiple_matches(self):
        url = 'https://docs.python.org/2/'
        dfs = self.read_html(url, match='Python')
        assert len(dfs) > 1

    @network
    def test_python_docs_table(self):
        url = 'https://docs.python.org/2/'
        dfs = self.read_html(url, match='Python')
        zz = [df.iloc[0, 0][0:4] for df in dfs]
        assert sorted(zz) == sorted(['Repo', 'What'])

    @tm.slow
    def test_thousands_macau_stats(self):
        all_non_nan_table_index = -2
        macau_data = os.path.join(DATA_PATH, 'macau.html')
        dfs = self.read_html(macau_data, index_col=0,
                             attrs={'class': 'style1'})
        df = dfs[all_non_nan_table_index]

        assert not any(s.isnull().any() for _, s in df.iteritems())

    @tm.slow
    def test_thousands_macau_index_col(self):
        all_non_nan_table_index = -2
        macau_data = os.path.join(DATA_PATH, 'macau.html')
        dfs = self.read_html(macau_data, index_col=0, header=0)
        df = dfs[all_non_nan_table_index]

        assert not any(s.isnull().any() for _, s in df.iteritems())

    def test_empty_tables(self):
        """
        Make sure that read_html ignores empty tables.
        """
        data1 = '''<table>
            <thead>
                <tr>
                    <th>A</th>
                    <th>B</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>2</td>
                </tr>
            </tbody>
        </table>'''
        data2 = data1 + '''<table>
            <tbody>
            </tbody>
        </table>'''
        res1 = self.read_html(StringIO(data1))
        res2 = self.read_html(StringIO(data2))
        assert_framelist_equal(res1, res2)

    def test_header_and_one_column(self):
        """
        Don't fail with bs4 when there is a header and only one column
        as described in issue #9178
        """
        data = StringIO('''<html>
            <body>
             <table>
                <thead>
                    <tr>
                        <th>Header</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>first</td>
                    </tr>
                </tbody>
            </table>
            </body>
        </html>''')
        expected = DataFrame(data={'Header': 'first'}, index=[0])
        result = self.read_html(data)[0]
        tm.assert_frame_equal(result, expected)

    def test_tfoot_read(self):
        """
        Make sure that read_html reads tfoot, containing td or th.
        Ignores empty tfoot
        """
        data_template = '''<table>
            <thead>
                <tr>
                    <th>A</th>
                    <th>B</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>bodyA</td>
                    <td>bodyB</td>
                </tr>
            </tbody>
            <tfoot>
                {footer}
            </tfoot>
        </table>'''

        data1 = data_template.format(footer="")
        data2 = data_template.format(
            footer="<tr><td>footA</td><th>footB</th></tr>")

        d1 = {'A': ['bodyA'], 'B': ['bodyB']}
        d2 = {'A': ['bodyA', 'footA'], 'B': ['bodyB', 'footB']}

        tm.assert_frame_equal(self.read_html(data1)[0], DataFrame(d1))
        tm.assert_frame_equal(self.read_html(data2)[0], DataFrame(d2))

    def test_countries_municipalities(self):
        # GH5048
        data1 = StringIO('''<table>
            <thead>
                <tr>
                    <th>Country</th>
                    <th>Municipality</th>
                    <th>Year</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Ukraine</td>
                    <th>Odessa</th>
                    <td>1944</td>
                </tr>
            </tbody>
        </table>''')
        data2 = StringIO('''
        <table>
            <tbody>
                <tr>
                    <th>Country</th>
                    <th>Municipality</th>
                    <th>Year</th>
                </tr>
                <tr>
                    <td>Ukraine</td>
                    <th>Odessa</th>
                    <td>1944</td>
                </tr>
            </tbody>
        </table>''')
        res1 = self.read_html(data1)
        res2 = self.read_html(data2, header=0)
        assert_framelist_equal(res1, res2)

    def test_nyse_wsj_commas_table(self):
        data = os.path.join(DATA_PATH, 'nyse_wsj.html')
        df = self.read_html(data, index_col=0, header=0,
                            attrs={'class': 'mdcTable'})[0]

        columns = Index(['Issue(Roll over for charts and headlines)',
                         'Volume', 'Price', 'Chg', '% Chg'])
        nrows = 100
        assert df.shape[0] == nrows
        tm.assert_index_equal(df.columns, columns)

    @tm.slow
    def test_banklist_header(self):
        from pandas.io.html import _remove_whitespace

        def try_remove_ws(x):
            try:
                return _remove_whitespace(x)
            except AttributeError:
                return x

        df = self.read_html(self.banklist_data, 'Metcalf',
                            attrs={'id': 'table'})[0]
        ground_truth = read_csv(os.path.join(DATA_PATH, 'banklist.csv'),
                                converters={'Updated Date': Timestamp,
                                            'Closing Date': Timestamp})
        assert df.shape == ground_truth.shape
        old = ['First Vietnamese American BankIn Vietnamese',
               'Westernbank Puerto RicoEn Espanol',
               'R-G Premier Bank of Puerto RicoEn Espanol',
               'EurobankEn Espanol', 'Sanderson State BankEn Espanol',
               'Washington Mutual Bank(Including its subsidiary Washington '
               'Mutual Bank FSB)',
               'Silver State BankEn Espanol',
               'AmTrade International BankEn Espanol',
               'Hamilton Bank, NAEn Espanol',
               'The Citizens Savings BankPioneer Community Bank, Inc.']
        new = ['First Vietnamese American Bank', 'Westernbank Puerto Rico',
               'R-G Premier Bank of Puerto Rico', 'Eurobank',
               'Sanderson State Bank', 'Washington Mutual Bank',
               'Silver State Bank', 'AmTrade International Bank',
               'Hamilton Bank, NA', 'The Citizens Savings Bank']
        dfnew = df.applymap(try_remove_ws).replace(old, new)
        gtnew = ground_truth.applymap(try_remove_ws)
        converted = dfnew._convert(datetime=True, numeric=True)
        date_cols = ['Closing Date', 'Updated Date']
        converted[date_cols] = converted[date_cols]._convert(datetime=True,
                                                             coerce=True)
        tm.assert_frame_equal(converted, gtnew)

    @tm.slow
    def test_gold_canyon(self):
        gc = 'Gold Canyon'
        with open(self.banklist_data, 'r') as f:
            raw_text = f.read()

        assert gc in raw_text
        df = self.read_html(self.banklist_data, 'Gold Canyon',
                            attrs={'id': 'table'})[0]
        assert gc in df.to_string()

    def test_different_number_of_rows(self):
        expected = """<table border="1" class="dataframe">
                        <thead>
                            <tr style="text-align: right;">
                            <th></th>
                            <th>C_l0_g0</th>
                            <th>C_l0_g1</th>
                            <th>C_l0_g2</th>
                            <th>C_l0_g3</th>
                            <th>C_l0_g4</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                            <th>R_l0_g0</th>
                            <td> 0.763</td>
                            <td> 0.233</td>
                            <td> nan</td>
                            <td> nan</td>
                            <td> nan</td>
                            </tr>
                            <tr>
                            <th>R_l0_g1</th>
                            <td> 0.244</td>
                            <td> 0.285</td>
                            <td> 0.392</td>
                            <td> 0.137</td>
                            <td> 0.222</td>
                            </tr>
                        </tbody>
                    </table>"""
        out = """<table border="1" class="dataframe">
                    <thead>
                        <tr style="text-align: right;">
                        <th></th>
                        <th>C_l0_g0</th>
                        <th>C_l0_g1</th>
                        <th>C_l0_g2</th>
                        <th>C_l0_g3</th>
                        <th>C_l0_g4</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                        <th>R_l0_g0</th>
                        <td> 0.763</td>
                        <td> 0.233</td>
                        </tr>
                        <tr>
                        <th>R_l0_g1</th>
                        <td> 0.244</td>
                        <td> 0.285</td>
                        <td> 0.392</td>
                        <td> 0.137</td>
                        <td> 0.222</td>
                        </tr>
                    </tbody>
                 </table>"""
        expected = self.read_html(expected, index_col=0)[0]
        res = self.read_html(out, index_col=0)[0]
        tm.assert_frame_equal(expected, res)

    def test_parse_dates_list(self):
        df = DataFrame({'date': date_range('1/1/2001', periods=10)})
        expected = df.to_html()
        res = self.read_html(expected, parse_dates=[1], index_col=0)
        tm.assert_frame_equal(df, res[0])
        res = self.read_html(expected, parse_dates=['date'], index_col=0)
        tm.assert_frame_equal(df, res[0])

    def test_parse_dates_combine(self):
        raw_dates = Series(date_range('1/1/2001', periods=10))
        df = DataFrame({'date': raw_dates.map(lambda x: str(x.date())),
                        'time': raw_dates.map(lambda x: str(x.time()))})
        res = self.read_html(df.to_html(), parse_dates={'datetime': [1, 2]},
                             index_col=1)
        newdf = DataFrame({'datetime': raw_dates})
        tm.assert_frame_equal(newdf, res[0])

    def test_computer_sales_page(self):
        data = os.path.join(DATA_PATH, 'computer_sales_page.html')
        with tm.assert_raises_regex(ParserError,
                                    r"Passed header=\[0,1\] are "
                                    r"too many rows for this "
                                    r"multi_index of columns"):
            self.read_html(data, header=[0, 1])

    def test_wikipedia_states_table(self):
        data = os.path.join(DATA_PATH, 'wikipedia_states.html')
        assert os.path.isfile(data), '%r is not a file' % data
        assert os.path.getsize(data), '%r is an empty file' % data
        result = self.read_html(data, 'Arizona', header=1)[0]
        assert result['sq mi'].dtype == np.dtype('float64')

    def test_decimal_rows(self):

        # GH 12907
        data = StringIO('''<html>
            <body>
             <table>
                <thead>
                    <tr>
                        <th>Header</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1100#101</td>
                    </tr>
                </tbody>
            </table>
            </body>
        </html>''')
        expected = DataFrame(data={'Header': 1100.101}, index=[0])
        result = self.read_html(data, decimal='#')[0]
        assert result['Header'].dtype == np.dtype('float64')
        tm.assert_frame_equal(result, expected)

    def test_bool_header_arg(self):
        # GH 6114
        for arg in [True, False]:
            with pytest.raises(TypeError):
                read_html(self.spam_data, header=arg)

    def test_converters(self):
        # GH 13461
        html_data = """<table>
                        <thead>
                            <th>a</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                            <td> 0.763</td>
                            </tr>
                            <tr>
                            <td> 0.244</td>
                            </tr>
                        </tbody>
                    </table>"""

        expected_df = DataFrame({'a': ['0.763', '0.244']})
        html_df = read_html(html_data, converters={'a': str})[0]
        tm.assert_frame_equal(expected_df, html_df)

    def test_na_values(self):
        # GH 13461
        html_data = """<table>
                        <thead>
                            <th>a</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                            <td> 0.763</td>
                            </tr>
                            <tr>
                            <td> 0.244</td>
                            </tr>
                        </tbody>
                    </table>"""

        expected_df = DataFrame({'a': [0.763, np.nan]})
        html_df = read_html(html_data, na_values=[0.244])[0]
        tm.assert_frame_equal(expected_df, html_df)

    def test_keep_default_na(self):
        html_data = """<table>
                        <thead>
                            <th>a</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                            <td> N/A</td>
                            </tr>
                            <tr>
                            <td> NA</td>
                            </tr>
                        </tbody>
                    </table>"""

        expected_df = DataFrame({'a': ['N/A', 'NA']})
        html_df = read_html(html_data, keep_default_na=False)[0]
        tm.assert_frame_equal(expected_df, html_df)

        expected_df = DataFrame({'a': [np.nan, np.nan]})
        html_df = read_html(html_data, keep_default_na=True)[0]
        tm.assert_frame_equal(expected_df, html_df)

    def test_multiple_header_rows(self):
        # Issue #13434
        expected_df = DataFrame(data=[("Hillary", 68, "D"),
                                      ("Bernie", 74, "D"),
                                      ("Donald", 69, "R")])
        expected_df.columns = [["Unnamed: 0_level_0", "Age", "Party"],
                               ["Name", "Unnamed: 1_level_1",
                                "Unnamed: 2_level_1"]]
        html = expected_df.to_html(index=False)
        html_df = read_html(html, )[0]
        tm.assert_frame_equal(expected_df, html_df)


def _lang_enc(filename):
    return os.path.splitext(os.path.basename(filename))[0].split('_')


class TestReadHtmlEncoding(object):
    files = glob.glob(os.path.join(DATA_PATH, 'html_encoding', '*.html'))
    flavor = 'bs4'

    @classmethod
    def setup_class(cls):
        _skip_if_none_of((cls.flavor, 'html5lib'))

    def read_html(self, *args, **kwargs):
        kwargs['flavor'] = self.flavor
        return read_html(*args, **kwargs)

    def read_filename(self, f, encoding):
        return self.read_html(f, encoding=encoding, index_col=0)

    def read_file_like(self, f, encoding):
        with open(f, 'rb') as fobj:
            return self.read_html(BytesIO(fobj.read()), encoding=encoding,
                                  index_col=0)

    def read_string(self, f, encoding):
        with open(f, 'rb') as fobj:
            return self.read_html(fobj.read(), encoding=encoding, index_col=0)

    def test_encode(self):
        assert self.files, 'no files read from the data folder'
        for f in self.files:
            _, encoding = _lang_enc(f)
            try:
                from_string = self.read_string(f, encoding).pop()
                from_file_like = self.read_file_like(f, encoding).pop()
                from_filename = self.read_filename(f, encoding).pop()
                tm.assert_frame_equal(from_string, from_file_like)
                tm.assert_frame_equal(from_string, from_filename)
            except Exception:
                # seems utf-16/32 fail on windows
                if is_platform_windows():
                    if '16' in encoding or '32' in encoding:
                        continue
                    raise


class TestReadHtmlEncodingLxml(TestReadHtmlEncoding):
    flavor = 'lxml'

    @classmethod
    def setup_class(cls):
        super(TestReadHtmlEncodingLxml, cls).setup_class()
        _skip_if_no(cls.flavor)


class TestReadHtmlLxml(ReadHtmlMixin):
    flavor = 'lxml'

    @classmethod
    def setup_class(cls):
        _skip_if_no('lxml')

    def test_data_fail(self):
        from lxml.etree import XMLSyntaxError
        spam_data = os.path.join(DATA_PATH, 'spam.html')
        banklist_data = os.path.join(DATA_PATH, 'banklist.html')

        with pytest.raises(XMLSyntaxError):
            self.read_html(spam_data)

        with pytest.raises(XMLSyntaxError):
            self.read_html(banklist_data)

    def test_works_on_valid_markup(self):
        filename = os.path.join(DATA_PATH, 'valid_markup.html')
        dfs = self.read_html(filename, index_col=0)
        assert isinstance(dfs, list)
        assert isinstance(dfs[0], DataFrame)

    @tm.slow
    def test_fallback_success(self):
        _skip_if_none_of(('bs4', 'html5lib'))
        banklist_data = os.path.join(DATA_PATH, 'banklist.html')
        self.read_html(banklist_data, '.*Water.*', flavor=['lxml', 'html5lib'])

    def test_parse_dates_list(self):
        df = DataFrame({'date': date_range('1/1/2001', periods=10)})
        expected = df.to_html()
        res = self.read_html(expected, parse_dates=[1], index_col=0)
        tm.assert_frame_equal(df, res[0])
        res = self.read_html(expected, parse_dates=['date'], index_col=0)
        tm.assert_frame_equal(df, res[0])

    def test_parse_dates_combine(self):
        raw_dates = Series(date_range('1/1/2001', periods=10))
        df = DataFrame({'date': raw_dates.map(lambda x: str(x.date())),
                        'time': raw_dates.map(lambda x: str(x.time()))})
        res = self.read_html(df.to_html(), parse_dates={'datetime': [1, 2]},
                             index_col=1)
        newdf = DataFrame({'datetime': raw_dates})
        tm.assert_frame_equal(newdf, res[0])

    def test_computer_sales_page(self):
        data = os.path.join(DATA_PATH, 'computer_sales_page.html')
        self.read_html(data, header=[0, 1])


def test_invalid_flavor():
    url = 'google.com'
    with pytest.raises(ValueError):
        read_html(url, 'google', flavor='not a* valid**++ flaver')


def get_elements_from_file(url, element='table'):
    _skip_if_none_of(('bs4', 'html5lib'))
    url = file_path_to_url(url)
    from bs4 import BeautifulSoup
    with urlopen(url) as f:
        soup = BeautifulSoup(f, features='html5lib')
    return soup.find_all(element)


@tm.slow
def test_bs4_finds_tables():
    filepath = os.path.join(DATA_PATH, "spam.html")
    with warnings.catch_warnings():
        warnings.filterwarnings('ignore')
        assert get_elements_from_file(filepath, 'table')


def get_lxml_elements(url, element):
    _skip_if_no('lxml')
    from lxml.html import parse
    doc = parse(url)
    return doc.xpath('.//{0}'.format(element))


@tm.slow
def test_lxml_finds_tables():
    filepath = os.path.join(DATA_PATH, "spam.html")
    assert get_lxml_elements(filepath, 'table')


@tm.slow
def test_lxml_finds_tbody():
    filepath = os.path.join(DATA_PATH, "spam.html")
    assert get_lxml_elements(filepath, 'tbody')


def test_same_ordering():
    _skip_if_none_of(['bs4', 'lxml', 'html5lib'])
    filename = os.path.join(DATA_PATH, 'valid_markup.html')
    dfs_lxml = read_html(filename, index_col=0, flavor=['lxml'])
    dfs_bs4 = read_html(filename, index_col=0, flavor=['bs4'])
    assert_framelist_equal(dfs_lxml, dfs_bs4)
