import copy
import itertools
import re
import operator
from datetime import datetime, timedelta, date
from collections import defaultdict

import numpy as np

from pandas.core.base import PandasObject

from pandas.core.dtypes.dtypes import (
    ExtensionDtype, DatetimeTZDtype,
    CategoricalDtype)
from pandas.core.dtypes.common import (
    _TD_DTYPE, _NS_DTYPE,
    _ensure_int64, _ensure_platform_int,
    is_integer,
    is_dtype_equal,
    is_timedelta64_dtype,
    is_datetime64_dtype, is_datetimetz, is_sparse,
    is_categorical, is_categorical_dtype,
    is_integer_dtype,
    is_datetime64tz_dtype,
    is_object_dtype,
    is_datetimelike_v_numeric,
    is_float_dtype, is_numeric_dtype,
    is_numeric_v_string_like, is_extension_type,
    is_list_like,
    is_re,
    is_re_compilable,
    is_scalar,
    _get_dtype)
from pandas.core.dtypes.cast import (
    maybe_downcast_to_dtype,
    maybe_convert_string_to_object,
    maybe_upcast,
    maybe_convert_scalar, maybe_promote,
    infer_dtype_from_scalar,
    soft_convert_objects,
    maybe_convert_objects,
    astype_nansafe,
    find_common_type)
from pandas.core.dtypes.missing import (
    isnull, array_equivalent,
    _is_na_compat,
    is_null_datelike_scalar)
import pandas.core.dtypes.concat as _concat

from pandas.core.dtypes.generic import ABCSeries
from pandas.core.common import is_null_slice
import pandas.core.algorithms as algos

from pandas.core.index import Index, MultiIndex, _ensure_index
from pandas.core.indexing import maybe_convert_indices, length_of_indexer
from pandas.core.categorical import Categorical, maybe_to_categorical
from pandas.core.indexes.datetimes import DatetimeIndex
from pandas.io.formats.printing import pprint_thing

import pandas.core.missing as missing
from pandas.core.sparse.array import _maybe_to_sparse, SparseArray
from pandas._libs import lib, tslib
from pandas._libs.tslib import Timedelta
from pandas._libs.lib import BlockPlacement

import pandas.core.computation.expressions as expressions
from pandas.util._decorators import cache_readonly
from pandas.util._validators import validate_bool_kwarg

from pandas import compat, _np_version_under1p9
from pandas.compat import range, map, zip, u


