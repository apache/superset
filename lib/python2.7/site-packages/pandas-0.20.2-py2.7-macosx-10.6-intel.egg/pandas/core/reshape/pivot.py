# pylint: disable=E1103


from pandas.core.dtypes.common import is_list_like, is_scalar
from pandas.core.reshape.concat import concat
from pandas import Series, DataFrame, MultiIndex, Index
from pandas.core.groupby import Grouper
from pandas.core.reshape.util import cartesian_product
from pandas.compat import range, lrange, zip
from pandas import compat
import pandas.core.common as com
import numpy as np


def pivot_table(data, values=None, index=None, columns=None, aggfunc='mean',
                fill_value=None, margins=False, dropna=True,
                margins_name='All'):
    """
    Create a spreadsheet-style pivot table as a DataFrame. The levels in the
    pivot table will be stored in MultiIndex objects (hierarchical indexes) on
    the index and columns of the result DataFrame

    Parameters
    ----------
    data : DataFrame
    values : column to aggregate, optional
    index : column, Grouper, array, or list of the previous
        If an array is passed, it must be the same length as the data. The list
        can contain any of the other types (except list).
        Keys to group by on the pivot table index.  If an array is passed, it
        is being used as the same manner as column values.
    columns : column, Grouper, array, or list of the previous
        If an array is passed, it must be the same length as the data. The list
        can contain any of the other types (except list).
        Keys to group by on the pivot table column.  If an array is passed, it
        is being used as the same manner as column values.
    aggfunc : function or list of functions, default numpy.mean
        If list of functions passed, the resulting pivot table will have
        hierarchical columns whose top level are the function names (inferred
        from the function objects themselves)
    fill_value : scalar, default None
        Value to replace missing values with
    margins : boolean, default False
        Add all row / columns (e.g. for subtotal / grand totals)
    dropna : boolean, default True
        Do not include columns whose entries are all NaN
    margins_name : string, default 'All'
        Name of the row / column that will contain the totals
        when margins is True.

    Examples
    --------
    >>> df
       A   B   C      D
    0  foo one small  1
    1  foo one large  2
    2  foo one large  2
    3  foo two small  3
    4  foo two small  3
    5  bar one large  4
    6  bar one small  5
    7  bar two small  6
    8  bar two large  7

    >>> table = pivot_table(df, values='D', index=['A', 'B'],
    ...                     columns=['C'], aggfunc=np.sum)
    >>> table
              small  large
    foo  one  1      4
         two  6      NaN
    bar  one  5      4
         two  6      7

    Returns
    -------
    table : DataFrame

    See also
    --------
    DataFrame.pivot : pivot without aggregation that can handle
        non-numeric data
    """
    index = _convert_by(index)
    columns = _convert_by(columns)

    if isinstance(aggfunc, list):
        pieces = []
        keys = []
        for func in aggfunc:
            table = pivot_table(data, values=values, index=index,
                                columns=columns,
                                fill_value=fill_value, aggfunc=func,
                                margins=margins, margins_name=margins_name)
            pieces.append(table)
            keys.append(func.__name__)
        return concat(pieces, keys=keys, axis=1)

    keys = index + columns

    values_passed = values is not None
    if values_passed:
        if is_list_like(values):
            values_multi = True
            values = list(values)
        else:
            values_multi = False
            values = [values]

        # GH14938 Make sure value labels are in data
        for i in values:
            if i not in data:
                raise KeyError(i)

        to_filter = []
        for x in keys + values:
            if isinstance(x, Grouper):
                x = x.key
            try:
                if x in data:
                    to_filter.append(x)
            except TypeError:
                pass
        if len(to_filter) < len(data.columns):
            data = data[to_filter]

    else:
        values = data.columns
        for key in keys:
            try:
                values = values.drop(key)
            except (TypeError, ValueError):
                pass
        values = list(values)

    grouped = data.groupby(keys)
    agged = grouped.agg(aggfunc)

    table = agged
    if table.index.nlevels > 1:
        to_unstack = [agged.index.names[i] or i
                      for i in range(len(index), len(keys))]
        table = agged.unstack(to_unstack)

    if not dropna:
        try:
            m = MultiIndex.from_arrays(cartesian_product(table.index.levels),
                                       names=table.index.names)
            table = table.reindex_axis(m, axis=0)
        except AttributeError:
            pass  # it's a single level

        try:
            m = MultiIndex.from_arrays(cartesian_product(table.columns.levels),
                                       names=table.columns.names)
            table = table.reindex_axis(m, axis=1)
        except AttributeError:
            pass  # it's a single level or a series

    if isinstance(table, DataFrame):
        table = table.sort_index(axis=1)

    if fill_value is not None:
        table = table.fillna(value=fill_value, downcast='infer')

    if margins:
        if dropna:
            data = data[data.notnull().all(axis=1)]
        table = _add_margins(table, data, values, rows=index,
                             cols=columns, aggfunc=aggfunc,
                             margins_name=margins_name)

    # discard the top level
    if values_passed and not values_multi and not table.empty and \
       (table.columns.nlevels > 1):
        table = table[values[0]]

    if len(index) == 0 and len(columns) > 0:
        table = table.T

    # GH 15193 Makse sure empty columns are removed if dropna=True
    if isinstance(table, DataFrame) and dropna:
        table = table.dropna(how='all', axis=1)

    return table


