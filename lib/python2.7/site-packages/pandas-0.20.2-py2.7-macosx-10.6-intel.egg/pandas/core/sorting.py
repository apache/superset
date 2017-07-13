""" miscellaneous sorting / groupby utilities """

import numpy as np
from pandas.compat import long
from pandas.core.categorical import Categorical
from pandas.core.dtypes.common import (
    _ensure_platform_int,
    _ensure_int64,
    is_categorical_dtype)
from pandas.core.dtypes.missing import isnull
import pandas.core.algorithms as algorithms
from pandas._libs import lib, algos, hashtable
from pandas._libs.hashtable import unique_label_indices


_INT64_MAX = np.iinfo(np.int64).max


def get_group_index(labels, shape, sort, xnull):
    """
    For the particular label_list, gets the offsets into the hypothetical list
    representing the totally ordered cartesian product of all possible label
    combinations, *as long as* this space fits within int64 bounds;
    otherwise, though group indices identify unique combinations of
    labels, they cannot be deconstructed.
    - If `sort`, rank of returned ids preserve lexical ranks of labels.
      i.e. returned id's can be used to do lexical sort on labels;
    - If `xnull` nulls (-1 labels) are passed through.

    Parameters
    ----------
    labels: sequence of arrays
        Integers identifying levels at each location
    shape: sequence of ints same length as labels
        Number of unique levels at each location
    sort: boolean
        If the ranks of returned ids should match lexical ranks of labels
    xnull: boolean
        If true nulls are excluded. i.e. -1 values in the labels are
        passed through
    Returns
    -------
    An array of type int64 where two elements are equal if their corresponding
    labels are equal at all location.
    """
    def _int64_cut_off(shape):
        acc = long(1)
        for i, mul in enumerate(shape):
            acc *= long(mul)
            if not acc < _INT64_MAX:
                return i
        return len(shape)

    def loop(labels, shape):
        # how many levels can be done without overflow:
        nlev = _int64_cut_off(shape)

        # compute flat ids for the first `nlev` levels
        stride = np.prod(shape[1:nlev], dtype='i8')
        out = stride * labels[0].astype('i8', subok=False, copy=False)

        for i in range(1, nlev):
            if shape[i] == 0:
                stride = 0
            else:
                stride //= shape[i]
            out += labels[i] * stride

        if xnull:  # exclude nulls
            mask = labels[0] == -1
            for lab in labels[1:nlev]:
                mask |= lab == -1
            out[mask] = -1

        if nlev == len(shape):  # all levels done!
            return out

        # compress what has been done so far in order to avoid overflow
        # to retain lexical ranks, obs_ids should be sorted
        comp_ids, obs_ids = compress_group_index(out, sort=sort)

        labels = [comp_ids] + labels[nlev:]
        shape = [len(obs_ids)] + shape[nlev:]

        return loop(labels, shape)

    def maybe_lift(lab, size):  # pormote nan values
        return (lab + 1, size + 1) if (lab == -1).any() else (lab, size)

    labels = map(_ensure_int64, labels)
    if not xnull:
        labels, shape = map(list, zip(*map(maybe_lift, labels, shape)))

    return loop(list(labels), list(shape))


def get_compressed_ids(labels, sizes):
    """

    Group_index is offsets into cartesian product of all possible labels. This
    space can be huge, so this function compresses it, by computing offsets
    (comp_ids) into the list of unique labels (obs_group_ids).

    Parameters
    ----------
    labels : list of label arrays
    sizes : list of size of the levels

    Returns
    -------
    tuple of (comp_ids, obs_group_ids)

    """
    ids = get_group_index(labels, sizes, sort=True, xnull=False)
    return compress_group_index(ids, sort=True)


def is_int64_overflow_possible(shape):
    the_prod = long(1)
    for x in shape:
        the_prod *= long(x)

    return the_prod >= _INT64_MAX


