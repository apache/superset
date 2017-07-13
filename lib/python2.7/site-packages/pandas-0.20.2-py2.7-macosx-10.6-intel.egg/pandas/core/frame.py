"""
DataFrame
---------
An efficient 2D container for potentially mixed-type time series or other
labeled data series.

Similar to its R counterpart, data.frame, except providing automatic data
alignment and a host of useful data manipulation methods having to do with the
labeling information
"""
from __future__ import division
# pylint: disable=E1101,E1103
# pylint: disable=W0212,W0231,W0703,W0622

import functools
import collections
import itertools
import sys
import types
import warnings
from textwrap import dedent

from numpy import nan as NA
import numpy as np
import numpy.ma as ma

from pandas.core.dtypes.cast import (
    maybe_upcast, infer_dtype_from_scalar,
    maybe_cast_to_datetime,
    maybe_infer_to_datetimelike,
    maybe_convert_platform,
    maybe_downcast_to_dtype,
    invalidate_string_dtypes,
    coerce_to_dtypes,
    maybe_upcast_putmask,
    find_common_type)
from pandas.core.dtypes.common import (
    is_categorical_dtype,
    is_object_dtype,
    is_extension_type,
    is_datetimetz,
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_bool_dtype,
    is_integer_dtype,
    is_float_dtype,
    is_integer,
    is_scalar,
    is_dtype_equal,
    needs_i8_conversion,
    _get_dtype_from_object,
    _ensure_float,
    _ensure_float64,
    _ensure_int64,
    _ensure_platform_int,
    is_list_like,
    is_iterator,
    is_sequence,
    is_named_tuple)
from pandas.core.dtypes.missing import isnull, notnull

from pandas.core.common import (_try_sort,
                                _default_index,
                                _values_from_object,
                                _maybe_box_datetimelike,
                                _dict_compat)
from pandas.core.generic import NDFrame, _shared_docs
from pandas.core.index import Index, MultiIndex, _ensure_index
from pandas.core.indexing import (maybe_droplevels, convert_to_index_sliceable,
                                  check_bool_indexer)
from pandas.core.internals import (BlockManager,
                                   create_block_manager_from_arrays,
                                   create_block_manager_from_blocks)
from pandas.core.series import Series
from pandas.core.categorical import Categorical
import pandas.core.computation.expressions as expressions
import pandas.core.algorithms as algorithms
from pandas.core.computation.eval import eval as _eval
from pandas.compat import (range, map, zip, lrange, lmap, lzip, StringIO, u,
                           OrderedDict, raise_with_traceback)
from pandas import compat
from pandas.compat.numpy import function as nv
from pandas.util._decorators import Appender, Substitution
from pandas.util._validators import validate_bool_kwarg

from pandas.core.indexes.period import PeriodIndex
from pandas.core.indexes.datetimes import DatetimeIndex
from pandas.core.indexes.timedeltas import TimedeltaIndex

import pandas.core.base as base
import pandas.core.common as com
import pandas.core.nanops as nanops
import pandas.core.ops as ops
import pandas.io.formats.format as fmt
import pandas.io.formats.console as console
from pandas.io.formats.printing import pprint_thing
import pandas.plotting._core as gfx

from pandas._libs import lib, algos as libalgos

from pandas.core.config import get_option

# ---------------------------------------------------------------------
# Docstring templates

_shared_doc_kwargs = dict(
    axes='index, columns', klass='DataFrame',
    axes_single_arg="{0 or 'index', 1 or 'columns'}",
    optional_by="""
        by : str or list of str
            Name or list of names which refer to the axis items.""",
    versionadded_to_excel='')

_numeric_only_doc = """numeric_only : boolean, default None
    Include only float, int, boolean data. If None, will attempt to use
    everything, then use only numeric data
"""

_merge_doc = """
Merge DataFrame objects by performing a database-style join operation by
columns or indexes.

If joining columns on columns, the DataFrame indexes *will be
ignored*. Otherwise if joining indexes on indexes or indexes on a column or
columns, the index will be passed on.

Parameters
----------%s
right : DataFrame
how : {'left', 'right', 'outer', 'inner'}, default 'inner'
    * left: use only keys from left frame, similar to a SQL left outer join;
      preserve key order
    * right: use only keys from right frame, similar to a SQL right outer join;
      preserve key order
    * outer: use union of keys from both frames, similar to a SQL full outer
      join; sort keys lexicographically
    * inner: use intersection of keys from both frames, similar to a SQL inner
      join; preserve the order of the left keys
on : label or list
    Field names to join on. Must be found in both DataFrames. If on is
    None and not merging on indexes, then it merges on the intersection of
    the columns by default.
left_on : label or list, or array-like
    Field names to join on in left DataFrame. Can be a vector or list of
    vectors of the length of the DataFrame to use a particular vector as
    the join key instead of columns
right_on : label or list, or array-like
    Field names to join on in right DataFrame or vector/list of vectors per
    left_on docs
left_index : boolean, default False
    Use the index from the left DataFrame as the join key(s). If it is a
    MultiIndex, the number of keys in the other DataFrame (either the index
    or a number of columns) must match the number of levels
right_index : boolean, default False
    Use the index from the right DataFrame as the join key. Same caveats as
    left_index
sort : boolean, default False
    Sort the join keys lexicographically in the result DataFrame. If False,
    the order of the join keys depends on the join type (how keyword)
suffixes : 2-length sequence (tuple, list, ...)
    Suffix to apply to overlapping column names in the left and right
    side, respectively
copy : boolean, default True
    If False, do not copy data unnecessarily
indicator : boolean or string, default False
    If True, adds a column to output DataFrame called "_merge" with
    information on the source of each row.
    If string, column with information on source of each row will be added to
    output DataFrame, and column will be named value of string.
    Information column is Categorical-type and takes on a value of "left_only"
    for observations whose merge key only appears in 'left' DataFrame,
    "right_only" for observations whose merge key only appears in 'right'
    DataFrame, and "both" if the observation's merge key is found in both.

    .. versionadded:: 0.17.0

Examples
--------

>>> A              >>> B
    lkey value         rkey value
0   foo  1         0   foo  5
1   bar  2         1   bar  6
2   baz  3         2   qux  7
3   foo  4         3   bar  8

>>> A.merge(B, left_on='lkey', right_on='rkey', how='outer')
   lkey  value_x  rkey  value_y
0  foo   1        foo   5
1  foo   4        foo   5
2  bar   2        bar   6
3  bar   2        bar   8
4  baz   3        NaN   NaN
5  NaN   NaN      qux   7

Returns
-------
merged : DataFrame
    The output type will the be same as 'left', if it is a subclass
    of DataFrame.

See also
--------
merge_ordered
merge_asof

"""

# -----------------------------------------------------------------------
# DataFrame class


