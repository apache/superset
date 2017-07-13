# -*- coding: utf-8 -*-

"""
Tests that quoting specifications are properly handled
during parsing for all of the parsers defined in parsers.py
"""

import csv
import pandas.util.testing as tm

from pandas import DataFrame
from pandas.compat import PY3, StringIO, u


class QuotingTests(object):

    def test_bad_quote_char(self):
        data = '1,2,3'

        # Python 2.x: "...must be an 1-character..."
        # Python 3.x: "...must be a 1-character..."
        msg = '"quotechar" must be a(n)? 1-character string'
        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quotechar='foo')

        msg = 'quotechar must be set if quoting enabled'
        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quotechar=None,
                               quoting=csv.QUOTE_MINIMAL)

        msg = '"quotechar" must be string, not int'
        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quotechar=2)

    def test_bad_quoting(self):
        data = '1,2,3'

        msg = '"quoting" must be an integer'
        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quoting='foo')

        # quoting must in the range [0, 3]
        msg = 'bad "quoting" value'
        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quoting=5)

    def test_quote_char_basic(self):
        data = 'a,b,c\n1,2,"cat"'
        expected = DataFrame([[1, 2, 'cat']],
                             columns=['a', 'b', 'c'])
        result = self.read_csv(StringIO(data), quotechar='"')
        tm.assert_frame_equal(result, expected)

    def test_quote_char_various(self):
        data = 'a,b,c\n1,2,"cat"'
        expected = DataFrame([[1, 2, 'cat']],
                             columns=['a', 'b', 'c'])
        quote_chars = ['~', '*', '%', '$', '@', 'P']

        for quote_char in quote_chars:
            new_data = data.replace('"', quote_char)
            result = self.read_csv(StringIO(new_data), quotechar=quote_char)
            tm.assert_frame_equal(result, expected)

    def test_null_quote_char(self):
        data = 'a,b,c\n1,2,3'

        # sanity checks
        msg = 'quotechar must be set if quoting enabled'

        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quotechar=None,
                               quoting=csv.QUOTE_MINIMAL)

        tm.assert_raises_regex(TypeError, msg, self.read_csv,
                               StringIO(data), quotechar='',
                               quoting=csv.QUOTE_MINIMAL)

        # no errors should be raised if quoting is None
        expected = DataFrame([[1, 2, 3]],
                             columns=['a', 'b', 'c'])

        result = self.read_csv(StringIO(data), quotechar=None,
                               quoting=csv.QUOTE_NONE)
        tm.assert_frame_equal(result, expected)

        result = self.read_csv(StringIO(data), quotechar='',
                               quoting=csv.QUOTE_NONE)
        tm.assert_frame_equal(result, expected)

    def test_quoting_various(self):
        data = '1,2,"foo"'
        cols = ['a', 'b', 'c']

        # QUOTE_MINIMAL and QUOTE_ALL apply only to
        # the CSV writer, so they should have no
        # special effect for the CSV reader
        expected = DataFrame([[1, 2, 'foo']], columns=cols)

        # test default (afterwards, arguments are all explicit)
        result = self.read_csv(StringIO(data), names=cols)
        tm.assert_frame_equal(result, expected)

        result = self.read_csv(StringIO(data), quotechar='"',
                               quoting=csv.QUOTE_MINIMAL, names=cols)
        tm.assert_frame_equal(result, expected)

        result = self.read_csv(StringIO(data), quotechar='"',
                               quoting=csv.QUOTE_ALL, names=cols)
        tm.assert_frame_equal(result, expected)

        # QUOTE_NONE tells the reader to do no special handling
        # of quote characters and leave them alone
        expected = DataFrame([[1, 2, '"foo"']], columns=cols)
        result = self.read_csv(StringIO(data), quotechar='"',
                               quoting=csv.QUOTE_NONE, names=cols)
        tm.assert_frame_equal(result, expected)

        # QUOTE_NONNUMERIC tells the reader to cast
        # all non-quoted fields to float
        expected = DataFrame([[1.0, 2.0, 'foo']], columns=cols)
        result = self.read_csv(StringIO(data), quotechar='"',
                               quoting=csv.QUOTE_NONNUMERIC,
                               names=cols)
        tm.assert_frame_equal(result, expected)

    def test_double_quote(self):
        data = 'a,b\n3,"4 "" 5"'

        expected = DataFrame([[3, '4 " 5']],
                             columns=['a', 'b'])
        result = self.read_csv(StringIO(data), quotechar='"',
                               doublequote=True)
        tm.assert_frame_equal(result, expected)

        expected = DataFrame([[3, '4 " 5"']],
                             columns=['a', 'b'])
        result = self.read_csv(StringIO(data), quotechar='"',
                               doublequote=False)
        tm.assert_frame_equal(result, expected)

    def test_quotechar_unicode(self):
        # See gh-14477
        data = 'a\n1'
        expected = DataFrame({'a': [1]})

        result = self.read_csv(StringIO(data), quotechar=u('"'))
        tm.assert_frame_equal(result, expected)

        # Compared to Python 3.x, Python 2.x does not handle unicode well.
        if PY3:
            result = self.read_csv(StringIO(data), quotechar=u('\u0001'))
            tm.assert_frame_equal(result, expected)