class Block(PandasObject):
    """
    Canonical n-dimensional unit of homogeneous dtype contained in a pandas
    data structure

    Index-ignorant; let the container take care of that
    """
    __slots__ = ['_mgr_locs', 'values', 'ndim']
    is_numeric = False
    is_float = False
    is_integer = False
    is_complex = False
    is_datetime = False
    is_datetimetz = False
    is_timedelta = False
    is_bool = False
    is_object = False
    is_categorical = False
    is_sparse = False
    _box_to_block_values = True
    _can_hold_na = False
    _downcast_dtype = None
    _can_consolidate = True
    _verify_integrity = True
    _validate_ndim = True
    _ftype = 'dense'
    _holder = None

    def __init__(self, values, placement, ndim=None, fastpath=False):
        if ndim is None:
            ndim = values.ndim
        elif values.ndim != ndim:
            raise ValueError('Wrong number of dimensions')
        self.ndim = ndim

        self.mgr_locs = placement
        self.values = values

        if ndim and len(self.mgr_locs) != len(self.values):
            raise ValueError('Wrong number of items passed %d, placement '
                             'implies %d' % (len(self.values),
                                             len(self.mgr_locs)))

    @property
    def _consolidate_key(self):
        return (self._can_consolidate, self.dtype.name)

    @property
    def _is_single_block(self):
        return self.ndim == 1

    @property
    def is_view(self):
        """ return a boolean if I am possibly a view """
        return self.values.base is not None

    @property
    def is_datelike(self):
        """ return True if I am a non-datelike """
        return self.is_datetime or self.is_timedelta

    def is_categorical_astype(self, dtype):
        """
        validate that we have a astypeable to categorical,
        returns a boolean if we are a categorical
        """
        if is_categorical_dtype(dtype):
            if dtype == CategoricalDtype():
                return True

            # this is a pd.Categorical, but is not
            # a valid type for astypeing
            raise TypeError("invalid type {0} for astype".format(dtype))

        return False

    def external_values(self, dtype=None):
        """ return an outside world format, currently just the ndarray """
        return self.values

    def internal_values(self, dtype=None):
        """ return an internal format, currently just the ndarray
        this should be the pure internal API format
        """
        return self.values

    def get_values(self, dtype=None):
        """
        return an internal format, currently just the ndarray
        this is often overriden to handle to_dense like operations
        """
        if is_object_dtype(dtype):
            return self.values.astype(object)
        return self.values

    def to_dense(self):
        return self.values.view()

    def to_object_block(self, mgr):
        """ return myself as an object block """
        values = self.get_values(dtype=object)
        return self.make_block(values, klass=ObjectBlock)

    @property
    def _na_value(self):
        return np.nan

    @property
    def fill_value(self):
        return np.nan

    @property
    def mgr_locs(self):
        return self._mgr_locs

    @property
    def array_dtype(self):
        """ the dtype to return if I want to construct this block as an
        array
        """
        return self.dtype

    def make_block(self, values, placement=None, ndim=None, **kwargs):
        """
        Create a new block, with type inference propagate any values that are
        not specified
        """
        if placement is None:
            placement = self.mgr_locs
        if ndim is None:
            ndim = self.ndim

        return make_block(values, placement=placement, ndim=ndim, **kwargs)

    def make_block_scalar(self, values, **kwargs):
        """
        Create a ScalarBlock
        """
        return ScalarBlock(values)

    def make_block_same_class(self, values, placement=None, fastpath=True,
                              **kwargs):
        """ Wrap given values in a block of same type as self. """
        if placement is None:
            placement = self.mgr_locs
        return make_block(values, placement=placement, klass=self.__class__,
                          fastpath=fastpath, **kwargs)

    @mgr_locs.setter
    def mgr_locs(self, new_mgr_locs):
        if not isinstance(new_mgr_locs, BlockPlacement):
            new_mgr_locs = BlockPlacement(new_mgr_locs)

        self._mgr_locs = new_mgr_locs

    def __unicode__(self):

        # don't want to print out all of the items here
        name = pprint_thing(self.__class__.__name__)
        if self._is_single_block:

            result = '%s: %s dtype: %s' % (name, len(self), self.dtype)

        else:

            shape = ' x '.join([pprint_thing(s) for s in self.shape])
            result = '%s: %s, %s, dtype: %s' % (name, pprint_thing(
                self.mgr_locs.indexer), shape, self.dtype)

        return result

    def __len__(self):
        return len(self.values)

    def __getstate__(self):
        return self.mgr_locs.indexer, self.values

    def __setstate__(self, state):
        self.mgr_locs = BlockPlacement(state[0])
        self.values = state[1]
        self.ndim = self.values.ndim

    def _slice(self, slicer):
        """ return a slice of my values """
        return self.values[slicer]

    def reshape_nd(self, labels, shape, ref_items, mgr=None):
        """
        Parameters
        ----------
        labels : list of new axis labels
        shape : new shape
        ref_items : new ref_items

        return a new block that is transformed to a nd block
        """

        return _block2d_to_blocknd(values=self.get_values().T,
                                   placement=self.mgr_locs, shape=shape,
                                   labels=labels, ref_items=ref_items)

    def getitem_block(self, slicer, new_mgr_locs=None):
        """
        Perform __getitem__-like, return result as block.

        As of now, only supports slices that preserve dimensionality.
        """
        if new_mgr_locs is None:
            if isinstance(slicer, tuple):
                axis0_slicer = slicer[0]
            else:
                axis0_slicer = slicer
            new_mgr_locs = self.mgr_locs[axis0_slicer]

        new_values = self._slice(slicer)

        if self._validate_ndim and new_values.ndim != self.ndim:
            raise ValueError("Only same dim slicing is allowed")

        return self.make_block_same_class(new_values, new_mgr_locs)

    @property
    def shape(self):
        return self.values.shape

    @property
    def itemsize(self):
        return self.values.itemsize

    @property
    def dtype(self):
        return self.values.dtype

    @property
    def ftype(self):
        return "%s:%s" % (self.dtype, self._ftype)

    def merge(self, other):
        return _merge_blocks([self, other])

    def reindex_axis(self, indexer, method=None, axis=1, fill_value=None,
                     limit=None, mask_info=None):
        """
        Reindex using pre-computed indexer information
        """
        if axis < 1:
            raise AssertionError('axis must be at least 1, got %d' % axis)
        if fill_value is None:
            fill_value = self.fill_value

        new_values = algos.take_nd(self.values, indexer, axis,
                                   fill_value=fill_value, mask_info=mask_info)
        return self.make_block(new_values, fastpath=True)

    def get(self, item):
        loc = self.items.get_loc(item)
        return self.values[loc]

    def iget(self, i):
        return self.values[i]

    def set(self, locs, values, check=False):
        """
        Modify Block in-place with new item value

        Returns
        -------
        None
        """
        self.values[locs] = values

    def delete(self, loc):
        """
        Delete given loc(-s) from block in-place.
        """
        self.values = np.delete(self.values, loc, 0)
        self.mgr_locs = self.mgr_locs.delete(loc)

    def apply(self, func, mgr=None, **kwargs):
        """ apply the function to my values; return a block if we are not
        one
        """
        with np.errstate(all='ignore'):
            result = func(self.values, **kwargs)
        if not isinstance(result, Block):
            result = self.make_block(values=_block_shape(result,
                                                         ndim=self.ndim))

        return result

    def fillna(self, value, limit=None, inplace=False, downcast=None,
               mgr=None):
        """ fillna on the block with the value. If we fail, then convert to
        ObjectBlock and try again
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')

        if not self._can_hold_na:
            if inplace:
                return self
            else:
                return self.copy()

        original_value = value
        mask = isnull(self.values)
        if limit is not None:
            if not is_integer(limit):
                raise ValueError('Limit must be an integer')
            if limit < 1:
                raise ValueError('Limit must be greater than 0')
            if self.ndim > 2:
                raise NotImplementedError("number of dimensions for 'fillna' "
                                          "is currently limited to 2")
            mask[mask.cumsum(self.ndim - 1) > limit] = False

        # fillna, but if we cannot coerce, then try again as an ObjectBlock
        try:
            values, _, value, _ = self._try_coerce_args(self.values, value)
            blocks = self.putmask(mask, value, inplace=inplace)
            blocks = [b.make_block(values=self._try_coerce_result(b.values))
                      for b in blocks]
            return self._maybe_downcast(blocks, downcast)
        except (TypeError, ValueError):

            # we can't process the value, but nothing to do
            if not mask.any():
                return self if inplace else self.copy()

            # we cannot coerce the underlying object, so
            # make an ObjectBlock
            return self.to_object_block(mgr=mgr).fillna(original_value,
                                                        limit=limit,
                                                        inplace=inplace,
                                                        downcast=False)

    def _maybe_downcast(self, blocks, downcast=None):

        # no need to downcast our float
        # unless indicated
        if downcast is None and self.is_float:
            return blocks
        elif downcast is None and (self.is_timedelta or self.is_datetime):
            return blocks

        return _extend_blocks([b.downcast(downcast) for b in blocks])

    def downcast(self, dtypes=None, mgr=None):
        """ try to downcast each item to the dict of dtypes if present """

        # turn it off completely
        if dtypes is False:
            return self

        values = self.values

        # single block handling
        if self._is_single_block:

            # try to cast all non-floats here
            if dtypes is None:
                dtypes = 'infer'

            nv = maybe_downcast_to_dtype(values, dtypes)
            return self.make_block(nv, fastpath=True)

        # ndim > 1
        if dtypes is None:
            return self

        if not (dtypes == 'infer' or isinstance(dtypes, dict)):
            raise ValueError("downcast must have a dictionary or 'infer' as "
                             "its argument")

        # item-by-item
        # this is expensive as it splits the blocks items-by-item
        blocks = []
        for i, rl in enumerate(self.mgr_locs):

            if dtypes == 'infer':
                dtype = 'infer'
            else:
                raise AssertionError("dtypes as dict is not supported yet")
                # TODO: This either should be completed or removed
                dtype = dtypes.get(item, self._downcast_dtype)  # noqa

            if dtype is None:
                nv = _block_shape(values[i], ndim=self.ndim)
            else:
                nv = maybe_downcast_to_dtype(values[i], dtype)
                nv = _block_shape(nv, ndim=self.ndim)

            blocks.append(self.make_block(nv, fastpath=True, placement=[rl]))

        return blocks

    def astype(self, dtype, copy=False, errors='raise', values=None, **kwargs):
        return self._astype(dtype, copy=copy, errors=errors, values=values,
                            **kwargs)

    def _astype(self, dtype, copy=False, errors='raise', values=None,
                klass=None, mgr=None, **kwargs):
        """
        Coerce to the new type (if copy=True, return a new copy)
        raise on an except if raise == True
        """
        errors_legal_values = ('raise', 'ignore')

        if errors not in errors_legal_values:
            invalid_arg = ("Expected value of kwarg 'errors' to be one of {}. "
                           "Supplied value is '{}'".format(
                               list(errors_legal_values), errors))
            raise ValueError(invalid_arg)

        # may need to convert to categorical
        # this is only called for non-categoricals
        if self.is_categorical_astype(dtype):
            return self.make_block(Categorical(self.values, **kwargs))

        # astype processing
        dtype = np.dtype(dtype)
        if self.dtype == dtype:
            if copy:
                return self.copy()
            return self

        if klass is None:
            if dtype == np.object_:
                klass = ObjectBlock
        try:
            # force the copy here
            if values is None:

                if issubclass(dtype.type,
                              (compat.text_type, compat.string_types)):

                    # use native type formatting for datetime/tz/timedelta
                    if self.is_datelike:
                        values = self.to_native_types()

                    # astype formatting
                    else:
                        values = self.values

                else:
                    values = self.get_values(dtype=dtype)

                # _astype_nansafe works fine with 1-d only
                values = astype_nansafe(values.ravel(), dtype, copy=True)
                values = values.reshape(self.shape)

            newb = make_block(values, placement=self.mgr_locs, dtype=dtype,
                              klass=klass)
        except:
            if errors == 'raise':
                raise
            newb = self.copy() if copy else self

        if newb.is_numeric and self.is_numeric:
            if newb.shape != self.shape:
                raise TypeError("cannot set astype for copy = [%s] for dtype "
                                "(%s [%s]) with smaller itemsize that current "
                                "(%s [%s])" % (copy, self.dtype.name,
                                               self.itemsize, newb.dtype.name,
                                               newb.itemsize))
        return newb

    def convert(self, copy=True, **kwargs):
        """ attempt to coerce any object types to better types return a copy
        of the block (if copy = True) by definition we are not an ObjectBlock
        here!
        """

        return self.copy() if copy else self

    def _can_hold_element(self, value):
        raise NotImplementedError()

    def _try_cast(self, value):
        raise NotImplementedError()

    def _try_cast_result(self, result, dtype=None):
        """ try to cast the result to our original type, we may have
        roundtripped thru object in the mean-time
        """
        if dtype is None:
            dtype = self.dtype

        if self.is_integer or self.is_bool or self.is_datetime:
            pass
        elif self.is_float and result.dtype == self.dtype:

            # protect against a bool/object showing up here
            if isinstance(dtype, compat.string_types) and dtype == 'infer':
                return result
            if not isinstance(dtype, type):
                dtype = dtype.type
            if issubclass(dtype, (np.bool_, np.object_)):
                if issubclass(dtype, np.bool_):
                    if isnull(result).all():
                        return result.astype(np.bool_)
                    else:
                        result = result.astype(np.object_)
                        result[result == 1] = True
                        result[result == 0] = False
                        return result
                else:
                    return result.astype(np.object_)

            return result

        # may need to change the dtype here
        return maybe_downcast_to_dtype(result, dtype)

    def _try_operate(self, values):
        """ return a version to operate on as the input """
        return values

    def _try_coerce_args(self, values, other):
        """ provide coercion to our input arguments """
        return values, False, other, False

    def _try_coerce_result(self, result):
        """ reverse of try_coerce_args """
        return result

    def _try_coerce_and_cast_result(self, result, dtype=None):
        result = self._try_coerce_result(result)
        result = self._try_cast_result(result, dtype=dtype)
        return result

    def _try_fill(self, value):
        return value

    def to_native_types(self, slicer=None, na_rep='nan', quoting=None,
                        **kwargs):
        """ convert to our native types format, slicing if desired """

        values = self.values
        if slicer is not None:
            values = values[:, slicer]
        mask = isnull(values)

        if not self.is_object and not quoting:
            values = values.astype(str)
        else:
            values = np.array(values, dtype='object')

        values[mask] = na_rep
        return values

    # block actions ####
    def copy(self, deep=True, mgr=None):
        """ copy constructor """
        values = self.values
        if deep:
            values = values.copy()
        return self.make_block_same_class(values)

    def replace(self, to_replace, value, inplace=False, filter=None,
                regex=False, convert=True, mgr=None):
        """ replace the to_replace value with value, possible to create new
        blocks here this is just a call to putmask. regex is not used here.
        It is used in ObjectBlocks.  It is here for API
        compatibility.
        """

        inplace = validate_bool_kwarg(inplace, 'inplace')
        original_to_replace = to_replace
        mask = isnull(self.values)
        # try to replace, if we raise an error, convert to ObjectBlock and
        # retry
        try:
            values, _, to_replace, _ = self._try_coerce_args(self.values,
                                                             to_replace)
            mask = missing.mask_missing(values, to_replace)
            if filter is not None:
                filtered_out = ~self.mgr_locs.isin(filter)
                mask[filtered_out.nonzero()[0]] = False

            blocks = self.putmask(mask, value, inplace=inplace)
            if convert:
                blocks = [b.convert(by_item=True, numeric=False,
                                    copy=not inplace) for b in blocks]
            return blocks
        except (TypeError, ValueError):

            # we can't process the value, but nothing to do
            if not mask.any():
                return self if inplace else self.copy()

            return self.to_object_block(mgr=mgr).replace(
                to_replace=original_to_replace, value=value, inplace=inplace,
                filter=filter, regex=regex, convert=convert)

    def _replace_single(self, *args, **kwargs):
        """ no-op on a non-ObjectBlock """
        return self if kwargs['inplace'] else self.copy()

    def setitem(self, indexer, value, mgr=None):
        """ set the value inplace; return a new block (of a possibly different
        dtype)

        indexer is a direct slice/positional indexer; value must be a
        compatible shape
        """

        # coerce None values, if appropriate
        if value is None:
            if self.is_numeric:
                value = np.nan

        # coerce args
        values, _, value, _ = self._try_coerce_args(self.values, value)
        arr_value = np.array(value)

        # cast the values to a type that can hold nan (if necessary)
        if not self._can_hold_element(value):
            dtype, _ = maybe_promote(arr_value.dtype)
            values = values.astype(dtype)

        transf = (lambda x: x.T) if self.ndim == 2 else (lambda x: x)
        values = transf(values)
        l = len(values)

        # length checking
        # boolean with truth values == len of the value is ok too
        if isinstance(indexer, (np.ndarray, list)):
            if is_list_like(value) and len(indexer) != len(value):
                if not (isinstance(indexer, np.ndarray) and
                        indexer.dtype == np.bool_ and
                        len(indexer[indexer]) == len(value)):
                    raise ValueError("cannot set using a list-like indexer "
                                     "with a different length than the value")

        # slice
        elif isinstance(indexer, slice):

            if is_list_like(value) and l:
                if len(value) != length_of_indexer(indexer, values):
                    raise ValueError("cannot set using a slice indexer with a "
                                     "different length than the value")

        try:

            def _is_scalar_indexer(indexer):
                # return True if we are all scalar indexers

                if arr_value.ndim == 1:
                    if not isinstance(indexer, tuple):
                        indexer = tuple([indexer])
                    return all([is_scalar(idx) for idx in indexer])
                return False

            def _is_empty_indexer(indexer):
                # return a boolean if we have an empty indexer

                if arr_value.ndim == 1:
                    if not isinstance(indexer, tuple):
                        indexer = tuple([indexer])
                    return any(isinstance(idx, np.ndarray) and len(idx) == 0
                               for idx in indexer)
                return False

            # empty indexers
            # 8669 (empty)
            if _is_empty_indexer(indexer):
                pass

            # setting a single element for each dim and with a rhs that could
            # be say a list
            # GH 6043
            elif _is_scalar_indexer(indexer):
                values[indexer] = value

            # if we are an exact match (ex-broadcasting),
            # then use the resultant dtype
            elif (len(arr_value.shape) and
                  arr_value.shape[0] == values.shape[0] and
                  np.prod(arr_value.shape) == np.prod(values.shape)):
                values[indexer] = value
                values = values.astype(arr_value.dtype)

            # set
            else:
                values[indexer] = value

            # coerce and try to infer the dtypes of the result
            if hasattr(value, 'dtype') and is_dtype_equal(values.dtype,
                                                          value.dtype):
                dtype = value.dtype
            elif is_scalar(value):
                dtype, _ = infer_dtype_from_scalar(value)
            else:
                dtype = 'infer'
            values = self._try_coerce_and_cast_result(values, dtype)
            block = self.make_block(transf(values), fastpath=True)

            # may have to soft convert_objects here
            if block.is_object and not self.is_object:
                block = block.convert(numeric=False)

            return block
        except ValueError:
            raise
        except TypeError:

            # cast to the passed dtype if possible
            # otherwise raise the original error
            try:
                # e.g. we are uint32 and our value is uint64
                # this is for compat with older numpies
                block = self.make_block(transf(values.astype(value.dtype)))
                return block.setitem(indexer=indexer, value=value, mgr=mgr)

            except:
                pass

            raise

        except Exception:
            pass

        return [self]

    def putmask(self, mask, new, align=True, inplace=False, axis=0,
                transpose=False, mgr=None):
        """ putmask the data to the block; it is possible that we may create a
        new dtype of block

        return the resulting block(s)

        Parameters
        ----------
        mask  : the condition to respect
        new : a ndarray/object
        align : boolean, perform alignment on other/cond, default is True
        inplace : perform inplace modification, default is False
        axis : int
        transpose : boolean
            Set to True if self is stored with axes reversed

        Returns
        -------
        a list of new blocks, the result of the putmask
        """

        new_values = self.values if inplace else self.values.copy()

        if hasattr(new, 'reindex_axis'):
            new = new.values

        if hasattr(mask, 'reindex_axis'):
            mask = mask.values

        # if we are passed a scalar None, convert it here
        if not is_list_like(new) and isnull(new) and not self.is_object:
            new = self.fill_value

        if self._can_hold_element(new):
            if transpose:
                new_values = new_values.T

            new = self._try_cast(new)

            # If the default repeat behavior in np.putmask would go in the
            # wrong direction, then explictly repeat and reshape new instead
            if getattr(new, 'ndim', 0) >= 1:
                if self.ndim - 1 == new.ndim and axis == 1:
                    new = np.repeat(
                        new, new_values.shape[-1]).reshape(self.shape)
                new = new.astype(new_values.dtype)

            np.putmask(new_values, mask, new)

        # maybe upcast me
        elif mask.any():
            if transpose:
                mask = mask.T
                if isinstance(new, np.ndarray):
                    new = new.T
                axis = new_values.ndim - axis - 1

            # Pseudo-broadcast
            if getattr(new, 'ndim', 0) >= 1:
                if self.ndim - 1 == new.ndim:
                    new_shape = list(new.shape)
                    new_shape.insert(axis, 1)
                    new = new.reshape(tuple(new_shape))

            # need to go column by column
            new_blocks = []
            if self.ndim > 1:
                for i, ref_loc in enumerate(self.mgr_locs):
                    m = mask[i]
                    v = new_values[i]

                    # need a new block
                    if m.any():
                        if isinstance(new, np.ndarray):
                            n = np.squeeze(new[i % new.shape[0]])
                        else:
                            n = np.array(new)

                        # type of the new block
                        dtype, _ = maybe_promote(n.dtype)

                        # we need to explicitly astype here to make a copy
                        n = n.astype(dtype)

                        nv = _putmask_smart(v, m, n)
                    else:
                        nv = v if inplace else v.copy()

                    # Put back the dimension that was taken from it and make
                    # a block out of the result.
                    block = self.make_block(values=nv[np.newaxis],
                                            placement=[ref_loc], fastpath=True)

                    new_blocks.append(block)

            else:
                nv = _putmask_smart(new_values, mask, new)
                new_blocks.append(self.make_block(values=nv, fastpath=True))

            return new_blocks

        if inplace:
            return [self]

        if transpose:
            new_values = new_values.T

        return [self.make_block(new_values, fastpath=True)]

    def interpolate(self, method='pad', axis=0, index=None, values=None,
                    inplace=False, limit=None, limit_direction='forward',
                    fill_value=None, coerce=False, downcast=None, mgr=None,
                    **kwargs):

        inplace = validate_bool_kwarg(inplace, 'inplace')

        def check_int_bool(self, inplace):
            # Only FloatBlocks will contain NaNs.
            # timedelta subclasses IntBlock
            if (self.is_bool or self.is_integer) and not self.is_timedelta:
                if inplace:
                    return self
                else:
                    return self.copy()

        # a fill na type method
        try:
            m = missing.clean_fill_method(method)
        except:
            m = None

        if m is not None:
            r = check_int_bool(self, inplace)
            if r is not None:
                return r
            return self._interpolate_with_fill(method=m, axis=axis,
                                               inplace=inplace, limit=limit,
                                               fill_value=fill_value,
                                               coerce=coerce,
                                               downcast=downcast, mgr=mgr)
        # try an interp method
        try:
            m = missing.clean_interp_method(method, **kwargs)
        except:
            m = None

        if m is not None:
            r = check_int_bool(self, inplace)
            if r is not None:
                return r
            return self._interpolate(method=m, index=index, values=values,
                                     axis=axis, limit=limit,
                                     limit_direction=limit_direction,
                                     fill_value=fill_value, inplace=inplace,
                                     downcast=downcast, mgr=mgr, **kwargs)

        raise ValueError("invalid method '{0}' to interpolate.".format(method))

    def _interpolate_with_fill(self, method='pad', axis=0, inplace=False,
                               limit=None, fill_value=None, coerce=False,
                               downcast=None, mgr=None):
        """ fillna but using the interpolate machinery """

        inplace = validate_bool_kwarg(inplace, 'inplace')

        # if we are coercing, then don't force the conversion
        # if the block can't hold the type
        if coerce:
            if not self._can_hold_na:
                if inplace:
                    return [self]
                else:
                    return [self.copy()]

        values = self.values if inplace else self.values.copy()
        values, _, fill_value, _ = self._try_coerce_args(values, fill_value)
        values = self._try_operate(values)
        values = missing.interpolate_2d(values, method=method, axis=axis,
                                        limit=limit, fill_value=fill_value,
                                        dtype=self.dtype)
        values = self._try_coerce_result(values)

        blocks = [self.make_block(values, klass=self.__class__, fastpath=True)]
        return self._maybe_downcast(blocks, downcast)

    def _interpolate(self, method=None, index=None, values=None,
                     fill_value=None, axis=0, limit=None,
                     limit_direction='forward', inplace=False, downcast=None,
                     mgr=None, **kwargs):
        """ interpolate using scipy wrappers """

        inplace = validate_bool_kwarg(inplace, 'inplace')
        data = self.values if inplace else self.values.copy()

        # only deal with floats
        if not self.is_float:
            if not self.is_integer:
                return self
            data = data.astype(np.float64)

        if fill_value is None:
            fill_value = self.fill_value

        if method in ('krogh', 'piecewise_polynomial', 'pchip'):
            if not index.is_monotonic:
                raise ValueError("{0} interpolation requires that the "
                                 "index be monotonic.".format(method))
        # process 1-d slices in the axis direction

        def func(x):

            # process a 1-d slice, returning it
            # should the axis argument be handled below in apply_along_axis?
            # i.e. not an arg to missing.interpolate_1d
            return missing.interpolate_1d(index, x, method=method, limit=limit,
                                          limit_direction=limit_direction,
                                          fill_value=fill_value,
                                          bounds_error=False, **kwargs)

        # interp each column independently
        interp_values = np.apply_along_axis(func, axis, data)

        blocks = [self.make_block(interp_values, klass=self.__class__,
                                  fastpath=True)]
        return self._maybe_downcast(blocks, downcast)

    def take_nd(self, indexer, axis, new_mgr_locs=None, fill_tuple=None):
        """
        Take values according to indexer and return them as a block.bb

        """

        # algos.take_nd dispatches for DatetimeTZBlock, CategoricalBlock
        # so need to preserve types
        # sparse is treated like an ndarray, but needs .get_values() shaping

        values = self.values
        if self.is_sparse:
            values = self.get_values()

        if fill_tuple is None:
            fill_value = self.fill_value
            new_values = algos.take_nd(values, indexer, axis=axis,
                                       allow_fill=False)
        else:
            fill_value = fill_tuple[0]
            new_values = algos.take_nd(values, indexer, axis=axis,
                                       allow_fill=True, fill_value=fill_value)

        if new_mgr_locs is None:
            if axis == 0:
                slc = lib.indexer_as_slice(indexer)
                if slc is not None:
                    new_mgr_locs = self.mgr_locs[slc]
                else:
                    new_mgr_locs = self.mgr_locs[indexer]
            else:
                new_mgr_locs = self.mgr_locs

        if not is_dtype_equal(new_values.dtype, self.dtype):
            return self.make_block(new_values, new_mgr_locs)
        else:
            return self.make_block_same_class(new_values, new_mgr_locs)

    def diff(self, n, axis=1, mgr=None):
        """ return block for the diff of the values """
        new_values = algos.diff(self.values, n, axis=axis)
        return [self.make_block(values=new_values, fastpath=True)]

    def shift(self, periods, axis=0, mgr=None):
        """ shift the block by periods, possibly upcast """

        # convert integer to float if necessary. need to do a lot more than
        # that, handle boolean etc also
        new_values, fill_value = maybe_upcast(self.values)

        # make sure array sent to np.roll is c_contiguous
        f_ordered = new_values.flags.f_contiguous
        if f_ordered:
            new_values = new_values.T
            axis = new_values.ndim - axis - 1

        if np.prod(new_values.shape):
            new_values = np.roll(new_values, _ensure_platform_int(periods),
                                 axis=axis)

        axis_indexer = [slice(None)] * self.ndim
        if periods > 0:
            axis_indexer[axis] = slice(None, periods)
        else:
            axis_indexer[axis] = slice(periods, None)
        new_values[tuple(axis_indexer)] = fill_value

        # restore original order
        if f_ordered:
            new_values = new_values.T

        return [self.make_block(new_values, fastpath=True)]

    def eval(self, func, other, raise_on_error=True, try_cast=False, mgr=None):
        """
        evaluate the block; return result block from the result

        Parameters
        ----------
        func  : how to combine self, other
        other : a ndarray/object
        raise_on_error : if True, raise when I can't perform the function,
            False by default (and just return the data that we had coming in)
        try_cast : try casting the results to the input type

        Returns
        -------
        a new block, the result of the func
        """
        values = self.values

        if hasattr(other, 'reindex_axis'):
            other = other.values

        # make sure that we can broadcast
        is_transposed = False
        if hasattr(other, 'ndim') and hasattr(values, 'ndim'):
            if values.ndim != other.ndim:
                is_transposed = True
            else:
                if values.shape == other.shape[::-1]:
                    is_transposed = True
                elif values.shape[0] == other.shape[-1]:
                    is_transposed = True
                else:
                    # this is a broadcast error heree
                    raise ValueError("cannot broadcast shape [%s] with block "
                                     "values [%s]" % (values.T.shape,
                                                      other.shape))

        transf = (lambda x: x.T) if is_transposed else (lambda x: x)

        # coerce/transpose the args if needed
        values, values_mask, other, other_mask = self._try_coerce_args(
            transf(values), other)

        # get the result, may need to transpose the other
        def get_result(other):

            # avoid numpy warning of comparisons again None
            if other is None:
                result = not func.__name__ == 'eq'

            # avoid numpy warning of elementwise comparisons to object
            elif is_numeric_v_string_like(values, other):
                result = False

            else:
                result = func(values, other)

            # mask if needed
            if isinstance(values_mask, np.ndarray) and values_mask.any():
                result = result.astype('float64', copy=False)
                result[values_mask] = np.nan
            if other_mask is True:
                result = result.astype('float64', copy=False)
                result[:] = np.nan
            elif isinstance(other_mask, np.ndarray) and other_mask.any():
                result = result.astype('float64', copy=False)
                result[other_mask.ravel()] = np.nan

            return self._try_coerce_result(result)

        # error handler if we have an issue operating with the function
        def handle_error():

            if raise_on_error:
                # The 'detail' variable is defined in outer scope.
                raise TypeError('Could not operate %s with block values %s' %
                                (repr(other), str(detail)))  # noqa
            else:
                # return the values
                result = np.empty(values.shape, dtype='O')
                result.fill(np.nan)
                return result

        # get the result
        try:
            with np.errstate(all='ignore'):
                result = get_result(other)

        # if we have an invalid shape/broadcast error
        # GH4576, so raise instead of allowing to pass through
        except ValueError as detail:
            raise
        except Exception as detail:
            result = handle_error()

        # technically a broadcast error in numpy can 'work' by returning a
        # boolean False
        if not isinstance(result, np.ndarray):
            if not isinstance(result, np.ndarray):

                # differentiate between an invalid ndarray-ndarray comparison
                # and an invalid type comparison
                if isinstance(values, np.ndarray) and is_list_like(other):
                    raise ValueError('Invalid broadcasting comparison [%s] '
                                     'with block values' % repr(other))

                raise TypeError('Could not compare [%s] with block values' %
                                repr(other))

        # transpose if needed
        result = transf(result)

        # try to cast if requested
        if try_cast:
            result = self._try_cast_result(result)

        return [self.make_block(result, fastpath=True, )]

    def where(self, other, cond, align=True, raise_on_error=True,
              try_cast=False, axis=0, transpose=False, mgr=None):
        """
        evaluate the block; return result block(s) from the result

        Parameters
        ----------
        other : a ndarray/object
        cond  : the condition to respect
        align : boolean, perform alignment on other/cond
        raise_on_error : if True, raise when I can't perform the function,
            False by default (and just return the data that we had coming in)
        axis : int
        transpose : boolean
            Set to True if self is stored with axes reversed

        Returns
        -------
        a new block(s), the result of the func
        """

        values = self.values
        if transpose:
            values = values.T

        if hasattr(other, 'reindex_axis'):
            other = other.values

        if hasattr(cond, 'reindex_axis'):
            cond = cond.values

        # If the default broadcasting would go in the wrong direction, then
        # explictly reshape other instead
        if getattr(other, 'ndim', 0) >= 1:
            if values.ndim - 1 == other.ndim and axis == 1:
                other = other.reshape(tuple(other.shape + (1, )))

        if not hasattr(cond, 'shape'):
            raise ValueError("where must have a condition that is ndarray "
                             "like")

        other = maybe_convert_string_to_object(other)
        other = maybe_convert_scalar(other)

        # our where function
        def func(cond, values, other):
            if cond.ravel().all():
                return values

            values, values_mask, other, other_mask = self._try_coerce_args(
                values, other)
            try:
                return self._try_coerce_result(expressions.where(
                    cond, values, other, raise_on_error=True))
            except Exception as detail:
                if raise_on_error:
                    raise TypeError('Could not operate [%s] with block values '
                                    '[%s]' % (repr(other), str(detail)))
                else:
                    # return the values
                    result = np.empty(values.shape, dtype='float64')
                    result.fill(np.nan)
                    return result

        # see if we can operate on the entire block, or need item-by-item
        # or if we are a single block (ndim == 1)
        result = func(cond, values, other)
        if self._can_hold_na or self.ndim == 1:

            if transpose:
                result = result.T

            # try to cast if requested
            if try_cast:
                result = self._try_cast_result(result)

            return self.make_block(result)

        # might need to separate out blocks
        axis = cond.ndim - 1
        cond = cond.swapaxes(axis, 0)
        mask = np.array([cond[i].all() for i in range(cond.shape[0])],
                        dtype=bool)

        result_blocks = []
        for m in [mask, ~mask]:
            if m.any():
                r = self._try_cast_result(result.take(m.nonzero()[0],
                                                      axis=axis))
                result_blocks.append(
                    self.make_block(r.T, placement=self.mgr_locs[m]))

        return result_blocks

    def equals(self, other):
        if self.dtype != other.dtype or self.shape != other.shape:
            return False
        return array_equivalent(self.values, other.values)

    def quantile(self, qs, interpolation='linear', axis=0, mgr=None):
        """
        compute the quantiles of the

        Parameters
        ----------
        qs: a scalar or list of the quantiles to be computed
        interpolation: type of interpolation, default 'linear'
        axis: axis to compute, default 0

        Returns
        -------
        tuple of (axis, block)

        """
        if _np_version_under1p9:
            if interpolation != 'linear':
                raise ValueError("Interpolation methods other than linear "
                                 "are not supported in numpy < 1.9.")

        kw = {}
        if not _np_version_under1p9:
            kw.update({'interpolation': interpolation})

        values = self.get_values()
        values, _, _, _ = self._try_coerce_args(values, values)

        def _nanpercentile1D(values, mask, q, **kw):
            values = values[~mask]

            if len(values) == 0:
                if is_scalar(q):
                    return self._na_value
                else:
                    return np.array([self._na_value] * len(q),
                                    dtype=values.dtype)

            return np.percentile(values, q, **kw)

        def _nanpercentile(values, q, axis, **kw):

            mask = isnull(self.values)
            if not is_scalar(mask) and mask.any():
                if self.ndim == 1:
                    return _nanpercentile1D(values, mask, q, **kw)
                else:
                    # for nonconsolidatable blocks mask is 1D, but values 2D
                    if mask.ndim < values.ndim:
                        mask = mask.reshape(values.shape)
                    if axis == 0:
                        values = values.T
                        mask = mask.T
                    result = [_nanpercentile1D(val, m, q, **kw) for (val, m)
                              in zip(list(values), list(mask))]
                    result = np.array(result, dtype=values.dtype, copy=False).T
                    return result
            else:
                return np.percentile(values, q, axis=axis, **kw)

        from pandas import Float64Index
        is_empty = values.shape[axis] == 0
        if is_list_like(qs):
            ax = Float64Index(qs)

            if is_empty:
                if self.ndim == 1:
                    result = self._na_value
                else:
                    # create the array of na_values
                    # 2d len(values) * len(qs)
                    result = np.repeat(np.array([self._na_value] * len(qs)),
                                       len(values)).reshape(len(values),
                                                            len(qs))
            else:

                try:
                    result = _nanpercentile(values, np.array(qs) * 100,
                                            axis=axis, **kw)
                except ValueError:

                    # older numpies don't handle an array for q
                    result = [_nanpercentile(values, q * 100,
                                             axis=axis, **kw) for q in qs]

                result = np.array(result, copy=False)
                if self.ndim > 1:
                    result = result.T

        else:

            if self.ndim == 1:
                ax = Float64Index([qs])
            else:
                ax = mgr.axes[0]

            if is_empty:
                if self.ndim == 1:
                    result = self._na_value
                else:
                    result = np.array([self._na_value] * len(self))
            else:
                result = _nanpercentile(values, qs * 100, axis=axis, **kw)

        ndim = getattr(result, 'ndim', None) or 0
        result = self._try_coerce_result(result)
        if is_scalar(result):
            return ax, self.make_block_scalar(result)
        return ax, make_block(result,
                              placement=np.arange(len(result)),
                              ndim=ndim)


class ScalarBlock(Block):
    """
    a scalar compat Block
    """
    __slots__ = ['_mgr_locs', 'values', 'ndim']

    def __init__(self, values):
        self.ndim = 0
        self.mgr_locs = [0]
        self.values = values

    @property
    def dtype(self):
        return type(self.values)

    @property
    def shape(self):
        return tuple([0])

    def __len__(self):
        return 0


class NonConsolidatableMixIn(object):
    """ hold methods for the nonconsolidatable blocks """
    _can_consolidate = False
    _verify_integrity = False
    _validate_ndim = False
    _holder = None

    def __init__(self, values, placement, ndim=None, fastpath=False, **kwargs):

        # Placement must be converted to BlockPlacement via property setter
        # before ndim logic, because placement may be a slice which doesn't
        # have a length.
        self.mgr_locs = placement

        # kludgetastic
        if ndim is None:
            if len(self.mgr_locs) != 1:
                ndim = 1
            else:
                ndim = 2
        self.ndim = ndim

        if not isinstance(values, self._holder):
            raise TypeError("values must be {0}".format(self._holder.__name__))

        self.values = values

    @property
    def shape(self):
        if self.ndim == 1:
            return (len(self.values)),
        return (len(self.mgr_locs), len(self.values))

    def get_values(self, dtype=None):
        """ need to to_dense myself (and always return a ndim sized object) """
        values = self.values.to_dense()
        if values.ndim == self.ndim - 1:
            values = values.reshape((1,) + values.shape)
        return values

    def iget(self, col):

        if self.ndim == 2 and isinstance(col, tuple):
            col, loc = col
            if not is_null_slice(col) and col != 0:
                raise IndexError("{0} only contains one item".format(self))
            return self.values[loc]
        else:
            if col != 0:
                raise IndexError("{0} only contains one item".format(self))
            return self.values

    def should_store(self, value):
        return isinstance(value, self._holder)

    def set(self, locs, values, check=False):
        assert locs.tolist() == [0]
        self.values = values

    def get(self, item):
        if self.ndim == 1:
            loc = self.items.get_loc(item)
            return self.values[loc]
        else:
            return self.values

    def putmask(self, mask, new, align=True, inplace=False, axis=0,
                transpose=False, mgr=None):
        """
        putmask the data to the block; we must be a single block and not
        generate other blocks

        return the resulting block

        Parameters
        ----------
        mask  : the condition to respect
        new : a ndarray/object
        align : boolean, perform alignment on other/cond, default is True
        inplace : perform inplace modification, default is False

        Returns
        -------
        a new block(s), the result of the putmask
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')

        # use block's copy logic.
        # .values may be an Index which does shallow copy by default
        new_values = self.values if inplace else self.copy().values
        new_values, _, new, _ = self._try_coerce_args(new_values, new)

        if isinstance(new, np.ndarray) and len(new) == len(mask):
            new = new[mask]

        mask = _safe_reshape(mask, new_values.shape)
        new_values[mask] = new
        new_values = self._try_coerce_result(new_values)
        return [self.make_block(values=new_values)]

    def _slice(self, slicer):
        """ return a slice of my values (but densify first) """
        return self.get_values()[slicer]

    def _try_cast_result(self, result, dtype=None):
        return result


