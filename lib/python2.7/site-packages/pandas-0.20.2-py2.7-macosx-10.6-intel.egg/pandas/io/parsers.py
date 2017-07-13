"""
Module contains tools for processing files into DataFrames or other objects
"""
from __future__ import print_function
from collections import defaultdict
import re
import csv
import sys
import warnings
import datetime
from textwrap import fill

import numpy as np

from pandas import compat
from pandas.compat import (range, lrange, PY3, StringIO, lzip,
                           zip, string_types, map, u)
from pandas.core.dtypes.common import (
    is_integer, _ensure_object,
    is_list_like, is_integer_dtype,
    is_float, is_dtype_equal,
    is_object_dtype, is_string_dtype,
    is_scalar, is_categorical_dtype)
from pandas.core.dtypes.missing import isnull
from pandas.core.dtypes.cast import astype_nansafe
from pandas.core.index import Index, MultiIndex, RangeIndex
from pandas.core.series import Series
from pandas.core.frame import DataFrame
from pandas.core.categorical import Categorical
from pandas.core import algorithms
from pandas.core.common import AbstractMethodError
from pandas.io.date_converters import generic_parser
from pandas.errors import ParserWarning, ParserError, EmptyDataError
from pandas.io.common import (get_filepath_or_buffer, is_file_like,
                              _validate_header_arg, _get_handle,
                              UnicodeReader, UTF8Recoder, _NA_VALUES,
                              BaseIterator, _infer_compression)
from pandas.core.tools import datetimes as tools

from pandas.util._decorators import Appender

import pandas._libs.lib as lib
import pandas._libs.parsers as parsers


# BOM character (byte order mark)
# This exists at the beginning of a file to indicate endianness
# of a file (stream). Unfortunately, this marker screws up parsing,
# so we need to remove it if we see it.
_BOM = u('\ufeff')

_parser_params = """Also supports optionally iterating or breaking of the file
into chunks.

Additional help can be found in the `online docs for IO Tools
<http://pandas.pydata.org/pandas-docs/stable/io.html>`_.

Parameters
----------
filepath_or_buffer : str, pathlib.Path, py._path.local.LocalPath or any \
object with a read() method (such as a file handle or StringIO)
    The string could be a URL. Valid URL schemes include http, ftp, s3, and
    file. For file URLs, a host is expected. For instance, a local file could
    be file ://localhost/path/to/table.csv
%s
delimiter : str, default ``None``
    Alternative argument name for sep.
delim_whitespace : boolean, default False
    Specifies whether or not whitespace (e.g. ``' '`` or ``'\t'``) will be
    used as the sep. Equivalent to setting ``sep='\s+'``. If this option
    is set to True, nothing should be passed in for the ``delimiter``
    parameter.

    .. versionadded:: 0.18.1 support for the Python parser.

header : int or list of ints, default 'infer'
    Row number(s) to use as the column names, and the start of the data.
    Default behavior is as if set to 0 if no ``names`` passed, otherwise
    ``None``. Explicitly pass ``header=0`` to be able to replace existing
    names. The header can be a list of integers that specify row locations for
    a multi-index on the columns e.g. [0,1,3]. Intervening rows that are not
    specified will be skipped (e.g. 2 in this example is skipped). Note that
    this parameter ignores commented lines and empty lines if
    ``skip_blank_lines=True``, so header=0 denotes the first line of data
    rather than the first line of the file.
names : array-like, default None
    List of column names to use. If file contains no header row, then you
    should explicitly pass header=None. Duplicates in this list are not
    allowed unless mangle_dupe_cols=True, which is the default.
index_col : int or sequence or False, default None
    Column to use as the row labels of the DataFrame. If a sequence is given, a
    MultiIndex is used. If you have a malformed file with delimiters at the end
    of each line, you might consider index_col=False to force pandas to _not_
    use the first column as the index (row names)
usecols : array-like or callable, default None
    Return a subset of the columns. If array-like, all elements must either
    be positional (i.e. integer indices into the document columns) or strings
    that correspond to column names provided either by the user in `names` or
    inferred from the document header row(s). For example, a valid array-like
    `usecols` parameter would be [0, 1, 2] or ['foo', 'bar', 'baz'].

    If callable, the callable function will be evaluated against the column
    names, returning names where the callable function evaluates to True. An
    example of a valid callable argument would be ``lambda x: x.upper() in
    ['AAA', 'BBB', 'DDD']``. Using this parameter results in much faster
    parsing time and lower memory usage.
as_recarray : boolean, default False
    DEPRECATED: this argument will be removed in a future version. Please call
    `pd.read_csv(...).to_records()` instead.

    Return a NumPy recarray instead of a DataFrame after parsing the data.
    If set to True, this option takes precedence over the `squeeze` parameter.
    In addition, as row indices are not available in such a format, the
    `index_col` parameter will be ignored.
squeeze : boolean, default False
    If the parsed data only contains one column then return a Series
prefix : str, default None
    Prefix to add to column numbers when no header, e.g. 'X' for X0, X1, ...
mangle_dupe_cols : boolean, default True
    Duplicate columns will be specified as 'X.0'...'X.N', rather than
    'X'...'X'. Passing in False will cause data to be overwritten if there
    are duplicate names in the columns.
dtype : Type name or dict of column -> type, default None
    Data type for data or columns. E.g. {'a': np.float64, 'b': np.int32}
    Use `str` or `object` to preserve and not interpret dtype.
    If converters are specified, they will be applied INSTEAD
    of dtype conversion.
%s
converters : dict, default None
    Dict of functions for converting values in certain columns. Keys can either
    be integers or column labels
true_values : list, default None
    Values to consider as True
false_values : list, default None
    Values to consider as False
skipinitialspace : boolean, default False
    Skip spaces after delimiter.
skiprows : list-like or integer or callable, default None
    Line numbers to skip (0-indexed) or number of lines to skip (int)
    at the start of the file.

    If callable, the callable function will be evaluated against the row
    indices, returning True if the row should be skipped and False otherwise.
    An example of a valid callable argument would be ``lambda x: x in [0, 2]``.
skipfooter : int, default 0
    Number of lines at bottom of file to skip (Unsupported with engine='c')
skip_footer : int, default 0
    DEPRECATED: use the `skipfooter` parameter instead, as they are identical
nrows : int, default None
    Number of rows of file to read. Useful for reading pieces of large files
na_values : scalar, str, list-like, or dict, default None
    Additional strings to recognize as NA/NaN. If dict passed, specific
    per-column NA values.  By default the following values are interpreted as
    NaN: '""" + fill("', '".join(sorted(_NA_VALUES)),
                     70, subsequent_indent="    ") + """'`.
keep_default_na : bool, default True
    If na_values are specified and keep_default_na is False the default NaN
    values are overridden, otherwise they're appended to.
na_filter : boolean, default True
    Detect missing value markers (empty strings and the value of na_values). In
    data without any NAs, passing na_filter=False can improve the performance
    of reading a large file
verbose : boolean, default False
    Indicate number of NA values placed in non-numeric columns
skip_blank_lines : boolean, default True
    If True, skip over blank lines rather than interpreting as NaN values
parse_dates : boolean or list of ints or names or list of lists or dict, \
default False

    * boolean. If True -> try parsing the index.
    * list of ints or names. e.g. If [1, 2, 3] -> try parsing columns 1, 2, 3
      each as a separate date column.
    * list of lists. e.g.  If [[1, 3]] -> combine columns 1 and 3 and parse as
      a single date column.
    * dict, e.g. {'foo' : [1, 3]} -> parse columns 1, 3 as date and call result
      'foo'

    If a column or index contains an unparseable date, the entire column or
    index will be returned unaltered as an object data type. For non-standard
    datetime parsing, use ``pd.to_datetime`` after ``pd.read_csv``

    Note: A fast-path exists for iso8601-formatted dates.
infer_datetime_format : boolean, default False
    If True and parse_dates is enabled, pandas will attempt to infer the format
    of the datetime strings in the columns, and if it can be inferred, switch
    to a faster method of parsing them. In some cases this can increase the
    parsing speed by 5-10x.
keep_date_col : boolean, default False
    If True and parse_dates specifies combining multiple columns then
    keep the original columns.
date_parser : function, default None
    Function to use for converting a sequence of string columns to an array of
    datetime instances. The default uses ``dateutil.parser.parser`` to do the
    conversion. Pandas will try to call date_parser in three different ways,
    advancing to the next if an exception occurs: 1) Pass one or more arrays
    (as defined by parse_dates) as arguments; 2) concatenate (row-wise) the
    string values from the columns defined by parse_dates into a single array
    and pass that; and 3) call date_parser once for each row using one or more
    strings (corresponding to the columns defined by parse_dates) as arguments.
dayfirst : boolean, default False
    DD/MM format dates, international and European format
iterator : boolean, default False
    Return TextFileReader object for iteration or getting chunks with
    ``get_chunk()``.
chunksize : int, default None
    Return TextFileReader object for iteration.
    See the `IO Tools docs
    <http://pandas.pydata.org/pandas-docs/stable/io.html#io-chunking>`_
    for more information on ``iterator`` and ``chunksize``.
compression : {'infer', 'gzip', 'bz2', 'zip', 'xz', None}, default 'infer'
    For on-the-fly decompression of on-disk data. If 'infer', then use gzip,
    bz2, zip or xz if filepath_or_buffer is a string ending in '.gz', '.bz2',
    '.zip', or 'xz', respectively, and no decompression otherwise. If using
    'zip', the ZIP file must contain only one data file to be read in.
    Set to None for no decompression.

    .. versionadded:: 0.18.1 support for 'zip' and 'xz' compression.

thousands : str, default None
    Thousands separator
decimal : str, default '.'
    Character to recognize as decimal point (e.g. use ',' for European data).
float_precision : string, default None
    Specifies which converter the C engine should use for floating-point
    values. The options are `None` for the ordinary converter,
    `high` for the high-precision converter, and `round_trip` for the
    round-trip converter.
lineterminator : str (length 1), default None
    Character to break file into lines. Only valid with C parser.
quotechar : str (length 1), optional
    The character used to denote the start and end of a quoted item. Quoted
    items can include the delimiter and it will be ignored.
quoting : int or csv.QUOTE_* instance, default 0
    Control field quoting behavior per ``csv.QUOTE_*`` constants. Use one of
    QUOTE_MINIMAL (0), QUOTE_ALL (1), QUOTE_NONNUMERIC (2) or QUOTE_NONE (3).
doublequote : boolean, default ``True``
   When quotechar is specified and quoting is not ``QUOTE_NONE``, indicate
   whether or not to interpret two consecutive quotechar elements INSIDE a
   field as a single ``quotechar`` element.
escapechar : str (length 1), default None
    One-character string used to escape delimiter when quoting is QUOTE_NONE.
comment : str, default None
    Indicates remainder of line should not be parsed. If found at the beginning
    of a line, the line will be ignored altogether. This parameter must be a
    single character. Like empty lines (as long as ``skip_blank_lines=True``),
    fully commented lines are ignored by the parameter `header` but not by
    `skiprows`. For example, if comment='#', parsing '#empty\\na,b,c\\n1,2,3'
    with `header=0` will result in 'a,b,c' being
    treated as the header.
encoding : str, default None
    Encoding to use for UTF when reading/writing (ex. 'utf-8'). `List of Python
    standard encodings
    <https://docs.python.org/3/library/codecs.html#standard-encodings>`_
dialect : str or csv.Dialect instance, default None
    If provided, this parameter will override values (default or not) for the
    following parameters: `delimiter`, `doublequote`, `escapechar`,
    `skipinitialspace`, `quotechar`, and `quoting`. If it is necessary to
    override values, a ParserWarning will be issued. See csv.Dialect
    documentation for more details.
tupleize_cols : boolean, default False
    Leave a list of tuples on columns as is (default is to convert to
    a Multi Index on the columns)
error_bad_lines : boolean, default True
    Lines with too many fields (e.g. a csv line with too many commas) will by
    default cause an exception to be raised, and no DataFrame will be returned.
    If False, then these "bad lines" will dropped from the DataFrame that is
    returned.
warn_bad_lines : boolean, default True
    If error_bad_lines is False, and warn_bad_lines is True, a warning for each
    "bad line" will be output.
low_memory : boolean, default True
    Internally process the file in chunks, resulting in lower memory use
    while parsing, but possibly mixed type inference.  To ensure no mixed
    types either set False, or specify the type with the `dtype` parameter.
    Note that the entire file is read into a single DataFrame regardless,
    use the `chunksize` or `iterator` parameter to return the data in chunks.
    (Only valid with C parser)
buffer_lines : int, default None
    DEPRECATED: this argument will be removed in a future version because its
    value is not respected by the parser
compact_ints : boolean, default False
    DEPRECATED: this argument will be removed in a future version

    If compact_ints is True, then for any column that is of integer dtype,
    the parser will attempt to cast it as the smallest integer dtype possible,
    either signed or unsigned depending on the specification from the
    `use_unsigned` parameter.
use_unsigned : boolean, default False
    DEPRECATED: this argument will be removed in a future version

    If integer columns are being compacted (i.e. `compact_ints=True`), specify
    whether the column should be compacted to the smallest signed or unsigned
    integer dtype.
memory_map : boolean, default False
    If a filepath is provided for `filepath_or_buffer`, map the file object
    directly onto memory and access the data directly from there. Using this
    option can improve performance because there is no longer any I/O overhead.

Returns
-------
result : DataFrame or TextParser
"""

