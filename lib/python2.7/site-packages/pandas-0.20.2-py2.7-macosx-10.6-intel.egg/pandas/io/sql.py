# -*- coding: utf-8 -*-
"""
Collection of query wrappers / abstractions to both facilitate data
retrieval and to reduce dependency on DB-specific API.
"""

from __future__ import print_function, division
from datetime import datetime, date, time

import warnings
import re
import numpy as np

import pandas._libs.lib as lib
from pandas.core.dtypes.missing import isnull
from pandas.core.dtypes.dtypes import DatetimeTZDtype
from pandas.core.dtypes.common import (
    is_list_like, is_dict_like,
    is_datetime64tz_dtype)

from pandas.compat import (map, zip, raise_with_traceback,
                           string_types, text_type)
from pandas.core.api import DataFrame, Series
from pandas.core.base import PandasObject
from pandas.core.tools.datetimes import to_datetime

from contextlib import contextmanager


class SQLAlchemyRequired(ImportError):
    pass


class DatabaseError(IOError):
    pass


# -----------------------------------------------------------------------------
# -- Helper functions

_SQLALCHEMY_INSTALLED = None


def _validate_flavor_parameter(flavor):
    """
    Checks whether a database 'flavor' was specified.
    If not None, produces FutureWarning if 'sqlite' and
    raises a ValueError if anything else.
    """
    if flavor is not None:
        if flavor == 'sqlite':
            warnings.warn("the 'flavor' parameter is deprecated "
                          "and will be removed in a future version, "
                          "as 'sqlite' is the only supported option "
                          "when SQLAlchemy is not installed.",
                          FutureWarning, stacklevel=2)
        else:
            raise ValueError("database flavor {flavor} is not "
                             "supported".format(flavor=flavor))


def _is_sqlalchemy_connectable(con):
    global _SQLALCHEMY_INSTALLED
    if _SQLALCHEMY_INSTALLED is None:
        try:
            import sqlalchemy
            _SQLALCHEMY_INSTALLED = True

            from distutils.version import LooseVersion
            ver = LooseVersion(sqlalchemy.__version__)
            # For sqlalchemy versions < 0.8.2, the BIGINT type is recognized
            # for a sqlite engine, which results in a warning when trying to
            # read/write a DataFrame with int64 values. (GH7433)
            if ver < '0.8.2':
                from sqlalchemy import BigInteger
                from sqlalchemy.ext.compiler import compiles

                @compiles(BigInteger, 'sqlite')
                def compile_big_int_sqlite(type_, compiler, **kw):
                    return 'INTEGER'
        except ImportError:
            _SQLALCHEMY_INSTALLED = False

    if _SQLALCHEMY_INSTALLED:
        import sqlalchemy
        return isinstance(con, sqlalchemy.engine.Connectable)
    else:
        return False


def _convert_params(sql, params):
    """convert sql and params args to DBAPI2.0 compliant format"""
    args = [sql]
    if params is not None:
        if hasattr(params, 'keys'):  # test if params is a mapping
            args += [params]
        else:
            args += [list(params)]
    return args


def _handle_date_column(col, format=None):
    if isinstance(format, dict):
        return to_datetime(col, errors='ignore', **format)
    else:
        if format in ['D', 's', 'ms', 'us', 'ns']:
            return to_datetime(col, errors='coerce', unit=format, utc=True)
        elif (issubclass(col.dtype.type, np.floating) or
              issubclass(col.dtype.type, np.integer)):
            # parse dates as timestamp
            format = 's' if format is None else format
            return to_datetime(col, errors='coerce', unit=format, utc=True)
        elif is_datetime64tz_dtype(col):
            # coerce to UTC timezone
            # GH11216
            return (to_datetime(col, errors='coerce')
                    .astype('datetime64[ns, UTC]'))
        else:
            return to_datetime(col, errors='coerce', format=format, utc=True)


def _parse_date_columns(data_frame, parse_dates):
    """
    Force non-datetime columns to be read as such.
    Supports both string formatted and integer timestamp columns
    """
    # handle non-list entries for parse_dates gracefully
    if parse_dates is True or parse_dates is None or parse_dates is False:
        parse_dates = []

    if not hasattr(parse_dates, '__iter__'):
        parse_dates = [parse_dates]

    for col_name in parse_dates:
        df_col = data_frame[col_name]
        try:
            fmt = parse_dates[col_name]
        except TypeError:
            fmt = None
        data_frame[col_name] = _handle_date_column(df_col, format=fmt)

    # we want to coerce datetime64_tz dtypes for now
    # we could in theory do a 'nice' conversion from a FixedOffset tz
    # GH11216
    for col_name, df_col in data_frame.iteritems():
        if is_datetime64tz_dtype(df_col):
            data_frame[col_name] = _handle_date_column(df_col)

    return data_frame


def _wrap_result(data, columns, index_col=None, coerce_float=True,
                 parse_dates=None):
    """Wrap result set of query in a DataFrame """

    frame = DataFrame.from_records(data, columns=columns,
                                   coerce_float=coerce_float)

    _parse_date_columns(frame, parse_dates)

    if index_col is not None:
        frame.set_index(index_col, inplace=True)

    return frame


def execute(sql, con, cur=None, params=None):
    """
    Execute the given SQL query using the provided connection object.

    Parameters
    ----------
    sql : string
        Query to be executed
    con : SQLAlchemy connectable(engine/connection) or sqlite3 connection
        Using SQLAlchemy makes it possible to use any DB supported by that
        library.
        If a DBAPI2 object, only sqlite3 is supported.
    cur : deprecated, cursor is obtained from connection, default: None
    params : list or tuple, optional, default: None
        List of parameters to pass to execute method.

    Returns
    -------
    Results Iterable
    """
    if cur is None:
        pandas_sql = pandasSQL_builder(con)
    else:
        pandas_sql = pandasSQL_builder(cur, is_cursor=True)
    args = _convert_params(sql, params)
    return pandas_sql.execute(*args)


# -----------------------------------------------------------------------------
# -- Read and write to DataFrames

