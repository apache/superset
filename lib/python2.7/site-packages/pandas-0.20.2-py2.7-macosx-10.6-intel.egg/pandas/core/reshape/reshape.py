# pylint: disable=E1101,E1103
# pylint: disable=W0703,W0622,W0613,W0201
from pandas.compat import range, zip
from pandas import compat
import itertools
import re

import numpy as np

from pandas.core.dtypes.common import (
    _ensure_platform_int,
    is_list_like, is_bool_dtype,
    needs_i8_conversion)
from pandas.core.dtypes.cast import maybe_promote
from pandas.core.dtypes.missing import notnull
import pandas.core.dtypes.concat as _concat

from pandas.core.series import Series
from pandas.core.frame import DataFrame

from pandas.core.sparse.api import SparseDataFrame, SparseSeries
from pandas.core.sparse.array import SparseArray
from pandas._libs.sparse import IntIndex

from pandas.core.categorical import Categorical, _factorize_from_iterable
from pandas.core.sorting import (get_group_index, get_compressed_ids,
                                 compress_group_index, decons_obs_group_ids)

import pandas.core.algorithms as algos
from pandas._libs import algos as _algos, reshape as _reshape

from pandas.core.frame import _shared_docs
from pandas.util._decorators import Appender
from pandas.core.index import MultiIndex, _get_na_value


class _Unstacker(object):
    """
    Helper class to unstack data / pivot with multi-level index

    Parameters
    ----------
    level : int or str, default last level
        Level to "unstack". Accepts a name for the level.

    Examples
    --------
    >>> import pandas as pd
    >>> index = pd.MultiIndex.from_tuples([('one', 'a'), ('one', 'b'),
    ...                                    ('two', 'a'), ('two', 'b')])
    >>> s = pd.Series(np.arange(1.0, 5.0), index=index)
    >>> s
    one  a   1
         b   2
    two  a   3
         b   4
    dtype: float64

    >>> s.unstack(level=-1)
         a   b
    one  1  2
    two  3  4

    >>> s.unstack(level=0)
       one  two
    a  1   2
    b  3   4

    Returns
    -------
    unstacked : DataFrame
    """

    def __init__(self, values, index, level=-1, value_columns=None,
                 fill_value=None):

        self.is_categorical = None
        if values.ndim == 1:
            if isinstance(values, Categorical):
                self.is_categorical = values
                values = np.array(values)
            values = values[:, np.newaxis]
        self.values = values
        self.value_columns = value_columns
        self.fill_value = fill_value

        if value_columns is None and values.shape[1] != 1:  # pragma: no cover
            raise ValueError('must pass column labels for multi-column data')

        self.index = index

        if isinstance(self.index, MultiIndex):
            if index._reference_duplicate_name(level):
                msg = ("Ambiguous reference to {0}. The index "
                       "names are not unique.".format(level))
                raise ValueError(msg)

        self.level = self.index._get_level_number(level)

        # when index includes `nan`, need to lift levels/strides by 1
        self.lift = 1 if -1 in self.index.labels[self.level] else 0

        self.new_index_levels = list(index.levels)
        self.new_index_names = list(index.names)

        self.removed_name = self.new_index_names.pop(self.level)
        self.removed_level = self.new_index_levels.pop(self.level)

        self._make_sorted_values_labels()
        self._make_selectors()

    def _make_sorted_values_labels(self):
        v = self.level

        labs = list(self.index.labels)
        levs = list(self.index.levels)
        to_sort = labs[:v] + labs[v + 1:] + [labs[v]]
        sizes = [len(x) for x in levs[:v] + levs[v + 1:] + [levs[v]]]

        comp_index, obs_ids = get_compressed_ids(to_sort, sizes)
        ngroups = len(obs_ids)

        indexer = _algos.groupsort_indexer(comp_index, ngroups)[0]
        indexer = _ensure_platform_int(indexer)

        self.sorted_values = algos.take_nd(self.values, indexer, axis=0)
        self.sorted_labels = [l.take(indexer) for l in to_sort]

    def _make_selectors(self):
        new_levels = self.new_index_levels

        # make the mask
        remaining_labels = self.sorted_labels[:-1]
        level_sizes = [len(x) for x in new_levels]

        comp_index, obs_ids = get_compressed_ids(remaining_labels, level_sizes)
        ngroups = len(obs_ids)

        comp_index = _ensure_platform_int(comp_index)
        stride = self.index.levshape[self.level] + self.lift
        self.full_shape = ngroups, stride

        selector = self.sorted_labels[-1] + stride * comp_index + self.lift
        mask = np.zeros(np.prod(self.full_shape), dtype=bool)
        mask.put(selector, True)

        if mask.sum() < len(self.index):
            raise ValueError('Index contains duplicate entries, '
                             'cannot reshape')

        self.group_index = comp_index
        self.mask = mask
        self.unique_groups = obs_ids
        self.compressor = comp_index.searchsorted(np.arange(ngroups))

    def get_result(self):
        # TODO: find a better way than this masking business

        values, value_mask = self.get_new_values()
        columns = self.get_new_columns()
        index = self.get_new_index()

        # filter out missing levels
        if values.shape[1] > 0:
            col_inds, obs_ids = compress_group_index(self.sorted_labels[-1])
            # rare case, level values not observed
            if len(obs_ids) < self.full_shape[1]:
                inds = (value_mask.sum(0) > 0).nonzero()[0]
                values = algos.take_nd(values, inds, axis=1)
                columns = columns[inds]

        # may need to coerce categoricals here
        if self.is_categorical is not None:
            categories = self.is_categorical.categories
            ordered = self.is_categorical.ordered
            values = [Categorical(values[:, i], categories=categories,
                                  ordered=ordered)
                      for i in range(values.shape[-1])]

        return DataFrame(values, index=index, columns=columns)

    def get_new_values(self):
        values = self.values

        # place the values
        length, width = self.full_shape
        stride = values.shape[1]
        result_width = width * stride
        result_shape = (length, result_width)
        mask = self.mask
        mask_all = mask.all()

        # we can simply reshape if we don't have a mask
        if mask_all and len(values):
            new_values = (self.sorted_values
                              .reshape(length, width, stride)
                              .swapaxes(1, 2)
                              .reshape(result_shape)
                          )
            new_mask = np.ones(result_shape, dtype=bool)
            return new_values, new_mask

        # if our mask is all True, then we can use our existing dtype
        if mask_all:
            dtype = values.dtype
            new_values = np.empty(result_shape, dtype=dtype)
        else:
            dtype, fill_value = maybe_promote(values.dtype, self.fill_value)
            new_values = np.empty(result_shape, dtype=dtype)
            new_values.fill(fill_value)

        new_mask = np.zeros(result_shape, dtype=bool)

        name = np.dtype(dtype).name
        sorted_values = self.sorted_values

        # we need to convert to a basic dtype
        # and possibly coerce an input to our output dtype
        # e.g. ints -> floats
        if needs_i8_conversion(values):
            sorted_values = sorted_values.view('i8')
            new_values = new_values.view('i8')
            name = 'int64'
        elif is_bool_dtype(values):
            sorted_values = sorted_values.astype('object')
            new_values = new_values.astype('object')
            name = 'object'
        else:
            sorted_values = sorted_values.astype(name, copy=False)

        # fill in our values & mask
        f = getattr(_reshape, "unstack_{}".format(name))
        f(sorted_values,
          mask.view('u1'),
          stride,
          length,
          width,
          new_values,
          new_mask.view('u1'))

        # reconstruct dtype if needed
        if needs_i8_conversion(values):
            new_values = new_values.view(values.dtype)

        return new_values, new_mask

    def get_new_columns(self):
        if self.value_columns is None:
            if self.lift == 0:
                return self.removed_level

            lev = self.removed_level
            return lev.insert(0, _get_na_value(lev.dtype.type))

        stride = len(self.removed_level) + self.lift
        width = len(self.value_columns)
        propagator = np.repeat(np.arange(width), stride)
        if isinstance(self.value_columns, MultiIndex):
            new_levels = self.value_columns.levels + (self.removed_level,)
            new_names = self.value_columns.names + (self.removed_name,)

            new_labels = [lab.take(propagator)
                          for lab in self.value_columns.labels]
        else:
            new_levels = [self.value_columns, self.removed_level]
            new_names = [self.value_columns.name, self.removed_name]
            new_labels = [propagator]

        new_labels.append(np.tile(np.arange(stride) - self.lift, width))
        return MultiIndex(levels=new_levels, labels=new_labels,
                          names=new_names, verify_integrity=False)

    def get_new_index(self):
        result_labels = [lab.take(self.compressor)
                         for lab in self.sorted_labels[:-1]]

        # construct the new index
        if len(self.new_index_levels) == 1:
            lev, lab = self.new_index_levels[0], result_labels[0]
            if (lab == -1).any():
                lev = lev.insert(len(lev), _get_na_value(lev.dtype.type))
            return lev.take(lab)

        return MultiIndex(levels=self.new_index_levels, labels=result_labels,
                          names=self.new_index_names, verify_integrity=False)


