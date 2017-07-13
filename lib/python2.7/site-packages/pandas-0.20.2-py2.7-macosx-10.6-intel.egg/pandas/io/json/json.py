# pylint: disable-msg=E1101,W0613,W0603
import os
import numpy as np

import pandas._libs.json as json
from pandas._libs.tslib import iNaT
from pandas.compat import StringIO, long, u
from pandas import compat, isnull
from pandas import Series, DataFrame, to_datetime, MultiIndex
from pandas.io.common import get_filepath_or_buffer, _get_handle
from pandas.core.common import AbstractMethodError
from pandas.io.formats.printing import pprint_thing
from .normalize import _convert_to_line_delimits
from .table_schema import build_table_schema
from pandas.core.dtypes.common import is_period_dtype

loads = json.loads
dumps = json.dumps

TABLE_SCHEMA_VERSION = '0.20.0'


# interface to/from
def to_json(path_or_buf, obj, orient=None, date_format='epoch',
            double_precision=10, force_ascii=True, date_unit='ms',
            default_handler=None, lines=False):

    if lines and orient != 'records':
        raise ValueError(
            "'lines' keyword only valid when 'orient' is records")

    if orient == 'table' and isinstance(obj, Series):
        obj = obj.to_frame(name=obj.name or 'values')
    if orient == 'table' and isinstance(obj, DataFrame):
        writer = JSONTableWriter
    elif isinstance(obj, Series):
        writer = SeriesWriter
    elif isinstance(obj, DataFrame):
        writer = FrameWriter
    else:
        raise NotImplementedError("'obj' should be a Series or a DataFrame")

    s = writer(
        obj, orient=orient, date_format=date_format,
        double_precision=double_precision, ensure_ascii=force_ascii,
        date_unit=date_unit, default_handler=default_handler).write()

    if lines:
        s = _convert_to_line_delimits(s)

    if isinstance(path_or_buf, compat.string_types):
        with open(path_or_buf, 'w') as fh:
            fh.write(s)
    elif path_or_buf is None:
        return s
    else:
        path_or_buf.write(s)


class Writer(object):

    def __init__(self, obj, orient, date_format, double_precision,
                 ensure_ascii, date_unit, default_handler=None):
        self.obj = obj

        if orient is None:
            orient = self._default_orient

        self.orient = orient
        self.date_format = date_format
        self.double_precision = double_precision
        self.ensure_ascii = ensure_ascii
        self.date_unit = date_unit
        self.default_handler = default_handler

        self.is_copy = None
        self._format_axes()

    def _format_axes(self):
        raise AbstractMethodError(self)

    def write(self):
        return dumps(
            self.obj,
            orient=self.orient,
            double_precision=self.double_precision,
            ensure_ascii=self.ensure_ascii,
            date_unit=self.date_unit,
            iso_dates=self.date_format == 'iso',
            default_handler=self.default_handler
        )


class SeriesWriter(Writer):
    _default_orient = 'index'

    def _format_axes(self):
        if not self.obj.index.is_unique and self.orient == 'index':
            raise ValueError("Series index must be unique for orient="
                             "'%s'" % self.orient)


class FrameWriter(Writer):
    _default_orient = 'columns'

    def _format_axes(self):
        """ try to axes if they are datelike """
        if not self.obj.index.is_unique and self.orient in (
                'index', 'columns'):
            raise ValueError("DataFrame index must be unique for orient="
                             "'%s'." % self.orient)
        if not self.obj.columns.is_unique and self.orient in (
                'index', 'columns', 'records'):
            raise ValueError("DataFrame columns must be unique for orient="
                             "'%s'." % self.orient)


