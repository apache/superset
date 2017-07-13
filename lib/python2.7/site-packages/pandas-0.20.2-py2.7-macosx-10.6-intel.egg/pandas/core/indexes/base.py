import datetime
import warnings
import operator

import numpy as np
from pandas._libs import (lib, index as libindex, tslib as libts,
                          algos as libalgos, join as libjoin,
                          Timestamp, Timedelta, )
from pandas._libs.lib import is_datetime_array

from pandas.compat import range, u
from pandas.compat.numpy import function as nv
from pandas import compat


from pandas.core.dtypes.generic import ABCSeries, ABCMultiIndex, ABCPeriodIndex
from pandas.core.dtypes.missing import isnull, array_equivalent
from pandas.core.dtypes.common import (
    _ensure_int64,
    _ensure_object,
    _ensure_categorical,
    _ensure_platform_int,
    is_integer,
    is_float,
    is_dtype_equal,
    is_object_dtype,
    is_categorical_dtype,
    is_interval_dtype,
    is_bool_dtype,
    is_signed_integer_dtype,
    is_unsigned_integer_dtype,
    is_integer_dtype, is_float_dtype,
    is_datetime64_any_dtype,
    is_timedelta64_dtype,
    needs_i8_conversion,
    is_iterator, is_list_like,
    is_scalar)
from pandas.core.common import (is_bool_indexer,
                                _values_from_object,
                                _asarray_tuplesafe)

from pandas.core.base import PandasObject, IndexOpsMixin
import pandas.core.base as base
from pandas.util._decorators import (Appender, Substitution, cache_readonly,
                                     deprecate, deprecate_kwarg)
from pandas.core.indexes.frozen import FrozenList
import pandas.core.common as com
import pandas.core.dtypes.concat as _concat
import pandas.core.missing as missing
import pandas.core.algorithms as algos
from pandas.io.formats.printing import pprint_thing
from pandas.core.ops import _comp_method_OBJECT_ARRAY
from pandas.core.strings import StringAccessorMixin
from pandas.core.config import get_option


# simplify
default_pprint = lambda x, max_seq_items=None: \
    pprint_thing(x, escape_chars=('\t', '\r', '\n'), quote_strings=True,
                 max_seq_items=max_seq_items)

__all__ = ['Index']

_unsortable_types = frozenset(('mixed', 'mixed-integer'))

_index_doc_kwargs = dict(klass='Index', inplace='',
                         target_klass='Index',
                         unique='Index', duplicated='np.ndarray')
_index_shared_docs = dict()


def _try_get_item(x):
    try:
        return x.item()
    except AttributeError:
        return x


class InvalidIndexError(Exception):
    pass


_o_dtype = np.dtype(object)
_Identity = object


def _new_Index(cls, d):
    """ This is called upon unpickling, rather than the default which doesn't
    have arguments and breaks __new__
    """
    # required for backward compat, because PI can't be instantiated with
    # ordinals through __new__ GH #13277
    if issubclass(cls, ABCPeriodIndex):
        from pandas.core.indexes.period import _new_PeriodIndex
        return _new_PeriodIndex(cls, **d)
    return cls.__new__(cls, **d)


