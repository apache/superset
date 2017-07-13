import numpy as np
from pandas._libs import (index as libindex,
                          algos as libalgos, join as libjoin)
from pandas.core.dtypes.common import (
    is_dtype_equal, pandas_dtype,
    is_float_dtype, is_object_dtype,
    is_integer_dtype, is_scalar)
from pandas.core.common import _asarray_tuplesafe, _values_from_object

from pandas import compat
from pandas.core import algorithms
from pandas.core.indexes.base import (
    Index, InvalidIndexError, _index_shared_docs)
from pandas.util._decorators import Appender, cache_readonly
import pandas.core.indexes.base as ibase


_num_index_shared_docs = dict()


class NumericIndex(Index):
    """
    Provide numeric type operations

    This is an abstract class

    """
    _is_numeric_dtype = True

    def __new__(cls, data=None, dtype=None, copy=False, name=None,
                fastpath=False):

        if fastpath:
            return cls._simple_new(data, name=name)

        # isscalar, generators handled in coerce_to_ndarray
        data = cls._coerce_to_ndarray(data)

        if issubclass(data.dtype.type, compat.string_types):
            cls._string_data_error(data)

        if copy or not is_dtype_equal(data.dtype, cls._default_dtype):
            subarr = np.array(data, dtype=cls._default_dtype, copy=copy)
            cls._assert_safe_casting(data, subarr)
        else:
            subarr = data

        if name is None and hasattr(data, 'name'):
            name = data.name
        return cls._simple_new(subarr, name=name)

    @Appender(_index_shared_docs['_maybe_cast_slice_bound'])
    def _maybe_cast_slice_bound(self, label, side, kind):
        assert kind in ['ix', 'loc', 'getitem', None]

        # we will try to coerce to integers
        return self._maybe_cast_indexer(label)

    def _convert_tolerance(self, tolerance):
        try:
            return float(tolerance)
        except ValueError:
            raise ValueError('tolerance argument for %s must be numeric: %r' %
                             (type(self).__name__, tolerance))

    @classmethod
    def _assert_safe_casting(cls, data, subarr):
        """
        Subclasses need to override this only if the process of casting data
        from some accepted dtype to the internal dtype(s) bears the risk of
        truncation (e.g. float to int).
        """
        pass

    @property
    def is_all_dates(self):
        """
        Checks that all the labels are datetime objects
        """
        return False


_num_index_shared_docs['class_descr'] = """
    Immutable ndarray implementing an ordered, sliceable set. The basic object
    storing axis labels for all pandas objects. %(klass)s is a special case
    of `Index` with purely %(ltype)s labels. %(extra)s

    Parameters
    ----------
    data : array-like (1-dimensional)
    dtype : NumPy dtype (default: %(dtype)s)
    copy : bool
        Make a copy of input ndarray
    name : object
        Name to be stored in the index
    Notes
    -----
    An Index instance can **only** contain hashable objects.
"""

_int64_descr_args = dict(
    klass='Int64Index',
    ltype='integer',
    dtype='int64',
    extra="""This is the default index type used
    by the DataFrame and Series ctors when no explicit
    index is provided by the user.
"""
)


class Int64Index(NumericIndex):
    __doc__ = _num_index_shared_docs['class_descr'] % _int64_descr_args

    _typ = 'int64index'
    _arrmap = libalgos.arrmap_int64
    _left_indexer_unique = libjoin.left_join_indexer_unique_int64
    _left_indexer = libjoin.left_join_indexer_int64
    _inner_indexer = libjoin.inner_join_indexer_int64
    _outer_indexer = libjoin.outer_join_indexer_int64
    _can_hold_na = False
    _engine_type = libindex.Int64Engine
    _default_dtype = np.int64

    @property
    def inferred_type(self):
        return 'integer'

    @property
    def asi8(self):
        # do not cache or you'll create a memory leak
        return self.values.view('i8')

    @Appender(_index_shared_docs['_convert_scalar_indexer'])
    def _convert_scalar_indexer(self, key, kind=None):
        assert kind in ['ix', 'loc', 'getitem', 'iloc', None]

        # don't coerce ilocs to integers
        if kind != 'iloc':
            key = self._maybe_cast_indexer(key)
        return (super(Int64Index, self)
                ._convert_scalar_indexer(key, kind=kind))

    def _wrap_joined_index(self, joined, other):
        name = self.name if self.name == other.name else None
        return Int64Index(joined, name=name)

    @classmethod
    def _assert_safe_casting(cls, data, subarr):
        """
        Ensure incoming data can be represented as ints.
        """
        if not issubclass(data.dtype.type, np.signedinteger):
            if not np.array_equal(data, subarr):
                raise TypeError('Unsafe NumPy casting, you must '
                                'explicitly cast')