class NumericBlock(Block):
    __slots__ = ()
    is_numeric = True
    _can_hold_na = True


class FloatOrComplexBlock(NumericBlock):
    __slots__ = ()

    def equals(self, other):
        if self.dtype != other.dtype or self.shape != other.shape:
            return False
        left, right = self.values, other.values
        return ((left == right) | (np.isnan(left) & np.isnan(right))).all()


class FloatBlock(FloatOrComplexBlock):
    __slots__ = ()
    is_float = True
    _downcast_dtype = 'int64'

    def _can_hold_element(self, element):
        if is_list_like(element):
            element = np.array(element)
            tipo = element.dtype.type
            return (issubclass(tipo, (np.floating, np.integer)) and
                    not issubclass(tipo, (np.datetime64, np.timedelta64)))
        return (isinstance(element, (float, int, np.float_, np.int_)) and
                not isinstance(element, (bool, np.bool_, datetime, timedelta,
                                         np.datetime64, np.timedelta64)))

    def _try_cast(self, element):
        try:
            return float(element)
        except:  # pragma: no cover
            return element

    def to_native_types(self, slicer=None, na_rep='', float_format=None,
                        decimal='.', quoting=None, **kwargs):
        """ convert to our native types format, slicing if desired """

        values = self.values
        if slicer is not None:
            values = values[:, slicer]

        # see gh-13418: no special formatting is desired at the
        # output (important for appropriate 'quoting' behaviour),
        # so do not pass it through the FloatArrayFormatter
        if float_format is None and decimal == '.':
            mask = isnull(values)

            if not quoting:
                values = values.astype(str)
            else:
                values = np.array(values, dtype='object')

            values[mask] = na_rep
            return values

        from pandas.io.formats.format import FloatArrayFormatter
        formatter = FloatArrayFormatter(values, na_rep=na_rep,
                                        float_format=float_format,
                                        decimal=decimal, quoting=quoting,
                                        fixed_width=False)
        return formatter.get_result_as_array()

    def should_store(self, value):
        # when inserting a column should not coerce integers to floats
        # unnecessarily
        return (issubclass(value.dtype.type, np.floating) and
                value.dtype == self.dtype)


class ComplexBlock(FloatOrComplexBlock):
    __slots__ = ()
    is_complex = True

    def _can_hold_element(self, element):
        if is_list_like(element):
            element = np.array(element)
            return issubclass(element.dtype.type,
                              (np.floating, np.integer, np.complexfloating))
        return (isinstance(element,
                           (float, int, complex, np.float_, np.int_)) and
                not isinstance(bool, np.bool_))

    def _try_cast(self, element):
        try:
            return complex(element)
        except:  # pragma: no cover
            return element

    def should_store(self, value):
        return issubclass(value.dtype.type, np.complexfloating)


class IntBlock(NumericBlock):
    __slots__ = ()
    is_integer = True
    _can_hold_na = False

    def _can_hold_element(self, element):
        if is_list_like(element):
            element = np.array(element)
            tipo = element.dtype.type
            return (issubclass(tipo, np.integer) and
                    not issubclass(tipo, (np.datetime64, np.timedelta64)))
        return is_integer(element)

    def _try_cast(self, element):
        try:
            return int(element)
        except:  # pragma: no cover
            return element

    def should_store(self, value):
        return is_integer_dtype(value) and value.dtype == self.dtype


class DatetimeLikeBlockMixin(object):

    @property
    def _na_value(self):
        return tslib.NaT

    @property
    def fill_value(self):
        return tslib.iNaT

    def _try_operate(self, values):
        """ return a version to operate on """
        return values.view('i8')

    def get_values(self, dtype=None):
        """
        return object dtype as boxed values, such as Timestamps/Timedelta
        """
        if is_object_dtype(dtype):
            return lib.map_infer(self.values.ravel(),
                                 self._box_func).reshape(self.values.shape)
        return self.values


class TimeDeltaBlock(DatetimeLikeBlockMixin, IntBlock):
    __slots__ = ()
    is_timedelta = True
    _can_hold_na = True
    is_numeric = False

    @property
    def _box_func(self):
        return lambda x: tslib.Timedelta(x, unit='ns')

    def fillna(self, value, **kwargs):

        # allow filling with integers to be
        # interpreted as seconds
        if not isinstance(value, np.timedelta64) and is_integer(value):
            value = Timedelta(value, unit='s')
        return super(TimeDeltaBlock, self).fillna(value, **kwargs)

    def _try_coerce_args(self, values, other):
        """
        Coerce values and other to int64, with null values converted to
        iNaT. values is always ndarray-like, other may not be

        Parameters
        ----------
        values : ndarray-like
        other : ndarray-like or scalar

        Returns
        -------
        base-type values, values mask, base-type other, other mask
        """

        values_mask = isnull(values)
        values = values.view('i8')
        other_mask = False

        if isinstance(other, bool):
            raise TypeError
        elif is_null_datelike_scalar(other):
            other = tslib.iNaT
            other_mask = True
        elif isinstance(other, Timedelta):
            other_mask = isnull(other)
            other = other.value
        elif isinstance(other, np.timedelta64):
            other_mask = isnull(other)
            other = Timedelta(other).value
        elif isinstance(other, timedelta):
            other = Timedelta(other).value
        elif isinstance(other, np.ndarray):
            other_mask = isnull(other)
            other = other.astype('i8', copy=False).view('i8')
        else:
            # scalar
            other = Timedelta(other)
            other_mask = isnull(other)
            other = other.value

        return values, values_mask, other, other_mask

    def _try_coerce_result(self, result):
        """ reverse of try_coerce_args / try_operate """
        if isinstance(result, np.ndarray):
            mask = isnull(result)
            if result.dtype.kind in ['i', 'f', 'O']:
                result = result.astype('m8[ns]')
            result[mask] = tslib.iNaT
        elif isinstance(result, (np.integer, np.float)):
            result = self._box_func(result)
        return result

    def should_store(self, value):
        return issubclass(value.dtype.type, np.timedelta64)

    def to_native_types(self, slicer=None, na_rep=None, quoting=None,
                        **kwargs):
        """ convert to our native types format, slicing if desired """

        values = self.values
        if slicer is not None:
            values = values[:, slicer]
        mask = isnull(values)

        rvalues = np.empty(values.shape, dtype=object)
        if na_rep is None:
            na_rep = 'NaT'
        rvalues[mask] = na_rep
        imask = (~mask).ravel()

        # FIXME:
        # should use the formats.format.Timedelta64Formatter here
        # to figure what format to pass to the Timedelta
        # e.g. to not show the decimals say
        rvalues.flat[imask] = np.array([Timedelta(val)._repr_base(format='all')
                                        for val in values.ravel()[imask]],
                                       dtype=object)
        return rvalues


class BoolBlock(NumericBlock):
    __slots__ = ()
    is_bool = True
    _can_hold_na = False

    def _can_hold_element(self, element):
        if is_list_like(element):
            element = np.array(element)
            return issubclass(element.dtype.type, np.integer)
        return isinstance(element, (int, bool))

    def _try_cast(self, element):
        try:
            return bool(element)
        except:  # pragma: no cover
            return element

    def should_store(self, value):
        return issubclass(value.dtype.type, np.bool_)

    def replace(self, to_replace, value, inplace=False, filter=None,
                regex=False, convert=True, mgr=None):
        inplace = validate_bool_kwarg(inplace, 'inplace')
        to_replace_values = np.atleast_1d(to_replace)
        if not np.can_cast(to_replace_values, bool):
            return self
        return super(BoolBlock, self).replace(to_replace, value,
                                              inplace=inplace, filter=filter,
                                              regex=regex, convert=convert,
                                              mgr=mgr)


class ObjectBlock(Block):
    __slots__ = ()
    is_object = True
    _can_hold_na = True

    def __init__(self, values, ndim=2, fastpath=False, placement=None,
                 **kwargs):
        if issubclass(values.dtype.type, compat.string_types):
            values = np.array(values, dtype=object)

        super(ObjectBlock, self).__init__(values, ndim=ndim, fastpath=fastpath,
                                          placement=placement, **kwargs)

    @property
    def is_bool(self):
        """ we can be a bool if we have only bool values but are of type
        object
        """
        return lib.is_bool_array(self.values.ravel())

    # TODO: Refactor when convert_objects is removed since there will be 1 path
    def convert(self, *args, **kwargs):
        """ attempt to coerce any object types to better types return a copy of
        the block (if copy = True) by definition we ARE an ObjectBlock!!!!!

        can return multiple blocks!
        """

        if args:
            raise NotImplementedError
        by_item = True if 'by_item' not in kwargs else kwargs['by_item']

        new_inputs = ['coerce', 'datetime', 'numeric', 'timedelta']
        new_style = False
        for kw in new_inputs:
            new_style |= kw in kwargs

        if new_style:
            fn = soft_convert_objects
            fn_inputs = new_inputs
        else:
            fn = maybe_convert_objects
            fn_inputs = ['convert_dates', 'convert_numeric',
                         'convert_timedeltas']
        fn_inputs += ['copy']

        fn_kwargs = {}
        for key in fn_inputs:
            if key in kwargs:
                fn_kwargs[key] = kwargs[key]

        # attempt to create new type blocks
        blocks = []
        if by_item and not self._is_single_block:

            for i, rl in enumerate(self.mgr_locs):
                values = self.iget(i)

                shape = values.shape
                values = fn(values.ravel(), **fn_kwargs)
                try:
                    values = values.reshape(shape)
                    values = _block_shape(values, ndim=self.ndim)
                except (AttributeError, NotImplementedError):
                    pass
                newb = make_block(values, ndim=self.ndim, placement=[rl])
                blocks.append(newb)

        else:
            values = fn(self.values.ravel(), **fn_kwargs)
            try:
                values = values.reshape(self.values.shape)
            except NotImplementedError:
                pass
            blocks.append(make_block(values, ndim=self.ndim,
                                     placement=self.mgr_locs))

        return blocks

    def set(self, locs, values, check=False):
        """
        Modify Block in-place with new item value

        Returns
        -------
        None
        """

        # GH6026
        if check:
            try:
                if (self.values[locs] == values).all():
                    return
            except:
                pass
        try:
            self.values[locs] = values
        except (ValueError):

            # broadcasting error
            # see GH6171
            new_shape = list(values.shape)
            new_shape[0] = len(self.items)
            self.values = np.empty(tuple(new_shape), dtype=self.dtype)
            self.values.fill(np.nan)
            self.values[locs] = values

    def _maybe_downcast(self, blocks, downcast=None):

        if downcast is not None:
            return blocks

        # split and convert the blocks
        return _extend_blocks([b.convert(datetime=True, numeric=False)
                               for b in blocks])

    def _can_hold_element(self, element):
        return True

    def _try_cast(self, element):
        return element

    def should_store(self, value):
        return not (issubclass(value.dtype.type,
                               (np.integer, np.floating, np.complexfloating,
                                np.datetime64, np.bool_)) or
                    is_extension_type(value))

    def replace(self, to_replace, value, inplace=False, filter=None,
                regex=False, convert=True, mgr=None):
        to_rep_is_list = is_list_like(to_replace)
        value_is_list = is_list_like(value)
        both_lists = to_rep_is_list and value_is_list
        either_list = to_rep_is_list or value_is_list

        result_blocks = []
        blocks = [self]

        if not either_list and is_re(to_replace):
            return self._replace_single(to_replace, value, inplace=inplace,
                                        filter=filter, regex=True,
                                        convert=convert, mgr=mgr)
        elif not (either_list or regex):
            return super(ObjectBlock, self).replace(to_replace, value,
                                                    inplace=inplace,
                                                    filter=filter, regex=regex,
                                                    convert=convert, mgr=mgr)
        elif both_lists:
            for to_rep, v in zip(to_replace, value):
                result_blocks = []
                for b in blocks:
                    result = b._replace_single(to_rep, v, inplace=inplace,
                                               filter=filter, regex=regex,
                                               convert=convert, mgr=mgr)
                    result_blocks = _extend_blocks(result, result_blocks)
                blocks = result_blocks
            return result_blocks

        elif to_rep_is_list and regex:
            for to_rep in to_replace:
                result_blocks = []
                for b in blocks:
                    result = b._replace_single(to_rep, value, inplace=inplace,
                                               filter=filter, regex=regex,
                                               convert=convert, mgr=mgr)
                    result_blocks = _extend_blocks(result, result_blocks)
                blocks = result_blocks
            return result_blocks

        return self._replace_single(to_replace, value, inplace=inplace,
                                    filter=filter, convert=convert,
                                    regex=regex, mgr=mgr)

    def _replace_single(self, to_replace, value, inplace=False, filter=None,
                        regex=False, convert=True, mgr=None):

        inplace = validate_bool_kwarg(inplace, 'inplace')

        # to_replace is regex compilable
        to_rep_re = regex and is_re_compilable(to_replace)

        # regex is regex compilable
        regex_re = is_re_compilable(regex)

        # only one will survive
        if to_rep_re and regex_re:
            raise AssertionError('only one of to_replace and regex can be '
                                 'regex compilable')

        # if regex was passed as something that can be a regex (rather than a
        # boolean)
        if regex_re:
            to_replace = regex

        regex = regex_re or to_rep_re

        # try to get the pattern attribute (compiled re) or it's a string
        try:
            pattern = to_replace.pattern
        except AttributeError:
            pattern = to_replace

        # if the pattern is not empty and to_replace is either a string or a
        # regex
        if regex and pattern:
            rx = re.compile(to_replace)
        else:
            # if the thing to replace is not a string or compiled regex call
            # the superclass method -> to_replace is some kind of object
            return super(ObjectBlock, self).replace(to_replace, value,
                                                    inplace=inplace,
                                                    filter=filter, regex=regex,
                                                    mgr=mgr)

        new_values = self.values if inplace else self.values.copy()

        # deal with replacing values with objects (strings) that match but
        # whose replacement is not a string (numeric, nan, object)
        if isnull(value) or not isinstance(value, compat.string_types):

            def re_replacer(s):
                try:
                    return value if rx.search(s) is not None else s
                except TypeError:
                    return s
        else:
            # value is guaranteed to be a string here, s can be either a string
            # or null if it's null it gets returned
            def re_replacer(s):
                try:
                    return rx.sub(value, s)
                except TypeError:
                    return s

        f = np.vectorize(re_replacer, otypes=[self.dtype])

        if filter is None:
            filt = slice(None)
        else:
            filt = self.mgr_locs.isin(filter).nonzero()[0]

        new_values[filt] = f(new_values[filt])

        # convert
        block = self.make_block(new_values)
        if convert:
            block = block.convert(by_item=True, numeric=False)

        return block


