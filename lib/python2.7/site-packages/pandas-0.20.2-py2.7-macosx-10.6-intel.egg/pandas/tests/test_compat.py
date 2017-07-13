# -*- coding: utf-8 -*-
"""
Testing that functions from compat work as expected
"""

from pandas.compat import (range, zip, map, filter, lrange, lzip, lmap,
                           lfilter, builtins, iterkeys, itervalues, iteritems,
                           next)


class TestBuiltinIterators(object):

    @classmethod
    def check_result(cls, actual, expected, lengths):
        for (iter_res, list_res), exp, length in zip(actual, expected,
                                                     lengths):
            assert not isinstance(iter_res, list)
            assert isinstance(list_res, list)

            iter_res = list(iter_res)

            assert len(list_res) == length
            assert len(iter_res) == length
            assert iter_res == exp
            assert list_res == exp

    def test_range(self):
        actual1 = range(10)
        actual2 = lrange(10)
        actual = [actual1, actual2],
        expected = list(builtins.range(10)),
        lengths = 10,

        actual1 = range(1, 10, 2)
        actual2 = lrange(1, 10, 2)
        actual += [actual1, actual2],
        lengths += 5,
        expected += list(builtins.range(1, 10, 2)),
        self.check_result(actual, expected, lengths)

    def test_map(self):
        func = lambda x, y, z: x + y + z
        lst = [builtins.range(10), builtins.range(10), builtins.range(10)]
        actual1 = map(func, *lst)
        actual2 = lmap(func, *lst)
        actual = [actual1, actual2],
        expected = list(builtins.map(func, *lst)),
        lengths = 10,
        self.check_result(actual, expected, lengths)

    def test_filter(self):
        func = lambda x: x
        lst = list(builtins.range(10))
        actual1 = filter(func, lst)
        actual2 = lfilter(func, lst)
        actual = [actual1, actual2],
        lengths = 9,
        expected = list(builtins.filter(func, lst)),
        self.check_result(actual, expected, lengths)

    def test_zip(self):
        lst = [builtins.range(10), builtins.range(10), builtins.range(10)]
        actual = [zip(*lst), lzip(*lst)],
        expected = list(builtins.zip(*lst)),
        lengths = 10,
        self.check_result(actual, expected, lengths)

    def test_dict_iterators(self):
        assert next(itervalues({1: 2})) == 2
        assert next(iterkeys({1: 2})) == 1
        assert next(iteritems({1: 2})) == (1, 2)
