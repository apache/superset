import warnings


def union_categoricals(to_union, sort_categories=False, ignore_order=False):
    warnings.warn("pandas.types.concat.union_categoricals is "
                  "deprecated and will be removed in a future version.\n"
                  "use pandas.api.types.union_categoricals",
                  FutureWarning, stacklevel=2)
    from pandas.api.types import union_categoricals
    return union_categoricals(
        to_union, sort_categories=sort_categories, ignore_order=ignore_order)
