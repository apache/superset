# pylint: disable=E1101,W0232

import numpy as np
from warnings import warn
import types

from pandas import compat
from pandas.compat import u, lzip
from pandas._libs import lib, algos as libalgos

from pandas.core.dtypes.generic import (
    ABCSeries, ABCIndexClass, ABCCategoricalIndex)
from pandas.core.dtypes.missing import isnull, notnull
from pandas.core.dtypes.cast import (
    maybe_infer_to_datetimelike,
    coerce_indexer_dtype)
from pandas.core.dtypes.dtypes import CategoricalDtype
from pandas.core.dtypes.common import (
    _ensure_int64,
    _ensure_object,
    _ensure_platform_int,
    is_dtype_equal,
    is_datetimelike,
    is_categorical,
    is_categorical_dtype,
    is_integer_dtype, is_bool,
    is_list_like, is_sequence,
    is_scalar)
from pandas.core.common import is_null_slice

from pandas.core.algorithms import factorize, take_1d, unique1d
from pandas.core.base import (PandasObject, PandasDelegate,
                              NoNewAttributesMixin, _shared_docs)
import pandas.core.common as com
from pandas.core.missing import interpolate_2d
from pandas.compat.numpy import function as nv
from pandas.util._decorators import (Appender, cache_readonly,
                                     deprecate_kwarg, Substitution)

from pandas.io.formats.terminal import get_terminal_size
from pandas.util._validators import validate_bool_kwarg
from pandas.core.config import get_option


def _cat_compare_op(op):
    def f(self, other):
        # On python2, you can usually compare any type to any type, and
        # Categoricals can be seen as a custom type, but having different
        # results depending whether categories are the same or not is kind of
        # insane, so be a bit stricter here and use the python3 idea of
        # comparing only things of equal type.
        if not self.ordered:
            if op in ['__lt__', '__gt__', '__le__', '__ge__']:
                raise TypeError("Unordered Categoricals can only compare "
                                "equality or not")
        if isinstance(other, Categorical):
            # Two Categoricals can only be be compared if the categories are
            # the same (maybe up to ordering, depending on ordered)

            msg = ("Categoricals can only be compared if "
                   "'categories' are the same.")
            if len(self.categories) != len(other.categories):
                raise TypeError(msg + " Categories are different lengths")
            elif (self.ordered and not (self.categories ==
                                        other.categories).all()):
                raise TypeError(msg)
            elif not set(self.categories) == set(other.categories):
                raise TypeError(msg)

            if not (self.ordered == other.ordered):
                raise TypeError("Categoricals can only be compared if "
                                "'ordered' is the same")
            if not self.ordered and not self.categories.equals(
                    other.categories):
                # both unordered and different order
                other_codes = _get_codes_for_values(other, self.categories)
            else:
                other_codes = other._codes

            na_mask = (self._codes == -1) | (other_codes == -1)
            f = getattr(self._codes, op)
            ret = f(other_codes)
            if na_mask.any():
                # In other series, the leads to False, so do that here too
                ret[na_mask] = False
            return ret

        # Numpy-1.9 and earlier may convert a scalar to a zerodim array during
        # comparison operation when second arg has higher priority, e.g.
        #
        #     cat[0] < cat
        #
        # With cat[0], for example, being ``np.int64(1)`` by the time it gets
        # into this function would become ``np.array(1)``.
        other = lib.item_from_zerodim(other)
        if is_scalar(other):
            if other in self.categories:
                i = self.categories.get_loc(other)
                return getattr(self._codes, op)(i)
            else:
                if op == '__eq__':
                    return np.repeat(False, len(self))
                elif op == '__ne__':
                    return np.repeat(True, len(self))
                else:
                    msg = ("Cannot compare a Categorical for op {op} with a "
                           "scalar, which is not a category.")
                    raise TypeError(msg.format(op=op))
        else:

            # allow categorical vs object dtype array comparisons for equality
            # these are only positional comparisons
            if op in ['__eq__', '__ne__']:
                return getattr(np.array(self), op)(np.array(other))

            msg = ("Cannot compare a Categorical for op {op} with type {typ}."
                   "\nIf you want to compare values, use 'np.asarray(cat) "
                   "<op> other'.")
            raise TypeError(msg.format(op=op, typ=type(other)))

    f.__name__ = op

    return f


def maybe_to_categorical(array):
    """ coerce to a categorical if a series is given """
    if isinstance(array, (ABCSeries, ABCCategoricalIndex)):
        return array._values
    return array


_codes_doc = """The category codes of this categorical.

Level codes are an array if integer which are the positions of the real
values in the categories array.

There is not setter, use the other categorical methods and the normal item
setter to change values in the categorical.
"""

_categories_doc = """The categories of this categorical.

Setting assigns new values to each category (effectively a rename of
each individual category).

The assigned value has to be a list-like object. All items must be unique and
the number of items in the new categories must be the same as the number of
items in the old categories.

Assigning to `categories` is a inplace operation!

Raises
------
ValueError
    If the new categories do not validate as categories or if the number of new
    categories is unequal the number of old categories

See also
--------
rename_categories
reorder_categories
add_categories
remove_categories
remove_unused_categories
set_categories
"""