DataFrame.pivot_table = pivot_table


def _add_margins(table, data, values, rows, cols, aggfunc,
                 margins_name='All'):
    if not isinstance(margins_name, compat.string_types):
        raise ValueError('margins_name argument must be a string')

    exception_msg = 'Conflicting name "{0}" in margins'.format(margins_name)
    for level in table.index.names:
        if margins_name in table.index.get_level_values(level):
            raise ValueError(exception_msg)

    grand_margin = _compute_grand_margin(data, values, aggfunc, margins_name)

    # could be passed a Series object with no 'columns'
    if hasattr(table, 'columns'):
        for level in table.columns.names[1:]:
            if margins_name in table.columns.get_level_values(level):
                raise ValueError(exception_msg)

    if len(rows) > 1:
        key = (margins_name,) + ('',) * (len(rows) - 1)
    else:
        key = margins_name

    if not values and isinstance(table, Series):
        # If there are no values and the table is a series, then there is only
        # one column in the data. Compute grand margin and return it.
        return table.append(Series({key: grand_margin[margins_name]}))

    if values:
        marginal_result_set = _generate_marginal_results(table, data, values,
                                                         rows, cols, aggfunc,
                                                         grand_margin,
                                                         margins_name)
        if not isinstance(marginal_result_set, tuple):
            return marginal_result_set
        result, margin_keys, row_margin = marginal_result_set
    else:
        marginal_result_set = _generate_marginal_results_without_values(
            table, data, rows, cols, aggfunc, margins_name)
        if not isinstance(marginal_result_set, tuple):
            return marginal_result_set
        result, margin_keys, row_margin = marginal_result_set

    row_margin = row_margin.reindex(result.columns)
    # populate grand margin
    for k in margin_keys:
        if isinstance(k, compat.string_types):
            row_margin[k] = grand_margin[k]
        else:
            row_margin[k] = grand_margin[k[0]]

    margin_dummy = DataFrame(row_margin, columns=[key]).T

    row_names = result.index.names
    try:
        result = result.append(margin_dummy)
    except TypeError:

        # we cannot reshape, so coerce the axis
        result.index = result.index._to_safe_for_reshape()
        result = result.append(margin_dummy)
    result.index.names = row_names

    return result


def _compute_grand_margin(data, values, aggfunc,
                          margins_name='All'):

    if values:
        grand_margin = {}
        for k, v in data[values].iteritems():
            try:
                if isinstance(aggfunc, compat.string_types):
                    grand_margin[k] = getattr(v, aggfunc)()
                elif isinstance(aggfunc, dict):
                    if isinstance(aggfunc[k], compat.string_types):
                        grand_margin[k] = getattr(v, aggfunc[k])()
                    else:
                        grand_margin[k] = aggfunc[k](v)
                else:
                    grand_margin[k] = aggfunc(v)
            except TypeError:
                pass
        return grand_margin
    else:
        return {margins_name: aggfunc(data.index)}