class Index(IndexOpsMixin, StringAccessorMixin, PandasObject):
    """
    Immutable ndarray implementing an ordered, sliceable set. The basic object
    storing axis labels for all pandas objects

    Parameters
    ----------
    data : array-like (1-dimensional)
    dtype : NumPy dtype (default: object)
    copy : bool
        Make a copy of input ndarray
    name : object
        Name to be stored in the index
    tupleize_cols : bool (default: True)
        When True, attempt to create a MultiIndex if possible

    Notes
    -----
    An Index instance can **only** contain hashable objects
    """
    # To hand over control to subclasses
    _join_precedence = 1

    # Cython methods
    _arrmap = libalgos.arrmap_object
    _left_indexer_unique = libjoin.left_join_indexer_unique_object
    _left_indexer = libjoin.left_join_indexer_object
    _inner_indexer = libjoin.inner_join_indexer_object
    _outer_indexer = libjoin.outer_join_indexer_object
    _box_scalars = False

    _typ = 'index'
    _data = None
    _id = None
    name = None
    asi8 = None
    _comparables = ['name']
    _attributes = ['name']
    _allow_index_ops = True
    _allow_datetime_index_ops = False
    _allow_period_index_ops = False
    _is_numeric_dtype = False
    _can_hold_na = True

    # would we like our indexing holder to defer to us
    _defer_to_indexing = False

    # prioritize current class for _shallow_copy_with_infer,
    # used to infer integers as datetime-likes
    _infer_as_myclass = False

    _engine_type = libindex.ObjectEngine

    def __new__(cls, data=None, dtype=None, copy=False, name=None,
                fastpath=False, tupleize_cols=True, **kwargs):

        if name is None and hasattr(data, 'name'):
            name = data.name

        if fastpath:
            return cls._simple_new(data, name)

        from .range import RangeIndex

        # range
        if isinstance(data, RangeIndex):
            return RangeIndex(start=data, copy=copy, dtype=dtype, name=name)
        elif isinstance(data, range):
            return RangeIndex.from_range(data, copy=copy, dtype=dtype,
                                         name=name)

        # categorical
        if is_categorical_dtype(data) or is_categorical_dtype(dtype):
            from .category import CategoricalIndex
            return CategoricalIndex(data, copy=copy, name=name, **kwargs)

        # interval
        if is_interval_dtype(data):
            from .interval import IntervalIndex
            return IntervalIndex.from_intervals(data, name=name,
                                                copy=copy)

        # index-like
        elif isinstance(data, (np.ndarray, Index, ABCSeries)):

            if (is_datetime64_any_dtype(data) or
                (dtype is not None and is_datetime64_any_dtype(dtype)) or
                    'tz' in kwargs):
                from pandas.core.indexes.datetimes import DatetimeIndex
                result = DatetimeIndex(data, copy=copy, name=name,
                                       dtype=dtype, **kwargs)
                if dtype is not None and is_dtype_equal(_o_dtype, dtype):
                    return Index(result.to_pydatetime(), dtype=_o_dtype)
                else:
                    return result

            elif (is_timedelta64_dtype(data) or
                  (dtype is not None and is_timedelta64_dtype(dtype))):
                from pandas.core.indexes.timedeltas import TimedeltaIndex
                result = TimedeltaIndex(data, copy=copy, name=name, **kwargs)
                if dtype is not None and _o_dtype == dtype:
                    return Index(result.to_pytimedelta(), dtype=_o_dtype)
                else:
                    return result

            if dtype is not None:
                try:

                    # we need to avoid having numpy coerce
                    # things that look like ints/floats to ints unless
                    # they are actually ints, e.g. '0' and 0.0
                    # should not be coerced
                    # GH 11836
                    if is_integer_dtype(dtype):
                        inferred = lib.infer_dtype(data)
                        if inferred == 'integer':
                            data = np.array(data, copy=copy, dtype=dtype)
                        elif inferred in ['floating', 'mixed-integer-float']:
                            if isnull(data).any():
                                raise ValueError('cannot convert float '
                                                 'NaN to integer')

                            # If we are actually all equal to integers,
                            # then coerce to integer.
                            try:
                                return cls._try_convert_to_int_index(
                                    data, copy, name)
                            except ValueError:
                                pass

                            # Return an actual float index.
                            from .numeric import Float64Index
                            return Float64Index(data, copy=copy, dtype=dtype,
                                                name=name)

                        elif inferred == 'string':
                            pass
                        else:
                            data = data.astype(dtype)
                    elif is_float_dtype(dtype):
                        inferred = lib.infer_dtype(data)
                        if inferred == 'string':
                            pass
                        else:
                            data = data.astype(dtype)
                    else:
                        data = np.array(data, dtype=dtype, copy=copy)

                except (TypeError, ValueError) as e:
                    msg = str(e)
                    if 'cannot convert float' in msg:
                        raise

            # maybe coerce to a sub-class
            from pandas.core.indexes.period import (
                PeriodIndex, IncompatibleFrequency)
            if isinstance(data, PeriodIndex):
                return PeriodIndex(data, copy=copy, name=name, **kwargs)
            if is_signed_integer_dtype(data.dtype):
                from .numeric import Int64Index
                return Int64Index(data, copy=copy, dtype=dtype, name=name)
            elif is_unsigned_integer_dtype(data.dtype):
                from .numeric import UInt64Index
                return UInt64Index(data, copy=copy, dtype=dtype, name=name)
            elif is_float_dtype(data.dtype):
                from .numeric import Float64Index
                return Float64Index(data, copy=copy, dtype=dtype, name=name)
            elif issubclass(data.dtype.type, np.bool) or is_bool_dtype(data):
                subarr = data.astype('object')
            else:
                subarr = _asarray_tuplesafe(data, dtype=object)

            # _asarray_tuplesafe does not always copy underlying data,
            # so need to make sure that this happens
            if copy:
                subarr = subarr.copy()

            if dtype is None:
                inferred = lib.infer_dtype(subarr)
                if inferred == 'integer':
                    try:
                        return cls._try_convert_to_int_index(
                            subarr, copy, name)
                    except ValueError:
                        pass

                    return Index(subarr, copy=copy,
                                 dtype=object, name=name)
                elif inferred in ['floating', 'mixed-integer-float']:
                    from .numeric import Float64Index
                    return Float64Index(subarr, copy=copy, name=name)
                elif inferred == 'interval':
                    from .interval import IntervalIndex
                    return IntervalIndex.from_intervals(subarr, name=name,
                                                        copy=copy)
                elif inferred == 'boolean':
                    # don't support boolean explicity ATM
                    pass
                elif inferred != 'string':
                    if inferred.startswith('datetime'):
                        if (lib.is_datetime_with_singletz_array(subarr) or
                                'tz' in kwargs):
                            # only when subarr has the same tz
                            from pandas.core.indexes.datetimes import (
                                DatetimeIndex)
                            try:
                                return DatetimeIndex(subarr, copy=copy,
                                                     name=name, **kwargs)
                            except libts.OutOfBoundsDatetime:
                                pass

                    elif inferred.startswith('timedelta'):
                        from pandas.core.indexes.timedeltas import (
                            TimedeltaIndex)
                        return TimedeltaIndex(subarr, copy=copy, name=name,
                                              **kwargs)
                    elif inferred == 'period':
                        try:
                            return PeriodIndex(subarr, name=name, **kwargs)
                        except IncompatibleFrequency:
                            pass
            return cls._simple_new(subarr, name)

        elif hasattr(data, '__array__'):
            return Index(np.asarray(data), dtype=dtype, copy=copy, name=name,
                         **kwargs)
        elif data is None or is_scalar(data):
            cls._scalar_data_error(data)
        else:
            if (tupleize_cols and isinstance(data, list) and data and
                    isinstance(data[0], tuple)):

                # we must be all tuples, otherwise don't construct
                # 10697
                if all(isinstance(e, tuple) for e in data):
                    try:
                        # must be orderable in py3
                        if compat.PY3:
                            sorted(data)
                        from .multi import MultiIndex
                        return MultiIndex.from_tuples(
                            data, names=name or kwargs.get('names'))
                    except (TypeError, KeyError):
                        # python2 - MultiIndex fails on mixed types
                        pass
            # other iterable of some kind
            subarr = _asarray_tuplesafe(data, dtype=object)
            return Index(subarr, dtype=dtype, copy=copy, name=name, **kwargs)

    """
    NOTE for new Index creation:

    - _simple_new: It returns new Index with the same type as the caller.
      All metadata (such as name) must be provided by caller's responsibility.
      Using _shallow_copy is recommended because it fills these metadata
      otherwise specified.

    - _shallow_copy: It returns new Index with the same type (using
      _simple_new), but fills caller's metadata otherwise specified. Passed
      kwargs will overwrite corresponding metadata.

    - _shallow_copy_with_infer: It returns new Index inferring its type
      from passed values. It fills caller's metadata otherwise specified as the
      same as _shallow_copy.

    See each method's docstring.
    """

    @classmethod
    def _simple_new(cls, values, name=None, dtype=None, **kwargs):
        """
        we require the we have a dtype compat for the values
        if we are passed a non-dtype compat, then coerce using the constructor

        Must be careful not to recurse.
        """
        if not hasattr(values, 'dtype'):
            if values is None and dtype is not None:
                values = np.empty(0, dtype=dtype)
            else:
                values = np.array(values, copy=False)
                if is_object_dtype(values):
                    values = cls(values, name=name, dtype=dtype,
                                 **kwargs)._values

        result = object.__new__(cls)
        result._data = values
        result.name = name
        for k, v in compat.iteritems(kwargs):
            setattr(result, k, v)
        return result._reset_identity()

    _index_shared_docs['_shallow_copy'] = """
        create a new Index with the same class as the caller, don't copy the
        data, use the same object attributes with passed in attributes taking
        precedence

        *this is an internal non-public method*

        Parameters
        ----------
        values : the values to create the new Index, optional
        kwargs : updates the default attributes for this Index
        """

    @Appender(_index_shared_docs['_shallow_copy'])
    def _shallow_copy(self, values=None, **kwargs):
        if values is None:
            values = self.values
        attributes = self._get_attributes_dict()
        attributes.update(kwargs)
        return self._simple_new(values, **attributes)

    def _shallow_copy_with_infer(self, values=None, **kwargs):
        """
        create a new Index inferring the class with passed value, don't copy
        the data, use the same object attributes with passed in attributes
        taking precedence

        *this is an internal non-public method*

        Parameters
        ----------
        values : the values to create the new Index, optional
        kwargs : updates the default attributes for this Index
        """
        if values is None:
            values = self.values
        attributes = self._get_attributes_dict()
        attributes.update(kwargs)
        attributes['copy'] = False
        if self._infer_as_myclass:
            try:
                return self._constructor(values, **attributes)
            except (TypeError, ValueError):
                pass
        return Index(values, **attributes)

    def _deepcopy_if_needed(self, orig, copy=False):
        """
        .. versionadded:: 0.19.0

        Make a copy of self if data coincides (in memory) with orig.
        Subclasses should override this if self._base is not an ndarray.

        Parameters
        ----------
        orig : ndarray
            other ndarray to compare self._data against
        copy : boolean, default False
            when False, do not run any check, just return self

        Returns
        -------
        A copy of self if needed, otherwise self : Index
        """
        if copy:
            # Retrieve the "base objects", i.e. the original memory allocations
            orig = orig if orig.base is None else orig.base
            new = self._data if self._data.base is None else self._data.base
            if orig is new:
                return self.copy(deep=True)

        return self

    def _update_inplace(self, result, **kwargs):
        # guard when called from IndexOpsMixin
        raise TypeError("Index can't be updated inplace")

    def _sort_levels_monotonic(self):
        """ compat with MultiIndex """
        return self

    _index_shared_docs['_get_grouper_for_level'] = """
        Get index grouper corresponding to an index level

        Parameters
        ----------
        mapper: Group mapping function or None
            Function mapping index values to groups
        level : int or None
            Index level

        Returns
        -------
        grouper : Index
            Index of values to group on
        labels : ndarray of int or None
            Array of locations in level_index
        uniques : Index or None
            Index of unique values for level
        """

    @Appender(_index_shared_docs['_get_grouper_for_level'])
    def _get_grouper_for_level(self, mapper, level=None):
        assert level is None or level == 0
        if mapper is None:
            grouper = self
        else:
            grouper = self.map(mapper)

        return grouper, None, None

    def is_(self, other):
        """
        More flexible, faster check like ``is`` but that works through views

        Note: this is *not* the same as ``Index.identical()``, which checks
        that metadata is also the same.

        Parameters
        ----------
        other : object
            other object to compare against.

        Returns
        -------
        True if both have same underlying data, False otherwise : bool
        """
        # use something other than None to be clearer
        return self._id is getattr(
            other, '_id', Ellipsis) and self._id is not None

    def _reset_identity(self):
        """Initializes or resets ``_id`` attribute with new object"""
        self._id = _Identity()
        return self

    # ndarray compat
    def __len__(self):
        """
        return the length of the Index
        """
        return len(self._data)

    def __array__(self, dtype=None):
        """ the array interface, return my values """
        return self._data.view(np.ndarray)

    def __array_wrap__(self, result, context=None):
        """
        Gets called after a ufunc
        """
        if is_bool_dtype(result):
            return result

        attrs = self._get_attributes_dict()
        attrs = self._maybe_update_attributes(attrs)
        return Index(result, **attrs)

    @cache_readonly
    def dtype(self):
        """ return the dtype object of the underlying data """
        return self._data.dtype

    @cache_readonly
    def dtype_str(self):
        """ return the dtype str of the underlying data """
        return str(self.dtype)

    @property
    def values(self):
        """ return the underlying data as an ndarray """
        return self._data.view(np.ndarray)

    def get_values(self):
        """ return the underlying data as an ndarray """
        return self.values

    @Appender(IndexOpsMixin.memory_usage.__doc__)
    def memory_usage(self, deep=False):
        result = super(Index, self).memory_usage(deep=deep)

        # include our engine hashtable
        result += self._engine.sizeof(deep=deep)
        return result

    # ops compat
    def tolist(self):
        """
        return a list of the Index values
        """
        return list(self.values)

    @deprecate_kwarg(old_arg_name='n', new_arg_name='repeats')
    def repeat(self, repeats, *args, **kwargs):
        """
        Repeat elements of an Index. Refer to `numpy.ndarray.repeat`
        for more information about the `repeats` argument.

        See also
        --------
        numpy.ndarray.repeat
        """
        nv.validate_repeat(args, kwargs)
        return self._shallow_copy(self._values.repeat(repeats))

    _index_shared_docs['where'] = """
        .. versionadded:: 0.19.0

        Return an Index of same shape as self and whose corresponding
        entries are from self where cond is True and otherwise are from
        other.

        Parameters
        ----------
        cond : boolean array-like with the same length as self
        other : scalar, or array-like
        """

    @Appender(_index_shared_docs['where'])
    def where(self, cond, other=None):
        if other is None:
            other = self._na_value
        values = np.where(cond, self.values, other)

        dtype = self.dtype
        if self._is_numeric_dtype and np.any(isnull(values)):
            # We can't coerce to the numeric dtype of "self" (unless
            # it's float) if there are NaN values in our output.
            dtype = None

        return self._shallow_copy_with_infer(values, dtype=dtype)

    def ravel(self, order='C'):
        """
        return an ndarray of the flattened values of the underlying data

        See also
        --------
        numpy.ndarray.ravel
        """
        return self._values.ravel(order=order)

    # construction helpers
    @classmethod
    def _try_convert_to_int_index(cls, data, copy, name):
        """
        Attempt to convert an array of data into an integer index.

        Parameters
        ----------
        data : The data to convert.
        copy : Whether to copy the data or not.
        name : The name of the index returned.

        Returns
        -------
        int_index : data converted to either an Int64Index or a
                    UInt64Index

        Raises
        ------
        ValueError if the conversion was not successful.
        """

        from .numeric import Int64Index, UInt64Index
        try:
            res = data.astype('i8', copy=False)
            if (res == data).all():
                return Int64Index(res, copy=copy, name=name)
        except (OverflowError, TypeError, ValueError):
            pass

        # Conversion to int64 failed (possibly due to
        # overflow), so let's try now with uint64.
        try:
            res = data.astype('u8', copy=False)
            if (res == data).all():
                return UInt64Index(res, copy=copy, name=name)
        except (TypeError, ValueError):
            pass

        raise ValueError

    @classmethod
    def _scalar_data_error(cls, data):
        raise TypeError('{0}(...) must be called with a collection of some '
                        'kind, {1} was passed'.format(cls.__name__,
                                                      repr(data)))

    @classmethod
    def _string_data_error(cls, data):
        raise TypeError('String dtype not supported, you may need '
                        'to explicitly cast to a numeric type')

    @classmethod
    def _coerce_to_ndarray(cls, data):
        """coerces data to ndarray, raises on scalar data. Converts other
        iterables to list first and then to array. Does not touch ndarrays.
        """

        if not isinstance(data, (np.ndarray, Index)):
            if data is None or is_scalar(data):
                cls._scalar_data_error(data)

            # other iterable of some kind
            if not isinstance(data, (ABCSeries, list, tuple)):
                data = list(data)
            data = np.asarray(data)
        return data

    def _get_attributes_dict(self):
        """ return an attributes dict for my class """
        return dict([(k, getattr(self, k, None)) for k in self._attributes])

    def view(self, cls=None):

        # we need to see if we are subclassing an
        # index type here
        if cls is not None and not hasattr(cls, '_typ'):
            result = self._data.view(cls)
        else:
            result = self._shallow_copy()
        if isinstance(result, Index):
            result._id = self._id
        return result

    def _coerce_scalar_to_index(self, item):
        """
        we need to coerce a scalar to a compat for our index type

        Parameters
        ----------
        item : scalar item to coerce
        """
        dtype = self.dtype

        if self._is_numeric_dtype and isnull(item):
            # We can't coerce to the numeric dtype of "self" (unless
            # it's float) if there are NaN values in our output.
            dtype = None

        return Index([item], dtype=dtype, **self._get_attributes_dict())

    _index_shared_docs['copy'] = """
        Make a copy of this object.  Name and dtype sets those attributes on
        the new object.

        Parameters
        ----------
        name : string, optional
        deep : boolean, default False
        dtype : numpy dtype or pandas type

        Returns
        -------
        copy : Index

        Notes
        -----
        In most cases, there should be no functional difference from using
        ``deep``, but if ``deep`` is passed it will attempt to deepcopy.
        """

    @Appender(_index_shared_docs['copy'])
    def copy(self, name=None, deep=False, dtype=None, **kwargs):
        if deep:
            new_index = self._shallow_copy(self._data.copy())
        else:
            new_index = self._shallow_copy()

        names = kwargs.get('names')
        names = self._validate_names(name=name, names=names, deep=deep)
        new_index = new_index.set_names(names)

        if dtype:
            new_index = new_index.astype(dtype)
        return new_index

    def __copy__(self, **kwargs):
        return self.copy(**kwargs)

    def __deepcopy__(self, memo=None):
        if memo is None:
            memo = {}
        return self.copy(deep=True)

    def _validate_names(self, name=None, names=None, deep=False):
        """
        Handles the quirks of having a singular 'name' parameter for general
        Index and plural 'names' parameter for MultiIndex.
        """
        from copy import deepcopy
        if names is not None and name is not None:
            raise TypeError("Can only provide one of `names` and `name`")
        elif names is None and name is None:
            return deepcopy(self.names) if deep else self.names
        elif names is not None:
            if not is_list_like(names):
                raise TypeError("Must pass list-like as `names`.")
            return names
        else:
            if not is_list_like(name):
                return [name]
            return name

    def __unicode__(self):
        """
        Return a string representation for this object.

        Invoked by unicode(df) in py2 only. Yields a Unicode String in both
        py2/py3.
        """
        klass = self.__class__.__name__
        data = self._format_data()
        attrs = self._format_attrs()
        space = self._format_space()

        prepr = (u(",%s") %
                 space).join([u("%s=%s") % (k, v) for k, v in attrs])

        # no data provided, just attributes
        if data is None:
            data = ''

        res = u("%s(%s%s)") % (klass, data, prepr)

        return res

    def _format_space(self):

        # using space here controls if the attributes
        # are line separated or not (the default)

        # max_seq_items = get_option('display.max_seq_items')
        # if len(self) > max_seq_items:
        #    space = "\n%s" % (' ' * (len(klass) + 1))
        return " "

    @property
    def _formatter_func(self):
        """
        Return the formatted data as a unicode string
        """
        return default_pprint

    def _format_data(self):
        """
        Return the formatted data as a unicode string
        """
        from pandas.io.formats.console import get_console_size
        from pandas.io.formats.format import _get_adjustment
        display_width, _ = get_console_size()
        if display_width is None:
            display_width = get_option('display.width') or 80

        space1 = "\n%s" % (' ' * (len(self.__class__.__name__) + 1))
        space2 = "\n%s" % (' ' * (len(self.__class__.__name__) + 2))

        n = len(self)
        sep = ','
        max_seq_items = get_option('display.max_seq_items') or n
        formatter = self._formatter_func

        # do we want to justify (only do so for non-objects)
        is_justify = not (self.inferred_type in ('string', 'unicode') or
                          (self.inferred_type == 'categorical' and
                           is_object_dtype(self.categories)))

        # are we a truncated display
        is_truncated = n > max_seq_items

        # adj can optionaly handle unicode eastern asian width
        adj = _get_adjustment()

        def _extend_line(s, line, value, display_width, next_line_prefix):

            if (adj.len(line.rstrip()) + adj.len(value.rstrip()) >=
                    display_width):
                s += line.rstrip()
                line = next_line_prefix
            line += value
            return s, line

        def best_len(values):
            if values:
                return max([adj.len(x) for x in values])
            else:
                return 0

        if n == 0:
            summary = '[], '
        elif n == 1:
            first = formatter(self[0])
            summary = '[%s], ' % first
        elif n == 2:
            first = formatter(self[0])
            last = formatter(self[-1])
            summary = '[%s, %s], ' % (first, last)
        else:

            if n > max_seq_items:
                n = min(max_seq_items // 2, 10)
                head = [formatter(x) for x in self[:n]]
                tail = [formatter(x) for x in self[-n:]]
            else:
                head = []
                tail = [formatter(x) for x in self]

            # adjust all values to max length if needed
            if is_justify:

                # however, if we are not truncated and we are only a single
                # line, then don't justify
                if (is_truncated or
                        not (len(', '.join(head)) < display_width and
                             len(', '.join(tail)) < display_width)):
                    max_len = max(best_len(head), best_len(tail))
                    head = [x.rjust(max_len) for x in head]
                    tail = [x.rjust(max_len) for x in tail]

            summary = ""
            line = space2

            for i in range(len(head)):
                word = head[i] + sep + ' '
                summary, line = _extend_line(summary, line, word,
                                             display_width, space2)

            if is_truncated:
                # remove trailing space of last line
                summary += line.rstrip() + space2 + '...'
                line = space2

            for i in range(len(tail) - 1):
                word = tail[i] + sep + ' '
                summary, line = _extend_line(summary, line, word,
                                             display_width, space2)

            # last value: no sep added + 1 space of width used for trailing ','
            summary, line = _extend_line(summary, line, tail[-1],
                                         display_width - 2, space2)
            summary += line
            summary += '],'

            if len(summary) > (display_width):
                summary += space1
            else:  # one row
                summary += ' '

            # remove initial space
            summary = '[' + summary[len(space2):]

        return summary

    def _format_attrs(self):
        """
        Return a list of tuples of the (attr,formatted_value)
        """
        attrs = []
        attrs.append(('dtype', "'%s'" % self.dtype))
        if self.name is not None:
            attrs.append(('name', default_pprint(self.name)))
        max_seq_items = get_option('display.max_seq_items') or len(self)
        if len(self) > max_seq_items:
            attrs.append(('length', len(self)))
        return attrs

    def to_series(self, **kwargs):
        """
        Create a Series with both index and values equal to the index keys
        useful with map for returning an indexer based on an index

        Returns
        -------
        Series : dtype will be based on the type of the Index values.
        """

        from pandas import Series
        return Series(self._to_embed(),
                      index=self._shallow_copy(),
                      name=self.name)

    def _to_embed(self, keep_tz=False):
        """
        *this is an internal non-public method*

        return an array repr of this object, potentially casting to object

        """
        return self.values.copy()

    _index_shared_docs['astype'] = """
        Create an Index with values cast to dtypes. The class of a new Index
        is determined by dtype. When conversion is impossible, a ValueError
        exception is raised.

        Parameters
        ----------
        dtype : numpy dtype or pandas type
        copy : bool, default True
            By default, astype always returns a newly allocated object.
            If copy is set to False and internal requirements on dtype are
            satisfied, the original data is used to create a new Index
            or the original Index is returned.

            .. versionadded:: 0.19.0

        """

    @Appender(_index_shared_docs['astype'])
    def astype(self, dtype, copy=True):
        return Index(self.values.astype(dtype, copy=copy), name=self.name,
                     dtype=dtype)

    def _to_safe_for_reshape(self):
        """ convert to object if we are a categorical """
        return self

    def to_datetime(self, dayfirst=False):
        """
        DEPRECATED: use :meth:`pandas.to_datetime` instead.

        For an Index containing strings or datetime.datetime objects, attempt
        conversion to DatetimeIndex
        """
        warnings.warn("to_datetime is deprecated. Use pd.to_datetime(...)",
                      FutureWarning, stacklevel=2)

        from pandas.core.indexes.datetimes import DatetimeIndex
        if self.inferred_type == 'string':
            from dateutil.parser import parse
            parser = lambda x: parse(x, dayfirst=dayfirst)
            parsed = lib.try_parse_dates(self.values, parser=parser)
            return DatetimeIndex(parsed)
        else:
            return DatetimeIndex(self.values)

    def _assert_can_do_setop(self, other):
        if not is_list_like(other):
            raise TypeError('Input must be Index or array-like')
        return True

    def _convert_can_do_setop(self, other):
        if not isinstance(other, Index):
            other = Index(other, name=self.name)
            result_name = self.name
        else:
            result_name = self.name if self.name == other.name else None
        return other, result_name

    def _convert_for_op(self, value):
        """ Convert value to be insertable to ndarray """
        return value

    def _assert_can_do_op(self, value):
        """ Check value is valid for scalar op """
        if not lib.isscalar(value):
            msg = "'value' must be a scalar, passed: {0}"
            raise TypeError(msg.format(type(value).__name__))

    @property
    def nlevels(self):
        return 1

    def _get_names(self):
        return FrozenList((self.name, ))

    def _set_names(self, values, level=None):
        if len(values) != 1:
            raise ValueError('Length of new names must be 1, got %d' %
                             len(values))
        self.name = values[0]

    names = property(fset=_set_names, fget=_get_names)

    def set_names(self, names, level=None, inplace=False):
        """
        Set new names on index. Defaults to returning new index.

        Parameters
        ----------
        names : str or sequence
            name(s) to set
        level : int, level name, or sequence of int/level names (default None)
            If the index is a MultiIndex (hierarchical), level(s) to set (None
            for all levels).  Otherwise level must be None
        inplace : bool
            if True, mutates in place

        Returns
        -------
        new index (of same type and class...etc) [if inplace, returns None]

        Examples
        --------
        >>> Index([1, 2, 3, 4]).set_names('foo')
        Int64Index([1, 2, 3, 4], dtype='int64')
        >>> Index([1, 2, 3, 4]).set_names(['foo'])
        Int64Index([1, 2, 3, 4], dtype='int64')
        >>> idx = MultiIndex.from_tuples([(1, u'one'), (1, u'two'),
                                          (2, u'one'), (2, u'two')],
                                          names=['foo', 'bar'])
        >>> idx.set_names(['baz', 'quz'])
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]],
                   names=[u'baz', u'quz'])
        >>> idx.set_names('baz', level=0)
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]],
                   names=[u'baz', u'bar'])
        """
        if level is not None and self.nlevels == 1:
            raise ValueError('Level must be None for non-MultiIndex')

        if level is not None and not is_list_like(level) and is_list_like(
                names):
            raise TypeError("Names must be a string")

        if not is_list_like(names) and level is None and self.nlevels > 1:
            raise TypeError("Must pass list-like as `names`.")

        if not is_list_like(names):
            names = [names]
        if level is not None and not is_list_like(level):
            level = [level]

        if inplace:
            idx = self
        else:
            idx = self._shallow_copy()
        idx._set_names(names, level=level)
        if not inplace:
            return idx

    def rename(self, name, inplace=False):
        """
        Set new names on index. Defaults to returning new index.

        Parameters
        ----------
        name : str or list
            name to set
        inplace : bool
            if True, mutates in place

        Returns
        -------
        new index (of same type and class...etc) [if inplace, returns None]
        """
        return self.set_names([name], inplace=inplace)

    def reshape(self, *args, **kwargs):
        """
        NOT IMPLEMENTED: do not call this method, as reshaping is not
        supported for Index objects and will raise an error.

        Reshape an Index.
        """
        raise NotImplementedError("reshaping is not supported "
                                  "for Index objects")

    @property
    def _has_complex_internals(self):
        # to disable groupby tricks in MultiIndex
        return False

    def summary(self, name=None):
        if len(self) > 0:
            head = self[0]
            if (hasattr(head, 'format') and
                    not isinstance(head, compat.string_types)):
                head = head.format()
            tail = self[-1]
            if (hasattr(tail, 'format') and
                    not isinstance(tail, compat.string_types)):
                tail = tail.format()
            index_summary = ', %s to %s' % (pprint_thing(head),
                                            pprint_thing(tail))
        else:
            index_summary = ''

        if name is None:
            name = type(self).__name__
        return '%s: %s entries%s' % (name, len(self), index_summary)

    def _mpl_repr(self):
        # how to represent ourselves to matplotlib
        return self.values

    _na_value = np.nan
    """The expected NA value to use with this index."""

    # introspection
    @property
    def is_monotonic(self):
        """ alias for is_monotonic_increasing (deprecated) """
        return self._engine.is_monotonic_increasing

    @property
    def is_monotonic_increasing(self):
        """
        return if the index is monotonic increasing (only equal or
        increasing) values.

        Examples
        --------
        >>> Index([1, 2, 3]).is_monotonic_increasing
        True
        >>> Index([1, 2, 2]).is_monotonic_increasing
        True
        >>> Index([1, 3, 2]).is_monotonic_increasing
        False
        """
        return self._engine.is_monotonic_increasing

    @property
    def is_monotonic_decreasing(self):
        """
        return if the index is monotonic decreasing (only equal or
        decreasing) values.

        Examples
        --------
        >>> Index([3, 2, 1]).is_monotonic_decreasing
        True
        >>> Index([3, 2, 2]).is_monotonic_decreasing
        True
        >>> Index([3, 1, 2]).is_monotonic_decreasing
        False
        """
        return self._engine.is_monotonic_decreasing

    @property
    def _is_strictly_monotonic_increasing(self):
        """return if the index is strictly monotonic increasing
        (only increasing) values

        Examples
        --------
        >>> Index([1, 2, 3])._is_strictly_monotonic_increasing
        True
        >>> Index([1, 2, 2])._is_strictly_monotonic_increasing
        False
        >>> Index([1, 3, 2])._is_strictly_monotonic_increasing
        False
        """
        return self.is_unique and self.is_monotonic_increasing

    @property
    def _is_strictly_monotonic_decreasing(self):
        """return if the index is strictly monotonic decreasing
        (only decreasing) values

        Examples
        --------
        >>> Index([3, 2, 1])._is_strictly_monotonic_decreasing
        True
        >>> Index([3, 2, 2])._is_strictly_monotonic_decreasing
        False
        >>> Index([3, 1, 2])._is_strictly_monotonic_decreasing
        False
        """
        return self.is_unique and self.is_monotonic_decreasing

    def is_lexsorted_for_tuple(self, tup):
        return True

    @cache_readonly(allow_setting=True)
    def is_unique(self):
        """ return if the index has unique values """
        return self._engine.is_unique

    @property
    def has_duplicates(self):
        return not self.is_unique

    def is_boolean(self):
        return self.inferred_type in ['boolean']

    def is_integer(self):
        return self.inferred_type in ['integer']

    def is_floating(self):
        return self.inferred_type in ['floating', 'mixed-integer-float']

    def is_numeric(self):
        return self.inferred_type in ['integer', 'floating']

    def is_object(self):
        return is_object_dtype(self.dtype)

    def is_categorical(self):
        return self.inferred_type in ['categorical']

    def is_interval(self):
        return self.inferred_type in ['interval']

    def is_mixed(self):
        return self.inferred_type in ['mixed']

    def holds_integer(self):
        return self.inferred_type in ['integer', 'mixed-integer']

    _index_shared_docs['_convert_scalar_indexer'] = """
        Convert a scalar indexer.

        Parameters
        ----------
        key : label of the slice bound
        kind : {'ix', 'loc', 'getitem', 'iloc'} or None
    """

    @Appender(_index_shared_docs['_convert_scalar_indexer'])
    def _convert_scalar_indexer(self, key, kind=None):
        assert kind in ['ix', 'loc', 'getitem', 'iloc', None]

        if kind == 'iloc':
            return self._validate_indexer('positional', key, kind)

        if len(self) and not isinstance(self, ABCMultiIndex,):

            # we can raise here if we are definitive that this
            # is positional indexing (eg. .ix on with a float)
            # or label indexing if we are using a type able
            # to be represented in the index

            if kind in ['getitem', 'ix'] and is_float(key):
                if not self.is_floating():
                    return self._invalid_indexer('label', key)

            elif kind in ['loc'] and is_float(key):

                # we want to raise KeyError on string/mixed here
                # technically we *could* raise a TypeError
                # on anything but mixed though
                if self.inferred_type not in ['floating',
                                              'mixed-integer-float',
                                              'string',
                                              'unicode',
                                              'mixed']:
                    return self._invalid_indexer('label', key)

            elif kind in ['loc'] and is_integer(key):
                if not self.holds_integer():
                    return self._invalid_indexer('label', key)

        return key

    _index_shared_docs['_convert_slice_indexer'] = """
        Convert a slice indexer.

        By definition, these are labels unless 'iloc' is passed in.
        Floats are not allowed as the start, step, or stop of the slice.

        Parameters
        ----------
        key : label of the slice bound
        kind : {'ix', 'loc', 'getitem', 'iloc'} or None
    """

    @Appender(_index_shared_docs['_convert_slice_indexer'])
    def _convert_slice_indexer(self, key, kind=None):
        assert kind in ['ix', 'loc', 'getitem', 'iloc', None]

        # if we are not a slice, then we are done
        if not isinstance(key, slice):
            return key

        # validate iloc
        if kind == 'iloc':
            return slice(self._validate_indexer('slice', key.start, kind),
                         self._validate_indexer('slice', key.stop, kind),
                         self._validate_indexer('slice', key.step, kind))

        # potentially cast the bounds to integers
        start, stop, step = key.start, key.stop, key.step

        # figure out if this is a positional indexer
        def is_int(v):
            return v is None or is_integer(v)

        is_null_slicer = start is None and stop is None
        is_index_slice = is_int(start) and is_int(stop)
        is_positional = is_index_slice and not self.is_integer()

        if kind == 'getitem':
            """
            called from the getitem slicers, validate that we are in fact
            integers
            """
            if self.is_integer() or is_index_slice:
                return slice(self._validate_indexer('slice', key.start, kind),
                             self._validate_indexer('slice', key.stop, kind),
                             self._validate_indexer('slice', key.step, kind))

        # convert the slice to an indexer here

        # if we are mixed and have integers
        try:
            if is_positional and self.is_mixed():
                # TODO: i, j are not used anywhere
                if start is not None:
                    i = self.get_loc(start)  # noqa
                if stop is not None:
                    j = self.get_loc(stop)  # noqa
                is_positional = False
        except KeyError:
            if self.inferred_type == 'mixed-integer-float':
                raise

        if is_null_slicer:
            indexer = key
        elif is_positional:
            indexer = key
        else:
            try:
                indexer = self.slice_indexer(start, stop, step, kind=kind)
            except Exception:
                if is_index_slice:
                    if self.is_integer():
                        raise
                    else:
                        indexer = key
                else:
                    raise

        return indexer

    def _convert_listlike_indexer(self, keyarr, kind=None):
        """
        Parameters
        ----------
        keyarr : list-like
            Indexer to convert.

        Returns
        -------
        tuple (indexer, keyarr)
            indexer is an ndarray or None if cannot convert
            keyarr are tuple-safe keys
        """
        if isinstance(keyarr, Index):
            keyarr = self._convert_index_indexer(keyarr)
        else:
            keyarr = self._convert_arr_indexer(keyarr)

        indexer = self._convert_list_indexer(keyarr, kind=kind)
        return indexer, keyarr

    _index_shared_docs['_convert_arr_indexer'] = """
        Convert an array-like indexer to the appropriate dtype.

        Parameters
        ----------
        keyarr : array-like
            Indexer to convert.

        Returns
        -------
        converted_keyarr : array-like
    """

    @Appender(_index_shared_docs['_convert_arr_indexer'])
    def _convert_arr_indexer(self, keyarr):
        keyarr = _asarray_tuplesafe(keyarr)
        return keyarr

    _index_shared_docs['_convert_index_indexer'] = """
        Convert an Index indexer to the appropriate dtype.

        Parameters
        ----------
        keyarr : Index (or sub-class)
            Indexer to convert.

        Returns
        -------
        converted_keyarr : Index (or sub-class)
    """

    @Appender(_index_shared_docs['_convert_index_indexer'])
    def _convert_index_indexer(self, keyarr):
        return keyarr

    _index_shared_docs['_convert_list_indexer'] = """
        Convert a list-like indexer to the appropriate dtype.

        Parameters
        ----------
        keyarr : Index (or sub-class)
            Indexer to convert.
        kind : iloc, ix, loc, optional

        Returns
        -------
        positional indexer or None
    """

    @Appender(_index_shared_docs['_convert_list_indexer'])
    def _convert_list_indexer(self, keyarr, kind=None):
        if (kind in [None, 'iloc', 'ix'] and
                is_integer_dtype(keyarr) and not self.is_floating() and
                not isinstance(keyarr, ABCPeriodIndex)):

            if self.inferred_type == 'mixed-integer':
                indexer = self.get_indexer(keyarr)
                if (indexer >= 0).all():
                    return indexer
                # missing values are flagged as -1 by get_indexer and negative
                # indices are already converted to positive indices in the
                # above if-statement, so the negative flags are changed to
                # values outside the range of indices so as to trigger an
                # IndexError in maybe_convert_indices
                indexer[indexer < 0] = len(self)
                from pandas.core.indexing import maybe_convert_indices
                return maybe_convert_indices(indexer, len(self))

            elif not self.inferred_type == 'integer':
                keyarr = np.where(keyarr < 0, len(self) + keyarr, keyarr)
                return keyarr

        return None

    def _invalid_indexer(self, form, key):
        """ consistent invalid indexer message """
        raise TypeError("cannot do {form} indexing on {klass} with these "
                        "indexers [{key}] of {kind}".format(
                            form=form, klass=type(self), key=key,
                            kind=type(key)))

    def get_duplicates(self):
        from collections import defaultdict
        counter = defaultdict(lambda: 0)
        for k in self.values:
            counter[k] += 1
        return sorted(k for k, v in compat.iteritems(counter) if v > 1)

    _get_duplicates = get_duplicates

    def _cleanup(self):
        self._engine.clear_mapping()

    @cache_readonly
    def _constructor(self):
        return type(self)

    @cache_readonly
    def _engine(self):
        # property, for now, slow to look up
        return self._engine_type(lambda: self._values, len(self))

    def _validate_index_level(self, level):
        """
        Validate index level.

        For single-level Index getting level number is a no-op, but some
        verification must be done like in MultiIndex.

        """
        if isinstance(level, int):
            if level < 0 and level != -1:
                raise IndexError("Too many levels: Index has only 1 level,"
                                 " %d is not a valid level number" % (level, ))
            elif level > 0:
                raise IndexError("Too many levels:"
                                 " Index has only 1 level, not %d" %
                                 (level + 1))
        elif level != self.name:
            raise KeyError('Level %s must be same as name (%s)' %
                           (level, self.name))

    def _get_level_number(self, level):
        self._validate_index_level(level)
        return 0

    @cache_readonly
    def inferred_type(self):
        """ return a string of the type inferred from the values """
        return lib.infer_dtype(self)

    def _is_memory_usage_qualified(self):
        """ return a boolean if we need a qualified .info display """
        return self.is_object()

    def is_type_compatible(self, kind):
        return kind == self.inferred_type

    @cache_readonly
    def is_all_dates(self):
        if self._data is None:
            return False
        return is_datetime_array(_ensure_object(self.values))

    def __iter__(self):
        return iter(self.values)

    def __reduce__(self):
        d = dict(data=self._data)
        d.update(self._get_attributes_dict())
        return _new_Index, (self.__class__, d), None

    def __setstate__(self, state):
        """Necessary for making this object picklable"""

        if isinstance(state, dict):
            self._data = state.pop('data')
            for k, v in compat.iteritems(state):
                setattr(self, k, v)

        elif isinstance(state, tuple):

            if len(state) == 2:
                nd_state, own_state = state
                data = np.empty(nd_state[1], dtype=nd_state[2])
                np.ndarray.__setstate__(data, nd_state)
                self.name = own_state[0]

            else:  # pragma: no cover
                data = np.empty(state)
                np.ndarray.__setstate__(data, state)

            self._data = data
            self._reset_identity()
        else:
            raise Exception("invalid pickle state")

    _unpickle_compat = __setstate__

    def __nonzero__(self):
        raise ValueError("The truth value of a {0} is ambiguous. "
                         "Use a.empty, a.bool(), a.item(), a.any() or a.all()."
                         .format(self.__class__.__name__))

    __bool__ = __nonzero__

    _index_shared_docs['__contains__'] = """
        return a boolean if this key is IN the index

        Parameters
        ----------
        key : object

        Returns
        -------
        boolean
        """

    @Appender(_index_shared_docs['__contains__'] % _index_doc_kwargs)
    def __contains__(self, key):
        hash(key)
        try:
            return key in self._engine
        except TypeError:
            return False

    _index_shared_docs['contains'] = """
        return a boolean if this key is IN the index

        Parameters
        ----------
        key : object

        Returns
        -------
        boolean
        """

    @Appender(_index_shared_docs['contains'] % _index_doc_kwargs)
    def contains(self, key):
        hash(key)
        try:
            return key in self._engine
        except TypeError:
            return False

    def __hash__(self):
        raise TypeError("unhashable type: %r" % type(self).__name__)

    def __setitem__(self, key, value):
        raise TypeError("Index does not support mutable operations")

    def __getitem__(self, key):
        """
        Override numpy.ndarray's __getitem__ method to work as desired.

        This function adds lists and Series as valid boolean indexers
        (ndarrays only supports ndarray with dtype=bool).

        If resulting ndim != 1, plain ndarray is returned instead of
        corresponding `Index` subclass.

        """
        # There's no custom logic to be implemented in __getslice__, so it's
        # not overloaded intentionally.
        getitem = self._data.__getitem__
        promote = self._shallow_copy

        if is_scalar(key):
            return getitem(key)

        if isinstance(key, slice):
            # This case is separated from the conditional above to avoid
            # pessimization of basic indexing.
            return promote(getitem(key))

        if is_bool_indexer(key):
            key = np.asarray(key)

        key = _values_from_object(key)
        result = getitem(key)
        if not is_scalar(result):
            return promote(result)
        else:
            return result

    def append(self, other):
        """
        Append a collection of Index options together

        Parameters
        ----------
        other : Index or list/tuple of indices

        Returns
        -------
        appended : Index
        """

        to_concat = [self]

        if isinstance(other, (list, tuple)):
            to_concat = to_concat + list(other)
        else:
            to_concat.append(other)

        for obj in to_concat:
            if not isinstance(obj, Index):
                raise TypeError('all inputs must be Index')

        names = set([obj.name for obj in to_concat])
        name = None if len(names) > 1 else self.name

        if self.is_categorical():
            # if calling index is category, don't check dtype of others
            from pandas.core.indexes.category import CategoricalIndex
            return CategoricalIndex._append_same_dtype(self, to_concat, name)

        typs = _concat.get_dtype_kinds(to_concat)

        if len(typs) == 1:
            return self._append_same_dtype(to_concat, name=name)
        return _concat._concat_index_asobject(to_concat, name=name)

    def _append_same_dtype(self, to_concat, name):
        """
        Concatenate to_concat which has the same class
        """
        # must be overrided in specific classes
        return _concat._concat_index_asobject(to_concat, name)

    _index_shared_docs['take'] = """
        return a new %(klass)s of the values selected by the indices

        For internal compatibility with numpy arrays.

        Parameters
        ----------
        indices : list
            Indices to be taken
        axis : int, optional
            The axis over which to select values, always 0.
        allow_fill : bool, default True
        fill_value : bool, default None
            If allow_fill=True and fill_value is not None, indices specified by
            -1 is regarded as NA. If Index doesn't hold NA, raise ValueError

        See also
        --------
        numpy.ndarray.take
        """

    @Appender(_index_shared_docs['take'] % _index_doc_kwargs)
    def take(self, indices, axis=0, allow_fill=True,
             fill_value=None, **kwargs):
        if kwargs:
            nv.validate_take(tuple(), kwargs)
        indices = _ensure_platform_int(indices)
        if self._can_hold_na:
            taken = self._assert_take_fillable(self.values, indices,
                                               allow_fill=allow_fill,
                                               fill_value=fill_value,
                                               na_value=self._na_value)
        else:
            if allow_fill and fill_value is not None:
                msg = 'Unable to fill values because {0} cannot contain NA'
                raise ValueError(msg.format(self.__class__.__name__))
            taken = self.values.take(indices)
        return self._shallow_copy(taken)

    def _assert_take_fillable(self, values, indices, allow_fill=True,
                              fill_value=None, na_value=np.nan):
        """ Internal method to handle NA filling of take """
        indices = _ensure_platform_int(indices)

        # only fill if we are passing a non-None fill_value
        if allow_fill and fill_value is not None:
            if (indices < -1).any():
                msg = ('When allow_fill=True and fill_value is not None, '
                       'all indices must be >= -1')
                raise ValueError(msg)
            taken = values.take(indices)
            mask = indices == -1
            if mask.any():
                taken[mask] = na_value
        else:
            taken = values.take(indices)
        return taken

    @cache_readonly
    def _isnan(self):
        """ return if each value is nan"""
        if self._can_hold_na:
            return isnull(self)
        else:
            # shouldn't reach to this condition by checking hasnans beforehand
            values = np.empty(len(self), dtype=np.bool_)
            values.fill(False)
            return values

    @cache_readonly
    def _nan_idxs(self):
        if self._can_hold_na:
            w, = self._isnan.nonzero()
            return w
        else:
            return np.array([], dtype=np.int64)

    @cache_readonly
    def hasnans(self):
        """ return if I have any nans; enables various perf speedups """
        if self._can_hold_na:
            return self._isnan.any()
        else:
            return False

    def isnull(self):
        """
        Detect missing values

        .. versionadded:: 0.20.0

        Returns
        -------
        a boolean array of whether my values are null

        See also
        --------
        pandas.isnull : pandas version
        """
        return self._isnan

    def notnull(self):
        """
        Reverse of isnull

        .. versionadded:: 0.20.0

        Returns
        -------
        a boolean array of whether my values are not null

        See also
        --------
        pandas.notnull : pandas version
        """
        return ~self.isnull()

    def putmask(self, mask, value):
        """
        return a new Index of the values set with the mask

        See also
        --------
        numpy.ndarray.putmask
        """
        values = self.values.copy()
        try:
            np.putmask(values, mask, self._convert_for_op(value))
            return self._shallow_copy(values)
        except (ValueError, TypeError):
            # coerces to object
            return self.astype(object).putmask(mask, value)

    def format(self, name=False, formatter=None, **kwargs):
        """
        Render a string representation of the Index
        """
        header = []
        if name:
            header.append(pprint_thing(self.name,
                                       escape_chars=('\t', '\r', '\n')) if
                          self.name is not None else '')

        if formatter is not None:
            return header + list(self.map(formatter))

        return self._format_with_header(header, **kwargs)

    def _format_with_header(self, header, na_rep='NaN', **kwargs):
        values = self.values

        from pandas.io.formats.format import format_array

        if is_categorical_dtype(values.dtype):
            values = np.array(values)
        elif is_object_dtype(values.dtype):
            values = lib.maybe_convert_objects(values, safe=1)

        if is_object_dtype(values.dtype):
            result = [pprint_thing(x, escape_chars=('\t', '\r', '\n'))
                      for x in values]

            # could have nans
            mask = isnull(values)
            if mask.any():
                result = np.array(result)
                result[mask] = na_rep
                result = result.tolist()

        else:
            result = _trim_front(format_array(values, None, justify='left'))
        return header + result

    def to_native_types(self, slicer=None, **kwargs):
        """
        Format specified values of `self` and return them.

        Parameters
        ----------
        slicer : int, array-like
            An indexer into `self` that specifies which values
            are used in the formatting process.
        kwargs : dict
            Options for specifying how the values should be formatted.
            These options include the following:

            1) na_rep : str
                The value that serves as a placeholder for NULL values
            2) quoting : bool or None
                Whether or not there are quoted values in `self`
            3) date_format : str
                The format used to represent date-like values
        """

        values = self
        if slicer is not None:
            values = values[slicer]
        return values._format_native_types(**kwargs)

    def _format_native_types(self, na_rep='', quoting=None, **kwargs):
        """ actually format my specific types """
        mask = isnull(self)
        if not self.is_object() and not quoting:
            values = np.asarray(self).astype(str)
        else:
            values = np.array(self, dtype=object, copy=True)

        values[mask] = na_rep
        return values

    def equals(self, other):
        """
        Determines if two Index objects contain the same elements.
        """
        if self.is_(other):
            return True

        if not isinstance(other, Index):
            return False

        if is_object_dtype(self) and not is_object_dtype(other):
            # if other is not object, use other's logic for coercion
            return other.equals(self)

        try:
            return array_equivalent(_values_from_object(self),
                                    _values_from_object(other))
        except:
            return False

    def identical(self, other):
        """Similar to equals, but check that other comparable attributes are
        also equal
        """
        return (self.equals(other) and
                all((getattr(self, c, None) == getattr(other, c, None)
                     for c in self._comparables)) and
                type(self) == type(other))

    def asof(self, label):
        """
        For a sorted index, return the most recent label up to and including
        the passed label. Return NaN if not found.

        See also
        --------
        get_loc : asof is a thin wrapper around get_loc with method='pad'
        """
        try:
            loc = self.get_loc(label, method='pad')
        except KeyError:
            return _get_na_value(self.dtype)
        else:
            if isinstance(loc, slice):
                loc = loc.indices(len(self))[-1]
            return self[loc]

    def asof_locs(self, where, mask):
        """
        where : array of timestamps
        mask : array of booleans where data is not NA

        """
        locs = self.values[mask].searchsorted(where.values, side='right')

        locs = np.where(locs > 0, locs - 1, 0)
        result = np.arange(len(self))[mask].take(locs)

        first = mask.argmax()
        result[(locs == 0) & (where < self.values[first])] = -1

        return result

    def sort_values(self, return_indexer=False, ascending=True):
        """
        Return sorted copy of Index
        """
        _as = self.argsort()
        if not ascending:
            _as = _as[::-1]

        sorted_index = self.take(_as)

        if return_indexer:
            return sorted_index, _as
        else:
            return sorted_index

    def sort(self, *args, **kwargs):
        raise TypeError("cannot sort an Index object in-place, use "
                        "sort_values instead")

    def sortlevel(self, level=None, ascending=True, sort_remaining=None):
        """

        For internal compatibility with with the Index API

        Sort the Index. This is for compat with MultiIndex

        Parameters
        ----------
        ascending : boolean, default True
            False to sort in descending order

        level, sort_remaining are compat parameters

        Returns
        -------
        sorted_index : Index
        """
        return self.sort_values(return_indexer=True, ascending=ascending)

    def shift(self, periods=1, freq=None):
        """
        Shift Index containing datetime objects by input number of periods and
        DateOffset

        Returns
        -------
        shifted : Index
        """
        raise NotImplementedError("Not supported for type %s" %
                                  type(self).__name__)

    def argsort(self, *args, **kwargs):
        """
        Returns the indices that would sort the index and its
        underlying data.

        Returns
        -------
        argsorted : numpy array

        See also
        --------
        numpy.ndarray.argsort
        """
        result = self.asi8
        if result is None:
            result = np.array(self)
        return result.argsort(*args, **kwargs)

    def __add__(self, other):
        return Index(np.array(self) + other)

    def __radd__(self, other):
        return Index(other + np.array(self))

    __iadd__ = __add__

    def __sub__(self, other):
        raise TypeError("cannot perform __sub__ with this index type: "
                        "{typ}".format(typ=type(self)))

    def __and__(self, other):
        return self.intersection(other)

    def __or__(self, other):
        return self.union(other)

    def __xor__(self, other):
        return self.symmetric_difference(other)

    def _get_consensus_name(self, other):
        """
        Given 2 indexes, give a consensus name meaning
        we take the not None one, or None if the names differ.
        Return a new object if we are resetting the name
        """
        if self.name != other.name:
            if self.name is None or other.name is None:
                name = self.name or other.name
            else:
                name = None
            if self.name != name:
                return self._shallow_copy(name=name)
        return self

    def union(self, other):
        """
        Form the union of two Index objects and sorts if possible.

        Parameters
        ----------
        other : Index or array-like

        Returns
        -------
        union : Index

        Examples
        --------

        >>> idx1 = pd.Index([1, 2, 3, 4])
        >>> idx2 = pd.Index([3, 4, 5, 6])
        >>> idx1.union(idx2)
        Int64Index([1, 2, 3, 4, 5, 6], dtype='int64')

        """
        self._assert_can_do_setop(other)
        other = _ensure_index(other)

        if len(other) == 0 or self.equals(other):
            return self._get_consensus_name(other)

        if len(self) == 0:
            return other._get_consensus_name(self)

        if not is_dtype_equal(self.dtype, other.dtype):
            this = self.astype('O')
            other = other.astype('O')
            return this.union(other)

        if self.is_monotonic and other.is_monotonic:
            try:
                result = self._outer_indexer(self._values, other._values)[0]
            except TypeError:
                # incomparable objects
                result = list(self._values)

                # worth making this faster? a very unusual case
                value_set = set(self._values)
                result.extend([x for x in other._values if x not in value_set])
        else:
            indexer = self.get_indexer(other)
            indexer, = (indexer == -1).nonzero()

            if len(indexer) > 0:
                other_diff = algos.take_nd(other._values, indexer,
                                           allow_fill=False)
                result = _concat._concat_compat((self._values, other_diff))

                try:
                    self._values[0] < other_diff[0]
                except TypeError as e:
                    warnings.warn("%s, sort order is undefined for "
                                  "incomparable objects" % e, RuntimeWarning,
                                  stacklevel=3)
                else:
                    types = frozenset((self.inferred_type,
                                       other.inferred_type))
                    if not types & _unsortable_types:
                        result.sort()

            else:
                result = self._values

                try:
                    result = np.sort(result)
                except TypeError as e:
                    warnings.warn("%s, sort order is undefined for "
                                  "incomparable objects" % e, RuntimeWarning,
                                  stacklevel=3)

        # for subclasses
        return self._wrap_union_result(other, result)

    def _wrap_union_result(self, other, result):
        name = self.name if self.name == other.name else None
        return self.__class__(result, name=name)

    def intersection(self, other):
        """
        Form the intersection of two Index objects.

        This returns a new Index with elements common to the index and `other`,
        preserving the order of the calling index.

        Parameters
        ----------
        other : Index or array-like

        Returns
        -------
        intersection : Index

        Examples
        --------

        >>> idx1 = pd.Index([1, 2, 3, 4])
        >>> idx2 = pd.Index([3, 4, 5, 6])
        >>> idx1.intersection(idx2)
        Int64Index([3, 4], dtype='int64')

        """
        self._assert_can_do_setop(other)
        other = _ensure_index(other)

        if self.equals(other):
            return self._get_consensus_name(other)

        if not is_dtype_equal(self.dtype, other.dtype):
            this = self.astype('O')
            other = other.astype('O')
            return this.intersection(other)

        if self.is_monotonic and other.is_monotonic:
            try:
                result = self._inner_indexer(self._values, other._values)[0]
                return self._wrap_union_result(other, result)
            except TypeError:
                pass

        try:
            indexer = Index(other._values).get_indexer(self._values)
            indexer = indexer.take((indexer != -1).nonzero()[0])
        except:
            # duplicates
            indexer = Index(other._values).get_indexer_non_unique(
                self._values)[0].unique()
            indexer = indexer[indexer != -1]

        taken = other.take(indexer)
        if self.name != other.name:
            taken.name = None
        return taken

    def difference(self, other):
        """
        Return a new Index with elements from the index that are not in
        `other`.

        This is the set difference of two Index objects.
        It's sorted if sorting is possible.

        Parameters
        ----------
        other : Index or array-like

        Returns
        -------
        difference : Index

        Examples
        --------

        >>> idx1 = pd.Index([1, 2, 3, 4])
        >>> idx2 = pd.Index([3, 4, 5, 6])
        >>> idx1.difference(idx2)
        Int64Index([1, 2], dtype='int64')

        """
        self._assert_can_do_setop(other)

        if self.equals(other):
            return Index([], name=self.name)

        other, result_name = self._convert_can_do_setop(other)

        this = self._get_unique_index()

        indexer = this.get_indexer(other)
        indexer = indexer.take((indexer != -1).nonzero()[0])

        label_diff = np.setdiff1d(np.arange(this.size), indexer,
                                  assume_unique=True)
        the_diff = this.values.take(label_diff)
        try:
            the_diff = algos.safe_sort(the_diff)
        except TypeError:
            pass

        return this._shallow_copy(the_diff, name=result_name, freq=None)

    def symmetric_difference(self, other, result_name=None):
        """
        Compute the symmetric difference of two Index objects.
        It's sorted if sorting is possible.

        Parameters
        ----------
        other : Index or array-like
        result_name : str

        Returns
        -------
        symmetric_difference : Index

        Notes
        -----
        ``symmetric_difference`` contains elements that appear in either
        ``idx1`` or ``idx2`` but not both. Equivalent to the Index created by
        ``idx1.difference(idx2) | idx2.difference(idx1)`` with duplicates
        dropped.

        Examples
        --------
        >>> idx1 = Index([1, 2, 3, 4])
        >>> idx2 = Index([2, 3, 4, 5])
        >>> idx1.symmetric_difference(idx2)
        Int64Index([1, 5], dtype='int64')

        You can also use the ``^`` operator:

        >>> idx1 ^ idx2
        Int64Index([1, 5], dtype='int64')
        """
        self._assert_can_do_setop(other)
        other, result_name_update = self._convert_can_do_setop(other)
        if result_name is None:
            result_name = result_name_update

        this = self._get_unique_index()
        other = other._get_unique_index()
        indexer = this.get_indexer(other)

        # {this} minus {other}
        common_indexer = indexer.take((indexer != -1).nonzero()[0])
        left_indexer = np.setdiff1d(np.arange(this.size), common_indexer,
                                    assume_unique=True)
        left_diff = this.values.take(left_indexer)

        # {other} minus {this}
        right_indexer = (indexer == -1).nonzero()[0]
        right_diff = other.values.take(right_indexer)

        the_diff = _concat._concat_compat([left_diff, right_diff])
        try:
            the_diff = algos.safe_sort(the_diff)
        except TypeError:
            pass

        attribs = self._get_attributes_dict()
        attribs['name'] = result_name
        if 'freq' in attribs:
            attribs['freq'] = None
        return self._shallow_copy_with_infer(the_diff, **attribs)

    sym_diff = deprecate('sym_diff', symmetric_difference)

    def _get_unique_index(self, dropna=False):
        """
        Returns an index containing unique values.

        Parameters
        ----------
        dropna : bool
            If True, NaN values are dropped.

        Returns
        -------
        uniques : index
        """
        if self.is_unique and not dropna:
            return self

        values = self.values

        if not self.is_unique:
            values = self.unique()

        if dropna:
            try:
                if self.hasnans:
                    values = values[~isnull(values)]
            except NotImplementedError:
                pass

        return self._shallow_copy(values)

    _index_shared_docs['get_loc'] = """
        Get integer location for requested label.

        Parameters
        ----------
        key : label
        method : {None, 'pad'/'ffill', 'backfill'/'bfill', 'nearest'}, optional
            * default: exact matches only.
            * pad / ffill: find the PREVIOUS index value if no exact match.
            * backfill / bfill: use NEXT index value if no exact match
            * nearest: use the NEAREST index value if no exact match. Tied
              distances are broken by preferring the larger index value.
        tolerance : optional
            Maximum distance from index value for inexact matches. The value of
            the index at the matching location most satisfy the equation
            ``abs(index[loc] - key) <= tolerance``.

            .. versionadded:: 0.17.0

        Returns
        -------
        loc : int if unique index, possibly slice or mask if not
    """

    @Appender(_index_shared_docs['get_loc'])
    def get_loc(self, key, method=None, tolerance=None):
        if method is None:
            if tolerance is not None:
                raise ValueError('tolerance argument only valid if using pad, '
                                 'backfill or nearest lookups')
            try:
                return self._engine.get_loc(key)
            except KeyError:
                return self._engine.get_loc(self._maybe_cast_indexer(key))

        indexer = self.get_indexer([key], method=method, tolerance=tolerance)
        if indexer.ndim > 1 or indexer.size > 1:
            raise TypeError('get_loc requires scalar valued input')
        loc = indexer.item()
        if loc == -1:
            raise KeyError(key)
        return loc

    def get_value(self, series, key):
        """
        Fast lookup of value from 1-dimensional ndarray. Only use this if you
        know what you're doing
        """

        # if we have something that is Index-like, then
        # use this, e.g. DatetimeIndex
        s = getattr(series, '_values', None)
        if isinstance(s, Index) and is_scalar(key):
            try:
                return s[key]
            except (IndexError, ValueError):

                # invalid type as an indexer
                pass

        s = _values_from_object(series)
        k = _values_from_object(key)

        k = self._convert_scalar_indexer(k, kind='getitem')
        try:
            return self._engine.get_value(s, k,
                                          tz=getattr(series.dtype, 'tz', None))
        except KeyError as e1:
            if len(self) > 0 and self.inferred_type in ['integer', 'boolean']:
                raise

            try:
                return libts.get_value_box(s, key)
            except IndexError:
                raise
            except TypeError:
                # generator/iterator-like
                if is_iterator(key):
                    raise InvalidIndexError(key)
                else:
                    raise e1
            except Exception:  # pragma: no cover
                raise e1
        except TypeError:
            # python 3
            if is_scalar(key):  # pragma: no cover
                raise IndexError(key)
            raise InvalidIndexError(key)

    def set_value(self, arr, key, value):
        """
        Fast lookup of value from 1-dimensional ndarray. Only use this if you
        know what you're doing
        """
        self._engine.set_value(_values_from_object(arr),
                               _values_from_object(key), value)

    def _get_level_values(self, level):
        """
        Return an Index of values for requested level, equal to the length
        of the index

        Parameters
        ----------
        level : int

        Returns
        -------
        values : Index
        """

        self._validate_index_level(level)
        return self

    get_level_values = _get_level_values

    _index_shared_docs['get_indexer'] = """
        Compute indexer and mask for new index given the current index. The
        indexer should be then used as an input to ndarray.take to align the
        current data to the new index.

        Parameters
        ----------
        target : %(target_klass)s
        method : {None, 'pad'/'ffill', 'backfill'/'bfill', 'nearest'}, optional
            * default: exact matches only.
            * pad / ffill: find the PREVIOUS index value if no exact match.
            * backfill / bfill: use NEXT index value if no exact match
            * nearest: use the NEAREST index value if no exact match. Tied
              distances are broken by preferring the larger index value.
        limit : int, optional
            Maximum number of consecutive labels in ``target`` to match for
            inexact matches.
        tolerance : optional
            Maximum distance between original and new labels for inexact
            matches. The values of the index at the matching locations most
            satisfy the equation ``abs(index[indexer] - target) <= tolerance``.

            .. versionadded:: 0.17.0

        Examples
        --------
        >>> indexer = index.get_indexer(new_index)
        >>> new_values = cur_values.take(indexer)

        Returns
        -------
        indexer : ndarray of int
            Integers from 0 to n - 1 indicating that the index at these
            positions matches the corresponding target values. Missing values
            in the target are marked by -1.
        """

    @Appender(_index_shared_docs['get_indexer'] % _index_doc_kwargs)
    def get_indexer(self, target, method=None, limit=None, tolerance=None):
        method = missing.clean_reindex_fill_method(method)
        target = _ensure_index(target)
        if tolerance is not None:
            tolerance = self._convert_tolerance(tolerance)

        pself, ptarget = self._maybe_promote(target)
        if pself is not self or ptarget is not target:
            return pself.get_indexer(ptarget, method=method, limit=limit,
                                     tolerance=tolerance)

        if not is_dtype_equal(self.dtype, target.dtype):
            this = self.astype(object)
            target = target.astype(object)
            return this.get_indexer(target, method=method, limit=limit,
                                    tolerance=tolerance)

        if not self.is_unique:
            raise InvalidIndexError('Reindexing only valid with uniquely'
                                    ' valued Index objects')

        if method == 'pad' or method == 'backfill':
            indexer = self._get_fill_indexer(target, method, limit, tolerance)
        elif method == 'nearest':
            indexer = self._get_nearest_indexer(target, limit, tolerance)
        else:
            if tolerance is not None:
                raise ValueError('tolerance argument only valid if doing pad, '
                                 'backfill or nearest reindexing')
            if limit is not None:
                raise ValueError('limit argument only valid if doing pad, '
                                 'backfill or nearest reindexing')

            indexer = self._engine.get_indexer(target._values)

        return _ensure_platform_int(indexer)

    def _convert_tolerance(self, tolerance):
        # override this method on subclasses
        return tolerance

    def _get_fill_indexer(self, target, method, limit=None, tolerance=None):
        if self.is_monotonic_increasing and target.is_monotonic_increasing:
            method = (self._engine.get_pad_indexer if method == 'pad' else
                      self._engine.get_backfill_indexer)
            indexer = method(target._values, limit)
        else:
            indexer = self._get_fill_indexer_searchsorted(target, method,
                                                          limit)
        if tolerance is not None:
            indexer = self._filter_indexer_tolerance(target._values, indexer,
                                                     tolerance)
        return indexer

    def _get_fill_indexer_searchsorted(self, target, method, limit=None):
        """
        Fallback pad/backfill get_indexer that works for monotonic decreasing
        indexes and non-monotonic targets
        """
        if limit is not None:
            raise ValueError('limit argument for %r method only well-defined '
                             'if index and target are monotonic' % method)

        side = 'left' if method == 'pad' else 'right'

        # find exact matches first (this simplifies the algorithm)
        indexer = self.get_indexer(target)
        nonexact = (indexer == -1)
        indexer[nonexact] = self._searchsorted_monotonic(target[nonexact],
                                                         side)
        if side == 'left':
            # searchsorted returns "indices into a sorted array such that,
            # if the corresponding elements in v were inserted before the
            # indices, the order of a would be preserved".
            # Thus, we need to subtract 1 to find values to the left.
            indexer[nonexact] -= 1
            # This also mapped not found values (values of 0 from
            # np.searchsorted) to -1, which conveniently is also our
            # sentinel for missing values
        else:
            # Mark indices to the right of the largest value as not found
            indexer[indexer == len(self)] = -1
        return indexer

    def _get_nearest_indexer(self, target, limit, tolerance):
        """
        Get the indexer for the nearest index labels; requires an index with
        values that can be subtracted from each other (e.g., not strings or
        tuples).
        """
        left_indexer = self.get_indexer(target, 'pad', limit=limit)
        right_indexer = self.get_indexer(target, 'backfill', limit=limit)

        target = np.asarray(target)
        left_distances = abs(self.values[left_indexer] - target)
        right_distances = abs(self.values[right_indexer] - target)

        op = operator.lt if self.is_monotonic_increasing else operator.le
        indexer = np.where(op(left_distances, right_distances) |
                           (right_indexer == -1), left_indexer, right_indexer)
        if tolerance is not None:
            indexer = self._filter_indexer_tolerance(target, indexer,
                                                     tolerance)
        return indexer

    def _filter_indexer_tolerance(self, target, indexer, tolerance):
        distance = abs(self.values[indexer] - target)
        indexer = np.where(distance <= tolerance, indexer, -1)
        return indexer

    _index_shared_docs['get_indexer_non_unique'] = """
        Compute indexer and mask for new index given the current index. The
        indexer should be then used as an input to ndarray.take to align the
        current data to the new index.

        Parameters
        ----------
        target : %(target_klass)s

        Returns
        -------
        indexer : ndarray of int
            Integers from 0 to n - 1 indicating that the index at these
            positions matches the corresponding target values. Missing values
            in the target are marked by -1.
        missing : ndarray of int
            An indexer into the target of the values not found.
            These correspond to the -1 in the indexer array
        """

    @Appender(_index_shared_docs['get_indexer_non_unique'] % _index_doc_kwargs)
    def get_indexer_non_unique(self, target):
        target = _ensure_index(target)
        pself, ptarget = self._maybe_promote(target)
        if pself is not self or ptarget is not target:
            return pself.get_indexer_non_unique(ptarget)

        if self.is_all_dates:
            self = Index(self.asi8)
            tgt_values = target.asi8
        else:
            tgt_values = target._values

        indexer, missing = self._engine.get_indexer_non_unique(tgt_values)
        return Index(indexer), missing

    def get_indexer_for(self, target, **kwargs):
        """
        guaranteed return of an indexer even when non-unique
        This dispatches to get_indexer or get_indexer_nonunique as appropriate
        """
        if self.is_unique:
            return self.get_indexer(target, **kwargs)
        indexer, _ = self.get_indexer_non_unique(target, **kwargs)
        return indexer

    def _maybe_promote(self, other):
        # A hack, but it works
        from pandas.core.indexes.datetimes import DatetimeIndex
        if self.inferred_type == 'date' and isinstance(other, DatetimeIndex):
            return DatetimeIndex(self), other
        elif self.inferred_type == 'boolean':
            if not is_object_dtype(self.dtype):
                return self.astype('object'), other.astype('object')
        return self, other

    def groupby(self, values):
        """
        Group the index labels by a given array of values.

        Parameters
        ----------
        values : array
            Values used to determine the groups.

        Returns
        -------
        groups : dict
            {group name -> group labels}
        """

        # TODO: if we are a MultiIndex, we can do better
        # that converting to tuples
        from .multi import MultiIndex
        if isinstance(values, MultiIndex):
            values = values.values
        values = _ensure_categorical(values)
        result = values._reverse_indexer()

        # map to the label
        result = {k: self.take(v) for k, v in compat.iteritems(result)}

        return result

    def map(self, mapper):
        """Apply mapper function to an index.

        Parameters
        ----------
        mapper : callable
            Function to be applied.

        Returns
        -------
        applied : Union[Index, MultiIndex], inferred
            The output of the mapping function applied to the index.
            If the function returns a tuple with more than one element
            a MultiIndex will be returned.

        """
        from .multi import MultiIndex
        mapped_values = self._arrmap(self.values, mapper)
        attributes = self._get_attributes_dict()
        if mapped_values.size and isinstance(mapped_values[0], tuple):
            return MultiIndex.from_tuples(mapped_values,
                                          names=attributes.get('name'))

        attributes['copy'] = False
        return Index(mapped_values, **attributes)

    def isin(self, values, level=None):
        """
        Compute boolean array of whether each index value is found in the
        passed set of values.

        Parameters
        ----------
        values : set or list-like
            Sought values.

            .. versionadded:: 0.18.1

            Support for values as a set

        level : str or int, optional
            Name or position of the index level to use (if the index is a
            MultiIndex).

        Notes
        -----
        If `level` is specified:

        - if it is the name of one *and only one* index level, use that level;
        - otherwise it should be a number indicating level position.

        Returns
        -------
        is_contained : ndarray (boolean dtype)

        """
        if level is not None:
            self._validate_index_level(level)
        return algos.isin(np.array(self), values)

    def _can_reindex(self, indexer):
        """
        *this is an internal non-public method*

        Check if we are allowing reindexing with this particular indexer

        Parameters
        ----------
        indexer : an integer indexer

        Raises
        ------
        ValueError if its a duplicate axis
        """

        # trying to reindex on an axis with duplicates
        if not self.is_unique and len(indexer):
            raise ValueError("cannot reindex from a duplicate axis")

    def reindex(self, target, method=None, level=None, limit=None,
                tolerance=None):
        """
        Create index with target's values (move/add/delete values as necessary)

        Parameters
        ----------
        target : an iterable

        Returns
        -------
        new_index : pd.Index
            Resulting index
        indexer : np.ndarray or None
            Indices of output values in original index

        """
        # GH6552: preserve names when reindexing to non-named target
        # (i.e. neither Index nor Series).
        preserve_names = not hasattr(target, 'name')

        # GH7774: preserve dtype/tz if target is empty and not an Index.
        target = _ensure_has_len(target)  # target may be an iterator

        if not isinstance(target, Index) and len(target) == 0:
            attrs = self._get_attributes_dict()
            attrs.pop('freq', None)  # don't preserve freq
            target = self._simple_new(None, dtype=self.dtype, **attrs)
        else:
            target = _ensure_index(target)

        if level is not None:
            if method is not None:
                raise TypeError('Fill method not supported if level passed')
            _, indexer, _ = self._join_level(target, level, how='right',
                                             return_indexers=True)
        else:
            if self.equals(target):
                indexer = None
            else:

                if self.is_unique:
                    indexer = self.get_indexer(target, method=method,
                                               limit=limit,
                                               tolerance=tolerance)
                else:
                    if method is not None or limit is not None:
                        raise ValueError("cannot reindex a non-unique index "
                                         "with a method or limit")
                    indexer, missing = self.get_indexer_non_unique(target)

        if preserve_names and target.nlevels == 1 and target.name != self.name:
            target = target.copy()
            target.name = self.name

        return target, indexer

    def _reindex_non_unique(self, target):
        """
        *this is an internal non-public method*

        Create a new index with target's values (move/add/delete values as
        necessary) use with non-unique Index and a possibly non-unique target

        Parameters
        ----------
        target : an iterable

        Returns
        -------
        new_index : pd.Index
            Resulting index
        indexer : np.ndarray or None
            Indices of output values in original index

        """

        target = _ensure_index(target)
        indexer, missing = self.get_indexer_non_unique(target)
        check = indexer != -1
        new_labels = self.take(indexer[check])
        new_indexer = None

        if len(missing):
            l = np.arange(len(indexer))

            missing = _ensure_platform_int(missing)
            missing_labels = target.take(missing)
            missing_indexer = _ensure_int64(l[~check])
            cur_labels = self.take(indexer[check]).values
            cur_indexer = _ensure_int64(l[check])

            new_labels = np.empty(tuple([len(indexer)]), dtype=object)
            new_labels[cur_indexer] = cur_labels
            new_labels[missing_indexer] = missing_labels

            # a unique indexer
            if target.is_unique:

                # see GH5553, make sure we use the right indexer
                new_indexer = np.arange(len(indexer))
                new_indexer[cur_indexer] = np.arange(len(cur_labels))
                new_indexer[missing_indexer] = -1

            # we have a non_unique selector, need to use the original
            # indexer here
            else:

                # need to retake to have the same size as the indexer
                indexer = indexer.values
                indexer[~check] = 0

                # reset the new indexer to account for the new size
                new_indexer = np.arange(len(self.take(indexer)))
                new_indexer[~check] = -1

        new_index = self._shallow_copy_with_infer(new_labels, freq=None)
        return new_index, indexer, new_indexer

    _index_shared_docs['join'] = """
        *this is an internal non-public method*

        Compute join_index and indexers to conform data
        structures to the new index.

        Parameters
        ----------
        other : Index
        how : {'left', 'right', 'inner', 'outer'}
        level : int or level name, default None
        return_indexers : boolean, default False
        sort : boolean, default False
            Sort the join keys lexicographically in the result Index. If False,
            the order of the join keys depends on the join type (how keyword)

            .. versionadded:: 0.20.0

        Returns
        -------
        join_index, (left_indexer, right_indexer)
        """

    @Appender(_index_shared_docs['join'])
    def join(self, other, how='left', level=None, return_indexers=False,
             sort=False):
        from .multi import MultiIndex
        self_is_mi = isinstance(self, MultiIndex)
        other_is_mi = isinstance(other, MultiIndex)

        # try to figure out the join level
        # GH3662
        if level is None and (self_is_mi or other_is_mi):

            # have the same levels/names so a simple join
            if self.names == other.names:
                pass
            else:
                return self._join_multi(other, how=how,
                                        return_indexers=return_indexers)

        # join on the level
        if level is not None and (self_is_mi or other_is_mi):
            return self._join_level(other, level, how=how,
                                    return_indexers=return_indexers)

        other = _ensure_index(other)

        if len(other) == 0 and how in ('left', 'outer'):
            join_index = self._shallow_copy()
            if return_indexers:
                rindexer = np.repeat(-1, len(join_index))
                return join_index, None, rindexer
            else:
                return join_index

        if len(self) == 0 and how in ('right', 'outer'):
            join_index = other._shallow_copy()
            if return_indexers:
                lindexer = np.repeat(-1, len(join_index))
                return join_index, lindexer, None
            else:
                return join_index

        if self._join_precedence < other._join_precedence:
            how = {'right': 'left', 'left': 'right'}.get(how, how)
            result = other.join(self, how=how, level=level,
                                return_indexers=return_indexers)
            if return_indexers:
                x, y, z = result
                result = x, z, y
            return result

        if not is_dtype_equal(self.dtype, other.dtype):
            this = self.astype('O')
            other = other.astype('O')
            return this.join(other, how=how, return_indexers=return_indexers)

        _validate_join_method(how)

        if not self.is_unique and not other.is_unique:
            return self._join_non_unique(other, how=how,
                                         return_indexers=return_indexers)
        elif not self.is_unique or not other.is_unique:
            if self.is_monotonic and other.is_monotonic:
                return self._join_monotonic(other, how=how,
                                            return_indexers=return_indexers)
            else:
                return self._join_non_unique(other, how=how,
                                             return_indexers=return_indexers)
        elif self.is_monotonic and other.is_monotonic:
            try:
                return self._join_monotonic(other, how=how,
                                            return_indexers=return_indexers)
            except TypeError:
                pass

        if how == 'left':
            join_index = self
        elif how == 'right':
            join_index = other
        elif how == 'inner':
            join_index = self.intersection(other)
        elif how == 'outer':
            join_index = self.union(other)

        if sort:
            join_index = join_index.sort_values()

        if return_indexers:
            if join_index is self:
                lindexer = None
            else:
                lindexer = self.get_indexer(join_index)
            if join_index is other:
                rindexer = None
            else:
                rindexer = other.get_indexer(join_index)
            return join_index, lindexer, rindexer
        else:
            return join_index

    def _join_multi(self, other, how, return_indexers=True):
        from .multi import MultiIndex
        self_is_mi = isinstance(self, MultiIndex)
        other_is_mi = isinstance(other, MultiIndex)

        # figure out join names
        self_names = [n for n in self.names if n is not None]
        other_names = [n for n in other.names if n is not None]
        overlap = list(set(self_names) & set(other_names))

        # need at least 1 in common, but not more than 1
        if not len(overlap):
            raise ValueError("cannot join with no level specified and no "
                             "overlapping names")
        if len(overlap) > 1:
            raise NotImplementedError("merging with more than one level "
                                      "overlap on a multi-index is not "
                                      "implemented")
        jl = overlap[0]

        # make the indices into mi's that match
        if not (self_is_mi and other_is_mi):

            flip_order = False
            if self_is_mi:
                self, other = other, self
                flip_order = True
                # flip if join method is right or left
                how = {'right': 'left', 'left': 'right'}.get(how, how)

            level = other.names.index(jl)
            result = self._join_level(other, level, how=how,
                                      return_indexers=return_indexers)

            if flip_order:
                if isinstance(result, tuple):
                    return result[0], result[2], result[1]
            return result

        # 2 multi-indexes
        raise NotImplementedError("merging with both multi-indexes is not "
                                  "implemented")

    def _join_non_unique(self, other, how='left', return_indexers=False):
        from pandas.core.reshape.merge import _get_join_indexers

        left_idx, right_idx = _get_join_indexers([self.values],
                                                 [other._values], how=how,
                                                 sort=True)

        left_idx = _ensure_platform_int(left_idx)
        right_idx = _ensure_platform_int(right_idx)

        join_index = self.values.take(left_idx)
        mask = left_idx == -1
        np.putmask(join_index, mask, other._values.take(right_idx))

        join_index = self._wrap_joined_index(join_index, other)

        if return_indexers:
            return join_index, left_idx, right_idx
        else:
            return join_index

    def _join_level(self, other, level, how='left', return_indexers=False,
                    keep_order=True):
        """
        The join method *only* affects the level of the resulting
        MultiIndex. Otherwise it just exactly aligns the Index data to the
        labels of the level in the MultiIndex. If `keep_order` == True, the
        order of the data indexed by the MultiIndex will not be changed;
        otherwise, it will tie out with `other`.
        """
        from .multi import MultiIndex

        def _get_leaf_sorter(labels):
            """
            returns sorter for the inner most level while preserving the
            order of higher levels
            """
            if labels[0].size == 0:
                return np.empty(0, dtype='int64')

            if len(labels) == 1:
                lab = _ensure_int64(labels[0])
                sorter, _ = libalgos.groupsort_indexer(lab, 1 + lab.max())
                return sorter

            # find indexers of begining of each set of
            # same-key labels w.r.t all but last level
            tic = labels[0][:-1] != labels[0][1:]
            for lab in labels[1:-1]:
                tic |= lab[:-1] != lab[1:]

            starts = np.hstack(([True], tic, [True])).nonzero()[0]
            lab = _ensure_int64(labels[-1])
            return lib.get_level_sorter(lab, _ensure_int64(starts))

        if isinstance(self, MultiIndex) and isinstance(other, MultiIndex):
            raise TypeError('Join on level between two MultiIndex objects '
                            'is ambiguous')

        left, right = self, other

        flip_order = not isinstance(self, MultiIndex)
        if flip_order:
            left, right = right, left
            how = {'right': 'left', 'left': 'right'}.get(how, how)

        level = left._get_level_number(level)
        old_level = left.levels[level]

        if not right.is_unique:
            raise NotImplementedError('Index._join_level on non-unique index '
                                      'is not implemented')

        new_level, left_lev_indexer, right_lev_indexer = \
            old_level.join(right, how=how, return_indexers=True)

        if left_lev_indexer is None:
            if keep_order or len(left) == 0:
                left_indexer = None
                join_index = left
            else:  # sort the leaves
                left_indexer = _get_leaf_sorter(left.labels[:level + 1])
                join_index = left[left_indexer]

        else:
            left_lev_indexer = _ensure_int64(left_lev_indexer)
            rev_indexer = lib.get_reverse_indexer(left_lev_indexer,
                                                  len(old_level))

            new_lev_labels = algos.take_nd(rev_indexer, left.labels[level],
                                           allow_fill=False)

            new_labels = list(left.labels)
            new_labels[level] = new_lev_labels

            new_levels = list(left.levels)
            new_levels[level] = new_level

            if keep_order:  # just drop missing values. o.w. keep order
                left_indexer = np.arange(len(left), dtype=np.intp)
                mask = new_lev_labels != -1
                if not mask.all():
                    new_labels = [lab[mask] for lab in new_labels]
                    left_indexer = left_indexer[mask]

            else:  # tie out the order with other
                if level == 0:  # outer most level, take the fast route
                    ngroups = 1 + new_lev_labels.max()
                    left_indexer, counts = libalgos.groupsort_indexer(
                        new_lev_labels, ngroups)

                    # missing values are placed first; drop them!
                    left_indexer = left_indexer[counts[0]:]
                    new_labels = [lab[left_indexer] for lab in new_labels]

                else:  # sort the leaves
                    mask = new_lev_labels != -1
                    mask_all = mask.all()
                    if not mask_all:
                        new_labels = [lab[mask] for lab in new_labels]

                    left_indexer = _get_leaf_sorter(new_labels[:level + 1])
                    new_labels = [lab[left_indexer] for lab in new_labels]

                    # left_indexers are w.r.t masked frame.
                    # reverse to original frame!
                    if not mask_all:
                        left_indexer = mask.nonzero()[0][left_indexer]

            join_index = MultiIndex(levels=new_levels, labels=new_labels,
                                    names=left.names, verify_integrity=False)

        if right_lev_indexer is not None:
            right_indexer = algos.take_nd(right_lev_indexer,
                                          join_index.labels[level],
                                          allow_fill=False)
        else:
            right_indexer = join_index.labels[level]

        if flip_order:
            left_indexer, right_indexer = right_indexer, left_indexer

        if return_indexers:
            left_indexer = (None if left_indexer is None
                            else _ensure_platform_int(left_indexer))
            right_indexer = (None if right_indexer is None
                             else _ensure_platform_int(right_indexer))
            return join_index, left_indexer, right_indexer
        else:
            return join_index

    def _join_monotonic(self, other, how='left', return_indexers=False):
        if self.equals(other):
            ret_index = other if how == 'right' else self
            if return_indexers:
                return ret_index, None, None
            else:
                return ret_index

        sv = self._values
        ov = other._values

        if self.is_unique and other.is_unique:
            # We can perform much better than the general case
            if how == 'left':
                join_index = self
                lidx = None
                ridx = self._left_indexer_unique(sv, ov)
            elif how == 'right':
                join_index = other
                lidx = self._left_indexer_unique(ov, sv)
                ridx = None
            elif how == 'inner':
                join_index, lidx, ridx = self._inner_indexer(sv, ov)
                join_index = self._wrap_joined_index(join_index, other)
            elif how == 'outer':
                join_index, lidx, ridx = self._outer_indexer(sv, ov)
                join_index = self._wrap_joined_index(join_index, other)
        else:
            if how == 'left':
                join_index, lidx, ridx = self._left_indexer(sv, ov)
            elif how == 'right':
                join_index, ridx, lidx = self._left_indexer(ov, sv)
            elif how == 'inner':
                join_index, lidx, ridx = self._inner_indexer(sv, ov)
            elif how == 'outer':
                join_index, lidx, ridx = self._outer_indexer(sv, ov)
            join_index = self._wrap_joined_index(join_index, other)

        if return_indexers:
            lidx = None if lidx is None else _ensure_platform_int(lidx)
            ridx = None if ridx is None else _ensure_platform_int(ridx)
            return join_index, lidx, ridx
        else:
            return join_index

    def _wrap_joined_index(self, joined, other):
        name = self.name if self.name == other.name else None
        return Index(joined, name=name)

    def _get_string_slice(self, key, use_lhs=True, use_rhs=True):
        # this is for partial string indexing,
        # overridden in DatetimeIndex, TimedeltaIndex and PeriodIndex
        raise NotImplementedError

    def slice_indexer(self, start=None, end=None, step=None, kind=None):
        """
        For an ordered Index, compute the slice indexer for input labels and
        step

        Parameters
        ----------
        start : label, default None
            If None, defaults to the beginning
        end : label, default None
            If None, defaults to the end
        step : int, default None
        kind : string, default None

        Returns
        -------
        indexer : ndarray or slice

        Notes
        -----
        This function assumes that the data is sorted, so use at your own peril
        """
        start_slice, end_slice = self.slice_locs(start, end, step=step,
                                                 kind=kind)

        # return a slice
        if not is_scalar(start_slice):
            raise AssertionError("Start slice bound is non-scalar")
        if not is_scalar(end_slice):
            raise AssertionError("End slice bound is non-scalar")

        return slice(start_slice, end_slice, step)

    def _maybe_cast_indexer(self, key):
        """
        If we have a float key and are not a floating index
        then try to cast to an int if equivalent
        """

        if is_float(key) and not self.is_floating():
            try:
                ckey = int(key)
                if ckey == key:
                    key = ckey
            except (ValueError, TypeError):
                pass
        return key

    def _validate_indexer(self, form, key, kind):
        """
        if we are positional indexer
        validate that we have appropriate typed bounds
        must be an integer
        """
        assert kind in ['ix', 'loc', 'getitem', 'iloc']

        if key is None:
            pass
        elif is_integer(key):
            pass
        elif kind in ['iloc', 'getitem']:
            self._invalid_indexer(form, key)
        return key

    _index_shared_docs['_maybe_cast_slice_bound'] = """
        This function should be overloaded in subclasses that allow non-trivial
        casting on label-slice bounds, e.g. datetime-like indices allowing
        strings containing formatted datetimes.

        Parameters
        ----------
        label : object
        side : {'left', 'right'}
        kind : {'ix', 'loc', 'getitem'}

        Returns
        -------
        label :  object

        Notes
        -----
        Value of `side` parameter should be validated in caller.

        """

    @Appender(_index_shared_docs['_maybe_cast_slice_bound'])
    def _maybe_cast_slice_bound(self, label, side, kind):
        assert kind in ['ix', 'loc', 'getitem', None]

        # We are a plain index here (sub-class override this method if they
        # wish to have special treatment for floats/ints, e.g. Float64Index and
        # datetimelike Indexes
        # reject them
        if is_float(label):
            if not (kind in ['ix'] and (self.holds_integer() or
                                        self.is_floating())):
                self._invalid_indexer('slice', label)

        # we are trying to find integer bounds on a non-integer based index
        # this is rejected (generally .loc gets you here)
        elif is_integer(label):
            self._invalid_indexer('slice', label)

        return label

    def _searchsorted_monotonic(self, label, side='left'):
        if self.is_monotonic_increasing:
            return self.searchsorted(label, side=side)
        elif self.is_monotonic_decreasing:
            # np.searchsorted expects ascending sort order, have to reverse
            # everything for it to work (element ordering, search side and
            # resulting value).
            pos = self[::-1].searchsorted(label, side='right' if side == 'left'
                                          else 'right')
            return len(self) - pos

        raise ValueError('index must be monotonic increasing or decreasing')

    def _get_loc_only_exact_matches(self, key):
        """
        This is overriden on subclasses (namely, IntervalIndex) to control
        get_slice_bound.
        """
        return self.get_loc(key)

    def get_slice_bound(self, label, side, kind):
        """
        Calculate slice bound that corresponds to given label.

        Returns leftmost (one-past-the-rightmost if ``side=='right'``) position
        of given label.

        Parameters
        ----------
        label : object
        side : {'left', 'right'}
        kind : {'ix', 'loc', 'getitem'}

        """
        assert kind in ['ix', 'loc', 'getitem', None]

        if side not in ('left', 'right'):
            raise ValueError("Invalid value for side kwarg,"
                             " must be either 'left' or 'right': %s" %
                             (side, ))

        original_label = label

        # For datetime indices label may be a string that has to be converted
        # to datetime boundary according to its resolution.
        label = self._maybe_cast_slice_bound(label, side, kind)

        # we need to look up the label
        try:
            slc = self._get_loc_only_exact_matches(label)
        except KeyError as err:
            try:
                return self._searchsorted_monotonic(label, side)
            except ValueError:
                # raise the original KeyError
                raise err

        if isinstance(slc, np.ndarray):
            # get_loc may return a boolean array or an array of indices, which
            # is OK as long as they are representable by a slice.
            if is_bool_dtype(slc):
                slc = lib.maybe_booleans_to_slice(slc.view('u1'))
            else:
                slc = lib.maybe_indices_to_slice(slc.astype('i8'), len(self))
            if isinstance(slc, np.ndarray):
                raise KeyError("Cannot get %s slice bound for non-unique "
                               "label: %r" % (side, original_label))

        if isinstance(slc, slice):
            if side == 'left':
                return slc.start
            else:
                return slc.stop
        else:
            if side == 'right':
                return slc + 1
            else:
                return slc

    def slice_locs(self, start=None, end=None, step=None, kind=None):
        """
        Compute slice locations for input labels.

        Parameters
        ----------
        start : label, default None
            If None, defaults to the beginning
        end : label, default None
            If None, defaults to the end
        step : int, defaults None
            If None, defaults to 1
        kind : {'ix', 'loc', 'getitem'} or None

        Returns
        -------
        start, end : int

        """
        inc = (step is None or step >= 0)

        if not inc:
            # If it's a reverse slice, temporarily swap bounds.
            start, end = end, start

        start_slice = None
        if start is not None:
            start_slice = self.get_slice_bound(start, 'left', kind)
        if start_slice is None:
            start_slice = 0

        end_slice = None
        if end is not None:
            end_slice = self.get_slice_bound(end, 'right', kind)
        if end_slice is None:
            end_slice = len(self)

        if not inc:
            # Bounds at this moment are swapped, swap them back and shift by 1.
            #
            # slice_locs('B', 'A', step=-1): s='B', e='A'
            #
            #              s='A'                 e='B'
            # AFTER SWAP:    |                     |
            #                v ------------------> V
            #           -----------------------------------
            #           | | |A|A|A|A| | | | | |B|B| | | | |
            #           -----------------------------------
            #              ^ <------------------ ^
            # SHOULD BE:   |                     |
            #           end=s-1              start=e-1
            #
            end_slice, start_slice = start_slice - 1, end_slice - 1

            # i == -1 triggers ``len(self) + i`` selection that points to the
            # last element, not before-the-first one, subtracting len(self)
            # compensates that.
            if end_slice == -1:
                end_slice -= len(self)
            if start_slice == -1:
                start_slice -= len(self)

        return start_slice, end_slice

    def delete(self, loc):
        """
        Make new Index with passed location(-s) deleted

        Returns
        -------
        new_index : Index
        """
        return self._shallow_copy(np.delete(self._data, loc))

    def insert(self, loc, item):
        """
        Make new Index inserting new item at location. Follows
        Python list.append semantics for negative values

        Parameters
        ----------
        loc : int
        item : object

        Returns
        -------
        new_index : Index
        """
        _self = np.asarray(self)
        item = self._coerce_scalar_to_index(item)._values
        idx = np.concatenate((_self[:loc], item, _self[loc:]))
        return self._shallow_copy_with_infer(idx)

    def drop(self, labels, errors='raise'):
        """
        Make new Index with passed list of labels deleted

        Parameters
        ----------
        labels : array-like
        errors : {'ignore', 'raise'}, default 'raise'
            If 'ignore', suppress error and existing labels are dropped.

        Returns
        -------
        dropped : Index
        """
        labels = com._index_labels_to_array(labels)
        indexer = self.get_indexer(labels)
        mask = indexer == -1
        if mask.any():
            if errors != 'ignore':
                raise ValueError('labels %s not contained in axis' %
                                 labels[mask])
            indexer = indexer[~mask]
        return self.delete(indexer)

    @Appender(base._shared_docs['unique'] % _index_doc_kwargs)
    def unique(self):
        result = super(Index, self).unique()
        return self._shallow_copy(result)

    @Appender(base._shared_docs['drop_duplicates'] % _index_doc_kwargs)
    def drop_duplicates(self, keep='first'):
        return super(Index, self).drop_duplicates(keep=keep)

    @Appender(base._shared_docs['duplicated'] % _index_doc_kwargs)
    def duplicated(self, keep='first'):
        return super(Index, self).duplicated(keep=keep)

    _index_shared_docs['fillna'] = """
        Fill NA/NaN values with the specified value

        Parameters
        ----------
        value : scalar
            Scalar value to use to fill holes (e.g. 0).
            This value cannot be a list-likes.
        downcast : dict, default is None
            a dict of item->dtype of what to downcast if possible,
            or the string 'infer' which will try to downcast to an appropriate
            equal type (e.g. float64 to int64 if possible)

        Returns
        -------
        filled : %(klass)s
        """

    @Appender(_index_shared_docs['fillna'])
    def fillna(self, value=None, downcast=None):
        self._assert_can_do_op(value)
        if self.hasnans:
            result = self.putmask(self._isnan, value)
            if downcast is None:
                # no need to care metadata other than name
                # because it can't have freq if
                return Index(result, name=self.name)
        return self._shallow_copy()

    _index_shared_docs['dropna'] = """
        Return Index without NA/NaN values

        Parameters
        ----------
        how :  {'any', 'all'}, default 'any'
            If the Index is a MultiIndex, drop the value when any or all levels
            are NaN.

        Returns
        -------
        valid : Index
        """

    @Appender(_index_shared_docs['dropna'])
    def dropna(self, how='any'):
        if how not in ('any', 'all'):
            raise ValueError("invalid how option: {0}".format(how))

        if self.hasnans:
            return self._shallow_copy(self.values[~self._isnan])
        return self._shallow_copy()

    def _evaluate_with_timedelta_like(self, other, op, opstr):
        raise TypeError("can only perform ops with timedelta like values")

    def _evaluate_with_datetime_like(self, other, op, opstr):
        raise TypeError("can only perform ops with datetime like values")

    def _evalute_compare(self, op):
        raise base.AbstractMethodError(self)

    @classmethod
    def _add_comparison_methods(cls):
        """ add in comparison methods """

        def _make_compare(op):
            def _evaluate_compare(self, other):
                if isinstance(other, (np.ndarray, Index, ABCSeries)):
                    if other.ndim > 0 and len(self) != len(other):
                        raise ValueError('Lengths must match to compare')

                # we may need to directly compare underlying
                # representations
                if needs_i8_conversion(self) and needs_i8_conversion(other):
                    return self._evaluate_compare(other, op)

                if (is_object_dtype(self) and
                        self.nlevels == 1):

                    # don't pass MultiIndex
                    with np.errstate(all='ignore'):
                        result = _comp_method_OBJECT_ARRAY(
                            op, self.values, other)
                else:
                    with np.errstate(all='ignore'):
                        result = op(self.values, np.asarray(other))

                # technically we could support bool dtyped Index
                # for now just return the indexing array directly
                if is_bool_dtype(result):
                    return result
                try:
                    return Index(result)
                except TypeError:
                    return result

            return _evaluate_compare

        cls.__eq__ = _make_compare(operator.eq)
        cls.__ne__ = _make_compare(operator.ne)
        cls.__lt__ = _make_compare(operator.lt)
        cls.__gt__ = _make_compare(operator.gt)
        cls.__le__ = _make_compare(operator.le)
        cls.__ge__ = _make_compare(operator.ge)

    @classmethod
    def _add_numeric_methods_add_sub_disabled(cls):
        """ add in the numeric add/sub methods to disable """

        def _make_invalid_op(name):
            def invalid_op(self, other=None):
                raise TypeError("cannot perform {name} with this index type: "
                                "{typ}".format(name=name, typ=type(self)))

            invalid_op.__name__ = name
            return invalid_op

        cls.__add__ = cls.__radd__ = __iadd__ = _make_invalid_op('__add__')  # noqa
        cls.__sub__ = __isub__ = _make_invalid_op('__sub__')  # noqa

    @classmethod
    def _add_numeric_methods_disabled(cls):
        """ add in numeric methods to disable other than add/sub """

        def _make_invalid_op(name):
            def invalid_op(self, other=None):
                raise TypeError("cannot perform {name} with this index type: "
                                "{typ}".format(name=name, typ=type(self)))

            invalid_op.__name__ = name
            return invalid_op

        cls.__pow__ = cls.__rpow__ = _make_invalid_op('__pow__')
        cls.__mul__ = cls.__rmul__ = _make_invalid_op('__mul__')
        cls.__floordiv__ = cls.__rfloordiv__ = _make_invalid_op('__floordiv__')
        cls.__truediv__ = cls.__rtruediv__ = _make_invalid_op('__truediv__')
        if not compat.PY3:
            cls.__div__ = cls.__rdiv__ = _make_invalid_op('__div__')
        cls.__neg__ = _make_invalid_op('__neg__')
        cls.__pos__ = _make_invalid_op('__pos__')
        cls.__abs__ = _make_invalid_op('__abs__')
        cls.__inv__ = _make_invalid_op('__inv__')

    def _maybe_update_attributes(self, attrs):
        """ Update Index attributes (e.g. freq) depending on op """
        return attrs

    def _validate_for_numeric_unaryop(self, op, opstr):
        """ validate if we can perform a numeric unary operation """

        if not self._is_numeric_dtype:
            raise TypeError("cannot evaluate a numeric op "
                            "{opstr} for type: {typ}".format(
                                opstr=opstr,
                                typ=type(self))
                            )

    def _validate_for_numeric_binop(self, other, op, opstr):
        """
        return valid other, evaluate or raise TypeError
        if we are not of the appropriate type

        internal method called by ops
        """
        from pandas.tseries.offsets import DateOffset

        # if we are an inheritor of numeric,
        # but not actually numeric (e.g. DatetimeIndex/PeriodInde)
        if not self._is_numeric_dtype:
            raise TypeError("cannot evaluate a numeric op {opstr} "
                            "for type: {typ}".format(
                                opstr=opstr,
                                typ=type(self))
                            )

        if isinstance(other, Index):
            if not other._is_numeric_dtype:
                raise TypeError("cannot evaluate a numeric op "
                                "{opstr} with type: {typ}".format(
                                    opstr=type(self),
                                    typ=type(other))
                                )
        elif isinstance(other, np.ndarray) and not other.ndim:
            other = other.item()

        if isinstance(other, (Index, ABCSeries, np.ndarray)):
            if len(self) != len(other):
                raise ValueError("cannot evaluate a numeric op with "
                                 "unequal lengths")
            other = _values_from_object(other)
            if other.dtype.kind not in ['f', 'i', 'u']:
                raise TypeError("cannot evaluate a numeric op "
                                "with a non-numeric dtype")
        elif isinstance(other, (DateOffset, np.timedelta64,
                                Timedelta, datetime.timedelta)):
            # higher up to handle
            pass
        elif isinstance(other, (Timestamp, np.datetime64)):
            # higher up to handle
            pass
        else:
            if not (is_float(other) or is_integer(other)):
                raise TypeError("can only perform ops with scalar values")

        return other

    @classmethod
    def _add_numeric_methods_binary(cls):
        """ add in numeric methods """

        def _make_evaluate_binop(op, opstr, reversed=False, constructor=Index):
            def _evaluate_numeric_binop(self, other):

                from pandas.tseries.offsets import DateOffset
                other = self._validate_for_numeric_binop(other, op, opstr)

                # handle time-based others
                if isinstance(other, (DateOffset, np.timedelta64,
                                      Timedelta, datetime.timedelta)):
                    return self._evaluate_with_timedelta_like(other, op, opstr)
                elif isinstance(other, (Timestamp, np.datetime64)):
                    return self._evaluate_with_datetime_like(other, op, opstr)

                # if we are a reversed non-communative op
                values = self.values
                if reversed:
                    values, other = other, values

                attrs = self._get_attributes_dict()
                attrs = self._maybe_update_attributes(attrs)
                with np.errstate(all='ignore'):
                    result = op(values, other)
                return constructor(result, **attrs)

            return _evaluate_numeric_binop

        cls.__add__ = cls.__radd__ = _make_evaluate_binop(
            operator.add, '__add__')
        cls.__sub__ = _make_evaluate_binop(
            operator.sub, '__sub__')
        cls.__rsub__ = _make_evaluate_binop(
            operator.sub, '__sub__', reversed=True)
        cls.__mul__ = cls.__rmul__ = _make_evaluate_binop(
            operator.mul, '__mul__')
        cls.__rpow__ = _make_evaluate_binop(
            operator.pow, '__pow__', reversed=True)
        cls.__pow__ = _make_evaluate_binop(
            operator.pow, '__pow__')
        cls.__mod__ = _make_evaluate_binop(
            operator.mod, '__mod__')
        cls.__floordiv__ = _make_evaluate_binop(
            operator.floordiv, '__floordiv__')
        cls.__rfloordiv__ = _make_evaluate_binop(
            operator.floordiv, '__floordiv__', reversed=True)
        cls.__truediv__ = _make_evaluate_binop(
            operator.truediv, '__truediv__')
        cls.__rtruediv__ = _make_evaluate_binop(
            operator.truediv, '__truediv__', reversed=True)
        if not compat.PY3:
            cls.__div__ = _make_evaluate_binop(
                operator.div, '__div__')
            cls.__rdiv__ = _make_evaluate_binop(
                operator.div, '__div__', reversed=True)

        cls.__divmod__ = _make_evaluate_binop(
            divmod,
            '__divmod__',
            constructor=lambda result, **attrs: (
                Index(result[0], **attrs),
                Index(result[1], **attrs),
            ),
        )

    @classmethod
    def _add_numeric_methods_unary(cls):
        """ add in numeric unary methods """

        def _make_evaluate_unary(op, opstr):

            def _evaluate_numeric_unary(self):

                self._validate_for_numeric_unaryop(op, opstr)
                attrs = self._get_attributes_dict()
                attrs = self._maybe_update_attributes(attrs)
                return Index(op(self.values), **attrs)

            return _evaluate_numeric_unary

        cls.__neg__ = _make_evaluate_unary(lambda x: -x, '__neg__')
        cls.__pos__ = _make_evaluate_unary(lambda x: x, '__pos__')
        cls.__abs__ = _make_evaluate_unary(np.abs, '__abs__')
        cls.__inv__ = _make_evaluate_unary(lambda x: -x, '__inv__')

    @classmethod
    def _add_numeric_methods(cls):
        cls._add_numeric_methods_unary()
        cls._add_numeric_methods_binary()

    @classmethod
    def _add_logical_methods(cls):
        """ add in logical methods """

        _doc = """

        %(desc)s

        Parameters
        ----------
        All arguments to numpy.%(outname)s are accepted.

        Returns
        -------
        %(outname)s : bool or array_like (if axis is specified)
            A single element array_like may be converted to bool."""

        def _make_logical_function(name, desc, f):
            @Substitution(outname=name, desc=desc)
            @Appender(_doc)
            def logical_func(self, *args, **kwargs):
                result = f(self.values)
                if (isinstance(result, (np.ndarray, ABCSeries, Index)) and
                        result.ndim == 0):
                    # return NumPy type
                    return result.dtype.type(result.item())
                else:  # pragma: no cover
                    return result

            logical_func.__name__ = name
            return logical_func

        cls.all = _make_logical_function('all', 'Return whether all elements '
                                                'are True',
                                         np.all)
        cls.any = _make_logical_function('any',
                                         'Return whether any element is True',
                                         np.any)

    @classmethod
    def _add_logical_methods_disabled(cls):
        """ add in logical methods to disable """

        def _make_invalid_op(name):
            def invalid_op(self, other=None):
                raise TypeError("cannot perform {name} with this index type: "
                                "{typ}".format(name=name, typ=type(self)))

            invalid_op.__name__ = name
            return invalid_op

        cls.all = _make_invalid_op('all')
        cls.any = _make_invalid_op('any')


Index._add_numeric_methods_disabled()
Index._add_logical_methods()
Index._add_comparison_methods()


def _ensure_index(index_like, copy=False):
    if isinstance(index_like, Index):
        if copy:
            index_like = index_like.copy()
        return index_like
    if hasattr(index_like, 'name'):
        return Index(index_like, name=index_like.name, copy=copy)

    # must check for exactly list here because of strict type
    # check in clean_index_list
    if isinstance(index_like, list):
        if type(index_like) != list:
            index_like = list(index_like)

        converted, all_arrays = lib.clean_index_list(index_like)

        if len(converted) > 0 and all_arrays:
            from .multi import MultiIndex
            return MultiIndex.from_arrays(converted)
        else:
            index_like = converted
    else:
        # clean_index_list does the equivalent of copying
        # so only need to do this if not list instance
        if copy:
            from copy import copy
            index_like = copy(index_like)

    return Index(index_like)


def _get_na_value(dtype):
    if is_datetime64_any_dtype(dtype) or is_timedelta64_dtype(dtype):
        return libts.NaT
    return {np.datetime64: libts.NaT,
            np.timedelta64: libts.NaT}.get(dtype, np.nan)


def _ensure_has_len(seq):
    """If seq is an iterator, put its values into a list."""
    try:
        len(seq)
    except TypeError:
        return list(seq)
    else:
        return seq


def _trim_front(strings):
    """
    Trims zeros and decimal points
    """
    trimmed = strings
    while len(strings) > 0 and all([x[0] == ' ' for x in trimmed]):
        trimmed = [x[1:] for x in trimmed]
    return trimmed


def _validate_join_method(method):
    if method not in ['left', 'right', 'inner', 'outer']:
        raise ValueError('do not recognize join method %s' % method)
