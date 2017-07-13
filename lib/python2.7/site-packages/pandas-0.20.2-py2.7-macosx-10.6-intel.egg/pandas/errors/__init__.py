# flake8: noqa

""" expose public exceptions & warnings """

from pandas._libs.tslib import OutOfBoundsDatetime


class PerformanceWarning(Warning):
    """
    Warnings shown when there is a possible performance
    impact.
    """

class UnsupportedFunctionCall(ValueError):
    """
    If attempting to call a numpy function on a pandas
    object. For example using ``np.cumsum(groupby_object)``.
    """

class UnsortedIndexError(KeyError):
    """
    Error raised when attempting to get a slice of a MultiIndex
    and the index has not been lexsorted. Subclass of `KeyError`.

    .. versionadded:: 0.20.0

    """


class ParserError(ValueError):
    """
    Exception that is thrown by an error is encountered in `pd.read_csv`
    """


class DtypeWarning(Warning):
    """
    Warning that is raised for a dtype incompatiblity. This is
    can happen whenever `pd.read_csv` encounters non-
    uniform dtypes in a column(s) of a given CSV file
    """


class EmptyDataError(ValueError):
    """
    Exception that is thrown in `pd.read_csv` (by both the C and
    Python engines) when empty data or header is encountered
    """


class ParserWarning(Warning):
    """
    Warning that is raised in `pd.read_csv` whenever it is necessary
    to change parsers (generally from 'c' to 'python') contrary to the
    one specified by the user due to lack of support or functionality for
    parsing particular attributes of a CSV file with the requsted engine
    """


