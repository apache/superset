import numpy as np
from pandas.util import testing as tm
from pandas.tests.test_base import CheckImmutable, CheckStringMixin
from pandas.core.indexes.frozen import FrozenList, FrozenNDArray
from pandas.compat import u


class TestFrozenList(CheckImmutable, CheckStringMixin):
    mutable_methods = ('extend', 'pop', 'remove', 'insert')
    unicode_container = FrozenList([u("\u05d0"), u("\u05d1"), "c"])

    def setup_method(self, method):
        self.lst = [1, 2, 3, 4, 5]
        self.container = FrozenList(self.lst)
        self.klass = FrozenList

    def test_add(self):
        result = self.container + (1, 2, 3)
        expected = FrozenList(self.lst + [1, 2, 3])
        self.check_result(result, expected)

        result = (1, 2, 3) + self.container
        expected = FrozenList([1, 2, 3] + self.lst)
        self.check_result(result, expected)

    def test_inplace(self):
        q = r = self.container
        q += [5]
        self.check_result(q, self.lst + [5])
        # other shouldn't be mutated
        self.check_result(r, self.lst)


class TestFrozenNDArray(CheckImmutable, CheckStringMixin):
    mutable_methods = ('put', 'itemset', 'fill')
    unicode_container = FrozenNDArray([u("\u05d0"), u("\u05d1"), "c"])

    def setup_method(self, method):
        self.lst = [3, 5, 7, -2]
        self.container = FrozenNDArray(self.lst)
        self.klass = FrozenNDArray

    def test_shallow_copying(self):
        original = self.container.copy()
        assert isinstance(self.container.view(), FrozenNDArray)
        assert not isinstance(self.container.view(np.ndarray), FrozenNDArray)
        assert self.container.view() is not self.container
        tm.assert_numpy_array_equal(self.container, original)

        # Shallow copy should be the same too
        assert isinstance(self.container._shallow_copy(), FrozenNDArray)

        # setting should not be allowed
        def testit(container):
            container[0] = 16

        self.check_mutable_error(testit, self.container)

    def test_values(self):
        original = self.container.view(np.ndarray).copy()
        n = original[0] + 15

        vals = self.container.values()
        tm.assert_numpy_array_equal(original, vals)

        assert original is not vals
        vals[0] = n

        assert isinstance(self.container, FrozenNDArray)
        tm.assert_numpy_array_equal(self.container.values(), original)
        assert vals[0] == n