class JSONTableWriter(FrameWriter):
    _default_orient = 'records'

    def __init__(self, obj, orient, date_format, double_precision,
                 ensure_ascii, date_unit, default_handler=None):
        """
        Adds a `schema` attribut with the Table Schema, resets
        the index (can't do in caller, because the schema inference needs
        to know what the index is, forces orient to records, and forces
        date_format to 'iso'.
        """
        super(JSONTableWriter, self).__init__(
            obj, orient, date_format, double_precision, ensure_ascii,
            date_unit, default_handler=default_handler)

        if date_format != 'iso':
            msg = ("Trying to write with `orient='table'` and "
                   "`date_format='%s'`. Table Schema requires dates "
                   "to be formatted with `date_format='iso'`" % date_format)
            raise ValueError(msg)

        self.schema = build_table_schema(obj)

        # NotImplementd on a column MultiIndex
        if obj.ndim == 2 and isinstance(obj.columns, MultiIndex):
            raise NotImplementedError(
                "orient='table' is not supported for MultiIndex")

        # TODO: Do this timedelta properly in objToJSON.c See GH #15137
        if ((obj.ndim == 1) and (obj.name in set(obj.index.names)) or
                len(obj.columns & obj.index.names)):
            msg = "Overlapping names between the index and columns"
            raise ValueError(msg)

        obj = obj.copy()
        timedeltas = obj.select_dtypes(include=['timedelta']).columns
        if len(timedeltas):
            obj[timedeltas] = obj[timedeltas].applymap(
                lambda x: x.isoformat())
        # Convert PeriodIndex to datetimes before serialzing
        if is_period_dtype(obj.index):
            obj.index = obj.index.to_timestamp()

        self.obj = obj.reset_index()
        self.date_format = 'iso'
        self.orient = 'records'

    def write(self):
        data = super(JSONTableWriter, self).write()
        serialized = '{{"schema": {}, "data": {}}}'.format(
            dumps(self.schema), data)
        return serialized