# engine is not used in read_fwf() so is factored out of the shared docstring
_engine_doc = """engine : {'c', 'python'}, optional
    Parser engine to use. The C engine is faster while the python engine is
    currently more feature-complete."""

_sep_doc = r"""sep : str, default {default}
    Delimiter to use. If sep is None, the C engine cannot automatically detect
    the separator, but the Python parsing engine can, meaning the latter will
    be used automatically. In addition, separators longer than 1 character and
    different from ``'\s+'`` will be interpreted as regular expressions and
    will also force the use of the Python parsing engine. Note that regex
    delimiters are prone to ignoring quoted data. Regex example: ``'\r\t'``"""

_read_csv_doc = """
Read CSV (comma-separated) file into DataFrame

%s
""" % (_parser_params % (_sep_doc.format(default="','"), _engine_doc))

_read_table_doc = """
Read general delimited file into DataFrame

%s
""" % (_parser_params % (_sep_doc.format(default="\\t (tab-stop)"),
                         _engine_doc))

_fwf_widths = """\
colspecs : list of pairs (int, int) or 'infer'. optional
    A list of pairs (tuples) giving the extents of the fixed-width
    fields of each line as half-open intervals (i.e.,  [from, to[ ).
    String value 'infer' can be used to instruct the parser to try
    detecting the column specifications from the first 100 rows of
    the data which are not being skipped via skiprows (default='infer').
widths : list of ints. optional
    A list of field widths which can be used instead of 'colspecs' if
    the intervals are contiguous.
"""

_read_fwf_doc = """
Read a table of fixed-width formatted lines into DataFrame

%s

Also, 'delimiter' is used to specify the filler character of the
fields if it is not spaces (e.g., '~').
""" % (_parser_params % (_fwf_widths, ''))


def _validate_integer(name, val, min_val=0):
    """
    Checks whether the 'name' parameter for parsing is either
    an integer OR float that can SAFELY be cast to an integer
    without losing accuracy. Raises a ValueError if that is
    not the case.

    Parameters
    ----------
    name : string
        Parameter name (used for error reporting)
    val : int or float
        The value to check
    min_val : int
        Minimum allowed value (val < min_val will result in a ValueError)
    """
    msg = "'{name:s}' must be an integer >={min_val:d}".format(name=name,
                                                               min_val=min_val)

    if val is not None:
        if is_float(val):
            if int(val) != val:
                raise ValueError(msg)
            val = int(val)
        elif not (is_integer(val) and val >= min_val):
            raise ValueError(msg)

    return val


def _read(filepath_or_buffer, kwds):
    """Generic reader of line files."""
    encoding = kwds.get('encoding', None)
    if encoding is not None:
        encoding = re.sub('_', '-', encoding).lower()
        kwds['encoding'] = encoding

    compression = kwds.get('compression')
    compression = _infer_compression(filepath_or_buffer, compression)
    filepath_or_buffer, _, compression = get_filepath_or_buffer(
        filepath_or_buffer, encoding, compression)
    kwds['compression'] = compression

    if kwds.get('date_parser', None) is not None:
        if isinstance(kwds['parse_dates'], bool):
            kwds['parse_dates'] = True

    # Extract some of the arguments (pass chunksize on).
    iterator = kwds.get('iterator', False)
    chunksize = _validate_integer('chunksize', kwds.get('chunksize', None), 1)
    nrows = _validate_integer('nrows', kwds.get('nrows', None))

    # Create the parser.
    parser = TextFileReader(filepath_or_buffer, **kwds)

    if chunksize or iterator:
        return parser

    try:
        data = parser.read(nrows)
    finally:
        parser.close()
    return data


_parser_defaults = {
    'delimiter': None,

    'doublequote': True,
    'escapechar': None,
    'quotechar': '"',
    'quoting': csv.QUOTE_MINIMAL,
    'skipinitialspace': False,
    'lineterminator': None,

    'header': 'infer',
    'index_col': None,
    'names': None,
    'prefix': None,
    'skiprows': None,
    'na_values': None,
    'true_values': None,
    'false_values': None,
    'converters': None,
    'dtype': None,
    'skipfooter': 0,

    'keep_default_na': True,
    'thousands': None,
    'comment': None,
    'decimal': b'.',

    # 'engine': 'c',
    'parse_dates': False,
    'keep_date_col': False,
    'dayfirst': False,
    'date_parser': None,

    'usecols': None,

    'nrows': None,
    # 'iterator': False,
    'chunksize': None,
    'verbose': False,
    'encoding': None,
    'squeeze': False,
    'compression': None,
    'mangle_dupe_cols': True,
    'tupleize_cols': False,
    'infer_datetime_format': False,
    'skip_blank_lines': True
}


_c_parser_defaults = {
    'delim_whitespace': False,
    'as_recarray': False,
    'na_filter': True,
    'compact_ints': False,
    'use_unsigned': False,
    'low_memory': True,
    'memory_map': False,
    'buffer_lines': None,
    'error_bad_lines': True,
    'warn_bad_lines': True,
    'float_precision': None
}

_fwf_defaults = {
    'colspecs': 'infer',
    'widths': None,
}

_c_unsupported = set(['skipfooter'])
_python_unsupported = set([
    'low_memory',
    'buffer_lines',
    'float_precision',
])
_deprecated_args = set([
    'as_recarray',
    'buffer_lines',
    'compact_ints',
    'use_unsigned',
])


def _make_parser_function(name, sep=','):

    default_sep = sep

    def parser_f(filepath_or_buffer,
                 sep=sep,
                 delimiter=None,

                 # Column and Index Locations and Names
                 header='infer',
                 names=None,
                 index_col=None,
                 usecols=None,
                 squeeze=False,
                 prefix=None,
                 mangle_dupe_cols=True,

                 # General Parsing Configuration
                 dtype=None,
                 engine=None,
                 converters=None,
                 true_values=None,
                 false_values=None,
                 skipinitialspace=False,
                 skiprows=None,
                 nrows=None,

                 # NA and Missing Data Handling
                 na_values=None,
                 keep_default_na=True,
                 na_filter=True,
                 verbose=False,
                 skip_blank_lines=True,

                 # Datetime Handling
                 parse_dates=False,
                 infer_datetime_format=False,
                 keep_date_col=False,
                 date_parser=None,
                 dayfirst=False,

                 # Iteration
                 iterator=False,
                 chunksize=None,

                 # Quoting, Compression, and File Format
                 compression='infer',
                 thousands=None,
                 decimal=b'.',
                 lineterminator=None,
                 quotechar='"',
                 quoting=csv.QUOTE_MINIMAL,
                 escapechar=None,
                 comment=None,
                 encoding=None,
                 dialect=None,
                 tupleize_cols=False,

                 # Error Handling
                 error_bad_lines=True,
                 warn_bad_lines=True,

                 skipfooter=0,
                 skip_footer=0,  # deprecated

                 # Internal
                 doublequote=True,
                 delim_whitespace=False,
                 as_recarray=False,
                 compact_ints=False,
                 use_unsigned=False,
                 low_memory=_c_parser_defaults['low_memory'],
                 buffer_lines=None,
                 memory_map=False,
                 float_precision=None):

        # Alias sep -> delimiter.
        if delimiter is None:
            delimiter = sep

        if delim_whitespace and delimiter is not default_sep:
            raise ValueError("Specified a delimiter with both sep and"
                             " delim_whitespace=True; you can only"
                             " specify one.")

        if engine is not None:
            engine_specified = True
        else:
            engine = 'c'
            engine_specified = False

        if skip_footer != 0:
            warnings.warn("The 'skip_footer' argument has "
                          "been deprecated and will be removed "
                          "in a future version. Please use the "
                          "'skipfooter' argument instead.",
                          FutureWarning, stacklevel=2)

        kwds = dict(delimiter=delimiter,
                    engine=engine,
                    dialect=dialect,
                    compression=compression,
                    engine_specified=engine_specified,

                    doublequote=doublequote,
                    escapechar=escapechar,
                    quotechar=quotechar,
                    quoting=quoting,
                    skipinitialspace=skipinitialspace,
                    lineterminator=lineterminator,

                    header=header,
                    index_col=index_col,
                    names=names,
                    prefix=prefix,
                    skiprows=skiprows,
                    na_values=na_values,
                    true_values=true_values,
                    false_values=false_values,
                    keep_default_na=keep_default_na,
                    thousands=thousands,
                    comment=comment,
                    decimal=decimal,

                    parse_dates=parse_dates,
                    keep_date_col=keep_date_col,
                    dayfirst=dayfirst,
                    date_parser=date_parser,

                    nrows=nrows,
                    iterator=iterator,
                    chunksize=chunksize,
                    skipfooter=skipfooter or skip_footer,
                    converters=converters,
                    dtype=dtype,
                    usecols=usecols,
                    verbose=verbose,
                    encoding=encoding,
                    squeeze=squeeze,
                    memory_map=memory_map,
                    float_precision=float_precision,

                    na_filter=na_filter,
                    compact_ints=compact_ints,
                    use_unsigned=use_unsigned,
                    delim_whitespace=delim_whitespace,
                    as_recarray=as_recarray,
                    warn_bad_lines=warn_bad_lines,
                    error_bad_lines=error_bad_lines,
                    low_memory=low_memory,
                    buffer_lines=buffer_lines,
                    mangle_dupe_cols=mangle_dupe_cols,
                    tupleize_cols=tupleize_cols,
                    infer_datetime_format=infer_datetime_format,
                    skip_blank_lines=skip_blank_lines)

        return _read(filepath_or_buffer, kwds)

    parser_f.__name__ = name

    return parser_f


read_csv = _make_parser_function('read_csv', sep=',')
read_csv = Appender(_read_csv_doc)(read_csv)

read_table = _make_parser_function('read_table', sep='\t')
read_table = Appender(_read_table_doc)(read_table)


@Appender(_read_fwf_doc)
def read_fwf(filepath_or_buffer, colspecs='infer', widths=None, **kwds):
    # Check input arguments.
    if colspecs is None and widths is None:
        raise ValueError("Must specify either colspecs or widths")
    elif colspecs not in (None, 'infer') and widths is not None:
        raise ValueError("You must specify only one of 'widths' and "
                         "'colspecs'")

    # Compute 'colspecs' from 'widths', if specified.
    if widths is not None:
        colspecs, col = [], 0
        for w in widths:
            colspecs.append((col, col + w))
            col += w

    kwds['colspecs'] = colspecs
    kwds['engine'] = 'python-fwf'
    return _read(filepath_or_buffer, kwds)