def decons_group_index(comp_labels, shape):
    # reconstruct labels
    if is_int64_overflow_possible(shape):
        # at some point group indices are factorized,
        # and may not be deconstructed here! wrong path!
        raise ValueError('cannot deconstruct factorized group indices!')

    label_list = []
    factor = 1
    y = 0
    x = comp_labels
    for i in reversed(range(len(shape))):
        labels = (x - y) % (factor * shape[i]) // factor
        np.putmask(labels, comp_labels < 0, -1)
        label_list.append(labels)
        y = labels * factor
        factor *= shape[i]
    return label_list[::-1]


def decons_obs_group_ids(comp_ids, obs_ids, shape, labels, xnull):
    """
    reconstruct labels from observed group ids

    Parameters
    ----------
    xnull: boolean,
        if nulls are excluded; i.e. -1 labels are passed through
    """

    if not xnull:
        lift = np.fromiter(((a == -1).any() for a in labels), dtype='i8')
        shape = np.asarray(shape, dtype='i8') + lift

    if not is_int64_overflow_possible(shape):
        # obs ids are deconstructable! take the fast route!
        out = decons_group_index(obs_ids, shape)
        return out if xnull or not lift.any() \
            else [x - y for x, y in zip(out, lift)]

    i = unique_label_indices(comp_ids)
    i8copy = lambda a: a.astype('i8', subok=False, copy=True)
    return [i8copy(lab[i]) for lab in labels]


def indexer_from_factorized(labels, shape, compress=True):
    ids = get_group_index(labels, shape, sort=True, xnull=False)

    if not compress:
        ngroups = (ids.size and ids.max()) + 1
    else:
        ids, obs = compress_group_index(ids, sort=True)
        ngroups = len(obs)

    return get_group_index_sorter(ids, ngroups)


def lexsort_indexer(keys, orders=None, na_position='last'):
    labels = []
    shape = []
    if isinstance(orders, bool):
        orders = [orders] * len(keys)
    elif orders is None:
        orders = [True] * len(keys)

    for key, order in zip(keys, orders):

        # we are already a Categorical
        if is_categorical_dtype(key):
            c = key

        # create the Categorical
        else:
            c = Categorical(key, ordered=True)

        if na_position not in ['last', 'first']:
            raise ValueError('invalid na_position: {!r}'.format(na_position))

        n = len(c.categories)
        codes = c.codes.copy()

        mask = (c.codes == -1)
        if order:  # ascending
            if na_position == 'last':
                codes = np.where(mask, n, codes)
            elif na_position == 'first':
                codes += 1
        else:  # not order means descending
            if na_position == 'last':
                codes = np.where(mask, n, n - codes - 1)
            elif na_position == 'first':
                codes = np.where(mask, 0, n - codes)
        if mask.any():
            n += 1

        shape.append(n)
        labels.append(codes)

    return indexer_from_factorized(labels, shape)


def nargsort(items, kind='quicksort', ascending=True, na_position='last'):
    """
    This is intended to be a drop-in replacement for np.argsort which
    handles NaNs. It adds ascending and na_position parameters.
    GH #6399, #5231
    """

    # specially handle Categorical
    if is_categorical_dtype(items):
        return items.argsort(ascending=ascending)

    items = np.asanyarray(items)
    idx = np.arange(len(items))
    mask = isnull(items)
    non_nans = items[~mask]
    non_nan_idx = idx[~mask]
    nan_idx = np.nonzero(mask)[0]
    if not ascending:
        non_nans = non_nans[::-1]
        non_nan_idx = non_nan_idx[::-1]
    indexer = non_nan_idx[non_nans.argsort(kind=kind)]
    if not ascending:
        indexer = indexer[::-1]
    # Finally, place the NaNs at the end or the beginning according to
    # na_position
    if na_position == 'last':
        indexer = np.concatenate([indexer, nan_idx])
    elif na_position == 'first':
        indexer = np.concatenate([nan_idx, indexer])
    else:
        raise ValueError('invalid na_position: {!r}'.format(na_position))
    return indexer


