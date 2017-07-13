# pylint: disable=E1101

from pandas.compat import u, range, map, openpyxl_compat, BytesIO, iteritems
from datetime import datetime, date, time
import sys
import os
from distutils.version import LooseVersion

import warnings
from warnings import catch_warnings
import operator
import functools
import pytest

from numpy import nan
import numpy as np

import pandas as pd
from pandas import DataFrame, Index, MultiIndex
from pandas.io.formats.excel import ExcelFormatter
from pandas.io.parsers import read_csv
from pandas.io.excel import (
    ExcelFile, ExcelWriter, read_excel, _XlwtWriter, _Openpyxl1Writer,
    _Openpyxl20Writer, _Openpyxl22Writer, register_writer, _XlsxWriter
)
from pandas.io.common import URLError
from pandas.util.testing import ensure_clean, makeCustomDataframe as mkdf
from pandas.core.config import set_option, get_option
import pandas.util.testing as tm


def _skip_if_no_xlrd():
    try:
        import xlrd
        ver = tuple(map(int, xlrd.__VERSION__.split(".")[:2]))
        if ver < (0, 9):
            pytest.skip('xlrd < 0.9, skipping')
    except ImportError:
        pytest.skip('xlrd not installed, skipping')


def _skip_if_no_xlwt():
    try:
        import xlwt  # NOQA
    except ImportError:
        pytest.skip('xlwt not installed, skipping')


def _skip_if_no_openpyxl():
    try:
        import openpyxl  # NOQA
    except ImportError:
        pytest.skip('openpyxl not installed, skipping')


def _skip_if_no_xlsxwriter():
    try:
        import xlsxwriter  # NOQA
    except ImportError:
        pytest.skip('xlsxwriter not installed, skipping')


def _skip_if_no_excelsuite():
    _skip_if_no_xlrd()
    _skip_if_no_xlwt()
    _skip_if_no_openpyxl()


def _skip_if_no_s3fs():
    try:
        import s3fs  # noqa
    except ImportError:
        pytest.skip('s3fs not installed, skipping')


_seriesd = tm.getSeriesData()
_tsd = tm.getTimeSeriesData()
_frame = DataFrame(_seriesd)[:10]
_frame2 = DataFrame(_seriesd, columns=['D', 'C', 'B', 'A'])[:10]
_tsframe = tm.makeTimeDataFrame()[:5]
_mixed_frame = _frame.copy()
_mixed_frame['foo'] = 'bar'


class SharedItems(object):

    def setup_method(self, method):
        self.dirpath = tm.get_data_path()
        self.frame = _frame.copy()
        self.frame2 = _frame2.copy()
        self.tsframe = _tsframe.copy()
        self.mixed_frame = _mixed_frame.copy()

    def get_csv_refdf(self, basename):
        """
        Obtain the reference data from read_csv with the Python engine.
        Test data path is defined by pandas.util.testing.get_data_path()

        Parameters
        ----------

        basename : str
            File base name, excluding file extension.

        Returns
        -------

        dfref : DataFrame
        """
        pref = os.path.join(self.dirpath, basename + '.csv')
        dfref = read_csv(pref, index_col=0, parse_dates=True, engine='python')
        return dfref

    def get_excelfile(self, basename):
        """
        Return test data ExcelFile instance. Test data path is defined by
        pandas.util.testing.get_data_path()

        Parameters
        ----------

        basename : str
            File base name, excluding file extension.

        Returns
        -------

        excel : io.excel.ExcelFile
        """
        return ExcelFile(os.path.join(self.dirpath, basename + self.ext))

    def get_exceldf(self, basename, *args, **kwds):
        """
        Return test data DataFrame. Test data path is defined by
        pandas.util.testing.get_data_path()

        Parameters
        ----------

        basename : str
            File base name, excluding file extension.

        Returns
        -------

        df : DataFrame
        """
        pth = os.path.join(self.dirpath, basename + self.ext)
        return read_excel(pth, *args, **kwds)


