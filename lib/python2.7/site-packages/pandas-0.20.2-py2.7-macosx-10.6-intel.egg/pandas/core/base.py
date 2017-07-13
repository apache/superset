"""
Base and utility classes for pandas objects.
"""
import warnings
from pandas import compat
from pandas.compat import builtins
import numpy as np

from pandas.core.dtypes.missing import isnull
from pandas.core.dtypes.generic import ABCDataFrame, ABCSeries, ABCIndexClass
from pandas.core.dtypes.common import is_object_dtype, is_list_like, is_scalar
from pandas.util._validators import validate_bool_kwarg

from pandas.core import common as com
import pandas.core.nanops as nanops
import pandas._libs.lib as lib
from pandas.compat.numpy import function as nv
from pandas.util._decorators import (Appender, cache_readonly,
                                     deprecate_kwarg, Substitution)
from pandas.core.common import AbstractMethodError

_shared_docs = dict()
_indexops_doc_kwargs = dict(klass='IndexOpsMixin', inplace='',
                            unique='IndexOpsMixin', duplicated='IndexOpsMixin')


class StringMixin(object):
    """implements string methods so long as object defines a `__unicode__`
    method.

    Handles Python2/3 compatibility transparently.
    """
    # side note - this could be made into a metaclass if more than one
    #             object needs

    # ----------------------------------------------------------------------
    # Formatting

    def __unicode__(self):
        raise AbstractMethodError(self)

    def __str__(self):
        """
        Return a string representation for a particular Object

        Invoked by str(df) in both py2/py3.
        Yields Bytestring in Py2, Unicode String in py3.
        """

        if compat.PY3:
            return self.__unicode__()
        return self.__bytes__()

    def __bytes__(self):
        """
        Return a string representation for a particular object.

        Invoked by bytes(obj) in py3 only.
        Yields a bytestring in both py2/py3.
        """
        from pandas.core.config import get_option

        encoding = get_option("display.encoding")
        return self.__unicode__().encode(encoding, 'replace')

    def __repr__(self):
        """
        Return a string representation for a particular object.

        Yields Bytestring in Py2, Unicode String in py3.
        """
        return str(self)


class PandasObject(StringMixin):

    """baseclass for various pandas objects"""

    @property
    def _constructor(self):
        """class constructor (for this class it's just `__class__`"""
        return self.__class__

    def __unicode__(self):
        """
        Return a string representation for a particular object.

        Invoked by unicode(obj) in py2 only. Yields a Unicode String in both
        py2/py3.
        """
        # Should be overwritten by base classes
        return object.__repr__(self)

    def _dir_additions(self):
        """ add addtional __dir__ for this object """
        return set()

    def _dir_deletions(self):
        """ delete unwanted __dir__ for this object """
        return set()

    def __dir__(self):
        """
        Provide method name lookup and completion
        Only provide 'public' methods
        """
        rv = set(dir(type(self)))
        rv = (rv - self._dir_deletions()) | self._dir_additions()
        return sorted(rv)

    def _reset_cache(self, key=None):
        """
        Reset cached properties. If ``key`` is passed, only clears that key.
        """
        if getattr(self, '_cache', None) is None:
            return
        if key is None:
            self._cache.clear()
        else:
            self._cache.pop(key, None)

    def __sizeof__(self):
        """
        Generates the total memory usage for a object that returns
        either a value or Series of values
        """
        if hasattr(self, 'memory_usage'):
            mem = self.memory_usage(deep=True)
            if not is_scalar(mem):
                mem = mem.sum()
            return int(mem)

        # no memory_usage attribute, so fall back to
        # object's 'sizeof'
        return super(PandasObject, self).__sizeof__()


class NoNewAttributesMixin(object):
    """Mixin which prevents adding new attributes.

    Prevents additional attributes via xxx.attribute = "something" after a
    call to `self.__freeze()`. Mainly used to prevent the user from using
    wrong attrirbutes on a accessor (`Series.cat/.str/.dt`).

    If you really want to add a new attribute at a later time, you need to use
    `object.__setattr__(self, key, value)`.
    """

    def _freeze(self):
        """Prevents setting additional attributes"""
        object.__setattr__(self, "__frozen", True)

    # prevent adding any attribute via s.xxx.new_attribute = ...
    def __setattr__(self, key, value):
        # _cache is used by a decorator
        # dict lookup instead of getattr as getattr is false for getter
        # which error
        if getattr(self, "__frozen", False) and not \
                (key in type(self).__dict__ or key == "_cache"):
            raise AttributeError("You cannot add any new attribute '{key}'".
                                 format(key=key))
        object.__setattr__(self, key, value)