def _generate_marginal_results(table, data, values, rows, cols, aggfunc,
                               grand_margin,
                               margins_name='All'):
    if len(cols) > 0:
        # need to "interleave" the margins
        table_pieces = []
        margin_keys = []

        def _all_key(key):
            return (key, margins_name) + ('',) * (len(cols) - 1)

        if len(rows) > 0:
            margin = data[rows + values].groupby(rows).agg(aggfunc)
            cat_axis = 1

            for key, piece in table.groupby(level=0, axis=cat_axis):
                all_key = _all_key(key)

                # we are going to mutate this, so need to copy!
                piece = piece.copy()
                try:
                    piece[all_key] = margin[key]
                except TypeError:

                    # we cannot reshape, so coerce the axis
                    piece.set_axis(cat_axis, piece._get_axis(
                        cat_axis)._to_safe_for_reshape())
                    piece[all_key] = margin[key]

                table_pieces.append(piece)
                margin_keys.append(all_key)
        else:
            margin = grand_margin
            cat_axis = 0
            for key, piece in table.groupby(level=0, axis=cat_axis):
                all_key = _all_key(key)
                table_pieces.append(piece)
                table_pieces.append(Series(margin[key], index=[all_key]))
                margin_keys.append(all_key)

        result = concat(table_pieces, axis=cat_axis)

        if len(rows) == 0:
            return result
    else:
        result = table
        margin_keys = table.columns

    if len(cols) > 0:
        row_margin = data[cols + values].groupby(cols).agg(aggfunc)
        row_margin = row_margin.stack()

        # slight hack
        new_order = [len(cols)] + lrange(len(cols))
        row_margin.index = row_margin.index.reorder_levels(new_order)
    else:
        row_margin = Series(np.nan, index=result.columns)

    return result, margin_keys, row_margin


def _generate_marginal_results_without_values(
        table, data, rows, cols, aggfunc,
        margins_name='All'):
    if len(cols) > 0:
        # need to "interleave" the margins
        margin_keys = []

        def _all_key():
            if len(cols) == 1:
                return margins_name
            return (margins_name, ) + ('', ) * (len(cols) - 1)

        if len(rows) > 0:
            margin = data[rows].groupby(rows).apply(aggfunc)
            all_key = _all_key()
            table[all_key] = margin
            result = table
            margin_keys.append(all_key)

        else:
            margin = data.groupby(level=0, axis=0).apply(aggfunc)
            all_key = _all_key()
            table[all_key] = margin
            result = table
            margin_keys.append(all_key)
            return result
    else:
        result = table
        margin_keys = table.columns

    if len(cols):
        row_margin = data[cols].groupby(cols).apply(aggfunc)
    else:
        row_margin = Series(np.nan, index=result.columns)

    return result, margin_keys, row_margin


def _convert_by(by):
    if by is None:
        by = []
    elif (is_scalar(by) or
          isinstance(by, (np.ndarray, Index, Series, Grouper)) or
          hasattr(by, '__call__')):
        by = [by]
    else:
        by = list(by)
    return by