class ReadingTestsBase(SharedItems):
    # This is based on ExcelWriterBase
    #
    # Base class for test cases to run with different Excel readers.
    # To add a reader test, define the following:
    # 1. A check_skip function that skips your tests if your reader isn't
    #    installed.
    # 2. Add a property ext, which is the file extension that your reader
    #    reades from. (needs to start with '.' so it's a valid path)
    # 3. Add a property engine_name, which is the name of the reader class.
    #    For the reader this is not used for anything at the moment.

    def setup_method(self, method):
        self.check_skip()
        super(ReadingTestsBase, self).setup_method(method)

    def test_parse_cols_int(self):

        dfref = self.get_csv_refdf('test1')
        dfref = dfref.reindex(columns=['A', 'B', 'C'])
        df1 = self.get_exceldf('test1', 'Sheet1', index_col=0, parse_cols=3)
        df2 = self.get_exceldf('test1', 'Sheet2', skiprows=[1], index_col=0,
                               parse_cols=3)
        # TODO add index to xls file)
        tm.assert_frame_equal(df1, dfref, check_names=False)
        tm.assert_frame_equal(df2, dfref, check_names=False)

    def test_parse_cols_list(self):

        dfref = self.get_csv_refdf('test1')
        dfref = dfref.reindex(columns=['B', 'C'])
        df1 = self.get_exceldf('test1', 'Sheet1', index_col=0,
                               parse_cols=[0, 2, 3])
        df2 = self.get_exceldf('test1', 'Sheet2', skiprows=[1], index_col=0,
                               parse_cols=[0, 2, 3])
        # TODO add index to xls file)
        tm.assert_frame_equal(df1, dfref, check_names=False)
        tm.assert_frame_equal(df2, dfref, check_names=False)

    def test_parse_cols_str(self):

        dfref = self.get_csv_refdf('test1')

        df1 = dfref.reindex(columns=['A', 'B', 'C'])
        df2 = self.get_exceldf('test1', 'Sheet1', index_col=0,
                               parse_cols='A:D')
        df3 = self.get_exceldf('test1', 'Sheet2', skiprows=[1], index_col=0,
                               parse_cols='A:D')
        # TODO add index to xls, read xls ignores index name ?
        tm.assert_frame_equal(df2, df1, check_names=False)
        tm.assert_frame_equal(df3, df1, check_names=False)

        df1 = dfref.reindex(columns=['B', 'C'])
        df2 = self.get_exceldf('test1', 'Sheet1', index_col=0,
                               parse_cols='A,C,D')
        df3 = self.get_exceldf('test1', 'Sheet2', skiprows=[1], index_col=0,
                               parse_cols='A,C,D')
        # TODO add index to xls file
        tm.assert_frame_equal(df2, df1, check_names=False)
        tm.assert_frame_equal(df3, df1, check_names=False)

        df1 = dfref.reindex(columns=['B', 'C'])
        df2 = self.get_exceldf('test1', 'Sheet1', index_col=0,
                               parse_cols='A,C:D')
        df3 = self.get_exceldf('test1', 'Sheet2', skiprows=[1], index_col=0,
                               parse_cols='A,C:D')
        tm.assert_frame_equal(df2, df1, check_names=False)
        tm.assert_frame_equal(df3, df1, check_names=False)

    def test_excel_stop_iterator(self):

        parsed = self.get_exceldf('test2', 'Sheet1')
        expected = DataFrame([['aaaa', 'bbbbb']], columns=['Test', 'Test1'])
        tm.assert_frame_equal(parsed, expected)

    def test_excel_cell_error_na(self):

        parsed = self.get_exceldf('test3', 'Sheet1')
        expected = DataFrame([[np.nan]], columns=['Test'])
        tm.assert_frame_equal(parsed, expected)

    def test_excel_passes_na(self):

        excel = self.get_excelfile('test4')

        parsed = read_excel(excel, 'Sheet1', keep_default_na=False,
                            na_values=['apple'])
        expected = DataFrame([['NA'], [1], ['NA'], [np.nan], ['rabbit']],
                             columns=['Test'])
        tm.assert_frame_equal(parsed, expected)

        parsed = read_excel(excel, 'Sheet1', keep_default_na=True,
                            na_values=['apple'])
        expected = DataFrame([[np.nan], [1], [np.nan], [np.nan], ['rabbit']],
                             columns=['Test'])
        tm.assert_frame_equal(parsed, expected)

        # 13967
        excel = self.get_excelfile('test5')

        parsed = read_excel(excel, 'Sheet1', keep_default_na=False,
                            na_values=['apple'])
        expected = DataFrame([['1.#QNAN'], [1], ['nan'], [np.nan], ['rabbit']],
                             columns=['Test'])
        tm.assert_frame_equal(parsed, expected)

        parsed = read_excel(excel, 'Sheet1', keep_default_na=True,
                            na_values=['apple'])
        expected = DataFrame([[np.nan], [1], [np.nan], [np.nan], ['rabbit']],
                             columns=['Test'])
        tm.assert_frame_equal(parsed, expected)

    def test_excel_table_sheet_by_index(self):

        excel = self.get_excelfile('test1')
        dfref = self.get_csv_refdf('test1')

        df1 = read_excel(excel, 0, index_col=0)
        df2 = read_excel(excel, 1, skiprows=[1], index_col=0)
        tm.assert_frame_equal(df1, dfref, check_names=False)
        tm.assert_frame_equal(df2, dfref, check_names=False)

        df1 = excel.parse(0, index_col=0)
        df2 = excel.parse(1, skiprows=[1], index_col=0)
        tm.assert_frame_equal(df1, dfref, check_names=False)
        tm.assert_frame_equal(df2, dfref, check_names=False)

        df3 = read_excel(excel, 0, index_col=0, skipfooter=1)
        df4 = read_excel(excel, 0, index_col=0, skip_footer=1)
        tm.assert_frame_equal(df3, df1.iloc[:-1])
        tm.assert_frame_equal(df3, df4)

        df3 = excel.parse(0, index_col=0, skipfooter=1)
        df4 = excel.parse(0, index_col=0, skip_footer=1)
        tm.assert_frame_equal(df3, df1.iloc[:-1])
        tm.assert_frame_equal(df3, df4)

        import xlrd
        with pytest.raises(xlrd.XLRDError):
            read_excel(excel, 'asdf')

    def test_excel_table(self):

        dfref = self.get_csv_refdf('test1')

        df1 = self.get_exceldf('test1', 'Sheet1', index_col=0)
        df2 = self.get_exceldf('test1', 'Sheet2', skiprows=[1], index_col=0)
        # TODO add index to file
        tm.assert_frame_equal(df1, dfref, check_names=False)
        tm.assert_frame_equal(df2, dfref, check_names=False)

        df3 = self.get_exceldf('test1', 'Sheet1', index_col=0,
                               skipfooter=1)
        df4 = self.get_exceldf('test1', 'Sheet1', index_col=0,
                               skip_footer=1)
        tm.assert_frame_equal(df3, df1.iloc[:-1])
        tm.assert_frame_equal(df3, df4)

    def test_reader_special_dtypes(self):

        expected = DataFrame.from_items([
            ("IntCol", [1, 2, -3, 4, 0]),
            ("FloatCol", [1.25, 2.25, 1.83, 1.92, 0.0000000005]),
            ("BoolCol", [True, False, True, True, False]),
            ("StrCol", [1, 2, 3, 4, 5]),
            # GH5394 - this is why convert_float isn't vectorized
            ("Str2Col", ["a", 3, "c", "d", "e"]),
            ("DateCol", [datetime(2013, 10, 30), datetime(2013, 10, 31),
                         datetime(1905, 1, 1), datetime(2013, 12, 14),
                         datetime(2015, 3, 14)])
        ])

        basename = 'test_types'

        # should read in correctly and infer types
        actual = self.get_exceldf(basename, 'Sheet1')
        tm.assert_frame_equal(actual, expected)

        # if not coercing number, then int comes in as float
        float_expected = expected.copy()
        float_expected["IntCol"] = float_expected["IntCol"].astype(float)
        float_expected.loc[float_expected.index[1], "Str2Col"] = 3.0
        actual = self.get_exceldf(basename, 'Sheet1', convert_float=False)
        tm.assert_frame_equal(actual, float_expected)

        # check setting Index (assuming xls and xlsx are the same here)
        for icol, name in enumerate(expected.columns):
            actual = self.get_exceldf(basename, 'Sheet1', index_col=icol)
            exp = expected.set_index(name)
            tm.assert_frame_equal(actual, exp)

        # convert_float and converters should be different but both accepted
        expected["StrCol"] = expected["StrCol"].apply(str)
        actual = self.get_exceldf(
            basename, 'Sheet1', converters={"StrCol": str})
        tm.assert_frame_equal(actual, expected)

        no_convert_float = float_expected.copy()
        no_convert_float["StrCol"] = no_convert_float["StrCol"].apply(str)
        actual = self.get_exceldf(basename, 'Sheet1', convert_float=False,
                                  converters={"StrCol": str})
        tm.assert_frame_equal(actual, no_convert_float)

    # GH8212 - support for converters and missing values
    def test_reader_converters(self):

        basename = 'test_converters'

        expected = DataFrame.from_items([
            ("IntCol", [1, 2, -3, -1000, 0]),
            ("FloatCol", [12.5, np.nan, 18.3, 19.2, 0.000000005]),
            ("BoolCol", ['Found', 'Found', 'Found', 'Not found', 'Found']),
            ("StrCol", ['1', np.nan, '3', '4', '5']),
        ])

        converters = {'IntCol': lambda x: int(x) if x != '' else -1000,
                      'FloatCol': lambda x: 10 * x if x else np.nan,
                      2: lambda x: 'Found' if x != '' else 'Not found',
                      3: lambda x: str(x) if x else '',
                      }

        # should read in correctly and set types of single cells (not array
        # dtypes)
        actual = self.get_exceldf(basename, 'Sheet1', converters=converters)
        tm.assert_frame_equal(actual, expected)

    def test_reader_dtype(self):
        # GH 8212
        basename = 'testdtype'
        actual = self.get_exceldf(basename)

        expected = DataFrame({
            'a': [1, 2, 3, 4],
            'b': [2.5, 3.5, 4.5, 5.5],
            'c': [1, 2, 3, 4],
            'd': [1.0, 2.0, np.nan, 4.0]}).reindex(
                columns=['a', 'b', 'c', 'd'])

        tm.assert_frame_equal(actual, expected)

        actual = self.get_exceldf(basename,
                                  dtype={'a': 'float64',
                                         'b': 'float32',
                                         'c': str})

        expected['a'] = expected['a'].astype('float64')
        expected['b'] = expected['b'].astype('float32')
        expected['c'] = ['001', '002', '003', '004']
        tm.assert_frame_equal(actual, expected)

        with pytest.raises(ValueError):
            actual = self.get_exceldf(basename, dtype={'d': 'int64'})

    def test_reading_all_sheets(self):
        # Test reading all sheetnames by setting sheetname to None,
        # Ensure a dict is returned.
        # See PR #9450
        basename = 'test_multisheet'
        dfs = self.get_exceldf(basename, sheetname=None)
        # ensure this is not alphabetical to test order preservation
        expected_keys = ['Charlie', 'Alpha', 'Beta']
        tm.assert_contains_all(expected_keys, dfs.keys())
        # Issue 9930
        # Ensure sheet order is preserved
        assert expected_keys == list(dfs.keys())

    def test_reading_multiple_specific_sheets(self):
        # Test reading specific sheetnames by specifying a mixed list
        # of integers and strings, and confirm that duplicated sheet
        # references (positions/names) are removed properly.
        # Ensure a dict is returned
        # See PR #9450
        basename = 'test_multisheet'
        # Explicitly request duplicates. Only the set should be returned.
        expected_keys = [2, 'Charlie', 'Charlie']
        dfs = self.get_exceldf(basename, sheetname=expected_keys)
        expected_keys = list(set(expected_keys))
        tm.assert_contains_all(expected_keys, dfs.keys())
        assert len(expected_keys) == len(dfs.keys())

    def test_reading_all_sheets_with_blank(self):
        # Test reading all sheetnames by setting sheetname to None,
        # In the case where some sheets are blank.
        # Issue #11711
        basename = 'blank_with_header'
        dfs = self.get_exceldf(basename, sheetname=None)
        expected_keys = ['Sheet1', 'Sheet2', 'Sheet3']
        tm.assert_contains_all(expected_keys, dfs.keys())

    # GH6403
    def test_read_excel_blank(self):
        actual = self.get_exceldf('blank', 'Sheet1')
        tm.assert_frame_equal(actual, DataFrame())

    def test_read_excel_blank_with_header(self):
        expected = DataFrame(columns=['col_1', 'col_2'])
        actual = self.get_exceldf('blank_with_header', 'Sheet1')
        tm.assert_frame_equal(actual, expected)

    # GH 12292 : error when read one empty column from excel file
    def test_read_one_empty_col_no_header(self):
        _skip_if_no_xlwt()
        _skip_if_no_openpyxl()

        df = pd.DataFrame(
            [["", 1, 100],
             ["", 2, 200],
             ["", 3, 300],
             ["", 4, 400]]
        )
        with ensure_clean(self.ext) as path:
            df.to_excel(path, 'no_header', index=False, header=False)
            actual_header_none = read_excel(
                path,
                'no_header',
                parse_cols=[0],
                header=None
            )

            actual_header_zero = read_excel(
                path,
                'no_header',
                parse_cols=[0],
                header=0
            )
        expected = DataFrame()
        tm.assert_frame_equal(actual_header_none, expected)
        tm.assert_frame_equal(actual_header_zero, expected)

    def test_read_one_empty_col_with_header(self):
        _skip_if_no_xlwt()
        _skip_if_no_openpyxl()

        df = pd.DataFrame(
            [["", 1, 100],
             ["", 2, 200],
             ["", 3, 300],
             ["", 4, 400]]
        )
        with ensure_clean(self.ext) as path:
            df.to_excel(path, 'with_header', index=False, header=True)
            actual_header_none = read_excel(
                path,
                'with_header',
                parse_cols=[0],
                header=None
            )

            actual_header_zero = read_excel(
                path,
                'with_header',
                parse_cols=[0],
                header=0
            )
        expected_header_none = DataFrame(pd.Series([0], dtype='int64'))
        tm.assert_frame_equal(actual_header_none, expected_header_none)
        expected_header_zero = DataFrame(columns=[0], dtype='int64')
        tm.assert_frame_equal(actual_header_zero, expected_header_zero)

    def test_set_column_names_in_parameter(self):
        _skip_if_no_xlwt()
        _skip_if_no_openpyxl()

        # GH 12870 : pass down column names associated with
        # keyword argument names
        refdf = pd.DataFrame([[1, 'foo'], [2, 'bar'],
                              [3, 'baz']], columns=['a', 'b'])

        with ensure_clean(self.ext) as pth:
            with ExcelWriter(pth) as writer:
                refdf.to_excel(writer, 'Data_no_head',
                               header=False, index=False)
                refdf.to_excel(writer, 'Data_with_head', index=False)

            refdf.columns = ['A', 'B']

            with ExcelFile(pth) as reader:
                xlsdf_no_head = read_excel(reader, 'Data_no_head',
                                           header=None, names=['A', 'B'])
                xlsdf_with_head = read_excel(reader, 'Data_with_head',
                                             index_col=None, names=['A', 'B'])

            tm.assert_frame_equal(xlsdf_no_head, refdf)
            tm.assert_frame_equal(xlsdf_with_head, refdf)

    def test_date_conversion_overflow(self):
        # GH 10001 : pandas.ExcelFile ignore parse_dates=False
        expected = pd.DataFrame([[pd.Timestamp('2016-03-12'), 'Marc Johnson'],
                                 [pd.Timestamp('2016-03-16'), 'Jack Black'],
                                 [1e+20, 'Timothy Brown']],
                                columns=['DateColWithBigInt', 'StringCol'])

        result = self.get_exceldf('testdateoverflow')
        tm.assert_frame_equal(result, expected)


