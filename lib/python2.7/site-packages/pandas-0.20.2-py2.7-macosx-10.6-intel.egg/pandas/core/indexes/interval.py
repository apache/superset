""" define the IntervalIndex """

import numpy as np

from pandas.core.dtypes.missing import notnull, isnull
from pandas.core.dtypes.generic import ABCPeriodIndex
from pandas.core.dtypes.dtypes import IntervalDtype
from pandas.core.dtypes.common import (
    _ensure_platform_int,
    is_list_like,
    is_datetime_or_timedelta_dtype,
    is_integer_dtype,
    is_object_dtype,
    is_categorical_dtype,
    is_float_dtype,
    is_interval_dtype,
    is_scalar,
    is_integer)
from pandas.core.indexes.base import (
    Index, _ensure_index,
    default_pprint, _index_shared_docs)

from pandas._libs import Timestamp, Timedelta
from pandas._libs.interval import (
    Interval, IntervalMixin, IntervalTree,
    intervals_to_interval_bounds)

from pandas.core.indexes.multi import MultiIndex
from pandas.compat.numpy import function as nv
from pandas.core import common as com
from pandas.util._decorators import cache_readonly, Appender
from pandas.core.config import get_option

import pandas.core.indexes.base as ibase
_index_doc_kwargs = dict(ibase._index_doc_kwargs)
_index_doc_kwargs.update(
    dict(klass='IntervalIndex',
         target_klass='IntervalIndex or list of Intervals'))


_VALID_CLOSED = set(['left', 'right', 'both', 'neither'])


def _get_next_label(label):
    dtype = getattr(label, 'dtype', type(label))
    if isinstance(label, (Timestamp, Timedelta)):
        dtype = 'datetime64'
    if is_datetime_or_timedelta_dtype(dtype):
        return label + np.timedelta64(1, 'ns')
    elif is_integer_dtype(dtype):
        return label + 1
    elif is_float_dtype(dtype):
        return np.nextafter(label, np.infty)
    else:
        raise TypeError('cannot determine next label for type %r'
                        % type(label))


def _get_prev_label(label):
    dtype = getattr(label, 'dtype', type(label))
    if isinstance(label, (Timestamp, Timedelta)):
        dtype = 'datetime64'
    if is_datetime_or_timedelta_dtype(dtype):
        return label - np.timedelta64(1, 'ns')
    elif is_integer_dtype(dtype):
        return label - 1
    elif is_float_dtype(dtype):
        return np.nextafter(label, -np.infty)
    else:
        raise TypeError('cannot determine next label for type %r'
                        % type(label))


def _get_interval_closed_bounds(interval):
    """
    Given an Interval or IntervalIndex, return the corresponding interval with
    closed bounds.
    """
    left, right = interval.left, interval.right
    if interval.open_left:
        left = _get_next_label(left)
    if interval.open_right:
        right = _get_prev_label(right)
    return left, right


def _new_IntervalIndex(cls, d):
    """ This is called upon unpickling,
    rather than the default which doesn't
    have arguments and breaks __new__ """

    return cls.from_arrays(**d)


