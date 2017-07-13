
# pylint: disable=E1101,E1103,W0232
import datetime
import warnings
from functools import partial
from sys import getsizeof

import numpy as np
from pandas._libs import index as libindex, lib, Timestamp

from pandas.compat import range, zip, lrange, lzip, map
from pandas.compat.numpy import function as nv
from pandas import compat

from pandas.core.dtypes.common import (
    _ensure_int64,
    _ensure_platform_int,
    is_object_dtype,
    is_iterator,
    is_list_like,
    is_scalar)
from pandas.core.dtypes.missing import isnull, array_equivalent
from pandas.errors import PerformanceWarning, UnsortedIndexError
from pandas.core.common import (_values_from_object,
                                is_bool_indexer,
                                is_null_slice)

import pandas.core.base as base
from pandas.util._decorators import (Appender, cache_readonly,
                                     deprecate, deprecate_kwarg)
import pandas.core.common as com
import pandas.core.missing as missing
import pandas.core.algorithms as algos
from pandas.io.formats.printing import pprint_thing

from pandas.core.config import get_option

from pandas.core.indexes.base import (
    Index, _ensure_index,
    _get_na_value, InvalidIndexError,
    _index_shared_docs)
from pandas.core.indexes.frozen import (
    FrozenNDArray, FrozenList, _ensure_frozen)
import pandas.core.indexes.base as ibase
_index_doc_kwargs = dict(ibase._index_doc_kwargs)
_index_doc_kwargs.update(
    dict(klass='MultiIndex',
         target_klass='MultiIndex or list of tuples'))