def _unstack_multiple(data, clocs):
    if len(clocs) == 0:
        return data

    # NOTE: This doesn't deal with hierarchical columns yet

    index = data.index

    clocs = [index._get_level_number(i) for i in clocs]

    rlocs = [i for i in range(index.nlevels) if i not in clocs]

    clevels = [index.levels[i] for i in clocs]
    clabels = [index.labels[i] for i in clocs]
    cnames = [index.names[i] for i in clocs]
    rlevels = [index.levels[i] for i in rlocs]
    rlabels = [index.labels[i] for i in rlocs]
    rnames = [index.names[i] for i in rlocs]

    shape = [len(x) for x in clevels]
    group_index = get_group_index(clabels, shape, sort=False, xnull=False)

    comp_ids, obs_ids = compress_group_index(group_index, sort=False)
    recons_labels = decons_obs_group_ids(comp_ids, obs_ids, shape, clabels,
                                         xnull=False)

    dummy_index = MultiIndex(levels=rlevels + [obs_ids],
                             labels=rlabels + [comp_ids],
                             names=rnames + ['__placeholder__'],
                             verify_integrity=False)

    if isinstance(data, Series):
        dummy = data.copy()
        dummy.index = dummy_index
        unstacked = dummy.unstack('__placeholder__')
        new_levels = clevels
        new_names = cnames
        new_labels = recons_labels
    else:
        if isinstance(data.columns, MultiIndex):
            result = data
            for i in range(len(clocs)):
                val = clocs[i]
                result = result.unstack(val)
                clocs = [v if i > v else v - 1 for v in clocs]

            return result

        dummy = data.copy()
        dummy.index = dummy_index

        unstacked = dummy.unstack('__placeholder__')
        if isinstance(unstacked, Series):
            unstcols = unstacked.index
        else:
            unstcols = unstacked.columns
        new_levels = [unstcols.levels[0]] + clevels
        new_names = [data.columns.name] + cnames

        new_labels = [unstcols.labels[0]]
        for rec in recons_labels:
            new_labels.append(rec.take(unstcols.labels[-1]))

    new_columns = MultiIndex(levels=new_levels, labels=new_labels,
                             names=new_names, verify_integrity=False)

    if isinstance(unstacked, Series):
        unstacked.index = new_columns
    else:
        unstacked.columns = new_columns

    return unstacked