def read_json(path_or_buf=None, orient=None, typ='frame', dtype=True,
              convert_axes=True, convert_dates=True, keep_default_dates=True,
              numpy=False, precise_float=False, date_unit=None, encoding=None,
              lines=False):
    """
    Convert a JSON string to pandas object

    Parameters
    ----------
    path_or_buf : a valid JSON string or file-like, default: None
        The string could be a URL. Valid URL schemes include http, ftp, s3, and
        file. For file URLs, a host is expected. For instance, a local file
        could be ``file://localhost/path/to/table.json``

    orient : string,
        Indication of expected JSON string format.
        Compatible JSON strings can be produced by ``to_json()`` with a
        corresponding orient value.
        The set of possible orients is:

        - ``'split'`` : dict like
          ``{index -> [index], columns -> [columns], data -> [values]}``
        - ``'records'`` : list like
          ``[{column -> value}, ... , {column -> value}]``
        - ``'index'`` : dict like ``{index -> {column -> value}}``
        - ``'columns'`` : dict like ``{column -> {index -> value}}``
        - ``'values'`` : just the values array

        The allowed and default values depend on the value
        of the `typ` parameter.

        * when ``typ == 'series'``,

          - allowed orients are ``{'split','records','index'}``
          - default is ``'index'``
          - The Series index must be unique for orient ``'index'``.

        * when ``typ == 'frame'``,

          - allowed orients are ``{'split','records','index',
            'columns','values'}``
          - default is ``'columns'``
          - The DataFrame index must be unique for orients ``'index'`` and
            ``'columns'``.
          - The DataFrame columns must be unique for orients ``'index'``,
            ``'columns'``, and ``'records'``.

    typ : type of object to recover (series or frame), default 'frame'
    dtype : boolean or dict, default True
        If True, infer dtypes, if a dict of column to dtype, then use those,
        if False, then don't infer dtypes at all, applies only to the data.
    convert_axes : boolean, default True
        Try to convert the axes to the proper dtypes.
    convert_dates : boolean, default True
        List of columns to parse for dates; If True, then try to parse
        datelike columns default is True; a column label is datelike if

        * it ends with ``'_at'``,

        * it ends with ``'_time'``,

        * it begins with ``'timestamp'``,

        * it is ``'modified'``, or

        * it is ``'date'``

    keep_default_dates : boolean, default True
        If parsing dates, then parse the default datelike columns
    numpy : boolean, default False
        Direct decoding to numpy arrays. Supports numeric data only, but
        non-numeric column and index labels are supported. Note also that the
        JSON ordering MUST be the same for each term if numpy=True.
    precise_float : boolean, default False
        Set to enable usage of higher precision (strtod) function when
        decoding string to double values. Default (False) is to use fast but
        less precise builtin functionality
    date_unit : string, default None
        The timestamp unit to detect if converting dates. The default behaviour
        is to try and detect the correct precision, but if this is not desired
        then pass one of 's', 'ms', 'us' or 'ns' to force parsing only seconds,
        milliseconds, microseconds or nanoseconds respectively.
    lines : boolean, default False
        Read the file as a json object per line.

        .. versionadded:: 0.19.0

    encoding : str, default is 'utf-8'
        The encoding to use to decode py3 bytes.

        .. versionadded:: 0.19.0

    Returns
    -------
    result : Series or DataFrame, depending on the value of `typ`.

    See Also
    --------
    DataFrame.to_json

    Examples
    --------

    >>> df = pd.DataFrame([['a', 'b'], ['c', 'd']],
    ...                   index=['row 1', 'row 2'],
    ...                   columns=['col 1', 'col 2'])

    Encoding/decoding a Dataframe using ``'split'`` formatted JSON:

    >>> df.to_json(orient='split')
    '{"columns":["col 1","col 2"],
      "index":["row 1","row 2"],
      "data":[["a","b"],["c","d"]]}'
    >>> pd.read_json(_, orient='split')
          col 1 col 2
    row 1     a     b
    row 2     c     d

    Encoding/decoding a Dataframe using ``'index'`` formatted JSON:

    >>> df.to_json(orient='index')
    '{"row 1":{"col 1":"a","col 2":"b"},"row 2":{"col 1":"c","col 2":"d"}}'
    >>> pd.read_json(_, orient='index')
          col 1 col 2
    row 1     a     b
    row 2     c     d

    Encoding/decoding a Dataframe using ``'records'`` formatted JSON.
    Note that index labels are not preserved with this encoding.

    >>> df.to_json(orient='records')
    '[{"col 1":"a","col 2":"b"},{"col 1":"c","col 2":"d"}]'
    >>> pd.read_json(_, orient='records')
      col 1 col 2
    0     a     b
    1     c     d

    Encoding with Table Schema

    >>> df.to_json(orient='table')
    '{"schema": {"fields": [{"name": "index", "type": "string"},
                            {"name": "col 1", "type": "string"},
                            {"name": "col 2", "type": "string"}],
                    "primaryKey": "index",
                    "pandas_version": "0.20.0"},
        "data": [{"index": "row 1", "col 1": "a", "col 2": "b"},
                {"index": "row 2", "col 1": "c", "col 2": "d"}]}'
    """

    filepath_or_buffer, _, _ = get_filepath_or_buffer(path_or_buf,
                                                      encoding=encoding)
    if isinstance(filepath_or_buffer, compat.string_types):
        try:
            exists = os.path.exists(filepath_or_buffer)

        # if the filepath is too long will raise here
        # 5874
        except (TypeError, ValueError):
            exists = False

        if exists:
            fh, handles = _get_handle(filepath_or_buffer, 'r',
                                      encoding=encoding)
            json = fh.read()
            fh.close()
        else:
            json = filepath_or_buffer
    elif hasattr(filepath_or_buffer, 'read'):
        json = filepath_or_buffer.read()
    else:
        json = filepath_or_buffer

    if lines:
        # If given a json lines file, we break the string into lines, add
        # commas and put it in a json list to make a valid json object.
        lines = list(StringIO(json.strip()))
        json = '[' + ','.join(lines) + ']'

    obj = None
    if typ == 'frame':
        obj = FrameParser(json, orient, dtype, convert_axes, convert_dates,
                          keep_default_dates, numpy, precise_float,
                          date_unit).parse()

    if typ == 'series' or obj is None:
        if not isinstance(dtype, bool):
            dtype = dict(data=dtype)
        obj = SeriesParser(json, orient, dtype, convert_axes, convert_dates,
                           keep_default_dates, numpy, precise_float,
                           date_unit).parse()

    return obj


