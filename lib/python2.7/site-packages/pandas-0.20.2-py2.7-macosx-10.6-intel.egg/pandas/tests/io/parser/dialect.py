# -*- coding: utf-8 -*-

"""
Tests that dialects are properly handled during parsing
for all of the parsers defined in parsers.py
"""

import csv

from pandas import DataFrame
from pandas.compat import StringIO
from pandas.errors import ParserWarning

import pandas.util.testing as tm


class DialectTests(object):

    def test_dialect(self):
        data = """\
label1,label2,label3
index1,"a,c,e
index2,b,d,f
"""

        dia = csv.excel()
        dia.quoting = csv.QUOTE_NONE
        with tm.assert_produces_warning(ParserWarning):
            df = self.read_csv(StringIO(data), dialect=dia)

        data = '''\
label1,label2,label3
index1,a,c,e
index2,b,d,f
'''
        exp = self.read_csv(StringIO(data))
        exp.replace('a', '"a', inplace=True)
        tm.assert_frame_equal(df, exp)

    def test_dialect_str(self):
        data = """\
fruit:vegetable
apple:brocolli
pear:tomato
"""
        exp = DataFrame({
            'fruit': ['apple', 'pear'],
            'vegetable': ['brocolli', 'tomato']
        })
        csv.register_dialect('mydialect', delimiter=':')
        with tm.assert_produces_warning(ParserWarning):
            df = self.read_csv(StringIO(data), dialect='mydialect')

        tm.assert_frame_equal(df, exp)
        csv.unregister_dialect('mydialect')

    def test_invalid_dialect(self):
        class InvalidDialect(object):
            pass

        data = 'a\n1'
        msg = 'Invalid dialect'

        with tm.assert_raises_regex(ValueError, msg):
            self.read_csv(StringIO(data), dialect=InvalidDialect)

    def test_dialect_conflict(self):
        data = 'a,b\n1,2'
        dialect = 'excel'
        exp = DataFrame({'a': [1], 'b': [2]})

        with tm.assert_produces_warning(None):
            df = self.read_csv(StringIO(data), delimiter=',', dialect=dialect)
            tm.assert_frame_equal(df, exp)

        with tm.assert_produces_warning(ParserWarning):
            df = self.read_csv(StringIO(data), delimiter='.', dialect=dialect)
            tm.assert_frame_equal(df, exp)