class PandasDelegate(PandasObject):
    """ an abstract base class for delegating methods/properties """

    def _delegate_property_get(self, name, *args, **kwargs):
        raise TypeError("You cannot access the "
                        "property {name}".format(name=name))

    def _delegate_property_set(self, name, value, *args, **kwargs):
        raise TypeError("The property {name} cannot be set".format(name=name))

    def _delegate_method(self, name, *args, **kwargs):
        raise TypeError("You cannot call method {name}".format(name=name))

    @classmethod
    def _add_delegate_accessors(cls, delegate, accessors, typ,
                                overwrite=False):
        """
        add accessors to cls from the delegate class

        Parameters
        ----------
        cls : the class to add the methods/properties to
        delegate : the class to get methods/properties & doc-strings
        acccessors : string list of accessors to add
        typ : 'property' or 'method'
        overwrite : boolean, default False
           overwrite the method/property in the target class if it exists
        """

        def _create_delegator_property(name):

            def _getter(self):
                return self._delegate_property_get(name)

            def _setter(self, new_values):
                return self._delegate_property_set(name, new_values)

            _getter.__name__ = name
            _setter.__name__ = name

            return property(fget=_getter, fset=_setter,
                            doc=getattr(delegate, name).__doc__)

        def _create_delegator_method(name):

            def f(self, *args, **kwargs):
                return self._delegate_method(name, *args, **kwargs)

            f.__name__ = name
            f.__doc__ = getattr(delegate, name).__doc__

            return f

        for name in accessors:

            if typ == 'property':
                f = _create_delegator_property(name)
            else:
                f = _create_delegator_method(name)

            # don't overwrite existing methods/properties
            if overwrite or not hasattr(cls, name):
                setattr(cls, name, f)


class AccessorProperty(object):
    """Descriptor for implementing accessor properties like Series.str
    """

    def __init__(self, accessor_cls, construct_accessor):
        self.accessor_cls = accessor_cls
        self.construct_accessor = construct_accessor
        self.__doc__ = accessor_cls.__doc__

    def __get__(self, instance, owner=None):
        if instance is None:
            # this ensures that Series.str.<method> is well defined
            return self.accessor_cls
        return self.construct_accessor(instance)

    def __set__(self, instance, value):
        raise AttributeError("can't set attribute")

    def __delete__(self, instance):
        raise AttributeError("can't delete attribute")


class GroupByError(Exception):
    pass


class DataError(GroupByError):
    pass


class SpecificationError(GroupByError):
    pass


