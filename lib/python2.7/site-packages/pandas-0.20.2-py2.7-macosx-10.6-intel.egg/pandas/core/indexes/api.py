from pandas.core.indexes.base import (Index, _new_Index,  # noqa
                                 _ensure_index, _get_na_value,
                                 InvalidIndexError)
from pandas.core.indexes.category import CategoricalIndex  # noqa
from pandas.core.indexes.multi import MultiIndex  # noqa
from pandas.core.indexes.interval import IntervalIndex  # noqa
from pandas.core.indexes.numeric import (NumericIndex, Float64Index,  # noqa
                                    Int64Index, UInt64Index)
from pandas.core.indexes.range import RangeIndex  # noqa
from pandas.core.indexes.timedeltas import TimedeltaIndex
from pandas.core.indexes.period import PeriodIndex
from pandas.core.indexes.datetimes import DatetimeIndex

import pandas.core.common as com
from pandas._libs import lib
from pandas._libs.tslib import NaT

# TODO: there are many places that rely on these private methods existing in
# pandas.core.index
__all__ = ['Index', 'MultiIndex', 'NumericIndex', 'Float64Index', 'Int64Index',
           'CategoricalIndex', 'IntervalIndex', 'RangeIndex', 'UInt64Index',
           'InvalidIndexError', 'TimedeltaIndex',
           'PeriodIndex', 'DatetimeIndex',
           '_new_Index', 'NaT',
           '_ensure_index', '_get_na_value', '_get_combined_index',
           '_get_distinct_indexes', '_union_indexes',
           '_get_consensus_names',
           '_all_indexes_same']


def _get_combined_index(indexes, intersect=False):
    # TODO: handle index names!
    indexes = _get_distinct_indexes(indexes)
    if len(indexes) == 0:
        return Index([])
    if len(indexes) == 1:
        return indexes[0]
    if intersect:
        index = indexes[0]
        for other in indexes[1:]:
            index = index.intersection(other)
        return index
    union = _union_indexes(indexes)
    return _ensure_index(union)


def _get_distinct_indexes(indexes):
    return list(dict((id(x), x) for x in indexes).values())


def _union_indexes(indexes):
    if len(indexes) == 0:
        raise AssertionError('Must have at least 1 Index to union')
    if len(indexes) == 1:
        result = indexes[0]
        if isinstance(result, list):
            result = Index(sorted(result))
        return result

    indexes, kind = _sanitize_and_check(indexes)

    def _unique_indices(inds):
        def conv(i):
            if isinstance(i, Index):
                i = i.tolist()
            return i

        return Index(lib.fast_unique_multiple_list([conv(i) for i in inds]))

    if kind == 'special':
        result = indexes[0]

        if hasattr(result, 'union_many'):
            return result.union_many(indexes[1:])
        else:
            for other in indexes[1:]:
                result = result.union(other)
            return result
    elif kind == 'array':
        index = indexes[0]
        for other in indexes[1:]:
            if not index.equals(other):
                return _unique_indices(indexes)

        name = _get_consensus_names(indexes)[0]
        if name != index.name:
            index = index._shallow_copy(name=name)
        return index
    else:
        return _unique_indices(indexes)


def _sanitize_and_check(indexes):
    kinds = list(set([type(index) for index in indexes]))

    if list in kinds:
        if len(kinds) > 1:
            indexes = [Index(com._try_sort(x))
                       if not isinstance(x, Index) else
                       x for x in indexes]
            kinds.remove(list)
        else:
            return indexes, 'list'

    if len(kinds) > 1 or Index not in kinds:
        return indexes, 'special'
    else:
        return indexes, 'array'


def _get_consensus_names(indexes):

    # find the non-none names, need to tupleify to make
    # the set hashable, then reverse on return
    consensus_names = set([tuple(i.names) for i in indexes
                           if any(n is not None for n in i.names)])
    if len(consensus_names) == 1:
        return list(list(consensus_names)[0])
    return [None] * indexes[0].nlevels


def _all_indexes_same(indexes):
    first = indexes[0]
    for index in indexes[1:]:
        if not first.equals(index):
            return False
    return True