def read_sql_table(table_name, con, schema=None, index_col=None,
                   coerce_float=True, parse_dates=None, columns=None,
                   chunksize=None):
    """Read SQL database table into a DataFrame.

    Given a table name and an SQLAlchemy connectable, returns a DataFrame.
    This function does not support DBAPI connections.

    Parameters
    ----------
    table_name : string
        Name of SQL table in database
    con : SQLAlchemy connectable (or database string URI)
        Sqlite DBAPI connection mode not supported
    schema : string, default None
        Name of SQL schema in database to query (if database flavor
        supports this). If None, use default schema (default).
    index_col : string or list of strings, optional, default: None
        Column(s) to set as index(MultiIndex)
    coerce_float : boolean, default True
        Attempt to convert values of non-string, non-numeric objects (like
        decimal.Decimal) to floating point. Can result in loss of Precision.
    parse_dates : list or dict, default: None
        - List of column names to parse as dates
        - Dict of ``{column_name: format string}`` where format string is
          strftime compatible in case of parsing string times or is one of
          (D, s, ns, ms, us) in case of parsing integer timestamps
        - Dict of ``{column_name: arg dict}``, where the arg dict corresponds
          to the keyword arguments of :func:`pandas.to_datetime`
          Especially useful with databases without native Datetime support,
          such as SQLite
    columns : list, default: None
        List of column names to select from sql table
    chunksize : int, default None
        If specified, return an iterator where `chunksize` is the number of
        rows to include in each chunk.

    Returns
    -------
    DataFrame

    Notes
    -----
    Any datetime values with time zone information will be converted to UTC

    See also
    --------
    read_sql_query : Read SQL query into a DataFrame.
    read_sql

    """

    con = _engine_builder(con)
    if not _is_sqlalchemy_connectable(con):
        raise NotImplementedError("read_sql_table only supported for "
                                  "SQLAlchemy connectable.")
    import sqlalchemy
    from sqlalchemy.schema import MetaData
    meta = MetaData(con, schema=schema)
    try:
        meta.reflect(only=[table_name], views=True)
    except sqlalchemy.exc.InvalidRequestError:
        raise ValueError("Table %s not found" % table_name)

    pandas_sql = SQLDatabase(con, meta=meta)
    table = pandas_sql.read_table(
        table_name, index_col=index_col, coerce_float=coerce_float,
        parse_dates=parse_dates, columns=columns, chunksize=chunksize)

    if table is not None:
        return table
    else:
        raise ValueError("Table %s not found" % table_name, con)


def read_sql_query(sql, con, index_col=None, coerce_float=True, params=None,
                   parse_dates=None, chunksize=None):
    """Read SQL query into a DataFrame.

    Returns a DataFrame corresponding to the result set of the query
    string. Optionally provide an `index_col` parameter to use one of the
    columns as the index, otherwise default integer index will be used.

    Parameters
    ----------
    sql : string SQL query or SQLAlchemy Selectable (select or text object)
        to be executed.
    con : SQLAlchemy connectable(engine/connection) or database string URI
        or sqlite3 DBAPI2 connection
        Using SQLAlchemy makes it possible to use any DB supported by that
        library.
        If a DBAPI2 object, only sqlite3 is supported.
    index_col : string or list of strings, optional, default: None
        Column(s) to set as index(MultiIndex)
    coerce_float : boolean, default True
        Attempt to convert values of non-string, non-numeric objects (like
        decimal.Decimal) to floating point, useful for SQL result sets
    params : list, tuple or dict, optional, default: None
        List of parameters to pass to execute method.  The syntax used
        to pass parameters is database driver dependent. Check your
        database driver documentation for which of the five syntax styles,
        described in PEP 249's paramstyle, is supported.
        Eg. for psycopg2, uses %(name)s so use params={'name' : 'value'}
    parse_dates : list or dict, default: None
        - List of column names to parse as dates
        - Dict of ``{column_name: format string}`` where format string is
          strftime compatible in case of parsing string times or is one of
          (D, s, ns, ms, us) in case of parsing integer timestamps
        - Dict of ``{column_name: arg dict}``, where the arg dict corresponds
          to the keyword arguments of :func:`pandas.to_datetime`
          Especially useful with databases without native Datetime support,
          such as SQLite
    chunksize : int, default None
        If specified, return an iterator where `chunksize` is the number of
        rows to include in each chunk.

    Returns
    -------
    DataFrame

    Notes
    -----
    Any datetime values with time zone information parsed via the `parse_dates`
    parameter will be converted to UTC

    See also
    --------
    read_sql_table : Read SQL database table into a DataFrame
    read_sql

    """
    pandas_sql = pandasSQL_builder(con)
    return pandas_sql.read_query(
        sql, index_col=index_col, params=params, coerce_float=coerce_float,
        parse_dates=parse_dates, chunksize=chunksize)


def read_sql(sql, con, index_col=None, coerce_float=True, params=None,
             parse_dates=None, columns=None, chunksize=None):
    """
    Read SQL query or database table into a DataFrame.

    Parameters
    ----------
    sql : string SQL query or SQLAlchemy Selectable (select or text object)
        to be executed, or database table name.
    con : SQLAlchemy connectable(engine/connection) or database string URI
        or DBAPI2 connection (fallback mode)
        Using SQLAlchemy makes it possible to use any DB supported by that
        library.
        If a DBAPI2 object, only sqlite3 is supported.
    index_col : string or list of strings, optional, default: None
        Column(s) to set as index(MultiIndex)
    coerce_float : boolean, default True
        Attempt to convert values of non-string, non-numeric objects (like
        decimal.Decimal) to floating point, useful for SQL result sets
    params : list, tuple or dict, optional, default: None
        List of parameters to pass to execute method.  The syntax used
        to pass parameters is database driver dependent. Check your
        database driver documentation for which of the five syntax styles,
        described in PEP 249's paramstyle, is supported.
        Eg. for psycopg2, uses %(name)s so use params={'name' : 'value'}
    parse_dates : list or dict, default: None
        - List of column names to parse as dates
        - Dict of ``{column_name: format string}`` where format string is
          strftime compatible in case of parsing string times or is one of
          (D, s, ns, ms, us) in case of parsing integer timestamps
        - Dict of ``{column_name: arg dict}``, where the arg dict corresponds
          to the keyword arguments of :func:`pandas.to_datetime`
          Especially useful with databases without native Datetime support,
          such as SQLite
    columns : list, default: None
        List of column names to select from sql table (only used when reading
        a table).
    chunksize : int, default None
        If specified, return an iterator where `chunksize` is the
        number of rows to include in each chunk.

    Returns
    -------
    DataFrame

    Notes
    -----
    This function is a convenience wrapper around ``read_sql_table`` and
    ``read_sql_query`` (and for backward compatibility) and will delegate
    to the specific function depending on the provided input (database
    table name or sql query).  The delegated function might have more specific
    notes about their functionality not listed here.

    See also
    --------
    read_sql_table : Read SQL database table into a DataFrame
    read_sql_query : Read SQL query into a DataFrame

    """
    pandas_sql = pandasSQL_builder(con)

    if isinstance(pandas_sql, SQLiteDatabase):
        return pandas_sql.read_query(
            sql, index_col=index_col, params=params,
            coerce_float=coerce_float, parse_dates=parse_dates,
            chunksize=chunksize)

    try:
        _is_table_name = pandas_sql.has_table(sql)
    except:
        _is_table_name = False

    if _is_table_name:
        pandas_sql.meta.reflect(only=[sql])
        return pandas_sql.read_table(
            sql, index_col=index_col, coerce_float=coerce_float,
            parse_dates=parse_dates, columns=columns, chunksize=chunksize)
    else:
        return pandas_sql.read_query(
            sql, index_col=index_col, params=params,
            coerce_float=coerce_float, parse_dates=parse_dates,
            chunksize=chunksize)


