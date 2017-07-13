# pylint: disable=W0223

import warnings
import numpy as np
from pandas.compat import range, zip
import pandas.compat as compat
from pandas.core.dtypes.generic import ABCDataFrame, ABCPanel, ABCSeries
from pandas.core.dtypes.common import (
    is_integer_dtype,
    is_integer, is_float,
    is_list_like,
    is_sequence,
    is_iterator,
    is_scalar,
    is_sparse,
    _is_unorderable_exception,
    _ensure_platform_int)
from pandas.core.dtypes.missing import isnull, _infer_fill_value

from pandas.core.index import Index, MultiIndex

import pandas.core.common as com
from pandas.core.common import (is_bool_indexer, _asarray_tuplesafe,
                                is_null_slice, is_full_slice,
                                _values_from_object)


# the supported indexers
def get_indexers_list():

    return [
        ('ix', _IXIndexer),
        ('iloc', _iLocIndexer),
        ('loc', _LocIndexer),
        ('at', _AtIndexer),
        ('iat', _iAtIndexer),
    ]


# "null slice"
_NS = slice(None, None)


# the public IndexSlicerMaker
class _IndexSlice(object):
    """
    Create an object to more easily perform multi-index slicing

    Examples
    --------

    >>> midx = pd.MultiIndex.from_product([['A0','A1'], ['B0','B1','B2','B3']])
    >>> columns = ['foo', 'bar']
    >>> dfmi = pd.DataFrame(np.arange(16).reshape((len(midx), len(columns))),
                            index=midx, columns=columns)

    Using the default slice command:

    >>> dfmi.loc[(slice(None), slice('B0', 'B1')), :]
               foo  bar
        A0 B0    0    1
           B1    2    3
        A1 B0    8    9
           B1   10   11

    Using the IndexSlice class for a more intuitive command:

    >>> idx = pd.IndexSlice
    >>> dfmi.loc[idx[:, 'B0':'B1'], :]
               foo  bar
        A0 B0    0    1
           B1    2    3
        A1 B0    8    9
           B1   10   11
    """

    def __getitem__(self, arg):
        return arg


IndexSlice = _IndexSlice()


class IndexingError(Exception):
    pass