class TextFileReader(BaseIterator):
    """

    Passed dialect overrides any of the related parser options

    """

    def __init__(self, f, engine=None, **kwds):

        self.f = f

        if engine is not None:
            engine_specified = True
        else:
            engine = 'python'
            engine_specified = False

        self._engine_specified = kwds.get('engine_specified', engine_specified)

        if kwds.get('dialect') is not None:
            dialect = kwds['dialect']
            if dialect in csv.list_dialects():
                dialect = csv.get_dialect(dialect)

            # Any valid dialect should have these attributes.
            # If any are missing, we will raise automatically.
            for param in ('delimiter', 'doublequote', 'escapechar',
                          'skipinitialspace', 'quotechar', 'quoting'):
                try:
                    dialect_val = getattr(dialect, param)
                except AttributeError:
                    raise ValueError("Invalid dialect '{dialect}' provided"
                                     .format(dialect=kwds['dialect']))
                provided = kwds.get(param, _parser_defaults[param])

                # Messages for conflicting values between the dialect instance
                # and the actual parameters provided.
                conflict_msgs = []

                if dialect_val != provided:
                    conflict_msgs.append((
                        "Conflicting values for '{param}': '{val}' was "
                        "provided, but the dialect specifies '{diaval}'. "
                        "Using the dialect-specified value.".format(
                            param=param, val=provided, diaval=dialect_val)))

                if conflict_msgs:
                    warnings.warn('\n\n'.join(conflict_msgs), ParserWarning,
                                  stacklevel=2)
                kwds[param] = dialect_val

        if kwds.get('header', 'infer') == 'infer':
            kwds['header'] = 0 if kwds.get('names') is None else None

        self.orig_options = kwds

        # miscellanea
        self.engine = engine
        self._engine = None
        self._currow = 0

        options = self._get_options_with_defaults(engine)

        self.chunksize = options.pop('chunksize', None)
        self.nrows = options.pop('nrows', None)
        self.squeeze = options.pop('squeeze', False)

        # might mutate self.engine
        self.engine = self._check_file_or_buffer(f, engine)
        self.options, self.engine = self._clean_options(options, engine)

        if 'has_index_names' in kwds:
            self.options['has_index_names'] = kwds['has_index_names']

        self._make_engine(self.engine)

    def close(self):
        self._engine.close()

    def _get_options_with_defaults(self, engine):
        kwds = self.orig_options

        options = {}

        for argname, default in compat.iteritems(_parser_defaults):
            value = kwds.get(argname, default)

            # see gh-12935
            if argname == 'mangle_dupe_cols' and not value:
                raise ValueError('Setting mangle_dupe_cols=False is '
                                 'not supported yet')
            else:
                options[argname] = value

        for argname, default in compat.iteritems(_c_parser_defaults):
            if argname in kwds:
                value = kwds[argname]

                if engine != 'c' and value != default:
                    if ('python' in engine and
                            argname not in _python_unsupported):
                        pass
                    else:
                        raise ValueError(
                            'The %r option is not supported with the'
                            ' %r engine' % (argname, engine))
            else:
                value = default
            options[argname] = value

        if engine == 'python-fwf':
            for argname, default in compat.iteritems(_fwf_defaults):
                options[argname] = kwds.get(argname, default)

        return options

    def _check_file_or_buffer(self, f, engine):
        # see gh-16530
        if is_file_like(f):
            next_attr = "__next__" if PY3 else "next"

            # The C engine doesn't need the file-like to have the "next" or
            # "__next__" attribute. However, the Python engine explicitly calls
            # "next(...)" when iterating through such an object, meaning it
            # needs to have that attribute ("next" for Python 2.x, "__next__"
            # for Python 3.x)
            if engine != "c" and not hasattr(f, next_attr):
                msg = ("The 'python' engine cannot iterate "
                       "through this file buffer.")
                raise ValueError(msg)

        return engine

    def _clean_options(self, options, engine):
        result = options.copy()

        engine_specified = self._engine_specified
        fallback_reason = None

        sep = options['delimiter']
        delim_whitespace = options['delim_whitespace']

        # C engine not supported yet
        if engine == 'c':
            if options['skipfooter'] > 0:
                fallback_reason = "the 'c' engine does not support"\
                                  " skipfooter"
                engine = 'python'

        encoding = sys.getfilesystemencoding() or 'utf-8'
        if sep is None and not delim_whitespace:
            if engine == 'c':
                fallback_reason = "the 'c' engine does not support"\
                                  " sep=None with delim_whitespace=False"
                engine = 'python'
        elif sep is not None and len(sep) > 1:
            if engine == 'c' and sep == '\s+':
                result['delim_whitespace'] = True
                del result['delimiter']
            elif engine not in ('python', 'python-fwf'):
                # wait until regex engine integrated
                fallback_reason = "the 'c' engine does not support"\
                                  " regex separators (separators > 1 char and"\
                                  " different from '\s+' are"\
                                  " interpreted as regex)"
                engine = 'python'
        elif delim_whitespace:
            if 'python' in engine:
                result['delimiter'] = '\s+'
        elif sep is not None:
            encodeable = True
            try:
                if len(sep.encode(encoding)) > 1:
                    encodeable = False
            except UnicodeDecodeError:
                encodeable = False
            if not encodeable and engine not in ('python', 'python-fwf'):
                fallback_reason = "the separator encoded in {encoding}" \
                                  " is > 1 char long, and the 'c' engine" \
                                  " does not support such separators".format(
                                      encoding=encoding)
                engine = 'python'

        quotechar = options['quotechar']
        if (quotechar is not None and
                isinstance(quotechar, (str, compat.text_type, bytes))):
            if (len(quotechar) == 1 and ord(quotechar) > 127 and
                    engine not in ('python', 'python-fwf')):
                fallback_reason = ("ord(quotechar) > 127, meaning the "
                                   "quotechar is larger than one byte, "
                                   "and the 'c' engine does not support "
                                   "such quotechars")
                engine = 'python'

        if fallback_reason and engine_specified:
            raise ValueError(fallback_reason)

        if engine == 'c':
            for arg in _c_unsupported:
                del result[arg]

        if 'python' in engine:
            for arg in _python_unsupported:
                if fallback_reason and result[arg] != _c_parser_defaults[arg]:
                    msg = ("Falling back to the 'python' engine because"
                           " {reason}, but this causes {option!r} to be"
                           " ignored as it is not supported by the 'python'"
                           " engine.").format(reason=fallback_reason,
                                              option=arg)
                    raise ValueError(msg)
                del result[arg]

        if fallback_reason:
            warnings.warn(("Falling back to the 'python' engine because"
                           " {0}; you can avoid this warning by specifying"
                           " engine='python'.").format(fallback_reason),
                          ParserWarning, stacklevel=5)

        index_col = options['index_col']
        names = options['names']
        converters = options['converters']
        na_values = options['na_values']
        skiprows = options['skiprows']

        # really delete this one
        keep_default_na = result.pop('keep_default_na')

        _validate_header_arg(options['header'])

        depr_warning = ''

        for arg in _deprecated_args:
            parser_default = _c_parser_defaults[arg]
            msg = ("The '{arg}' argument has been deprecated "
                   "and will be removed in a future version."
                   .format(arg=arg))

            if arg == 'as_recarray':
                msg += ' Please call pd.to_csv(...).to_records() instead.'

            if result.get(arg, parser_default) != parser_default:
                depr_warning += msg + '\n\n'

        if depr_warning != '':
            warnings.warn(depr_warning, FutureWarning, stacklevel=2)

        if index_col is True:
            raise ValueError("The value of index_col couldn't be 'True'")
        if _is_index_col(index_col):
            if not isinstance(index_col, (list, tuple, np.ndarray)):
                index_col = [index_col]
        result['index_col'] = index_col

        names = list(names) if names is not None else names

        # type conversion-related
        if converters is not None:
            if not isinstance(converters, dict):
                raise TypeError('Type converters must be a dict or'
                                ' subclass, input was '
                                'a {0!r}'.format(type(converters).__name__))
        else:
            converters = {}

        # Converting values to NA
        na_values, na_fvalues = _clean_na_values(na_values, keep_default_na)

        # handle skiprows; this is internally handled by the
        # c-engine, so only need for python parsers
        if engine != 'c':
            if is_integer(skiprows):
                skiprows = lrange(skiprows)
            if skiprows is None:
                skiprows = set()
            elif not callable(skiprows):
                skiprows = set(skiprows)

        # put stuff back
        result['names'] = names
        result['converters'] = converters
        result['na_values'] = na_values
        result['na_fvalues'] = na_fvalues
        result['skiprows'] = skiprows

        return result, engine

    def __next__(self):
        try:
            return self.get_chunk()
        except StopIteration:
            self.close()
            raise

    def _make_engine(self, engine='c'):
        if engine == 'c':
            self._engine = CParserWrapper(self.f, **self.options)
        else:
            if engine == 'python':
                klass = PythonParser
            elif engine == 'python-fwf':
                klass = FixedWidthFieldParser
            else:
                raise ValueError('Unknown engine: {engine} (valid options are'
                                 ' "c", "python", or' ' "python-fwf")'.format(
                                     engine=engine))
            self._engine = klass(self.f, **self.options)

    def _failover_to_python(self):
        raise AbstractMethodError(self)

    def read(self, nrows=None):
        if nrows is not None:
            if self.options.get('skipfooter'):
                raise ValueError('skipfooter not supported for iteration')

        ret = self._engine.read(nrows)

        if self.options.get('as_recarray'):
            return ret

        # May alter columns / col_dict
        index, columns, col_dict = self._create_index(ret)

        if index is None:
            if col_dict:
                # Any column is actually fine:
                new_rows = len(compat.next(compat.itervalues(col_dict)))
                index = RangeIndex(self._currow, self._currow + new_rows)
            else:
                new_rows = 0
        else:
            new_rows = len(index)

        df = DataFrame(col_dict, columns=columns, index=index)

        self._currow += new_rows

        if self.squeeze and len(df.columns) == 1:
            return df[df.columns[0]].copy()
        return df

    def _create_index(self, ret):
        index, columns, col_dict = ret
        return index, columns, col_dict

    def get_chunk(self, size=None):
        if size is None:
            size = self.chunksize
        if self.nrows is not None:
            if self._currow >= self.nrows:
                raise StopIteration
            size = min(size, self.nrows - self._currow)
        return self.read(nrows=size)


def _is_index_col(col):
    return col is not None and col is not False


def _evaluate_usecols(usecols, names):
    """
    Check whether or not the 'usecols' parameter
    is a callable.  If so, enumerates the 'names'
    parameter and returns a set of indices for
    each entry in 'names' that evaluates to True.
    If not a callable, returns 'usecols'.
    """
    if callable(usecols):
        return set([i for i, name in enumerate(names)
                    if usecols(name)])
    return usecols


def _validate_skipfooter_arg(skipfooter):
    """
    Validate the 'skipfooter' parameter.

    Checks whether 'skipfooter' is a non-negative integer.
    Raises a ValueError if that is not the case.

    Parameters
    ----------
    skipfooter : non-negative integer
        The number of rows to skip at the end of the file.

    Returns
    -------
    validated_skipfooter : non-negative integer
        The original input if the validation succeeds.

    Raises
    ------
    ValueError : 'skipfooter' was not a non-negative integer.
    """

    if not is_integer(skipfooter):
        raise ValueError("skipfooter must be an integer")

    if skipfooter < 0:
        raise ValueError("skipfooter cannot be negative")

    return skipfooter


def _validate_usecols_arg(usecols):
    """
    Validate the 'usecols' parameter.

    Checks whether or not the 'usecols' parameter contains all integers
    (column selection by index), strings (column by name) or is a callable.
    Raises a ValueError if that is not the case.

    Parameters
    ----------
    usecols : array-like, callable, or None
        List of columns to use when parsing or a callable that can be used
        to filter a list of table columns.

    Returns
    -------
    usecols_tuple : tuple
        A tuple of (verified_usecols, usecols_dtype).

        'verified_usecols' is either a set if an array-like is passed in or
        'usecols' if a callable or None is passed in.

        'usecols_dtype` is the inferred dtype of 'usecols' if an array-like
        is passed in or None if a callable or None is passed in.
    """
    msg = ("'usecols' must either be all strings, all unicode, "
           "all integers or a callable")

    if usecols is not None:
        if callable(usecols):
            return usecols, None
        usecols_dtype = lib.infer_dtype(usecols)
        if usecols_dtype not in ('empty', 'integer',
                                 'string', 'unicode'):
            raise ValueError(msg)

        return set(usecols), usecols_dtype
    return usecols, None