class Categorical(PandasObject):
    """
    Represents a categorical variable in classic R / S-plus fashion

    `Categoricals` can only take on only a limited, and usually fixed, number
    of possible values (`categories`). In contrast to statistical categorical
    variables, a `Categorical` might have an order, but numerical operations
    (additions, divisions, ...) are not possible.

    All values of the `Categorical` are either in `categories` or `np.nan`.
    Assigning values outside of `categories` will raise a `ValueError`. Order
    is defined by the order of the `categories`, not lexical order of the
    values.

    Parameters
    ----------
    values : list-like
        The values of the categorical. If categories are given, values not in
        categories will be replaced with NaN.
    categories : Index-like (unique), optional
        The unique categories for this categorical. If not given, the
        categories are assumed to be the unique values of values.
    ordered : boolean, (default False)
        Whether or not this categorical is treated as a ordered categorical.
        If not given, the resulting categorical will not be ordered.

    Attributes
    ----------
    categories : Index
        The categories of this categorical
    codes : ndarray
        The codes (integer positions, which point to the categories) of this
        categorical, read only.
    ordered : boolean
        Whether or not this Categorical is ordered.

    Raises
    ------
    ValueError
        If the categories do not validate.
    TypeError
        If an explicit ``ordered=True`` is given but no `categories` and the
        `values` are not sortable.


    Examples
    --------
    >>> from pandas import Categorical
    >>> Categorical([1, 2, 3, 1, 2, 3])
    [1, 2, 3, 1, 2, 3]
    Categories (3, int64): [1 < 2 < 3]

    >>> Categorical(['a', 'b', 'c', 'a', 'b', 'c'])
    [a, b, c, a, b, c]
    Categories (3, object): [a < b < c]

    >>> a = Categorical(['a','b','c','a','b','c'], ['c', 'b', 'a'],
                        ordered=True)
    >>> a.min()
    'c'
    """
    dtype = CategoricalDtype()
    """The dtype (always "category")"""
    """Whether or not this Categorical is ordered.

    Only ordered `Categoricals` can be sorted (according to the order
    of the categories) and have a min and max value.

    See also
    --------
    Categorical.sort
    Categorical.order
    Categorical.min
    Categorical.max
    """

    # For comparisons, so that numpy uses our implementation if the compare
    # ops, which raise
    __array_priority__ = 1000
    _typ = 'categorical'

    def __init__(self, values, categories=None, ordered=False, fastpath=False):

        self._validate_ordered(ordered)

        if fastpath:
            # fast path
            self._codes = coerce_indexer_dtype(values, categories)
            self._categories = self._validate_categories(
                categories, fastpath=isinstance(categories, ABCIndexClass))
            self._ordered = ordered
            return

        # sanitize input
        if is_categorical_dtype(values):

            # we are either a Series or a CategoricalIndex
            if isinstance(values, (ABCSeries, ABCCategoricalIndex)):
                values = values._values

            if ordered is None:
                ordered = values.ordered
            if categories is None:
                categories = values.categories
            values = values.get_values()

        elif isinstance(values, (ABCIndexClass, ABCSeries)):
            pass

        else:

            # on numpy < 1.6 datetimelike get inferred to all i8 by
            # _sanitize_array which is fine, but since factorize does this
            # correctly no need here this is an issue because _sanitize_array
            # also coerces np.nan to a string under certain versions of numpy
            # as well
            values = maybe_infer_to_datetimelike(values, convert_dates=True)
            if not isinstance(values, np.ndarray):
                values = _convert_to_list_like(values)
                from pandas.core.series import _sanitize_array
                # On list with NaNs, int values will be converted to float. Use
                # "object" dtype to prevent this. In the end objects will be
                # casted to int/... in the category assignment step.
                dtype = 'object' if isnull(values).any() else None
                values = _sanitize_array(values, None, dtype=dtype)

        if categories is None:
            try:
                codes, categories = factorize(values, sort=True)
            except TypeError:
                codes, categories = factorize(values, sort=False)
                if ordered:
                    # raise, as we don't have a sortable data structure and so
                    # the user should give us one by specifying categories
                    raise TypeError("'values' is not ordered, please "
                                    "explicitly specify the categories order "
                                    "by passing in a categories argument.")
            except ValueError:

                # FIXME
                raise NotImplementedError("> 1 ndim Categorical are not "
                                          "supported at this time")

            categories = self._validate_categories(categories)

        else:
            # there were two ways if categories are present
            # - the old one, where each value is a int pointer to the levels
            #   array -> not anymore possible, but code outside of pandas could
            #   call us like that, so make some checks
            # - the new one, where each value is also in the categories array
            #   (or np.nan)

            # make sure that we always have the same type here, no matter what
            # we get passed in
            categories = self._validate_categories(categories)
            codes = _get_codes_for_values(values, categories)

            # TODO: check for old style usage. These warnings should be removes
            # after 0.18/ in 2016
            if is_integer_dtype(values) and not is_integer_dtype(categories):
                warn("Values and categories have different dtypes. Did you "
                     "mean to use\n'Categorical.from_codes(codes, "
                     "categories)'?", RuntimeWarning, stacklevel=2)

            if (len(values) and is_integer_dtype(values) and
                    (codes == -1).all()):
                warn("None of the categories were found in values. Did you "
                     "mean to use\n'Categorical.from_codes(codes, "
                     "categories)'?", RuntimeWarning, stacklevel=2)

        self.set_ordered(ordered or False, inplace=True)
        self._categories = categories
        self._codes = coerce_indexer_dtype(codes, categories)

    def __dir__(self):
        # Avoid IPython warnings for deprecated properties
        # https://github.com/pandas-dev/pandas/issues/16409
        rv = set(dir(type(self)))
        rv.discard("labels")
        return sorted(rv)

    @property
    def _constructor(self):
        return Categorical

    def copy(self):
        """ Copy constructor. """
        return self._constructor(values=self._codes.copy(),
                                 categories=self.categories,
                                 ordered=self.ordered,
                                 fastpath=True)

    def astype(self, dtype, copy=True):
        """
        Coerce this type to another dtype

        Parameters
        ----------
        dtype : numpy dtype or pandas type
        copy : bool, default True
            By default, astype always returns a newly allocated object.
            If copy is set to False and dtype is categorical, the original
            object is returned.

            .. versionadded:: 0.19.0

        """
        if is_categorical_dtype(dtype):
            if copy is True:
                return self.copy()
            return self
        return np.array(self, dtype=dtype, copy=copy)

    @cache_readonly
    def ndim(self):
        """Number of dimensions of the Categorical """
        return self._codes.ndim

    @cache_readonly
    def size(self):
        """ return the len of myself """
        return len(self)

    @cache_readonly
    def itemsize(self):
        """ return the size of a single category """
        return self.categories.itemsize

    def reshape(self, new_shape, *args, **kwargs):
        """
        DEPRECATED: calling this method will raise an error in a
        future release.

        An ndarray-compatible method that returns `self` because
        `Categorical` instances cannot actually be reshaped.

        Parameters
        ----------
        new_shape : int or tuple of ints
            A 1-D array of integers that correspond to the new
            shape of the `Categorical`. For more information on
            the parameter, please refer to `np.reshape`.
        """
        warn("reshape is deprecated and will raise "
             "in a subsequent release", FutureWarning, stacklevel=2)

        nv.validate_reshape(args, kwargs)

        # while the 'new_shape' parameter has no effect,
        # we should still enforce valid shape parameters
        np.reshape(self.codes, new_shape)

        return self

    @property
    def base(self):
        """ compat, we are always our own object """
        return None

    @classmethod
    def from_array(cls, data, **kwargs):
        """
        DEPRECATED: Use ``Categorical`` instead.

        Make a Categorical type from a single array-like object.

        For internal compatibility with numpy arrays.

        Parameters
        ----------
        data : array-like
            Can be an Index or array-like. The categories are assumed to be
            the unique values of `data`.
        """
        warn("Categorical.from_array is deprecated, use Categorical instead",
             FutureWarning, stacklevel=2)
        return cls(data, **kwargs)

    @classmethod
    def from_codes(cls, codes, categories, ordered=False):
        """
        Make a Categorical type from codes and categories arrays.

        This constructor is useful if you already have codes and categories and
        so do not need the (computation intensive) factorization step, which is
        usually done on the constructor.

        If your data does not follow this convention, please use the normal
        constructor.

        Parameters
        ----------
        codes : array-like, integers
            An integer array, where each integer points to a category in
            categories or -1 for NaN
        categories : index-like
            The categories for the categorical. Items need to be unique.
        ordered : boolean, (default False)
            Whether or not this categorical is treated as a ordered
            categorical. If not given, the resulting categorical will be
            unordered.
        """
        try:
            codes = np.asarray(codes, np.int64)
        except:
            raise ValueError(
                "codes need to be convertible to an arrays of integers")

        categories = cls._validate_categories(categories)

        if len(codes) and (codes.max() >= len(categories) or codes.min() < -1):
            raise ValueError("codes need to be between -1 and "
                             "len(categories)-1")

        return cls(codes, categories=categories, ordered=ordered,
                   fastpath=True)

    _codes = None

    def _get_codes(self):
        """ Get the codes.

        Returns
        -------
        codes : integer array view
            A non writable view of the `codes` array.
        """
        v = self._codes.view()
        v.flags.writeable = False
        return v

    def _set_codes(self, codes):
        """
        Not settable by the user directly
        """
        raise ValueError("cannot set Categorical codes directly")

    codes = property(fget=_get_codes, fset=_set_codes, doc=_codes_doc)

    def _get_labels(self):
        """
        Get the category labels (deprecated).

        Deprecated, use .codes!
        """
        warn("'labels' is deprecated. Use 'codes' instead", FutureWarning,
             stacklevel=2)
        return self.codes

    labels = property(fget=_get_labels, fset=_set_codes)

    _categories = None

    @classmethod
    def _validate_ordered(cls, ordered):
        """
        Validates that we have a valid ordered parameter. If
        it is not a boolean, a TypeError will be raised.

        Parameters
        ----------
        ordered : object
            The parameter to be verified.

        Raises
        ------
        TypeError
            If 'ordered' is not a boolean.
        """
        if not is_bool(ordered):
            raise TypeError("'ordered' must either be 'True' or 'False'")

    @classmethod
    def _validate_categories(cls, categories, fastpath=False):
        """
        Validates that we have good categories

        Parameters
        ----------
        fastpath : boolean (default: False)
           Don't perform validation of the categories for uniqueness or nulls

        """
        if not isinstance(categories, ABCIndexClass):
            dtype = None
            if not hasattr(categories, "dtype"):
                categories = _convert_to_list_like(categories)
                # On categories with NaNs, int values would be converted to
                # float. Use "object" dtype to prevent this.
                if isnull(categories).any():
                    without_na = np.array([x for x in categories
                                           if notnull(x)])
                    with_na = np.array(categories)
                    if with_na.dtype != without_na.dtype:
                        dtype = "object"

            from pandas import Index
            categories = Index(categories, dtype=dtype)

        if not fastpath:

            # Categories cannot contain NaN.
            if categories.hasnans:
                raise ValueError('Categorial categories cannot be null')

            # Categories must be unique.
            if not categories.is_unique:
                raise ValueError('Categorical categories must be unique')

        return categories

    def _set_categories(self, categories, fastpath=False):
        """ Sets new categories

        Parameters
        ----------
        fastpath : boolean (default: False)
           Don't perform validation of the categories for uniqueness or nulls

        """

        categories = self._validate_categories(categories, fastpath=fastpath)
        if (not fastpath and self._categories is not None and
                len(categories) != len(self._categories)):
            raise ValueError("new categories need to have the same number of "
                             "items than the old categories!")

        self._categories = categories

    def _get_categories(self):
        """ Gets the categories """
        # categories is an Index, which is immutable -> no need to copy
        return self._categories

    categories = property(fget=_get_categories, fset=_set_categories,
                          doc=_categories_doc)

    def _codes_for_groupby(self, sort):
        """
        If sort=False, return a copy of self, coded with categories as
        returned by .unique(), followed by any categories not appearing in
        the data. If sort=True, return self.

        This method is needed solely to ensure the categorical index of the
        GroupBy result has categories in the order of appearance in the data
        (GH-8868).

        Parameters
        ----------
        sort : boolean
            The value of the sort paramter groupby was called with.

        Returns
        -------
        Categorical
            If sort=False, the new categories are set to the order of
            appearance in codes (unless ordered=True, in which case the
            original order is preserved), followed by any unrepresented
            categories in the original order.
        """

        # Already sorted according to self.categories; all is fine
        if sort:
            return self

        # sort=False should order groups in as-encountered order (GH-8868)
        cat = self.unique()

        # But for groupby to work, all categories should be present,
        # including those missing from the data (GH-13179), which .unique()
        # above dropped
        cat.add_categories(
            self.categories[~self.categories.isin(cat.categories)],
            inplace=True)

        return self.reorder_categories(cat.categories)

    _ordered = None

    def set_ordered(self, value, inplace=False):
        """
        Sets the ordered attribute to the boolean value

        Parameters
        ----------
        value : boolean to set whether this categorical is ordered (True) or
           not (False)
        inplace : boolean (default: False)
           Whether or not to set the ordered attribute inplace or return a copy
           of this categorical with ordered set to the value
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        self._validate_ordered(value)
        cat = self if inplace else self.copy()
        cat._ordered = value
        if not inplace:
            return cat

    def as_ordered(self, inplace=False):
        """
        Sets the Categorical to be ordered

        Parameters
        ----------
        inplace : boolean (default: False)
           Whether or not to set the ordered attribute inplace or return a copy
           of this categorical with ordered set to True
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        return self.set_ordered(True, inplace=inplace)

    def as_unordered(self, inplace=False):
        """
        Sets the Categorical to be unordered

        Parameters
        ----------
        inplace : boolean (default: False)
           Whether or not to set the ordered attribute inplace or return a copy
           of this categorical with ordered set to False
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        return self.set_ordered(False, inplace=inplace)

    def _get_ordered(self):
        """ Gets the ordered attribute """
        return self._ordered

    ordered = property(fget=_get_ordered)

    def set_categories(self, new_categories, ordered=None, rename=False,
                       inplace=False):
        """ Sets the categories to the specified new_categories.

        `new_categories` can include new categories (which will result in
        unused categories) or remove old categories (which results in values
        set to NaN). If `rename==True`, the categories will simple be renamed
        (less or more items than in old categories will result in values set to
        NaN or in unused categories respectively).

        This method can be used to perform more than one action of adding,
        removing, and reordering simultaneously and is therefore faster than
        performing the individual steps via the more specialised methods.

        On the other hand this methods does not do checks (e.g., whether the
        old categories are included in the new categories on a reorder), which
        can result in surprising changes, for example when using special string
        dtypes on python3, which does not considers a S1 string equal to a
        single char python string.

        Raises
        ------
        ValueError
            If new_categories does not validate as categories

        Parameters
        ----------
        new_categories : Index-like
           The categories in new order.
        ordered : boolean, (default: False)
           Whether or not the categorical is treated as a ordered categorical.
           If not given, do not change the ordered information.
        rename : boolean (default: False)
           Whether or not the new_categories should be considered as a rename
           of the old  categories or as reordered categories.
        inplace : boolean (default: False)
           Whether or not to reorder the categories inplace or return a copy of
           this categorical with reordered categories.

        Returns
        -------
        cat : Categorical with reordered categories or None if inplace.

        See also
        --------
        rename_categories
        reorder_categories
        add_categories
        remove_categories
        remove_unused_categories
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        new_categories = self._validate_categories(new_categories)
        cat = self if inplace else self.copy()
        if rename:
            if (cat._categories is not None and
                    len(new_categories) < len(cat._categories)):
                # remove all _codes which are larger and set to -1/NaN
                self._codes[self._codes >= len(new_categories)] = -1
        else:
            values = cat.__array__()
            cat._codes = _get_codes_for_values(values, new_categories)
        cat._categories = new_categories

        if ordered is None:
            ordered = self.ordered
        cat.set_ordered(ordered, inplace=True)

        if not inplace:
            return cat

    def rename_categories(self, new_categories, inplace=False):
        """ Renames categories.

        The new categories has to be a list-like object. All items must be
        unique and the number of items in the new categories must be the same
        as the number of items in the old categories.

        Raises
        ------
        ValueError
            If the new categories do not have the same number of items than the
            current categories or do not validate as categories

        Parameters
        ----------
        new_categories : Index-like
           The renamed categories.
        inplace : boolean (default: False)
           Whether or not to rename the categories inplace or return a copy of
           this categorical with renamed categories.

        Returns
        -------
        cat : Categorical with renamed categories added or None if inplace.

        See also
        --------
        reorder_categories
        add_categories
        remove_categories
        remove_unused_categories
        set_categories
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        cat = self if inplace else self.copy()
        cat.categories = new_categories
        if not inplace:
            return cat

    def reorder_categories(self, new_categories, ordered=None, inplace=False):
        """ Reorders categories as specified in new_categories.

        `new_categories` need to include all old categories and no new category
        items.

        Raises
        ------
        ValueError
            If the new categories do not contain all old category items or any
            new ones

        Parameters
        ----------
        new_categories : Index-like
           The categories in new order.
        ordered : boolean, optional
           Whether or not the categorical is treated as a ordered categorical.
           If not given, do not change the ordered information.
        inplace : boolean (default: False)
           Whether or not to reorder the categories inplace or return a copy of
           this categorical with reordered categories.

        Returns
        -------
        cat : Categorical with reordered categories or None if inplace.

        See also
        --------
        rename_categories
        add_categories
        remove_categories
        remove_unused_categories
        set_categories
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if set(self._categories) != set(new_categories):
            raise ValueError("items in new_categories are not the same as in "
                             "old categories")
        return self.set_categories(new_categories, ordered=ordered,
                                   inplace=inplace)

    def add_categories(self, new_categories, inplace=False):
        """ Add new categories.

        `new_categories` will be included at the last/highest place in the
        categories and will be unused directly after this call.

        Raises
        ------
        ValueError
            If the new categories include old categories or do not validate as
            categories

        Parameters
        ----------
        new_categories : category or list-like of category
           The new categories to be included.
        inplace : boolean (default: False)
           Whether or not to add the categories inplace or return a copy of
           this categorical with added categories.

        Returns
        -------
        cat : Categorical with new categories added or None if inplace.

        See also
        --------
        rename_categories
        reorder_categories
        remove_categories
        remove_unused_categories
        set_categories
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if not is_list_like(new_categories):
            new_categories = [new_categories]
        already_included = set(new_categories) & set(self._categories)
        if len(already_included) != 0:
            msg = ("new categories must not include old categories: %s" %
                   str(already_included))
            raise ValueError(msg)
        new_categories = list(self._categories) + list(new_categories)
        cat = self if inplace else self.copy()
        cat._categories = self._validate_categories(new_categories)
        cat._codes = coerce_indexer_dtype(cat._codes, new_categories)
        if not inplace:
            return cat

    def remove_categories(self, removals, inplace=False):
        """ Removes the specified categories.

        `removals` must be included in the old categories. Values which were in
        the removed categories will be set to NaN

        Raises
        ------
        ValueError
            If the removals are not contained in the categories

        Parameters
        ----------
        removals : category or list of categories
           The categories which should be removed.
        inplace : boolean (default: False)
           Whether or not to remove the categories inplace or return a copy of
           this categorical with removed categories.

        Returns
        -------
        cat : Categorical with removed categories or None if inplace.

        See also
        --------
        rename_categories
        reorder_categories
        add_categories
        remove_unused_categories
        set_categories
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if not is_list_like(removals):
            removals = [removals]

        removal_set = set(list(removals))
        not_included = removal_set - set(self._categories)
        new_categories = [c for c in self._categories if c not in removal_set]

        # GH 10156
        if any(isnull(removals)):
            not_included = [x for x in not_included if notnull(x)]
            new_categories = [x for x in new_categories if notnull(x)]

        if len(not_included) != 0:
            raise ValueError("removals must all be in old categories: %s" %
                             str(not_included))

        return self.set_categories(new_categories, ordered=self.ordered,
                                   rename=False, inplace=inplace)

    def remove_unused_categories(self, inplace=False):
        """ Removes categories which are not used.

        Parameters
        ----------
        inplace : boolean (default: False)
           Whether or not to drop unused categories inplace or return a copy of
           this categorical with unused categories dropped.

        Returns
        -------
        cat : Categorical with unused categories dropped or None if inplace.

        See also
        --------
        rename_categories
        reorder_categories
        add_categories
        remove_categories
        set_categories
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        cat = self if inplace else self.copy()
        idx, inv = np.unique(cat._codes, return_inverse=True)

        if idx.size != 0 and idx[0] == -1:  # na sentinel
            idx, inv = idx[1:], inv - 1

        cat._categories = cat.categories.take(idx)
        cat._codes = coerce_indexer_dtype(inv, self._categories)

        if not inplace:
            return cat

    def map(self, mapper):
        """Apply mapper function to its categories (not codes).

        Parameters
        ----------
        mapper : callable
            Function to be applied. When all categories are mapped
            to different categories, the result will be Categorical which has
            the same order property as the original. Otherwise, the result will
            be np.ndarray.

        Returns
        -------
        applied : Categorical or Index.

        """
        new_categories = self.categories.map(mapper)
        try:
            return self.from_codes(self._codes.copy(),
                                   categories=new_categories,
                                   ordered=self.ordered)
        except ValueError:
            return np.take(new_categories, self._codes)

    __eq__ = _cat_compare_op('__eq__')
    __ne__ = _cat_compare_op('__ne__')
    __lt__ = _cat_compare_op('__lt__')
    __gt__ = _cat_compare_op('__gt__')
    __le__ = _cat_compare_op('__le__')
    __ge__ = _cat_compare_op('__ge__')

    # for Series/ndarray like compat
    @property
    def shape(self):
        """ Shape of the Categorical.

        For internal compatibility with numpy arrays.

        Returns
        -------
        shape : tuple
        """

        return tuple([len(self._codes)])

    def shift(self, periods):
        """
        Shift Categorical by desired number of periods.

        Parameters
        ----------
        periods : int
            Number of periods to move, can be positive or negative

        Returns
        -------
        shifted : Categorical
        """
        # since categoricals always have ndim == 1, an axis parameter
        # doesnt make any sense here.
        codes = self.codes
        if codes.ndim > 1:
            raise NotImplementedError("Categorical with ndim > 1.")
        if np.prod(codes.shape) and (periods != 0):
            codes = np.roll(codes, _ensure_platform_int(periods), axis=0)
            if periods > 0:
                codes[:periods] = -1
            else:
                codes[periods:] = -1

        return self.from_codes(codes, categories=self.categories,
                               ordered=self.ordered)

    def __array__(self, dtype=None):
        """
        The numpy array interface.

        Returns
        -------
        values : numpy array
            A numpy array of either the specified dtype or,
            if dtype==None (default), the same dtype as
            categorical.categories.dtype
        """
        ret = take_1d(self.categories.values, self._codes)
        if dtype and not is_dtype_equal(dtype, self.categories.dtype):
            return np.asarray(ret, dtype)
        return ret

    def __setstate__(self, state):
        """Necessary for making this object picklable"""
        if not isinstance(state, dict):
            raise Exception('invalid pickle state')

        # Provide compatibility with pre-0.15.0 Categoricals.
        if '_categories' not in state and '_levels' in state:
            state['_categories'] = self._validate_categories(state.pop(
                '_levels'))
        if '_codes' not in state and 'labels' in state:
            state['_codes'] = coerce_indexer_dtype(
                state.pop('labels'), state['_categories'])

        # 0.16.0 ordered change
        if '_ordered' not in state:

            # >=15.0 < 0.16.0
            if 'ordered' in state:
                state['_ordered'] = state.pop('ordered')
            else:
                state['_ordered'] = False

        for k, v in compat.iteritems(state):
            setattr(self, k, v)

    @property
    def T(self):
        return self

    @property
    def nbytes(self):
        return self._codes.nbytes + self._categories.values.nbytes

    def memory_usage(self, deep=False):
        """
        Memory usage of my values

        Parameters
        ----------
        deep : bool
            Introspect the data deeply, interrogate
            `object` dtypes for system-level memory consumption

        Returns
        -------
        bytes used

        Notes
        -----
        Memory usage does not include memory consumed by elements that
        are not components of the array if deep=False

        See Also
        --------
        numpy.ndarray.nbytes
        """
        return self._codes.nbytes + self._categories.memory_usage(deep=deep)

    @Substitution(klass='Categorical')
    @Appender(_shared_docs['searchsorted'])
    @deprecate_kwarg(old_arg_name='v', new_arg_name='value')
    def searchsorted(self, value, side='left', sorter=None):
        if not self.ordered:
            raise ValueError("Categorical not ordered\nyou can use "
                             ".as_ordered() to change the Categorical to an "
                             "ordered one")

        from pandas.core.series import Series

        values_as_codes = _get_codes_for_values(Series(value).values,
                                                self.categories)

        if -1 in values_as_codes:
            raise ValueError("Value(s) to be inserted must be in categories.")

        return self.codes.searchsorted(values_as_codes, side=side,
                                       sorter=sorter)

    def isnull(self):
        """
        Detect missing values

        Both missing values (-1 in .codes) and NA as a category are detected.

        Returns
        -------
        a boolean array of whether my values are null

        See also
        --------
        isnull : pandas version
        Categorical.notnull : boolean inverse of Categorical.isnull

        """

        ret = self._codes == -1

        # String/object and float categories can hold np.nan
        if self.categories.dtype.kind in ['S', 'O', 'f']:
            if np.nan in self.categories:
                nan_pos = np.where(isnull(self.categories))[0]
                # we only have one NA in categories
                ret = np.logical_or(ret, self._codes == nan_pos)
        return ret

    def notnull(self):
        """
        Reverse of isnull

        Both missing values (-1 in .codes) and NA as a category are detected as
        null.

        Returns
        -------
        a boolean array of whether my values are not null

        See also
        --------
        notnull : pandas version
        Categorical.isnull : boolean inverse of Categorical.notnull

        """
        return ~self.isnull()

    def put(self, *args, **kwargs):
        """
        Replace specific elements in the Categorical with given values.
        """
        raise NotImplementedError(("'put' is not yet implemented "
                                   "for Categorical"))

    def dropna(self):
        """
        Return the Categorical without null values.

        Both missing values (-1 in .codes) and NA as a category are detected.
        NA is removed from the categories if present.

        Returns
        -------
        valid : Categorical
        """
        result = self[self.notnull()]
        if isnull(result.categories).any():
            result = result.remove_categories([np.nan])
        return result

    def value_counts(self, dropna=True):
        """
        Returns a Series containing counts of each category.

        Every category will have an entry, even those with a count of 0.

        Parameters
        ----------
        dropna : boolean, default True
            Don't include counts of NaN, even if NaN is a category.

        Returns
        -------
        counts : Series

        See Also
        --------
        Series.value_counts

        """
        from numpy import bincount
        from pandas.core.dtypes.missing import isnull
        from pandas.core.series import Series
        from pandas.core.index import CategoricalIndex

        obj = (self.remove_categories([np.nan]) if dropna and
               isnull(self.categories).any() else self)
        code, cat = obj._codes, obj.categories
        ncat, mask = len(cat), 0 <= code
        ix, clean = np.arange(ncat), mask.all()

        if dropna or clean:
            obs = code if clean else code[mask]
            count = bincount(obs, minlength=ncat or None)
        else:
            count = bincount(np.where(mask, code, ncat))
            ix = np.append(ix, -1)

        ix = self._constructor(ix, categories=cat, ordered=obj.ordered,
                               fastpath=True)

        return Series(count, index=CategoricalIndex(ix), dtype='int64')

    def get_values(self):
        """ Return the values.

        For internal compatibility with pandas formatting.

        Returns
        -------
        values : numpy array
            A numpy array of the same dtype as categorical.categories.dtype or
            Index if datetime / periods
        """
        # if we are a datetime and period index, return Index to keep metadata
        if is_datetimelike(self.categories):
            return self.categories.take(self._codes, fill_value=np.nan)
        return np.array(self)

    def check_for_ordered(self, op):
        """ assert that we are ordered """
        if not self.ordered:
            raise TypeError("Categorical is not ordered for operation {op}\n"
                            "you can use .as_ordered() to change the "
                            "Categorical to an ordered one\n".format(op=op))

    def argsort(self, ascending=True, *args, **kwargs):
        """
        Returns the indices that would sort the Categorical instance if
        'sort_values' was called. This function is implemented to provide
        compatibility with numpy ndarray objects.

        While an ordering is applied to the category values, arg-sorting
        in this context refers more to organizing and grouping together
        based on matching category values. Thus, this function can be
        called on an unordered Categorical instance unlike the functions
        'Categorical.min' and 'Categorical.max'.

        Returns
        -------
        argsorted : numpy array

        See also
        --------
        numpy.ndarray.argsort
        """
        ascending = nv.validate_argsort_with_ascending(ascending, args, kwargs)
        result = np.argsort(self._codes.copy(), **kwargs)
        if not ascending:
            result = result[::-1]
        return result

    def sort_values(self, inplace=False, ascending=True, na_position='last'):
        """ Sorts the Categorical by category value returning a new
        Categorical by default.

        While an ordering is applied to the category values, sorting in this
        context refers more to organizing and grouping together based on
        matching category values. Thus, this function can be called on an
        unordered Categorical instance unlike the functions 'Categorical.min'
        and 'Categorical.max'.

        Parameters
        ----------
        inplace : boolean, default False
            Do operation in place.
        ascending : boolean, default True
            Order ascending. Passing False orders descending. The
            ordering parameter provides the method by which the
            category values are organized.
        na_position : {'first', 'last'} (optional, default='last')
            'first' puts NaNs at the beginning
            'last' puts NaNs at the end

        Returns
        -------
        y : Categorical or None

        See Also
        --------
        Categorical.sort
        Series.sort_values

        Examples
        --------
        >>> c = pd.Categorical([1, 2, 2, 1, 5])
        >>> c
        [1, 2, 2, 1, 5]
        Categories (3, int64): [1, 2, 5]
        >>> c.sort_values()
        [1, 1, 2, 2, 5]
        Categories (3, int64): [1, 2, 5]
        >>> c.sort_values(ascending=False)
        [5, 2, 2, 1, 1]
        Categories (3, int64): [1, 2, 5]

        Inplace sorting can be done as well:

        >>> c.sort_values(inplace=True)
        >>> c
        [1, 1, 2, 2, 5]
        Categories (3, int64): [1, 2, 5]
        >>>
        >>> c = pd.Categorical([1, 2, 2, 1, 5])

        'sort_values' behaviour with NaNs. Note that 'na_position'
        is independent of the 'ascending' parameter:

        >>> c = pd.Categorical([np.nan, 2, 2, np.nan, 5])
        >>> c
        [NaN, 2.0, 2.0, NaN, 5.0]
        Categories (2, int64): [2, 5]
        >>> c.sort_values()
        [2.0, 2.0, 5.0, NaN, NaN]
        Categories (2, int64): [2, 5]
        >>> c.sort_values(ascending=False)
        [5.0, 2.0, 2.0, NaN, NaN]
        Categories (2, int64): [2, 5]
        >>> c.sort_values(na_position='first')
        [NaN, NaN, 2.0, 2.0, 5.0]
        Categories (2, int64): [2, 5]
        >>> c.sort_values(ascending=False, na_position='first')
        [NaN, NaN, 5.0, 2.0, 2.0]
        Categories (2, int64): [2, 5]
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if na_position not in ['last', 'first']:
            raise ValueError('invalid na_position: {!r}'.format(na_position))

        codes = np.sort(self._codes)
        if not ascending:
            codes = codes[::-1]

        # NaN handling
        na_mask = (codes == -1)
        if na_mask.any():
            n_nans = len(codes[na_mask])
            if na_position == "first":
                # in this case sort to the front
                new_codes = codes.copy()
                new_codes[0:n_nans] = -1
                new_codes[n_nans:] = codes[~na_mask]
                codes = new_codes
            elif na_position == "last":
                # ... and to the end
                new_codes = codes.copy()
                pos = len(codes) - n_nans
                new_codes[0:pos] = codes[~na_mask]
                new_codes[pos:] = -1
                codes = new_codes
        if inplace:
            self._codes = codes
            return
        else:
            return self._constructor(values=codes, categories=self.categories,
                                     ordered=self.ordered, fastpath=True)

    def _values_for_rank(self):
        """
        For correctly ranking ordered categorical data. See GH#15420

        Ordered categorical data should be ranked on the basis of
        codes with -1 translated to NaN.

        Returns
        -------
        numpy array

        """
        from pandas import Series
        if self.ordered:
            values = self.codes
            mask = values == -1
            if mask.any():
                values = values.astype('float64')
                values[mask] = np.nan
        elif self.categories.is_numeric():
            values = np.array(self)
        else:
            #  reorder the categories (so rank can use the float codes)
            #  instead of passing an object array to rank
            values = np.array(
                self.rename_categories(Series(self.categories).rank())
            )
        return values

    def order(self, inplace=False, ascending=True, na_position='last'):
        """
        DEPRECATED: use :meth:`Categorical.sort_values`. That function
        is entirely equivalent to this one.

        See Also
        --------
        Categorical.sort_values
        """
        warn("order is deprecated, use sort_values(...)", FutureWarning,
             stacklevel=2)
        return self.sort_values(inplace=inplace, ascending=ascending,
                                na_position=na_position)

    def sort(self, inplace=True, ascending=True, na_position='last', **kwargs):
        """
        DEPRECATED: use :meth:`Categorical.sort_values`. That function
        is just like this one, except that a new Categorical is returned
        by default, so make sure to pass in 'inplace=True' to get
        inplace sorting.

        See Also
        --------
        Categorical.sort_values
        """
        warn("sort is deprecated, use sort_values(...)", FutureWarning,
             stacklevel=2)
        nv.validate_sort(tuple(), kwargs)
        return self.sort_values(inplace=inplace, ascending=ascending,
                                na_position=na_position)

    def ravel(self, order='C'):
        """ Return a flattened (numpy) array.

        For internal compatibility with numpy arrays.

        Returns
        -------
        raveled : numpy array
        """
        return np.array(self)

    def view(self):
        """Return a view of myself.

        For internal compatibility with numpy arrays.

        Returns
        -------
        view : Categorical
           Returns `self`!
        """
        return self

    def to_dense(self):
        """Return my 'dense' representation

        For internal compatibility with numpy arrays.

        Returns
        -------
        dense : array
        """
        return np.asarray(self)

    @deprecate_kwarg(old_arg_name='fill_value', new_arg_name='value')
    def fillna(self, value=None, method=None, limit=None):
        """ Fill NA/NaN values using the specified method.

        Parameters
        ----------
        method : {'backfill', 'bfill', 'pad', 'ffill', None}, default None
            Method to use for filling holes in reindexed Series
            pad / ffill: propagate last valid observation forward to next valid
            backfill / bfill: use NEXT valid observation to fill gap
        value : scalar
            Value to use to fill holes (e.g. 0)
        limit : int, default None
            (Not implemented yet for Categorical!)
            If method is specified, this is the maximum number of consecutive
            NaN values to forward/backward fill. In other words, if there is
            a gap with more than this number of consecutive NaNs, it will only
            be partially filled. If method is not specified, this is the
            maximum number of entries along the entire axis where NaNs will be
            filled.

        Returns
        -------
        filled : Categorical with NA/NaN filled
        """

        if value is None:
            value = np.nan
        if limit is not None:
            raise NotImplementedError("specifying a limit for fillna has not "
                                      "been implemented yet")

        values = self._codes

        # Make sure that we also get NA in categories
        if self.categories.dtype.kind in ['S', 'O', 'f']:
            if np.nan in self.categories:
                values = values.copy()
                nan_pos = np.where(isnull(self.categories))[0]
                # we only have one NA in categories
                values[values == nan_pos] = -1

        # pad / bfill
        if method is not None:

            values = self.to_dense().reshape(-1, len(self))
            values = interpolate_2d(values, method, 0, None,
                                    value).astype(self.categories.dtype)[0]
            values = _get_codes_for_values(values, self.categories)

        else:

            if not isnull(value) and value not in self.categories:
                raise ValueError("fill value must be in categories")

            mask = values == -1
            if mask.any():
                values = values.copy()
                if isnull(value):
                    values[mask] = -1
                else:
                    values[mask] = self.categories.get_loc(value)

        return self._constructor(values, categories=self.categories,
                                 ordered=self.ordered, fastpath=True)

    def take_nd(self, indexer, allow_fill=True, fill_value=None):
        """ Take the codes by the indexer, fill with the fill_value.

        For internal compatibility with numpy arrays.
        """

        # filling must always be None/nan here
        # but is passed thru internally
        assert isnull(fill_value)

        codes = take_1d(self._codes, indexer, allow_fill=True, fill_value=-1)
        result = self._constructor(codes, categories=self.categories,
                                   ordered=self.ordered, fastpath=True)
        return result

    take = take_nd

    def _slice(self, slicer):
        """ Return a slice of myself.

        For internal compatibility with numpy arrays.
        """

        # only allow 1 dimensional slicing, but can
        # in a 2-d case be passd (slice(None),....)
        if isinstance(slicer, tuple) and len(slicer) == 2:
            if not is_null_slice(slicer[0]):
                raise AssertionError("invalid slicing for a 1-ndim "
                                     "categorical")
            slicer = slicer[1]

        _codes = self._codes[slicer]
        return self._constructor(values=_codes, categories=self.categories,
                                 ordered=self.ordered, fastpath=True)

    def __len__(self):
        """The length of this Categorical."""
        return len(self._codes)

    def __iter__(self):
        """Returns an Iterator over the values of this Categorical."""
        return iter(self.get_values())

    def _tidy_repr(self, max_vals=10, footer=True):
        """ a short repr displaying only max_vals and an optional (but default
        footer)
        """
        num = max_vals // 2
        head = self[:num]._get_repr(length=False, footer=False)
        tail = self[-(max_vals - num):]._get_repr(length=False, footer=False)

        result = '%s, ..., %s' % (head[:-1], tail[1:])
        if footer:
            result = '%s\n%s' % (result, self._repr_footer())

        return compat.text_type(result)

    def _repr_categories(self):
        """ return the base repr for the categories """
        max_categories = (10 if get_option("display.max_categories") == 0 else
                          get_option("display.max_categories"))
        from pandas.io.formats import format as fmt
        if len(self.categories) > max_categories:
            num = max_categories // 2
            head = fmt.format_array(self.categories[:num], None)
            tail = fmt.format_array(self.categories[-num:], None)
            category_strs = head + ["..."] + tail
        else:
            category_strs = fmt.format_array(self.categories, None)

        # Strip all leading spaces, which format_array adds for columns...
        category_strs = [x.strip() for x in category_strs]
        return category_strs

    def _repr_categories_info(self):
        """ Returns a string representation of the footer."""

        category_strs = self._repr_categories()
        dtype = getattr(self.categories, 'dtype_str',
                        str(self.categories.dtype))

        levheader = "Categories (%d, %s): " % (len(self.categories), dtype)
        width, height = get_terminal_size()
        max_width = get_option("display.width") or width
        if com.in_ipython_frontend():
            # 0 = no breaks
            max_width = 0
        levstring = ""
        start = True
        cur_col_len = len(levheader)  # header
        sep_len, sep = (3, " < ") if self.ordered else (2, ", ")
        linesep = sep.rstrip() + "\n"  # remove whitespace
        for val in category_strs:
            if max_width != 0 and cur_col_len + sep_len + len(val) > max_width:
                levstring += linesep + (" " * (len(levheader) + 1))
                cur_col_len = len(levheader) + 1  # header + a whitespace
            elif not start:
                levstring += sep
                cur_col_len += len(val)
            levstring += val
            start = False
        # replace to simple save space by
        return levheader + "[" + levstring.replace(" < ... < ", " ... ") + "]"

    def _repr_footer(self):

        return u('Length: %d\n%s') % (len(self), self._repr_categories_info())

    def _get_repr(self, length=True, na_rep='NaN', footer=True):
        from pandas.io.formats import format as fmt
        formatter = fmt.CategoricalFormatter(self, length=length,
                                             na_rep=na_rep, footer=footer)
        result = formatter.to_string()
        return compat.text_type(result)

    def __unicode__(self):
        """ Unicode representation. """
        _maxlen = 10
        if len(self._codes) > _maxlen:
            result = self._tidy_repr(_maxlen)
        elif len(self._codes) > 0:
            result = self._get_repr(length=len(self) > _maxlen)
        else:
            result = ('[], %s' %
                      self._get_repr(length=False,
                                     footer=True, ).replace("\n", ", "))

        return result

    def _maybe_coerce_indexer(self, indexer):
        """ return an indexer coerced to the codes dtype """
        if isinstance(indexer, np.ndarray) and indexer.dtype.kind == 'i':
            indexer = indexer.astype(self._codes.dtype)
        return indexer

    def __getitem__(self, key):
        """ Return an item. """
        if isinstance(key, (int, np.integer)):
            i = self._codes[key]
            if i == -1:
                return np.nan
            else:
                return self.categories[i]
        else:
            return self._constructor(values=self._codes[key],
                                     categories=self.categories,
                                     ordered=self.ordered, fastpath=True)

    def __setitem__(self, key, value):
        """ Item assignment.


        Raises
        ------
        ValueError
            If (one or more) Value is not in categories or if a assigned
            `Categorical` does not have the same categories
        """

        # require identical categories set
        if isinstance(value, Categorical):
            if not value.categories.equals(self.categories):
                raise ValueError("Cannot set a Categorical with another, "
                                 "without identical categories")

        rvalue = value if is_list_like(value) else [value]

        from pandas import Index
        to_add = Index(rvalue).difference(self.categories)

        # no assignments of values not in categories, but it's always ok to set
        # something to np.nan
        if len(to_add) and not isnull(to_add).all():
            raise ValueError("Cannot setitem on a Categorical with a new "
                             "category, set the categories first")

        # set by position
        if isinstance(key, (int, np.integer)):
            pass

        # tuple of indexers (dataframe)
        elif isinstance(key, tuple):
            # only allow 1 dimensional slicing, but can
            # in a 2-d case be passd (slice(None),....)
            if len(key) == 2:
                if not is_null_slice(key[0]):
                    raise AssertionError("invalid slicing for a 1-ndim "
                                         "categorical")
                key = key[1]
            elif len(key) == 1:
                key = key[0]
            else:
                raise AssertionError("invalid slicing for a 1-ndim "
                                     "categorical")

        # slicing in Series or Categorical
        elif isinstance(key, slice):
            pass

        # Array of True/False in Series or Categorical
        else:
            # There is a bug in numpy, which does not accept a Series as a
            # indexer
            # https://github.com/pandas-dev/pandas/issues/6168
            # https://github.com/numpy/numpy/issues/4240 -> fixed in numpy 1.9
            # FIXME: remove when numpy 1.9 is the lowest numpy version pandas
            # accepts...
            key = np.asarray(key)

        lindexer = self.categories.get_indexer(rvalue)

        # FIXME: the following can be removed after GH7820 is fixed:
        # https://github.com/pandas-dev/pandas/issues/7820
        # float categories do currently return -1 for np.nan, even if np.nan is
        # included in the index -> "repair" this here
        if isnull(rvalue).any() and isnull(self.categories).any():
            nan_pos = np.where(isnull(self.categories))[0]
            lindexer[lindexer == -1] = nan_pos

        lindexer = self._maybe_coerce_indexer(lindexer)
        self._codes[key] = lindexer

    def _reverse_indexer(self):
        """
        Compute the inverse of a categorical, returning
        a dict of categories -> indexers.

        *This is an internal function*

        Returns
        -------
        dict of categories -> indexers

        Example
        -------
        In [1]: c = pd.Categorical(list('aabca'))

        In [2]: c
        Out[2]:
        [a, a, b, c, a]
        Categories (3, object): [a, b, c]

        In [3]: c.categories
        Out[3]: Index([u'a', u'b', u'c'], dtype='object')

        In [4]: c.codes
        Out[4]: array([0, 0, 1, 2, 0], dtype=int8)

        In [5]: c._reverse_indexer()
        Out[5]: {'a': array([0, 1, 4]), 'b': array([2]), 'c': array([3])}

        """
        categories = self.categories
        r, counts = libalgos.groupsort_indexer(self.codes.astype('int64'),
                                               categories.size)
        counts = counts.cumsum()
        result = [r[counts[indexer]:counts[indexer + 1]]
                  for indexer in range(len(counts) - 1)]
        result = dict(zip(categories, result))
        return result

    # reduction ops #
    def _reduce(self, op, name, axis=0, skipna=True, numeric_only=None,
                filter_type=None, **kwds):
        """ perform the reduction type operation """
        func = getattr(self, name, None)
        if func is None:
            raise TypeError("Categorical cannot perform the operation "
                            "{op}".format(op=name))
        return func(numeric_only=numeric_only, **kwds)

    def min(self, numeric_only=None, **kwargs):
        """ The minimum value of the object.

        Only ordered `Categoricals` have a minimum!

        Raises
        ------
        TypeError
            If the `Categorical` is not `ordered`.

        Returns
        -------
        min : the minimum of this `Categorical`
        """
        self.check_for_ordered('min')
        if numeric_only:
            good = self._codes != -1
            pointer = self._codes[good].min(**kwargs)
        else:
            pointer = self._codes.min(**kwargs)
        if pointer == -1:
            return np.nan
        else:
            return self.categories[pointer]

    def max(self, numeric_only=None, **kwargs):
        """ The maximum value of the object.

        Only ordered `Categoricals` have a maximum!

        Raises
        ------
        TypeError
            If the `Categorical` is not `ordered`.

        Returns
        -------
        max : the maximum of this `Categorical`
        """
        self.check_for_ordered('max')
        if numeric_only:
            good = self._codes != -1
            pointer = self._codes[good].max(**kwargs)
        else:
            pointer = self._codes.max(**kwargs)
        if pointer == -1:
            return np.nan
        else:
            return self.categories[pointer]

    def mode(self):
        """
        Returns the mode(s) of the Categorical.

        Always returns `Categorical` even if only one value.

        Returns
        -------
        modes : `Categorical` (sorted)
        """

        import pandas._libs.hashtable as htable
        good = self._codes != -1
        values = sorted(htable.mode_int64(_ensure_int64(self._codes[good])))
        result = self._constructor(values=values, categories=self.categories,
                                   ordered=self.ordered, fastpath=True)
        return result

    def unique(self):
        """
        Return the ``Categorical`` which ``categories`` and ``codes`` are
        unique. Unused categories are NOT returned.

        - unordered category: values and categories are sorted by appearance
          order.
        - ordered category: values are sorted by appearance order, categories
          keeps existing order.

        Returns
        -------
        unique values : ``Categorical``

        Examples
        --------
        An unordered Categorical will return categories in the
        order of appearance.

        >>> pd.Categorical(list('baabc'))
        [b, a, c]
        Categories (3, object): [b, a, c]

        >>> pd.Categorical(list('baabc'), categories=list('abc'))
        [b, a, c]
        Categories (3, object): [b, a, c]

        An ordered Categorical preserves the category ordering.

        >>> pd.Categorical(list('baabc'),
        ...                categories=list('abc'),
        ...                ordered=True)
        [b, a, c]
        Categories (3, object): [a < b < c]

        See Also
        --------
        unique
        CategoricalIndex.unique
        Series.unique

        """

        # unlike np.unique, unique1d does not sort
        unique_codes = unique1d(self.codes)
        cat = self.copy()

        # keep nan in codes
        cat._codes = unique_codes

        # exclude nan from indexer for categories
        take_codes = unique_codes[unique_codes != -1]
        if self.ordered:
            take_codes = sorted(take_codes)
        return cat.set_categories(cat.categories.take(take_codes))

    def equals(self, other):
        """
        Returns True if categorical arrays are equal.

        Parameters
        ----------
        other : `Categorical`

        Returns
        -------
        are_equal : boolean
        """
        return (self.is_dtype_equal(other) and
                np.array_equal(self._codes, other._codes))

    def is_dtype_equal(self, other):
        """
        Returns True if categoricals are the same dtype
          same categories, and same ordered

        Parameters
        ----------
        other : Categorical

        Returns
        -------
        are_equal : boolean
        """

        try:
            return (self.categories.equals(other.categories) and
                    self.ordered == other.ordered)
        except (AttributeError, TypeError):
            return False

    def describe(self):
        """ Describes this Categorical

        Returns
        -------
        description: `DataFrame`
            A dataframe with frequency and counts by category.
        """
        counts = self.value_counts(dropna=False)
        freqs = counts / float(counts.sum())

        from pandas.core.reshape.concat import concat
        result = concat([counts, freqs], axis=1)
        result.columns = ['counts', 'freqs']
        result.index.name = 'categories'

        return result

    def repeat(self, repeats, *args, **kwargs):
        """
        Repeat elements of a Categorical.

        See also
        --------
        numpy.ndarray.repeat

        """
        nv.validate_repeat(args, kwargs)
        codes = self._codes.repeat(repeats)
        return self._constructor(values=codes, categories=self.categories,
                                 ordered=self.ordered, fastpath=True)