def to_sql(frame, name, con, flavor=None, schema=None, if_exists='fail',
           index=True, index_label=None, chunksize=None, dtype=None):
    """
    Write records stored in a DataFrame to a SQL database.

    Parameters
    ----------
    frame : DataFrame
    name : string
        Name of SQL table
    con : SQLAlchemy connectable(engine/connection) or database string URI
        or sqlite3 DBAPI2 connection
        Using SQLAlchemy makes it possible to use any DB supported by that
        library.
        If a DBAPI2 object, only sqlite3 is supported.
    flavor : 'sqlite', default None
        DEPRECATED: this parameter will be removed in a future version
    schema : string, default None
        Name of SQL schema in database to write to (if database flavor
        supports this). If None, use default schema (default).
    if_exists : {'fail', 'replace', 'append'}, default 'fail'
        - fail: If table exists, do nothing.
        - replace: If table exists, drop it, recreate it, and insert data.
        - append: If table exists, insert data. Create if does not exist.
    index : boolean, default True
        Write DataFrame index as a column
    index_label : string or sequence, default None
        Column label for index column(s). If None is given (default) and
        `index` is True, then the index names are used.
        A sequence should be given if the DataFrame uses MultiIndex.
    chunksize : int, default None
        If not None, then rows will be written in batches of this size at a
        time.  If None, all rows will be written at once.
    dtype : single SQLtype or dict of column name to SQL type, default None
        Optional specifying the datatype for columns. The SQL type should
        be a SQLAlchemy type, or a string for sqlite3 fallback connection.
        If all columns are of the same type, one single value can be used.

    """
    if if_exists not in ('fail', 'replace', 'append'):
        raise ValueError("'{0}' is not valid for if_exists".format(if_exists))

    pandas_sql = pandasSQL_builder(con, schema=schema, flavor=flavor)

    if isinstance(frame, Series):
        frame = frame.to_frame()
    elif not isinstance(frame, DataFrame):
        raise NotImplementedError("'frame' argument should be either a "
                                  "Series or a DataFrame")

    pandas_sql.to_sql(frame, name, if_exists=if_exists, index=index,
                      index_label=index_label, schema=schema,
                      chunksize=chunksize, dtype=dtype)


def has_table(table_name, con, flavor=None, schema=None):
    """
    Check if DataBase has named table.

    Parameters
    ----------
    table_name: string
        Name of SQL table
    con: SQLAlchemy connectable(engine/connection) or sqlite3 DBAPI2 connection
        Using SQLAlchemy makes it possible to use any DB supported by that
        library.
        If a DBAPI2 object, only sqlite3 is supported.
    flavor : 'sqlite', default None
        DEPRECATED: this parameter will be removed in a future version
    schema : string, default None
        Name of SQL schema in database to write to (if database flavor supports
        this). If None, use default schema (default).

    Returns
    -------
    boolean
    """
    pandas_sql = pandasSQL_builder(con, flavor=flavor, schema=schema)
    return pandas_sql.has_table(table_name)


table_exists = has_table


def _engine_builder(con):
    """
    Returns a SQLAlchemy engine from a URI (if con is a string)
    else it just return con without modifying it
    """
    global _SQLALCHEMY_INSTALLED
    if isinstance(con, string_types):
        try:
            import sqlalchemy
        except ImportError:
            _SQLALCHEMY_INSTALLED = False
        else:
            con = sqlalchemy.create_engine(con)
            return con

    return con


def pandasSQL_builder(con, flavor=None, schema=None, meta=None,
                      is_cursor=False):
    """
    Convenience function to return the correct PandasSQL subclass based on the
    provided parameters
    """
    _validate_flavor_parameter(flavor)

    # When support for DBAPI connections is removed,
    # is_cursor should not be necessary.
    con = _engine_builder(con)
    if _is_sqlalchemy_connectable(con):
        return SQLDatabase(con, schema=schema, meta=meta)
    elif isinstance(con, string_types):
        raise ImportError("Using URI string without sqlalchemy installed.")
    else:
        return SQLiteDatabase(con, is_cursor=is_cursor)