class SelectionMixin(object):
    """
    mixin implementing the selection & aggregation interface on a group-like
    object sub-classes need to define: obj, exclusions
    """
    _selection = None
    _internal_names = ['_cache', '__setstate__']
    _internal_names_set = set(_internal_names)
    _builtin_table = {
        builtins.sum: np.sum,
        builtins.max: np.max,
        builtins.min: np.min
    }
    _cython_table = {
        builtins.sum: 'sum',
        builtins.max: 'max',
        builtins.min: 'min',
        np.sum: 'sum',
        np.mean: 'mean',
        np.prod: 'prod',
        np.std: 'std',
        np.var: 'var',
        np.median: 'median',
        np.max: 'max',
        np.min: 'min',
        np.cumprod: 'cumprod',
        np.cumsum: 'cumsum'
    }

    @property
    def _selection_name(self):
        """
        return a name for myself; this would ideally be called
        the 'name' property, but we cannot conflict with the
        Series.name property which can be set
        """
        if self._selection is None:
            return None  # 'result'
        else:
            return self._selection

    @property
    def _selection_list(self):
        if not isinstance(self._selection, (list, tuple, ABCSeries,
                                            ABCIndexClass, np.ndarray)):
            return [self._selection]
        return self._selection

    @cache_readonly
    def _selected_obj(self):

        if self._selection is None or isinstance(self.obj, ABCSeries):
            return self.obj
        else:
            return self.obj[self._selection]

    @cache_readonly
    def ndim(self):
        return self._selected_obj.ndim

    @cache_readonly
    def _obj_with_exclusions(self):
        if self._selection is not None and isinstance(self.obj,
                                                      ABCDataFrame):
            return self.obj.reindex(columns=self._selection_list)

        if len(self.exclusions) > 0:
            return self.obj.drop(self.exclusions, axis=1)
        else:
            return self.obj

    def __getitem__(self, key):
        if self._selection is not None:
            raise Exception('Column(s) %s already selected' % self._selection)

        if isinstance(key, (list, tuple, ABCSeries, ABCIndexClass,
                            np.ndarray)):
            if len(self.obj.columns.intersection(key)) != len(key):
                bad_keys = list(set(key).difference(self.obj.columns))
                raise KeyError("Columns not found: %s"
                               % str(bad_keys)[1:-1])
            return self._gotitem(list(key), ndim=2)

        elif not getattr(self, 'as_index', False):
            if key not in self.obj.columns:
                raise KeyError("Column not found: %s" % key)
            return self._gotitem(key, ndim=2)

        else:
            if key not in self.obj:
                raise KeyError("Column not found: %s" % key)
            return self._gotitem(key, ndim=1)

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
        raise AbstractMethodError(self)

    def aggregate(self, func, *args, **kwargs):
        raise AbstractMethodError(self)

    agg = aggregate

    def _try_aggregate_string_function(self, arg, *args, **kwargs):
        """
        if arg is a string, then try to operate on it:
        - try to find a function (or attribute) on ourselves
        - try to find a numpy function
        - raise

        """
        assert isinstance(arg, compat.string_types)

        f = getattr(self, arg, None)
        if f is not None:
            if callable(f):
                return f(*args, **kwargs)

            # people may try to aggregate on a non-callable attribute
            # but don't let them think they can pass args to it
            assert len(args) == 0
            assert len([kwarg for kwarg in kwargs
                        if kwarg not in ['axis', '_level']]) == 0
            return f

        f = getattr(np, arg, None)
        if f is not None:
            return f(self, *args, **kwargs)

        raise ValueError("{} is an unknown string function".format(arg))

    def _aggregate(self, arg, *args, **kwargs):
        """
        provide an implementation for the aggregators

        Parameters
        ----------
        arg : string, dict, function
        *args : args to pass on to the function
        **kwargs : kwargs to pass on to the function

        Returns
        -------
        tuple of result, how

        Notes
        -----
        how can be a string describe the required post-processing, or
        None if not required
        """
        is_aggregator = lambda x: isinstance(x, (list, tuple, dict))
        is_nested_renamer = False

        _axis = kwargs.pop('_axis', None)
        if _axis is None:
            _axis = getattr(self, 'axis', 0)
        _level = kwargs.pop('_level', None)

        if isinstance(arg, compat.string_types):
            return self._try_aggregate_string_function(arg, *args,
                                                       **kwargs), None

        if isinstance(arg, dict):

            # aggregate based on the passed dict
            if _axis != 0:  # pragma: no cover
                raise ValueError('Can only pass dict with axis=0')

            obj = self._selected_obj

            def nested_renaming_depr(level=4):
                # deprecation of nested renaming
                # GH 15931
                warnings.warn(
                    ("using a dict with renaming "
                     "is deprecated and will be removed in a future "
                     "version"),
                    FutureWarning, stacklevel=level)

            # if we have a dict of any non-scalars
            # eg. {'A' : ['mean']}, normalize all to
            # be list-likes
            if any(is_aggregator(x) for x in compat.itervalues(arg)):
                new_arg = compat.OrderedDict()
                for k, v in compat.iteritems(arg):
                    if not isinstance(v, (tuple, list, dict)):
                        new_arg[k] = [v]
                    else:
                        new_arg[k] = v

                    # the keys must be in the columns
                    # for ndim=2, or renamers for ndim=1

                    # ok for now, but deprecated
                    # {'A': { 'ra': 'mean' }}
                    # {'A': { 'ra': ['mean'] }}
                    # {'ra': ['mean']}

                    # not ok
                    # {'ra' : { 'A' : 'mean' }}
                    if isinstance(v, dict):
                        is_nested_renamer = True

                        if k not in obj.columns:
                            raise SpecificationError('cannot perform renaming '
                                                     'for {0} with a nested '
                                                     'dictionary'.format(k))
                        nested_renaming_depr(4 + (_level or 0))

                    elif isinstance(obj, ABCSeries):
                        nested_renaming_depr()

                arg = new_arg

            else:
                # deprecation of renaming keys
                # GH 15931
                keys = list(compat.iterkeys(arg))
                if (isinstance(obj, ABCDataFrame) and
                        len(obj.columns.intersection(keys)) != len(keys)):
                    nested_renaming_depr()

            from pandas.core.reshape.concat import concat

            def _agg_1dim(name, how, subset=None):
                """
                aggregate a 1-dim with how
                """
                colg = self._gotitem(name, ndim=1, subset=subset)
                if colg.ndim != 1:
                    raise SpecificationError("nested dictionary is ambiguous "
                                             "in aggregation")
                return colg.aggregate(how, _level=(_level or 0) + 1)

            def _agg_2dim(name, how):
                """
                aggregate a 2-dim with how
                """
                colg = self._gotitem(self._selection, ndim=2,
                                     subset=obj)
                return colg.aggregate(how, _level=None)

            def _agg(arg, func):
                """
                run the aggregations over the arg with func
                return an OrderedDict
                """
                result = compat.OrderedDict()
                for fname, agg_how in compat.iteritems(arg):
                    result[fname] = func(fname, agg_how)
                return result

            # set the final keys
            keys = list(compat.iterkeys(arg))
            result = compat.OrderedDict()

            # nested renamer
            if is_nested_renamer:
                result = list(_agg(arg, _agg_1dim).values())

                if all(isinstance(r, dict) for r in result):

                    result, results = compat.OrderedDict(), result
                    for r in results:
                        result.update(r)
                    keys = list(compat.iterkeys(result))

                else:

                    if self._selection is not None:
                        keys = None

            # some selection on the object
            elif self._selection is not None:

                sl = set(self._selection_list)

                # we are a Series like object,
                # but may have multiple aggregations
                if len(sl) == 1:

                    result = _agg(arg, lambda fname,
                                  agg_how: _agg_1dim(self._selection, agg_how))

                # we are selecting the same set as we are aggregating
                elif not len(sl - set(keys)):

                    result = _agg(arg, _agg_1dim)

                # we are a DataFrame, with possibly multiple aggregations
                else:

                    result = _agg(arg, _agg_2dim)

            # no selection
            else:

                try:
                    result = _agg(arg, _agg_1dim)
                except SpecificationError:

                    # we are aggregating expecting all 1d-returns
                    # but we have 2d
                    result = _agg(arg, _agg_2dim)

            # combine results

            def is_any_series():
                # return a boolean if we have *any* nested series
                return any([isinstance(r, ABCSeries)
                            for r in compat.itervalues(result)])

            def is_any_frame():
                # return a boolean if we have *any* nested series
                return any([isinstance(r, ABCDataFrame)
                            for r in compat.itervalues(result)])

            if isinstance(result, list):
                return concat(result, keys=keys, axis=1), True

            elif is_any_frame():
                # we have a dict of DataFrames
                # return a MI DataFrame

                return concat([result[k] for k in keys],
                              keys=keys, axis=1), True

            elif isinstance(self, ABCSeries) and is_any_series():

                # we have a dict of Series
                # return a MI Series
                try:
                    result = concat(result)
                except TypeError:
                    # we want to give a nice error here if
                    # we have non-same sized objects, so
                    # we don't automatically broadcast

                    raise ValueError("cannot perform both aggregation "
                                     "and transformation operations "
                                     "simultaneously")

                return result, True

            # fall thru
            from pandas import DataFrame, Series
            try:
                result = DataFrame(result)
            except ValueError:

                # we have a dict of scalars
                result = Series(result,
                                name=getattr(self, 'name', None))

            return result, True
        elif is_list_like(arg) and arg not in compat.string_types:
            # we require a list, but not an 'str'
            return self._aggregate_multiple_funcs(arg,
                                                  _level=_level,
                                                  _axis=_axis), None
        else:
            result = None

        f = self._is_cython_func(arg)
        if f and not args and not kwargs:
            return getattr(self, f)(), None

        # caller can react
        return result, True

    def _aggregate_multiple_funcs(self, arg, _level, _axis):
        from pandas.core.reshape.concat import concat

        if _axis != 0:
            raise NotImplementedError("axis other than 0 is not supported")

        if self._selected_obj.ndim == 1:
            obj = self._selected_obj
        else:
            obj = self._obj_with_exclusions

        results = []
        keys = []

        # degenerate case
        if obj.ndim == 1:
            for a in arg:
                try:
                    colg = self._gotitem(obj.name, ndim=1, subset=obj)
                    results.append(colg.aggregate(a))

                    # make sure we find a good name
                    name = com._get_callable_name(a) or a
                    keys.append(name)
                except (TypeError, DataError):
                    pass
                except SpecificationError:
                    raise

        # multiples
        else:
            for col in obj:
                try:
                    colg = self._gotitem(col, ndim=1, subset=obj[col])
                    results.append(colg.aggregate(arg))
                    keys.append(col)
                except (TypeError, DataError):
                    pass
                except ValueError:
                    # cannot aggregate
                    continue
                except SpecificationError:
                    raise

        # if we are empty
        if not len(results):
            raise ValueError("no results")

        try:
            return concat(results, keys=keys, axis=1)
        except TypeError:

            # we are concatting non-NDFrame objects,
            # e.g. a list of scalars

            from pandas.core.dtypes.cast import is_nested_object
            from pandas import Series
            result = Series(results, index=keys, name=self.name)
            if is_nested_object(result):
                raise ValueError("cannot combine transform and "
                                 "aggregation operations")
            return result

    def _shallow_copy(self, obj=None, obj_type=None, **kwargs):
        """ return a new object with the replacement attributes """
        if obj is None:
            obj = self._selected_obj.copy()
        if obj_type is None:
            obj_type = self._constructor
        if isinstance(obj, obj_type):
            obj = obj.obj
        for attr in self._attributes:
            if attr not in kwargs:
                kwargs[attr] = getattr(self, attr)
        return obj_type(obj, **kwargs)

    def _is_cython_func(self, arg):
        """ if we define an internal function for this argument, return it """
        return self._cython_table.get(arg)

    def _is_builtin_func(self, arg):
        """
        if we define an builtin function for this argument, return it,
        otherwise return the arg
        """
        return self._builtin_table.get(arg, arg)