def _validate_parse_dates_arg(parse_dates):
    """
    Check whether or not the 'parse_dates' parameter
    is a non-boolean scalar. Raises a ValueError if
    that is the case.
    """
    msg = ("Only booleans, lists, and "
           "dictionaries are accepted "
           "for the 'parse_dates' parameter")

    if parse_dates is not None:
        if is_scalar(parse_dates):
            if not lib.is_bool(parse_dates):
                raise TypeError(msg)

        elif not isinstance(parse_dates, (list, dict)):
            raise TypeError(msg)

    return parse_dates


class ParserBase(object):

    def __init__(self, kwds):
        self.names = kwds.get('names')
        self.orig_names = None
        self.prefix = kwds.pop('prefix', None)

        self.index_col = kwds.get('index_col', None)
        self.index_names = None
        self.col_names = None

        self.parse_dates = _validate_parse_dates_arg(
            kwds.pop('parse_dates', False))
        self.date_parser = kwds.pop('date_parser', None)
        self.dayfirst = kwds.pop('dayfirst', False)
        self.keep_date_col = kwds.pop('keep_date_col', False)

        self.na_values = kwds.get('na_values')
        self.na_fvalues = kwds.get('na_fvalues')
        self.true_values = kwds.get('true_values')
        self.false_values = kwds.get('false_values')
        self.as_recarray = kwds.get('as_recarray', False)
        self.tupleize_cols = kwds.get('tupleize_cols', False)
        self.mangle_dupe_cols = kwds.get('mangle_dupe_cols', True)
        self.infer_datetime_format = kwds.pop('infer_datetime_format', False)

        self._date_conv = _make_date_converter(
            date_parser=self.date_parser,
            dayfirst=self.dayfirst,
            infer_datetime_format=self.infer_datetime_format
        )

        # validate header options for mi
        self.header = kwds.get('header')
        if isinstance(self.header, (list, tuple, np.ndarray)):
            if kwds.get('as_recarray'):
                raise ValueError("cannot specify as_recarray when "
                                 "specifying a multi-index header")
            if kwds.get('usecols'):
                raise ValueError("cannot specify usecols when "
                                 "specifying a multi-index header")
            if kwds.get('names'):
                raise ValueError("cannot specify names when "
                                 "specifying a multi-index header")

            # validate index_col that only contains integers
            if self.index_col is not None:
                is_sequence = isinstance(self.index_col, (list, tuple,
                                                          np.ndarray))
                if not (is_sequence and
                        all(map(is_integer, self.index_col)) or
                        is_integer(self.index_col)):
                    raise ValueError("index_col must only contain row numbers "
                                     "when specifying a multi-index header")

        self._name_processed = False

        self._first_chunk = True

        # GH 13932
        # keep references to file handles opened by the parser itself
        self.handles = []

    def close(self):
        for f in self.handles:
            f.close()

    @property
    def _has_complex_date_col(self):
        return (isinstance(self.parse_dates, dict) or
                (isinstance(self.parse_dates, list) and
                 len(self.parse_dates) > 0 and
                 isinstance(self.parse_dates[0], list)))

    def _should_parse_dates(self, i):
        if isinstance(self.parse_dates, bool):
            return self.parse_dates
        else:
            if self.index_names is not None:
                name = self.index_names[i]
            else:
                name = None
            j = self.index_col[i]

            if is_scalar(self.parse_dates):
                return ((j == self.parse_dates) or
                        (name is not None and name == self.parse_dates))
            else:
                return ((j in self.parse_dates) or
                        (name is not None and name in self.parse_dates))

    def _extract_multi_indexer_columns(self, header, index_names, col_names,
                                       passed_names=False):
        """ extract and return the names, index_names, col_names
            header is a list-of-lists returned from the parsers """
        if len(header) < 2:
            return header[0], index_names, col_names, passed_names

        # the names are the tuples of the header that are not the index cols
        # 0 is the name of the index, assuming index_col is a list of column
        # numbers
        ic = self.index_col
        if ic is None:
            ic = []

        if not isinstance(ic, (list, tuple, np.ndarray)):
            ic = [ic]
        sic = set(ic)

        # clean the index_names
        index_names = header.pop(-1)
        index_names, names, index_col = _clean_index_names(index_names,
                                                           self.index_col)

        # extract the columns
        field_count = len(header[0])

        def extract(r):
            return tuple([r[i] for i in range(field_count) if i not in sic])

        columns = lzip(*[extract(r) for r in header])
        names = ic + columns

        def tostr(x):
            return str(x) if not isinstance(x, compat.string_types) else x

        # if we find 'Unnamed' all of a single level, then our header was too
        # long
        for n in range(len(columns[0])):
            if all(['Unnamed' in tostr(c[n]) for c in columns]):
                raise ParserError(
                    "Passed header=[%s] are too many rows for this "
                    "multi_index of columns"
                    % ','.join([str(x) for x in self.header])
                )

        # clean the column names (if we have an index_col)
        if len(ic):
            col_names = [r[0] if len(r[0]) and 'Unnamed' not in r[0] else None
                         for r in header]
        else:
            col_names = [None] * len(header)

        passed_names = True

        return names, index_names, col_names, passed_names

    def _maybe_dedup_names(self, names):
        # see gh-7160 and gh-9424: this helps to provide
        # immediate alleviation of the duplicate names
        # issue and appears to be satisfactory to users,
        # but ultimately, not needing to butcher the names
        # would be nice!
        if self.mangle_dupe_cols:
            names = list(names)  # so we can index
            counts = {}

            for i, col in enumerate(names):
                cur_count = counts.get(col, 0)

                if cur_count > 0:
                    names[i] = '%s.%d' % (col, cur_count)

                counts[col] = cur_count + 1

        return names

    def _maybe_make_multi_index_columns(self, columns, col_names=None):
        # possibly create a column mi here
        if (not self.tupleize_cols and len(columns) and
                not isinstance(columns, MultiIndex) and
                all([isinstance(c, tuple) for c in columns])):
            columns = MultiIndex.from_tuples(columns, names=col_names)
        return columns

    def _make_index(self, data, alldata, columns, indexnamerow=False):
        if not _is_index_col(self.index_col) or not self.index_col:
            index = None

        elif not self._has_complex_date_col:
            index = self._get_simple_index(alldata, columns)
            index = self._agg_index(index)

        elif self._has_complex_date_col:
            if not self._name_processed:
                (self.index_names, _,
                 self.index_col) = _clean_index_names(list(columns),
                                                      self.index_col)
                self._name_processed = True
            index = self._get_complex_date_index(data, columns)
            index = self._agg_index(index, try_parse_dates=False)

        # add names for the index
        if indexnamerow:
            coffset = len(indexnamerow) - len(columns)
            index = index.set_names(indexnamerow[:coffset])

        # maybe create a mi on the columns
        columns = self._maybe_make_multi_index_columns(columns, self.col_names)

        return index, columns

    _implicit_index = False

    def _get_simple_index(self, data, columns):
        def ix(col):
            if not isinstance(col, compat.string_types):
                return col
            raise ValueError('Index %s invalid' % col)
        index = None

        to_remove = []
        index = []
        for idx in self.index_col:
            i = ix(idx)
            to_remove.append(i)
            index.append(data[i])

        # remove index items from content and columns, don't pop in
        # loop
        for i in reversed(sorted(to_remove)):
            data.pop(i)
            if not self._implicit_index:
                columns.pop(i)

        return index

    def _get_complex_date_index(self, data, col_names):
        def _get_name(icol):
            if isinstance(icol, compat.string_types):
                return icol

            if col_names is None:
                raise ValueError(('Must supply column order to use %s as '
                                  'index') % str(icol))

            for i, c in enumerate(col_names):
                if i == icol:
                    return c

        index = None

        to_remove = []
        index = []
        for idx in self.index_col:
            name = _get_name(idx)
            to_remove.append(name)
            index.append(data[name])

        # remove index items from content and columns, don't pop in
        # loop
        for c in reversed(sorted(to_remove)):
            data.pop(c)
            col_names.remove(c)

        return index

    def _agg_index(self, index, try_parse_dates=True):
        arrays = []

        for i, arr in enumerate(index):

            if (try_parse_dates and self._should_parse_dates(i)):
                arr = self._date_conv(arr)

            col_na_values = self.na_values
            col_na_fvalues = self.na_fvalues

            if isinstance(self.na_values, dict):
                col_name = self.index_names[i]
                if col_name is not None:
                    col_na_values, col_na_fvalues = _get_na_values(
                        col_name, self.na_values, self.na_fvalues)

            arr, _ = self._infer_types(arr, col_na_values | col_na_fvalues)
            arrays.append(arr)

        index = MultiIndex.from_arrays(arrays, names=self.index_names)

        return index

    def _convert_to_ndarrays(self, dct, na_values, na_fvalues, verbose=False,
                             converters=None, dtypes=None):
        result = {}
        for c, values in compat.iteritems(dct):
            conv_f = None if converters is None else converters.get(c, None)
            if isinstance(dtypes, dict):
                cast_type = dtypes.get(c, None)
            else:
                # single dtype or None
                cast_type = dtypes

            if self.na_filter:
                col_na_values, col_na_fvalues = _get_na_values(
                    c, na_values, na_fvalues)
            else:
                col_na_values, col_na_fvalues = set(), set()

            if conv_f is not None:
                # conv_f applied to data before inference
                if cast_type is not None:
                    warnings.warn(("Both a converter and dtype were specified "
                                   "for column {0} - only the converter will "
                                   "be used").format(c), ParserWarning,
                                  stacklevel=7)

                try:
                    values = lib.map_infer(values, conv_f)
                except ValueError:
                    mask = algorithms.isin(
                        values, list(na_values)).view(np.uint8)
                    values = lib.map_infer_mask(values, conv_f, mask)

                cvals, na_count = self._infer_types(
                    values, set(col_na_values) | col_na_fvalues,
                    try_num_bool=False)
            else:
                # skip inference if specified dtype is object
                try_num_bool = not (cast_type and is_string_dtype(cast_type))

                # general type inference and conversion
                cvals, na_count = self._infer_types(
                    values, set(col_na_values) | col_na_fvalues,
                    try_num_bool)

                # type specificed in dtype param
                if cast_type and not is_dtype_equal(cvals, cast_type):
                    cvals = self._cast_types(cvals, cast_type, c)

            if issubclass(cvals.dtype.type, np.integer) and self.compact_ints:
                cvals = lib.downcast_int64(
                    cvals, parsers.na_values,
                    self.use_unsigned)

            result[c] = cvals
            if verbose and na_count:
                print('Filled %d NA values in column %s' % (na_count, str(c)))
        return result

    def _infer_types(self, values, na_values, try_num_bool=True):
        """
        Infer types of values, possibly casting

        Parameters
        ----------
        values : ndarray
        na_values : set
        try_num_bool : bool, default try
           try to cast values to numeric (first preference) or boolean

        Returns:
        --------
        converted : ndarray
        na_count : int
        """

        na_count = 0
        if issubclass(values.dtype.type, (np.number, np.bool_)):
            mask = algorithms.isin(values, list(na_values))
            na_count = mask.sum()
            if na_count > 0:
                if is_integer_dtype(values):
                    values = values.astype(np.float64)
                np.putmask(values, mask, np.nan)
            return values, na_count

        if try_num_bool:
            try:
                result = lib.maybe_convert_numeric(values, na_values, False)
                na_count = isnull(result).sum()
            except Exception:
                result = values
                if values.dtype == np.object_:
                    na_count = lib.sanitize_objects(result, na_values, False)
        else:
            result = values
            if values.dtype == np.object_:
                na_count = lib.sanitize_objects(values, na_values, False)

        if result.dtype == np.object_ and try_num_bool:
            result = lib.maybe_convert_bool(values,
                                            true_values=self.true_values,
                                            false_values=self.false_values)

        return result, na_count

    def _cast_types(self, values, cast_type, column):
        """
        Cast values to specified type

        Parameters
        ----------
        values : ndarray
        cast_type : string or np.dtype
           dtype to cast values to
        column : string
            column name - used only for error reporting

        Returns
        -------
        converted : ndarray
        """

        if is_categorical_dtype(cast_type):
            # XXX this is for consistency with
            # c-parser which parses all categories
            # as strings
            if not is_object_dtype(values):
                values = astype_nansafe(values, str)
            values = Categorical(values)
        else:
            try:
                values = astype_nansafe(values, cast_type, copy=True)
            except ValueError:
                raise ValueError("Unable to convert column %s to "
                                 "type %s" % (column, cast_type))
        return values

    def _do_date_conversions(self, names, data):
        # returns data, columns

        if self.parse_dates is not None:
            data, names = _process_date_conversion(
                data, self._date_conv, self.parse_dates, self.index_col,
                self.index_names, names, keep_date_col=self.keep_date_col)

        return names, data