def pivot(self, index=None, columns=None, values=None):
    """
    See DataFrame.pivot
    """
    if values is None:
        cols = [columns] if index is None else [index, columns]
        append = index is None
        indexed = self.set_index(cols, append=append)
        return indexed.unstack(columns)
    else:
        if index is None:
            index = self.index
        else:
            index = self[index]
        indexed = Series(self[values].values,
                         index=MultiIndex.from_arrays([index, self[columns]]))
        return indexed.unstack(columns)


def pivot_simple(index, columns, values):
    """
    Produce 'pivot' table based on 3 columns of this DataFrame.
    Uses unique values from index / columns and fills with values.

    Parameters
    ----------
    index : ndarray
        Labels to use to make new frame's index
    columns : ndarray
        Labels to use to make new frame's columns
    values : ndarray
        Values to use for populating new frame's values

    Notes
    -----
    Obviously, all 3 of the input arguments must have the same length

    Returns
    -------
    DataFrame

    See also
    --------
    DataFrame.pivot_table : generalization of pivot that can handle
        duplicate values for one index/column pair
    """
    if (len(index) != len(columns)) or (len(columns) != len(values)):
        raise AssertionError('Length of index, columns, and values must be the'
                             ' same')

    if len(index) == 0:
        return DataFrame(index=[])

    hindex = MultiIndex.from_arrays([index, columns])
    series = Series(values.ravel(), index=hindex)
    series = series.sort_index(level=0)
    return series.unstack()


def _slow_pivot(index, columns, values):
    """
    Produce 'pivot' table based on 3 columns of this DataFrame.
    Uses unique values from index / columns and fills with values.

    Parameters
    ----------
    index : string or object
        Column name to use to make new frame's index
    columns : string or object
        Column name to use to make new frame's columns
    values : string or object
        Column name to use for populating new frame's values

    Could benefit from some Cython here.
    """
    tree = {}
    for i, (idx, col) in enumerate(zip(index, columns)):
        if col not in tree:
            tree[col] = {}
        branch = tree[col]
        branch[idx] = values[i]

    return DataFrame(tree)


def unstack(obj, level, fill_value=None):
    if isinstance(level, (tuple, list)):
        return _unstack_multiple(obj, level)

    if isinstance(obj, DataFrame):
        if isinstance(obj.index, MultiIndex):
            return _unstack_frame(obj, level, fill_value=fill_value)
        else:
            return obj.T.stack(dropna=False)
    else:
        unstacker = _Unstacker(obj.values, obj.index, level=level,
                               fill_value=fill_value)
        return unstacker.get_result()


def _unstack_frame(obj, level, fill_value=None):
    from pandas.core.internals import BlockManager, make_block

    if obj._is_mixed_type:
        unstacker = _Unstacker(np.empty(obj.shape, dtype=bool),  # dummy
                               obj.index, level=level,
                               value_columns=obj.columns)
        new_columns = unstacker.get_new_columns()
        new_index = unstacker.get_new_index()
        new_axes = [new_columns, new_index]

        new_blocks = []
        mask_blocks = []
        for blk in obj._data.blocks:
            blk_items = obj._data.items[blk.mgr_locs.indexer]
            bunstacker = _Unstacker(blk.values.T, obj.index, level=level,
                                    value_columns=blk_items,
                                    fill_value=fill_value)
            new_items = bunstacker.get_new_columns()
            new_placement = new_columns.get_indexer(new_items)
            new_values, mask = bunstacker.get_new_values()

            mblk = make_block(mask.T, placement=new_placement)
            mask_blocks.append(mblk)

            newb = make_block(new_values.T, placement=new_placement)
            new_blocks.append(newb)

        result = DataFrame(BlockManager(new_blocks, new_axes))
        mask_frame = DataFrame(BlockManager(mask_blocks, new_axes))
        return result.loc[:, mask_frame.sum(0) > 0]
    else:
        unstacker = _Unstacker(obj.values, obj.index, level=level,
                               value_columns=obj.columns,
                               fill_value=fill_value)
        return unstacker.get_result()


