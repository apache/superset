# -*- coding: utf-8 -*-

"""
Tests that features that are currently unsupported in
either the Python or C parser are actually enforced
and are clearly communicated to the user.

Ultimately, the goal is to remove test cases from this
test suite as new feature support is added to the parsers.
"""

import pandas.io.parsers as parsers
import pandas.util.testing as tm

from pandas.compat import StringIO
from pandas.errors import ParserError
from pandas.io.parsers import read_csv, read_table

import pytest


@pytest.fixture(params=["python", "python-fwf"], ids=lambda val: val)
def python_engine(request):
    return request.param


class TestUnsupportedFeatures(object):

    def test_mangle_dupe_cols_false(self):
        # see gh-12935
        data = 'a b c\n1 2 3'
        msg = 'is not supported'

        for engine in ('c', 'python'):
            with tm.assert_raises_regex(ValueError, msg):
                read_csv(StringIO(data), engine=engine,
                         mangle_dupe_cols=False)

    def test_c_engine(self):
        # see gh-6607
        data = 'a b c\n1 2 3'
        msg = 'does not support'

        # specify C engine with unsupported options (raise)
        with tm.assert_raises_regex(ValueError, msg):
            read_table(StringIO(data), engine='c',
                       sep=None, delim_whitespace=False)
        with tm.assert_raises_regex(ValueError, msg):
            read_table(StringIO(data), engine='c', sep=r'\s')
        with tm.assert_raises_regex(ValueError, msg):
            read_table(StringIO(data), engine='c', quotechar=chr(128))
        with tm.assert_raises_regex(ValueError, msg):
            read_table(StringIO(data), engine='c', skipfooter=1)

        # specify C-unsupported options without python-unsupported options
        with tm.assert_produces_warning(parsers.ParserWarning):
            read_table(StringIO(data), sep=None, delim_whitespace=False)
        with tm.assert_produces_warning(parsers.ParserWarning):
            read_table(StringIO(data), quotechar=chr(128))
        with tm.assert_produces_warning(parsers.ParserWarning):
            read_table(StringIO(data), sep=r'\s')
        with tm.assert_produces_warning(parsers.ParserWarning):
            read_table(StringIO(data), skipfooter=1)

        text = """                      A       B       C       D        E
one two three   four
a   b   10.0032 5    -0.5109 -2.3358 -0.4645  0.05076  0.3640
a   q   20      4     0.4473  1.4152  0.2834  1.00661  0.1744
x   q   30      3    -0.6662 -0.5243 -0.3580  0.89145  2.5838"""
        msg = 'Error tokenizing data'

        with tm.assert_raises_regex(ParserError, msg):
            read_table(StringIO(text), sep='\\s+')
        with tm.assert_raises_regex(ParserError, msg):
            read_table(StringIO(text), engine='c', sep='\\s+')

        msg = "Only length-1 thousands markers supported"
        data = """A|B|C
1|2,334|5
10|13|10.
"""
        with tm.assert_raises_regex(ValueError, msg):
            read_csv(StringIO(data), thousands=',,')
        with tm.assert_raises_regex(ValueError, msg):
            read_csv(StringIO(data), thousands='')

        msg = "Only length-1 line terminators supported"
        data = 'a,b,c~~1,2,3~~4,5,6'
        with tm.assert_raises_regex(ValueError, msg):
            read_csv(StringIO(data), lineterminator='~~')

    def test_python_engine(self, python_engine):
        from pandas.io.parsers import _python_unsupported as py_unsupported

        data = """1,2,3,,
1,2,3,4,
1,2,3,4,5
1,2,,,
1,2,3,4,"""

        for default in py_unsupported:
            msg = ('The %r option is not supported '
                   'with the %r engine' % (default, python_engine))

            kwargs = {default: object()}
            with tm.assert_raises_regex(ValueError, msg):
                read_csv(StringIO(data), engine=python_engine, **kwargs)

    def test_python_engine_file_no_next(self, python_engine):
        # see gh-16530
        class NoNextBuffer(object):
            def __init__(self, csv_data):
                self.data = csv_data

            def __iter__(self):
                return self

            def read(self):
                return self.data

        data = "a\n1"
        msg = "The 'python' engine cannot iterate"

        with tm.assert_raises_regex(ValueError, msg):
            read_csv(NoNextBuffer(data), engine=python_engine)


class TestDeprecatedFeatures(object):

    def test_deprecated_args(self):
        data = '1,2,3'

        # deprecated arguments with non-default values
        deprecated = {
            'as_recarray': True,
            'buffer_lines': True,
            'compact_ints': True,
            'use_unsigned': True,
            'skip_footer': 1,
        }

        engines = 'c', 'python'

        for engine in engines:
            for arg, non_default_val in deprecated.items():
                if engine == 'c' and arg == 'skip_footer':
                    # unsupported --> exception is raised
                    continue

                if engine == 'python' and arg == 'buffer_lines':
                    # unsupported --> exception is raised
                    continue

                with tm.assert_produces_warning(
                        FutureWarning, check_stacklevel=False):
                    kwargs = {arg: non_default_val}
                    read_csv(StringIO(data), engine=engine,
                             **kwargs)