class Parser(object):

    _STAMP_UNITS = ('s', 'ms', 'us', 'ns')
    _MIN_STAMPS = {
        's': long(31536000),
        'ms': long(31536000000),
        'us': long(31536000000000),
        'ns': long(31536000000000000)}

    def __init__(self, json, orient, dtype=True, convert_axes=True,
                 convert_dates=True, keep_default_dates=False, numpy=False,
                 precise_float=False, date_unit=None):
        self.json = json

        if orient is None:
            orient = self._default_orient

        self.orient = orient
        self.dtype = dtype

        if orient == "split":
            numpy = False

        if date_unit is not None:
            date_unit = date_unit.lower()
            if date_unit not in self._STAMP_UNITS:
                raise ValueError('date_unit must be one of %s' %
                                 (self._STAMP_UNITS,))
            self.min_stamp = self._MIN_STAMPS[date_unit]
        else:
            self.min_stamp = self._MIN_STAMPS['s']

        self.numpy = numpy
        self.precise_float = precise_float
        self.convert_axes = convert_axes
        self.convert_dates = convert_dates
        self.date_unit = date_unit
        self.keep_default_dates = keep_default_dates
        self.obj = None

    def check_keys_split(self, decoded):
        "checks that dict has only the appropriate keys for orient='split'"
        bad_keys = set(decoded.keys()).difference(set(self._split_keys))
        if bad_keys:
            bad_keys = ", ".join(bad_keys)
            raise ValueError(u("JSON data had unexpected key(s): %s") %
                             pprint_thing(bad_keys))

    def parse(self):

        # try numpy
        numpy = self.numpy
        if numpy:
            self._parse_numpy()

        else:
            self._parse_no_numpy()

        if self.obj is None:
            return None
        if self.convert_axes:
            self._convert_axes()
        self._try_convert_types()
        return self.obj

    def _convert_axes(self):
        """ try to convert axes """
        for axis in self.obj._AXIS_NUMBERS.keys():
            new_axis, result = self._try_convert_data(
                axis, self.obj._get_axis(axis), use_dtypes=False,
                convert_dates=True)
            if result:
                setattr(self.obj, axis, new_axis)

    def _try_convert_types(self):
        raise AbstractMethodError(self)

    def _try_convert_data(self, name, data, use_dtypes=True,
                          convert_dates=True):
        """ try to parse a ndarray like into a column by inferring dtype """

        # don't try to coerce, unless a force conversion
        if use_dtypes:
            if self.dtype is False:
                return data, False
            elif self.dtype is True:
                pass

            else:

                # dtype to force
                dtype = (self.dtype.get(name)
                         if isinstance(self.dtype, dict) else self.dtype)
                if dtype is not None:
                    try:
                        dtype = np.dtype(dtype)
                        return data.astype(dtype), True
                    except:
                        return data, False

        if convert_dates:
            new_data, result = self._try_convert_to_date(data)
            if result:
                return new_data, True

        result = False

        if data.dtype == 'object':

            # try float
            try:
                data = data.astype('float64')
                result = True
            except:
                pass

        if data.dtype.kind == 'f':

            if data.dtype != 'float64':

                # coerce floats to 64
                try:
                    data = data.astype('float64')
                    result = True
                except:
                    pass

        # do't coerce 0-len data
        if len(data) and (data.dtype == 'float' or data.dtype == 'object'):

            # coerce ints if we can
            try:
                new_data = data.astype('int64')
                if (new_data == data).all():
                    data = new_data
                    result = True
            except:
                pass

        # coerce ints to 64
        if data.dtype == 'int':

            # coerce floats to 64
            try:
                data = data.astype('int64')
                result = True
            except:
                pass

        return data, result

    def _try_convert_to_date(self, data):
        """ try to parse a ndarray like into a date column
            try to coerce object in epoch/iso formats and
            integer/float in epcoh formats, return a boolean if parsing
            was successful """

        # no conversion on empty
        if not len(data):
            return data, False

        new_data = data
        if new_data.dtype == 'object':
            try:
                new_data = data.astype('int64')
            except:
                pass

        # ignore numbers that are out of range
        if issubclass(new_data.dtype.type, np.number):
            in_range = (isnull(new_data.values) | (new_data > self.min_stamp) |
                        (new_data.values == iNaT))
            if not in_range.all():
                return data, False

        date_units = (self.date_unit,) if self.date_unit else self._STAMP_UNITS
        for date_unit in date_units:
            try:
                new_data = to_datetime(new_data, errors='raise',
                                       unit=date_unit)
            except ValueError:
                continue
            except:
                break
            return new_data, True
        return data, False

    def _try_convert_dates(self):
        raise AbstractMethodError(self)