Int64Index._add_numeric_methods()
Int64Index._add_logical_methods()

_uint64_descr_args = dict(
    klass='UInt64Index',
    ltype='unsigned integer',
    dtype='uint64',
    extra=''
)


class UInt64Index(NumericIndex):
    __doc__ = _num_index_shared_docs['class_descr'] % _uint64_descr_args

    _typ = 'uint64index'
    _arrmap = libalgos.arrmap_uint64
    _left_indexer_unique = libjoin.left_join_indexer_unique_uint64
    _left_indexer = libjoin.left_join_indexer_uint64
    _inner_indexer = libjoin.inner_join_indexer_uint64
    _outer_indexer = libjoin.outer_join_indexer_uint64
    _can_hold_na = False
    _na_value = 0
    _engine_type = libindex.UInt64Engine
    _default_dtype = np.uint64

    @property
    def inferred_type(self):
        return 'integer'

    @property
    def asi8(self):
        # do not cache or you'll create a memory leak
        return self.values.view('u8')

    @Appender(_index_shared_docs['_convert_scalar_indexer'])
    def _convert_scalar_indexer(self, key, kind=None):
        assert kind in ['ix', 'loc', 'getitem', 'iloc', None]

        # don't coerce ilocs to integers
        if kind != 'iloc':
            key = self._maybe_cast_indexer(key)
        return (super(UInt64Index, self)
                ._convert_scalar_indexer(key, kind=kind))

    @Appender(_index_shared_docs['_convert_arr_indexer'])
    def _convert_arr_indexer(self, keyarr):
        # Cast the indexer to uint64 if possible so
        # that the values returned from indexing are
        # also uint64.
        keyarr = _asarray_tuplesafe(keyarr)
        if is_integer_dtype(keyarr):
            return _asarray_tuplesafe(keyarr, dtype=np.uint64)
        return keyarr

    @Appender(_index_shared_docs['_convert_index_indexer'])
    def _convert_index_indexer(self, keyarr):
        # Cast the indexer to uint64 if possible so
        # that the values returned from indexing are
        # also uint64.
        if keyarr.is_integer():
            return keyarr.astype(np.uint64)
        return keyarr

    def _wrap_joined_index(self, joined, other):
        name = self.name if self.name == other.name else None
        return UInt64Index(joined, name=name)

    @classmethod
    def _assert_safe_casting(cls, data, subarr):
        """
        Ensure incoming data can be represented as uints.
        """
        if not issubclass(data.dtype.type, np.unsignedinteger):
            if not np.array_equal(data, subarr):
                raise TypeError('Unsafe NumPy casting, you must '
                                'explicitly cast')


UInt64Index._add_numeric_methods()
UInt64Index._add_logical_methods()

_float64_descr_args = dict(
    klass='Float64Index',
    dtype='float64',
    ltype='float',
    extra=''
)