class _NDFrameIndexer(object):
    _valid_types = None
    _exception = KeyError
    axis = None

    def __init__(self, obj, name):
        self.obj = obj
        self.ndim = obj.ndim
        self.name = name

    def __call__(self, axis=None):
        # we need to return a copy of ourselves
        new_self = self.__class__(self.obj, self.name)

        new_self.axis = axis
        return new_self

    def __iter__(self):
        raise NotImplementedError('ix is not iterable')

    def __getitem__(self, key):
        if type(key) is tuple:
            key = tuple(com._apply_if_callable(x, self.obj) for x in key)
            try:
                values = self.obj.get_value(*key)
                if is_scalar(values):
                    return values
            except Exception:
                pass

            return self._getitem_tuple(key)
        else:
            key = com._apply_if_callable(key, self.obj)
            return self._getitem_axis(key, axis=0)

    def _get_label(self, label, axis=0):
        if self.ndim == 1:
            # for perf reasons we want to try _xs first
            # as its basically direct indexing
            # but will fail when the index is not present
            # see GH5667
            try:
                return self.obj._xs(label, axis=axis)
            except:
                return self.obj[label]
        elif isinstance(label, tuple) and isinstance(label[axis], slice):
            raise IndexingError('no slices here, handle elsewhere')

        return self.obj._xs(label, axis=axis)

    def _get_loc(self, key, axis=0):
        return self.obj._ixs(key, axis=axis)

    def _slice(self, obj, axis=0, kind=None):
        return self.obj._slice(obj, axis=axis, kind=kind)

    def _get_setitem_indexer(self, key):
        if self.axis is not None:
            return self._convert_tuple(key, is_setter=True)

        axis = self.obj._get_axis(0)
        if isinstance(axis, MultiIndex):
            try:
                return axis.get_loc(key)
            except Exception:
                pass

        if isinstance(key, tuple):
            try:
                return self._convert_tuple(key, is_setter=True)
            except IndexingError:
                pass

        if isinstance(key, range):
            return self._convert_range(key, is_setter=True)

        try:
            return self._convert_to_indexer(key, is_setter=True)
        except TypeError as e:

            # invalid indexer type vs 'other' indexing errors
            if 'cannot do' in str(e):
                raise
            raise IndexingError(key)

    def __setitem__(self, key, value):
        if isinstance(key, tuple):
            key = tuple(com._apply_if_callable(x, self.obj) for x in key)
        else:
            key = com._apply_if_callable(key, self.obj)
        indexer = self._get_setitem_indexer(key)
        self._setitem_with_indexer(indexer, value)

    def _has_valid_type(self, k, axis):
        raise NotImplementedError()

    def _has_valid_tuple(self, key):
        """ check the key for valid keys across my indexer """
        for i, k in enumerate(key):
            if i >= self.obj.ndim:
                raise IndexingError('Too many indexers')
            if not self._has_valid_type(k, i):
                raise ValueError("Location based indexing can only have [%s] "
                                 "types" % self._valid_types)

    def _should_validate_iterable(self, axis=0):
        """ return a boolean whether this axes needs validation for a passed
        iterable
        """
        ax = self.obj._get_axis(axis)
        if isinstance(ax, MultiIndex):
            return False
        elif ax.is_floating():
            return False

        return True

    def _is_nested_tuple_indexer(self, tup):
        if any([isinstance(ax, MultiIndex) for ax in self.obj.axes]):
            return any([is_nested_tuple(tup, ax) for ax in self.obj.axes])
        return False

    def _convert_tuple(self, key, is_setter=False):
        keyidx = []
        if self.axis is not None:
            axis = self.obj._get_axis_number(self.axis)
            for i in range(self.ndim):
                if i == axis:
                    keyidx.append(self._convert_to_indexer(
                        key, axis=axis, is_setter=is_setter))
                else:
                    keyidx.append(slice(None))
        else:
            for i, k in enumerate(key):
                if i >= self.obj.ndim:
                    raise IndexingError('Too many indexers')
                idx = self._convert_to_indexer(k, axis=i, is_setter=is_setter)
                keyidx.append(idx)
        return tuple(keyidx)

    def _convert_range(self, key, is_setter=False):
        """ convert a range argument """
        return list(key)

    def _convert_scalar_indexer(self, key, axis):
        # if we are accessing via lowered dim, use the last dim
        ax = self.obj._get_axis(min(axis, self.ndim - 1))
        # a scalar
        return ax._convert_scalar_indexer(key, kind=self.name)

    def _convert_slice_indexer(self, key, axis):
        # if we are accessing via lowered dim, use the last dim
        ax = self.obj._get_axis(min(axis, self.ndim - 1))
        return ax._convert_slice_indexer(key, kind=self.name)

    def _has_valid_setitem_indexer(self, indexer):
        return True

    def _has_valid_positional_setitem_indexer(self, indexer):
        """ validate that an positional indexer cannot enlarge its target
        will raise if needed, does not modify the indexer externally
        """
        if isinstance(indexer, dict):
            raise IndexError("{0} cannot enlarge its target object"
                             .format(self.name))
        else:
            if not isinstance(indexer, tuple):
                indexer = self._tuplify(indexer)
            for ax, i in zip(self.obj.axes, indexer):
                if isinstance(i, slice):
                    # should check the stop slice?
                    pass
                elif is_list_like_indexer(i):
                    # should check the elements?
                    pass
                elif is_integer(i):
                    if i >= len(ax):
                        raise IndexError("{0} cannot enlarge its target object"
                                         .format(self.name))
                elif isinstance(i, dict):
                    raise IndexError("{0} cannot enlarge its target object"
                                     .format(self.name))

        return True

    def _setitem_with_indexer(self, indexer, value):
        self._has_valid_setitem_indexer(indexer)

        # also has the side effect of consolidating in-place
        # TODO: Panel, DataFrame are not imported, remove?
        from pandas import Panel, DataFrame, Series  # noqa
        info_axis = self.obj._info_axis_number

        # maybe partial set
        take_split_path = self.obj._is_mixed_type

        # if there is only one block/type, still have to take split path
        # unless the block is one-dimensional or it can hold the value
        if not take_split_path and self.obj._data.blocks:
            blk, = self.obj._data.blocks
            if 1 < blk.ndim:  # in case of dict, keys are indices
                val = list(value.values()) if isinstance(value,
                                                         dict) else value
                take_split_path = not blk._can_hold_element(val)

        if isinstance(indexer, tuple) and len(indexer) == len(self.obj.axes):

            for i, ax in zip(indexer, self.obj.axes):

                # if we have any multi-indexes that have non-trivial slices
                # (not null slices) then we must take the split path, xref
                # GH 10360
                if (isinstance(ax, MultiIndex) and
                        not (is_integer(i) or is_null_slice(i))):
                    take_split_path = True
                    break

        if isinstance(indexer, tuple):
            nindexer = []
            for i, idx in enumerate(indexer):
                if isinstance(idx, dict):

                    # reindex the axis to the new value
                    # and set inplace
                    key, _ = convert_missing_indexer(idx)

                    # if this is the items axes, then take the main missing
                    # path first
                    # this correctly sets the dtype and avoids cache issues
                    # essentially this separates out the block that is needed
                    # to possibly be modified
                    if self.ndim > 1 and i == self.obj._info_axis_number:

                        # add the new item, and set the value
                        # must have all defined axes if we have a scalar
                        # or a list-like on the non-info axes if we have a
                        # list-like
                        len_non_info_axes = [
                            len(_ax) for _i, _ax in enumerate(self.obj.axes)
                            if _i != i
                        ]
                        if any([not l for l in len_non_info_axes]):
                            if not is_list_like_indexer(value):
                                raise ValueError("cannot set a frame with no "
                                                 "defined index and a scalar")
                            self.obj[key] = value
                            return self.obj

                        # add a new item with the dtype setup
                        self.obj[key] = _infer_fill_value(value)

                        new_indexer = convert_from_missing_indexer_tuple(
                            indexer, self.obj.axes)
                        self._setitem_with_indexer(new_indexer, value)

                        return self.obj

                    # reindex the axis
                    # make sure to clear the cache because we are
                    # just replacing the block manager here
                    # so the object is the same
                    index = self.obj._get_axis(i)
                    labels = index.insert(len(index), key)
                    self.obj._data = self.obj.reindex_axis(labels, i)._data
                    self.obj._maybe_update_cacher(clear=True)
                    self.obj.is_copy = None

                    nindexer.append(labels.get_loc(key))

                else:
                    nindexer.append(idx)

            indexer = tuple(nindexer)
        else:

            indexer, missing = convert_missing_indexer(indexer)

            if missing:

                # reindex the axis to the new value
                # and set inplace
                if self.ndim == 1:
                    index = self.obj.index
                    new_index = index.insert(len(index), indexer)

                    # we have a coerced indexer, e.g. a float
                    # that matches in an Int64Index, so
                    # we will not create a duplicate index, rather
                    # index to that element
                    # e.g. 0.0 -> 0
                    # GH12246
                    if index.is_unique:
                        new_indexer = index.get_indexer([new_index[-1]])
                        if (new_indexer != -1).any():
                            return self._setitem_with_indexer(new_indexer,
                                                              value)

                    # this preserves dtype of the value
                    new_values = Series([value])._values
                    if len(self.obj._values):
                        try:
                            new_values = np.concatenate([self.obj._values,
                                                         new_values])
                        except TypeError:
                            new_values = np.concatenate([self.obj.asobject,
                                                         new_values])
                    self.obj._data = self.obj._constructor(
                        new_values, index=new_index, name=self.obj.name)._data
                    self.obj._maybe_update_cacher(clear=True)
                    return self.obj

                elif self.ndim == 2:

                    # no columns and scalar
                    if not len(self.obj.columns):
                        raise ValueError("cannot set a frame with no defined "
                                         "columns")

                    # append a Series
                    if isinstance(value, Series):

                        value = value.reindex(index=self.obj.columns,
                                              copy=True)
                        value.name = indexer

                    # a list-list
                    else:

                        # must have conforming columns
                        if is_list_like_indexer(value):
                            if len(value) != len(self.obj.columns):
                                raise ValueError("cannot set a row with "
                                                 "mismatched columns")

                        value = Series(value, index=self.obj.columns,
                                       name=indexer)

                    self.obj._data = self.obj.append(value)._data
                    self.obj._maybe_update_cacher(clear=True)
                    return self.obj

                # set using setitem (Panel and > dims)
                elif self.ndim >= 3:
                    return self.obj.__setitem__(indexer, value)

        # set
        item_labels = self.obj._get_axis(info_axis)

        # align and set the values
        if take_split_path:

            if not isinstance(indexer, tuple):
                indexer = self._tuplify(indexer)

            if isinstance(value, ABCSeries):
                value = self._align_series(indexer, value)

            info_idx = indexer[info_axis]
            if is_integer(info_idx):
                info_idx = [info_idx]
            labels = item_labels[info_idx]

            # if we have a partial multiindex, then need to adjust the plane
            # indexer here
            if (len(labels) == 1 and
                    isinstance(self.obj[labels[0]].axes[0], MultiIndex)):
                item = labels[0]
                obj = self.obj[item]
                index = obj.index
                idx = indexer[:info_axis][0]

                plane_indexer = tuple([idx]) + indexer[info_axis + 1:]
                lplane_indexer = length_of_indexer(plane_indexer[0], index)

                # require that we are setting the right number of values that
                # we are indexing
                if is_list_like_indexer(value) and np.iterable(
                        value) and lplane_indexer != len(value):

                    if len(obj[idx]) != len(value):
                        raise ValueError("cannot set using a multi-index "
                                         "selection indexer with a different "
                                         "length than the value")

                    # make sure we have an ndarray
                    value = getattr(value, 'values', value).ravel()

                    # we can directly set the series here
                    # as we select a slice indexer on the mi
                    idx = index._convert_slice_indexer(idx)
                    obj._consolidate_inplace()
                    obj = obj.copy()
                    obj._data = obj._data.setitem(indexer=tuple([idx]),
                                                  value=value)
                    self.obj[item] = obj
                    return

            # non-mi
            else:
                plane_indexer = indexer[:info_axis] + indexer[info_axis + 1:]
                if info_axis > 0:
                    plane_axis = self.obj.axes[:info_axis][0]
                    lplane_indexer = length_of_indexer(plane_indexer[0],
                                                       plane_axis)
                else:
                    lplane_indexer = 0

            def setter(item, v):
                s = self.obj[item]
                pi = plane_indexer[0] if lplane_indexer == 1 else plane_indexer

                # perform the equivalent of a setitem on the info axis
                # as we have a null slice or a slice with full bounds
                # which means essentially reassign to the columns of a
                # multi-dim object
                # GH6149 (null slice), GH10408 (full bounds)
                if (isinstance(pi, tuple) and
                        all(is_null_slice(idx) or
                            is_full_slice(idx, len(self.obj))
                            for idx in pi)):
                    s = v
                else:
                    # set the item, possibly having a dtype change
                    s._consolidate_inplace()
                    s = s.copy()
                    s._data = s._data.setitem(indexer=pi, value=v)
                    s._maybe_update_cacher(clear=True)

                # reset the sliced object if unique
                self.obj[item] = s

            def can_do_equal_len():
                """ return True if we have an equal len settable """
                if not len(labels) == 1 or not np.iterable(value):
                    return False

                l = len(value)
                item = labels[0]
                index = self.obj[item].index

                # equal len list/ndarray
                if len(index) == l:
                    return True
                elif lplane_indexer == l:
                    return True

                return False

            # we need an iterable, with a ndim of at least 1
            # eg. don't pass through np.array(0)
            if is_list_like_indexer(value) and getattr(value, 'ndim', 1) > 0:

                # we have an equal len Frame
                if isinstance(value, ABCDataFrame) and value.ndim > 1:
                    sub_indexer = list(indexer)
                    multiindex_indexer = isinstance(labels, MultiIndex)

                    for item in labels:
                        if item in value:
                            sub_indexer[info_axis] = item
                            v = self._align_series(
                                tuple(sub_indexer), value[item],
                                multiindex_indexer)
                        else:
                            v = np.nan

                        setter(item, v)

                # we have an equal len ndarray/convertible to our labels
                elif np.array(value).ndim == 2:

                    # note that this coerces the dtype if we are mixed
                    # GH 7551
                    value = np.array(value, dtype=object)
                    if len(labels) != value.shape[1]:
                        raise ValueError('Must have equal len keys and value '
                                         'when setting with an ndarray')

                    for i, item in enumerate(labels):

                        # setting with a list, recoerces
                        setter(item, value[:, i].tolist())

                # we have an equal len list/ndarray
                elif can_do_equal_len():
                    setter(labels[0], value)

                # per label values
                else:

                    if len(labels) != len(value):
                        raise ValueError('Must have equal len keys and value '
                                         'when setting with an iterable')

                    for item, v in zip(labels, value):
                        setter(item, v)
            else:

                # scalar
                for item in labels:
                    setter(item, value)

        else:
            if isinstance(indexer, tuple):
                indexer = maybe_convert_ix(*indexer)

                # if we are setting on the info axis ONLY
                # set using those methods to avoid block-splitting
                # logic here
                if (len(indexer) > info_axis and
                        is_integer(indexer[info_axis]) and
                        all(is_null_slice(idx) for i, idx in enumerate(indexer)
                            if i != info_axis) and item_labels.is_unique):
                    self.obj[item_labels[indexer[info_axis]]] = value
                    return

            if isinstance(value, (ABCSeries, dict)):
                value = self._align_series(indexer, Series(value))

            elif isinstance(value, ABCDataFrame):
                value = self._align_frame(indexer, value)

            if isinstance(value, ABCPanel):
                value = self._align_panel(indexer, value)

            # check for chained assignment
            self.obj._check_is_chained_assignment_possible()

            # actually do the set
            self.obj._consolidate_inplace()
            self.obj._data = self.obj._data.setitem(indexer=indexer,
                                                    value=value)
            self.obj._maybe_update_cacher(clear=True)

    def _align_series(self, indexer, ser, multiindex_indexer=False):
        """
        Parameters
        ----------
        indexer : tuple, slice, scalar
            The indexer used to get the locations that will be set to
            `ser`

        ser : pd.Series
            The values to assign to the locations specified by `indexer`

        multiindex_indexer : boolean, optional
            Defaults to False. Should be set to True if `indexer` was from
            a `pd.MultiIndex`, to avoid unnecessary broadcasting.


        Returns:
        --------
        `np.array` of `ser` broadcast to the appropriate shape for assignment
        to the locations selected by `indexer`

        """
        if isinstance(indexer, (slice, np.ndarray, list, Index)):
            indexer = tuple([indexer])

        if isinstance(indexer, tuple):

            # flatten np.ndarray indexers
            ravel = lambda i: i.ravel() if isinstance(i, np.ndarray) else i
            indexer = tuple(map(ravel, indexer))

            aligners = [not is_null_slice(idx) for idx in indexer]
            sum_aligners = sum(aligners)
            single_aligner = sum_aligners == 1
            is_frame = self.obj.ndim == 2
            is_panel = self.obj.ndim >= 3
            obj = self.obj

            # are we a single alignable value on a non-primary
            # dim (e.g. panel: 1,2, or frame: 0) ?
            # hence need to align to a single axis dimension
            # rather that find all valid dims

            # frame
            if is_frame:
                single_aligner = single_aligner and aligners[0]

            # panel
            elif is_panel:
                single_aligner = (single_aligner and
                                  (aligners[1] or aligners[2]))

            # we have a frame, with multiple indexers on both axes; and a
            # series, so need to broadcast (see GH5206)
            if (sum_aligners == self.ndim and
                    all([is_sequence(_) for _ in indexer])):
                ser = ser.reindex(obj.axes[0][indexer[0]], copy=True)._values

                # single indexer
                if len(indexer) > 1 and not multiindex_indexer:
                    l = len(indexer[1])
                    ser = np.tile(ser, l).reshape(l, -1).T

                return ser

            for i, idx in enumerate(indexer):
                ax = obj.axes[i]

                # multiple aligners (or null slices)
                if is_sequence(idx) or isinstance(idx, slice):
                    if single_aligner and is_null_slice(idx):
                        continue
                    new_ix = ax[idx]
                    if not is_list_like_indexer(new_ix):
                        new_ix = Index([new_ix])
                    else:
                        new_ix = Index(new_ix)
                    if ser.index.equals(new_ix) or not len(new_ix):
                        return ser._values.copy()

                    return ser.reindex(new_ix)._values

                # 2 dims
                elif single_aligner and is_frame:

                    # reindex along index
                    ax = self.obj.axes[1]
                    if ser.index.equals(ax) or not len(ax):
                        return ser._values.copy()
                    return ser.reindex(ax)._values

                # >2 dims
                elif single_aligner:

                    broadcast = []
                    for n, labels in enumerate(self.obj._get_plane_axes(i)):

                        # reindex along the matching dimensions
                        if len(labels & ser.index):
                            ser = ser.reindex(labels)
                        else:
                            broadcast.append((n, len(labels)))

                    # broadcast along other dims
                    ser = ser._values.copy()
                    for (axis, l) in broadcast:
                        shape = [-1] * (len(broadcast) + 1)
                        shape[axis] = l
                        ser = np.tile(ser, l).reshape(shape)

                    if self.obj.ndim == 3:
                        ser = ser.T

                    return ser

        elif is_scalar(indexer):
            ax = self.obj._get_axis(1)

            if ser.index.equals(ax):
                return ser._values.copy()

            return ser.reindex(ax)._values

        raise ValueError('Incompatible indexer with Series')

    def _align_frame(self, indexer, df):
        is_frame = self.obj.ndim == 2
        is_panel = self.obj.ndim >= 3

        if isinstance(indexer, tuple):

            aligners = [not is_null_slice(idx) for idx in indexer]
            sum_aligners = sum(aligners)
            # TODO: single_aligner is not used
            single_aligner = sum_aligners == 1  # noqa

            idx, cols = None, None
            sindexers = []
            for i, ix in enumerate(indexer):
                ax = self.obj.axes[i]
                if is_sequence(ix) or isinstance(ix, slice):
                    if idx is None:
                        idx = ax[ix].ravel()
                    elif cols is None:
                        cols = ax[ix].ravel()
                    else:
                        break
                else:
                    sindexers.append(i)

            # panel
            if is_panel:

                # need to conform to the convention
                # as we are not selecting on the items axis
                # and we have a single indexer
                # GH 7763
                if len(sindexers) == 1 and sindexers[0] != 0:
                    df = df.T

                if idx is None:
                    idx = df.index
                if cols is None:
                    cols = df.columns

            if idx is not None and cols is not None:

                if df.index.equals(idx) and df.columns.equals(cols):
                    val = df.copy()._values
                else:
                    val = df.reindex(idx, columns=cols)._values
                return val

        elif ((isinstance(indexer, slice) or is_list_like_indexer(indexer)) and
              is_frame):
            ax = self.obj.index[indexer]
            if df.index.equals(ax):
                val = df.copy()._values
            else:

                # we have a multi-index and are trying to align
                # with a particular, level GH3738
                if (isinstance(ax, MultiIndex) and
                        isinstance(df.index, MultiIndex) and
                        ax.nlevels != df.index.nlevels):
                    raise TypeError("cannot align on a multi-index with out "
                                    "specifying the join levels")

                val = df.reindex(index=ax)._values
            return val

        elif is_scalar(indexer) and is_panel:
            idx = self.obj.axes[1]
            cols = self.obj.axes[2]

            # by definition we are indexing on the 0th axis
            # a passed in dataframe which is actually a transpose
            # of what is needed
            if idx.equals(df.index) and cols.equals(df.columns):
                return df.copy()._values

            return df.reindex(idx, columns=cols)._values

        raise ValueError('Incompatible indexer with DataFrame')

    def _align_panel(self, indexer, df):
        # TODO: is_frame, is_panel are unused
        is_frame = self.obj.ndim == 2  # noqa
        is_panel = self.obj.ndim >= 3  # noqa
        raise NotImplementedError("cannot set using an indexer with a Panel "
                                  "yet!")

    def _getitem_tuple(self, tup):
        try:
            return self._getitem_lowerdim(tup)
        except IndexingError:
            pass

        # no multi-index, so validate all of the indexers
        self._has_valid_tuple(tup)

        # ugly hack for GH #836
        if self._multi_take_opportunity(tup):
            return self._multi_take(tup)

        # no shortcut needed
        retval = self.obj
        for i, key in enumerate(tup):
            if i >= self.obj.ndim:
                raise IndexingError('Too many indexers')

            if is_null_slice(key):
                continue

            retval = getattr(retval, self.name)._getitem_axis(key, axis=i)

        return retval

    def _multi_take_opportunity(self, tup):
        from pandas.core.generic import NDFrame

        # ugly hack for GH #836
        if not isinstance(self.obj, NDFrame):
            return False

        if not all(is_list_like_indexer(x) for x in tup):
            return False

        # just too complicated
        for indexer, ax in zip(tup, self.obj._data.axes):
            if isinstance(ax, MultiIndex):
                return False
            elif is_bool_indexer(indexer):
                return False
            elif not ax.is_unique:
                return False

        return True

    def _multi_take(self, tup):
        """ create the reindex map for our objects, raise the _exception if we
        can't create the indexer
        """
        try:
            o = self.obj
            d = dict(
                [(a, self._convert_for_reindex(t, axis=o._get_axis_number(a)))
                 for t, a in zip(tup, o._AXIS_ORDERS)])
            return o.reindex(**d)
        except(KeyError, IndexingError):
            raise self._exception

    def _convert_for_reindex(self, key, axis=0):
        labels = self.obj._get_axis(axis)

        if is_bool_indexer(key):
            key = check_bool_indexer(labels, key)
            return labels[key]
        else:
            if isinstance(key, Index):
                keyarr = labels._convert_index_indexer(key)
            else:
                # asarray can be unsafe, NumPy strings are weird
                keyarr = _asarray_tuplesafe(key)

            if is_integer_dtype(keyarr):
                # Cast the indexer to uint64 if possible so
                # that the values returned from indexing are
                # also uint64.
                keyarr = labels._convert_arr_indexer(keyarr)

                if not labels.is_integer():
                    keyarr = _ensure_platform_int(keyarr)
                    return labels.take(keyarr)

            return keyarr

    def _handle_lowerdim_multi_index_axis0(self, tup):
        # we have an axis0 multi-index, handle or raise

        try:
            # fast path for series or for tup devoid of slices
            return self._get_label(tup, axis=0)
        except TypeError:
            # slices are unhashable
            pass
        except Exception as e1:
            if isinstance(tup[0], (slice, Index)):
                raise IndexingError("Handle elsewhere")

            # raise the error if we are not sorted
            ax0 = self.obj._get_axis(0)
            if not ax0.is_lexsorted_for_tuple(tup):
                raise e1

        return None

    def _getitem_lowerdim(self, tup):

        # we can directly get the axis result since the axis is specified
        if self.axis is not None:
            axis = self.obj._get_axis_number(self.axis)
            return self._getitem_axis(tup, axis=axis)

        # we may have a nested tuples indexer here
        if self._is_nested_tuple_indexer(tup):
            return self._getitem_nested_tuple(tup)

        # we maybe be using a tuple to represent multiple dimensions here
        ax0 = self.obj._get_axis(0)
        # ...but iloc should handle the tuple as simple integer-location
        # instead of checking it as multiindex representation (GH 13797)
        if isinstance(ax0, MultiIndex) and self.name != 'iloc':
            result = self._handle_lowerdim_multi_index_axis0(tup)
            if result is not None:
                return result

        if len(tup) > self.obj.ndim:
            raise IndexingError("Too many indexers. handle elsewhere")

        # to avoid wasted computation
        # df.ix[d1:d2, 0] -> columns first (True)
        # df.ix[0, ['C', 'B', A']] -> rows first (False)
        for i, key in enumerate(tup):
            if is_label_like(key) or isinstance(key, tuple):
                section = self._getitem_axis(key, axis=i)

                # we have yielded a scalar ?
                if not is_list_like_indexer(section):
                    return section

                elif section.ndim == self.ndim:
                    # we're in the middle of slicing through a MultiIndex
                    # revise the key wrt to `section` by inserting an _NS
                    new_key = tup[:i] + (_NS,) + tup[i + 1:]

                else:
                    new_key = tup[:i] + tup[i + 1:]

                    # unfortunately need an odious kludge here because of
                    # DataFrame transposing convention
                    if (isinstance(section, ABCDataFrame) and i > 0 and
                            len(new_key) == 2):
                        a, b = new_key
                        new_key = b, a

                    if len(new_key) == 1:
                        new_key, = new_key

                # This is an elided recursive call to iloc/loc/etc'
                return getattr(section, self.name)[new_key]

        raise IndexingError('not applicable')

    def _getitem_nested_tuple(self, tup):
        # we have a nested tuple so have at least 1 multi-index level
        # we should be able to match up the dimensionaility here

        # we have too many indexers for our dim, but have at least 1
        # multi-index dimension, try to see if we have something like
        # a tuple passed to a series with a multi-index
        if len(tup) > self.ndim:
            result = self._handle_lowerdim_multi_index_axis0(tup)
            if result is not None:
                return result

            # this is a series with a multi-index specified a tuple of
            # selectors
            return self._getitem_axis(tup, axis=0)

        # handle the multi-axis by taking sections and reducing
        # this is iterative
        obj = self.obj
        axis = 0
        for i, key in enumerate(tup):

            if is_null_slice(key):
                axis += 1
                continue

            current_ndim = obj.ndim
            obj = getattr(obj, self.name)._getitem_axis(key, axis=axis)
            axis += 1

            # if we have a scalar, we are done
            if is_scalar(obj) or not hasattr(obj, 'ndim'):
                break

            # has the dim of the obj changed?
            # GH 7199
            if obj.ndim < current_ndim:

                # GH 7516
                # if had a 3 dim and are going to a 2d
                # axes are reversed on a DataFrame
                if i >= 1 and current_ndim == 3 and obj.ndim == 2:
                    obj = obj.T

                axis -= 1

        return obj

    def _getitem_axis(self, key, axis=0):

        if self._should_validate_iterable(axis):
            self._has_valid_type(key, axis)

        labels = self.obj._get_axis(axis)
        if isinstance(key, slice):
            return self._get_slice_axis(key, axis=axis)
        elif (is_list_like_indexer(key) and
              not (isinstance(key, tuple) and
                   isinstance(labels, MultiIndex))):

            if hasattr(key, 'ndim') and key.ndim > 1:
                raise ValueError('Cannot index with multidimensional key')

            return self._getitem_iterable(key, axis=axis)
        else:

            # maybe coerce a float scalar to integer
            key = labels._maybe_cast_indexer(key)

            if is_integer(key):
                if axis == 0 and isinstance(labels, MultiIndex):
                    try:
                        return self._get_label(key, axis=axis)
                    except (KeyError, TypeError):
                        if self.obj.index.levels[0].is_integer():
                            raise

                # this is the fallback! (for a non-float, non-integer index)
                if not labels.is_floating() and not labels.is_integer():
                    return self._get_loc(key, axis=axis)

            return self._get_label(key, axis=axis)

    def _getitem_iterable(self, key, axis=0):
        if self._should_validate_iterable(axis):
            self._has_valid_type(key, axis)

        labels = self.obj._get_axis(axis)

        if is_bool_indexer(key):
            key = check_bool_indexer(labels, key)
            inds, = key.nonzero()
            return self.obj.take(inds, axis=axis, convert=False)
        else:
            # Have the index compute an indexer or return None
            # if it cannot handle; we only act on all found values
            indexer, keyarr = labels._convert_listlike_indexer(
                key, kind=self.name)
            if indexer is not None and (indexer != -1).all():
                return self.obj.take(indexer, axis=axis)

            # existing labels are unique and indexer are unique
            if labels.is_unique and Index(keyarr).is_unique:

                try:
                    return self.obj.reindex_axis(keyarr, axis=axis)
                except AttributeError:

                    # Series
                    if axis != 0:
                        raise AssertionError('axis must be 0')
                    return self.obj.reindex(keyarr)

            # existing labels are non-unique
            else:

                # reindex with the specified axis
                if axis + 1 > self.obj.ndim:
                    raise AssertionError("invalid indexing error with "
                                         "non-unique index")

                new_target, indexer, new_indexer = labels._reindex_non_unique(
                    keyarr)

                if new_indexer is not None:
                    result = self.obj.take(indexer[indexer != -1], axis=axis,
                                           convert=False)

                    result = result._reindex_with_indexers(
                        {axis: [new_target, new_indexer]},
                        copy=True, allow_dups=True)

                else:
                    result = self.obj.take(indexer, axis=axis, convert=False)

                return result

    def _convert_to_indexer(self, obj, axis=0, is_setter=False):
        """
        Convert indexing key into something we can use to do actual fancy
        indexing on an ndarray

        Examples
        ix[:5] -> slice(0, 5)
        ix[[1,2,3]] -> [1,2,3]
        ix[['foo', 'bar', 'baz']] -> [i, j, k] (indices of foo, bar, baz)

        Going by Zen of Python?
        'In the face of ambiguity, refuse the temptation to guess.'
        raise AmbiguousIndexError with integer labels?
        - No, prefer label-based indexing
        """
        labels = self.obj._get_axis(axis)

        if isinstance(obj, slice):
            return self._convert_slice_indexer(obj, axis)

        # try to find out correct indexer, if not type correct raise
        try:
            obj = self._convert_scalar_indexer(obj, axis)
        except TypeError:

            # but we will allow setting
            if is_setter:
                pass

        # see if we are positional in nature
        is_int_index = labels.is_integer()
        is_int_positional = is_integer(obj) and not is_int_index

        # if we are a label return me
        try:
            return labels.get_loc(obj)
        except LookupError:
            if isinstance(obj, tuple) and isinstance(labels, MultiIndex):
                if is_setter and len(obj) == labels.nlevels:
                    return {'key': obj}
                raise
        except TypeError:
            pass
        except (ValueError):
            if not is_int_positional:
                raise

        # a positional
        if is_int_positional:

            # if we are setting and its not a valid location
            # its an insert which fails by definition
            if is_setter:

                # always valid
                if self.name == 'loc':
                    return {'key': obj}

                # a positional
                if (obj >= self.obj.shape[axis] and
                        not isinstance(labels, MultiIndex)):
                    raise ValueError("cannot set by positional indexing with "
                                     "enlargement")

            return obj

        if is_nested_tuple(obj, labels):
            return labels.get_locs(obj)

        elif is_list_like_indexer(obj):

            if is_bool_indexer(obj):
                obj = check_bool_indexer(labels, obj)
                inds, = obj.nonzero()
                return inds
            else:

                # Have the index compute an indexer or return None
                # if it cannot handle
                indexer, objarr = labels._convert_listlike_indexer(
                    obj, kind=self.name)
                if indexer is not None:
                    return indexer

                # unique index
                if labels.is_unique:
                    indexer = check = labels.get_indexer(objarr)

                # non-unique (dups)
                else:
                    (indexer,
                     missing) = labels.get_indexer_non_unique(objarr)
                    # 'indexer' has dupes, create 'check' using 'missing'
                    check = np.zeros_like(objarr)
                    check[missing] = -1

                mask = check == -1
                if mask.any():
                    raise KeyError('%s not in index' % objarr[mask])

                return _values_from_object(indexer)

        else:
            try:
                return labels.get_loc(obj)
            except LookupError:
                # allow a not found key only if we are a setter
                if not is_list_like_indexer(obj) and is_setter:
                    return {'key': obj}
                raise

    def _tuplify(self, loc):
        tup = [slice(None, None) for _ in range(self.ndim)]
        tup[0] = loc
        return tuple(tup)

    def _get_slice_axis(self, slice_obj, axis=0):
        obj = self.obj

        if not need_slice(slice_obj):
            return obj
        indexer = self._convert_slice_indexer(slice_obj, axis)

        if isinstance(indexer, slice):
            return self._slice(indexer, axis=axis, kind='iloc')
        else:
            return self.obj.take(indexer, axis=axis, convert=False)