def stack(frame, level=-1, dropna=True):
    """
    Convert DataFrame to Series with multi-level Index. Columns become the
    second level of the resulting hierarchical index

    Returns
    -------
    stacked : Series
    """

    def factorize(index):
        if index.is_unique:
            return index, np.arange(len(index))
        codes, categories = _factorize_from_iterable(index)
        return categories, codes

    N, K = frame.shape
    if isinstance(frame.columns, MultiIndex):
        if frame.columns._reference_duplicate_name(level):
            msg = ("Ambiguous reference to {0}. The column "
                   "names are not unique.".format(level))
            raise ValueError(msg)

    # Will also convert negative level numbers and check if out of bounds.
    level_num = frame.columns._get_level_number(level)

    if isinstance(frame.columns, MultiIndex):
        return _stack_multi_columns(frame, level_num=level_num, dropna=dropna)
    elif isinstance(frame.index, MultiIndex):
        new_levels = list(frame.index.levels)
        new_labels = [lab.repeat(K) for lab in frame.index.labels]

        clev, clab = factorize(frame.columns)
        new_levels.append(clev)
        new_labels.append(np.tile(clab, N).ravel())

        new_names = list(frame.index.names)
        new_names.append(frame.columns.name)
        new_index = MultiIndex(levels=new_levels, labels=new_labels,
                               names=new_names, verify_integrity=False)
    else:
        levels, (ilab, clab) = zip(*map(factorize, (frame.index,
                                                    frame.columns)))
        labels = ilab.repeat(K), np.tile(clab, N).ravel()
        new_index = MultiIndex(levels=levels, labels=labels,
                               names=[frame.index.name, frame.columns.name],
                               verify_integrity=False)

    new_values = frame.values.ravel()
    if dropna:
        mask = notnull(new_values)
        new_values = new_values[mask]
        new_index = new_index[mask]
    return Series(new_values, index=new_index)


def stack_multiple(frame, level, dropna=True):
    # If all passed levels match up to column names, no
    # ambiguity about what to do
    if all(lev in frame.columns.names for lev in level):
        result = frame
        for lev in level:
            result = stack(result, lev, dropna=dropna)

    # Otherwise, level numbers may change as each successive level is stacked
    elif all(isinstance(lev, int) for lev in level):
        # As each stack is done, the level numbers decrease, so we need
        #  to account for that when level is a sequence of ints
        result = frame
        # _get_level_number() checks level numbers are in range and converts
        # negative numbers to positive
        level = [frame.columns._get_level_number(lev) for lev in level]

        # Can't iterate directly through level as we might need to change
        # values as we go
        for index in range(len(level)):
            lev = level[index]
            result = stack(result, lev, dropna=dropna)
            # Decrement all level numbers greater than current, as these
            # have now shifted down by one
            updated_level = []
            for other in level:
                if other > lev:
                    updated_level.append(other - 1)
                else:
                    updated_level.append(other)
            level = updated_level

    else:
        raise ValueError("level should contain all level names or all level "
                         "numbers, not a mixture of the two.")

    return result


def _stack_multi_columns(frame, level_num=-1, dropna=True):
    def _convert_level_number(level_num, columns):
        """
        Logic for converting the level number to something we can safely pass
        to swaplevel:

        We generally want to convert the level number into a level name, except
        when columns do not have names, in which case we must leave as a level
        number
        """
        if level_num in columns.names:
            return columns.names[level_num]
        else:
            if columns.names[level_num] is None:
                return level_num
            else:
                return columns.names[level_num]

    this = frame.copy()

    # this makes life much simpler
    if level_num != frame.columns.nlevels - 1:
        # roll levels to put selected level at end
        roll_columns = this.columns
        for i in range(level_num, frame.columns.nlevels - 1):
            # Need to check if the ints conflict with level names
            lev1 = _convert_level_number(i, roll_columns)
            lev2 = _convert_level_number(i + 1, roll_columns)
            roll_columns = roll_columns.swaplevel(lev1, lev2)
        this.columns = roll_columns

    if not this.columns.is_lexsorted():
        # Workaround the edge case where 0 is one of the column names,
        # which interferes with trying to sort based on the first
        # level
        level_to_sort = _convert_level_number(0, this.columns)
        this = this.sort_index(level=level_to_sort, axis=1)

    # tuple list excluding level for grouping columns
    if len(frame.columns.levels) > 2:
        tuples = list(zip(*[lev.take(lab)
                            for lev, lab in zip(this.columns.levels[:-1],
                                                this.columns.labels[:-1])]))
        unique_groups = [key for key, _ in itertools.groupby(tuples)]
        new_names = this.columns.names[:-1]
        new_columns = MultiIndex.from_tuples(unique_groups, names=new_names)
    else:
        new_columns = unique_groups = this.columns.levels[0]

    # time to ravel the values
    new_data = {}
    level_vals = this.columns.levels[-1]
    level_labels = sorted(set(this.columns.labels[-1]))
    level_vals_used = level_vals[level_labels]
    levsize = len(level_labels)
    drop_cols = []
    for key in unique_groups:
        loc = this.columns.get_loc(key)

        # can make more efficient?
        # we almost always return a slice
        # but if unsorted can get a boolean
        # indexer
        if not isinstance(loc, slice):
            slice_len = len(loc)
        else:
            slice_len = loc.stop - loc.start

        if slice_len == 0:
            drop_cols.append(key)
            continue
        elif slice_len != levsize:
            chunk = this.loc[:, this.columns[loc]]
            chunk.columns = level_vals.take(chunk.columns.labels[-1])
            value_slice = chunk.reindex(columns=level_vals_used).values
        else:
            if frame._is_mixed_type:
                value_slice = this.loc[:, this.columns[loc]].values
            else:
                value_slice = this.values[:, loc]

        new_data[key] = value_slice.ravel()

    if len(drop_cols) > 0:
        new_columns = new_columns.difference(drop_cols)

    N = len(this)

    if isinstance(this.index, MultiIndex):
        new_levels = list(this.index.levels)
        new_names = list(this.index.names)
        new_labels = [lab.repeat(levsize) for lab in this.index.labels]
    else:
        new_levels = [this.index]
        new_labels = [np.arange(N).repeat(levsize)]
        new_names = [this.index.name]  # something better?

    new_levels.append(level_vals)
    new_labels.append(np.tile(level_labels, N))
    new_names.append(frame.columns.names[level_num])

    new_index = MultiIndex(levels=new_levels, labels=new_labels,
                           names=new_names, verify_integrity=False)

    result = DataFrame(new_data, index=new_index, columns=new_columns)

    # more efficient way to go about this? can do the whole masking biz but
    # will only save a small amount of time...
    if dropna:
        result = result.dropna(axis=0, how='all')

    return result