# The Series.cat accessor


class CategoricalAccessor(PandasDelegate, NoNewAttributesMixin):
    """
    Accessor object for categorical properties of the Series values.

    Be aware that assigning to `categories` is a inplace operation, while all
    methods return new categorical data per default (but can be called with
    `inplace=True`).

    Examples
    --------
    >>> s.cat.categories
    >>> s.cat.categories = list('abc')
    >>> s.cat.rename_categories(list('cab'))
    >>> s.cat.reorder_categories(list('cab'))
    >>> s.cat.add_categories(['d','e'])
    >>> s.cat.remove_categories(['d'])
    >>> s.cat.remove_unused_categories()
    >>> s.cat.set_categories(list('abcde'))
    >>> s.cat.as_ordered()
    >>> s.cat.as_unordered()

    """

    def __init__(self, values, index):
        self.categorical = values
        self.index = index
        self._freeze()

    def _delegate_property_get(self, name):
        return getattr(self.categorical, name)

    def _delegate_property_set(self, name, new_values):
        return setattr(self.categorical, name, new_values)

    @property
    def codes(self):
        from pandas import Series
        return Series(self.categorical.codes, index=self.index)

    def _delegate_method(self, name, *args, **kwargs):
        from pandas import Series
        method = getattr(self.categorical, name)
        res = method(*args, **kwargs)
        if res is not None:
            return Series(res, index=self.index)