class _IXIndexer(_NDFrameIndexer):
    """A primarily label-location based indexer, with integer position
    fallback.

    ``.ix[]`` supports mixed integer and label based access. It is
    primarily label based, but will fall back to integer positional
    access unless the corresponding axis is of integer type.

    ``.ix`` is the most general indexer and will support any of the
    inputs in ``.loc`` and ``.iloc``. ``.ix`` also supports floating
    point label schemes. ``.ix`` is exceptionally useful when dealing
    with mixed positional and label based hierachical indexes.

    However, when an axis is integer based, ONLY label based access
    and not positional access is supported. Thus, in such cases, it's
    usually better to be explicit and use ``.iloc`` or ``.loc``.

    See more at :ref:`Advanced Indexing <advanced>`.

    """

    def __init__(self, obj, name):

        _ix_deprecation_warning = """
.ix is deprecated. Please use
.loc for label based indexing or
.iloc for positional indexing

See the documentation here:
http://pandas.pydata.org/pandas-docs/stable/indexing.html#deprecate_ix"""

        warnings.warn(_ix_deprecation_warning,
                      DeprecationWarning, stacklevel=3)
        super(_IXIndexer, self).__init__(obj, name)

    def _has_valid_type(self, key, axis):
        if isinstance(key, slice):
            return True

        elif is_bool_indexer(key):
            return True

        elif is_list_like_indexer(key):
            return True

        else:

            self._convert_scalar_indexer(key, axis)

        return True


