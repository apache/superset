"""
SQL-style merge routines
"""

import copy
import warnings
import string

import numpy as np
from pandas.compat import range, lzip, zip, map, filter
import pandas.compat as compat

from pandas import (Categorical, Series, DataFrame,
                    Index, MultiIndex, Timedelta)
from pandas.core.frame import _merge_doc
from pandas.core.dtypes.common import (
    is_datetime64tz_dtype,
    is_datetime64_dtype,
    needs_i8_conversion,
    is_int64_dtype,
    is_categorical_dtype,
    is_integer_dtype,
    is_float_dtype,
    is_numeric_dtype,
    is_integer,
    is_int_or_datetime_dtype,
    is_dtype_equal,
    is_bool,
    is_list_like,
    _ensure_int64,
    _ensure_float64,
    _ensure_object,
    _get_dtype)
from pandas.core.dtypes.missing import na_value_for_dtype
from pandas.core.internals import (items_overlap_with_suffix,
                                   concatenate_block_managers)
from pandas.util._decorators import Appender, Substitution

from pandas.core.sorting import is_int64_overflow_possible
import pandas.core.algorithms as algos
import pandas.core.common as com
from pandas._libs import hashtable as libhashtable, join as libjoin, lib


@Substitution('\nleft : DataFrame')
@Appender(_merge_doc, indents=0)
def merge(left, right, how='inner', on=None, left_on=None, right_on=None,
          left_index=False, right_index=False, sort=False,
          suffixes=('_x', '_y'), copy=True, indicator=False):
    op = _MergeOperation(left, right, how=how, on=on, left_on=left_on,
                         right_on=right_on, left_index=left_index,
                         right_index=right_index, sort=sort, suffixes=suffixes,
                         copy=copy, indicator=indicator)
    return op.get_result()


if __debug__:
    merge.__doc__ = _merge_doc % '\nleft : DataFrame'


class MergeError(ValueError):
    pass


def _groupby_and_merge(by, on, left, right, _merge_pieces,
                       check_duplicates=True):
    """
    groupby & merge; we are always performing a left-by type operation

    Parameters
    ----------
    by: field to group
    on: duplicates field
    left: left frame
    right: right frame
    _merge_pieces: function for merging
    check_duplicates: boolean, default True
        should we check & clean duplicates
    """

    pieces = []
    if not isinstance(by, (list, tuple)):
        by = [by]

    lby = left.groupby(by, sort=False)

    # if we can groupby the rhs
    # then we can get vastly better perf
    try:

        # we will check & remove duplicates if indicated
        if check_duplicates:
            if on is None:
                on = []
            elif not isinstance(on, (list, tuple)):
                on = [on]

            if right.duplicated(by + on).any():
                right = right.drop_duplicates(by + on, keep='last')
        rby = right.groupby(by, sort=False)
    except KeyError:
        rby = None

    for key, lhs in lby:

        if rby is None:
            rhs = right
        else:
            try:
                rhs = right.take(rby.indices[key])
            except KeyError:
                # key doesn't exist in left
                lcols = lhs.columns.tolist()
                cols = lcols + [r for r in right.columns
                                if r not in set(lcols)]
                merged = lhs.reindex(columns=cols)
                merged.index = range(len(merged))
                pieces.append(merged)
                continue

        merged = _merge_pieces(lhs, rhs)

        # make sure join keys are in the merged
        # TODO, should _merge_pieces do this?
        for k in by:
            try:
                if k in merged:
                    merged[k] = key
            except:
                pass

        pieces.append(merged)

    # preserve the original order
    # if we have a missing piece this can be reset
    from pandas.core.reshape.concat import concat
    result = concat(pieces, ignore_index=True)
    result = result.reindex(columns=pieces[0].columns, copy=False)
    return result, lby


def ordered_merge(left, right, on=None,
                  left_on=None, right_on=None,
                  left_by=None, right_by=None,
                  fill_method=None, suffixes=('_x', '_y')):

    warnings.warn("ordered_merge is deprecated and replaced by merge_ordered",
                  FutureWarning, stacklevel=2)
    return merge_ordered(left, right, on=on,
                         left_on=left_on, right_on=right_on,
                         left_by=left_by, right_by=right_by,
                         fill_method=fill_method, suffixes=suffixes)


def merge_ordered(left, right, on=None,
                  left_on=None, right_on=None,
                  left_by=None, right_by=None,
                  fill_method=None, suffixes=('_x', '_y'),
                  how='outer'):
    """Perform merge with optional filling/interpolation designed for ordered
    data like time series data. Optionally perform group-wise merge (see
    examples)

    Parameters
    ----------
    left : DataFrame
    right : DataFrame
    on : label or list
        Field names to join on. Must be found in both DataFrames.
    left_on : label or list, or array-like
        Field names to join on in left DataFrame. Can be a vector or list of
        vectors of the length of the DataFrame to use a particular vector as
        the join key instead of columns
    right_on : label or list, or array-like
        Field names to join on in right DataFrame or vector/list of vectors per
        left_on docs
    left_by : column name or list of column names
        Group left DataFrame by group columns and merge piece by piece with
        right DataFrame
    right_by : column name or list of column names
        Group right DataFrame by group columns and merge piece by piece with
        left DataFrame
    fill_method : {'ffill', None}, default None
        Interpolation method for data
    suffixes : 2-length sequence (tuple, list, ...)
        Suffix to apply to overlapping column names in the left and right
        side, respectively
    how : {'left', 'right', 'outer', 'inner'}, default 'outer'
        * left: use only keys from left frame (SQL: left outer join)
        * right: use only keys from right frame (SQL: right outer join)
        * outer: use union of keys from both frames (SQL: full outer join)
        * inner: use intersection of keys from both frames (SQL: inner join)

        .. versionadded:: 0.19.0

    Examples
    --------
    >>> A                      >>> B
          key  lvalue group        key  rvalue
    0   a       1     a        0     b       1
    1   c       2     a        1     c       2
    2   e       3     a        2     d       3
    3   a       1     b
    4   c       2     b
    5   e       3     b

    >>> ordered_merge(A, B, fill_method='ffill', left_by='group')
       key  lvalue group  rvalue
    0    a       1     a     NaN
    1    b       1     a       1
    2    c       2     a       2
    3    d       2     a       3
    4    e       3     a       3
    5    f       3     a       4
    6    a       1     b     NaN
    7    b       1     b       1
    8    c       2     b       2
    9    d       2     b       3
    10   e       3     b       3
    11   f       3     b       4

    Returns
    -------
    merged : DataFrame
        The output type will the be same as 'left', if it is a subclass
        of DataFrame.

    See also
    --------
    merge
    merge_asof

    """
    def _merger(x, y):
        # perform the ordered merge operation
        op = _OrderedMerge(x, y, on=on, left_on=left_on, right_on=right_on,
                           suffixes=suffixes, fill_method=fill_method,
                           how=how)
        return op.get_result()

    if left_by is not None and right_by is not None:
        raise ValueError('Can only group either left or right frames')
    elif left_by is not None:
        result, _ = _groupby_and_merge(left_by, on, left, right,
                                       lambda x, y: _merger(x, y),
                                       check_duplicates=False)
    elif right_by is not None:
        result, _ = _groupby_and_merge(right_by, on, right, left,
                                       lambda x, y: _merger(y, x),
                                       check_duplicates=False)
    else:
        result = _merger(left, right)
    return result