class SQLTable(PandasObject):
    """
    For mapping Pandas tables to SQL tables.
    Uses fact that table is reflected by SQLAlchemy to
    do better type convertions.
    Also holds various flags needed to avoid having to
    pass them between functions all the time.
    """
    # TODO: support for multiIndex

    def __init__(self, name, pandas_sql_engine, frame=None, index=True,
                 if_exists='fail', prefix='pandas', index_label=None,
                 schema=None, keys=None, dtype=None):
        self.name = name
        self.pd_sql = pandas_sql_engine
        self.prefix = prefix
        self.frame = frame
        self.index = self._index_name(index, index_label)
        self.schema = schema
        self.if_exists = if_exists
        self.keys = keys
        self.dtype = dtype

        if frame is not None:
            # We want to initialize based on a dataframe
            self.table = self._create_table_setup()
        else:
            # no data provided, read-only mode
            self.table = self.pd_sql.get_table(self.name, self.schema)

        if self.table is None:
            raise ValueError("Could not init table '%s'" % name)

    def exists(self):
        return self.pd_sql.has_table(self.name, self.schema)

    def sql_schema(self):
        from sqlalchemy.schema import CreateTable
        return str(CreateTable(self.table).compile(self.pd_sql.connectable))

    def _execute_create(self):
        # Inserting table into database, add to MetaData object
        self.table = self.table.tometadata(self.pd_sql.meta)
        self.table.create()

    def create(self):
        if self.exists():
            if self.if_exists == 'fail':
                raise ValueError("Table '%s' already exists." % self.name)
            elif self.if_exists == 'replace':
                self.pd_sql.drop_table(self.name, self.schema)
                self._execute_create()
            elif self.if_exists == 'append':
                pass
            else:
                raise ValueError(
                    "'{0}' is not valid for if_exists".format(self.if_exists))
        else:
            self._execute_create()

    def insert_statement(self):
        return self.table.insert()

    def insert_data(self):
        if self.index is not None:
            temp = self.frame.copy()
            temp.index.names = self.index
            try:
                temp.reset_index(inplace=True)
            except ValueError as err:
                raise ValueError(
                    "duplicate name in index/columns: {0}".format(err))
        else:
            temp = self.frame

        column_names = list(map(text_type, temp.columns))
        ncols = len(column_names)
        data_list = [None] * ncols
        blocks = temp._data.blocks

        for i in range(len(blocks)):
            b = blocks[i]
            if b.is_datetime:
                # convert to microsecond resolution so this yields
                # datetime.datetime
                d = b.values.astype('M8[us]').astype(object)
            else:
                d = np.array(b.get_values(), dtype=object)

            # replace NaN with None
            if b._can_hold_na:
                mask = isnull(d)
                d[mask] = None

            for col_loc, col in zip(b.mgr_locs, d):
                data_list[col_loc] = col

        return column_names, data_list

    def _execute_insert(self, conn, keys, data_iter):
        data = [dict((k, v) for k, v in zip(keys, row)) for row in data_iter]
        conn.execute(self.insert_statement(), data)

    def insert(self, chunksize=None):
        keys, data_list = self.insert_data()

        nrows = len(self.frame)

        if nrows == 0:
            return

        if chunksize is None:
            chunksize = nrows
        elif chunksize == 0:
            raise ValueError('chunksize argument should be non-zero')

        chunks = int(nrows / chunksize) + 1

        with self.pd_sql.run_transaction() as conn:
            for i in range(chunks):
                start_i = i * chunksize
                end_i = min((i + 1) * chunksize, nrows)
                if start_i >= end_i:
                    break

                chunk_iter = zip(*[arr[start_i:end_i] for arr in data_list])
                self._execute_insert(conn, keys, chunk_iter)

    def _query_iterator(self, result, chunksize, columns, coerce_float=True,
                        parse_dates=None):
        """Return generator through chunked result set"""

        while True:
            data = result.fetchmany(chunksize)
            if not data:
                break
            else:
                self.frame = DataFrame.from_records(
                    data, columns=columns, coerce_float=coerce_float)

                self._harmonize_columns(parse_dates=parse_dates)

                if self.index is not None:
                    self.frame.set_index(self.index, inplace=True)

                yield self.frame

    def read(self, coerce_float=True, parse_dates=None, columns=None,
             chunksize=None):

        if columns is not None and len(columns) > 0:
            from sqlalchemy import select
            cols = [self.table.c[n] for n in columns]
            if self.index is not None:
                [cols.insert(0, self.table.c[idx]) for idx in self.index[::-1]]
            sql_select = select(cols)
        else:
            sql_select = self.table.select()

        result = self.pd_sql.execute(sql_select)
        column_names = result.keys()

        if chunksize is not None:
            return self._query_iterator(result, chunksize, column_names,
                                        coerce_float=coerce_float,
                                        parse_dates=parse_dates)
        else:
            data = result.fetchall()
            self.frame = DataFrame.from_records(
                data, columns=column_names, coerce_float=coerce_float)

            self._harmonize_columns(parse_dates=parse_dates)

            if self.index is not None:
                self.frame.set_index(self.index, inplace=True)

            return self.frame

    def _index_name(self, index, index_label):
        # for writing: index=True to include index in sql table
        if index is True:
            nlevels = self.frame.index.nlevels
            # if index_label is specified, set this as index name(s)
            if index_label is not None:
                if not isinstance(index_label, list):
                    index_label = [index_label]
                if len(index_label) != nlevels:
                    raise ValueError(
                        "Length of 'index_label' should match number of "
                        "levels, which is {0}".format(nlevels))
                else:
                    return index_label
            # return the used column labels for the index columns
            if (nlevels == 1 and 'index' not in self.frame.columns and
                    self.frame.index.name is None):
                return ['index']
            else:
                return [l if l is not None else "level_{0}".format(i)
                        for i, l in enumerate(self.frame.index.names)]

        # for reading: index=(list of) string to specify column to set as index
        elif isinstance(index, string_types):
            return [index]
        elif isinstance(index, list):
            return index
        else:
            return None

    def _get_column_names_and_types(self, dtype_mapper):
        column_names_and_types = []
        if self.index is not None:
            for i, idx_label in enumerate(self.index):
                idx_type = dtype_mapper(
                    self.frame.index._get_level_values(i))
                column_names_and_types.append((text_type(idx_label),
                                              idx_type, True))

        column_names_and_types += [
            (text_type(self.frame.columns[i]),
             dtype_mapper(self.frame.iloc[:, i]),
             False)
            for i in range(len(self.frame.columns))
        ]

        return column_names_and_types

    def _create_table_setup(self):
        from sqlalchemy import Table, Column, PrimaryKeyConstraint

        column_names_and_types = \
            self._get_column_names_and_types(self._sqlalchemy_type)

        columns = [Column(name, typ, index=is_index)
                   for name, typ, is_index in column_names_and_types]

        if self.keys is not None:
            if not is_list_like(self.keys):
                keys = [self.keys]
            else:
                keys = self.keys
            pkc = PrimaryKeyConstraint(*keys, name=self.name + '_pk')
            columns.append(pkc)

        schema = self.schema or self.pd_sql.meta.schema

        # At this point, attach to new metadata, only attach to self.meta
        # once table is created.
        from sqlalchemy.schema import MetaData
        meta = MetaData(self.pd_sql, schema=schema)

        return Table(self.name, meta, *columns, schema=schema)

    def _harmonize_columns(self, parse_dates=None):
        """
        Make the DataFrame's column types align with the SQL table
        column types.
        Need to work around limited NA value support. Floats are always
        fine, ints must always be floats if there are Null values.
        Booleans are hard because converting bool column with None replaces
        all Nones with false. Therefore only convert bool if there are no
        NA values.
        Datetimes should already be converted to np.datetime64 if supported,
        but here we also force conversion if required
        """
        # handle non-list entries for parse_dates gracefully
        if parse_dates is True or parse_dates is None or parse_dates is False:
            parse_dates = []

        if not hasattr(parse_dates, '__iter__'):
            parse_dates = [parse_dates]

        for sql_col in self.table.columns:
            col_name = sql_col.name
            try:
                df_col = self.frame[col_name]
                # the type the dataframe column should have
                col_type = self._get_dtype(sql_col.type)

                if (col_type is datetime or col_type is date or
                        col_type is DatetimeTZDtype):
                    self.frame[col_name] = _handle_date_column(df_col)

                elif col_type is float:
                    # floats support NA, can always convert!
                    self.frame[col_name] = df_col.astype(col_type, copy=False)

                elif len(df_col) == df_col.count():
                    # No NA values, can convert ints and bools
                    if col_type is np.dtype('int64') or col_type is bool:
                        self.frame[col_name] = df_col.astype(
                            col_type, copy=False)

                # Handle date parsing
                if col_name in parse_dates:
                    try:
                        fmt = parse_dates[col_name]
                    except TypeError:
                        fmt = None
                    self.frame[col_name] = _handle_date_column(
                        df_col, format=fmt)

            except KeyError:
                pass  # this column not in results

    def _get_notnull_col_dtype(self, col):
        """
        Infer datatype of the Series col.  In case the dtype of col is 'object'
        and it contains NA values, this infers the datatype of the not-NA
        values.  Needed for inserting typed data containing NULLs, GH8778.
        """
        col_for_inference = col
        if col.dtype == 'object':
            notnulldata = col[~isnull(col)]
            if len(notnulldata):
                col_for_inference = notnulldata

        return lib.infer_dtype(col_for_inference)

    def _sqlalchemy_type(self, col):

        dtype = self.dtype or {}
        if col.name in dtype:
            return self.dtype[col.name]

        col_type = self._get_notnull_col_dtype(col)

        from sqlalchemy.types import (BigInteger, Integer, Float,
                                      Text, Boolean,
                                      DateTime, Date, Time)

        if col_type == 'datetime64' or col_type == 'datetime':
            try:
                tz = col.tzinfo  # noqa
                return DateTime(timezone=True)
            except:
                return DateTime
        if col_type == 'timedelta64':
            warnings.warn("the 'timedelta' type is not supported, and will be "
                          "written as integer values (ns frequency) to the "
                          "database.", UserWarning, stacklevel=8)
            return BigInteger
        elif col_type == 'floating':
            if col.dtype == 'float32':
                return Float(precision=23)
            else:
                return Float(precision=53)
        elif col_type == 'integer':
            if col.dtype == 'int32':
                return Integer
            else:
                return BigInteger
        elif col_type == 'boolean':
            return Boolean
        elif col_type == 'date':
            return Date
        elif col_type == 'time':
            return Time
        elif col_type == 'complex':
            raise ValueError('Complex datatypes not supported')

        return Text

    def _get_dtype(self, sqltype):
        from sqlalchemy.types import (Integer, Float, Boolean, DateTime,
                                      Date, TIMESTAMP)

        if isinstance(sqltype, Float):
            return float
        elif isinstance(sqltype, Integer):
            # TODO: Refine integer size.
            return np.dtype('int64')
        elif isinstance(sqltype, TIMESTAMP):
            # we have a timezone capable type
            if not sqltype.timezone:
                return datetime
            return DatetimeTZDtype
        elif isinstance(sqltype, DateTime):
            # Caution: np.datetime64 is also a subclass of np.number.
            return datetime
        elif isinstance(sqltype, Date):
            return date
        elif isinstance(sqltype, Boolean):
            return bool
        return object