@Appender(_shared_docs['melt'] %
          dict(caller='pd.melt(df, ',
               versionadded="",
               other='DataFrame.melt'))
def melt(frame, id_vars=None, value_vars=None, var_name=None,
         value_name='value', col_level=None):
    # TODO: what about the existing index?
    if id_vars is not None:
        if not is_list_like(id_vars):
            id_vars = [id_vars]
        elif (isinstance(frame.columns, MultiIndex) and
              not isinstance(id_vars, list)):
            raise ValueError('id_vars must be a list of tuples when columns'
                             ' are a MultiIndex')
        else:
            id_vars = list(id_vars)
    else:
        id_vars = []

    if value_vars is not None:
        if not is_list_like(value_vars):
            value_vars = [value_vars]
        elif (isinstance(frame.columns, MultiIndex) and
              not isinstance(value_vars, list)):
            raise ValueError('value_vars must be a list of tuples when'
                             ' columns are a MultiIndex')
        else:
            value_vars = list(value_vars)
        frame = frame.loc[:, id_vars + value_vars]
    else:
        frame = frame.copy()

    if col_level is not None:  # allow list or other?
        # frame is a copy
        frame.columns = frame.columns.get_level_values(col_level)

    if var_name is None:
        if isinstance(frame.columns, MultiIndex):
            if len(frame.columns.names) == len(set(frame.columns.names)):
                var_name = frame.columns.names
            else:
                var_name = ['variable_%s' % i
                            for i in range(len(frame.columns.names))]
        else:
            var_name = [frame.columns.name if frame.columns.name is not None
                        else 'variable']
    if isinstance(var_name, compat.string_types):
        var_name = [var_name]

    N, K = frame.shape
    K -= len(id_vars)

    mdata = {}
    for col in id_vars:
        mdata[col] = np.tile(frame.pop(col).values, K)

    mcolumns = id_vars + var_name + [value_name]

    mdata[value_name] = frame.values.ravel('F')
    for i, col in enumerate(var_name):
        # asanyarray will keep the columns as an Index
        mdata[col] = np.asanyarray(frame.columns
                                   ._get_level_values(i)).repeat(N)

    return DataFrame(mdata, columns=mcolumns)


def lreshape(data, groups, dropna=True, label=None):
    """
    Reshape long-format data to wide. Generalized inverse of DataFrame.pivot

    Parameters
    ----------
    data : DataFrame
    groups : dict
        {new_name : list_of_columns}
    dropna : boolean, default True

    Examples
    --------
    >>> import pandas as pd
    >>> data = pd.DataFrame({'hr1': [514, 573], 'hr2': [545, 526],
    ...                      'team': ['Red Sox', 'Yankees'],
    ...                      'year1': [2007, 2008], 'year2': [2008, 2008]})
    >>> data
       hr1  hr2     team  year1  year2
    0  514  545  Red Sox   2007   2008
    1  573  526  Yankees   2007   2008

    >>> pd.lreshape(data, {'year': ['year1', 'year2'], 'hr': ['hr1', 'hr2']})
          team   hr  year
    0  Red Sox  514  2007
    1  Yankees  573  2007
    2  Red Sox  545  2008
    3  Yankees  526  2008

    Returns
    -------
    reshaped : DataFrame
    """
    if isinstance(groups, dict):
        keys = list(groups.keys())
        values = list(groups.values())
    else:
        keys, values = zip(*groups)

    all_cols = list(set.union(*[set(x) for x in values]))
    id_cols = list(data.columns.difference(all_cols))

    K = len(values[0])

    for seq in values:
        if len(seq) != K:
            raise ValueError('All column lists must be same length')

    mdata = {}
    pivot_cols = []

    for target, names in zip(keys, values):
        to_concat = [data[col].values for col in names]
        mdata[target] = _concat._concat_compat(to_concat)
        pivot_cols.append(target)

    for col in id_cols:
        mdata[col] = np.tile(data[col].values, K)

    if dropna:
        mask = np.ones(len(mdata[pivot_cols[0]]), dtype=bool)
        for c in pivot_cols:
            mask &= notnull(mdata[c])
        if not mask.all():
            mdata = dict((k, v[mask]) for k, v in compat.iteritems(mdata))

    return DataFrame(mdata, columns=id_cols + pivot_cols)