ordered_merge.__doc__ = merge_ordered.__doc__


def merge_asof(left, right, on=None,
               left_on=None, right_on=None,
               left_index=False, right_index=False,
               by=None, left_by=None, right_by=None,
               suffixes=('_x', '_y'),
               tolerance=None,
               allow_exact_matches=True,
               direction='backward'):
    """Perform an asof merge. This is similar to a left-join except that we
    match on nearest key rather than equal keys.

    Both DataFrames must be sorted by the key.

    For each row in the left DataFrame:

      - A "backward" search selects the last row in the right DataFrame whose
        'on' key is less than or equal to the left's key.

      - A "forward" search selects the first row in the right DataFrame whose
        'on' key is greater than or equal to the left's key.

      - A "nearest" search selects the row in the right DataFrame whose 'on'
        key is closest in absolute distance to the left's key.

    The default is "backward" and is compatible in versions below 0.20.0.
    The direction parameter was added in version 0.20.0 and introduces
    "forward" and "nearest".

    Optionally match on equivalent keys with 'by' before searching with 'on'.

    .. versionadded:: 0.19.0

    Parameters
    ----------
    left : DataFrame
    right : DataFrame
    on : label
        Field name to join on. Must be found in both DataFrames.
        The data MUST be ordered. Furthermore this must be a numeric column,
        such as datetimelike, integer, or float. On or left_on/right_on
        must be given.
    left_on : label
        Field name to join on in left DataFrame.
    right_on : label
        Field name to join on in right DataFrame.
    left_index : boolean
        Use the index of the left DataFrame as the join key.

        .. versionadded:: 0.19.2

    right_index : boolean
        Use the index of the right DataFrame as the join key.

        .. versionadded:: 0.19.2

    by : column name or list of column names
        Match on these columns before performing merge operation.
    left_by : column name
        Field names to match on in the left DataFrame.

        .. versionadded:: 0.19.2

    right_by : column name
        Field names to match on in the right DataFrame.

        .. versionadded:: 0.19.2

    suffixes : 2-length sequence (tuple, list, ...)
        Suffix to apply to overlapping column names in the left and right
        side, respectively.
    tolerance : integer or Timedelta, optional, default None
        Select asof tolerance within this range; must be compatible
        with the merge index.
    allow_exact_matches : boolean, default True

        - If True, allow matching with the same 'on' value
          (i.e. less-than-or-equal-to / greater-than-or-equal-to)
        - If False, don't match the same 'on' value
          (i.e., stricly less-than / strictly greater-than)

    direction : 'backward' (default), 'forward', or 'nearest'
        Whether to search for prior, subsequent, or closest matches.

        .. versionadded:: 0.20.0

    Returns
    -------
    merged : DataFrame

    Examples
    --------
    >>> left
        a left_val
    0   1        a
    1   5        b
    2  10        c

    >>> right
       a  right_val
    0  1          1
    1  2          2
    2  3          3
    3  6          6
    4  7          7

    >>> pd.merge_asof(left, right, on='a')
        a left_val  right_val
    0   1        a          1
    1   5        b          3
    2  10        c          7

    >>> pd.merge_asof(left, right, on='a', allow_exact_matches=False)
        a left_val  right_val
    0   1        a        NaN
    1   5        b        3.0
    2  10        c        7.0

    >>> pd.merge_asof(left, right, on='a', direction='forward')
        a left_val  right_val
    0   1        a        1.0
    1   5        b        6.0
    2  10        c        NaN

    >>> pd.merge_asof(left, right, on='a', direction='nearest')
        a left_val  right_val
    0   1        a          1
    1   5        b          6
    2  10        c          7

    We can use indexed DataFrames as well.

    >>> left
       left_val
    1         a
    5         b
    10        c

    >>> right
       right_val
    1          1
    2          2
    3          3
    6          6
    7          7

    >>> pd.merge_asof(left, right, left_index=True, right_index=True)
       left_val  right_val
    1         a          1
    5         b          3
    10        c          7

    Here is a real-world times-series example

    >>> quotes
                         time ticker     bid     ask
    0 2016-05-25 13:30:00.023   GOOG  720.50  720.93
    1 2016-05-25 13:30:00.023   MSFT   51.95   51.96
    2 2016-05-25 13:30:00.030   MSFT   51.97   51.98
    3 2016-05-25 13:30:00.041   MSFT   51.99   52.00
    4 2016-05-25 13:30:00.048   GOOG  720.50  720.93
    5 2016-05-25 13:30:00.049   AAPL   97.99   98.01
    6 2016-05-25 13:30:00.072   GOOG  720.50  720.88
    7 2016-05-25 13:30:00.075   MSFT   52.01   52.03

    >>> trades
                         time ticker   price  quantity
    0 2016-05-25 13:30:00.023   MSFT   51.95        75
    1 2016-05-25 13:30:00.038   MSFT   51.95       155
    2 2016-05-25 13:30:00.048   GOOG  720.77       100
    3 2016-05-25 13:30:00.048   GOOG  720.92       100
    4 2016-05-25 13:30:00.048   AAPL   98.00       100

    By default we are taking the asof of the quotes

    >>> pd.merge_asof(trades, quotes,
    ...                       on='time',
    ...                       by='ticker')
                         time ticker   price  quantity     bid     ask
    0 2016-05-25 13:30:00.023   MSFT   51.95        75   51.95   51.96
    1 2016-05-25 13:30:00.038   MSFT   51.95       155   51.97   51.98
    2 2016-05-25 13:30:00.048   GOOG  720.77       100  720.50  720.93
    3 2016-05-25 13:30:00.048   GOOG  720.92       100  720.50  720.93
    4 2016-05-25 13:30:00.048   AAPL   98.00       100     NaN     NaN

    We only asof within 2ms betwen the quote time and the trade time

    >>> pd.merge_asof(trades, quotes,
    ...                       on='time',
    ...                       by='ticker',
    ...                       tolerance=pd.Timedelta('2ms'))
                         time ticker   price  quantity     bid     ask
    0 2016-05-25 13:30:00.023   MSFT   51.95        75   51.95   51.96
    1 2016-05-25 13:30:00.038   MSFT   51.95       155     NaN     NaN
    2 2016-05-25 13:30:00.048   GOOG  720.77       100  720.50  720.93
    3 2016-05-25 13:30:00.048   GOOG  720.92       100  720.50  720.93
    4 2016-05-25 13:30:00.048   AAPL   98.00       100     NaN     NaN

    We only asof within 10ms betwen the quote time and the trade time
    and we exclude exact matches on time. However *prior* data will
    propogate forward

    >>> pd.merge_asof(trades, quotes,
    ...                       on='time',
    ...                       by='ticker',
    ...                       tolerance=pd.Timedelta('10ms'),
    ...                       allow_exact_matches=False)
                         time ticker   price  quantity     bid     ask
    0 2016-05-25 13:30:00.023   MSFT   51.95        75     NaN     NaN
    1 2016-05-25 13:30:00.038   MSFT   51.95       155   51.97   51.98
    2 2016-05-25 13:30:00.048   GOOG  720.77       100  720.50  720.93
    3 2016-05-25 13:30:00.048   GOOG  720.92       100  720.50  720.93
    4 2016-05-25 13:30:00.048   AAPL   98.00       100     NaN     NaN

    See also
    --------
    merge
    merge_ordered

    """
    op = _AsOfMerge(left, right,
                    on=on, left_on=left_on, right_on=right_on,
                    left_index=left_index, right_index=right_index,
                    by=by, left_by=left_by, right_by=right_by,
                    suffixes=suffixes,
                    how='asof', tolerance=tolerance,
                    allow_exact_matches=allow_exact_matches,
                    direction=direction)
    return op.get_result()


