from pandas.compat import range

from numpy import nan
import numpy as np

from pandas.core.sparse.api import SparseList, SparseArray
import pandas.util.testing as tm


class TestSparseList(object):

    def setup_method(self, method):
        self.na_data = np.array([nan, nan, 1, 2, 3, nan, 4, 5, nan, 6])
        self.zero_data = np.array([0, 0, 1, 2, 3, 0, 4, 5, 0, 6])

    def test_deprecation(self):
        # see gh-13784
        with tm.assert_produces_warning(FutureWarning):
            SparseList()

    def test_constructor(self):
        with tm.assert_produces_warning(FutureWarning):
            lst1 = SparseList(self.na_data[:5])
        with tm.assert_produces_warning(FutureWarning):
            exp = SparseList()

        exp.append(self.na_data[:5])
        tm.assert_sp_list_equal(lst1, exp)

    def test_len(self):
        with tm.assert_produces_warning(FutureWarning):
            arr = self.na_data
            splist = SparseList()
            splist.append(arr[:5])
            assert len(splist) == 5
            splist.append(arr[5])
            assert len(splist) == 6
            splist.append(arr[6:])
            assert len(splist) == 10

    def test_append_na(self):
        with tm.assert_produces_warning(FutureWarning):
            arr = self.na_data
            splist = SparseList()
            splist.append(arr[:5])
            splist.append(arr[5])
            splist.append(arr[6:])

            sparr = splist.to_array()
            tm.assert_sp_array_equal(sparr, SparseArray(arr))

    def test_append_zero(self):
        with tm.assert_produces_warning(FutureWarning):
            arr = self.zero_data
            splist = SparseList(fill_value=0)
            splist.append(arr[:5])
            splist.append(arr[5])
            splist.append(arr[6:])

            # list always produces int64, but SA constructor
            # is platform dtype aware
            sparr = splist.to_array()
            exp = SparseArray(arr, fill_value=0)
            tm.assert_sp_array_equal(sparr, exp, check_dtype=False)

    def test_consolidate(self):
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            arr = self.na_data
            exp_sparr = SparseArray(arr)

            splist = SparseList()
            splist.append(arr[:5])
            splist.append(arr[5])
            splist.append(arr[6:])

            consol = splist.consolidate(inplace=False)
            assert consol.nchunks == 1
            assert splist.nchunks == 3
            tm.assert_sp_array_equal(consol.to_array(), exp_sparr)

            splist.consolidate()
            assert splist.nchunks == 1
            tm.assert_sp_array_equal(splist.to_array(), exp_sparr)

    def test_copy(self):
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            arr = self.na_data
            exp_sparr = SparseArray(arr)

            splist = SparseList()
            splist.append(arr[:5])
            splist.append(arr[5])

            cp = splist.copy()
            cp.append(arr[6:])
            assert splist.nchunks == 2
            tm.assert_sp_array_equal(cp.to_array(), exp_sparr)

    def test_getitem(self):
        with tm.assert_produces_warning(FutureWarning):
            arr = self.na_data
            splist = SparseList()
            splist.append(arr[:5])
            splist.append(arr[5])
            splist.append(arr[6:])

            for i in range(len(arr)):
                tm.assert_almost_equal(splist[i], arr[i])
                tm.assert_almost_equal(splist[-i], arr[-i])