class CParserWrapper(ParserBase):
    """

    """

    def __init__(self, src, **kwds):
        self.kwds = kwds
        kwds = kwds.copy()

        ParserBase.__init__(self, kwds)

        if 'utf-16' in (kwds.get('encoding') or ''):
            if isinstance(src, compat.string_types):
                src = open(src, 'rb')
                self.handles.append(src)
            src = UTF8Recoder(src, kwds['encoding'])
            kwds['encoding'] = 'utf-8'

        # #2442
        kwds['allow_leading_cols'] = self.index_col is not False

        self._reader = parsers.TextReader(src, **kwds)

        # XXX
        self.usecols, self.usecols_dtype = _validate_usecols_arg(
            self._reader.usecols)

        passed_names = self.names is None

        if self._reader.header is None:
            self.names = None
        else:
            if len(self._reader.header) > 1:
                # we have a multi index in the columns
                self.names, self.index_names, self.col_names, passed_names = (
                    self._extract_multi_indexer_columns(
                        self._reader.header, self.index_names, self.col_names,
                        passed_names
                    )
                )
            else:
                self.names = list(self._reader.header[0])

        if self.names is None:
            if self.prefix:
                self.names = ['%s%d' % (self.prefix, i)
                              for i in range(self._reader.table_width)]
            else:
                self.names = lrange(self._reader.table_width)

        # gh-9755
        #
        # need to set orig_names here first
        # so that proper indexing can be done
        # with _set_noconvert_columns
        #
        # once names has been filtered, we will
        # then set orig_names again to names
        self.orig_names = self.names[:]

        if self.usecols:
            usecols = _evaluate_usecols(self.usecols, self.orig_names)

            # GH 14671
            if (self.usecols_dtype == 'string' and
                    not set(usecols).issubset(self.orig_names)):
                raise ValueError("Usecols do not match names.")

            if len(self.names) > len(usecols):
                self.names = [n for i, n in enumerate(self.names)
                              if (i in usecols or n in usecols)]

            if len(self.names) < len(usecols):
                raise ValueError("Usecols do not match names.")

        self._set_noconvert_columns()

        self.orig_names = self.names

        if not self._has_complex_date_col:
            if (self._reader.leading_cols == 0 and
                    _is_index_col(self.index_col)):

                self._name_processed = True
                (index_names, self.names,
                 self.index_col) = _clean_index_names(self.names,
                                                      self.index_col)

                if self.index_names is None:
                    self.index_names = index_names

            if self._reader.header is None and not passed_names:
                self.index_names = [None] * len(self.index_names)

        self._implicit_index = self._reader.leading_cols > 0

    def close(self):
        for f in self.handles:
            f.close()

        # close additional handles opened by C parser (for compression)
        try:
            self._reader.close()
        except:
            pass

    def _set_noconvert_columns(self):
        """
        Set the columns that should not undergo dtype conversions.

        Currently, any column that is involved with date parsing will not
        undergo such conversions.
        """
        names = self.orig_names
        if self.usecols_dtype == 'integer':
            # A set of integers will be converted to a list in
            # the correct order every single time.
            usecols = list(self.usecols)
        elif (callable(self.usecols) or
                self.usecols_dtype not in ('empty', None)):
            # The names attribute should have the correct columns
            # in the proper order for indexing with parse_dates.
            usecols = self.names[:]
        else:
            # Usecols is empty.
            usecols = None

        def _set(x):
            if usecols is not None and is_integer(x):
                x = usecols[x]

            if not is_integer(x):
                x = names.index(x)

            self._reader.set_noconvert(x)

        if isinstance(self.parse_dates, list):
            for val in self.parse_dates:
                if isinstance(val, list):
                    for k in val:
                        _set(k)
                else:
                    _set(val)

        elif isinstance(self.parse_dates, dict):
            for val in self.parse_dates.values():
                if isinstance(val, list):
                    for k in val:
                        _set(k)
                else:
                    _set(val)

        elif self.parse_dates:
            if isinstance(self.index_col, list):
                for k in self.index_col:
                    _set(k)
            elif self.index_col is not None:
                _set(self.index_col)

    def set_error_bad_lines(self, status):
        self._reader.set_error_bad_lines(int(status))

    def read(self, nrows=None):
        try:
            data = self._reader.read(nrows)
        except StopIteration:
            if self._first_chunk:
                self._first_chunk = False
                names = self._maybe_dedup_names(self.orig_names)
                index, columns, col_dict = _get_empty_meta(
                    names, self.index_col, self.index_names,
                    dtype=self.kwds.get('dtype'))
                columns = self._maybe_make_multi_index_columns(
                    columns, self.col_names)

                if self.usecols is not None:
                    columns = self._filter_usecols(columns)

                col_dict = dict(filter(lambda item: item[0] in columns,
                                       col_dict.items()))

                return index, columns, col_dict

            else:
                raise

        # Done with first read, next time raise StopIteration
        self._first_chunk = False

        if self.as_recarray:
            # what to do if there are leading columns?
            return data

        names = self.names

        if self._reader.leading_cols:
            if self._has_complex_date_col:
                raise NotImplementedError('file structure not yet supported')

            # implicit index, no index names
            arrays = []

            for i in range(self._reader.leading_cols):
                if self.index_col is None:
                    values = data.pop(i)
                else:
                    values = data.pop(self.index_col[i])

                values = self._maybe_parse_dates(values, i,
                                                 try_parse_dates=True)
                arrays.append(values)

            index = MultiIndex.from_arrays(arrays)

            if self.usecols is not None:
                names = self._filter_usecols(names)

            names = self._maybe_dedup_names(names)

            # rename dict keys
            data = sorted(data.items())
            data = dict((k, v) for k, (i, v) in zip(names, data))

            names, data = self._do_date_conversions(names, data)

        else:
            # rename dict keys
            data = sorted(data.items())

            # ugh, mutation
            names = list(self.orig_names)
            names = self._maybe_dedup_names(names)

            if self.usecols is not None:
                names = self._filter_usecols(names)

            # columns as list
            alldata = [x[1] for x in data]

            data = dict((k, v) for k, (i, v) in zip(names, data))

            names, data = self._do_date_conversions(names, data)
            index, names = self._make_index(data, alldata, names)

        # maybe create a mi on the columns
        names = self._maybe_make_multi_index_columns(names, self.col_names)

        return index, names, data

    def _filter_usecols(self, names):
        # hackish
        usecols = _evaluate_usecols(self.usecols, names)
        if usecols is not None and len(names) != len(usecols):
            names = [name for i, name in enumerate(names)
                     if i in usecols or name in usecols]
        return names

    def _get_index_names(self):
        names = list(self._reader.header[0])
        idx_names = None

        if self._reader.leading_cols == 0 and self.index_col is not None:
            (idx_names, names,
             self.index_col) = _clean_index_names(names, self.index_col)

        return names, idx_names

    def _maybe_parse_dates(self, values, index, try_parse_dates=True):
        if try_parse_dates and self._should_parse_dates(index):
            values = self._date_conv(values)
        return values


def TextParser(*args, **kwds):
    """
    Converts lists of lists/tuples into DataFrames with proper type inference
    and optional (e.g. string to datetime) conversion. Also enables iterating
    lazily over chunks of large files

    Parameters
    ----------
    data : file-like object or list
    delimiter : separator character to use
    dialect : str or csv.Dialect instance, default None
        Ignored if delimiter is longer than 1 character
    names : sequence, default
    header : int, default 0
        Row to use to parse column labels. Defaults to the first row. Prior
        rows will be discarded
    index_col : int or list, default None
        Column or columns to use as the (possibly hierarchical) index
    has_index_names: boolean, default False
        True if the cols defined in index_col have an index name and are
        not in the header
    na_values : scalar, str, list-like, or dict, default None
        Additional strings to recognize as NA/NaN.
    keep_default_na : bool, default True
    thousands : str, default None
        Thousands separator
    comment : str, default None
        Comment out remainder of line
    parse_dates : boolean, default False
    keep_date_col : boolean, default False
    date_parser : function, default None
    skiprows : list of integers
        Row numbers to skip
    skipfooter : int
        Number of line at bottom of file to skip
    converters : dict, default None
        Dict of functions for converting values in certain columns. Keys can
        either be integers or column labels, values are functions that take one
        input argument, the cell (not column) content, and return the
        transformed content.
    encoding : string, default None
        Encoding to use for UTF when reading/writing (ex. 'utf-8')
    squeeze : boolean, default False
        returns Series if only one column
    infer_datetime_format: boolean, default False
        If True and `parse_dates` is True for a column, try to infer the
        datetime format based on the first datetime string. If the format
        can be inferred, there often will be a large parsing speed-up.
    float_precision : string, default None
        Specifies which converter the C engine should use for floating-point
        values. The options are None for the ordinary converter,
        'high' for the high-precision converter, and 'round_trip' for the
        round-trip converter.
    """
    kwds['engine'] = 'python'
    return TextFileReader(*args, **kwds)


def count_empty_vals(vals):
    return sum([1 for v in vals if v == '' or v is None])