# TODO: transformations??
# TODO: only copy DataFrames when modification necessary
class _MergeOperation(object):
    """
    Perform a database (SQL) merge operation between two DataFrame objects
    using either columns as keys or their row indexes
    """
    _merge_type = 'merge'

    def __init__(self, left, right, how='inner', on=None,
                 left_on=None, right_on=None, axis=1,
                 left_index=False, right_index=False, sort=True,
                 suffixes=('_x', '_y'), copy=True, indicator=False):
        self.left = self.orig_left = left
        self.right = self.orig_right = right
        self.how = how
        self.axis = axis

        self.on = com._maybe_make_list(on)
        self.left_on = com._maybe_make_list(left_on)
        self.right_on = com._maybe_make_list(right_on)

        self.copy = copy
        self.suffixes = suffixes
        self.sort = sort

        self.left_index = left_index
        self.right_index = right_index

        self.indicator = indicator

        if isinstance(self.indicator, compat.string_types):
            self.indicator_name = self.indicator
        elif isinstance(self.indicator, bool):
            self.indicator_name = '_merge' if self.indicator else None
        else:
            raise ValueError(
                'indicator option can only accept boolean or string arguments')

        if not isinstance(left, DataFrame):
            raise ValueError(
                'can not merge DataFrame with instance of '
                'type {0}'.format(type(left)))
        if not isinstance(right, DataFrame):
            raise ValueError(
                'can not merge DataFrame with instance of '
                'type {0}'.format(type(right)))

        if not is_bool(left_index):
            raise ValueError(
                'left_index parameter must be of type bool, not '
                '{0}'.format(type(left_index)))
        if not is_bool(right_index):
            raise ValueError(
                'right_index parameter must be of type bool, not '
                '{0}'.format(type(right_index)))

        # warn user when merging between different levels
        if left.columns.nlevels != right.columns.nlevels:
            msg = ('merging between different levels can give an unintended '
                   'result ({0} levels on the left, {1} on the right)')
            msg = msg.format(left.columns.nlevels, right.columns.nlevels)
            warnings.warn(msg, UserWarning)

        self._validate_specification()

        # note this function has side effects
        (self.left_join_keys,
         self.right_join_keys,
         self.join_names) = self._get_merge_keys()

        # validate the merge keys dtypes. We may need to coerce
        # to avoid incompat dtypes
        self._maybe_coerce_merge_keys()

    def get_result(self):
        if self.indicator:
            self.left, self.right = self._indicator_pre_merge(
                self.left, self.right)

        join_index, left_indexer, right_indexer = self._get_join_info()

        ldata, rdata = self.left._data, self.right._data
        lsuf, rsuf = self.suffixes

        llabels, rlabels = items_overlap_with_suffix(ldata.items, lsuf,
                                                     rdata.items, rsuf)

        lindexers = {1: left_indexer} if left_indexer is not None else {}
        rindexers = {1: right_indexer} if right_indexer is not None else {}

        result_data = concatenate_block_managers(
            [(ldata, lindexers), (rdata, rindexers)],
            axes=[llabels.append(rlabels), join_index],
            concat_axis=0, copy=self.copy)

        typ = self.left._constructor
        result = typ(result_data).__finalize__(self, method=self._merge_type)

        if self.indicator:
            result = self._indicator_post_merge(result)

        self._maybe_add_join_keys(result, left_indexer, right_indexer)

        return result

    def _indicator_pre_merge(self, left, right):

        columns = left.columns.union(right.columns)

        for i in ['_left_indicator', '_right_indicator']:
            if i in columns:
                raise ValueError("Cannot use `indicator=True` option when "
                                 "data contains a column named {}".format(i))
        if self.indicator_name in columns:
            raise ValueError(
                "Cannot use name of an existing column for indicator column")

        left = left.copy()
        right = right.copy()

        left['_left_indicator'] = 1
        left['_left_indicator'] = left['_left_indicator'].astype('int8')

        right['_right_indicator'] = 2
        right['_right_indicator'] = right['_right_indicator'].astype('int8')

        return left, right

    def _indicator_post_merge(self, result):

        result['_left_indicator'] = result['_left_indicator'].fillna(0)
        result['_right_indicator'] = result['_right_indicator'].fillna(0)

        result[self.indicator_name] = Categorical((result['_left_indicator'] +
                                                   result['_right_indicator']),
                                                  categories=[1, 2, 3])
        result[self.indicator_name] = (
            result[self.indicator_name]
            .cat.rename_categories(['left_only', 'right_only', 'both']))

        result = result.drop(labels=['_left_indicator', '_right_indicator'],
                             axis=1)
        return result

    def _maybe_add_join_keys(self, result, left_indexer, right_indexer):

        left_has_missing = None
        right_has_missing = None

        keys = zip(self.join_names, self.left_on, self.right_on)
        for i, (name, lname, rname) in enumerate(keys):
            if not _should_fill(lname, rname):
                continue

            take_left, take_right = None, None

            if name in result:

                if left_indexer is not None and right_indexer is not None:
                    if name in self.left:

                        if left_has_missing is None:
                            left_has_missing = (left_indexer == -1).any()

                        if left_has_missing:
                            take_right = self.right_join_keys[i]

                            if not is_dtype_equal(result[name].dtype,
                                                  self.left[name].dtype):
                                take_left = self.left[name]._values

                    elif name in self.right:

                        if right_has_missing is None:
                            right_has_missing = (right_indexer == -1).any()

                        if right_has_missing:
                            take_left = self.left_join_keys[i]

                            if not is_dtype_equal(result[name].dtype,
                                                  self.right[name].dtype):
                                take_right = self.right[name]._values

            elif left_indexer is not None \
                    and isinstance(self.left_join_keys[i], np.ndarray):

                take_left = self.left_join_keys[i]
                take_right = self.right_join_keys[i]

            if take_left is not None or take_right is not None:

                if take_left is None:
                    lvals = result[name]._values
                else:
                    lfill = na_value_for_dtype(take_left.dtype)
                    lvals = algos.take_1d(take_left, left_indexer,
                                          fill_value=lfill)

                if take_right is None:
                    rvals = result[name]._values
                else:
                    rfill = na_value_for_dtype(take_right.dtype)
                    rvals = algos.take_1d(take_right, right_indexer,
                                          fill_value=rfill)

                # if we have an all missing left_indexer
                # make sure to just use the right values
                mask = left_indexer == -1
                if mask.all():
                    key_col = rvals
                else:
                    key_col = Index(lvals).where(~mask, rvals)

                if name in result:
                    result[name] = key_col
                else:
                    result.insert(i, name or 'key_%d' % i, key_col)

    def _get_join_indexers(self):
        """ return the join indexers """
        return _get_join_indexers(self.left_join_keys,
                                  self.right_join_keys,
                                  sort=self.sort,
                                  how=self.how)

    def _get_join_info(self):
        left_ax = self.left._data.axes[self.axis]
        right_ax = self.right._data.axes[self.axis]

        if self.left_index and self.right_index and self.how != 'asof':
            join_index, left_indexer, right_indexer = \
                left_ax.join(right_ax, how=self.how, return_indexers=True,
                             sort=self.sort)
        elif self.right_index and self.how == 'left':
            join_index, left_indexer, right_indexer = \
                _left_join_on_index(left_ax, right_ax, self.left_join_keys,
                                    sort=self.sort)

        elif self.left_index and self.how == 'right':
            join_index, right_indexer, left_indexer = \
                _left_join_on_index(right_ax, left_ax, self.right_join_keys,
                                    sort=self.sort)
        else:
            (left_indexer,
             right_indexer) = self._get_join_indexers()

            if self.right_index:
                if len(self.left) > 0:
                    join_index = self.left.index.take(left_indexer)
                else:
                    join_index = self.right.index.take(right_indexer)
                    left_indexer = np.array([-1] * len(join_index))
            elif self.left_index:
                if len(self.right) > 0:
                    join_index = self.right.index.take(right_indexer)
                else:
                    join_index = self.left.index.take(left_indexer)
                    right_indexer = np.array([-1] * len(join_index))
            else:
                join_index = Index(np.arange(len(left_indexer)))

        if len(join_index) == 0:
            join_index = join_index.astype(object)
        return join_index, left_indexer, right_indexer

    def _get_merge_keys(self):
        """
        Note: has side effects (copy/delete key columns)

        Parameters
        ----------
        left
        right
        on

        Returns
        -------
        left_keys, right_keys
        """
        left_keys = []
        right_keys = []
        join_names = []
        right_drop = []
        left_drop = []
        left, right = self.left, self.right

        is_lkey = lambda x: isinstance(
            x, (np.ndarray, Series)) and len(x) == len(left)
        is_rkey = lambda x: isinstance(
            x, (np.ndarray, Series)) and len(x) == len(right)

        # Note that pd.merge_asof() has separate 'on' and 'by' parameters. A
        # user could, for example, request 'left_index' and 'left_by'. In a
        # regular pd.merge(), users cannot specify both 'left_index' and
        # 'left_on'. (Instead, users have a MultiIndex). That means the
        # self.left_on in this function is always empty in a pd.merge(), but
        # a pd.merge_asof(left_index=True, left_by=...) will result in a
        # self.left_on array with a None in the middle of it. This requires
        # a work-around as designated in the code below.
        # See _validate_specification() for where this happens.

        # ugh, spaghetti re #733
        if _any(self.left_on) and _any(self.right_on):
            for lk, rk in zip(self.left_on, self.right_on):
                if is_lkey(lk):
                    left_keys.append(lk)
                    if is_rkey(rk):
                        right_keys.append(rk)
                        join_names.append(None)  # what to do?
                    else:
                        if rk is not None:
                            right_keys.append(right[rk]._values)
                            join_names.append(rk)
                        else:
                            # work-around for merge_asof(right_index=True)
                            right_keys.append(right.index)
                            join_names.append(right.index.name)
                else:
                    if not is_rkey(rk):
                        if rk is not None:
                            right_keys.append(right[rk]._values)
                        else:
                            # work-around for merge_asof(right_index=True)
                            right_keys.append(right.index)
                        if lk is not None and lk == rk:
                            # avoid key upcast in corner case (length-0)
                            if len(left) > 0:
                                right_drop.append(rk)
                            else:
                                left_drop.append(lk)
                    else:
                        right_keys.append(rk)
                    if lk is not None:
                        left_keys.append(left[lk]._values)
                        join_names.append(lk)
                    else:
                        # work-around for merge_asof(left_index=True)
                        left_keys.append(left.index)
                        join_names.append(left.index.name)
        elif _any(self.left_on):
            for k in self.left_on:
                if is_lkey(k):
                    left_keys.append(k)
                    join_names.append(None)
                else:
                    left_keys.append(left[k]._values)
                    join_names.append(k)
            if isinstance(self.right.index, MultiIndex):
                right_keys = [lev._values.take(lab)
                              for lev, lab in zip(self.right.index.levels,
                                                  self.right.index.labels)]
            else:
                right_keys = [self.right.index.values]
        elif _any(self.right_on):
            for k in self.right_on:
                if is_rkey(k):
                    right_keys.append(k)
                    join_names.append(None)
                else:
                    right_keys.append(right[k]._values)
                    join_names.append(k)
            if isinstance(self.left.index, MultiIndex):
                left_keys = [lev._values.take(lab)
                             for lev, lab in zip(self.left.index.levels,
                                                 self.left.index.labels)]
            else:
                left_keys = [self.left.index.values]

        if left_drop:
            self.left = self.left.drop(left_drop, axis=1)

        if right_drop:
            self.right = self.right.drop(right_drop, axis=1)

        return left_keys, right_keys, join_names

    def _maybe_coerce_merge_keys(self):
        # we have valid mergee's but we may have to further
        # coerce these if they are originally incompatible types
        #
        # for example if these are categorical, but are not dtype_equal
        # or if we have object and integer dtypes

        for lk, rk, name in zip(self.left_join_keys,
                                self.right_join_keys,
                                self.join_names):
            if (len(lk) and not len(rk)) or (not len(lk) and len(rk)):
                continue

            # if either left or right is a categorical
            # then the must match exactly in categories & ordered
            if is_categorical_dtype(lk) and is_categorical_dtype(rk):
                if lk.is_dtype_equal(rk):
                    continue
            elif is_categorical_dtype(lk) or is_categorical_dtype(rk):
                pass

            elif is_dtype_equal(lk.dtype, rk.dtype):
                continue

            # if we are numeric, then allow differing
            # kinds to proceed, eg. int64 and int8
            # further if we are object, but we infer to
            # the same, then proceed
            if (is_numeric_dtype(lk) and is_numeric_dtype(rk)):
                if lk.dtype.kind == rk.dtype.kind:
                    continue

                # let's infer and see if we are ok
                if lib.infer_dtype(lk) == lib.infer_dtype(rk):
                    continue

            # Houston, we have a problem!
            # let's coerce to object
            if name in self.left.columns:
                self.left = self.left.assign(
                    **{name: self.left[name].astype(object)})
            if name in self.right.columns:
                self.right = self.right.assign(
                    **{name: self.right[name].astype(object)})

    def _validate_specification(self):
        # Hm, any way to make this logic less complicated??
        if self.on is None and self.left_on is None and self.right_on is None:

            if self.left_index and self.right_index:
                self.left_on, self.right_on = (), ()
            elif self.left_index:
                if self.right_on is None:
                    raise MergeError('Must pass right_on or right_index=True')
            elif self.right_index:
                if self.left_on is None:
                    raise MergeError('Must pass left_on or left_index=True')
            else:
                # use the common columns
                common_cols = self.left.columns.intersection(
                    self.right.columns)
                if len(common_cols) == 0:
                    raise MergeError('No common columns to perform merge on')
                if not common_cols.is_unique:
                    raise MergeError("Data columns not unique: %s"
                                     % repr(common_cols))
                self.left_on = self.right_on = common_cols
        elif self.on is not None:
            if self.left_on is not None or self.right_on is not None:
                raise MergeError('Can only pass argument "on" OR "left_on" '
                                 'and "right_on", not a combination of both.')
            self.left_on = self.right_on = self.on
        elif self.left_on is not None:
            n = len(self.left_on)
            if self.right_index:
                if len(self.left_on) != self.right.index.nlevels:
                    raise ValueError('len(left_on) must equal the number '
                                     'of levels in the index of "right"')
                self.right_on = [None] * n
        elif self.right_on is not None:
            n = len(self.right_on)
            if self.left_index:
                if len(self.right_on) != self.left.index.nlevels:
                    raise ValueError('len(right_on) must equal the number '
                                     'of levels in the index of "left"')
                self.left_on = [None] * n
        if len(self.right_on) != len(self.left_on):
            raise ValueError("len(right_on) must equal len(left_on)")


