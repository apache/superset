"""
Table Schema builders

http://specs.frictionlessdata.io/json-table-schema/
"""
from pandas.core.dtypes.common import (
    is_integer_dtype, is_timedelta64_dtype, is_numeric_dtype,
    is_bool_dtype, is_datetime64_dtype, is_datetime64tz_dtype,
    is_categorical_dtype, is_period_dtype, is_string_dtype
)


def as_json_table_type(x):
    """
    Convert a NumPy / pandas type to its corresponding json_table.

    Parameters
    ----------
    x : array or dtype

    Returns
    -------
    t : str
        the Table Schema data types

    Notes
    -----
    This table shows the relationship between NumPy / pandas dtypes,
    and Table Schema dtypes.

    ==============  =================
    Pandas type     Table Schema type
    ==============  =================
    int64           integer
    float64         number
    bool            boolean
    datetime64[ns]  datetime
    timedelta64[ns] duration
    object          str
    categorical     any
    =============== =================
    """
    if is_integer_dtype(x):
        return 'integer'
    elif is_bool_dtype(x):
        return 'boolean'
    elif is_numeric_dtype(x):
        return 'number'
    elif (is_datetime64_dtype(x) or is_datetime64tz_dtype(x) or
          is_period_dtype(x)):
        return 'datetime'
    elif is_timedelta64_dtype(x):
        return 'duration'
    elif is_categorical_dtype(x):
        return 'any'
    elif is_string_dtype(x):
        return 'string'
    else:
        return 'any'


def set_default_names(data):
    """Sets index names to 'index' for regular, or 'level_x' for Multi"""
    if all(name is not None for name in data.index.names):
        return data

    data = data.copy()
    if data.index.nlevels > 1:
        names = [name if name is not None else 'level_{}'.format(i)
                 for i, name in enumerate(data.index.names)]
        data.index.names = names
    else:
        data.index.name = data.index.name or 'index'
    return data


def make_field(arr, dtype=None):
    dtype = dtype or arr.dtype
    if arr.name is None:
        name = 'values'
    else:
        name = arr.name
    field = {'name': name,
             'type': as_json_table_type(dtype)}

    if is_categorical_dtype(arr):
        if hasattr(arr, 'categories'):
            cats = arr.categories
            ordered = arr.ordered
        else:
            cats = arr.cat.categories
            ordered = arr.cat.ordered
        field['constraints'] = {"enum": list(cats)}
        field['ordered'] = ordered
    elif is_period_dtype(arr):
        field['freq'] = arr.freqstr
    elif is_datetime64tz_dtype(arr):
        if hasattr(arr, 'dt'):
            field['tz'] = arr.dt.tz.zone
        else:
            field['tz'] = arr.tz.zone
    return field


def build_table_schema(data, index=True, primary_key=None, version=True):
    """
    Create a Table schema from ``data``.

    Parameters
    ----------
    data : Series, DataFrame
    index : bool, default True
        Whether to include ``data.index`` in the schema.
    primary_key : bool or None, default True
        column names to designate as the primary key.
        The default `None` will set `'primaryKey'` to the index
        level or levels if the index is unique.
    version : bool, default True
        Whether to include a field `pandas_version` with the version
        of pandas that generated the schema.

    Returns
    -------
    schema : dict

    Examples
    --------
    >>> df = pd.DataFrame(
    ...     {'A': [1, 2, 3],
    ...      'B': ['a', 'b', 'c'],
    ...      'C': pd.date_range('2016-01-01', freq='d', periods=3),
    ...     }, index=pd.Index(range(3), name='idx'))
    >>> build_table_schema(df)
    {'fields': [{'name': 'idx', 'type': 'integer'},
    {'name': 'A', 'type': 'integer'},
    {'name': 'B', 'type': 'string'},
    {'name': 'C', 'type': 'datetime'}],
    'pandas_version': '0.20.0',
    'primaryKey': ['idx']}

    Notes
    -----
    See `_as_json_table_type` for conversion types.
    Timedeltas as converted to ISO8601 duration format with
    9 decimal places after the secnods field for nanosecond precision.

    Categoricals are converted to the `any` dtype, and use the `enum` field
    constraint to list the allowed values. The `ordered` attribute is included
    in an `ordered` field.
    """
    if index is True:
        data = set_default_names(data)

    schema = {}
    fields = []

    if index:
        if data.index.nlevels > 1:
            for level in data.index.levels:
                fields.append(make_field(level))
        else:
            fields.append(make_field(data.index))

    if data.ndim > 1:
        for column, s in data.iteritems():
            fields.append(make_field(s))
    else:
        fields.append(make_field(data))

    schema['fields'] = fields
    if index and data.index.is_unique and primary_key is None:
        if data.index.nlevels == 1:
            schema['primaryKey'] = [data.index.name]
        else:
            schema['primaryKey'] = data.index.names
    elif primary_key is not None:
        schema['primaryKey'] = primary_key

    if version:
        schema['pandas_version'] = '0.20.0'
    return schema