class PythonParser(ParserBase):

    def __init__(self, f, **kwds):
        """
        Workhorse function for processing nested list into DataFrame

        Should be replaced by np.genfromtxt eventually?
        """
        ParserBase.__init__(self, kwds)

        self.data = None
        self.buf = []
        self.pos = 0
        self.line_pos = 0

        self.encoding = kwds['encoding']
        self.compression = kwds['compression']
        self.memory_map = kwds['memory_map']
        self.skiprows = kwds['skiprows']

        if callable(self.skiprows):
            self.skipfunc = self.skiprows
        else:
            self.skipfunc = lambda x: x in self.skiprows

        self.skipfooter = _validate_skipfooter_arg(kwds['skipfooter'])
        self.delimiter = kwds['delimiter']

        self.quotechar = kwds['quotechar']
        if isinstance(self.quotechar, compat.text_type):
            self.quotechar = str(self.quotechar)

        self.escapechar = kwds['escapechar']
        self.doublequote = kwds['doublequote']
        self.skipinitialspace = kwds['skipinitialspace']
        self.lineterminator = kwds['lineterminator']
        self.quoting = kwds['quoting']
        self.usecols, _ = _validate_usecols_arg(kwds['usecols'])
        self.skip_blank_lines = kwds['skip_blank_lines']

        self.warn_bad_lines = kwds['warn_bad_lines']
        self.error_bad_lines = kwds['error_bad_lines']

        self.names_passed = kwds['names'] or None

        self.na_filter = kwds['na_filter']

        self.has_index_names = False
        if 'has_index_names' in kwds:
            self.has_index_names = kwds['has_index_names']

        self.verbose = kwds['verbose']
        self.converters = kwds['converters']
        self.dtype = kwds['dtype']

        self.compact_ints = kwds['compact_ints']
        self.use_unsigned = kwds['use_unsigned']
        self.thousands = kwds['thousands']
        self.decimal = kwds['decimal']

        self.comment = kwds['comment']
        self._comment_lines = []

        f, handles = _get_handle(f, 'r', encoding=self.encoding,
                                 compression=self.compression,
                                 memory_map=self.memory_map)
        self.handles.extend(handles)

        # Set self.data to something that can read lines.
        if hasattr(f, 'readline'):
            self._make_reader(f)
        else:
            self.data = f

        # Get columns in two steps: infer from data, then
        # infer column indices from self.usecols if is is specified.
        self._col_indices = None
        self.columns, self.num_original_columns = self._infer_columns()

        # Now self.columns has the set of columns that we will process.
        # The original set is stored in self.original_columns.
        if len(self.columns) > 1:
            # we are processing a multi index column
            self.columns, self.index_names, self.col_names, _ = (
                self._extract_multi_indexer_columns(
                    self.columns, self.index_names, self.col_names
                )
            )
            # Update list of original names to include all indices.
            self.num_original_columns = len(self.columns)
        else:
            self.columns = self.columns[0]

        # get popped off for index
        self.orig_names = list(self.columns)

        # needs to be cleaned/refactored
        # multiple date column thing turning into a real spaghetti factory

        if not self._has_complex_date_col:
            (index_names, self.orig_names, self.columns) = (
                self._get_index_name(self.columns))
            self._name_processed = True
            if self.index_names is None:
                self.index_names = index_names

        if self.parse_dates:
            self._no_thousands_columns = self._set_no_thousands_columns()
        else:
            self._no_thousands_columns = None

        if len(self.decimal) != 1:
            raise ValueError('Only length-1 decimal markers supported')

        if self.thousands is None:
            self.nonnum = re.compile('[^-^0-9^%s]+' % self.decimal)
        else:
            self.nonnum = re.compile('[^-^0-9^%s^%s]+' % (self.thousands,
                                                          self.decimal))

    def _set_no_thousands_columns(self):
        # Create a set of column ids that are not to be stripped of thousands
        # operators.
        noconvert_columns = set()

        def _set(x):
            if is_integer(x):
                noconvert_columns.add(x)
            else:
                noconvert_columns.add(self.columns.index(x))

        if isinstance(self.parse_dates, list):
            for val in self.parse_dates:
                if isinstance(val, list):
                    for k in val:
                        _set(k)
                else:
                    _set(val)

        elif isinstance(self.parse_dates, dict):
            for val in self.parse_dates.values():
                if isinstance(val, list):
                    for k in val:
                        _set(k)
                else:
                    _set(val)

        elif self.parse_dates:
            if isinstance(self.index_col, list):
                for k in self.index_col:
                    _set(k)
            elif self.index_col is not None:
                _set(self.index_col)

        return noconvert_columns

    def _make_reader(self, f):
        sep = self.delimiter

        if sep is None or len(sep) == 1:
            if self.lineterminator:
                raise ValueError('Custom line terminators not supported in '
                                 'python parser (yet)')

            class MyDialect(csv.Dialect):
                delimiter = self.delimiter
                quotechar = self.quotechar
                escapechar = self.escapechar
                doublequote = self.doublequote
                skipinitialspace = self.skipinitialspace
                quoting = self.quoting
                lineterminator = '\n'

            dia = MyDialect

            sniff_sep = True

            if sep is not None:
                sniff_sep = False
                dia.delimiter = sep
            # attempt to sniff the delimiter
            if sniff_sep:
                line = f.readline()
                while self.skipfunc(self.pos):
                    self.pos += 1
                    line = f.readline()

                line = self._check_comments([line])[0]

                self.pos += 1
                self.line_pos += 1
                sniffed = csv.Sniffer().sniff(line)
                dia.delimiter = sniffed.delimiter
                if self.encoding is not None:
                    self.buf.extend(list(
                        UnicodeReader(StringIO(line),
                                      dialect=dia,
                                      encoding=self.encoding)))
                else:
                    self.buf.extend(list(csv.reader(StringIO(line),
                                                    dialect=dia)))

            if self.encoding is not None:
                reader = UnicodeReader(f, dialect=dia,
                                       encoding=self.encoding,
                                       strict=True)
            else:
                reader = csv.reader(f, dialect=dia,
                                    strict=True)

        else:
            def _read():
                line = f.readline()

                if compat.PY2 and self.encoding:
                    line = line.decode(self.encoding)

                pat = re.compile(sep)
                yield pat.split(line.strip())
                for line in f:
                    yield pat.split(line.strip())
            reader = _read()

        self.data = reader

    def read(self, rows=None):
        try:
            content = self._get_lines(rows)
        except StopIteration:
            if self._first_chunk:
                content = []
            else:
                raise

        # done with first read, next time raise StopIteration
        self._first_chunk = False

        columns = list(self.orig_names)
        if not len(content):  # pragma: no cover
            # DataFrame with the right metadata, even though it's length 0
            names = self._maybe_dedup_names(self.orig_names)
            index, columns, col_dict = _get_empty_meta(
                names, self.index_col, self.index_names, self.dtype)
            columns = self._maybe_make_multi_index_columns(
                columns, self.col_names)
            return index, columns, col_dict

        # handle new style for names in index
        count_empty_content_vals = count_empty_vals(content[0])
        indexnamerow = None
        if self.has_index_names and count_empty_content_vals == len(columns):
            indexnamerow = content[0]
            content = content[1:]

        alldata = self._rows_to_cols(content)
        data = self._exclude_implicit_index(alldata)

        columns = self._maybe_dedup_names(self.columns)
        columns, data = self._do_date_conversions(columns, data)

        data = self._convert_data(data)
        if self.as_recarray:
            return self._to_recarray(data, columns)

        index, columns = self._make_index(data, alldata, columns, indexnamerow)

        return index, columns, data

    def _exclude_implicit_index(self, alldata):
        names = self._maybe_dedup_names(self.orig_names)

        if self._implicit_index:
            excl_indices = self.index_col

            data = {}
            offset = 0
            for i, col in enumerate(names):
                while i + offset in excl_indices:
                    offset += 1
                data[col] = alldata[i + offset]
        else:
            data = dict((k, v) for k, v in zip(names, alldata))

        return data

    # legacy
    def get_chunk(self, size=None):
        if size is None:
            size = self.chunksize
        return self.read(nrows=size)

    def _convert_data(self, data):
        # apply converters
        def _clean_mapping(mapping):
            "converts col numbers to names"
            clean = {}
            for col, v in compat.iteritems(mapping):
                if isinstance(col, int) and col not in self.orig_names:
                    col = self.orig_names[col]
                clean[col] = v
            return clean

        clean_conv = _clean_mapping(self.converters)
        if not isinstance(self.dtype, dict):
            # handles single dtype applied to all columns
            clean_dtypes = self.dtype
        else:
            clean_dtypes = _clean_mapping(self.dtype)

        # Apply NA values.
        clean_na_values = {}
        clean_na_fvalues = {}

        if isinstance(self.na_values, dict):
            for col in self.na_values:
                na_value = self.na_values[col]
                na_fvalue = self.na_fvalues[col]

                if isinstance(col, int) and col not in self.orig_names:
                    col = self.orig_names[col]

                clean_na_values[col] = na_value
                clean_na_fvalues[col] = na_fvalue
        else:
            clean_na_values = self.na_values
            clean_na_fvalues = self.na_fvalues

        return self._convert_to_ndarrays(data, clean_na_values,
                                         clean_na_fvalues, self.verbose,
                                         clean_conv, clean_dtypes)

    def _to_recarray(self, data, columns):
        dtypes = []
        o = compat.OrderedDict()

        # use the columns to "order" the keys
        # in the unordered 'data' dictionary
        for col in columns:
            dtypes.append((str(col), data[col].dtype))
            o[col] = data[col]

        tuples = lzip(*o.values())
        return np.array(tuples, dtypes)

    def _infer_columns(self):
        names = self.names
        num_original_columns = 0
        clear_buffer = True
        if self.header is not None:
            header = self.header

            # we have a mi columns, so read an extra line
            if isinstance(header, (list, tuple, np.ndarray)):
                have_mi_columns = True
                header = list(header) + [header[-1] + 1]
            else:
                have_mi_columns = False
                header = [header]

            columns = []
            for level, hr in enumerate(header):
                try:
                    line = self._buffered_line()

                    while self.line_pos <= hr:
                        line = self._next_line()

                except StopIteration:
                    if self.line_pos < hr:
                        raise ValueError(
                            'Passed header=%s but only %d lines in file'
                            % (hr, self.line_pos + 1))

                    # We have an empty file, so check
                    # if columns are provided. That will
                    # serve as the 'line' for parsing
                    if have_mi_columns and hr > 0:
                        if clear_buffer:
                            self._clear_buffer()
                        columns.append([None] * len(columns[-1]))
                        return columns, num_original_columns

                    if not self.names:
                        raise EmptyDataError(
                            "No columns to parse from file")

                    line = self.names[:]

                unnamed_count = 0
                this_columns = []
                for i, c in enumerate(line):
                    if c == '':
                        if have_mi_columns:
                            this_columns.append('Unnamed: %d_level_%d'
                                                % (i, level))
                        else:
                            this_columns.append('Unnamed: %d' % i)
                        unnamed_count += 1
                    else:
                        this_columns.append(c)

                if not have_mi_columns and self.mangle_dupe_cols:
                    counts = {}
                    for i, col in enumerate(this_columns):
                        cur_count = counts.get(col, 0)
                        if cur_count > 0:
                            this_columns[i] = '%s.%d' % (col, cur_count)
                        counts[col] = cur_count + 1
                elif have_mi_columns:

                    # if we have grabbed an extra line, but its not in our
                    # format so save in the buffer, and create an blank extra
                    # line for the rest of the parsing code
                    if hr == header[-1]:
                        lc = len(this_columns)
                        ic = (len(self.index_col)
                              if self.index_col is not None else 0)
                        if lc != unnamed_count and lc - ic > unnamed_count:
                            clear_buffer = False
                            this_columns = [None] * lc
                            self.buf = [self.buf[-1]]

                columns.append(this_columns)
                if len(columns) == 1:
                    num_original_columns = len(this_columns)

            if clear_buffer:
                self._clear_buffer()

            if names is not None:
                if ((self.usecols is not None and
                     len(names) != len(self.usecols)) or
                    (self.usecols is None and
                     len(names) != len(columns[0]))):
                    raise ValueError('Number of passed names did not match '
                                     'number of header fields in the file')
                if len(columns) > 1:
                    raise TypeError('Cannot pass names with multi-index '
                                    'columns')

                if self.usecols is not None:
                    # Set _use_cols. We don't store columns because they are
                    # overwritten.
                    self._handle_usecols(columns, names)
                else:
                    self._col_indices = None
                    num_original_columns = len(names)
                columns = [names]
            else:
                columns = self._handle_usecols(columns, columns[0])
        else:
            try:
                line = self._buffered_line()

            except StopIteration:
                if not names:
                    raise EmptyDataError(
                        "No columns to parse from file")

                line = names[:]

            ncols = len(line)
            num_original_columns = ncols

            if not names:
                if self.prefix:
                    columns = [['%s%d' % (self.prefix, i)
                                for i in range(ncols)]]
                else:
                    columns = [lrange(ncols)]
                columns = self._handle_usecols(columns, columns[0])
            else:
                if self.usecols is None or len(names) >= num_original_columns:
                    columns = self._handle_usecols([names], names)
                    num_original_columns = len(names)
                else:
                    if (not callable(self.usecols) and
                            len(names) != len(self.usecols)):
                        raise ValueError(
                            'Number of passed names did not match number of '
                            'header fields in the file'
                        )
                    # Ignore output but set used columns.
                    self._handle_usecols([names], names)
                    columns = [names]
                    num_original_columns = ncols

        return columns, num_original_columns

    def _handle_usecols(self, columns, usecols_key):
        """
        Sets self._col_indices

        usecols_key is used if there are string usecols.
        """
        if self.usecols is not None:
            if callable(self.usecols):
                col_indices = _evaluate_usecols(self.usecols, usecols_key)
            elif any([isinstance(u, string_types) for u in self.usecols]):
                if len(columns) > 1:
                    raise ValueError("If using multiple headers, usecols must "
                                     "be integers.")
                col_indices = []
                for col in self.usecols:
                    if isinstance(col, string_types):
                        col_indices.append(usecols_key.index(col))
                    else:
                        col_indices.append(col)
            else:
                col_indices = self.usecols

            columns = [[n for i, n in enumerate(column) if i in col_indices]
                       for column in columns]
            self._col_indices = col_indices
        return columns

    def _buffered_line(self):
        """
        Return a line from buffer, filling buffer if required.
        """
        if len(self.buf) > 0:
            return self.buf[0]
        else:
            return self._next_line()

    def _check_for_bom(self, first_row):
        """
        Checks whether the file begins with the BOM character.
        If it does, remove it. In addition, if there is quoting
        in the field subsequent to the BOM, remove it as well
        because it technically takes place at the beginning of
        the name, not the middle of it.
        """
        # first_row will be a list, so we need to check
        # that that list is not empty before proceeding.
        if not first_row:
            return first_row

        # The first element of this row is the one that could have the
        # BOM that we want to remove. Check that the first element is a
        # string before proceeding.
        if not isinstance(first_row[0], compat.string_types):
            return first_row

        # Check that the string is not empty, as that would
        # obviously not have a BOM at the start of it.
        if not first_row[0]:
            return first_row

        # Since the string is non-empty, check that it does
        # in fact begin with a BOM.
        first_elt = first_row[0][0]

        # This is to avoid warnings we get in Python 2.x if
        # we find ourselves comparing with non-Unicode
        if compat.PY2 and not isinstance(first_elt, unicode):  # noqa
            try:
                first_elt = u(first_elt)
            except UnicodeDecodeError:
                return first_row

        if first_elt != _BOM:
            return first_row

        first_row = first_row[0]

        if len(first_row) > 1 and first_row[1] == self.quotechar:
            start = 2
            quote = first_row[1]
            end = first_row[2:].index(quote) + 2

            # Extract the data between the quotation marks
            new_row = first_row[start:end]

            # Extract any remaining data after the second
            # quotation mark.
            if len(first_row) > end + 1:
                new_row += first_row[end + 1:]
            return [new_row]
        elif len(first_row) > 1:
            return [first_row[1:]]
        else:
            # First row is just the BOM, so we
            # return an empty string.
            return [""]

    def _is_line_empty(self, line):
        """
        Check if a line is empty or not.

        Parameters
        ----------
        line : str, array-like
            The line of data to check.

        Returns
        -------
        boolean : Whether or not the line is empty.
        """
        return not line or all(not x for x in line)

    def _next_line(self):
        if isinstance(self.data, list):
            while self.skipfunc(self.pos):
                self.pos += 1

            while True:
                try:
                    line = self._check_comments([self.data[self.pos]])[0]
                    self.pos += 1
                    # either uncommented or blank to begin with
                    if (not self.skip_blank_lines and
                            (self._is_line_empty(
                                self.data[self.pos - 1]) or line)):
                        break
                    elif self.skip_blank_lines:
                        ret = self._remove_empty_lines([line])
                        if ret:
                            line = ret[0]
                            break
                except IndexError:
                    raise StopIteration
        else:
            while self.skipfunc(self.pos):
                self.pos += 1
                next(self.data)

            while True:
                orig_line = self._next_iter_line(row_num=self.pos + 1)
                self.pos += 1

                if orig_line is not None:
                    line = self._check_comments([orig_line])[0]

                    if self.skip_blank_lines:
                        ret = self._remove_empty_lines([line])

                        if ret:
                            line = ret[0]
                            break
                    elif self._is_line_empty(orig_line) or line:
                        break

        # This was the first line of the file,
        # which could contain the BOM at the
        # beginning of it.
        if self.pos == 1:
            line = self._check_for_bom(line)

        self.line_pos += 1
        self.buf.append(line)
        return line

    def _alert_malformed(self, msg, row_num):
        """
        Alert a user about a malformed row.

        If `self.error_bad_lines` is True, the alert will be `ParserError`.
        If `self.warn_bad_lines` is True, the alert will be printed out.

        Parameters
        ----------
        msg : The error message to display.
        row_num : The row number where the parsing error occurred.
                  Because this row number is displayed, we 1-index,
                  even though we 0-index internally.
        """

        if self.error_bad_lines:
            raise ParserError(msg)
        elif self.warn_bad_lines:
            base = 'Skipping line {row_num}: '.format(row_num=row_num)
            sys.stderr.write(base + msg + '\n')

    def _next_iter_line(self, row_num):
        """
        Wrapper around iterating through `self.data` (CSV source).

        When a CSV error is raised, we check for specific
        error messages that allow us to customize the
        error message displayed to the user.

        Parameters
        ----------
        row_num : The row number of the line being parsed.
        """

        try:
            return next(self.data)
        except csv.Error as e:
            if self.warn_bad_lines or self.error_bad_lines:
                msg = str(e)

                if 'NULL byte' in msg:
                    msg = ('NULL byte detected. This byte '
                           'cannot be processed in Python\'s '
                           'native csv library at the moment, '
                           'so please pass in engine=\'c\' instead')
                elif 'newline inside string' in msg:
                    msg = ('EOF inside string starting with '
                           'line ' + str(row_num))

                if self.skipfooter > 0:
                    reason = ('Error could possibly be due to '
                              'parsing errors in the skipped footer rows '
                              '(the skipfooter keyword is only applied '
                              'after Python\'s csv library has parsed '
                              'all rows).')
                    msg += '. ' + reason

                self._alert_malformed(msg, row_num)
            return None

    def _check_comments(self, lines):
        if self.comment is None:
            return lines
        ret = []
        for l in lines:
            rl = []
            for x in l:
                if (not isinstance(x, compat.string_types) or
                        self.comment not in x):
                    rl.append(x)
                else:
                    x = x[:x.find(self.comment)]
                    if len(x) > 0:
                        rl.append(x)
                    break
            ret.append(rl)
        return ret

    def _remove_empty_lines(self, lines):
        """
        Iterate through the lines and remove any that are
        either empty or contain only one whitespace value

        Parameters
        ----------
        lines : array-like
            The array of lines that we are to filter.

        Returns
        -------
        filtered_lines : array-like
            The same array of lines with the "empty" ones removed.
        """

        ret = []
        for l in lines:
            # Remove empty lines and lines with only one whitespace value
            if (len(l) > 1 or len(l) == 1 and
                    (not isinstance(l[0], compat.string_types) or
                     l[0].strip())):
                ret.append(l)
        return ret

    def _check_thousands(self, lines):
        if self.thousands is None:
            return lines

        return self._search_replace_num_columns(lines=lines,
                                                search=self.thousands,
                                                replace='')

    def _search_replace_num_columns(self, lines, search, replace):
        ret = []
        for l in lines:
            rl = []
            for i, x in enumerate(l):
                if (not isinstance(x, compat.string_types) or
                    search not in x or
                    (self._no_thousands_columns and
                     i in self._no_thousands_columns) or
                        self.nonnum.search(x.strip())):
                    rl.append(x)
                else:
                    rl.append(x.replace(search, replace))
            ret.append(rl)
        return ret

    def _check_decimal(self, lines):
        if self.decimal == _parser_defaults['decimal']:
            return lines

        return self._search_replace_num_columns(lines=lines,
                                                search=self.decimal,
                                                replace='.')

    def _clear_buffer(self):
        self.buf = []

    _implicit_index = False

    def _get_index_name(self, columns):
        """
        Try several cases to get lines:

        0) There are headers on row 0 and row 1 and their
        total summed lengths equals the length of the next line.
        Treat row 0 as columns and row 1 as indices
        1) Look for implicit index: there are more columns
        on row 1 than row 0. If this is true, assume that row
        1 lists index columns and row 0 lists normal columns.
        2) Get index from the columns if it was listed.
        """
        orig_names = list(columns)
        columns = list(columns)

        try:
            line = self._next_line()
        except StopIteration:
            line = None

        try:
            next_line = self._next_line()
        except StopIteration:
            next_line = None

        # implicitly index_col=0 b/c 1 fewer column names
        implicit_first_cols = 0
        if line is not None:
            # leave it 0, #2442
            # Case 1
            if self.index_col is not False:
                implicit_first_cols = len(line) - self.num_original_columns

            # Case 0
            if next_line is not None:
                if len(next_line) == len(line) + self.num_original_columns:
                    # column and index names on diff rows
                    self.index_col = lrange(len(line))
                    self.buf = self.buf[1:]

                    for c in reversed(line):
                        columns.insert(0, c)

                    # Update list of original names to include all indices.
                    orig_names = list(columns)
                    self.num_original_columns = len(columns)
                    return line, orig_names, columns

        if implicit_first_cols > 0:
            # Case 1
            self._implicit_index = True
            if self.index_col is None:
                self.index_col = lrange(implicit_first_cols)

            index_name = None

        else:
            # Case 2
            (index_name, columns_,
             self.index_col) = _clean_index_names(columns, self.index_col)

        return index_name, orig_names, columns

    def _rows_to_cols(self, content):
        col_len = self.num_original_columns

        if self._implicit_index:
            col_len += len(self.index_col)

        max_len = max([len(row) for row in content])

        # Check that there are no rows with too many
        # elements in their row (rows with too few
        # elements are padded with NaN).
        if (max_len > col_len and
                self.index_col is not False and
                self.usecols is None):

            footers = self.skipfooter if self.skipfooter else 0
            bad_lines = []

            iter_content = enumerate(content)
            content_len = len(content)
            content = []

            for (i, l) in iter_content:
                actual_len = len(l)

                if actual_len > col_len:
                    if self.error_bad_lines or self.warn_bad_lines:
                        row_num = self.pos - (content_len - i + footers)
                        bad_lines.append((row_num, actual_len))

                        if self.error_bad_lines:
                            break
                else:
                    content.append(l)

            for row_num, actual_len in bad_lines:
                msg = ('Expected %d fields in line %d, saw %d' %
                       (col_len, row_num + 1, actual_len))
                if len(self.delimiter) > 1 and self.quoting != csv.QUOTE_NONE:
                    # see gh-13374
                    reason = ('Error could possibly be due to quotes being '
                              'ignored when a multi-char delimiter is used.')
                    msg += '. ' + reason

                self._alert_malformed(msg, row_num + 1)

        # see gh-13320
        zipped_content = list(lib.to_object_array(
            content, min_width=col_len).T)

        if self.usecols:
            if self._implicit_index:
                zipped_content = [
                    a for i, a in enumerate(zipped_content)
                    if (i < len(self.index_col) or
                        i - len(self.index_col) in self._col_indices)]
            else:
                zipped_content = [a for i, a in enumerate(zipped_content)
                                  if i in self._col_indices]
        return zipped_content

    def _get_lines(self, rows=None):
        lines = self.buf
        new_rows = None

        # already fetched some number
        if rows is not None:
            # we already have the lines in the buffer
            if len(self.buf) >= rows:
                new_rows, self.buf = self.buf[:rows], self.buf[rows:]

            # need some lines
            else:
                rows -= len(self.buf)

        if new_rows is None:
            if isinstance(self.data, list):
                if self.pos > len(self.data):
                    raise StopIteration
                if rows is None:
                    new_rows = self.data[self.pos:]
                    new_pos = len(self.data)
                else:
                    new_rows = self.data[self.pos:self.pos + rows]
                    new_pos = self.pos + rows

                # Check for stop rows. n.b.: self.skiprows is a set.
                if self.skiprows:
                    new_rows = [row for i, row in enumerate(new_rows)
                                if not self.skipfunc(i + self.pos)]

                lines.extend(new_rows)
                self.pos = new_pos

            else:
                new_rows = []
                try:
                    if rows is not None:
                        for _ in range(rows):
                            new_rows.append(next(self.data))
                        lines.extend(new_rows)
                    else:
                        rows = 0

                        while True:
                            new_row = self._next_iter_line(
                                row_num=self.pos + rows + 1)
                            rows += 1

                            if new_row is not None:
                                new_rows.append(new_row)

                except StopIteration:
                    if self.skiprows:
                        new_rows = [row for i, row in enumerate(new_rows)
                                    if not self.skipfunc(i + self.pos)]
                    lines.extend(new_rows)
                    if len(lines) == 0:
                        raise
                self.pos += len(new_rows)

            self.buf = []
        else:
            lines = new_rows

        if self.skipfooter:
            lines = lines[:-self.skipfooter]

        lines = self._check_comments(lines)
        if self.skip_blank_lines:
            lines = self._remove_empty_lines(lines)
        lines = self._check_thousands(lines)
        return self._check_decimal(lines)