def _get_join_indexers(left_keys, right_keys, sort=False, how='inner',
                       **kwargs):
    """

    Parameters
    ----------
    left_keys: ndarray, Index, Series
    right_keys: ndarray, Index, Series
    sort: boolean, default False
    how: string {'inner', 'outer', 'left', 'right'}, default 'inner'

    Returns
    -------
    tuple of (left_indexer, right_indexer)
        indexers into the left_keys, right_keys

    """
    from functools import partial

    assert len(left_keys) == len(right_keys), \
        'left_key and right_keys must be the same length'

    # bind `sort` arg. of _factorize_keys
    fkeys = partial(_factorize_keys, sort=sort)

    # get left & right join labels and num. of levels at each location
    llab, rlab, shape = map(list, zip(* map(fkeys, left_keys, right_keys)))

    # get flat i8 keys from label lists
    lkey, rkey = _get_join_keys(llab, rlab, shape, sort)

    # factorize keys to a dense i8 space
    # `count` is the num. of unique keys
    # set(lkey) | set(rkey) == range(count)
    lkey, rkey, count = fkeys(lkey, rkey)

    # preserve left frame order if how == 'left' and sort == False
    kwargs = copy.copy(kwargs)
    if how == 'left':
        kwargs['sort'] = sort
    join_func = _join_functions[how]

    return join_func(lkey, rkey, count, **kwargs)