class GroupByMixin(object):
    """ provide the groupby facilities to the mixed object """

    @staticmethod
    def _dispatch(name, *args, **kwargs):
        """ dispatch to apply """

        def outer(self, *args, **kwargs):
            def f(x):
                x = self._shallow_copy(x, groupby=self._groupby)
                return getattr(x, name)(*args, **kwargs)
            return self._groupby.apply(f)
        outer.__name__ = name
        return outer

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

        # create a new object to prevent aliasing
        if subset is None:
            subset = self.obj

        # we need to make a shallow copy of ourselves
        # with the same groupby
        kwargs = dict([(attr, getattr(self, attr))
                       for attr in self._attributes])
        self = self.__class__(subset,
                              groupby=self._groupby[key],
                              parent=self,
                              **kwargs)
        self._reset_cache()
        if subset.ndim == 2:
            if is_scalar(key) and key in subset or is_list_like(key):
                self._selection = key
        return self


class IndexOpsMixin(object):
    """ common ops mixin to support a unified inteface / docs for Series /
    Index
    """

    # ndarray compatibility
    __array_priority__ = 1000

    def transpose(self, *args, **kwargs):
        """ return the transpose, which is by definition self """
        nv.validate_transpose(args, kwargs)
        return self

    T = property(transpose, doc="return the transpose, which is by "
                                "definition self")

    @property
    def shape(self):
        """ return a tuple of the shape of the underlying data """
        return self._values.shape

    @property
    def ndim(self):
        """ return the number of dimensions of the underlying data,
        by definition 1
        """
        return 1

    def item(self):
        """ return the first element of the underlying data as a python
        scalar
        """
        try:
            return self.values.item()
        except IndexError:
            # copy numpy's message here because Py26 raises an IndexError
            raise ValueError('can only convert an array of size 1 to a '
                             'Python scalar')

    @property
    def data(self):
        """ return the data pointer of the underlying data """
        return self.values.data

    @property
    def itemsize(self):
        """ return the size of the dtype of the item of the underlying data """
        return self._values.itemsize

    @property
    def nbytes(self):
        """ return the number of bytes in the underlying data """
        return self._values.nbytes

    @property
    def strides(self):
        """ return the strides of the underlying data """
        return self._values.strides

    @property
    def size(self):
        """ return the number of elements in the underlying data """
        return self._values.size

    @property
    def flags(self):
        """ return the ndarray.flags for the underlying data """
        return self.values.flags

    @property
    def base(self):
        """ return the base object if the memory of the underlying data is
        shared
        """
        return self.values.base

    @property
    def _values(self):
        """ the internal implementation """
        return self.values

    @property
    def empty(self):
        return not self.size

    def max(self):
        """ The maximum value of the object """
        return nanops.nanmax(self.values)

    def argmax(self, axis=None):
        """
        return a ndarray of the maximum argument indexer

        See also
        --------
        numpy.ndarray.argmax
        """
        return nanops.nanargmax(self.values)

    def min(self):
        """ The minimum value of the object """
        return nanops.nanmin(self.values)

    def argmin(self, axis=None):
        """
        return a ndarray of the minimum argument indexer

        See also
        --------
        numpy.ndarray.argmin
        """
        return nanops.nanargmin(self.values)

    @cache_readonly
    def hasnans(self):
        """ return if I have any nans; enables various perf speedups """
        return isnull(self).any()

    def _reduce(self, op, name, axis=0, skipna=True, numeric_only=None,
                filter_type=None, **kwds):
        """ perform the reduction type operation if we can """
        func = getattr(self, name, None)
        if func is None:
            raise TypeError("{klass} cannot perform the operation {op}".format(
                            klass=self.__class__.__name__, op=name))
        return func(**kwds)

    def value_counts(self, normalize=False, sort=True, ascending=False,
                     bins=None, dropna=True):
        """
        Returns object containing counts of unique values.

        The resulting object will be in descending order so that the
        first element is the most frequently-occurring element.
        Excludes NA values by default.

        Parameters
        ----------
        normalize : boolean, default False
            If True then the object returned will contain the relative
            frequencies of the unique values.
        sort : boolean, default True
            Sort by values
        ascending : boolean, default False
            Sort in ascending order
        bins : integer, optional
            Rather than count values, group them into half-open bins,
            a convenience for pd.cut, only works with numeric data
        dropna : boolean, default True
            Don't include counts of NaN.

        Returns
        -------
        counts : Series
        """
        from pandas.core.algorithms import value_counts
        result = value_counts(self, sort=sort, ascending=ascending,
                              normalize=normalize, bins=bins, dropna=dropna)
        return result

    _shared_docs['unique'] = (
        """
        Return unique values in the object. Uniques are returned in order
        of appearance, this does NOT sort. Hash table-based unique.

        Parameters
        ----------
        values : 1d array-like

        Returns
        -------
        unique values.
          - If the input is an Index, the return is an Index
          - If the input is a Categorical dtype, the return is a Categorical
          - If the input is a Series/ndarray, the return will be an ndarray

        See Also
        --------
        unique
        Index.unique
        Series.unique
        """)

    @Appender(_shared_docs['unique'] % _indexops_doc_kwargs)
    def unique(self):
        values = self._values

        if hasattr(values, 'unique'):
            result = values.unique()
        else:
            from pandas.core.algorithms import unique1d
            result = unique1d(values)

        return result

    def nunique(self, dropna=True):
        """
        Return number of unique elements in the object.

        Excludes NA values by default.

        Parameters
        ----------
        dropna : boolean, default True
            Don't include NaN in the count.

        Returns
        -------
        nunique : int
        """
        uniqs = self.unique()
        n = len(uniqs)
        if dropna and isnull(uniqs).any():
            n -= 1
        return n

    @property
    def is_unique(self):
        """
        Return boolean if values in the object are unique

        Returns
        -------
        is_unique : boolean
        """
        return self.nunique() == len(self)

    @property
    def is_monotonic(self):
        """
        Return boolean if values in the object are
        monotonic_increasing

        .. versionadded:: 0.19.0

        Returns
        -------
        is_monotonic : boolean
        """
        from pandas import Index
        return Index(self).is_monotonic

    is_monotonic_increasing = is_monotonic

    @property
    def is_monotonic_decreasing(self):
        """
        Return boolean if values in the object are
        monotonic_decreasing

        .. versionadded:: 0.19.0

        Returns
        -------
        is_monotonic_decreasing : boolean
        """
        from pandas import Index
        return Index(self).is_monotonic_decreasing

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
        if hasattr(self.values, 'memory_usage'):
            return self.values.memory_usage(deep=deep)

        v = self.values.nbytes
        if deep and is_object_dtype(self):
            v += lib.memory_usage_of_objects(self.values)

        return v

    def factorize(self, sort=False, na_sentinel=-1):
        """
        Encode the object as an enumerated type or categorical variable

        Parameters
        ----------
        sort : boolean, default False
            Sort by values
        na_sentinel: int, default -1
            Value to mark "not found"

        Returns
        -------
        labels : the indexer to the original array
        uniques : the unique Index
        """
        from pandas.core.algorithms import factorize
        return factorize(self, sort=sort, na_sentinel=na_sentinel)

    _shared_docs['searchsorted'] = (
        """Find indices where elements should be inserted to maintain order.

        Find the indices into a sorted %(klass)s `self` such that, if the
        corresponding elements in `value` were inserted before the indices,
        the order of `self` would be preserved.

        Parameters
        ----------
        value : array_like
            Values to insert into `self`.
        side : {'left', 'right'}, optional
            If 'left', the index of the first suitable location found is given.
            If 'right', return the last such index.  If there is no suitable
            index, return either 0 or N (where N is the length of `self`).
        sorter : 1-D array_like, optional
            Optional array of integer indices that sort `self` into ascending
            order. They are typically the result of ``np.argsort``.

        Returns
        -------
        indices : array of ints
            Array of insertion points with the same shape as `value`.

        See Also
        --------
        numpy.searchsorted

        Notes
        -----
        Binary search is used to find the required insertion points.

        Examples
        --------

        >>> x = pd.Series([1, 2, 3])
        >>> x
        0    1
        1    2
        2    3
        dtype: int64

        >>> x.searchsorted(4)
        array([3])

        >>> x.searchsorted([0, 4])
        array([0, 3])

        >>> x.searchsorted([1, 3], side='left')
        array([0, 2])

        >>> x.searchsorted([1, 3], side='right')
        array([1, 3])

        >>> x = pd.Categorical(['apple', 'bread', 'bread', 'cheese', 'milk' ])
        [apple, bread, bread, cheese, milk]
        Categories (4, object): [apple < bread < cheese < milk]

        >>> x.searchsorted('bread')
        array([1])     # Note: an array, not a scalar

        >>> x.searchsorted(['bread'])
        array([1])

        >>> x.searchsorted(['bread', 'eggs'])
        array([1, 4])

        >>> x.searchsorted(['bread', 'eggs'], side='right')
        array([3, 4])    # eggs before milk
        """)

    @Substitution(klass='IndexOpsMixin')
    @Appender(_shared_docs['searchsorted'])
    @deprecate_kwarg(old_arg_name='key', new_arg_name='value')
    def searchsorted(self, value, side='left', sorter=None):
        # needs coercion on the key (DatetimeIndex does already)
        return self.values.searchsorted(value, side=side, sorter=sorter)

    _shared_docs['drop_duplicates'] = (
        """Return %(klass)s with duplicate values removed

        Parameters
        ----------

        keep : {'first', 'last', False}, default 'first'
            - ``first`` : Drop duplicates except for the first occurrence.
            - ``last`` : Drop duplicates except for the last occurrence.
            - False : Drop all duplicates.
        %(inplace)s

        Returns
        -------
        deduplicated : %(klass)s
        """)

    @Appender(_shared_docs['drop_duplicates'] % _indexops_doc_kwargs)
    def drop_duplicates(self, keep='first', inplace=False):
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if isinstance(self, ABCIndexClass):
            if self.is_unique:
                return self._shallow_copy()

        duplicated = self.duplicated(keep=keep)
        result = self[np.logical_not(duplicated)]
        if inplace:
            return self._update_inplace(result)
        else:
            return result

    _shared_docs['duplicated'] = (
        """Return boolean %(duplicated)s denoting duplicate values

        Parameters
        ----------
        keep : {'first', 'last', False}, default 'first'
            - ``first`` : Mark duplicates as ``True`` except for the first
              occurrence.
            - ``last`` : Mark duplicates as ``True`` except for the last
              occurrence.
            - False : Mark all duplicates as ``True``.

        Returns
        -------
        duplicated : %(duplicated)s
        """)

    @Appender(_shared_docs['duplicated'] % _indexops_doc_kwargs)
    def duplicated(self, keep='first'):
        from pandas.core.algorithms import duplicated
        if isinstance(self, ABCIndexClass):
            if self.is_unique:
                return np.zeros(len(self), dtype=np.bool)
            return duplicated(self, keep=keep)
        else:
            return self._constructor(duplicated(self, keep=keep),
                                     index=self.index).__finalize__(self)

    # ----------------------------------------------------------------------
    # abstracts

    def _update_inplace(self, result, **kwargs):
        raise AbstractMethodError(self)