class CategoricalBlock(NonConsolidatableMixIn, ObjectBlock):
    __slots__ = ()
    is_categorical = True
    _verify_integrity = True
    _can_hold_na = True
    _holder = Categorical

    def __init__(self, values, placement, fastpath=False, **kwargs):

        # coerce to categorical if we can
        super(CategoricalBlock, self).__init__(maybe_to_categorical(values),
                                               fastpath=True,
                                               placement=placement, **kwargs)

    @property
    def is_view(self):
        """ I am never a view """
        return False

    def to_dense(self):
        return self.values.to_dense().view()

    def convert(self, copy=True, **kwargs):
        return self.copy() if copy else self

    @property
    def array_dtype(self):
        """ the dtype to return if I want to construct this block as an
        array
        """
        return np.object_

    def _slice(self, slicer):
        """ return a slice of my values """

        # slice the category
        # return same dims as we currently have
        return self.values._slice(slicer)

    def _try_coerce_result(self, result):
        """ reverse of try_coerce_args """

        # GH12564: CategoricalBlock is 1-dim only
        # while returned results could be any dim
        if ((not is_categorical_dtype(result)) and
                isinstance(result, np.ndarray)):
            result = _block_shape(result, ndim=self.ndim)

        return result

    def fillna(self, value, limit=None, inplace=False, downcast=None,
               mgr=None):
        # we may need to upcast our fill to match our dtype
        if limit is not None:
            raise NotImplementedError("specifying a limit for 'fillna' has "
                                      "not been implemented yet")

        values = self.values if inplace else self.values.copy()
        values = self._try_coerce_result(values.fillna(value=value,
                                                       limit=limit))
        return [self.make_block(values=values)]

    def interpolate(self, method='pad', axis=0, inplace=False, limit=None,
                    fill_value=None, **kwargs):

        values = self.values if inplace else self.values.copy()
        return self.make_block_same_class(
            values=values.fillna(fill_value=fill_value, method=method,
                                 limit=limit),
            placement=self.mgr_locs)

    def shift(self, periods, axis=0, mgr=None):
        return self.make_block_same_class(values=self.values.shift(periods),
                                          placement=self.mgr_locs)

    def take_nd(self, indexer, axis=0, new_mgr_locs=None, fill_tuple=None):
        """
        Take values according to indexer and return them as a block.bb
        """
        if fill_tuple is None:
            fill_value = None
        else:
            fill_value = fill_tuple[0]

        # axis doesn't matter; we are really a single-dim object
        # but are passed the axis depending on the calling routing
        # if its REALLY axis 0, then this will be a reindex and not a take
        new_values = self.values.take_nd(indexer, fill_value=fill_value)

        # if we are a 1-dim object, then always place at 0
        if self.ndim == 1:
            new_mgr_locs = [0]
        else:
            if new_mgr_locs is None:
                new_mgr_locs = self.mgr_locs

        return self.make_block_same_class(new_values, new_mgr_locs)

    def _astype(self, dtype, copy=False, errors='raise', values=None,
                klass=None, mgr=None):
        """
        Coerce to the new type (if copy=True, return a new copy)
        raise on an except if raise == True
        """

        if self.is_categorical_astype(dtype):
            values = self.values
        else:
            values = np.asarray(self.values).astype(dtype, copy=False)

        if copy:
            values = values.copy()

        return self.make_block(values)

    def to_native_types(self, slicer=None, na_rep='', quoting=None, **kwargs):
        """ convert to our native types format, slicing if desired """

        values = self.values
        if slicer is not None:
            # Categorical is always one dimension
            values = values[slicer]
        mask = isnull(values)
        values = np.array(values, dtype='object')
        values[mask] = na_rep

        # we are expected to return a 2-d ndarray
        return values.reshape(1, len(values))


class DatetimeBlock(DatetimeLikeBlockMixin, Block):
    __slots__ = ()
    is_datetime = True
    _can_hold_na = True

    def __init__(self, values, placement, fastpath=False, **kwargs):
        if values.dtype != _NS_DTYPE:
            values = tslib.cast_to_nanoseconds(values)

        super(DatetimeBlock, self).__init__(values, fastpath=True,
                                            placement=placement, **kwargs)

    def _astype(self, dtype, mgr=None, **kwargs):
        """
        these automatically copy, so copy=True has no effect
        raise on an except if raise == True
        """

        # if we are passed a datetime64[ns, tz]
        if is_datetime64tz_dtype(dtype):
            dtype = DatetimeTZDtype(dtype)

            values = self.values
            if getattr(values, 'tz', None) is None:
                values = DatetimeIndex(values).tz_localize('UTC')
            values = values.tz_convert(dtype.tz)
            return self.make_block(values)

        # delegate
        return super(DatetimeBlock, self)._astype(dtype=dtype, **kwargs)

    def _can_hold_element(self, element):
        if is_list_like(element):
            element = np.array(element)
            return element.dtype == _NS_DTYPE or element.dtype == np.int64
        return (is_integer(element) or isinstance(element, datetime) or
                isnull(element))

    def _try_cast(self, element):
        try:
            return int(element)
        except:
            return element

    def _try_coerce_args(self, values, other):
        """
        Coerce values and other to dtype 'i8'. NaN and NaT convert to
        the smallest i8, and will correctly round-trip to NaT if converted
        back in _try_coerce_result. values is always ndarray-like, other
        may not be

        Parameters
        ----------
        values : ndarray-like
        other : ndarray-like or scalar

        Returns
        -------
        base-type values, values mask, base-type other, other mask
        """

        values_mask = isnull(values)
        values = values.view('i8')
        other_mask = False

        if isinstance(other, bool):
            raise TypeError
        elif is_null_datelike_scalar(other):
            other = tslib.iNaT
            other_mask = True
        elif isinstance(other, (datetime, np.datetime64, date)):
            other = self._box_func(other)
            if getattr(other, 'tz') is not None:
                raise TypeError("cannot coerce a Timestamp with a tz on a "
                                "naive Block")
            other_mask = isnull(other)
            other = other.asm8.view('i8')
        elif hasattr(other, 'dtype') and is_integer_dtype(other):
            other = other.view('i8')
        else:
            try:
                other = np.asarray(other)
                other_mask = isnull(other)

                other = other.astype('i8', copy=False).view('i8')
            except ValueError:

                # coercion issues
                # let higher levels handle
                raise TypeError

        return values, values_mask, other, other_mask

    def _try_coerce_result(self, result):
        """ reverse of try_coerce_args """
        if isinstance(result, np.ndarray):
            if result.dtype.kind in ['i', 'f', 'O']:
                try:
                    result = result.astype('M8[ns]')
                except ValueError:
                    pass
        elif isinstance(result, (np.integer, np.float, np.datetime64)):
            result = self._box_func(result)
        return result

    @property
    def _box_func(self):
        return tslib.Timestamp

    def to_native_types(self, slicer=None, na_rep=None, date_format=None,
                        quoting=None, **kwargs):
        """ convert to our native types format, slicing if desired """

        values = self.values
        if slicer is not None:
            values = values[..., slicer]

        from pandas.io.formats.format import _get_format_datetime64_from_values
        format = _get_format_datetime64_from_values(values, date_format)

        result = tslib.format_array_from_datetime(
            values.view('i8').ravel(), tz=getattr(self.values, 'tz', None),
            format=format, na_rep=na_rep).reshape(values.shape)
        return np.atleast_2d(result)

    def should_store(self, value):
        return (issubclass(value.dtype.type, np.datetime64) and
                not is_datetimetz(value))

    def set(self, locs, values, check=False):
        """
        Modify Block in-place with new item value

        Returns
        -------
        None
        """
        if values.dtype != _NS_DTYPE:
            # Workaround for numpy 1.6 bug
            values = tslib.cast_to_nanoseconds(values)

        self.values[locs] = values


class DatetimeTZBlock(NonConsolidatableMixIn, DatetimeBlock):
    """ implement a datetime64 block with a tz attribute """
    __slots__ = ()
    _holder = DatetimeIndex
    is_datetimetz = True

    def __init__(self, values, placement, ndim=2, **kwargs):

        if not isinstance(values, self._holder):
            values = self._holder(values)

        dtype = kwargs.pop('dtype', None)

        if dtype is not None:
            if isinstance(dtype, compat.string_types):
                dtype = DatetimeTZDtype.construct_from_string(dtype)
            values = values._shallow_copy(tz=dtype.tz)

        if values.tz is None:
            raise ValueError("cannot create a DatetimeTZBlock without a tz")

        super(DatetimeTZBlock, self).__init__(values, placement=placement,
                                              ndim=ndim, **kwargs)

    def copy(self, deep=True, mgr=None):
        """ copy constructor """
        values = self.values
        if deep:
            values = values.copy(deep=True)
        return self.make_block_same_class(values)

    def external_values(self):
        """ we internally represent the data as a DatetimeIndex, but for
        external compat with ndarray, export as a ndarray of Timestamps
        """
        return self.values.astype('datetime64[ns]').values

    def get_values(self, dtype=None):
        # return object dtype as Timestamps with the zones
        if is_object_dtype(dtype):
            f = lambda x: lib.Timestamp(x, tz=self.values.tz)
            return lib.map_infer(
                self.values.ravel(), f).reshape(self.values.shape)
        return self.values

    def to_object_block(self, mgr):
        """
        return myself as an object block

        Since we keep the DTI as a 1-d object, this is different
        depends on BlockManager's ndim
        """
        values = self.get_values(dtype=object)
        kwargs = {}
        if mgr.ndim > 1:
            values = _block_shape(values, ndim=mgr.ndim)
            kwargs['ndim'] = mgr.ndim
            kwargs['placement'] = [0]
        return self.make_block(values, klass=ObjectBlock, **kwargs)

    def _slice(self, slicer):
        """ return a slice of my values """
        if isinstance(slicer, tuple):
            col, loc = slicer
            if not is_null_slice(col) and col != 0:
                raise IndexError("{0} only contains one item".format(self))
            return self.values[loc]
        return self.values[slicer]

    def _try_coerce_args(self, values, other):
        """
        localize and return i8 for the values

        Parameters
        ----------
        values : ndarray-like
        other : ndarray-like or scalar

        Returns
        -------
        base-type values, values mask, base-type other, other mask
        """
        values_mask = _block_shape(isnull(values), ndim=self.ndim)
        # asi8 is a view, needs copy
        values = _block_shape(values.asi8, ndim=self.ndim)
        other_mask = False

        if isinstance(other, ABCSeries):
            other = self._holder(other)
            other_mask = isnull(other)

        if isinstance(other, bool):
            raise TypeError
        elif (is_null_datelike_scalar(other) or
              (is_scalar(other) and isnull(other))):
            other = tslib.iNaT
            other_mask = True
        elif isinstance(other, self._holder):
            if other.tz != self.values.tz:
                raise ValueError("incompatible or non tz-aware value")
            other = other.asi8
            other_mask = isnull(other)
        elif isinstance(other, (np.datetime64, datetime, date)):
            other = lib.Timestamp(other)
            tz = getattr(other, 'tz', None)

            # test we can have an equal time zone
            if tz is None or str(tz) != str(self.values.tz):
                raise ValueError("incompatible or non tz-aware value")
            other_mask = isnull(other)
            other = other.value

        return values, values_mask, other, other_mask

    def _try_coerce_result(self, result):
        """ reverse of try_coerce_args """
        if isinstance(result, np.ndarray):
            if result.dtype.kind in ['i', 'f', 'O']:
                result = result.astype('M8[ns]')
        elif isinstance(result, (np.integer, np.float, np.datetime64)):
            result = lib.Timestamp(result, tz=self.values.tz)
        if isinstance(result, np.ndarray):
            # allow passing of > 1dim if its trivial
            if result.ndim > 1:
                result = result.reshape(np.prod(result.shape))
            result = self.values._shallow_copy(result)

        return result

    @property
    def _box_func(self):
        return lambda x: tslib.Timestamp(x, tz=self.dtype.tz)

    def shift(self, periods, axis=0, mgr=None):
        """ shift the block by periods """

        # think about moving this to the DatetimeIndex. This is a non-freq
        # (number of periods) shift ###

        N = len(self)
        indexer = np.zeros(N, dtype=int)
        if periods > 0:
            indexer[periods:] = np.arange(N - periods)
        else:
            indexer[:periods] = np.arange(-periods, N)

        new_values = self.values.asi8.take(indexer)

        if periods > 0:
            new_values[:periods] = tslib.iNaT
        else:
            new_values[periods:] = tslib.iNaT

        new_values = self.values._shallow_copy(new_values)
        return [self.make_block_same_class(new_values,
                                           placement=self.mgr_locs)]


class SparseBlock(NonConsolidatableMixIn, Block):
    """ implement as a list of sparse arrays of the same dtype """
    __slots__ = ()
    is_sparse = True
    is_numeric = True
    _box_to_block_values = False
    _can_hold_na = True
    _ftype = 'sparse'
    _holder = SparseArray

    @property
    def shape(self):
        return (len(self.mgr_locs), self.sp_index.length)

    @property
    def itemsize(self):
        return self.dtype.itemsize

    @property
    def fill_value(self):
        # return np.nan
        return self.values.fill_value

    @fill_value.setter
    def fill_value(self, v):
        self.values.fill_value = v

    def to_dense(self):
        return self.values.to_dense().view()

    @property
    def sp_values(self):
        return self.values.sp_values

    @sp_values.setter
    def sp_values(self, v):
        # reset the sparse values
        self.values = SparseArray(v, sparse_index=self.sp_index,
                                  kind=self.kind, dtype=v.dtype,
                                  fill_value=self.values.fill_value,
                                  copy=False)

    @property
    def sp_index(self):
        return self.values.sp_index

    @property
    def kind(self):
        return self.values.kind

    def _astype(self, dtype, copy=False, raise_on_error=True, values=None,
                klass=None, mgr=None, **kwargs):
        if values is None:
            values = self.values
        values = values.astype(dtype, copy=copy)
        return self.make_block_same_class(values=values,
                                          placement=self.mgr_locs)

    def __len__(self):
        try:
            return self.sp_index.length
        except:
            return 0

    def copy(self, deep=True, mgr=None):
        return self.make_block_same_class(values=self.values,
                                          sparse_index=self.sp_index,
                                          kind=self.kind, copy=deep,
                                          placement=self.mgr_locs)

    def make_block_same_class(self, values, placement, sparse_index=None,
                              kind=None, dtype=None, fill_value=None,
                              copy=False, fastpath=True, **kwargs):
        """ return a new block """
        if dtype is None:
            dtype = values.dtype
        if fill_value is None and not isinstance(values, SparseArray):
            fill_value = self.values.fill_value

        # if not isinstance(values, SparseArray) and values.ndim != self.ndim:
        #     raise ValueError("ndim mismatch")

        if values.ndim == 2:
            nitems = values.shape[0]

            if nitems == 0:
                # kludgy, but SparseBlocks cannot handle slices, where the
                # output is 0-item, so let's convert it to a dense block: it
                # won't take space since there's 0 items, plus it will preserve
                # the dtype.
                return self.make_block(np.empty(values.shape, dtype=dtype),
                                       placement,
                                       fastpath=True)
            elif nitems > 1:
                raise ValueError("Only 1-item 2d sparse blocks are supported")
            else:
                values = values.reshape(values.shape[1])

        new_values = SparseArray(values, sparse_index=sparse_index,
                                 kind=kind or self.kind, dtype=dtype,
                                 fill_value=fill_value, copy=copy)
        return self.make_block(new_values, fastpath=fastpath,
                               placement=placement)

    def interpolate(self, method='pad', axis=0, inplace=False, limit=None,
                    fill_value=None, **kwargs):

        values = missing.interpolate_2d(self.values.to_dense(), method, axis,
                                        limit, fill_value)
        return self.make_block_same_class(values=values,
                                          placement=self.mgr_locs)

    def fillna(self, value, limit=None, inplace=False, downcast=None,
               mgr=None):
        # we may need to upcast our fill to match our dtype
        if limit is not None:
            raise NotImplementedError("specifying a limit for 'fillna' has "
                                      "not been implemented yet")
        values = self.values if inplace else self.values.copy()
        values = values.fillna(value, downcast=downcast)
        return [self.make_block_same_class(values=values,
                                           placement=self.mgr_locs)]

    def shift(self, periods, axis=0, mgr=None):
        """ shift the block by periods """
        N = len(self.values.T)
        indexer = np.zeros(N, dtype=int)
        if periods > 0:
            indexer[periods:] = np.arange(N - periods)
        else:
            indexer[:periods] = np.arange(-periods, N)
        new_values = self.values.to_dense().take(indexer)
        # convert integer to float if necessary. need to do a lot more than
        # that, handle boolean etc also
        new_values, fill_value = maybe_upcast(new_values)
        if periods > 0:
            new_values[:periods] = fill_value
        else:
            new_values[periods:] = fill_value
        return [self.make_block_same_class(new_values,
                                           placement=self.mgr_locs)]

    def reindex_axis(self, indexer, method=None, axis=1, fill_value=None,
                     limit=None, mask_info=None):
        """
        Reindex using pre-computed indexer information
        """
        if axis < 1:
            raise AssertionError('axis must be at least 1, got %d' % axis)

        # taking on the 0th axis always here
        if fill_value is None:
            fill_value = self.fill_value
        return self.make_block_same_class(self.values.take(indexer),
                                          fill_value=fill_value,
                                          placement=self.mgr_locs)

    def sparse_reindex(self, new_index):
        """ sparse reindex and return a new block
            current reindex only works for float64 dtype! """
        values = self.values
        values = values.sp_index.to_int_index().reindex(
            values.sp_values.astype('float64'), values.fill_value, new_index)
        return self.make_block_same_class(values, sparse_index=new_index,
                                          placement=self.mgr_locs)