class PandasSQL(PandasObject):
    """
    Subclasses Should define read_sql and to_sql
    """

    def read_sql(self, *args, **kwargs):
        raise ValueError("PandasSQL must be created with an SQLAlchemy "
                         "connectable or sqlite connection")

    def to_sql(self, *args, **kwargs):
        raise ValueError("PandasSQL must be created with an SQLAlchemy "
                         "connectable or sqlite connection")


class SQLDatabase(PandasSQL):
    """
    This class enables convertion between DataFrame and SQL databases
    using SQLAlchemy to handle DataBase abstraction

    Parameters
    ----------
    engine : SQLAlchemy connectable
        Connectable to connect with the database. Using SQLAlchemy makes it
        possible to use any DB supported by that library.
    schema : string, default None
        Name of SQL schema in database to write to (if database flavor
        supports this). If None, use default schema (default).
    meta : SQLAlchemy MetaData object, default None
        If provided, this MetaData object is used instead of a newly
        created. This allows to specify database flavor specific
        arguments in the MetaData object.

    """

    def __init__(self, engine, schema=None, meta=None):
        self.connectable = engine
        if not meta:
            from sqlalchemy.schema import MetaData
            meta = MetaData(self.connectable, schema=schema)

        self.meta = meta

    @contextmanager
    def run_transaction(self):
        with self.connectable.begin() as tx:
            if hasattr(tx, 'execute'):
                yield tx
            else:
                yield self.connectable

    def execute(self, *args, **kwargs):
        """Simple passthrough to SQLAlchemy connectable"""
        return self.connectable.execute(*args, **kwargs)

    def read_table(self, table_name, index_col=None, coerce_float=True,
                   parse_dates=None, columns=None, schema=None,
                   chunksize=None):
        """Read SQL database table into a DataFrame.

        Parameters
        ----------
        table_name : string
            Name of SQL table in database
        index_col : string, optional, default: None
            Column to set as index
        coerce_float : boolean, default True
            Attempt to convert values of non-string, non-numeric objects
            (like decimal.Decimal) to floating point. This can result in
            loss of precision.
        parse_dates : list or dict, default: None
            - List of column names to parse as dates
            - Dict of ``{column_name: format string}`` where format string is
              strftime compatible in case of parsing string times or is one of
              (D, s, ns, ms, us) in case of parsing integer timestamps
            - Dict of ``{column_name: arg}``, where the arg corresponds
              to the keyword arguments of :func:`pandas.to_datetime`.
              Especially useful with databases without native Datetime support,
              such as SQLite
        columns : list, default: None
            List of column names to select from sql table
        schema : string, default None
            Name of SQL schema in database to query (if database flavor
            supports this).  If specified, this overwrites the default
            schema of the SQLDatabase object.
        chunksize : int, default None
            If specified, return an iterator where `chunksize` is the number
            of rows to include in each chunk.

        Returns
        -------
        DataFrame

        See also
        --------
        pandas.read_sql_table
        SQLDatabase.read_query

        """
        table = SQLTable(table_name, self, index=index_col, schema=schema)
        return table.read(coerce_float=coerce_float,
                          parse_dates=parse_dates, columns=columns,
                          chunksize=chunksize)

    @staticmethod
    def _query_iterator(result, chunksize, columns, index_col=None,
                        coerce_float=True, parse_dates=None):
        """Return generator through chunked result set"""

        while True:
            data = result.fetchmany(chunksize)
            if not data:
                break
            else:
                yield _wrap_result(data, columns, index_col=index_col,
                                   coerce_float=coerce_float,
                                   parse_dates=parse_dates)

    def read_query(self, sql, index_col=None, coerce_float=True,
                   parse_dates=None, params=None, chunksize=None):
        """Read SQL query into a DataFrame.

        Parameters
        ----------
        sql : string
            SQL query to be executed
        index_col : string, optional, default: None
            Column name to use as index for the returned DataFrame object.
        coerce_float : boolean, default True
            Attempt to convert values of non-string, non-numeric objects (like
            decimal.Decimal) to floating point, useful for SQL result sets
        params : list, tuple or dict, optional, default: None
            List of parameters to pass to execute method.  The syntax used
            to pass parameters is database driver dependent. Check your
            database driver documentation for which of the five syntax styles,
            described in PEP 249's paramstyle, is supported.
            Eg. for psycopg2, uses %(name)s so use params={'name' : 'value'}
        parse_dates : list or dict, default: None
            - List of column names to parse as dates
            - Dict of ``{column_name: format string}`` where format string is
              strftime compatible in case of parsing string times or is one of
              (D, s, ns, ms, us) in case of parsing integer timestamps
            - Dict of ``{column_name: arg dict}``, where the arg dict
              corresponds to the keyword arguments of
              :func:`pandas.to_datetime` Especially useful with databases
              without native Datetime support, such as SQLite
        chunksize : int, default None
            If specified, return an iterator where `chunksize` is the number
            of rows to include in each chunk.

        Returns
        -------
        DataFrame

        See also
        --------
        read_sql_table : Read SQL database table into a DataFrame
        read_sql

        """
        args = _convert_params(sql, params)

        result = self.execute(*args)
        columns = result.keys()

        if chunksize is not None:
            return self._query_iterator(result, chunksize, columns,
                                        index_col=index_col,
                                        coerce_float=coerce_float,
                                        parse_dates=parse_dates)
        else:
            data = result.fetchall()
            frame = _wrap_result(data, columns, index_col=index_col,
                                 coerce_float=coerce_float,
                                 parse_dates=parse_dates)
            return frame

    read_sql = read_query

    def to_sql(self, frame, name, if_exists='fail', index=True,
               index_label=None, schema=None, chunksize=None, dtype=None):
        """
        Write records stored in a DataFrame to a SQL database.

        Parameters
        ----------
        frame : DataFrame
        name : string
            Name of SQL table
        if_exists : {'fail', 'replace', 'append'}, default 'fail'
            - fail: If table exists, do nothing.
            - replace: If table exists, drop it, recreate it, and insert data.
            - append: If table exists, insert data. Create if does not exist.
        index : boolean, default True
            Write DataFrame index as a column
        index_label : string or sequence, default None
            Column label for index column(s). If None is given (default) and
            `index` is True, then the index names are used.
            A sequence should be given if the DataFrame uses MultiIndex.
        schema : string, default None
            Name of SQL schema in database to write to (if database flavor
            supports this). If specified, this overwrites the default
            schema of the SQLDatabase object.
        chunksize : int, default None
            If not None, then rows will be written in batches of this size at a
            time.  If None, all rows will be written at once.
        dtype : single type or dict of column name to SQL type, default None
            Optional specifying the datatype for columns. The SQL type should
            be a SQLAlchemy type. If all columns are of the same type, one
            single value can be used.

        """
        if dtype and not is_dict_like(dtype):
            dtype = {col_name: dtype for col_name in frame}

        if dtype is not None:
            from sqlalchemy.types import to_instance, TypeEngine
            for col, my_type in dtype.items():
                if not isinstance(to_instance(my_type), TypeEngine):
                    raise ValueError('The type of %s is not a SQLAlchemy '
                                     'type ' % col)

        table = SQLTable(name, self, frame=frame, index=index,
                         if_exists=if_exists, index_label=index_label,
                         schema=schema, dtype=dtype)
        table.create()
        table.insert(chunksize)
        if (not name.isdigit() and not name.islower()):
            # check for potentially case sensitivity issues (GH7815)
            # Only check when name is not a number and name is not lower case
            engine = self.connectable.engine
            with self.connectable.connect() as conn:
                table_names = engine.table_names(
                    schema=schema or self.meta.schema,
                    connection=conn,
                )
            if name not in table_names:
                msg = (
                    "The provided table name '{0}' is not found exactly as "
                    "such in the database after writing the table, possibly "
                    "due to case sensitivity issues. Consider using lower "
                    "case table names."
                ).format(name)
                warnings.warn(msg, UserWarning)

    @property
    def tables(self):
        return self.meta.tables

    def has_table(self, name, schema=None):
        return self.connectable.run_callable(
            self.connectable.dialect.has_table,
            name,
            schema or self.meta.schema,
        )

    def get_table(self, table_name, schema=None):
        schema = schema or self.meta.schema
        if schema:
            tbl = self.meta.tables.get('.'.join([schema, table_name]))
        else:
            tbl = self.meta.tables.get(table_name)

        # Avoid casting double-precision floats into decimals
        from sqlalchemy import Numeric
        for column in tbl.columns:
            if isinstance(column.type, Numeric):
                column.type.asdecimal = False

        return tbl

    def drop_table(self, table_name, schema=None):
        schema = schema or self.meta.schema
        if self.has_table(table_name, schema):
            self.meta.reflect(only=[table_name], schema=schema)
            self.get_table(table_name, schema).drop()
            self.meta.clear()

    def _create_sql_schema(self, frame, table_name, keys=None, dtype=None):
        table = SQLTable(table_name, self, frame=frame, index=False, keys=keys,
                         dtype=dtype)
        return str(table.sql_schema())


