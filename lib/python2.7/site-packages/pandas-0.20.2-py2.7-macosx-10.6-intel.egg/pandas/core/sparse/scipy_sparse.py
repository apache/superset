"""
Interaction with scipy.sparse matrices.

Currently only includes SparseSeries.to_coo helpers.
"""
from pandas.core.index import MultiIndex, Index
from pandas.core.series import Series
from pandas.compat import OrderedDict, lmap


def _check_is_partition(parts, whole):
    whole = set(whole)
    parts = [set(x) for x in parts]
    if set.intersection(*parts) != set():
        raise ValueError(
            'Is not a partition because intersection is not null.')
    if set.union(*parts) != whole:
        raise ValueError('Is not a partition because union is not the whole.')


def _to_ijv(ss, row_levels=(0, ), column_levels=(1, ), sort_labels=False):
    """ For arbitrary (MultiIndexed) SparseSeries return
    (v, i, j, ilabels, jlabels) where (v, (i, j)) is suitable for
    passing to scipy.sparse.coo constructor. """
    # index and column levels must be a partition of the index
    _check_is_partition([row_levels, column_levels], range(ss.index.nlevels))

    # from the SparseSeries: get the labels and data for non-null entries
    values = ss._data.internal_values()._valid_sp_values

    nonnull_labels = ss.dropna()

    def get_indexers(levels):
        """ Return sparse coords and dense labels for subset levels """

        # TODO: how to do this better? cleanly slice nonnull_labels given the
        # coord
        values_ilabels = [tuple(x[i] for i in levels)
                          for x in nonnull_labels.index]
        if len(levels) == 1:
            values_ilabels = [x[0] for x in values_ilabels]

        # # performance issues with groupby ###################################
        # TODO: these two lines can rejplace the code below but
        # groupby is too slow (in some cases at least)
        # labels_to_i = ss.groupby(level=levels, sort=sort_labels).first()
        # labels_to_i[:] = np.arange(labels_to_i.shape[0])

        def _get_label_to_i_dict(labels, sort_labels=False):
            """ Return OrderedDict of unique labels to number.
            Optionally sort by label.
            """
            labels = Index(lmap(tuple, labels)).unique().tolist()  # squish
            if sort_labels:
                labels = sorted(list(labels))
            d = OrderedDict((k, i) for i, k in enumerate(labels))
            return (d)

        def _get_index_subset_to_coord_dict(index, subset, sort_labels=False):
            def robust_get_level_values(i):
                # if index has labels (that are not None) use those,
                # else use the level location
                try:
                    return index.get_level_values(index.names[i])
                except KeyError:
                    return index.get_level_values(i)

            ilabels = list(zip(*[robust_get_level_values(i) for i in subset]))
            labels_to_i = _get_label_to_i_dict(ilabels,
                                               sort_labels=sort_labels)
            labels_to_i = Series(labels_to_i)
            if len(subset) > 1:
                labels_to_i.index = MultiIndex.from_tuples(labels_to_i.index)
            labels_to_i.index.names = [index.names[i] for i in subset]
            labels_to_i.name = 'value'
            return (labels_to_i)

        labels_to_i = _get_index_subset_to_coord_dict(ss.index, levels,
                                                      sort_labels=sort_labels)
        # #####################################################################
        # #####################################################################

        i_coord = labels_to_i[values_ilabels].tolist()
        i_labels = labels_to_i.index.tolist()

        return i_coord, i_labels

    i_coord, i_labels = get_indexers(row_levels)
    j_coord, j_labels = get_indexers(column_levels)

    return values, i_coord, j_coord, i_labels, j_labels


def _sparse_series_to_coo(ss, row_levels=(0, ), column_levels=(1, ),
                          sort_labels=False):
    """ Convert a SparseSeries to a scipy.sparse.coo_matrix using index
    levels row_levels, column_levels as the row and column
    labels respectively. Returns the sparse_matrix, row and column labels.
    """

    import scipy.sparse

    if ss.index.nlevels < 2:
        raise ValueError('to_coo requires MultiIndex with nlevels > 2')
    if not ss.index.is_unique:
        raise ValueError('Duplicate index entries are not allowed in to_coo '
                         'transformation.')

    # to keep things simple, only rely on integer indexing (not labels)
    row_levels = [ss.index._get_level_number(x) for x in row_levels]
    column_levels = [ss.index._get_level_number(x) for x in column_levels]

    v, i, j, rows, columns = _to_ijv(ss, row_levels=row_levels,
                                     column_levels=column_levels,
                                     sort_labels=sort_labels)
    sparse_matrix = scipy.sparse.coo_matrix(
        (v, (i, j)), shape=(len(rows), len(columns)))
    return sparse_matrix, rows, columns


def _coo_to_sparse_series(A, dense_index=False):
    """ Convert a scipy.sparse.coo_matrix to a SparseSeries.
    Use the defaults given in the SparseSeries constructor.
    """
    s = Series(A.data, MultiIndex.from_arrays((A.row, A.col)))
    s = s.sort_index()
    s = s.to_sparse()  # TODO: specify kind?
    if dense_index:
        # is there a better constructor method to use here?
        i = range(A.shape[0])
        j = range(A.shape[1])
        ind = MultiIndex.from_product([i, j])
        s = s.reindex_axis(ind)
    return s