class _LocationIndexer(_NDFrameIndexer):
    _exception = Exception

    def __getitem__(self, key):
        if type(key) is tuple:
            key = tuple(com._apply_if_callable(x, self.obj) for x in key)
            try:
                if self._is_scalar_access(key):
                    return self._getitem_scalar(key)
            except (KeyError, IndexError):
                pass
            return self._getitem_tuple(key)
        else:
            key = com._apply_if_callable(key, self.obj)
            return self._getitem_axis(key, axis=0)

    def _is_scalar_access(self, key):
        raise NotImplementedError()

    def _getitem_scalar(self, key):
        raise NotImplementedError()

    def _getitem_axis(self, key, axis=0):
        raise NotImplementedError()

    def _getbool_axis(self, key, axis=0):
        labels = self.obj._get_axis(axis)
        key = check_bool_indexer(labels, key)
        inds, = key.nonzero()
        try:
            return self.obj.take(inds, axis=axis, convert=False)
        except Exception as detail:
            raise self._exception(detail)

    def _get_slice_axis(self, slice_obj, axis=0):
        """ this is pretty simple as we just have to deal with labels """
        obj = self.obj
        if not need_slice(slice_obj):
            return obj

        labels = obj._get_axis(axis)
        indexer = labels.slice_indexer(slice_obj.start, slice_obj.stop,
                                       slice_obj.step, kind=self.name)

        if isinstance(indexer, slice):
            return self._slice(indexer, axis=axis, kind='iloc')
        else:
            return self.obj.take(indexer, axis=axis, convert=False)


