# -*- coding: utf-8 -*-

import pytest

import numpy as np

from pandas import Series, Timestamp
from pandas.compat import range, lmap
import pandas.core.common as com
import pandas.util.testing as tm


def test_mut_exclusive():
    msg = "mutually exclusive arguments: '[ab]' and '[ab]'"
    with tm.assert_raises_regex(TypeError, msg):
        com._mut_exclusive(a=1, b=2)
    assert com._mut_exclusive(a=1, b=None) == 1
    assert com._mut_exclusive(major=None, major_axis=None) is None
    assert com._mut_exclusive(a=None, b=2) == 2


def test_get_callable_name():
    from functools import partial
    getname = com._get_callable_name

    def fn(x):
        return x

    lambda_ = lambda x: x
    part1 = partial(fn)
    part2 = partial(part1)

    class somecall(object):

        def __call__(self):
            return x  # noqa

    assert getname(fn) == 'fn'
    assert getname(lambda_)
    assert getname(part1) == 'fn'
    assert getname(part2) == 'fn'
    assert getname(somecall()) == 'somecall'
    assert getname(1) is None


def test_any_none():
    assert (com._any_none(1, 2, 3, None))
    assert (not com._any_none(1, 2, 3, 4))


def test_all_not_none():
    assert (com._all_not_none(1, 2, 3, 4))
    assert (not com._all_not_none(1, 2, 3, None))
    assert (not com._all_not_none(None, None, None, None))


def test_iterpairs():
    data = [1, 2, 3, 4]
    expected = [(1, 2), (2, 3), (3, 4)]

    result = list(com.iterpairs(data))

    assert (result == expected)


def test_split_ranges():
    def _bin(x, width):
        "return int(x) as a base2 string of given width"
        return ''.join(str((x >> i) & 1) for i in range(width - 1, -1, -1))

    def test_locs(mask):
        nfalse = sum(np.array(mask) == 0)

        remaining = 0
        for s, e in com.split_ranges(mask):
            remaining += e - s

            assert 0 not in mask[s:e]

        # make sure the total items covered by the ranges are a complete cover
        assert remaining + nfalse == len(mask)

    # exhaustively test all possible mask sequences of length 8
    ncols = 8
    for i in range(2 ** ncols):
        cols = lmap(int, list(_bin(i, ncols)))  # count up in base2
        mask = [cols[i] == 1 for i in range(len(cols))]
        test_locs(mask)

    # base cases
    test_locs([])
    test_locs([0])
    test_locs([1])


def test_map_indices_py():
    data = [4, 3, 2, 1]
    expected = {4: 0, 3: 1, 2: 2, 1: 3}

    result = com.map_indices_py(data)

    assert (result == expected)


def test_union():
    a = [1, 2, 3]
    b = [4, 5, 6]

    union = sorted(com.union(a, b))

    assert ((a + b) == union)


def test_difference():
    a = [1, 2, 3]
    b = [1, 2, 3, 4, 5, 6]

    inter = sorted(com.difference(b, a))

    assert ([4, 5, 6] == inter)


def test_intersection():
    a = [1, 2, 3]
    b = [1, 2, 3, 4, 5, 6]

    inter = sorted(com.intersection(a, b))

    assert (a == inter)


def test_groupby():
    values = ['foo', 'bar', 'baz', 'baz2', 'qux', 'foo3']
    expected = {'f': ['foo', 'foo3'],
                'b': ['bar', 'baz', 'baz2'],
                'q': ['qux']}

    grouped = com.groupby(values, lambda x: x[0])

    for k, v in grouped:
        assert v == expected[k]


def test_random_state():
    import numpy.random as npr
    # Check with seed
    state = com._random_state(5)
    assert state.uniform() == npr.RandomState(5).uniform()

    # Check with random state object
    state2 = npr.RandomState(10)
    assert (com._random_state(state2).uniform() ==
            npr.RandomState(10).uniform())

    # check with no arg random state
    assert com._random_state() is np.random

    # Error for floats or strings
    with pytest.raises(ValueError):
        com._random_state('test')

    with pytest.raises(ValueError):
        com._random_state(5.5)


def test_maybe_match_name():

    matched = com._maybe_match_name(
        Series([1], name='x'), Series(
            [2], name='x'))
    assert (matched == 'x')

    matched = com._maybe_match_name(
        Series([1], name='x'), Series(
            [2], name='y'))
    assert (matched is None)

    matched = com._maybe_match_name(Series([1]), Series([2], name='x'))
    assert (matched is None)

    matched = com._maybe_match_name(Series([1], name='x'), Series([2]))
    assert (matched is None)

    matched = com._maybe_match_name(Series([1], name='x'), [2])
    assert (matched == 'x')

    matched = com._maybe_match_name([1], Series([2], name='y'))
    assert (matched == 'y')


def test_dict_compat():
    data_datetime64 = {np.datetime64('1990-03-15'): 1,
                       np.datetime64('2015-03-15'): 2}
    data_unchanged = {1: 2, 3: 4, 5: 6}
    expected = {Timestamp('1990-3-15'): 1, Timestamp('2015-03-15'): 2}
    assert (com._dict_compat(data_datetime64) == expected)
    assert (com._dict_compat(expected) == expected)
    assert (com._dict_compat(data_unchanged) == data_unchanged)
