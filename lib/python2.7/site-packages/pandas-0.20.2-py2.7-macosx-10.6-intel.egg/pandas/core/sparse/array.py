"""
SparseArray data structure
"""
from __future__ import division
# pylint: disable=E1101,E1103,W0231

import numpy as np
import warnings

import pandas as pd
from pandas.core.base import PandasObject

from pandas import compat
from pandas.compat import range
from pandas.compat.numpy import function as nv

from pandas.core.dtypes.generic import (
    ABCSparseArray, ABCSparseSeries)
from pandas.core.dtypes.common import (
    _ensure_platform_int,
    is_float, is_integer,
    is_integer_dtype,
    is_bool_dtype,
    is_list_like,
    is_string_dtype,
    is_scalar, is_dtype_equal)
from pandas.core.dtypes.cast import (
    maybe_convert_platform, maybe_promote,
    astype_nansafe, find_common_type)
from pandas.core.dtypes.missing import isnull, notnull, na_value_for_dtype

import pandas._libs.sparse as splib
from pandas._libs.sparse import SparseIndex, BlockIndex, IntIndex
from pandas._libs import index as libindex
import pandas.core.algorithms as algos
import pandas.core.ops as ops
import pandas.io.formats.printing as printing
from pandas.util._decorators import Appender
from pandas.core.indexes.base import _index_shared_docs


_sparray_doc_kwargs = dict(klass='SparseArray')


def _arith_method(op, name, str_rep=None, default_axis=None, fill_zeros=None,
                  **eval_kwargs):
    """
    Wrapper function for Series arithmetic operations, to avoid
    code duplication.
    """

    def wrapper(self, other):
        if isinstance(other, np.ndarray):
            if len(self) != len(other):
                raise AssertionError("length mismatch: %d vs. %d" %
                                     (len(self), len(other)))
            if not isinstance(other, ABCSparseArray):
                dtype = getattr(other, 'dtype', None)
                other = SparseArray(other, fill_value=self.fill_value,
                                    dtype=dtype)
            return _sparse_array_op(self, other, op, name)
        elif is_scalar(other):
            with np.errstate(all='ignore'):
                fill = op(_get_fill(self), np.asarray(other))
                result = op(self.sp_values, other)

            return _wrap_result(name, result, self.sp_index, fill)
        else:  # pragma: no cover
            raise TypeError('operation with %s not supported' % type(other))

    if name.startswith("__"):
        name = name[2:-2]
    wrapper.__name__ = name
    return wrapper


def _get_fill(arr):
    # coerce fill_value to arr dtype if possible
    # int64 SparseArray can have NaN as fill_value if there is no missing
    try:
        return np.asarray(arr.fill_value, dtype=arr.dtype)
    except ValueError:
        return np.asarray(arr.fill_value)


def _sparse_array_op(left, right, op, name, series=False):

    if series and is_integer_dtype(left) and is_integer_dtype(right):
        # series coerces to float64 if result should have NaN/inf
        if name in ('floordiv', 'mod') and (right.values == 0).any():
            left = left.astype(np.float64)
            right = right.astype(np.float64)
        elif name in ('rfloordiv', 'rmod') and (left.values == 0).any():
            left = left.astype(np.float64)
            right = right.astype(np.float64)

    # dtype used to find corresponding sparse method
    if not is_dtype_equal(left.dtype, right.dtype):
        dtype = find_common_type([left.dtype, right.dtype])
        left = left.astype(dtype)
        right = right.astype(dtype)
    else:
        dtype = left.dtype

    # dtype the result must have
    result_dtype = None

    if left.sp_index.ngaps == 0 or right.sp_index.ngaps == 0:
        with np.errstate(all='ignore'):
            result = op(left.get_values(), right.get_values())
            fill = op(_get_fill(left), _get_fill(right))

        if left.sp_index.ngaps == 0:
            index = left.sp_index
        else:
            index = right.sp_index
    elif left.sp_index.equals(right.sp_index):
        with np.errstate(all='ignore'):
            result = op(left.sp_values, right.sp_values)
            fill = op(_get_fill(left), _get_fill(right))
        index = left.sp_index
    else:
        if name[0] == 'r':
            left, right = right, left
            name = name[1:]

        if name in ('and', 'or') and dtype == 'bool':
            opname = 'sparse_{name}_uint8'.format(name=name, dtype=dtype)
            # to make template simple, cast here
            left_sp_values = left.sp_values.view(np.uint8)
            right_sp_values = right.sp_values.view(np.uint8)
            result_dtype = np.bool
        else:
            opname = 'sparse_{name}_{dtype}'.format(name=name, dtype=dtype)
            left_sp_values = left.sp_values
            right_sp_values = right.sp_values

        sparse_op = getattr(splib, opname)
        with np.errstate(all='ignore'):
            result, index, fill = sparse_op(left_sp_values, left.sp_index,
                                            left.fill_value, right_sp_values,
                                            right.sp_index, right.fill_value)

    if result_dtype is None:
        result_dtype = result.dtype

    return _wrap_result(name, result, index, fill, dtype=result_dtype)