class _OrderedMerge(_MergeOperation):
    _merge_type = 'ordered_merge'

    def __init__(self, left, right, on=None, left_on=None, right_on=None,
                 left_index=False, right_index=False, axis=1,
                 suffixes=('_x', '_y'), copy=True,
                 fill_method=None, how='outer'):

        self.fill_method = fill_method
        _MergeOperation.__init__(self, left, right, on=on, left_on=left_on,
                                 left_index=left_index,
                                 right_index=right_index,
                                 right_on=right_on, axis=axis,
                                 how=how, suffixes=suffixes,
                                 sort=True  # factorize sorts
                                 )

    def get_result(self):
        join_index, left_indexer, right_indexer = self._get_join_info()

        # this is a bit kludgy
        ldata, rdata = self.left._data, self.right._data
        lsuf, rsuf = self.suffixes

        llabels, rlabels = items_overlap_with_suffix(ldata.items, lsuf,
                                                     rdata.items, rsuf)

        if self.fill_method == 'ffill':
            left_join_indexer = libjoin.ffill_indexer(left_indexer)
            right_join_indexer = libjoin.ffill_indexer(right_indexer)
        else:
            left_join_indexer = left_indexer
            right_join_indexer = right_indexer

        lindexers = {
            1: left_join_indexer} if left_join_indexer is not None else {}
        rindexers = {
            1: right_join_indexer} if right_join_indexer is not None else {}

        result_data = concatenate_block_managers(
            [(ldata, lindexers), (rdata, rindexers)],
            axes=[llabels.append(rlabels), join_index],
            concat_axis=0, copy=self.copy)

        typ = self.left._constructor
        result = typ(result_data).__finalize__(self, method=self._merge_type)

        self._maybe_add_join_keys(result, left_indexer, right_indexer)

        return result