class _LocIndexer(_LocationIndexer):
    """Purely label-location based indexer for selection by label.

    ``.loc[]`` is primarily label based, but may also be used with a
    boolean array.

    Allowed inputs are:

    - A single label, e.g. ``5`` or ``'a'``, (note that ``5`` is
      interpreted as a *label* of the index, and **never** as an
      integer position along the index).
    - A list or array of labels, e.g. ``['a', 'b', 'c']``.
    - A slice object with labels, e.g. ``'a':'f'`` (note that contrary
      to usual python slices, **both** the start and the stop are included!).
    - A boolean array.
    - A ``callable`` function with one argument (the calling Series, DataFrame
      or Panel) and that returns valid output for indexing (one of the above)

    ``.loc`` will raise a ``KeyError`` when the items are not found.

    See more at :ref:`Selection by Label <indexing.label>`

    """

    _valid_types = ("labels (MUST BE IN THE INDEX), slices of labels (BOTH "
                    "endpoints included! Can be slices of integers if the "
                    "index is integers), listlike of labels, boolean")
    _exception = KeyError

    def _has_valid_type(self, key, axis):
        ax = self.obj._get_axis(axis)

        # valid for a label where all labels are in the index
        # slice of lables (where start-end in labels)
        # slice of integers (only if in the lables)
        # boolean

        if isinstance(key, slice):
            return True

        elif is_bool_indexer(key):
            return True

        elif is_list_like_indexer(key):

            # mi is just a passthru
            if isinstance(key, tuple) and isinstance(ax, MultiIndex):
                return True

            # TODO: don't check the entire key unless necessary
            if (not is_iterator(key) and len(key) and
                    np.all(ax.get_indexer_for(key) < 0)):

                raise KeyError("None of [%s] are in the [%s]" %
                               (key, self.obj._get_axis_name(axis)))

            return True

        else:

            def error():
                if isnull(key):
                    raise TypeError("cannot use label indexing with a null "
                                    "key")
                raise KeyError("the label [%s] is not in the [%s]" %
                               (key, self.obj._get_axis_name(axis)))

            try:
                key = self._convert_scalar_indexer(key, axis)
                if not ax.contains(key):
                    error()
            except TypeError as e:

                # python 3 type errors should be raised
                if _is_unorderable_exception(e):
                    error()
                raise
            except:
                error()

        return True

    def _is_scalar_access(self, key):
        # this is a shortcut accessor to both .loc and .iloc
        # that provide the equivalent access of .at and .iat
        # a) avoid getting things via sections and (to minimize dtype changes)
        # b) provide a performant path
        if not hasattr(key, '__len__'):
            return False

        if len(key) != self.ndim:
            return False

        for i, k in enumerate(key):
            if not is_scalar(k):
                return False

            ax = self.obj.axes[i]
            if isinstance(ax, MultiIndex):
                return False

            if not ax.is_unique:
                return False

        return True

    def _getitem_scalar(self, key):
        # a fast-path to scalar access
        # if not, raise
        values = self.obj.get_value(*key)
        return values

    def _get_partial_string_timestamp_match_key(self, key, labels):
        """Translate any partial string timestamp matches in key, returning the
        new key (GH 10331)"""
        if isinstance(labels, MultiIndex):
            if isinstance(key, compat.string_types) and \
                    labels.levels[0].is_all_dates:
                # Convert key '2016-01-01' to
                # ('2016-01-01'[, slice(None, None, None)]+)
                key = tuple([key] + [slice(None)] * (len(labels.levels) - 1))

            if isinstance(key, tuple):
                # Convert (..., '2016-01-01', ...) in tuple to
                # (..., slice('2016-01-01', '2016-01-01', None), ...)
                new_key = []
                for i, component in enumerate(key):
                    if isinstance(component, compat.string_types) and \
                            labels.levels[i].is_all_dates:
                        new_key.append(slice(component, component, None))
                    else:
                        new_key.append(component)
                key = tuple(new_key)

        return key

    def _getitem_axis(self, key, axis=0):
        labels = self.obj._get_axis(axis)
        key = self._get_partial_string_timestamp_match_key(key, labels)

        if isinstance(key, slice):
            self._has_valid_type(key, axis)
            return self._get_slice_axis(key, axis=axis)
        elif is_bool_indexer(key):
            return self._getbool_axis(key, axis=axis)
        elif is_list_like_indexer(key):

            # convert various list-like indexers
            # to a list of keys
            # we will use the *values* of the object
            # and NOT the index if its a PandasObject
            if isinstance(labels, MultiIndex):

                if isinstance(key, (ABCSeries, np.ndarray)) and key.ndim <= 1:
                    # Series, or 0,1 ndim ndarray
                    # GH 14730
                    key = list(key)
                elif isinstance(key, ABCDataFrame):
                    # GH 15438
                    raise NotImplementedError("Indexing a MultiIndex with a "
                                              "DataFrame key is not "
                                              "implemented")
                elif hasattr(key, 'ndim') and key.ndim > 1:
                    raise NotImplementedError("Indexing a MultiIndex with a "
                                              "multidimensional key is not "
                                              "implemented")

                if (not isinstance(key, tuple) and len(key) > 1 and
                        not isinstance(key[0], tuple)):
                    key = tuple([key])

            # an iterable multi-selection
            if not (isinstance(key, tuple) and isinstance(labels, MultiIndex)):

                if hasattr(key, 'ndim') and key.ndim > 1:
                    raise ValueError('Cannot index with multidimensional key')

                return self._getitem_iterable(key, axis=axis)

            # nested tuple slicing
            if is_nested_tuple(key, labels):
                locs = labels.get_locs(key)
                indexer = [slice(None)] * self.ndim
                indexer[axis] = locs
                return self.obj.iloc[tuple(indexer)]

        # fall thru to straight lookup
        self._has_valid_type(key, axis)
        return self._get_label(key, axis=axis)