class SeriesParser(Parser):
    _default_orient = 'index'
    _split_keys = ('name', 'index', 'data')

    def _parse_no_numpy(self):

        json = self.json
        orient = self.orient
        if orient == "split":
            decoded = dict((str(k), v)
                           for k, v in compat.iteritems(loads(
                               json,
                               precise_float=self.precise_float)))
            self.check_keys_split(decoded)
            self.obj = Series(dtype=None, **decoded)
        else:
            self.obj = Series(
                loads(json, precise_float=self.precise_float), dtype=None)

    def _parse_numpy(self):

        json = self.json
        orient = self.orient
        if orient == "split":
            decoded = loads(json, dtype=None, numpy=True,
                            precise_float=self.precise_float)
            decoded = dict((str(k), v) for k, v in compat.iteritems(decoded))
            self.check_keys_split(decoded)
            self.obj = Series(**decoded)
        elif orient == "columns" or orient == "index":
            self.obj = Series(*loads(json, dtype=None, numpy=True,
                                     labelled=True,
                                     precise_float=self.precise_float))
        else:
            self.obj = Series(loads(json, dtype=None, numpy=True,
                                    precise_float=self.precise_float))

    def _try_convert_types(self):
        if self.obj is None:
            return
        obj, result = self._try_convert_data(
            'data', self.obj, convert_dates=self.convert_dates)
        if result:
            self.obj = obj


class FrameParser(Parser):
    _default_orient = 'columns'
    _split_keys = ('columns', 'index', 'data')

    def _parse_numpy(self):

        json = self.json
        orient = self.orient

        if orient == "columns":
            args = loads(json, dtype=None, numpy=True, labelled=True,
                         precise_float=self.precise_float)
            if args:
                args = (args[0].T, args[2], args[1])
            self.obj = DataFrame(*args)
        elif orient == "split":
            decoded = loads(json, dtype=None, numpy=True,
                            precise_float=self.precise_float)
            decoded = dict((str(k), v) for k, v in compat.iteritems(decoded))
            self.check_keys_split(decoded)
            self.obj = DataFrame(**decoded)
        elif orient == "values":
            self.obj = DataFrame(loads(json, dtype=None, numpy=True,
                                       precise_float=self.precise_float))
        else:
            self.obj = DataFrame(*loads(json, dtype=None, numpy=True,
                                        labelled=True,
                                        precise_float=self.precise_float))

    def _parse_no_numpy(self):

        json = self.json
        orient = self.orient

        if orient == "columns":
            self.obj = DataFrame(
                loads(json, precise_float=self.precise_float), dtype=None)
        elif orient == "split":
            decoded = dict((str(k), v)
                           for k, v in compat.iteritems(loads(
                               json,
                               precise_float=self.precise_float)))
            self.check_keys_split(decoded)
            self.obj = DataFrame(dtype=None, **decoded)
        elif orient == "index":
            self.obj = DataFrame(
                loads(json, precise_float=self.precise_float), dtype=None).T
        else:
            self.obj = DataFrame(
                loads(json, precise_float=self.precise_float), dtype=None)

    def _process_converter(self, f, filt=None):
        """ take a conversion function and possibly recreate the frame """

        if filt is None:
            filt = lambda col, c: True

        needs_new_obj = False
        new_obj = dict()
        for i, (col, c) in enumerate(self.obj.iteritems()):
            if filt(col, c):
                new_data, result = f(col, c)
                if result:
                    c = new_data
                    needs_new_obj = True
            new_obj[i] = c

        if needs_new_obj:

            # possibly handle dup columns
            new_obj = DataFrame(new_obj, index=self.obj.index)
            new_obj.columns = self.obj.columns
            self.obj = new_obj

    def _try_convert_types(self):
        if self.obj is None:
            return
        if self.convert_dates:
            self._try_convert_dates()

        self._process_converter(
            lambda col, c: self._try_convert_data(col, c, convert_dates=False))

    def _try_convert_dates(self):
        if self.obj is None:
            return

        # our columns to parse
        convert_dates = self.convert_dates
        if convert_dates is True:
            convert_dates = []
        convert_dates = set(convert_dates)

        def is_ok(col):
            """ return if this col is ok to try for a date parse """
            if not isinstance(col, compat.string_types):
                return False

            col_lower = col.lower()
            if (col_lower.endswith('_at') or
                    col_lower.endswith('_time') or
                    col_lower == 'modified' or
                    col_lower == 'date' or
                    col_lower == 'datetime' or
                    col_lower.startswith('timestamp')):
                return True
            return False

        self._process_converter(
            lambda col, c: self._try_convert_to_date(c),
            lambda col, c: ((self.keep_default_dates and is_ok(col)) or
                            col in convert_dates))