class Float64Index(NumericIndex):
    __doc__ = _num_index_shared_docs['class_descr'] % _float64_descr_args

    _typ = 'float64index'
    _engine_type = libindex.Float64Engine
    _arrmap = libalgos.arrmap_float64
    _left_indexer_unique = libjoin.left_join_indexer_unique_float64
    _left_indexer = libjoin.left_join_indexer_float64
    _inner_indexer = libjoin.inner_join_indexer_float64
    _outer_indexer = libjoin.outer_join_indexer_float64

    _default_dtype = np.float64

    @property
    def inferred_type(self):
        return 'floating'

    @Appender(_index_shared_docs['astype'])
    def astype(self, dtype, copy=True):
        dtype = pandas_dtype(dtype)
        if is_float_dtype(dtype):
            values = self._values.astype(dtype, copy=copy)
        elif is_integer_dtype(dtype):
            if self.hasnans:
                raise ValueError('cannot convert float NaN to integer')
            values = self._values.astype(dtype, copy=copy)
        elif is_object_dtype(dtype):
            values = self._values.astype('object', copy=copy)
        else:
            raise TypeError('Setting %s dtype to anything other than '
                            'float64 or object is not supported' %
                            self.__class__)
        return Index(values, name=self.name, dtype=dtype)

    @Appender(_index_shared_docs['_convert_scalar_indexer'])
    def _convert_scalar_indexer(self, key, kind=None):
        assert kind in ['ix', 'loc', 'getitem', 'iloc', None]

        if kind == 'iloc':
            return self._validate_indexer('positional', key, kind)

        return key

    @Appender(_index_shared_docs['_convert_slice_indexer'])
    def _convert_slice_indexer(self, key, kind=None):
        # if we are not a slice, then we are done
        if not isinstance(key, slice):
            return key

        if kind == 'iloc':
            return super(Float64Index, self)._convert_slice_indexer(key,
                                                                    kind=kind)

        # translate to locations
        return self.slice_indexer(key.start, key.stop, key.step, kind=kind)

    def _format_native_types(self, na_rep='', float_format=None, decimal='.',
                             quoting=None, **kwargs):
        from pandas.io.formats.format import FloatArrayFormatter
        formatter = FloatArrayFormatter(self.values, na_rep=na_rep,
                                        float_format=float_format,
                                        decimal=decimal, quoting=quoting,
                                        fixed_width=False)
        return formatter.get_result_as_array()

    def get_value(self, series, key):
        """ we always want to get an index value, never a value """
        if not is_scalar(key):
            raise InvalidIndexError

        k = _values_from_object(key)
        loc = self.get_loc(k)
        new_values = _values_from_object(series)[loc]

        return new_values

    def equals(self, other):
        """
        Determines if two Index objects contain the same elements.
        """
        if self is other:
            return True

        if not isinstance(other, Index):
            return False

        # need to compare nans locations and make sure that they are the same
        # since nans don't compare equal this is a bit tricky
        try:
            if not isinstance(other, Float64Index):
                other = self._constructor(other)
            if (not is_dtype_equal(self.dtype, other.dtype) or
                    self.shape != other.shape):
                return False
            left, right = self._values, other._values
            return ((left == right) | (self._isnan & other._isnan)).all()
        except (TypeError, ValueError):
            return False

    def __contains__(self, other):
        if super(Float64Index, self).__contains__(other):
            return True

        try:
            # if other is a sequence this throws a ValueError
            return np.isnan(other) and self.hasnans
        except ValueError:
            try:
                return len(other) <= 1 and ibase._try_get_item(other) in self
            except TypeError:
                return False
        except:
            return False

    @Appender(_index_shared_docs['get_loc'])
    def get_loc(self, key, method=None, tolerance=None):
        try:
            if np.all(np.isnan(key)):
                nan_idxs = self._nan_idxs
                try:
                    return nan_idxs.item()
                except (ValueError, IndexError):
                    # should only need to catch ValueError here but on numpy
                    # 1.7 .item() can raise IndexError when NaNs are present
                    return nan_idxs
        except (TypeError, NotImplementedError):
            pass
        return super(Float64Index, self).get_loc(key, method=method,
                                                 tolerance=tolerance)

    @cache_readonly
    def is_unique(self):
        return super(Float64Index, self).is_unique and self._nan_idxs.size < 2

    @Appender(Index.isin.__doc__)
    def isin(self, values, level=None):
        if level is not None:
            self._validate_index_level(level)
        return algorithms.isin(np.array(self), values)


Float64Index._add_numeric_methods()
Float64Index._add_logical_methods_disabled()