def _asof_function(direction, on_type):
    return getattr(libjoin, 'asof_join_%s_%s' % (direction, on_type), None)


def _asof_by_function(direction, on_type, by_type):
    return getattr(libjoin, 'asof_join_%s_%s_by_%s' %
                   (direction, on_type, by_type), None)


_type_casters = {
    'int64_t': _ensure_int64,
    'double': _ensure_float64,
    'object': _ensure_object,
}

_cython_types = {
    'uint8': 'uint8_t',
    'uint32': 'uint32_t',
    'uint16': 'uint16_t',
    'uint64': 'uint64_t',
    'int8': 'int8_t',
    'int32': 'int32_t',
    'int16': 'int16_t',
    'int64': 'int64_t',
    'float16': 'error',
    'float32': 'float',
    'float64': 'double',
}


def _get_cython_type(dtype):
    """ Given a dtype, return a C name like 'int64_t' or 'double' """
    type_name = _get_dtype(dtype).name
    ctype = _cython_types.get(type_name, 'object')
    if ctype == 'error':
        raise MergeError('unsupported type: ' + type_name)
    return ctype


def _get_cython_type_upcast(dtype):
    """ Upcast a dtype to 'int64_t', 'double', or 'object' """
    if is_integer_dtype(dtype):
        return 'int64_t'
    elif is_float_dtype(dtype):
        return 'double'
    else:
        return 'object'


