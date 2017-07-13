"""
Module contains tools for processing Stata files into DataFrames

The StataReader below was originally written by Joe Presbrey as part of PyDTA.
It has been extended and improved by Skipper Seabold from the Statsmodels
project who also developed the StataWriter and was finally added to pandas in
a once again improved version.

You can find more information on http://presbrey.mit.edu/PyDTA and
http://www.statsmodels.org/devel/
"""
import numpy as np

import sys
import struct
from dateutil.relativedelta import relativedelta

from pandas.core.dtypes.common import (
    is_categorical_dtype, is_datetime64_dtype,
    _ensure_object)

from pandas.core.base import StringMixin
from pandas.core.categorical import Categorical
from pandas.core.frame import DataFrame
from pandas.core.series import Series
import datetime
from pandas import compat, to_timedelta, to_datetime, isnull, DatetimeIndex
from pandas.compat import lrange, lmap, lzip, text_type, string_types, range, \
    zip, BytesIO
from pandas.util._decorators import Appender
import pandas as pd

from pandas.io.common import get_filepath_or_buffer, BaseIterator
from pandas._libs.lib import max_len_string_array, infer_dtype
from pandas._libs.tslib import NaT, Timestamp

VALID_ENCODINGS = ('ascii', 'us-ascii', 'latin-1', 'latin_1', 'iso-8859-1',
                   'iso8859-1', '8859', 'cp819', 'latin', 'latin1', 'L1')

_version_error = ("Version of given Stata file is not 104, 105, 108, "
                  "111 (Stata 7SE), 113 (Stata 8/9), 114 (Stata 10/11), "
                  "115 (Stata 12), 117 (Stata 13), or 118 (Stata 14)")

_statafile_processing_params1 = """\
convert_dates : boolean, defaults to True
    Convert date variables to DataFrame time values
convert_categoricals : boolean, defaults to True
    Read value labels and convert columns to Categorical/Factor variables"""

_encoding_params = """\
encoding : string, None or encoding
    Encoding used to parse the files. None defaults to latin-1."""

_statafile_processing_params2 = """\
index : identifier of index column
    identifier of column that should be used as index of the DataFrame
convert_missing : boolean, defaults to False
    Flag indicating whether to convert missing values to their Stata
    representations.  If False, missing values are replaced with nans.
    If True, columns containing missing values are returned with
    object data types and missing values are represented by
    StataMissingValue objects.
preserve_dtypes : boolean, defaults to True
    Preserve Stata datatypes. If False, numeric data are upcast to pandas
    default types for foreign data (float64 or int64)
columns : list or None
    Columns to retain.  Columns will be returned in the given order.  None
    returns all columns
order_categoricals : boolean, defaults to True
    Flag indicating whether converted categorical data are ordered."""

_chunksize_params = """\
chunksize : int, default None
    Return StataReader object for iterations, returns chunks with
    given number of lines"""

_iterator_params = """\
iterator : boolean, default False
    Return StataReader object"""

_read_stata_doc = """Read Stata file into DataFrame

Parameters
----------
filepath_or_buffer : string or file-like object
    Path to .dta file or object implementing a binary read() functions
%s
%s
%s
%s
%s

Returns
-------
DataFrame or StataReader

Examples
--------
Read a Stata dta file:

>>> df = pandas.read_stata('filename.dta')

Read a Stata dta file in 10,000 line chunks:

>>> itr = pandas.read_stata('filename.dta', chunksize=10000)
>>> for chunk in itr:
>>>     do_something(chunk)
""" % (_statafile_processing_params1, _encoding_params,
       _statafile_processing_params2, _chunksize_params,
       _iterator_params)

_data_method_doc = """Reads observations from Stata file, converting them into a dataframe

This is a legacy method.  Use `read` in new code.

Parameters
----------
%s
%s

Returns
-------
DataFrame
""" % (_statafile_processing_params1, _statafile_processing_params2)


_read_method_doc = """\
Reads observations from Stata file, converting them into a dataframe

Parameters
----------
nrows : int
    Number of lines to read from data file, if None read whole file.
%s
%s

Returns
-------
DataFrame
""" % (_statafile_processing_params1, _statafile_processing_params2)


_stata_reader_doc = """\
Class for reading Stata dta files.

Parameters
----------
path_or_buf : string or file-like object
    Path to .dta file or object implementing a binary read() functions
%s
%s
%s
%s
""" % (_statafile_processing_params1, _statafile_processing_params2,
       _encoding_params, _chunksize_params)


@Appender(_read_stata_doc)
def read_stata(filepath_or_buffer, convert_dates=True,
               convert_categoricals=True, encoding=None, index=None,
               convert_missing=False, preserve_dtypes=True, columns=None,
               order_categoricals=True, chunksize=None, iterator=False):

    reader = StataReader(filepath_or_buffer,
                         convert_dates=convert_dates,
                         convert_categoricals=convert_categoricals,
                         index=index, convert_missing=convert_missing,
                         preserve_dtypes=preserve_dtypes,
                         columns=columns,
                         order_categoricals=order_categoricals,
                         chunksize=chunksize, encoding=encoding)

    if iterator or chunksize:
        data = reader
    else:
        try:
            data = reader.read()
        finally:
            reader.close()
    return data


_date_formats = ["%tc", "%tC", "%td", "%d", "%tw", "%tm", "%tq", "%th", "%ty"]


stata_epoch = datetime.datetime(1960, 1, 1)


def _stata_elapsed_date_to_datetime_vec(dates, fmt):
    """
    Convert from SIF to datetime. http://www.stata.com/help.cgi?datetime

    Parameters
    ----------
    dates : Series
        The Stata Internal Format date to convert to datetime according to fmt
    fmt : str
        The format to convert to. Can be, tc, td, tw, tm, tq, th, ty
        Returns

    Returns
    -------
    converted : Series
        The converted dates

    Examples
    --------
    >>> import pandas as pd
    >>> dates = pd.Series([52])
    >>> _stata_elapsed_date_to_datetime_vec(dates , "%tw")
    0   1961-01-01
    dtype: datetime64[ns]

    Notes
    -----
    datetime/c - tc
        milliseconds since 01jan1960 00:00:00.000, assuming 86,400 s/day
    datetime/C - tC - NOT IMPLEMENTED
        milliseconds since 01jan1960 00:00:00.000, adjusted for leap seconds
    date - td
        days since 01jan1960 (01jan1960 = 0)
    weekly date - tw
        weeks since 1960w1
        This assumes 52 weeks in a year, then adds 7 * remainder of the weeks.
        The datetime value is the start of the week in terms of days in the
        year, not ISO calendar weeks.
    monthly date - tm
        months since 1960m1
    quarterly date - tq
        quarters since 1960q1
    half-yearly date - th
        half-years since 1960h1 yearly
    date - ty
        years since 0000

    If you don't have pandas with datetime support, then you can't do
    milliseconds accurately.
    """
    MIN_YEAR, MAX_YEAR = Timestamp.min.year, Timestamp.max.year
    MAX_DAY_DELTA = (Timestamp.max - datetime.datetime(1960, 1, 1)).days
    MIN_DAY_DELTA = (Timestamp.min - datetime.datetime(1960, 1, 1)).days
    MIN_MS_DELTA = MIN_DAY_DELTA * 24 * 3600 * 1000
    MAX_MS_DELTA = MAX_DAY_DELTA * 24 * 3600 * 1000

    def convert_year_month_safe(year, month):
        """
        Convert year and month to datetimes, using pandas vectorized versions
        when the date range falls within the range supported by pandas.  Other
        wise it falls back to a slower but more robust method using datetime.
        """
        if year.max() < MAX_YEAR and year.min() > MIN_YEAR:
            return to_datetime(100 * year + month, format='%Y%m')
        else:
            index = getattr(year, 'index', None)
            return Series(
                [datetime.datetime(y, m, 1) for y, m in zip(year, month)],
                index=index)

    def convert_year_days_safe(year, days):
        """
        Converts year (e.g. 1999) and days since the start of the year to a
        datetime or datetime64 Series
        """
        if year.max() < (MAX_YEAR - 1) and year.min() > MIN_YEAR:
            return (to_datetime(year, format='%Y') +
                    to_timedelta(days, unit='d'))
        else:
            index = getattr(year, 'index', None)
            value = [datetime.datetime(y, 1, 1) + relativedelta(days=int(d))
                     for y, d in zip(year, days)]
            return Series(value, index=index)

    def convert_delta_safe(base, deltas, unit):
        """
        Convert base dates and deltas to datetimes, using pandas vectorized
        versions if the deltas satisfy restrictions required to be expressed
        as dates in pandas.
        """
        index = getattr(deltas, 'index', None)
        if unit == 'd':
            if deltas.max() > MAX_DAY_DELTA or deltas.min() < MIN_DAY_DELTA:
                values = [base + relativedelta(days=int(d)) for d in deltas]
                return Series(values, index=index)
        elif unit == 'ms':
            if deltas.max() > MAX_MS_DELTA or deltas.min() < MIN_MS_DELTA:
                values = [base + relativedelta(microseconds=(int(d) * 1000))
                          for d in deltas]
                return Series(values, index=index)
        else:
            raise ValueError('format not understood')
        base = to_datetime(base)
        deltas = to_timedelta(deltas, unit=unit)
        return base + deltas

    # TODO: If/when pandas supports more than datetime64[ns], this should be
    # improved to use correct range, e.g. datetime[Y] for yearly
    bad_locs = np.isnan(dates)
    has_bad_values = False
    if bad_locs.any():
        has_bad_values = True
        data_col = Series(dates)
        data_col[bad_locs] = 1.0  # Replace with NaT
    dates = dates.astype(np.int64)

    if fmt in ["%tc", "tc"]:  # Delta ms relative to base
        base = stata_epoch
        ms = dates
        conv_dates = convert_delta_safe(base, ms, 'ms')
    elif fmt in ["%tC", "tC"]:
        from warnings import warn

        warn("Encountered %tC format. Leaving in Stata Internal Format.")
        conv_dates = Series(dates, dtype=np.object)
        if has_bad_values:
            conv_dates[bad_locs] = pd.NaT
        return conv_dates
    elif fmt in ["%td", "td", "%d", "d"]:  # Delta days relative to base
        base = stata_epoch
        days = dates
        conv_dates = convert_delta_safe(base, days, 'd')
    elif fmt in ["%tw", "tw"]:  # does not count leap days - 7 days is a week
        year = stata_epoch.year + dates // 52
        days = (dates % 52) * 7
        conv_dates = convert_year_days_safe(year, days)
    elif fmt in ["%tm", "tm"]:  # Delta months relative to base
        year = stata_epoch.year + dates // 12
        month = (dates % 12) + 1
        conv_dates = convert_year_month_safe(year, month)
    elif fmt in ["%tq", "tq"]:  # Delta quarters relative to base
        year = stata_epoch.year + dates // 4
        month = (dates % 4) * 3 + 1
        conv_dates = convert_year_month_safe(year, month)
    elif fmt in ["%th", "th"]:  # Delta half-years relative to base
        year = stata_epoch.year + dates // 2
        month = (dates % 2) * 6 + 1
        conv_dates = convert_year_month_safe(year, month)
    elif fmt in ["%ty", "ty"]:  # Years -- not delta
        year = dates
        month = np.ones_like(dates)
        conv_dates = convert_year_month_safe(year, month)
    else:
        raise ValueError("Date fmt %s not understood" % fmt)

    if has_bad_values:  # Restore NaT for bad values
        conv_dates[bad_locs] = NaT

    return conv_dates