def make_block(values, placement, klass=None, ndim=None, dtype=None,
               fastpath=False):
    if klass is None:
        dtype = dtype or values.dtype
        vtype = dtype.type

        if isinstance(values, SparseArray):
            klass = SparseBlock
        elif issubclass(vtype, np.floating):
            klass = FloatBlock
        elif (issubclass(vtype, np.integer) and
              issubclass(vtype, np.timedelta64)):
            klass = TimeDeltaBlock
        elif (issubclass(vtype, np.integer) and
              not issubclass(vtype, np.datetime64)):
            klass = IntBlock
        elif dtype == np.bool_:
            klass = BoolBlock
        elif issubclass(vtype, np.datetime64):
            if hasattr(values, 'tz'):
                klass = DatetimeTZBlock
            else:
                klass = DatetimeBlock
        elif is_datetimetz(values):
            klass = DatetimeTZBlock
        elif issubclass(vtype, np.complexfloating):
            klass = ComplexBlock
        elif is_categorical(values):
            klass = CategoricalBlock
        else:
            klass = ObjectBlock

    elif klass is DatetimeTZBlock and not is_datetimetz(values):
        return klass(values, ndim=ndim, fastpath=fastpath,
                     placement=placement, dtype=dtype)

    return klass(values, ndim=ndim, fastpath=fastpath, placement=placement)

# TODO: flexible with index=None and/or items=None


