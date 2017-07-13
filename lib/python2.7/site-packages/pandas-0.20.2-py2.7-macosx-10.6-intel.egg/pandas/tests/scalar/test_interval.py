from __future__ import division

import pytest
from pandas import Interval
import pandas.util.testing as tm


class TestInterval(object):
    def setup_method(self, method):
        self.interval = Interval(0, 1)

    def test_properties(self):
        assert self.interval.closed == 'right'
        assert self.interval.left == 0
        assert self.interval.right == 1
        assert self.interval.mid == 0.5

    def test_repr(self):
        assert repr(self.interval) == "Interval(0, 1, closed='right')"
        assert str(self.interval) == "(0, 1]"

        interval_left = Interval(0, 1, closed='left')
        assert repr(interval_left) == "Interval(0, 1, closed='left')"
        assert str(interval_left) == "[0, 1)"

    def test_contains(self):
        assert 0.5 in self.interval
        assert 1 in self.interval
        assert 0 not in self.interval
        pytest.raises(TypeError, lambda: self.interval in self.interval)

        interval = Interval(0, 1, closed='both')
        assert 0 in interval
        assert 1 in interval

        interval = Interval(0, 1, closed='neither')
        assert 0 not in interval
        assert 0.5 in interval
        assert 1 not in interval

    def test_equal(self):
        assert Interval(0, 1) == Interval(0, 1, closed='right')
        assert Interval(0, 1) != Interval(0, 1, closed='left')
        assert Interval(0, 1) != 0

    def test_comparison(self):
        with tm.assert_raises_regex(TypeError, 'unorderable types'):
            Interval(0, 1) < 2

        assert Interval(0, 1) < Interval(1, 2)
        assert Interval(0, 1) < Interval(0, 2)
        assert Interval(0, 1) < Interval(0.5, 1.5)
        assert Interval(0, 1) <= Interval(0, 1)
        assert Interval(0, 1) > Interval(-1, 2)
        assert Interval(0, 1) >= Interval(0, 1)

    def test_hash(self):
        # should not raise
        hash(self.interval)

    def test_math_add(self):
        expected = Interval(1, 2)
        actual = self.interval + 1
        assert expected == actual

        expected = Interval(1, 2)
        actual = 1 + self.interval
        assert expected == actual

        actual = self.interval
        actual += 1
        assert expected == actual

        with pytest.raises(TypeError):
            self.interval + Interval(1, 2)

        with pytest.raises(TypeError):
            self.interval + 'foo'

    def test_math_sub(self):
        expected = Interval(-1, 0)
        actual = self.interval - 1
        assert expected == actual

        actual = self.interval
        actual -= 1
        assert expected == actual

        with pytest.raises(TypeError):
            self.interval - Interval(1, 2)

        with pytest.raises(TypeError):
            self.interval - 'foo'

    def test_math_mult(self):
        expected = Interval(0, 2)
        actual = self.interval * 2
        assert expected == actual

        expected = Interval(0, 2)
        actual = 2 * self.interval
        assert expected == actual

        actual = self.interval
        actual *= 2
        assert expected == actual

        with pytest.raises(TypeError):
            self.interval * Interval(1, 2)

        with pytest.raises(TypeError):
            self.interval * 'foo'

    def test_math_div(self):
        expected = Interval(0, 0.5)
        actual = self.interval / 2.0
        assert expected == actual

        actual = self.interval
        actual /= 2.0
        assert expected == actual

        with pytest.raises(TypeError):
            self.interval / Interval(1, 2)

        with pytest.raises(TypeError):
            self.interval / 'foo'