class _KeyMapper(object):

    """
    Ease my suffering. Map compressed group id -> key tuple
    """

    def __init__(self, comp_ids, ngroups, levels, labels):
        self.levels = levels
        self.labels = labels
        self.comp_ids = comp_ids.astype(np.int64)

        self.k = len(labels)
        self.tables = [hashtable.Int64HashTable(ngroups)
                       for _ in range(self.k)]

        self._populate_tables()

    def _populate_tables(self):
        for labs, table in zip(self.labels, self.tables):
            table.map(self.comp_ids, labs.astype(np.int64))

    def get_key(self, comp_id):
        return tuple(level[table.get_item(comp_id)]
                     for table, level in zip(self.tables, self.levels))


def get_flattened_iterator(comp_ids, ngroups, levels, labels):
    # provide "flattened" iterator for multi-group setting
    mapper = _KeyMapper(comp_ids, ngroups, levels, labels)
    return [mapper.get_key(i) for i in range(ngroups)]


def get_indexer_dict(label_list, keys):
    """ return a diction of {labels} -> {indexers} """
    shape = list(map(len, keys))

    group_index = get_group_index(label_list, shape, sort=True, xnull=True)
    ngroups = ((group_index.size and group_index.max()) + 1) \
        if is_int64_overflow_possible(shape) \
        else np.prod(shape, dtype='i8')

    sorter = get_group_index_sorter(group_index, ngroups)

    sorted_labels = [lab.take(sorter) for lab in label_list]
    group_index = group_index.take(sorter)

    return lib.indices_fast(sorter, group_index, keys, sorted_labels)


# ----------------------------------------------------------------------
# sorting levels...cleverly?

def get_group_index_sorter(group_index, ngroups):
    """
    algos.groupsort_indexer implements `counting sort` and it is at least
    O(ngroups), where
        ngroups = prod(shape)
        shape = map(len, keys)
    that is, linear in the number of combinations (cartesian product) of unique
    values of groupby keys. This can be huge when doing multi-key groupby.
    np.argsort(kind='mergesort') is O(count x log(count)) where count is the
    length of the data-frame;
    Both algorithms are `stable` sort and that is necessary for correctness of
    groupby operations. e.g. consider:
        df.groupby(key)[col].transform('first')
    """
    count = len(group_index)
    alpha = 0.0  # taking complexities literally; there may be
    beta = 1.0  # some room for fine-tuning these parameters
    do_groupsort = (count > 0 and ((alpha + beta * ngroups) <
                                   (count * np.log(count))))
    if do_groupsort:
        sorter, _ = algos.groupsort_indexer(_ensure_int64(group_index),
                                            ngroups)
        return _ensure_platform_int(sorter)
    else:
        return group_index.argsort(kind='mergesort')


def compress_group_index(group_index, sort=True):
    """
    Group_index is offsets into cartesian product of all possible labels. This
    space can be huge, so this function compresses it, by computing offsets
    (comp_ids) into the list of unique labels (obs_group_ids).
    """

    size_hint = min(len(group_index), hashtable._SIZE_HINT_LIMIT)
    table = hashtable.Int64HashTable(size_hint)

    group_index = _ensure_int64(group_index)

    # note, group labels come out ascending (ie, 1,2,3 etc)
    comp_ids, obs_group_ids = table.get_labels_groupby(group_index)

    if sort and len(obs_group_ids) > 0:
        obs_group_ids, comp_ids = _reorder_by_uniques(obs_group_ids, comp_ids)

    return comp_ids, obs_group_ids


def _reorder_by_uniques(uniques, labels):
    # sorter is index where elements ought to go
    sorter = uniques.argsort()

    # reverse_indexer is where elements came from
    reverse_indexer = np.empty(len(sorter), dtype=np.int64)
    reverse_indexer.put(sorter, np.arange(len(sorter)))

    mask = labels < 0

    # move labels to right locations (ie, unsort ascending labels)
    labels = algorithms.take_nd(reverse_indexer, labels, allow_fill=False)
    np.putmask(labels, mask, -1)

    # sort observed ids
    uniques = algorithms.take_nd(uniques, sorter, allow_fill=False)

    return uniques, labels