# ---- SQL without SQLAlchemy ---
# sqlite-specific sql strings and handler class
# dictionary used for readability purposes
_SQL_TYPES = {
    'string': 'TEXT',
    'floating': 'REAL',
    'integer': 'INTEGER',
    'datetime': 'TIMESTAMP',
    'date': 'DATE',
    'time': 'TIME',
    'boolean': 'INTEGER',
}


def _get_unicode_name(name):
    try:
        uname = text_type(name).encode("utf-8", "strict").decode("utf-8")
    except UnicodeError:
        raise ValueError("Cannot convert identifier to UTF-8: '%s'" % name)
    return uname


def _get_valid_sqlite_name(name):
    # See http://stackoverflow.com/questions/6514274/how-do-you-escape-strings\
    # -for-sqlite-table-column-names-in-python
    # Ensure the string can be encoded as UTF-8.
    # Ensure the string does not include any NUL characters.
    # Replace all " with "".
    # Wrap the entire thing in double quotes.

    uname = _get_unicode_name(name)
    if not len(uname):
        raise ValueError("Empty table or column name specified")

    nul_index = uname.find("\x00")
    if nul_index >= 0:
        raise ValueError('SQLite identifier cannot contain NULs')
    return '"' + uname.replace('"', '""') + '"'


_SAFE_NAMES_WARNING = ("The spaces in these column names will not be changed. "
                       "In pandas versions < 0.14, spaces were converted to "
                       "underscores.")