class _AsOfMerge(_OrderedMerge):
    _merge_type = 'asof_merge'

    def __init__(self, left, right, on=None, left_on=None, right_on=None,
                 left_index=False, right_index=False,
                 by=None, left_by=None, right_by=None,
                 axis=1, suffixes=('_x', '_y'), copy=True,
                 fill_method=None,
                 how='asof', tolerance=None,
                 allow_exact_matches=True,
                 direction='backward'):

        self.by = by
        self.left_by = left_by
        self.right_by = right_by
        self.tolerance = tolerance
        self.allow_exact_matches = allow_exact_matches
        self.direction = direction

        _OrderedMerge.__init__(self, left, right, on=on, left_on=left_on,
                               right_on=right_on, left_index=left_index,
                               right_index=right_index, axis=axis,
                               how=how, suffixes=suffixes,
                               fill_method=fill_method)

    def _validate_specification(self):
        super(_AsOfMerge, self)._validate_specification()

        # we only allow on to be a single item for on
        if len(self.left_on) != 1 and not self.left_index:
            raise MergeError("can only asof on a key for left")

        if len(self.right_on) != 1 and not self.right_index:
            raise MergeError("can only asof on a key for right")

        if self.left_index and isinstance(self.left.index, MultiIndex):
            raise MergeError("left can only have one index")

        if self.right_index and isinstance(self.right.index, MultiIndex):
            raise MergeError("right can only have one index")

        # set 'by' columns
        if self.by is not None:
            if self.left_by is not None or self.right_by is not None:
                raise MergeError('Can only pass by OR left_by '
                                 'and right_by')
            self.left_by = self.right_by = self.by
        if self.left_by is None and self.right_by is not None:
            raise MergeError('missing left_by')
        if self.left_by is not None and self.right_by is None:
            raise MergeError('missing right_by')

        # add 'by' to our key-list so we can have it in the
        # output as a key
        if self.left_by is not None:
            if not is_list_like(self.left_by):
                self.left_by = [self.left_by]
            if not is_list_like(self.right_by):
                self.right_by = [self.right_by]

            if len(self.left_by) != len(self.right_by):
                raise MergeError('left_by and right_by must be same length')

            self.left_on = self.left_by + list(self.left_on)
            self.right_on = self.right_by + list(self.right_on)

        # check 'direction' is valid
        if self.direction not in ['backward', 'forward', 'nearest']:
            raise MergeError('direction invalid: ' + self.direction)

    @property
    def _asof_key(self):
        """ This is our asof key, the 'on' """
        return self.left_on[-1]

    def _get_merge_keys(self):

        # note this function has side effects
        (left_join_keys,
         right_join_keys,
         join_names) = super(_AsOfMerge, self)._get_merge_keys()

        # validate index types are the same
        for lk, rk in zip(left_join_keys, right_join_keys):
            if not is_dtype_equal(lk.dtype, rk.dtype):
                raise MergeError("incompatible merge keys, "
                                 "must be the same type")

        # validate tolerance; must be a Timedelta if we have a DTI
        if self.tolerance is not None:

            if self.left_index:
                lt = self.left.index
            else:
                lt = left_join_keys[-1]

            msg = "incompatible tolerance, must be compat " \
                  "with type {0}".format(type(lt))

            if is_datetime64_dtype(lt) or is_datetime64tz_dtype(lt):
                if not isinstance(self.tolerance, Timedelta):
                    raise MergeError(msg)
                if self.tolerance < Timedelta(0):
                    raise MergeError("tolerance must be positive")

            elif is_int64_dtype(lt):
                if not is_integer(self.tolerance):
                    raise MergeError(msg)
                if self.tolerance < 0:
                    raise MergeError("tolerance must be positive")

            else:
                raise MergeError("key must be integer or timestamp")

        # validate allow_exact_matches
        if not is_bool(self.allow_exact_matches):
            raise MergeError("allow_exact_matches must be boolean, "
                             "passed {0}".format(self.allow_exact_matches))

        return left_join_keys, right_join_keys, join_names

    def _get_join_indexers(self):
        """ return the join indexers """

        def flip(xs):
            """ unlike np.transpose, this returns an array of tuples """
            labels = list(string.ascii_lowercase[:len(xs)])
            dtypes = [x.dtype for x in xs]
            labeled_dtypes = list(zip(labels, dtypes))
            return np.array(lzip(*xs), labeled_dtypes)

        # values to compare
        left_values = (self.left.index.values if self.left_index else
                       self.left_join_keys[-1])
        right_values = (self.right.index.values if self.right_index else
                        self.right_join_keys[-1])
        tolerance = self.tolerance

        # we required sortedness in the join keys
        msg = " keys must be sorted"
        if not Index(left_values).is_monotonic:
            raise ValueError('left' + msg)
        if not Index(right_values).is_monotonic:
            raise ValueError('right' + msg)

        # initial type conversion as needed
        if needs_i8_conversion(left_values):
            left_values = left_values.view('i8')
            right_values = right_values.view('i8')
            if tolerance is not None:
                tolerance = tolerance.value

        # a "by" parameter requires special handling
        if self.left_by is not None:
            # remove 'on' parameter from values if one existed
            if self.left_index and self.right_index:
                left_by_values = self.left_join_keys
                right_by_values = self.right_join_keys
            else:
                left_by_values = self.left_join_keys[0:-1]
                right_by_values = self.right_join_keys[0:-1]

            # get tuple representation of values if more than one
            if len(left_by_values) == 1:
                left_by_values = left_by_values[0]
                right_by_values = right_by_values[0]
            else:
                left_by_values = flip(left_by_values)
                right_by_values = flip(right_by_values)

            # upcast 'by' parameter because HashTable is limited
            by_type = _get_cython_type_upcast(left_by_values.dtype)
            by_type_caster = _type_casters[by_type]
            left_by_values = by_type_caster(left_by_values)
            right_by_values = by_type_caster(right_by_values)

            # choose appropriate function by type
            on_type = _get_cython_type(left_values.dtype)
            func = _asof_by_function(self.direction, on_type, by_type)
            return func(left_values,
                        right_values,
                        left_by_values,
                        right_by_values,
                        self.allow_exact_matches,
                        tolerance)
        else:
            # choose appropriate function by type
            on_type = _get_cython_type(left_values.dtype)
            func = _asof_function(self.direction, on_type)
            return func(left_values,
                        right_values,
                        self.allow_exact_matches,
                        tolerance)