class XlrdTests(ReadingTestsBase):
    """
    This is the base class for the xlrd tests, and 3 different file formats
    are supported: xls, xlsx, xlsm
    """

    def test_excel_read_buffer(self):

        pth = os.path.join(self.dirpath, 'test1' + self.ext)
        expected = read_excel(pth, 'Sheet1', index_col=0)
        with open(pth, 'rb') as f:
            actual = read_excel(f, 'Sheet1', index_col=0)
            tm.assert_frame_equal(expected, actual)

        with open(pth, 'rb') as f:
            xls = ExcelFile(f)
            actual = read_excel(xls, 'Sheet1', index_col=0)
            tm.assert_frame_equal(expected, actual)

    def test_read_xlrd_Book(self):
        _skip_if_no_xlwt()

        import xlrd
        df = self.frame
        with ensure_clean('.xls') as pth:
            df.to_excel(pth, "SheetA")
            book = xlrd.open_workbook(pth)

            with ExcelFile(book, engine="xlrd") as xl:
                result = read_excel(xl, "SheetA")
                tm.assert_frame_equal(df, result)

            result = read_excel(book, sheetname="SheetA", engine="xlrd")
            tm.assert_frame_equal(df, result)

    @tm.network
    def test_read_from_http_url(self):
        url = ('https://raw.github.com/pandas-dev/pandas/master/'
               'pandas/tests/io/data/test1' + self.ext)
        url_table = read_excel(url)
        local_table = self.get_exceldf('test1')
        tm.assert_frame_equal(url_table, local_table)

    @tm.network(check_before_test=True)
    def test_read_from_s3_url(self):
        _skip_if_no_s3fs()

        url = ('s3://pandas-test/test1' + self.ext)
        url_table = read_excel(url)
        local_table = self.get_exceldf('test1')
        tm.assert_frame_equal(url_table, local_table)

    @tm.slow
    def test_read_from_file_url(self):

        # FILE
        if sys.version_info[:2] < (2, 6):
            pytest.skip("file:// not supported with Python < 2.6")

        localtable = os.path.join(self.dirpath, 'test1' + self.ext)
        local_table = read_excel(localtable)

        try:
            url_table = read_excel('file://localhost/' + localtable)
        except URLError:
            # fails on some systems
            import platform
            pytest.skip("failing on %s" %
                        ' '.join(platform.uname()).strip())

        tm.assert_frame_equal(url_table, local_table)

    def test_read_from_pathlib_path(self):

        # GH12655
        tm._skip_if_no_pathlib()

        from pathlib import Path

        str_path = os.path.join(self.dirpath, 'test1' + self.ext)
        expected = read_excel(str_path, 'Sheet1', index_col=0)

        path_obj = Path(self.dirpath, 'test1' + self.ext)
        actual = read_excel(path_obj, 'Sheet1', index_col=0)

        tm.assert_frame_equal(expected, actual)

    def test_read_from_py_localpath(self):

        # GH12655
        tm._skip_if_no_localpath()

        from py.path import local as LocalPath

        str_path = os.path.join(self.dirpath, 'test1' + self.ext)
        expected = read_excel(str_path, 'Sheet1', index_col=0)

        abs_dir = os.path.abspath(self.dirpath)
        path_obj = LocalPath(abs_dir).join('test1' + self.ext)
        actual = read_excel(path_obj, 'Sheet1', index_col=0)

        tm.assert_frame_equal(expected, actual)

    def test_reader_closes_file(self):

        pth = os.path.join(self.dirpath, 'test1' + self.ext)
        f = open(pth, 'rb')
        with ExcelFile(f) as xlsx:
            # parses okay
            read_excel(xlsx, 'Sheet1', index_col=0)

        assert f.closed

    def test_creating_and_reading_multiple_sheets(self):
        # Test reading multiple sheets, from a runtime created excel file
        # with multiple sheets.
        # See PR #9450

        _skip_if_no_xlwt()
        _skip_if_no_openpyxl()

        def tdf(sheetname):
            d, i = [11, 22, 33], [1, 2, 3]
            return DataFrame(d, i, columns=[sheetname])

        sheets = ['AAA', 'BBB', 'CCC']

        dfs = [tdf(s) for s in sheets]
        dfs = dict(zip(sheets, dfs))

        with ensure_clean(self.ext) as pth:
            with ExcelWriter(pth) as ew:
                for sheetname, df in iteritems(dfs):
                    df.to_excel(ew, sheetname)
            dfs_returned = read_excel(pth, sheetname=sheets)
            for s in sheets:
                tm.assert_frame_equal(dfs[s], dfs_returned[s])

    def test_reader_seconds(self):
        # Test reading times with and without milliseconds. GH5945.
        import xlrd

        if LooseVersion(xlrd.__VERSION__) >= LooseVersion("0.9.3"):
            # Xlrd >= 0.9.3 can handle Excel milliseconds.
            expected = DataFrame.from_items([("Time",
                                              [time(1, 2, 3),
                                               time(2, 45, 56, 100000),
                                               time(4, 29, 49, 200000),
                                               time(6, 13, 42, 300000),
                                               time(7, 57, 35, 400000),
                                               time(9, 41, 28, 500000),
                                               time(11, 25, 21, 600000),
                                               time(13, 9, 14, 700000),
                                               time(14, 53, 7, 800000),
                                               time(16, 37, 0, 900000),
                                               time(18, 20, 54)])])
        else:
            # Xlrd < 0.9.3 rounds Excel milliseconds.
            expected = DataFrame.from_items([("Time",
                                              [time(1, 2, 3),
                                               time(2, 45, 56),
                                               time(4, 29, 49),
                                               time(6, 13, 42),
                                               time(7, 57, 35),
                                               time(9, 41, 29),
                                               time(11, 25, 22),
                                               time(13, 9, 15),
                                               time(14, 53, 8),
                                               time(16, 37, 1),
                                               time(18, 20, 54)])])

        actual = self.get_exceldf('times_1900', 'Sheet1')
        tm.assert_frame_equal(actual, expected)

        actual = self.get_exceldf('times_1904', 'Sheet1')
        tm.assert_frame_equal(actual, expected)

    def test_read_excel_multiindex(self):
        # GH 4679
        mi = MultiIndex.from_product([['foo', 'bar'], ['a', 'b']])
        mi_file = os.path.join(self.dirpath, 'testmultiindex' + self.ext)

        expected = DataFrame([[1, 2.5, pd.Timestamp('2015-01-01'), True],
                              [2, 3.5, pd.Timestamp('2015-01-02'), False],
                              [3, 4.5, pd.Timestamp('2015-01-03'), False],
                              [4, 5.5, pd.Timestamp('2015-01-04'), True]],
                             columns=mi)

        actual = read_excel(mi_file, 'mi_column', header=[0, 1])
        tm.assert_frame_equal(actual, expected)
        actual = read_excel(mi_file, 'mi_column', header=[0, 1], index_col=0)
        tm.assert_frame_equal(actual, expected)

        expected.columns = ['a', 'b', 'c', 'd']
        expected.index = mi
        actual = read_excel(mi_file, 'mi_index', index_col=[0, 1])
        tm.assert_frame_equal(actual, expected, check_names=False)

        expected.columns = mi
        actual = read_excel(mi_file, 'both', index_col=[0, 1], header=[0, 1])
        tm.assert_frame_equal(actual, expected, check_names=False)

        expected.index = mi.set_names(['ilvl1', 'ilvl2'])
        expected.columns = ['a', 'b', 'c', 'd']
        actual = read_excel(mi_file, 'mi_index_name', index_col=[0, 1])
        tm.assert_frame_equal(actual, expected)

        expected.index = list(range(4))
        expected.columns = mi.set_names(['c1', 'c2'])
        actual = read_excel(mi_file, 'mi_column_name',
                            header=[0, 1], index_col=0)
        tm.assert_frame_equal(actual, expected)

        # Issue #11317
        expected.columns = mi.set_levels(
            [1, 2], level=1).set_names(['c1', 'c2'])
        actual = read_excel(mi_file, 'name_with_int',
                            index_col=0, header=[0, 1])
        tm.assert_frame_equal(actual, expected)

        expected.columns = mi.set_names(['c1', 'c2'])
        expected.index = mi.set_names(['ilvl1', 'ilvl2'])
        actual = read_excel(mi_file, 'both_name',
                            index_col=[0, 1], header=[0, 1])
        tm.assert_frame_equal(actual, expected)

        actual = read_excel(mi_file, 'both_name',
                            index_col=[0, 1], header=[0, 1])
        tm.assert_frame_equal(actual, expected)

        actual = read_excel(mi_file, 'both_name_skiprows', index_col=[0, 1],
                            header=[0, 1], skiprows=2)
        tm.assert_frame_equal(actual, expected)

    def test_read_excel_multiindex_empty_level(self):
        # GH 12453
        _skip_if_no_xlsxwriter()
        with ensure_clean('.xlsx') as path:
            df = DataFrame({
                ('Zero', ''): {0: 0},
                ('One', 'x'): {0: 1},
                ('Two', 'X'): {0: 3},
                ('Two', 'Y'): {0: 7}
            })

            expected = DataFrame({
                ('Zero', 'Unnamed: 3_level_1'): {0: 0},
                ('One', u'x'): {0: 1},
                ('Two', u'X'): {0: 3},
                ('Two', u'Y'): {0: 7}
            })

            df.to_excel(path)
            actual = pd.read_excel(path, header=[0, 1])
            tm.assert_frame_equal(actual, expected)

            df = pd.DataFrame({
                ('Beg', ''): {0: 0},
                ('Middle', 'x'): {0: 1},
                ('Tail', 'X'): {0: 3},
                ('Tail', 'Y'): {0: 7}
            })

            expected = pd.DataFrame({
                ('Beg', 'Unnamed: 0_level_1'): {0: 0},
                ('Middle', u'x'): {0: 1},
                ('Tail', u'X'): {0: 3},
                ('Tail', u'Y'): {0: 7}
            })

            df.to_excel(path)
            actual = pd.read_excel(path, header=[0, 1])
            tm.assert_frame_equal(actual, expected)

    def test_excel_multindex_roundtrip(self):
        # GH 4679
        _skip_if_no_xlsxwriter()
        with ensure_clean('.xlsx') as pth:
            for c_idx_names in [True, False]:
                for r_idx_names in [True, False]:
                    for c_idx_levels in [1, 3]:
                        for r_idx_levels in [1, 3]:
                            # column index name can't be serialized unless
                            # MultiIndex
                            if (c_idx_levels == 1 and c_idx_names):
                                continue

                            # empty name case current read in as unamed levels,
                            # not Nones
                            check_names = True
                            if not r_idx_names and r_idx_levels > 1:
                                check_names = False

                            df = mkdf(5, 5, c_idx_names,
                                      r_idx_names, c_idx_levels,
                                      r_idx_levels)
                            df.to_excel(pth)
                            act = pd.read_excel(
                                pth, index_col=list(range(r_idx_levels)),
                                header=list(range(c_idx_levels)))
                            tm.assert_frame_equal(
                                df, act, check_names=check_names)

                            df.iloc[0, :] = np.nan
                            df.to_excel(pth)
                            act = pd.read_excel(
                                pth, index_col=list(range(r_idx_levels)),
                                header=list(range(c_idx_levels)))
                            tm.assert_frame_equal(
                                df, act, check_names=check_names)

                            df.iloc[-1, :] = np.nan
                            df.to_excel(pth)
                            act = pd.read_excel(
                                pth, index_col=list(range(r_idx_levels)),
                                header=list(range(c_idx_levels)))
                            tm.assert_frame_equal(
                                df, act, check_names=check_names)

    def test_excel_oldindex_format(self):
        # GH 4679
        data = np.array([['R0C0', 'R0C1', 'R0C2', 'R0C3', 'R0C4'],
                         ['R1C0', 'R1C1', 'R1C2', 'R1C3', 'R1C4'],
                         ['R2C0', 'R2C1', 'R2C2', 'R2C3', 'R2C4'],
                         ['R3C0', 'R3C1', 'R3C2', 'R3C3', 'R3C4'],
                         ['R4C0', 'R4C1', 'R4C2', 'R4C3', 'R4C4']])
        columns = ['C_l0_g0', 'C_l0_g1', 'C_l0_g2', 'C_l0_g3', 'C_l0_g4']
        mi = MultiIndex(levels=[['R_l0_g0', 'R_l0_g1', 'R_l0_g2',
                                 'R_l0_g3', 'R_l0_g4'],
                                ['R_l1_g0', 'R_l1_g1', 'R_l1_g2',
                                 'R_l1_g3', 'R_l1_g4']],
                        labels=[[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]],
                        names=['R0', 'R1'])
        si = Index(['R_l0_g0', 'R_l0_g1', 'R_l0_g2',
                    'R_l0_g3', 'R_l0_g4'], name='R0')

        in_file = os.path.join(
            self.dirpath, 'test_index_name_pre17' + self.ext)

        expected = pd.DataFrame(data, index=si, columns=columns)
        with tm.assert_produces_warning(FutureWarning):
            actual = pd.read_excel(
                in_file, 'single_names', has_index_names=True)
        tm.assert_frame_equal(actual, expected)

        expected.index.name = None
        actual = pd.read_excel(in_file, 'single_no_names')
        tm.assert_frame_equal(actual, expected)
        with tm.assert_produces_warning(FutureWarning):
            actual = pd.read_excel(
                in_file, 'single_no_names', has_index_names=False)
        tm.assert_frame_equal(actual, expected)

        expected.index = mi
        with tm.assert_produces_warning(FutureWarning):
            actual = pd.read_excel(
                in_file, 'multi_names', has_index_names=True)
        tm.assert_frame_equal(actual, expected)

        expected.index.names = [None, None]
        actual = pd.read_excel(in_file, 'multi_no_names', index_col=[0, 1])
        tm.assert_frame_equal(actual, expected, check_names=False)
        with tm.assert_produces_warning(FutureWarning):
            actual = pd.read_excel(in_file, 'multi_no_names', index_col=[0, 1],
                                   has_index_names=False)
        tm.assert_frame_equal(actual, expected, check_names=False)

    def test_read_excel_bool_header_arg(self):
        # GH 6114
        for arg in [True, False]:
            with pytest.raises(TypeError):
                pd.read_excel(os.path.join(self.dirpath, 'test1' + self.ext),
                              header=arg)

    def test_read_excel_chunksize(self):
        # GH 8011
        with pytest.raises(NotImplementedError):
            pd.read_excel(os.path.join(self.dirpath, 'test1' + self.ext),
                          chunksize=100)

    def test_read_excel_parse_dates(self):
        # GH 11544, 12051

        df = DataFrame(
            {'col': [1, 2, 3],
             'date_strings': pd.date_range('2012-01-01', periods=3)})
        df2 = df.copy()
        df2['date_strings'] = df2['date_strings'].dt.strftime('%m/%d/%Y')

        with ensure_clean(self.ext) as pth:
            df2.to_excel(pth)

            res = read_excel(pth)
            tm.assert_frame_equal(df2, res)

            # no index_col specified when parse_dates is True
            with tm.assert_produces_warning():
                res = read_excel(pth, parse_dates=True)
                tm.assert_frame_equal(df2, res)

            res = read_excel(pth, parse_dates=['date_strings'], index_col=0)
            tm.assert_frame_equal(df, res)

            dateparser = lambda x: pd.datetime.strptime(x, '%m/%d/%Y')
            res = read_excel(pth, parse_dates=['date_strings'],
                             date_parser=dateparser, index_col=0)
            tm.assert_frame_equal(df, res)

    def test_read_excel_skiprows_list(self):
        # GH 4903
        actual = pd.read_excel(os.path.join(self.dirpath,
                                            'testskiprows' + self.ext),
                               'skiprows_list', skiprows=[0, 2])
        expected = DataFrame([[1, 2.5, pd.Timestamp('2015-01-01'), True],
                              [2, 3.5, pd.Timestamp('2015-01-02'), False],
                              [3, 4.5, pd.Timestamp('2015-01-03'), False],
                              [4, 5.5, pd.Timestamp('2015-01-04'), True]],
                             columns=['a', 'b', 'c', 'd'])
        tm.assert_frame_equal(actual, expected)

        actual = pd.read_excel(os.path.join(self.dirpath,
                                            'testskiprows' + self.ext),
                               'skiprows_list', skiprows=np.array([0, 2]))
        tm.assert_frame_equal(actual, expected)

    def test_read_excel_squeeze(self):
        # GH 12157
        f = os.path.join(self.dirpath, 'test_squeeze' + self.ext)

        actual = pd.read_excel(f, 'two_columns', index_col=0, squeeze=True)
        expected = pd.Series([2, 3, 4], [4, 5, 6], name='b')
        expected.index.name = 'a'
        tm.assert_series_equal(actual, expected)

        actual = pd.read_excel(f, 'two_columns', squeeze=True)
        expected = pd.DataFrame({'a': [4, 5, 6],
                                 'b': [2, 3, 4]})
        tm.assert_frame_equal(actual, expected)

        actual = pd.read_excel(f, 'one_column', squeeze=True)
        expected = pd.Series([1, 2, 3], name='a')
        tm.assert_series_equal(actual, expected)