class SQLiteTable(SQLTable):
    """
    Patch the SQLTable for fallback support.
    Instead of a table variable just use the Create Table statement.
    """

    def __init__(self, *args, **kwargs):
        # GH 8341
        # register an adapter callable for datetime.time object
        import sqlite3
        # this will transform time(12,34,56,789) into '12:34:56.000789'
        # (this is what sqlalchemy does)
        sqlite3.register_adapter(time, lambda _: _.strftime("%H:%M:%S.%f"))
        super(SQLiteTable, self).__init__(*args, **kwargs)

    def sql_schema(self):
        return str(";\n".join(self.table))

    def _execute_create(self):
        with self.pd_sql.run_transaction() as conn:
            for stmt in self.table:
                conn.execute(stmt)

    def insert_statement(self):
        names = list(map(text_type, self.frame.columns))
        wld = '?'  # wildcard char
        escape = _get_valid_sqlite_name

        if self.index is not None:
            [names.insert(0, idx) for idx in self.index[::-1]]

        bracketed_names = [escape(column) for column in names]
        col_names = ','.join(bracketed_names)
        wildcards = ','.join([wld] * len(names))
        insert_statement = 'INSERT INTO %s (%s) VALUES (%s)' % (
            escape(self.name), col_names, wildcards)
        return insert_statement

    def _execute_insert(self, conn, keys, data_iter):
        data_list = list(data_iter)
        conn.executemany(self.insert_statement(), data_list)

    def _create_table_setup(self):
        """
        Return a list of SQL statement that create a table reflecting the
        structure of a DataFrame.  The first entry will be a CREATE TABLE
        statement while the rest will be CREATE INDEX statements
        """
        column_names_and_types = \
            self._get_column_names_and_types(self._sql_type_name)

        pat = re.compile('\s+')
        column_names = [col_name for col_name, _, _ in column_names_and_types]
        if any(map(pat.search, column_names)):
            warnings.warn(_SAFE_NAMES_WARNING, stacklevel=6)

        escape = _get_valid_sqlite_name

        create_tbl_stmts = [escape(cname) + ' ' + ctype
                            for cname, ctype, _ in column_names_and_types]

        if self.keys is not None and len(self.keys):
            if not is_list_like(self.keys):
                keys = [self.keys]
            else:
                keys = self.keys
            cnames_br = ", ".join([escape(c) for c in keys])
            create_tbl_stmts.append(
                "CONSTRAINT {tbl}_pk PRIMARY KEY ({cnames_br})".format(
                    tbl=self.name, cnames_br=cnames_br))

        create_stmts = ["CREATE TABLE " + escape(self.name) + " (\n" +
                        ',\n  '.join(create_tbl_stmts) + "\n)"]

        ix_cols = [cname for cname, _, is_index in column_names_and_types
                   if is_index]
        if len(ix_cols):
            cnames = "_".join(ix_cols)
            cnames_br = ",".join([escape(c) for c in ix_cols])
            create_stmts.append(
                "CREATE INDEX " + escape("ix_" + self.name + "_" + cnames) +
                "ON " + escape(self.name) + " (" + cnames_br + ")")

        return create_stmts

    def _sql_type_name(self, col):
        dtype = self.dtype or {}
        if col.name in dtype:
            return dtype[col.name]

        col_type = self._get_notnull_col_dtype(col)
        if col_type == 'timedelta64':
            warnings.warn("the 'timedelta' type is not supported, and will be "
                          "written as integer values (ns frequency) to the "
                          "database.", UserWarning, stacklevel=8)
            col_type = "integer"

        elif col_type == "datetime64":
            col_type = "datetime"

        elif col_type == "empty":
            col_type = "string"

        elif col_type == "complex":
            raise ValueError('Complex datatypes not supported')

        if col_type not in _SQL_TYPES:
            col_type = "string"

        return _SQL_TYPES[col_type]