def _make_date_converter(date_parser=None, dayfirst=False,
                         infer_datetime_format=False):
    def converter(*date_cols):
        if date_parser is None:
            strs = _concat_date_cols(date_cols)

            try:
                return tools.to_datetime(
                    _ensure_object(strs),
                    utc=None,
                    box=False,
                    dayfirst=dayfirst,
                    errors='ignore',
                    infer_datetime_format=infer_datetime_format
                )
            except:
                return tools.to_datetime(
                    lib.try_parse_dates(strs, dayfirst=dayfirst))
        else:
            try:
                result = tools.to_datetime(
                    date_parser(*date_cols), errors='ignore')
                if isinstance(result, datetime.datetime):
                    raise Exception('scalar parser')
                return result
            except Exception:
                try:
                    return tools.to_datetime(
                        lib.try_parse_dates(_concat_date_cols(date_cols),
                                            parser=date_parser,
                                            dayfirst=dayfirst),
                        errors='ignore')
                except Exception:
                    return generic_parser(date_parser, *date_cols)

    return converter


def _process_date_conversion(data_dict, converter, parse_spec,
                             index_col, index_names, columns,
                             keep_date_col=False):
    def _isindex(colspec):
        return ((isinstance(index_col, list) and
                 colspec in index_col) or
                (isinstance(index_names, list) and
                 colspec in index_names))

    new_cols = []
    new_data = {}

    orig_names = columns
    columns = list(columns)

    date_cols = set()

    if parse_spec is None or isinstance(parse_spec, bool):
        return data_dict, columns

    if isinstance(parse_spec, list):
        # list of column lists
        for colspec in parse_spec:
            if is_scalar(colspec):
                if isinstance(colspec, int) and colspec not in data_dict:
                    colspec = orig_names[colspec]
                if _isindex(colspec):
                    continue
                data_dict[colspec] = converter(data_dict[colspec])
            else:
                new_name, col, old_names = _try_convert_dates(
                    converter, colspec, data_dict, orig_names)
                if new_name in data_dict:
                    raise ValueError('New date column already in dict %s' %
                                     new_name)
                new_data[new_name] = col
                new_cols.append(new_name)
                date_cols.update(old_names)

    elif isinstance(parse_spec, dict):
        # dict of new name to column list
        for new_name, colspec in compat.iteritems(parse_spec):
            if new_name in data_dict:
                raise ValueError('Date column %s already in dict' %
                                 new_name)

            _, col, old_names = _try_convert_dates(converter, colspec,
                                                   data_dict, orig_names)

            new_data[new_name] = col
            new_cols.append(new_name)
            date_cols.update(old_names)

    data_dict.update(new_data)
    new_cols.extend(columns)

    if not keep_date_col:
        for c in list(date_cols):
            data_dict.pop(c)
            new_cols.remove(c)

    return data_dict, new_cols