class _iLocIndexer(_LocationIndexer):
    """Purely integer-location based indexing for selection by position.

    ``.iloc[]`` is primarily integer position based (from ``0`` to
    ``length-1`` of the axis), but may also be used with a boolean
    array.

    Allowed inputs are:

    - An integer, e.g. ``5``.
    - A list or array of integers, e.g. ``[4, 3, 0]``.
    - A slice object with ints, e.g. ``1:7``.
    - A boolean array.
    - A ``callable`` function with one argument (the calling Series, DataFrame
      or Panel) and that returns valid output for indexing (one of the above)

    ``.iloc`` will raise ``IndexError`` if a requested indexer is
    out-of-bounds, except *slice* indexers which allow out-of-bounds
    indexing (this conforms with python/numpy *slice* semantics).

    See more at :ref:`Selection by Position <indexing.integer>`

    """

    _valid_types = ("integer, integer slice (START point is INCLUDED, END "
                    "point is EXCLUDED), listlike of integers, boolean array")
    _exception = IndexError

    def _has_valid_type(self, key, axis):
        if is_bool_indexer(key):
            if hasattr(key, 'index') and isinstance(key.index, Index):
                if key.index.inferred_type == 'integer':
                    raise NotImplementedError("iLocation based boolean "
                                              "indexing on an integer type "
                                              "is not available")
                raise ValueError("iLocation based boolean indexing cannot use "
                                 "an indexable as a mask")
            return True

        if isinstance(key, slice):
            return True
        elif is_integer(key):
            return self._is_valid_integer(key, axis)
        elif is_list_like_indexer(key):
            return self._is_valid_list_like(key, axis)
        return False

    def _has_valid_setitem_indexer(self, indexer):
        self._has_valid_positional_setitem_indexer(indexer)

    def _is_scalar_access(self, key):
        # this is a shortcut accessor to both .loc and .iloc
        # that provide the equivalent access of .at and .iat
        # a) avoid getting things via sections and (to minimize dtype changes)
        # b) provide a performant path
        if not hasattr(key, '__len__'):
            return False

        if len(key) != self.ndim:
            return False

        for i, k in enumerate(key):
            if not is_integer(k):
                return False

            ax = self.obj.axes[i]
            if not ax.is_unique:
                return False

        return True

    def _getitem_scalar(self, key):
        # a fast-path to scalar access
        # if not, raise
        values = self.obj.get_value(*key, takeable=True)
        return values

    def _is_valid_integer(self, key, axis):
        # return a boolean if we have a valid integer indexer

        ax = self.obj._get_axis(axis)
        l = len(ax)
        if key >= l or key < -l:
            raise IndexError("single positional indexer is out-of-bounds")
        return True

    def _is_valid_list_like(self, key, axis):
        # return a boolean if we are a valid list-like (e.g. that we don't
        # have out-of-bounds values)

        # a tuple should already have been caught by this point
        # so don't treat a tuple as a valid indexer
        if isinstance(key, tuple):
            raise IndexingError('Too many indexers')

        # coerce the key to not exceed the maximum size of the index
        arr = np.array(key)
        ax = self.obj._get_axis(axis)
        l = len(ax)
        if (hasattr(arr, '__len__') and len(arr) and
                (arr.max() >= l or arr.min() < -l)):
            raise IndexError("positional indexers are out-of-bounds")

        return True

    def _getitem_tuple(self, tup):

        self._has_valid_tuple(tup)
        try:
            return self._getitem_lowerdim(tup)
        except:
            pass

        retval = self.obj
        axis = 0
        for i, key in enumerate(tup):
            if i >= self.obj.ndim:
                raise IndexingError('Too many indexers')

            if is_null_slice(key):
                axis += 1
                continue

            retval = getattr(retval, self.name)._getitem_axis(key, axis=axis)

            # if the dim was reduced, then pass a lower-dim the next time
            if retval.ndim < self.ndim:
                axis -= 1

            # try to get for the next axis
            axis += 1

        return retval

    def _get_slice_axis(self, slice_obj, axis=0):
        obj = self.obj

        if not need_slice(slice_obj):
            return obj

        slice_obj = self._convert_slice_indexer(slice_obj, axis)
        if isinstance(slice_obj, slice):
            return self._slice(slice_obj, axis=axis, kind='iloc')
        else:
            return self.obj.take(slice_obj, axis=axis, convert=False)

    def _get_list_axis(self, key, axis=0):
        """
        Return Series values by list or array of integers

        Parameters
        ----------
        key : list-like positional indexer
        axis : int (can only be zero)

        Returns
        -------
        Series object
        """
        try:
            return self.obj.take(key, axis=axis, convert=False)
        except IndexError:
            # re-raise with different error message
            raise IndexError("positional indexers are out-of-bounds")

    def _getitem_axis(self, key, axis=0):

        if isinstance(key, slice):
            self._has_valid_type(key, axis)
            return self._get_slice_axis(key, axis=axis)

        if isinstance(key, list):
            try:
                key = np.asarray(key)
            except TypeError:  # pragma: no cover
                pass

        if is_bool_indexer(key):
            self._has_valid_type(key, axis)
            return self._getbool_axis(key, axis=axis)

        # a list of integers
        elif is_list_like_indexer(key):
            return self._get_list_axis(key, axis=axis)

        # a single integer
        else:
            key = self._convert_scalar_indexer(key, axis)

            if not is_integer(key):
                raise TypeError("Cannot index by location index with a "
                                "non-integer key")

            # validate the location
            self._is_valid_integer(key, axis)

            return self._get_loc(key, axis=axis)

    def _convert_to_indexer(self, obj, axis=0, is_setter=False):
        """ much simpler as we only have to deal with our valid types """

        # make need to convert a float key
        if isinstance(obj, slice):
            return self._convert_slice_indexer(obj, axis)

        elif is_float(obj):
            return self._convert_scalar_indexer(obj, axis)

        elif self._has_valid_type(obj, axis):
            return obj

        raise ValueError("Can only index by location with a [%s]" %
                         self._valid_types)