def _wrap_result(name, data, sparse_index, fill_value, dtype=None):
    """ wrap op result to have correct dtype """
    if name in ('eq', 'ne', 'lt', 'gt', 'le', 'ge'):
        dtype = np.bool

    if is_bool_dtype(dtype):
        # fill_value may be np.bool_
        fill_value = bool(fill_value)
    return SparseArray(data, sparse_index=sparse_index,
                       fill_value=fill_value, dtype=dtype)


class SparseArray(PandasObject, np.ndarray):
    """Data structure for labeled, sparse floating point 1-D data

    Parameters
    ----------
    data : {array-like (1-D), Series, SparseSeries, dict}
    kind : {'block', 'integer'}
    fill_value : float
        Code for missing value. Defaults depends on dtype.
        0 for int dtype, False for bool dtype, and NaN for other dtypes
    sparse_index : {BlockIndex, IntIndex}, optional
        Only if you have one. Mainly used internally

    Notes
    -----
    SparseArray objects are immutable via the typical Python means. If you
    must change values, convert to dense, make your changes, then convert back
    to sparse
    """
    __array_priority__ = 15
    _typ = 'array'
    _subtyp = 'sparse_array'

    sp_index = None
    fill_value = None

    def __new__(cls, data, sparse_index=None, index=None, kind='integer',
                fill_value=None, dtype=None, copy=False):

        if index is not None:
            if data is None:
                data = np.nan
            if not is_scalar(data):
                raise Exception("must only pass scalars with an index ")
            values = np.empty(len(index), dtype='float64')
            values.fill(data)
            data = values

        if isinstance(data, ABCSparseSeries):
            data = data.values
        is_sparse_array = isinstance(data, SparseArray)

        if dtype is not None:
            dtype = np.dtype(dtype)

        if is_sparse_array:
            sparse_index = data.sp_index
            values = data.sp_values
            fill_value = data.fill_value
        else:
            # array-like
            if sparse_index is None:
                if dtype is not None:
                    data = np.asarray(data, dtype=dtype)
                res = make_sparse(data, kind=kind, fill_value=fill_value)
                values, sparse_index, fill_value = res
            else:
                values = _sanitize_values(data)
                if len(values) != sparse_index.npoints:
                    raise AssertionError("Non array-like type {0} must have"
                                         " the same length as the"
                                         " index".format(type(values)))
        # Create array, do *not* copy data by default
        if copy:
            subarr = np.array(values, dtype=dtype, copy=True)
        else:
            subarr = np.asarray(values, dtype=dtype)
        # Change the class of the array to be the subclass type.
        return cls._simple_new(subarr, sparse_index, fill_value)

    @classmethod
    def _simple_new(cls, data, sp_index, fill_value):
        if not isinstance(sp_index, SparseIndex):
            # caller must pass SparseIndex
            raise ValueError('sp_index must be a SparseIndex')

        if fill_value is None:
            if sp_index.ngaps > 0:
                # has missing hole
                fill_value = np.nan
            else:
                fill_value = na_value_for_dtype(data.dtype)

        if (is_integer_dtype(data) and is_float(fill_value) and
                sp_index.ngaps > 0):
            # if float fill_value is being included in dense repr,
            # convert values to float
            data = data.astype(float)

        result = data.view(cls)

        if not isinstance(sp_index, SparseIndex):
            # caller must pass SparseIndex
            raise ValueError('sp_index must be a SparseIndex')

        result.sp_index = sp_index
        result._fill_value = fill_value
        return result

    @property
    def _constructor(self):
        return lambda x: SparseArray(x, fill_value=self.fill_value,
                                     kind=self.kind)

    @property
    def kind(self):
        if isinstance(self.sp_index, BlockIndex):
            return 'block'
        elif isinstance(self.sp_index, IntIndex):
            return 'integer'

    def __array_wrap__(self, out_arr, context=None):
        """
        NumPy calls this method when ufunc is applied

        Parameters
        ----------

        out_arr : ndarray
            ufunc result (note that ufunc is only applied to sp_values)
        context : tuple of 3 elements (ufunc, signature, domain)
            for example, following is a context when np.sin is applied to
            SparseArray,

            (<ufunc 'sin'>, (SparseArray,), 0))

        See http://docs.scipy.org/doc/numpy/user/basics.subclassing.html
        """
        if isinstance(context, tuple) and len(context) == 3:
            ufunc, args, domain = context
            # to apply ufunc only to fill_value (to avoid recursive call)
            args = [getattr(a, 'fill_value', a) for a in args]
            with np.errstate(all='ignore'):
                fill_value = ufunc(self.fill_value, *args[1:])
        else:
            fill_value = self.fill_value

        return self._simple_new(out_arr, sp_index=self.sp_index,
                                fill_value=fill_value)

    def __array_finalize__(self, obj):
        """
        Gets called after any ufunc or other array operations, necessary
        to pass on the index.
        """
        self.sp_index = getattr(obj, 'sp_index', None)
        self._fill_value = getattr(obj, 'fill_value', None)

    def __reduce__(self):
        """Necessary for making this object picklable"""
        object_state = list(np.ndarray.__reduce__(self))
        subclass_state = self.fill_value, self.sp_index
        object_state[2] = (object_state[2], subclass_state)
        return tuple(object_state)

    def __setstate__(self, state):
        """Necessary for making this object picklable"""
        nd_state, own_state = state
        np.ndarray.__setstate__(self, nd_state)

        fill_value, sp_index = own_state[:2]
        self.sp_index = sp_index
        self._fill_value = fill_value

    def __len__(self):
        try:
            return self.sp_index.length
        except:
            return 0

    def __unicode__(self):
        return '%s\nFill: %s\n%s' % (printing.pprint_thing(self),
                                     printing.pprint_thing(self.fill_value),
                                     printing.pprint_thing(self.sp_index))

    def disable(self, other):
        raise NotImplementedError('inplace binary ops not supported')
    # Inplace operators
    __iadd__ = disable
    __isub__ = disable
    __imul__ = disable
    __itruediv__ = disable
    __ifloordiv__ = disable
    __ipow__ = disable

    # Python 2 division operators
    if not compat.PY3:
        __idiv__ = disable

    @property
    def values(self):
        """
        Dense values
        """
        output = np.empty(len(self), dtype=self.dtype)
        int_index = self.sp_index.to_int_index()
        output.fill(self.fill_value)
        output.put(int_index.indices, self)
        return output

    @property
    def sp_values(self):
        # caching not an option, leaks memory
        return self.view(np.ndarray)

    @property
    def fill_value(self):
        return self._fill_value

    @fill_value.setter
    def fill_value(self, value):
        if not is_scalar(value):
            raise ValueError('fill_value must be a scalar')
        # if the specified value triggers type promotion, raise ValueError
        new_dtype, fill_value = maybe_promote(self.dtype, value)
        if is_dtype_equal(self.dtype, new_dtype):
            self._fill_value = fill_value
        else:
            msg = 'unable to set fill_value {0} to {1} dtype'
            raise ValueError(msg.format(value, self.dtype))

    def get_values(self, fill=None):
        """ return a dense representation """
        return self.to_dense(fill=fill)

    def to_dense(self, fill=None):
        """
        Convert SparseArray to a NumPy array.

        Parameters
        ----------
        fill: float, default None
            DEPRECATED: this argument will be removed in a future version
            because it is not respected by this function.

        Returns
        -------
        arr : NumPy array
        """
        if fill is not None:
            warnings.warn(("The 'fill' parameter has been deprecated and "
                           "will be removed in a future version."),
                          FutureWarning, stacklevel=2)
        return self.values

    def __iter__(self):
        for i in range(len(self)):
            yield self._get_val_at(i)

    def __getitem__(self, key):
        """

        """

        if is_integer(key):
            return self._get_val_at(key)
        elif isinstance(key, tuple):
            data_slice = self.values[key]
        else:
            if isinstance(key, SparseArray):
                if is_bool_dtype(key):
                    key = key.to_dense()
                else:
                    key = np.asarray(key)

            if hasattr(key, '__len__') and len(self) != len(key):
                return self.take(key)
            else:
                data_slice = self.values[key]

        return self._constructor(data_slice)

    def __getslice__(self, i, j):
        if i < 0:
            i = 0
        if j < 0:
            j = 0
        slobj = slice(i, j)
        return self.__getitem__(slobj)

    def _get_val_at(self, loc):
        n = len(self)
        if loc < 0:
            loc += n

        if loc >= n or loc < 0:
            raise IndexError('Out of bounds access')

        sp_loc = self.sp_index.lookup(loc)
        if sp_loc == -1:
            return self.fill_value
        else:
            return libindex.get_value_at(self, sp_loc)

    @Appender(_index_shared_docs['take'] % _sparray_doc_kwargs)
    def take(self, indices, axis=0, allow_fill=True,
             fill_value=None, **kwargs):
        """
        Sparse-compatible version of ndarray.take

        Returns
        -------
        taken : ndarray
        """
        nv.validate_take(tuple(), kwargs)

        if axis:
            raise ValueError("axis must be 0, input was {0}".format(axis))

        if is_integer(indices):
            # return scalar
            return self[indices]

        indices = _ensure_platform_int(indices)
        n = len(self)
        if allow_fill and fill_value is not None:
            # allow -1 to indicate self.fill_value,
            # self.fill_value may not be NaN
            if (indices < -1).any():
                msg = ('When allow_fill=True and fill_value is not None, '
                       'all indices must be >= -1')
                raise ValueError(msg)
            elif (n <= indices).any():
                msg = 'index is out of bounds for size {0}'
                raise IndexError(msg.format(n))
        else:
            if ((indices < -n) | (n <= indices)).any():
                msg = 'index is out of bounds for size {0}'
                raise IndexError(msg.format(n))

        indices = indices.astype(np.int32)
        if not (allow_fill and fill_value is not None):
            indices = indices.copy()
            indices[indices < 0] += n

        locs = self.sp_index.lookup_array(indices)
        indexer = np.arange(len(locs), dtype=np.int32)
        mask = locs != -1
        if mask.any():
            indexer = indexer[mask]
            new_values = self.sp_values.take(locs[mask])
        else:
            indexer = np.empty(shape=(0, ), dtype=np.int32)
            new_values = np.empty(shape=(0, ), dtype=self.sp_values.dtype)

        sp_index = _make_index(len(indices), indexer, kind=self.sp_index)
        return self._simple_new(new_values, sp_index, self.fill_value)

    def __setitem__(self, key, value):
        # if is_integer(key):
        #    self.values[key] = value
        # else:
        #    raise Exception("SparseArray does not support seting non-scalars
        # via setitem")
        raise TypeError(
            "SparseArray does not support item assignment via setitem")

    def __setslice__(self, i, j, value):
        if i < 0:
            i = 0
        if j < 0:
            j = 0
        slobj = slice(i, j)  # noqa

        # if not is_scalar(value):
        #    raise Exception("SparseArray does not support seting non-scalars
        # via slices")

        # x = self.values
        # x[slobj] = value
        # self.values = x
        raise TypeError("SparseArray does not support item assignment via "
                        "slices")

    def astype(self, dtype=None, copy=True):
        dtype = np.dtype(dtype)
        sp_values = astype_nansafe(self.sp_values, dtype, copy=copy)
        try:
            if is_bool_dtype(dtype):
                # to avoid np.bool_ dtype
                fill_value = bool(self.fill_value)
            else:
                fill_value = dtype.type(self.fill_value)
        except ValueError:
            msg = 'unable to coerce current fill_value {0} to {1} dtype'
            raise ValueError(msg.format(self.fill_value, dtype))
        return self._simple_new(sp_values, self.sp_index,
                                fill_value=fill_value)

    def copy(self, deep=True):
        """
        Make a copy of the SparseArray. Only the actual sparse values need to
        be copied.
        """
        if deep:
            values = self.sp_values.copy()
        else:
            values = self.sp_values
        return SparseArray(values, sparse_index=self.sp_index,
                           dtype=self.dtype, fill_value=self.fill_value)

    def count(self):
        """
        Compute sum of non-NA/null observations in SparseArray. If the
        fill_value is not NaN, the "sparse" locations will be included in the
        observation count.

        Returns
        -------
        nobs : int
        """
        sp_values = self.sp_values
        valid_spvals = np.isfinite(sp_values).sum()
        if self._null_fill_value:
            return valid_spvals
        else:
            return valid_spvals + self.sp_index.ngaps

    @property
    def _null_fill_value(self):
        return isnull(self.fill_value)

    @property
    def _valid_sp_values(self):
        sp_vals = self.sp_values
        mask = notnull(sp_vals)
        return sp_vals[mask]

    @Appender(_index_shared_docs['fillna'] % _sparray_doc_kwargs)
    def fillna(self, value, downcast=None):
        if downcast is not None:
            raise NotImplementedError

        if issubclass(self.dtype.type, np.floating):
            value = float(value)

        if self._null_fill_value:
            return self._simple_new(self.sp_values, self.sp_index,
                                    fill_value=value)
        else:
            new_values = self.sp_values.copy()
            new_values[isnull(new_values)] = value
            return self._simple_new(new_values, self.sp_index,
                                    fill_value=self.fill_value)

    def sum(self, axis=0, *args, **kwargs):
        """
        Sum of non-NA/null values

        Returns
        -------
        sum : float
        """
        nv.validate_sum(args, kwargs)
        valid_vals = self._valid_sp_values
        sp_sum = valid_vals.sum()
        if self._null_fill_value:
            return sp_sum
        else:
            nsparse = self.sp_index.ngaps
            return sp_sum + self.fill_value * nsparse

    def cumsum(self, axis=0, *args, **kwargs):
        """
        Cumulative sum of non-NA/null values.

        When performing the cumulative summation, any non-NA/null values will
        be skipped. The resulting SparseArray will preserve the locations of
        NaN values, but the fill value will be `np.nan` regardless.

        Parameters
        ----------
        axis : int or None
            Axis over which to perform the cumulative summation. If None,
            perform cumulative summation over flattened array.

        Returns
        -------
        cumsum : SparseArray
        """
        nv.validate_cumsum(args, kwargs)

        if axis is not None and axis >= self.ndim:  # Mimic ndarray behaviour.
            raise ValueError("axis(={axis}) out of bounds".format(axis=axis))

        if not self._null_fill_value:
            return SparseArray(self.to_dense()).cumsum()

        return SparseArray(self.sp_values.cumsum(), sparse_index=self.sp_index,
                           fill_value=self.fill_value)

    def mean(self, axis=0, *args, **kwargs):
        """
        Mean of non-NA/null values

        Returns
        -------
        mean : float
        """
        nv.validate_mean(args, kwargs)
        valid_vals = self._valid_sp_values
        sp_sum = valid_vals.sum()
        ct = len(valid_vals)

        if self._null_fill_value:
            return sp_sum / ct
        else:
            nsparse = self.sp_index.ngaps
            return (sp_sum + self.fill_value * nsparse) / (ct + nsparse)

    def value_counts(self, dropna=True):
        """
        Returns a Series containing counts of unique values.

        Parameters
        ----------
        dropna : boolean, default True
            Don't include counts of NaN, even if NaN is in sp_values.

        Returns
        -------
        counts : Series
        """
        keys, counts = algos._value_counts_arraylike(self.sp_values,
                                                     dropna=dropna)
        fcounts = self.sp_index.ngaps
        if fcounts > 0:
            if self._null_fill_value and dropna:
                pass
            else:
                if self._null_fill_value:
                    mask = pd.isnull(keys)
                else:
                    mask = keys == self.fill_value

                if mask.any():
                    counts[mask] += fcounts
                else:
                    keys = np.insert(keys, 0, self.fill_value)
                    counts = np.insert(counts, 0, fcounts)

        if not isinstance(keys, pd.Index):
            keys = pd.Index(keys)
        result = pd.Series(counts, index=keys)
        return result