def _datetime_to_stata_elapsed_vec(dates, fmt):
    """
    Convert from datetime to SIF. http://www.stata.com/help.cgi?datetime

    Parameters
    ----------
    dates : Series
        Series or array containing datetime.datetime or datetime64[ns] to
        convert to the Stata Internal Format given by fmt
    fmt : str
        The format to convert to. Can be, tc, td, tw, tm, tq, th, ty
    """
    index = dates.index
    NS_PER_DAY = 24 * 3600 * 1000 * 1000 * 1000
    US_PER_DAY = NS_PER_DAY / 1000

    def parse_dates_safe(dates, delta=False, year=False, days=False):
        d = {}
        if is_datetime64_dtype(dates.values):
            if delta:
                delta = dates - stata_epoch
                d['delta'] = delta.values.astype(
                    np.int64) // 1000  # microseconds
            if days or year:
                dates = DatetimeIndex(dates)
                d['year'], d['month'] = dates.year, dates.month
            if days:
                days = (dates.astype(np.int64) -
                        to_datetime(d['year'], format='%Y').astype(np.int64))
                d['days'] = days // NS_PER_DAY

        elif infer_dtype(dates) == 'datetime':
            if delta:
                delta = dates.values - stata_epoch
                f = lambda x: \
                    US_PER_DAY * x.days + 1000000 * x.seconds + x.microseconds
                v = np.vectorize(f)
                d['delta'] = v(delta)
            if year:
                year_month = dates.apply(lambda x: 100 * x.year + x.month)
                d['year'] = year_month.values // 100
                d['month'] = (year_month.values - d['year'] * 100)
            if days:
                f = lambda x: (x - datetime.datetime(x.year, 1, 1)).days
                v = np.vectorize(f)
                d['days'] = v(dates)
        else:
            raise ValueError('Columns containing dates must contain either '
                             'datetime64, datetime.datetime or null values.')

        return DataFrame(d, index=index)

    bad_loc = isnull(dates)
    index = dates.index
    if bad_loc.any():
        dates = Series(dates)
        if is_datetime64_dtype(dates):
            dates[bad_loc] = to_datetime(stata_epoch)
        else:
            dates[bad_loc] = stata_epoch

    if fmt in ["%tc", "tc"]:
        d = parse_dates_safe(dates, delta=True)
        conv_dates = d.delta / 1000
    elif fmt in ["%tC", "tC"]:
        from warnings import warn
        warn("Stata Internal Format tC not supported.")
        conv_dates = dates
    elif fmt in ["%td", "td"]:
        d = parse_dates_safe(dates, delta=True)
        conv_dates = d.delta // US_PER_DAY
    elif fmt in ["%tw", "tw"]:
        d = parse_dates_safe(dates, year=True, days=True)
        conv_dates = (52 * (d.year - stata_epoch.year) + d.days // 7)
    elif fmt in ["%tm", "tm"]:
        d = parse_dates_safe(dates, year=True)
        conv_dates = (12 * (d.year - stata_epoch.year) + d.month - 1)
    elif fmt in ["%tq", "tq"]:
        d = parse_dates_safe(dates, year=True)
        conv_dates = 4 * (d.year - stata_epoch.year) + (d.month - 1) // 3
    elif fmt in ["%th", "th"]:
        d = parse_dates_safe(dates, year=True)
        conv_dates = 2 * (d.year - stata_epoch.year) + \
                         (d.month > 6).astype(np.int)
    elif fmt in ["%ty", "ty"]:
        d = parse_dates_safe(dates, year=True)
        conv_dates = d.year
    else:
        raise ValueError("Format %s is not a known Stata date format" % fmt)

    conv_dates = Series(conv_dates, dtype=np.float64)
    missing_value = struct.unpack('<d', b'\x00\x00\x00\x00\x00\x00\xe0\x7f')[0]
    conv_dates[bad_loc] = missing_value

    return Series(conv_dates, index=index)


excessive_string_length_error = """
Fixed width strings in Stata .dta files are limited to 244 (or fewer)
characters.  Column '%s' does not satisfy this restriction.
"""


class PossiblePrecisionLoss(Warning):
    pass


precision_loss_doc = """
Column converted from %s to %s, and some data are outside of the lossless
conversion range. This may result in a loss of precision in the saved data.
"""


class ValueLabelTypeMismatch(Warning):
    pass


value_label_mismatch_doc = """
Stata value labels (pandas categories) must be strings. Column {0} contains
non-string labels which will be converted to strings.  Please check that the
Stata data file created has not lost information due to duplicate labels.
"""


class InvalidColumnName(Warning):
    pass


invalid_name_doc = """
Not all pandas column names were valid Stata variable names.
The following replacements have been made:

    {0}

If this is not what you expect, please make sure you have Stata-compliant
column names in your DataFrame (strings only, max 32 characters, only
alphanumerics and underscores, no Stata reserved words)
"""


def _cast_to_stata_types(data):
    """Checks the dtypes of the columns of a pandas DataFrame for
    compatibility with the data types and ranges supported by Stata, and
    converts if necessary.

    Parameters
    ----------
    data : DataFrame
        The DataFrame to check and convert

    Notes
    -----
    Numeric columns in Stata must be one of int8, int16, int32, float32 or
    float64, with some additional value restrictions.  int8 and int16 columns
    are checked for violations of the value restrictions and upcast if needed.
    int64 data is not usable in Stata, and so it is downcast to int32 whenever
    the value are in the int32 range, and sidecast to float64 when larger than
    this range.  If the int64 values are outside of the range of those
    perfectly representable as float64 values, a warning is raised.

    bool columns are cast to int8.  uint colums are converted to int of the
    same size if there is no loss in precision, other wise are upcast to a
    larger type.  uint64 is currently not supported since it is concerted to
    object in a DataFrame.
    """
    ws = ''
    #                  original, if small, if large
    conversion_data = ((np.bool, np.int8, np.int8),
                       (np.uint8, np.int8, np.int16),
                       (np.uint16, np.int16, np.int32),
                       (np.uint32, np.int32, np.int64))

    float32_max = struct.unpack('<f', b'\xff\xff\xff\x7e')[0]
    float64_max = struct.unpack('<d', b'\xff\xff\xff\xff\xff\xff\xdf\x7f')[0]

    for col in data:
        dtype = data[col].dtype
        # Cast from unsupported types to supported types
        for c_data in conversion_data:
            if dtype == c_data[0]:
                if data[col].max() <= np.iinfo(c_data[1]).max:
                    dtype = c_data[1]
                else:
                    dtype = c_data[2]
                if c_data[2] == np.float64:  # Warn if necessary
                    if data[col].max() >= 2 ** 53:
                        ws = precision_loss_doc % ('uint64', 'float64')

                data[col] = data[col].astype(dtype)

        # Check values and upcast if necessary
        if dtype == np.int8:
            if data[col].max() > 100 or data[col].min() < -127:
                data[col] = data[col].astype(np.int16)
        elif dtype == np.int16:
            if data[col].max() > 32740 or data[col].min() < -32767:
                data[col] = data[col].astype(np.int32)
        elif dtype == np.int64:
            if (data[col].max() <= 2147483620 and
                    data[col].min() >= -2147483647):
                data[col] = data[col].astype(np.int32)
            else:
                data[col] = data[col].astype(np.float64)
                if data[col].max() >= 2 ** 53 or data[col].min() <= -2 ** 53:
                    ws = precision_loss_doc % ('int64', 'float64')
        elif dtype in (np.float32, np.float64):
            value = data[col].max()
            if np.isinf(value):
                msg = 'Column {0} has a maximum value of infinity which is ' \
                      'outside the range supported by Stata.'
                raise ValueError(msg.format(col))
            if dtype == np.float32 and value > float32_max:
                data[col] = data[col].astype(np.float64)
            elif dtype == np.float64:
                if value > float64_max:
                    msg = 'Column {0} has a maximum value ({1}) outside the ' \
                          'range supported by Stata ({1})'
                    raise ValueError(msg.format(col, value, float64_max))

    if ws:
        import warnings

        warnings.warn(ws, PossiblePrecisionLoss)

    return data


class StataValueLabel(object):
    """
    Parse a categorical column and prepare formatted output

    Parameters
    -----------
    value : int8, int16, int32, float32 or float64
        The Stata missing value code

    Attributes
    ----------
    string : string
        String representation of the Stata missing value
    value : int8, int16, int32, float32 or float64
        The original encoded missing value

    Methods
    -------
    generate_value_label

    """

    def __init__(self, catarray):

        self.labname = catarray.name

        categories = catarray.cat.categories
        self.value_labels = list(zip(np.arange(len(categories)), categories))
        self.value_labels.sort(key=lambda x: x[0])
        self.text_len = np.int32(0)
        self.off = []
        self.val = []
        self.txt = []
        self.n = 0

        # Compute lengths and setup lists of offsets and labels
        for vl in self.value_labels:
            category = vl[1]
            if not isinstance(category, string_types):
                category = str(category)
                import warnings
                warnings.warn(value_label_mismatch_doc.format(catarray.name),
                              ValueLabelTypeMismatch)

            self.off.append(self.text_len)
            self.text_len += len(category) + 1  # +1 for the padding
            self.val.append(vl[0])
            self.txt.append(category)
            self.n += 1

        if self.text_len > 32000:
            raise ValueError('Stata value labels for a single variable must '
                             'have a combined length less than 32,000 '
                             'characters.')

        # Ensure int32
        self.off = np.array(self.off, dtype=np.int32)
        self.val = np.array(self.val, dtype=np.int32)

        # Total length
        self.len = 4 + 4 + 4 * self.n + 4 * self.n + self.text_len

    def _encode(self, s):
        """
        Python 3 compatability shim
        """
        if compat.PY3:
            return s.encode(self._encoding)
        else:
            return s

    def generate_value_label(self, byteorder, encoding):
        """
        Parameters
        ----------
        byteorder : str
            Byte order of the output
        encoding : str
            File encoding

        Returns
        -------
        value_label : bytes
            Bytes containing the formatted value label
        """

        self._encoding = encoding
        bio = BytesIO()
        null_string = '\x00'
        null_byte = b'\x00'

        # len
        bio.write(struct.pack(byteorder + 'i', self.len))

        # labname
        labname = self._encode(_pad_bytes(self.labname[:32], 33))
        bio.write(labname)

        # padding - 3 bytes
        for i in range(3):
            bio.write(struct.pack('c', null_byte))

        # value_label_table
        # n - int32
        bio.write(struct.pack(byteorder + 'i', self.n))

        # textlen  - int32
        bio.write(struct.pack(byteorder + 'i', self.text_len))

        # off - int32 array (n elements)
        for offset in self.off:
            bio.write(struct.pack(byteorder + 'i', offset))

        # val - int32 array (n elements)
        for value in self.val:
            bio.write(struct.pack(byteorder + 'i', value))

        # txt - Text labels, null terminated
        for text in self.txt:
            bio.write(self._encode(text + null_string))

        bio.seek(0)
        return bio.read()


class StataMissingValue(StringMixin):
    """
    An observation's missing value.

    Parameters
    -----------
    value : int8, int16, int32, float32 or float64
        The Stata missing value code

    Attributes
    ----------
    string : string
        String representation of the Stata missing value
    value : int8, int16, int32, float32 or float64
        The original encoded missing value

    Notes
    -----
    More information: <http://www.stata.com/help.cgi?missing>

    Integer missing values make the code '.', '.a', ..., '.z' to the ranges
    101 ... 127 (for int8), 32741 ... 32767  (for int16) and 2147483621 ...
    2147483647 (for int32).  Missing values for floating point data types are
    more complex but the pattern is simple to discern from the following table.

    np.float32 missing values (float in Stata)
    0000007f    .
    0008007f    .a
    0010007f    .b
    ...
    00c0007f    .x
    00c8007f    .y
    00d0007f    .z

    np.float64 missing values (double in Stata)
    000000000000e07f    .
    000000000001e07f    .a
    000000000002e07f    .b
    ...
    000000000018e07f    .x
    000000000019e07f    .y
    00000000001ae07f    .z
    """

    # Construct a dictionary of missing values
    MISSING_VALUES = {}
    bases = (101, 32741, 2147483621)
    for b in bases:
        # Conversion to long to avoid hash issues on 32 bit platforms #8968
        MISSING_VALUES[compat.long(b)] = '.'
        for i in range(1, 27):
            MISSING_VALUES[compat.long(i + b)] = '.' + chr(96 + i)

    float32_base = b'\x00\x00\x00\x7f'
    increment = struct.unpack('<i', b'\x00\x08\x00\x00')[0]
    for i in range(27):
        value = struct.unpack('<f', float32_base)[0]
        MISSING_VALUES[value] = '.'
        if i > 0:
            MISSING_VALUES[value] += chr(96 + i)
        int_value = struct.unpack('<i', struct.pack('<f', value))[
            0] + increment
        float32_base = struct.pack('<i', int_value)

    float64_base = b'\x00\x00\x00\x00\x00\x00\xe0\x7f'
    increment = struct.unpack('q', b'\x00\x00\x00\x00\x00\x01\x00\x00')[0]
    for i in range(27):
        value = struct.unpack('<d', float64_base)[0]
        MISSING_VALUES[value] = '.'
        if i > 0:
            MISSING_VALUES[value] += chr(96 + i)
        int_value = struct.unpack('q', struct.pack('<d', value))[0] + increment
        float64_base = struct.pack('q', int_value)

    BASE_MISSING_VALUES = {'int8': 101,
                           'int16': 32741,
                           'int32': 2147483621,
                           'float32': struct.unpack('<f', float32_base)[0],
                           'float64': struct.unpack('<d', float64_base)[0]}

    def __init__(self, value):
        self._value = value
        # Conversion to long to avoid hash issues on 32 bit platforms #8968
        value = compat.long(value) if value < 2147483648 else float(value)
        self._str = self.MISSING_VALUES[value]

    string = property(lambda self: self._str,
                      doc="The Stata representation of the missing value: "
                          "'.', '.a'..'.z'")
    value = property(lambda self: self._value,
                     doc='The binary representation of the missing value.')

    def __unicode__(self):
        return self.string

    def __repr__(self):
        # not perfect :-/
        return "%s(%s)" % (self.__class__, self)

    def __eq__(self, other):
        return (isinstance(other, self.__class__) and
                self.string == other.string and self.value == other.value)

    @classmethod
    def get_base_missing_value(cls, dtype):
        if dtype == np.int8:
            value = cls.BASE_MISSING_VALUES['int8']
        elif dtype == np.int16:
            value = cls.BASE_MISSING_VALUES['int16']
        elif dtype == np.int32:
            value = cls.BASE_MISSING_VALUES['int32']
        elif dtype == np.float32:
            value = cls.BASE_MISSING_VALUES['float32']
        elif dtype == np.float64:
            value = cls.BASE_MISSING_VALUES['float64']
        else:
            raise ValueError('Unsupported dtype')
        return value


class StataParser(object):
    _default_encoding = 'latin-1'

    def __init__(self, encoding):
        if encoding is not None:
            if encoding not in VALID_ENCODINGS:
                raise ValueError('Unknown encoding. Only latin-1 and ascii '
                                 'supported.')

        self._encoding = encoding

        # type          code.
        # --------------------
        # str1        1 = 0x01
        # str2        2 = 0x02
        # ...
        # str244    244 = 0xf4
        # byte      251 = 0xfb  (sic)
        # int       252 = 0xfc
        # long      253 = 0xfd
        # float     254 = 0xfe
        # double    255 = 0xff
        # --------------------
        # NOTE: the byte type seems to be reserved for categorical variables
        # with a label, but the underlying variable is -127 to 100
        # we're going to drop the label and cast to int
        self.DTYPE_MAP = \
            dict(
                lzip(range(1, 245), ['a' + str(i) for i in range(1, 245)]) +
                [
                    (251, np.int8),
                    (252, np.int16),
                    (253, np.int32),
                    (254, np.float32),
                    (255, np.float64)
                ]
            )
        self.DTYPE_MAP_XML = \
            dict(
                [
                    (32768, np.uint8),  # Keys to GSO
                    (65526, np.float64),
                    (65527, np.float32),
                    (65528, np.int32),
                    (65529, np.int16),
                    (65530, np.int8)
                ]
            )
        self.TYPE_MAP = lrange(251) + list('bhlfd')
        self.TYPE_MAP_XML = \
            dict(
                [
                    # Not really a Q, unclear how to handle byteswap
                    (32768, 'Q'),

                    (65526, 'd'),
                    (65527, 'f'),
                    (65528, 'l'),
                    (65529, 'h'),
                    (65530, 'b')
                ]
            )
        # NOTE: technically, some of these are wrong. there are more numbers
        # that can be represented. it's the 27 ABOVE and BELOW the max listed
        # numeric data type in [U] 12.2.2 of the 11.2 manual
        float32_min = b'\xff\xff\xff\xfe'
        float32_max = b'\xff\xff\xff\x7e'
        float64_min = b'\xff\xff\xff\xff\xff\xff\xef\xff'
        float64_max = b'\xff\xff\xff\xff\xff\xff\xdf\x7f'
        self.VALID_RANGE = {
            'b': (-127, 100),
            'h': (-32767, 32740),
            'l': (-2147483647, 2147483620),
            'f': (np.float32(struct.unpack('<f', float32_min)[0]),
                  np.float32(struct.unpack('<f', float32_max)[0])),
            'd': (np.float64(struct.unpack('<d', float64_min)[0]),
                  np.float64(struct.unpack('<d', float64_max)[0]))
        }

        self.OLD_TYPE_MAPPING = {
            98: 251,   # byte
            105: 252,  # int
            108: 253,  # long
            102: 254   # float
            # don't know old code for double
        }

        # These missing values are the generic '.' in Stata, and are used
        # to replace nans
        self.MISSING_VALUES = {
            'b': 101,
            'h': 32741,
            'l': 2147483621,
            'f': np.float32(struct.unpack('<f', b'\x00\x00\x00\x7f')[0]),
            'd': np.float64(
                struct.unpack('<d', b'\x00\x00\x00\x00\x00\x00\xe0\x7f')[0])
        }
        self.NUMPY_TYPE_MAP = {
            'b': 'i1',
            'h': 'i2',
            'l': 'i4',
            'f': 'f4',
            'd': 'f8',
            'Q': 'u8'
        }

        # Reserved words cannot be used as variable names
        self.RESERVED_WORDS = ('aggregate', 'array', 'boolean', 'break',
                               'byte', 'case', 'catch', 'class', 'colvector',
                               'complex', 'const', 'continue', 'default',
                               'delegate', 'delete', 'do', 'double', 'else',
                               'eltypedef', 'end', 'enum', 'explicit',
                               'export', 'external', 'float', 'for', 'friend',
                               'function', 'global', 'goto', 'if', 'inline',
                               'int', 'local', 'long', 'NULL', 'pragma',
                               'protected', 'quad', 'rowvector', 'short',
                               'typedef', 'typename', 'virtual')


class StataReader(StataParser, BaseIterator):
    __doc__ = _stata_reader_doc

    def __init__(self, path_or_buf, convert_dates=True,
                 convert_categoricals=True, index=None,
                 convert_missing=False, preserve_dtypes=True,
                 columns=None, order_categoricals=True,
                 encoding='latin-1', chunksize=None):
        super(StataReader, self).__init__(encoding)
        self.col_sizes = ()

        # Arguments to the reader (can be temporarily overridden in
        # calls to read).
        self._convert_dates = convert_dates
        self._convert_categoricals = convert_categoricals
        self._index = index
        self._convert_missing = convert_missing
        self._preserve_dtypes = preserve_dtypes
        self._columns = columns
        self._order_categoricals = order_categoricals
        if encoding is not None:
            if encoding not in VALID_ENCODINGS:
                raise ValueError('Unknown encoding. Only latin-1 and  ascii '
                                 'supported.')
        self._encoding = encoding
        self._chunksize = chunksize

        # State variables for the file
        self._has_string_data = False
        self._missing_values = False
        self._can_read_value_labels = False
        self._column_selector_set = False
        self._value_labels_read = False
        self._data_read = False
        self._dtype = None
        self._lines_read = 0

        self._native_byteorder = _set_endianness(sys.byteorder)
        if isinstance(path_or_buf, str):
            path_or_buf, encoding, _ = get_filepath_or_buffer(
                path_or_buf, encoding=self._default_encoding
            )

        if isinstance(path_or_buf, (str, compat.text_type, bytes)):
            self.path_or_buf = open(path_or_buf, 'rb')
        else:
            # Copy to BytesIO, and ensure no encoding
            contents = path_or_buf.read()
            try:
                contents = contents.encode(self._default_encoding)
            except:
                pass
            self.path_or_buf = BytesIO(contents)

        self._read_header()

    def __enter__(self):
        """ enter context manager """
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """ exit context manager """
        self.close()

    def close(self):
        """ close the handle if its open """
        try:
            self.path_or_buf.close()
        except IOError:
            pass

    def _read_header(self):
        first_char = self.path_or_buf.read(1)
        if struct.unpack('c', first_char)[0] == b'<':
            self._read_new_header(first_char)
        else:
            self._read_old_header(first_char)

        self.has_string_data = len([x for x in self.typlist
                                    if type(x) is int]) > 0

        # calculate size of a data record
        self.col_sizes = lmap(lambda x: self._calcsize(x), self.typlist)

        # remove format details from %td
        self.fmtlist = ["%td" if x.startswith("%td") else x
                        for x in self.fmtlist]

    def _read_new_header(self, first_char):
        # The first part of the header is common to 117 and 118.
        self.path_or_buf.read(27)  # stata_dta><header><release>
        self.format_version = int(self.path_or_buf.read(3))
        if self.format_version not in [117, 118]:
            raise ValueError(_version_error)
        self.path_or_buf.read(21)  # </release><byteorder>
        self.byteorder = self.path_or_buf.read(3) == "MSF" and '>' or '<'
        self.path_or_buf.read(15)  # </byteorder><K>
        self.nvar = struct.unpack(self.byteorder + 'H',
                                  self.path_or_buf.read(2))[0]
        self.path_or_buf.read(7)  # </K><N>

        self.nobs = self._get_nobs()
        self.path_or_buf.read(11)  # </N><label>
        self.data_label = self._get_data_label()
        self.path_or_buf.read(19)  # </label><timestamp>
        self.time_stamp = self._get_time_stamp()
        self.path_or_buf.read(26)  # </timestamp></header><map>
        self.path_or_buf.read(8)  # 0x0000000000000000
        self.path_or_buf.read(8)  # position of <map>

        self._seek_vartypes = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 16
        self._seek_varnames = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 10
        self._seek_sortlist = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 10
        self._seek_formats = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 9
        self._seek_value_label_names = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 19

        # Requires version-specific treatment
        self._seek_variable_labels = self._get_seek_variable_labels()

        self.path_or_buf.read(8)  # <characteristics>
        self.data_location = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 6
        self.seek_strls = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 7
        self.seek_value_labels = struct.unpack(
            self.byteorder + 'q', self.path_or_buf.read(8))[0] + 14

        self.typlist, self.dtyplist = self._get_dtypes(self._seek_vartypes)

        self.path_or_buf.seek(self._seek_varnames)
        self.varlist = self._get_varlist()

        self.path_or_buf.seek(self._seek_sortlist)
        self.srtlist = struct.unpack(
            self.byteorder + ('h' * (self.nvar + 1)),
            self.path_or_buf.read(2 * (self.nvar + 1))
        )[:-1]

        self.path_or_buf.seek(self._seek_formats)
        self.fmtlist = self._get_fmtlist()

        self.path_or_buf.seek(self._seek_value_label_names)
        self.lbllist = self._get_lbllist()

        self.path_or_buf.seek(self._seek_variable_labels)
        self._variable_labels = self._get_variable_labels()

    # Get data type information, works for versions 117-118.
    def _get_dtypes(self, seek_vartypes):

        self.path_or_buf.seek(seek_vartypes)
        raw_typlist = [struct.unpack(self.byteorder + 'H',
                                     self.path_or_buf.read(2))[0]
                       for i in range(self.nvar)]

        def f(typ):
            if typ <= 2045:
                return typ
            try:
                return self.TYPE_MAP_XML[typ]
            except KeyError:
                raise ValueError("cannot convert stata types [{0}]".
                                 format(typ))

        typlist = [f(x) for x in raw_typlist]

        def f(typ):
            if typ <= 2045:
                return str(typ)
            try:
                return self.DTYPE_MAP_XML[typ]
            except KeyError:
                raise ValueError("cannot convert stata dtype [{0}]"
                                 .format(typ))

        dtyplist = [f(x) for x in raw_typlist]

        return typlist, dtyplist

    def _get_varlist(self):
        if self.format_version == 117:
            b = 33
        elif self.format_version == 118:
            b = 129

        return [self._null_terminate(self.path_or_buf.read(b))
                for i in range(self.nvar)]

    # Returns the format list
    def _get_fmtlist(self):
        if self.format_version == 118:
            b = 57
        elif self.format_version > 113:
            b = 49
        elif self.format_version > 104:
            b = 12
        else:
            b = 7

        return [self._null_terminate(self.path_or_buf.read(b))
                for i in range(self.nvar)]

    # Returns the label list
    def _get_lbllist(self):
        if self.format_version >= 118:
            b = 129
        elif self.format_version > 108:
            b = 33
        else:
            b = 9
        return [self._null_terminate(self.path_or_buf.read(b))
                for i in range(self.nvar)]

    def _get_variable_labels(self):
        if self.format_version == 118:
            vlblist = [self._decode(self.path_or_buf.read(321))
                       for i in range(self.nvar)]
        elif self.format_version > 105:
            vlblist = [self._null_terminate(self.path_or_buf.read(81))
                       for i in range(self.nvar)]
        else:
            vlblist = [self._null_terminate(self.path_or_buf.read(32))
                       for i in range(self.nvar)]
        return vlblist

    def _get_nobs(self):
        if self.format_version == 118:
            return struct.unpack(self.byteorder + 'Q',
                                 self.path_or_buf.read(8))[0]
        else:
            return struct.unpack(self.byteorder + 'I',
                                 self.path_or_buf.read(4))[0]

    def _get_data_label(self):
        if self.format_version == 118:
            strlen = struct.unpack(self.byteorder + 'H',
                                   self.path_or_buf.read(2))[0]
            return self._decode(self.path_or_buf.read(strlen))
        elif self.format_version == 117:
            strlen = struct.unpack('b', self.path_or_buf.read(1))[0]
            return self._null_terminate(self.path_or_buf.read(strlen))
        elif self.format_version > 105:
            return self._null_terminate(self.path_or_buf.read(81))
        else:
            return self._null_terminate(self.path_or_buf.read(32))

    def _get_time_stamp(self):
        if self.format_version == 118:
            strlen = struct.unpack('b', self.path_or_buf.read(1))[0]
            return self.path_or_buf.read(strlen).decode("utf-8")
        elif self.format_version == 117:
            strlen = struct.unpack('b', self.path_or_buf.read(1))[0]
            return self._null_terminate(self.path_or_buf.read(strlen))
        elif self.format_version > 104:
            return self._null_terminate(self.path_or_buf.read(18))
        else:
            raise ValueError()

    def _get_seek_variable_labels(self):
        if self.format_version == 117:
            self.path_or_buf.read(8)  # <variable_lables>, throw away
            # Stata 117 data files do not follow the described format.  This is
            # a work around that uses the previous label, 33 bytes for each
            # variable, 20 for the closing tag and 17 for the opening tag
            return self._seek_value_label_names + (33 * self.nvar) + 20 + 17
        elif self.format_version == 118:
            return struct.unpack(self.byteorder + 'q',
                                 self.path_or_buf.read(8))[0] + 17
        else:
            raise ValueError()

    def _read_old_header(self, first_char):
        self.format_version = struct.unpack('b', first_char)[0]
        if self.format_version not in [104, 105, 108, 111, 113, 114, 115]:
            raise ValueError(_version_error)
        self.byteorder = struct.unpack('b', self.path_or_buf.read(1))[
            0] == 0x1 and '>' or '<'
        self.filetype = struct.unpack('b', self.path_or_buf.read(1))[0]
        self.path_or_buf.read(1)  # unused

        self.nvar = struct.unpack(self.byteorder + 'H',
                                  self.path_or_buf.read(2))[0]
        self.nobs = self._get_nobs()

        self.data_label = self._get_data_label()

        self.time_stamp = self._get_time_stamp()

        # descriptors
        if self.format_version > 108:
            typlist = [ord(self.path_or_buf.read(1))
                       for i in range(self.nvar)]
        else:
            buf = self.path_or_buf.read(self.nvar)
            typlistb = np.frombuffer(buf, dtype=np.uint8)
            typlist = []
            for tp in typlistb:
                if tp in self.OLD_TYPE_MAPPING:
                    typlist.append(self.OLD_TYPE_MAPPING[tp])
                else:
                    typlist.append(tp - 127)  # py2 string, py3 bytes

        try:
            self.typlist = [self.TYPE_MAP[typ] for typ in typlist]
        except:
            raise ValueError("cannot convert stata types [{0}]"
                             .format(','.join(str(x) for x in typlist)))
        try:
            self.dtyplist = [self.DTYPE_MAP[typ] for typ in typlist]
        except:
            raise ValueError("cannot convert stata dtypes [{0}]"
                             .format(','.join(str(x) for x in typlist)))

        if self.format_version > 108:
            self.varlist = [self._null_terminate(self.path_or_buf.read(33))
                            for i in range(self.nvar)]
        else:
            self.varlist = [self._null_terminate(self.path_or_buf.read(9))
                            for i in range(self.nvar)]
        self.srtlist = struct.unpack(
            self.byteorder + ('h' * (self.nvar + 1)),
            self.path_or_buf.read(2 * (self.nvar + 1))
        )[:-1]

        self.fmtlist = self._get_fmtlist()

        self.lbllist = self._get_lbllist()

        self._variable_labels = self._get_variable_labels()

        # ignore expansion fields (Format 105 and later)
        # When reading, read five bytes; the last four bytes now tell you
        # the size of the next read, which you discard.  You then continue
        # like this until you read 5 bytes of zeros.

        if self.format_version > 104:
            while True:
                data_type = struct.unpack(self.byteorder + 'b',
                                          self.path_or_buf.read(1))[0]
                if self.format_version > 108:
                    data_len = struct.unpack(self.byteorder + 'i',
                                             self.path_or_buf.read(4))[0]
                else:
                    data_len = struct.unpack(self.byteorder + 'h',
                                             self.path_or_buf.read(2))[0]
                if data_type == 0:
                    break
                self.path_or_buf.read(data_len)

        # necessary data to continue parsing
        self.data_location = self.path_or_buf.tell()

    def _calcsize(self, fmt):
        return (type(fmt) is int and fmt or
                struct.calcsize(self.byteorder + fmt))

    def _decode(self, s):
        s = s.partition(b"\0")[0]
        return s.decode('utf-8')

    def _null_terminate(self, s):
        if compat.PY3 or self._encoding is not None:
            # have bytes not strings, so must decode
            s = s.partition(b"\0")[0]
            return s.decode(self._encoding or self._default_encoding)
        else:
            null_byte = "\0"
            try:
                return s.lstrip(null_byte)[:s.index(null_byte)]
            except:
                return s

    def _read_value_labels(self):
        if self.format_version <= 108:
            # Value labels are not supported in version 108 and earlier.
            return
        if self._value_labels_read:
            # Don't read twice
            return

        if self.format_version >= 117:
            self.path_or_buf.seek(self.seek_value_labels)
        else:
            offset = self.nobs * self._dtype.itemsize
            self.path_or_buf.seek(self.data_location + offset)

        self._value_labels_read = True
        self.value_label_dict = dict()

        while True:
            if self.format_version >= 117:
                if self.path_or_buf.read(5) == b'</val':  # <lbl>
                    break  # end of value label table

            slength = self.path_or_buf.read(4)
            if not slength:
                break  # end of value label table (format < 117)
            if self.format_version <= 117:
                labname = self._null_terminate(self.path_or_buf.read(33))
            else:
                labname = self._decode(self.path_or_buf.read(129))
            self.path_or_buf.read(3)  # padding

            n = struct.unpack(self.byteorder + 'I',
                              self.path_or_buf.read(4))[0]
            txtlen = struct.unpack(self.byteorder + 'I',
                                   self.path_or_buf.read(4))[0]
            off = np.frombuffer(self.path_or_buf.read(4 * n),
                                dtype=self.byteorder + "i4",
                                count=n)
            val = np.frombuffer(self.path_or_buf.read(4 * n),
                                dtype=self.byteorder + "i4",
                                count=n)
            ii = np.argsort(off)
            off = off[ii]
            val = val[ii]
            txt = self.path_or_buf.read(txtlen)
            self.value_label_dict[labname] = dict()
            for i in range(n):
                end = off[i + 1] if i < n - 1 else txtlen
                if self.format_version <= 117:
                    self.value_label_dict[labname][val[i]] = (
                        self._null_terminate(txt[off[i]:end]))
                else:
                    self.value_label_dict[labname][val[i]] = (
                        self._decode(txt[off[i]:end]))
            if self.format_version >= 117:
                self.path_or_buf.read(6)  # </lbl>
        self._value_labels_read = True

    def _read_strls(self):
        self.path_or_buf.seek(self.seek_strls)
        # Wrap v_o in a string to allow uint64 values as keys on 32bit OS
        self.GSO = {'0': ''}
        while True:
            if self.path_or_buf.read(3) != b'GSO':
                break

            if self.format_version == 117:
                v_o = struct.unpack(self.byteorder + 'Q',
                                    self.path_or_buf.read(8))[0]
            else:
                buf = self.path_or_buf.read(12)
                # Only tested on little endian file on little endian machine.
                if self.byteorder == '<':
                    buf = buf[0:2] + buf[4:10]
                else:
                    buf = buf[0:2] + buf[6:]
                v_o = struct.unpack('Q', buf)[0]
            typ = struct.unpack('B', self.path_or_buf.read(1))[0]
            length = struct.unpack(self.byteorder + 'I',
                                   self.path_or_buf.read(4))[0]
            va = self.path_or_buf.read(length)
            if typ == 130:
                encoding = 'utf-8'
                if self.format_version == 117:
                    encoding = self._encoding or self._default_encoding
                va = va[0:-1].decode(encoding)
            # Wrap v_o in a string to allow uint64 values as keys on 32bit OS
            self.GSO[str(v_o)] = va

    # legacy
    @Appender('DEPRECATED: ' + _data_method_doc)
    def data(self, **kwargs):

        import warnings
        warnings.warn("'data' is deprecated, use 'read' instead")

        if self._data_read:
            raise Exception("Data has already been read.")
        self._data_read = True

        return self.read(None, **kwargs)

    def __next__(self):
        return self.read(nrows=self._chunksize or 1)

    def get_chunk(self, size=None):
        """
        Reads lines from Stata file and returns as dataframe

        Parameters
        ----------
        size : int, defaults to None
            Number of lines to read.  If None, reads whole file.

        Returns
        -------
        DataFrame
        """
        if size is None:
            size = self._chunksize
        return self.read(nrows=size)

    @Appender(_read_method_doc)
    def read(self, nrows=None, convert_dates=None,
             convert_categoricals=None, index=None,
             convert_missing=None, preserve_dtypes=None,
             columns=None, order_categoricals=None):
        # Handle empty file or chunk.  If reading incrementally raise
        # StopIteration.  If reading the whole thing return an empty
        # data frame.
        if (self.nobs == 0) and (nrows is None):
            self._can_read_value_labels = True
            self._data_read = True
            self.close()
            return DataFrame(columns=self.varlist)

        # Handle options
        if convert_dates is None:
            convert_dates = self._convert_dates
        if convert_categoricals is None:
            convert_categoricals = self._convert_categoricals
        if convert_missing is None:
            convert_missing = self._convert_missing
        if preserve_dtypes is None:
            preserve_dtypes = self._preserve_dtypes
        if columns is None:
            columns = self._columns
        if order_categoricals is None:
            order_categoricals = self._order_categoricals

        if nrows is None:
            nrows = self.nobs

        if (self.format_version >= 117) and (self._dtype is None):
            self._can_read_value_labels = True
            self._read_strls()

        # Setup the dtype.
        if self._dtype is None:
            dtype = []  # Convert struct data types to numpy data type
            for i, typ in enumerate(self.typlist):
                if typ in self.NUMPY_TYPE_MAP:
                    dtype.append(('s' + str(i), self.byteorder +
                                  self.NUMPY_TYPE_MAP[typ]))
                else:
                    dtype.append(('s' + str(i), 'S' + str(typ)))
            dtype = np.dtype(dtype)
            self._dtype = dtype

        # Read data
        dtype = self._dtype
        max_read_len = (self.nobs - self._lines_read) * dtype.itemsize
        read_len = nrows * dtype.itemsize
        read_len = min(read_len, max_read_len)
        if read_len <= 0:
            # Iterator has finished, should never be here unless
            # we are reading the file incrementally
            if convert_categoricals:
                self._read_value_labels()
            self.close()
            raise StopIteration
        offset = self._lines_read * dtype.itemsize
        self.path_or_buf.seek(self.data_location + offset)
        read_lines = min(nrows, self.nobs - self._lines_read)
        data = np.frombuffer(self.path_or_buf.read(read_len), dtype=dtype,
                             count=read_lines)

        self._lines_read += read_lines
        if self._lines_read == self.nobs:
            self._can_read_value_labels = True
            self._data_read = True
        # if necessary, swap the byte order to native here
        if self.byteorder != self._native_byteorder:
            data = data.byteswap().newbyteorder()

        if convert_categoricals:
            self._read_value_labels()

        if len(data) == 0:
            data = DataFrame(columns=self.varlist, index=index)
        else:
            data = DataFrame.from_records(data, index=index)
            data.columns = self.varlist

        # If index is not specified, use actual row number rather than
        # restarting at 0 for each chunk.
        if index is None:
            ix = np.arange(self._lines_read - read_lines, self._lines_read)
            data = data.set_index(ix)

        if columns is not None:
            try:
                data = self._do_select_columns(data, columns)
            except ValueError:
                self.close()
                raise

        # Decode strings
        for col, typ in zip(data, self.typlist):
            if type(typ) is int:
                data[col] = data[col].apply(
                    self._null_terminate, convert_dtype=True)

        data = self._insert_strls(data)

        cols_ = np.where(self.dtyplist)[0]

        # Convert columns (if needed) to match input type
        index = data.index
        requires_type_conversion = False
        data_formatted = []
        for i in cols_:
            if self.dtyplist[i] is not None:
                col = data.columns[i]
                dtype = data[col].dtype
                if dtype != np.dtype(object) and dtype != self.dtyplist[i]:
                    requires_type_conversion = True
                    data_formatted.append(
                        (col, Series(data[col], index, self.dtyplist[i])))
                else:
                    data_formatted.append((col, data[col]))
        if requires_type_conversion:
            data = DataFrame.from_items(data_formatted)
        del data_formatted

        self._do_convert_missing(data, convert_missing)

        if convert_dates:
            cols = np.where(lmap(lambda x: x in _date_formats,
                                 self.fmtlist))[0]
            for i in cols:
                col = data.columns[i]
                try:
                    data[col] = _stata_elapsed_date_to_datetime_vec(
                        data[col],
                        self.fmtlist[i])
                except ValueError:
                    self.close()
                    raise

        if convert_categoricals and self.format_version > 108:
            data = self._do_convert_categoricals(data,
                                                 self.value_label_dict,
                                                 self.lbllist,
                                                 order_categoricals)

        if not preserve_dtypes:
            retyped_data = []
            convert = False
            for col in data:
                dtype = data[col].dtype
                if dtype in (np.float16, np.float32):
                    dtype = np.float64
                    convert = True
                elif dtype in (np.int8, np.int16, np.int32):
                    dtype = np.int64
                    convert = True
                retyped_data.append((col, data[col].astype(dtype)))
            if convert:
                data = DataFrame.from_items(retyped_data)

        return data

    def _do_convert_missing(self, data, convert_missing):
        # Check for missing values, and replace if found

        for i, colname in enumerate(data):
            fmt = self.typlist[i]
            if fmt not in self.VALID_RANGE:
                continue

            nmin, nmax = self.VALID_RANGE[fmt]
            series = data[colname]
            missing = np.logical_or(series < nmin, series > nmax)

            if not missing.any():
                continue

            if convert_missing:  # Replacement follows Stata notation
                missing_loc = np.argwhere(missing)
                umissing, umissing_loc = np.unique(series[missing],
                                                   return_inverse=True)
                replacement = Series(series, dtype=np.object)
                for j, um in enumerate(umissing):
                    missing_value = StataMissingValue(um)

                    loc = missing_loc[umissing_loc == j]
                    replacement.iloc[loc] = missing_value
            else:  # All replacements are identical
                dtype = series.dtype
                if dtype not in (np.float32, np.float64):
                    dtype = np.float64
                replacement = Series(series, dtype=dtype)
                replacement[missing] = np.nan

            data[colname] = replacement

    def _insert_strls(self, data):
        if not hasattr(self, 'GSO') or len(self.GSO) == 0:
            return data
        for i, typ in enumerate(self.typlist):
            if typ != 'Q':
                continue
            # Wrap v_o in a string to allow uint64 values as keys on 32bit OS
            data.iloc[:, i] = [self.GSO[str(k)] for k in data.iloc[:, i]]
        return data

    def _do_select_columns(self, data, columns):

        if not self._column_selector_set:
            column_set = set(columns)
            if len(column_set) != len(columns):
                raise ValueError('columns contains duplicate entries')
            unmatched = column_set.difference(data.columns)
            if unmatched:
                raise ValueError('The following columns were not found in the '
                                 'Stata data set: ' +
                                 ', '.join(list(unmatched)))
            # Copy information for retained columns for later processing
            dtyplist = []
            typlist = []
            fmtlist = []
            lbllist = []
            for col in columns:
                i = data.columns.get_loc(col)
                dtyplist.append(self.dtyplist[i])
                typlist.append(self.typlist[i])
                fmtlist.append(self.fmtlist[i])
                lbllist.append(self.lbllist[i])

            self.dtyplist = dtyplist
            self.typlist = typlist
            self.fmtlist = fmtlist
            self.lbllist = lbllist
            self._column_selector_set = True

        return data[columns]

    def _do_convert_categoricals(self, data, value_label_dict, lbllist,
                                 order_categoricals):
        """
        Converts categorical columns to Categorical type.
        """
        value_labels = list(compat.iterkeys(value_label_dict))
        cat_converted_data = []
        for col, label in zip(data, lbllist):
            if label in value_labels:
                # Explicit call with ordered=True
                cat_data = Categorical(data[col], ordered=order_categoricals)
                categories = []
                for category in cat_data.categories:
                    if category in value_label_dict[label]:
                        categories.append(value_label_dict[label][category])
                    else:
                        categories.append(category)  # Partially labeled
                try:
                    cat_data.categories = categories
                except ValueError:
                    vc = Series(categories).value_counts()
                    repeats = list(vc.index[vc > 1])
                    repeats = '\n' + '-' * 80 + '\n'.join(repeats)
                    msg = 'Value labels for column {0} are not unique. The ' \
                          'repeated labels are:\n{1}'.format(col, repeats)
                    raise ValueError(msg)
                # TODO: is the next line needed above in the data(...) method?
                cat_data = Series(cat_data, index=data.index)
                cat_converted_data.append((col, cat_data))
            else:
                cat_converted_data.append((col, data[col]))
        data = DataFrame.from_items(cat_converted_data)
        return data

    def data_label(self):
        """Returns data label of Stata file"""
        return self.data_label

    def variable_labels(self):
        """Returns variable labels as a dict, associating each variable name
        with corresponding label
        """
        return dict(zip(self.varlist, self._variable_labels))

    def value_labels(self):
        """Returns a dict, associating each variable name a dict, associating
        each value its corresponding label
        """
        if not self._value_labels_read:
            self._read_value_labels()

        return self.value_label_dict


def _open_file_binary_write(fname, encoding):
    if hasattr(fname, 'write'):
        # if 'b' not in fname.mode:
        return fname
    return open(fname, "wb")


def _set_endianness(endianness):
    if endianness.lower() in ["<", "little"]:
        return "<"
    elif endianness.lower() in [">", "big"]:
        return ">"
    else:  # pragma : no cover
        raise ValueError("Endianness %s not understood" % endianness)


def _pad_bytes(name, length):
    """
    Takes a char string and pads it with null bytes until it's length chars
    """
    return name + "\x00" * (length - len(name))


def _convert_datetime_to_stata_type(fmt):
    """
    Converts from one of the stata date formats to a type in TYPE_MAP
    """
    if fmt in ["tc", "%tc", "td", "%td", "tw", "%tw", "tm", "%tm", "tq",
               "%tq", "th", "%th", "ty", "%ty"]:
        return np.float64  # Stata expects doubles for SIFs
    else:
        raise NotImplementedError("Format %s not implemented" % fmt)


def _maybe_convert_to_int_keys(convert_dates, varlist):
    new_dict = {}
    for key in convert_dates:
        if not convert_dates[key].startswith("%"):  # make sure proper fmts
            convert_dates[key] = "%" + convert_dates[key]
        if key in varlist:
            new_dict.update({varlist.index(key): convert_dates[key]})
        else:
            if not isinstance(key, int):
                raise ValueError("convert_dates key must be a "
                                 "column or an integer")
            new_dict.update({key: convert_dates[key]})
    return new_dict


def _dtype_to_stata_type(dtype, column):
    """
    Converts dtype types to stata types. Returns the byte of the given ordinal.
    See TYPE_MAP and comments for an explanation. This is also explained in
    the dta spec.
    1 - 244 are strings of this length
                         Pandas    Stata
    251 - chr(251) - for int8      byte
    252 - chr(252) - for int16     int
    253 - chr(253) - for int32     long
    254 - chr(254) - for float32   float
    255 - chr(255) - for double    double

    If there are dates to convert, then dtype will already have the correct
    type inserted.
    """
    # TODO: expand to handle datetime to integer conversion
    if dtype.type == np.string_:
        return chr(dtype.itemsize)
    elif dtype.type == np.object_:  # try to coerce it to the biggest string
                                    # not memory efficient, what else could we
                                    # do?
        itemsize = max_len_string_array(_ensure_object(column.values))
        return chr(max(itemsize, 1))
    elif dtype == np.float64:
        return chr(255)
    elif dtype == np.float32:
        return chr(254)
    elif dtype == np.int32:
        return chr(253)
    elif dtype == np.int16:
        return chr(252)
    elif dtype == np.int8:
        return chr(251)
    else:  # pragma : no cover
        raise NotImplementedError("Data type %s not supported." % dtype)


def _dtype_to_default_stata_fmt(dtype, column):
    """
    Maps numpy dtype to stata's default format for this type. Not terribly
    important since users can change this in Stata. Semantics are

    object  -> "%DDs" where DD is the length of the string.  If not a string,
                raise ValueError
    float64 -> "%10.0g"
    float32 -> "%9.0g"
    int64   -> "%9.0g"
    int32   -> "%12.0g"
    int16   -> "%8.0g"
    int8    -> "%8.0g"
    """
    # TODO: Refactor to combine type with format
    # TODO: expand this to handle a default datetime format?
    if dtype.type == np.object_:
        inferred_dtype = infer_dtype(column.dropna())
        if not (inferred_dtype in ('string', 'unicode') or
                len(column) == 0):
            raise ValueError('Writing general object arrays is not supported')
        itemsize = max_len_string_array(_ensure_object(column.values))
        if itemsize > 244:
            raise ValueError(excessive_string_length_error % column.name)
        return "%" + str(max(itemsize, 1)) + "s"
    elif dtype == np.float64:
        return "%10.0g"
    elif dtype == np.float32:
        return "%9.0g"
    elif dtype == np.int32:
        return "%12.0g"
    elif dtype == np.int8 or dtype == np.int16:
        return "%8.0g"
    else:  # pragma : no cover
        raise NotImplementedError("Data type %s not supported." % dtype)


class StataWriter(StataParser):
    """
    A class for writing Stata binary dta files

    Parameters
    ----------
    fname : str or buffer
        String path of file-like object
    data : DataFrame
        Input to save
    convert_dates : dict
        Dictionary mapping columns containing datetime types to stata internal
        format to use when wirting the dates. Options are 'tc', 'td', 'tm',
        'tw', 'th', 'tq', 'ty'. Column can be either an integer or a name.
        Datetime columns that do not have a conversion type specified will be
        converted to 'tc'. Raises NotImplementedError if a datetime column has
        timezone information
    write_index : bool
        Write the index to Stata dataset.
    encoding : str
        Default is latin-1. Only latin-1 and ascii are supported.
    byteorder : str
        Can be ">", "<", "little", or "big". default is `sys.byteorder`
    time_stamp : datetime
        A datetime to use as file creation date.  Default is the current time
    dataset_label : str
        A label for the data set.  Must be 80 characters or smaller.
    variable_labels : dict
        Dictionary containing columns as keys and variable labels as values.
        Each label must be 80 characters or smaller.

        .. versionadded:: 0.19.0

    Returns
    -------
    writer : StataWriter instance
        The StataWriter instance has a write_file method, which will
        write the file to the given `fname`.

    Raises
    ------
    NotImplementedError
        * If datetimes contain timezone information
    ValueError
        * Columns listed in convert_dates are noth either datetime64[ns]
          or datetime.datetime
        * Column dtype is not representable in Stata
        * Column listed in convert_dates is not in DataFrame
        * Categorical label contains more than 32,000 characters

    Examples
    --------
    >>> import pandas as pd
    >>> data = pd.DataFrame([[1.0, 1]], columns=['a', 'b'])
    >>> writer = StataWriter('./data_file.dta', data)
    >>> writer.write_file()

    Or with dates
    >>> from datetime import datetime
    >>> data = pd.DataFrame([[datetime(2000,1,1)]], columns=['date'])
    >>> writer = StataWriter('./date_data_file.dta', data, {'date' : 'tw'})
    >>> writer.write_file()
    """

    def __init__(self, fname, data, convert_dates=None, write_index=True,
                 encoding="latin-1", byteorder=None, time_stamp=None,
                 data_label=None, variable_labels=None):
        super(StataWriter, self).__init__(encoding)
        self._convert_dates = {} if convert_dates is None else convert_dates
        self._write_index = write_index
        self._time_stamp = time_stamp
        self._data_label = data_label
        self._variable_labels = variable_labels
        # attach nobs, nvars, data, varlist, typlist
        self._prepare_pandas(data)

        if byteorder is None:
            byteorder = sys.byteorder
        self._byteorder = _set_endianness(byteorder)
        self._fname = fname
        self.type_converters = {253: np.int32, 252: np.int16, 251: np.int8}

    def _write(self, to_write):
        """
        Helper to call encode before writing to file for Python 3 compat.
        """
        if compat.PY3:
            self._file.write(to_write.encode(self._encoding or
                                             self._default_encoding))
        else:
            self._file.write(to_write)

    def _prepare_categoricals(self, data):
        """Check for categorical columns, retain categorical information for
        Stata file and convert categorical data to int"""

        is_cat = [is_categorical_dtype(data[col]) for col in data]
        self._is_col_cat = is_cat
        self._value_labels = []
        if not any(is_cat):
            return data

        get_base_missing_value = StataMissingValue.get_base_missing_value
        index = data.index
        data_formatted = []
        for col, col_is_cat in zip(data, is_cat):
            if col_is_cat:
                self._value_labels.append(StataValueLabel(data[col]))
                dtype = data[col].cat.codes.dtype
                if dtype == np.int64:
                    raise ValueError('It is not possible to export '
                                     'int64-based categorical data to Stata.')
                values = data[col].cat.codes.values.copy()

                # Upcast if needed so that correct missing values can be set
                if values.max() >= get_base_missing_value(dtype):
                    if dtype == np.int8:
                        dtype = np.int16
                    elif dtype == np.int16:
                        dtype = np.int32
                    else:
                        dtype = np.float64
                    values = np.array(values, dtype=dtype)

                # Replace missing values with Stata missing value for type
                values[values == -1] = get_base_missing_value(dtype)
                data_formatted.append((col, values, index))

            else:
                data_formatted.append((col, data[col]))
        return DataFrame.from_items(data_formatted)

    def _replace_nans(self, data):
        # return data
        """Checks floating point data columns for nans, and replaces these with
        the generic Stata for missing value (.)"""
        for c in data:
            dtype = data[c].dtype
            if dtype in (np.float32, np.float64):
                if dtype == np.float32:
                    replacement = self.MISSING_VALUES['f']
                else:
                    replacement = self.MISSING_VALUES['d']
                data[c] = data[c].fillna(replacement)

        return data

    def _check_column_names(self, data):
        """
        Checks column names to ensure that they are valid Stata column names.
        This includes checks for:
            * Non-string names
            * Stata keywords
            * Variables that start with numbers
            * Variables with names that are too long

        When an illegal variable name is detected, it is converted, and if
        dates are exported, the variable name is propagated to the date
        conversion dictionary
        """
        converted_names = []
        columns = list(data.columns)
        original_columns = columns[:]

        duplicate_var_id = 0
        for j, name in enumerate(columns):
            orig_name = name
            if not isinstance(name, string_types):
                name = text_type(name)

            for c in name:
                if (c < 'A' or c > 'Z') and (c < 'a' or c > 'z') and \
                        (c < '0' or c > '9') and c != '_':
                    name = name.replace(c, '_')

            # Variable name must not be a reserved word
            if name in self.RESERVED_WORDS:
                name = '_' + name

            # Variable name may not start with a number
            if name[0] >= '0' and name[0] <= '9':
                name = '_' + name

            name = name[:min(len(name), 32)]

            if not name == orig_name:
                # check for duplicates
                while columns.count(name) > 0:
                    # prepend ascending number to avoid duplicates
                    name = '_' + str(duplicate_var_id) + name
                    name = name[:min(len(name), 32)]
                    duplicate_var_id += 1

                # need to possibly encode the orig name if its unicode
                try:
                    orig_name = orig_name.encode('utf-8')
                except:
                    pass
                converted_names.append(
                    '{0}   ->   {1}'.format(orig_name, name))

            columns[j] = name

        data.columns = columns

        # Check date conversion, and fix key if needed
        if self._convert_dates:
            for c, o in zip(columns, original_columns):
                if c != o:
                    self._convert_dates[c] = self._convert_dates[o]
                    del self._convert_dates[o]

        if converted_names:
            import warnings

            ws = invalid_name_doc.format('\n    '.join(converted_names))
            warnings.warn(ws, InvalidColumnName)

        return data

    def _prepare_pandas(self, data):
        # NOTE: we might need a different API / class for pandas objects so
        # we can set different semantics - handle this with a PR to pandas.io

        data = data.copy()

        if self._write_index:
            data = data.reset_index()

        # Ensure column names are strings
        data = self._check_column_names(data)

        # Check columns for compatibility with stata, upcast if necessary
        # Raise if outside the supported range
        data = _cast_to_stata_types(data)

        # Replace NaNs with Stata missing values
        data = self._replace_nans(data)

        # Convert categoricals to int data, and strip labels
        data = self._prepare_categoricals(data)

        self.nobs, self.nvar = data.shape
        self.data = data
        self.varlist = data.columns.tolist()

        dtypes = data.dtypes

        # Ensure all date columns are converted
        for col in data:
            if col in self._convert_dates:
                continue
            if is_datetime64_dtype(data[col]):
                self._convert_dates[col] = 'tc'

        self._convert_dates = _maybe_convert_to_int_keys(self._convert_dates,
                                                         self.varlist)
        for key in self._convert_dates:
            new_type = _convert_datetime_to_stata_type(
                self._convert_dates[key]
            )
            dtypes[key] = np.dtype(new_type)

        self.typlist = []
        self.fmtlist = []
        for col, dtype in dtypes.iteritems():
            self.fmtlist.append(_dtype_to_default_stata_fmt(dtype, data[col]))
            self.typlist.append(_dtype_to_stata_type(dtype, data[col]))

        # set the given format for the datetime cols
        if self._convert_dates is not None:
            for key in self._convert_dates:
                self.fmtlist[key] = self._convert_dates[key]

    def write_file(self):
        self._file = _open_file_binary_write(
            self._fname, self._encoding or self._default_encoding
        )
        try:
            self._write_header(time_stamp=self._time_stamp,
                               data_label=self._data_label)
            self._write_descriptors()
            self._write_variable_labels()
            # write 5 zeros for expansion fields
            self._write(_pad_bytes("", 5))
            self._prepare_data()
            self._write_data()
            self._write_value_labels()
        finally:
            self._file.close()

    def _write_value_labels(self):
        for vl in self._value_labels:
            self._file.write(vl.generate_value_label(self._byteorder,
                                                     self._encoding))

    def _write_header(self, data_label=None, time_stamp=None):
        byteorder = self._byteorder
        # ds_format - just use 114
        self._file.write(struct.pack("b", 114))
        # byteorder
        self._write(byteorder == ">" and "\x01" or "\x02")
        # filetype
        self._write("\x01")
        # unused
        self._write("\x00")
        # number of vars, 2 bytes
        self._file.write(struct.pack(byteorder + "h", self.nvar)[:2])
        # number of obs, 4 bytes
        self._file.write(struct.pack(byteorder + "i", self.nobs)[:4])
        # data label 81 bytes, char, null terminated
        if data_label is None:
            self._file.write(self._null_terminate(_pad_bytes("", 80)))
        else:
            self._file.write(
                self._null_terminate(_pad_bytes(data_label[:80], 80))
            )
        # time stamp, 18 bytes, char, null terminated
        # format dd Mon yyyy hh:mm
        if time_stamp is None:
            time_stamp = datetime.datetime.now()
        elif not isinstance(time_stamp, datetime.datetime):
            raise ValueError("time_stamp should be datetime type")
        # GH #13856
        # Avoid locale-specific month conversion
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
                  'Sep', 'Oct', 'Nov', 'Dec']
        month_lookup = {i + 1: month for i, month in enumerate(months)}
        ts = (time_stamp.strftime("%d ") +
              month_lookup[time_stamp.month] +
              time_stamp.strftime(" %Y %H:%M"))
        self._file.write(self._null_terminate(ts))

    def _write_descriptors(self, typlist=None, varlist=None, srtlist=None,
                           fmtlist=None, lbllist=None):
        nvar = self.nvar
        # typlist, length nvar, format byte array
        for typ in self.typlist:
            self._write(typ)

        # varlist names are checked by _check_column_names
        # varlist, requires null terminated
        for name in self.varlist:
            name = self._null_terminate(name, True)
            name = _pad_bytes(name[:32], 33)
            self._write(name)

        # srtlist, 2*(nvar+1), int array, encoded by byteorder
        srtlist = _pad_bytes("", 2 * (nvar + 1))
        self._write(srtlist)

        # fmtlist, 49*nvar, char array
        for fmt in self.fmtlist:
            self._write(_pad_bytes(fmt, 49))

        # lbllist, 33*nvar, char array
        for i in range(nvar):
            # Use variable name when categorical
            if self._is_col_cat[i]:
                name = self.varlist[i]
                name = self._null_terminate(name, True)
                name = _pad_bytes(name[:32], 33)
                self._write(name)
            else:  # Default is empty label
                self._write(_pad_bytes("", 33))

    def _write_variable_labels(self):
        # Missing labels are 80 blank characters plus null termination
        blank = _pad_bytes('', 81)

        if self._variable_labels is None:
            for i in range(self.nvar):
                self._write(blank)
            return

        for col in self.data:
            if col in self._variable_labels:
                label = self._variable_labels[col]
                if len(label) > 80:
                    raise ValueError('Variable labels must be 80 characters '
                                     'or fewer')
                is_latin1 = all(ord(c) < 256 for c in label)
                if not is_latin1:
                    raise ValueError('Variable labels must contain only '
                                     'characters that can be encoded in '
                                     'Latin-1')
                self._write(_pad_bytes(label, 81))
            else:
                self._write(blank)

    def _prepare_data(self):
        data = self.data
        typlist = self.typlist
        convert_dates = self._convert_dates
        # 1. Convert dates
        if self._convert_dates is not None:
            for i, col in enumerate(data):
                if i in convert_dates:
                    data[col] = _datetime_to_stata_elapsed_vec(data[col],
                                                               self.fmtlist[i])

        # 2. Convert bad string data to '' and pad to correct length
        dtype = []
        data_cols = []
        has_strings = False
        for i, col in enumerate(data):
            typ = ord(typlist[i])
            if typ <= 244:
                has_strings = True
                data[col] = data[col].fillna('').apply(_pad_bytes, args=(typ,))
                stype = 'S%d' % typ
                dtype.append(('c' + str(i), stype))
                string = data[col].str.encode(self._encoding)
                data_cols.append(string.values.astype(stype))
            else:
                dtype.append(('c' + str(i), data[col].dtype))
                data_cols.append(data[col].values)
        dtype = np.dtype(dtype)

        if has_strings:
            self.data = np.fromiter(zip(*data_cols), dtype=dtype)
        else:
            self.data = data.to_records(index=False)

    def _write_data(self):
        data = self.data
        data.tofile(self._file)

    def _null_terminate(self, s, as_string=False):
        null_byte = '\x00'
        if compat.PY3 and not as_string:
            s += null_byte
            return s.encode(self._encoding)
        else:
            s += null_byte
            return s