class _ScalarAccessIndexer(_NDFrameIndexer):
    """ access scalars quickly """

    def _convert_key(self, key, is_setter=False):
        return list(key)

    def __getitem__(self, key):
        if not isinstance(key, tuple):

            # we could have a convertible item here (e.g. Timestamp)
            if not is_list_like_indexer(key):
                key = tuple([key])
            else:
                raise ValueError('Invalid call for scalar access (getting)!')

        key = self._convert_key(key)
        return self.obj.get_value(*key, takeable=self._takeable)

    def __setitem__(self, key, value):
        if isinstance(key, tuple):
            key = tuple(com._apply_if_callable(x, self.obj) for x in key)
        else:
            # scalar callable may return tuple
            key = com._apply_if_callable(key, self.obj)

        if not isinstance(key, tuple):
            key = self._tuplify(key)
        if len(key) != self.obj.ndim:
            raise ValueError('Not enough indexers for scalar access '
                             '(setting)!')
        key = list(self._convert_key(key, is_setter=True))
        key.append(value)
        self.obj.set_value(*key, takeable=self._takeable)


class _AtIndexer(_ScalarAccessIndexer):
    """Fast label-based scalar accessor

    Similarly to ``loc``, ``at`` provides **label** based scalar lookups.
    You can also set using these indexers.

    """

    _takeable = False

    def _convert_key(self, key, is_setter=False):
        """ require they keys to be the same type as the index (so we don't
        fallback)
        """

        # allow arbitrary setting
        if is_setter:
            return list(key)

        for ax, i in zip(self.obj.axes, key):
            if ax.is_integer():
                if not is_integer(i):
                    raise ValueError("At based indexing on an integer index "
                                     "can only have integer indexers")
            else:
                if is_integer(i):
                    raise ValueError("At based indexing on an non-integer "
                                     "index can only have non-integer "
                                     "indexers")
        return key