class DataFrame(NDFrame):
    """ Two-dimensional size-mutable, potentially heterogeneous tabular data
    structure with labeled axes (rows and columns). Arithmetic operations
    align on both row and column labels. Can be thought of as a dict-like
    container for Series objects. The primary pandas data structure

    Parameters
    ----------
    data : numpy ndarray (structured or homogeneous), dict, or DataFrame
        Dict can contain Series, arrays, constants, or list-like objects
    index : Index or array-like
        Index to use for resulting frame. Will default to np.arange(n) if
        no indexing information part of input data and no index provided
    columns : Index or array-like
        Column labels to use for resulting frame. Will default to
        np.arange(n) if no column labels are provided
    dtype : dtype, default None
        Data type to force, otherwise infer
    copy : boolean, default False
        Copy data from inputs. Only affects DataFrame / 2d ndarray input

    Examples
    --------
    >>> d = {'col1': ts1, 'col2': ts2}
    >>> df = DataFrame(data=d, index=index)
    >>> df2 = DataFrame(np.random.randn(10, 5))
    >>> df3 = DataFrame(np.random.randn(10, 5),
    ...                 columns=['a', 'b', 'c', 'd', 'e'])

    See also
    --------
    DataFrame.from_records : constructor from tuples, also record arrays
    DataFrame.from_dict : from dicts of Series, arrays, or dicts
    DataFrame.from_items : from sequence of (key, value) pairs
    pandas.read_csv, pandas.read_table, pandas.read_clipboard
    """

    @property
    def _constructor(self):
        return DataFrame

    _constructor_sliced = Series

    @property
    def _constructor_expanddim(self):
        from pandas.core.panel import Panel
        return Panel

    def __init__(self, data=None, index=None, columns=None, dtype=None,
                 copy=False):
        if data is None:
            data = {}
        if dtype is not None:
            dtype = self._validate_dtype(dtype)

        if isinstance(data, DataFrame):
            data = data._data

        if isinstance(data, BlockManager):
            mgr = self._init_mgr(data, axes=dict(index=index, columns=columns),
                                 dtype=dtype, copy=copy)
        elif isinstance(data, dict):
            mgr = self._init_dict(data, index, columns, dtype=dtype)
        elif isinstance(data, ma.MaskedArray):
            import numpy.ma.mrecords as mrecords
            # masked recarray
            if isinstance(data, mrecords.MaskedRecords):
                mgr = _masked_rec_array_to_mgr(data, index, columns, dtype,
                                               copy)

            # a masked array
            else:
                mask = ma.getmaskarray(data)
                if mask.any():
                    data, fill_value = maybe_upcast(data, copy=True)
                    data[mask] = fill_value
                else:
                    data = data.copy()
                mgr = self._init_ndarray(data, index, columns, dtype=dtype,
                                         copy=copy)

        elif isinstance(data, (np.ndarray, Series, Index)):
            if data.dtype.names:
                data_columns = list(data.dtype.names)
                data = dict((k, data[k]) for k in data_columns)
                if columns is None:
                    columns = data_columns
                mgr = self._init_dict(data, index, columns, dtype=dtype)
            elif getattr(data, 'name', None) is not None:
                mgr = self._init_dict({data.name: data}, index, columns,
                                      dtype=dtype)
            else:
                mgr = self._init_ndarray(data, index, columns, dtype=dtype,
                                         copy=copy)
        elif isinstance(data, (list, types.GeneratorType)):
            if isinstance(data, types.GeneratorType):
                data = list(data)
            if len(data) > 0:
                if is_list_like(data[0]) and getattr(data[0], 'ndim', 1) == 1:
                    if is_named_tuple(data[0]) and columns is None:
                        columns = data[0]._fields
                    arrays, columns = _to_arrays(data, columns, dtype=dtype)
                    columns = _ensure_index(columns)

                    # set the index
                    if index is None:
                        if isinstance(data[0], Series):
                            index = _get_names_from_index(data)
                        elif isinstance(data[0], Categorical):
                            index = _default_index(len(data[0]))
                        else:
                            index = _default_index(len(data))

                    mgr = _arrays_to_mgr(arrays, columns, index, columns,
                                         dtype=dtype)
                else:
                    mgr = self._init_ndarray(data, index, columns, dtype=dtype,
                                             copy=copy)
            else:
                mgr = self._init_dict({}, index, columns, dtype=dtype)
        elif isinstance(data, collections.Iterator):
            raise TypeError("data argument can't be an iterator")
        else:
            try:
                arr = np.array(data, dtype=dtype, copy=copy)
            except (ValueError, TypeError) as e:
                exc = TypeError('DataFrame constructor called with '
                                'incompatible data and dtype: %s' % e)
                raise_with_traceback(exc)

            if arr.ndim == 0 and index is not None and columns is not None:
                if isinstance(data, compat.string_types) and dtype is None:
                    dtype = np.object_
                if dtype is None:
                    dtype, data = infer_dtype_from_scalar(data)

                values = np.empty((len(index), len(columns)), dtype=dtype)
                values.fill(data)
                mgr = self._init_ndarray(values, index, columns, dtype=dtype,
                                         copy=False)
            else:
                raise ValueError('DataFrame constructor not properly called!')

        NDFrame.__init__(self, mgr, fastpath=True)

    def _init_dict(self, data, index, columns, dtype=None):
        """
        Segregate Series based on type and coerce into matrices.
        Needs to handle a lot of exceptional cases.
        """
        if columns is not None:
            columns = _ensure_index(columns)

            # GH10856
            # raise ValueError if only scalars in dict
            if index is None:
                extract_index(list(data.values()))

            # prefilter if columns passed
            data = dict((k, v) for k, v in compat.iteritems(data)
                        if k in columns)

            if index is None:
                index = extract_index(list(data.values()))

            else:
                index = _ensure_index(index)

            arrays = []
            data_names = []
            for k in columns:
                if k not in data:
                    # no obvious "empty" int column
                    if dtype is not None and issubclass(dtype.type,
                                                        np.integer):
                        continue

                    if dtype is None:
                        # 1783
                        v = np.empty(len(index), dtype=object)
                    elif np.issubdtype(dtype, np.flexible):
                        v = np.empty(len(index), dtype=object)
                    else:
                        v = np.empty(len(index), dtype=dtype)

                    v.fill(NA)
                else:
                    v = data[k]
                data_names.append(k)
                arrays.append(v)

        else:
            keys = list(data.keys())
            if not isinstance(data, OrderedDict):
                keys = _try_sort(keys)
            columns = data_names = Index(keys)
            arrays = [data[k] for k in keys]

        return _arrays_to_mgr(arrays, data_names, index, columns, dtype=dtype)

    def _init_ndarray(self, values, index, columns, dtype=None, copy=False):
        # input must be a ndarray, list, Series, index

        if isinstance(values, Series):
            if columns is None:
                if values.name is not None:
                    columns = [values.name]
            if index is None:
                index = values.index
            else:
                values = values.reindex(index)

            # zero len case (GH #2234)
            if not len(values) and columns is not None and len(columns):
                values = np.empty((0, 1), dtype=object)

        # helper to create the axes as indexes
        def _get_axes(N, K, index=index, columns=columns):
            # return axes or defaults

            if index is None:
                index = _default_index(N)
            else:
                index = _ensure_index(index)

            if columns is None:
                columns = _default_index(K)
            else:
                columns = _ensure_index(columns)
            return index, columns

        # we could have a categorical type passed or coerced to 'category'
        # recast this to an _arrays_to_mgr
        if (is_categorical_dtype(getattr(values, 'dtype', None)) or
                is_categorical_dtype(dtype)):

            if not hasattr(values, 'dtype'):
                values = _prep_ndarray(values, copy=copy)
                values = values.ravel()
            elif copy:
                values = values.copy()

            index, columns = _get_axes(len(values), 1)
            return _arrays_to_mgr([values], columns, index, columns,
                                  dtype=dtype)
        elif is_datetimetz(values):
            return self._init_dict({0: values}, index, columns, dtype=dtype)

        # by definition an array here
        # the dtypes will be coerced to a single dtype
        values = _prep_ndarray(values, copy=copy)

        if dtype is not None:
            if values.dtype != dtype:
                try:
                    values = values.astype(dtype)
                except Exception as orig:
                    e = ValueError("failed to cast to '%s' (Exception was: %s)"
                                   % (dtype, orig))
                    raise_with_traceback(e)

        index, columns = _get_axes(*values.shape)
        values = values.T

        # if we don't have a dtype specified, then try to convert objects
        # on the entire block; this is to convert if we have datetimelike's
        # embedded in an object type
        if dtype is None and is_object_dtype(values):
            values = maybe_infer_to_datetimelike(values)

        return create_block_manager_from_blocks([values], [columns, index])

    @property
    def axes(self):
        """
        Return a list with the row axis labels and column axis labels as the
        only members. They are returned in that order.
        """
        return [self.index, self.columns]

    @property
    def shape(self):
        """
        Return a tuple representing the dimensionality of the DataFrame.
        """
        return len(self.index), len(self.columns)

    def _repr_fits_vertical_(self):
        """
        Check length against max_rows.
        """
        max_rows = get_option("display.max_rows")
        return len(self) <= max_rows

    def _repr_fits_horizontal_(self, ignore_width=False):
        """
        Check if full repr fits in horizontal boundaries imposed by the display
        options width and max_columns. In case off non-interactive session, no
        boundaries apply.

        ignore_width is here so ipnb+HTML output can behave the way
        users expect. display.max_columns remains in effect.
        GH3541, GH3573
        """

        width, height = console.get_console_size()
        max_columns = get_option("display.max_columns")
        nb_columns = len(self.columns)

        # exceed max columns
        if ((max_columns and nb_columns > max_columns) or
                ((not ignore_width) and width and nb_columns > (width // 2))):
            return False

        # used by repr_html under IPython notebook or scripts ignore terminal
        # dims
        if ignore_width or not com.in_interactive_session():
            return True

        if (get_option('display.width') is not None or
                com.in_ipython_frontend()):
            # check at least the column row for excessive width
            max_rows = 1
        else:
            max_rows = get_option("display.max_rows")

        # when auto-detecting, so width=None and not in ipython front end
        # check whether repr fits horizontal by actualy checking
        # the width of the rendered repr
        buf = StringIO()

        # only care about the stuff we'll actually print out
        # and to_string on entire frame may be expensive
        d = self

        if not (max_rows is None):  # unlimited rows
            # min of two, where one may be None
            d = d.iloc[:min(max_rows, len(d))]
        else:
            return True

        d.to_string(buf=buf)
        value = buf.getvalue()
        repr_width = max([len(l) for l in value.split('\n')])

        return repr_width < width

    def _info_repr(self):
        """True if the repr should show the info view."""
        info_repr_option = (get_option("display.large_repr") == "info")
        return info_repr_option and not (self._repr_fits_horizontal_() and
                                         self._repr_fits_vertical_())

    def __unicode__(self):
        """
        Return a string representation for a particular DataFrame

        Invoked by unicode(df) in py2 only. Yields a Unicode String in both
        py2/py3.
        """
        buf = StringIO(u(""))
        if self._info_repr():
            self.info(buf=buf)
            return buf.getvalue()

        max_rows = get_option("display.max_rows")
        max_cols = get_option("display.max_columns")
        show_dimensions = get_option("display.show_dimensions")
        if get_option("display.expand_frame_repr"):
            width, _ = console.get_console_size()
        else:
            width = None
        self.to_string(buf=buf, max_rows=max_rows, max_cols=max_cols,
                       line_width=width, show_dimensions=show_dimensions)

        return buf.getvalue()

    def _repr_html_(self):
        """
        Return a html representation for a particular DataFrame.
        Mainly for IPython notebook.
        """
        # qtconsole doesn't report its line width, and also
        # behaves badly when outputting an HTML table
        # that doesn't fit the window, so disable it.
        # XXX: In IPython 3.x and above, the Qt console will not attempt to
        # display HTML, so this check can be removed when support for
        # IPython 2.x is no longer needed.
        if com.in_qtconsole():
            # 'HTML output is disabled in QtConsole'
            return None

        if self._info_repr():
            buf = StringIO(u(""))
            self.info(buf=buf)
            # need to escape the <class>, should be the first line.
            val = buf.getvalue().replace('<', r'&lt;', 1)
            val = val.replace('>', r'&gt;', 1)
            return '<pre>' + val + '</pre>'

        if get_option("display.notebook_repr_html"):
            max_rows = get_option("display.max_rows")
            max_cols = get_option("display.max_columns")
            show_dimensions = get_option("display.show_dimensions")

            return self.to_html(max_rows=max_rows, max_cols=max_cols,
                                show_dimensions=show_dimensions, notebook=True)
        else:
            return None

    @property
    def style(self):
        """
        Property returning a Styler object containing methods for
        building a styled HTML representation fo the DataFrame.

        See Also
        --------
        pandas.io.formats.style.Styler
        """
        from pandas.io.formats.style import Styler
        return Styler(self)

    def iteritems(self):
        """
        Iterator over (column name, Series) pairs.

        See also
        --------
        iterrows : Iterate over DataFrame rows as (index, Series) pairs.
        itertuples : Iterate over DataFrame rows as namedtuples of the values.

        """
        if self.columns.is_unique and hasattr(self, '_item_cache'):
            for k in self.columns:
                yield k, self._get_item_cache(k)
        else:
            for i, k in enumerate(self.columns):
                yield k, self._ixs(i, axis=1)

    def iterrows(self):
        """
        Iterate over DataFrame rows as (index, Series) pairs.

        Notes
        -----

        1. Because ``iterrows`` returns a Series for each row,
           it does **not** preserve dtypes across the rows (dtypes are
           preserved across columns for DataFrames). For example,

           >>> df = pd.DataFrame([[1, 1.5]], columns=['int', 'float'])
           >>> row = next(df.iterrows())[1]
           >>> row
           int      1.0
           float    1.5
           Name: 0, dtype: float64
           >>> print(row['int'].dtype)
           float64
           >>> print(df['int'].dtype)
           int64

           To preserve dtypes while iterating over the rows, it is better
           to use :meth:`itertuples` which returns namedtuples of the values
           and which is generally faster than ``iterrows``.

        2. You should **never modify** something you are iterating over.
           This is not guaranteed to work in all cases. Depending on the
           data types, the iterator returns a copy and not a view, and writing
           to it will have no effect.

        Returns
        -------
        it : generator
            A generator that iterates over the rows of the frame.

        See also
        --------
        itertuples : Iterate over DataFrame rows as namedtuples of the values.
        iteritems : Iterate over (column name, Series) pairs.

        """
        columns = self.columns
        klass = self._constructor_sliced
        for k, v in zip(self.index, self.values):
            s = klass(v, index=columns, name=k)
            yield k, s

    def itertuples(self, index=True, name="Pandas"):
        """
        Iterate over DataFrame rows as namedtuples, with index value as first
        element of the tuple.

        Parameters
        ----------
        index : boolean, default True
            If True, return the index as the first element of the tuple.
        name : string, default "Pandas"
            The name of the returned namedtuples or None to return regular
            tuples.

        Notes
        -----
        The column names will be renamed to positional names if they are
        invalid Python identifiers, repeated, or start with an underscore.
        With a large number of columns (>255), regular tuples are returned.

        See also
        --------
        iterrows : Iterate over DataFrame rows as (index, Series) pairs.
        iteritems : Iterate over (column name, Series) pairs.

        Examples
        --------

        >>> df = pd.DataFrame({'col1': [1, 2], 'col2': [0.1, 0.2]},
                              index=['a', 'b'])
        >>> df
           col1  col2
        a     1   0.1
        b     2   0.2
        >>> for row in df.itertuples():
        ...     print(row)
        ...
        Pandas(Index='a', col1=1, col2=0.10000000000000001)
        Pandas(Index='b', col1=2, col2=0.20000000000000001)

        """
        arrays = []
        fields = []
        if index:
            arrays.append(self.index)
            fields.append("Index")

        # use integer indexing because of possible duplicate column names
        arrays.extend(self.iloc[:, k] for k in range(len(self.columns)))

        # Python 3 supports at most 255 arguments to constructor, and
        # things get slow with this many fields in Python 2
        if name is not None and len(self.columns) + index < 256:
            # `rename` is unsupported in Python 2.6
            try:
                itertuple = collections.namedtuple(name,
                                                   fields + list(self.columns),
                                                   rename=True)
                return map(itertuple._make, zip(*arrays))
            except Exception:
                pass

        # fallback to regular tuples
        return zip(*arrays)

    if compat.PY3:  # pragma: no cover
        items = iteritems

    def __len__(self):
        """Returns length of info axis, but here we use the index """
        return len(self.index)

    def dot(self, other):
        """
        Matrix multiplication with DataFrame or Series objects

        Parameters
        ----------
        other : DataFrame or Series

        Returns
        -------
        dot_product : DataFrame or Series
        """
        if isinstance(other, (Series, DataFrame)):
            common = self.columns.union(other.index)
            if (len(common) > len(self.columns) or
                    len(common) > len(other.index)):
                raise ValueError('matrices are not aligned')

            left = self.reindex(columns=common, copy=False)
            right = other.reindex(index=common, copy=False)
            lvals = left.values
            rvals = right.values
        else:
            left = self
            lvals = self.values
            rvals = np.asarray(other)
            if lvals.shape[1] != rvals.shape[0]:
                raise ValueError('Dot product shape mismatch, %s vs %s' %
                                 (lvals.shape, rvals.shape))

        if isinstance(other, DataFrame):
            return self._constructor(np.dot(lvals, rvals), index=left.index,
                                     columns=other.columns)
        elif isinstance(other, Series):
            return Series(np.dot(lvals, rvals), index=left.index)
        elif isinstance(rvals, (np.ndarray, Index)):
            result = np.dot(lvals, rvals)
            if result.ndim == 2:
                return self._constructor(result, index=left.index)
            else:
                return Series(result, index=left.index)
        else:  # pragma: no cover
            raise TypeError('unsupported type: %s' % type(other))

    # ----------------------------------------------------------------------
    # IO methods (to / from other formats)

    @classmethod
    def from_dict(cls, data, orient='columns', dtype=None):
        """
        Construct DataFrame from dict of array-like or dicts

        Parameters
        ----------
        data : dict
            {field : array-like} or {field : dict}
        orient : {'columns', 'index'}, default 'columns'
            The "orientation" of the data. If the keys of the passed dict
            should be the columns of the resulting DataFrame, pass 'columns'
            (default). Otherwise if the keys should be rows, pass 'index'.
        dtype : dtype, default None
            Data type to force, otherwise infer

        Returns
        -------
        DataFrame
        """
        index, columns = None, None
        orient = orient.lower()
        if orient == 'index':
            if len(data) > 0:
                # TODO speed up Series case
                if isinstance(list(data.values())[0], (Series, dict)):
                    data = _from_nested_dict(data)
                else:
                    data, index = list(data.values()), list(data.keys())
        elif orient != 'columns':  # pragma: no cover
            raise ValueError('only recognize index or columns for orient')

        return cls(data, index=index, columns=columns, dtype=dtype)

    def to_dict(self, orient='dict'):
        """Convert DataFrame to dictionary.

        Parameters
        ----------
        orient : str {'dict', 'list', 'series', 'split', 'records', 'index'}
            Determines the type of the values of the dictionary.

            - dict (default) : dict like {column -> {index -> value}}
            - list : dict like {column -> [values]}
            - series : dict like {column -> Series(values)}
            - split : dict like
              {index -> [index], columns -> [columns], data -> [values]}
            - records : list like
              [{column -> value}, ... , {column -> value}]
            - index : dict like {index -> {column -> value}}

              .. versionadded:: 0.17.0

            Abbreviations are allowed. `s` indicates `series` and `sp`
            indicates `split`.

        Returns
        -------
        result : dict like {column -> {index -> value}}
        """
        if not self.columns.is_unique:
            warnings.warn("DataFrame columns are not unique, some "
                          "columns will be omitted.", UserWarning)
        if orient.lower().startswith('d'):
            return dict((k, v.to_dict()) for k, v in compat.iteritems(self))
        elif orient.lower().startswith('l'):
            return dict((k, v.tolist()) for k, v in compat.iteritems(self))
        elif orient.lower().startswith('sp'):
            return {'index': self.index.tolist(),
                    'columns': self.columns.tolist(),
                    'data': lib.map_infer(self.values.ravel(),
                                          _maybe_box_datetimelike)
                    .reshape(self.values.shape).tolist()}
        elif orient.lower().startswith('s'):
            return dict((k, _maybe_box_datetimelike(v))
                        for k, v in compat.iteritems(self))
        elif orient.lower().startswith('r'):
            return [dict((k, _maybe_box_datetimelike(v))
                         for k, v in zip(self.columns, row))
                    for row in self.values]
        elif orient.lower().startswith('i'):
            return dict((k, v.to_dict()) for k, v in self.iterrows())
        else:
            raise ValueError("orient '%s' not understood" % orient)

    def to_gbq(self, destination_table, project_id, chunksize=10000,
               verbose=True, reauth=False, if_exists='fail', private_key=None):
        """Write a DataFrame to a Google BigQuery table.

        The main method a user calls to export pandas DataFrame contents to
        Google BigQuery table.

        Google BigQuery API Client Library v2 for Python is used.
        Documentation is available `here
        <https://developers.google.com/api-client-library/python/apis/bigquery/v2>`__

        Authentication to the Google BigQuery service is via OAuth 2.0.

        - If "private_key" is not provided:

          By default "application default credentials" are used.

          If default application credentials are not found or are restrictive,
          user account credentials are used. In this case, you will be asked to
          grant permissions for product name 'pandas GBQ'.

        - If "private_key" is provided:

          Service account credentials will be used to authenticate.

        Parameters
        ----------
        dataframe : DataFrame
            DataFrame to be written
        destination_table : string
            Name of table to be written, in the form 'dataset.tablename'
        project_id : str
            Google BigQuery Account project ID.
        chunksize : int (default 10000)
            Number of rows to be inserted in each chunk from the dataframe.
        verbose : boolean (default True)
            Show percentage complete
        reauth : boolean (default False)
            Force Google BigQuery to reauthenticate the user. This is useful
            if multiple accounts are used.
        if_exists : {'fail', 'replace', 'append'}, default 'fail'
            'fail': If table exists, do nothing.
            'replace': If table exists, drop it, recreate it, and insert data.
            'append': If table exists, insert data. Create if does not exist.
        private_key : str (optional)
            Service account private key in JSON format. Can be file path
            or string contents. This is useful for remote server
            authentication (eg. jupyter iPython notebook on remote host)
        """

        from pandas.io import gbq
        return gbq.to_gbq(self, destination_table, project_id=project_id,
                          chunksize=chunksize, verbose=verbose, reauth=reauth,
                          if_exists=if_exists, private_key=private_key)

    @classmethod
    def from_records(cls, data, index=None, exclude=None, columns=None,
                     coerce_float=False, nrows=None):
        """
        Convert structured or record ndarray to DataFrame

        Parameters
        ----------
        data : ndarray (structured dtype), list of tuples, dict, or DataFrame
        index : string, list of fields, array-like
            Field of array to use as the index, alternately a specific set of
            input labels to use
        exclude : sequence, default None
            Columns or fields to exclude
        columns : sequence, default None
            Column names to use. If the passed data do not have names
            associated with them, this argument provides names for the
            columns. Otherwise this argument indicates the order of the columns
            in the result (any names not found in the data will become all-NA
            columns)
        coerce_float : boolean, default False
            Attempt to convert values of non-string, non-numeric objects (like
            decimal.Decimal) to floating point, useful for SQL result sets

        Returns
        -------
        df : DataFrame
        """

        # Make a copy of the input columns so we can modify it
        if columns is not None:
            columns = _ensure_index(columns)

        if is_iterator(data):
            if nrows == 0:
                return cls()

            try:
                first_row = next(data)
            except StopIteration:
                return cls(index=index, columns=columns)

            dtype = None
            if hasattr(first_row, 'dtype') and first_row.dtype.names:
                dtype = first_row.dtype

            values = [first_row]

            if nrows is None:
                values += data
            else:
                values.extend(itertools.islice(data, nrows - 1))

            if dtype is not None:
                data = np.array(values, dtype=dtype)
            else:
                data = values

        if isinstance(data, dict):
            if columns is None:
                columns = arr_columns = _ensure_index(sorted(data))
                arrays = [data[k] for k in columns]
            else:
                arrays = []
                arr_columns = []
                for k, v in compat.iteritems(data):
                    if k in columns:
                        arr_columns.append(k)
                        arrays.append(v)

                arrays, arr_columns = _reorder_arrays(arrays, arr_columns,
                                                      columns)

        elif isinstance(data, (np.ndarray, DataFrame)):
            arrays, columns = _to_arrays(data, columns)
            if columns is not None:
                columns = _ensure_index(columns)
            arr_columns = columns
        else:
            arrays, arr_columns = _to_arrays(data, columns,
                                             coerce_float=coerce_float)

            arr_columns = _ensure_index(arr_columns)
            if columns is not None:
                columns = _ensure_index(columns)
            else:
                columns = arr_columns

        if exclude is None:
            exclude = set()
        else:
            exclude = set(exclude)

        result_index = None
        if index is not None:
            if (isinstance(index, compat.string_types) or
                    not hasattr(index, "__iter__")):
                i = columns.get_loc(index)
                exclude.add(index)
                if len(arrays) > 0:
                    result_index = Index(arrays[i], name=index)
                else:
                    result_index = Index([], name=index)
            else:
                try:
                    to_remove = [arr_columns.get_loc(field) for field in index]

                    result_index = MultiIndex.from_arrays(
                        [arrays[i] for i in to_remove], names=index)

                    exclude.update(index)
                except Exception:
                    result_index = index

        if any(exclude):
            arr_exclude = [x for x in exclude if x in arr_columns]
            to_remove = [arr_columns.get_loc(col) for col in arr_exclude]
            arrays = [v for i, v in enumerate(arrays) if i not in to_remove]

            arr_columns = arr_columns.drop(arr_exclude)
            columns = columns.drop(exclude)

        mgr = _arrays_to_mgr(arrays, arr_columns, result_index, columns)

        return cls(mgr)

    def to_records(self, index=True, convert_datetime64=True):
        """
        Convert DataFrame to record array. Index will be put in the
        'index' field of the record array if requested

        Parameters
        ----------
        index : boolean, default True
            Include index in resulting record array, stored in 'index' field
        convert_datetime64 : boolean, default True
            Whether to convert the index to datetime.datetime if it is a
            DatetimeIndex

        Returns
        -------
        y : recarray
        """
        if index:
            if is_datetime64_any_dtype(self.index) and convert_datetime64:
                ix_vals = [self.index.to_pydatetime()]
            else:
                if isinstance(self.index, MultiIndex):
                    # array of tuples to numpy cols. copy copy copy
                    ix_vals = lmap(np.array, zip(*self.index.values))
                else:
                    ix_vals = [self.index.values]

            arrays = ix_vals + [self[c].get_values() for c in self.columns]

            count = 0
            index_names = list(self.index.names)
            if isinstance(self.index, MultiIndex):
                for i, n in enumerate(index_names):
                    if n is None:
                        index_names[i] = 'level_%d' % count
                        count += 1
            elif index_names[0] is None:
                index_names = ['index']
            names = (lmap(compat.text_type, index_names) +
                     lmap(compat.text_type, self.columns))
        else:
            arrays = [self[c].get_values() for c in self.columns]
            names = lmap(compat.text_type, self.columns)

        formats = [v.dtype for v in arrays]
        return np.rec.fromarrays(
            arrays,
            dtype={'names': names, 'formats': formats}
        )

    @classmethod
    def from_items(cls, items, columns=None, orient='columns'):
        """
        Convert (key, value) pairs to DataFrame. The keys will be the axis
        index (usually the columns, but depends on the specified
        orientation). The values should be arrays or Series.

        Parameters
        ----------
        items : sequence of (key, value) pairs
            Values should be arrays or Series.
        columns : sequence of column labels, optional
            Must be passed if orient='index'.
        orient : {'columns', 'index'}, default 'columns'
            The "orientation" of the data. If the keys of the
            input correspond to column labels, pass 'columns'
            (default). Otherwise if the keys correspond to the index,
            pass 'index'.

        Returns
        -------
        frame : DataFrame
        """
        keys, values = lzip(*items)

        if orient == 'columns':
            if columns is not None:
                columns = _ensure_index(columns)

                idict = dict(items)
                if len(idict) < len(items):
                    if not columns.equals(_ensure_index(keys)):
                        raise ValueError('With non-unique item names, passed '
                                         'columns must be identical')
                    arrays = values
                else:
                    arrays = [idict[k] for k in columns if k in idict]
            else:
                columns = _ensure_index(keys)
                arrays = values

            return cls._from_arrays(arrays, columns, None)
        elif orient == 'index':
            if columns is None:
                raise TypeError("Must pass columns with orient='index'")

            keys = _ensure_index(keys)

            arr = np.array(values, dtype=object).T
            data = [lib.maybe_convert_objects(v) for v in arr]
            return cls._from_arrays(data, columns, keys)
        else:  # pragma: no cover
            raise ValueError("'orient' must be either 'columns' or 'index'")

    @classmethod
    def _from_arrays(cls, arrays, columns, index, dtype=None):
        mgr = _arrays_to_mgr(arrays, columns, index, columns, dtype=dtype)
        return cls(mgr)

    @classmethod
    def from_csv(cls, path, header=0, sep=',', index_col=0, parse_dates=True,
                 encoding=None, tupleize_cols=False,
                 infer_datetime_format=False):
        """
        Read CSV file (DISCOURAGED, please use :func:`pandas.read_csv`
        instead).

        It is preferable to use the more powerful :func:`pandas.read_csv`
        for most general purposes, but ``from_csv`` makes for an easy
        roundtrip to and from a file (the exact counterpart of
        ``to_csv``), especially with a DataFrame of time series data.

        This method only differs from the preferred :func:`pandas.read_csv`
        in some defaults:

        - `index_col` is ``0`` instead of ``None`` (take first column as index
          by default)
        - `parse_dates` is ``True`` instead of ``False`` (try parsing the index
          as datetime by default)

        So a ``pd.DataFrame.from_csv(path)`` can be replaced by
        ``pd.read_csv(path, index_col=0, parse_dates=True)``.

        Parameters
        ----------
        path : string file path or file handle / StringIO
        header : int, default 0
            Row to use as header (skip prior rows)
        sep : string, default ','
            Field delimiter
        index_col : int or sequence, default 0
            Column to use for index. If a sequence is given, a MultiIndex
            is used. Different default from read_table
        parse_dates : boolean, default True
            Parse dates. Different default from read_table
        tupleize_cols : boolean, default False
            write multi_index columns as a list of tuples (if True)
            or new (expanded format) if False)
        infer_datetime_format: boolean, default False
            If True and `parse_dates` is True for a column, try to infer the
            datetime format based on the first datetime string. If the format
            can be inferred, there often will be a large parsing speed-up.

        See also
        --------
        pandas.read_csv

        Returns
        -------
        y : DataFrame

        """
        from pandas.io.parsers import read_table
        return read_table(path, header=header, sep=sep,
                          parse_dates=parse_dates, index_col=index_col,
                          encoding=encoding, tupleize_cols=tupleize_cols,
                          infer_datetime_format=infer_datetime_format)

    def to_sparse(self, fill_value=None, kind='block'):
        """
        Convert to SparseDataFrame

        Parameters
        ----------
        fill_value : float, default NaN
        kind : {'block', 'integer'}

        Returns
        -------
        y : SparseDataFrame
        """
        from pandas.core.sparse.frame import SparseDataFrame
        return SparseDataFrame(self._series, index=self.index,
                               columns=self.columns, default_kind=kind,
                               default_fill_value=fill_value)

    def to_panel(self):
        """
        Transform long (stacked) format (DataFrame) into wide (3D, Panel)
        format.

        Currently the index of the DataFrame must be a 2-level MultiIndex. This
        may be generalized later

        Returns
        -------
        panel : Panel
        """
        # only support this kind for now
        if (not isinstance(self.index, MultiIndex) or  # pragma: no cover
                len(self.index.levels) != 2):
            raise NotImplementedError('Only 2-level MultiIndex are supported.')

        if not self.index.is_unique:
            raise ValueError("Can't convert non-uniquely indexed "
                             "DataFrame to Panel")

        self._consolidate_inplace()

        # minor axis must be sorted
        if self.index.lexsort_depth < 2:
            selfsorted = self.sort_index(level=0)
        else:
            selfsorted = self

        major_axis, minor_axis = selfsorted.index.levels
        major_labels, minor_labels = selfsorted.index.labels
        shape = len(major_axis), len(minor_axis)

        # preserve names, if any
        major_axis = major_axis.copy()
        major_axis.name = self.index.names[0]

        minor_axis = minor_axis.copy()
        minor_axis.name = self.index.names[1]

        # create new axes
        new_axes = [selfsorted.columns, major_axis, minor_axis]

        # create new manager
        new_mgr = selfsorted._data.reshape_nd(axes=new_axes,
                                              labels=[major_labels,
                                                      minor_labels],
                                              shape=shape,
                                              ref_items=selfsorted.columns)

        return self._constructor_expanddim(new_mgr)

    def to_csv(self, path_or_buf=None, sep=",", na_rep='', float_format=None,
               columns=None, header=True, index=True, index_label=None,
               mode='w', encoding=None, compression=None, quoting=None,
               quotechar='"', line_terminator='\n', chunksize=None,
               tupleize_cols=False, date_format=None, doublequote=True,
               escapechar=None, decimal='.'):
        r"""Write DataFrame to a comma-separated values (csv) file

        Parameters
        ----------
        path_or_buf : string or file handle, default None
            File path or object, if None is provided the result is returned as
            a string.
        sep : character, default ','
            Field delimiter for the output file.
        na_rep : string, default ''
            Missing data representation
        float_format : string, default None
            Format string for floating point numbers
        columns : sequence, optional
            Columns to write
        header : boolean or list of string, default True
            Write out column names. If a list of string is given it is assumed
            to be aliases for the column names
        index : boolean, default True
            Write row names (index)
        index_label : string or sequence, or False, default None
            Column label for index column(s) if desired. If None is given, and
            `header` and `index` are True, then the index names are used. A
            sequence should be given if the DataFrame uses MultiIndex.  If
            False do not print fields for index names. Use index_label=False
            for easier importing in R
        mode : str
            Python write mode, default 'w'
        encoding : string, optional
            A string representing the encoding to use in the output file,
            defaults to 'ascii' on Python 2 and 'utf-8' on Python 3.
        compression : string, optional
            a string representing the compression to use in the output file,
            allowed values are 'gzip', 'bz2', 'xz',
            only used when the first argument is a filename
        line_terminator : string, default ``'\n'``
            The newline character or character sequence to use in the output
            file
        quoting : optional constant from csv module
            defaults to csv.QUOTE_MINIMAL. If you have set a `float_format`
            then floats are converted to strings and thus csv.QUOTE_NONNUMERIC
            will treat them as non-numeric
        quotechar : string (length 1), default '\"'
            character used to quote fields
        doublequote : boolean, default True
            Control quoting of `quotechar` inside a field
        escapechar : string (length 1), default None
            character used to escape `sep` and `quotechar` when appropriate
        chunksize : int or None
            rows to write at a time
        tupleize_cols : boolean, default False
            write multi_index columns as a list of tuples (if True)
            or new (expanded format) if False)
        date_format : string, default None
            Format string for datetime objects
        decimal: string, default '.'
            Character recognized as decimal separator. E.g. use ',' for
            European data

            .. versionadded:: 0.16.0

        """
        formatter = fmt.CSVFormatter(self, path_or_buf,
                                     line_terminator=line_terminator, sep=sep,
                                     encoding=encoding,
                                     compression=compression, quoting=quoting,
                                     na_rep=na_rep, float_format=float_format,
                                     cols=columns, header=header, index=index,
                                     index_label=index_label, mode=mode,
                                     chunksize=chunksize, quotechar=quotechar,
                                     tupleize_cols=tupleize_cols,
                                     date_format=date_format,
                                     doublequote=doublequote,
                                     escapechar=escapechar, decimal=decimal)
        formatter.save()

        if path_or_buf is None:
            return formatter.path_or_buf.getvalue()

    @Appender(_shared_docs['to_excel'] % _shared_doc_kwargs)
    def to_excel(self, excel_writer, sheet_name='Sheet1', na_rep='',
                 float_format=None, columns=None, header=True, index=True,
                 index_label=None, startrow=0, startcol=0, engine=None,
                 merge_cells=True, encoding=None, inf_rep='inf', verbose=True,
                 freeze_panes=None):

        from pandas.io.formats.excel import ExcelFormatter
        formatter = ExcelFormatter(self, na_rep=na_rep, cols=columns,
                                   header=header,
                                   float_format=float_format, index=index,
                                   index_label=index_label,
                                   merge_cells=merge_cells,
                                   inf_rep=inf_rep)
        formatter.write(excel_writer, sheet_name=sheet_name, startrow=startrow,
                        startcol=startcol, freeze_panes=freeze_panes,
                        engine=engine)

    def to_stata(self, fname, convert_dates=None, write_index=True,
                 encoding="latin-1", byteorder=None, time_stamp=None,
                 data_label=None, variable_labels=None):
        """
        A class for writing Stata binary dta files from array-like objects

        Parameters
        ----------
        fname : str or buffer
            String path of file-like object
        convert_dates : dict
            Dictionary mapping columns containing datetime types to stata
            internal format to use when wirting the dates. Options are 'tc',
            'td', 'tm', 'tw', 'th', 'tq', 'ty'. Column can be either an integer
            or a name. Datetime columns that do not have a conversion type
            specified will be converted to 'tc'. Raises NotImplementedError if
            a datetime column has timezone information
        write_index : bool
            Write the index to Stata dataset.
        encoding : str
            Default is latin-1. Unicode is not supported
        byteorder : str
            Can be ">", "<", "little", or "big". default is `sys.byteorder`
        time_stamp : datetime
            A datetime to use as file creation date.  Default is the current
            time.
        dataset_label : str
            A label for the data set.  Must be 80 characters or smaller.
        variable_labels : dict
            Dictionary containing columns as keys and variable labels as
            values. Each label must be 80 characters or smaller.

            .. versionadded:: 0.19.0

        Raises
        ------
        NotImplementedError
            * If datetimes contain timezone information
            * Column dtype is not representable in Stata
        ValueError
            * Columns listed in convert_dates are noth either datetime64[ns]
              or datetime.datetime
            * Column listed in convert_dates is not in DataFrame
            * Categorical label contains more than 32,000 characters

            .. versionadded:: 0.19.0

        Examples
        --------
        >>> writer = StataWriter('./data_file.dta', data)
        >>> writer.write_file()

        Or with dates

        >>> writer = StataWriter('./date_data_file.dta', data, {2 : 'tw'})
        >>> writer.write_file()
        """
        from pandas.io.stata import StataWriter
        writer = StataWriter(fname, self, convert_dates=convert_dates,
                             encoding=encoding, byteorder=byteorder,
                             time_stamp=time_stamp, data_label=data_label,
                             write_index=write_index,
                             variable_labels=variable_labels)
        writer.write_file()

    def to_feather(self, fname):
        """
        write out the binary feather-format for DataFrames

        .. versionadded:: 0.20.0

        Parameters
        ----------
        fname : str
            string file path

        """
        from pandas.io.feather_format import to_feather
        to_feather(self, fname)

    @Substitution(header='Write out column names. If a list of string is given, \
it is assumed to be aliases for the column names')
    @Appender(fmt.docstring_to_string, indents=1)
    def to_string(self, buf=None, columns=None, col_space=None, header=True,
                  index=True, na_rep='NaN', formatters=None, float_format=None,
                  sparsify=None, index_names=True, justify=None,
                  line_width=None, max_rows=None, max_cols=None,
                  show_dimensions=False):
        """
        Render a DataFrame to a console-friendly tabular output.
        """

        formatter = fmt.DataFrameFormatter(self, buf=buf, columns=columns,
                                           col_space=col_space, na_rep=na_rep,
                                           formatters=formatters,
                                           float_format=float_format,
                                           sparsify=sparsify, justify=justify,
                                           index_names=index_names,
                                           header=header, index=index,
                                           line_width=line_width,
                                           max_rows=max_rows,
                                           max_cols=max_cols,
                                           show_dimensions=show_dimensions)
        formatter.to_string()

        if buf is None:
            result = formatter.buf.getvalue()
            return result

    @Substitution(header='whether to print column labels, default True')
    @Appender(fmt.docstring_to_string, indents=1)
    def to_html(self, buf=None, columns=None, col_space=None, header=True,
                index=True, na_rep='NaN', formatters=None, float_format=None,
                sparsify=None, index_names=True, justify=None, bold_rows=True,
                classes=None, escape=True, max_rows=None, max_cols=None,
                show_dimensions=False, notebook=False, decimal='.',
                border=None):
        """
        Render a DataFrame as an HTML table.

        `to_html`-specific options:

        bold_rows : boolean, default True
            Make the row labels bold in the output
        classes : str or list or tuple, default None
            CSS class(es) to apply to the resulting html table
        escape : boolean, default True
            Convert the characters <, >, and & to HTML-safe sequences.=
        max_rows : int, optional
            Maximum number of rows to show before truncating. If None, show
            all.
        max_cols : int, optional
            Maximum number of columns to show before truncating. If None, show
            all.
        decimal : string, default '.'
            Character recognized as decimal separator, e.g. ',' in Europe

            .. versionadded:: 0.18.0
        border : int
            A ``border=border`` attribute is included in the opening
            `<table>` tag. Default ``pd.options.html.border``.

            .. versionadded:: 0.19.0
        """

        formatter = fmt.DataFrameFormatter(self, buf=buf, columns=columns,
                                           col_space=col_space, na_rep=na_rep,
                                           formatters=formatters,
                                           float_format=float_format,
                                           sparsify=sparsify, justify=justify,
                                           index_names=index_names,
                                           header=header, index=index,
                                           bold_rows=bold_rows, escape=escape,
                                           max_rows=max_rows,
                                           max_cols=max_cols,
                                           show_dimensions=show_dimensions,
                                           decimal=decimal)
        # TODO: a generic formatter wld b in DataFrameFormatter
        formatter.to_html(classes=classes, notebook=notebook, border=border)

        if buf is None:
            return formatter.buf.getvalue()

    def info(self, verbose=None, buf=None, max_cols=None, memory_usage=None,
             null_counts=None):
        """
        Concise summary of a DataFrame.

        Parameters
        ----------
        verbose : {None, True, False}, optional
            Whether to print the full summary.
            None follows the `display.max_info_columns` setting.
            True or False overrides the `display.max_info_columns` setting.
        buf : writable buffer, defaults to sys.stdout
        max_cols : int, default None
            Determines whether full summary or short summary is printed.
            None follows the `display.max_info_columns` setting.
        memory_usage : boolean/string, default None
            Specifies whether total memory usage of the DataFrame
            elements (including index) should be displayed. None follows
            the `display.memory_usage` setting. True or False overrides
            the `display.memory_usage` setting. A value of 'deep' is equivalent
            of True, with deep introspection. Memory usage is shown in
            human-readable units (base-2 representation).
        null_counts : boolean, default None
            Whether to show the non-null counts

            - If None, then only show if the frame is smaller than
              max_info_rows and max_info_columns.
            - If True, always show counts.
            - If False, never show counts.

        """
        from pandas.io.formats.format import _put_lines

        if buf is None:  # pragma: no cover
            buf = sys.stdout

        lines = []

        lines.append(str(type(self)))
        lines.append(self.index.summary())

        if len(self.columns) == 0:
            lines.append('Empty %s' % type(self).__name__)
            _put_lines(buf, lines)
            return

        cols = self.columns

        # hack
        if max_cols is None:
            max_cols = get_option('display.max_info_columns',
                                  len(self.columns) + 1)

        max_rows = get_option('display.max_info_rows', len(self) + 1)

        if null_counts is None:
            show_counts = ((len(self.columns) <= max_cols) and
                           (len(self) < max_rows))
        else:
            show_counts = null_counts
        exceeds_info_cols = len(self.columns) > max_cols

        def _verbose_repr():
            lines.append('Data columns (total %d columns):' %
                         len(self.columns))
            space = max([len(pprint_thing(k)) for k in self.columns]) + 4
            counts = None

            tmpl = "%s%s"
            if show_counts:
                counts = self.count()
                if len(cols) != len(counts):  # pragma: no cover
                    raise AssertionError('Columns must equal counts (%d != %d)'
                                         % (len(cols), len(counts)))
                tmpl = "%s non-null %s"

            dtypes = self.dtypes
            for i, col in enumerate(self.columns):
                dtype = dtypes.iloc[i]
                col = pprint_thing(col)

                count = ""
                if show_counts:
                    count = counts.iloc[i]

                lines.append(_put_str(col, space) + tmpl % (count, dtype))

        def _non_verbose_repr():
            lines.append(self.columns.summary(name='Columns'))

        def _sizeof_fmt(num, size_qualifier):
            # returns size in human readable format
            for x in ['bytes', 'KB', 'MB', 'GB', 'TB']:
                if num < 1024.0:
                    return "%3.1f%s %s" % (num, size_qualifier, x)
                num /= 1024.0
            return "%3.1f%s %s" % (num, size_qualifier, 'PB')

        if verbose:
            _verbose_repr()
        elif verbose is False:  # specifically set to False, not nesc None
            _non_verbose_repr()
        else:
            if exceeds_info_cols:
                _non_verbose_repr()
            else:
                _verbose_repr()

        counts = self.get_dtype_counts()
        dtypes = ['%s(%d)' % k for k in sorted(compat.iteritems(counts))]
        lines.append('dtypes: %s' % ', '.join(dtypes))

        if memory_usage is None:
            memory_usage = get_option('display.memory_usage')
        if memory_usage:
            # append memory usage of df to display
            size_qualifier = ''
            if memory_usage == 'deep':
                deep = True
            else:
                # size_qualifier is just a best effort; not guaranteed to catch
                # all cases (e.g., it misses categorical data even with object
                # categories)
                deep = False
                if ('object' in counts or
                        self.index._is_memory_usage_qualified()):
                    size_qualifier = '+'
            mem_usage = self.memory_usage(index=True, deep=deep).sum()
            lines.append("memory usage: %s\n" %
                         _sizeof_fmt(mem_usage, size_qualifier))
        _put_lines(buf, lines)

    def memory_usage(self, index=True, deep=False):
        """Memory usage of DataFrame columns.

        Parameters
        ----------
        index : bool
            Specifies whether to include memory usage of DataFrame's
            index in returned Series. If `index=True` (default is False)
            the first index of the Series is `Index`.
        deep : bool
            Introspect the data deeply, interrogate
            `object` dtypes for system-level memory consumption

        Returns
        -------
        sizes : Series
            A series with column names as index and memory usage of
            columns with units of bytes.

        Notes
        -----
        Memory usage does not include memory consumed by elements that
        are not components of the array if deep=False

        See Also
        --------
        numpy.ndarray.nbytes
        """
        result = Series([c.memory_usage(index=False, deep=deep)
                         for col, c in self.iteritems()], index=self.columns)
        if index:
            result = Series(self.index.memory_usage(deep=deep),
                            index=['Index']).append(result)
        return result

    def transpose(self, *args, **kwargs):
        """Transpose index and columns"""
        nv.validate_transpose(args, dict())
        return super(DataFrame, self).transpose(1, 0, **kwargs)

    T = property(transpose)

    # ----------------------------------------------------------------------
    # Picklability

    # legacy pickle formats
    def _unpickle_frame_compat(self, state):  # pragma: no cover
        from pandas.core.common import _unpickle_array
        if len(state) == 2:  # pragma: no cover
            series, idx = state
            columns = sorted(series)
        else:
            series, cols, idx = state
            columns = _unpickle_array(cols)

        index = _unpickle_array(idx)
        self._data = self._init_dict(series, index, columns, None)

    def _unpickle_matrix_compat(self, state):  # pragma: no cover
        from pandas.core.common import _unpickle_array
        # old unpickling
        (vals, idx, cols), object_state = state

        index = _unpickle_array(idx)
        dm = DataFrame(vals, index=index, columns=_unpickle_array(cols),
                       copy=False)

        if object_state is not None:
            ovals, _, ocols = object_state
            objects = DataFrame(ovals, index=index,
                                columns=_unpickle_array(ocols), copy=False)

            dm = dm.join(objects)

        self._data = dm._data

    # ----------------------------------------------------------------------
    # Getting and setting elements

    def get_value(self, index, col, takeable=False):
        """
        Quickly retrieve single value at passed column and index

        Parameters
        ----------
        index : row label
        col : column label
        takeable : interpret the index/col as indexers, default False

        Returns
        -------
        value : scalar value
        """

        if takeable:
            series = self._iget_item_cache(col)
            return _maybe_box_datetimelike(series._values[index])

        series = self._get_item_cache(col)
        engine = self.index._engine

        try:
            return engine.get_value(series._values, index)
        except TypeError:

            # we cannot handle direct indexing
            # use positional
            col = self.columns.get_loc(col)
            index = self.index.get_loc(index)
            return self.get_value(index, col, takeable=True)

    def set_value(self, index, col, value, takeable=False):
        """
        Put single value at passed column and index

        Parameters
        ----------
        index : row label
        col : column label
        value : scalar value
        takeable : interpret the index/col as indexers, default False

        Returns
        -------
        frame : DataFrame
            If label pair is contained, will be reference to calling DataFrame,
            otherwise a new object
        """
        try:
            if takeable is True:
                series = self._iget_item_cache(col)
                return series.set_value(index, value, takeable=True)

            series = self._get_item_cache(col)
            engine = self.index._engine
            engine.set_value(series._values, index, value)
            return self
        except (KeyError, TypeError):

            # set using a non-recursive method & reset the cache
            self.loc[index, col] = value
            self._item_cache.pop(col, None)

            return self

    def _ixs(self, i, axis=0):
        """
        i : int, slice, or sequence of integers
        axis : int
        """

        # irow
        if axis == 0:
            """
            Notes
            -----
            If slice passed, the resulting data will be a view
            """

            if isinstance(i, slice):
                return self[i]
            else:
                label = self.index[i]
                if isinstance(label, Index):
                    # a location index by definition
                    result = self.take(i, axis=axis)
                    copy = True
                else:
                    new_values = self._data.fast_xs(i)
                    if is_scalar(new_values):
                        return new_values

                    # if we are a copy, mark as such
                    copy = (isinstance(new_values, np.ndarray) and
                            new_values.base is None)
                    result = self._constructor_sliced(new_values,
                                                      index=self.columns,
                                                      name=self.index[i],
                                                      dtype=new_values.dtype)
                result._set_is_copy(self, copy=copy)
                return result

        # icol
        else:
            """
            Notes
            -----
            If slice passed, the resulting data will be a view
            """

            label = self.columns[i]
            if isinstance(i, slice):
                # need to return view
                lab_slice = slice(label[0], label[-1])
                return self.loc[:, lab_slice]
            else:
                if isinstance(label, Index):
                    return self.take(i, axis=1, convert=True)

                index_len = len(self.index)

                # if the values returned are not the same length
                # as the index (iow a not found value), iget returns
                # a 0-len ndarray. This is effectively catching
                # a numpy error (as numpy should really raise)
                values = self._data.iget(i)

                if index_len and not len(values):
                    values = np.array([np.nan] * index_len, dtype=object)
                result = self._constructor_sliced.from_array(values,
                                                             index=self.index,
                                                             name=label,
                                                             fastpath=True)

                # this is a cached value, mark it so
                result._set_as_cached(label, self)

                return result

    def __getitem__(self, key):
        key = com._apply_if_callable(key, self)

        # shortcut if we are an actual column
        is_mi_columns = isinstance(self.columns, MultiIndex)
        try:
            if key in self.columns and not is_mi_columns:
                return self._getitem_column(key)
        except:
            pass

        # see if we can slice the rows
        indexer = convert_to_index_sliceable(self, key)
        if indexer is not None:
            return self._getitem_slice(indexer)

        if isinstance(key, (Series, np.ndarray, Index, list)):
            # either boolean or fancy integer index
            return self._getitem_array(key)
        elif isinstance(key, DataFrame):
            return self._getitem_frame(key)
        elif is_mi_columns:
            return self._getitem_multilevel(key)
        else:
            return self._getitem_column(key)

    def _getitem_column(self, key):
        """ return the actual column """

        # get column
        if self.columns.is_unique:
            return self._get_item_cache(key)

        # duplicate columns & possible reduce dimensionality
        result = self._constructor(self._data.get(key))
        if result.columns.is_unique:
            result = result[key]

        return result

    def _getitem_slice(self, key):
        return self._slice(key, axis=0)

    def _getitem_array(self, key):
        # also raises Exception if object array with NA values
        if com.is_bool_indexer(key):
            # warning here just in case -- previously __setitem__ was
            # reindexing but __getitem__ was not; it seems more reasonable to
            # go with the __setitem__ behavior since that is more consistent
            # with all other indexing behavior
            if isinstance(key, Series) and not key.index.equals(self.index):
                warnings.warn("Boolean Series key will be reindexed to match "
                              "DataFrame index.", UserWarning, stacklevel=3)
            elif len(key) != len(self.index):
                raise ValueError('Item wrong length %d instead of %d.' %
                                 (len(key), len(self.index)))
            # check_bool_indexer will throw exception if Series key cannot
            # be reindexed to match DataFrame rows
            key = check_bool_indexer(self.index, key)
            indexer = key.nonzero()[0]
            return self.take(indexer, axis=0, convert=False)
        else:
            indexer = self.loc._convert_to_indexer(key, axis=1)
            return self.take(indexer, axis=1, convert=True)

    def _getitem_multilevel(self, key):
        loc = self.columns.get_loc(key)
        if isinstance(loc, (slice, Series, np.ndarray, Index)):
            new_columns = self.columns[loc]
            result_columns = maybe_droplevels(new_columns, key)
            if self._is_mixed_type:
                result = self.reindex(columns=new_columns)
                result.columns = result_columns
            else:
                new_values = self.values[:, loc]
                result = self._constructor(new_values, index=self.index,
                                           columns=result_columns)
                result = result.__finalize__(self)
            if len(result.columns) == 1:
                top = result.columns[0]
                if ((type(top) == str and top == '') or
                        (type(top) == tuple and top[0] == '')):
                    result = result['']
                    if isinstance(result, Series):
                        result = self._constructor_sliced(result,
                                                          index=self.index,
                                                          name=key)

            result._set_is_copy(self)
            return result
        else:
            return self._get_item_cache(key)

    def _getitem_frame(self, key):
        if key.values.size and not is_bool_dtype(key.values):
            raise ValueError('Must pass DataFrame with boolean values only')
        return self.where(key)

    def query(self, expr, inplace=False, **kwargs):
        """Query the columns of a frame with a boolean expression.

        .. versionadded:: 0.13

        Parameters
        ----------
        expr : string
            The query string to evaluate.  You can refer to variables
            in the environment by prefixing them with an '@' character like
            ``@a + b``.
        inplace : bool
            Whether the query should modify the data in place or return
            a modified copy

            .. versionadded:: 0.18.0

        kwargs : dict
            See the documentation for :func:`pandas.eval` for complete details
            on the keyword arguments accepted by :meth:`DataFrame.query`.

        Returns
        -------
        q : DataFrame

        Notes
        -----
        The result of the evaluation of this expression is first passed to
        :attr:`DataFrame.loc` and if that fails because of a
        multidimensional key (e.g., a DataFrame) then the result will be passed
        to :meth:`DataFrame.__getitem__`.

        This method uses the top-level :func:`pandas.eval` function to
        evaluate the passed query.

        The :meth:`~pandas.DataFrame.query` method uses a slightly
        modified Python syntax by default. For example, the ``&`` and ``|``
        (bitwise) operators have the precedence of their boolean cousins,
        :keyword:`and` and :keyword:`or`. This *is* syntactically valid Python,
        however the semantics are different.

        You can change the semantics of the expression by passing the keyword
        argument ``parser='python'``. This enforces the same semantics as
        evaluation in Python space. Likewise, you can pass ``engine='python'``
        to evaluate an expression using Python itself as a backend. This is not
        recommended as it is inefficient compared to using ``numexpr`` as the
        engine.

        The :attr:`DataFrame.index` and
        :attr:`DataFrame.columns` attributes of the
        :class:`~pandas.DataFrame` instance are placed in the query namespace
        by default, which allows you to treat both the index and columns of the
        frame as a column in the frame.
        The identifier ``index`` is used for the frame index; you can also
        use the name of the index to identify it in a query.

        For further details and examples see the ``query`` documentation in
        :ref:`indexing <indexing.query>`.

        See Also
        --------
        pandas.eval
        DataFrame.eval

        Examples
        --------
        >>> from numpy.random import randn
        >>> from pandas import DataFrame
        >>> df = DataFrame(randn(10, 2), columns=list('ab'))
        >>> df.query('a > b')
        >>> df[df.a > df.b]  # same result as the previous expression
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if not isinstance(expr, compat.string_types):
            msg = "expr must be a string to be evaluated, {0} given"
            raise ValueError(msg.format(type(expr)))
        kwargs['level'] = kwargs.pop('level', 0) + 1
        kwargs['target'] = None
        res = self.eval(expr, **kwargs)

        try:
            new_data = self.loc[res]
        except ValueError:
            # when res is multi-dimensional loc raises, but this is sometimes a
            # valid query
            new_data = self[res]

        if inplace:
            self._update_inplace(new_data)
        else:
            return new_data

    def eval(self, expr, inplace=None, **kwargs):
        """Evaluate an expression in the context of the calling DataFrame
        instance.

        Parameters
        ----------
        expr : string
            The expression string to evaluate.
        inplace : bool
            If the expression contains an assignment, whether to return a new
            DataFrame or mutate the existing.

            WARNING: inplace=None currently falls back to to True, but
            in a future version, will default to False.  Use inplace=True
            explicitly rather than relying on the default.

            .. versionadded:: 0.18.0

        kwargs : dict
            See the documentation for :func:`~pandas.eval` for complete details
            on the keyword arguments accepted by
            :meth:`~pandas.DataFrame.query`.

        Returns
        -------
        ret : ndarray, scalar, or pandas object

        See Also
        --------
        pandas.DataFrame.query
        pandas.DataFrame.assign
        pandas.eval

        Notes
        -----
        For more details see the API documentation for :func:`~pandas.eval`.
        For detailed examples see :ref:`enhancing performance with eval
        <enhancingperf.eval>`.

        Examples
        --------
        >>> from numpy.random import randn
        >>> from pandas import DataFrame
        >>> df = DataFrame(randn(10, 2), columns=list('ab'))
        >>> df.eval('a + b')
        >>> df.eval('c = a + b')
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        resolvers = kwargs.pop('resolvers', None)
        kwargs['level'] = kwargs.pop('level', 0) + 1
        if resolvers is None:
            index_resolvers = self._get_index_resolvers()
            resolvers = dict(self.iteritems()), index_resolvers
        if 'target' not in kwargs:
            kwargs['target'] = self
        kwargs['resolvers'] = kwargs.get('resolvers', ()) + tuple(resolvers)
        return _eval(expr, inplace=inplace, **kwargs)

    def select_dtypes(self, include=None, exclude=None):
        """Return a subset of a DataFrame including/excluding columns based on
        their ``dtype``.

        Parameters
        ----------
        include, exclude : list-like
            A list of dtypes or strings to be included/excluded. You must pass
            in a non-empty sequence for at least one of these.

        Raises
        ------
        ValueError
            * If both of ``include`` and ``exclude`` are empty
            * If ``include`` and ``exclude`` have overlapping elements
            * If any kind of string dtype is passed in.
        TypeError
            * If either of ``include`` or ``exclude`` is not a sequence

        Returns
        -------
        subset : DataFrame
            The subset of the frame including the dtypes in ``include`` and
            excluding the dtypes in ``exclude``.

        Notes
        -----
        * To select all *numeric* types use the numpy dtype ``numpy.number``
        * To select strings you must use the ``object`` dtype, but note that
          this will return *all* object dtype columns
        * See the `numpy dtype hierarchy
          <http://docs.scipy.org/doc/numpy/reference/arrays.scalars.html>`__
        * To select datetimes, use np.datetime64, 'datetime' or 'datetime64'
        * To select timedeltas, use np.timedelta64, 'timedelta' or
          'timedelta64'
        * To select Pandas categorical dtypes, use 'category'
        * To select Pandas datetimetz dtypes, use 'datetimetz' (new in 0.20.0),
          or a 'datetime64[ns, tz]' string

        Examples
        --------
        >>> df = pd.DataFrame({'a': np.random.randn(6).astype('f4'),
        ...                    'b': [True, False] * 3,
        ...                    'c': [1.0, 2.0] * 3})
        >>> df
                a      b  c
        0  0.3962   True  1
        1  0.1459  False  2
        2  0.2623   True  1
        3  0.0764  False  2
        4 -0.9703   True  1
        5 -1.2094  False  2
        >>> df.select_dtypes(include=['float64'])
           c
        0  1
        1  2
        2  1
        3  2
        4  1
        5  2
        >>> df.select_dtypes(exclude=['floating'])
               b
        0   True
        1  False
        2   True
        3  False
        4   True
        5  False
        """
        include, exclude = include or (), exclude or ()
        if not (is_list_like(include) and is_list_like(exclude)):
            raise TypeError('include and exclude must both be non-string'
                            ' sequences')
        selection = tuple(map(frozenset, (include, exclude)))

        if not any(selection):
            raise ValueError('at least one of include or exclude must be '
                             'nonempty')

        # convert the myriad valid dtypes object to a single representation
        include, exclude = map(
            lambda x: frozenset(map(_get_dtype_from_object, x)), selection)
        for dtypes in (include, exclude):
            invalidate_string_dtypes(dtypes)

        # can't both include AND exclude!
        if not include.isdisjoint(exclude):
            raise ValueError('include and exclude overlap on %s' %
                             (include & exclude))

        # empty include/exclude -> defaults to True
        # three cases (we've already raised if both are empty)
        # case 1: empty include, nonempty exclude
        # we have True, True, ... True for include, same for exclude
        # in the loop below we get the excluded
        # and when we call '&' below we get only the excluded
        # case 2: nonempty include, empty exclude
        # same as case 1, but with include
        # case 3: both nonempty
        # the "union" of the logic of case 1 and case 2:
        # we get the included and excluded, and return their logical and
        include_these = Series(not bool(include), index=self.columns)
        exclude_these = Series(not bool(exclude), index=self.columns)

        def is_dtype_instance_mapper(column, dtype):
            return column, functools.partial(issubclass, dtype.type)

        for column, f in itertools.starmap(is_dtype_instance_mapper,
                                           self.dtypes.iteritems()):
            if include:  # checks for the case of empty include or exclude
                include_these[column] = any(map(f, include))
            if exclude:
                exclude_these[column] = not any(map(f, exclude))

        dtype_indexer = include_these & exclude_these
        return self.loc[com._get_info_slice(self, dtype_indexer)]

    def _box_item_values(self, key, values):
        items = self.columns[self.columns.get_loc(key)]
        if values.ndim == 2:
            return self._constructor(values.T, columns=items, index=self.index)
        else:
            return self._box_col_values(values, items)

    def _box_col_values(self, values, items):
        """ provide boxed values for a column """
        return self._constructor_sliced.from_array(values, index=self.index,
                                                   name=items, fastpath=True)

    def __setitem__(self, key, value):
        key = com._apply_if_callable(key, self)

        # see if we can slice the rows
        indexer = convert_to_index_sliceable(self, key)
        if indexer is not None:
            return self._setitem_slice(indexer, value)

        if isinstance(key, (Series, np.ndarray, list, Index)):
            self._setitem_array(key, value)
        elif isinstance(key, DataFrame):
            self._setitem_frame(key, value)
        else:
            # set column
            self._set_item(key, value)

    def _setitem_slice(self, key, value):
        self._check_setitem_copy()
        self.loc._setitem_with_indexer(key, value)

    def _setitem_array(self, key, value):
        # also raises Exception if object array with NA values
        if com.is_bool_indexer(key):
            if len(key) != len(self.index):
                raise ValueError('Item wrong length %d instead of %d!' %
                                 (len(key), len(self.index)))
            key = check_bool_indexer(self.index, key)
            indexer = key.nonzero()[0]
            self._check_setitem_copy()
            self.loc._setitem_with_indexer(indexer, value)
        else:
            if isinstance(value, DataFrame):
                if len(value.columns) != len(key):
                    raise ValueError('Columns must be same length as key')
                for k1, k2 in zip(key, value.columns):
                    self[k1] = value[k2]
            else:
                indexer = self.loc._convert_to_indexer(key, axis=1)
                self._check_setitem_copy()
                self.loc._setitem_with_indexer((slice(None), indexer), value)

    def _setitem_frame(self, key, value):
        # support boolean setting with DataFrame input, e.g.
        # df[df > df2] = 0
        if key.values.size and not is_bool_dtype(key.values):
            raise TypeError('Must pass DataFrame with boolean values only')

        self._check_inplace_setting(value)
        self._check_setitem_copy()
        self._where(-key, value, inplace=True)

    def _ensure_valid_index(self, value):
        """
        ensure that if we don't have an index, that we can create one from the
        passed value
        """
        # GH5632, make sure that we are a Series convertible
        if not len(self.index) and is_list_like(value):
            try:
                value = Series(value)
            except:
                raise ValueError('Cannot set a frame with no defined index '
                                 'and a value that cannot be converted to a '
                                 'Series')

            self._data = self._data.reindex_axis(value.index.copy(), axis=1,
                                                 fill_value=np.nan)

    def _set_item(self, key, value):
        """
        Add series to DataFrame in specified column.

        If series is a numpy-array (not a Series/TimeSeries), it must be the
        same length as the DataFrames index or an error will be thrown.

        Series/TimeSeries will be conformed to the DataFrames index to
        ensure homogeneity.
        """

        self._ensure_valid_index(value)
        value = self._sanitize_column(key, value)
        NDFrame._set_item(self, key, value)

        # check if we are modifying a copy
        # try to set first as we want an invalid
        # value exception to occur first
        if len(self):
            self._check_setitem_copy()

    def insert(self, loc, column, value, allow_duplicates=False):
        """
        Insert column into DataFrame at specified location.

        If `allow_duplicates` is False, raises Exception if column
        is already contained in the DataFrame.

        Parameters
        ----------
        loc : int
            Must have 0 <= loc <= len(columns)
        column : object
        value : scalar, Series, or array-like
        """
        self._ensure_valid_index(value)
        value = self._sanitize_column(column, value, broadcast=False)
        self._data.insert(loc, column, value,
                          allow_duplicates=allow_duplicates)

    def assign(self, **kwargs):
        """
        Assign new columns to a DataFrame, returning a new object
        (a copy) with all the original columns in addition to the new ones.

        .. versionadded:: 0.16.0

        Parameters
        ----------
        kwargs : keyword, value pairs
            keywords are the column names. If the values are
            callable, they are computed on the DataFrame and
            assigned to the new columns. The callable must not
            change input DataFrame (though pandas doesn't check it).
            If the values are not callable, (e.g. a Series, scalar, or array),
            they are simply assigned.

        Returns
        -------
        df : DataFrame
            A new DataFrame with the new columns in addition to
            all the existing columns.

        Notes
        -----
        Since ``kwargs`` is a dictionary, the order of your
        arguments may not be preserved. To make things predicatable,
        the columns are inserted in alphabetical order, at the end of
        your DataFrame. Assigning multiple columns within the same
        ``assign`` is possible, but you cannot reference other columns
        created within the same ``assign`` call.

        Examples
        --------
        >>> df = DataFrame({'A': range(1, 11), 'B': np.random.randn(10)})

        Where the value is a callable, evaluated on `df`:

        >>> df.assign(ln_A = lambda x: np.log(x.A))
            A         B      ln_A
        0   1  0.426905  0.000000
        1   2 -0.780949  0.693147
        2   3 -0.418711  1.098612
        3   4 -0.269708  1.386294
        4   5 -0.274002  1.609438
        5   6 -0.500792  1.791759
        6   7  1.649697  1.945910
        7   8 -1.495604  2.079442
        8   9  0.549296  2.197225
        9  10 -0.758542  2.302585

        Where the value already exists and is inserted:

        >>> newcol = np.log(df['A'])
        >>> df.assign(ln_A=newcol)
            A         B      ln_A
        0   1  0.426905  0.000000
        1   2 -0.780949  0.693147
        2   3 -0.418711  1.098612
        3   4 -0.269708  1.386294
        4   5 -0.274002  1.609438
        5   6 -0.500792  1.791759
        6   7  1.649697  1.945910
        7   8 -1.495604  2.079442
        8   9  0.549296  2.197225
        9  10 -0.758542  2.302585
        """
        data = self.copy()

        # do all calculations first...
        results = {}
        for k, v in kwargs.items():
            results[k] = com._apply_if_callable(v, data)

        # ... and then assign
        for k, v in sorted(results.items()):
            data[k] = v

        return data

    def _sanitize_column(self, key, value, broadcast=True):
        """
        Ensures new columns (which go into the BlockManager as new blocks) are
        always copied and converted into an array.

        Parameters
        ----------
        key : object
        value : scalar, Series, or array-like
        broadcast : bool, default True
            If ``key`` matches multiple duplicate column names in the
            DataFrame, this parameter indicates whether ``value`` should be
            tiled so that the returned array contains a (duplicated) column for
            each occurrence of the key. If False, ``value`` will not be tiled.

        Returns
        -------
        sanitized_column : numpy-array
        """

        def reindexer(value):
            # reindex if necessary

            if value.index.equals(self.index) or not len(self.index):
                value = value._values.copy()
            else:

                # GH 4107
                try:
                    value = value.reindex(self.index)._values
                except Exception as e:

                    # duplicate axis
                    if not value.index.is_unique:
                        raise e

                    # other
                    raise TypeError('incompatible index of inserted column '
                                    'with frame index')
            return value

        if isinstance(value, Series):
            value = reindexer(value)

        elif isinstance(value, DataFrame):
            # align right-hand-side columns if self.columns
            # is multi-index and self[key] is a sub-frame
            if isinstance(self.columns, MultiIndex) and key in self.columns:
                loc = self.columns.get_loc(key)
                if isinstance(loc, (slice, Series, np.ndarray, Index)):
                    cols = maybe_droplevels(self.columns[loc], key)
                    if len(cols) and not cols.equals(value.columns):
                        value = value.reindex_axis(cols, axis=1)
            # now align rows
            value = reindexer(value).T

        elif isinstance(value, Categorical):
            value = value.copy()

        elif isinstance(value, Index) or is_sequence(value):
            from pandas.core.series import _sanitize_index

            # turn me into an ndarray
            value = _sanitize_index(value, self.index, copy=False)
            if not isinstance(value, (np.ndarray, Index)):
                if isinstance(value, list) and len(value) > 0:
                    value = maybe_convert_platform(value)
                else:
                    value = com._asarray_tuplesafe(value)
            elif value.ndim == 2:
                value = value.copy().T
            elif isinstance(value, Index):
                value = value.copy(deep=True)
            else:
                value = value.copy()

            # possibly infer to datetimelike
            if is_object_dtype(value.dtype):
                value = maybe_infer_to_datetimelike(value)

        else:
            # upcast the scalar
            dtype, value = infer_dtype_from_scalar(value)
            value = np.repeat(value, len(self.index)).astype(dtype)
            value = maybe_cast_to_datetime(value, dtype)

        # return internal types directly
        if is_extension_type(value):
            return value

        # broadcast across multiple columns if necessary
        if broadcast and key in self.columns and value.ndim == 1:
            if (not self.columns.is_unique or
                    isinstance(self.columns, MultiIndex)):
                existing_piece = self[key]
                if isinstance(existing_piece, DataFrame):
                    value = np.tile(value, (len(existing_piece.columns), 1))

        return np.atleast_2d(np.asarray(value))

    @property
    def _series(self):
        result = {}
        for idx, item in enumerate(self.columns):
            result[item] = Series(self._data.iget(idx), index=self.index,
                                  name=item)
        return result

    def lookup(self, row_labels, col_labels):
        """Label-based "fancy indexing" function for DataFrame.
        Given equal-length arrays of row and column labels, return an
        array of the values corresponding to each (row, col) pair.

        Parameters
        ----------
        row_labels : sequence
            The row labels to use for lookup
        col_labels : sequence
            The column labels to use for lookup

        Notes
        -----
        Akin to::

            result = []
            for row, col in zip(row_labels, col_labels):
                result.append(df.get_value(row, col))

        Examples
        --------
        values : ndarray
            The found values

        """
        n = len(row_labels)
        if n != len(col_labels):
            raise ValueError('Row labels must have same size as column labels')

        thresh = 1000
        if not self._is_mixed_type or n > thresh:
            values = self.values
            ridx = self.index.get_indexer(row_labels)
            cidx = self.columns.get_indexer(col_labels)
            if (ridx == -1).any():
                raise KeyError('One or more row labels was not found')
            if (cidx == -1).any():
                raise KeyError('One or more column labels was not found')
            flat_index = ridx * len(self.columns) + cidx
            result = values.flat[flat_index]
        else:
            result = np.empty(n, dtype='O')
            for i, (r, c) in enumerate(zip(row_labels, col_labels)):
                result[i] = self.get_value(r, c)

        if is_object_dtype(result):
            result = lib.maybe_convert_objects(result)

        return result

    # ----------------------------------------------------------------------
    # Reindexing and alignment

    def _reindex_axes(self, axes, level, limit, tolerance, method, fill_value,
                      copy):
        frame = self

        columns = axes['columns']
        if columns is not None:
            frame = frame._reindex_columns(columns, method, copy, level,
                                           fill_value, limit, tolerance)

        index = axes['index']
        if index is not None:
            frame = frame._reindex_index(index, method, copy, level,
                                         fill_value, limit, tolerance)

        return frame

    def _reindex_index(self, new_index, method, copy, level, fill_value=NA,
                       limit=None, tolerance=None):
        new_index, indexer = self.index.reindex(new_index, method=method,
                                                level=level, limit=limit,
                                                tolerance=tolerance)
        return self._reindex_with_indexers({0: [new_index, indexer]},
                                           copy=copy, fill_value=fill_value,
                                           allow_dups=False)

    def _reindex_columns(self, new_columns, method, copy, level, fill_value=NA,
                         limit=None, tolerance=None):
        new_columns, indexer = self.columns.reindex(new_columns, method=method,
                                                    level=level, limit=limit,
                                                    tolerance=tolerance)
        return self._reindex_with_indexers({1: [new_columns, indexer]},
                                           copy=copy, fill_value=fill_value,
                                           allow_dups=False)

    def _reindex_multi(self, axes, copy, fill_value):
        """ we are guaranteed non-Nones in the axes! """

        new_index, row_indexer = self.index.reindex(axes['index'])
        new_columns, col_indexer = self.columns.reindex(axes['columns'])

        if row_indexer is not None and col_indexer is not None:
            indexer = row_indexer, col_indexer
            new_values = algorithms.take_2d_multi(self.values, indexer,
                                                  fill_value=fill_value)
            return self._constructor(new_values, index=new_index,
                                     columns=new_columns)
        else:
            return self._reindex_with_indexers({0: [new_index, row_indexer],
                                                1: [new_columns, col_indexer]},
                                               copy=copy,
                                               fill_value=fill_value)

    @Appender(_shared_docs['align'] % _shared_doc_kwargs)
    def align(self, other, join='outer', axis=None, level=None, copy=True,
              fill_value=None, method=None, limit=None, fill_axis=0,
              broadcast_axis=None):
        return super(DataFrame, self).align(other, join=join, axis=axis,
                                            level=level, copy=copy,
                                            fill_value=fill_value,
                                            method=method, limit=limit,
                                            fill_axis=fill_axis,
                                            broadcast_axis=broadcast_axis)

    @Appender(_shared_docs['reindex'] % _shared_doc_kwargs)
    def reindex(self, index=None, columns=None, **kwargs):
        return super(DataFrame, self).reindex(index=index, columns=columns,
                                              **kwargs)

    @Appender(_shared_docs['reindex_axis'] % _shared_doc_kwargs)
    def reindex_axis(self, labels, axis=0, method=None, level=None, copy=True,
                     limit=None, fill_value=np.nan):
        return super(DataFrame,
                     self).reindex_axis(labels=labels, axis=axis,
                                        method=method, level=level, copy=copy,
                                        limit=limit, fill_value=fill_value)

    @Appender(_shared_docs['rename'] % _shared_doc_kwargs)
    def rename(self, index=None, columns=None, **kwargs):
        return super(DataFrame, self).rename(index=index, columns=columns,
                                             **kwargs)

    @Appender(_shared_docs['fillna'] % _shared_doc_kwargs)
    def fillna(self, value=None, method=None, axis=None, inplace=False,
               limit=None, downcast=None, **kwargs):
        return super(DataFrame,
                     self).fillna(value=value, method=method, axis=axis,
                                  inplace=inplace, limit=limit,
                                  downcast=downcast, **kwargs)

    @Appender(_shared_docs['shift'] % _shared_doc_kwargs)
    def shift(self, periods=1, freq=None, axis=0):
        return super(DataFrame, self).shift(periods=periods, freq=freq,
                                            axis=axis)

    def set_index(self, keys, drop=True, append=False, inplace=False,
                  verify_integrity=False):
        """
        Set the DataFrame index (row labels) using one or more existing
        columns. By default yields a new object.

        Parameters
        ----------
        keys : column label or list of column labels / arrays
        drop : boolean, default True
            Delete columns to be used as the new index
        append : boolean, default False
            Whether to append columns to existing index
        inplace : boolean, default False
            Modify the DataFrame in place (do not create a new object)
        verify_integrity : boolean, default False
            Check the new index for duplicates. Otherwise defer the check until
            necessary. Setting to False will improve the performance of this
            method

        Examples
        --------
        >>> indexed_df = df.set_index(['A', 'B'])
        >>> indexed_df2 = df.set_index(['A', [0, 1, 2, 0, 1, 2]])
        >>> indexed_df3 = df.set_index([[0, 1, 2, 0, 1, 2]])

        Returns
        -------
        dataframe : DataFrame
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if not isinstance(keys, list):
            keys = [keys]

        if inplace:
            frame = self
        else:
            frame = self.copy()

        arrays = []
        names = []
        if append:
            names = [x for x in self.index.names]
            if isinstance(self.index, MultiIndex):
                for i in range(self.index.nlevels):
                    arrays.append(self.index._get_level_values(i))
            else:
                arrays.append(self.index)

        to_remove = []
        for col in keys:
            if isinstance(col, MultiIndex):
                # append all but the last column so we don't have to modify
                # the end of this loop
                for n in range(col.nlevels - 1):
                    arrays.append(col._get_level_values(n))

                level = col._get_level_values(col.nlevels - 1)
                names.extend(col.names)
            elif isinstance(col, Series):
                level = col._values
                names.append(col.name)
            elif isinstance(col, Index):
                level = col
                names.append(col.name)
            elif isinstance(col, (list, np.ndarray, Index)):
                level = col
                names.append(None)
            else:
                level = frame[col]._values
                names.append(col)
                if drop:
                    to_remove.append(col)
            arrays.append(level)

        index = MultiIndex.from_arrays(arrays, names=names)

        if verify_integrity and not index.is_unique:
            duplicates = index.get_duplicates()
            raise ValueError('Index has duplicate keys: %s' % duplicates)

        for c in to_remove:
            del frame[c]

        # clear up memory usage
        index._cleanup()

        frame.index = index

        if not inplace:
            return frame

    def reset_index(self, level=None, drop=False, inplace=False, col_level=0,
                    col_fill=''):
        """
        For DataFrame with multi-level index, return new DataFrame with
        labeling information in the columns under the index names, defaulting
        to 'level_0', 'level_1', etc. if any are None. For a standard index,
        the index name will be used (if set), otherwise a default 'index' or
        'level_0' (if 'index' is already taken) will be used.

        Parameters
        ----------
        level : int, str, tuple, or list, default None
            Only remove the given levels from the index. Removes all levels by
            default
        drop : boolean, default False
            Do not try to insert index into dataframe columns. This resets
            the index to the default integer index.
        inplace : boolean, default False
            Modify the DataFrame in place (do not create a new object)
        col_level : int or str, default 0
            If the columns have multiple levels, determines which level the
            labels are inserted into. By default it is inserted into the first
            level.
        col_fill : object, default ''
            If the columns have multiple levels, determines how the other
            levels are named. If None then the index name is repeated.

        Returns
        -------
        resetted : DataFrame
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if inplace:
            new_obj = self
        else:
            new_obj = self.copy()

        def _maybe_casted_values(index, labels=None):
            if isinstance(index, PeriodIndex):
                values = index.asobject.values
            elif isinstance(index, DatetimeIndex) and index.tz is not None:
                values = index
            else:
                values = index.values
                if values.dtype == np.object_:
                    values = lib.maybe_convert_objects(values)

            # if we have the labels, extract the values with a mask
            if labels is not None:
                mask = labels == -1

                # we can have situations where the whole mask is -1,
                # meaning there is nothing found in labels, so make all nan's
                if mask.all():
                    values = np.empty(len(mask))
                    values.fill(np.nan)
                else:
                    values = values.take(labels)
                    if mask.any():
                        values, changed = maybe_upcast_putmask(
                            values, mask, np.nan)
            return values

        new_index = _default_index(len(new_obj))
        if level is not None:
            if not isinstance(level, (tuple, list)):
                level = [level]
            level = [self.index._get_level_number(lev) for lev in level]
            if isinstance(self.index, MultiIndex):
                if len(level) < self.index.nlevels:
                    new_index = self.index.droplevel(level)

        if not drop:
            if isinstance(self.index, MultiIndex):
                names = [n if n is not None else ('level_%d' % i)
                         for (i, n) in enumerate(self.index.names)]
                to_insert = lzip(self.index.levels, self.index.labels)
            else:
                default = 'index' if 'index' not in self else 'level_0'
                names = ([default] if self.index.name is None
                         else [self.index.name])
                to_insert = ((self.index, None),)

            multi_col = isinstance(self.columns, MultiIndex)
            for i, (lev, lab) in reversed(list(enumerate(to_insert))):
                if not (level is None or i in level):
                    continue
                name = names[i]
                if multi_col:
                    col_name = (list(name) if isinstance(name, tuple)
                                else [name])
                    if col_fill is None:
                        if len(col_name) not in (1, self.columns.nlevels):
                            raise ValueError("col_fill=None is incompatible "
                                             "with incomplete column name "
                                             "{}".format(name))
                        col_fill = col_name[0]

                    lev_num = self.columns._get_level_number(col_level)
                    name_lst = [col_fill] * lev_num + col_name
                    missing = self.columns.nlevels - len(name_lst)
                    name_lst += [col_fill] * missing
                    name = tuple(name_lst)
                # to ndarray and maybe infer different dtype
                level_values = _maybe_casted_values(lev, lab)
                new_obj.insert(0, name, level_values)

        new_obj.index = new_index
        if not inplace:
            return new_obj

    # ----------------------------------------------------------------------
    # Reindex-based selection methods

    def dropna(self, axis=0, how='any', thresh=None, subset=None,
               inplace=False):
        """
        Return object with labels on given axis omitted where alternately any
        or all of the data are missing

        Parameters
        ----------
        axis : {0 or 'index', 1 or 'columns'}, or tuple/list thereof
            Pass tuple or list to drop on multiple axes
        how : {'any', 'all'}
            * any : if any NA values are present, drop that label
            * all : if all values are NA, drop that label
        thresh : int, default None
            int value : require that many non-NA values
        subset : array-like
            Labels along other axis to consider, e.g. if you are dropping rows
            these would be a list of columns to include
        inplace : boolean, default False
            If True, do operation inplace and return None.

        Returns
        -------
        dropped : DataFrame

        Examples
        --------
        >>> df = pd.DataFrame([[np.nan, 2, np.nan, 0], [3, 4, np.nan, 1],
        ...                    [np.nan, np.nan, np.nan, 5]],
        ...                   columns=list('ABCD'))
        >>> df
             A    B   C  D
        0  NaN  2.0 NaN  0
        1  3.0  4.0 NaN  1
        2  NaN  NaN NaN  5

        Drop the columns where all elements are nan:

        >>> df.dropna(axis=1, how='all')
             A    B  D
        0  NaN  2.0  0
        1  3.0  4.0  1
        2  NaN  NaN  5

        Drop the columns where any of the elements is nan

        >>> df.dropna(axis=1, how='any')
           D
        0  0
        1  1
        2  5

        Drop the rows where all of the elements are nan
        (there is no row to drop, so df stays the same):

        >>> df.dropna(axis=0, how='all')
             A    B   C  D
        0  NaN  2.0 NaN  0
        1  3.0  4.0 NaN  1
        2  NaN  NaN NaN  5

        Keep only the rows with at least 2 non-na values:

        >>> df.dropna(thresh=2)
             A    B   C  D
        0  NaN  2.0 NaN  0
        1  3.0  4.0 NaN  1

        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if isinstance(axis, (tuple, list)):
            result = self
            for ax in axis:
                result = result.dropna(how=how, thresh=thresh, subset=subset,
                                       axis=ax)
        else:
            axis = self._get_axis_number(axis)
            agg_axis = 1 - axis

            agg_obj = self
            if subset is not None:
                ax = self._get_axis(agg_axis)
                indices = ax.get_indexer_for(subset)
                check = indices == -1
                if check.any():
                    raise KeyError(list(np.compress(check, subset)))
                agg_obj = self.take(indices, axis=agg_axis)

            count = agg_obj.count(axis=agg_axis)

            if thresh is not None:
                mask = count >= thresh
            elif how == 'any':
                mask = count == len(agg_obj._get_axis(agg_axis))
            elif how == 'all':
                mask = count > 0
            else:
                if how is not None:
                    raise ValueError('invalid how option: %s' % how)
                else:
                    raise TypeError('must specify how or thresh')

            result = self.take(mask.nonzero()[0], axis=axis, convert=False)

        if inplace:
            self._update_inplace(result)
        else:
            return result

    def drop_duplicates(self, subset=None, keep='first', inplace=False):
        """
        Return DataFrame with duplicate rows removed, optionally only
        considering certain columns

        Parameters
        ----------
        subset : column label or sequence of labels, optional
            Only consider certain columns for identifying duplicates, by
            default use all of the columns
        keep : {'first', 'last', False}, default 'first'
            - ``first`` : Drop duplicates except for the first occurrence.
            - ``last`` : Drop duplicates except for the last occurrence.
            - False : Drop all duplicates.
        inplace : boolean, default False
            Whether to drop duplicates in place or to return a copy

        Returns
        -------
        deduplicated : DataFrame
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        duplicated = self.duplicated(subset, keep=keep)

        if inplace:
            inds, = (-duplicated).nonzero()
            new_data = self._data.take(inds)
            self._update_inplace(new_data)
        else:
            return self[-duplicated]

    def duplicated(self, subset=None, keep='first'):
        """
        Return boolean Series denoting duplicate rows, optionally only
        considering certain columns

        Parameters
        ----------
        subset : column label or sequence of labels, optional
            Only consider certain columns for identifying duplicates, by
            default use all of the columns
        keep : {'first', 'last', False}, default 'first'
            - ``first`` : Mark duplicates as ``True`` except for the
              first occurrence.
            - ``last`` : Mark duplicates as ``True`` except for the
              last occurrence.
            - False : Mark all duplicates as ``True``.

        Returns
        -------
        duplicated : Series
        """
        from pandas.core.sorting import get_group_index
        from pandas._libs.hashtable import duplicated_int64, _SIZE_HINT_LIMIT

        def f(vals):
            labels, shape = algorithms.factorize(
                vals, size_hint=min(len(self), _SIZE_HINT_LIMIT))
            return labels.astype('i8', copy=False), len(shape)

        if subset is None:
            subset = self.columns
        elif (not np.iterable(subset) or
              isinstance(subset, compat.string_types) or
              isinstance(subset, tuple) and subset in self.columns):
            subset = subset,

        vals = (self[col].values for col in subset)
        labels, shape = map(list, zip(*map(f, vals)))

        ids = get_group_index(labels, shape, sort=False, xnull=False)
        return Series(duplicated_int64(ids, keep), index=self.index)

    # ----------------------------------------------------------------------
    # Sorting

    @Appender(_shared_docs['sort_values'] % _shared_doc_kwargs)
    def sort_values(self, by, axis=0, ascending=True, inplace=False,
                    kind='quicksort', na_position='last'):
        inplace = validate_bool_kwarg(inplace, 'inplace')
        axis = self._get_axis_number(axis)
        other_axis = 0 if axis == 1 else 1

        if not isinstance(by, list):
            by = [by]
        if is_sequence(ascending) and len(by) != len(ascending):
            raise ValueError('Length of ascending (%d) != length of by (%d)' %
                             (len(ascending), len(by)))
        if len(by) > 1:
            from pandas.core.sorting import lexsort_indexer

            def trans(v):
                if needs_i8_conversion(v):
                    return v.view('i8')
                return v

            keys = []
            for x in by:
                k = self.xs(x, axis=other_axis).values
                if k.ndim == 2:
                    raise ValueError('Cannot sort by duplicate column %s' %
                                     str(x))
                keys.append(trans(k))
            indexer = lexsort_indexer(keys, orders=ascending,
                                      na_position=na_position)
            indexer = _ensure_platform_int(indexer)
        else:
            from pandas.core.sorting import nargsort

            by = by[0]
            k = self.xs(by, axis=other_axis).values
            if k.ndim == 2:

                # try to be helpful
                if isinstance(self.columns, MultiIndex):
                    raise ValueError('Cannot sort by column %s in a '
                                     'multi-index you need to explicitly '
                                     'provide all the levels' % str(by))

                raise ValueError('Cannot sort by duplicate column %s' %
                                 str(by))
            if isinstance(ascending, (tuple, list)):
                ascending = ascending[0]

            indexer = nargsort(k, kind=kind, ascending=ascending,
                               na_position=na_position)

        new_data = self._data.take(indexer,
                                   axis=self._get_block_manager_axis(axis),
                                   convert=False, verify=False)

        if inplace:
            return self._update_inplace(new_data)
        else:
            return self._constructor(new_data).__finalize__(self)

    @Appender(_shared_docs['sort_index'] % _shared_doc_kwargs)
    def sort_index(self, axis=0, level=None, ascending=True, inplace=False,
                   kind='quicksort', na_position='last', sort_remaining=True,
                   by=None):

        # TODO: this can be combined with Series.sort_index impl as
        # almost identical

        inplace = validate_bool_kwarg(inplace, 'inplace')
        # 10726
        if by is not None:
            warnings.warn("by argument to sort_index is deprecated, pls use "
                          ".sort_values(by=...)", FutureWarning, stacklevel=2)
            if level is not None:
                raise ValueError("unable to simultaneously sort by and level")
            return self.sort_values(by, axis=axis, ascending=ascending,
                                    inplace=inplace)

        axis = self._get_axis_number(axis)
        labels = self._get_axis(axis)

        if level:

            new_axis, indexer = labels.sortlevel(level, ascending=ascending,
                                                 sort_remaining=sort_remaining)

        elif isinstance(labels, MultiIndex):
            from pandas.core.sorting import lexsort_indexer

            # make sure that the axis is lexsorted to start
            # if not we need to reconstruct to get the correct indexer
            labels = labels._sort_levels_monotonic()
            indexer = lexsort_indexer(labels._get_labels_for_sorting(),
                                      orders=ascending,
                                      na_position=na_position)
        else:
            from pandas.core.sorting import nargsort

            # Check monotonic-ness before sort an index
            # GH11080
            if ((ascending and labels.is_monotonic_increasing) or
                    (not ascending and labels.is_monotonic_decreasing)):
                if inplace:
                    return
                else:
                    return self.copy()

            indexer = nargsort(labels, kind=kind, ascending=ascending,
                               na_position=na_position)

        baxis = self._get_block_manager_axis(axis)
        new_data = self._data.take(indexer,
                                   axis=baxis,
                                   convert=False, verify=False)

        # reconstruct axis if needed
        new_data.axes[baxis] = new_data.axes[baxis]._sort_levels_monotonic()

        if inplace:
            return self._update_inplace(new_data)
        else:
            return self._constructor(new_data).__finalize__(self)

    def sortlevel(self, level=0, axis=0, ascending=True, inplace=False,
                  sort_remaining=True):
        """
        DEPRECATED: use :meth:`DataFrame.sort_index`

        Sort multilevel index by chosen axis and primary level. Data will be
        lexicographically sorted by the chosen level followed by the other
        levels (in order)

        Parameters
        ----------
        level : int
        axis : {0 or 'index', 1 or 'columns'}, default 0
        ascending : boolean, default True
        inplace : boolean, default False
            Sort the DataFrame without creating a new instance
        sort_remaining : boolean, default True
            Sort by the other levels too.

        Returns
        -------
        sorted : DataFrame

        See Also
        --------
        DataFrame.sort_index(level=...)

        """
        warnings.warn("sortlevel is deprecated, use sort_index(level= ...)",
                      FutureWarning, stacklevel=2)
        return self.sort_index(level=level, axis=axis, ascending=ascending,
                               inplace=inplace, sort_remaining=sort_remaining)

    def nlargest(self, n, columns, keep='first'):
        """Get the rows of a DataFrame sorted by the `n` largest
        values of `columns`.

        .. versionadded:: 0.17.0

        Parameters
        ----------
        n : int
            Number of items to retrieve
        columns : list or str
            Column name or names to order by
        keep : {'first', 'last', False}, default 'first'
            Where there are duplicate values:
            - ``first`` : take the first occurrence.
            - ``last`` : take the last occurrence.

        Returns
        -------
        DataFrame

        Examples
        --------
        >>> df = DataFrame({'a': [1, 10, 8, 11, -1],
        ...                 'b': list('abdce'),
        ...                 'c': [1.0, 2.0, np.nan, 3.0, 4.0]})
        >>> df.nlargest(3, 'a')
            a  b   c
        3  11  c   3
        1  10  b   2
        2   8  d NaN
        """
        return algorithms.SelectNFrame(self,
                                       n=n,
                                       keep=keep,
                                       columns=columns).nlargest()

    def nsmallest(self, n, columns, keep='first'):
        """Get the rows of a DataFrame sorted by the `n` smallest
        values of `columns`.

        .. versionadded:: 0.17.0

        Parameters
        ----------
        n : int
            Number of items to retrieve
        columns : list or str
            Column name or names to order by
        keep : {'first', 'last', False}, default 'first'
            Where there are duplicate values:
            - ``first`` : take the first occurrence.
            - ``last`` : take the last occurrence.

        Returns
        -------
        DataFrame

        Examples
        --------
        >>> df = DataFrame({'a': [1, 10, 8, 11, -1],
        ...                 'b': list('abdce'),
        ...                 'c': [1.0, 2.0, np.nan, 3.0, 4.0]})
        >>> df.nsmallest(3, 'a')
           a  b   c
        4 -1  e   4
        0  1  a   1
        2  8  d NaN
        """
        return algorithms.SelectNFrame(self,
                                       n=n,
                                       keep=keep,
                                       columns=columns).nsmallest()

    def swaplevel(self, i=-2, j=-1, axis=0):
        """
        Swap levels i and j in a MultiIndex on a particular axis

        Parameters
        ----------
        i, j : int, string (can be mixed)
            Level of index to be swapped. Can pass level name as string.

        Returns
        -------
        swapped : type of caller (new object)

        .. versionchanged:: 0.18.1

           The indexes ``i`` and ``j`` are now optional, and default to
           the two innermost levels of the index.

        """
        result = self.copy()

        axis = self._get_axis_number(axis)
        if axis == 0:
            result.index = result.index.swaplevel(i, j)
        else:
            result.columns = result.columns.swaplevel(i, j)
        return result

    def reorder_levels(self, order, axis=0):
        """
        Rearrange index levels using input order.
        May not drop or duplicate levels

        Parameters
        ----------
        order : list of int or list of str
            List representing new level order. Reference level by number
            (position) or by key (label).
        axis : int
            Where to reorder levels.

        Returns
        -------
        type of caller (new object)
        """
        axis = self._get_axis_number(axis)
        if not isinstance(self._get_axis(axis),
                          MultiIndex):  # pragma: no cover
            raise TypeError('Can only reorder levels on a hierarchical axis.')

        result = self.copy()

        if axis == 0:
            result.index = result.index.reorder_levels(order)
        else:
            result.columns = result.columns.reorder_levels(order)
        return result

    # ----------------------------------------------------------------------
    # Arithmetic / combination related

    def _combine_frame(self, other, func, fill_value=None, level=None):
        this, other = self.align(other, join='outer', level=level, copy=False)
        new_index, new_columns = this.index, this.columns

        def _arith_op(left, right):
            if fill_value is not None:
                left_mask = isnull(left)
                right_mask = isnull(right)
                left = left.copy()
                right = right.copy()

                # one but not both
                mask = left_mask ^ right_mask
                left[left_mask & mask] = fill_value
                right[right_mask & mask] = fill_value

            return func(left, right)

        if this._is_mixed_type or other._is_mixed_type:

            # unique
            if this.columns.is_unique:

                def f(col):
                    r = _arith_op(this[col].values, other[col].values)
                    return self._constructor_sliced(r, index=new_index,
                                                    dtype=r.dtype)

                result = dict([(col, f(col)) for col in this])

            # non-unique
            else:

                def f(i):
                    r = _arith_op(this.iloc[:, i].values,
                                  other.iloc[:, i].values)
                    return self._constructor_sliced(r, index=new_index,
                                                    dtype=r.dtype)

                result = dict([
                    (i, f(i)) for i, col in enumerate(this.columns)
                ])
                result = self._constructor(result, index=new_index, copy=False)
                result.columns = new_columns
                return result

        else:
            result = _arith_op(this.values, other.values)

        return self._constructor(result, index=new_index, columns=new_columns,
                                 copy=False)

    def _combine_series(self, other, func, fill_value=None, axis=None,
                        level=None):
        if axis is not None:
            axis = self._get_axis_name(axis)
            if axis == 'index':
                return self._combine_match_index(other, func, level=level,
                                                 fill_value=fill_value)
            else:
                return self._combine_match_columns(other, func, level=level,
                                                   fill_value=fill_value)
        return self._combine_series_infer(other, func, level=level,
                                          fill_value=fill_value)

    def _combine_series_infer(self, other, func, level=None, fill_value=None):
        if len(other) == 0:
            return self * NA

        if len(self) == 0:
            # Ambiguous case, use _series so works with DataFrame
            return self._constructor(data=self._series, index=self.index,
                                     columns=self.columns)

        return self._combine_match_columns(other, func, level=level,
                                           fill_value=fill_value)

    def _combine_match_index(self, other, func, level=None, fill_value=None):
        left, right = self.align(other, join='outer', axis=0, level=level,
                                 copy=False)
        if fill_value is not None:
            raise NotImplementedError("fill_value %r not supported." %
                                      fill_value)
        return self._constructor(func(left.values.T, right.values).T,
                                 index=left.index, columns=self.columns,
                                 copy=False)

    def _combine_match_columns(self, other, func, level=None, fill_value=None):
        left, right = self.align(other, join='outer', axis=1, level=level,
                                 copy=False)
        if fill_value is not None:
            raise NotImplementedError("fill_value %r not supported" %
                                      fill_value)

        new_data = left._data.eval(func=func, other=right,
                                   axes=[left.columns, self.index])
        return self._constructor(new_data)

    def _combine_const(self, other, func, raise_on_error=True):
        new_data = self._data.eval(func=func, other=other,
                                   raise_on_error=raise_on_error)
        return self._constructor(new_data)

    def _compare_frame_evaluate(self, other, func, str_rep):

        # unique
        if self.columns.is_unique:

            def _compare(a, b):
                return dict([(col, func(a[col], b[col])) for col in a.columns])

            new_data = expressions.evaluate(_compare, str_rep, self, other)
            return self._constructor(data=new_data, index=self.index,
                                     columns=self.columns, copy=False)
        # non-unique
        else:

            def _compare(a, b):
                return dict([(i, func(a.iloc[:, i], b.iloc[:, i]))
                             for i, col in enumerate(a.columns)])

            new_data = expressions.evaluate(_compare, str_rep, self, other)
            result = self._constructor(data=new_data, index=self.index,
                                       copy=False)
            result.columns = self.columns
            return result

    def _compare_frame(self, other, func, str_rep):
        if not self._indexed_same(other):
            raise ValueError('Can only compare identically-labeled '
                             'DataFrame objects')
        return self._compare_frame_evaluate(other, func, str_rep)

    def _flex_compare_frame(self, other, func, str_rep, level):
        if not self._indexed_same(other):
            self, other = self.align(other, 'outer', level=level, copy=False)
        return self._compare_frame_evaluate(other, func, str_rep)

    def combine(self, other, func, fill_value=None, overwrite=True):
        """
        Add two DataFrame objects and do not propagate NaN values, so if for a
        (column, time) one frame is missing a value, it will default to the
        other frame's value (which might be NaN as well)

        Parameters
        ----------
        other : DataFrame
        func : function
        fill_value : scalar value
        overwrite : boolean, default True
            If True then overwrite values for common keys in the calling frame

        Returns
        -------
        result : DataFrame
        """

        other_idxlen = len(other.index)  # save for compare

        this, other = self.align(other, copy=False)
        new_index = this.index

        if other.empty and len(new_index) == len(self.index):
            return self.copy()

        if self.empty and len(other) == other_idxlen:
            return other.copy()

        # sorts if possible
        new_columns = this.columns.union(other.columns)
        do_fill = fill_value is not None

        result = {}
        for col in new_columns:
            series = this[col]
            otherSeries = other[col]

            this_dtype = series.dtype
            other_dtype = otherSeries.dtype

            this_mask = isnull(series)
            other_mask = isnull(otherSeries)

            # don't overwrite columns unecessarily
            # DO propagate if this column is not in the intersection
            if not overwrite and other_mask.all():
                result[col] = this[col].copy()
                continue

            if do_fill:
                series = series.copy()
                otherSeries = otherSeries.copy()
                series[this_mask] = fill_value
                otherSeries[other_mask] = fill_value

            # if we have different dtypes, possibily promote
            new_dtype = this_dtype
            if not is_dtype_equal(this_dtype, other_dtype):
                new_dtype = find_common_type([this_dtype, other_dtype])
                if not is_dtype_equal(this_dtype, new_dtype):
                    series = series.astype(new_dtype)
                if not is_dtype_equal(other_dtype, new_dtype):
                    otherSeries = otherSeries.astype(new_dtype)

            # see if we need to be represented as i8 (datetimelike)
            # try to keep us at this dtype
            needs_i8_conversion_i = needs_i8_conversion(new_dtype)
            if needs_i8_conversion_i:
                arr = func(series, otherSeries, True)
            else:
                arr = func(series, otherSeries)

            if do_fill:
                arr = _ensure_float(arr)
                arr[this_mask & other_mask] = NA

            # try to downcast back to the original dtype
            if needs_i8_conversion_i:
                # ToDo: This conversion should be handled in
                # _maybe_cast_to_datetime but the change affects lot...
                if is_datetime64tz_dtype(new_dtype):
                    arr = DatetimeIndex._simple_new(arr, tz=new_dtype.tz)
                else:
                    arr = maybe_cast_to_datetime(arr, new_dtype)
            else:
                arr = maybe_downcast_to_dtype(arr, this_dtype)

            result[col] = arr

        # convert_objects just in case
        return self._constructor(result, index=new_index,
                                 columns=new_columns)._convert(datetime=True,
                                                               copy=False)

    def combine_first(self, other):
        """
        Combine two DataFrame objects and default to non-null values in frame
        calling the method. Result index columns will be the union of the
        respective indexes and columns

        Parameters
        ----------
        other : DataFrame

        Examples
        --------
        a's values prioritized, use values from b to fill holes:

        >>> a.combine_first(b)


        Returns
        -------
        combined : DataFrame
        """

        def combiner(x, y, needs_i8_conversion=False):
            x_values = x.values if hasattr(x, 'values') else x
            y_values = y.values if hasattr(y, 'values') else y
            if needs_i8_conversion:
                mask = isnull(x)
                x_values = x_values.view('i8')
                y_values = y_values.view('i8')
            else:
                mask = isnull(x_values)

            return expressions.where(mask, y_values, x_values,
                                     raise_on_error=True)

        return self.combine(other, combiner, overwrite=False)

    def update(self, other, join='left', overwrite=True, filter_func=None,
               raise_conflict=False):
        """
        Modify DataFrame in place using non-NA values from passed
        DataFrame. Aligns on indices

        Parameters
        ----------
        other : DataFrame, or object coercible into a DataFrame
        join : {'left'}, default 'left'
        overwrite : boolean, default True
            If True then overwrite values for common keys in the calling frame
        filter_func : callable(1d-array) -> 1d-array<boolean>, default None
            Can choose to replace values other than NA. Return True for values
            that should be updated
        raise_conflict : boolean
            If True, will raise an error if the DataFrame and other both
            contain data in the same place.
        """
        # TODO: Support other joins
        if join != 'left':  # pragma: no cover
            raise NotImplementedError("Only left join is supported")

        if not isinstance(other, DataFrame):
            other = DataFrame(other)

        other = other.reindex_like(self)

        for col in self.columns:
            this = self[col].values
            that = other[col].values
            if filter_func is not None:
                with np.errstate(all='ignore'):
                    mask = ~filter_func(this) | isnull(that)
            else:
                if raise_conflict:
                    mask_this = notnull(that)
                    mask_that = notnull(this)
                    if any(mask_this & mask_that):
                        raise ValueError("Data overlaps.")

                if overwrite:
                    mask = isnull(that)
                else:
                    mask = notnull(this)

            # don't overwrite columns unecessarily
            if mask.all():
                continue

            self[col] = expressions.where(mask, this, that,
                                          raise_on_error=True)

    # ----------------------------------------------------------------------
    # Misc methods

    def first_valid_index(self):
        """
        Return label for first non-NA/null value
        """
        if len(self) == 0:
            return None

        return self.index[self.count(1) > 0][0]

    def last_valid_index(self):
        """
        Return label for last non-NA/null value
        """
        if len(self) == 0:
            return None

        return self.index[self.count(1) > 0][-1]

    # ----------------------------------------------------------------------
    # Data reshaping

    def pivot(self, index=None, columns=None, values=None):
        """
        Reshape data (produce a "pivot" table) based on column values. Uses
        unique values from index / columns to form axes of the resulting
        DataFrame.

        Parameters
        ----------
        index : string or object, optional
            Column name to use to make new frame's index. If None, uses
            existing index.
        columns : string or object
            Column name to use to make new frame's columns
        values : string or object, optional
            Column name to use for populating new frame's values. If not
            specified, all remaining columns will be used and the result will
            have hierarchically indexed columns

        Returns
        -------
        pivoted : DataFrame

        See also
        --------
        DataFrame.pivot_table : generalization of pivot that can handle
            duplicate values for one index/column pair
        DataFrame.unstack : pivot based on the index values instead of a
            column

        Notes
        -----
        For finer-tuned control, see hierarchical indexing documentation along
        with the related stack/unstack methods

        Examples
        --------

        >>> df = pd.DataFrame({'foo': ['one','one','one','two','two','two'],
                               'bar': ['A', 'B', 'C', 'A', 'B', 'C'],
                               'baz': [1, 2, 3, 4, 5, 6]})
        >>> df
            foo   bar  baz
        0   one   A    1
        1   one   B    2
        2   one   C    3
        3   two   A    4
        4   two   B    5
        5   two   C    6

        >>> df.pivot(index='foo', columns='bar', values='baz')
             A   B   C
        one  1   2   3
        two  4   5   6

        >>> df.pivot(index='foo', columns='bar')['baz']
             A   B   C
        one  1   2   3
        two  4   5   6


        """
        from pandas.core.reshape.reshape import pivot
        return pivot(self, index=index, columns=columns, values=values)

    def stack(self, level=-1, dropna=True):
        """
        Pivot a level of the (possibly hierarchical) column labels, returning a
        DataFrame (or Series in the case of an object with a single level of
        column labels) having a hierarchical index with a new inner-most level
        of row labels.
        The level involved will automatically get sorted.

        Parameters
        ----------
        level : int, string, or list of these, default last level
            Level(s) to stack, can pass level name
        dropna : boolean, default True
            Whether to drop rows in the resulting Frame/Series with no valid
            values

        Examples
        ----------
        >>> s
             a   b
        one  1.  2.
        two  3.  4.

        >>> s.stack()
        one a    1
            b    2
        two a    3
            b    4

        Returns
        -------
        stacked : DataFrame or Series
        """
        from pandas.core.reshape.reshape import stack, stack_multiple

        if isinstance(level, (tuple, list)):
            return stack_multiple(self, level, dropna=dropna)
        else:
            return stack(self, level, dropna=dropna)

    def unstack(self, level=-1, fill_value=None):
        """
        Pivot a level of the (necessarily hierarchical) index labels, returning
        a DataFrame having a new level of column labels whose inner-most level
        consists of the pivoted index labels. If the index is not a MultiIndex,
        the output will be a Series (the analogue of stack when the columns are
        not a MultiIndex).
        The level involved will automatically get sorted.

        Parameters
        ----------
        level : int, string, or list of these, default -1 (last level)
            Level(s) of index to unstack, can pass level name
        fill_value : replace NaN with this value if the unstack produces
            missing values

            .. versionadded: 0.18.0

        See also
        --------
        DataFrame.pivot : Pivot a table based on column values.
        DataFrame.stack : Pivot a level of the column labels (inverse operation
            from `unstack`).

        Examples
        --------
        >>> index = pd.MultiIndex.from_tuples([('one', 'a'), ('one', 'b'),
        ...                                    ('two', 'a'), ('two', 'b')])
        >>> s = pd.Series(np.arange(1.0, 5.0), index=index)
        >>> s
        one  a   1.0
             b   2.0
        two  a   3.0
             b   4.0
        dtype: float64

        >>> s.unstack(level=-1)
             a   b
        one  1.0  2.0
        two  3.0  4.0

        >>> s.unstack(level=0)
           one  two
        a  1.0   3.0
        b  2.0   4.0

        >>> df = s.unstack(level=0)
        >>> df.unstack()
        one  a  1.0
             b  2.0
        two  a  3.0
             b  4.0
        dtype: float64

        Returns
        -------
        unstacked : DataFrame or Series
        """
        from pandas.core.reshape.reshape import unstack
        return unstack(self, level, fill_value)

    _shared_docs['melt'] = ("""
    "Unpivots" a DataFrame from wide format to long format, optionally
    leaving identifier variables set.

    This function is useful to massage a DataFrame into a format where one
    or more columns are identifier variables (`id_vars`), while all other
    columns, considered measured variables (`value_vars`), are "unpivoted" to
    the row axis, leaving just two non-identifier columns, 'variable' and
    'value'.

    %(versionadded)s
    Parameters
    ----------
    frame : DataFrame
    id_vars : tuple, list, or ndarray, optional
        Column(s) to use as identifier variables.
    value_vars : tuple, list, or ndarray, optional
        Column(s) to unpivot. If not specified, uses all columns that
        are not set as `id_vars`.
    var_name : scalar
        Name to use for the 'variable' column. If None it uses
        ``frame.columns.name`` or 'variable'.
    value_name : scalar, default 'value'
        Name to use for the 'value' column.
    col_level : int or string, optional
        If columns are a MultiIndex then use this level to melt.

    See also
    --------
    %(other)s
    pivot_table
    DataFrame.pivot

    Examples
    --------
    >>> import pandas as pd
    >>> df = pd.DataFrame({'A': {0: 'a', 1: 'b', 2: 'c'},
    ...                    'B': {0: 1, 1: 3, 2: 5},
    ...                    'C': {0: 2, 1: 4, 2: 6}})
    >>> df
       A  B  C
    0  a  1  2
    1  b  3  4
    2  c  5  6

    >>> %(caller)sid_vars=['A'], value_vars=['B'])
       A variable  value
    0  a        B      1
    1  b        B      3
    2  c        B      5

    >>> %(caller)sid_vars=['A'], value_vars=['B', 'C'])
       A variable  value
    0  a        B      1
    1  b        B      3
    2  c        B      5
    3  a        C      2
    4  b        C      4
    5  c        C      6

    The names of 'variable' and 'value' columns can be customized:

    >>> %(caller)sid_vars=['A'], value_vars=['B'],
    ...         var_name='myVarname', value_name='myValname')
       A myVarname  myValname
    0  a         B          1
    1  b         B          3
    2  c         B          5

    If you have multi-index columns:

    >>> df.columns = [list('ABC'), list('DEF')]
    >>> df
       A  B  C
       D  E  F
    0  a  1  2
    1  b  3  4
    2  c  5  6

    >>> %(caller)scol_level=0, id_vars=['A'], value_vars=['B'])
       A variable  value
    0  a        B      1
    1  b        B      3
    2  c        B      5

    >>> %(caller)sid_vars=[('A', 'D')], value_vars=[('B', 'E')])
      (A, D) variable_0 variable_1  value
    0      a          B          E      1
    1      b          B          E      3
    2      c          B          E      5

    """)

    @Appender(_shared_docs['melt'] %
              dict(caller='df.melt(',
                   versionadded='.. versionadded:: 0.20.0\n',
                   other='melt'))
    def melt(self, id_vars=None, value_vars=None, var_name=None,
             value_name='value', col_level=None):
        from pandas.core.reshape.reshape import melt
        return melt(self, id_vars=id_vars, value_vars=value_vars,
                    var_name=var_name, value_name=value_name,
                    col_level=col_level)

    # ----------------------------------------------------------------------
    # Time series-related

    def diff(self, periods=1, axis=0):
        """
        1st discrete difference of object

        Parameters
        ----------
        periods : int, default 1
            Periods to shift for forming difference
        axis : {0 or 'index', 1 or 'columns'}, default 0
            Take difference over rows (0) or columns (1).

            .. versionadded: 0.16.1

        Returns
        -------
        diffed : DataFrame
        """
        bm_axis = self._get_block_manager_axis(axis)
        new_data = self._data.diff(n=periods, axis=bm_axis)
        return self._constructor(new_data)

    # ----------------------------------------------------------------------
    # Function application

    def _gotitem(self, key, ndim, subset=None):
        """
        sub-classes to define
        return a sliced object

        Parameters
        ----------
        key : string / list of selections
        ndim : 1,2
            requested ndim of result
        subset : object, default None
            subset to act on
        """
        if subset is None:
            subset = self

        # TODO: _shallow_copy(subset)?
        return self[key]

    _agg_doc = dedent("""
    Examples
    --------

    >>> df = pd.DataFrame(np.random.randn(10, 3), columns=['A', 'B', 'C'],
    ...                   index=pd.date_range('1/1/2000', periods=10))
    >>> df.iloc[3:7] = np.nan

    Aggregate these functions across all columns

    >>> df.agg(['sum', 'min'])
                A         B         C
    sum -0.182253 -0.614014 -2.909534
    min -1.916563 -1.460076 -1.568297

    Different aggregations per column

    >>> df.agg({'A' : ['sum', 'min'], 'B' : ['min', 'max']})
                A         B
    max       NaN  1.514318
    min -1.916563 -1.460076
    sum -0.182253       NaN

    See also
    --------
    pandas.DataFrame.apply
    pandas.DataFrame.transform
    pandas.DataFrame.groupby.aggregate
    pandas.DataFrame.resample.aggregate
    pandas.DataFrame.rolling.aggregate

    """)

    @Appender(_agg_doc)
    @Appender(_shared_docs['aggregate'] % dict(
        versionadded='.. versionadded:: 0.20.0',
        **_shared_doc_kwargs))
    def aggregate(self, func, axis=0, *args, **kwargs):
        axis = self._get_axis_number(axis)

        # TODO: flipped axis
        result = None
        if axis == 0:
            try:
                result, how = self._aggregate(func, axis=0, *args, **kwargs)
            except TypeError:
                pass
        if result is None:
            return self.apply(func, axis=axis, args=args, **kwargs)
        return result

    agg = aggregate

    def apply(self, func, axis=0, broadcast=False, raw=False, reduce=None,
              args=(), **kwds):
        """
        Applies function along input axis of DataFrame.

        Objects passed to functions are Series objects having index
        either the DataFrame's index (axis=0) or the columns (axis=1).
        Return type depends on whether passed function aggregates, or the
        reduce argument if the DataFrame is empty.

        Parameters
        ----------
        func : function
            Function to apply to each column/row
        axis : {0 or 'index', 1 or 'columns'}, default 0
            * 0 or 'index': apply function to each column
            * 1 or 'columns': apply function to each row
        broadcast : boolean, default False
            For aggregation functions, return object of same size with values
            propagated
        raw : boolean, default False
            If False, convert each row or column into a Series. If raw=True the
            passed function will receive ndarray objects instead. If you are
            just applying a NumPy reduction function this will achieve much
            better performance
        reduce : boolean or None, default None
            Try to apply reduction procedures. If the DataFrame is empty,
            apply will use reduce to determine whether the result should be a
            Series or a DataFrame. If reduce is None (the default), apply's
            return value will be guessed by calling func an empty Series (note:
            while guessing, exceptions raised by func will be ignored). If
            reduce is True a Series will always be returned, and if False a
            DataFrame will always be returned.
        args : tuple
            Positional arguments to pass to function in addition to the
            array/series
        Additional keyword arguments will be passed as keywords to the function

        Notes
        -----
        In the current implementation apply calls func twice on the
        first column/row to decide whether it can take a fast or slow
        code path. This can lead to unexpected behavior if func has
        side-effects, as they will take effect twice for the first
        column/row.

        Examples
        --------
        >>> df.apply(numpy.sqrt) # returns DataFrame
        >>> df.apply(numpy.sum, axis=0) # equiv to df.sum(0)
        >>> df.apply(numpy.sum, axis=1) # equiv to df.sum(1)

        See also
        --------
        DataFrame.applymap: For elementwise operations
        DataFrame.aggregate: only perform aggregating type operations
        DataFrame.transform: only perform transformating type operations

        Returns
        -------
        applied : Series or DataFrame
        """
        axis = self._get_axis_number(axis)
        ignore_failures = kwds.pop('ignore_failures', False)

        # dispatch to agg
        if axis == 0 and isinstance(func, (list, dict)):
            return self.aggregate(func, axis=axis, *args, **kwds)

        if len(self.columns) == 0 and len(self.index) == 0:
            return self._apply_empty_result(func, axis, reduce, *args, **kwds)

        # if we are a string, try to dispatch
        if isinstance(func, compat.string_types):
            if axis:
                kwds['axis'] = axis
            return getattr(self, func)(*args, **kwds)

        if kwds or args and not isinstance(func, np.ufunc):
            def f(x):
                return func(x, *args, **kwds)
        else:
            f = func

        if isinstance(f, np.ufunc):
            with np.errstate(all='ignore'):
                results = f(self.values)
            return self._constructor(data=results, index=self.index,
                                     columns=self.columns, copy=False)
        else:
            if not broadcast:
                if not all(self.shape):
                    return self._apply_empty_result(func, axis, reduce, *args,
                                                    **kwds)

                if raw and not self._is_mixed_type:
                    return self._apply_raw(f, axis)
                else:
                    if reduce is None:
                        reduce = True
                    return self._apply_standard(
                        f, axis,
                        reduce=reduce,
                        ignore_failures=ignore_failures)
            else:
                return self._apply_broadcast(f, axis)

    def _apply_empty_result(self, func, axis, reduce, *args, **kwds):
        if reduce is None:
            reduce = False
            try:
                reduce = not isinstance(func(_EMPTY_SERIES, *args, **kwds),
                                        Series)
            except Exception:
                pass

        if reduce:
            return Series(NA, index=self._get_agg_axis(axis))
        else:
            return self.copy()

    def _apply_raw(self, func, axis):
        try:
            result = lib.reduce(self.values, func, axis=axis)
        except Exception:
            result = np.apply_along_axis(func, axis, self.values)

        # TODO: mixed type case
        if result.ndim == 2:
            return DataFrame(result, index=self.index, columns=self.columns)
        else:
            return Series(result, index=self._get_agg_axis(axis))

    def _apply_standard(self, func, axis, ignore_failures=False, reduce=True):

        # skip if we are mixed datelike and trying reduce across axes
        # GH6125
        if (reduce and axis == 1 and self._is_mixed_type and
                self._is_datelike_mixed_type):
            reduce = False

        # try to reduce first (by default)
        # this only matters if the reduction in values is of different dtype
        # e.g. if we want to apply to a SparseFrame, then can't directly reduce
        if reduce:
            values = self.values

            # we cannot reduce using non-numpy dtypes,
            # as demonstrated in gh-12244
            if not is_extension_type(values):
                # Create a dummy Series from an empty array
                index = self._get_axis(axis)
                empty_arr = np.empty(len(index), dtype=values.dtype)
                dummy = Series(empty_arr, index=self._get_axis(axis),
                               dtype=values.dtype)

                try:
                    labels = self._get_agg_axis(axis)
                    result = lib.reduce(values, func, axis=axis, dummy=dummy,
                                        labels=labels)
                    return Series(result, index=labels)
                except Exception:
                    pass

        dtype = object if self._is_mixed_type else None
        if axis == 0:
            series_gen = (self._ixs(i, axis=1)
                          for i in range(len(self.columns)))
            res_index = self.columns
            res_columns = self.index
        elif axis == 1:
            res_index = self.index
            res_columns = self.columns
            values = self.values
            series_gen = (Series.from_array(arr, index=res_columns, name=name,
                                            dtype=dtype)
                          for i, (arr, name) in enumerate(zip(values,
                                                              res_index)))
        else:  # pragma : no cover
            raise AssertionError('Axis must be 0 or 1, got %s' % str(axis))

        i = None
        keys = []
        results = {}
        if ignore_failures:
            successes = []
            for i, v in enumerate(series_gen):
                try:
                    results[i] = func(v)
                    keys.append(v.name)
                    successes.append(i)
                except Exception:
                    pass
            # so will work with MultiIndex
            if len(successes) < len(res_index):
                res_index = res_index.take(successes)
        else:
            try:
                for i, v in enumerate(series_gen):
                    results[i] = func(v)
                    keys.append(v.name)
            except Exception as e:
                if hasattr(e, 'args'):
                    # make sure i is defined
                    if i is not None:
                        k = res_index[i]
                        e.args = e.args + ('occurred at index %s' %
                                           pprint_thing(k), )
                raise

        if len(results) > 0 and is_sequence(results[0]):
            if not isinstance(results[0], Series):
                index = res_columns
            else:
                index = None

            result = self._constructor(data=results, index=index)
            result.columns = res_index

            if axis == 1:
                result = result.T
            result = result._convert(datetime=True, timedelta=True, copy=False)

        else:

            result = Series(results)
            result.index = res_index

        return result

    def _apply_broadcast(self, func, axis):
        if axis == 0:
            target = self
        elif axis == 1:
            target = self.T
        else:  # pragma: no cover
            raise AssertionError('Axis must be 0 or 1, got %s' % axis)

        result_values = np.empty_like(target.values)
        columns = target.columns
        for i, col in enumerate(columns):
            result_values[:, i] = func(target[col])

        result = self._constructor(result_values, index=target.index,
                                   columns=target.columns)

        if axis == 1:
            result = result.T

        return result

    def applymap(self, func):
        """
        Apply a function to a DataFrame that is intended to operate
        elementwise, i.e. like doing map(func, series) for each series in the
        DataFrame

        Parameters
        ----------
        func : function
            Python function, returns a single value from a single value

        Examples
        --------

        >>> df = pd.DataFrame(np.random.randn(3, 3))
        >>> df
            0         1          2
        0  -0.029638  1.081563   1.280300
        1   0.647747  0.831136  -1.549481
        2   0.513416 -0.884417   0.195343
        >>> df = df.applymap(lambda x: '%.2f' % x)
        >>> df
            0         1          2
        0  -0.03      1.08       1.28
        1   0.65      0.83      -1.55
        2   0.51     -0.88       0.20

        Returns
        -------
        applied : DataFrame

        See also
        --------
        DataFrame.apply : For operations on rows/columns

        """

        # if we have a dtype == 'M8[ns]', provide boxed values
        def infer(x):
            if x.empty:
                return lib.map_infer(x, func)
            return lib.map_infer(x.asobject, func)

        return self.apply(infer)

    # ----------------------------------------------------------------------
    # Merging / joining methods

    def append(self, other, ignore_index=False, verify_integrity=False):
        """
        Append rows of `other` to the end of this frame, returning a new
        object. Columns not in this frame are added as new columns.

        Parameters
        ----------
        other : DataFrame or Series/dict-like object, or list of these
            The data to append.
        ignore_index : boolean, default False
            If True, do not use the index labels.
        verify_integrity : boolean, default False
            If True, raise ValueError on creating index with duplicates.

        Returns
        -------
        appended : DataFrame

        Notes
        -----
        If a list of dict/series is passed and the keys are all contained in
        the DataFrame's index, the order of the columns in the resulting
        DataFrame will be unchanged.

        See also
        --------
        pandas.concat : General function to concatenate DataFrame, Series
            or Panel objects

        Examples
        --------

        >>> df = pd.DataFrame([[1, 2], [3, 4]], columns=list('AB'))
        >>> df
           A  B
        0  1  2
        1  3  4
        >>> df2 = pd.DataFrame([[5, 6], [7, 8]], columns=list('AB'))
        >>> df.append(df2)
           A  B
        0  1  2
        1  3  4
        0  5  6
        1  7  8

        With `ignore_index` set to True:

        >>> df.append(df2, ignore_index=True)
           A  B
        0  1  2
        1  3  4
        2  5  6
        3  7  8

        """
        if isinstance(other, (Series, dict)):
            if isinstance(other, dict):
                other = Series(other)
            if other.name is None and not ignore_index:
                raise TypeError('Can only append a Series if ignore_index=True'
                                ' or if the Series has a name')

            if other.name is None:
                index = None
            else:
                # other must have the same index name as self, otherwise
                # index name will be reset
                index = Index([other.name], name=self.index.name)

            combined_columns = self.columns.tolist() + self.columns.union(
                other.index).difference(self.columns).tolist()
            other = other.reindex(combined_columns, copy=False)
            other = DataFrame(other.values.reshape((1, len(other))),
                              index=index,
                              columns=combined_columns)
            other = other._convert(datetime=True, timedelta=True)
            if not self.columns.equals(combined_columns):
                self = self.reindex(columns=combined_columns)
        elif isinstance(other, list) and not isinstance(other[0], DataFrame):
            other = DataFrame(other)
            if (self.columns.get_indexer(other.columns) >= 0).all():
                other = other.loc[:, self.columns]

        from pandas.core.reshape.concat import concat
        if isinstance(other, (list, tuple)):
            to_concat = [self] + other
        else:
            to_concat = [self, other]
        return concat(to_concat, ignore_index=ignore_index,
                      verify_integrity=verify_integrity)

    def join(self, other, on=None, how='left', lsuffix='', rsuffix='',
             sort=False):
        """
        Join columns with other DataFrame either on index or on a key
        column. Efficiently Join multiple DataFrame objects by index at once by
        passing a list.

        Parameters
        ----------
        other : DataFrame, Series with name field set, or list of DataFrame
            Index should be similar to one of the columns in this one. If a
            Series is passed, its name attribute must be set, and that will be
            used as the column name in the resulting joined DataFrame
        on : column name, tuple/list of column names, or array-like
            Column(s) in the caller to join on the index in other,
            otherwise joins index-on-index. If multiples
            columns given, the passed DataFrame must have a MultiIndex. Can
            pass an array as the join key if not already contained in the
            calling DataFrame. Like an Excel VLOOKUP operation
        how : {'left', 'right', 'outer', 'inner'}, default: 'left'
            How to handle the operation of the two objects.

            * left: use calling frame's index (or column if on is specified)
            * right: use other frame's index
            * outer: form union of calling frame's index (or column if on is
              specified) with other frame's index, and sort it
              lexicographically
            * inner: form intersection of calling frame's index (or column if
              on is specified) with other frame's index, preserving the order
              of the calling's one
        lsuffix : string
            Suffix to use from left frame's overlapping columns
        rsuffix : string
            Suffix to use from right frame's overlapping columns
        sort : boolean, default False
            Order result DataFrame lexicographically by the join key. If False,
            the order of the join key depends on the join type (how keyword)

        Notes
        -----
        on, lsuffix, and rsuffix options are not supported when passing a list
        of DataFrame objects

        Examples
        --------
        >>> caller = pd.DataFrame({'key': ['K0', 'K1', 'K2', 'K3', 'K4', 'K5'],
        ...                        'A': ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']})

        >>> caller
            A key
        0  A0  K0
        1  A1  K1
        2  A2  K2
        3  A3  K3
        4  A4  K4
        5  A5  K5

        >>> other = pd.DataFrame({'key': ['K0', 'K1', 'K2'],
        ...                       'B': ['B0', 'B1', 'B2']})

        >>> other
            B key
        0  B0  K0
        1  B1  K1
        2  B2  K2

        Join DataFrames using their indexes.

        >>> caller.join(other, lsuffix='_caller', rsuffix='_other')

        >>>     A key_caller    B key_other
            0  A0         K0   B0        K0
            1  A1         K1   B1        K1
            2  A2         K2   B2        K2
            3  A3         K3  NaN       NaN
            4  A4         K4  NaN       NaN
            5  A5         K5  NaN       NaN


        If we want to join using the key columns, we need to set key to be
        the index in both caller and other. The joined DataFrame will have
        key as its index.

        >>> caller.set_index('key').join(other.set_index('key'))

        >>>      A    B
            key
            K0   A0   B0
            K1   A1   B1
            K2   A2   B2
            K3   A3  NaN
            K4   A4  NaN
            K5   A5  NaN

        Another option to join using the key columns is to use the on
        parameter. DataFrame.join always uses other's index but we can use any
        column in the caller. This method preserves the original caller's
        index in the result.

        >>> caller.join(other.set_index('key'), on='key')

        >>>     A key    B
            0  A0  K0   B0
            1  A1  K1   B1
            2  A2  K2   B2
            3  A3  K3  NaN
            4  A4  K4  NaN
            5  A5  K5  NaN


        See also
        --------
        DataFrame.merge : For column(s)-on-columns(s) operations

        Returns
        -------
        joined : DataFrame
        """
        # For SparseDataFrame's benefit
        return self._join_compat(other, on=on, how=how, lsuffix=lsuffix,
                                 rsuffix=rsuffix, sort=sort)

    def _join_compat(self, other, on=None, how='left', lsuffix='', rsuffix='',
                     sort=False):
        from pandas.core.reshape.merge import merge
        from pandas.core.reshape.concat import concat

        if isinstance(other, Series):
            if other.name is None:
                raise ValueError('Other Series must have a name')
            other = DataFrame({other.name: other})

        if isinstance(other, DataFrame):
            return merge(self, other, left_on=on, how=how,
                         left_index=on is None, right_index=True,
                         suffixes=(lsuffix, rsuffix), sort=sort)
        else:
            if on is not None:
                raise ValueError('Joining multiple DataFrames only supported'
                                 ' for joining on index')

            # join indexes only using concat
            if how == 'left':
                how = 'outer'
                join_axes = [self.index]
            else:
                join_axes = None

            frames = [self] + list(other)

            can_concat = all(df.index.is_unique for df in frames)

            if can_concat:
                return concat(frames, axis=1, join=how, join_axes=join_axes,
                              verify_integrity=True)

            joined = frames[0]

            for frame in frames[1:]:
                joined = merge(joined, frame, how=how, left_index=True,
                               right_index=True)

            return joined

    @Substitution('')
    @Appender(_merge_doc, indents=2)
    def merge(self, right, how='inner', on=None, left_on=None, right_on=None,
              left_index=False, right_index=False, sort=False,
              suffixes=('_x', '_y'), copy=True, indicator=False):
        from pandas.core.reshape.merge import merge
        return merge(self, right, how=how, on=on, left_on=left_on,
                     right_on=right_on, left_index=left_index,
                     right_index=right_index, sort=sort, suffixes=suffixes,
                     copy=copy, indicator=indicator)

    def round(self, decimals=0, *args, **kwargs):
        """
        Round a DataFrame to a variable number of decimal places.

        .. versionadded:: 0.17.0

        Parameters
        ----------
        decimals : int, dict, Series
            Number of decimal places to round each column to. If an int is
            given, round each column to the same number of places.
            Otherwise dict and Series round to variable numbers of places.
            Column names should be in the keys if `decimals` is a
            dict-like, or in the index if `decimals` is a Series. Any
            columns not included in `decimals` will be left as is. Elements
            of `decimals` which are not columns of the input will be
            ignored.

        Examples
        --------
        >>> df = pd.DataFrame(np.random.random([3, 3]),
        ...     columns=['A', 'B', 'C'], index=['first', 'second', 'third'])
        >>> df
                       A         B         C
        first   0.028208  0.992815  0.173891
        second  0.038683  0.645646  0.577595
        third   0.877076  0.149370  0.491027
        >>> df.round(2)
                   A     B     C
        first   0.03  0.99  0.17
        second  0.04  0.65  0.58
        third   0.88  0.15  0.49
        >>> df.round({'A': 1, 'C': 2})
                  A         B     C
        first   0.0  0.992815  0.17
        second  0.0  0.645646  0.58
        third   0.9  0.149370  0.49
        >>> decimals = pd.Series([1, 0, 2], index=['A', 'B', 'C'])
        >>> df.round(decimals)
                  A  B     C
        first   0.0  1  0.17
        second  0.0  1  0.58
        third   0.9  0  0.49

        Returns
        -------
        DataFrame object

        See Also
        --------
        numpy.around
        Series.round

        """
        from pandas.core.reshape.concat import concat

        def _dict_round(df, decimals):
            for col, vals in df.iteritems():
                try:
                    yield _series_round(vals, decimals[col])
                except KeyError:
                    yield vals

        def _series_round(s, decimals):
            if is_integer_dtype(s) or is_float_dtype(s):
                return s.round(decimals)
            return s

        nv.validate_round(args, kwargs)

        if isinstance(decimals, (dict, Series)):
            if isinstance(decimals, Series):
                if not decimals.index.is_unique:
                    raise ValueError("Index of decimals must be unique")
            new_cols = [col for col in _dict_round(self, decimals)]
        elif is_integer(decimals):
            # Dispatch to Series.round
            new_cols = [_series_round(v, decimals)
                        for _, v in self.iteritems()]
        else:
            raise TypeError("decimals must be an integer, a dict-like or a "
                            "Series")

        if len(new_cols) > 0:
            return self._constructor(concat(new_cols, axis=1),
                                     index=self.index,
                                     columns=self.columns)
        else:
            return self

    # ----------------------------------------------------------------------
    # Statistical methods, etc.

    def corr(self, method='pearson', min_periods=1):
        """
        Compute pairwise correlation of columns, excluding NA/null values

        Parameters
        ----------
        method : {'pearson', 'kendall', 'spearman'}
            * pearson : standard correlation coefficient
            * kendall : Kendall Tau correlation coefficient
            * spearman : Spearman rank correlation
        min_periods : int, optional
            Minimum number of observations required per pair of columns
            to have a valid result. Currently only available for pearson
            and spearman correlation

        Returns
        -------
        y : DataFrame
        """
        numeric_df = self._get_numeric_data()
        cols = numeric_df.columns
        idx = cols.copy()
        mat = numeric_df.values

        if method == 'pearson':
            correl = libalgos.nancorr(_ensure_float64(mat), minp=min_periods)
        elif method == 'spearman':
            correl = libalgos.nancorr_spearman(_ensure_float64(mat),
                                               minp=min_periods)
        else:
            if min_periods is None:
                min_periods = 1
            mat = _ensure_float64(mat).T
            corrf = nanops.get_corr_func(method)
            K = len(cols)
            correl = np.empty((K, K), dtype=float)
            mask = np.isfinite(mat)
            for i, ac in enumerate(mat):
                for j, bc in enumerate(mat):
                    if i > j:
                        continue

                    valid = mask[i] & mask[j]
                    if valid.sum() < min_periods:
                        c = NA
                    elif i == j:
                        c = 1.
                    elif not valid.all():
                        c = corrf(ac[valid], bc[valid])
                    else:
                        c = corrf(ac, bc)
                    correl[i, j] = c
                    correl[j, i] = c

        return self._constructor(correl, index=idx, columns=cols)

    def cov(self, min_periods=None):
        """
        Compute pairwise covariance of columns, excluding NA/null values

        Parameters
        ----------
        min_periods : int, optional
            Minimum number of observations required per pair of columns
            to have a valid result.

        Returns
        -------
        y : DataFrame

        Notes
        -----
        `y` contains the covariance matrix of the DataFrame's time series.
        The covariance is normalized by N-1 (unbiased estimator).
        """
        numeric_df = self._get_numeric_data()
        cols = numeric_df.columns
        idx = cols.copy()
        mat = numeric_df.values

        if notnull(mat).all():
            if min_periods is not None and min_periods > len(mat):
                baseCov = np.empty((mat.shape[1], mat.shape[1]))
                baseCov.fill(np.nan)
            else:
                baseCov = np.cov(mat.T)
            baseCov = baseCov.reshape((len(cols), len(cols)))
        else:
            baseCov = libalgos.nancorr(_ensure_float64(mat), cov=True,
                                       minp=min_periods)

        return self._constructor(baseCov, index=idx, columns=cols)

    def corrwith(self, other, axis=0, drop=False):
        """
        Compute pairwise correlation between rows or columns of two DataFrame
        objects.

        Parameters
        ----------
        other : DataFrame
        axis : {0 or 'index', 1 or 'columns'}, default 0
            0 or 'index' to compute column-wise, 1 or 'columns' for row-wise
        drop : boolean, default False
            Drop missing indices from result, default returns union of all

        Returns
        -------
        correls : Series
        """
        axis = self._get_axis_number(axis)
        if isinstance(other, Series):
            return self.apply(other.corr, axis=axis)

        this = self._get_numeric_data()
        other = other._get_numeric_data()

        left, right = this.align(other, join='inner', copy=False)

        # mask missing values
        left = left + right * 0
        right = right + left * 0

        if axis == 1:
            left = left.T
            right = right.T

        # demeaned data
        ldem = left - left.mean()
        rdem = right - right.mean()

        num = (ldem * rdem).sum()
        dom = (left.count() - 1) * left.std() * right.std()

        correl = num / dom

        if not drop:
            raxis = 1 if axis == 0 else 0
            result_index = this._get_axis(raxis).union(other._get_axis(raxis))
            correl = correl.reindex(result_index)

        return correl

    # ----------------------------------------------------------------------
    # ndarray-like stats methods

    def count(self, axis=0, level=None, numeric_only=False):
        """
        Return Series with number of non-NA/null observations over requested
        axis. Works with non-floating point data as well (detects NaN and None)

        Parameters
        ----------
        axis : {0 or 'index', 1 or 'columns'}, default 0
            0 or 'index' for row-wise, 1 or 'columns' for column-wise
        level : int or level name, default None
            If the axis is a MultiIndex (hierarchical), count along a
            particular level, collapsing into a DataFrame
        numeric_only : boolean, default False
            Include only float, int, boolean data

        Returns
        -------
        count : Series (or DataFrame if level specified)
        """
        axis = self._get_axis_number(axis)
        if level is not None:
            return self._count_level(level, axis=axis,
                                     numeric_only=numeric_only)

        if numeric_only:
            frame = self._get_numeric_data()
        else:
            frame = self

        # GH #423
        if len(frame._get_axis(axis)) == 0:
            result = Series(0, index=frame._get_agg_axis(axis))
        else:
            if frame._is_mixed_type:
                result = notnull(frame).sum(axis=axis)
            else:
                counts = notnull(frame.values).sum(axis=axis)
                result = Series(counts, index=frame._get_agg_axis(axis))

        return result.astype('int64')

    def _count_level(self, level, axis=0, numeric_only=False):
        if numeric_only:
            frame = self._get_numeric_data()
        else:
            frame = self

        count_axis = frame._get_axis(axis)
        agg_axis = frame._get_agg_axis(axis)

        if not isinstance(count_axis, MultiIndex):
            raise TypeError("Can only count levels on hierarchical %s." %
                            self._get_axis_name(axis))

        if frame._is_mixed_type:
            # Since we have mixed types, calling notnull(frame.values) might
            # upcast everything to object
            mask = notnull(frame).values
        else:
            # But use the speedup when we have homogeneous dtypes
            mask = notnull(frame.values)

        if axis == 1:
            # We're transposing the mask rather than frame to avoid potential
            # upcasts to object, which induces a ~20x slowdown
            mask = mask.T

        if isinstance(level, compat.string_types):
            level = count_axis._get_level_number(level)

        level_index = count_axis.levels[level]
        labels = _ensure_int64(count_axis.labels[level])
        counts = lib.count_level_2d(mask, labels, len(level_index), axis=0)

        result = DataFrame(counts, index=level_index, columns=agg_axis)

        if axis == 1:
            # Undo our earlier transpose
            return result.T
        else:
            return result

    def _reduce(self, op, name, axis=0, skipna=True, numeric_only=None,
                filter_type=None, **kwds):
        axis = self._get_axis_number(axis)

        def f(x):
            return op(x, axis=axis, skipna=skipna, **kwds)

        labels = self._get_agg_axis(axis)

        # exclude timedelta/datetime unless we are uniform types
        if axis == 1 and self._is_mixed_type and self._is_datelike_mixed_type:
            numeric_only = True

        if numeric_only is None:
            try:
                values = self.values
                result = f(values)
            except Exception as e:

                # try by-column first
                if filter_type is None and axis == 0:
                    try:

                        # this can end up with a non-reduction
                        # but not always. if the types are mixed
                        # with datelike then need to make sure a series

                        # we only end up here if we have not specified
                        # numeric_only and yet we have tried a
                        # column-by-column reduction, where we have mixed type.
                        # So let's just do what we can
                        result = self.apply(f, reduce=False,
                                            ignore_failures=True)
                        if result.ndim == self.ndim:
                            result = result.iloc[0]
                        return result
                    except:
                        pass

                if filter_type is None or filter_type == 'numeric':
                    data = self._get_numeric_data()
                elif filter_type == 'bool':
                    data = self._get_bool_data()
                else:  # pragma: no cover
                    e = NotImplementedError("Handling exception with filter_"
                                            "type %s not implemented." %
                                            filter_type)
                    raise_with_traceback(e)
                with np.errstate(all='ignore'):
                    result = f(data.values)
                labels = data._get_agg_axis(axis)
        else:
            if numeric_only:
                if filter_type is None or filter_type == 'numeric':
                    data = self._get_numeric_data()
                elif filter_type == 'bool':
                    data = self._get_bool_data()
                else:  # pragma: no cover
                    msg = ("Generating numeric_only data with filter_type %s"
                           "not supported." % filter_type)
                    raise NotImplementedError(msg)
                values = data.values
                labels = data._get_agg_axis(axis)
            else:
                values = self.values
            result = f(values)

        if hasattr(result, 'dtype') and is_object_dtype(result.dtype):
            try:
                if filter_type is None or filter_type == 'numeric':
                    result = result.astype(np.float64)
                elif filter_type == 'bool' and notnull(result).all():
                    result = result.astype(np.bool_)
            except (ValueError, TypeError):

                # try to coerce to the original dtypes item by item if we can
                if axis == 0:
                    result = coerce_to_dtypes(result, self.dtypes)

        return Series(result, index=labels)

    def nunique(self, axis=0, dropna=True):
        """
        Return Series with number of distinct observations over requested
        axis.

        .. versionadded:: 0.20.0

        Parameters
        ----------
        axis : {0 or 'index', 1 or 'columns'}, default 0
        dropna : boolean, default True
            Don't include NaN in the counts.

        Returns
        -------
        nunique : Series

        Examples
        --------
        >>> df = pd.DataFrame({'A': [1, 2, 3], 'B': [1, 1, 1]})
        >>> df.nunique()
        A    3
        B    1

        >>> df.nunique(axis=1)
        0    1
        1    2
        2    2
        """
        return self.apply(Series.nunique, axis=axis, dropna=dropna)

    def idxmin(self, axis=0, skipna=True):
        """
        Return index of first occurrence of minimum over requested axis.
        NA/null values are excluded.

        Parameters
        ----------
        axis : {0 or 'index', 1 or 'columns'}, default 0
            0 or 'index' for row-wise, 1 or 'columns' for column-wise
        skipna : boolean, default True
            Exclude NA/null values. If an entire row/column is NA, the result
            will be NA

        Returns
        -------
        idxmin : Series

        Notes
        -----
        This method is the DataFrame version of ``ndarray.argmin``.

        See Also
        --------
        Series.idxmin
        """
        axis = self._get_axis_number(axis)
        indices = nanops.nanargmin(self.values, axis=axis, skipna=skipna)
        index = self._get_axis(axis)
        result = [index[i] if i >= 0 else NA for i in indices]
        return Series(result, index=self._get_agg_axis(axis))

    def idxmax(self, axis=0, skipna=True):
        """
        Return index of first occurrence of maximum over requested axis.
        NA/null values are excluded.

        Parameters
        ----------
        axis : {0 or 'index', 1 or 'columns'}, default 0
            0 or 'index' for row-wise, 1 or 'columns' for column-wise
        skipna : boolean, default True
            Exclude NA/null values. If an entire row/column is NA, the result
            will be first index.

        Returns
        -------
        idxmax : Series

        Notes
        -----
        This method is the DataFrame version of ``ndarray.argmax``.

        See Also
        --------
        Series.idxmax
        """
        axis = self._get_axis_number(axis)
        indices = nanops.nanargmax(self.values, axis=axis, skipna=skipna)
        index = self._get_axis(axis)
        result = [index[i] if i >= 0 else NA for i in indices]
        return Series(result, index=self._get_agg_axis(axis))

    def _get_agg_axis(self, axis_num):
        """ let's be explict about this """
        if axis_num == 0:
            return self.columns
        elif axis_num == 1:
            return self.index
        else:
            raise ValueError('Axis must be 0 or 1 (got %r)' % axis_num)

    def mode(self, axis=0, numeric_only=False):
        """
        Gets the mode(s) of each element along the axis selected. Adds a row
        for each mode per label, fills in gaps with nan.

        Note that there could be multiple values returned for the selected
        axis (when more than one item share the maximum frequency), which is
        the reason why a dataframe is returned. If you want to impute missing
        values with the mode in a dataframe ``df``, you can just do this:
        ``df.fillna(df.mode().iloc[0])``

        Parameters
        ----------
        axis : {0 or 'index', 1 or 'columns'}, default 0
            * 0 or 'index' : get mode of each column
            * 1 or 'columns' : get mode of each row
        numeric_only : boolean, default False
            if True, only apply to numeric columns

        Returns
        -------
        modes : DataFrame (sorted)

        Examples
        --------
        >>> df = pd.DataFrame({'A': [1, 2, 1, 2, 1, 2, 3]})
        >>> df.mode()
           A
        0  1
        1  2
        """
        data = self if not numeric_only else self._get_numeric_data()

        def f(s):
            return s.mode()

        return data.apply(f, axis=axis)

    def quantile(self, q=0.5, axis=0, numeric_only=True,
                 interpolation='linear'):
        """
        Return values at the given quantile over requested axis, a la
        numpy.percentile.

        Parameters
        ----------
        q : float or array-like, default 0.5 (50% quantile)
            0 <= q <= 1, the quantile(s) to compute
        axis : {0, 1, 'index', 'columns'} (default 0)
            0 or 'index' for row-wise, 1 or 'columns' for column-wise
        interpolation : {'linear', 'lower', 'higher', 'midpoint', 'nearest'}
            .. versionadded:: 0.18.0

            This optional parameter specifies the interpolation method to use,
            when the desired quantile lies between two data points `i` and `j`:

            * linear: `i + (j - i) * fraction`, where `fraction` is the
              fractional part of the index surrounded by `i` and `j`.
            * lower: `i`.
            * higher: `j`.
            * nearest: `i` or `j` whichever is nearest.
            * midpoint: (`i` + `j`) / 2.

        Returns
        -------
        quantiles : Series or DataFrame

            - If ``q`` is an array, a DataFrame will be returned where the
              index is ``q``, the columns are the columns of self, and the
              values are the quantiles.
            - If ``q`` is a float, a Series will be returned where the
              index is the columns of self and the values are the quantiles.

        Examples
        --------

        >>> df = DataFrame(np.array([[1, 1], [2, 10], [3, 100], [4, 100]]),
                           columns=['a', 'b'])
        >>> df.quantile(.1)
        a    1.3
        b    3.7
        dtype: float64
        >>> df.quantile([.1, .5])
               a     b
        0.1  1.3   3.7
        0.5  2.5  55.0
        """
        self._check_percentile(q)

        data = self._get_numeric_data() if numeric_only else self
        axis = self._get_axis_number(axis)
        is_transposed = axis == 1

        if is_transposed:
            data = data.T

        result = data._data.quantile(qs=q,
                                     axis=1,
                                     interpolation=interpolation,
                                     transposed=is_transposed)

        if result.ndim == 2:
            result = self._constructor(result)
        else:
            result = self._constructor_sliced(result, name=q)

        if is_transposed:
            result = result.T

        return result

    def to_timestamp(self, freq=None, how='start', axis=0, copy=True):
        """
        Cast to DatetimeIndex of timestamps, at *beginning* of period

        Parameters
        ----------
        freq : string, default frequency of PeriodIndex
            Desired frequency
        how : {'s', 'e', 'start', 'end'}
            Convention for converting period to timestamp; start of period
            vs. end
        axis : {0 or 'index', 1 or 'columns'}, default 0
            The axis to convert (the index by default)
        copy : boolean, default True
            If false then underlying input data is not copied

        Returns
        -------
        df : DataFrame with DatetimeIndex
        """
        new_data = self._data
        if copy:
            new_data = new_data.copy()

        axis = self._get_axis_number(axis)
        if axis == 0:
            new_data.set_axis(1, self.index.to_timestamp(freq=freq, how=how))
        elif axis == 1:
            new_data.set_axis(0, self.columns.to_timestamp(freq=freq, how=how))
        else:  # pragma: no cover
            raise AssertionError('Axis must be 0 or 1. Got %s' % str(axis))

        return self._constructor(new_data)

    def to_period(self, freq=None, axis=0, copy=True):
        """
        Convert DataFrame from DatetimeIndex to PeriodIndex with desired
        frequency (inferred from index if not passed)

        Parameters
        ----------
        freq : string, default
        axis : {0 or 'index', 1 or 'columns'}, default 0
            The axis to convert (the index by default)
        copy : boolean, default True
            If False then underlying input data is not copied

        Returns
        -------
        ts : TimeSeries with PeriodIndex
        """
        new_data = self._data
        if copy:
            new_data = new_data.copy()

        axis = self._get_axis_number(axis)
        if axis == 0:
            new_data.set_axis(1, self.index.to_period(freq=freq))
        elif axis == 1:
            new_data.set_axis(0, self.columns.to_period(freq=freq))
        else:  # pragma: no cover
            raise AssertionError('Axis must be 0 or 1. Got %s' % str(axis))

        return self._constructor(new_data)

    def isin(self, values):
        """
        Return boolean DataFrame showing whether each element in the
        DataFrame is contained in values.

        Parameters
        ----------
        values : iterable, Series, DataFrame or dictionary
            The result will only be true at a location if all the
            labels match. If `values` is a Series, that's the index. If
            `values` is a dictionary, the keys must be the column names,
            which must match. If `values` is a DataFrame,
            then both the index and column labels must match.

        Returns
        -------

        DataFrame of booleans

        Examples
        --------
        When ``values`` is a list:

        >>> df = DataFrame({'A': [1, 2, 3], 'B': ['a', 'b', 'f']})
        >>> df.isin([1, 3, 12, 'a'])
               A      B
        0   True   True
        1  False  False
        2   True  False

        When ``values`` is a dict:

        >>> df = DataFrame({'A': [1, 2, 3], 'B': [1, 4, 7]})
        >>> df.isin({'A': [1, 3], 'B': [4, 7, 12]})
               A      B
        0   True  False  # Note that B didn't match the 1 here.
        1  False   True
        2   True   True

        When ``values`` is a Series or DataFrame:

        >>> df = DataFrame({'A': [1, 2, 3], 'B': ['a', 'b', 'f']})
        >>> other = DataFrame({'A': [1, 3, 3, 2], 'B': ['e', 'f', 'f', 'e']})
        >>> df.isin(other)
               A      B
        0   True  False
        1  False  False  # Column A in `other` has a 3, but not at index 1.
        2   True   True
        """
        if isinstance(values, dict):
            from collections import defaultdict
            from pandas.core.reshape.concat import concat
            values = defaultdict(list, values)
            return concat((self.iloc[:, [i]].isin(values[col])
                           for i, col in enumerate(self.columns)), axis=1)
        elif isinstance(values, Series):
            if not values.index.is_unique:
                raise ValueError("cannot compute isin with "
                                 "a duplicate axis.")
            return self.eq(values.reindex_like(self), axis='index')
        elif isinstance(values, DataFrame):
            if not (values.columns.is_unique and values.index.is_unique):
                raise ValueError("cannot compute isin with "
                                 "a duplicate axis.")
            return self.eq(values.reindex_like(self))
        else:
            if not is_list_like(values):
                raise TypeError("only list-like or dict-like objects are "
                                "allowed to be passed to DataFrame.isin(), "
                                "you passed a "
                                "{0!r}".format(type(values).__name__))
            return DataFrame(
                algorithms.isin(self.values.ravel(),
                                values).reshape(self.shape), self.index,
                self.columns)


DataFrame._setup_axes(['index', 'columns'], info_axis=1, stat_axis=0,
                      axes_are_reversed=True, aliases={'rows': 0})
DataFrame._add_numeric_operations()
DataFrame._add_series_or_dataframe_operations()

_EMPTY_SERIES = Series([])


def _arrays_to_mgr(arrays, arr_names, index, columns, dtype=None):
    """
    Segregate Series based on type and coerce into matrices.
    Needs to handle a lot of exceptional cases.
    """
    # figure out the index, if necessary
    if index is None:
        index = extract_index(arrays)
    else:
        index = _ensure_index(index)

    # don't force copy because getting jammed in an ndarray anyway
    arrays = _homogenize(arrays, index, dtype)

    # from BlockManager perspective
    axes = [_ensure_index(columns), _ensure_index(index)]

    return create_block_manager_from_arrays(arrays, arr_names, axes)


def extract_index(data):
    from pandas.core.index import _union_indexes

    index = None
    if len(data) == 0:
        index = Index([])
    elif len(data) > 0:
        raw_lengths = []
        indexes = []

        have_raw_arrays = False
        have_series = False
        have_dicts = False

        for v in data:
            if isinstance(v, Series):
                have_series = True
                indexes.append(v.index)
            elif isinstance(v, dict):
                have_dicts = True
                indexes.append(list(v.keys()))
            elif is_list_like(v) and getattr(v, 'ndim', 1) == 1:
                have_raw_arrays = True
                raw_lengths.append(len(v))

        if not indexes and not raw_lengths:
            raise ValueError('If using all scalar values, you must pass'
                             ' an index')

        if have_series or have_dicts:
            index = _union_indexes(indexes)

        if have_raw_arrays:
            lengths = list(set(raw_lengths))
            if len(lengths) > 1:
                raise ValueError('arrays must all be same length')

            if have_dicts:
                raise ValueError('Mixing dicts with non-Series may lead to '
                                 'ambiguous ordering.')

            if have_series:
                if lengths[0] != len(index):
                    msg = ('array length %d does not match index length %d' %
                           (lengths[0], len(index)))
                    raise ValueError(msg)
            else:
                index = _default_index(lengths[0])

    return _ensure_index(index)


def _prep_ndarray(values, copy=True):
    if not isinstance(values, (np.ndarray, Series, Index)):
        if len(values) == 0:
            return np.empty((0, 0), dtype=object)

        def convert(v):
            return maybe_convert_platform(v)

        # we could have a 1-dim or 2-dim list here
        # this is equiv of np.asarray, but does object conversion
        # and platform dtype preservation
        try:
            if is_list_like(values[0]) or hasattr(values[0], 'len'):
                values = np.array([convert(v) for v in values])
            else:
                values = convert(values)
        except:
            values = convert(values)

    else:

        # drop subclass info, do not copy data
        values = np.asarray(values)
        if copy:
            values = values.copy()

    if values.ndim == 1:
        values = values.reshape((values.shape[0], 1))
    elif values.ndim != 2:
        raise ValueError('Must pass 2-d input')

    return values


def _to_arrays(data, columns, coerce_float=False, dtype=None):
    """
    Return list of arrays, columns
    """
    if isinstance(data, DataFrame):
        if columns is not None:
            arrays = [data._ixs(i, axis=1).values
                      for i, col in enumerate(data.columns) if col in columns]
        else:
            columns = data.columns
            arrays = [data._ixs(i, axis=1).values for i in range(len(columns))]

        return arrays, columns

    if not len(data):
        if isinstance(data, np.ndarray):
            columns = data.dtype.names
            if columns is not None:
                return [[]] * len(columns), columns
        return [], []  # columns if columns is not None else []
    if isinstance(data[0], (list, tuple)):
        return _list_to_arrays(data, columns, coerce_float=coerce_float,
                               dtype=dtype)
    elif isinstance(data[0], collections.Mapping):
        return _list_of_dict_to_arrays(data, columns,
                                       coerce_float=coerce_float, dtype=dtype)
    elif isinstance(data[0], Series):
        return _list_of_series_to_arrays(data, columns,
                                         coerce_float=coerce_float,
                                         dtype=dtype)
    elif isinstance(data[0], Categorical):
        if columns is None:
            columns = _default_index(len(data))
        return data, columns
    elif (isinstance(data, (np.ndarray, Series, Index)) and
          data.dtype.names is not None):

        columns = list(data.dtype.names)
        arrays = [data[k] for k in columns]
        return arrays, columns
    else:
        # last ditch effort
        data = lmap(tuple, data)
        return _list_to_arrays(data, columns, coerce_float=coerce_float,
                               dtype=dtype)


def _masked_rec_array_to_mgr(data, index, columns, dtype, copy):
    """ extract from a masked rec array and create the manager """

    # essentially process a record array then fill it
    fill_value = data.fill_value
    fdata = ma.getdata(data)
    if index is None:
        index = _get_names_from_index(fdata)
        if index is None:
            index = _default_index(len(data))
    index = _ensure_index(index)

    if columns is not None:
        columns = _ensure_index(columns)
    arrays, arr_columns = _to_arrays(fdata, columns)

    # fill if needed
    new_arrays = []
    for fv, arr, col in zip(fill_value, arrays, arr_columns):
        mask = ma.getmaskarray(data[col])
        if mask.any():
            arr, fv = maybe_upcast(arr, fill_value=fv, copy=True)
            arr[mask] = fv
        new_arrays.append(arr)

    # create the manager
    arrays, arr_columns = _reorder_arrays(new_arrays, arr_columns, columns)
    if columns is None:
        columns = arr_columns

    mgr = _arrays_to_mgr(arrays, arr_columns, index, columns)

    if copy:
        mgr = mgr.copy()
    return mgr


def _reorder_arrays(arrays, arr_columns, columns):
    # reorder according to the columns
    if (columns is not None and len(columns) and arr_columns is not None and
            len(arr_columns)):
        indexer = _ensure_index(arr_columns).get_indexer(columns)
        arr_columns = _ensure_index([arr_columns[i] for i in indexer])
        arrays = [arrays[i] for i in indexer]
    return arrays, arr_columns


def _list_to_arrays(data, columns, coerce_float=False, dtype=None):
    if len(data) > 0 and isinstance(data[0], tuple):
        content = list(lib.to_object_array_tuples(data).T)
    else:
        # list of lists
        content = list(lib.to_object_array(data).T)
    return _convert_object_array(content, columns, dtype=dtype,
                                 coerce_float=coerce_float)


def _list_of_series_to_arrays(data, columns, coerce_float=False, dtype=None):
    from pandas.core.index import _get_combined_index

    if columns is None:
        columns = _get_combined_index([
            s.index for s in data if getattr(s, 'index', None) is not None
        ])

    indexer_cache = {}

    aligned_values = []
    for s in data:
        index = getattr(s, 'index', None)
        if index is None:
            index = _default_index(len(s))

        if id(index) in indexer_cache:
            indexer = indexer_cache[id(index)]
        else:
            indexer = indexer_cache[id(index)] = index.get_indexer(columns)

        values = _values_from_object(s)
        aligned_values.append(algorithms.take_1d(values, indexer))

    values = np.vstack(aligned_values)

    if values.dtype == np.object_:
        content = list(values.T)
        return _convert_object_array(content, columns, dtype=dtype,
                                     coerce_float=coerce_float)
    else:
        return values.T, columns


def _list_of_dict_to_arrays(data, columns, coerce_float=False, dtype=None):
    if columns is None:
        gen = (list(x.keys()) for x in data)
        sort = not any(isinstance(d, OrderedDict) for d in data)
        columns = lib.fast_unique_multiple_list_gen(gen, sort=sort)

    # assure that they are of the base dict class and not of derived
    # classes
    data = [(type(d) is dict) and d or dict(d) for d in data]

    content = list(lib.dicts_to_array(data, list(columns)).T)
    return _convert_object_array(content, columns, dtype=dtype,
                                 coerce_float=coerce_float)


def _convert_object_array(content, columns, coerce_float=False, dtype=None):
    if columns is None:
        columns = _default_index(len(content))
    else:
        if len(columns) != len(content):  # pragma: no cover
            # caller's responsibility to check for this...
            raise AssertionError('%d columns passed, passed data had %s '
                                 'columns' % (len(columns), len(content)))

    # provide soft conversion of object dtypes
    def convert(arr):
        if dtype != object and dtype != np.object:
            arr = lib.maybe_convert_objects(arr, try_float=coerce_float)
            arr = maybe_cast_to_datetime(arr, dtype)
        return arr

    arrays = [convert(arr) for arr in content]

    return arrays, columns


def _get_names_from_index(data):
    has_some_name = any([getattr(s, 'name', None) is not None for s in data])
    if not has_some_name:
        return _default_index(len(data))

    index = lrange(len(data))
    count = 0
    for i, s in enumerate(data):
        n = getattr(s, 'name', None)
        if n is not None:
            index[i] = n
        else:
            index[i] = 'Unnamed %d' % count
            count += 1

    return index


def _homogenize(data, index, dtype=None):
    from pandas.core.series import _sanitize_array

    oindex = None
    homogenized = []

    for v in data:
        if isinstance(v, Series):
            if dtype is not None:
                v = v.astype(dtype)
            if v.index is not index:
                # Forces alignment. No need to copy data since we
                # are putting it into an ndarray later
                v = v.reindex(index, copy=False)
        else:
            if isinstance(v, dict):
                if oindex is None:
                    oindex = index.astype('O')

                if isinstance(index, (DatetimeIndex, TimedeltaIndex)):
                    v = _dict_compat(v)
                else:
                    v = dict(v)
                v = lib.fast_multiget(v, oindex.values, default=NA)
            v = _sanitize_array(v, index, dtype=dtype, copy=False,
                                raise_cast_failure=False)

        homogenized.append(v)

    return homogenized


def _from_nested_dict(data):
    # TODO: this should be seriously cythonized
    new_data = OrderedDict()
    for index, s in compat.iteritems(data):
        for col, v in compat.iteritems(s):
            new_data[col] = new_data.get(col, OrderedDict())
            new_data[col][index] = v
    return new_data


def _put_str(s, space):
    return ('%s' % s)[:space].ljust(space)


# ----------------------------------------------------------------------
# Add plotting methods to DataFrame
DataFrame.plot = base.AccessorProperty(gfx.FramePlotMethods,
                                       gfx.FramePlotMethods)
DataFrame.hist = gfx.hist_frame


@Appender(_shared_docs['boxplot'] % _shared_doc_kwargs)
def boxplot(self, column=None, by=None, ax=None, fontsize=None, rot=0,
            grid=True, figsize=None, layout=None, return_type=None, **kwds):
    from pandas.plotting._core import boxplot
    import matplotlib.pyplot as plt
    ax = boxplot(self, column=column, by=by, ax=ax, fontsize=fontsize,
                 grid=grid, rot=rot, figsize=figsize, layout=layout,
                 return_type=return_type, **kwds)
    plt.draw_if_interactive()
    return ax


DataFrame.boxplot = boxplot

ops.add_flex_arithmetic_methods(DataFrame, **ops.frame_flex_funcs)
ops.add_special_arithmetic_methods(DataFrame, **ops.frame_special_funcs)