class IntervalIndex(IntervalMixin, Index):
    """
    Immutable Index implementing an ordered, sliceable set. IntervalIndex
    represents an Index of intervals that are all closed on the same side.

    .. versionadded:: 0.20.0

    Warning: the indexing behaviors are provisional and may change in
    a future version of pandas.

    Attributes
    ----------
    left, right : array-like (1-dimensional)
        Left and right bounds for each interval.
    closed : {'left', 'right', 'both', 'neither'}, optional
        Whether the intervals are closed on the left-side, right-side, both or
        neither. Defaults to 'right'.
    name : object, optional
        Name to be stored in the index.
    copy : boolean, default False
        Copy the meta-data

    See Also
    --------
    Index
    """
    _typ = 'intervalindex'
    _comparables = ['name']
    _attributes = ['name', 'closed']
    _allow_index_ops = True

    # we would like our indexing holder to defer to us
    _defer_to_indexing = True

    _mask = None

    def __new__(cls, data, closed='right',
                name=None, copy=False, dtype=None,
                fastpath=False, verify_integrity=True):

        if fastpath:
            return cls._simple_new(data.left, data.right, closed, name,
                                   copy=copy, verify_integrity=False)

        if name is None and hasattr(data, 'name'):
            name = data.name

        if isinstance(data, IntervalIndex):
            left = data.left
            right = data.right

        else:

            # don't allow scalars
            if is_scalar(data):
                cls._scalar_data_error(data)

            data = IntervalIndex.from_intervals(data, name=name)
            left, right = data.left, data.right

        return cls._simple_new(left, right, closed, name,
                               copy=copy, verify_integrity=verify_integrity)

    @classmethod
    def _simple_new(cls, left, right, closed=None, name=None,
                    copy=False, verify_integrity=True):
        result = IntervalMixin.__new__(cls)

        if closed is None:
            closed = 'right'
        left = _ensure_index(left, copy=copy)
        right = _ensure_index(right, copy=copy)

        # coerce dtypes to match if needed
        if is_float_dtype(left) and is_integer_dtype(right):
            right = right.astype(left.dtype)
        if is_float_dtype(right) and is_integer_dtype(left):
            left = left.astype(right.dtype)

        if type(left) != type(right):
            raise ValueError("must not have differing left [{}] "
                             "and right [{}] types".format(
                                 type(left), type(right)))

        if isinstance(left, ABCPeriodIndex):
            raise ValueError("Period dtypes are not supported, "
                             "use a PeriodIndex instead")

        result._left = left
        result._right = right
        result._closed = closed
        result.name = name
        if verify_integrity:
            result._validate()
        result._reset_identity()
        return result

    @Appender(_index_shared_docs['_shallow_copy'])
    def _shallow_copy(self, left=None, right=None, **kwargs):
        if left is None:

            # no values passed
            left, right = self.left, self.right

        elif right is None:

            # only single value passed, could be an IntervalIndex
            # or array of Intervals
            if not isinstance(left, IntervalIndex):
                left = type(self).from_intervals(left)

            left, right = left.left, left.right
        else:

            # both left and right are values
            pass

        attributes = self._get_attributes_dict()
        attributes.update(kwargs)
        attributes['verify_integrity'] = False
        return self._simple_new(left, right, **attributes)

    def _validate(self):
        """
        Verify that the IntervalIndex is valid.
        """
        if self.closed not in _VALID_CLOSED:
            raise ValueError("invalid options for 'closed': %s" % self.closed)
        if len(self.left) != len(self.right):
            raise ValueError('left and right must have the same length')
        left_mask = notnull(self.left)
        right_mask = notnull(self.right)
        if not (left_mask == right_mask).all():
            raise ValueError('missing values must be missing in the same '
                             'location both left and right sides')
        if not (self.left[left_mask] <= self.right[left_mask]).all():
            raise ValueError('left side of interval must be <= right side')
        self._mask = ~left_mask

    @cache_readonly
    def hasnans(self):
        """ return if I have any nans; enables various perf speedups """
        return self._isnan.any()

    @cache_readonly
    def _isnan(self):
        """ return if each value is nan"""
        if self._mask is None:
            self._mask = isnull(self.left)
        return self._mask

    @cache_readonly
    def _engine(self):
        return IntervalTree(self.left, self.right, closed=self.closed)

    @property
    def _constructor(self):
        return type(self).from_intervals

    def __contains__(self, key):
        """
        return a boolean if this key is IN the index
        We *only* accept an Interval

        Parameters
        ----------
        key : Interval

        Returns
        -------
        boolean
        """
        if not isinstance(key, Interval):
            return False

        try:
            self.get_loc(key)
            return True
        except KeyError:
            return False

    def contains(self, key):
        """
        return a boolean if this key is IN the index

        We accept / allow keys to be not *just* actual
        objects.

        Parameters
        ----------
        key : int, float, Interval

        Returns
        -------
        boolean
        """
        try:
            self.get_loc(key)
            return True
        except KeyError:
            return False

    @classmethod
    def from_breaks(cls, breaks, closed='right', name=None, copy=False):
        """
        Construct an IntervalIndex from an array of splits

        Parameters
        ----------
        breaks : array-like (1-dimensional)
            Left and right bounds for each interval.
        closed : {'left', 'right', 'both', 'neither'}, optional
            Whether the intervals are closed on the left-side, right-side, both
            or neither. Defaults to 'right'.
        name : object, optional
            Name to be stored in the index.
        copy : boolean, default False
            copy the data

        Examples
        --------

        >>> IntervalIndex.from_breaks([0, 1, 2, 3])
        IntervalIndex(left=[0, 1, 2],
                      right=[1, 2, 3],
                      closed='right')
        """
        breaks = np.asarray(breaks)
        return cls.from_arrays(breaks[:-1], breaks[1:], closed,
                               name=name, copy=copy)

    @classmethod
    def from_arrays(cls, left, right, closed='right', name=None, copy=False):
        """
        Construct an IntervalIndex from a a left and right array

        Parameters
        ----------
        left : array-like (1-dimensional)
            Left bounds for each interval.
        right : array-like (1-dimensional)
            Right bounds for each interval.
        closed : {'left', 'right', 'both', 'neither'}, optional
            Whether the intervals are closed on the left-side, right-side, both
            or neither. Defaults to 'right'.
        name : object, optional
            Name to be stored in the index.
        copy : boolean, default False
            copy the data

        Examples
        --------

        >>> IntervalIndex.from_arrays([0, 1, 2], [1, 2, 3])
        IntervalIndex(left=[0, 1, 2],
                      right=[1, 2, 3],
                      closed='right')
        """
        left = np.asarray(left)
        right = np.asarray(right)
        return cls._simple_new(left, right, closed, name=name,
                               copy=copy, verify_integrity=True)

    @classmethod
    def from_intervals(cls, data, name=None, copy=False):
        """
        Construct an IntervalIndex from a 1d array of Interval objects

        Parameters
        ----------
        data : array-like (1-dimensional)
            Array of Interval objects. All intervals must be closed on the same
            sides.
        name : object, optional
            Name to be stored in the index.
        copy : boolean, default False
            by-default copy the data, this is compat only and ignored

        Examples
        --------

        >>> IntervalIndex.from_intervals([Interval(0, 1), Interval(1, 2)])
        IntervalIndex(left=[0, 1],
                      right=[1, 2],
                      closed='right')

        The generic Index constructor work identically when it infers an array
        of all intervals:

        >>> Index([Interval(0, 1), Interval(1, 2)])
        IntervalIndex(left=[0, 1],
                      right=[1, 2],
                      closed='right')
        """
        data = np.asarray(data)
        left, right, closed = intervals_to_interval_bounds(data)
        return cls.from_arrays(left, right, closed, name=name, copy=False)

    @classmethod
    def from_tuples(cls, data, closed='right', name=None, copy=False):
        """
        Construct an IntervalIndex from a list/array of tuples

        Parameters
        ----------
        data : array-like (1-dimensional)
            Array of tuples
        closed : {'left', 'right', 'both', 'neither'}, optional
            Whether the intervals are closed on the left-side, right-side, both
            or neither. Defaults to 'right'.
        name : object, optional
            Name to be stored in the index.
        copy : boolean, default False
            by-default copy the data, this is compat only and ignored

        Examples
        --------

        """
        left = []
        right = []
        for d in data:

            if isnull(d):
                left.append(np.nan)
                right.append(np.nan)
                continue

            l, r = d
            left.append(l)
            right.append(r)

        # TODO
        # if we have nulls and we previous had *only*
        # integer data, then we have changed the dtype

        return cls.from_arrays(left, right, closed, name=name, copy=False)

    def to_tuples(self):
        return Index(com._asarray_tuplesafe(zip(self.left, self.right)))

    @cache_readonly
    def _multiindex(self):
        return MultiIndex.from_arrays([self.left, self.right],
                                      names=['left', 'right'])

    @property
    def left(self):
        return self._left

    @property
    def right(self):
        return self._right

    @property
    def closed(self):
        return self._closed

    def __len__(self):
        return len(self.left)

    @cache_readonly
    def values(self):
        """
        Returns the IntervalIndex's data as a numpy array of Interval
        objects (with dtype='object')
        """
        left = self.left
        right = self.right
        mask = self._isnan
        closed = self._closed

        result = np.empty(len(left), dtype=object)
        for i in range(len(left)):
            if mask[i]:
                result[i] = np.nan
            else:
                result[i] = Interval(left[i], right[i], closed)
        return result

    def __array__(self, result=None):
        """ the array interface, return my values """
        return self.values

    def __array_wrap__(self, result, context=None):
        # we don't want the superclass implementation
        return result

    def _array_values(self):
        return self.values

    def __reduce__(self):
        d = dict(left=self.left,
                 right=self.right)
        d.update(self._get_attributes_dict())
        return _new_IntervalIndex, (self.__class__, d), None

    @Appender(_index_shared_docs['copy'])
    def copy(self, deep=False, name=None):
        left = self.left.copy(deep=True) if deep else self.left
        right = self.right.copy(deep=True) if deep else self.right
        name = name if name is not None else self.name
        return type(self).from_arrays(left, right, name=name)

    @Appender(_index_shared_docs['astype'])
    def astype(self, dtype, copy=True):
        if is_interval_dtype(dtype):
            if copy:
                self = self.copy()
            return self
        elif is_object_dtype(dtype):
            return Index(self.values, dtype=object)
        elif is_categorical_dtype(dtype):
            from pandas import Categorical
            return Categorical(self, ordered=True)
        raise ValueError('Cannot cast IntervalIndex to dtype %s' % dtype)

    @cache_readonly
    def dtype(self):
        return IntervalDtype.construct_from_string(str(self.left.dtype))

    @property
    def inferred_type(self):
        return 'interval'

    @Appender(Index.memory_usage.__doc__)
    def memory_usage(self, deep=False):
        # we don't use an explict engine
        # so return the bytes here
        return (self.left.memory_usage(deep=deep) +
                self.right.memory_usage(deep=deep))

    @cache_readonly
    def mid(self):
        """Returns the mid-point of each interval in the index as an array
        """
        try:
            return Index(0.5 * (self.left.values + self.right.values))
        except TypeError:
            # datetime safe version
            delta = self.right.values - self.left.values
            return Index(self.left.values + 0.5 * delta)

    @cache_readonly
    def is_monotonic(self):
        return self._multiindex.is_monotonic

    @cache_readonly
    def is_monotonic_increasing(self):
        return self._multiindex.is_monotonic_increasing

    @cache_readonly
    def is_monotonic_decreasing(self):
        return self._multiindex.is_monotonic_decreasing

    @cache_readonly
    def is_unique(self):
        return self._multiindex.is_unique

    @cache_readonly
    def is_non_overlapping_monotonic(self):
        # must be increasing  (e.g., [0, 1), [1, 2), [2, 3), ... )
        # or decreasing (e.g., [-1, 0), [-2, -1), [-3, -2), ...)
        # we already require left <= right
        return ((self.right[:-1] <= self.left[1:]).all() or
                (self.left[:-1] >= self.right[1:]).all())

    @Appender(_index_shared_docs['_convert_scalar_indexer'])
    def _convert_scalar_indexer(self, key, kind=None):
        if kind == 'iloc':
            return super(IntervalIndex, self)._convert_scalar_indexer(
                key, kind=kind)
        return key

    def _maybe_cast_slice_bound(self, label, side, kind):
        return getattr(self, side)._maybe_cast_slice_bound(label, side, kind)

    @Appender(_index_shared_docs['_convert_list_indexer'])
    def _convert_list_indexer(self, keyarr, kind=None):
        """
        we are passed a list-like indexer. Return the
        indexer for matching intervals.
        """
        locs = self.get_indexer_for(keyarr)

        # we have missing values
        if (locs == -1).any():
            raise KeyError

        return locs

    def _maybe_cast_indexed(self, key):
        """
        we need to cast the key, which could be a scalar
        or an array-like to the type of our subtype
        """
        if isinstance(key, IntervalIndex):
            return key

        subtype = self.dtype.subtype
        if is_float_dtype(subtype):
            if is_integer(key):
                key = float(key)
            elif isinstance(key, (np.ndarray, Index)):
                key = key.astype('float64')
        elif is_integer_dtype(subtype):
            if is_integer(key):
                key = int(key)

        return key

    def _check_method(self, method):
        if method is None:
            return

        if method in ['bfill', 'backfill', 'pad', 'ffill', 'nearest']:
            raise NotImplementedError(
                'method {} not yet implemented for '
                'IntervalIndex'.format(method))

        raise ValueError("Invalid fill method")

    def _searchsorted_monotonic(self, label, side, exclude_label=False):
        if not self.is_non_overlapping_monotonic:
            raise KeyError('can only get slices from an IntervalIndex if '
                           'bounds are non-overlapping and all monotonic '
                           'increasing or decreasing')

        if isinstance(label, IntervalMixin):
            raise NotImplementedError

        if ((side == 'left' and self.left.is_monotonic_increasing) or
                (side == 'right' and self.left.is_monotonic_decreasing)):
            sub_idx = self.right
            if self.open_right or exclude_label:
                label = _get_next_label(label)
        else:
            sub_idx = self.left
            if self.open_left or exclude_label:
                label = _get_prev_label(label)

        return sub_idx._searchsorted_monotonic(label, side)

    def _get_loc_only_exact_matches(self, key):
        if isinstance(key, Interval):

            if not self.is_unique:
                raise ValueError("cannot index with a slice Interval"
                                 " and a non-unique index")

            # TODO: this expands to a tuple index, see if we can
            # do better
            return Index(self._multiindex.values).get_loc(key)
        raise KeyError

    def _find_non_overlapping_monotonic_bounds(self, key):
        if isinstance(key, IntervalMixin):
            start = self._searchsorted_monotonic(
                key.left, 'left', exclude_label=key.open_left)
            stop = self._searchsorted_monotonic(
                key.right, 'right', exclude_label=key.open_right)
        elif isinstance(key, slice):
            # slice
            start, stop = key.start, key.stop
            if (key.step or 1) != 1:
                raise NotImplementedError("cannot slice with a slice step")
            if start is None:
                start = 0
            else:
                start = self._searchsorted_monotonic(start, 'left')
            if stop is None:
                stop = len(self)
            else:
                stop = self._searchsorted_monotonic(stop, 'right')
        else:
            # scalar or index-like

            start = self._searchsorted_monotonic(key, 'left')
            stop = self._searchsorted_monotonic(key, 'right')
        return start, stop

    def get_loc(self, key, method=None):
        self._check_method(method)

        original_key = key
        key = self._maybe_cast_indexed(key)

        if self.is_non_overlapping_monotonic:
            if isinstance(key, Interval):
                left = self._maybe_cast_slice_bound(key.left, 'left', None)
                right = self._maybe_cast_slice_bound(key.right, 'right', None)
                key = Interval(left, right, key.closed)
            else:
                key = self._maybe_cast_slice_bound(key, 'left', None)

            start, stop = self._find_non_overlapping_monotonic_bounds(key)

            if start is None or stop is None:
                return slice(start, stop)
            elif start + 1 == stop:
                return start
            elif start < stop:
                return slice(start, stop)
            else:
                raise KeyError(original_key)

        else:
            # use the interval tree
            if isinstance(key, Interval):
                left, right = _get_interval_closed_bounds(key)
                return self._engine.get_loc_interval(left, right)
            else:
                return self._engine.get_loc(key)

    def get_value(self, series, key):
        if com.is_bool_indexer(key):
            loc = key
        elif is_list_like(key):
            loc = self.get_indexer(key)
        elif isinstance(key, slice):

            if not (key.step is None or key.step == 1):
                raise ValueError("cannot support not-default "
                                 "step in a slice")

            try:
                loc = self.get_loc(key)
            except TypeError:

                # we didn't find exact intervals
                # or are non-unique
                raise ValueError("unable to slice with "
                                 "this key: {}".format(key))

        else:
            loc = self.get_loc(key)
        return series.iloc[loc]

    @Appender(_index_shared_docs['get_indexer'] % _index_doc_kwargs)
    def get_indexer(self, target, method=None, limit=None, tolerance=None):

        self._check_method(method)
        target = _ensure_index(target)
        target = self._maybe_cast_indexed(target)

        if self.equals(target):
            return np.arange(len(self), dtype='intp')

        if self.is_non_overlapping_monotonic:
            start, stop = self._find_non_overlapping_monotonic_bounds(target)

            start_plus_one = start + 1
            if not ((start_plus_one < stop).any()):
                return np.where(start_plus_one == stop, start, -1)

        if not self.is_unique:
            raise ValueError("cannot handle non-unique indices")

        # IntervalIndex
        if isinstance(target, IntervalIndex):
            indexer = self._get_reindexer(target)

        # non IntervalIndex
        else:
            indexer = np.concatenate([self.get_loc(i) for i in target])

        return _ensure_platform_int(indexer)

    def _get_reindexer(self, target):
        """
        Return an indexer for a target IntervalIndex with self
        """

        # find the left and right indexers
        lindexer = self._engine.get_indexer(target.left.values)
        rindexer = self._engine.get_indexer(target.right.values)

        # we want to return an indexer on the intervals
        # however, our keys could provide overlapping of multiple
        # intervals, so we iterate thru the indexers and construct
        # a set of indexers

        indexer = []
        n = len(self)

        for i, (l, r) in enumerate(zip(lindexer, rindexer)):

            target_value = target[i]

            # matching on the lhs bound
            if (l != -1 and
                    self.closed == 'right' and
                    target_value.left == self[l].right):
                l += 1

            # matching on the lhs bound
            if (r != -1 and
                    self.closed == 'left' and
                    target_value.right == self[r].left):
                r -= 1

            # not found
            if l == -1 and r == -1:
                indexer.append(np.array([-1]))

            elif r == -1:

                indexer.append(np.arange(l, n))

            elif l == -1:

                # care about left/right closed here
                value = self[i]

                # target.closed same as self.closed
                if self.closed == target.closed:
                    if target_value.left < value.left:
                        indexer.append(np.array([-1]))
                        continue

                # target.closed == 'left'
                elif self.closed == 'right':
                    if target_value.left <= value.left:
                        indexer.append(np.array([-1]))
                        continue

                # target.closed == 'right'
                elif self.closed == 'left':
                    if target_value.left <= value.left:
                        indexer.append(np.array([-1]))
                        continue

                indexer.append(np.arange(0, r + 1))

            else:
                indexer.append(np.arange(l, r + 1))

        return np.concatenate(indexer)

    @Appender(_index_shared_docs['get_indexer_non_unique'] % _index_doc_kwargs)
    def get_indexer_non_unique(self, target):
        target = self._maybe_cast_indexed(_ensure_index(target))
        return super(IntervalIndex, self).get_indexer_non_unique(target)

    @Appender(_index_shared_docs['where'])
    def where(self, cond, other=None):
        if other is None:
            other = self._na_value
        values = np.where(cond, self.values, other)
        return self._shallow_copy(values)

    def delete(self, loc):
        new_left = self.left.delete(loc)
        new_right = self.right.delete(loc)
        return self._shallow_copy(new_left, new_right)

    def insert(self, loc, item):
        if not isinstance(item, Interval):
            raise ValueError('can only insert Interval objects into an '
                             'IntervalIndex')
        if not item.closed == self.closed:
            raise ValueError('inserted item must be closed on the same side '
                             'as the index')
        new_left = self.left.insert(loc, item.left)
        new_right = self.right.insert(loc, item.right)
        return self._shallow_copy(new_left, new_right)

    def _as_like_interval_index(self, other, error_msg):
        self._assert_can_do_setop(other)
        other = _ensure_index(other)
        if (not isinstance(other, IntervalIndex) or
                self.closed != other.closed):
            raise ValueError(error_msg)
        return other

    def _append_same_dtype(self, to_concat, name):
        """
        assert that we all have the same .closed
        we allow a 0-len index here as well
        """
        if not len(set([i.closed for i in to_concat if len(i)])) == 1:
            msg = ('can only append two IntervalIndex objects '
                   'that are closed on the same side')
            raise ValueError(msg)
        return super(IntervalIndex, self)._append_same_dtype(to_concat, name)

    @Appender(_index_shared_docs['take'] % _index_doc_kwargs)
    def take(self, indices, axis=0, allow_fill=True,
             fill_value=None, **kwargs):
        nv.validate_take(tuple(), kwargs)
        indices = _ensure_platform_int(indices)
        left, right = self.left, self.right

        if fill_value is None:
            fill_value = self._na_value
        mask = indices == -1

        if not mask.any():
            # we won't change dtype here in this case
            # if we don't need
            allow_fill = False

        taker = lambda x: x.take(indices, allow_fill=allow_fill,
                                 fill_value=fill_value)

        try:
            new_left = taker(left)
            new_right = taker(right)
        except ValueError:

            # we need to coerce; migth have NA's in an
            # interger dtype
            new_left = taker(left.astype(float))
            new_right = taker(right.astype(float))

        return self._shallow_copy(new_left, new_right)

    def __getitem__(self, value):
        mask = self._isnan[value]
        if is_scalar(mask) and mask:
            return self._na_value

        left = self.left[value]
        right = self.right[value]

        # scalar
        if not isinstance(left, Index):
            return Interval(left, right, self.closed)

        return self._shallow_copy(left, right)

    # __repr__ associated methods are based on MultiIndex

    def _format_with_header(self, header, **kwargs):
        return header + list(self._format_native_types(**kwargs))

    def _format_native_types(self, na_rep='', quoting=None, **kwargs):
        """ actually format my specific types """
        from pandas.io.formats.format import IntervalArrayFormatter
        return IntervalArrayFormatter(values=self,
                                      na_rep=na_rep,
                                      justify='all').get_result()

    def _format_data(self):

        # TODO: integrate with categorical and make generic
        n = len(self)
        max_seq_items = min((get_option(
            'display.max_seq_items') or n) // 10, 10)

        formatter = str

        if n == 0:
            summary = '[]'
        elif n == 1:
            first = formatter(self[0])
            summary = '[{}]'.format(first)
        elif n == 2:
            first = formatter(self[0])
            last = formatter(self[-1])
            summary = '[{}, {}]'.format(first, last)
        else:

            if n > max_seq_items:
                n = min(max_seq_items // 2, 10)
                head = [formatter(x) for x in self[:n]]
                tail = [formatter(x) for x in self[-n:]]
                summary = '[{} ... {}]'.format(', '.join(head),
                                               ', '.join(tail))
            else:
                head = []
                tail = [formatter(x) for x in self]
                summary = '[{}]'.format(', '.join(tail))

        return summary + self._format_space()

    def _format_attrs(self):
        attrs = [('closed', repr(self.closed))]
        if self.name is not None:
            attrs.append(('name', default_pprint(self.name)))
        attrs.append(('dtype', "'%s'" % self.dtype))
        return attrs

    def _format_space(self):
        return "\n%s" % (' ' * (len(self.__class__.__name__) + 1))

    def argsort(self, *args, **kwargs):
        return np.lexsort((self.right, self.left))

    def equals(self, other):

        if self.is_(other):
            return True

        # if we can coerce to an II
        # then we can compare
        if not isinstance(other, IntervalIndex):
            if not is_interval_dtype(other):
                return False
            other = Index(getattr(other, '.values', other))

        return (self.left.equals(other.left) and
                self.right.equals(other.right) and
                self.closed == other.closed)

    def _setop(op_name):
        def func(self, other):
            msg = ('can only do set operations between two IntervalIndex '
                   'objects that are closed on the same side')
            other = self._as_like_interval_index(other, msg)
            result = getattr(self._multiindex, op_name)(other._multiindex)
            result_name = self.name if self.name == other.name else None
            return type(self).from_tuples(result.values, closed=self.closed,
                                          name=result_name)
        return func

    union = _setop('union')
    intersection = _setop('intersection')
    difference = _setop('difference')
    symmetric_differnce = _setop('symmetric_difference')

    # TODO: arithmetic operations


IntervalIndex._add_logical_methods_disabled()


def interval_range(start=None, end=None, freq=None, periods=None,
                   name=None, closed='right', **kwargs):
    """
    Return a fixed frequency IntervalIndex

    Parameters
    ----------
    start : string or datetime-like, default None
        Left bound for generating data
    end : string or datetime-like, default None
        Right bound for generating data
    freq : interger, string or DateOffset, default 1
    periods : interger, default None
    name : str, default None
        Name of the resulting index
    closed : string, default 'right'
        options are: 'left', 'right', 'both', 'neither'

    Notes
    -----
    2 of start, end, or periods must be specified

    Returns
    -------
    rng : IntervalIndex
    """

    if freq is None:
        freq = 1

    if start is None:
        if periods is None or end is None:
            raise ValueError("must specify 2 of start, end, periods")
        start = end - periods * freq
    elif end is None:
        if periods is None or start is None:
            raise ValueError("must specify 2 of start, end, periods")
        end = start + periods * freq
    elif periods is None:
        if start is None or end is None:
            raise ValueError("must specify 2 of start, end, periods")
        pass

    # must all be same units or None
    arr = np.array([start, end, freq])
    if is_object_dtype(arr):
        raise ValueError("start, end, freq need to be the same type")

    return IntervalIndex.from_breaks(np.arange(start, end, freq),
                                     name=name,
                                     closed=closed)