class _iAtIndexer(_ScalarAccessIndexer):
    """Fast integer location scalar accessor.

    Similarly to ``iloc``, ``iat`` provides **integer** based lookups.
    You can also set using these indexers.

    """

    _takeable = True

    def _has_valid_setitem_indexer(self, indexer):
        self._has_valid_positional_setitem_indexer(indexer)

    def _convert_key(self, key, is_setter=False):
        """ require  integer args (and convert to label arguments) """
        for a, i in zip(self.obj.axes, key):
            if not is_integer(i):
                raise ValueError("iAt based indexing can only have integer "
                                 "indexers")
        return key


# 32-bit floating point machine epsilon
_eps = 1.1920929e-07


def length_of_indexer(indexer, target=None):
    """return the length of a single non-tuple indexer which could be a slice
    """
    if target is not None and isinstance(indexer, slice):
        l = len(target)
        start = indexer.start
        stop = indexer.stop
        step = indexer.step
        if start is None:
            start = 0
        elif start < 0:
            start += l
        if stop is None or stop > l:
            stop = l
        elif stop < 0:
            stop += l
        if step is None:
            step = 1
        elif step < 0:
            step = -step
        return (stop - start + step - 1) // step
    elif isinstance(indexer, (ABCSeries, Index, np.ndarray, list)):
        return len(indexer)
    elif not is_list_like_indexer(indexer):
        return 1
    raise AssertionError("cannot find the length of the indexer")


def convert_to_index_sliceable(obj, key):
    """if we are index sliceable, then return my slicer, otherwise return None
    """
    idx = obj.index
    if isinstance(key, slice):
        return idx._convert_slice_indexer(key, kind='getitem')

    elif isinstance(key, compat.string_types):

        # we are an actual column
        if obj._data.items.contains(key):
            return None

        # We might have a datetimelike string that we can translate to a
        # slice here via partial string indexing
        if idx.is_all_dates:
            try:
                return idx._get_string_slice(key)
            except (KeyError, ValueError, NotImplementedError):
                return None

    return None


def is_index_slice(obj):
    def _is_valid_index(x):
        return (is_integer(x) or is_float(x) and
                np.allclose(x, int(x), rtol=_eps, atol=0))

    def _crit(v):
        return v is None or _is_valid_index(v)

    both_none = obj.start is None and obj.stop is None

    return not both_none and (_crit(obj.start) and _crit(obj.stop))


def check_bool_indexer(ax, key):
    # boolean indexing, need to check that the data are aligned, otherwise
    # disallowed

    # this function assumes that is_bool_indexer(key) == True

    result = key
    if isinstance(key, ABCSeries) and not key.index.equals(ax):
        result = result.reindex(ax)
        mask = isnull(result._values)
        if mask.any():
            raise IndexingError('Unalignable boolean Series provided as '
                                'indexer (index of the boolean Series and of '
                                'the indexed object do not match')
        result = result.astype(bool)._values
    elif is_sparse(result):
        result = result.to_dense()
        result = np.asarray(result, dtype=bool)
    else:
        # is_bool_indexer has already checked for nulls in the case of an
        # object array key, so no check needed here
        result = np.asarray(result, dtype=bool)

    return result


def convert_missing_indexer(indexer):
    """ reverse convert a missing indexer, which is a dict
    return the scalar indexer and a boolean indicating if we converted
    """

    if isinstance(indexer, dict):

        # a missing key (but not a tuple indexer)
        indexer = indexer['key']

        if isinstance(indexer, bool):
            raise KeyError("cannot use a single bool to index into setitem")
        return indexer, True

    return indexer, False


def convert_from_missing_indexer_tuple(indexer, axes):
    """ create a filtered indexer that doesn't have any missing indexers """

    def get_indexer(_i, _idx):
        return (axes[_i].get_loc(_idx['key']) if isinstance(_idx, dict) else
                _idx)

    return tuple([get_indexer(_i, _idx) for _i, _idx in enumerate(indexer)])


def maybe_convert_indices(indices, n):
    """ if we have negative indicies, translate to postive here
    if have indicies that are out-of-bounds, raise an IndexError
    """
    if isinstance(indices, list):
        indices = np.array(indices)
        if len(indices) == 0:
            # If list is empty, np.array will return float and cause indexing
            # errors.
            return np.empty(0, dtype=np.int_)

    mask = indices < 0
    if mask.any():
        indices[mask] += n
    mask = (indices >= n) | (indices < 0)
    if mask.any():
        raise IndexError("indices are out-of-bounds")
    return indices


def maybe_convert_ix(*args):
    """
    We likely want to take the cross-product
    """

    ixify = True
    for arg in args:
        if not isinstance(arg, (np.ndarray, list, ABCSeries, Index)):
            ixify = False

    if ixify:
        return np.ix_(*args)
    else:
        return args


def is_nested_tuple(tup, labels):
    # check for a compatiable nested tuple and multiindexes among the axes
    if not isinstance(tup, tuple):
        return False

    # are we nested tuple of: tuple,list,slice
    for i, k in enumerate(tup):

        if isinstance(k, (tuple, list, slice)):
            return isinstance(labels, MultiIndex)

    return False


def is_list_like_indexer(key):
    # allow a list_like, but exclude NamedTuples which can be indexers
    return is_list_like(key) and not (isinstance(key, tuple) and
                                      type(key) is not tuple)


def is_label_like(key):
    # select a label or row
    return not isinstance(key, slice) and not is_list_like_indexer(key)


def need_slice(obj):
    return (obj.start is not None or obj.stop is not None or
            (obj.step is not None and obj.step != 1))


def maybe_droplevels(index, key):
    # drop levels
    original_index = index
    if isinstance(key, tuple):
        for _ in key:
            try:
                index = index.droplevel(0)
            except:
                # we have dropped too much, so back out
                return original_index
    else:
        try:
            index = index.droplevel(0)
        except:
            pass

    return index


def _non_reducing_slice(slice_):
    """
    Ensurse that a slice doesn't reduce to a Series or Scalar.

    Any user-paseed `subset` should have this called on it
    to make sure we're always working with DataFrames.
    """
    # default to column slice, like DataFrame
    # ['A', 'B'] -> IndexSlices[:, ['A', 'B']]
    kinds = tuple(list(compat.string_types) + [ABCSeries, np.ndarray, Index,
                                               list])
    if isinstance(slice_, kinds):
        slice_ = IndexSlice[:, slice_]

    def pred(part):
        # true when slice does *not* reduce
        return isinstance(part, slice) or is_list_like(part)

    if not is_list_like(slice_):
        if not isinstance(slice_, slice):
            # a 1-d slice, like df.loc[1]
            slice_ = [[slice_]]
        else:
            # slice(a, b, c)
            slice_ = [slice_]  # to tuplize later
    else:
        slice_ = [part if pred(part) else [part] for part in slice_]
    return tuple(slice_)


def _maybe_numeric_slice(df, slice_, include_bool=False):
    """
    want nice defaults for background_gradient that don't break
    with non-numeric data. But if slice_ is passed go with that.
    """
    if slice_ is None:
        dtypes = [np.number]
        if include_bool:
            dtypes.append(bool)
        slice_ = IndexSlice[:, df.select_dtypes(include=dtypes).columns]
    return slice_
