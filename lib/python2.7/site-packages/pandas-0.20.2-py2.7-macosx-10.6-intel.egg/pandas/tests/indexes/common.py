# -*- coding: utf-8 -*-

import pytest

from pandas import compat
from pandas.compat import PY3

import numpy as np

from pandas import (Series, Index, Float64Index, Int64Index, UInt64Index,
                    RangeIndex, MultiIndex, CategoricalIndex, DatetimeIndex,
                    TimedeltaIndex, PeriodIndex, IntervalIndex,
                    notnull, isnull)
from pandas.core.indexes.datetimelike import DatetimeIndexOpsMixin
from pandas.core.dtypes.common import needs_i8_conversion
from pandas._libs.tslib import iNaT

import pandas.util.testing as tm

import pandas as pd


class Base(object):
    """ base class for index sub-class tests """
    _holder = None
    _compat_props = ['shape', 'ndim', 'size', 'itemsize', 'nbytes']

    def setup_indices(self):
        for name, idx in self.indices.items():
            setattr(self, name, idx)

    def verify_pickle(self, index):
        unpickled = tm.round_trip_pickle(index)
        assert index.equals(unpickled)

    def test_pickle_compat_construction(self):
        # this is testing for pickle compat
        if self._holder is None:
            return

        # need an object to create with
        pytest.raises(TypeError, self._holder)

    def test_to_series(self):
        # assert that we are creating a copy of the index

        idx = self.create_index()
        s = idx.to_series()
        assert s.values is not idx.values
        assert s.index is not idx
        assert s.name == idx.name

    def test_shift(self):

        # GH8083 test the base class for shift
        idx = self.create_index()
        pytest.raises(NotImplementedError, idx.shift, 1)
        pytest.raises(NotImplementedError, idx.shift, 1, 2)

    def test_create_index_existing_name(self):

        # GH11193, when an existing index is passed, and a new name is not
        # specified, the new index should inherit the previous object name
        expected = self.create_index()
        if not isinstance(expected, MultiIndex):
            expected.name = 'foo'
            result = pd.Index(expected)
            tm.assert_index_equal(result, expected)

            result = pd.Index(expected, name='bar')
            expected.name = 'bar'
            tm.assert_index_equal(result, expected)
        else:
            expected.names = ['foo', 'bar']
            result = pd.Index(expected)
            tm.assert_index_equal(
                result, Index(Index([('foo', 'one'), ('foo', 'two'),
                                     ('bar', 'one'), ('baz', 'two'),
                                     ('qux', 'one'), ('qux', 'two')],
                                    dtype='object'),
                              names=['foo', 'bar']))

            result = pd.Index(expected, names=['A', 'B'])
            tm.assert_index_equal(
                result,
                Index(Index([('foo', 'one'), ('foo', 'two'), ('bar', 'one'),
                             ('baz', 'two'), ('qux', 'one'), ('qux', 'two')],
                            dtype='object'), names=['A', 'B']))

    def test_numeric_compat(self):

        idx = self.create_index()
        tm.assert_raises_regex(TypeError, "cannot perform __mul__",
                               lambda: idx * 1)
        tm.assert_raises_regex(TypeError, "cannot perform __mul__",
                               lambda: 1 * idx)

        div_err = "cannot perform __truediv__" if PY3 \
                  else "cannot perform __div__"
        tm.assert_raises_regex(TypeError, div_err, lambda: idx / 1)
        tm.assert_raises_regex(TypeError, div_err, lambda: 1 / idx)
        tm.assert_raises_regex(TypeError, "cannot perform __floordiv__",
                               lambda: idx // 1)
        tm.assert_raises_regex(TypeError, "cannot perform __floordiv__",
                               lambda: 1 // idx)

    def test_logical_compat(self):
        idx = self.create_index()
        tm.assert_raises_regex(TypeError, 'cannot perform all',
                               lambda: idx.all())
        tm.assert_raises_regex(TypeError, 'cannot perform any',
                               lambda: idx.any())

    def test_boolean_context_compat(self):

        # boolean context compat
        idx = self.create_index()

        def f():
            if idx:
                pass

        tm.assert_raises_regex(ValueError, 'The truth value of a', f)

    def test_reindex_base(self):
        idx = self.create_index()
        expected = np.arange(idx.size, dtype=np.intp)

        actual = idx.get_indexer(idx)
        tm.assert_numpy_array_equal(expected, actual)

        with tm.assert_raises_regex(ValueError, 'Invalid fill method'):
            idx.get_indexer(idx, method='invalid')

    def test_ndarray_compat_properties(self):
        idx = self.create_index()
        assert idx.T.equals(idx)
        assert idx.transpose().equals(idx)

        values = idx.values
        for prop in self._compat_props:
            assert getattr(idx, prop) == getattr(values, prop)

        # test for validity
        idx.nbytes
        idx.values.nbytes

    def test_repr_roundtrip(self):

        idx = self.create_index()
        tm.assert_index_equal(eval(repr(idx)), idx)

    def test_str(self):

        # test the string repr
        idx = self.create_index()
        idx.name = 'foo'
        assert "'foo'" in str(idx)
        assert idx.__class__.__name__ in str(idx)

    def test_dtype_str(self):
        for idx in self.indices.values():
            dtype = idx.dtype_str
            assert isinstance(dtype, compat.string_types)
            assert dtype == str(idx.dtype)

    def test_repr_max_seq_item_setting(self):
        # GH10182
        idx = self.create_index()
        idx = idx.repeat(50)
        with pd.option_context("display.max_seq_items", None):
            repr(idx)
            assert '...' not in str(idx)

    def test_wrong_number_names(self):
        def testit(ind):
            ind.names = ["apple", "banana", "carrot"]

        for ind in self.indices.values():
            tm.assert_raises_regex(ValueError, "^Length", testit, ind)

    def test_set_name_methods(self):
        new_name = "This is the new name for this index"
        for ind in self.indices.values():

            # don't tests a MultiIndex here (as its tested separated)
            if isinstance(ind, MultiIndex):
                continue

            original_name = ind.name
            new_ind = ind.set_names([new_name])
            assert new_ind.name == new_name
            assert ind.name == original_name
            res = ind.rename(new_name, inplace=True)

            # should return None
            assert res is None
            assert ind.name == new_name
            assert ind.names == [new_name]
            # with tm.assert_raises_regex(TypeError, "list-like"):
            #    # should still fail even if it would be the right length
            #    ind.set_names("a")
            with tm.assert_raises_regex(ValueError, "Level must be None"):
                ind.set_names("a", level=0)

            # rename in place just leaves tuples and other containers alone
            name = ('A', 'B')
            ind.rename(name, inplace=True)
            assert ind.name == name
            assert ind.names == [name]

    def test_hash_error(self):
        for ind in self.indices.values():
            with tm.assert_raises_regex(TypeError, "unhashable type: %r" %
                                        type(ind).__name__):
                hash(ind)

    def test_copy_name(self):
        # gh-12309: Check that the "name" argument
        # passed at initialization is honored.

        for name, index in compat.iteritems(self.indices):
            if isinstance(index, MultiIndex):
                continue

            first = index.__class__(index, copy=True, name='mario')
            second = first.__class__(first, copy=False)

            # Even though "copy=False", we want a new object.
            assert first is not second

            # Not using tm.assert_index_equal() since names differ.
            assert index.equals(first)

            assert first.name == 'mario'
            assert second.name == 'mario'

            s1 = Series(2, index=first)
            s2 = Series(3, index=second[:-1])

            if not isinstance(index, CategoricalIndex):
                # See gh-13365
                s3 = s1 * s2
                assert s3.index.name == 'mario'

    def test_ensure_copied_data(self):
        # Check the "copy" argument of each Index.__new__ is honoured
        # GH12309
        for name, index in compat.iteritems(self.indices):
            init_kwargs = {}
            if isinstance(index, PeriodIndex):
                # Needs "freq" specification:
                init_kwargs['freq'] = index.freq
            elif isinstance(index, (RangeIndex, MultiIndex, CategoricalIndex)):
                # RangeIndex cannot be initialized from data
                # MultiIndex and CategoricalIndex are tested separately
                continue

            index_type = index.__class__
            result = index_type(index.values, copy=True, **init_kwargs)
            tm.assert_index_equal(index, result)
            tm.assert_numpy_array_equal(index.values, result.values,
                                        check_same='copy')

            if isinstance(index, PeriodIndex):
                # .values an object array of Period, thus copied
                result = index_type(ordinal=index.asi8, copy=False,
                                    **init_kwargs)
                tm.assert_numpy_array_equal(index._values, result._values,
                                            check_same='same')
            elif isinstance(index, IntervalIndex):
                # checked in test_interval.py
                pass
            else:
                result = index_type(index.values, copy=False, **init_kwargs)
                tm.assert_numpy_array_equal(index.values, result.values,
                                            check_same='same')
                tm.assert_numpy_array_equal(index._values, result._values,
                                            check_same='same')

    def test_copy_and_deepcopy(self):
        from copy import copy, deepcopy

        for ind in self.indices.values():

            # don't tests a MultiIndex here (as its tested separated)
            if isinstance(ind, MultiIndex):
                continue

            for func in (copy, deepcopy):
                idx_copy = func(ind)
                assert idx_copy is not ind
                assert idx_copy.equals(ind)

            new_copy = ind.copy(deep=True, name="banana")
            assert new_copy.name == "banana"

    def test_duplicates(self):
        for ind in self.indices.values():

            if not len(ind):
                continue
            if isinstance(ind, MultiIndex):
                continue
            idx = self._holder([ind[0]] * 5)
            assert not idx.is_unique
            assert idx.has_duplicates

            # GH 10115
            # preserve names
            idx.name = 'foo'
            result = idx.drop_duplicates()
            assert result.name == 'foo'
            tm.assert_index_equal(result, Index([ind[0]], name='foo'))

    def test_get_unique_index(self):
        for ind in self.indices.values():

            # MultiIndex tested separately
            if not len(ind) or isinstance(ind, MultiIndex):
                continue

            idx = ind[[0] * 5]
            idx_unique = ind[[0]]

            # We test against `idx_unique`, so first we make sure it's unique
            # and doesn't contain nans.
            assert idx_unique.is_unique
            try:
                assert not idx_unique.hasnans
            except NotImplementedError:
                pass

            for dropna in [False, True]:
                result = idx._get_unique_index(dropna=dropna)
                tm.assert_index_equal(result, idx_unique)

            # nans:
            if not ind._can_hold_na:
                continue

            if needs_i8_conversion(ind):
                vals = ind.asi8[[0] * 5]
                vals[0] = iNaT
            else:
                vals = ind.values[[0] * 5]
                vals[0] = np.nan

            vals_unique = vals[:2]
            idx_nan = ind._shallow_copy(vals)
            idx_unique_nan = ind._shallow_copy(vals_unique)
            assert idx_unique_nan.is_unique

            assert idx_nan.dtype == ind.dtype
            assert idx_unique_nan.dtype == ind.dtype

            for dropna, expected in zip([False, True],
                                        [idx_unique_nan, idx_unique]):
                for i in [idx_nan, idx_unique_nan]:
                    result = i._get_unique_index(dropna=dropna)
                    tm.assert_index_equal(result, expected)

    def test_sort(self):
        for ind in self.indices.values():
            pytest.raises(TypeError, ind.sort)

    def test_mutability(self):
        for ind in self.indices.values():
            if not len(ind):
                continue
            pytest.raises(TypeError, ind.__setitem__, 0, ind[0])

    def test_view(self):
        for ind in self.indices.values():
            i_view = ind.view()
            assert i_view.name == ind.name

    def test_compat(self):
        for ind in self.indices.values():
            assert ind.tolist() == list(ind)

    def test_memory_usage(self):
        for name, index in compat.iteritems(self.indices):
            result = index.memory_usage()
            if len(index):
                index.get_loc(index[0])
                result2 = index.memory_usage()
                result3 = index.memory_usage(deep=True)

                # RangeIndex, IntervalIndex
                # don't have engines
                if not isinstance(index, (RangeIndex, IntervalIndex)):
                    assert result2 > result

                if index.inferred_type == 'object':
                    assert result3 > result2

            else:

                # we report 0 for no-length
                assert result == 0

    def test_argsort(self):
        for k, ind in self.indices.items():

            # separately tested
            if k in ['catIndex']:
                continue

            result = ind.argsort()
            expected = np.array(ind).argsort()
            tm.assert_numpy_array_equal(result, expected, check_dtype=False)

    def test_numpy_argsort(self):
        for k, ind in self.indices.items():
            result = np.argsort(ind)
            expected = ind.argsort()
            tm.assert_numpy_array_equal(result, expected)

            # these are the only two types that perform
            # pandas compatibility input validation - the
            # rest already perform separate (or no) such
            # validation via their 'values' attribute as
            # defined in pandas.core.indexes/base.py - they
            # cannot be changed at the moment due to
            # backwards compatibility concerns
            if isinstance(type(ind), (CategoricalIndex, RangeIndex)):
                msg = "the 'axis' parameter is not supported"
                tm.assert_raises_regex(ValueError, msg,
                                       np.argsort, ind, axis=1)

                msg = "the 'kind' parameter is not supported"
                tm.assert_raises_regex(ValueError, msg, np.argsort,
                                       ind, kind='mergesort')

                msg = "the 'order' parameter is not supported"
                tm.assert_raises_regex(ValueError, msg, np.argsort,
                                       ind, order=('a', 'b'))

    def test_pickle(self):
        for ind in self.indices.values():
            self.verify_pickle(ind)
            ind.name = 'foo'
            self.verify_pickle(ind)

    def test_take(self):
        indexer = [4, 3, 0, 2]
        for k, ind in self.indices.items():

            # separate
            if k in ['boolIndex', 'tuples', 'empty']:
                continue

            result = ind.take(indexer)
            expected = ind[indexer]
            assert result.equals(expected)

            if not isinstance(ind,
                              (DatetimeIndex, PeriodIndex, TimedeltaIndex)):
                # GH 10791
                with pytest.raises(AttributeError):
                    ind.freq

    def test_take_invalid_kwargs(self):
        idx = self.create_index()
        indices = [1, 2]

        msg = r"take\(\) got an unexpected keyword argument 'foo'"
        tm.assert_raises_regex(TypeError, msg, idx.take,
                               indices, foo=2)

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, idx.take,
                               indices, out=indices)

        msg = "the 'mode' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, idx.take,
                               indices, mode='clip')

    def test_repeat(self):
        rep = 2
        i = self.create_index()
        expected = pd.Index(i.values.repeat(rep), name=i.name)
        tm.assert_index_equal(i.repeat(rep), expected)

        i = self.create_index()
        rep = np.arange(len(i))
        expected = pd.Index(i.values.repeat(rep), name=i.name)
        tm.assert_index_equal(i.repeat(rep), expected)

    def test_numpy_repeat(self):
        rep = 2
        i = self.create_index()
        expected = i.repeat(rep)
        tm.assert_index_equal(np.repeat(i, rep), expected)

        msg = "the 'axis' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.repeat,
                               i, rep, axis=0)

    def test_where(self):
        i = self.create_index()
        result = i.where(notnull(i))
        expected = i
        tm.assert_index_equal(result, expected)

        _nan = i._na_value
        cond = [False] + [True] * len(i[1:])
        expected = pd.Index([_nan] + i[1:].tolist(), dtype=i.dtype)

        result = i.where(cond)
        tm.assert_index_equal(result, expected)

    def test_where_array_like(self):
        i = self.create_index()

        _nan = i._na_value
        cond = [False] + [True] * (len(i) - 1)
        klasses = [list, tuple, np.array, pd.Series]
        expected = pd.Index([_nan] + i[1:].tolist(), dtype=i.dtype)

        for klass in klasses:
            result = i.where(klass(cond))
            tm.assert_index_equal(result, expected)

    def test_setops_errorcases(self):
        for name, idx in compat.iteritems(self.indices):
            # # non-iterable input
            cases = [0.5, 'xxx']
            methods = [idx.intersection, idx.union, idx.difference,
                       idx.symmetric_difference]

            for method in methods:
                for case in cases:
                    tm.assert_raises_regex(TypeError,
                                           "Input must be Index "
                                           "or array-like",
                                           method, case)

    def test_intersection_base(self):
        for name, idx in compat.iteritems(self.indices):
            first = idx[:5]
            second = idx[:3]
            intersect = first.intersection(second)

            if isinstance(idx, CategoricalIndex):
                pass
            else:
                assert tm.equalContents(intersect, second)

            # GH 10149
            cases = [klass(second.values)
                     for klass in [np.array, Series, list]]
            for case in cases:
                if isinstance(idx, PeriodIndex):
                    msg = "can only call with other PeriodIndex-ed objects"
                    with tm.assert_raises_regex(ValueError, msg):
                        result = first.intersection(case)
                elif isinstance(idx, CategoricalIndex):
                    pass
                else:
                    result = first.intersection(case)
                    assert tm.equalContents(result, second)

            if isinstance(idx, MultiIndex):
                msg = "other must be a MultiIndex or a list of tuples"
                with tm.assert_raises_regex(TypeError, msg):
                    result = first.intersection([1, 2, 3])

    def test_union_base(self):
        for name, idx in compat.iteritems(self.indices):
            first = idx[3:]
            second = idx[:5]
            everything = idx
            union = first.union(second)
            assert tm.equalContents(union, everything)

            # GH 10149
            cases = [klass(second.values)
                     for klass in [np.array, Series, list]]
            for case in cases:
                if isinstance(idx, PeriodIndex):
                    msg = "can only call with other PeriodIndex-ed objects"
                    with tm.assert_raises_regex(ValueError, msg):
                        result = first.union(case)
                elif isinstance(idx, CategoricalIndex):
                    pass
                else:
                    result = first.union(case)
                    assert tm.equalContents(result, everything)

            if isinstance(idx, MultiIndex):
                msg = "other must be a MultiIndex or a list of tuples"
                with tm.assert_raises_regex(TypeError, msg):
                    result = first.union([1, 2, 3])

    def test_difference_base(self):
        for name, idx in compat.iteritems(self.indices):
            first = idx[2:]
            second = idx[:4]
            answer = idx[4:]
            result = first.difference(second)

            if isinstance(idx, CategoricalIndex):
                pass
            else:
                assert tm.equalContents(result, answer)

            # GH 10149
            cases = [klass(second.values)
                     for klass in [np.array, Series, list]]
            for case in cases:
                if isinstance(idx, PeriodIndex):
                    msg = "can only call with other PeriodIndex-ed objects"
                    with tm.assert_raises_regex(ValueError, msg):
                        result = first.difference(case)
                elif isinstance(idx, CategoricalIndex):
                    pass
                elif isinstance(idx, (DatetimeIndex, TimedeltaIndex)):
                    assert result.__class__ == answer.__class__
                    tm.assert_numpy_array_equal(result.asi8, answer.asi8)
                else:
                    result = first.difference(case)
                    assert tm.equalContents(result, answer)

            if isinstance(idx, MultiIndex):
                msg = "other must be a MultiIndex or a list of tuples"
                with tm.assert_raises_regex(TypeError, msg):
                    result = first.difference([1, 2, 3])

    def test_symmetric_difference(self):
        for name, idx in compat.iteritems(self.indices):
            first = idx[1:]
            second = idx[:-1]
            if isinstance(idx, CategoricalIndex):
                pass
            else:
                answer = idx[[0, -1]]
                result = first.symmetric_difference(second)
                assert tm.equalContents(result, answer)

            # GH 10149
            cases = [klass(second.values)
                     for klass in [np.array, Series, list]]
            for case in cases:
                if isinstance(idx, PeriodIndex):
                    msg = "can only call with other PeriodIndex-ed objects"
                    with tm.assert_raises_regex(ValueError, msg):
                        result = first.symmetric_difference(case)
                elif isinstance(idx, CategoricalIndex):
                    pass
                else:
                    result = first.symmetric_difference(case)
                    assert tm.equalContents(result, answer)

            if isinstance(idx, MultiIndex):
                msg = "other must be a MultiIndex or a list of tuples"
                with tm.assert_raises_regex(TypeError, msg):
                    result = first.symmetric_difference([1, 2, 3])

        # 12591 deprecated
        with tm.assert_produces_warning(FutureWarning):
            first.sym_diff(second)

    def test_insert_base(self):

        for name, idx in compat.iteritems(self.indices):
            result = idx[1:4]

            if not len(idx):
                continue

            # test 0th element
            assert idx[0:4].equals(result.insert(0, idx[0]))

    def test_delete_base(self):

        for name, idx in compat.iteritems(self.indices):

            if not len(idx):
                continue

            if isinstance(idx, RangeIndex):
                # tested in class
                continue

            expected = idx[1:]
            result = idx.delete(0)
            assert result.equals(expected)
            assert result.name == expected.name

            expected = idx[:-1]
            result = idx.delete(-1)
            assert result.equals(expected)
            assert result.name == expected.name

            with pytest.raises((IndexError, ValueError)):
                # either depending on numpy version
                result = idx.delete(len(idx))

    def test_equals(self):

        for name, idx in compat.iteritems(self.indices):
            assert idx.equals(idx)
            assert idx.equals(idx.copy())
            assert idx.equals(idx.astype(object))

            assert not idx.equals(list(idx))
            assert not idx.equals(np.array(idx))

            # Cannot pass in non-int64 dtype to RangeIndex
            if not isinstance(idx, RangeIndex):
                same_values = Index(idx, dtype=object)
                assert idx.equals(same_values)
                assert same_values.equals(idx)

            if idx.nlevels == 1:
                # do not test MultiIndex
                assert not idx.equals(pd.Series(idx))

    def test_equals_op(self):
        # GH9947, GH10637
        index_a = self.create_index()
        if isinstance(index_a, PeriodIndex):
            return

        n = len(index_a)
        index_b = index_a[0:-1]
        index_c = index_a[0:-1].append(index_a[-2:-1])
        index_d = index_a[0:1]
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            index_a == index_b
        expected1 = np.array([True] * n)
        expected2 = np.array([True] * (n - 1) + [False])
        tm.assert_numpy_array_equal(index_a == index_a, expected1)
        tm.assert_numpy_array_equal(index_a == index_c, expected2)

        # test comparisons with numpy arrays
        array_a = np.array(index_a)
        array_b = np.array(index_a[0:-1])
        array_c = np.array(index_a[0:-1].append(index_a[-2:-1]))
        array_d = np.array(index_a[0:1])
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            index_a == array_b
        tm.assert_numpy_array_equal(index_a == array_a, expected1)
        tm.assert_numpy_array_equal(index_a == array_c, expected2)

        # test comparisons with Series
        series_a = Series(array_a)
        series_b = Series(array_b)
        series_c = Series(array_c)
        series_d = Series(array_d)
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            index_a == series_b
        tm.assert_numpy_array_equal(index_a == series_a, expected1)
        tm.assert_numpy_array_equal(index_a == series_c, expected2)

        # cases where length is 1 for one of them
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            index_a == index_d
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            index_a == series_d
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            index_a == array_d
        msg = "Can only compare identically-labeled Series objects"
        with tm.assert_raises_regex(ValueError, msg):
            series_a == series_d
        with tm.assert_raises_regex(ValueError, "Lengths must match"):
            series_a == array_d

        # comparing with a scalar should broadcast; note that we are excluding
        # MultiIndex because in this case each item in the index is a tuple of
        # length 2, and therefore is considered an array of length 2 in the
        # comparison instead of a scalar
        if not isinstance(index_a, MultiIndex):
            expected3 = np.array([False] * (len(index_a) - 2) + [True, False])
            # assuming the 2nd to last item is unique in the data
            item = index_a[-2]
            tm.assert_numpy_array_equal(index_a == item, expected3)
            tm.assert_series_equal(series_a == item, Series(expected3))

    def test_numpy_ufuncs(self):
        # test ufuncs of numpy 1.9.2. see:
        # http://docs.scipy.org/doc/numpy/reference/ufuncs.html

        # some functions are skipped because it may return different result
        # for unicode input depending on numpy version

        for name, idx in compat.iteritems(self.indices):
            for func in [np.exp, np.exp2, np.expm1, np.log, np.log2, np.log10,
                         np.log1p, np.sqrt, np.sin, np.cos, np.tan, np.arcsin,
                         np.arccos, np.arctan, np.sinh, np.cosh, np.tanh,
                         np.arcsinh, np.arccosh, np.arctanh, np.deg2rad,
                         np.rad2deg]:
                if isinstance(idx, DatetimeIndexOpsMixin):
                    # raise TypeError or ValueError (PeriodIndex)
                    # PeriodIndex behavior should be changed in future version
                    with pytest.raises(Exception):
                        with np.errstate(all='ignore'):
                            func(idx)
                elif isinstance(idx, (Float64Index, Int64Index, UInt64Index)):
                    # coerces to float (e.g. np.sin)
                    with np.errstate(all='ignore'):
                        result = func(idx)
                        exp = Index(func(idx.values), name=idx.name)

                    tm.assert_index_equal(result, exp)
                    assert isinstance(result, pd.Float64Index)
                else:
                    # raise AttributeError or TypeError
                    if len(idx) == 0:
                        continue
                    else:
                        with pytest.raises(Exception):
                            with np.errstate(all='ignore'):
                                func(idx)

            for func in [np.isfinite, np.isinf, np.isnan, np.signbit]:
                if isinstance(idx, DatetimeIndexOpsMixin):
                    # raise TypeError or ValueError (PeriodIndex)
                    with pytest.raises(Exception):
                        func(idx)
                elif isinstance(idx, (Float64Index, Int64Index, UInt64Index)):
                    # Results in bool array
                    result = func(idx)
                    assert isinstance(result, np.ndarray)
                    assert not isinstance(result, Index)
                else:
                    if len(idx) == 0:
                        continue
                    else:
                        with pytest.raises(Exception):
                            func(idx)

    def test_hasnans_isnans(self):
        # GH 11343, added tests for hasnans / isnans
        for name, index in self.indices.items():
            if isinstance(index, MultiIndex):
                pass
            else:
                idx = index.copy()

                # cases in indices doesn't include NaN
                expected = np.array([False] * len(idx), dtype=bool)
                tm.assert_numpy_array_equal(idx._isnan, expected)
                assert not idx.hasnans

                idx = index.copy()
                values = idx.values

                if len(index) == 0:
                    continue
                elif isinstance(index, DatetimeIndexOpsMixin):
                    values[1] = iNaT
                elif isinstance(index, (Int64Index, UInt64Index)):
                    continue
                else:
                    values[1] = np.nan

                if isinstance(index, PeriodIndex):
                    idx = index.__class__(values, freq=index.freq)
                else:
                    idx = index.__class__(values)

                expected = np.array([False] * len(idx), dtype=bool)
                expected[1] = True
                tm.assert_numpy_array_equal(idx._isnan, expected)
                assert idx.hasnans

    def test_fillna(self):
        # GH 11343
        for name, index in self.indices.items():
            if len(index) == 0:
                pass
            elif isinstance(index, MultiIndex):
                idx = index.copy()
                msg = "isnull is not defined for MultiIndex"
                with tm.assert_raises_regex(NotImplementedError, msg):
                    idx.fillna(idx[0])
            else:
                idx = index.copy()
                result = idx.fillna(idx[0])
                tm.assert_index_equal(result, idx)
                assert result is not idx

                msg = "'value' must be a scalar, passed: "
                with tm.assert_raises_regex(TypeError, msg):
                    idx.fillna([idx[0]])

                idx = index.copy()
                values = idx.values

                if isinstance(index, DatetimeIndexOpsMixin):
                    values[1] = iNaT
                elif isinstance(index, (Int64Index, UInt64Index)):
                    continue
                else:
                    values[1] = np.nan

                if isinstance(index, PeriodIndex):
                    idx = index.__class__(values, freq=index.freq)
                else:
                    idx = index.__class__(values)

                expected = np.array([False] * len(idx), dtype=bool)
                expected[1] = True
                tm.assert_numpy_array_equal(idx._isnan, expected)
                assert idx.hasnans

    def test_nulls(self):
        # this is really a smoke test for the methods
        # as these are adequantely tested for function elsewhere

        for name, index in self.indices.items():
            if len(index) == 0:
                tm.assert_numpy_array_equal(
                    index.isnull(), np.array([], dtype=bool))
            elif isinstance(index, MultiIndex):
                idx = index.copy()
                msg = "isnull is not defined for MultiIndex"
                with tm.assert_raises_regex(NotImplementedError, msg):
                    idx.isnull()
            else:

                if not index.hasnans:
                    tm.assert_numpy_array_equal(
                        index.isnull(), np.zeros(len(index), dtype=bool))
                    tm.assert_numpy_array_equal(
                        index.notnull(), np.ones(len(index), dtype=bool))
                else:
                    result = isnull(index)
                    tm.assert_numpy_array_equal(index.isnull(), result)
                    tm.assert_numpy_array_equal(index.notnull(), ~result)

    def test_empty(self):
        # GH 15270
        index = self.create_index()
        assert not index.empty
        assert index[:0].empty