class SQLiteDatabase(PandasSQL):
    """
    Version of SQLDatabase to support sqlite connections (fallback without
    sqlalchemy). This should only be used internally.

    Parameters
    ----------
    con : sqlite connection object

    """

    def __init__(self, con, flavor=None, is_cursor=False):
        _validate_flavor_parameter(flavor)

        self.is_cursor = is_cursor
        self.con = con

    @contextmanager
    def run_transaction(self):
        cur = self.con.cursor()
        try:
            yield cur
            self.con.commit()
        except:
            self.con.rollback()
            raise
        finally:
            cur.close()

    def execute(self, *args, **kwargs):
        if self.is_cursor:
            cur = self.con
        else:
            cur = self.con.cursor()
        try:
            if kwargs:
                cur.execute(*args, **kwargs)
            else:
                cur.execute(*args)
            return cur
        except Exception as exc:
            try:
                self.con.rollback()
            except Exception:  # pragma: no cover
                ex = DatabaseError("Execution failed on sql: %s\n%s\nunable"
                                   " to rollback" % (args[0], exc))
                raise_with_traceback(ex)

            ex = DatabaseError(
                "Execution failed on sql '%s': %s" % (args[0], exc))
            raise_with_traceback(ex)

    @staticmethod
    def _query_iterator(cursor, chunksize, columns, index_col=None,
                        coerce_float=True, parse_dates=None):
        """Return generator through chunked result set"""

        while True:
            data = cursor.fetchmany(chunksize)
            if type(data) == tuple:
                data = list(data)
            if not data:
                cursor.close()
                break
            else:
                yield _wrap_result(data, columns, index_col=index_col,
                                   coerce_float=coerce_float,
                                   parse_dates=parse_dates)

    def read_query(self, sql, index_col=None, coerce_float=True, params=None,
                   parse_dates=None, chunksize=None):

        args = _convert_params(sql, params)
        cursor = self.execute(*args)
        columns = [col_desc[0] for col_desc in cursor.description]

        if chunksize is not None:
            return self._query_iterator(cursor, chunksize, columns,
                                        index_col=index_col,
                                        coerce_float=coerce_float,
                                        parse_dates=parse_dates)
        else:
            data = self._fetchall_as_list(cursor)
            cursor.close()

            frame = _wrap_result(data, columns, index_col=index_col,
                                 coerce_float=coerce_float,
                                 parse_dates=parse_dates)
            return frame

    def _fetchall_as_list(self, cur):
        result = cur.fetchall()
        if not isinstance(result, list):
            result = list(result)
        return result

    def to_sql(self, frame, name, if_exists='fail', index=True,
               index_label=None, schema=None, chunksize=None, dtype=None):
        """
        Write records stored in a DataFrame to a SQL database.

        Parameters
        ----------
        frame: DataFrame
        name: name of SQL table
        if_exists: {'fail', 'replace', 'append'}, default 'fail'
            fail: If table exists, do nothing.
            replace: If table exists, drop it, recreate it, and insert data.
            append: If table exists, insert data. Create if does not exist.
        index : boolean, default True
            Write DataFrame index as a column
        index_label : string or sequence, default None
            Column label for index column(s). If None is given (default) and
            `index` is True, then the index names are used.
            A sequence should be given if the DataFrame uses MultiIndex.
        schema : string, default None
            Ignored parameter included for compatability with SQLAlchemy
            version of ``to_sql``.
        chunksize : int, default None
            If not None, then rows will be written in batches of this
            size at a time. If None, all rows will be written at once.
        dtype : single type or dict of column name to SQL type, default None
            Optional specifying the datatype for columns. The SQL type should
            be a string. If all columns are of the same type, one single value
            can be used.

        """
        if dtype and not is_dict_like(dtype):
            dtype = {col_name: dtype for col_name in frame}

        if dtype is not None:
            for col, my_type in dtype.items():
                if not isinstance(my_type, str):
                    raise ValueError('%s (%s) not a string' % (
                        col, str(my_type)))

        table = SQLiteTable(name, self, frame=frame, index=index,
                            if_exists=if_exists, index_label=index_label,
                            dtype=dtype)
        table.create()
        table.insert(chunksize)

    def has_table(self, name, schema=None):
        # TODO(wesm): unused?
        # escape = _get_valid_sqlite_name
        # esc_name = escape(name)

        wld = '?'
        query = ("SELECT name FROM sqlite_master "
                 "WHERE type='table' AND name=%s;") % wld

        return len(self.execute(query, [name, ]).fetchall()) > 0

    def get_table(self, table_name, schema=None):
        return None  # not supported in fallback mode

    def drop_table(self, name, schema=None):
        drop_sql = "DROP TABLE %s" % _get_valid_sqlite_name(name)
        self.execute(drop_sql)

    def _create_sql_schema(self, frame, table_name, keys=None, dtype=None):
        table = SQLiteTable(table_name, self, frame=frame, index=False,
                            keys=keys, dtype=dtype)
        return str(table.sql_schema())


def get_schema(frame, name, flavor=None, keys=None, con=None, dtype=None):
    """
    Get the SQL db table schema for the given frame.

    Parameters
    ----------
    frame : DataFrame
    name : string
        name of SQL table
    keys : string or sequence, default: None
        columns to use a primary key
    con: an open SQL database connection object or a SQLAlchemy connectable
        Using SQLAlchemy makes it possible to use any DB supported by that
        library, default: None
        If a DBAPI2 object, only sqlite3 is supported.
    flavor : 'sqlite', default None
        DEPRECATED: this parameter will be removed in a future version
    dtype : dict of column name to SQL type, default None
        Optional specifying the datatype for columns. The SQL type should
        be a SQLAlchemy type, or a string for sqlite3 fallback connection.

    """

    pandas_sql = pandasSQL_builder(con=con, flavor=flavor)
    return pandas_sql._create_sql_schema(frame, name, keys=keys, dtype=dtype)
