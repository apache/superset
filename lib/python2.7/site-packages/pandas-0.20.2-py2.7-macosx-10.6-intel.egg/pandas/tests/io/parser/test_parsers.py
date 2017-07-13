# -*- coding: utf-8 -*-

import os

import pandas.util.testing as tm

from pandas import read_csv, read_table
from pandas.core.common import AbstractMethodError

from .common import ParserTests
from .header import HeaderTests
from .comment import CommentTests
from .dialect import DialectTests
from .quoting import QuotingTests
from .usecols import UsecolsTests
from .skiprows import SkipRowsTests
from .index_col import IndexColTests
from .na_values import NAvaluesTests
from .converters import ConverterTests
from .c_parser_only import CParserTests
from .parse_dates import ParseDatesTests
from .compression import CompressionTests
from .multithread import MultithreadTests
from .python_parser_only import PythonParserTests
from .dtypes import DtypeTests


class BaseParser(CommentTests, CompressionTests,
                 ConverterTests, DialectTests,
                 HeaderTests, IndexColTests,
                 MultithreadTests, NAvaluesTests,
                 ParseDatesTests, ParserTests,
                 SkipRowsTests, UsecolsTests,
                 QuotingTests, DtypeTests):

    def read_csv(self, *args, **kwargs):
        raise NotImplementedError

    def read_table(self, *args, **kwargs):
        raise NotImplementedError

    def float_precision_choices(self):
        raise AbstractMethodError(self)

    def setup_method(self, method):
        self.dirpath = tm.get_data_path()
        self.csv1 = os.path.join(self.dirpath, 'test1.csv')
        self.csv2 = os.path.join(self.dirpath, 'test2.csv')
        self.xls1 = os.path.join(self.dirpath, 'test.xls')
        self.csv_shiftjs = os.path.join(self.dirpath, 'sauron.SHIFT_JIS.csv')


class TestCParserHighMemory(BaseParser, CParserTests):
    engine = 'c'
    low_memory = False
    float_precision_choices = [None, 'high', 'round_trip']

    def read_csv(self, *args, **kwds):
        kwds = kwds.copy()
        kwds['engine'] = self.engine
        kwds['low_memory'] = self.low_memory
        return read_csv(*args, **kwds)

    def read_table(self, *args, **kwds):
        kwds = kwds.copy()
        kwds['engine'] = self.engine
        kwds['low_memory'] = self.low_memory
        return read_table(*args, **kwds)


class TestCParserLowMemory(BaseParser, CParserTests):
    engine = 'c'
    low_memory = True
    float_precision_choices = [None, 'high', 'round_trip']

    def read_csv(self, *args, **kwds):
        kwds = kwds.copy()
        kwds['engine'] = self.engine
        kwds['low_memory'] = self.low_memory
        return read_csv(*args, **kwds)

    def read_table(self, *args, **kwds):
        kwds = kwds.copy()
        kwds['engine'] = self.engine
        kwds['low_memory'] = True
        return read_table(*args, **kwds)


class TestPythonParser(BaseParser, PythonParserTests):
    engine = 'python'
    float_precision_choices = [None]

    def read_csv(self, *args, **kwds):
        kwds = kwds.copy()
        kwds['engine'] = self.engine
        return read_csv(*args, **kwds)

    def read_table(self, *args, **kwds):
        kwds = kwds.copy()
        kwds['engine'] = self.engine
        return read_table(*args, **kwds)
