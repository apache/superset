# -*- coding: utf-8 -*-

import pytest
from warnings import catch_warnings
import pandas  # noqa
import pandas as pd


@pytest.mark.parametrize(
    "exc", ['UnsupportedFunctionCall', 'UnsortedIndexError',
            'OutOfBoundsDatetime',
            'ParserError', 'PerformanceWarning', 'DtypeWarning',
            'EmptyDataError', 'ParserWarning'])
def test_exception_importable(exc):
    from pandas import errors
    e = getattr(errors, exc)
    assert e is not None

    # check that we can raise on them
    with pytest.raises(e):
        raise e()


def test_catch_oob():
    from pandas import errors

    try:
        pd.Timestamp('15000101')
    except errors.OutOfBoundsDatetime:
        pass


def test_error_rename():
    # see gh-12665
    from pandas.errors import ParserError
    from pandas.io.common import CParserError

    try:
        raise CParserError()
    except ParserError:
        pass

    try:
        raise ParserError()
    except CParserError:
        pass

    with catch_warnings(record=True):
        try:
            raise ParserError()
        except pd.parser.CParserError:
            pass
