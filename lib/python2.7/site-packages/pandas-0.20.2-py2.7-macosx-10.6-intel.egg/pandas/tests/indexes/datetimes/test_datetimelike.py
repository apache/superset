""" generic tests from the Datetimelike class """

import numpy as np
import pandas as pd
from pandas.util import testing as tm
from pandas import Series, Index, DatetimeIndex, date_range

from ..datetimelike import DatetimeLike


class TestDatetimeIndex(DatetimeLike):
    _holder = DatetimeIndex

    def setup_method(self, method):
        self.indices = dict(index=tm.makeDateIndex(10))
        self.setup_indices()

    def create_index(self):
        return date_range('20130101', periods=5)

    def test_shift(self):

        # test shift for datetimeIndex and non datetimeIndex
        # GH8083

        drange = self.create_index()
        result = drange.shift(1)
        expected = DatetimeIndex(['2013-01-02', '2013-01-03', '2013-01-04',
                                  '2013-01-05',
                                  '2013-01-06'], freq='D')
        tm.assert_index_equal(result, expected)

        result = drange.shift(-1)
        expected = DatetimeIndex(['2012-12-31', '2013-01-01', '2013-01-02',
                                  '2013-01-03', '2013-01-04'],
                                 freq='D')
        tm.assert_index_equal(result, expected)

        result = drange.shift(3, freq='2D')
        expected = DatetimeIndex(['2013-01-07', '2013-01-08', '2013-01-09',
                                  '2013-01-10',
                                  '2013-01-11'], freq='D')
        tm.assert_index_equal(result, expected)

    def test_pickle_compat_construction(self):
        pass

    def test_intersection(self):
        first = self.index
        second = self.index[5:]
        intersect = first.intersection(second)
        assert tm.equalContents(intersect, second)

        # GH 10149
        cases = [klass(second.values) for klass in [np.array, Series, list]]
        for case in cases:
            result = first.intersection(case)
            assert tm.equalContents(result, second)

        third = Index(['a', 'b', 'c'])
        result = first.intersection(third)
        expected = pd.Index([], dtype=object)
        tm.assert_index_equal(result, expected)

    def test_union(self):
        first = self.index[:5]
        second = self.index[5:]
        everything = self.index
        union = first.union(second)
        assert tm.equalContents(union, everything)

        # GH 10149
        cases = [klass(second.values) for klass in [np.array, Series, list]]
        for case in cases:
            result = first.union(case)
            assert tm.equalContents(result, everything)