def _try_convert_dates(parser, colspec, data_dict, columns):
    colset = set(columns)
    colnames = []

    for c in colspec:
        if c in colset:
            colnames.append(c)
        elif isinstance(c, int) and c not in columns:
            colnames.append(columns[c])
        else:
            colnames.append(c)

    new_name = '_'.join([str(x) for x in colnames])
    to_parse = [data_dict[c] for c in colnames if c in data_dict]

    new_col = parser(*to_parse)
    return new_name, new_col, colnames


def _clean_na_values(na_values, keep_default_na=True):

    if na_values is None:
        if keep_default_na:
            na_values = _NA_VALUES
        else:
            na_values = set()
        na_fvalues = set()
    elif isinstance(na_values, dict):
        na_values = na_values.copy()  # Prevent aliasing.
        if keep_default_na:
            for k, v in compat.iteritems(na_values):
                if not is_list_like(v):
                    v = [v]
                v = set(v) | _NA_VALUES
                na_values[k] = v
        na_fvalues = dict([
            (k, _floatify_na_values(v)) for k, v in na_values.items()  # noqa
        ])
    else:
        if not is_list_like(na_values):
            na_values = [na_values]
        na_values = _stringify_na_values(na_values)
        if keep_default_na:
            na_values = na_values | _NA_VALUES

        na_fvalues = _floatify_na_values(na_values)

    return na_values, na_fvalues


def _clean_index_names(columns, index_col):
    if not _is_index_col(index_col):
        return None, columns, index_col

    columns = list(columns)

    cp_cols = list(columns)
    index_names = []

    # don't mutate
    index_col = list(index_col)

    for i, c in enumerate(index_col):
        if isinstance(c, compat.string_types):
            index_names.append(c)
            for j, name in enumerate(cp_cols):
                if name == c:
                    index_col[i] = j
                    columns.remove(name)
                    break
        else:
            name = cp_cols[c]
            columns.remove(name)
            index_names.append(name)

    # hack
    if isinstance(index_names[0], compat.string_types)\
            and 'Unnamed' in index_names[0]:
        index_names[0] = None

    return index_names, columns, index_col


def _get_empty_meta(columns, index_col, index_names, dtype=None):
    columns = list(columns)

    # Convert `dtype` to a defaultdict of some kind.
    # This will enable us to write `dtype[col_name]`
    # without worrying about KeyError issues later on.
    if not isinstance(dtype, dict):
        # if dtype == None, default will be np.object.
        default_dtype = dtype or np.object
        dtype = defaultdict(lambda: default_dtype)
    else:
        # Save a copy of the dictionary.
        _dtype = dtype.copy()
        dtype = defaultdict(lambda: np.object)

        # Convert column indexes to column names.
        for k, v in compat.iteritems(_dtype):
            col = columns[k] if is_integer(k) else k
            dtype[col] = v

    if index_col is None or index_col is False:
        index = Index([])
    else:
        index = [Series([], dtype=dtype[index_name])
                 for index_name in index_names]
        index = MultiIndex.from_arrays(index, names=index_names)
        index_col.sort()
        for i, n in enumerate(index_col):
            columns.pop(n - i)

    col_dict = dict((col_name,
                     Series([], dtype=dtype[col_name]))
                    for col_name in columns)

    return index, columns, col_dict


def _floatify_na_values(na_values):
    # create float versions of the na_values
    result = set()
    for v in na_values:
        try:
            v = float(v)
            if not np.isnan(v):
                result.add(v)
        except:
            pass
    return result


def _stringify_na_values(na_values):
    """ return a stringified and numeric for these values """
    result = []
    for x in na_values:
        result.append(str(x))
        result.append(x)
        try:
            v = float(x)

            # we are like 999 here
            if v == int(v):
                v = int(v)
                result.append("%s.0" % v)
                result.append(str(v))

            result.append(v)
        except:
            pass
        try:
            result.append(int(x))
        except:
            pass
    return set(result)


def _get_na_values(col, na_values, na_fvalues):
    if isinstance(na_values, dict):
        if col in na_values:
            return na_values[col], na_fvalues[col]
        else:
            return _NA_VALUES, set()
    else:
        return na_values, na_fvalues


def _get_col_names(colspec, columns):
    colset = set(columns)
    colnames = []
    for c in colspec:
        if c in colset:
            colnames.append(c)
        elif isinstance(c, int):
            colnames.append(columns[c])
    return colnames


def _concat_date_cols(date_cols):
    if len(date_cols) == 1:
        if compat.PY3:
            return np.array([compat.text_type(x) for x in date_cols[0]],
                            dtype=object)
        else:
            return np.array([
                str(x) if not isinstance(x, compat.string_types) else x
                for x in date_cols[0]
            ], dtype=object)

    rs = np.array([' '.join([compat.text_type(y) for y in x])
                   for x in zip(*date_cols)], dtype=object)
    return rs


class FixedWidthReader(BaseIterator):
    """
    A reader of fixed-width lines.
    """

    def __init__(self, f, colspecs, delimiter, comment, skiprows=None):
        self.f = f
        self.buffer = None
        self.delimiter = '\r\n' + delimiter if delimiter else '\n\r\t '
        self.comment = comment
        if colspecs == 'infer':
            self.colspecs = self.detect_colspecs(skiprows=skiprows)
        else:
            self.colspecs = colspecs

        if not isinstance(self.colspecs, (tuple, list)):
            raise TypeError("column specifications must be a list or tuple, "
                            "input was a %r" % type(colspecs).__name__)

        for colspec in self.colspecs:
            if not (isinstance(colspec, (tuple, list)) and
                    len(colspec) == 2 and
                    isinstance(colspec[0], (int, np.integer, type(None))) and
                    isinstance(colspec[1], (int, np.integer, type(None)))):
                raise TypeError('Each column specification must be '
                                '2 element tuple or list of integers')

    def get_rows(self, n, skiprows=None):
        """
        Read rows from self.f, skipping as specified.

        We distinguish buffer_rows (the first <= n lines)
        from the rows returned to detect_colspecs because
        it's simpler to leave the other locations with
        skiprows logic alone than to modify them to deal
        with the fact we skipped some rows here as well.

        Parameters
        ----------
        n : int
            Number of rows to read from self.f, not counting
            rows that are skipped.
        skiprows: set, optional
            Indices of rows to skip.

        Returns
        -------
        detect_rows : list of str
            A list containing the rows to read.

        """
        if skiprows is None:
            skiprows = set()
        buffer_rows = []
        detect_rows = []
        for i, row in enumerate(self.f):
            if i not in skiprows:
                detect_rows.append(row)
            buffer_rows.append(row)
            if len(detect_rows) >= n:
                break
        self.buffer = iter(buffer_rows)
        return detect_rows

    def detect_colspecs(self, n=100, skiprows=None):
        # Regex escape the delimiters
        delimiters = ''.join([r'\%s' % x for x in self.delimiter])
        pattern = re.compile('([^%s]+)' % delimiters)
        rows = self.get_rows(n, skiprows)
        if not rows:
            raise EmptyDataError("No rows from which to infer column width")
        max_len = max(map(len, rows))
        mask = np.zeros(max_len + 1, dtype=int)
        if self.comment is not None:
            rows = [row.partition(self.comment)[0] for row in rows]
        for row in rows:
            for m in pattern.finditer(row):
                mask[m.start():m.end()] = 1
        shifted = np.roll(mask, 1)
        shifted[0] = 0
        edges = np.where((mask ^ shifted) == 1)[0]
        edge_pairs = list(zip(edges[::2], edges[1::2]))
        return edge_pairs

    def __next__(self):
        if self.buffer is not None:
            try:
                line = next(self.buffer)
            except StopIteration:
                self.buffer = None
                line = next(self.f)
        else:
            line = next(self.f)
        # Note: 'colspecs' is a sequence of half-open intervals.
        return [line[fromm:to].strip(self.delimiter)
                for (fromm, to) in self.colspecs]


class FixedWidthFieldParser(PythonParser):
    """
    Specialization that Converts fixed-width fields into DataFrames.
    See PythonParser for details.
    """

    def __init__(self, f, **kwds):
        # Support iterators, convert to a list.
        self.colspecs = kwds.pop('colspecs')
        PythonParser.__init__(self, f, **kwds)

    def _make_reader(self, f):
        self.data = FixedWidthReader(f, self.colspecs, self.delimiter,
                                     self.comment, self.skiprows)