class XlsReaderTests(XlrdTests):
    ext = '.xls'
    engine_name = 'xlrd'
    check_skip = staticmethod(_skip_if_no_xlrd)


class XlsxReaderTests(XlrdTests):
    ext = '.xlsx'
    engine_name = 'xlrd'
    check_skip = staticmethod(_skip_if_no_xlrd)


class XlsmReaderTests(XlrdTests):
    ext = '.xlsm'
    engine_name = 'xlrd'
    check_skip = staticmethod(_skip_if_no_xlrd)


class ExcelWriterBase(SharedItems):
    # Base class for test cases to run with different Excel writers.
    # To add a writer test, define the following:
    # 1. A check_skip function that skips your tests if your writer isn't
    #    installed.
    # 2. Add a property ext, which is the file extension that your writer
    #    writes to. (needs to start with '.' so it's a valid path)
    # 3. Add a property engine_name, which is the name of the writer class.

    # Test with MultiIndex and Hierarchical Rows as merged cells.
    merge_cells = True

    def setup_method(self, method):
        self.check_skip()
        super(ExcelWriterBase, self).setup_method(method)
        self.option_name = 'io.excel.%s.writer' % self.ext.strip('.')
        self.prev_engine = get_option(self.option_name)
        set_option(self.option_name, self.engine_name)

    def teardown_method(self, method):
        set_option(self.option_name, self.prev_engine)

    def test_excel_sheet_by_name_raise(self):
        _skip_if_no_xlrd()
        import xlrd

        with ensure_clean(self.ext) as pth:
            gt = DataFrame(np.random.randn(10, 2))
            gt.to_excel(pth)
            xl = ExcelFile(pth)
            df = read_excel(xl, 0)
            tm.assert_frame_equal(gt, df)

            with pytest.raises(xlrd.XLRDError):
                read_excel(xl, '0')

    def test_excelwriter_contextmanager(self):
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as pth:
            with ExcelWriter(pth) as writer:
                self.frame.to_excel(writer, 'Data1')
                self.frame2.to_excel(writer, 'Data2')

            with ExcelFile(pth) as reader:
                found_df = read_excel(reader, 'Data1')
                found_df2 = read_excel(reader, 'Data2')
                tm.assert_frame_equal(found_df, self.frame)
                tm.assert_frame_equal(found_df2, self.frame2)

    def test_roundtrip(self):
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            self.frame['A'][:5] = nan

            self.frame.to_excel(path, 'test1')
            self.frame.to_excel(path, 'test1', columns=['A', 'B'])
            self.frame.to_excel(path, 'test1', header=False)
            self.frame.to_excel(path, 'test1', index=False)

            # test roundtrip
            self.frame.to_excel(path, 'test1')
            recons = read_excel(path, 'test1', index_col=0)
            tm.assert_frame_equal(self.frame, recons)

            self.frame.to_excel(path, 'test1', index=False)
            recons = read_excel(path, 'test1', index_col=None)
            recons.index = self.frame.index
            tm.assert_frame_equal(self.frame, recons)

            self.frame.to_excel(path, 'test1', na_rep='NA')
            recons = read_excel(path, 'test1', index_col=0, na_values=['NA'])
            tm.assert_frame_equal(self.frame, recons)

            # GH 3611
            self.frame.to_excel(path, 'test1', na_rep='88')
            recons = read_excel(path, 'test1', index_col=0, na_values=['88'])
            tm.assert_frame_equal(self.frame, recons)

            self.frame.to_excel(path, 'test1', na_rep='88')
            recons = read_excel(path, 'test1', index_col=0,
                                na_values=[88, 88.0])
            tm.assert_frame_equal(self.frame, recons)

            # GH 6573
            self.frame.to_excel(path, 'Sheet1')
            recons = read_excel(path, index_col=0)
            tm.assert_frame_equal(self.frame, recons)

            self.frame.to_excel(path, '0')
            recons = read_excel(path, index_col=0)
            tm.assert_frame_equal(self.frame, recons)

            # GH 8825 Pandas Series should provide to_excel method
            s = self.frame["A"]
            s.to_excel(path)
            recons = read_excel(path, index_col=0)
            tm.assert_frame_equal(s.to_frame(), recons)

    def test_mixed(self):
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            self.mixed_frame.to_excel(path, 'test1')
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1', index_col=0)
            tm.assert_frame_equal(self.mixed_frame, recons)

    def test_tsframe(self):
        _skip_if_no_xlrd()

        df = tm.makeTimeDataFrame()[:5]

        with ensure_clean(self.ext) as path:
            df.to_excel(path, 'test1')
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1')
            tm.assert_frame_equal(df, recons)

    def test_basics_with_nan(self):
        _skip_if_no_xlrd()
        with ensure_clean(self.ext) as path:
            self.frame['A'][:5] = nan
            self.frame.to_excel(path, 'test1')
            self.frame.to_excel(path, 'test1', columns=['A', 'B'])
            self.frame.to_excel(path, 'test1', header=False)
            self.frame.to_excel(path, 'test1', index=False)

    def test_int_types(self):
        _skip_if_no_xlrd()

        for np_type in (np.int8, np.int16, np.int32, np.int64):

            with ensure_clean(self.ext) as path:
                # Test np.int values read come back as int (rather than float
                # which is Excel's format).
                frame = DataFrame(np.random.randint(-10, 10, size=(10, 2)),
                                  dtype=np_type)
                frame.to_excel(path, 'test1')
                reader = ExcelFile(path)
                recons = read_excel(reader, 'test1')
                int_frame = frame.astype(np.int64)
                tm.assert_frame_equal(int_frame, recons)
                recons2 = read_excel(path, 'test1')
                tm.assert_frame_equal(int_frame, recons2)

                # test with convert_float=False comes back as float
                float_frame = frame.astype(float)
                recons = read_excel(path, 'test1', convert_float=False)
                tm.assert_frame_equal(recons, float_frame,
                                      check_index_type=False,
                                      check_column_type=False)

    def test_float_types(self):
        _skip_if_no_xlrd()

        for np_type in (np.float16, np.float32, np.float64):
            with ensure_clean(self.ext) as path:
                # Test np.float values read come back as float.
                frame = DataFrame(np.random.random_sample(10), dtype=np_type)
                frame.to_excel(path, 'test1')
                reader = ExcelFile(path)
                recons = read_excel(reader, 'test1').astype(np_type)
                tm.assert_frame_equal(frame, recons, check_dtype=False)

    def test_bool_types(self):
        _skip_if_no_xlrd()

        for np_type in (np.bool8, np.bool_):
            with ensure_clean(self.ext) as path:
                # Test np.bool values read come back as float.
                frame = (DataFrame([1, 0, True, False], dtype=np_type))
                frame.to_excel(path, 'test1')
                reader = ExcelFile(path)
                recons = read_excel(reader, 'test1').astype(np_type)
                tm.assert_frame_equal(frame, recons)

    def test_inf_roundtrip(self):
        _skip_if_no_xlrd()

        frame = DataFrame([(1, np.inf), (2, 3), (5, -np.inf)])
        with ensure_clean(self.ext) as path:
            frame.to_excel(path, 'test1')
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1')
            tm.assert_frame_equal(frame, recons)

    def test_sheets(self):
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            self.frame['A'][:5] = nan

            self.frame.to_excel(path, 'test1')
            self.frame.to_excel(path, 'test1', columns=['A', 'B'])
            self.frame.to_excel(path, 'test1', header=False)
            self.frame.to_excel(path, 'test1', index=False)

            # Test writing to separate sheets
            writer = ExcelWriter(path)
            self.frame.to_excel(writer, 'test1')
            self.tsframe.to_excel(writer, 'test2')
            writer.save()
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1', index_col=0)
            tm.assert_frame_equal(self.frame, recons)
            recons = read_excel(reader, 'test2', index_col=0)
            tm.assert_frame_equal(self.tsframe, recons)
            assert 2 == len(reader.sheet_names)
            assert 'test1' == reader.sheet_names[0]
            assert 'test2' == reader.sheet_names[1]

    def test_colaliases(self):
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            self.frame['A'][:5] = nan

            self.frame.to_excel(path, 'test1')
            self.frame.to_excel(path, 'test1', columns=['A', 'B'])
            self.frame.to_excel(path, 'test1', header=False)
            self.frame.to_excel(path, 'test1', index=False)

            # column aliases
            col_aliases = Index(['AA', 'X', 'Y', 'Z'])
            self.frame2.to_excel(path, 'test1', header=col_aliases)
            reader = ExcelFile(path)
            rs = read_excel(reader, 'test1', index_col=0)
            xp = self.frame2.copy()
            xp.columns = col_aliases
            tm.assert_frame_equal(xp, rs)

    def test_roundtrip_indexlabels(self):
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:

            self.frame['A'][:5] = nan

            self.frame.to_excel(path, 'test1')
            self.frame.to_excel(path, 'test1', columns=['A', 'B'])
            self.frame.to_excel(path, 'test1', header=False)
            self.frame.to_excel(path, 'test1', index=False)

            # test index_label
            frame = (DataFrame(np.random.randn(10, 2)) >= 0)
            frame.to_excel(path, 'test1',
                           index_label=['test'],
                           merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1',
                                index_col=0,
                                ).astype(np.int64)
            frame.index.names = ['test']
            assert frame.index.names == recons.index.names

            frame = (DataFrame(np.random.randn(10, 2)) >= 0)
            frame.to_excel(path,
                           'test1',
                           index_label=['test', 'dummy', 'dummy2'],
                           merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1',
                                index_col=0,
                                ).astype(np.int64)
            frame.index.names = ['test']
            assert frame.index.names == recons.index.names

            frame = (DataFrame(np.random.randn(10, 2)) >= 0)
            frame.to_excel(path,
                           'test1',
                           index_label='test',
                           merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1',
                                index_col=0,
                                ).astype(np.int64)
            frame.index.names = ['test']
            tm.assert_frame_equal(frame, recons.astype(bool))

        with ensure_clean(self.ext) as path:

            self.frame.to_excel(path,
                                'test1',
                                columns=['A', 'B', 'C', 'D'],
                                index=False, merge_cells=self.merge_cells)
            # take 'A' and 'B' as indexes (same row as cols 'C', 'D')
            df = self.frame.copy()
            df = df.set_index(['A', 'B'])

            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1', index_col=[0, 1])
            tm.assert_frame_equal(df, recons, check_less_precise=True)

    def test_excel_roundtrip_indexname(self):
        _skip_if_no_xlrd()

        df = DataFrame(np.random.randn(10, 4))
        df.index.name = 'foo'

        with ensure_clean(self.ext) as path:
            df.to_excel(path, merge_cells=self.merge_cells)

            xf = ExcelFile(path)
            result = read_excel(xf, xf.sheet_names[0],
                                index_col=0)

            tm.assert_frame_equal(result, df)
            assert result.index.name == 'foo'

    def test_excel_roundtrip_datetime(self):
        _skip_if_no_xlrd()

        # datetime.date, not sure what to test here exactly
        tsf = self.tsframe.copy()
        with ensure_clean(self.ext) as path:

            tsf.index = [x.date() for x in self.tsframe.index]
            tsf.to_excel(path, 'test1', merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1')
            tm.assert_frame_equal(self.tsframe, recons)

    # GH4133 - excel output format strings
    def test_excel_date_datetime_format(self):
        _skip_if_no_xlrd()
        df = DataFrame([[date(2014, 1, 31),
                         date(1999, 9, 24)],
                        [datetime(1998, 5, 26, 23, 33, 4),
                         datetime(2014, 2, 28, 13, 5, 13)]],
                       index=['DATE', 'DATETIME'], columns=['X', 'Y'])
        df_expected = DataFrame([[datetime(2014, 1, 31),
                                  datetime(1999, 9, 24)],
                                 [datetime(1998, 5, 26, 23, 33, 4),
                                  datetime(2014, 2, 28, 13, 5, 13)]],
                                index=['DATE', 'DATETIME'], columns=['X', 'Y'])

        with ensure_clean(self.ext) as filename1:
            with ensure_clean(self.ext) as filename2:
                writer1 = ExcelWriter(filename1)
                writer2 = ExcelWriter(filename2,
                                      date_format='DD.MM.YYYY',
                                      datetime_format='DD.MM.YYYY HH-MM-SS')

                df.to_excel(writer1, 'test1')
                df.to_excel(writer2, 'test1')

                writer1.close()
                writer2.close()

                reader1 = ExcelFile(filename1)
                reader2 = ExcelFile(filename2)

                rs1 = read_excel(reader1, 'test1', index_col=None)
                rs2 = read_excel(reader2, 'test1', index_col=None)

                tm.assert_frame_equal(rs1, rs2)

                # since the reader returns a datetime object for dates, we need
                # to use df_expected to check the result
                tm.assert_frame_equal(rs2, df_expected)

    def test_to_excel_periodindex(self):
        _skip_if_no_xlrd()

        frame = self.tsframe
        xp = frame.resample('M', kind='period').mean()

        with ensure_clean(self.ext) as path:
            xp.to_excel(path, 'sht1')

            reader = ExcelFile(path)
            rs = read_excel(reader, 'sht1', index_col=0)
            tm.assert_frame_equal(xp, rs.to_period('M'))

    def test_to_excel_multiindex(self):
        _skip_if_no_xlrd()

        frame = self.frame
        arrays = np.arange(len(frame.index) * 2).reshape(2, -1)
        new_index = MultiIndex.from_arrays(arrays,
                                           names=['first', 'second'])
        frame.index = new_index

        with ensure_clean(self.ext) as path:
            frame.to_excel(path, 'test1', header=False)
            frame.to_excel(path, 'test1', columns=['A', 'B'])

            # round trip
            frame.to_excel(path, 'test1', merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            df = read_excel(reader, 'test1', index_col=[0, 1])
            tm.assert_frame_equal(frame, df)

    # GH13511
    def test_to_excel_multiindex_nan_label(self):
        _skip_if_no_xlrd()

        frame = pd.DataFrame({'A': [None, 2, 3],
                              'B': [10, 20, 30],
                              'C': np.random.sample(3)})
        frame = frame.set_index(['A', 'B'])

        with ensure_clean(self.ext) as path:
            frame.to_excel(path, merge_cells=self.merge_cells)
            df = read_excel(path, index_col=[0, 1])
            tm.assert_frame_equal(frame, df)

    # Test for Issue 11328. If column indices are integers, make
    # sure they are handled correctly for either setting of
    # merge_cells
    def test_to_excel_multiindex_cols(self):
        _skip_if_no_xlrd()

        frame = self.frame
        arrays = np.arange(len(frame.index) * 2).reshape(2, -1)
        new_index = MultiIndex.from_arrays(arrays,
                                           names=['first', 'second'])
        frame.index = new_index

        new_cols_index = MultiIndex.from_tuples([(40, 1), (40, 2),
                                                 (50, 1), (50, 2)])
        frame.columns = new_cols_index
        header = [0, 1]
        if not self.merge_cells:
            header = 0

        with ensure_clean(self.ext) as path:
            # round trip
            frame.to_excel(path, 'test1', merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            df = read_excel(reader, 'test1', header=header,
                            index_col=[0, 1])
            if not self.merge_cells:
                fm = frame.columns.format(sparsify=False,
                                          adjoin=False, names=False)
                frame.columns = [".".join(map(str, q)) for q in zip(*fm)]
            tm.assert_frame_equal(frame, df)

    def test_to_excel_multiindex_dates(self):
        _skip_if_no_xlrd()

        # try multiindex with dates
        tsframe = self.tsframe.copy()
        new_index = [tsframe.index, np.arange(len(tsframe.index))]
        tsframe.index = MultiIndex.from_arrays(new_index)

        with ensure_clean(self.ext) as path:
            tsframe.index.names = ['time', 'foo']
            tsframe.to_excel(path, 'test1', merge_cells=self.merge_cells)
            reader = ExcelFile(path)
            recons = read_excel(reader, 'test1',
                                index_col=[0, 1])

            tm.assert_frame_equal(tsframe, recons)
            assert recons.index.names == ('time', 'foo')

    def test_to_excel_multiindex_no_write_index(self):
        _skip_if_no_xlrd()

        # Test writing and re-reading a MI witout the index. GH 5616.

        # Initial non-MI frame.
        frame1 = DataFrame({'a': [10, 20], 'b': [30, 40], 'c': [50, 60]})

        # Add a MI.
        frame2 = frame1.copy()
        multi_index = MultiIndex.from_tuples([(70, 80), (90, 100)])
        frame2.index = multi_index

        with ensure_clean(self.ext) as path:

            # Write out to Excel without the index.
            frame2.to_excel(path, 'test1', index=False)

            # Read it back in.
            reader = ExcelFile(path)
            frame3 = read_excel(reader, 'test1')

            # Test that it is the same as the initial frame.
            tm.assert_frame_equal(frame1, frame3)

    def test_to_excel_float_format(self):
        _skip_if_no_xlrd()

        df = DataFrame([[0.123456, 0.234567, 0.567567],
                        [12.32112, 123123.2, 321321.2]],
                       index=['A', 'B'], columns=['X', 'Y', 'Z'])

        with ensure_clean(self.ext) as filename:
            df.to_excel(filename, 'test1', float_format='%.2f')

            reader = ExcelFile(filename)
            rs = read_excel(reader, 'test1', index_col=None)
            xp = DataFrame([[0.12, 0.23, 0.57],
                            [12.32, 123123.20, 321321.20]],
                           index=['A', 'B'], columns=['X', 'Y', 'Z'])
            tm.assert_frame_equal(rs, xp)

    def test_to_excel_output_encoding(self):
        _skip_if_no_xlrd()

        # avoid mixed inferred_type
        df = DataFrame([[u'\u0192', u'\u0193', u'\u0194'],
                        [u'\u0195', u'\u0196', u'\u0197']],
                       index=[u'A\u0192', u'B'],
                       columns=[u'X\u0193', u'Y', u'Z'])

        with ensure_clean('__tmp_to_excel_float_format__.' + self.ext)\
                as filename:
            df.to_excel(filename, sheet_name='TestSheet', encoding='utf8')
            result = read_excel(filename, 'TestSheet', encoding='utf8')
            tm.assert_frame_equal(result, df)

    def test_to_excel_unicode_filename(self):
        _skip_if_no_xlrd()
        with ensure_clean(u('\u0192u.') + self.ext) as filename:
            try:
                f = open(filename, 'wb')
            except UnicodeEncodeError:
                pytest.skip('no unicode file names on this system')
            else:
                f.close()

            df = DataFrame([[0.123456, 0.234567, 0.567567],
                            [12.32112, 123123.2, 321321.2]],
                           index=['A', 'B'], columns=['X', 'Y', 'Z'])

            df.to_excel(filename, 'test1', float_format='%.2f')

            reader = ExcelFile(filename)
            rs = read_excel(reader, 'test1', index_col=None)
            xp = DataFrame([[0.12, 0.23, 0.57],
                            [12.32, 123123.20, 321321.20]],
                           index=['A', 'B'], columns=['X', 'Y', 'Z'])
            tm.assert_frame_equal(rs, xp)

    # def test_to_excel_header_styling_xls(self):

    #     import StringIO
    #     s = StringIO(
    #     """Date,ticker,type,value
    #     2001-01-01,x,close,12.2
    #     2001-01-01,x,open ,12.1
    #     2001-01-01,y,close,12.2
    #     2001-01-01,y,open ,12.1
    #     2001-02-01,x,close,12.2
    #     2001-02-01,x,open ,12.1
    #     2001-02-01,y,close,12.2
    #     2001-02-01,y,open ,12.1
    #     2001-03-01,x,close,12.2
    #     2001-03-01,x,open ,12.1
    #     2001-03-01,y,close,12.2
    #     2001-03-01,y,open ,12.1""")
    #     df = read_csv(s, parse_dates=["Date"])
    #     pdf = df.pivot_table(values="value", rows=["ticker"],
    #                                          cols=["Date", "type"])

    #     try:
    #         import xlwt
    #         import xlrd
    #     except ImportError:
    #         pytest.skip

    #     filename = '__tmp_to_excel_header_styling_xls__.xls'
    #     pdf.to_excel(filename, 'test1')

    #     wbk = xlrd.open_workbook(filename,
    #                              formatting_info=True)
    #     assert ["test1"] == wbk.sheet_names()
    #     ws = wbk.sheet_by_name('test1')
    #     assert [(0, 1, 5, 7), (0, 1, 3, 5), (0, 1, 1, 3)] == ws.merged_cells
    #     for i in range(0, 2):
    #         for j in range(0, 7):
    #             xfx = ws.cell_xf_index(0, 0)
    #             cell_xf = wbk.xf_list[xfx]
    #             font = wbk.font_list
    #             assert 1 == font[cell_xf.font_index].bold
    #             assert 1 == cell_xf.border.top_line_style
    #             assert 1 == cell_xf.border.right_line_style
    #             assert 1 == cell_xf.border.bottom_line_style
    #             assert 1 == cell_xf.border.left_line_style
    #             assert 2 == cell_xf.alignment.hor_align
    #     os.remove(filename)
    # def test_to_excel_header_styling_xlsx(self):
    #     import StringIO
    #     s = StringIO(
    #     """Date,ticker,type,value
    #     2001-01-01,x,close,12.2
    #     2001-01-01,x,open ,12.1
    #     2001-01-01,y,close,12.2
    #     2001-01-01,y,open ,12.1
    #     2001-02-01,x,close,12.2
    #     2001-02-01,x,open ,12.1
    #     2001-02-01,y,close,12.2
    #     2001-02-01,y,open ,12.1
    #     2001-03-01,x,close,12.2
    #     2001-03-01,x,open ,12.1
    #     2001-03-01,y,close,12.2
    #     2001-03-01,y,open ,12.1""")
    #     df = read_csv(s, parse_dates=["Date"])
    #     pdf = df.pivot_table(values="value", rows=["ticker"],
    #                                          cols=["Date", "type"])
    #     try:
    #         import openpyxl
    #         from openpyxl.cell import get_column_letter
    #     except ImportError:
    #         pytest.skip
    #     if openpyxl.__version__ < '1.6.1':
    #         pytest.skip
    #     # test xlsx_styling
    #     filename = '__tmp_to_excel_header_styling_xlsx__.xlsx'
    #     pdf.to_excel(filename, 'test1')
    #     wbk = openpyxl.load_workbook(filename)
    #     assert ["test1"] == wbk.get_sheet_names()
    #     ws = wbk.get_sheet_by_name('test1')
    #     xlsaddrs = ["%s2" % chr(i) for i in range(ord('A'), ord('H'))]
    #     xlsaddrs += ["A%s" % i for i in range(1, 6)]
    #     xlsaddrs += ["B1", "D1", "F1"]
    #     for xlsaddr in xlsaddrs:
    #         cell = ws.cell(xlsaddr)
    #         assert cell.style.font.bold
    #         assert (openpyxl.style.Border.BORDER_THIN ==
    #                 cell.style.borders.top.border_style)
    #         assert (openpyxl.style.Border.BORDER_THIN ==
    #                 cell.style.borders.right.border_style)
    #         assert (openpyxl.style.Border.BORDER_THIN ==
    #                 cell.style.borders.bottom.border_style)
    #         assert (openpyxl.style.Border.BORDER_THIN ==
    #                 cell.style.borders.left.border_style)
    #         assert (openpyxl.style.Alignment.HORIZONTAL_CENTER ==
    #                 cell.style.alignment.horizontal)
    #     mergedcells_addrs = ["C1", "E1", "G1"]
    #     for maddr in mergedcells_addrs:
    #         assert ws.cell(maddr).merged
    #     os.remove(filename)

    def test_excel_010_hemstring(self):
        _skip_if_no_xlrd()

        if self.merge_cells:
            pytest.skip('Skip tests for merged MI format.')

        from pandas.util.testing import makeCustomDataframe as mkdf
        # ensure limited functionality in 0.10
        # override of #2370 until sorted out in 0.11

        def roundtrip(df, header=True, parser_hdr=0, index=True):

            with ensure_clean(self.ext) as path:
                df.to_excel(path, header=header,
                            merge_cells=self.merge_cells, index=index)
                xf = ExcelFile(path)
                res = read_excel(xf, xf.sheet_names[0], header=parser_hdr)
                return res

        nrows = 5
        ncols = 3
        for use_headers in (True, False):
            for i in range(1, 4):  # row multindex upto nlevel=3
                for j in range(1, 4):  # col ""
                    df = mkdf(nrows, ncols, r_idx_nlevels=i, c_idx_nlevels=j)

                    # this if will be removed once multi column excel writing
                    # is implemented for now fixing #9794
                    if j > 1:
                        with pytest.raises(NotImplementedError):
                            res = roundtrip(df, use_headers, index=False)
                    else:
                        res = roundtrip(df, use_headers)

                    if use_headers:
                        assert res.shape == (nrows, ncols + i)
                    else:
                        # first row taken as columns
                        assert res.shape == (nrows - 1, ncols + i)

                    # no nans
                    for r in range(len(res.index)):
                        for c in range(len(res.columns)):
                            assert res.iloc[r, c] is not np.nan

        res = roundtrip(DataFrame([0]))
        assert res.shape == (1, 1)
        assert res.iloc[0, 0] is not np.nan

        res = roundtrip(DataFrame([0]), False, None)
        assert res.shape == (1, 2)
        assert res.iloc[0, 0] is not np.nan

    def test_excel_010_hemstring_raises_NotImplementedError(self):
        # This test was failing only for j>1 and header=False,
        # So I reproduced a simple test.
        _skip_if_no_xlrd()

        if self.merge_cells:
            pytest.skip('Skip tests for merged MI format.')

        from pandas.util.testing import makeCustomDataframe as mkdf
        # ensure limited functionality in 0.10
        # override of #2370 until sorted out in 0.11

        def roundtrip2(df, header=True, parser_hdr=0, index=True):

            with ensure_clean(self.ext) as path:
                df.to_excel(path, header=header,
                            merge_cells=self.merge_cells, index=index)
                xf = ExcelFile(path)
                res = read_excel(xf, xf.sheet_names[0], header=parser_hdr)
                return res

        nrows = 5
        ncols = 3
        j = 2
        i = 1
        df = mkdf(nrows, ncols, r_idx_nlevels=i, c_idx_nlevels=j)
        with pytest.raises(NotImplementedError):
            roundtrip2(df, header=False, index=False)

    def test_duplicated_columns(self):
        # Test for issue #5235
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            write_frame = DataFrame([[1, 2, 3], [1, 2, 3], [1, 2, 3]])
            colnames = ['A', 'B', 'B']

            write_frame.columns = colnames
            write_frame.to_excel(path, 'test1')

            read_frame = read_excel(path, 'test1')
            read_frame.columns = colnames
            tm.assert_frame_equal(write_frame, read_frame)

            # 11007 / #10970
            write_frame = DataFrame([[1, 2, 3, 4], [5, 6, 7, 8]],
                                    columns=['A', 'B', 'A', 'B'])
            write_frame.to_excel(path, 'test1')
            read_frame = read_excel(path, 'test1')
            read_frame.columns = ['A', 'B', 'A', 'B']
            tm.assert_frame_equal(write_frame, read_frame)

            # 10982
            write_frame.to_excel(path, 'test1', index=False, header=False)
            read_frame = read_excel(path, 'test1', header=None)
            write_frame.columns = [0, 1, 2, 3]
            tm.assert_frame_equal(write_frame, read_frame)

    def test_swapped_columns(self):
        # Test for issue #5427.
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            write_frame = DataFrame({'A': [1, 1, 1],
                                     'B': [2, 2, 2]})
            write_frame.to_excel(path, 'test1', columns=['B', 'A'])

            read_frame = read_excel(path, 'test1', header=0)

            tm.assert_series_equal(write_frame['A'], read_frame['A'])
            tm.assert_series_equal(write_frame['B'], read_frame['B'])

    def test_invalid_columns(self):
        # 10982
        _skip_if_no_xlrd()

        with ensure_clean(self.ext) as path:
            write_frame = DataFrame({'A': [1, 1, 1],
                                     'B': [2, 2, 2]})

            write_frame.to_excel(path, 'test1', columns=['B', 'C'])
            expected = write_frame.loc[:, ['B', 'C']]
            read_frame = read_excel(path, 'test1')
            tm.assert_frame_equal(expected, read_frame)

            with pytest.raises(KeyError):
                write_frame.to_excel(path, 'test1', columns=['C', 'D'])

    def test_datetimes(self):

        # Test writing and reading datetimes. For issue #9139. (xref #9185)
        _skip_if_no_xlrd()

        datetimes = [datetime(2013, 1, 13, 1, 2, 3),
                     datetime(2013, 1, 13, 2, 45, 56),
                     datetime(2013, 1, 13, 4, 29, 49),
                     datetime(2013, 1, 13, 6, 13, 42),
                     datetime(2013, 1, 13, 7, 57, 35),
                     datetime(2013, 1, 13, 9, 41, 28),
                     datetime(2013, 1, 13, 11, 25, 21),
                     datetime(2013, 1, 13, 13, 9, 14),
                     datetime(2013, 1, 13, 14, 53, 7),
                     datetime(2013, 1, 13, 16, 37, 0),
                     datetime(2013, 1, 13, 18, 20, 52)]

        with ensure_clean(self.ext) as path:
            write_frame = DataFrame.from_items([('A', datetimes)])
            write_frame.to_excel(path, 'Sheet1')
            read_frame = read_excel(path, 'Sheet1', header=0)

            tm.assert_series_equal(write_frame['A'], read_frame['A'])

    # GH7074
    def test_bytes_io(self):
        _skip_if_no_xlrd()

        bio = BytesIO()
        df = DataFrame(np.random.randn(10, 2))
        # pass engine explicitly as there is no file path to infer from
        writer = ExcelWriter(bio, engine=self.engine_name)
        df.to_excel(writer)
        writer.save()
        bio.seek(0)
        reread_df = read_excel(bio)
        tm.assert_frame_equal(df, reread_df)

    # GH8188
    def test_write_lists_dict(self):
        _skip_if_no_xlrd()

        df = DataFrame({'mixed': ['a', ['b', 'c'], {'d': 'e', 'f': 2}],
                        'numeric': [1, 2, 3.0],
                        'str': ['apple', 'banana', 'cherry']})
        expected = df.copy()
        expected.mixed = expected.mixed.apply(str)
        expected.numeric = expected.numeric.astype('int64')
        with ensure_clean(self.ext) as path:
            df.to_excel(path, 'Sheet1')
            read = read_excel(path, 'Sheet1', header=0)
            tm.assert_frame_equal(read, expected)

    # GH13347
    def test_true_and_false_value_options(self):
        df = pd.DataFrame([['foo', 'bar']], columns=['col1', 'col2'])
        expected = df.replace({'foo': True,
                               'bar': False})
        with ensure_clean(self.ext) as path:
            df.to_excel(path)
            read_frame = read_excel(path, true_values=['foo'],
                                    false_values=['bar'])
            tm.assert_frame_equal(read_frame, expected)

    def test_freeze_panes(self):
        # GH15160
        expected = DataFrame([[1, 2], [3, 4]], columns=['col1', 'col2'])
        with ensure_clean(self.ext) as path:
            expected.to_excel(path, "Sheet1", freeze_panes=(1, 1))
            result = read_excel(path)
            tm.assert_frame_equal(expected, result)

    def test_path_pathlib(self):
        df = tm.makeDataFrame()
        result = tm.round_trip_pathlib(df.to_excel, pd.read_excel)
        tm.assert_frame_equal(df, result)

    def test_path_localpath(self):
        df = tm.makeDataFrame()
        result = tm.round_trip_localpath(df.to_excel, pd.read_excel)
        tm.assert_frame_equal(df, result)


def raise_wrapper(major_ver):
    def versioned_raise_wrapper(orig_method):
        @functools.wraps(orig_method)
        def wrapped(self, *args, **kwargs):
            _skip_if_no_openpyxl()
            if openpyxl_compat.is_compat(major_ver=major_ver):
                orig_method(self, *args, **kwargs)
            else:
                msg = (r'Installed openpyxl is not supported at this '
                       r'time\. Use.+')
                with tm.assert_raises_regex(ValueError, msg):
                    orig_method(self, *args, **kwargs)
        return wrapped
    return versioned_raise_wrapper


def raise_on_incompat_version(major_ver):
    def versioned_raise_on_incompat_version(cls):
        methods = filter(operator.methodcaller(
            'startswith', 'test_'), dir(cls))
        for method in methods:
            setattr(cls, method, raise_wrapper(
                major_ver)(getattr(cls, method)))
        return cls
    return versioned_raise_on_incompat_version


@raise_on_incompat_version(1)
class OpenpyxlTests(ExcelWriterBase):
    ext = '.xlsx'
    engine_name = 'openpyxl1'
    check_skip = staticmethod(lambda *args, **kwargs: None)

    def test_to_excel_styleconverter(self):
        _skip_if_no_openpyxl()
        if not openpyxl_compat.is_compat(major_ver=1):
            pytest.skip('incompatible openpyxl version')

        import openpyxl

        hstyle = {"font": {"bold": True},
                  "borders": {"top": "thin",
                              "right": "thin",
                              "bottom": "thin",
                              "left": "thin"},
                  "alignment": {"horizontal": "center", "vertical": "top"}}

        xlsx_style = _Openpyxl1Writer._convert_to_style(hstyle)
        assert xlsx_style.font.bold
        assert (openpyxl.style.Border.BORDER_THIN ==
                xlsx_style.borders.top.border_style)
        assert (openpyxl.style.Border.BORDER_THIN ==
                xlsx_style.borders.right.border_style)
        assert (openpyxl.style.Border.BORDER_THIN ==
                xlsx_style.borders.bottom.border_style)
        assert (openpyxl.style.Border.BORDER_THIN ==
                xlsx_style.borders.left.border_style)
        assert (openpyxl.style.Alignment.HORIZONTAL_CENTER ==
                xlsx_style.alignment.horizontal)
        assert (openpyxl.style.Alignment.VERTICAL_TOP ==
                xlsx_style.alignment.vertical)


def skip_openpyxl_gt21(cls):
    """Skip test case if openpyxl >= 2.2"""

    @classmethod
    def setup_class(cls):
        _skip_if_no_openpyxl()
        import openpyxl
        ver = openpyxl.__version__
        if (not (LooseVersion(ver) >= LooseVersion('2.0.0') and
                 LooseVersion(ver) < LooseVersion('2.2.0'))):
            pytest.skip("openpyxl %s >= 2.2" % str(ver))

    cls.setup_class = setup_class
    return cls


@raise_on_incompat_version(2)
@skip_openpyxl_gt21
class Openpyxl20Tests(ExcelWriterBase):
    ext = '.xlsx'
    engine_name = 'openpyxl20'
    check_skip = staticmethod(lambda *args, **kwargs: None)

    def test_to_excel_styleconverter(self):
        import openpyxl
        from openpyxl import styles

        hstyle = {
            "font": {
                "color": '00FF0000',
                "bold": True,
            },
            "borders": {
                "top": "thin",
                "right": "thin",
                "bottom": "thin",
                "left": "thin",
            },
            "alignment": {
                "horizontal": "center",
                "vertical": "top",
            },
            "fill": {
                "patternType": 'solid',
                'fgColor': {
                    'rgb': '006666FF',
                    'tint': 0.3,
                },
            },
            "number_format": {
                "format_code": "0.00"
            },
            "protection": {
                "locked": True,
                "hidden": False,
            },
        }

        font_color = styles.Color('00FF0000')
        font = styles.Font(bold=True, color=font_color)
        side = styles.Side(style=styles.borders.BORDER_THIN)
        border = styles.Border(top=side, right=side, bottom=side, left=side)
        alignment = styles.Alignment(horizontal='center', vertical='top')
        fill_color = styles.Color(rgb='006666FF', tint=0.3)
        fill = styles.PatternFill(patternType='solid', fgColor=fill_color)

        # ahh openpyxl API changes
        ver = openpyxl.__version__
        if ver >= LooseVersion('2.0.0') and ver < LooseVersion('2.1.0'):
            number_format = styles.NumberFormat(format_code='0.00')
        else:
            number_format = '0.00'  # XXX: Only works with openpyxl-2.1.0

        protection = styles.Protection(locked=True, hidden=False)

        kw = _Openpyxl20Writer._convert_to_style_kwargs(hstyle)
        assert kw['font'] == font
        assert kw['border'] == border
        assert kw['alignment'] == alignment
        assert kw['fill'] == fill
        assert kw['number_format'] == number_format
        assert kw['protection'] == protection

    def test_write_cells_merge_styled(self):
        from pandas.io.formats.excel import ExcelCell
        from openpyxl import styles

        sheet_name = 'merge_styled'

        sty_b1 = {'font': {'color': '00FF0000'}}
        sty_a2 = {'font': {'color': '0000FF00'}}

        initial_cells = [
            ExcelCell(col=1, row=0, val=42, style=sty_b1),
            ExcelCell(col=0, row=1, val=99, style=sty_a2),
        ]

        sty_merged = {'font': {'color': '000000FF', 'bold': True}}
        sty_kwargs = _Openpyxl20Writer._convert_to_style_kwargs(sty_merged)
        openpyxl_sty_merged = styles.Style(**sty_kwargs)
        merge_cells = [
            ExcelCell(col=0, row=0, val='pandas',
                      mergestart=1, mergeend=1, style=sty_merged),
        ]

        with ensure_clean('.xlsx') as path:
            writer = _Openpyxl20Writer(path)
            writer.write_cells(initial_cells, sheet_name=sheet_name)
            writer.write_cells(merge_cells, sheet_name=sheet_name)

            wks = writer.sheets[sheet_name]
            xcell_b1 = wks['B1']
            xcell_a2 = wks['A2']
            assert xcell_b1.style == openpyxl_sty_merged
            assert xcell_a2.style == openpyxl_sty_merged


def skip_openpyxl_lt22(cls):
    """Skip test case if openpyxl < 2.2"""

    @classmethod
    def setup_class(cls):
        _skip_if_no_openpyxl()
        import openpyxl
        ver = openpyxl.__version__
        if LooseVersion(ver) < LooseVersion('2.2.0'):
            pytest.skip("openpyxl %s < 2.2" % str(ver))

    cls.setup_class = setup_class
    return cls


@raise_on_incompat_version(2)
@skip_openpyxl_lt22
class Openpyxl22Tests(ExcelWriterBase):
    ext = '.xlsx'
    engine_name = 'openpyxl22'
    check_skip = staticmethod(lambda *args, **kwargs: None)

    def test_to_excel_styleconverter(self):
        from openpyxl import styles

        hstyle = {
            "font": {
                "color": '00FF0000',
                "bold": True,
            },
            "borders": {
                "top": "thin",
                "right": "thin",
                "bottom": "thin",
                "left": "thin",
            },
            "alignment": {
                "horizontal": "center",
                "vertical": "top",
            },
            "fill": {
                "patternType": 'solid',
                'fgColor': {
                    'rgb': '006666FF',
                    'tint': 0.3,
                },
            },
            "number_format": {
                "format_code": "0.00"
            },
            "protection": {
                "locked": True,
                "hidden": False,
            },
        }

        font_color = styles.Color('00FF0000')
        font = styles.Font(bold=True, color=font_color)
        side = styles.Side(style=styles.borders.BORDER_THIN)
        border = styles.Border(top=side, right=side, bottom=side, left=side)
        alignment = styles.Alignment(horizontal='center', vertical='top')
        fill_color = styles.Color(rgb='006666FF', tint=0.3)
        fill = styles.PatternFill(patternType='solid', fgColor=fill_color)

        number_format = '0.00'

        protection = styles.Protection(locked=True, hidden=False)

        kw = _Openpyxl22Writer._convert_to_style_kwargs(hstyle)
        assert kw['font'] == font
        assert kw['border'] == border
        assert kw['alignment'] == alignment
        assert kw['fill'] == fill
        assert kw['number_format'] == number_format
        assert kw['protection'] == protection

    def test_write_cells_merge_styled(self):
        if not openpyxl_compat.is_compat(major_ver=2):
            pytest.skip('incompatible openpyxl version')

        from pandas.io.formats.excel import ExcelCell

        sheet_name = 'merge_styled'

        sty_b1 = {'font': {'color': '00FF0000'}}
        sty_a2 = {'font': {'color': '0000FF00'}}

        initial_cells = [
            ExcelCell(col=1, row=0, val=42, style=sty_b1),
            ExcelCell(col=0, row=1, val=99, style=sty_a2),
        ]

        sty_merged = {'font': {'color': '000000FF', 'bold': True}}
        sty_kwargs = _Openpyxl22Writer._convert_to_style_kwargs(sty_merged)
        openpyxl_sty_merged = sty_kwargs['font']
        merge_cells = [
            ExcelCell(col=0, row=0, val='pandas',
                      mergestart=1, mergeend=1, style=sty_merged),
        ]

        with ensure_clean('.xlsx') as path:
            writer = _Openpyxl22Writer(path)
            writer.write_cells(initial_cells, sheet_name=sheet_name)
            writer.write_cells(merge_cells, sheet_name=sheet_name)

            wks = writer.sheets[sheet_name]
            xcell_b1 = wks['B1']
            xcell_a2 = wks['A2']
            assert xcell_b1.font == openpyxl_sty_merged
            assert xcell_a2.font == openpyxl_sty_merged


class XlwtTests(ExcelWriterBase):
    ext = '.xls'
    engine_name = 'xlwt'
    check_skip = staticmethod(_skip_if_no_xlwt)

    def test_excel_raise_error_on_multiindex_columns_and_no_index(self):
        _skip_if_no_xlwt()
        # MultiIndex as columns is not yet implemented 9794
        cols = MultiIndex.from_tuples([('site', ''),
                                       ('2014', 'height'),
                                       ('2014', 'weight')])
        df = DataFrame(np.random.randn(10, 3), columns=cols)
        with pytest.raises(NotImplementedError):
            with ensure_clean(self.ext) as path:
                df.to_excel(path, index=False)

    def test_excel_multiindex_columns_and_index_true(self):
        _skip_if_no_xlwt()
        cols = MultiIndex.from_tuples([('site', ''),
                                       ('2014', 'height'),
                                       ('2014', 'weight')])
        df = pd.DataFrame(np.random.randn(10, 3), columns=cols)
        with ensure_clean(self.ext) as path:
            df.to_excel(path, index=True)

    def test_excel_multiindex_index(self):
        _skip_if_no_xlwt()
        # MultiIndex as index works so assert no error #9794
        cols = MultiIndex.from_tuples([('site', ''),
                                       ('2014', 'height'),
                                       ('2014', 'weight')])
        df = DataFrame(np.random.randn(3, 10), index=cols)
        with ensure_clean(self.ext) as path:
            df.to_excel(path, index=False)

    def test_to_excel_styleconverter(self):
        _skip_if_no_xlwt()

        import xlwt

        hstyle = {"font": {"bold": True},
                  "borders": {"top": "thin",
                              "right": "thin",
                              "bottom": "thin",
                              "left": "thin"},
                  "alignment": {"horizontal": "center", "vertical": "top"}}

        xls_style = _XlwtWriter._convert_to_style(hstyle)
        assert xls_style.font.bold
        assert xlwt.Borders.THIN == xls_style.borders.top
        assert xlwt.Borders.THIN == xls_style.borders.right
        assert xlwt.Borders.THIN == xls_style.borders.bottom
        assert xlwt.Borders.THIN == xls_style.borders.left
        assert xlwt.Alignment.HORZ_CENTER == xls_style.alignment.horz
        assert xlwt.Alignment.VERT_TOP == xls_style.alignment.vert


class XlsxWriterTests(ExcelWriterBase):
    ext = '.xlsx'
    engine_name = 'xlsxwriter'
    check_skip = staticmethod(_skip_if_no_xlsxwriter)

    def test_column_format(self):
        # Test that column formats are applied to cells. Test for issue #9167.
        # Applicable to xlsxwriter only.
        _skip_if_no_xlsxwriter()

        with warnings.catch_warnings():
            # Ignore the openpyxl lxml warning.
            warnings.simplefilter("ignore")
            _skip_if_no_openpyxl()
            import openpyxl

        with ensure_clean(self.ext) as path:
            frame = DataFrame({'A': [123456, 123456],
                               'B': [123456, 123456]})

            writer = ExcelWriter(path)
            frame.to_excel(writer)

            # Add a number format to col B and ensure it is applied to cells.
            num_format = '#,##0'
            write_workbook = writer.book
            write_worksheet = write_workbook.worksheets()[0]
            col_format = write_workbook.add_format({'num_format': num_format})
            write_worksheet.set_column('B:B', None, col_format)
            writer.save()

            read_workbook = openpyxl.load_workbook(path)
            try:
                read_worksheet = read_workbook['Sheet1']
            except TypeError:
                # compat
                read_worksheet = read_workbook.get_sheet_by_name(name='Sheet1')

            # Get the number format from the cell.
            try:
                cell = read_worksheet['B2']
            except TypeError:
                # compat
                cell = read_worksheet.cell('B2')

            try:
                read_num_format = cell.number_format
            except:
                read_num_format = cell.style.number_format._format_code

            assert read_num_format == num_format


class OpenpyxlTests_NoMerge(ExcelWriterBase):
    ext = '.xlsx'
    engine_name = 'openpyxl'
    check_skip = staticmethod(_skip_if_no_openpyxl)

    # Test < 0.13 non-merge behaviour for MultiIndex and Hierarchical Rows.
    merge_cells = False


class XlwtTests_NoMerge(ExcelWriterBase):
    ext = '.xls'
    engine_name = 'xlwt'
    check_skip = staticmethod(_skip_if_no_xlwt)

    # Test < 0.13 non-merge behaviour for MultiIndex and Hierarchical Rows.
    merge_cells = False


class XlsxWriterTests_NoMerge(ExcelWriterBase):
    ext = '.xlsx'
    engine_name = 'xlsxwriter'
    check_skip = staticmethod(_skip_if_no_xlsxwriter)

    # Test < 0.13 non-merge behaviour for MultiIndex and Hierarchical Rows.
    merge_cells = False


class ExcelWriterEngineTests(object):

    def test_ExcelWriter_dispatch(self):
        with tm.assert_raises_regex(ValueError, 'No engine'):
            ExcelWriter('nothing')

        try:
            import xlsxwriter  # noqa
            writer_klass = _XlsxWriter
        except ImportError:
            _skip_if_no_openpyxl()
            if not openpyxl_compat.is_compat(major_ver=1):
                pytest.skip('incompatible openpyxl version')
            writer_klass = _Openpyxl1Writer

        with ensure_clean('.xlsx') as path:
            writer = ExcelWriter(path)
            assert isinstance(writer, writer_klass)

        _skip_if_no_xlwt()
        with ensure_clean('.xls') as path:
            writer = ExcelWriter(path)
            assert isinstance(writer, _XlwtWriter)

    def test_register_writer(self):
        # some awkward mocking to test out dispatch and such actually works
        called_save = []
        called_write_cells = []

        class DummyClass(ExcelWriter):
            called_save = False
            called_write_cells = False
            supported_extensions = ['test', 'xlsx', 'xls']
            engine = 'dummy'

            def save(self):
                called_save.append(True)

            def write_cells(self, *args, **kwargs):
                called_write_cells.append(True)

        def check_called(func):
            func()
            assert len(called_save) >= 1
            assert len(called_write_cells) >= 1
            del called_save[:]
            del called_write_cells[:]

        with pd.option_context('io.excel.xlsx.writer', 'dummy'):
            register_writer(DummyClass)
            writer = ExcelWriter('something.test')
            assert isinstance(writer, DummyClass)
            df = tm.makeCustomDataframe(1, 1)

            with catch_warnings(record=True):
                panel = tm.makePanel()
                func = lambda: df.to_excel('something.test')
                check_called(func)
                check_called(lambda: panel.to_excel('something.test'))
                check_called(lambda: df.to_excel('something.xlsx'))
                check_called(
                    lambda: df.to_excel(
                        'something.xls', engine='dummy'))


@pytest.mark.parametrize('engine', [
    pytest.mark.xfail('xlwt', reason='xlwt does not support '
                                     'openpyxl-compatible style dicts'),
    'xlsxwriter',
    'openpyxl',
])
def test_styler_to_excel(engine):
    def style(df):
        # XXX: RGB colors not supported in xlwt
        return DataFrame([['font-weight: bold', '', ''],
                          ['', 'color: blue', ''],
                          ['', '', 'text-decoration: underline'],
                          ['border-style: solid', '', ''],
                          ['', 'font-style: italic', ''],
                          ['', '', 'text-align: right'],
                          ['background-color: red', '', ''],
                          ['', '', ''],
                          ['', '', ''],
                          ['', '', '']],
                         index=df.index, columns=df.columns)

    def assert_equal_style(cell1, cell2):
        # XXX: should find a better way to check equality
        assert cell1.alignment.__dict__ == cell2.alignment.__dict__
        assert cell1.border.__dict__ == cell2.border.__dict__
        assert cell1.fill.__dict__ == cell2.fill.__dict__
        assert cell1.font.__dict__ == cell2.font.__dict__
        assert cell1.number_format == cell2.number_format
        assert cell1.protection.__dict__ == cell2.protection.__dict__

    def custom_converter(css):
        # use bold iff there is custom style attached to the cell
        if css.strip(' \n;'):
            return {'font': {'bold': True}}
        return {}

    pytest.importorskip('jinja2')
    pytest.importorskip(engine)

    if engine == 'openpyxl' and openpyxl_compat.is_compat(major_ver=1):
        pytest.xfail('openpyxl1 does not support some openpyxl2-compatible '
                     'style dicts')

    # Prepare spreadsheets

    df = DataFrame(np.random.randn(10, 3))
    with ensure_clean('.xlsx' if engine != 'xlwt' else '.xls') as path:
        writer = ExcelWriter(path, engine=engine)
        df.to_excel(writer, sheet_name='frame')
        df.style.to_excel(writer, sheet_name='unstyled')
        styled = df.style.apply(style, axis=None)
        styled.to_excel(writer, sheet_name='styled')
        ExcelFormatter(styled, style_converter=custom_converter).write(
            writer, sheet_name='custom')

    # For engines other than openpyxl 2, we only smoke test
    if engine != 'openpyxl':
        return
    if not openpyxl_compat.is_compat(major_ver=2):
        pytest.skip('incompatible openpyxl version')

    # (1) compare DataFrame.to_excel and Styler.to_excel when unstyled
    n_cells = 0
    for col1, col2 in zip(writer.sheets['frame'].columns,
                          writer.sheets['unstyled'].columns):
        assert len(col1) == len(col2)
        for cell1, cell2 in zip(col1, col2):
            assert cell1.value == cell2.value
            assert_equal_style(cell1, cell2)
            n_cells += 1

    # ensure iteration actually happened:
    assert n_cells == (10 + 1) * (3 + 1)

    # (2) check styling with default converter
    n_cells = 0
    for col1, col2 in zip(writer.sheets['frame'].columns,
                          writer.sheets['styled'].columns):
        assert len(col1) == len(col2)
        for cell1, cell2 in zip(col1, col2):
            ref = '%s%d' % (cell2.column, cell2.row)
            # XXX: this isn't as strong a test as ideal; we should
            #      differences are exclusive
            if ref == 'B2':
                assert not cell1.font.bold
                assert cell2.font.bold
            elif ref == 'C3':
                assert cell1.font.color.rgb != cell2.font.color.rgb
                assert cell2.font.color.rgb == '000000FF'
            elif ref == 'D4':
                assert cell1.font.underline != cell2.font.underline
                assert cell2.font.underline == 'single'
            elif ref == 'B5':
                assert not cell1.border.left.style
                assert (cell2.border.top.style ==
                        cell2.border.right.style ==
                        cell2.border.bottom.style ==
                        cell2.border.left.style ==
                        'medium')
            elif ref == 'C6':
                assert not cell1.font.italic
                assert cell2.font.italic
            elif ref == 'D7':
                assert (cell1.alignment.horizontal !=
                        cell2.alignment.horizontal)
                assert cell2.alignment.horizontal == 'right'
            elif ref == 'B8':
                assert cell1.fill.fgColor.rgb != cell2.fill.fgColor.rgb
                assert cell1.fill.patternType != cell2.fill.patternType
                assert cell2.fill.fgColor.rgb == '00FF0000'
                assert cell2.fill.patternType == 'solid'
            else:
                assert_equal_style(cell1, cell2)

            assert cell1.value == cell2.value
            n_cells += 1

    assert n_cells == (10 + 1) * (3 + 1)

    # (3) check styling with custom converter
    n_cells = 0
    for col1, col2 in zip(writer.sheets['frame'].columns,
                          writer.sheets['custom'].columns):
        assert len(col1) == len(col2)
        for cell1, cell2 in zip(col1, col2):
            ref = '%s%d' % (cell2.column, cell2.row)
            if ref in ('B2', 'C3', 'D4', 'B5', 'C6', 'D7', 'B8'):
                assert not cell1.font.bold
                assert cell2.font.bold
            else:
                assert_equal_style(cell1, cell2)

            assert cell1.value == cell2.value
            n_cells += 1

    assert n_cells == (10 + 1) * (3 + 1)