class BlockManager(PandasObject):
    """
    Core internal data structure to implement DataFrame, Series, Panel, etc.

    Manage a bunch of labeled 2D mixed-type ndarrays. Essentially it's a
    lightweight blocked set of labeled data to be manipulated by the DataFrame
    public API class

    Attributes
    ----------
    shape
    ndim
    axes
    values
    items

    Methods
    -------
    set_axis(axis, new_labels)
    copy(deep=True)

    get_dtype_counts
    get_ftype_counts
    get_dtypes
    get_ftypes

    apply(func, axes, block_filter_fn)

    get_bool_data
    get_numeric_data

    get_slice(slice_like, axis)
    get(label)
    iget(loc)
    get_scalar(label_tup)

    take(indexer, axis)
    reindex_axis(new_labels, axis)
    reindex_indexer(new_labels, indexer, axis)

    delete(label)
    insert(loc, label, value)
    set(label, value)

    Parameters
    ----------


    Notes
    -----
    This is *not* a public API class
    """
    __slots__ = ['axes', 'blocks', '_ndim', '_shape', '_known_consolidated',
                 '_is_consolidated', '_blknos', '_blklocs']

    def __init__(self, blocks, axes, do_integrity_check=True, fastpath=True):
        self.axes = [_ensure_index(ax) for ax in axes]
        self.blocks = tuple(blocks)

        for block in blocks:
            if block.is_sparse:
                if len(block.mgr_locs) != 1:
                    raise AssertionError("Sparse block refers to multiple "
                                         "items")
            else:
                if self.ndim != block.ndim:
                    raise AssertionError('Number of Block dimensions (%d) '
                                         'must equal number of axes (%d)' %
                                         (block.ndim, self.ndim))

        if do_integrity_check:
            self._verify_integrity()

        self._consolidate_check()

        self._rebuild_blknos_and_blklocs()

    def make_empty(self, axes=None):
        """ return an empty BlockManager with the items axis of len 0 """
        if axes is None:
            axes = [_ensure_index([])] + [_ensure_index(a)
                                          for a in self.axes[1:]]

        # preserve dtype if possible
        if self.ndim == 1:
            blocks = np.array([], dtype=self.array_dtype)
        else:
            blocks = []
        return self.__class__(blocks, axes)

    def __nonzero__(self):
        return True

    # Python3 compat
    __bool__ = __nonzero__

    @property
    def shape(self):
        return tuple(len(ax) for ax in self.axes)

    @property
    def ndim(self):
        return len(self.axes)

    def set_axis(self, axis, new_labels):
        new_labels = _ensure_index(new_labels)
        old_len = len(self.axes[axis])
        new_len = len(new_labels)

        if new_len != old_len:
            raise ValueError('Length mismatch: Expected axis has %d elements, '
                             'new values have %d elements' %
                             (old_len, new_len))

        self.axes[axis] = new_labels

    def rename_axis(self, mapper, axis, copy=True, level=None):
        """
        Rename one of axes.

        Parameters
        ----------
        mapper : unary callable
        axis : int
        copy : boolean, default True
        level : int, default None

        """
        obj = self.copy(deep=copy)
        obj.set_axis(axis, _transform_index(self.axes[axis], mapper, level))
        return obj

    def add_prefix(self, prefix):
        f = (str(prefix) + '%s').__mod__
        return self.rename_axis(f, axis=0)

    def add_suffix(self, suffix):
        f = ('%s' + str(suffix)).__mod__
        return self.rename_axis(f, axis=0)

    @property
    def _is_single_block(self):
        if self.ndim == 1:
            return True

        if len(self.blocks) != 1:
            return False

        blk = self.blocks[0]
        return (blk.mgr_locs.is_slice_like and
                blk.mgr_locs.as_slice == slice(0, len(self), 1))

    def _rebuild_blknos_and_blklocs(self):
        """
        Update mgr._blknos / mgr._blklocs.
        """
        new_blknos = np.empty(self.shape[0], dtype=np.int64)
        new_blklocs = np.empty(self.shape[0], dtype=np.int64)
        new_blknos.fill(-1)
        new_blklocs.fill(-1)

        for blkno, blk in enumerate(self.blocks):
            rl = blk.mgr_locs
            new_blknos[rl.indexer] = blkno
            new_blklocs[rl.indexer] = np.arange(len(rl))

        if (new_blknos == -1).any():
            raise AssertionError("Gaps in blk ref_locs")

        self._blknos = new_blknos
        self._blklocs = new_blklocs

    # make items read only for now
    def _get_items(self):
        return self.axes[0]

    items = property(fget=_get_items)

    def _get_counts(self, f):
        """ return a dict of the counts of the function in BlockManager """
        self._consolidate_inplace()
        counts = dict()
        for b in self.blocks:
            v = f(b)
            counts[v] = counts.get(v, 0) + b.shape[0]
        return counts

    def get_dtype_counts(self):
        return self._get_counts(lambda b: b.dtype.name)

    def get_ftype_counts(self):
        return self._get_counts(lambda b: b.ftype)

    def get_dtypes(self):
        dtypes = np.array([blk.dtype for blk in self.blocks])
        return algos.take_1d(dtypes, self._blknos, allow_fill=False)

    def get_ftypes(self):
        ftypes = np.array([blk.ftype for blk in self.blocks])
        return algos.take_1d(ftypes, self._blknos, allow_fill=False)

    def __getstate__(self):
        block_values = [b.values for b in self.blocks]
        block_items = [self.items[b.mgr_locs.indexer] for b in self.blocks]
        axes_array = [ax for ax in self.axes]

        extra_state = {
            '0.14.1': {
                'axes': axes_array,
                'blocks': [dict(values=b.values, mgr_locs=b.mgr_locs.indexer)
                           for b in self.blocks]
            }
        }

        # First three elements of the state are to maintain forward
        # compatibility with 0.13.1.
        return axes_array, block_values, block_items, extra_state

    def __setstate__(self, state):
        def unpickle_block(values, mgr_locs):
            # numpy < 1.7 pickle compat
            if values.dtype == 'M8[us]':
                values = values.astype('M8[ns]')
            return make_block(values, placement=mgr_locs)

        if (isinstance(state, tuple) and len(state) >= 4 and
                '0.14.1' in state[3]):
            state = state[3]['0.14.1']
            self.axes = [_ensure_index(ax) for ax in state['axes']]
            self.blocks = tuple(unpickle_block(b['values'], b['mgr_locs'])
                                for b in state['blocks'])
        else:
            # discard anything after 3rd, support beta pickling format for a
            # little while longer
            ax_arrays, bvalues, bitems = state[:3]

            self.axes = [_ensure_index(ax) for ax in ax_arrays]

            if len(bitems) == 1 and self.axes[0].equals(bitems[0]):
                # This is a workaround for pre-0.14.1 pickles that didn't
                # support unpickling multi-block frames/panels with non-unique
                # columns/items, because given a manager with items ["a", "b",
                # "a"] there's no way of knowing which block's "a" is where.
                #
                # Single-block case can be supported under the assumption that
                # block items corresponded to manager items 1-to-1.
                all_mgr_locs = [slice(0, len(bitems[0]))]
            else:
                all_mgr_locs = [self.axes[0].get_indexer(blk_items)
                                for blk_items in bitems]

            self.blocks = tuple(
                unpickle_block(values, mgr_locs)
                for values, mgr_locs in zip(bvalues, all_mgr_locs))

        self._post_setstate()

    def _post_setstate(self):
        self._is_consolidated = False
        self._known_consolidated = False
        self._rebuild_blknos_and_blklocs()

    def __len__(self):
        return len(self.items)

    def __unicode__(self):
        output = pprint_thing(self.__class__.__name__)
        for i, ax in enumerate(self.axes):
            if i == 0:
                output += u('\nItems: %s') % ax
            else:
                output += u('\nAxis %d: %s') % (i, ax)

        for block in self.blocks:
            output += u('\n%s') % pprint_thing(block)
        return output

    def _verify_integrity(self):
        mgr_shape = self.shape
        tot_items = sum(len(x.mgr_locs) for x in self.blocks)
        for block in self.blocks:
            if block._verify_integrity and block.shape[1:] != mgr_shape[1:]:
                construction_error(tot_items, block.shape[1:], self.axes)
        if len(self.items) != tot_items:
            raise AssertionError('Number of manager items must equal union of '
                                 'block items\n# manager items: {0}, # '
                                 'tot_items: {1}'.format(
                                     len(self.items), tot_items))

    def apply(self, f, axes=None, filter=None, do_integrity_check=False,
              consolidate=True, **kwargs):
        """
        iterate over the blocks, collect and create a new block manager

        Parameters
        ----------
        f : the callable or function name to operate on at the block level
        axes : optional (if not supplied, use self.axes)
        filter : list, if supplied, only call the block if the filter is in
                 the block
        do_integrity_check : boolean, default False. Do the block manager
            integrity check
        consolidate: boolean, default True. Join together blocks having same
            dtype

        Returns
        -------
        Block Manager (new object)

        """

        result_blocks = []

        # filter kwarg is used in replace-* family of methods
        if filter is not None:
            filter_locs = set(self.items.get_indexer_for(filter))
            if len(filter_locs) == len(self.items):
                # All items are included, as if there were no filtering
                filter = None
            else:
                kwargs['filter'] = filter_locs

        if consolidate:
            self._consolidate_inplace()

        if f == 'where':
            align_copy = True
            if kwargs.get('align', True):
                align_keys = ['other', 'cond']
            else:
                align_keys = ['cond']
        elif f == 'putmask':
            align_copy = False
            if kwargs.get('align', True):
                align_keys = ['new', 'mask']
            else:
                align_keys = ['mask']
        elif f == 'eval':
            align_copy = False
            align_keys = ['other']
        elif f == 'fillna':
            # fillna internally does putmask, maybe it's better to do this
            # at mgr, not block level?
            align_copy = False
            align_keys = ['value']
        else:
            align_keys = []

        aligned_args = dict((k, kwargs[k])
                            for k in align_keys
                            if hasattr(kwargs[k], 'reindex_axis'))

        for b in self.blocks:
            if filter is not None:
                if not b.mgr_locs.isin(filter_locs).any():
                    result_blocks.append(b)
                    continue

            if aligned_args:
                b_items = self.items[b.mgr_locs.indexer]

                for k, obj in aligned_args.items():
                    axis = getattr(obj, '_info_axis_number', 0)
                    kwargs[k] = obj.reindex_axis(b_items, axis=axis,
                                                 copy=align_copy)

            kwargs['mgr'] = self
            applied = getattr(b, f)(**kwargs)
            result_blocks = _extend_blocks(applied, result_blocks)

        if len(result_blocks) == 0:
            return self.make_empty(axes or self.axes)
        bm = self.__class__(result_blocks, axes or self.axes,
                            do_integrity_check=do_integrity_check)
        bm._consolidate_inplace()
        return bm

    def reduction(self, f, axis=0, consolidate=True, transposed=False,
                  **kwargs):
        """
        iterate over the blocks, collect and create a new block manager.
        This routine is intended for reduction type operations and
        will do inference on the generated blocks.

        Parameters
        ----------
        f: the callable or function name to operate on at the block level
        axis: reduction axis, default 0
        consolidate: boolean, default True. Join together blocks having same
            dtype
        transposed: boolean, default False
            we are holding transposed data

        Returns
        -------
        Block Manager (new object)

        """

        if consolidate:
            self._consolidate_inplace()

        axes, blocks = [], []
        for b in self.blocks:
            kwargs['mgr'] = self
            axe, block = getattr(b, f)(axis=axis, **kwargs)

            axes.append(axe)
            blocks.append(block)

        # note that some DatetimeTZ, Categorical are always ndim==1
        ndim = set([b.ndim for b in blocks])

        if 2 in ndim:

            new_axes = list(self.axes)

            # multiple blocks that are reduced
            if len(blocks) > 1:
                new_axes[1] = axes[0]

                # reset the placement to the original
                for b, sb in zip(blocks, self.blocks):
                    b.mgr_locs = sb.mgr_locs

            else:
                new_axes[axis] = Index(np.concatenate(
                    [ax.values for ax in axes]))

            if transposed:
                new_axes = new_axes[::-1]
                blocks = [b.make_block(b.values.T,
                                       placement=np.arange(b.shape[1])
                                       ) for b in blocks]

            return self.__class__(blocks, new_axes)

        # 0 ndim
        if 0 in ndim and 1 not in ndim:
            values = np.array([b.values for b in blocks])
            if len(values) == 1:
                return values.item()
            blocks = [make_block(values, ndim=1)]
            axes = Index([ax[0] for ax in axes])

        # single block
        values = _concat._concat_compat([b.values for b in blocks])

        # compute the orderings of our original data
        if len(self.blocks) > 1:

            indexer = np.empty(len(self.axes[0]), dtype=np.intp)
            i = 0
            for b in self.blocks:
                for j in b.mgr_locs:
                    indexer[j] = i
                    i = i + 1

            values = values.take(indexer)

        return SingleBlockManager(
            [make_block(values,
                        ndim=1,
                        placement=np.arange(len(values)))],
            axes[0])

    def isnull(self, **kwargs):
        return self.apply('apply', **kwargs)

    def where(self, **kwargs):
        return self.apply('where', **kwargs)

    def eval(self, **kwargs):
        return self.apply('eval', **kwargs)

    def quantile(self, **kwargs):
        return self.reduction('quantile', **kwargs)

    def setitem(self, **kwargs):
        return self.apply('setitem', **kwargs)

    def putmask(self, **kwargs):
        return self.apply('putmask', **kwargs)

    def diff(self, **kwargs):
        return self.apply('diff', **kwargs)

    def interpolate(self, **kwargs):
        return self.apply('interpolate', **kwargs)

    def shift(self, **kwargs):
        return self.apply('shift', **kwargs)

    def fillna(self, **kwargs):
        return self.apply('fillna', **kwargs)

    def downcast(self, **kwargs):
        return self.apply('downcast', **kwargs)

    def astype(self, dtype, **kwargs):
        return self.apply('astype', dtype=dtype, **kwargs)

    def convert(self, **kwargs):
        return self.apply('convert', **kwargs)

    def replace(self, **kwargs):
        return self.apply('replace', **kwargs)

    def replace_list(self, src_list, dest_list, inplace=False, regex=False,
                     mgr=None):
        """ do a list replace """

        inplace = validate_bool_kwarg(inplace, 'inplace')

        if mgr is None:
            mgr = self

        # figure out our mask a-priori to avoid repeated replacements
        values = self.as_matrix()

        def comp(s):
            if isnull(s):
                return isnull(values)
            return _maybe_compare(values, getattr(s, 'asm8', s), operator.eq)

        def _cast_scalar(block, scalar):
            dtype, val = infer_dtype_from_scalar(scalar, pandas_dtype=True)
            if not is_dtype_equal(block.dtype, dtype):
                dtype = find_common_type([block.dtype, dtype])
                block = block.astype(dtype)
                # use original value
                val = scalar

            return block, val

        masks = [comp(s) for i, s in enumerate(src_list)]

        result_blocks = []
        src_len = len(src_list) - 1
        for blk in self.blocks:

            # its possible to get multiple result blocks here
            # replace ALWAYS will return a list
            rb = [blk if inplace else blk.copy()]
            for i, (s, d) in enumerate(zip(src_list, dest_list)):
                new_rb = []
                for b in rb:
                    if b.dtype == np.object_:
                        convert = i == src_len
                        result = b.replace(s, d, inplace=inplace, regex=regex,
                                           mgr=mgr, convert=convert)
                        new_rb = _extend_blocks(result, new_rb)
                    else:
                        # get our mask for this element, sized to this
                        # particular block
                        m = masks[i][b.mgr_locs.indexer]
                        if m.any():
                            b, val = _cast_scalar(b, d)
                            new_rb.extend(b.putmask(m, val, inplace=True))
                        else:
                            new_rb.append(b)
                rb = new_rb
            result_blocks.extend(rb)

        bm = self.__class__(result_blocks, self.axes)
        bm._consolidate_inplace()
        return bm

    def reshape_nd(self, axes, **kwargs):
        """ a 2d-nd reshape operation on a BlockManager """
        return self.apply('reshape_nd', axes=axes, **kwargs)

    def is_consolidated(self):
        """
        Return True if more than one block with the same dtype
        """
        if not self._known_consolidated:
            self._consolidate_check()
        return self._is_consolidated

    def _consolidate_check(self):
        ftypes = [blk.ftype for blk in self.blocks]
        self._is_consolidated = len(ftypes) == len(set(ftypes))
        self._known_consolidated = True

    @property
    def is_mixed_type(self):
        # Warning, consolidation needs to get checked upstairs
        self._consolidate_inplace()
        return len(self.blocks) > 1

    @property
    def is_numeric_mixed_type(self):
        # Warning, consolidation needs to get checked upstairs
        self._consolidate_inplace()
        return all([block.is_numeric for block in self.blocks])

    @property
    def is_datelike_mixed_type(self):
        # Warning, consolidation needs to get checked upstairs
        self._consolidate_inplace()
        return any([block.is_datelike for block in self.blocks])

    @property
    def is_view(self):
        """ return a boolean if we are a single block and are a view """
        if len(self.blocks) == 1:
            return self.blocks[0].is_view

        # It is technically possible to figure out which blocks are views
        # e.g. [ b.values.base is not None for b in self.blocks ]
        # but then we have the case of possibly some blocks being a view
        # and some blocks not. setting in theory is possible on the non-view
        # blocks w/o causing a SettingWithCopy raise/warn. But this is a bit
        # complicated

        return False

    def get_bool_data(self, copy=False):
        """
        Parameters
        ----------
        copy : boolean, default False
            Whether to copy the blocks
        """
        self._consolidate_inplace()
        return self.combine([b for b in self.blocks if b.is_bool], copy)

    def get_numeric_data(self, copy=False):
        """
        Parameters
        ----------
        copy : boolean, default False
            Whether to copy the blocks
        """
        self._consolidate_inplace()
        return self.combine([b for b in self.blocks if b.is_numeric], copy)

    def combine(self, blocks, copy=True):
        """ return a new manager with the blocks """
        if len(blocks) == 0:
            return self.make_empty()

        # FIXME: optimization potential
        indexer = np.sort(np.concatenate([b.mgr_locs.as_array
                                          for b in blocks]))
        inv_indexer = lib.get_reverse_indexer(indexer, self.shape[0])

        new_blocks = []
        for b in blocks:
            b = b.copy(deep=copy)
            b.mgr_locs = algos.take_1d(inv_indexer, b.mgr_locs.as_array,
                                       axis=0, allow_fill=False)
            new_blocks.append(b)

        axes = list(self.axes)
        axes[0] = self.items.take(indexer)

        return self.__class__(new_blocks, axes, do_integrity_check=False)

    def get_slice(self, slobj, axis=0):
        if axis >= self.ndim:
            raise IndexError("Requested axis not found in manager")

        if axis == 0:
            new_blocks = self._slice_take_blocks_ax0(slobj)
        else:
            slicer = [slice(None)] * (axis + 1)
            slicer[axis] = slobj
            slicer = tuple(slicer)
            new_blocks = [blk.getitem_block(slicer) for blk in self.blocks]

        new_axes = list(self.axes)
        new_axes[axis] = new_axes[axis][slobj]

        bm = self.__class__(new_blocks, new_axes, do_integrity_check=False,
                            fastpath=True)
        bm._consolidate_inplace()
        return bm

    def __contains__(self, item):
        return item in self.items

    @property
    def nblocks(self):
        return len(self.blocks)

    def copy(self, deep=True, mgr=None):
        """
        Make deep or shallow copy of BlockManager

        Parameters
        ----------
        deep : boolean o rstring, default True
            If False, return shallow copy (do not copy data)
            If 'all', copy data and a deep copy of the index

        Returns
        -------
        copy : BlockManager
        """

        # this preserves the notion of view copying of axes
        if deep:
            if deep == 'all':
                copy = lambda ax: ax.copy(deep=True)
            else:
                copy = lambda ax: ax.view()
            new_axes = [copy(ax) for ax in self.axes]
        else:
            new_axes = list(self.axes)
        return self.apply('copy', axes=new_axes, deep=deep,
                          do_integrity_check=False)

    def as_matrix(self, items=None):
        if len(self.blocks) == 0:
            return np.empty(self.shape, dtype=float)

        if items is not None:
            mgr = self.reindex_axis(items, axis=0)
        else:
            mgr = self

        if self._is_single_block or not self.is_mixed_type:
            return mgr.blocks[0].get_values()
        else:
            return mgr._interleave()

    def _interleave(self):
        """
        Return ndarray from blocks with specified item order
        Items must be contained in the blocks
        """
        dtype = _interleaved_dtype(self.blocks)

        result = np.empty(self.shape, dtype=dtype)

        if result.shape[0] == 0:
            # Workaround for numpy 1.7 bug:
            #
            #     >>> a = np.empty((0,10))
            #     >>> a[slice(0,0)]
            #     array([], shape=(0, 10), dtype=float64)
            #     >>> a[[]]
            #     Traceback (most recent call last):
            #       File "<stdin>", line 1, in <module>
            #     IndexError: index 0 is out of bounds for axis 0 with size 0
            return result

        itemmask = np.zeros(self.shape[0])

        for blk in self.blocks:
            rl = blk.mgr_locs
            result[rl.indexer] = blk.get_values(dtype)
            itemmask[rl.indexer] = 1

        if not itemmask.all():
            raise AssertionError('Some items were not contained in blocks')

        return result

    def xs(self, key, axis=1, copy=True, takeable=False):
        if axis < 1:
            raise AssertionError('Can only take xs across axis >= 1, got %d' %
                                 axis)

        # take by position
        if takeable:
            loc = key
        else:
            loc = self.axes[axis].get_loc(key)

        slicer = [slice(None, None) for _ in range(self.ndim)]
        slicer[axis] = loc
        slicer = tuple(slicer)

        new_axes = list(self.axes)

        # could be an array indexer!
        if isinstance(loc, (slice, np.ndarray)):
            new_axes[axis] = new_axes[axis][loc]
        else:
            new_axes.pop(axis)

        new_blocks = []
        if len(self.blocks) > 1:
            # we must copy here as we are mixed type
            for blk in self.blocks:
                newb = make_block(values=blk.values[slicer],
                                  klass=blk.__class__, fastpath=True,
                                  placement=blk.mgr_locs)
                new_blocks.append(newb)
        elif len(self.blocks) == 1:
            block = self.blocks[0]
            vals = block.values[slicer]
            if copy:
                vals = vals.copy()
            new_blocks = [make_block(values=vals,
                                     placement=block.mgr_locs,
                                     klass=block.__class__,
                                     fastpath=True, )]

        return self.__class__(new_blocks, new_axes)

    def fast_xs(self, loc):
        """
        get a cross sectional for a given location in the
        items ; handle dups

        return the result, is *could* be a view in the case of a
        single block
        """
        if len(self.blocks) == 1:
            return self.blocks[0].iget((slice(None), loc))

        items = self.items

        # non-unique (GH4726)
        if not items.is_unique:
            result = self._interleave()
            if self.ndim == 2:
                result = result.T
            return result[loc]

        # unique
        dtype = _interleaved_dtype(self.blocks)
        n = len(items)
        result = np.empty(n, dtype=dtype)
        for blk in self.blocks:
            # Such assignment may incorrectly coerce NaT to None
            # result[blk.mgr_locs] = blk._slice((slice(None), loc))
            for i, rl in enumerate(blk.mgr_locs):
                result[rl] = blk._try_coerce_result(blk.iget((i, loc)))

        return result

    def consolidate(self):
        """
        Join together blocks having same dtype

        Returns
        -------
        y : BlockManager
        """
        if self.is_consolidated():
            return self

        bm = self.__class__(self.blocks, self.axes)
        bm._is_consolidated = False
        bm._consolidate_inplace()
        return bm

    def _consolidate_inplace(self):
        if not self.is_consolidated():
            self.blocks = tuple(_consolidate(self.blocks))
            self._is_consolidated = True
            self._known_consolidated = True
            self._rebuild_blknos_and_blklocs()

    def get(self, item, fastpath=True):
        """
        Return values for selected item (ndarray or BlockManager).
        """
        if self.items.is_unique:

            if not isnull(item):
                loc = self.items.get_loc(item)
            else:
                indexer = np.arange(len(self.items))[isnull(self.items)]

                # allow a single nan location indexer
                if not is_scalar(indexer):
                    if len(indexer) == 1:
                        loc = indexer.item()
                    else:
                        raise ValueError("cannot label index with a null key")

            return self.iget(loc, fastpath=fastpath)
        else:

            if isnull(item):
                raise TypeError("cannot label index with a null key")

            indexer = self.items.get_indexer_for([item])
            return self.reindex_indexer(new_axis=self.items[indexer],
                                        indexer=indexer, axis=0,
                                        allow_dups=True)

    def iget(self, i, fastpath=True):
        """
        Return the data as a SingleBlockManager if fastpath=True and possible

        Otherwise return as a ndarray
        """
        block = self.blocks[self._blknos[i]]
        values = block.iget(self._blklocs[i])
        if not fastpath or not block._box_to_block_values or values.ndim != 1:
            return values

        # fastpath shortcut for select a single-dim from a 2-dim BM
        return SingleBlockManager(
            [block.make_block_same_class(values,
                                         placement=slice(0, len(values)),
                                         ndim=1, fastpath=True)],
            self.axes[1])

    def get_scalar(self, tup):
        """
        Retrieve single item
        """
        full_loc = list(ax.get_loc(x) for ax, x in zip(self.axes, tup))
        blk = self.blocks[self._blknos[full_loc[0]]]
        values = blk.values

        # FIXME: this may return non-upcasted types?
        if values.ndim == 1:
            return values[full_loc[1]]

        full_loc[0] = self._blklocs[full_loc[0]]
        return values[tuple(full_loc)]

    def delete(self, item):
        """
        Delete selected item (items if non-unique) in-place.
        """
        indexer = self.items.get_loc(item)

        is_deleted = np.zeros(self.shape[0], dtype=np.bool_)
        is_deleted[indexer] = True
        ref_loc_offset = -is_deleted.cumsum()

        is_blk_deleted = [False] * len(self.blocks)

        if isinstance(indexer, int):
            affected_start = indexer
        else:
            affected_start = is_deleted.nonzero()[0][0]

        for blkno, _ in _fast_count_smallints(self._blknos[affected_start:]):
            blk = self.blocks[blkno]
            bml = blk.mgr_locs
            blk_del = is_deleted[bml.indexer].nonzero()[0]

            if len(blk_del) == len(bml):
                is_blk_deleted[blkno] = True
                continue
            elif len(blk_del) != 0:
                blk.delete(blk_del)
                bml = blk.mgr_locs

            blk.mgr_locs = bml.add(ref_loc_offset[bml.indexer])

        # FIXME: use Index.delete as soon as it uses fastpath=True
        self.axes[0] = self.items[~is_deleted]
        self.blocks = tuple(b for blkno, b in enumerate(self.blocks)
                            if not is_blk_deleted[blkno])
        self._shape = None
        self._rebuild_blknos_and_blklocs()

    def set(self, item, value, check=False):
        """
        Set new item in-place. Does not consolidate. Adds new Block if not
        contained in the current set of items
        if check, then validate that we are not setting the same data in-place
        """
        # FIXME: refactor, clearly separate broadcasting & zip-like assignment
        #        can prob also fix the various if tests for sparse/categorical

        value_is_extension_type = is_extension_type(value)

        # categorical/spares/datetimetz
        if value_is_extension_type:

            def value_getitem(placement):
                return value
        else:
            if value.ndim == self.ndim - 1:
                value = _safe_reshape(value, (1,) + value.shape)

                def value_getitem(placement):
                    return value
            else:

                def value_getitem(placement):
                    return value[placement.indexer]

            if value.shape[1:] != self.shape[1:]:
                raise AssertionError('Shape of new values must be compatible '
                                     'with manager shape')

        try:
            loc = self.items.get_loc(item)
        except KeyError:
            # This item wasn't present, just insert at end
            self.insert(len(self.items), item, value)
            return

        if isinstance(loc, int):
            loc = [loc]

        blknos = self._blknos[loc]
        blklocs = self._blklocs[loc].copy()

        unfit_mgr_locs = []
        unfit_val_locs = []
        removed_blknos = []
        for blkno, val_locs in _get_blkno_placements(blknos, len(self.blocks),
                                                     group=True):
            blk = self.blocks[blkno]
            blk_locs = blklocs[val_locs.indexer]
            if blk.should_store(value):
                blk.set(blk_locs, value_getitem(val_locs), check=check)
            else:
                unfit_mgr_locs.append(blk.mgr_locs.as_array[blk_locs])
                unfit_val_locs.append(val_locs)

                # If all block items are unfit, schedule the block for removal.
                if len(val_locs) == len(blk.mgr_locs):
                    removed_blknos.append(blkno)
                else:
                    self._blklocs[blk.mgr_locs.indexer] = -1
                    blk.delete(blk_locs)
                    self._blklocs[blk.mgr_locs.indexer] = np.arange(len(blk))

        if len(removed_blknos):
            # Remove blocks & update blknos accordingly
            is_deleted = np.zeros(self.nblocks, dtype=np.bool_)
            is_deleted[removed_blknos] = True

            new_blknos = np.empty(self.nblocks, dtype=np.int64)
            new_blknos.fill(-1)
            new_blknos[~is_deleted] = np.arange(self.nblocks -
                                                len(removed_blknos))
            self._blknos = algos.take_1d(new_blknos, self._blknos, axis=0,
                                         allow_fill=False)
            self.blocks = tuple(blk for i, blk in enumerate(self.blocks)
                                if i not in set(removed_blknos))

        if unfit_val_locs:
            unfit_mgr_locs = np.concatenate(unfit_mgr_locs)
            unfit_count = len(unfit_mgr_locs)

            new_blocks = []
            if value_is_extension_type:
                # This code (ab-)uses the fact that sparse blocks contain only
                # one item.
                new_blocks.extend(
                    make_block(values=value.copy(), ndim=self.ndim,
                               placement=slice(mgr_loc, mgr_loc + 1))
                    for mgr_loc in unfit_mgr_locs)

                self._blknos[unfit_mgr_locs] = (np.arange(unfit_count) +
                                                len(self.blocks))
                self._blklocs[unfit_mgr_locs] = 0

            else:
                # unfit_val_locs contains BlockPlacement objects
                unfit_val_items = unfit_val_locs[0].append(unfit_val_locs[1:])

                new_blocks.append(
                    make_block(values=value_getitem(unfit_val_items),
                               ndim=self.ndim, placement=unfit_mgr_locs))

                self._blknos[unfit_mgr_locs] = len(self.blocks)
                self._blklocs[unfit_mgr_locs] = np.arange(unfit_count)

            self.blocks += tuple(new_blocks)

            # Newly created block's dtype may already be present.
            self._known_consolidated = False

    def insert(self, loc, item, value, allow_duplicates=False):
        """
        Insert item at selected position.

        Parameters
        ----------
        loc : int
        item : hashable
        value : array_like
        allow_duplicates: bool
            If False, trying to insert non-unique item will raise

        """
        if not allow_duplicates and item in self.items:
            # Should this be a different kind of error??
            raise ValueError('cannot insert {}, already exists'.format(item))

        if not isinstance(loc, int):
            raise TypeError("loc must be int")

        # insert to the axis; this could possibly raise a TypeError
        new_axis = self.items.insert(loc, item)

        block = make_block(values=value, ndim=self.ndim,
                           placement=slice(loc, loc + 1))

        for blkno, count in _fast_count_smallints(self._blknos[loc:]):
            blk = self.blocks[blkno]
            if count == len(blk.mgr_locs):
                blk.mgr_locs = blk.mgr_locs.add(1)
            else:
                new_mgr_locs = blk.mgr_locs.as_array.copy()
                new_mgr_locs[new_mgr_locs >= loc] += 1
                blk.mgr_locs = new_mgr_locs

        if loc == self._blklocs.shape[0]:
            # np.append is a lot faster (at least in numpy 1.7.1), let's use it
            # if we can.
            self._blklocs = np.append(self._blklocs, 0)
            self._blknos = np.append(self._blknos, len(self.blocks))
        else:
            self._blklocs = np.insert(self._blklocs, loc, 0)
            self._blknos = np.insert(self._blknos, loc, len(self.blocks))

        self.axes[0] = new_axis
        self.blocks += (block,)
        self._shape = None

        self._known_consolidated = False

        if len(self.blocks) > 100:
            self._consolidate_inplace()

    def reindex_axis(self, new_index, axis, method=None, limit=None,
                     fill_value=None, copy=True):
        """
        Conform block manager to new index.
        """
        new_index = _ensure_index(new_index)
        new_index, indexer = self.axes[axis].reindex(new_index, method=method,
                                                     limit=limit)

        return self.reindex_indexer(new_index, indexer, axis=axis,
                                    fill_value=fill_value, copy=copy)

    def reindex_indexer(self, new_axis, indexer, axis, fill_value=None,
                        allow_dups=False, copy=True):
        """
        Parameters
        ----------
        new_axis : Index
        indexer : ndarray of int64 or None
        axis : int
        fill_value : object
        allow_dups : bool

        pandas-indexer with -1's only.
        """
        if indexer is None:
            if new_axis is self.axes[axis] and not copy:
                return self

            result = self.copy(deep=copy)
            result.axes = list(self.axes)
            result.axes[axis] = new_axis
            return result

        self._consolidate_inplace()

        # some axes don't allow reindexing with dups
        if not allow_dups:
            self.axes[axis]._can_reindex(indexer)

        if axis >= self.ndim:
            raise IndexError("Requested axis not found in manager")

        if axis == 0:
            new_blocks = self._slice_take_blocks_ax0(indexer,
                                                     fill_tuple=(fill_value,))
        else:
            new_blocks = [blk.take_nd(indexer, axis=axis, fill_tuple=(
                fill_value if fill_value is not None else blk.fill_value,))
                for blk in self.blocks]

        new_axes = list(self.axes)
        new_axes[axis] = new_axis
        return self.__class__(new_blocks, new_axes)

    def _slice_take_blocks_ax0(self, slice_or_indexer, fill_tuple=None):
        """
        Slice/take blocks along axis=0.

        Overloaded for SingleBlock

        Returns
        -------
        new_blocks : list of Block

        """

        allow_fill = fill_tuple is not None

        sl_type, slobj, sllen = _preprocess_slice_or_indexer(
            slice_or_indexer, self.shape[0], allow_fill=allow_fill)

        if self._is_single_block:
            blk = self.blocks[0]

            if sl_type in ('slice', 'mask'):
                return [blk.getitem_block(slobj, new_mgr_locs=slice(0, sllen))]
            elif not allow_fill or self.ndim == 1:
                if allow_fill and fill_tuple[0] is None:
                    _, fill_value = maybe_promote(blk.dtype)
                    fill_tuple = (fill_value, )

                return [blk.take_nd(slobj, axis=0,
                                    new_mgr_locs=slice(0, sllen),
                                    fill_tuple=fill_tuple)]

        if sl_type in ('slice', 'mask'):
            blknos = self._blknos[slobj]
            blklocs = self._blklocs[slobj]
        else:
            blknos = algos.take_1d(self._blknos, slobj, fill_value=-1,
                                   allow_fill=allow_fill)
            blklocs = algos.take_1d(self._blklocs, slobj, fill_value=-1,
                                    allow_fill=allow_fill)

        # When filling blknos, make sure blknos is updated before appending to
        # blocks list, that way new blkno is exactly len(blocks).
        #
        # FIXME: mgr_groupby_blknos must return mgr_locs in ascending order,
        # pytables serialization will break otherwise.
        blocks = []
        for blkno, mgr_locs in _get_blkno_placements(blknos, len(self.blocks),
                                                     group=True):
            if blkno == -1:
                # If we've got here, fill_tuple was not None.
                fill_value = fill_tuple[0]

                blocks.append(self._make_na_block(placement=mgr_locs,
                                                  fill_value=fill_value))
            else:
                blk = self.blocks[blkno]

                # Otherwise, slicing along items axis is necessary.
                if not blk._can_consolidate:
                    # A non-consolidatable block, it's easy, because there's
                    # only one item and each mgr loc is a copy of that single
                    # item.
                    for mgr_loc in mgr_locs:
                        newblk = blk.copy(deep=True)
                        newblk.mgr_locs = slice(mgr_loc, mgr_loc + 1)
                        blocks.append(newblk)

                else:
                    blocks.append(blk.take_nd(blklocs[mgr_locs.indexer],
                                              axis=0, new_mgr_locs=mgr_locs,
                                              fill_tuple=None))

        return blocks

    def _make_na_block(self, placement, fill_value=None):
        # TODO: infer dtypes other than float64 from fill_value

        if fill_value is None:
            fill_value = np.nan
        block_shape = list(self.shape)
        block_shape[0] = len(placement)

        dtype, fill_value = infer_dtype_from_scalar(fill_value)
        block_values = np.empty(block_shape, dtype=dtype)
        block_values.fill(fill_value)
        return make_block(block_values, placement=placement)

    def take(self, indexer, axis=1, verify=True, convert=True):
        """
        Take items along any axis.
        """
        self._consolidate_inplace()
        indexer = (np.arange(indexer.start, indexer.stop, indexer.step,
                             dtype='int64')
                   if isinstance(indexer, slice)
                   else np.asanyarray(indexer, dtype='int64'))

        n = self.shape[axis]
        if convert:
            indexer = maybe_convert_indices(indexer, n)

        if verify:
            if ((indexer == -1) | (indexer >= n)).any():
                raise Exception('Indices must be nonzero and less than '
                                'the axis length')

        new_labels = self.axes[axis].take(indexer)
        return self.reindex_indexer(new_axis=new_labels, indexer=indexer,
                                    axis=axis, allow_dups=True)

    def merge(self, other, lsuffix='', rsuffix=''):
        if not self._is_indexed_like(other):
            raise AssertionError('Must have same axes to merge managers')

        l, r = items_overlap_with_suffix(left=self.items, lsuffix=lsuffix,
                                         right=other.items, rsuffix=rsuffix)
        new_items = _concat_indexes([l, r])

        new_blocks = [blk.copy(deep=False) for blk in self.blocks]

        offset = self.shape[0]
        for blk in other.blocks:
            blk = blk.copy(deep=False)
            blk.mgr_locs = blk.mgr_locs.add(offset)
            new_blocks.append(blk)

        new_axes = list(self.axes)
        new_axes[0] = new_items

        return self.__class__(_consolidate(new_blocks), new_axes)

    def _is_indexed_like(self, other):
        """
        Check all axes except items
        """
        if self.ndim != other.ndim:
            raise AssertionError('Number of dimensions must agree '
                                 'got %d and %d' % (self.ndim, other.ndim))
        for ax, oax in zip(self.axes[1:], other.axes[1:]):
            if not ax.equals(oax):
                return False
        return True

    def equals(self, other):
        self_axes, other_axes = self.axes, other.axes
        if len(self_axes) != len(other_axes):
            return False
        if not all(ax1.equals(ax2) for ax1, ax2 in zip(self_axes, other_axes)):
            return False
        self._consolidate_inplace()
        other._consolidate_inplace()
        if len(self.blocks) != len(other.blocks):
            return False

        # canonicalize block order, using a tuple combining the type
        # name and then mgr_locs because there might be unconsolidated
        # blocks (say, Categorical) which can only be distinguished by
        # the iteration order
        def canonicalize(block):
            return (block.dtype.name, block.mgr_locs.as_array.tolist())

        self_blocks = sorted(self.blocks, key=canonicalize)
        other_blocks = sorted(other.blocks, key=canonicalize)
        return all(block.equals(oblock)
                   for block, oblock in zip(self_blocks, other_blocks))