def wide_to_long(df, stubnames, i, j, sep="", suffix='\d+'):
    r"""
    Wide panel to long format. Less flexible but more user-friendly than melt.

    With stubnames ['A', 'B'], this function expects to find one or more
    group of columns with format Asuffix1, Asuffix2,..., Bsuffix1, Bsuffix2,...
    You specify what you want to call this suffix in the resulting long format
    with `j` (for example `j='year'`)

    Each row of these wide variables are assumed to be uniquely identified by
    `i` (can be a single column name or a list of column names)

    All remaining variables in the data frame are left intact.

    Parameters
    ----------
    df : DataFrame
        The wide-format DataFrame
    stubnames : str or list-like
        The stub name(s). The wide format variables are assumed to
        start with the stub names.
    i : str or list-like
        Column(s) to use as id variable(s)
    j : str
        The name of the subobservation variable. What you wish to name your
        suffix in the long format.
    sep : str, default ""
        A character indicating the separation of the variable names
        in the wide format, to be stripped from the names in the long format.
        For example, if your column names are A-suffix1, A-suffix2, you
        can strip the hypen by specifying `sep='-'`

        .. versionadded:: 0.20.0

    suffix : str, default '\\d+'
        A regular expression capturing the wanted suffixes. '\\d+' captures
        numeric suffixes. Suffixes with no numbers could be specified with the
        negated character class '\\D+'. You can also further disambiguate
        suffixes, for example, if your wide variables are of the form
        Aone, Btwo,.., and you have an unrelated column Arating, you can
        ignore the last one by specifying `suffix='(!?one|two)'`

        .. versionadded:: 0.20.0

    Returns
    -------
    DataFrame
        A DataFrame that contains each stub name as a variable, with new index
        (i, j)

    Examples
    --------
    >>> import pandas as pd
    >>> import numpy as np
    >>> np.random.seed(123)
    >>> df = pd.DataFrame({"A1970" : {0 : "a", 1 : "b", 2 : "c"},
    ...                    "A1980" : {0 : "d", 1 : "e", 2 : "f"},
    ...                    "B1970" : {0 : 2.5, 1 : 1.2, 2 : .7},
    ...                    "B1980" : {0 : 3.2, 1 : 1.3, 2 : .1},
    ...                    "X"     : dict(zip(range(3), np.random.randn(3)))
    ...                   })
    >>> df["id"] = df.index
    >>> df
    A1970 A1980  B1970  B1980         X  id
    0     a     d    2.5    3.2 -1.085631   0
    1     b     e    1.2    1.3  0.997345   1
    2     c     f    0.7    0.1  0.282978   2
    >>> pd.wide_to_long(df, ["A", "B"], i="id", j="year")
                    X  A    B
    id year
    0  1970 -1.085631  a  2.5
    1  1970  0.997345  b  1.2
    2  1970  0.282978  c  0.7
    0  1980 -1.085631  d  3.2
    1  1980  0.997345  e  1.3
    2  1980  0.282978  f  0.1

    With multuple id columns

    >>> df = pd.DataFrame({
    ...     'famid': [1, 1, 1, 2, 2, 2, 3, 3, 3],
    ...     'birth': [1, 2, 3, 1, 2, 3, 1, 2, 3],
    ...     'ht1': [2.8, 2.9, 2.2, 2, 1.8, 1.9, 2.2, 2.3, 2.1],
    ...     'ht2': [3.4, 3.8, 2.9, 3.2, 2.8, 2.4, 3.3, 3.4, 2.9]
    ... })
    >>> df
       birth  famid  ht1  ht2
    0      1      1  2.8  3.4
    1      2      1  2.9  3.8
    2      3      1  2.2  2.9
    3      1      2  2.0  3.2
    4      2      2  1.8  2.8
    5      3      2  1.9  2.4
    6      1      3  2.2  3.3
    7      2      3  2.3  3.4
    8      3      3  2.1  2.9
    >>> l = pd.wide_to_long(df, stubnames='ht', i=['famid', 'birth'], j='age')
    >>> l
                      ht
    famid birth age
    1     1     1    2.8
                2    3.4
          2     1    2.9
                2    3.8
          3     1    2.2
                2    2.9
    2     1     1    2.0
                2    3.2
          2     1    1.8
                2    2.8
          3     1    1.9
                2    2.4
    3     1     1    2.2
                2    3.3
          2     1    2.3
                2    3.4
          3     1    2.1
                2    2.9

    Going from long back to wide just takes some creative use of `unstack`

    >>> w = l.reset_index().set_index(['famid', 'birth', 'age']).unstack()
    >>> w.columns = pd.Index(w.columns).str.join('')
    >>> w.reset_index()
       famid  birth  ht1  ht2
    0      1      1  2.8  3.4
    1      1      2  2.9  3.8
    2      1      3  2.2  2.9
    3      2      1  2.0  3.2
    4      2      2  1.8  2.8
    5      2      3  1.9  2.4
    6      3      1  2.2  3.3
    7      3      2  2.3  3.4
    8      3      3  2.1  2.9

    Less wieldy column names are also handled

    >>> df = pd.DataFrame({'A(quarterly)-2010': np.random.rand(3),
    ...                    'A(quarterly)-2011': np.random.rand(3),
    ...                    'B(quarterly)-2010': np.random.rand(3),
    ...                    'B(quarterly)-2011': np.random.rand(3),
    ...                    'X' : np.random.randint(3, size=3)})
    >>> df['id'] = df.index
    >>> df
      A(quarterly)-2010 A(quarterly)-2011 B(quarterly)-2010 B(quarterly)-2011
    0          0.531828          0.724455          0.322959          0.293714
    1          0.634401          0.611024          0.361789          0.630976
    2          0.849432          0.722443          0.228263          0.092105
    \
       X  id
    0  0   0
    1  1   1
    2  2   2
    >>> pd.wide_to_long(df, ['A(quarterly)', 'B(quarterly)'],
                        i='id', j='year', sep='-')
             X     A(quarterly)  B(quarterly)
    id year
    0  2010  0       0.531828       0.322959
    1  2010  2       0.634401       0.361789
    2  2010  2       0.849432       0.228263
    0  2011  0       0.724455       0.293714
    1  2011  2       0.611024       0.630976
    2  2011  2       0.722443       0.092105

    If we have many columns, we could also use a regex to find our
    stubnames and pass that list on to wide_to_long

    >>> stubnames = set([match[0] for match in
                        df.columns.str.findall('[A-B]\(.*\)').values
                        if match != [] ])
    >>> list(stubnames)
    ['B(quarterly)', 'A(quarterly)']

    Notes
    -----
    All extra variables are left untouched. This simply uses
    `pandas.melt` under the hood, but is hard-coded to "do the right thing"
    in a typicaly case.
    """
    def get_var_names(df, stub, sep, suffix):
        regex = "^{0}{1}{2}".format(re.escape(stub), re.escape(sep), suffix)
        return df.filter(regex=regex).columns.tolist()

    def melt_stub(df, stub, i, j, value_vars, sep):
        newdf = melt(df, id_vars=i, value_vars=value_vars,
                     value_name=stub.rstrip(sep), var_name=j)
        newdf[j] = Categorical(newdf[j])
        newdf[j] = newdf[j].str.replace(re.escape(stub + sep), "")

        return newdf.set_index(i + [j])

    if any(map(lambda s: s in df.columns.tolist(), stubnames)):
        raise ValueError("stubname can't be identical to a column name")

    if not is_list_like(stubnames):
        stubnames = [stubnames]
    else:
        stubnames = list(stubnames)

    if not is_list_like(i):
        i = [i]
    else:
        i = list(i)

    if df[i].duplicated().any():
        raise ValueError("the id variables need to uniquely identify each row")

    value_vars = list(map(lambda stub:
                          get_var_names(df, stub, sep, suffix), stubnames))

    value_vars_flattened = [e for sublist in value_vars for e in sublist]
    id_vars = list(set(df.columns.tolist()).difference(value_vars_flattened))

    melted = []
    for s, v in zip(stubnames, value_vars):
        melted.append(melt_stub(df, s, i, j, v, sep))
    melted = melted[0].join(melted[1:], how='outer')

    if len(i) == 1:
        new = df[id_vars].set_index(i).join(melted)
        return new

    new = df[id_vars].merge(melted.reset_index(), on=i).set_index(i + [j])

    return new