def crosstab(index, columns, values=None, rownames=None, colnames=None,
             aggfunc=None, margins=False, dropna=True, normalize=False):
    """
    Compute a simple cross-tabulation of two (or more) factors. By default
    computes a frequency table of the factors unless an array of values and an
    aggregation function are passed

    Parameters
    ----------
    index : array-like, Series, or list of arrays/Series
        Values to group by in the rows
    columns : array-like, Series, or list of arrays/Series
        Values to group by in the columns
    values : array-like, optional
        Array of values to aggregate according to the factors.
        Requires `aggfunc` be specified.
    aggfunc : function, optional
        If specified, requires `values` be specified as well
    rownames : sequence, default None
        If passed, must match number of row arrays passed
    colnames : sequence, default None
        If passed, must match number of column arrays passed
    margins : boolean, default False
        Add row/column margins (subtotals)
    dropna : boolean, default True
        Do not include columns whose entries are all NaN
    normalize : boolean, {'all', 'index', 'columns'}, or {0,1}, default False
        Normalize by dividing all values by the sum of values.

        - If passed 'all' or `True`, will normalize over all values.
        - If passed 'index' will normalize over each row.
        - If passed 'columns' will normalize over each column.
        - If margins is `True`, will also normalize margin values.

        .. versionadded:: 0.18.1


    Notes
    -----
    Any Series passed will have their name attributes used unless row or column
    names for the cross-tabulation are specified.

    Any input passed containing Categorical data will have **all** of its
    categories included in the cross-tabulation, even if the actual data does
    not contain any instances of a particular category.

    In the event that there aren't overlapping indexes an empty DataFrame will
    be returned.

    Examples
    --------
    >>> a
    array([foo, foo, foo, foo, bar, bar,
           bar, bar, foo, foo, foo], dtype=object)
    >>> b
    array([one, one, one, two, one, one,
           one, two, two, two, one], dtype=object)
    >>> c
    array([dull, dull, shiny, dull, dull, shiny,
           shiny, dull, shiny, shiny, shiny], dtype=object)

    >>> crosstab(a, [b, c], rownames=['a'], colnames=['b', 'c'])
    b    one          two
    c    dull  shiny  dull  shiny
    a
    bar  1     2      1     0
    foo  2     2      1     2

    >>> foo = pd.Categorical(['a', 'b'], categories=['a', 'b', 'c'])
    >>> bar = pd.Categorical(['d', 'e'], categories=['d', 'e', 'f'])
    >>> crosstab(foo, bar)  # 'c' and 'f' are not represented in the data,
                            # but they still will be counted in the output
    col_0  d  e  f
    row_0
    a      1  0  0
    b      0  1  0
    c      0  0  0

    Returns
    -------
    crosstab : DataFrame
    """

    index = com._maybe_make_list(index)
    columns = com._maybe_make_list(columns)

    rownames = _get_names(index, rownames, prefix='row')
    colnames = _get_names(columns, colnames, prefix='col')

    data = {}
    data.update(zip(rownames, index))
    data.update(zip(colnames, columns))

    if values is None and aggfunc is not None:
        raise ValueError("aggfunc cannot be used without values.")

    if values is not None and aggfunc is None:
        raise ValueError("values cannot be used without an aggfunc.")

    if values is None:
        df = DataFrame(data)
        df['__dummy__'] = 0
        table = df.pivot_table('__dummy__', index=rownames, columns=colnames,
                               aggfunc=len, margins=margins, dropna=dropna)
        table = table.fillna(0).astype(np.int64)

    else:
        data['__dummy__'] = values
        df = DataFrame(data)
        table = df.pivot_table('__dummy__', index=rownames, columns=colnames,
                               aggfunc=aggfunc, margins=margins, dropna=dropna)

    # Post-process
    if normalize is not False:
        table = _normalize(table, normalize=normalize, margins=margins)

    return table


def _normalize(table, normalize, margins):

    if not isinstance(normalize, bool) and not isinstance(normalize,
                                                          compat.string_types):
        axis_subs = {0: 'index', 1: 'columns'}
        try:
            normalize = axis_subs[normalize]
        except KeyError:
            raise ValueError("Not a valid normalize argument")

    if margins is False:

        # Actual Normalizations
        normalizers = {
            'all': lambda x: x / x.sum(axis=1).sum(axis=0),
            'columns': lambda x: x / x.sum(),
            'index': lambda x: x.div(x.sum(axis=1), axis=0)
        }

        normalizers[True] = normalizers['all']

        try:
            f = normalizers[normalize]
        except KeyError:
            raise ValueError("Not a valid normalize argument")

        table = f(table)
        table = table.fillna(0)

    elif margins is True:

        column_margin = table.loc[:, 'All'].drop('All')
        index_margin = table.loc['All', :].drop('All')
        table = table.drop('All', axis=1).drop('All')
        # to keep index and columns names
        table_index_names = table.index.names
        table_columns_names = table.columns.names

        # Normalize core
        table = _normalize(table, normalize=normalize, margins=False)

        # Fix Margins
        if normalize == 'columns':
            column_margin = column_margin / column_margin.sum()
            table = concat([table, column_margin], axis=1)
            table = table.fillna(0)

        elif normalize == 'index':
            index_margin = index_margin / index_margin.sum()
            table = table.append(index_margin)
            table = table.fillna(0)

        elif normalize == "all" or normalize is True:
            column_margin = column_margin / column_margin.sum()
            index_margin = index_margin / index_margin.sum()
            index_margin.loc['All'] = 1
            table = concat([table, column_margin], axis=1)
            table = table.append(index_margin)

            table = table.fillna(0)

        else:
            raise ValueError("Not a valid normalize argument")

        table.index.names = table_index_names
        table.columns.names = table_columns_names

    else:
        raise ValueError("Not a valid margins argument")

    return table


def _get_names(arrs, names, prefix='row'):
    if names is None:
        names = []
        for i, arr in enumerate(arrs):
            if isinstance(arr, Series) and arr.name is not None:
                names.append(arr.name)
            else:
                names.append('%s_%d' % (prefix, i))
    else:
        if len(names) != len(arrs):
            raise AssertionError('arrays and names must have the same length')
        if not isinstance(names, list):
            names = list(names)

    return names