def _get_multiindex_indexer(join_keys, index, sort):
    from functools import partial

    # bind `sort` argument
    fkeys = partial(_factorize_keys, sort=sort)

    # left & right join labels and num. of levels at each location
    rlab, llab, shape = map(list, zip(* map(fkeys, index.levels, join_keys)))
    if sort:
        rlab = list(map(np.take, rlab, index.labels))
    else:
        i8copy = lambda a: a.astype('i8', subok=False, copy=True)
        rlab = list(map(i8copy, index.labels))

    # fix right labels if there were any nulls
    for i in range(len(join_keys)):
        mask = index.labels[i] == -1
        if mask.any():
            # check if there already was any nulls at this location
            # if there was, it is factorized to `shape[i] - 1`
            a = join_keys[i][llab[i] == shape[i] - 1]
            if a.size == 0 or not a[0] != a[0]:
                shape[i] += 1

            rlab[i][mask] = shape[i] - 1

    # get flat i8 join keys
    lkey, rkey = _get_join_keys(llab, rlab, shape, sort)

    # factorize keys to a dense i8 space
    lkey, rkey, count = fkeys(lkey, rkey)

    return libjoin.left_outer_join(lkey, rkey, count, sort=sort)


def _get_single_indexer(join_key, index, sort=False):
    left_key, right_key, count = _factorize_keys(join_key, index, sort=sort)

    left_indexer, right_indexer = libjoin.left_outer_join(
        _ensure_int64(left_key),
        _ensure_int64(right_key),
        count, sort=sort)

    return left_indexer, right_indexer


def _left_join_on_index(left_ax, right_ax, join_keys, sort=False):
    if len(join_keys) > 1:
        if not ((isinstance(right_ax, MultiIndex) and
                 len(join_keys) == right_ax.nlevels)):
            raise AssertionError("If more than one join key is given then "
                                 "'right_ax' must be a MultiIndex and the "
                                 "number of join keys must be the number of "
                                 "levels in right_ax")

        left_indexer, right_indexer = \
            _get_multiindex_indexer(join_keys, right_ax, sort=sort)
    else:
        jkey = join_keys[0]

        left_indexer, right_indexer = \
            _get_single_indexer(jkey, right_ax, sort=sort)

    if sort or len(left_ax) != len(left_indexer):
        # if asked to sort or there are 1-to-many matches
        join_index = left_ax.take(left_indexer)
        return join_index, left_indexer, right_indexer

    # left frame preserves order & length of its index
    return left_ax, None, right_indexer


def _right_outer_join(x, y, max_groups):
    right_indexer, left_indexer = libjoin.left_outer_join(y, x, max_groups)
    return left_indexer, right_indexer


_join_functions = {
    'inner': libjoin.inner_join,
    'left': libjoin.left_outer_join,
    'right': _right_outer_join,
    'outer': libjoin.full_outer_join,
}


def _factorize_keys(lk, rk, sort=True):
    if is_datetime64tz_dtype(lk) and is_datetime64tz_dtype(rk):
        lk = lk.values
        rk = rk.values

    # if we exactly match in categories, allow us to use codes
    if (is_categorical_dtype(lk) and
            is_categorical_dtype(rk) and
            lk.is_dtype_equal(rk)):
        return lk.codes, rk.codes, len(lk.categories)

    if is_int_or_datetime_dtype(lk) and is_int_or_datetime_dtype(rk):
        klass = libhashtable.Int64Factorizer
        lk = _ensure_int64(com._values_from_object(lk))
        rk = _ensure_int64(com._values_from_object(rk))
    else:
        klass = libhashtable.Factorizer
        lk = _ensure_object(lk)
        rk = _ensure_object(rk)

    rizer = klass(max(len(lk), len(rk)))

    llab = rizer.factorize(lk)
    rlab = rizer.factorize(rk)

    count = rizer.get_count()

    if sort:
        uniques = rizer.uniques.to_array()
        llab, rlab = _sort_labels(uniques, llab, rlab)

    # NA group
    lmask = llab == -1
    lany = lmask.any()
    rmask = rlab == -1
    rany = rmask.any()

    if lany or rany:
        if lany:
            np.putmask(llab, lmask, count)
        if rany:
            np.putmask(rlab, rmask, count)
        count += 1

    return llab, rlab, count


def _sort_labels(uniques, left, right):
    if not isinstance(uniques, np.ndarray):
        # tuplesafe
        uniques = Index(uniques).values

    l = len(left)
    labels = np.concatenate([left, right])

    _, new_labels = algos.safe_sort(uniques, labels, na_sentinel=-1)
    new_labels = _ensure_int64(new_labels)
    new_left, new_right = new_labels[:l], new_labels[l:]

    return new_left, new_right


def _get_join_keys(llab, rlab, shape, sort):

    # how many levels can be done without overflow
    pred = lambda i: not is_int64_overflow_possible(shape[:i])
    nlev = next(filter(pred, range(len(shape), 0, -1)))

    # get keys for the first `nlev` levels
    stride = np.prod(shape[1:nlev], dtype='i8')
    lkey = stride * llab[0].astype('i8', subok=False, copy=False)
    rkey = stride * rlab[0].astype('i8', subok=False, copy=False)

    for i in range(1, nlev):
        stride //= shape[i]
        lkey += llab[i] * stride
        rkey += rlab[i] * stride

    if nlev == len(shape):  # all done!
        return lkey, rkey

    # densify current keys to avoid overflow
    lkey, rkey, count = _factorize_keys(lkey, rkey, sort=sort)

    llab = [lkey] + llab[nlev:]
    rlab = [rkey] + rlab[nlev:]
    shape = [count] + shape[nlev:]

    return _get_join_keys(llab, rlab, shape, sort)


def _should_fill(lname, rname):
    if (not isinstance(lname, compat.string_types) or
            not isinstance(rname, compat.string_types)):
        return True
    return lname == rname


def _any(x):
    return x is not None and len(x) > 0 and any([y is not None for y in x])
