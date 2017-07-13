import warnings
import numpy as np
from pandas.core.base import PandasObject
from pandas.io.formats.printing import pprint_thing

from pandas.core.dtypes.common import is_scalar
from pandas.core.sparse.array import SparseArray
from pandas.util._validators import validate_bool_kwarg
import pandas._libs.sparse as splib


class SparseList(PandasObject):

    """
    Data structure for accumulating data to be converted into a
    SparseArray. Has similar API to the standard Python list

    Parameters
    ----------
    data : scalar or array-like
    fill_value : scalar, default NaN
    """

    def __init__(self, data=None, fill_value=np.nan):

        # see gh-13784
        warnings.warn("SparseList is deprecated and will be removed "
                      "in a future version", FutureWarning, stacklevel=2)

        self.fill_value = fill_value
        self._chunks = []

        if data is not None:
            self.append(data)

    def __unicode__(self):
        contents = '\n'.join(repr(c) for c in self._chunks)
        return '%s\n%s' % (object.__repr__(self), pprint_thing(contents))

    def __len__(self):
        return sum(len(c) for c in self._chunks)

    def __getitem__(self, i):
        if i < 0:
            if i + len(self) < 0:  # pragma: no cover
                raise ValueError('%d out of range' % i)
            i += len(self)

        passed = 0
        j = 0
        while i >= passed + len(self._chunks[j]):
            passed += len(self._chunks[j])
            j += 1
        return self._chunks[j][i - passed]

    def __setitem__(self, i, value):
        raise NotImplementedError

    @property
    def nchunks(self):
        return len(self._chunks)

    @property
    def is_consolidated(self):
        return self.nchunks == 1

    def consolidate(self, inplace=True):
        """
        Internally consolidate chunks of data

        Parameters
        ----------
        inplace : boolean, default True
            Modify the calling object instead of constructing a new one

        Returns
        -------
        splist : SparseList
            If inplace=False, new object, otherwise reference to existing
            object
        """
        inplace = validate_bool_kwarg(inplace, 'inplace')
        if not inplace:
            result = self.copy()
        else:
            result = self

        if result.is_consolidated:
            return result

        result._consolidate_inplace()
        return result

    def _consolidate_inplace(self):
        new_values = np.concatenate([c.sp_values for c in self._chunks])
        new_index = _concat_sparse_indexes([c.sp_index for c in self._chunks])
        new_arr = SparseArray(new_values, sparse_index=new_index,
                              fill_value=self.fill_value)
        self._chunks = [new_arr]

    def copy(self):
        """
        Return copy of the list

        Returns
        -------
        new_list : SparseList
        """
        new_splist = SparseList(fill_value=self.fill_value)
        new_splist._chunks = list(self._chunks)
        return new_splist

    def to_array(self):
        """
        Return SparseArray from data stored in the SparseList

        Returns
        -------
        sparr : SparseArray
        """
        self.consolidate(inplace=True)
        return self._chunks[0]

    def append(self, value):
        """
        Append element or array-like chunk of data to the SparseList

        Parameters
        ----------
        value: scalar or array-like
        """
        if is_scalar(value):
            value = [value]

        sparr = SparseArray(value, fill_value=self.fill_value)
        self._chunks.append(sparr)
        self._consolidated = False


def _concat_sparse_indexes(indexes):
    all_indices = []
    total_length = 0

    for index in indexes:
        # increment by offset
        inds = index.to_int_index().indices + total_length

        all_indices.append(inds)
        total_length += index.length

    return splib.IntIndex(total_length, np.concatenate(all_indices))