class SingleBlockManager(BlockManager):
    """ manage a single block with """

    ndim = 1
    _is_consolidated = True
    _known_consolidated = True
    __slots__ = ()

    def __init__(self, block, axis, do_integrity_check=False, fastpath=False):

        if isinstance(axis, list):
            if len(axis) != 1:
                raise ValueError("cannot create SingleBlockManager with more "
                                 "than 1 axis")
            axis = axis[0]

        # passed from constructor, single block, single axis
        if fastpath:
            self.axes = [axis]
            if isinstance(block, list):

                # empty block
                if len(block) == 0:
                    block = [np.array([])]
                elif len(block) != 1:
                    raise ValueError('Cannot create SingleBlockManager with '
                                     'more than 1 block')
                block = block[0]
        else:
            self.axes = [_ensure_index(axis)]

            # create the block here
            if isinstance(block, list):

                # provide consolidation to the interleaved_dtype
                if len(block) > 1:
                    dtype = _interleaved_dtype(block)
                    block = [b.astype(dtype) for b in block]
                    block = _consolidate(block)

                if len(block) != 1:
                    raise ValueError('Cannot create SingleBlockManager with '
                                     'more than 1 block')
                block = block[0]

        if not isinstance(block, Block):
            block = make_block(block, placement=slice(0, len(axis)), ndim=1,
                               fastpath=True)

        self.blocks = [block]

    def _post_setstate(self):
        pass

    @property
    def _block(self):
        return self.blocks[0]

    @property
    def _values(self):
        return self._block.values

    @property
    def _blknos(self):
        """ compat with BlockManager """
        return None

    @property
    def _blklocs(self):
        """ compat with BlockManager """
        return None

    def reindex(self, new_axis, indexer=None, method=None, fill_value=None,
                limit=None, copy=True):
        # if we are the same and don't copy, just return
        if self.index.equals(new_axis):
            if copy:
                return self.copy(deep=True)
            else:
                return self

        values = self._block.get_values()

        if indexer is None:
            indexer = self.items.get_indexer_for(new_axis)

        if fill_value is None:
            fill_value = np.nan

        new_values = algos.take_1d(values, indexer, fill_value=fill_value)

        # fill if needed
        if method is not None or limit is not None:
            new_values = missing.interpolate_2d(new_values,
                                                method=method,
                                                limit=limit,
                                                fill_value=fill_value)

        if self._block.is_sparse:
            make_block = self._block.make_block_same_class

        block = make_block(new_values, copy=copy,
                           placement=slice(0, len(new_axis)))

        mgr = SingleBlockManager(block, new_axis)
        mgr._consolidate_inplace()
        return mgr

    def get_slice(self, slobj, axis=0):
        if axis >= self.ndim:
            raise IndexError("Requested axis not found in manager")

        return self.__class__(self._block._slice(slobj),
                              self.index[slobj], fastpath=True)

    @property
    def index(self):
        return self.axes[0]

    def convert(self, **kwargs):
        """ convert the whole block as one """
        kwargs['by_item'] = False
        return self.apply('convert', **kwargs)

    @property
    def dtype(self):
        return self._block.dtype

    @property
    def array_dtype(self):
        return self._block.array_dtype

    @property
    def ftype(self):
        return self._block.ftype

    def get_dtype_counts(self):
        return {self.dtype.name: 1}

    def get_ftype_counts(self):
        return {self.ftype: 1}

    def get_dtypes(self):
        return np.array([self._block.dtype])

    def get_ftypes(self):
        return np.array([self._block.ftype])

    def external_values(self):
        return self._block.external_values()

    def internal_values(self):
        return self._block.internal_values()

    def get_values(self):
        """ return a dense type view """
        return np.array(self._block.to_dense(), copy=False)

    @property
    def asobject(self):
        """
        return a object dtype array. datetime/timedelta like values are boxed
        to Timestamp/Timedelta instances.
        """
        return self._block.get_values(dtype=object)

    @property
    def itemsize(self):
        return self._block.values.itemsize

    @property
    def _can_hold_na(self):
        return self._block._can_hold_na

    def is_consolidated(self):
        return True

    def _consolidate_check(self):
        pass

    def _consolidate_inplace(self):
        pass

    def delete(self, item):
        """
        Delete single item from SingleBlockManager.

        Ensures that self.blocks doesn't become empty.
        """
        loc = self.items.get_loc(item)
        self._block.delete(loc)
        self.axes[0] = self.axes[0].delete(loc)

    def fast_xs(self, loc):
        """
        fast path for getting a cross-section
        return a view of the data
        """
        return self._block.values[loc]


def construction_error(tot_items, block_shape, axes, e=None):
    """ raise a helpful message about our construction """
    passed = tuple(map(int, [tot_items] + list(block_shape)))
    implied = tuple(map(int, [len(ax) for ax in axes]))
    if passed == implied and e is not None:
        raise e
    if block_shape[0] == 0:
        raise ValueError("Empty data passed with indices specified.")
    raise ValueError("Shape of passed values is {0}, indices imply {1}".format(
        passed, implied))


def create_block_manager_from_blocks(blocks, axes):
    try:
        if len(blocks) == 1 and not isinstance(blocks[0], Block):
            # if blocks[0] is of length 0, return empty blocks
            if not len(blocks[0]):
                blocks = []
            else:
                # It's OK if a single block is passed as values, its placement
                # is basically "all items", but if there're many, don't bother
                # converting, it's an error anyway.
                blocks = [make_block(values=blocks[0],
                                     placement=slice(0, len(axes[0])))]

        mgr = BlockManager(blocks, axes)
        mgr._consolidate_inplace()
        return mgr

    except (ValueError) as e:
        blocks = [getattr(b, 'values', b) for b in blocks]
        tot_items = sum(b.shape[0] for b in blocks)
        construction_error(tot_items, blocks[0].shape[1:], axes, e)


def create_block_manager_from_arrays(arrays, names, axes):

    try:
        blocks = form_blocks(arrays, names, axes)
        mgr = BlockManager(blocks, axes)
        mgr._consolidate_inplace()
        return mgr
    except ValueError as e:
        construction_error(len(arrays), arrays[0].shape, axes, e)


def form_blocks(arrays, names, axes):
    # put "leftover" items in float bucket, where else?
    # generalize?
    float_items = []
    complex_items = []
    int_items = []
    bool_items = []
    object_items = []
    sparse_items = []
    datetime_items = []
    datetime_tz_items = []
    cat_items = []
    extra_locs = []

    names_idx = Index(names)
    if names_idx.equals(axes[0]):
        names_indexer = np.arange(len(names_idx))
    else:
        assert names_idx.intersection(axes[0]).is_unique
        names_indexer = names_idx.get_indexer_for(axes[0])

    for i, name_idx in enumerate(names_indexer):
        if name_idx == -1:
            extra_locs.append(i)
            continue

        k = names[name_idx]
        v = arrays[name_idx]

        if is_sparse(v):
            sparse_items.append((i, k, v))
        elif issubclass(v.dtype.type, np.floating):
            float_items.append((i, k, v))
        elif issubclass(v.dtype.type, np.complexfloating):
            complex_items.append((i, k, v))
        elif issubclass(v.dtype.type, np.datetime64):
            if v.dtype != _NS_DTYPE:
                v = tslib.cast_to_nanoseconds(v)

            if is_datetimetz(v):
                datetime_tz_items.append((i, k, v))
            else:
                datetime_items.append((i, k, v))
        elif is_datetimetz(v):
            datetime_tz_items.append((i, k, v))
        elif issubclass(v.dtype.type, np.integer):
            int_items.append((i, k, v))
        elif v.dtype == np.bool_:
            bool_items.append((i, k, v))
        elif is_categorical(v):
            cat_items.append((i, k, v))
        else:
            object_items.append((i, k, v))

    blocks = []
    if len(float_items):
        float_blocks = _multi_blockify(float_items)
        blocks.extend(float_blocks)

    if len(complex_items):
        complex_blocks = _multi_blockify(complex_items)
        blocks.extend(complex_blocks)

    if len(int_items):
        int_blocks = _multi_blockify(int_items)
        blocks.extend(int_blocks)

    if len(datetime_items):
        datetime_blocks = _simple_blockify(datetime_items, _NS_DTYPE)
        blocks.extend(datetime_blocks)

    if len(datetime_tz_items):
        dttz_blocks = [make_block(array,
                                  klass=DatetimeTZBlock,
                                  fastpath=True,
                                  placement=[i], )
                       for i, _, array in datetime_tz_items]
        blocks.extend(dttz_blocks)

    if len(bool_items):
        bool_blocks = _simple_blockify(bool_items, np.bool_)
        blocks.extend(bool_blocks)

    if len(object_items) > 0:
        object_blocks = _simple_blockify(object_items, np.object_)
        blocks.extend(object_blocks)

    if len(sparse_items) > 0:
        sparse_blocks = _sparse_blockify(sparse_items)
        blocks.extend(sparse_blocks)

    if len(cat_items) > 0:
        cat_blocks = [make_block(array, klass=CategoricalBlock, fastpath=True,
                                 placement=[i])
                      for i, _, array in cat_items]
        blocks.extend(cat_blocks)

    if len(extra_locs):
        shape = (len(extra_locs),) + tuple(len(x) for x in axes[1:])

        # empty items -> dtype object
        block_values = np.empty(shape, dtype=object)
        block_values.fill(np.nan)

        na_block = make_block(block_values, placement=extra_locs)
        blocks.append(na_block)

    return blocks


def _simple_blockify(tuples, dtype):
    """ return a single array of a block that has a single dtype; if dtype is
    not None, coerce to this dtype
    """
    values, placement = _stack_arrays(tuples, dtype)

    # CHECK DTYPE?
    if dtype is not None and values.dtype != dtype:  # pragma: no cover
        values = values.astype(dtype)

    block = make_block(values, placement=placement)
    return [block]


def _multi_blockify(tuples, dtype=None):
    """ return an array of blocks that potentially have different dtypes """

    # group by dtype
    grouper = itertools.groupby(tuples, lambda x: x[2].dtype)

    new_blocks = []
    for dtype, tup_block in grouper:

        values, placement = _stack_arrays(list(tup_block), dtype)

        block = make_block(values, placement=placement)
        new_blocks.append(block)

    return new_blocks


def _sparse_blockify(tuples, dtype=None):
    """ return an array of blocks that potentially have different dtypes (and
    are sparse)
    """

    new_blocks = []
    for i, names, array in tuples:
        array = _maybe_to_sparse(array)
        block = make_block(array, klass=SparseBlock, fastpath=True,
                           placement=[i])
        new_blocks.append(block)

    return new_blocks


def _stack_arrays(tuples, dtype):

    # fml
    def _asarray_compat(x):
        if isinstance(x, ABCSeries):
            return x._values
        else:
            return np.asarray(x)

    def _shape_compat(x):
        if isinstance(x, ABCSeries):
            return len(x),
        else:
            return x.shape

    placement, names, arrays = zip(*tuples)

    first = arrays[0]
    shape = (len(arrays),) + _shape_compat(first)

    stacked = np.empty(shape, dtype=dtype)
    for i, arr in enumerate(arrays):
        stacked[i] = _asarray_compat(arr)

    return stacked, placement


def _interleaved_dtype(blocks):
    if not len(blocks):
        return None

    dtype = find_common_type([b.dtype for b in blocks])

    # only numpy compat
    if isinstance(dtype, ExtensionDtype):
        dtype = np.object

    return dtype


def _consolidate(blocks):
    """
    Merge blocks having same dtype, exclude non-consolidating blocks
    """

    # sort by _can_consolidate, dtype
    gkey = lambda x: x._consolidate_key
    grouper = itertools.groupby(sorted(blocks, key=gkey), gkey)

    new_blocks = []
    for (_can_consolidate, dtype), group_blocks in grouper:
        merged_blocks = _merge_blocks(list(group_blocks), dtype=dtype,
                                      _can_consolidate=_can_consolidate)
        new_blocks = _extend_blocks(merged_blocks, new_blocks)
    return new_blocks


def _merge_blocks(blocks, dtype=None, _can_consolidate=True):

    if len(blocks) == 1:
        return blocks[0]

    if _can_consolidate:

        if dtype is None:
            if len(set([b.dtype for b in blocks])) != 1:
                raise AssertionError("_merge_blocks are invalid!")
            dtype = blocks[0].dtype

        # FIXME: optimization potential in case all mgrs contain slices and
        # combination of those slices is a slice, too.
        new_mgr_locs = np.concatenate([b.mgr_locs.as_array for b in blocks])
        new_values = _vstack([b.values for b in blocks], dtype)

        argsort = np.argsort(new_mgr_locs)
        new_values = new_values[argsort]
        new_mgr_locs = new_mgr_locs[argsort]

        return make_block(new_values, fastpath=True, placement=new_mgr_locs)

    # no merge
    return blocks


def _extend_blocks(result, blocks=None):
    """ return a new extended blocks, givin the result """
    if blocks is None:
        blocks = []
    if isinstance(result, list):
        for r in result:
            if isinstance(r, list):
                blocks.extend(r)
            else:
                blocks.append(r)
    elif isinstance(result, BlockManager):
        blocks.extend(result.blocks)
    else:
        blocks.append(result)
    return blocks


def _block_shape(values, ndim=1, shape=None):
    """ guarantee the shape of the values to be at least 1 d """
    if values.ndim < ndim:
        if shape is None:
            shape = values.shape
        values = values.reshape(tuple((1, ) + shape))
    return values


def _vstack(to_stack, dtype):

    # work around NumPy 1.6 bug
    if dtype == _NS_DTYPE or dtype == _TD_DTYPE:
        new_values = np.vstack([x.view('i8') for x in to_stack])
        return new_values.view(dtype)

    else:
        return np.vstack(to_stack)


def _maybe_compare(a, b, op):

    is_a_array = isinstance(a, np.ndarray)
    is_b_array = isinstance(b, np.ndarray)

    # numpy deprecation warning to have i8 vs integer comparisions
    if is_datetimelike_v_numeric(a, b):
        result = False

    # numpy deprecation warning if comparing numeric vs string-like
    elif is_numeric_v_string_like(a, b):
        result = False

    else:
        result = op(a, b)

    if is_scalar(result) and (is_a_array or is_b_array):
        type_names = [type(a).__name__, type(b).__name__]

        if is_a_array:
            type_names[0] = 'ndarray(dtype=%s)' % a.dtype

        if is_b_array:
            type_names[1] = 'ndarray(dtype=%s)' % b.dtype

        raise TypeError("Cannot compare types %r and %r" % tuple(type_names))
    return result