class MultiIndex(Index):
    """
    A multi-level, or hierarchical, index object for pandas objects

    Parameters
    ----------
    levels : sequence of arrays
        The unique labels for each level
    labels : sequence of arrays
        Integers for each level designating which label at each location
    sortorder : optional int
        Level of sortedness (must be lexicographically sorted by that
        level)
    names : optional sequence of objects
        Names for each of the index levels. (name is accepted for compat)
    copy : boolean, default False
        Copy the meta-data
    verify_integrity : boolean, default True
        Check that the levels/labels are consistent and valid
    """

    # initialize to zero-length tuples to make everything work
    _typ = 'multiindex'
    _names = FrozenList()
    _levels = FrozenList()
    _labels = FrozenList()
    _comparables = ['names']
    rename = Index.set_names

    def __new__(cls, levels=None, labels=None, sortorder=None, names=None,
                copy=False, verify_integrity=True, _set_identity=True,
                name=None, **kwargs):

        # compat with Index
        if name is not None:
            names = name
        if levels is None or labels is None:
            raise TypeError("Must pass both levels and labels")
        if len(levels) != len(labels):
            raise ValueError('Length of levels and labels must be the same.')
        if len(levels) == 0:
            raise ValueError('Must pass non-zero number of levels/labels')
        if len(levels) == 1:
            if names:
                name = names[0]
            else:
                name = None
            return Index(levels[0], name=name, copy=True).take(labels[0])

        result = object.__new__(MultiIndex)

        # we've already validated levels and labels, so shortcut here
        result._set_levels(levels, copy=copy, validate=False)
        result._set_labels(labels, copy=copy, validate=False)

        if names is not None:
            # handles name validation
            result._set_names(names)

        if sortorder is not None:
            result.sortorder = int(sortorder)
        else:
            result.sortorder = sortorder

        if verify_integrity:
            result._verify_integrity()
        if _set_identity:
            result._reset_identity()
        return result

    def _verify_integrity(self, labels=None, levels=None):
        """

        Parameters
        ----------
        labels : optional list
            Labels to check for validity. Defaults to current labels.
        levels : optional list
            Levels to check for validity. Defaults to current levels.

        Raises
        ------
        ValueError
            * if length of levels and labels don't match or any label would
            exceed level bounds
        """
        # NOTE: Currently does not check, among other things, that cached
        # nlevels matches nor that sortorder matches actually sortorder.
        labels = labels or self.labels
        levels = levels or self.levels

        if len(levels) != len(labels):
            raise ValueError("Length of levels and labels must match. NOTE:"
                             " this index is in an inconsistent state.")
        label_length = len(self.labels[0])
        for i, (level, label) in enumerate(zip(levels, labels)):
            if len(label) != label_length:
                raise ValueError("Unequal label lengths: %s" %
                                 ([len(lab) for lab in labels]))
            if len(label) and label.max() >= len(level):
                raise ValueError("On level %d, label max (%d) >= length of"
                                 " level  (%d). NOTE: this index is in an"
                                 " inconsistent state" % (i, label.max(),
                                                          len(level)))

    def _get_levels(self):
        return self._levels

    def _set_levels(self, levels, level=None, copy=False, validate=True,
                    verify_integrity=False):
        # This is NOT part of the levels property because it should be
        # externally not allowed to set levels. User beware if you change
        # _levels directly
        if validate and len(levels) == 0:
            raise ValueError('Must set non-zero number of levels.')
        if validate and level is None and len(levels) != self.nlevels:
            raise ValueError('Length of levels must match number of levels.')
        if validate and level is not None and len(levels) != len(level):
            raise ValueError('Length of levels must match length of level.')

        if level is None:
            new_levels = FrozenList(
                _ensure_index(lev, copy=copy)._shallow_copy()
                for lev in levels)
        else:
            level = [self._get_level_number(l) for l in level]
            new_levels = list(self._levels)
            for l, v in zip(level, levels):
                new_levels[l] = _ensure_index(v, copy=copy)._shallow_copy()
            new_levels = FrozenList(new_levels)

        if verify_integrity:
            self._verify_integrity(levels=new_levels)

        names = self.names
        self._levels = new_levels
        if any(names):
            self._set_names(names)

        self._tuples = None
        self._reset_cache()

    def set_levels(self, levels, level=None, inplace=False,
                   verify_integrity=True):
        """
        Set new levels on MultiIndex. Defaults to returning
        new index.

        Parameters
        ----------
        levels : sequence or list of sequence
            new level(s) to apply
        level : int, level name, or sequence of int/level names (default None)
            level(s) to set (None for all levels)
        inplace : bool
            if True, mutates in place
        verify_integrity : bool (default True)
            if True, checks that levels and labels are compatible

        Returns
        -------
        new index (of same type and class...etc)


        Examples
        --------
        >>> idx = MultiIndex.from_tuples([(1, u'one'), (1, u'two'),
                                          (2, u'one'), (2, u'two')],
                                          names=['foo', 'bar'])
        >>> idx.set_levels([['a','b'], [1,2]])
        MultiIndex(levels=[[u'a', u'b'], [1, 2]],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]],
                   names=[u'foo', u'bar'])
        >>> idx.set_levels(['a','b'], level=0)
        MultiIndex(levels=[[u'a', u'b'], [u'one', u'two']],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]],
                   names=[u'foo', u'bar'])
        >>> idx.set_levels(['a','b'], level='bar')
        MultiIndex(levels=[[1, 2], [u'a', u'b']],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]],
                   names=[u'foo', u'bar'])
        >>> idx.set_levels([['a','b'], [1,2]], level=[0,1])
        MultiIndex(levels=[[u'a', u'b'], [1, 2]],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]],
                   names=[u'foo', u'bar'])
        """
        if level is not None and not is_list_like(level):
            if not is_list_like(levels):
                raise TypeError("Levels must be list-like")
            if is_list_like(levels[0]):
                raise TypeError("Levels must be list-like")
            level = [level]
            levels = [levels]
        elif level is None or is_list_like(level):
            if not is_list_like(levels) or not is_list_like(levels[0]):
                raise TypeError("Levels must be list of lists-like")

        if inplace:
            idx = self
        else:
            idx = self._shallow_copy()
        idx._reset_identity()
        idx._set_levels(levels, level=level, validate=True,
                        verify_integrity=verify_integrity)
        if not inplace:
            return idx

    # remove me in 0.14 and change to read only property
    __set_levels = deprecate("setting `levels` directly",
                             partial(set_levels, inplace=True,
                                     verify_integrity=True),
                             alt_name="set_levels")
    levels = property(fget=_get_levels, fset=__set_levels)

    def _get_labels(self):
        return self._labels

    def _set_labels(self, labels, level=None, copy=False, validate=True,
                    verify_integrity=False):

        if validate and level is None and len(labels) != self.nlevels:
            raise ValueError("Length of labels must match number of levels")
        if validate and level is not None and len(labels) != len(level):
            raise ValueError('Length of labels must match length of levels.')

        if level is None:
            new_labels = FrozenList(
                _ensure_frozen(lab, lev, copy=copy)._shallow_copy()
                for lev, lab in zip(self.levels, labels))
        else:
            level = [self._get_level_number(l) for l in level]
            new_labels = list(self._labels)
            for l, lev, lab in zip(level, self.levels, labels):
                new_labels[l] = _ensure_frozen(
                    lab, lev, copy=copy)._shallow_copy()
            new_labels = FrozenList(new_labels)

        if verify_integrity:
            self._verify_integrity(labels=new_labels)

        self._labels = new_labels
        self._tuples = None
        self._reset_cache()

    def set_labels(self, labels, level=None, inplace=False,
                   verify_integrity=True):
        """
        Set new labels on MultiIndex. Defaults to returning
        new index.

        Parameters
        ----------
        labels : sequence or list of sequence
            new labels to apply
        level : int, level name, or sequence of int/level names (default None)
            level(s) to set (None for all levels)
        inplace : bool
            if True, mutates in place
        verify_integrity : bool (default True)
            if True, checks that levels and labels are compatible

        Returns
        -------
        new index (of same type and class...etc)

        Examples
        --------
        >>> idx = MultiIndex.from_tuples([(1, u'one'), (1, u'two'),
                                          (2, u'one'), (2, u'two')],
                                          names=['foo', 'bar'])
        >>> idx.set_labels([[1,0,1,0], [0,0,1,1]])
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[1, 0, 1, 0], [0, 0, 1, 1]],
                   names=[u'foo', u'bar'])
        >>> idx.set_labels([1,0,1,0], level=0)
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[1, 0, 1, 0], [0, 1, 0, 1]],
                   names=[u'foo', u'bar'])
        >>> idx.set_labels([0,0,1,1], level='bar')
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[0, 0, 1, 1], [0, 0, 1, 1]],
                   names=[u'foo', u'bar'])
        >>> idx.set_labels([[1,0,1,0], [0,0,1,1]], level=[0,1])
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[1, 0, 1, 0], [0, 0, 1, 1]],
                   names=[u'foo', u'bar'])
        """
        if level is not None and not is_list_like(level):
            if not is_list_like(labels):
                raise TypeError("Labels must be list-like")
            if is_list_like(labels[0]):
                raise TypeError("Labels must be list-like")
            level = [level]
            labels = [labels]
        elif level is None or is_list_like(level):
            if not is_list_like(labels) or not is_list_like(labels[0]):
                raise TypeError("Labels must be list of lists-like")

        if inplace:
            idx = self
        else:
            idx = self._shallow_copy()
        idx._reset_identity()
        idx._set_labels(labels, level=level, verify_integrity=verify_integrity)
        if not inplace:
            return idx

    # remove me in 0.14 and change to readonly property
    __set_labels = deprecate("setting labels directly",
                             partial(set_labels, inplace=True,
                                     verify_integrity=True),
                             alt_name="set_labels")
    labels = property(fget=_get_labels, fset=__set_labels)

    def copy(self, names=None, dtype=None, levels=None, labels=None,
             deep=False, _set_identity=False, **kwargs):
        """
        Make a copy of this object. Names, dtype, levels and labels can be
        passed and will be set on new copy.

        Parameters
        ----------
        names : sequence, optional
        dtype : numpy dtype or pandas type, optional
        levels : sequence, optional
        labels : sequence, optional

        Returns
        -------
        copy : MultiIndex

        Notes
        -----
        In most cases, there should be no functional difference from using
        ``deep``, but if ``deep`` is passed it will attempt to deepcopy.
        This could be potentially expensive on large MultiIndex objects.
        """
        name = kwargs.get('name')
        names = self._validate_names(name=name, names=names, deep=deep)

        if deep:
            from copy import deepcopy
            if levels is None:
                levels = deepcopy(self.levels)
            if labels is None:
                labels = deepcopy(self.labels)
        else:
            if levels is None:
                levels = self.levels
            if labels is None:
                labels = self.labels
        return MultiIndex(levels=levels, labels=labels, names=names,
                          sortorder=self.sortorder, verify_integrity=False,
                          _set_identity=_set_identity)

    def __array__(self, dtype=None):
        """ the array interface, return my values """
        return self.values

    def view(self, cls=None):
        """ this is defined as a copy with the same identity """
        result = self.copy()
        result._id = self._id
        return result

    def _shallow_copy_with_infer(self, values=None, **kwargs):
        # On equal MultiIndexes the difference is empty.
        # Therefore, an empty MultiIndex is returned GH13490
        if len(values) == 0:
            return MultiIndex(levels=[[] for _ in range(self.nlevels)],
                              labels=[[] for _ in range(self.nlevels)],
                              **kwargs)
        return self._shallow_copy(values, **kwargs)

    @Appender(_index_shared_docs['_shallow_copy'])
    def _shallow_copy(self, values=None, **kwargs):
        if values is not None:
            if 'name' in kwargs:
                kwargs['names'] = kwargs.pop('name', None)
            # discards freq
            kwargs.pop('freq', None)
            return MultiIndex.from_tuples(values, **kwargs)
        return self.view()

    @cache_readonly
    def dtype(self):
        return np.dtype('O')

    def _is_memory_usage_qualified(self):
        """ return a boolean if we need a qualified .info display """
        def f(l):
            return 'mixed' in l or 'string' in l or 'unicode' in l
        return any([f(l) for l in self._inferred_type_levels])

    @Appender(Index.memory_usage.__doc__)
    def memory_usage(self, deep=False):
        # we are overwriting our base class to avoid
        # computing .values here which could materialize
        # a tuple representation uncessarily
        return self._nbytes(deep)

    @cache_readonly
    def nbytes(self):
        """ return the number of bytes in the underlying data """
        return self._nbytes(False)

    def _nbytes(self, deep=False):
        """
        return the number of bytes in the underlying data
        deeply introspect the level data if deep=True

        include the engine hashtable

        *this is in internal routine*

        """
        level_nbytes = sum((i.memory_usage(deep=deep) for i in self.levels))
        label_nbytes = sum((i.nbytes for i in self.labels))
        names_nbytes = sum((getsizeof(i) for i in self.names))
        result = level_nbytes + label_nbytes + names_nbytes

        # include our engine hashtable
        result += self._engine.sizeof(deep=deep)
        return result

    def _format_attrs(self):
        """
        Return a list of tuples of the (attr,formatted_value)
        """
        attrs = [
            ('levels', ibase.default_pprint(self._levels,
                                            max_seq_items=False)),
            ('labels', ibase.default_pprint(self._labels,
                                            max_seq_items=False))]
        if not all(name is None for name in self.names):
            attrs.append(('names', ibase.default_pprint(self.names)))
        if self.sortorder is not None:
            attrs.append(('sortorder', ibase.default_pprint(self.sortorder)))
        return attrs

    def _format_space(self):
        return "\n%s" % (' ' * (len(self.__class__.__name__) + 1))

    def _format_data(self):
        # we are formatting thru the attributes
        return None

    def __len__(self):
        return len(self.labels[0])

    def _get_names(self):
        return FrozenList(level.name for level in self.levels)

    def _set_names(self, names, level=None, validate=True):
        """
        sets names on levels. WARNING: mutates!

        Note that you generally want to set this *after* changing levels, so
        that it only acts on copies
        """

        # GH 15110
        # Don't allow a single string for names in a MultiIndex
        if names is not None and not is_list_like(names):
            raise ValueError('Names should be list-like for a MultiIndex')
        names = list(names)

        if validate and level is not None and len(names) != len(level):
            raise ValueError('Length of names must match length of level.')
        if validate and level is None and len(names) != self.nlevels:
            raise ValueError('Length of names must match number of levels in '
                             'MultiIndex.')

        if level is None:
            level = range(self.nlevels)
        else:
            level = [self._get_level_number(l) for l in level]

        # set the name
        for l, name in zip(level, names):
            self.levels[l].rename(name, inplace=True)

    names = property(fset=_set_names, fget=_get_names,
                     doc="Names of levels in MultiIndex")

    def _reference_duplicate_name(self, name):
        """
        Returns True if the name refered to in self.names is duplicated.
        """
        # count the times name equals an element in self.names.
        return sum(name == n for n in self.names) > 1

    def _format_native_types(self, na_rep='nan', **kwargs):
        new_levels = []
        new_labels = []

        # go through the levels and format them
        for level, label in zip(self.levels, self.labels):
            level = level._format_native_types(na_rep=na_rep, **kwargs)
            # add nan values, if there are any
            mask = (label == -1)
            if mask.any():
                nan_index = len(level)
                level = np.append(level, na_rep)
                label = label.values()
                label[mask] = nan_index
            new_levels.append(level)
            new_labels.append(label)

        # reconstruct the multi-index
        mi = MultiIndex(levels=new_levels, labels=new_labels, names=self.names,
                        sortorder=self.sortorder, verify_integrity=False)

        return mi.values

    @Appender(_index_shared_docs['_get_grouper_for_level'])
    def _get_grouper_for_level(self, mapper, level):
        indexer = self.labels[level]
        level_index = self.levels[level]

        if mapper is not None:
            # Handle group mapping function and return
            level_values = self.levels[level].take(indexer)
            grouper = level_values.map(mapper)
            return grouper, None, None

        labels, uniques = algos.factorize(indexer, sort=True)

        if len(uniques) > 0 and uniques[0] == -1:
            # Handle NAs
            mask = indexer != -1
            ok_labels, uniques = algos.factorize(indexer[mask],
                                                 sort=True)

            labels = np.empty(len(indexer), dtype=indexer.dtype)
            labels[mask] = ok_labels
            labels[~mask] = -1

        if len(uniques) < len(level_index):
            # Remove unobserved levels from level_index
            level_index = level_index.take(uniques)

        grouper = level_index.take(labels)

        return grouper, labels, level_index

    @property
    def _constructor(self):
        return MultiIndex.from_tuples

    @cache_readonly
    def inferred_type(self):
        return 'mixed'

    @staticmethod
    def _from_elements(values, labels=None, levels=None, names=None,
                       sortorder=None):
        return MultiIndex(levels, labels, names, sortorder=sortorder)

    def _get_level_number(self, level):
        try:
            count = self.names.count(level)
            if count > 1:
                raise ValueError('The name %s occurs multiple times, use a '
                                 'level number' % level)
            level = self.names.index(level)
        except ValueError:
            if not isinstance(level, int):
                raise KeyError('Level %s not found' % str(level))
            elif level < 0:
                level += self.nlevels
                if level < 0:
                    orig_level = level - self.nlevels
                    raise IndexError('Too many levels: Index has only %d '
                                     'levels, %d is not a valid level number' %
                                     (self.nlevels, orig_level))
            # Note: levels are zero-based
            elif level >= self.nlevels:
                raise IndexError('Too many levels: Index has only %d levels, '
                                 'not %d' % (self.nlevels, level + 1))
        return level

    _tuples = None

    @cache_readonly
    def _engine(self):

        # choose our engine based on our size
        # the hashing based MultiIndex for larger
        # sizes, and the MultiIndexOjbect for smaller
        # xref: https://github.com/pandas-dev/pandas/pull/16324
        l = len(self)
        if l > 10000:
            return libindex.MultiIndexHashEngine(lambda: self, l)

        return libindex.MultiIndexObjectEngine(lambda: self.values, l)

    @property
    def values(self):
        if self._tuples is not None:
            return self._tuples

        values = []
        for lev, lab in zip(self.levels, self.labels):
            # Need to box timestamps, etc.
            box = hasattr(lev, '_box_values')
            # Try to minimize boxing.
            if box and len(lev) > len(lab):
                taken = lev._box_values(algos.take_1d(lev._values, lab))
            elif box:
                taken = algos.take_1d(lev._box_values(lev._values), lab,
                                      fill_value=_get_na_value(lev.dtype.type))
            else:
                taken = algos.take_1d(np.asarray(lev._values), lab)
            values.append(taken)

        self._tuples = lib.fast_zip(values)
        return self._tuples

    # fml
    @property
    def _is_v1(self):
        return False

    @property
    def _is_v2(self):
        return False

    @property
    def _has_complex_internals(self):
        # to disable groupby tricks
        return True

    @cache_readonly
    def is_monotonic(self):
        """
        return if the index is monotonic increasing (only equal or
        increasing) values.
        """
        return self.is_monotonic_increasing

    @cache_readonly
    def is_monotonic_increasing(self):
        """
        return if the index is monotonic increasing (only equal or
        increasing) values.
        """

        # reversed() because lexsort() wants the most significant key last.
        values = [self._get_level_values(i).values
                  for i in reversed(range(len(self.levels)))]
        try:
            sort_order = np.lexsort(values)
            return Index(sort_order).is_monotonic
        except TypeError:

            # we have mixed types and np.lexsort is not happy
            return Index(self.values).is_monotonic

    @property
    def is_monotonic_decreasing(self):
        """
        return if the index is monotonic decreasing (only equal or
        decreasing) values.
        """
        return False

    @cache_readonly
    def is_unique(self):
        return not self.duplicated().any()

    @cache_readonly
    def _have_mixed_levels(self):
        """ return a boolean list indicated if we have mixed levels """
        return ['mixed' in l for l in self._inferred_type_levels]

    @cache_readonly
    def _inferred_type_levels(self):
        """ return a list of the inferred types, one for each level """
        return [i.inferred_type for i in self.levels]

    @cache_readonly
    def _hashed_values(self):
        """ return a uint64 ndarray of my hashed values """
        from pandas.core.util.hashing import hash_tuples
        return hash_tuples(self)

    def _hashed_indexing_key(self, key):
        """
        validate and return the hash for the provided key

        *this is internal for use for the cython routines*

        Paramters
        ---------
        key : string or tuple

        Returns
        -------
        np.uint64

        Notes
        -----
        we need to stringify if we have mixed levels

        """
        from pandas.core.util.hashing import hash_tuples, hash_tuple

        if not isinstance(key, tuple):
            return hash_tuples(key)

        if not len(key) == self.nlevels:
            raise KeyError

        def f(k, stringify):
            if stringify and not isinstance(k, compat.string_types):
                k = str(k)
            return k
        key = tuple([f(k, stringify)
                     for k, stringify in zip(key, self._have_mixed_levels)])
        return hash_tuple(key)

    @Appender(base._shared_docs['duplicated'] % _index_doc_kwargs)
    def duplicated(self, keep='first'):
        from pandas.core.sorting import get_group_index
        from pandas._libs.hashtable import duplicated_int64

        shape = map(len, self.levels)
        ids = get_group_index(self.labels, shape, sort=False, xnull=False)

        return duplicated_int64(ids, keep)

    @Appender(ibase._index_shared_docs['fillna'])
    def fillna(self, value=None, downcast=None):
        # isnull is not implemented for MultiIndex
        raise NotImplementedError('isnull is not defined for MultiIndex')

    @Appender(_index_shared_docs['dropna'])
    def dropna(self, how='any'):
        nans = [label == -1 for label in self.labels]
        if how == 'any':
            indexer = np.any(nans, axis=0)
        elif how == 'all':
            indexer = np.all(nans, axis=0)
        else:
            raise ValueError("invalid how option: {0}".format(how))

        new_labels = [label[~indexer] for label in self.labels]
        return self.copy(labels=new_labels, deep=True)

    def get_value(self, series, key):
        # somewhat broken encapsulation
        from pandas.core.indexing import maybe_droplevels

        # Label-based
        s = _values_from_object(series)
        k = _values_from_object(key)

        def _try_mi(k):
            # TODO: what if a level contains tuples??
            loc = self.get_loc(k)
            new_values = series._values[loc]
            new_index = self[loc]
            new_index = maybe_droplevels(new_index, k)
            return series._constructor(new_values, index=new_index,
                                       name=series.name).__finalize__(self)

        try:
            return self._engine.get_value(s, k)
        except KeyError as e1:
            try:
                return _try_mi(key)
            except KeyError:
                pass

            try:
                return libindex.get_value_at(s, k)
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

            # a Timestamp will raise a TypeError in a multi-index
            # rather than a KeyError, try it here
            # note that a string that 'looks' like a Timestamp will raise
            # a KeyError! (GH5725)
            if (isinstance(key, (datetime.datetime, np.datetime64)) or
                    (compat.PY3 and isinstance(key, compat.string_types))):
                try:
                    return _try_mi(key)
                except (KeyError):
                    raise
                except:
                    pass

                try:
                    return _try_mi(Timestamp(key))
                except:
                    pass

            raise InvalidIndexError(key)

    def _get_level_values(self, level):
        """
        Return vector of label values for requested level,
        equal to the length of the index

        **this is an internal method**

        Parameters
        ----------
        level : int level

        Returns
        -------
        values : ndarray
        """

        unique = self.levels[level]
        labels = self.labels[level]
        filled = algos.take_1d(unique._values, labels,
                               fill_value=unique._na_value)
        values = unique._shallow_copy(filled)
        return values

    def get_level_values(self, level):
        """
        Return vector of label values for requested level,
        equal to the length of the index

        Parameters
        ----------
        level : int or level name

        Returns
        -------
        values : Index
        """
        level = self._get_level_number(level)
        values = self._get_level_values(level)
        return values

    def format(self, space=2, sparsify=None, adjoin=True, names=False,
               na_rep=None, formatter=None):
        if len(self) == 0:
            return []

        stringified_levels = []
        for lev, lab in zip(self.levels, self.labels):
            na = na_rep if na_rep is not None else _get_na_rep(lev.dtype.type)

            if len(lev) > 0:

                formatted = lev.take(lab).format(formatter=formatter)

                # we have some NA
                mask = lab == -1
                if mask.any():
                    formatted = np.array(formatted, dtype=object)
                    formatted[mask] = na
                    formatted = formatted.tolist()

            else:
                # weird all NA case
                formatted = [pprint_thing(na if isnull(x) else x,
                                          escape_chars=('\t', '\r', '\n'))
                             for x in algos.take_1d(lev._values, lab)]
            stringified_levels.append(formatted)

        result_levels = []
        for lev, name in zip(stringified_levels, self.names):
            level = []

            if names:
                level.append(pprint_thing(name,
                                          escape_chars=('\t', '\r', '\n'))
                             if name is not None else '')

            level.extend(np.array(lev, dtype=object))
            result_levels.append(level)

        if sparsify is None:
            sparsify = get_option("display.multi_sparse")

        if sparsify:
            sentinel = ''
            # GH3547
            # use value of sparsify as sentinel,  unless it's an obvious
            # "Truthey" value
            if sparsify not in [True, 1]:
                sentinel = sparsify
            # little bit of a kludge job for #1217
            result_levels = _sparsify(result_levels, start=int(names),
                                      sentinel=sentinel)

        if adjoin:
            from pandas.io.formats.format import _get_adjustment
            adj = _get_adjustment()
            return adj.adjoin(space, *result_levels).split('\n')
        else:
            return result_levels

    def _to_safe_for_reshape(self):
        """ convert to object if we are a categorical """
        return self.set_levels([i._to_safe_for_reshape() for i in self.levels])

    def to_frame(self, index=True):
        """
        Create a DataFrame with the columns the levels of the MultiIndex

        .. versionadded:: 0.20.0

        Parameters
        ----------
        index : boolean, default True
            return this MultiIndex as the index

        Returns
        -------
        DataFrame
        """

        from pandas import DataFrame
        result = DataFrame({(name or level):
                            self._get_level_values(level)
                            for name, level in
                            zip(self.names, range(len(self.levels)))},
                           copy=False)
        if index:
            result.index = self
        return result

    def to_hierarchical(self, n_repeat, n_shuffle=1):
        """
        Return a MultiIndex reshaped to conform to the
        shapes given by n_repeat and n_shuffle.

        Useful to replicate and rearrange a MultiIndex for combination
        with another Index with n_repeat items.

        Parameters
        ----------
        n_repeat : int
            Number of times to repeat the labels on self
        n_shuffle : int
            Controls the reordering of the labels. If the result is going
            to be an inner level in a MultiIndex, n_shuffle will need to be
            greater than one. The size of each label must divisible by
            n_shuffle.

        Returns
        -------
        MultiIndex

        Examples
        --------
        >>> idx = MultiIndex.from_tuples([(1, u'one'), (1, u'two'),
                                          (2, u'one'), (2, u'two')])
        >>> idx.to_hierarchical(3)
        MultiIndex(levels=[[1, 2], [u'one', u'two']],
                   labels=[[0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
                           [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1]])
        """
        levels = self.levels
        labels = [np.repeat(x, n_repeat) for x in self.labels]
        # Assumes that each label is divisible by n_shuffle
        labels = [x.reshape(n_shuffle, -1).ravel(order='F') for x in labels]
        names = self.names
        return MultiIndex(levels=levels, labels=labels, names=names)

    @property
    def is_all_dates(self):
        return False

    def is_lexsorted(self):
        """
        Return True if the labels are lexicographically sorted
        """
        return self.lexsort_depth == self.nlevels

    def is_lexsorted_for_tuple(self, tup):
        """
        Return True if we are correctly lexsorted given the passed tuple
        """
        return len(tup) <= self.lexsort_depth

    @cache_readonly
    def lexsort_depth(self):
        if self.sortorder is not None:
            if self.sortorder == 0:
                return self.nlevels
            else:
                return 0

        int64_labels = [_ensure_int64(lab) for lab in self.labels]
        for k in range(self.nlevels, 0, -1):
            if lib.is_lexsorted(int64_labels[:k]):
                return k

        return 0

    @classmethod
    def from_arrays(cls, arrays, sortorder=None, names=None):
        """
        Convert arrays to MultiIndex

        Parameters
        ----------
        arrays : list / sequence of array-likes
            Each array-like gives one level's value for each data point.
            len(arrays) is the number of levels.
        sortorder : int or None
            Level of sortedness (must be lexicographically sorted by that
            level)

        Returns
        -------
        index : MultiIndex

        Examples
        --------
        >>> arrays = [[1, 1, 2, 2], ['red', 'blue', 'red', 'blue']]
        >>> MultiIndex.from_arrays(arrays, names=('number', 'color'))

        See Also
        --------
        MultiIndex.from_tuples : Convert list of tuples to MultiIndex
        MultiIndex.from_product : Make a MultiIndex from cartesian product
                                  of iterables
        """
        if len(arrays) == 1:
            name = None if names is None else names[0]
            return Index(arrays[0], name=name)

        # Check if lengths of all arrays are equal or not,
        # raise ValueError, if not
        for i in range(1, len(arrays)):
            if len(arrays[i]) != len(arrays[i - 1]):
                raise ValueError('all arrays must be same length')

        from pandas.core.categorical import _factorize_from_iterables

        labels, levels = _factorize_from_iterables(arrays)
        if names is None:
            names = [getattr(arr, "name", None) for arr in arrays]

        return MultiIndex(levels=levels, labels=labels, sortorder=sortorder,
                          names=names, verify_integrity=False)

    @classmethod
    def from_tuples(cls, tuples, sortorder=None, names=None):
        """
        Convert list of tuples to MultiIndex

        Parameters
        ----------
        tuples : list / sequence of tuple-likes
            Each tuple is the index of one row/column.
        sortorder : int or None
            Level of sortedness (must be lexicographically sorted by that
            level)

        Returns
        -------
        index : MultiIndex

        Examples
        --------
        >>> tuples = [(1, u'red'), (1, u'blue'),
                      (2, u'red'), (2, u'blue')]
        >>> MultiIndex.from_tuples(tuples, names=('number', 'color'))

        See Also
        --------
        MultiIndex.from_arrays : Convert list of arrays to MultiIndex
        MultiIndex.from_product : Make a MultiIndex from cartesian product
                                  of iterables
        """
        if len(tuples) == 0:
            # I think this is right? Not quite sure...
            raise TypeError('Cannot infer number of levels from empty list')

        if isinstance(tuples, (np.ndarray, Index)):
            if isinstance(tuples, Index):
                tuples = tuples._values

            arrays = list(lib.tuples_to_object_array(tuples).T)
        elif isinstance(tuples, list):
            arrays = list(lib.to_object_array_tuples(tuples).T)
        else:
            arrays = lzip(*tuples)

        return MultiIndex.from_arrays(arrays, sortorder=sortorder, names=names)

    @classmethod
    def from_product(cls, iterables, sortorder=None, names=None):
        """
        Make a MultiIndex from the cartesian product of multiple iterables

        Parameters
        ----------
        iterables : list / sequence of iterables
            Each iterable has unique labels for each level of the index.
        sortorder : int or None
            Level of sortedness (must be lexicographically sorted by that
            level).
        names : list / sequence of strings or None
            Names for the levels in the index.

        Returns
        -------
        index : MultiIndex

        Examples
        --------
        >>> numbers = [0, 1, 2]
        >>> colors = [u'green', u'purple']
        >>> MultiIndex.from_product([numbers, colors],
                                     names=['number', 'color'])
        MultiIndex(levels=[[0, 1, 2], [u'green', u'purple']],
                   labels=[[0, 0, 1, 1, 2, 2], [0, 1, 0, 1, 0, 1]],
                   names=[u'number', u'color'])

        See Also
        --------
        MultiIndex.from_arrays : Convert list of arrays to MultiIndex
        MultiIndex.from_tuples : Convert list of tuples to MultiIndex
        """
        from pandas.core.categorical import _factorize_from_iterables
        from pandas.core.reshape.util import cartesian_product

        labels, levels = _factorize_from_iterables(iterables)
        labels = cartesian_product(labels)
        return MultiIndex(levels, labels, sortorder=sortorder, names=names)

    def _sort_levels_monotonic(self):
        """
        .. versionadded:: 0.20.0

        This is an *internal* function.

        create a new MultiIndex from the current to monotonically sorted
        items IN the levels. This does not actually make the entire MultiIndex
        monotonic, JUST the levels.

        The resulting MultiIndex will have the same outward
        appearance, meaning the same .values and ordering. It will also
        be .equals() to the original.

        Returns
        -------
        MultiIndex

        Examples
        --------

        >>> i = pd.MultiIndex(levels=[['a', 'b'], ['bb', 'aa']],
                              labels=[[0, 0, 1, 1], [0, 1, 0, 1]])
        >>> i
        MultiIndex(levels=[['a', 'b'], ['bb', 'aa']],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]])

        >>> i.sort_monotonic()
        MultiIndex(levels=[['a', 'b'], ['aa', 'bb']],
                   labels=[[0, 0, 1, 1], [1, 0, 1, 0]])

        """

        if self.is_lexsorted() and self.is_monotonic:
            return self

        new_levels = []
        new_labels = []

        for lev, lab in zip(self.levels, self.labels):

            if lev.is_monotonic:
                new_levels.append(lev)
                new_labels.append(lab)
                continue

            # indexer to reorder the levels
            indexer = lev.argsort()
            lev = lev.take(indexer)

            # indexer to reorder the labels
            indexer = _ensure_int64(indexer)
            ri = lib.get_reverse_indexer(indexer, len(indexer))
            lab = algos.take_1d(ri, lab)

            new_levels.append(lev)
            new_labels.append(lab)

        return MultiIndex(new_levels, new_labels,
                          names=self.names, sortorder=self.sortorder,
                          verify_integrity=False)

    def remove_unused_levels(self):
        """
        create a new MultiIndex from the current that removing
        unused levels, meaning that they are not expressed in the labels

        The resulting MultiIndex will have the same outward
        appearance, meaning the same .values and ordering. It will also
        be .equals() to the original.

        .. versionadded:: 0.20.0

        Returns
        -------
        MultiIndex

        Examples
        --------
        >>> i = pd.MultiIndex.from_product([range(2), list('ab')])
        MultiIndex(levels=[[0, 1], ['a', 'b']],
                   labels=[[0, 0, 1, 1], [0, 1, 0, 1]])


        >>> i[2:]
        MultiIndex(levels=[[0, 1], ['a', 'b']],
                   labels=[[1, 1], [0, 1]])

        The 0 from the first level is not represented
        and can be removed

        >>> i[2:].remove_unused_levels()
        MultiIndex(levels=[[1], ['a', 'b']],
                   labels=[[0, 0], [0, 1]])

        """

        new_levels = []
        new_labels = []

        changed = False
        for lev, lab in zip(self.levels, self.labels):

            uniques = algos.unique(lab)

            # nothing unused
            if len(uniques) == len(lev):
                new_levels.append(lev)
                new_labels.append(lab)
                continue

            changed = True

            # labels get mapped from uniques to 0:len(uniques)
            label_mapping = np.zeros(len(lev))
            label_mapping[uniques] = np.arange(len(uniques))
            lab = label_mapping[lab]

            # new levels are simple
            lev = lev.take(uniques)

            new_levels.append(lev)
            new_labels.append(lab)

        result = self._shallow_copy()

        if changed:
            result._reset_identity()
            result._set_levels(new_levels, validate=False)
            result._set_labels(new_labels, validate=False)

        return result

    @property
    def nlevels(self):
        return len(self.levels)

    @property
    def levshape(self):
        return tuple(len(x) for x in self.levels)

    @Appender(_index_shared_docs['__contains__'] % _index_doc_kwargs)
    def __contains__(self, key):
        hash(key)
        try:
            self.get_loc(key)
            return True
        except LookupError:
            return False

    contains = __contains__

    def __reduce__(self):
        """Necessary for making this object picklable"""
        d = dict(levels=[lev for lev in self.levels],
                 labels=[label for label in self.labels],
                 sortorder=self.sortorder, names=list(self.names))
        return ibase._new_Index, (self.__class__, d), None

    def __setstate__(self, state):
        """Necessary for making this object picklable"""

        if isinstance(state, dict):
            levels = state.get('levels')
            labels = state.get('labels')
            sortorder = state.get('sortorder')
            names = state.get('names')

        elif isinstance(state, tuple):

            nd_state, own_state = state
            levels, labels, sortorder, names = own_state

        self._set_levels([Index(x) for x in levels], validate=False)
        self._set_labels(labels)
        self._set_names(names)
        self.sortorder = sortorder
        self._verify_integrity()
        self._reset_identity()

    def __getitem__(self, key):
        if is_scalar(key):
            retval = []
            for lev, lab in zip(self.levels, self.labels):
                if lab[key] == -1:
                    retval.append(np.nan)
                else:
                    retval.append(lev[lab[key]])

            return tuple(retval)
        else:
            if is_bool_indexer(key):
                key = np.asarray(key)
                sortorder = self.sortorder
            else:
                # cannot be sure whether the result will be sorted
                sortorder = None

            new_labels = [lab[key] for lab in self.labels]

            return MultiIndex(levels=self.levels, labels=new_labels,
                              names=self.names, sortorder=sortorder,
                              verify_integrity=False)

    @Appender(_index_shared_docs['take'] % _index_doc_kwargs)
    def take(self, indices, axis=0, allow_fill=True,
             fill_value=None, **kwargs):
        nv.validate_take(tuple(), kwargs)
        indices = _ensure_platform_int(indices)
        taken = self._assert_take_fillable(self.labels, indices,
                                           allow_fill=allow_fill,
                                           fill_value=fill_value,
                                           na_value=-1)
        return MultiIndex(levels=self.levels, labels=taken,
                          names=self.names, verify_integrity=False)

    def _assert_take_fillable(self, values, indices, allow_fill=True,
                              fill_value=None, na_value=None):
        """ Internal method to handle NA filling of take """
        # only fill if we are passing a non-None fill_value
        if allow_fill and fill_value is not None:
            if (indices < -1).any():
                msg = ('When allow_fill=True and fill_value is not None, '
                       'all indices must be >= -1')
                raise ValueError(msg)
            taken = [lab.take(indices) for lab in self.labels]
            mask = indices == -1
            if mask.any():
                masked = []
                for new_label in taken:
                    label_values = new_label.values()
                    label_values[mask] = na_value
                    masked.append(FrozenNDArray(label_values))
                taken = masked
        else:
            taken = [lab.take(indices) for lab in self.labels]
        return taken

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
        if not isinstance(other, (list, tuple)):
            other = [other]

        if all((isinstance(o, MultiIndex) and o.nlevels >= self.nlevels)
               for o in other):
            arrays = []
            for i in range(self.nlevels):
                label = self._get_level_values(i)
                appended = [o._get_level_values(i) for o in other]
                arrays.append(label.append(appended))
            return MultiIndex.from_arrays(arrays, names=self.names)

        to_concat = (self.values, ) + tuple(k._values for k in other)
        new_tuples = np.concatenate(to_concat)

        # if all(isinstance(x, MultiIndex) for x in other):
        try:
            return MultiIndex.from_tuples(new_tuples, names=self.names)
        except:
            return Index(new_tuples)

    def argsort(self, *args, **kwargs):
        return self.values.argsort(*args, **kwargs)

    @deprecate_kwarg(old_arg_name='n', new_arg_name='repeats')
    def repeat(self, repeats, *args, **kwargs):
        nv.validate_repeat(args, kwargs)
        return MultiIndex(levels=self.levels,
                          labels=[label.view(np.ndarray).repeat(repeats)
                                  for label in self.labels], names=self.names,
                          sortorder=self.sortorder, verify_integrity=False)

    def where(self, cond, other=None):
        raise NotImplementedError(".where is not supported for "
                                  "MultiIndex operations")

    def drop(self, labels, level=None, errors='raise'):
        """
        Make new MultiIndex with passed list of labels deleted

        Parameters
        ----------
        labels : array-like
            Must be a list of tuples
        level : int or level name, default None

        Returns
        -------
        dropped : MultiIndex
        """
        if level is not None:
            return self._drop_from_level(labels, level)

        try:
            if not isinstance(labels, (np.ndarray, Index)):
                labels = com._index_labels_to_array(labels)
            indexer = self.get_indexer(labels)
            mask = indexer == -1
            if mask.any():
                if errors != 'ignore':
                    raise ValueError('labels %s not contained in axis' %
                                     labels[mask])
                indexer = indexer[~mask]
        except Exception:
            pass

        inds = []
        for label in labels:
            try:
                loc = self.get_loc(label)
                # get_loc returns either an integer, a slice, or a boolean
                # mask
                if isinstance(loc, int):
                    inds.append(loc)
                elif isinstance(loc, slice):
                    inds.extend(lrange(loc.start, loc.stop))
                elif is_bool_indexer(loc):
                    if self.lexsort_depth == 0:
                        warnings.warn('dropping on a non-lexsorted multi-index'
                                      ' without a level parameter may impact '
                                      'performance.',
                                      PerformanceWarning,
                                      stacklevel=3)
                    loc = loc.nonzero()[0]
                    inds.extend(loc)
                else:
                    msg = 'unsupported indexer of type {}'.format(type(loc))
                    raise AssertionError(msg)
            except KeyError:
                if errors != 'ignore':
                    raise

        return self.delete(inds)

    def _drop_from_level(self, labels, level):
        labels = com._index_labels_to_array(labels)
        i = self._get_level_number(level)
        index = self.levels[i]
        values = index.get_indexer(labels)

        mask = ~algos.isin(self.labels[i], values)

        return self[mask]

    def droplevel(self, level=0):
        """
        Return Index with requested level removed. If MultiIndex has only 2
        levels, the result will be of Index type not MultiIndex.

        Parameters
        ----------
        level : int/level name or list thereof

        Notes
        -----
        Does not check if result index is unique or not

        Returns
        -------
        index : Index or MultiIndex
        """
        levels = level
        if not isinstance(levels, (tuple, list)):
            levels = [level]

        new_levels = list(self.levels)
        new_labels = list(self.labels)
        new_names = list(self.names)

        levnums = sorted(self._get_level_number(lev) for lev in levels)[::-1]

        for i in levnums:
            new_levels.pop(i)
            new_labels.pop(i)
            new_names.pop(i)

        if len(new_levels) == 1:

            # set nan if needed
            mask = new_labels[0] == -1
            result = new_levels[0].take(new_labels[0])
            if mask.any():
                result = result.putmask(mask, np.nan)

            result.name = new_names[0]
            return result
        else:
            return MultiIndex(levels=new_levels, labels=new_labels,
                              names=new_names, verify_integrity=False)

    def swaplevel(self, i=-2, j=-1):
        """
        Swap level i with level j. Do not change the ordering of anything

        Parameters
        ----------
        i, j : int, string (can be mixed)
            Level of index to be swapped. Can pass level name as string.

        Returns
        -------
        swapped : MultiIndex

        .. versionchanged:: 0.18.1

           The indexes ``i`` and ``j`` are now optional, and default to
           the two innermost levels of the index.

        """
        new_levels = list(self.levels)
        new_labels = list(self.labels)
        new_names = list(self.names)

        i = self._get_level_number(i)
        j = self._get_level_number(j)

        new_levels[i], new_levels[j] = new_levels[j], new_levels[i]
        new_labels[i], new_labels[j] = new_labels[j], new_labels[i]
        new_names[i], new_names[j] = new_names[j], new_names[i]

        return MultiIndex(levels=new_levels, labels=new_labels,
                          names=new_names, verify_integrity=False)

    def reorder_levels(self, order):
        """
        Rearrange levels using input order. May not drop or duplicate levels

        Parameters
        ----------
        """
        order = [self._get_level_number(i) for i in order]
        if len(order) != self.nlevels:
            raise AssertionError('Length of order must be same as '
                                 'number of levels (%d), got %d' %
                                 (self.nlevels, len(order)))
        new_levels = [self.levels[i] for i in order]
        new_labels = [self.labels[i] for i in order]
        new_names = [self.names[i] for i in order]

        return MultiIndex(levels=new_levels, labels=new_labels,
                          names=new_names, verify_integrity=False)

    def __getslice__(self, i, j):
        return self.__getitem__(slice(i, j))

    def _get_labels_for_sorting(self):
        """
        we categorizing our labels by using the
        available catgories (all, not just observed)
        excluding any missing ones (-1); this is in preparation
        for sorting, where we need to disambiguate that -1 is not
        a valid valid
        """
        from pandas.core.categorical import Categorical

        def cats(label):
            return np.arange(np.array(label).max() + 1 if len(label) else 0,
                             dtype=label.dtype)

        return [Categorical.from_codes(label, cats(label), ordered=True)
                for label in self.labels]

    def sortlevel(self, level=0, ascending=True, sort_remaining=True):
        """
        Sort MultiIndex at the requested level. The result will respect the
        original ordering of the associated factor at that level.

        Parameters
        ----------
        level : list-like, int or str, default 0
            If a string is given, must be a name of the level
            If list-like must be names or ints of levels.
        ascending : boolean, default True
            False to sort in descending order
            Can also be a list to specify a directed ordering
        sort_remaining : sort by the remaining levels after level.

        Returns
        -------
        sorted_index : pd.MultiIndex
            Resulting index
        indexer : np.ndarray
            Indices of output values in original index

        """
        from pandas.core.sorting import indexer_from_factorized

        if isinstance(level, (compat.string_types, int)):
            level = [level]
        level = [self._get_level_number(lev) for lev in level]
        sortorder = None

        # we have a directed ordering via ascending
        if isinstance(ascending, list):
            if not len(level) == len(ascending):
                raise ValueError("level must have same length as ascending")

            from pandas.core.sorting import lexsort_indexer
            indexer = lexsort_indexer(self.labels, orders=ascending)

        # level ordering
        else:

            labels = list(self.labels)
            shape = list(self.levshape)

            # partition labels and shape
            primary = tuple(labels.pop(lev - i) for i, lev in enumerate(level))
            primshp = tuple(shape.pop(lev - i) for i, lev in enumerate(level))

            if sort_remaining:
                primary += primary + tuple(labels)
                primshp += primshp + tuple(shape)
            else:
                sortorder = level[0]

            indexer = indexer_from_factorized(primary, primshp,
                                              compress=False)

            if not ascending:
                indexer = indexer[::-1]

        indexer = _ensure_platform_int(indexer)
        new_labels = [lab.take(indexer) for lab in self.labels]

        new_index = MultiIndex(labels=new_labels, levels=self.levels,
                               names=self.names, sortorder=sortorder,
                               verify_integrity=False)

        return new_index, indexer

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
        indexer, keyarr = super(MultiIndex, self)._convert_listlike_indexer(
            keyarr, kind=kind)

        # are we indexing a specific level
        if indexer is None and len(keyarr) and not isinstance(keyarr[0],
                                                              tuple):
            level = 0
            _, indexer = self.reindex(keyarr, level=level)

            # take all
            if indexer is None:
                indexer = np.arange(len(self))

            check = self.levels[0].get_indexer(keyarr)
            mask = check == -1
            if mask.any():
                raise KeyError('%s not in index' % keyarr[mask])

        return indexer, keyarr

    @Appender(_index_shared_docs['get_indexer'] % _index_doc_kwargs)
    def get_indexer(self, target, method=None, limit=None, tolerance=None):
        method = missing.clean_reindex_fill_method(method)
        target = _ensure_index(target)

        # empty indexer
        if is_list_like(target) and not len(target):
            return _ensure_platform_int(np.array([]))

        if not isinstance(target, MultiIndex):
            try:
                target = MultiIndex.from_tuples(target)
            except (TypeError, ValueError):

                # let's instead try with a straight Index
                if method is None:
                    return Index(self.values).get_indexer(target,
                                                          method=method,
                                                          limit=limit,
                                                          tolerance=tolerance)

        if not self.is_unique:
            raise Exception('Reindexing only valid with uniquely valued Index '
                            'objects')

        if method == 'pad' or method == 'backfill':
            if tolerance is not None:
                raise NotImplementedError("tolerance not implemented yet "
                                          'for MultiIndex')
            indexer = self._get_fill_indexer(target, method, limit)
        elif method == 'nearest':
            raise NotImplementedError("method='nearest' not implemented yet "
                                      'for MultiIndex; see GitHub issue 9365')
        else:
            # we may not compare equally because of hashing if we
            # don't have the same dtypes
            if self._inferred_type_levels != target._inferred_type_levels:
                return Index(self.values).get_indexer(target.values)

            indexer = self._engine.get_indexer(target)

        return _ensure_platform_int(indexer)

    @Appender(_index_shared_docs['get_indexer_non_unique'] % _index_doc_kwargs)
    def get_indexer_non_unique(self, target):
        return super(MultiIndex, self).get_indexer_non_unique(target)

    def reindex(self, target, method=None, level=None, limit=None,
                tolerance=None):
        """
        Create index with target's values (move/add/delete values as necessary)

        Returns
        -------
        new_index : pd.MultiIndex
            Resulting index
        indexer : np.ndarray or None
            Indices of output values in original index

        """
        # GH6552: preserve names when reindexing to non-named target
        # (i.e. neither Index nor Series).
        preserve_names = not hasattr(target, 'names')

        if level is not None:
            if method is not None:
                raise TypeError('Fill method not supported if level passed')

            # GH7774: preserve dtype/tz if target is empty and not an Index.
            # target may be an iterator
            target = ibase._ensure_has_len(target)
            if len(target) == 0 and not isinstance(target, Index):
                idx = self.levels[level]
                attrs = idx._get_attributes_dict()
                attrs.pop('freq', None)  # don't preserve freq
                target = type(idx)._simple_new(np.empty(0, dtype=idx.dtype),
                                               **attrs)
            else:
                target = _ensure_index(target)
            target, indexer, _ = self._join_level(target, level, how='right',
                                                  return_indexers=True,
                                                  keep_order=False)
        else:
            target = _ensure_index(target)
            if self.equals(target):
                indexer = None
            else:
                if self.is_unique:
                    indexer = self.get_indexer(target, method=method,
                                               limit=limit,
                                               tolerance=tolerance)
                else:
                    raise Exception("cannot handle a non-unique multi-index!")

        if not isinstance(target, MultiIndex):
            if indexer is None:
                target = self
            elif (indexer >= 0).all():
                target = self.take(indexer)
            else:
                # hopefully?
                target = MultiIndex.from_tuples(target)

        if (preserve_names and target.nlevels == self.nlevels and
                target.names != self.names):
            target = target.copy(deep=False)
            target.names = self.names

        return target, indexer

    def get_slice_bound(self, label, side, kind):

        if not isinstance(label, tuple):
            label = label,
        return self._partial_tup_index(label, side=side)

    def slice_locs(self, start=None, end=None, step=None, kind=None):
        """
        For an ordered MultiIndex, compute the slice locations for input
        labels. They can be tuples representing partial levels, e.g. for a
        MultiIndex with 3 levels, you can pass a single value (corresponding to
        the first level), or a 1-, 2-, or 3-tuple.

        Parameters
        ----------
        start : label or tuple, default None
            If None, defaults to the beginning
        end : label or tuple
            If None, defaults to the end
        step : int or None
            Slice step
        kind : string, optional, defaults None

        Returns
        -------
        (start, end) : (int, int)

        Notes
        -----
        This function assumes that the data is sorted by the first level
        """
        # This function adds nothing to its parent implementation (the magic
        # happens in get_slice_bound method), but it adds meaningful doc.
        return super(MultiIndex, self).slice_locs(start, end, step, kind=kind)

    def _partial_tup_index(self, tup, side='left'):
        if len(tup) > self.lexsort_depth:
            raise UnsortedIndexError(
                'Key length (%d) was greater than MultiIndex'
                ' lexsort depth (%d)' %
                (len(tup), self.lexsort_depth))

        n = len(tup)
        start, end = 0, len(self)
        zipped = zip(tup, self.levels, self.labels)
        for k, (lab, lev, labs) in enumerate(zipped):
            section = labs[start:end]

            if lab not in lev:
                if not lev.is_type_compatible(lib.infer_dtype([lab])):
                    raise TypeError('Level type mismatch: %s' % lab)

                # short circuit
                loc = lev.searchsorted(lab, side=side)
                if side == 'right' and loc >= 0:
                    loc -= 1
                return start + section.searchsorted(loc, side=side)

            idx = lev.get_loc(lab)
            if k < n - 1:
                end = start + section.searchsorted(idx, side='right')
                start = start + section.searchsorted(idx, side='left')
            else:
                return start + section.searchsorted(idx, side=side)

    def get_loc(self, key, method=None):
        """
        Get integer location, slice or boolean mask for requested label or
        tuple.  If the key is past the lexsort depth, the return may be a
        boolean mask array, otherwise it is always a slice or int.

        Parameters
        ----------
        key : label or tuple
        method : None

        Returns
        -------
        loc : int, slice object or boolean mask
        """
        if method is not None:
            raise NotImplementedError('only the default get_loc method is '
                                      'currently supported for MultiIndex')

        def _maybe_to_slice(loc):
            """convert integer indexer to boolean mask or slice if possible"""
            if not isinstance(loc, np.ndarray) or loc.dtype != 'int64':
                return loc

            loc = lib.maybe_indices_to_slice(loc, len(self))
            if isinstance(loc, slice):
                return loc

            mask = np.empty(len(self), dtype='bool')
            mask.fill(False)
            mask[loc] = True
            return mask

        if not isinstance(key, tuple):
            loc = self._get_level_indexer(key, level=0)
            return _maybe_to_slice(loc)

        keylen = len(key)
        if self.nlevels < keylen:
            raise KeyError('Key length ({0}) exceeds index depth ({1})'
                           ''.format(keylen, self.nlevels))

        if keylen == self.nlevels and self.is_unique:

            def _maybe_str_to_time_stamp(key, lev):
                if lev.is_all_dates and not isinstance(key, Timestamp):
                    try:
                        return Timestamp(key, tz=getattr(lev, 'tz', None))
                    except Exception:
                        pass
                return key

            key = _values_from_object(key)
            key = tuple(map(_maybe_str_to_time_stamp, key, self.levels))
            return self._engine.get_loc(key)

        # -- partial selection or non-unique index
        # break the key into 2 parts based on the lexsort_depth of the index;
        # the first part returns a continuous slice of the index; the 2nd part
        # needs linear search within the slice
        i = self.lexsort_depth
        lead_key, follow_key = key[:i], key[i:]
        start, stop = (self.slice_locs(lead_key, lead_key)
                       if lead_key else (0, len(self)))

        if start == stop:
            raise KeyError(key)

        if not follow_key:
            return slice(start, stop)

        warnings.warn('indexing past lexsort depth may impact performance.',
                      PerformanceWarning, stacklevel=10)

        loc = np.arange(start, stop, dtype='int64')

        for i, k in enumerate(follow_key, len(lead_key)):
            mask = self.labels[i][loc] == self.levels[i].get_loc(k)
            if not mask.all():
                loc = loc[mask]
            if not len(loc):
                raise KeyError(key)

        return (_maybe_to_slice(loc) if len(loc) != stop - start else
                slice(start, stop))

    def get_loc_level(self, key, level=0, drop_level=True):
        """
        Get integer location slice for requested label or tuple

        Parameters
        ----------
        key : label or tuple
        level : int/level name or list thereof

        Returns
        -------
        loc : int or slice object
        """

        def maybe_droplevels(indexer, levels, drop_level):
            if not drop_level:
                return self[indexer]
            # kludgearound
            orig_index = new_index = self[indexer]
            levels = [self._get_level_number(i) for i in levels]
            for i in sorted(levels, reverse=True):
                try:
                    new_index = new_index.droplevel(i)
                except:

                    # no dropping here
                    return orig_index
            return new_index

        if isinstance(level, (tuple, list)):
            if len(key) != len(level):
                raise AssertionError('Key for location must have same '
                                     'length as number of levels')
            result = None
            for lev, k in zip(level, key):
                loc, new_index = self.get_loc_level(k, level=lev)
                if isinstance(loc, slice):
                    mask = np.zeros(len(self), dtype=bool)
                    mask[loc] = True
                    loc = mask

                result = loc if result is None else result & loc

            return result, maybe_droplevels(result, level, drop_level)

        level = self._get_level_number(level)

        # kludge for #1796
        if isinstance(key, list):
            key = tuple(key)

        if isinstance(key, tuple) and level == 0:

            try:
                if key in self.levels[0]:
                    indexer = self._get_level_indexer(key, level=level)
                    new_index = maybe_droplevels(indexer, [0], drop_level)
                    return indexer, new_index
            except TypeError:
                pass

            if not any(isinstance(k, slice) for k in key):

                # partial selection
                # optionally get indexer to avoid re-calculation
                def partial_selection(key, indexer=None):
                    if indexer is None:
                        indexer = self.get_loc(key)
                    ilevels = [i for i in range(len(key))
                               if key[i] != slice(None, None)]
                    return indexer, maybe_droplevels(indexer, ilevels,
                                                     drop_level)

                if len(key) == self.nlevels:

                    if self.is_unique:

                        # here we have a completely specified key, but are
                        # using some partial string matching here
                        # GH4758
                        all_dates = [(l.is_all_dates and
                                      not isinstance(k, compat.string_types))
                                     for k, l in zip(key, self.levels)]
                        can_index_exactly = any(all_dates)
                        if (any([l.is_all_dates
                                 for k, l in zip(key, self.levels)]) and
                                not can_index_exactly):
                            indexer = self.get_loc(key)

                            # we have a multiple selection here
                            if (not isinstance(indexer, slice) or
                                    indexer.stop - indexer.start != 1):
                                return partial_selection(key, indexer)

                            key = tuple(self[indexer].tolist()[0])

                        return (self._engine.get_loc(
                            _values_from_object(key)), None)

                    else:
                        return partial_selection(key)
                else:
                    return partial_selection(key)
            else:
                indexer = None
                for i, k in enumerate(key):
                    if not isinstance(k, slice):
                        k = self._get_level_indexer(k, level=i)
                        if isinstance(k, slice):
                            # everything
                            if k.start == 0 and k.stop == len(self):
                                k = slice(None, None)
                        else:
                            k_index = k

                    if isinstance(k, slice):
                        if k == slice(None, None):
                            continue
                        else:
                            raise TypeError(key)

                    if indexer is None:
                        indexer = k_index
                    else:  # pragma: no cover
                        indexer &= k_index
                if indexer is None:
                    indexer = slice(None, None)
                ilevels = [i for i in range(len(key))
                           if key[i] != slice(None, None)]
                return indexer, maybe_droplevels(indexer, ilevels, drop_level)
        else:
            indexer = self._get_level_indexer(key, level=level)
            return indexer, maybe_droplevels(indexer, [level], drop_level)

    def _get_level_indexer(self, key, level=0, indexer=None):
        # return an indexer, boolean array or a slice showing where the key is
        # in the totality of values
        # if the indexer is provided, then use this

        level_index = self.levels[level]
        labels = self.labels[level]

        def convert_indexer(start, stop, step, indexer=indexer, labels=labels):
            # given the inputs and the labels/indexer, compute an indexer set
            # if we have a provided indexer, then this need not consider
            # the entire labels set

            r = np.arange(start, stop, step)
            if indexer is not None and len(indexer) != len(labels):

                # we have an indexer which maps the locations in the labels
                # that we have already selected (and is not an indexer for the
                # entire set) otherwise this is wasteful so we only need to
                # examine locations that are in this set the only magic here is
                # that the result are the mappings to the set that we have
                # selected
                from pandas import Series
                mapper = Series(indexer)
                indexer = labels.take(_ensure_platform_int(indexer))
                result = Series(Index(indexer).isin(r).nonzero()[0])
                m = result.map(mapper)._values

            else:
                m = np.zeros(len(labels), dtype=bool)
                m[np.in1d(labels, r,
                          assume_unique=Index(labels).is_unique)] = True

            return m

        if isinstance(key, slice):
            # handle a slice, returnig a slice if we can
            # otherwise a boolean indexer

            try:
                if key.start is not None:
                    start = level_index.get_loc(key.start)
                else:
                    start = 0
                if key.stop is not None:
                    stop = level_index.get_loc(key.stop)
                else:
                    stop = len(level_index) - 1
                step = key.step
            except KeyError:

                # we have a partial slice (like looking up a partial date
                # string)
                start = stop = level_index.slice_indexer(key.start, key.stop,
                                                         key.step, kind='loc')
                step = start.step

            if isinstance(start, slice) or isinstance(stop, slice):
                # we have a slice for start and/or stop
                # a partial date slicer on a DatetimeIndex generates a slice
                # note that the stop ALREADY includes the stopped point (if
                # it was a string sliced)
                return convert_indexer(start.start, stop.stop, step)

            elif level > 0 or self.lexsort_depth == 0 or step is not None:
                # need to have like semantics here to right
                # searching as when we are using a slice
                # so include the stop+1 (so we include stop)
                return convert_indexer(start, stop + 1, step)
            else:
                # sorted, so can return slice object -> view
                i = labels.searchsorted(start, side='left')
                j = labels.searchsorted(stop, side='right')
                return slice(i, j, step)

        else:

            loc = level_index.get_loc(key)
            if isinstance(loc, slice):
                return loc
            elif level > 0 or self.lexsort_depth == 0:
                return np.array(labels == loc, dtype=bool)

            i = labels.searchsorted(loc, side='left')
            j = labels.searchsorted(loc, side='right')
            return slice(i, j)

    def get_locs(self, tup):
        """
        Given a tuple of slices/lists/labels/boolean indexer to a level-wise
        spec produce an indexer to extract those locations

        Parameters
        ----------
        key : tuple of (slices/list/labels)

        Returns
        -------
        locs : integer list of locations or boolean indexer suitable
               for passing to iloc
        """

        # must be lexsorted to at least as many levels
        if not self.is_lexsorted_for_tuple(tup):
            raise UnsortedIndexError('MultiIndex Slicing requires the index '
                                     'to be fully lexsorted tuple len ({0}), '
                                     'lexsort depth ({1})'
                                     .format(len(tup), self.lexsort_depth))

        # indexer
        # this is the list of all values that we want to select
        n = len(self)
        indexer = None

        def _convert_to_indexer(r):
            # return an indexer
            if isinstance(r, slice):
                m = np.zeros(n, dtype=bool)
                m[r] = True
                r = m.nonzero()[0]
            elif is_bool_indexer(r):
                if len(r) != n:
                    raise ValueError("cannot index with a boolean indexer "
                                     "that is not the same length as the "
                                     "index")
                r = r.nonzero()[0]
            from .numeric import Int64Index
            return Int64Index(r)

        def _update_indexer(idxr, indexer=indexer):
            if indexer is None:
                indexer = Index(np.arange(n))
            if idxr is None:
                return indexer
            return indexer & idxr

        for i, k in enumerate(tup):

            if is_bool_indexer(k):
                # a boolean indexer, must be the same length!
                k = np.asarray(k)
                indexer = _update_indexer(_convert_to_indexer(k),
                                          indexer=indexer)

            elif is_list_like(k):
                # a collection of labels to include from this level (these
                # are or'd)
                indexers = None
                for x in k:
                    try:
                        idxrs = _convert_to_indexer(
                            self._get_level_indexer(x, level=i,
                                                    indexer=indexer))
                        indexers = (idxrs if indexers is None
                                    else indexers | idxrs)
                    except KeyError:

                        # ignore not founds
                        continue

                if indexers is not None:
                    indexer = _update_indexer(indexers, indexer=indexer)
                else:
                    from .numeric import Int64Index
                    # no matches we are done
                    return Int64Index([])._values

            elif is_null_slice(k):
                # empty slice
                indexer = _update_indexer(None, indexer=indexer)

            elif isinstance(k, slice):

                # a slice, include BOTH of the labels
                indexer = _update_indexer(_convert_to_indexer(
                    self._get_level_indexer(k, level=i, indexer=indexer)),
                    indexer=indexer)
            else:
                # a single label
                indexer = _update_indexer(_convert_to_indexer(
                    self.get_loc_level(k, level=i, drop_level=False)[0]),
                    indexer=indexer)

        # empty indexer
        if indexer is None:
            return Int64Index([])._values
        return indexer._values

    def truncate(self, before=None, after=None):
        """
        Slice index between two labels / tuples, return new MultiIndex

        Parameters
        ----------
        before : label or tuple, can be partial. Default None
            None defaults to start
        after : label or tuple, can be partial. Default None
            None defaults to end

        Returns
        -------
        truncated : MultiIndex
        """
        if after and before and after < before:
            raise ValueError('after < before')

        i, j = self.levels[0].slice_locs(before, after)
        left, right = self.slice_locs(before, after)

        new_levels = list(self.levels)
        new_levels[0] = new_levels[0][i:j]

        new_labels = [lab[left:right] for lab in self.labels]
        new_labels[0] = new_labels[0] - i

        return MultiIndex(levels=new_levels, labels=new_labels,
                          verify_integrity=False)

    def equals(self, other):
        """
        Determines if two MultiIndex objects have the same labeling information
        (the levels themselves do not necessarily have to be the same)

        See also
        --------
        equal_levels
        """
        if self.is_(other):
            return True

        if not isinstance(other, Index):
            return False

        if not isinstance(other, MultiIndex):
            return array_equivalent(self._values,
                                    _values_from_object(_ensure_index(other)))

        if self.nlevels != other.nlevels:
            return False

        if len(self) != len(other):
            return False

        for i in range(self.nlevels):
            slabels = self.labels[i]
            slabels = slabels[slabels != -1]
            svalues = algos.take_nd(np.asarray(self.levels[i]._values),
                                    slabels, allow_fill=False)

            olabels = other.labels[i]
            olabels = olabels[olabels != -1]
            ovalues = algos.take_nd(np.asarray(other.levels[i]._values),
                                    olabels, allow_fill=False)

            # since we use NaT both datetime64 and timedelta64
            # we can have a situation where a level is typed say
            # timedelta64 in self (IOW it has other values than NaT)
            # but types datetime64 in other (where its all NaT)
            # but these are equivalent
            if len(svalues) == 0 and len(ovalues) == 0:
                continue

            if not array_equivalent(svalues, ovalues):
                return False

        return True

    def equal_levels(self, other):
        """
        Return True if the levels of both MultiIndex objects are the same

        """
        if self.nlevels != other.nlevels:
            return False

        for i in range(self.nlevels):
            if not self.levels[i].equals(other.levels[i]):
                return False
        return True

    def union(self, other):
        """
        Form the union of two MultiIndex objects, sorting if possible

        Parameters
        ----------
        other : MultiIndex or array / Index of tuples

        Returns
        -------
        Index

        >>> index.union(index2)
        """
        self._assert_can_do_setop(other)
        other, result_names = self._convert_can_do_setop(other)

        if len(other) == 0 or self.equals(other):
            return self

        uniq_tuples = lib.fast_unique_multiple([self._values, other._values])
        return MultiIndex.from_arrays(lzip(*uniq_tuples), sortorder=0,
                                      names=result_names)

    def intersection(self, other):
        """
        Form the intersection of two MultiIndex objects, sorting if possible

        Parameters
        ----------
        other : MultiIndex or array / Index of tuples

        Returns
        -------
        Index
        """
        self._assert_can_do_setop(other)
        other, result_names = self._convert_can_do_setop(other)

        if self.equals(other):
            return self

        self_tuples = self._values
        other_tuples = other._values
        uniq_tuples = sorted(set(self_tuples) & set(other_tuples))
        if len(uniq_tuples) == 0:
            return MultiIndex(levels=[[]] * self.nlevels,
                              labels=[[]] * self.nlevels,
                              names=result_names, verify_integrity=False)
        else:
            return MultiIndex.from_arrays(lzip(*uniq_tuples), sortorder=0,
                                          names=result_names)

    def difference(self, other):
        """
        Compute sorted set difference of two MultiIndex objects

        Returns
        -------
        diff : MultiIndex
        """
        self._assert_can_do_setop(other)
        other, result_names = self._convert_can_do_setop(other)

        if len(other) == 0:
            return self

        if self.equals(other):
            return MultiIndex(levels=[[]] * self.nlevels,
                              labels=[[]] * self.nlevels,
                              names=result_names, verify_integrity=False)

        difference = sorted(set(self._values) - set(other._values))

        if len(difference) == 0:
            return MultiIndex(levels=[[]] * self.nlevels,
                              labels=[[]] * self.nlevels,
                              names=result_names, verify_integrity=False)
        else:
            return MultiIndex.from_tuples(difference, sortorder=0,
                                          names=result_names)

    @Appender(_index_shared_docs['astype'])
    def astype(self, dtype, copy=True):
        if not is_object_dtype(np.dtype(dtype)):
            raise TypeError('Setting %s dtype to anything other than object '
                            'is not supported' % self.__class__)
        elif copy is True:
            return self._shallow_copy()
        return self

    def _convert_can_do_setop(self, other):
        result_names = self.names

        if not hasattr(other, 'names'):
            if len(other) == 0:
                other = MultiIndex(levels=[[]] * self.nlevels,
                                   labels=[[]] * self.nlevels,
                                   verify_integrity=False)
            else:
                msg = 'other must be a MultiIndex or a list of tuples'
                try:
                    other = MultiIndex.from_tuples(other)
                except:
                    raise TypeError(msg)
        else:
            result_names = self.names if self.names == other.names else None
        return other, result_names

    def insert(self, loc, item):
        """
        Make new MultiIndex inserting new item at location

        Parameters
        ----------
        loc : int
        item : tuple
            Must be same length as number of levels in the MultiIndex

        Returns
        -------
        new_index : Index
        """
        # Pad the key with empty strings if lower levels of the key
        # aren't specified:
        if not isinstance(item, tuple):
            item = (item, ) + ('', ) * (self.nlevels - 1)
        elif len(item) != self.nlevels:
            raise ValueError('Item must have length equal to number of '
                             'levels.')

        new_levels = []
        new_labels = []
        for k, level, labels in zip(item, self.levels, self.labels):
            if k not in level:
                # have to insert into level
                # must insert at end otherwise you have to recompute all the
                # other labels
                lev_loc = len(level)
                level = level.insert(lev_loc, k)
            else:
                lev_loc = level.get_loc(k)

            new_levels.append(level)
            new_labels.append(np.insert(_ensure_int64(labels), loc, lev_loc))

        return MultiIndex(levels=new_levels, labels=new_labels,
                          names=self.names, verify_integrity=False)

    def delete(self, loc):
        """
        Make new index with passed location deleted

        Returns
        -------
        new_index : MultiIndex
        """
        new_labels = [np.delete(lab, loc) for lab in self.labels]
        return MultiIndex(levels=self.levels, labels=new_labels,
                          names=self.names, verify_integrity=False)

    get_major_bounds = slice_locs

    __bounds = None

    @property
    def _bounds(self):
        """
        Return or compute and return slice points for level 0, assuming
        sortedness
        """
        if self.__bounds is None:
            inds = np.arange(len(self.levels[0]))
            self.__bounds = self.labels[0].searchsorted(inds)

        return self.__bounds

    def _wrap_joined_index(self, joined, other):
        names = self.names if self.names == other.names else None
        return MultiIndex.from_tuples(joined, names=names)

    @Appender(Index.isin.__doc__)
    def isin(self, values, level=None):
        if level is None:
            return algos.isin(self.values,
                              MultiIndex.from_tuples(values).values)
        else:
            num = self._get_level_number(level)
            levs = self.levels[num]
            labs = self.labels[num]

            sought_labels = levs.isin(values).nonzero()[0]
            if levs.size == 0:
                return np.zeros(len(labs), dtype=np.bool_)
            else:
                return np.lib.arraysetops.in1d(labs, sought_labels)


MultiIndex._add_numeric_methods_disabled()
MultiIndex._add_numeric_methods_add_sub_disabled()
MultiIndex._add_logical_methods_disabled()


def _sparsify(label_list, start=0, sentinel=''):
    pivoted = lzip(*label_list)
    k = len(label_list)

    result = pivoted[:start + 1]
    prev = pivoted[start]

    for cur in pivoted[start + 1:]:
        sparse_cur = []

        for i, (p, t) in enumerate(zip(prev, cur)):
            if i == k - 1:
                sparse_cur.append(t)
                result.append(sparse_cur)
                break

            if p == t:
                sparse_cur.append(sentinel)
            else:
                sparse_cur.extend(cur[i:])
                result.append(sparse_cur)
                break

        prev = cur

    return lzip(*result)


def _get_na_rep(dtype):
    return {np.datetime64: 'NaT', np.timedelta64: 'NaT'}.get(dtype, 'NaN')