def get_dummies(data, prefix=None, prefix_sep='_', dummy_na=False,
                columns=None, sparse=False, drop_first=False):
    """
    Convert categorical variable into dummy/indicator variables

    Parameters
    ----------
    data : array-like, Series, or DataFrame
    prefix : string, list of strings, or dict of strings, default None
        String to append DataFrame column names
        Pass a list with length equal to the number of columns
        when calling get_dummies on a DataFrame. Alternativly, `prefix`
        can be a dictionary mapping column names to prefixes.
    prefix_sep : string, default '_'
        If appending prefix, separator/delimiter to use. Or pass a
        list or dictionary as with `prefix.`
    dummy_na : bool, default False
        Add a column to indicate NaNs, if False NaNs are ignored.
    columns : list-like, default None
        Column names in the DataFrame to be encoded.
        If `columns` is None then all the columns with
        `object` or `category` dtype will be converted.
    sparse : bool, default False
        Whether the dummy columns should be sparse or not.  Returns
        SparseDataFrame if `data` is a Series or if all columns are included.
        Otherwise returns a DataFrame with some SparseBlocks.

        .. versionadded:: 0.16.1
    drop_first : bool, default False
        Whether to get k-1 dummies out of k categorical levels by removing the
        first level.

        .. versionadded:: 0.18.0
    Returns
    -------
    dummies : DataFrame or SparseDataFrame

    Examples
    --------
    >>> import pandas as pd
    >>> s = pd.Series(list('abca'))

    >>> pd.get_dummies(s)
       a  b  c
    0  1  0  0
    1  0  1  0
    2  0  0  1
    3  1  0  0

    >>> s1 = ['a', 'b', np.nan]

    >>> pd.get_dummies(s1)
       a  b
    0  1  0
    1  0  1
    2  0  0

    >>> pd.get_dummies(s1, dummy_na=True)
       a  b  NaN
    0  1  0    0
    1  0  1    0
    2  0  0    1

    >>> df = pd.DataFrame({'A': ['a', 'b', 'a'], 'B': ['b', 'a', 'c'],
                        'C': [1, 2, 3]})

    >>> pd.get_dummies(df, prefix=['col1', 'col2'])
       C  col1_a  col1_b  col2_a  col2_b  col2_c
    0  1       1       0       0       1       0
    1  2       0       1       1       0       0
    2  3       1       0       0       0       1

    >>> pd.get_dummies(pd.Series(list('abcaa')))
       a  b  c
    0  1  0  0
    1  0  1  0
    2  0  0  1
    3  1  0  0
    4  1  0  0

    >>> pd.get_dummies(pd.Series(list('abcaa')), drop_first=True))
       b  c
    0  0  0
    1  1  0
    2  0  1
    3  0  0
    4  0  0

    See Also
    --------
    Series.str.get_dummies
    """
    from pandas.core.reshape.concat import concat
    from itertools import cycle

    if isinstance(data, DataFrame):
        # determine columns being encoded

        if columns is None:
            columns_to_encode = data.select_dtypes(
                include=['object', 'category']).columns
        else:
            columns_to_encode = columns

        # validate prefixes and separator to avoid silently dropping cols
        def check_len(item, name):
            length_msg = ("Length of '{0}' ({1}) did not match the length of "
                          "the columns being encoded ({2}).")

            if is_list_like(item):
                if not len(item) == len(columns_to_encode):
                    raise ValueError(length_msg.format(name, len(item),
                                                       len(columns_to_encode)))

        check_len(prefix, 'prefix')
        check_len(prefix_sep, 'prefix_sep')
        if isinstance(prefix, compat.string_types):
            prefix = cycle([prefix])
        if isinstance(prefix, dict):
            prefix = [prefix[col] for col in columns_to_encode]

        if prefix is None:
            prefix = columns_to_encode

        # validate separators
        if isinstance(prefix_sep, compat.string_types):
            prefix_sep = cycle([prefix_sep])
        elif isinstance(prefix_sep, dict):
            prefix_sep = [prefix_sep[col] for col in columns_to_encode]

        if set(columns_to_encode) == set(data.columns):
            with_dummies = []
        else:
            with_dummies = [data.drop(columns_to_encode, axis=1)]

        for (col, pre, sep) in zip(columns_to_encode, prefix, prefix_sep):

            dummy = _get_dummies_1d(data[col], prefix=pre, prefix_sep=sep,
                                    dummy_na=dummy_na, sparse=sparse,
                                    drop_first=drop_first)
            with_dummies.append(dummy)
        result = concat(with_dummies, axis=1)
    else:
        result = _get_dummies_1d(data, prefix, prefix_sep, dummy_na,
                                 sparse=sparse, drop_first=drop_first)
    return result