CategoricalAccessor._add_delegate_accessors(delegate=Categorical,
                                            accessors=["categories",
                                                       "ordered"],
                                            typ='property')
CategoricalAccessor._add_delegate_accessors(delegate=Categorical, accessors=[
    "rename_categories", "reorder_categories", "add_categories",
    "remove_categories", "remove_unused_categories", "set_categories",
    "as_ordered", "as_unordered"], typ='method')

# utility routines


def _get_codes_for_values(values, categories):
    """
    utility routine to turn values into codes given the specified categories
    """

    from pandas.core.algorithms import _get_data_algo, _hashtables
    if not is_dtype_equal(values.dtype, categories.dtype):
        values = _ensure_object(values)
        categories = _ensure_object(categories)

    (hash_klass, vec_klass), vals = _get_data_algo(values, _hashtables)
    (_, _), cats = _get_data_algo(categories, _hashtables)
    t = hash_klass(len(cats))
    t.map_locations(cats)
    return coerce_indexer_dtype(t.lookup(vals), cats)


def _convert_to_list_like(list_like):
    if hasattr(list_like, "dtype"):
        return list_like
    if isinstance(list_like, list):
        return list_like
    if (is_sequence(list_like) or isinstance(list_like, tuple) or
            isinstance(list_like, types.GeneratorType)):
        return list(list_like)
    elif is_scalar(list_like):
        return [list_like]
    else:
        # is this reached?
        return [list_like]