def _maybe_to_dense(obj):
    """ try to convert to dense """
    if hasattr(obj, 'to_dense'):
        return obj.to_dense()
    return obj


def _maybe_to_sparse(array):
    """ array must be SparseSeries or SparseArray """
    if isinstance(array, ABCSparseSeries):
        array = array.values.copy()
    return array


def _sanitize_values(arr):
    """
    return an ndarray for our input,
    in a platform independent manner
    """

    if hasattr(arr, 'values'):
        arr = arr.values
    else:

        # scalar
        if is_scalar(arr):
            arr = [arr]

        # ndarray
        if isinstance(arr, np.ndarray):
            pass

        elif is_list_like(arr) and len(arr) > 0:
            arr = maybe_convert_platform(arr)

        else:
            arr = np.asarray(arr)

    return arr


def make_sparse(arr, kind='block', fill_value=None):
    """
    Convert ndarray to sparse format

    Parameters
    ----------
    arr : ndarray
    kind : {'block', 'integer'}
    fill_value : NaN or another value

    Returns
    -------
    (sparse_values, index) : (ndarray, SparseIndex)
    """

    arr = _sanitize_values(arr)

    if arr.ndim > 1:
        raise TypeError("expected dimension <= 1 data")

    if fill_value is None:
        fill_value = na_value_for_dtype(arr.dtype)

    if isnull(fill_value):
        mask = notnull(arr)
    else:
        # For str arrays in NumPy 1.12.0, operator!= below isn't
        # element-wise but just returns False if fill_value is not str,
        # so cast to object comparison to be safe
        if is_string_dtype(arr):
            arr = arr.astype(object)

        mask = arr != fill_value

    length = len(arr)
    if length != mask.size:
        # the arr is a SparseArray
        indices = mask.sp_index.indices
    else:
        indices = mask.nonzero()[0].astype(np.int32)

    index = _make_index(length, indices, kind)
    sparsified_values = arr[mask]
    return sparsified_values, index, fill_value


def _make_index(length, indices, kind):

    if kind == 'block' or isinstance(kind, BlockIndex):
        locs, lens = splib.get_blocks(indices)
        index = BlockIndex(length, locs, lens)
    elif kind == 'integer' or isinstance(kind, IntIndex):
        index = IntIndex(length, indices)
    else:  # pragma: no cover
        raise ValueError('must be block or integer type')
    return index


ops.add_special_arithmetic_methods(SparseArray, arith_method=_arith_method,
                                   comp_method=_arith_method,
                                   bool_method=_arith_method,
                                   use_numexpr=False)