def _get_dummies_1d(data, prefix, prefix_sep='_', dummy_na=False,
                    sparse=False, drop_first=False):
    # Series avoids inconsistent NaN handling
    codes, levels = _factorize_from_iterable(Series(data))

    def get_empty_Frame(data, sparse):
        if isinstance(data, Series):
            index = data.index
        else:
            index = np.arange(len(data))
        if not sparse:
            return DataFrame(index=index)
        else:
            return SparseDataFrame(index=index, default_fill_value=0)

    # if all NaN
    if not dummy_na and len(levels) == 0:
        return get_empty_Frame(data, sparse)

    codes = codes.copy()
    if dummy_na:
        codes[codes == -1] = len(levels)
        levels = np.append(levels, np.nan)

    # if dummy_na, we just fake a nan level. drop_first will drop it again
    if drop_first and len(levels) == 1:
        return get_empty_Frame(data, sparse)

    number_of_cols = len(levels)

    if prefix is not None:
        dummy_cols = ['%s%s%s' % (prefix, prefix_sep, v) for v in levels]
    else:
        dummy_cols = levels

    if isinstance(data, Series):
        index = data.index
    else:
        index = None

    if sparse:
        sparse_series = {}
        N = len(data)
        sp_indices = [[] for _ in range(len(dummy_cols))]
        for ndx, code in enumerate(codes):
            if code == -1:
                # Blank entries if not dummy_na and code == -1, #GH4446
                continue
            sp_indices[code].append(ndx)

        if drop_first:
            # remove first categorical level to avoid perfect collinearity
            # GH12042
            sp_indices = sp_indices[1:]
            dummy_cols = dummy_cols[1:]
        for col, ixs in zip(dummy_cols, sp_indices):
            sarr = SparseArray(np.ones(len(ixs), dtype=np.uint8),
                               sparse_index=IntIndex(N, ixs), fill_value=0,
                               dtype=np.uint8)
            sparse_series[col] = SparseSeries(data=sarr, index=index)

        out = SparseDataFrame(sparse_series, index=index, columns=dummy_cols,
                              default_fill_value=0,
                              dtype=np.uint8)
        return out

    else:
        dummy_mat = np.eye(number_of_cols, dtype=np.uint8).take(codes, axis=0)

        if not dummy_na:
            # reset NaN GH4446
            dummy_mat[codes == -1] = 0

        if drop_first:
            # remove first GH12042
            dummy_mat = dummy_mat[:, 1:]
            dummy_cols = dummy_cols[1:]
        return DataFrame(dummy_mat, index=index, columns=dummy_cols)


def make_axis_dummies(frame, axis='minor', transform=None):
    """
    Construct 1-0 dummy variables corresponding to designated axis
    labels

    Parameters
    ----------
    frame : DataFrame
    axis : {'major', 'minor'}, default 'minor'
    transform : function, default None
        Function to apply to axis labels first. For example, to
        get "day of week" dummies in a time series regression
        you might call::

            make_axis_dummies(panel, axis='major',
                              transform=lambda d: d.weekday())
    Returns
    -------
    dummies : DataFrame
        Column names taken from chosen axis
    """
    numbers = {'major': 0, 'minor': 1}
    num = numbers.get(axis, axis)

    items = frame.index.levels[num]
    labels = frame.index.labels[num]
    if transform is not None:
        mapped_items = items.map(transform)
        labels, items = _factorize_from_iterable(mapped_items.take(labels))

    values = np.eye(len(items), dtype=float)
    values = values.take(labels, axis=0)

    return DataFrame(values, columns=items, index=frame.index)