def _factorize_from_iterable(values):
    """
    Factorize an input `values` into `categories` and `codes`. Preserves
    categorical dtype in `categories`.

    *This is an internal function*

    Parameters
    ----------
    values : list-like

    Returns
    -------
    codes : ndarray
    categories : Index
        If `values` has a categorical dtype, then `categories` is
        a CategoricalIndex keeping the categories and order of `values`.
    """
    from pandas.core.indexes.category import CategoricalIndex

    if not is_list_like(values):
        raise TypeError("Input must be list-like")

    if is_categorical(values):
        if isinstance(values, (ABCCategoricalIndex, ABCSeries)):
            values = values._values
        categories = CategoricalIndex(values.categories,
                                      categories=values.categories,
                                      ordered=values.ordered)
        codes = values.codes
    else:
        cat = Categorical(values, ordered=True)
        categories = cat.categories
        codes = cat.codes
    return codes, categories


def _factorize_from_iterables(iterables):
    """
    A higher-level wrapper over `_factorize_from_iterable`.

    *This is an internal function*

    Parameters
    ----------
    iterables : list-like of list-likes

    Returns
    -------
    codes_list : list of ndarrays
    categories_list : list of Indexes

    Notes
    -----
    See `_factorize_from_iterable` for more info.
    """
    if len(iterables) == 0:
        # For consistency, it should return a list of 2 lists.
        return [[], []]
    return map(list, lzip(*[_factorize_from_iterable(it) for it in iterables]))