def _concat_indexes(indexes):
    return indexes[0].append(indexes[1:])


def _block2d_to_blocknd(values, placement, shape, labels, ref_items):
    """ pivot to the labels shape """
    from pandas.core.internals import make_block

    panel_shape = (len(placement),) + shape

    # TODO: lexsort depth needs to be 2!!

    # Create observation selection vector using major and minor
    # labels, for converting to panel format.
    selector = _factor_indexer(shape[1:], labels)
    mask = np.zeros(np.prod(shape), dtype=bool)
    mask.put(selector, True)

    if mask.all():
        pvalues = np.empty(panel_shape, dtype=values.dtype)
    else:
        dtype, fill_value = maybe_promote(values.dtype)
        pvalues = np.empty(panel_shape, dtype=dtype)
        pvalues.fill(fill_value)

    values = values
    for i in range(len(placement)):
        pvalues[i].flat[mask] = values[:, i]

    return make_block(pvalues, placement=placement)


def _factor_indexer(shape, labels):
    """
    given a tuple of shape and a list of Categorical labels, return the
    expanded label indexer
    """
    mult = np.array(shape)[::-1].cumprod()[::-1]
    return _ensure_platform_int(
        np.sum(np.array(labels).T * np.append(mult, [1]), axis=1).T)


def _get_blkno_placements(blknos, blk_count, group=True):
    """

    Parameters
    ----------
    blknos : array of int64
    blk_count : int
    group : bool

    Returns
    -------
    iterator
        yield (BlockPlacement, blkno)

    """

    blknos = _ensure_int64(blknos)

    # FIXME: blk_count is unused, but it may avoid the use of dicts in cython
    for blkno, indexer in lib.get_blkno_indexers(blknos, group):
        yield blkno, BlockPlacement(indexer)


def items_overlap_with_suffix(left, lsuffix, right, rsuffix):
    """
    If two indices overlap, add suffixes to overlapping entries.

    If corresponding suffix is empty, the entry is simply converted to string.

    """
    to_rename = left.intersection(right)
    if len(to_rename) == 0:
        return left, right
    else:
        if not lsuffix and not rsuffix:
            raise ValueError('columns overlap but no suffix specified: %s' %
                             to_rename)

        def lrenamer(x):
            if x in to_rename:
                return '%s%s' % (x, lsuffix)
            return x

        def rrenamer(x):
            if x in to_rename:
                return '%s%s' % (x, rsuffix)
            return x

        return (_transform_index(left, lrenamer),
                _transform_index(right, rrenamer))


def _safe_reshape(arr, new_shape):
    """
    If possible, reshape `arr` to have shape `new_shape`,
    with a couple of exceptions (see gh-13012):

    1) If `arr` is a Categorical or Index, `arr` will be
       returned as is.
    2) If `arr` is a Series, the `_values` attribute will
       be reshaped and returned.

    Parameters
    ----------
    arr : array-like, object to be reshaped
    new_shape : int or tuple of ints, the new shape
    """
    if isinstance(arr, ABCSeries):
        arr = arr._values
    if not isinstance(arr, Categorical):
        arr = arr.reshape(new_shape)
    return arr


def _transform_index(index, func, level=None):
    """
    Apply function to all values found in index.

    This includes transforming multiindex entries separately.
    Only apply function to one level of the MultiIndex if level is specified.

    """
    if isinstance(index, MultiIndex):
        if level is not None:
            items = [tuple(func(y) if i == level else y
                           for i, y in enumerate(x)) for x in index]
        else:
            items = [tuple(func(y) for y in x) for x in index]
        return MultiIndex.from_tuples(items, names=index.names)
    else:
        items = [func(x) for x in index]
        return Index(items, name=index.name)


def _putmask_smart(v, m, n):
    """
    Return a new block, try to preserve dtype if possible.

    Parameters
    ----------
    v : `values`, updated in-place (array like)
    m : `mask`, applies to both sides (array like)
    n : `new values` either scalar or an array like aligned with `values`
    """
    # n should be the length of the mask or a scalar here
    if not is_list_like(n):
        n = np.array([n] * len(m))
    elif isinstance(n, np.ndarray) and n.ndim == 0:  # numpy scalar
        n = np.repeat(np.array(n, ndmin=1), len(m))

    # see if we are only masking values that if putted
    # will work in the current dtype
    try:
        nn = n[m]

        # make sure that we have a nullable type
        # if we have nulls
        if not _is_na_compat(v, nn[0]):
            raise ValueError

        nn_at = nn.astype(v.dtype)

        # avoid invalid dtype comparisons
        if not is_numeric_v_string_like(nn, nn_at):
            comp = (nn == nn_at)
            if is_list_like(comp) and comp.all():
                nv = v.copy()
                nv[m] = nn_at
                return nv
    except (ValueError, IndexError, TypeError):
        pass

    # change the dtype
    dtype, _ = maybe_promote(n.dtype)

    if is_extension_type(v.dtype) and is_object_dtype(dtype):
        nv = v.get_values(dtype)
    else:
        nv = v.astype(dtype)

    try:
        nv[m] = n[m]
    except ValueError:
        idx, = np.where(np.squeeze(m))
        for mask_index, new_val in zip(idx, n[m]):
            nv[mask_index] = new_val
    return nv


def concatenate_block_managers(mgrs_indexers, axes, concat_axis, copy):
    """
    Concatenate block managers into one.

    Parameters
    ----------
    mgrs_indexers : list of (BlockManager, {axis: indexer,...}) tuples
    axes : list of Index
    concat_axis : int
    copy : bool

    """
    concat_plan = combine_concat_plans(
        [get_mgr_concatenation_plan(mgr, indexers)
         for mgr, indexers in mgrs_indexers], concat_axis)

    blocks = [make_block(
        concatenate_join_units(join_units, concat_axis, copy=copy),
        placement=placement) for placement, join_units in concat_plan]

    return BlockManager(blocks, axes)


def get_empty_dtype_and_na(join_units):
    """
    Return dtype and N/A values to use when concatenating specified units.

    Returned N/A value may be None which means there was no casting involved.

    Returns
    -------
    dtype
    na
    """

    if len(join_units) == 1:
        blk = join_units[0].block
        if blk is None:
            return np.float64, np.nan

    has_none_blocks = False
    dtypes = [None] * len(join_units)
    for i, unit in enumerate(join_units):
        if unit.block is None:
            has_none_blocks = True
        else:
            dtypes[i] = unit.dtype

    upcast_classes = defaultdict(list)
    null_upcast_classes = defaultdict(list)
    for dtype, unit in zip(dtypes, join_units):
        if dtype is None:
            continue

        if is_categorical_dtype(dtype):
            upcast_cls = 'category'
        elif is_datetimetz(dtype):
            upcast_cls = 'datetimetz'
        elif issubclass(dtype.type, np.bool_):
            upcast_cls = 'bool'
        elif issubclass(dtype.type, np.object_):
            upcast_cls = 'object'
        elif is_datetime64_dtype(dtype):
            upcast_cls = 'datetime'
        elif is_timedelta64_dtype(dtype):
            upcast_cls = 'timedelta'
        elif is_float_dtype(dtype) or is_numeric_dtype(dtype):
            upcast_cls = dtype.name
        else:
            upcast_cls = 'float'

        # Null blocks should not influence upcast class selection, unless there
        # are only null blocks, when same upcasting rules must be applied to
        # null upcast classes.
        if unit.is_null:
            null_upcast_classes[upcast_cls].append(dtype)
        else:
            upcast_classes[upcast_cls].append(dtype)

    if not upcast_classes:
        upcast_classes = null_upcast_classes

    # create the result
    if 'object' in upcast_classes:
        return np.dtype(np.object_), np.nan
    elif 'bool' in upcast_classes:
        if has_none_blocks:
            return np.dtype(np.object_), np.nan
        else:
            return np.dtype(np.bool_), None
    elif 'category' in upcast_classes:
        return np.dtype(np.object_), np.nan
    elif 'datetimetz' in upcast_classes:
        dtype = upcast_classes['datetimetz']
        return dtype[0], tslib.iNaT
    elif 'datetime' in upcast_classes:
        return np.dtype('M8[ns]'), tslib.iNaT
    elif 'timedelta' in upcast_classes:
        return np.dtype('m8[ns]'), tslib.iNaT
    else:  # pragma
        g = np.find_common_type(upcast_classes, [])
        if is_float_dtype(g):
            return g, g.type(np.nan)
        elif is_numeric_dtype(g):
            if has_none_blocks:
                return np.float64, np.nan
            else:
                return g, None

    msg = "invalid dtype determination in get_concat_dtype"
    raise AssertionError(msg)


def concatenate_join_units(join_units, concat_axis, copy):
    """
    Concatenate values from several join units along selected axis.
    """
    if concat_axis == 0 and len(join_units) > 1:
        # Concatenating join units along ax0 is handled in _merge_blocks.
        raise AssertionError("Concatenating join units along axis0")

    empty_dtype, upcasted_na = get_empty_dtype_and_na(join_units)

    to_concat = [ju.get_reindexed_values(empty_dtype=empty_dtype,
                                         upcasted_na=upcasted_na)
                 for ju in join_units]

    if len(to_concat) == 1:
        # Only one block, nothing to concatenate.
        concat_values = to_concat[0]
        if copy and concat_values.base is not None:
            concat_values = concat_values.copy()
    else:
        concat_values = _concat._concat_compat(to_concat, axis=concat_axis)

    return concat_values


def get_mgr_concatenation_plan(mgr, indexers):
    """
    Construct concatenation plan for given block manager and indexers.

    Parameters
    ----------
    mgr : BlockManager
    indexers : dict of {axis: indexer}

    Returns
    -------
    plan : list of (BlockPlacement, JoinUnit) tuples

    """
    # Calculate post-reindex shape , save for item axis which will be separate
    # for each block anyway.
    mgr_shape = list(mgr.shape)
    for ax, indexer in indexers.items():
        mgr_shape[ax] = len(indexer)
    mgr_shape = tuple(mgr_shape)

    if 0 in indexers:
        ax0_indexer = indexers.pop(0)
        blknos = algos.take_1d(mgr._blknos, ax0_indexer, fill_value=-1)
        blklocs = algos.take_1d(mgr._blklocs, ax0_indexer, fill_value=-1)
    else:

        if mgr._is_single_block:
            blk = mgr.blocks[0]
            return [(blk.mgr_locs, JoinUnit(blk, mgr_shape, indexers))]

        ax0_indexer = None
        blknos = mgr._blknos
        blklocs = mgr._blklocs

    plan = []
    for blkno, placements in _get_blkno_placements(blknos, len(mgr.blocks),
                                                   group=False):

        assert placements.is_slice_like

        join_unit_indexers = indexers.copy()

        shape = list(mgr_shape)
        shape[0] = len(placements)
        shape = tuple(shape)

        if blkno == -1:
            unit = JoinUnit(None, shape)
        else:
            blk = mgr.blocks[blkno]
            ax0_blk_indexer = blklocs[placements.indexer]

            unit_no_ax0_reindexing = (len(placements) == len(blk.mgr_locs) and
                                      # Fastpath detection of join unit not
                                      # needing to reindex its block: no ax0
                                      # reindexing took place and block
                                      # placement was sequential before.
                                      ((ax0_indexer is None and
                                        blk.mgr_locs.is_slice_like and
                                        blk.mgr_locs.as_slice.step == 1) or
                                       # Slow-ish detection: all indexer locs
                                       # are sequential (and length match is
                                       # checked above).
                                       (np.diff(ax0_blk_indexer) == 1).all()))

            # Omit indexer if no item reindexing is required.
            if unit_no_ax0_reindexing:
                join_unit_indexers.pop(0, None)
            else:
                join_unit_indexers[0] = ax0_blk_indexer

            unit = JoinUnit(blk, shape, join_unit_indexers)

        plan.append((placements, unit))

    return plan


def combine_concat_plans(plans, concat_axis):
    """
    Combine multiple concatenation plans into one.

    existing_plan is updated in-place.
    """
    if len(plans) == 1:
        for p in plans[0]:
            yield p[0], [p[1]]

    elif concat_axis == 0:
        offset = 0
        for plan in plans:
            last_plc = None

            for plc, unit in plan:
                yield plc.add(offset), [unit]
                last_plc = plc

            if last_plc is not None:
                offset += last_plc.as_slice.stop

    else:
        num_ended = [0]

        def _next_or_none(seq):
            retval = next(seq, None)
            if retval is None:
                num_ended[0] += 1
            return retval

        plans = list(map(iter, plans))
        next_items = list(map(_next_or_none, plans))

        while num_ended[0] != len(next_items):
            if num_ended[0] > 0:
                raise ValueError("Plan shapes are not aligned")

            placements, units = zip(*next_items)

            lengths = list(map(len, placements))
            min_len, max_len = min(lengths), max(lengths)

            if min_len == max_len:
                yield placements[0], units
                next_items[:] = map(_next_or_none, plans)
            else:
                yielded_placement = None
                yielded_units = [None] * len(next_items)
                for i, (plc, unit) in enumerate(next_items):
                    yielded_units[i] = unit
                    if len(plc) > min_len:
                        # trim_join_unit updates unit in place, so only
                        # placement needs to be sliced to skip min_len.
                        next_items[i] = (plc[min_len:],
                                         trim_join_unit(unit, min_len))
                    else:
                        yielded_placement = plc
                        next_items[i] = _next_or_none(plans[i])

                yield yielded_placement, yielded_units


def trim_join_unit(join_unit, length):
    """
    Reduce join_unit's shape along item axis to length.

    Extra items that didn't fit are returned as a separate block.
    """

    if 0 not in join_unit.indexers:
        extra_indexers = join_unit.indexers

        if join_unit.block is None:
            extra_block = None
        else:
            extra_block = join_unit.block.getitem_block(slice(length, None))
            join_unit.block = join_unit.block.getitem_block(slice(length))
    else:
        extra_block = join_unit.block

        extra_indexers = copy.copy(join_unit.indexers)
        extra_indexers[0] = extra_indexers[0][length:]
        join_unit.indexers[0] = join_unit.indexers[0][:length]

    extra_shape = (join_unit.shape[0] - length,) + join_unit.shape[1:]
    join_unit.shape = (length,) + join_unit.shape[1:]

    return JoinUnit(block=extra_block, indexers=extra_indexers,
                    shape=extra_shape)


class JoinUnit(object):

    def __init__(self, block, shape, indexers=None):
        # Passing shape explicitly is required for cases when block is None.
        if indexers is None:
            indexers = {}
        self.block = block
        self.indexers = indexers
        self.shape = shape

    def __repr__(self):
        return '%s(%r, %s)' % (self.__class__.__name__, self.block,
                               self.indexers)

    @cache_readonly
    def needs_filling(self):
        for indexer in self.indexers.values():
            # FIXME: cache results of indexer == -1 checks.
            if (indexer == -1).any():
                return True

        return False

    @cache_readonly
    def dtype(self):
        if self.block is None:
            raise AssertionError("Block is None, no dtype")

        if not self.needs_filling:
            return self.block.dtype
        else:
            return _get_dtype(maybe_promote(self.block.dtype,
                                            self.block.fill_value)[0])

        return self._dtype

    @cache_readonly
    def is_null(self):
        if self.block is None:
            return True

        if not self.block._can_hold_na:
            return False

        # Usually it's enough to check but a small fraction of values to see if
        # a block is NOT null, chunks should help in such cases.  1000 value
        # was chosen rather arbitrarily.
        values = self.block.values
        if self.block.is_categorical:
            values_flat = values.categories
        elif self.block.is_sparse:
            # fill_value is not NaN and have holes
            if not values._null_fill_value and values.sp_index.ngaps > 0:
                return False
            values_flat = values.ravel(order='K')
        else:
            values_flat = values.ravel(order='K')
        total_len = values_flat.shape[0]
        chunk_len = max(total_len // 40, 1000)
        for i in range(0, total_len, chunk_len):
            if not isnull(values_flat[i:i + chunk_len]).all():
                return False

        return True

    def get_reindexed_values(self, empty_dtype, upcasted_na):
        if upcasted_na is None:
            # No upcasting is necessary
            fill_value = self.block.fill_value
            values = self.block.get_values()
        else:
            fill_value = upcasted_na

            if self.is_null:
                if getattr(self.block, 'is_object', False):
                    # we want to avoid filling with np.nan if we are
                    # using None; we already know that we are all
                    # nulls
                    values = self.block.values.ravel(order='K')
                    if len(values) and values[0] is None:
                        fill_value = None

                if getattr(self.block, 'is_datetimetz', False):
                    pass
                elif getattr(self.block, 'is_categorical', False):
                    pass
                elif getattr(self.block, 'is_sparse', False):
                    pass
                else:
                    missing_arr = np.empty(self.shape, dtype=empty_dtype)
                    missing_arr.fill(fill_value)
                    return missing_arr

            if not self.indexers:
                if not self.block._can_consolidate:
                    # preserve these for validation in _concat_compat
                    return self.block.values

            if self.block.is_bool:
                # External code requested filling/upcasting, bool values must
                # be upcasted to object to avoid being upcasted to numeric.
                values = self.block.astype(np.object_).values
            elif self.block.is_categorical:
                values = self.block.values
            else:
                # No dtype upcasting is done here, it will be performed during
                # concatenation itself.
                values = self.block.get_values()

        if not self.indexers:
            # If there's no indexing to be done, we want to signal outside
            # code that this array must be copied explicitly.  This is done
            # by returning a view and checking `retval.base`.
            values = values.view()

        else:
            for ax, indexer in self.indexers.items():
                values = algos.take_nd(values, indexer, axis=ax,
                                       fill_value=fill_value)

        return values


def _fast_count_smallints(arr):
    """Faster version of set(arr) for sequences of small numbers."""
    if len(arr) == 0:
        # Handle empty arr case separately: numpy 1.6 chokes on that.
        return np.empty((0, 2), dtype=arr.dtype)
    else:
        counts = np.bincount(arr.astype(np.int_))
        nz = counts.nonzero()[0]
        return np.c_[nz, counts[nz]]


def _preprocess_slice_or_indexer(slice_or_indexer, length, allow_fill):
    if isinstance(slice_or_indexer, slice):
        return 'slice', slice_or_indexer, lib.slice_len(slice_or_indexer,
                                                        length)
    elif (isinstance(slice_or_indexer, np.ndarray) and
          slice_or_indexer.dtype == np.bool_):
        return 'mask', slice_or_indexer, slice_or_indexer.sum()
    else:
        indexer = np.asanyarray(slice_or_indexer, dtype=np.int64)
        if not allow_fill:
            indexer = maybe_convert_indices(indexer, length)
        return 'fancy', indexer, len(indexer)
