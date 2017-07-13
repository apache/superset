import numpy as np

from pandas.core.dtypes.common import is_list_like

from pandas.compat import reduce
from pandas.core.index import Index
from pandas.core import common as com


def match(needles, haystack):
    haystack = Index(haystack)
    needles = Index(needles)
    return haystack.get_indexer(needles)


def cartesian_product(X):
    """
    Numpy version of itertools.product or pandas.compat.product.
    Sometimes faster (for large inputs)...

    Parameters
    ----------
    X : list-like of list-likes

    Returns
    -------
    product : list of ndarrays

    Examples
    --------
    >>> cartesian_product([list('ABC'), [1, 2]])
    [array(['A', 'A', 'B', 'B', 'C', 'C'], dtype='|S1'),
    array([1, 2, 1, 2, 1, 2])]

    See also
    --------
    itertools.product : Cartesian product of input iterables.  Equivalent to
        nested for-loops.
    pandas.compat.product : An alias for itertools.product.
    """
    msg = "Input must be a list-like of list-likes"
    if not is_list_like(X):
        raise TypeError(msg)
    for x in X:
        if not is_list_like(x):
            raise TypeError(msg)

    if len(X) == 0:
        return []

    lenX = np.fromiter((len(x) for x in X), dtype=np.intp)
    cumprodX = np.cumproduct(lenX)

    a = np.roll(cumprodX, 1)
    a[0] = 1

    if cumprodX[-1] != 0:
        b = cumprodX[-1] / cumprodX
    else:
        # if any factor is empty, the cartesian product is empty
        b = np.zeros_like(cumprodX)

    return [np.tile(np.repeat(np.asarray(com._values_from_object(x)), b[i]),
                    np.product(a[i]))
            for i, x in enumerate(X)]


def _compose2(f, g):
    """Compose 2 callables"""
    return lambda *args, **kwargs: f(g(*args, **kwargs))


def compose(*funcs):
    """Compose 2 or more callables"""
    assert len(funcs) > 1, 'At least 2 callables must be passed to compose'
    return reduce(_compose2, funcs)
